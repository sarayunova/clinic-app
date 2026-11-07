import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculatePreeclampsiaScreening,
  calculateMap,
} from '../web/src/preeclampsiaEngine.js';

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

describe('Pre-eclampsia First-Trimester Screening (FMF Triad) Engine', () => {
  it('correctly calculates Mean Arterial Pressure (MAP) from dual arm inputs', () => {
    // Right: 120/80 -> MAP = 80 + 40/3 = 93.33
    // Left: 118/78 -> MAP = 78 + 40/3 = 91.33
    // Mean = 92.3 mmHg
    const map = calculateMap(120, 80, 118, 78);
    expect(map).toBeCloseTo(92.3, 1);
  });

  it('stratifies low-risk screening for healthy multiparous woman', () => {
    const result = calculatePreeclampsiaScreening({
      gestationalAgeWeeks: 12,
      gestationalAgeDays: 3,
      crlMm: 62.0,
      maternalAge: 27,
      maternalWeightKg: 58.0,
      maternalHeightCm: 162.0,
      bmi: 22.1,
      ethnicity: 'south_asian',
      parity: 'multiparous_no_pe',
      conceptionMethod: 'spontaneous',
      smokingStatus: 'non_smoker',
      sbpRight: 110,
      dbpRight: 70,
      sbpLeft: 112,
      dbpLeft: 72,
      utaPiLeft: 1.45,
      utaPiRight: 1.55,
      utaBilateralNotching: false,
      serumPlgfPgMl: 48.0, // Healthy normal
    });

    expect(result.overallRiskTier).toBe('low_risk');
    expect(result.fmfRiskCategory).toBe('low_risk');
    expect(result.fmfRiskNumeric).toBeLessThan(0.01); // < 1:100
    expect(result.aspirinIndicated).toBe(false);
    expect(result.aspirinTimingRationale).toContain('not indicated');
  });

  it('detects high-risk pre-eclampsia based on elevated MAP, high UtA PI with notching, and low PlGF', () => {
    const result = calculatePreeclampsiaScreening({
      gestationalAgeWeeks: 12,
      gestationalAgeDays: 0,
      crlMm: 58.0,
      maternalAge: 36,
      maternalWeightKg: 82.0,
      maternalHeightCm: 158.0,
      bmi: 32.8,
      ethnicity: 'south_asian',
      parity: 'nulliparous',
      conceptionMethod: 'ivf_art',
      sbpRight: 138,
      dbpRight: 88,
      sbpLeft: 136,
      dbpLeft: 86,
      utaPiLeft: 2.30,
      utaPiRight: 2.50,
      utaBilateralNotching: true,
      serumPlgfPgMl: 14.0, // Low PlGF
    });

    expect(result.overallRiskTier).toBe('high_risk');
    expect(result.fmfRiskCategory).toBe('high_risk');
    expect(result.fmfRiskNumeric).toBeGreaterThanOrEqual(0.01); // >= 1:100
    expect(result.aspirinIndicated).toBe(true);
    expect(result.aspirinDoseMg).toBe(150);
    expect(result.aspirinTimingRationale).toContain('Aspirin 150 mg');
    expect(result.calciumIndicated).toBe(true);
    expect(result.surveillanceInterval).toContain('Every 2 weeks');
    expect(result.repeatScanWeeks).toContain('20–24 weeks');
  });

  it('flags high risk when clinical major factors exist (e.g. chronic hypertension) even with borderline biometry', () => {
    const result = calculatePreeclampsiaScreening({
      gestationalAgeWeeks: 13,
      gestationalAgeDays: 0,
      maternalAge: 32,
      chronicHypertension: true,
      meanArterialPressure: 88.0,
      utaPiMean: 1.60,
    });

    expect(result.clinicalRiskCategory).toBe('high_risk');
    expect(result.overallRiskTier).toBe('high_risk');
    expect(result.aspirinIndicated).toBe(true);
    expect(result.clinicalRiskFlags).toContain('Pre-existing chronic hypertension');
  });
});

describe('Pre-eclampsia Screening REST API & RBAC', () => {
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

    // Create patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Ritu Varma',
      phone: '9898989801',
      dateOfBirth: '1995-04-12',
      address: 'Pune',
      lastMenstrualPeriod: '2026-08-10',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  }, 20000);

  it('rejects unauthenticated requests to screening endpoints', async () => {
    const r = await call('GET', `/api/patients/${patientId}/preeclampsia`);
    expect(r.status).toBe(401);
  });

  it('allows real-time calculation preview without database commit', async () => {
    const calcPayload = {
      gestationalAgeWeeks: 12,
      gestationalAgeDays: 2,
      maternalAge: 29,
      bmi: 24.0,
      sbpRight: 118,
      dbpRight: 76,
      sbpLeft: 116,
      dbpLeft: 74,
      utaPiLeft: 1.5,
      utaPiRight: 1.6,
      utaBilateralNotching: false,
    };

    const res = await call('POST', '/api/preeclampsia/calculate', nurse, calcPayload);
    expect(res.status).toBe(200);
    expect(res.body.overallRiskTier).toBeDefined();
    expect(res.body.meanArterialPressure).toBeGreaterThan(80);
    expect(res.body.utaPiMean).toBe(1.55);
  });

  it('allows clinical staff (doctor & nurse) to create and retrieve screening reports', async () => {
    const payload = {
      patientId,
      assessmentDate: '2026-11-07',
      assessmentTime: '10:00',
      gestationalAgeWeeks: 12,
      gestationalAgeDays: 4,
      crlMm: 64.0,
      maternalAge: 38, // Advanced age
      maternalWeightKg: 85.0,
      maternalHeightCm: 160.0,
      bmi: 33.2, // Obese
      ethnicity: 'south_asian',
      parity: 'nulliparous',
      conceptionMethod: 'ivf_art',
      smokingStatus: 'non_smoker',
      familyHistoryPe: true, // Mother had PE
      sbpRight: 135,
      dbpRight: 85,
      sbpLeft: 132,
      dbpLeft: 84,
      utaPiLeft: 2.1,
      utaPiRight: 2.3,
      utaBilateralNotching: true,
      serumPlgfPgMl: 18.0,
      clinicalNotes: 'First trimester combined screen shows high risk for early PE.',
      performedBy: 'Dr. Sunita PE',
    };

    const createRes = await call('POST', '/api/preeclampsia', doctor, payload);
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.overallRiskTier).toBe('high_risk');
    expect(createRes.body.aspirinIndicated).toBe(true);
    expect(createRes.body.aspirinDoseMg).toBe(150);

    const screeningId = createRes.body.id;

    // Retrieve single
    const getRes = await call('GET', `/api/preeclampsia/${screeningId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.patientId).toBe(patientId);
    expect(getRes.body.maternalAge).toBe(38);

    // List patient screenings
    const listRes = await call('GET', `/api/patients/${patientId}/preeclampsia`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(screeningId);
  });

  it('blocks non-clinical desk attender from recording screenings', async () => {
    const payload = {
      patientId,
      assessmentDate: '2026-11-07',
      gestationalAgeWeeks: 12,
      maternalAge: 30,
      meanArterialPressure: 85,
      utaPiMean: 1.6,
    };

    const res = await call('POST', '/api/preeclampsia', desk, payload);
    expect(res.status).toBe(403);
  });

  it('allows doctor to audit print and delete screening', async () => {
    const payload = {
      patientId,
      assessmentDate: '2026-11-07',
      gestationalAgeWeeks: 12,
      maternalAge: 30,
      meanArterialPressure: 85,
      utaPiMean: 1.6,
    };
    const c = await call('POST', '/api/preeclampsia', doctor, payload);
    const id = c.body.id;

    const printRes = await call('POST', `/api/preeclampsia/${id}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    const delRes = await call('DELETE', `/api/preeclampsia/${id}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const getRes = await call('GET', `/api/preeclampsia/${id}`, doctor);
    expect(getRes.status).toBe(404);
  });
});
