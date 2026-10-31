import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string, nurse: string;
let deskId: number;

async function call(method: 'GET' | 'POST', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}
async function staff(username: string, role: string) {
  const u = await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username, password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  const cookie = (await call('POST', '/api/auth/login', undefined, { username, password: PW })).setCookie!.split(';')[0]!;
  return { cookie, id: u.body.id as number };
}
const audit = async (qs = '') => (await call('GET', `/api/audit${qs}`, doctor)).body as Json[];
/** Looking at the log adds an audit.view row; filter those out when counting other things. */
const without = (rows: Json[], action = 'audit.view') => rows.filter((r) => r.action !== action);

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  const d = await staff('desk1', 'attender');
  desk = d.cookie;
  deskId = d.id;
  nurse = (await staff('nurse1', 'nurse')).cookie;
});

describe('audit log viewer API', () => {
  it('is for the doctor only', async () => {
    expect((await call('GET', '/api/audit', desk)).status).toBe(403);
    expect((await call('GET', '/api/audit', nurse)).status).toBe(403);
    expect((await call('GET', '/api/audit/options', desk)).status).toBe(403);
    expect((await call('GET', '/api/audit')).status).toBe(401);
    expect((await call('GET', '/api/audit', doctor)).status).toBe(200);
  });

  it('adds readable labels, clinic-local date and time, and the actor', async () => {
    const rows = await audit();
    const login = rows.find((r) => r.action === 'auth.login')!;
    expect(login).toMatchObject({ label: 'Logged in', entity: 'user' });
    expect(login.atDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(login.atTime).toMatch(/^\d{2}:\d{2}/);
    expect(login.actor).toBeTruthy();
  });

  it('links events to the patient through patient, visit and invoice records', async () => {
    const asha = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma', phone: '9876543210' })).body.patient;
    const meera = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer', estimatedAgeYears: 34 })).body.patient;
    await call('GET', `/api/patients/${asha.id}`, desk);
    const visit = (await call('POST', '/api/visits', nurse, { patientId: asha.id })).body;
    await call('GET', `/api/visits/${visit.id}`, doctor);

    const forAsha = await audit(`?patientId=${asha.id}`);
    const actions = without(forAsha).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['patient.create', 'patient.view', 'visit.create', 'visit.view']));
    expect(forAsha.every((r) => r.patientId === asha.id && r.patientName === 'Asha Verma')).toBe(true);
    expect(forAsha[0].patientNumber).toBe(asha.patientNumber);

    const forMeera = await audit(`?patientId=${meera.id}`);
    expect(without(forMeera).map((r) => r.action)).toEqual(['patient.create']);
  });

  it('filters by person, action (exact and group) and entity', async () => {
    await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' });
    await call('POST', '/api/patients', nurse, { fullName: 'Not Allowed' }); // nurse cannot register: nothing logged

    const byDesk = await audit(`?actorId=${deskId}`);
    expect(byDesk.length).toBeGreaterThan(0);
    expect(byDesk.every((r) => r.actorId === deskId)).toBe(true);

    expect((await audit('?action=patient.create')).map((r) => r.action)).toEqual(['patient.create']);
    const group = await audit('?action=auth.*');
    expect(group.length).toBeGreaterThan(0);
    expect(group.every((r) => r.action.startsWith('auth.'))).toBe(true);
    expect((await call('GET', '/api/audit?action=bad%20action', doctor)).status).toBe(400);
  });

  it('filters by clinic-local dates, inclusive of the end date', async () => {
    const day = (await audit())[0].atDate as string;
    expect((await audit(`?from=${day}&to=${day}`)).length).toBeGreaterThan(0);
    expect(await audit('?from=2000-01-01&to=2000-01-31')).toEqual([]);
    expect(await audit('?from=2999-01-01')).toEqual([]);
    expect((await call('GET', '/api/audit?from=2026-02-01&to=2026-01-01', doctor)).status).toBe(400);
    expect((await call('GET', '/api/audit?from=2026-13-45', doctor)).status).toBe(400);
  });

  it('pages newest-first with a cursor, without gaps or repeats', async () => {
    for (let i = 0; i < 7; i++) await call('POST', '/api/patients', desk, { fullName: `Patient ${i}` });
    const all = await audit('?limit=200&action=patient.*');
    expect(all).toHaveLength(7);
    expect(all.map((r) => r.id)).toEqual([...all.map((r) => r.id)].sort((a, b) => b - a));

    const p1 = await audit('?limit=3&action=patient.*');
    const p2 = await audit(`?limit=3&action=patient.*&before=${p1[2].id}`);
    const p3 = await audit(`?limit=3&action=patient.*&before=${p2[2].id}`);
    expect([...p1, ...p2, ...p3].map((r) => r.id)).toEqual(all.map((r) => r.id));
    expect(p3).toHaveLength(1);
  });

  it('records that the log was viewed once per search, not for "load more"', async () => {
    const count = () => (db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'audit.view'").get() as { n: number }).n;
    expect(count()).toBe(0);
    const first = await audit('?limit=2&actorId=' + deskId);
    expect(count()).toBe(1);
    await audit(`?limit=2&before=${first[first.length - 1]?.id ?? 1}`);
    expect(count()).toBe(1);
    const view = db.prepare("SELECT detail FROM audit_events WHERE action = 'audit.view'").get() as { detail: string };
    expect(JSON.parse(view.detail)).toMatchObject({ actorId: deskId });
  });

  it('lists filter options: known actions with labels, groups and staff', async () => {
    const o = (await call('GET', '/api/audit/options', doctor)).body;
    expect(o.actions).toEqual(expect.arrayContaining([{ value: 'patient.view', label: 'Opened a patient record' }]));
    expect(o.groups).toEqual(expect.arrayContaining(['auth', 'patient']));
    expect(o.actors.map((a: Json) => a.name)).toEqual(expect.arrayContaining(['Dr Rao', 'desk1', 'nurse1']));
  });
});
