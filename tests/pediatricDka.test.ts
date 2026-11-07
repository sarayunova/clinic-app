import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { calculatePediatricDka } from '../web/src/pediatricDkaEngine.js';

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
describe('Pediatric DKA Resuscitation & Two-Bag Protocol Engine (Pure Unit Tests)', () => {
  it('correctly calculates severe DKA, 48-hour rehydration rate, and insulin infusion for a 15 kg child', () => {
    const result = calculatePediatricDka({
      childWeightKg: 15.0,
      initialBloodGlucoseMgDl: 480,
      venousPh: 7.08,
      serumBicarbonateMmolL: 4.5,
      measuredSodiumMeqL: 132,
      measuredPotassiumMeqL: 4.8,
      measuredChlorideMeqL: 98,
      serumBetaHydroxybutyrateMmolL: 5.6,
    });

    expect(result.dkaSeverity).toBe('severe_ph_lt_7_10');
    expect(result.estimatedDehydrationPercent).toBe(7.0);

    // Deficit: 7% * 15kg * 10 = 1050 mL
    expect(result.totalFluidDeficitMl).toBe(1050);

    // Initial Bolus (10 mL/kg): 150 mL
    expect(result.initialBolusVolumeMl).toBe(150);
    expect(result.remainingDeficitMl).toBe(900);

    // Hourly deficit: 900 / 48 = 18.75 ~ 18.8 mL/hr
    expect(result.hourlyDeficitRateMlHr).toBeCloseTo(18.8, 1);

    // Holliday-Segar 15kg: 1000 + (5 * 50) = 1250 mL/day => 1250 / 24 = 52.1 mL/hr
    expect(result.maintenanceFluidMlDay).toBe(1250);
    expect(result.hourlyMaintenanceMlHr).toBeCloseTo(52.1, 1);

    // Total rehydration: ~ 70.9 mL/hr
    expect(result.totalHourlyRehydrationRateMlHr).toBeCloseTo(70.9, 1);

    // Insulin: 15 * 0.08 = 1.2 U/hr
    expect(result.recommendedInsulinInfusionUnitsHr).toBe(1.2);

    // Corrected Sodium: 132 + 1.6 * ((480 - 100)/100) = 132 + 6.08 = 138.1
    expect(result.correctedSodiumMeqL).toBeCloseTo(138.1, 1);

    // Two-bag guidelines provided
    expect(result.twoBagTitrationGuidelines.bag1Composition).toContain('NO Dextrose');
    expect(result.twoBagTitrationGuidelines.bag2Composition).toContain('10% Dextrose');
  });

  it('correctly calculates mild DKA with 5% dehydration and standard maintenance brackets', () => {
    // 8 kg infant (<10 kg bracket)
    const infant = calculatePediatricDka({
      childWeightKg: 8.0,
      initialBloodGlucoseMgDl: 320,
      venousPh: 7.28,
      serumBicarbonateMmolL: 13.0,
    });
    expect(infant.dkaSeverity).toBe('mild_ph_7_20_7_29');
    expect(infant.estimatedDehydrationPercent).toBe(5.0);
    expect(infant.maintenanceFluidMlDay).toBe(800); // 8 * 100

    // 25 kg child (>20 kg bracket)
    const olderChild = calculatePediatricDka({
      childWeightKg: 25.0,
      initialBloodGlucoseMgDl: 380,
      venousPh: 7.16,
      serumBicarbonateMmolL: 8.0,
    });
    expect(olderChild.dkaSeverity).toBe('moderate_ph_7_10_7_19');
    // 1500 + (5 * 20) = 1600 mL/day
    expect(olderChild.maintenanceFluidMlDay).toBe(1600);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric DKA Resuscitation REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatrician',
      fullName: 'Dr. Sneha Roy (Pediatrics)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Sister Rekha PICU',
      role: 'nurse',
      password: 'temp-pass-nurse-picu',
    });
    const nurseFirst = await login('nurse.picu', 'temp-pass-nurse-picu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-picu',
      newPassword: PW,
    });
    nurse = await login('nurse.picu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'Reception Desk',
      role: 'attender',
      password: 'temp-pass-desk-dka',
    });
    const deskFirst = await login('desk.attender', 'temp-pass-desk-dka');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-dka',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Create pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Sharma',
      dateOfBirth: '2019-06-15',
      phone: '+91 98765 44444',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a DKA episode with automated rehydration rate and insulin dosing', async () => {
    const res = await call('POST', '/api/pediatric-dka/episodes', doctor, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      childWeightKg: 18.0,
      childHeightCm: 110,
      initialBloodGlucoseMgDl: 520,
      venousPh: 7.06,
      serumBicarbonateMmolL: 5.0,
      serumBetaHydroxybutyrateMmolL: 5.8,
      ketonesUrineOrBlood: 'beta_hydroxybutyrate_gte_3',
      measuredSodiumMeqL: 130,
      measuredPotassiumMeqL: 4.6,
      measuredChlorideMeqL: 96,
      initialSalineBolusMl: 180,
      clinicalNotes: 'Severe DKA, Kussmaul breathing. PICU bedside two-bag setup initiated.',
    });

    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.dka_severity).toBe('severe_ph_lt_7_10');
    expect(res.body.episode.rehydration_rate_ml_hr).toBeGreaterThan(60);
    expect(res.body.calculation.recommendedInsulinInfusionUnitsHr).toBeGreaterThan(1.0);

    // Verify audit log
    const auditRow = db.prepare('SELECT action FROM audit_events WHERE entity = ?').get('pediatric_dka_episodes') as any;
    expect(auditRow).toBeDefined();
    expect(auditRow.action).toBe('pediatric_dka.episode_create');
  });

  it('allows nurse to record hourly DKA resuscitation flowsheet with corrected sodium and GCS surveillance', async () => {
    const createRes = await call('POST', '/api/pediatric-dka/episodes', doctor, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      childWeightKg: 16.0,
      initialBloodGlucoseMgDl: 440,
      venousPh: 7.12,
      serumBicarbonateMmolL: 8.0,
      ketonesUrineOrBlood: 'large_3_plus',
      measuredSodiumMeqL: 134,
    });
    const episodeId = createRes.body.episode.id;

    // Nurse logs Hour 1 flowsheet
    const logRes = await call('POST', `/api/pediatric-dka/episodes/${episodeId}/flowsheet`, nurse, {
      hoursOnProtocol: 1,
      logDatetime: new Date().toISOString(),
      bloodGlucoseMgDl: 380,
      venousPh: 7.16,
      serumBicarbonateMmolL: 10.0,
      serumSodiumMeqL: 136,
      serumPotassiumMeqL: 4.4,
      bag1RateMlHr: 55,
      bag2RateMlHr: 20,
      insulinInfusionUnitsHr: 1.28,
      glasgowComaScaleScore: 15,
      neurologicalHeadacheVomiting: false,
      cushingTriadWarning: false,
      emergencyHyperosmolarSalineGiven: false,
      urineOutputMlKgHr: 1.5,
      notes: 'Blood glucose down by 60 mg/dL. Bag 2 titrated in smoothly. Neuro check normal.',
    });

    expect(logRes.status).toBe(201);
    expect(logRes.body.log.blood_glucose_mg_dl).toBe(380);
    expect(logRes.body.log.corrected_sodium_meq_l).toBeDefined();

    // Fetch episode detail
    const detail = await call('GET', `/api/pediatric-dka/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.flowsheetLogs).toHaveLength(1);

    // Audit print
    const printRes = await call('POST', `/api/pediatric-dka/episodes/${episodeId}/print`, doctor);
    expect(printRes.status).toBe(200);
    const printAudit = db.prepare('SELECT action FROM audit_events WHERE action = ?').get('pediatric_dka.print') as any;
    expect(printAudit).toBeDefined();
  });

  it('rejects clinical writes by unprivileged attender role with 403 Forbidden', async () => {
    const res = await call('POST', '/api/pediatric-dka/episodes', attender, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      childWeightKg: 15.0,
      initialBloodGlucoseMgDl: 300,
      venousPh: 7.20,
      serumBicarbonateMmolL: 12.0,
      ketonesUrineOrBlood: 'moderate_2_plus',
    });

    expect(res.status).toBe(403);
  });
});
