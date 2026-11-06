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

const checkIn = (c = desk) => call('PATCH', `/api/appointments/${apptId}/status`, c, { status: 'waiting', version: 1 });
const startConsult = () => call('PATCH', `/api/appointments/${apptId}/status`, doctor, { status: 'in_consultation', version: 2 });
const openVisit = (c = nurse) => call('POST', '/api/visits', c, { patientId, appointmentId: apptId });

async function draftWithContent() {
  await checkIn();
  const v = (await openVisit()).body;
  const saved = await call('PATCH', `/api/visits/${v.id}`, doctor, {
    version: v.version,
    complaints: 'Routine antenatal visit',
    assessment: 'Progressing normally',
    prescriptionItems: [
      { medicine: 'Folic acid', strength: '5 mg', dose: '1 tablet', route: 'oral', frequency: 'once daily', duration: '30 days' },
      { medicine: 'Iron supplement', frequency: 'once daily' },
    ],
  });
  expect(saved.status).toBe(200);
  return saved.body as Json;
}

describe('opening a consultation', () => {
  it('requires the patient to be checked in, and is idempotent per appointment', async () => {
    const early = await openVisit();
    expect(early.status).toBe(400);
    await checkIn();
    const first = await openVisit();
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('draft');
    const again = await openVisit(doctor);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(first.body.allergyStatus).toBe('unknown');
  });

  it('keeps consultation records away from reception', async () => {
    await checkIn();
    const v = (await openVisit()).body;
    expect((await call('POST', '/api/visits', desk, { patientId })).status).toBe(403);
    expect((await call('GET', `/api/visits/${v.id}`, desk)).status).toBe(403);
    expect((await call('GET', `/api/patients/${patientId}/visits`, desk)).status).toBe(403);
    const asDesk = (await call('GET', `/api/appointments?date=${localDate(new Date(), cfg.timezone)}`, desk)).body[0];
    expect(asDesk.visitId).toBeUndefined();
    const asNurse = (await call('GET', `/api/appointments?date=${localDate(new Date(), cfg.timezone)}`, nurse)).body[0];
    expect(asNurse.visitId).toBe(v.id);
  });

  it('rejects an appointment that belongs to another patient', async () => {
    await checkIn();
    const other = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer' })).body.patient.id;
    expect((await call('POST', '/api/visits', nurse, { patientId: other, appointmentId: apptId })).status).toBe(400);
  });
});

describe('vitals', () => {
  it('records separate, attributed entries with explicit units and validates ranges', async () => {
    await checkIn();
    const v = (await openVisit()).body;
    const post = (p: object, c = nurse) => call('POST', `/api/visits/${v.id}/vitals`, c, p);

    const ok = await post({ systolicMmhg: 118, diastolicMmhg: 76, pulseBpm: 82, temperatureC: 36.84, weightKg: 61.25 });
    expect(ok.status).toBe(201);
    expect(ok.body.vitals).toHaveLength(1);
    expect(ok.body.vitals[0]).toMatchObject({ systolicMmhg: 118, temperatureC: 36.8, weightKg: 61.3, recordedByName: 'nurse1' });

    expect((await post({})).status).toBe(400); // nothing entered
    expect((await post({ systolicMmhg: 120 })).status).toBe(400); // BP needs both
    expect((await post({ systolicMmhg: 70, diastolicMmhg: 90 })).status).toBe(400); // systolic must exceed diastolic
    expect((await post({ pulseBpm: 400 })).status).toBe(400);
    const fahrenheit = await post({ temperatureC: 98.6 }); // Fahrenheit typed into a Celsius field
    expect(fahrenheit.status).toBe(400);
    expect(fahrenheit.body.error.details[0]).toEqual({ field: 'temperatureC', message: 'Enter a value between 30 and 45' });
    expect((await post({ weightKg: 0 })).status).toBe(400);
    expect((await post({ pulseBpm: 80 }, desk)).status).toBe(403);

    const second = await post({ pulseBpm: 78 }, doctor);
    expect(second.body.vitals).toHaveLength(2); // a new reading is a new entry, never an overwrite
    expect(() => db.exec('UPDATE visit_vitals SET pulse_bpm = 1')).toThrow(/append-only/);
  });
});

describe('draft consultation', () => {
  it('is edited only by the doctor, with ordered prescription items and version checks', async () => {
    await checkIn();
    const v = (await openVisit()).body;
    expect((await call('PATCH', `/api/visits/${v.id}`, nurse, { version: 1, complaints: 'x' })).status).toBe(403);

    const saved = await draftWithContent();
    expect(saved.prescriptionItems.map((i: Json) => i.medicine)).toEqual(['Folic acid', 'Iron supplement']);
    expect(saved.version).toBeGreaterThan(v.version);

    const stale = await call('PATCH', `/api/visits/${v.id}`, doctor, { version: v.version, advice: 'late' });
    expect(stale.status).toBe(409);

    const bad = (items: unknown) => call('PATCH', `/api/visits/${v.id}`, doctor, { version: saved.version, prescriptionItems: items });
    expect((await bad([{ medicine: '' }])).status).toBe(400);
    expect((await bad([{ medicine: 'X', brand: 'y' }])).status).toBe(400);
    expect((await bad(Array.from({ length: 31 }, () => ({ medicine: 'X' })))).status).toBe(400);
  });

  it('rejects a follow-up date before the visit date', async () => {
    await checkIn();
    const v = (await openVisit()).body;
    const r = await call('PATCH', `/api/visits/${v.id}`, doctor, { version: v.version, followUpDate: '2020-01-01' });
    expect(r.status).toBe(400);
    const future = await call('PATCH', `/api/visits/${v.id}`, doctor, { version: v.version, followUpDate: '2999-01-01' });
    expect(future.status).toBe(200);
  });
});

describe('finalising and amending', () => {
  it('needs content, locks the draft, stores revision 1 and completes the appointment', async () => {
    await checkIn();
    await startConsult();
    const empty = (await openVisit()).body;
    expect((await call('POST', `/api/visits/${empty.id}/finalise`, doctor, { version: empty.version })).status).toBe(400);

    const draft = await draftWithContent();
    expect((await call('POST', `/api/visits/${draft.id}/finalise`, nurse, { version: draft.version })).status).toBe(403);
    expect((await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: draft.version - 1 })).status).toBe(409);

    const fin = await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: draft.version });
    expect(fin.status).toBe(200);
    expect(fin.body.status).toBe('final');
    expect(fin.body.finalisedByName).toBe('Dr Rao');
    expect(fin.body.revisions).toHaveLength(1);

    const appt = (await call('GET', `/api/appointments?date=${localDate(new Date(), cfg.timezone)}`, doctor)).body[0];
    expect(appt.status).toBe('completed');

    // Locked: ordinary edits and new vitals are refused.
    expect((await call('PATCH', `/api/visits/${draft.id}`, doctor, { version: fin.body.version, advice: 'x' })).status).toBe(400);
    expect((await call('POST', `/api/visits/${draft.id}/vitals`, nurse, { pulseBpm: 80 })).status).toBe(400);
    expect((await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: fin.body.version })).status).toBe(400);
  });

  it('records amendments with author, time and reason, and keeps the original readable', async () => {
    await checkIn();
    const draft = await draftWithContent();
    const fin = (await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: draft.version })).body;

    const amend = (p: object, c = doctor) => call('POST', `/api/visits/${draft.id}/amend`, c, { version: fin.version, ...p });
    expect((await amend({ assessment: 'Corrected', reason: 'ok' })).status).toBe(400); // reason too short
    expect((await amend({ assessment: 'Corrected', reason: 'Typing error in assessment' }, nurse)).status).toBe(403);
    expect((await amend({ reason: 'Nothing actually different' })).status).toBe(400);
    expect((await amend({ assessment: 'Progressing normally', reason: 'Same text again' })).status).toBe(400);

    const done = await amend({
      assessment: 'Progressing normally; BP to be rechecked',
      prescriptionItems: [{ medicine: 'Folic acid', strength: '5 mg', dose: '1 tablet', route: 'oral', frequency: 'once daily', duration: '30 days' }],
      reason: 'Added BP recheck; removed iron after review',
    });
    expect(done.status).toBe(200);
    expect(done.body.assessment).toBe('Progressing normally; BP to be rechecked');
    expect(done.body.prescriptionItems).toHaveLength(1);
    expect(done.body.revisions).toHaveLength(2);
    expect(done.body.revisions[1]).toMatchObject({ revisionNo: 2, kind: 'amendment', authorName: 'Dr Rao', reason: 'Added BP recheck; removed iron after review' });
    expect(done.body.revisions[1].changes.assessment).toEqual({ from: 'Progressing normally', to: 'Progressing normally; BP to be rechecked' });

    const original = (await call('GET', `/api/visits/${draft.id}/revisions/1`, doctor)).body;
    expect(original.snapshot.assessment).toBe('Progressing normally');
    expect(original.snapshot.prescriptionItems).toHaveLength(2);

    // The old version number is now stale.
    expect((await amend({ advice: 'More', reason: 'Another correction' })).status).toBe(409);
  });

  it('never deletes or rewrites clinical history at the database level', async () => {
    await checkIn();
    const draft = await draftWithContent();
    await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: draft.version });
    expect(() => db.exec('DELETE FROM visits')).toThrow(/cannot be deleted/);
    expect(() => db.exec('UPDATE visit_revisions SET snapshot = \'{}\'')).toThrow(/append-only/);
    expect(() => db.exec('DELETE FROM visit_revisions')).toThrow(/append-only/);
  });

  it('shows the patient their visit history to clinical staff, newest first', async () => {
    await checkIn();
    const draft = await draftWithContent();
    await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: draft.version });
    const list = (await call('GET', `/api/patients/${patientId}/visits`, nurse)).body as Json[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: draft.id, status: 'final', amendments: 0 });
  });

  it('returns enriched visit summary with vitals and details for longitudinal flowsheet', async () => {
    await checkIn();
    const draft = await draftWithContent();
    await call('POST', `/api/visits/${draft.id}/vitals`, nurse, { systolicMmhg: 118, diastolicMmhg: 78, weightKg: 58.5 });
    await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: draft.version });

    const list = (await call('GET', `/api/patients/${patientId}/visits`, doctor)).body as Json[];
    expect(list[0]).toMatchObject({
      id: draft.id,
      status: 'final',
      assessment: 'Progressing normally',
      vitals: { systolicMmhg: 118, diastolicMmhg: 78, weightKg: 58.5 },
    });
  });

  it('writes audit entries for create, view, finalise and amend', async () => {
    await checkIn();
    const draft = await draftWithContent();
    const fin = (await call('POST', `/api/visits/${draft.id}/finalise`, doctor, { version: draft.version })).body;
    await call('POST', `/api/visits/${draft.id}/amend`, doctor, { version: fin.version, advice: 'Rest', reason: 'Added advice omitted earlier' });
    await call('GET', `/api/visits/${draft.id}`, doctor);
    const actions = ((await call('GET', `/api/audit?entity=visit&entityId=${draft.id}`, doctor)).body as Json[]).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['visit.create', 'visit.update', 'visit.finalise', 'visit.amend', 'visit.view']));
  });
});
