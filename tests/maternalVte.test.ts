import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateMaternalVteScore,
  evaluateNeuraxialClearance,
  type MaternalVteRiskFactors,
} from '../web/src/maternalVteEngine.js';

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
describe('Maternal VTE Risk Assessment & Thromboprophylaxis Engine (Pure Unit Tests)', () => {
  it('identifies high antenatal risk (+4) for previous unprovoked VTE and prescribes throughout pregnancy', () => {
    const res = calculateMaternalVteScore({
      assessmentType: 'antenatal_early',
      gestationalAgeWeeks: 10,
      weightKg: 65,
      bmi: 24.5,
      previousVteUnprovokedOrEstrogen: true,
    });

    expect(res.totalScore).toBe(4);
    expect(res.riskTier).toBe('high_immediate_prophylaxis_indicated');
    expect(res.prophylaxisIndicated).toBe(true);
    expect(res.enoxaparinDose).toBe('40 mg SC once daily');
    expect(res.recommendedDuration).toContain('throughout pregnancy and 6 weeks postnatal');
  });

  it('identifies intermediate antenatal risk (+3) for known high-risk thrombophilia', () => {
    const res = calculateMaternalVteScore({
      assessmentType: 'antenatal_intrapartum',
      gestationalAgeWeeks: 28,
      weightKg: 78,
      bmi: 28.0,
      knownHighRiskThrombophilia: true,
    });

    expect(res.totalScore).toBe(3);
    expect(res.riskTier).toBe('intermediate_prophylaxis_indicated');
    expect(res.prophylaxisIndicated).toBe(true);
    expect(res.recommendedDuration).toContain('gestational age >= 28 weeks');
  });

  it('calculates postnatal risk after emergency cesarean section (+2) requiring at least 10 days LMWH', () => {
    const res = calculateMaternalVteScore({
      assessmentType: 'postnatal',
      weightKg: 72,
      bmi: 27.5,
      cesareanSectionEmergency: true,
    });

    expect(res.totalScore).toBe(2);
    expect(res.riskTier).toBe('intermediate_prophylaxis_indicated');
    expect(res.prophylaxisIndicated).toBe(true);
    expect(res.recommendedDuration).toContain('At least 10 days postpartum');
  });

  it('correctly tiers weight-banded LMWH doses across low, standard, and high weight brackets', () => {
    // Low weight < 50 kg
    const low = calculateMaternalVteScore({
      assessmentType: 'postnatal',
      weightKg: 46,
      bmi: 19.0,
      cesareanSectionEmergency: true,
    });
    expect(low.enoxaparinDose).toBe('20 mg SC once daily');
    expect(low.dalteparinDose).toBe('2,500 IU SC once daily');

    // High weight 91-130 kg
    const high = calculateMaternalVteScore({
      assessmentType: 'postnatal',
      weightKg: 105,
      bmi: 38.0,
      cesareanSectionEmergency: true,
    });
    expect(high.enoxaparinDose).toBe('60 mg SC once daily');
    expect(high.dalteparinDose).toBe('7,500 IU SC once daily');

    // Extreme weight > 170 kg
    const extreme = calculateMaternalVteScore({
      assessmentType: 'postnatal',
      weightKg: 180,
      bmi: 55.0,
      cesareanSectionEmergency: true,
    });
    expect(extreme.enoxaparinDose).toContain('108 mg/day'); // 180 * 0.6
  });

  it('evaluates neuraxial anesthesia clearance countdown accurately', () => {
    const now = Date.now();

    // Dose given 4 hours ago -> Contraindicated (8h remaining)
    const recentDose = new Date(now - 4 * 60 * 60 * 1000).toISOString();
    const blockedCheck = evaluateNeuraxialClearance(recentDose, false, new Date(now).toISOString());
    expect(blockedCheck.isEligibleNow).toBe(false);
    expect(blockedCheck.statusLabel).toContain('CONTRAINDICATED');
    expect(blockedCheck.warningAlert).toContain('HIGH RISK SPINAL HEMATOMA');

    // Dose given 13 hours ago -> Safe for spinal/epidural
    const oldDose = new Date(now - 13 * 60 * 60 * 1000).toISOString();
    const safeCheck = evaluateNeuraxialClearance(oldDose, false, new Date(now).toISOString());
    expect(safeCheck.isEligibleNow).toBe(true);
    expect(safeCheck.statusLabel).toContain('Safe');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Maternal VTE Risk Assessment & Thromboprophylaxis REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. Meenakshi Sharma (OB/GYN)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.maternity',
      fullName: 'Sister Priya Midwife',
      role: 'nurse',
      password: 'temp-pass-nurse-mat',
    });
    const nurseFirst = await login('nurse.maternity', 'temp-pass-nurse-mat');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-mat',
      newPassword: PW,
    });
    nurse = await login('nurse.maternity', PW);

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

    // Obstetric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Pooja Verma',
      dateOfBirth: '1992-05-14',
      phone: '+91 98451 12233',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and validates RCOG score stratification', async () => {
    const res = await call('POST', '/api/maternal-vte/calculate', doctor, {
      assessmentType: 'postnatal',
      weightKg: 74,
      bmi: 28.5,
      cesareanSectionEmergency: true,
      ageOver35: true,
      postpartumHemorrhageOver1000ml: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.totalScore).toBe(4); // 2 (emergency CS) + 1 (age>35) + 1 (PPH)
    expect(res.body.riskTier).toBe('high_immediate_prophylaxis_indicated');
    expect(res.body.enoxaparinDose).toBe('40 mg SC once daily');
    expect(res.body.reasons.length).toBe(3);
  });

  it('creates a maternal VTE assessment and audits the action', async () => {
    const res = await call('POST', '/api/maternal-vte/assessments', doctor, {
      patientId,
      assessmentType: 'postnatal',
      assessmentDatetime: new Date().toISOString().slice(0, 16),
      currentWeightKg: 78.0,
      bmi: 29.2,
      cesareanSectionEmergency: true,
      ageOver35: true,
      parityGeq3: true,
      lmwhPrescribed: true,
      lmwhAgent: 'enoxaparin',
      antiEmbolicStockingsOrdered: true,
      clinicalNotes: 'Postnatal day 1 following emergency CS for fetal distress. Weight-banded Clexane 40mg initiated.',
    });

    expect(res.status).toBe(201);
    const a = res.body.assessment;
    expect(a.total_vte_score).toBe(4); // 2 + 1 + 1
    expect(a.risk_tier).toBe('high_immediate_prophylaxis_indicated');
    expect(a.lmwh_daily_dose_mg_or_units).toBe('40 mg SC once daily');

    // Verify audit
    const auditRecord = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'maternal_vte.assessment_create' AND entity = 'maternal_vte_assessments'`
    ).get() as any;
    expect(auditRecord).toBeDefined();
    expect(auditRecord.detail).toContain('Score 4');
  });

  it('allows nurses to log LMWH dose and activates 12h neuraxial blackout window', async () => {
    // 1. Create assessment
    const assessRes = await call('POST', '/api/maternal-vte/assessments', doctor, {
      patientId,
      assessmentType: 'antenatal_intrapartum',
      assessmentDatetime: new Date().toISOString().slice(0, 16),
      gestationalAgeWeeks: 38.0,
      currentWeightKg: 82.0,
      bmi: 31.0,
      bmiGeq30: true,
      previousVteProvoked: true,
      lmwhPrescribed: true,
      lmwhAgent: 'enoxaparin',
    });
    const assessId = assessRes.body.assessment.id;

    // 2. Nurse logs dose administration
    const doseRes = await call('POST', `/api/maternal-vte/assessments/${assessId}/doses`, nurse, {
      administeredAt: new Date().toISOString().slice(0, 16),
      agent: 'Enoxaparin (Clexane)',
      dose: '40 mg',
      route: 'subcutaneous',
      site: 'abdomen_left',
      plateletCount: 220000,
      notes: 'Subcutaneous injection given into left lower quadrant. Patient informed of 12h spinal anesthesia restriction.',
    });

    expect(doseRes.status).toBe(201);
    expect(doseRes.body.log.site).toBe('abdomen_left');

    // 3. Fetch assessment and check neuraxial status is contraindicated
    const getRes = await call('GET', `/api/maternal-vte/assessments/${assessId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.doseLogs.length).toBe(1);
    expect(getRes.body.neuraxialStatus.isEligibleNow).toBe(false);
    expect(getRes.body.neuraxialStatus.statusLabel).toContain('CONTRAINDICATED');
  });

  it('prevents attender from creating VTE assessments (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/maternal-vte/assessments', attender, {
      patientId,
      assessmentType: 'postnatal',
      assessmentDatetime: new Date().toISOString().slice(0, 16),
      currentWeightKg: 65,
      bmi: 24,
    });

    expect(res.status).toBe(403);
  });
});
