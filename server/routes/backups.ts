import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { BackupError, backupStatus, runBackup } from '../backup.js';
import { badRequest } from '../errors.js';

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
}
