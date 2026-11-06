import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { BACKUP_NAME, BackupError, backupStatus, runBackup } from '../backup.js';
import { badRequest, notFound } from '../errors.js';

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
