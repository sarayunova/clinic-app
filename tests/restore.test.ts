import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { BackupError, encryptFile, runBackup } from '../server/backup.js';
import { loadConfig, type Config } from '../server/config.js';
import { openDb } from '../server/db.js';
import { checkBackup, newestActivity, restoreBackup } from '../server/restore.js';
import { restorePointPath } from '../server/routes/backups.js';

const PASS = 'a long backup passphrase 42';
const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let dir: string;
let cfg: Config;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-restore-test-'));
  cfg = loadConfig({
    dataDir: path.join(dir, 'data'),
    dbFile: path.join(dir, 'data', 'clinic.sqlite'),
    backupDir: path.join(dir, 'backups'),
    backupPassphrase: PASS,
  });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const addPatient = (db: DatabaseSync, n: string) => {
  // A patient needs the staff account that registered it; the API tests already have user 1.
  db.prepare("INSERT OR IGNORE INTO users(id, username, full_name, role, password_hash, must_change_password, active, created_at, updated_at) VALUES (1,'seed','Seed','doctor','x',0,1,'2026-01-01','2026-01-01')").run();
  db.prepare("INSERT INTO patients(patient_number, full_name, created_by, created_at, updated_at) VALUES (?, ?, 1, '2026-01-01', '2026-01-01')").run(n, `Patient ${n}`);
};
const patients = (file: string) => {
  const d = new DatabaseSync(file, { readOnly: true });
  try {
    return (d.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n;
  } finally {
    d.close();
  }
};

/** An encrypted backup of a database prepared by `change`, written into the backup folder. */
async function makeBackup(name: string, change: (d: DatabaseSync) => void): Promise<string> {
  const plain = path.join(dir, `plain-${name}.sqlite`);
  const d = openDb(plain);
  change(d);
  d.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  d.close();
  fs.mkdirSync(cfg.backupDir, { recursive: true });
  const out = path.join(cfg.backupDir, name);
  await encryptFile(plain, out, PASS);
  return out;
}

describe('checking a backup', () => {
  it('describes the backup next to the live records, leaves no file behind and never touches the live database', async () => {
    const live = openDb(cfg.dbFile);
    addPatient(live, 'P1');
    const r = await runBackup(live, cfg);
    addPatient(live, 'P2'); // entered after the backup
    const before = fs.readdirSync(cfg.dataDir).sort();

    const c = await checkBackup({ file: path.join(cfg.backupDir, r.file), passphrase: PASS, cfg, liveDb: live });
    expect(c).toMatchObject({ name: r.file, canRestoreHere: true, newerMigrations: [], verify: { patients: 1, integrity: 'ok' }, live: { patients: 2 } });
    expect(Date.parse(c.takenAt)).toBeGreaterThan(0);
    expect(fs.readdirSync(cfg.dataDir).sort()).toEqual(before);
    expect((live.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n).toBe(2);
    live.close();
  });

  it('refuses a wrong passphrase, a damaged file and a file that is not a backup', async () => {
    const file = await makeBackup('clinic-20261101T000000Z.cbk', (d) => addPatient(d, 'P1'));
    await expect(checkBackup({ file, passphrase: 'a different long passphrase', cfg })).rejects.toThrow(/wrong passphrase, or the file is damaged/);

    const damaged = path.join(cfg.backupDir, 'clinic-20261102T000000Z.cbk');
    const bytes = fs.readFileSync(file);
    bytes[Math.floor(bytes.length / 2)]! ^= 0xff;
    fs.writeFileSync(damaged, bytes);
    await expect(checkBackup({ file: damaged, passphrase: PASS, cfg })).rejects.toBeInstanceOf(BackupError);

    const notBackup = path.join(cfg.backupDir, 'clinic-20261103T000000Z.cbk');
    fs.writeFileSync(notBackup, 'x'.repeat(200));
    await expect(checkBackup({ file: notBackup, passphrase: PASS, cfg })).rejects.toThrow(/not a clinic backup/);
    // No decrypted leftovers from the failed attempts.
    expect(fs.readdirSync(cfg.dataDir).filter((f) => f.startsWith('.check-'))).toEqual([]);
  });
});

describe('last change recorded', () => {
  it('ignores backups, backup checks and logins, so an unchanged clinic does not look newer than its backup', () => {
    const d = openDb(':memory:');
    const ins = d.prepare('INSERT INTO audit_events(at, actor_id, action, entity) VALUES (?, NULL, ?, ?)');
    ins.run('2026-11-01T10:00:00.000Z', 'patient.create', 'patient');
    ins.run('2026-11-02T10:00:00.000Z', 'backup.run', 'backup');
    ins.run('2026-11-03T10:00:00.000Z', 'backup.checked', 'backup');
    ins.run('2026-11-04T10:00:00.000Z', 'auth.login', 'user');
    expect(newestActivity(d)).toBe('2026-11-01T10:00:00.000Z');
    ins.run('2026-11-05T10:00:00.000Z', 'visit.create', 'visit');
    expect(newestActivity(d)).toBe('2026-11-05T10:00:00.000Z');
    d.close();
  });
});

describe('restoring a backup', () => {
  it('refuses a backup from a newer version, and the live database is unchanged', async () => {
    const live = openDb(cfg.dbFile);
    addPatient(live, 'LIVE');
    live.close();
    const file = await makeBackup('clinic-20261104T000000Z.cbk', (d) => {
      d.prepare("INSERT INTO schema_migrations(name, applied_at) VALUES ('999_from_the_future.sql', '2027-01-01')").run();
    });
    const c = await checkBackup({ file, passphrase: PASS, cfg });
    expect(c.canRestoreHere).toBe(false);
    expect(c.newerMigrations).toEqual(['999_from_the_future.sql']);
    await expect(restoreBackup({ file, passphrase: PASS, cfg, replace: true })).rejects.toThrow(/newer version/);
    expect(patients(cfg.dbFile)).toBe(1);
    expect(fs.readdirSync(cfg.dataDir).filter((f) => f.startsWith('restored-') || f.includes('before-restore'))).toEqual([]);
  });

  it('puts the previous database back when the restored one fails to open', async () => {
    const live = openDb(cfg.dbFile);
    addPatient(live, 'LIVE');
    live.close();
    // Forgets that the first migration was applied, so opening it tries to create existing tables and fails.
    const file = await makeBackup('clinic-20261105T000000Z.cbk', (d) => {
      addPatient(d, 'OLD');
      d.prepare("DELETE FROM schema_migrations WHERE name = (SELECT MIN(name) FROM schema_migrations)").run();
    });
    await expect(restoreBackup({ file, passphrase: PASS, cfg, replace: true })).rejects.toThrow(/previous database was put back/);
    expect(patients(cfg.dbFile)).toBe(1);
    const d = new DatabaseSync(cfg.dbFile, { readOnly: true });
    expect((d.prepare('SELECT patient_number FROM patients').get() as { patient_number: string }).patient_number).toBe('LIVE');
    d.close();
    expect(fs.readdirSync(cfg.dataDir).some((f) => f.includes('failed-restore'))).toBe(true);
  });

  it('replaces the live database and keeps the old one beside it', async () => {
    const live = openDb(cfg.dbFile);
    addPatient(live, 'LIVE1');
    addPatient(live, 'LIVE2');
    live.close();
    const file = await makeBackup('clinic-20261106T000000Z.cbk', (d) => addPatient(d, 'OLD'));
    const r = await restoreBackup({ file, passphrase: PASS, cfg, replace: true });
    expect(r.replaced).toBe(true);
    expect(patients(cfg.dbFile)).toBe(1);
    expect(patients(r.keptOldAs!)).toBe(2);
  });
});

describe('restore API', () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof openDb>;
  let doctor: string;
  async function call(method: 'GET' | 'POST', url: string, cookie?: string, payload?: unknown) {
    const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
    const sc = res.headers['set-cookie'];
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
  }
  beforeEach(async () => {
    db = openDb(cfg.dbFile);
    app = await buildApp({ db, cfg, secureCookies: false });
    doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  });
  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('accepts only listed names from the two allowed folders, never a path', () => {
    expect(restorePointPath(cfg, 'backup', 'clinic-20261101T000000Z.cbk')).toBe(path.join(cfg.backupDir, 'clinic-20261101T000000Z.cbk'));
    expect(restorePointPath(cfg, 'pre-upgrade', 'clinic-pre-upgrade-20261101T000000Z.cbk')).toBe(path.join(cfg.dataDir, 'pre-upgrade', 'clinic-pre-upgrade-20261101T000000Z.cbk'));
    for (const [s, n] of [
      ['backup', '../clinic.sqlite'],
      ['backup', 'clinic-pre-upgrade-20261101T000000Z.cbk'],
      ['pre-upgrade', 'clinic-20261101T000000Z.cbk'],
      ['other', 'clinic-20261101T000000Z.cbk'],
      ['backup', 'C:\\Windows\\clinic-20261101T000000Z.cbk'],
      ['backup', 42],
    ] as const)
      expect(restorePointPath(cfg, s, n), `${s} ${n}`).toBeNull();
  });

  it('lists backups and pre-upgrade copies, checks one for the doctor only, and gives the restore command', async () => {
    addPatient(db, 'P1');
    const b = await call('POST', '/api/backups/run', doctor);
    fs.mkdirSync(path.join(cfg.dataDir, 'pre-upgrade'));
    fs.copyFileSync(path.join(cfg.backupDir, b.body.file), path.join(cfg.dataDir, 'pre-upgrade', 'clinic-pre-upgrade-20200101T000000Z.cbk'));

    expect((await call('GET', '/api/backups/restore-points')).status).toBe(401);
    const list = (await call('GET', '/api/backups/restore-points', doctor)).body.points;
    expect(list.map((p: Json) => p.source)).toEqual(['backup', 'pre-upgrade']); // newest first

    expect((await call('POST', '/api/backups/check', doctor, { source: 'backup', name: '../clinic.sqlite' })).status).toBe(404);
    expect((await call('POST', '/api/backups/check', doctor, { source: 'backup', name: 'clinic-19990101T000000Z.cbk' })).status).toBe(404);

    addPatient(db, 'P2');
    const r = await call('POST', '/api/backups/check', doctor, { source: 'pre-upgrade', name: 'clinic-pre-upgrade-20200101T000000Z.cbk' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ canRestoreHere: true, verify: { patients: 1 }, live: { patients: 2 } });
    expect(r.body.restoreCommand).toContain('clinic-pre-upgrade-20200101T000000Z.cbk');
    expect(JSON.stringify(r.body)).not.toContain(PASS);
    expect(JSON.stringify(r.body)).not.toContain('Patient P1');
    const audited = db.prepare("SELECT entity_id, detail FROM audit_events WHERE action = 'backup.checked'").all() as { entity_id: string; detail: string }[];
    expect(audited.at(-1)!.entity_id).toBe('clinic-pre-upgrade-20200101T000000Z.cbk');
  });

  it('reports a damaged backup as a refused check (400), and records it', async () => {
    await call('POST', '/api/backups/run', doctor);
    const [p] = (await call('GET', '/api/backups/restore-points', doctor)).body.points;
    const f = path.join(cfg.backupDir, p.name);
    const bytes = fs.readFileSync(f);
    bytes[bytes.length - 5]! ^= 0x01;
    fs.writeFileSync(f, bytes);
    const r = await call('POST', '/api/backups/check', doctor, { source: 'backup', name: p.name });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/wrong passphrase, or the file is damaged/);
    const last = db.prepare("SELECT detail FROM audit_events WHERE action = 'backup.checked' ORDER BY id DESC LIMIT 1").get() as { detail: string };
    expect(JSON.parse(last.detail).ok).toBe(false);
  });
});
