import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateFetalDoppler,
  calculateExpectedMcaPsvMedian,
} from '../web/src/dopplerEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: unknown,
) {
  const res = await app.inject({
    method,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
  const sc = res.headers['set-cookie'];
  return {
    status: res.statusCode,
    headers: res.headers,
    body: (res.body ? (res.headers['content-type']?.includes('application/json') ? JSON.parse(res.body) : res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

describe('Fetal Doppler Velocimetry & CPR Mathematical Engine', () => {
  it('calculates normal third-trimester hemodynamics (Stage 0 AGA)', () => {
    const result = calculateFetalDoppler({
      gestationalAgeWeeks: 32,
      gestationalAgeDays: 0,
      estimatedFetalWeightG: 1950,
      efwPercentile: 52,
      abdominalCircumferenceMm: 280,
      acPercentile: 55,
      uaPi: 0.95, // Median ~0.96
      uaEndDiastolicFlow: 'normal_positive',
      mcaPi: 2.05, // Median ~2.00
      mcaPsvCmS: 44.0, // Normal ~43.9
      utaMeanPi: 0.70, // Normal
      dvPiv: 0.50,
      dvAWave: 'positive',
    });

    expect(result.cprRatio).toBeCloseTo(2.16, 1);
    expect(result.cprStatus).toBe('normal');
    expect(result.uaPiStatus).toBe('normal');
    expect(result.mcaBrainSparing).toBe('none');
    expect(result.fetalAnemiaRisk).toBe('none');
    expect(result.barcelonaStage).toBe('stage_0');
    expect(result.fgrClassification).toBe('aga');
    expect(result.deliveryTimingRecommendation).toContain('39–40 weeks');
  });

  it('detects brain-sparing redistribution and late FGR (Stage I)', () => {
    // 34 weeks, elevated UA PI and cerebral vasodilation (low MCA PI) -> CPR < 1.0
    const result = calculateFetalDoppler({
      gestationalAgeWeeks: 34,
      gestationalAgeDays: 2,
      estimatedFetalWeightG: 1800,
      efwPercentile: 8.5, // < 10th centile
      abdominalCircumferenceMm: 275,
      acPercentile: 7.0,
      uaPi: 1.35, // Elevated > 95th centile (p95 ~1.12)
      uaEndDiastolicFlow: 'normal_positive',
      mcaPi: 1.15, // Vasodilated < 5th centile (p5 ~1.45)
    });

    expect(result.cprRatio).toBeLessThan(1.0);
    expect(result.cprStatus).toBe('brain_sparing_redistribution');
    expect(result.mcaBrainSparing).toBe('vasodilation_below_5th');
    expect(result.uaPiStatus).toBe('elevated_above_95th');
    expect(result.barcelonaStage).toBe('stage_1');
    expect(result.fgrClassification).toBe('late_fgr');
    expect(result.deliveryTimingRecommendation).toContain('37 weeks');
    expect(result.monitoringFrequencyRecommendation).toContain('Weekly');
  });

  it('diagnoses severe placental insufficiency with Absent End-Diastolic Velocity (Stage II)', () => {
    const result = calculateFetalDoppler({
      gestationalAgeWeeks: 31,
      gestationalAgeDays: 4,
      estimatedFetalWeightG: 1200,
      efwPercentile: 2.0,
      uaPi: 2.1,
      uaEndDiastolicFlow: 'aedf_absent', // AEDV
      mcaPi: 1.4,
    });

    expect(result.barcelonaStage).toBe('stage_2');
    expect(result.fgrClassification).toBe('early_fgr');
    expect(result.deliveryTimingRecommendation).toContain('34 weeks');
    expect(result.deliveryTimingRecommendation).toContain('Cesarean');
    expect(result.steroidsIndicated).toBe(true);
  });

  it('diagnoses advanced breakdown with Reversed End-Diastolic Flow (Stage III)', () => {
    const result = calculateFetalDoppler({
      gestationalAgeWeeks: 29,
      gestationalAgeDays: 0,
      estimatedFetalWeightG: 850,
      efwPercentile: 1.5,
      uaPi: 2.8,
      uaEndDiastolicFlow: 'redf_reversed', // REDV
      mcaPi: 1.2,
      dvPiv: 0.85, // Elevated DV PIV > 95th
    });

    expect(result.barcelonaStage).toBe('stage_3');
    expect(result.deliveryTimingRecommendation).toContain('30–32 weeks');
    expect(result.steroidsIndicated).toBe(true);
    expect(result.mgso4NeuroprotectionIndicated).toBe(true);
    expect(result.monitoringFrequencyRecommendation).toContain('24–48 hours');
  });

  it('diagnoses critical fetal acidemia with Ductus Venosus Reversed A-Wave (Stage IV)', () => {
    const result = calculateFetalDoppler({
      gestationalAgeWeeks: 30,
      gestationalAgeDays: 1,
      uaPi: 2.5,
      uaEndDiastolicFlow: 'redf_reversed',
      mcaPi: 1.1,
      dvPiv: 1.1,
      dvAWave: 'reversed', // Retrograde A-wave
    });

    expect(result.barcelonaStage).toBe('stage_4');
    expect(result.stageTitle).toContain('Critical Acidemia');
    expect(result.deliveryTimingRecommendation).toContain('EMERGENCY DELIVERY within 12–24 hours');
  });

  it('evaluates fetal anemia risk from Middle Cerebral Artery PSV (Mari NEJM model)', () => {
    const ga32 = calculateExpectedMcaPsvMedian(32);
    expect(ga32).toBeGreaterThan(40);
    expect(ga32).toBeLessThan(48);

    // Elevated PSV >= 1.5 MoM indicates moderate to severe fetal anemia
    const anemiaResult = calculateFetalDoppler({
      gestationalAgeWeeks: 32,
      uaPi: 0.95,
      mcaPi: 1.9,
      mcaPsvCmS: 72.0, // Expected ~43.9 -> MoM ~1.64 >= 1.50
    });

    expect(anemiaResult.mcaPsvMom).toBeGreaterThan(1.50);
    expect(anemiaResult.fetalAnemiaRisk).toBe('moderate_to_severe');
  });
});

describe('Fetal Doppler Assessment REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.sarayu',
      fullName: 'Dr. Sarayu Rao',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse
    await call('POST', '/api/users', doctor, {
      username: 'nurse1',
      fullName: 'Sister Mary',
      role: 'nurse',
      password: 'temp-pass-nurse-1',
    });
    const nurseFirst = await login('nurse1', 'temp-pass-nurse-1');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-1',
      newPassword: PW,
    });
    nurse = await login('nurse1');

    // Desk attender
    await call('POST', '/api/users', doctor, {
      username: 'desk1',
      fullName: 'Rajesh Reception',
      role: 'attender',
      password: 'temp-pass-desk-1',
    });
    const deskFirst = await login('desk1', 'temp-pass-desk-1');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-1',
      newPassword: PW,
    });
    desk = await login('desk1');

    // Patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Meena Kulkarni',
      dateOfBirth: '1994-03-12',
      phone: '9822334455',
      address: 'Kothrud, Pune',
      lastMenstrualPeriod: '2026-03-20',
      gravida: 1,
      para: 0,
      abortions: 0,
      living: 0,
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  }, 20000);

  it('calculates real-time preview via POST /api/doppler/calculate', async () => {
    const calcRes = await call('POST', '/api/doppler/calculate', doctor, {
      gestationalAgeWeeks: 34,
      gestationalAgeDays: 0,
      uaPi: 1.40,
      mcaPi: 1.12,
      uaEndDiastolicFlow: 'normal_positive',
    });

    expect(calcRes.status).toBe(200);
    expect(calcRes.body.cprRatio).toBeCloseTo(0.8, 1);
    expect(calcRes.body.cprStatus).toBe('brain_sparing_redistribution');
    expect(calcRes.body.barcelonaStage).toBe('stage_1');
  });

  it('creates, retrieves, updates, prints and deletes a Doppler assessment', async () => {
    // 1. Create Assessment (Nurse or Doctor)
    const createRes = await call('POST', `/api/patients/${patientId}/doppler`, nurse, {
      patientId,
      assessmentDate: '2026-11-06',
      assessmentTime: '11:30',
      gestationalAgeWeeks: 32,
      gestationalAgeDays: 2,
      estimatedFetalWeightG: 1650,
      efwPercentile: 6.5,
      abdominalCircumferenceMm: 260,
      acPercentile: 5.0,
      uaPi: 1.45,
      uaEndDiastolicFlow: 'normal_positive',
      mcaPi: 1.15,
      mcaPsvCmS: 48.0,
      utaLeftPi: 1.20,
      utaRightPi: 1.10,
      utaNotching: 'unilateral',
      dvPiv: 0.62,
      dvAWave: 'positive',
      clinicalNotes: 'Late-onset FGR with brain-sparing redistribution on CPR.',
    });

    expect(createRes.status).toBe(201);
    const item = createRes.body;
    expect(item.id).toBeDefined();
    expect(item.cprStatus).toBe('brain_sparing_redistribution');
    expect(item.barcelonaStage).toBe('stage_1');
    const dopplerId = item.id;

    // 2. Retrieve single assessment
    const getRes = await call('GET', `/api/patients/${patientId}/doppler/${dopplerId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(dopplerId);
    expect(getRes.body.uaPi).toBe(1.45);

    // 3. List assessments for patient
    const listRes = await call('GET', `/api/patients/${patientId}/doppler`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);

    // 4. Update assessment (Progression to AEDV Stage II)
    const updateRes = await call('PUT', `/api/patients/${patientId}/doppler/${dopplerId}`, doctor, {
      patientId,
      assessmentDate: '2026-11-06',
      gestationalAgeWeeks: 32,
      gestationalAgeDays: 2,
      uaPi: 2.10,
      uaEndDiastolicFlow: 'aedf_absent', // AEDV
      mcaPi: 1.10,
      clinicalNotes: 'Progression to Absent End-Diastolic Velocity in Umbilical Artery.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.barcelonaStage).toBe('stage_2');
    expect(updateRes.body.uaEndDiastolicFlow).toBe('aedf_absent');

    // 5. Audit Print
    const printRes = await call('POST', `/api/patients/${patientId}/doppler/${dopplerId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);
    expect(printRes.body.ok).toBe(true);

    // 6. Delete Assessment (Doctor only)
    const delRes = await call('DELETE', `/api/patients/${patientId}/doppler/${dopplerId}`, doctor);
    expect(delRes.status).toBe(200);

    // Verify 404
    const verifyRes = await call('GET', `/api/patients/${patientId}/doppler/${dopplerId}`, doctor);
    expect(verifyRes.status).toBe(404);
  });

  it('enforces RBAC: desk attender is blocked from reading or writing Doppler records', async () => {
    // Desk attender tries to write
    const writeRes = await call('POST', `/api/patients/${patientId}/doppler`, desk, {
      patientId,
      assessmentDate: '2026-11-06',
      gestationalAgeWeeks: 32,
      uaPi: 0.95,
      mcaPi: 2.0,
    });
    expect(writeRes.status).toBe(403);

    // Desk attender tries to read
    const readRes = await call('GET', `/api/patients/${patientId}/doppler`, desk);
    expect(readRes.status).toBe(403);

    // Unauthenticated GET -> 401
    const unauthRes = await call('GET', `/api/patients/${patientId}/doppler`);
    expect(unauthRes.status).toBe(401);
  });
});
