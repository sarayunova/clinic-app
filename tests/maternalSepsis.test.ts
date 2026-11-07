import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { calculateMaternalSepsis } from '../web/src/maternalSepsisEngine.js';

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
describe('Maternal Critical Care Sepsis (SOS) & Obstetric Shock Index Engine (Pure Unit Tests)', () => {
  it('correctly calculates normal physiology as low risk (SOS < 6, normal shock index < 0.9)', () => {
    const result = calculateMaternalSepsis({
      temperatureCelsius: 36.8,
      systolicBpMmhg: 118,
      diastolicBpMmhg: 74,
      heartRateBpm: 78,
      respiratoryRateBpm: 16,
      spo2Percent: 99,
      wbcCountPerUl: 10500,
      immatureBandsPercent: 2,
      serumLactateMmolL: 1.1,
    });

    expect(result.sosScore).toBeLessThan(6);
    expect(result.sosRiskLevel).toBe('low_risk');
    expect(result.obstetricShockIndex).toBeLessThan(0.9);
    expect(result.shockIndexTier).toBe('normal_lt_0_9');
    expect(result.mapTargetMet).toBe(true);
    expect(result.icuTransferRecommended).toBe(false);
  });

  it('detects severe septic shock and critical shock index (SOS >= 8, SI >= 1.4, MAP < 65)', () => {
    const result = calculateMaternalSepsis({
      temperatureCelsius: 39.4, // +3
      systolicBpMmhg: 84, // +3
      diastolicBpMmhg: 48,
      heartRateBpm: 128, // +3
      respiratoryRateBpm: 28, // +2
      spo2Percent: 91, // +2
      wbcCountPerUl: 26000, // +3
      immatureBandsPercent: 14, // +3
      serumLactateMmolL: 4.2, // +4
    });

    expect(result.sosScore).toBeGreaterThanOrEqual(8);
    expect(result.sosRiskLevel).toBe('severe_septic_shock');
    expect(result.obstetricShockIndex).toBeGreaterThanOrEqual(1.4);
    expect(result.shockIndexTier).toBe('critical_shock_gte_1_4');
    expect(result.meanArterialPressureMmhg).toBeLessThan(65);
    expect(result.mapTargetMet).toBe(false);
    expect(result.icuTransferRecommended).toBe(true);
    expect(result.hourOneBundleChecklist.some(item => item.includes('Cultures'))).toBe(true);
    expect(result.hourOneBundleChecklist.some(item => item.includes('60 minutes'))).toBe(true);
  });

  it('correctly calculates intermediate risk (SOS 6–7) with elevated shock index warning', () => {
    const result = calculateMaternalSepsis({
      temperatureCelsius: 38.2, // +1
      systolicBpMmhg: 98, // +2
      diastolicBpMmhg: 62,
      heartRateBpm: 102, // +1
      respiratoryRateBpm: 21, // +1
      spo2Percent: 94, // +1
      wbcCountPerUl: 12000, // 0
      serumLactateMmolL: 1.5,
    });

    expect(result.sosScore).toBe(6);
    expect(result.sosRiskLevel).toBe('intermediate_risk');
    expect(result.obstetricShockIndex).toBeGreaterThanOrEqual(0.9);
    expect(result.shockIndexTier).toBe('elevated_warning_0_9_to_1_4');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Maternal Sepsis & Shock Index REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. Anita Desai (OBGYN)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.labor',
      fullName: 'Sister Sunita Labor Ward',
      role: 'nurse',
      password: 'temp-pass-nurse-labor',
    });
    const nurseFirst = await login('nurse.labor', 'temp-pass-nurse-labor');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-labor',
      newPassword: PW,
    });
    nurse = await login('nurse.labor', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'Reception Desk',
      role: 'attender',
      password: 'temp-pass-desk-sepsis',
    });
    const deskFirst = await login('desk.attender', 'temp-pass-desk-sepsis');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-sepsis',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Create obstetric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Patel',
      dateOfBirth: '1996-04-12',
      phone: '+91 98765 33333',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create maternal sepsis assessment with automated SOS & Shock Index', async () => {
    const res = await call('POST', '/api/maternal-sepsis/assessments', doctor, {
      patientId,
      assessmentDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 36.4,
      suspectedSource: 'chorioamnionitis_intrauterine',
      temperatureCelsius: 39.0,
      systolicBpMmhg: 86,
      diastolicBpMmhg: 50,
      heartRateBpm: 126,
      respiratoryRateBpm: 26,
      spo2Percent: 92,
      wbcCountPerUl: 19500,
      immatureBandsPercent: 12,
      serumLactateMmolL: 3.2,
      clinicalImpression: 'Intrapartum chorioamnionitis with septic shock risk; urgent bundle initiation.',
    });

    expect(res.status).toBe(201);
    expect(res.body.assessment).toBeDefined();
    expect(res.body.assessment.sos_score).toBeGreaterThanOrEqual(8);
    expect(res.body.assessment.sos_risk_level).toBe('severe_septic_shock');
    expect(res.body.assessment.shock_index_tier).toBe('critical_shock_gte_1_4');
    expect(res.body.assessment.icu_transfer_recommended).toBe(1);

    // Verify audit log
    const auditRow = db.prepare('SELECT action FROM audit_events WHERE entity = ?').get('maternal_sepsis_assessments') as any;
    expect(auditRow).toBeDefined();
    expect(auditRow.action).toBe('maternal_sepsis.assessment_create');
  });

  it('allows nurse to record FIGO/ACOG Hour-1 bundle execution log and print audit', async () => {
    const createRes = await call('POST', '/api/maternal-sepsis/assessments', doctor, {
      patientId,
      assessmentDatetime: new Date().toISOString(),
      postpartumDays: 2,
      suspectedSource: 'postpartum_endometritis',
      temperatureCelsius: 38.8,
      systolicBpMmhg: 90,
      diastolicBpMmhg: 56,
      heartRateBpm: 118,
      respiratoryRateBpm: 24,
      spo2Percent: 94,
    });
    const assessmentId = createRes.body.assessment.id;

    // Nurse logs Hour-1 bundle
    const bundleRes = await call('POST', `/api/maternal-sepsis/assessments/${assessmentId}/bundle`, nurse, {
      logDatetime: new Date().toISOString(),
      bloodCulturesDrawn: true,
      bloodCulturesDrawnTime: new Date().toISOString(),
      ivAntibioticsGiven: true,
      antibioticNameRegimen: 'Piperacillin-Tazobactam 4.5g IV + Clindamycin 900mg IV',
      antibioticWithin60m: true,
      fluidBolus30mlPerKgGiven: true,
      fluidBolusVolumeMl: 2000,
      norepinephrineVasopressorActive: false,
      repeatLactateMmolL: 1.8,
      targetMapAchievedGte65: true,
      urineOutputMlHr: 50,
      interventionsSummary: 'Blood cultures collected. Antibiotics infused at 28 mins. 2L crystalloids cleared hypotension.',
    });

    expect(bundleRes.status).toBe(201);
    expect(bundleRes.body.log.antibiotic_within_60m).toBe(1);

    // Fetch assessment detail
    const detail = await call('GET', `/api/maternal-sepsis/assessments/${assessmentId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.bundleLogs).toHaveLength(1);
    expect(detail.body.bundleLogs[0].antibiotic_name_regimen).toContain('Piperacillin');

    // Audit print
    const printRes = await call('POST', `/api/maternal-sepsis/assessments/${assessmentId}/print`, doctor);
    expect(printRes.status).toBe(200);
    const printAudit = db.prepare('SELECT action FROM audit_events WHERE action = ?').get('maternal_sepsis.print') as any;
    expect(printAudit).toBeDefined();
  });

  it('rejects clinical writes by unprivileged attender role with 403 Forbidden', async () => {
    const res = await call('POST', '/api/maternal-sepsis/assessments', attender, {
      patientId,
      assessmentDatetime: new Date().toISOString(),
      suspectedSource: 'other_unknown_source',
      temperatureCelsius: 37.0,
      systolicBpMmhg: 120,
      diastolicBpMmhg: 80,
      heartRateBpm: 80,
      respiratoryRateBpm: 16,
      spo2Percent: 98,
    });

    expect(res.status).toBe(403);
  });
});
