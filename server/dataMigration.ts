import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import fs from 'node:fs';
import { inspectDatabase, type VerifyResult } from './backup.js';
import { restrictToServiceAndAdmins } from './windowsAcl.js';

export class MigrationError extends Error {}

export interface MigrationPlan {
  sourceDbFile: string;
  destDir: string;
  destDbFile: string;
}

export interface MigrationResult {
  sourceCounts: { patients: number; users: number; migrations: number };
  destVerify: VerifyResult;
  destDbFile: string;
}

/**
 * Copies (never moves) a database to a new location using SQLite's own online backup API — safe
 * against an open WAL journal, unlike a raw file copy — then verifies the copy's integrity and
 * record counts match the source exactly before accepting it. The source file is never modified,
 * renamed or deleted; the caller decides what to do with it afterwards.
 */
export async function migrateDataDir(plan: MigrationPlan): Promise<MigrationResult> {
  const { sourceDbFile, destDir, destDbFile } = plan;
  if (!fs.existsSync(sourceDbFile)) throw new MigrationError(`No database found at ${sourceDbFile}`);
  if (fs.existsSync(destDbFile) && fs.statSync(destDbFile).size > 0) {
    throw new MigrationError(`${destDbFile} already has data. Refusing to overwrite it.`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  restrictToServiceAndAdmins(destDir);

  // Opened read-only: this function must never write to the source, even indirectly (e.g. via a
  // pending-migration side effect of a normal read/write open).
  const db = new DatabaseSync(sourceDbFile, { readOnly: true });
  try {
    const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    const integrity = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
    if (integrity !== 'ok') throw new MigrationError(`The source database failed its integrity check: ${integrity}. Nothing was copied.`);
    const sourceCounts = { patients: count('patients'), users: count('users'), migrations: count('schema_migrations') };

    const tmpDest = `${destDbFile}.migrating`;
    fs.rmSync(tmpDest, { force: true });
    try {
      await sqliteBackup(db, tmpDest);
      const destVerify = inspectDatabase(tmpDest);
      if (destVerify.patients !== sourceCounts.patients || destVerify.users !== sourceCounts.users || destVerify.migrations !== sourceCounts.migrations) {
        throw new MigrationError(
          `Record counts did not match after copying (source: ${JSON.stringify(sourceCounts)}, copy: ${JSON.stringify(destVerify)}). Aborting — the original data was not changed.`,
        );
      }
      fs.renameSync(tmpDest, destDbFile);
      return { sourceCounts, destVerify, destDbFile };
    } finally {
      fs.rmSync(tmpDest, { force: true });
    }
  } finally {
    db.close();
  }
}
