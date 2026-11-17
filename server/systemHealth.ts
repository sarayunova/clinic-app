// Real checks behind the administrator's system status page (/api/system/status). Every value here
// is measured on this computer when asked; nothing is a hardcoded "green". None of it reads patient
// records: disk sizes, file names, timestamps and the supervisor's own log lines only.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DB } from './db.js';

export interface DiskSpace {
  path: string;
  freeBytes: number;
  totalBytes: number;
}

const GiB = 1024 ** 3;
/** Below either of these the status page warns: SQLite, backups and logs all need room to write. */
export const LOW_DISK_BYTES = 2 * GiB;
export const LOW_DISK_FRACTION = 0.05;

/** Free/total space of the volume holding `p` (the nearest existing folder above it, if `p` does not exist yet). */
export function diskSpace(p: string): DiskSpace | null {
  let dir = path.resolve(p);
  while (!fs.existsSync(dir)) {
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  try {
    const s = fs.statfsSync(dir);
    return { path: dir, freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize };
  } catch {
    return null;
  }
}

export function isLowOnSpace(d: DiskSpace): boolean {
  return d.freeBytes < LOW_DISK_BYTES || (d.totalBytes > 0 && d.freeBytes / d.totalBytes < LOW_DISK_FRACTION);
}

/**
 * Which physical disk a drive letter lives on. Two drive letters can be two partitions of ONE
 * disk, and then a "separate backup drive" is no protection at all against that disk failing,
 * which the drive-letter comparison in backupStatus cannot tell. Windows only; anything else, or
 * any failure, is null ("could not tell"), never a guess.
 */
export type PhysicalDiskResolver = (driveLetter: string) => Promise<number | null>;

const diskCache = new Map<string, { at: number; disk: number | null }>();

export const windowsPhysicalDisk: PhysicalDiskResolver = (driveLetter) => {
  if (process.platform !== 'win32' || !/^[A-Za-z]$/.test(driveLetter)) return Promise.resolve(null);
  const key = driveLetter.toUpperCase();
  const hit = diskCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return Promise.resolve(hit.disk);
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `(Get-Partition -DriveLetter ${key} -ErrorAction Stop | Get-Disk -ErrorAction Stop).Number`],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        const n = err ? NaN : Number(String(stdout).trim());
        const disk = Number.isInteger(n) ? n : null;
        diskCache.set(key, { at: Date.now(), disk });
        resolve(disk);
      },
    );
  });
};

export type BackupDiskRelation =
  | 'same-drive' // same drive letter / volume as the database
  | 'same-physical-disk' // another drive letter, but a partition of the same physical disk
  | 'separate-disk' // a different physical disk
  | 'network' // a network share (\\server\share)
  | 'unknown'; // could not tell

export async function backupDiskRelation(dataDir: string, backupDir: string, resolve: PhysicalDiskResolver = windowsPhysicalDisk): Promise<BackupDiskRelation> {
  const b = path.resolve(backupDir);
  if (b.startsWith('\\\\')) return 'network';
  const rootOf = (p: string) => path.parse(path.resolve(p)).root.toLowerCase();
  if (rootOf(dataDir) === rootOf(b)) return 'same-drive';
  const letter = (p: string) => /^([a-z]):/i.exec(path.resolve(p))?.[1] ?? '';
  const [dd, bd] = await Promise.all([resolve(letter(dataDir)), resolve(letter(b))]);
  if (dd == null || bd == null) return 'unknown';
  return dd === bd ? 'same-physical-disk' : 'separate-disk';
}

/** A full restore test ("Prove backups work") is due at least this often; the plan asks for routine drills. */
export const RESTORE_TEST_DUE_DAYS = 90;

export interface RestoreTestStatus {
  lastSuccess: { at: string; patients: number | null } | null;
  lastFailure: { at: string; error: string } | null;
  dueDays: number;
  overdue: boolean;
}

/** From the audit trail written by POST /api/backups/self-test. */
export function restoreTestStatus(db: DB, now = Date.now()): RestoreTestStatus {
  const ok = db.prepare("SELECT at, detail FROM audit_events WHERE action = 'backup.self_test' ORDER BY id DESC LIMIT 1").get() as
    | { at: string; detail: string | null }
    | undefined;
  const bad = db.prepare("SELECT at, detail FROM audit_events WHERE action = 'backup.self_test_failed' ORDER BY id DESC LIMIT 1").get() as
    | { at: string; detail: string | null }
    | undefined;
  const parse = (s: string | null) => {
    try {
      return s ? (JSON.parse(s) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  const lastSuccess = ok ? { at: ok.at, patients: typeof parse(ok.detail).patients === 'number' ? (parse(ok.detail).patients as number) : null } : null;
  const failedAfter = bad && (!ok || bad.at > ok.at);
  const lastFailure = failedAfter ? { at: bad.at, error: String(parse(bad.detail).message ?? 'unknown error') } : null;
  const overdue = !lastSuccess || now - Date.parse(lastSuccess.at) > RESTORE_TEST_DUE_DAYS * 86_400_000;
  return { lastSuccess, lastFailure, dueDays: RESTORE_TEST_DUE_DAYS, overdue };
}

export interface ServerRestarts {
  /** Unexpected stops (non-zero exit) the supervisor logged in the last 7 days. */
  crashesLast7Days: number;
  crashesLast24Hours: number;
  lastCrash: { at: string; exitCode: number } | null;
  logFound: boolean;
}

// Written by scripts/run-clinic.ps1: "2026-11-16 23:11:01 Server stopped with exit code 1 after 3 seconds" (local time).
const STOP_LINE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) Server stopped with exit code (-?\d+) after/;

/** Reads only the supervisor's own log (no request or patient data is ever written there). */
export function serverRestarts(logDir: string, now = Date.now()): ServerRestarts {
  const file = path.join(logDir, 'supervisor.log');
  const out: ServerRestarts = { crashesLast7Days: 0, crashesLast24Hours: 0, lastCrash: null, logFound: false };
  let text: string;
  try {
    // The log only ever grows by a few lines per start; the tail is plenty and bounds the work.
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, 256 * 1024);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      text = buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return out;
  }
  out.logFound = true;
  for (const line of text.split(/\r?\n/)) {
    const m = STOP_LINE.exec(line);
    if (!m) continue;
    const exitCode = Number(m[7]);
    if (exitCode === 0) continue; // a clean stop (upgrade, restart) is not a crash
    const at = new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!).getTime();
    const age = now - at;
    if (age < 0 || age > 7 * 86_400_000) continue;
    out.crashesLast7Days++;
    if (age <= 86_400_000) out.crashesLast24Hours++;
    if (!out.lastCrash || at > Date.parse(out.lastCrash.at)) out.lastCrash = { at: new Date(at).toISOString(), exitCode };
  }
  return out;
}

/** When Windows last started (from its uptime). */
export function machineBootedAt(now = Date.now()): string {
  return new Date(now - os.uptime() * 1000).toISOString();
}
