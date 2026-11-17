import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_NAME, BackupError, decryptFile, inspectDatabase, type VerifyResult } from './backup.js';
import type { Config } from './config.js';
import { knownMigrations, openDb, type DB } from './db.js';

export const pidFile = (cfg: Config) => path.join(cfg.dataDir, 'server.pid');

/** A sentinel file the running server polls for (see server/index.ts) to shut down gracefully. */
export const shutdownRequestFile = (cfg: Config) => path.join(cfg.dataDir, 'shutdown.request');

export function serverIsRunning(cfg: Config): boolean {
  try {
    const pid = Number(fs.readFileSync(pidFile(cfg), 'utf8'));
    if (!Number.isInteger(pid) || pid < 1) return false;
    process.kill(pid, 0); // throws if no such process
    return true;
  } catch {
    return false;
  }
}

/**
 * Asks a running server to stop (via the sentinel file) and waits for it to actually exit, instead
 * of a Windows-level force-kill: this lets an in-flight request finish and the database close
 * cleanly rather than being terminated mid-write. Returns true once the server is confirmed
 * stopped, or false if it is still running after `timeoutMs`. A no-op (returns true immediately)
 * if nothing is running in the first place.
 */
export async function requestGracefulStop(cfg: Config, timeoutMs = 30_000, pollMs = 300): Promise<boolean> {
  if (!serverIsRunning(cfg)) return true;
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  fs.writeFileSync(shutdownRequestFile(cfg), new Date().toISOString());
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    if (!serverIsRunning(cfg)) return true;
  }
  return false;
}

/** Migrations recorded in a database that this build does not have: it came from a newer version. */
function newerMigrationsIn(file: string): string[] {
  const d = new DatabaseSync(file, { readOnly: true });
  try {
    const names = (d.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name);
    const known = new Set(knownMigrations());
    return names.filter((n) => !known.has(n)).sort();
  } finally {
    d.close();
    removeSidecars(file);
  }
}

/** Opening a WAL-mode snapshot, even read-only, can leave -wal/-shm files beside it. */
function removeSidecars(file: string) {
  for (const ext of ['-wal', '-shm']) fs.rmSync(file + ext, { force: true });
}

/**
 * When clinic records were last changed, from the audit trail (every change is audited). Leaves out
 * housekeeping that changes no record - backups, backup checks, logins - or checking a backup would
 * itself make the live side look newer. Returns a time, never patient data.
 */
export function newestActivity(d: DatabaseSync): string | null {
  try {
    return (
      d.prepare("SELECT MAX(at) AS t FROM audit_events WHERE action NOT LIKE 'backup.%' AND action NOT LIKE 'auth.%'").get() as { t: string | null }
    ).t;
  } catch {
    return null;
  }
}

export interface BackupCheck {
  name: string;
  sizeBytes: number;
  /** From the file name (when the backup was taken), else the file's modified time. */
  takenAt: string;
  verify: VerifyResult;
  newestActivityAt: string | null;
  /** Non-empty: made by a newer version of the app; it cannot be restored with this one. */
  newerMigrations: string[];
  canRestoreHere: boolean;
  live: { patients: number; users: number; newestActivityAt: string | null } | null;
}

const takenAtOf = (file: string) => {
  const m = /(\d{8}T\d{6}Z)\.cbk$/.exec(path.basename(file))?.[1] ?? BACKUP_NAME.exec(path.basename(file))?.[1];
  if (m) return `${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}T${m.slice(9, 11)}:${m.slice(11, 13)}:${m.slice(13, 15)}Z`;
  return fs.statSync(file).mtime.toISOString();
};

/**
 * Decrypts a backup into a temporary file inside the (access-restricted) data folder, checks it, and
 * describes it next to the live database - then deletes the temporary file. Never touches the live
 * database. Wrong passphrase, a damaged or altered file, or a failed integrity check all throw.
 */
export async function checkBackup(opts: { file: string; passphrase: string; cfg: Config; liveDb?: DB | null }): Promise<BackupCheck> {
  const { file, passphrase, cfg, liveDb } = opts;
  if (!fs.existsSync(file)) throw new BackupError(`Backup file not found: ${file}`);
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  const tmp = path.join(cfg.dataDir, `.check-${process.pid}-${Date.now()}.sqlite`);
  try {
    await decryptFile(file, tmp, passphrase);
    const verify = inspectDatabase(tmp);
    const newerMigrations = newerMigrationsIn(tmp);
    const d = new DatabaseSync(tmp, { readOnly: true });
    let newestActivityAt: string | null;
    try {
      newestActivityAt = newestActivity(d);
    } finally {
      d.close();
    }
    let live: BackupCheck['live'] = null;
    if (liveDb) {
      const count = (t: string) => (liveDb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
      live = { patients: count('patients'), users: count('users'), newestActivityAt: newestActivity(liveDb) };
    }
    return {
      name: path.basename(file),
      sizeBytes: fs.statSync(file).size,
      takenAt: takenAtOf(file),
      verify,
      newestActivityAt,
      newerMigrations,
      canRestoreHere: newerMigrations.length === 0,
      live,
    };
  } finally {
    for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) fs.rmSync(f, { force: true });
  }
}

export interface RestoreResult {
  restoredFile: string;
  verify: VerifyResult;
  replaced: boolean;
  keptOldAs?: string;
}

/**
 * Decrypts and checks a backup. Without `replace` the restored copy is only written next to the live
 * database for inspection. With `replace` the live database is moved aside (never deleted) and the
 * restored copy takes its place; the server must be stopped first. If the restored database then
 * fails to open as the live one, the swap is undone and the previous database is put back.
 */
export async function restoreBackup(opts: { file: string; passphrase: string; cfg: Config; replace: boolean }): Promise<RestoreResult> {
  const { file, passphrase, cfg, replace } = opts;
  if (!fs.existsSync(file)) throw new BackupError(`Backup file not found: ${file}`);
  if (replace && serverIsRunning(cfg)) throw new BackupError('The clinic server is running. Stop it first, then restore.');
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
  const restored = path.join(cfg.dataDir, `restored-${stamp}.sqlite`);
  await decryptFile(file, restored, passphrase);
  let verify: VerifyResult;
  try {
    verify = inspectDatabase(restored);
    if (replace) {
      const newer = newerMigrationsIn(restored);
      if (newer.length) {
        throw new BackupError(
          `This backup was made by a newer version of the app (it has ${newer.length} database update(s) this version does not know, e.g. ${newer[0]}). ` +
            'Install that version (or newer) first, then restore. Nothing was changed.',
        );
      }
    }
  } catch (e) {
    fs.rmSync(restored, { force: true });
    removeSidecars(restored);
    throw e;
  }
  if (!replace) return { restoredFile: restored, verify, replaced: false };

  const sidecars = ['-wal', '-shm'];
  let keptOldAs: string | undefined;
  if (fs.existsSync(cfg.dbFile)) {
    keptOldAs = `${cfg.dbFile}.before-restore-${stamp}`;
    fs.renameSync(cfg.dbFile, keptOldAs);
    for (const ext of sidecars) {
      if (fs.existsSync(cfg.dbFile + ext)) fs.renameSync(cfg.dbFile + ext, keptOldAs + ext);
    }
  }
  fs.renameSync(restored, cfg.dbFile);
  try {
    // Opening applies any newer migrations and proves the file works as the live database.
    openDb(cfg.dbFile).close();
  } catch (e) {
    // Undo: the failed copy is set aside for diagnosis and the previous database goes back.
    const failedAs = `${cfg.dbFile}.failed-restore-${stamp}`;
    fs.renameSync(cfg.dbFile, failedAs);
    for (const ext of sidecars) if (fs.existsSync(cfg.dbFile + ext)) fs.renameSync(cfg.dbFile + ext, failedAs + ext);
    if (keptOldAs) {
      fs.renameSync(keptOldAs, cfg.dbFile);
      for (const ext of sidecars) if (fs.existsSync(keptOldAs + ext)) fs.renameSync(keptOldAs + ext, cfg.dbFile + ext);
    }
    throw new BackupError(`The restored database could not be opened (${(e as Error).message}). The previous database was put back; nothing was lost.`);
  }
  return { restoredFile: cfg.dbFile, verify, replaced: true, keptOldAs };
}
