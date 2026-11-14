import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { BACKUP_NAME, BackupError, backupStatus, runBackup } from '../backup.js';
import { badRequest, notFound } from '../errors.js';
import { restoreBackup } from '../restore.js';

export function registerBackupRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  app.get('/api/backups', async (req) => {
    requirePerm(req, 'backup:manage');
    return backupStatus(db, cfg);
  });

  app.post('/api/backups/run', async (req, reply) => {
    const user = requirePerm(req, 'backup:manage');
    try {
      const r = await runBackup(db, cfg, user.id);
      return reply.status(201).send({ file: r.file, sizeBytes: r.sizeBytes, status: backupStatus(db, cfg) });
    } catch (e) {
      if (e instanceof BackupError) throw badRequest(e.message);
      throw e;
    }
  });

  /**
   * Takes a backup and then actually restores it (to a throwaway copy, never touching the live
   * database) through the same code path a real disaster recovery would use - not just the
   * decrypt-and-check runBackup already does on its own output internally. Exercises the real
   * restore pathway end to end, for the setup wizard's "prove backups actually work" step.
   */
  app.post('/api/backups/self-test', async (req, reply) => {
    const user = requirePerm(req, 'backup:manage');
    if (!cfg.backupPassphrase) {
      throw badRequest('Backup encryption is not set up on this computer, so there is nothing to test yet. See "One-time setup" in docs/BACKUP-AND-RESTORE.md.');
    }
    try {
      const backup = await runBackup(db, cfg, user.id);
      const restored = await restoreBackup({
        file: path.join(cfg.backupDir, backup.file),
        passphrase: cfg.backupPassphrase!,
        cfg,
        replace: false,
      });
      fs.rmSync(restored.restoredFile, { force: true });
      audit(db, {
        actorId: user.id,
        action: 'backup.self_test',
        entity: 'backup',
        entityId: backup.file,
        detail: { patients: restored.verify.patients, users: restored.verify.users },
      });
      return reply.status(201).send({
        ok: true,
        backup: { file: backup.file, sizeBytes: backup.sizeBytes, verify: backup.verify },
        restoreVerify: restored.verify,
      });
    } catch (e) {
      if (e instanceof BackupError) throw badRequest(e.message);
      throw e;
    }
  });

  app.get('/api/backups/download/:filename', async (req, reply) => {
    const user = requirePerm(req, 'backup:manage');
    let { filename } = req.params as { filename: string };

    if (filename === 'latest') {
      const st = backupStatus(db, cfg);
      if (!st.lastSuccess?.file) throw notFound('Backup (no backup taken yet)');
      filename = st.lastSuccess.file;
    }

    if (!BACKUP_NAME.test(filename)) throw notFound('Backup');
    const filePath = path.join(cfg.backupDir, filename);
    if (!fs.existsSync(filePath)) throw notFound('Backup file');

    const stat = fs.statSync(filePath);
    audit(db, {
      actorId: user.id,
      action: 'backup.download',
      entity: 'backup',
      entityId: filename,
      detail: { filename, sizeBytes: stat.size },
    });

    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', stat.size)
      .send(fs.createReadStream(filePath));
  });
}
