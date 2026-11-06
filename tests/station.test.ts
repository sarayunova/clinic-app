import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { doseState, intervalHoursOf } from '../server/routes/station.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('reading a frequency', () => {
  it('understands plain, unambiguous wording', () => {
    const cases: [string, number][] = [
      ['every 8 hours', 8], ['Every 6 hrs', 6], ['q4h', 4], ['q12', 12], ['every 24 hours', 24],
      ['OD', 24], ['once daily', 24], ['daily', 24], ['Once a day', 24],
      ['BD', 12], ['BID', 12], ['twice daily', 12], ['twice a day', 12],
      ['TDS', 8], ['TID', 8], ['thrice daily', 8], ['three times a day', 8],
      ['QID', 6], ['four times daily', 6],
    ];
    for (const [text, hours] of cases) expect(intervalHoursOf(text), text).toBe(hours);
  });

  it('never guesses: anything else has no interval', () => {
    for (const text of ['PRN', 'SOS', 'stat', 'when needed', 'once weekly', 'alternate days', 'at night', 'morning', 'HS', 'BD after food',
      'with meals', 'as directed', 'every 0 hours', 'every 30 hours', 'every other day', '', 'continuous infusion']) {
      expect(intervalHoursOf(text), text).toBeNull();
    }
  });
});

describe('dose state', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const iso = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  it('compares the time since the last record (or the start) with the interval', () => {
    expect(doseState({ intervalHours: 8, startAt: iso(30), lastAt: iso(9), now })).toBe('may_be_due');
    expect(doseState({ intervalHours: 8, startAt: iso(30), lastAt: iso(8), now })).toBe('may_be_due');
    expect(doseState({ intervalHours: 8, startAt: iso(30), lastAt: iso(3), now })).toBe('not_yet');
    expect(doseState({ intervalHours: 8, startAt: iso(2), lastAt: null, now })).toBe('not_yet'); // just started
    expect(doseState({ intervalHours: 8, startAt: iso(10), lastAt: null, now })).toBe('may_be_due'); // first dose never recorded
    expect(doseState({ intervalHours: null, startAt: iso(10), lastAt: iso(1), now })).toBe('unknown');
    expect(doseState({ intervalHours: 8, startAt: new Date(now.getTime() + 3_600_000).toISOString(), lastAt: null, now })).toBe('starts_later');
  });
});

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let asha: Json, meera: Json;

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
/** Clinic-local (Asia/Kolkata, UTC+5:30) date and time `h` hours ago. */
const ago = (h: number) => {
  const d = new Date(Date.now() - h * 3_600_000 + 5.5 * 3_600_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
};
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const station = (c = nurse, qs = '') => call('GET', `/api/station${qs}`, c);

async function admit(patient: Json, room: string, label: string, hoursAgo = 48) {
  const bed = (await call('POST', '/api/beds', doctor, { room, label })).body.id;
  const a = ago(hoursAgo);
  return (await call('POST', '/api/admissions', doctor, { patientId: patient.id, bedId: bed, reason: 'Observation', admittedDate: a.date, admittedTime: a.time })).body;
}
async function order(adm: Json, frequency: string, startedHoursAgo: number, medicine = 'Paracetamol') {
  const s = ago(startedHoursAgo);
  return (await call('POST', `/api/admissions/${adm.id}/orders`, doctor, { medicine, dose: '500 mg', frequency, startDate: s.date, startTime: s.time })).body.id as number;
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  nurse = await staff('nurse1', 'nurse');
  desk = await staff('desk1', 'attender');
  asha = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient;
  meera = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer' })).body.patient;
});

describe('nurse station: access', () => {
  it('is for doctor and nurse; reception and signed-out users are refused', async () => {
    expect((await station(nurse)).status).toBe(200);
    expect((await station(doctor)).status).toBe(200);
    expect((await station(desk)).status).toBe(403);
    expect((await call('GET', '/api/station')).status).toBe(401);
  });

  it('records that the board was opened, but not its automatic refreshes', async () => {
    const n = () => (db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'station.view'").get() as { n: number }).n;
    await station(nurse);
    expect(n()).toBe(1);
    await station(nurse, '?poll=1');
    await station(nurse, '?poll=1');
    expect(n()).toBe(1);
    const log = (await call('GET', '/api/audit?action=station.view', doctor)).body as Json[];
    expect(log[0]).toMatchObject({ label: 'Opened the nurse station board', actor: 'nurse1' });
  });
});

describe('nurse station: outpatients', () => {
  it('lists today\'s checked-in patients and whether their vitals have been recorded', async () => {
    const mk = async (p: Json, time: string) => (await call('POST', '/api/appointments', desk, { patientId: p.id, date: today(), time, reason: 'Check-up' })).body;
    const a1 = await mk(asha, '23:30');
    const a2 = await mk(meera, '23:45');
    expect((await station()).body.opd).toEqual([]); // nobody has arrived yet

    await call('PATCH', `/api/appointments/${a1.id}/status`, desk, { status: 'waiting', version: a1.version });
    await call('PATCH', `/api/appointments/${a2.id}/status`, desk, { status: 'waiting', version: a2.version });
    let opd = (await station()).body.opd as Json[];
    expect(opd.map((o) => o.patientName)).toEqual(['Asha Verma', 'Meera Iyer']);
    expect(opd.every((o) => o.hasVitals === false && o.visitId === null)).toBe(true);

    const visit = (await call('POST', '/api/visits', nurse, { patientId: asha.id, appointmentId: a1.id })).body;
    await call('POST', `/api/visits/${visit.id}/vitals`, nurse, { systolicMmhg: 120, diastolicMmhg: 80, pulseBpm: 76 });
    opd = (await station()).body.opd;
    expect(opd[0]).toMatchObject({ patientName: 'Asha Verma', visitId: visit.id, hasVitals: true });
    expect(opd[0].latestVitals).toMatchObject({ systolicMmhg: 120, diastolicMmhg: 80, pulseBpm: 76 });
    expect(opd[0].vitalsAt.time).toMatch(/^\d{2}:\d{2}$/);
    expect(opd[1]).toMatchObject({ patientName: 'Meera Iyer', hasVitals: false });
  });
});

describe('nurse station: ward', () => {
  it('shows current inpatients in bed order, with allergies, and nobody who has been discharged', async () => {
    const m = await admit(meera, 'Room 2', 'A');
    const a = await admit(asha, 'Room 1', 'B');
    await call('PATCH', `/api/patients/${asha.id}`, doctor, { allergyStatus: 'known', allergyDetails: 'Penicillin', version: asha.version });
    const ward = (await station()).body.ward as Json[];
    expect(ward.map((w) => [w.bedRoom, w.bedLabel, w.patientName])).toEqual([['Room 1', 'B', 'Asha Verma'], ['Room 2', 'A', 'Meera Iyer']]);
    expect(ward[0]).toMatchObject({ allergyStatus: 'known', allergyDetails: 'Penicillin', admissionId: a.id });
    expect(m.id).not.toBe(a.id);
  });

  it('shows the latest observation, and a corrected value replaces the original', async () => {
    const adm = await admit(asha, 'Room 1', 'A');
    expect((await station()).body.ward[0].lastObservation).toBeNull();
    const t1 = ago(5), t2 = ago(2);
    await call('POST', `/api/admissions/${adm.id}/entries`, nurse, { type: 'observation', systolicMmhg: 110, diastolicMmhg: 70, pulseBpm: 80, clinicalDate: t1.date, clinicalTime: t1.time });
    await call('POST', `/api/admissions/${adm.id}/entries`, nurse, { type: 'observation', systolicMmhg: 150, diastolicMmhg: 95, pulseBpm: 90, clinicalDate: t2.date, clinicalTime: t2.time });
    const second = db.prepare('SELECT id FROM care_entries WHERE systolic_mmhg = 150').get() as { id: number };
    let obs = (await station()).body.ward[0].lastObservation;
    expect(obs).toMatchObject({ systolicMmhg: 150, diastolicMmhg: 95, pulseBpm: 90, time: t2.time });

    const fix = await call('POST', `/api/admissions/${adm.id}/entries/${second.id}/correct`, nurse, { systolicMmhg: 130, diastolicMmhg: 85, pulseBpm: 90, reason: 'Typed the wrong digits' });
    expect(fix.status).toBe(201);
    obs = (await station()).body.ward[0].lastObservation;
    expect(obs).toMatchObject({ systolicMmhg: 130, diastolicMmhg: 85 });
  });

  it('lists only active medicines and flags those that may be due', async () => {
    const adm = await admit(asha, 'Room 1', 'A');
    const due = await order(adm, 'every 8 hours', 30, 'Ceftriaxone');
    const fresh = await order(adm, 'TDS', 1, 'Metronidazole');
    const prn = await order(adm, 'PRN', 5, 'Ondansetron');
    const stopped = await order(adm, 'BD', 10, 'Stopped drug');
    await call('POST', `/api/admissions/${adm.id}/orders/${stopped}/stop`, doctor, { reason: 'Course finished' });
    const g = ago(9);
    await call('POST', `/api/admissions/${adm.id}/orders/${due}/records`, nurse, { outcome: 'given', dose: '1 g', givenDate: g.date, givenTime: g.time });

    const meds = (await station()).body.ward[0].medicines as Json[];
    expect(meds.map((x) => x.medicine)).toEqual(['Ceftriaxone', 'Ondansetron', 'Metronidazole']); // in order of start time
    const by = (name: string) => meds.find((x) => x.medicine === name);
    expect(by('Ceftriaxone')).toMatchObject({ state: 'may_be_due', intervalHours: 8, last: { outcome: 'given', time: g.time } });
    expect(by('Metronidazole')).toMatchObject({ state: 'not_yet', intervalHours: 8, last: null }); // started an hour ago
    expect(by('Ondansetron')).toMatchObject({ state: 'unknown', intervalHours: null });
    expect(fresh).not.toBe(prn);
  });

  it('counts a refused or withheld dose as a decision made, and a correction replaces the original record', async () => {
    const adm = await admit(asha, 'Room 1', 'A');
    const o = await order(adm, 'every 6 hours', 20);
    const old = ago(10), recent = ago(2);
    await call('POST', `/api/admissions/${adm.id}/orders/${o}/records`, nurse, { outcome: 'given', dose: '500 mg', givenDate: old.date, givenTime: old.time });
    const rec = (await call('POST', `/api/admissions/${adm.id}/orders/${o}/records`, nurse, { outcome: 'refused', reason: 'Patient refused', givenDate: recent.date, givenTime: recent.time })).body;
    let med = (await station()).body.ward[0].medicines[0];
    expect(med).toMatchObject({ state: 'not_yet', last: { outcome: 'refused', reason: 'Patient refused' } });

    // The "refused" record was actually given 10 hours ago: after the correction it is overdue again.
    const fixed = await call('POST', `/api/admissions/${adm.id}/orders/${o}/records/${rec.id}/correct`, nurse, {
      outcome: 'given', dose: '500 mg', givenDate: old.date, givenTime: old.time, correctionReason: 'Entered against the wrong order',
    });
    expect(fixed.status).toBe(201);
    med = (await station()).body.ward[0].medicines[0];
    expect(med).toMatchObject({ state: 'may_be_due', last: { outcome: 'given' } });
  });
});
