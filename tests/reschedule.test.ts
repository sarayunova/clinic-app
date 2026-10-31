import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let doctor: string, desk: string, nurse: string;
let patientId: number;

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}
async function staff(username: string, role: string) {
  await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username, password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  return (await call('POST', '/api/auth/login', undefined, { username, password: PW })).setCookie!.split(';')[0]!;
}
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
const book = async (date: string, time: string) =>
  (await call('POST', '/api/appointments', desk, { patientId, date, time, reason: 'Antenatal check' })).body;
const move = (a: Json, body: object, c = desk) => call('PATCH', `/api/appointments/${a.id}/reschedule`, c, { version: a.version, ...body });

beforeEach(async () => {
  app = await buildApp({ db: openDb(':memory:'), cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  desk = await staff('desk1', 'attender');
  nurse = await staff('nurse1', 'nurse');
  patientId = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient.id;
});

describe('rescheduling an appointment', () => {
  it('moves the same appointment to a new date and time and shows it on the new day only', async () => {
    const a = await book(day(1), '10:00');
    const r = await move(a, { date: day(3), time: '15:30' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: a.id, scheduledDate: day(3), scheduledTime: '15:30', status: 'scheduled', version: a.version + 1 });
    expect((await call('GET', `/api/appointments?date=${day(1)}`, desk)).body).toHaveLength(0);
    expect((await call('GET', `/api/appointments?date=${day(3)}`, desk)).body.map((x: Json) => x.id)).toEqual([a.id]);
  });

  it('can change the reason too, and records old and new values in the audit log', async () => {
    const a = await book(day(1), '10:00');
    await move(a, { date: day(2), time: '11:00', reason: 'Scan review' });
    const ev = ((await call('GET', `/api/audit?entity=appointment&entityId=${a.id}`, doctor)).body as Json[]).find((e) => e.action === 'appointment.reschedule')!;
    expect(ev.label).toBe('Rescheduled an appointment');
    expect(ev.detail.scheduledAt.from).toBe(a.scheduledAt);
    expect(ev.detail.scheduledAt.to).not.toBe(a.scheduledAt);
    expect(ev.detail.reason).toEqual({ from: 'Antenatal check', to: 'Scan review' });
  });

  it('refuses past dates, impossible times, a clash with the same patient, and stale versions', async () => {
    const a = await book(day(1), '10:00');
    await book(day(2), '09:00');
    expect((await move(a, { date: day(-1), time: '10:00' })).status).toBe(400);
    expect((await move(a, { date: '2026-02-30', time: '10:00' })).status).toBe(400);
    expect((await move(a, { date: day(2), time: '09:00' })).status).toBe(409);
    expect((await move({ id: a.id, version: 99 }, { date: day(3), time: '10:00' })).status).toBe(409);
    expect((await call('PATCH', '/api/appointments/9999/reschedule', desk, { date: day(3), time: '10:00', version: 1 })).status).toBe(404);
  });

  it('is only allowed while the appointment is still scheduled', async () => {
    const a = await book(day(0) , '23:30');
    const w = (await call('PATCH', `/api/appointments/${a.id}/status`, desk, { status: 'waiting', version: a.version })).body;
    expect((await move(w, { date: day(2), time: '10:00' })).status).toBe(400);
    const c = await book(day(1), '10:00');
    const cancelled = (await call('PATCH', `/api/appointments/${c.id}/status`, desk, { status: 'cancelled', version: c.version })).body;
    expect((await move(cancelled, { date: day(2), time: '10:00' })).status).toBe(400);
  });

  it('needs booking permission: reception and doctor yes, nurse and signed-out no', async () => {
    const a = await book(day(1), '10:00');
    expect((await move(a, { date: day(2), time: '10:00' }, nurse)).status).toBe(403);
    expect((await call('PATCH', `/api/appointments/${a.id}/reschedule`, undefined, { date: day(2), time: '10:00', version: a.version })).status).toBe(401);
    expect((await move(a, { date: day(2), time: '10:00' }, doctor)).status).toBe(200);
  });
});
