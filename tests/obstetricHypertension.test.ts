import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluateSevereHypertension,
  getNextHypertensiveStep,
  evaluatePpcmBoardCriteria,
} from '../web/src/obstetricHypertensionEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, attender: string;
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

// -------------------------------------------------------------
// Pure Calculation Clinical Engine Tests
// -------------------------------------------------------------
describe('Obstetric Hypertensive Crisis & PPCM Engine (Pure Unit Tests)', () => {
  it('identifies acute severe obstetric hypertension meeting ACOG PB 222 criteria', () => {
    // SBP 165 / DBP 112 => Severe Crisis
    const severe = evaluateSevereHypertension({
      sbp: 165,
      dbp: 112,
    });
    expect(severe.isSevereCrisis).toBe(true);
    expect(severe.crisisSeverity).toBe('acute_severe_crisis');
    expect(severe.urgencyLevel).toBe('immediate_emergent');
    expect(severe.mapMmhg).toBe(129.7);

    // SBP 145 / DBP 92 => Mild-moderate
    const mild = evaluateSevereHypertension({
      sbp: 145,
      dbp: 92,
    });
    expect(mild.isSevereCrisis).toBe(false);
    expect(mild.crisisSeverity).toBe('mild_moderate');
  });

  it('contraindicates Labetalol in maternal asthma or bradycardia and selects Hydralazine', () => {
    const asthmaPt = evaluateSevereHypertension({
      sbp: 170,
      dbp: 110,
      asthmaHistory: true,
    });
    expect(asthmaPt.recommendedFirstLine).toBe('hydralazine');
    expect(asthmaPt.contraindicatedAgents.length).toBeGreaterThan(0);
  });

  it('guides sequential ACOG step-by-step Labetalol escalation (20 -> 40 -> 80 mg)', () => {
    // Step 1: 20 mg
    const step1 = getNextHypertensiveStep({
      agent: 'labetalol',
      currentStep: 1,
      currentSbp: 168,
      currentDbp: 112,
      initialMap: 130,
      cumulativeLabetalolMg: 0,
      cumulativeHydralazineMg: 0,
      cumulativeNifedipineMg: 0,
    });
    expect(step1.nextDoseValue).toBe(20);
    expect(step1.isControlled).toBe(false);

    // Step 2: 40 mg
    const step2 = getNextHypertensiveStep({
      agent: 'labetalol',
      currentStep: 2,
      currentSbp: 164,
      currentDbp: 110,
      initialMap: 130,
      cumulativeLabetalolMg: 20,
      cumulativeHydralazineMg: 0,
      cumulativeNifedipineMg: 0,
    });
    expect(step2.nextDoseValue).toBe(40);

    // Step 3: 80 mg
    const step3 = getNextHypertensiveStep({
      agent: 'labetalol',
      currentStep: 3,
      currentSbp: 162,
      currentDbp: 110,
      initialMap: 130,
      cumulativeLabetalolMg: 60,
      cumulativeHydralazineMg: 0,
      cumulativeNifedipineMg: 0,
    });
    expect(step3.nextDoseValue).toBe(80);
  });

  it('detects blood pressure control (<160/110) and flags excessive MAP drop risk (>25%)', () => {
    // Controlled to 142/88 from initial MAP 130
    const controlled = getNextHypertensiveStep({
      agent: 'labetalol',
      currentStep: 2,
      currentSbp: 142,
      currentDbp: 88,
      initialMap: 130,
      cumulativeLabetalolMg: 20,
      cumulativeHydralazineMg: 0,
      cumulativeNifedipineMg: 0,
    });
    expect(controlled.isControlled).toBe(true);

    // Precipitous drop from initial 140 to 95/55 (MAP 68.3, >50% drop)
    const overdrop = getNextHypertensiveStep({
      agent: 'hydralazine',
      currentStep: 2,
      currentSbp: 95,
      currentDbp: 55,
      initialMap: 140,
      cumulativeLabetalolMg: 0,
      cumulativeHydralazineMg: 10,
      cumulativeNifedipineMg: 0,
    });
    expect(overdrop.placentalHypoperfusionRisk).toBe(true);
  });

  it('evaluates PPCM BOARD criteria and indicates Bromocriptine and anticoagulation for LVEF < 45%', () => {
    const ppcm = evaluatePpcmBoardCriteria({
      lvefPercent: 36,
      ntProBnpPgMl: 1850,
      troponinINgMl: 0.09,
      dyspneaOrOrthopnea: true,
      peripheralEdema: true,
      pulmonaryCrackles: true,
      onsetWeeksPostpartumOrGestation: 38,
      isPostpartum: true,
    });

    expect(ppcm.isPpcmSuspected).toBe(true);
    expect(ppcm.ppcmRiskTier).toBe('confirmed_severe_ppcm');
    expect(ppcm.boardBromocriptineIndicated).toBe(true);
    expect(ppcm.boardAnticoagulationIndicated).toBe(true);
    expect(ppcm.boardDiureticsIndicated).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API & Integration Tests
// -------------------------------------------------------------
describe('Obstetric Hypertensive Crisis & PPCM REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Radhika Sen (OBGYN)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ld',
      fullName: 'Sister Shanti L&D',
      role: 'nurse',
      password: 'temp-pass-nurse-ld',
    });
    const nurseFirst = await login('nurse.ld', 'temp-pass-nurse-ld');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-ld',
      newPassword: PW,
    });
    nurse = await login('nurse.ld', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'Reception Staff',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('desk.attender', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Maternal patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Rao (G2P1 36w)',
      dateOfBirth: '1995-05-12',
      phone: '+91 98765 43211',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and validates ACOG step recommendation', async () => {
    const res = await call('POST', '/api/obstetric-hypertension/calculate', doctor, {
      sbp: 172,
      dbp: 114,
      agent: 'labetalol',
      currentStep: 1,
      lvefPercent: 38,
      dyspneaOrOrthopnea: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.screenResult.isSevereCrisis).toBe(true);
    expect(res.body.stepRecommendation.nextDoseValue).toBe(20);
    expect(res.body.ppcmResult.isPpcmSuspected).toBe(true);
  });

  it('creates an obstetric hypertensive crisis record and audits the event', async () => {
    const res = await call('POST', '/api/obstetric-hypertension/crises', doctor, {
      patientId,
      crisisDatetime: '2026-11-07T12:00',
      gestationWeeks: 36.5,
      onsetPhase: 'antepartum',
      initialSbp: 175,
      initialDbp: 116,
      firstLineAgent: 'labetalol',
      mgso4CoAdministered: true,
      clinicalNotes: 'Severe preeclampsia with headache. Zuspan MgSO4 infusion initiated.',
    });

    expect(res.status).toBe(201);
    expect(res.body.crisis).toBeDefined();
    expect(res.body.crisis.crisis_code).toContain('OHTN-');
    expect(res.body.crisis.initial_map).toBe(135.7);

    // Audit event check
    const auditRow = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'obstetric_hypertension.crisis_create' AND entity = 'obstetric_hypertensive_crises'`,
    ).get();
    expect(auditRow).toBeDefined();
  });

  it('allows nurses to log dose administration, accumulates totals and marks BP controlled', async () => {
    // 1. Create crisis
    const crisisRes = await call('POST', '/api/obstetric-hypertension/crises', doctor, {
      patientId,
      crisisDatetime: '2026-11-07T12:00',
      initialSbp: 168,
      initialDbp: 112,
      firstLineAgent: 'labetalol',
    });
    const crisisId = crisisRes.body.crisis.id;

    // 2. Nurse logs first dose (Labetalol 20 mg)
    const dose1 = await call('POST', `/api/obstetric-hypertension/crises/${crisisId}/dose-logs`, nurse, {
      logDatetime: '2026-11-07T12:05',
      stepNumber: 1,
      sbp: 166,
      dbp: 110,
      medicationAdministered: 'Labetalol IV',
      doseValue: 20,
      route: 'IV',
      fetalHeartRate: 144,
      maternalSymptoms: 'Headache persistent',
    });
    expect(dose1.status).toBe(201);
    expect(dose1.body.isControlled).toBe(false);

    // 3. Nurse logs second dose (Labetalol 40 mg) with BP response down to 144/92
    const dose2 = await call('POST', `/api/obstetric-hypertension/crises/${crisisId}/dose-logs`, nurse, {
      logDatetime: '2026-11-07T12:25',
      stepNumber: 2,
      sbp: 144,
      dbp: 92,
      medicationAdministered: 'Labetalol IV',
      doseValue: 40,
      route: 'IV',
      fetalHeartRate: 140,
      maternalSymptoms: 'Headache improving',
    });
    expect(dose2.status).toBe(201);
    expect(dose2.body.isControlled).toBe(true);

    // Check crisis record accumulation
    const updatedCrisis = db.prepare('SELECT * FROM obstetric_hypertensive_crises WHERE id = ?').get(crisisId) as any;
    expect(updatedCrisis.cumulative_labetalol_mg).toBe(60);
    expect(updatedCrisis.blood_pressure_controlled).toBe(1);
    expect(updatedCrisis.status).toBe('controlled_surveillance');
  });

  it('prevents attender desk staff from creating crisis records (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/obstetric-hypertension/crises', attender, {
      patientId,
      crisisDatetime: '2026-11-07T12:00',
      initialSbp: 170,
      initialDbp: 110,
    });
    expect(res.status).toBe(403);
  });
});
