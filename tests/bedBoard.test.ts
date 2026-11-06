import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientA: Json, patientB: Json;
let bed1: number, bed2: number, bed3: number;
let adm: Json;

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

const ago = (h: number) => {
  const d = new Date(Date.now() - h * 3_600_000 + 5.5 * 3_600_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
};

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.sharma', fullName: 'Dr Sharma', password: PW })).setCookie!.split(';')[0]!;
  nurse = await staff('nurse.anita', 'nurse');
  desk = await staff('desk.rahul', 'attender');

  patientA = (await call('POST', '/api/patients', doctor, {
    fullName: 'Sunita Devi',
    dateOfBirth: '1996-05-12',
    phone: '9876543210',
    allergyStatus: 'known',
    allergyDetails: 'Penicillin',
  })).body.patient;

  patientB = (await call('POST', '/api/patients', doctor, {
    fullName: 'Pooja Patel',
    dateOfBirth: '1998-09-20',
    phone: '9876500000',
    allergyStatus: 'none',
  })).body.patient;

  bed1 = (await call('POST', '/api/beds', doctor, { room: 'Labor Room', label: 'L-01' })).body.id;
  bed2 = (await call('POST', '/api/beds', doctor, { room: 'Labor Room', label: 'L-02' })).body.id;
  bed3 = (await call('POST', '/api/beds', doctor, { room: 'Maternity Ward', label: 'M-01' })).body.id;

  const t = ago(48);
  adm = (await call('POST', '/api/admissions', doctor, {
    patientId: patientA.id,
    bedId: bed1,
    reason: 'Active Labor at Term (39 weeks)',
    diagnosis: 'G2 P1 at 39 weeks with regular contractions',
    admittedDate: t.date,
    admittedTime: t.time,
    expectedDischargeDate: ago(-24).date, // Tomorrow
  })).body;
});

describe('Inpatient Bed Board & Ward Visual Grid API', () => {
  it('returns rich clinical context on GET /api/beds for clinical staff', async () => {
    // Record latest vital signs observation
    await call('POST', `/api/admissions/${adm.id}/entries`, nurse, {
      type: 'observation',
      systolicMmhg: 145,
      diastolicMmhg: 95,
      pulseBpm: 104,
      temperatureC: 38.1,
      spo2Pct: 96,
      respRate: 20,
    });

    // Start labor partograph
    const partographRes = await call('POST', `/api/patients/${patientA.id}/partographs`, doctor, {
      admissionId: adm.id,
      startTime: new Date().toISOString(),
      gestationalAgeWeeks: 39.2,
      fetalPosition: 'LOA',
    });
    expect(partographRes.status).toBe(201);

    // Fetch beds as doctor
    const res = await call('GET', '/api/beds', doctor);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const b1 = res.body.find((b: Json) => b.id === bed1);
    expect(b1).toBeDefined();
    expect(b1.occupied).toBe(true);
    expect(b1.patientName).toBe('Sunita Devi');
    expect(b1.allergyStatus).toBe('known');
    expect(b1.allergyDetails).toBe('Penicillin');
    expect(b1.admissionReason).toBe('Active Labor at Term (39 weeks)');
    expect(b1.admissionDiagnosis).toBe('G2 P1 at 39 weeks with regular contractions');
    expect(b1.expectedDischargeDate).toBe(ago(-24).date);
    expect(b1.admissionVersion).toBe(1);
    expect(b1.dayNumber).toBeGreaterThanOrEqual(1);

    // Verify lastObservation contains the vitals
    expect(b1.lastObservation).toBeDefined();
    expect(b1.lastObservation.systolicMmhg).toBe(145);
    expect(b1.lastObservation.diastolicMmhg).toBe(95);
    expect(b1.lastObservation.pulseBpm).toBe(104);
    expect(b1.lastObservation.temperatureC).toBe(38.1);

    // Verify active labor partograph is linked
    expect(b1.activeLaborPartograph).toBeDefined();
    expect(b1.activeLaborPartograph.partographNumber).toMatch(/^PTG-/);
    expect(b1.activeLaborPartograph.status).toBe('active');

    // Bed 2 is free
    const b2 = res.body.find((b: Json) => b.id === bed2);
    expect(b2.occupied).toBe(false);
    expect(b2.patientName).toBeNull();
  });

  it('protects clinical privacy for front desk attender while providing occupancy', async () => {
    const res = await call('GET', '/api/beds', desk);
    expect(res.status).toBe(200);

    const b1 = res.body.find((b: Json) => b.id === bed1);
    expect(b1.occupied).toBe(true);
    expect(b1.patientName).toBe('Sunita Devi');
    expect(b1.room).toBe('Labor Room');
    expect(b1.label).toBe('L-01');
    expect(b1.expectedDischargeDate).toBe(ago(-24).date);

    // Sensitive clinical details should not be exposed to front desk
    expect(b1.admissionReason).toBeUndefined();
    expect(b1.admissionDiagnosis).toBeUndefined();
    expect(b1.lastObservation).toBeUndefined();
    expect(b1.activeLaborPartograph).toBeUndefined();
  });

  it('blocks unauthenticated access to /api/beds', async () => {
    const res = await call('GET', '/api/beds');
    expect(res.status).toBe(401);
  });
});

describe('Discharge Planning API (PATCH /api/admissions/:id/discharge-plan)', () => {
  it('allows doctors and nurses to update the expected discharge date', async () => {
    const futureDate = ago(-72).date;
    const resNurse = await call('PATCH', `/api/admissions/${adm.id}/discharge-plan`, nurse, {
      expectedDischargeDate: futureDate,
    });
    expect(resNurse.status).toBe(200);
    expect(resNurse.body.expectedDischargeDate).toBe(futureDate);

    // Doctor can clear the expected discharge date
    const resDoctor = await call('PATCH', `/api/admissions/${adm.id}/discharge-plan`, doctor, {
      expectedDischargeDate: null,
    });
    expect(resDoctor.status).toBe(200);
    expect(resDoctor.body.expectedDischargeDate).toBeNull();
  });

  it('rejects unauthenticated and desk users from setting discharge plans', async () => {
    expect((await call('PATCH', `/api/admissions/${adm.id}/discharge-plan`, undefined, { expectedDischargeDate: '2026-11-20' })).status).toBe(401);
    expect((await call('PATCH', `/api/admissions/${adm.id}/discharge-plan`, desk, { expectedDischargeDate: '2026-11-20' })).status).toBe(403);
  });

  it('validates date format and detects version conflict', async () => {
    const badDate = await call('PATCH', `/api/admissions/${adm.id}/discharge-plan`, doctor, {
      expectedDischargeDate: 'not-a-real-date',
    });
    expect(badDate.status).toBe(400);

    const conflict = await call('PATCH', `/api/admissions/${adm.id}/discharge-plan`, doctor, {
      expectedDischargeDate: ago(-24).date,
      version: 999,
    });
    expect(conflict.status).toBe(409);
  });
});

describe('Quick Bed Transfer Integration from Bed Board', () => {
  it('transfers patient using the admissionVersion directly from GET /api/beds', async () => {
    // 1. Bed board fetch
    const bedsBefore = (await call('GET', '/api/beds', nurse)).body as Json[];
    const currentBed1 = bedsBefore.find((b) => b.id === bed1);
    expect(currentBed1.occupied).toBe(true);

    // 2. Perform 1-click transfer to bed 3
    const transferRes = await call('POST', `/api/admissions/${currentBed1.admissionId}/transfer`, nurse, {
      toBedId: bed3,
      reason: 'Shifted to Post-Natal Maternity Ward after delivery',
      version: currentBed1.admissionVersion,
    });
    expect(transferRes.status).toBe(200);

    // 3. Verify bed board immediately reflects the move
    const bedsAfter = (await call('GET', '/api/beds', nurse)).body as Json[];
    const oldBed = bedsAfter.find((b) => b.id === bed1);
    const newBed = bedsAfter.find((b) => b.id === bed3);

    expect(oldBed.occupied).toBe(false);
    expect(newBed.occupied).toBe(true);
    expect(newBed.patientName).toBe('Sunita Devi');
    expect(newBed.admissionReason).toBe('Active Labor at Term (39 weeks)');
  });
});
