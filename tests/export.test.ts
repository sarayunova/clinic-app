import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let doctor: string, desk: string, nurse: string;
let asha: Json, meera: Json;

async function call(method: 'GET' | 'POST' | 'PUT', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, headers: res.headers, raw: res.body, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}
async function staff(username: string, role: string) {
  await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username, password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  return (await call('POST', '/api/auth/login', undefined, { username, password: PW })).setCookie!.split(';')[0]!;
}

beforeEach(async () => {
  app = await buildApp({ db: openDb(':memory:'), cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  desk = await staff('desk1', 'attender');
  nurse = await staff('nurse1', 'nurse');
  asha = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma', phone: '9876543210' })).body.patient;
  meera = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer', estimatedAgeYears: 34 })).body.patient;
});

describe('patient record export', () => {
  it('is for the doctor only', async () => {
    const url = `/api/patients/${asha.id}/export`;
    expect((await call('GET', url, desk)).status).toBe(403);
    expect((await call('GET', url, nurse)).status).toBe(403);
    expect((await call('GET', url)).status).toBe(401);
    expect((await call('GET', url, doctor)).status).toBe(200);
    expect((await call('GET', '/api/patients/9999/export', doctor)).status).toBe(404);
    expect((await call('GET', '/api/patients/abc/export', doctor)).status).toBe(404);
  });

  it('downloads as a named, uncached file', async () => {
    const r = await call('GET', `/api/patients/${asha.id}/export`, doctor);
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="patient-P\d+-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ format: 'clinic-app-patient-export', formatVersion: 1, exportedBy: { name: 'Dr Rao' } });
  });

  it('contains the whole record for that patient and nobody else', async () => {
    const day = new Date(Date.now() + 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
    await call('POST', '/api/appointments', desk, { patientId: asha.id, date: day, time: '10:00', reason: 'Antenatal check' });
    const visit = (await call('POST', '/api/visits', nurse, { patientId: asha.id })).body;
    const bed = (await call('POST', '/api/beds', doctor, { room: 'Room 1', label: 'A' })).body.id;
    const adm = (await call('POST', '/api/admissions', doctor, { patientId: asha.id, bedId: bed, reason: 'Observation' })).body;
    await call('POST', `/api/admissions/${adm.id}/entries`, nurse, { type: 'nursing_note', content: 'Comfortable overnight' });
    await call('POST', '/api/invoices', desk, { patientId: asha.id, visitId: visit.id });
    await call('POST', '/api/appointments', desk, { patientId: meera.id, date: day, time: '11:00', reason: 'Other patient secret' });

    const doc = (await call('GET', `/api/patients/${asha.id}/export`, doctor)).body;
    expect(doc.patient).toMatchObject({ id: asha.id, fullName: 'Asha Verma', phone: '9876543210' });
    expect(doc.counts).toEqual({ appointments: 1, visits: 1, admissions: 1, invoices: 1, attachments: 0 });
    expect(doc.visits[0]).toMatchObject({ id: visit.id });
    expect(doc.visits[0]).toHaveProperty('vitals');
    expect(doc.admissions[0]).toMatchObject({ id: adm.id, bedRoom: 'Room 1', bedLabel: 'A' });
    expect(doc.admissions[0].careEntries).toHaveLength(1);
    expect(doc.invoices[0]).toMatchObject({ visitId: visit.id });
    expect(JSON.stringify(doc)).not.toMatch(/Meera|Other patient secret/);
  });

  it('names the staff involved but never exports passwords, sessions or unrelated users', async () => {
    await call('POST', '/api/visits', nurse, { patientId: asha.id });
    const raw = (await call('GET', `/api/patients/${asha.id}/export`, doctor)).raw;
    const doc = JSON.parse(raw);
    expect(doc.staff.map((s: Json) => s.fullName)).toEqual(expect.arrayContaining(['nurse1', 'desk1']));
    expect(doc.staff.every((s: Json) => Object.keys(s).sort().join() === 'fullName,id,role')).toBe(true);
    expect(raw).not.toMatch(/password|token|scrypt/i);
    const empty = (await call('GET', `/api/patients/${meera.id}/export`, doctor)).body;
    expect(empty.staff.map((s: Json) => s.fullName)).toEqual(['desk1']); // only whoever registered her
  });

  it('records every export in the audit log, linked to the patient', async () => {
    await call('GET', `/api/patients/${asha.id}/export`, doctor);
    await call('GET', `/api/patients/${asha.id}/export`, doctor);
    await call('GET', `/api/patients/${asha.id}/export`, desk); // refused: must not be logged as an export
    const log = (await call('GET', `/api/audit?action=patient.export&patientId=${asha.id}`, doctor)).body as Json[];
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ label: 'Downloaded a full copy of a patient record', actor: 'Dr Rao', patientName: 'Asha Verma' });
    expect(log[0].detail).toEqual({ appointments: 0, visits: 0, admissions: 0, invoices: 0, attachments: 0 });
  });
});
