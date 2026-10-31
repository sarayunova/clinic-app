import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { localDate } from '../server/time.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number, apptId: number;

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}
async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse1', 'nurse'], ['desk1', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse1');
  desk = await login('desk1');

  patientId = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient.id;
  const today = localDate(new Date(), cfg.timezone);
  apptId = (await call('POST', '/api/appointments', desk, { patientId, date: today, time: '10:00', reason: 'Antenatal check' })).body.id;
});

const checkIn = () => call('PATCH', `/api/appointments/${apptId}/status`, desk, { status: 'waiting', version: 1 });
const printed = (c: string, kind: string, id: number) => call('POST', '/api/print-log', c, { kind, id });
const audits = () => (db.prepare("SELECT entity, entity_id FROM audit_events WHERE action = 'document.print'").all() as { entity: string; entity_id: string }[]);

describe('print log', () => {
  it('records prints of a finalised prescription, by clinical staff only', async () => {
    await checkIn();
    const v = (await call('POST', '/api/visits', nurse, { patientId, appointmentId: apptId })).body;
    expect((await printed(doctor, 'prescription', v.id)).status).toBe(400); // still a draft
    const saved = await call('PATCH', `/api/visits/${v.id}`, doctor, { version: v.version, assessment: 'Fine', prescriptionItems: [{ medicine: 'Folic acid' }] });
    await call('POST', `/api/visits/${v.id}/finalise`, doctor, { version: saved.body.version });
    expect((await printed(desk, 'prescription', v.id)).status).toBe(403);
    expect((await printed(doctor, 'prescription', v.id)).status).toBe(201);
    expect((await printed(nurse, 'prescription', v.id)).status).toBe(201);
    expect((await printed(doctor, 'prescription', 9999)).status).toBe(404);
    expect(audits()).toEqual([{ entity: 'visit', entity_id: String(v.id) }, { entity: 'visit', entity_id: String(v.id) }]);
  });

  it('records prints of a discharge summary only after discharge', async () => {
    const bed = (await call('POST', '/api/beds', doctor, { room: 'R1', label: 'A' })).body.id;
    const adm = (await call('POST', '/api/admissions', doctor, { patientId, bedId: bed, reason: 'Observation' })).body.id;
    expect((await printed(doctor, 'discharge_summary', adm)).status).toBe(400);
    await call('POST', `/api/admissions/${adm}/discharge`, doctor, { finalDiagnosis: 'Stable', conditionAtDischarge: 'Well' });
    expect((await printed(desk, 'discharge_summary', adm)).status).toBe(403);
    expect((await printed(nurse, 'discharge_summary', adm)).status).toBe(201);
    expect((await printed(doctor, 'discharge_summary', adm)).status).toBe(201);
    expect((await call('POST', '/api/print-log', doctor, { kind: 'other', id: 1 })).status).toBe(400);
    expect(audits().filter((a) => a.entity === 'admission')).toHaveLength(2);
  });
});
