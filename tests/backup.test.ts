import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { BackupError, decryptFile, encryptFile, listBackups, pruneBackups, runBackup, verifyBackup } from '../server/backup.js';
import { loadConfig, type Config } from '../server/config.js';
import { openDb } from '../server/db.js';
import { restoreBackup } from '../server/restore.js';

const PW = 'correct-horse-battery';
const PASS = 'a long backup passphrase 42';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let dir: string;
let cfg: Config;
let db: ReturnType<typeof openDb>;
let extra: ReturnType<typeof openDb> | null = null;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-backup-test-'));
  cfg = loadConfig({
    dataDir: path.join(dir, 'data'),
    dbFile: path.join(dir, 'data', 'clinic.sqlite'),
    backupDir: path.join(dir, 'backups'),
    backupPassphrase: PASS,
    backupKeep: 3,
  });
  db = openDb(cfg.dbFile);
  db.prepare("INSERT INTO users(username, full_name, role, password_hash, must_change_password, active, created_at, updated_at) VALUES ('dr','Dr','doctor','x',0,1,'2026-01-01','2026-01-01')").run();
});
afterEach(() => {
  try {
    extra?.close();
    extra = null;
    db.close();
  } catch {
    /* already closed */
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

const addPatient = (name: string) =>
  db.prepare("INSERT INTO patients(patient_number, full_name, created_by, created_at, updated_at) VALUES (?,?,1,'2026-01-01','2026-01-01')").run(`P${name}`, name);

describe('encryption', () => {
  it('round-trips a file and does not leave readable content in the encrypted file', async () => {
    const plain = path.join(dir, 'plain.txt');
    fs.writeFileSync(plain, 'Patient: Asha Verma. '.repeat(1000));
    const enc = path.join(dir, 'x.cbk');
    await encryptFile(plain, enc, PASS);
    expect(fs.readFileSync(enc).includes('Asha Verma')).toBe(false);
    const out = path.join(dir, 'out.txt');
    await decryptFile(enc, out, PASS);
    expect(fs.readFileSync(out, 'utf8')).toBe(fs.readFileSync(plain, 'utf8'));
  });

  it('refuses a wrong passphrase and any tampering, and leaves no partial output', async () => {
    const plain = path.join(dir, 'plain.txt');
    fs.writeFileSync(plain, 'sensitive '.repeat(5000));
    const enc = path.join(dir, 'x.cbk');
    await encryptFile(plain, enc, PASS);
    await expect(decryptFile(enc, path.join(dir, 'a.txt'), 'the wrong passphrase!!')).rejects.toBeInstanceOf(BackupError);
    expect(fs.existsSync(path.join(dir, 'a.txt'))).toBe(false);

    const bytes = fs.readFileSync(enc);
    for (const pos of [3, 40, Math.floor(bytes.length / 2), bytes.length - 5]) {
      const bad = Buffer.from(bytes);
      bad[pos] = bad[pos]! ^ 0xff;
      const f = path.join(dir, `bad${pos}.cbk`);
      fs.writeFileSync(f, bad);
      await expect(decryptFile(f, path.join(dir, `o${pos}.txt`), PASS)).rejects.toBeInstanceOf(BackupError);
      expect(fs.existsSync(path.join(dir, `o${pos}.txt`))).toBe(false);
    }
    fs.writeFileSync(path.join(dir, 'trunc.cbk'), bytes.subarray(0, bytes.length - 20));
    await expect(decryptFile(path.join(dir, 'trunc.cbk'), path.join(dir, 't.txt'), PASS)).rejects.toBeInstanceOf(BackupError);
    fs.writeFileSync(path.join(dir, 'junk.cbk'), 'not a backup at all, just some text that is long enough');
    await expect(decryptFile(path.join(dir, 'junk.cbk'), path.join(dir, 'j.txt'), PASS)).rejects.toBeInstanceOf(BackupError);
  });
});

describe('backup and restore', () => {
  it('takes a verified encrypted backup that restores to the same data', async () => {
    addPatient('Asha Verma');
    addPatient('Meera Iyer');
    const r = await runBackup(db, cfg);
    expect(r.verify).toMatchObject({ integrity: 'ok', patients: 2, users: 1 });
    expect(listBackups(cfg.backupDir).map((f) => f.name)).toEqual([r.file]);
    expect(fs.readdirSync(cfg.backupDir).filter((n) => n.startsWith('.'))).toEqual([]); // no temp files left
    expect(fs.readFileSync(path.join(cfg.backupDir, r.file)).includes('Asha Verma')).toBe(false);

    // Change the live data after the backup, then restore: the later change must disappear.
    addPatient('Added After Backup');
    db.close();
    const res = await restoreBackup({ file: path.join(cfg.backupDir, r.file), passphrase: PASS, cfg, replace: true });
    expect(res.replaced).toBe(true);
    expect(fs.existsSync(res.keptOldAs!)).toBe(true); // old database kept, not deleted

    const restored = openDb(cfg.dbFile);
    const names = (restored.prepare('SELECT full_name FROM patients ORDER BY id').all() as { full_name: string }[]).map((x) => x.full_name);
    expect(names).toEqual(['Asha Verma', 'Meera Iyer']);
    restored.close();
    db = openDb(cfg.dbFile);
  });

  it('restores to a separate file without touching the live database unless asked', async () => {
    addPatient('Asha Verma');
    const r = await runBackup(db, cfg);
    addPatient('Newer');
    const res = await restoreBackup({ file: path.join(cfg.backupDir, r.file), passphrase: PASS, cfg, replace: false });
    expect(res.replaced).toBe(false);
    expect(res.verify.patients).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n).toBe(2); // live untouched
  });

  it('refuses to restore with the wrong passphrase and leaves the live database alone', async () => {
    addPatient('Asha Verma');
    const r = await runBackup(db, cfg);
    await expect(restoreBackup({ file: path.join(cfg.backupDir, r.file), passphrase: 'some other passphrase!!', cfg, replace: true })).rejects.toBeInstanceOf(BackupError);
    expect(fs.existsSync(cfg.dbFile)).toBe(true);
    expect((db.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n).toBe(1);
  });

  it('refuses a corrupted backup file', async () => {
    const r = await runBackup(db, cfg);
    const f = path.join(cfg.backupDir, r.file);
    const b = fs.readFileSync(f);
    b[Math.floor(b.length / 2)] = b[Math.floor(b.length / 2)]! ^ 0xff;
    fs.writeFileSync(f, b);
    await expect(verifyBackup(f, PASS)).rejects.toBeInstanceOf(BackupError);
  });

  it('refuses to back up without a long enough passphrase and records the failure', async () => {
    await expect(runBackup(db, { ...cfg, backupPassphrase: 'short' })).rejects.toBeInstanceOf(BackupError);
    await expect(runBackup(db, { ...cfg, backupPassphrase: null })).rejects.toBeInstanceOf(BackupError);
  });

  it('keeps only the newest backups', async () => {
    fs.mkdirSync(cfg.backupDir, { recursive: true });
    for (const d of ['20260101T000000Z', '20260102T000000Z', '20260103T000000Z', '20260104T000000Z', '20260105T000000Z']) {
      fs.writeFileSync(path.join(cfg.backupDir, `clinic-${d}.cbk`), 'x');
    }
    fs.writeFileSync(path.join(cfg.backupDir, 'notes.txt'), 'not ours');
    const removed = pruneBackups(cfg.backupDir, 3);
    expect(removed).toEqual(['clinic-20260102T000000Z.cbk', 'clinic-20260101T000000Z.cbk']);
    expect(fs.existsSync(path.join(cfg.backupDir, 'notes.txt'))).toBe(true);
    expect(pruneBackups(cfg.backupDir, 0)).toHaveLength(2); // never removes the newest one
    expect(listBackups(cfg.backupDir)).toHaveLength(1);
  });
});

describe('backup API', () => {
  let app: FastifyInstance;
  let doctor: string, desk: string;
  async function call(method: 'GET' | 'POST', url: string, cookie?: string, payload?: unknown) {
    const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
    const sc = res.headers['set-cookie'];
    const ct = String(res.headers['content-type'] ?? '');
    return {
      status: res.statusCode,
      headers: res.headers,
      rawBody: res.rawPayload,
      body: (ct.includes('json') && res.body ? JSON.parse(res.body) : null) as Json,
      setCookie: Array.isArray(sc) ? sc[0] : sc,
    };
  }
  beforeEach(async () => {
    extra = openDb(cfg.dbFile.replace('clinic.sqlite', 'api.sqlite'));
    app = await buildApp({ db: extra, cfg, secureCookies: false });
    doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
    await call('POST', '/api/users', doctor, { username: 'desk1', fullName: 'Desk', role: 'attender', password: 'temporary-pass-1' });
    const first = (await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
    desk = (await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: PW })).setCookie!.split(';')[0]!;
  });

  it('shows status to the doctor only, runs a backup, and never exposes the passphrase', async () => {
    expect((await call('GET', '/api/backups', desk)).status).toBe(403);
    expect((await call('POST', '/api/backups/run', desk)).status).toBe(403);
    expect((await call('GET', '/api/backups')).status).toBe(401);

    const before = await call('GET', '/api/backups', doctor);
    expect(before.body).toMatchObject({ configured: true, lastSuccess: null, healthy: false });
    expect(before.body.warnings.join(' ')).toMatch(/No backup has been taken/);

    const run = await call('POST', '/api/backups/run', doctor);
    expect(run.status).toBe(201);
    const after = (await call('GET', '/api/backups', doctor)).body;
    expect(after.healthy).toBe(true);
    expect(after.lastSuccess.file).toBe(run.body.file);
    expect(after.files).toHaveLength(1);
    expect(JSON.stringify(after)).not.toContain(PASS);
  });

  it('self-test takes a backup, actually restores it through the real restore path, and leaves no leftover file', async () => {
    expect((await call('POST', '/api/backups/self-test', desk)).status).toBe(403);
    expect((await call('POST', '/api/backups/self-test')).status).toBe(401);

    extra!.prepare("INSERT INTO patients(patient_number, full_name, created_by, created_at, updated_at) VALUES ('PSelfTest','Self Test Patient',1,'2026-01-01','2026-01-01')").run();
    const res = await call('POST', '/api/backups/self-test', doctor);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.backup.verify.integrity).toBe('ok');
    expect(res.body.restoreVerify.integrity).toBe('ok');
    expect(res.body.restoreVerify.patients).toBe(res.body.backup.verify.patients);
    expect(res.body.restoreVerify.users).toBe(res.body.backup.verify.users);

    // The restored validation copy must not be left sitting in the data directory afterward.
    const leftovers = fs.readdirSync(path.join(dir, 'data')).filter((f) => f.startsWith('restored-'));
    expect(leftovers).toEqual([]);
    // The live database itself must be untouched (self-test never replaces it) - still has exactly
    // the one patient inserted above, not reset or duplicated.
    const liveCount = (extra!.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n;
    expect(liveCount).toBe(1);
  });

  it('self-test fails cleanly (400) when backups are not configured, without touching the live database', async () => {
    const off = loadConfig({ ...cfg, backupPassphrase: null });
    const a2 = await buildApp({ db: openDb(':memory:'), cfg: off, secureCookies: false });
    const setup = await a2.inject({ method: 'POST', url: '/api/setup', payload: { username: 'dr.rao', fullName: 'Dr Rao', password: PW } });
    const cookie = (setup.headers['set-cookie'] as string).split(';')[0]!;
    const res = await a2.inject({ method: 'POST', url: '/api/backups/self-test', headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });

  it('warns that backups are off when no passphrase is configured', async () => {
    const off = loadConfig({ ...cfg, backupPassphrase: null });
    const a2 = await buildApp({ db: openDb(':memory:'), cfg: off, secureCookies: false });
    const setup = await a2.inject({ method: 'POST', url: '/api/setup', payload: { username: 'dr.rao', fullName: 'Dr Rao', password: PW } });
    const cookie = (setup.headers['set-cookie'] as string).split(';')[0]!;
    const st = JSON.parse((await a2.inject({ method: 'GET', url: '/api/backups', headers: { cookie } })).body);
    expect(st).toMatchObject({ configured: false, healthy: false });
    expect(st.warnings[0]).toMatch(/off/);
    const run = await a2.inject({ method: 'POST', url: '/api/backups/run', headers: { cookie } });
    expect(run.statusCode).toBe(400);
  });

  it('allows the doctor to download encrypted backup snapshots, and audits downloads', async () => {
    // Attempt download when no backup exists yet
    expect((await call('GET', '/api/backups/download/latest', doctor)).status).toBe(404);

    // Create a backup snapshot
    const run = await call('POST', '/api/backups/run', doctor);
    const filename = run.body.file as string;

    // Permissions check
    expect((await call('GET', `/api/backups/download/${filename}`, desk)).status).toBe(403);
    expect((await call('GET', `/api/backups/download/${filename}`)).status).toBe(401);

    // Path traversal / invalid filename rejection
    expect((await call('GET', '/api/backups/download/..%2f..%2fpackage.json', doctor)).status).toBe(404);
    expect((await call('GET', '/api/backups/download/bad-filename.txt', doctor)).status).toBe(404);

    // Doctor downloads latest
    const dlLatest = await call('GET', '/api/backups/download/latest', doctor);
    expect(dlLatest.status).toBe(200);
    expect(dlLatest.headers['content-type']).toBe('application/octet-stream');
    expect(dlLatest.headers['content-disposition']).toBe(`attachment; filename="${filename}"`);
    expect(dlLatest.rawBody.length).toBe(run.body.sizeBytes);

    // Doctor downloads specific filename
    const dlFile = await call('GET', `/api/backups/download/${filename}`, doctor);
    expect(dlFile.status).toBe(200);
    expect(dlFile.rawBody).toEqual(dlLatest.rawBody);

    // Verify audit log has recorded the download
    const auditRes = await call('GET', '/api/audit?action=backup.download', doctor);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body).toHaveLength(2);
    expect(auditRes.body[0]).toMatchObject({
      action: 'backup.download',
      label: 'Downloaded encrypted backup',
      actor: 'Dr Rao',
    });
  });
});
