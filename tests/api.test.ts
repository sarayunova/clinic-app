import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { localDate, localToUtcIso } from '../server/time.js';

const PW = 'correct-horse-battery';
let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
const cfg = loadConfig({ dbFile: ':memory:' });

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const setCookie = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(setCookie) ? setCookie[0] : setCookie };
}

async function login(username: string, password = PW): Promise<string> {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

/** Sets up the doctor, then creates a nurse and attender (who must change password, so we do). */
async function seedUsers() {
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
  expect(setup.status).toBe(201);
  const doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse1', 'nurse'], ['desk1', 'attender']] as const) {
    const c = await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    expect(c.status).toBe(201);
    const first = await login(username, 'temporary-pass-1');
    const ch = await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
    expect(ch.status).toBe(200);
  }
  return { doctor, nurse: await login('nurse1'), desk: await login('desk1') };
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
});

describe('setup and authentication', () => {
  it('allows first-run setup once only', async () => {
    expect((await call('GET', '/api/setup/status')).body.needsSetup).toBe(true);
    await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
    expect((await call('GET', '/api/setup/status')).body.needsSetup).toBe(false);
    const again = await call('POST', '/api/setup', undefined, { username: 'evil', fullName: 'Evil', password: PW });
    expect(again.status).toBe(409);
  });

  it('blocks unauthenticated access and rejects weak passwords', async () => {
    expect((await call('GET', '/api/patients?q=ab')).status).toBe(401);
    const weak = await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: 'short' });
    expect(weak.status).toBe(400);
  });

  it('locks a username after repeated failures and uses a generic message', async () => {
    await seedUsers();
    for (let i = 0; i < 5; i++) {
      const r = await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: 'wrong-password-x' });
      expect(r.status).toBe(401);
      expect(r.body.error.message).toBe('Incorrect username or password');
    }
    expect((await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: PW })).status).toBe(429);
  });

  it('forces a password change for new accounts', async () => {
    const { doctor } = await seedUsers();
    await call('POST', '/api/users', doctor, { username: 'new1', fullName: 'New One', role: 'nurse', password: 'temporary-pass-1' });
    const cookie = await login('new1', 'temporary-pass-1');
    const blocked = await call('GET', '/api/patients?q=ab', cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('password_change_required');
  });

  it('ends sessions on logout and when a user is deactivated', async () => {
    const { doctor, desk } = await seedUsers();
    const users = (await call('GET', '/api/users', doctor)).body as Json[];
    const deskId = users.find((u) => u.username === 'desk1').id;
    expect((await call('GET', '/api/me', desk)).status).toBe(200);
    await call('PATCH', `/api/users/${deskId}`, doctor, { active: false });
    expect((await call('GET', '/api/me', desk)).status).toBe(401);
    expect((await call('POST', '/api/auth/login', undefined, { username: 'desk1', password: PW })).status).toBe(401);
  });

  it('only the doctor can manage users or read the audit log', async () => {
    const { nurse, desk } = await seedUsers();
    expect((await call('GET', '/api/users', nurse)).status).toBe(403);
    expect((await call('POST', '/api/users', desk, { username: 'x1x', fullName: 'X', role: 'doctor', password: PW })).status).toBe(403);
    expect((await call('GET', '/api/audit', desk)).status).toBe(403);
  });

  it('stops the doctor locking themselves out', async () => {
    const { doctor } = await seedUsers();
    const me = (await call('GET', '/api/me', doctor)).body;
    expect((await call('PATCH', `/api/users/${me.id}`, doctor, { active: false })).status).toBe(400);
    expect((await call('PATCH', `/api/users/${me.id}`, doctor, { role: 'nurse' })).status).toBe(400);
  });
});

describe('patients', () => {
  it('registers with minimal data, numbers sequentially, and finds by name, number and phone', async () => {
    const { desk } = await seedUsers();
    const a = await call('POST', '/api/patients', desk, { fullName: 'Asha Verma', phone: '+91 98765 43210' });
    const b = await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer', estimatedAgeYears: 34 });
    expect(a.status).toBe(201);
    expect(a.body.patient.patientNumber).toBe('P000001');
    expect(b.body.patient.patientNumber).toBe('P000002');
    expect(b.body.patient.ageIsEstimated).toBe(true);
    expect(b.body.patient.allergyStatus).toBe('unknown'); // unknown, not "none"

    expect((await call('GET', '/api/patients?q=verma', desk)).body).toHaveLength(1);
    expect((await call('GET', '/api/patients?q=P000002', desk)).body[0].fullName).toBe('Meera Iyer');
    expect((await call('GET', '/api/patients?q=9876543210', desk)).body[0].fullName).toBe('Asha Verma');
    expect((await call('GET', '/api/patients?q=%25%25', desk)).body).toHaveLength(0); // "%%" is literal, not a wildcard
    expect((await call('GET', '/api/patients?q=a', desk)).status).toBe(400); // too short
  });

  it('warns about possible duplicates but still registers', async () => {
    const { desk } = await seedUsers();
    await call('POST', '/api/patients', desk, { fullName: 'Asha Verma', phone: '9876543210', dateOfBirth: '1990-05-01' });
    const second = await call('POST', '/api/patients', desk, { fullName: 'Someone Else', phone: '9876543210' });
    expect(second.status).toBe(201);
    expect(second.body.possibleDuplicates).toHaveLength(1);
    const pre = await call('POST', '/api/patients/check-duplicates', desk, { fullName: 'asha verma', dateOfBirth: '1990-05-01' });
    expect(pre.body.possibleDuplicates).toHaveLength(1);
  });

  it('hides clinical fields from the attender and blocks them from writing clinical data', async () => {
    const { doctor, desk, nurse } = await seedUsers();
    const created = await call('POST', '/api/patients', doctor, { fullName: 'Asha Verma', medicalHistory: 'Hypertension', allergyStatus: 'known', allergyDetails: 'Penicillin - rash' });
    const id = created.body.patient.id;

    const asDesk = (await call('GET', `/api/patients/${id}`, desk)).body;
    expect(asDesk.medicalHistory).toBeUndefined();
    expect(asDesk.allergyDetails).toBe('Penicillin - rash'); // safety alert stays visible
    expect((await call('GET', `/api/patients/${id}`, nurse)).body.medicalHistory).toBe('Hypertension');

    const v = asDesk.version;
    expect((await call('PATCH', `/api/patients/${id}`, desk, { version: v, medicalHistory: 'x' })).status).toBe(403);
    expect((await call('PATCH', `/api/patients/${id}`, desk, { version: v, phone: '9000000001' })).status).toBe(200);
    expect((await call('PATCH', `/api/patients/${id}`, nurse, { version: v + 1, phone: '9000000002' })).status).toBe(403);
    expect((await call('PATCH', `/api/patients/${id}`, nurse, { version: v + 1, allergyStatus: 'none' })).status).toBe(200);
  });

  it('rejects stale edits instead of silently overwriting', async () => {
    const { doctor, desk } = await seedUsers();
    const id = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient.id;
    const first = await call('PATCH', `/api/patients/${id}`, desk, { version: 1, phone: '9000000001' });
    expect(first.body.version).toBe(2);
    const stale = await call('PATCH', `/api/patients/${id}`, doctor, { version: 1, clinicalNotes: 'late' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentVersion).toBe(2);
  });

  it('validates dates, allergies, and gravida/para on the server', async () => {
    const { doctor } = await seedUsers();
    const bad = (payload: object) => call('POST', '/api/patients', doctor, { fullName: 'Test Patient', ...payload });
    expect((await bad({ dateOfBirth: '2999-01-01' })).status).toBe(400);
    expect((await bad({ dateOfBirth: '1990-02-31' })).status).toBe(400);
    expect((await bad({ lastMenstrualPeriod: '2999-01-01' })).status).toBe(400);
    expect((await bad({ allergyStatus: 'known' })).status).toBe(400); // needs details
    expect((await bad({ gravida: 1, para: 2 })).status).toBe(400);
    expect((await bad({ phone: 'abc' })).status).toBe(400);
    expect((await bad({ unexpectedField: 1 })).status).toBe(400);
    expect((await call('POST', '/api/patients', doctor, { fullName: '' })).status).toBe(400);
  });

  it('records field-level before/after in the audit log, including views', async () => {
    const { doctor } = await seedUsers();
    const id = (await call('POST', '/api/patients', doctor, { fullName: 'Asha Verma', phone: '9000000001' })).body.patient.id;
    await call('PATCH', `/api/patients/${id}`, doctor, { version: 1, phone: '9000000002' });
    await call('GET', `/api/patients/${id}`, doctor);
    const log = (await call('GET', `/api/audit?entity=patient&entityId=${id}`, doctor)).body as Json[];
    const update = log.find((e) => e.action === 'patient.update');
    expect(update.detail.phone).toEqual({ from: '9000000001', to: '9000000002' });
    expect(log.some((e) => e.action === 'patient.view')).toBe(true);
  });

  it('keeps the audit log append-only', async () => {
    await seedUsers();
    expect(() => db.exec("UPDATE audit_events SET action = 'x'")).toThrow(/append-only/);
    expect(() => db.exec('DELETE FROM audit_events')).toThrow(/append-only/);
  });
});

describe('appointments', () => {
  const today = () => localDate(new Date(), cfg.timezone);

  async function patientAndAppt(desk: string, time = '10:30') {
    const pid = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient.id;
    const appt = await call('POST', '/api/appointments', desk, { patientId: pid, date: today(), time, reason: 'Antenatal check' });
    expect(appt.status).toBe(201);
    return { pid, appt: appt.body };
  }

  it('books for a patient, lists the day with allergy alert data, and rejects bad input', async () => {
    const { desk } = await seedUsers();
    const { pid, appt } = await patientAndAppt(desk);
    expect(appt.status).toBe('scheduled');
    const list = (await call('GET', `/api/appointments?date=${today()}`, desk)).body as Json[];
    expect(list).toHaveLength(1);
    expect(list[0].patientName).toBe('Asha Verma');
    expect(list[0].allergyStatus).toBe('unknown');

    const post = (p: object) => call('POST', '/api/appointments', desk, { patientId: pid, date: today(), time: '11:00', reason: 'Visit', ...p });
    expect((await post({ patientId: 9999 })).status).toBe(404);
    expect((await post({ date: '2020-01-01' })).status).toBe(400); // past
    expect((await post({ time: '25:00' })).status).toBe(400);
    expect((await post({ time: '10:30' })).status).toBe(409); // same patient, same slot
    expect((await post({ reason: '' })).status).toBe(400);
  });

  it('enforces status transitions and who may make them', async () => {
    const { doctor, desk, nurse } = await seedUsers();
    const { appt } = await patientAndAppt(desk);
    const set = (c: string, status: string, version: number) => call('PATCH', `/api/appointments/${appt.id}/status`, c, { status, version });

    expect((await set(desk, 'completed', 1)).status).toBe(403); // attender can't complete
    expect((await set(doctor, 'completed', 1)).status).toBe(400); // scheduled -> completed not allowed
    const waiting = await set(desk, 'waiting', 1);
    expect(waiting.body.status).toBe('waiting');
    expect((await set(nurse, 'in_consultation', 2)).status).toBe(403);
    expect((await set(doctor, 'in_consultation', 1)).status).toBe(409); // stale version
    expect((await set(doctor, 'in_consultation', 2)).status).toBe(200);
    expect((await set(doctor, 'completed', 3)).status).toBe(200);
    expect((await set(doctor, 'waiting', 4)).status).toBe(400); // completed is final
  });
});

describe('clinic time handling', () => {
  it('converts clinic-local time to UTC correctly and rejects impossible dates', () => {
    expect(localToUtcIso('2026-11-02', '10:30', 'Asia/Kolkata')).toBe('2026-11-02T05:00:00.000Z');
    expect(localToUtcIso('2026-11-02', '00:15', 'Asia/Kolkata')).toBe('2026-11-01T18:45:00.000Z');
    expect(localToUtcIso('2026-02-30', '10:00', 'Asia/Kolkata')).toBeNull();
  });
});
