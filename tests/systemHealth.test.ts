import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig, type Config } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  backupDiskRelation,
  diskSpace,
  isLowOnSpace,
  LOW_DISK_BYTES,
  restoreTestStatus,
  RESTORE_TEST_DUE_DAYS,
  serverRestarts,
} from '../server/systemHealth.js';
import { APP_VERSION } from '../server/version.js';

const PW = 'correct-horse-battery';
const PASS = 'a long backup passphrase 42';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-syshealth-test-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('disk checks', () => {
  it('measures the nearest existing folder when the path does not exist yet', () => {
    const d = diskSpace(path.join(dir, 'not', 'made', 'yet'));
    expect(d).not.toBeNull();
    expect(d!.path).toBe(dir);
    expect(d!.totalBytes).toBeGreaterThan(0);
    expect(d!.freeBytes).toBeGreaterThan(0);
  });

  it('calls a disk low below 2 GB free or below 5% free', () => {
    const TB = 1024 ** 4;
    expect(isLowOnSpace({ path: 'x', freeBytes: LOW_DISK_BYTES - 1, totalBytes: TB })).toBe(true);
    expect(isLowOnSpace({ path: 'x', freeBytes: 0.04 * TB, totalBytes: TB })).toBe(true);
    expect(isLowOnSpace({ path: 'x', freeBytes: 0.2 * TB, totalBytes: TB })).toBe(false);
  });

  it('tells a second partition of the same physical disk apart from a separate disk', async () => {
    const disks: Record<string, number> = { C: 0, D: 0, E: 1 };
    const resolve = async (l: string) => disks[l.toUpperCase()] ?? null;
    expect(await backupDiskRelation('C:\\ProgramData\\ClinicApp', 'C:\\Backups', resolve)).toBe('same-drive');
    expect(await backupDiskRelation('C:\\ProgramData\\ClinicApp', 'D:\\Backups', resolve)).toBe('same-physical-disk');
    expect(await backupDiskRelation('C:\\ProgramData\\ClinicApp', 'E:\\Backups', resolve)).toBe('separate-disk');
    expect(await backupDiskRelation('C:\\ProgramData\\ClinicApp', 'F:\\Backups', resolve)).toBe('unknown');
    expect(await backupDiskRelation('C:\\ProgramData\\ClinicApp', '\\\\nas\\clinic', resolve)).toBe('network');
  });
});

describe('server restarts from the supervisor log', () => {
  const stamp = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  it('counts only non-zero exits within 7 days, and reports when there is no log', () => {
    expect(serverRestarts(path.join(dir, 'logs'))).toMatchObject({ logFound: false, crashesLast7Days: 0 });
    const now = new Date('2026-11-17T12:00:00');
    const h = (hours: number) => stamp(new Date(now.getTime() - hours * 3_600_000));
    fs.mkdirSync(path.join(dir, 'logs'));
    fs.writeFileSync(
      path.join(dir, 'logs', 'supervisor.log'),
      [
        `${h(24 * 10)} Server stopped with exit code 1 after 4 seconds`, // too old
        `${h(48)} Server stopped with exit code 1 after 4 seconds`,
        `${h(5)} Server stopped with exit code 0 after 3600 seconds`, // clean stop, not a crash
        `${h(3)} Server stopped with exit code -1073741819 after 12 seconds`,
        `${h(2)} Server started (process 1234)`,
        `${h(1)} Server stopped with exit code 1 after 2 seconds`,
        `${h(1)} Restarting in 10 seconds`,
      ].join('\r\n'),
    );
    const r = serverRestarts(path.join(dir, 'logs'), now.getTime());
    expect(r).toMatchObject({ logFound: true, crashesLast7Days: 3, crashesLast24Hours: 2 });
    expect(r.lastCrash!.exitCode).toBe(1);
    expect(Date.parse(r.lastCrash!.at)).toBe(now.getTime() - 3_600_000);
  });
});

describe('restore test record', () => {
  it('is overdue when never run or older than the due period, and a later failure wins', () => {
    const db = openDb(':memory:');
    const now = Date.parse('2026-11-17T00:00:00Z');
    expect(restoreTestStatus(db, now)).toMatchObject({ lastSuccess: null, lastFailure: null, overdue: true, dueDays: RESTORE_TEST_DUE_DAYS });

    const ins = db.prepare('INSERT INTO audit_events(at, actor_id, action, entity, detail) VALUES (?, NULL, ?, ?, ?)');
    ins.run('2026-11-10T00:00:00.000Z', 'backup.self_test', 'backup', JSON.stringify({ patients: 7, users: 2 }));
    expect(restoreTestStatus(db, now)).toMatchObject({ lastSuccess: { patients: 7 }, overdue: false, lastFailure: null });
    expect(restoreTestStatus(db, now + RESTORE_TEST_DUE_DAYS * 86_400_000).overdue).toBe(true);

    ins.run('2026-11-12T00:00:00.000Z', 'backup.self_test_failed', 'backup', JSON.stringify({ message: 'disk full' }));
    expect(restoreTestStatus(db, now).lastFailure).toEqual({ at: '2026-11-12T00:00:00.000Z', error: 'disk full' });
    ins.run('2026-11-13T00:00:00.000Z', 'backup.self_test', 'backup', JSON.stringify({ patients: 7 }));
    expect(restoreTestStatus(db, now).lastFailure).toBeNull();
    db.close();
  });
});

describe('GET /api/system/status', () => {
  let app: FastifyInstance;
  let cfg: Config;
  let doctor: string;
  let db: ReturnType<typeof openDb>;
  async function call(method: 'GET' | 'POST', url: string, cookie?: string, payload?: unknown) {
    const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
    const sc = res.headers['set-cookie'];
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
  }
  async function start(overrides: Partial<Config> = {}) {
    cfg = loadConfig({
      dataDir: path.join(dir, 'data'),
      dbFile: path.join(dir, 'data', 'clinic.sqlite'),
      backupDir: path.join(dir, 'backups'),
      backupPassphrase: PASS,
      ...overrides,
    });
    fs.mkdirSync(cfg.dataDir, { recursive: true });
    db = openDb(cfg.dbFile);
    app = await buildApp({ db, cfg, secureCookies: false });
    doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  }
  afterEach(async () => {
    await app?.close();
    try {
      db?.close();
    } catch {
      /* already closed */
    }
  });

  it('is for backup managers only, and reports measured values with no patient data or passphrase', async () => {
    await start();
    expect((await call('GET', '/api/system/status')).status).toBe(401);
    await call('POST', '/api/users', doctor, { username: 'desk1', fullName: 'Desk', role: 'attender', password: 'temporary-pass-1' });
    const first = (await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
    const desk = (await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: PW })).setCookie!.split(';')[0]!;
    expect((await call('GET', '/api/system/status', desk)).status).toBe(403);

    await call('POST', '/api/patients', doctor, { fullName: 'Status Page Patient', sex: 'female' });
    const r = await call('GET', '/api/system/status', doctor);
    expect(r.status).toBe(200);
    const s = r.body;
    expect(s.version).toBe(APP_VERSION);
    expect(s.database).toEqual({ connected: true, integrity: 'ok' });
    expect(s.disks.data.totalBytes).toBeGreaterThan(0);
    expect(s.backupDisk).toBe('same-drive');
    expect(s.restoreTest).toMatchObject({ lastSuccess: null, overdue: true });
    expect(s.restarts.logFound).toBe(false);
    expect(Date.parse(s.machineBootedAt)).toBeLessThanOrEqual(Date.parse(s.serverStartedAt));
    const warnings = s.warnings.join(' | ');
    expect(warnings).toMatch(/never been proven to restore/);
    expect(warnings).toMatch(/same disk as the data/);
    expect(warnings).toMatch(/No backup has been taken/);
    const text = JSON.stringify(s);
    expect(text).not.toContain('Status Page Patient');
    expect(text).not.toContain(PASS);
  });

  it('clears the restore warning after a passing restore test, and shows a failed one', async () => {
    await start();
    expect((await call('POST', '/api/backups/self-test', doctor)).status).toBe(201);
    const ok = (await call('GET', '/api/system/status', doctor)).body;
    expect(ok.restoreTest.overdue).toBe(false);
    expect(ok.restoreTest.lastSuccess.patients).toBe(0);
    expect(ok.warnings.join(' ')).not.toMatch(/restore/i);

    // Make the next backup fail: the backup folder is replaced by a file.
    fs.rmSync(cfg.backupDir, { recursive: true, force: true });
    fs.writeFileSync(cfg.backupDir, 'not a folder');
    expect((await call('POST', '/api/backups/self-test', doctor)).status).toBe(400);
    const res = await call('GET', '/api/system/status', doctor);
    // The status page must still answer when the backup folder is unusable: that is when it is needed.
    expect(res.status).toBe(200);
    const bad = res.body;
    expect(bad.restoreTest.lastFailure.error).toMatch(/Backup failed/);
    expect(bad.warnings.join(' ')).toMatch(/last restore test failed/);
    expect(bad.warnings.join(' ')).toMatch(/backup folder .* cannot be read/);
  });

  it('warns about repeated crashes logged by the supervisor', async () => {
    await start();
    const p = (n: number) => String(n).padStart(2, '0');
    const line = (minsAgo: number) => {
      const d = new Date(Date.now() - minsAgo * 60_000);
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} Server stopped with exit code 1 after 3 seconds`;
    };
    fs.mkdirSync(path.join(cfg.dataDir, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(cfg.dataDir, 'logs', 'supervisor.log'), [line(30), line(20), line(10)].join('\n'));
    const s = (await call('GET', '/api/system/status', doctor)).body;
    expect(s.restarts.crashesLast24Hours).toBe(3);
    expect(s.warnings.join(' ')).toMatch(/stopped unexpectedly 3 times/);
  });
});
