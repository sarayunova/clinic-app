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
let p1: number, p2: number, bed1: number, bed2: number;

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
const yesterday = () => localDate(new Date(Date.now() - 86_400_000), cfg.timezone);

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
  p1 = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient.id;
  p2 = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer' })).body.patient.id;
  bed1 = (await call('POST', '/api/beds', doctor, { room: 'Room 1', label: 'A' })).body.id;
  bed2 = (await call('POST', '/api/beds', doctor, { room: 'Room 1', label: 'B' })).body.id;
});

const admit = (c: string, p: object = {}) => call('POST', '/api/admissions', c, { patientId: p1, bedId: bed1, reason: 'Pre-eclampsia, observation', ...p });
const addEntry = (c: string, id: number, p: object) => call('POST', `/api/admissions/${id}/entries`, c, p);

describe('beds and the ward board', () => {
  it('lets only the doctor manage beds, rejects duplicates, and shows occupancy to everyone', async () => {
    expect((await call('POST', '/api/beds', nurse, { room: 'Room 2', label: 'A' })).status).toBe(403);
    expect((await call('POST', '/api/beds', doctor, { room: 'room 1', label: 'a' })).status).toBe(409); // same bed, different case
    await admit(nurse);
    const board = (await call('GET', '/api/beds', desk)).body as Json[];
    expect(board).toHaveLength(2);
    const occupied = board.find((b) => b.id === bed1);
    expect(occupied).toMatchObject({ occupied: true, patientName: 'Asha Verma', dayNumber: 1 });
    expect(board.find((b) => b.id === bed2).occupied).toBe(false);
  });

  it('will not take an occupied bed out of use', async () => {
    const a = await admit(doctor);
    expect((await call('PATCH', `/api/beds/${bed1}`, doctor, { active: false })).status).toBe(409);
    expect((await call('PATCH', `/api/beds/${bed2}`, doctor, { active: false })).status).toBe(200);
    expect((await admit(doctor, { patientId: p2, bedId: bed2 })).status).toBe(400); // not in use
    expect(a.status).toBe(201);
  });
});

describe('admissions', () => {
  it('admits to an available bed with a numbered record, by doctor or nurse but not reception', async () => {
    expect((await admit(desk)).status).toBe(403);
    const a = await admit(nurse, { diagnosis: 'Severe pre-eclampsia' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ admissionNumber: 'A000001', status: 'admitted', bedRoom: 'Room 1', bedLabel: 'A', dayNumber: 1 });
    const b = await admit(doctor, { patientId: p2, bedId: bed2 });
    expect(b.body.admissionNumber).toBe('A000002');
  });

  it('blocks a second patient in the same bed and a second admission for the same patient', async () => {
    await admit(doctor);
    const sameBed = await admit(doctor, { patientId: p2 });
    expect(sameBed.status).toBe(409);
    expect(sameBed.body.error.message).toMatch(/already occupied/);
    const samePatient = await admit(doctor, { bedId: bed2 });
    expect(samePatient.status).toBe(409);
    expect(samePatient.body.error.message).toMatch(/already admitted \(A000001/);
  });

  it('enforces the same rules in the database, even if the API is bypassed', async () => {
    await admit(doctor);
    const raw = (patient: number, bed: number) =>
      db.prepare(
        `INSERT INTO admissions(admission_number, patient_id, bed_id, admitted_at, reason, created_by, created_at, updated_at)
         VALUES ('X' || abs(random()), ?, ?, '2026-01-01T00:00:00Z', 'x', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      ).run(patient, bed);
    expect(() => raw(p2, bed1)).toThrow(/UNIQUE/); // bed already holds an active admission
    expect(() => raw(p1, bed2)).toThrow(/UNIQUE/); // patient already has an active admission
    expect(() => db.exec('DELETE FROM admissions')).toThrow(/cannot be deleted/);
  });

  it('validates admission input and times', async () => {
    expect((await admit(doctor, { patientId: 9999 })).status).toBe(404);
    expect((await admit(doctor, { bedId: 9999 })).status).toBe(404);
    expect((await admit(doctor, { reason: '' })).status).toBe(400);
    expect((await admit(doctor, { admittedDate: yesterday() })).status).toBe(400); // date without time
    expect((await admit(doctor, { admittedDate: '2999-01-01', admittedTime: '10:00' })).status).toBe(400); // future
    const late = await admit(doctor, { admittedDate: yesterday(), admittedTime: '09:30' }); // late entry is fine
    expect(late.status).toBe(201);
    expect(late.body.admittedDate).toBe(yesterday());
    expect(late.body.admittedTime).toBe('09:30');
    expect(late.body.dayNumber).toBe(2);
  });

  it('gives reception only the basic view and clinical staff the full record', async () => {
    const a = (await admit(doctor, { diagnosis: 'Severe pre-eclampsia' })).body;
    const asDesk = (await call('GET', `/api/admissions/${a.id}`, desk)).body;
    expect(asDesk.patientName).toBe('Asha Verma');
    expect(asDesk.bedLabel).toBe('A');
    expect(asDesk.reason).toBeUndefined();
    expect(asDesk.diagnosis).toBeUndefined();
    expect(asDesk.entries).toBeUndefined();
    const asNurse = (await call('GET', `/api/admissions/${a.id}`, nurse)).body;
    expect(asNurse.reason).toBe('Pre-eclampsia, observation');
    expect(Array.isArray(asNurse.entries)).toBe(true);
    const list = (await call('GET', '/api/admissions', desk)).body as Json[];
    expect(list[0].reason).toBeUndefined();
    expect((await call('GET', `/api/patients/${p1}/admissions`, nurse)).body).toHaveLength(1);
  });

  it('lets only the doctor edit the plan, checks versions, and audits what changed', async () => {
    const a = (await admit(doctor)).body;
    expect((await call('PATCH', `/api/admissions/${a.id}`, nurse, { version: a.version, treatmentPlan: 'x' })).status).toBe(403);
    const ok = await call('PATCH', `/api/admissions/${a.id}`, doctor, { version: a.version, treatmentPlan: 'MgSO4 per protocol; 4-hourly BP' });
    expect(ok.status).toBe(200);
    expect(ok.body.version).toBe(a.version + 1);
    expect((await call('PATCH', `/api/admissions/${a.id}`, doctor, { version: a.version, diagnosis: 'late' })).status).toBe(409);
    const log = (await call('GET', `/api/audit?entity=admission&entityId=${a.id}`, doctor)).body as Json[];
    const upd = log.find((e) => e.action === 'admission.update');
    expect(upd.detail.treatmentPlan).toEqual({ from: null, to: 'MgSO4 per protocol; 4-hourly BP' });
  });
});

describe('care entries', () => {
  let adm: Json;
  beforeEach(async () => {
    adm = (await admit(doctor)).body;
  });

  it('lets nurses add nursing notes and observations, and only the doctor add rounds, procedures and investigations', async () => {
    expect((await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'Resting comfortably' })).status).toBe(201);
    expect((await addEntry(nurse, adm.id, { type: 'observation', systolicMmhg: 150, diastolicMmhg: 96, pulseBpm: 88, temperatureC: 37.2, spo2Pct: 98 })).status).toBe(201);
    for (const type of ['doctor_round', 'procedure', 'investigation']) {
      expect((await addEntry(nurse, adm.id, { type, content: 'x' })).status).toBe(403);
      expect((await addEntry(doctor, adm.id, { type, content: 'Reviewed; plan unchanged' })).status).toBe(201);
    }
    expect((await addEntry(desk, adm.id, { type: 'nursing_note', content: 'x' })).status).toBe(403);

    const full = (await call('GET', `/api/admissions/${adm.id}`, doctor)).body;
    expect(full.entries).toHaveLength(5);
    const obs = full.entries.find((e: Json) => e.entryType === 'observation');
    expect(obs).toMatchObject({ authorName: 'nurse1', systolicMmhg: 150, spo2Pct: 98 });
    expect(obs.clinicalTime).toMatch(/^\d\d:\d\d$/);
  });

  it('validates content and measurements', async () => {
    const bad = (p: object) => addEntry(nurse, adm.id, p);
    expect((await bad({ type: 'nursing_note' })).status).toBe(400); // text required
    expect((await bad({ type: 'observation' })).status).toBe(400); // nothing entered
    expect((await bad({ type: 'nursing_note', content: 'x', pulseBpm: 80 })).status).toBe(400); // measures only on observation
    expect((await bad({ type: 'observation', systolicMmhg: 120 })).status).toBe(400); // BP needs both
    expect((await bad({ type: 'observation', systolicMmhg: 70, diastolicMmhg: 90 })).status).toBe(400);
    expect((await bad({ type: 'observation', spo2Pct: 140 })).status).toBe(400);
    expect((await bad({ type: 'observation', temperatureC: 98.6 })).status).toBe(400);
    expect((await bad({ type: 'nurse_shout', content: 'x' })).status).toBe(400);
  });

  it('keeps clinical time separate from entry time, and rejects impossible times', async () => {
    // Admitted just now, so midnight today is before the admission.
    expect((await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'x', clinicalDate: localDate(new Date(), cfg.timezone), clinicalTime: '00:00' })).status).toBe(400);

    // A genuine late entry: admitted yesterday morning, note written now about yesterday noon.
    const old = (await admit(doctor, { patientId: p2, bedId: bed2, admittedDate: yesterday(), admittedTime: '09:00' })).body;
    const late = await addEntry(nurse, old.id, { type: 'nursing_note', content: 'Written late', clinicalDate: yesterday(), clinicalTime: '12:00' });
    expect(late.status).toBe(201);
    const e = late.body.entries[0];
    expect(e.clinicalDate).toBe(yesterday());
    expect(e.clinicalTime).toBe('12:00');
    expect(e.createdDate).toBe(localDate(new Date(), cfg.timezone)); // recorded today, not yesterday
    expect((await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'x', clinicalDate: '2999-01-01', clinicalTime: '10:00' })).status).toBe(400);
    expect((await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'x', clinicalDate: '2020-01-01', clinicalTime: '10:00' })).status).toBe(400); // before admission
    expect((await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'x', clinicalDate: yesterday() })).status).toBe(400); // date without time
  });

  it('corrects by adding a linked entry; the original stays, with author, time and reason', async () => {
    const note = (await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'Fluid intake 500 ml' })).body.entries[0];
    const round = (await addEntry(doctor, adm.id, { type: 'doctor_round', content: 'Plan unchanged' })).body.entries.find((e: Json) => e.entryType === 'doctor_round');
    const fix = (c: string, entry: number, p: object) => call('POST', `/api/admissions/${adm.id}/entries/${entry}/correct`, c, p);

    expect((await fix(nurse, note.id, { content: 'Fluid intake 800 ml' })).status).toBe(400); // reason required
    expect((await fix(nurse, round.id, { content: 'edited', reason: 'Trying to edit the doctor' })).status).toBe(403);
    expect((await fix(desk, note.id, { content: 'x', reason: 'Reception cannot' })).status).toBe(403);

    const done = await fix(nurse, note.id, { content: 'Fluid intake 800 ml', reason: 'Misread the chart' });
    expect(done.status).toBe(201);
    const shown = done.body.entries.find((e: Json) => e.id === note.id);
    expect(shown.content).toBe('Fluid intake 500 ml'); // original untouched
    expect(shown.corrections).toHaveLength(1);
    expect(shown.corrections[0]).toMatchObject({ content: 'Fluid intake 800 ml', correctionReason: 'Misread the chart', authorName: 'nurse1' });
    expect(shown.corrections[0].clinicalAt).toBe(shown.clinicalAt);
    expect(done.body.entries.some((e: Json) => e.correctsId)).toBe(false); // corrections are nested, not top-level

    const byDoctor = await fix(doctor, round.id, { content: 'Plan unchanged; review BP in 4 h', reason: 'Added review interval' });
    expect(byDoctor.status).toBe(201);
    expect((await fix(doctor, 99999, { content: 'x', reason: 'Does not exist' })).status).toBe(404);
  });

  it('never rewrites or deletes care entries at the database level', async () => {
    await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'x' });
    expect(() => db.exec("UPDATE care_entries SET content = 'changed'")).toThrow(/append-only/);
    expect(() => db.exec('DELETE FROM care_entries')).toThrow(/append-only/);
  });

  it('writes audit entries for admitting, adding and correcting', async () => {
    const e = (await addEntry(nurse, adm.id, { type: 'nursing_note', content: 'x' })).body.entries[0];
    await call('POST', `/api/admissions/${adm.id}/entries/${e.id}/correct`, nurse, { content: 'y', reason: 'Typing mistake' });
    await call('GET', `/api/admissions/${adm.id}`, doctor);
    const actions = ((await call('GET', `/api/audit?entity=admission&entityId=${adm.id}`, doctor)).body as Json[]).map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(['admission.create', 'care.add', 'care.correct', 'admission.view']));
  });
});
