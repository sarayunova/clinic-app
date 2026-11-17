import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { isSea } from 'node:sea';
import { BACKUP_NAME, BackupError, backupStatus, checkPassphrase, listBackups, runBackup } from '../backup.js';
import type { Config } from '../config.js';
import { badRequest, notFound } from '../errors.js';
import { checkBackup, restoreBackup } from '../restore.js';

/** Where a restore can come from. Only these two folders, and only names that match - never a client-supplied path. */
export type RestoreSource = 'backup' | 'pre-upgrade';
const PRE_UPGRADE_NAME = /^clinic-pre-upgrade-(\d{8}T\d{6}Z)\.cbk$/;

export function restorePoints(cfg: Config) {
  const backups = (() => {
    try {
      return listBackups(cfg.backupDir).map((f) => ({ source: 'backup' as RestoreSource, ...f }));
    } catch {
      return []; // an unreadable backup folder is reported by the status page
    }
  })();
  const dir = path.join(cfg.dataDir, 'pre-upgrade');
  let pre: { source: RestoreSource; name: string; sizeBytes: number; at: string }[] = [];
  try {
    pre = fs
      .readdirSync(dir)
      .filter((n) => PRE_UPGRADE_NAME.test(n))
      .map((name) => {
        const m = PRE_UPGRADE_NAME.exec(name)![1]!;
        const at = `${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}T${m.slice(9, 11)}:${m.slice(11, 13)}:${m.slice(13, 15)}Z`;
        return { source: 'pre-upgrade' as RestoreSource, name, sizeBytes: fs.statSync(path.join(dir, name)).size, at };
      });
  } catch {
    /* no pre-upgrade folder yet */
  }
  return [...backups, ...pre].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function restorePointPath(cfg: Config, source: unknown, name: unknown): string | null {
  if (typeof name !== 'string') return null;
  if (source === 'backup' && BACKUP_NAME.test(name)) return path.join(cfg.backupDir, name);
  if (source === 'pre-upgrade' && PRE_UPGRADE_NAME.test(name)) return path.join(cfg.dataDir, 'pre-upgrade', name);
  return null;
}

/** The command an administrator runs to restore `file` on this computer (see scripts/restore-backup.ps1). */
export function restoreCommand(file: string): string {
  if (isSea()) {
    const script = path.join(path.dirname(process.execPath), 'scripts', 'restore-backup.ps1');
    return `powershell -ExecutionPolicy Bypass -File "${script}" -Backup "${file}"`;
  }
  return `npm run restore -- "${file}" --replace   (stop the server first)`;
}

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
      // Recorded so the status page can show a failed restore test, not just the last good one.
      try {
        audit(db, { actorId: user.id, action: 'backup.self_test_failed', entity: 'backup', detail: { message: (e as Error).message } });
      } catch {
        /* the database may be the problem; the error still reaches the caller */
      }
      if (e instanceof BackupError) throw badRequest(e.message);
      throw e;
    }
  });

  app.get('/api/backups/restore-points', async (req) => {
    requirePerm(req, 'backup:manage');
    return { points: restorePoints(cfg) };
  });

  /**
   * Step 1 of a restore, and safe to do any time: decrypts the chosen backup into a temporary copy,
   * checks it and compares it with the live records. Never changes the live database; the actual
   * replacement is done outside the web app by an administrator (scripts/restore-backup.ps1),
   * because the running server cannot safely swap the database it has open.
   */
  app.post('/api/backups/check', async (req) => {
    const user = requirePerm(req, 'backup:manage');
    const body = (req.body ?? {}) as { source?: unknown; name?: unknown };
    const file = restorePointPath(cfg, body.source, body.name);
    if (!file || !fs.existsSync(file)) throw notFound('Backup');
    let passphrase: string;
    try {
      passphrase = checkPassphrase(cfg.backupPassphrase);
    } catch {
      throw badRequest('Backup encryption is not set up on this computer, so backups cannot be opened here.');
    }
    try {
      const result = await checkBackup({ file, passphrase, cfg, liveDb: db });
      audit(db, { actorId: user.id, action: 'backup.checked', entity: 'backup', entityId: result.name, detail: { ok: true, canRestoreHere: result.canRestoreHere } });
      return { ...result, source: body.source, path: file, restoreCommand: restoreCommand(file) };
    } catch (e) {
      audit(db, { actorId: user.id, action: 'backup.checked', entity: 'backup', entityId: String(body.name), detail: { ok: false, message: (e as Error).message } });
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
