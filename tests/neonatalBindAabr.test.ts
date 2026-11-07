import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateBindScore,
  calculateBARatio,
  getBARatioThreshold,
  interpretAabr,
  evaluateNeonatalBindAabr,
} from '../web/src/neonatalBindAabrEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let db: DB;
let app: FastifyInstance;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  const res = await app.inject({
    method,
    url,
    headers,
    payload: body as any,
  });
  return {
    status: res.statusCode,
    body: res.body ? JSON.parse(res.body) : null,
    setCookie: res.headers['set-cookie'] as string | undefined,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

// -------------------------------------------------------------
// Pure Calculation Clinical Engine Tests
// -------------------------------------------------------------
describe('Neonatal BIND & AABR Engine (Pure Unit Tests)', () => {
  it('correctly calculates BIND score and classifies severity tier', () => {
    // Normal: 0
    expect(calculateBindScore({ mentalStatusScore: 0, muscleToneScore: 0, cryScore: 0 })).toEqual({
      totalScore: 0,
      severity: 'normal',
    });

    // Mild: 1-3
    expect(calculateBindScore({ mentalStatusScore: 1, muscleToneScore: 1, cryScore: 0 })).toEqual({
      totalScore: 2,
      severity: 'mild_abe',
    });

    // Moderate: 4-6
    expect(calculateBindScore({ mentalStatusScore: 2, muscleToneScore: 2, cryScore: 1 })).toEqual({
      totalScore: 5,
      severity: 'moderate_abe',
    });

    // Severe: 7-9 (opisthotonos, coma, shrill/weak cry)
    expect(calculateBindScore({ mentalStatusScore: 3, muscleToneScore: 3, cryScore: 2 })).toEqual({
      totalScore: 8,
      severity: 'severe_abe',
    });
  });

  it('correctly calculates Bilirubin-to-Albumin (B/A) ratio', () => {
    // TSB 24 mg/dL, Albumin 3.0 g/dL -> 8.0 mg/g
    expect(calculateBARatio(24, 3.0)).toBe(8.0);
    // TSB 18.5 mg/dL, Albumin 2.8 g/dL -> 6.6 mg/g
    expect(calculateBARatio(18.5, 2.8)).toBe(6.6);
    // Missing or invalid albumin returns null
    expect(calculateBARatio(20, undefined)).toBeNull();
    expect(calculateBARatio(20, 0)).toBeNull();
  });

  it('provides gestational age-appropriate B/A ratio exchange thresholds', () => {
    // Term infant >= 38w without and with risk factors
    expect(getBARatioThreshold(39, false)).toBe(8.0);
    expect(getBARatioThreshold(38, true)).toBe(7.2);

    // Preterm infant 35-37w
    expect(getBARatioThreshold(36, false)).toBe(7.2);
    expect(getBARatioThreshold(35, true)).toBe(6.8);

    // Preterm < 35w
    expect(getBARatioThreshold(32, false)).toBe(6.0);
    expect(getBARatioThreshold(34, true)).toBe(6.0);
  });

  it('correctly interprets bilateral AABR hearing screening results', () => {
    expect(interpretAabr('pass', 'pass')).toBe('pass');
    expect(interpretAabr('refer', 'refer')).toBe('refer');
    expect(interpretAabr('pass', 'refer')).toBe('unilateral_refer');
    expect(interpretAabr('refer', 'pass')).toBe('unilateral_refer');
    expect(interpretAabr('not_tested', 'not_tested')).toBe('not_tested');
  });

  it('evaluates comprehensive BIND encephalopathy and triggers exchange transfusion alert when B/A ratio exceeded', () => {
    const evalTermInfant = evaluateNeonatalBindAabr({
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3100,
      peakTsbMgDl: 26.5,
      albuminGDl: 3.1, // B/A ratio = 8.5 (exceeds threshold 7.2 with neuro signs)
      mentalStatusScore: 2,
      muscleToneScore: 2,
      cryScore: 1, // BIND = 5 (moderate ABE)
      aabrRightEar: 'refer',
      aabrLeftEar: 'pass',
    });

    expect(evalTermInfant.totalBindScore).toBe(5);
    expect(evalTermInfant.bindSeverity).toBe('moderate_abe');
    expect(evalTermInfant.calculatedBARatio).toBe(8.5);
    expect(evalTermInfant.bARatioExchangeRisk).toBe(true);
    expect(evalTermInfant.aabrOverallResult).toBe('unilateral_refer');
    expect(evalTermInfant.urgentExchangeIndicated).toBe(true);
    expect(evalTermInfant.neuroAuditoryRecommendations.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal BIND & AABR REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatal',
      fullName: 'Dr. C. Roy (Consultant Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'sister.priya',
      fullName: 'Staff Nurse Priya NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('sister.priya', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('sister.priya', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.desk',
      fullName: 'Desk Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.desk', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.desk', PW);

    // Preterm infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Radhika (Late Preterm 35w)',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 22222',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a neonatal BIND & AABR episode and logs audit', async () => {
    const payload = {
      patientId,
      assessmentDatetime: '2026-11-07T08:00:00',
      gestationalAgeWeeks: 36,
      birthWeightGrams: 2450,
      peakTsbMgDl: 22.4,
      albuminGDl: 3.2,
      mentalStatusScore: 2,
      muscleToneScore: 1,
      cryScore: 1,
      aabrRightEar: 'refer',
      aabrLeftEar: 'pass',
      exchangeTransfusionPerformed: false,
      ivigGiven: true,
      status: 'under_phototherapy',
      neuroAuditoryFollowupPlan: 'Serial BIND flowsheet and repeat ABR at 1 month.',
      clinicalNotes: 'Initiated intensive LED phototherapy and IVIG 1 g/kg.',
    };

    const res = await call('POST', '/api/neonatal-bind/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.total_bind_score).toBe(4);
    expect(res.body.episode.bind_severity).toBe('moderate_abe');
    expect(res.body.episode.calculated_b_a_ratio).toBe(7.0);

    // Verify audit log
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'neonatal_bind.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record serial flowsheet observations and calculate serial scores', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/neonatal-bind/episodes', doctor, {
      patientId,
      assessmentDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3200,
      peakTsbMgDl: 19.0,
      albuminGDl: 3.0,
      mentalStatusScore: 1,
      muscleToneScore: 1,
      cryScore: 0,
      aabrRightEar: 'pass',
      aabrLeftEar: 'pass',
    });
    const epId = epRes.body.episode.id;

    // 2. Nurse records 4-hour post-phototherapy flowsheet
    const fsRes = await call('POST', `/api/neonatal-bind/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T10:00:00',
      hoursFromAdmission: 4,
      mentalStatusScore: 0,
      muscleToneScore: 0,
      cryScore: 0,
      tsbMgDl: 16.2,
      phototherapyType: 'quadruple_intensive',
      notes: 'Infant alert, nursing actively. Jaundice visibly lighter.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();
    expect(fsRes.body.totalBindScore).toBe(0);

    // 3. Fetch episode detail and check flowsheet array
    const detail = await call('GET', `/api/neonatal-bind/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].tsb_mg_dl).toBe(16.2);
  });

  it('allows doctor to update episode status and delete records', async () => {
    const epRes = await call('POST', '/api/neonatal-bind/episodes', doctor, {
      patientId,
      assessmentDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 37,
      birthWeightGrams: 2800,
      peakTsbMgDl: 18.0,
      mentalStatusScore: 1,
      muscleToneScore: 0,
      cryScore: 1,
      aabrRightEar: 'pass',
      aabrLeftEar: 'pass',
    });
    const epId = epRes.body.episode.id;

    // Update episode
    const patchRes = await call('PATCH', `/api/neonatal-bind/episodes/${epId}`, doctor, {
      status: 'cleared_pass',
      clinicalNotes: 'TSB normalized, infant neurologically intact.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('cleared_pass');

    // Delete episode
    const delRes = await call('DELETE', `/api/neonatal-bind/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/neonatal-bind/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating episodes', async () => {
    const res = await call('POST', '/api/neonatal-bind/episodes', attender, {
      patientId,
      assessmentDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 37,
      birthWeightGrams: 3000,
      peakTsbMgDl: 15.0,
      mentalStatusScore: 0,
      muscleToneScore: 0,
      cryScore: 0,
      aabrRightEar: 'pass',
      aabrLeftEar: 'pass',
    });
    expect(res.status).toBe(403);
  });
});
