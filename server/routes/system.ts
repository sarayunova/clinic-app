import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { backupStatus } from '../backup.js';
import {
  backupDiskRelation,
  type BackupDiskRelation,
  diskSpace,
  type DiskSpace,
  isLowOnSpace,
  machineBootedAt,
  restoreTestStatus,
  type RestoreTestStatus,
  serverRestarts,
  type ServerRestarts,
} from '../systemHealth.js';
import { APP_VERSION } from '../version.js';

export interface SystemStatus {
  version: string;
  checkedAt: string;
  serverStartedAt: string;
  machineBootedAt: string;
  dataDir: string;
  dataDirSource: string;
  legacyDataDirsFound: { path: string; sizeBytes: number }[];
  database: { connected: boolean; integrity: string };
  disks: { data: DiskSpace | null; backup: DiskSpace | null };
  backupDisk: BackupDiskRelation;
  host: string;
  port: number;
  https: boolean;
  certificateDaysLeft: number | null;
  timezone: string;
  uptimeSeconds: number;
  restoreTest: RestoreTestStatus;
  restarts: ServerRestarts;
  warnings: string[];
}

const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`;

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

    const disks = { data: diskSpace(cfg.dataDir), backup: diskSpace(cfg.backupDir) };
    if (disks.data && isLowOnSpace(disks.data)) {
      warnings.push(`The disk holding the database is low on space: ${gb(disks.data.freeBytes)} free. The app may stop saving records when it is full.`);
    }
    if (disks.backup && isLowOnSpace(disks.backup) && disks.backup.path !== disks.data?.path) {
      warnings.push(`The backup disk is low on space: ${gb(disks.backup.freeBytes)} free. New backups may fail.`);
    }

    // backupStatus already warns about the same drive letter; this adds what a drive letter hides.
    const backupDisk = await backupDiskRelation(cfg.dataDir, cfg.backupDir);
    if (backupDisk === 'same-physical-disk') {
      warnings.push('The backup folder is on another drive letter, but it is the SAME physical disk as the database. If that disk fails, both are lost. Copy backups to a USB drive or another computer.');
    }

    const restoreTest = restoreTestStatus(db);
    if (restoreTest.lastFailure) warnings.push(`The last restore test failed: ${restoreTest.lastFailure.error}`);
    else if (restoreTest.overdue) {
      warnings.push(
        restoreTest.lastSuccess
          ? `The last restore test was more than ${restoreTest.dueDays} days ago. Run "Test restore now" to prove the backups still open.`
          : 'Backups have never been proven to restore on this computer. Run "Test restore now".',
      );
    }

    const restarts = serverRestarts(path.join(cfg.dataDir, 'logs'));
    if (restarts.crashesLast24Hours >= 3) {
      warnings.push(`The server stopped unexpectedly ${restarts.crashesLast24Hours} times in the last 24 hours and was restarted. The logs folder in ${cfg.dataDir} explains why.`);
    }

    const now = Date.now();
    const status: SystemStatus = {
      version: APP_VERSION,
      checkedAt: new Date(now).toISOString(),
      serverStartedAt: new Date(now - process.uptime() * 1000).toISOString(),
      machineBootedAt: machineBootedAt(now),
      dataDir: cfg.dataDir,
      dataDirSource: cfg.dataDirSource,
      legacyDataDirsFound: cfg.legacyDataDirsFound.map((c) => ({ path: c.path, sizeBytes: c.sizeBytes })),
      database: { connected: true, integrity },
      disks,
      backupDisk,
      host: cfg.host,
      port: cfg.port,
      https: !!tls,
      certificateDaysLeft: tls ? tls.info.daysLeft : null,
      timezone: cfg.timezone,
      uptimeSeconds: Math.floor(process.uptime()),
      restoreTest,
      restarts,
      warnings,
    };

    const backup = backupStatus(db, cfg);
    if (!backup.healthy || backup.warnings.length) warnings.push(...backup.warnings.filter((w) => !warnings.includes(w)));

    return { ...status, backup };
  });
}
