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
});

describe('Advanced Patient Search & Filter API', () => {
  it('searches by partner / spouse name and address locality', async () => {
    // Patient 1: Pooja, Husband: Suresh Sharma, Locality: Anand Nagar
    await call('POST', '/api/patients', desk, {
      fullName: 'Pooja Sharma',
      phone: '9876543210',
      emergencyContactName: 'Suresh Sharma',
      emergencyContactPhone: '9876500000',
      address: 'House 42, Anand Nagar, Sector 4',
    });

    // Patient 2: Anita Verma, Husband: Ramesh Verma, Locality: Shanti Vihar
    await call('POST', '/api/patients', desk, {
      fullName: 'Anita Verma',
      phone: '9876543211',
      emergencyContactName: 'Ramesh Verma',
      emergencyContactPhone: '9876500001',
      address: 'Flat 10, Shanti Vihar',
    });

    // Search by spouse name "Suresh"
    const bySpouse = await call('GET', '/api/patients?q=Suresh', desk);
    expect(bySpouse.status).toBe(200);
    expect(bySpouse.body).toHaveLength(1);
    expect(bySpouse.body[0].fullName).toBe('Pooja Sharma');
    expect(bySpouse.body[0].emergencyContactName).toBe('Suresh Sharma');

    // Search by locality "Shanti"
    const byLocality = await call('GET', '/api/patients?q=Shanti', desk);
    expect(byLocality.status).toBe(200);
    expect(byLocality.body).toHaveLength(1);
    expect(byLocality.body[0].fullName).toBe('Anita Verma');

    // Search by partner phone substring
    const byPartnerPhone = await call('GET', '/api/patients?q=500001', desk);
    expect(byPartnerPhone.status).toBe(200);
    expect(byPartnerPhone.body).toHaveLength(1);
    expect(byPartnerPhone.body[0].fullName).toBe('Anita Verma');
  });

  it('filters by category: antenatal, pediatric, inpatient, and allergies', async () => {
    // 1. Antenatal mother
    const p1 = (await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Patil',
      dateOfBirth: '1995-03-20',
      lastMenstrualPeriod: '2026-06-01',
      gravida: 2,
      para: 1,
      living: 1,
    })).body.patient;

    // 2. Child patient (age 4)
    const p2 = (await call('POST', '/api/patients', desk, {
      fullName: 'Master Aarav',
      dateOfBirth: '2022-08-10',
    })).body.patient;

    // 3. Patient with known allergies
    const p3 = (await call('POST', '/api/patients', doctor, {
      fullName: 'Vikram Singh',
      estimatedAgeYears: 45,
      allergyStatus: 'known',
      allergyDetails: 'Sulfa drugs (Stevens-Johnson syndrome)',
    })).body.patient;

    // Category: Antenatal
    const antenatalRes = await call('GET', '/api/patients?category=antenatal', doctor);
    expect(antenatalRes.status).toBe(200);
    expect(antenatalRes.body.some((p: any) => p.id === p1.id)).toBe(true);
    expect(antenatalRes.body.some((p: any) => p.id === p2.id)).toBe(false);

    // Verify enriched obstetric fields
    const sunita = antenatalRes.body.find((p: any) => p.id === p1.id);
    expect(sunita.isAntenatal).toBe(true);
    expect(sunita.edd).toBe('2027-03-08');
    expect(sunita.gpal).toBe('G2 P1 L1');

    // Category: Pediatric
    const pedsRes = await call('GET', '/api/patients?category=pediatric', desk);
    expect(pedsRes.status).toBe(200);
    expect(pedsRes.body.some((p: any) => p.id === p2.id)).toBe(true);
    expect(pedsRes.body.some((p: any) => p.id === p3.id)).toBe(false);

    const aarav = pedsRes.body.find((p: any) => p.id === p2.id);
    expect(aarav.isPediatric).toBe(true);
    expect(aarav.detailedAge).toContain('yrs');

    // Category: Allergies
    const allergiesRes = await call('GET', '/api/patients?category=allergies', desk);
    expect(allergiesRes.status).toBe(200);
    expect(allergiesRes.body.some((p: any) => p.id === p3.id)).toBe(true);
    expect(allergiesRes.body.some((p: any) => p.id === p2.id)).toBe(false);
  });

  it('filters by high-risk tags: rh_negative, hypertension, lscs, and boh', async () => {
    // Rh-negative mother with high BP & prior LSCS
    const p1 = (await call('POST', '/api/patients', doctor, {
      fullName: 'Geeta Devi',
      dateOfBirth: '1985-02-14', // Age >= 35
      lastMenstrualPeriod: '2026-04-10',
      gravida: 4,
      para: 1,
      abortions: 2, // BOH
      living: 1,
      obstetricHistory: 'Previous delivery by Emergency LSCS',
    })).body.patient;

    // Record Rh-negative test in antenatal checklist
    await call('PATCH', `/api/patients/${p1.id}/antenatal-checklist/blood_group`, doctor, {
      status: 'completed',
      resultValue: 'A Rh-Negative',
      performedDate: '2026-04-20',
    });

    // Record high BP vitals in a visit
    const today = localDate(new Date(), cfg.timezone);
    const appt = (await call('POST', '/api/appointments', desk, { patientId: p1.id, date: today, time: '11:00', reason: 'High-risk Antenatal' })).body;
    await call('PATCH', `/api/appointments/${appt.id}/status`, desk, { status: 'waiting', version: 1 });
    const visit = (await call('POST', '/api/visits', nurse, { patientId: p1.id, appointmentId: appt.id })).body;
    await call('POST', `/api/visits/${visit.id}/vitals`, nurse, {
      systolicMmhg: 154,
      diastolicMmhg: 96,
      pulseBpm: 88,
    });

    // Tag filter: rh_negative
    const rhRes = await call('GET', '/api/patients?tag=rh_negative', doctor);
    expect(rhRes.status).toBe(200);
    expect(rhRes.body.some((p: any) => p.id === p1.id)).toBe(true);

    // Tag filter: hypertension
    const bpRes = await call('GET', '/api/patients?tag=hypertension', doctor);
    expect(bpRes.status).toBe(200);
    expect(bpRes.body.some((p: any) => p.id === p1.id)).toBe(true);

    // Tag filter: lscs
    const lscsRes = await call('GET', '/api/patients?tag=lscs', doctor);
    expect(lscsRes.status).toBe(200);
    expect(lscsRes.body.some((p: any) => p.id === p1.id)).toBe(true);

    // Tag filter: boh
    const bohRes = await call('GET', '/api/patients?tag=boh', doctor);
    expect(bohRes.status).toBe(200);
    expect(bohRes.body.some((p: any) => p.id === p1.id)).toBe(true);

    // Category filter: high_risk
    const highRiskRes = await call('GET', '/api/patients?category=high_risk', doctor);
    expect(highRiskRes.status).toBe(200);
    const geeta = highRiskRes.body.find((p: any) => p.id === p1.id);
    expect(geeta.isHighRisk).toBe(true);
    expect(geeta.highRiskFlags).toContain('Rh-Negative');
    expect(geeta.highRiskFlags).toContain('High BP');
    expect(geeta.highRiskFlags).toContain('Age ≥ 35');
    expect(geeta.highRiskFlags).toContain('BOH');
    expect(geeta.highRiskFlags).toContain('Prior LSCS');

    // As desk staff: highRiskFlags is undefined (clinical privacy)
    const asDesk = await call('GET', `/api/patients?q=Geeta`, desk);
    expect(asDesk.status).toBe(200);
    expect(asDesk.body[0].highRiskFlags).toBeUndefined();
  });
  it('searches and validates Aadhaar last 4 digits', async () => {
    // 1. Validation test: Aadhaar last 4 must be exactly 4 digits
    const invalidRes1 = await call('POST', '/api/patients', desk, {
      fullName: 'Test Patient 1',
      aadhaarLastFour: '123', // only 3 digits
    });
    expect(invalidRes1.status).toBe(400);

    const invalidRes2 = await call('POST', '/api/patients', desk, {
      fullName: 'Test Patient 2',
      aadhaarLastFour: '12345', // 5 digits
    });
    expect(invalidRes2.status).toBe(400);

    const invalidRes3 = await call('POST', '/api/patients', desk, {
      fullName: 'Test Patient 3',
      aadhaarLastFour: '12ab', // alphanumeric
    });
    expect(invalidRes3.status).toBe(400);

    // 2. Successful creation with valid 4-digit Aadhaar
    const created = await call('POST', '/api/patients', desk, {
      fullName: 'Meenakshi Sundaram',
      phone: '9840112233',
      aadhaarLastFour: '6543',
    });
    expect(created.status).toBe(201);
    expect(created.body.patient.aadhaarLastFour).toBe('6543');

    // 3. Search by Aadhaar last 4
    const searchRes = await call('GET', '/api/patients?q=6543', desk);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.length).toBe(1);
    expect(searchRes.body[0].fullName).toBe('Meenakshi Sundaram');
    expect(searchRes.body[0].aadhaarLastFour).toBe('6543');

    // 4. Duplicate check identifies identical Aadhaar last 4 and phone
    const dupCheck = await call('POST', '/api/patients/check-duplicates', desk, {
      fullName: 'Meenakshi S',
      phone: '9840112233',
      aadhaarLastFour: '6543',
    });
    expect(dupCheck.status).toBe(200);
    expect(dupCheck.body.possibleDuplicates.length).toBeGreaterThan(0);
    expect(dupCheck.body.possibleDuplicates[0].fullName).toBe('Meenakshi Sundaram');
  });
});
