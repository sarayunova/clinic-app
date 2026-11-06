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
let patientId: number;

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

  // Register patient
  const res = await call('POST', '/api/patients', doctor, {
    fullName: 'Pooja Sharma',
    dateOfBirth: '1988-04-12',
    phone: '9876543210',
    allergyStatus: 'known',
    allergyDetails: 'Penicillin (Anaphylaxis)',
  });
  expect(res.status).toBe(201);
  patientId = res.body.patient.id;
});

describe('Clinical Summary & Referral Card API', () => {
  it('enforces role access: clinical staff allowed, desk & unauthenticated forbidden', async () => {
    // Unauthenticated -> 401
    expect((await call('GET', `/api/patients/${patientId}/clinical-summary`)).status).toBe(401);
    // Desk -> 403
    expect((await call('GET', `/api/patients/${patientId}/clinical-summary`, desk)).status).toBe(403);
    // Doctor & Nurse -> 200
    expect((await call('GET', `/api/patients/${patientId}/clinical-summary`, doctor)).status).toBe(200);
    expect((await call('GET', `/api/patients/${patientId}/clinical-summary`, nurse)).status).toBe(200);

    // Bad patient ID
    expect((await call('GET', '/api/patients/bad-id/clinical-summary', doctor)).status).toBe(400);
    expect((await call('GET', '/api/patients/99999/clinical-summary', doctor)).status).toBe(404);
  });

  it('calculates gestational parameters, detects high-risk flags and MEOWS alerts', async () => {
    // Update patient with obstetric details, prior LSCS, age >= 35, and Rh-negative blood type
    const pat = (await call('GET', `/api/patients/${patientId}`, doctor)).body;
    await call('PATCH', `/api/patients/${patientId}`, doctor, {
      version: pat.version,
      lastMenstrualPeriod: '2026-05-01',
      gravida: 3,
      para: 1,
      abortions: 1,
      living: 1,
      obstetricHistory: 'Previous delivery by Emergency LSCS for fetal distress',
    });

    // Record a routine blood group test in antenatal checklist with Rh-negative result
    await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/blood_group`, doctor, {
      status: 'completed',
      resultValue: 'B Negative (Rh -ve)',
      performedDate: '2026-05-15',
    });

    // Create a consultation visit with severe hypertension vitals (SBP 165, DBP 112)
    const today = localDate(new Date(), cfg.timezone);
    const appt = (await call('POST', '/api/appointments', desk, { patientId, date: today, time: '09:30', reason: 'Antenatal Check' })).body;
    await call('PATCH', `/api/appointments/${appt.id}/status`, desk, { status: 'waiting', version: 1 });
    const visit = (await call('POST', '/api/visits', nurse, { patientId, appointmentId: appt.id })).body;

    await call('POST', `/api/visits/${visit.id}/vitals`, nurse, {
      systolicMmhg: 165,
      diastolicMmhg: 112,
      pulseBpm: 104,
      temperatureC: 37.1,
      weightKg: 68.5,
      note: 'Urine protein: 2+',
    });

    await call('PATCH', `/api/visits/${visit.id}`, doctor, {
      version: visit.version,
      assessment: '3rd Trimester Gestational Hypertension with severe features',
      prescriptionItems: [
        { medicine: 'Labetalol', dose: '100 mg', frequency: 'TDS', duration: '14 days' },
        { medicine: 'Folic Acid', dose: '5 mg', frequency: 'OD', duration: '30 days' },
      ],
    });

    const res = await call('GET', `/api/patients/${patientId}/clinical-summary`, doctor);
    expect(res.status).toBe(200);
    const data = res.body;

    // Demographic verification
    expect(data.patient.fullName).toBe('Pooja Sharma');
    expect(data.patient.allergyStatus).toBe('known');
    expect(data.patient.allergyDetails).toContain('Penicillin');
    expect(data.patient.bloodGroup).toBe('B Negative (Rh -ve)');

    // Pregnancy & Obstetric calculations
    expect(data.pregnancy.isMaternity).toBe(true);
    expect(data.pregnancy.lmp).toBe('2026-05-01');
    expect(data.pregnancy.edd).toBe('2027-02-05');
    expect(data.pregnancy.gpalFormatted).toBe('G3 P1 A1 L1');
    expect(data.pregnancy.trimester).toBe('Second (13–27w)');

    // High risk flags verification
    const flags: string[] = data.pregnancy.highRiskFlags;
    expect(flags.some((f) => f.includes('Rh-Negative'))).toBe(true);
    expect(flags.some((f) => f.includes('Advanced Maternal Age'))).toBe(true);
    expect(flags.some((f) => f.includes('Previous Cesarean'))).toBe(true);
    expect(flags.some((f) => f.includes('Severe Hypertension'))).toBe(true);
    expect(flags.some((f) => f.includes('Proteinuria'))).toBe(true);

    // MEOWS Vitals verification
    expect(data.latestVitals).not.toBeNull();
    expect(data.latestVitals.systolic).toBe(165);
    expect(data.latestVitals.diastolic).toBe(112);
    expect(data.latestVitals.meowsLevel).toBe('red');
    expect(data.latestVitals.meowsScore).toBeGreaterThanOrEqual(2);

    // Antenatal matrix verification
    expect(data.antenatalTests).not.toBeNull();
    expect(data.antenatalTests.total).toBe(19);
    expect(data.antenatalTests.done).toBe(1);
    expect(data.antenatalTests.items.find((i: any) => i.testKey === 'blood_group').status).toBe('completed');

    // Prescriptions & Consultations verification
    expect(data.recentVisits.length).toBeGreaterThan(0);
    expect(data.recentVisits[0].assessment).toContain('Gestational Hypertension');
  });

  it('records audit log when printing antenatal summary and referral cards', async () => {
    // Print antenatal summary
    const r1 = await call('POST', '/api/print-log', doctor, { kind: 'antenatal_summary', id: patientId });
    expect(r1.status).toBe(201);

    // Print referral card
    const r2 = await call('POST', '/api/print-log', nurse, { kind: 'referral_card', id: patientId });
    expect(r2.status).toBe(201);

    // Desk cannot log print
    const r3 = await call('POST', '/api/print-log', desk, { kind: 'referral_card', id: patientId });
    expect(r3.status).toBe(403);

    // Audit entries recorded
    const audits = db
      .prepare("SELECT * FROM audit_events WHERE action = 'document.print' AND entity = 'patient'")
      .all() as Array<{ entity_id: string; detail: string }>;

    expect(audits.length).toBe(2);
    expect(audits.some((a) => a.detail.includes('antenatal_summary'))).toBe(true);
    expect(audits.some((a) => a.detail.includes('referral_card'))).toBe(true);
  });
});
