import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { backupStatus } from '../backup.js';

export interface SystemStatus {
  dataDir: string;
  dataDirSource: string;
  legacyDataDirsFound: { path: string; sizeBytes: number }[];
  database: { connected: boolean; integrity: string };
  host: string;
  port: number;
  https: boolean;
  certificateDaysLeft: number | null;
  timezone: string;
  uptimeSeconds: number;
  warnings: string[];
}

export function registerSystemRoutes(app: FastifyInstance, { db, cfg, tls }: Ctx): void {
  app.get('/api/system/status', async (req) => {
    requirePerm(req, 'backup:manage');

    const warnings: string[] = [];
    let integrity = 'unknown';
    try {
      integrity = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
      if (integrity !== 'ok') warnings.push(`Database integrity check reported a problem: ${integrity}`);
    } catch (e) {
      integrity = 'error';
      warnings.push(`Could not run the database integrity check: ${(e as Error).message}`);
    }

    if (cfg.dataDirSource === 'legacy-fallback') {
      warnings.push(`Still using the pre-upgrade data location (${cfg.dataDir}). It has not been moved to the standard machine-wide location yet.`);
    }
    if (tls && tls.info.daysLeft <= 14) {
      warnings.push(`The HTTPS certificate expires in ${tls.info.daysLeft} day(s).`);
    }
    if (!tls && cfg.host !== '127.0.0.1' && cfg.host !== 'localhost') {
      warnings.push('Listening beyond this computer without HTTPS.');
    }

    const status: SystemStatus = {
      dataDir: cfg.dataDir,
      dataDirSource: cfg.dataDirSource,
      legacyDataDirsFound: cfg.legacyDataDirsFound.map((c) => ({ path: c.path, sizeBytes: c.sizeBytes })),
      database: { connected: true, integrity },
      host: cfg.host,
      port: cfg.port,
      https: !!tls,
      certificateDaysLeft: tls ? tls.info.daysLeft : null,
      timezone: cfg.timezone,
      uptimeSeconds: Math.floor(process.uptime()),
      warnings,
    };

    const backup = backupStatus(db, cfg);
    if (!backup.healthy) warnings.push(...backup.warnings);

    return { ...status, backup };
  });
}
