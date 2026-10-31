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
let p1: number, p2: number, bed1: number;

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
});

const admit = async (c = doctor, p: object = {}) =>
  (await call('POST', '/api/admissions', c, { patientId: p1, bedId: bed1, reason: 'Pre-eclampsia, observation', ...p })).body.id as number;
const order = (c: string, aid: number, p: object = {}) =>
  call('POST', `/api/admissions/${aid}/orders`, c, { medicine: 'Labetalol', strength: '100 mg', dose: '100 mg', route: 'Oral', frequency: 'Every 8 hours', ...p });
const record = (c: string, aid: number, oid: number, p: object = {}) =>
  call('POST', `/api/admissions/${aid}/orders/${oid}/records`, c, { outcome: 'given', ...p });
const get = async (c: string, aid: number) => (await call('GET', `/api/admissions/${aid}`, c)).body as Json;
const summary = { finalDiagnosis: 'Pre-eclampsia, stable', conditionAtDischarge: 'Stable, BP controlled' };

describe('medicine orders', () => {
  it('lets only the doctor order; nurse and reception cannot', async () => {
    const aid = await admit();
    expect((await order(nurse, aid)).status).toBe(403);
    expect((await order(desk, aid)).status).toBe(403);
    expect((await order(doctor, aid)).status).toBe(201);
    const a = await get(doctor, aid);
    expect(a.orders).toHaveLength(1);
    expect(a.orders[0]).toMatchObject({ medicine: 'Labetalol', active: true, orderedByName: 'Dr Rao' });
  });

  it('needs medicine, dose and frequency, and cannot start before admission', async () => {
    const aid = await admit();
    expect((await order(doctor, aid, { dose: '' })).status).toBe(400);
    expect((await order(doctor, aid, { frequency: '  ' })).status).toBe(400);
    expect((await order(doctor, aid, { startDate: '2020-01-01', startTime: '08:00' })).status).toBe(400);
  });

  it('stops an order once, with a reason, and never edits it', async () => {
    const aid = await admit();
    const oid = (await order(doctor, aid)).body.id;
    expect((await call('POST', `/api/admissions/${aid}/orders/${oid}/stop`, nurse, { reason: 'done' })).status).toBe(403);
    expect((await call('POST', `/api/admissions/${aid}/orders/${oid}/stop`, doctor, { reason: '' })).status).toBe(400);
    expect((await call('POST', `/api/admissions/${aid}/orders/${oid}/stop`, doctor, { reason: 'BP controlled' })).status).toBe(200);
    expect((await call('POST', `/api/admissions/${aid}/orders/${oid}/stop`, doctor, { reason: 'again' })).status).toBe(400);
    const a = await get(doctor, aid);
    expect(a.orders[0]).toMatchObject({ active: false, stopReason: 'BP controlled' });
    expect(() => db.prepare("UPDATE medicine_orders SET dose = '1 g' WHERE id = ?").run(oid)).toThrow(/stopped, once|only be stopped/);
    expect(() => db.prepare('DELETE FROM medicine_orders WHERE id = ?').run(oid)).toThrow();
  });
});

describe('administration records', () => {
  it('lets the nurse record given/withheld/refused, kept separate from the order', async () => {
    const aid = await admit();
    const oid = (await order(doctor, aid)).body.id;
    expect((await record(nurse, aid, oid)).status).toBe(201); // dose defaults to the ordered dose
    expect((await record(nurse, aid, oid, { outcome: 'withheld' })).status).toBe(400); // needs a reason
    expect((await record(nurse, aid, oid, { outcome: 'withheld', reason: 'BP 90/60' })).status).toBe(201);
    expect((await record(nurse, aid, oid, { outcome: 'refused', reason: 'Patient declined' })).status).toBe(201);
    expect((await record(desk, aid, oid)).status).toBe(403);
    const o = (await get(nurse, aid)).orders[0];
    expect(o.dose).toBe('100 mg');
    expect(o.records.map((r: Json) => r.outcome)).toEqual(['given', 'withheld', 'refused']);
    expect(o.records[0]).toMatchObject({ doseGiven: '100 mg', recordedByName: 'nurse1' });
  });

  it('rejects records dated before the order, after a stop, or in the future', async () => {
    const aid = await admit(doctor, { admittedDate: yesterday(), admittedTime: '08:00' });
    const oid = (await order(doctor, aid, { startDate: yesterday(), startTime: '10:00' })).body.id;
    expect((await record(nurse, aid, oid, { givenDate: yesterday(), givenTime: '09:00' })).status).toBe(400);
    expect((await record(nurse, aid, oid, { givenDate: yesterday(), givenTime: '11:00' })).status).toBe(201);
    expect((await record(nurse, aid, oid, { givenDate: '2999-01-01', givenTime: '09:00' })).status).toBe(400);
    expect((await call('POST', `/api/admissions/${aid}/orders/${oid}/stop`, doctor, { reason: 'Stop', stopDate: yesterday(), stopTime: '10:30' })).status).toBe(400); // before recorded dose
    expect((await call('POST', `/api/admissions/${aid}/orders/${oid}/stop`, doctor, { reason: 'Stop', stopDate: yesterday(), stopTime: '12:00' })).status).toBe(200);
    expect((await record(nurse, aid, oid, { givenDate: yesterday(), givenTime: '13:00' })).status).toBe(400); // after stop
  });

  it('corrects a record without losing the original; nurse only their own', async () => {
    const aid = await admit();
    const oid = (await order(doctor, aid)).body.id;
    const rid = (await record(nurse, aid, oid, { dose: '200 mg' })).body.id;
    const url = `/api/admissions/${aid}/orders/${oid}/records/${rid}/correct`;
    expect((await call('POST', url, nurse, { outcome: 'given', dose: '100 mg' })).status).toBe(400); // reason needed
    expect((await call('POST', url, nurse, { outcome: 'given', dose: '100 mg', correctionReason: 'Typed the wrong dose' })).status).toBe(201);
    const r = (await get(doctor, aid)).orders[0].records;
    expect(r).toHaveLength(1);
    expect(r[0].doseGiven).toBe('200 mg');
    expect(r[0].corrections[0]).toMatchObject({ doseGiven: '100 mg', correctionReason: 'Typed the wrong dose' });
    expect(() => db.prepare("UPDATE medication_records SET dose_given = '5' WHERE id = ?").run(rid)).toThrow();

    const other = (await record(doctor, aid, oid)).body.id; // doctor's record
    const otherUrl = `/api/admissions/${aid}/orders/${oid}/records/${other}/correct`;
    expect((await call('POST', otherUrl, nurse, { outcome: 'given', correctionReason: 'Not mine to fix' })).status).toBe(403);
    expect((await call('POST', otherUrl, doctor, { outcome: 'given', dose: '50 mg', correctionReason: 'Doctor can fix' })).status).toBe(201);
  });
});

describe('discharge', () => {
  it('discharges with a summary, frees the bed, stops running medicines and locks the record', async () => {
    const aid = await admit(nurse);
    const oid = (await order(doctor, aid)).body.id;
    expect((await call('POST', `/api/admissions/${aid}/discharge`, nurse, summary)).status).toBe(403);
    expect((await call('POST', `/api/admissions/${aid}/discharge`, doctor, { finalDiagnosis: 'x' })).status).toBe(400); // missing condition
    expect((await call('POST', `/api/admissions/${aid}/discharge`, doctor, { ...summary, followUp: 'Review in 1 week', warningSigns: 'Headache, bleeding' })).status).toBe(201);

    const a = await get(doctor, aid);
    expect(a.status).toBe('discharged');
    expect(a.discharge.summary).toMatchObject({ finalDiagnosis: 'Pre-eclampsia, stable', writtenByName: 'Dr Rao', followUp: 'Review in 1 week' });
    expect(a.orders[0]).toMatchObject({ active: false, stopReason: 'Discharged' });

    const board = (await call('GET', '/api/beds', desk)).body as Json[];
    expect(board.find((b) => b.id === bed1).occupied).toBe(false);
    expect((await admit(doctor, { patientId: p2 })) > 0).toBe(true); // bed is free again

    expect((await call('POST', `/api/admissions/${aid}/entries`, nurse, { type: 'nursing_note', content: 'late' })).status).toBe(400);
    expect((await order(doctor, aid)).status).toBe(400);
    expect((await record(nurse, aid, oid)).status).toBe(400);
    expect((await call('POST', `/api/admissions/${aid}/discharge`, doctor, summary)).status).toBe(400); // already
  });

  it('cannot be earlier than the admission or the latest entry, nor in the future', async () => {
    const aid = await admit(doctor, { admittedDate: yesterday(), admittedTime: '08:00' });
    await call('POST', `/api/admissions/${aid}/entries`, nurse, { type: 'nursing_note', content: 'Settled', clinicalDate: yesterday(), clinicalTime: '15:00' });
    const url = `/api/admissions/${aid}/discharge`;
    expect((await call('POST', url, doctor, { ...summary, dischargeDate: yesterday(), dischargeTime: '07:00' })).status).toBe(400);
    expect((await call('POST', url, doctor, { ...summary, dischargeDate: yesterday(), dischargeTime: '14:00' })).status).toBe(400);
    expect((await call('POST', url, doctor, { ...summary, dischargeDate: '2999-01-01', dischargeTime: '10:00' })).status).toBe(400);
    expect((await call('POST', url, doctor, { ...summary, dischargeDate: yesterday(), dischargeTime: '16:00' })).status).toBe(201);
    expect((await get(doctor, aid)).dischargedTime).toBe('16:00');
  });

  it('keeps the summary immutable but allows addenda with a reason, after discharge only', async () => {
    const aid = await admit();
    const url = `/api/admissions/${aid}/addenda`;
    expect((await call('POST', url, doctor, { content: 'Too soon', reason: 'Testing order' })).status).toBe(400);
    await call('POST', `/api/admissions/${aid}/discharge`, doctor, summary);
    expect((await call('POST', url, nurse, { content: 'Nope', reason: 'Not allowed' })).status).toBe(403);
    expect((await call('POST', url, doctor, { content: 'Culture result: negative', reason: '' })).status).toBe(400);
    expect((await call('POST', url, doctor, { content: 'Culture result: negative', reason: 'Result arrived later' })).status).toBe(201);
    const a = await get(doctor, aid);
    expect(a.discharge.addenda[0]).toMatchObject({ content: 'Culture result: negative', authorName: 'Dr Rao' });
    expect(() => db.prepare("UPDATE discharge_summaries SET final_diagnosis = 'x' WHERE admission_id = ?").run(aid)).toThrow();
    expect(() => db.prepare('DELETE FROM discharge_summaries WHERE admission_id = ?').run(aid)).toThrow();
  });

  it('keeps clinical content from reception, who still see that the patient left', async () => {
    const aid = await admit();
    await order(doctor, aid);
    await call('POST', `/api/admissions/${aid}/discharge`, doctor, summary);
    const a = await get(desk, aid);
    expect(a.status).toBe('discharged');
    expect(a.orders).toBeUndefined();
    expect(a.discharge).toBeUndefined();
    expect(JSON.stringify(a)).not.toContain('Labetalol');
  });
});
