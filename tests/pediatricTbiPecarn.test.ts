import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  classifyGcsSeverity,
  evaluatePecarn,
} from '../web/src/pediatricTbiPecarnEngine.js';

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
describe('Pediatric TBI & PECARN Engine (Pure Unit Tests)', () => {
  it('correctly classifies GCS severity into mild, moderate, and severe', () => {
    expect(classifyGcsSeverity(15)).toBe('mild_13_15');
    expect(classifyGcsSeverity(13)).toBe('mild_13_15');
    expect(classifyGcsSeverity(11)).toBe('moderate_9_12');
    expect(classifyGcsSeverity(9)).toBe('moderate_9_12');
    expect(classifyGcsSeverity(8)).toBe('severe_3_8');
    expect(classifyGcsSeverity(3)).toBe('severe_3_8');
  });

  it('correctly stratifies PECARN risk for infants < 2 years', () => {
    // High risk: GCS < 15 or palpable fracture
    const highRisk = evaluatePecarn({
      ageMonths: 10,
      weightKg: 9.2,
      gcsScore: 14,
      palpableSkullFracture: true,
    });
    expect(highRisk.ageBracket).toBe('under_2_years');
    expect(highRisk.pecarnRiskTier).toBe('high_risk_ct_indicated');
    expect(highRisk.ctRecommendation).toContain('Non-Contrast Head CT Scan recommended');

    // Intermediate risk: non-frontal hematoma, LOC >= 5s, severe mechanism
    const interRisk = evaluatePecarn({
      ageMonths: 18,
      weightKg: 11.5,
      gcsScore: 15,
      nonFrontalScalpHematoma: true,
      lossOfConsciousnessSeconds: 6,
    });
    expect(interRisk.pecarnRiskTier).toBe('intermediate_risk_observation_vs_ct');

    // Low risk: no predictors (< 0.05% ciTBI)
    const lowRisk = evaluatePecarn({
      ageMonths: 14,
      weightKg: 10.0,
      gcsScore: 15,
      palpableSkullFracture: false,
      nonFrontalScalpHematoma: false,
      lossOfConsciousnessSeconds: 0,
      severeMechanism: false,
    });
    expect(lowRisk.pecarnRiskTier).toBe('low_risk_no_ct');
    expect(lowRisk.ctRecommendation).toContain('NOT recommended');
  });

  it('correctly stratifies PECARN risk for children >= 2 years', () => {
    // High risk: signs of basilar skull fracture or altered mental status
    const highRisk = evaluatePecarn({
      ageMonths: 48,
      weightKg: 16.0,
      gcsScore: 14,
      signsOfBasilarFracture: true,
    });
    expect(highRisk.ageBracket).toBe('2_years_and_older');
    expect(highRisk.pecarnRiskTier).toBe('high_risk_ct_indicated');

    // Intermediate risk: vomiting, severe headache, severe mechanism
    const interRisk = evaluatePecarn({
      ageMonths: 72,
      weightKg: 22.0,
      gcsScore: 15,
      vomitingEpisodesCount: 3,
      severeHeadache: true,
    });
    expect(interRisk.pecarnRiskTier).toBe('intermediate_risk_observation_vs_ct');

    // Low risk
    const lowRisk = evaluatePecarn({
      ageMonths: 60,
      weightKg: 19.0,
      gcsScore: 15,
      vomitingEpisodesCount: 0,
      severeHeadache: false,
      severeMechanism: false,
    });
    expect(lowRisk.pecarnRiskTier).toBe('low_risk_no_ct');
  });

  it('calculates tiered raised ICP management doses (3% Saline & Mannitol) and CPP', () => {
    const severeTbi = evaluatePecarn({
      ageMonths: 96,
      weightKg: 28.0,
      gcsScore: 6,
      intubated: true,
      icpMmhg: 24,
      meanArterialPressureMmhg: 68,
    });

    expect(severeTbi.gcsSeverity).toBe('severe_3_8');
    expect(severeTbi.calculatedCppMmhg).toBe(44); // 68 - 24 = 44 mmHg
    expect(severeTbi.icpTierRecommended).toBe('tier_2_hyperosmolar_therapy');
    // 3% saline 3 mL/kg for 28 kg = 84 mL
    expect(severeTbi.recommendedHypertonicSaline3Pct.doseVolumeMl).toBe(84);
    // Mannitol 20% 2.5 mL/kg for 28 kg = 70 mL
    expect(severeTbi.recommendedMannitol20Pct.doseVolumeMl).toBe(70);
    expect(severeTbi.clinicalActionPlan.some((p) => p.includes('Hypertonic Saline'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric TBI & PECARN REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatrician',
      fullName: 'Dr. Rahul Mehta (Pediatric Intensivist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Staff Nurse Neha (PICU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.picu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.picu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.desk',
      fullName: 'PICU Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.desk', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.desk', PW);

    // Pediatric trauma patient (3-year-old)
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Verma (3yo Fall from Bed)',
      dateOfBirth: '2023-08-15',
      phone: '+91 98765 55555',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a pediatric TBI episode and verifies audit logging', async () => {
    const payload = {
      patientId,
      injuryDatetime: '2026-11-07T07:30:00',
      ageMonths: 39,
      weightKg: 15.2,
      injuryMechanism: 'fall_greater_than_threshold',
      gcsScore: 14,
      alteredMentalStatus: true,
      palpableSkullFracture: false,
      signsOfBasilarFracture: false,
      vomitingEpisodesCount: 2,
      lossOfConsciousnessSeconds: 15,
      severeHeadache: true,
      severeMechanism: true,
      ctPerformed: false,
      status: 'acute_ed_eval',
      clinicalNotes: 'Non-contrast CT ordered immediately due to altered mental status and LOC.',
    };

    const res = await call('POST', '/api/pediatric-tbi/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.pecarn_risk_category).toBe('high_risk_ct_indicated');

    // Verify audit log
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'pediatric_tbi.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record hourly PICU neuro & ICP flowsheet logs', async () => {
    const epRes = await call('POST', '/api/pediatric-tbi/episodes', doctor, {
      patientId,
      injuryDatetime: '2026-11-07T06:00:00',
      ageMonths: 39,
      weightKg: 15.0,
      injuryMechanism: 'fall_greater_than_threshold',
      gcsScore: 7,
      alteredMentalStatus: true,
      status: 'picu_icp_monitoring',
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Nurse records PICU monitoring log
    const fsRes = await call('POST', `/api/pediatric-tbi/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T09:00:00',
      minutesFromInjury: 180,
      gcsTotal: 7,
      gcsEye: 1,
      gcsVerbal: 2,
      gcsMotor: 4,
      pupilReactivity: 'brisk_bilateral',
      pupilSizeRightMm: 3.0,
      pupilSizeLeftMm: 3.0,
      vitalsHr: 110,
      vitalsSbp: 100,
      vitalsDbp: 60,
      vitalsSpo2: 99.0,
      icpMmhg: 18.0,
      serumSodiumMeqL: 148.0,
      hyperosmolarBolusGiven: 'hypertonic_saline_3pct',
      notes: 'Patient deeply sedated, ICP controlled below 20 mmHg.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();

    // Fetch episode detail and check flowsheet
    const detail = await call('GET', `/api/pediatric-tbi/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].icp_mmhg).toBe(18.0);
  });

  it('allows doctor to update episode status and delete records', async () => {
    const epRes = await call('POST', '/api/pediatric-tbi/episodes', doctor, {
      patientId,
      injuryDatetime: '2026-11-07T06:00:00',
      ageMonths: 39,
      weightKg: 15.0,
      injuryMechanism: 'ground_level_fall',
      gcsScore: 15,
      alteredMentalStatus: false,
      status: 'acute_ed_eval',
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Doctor updates episode to discharged
    const patchRes = await call('PATCH', `/api/pediatric-tbi/episodes/${epId}`, doctor, {
      status: 'discharged_convalescent',
      clinicalNotes: 'Observed 6 hours. Fully alert, tolerating fluids. Return precautions given.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('discharged_convalescent');

    // Doctor deletes episode
    const delRes = await call('DELETE', `/api/pediatric-tbi/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/pediatric-tbi/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating TBI episodes', async () => {
    const res = await call('POST', '/api/pediatric-tbi/episodes', attender, {
      patientId,
      injuryDatetime: '2026-11-07T06:00:00',
      ageMonths: 39,
      weightKg: 15.0,
      gcsScore: 15,
    });
    expect(res.status).toBe(403);
  });
});
