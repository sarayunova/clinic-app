import fs from 'node:fs';
import path from 'node:path';
import { BackupError, decryptFile, inspectDatabase, type VerifyResult } from './backup.js';
import type { Config } from './config.js';
import { openDb } from './db.js';

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

export interface RestoreResult {
  restoredFile: string;
  verify: VerifyResult;
  replaced: boolean;
  keptOldAs?: string;
}

/**
 * Decrypts and checks a backup. Without `replace` the restored copy is only written next to the live
 * database for inspection. With `replace` the live database is moved aside (never deleted) and the
 * restored copy takes its place; the server must be stopped first.
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
  } catch (e) {
    fs.rmSync(restored, { force: true });
    throw e;
  }
  if (!replace) return { restoredFile: restored, verify, replaced: false };

  let keptOldAs: string | undefined;
  if (fs.existsSync(cfg.dbFile)) {
    keptOldAs = `${cfg.dbFile}.before-restore-${stamp}`;
    fs.renameSync(cfg.dbFile, keptOldAs);
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(cfg.dbFile + ext)) fs.renameSync(cfg.dbFile + ext, keptOldAs + ext);
    }
  }
  fs.renameSync(restored, cfg.dbFile);
  // Opening applies any newer migrations and proves the file works as the live database.
  openDb(cfg.dbFile).close();
  return { restoredFile: cfg.dbFile, verify, replaced: true, keptOldAs };
}
