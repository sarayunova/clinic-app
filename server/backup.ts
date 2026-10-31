import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import type { Config } from './config.js';
import { audit } from './audit.js';
import type { DB } from './db.js';
import { nowIso } from './time.js';

/**
 * Encrypted backups.
 *
 * File layout: MAGIC(6) | salt(16) | iv(12) | AES-256-GCM(gzip(sqlite file)) | tag(16)
 * The key comes from a passphrase via scrypt. The header is authenticated, so any change to the file
 * (even one byte) is detected on decrypt. Without the passphrase a backup cannot be opened by anyone,
 * including us: it must be stored somewhere other than this computer.
 */
const MAGIC = Buffer.from('CLBK1\n');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + SALT_LEN + IV_LEN;
export const BACKUP_NAME = /^clinic-(\d{8}T\d{6}Z)\.cbk$/;
export const MIN_PASSPHRASE = 12;

export class BackupError extends Error {}

const deriveKey = (passphrase: string, salt: Buffer) => crypto.scryptSync(passphrase, salt, 32);

export function checkPassphrase(p: string | null | undefined): string {
  if (!p || p.length < MIN_PASSPHRASE) throw new BackupError(`The backup passphrase must be at least ${MIN_PASSPHRASE} characters`);
  return p;
}

export async function encryptFile(src: string, dest: string, passphrase: string): Promise<void> {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const header = Buffer.concat([MAGIC, salt, iv]);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  cipher.setAAD(header);
  const out = fs.createWriteStream(dest, { flags: 'wx' });
  out.write(header);
  // pipeline would end() the stream; write the tag ourselves afterwards.
  await pipeline(fs.createReadStream(src), zlib.createGzip(), cipher, out, { end: false });
  await new Promise<void>((resolve, reject) => out.end(cipher.getAuthTag(), (e?: Error | null) => (e ? reject(e) : resolve())));
}

export async function decryptFile(src: string, dest: string, passphrase: string): Promise<void> {
  const size = fs.statSync(src).size;
  if (size < HEADER_LEN + TAG_LEN) throw new BackupError('This file is not a clinic backup (too small)');
  const fd = fs.openSync(src, 'r');
  const header = Buffer.alloc(HEADER_LEN);
  const tag = Buffer.alloc(TAG_LEN);
  try {
    fs.readSync(fd, header, 0, HEADER_LEN, 0);
    fs.readSync(fd, tag, 0, TAG_LEN, size - TAG_LEN);
  } finally {
    fs.closeSync(fd);
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupError('This file is not a clinic backup');
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = header.subarray(MAGIC.length + SALT_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  try {
    await pipeline(fs.createReadStream(src, { start: HEADER_LEN, end: size - TAG_LEN - 1 }), decipher, zlib.createGunzip(), fs.createWriteStream(dest, { flags: 'wx' }));
  } catch {
    fs.rmSync(dest, { force: true });
    throw new BackupError('Could not open the backup: wrong passphrase, or the file is damaged or has been changed');
  }
}

export interface VerifyResult {
  integrity: string;
  migrations: number;
  patients: number;
  users: number;
}

/** Opens a plain SQLite file read-only and checks it is sound. */
export function inspectDatabase(file: string): VerifyResult {
  const d = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = (d.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
    const count = (t: string) => (d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    const result = { integrity, migrations: count('schema_migrations'), patients: count('patients'), users: count('users') };
    if (integrity !== 'ok') throw new BackupError(`The database inside the backup failed its integrity check: ${integrity}`);
    return result;
  } finally {
    d.close();
    // A snapshot of a WAL database can leave sidecar files behind after being opened; they hold nothing we need.
    for (const ext of ['-wal', '-shm']) fs.rmSync(file + ext, { force: true });
  }
}

/** Decrypts a backup to a temp file, checks it, and removes the temp file. Throws if anything is wrong. */
export async function verifyBackup(file: string, passphrase: string): Promise<VerifyResult> {
  const tmp = path.join(path.dirname(file), `.verify-${process.pid}-${Date.now()}.sqlite`);
  try {
    await decryptFile(file, tmp, passphrase);
    return inspectDatabase(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const stampOf = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

export interface BackupFile {
  name: string;
  sizeBytes: number;
  at: string;
}

export function listBackups(dir: string): BackupFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => BACKUP_NAME.test(n))
    .map((name) => {
      const m = BACKUP_NAME.exec(name)![1]!;
      const at = `${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}T${m.slice(9, 11)}:${m.slice(11, 13)}:${m.slice(13, 15)}Z`;
      return { name, sizeBytes: fs.statSync(path.join(dir, name)).size, at };
    })
    .sort((a, b) => (a.name < b.name ? 1 : -1)); // newest first
}

/** Keeps the newest `keep` backups. Only touches files this module created. */
export function pruneBackups(dir: string, keep: number): string[] {
  const removed: string[] = [];
  for (const f of listBackups(dir).slice(Math.max(1, keep))) {
    fs.rmSync(path.join(dir, f.name), { force: true });
    removed.push(f.name);
  }
  return removed;
}

let running = false;

export interface BackupOutcome {
  file: string;
  sizeBytes: number;
  verify: VerifyResult;
  pruned: string[];
}

/** Takes a consistent snapshot, encrypts it, proves it can be opened again, then prunes old ones. */
export async function runBackup(db: DB, cfg: Config, actorId: number | null = null): Promise<BackupOutcome> {
  if (running) throw new BackupError('A backup is already running');
  const passphrase = checkPassphrase(cfg.backupPassphrase);
  running = true;
  const startedAt = nowIso();
  const dir = cfg.backupDir;
  const tmpPlain = path.join(dir, `.snapshot-${process.pid}-${Date.now()}.sqlite`);
  let finalPath = '';
  try {
    fs.mkdirSync(dir, { recursive: true });
    await sqliteBackup(db, tmpPlain);
    const name = `clinic-${stampOf(new Date())}.cbk`;
    finalPath = path.join(dir, name);
    const partial = `${finalPath}.partial`;
    await encryptFile(tmpPlain, partial, passphrase);
    fs.renameSync(partial, finalPath);
    const verify = await verifyBackup(finalPath, passphrase);
    const sizeBytes = fs.statSync(finalPath).size;
    const pruned = pruneBackups(dir, cfg.backupKeep);
    db.prepare('INSERT INTO backup_runs(started_at, finished_at, ok, file, size_bytes, detail) VALUES (?,?,1,?,?,?)').run(startedAt, nowIso(), name, sizeBytes, JSON.stringify({ verify, pruned }));
    audit(db, { actorId, action: 'backup.run', entity: 'backup', entityId: name, detail: { sizeBytes } });
    return { file: name, sizeBytes, verify, pruned };
  } catch (err) {
    if (finalPath) fs.rmSync(finalPath, { force: true });
    if (finalPath) fs.rmSync(`${finalPath}.partial`, { force: true });
    const message = err instanceof Error ? err.message : String(err);
    try {
      db.prepare('INSERT INTO backup_runs(started_at, finished_at, ok, error) VALUES (?,?,0,?)').run(startedAt, nowIso(), message);
      audit(db, { actorId, action: 'backup.failed', entity: 'backup', detail: { message } });
    } catch {
      /* the database itself may be the problem; the thrown error still reaches the caller */
    }
    throw err instanceof BackupError ? err : new BackupError(`Backup failed: ${message}`);
  } finally {
    fs.rmSync(tmpPlain, { force: true });
    running = false;
  }
}

export interface BackupStatus {
  configured: boolean;
  dir: string;
  intervalHours: number;
  keep: number;
  lastSuccess: { at: string; file: string; sizeBytes: number } | null;
  lastFailure: { at: string; error: string } | null;
  healthy: boolean;
  warnings: string[];
  files: BackupFile[];
}

const volumeOf = (p: string) => path.parse(path.resolve(p)).root.toLowerCase();

export function backupStatus(db: DB, cfg: Config): BackupStatus {
  const ok = db.prepare('SELECT finished_at, file, size_bytes FROM backup_runs WHERE ok = 1 ORDER BY id DESC LIMIT 1').get() as
    | { finished_at: string; file: string; size_bytes: number }
    | undefined;
  const bad = db.prepare('SELECT finished_at, error FROM backup_runs WHERE ok = 0 ORDER BY id DESC LIMIT 1').get() as { finished_at: string; error: string } | undefined;
  const configured = !!cfg.backupPassphrase && cfg.backupPassphrase.length >= MIN_PASSPHRASE;
  const ageMs = ok ? Date.now() - Date.parse(ok.finished_at) : Infinity;
  const healthy = configured && ageMs < cfg.backupIntervalHours * 2 * 3_600_000;
  const warnings: string[] = [];
  if (!configured) warnings.push('Automatic backups are off: no backup passphrase is set on the server.');
  else if (!ok) warnings.push('No backup has been taken yet.');
  else if (!healthy) warnings.push('The last successful backup is more than two backup intervals old.');
  if (bad && (!ok || bad.finished_at > ok.finished_at)) warnings.push(`The most recent backup attempt failed: ${bad.error}`);
  if (configured && volumeOf(cfg.backupDir) === volumeOf(cfg.dataDir)) {
    warnings.push('Backups are on the same disk as the data. If this disk fails, both are lost. Copy the backup folder to another disk or a USB drive.');
  }
  return {
    configured,
    dir: cfg.backupDir,
    intervalHours: cfg.backupIntervalHours,
    keep: cfg.backupKeep,
    lastSuccess: ok ? { at: ok.finished_at, file: ok.file, sizeBytes: ok.size_bytes } : null,
    lastFailure: bad && (!ok || bad.finished_at > ok.finished_at) ? { at: bad.finished_at, error: bad.error } : null,
    healthy,
    warnings,
    files: listBackups(cfg.backupDir),
  };
}

/** Takes a backup when the last good one is older than the interval. Returns a function that stops the timer. */
export function startBackupScheduler(db: DB, cfg: Config, log: (m: string) => void = console.log): () => void {
  if (!cfg.backupPassphrase) {
    log('Automatic backups are OFF: set CLINIC_BACKUP_PASSPHRASE (or CLINIC_BACKUP_PASSPHRASE_FILE) to turn them on.');
    return () => {};
  }
  try {
    checkPassphrase(cfg.backupPassphrase);
  } catch (e) {
    log(`Automatic backups are OFF: ${(e as Error).message}`);
    return () => {};
  }
  const tick = async () => {
    const last = db.prepare('SELECT MAX(finished_at) AS t FROM backup_runs').get() as { t: string | null };
    const lastOk = db.prepare('SELECT MAX(finished_at) AS t FROM backup_runs WHERE ok = 1').get() as { t: string | null };
    const dueSince = lastOk.t ? Date.now() - Date.parse(lastOk.t) : Infinity;
    const sinceAttempt = last.t ? Date.now() - Date.parse(last.t) : Infinity;
    if (dueSince < cfg.backupIntervalHours * 3_600_000 || sinceAttempt < 30 * 60_000) return;
    try {
      const r = await runBackup(db, cfg);
      log(`Backup written: ${r.file} (${r.sizeBytes} bytes, verified)`);
    } catch (e) {
      log(`BACKUP FAILED: ${(e as Error).message}`);
    }
  };
  const first = setTimeout(() => void tick(), 20_000);
  const timer = setInterval(() => void tick(), 10 * 60_000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
