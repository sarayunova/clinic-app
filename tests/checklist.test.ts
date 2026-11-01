import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string;

async function call(method: 'GET' | 'POST' | 'PUT', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dbFile: ':memory:' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  await call('POST', '/api/users', doctor, { username: 'desk1', fullName: 'Desk', role: 'attender', password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  desk = (await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: PW })).setCookie!.split(';')[0]!;
});

describe('setup checklist', () => {
  it('is for the doctor only', async () => {
    expect((await call('GET', '/api/checklist', desk)).status).toBe(403);
    expect((await call('PUT', '/api/checklist/ups', desk, { done: true })).status).toBe(403);
    expect((await call('GET', '/api/checklist', doctor)).status).toBe(200);
  });

  it('starts all undone, records who and when with a note, and can be unticked', async () => {
    const start = (await call('GET', '/api/checklist', doctor)).body as Json[];
    expect(start.length).toBeGreaterThan(5);
    expect(start.every((i) => !i.done)).toBe(true);
    expect((await call('PUT', '/api/checklist/owner_named', doctor, { done: true, note: 'Sister Latha' })).status).toBe(200);
    const item = ((await call('GET', '/api/checklist', doctor)).body as Json[]).find((i) => i.key === 'owner_named');
    expect(item).toMatchObject({ done: true, doneByName: 'Dr Rao', note: 'Sister Latha' });
    expect(item.doneDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await call('PUT', '/api/checklist/owner_named', doctor, { done: false });
    expect(((await call('GET', '/api/checklist', doctor)).body as Json[]).find((i) => i.key === 'owner_named').done).toBe(false);
    const n = (db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'checklist.update'").get() as { n: number }).n;
    expect(n).toBe(2);
  });

  it('rejects unknown items and bad input', async () => {
    expect((await call('PUT', '/api/checklist/nonsense', doctor, { done: true })).status).toBe(404);
    expect((await call('PUT', '/api/checklist/ups', doctor, { done: 'yes' })).status).toBe(400);
    expect((await call('PUT', '/api/checklist/ups', doctor, { done: true, note: 'x'.repeat(301) })).status).toBe(400);
  });
});
