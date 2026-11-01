import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { LoginThrottle } from '../server/auth.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let dir: string;
let dbFile: string;
let db: ReturnType<typeof openDb>;
let app: FastifyInstance;

async function call(a: FastifyInstance, method: 'GET' | 'POST', url: string, cookie?: string, payload?: unknown) {
  const res = await a.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}
const login = (a: FastifyInstance, username: string, password: string) => call(a, 'POST', '/api/auth/login', undefined, { username, password });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-lock-test-'));
  dbFile = path.join(dir, 'clinic.sqlite');
});
afterEach(() => {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

async function boot() {
  db = openDb(dbFile);
  app = await buildApp({ db, cfg: loadConfig({ dataDir: dir, dbFile }), secureCookies: false });
}

describe('login lockout survives a restart', () => {
  it('stays locked after the server is restarted, then clears when the time is up', async () => {
    await boot();
    await call(app, 'POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
    for (let i = 0; i < 5; i++) expect((await login(app, 'dr.rao', 'wrong-password-1')).status).toBe(401);
    expect((await login(app, 'dr.rao', PW)).status).toBe(429); // right password, but locked

    // Restart: close everything and open the same database file again with a brand-new app.
    await app.close();
    db.close();
    await boot();
    const after = await login(app, 'dr.rao', PW);
    expect(after.status).toBe(429);
    expect(after.body.error.message).toMatch(/Too many failed attempts/);

    // When the lock time has passed, login works again and the record is cleared.
    db.prepare('UPDATE login_attempts SET locked_until = ?').run(Date.now() - 1000);
    expect((await login(app, 'dr.rao', PW)).status).toBe(200);
    expect((db.prepare('SELECT COUNT(*) AS n FROM login_attempts').get() as { n: number }).n).toBe(0);
  });

  it('keeps counting failures across restarts, and matches the name case-insensitively', async () => {
    await boot();
    await call(app, 'POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
    for (let i = 0; i < 3; i++) await login(app, 'dr.rao', 'wrong-password-1');
    await app.close();
    db.close();
    await boot();
    await login(app, 'DR.RAO', 'wrong-password-1');
    await login(app, 'dr.rao', 'wrong-password-1');
    expect((await login(app, 'dr.rao', PW)).status).toBe(429); // 3 + 2 = 5 failures
  });

  it('forgets stale mistyped names but never an active lock', async () => {
    await boot();
    const t = new LoginThrottle(5, 5, db);
    t.fail('typo-user');
    db.prepare('UPDATE login_attempts SET updated_at = ?').run(new Date(Date.now() - 3 * 86_400_000).toISOString());
    for (let i = 0; i < 5; i++) t.fail('locked-user');
    t.fail('another-typo'); // any write triggers the cleanup
    const names = (db.prepare('SELECT username FROM login_attempts ORDER BY username').all() as { username: string }[]).map((r) => r.username);
    expect(names).toEqual(['another-typo', 'locked-user']);
    expect(t.lockedFor('locked-user')).toBeGreaterThan(0);
  });
});

describe('screen lock', () => {
  let doctor: string;
  let other: string; // a second session of the same user, e.g. another tablet

  beforeEach(async () => {
    await boot();
    doctor = (await call(app, 'POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
    other = (await login(app, 'dr.rao', PW)).setCookie!.split(';')[0]!;
  });

  it('refuses everything except unlock, log out and "who am I" while locked, even after a page reload', async () => {
    expect((await call(app, 'POST', '/api/auth/lock', doctor, { reason: 'idle' })).status).toBe(200);
    for (const [m, u] of [['GET', '/api/patients?q=ab'], ['GET', '/api/appointments'], ['GET', '/api/audit'], ['GET', '/api/station'], ['GET', '/api/backups']] as const) {
      const r = await call(app, m, u, doctor);
      expect(r.status, u).toBe(423);
      expect(r.body.error.code).toBe('screen_locked');
    }
    expect((await call(app, 'POST', '/api/patients', doctor, { fullName: 'Nobody' })).status).toBe(423);
    expect((await call(app, 'POST', '/api/auth/change-password', doctor, { currentPassword: PW, newPassword: 'another-long-pass-1' })).status).toBe(423);

    const me = await call(app, 'GET', '/api/me', doctor); // what a reloaded page asks first
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: 'dr.rao', locked: true, screenLockMinutes: 5 });
  });

  it('does not affect the same user\'s other sessions', async () => {
    await call(app, 'POST', '/api/auth/lock', doctor);
    expect((await call(app, 'GET', '/api/appointments', other)).status).toBe(200);
    expect((await call(app, 'GET', '/api/me', other)).body.locked).toBe(false);
  });

  it('unlocks only with the right password, and then everything works again', async () => {
    await call(app, 'POST', '/api/auth/lock', doctor);
    const bad = await call(app, 'POST', '/api/auth/unlock', doctor, { password: 'not-my-password' });
    expect(bad.status).toBe(401);
    expect((await call(app, 'GET', '/api/appointments', doctor)).status).toBe(423);
    expect((await call(app, 'POST', '/api/auth/unlock', doctor, { password: PW })).status).toBe(200);
    expect((await call(app, 'GET', '/api/appointments', doctor)).status).toBe(200);
    expect((await call(app, 'GET', '/api/me', doctor)).body.locked).toBe(false);
  });

  it('limits guessing the password on a locked screen', async () => {
    await call(app, 'POST', '/api/auth/lock', doctor);
    for (let i = 0; i < 5; i++) expect((await call(app, 'POST', '/api/auth/unlock', doctor, { password: `guess-number-${i}` })).status).toBe(401);
    const blocked = await call(app, 'POST', '/api/auth/unlock', doctor, { password: PW });
    expect(blocked.status).toBe(429);
    expect((await call(app, 'GET', '/api/appointments', doctor)).status).toBe(423);
  });

  it('lets the user log out of a locked screen, and a locked session still ends on its own', async () => {
    await call(app, 'POST', '/api/auth/lock', doctor);
    expect((await call(app, 'POST', '/api/auth/logout', doctor)).status).toBe(200);
    expect((await call(app, 'GET', '/api/me', doctor)).status).toBe(401);

    // Locked and untouched for longer than the idle limit: the session is gone, not kept alive by background polling.
    await call(app, 'POST', '/api/auth/lock', other);
    db.prepare('UPDATE sessions SET last_seen_at = ?').run(new Date(Date.now() - 40 * 60_000).toISOString());
    expect((await call(app, 'GET', '/api/me', other)).status).toBe(401);
  });

  it('does not refresh a locked session\'s activity time', async () => {
    await call(app, 'POST', '/api/auth/lock', doctor);
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE locked_at IS NOT NULL').run(old);
    await call(app, 'GET', '/api/appointments', doctor); // refused with 423
    const row = db.prepare('SELECT last_seen_at FROM sessions WHERE locked_at IS NOT NULL').get() as { last_seen_at: string };
    expect(row.last_seen_at).toBe(old);
  });

  it('records locking and unlocking (and failures) in the audit log', async () => {
    await call(app, 'POST', '/api/auth/lock', doctor, { reason: 'idle' });
    await call(app, 'POST', '/api/auth/unlock', doctor, { password: 'not-my-password' });
    await call(app, 'POST', '/api/auth/unlock', doctor, { password: PW });
    await call(app, 'POST', '/api/auth/lock', doctor); // already unlocked: locks again
    await call(app, 'POST', '/api/auth/lock', doctor); // already locked: no second entry
    const actions = (db.prepare("SELECT action FROM audit_events WHERE action LIKE 'auth.%lock%' ORDER BY id").all() as { action: string }[]).map((r) => r.action);
    expect(actions).toEqual(['auth.lock', 'auth.unlock_failed', 'auth.unlock', 'auth.lock']);
  });

  it('rejects a bad lock reason and a missing password', async () => {
    expect((await call(app, 'POST', '/api/auth/lock', doctor, { reason: 'whatever' })).status).toBe(400);
    await call(app, 'POST', '/api/auth/lock', doctor);
    expect((await call(app, 'POST', '/api/auth/unlock', doctor, {})).status).toBe(400);
  });
});
