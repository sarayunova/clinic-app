import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateNeonatalGlucoseTarget,
  calculateGir,
  calculateInfusionRateForGir,
  calculateD10wBolus,
  evaluateNeonatalHypoglycemia,
  calculateNeonatalSeizureMedication,
  interpretAeegPattern,
} from '../web/src/neonatalHypoglycemiaEngine.js';

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
describe('Neonatal Hypoglycemia & aEEG Engine (Pure Unit Tests)', () => {
  it('correctly provides AAP age-specific target cutoffs', () => {
    expect(calculateNeonatalGlucoseTarget(2)).toBe(40.0);
    expect(calculateNeonatalGlucoseTarget(12)).toBe(45.0);
    expect(calculateNeonatalGlucoseTarget(36)).toBe(50.0);
  });

  it('correctly calculates Glucose Infusion Rate (GIR)', () => {
    // 3.0 kg infant, D10W @ 10.8 mL/hr -> (10 * 10.8) / (6 * 3) = 108 / 18 = 6.0 mg/kg/min
    const gir = calculateGir({
      dextrosePercent: 10.0,
      rateMlHr: 10.8,
      weightKg: 3.0,
    });
    expect(gir).toBe(6.0);
  });

  it('calculates required infusion rate for desired GIR', () => {
    // Desired GIR 8.0 mg/kg/min, D10W, 2.5 kg -> (8 * 6 * 2.5) / 10 = 120 / 10 = 12.0 mL/hr
    const rate = calculateInfusionRateForGir(8.0, 10.0, 2.5);
    expect(rate).toBe(12.0);
  });

  it('calculates D10W 2 mL/kg mini-bolus volume', () => {
    expect(calculateD10wBolus(2.75)).toBe(5.5);
  });

  it('evaluates severe symptomatic hypoglycemia and recommends mini-bolus with GIR 6-8', () => {
    const res = evaluateNeonatalHypoglycemia({
      ageHours: 4,
      bloodGlucoseMgDl: 22,
      birthWeightKg: 3.2,
      currentWeightKg: 3.2,
      symptomsPresent: true,
      riskFactors: ['infant_of_diabetic_mother'],
    });

    expect(res.isHypoglycemic).toBe(true);
    expect(res.severityTier).toBe('severe_or_symptomatic');
    expect(res.miniBolusIndicated).toBe(true);
    expect(res.recommendedD10wBolusMl).toBe(6.4);
    expect(res.recommendedGirMgKgMin).toBe(6.0);
  });

  it('calculates WHO anti-seizure medication doses', () => {
    const doses = calculateNeonatalSeizureMedication(3.0);
    expect(doses.phenobarbitalInitialDoseMg).toBe(60.0); // 20 mg/kg * 3
    expect(doses.levetiracetamInitialDoseMg).toBe(120.0); // 40 mg/kg * 3
  });

  it('interprets aEEG background patterns correctly', () => {
    const cnv = interpretAeegPattern('continuous_normal_voltage');
    expect(cnv.category).toBe('normal');
    expect(cnv.isHighSeizureRisk).toBe(false);

    const bs = interpretAeegPattern('burst_suppression');
    expect(bs.category).toBe('severely_abnormal');
    expect(bs.isHighSeizureRisk).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal Hypoglycemia REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. V. Rao (Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Sister Anita NICU',
      role: 'nurse',
      password: 'temp-pass-nurse-nicu',
    });
    const nurseFirst = await login('nurse.nicu', 'temp-pass-nurse-nicu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-nicu',
      newPassword: PW,
    });
    nurse = await login('nurse.nicu', PW);

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

    // Preterm infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Sunita (Preterm 35w)',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 11111',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and validates hypoglycemia response', async () => {
    const res = await call('POST', '/api/neonatal-hypoglycemia/calculate', doctor, {
      ageHours: 6,
      bloodGlucoseMgDl: 28,
      birthWeightKg: 2.5,
      currentWeightKg: 2.5,
      symptomsPresent: true,
      fluidDextrosePercent: 10,
      fluidRateMlHr: 9,
      aeegPattern: 'continuous_low_voltage',
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.isHypoglycemic).toBe(true);
    expect(res.body.evalResult.miniBolusIndicated).toBe(true);
    expect(res.body.currentGir).toBe(6.0);
    expect(res.body.seizureDosing.phenobarbitalInitialDoseMg).toBe(50.0);
  });

  it('creates a neonatal hypoglycemia episode and audits the event', async () => {
    const res = await call('POST', '/api/neonatal-hypoglycemia/episodes', doctor, {
      patientId,
      evaluationDatetime: '2026-11-07T10:00',
      ageHours: 8,
      birthWeightKg: 2.6,
      currentWeightKg: 2.6,
      initialBloodGlucoseMgDl: 32,
      d10wBolusGivenMl: 5.2,
      fluidDextrosePercent: 10,
      fluidRateMlHr: 9.5,
      symptomsPresent: true,
      seizureActivityObserved: true,
      seizureType: 'electroclinical_clonic',
      aeegBackgroundPattern: 'burst_suppression',
      firstLineAsmGiven: true,
      phenobarbitalDoseMg: 52,
      status: 'active_infusion',
      clinicalNotes: 'IDM with refractory hypoglycemia and seizures. Started on D10W GIR 6.1 and Phenobarbital 52mg IV.',
    });

    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toContain('NHYP-');
    expect(res.body.episode.current_gir_mg_kg_min).toBe(6.09);

    const auditRow = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'neonatal_hypoglycemia.episode_create' AND entity = 'neonatal_hypoglycemia_episodes'`,
    ).get();
    expect(auditRow).toBeDefined();
  });

  it('allows nurses to log bedside glucose and GIR flowsheet checkpoints', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/neonatal-hypoglycemia/episodes', doctor, {
      patientId,
      evaluationDatetime: '2026-11-07T10:00',
      ageHours: 10,
      birthWeightKg: 3.0,
      currentWeightKg: 3.0,
      initialBloodGlucoseMgDl: 28,
      status: 'active_infusion',
    });
    const episodeId = epRes.body.episode.id;

    // 2. Nurse logs flowsheet entry with blood sugar 54 and GIR 6.0
    const logRes = await call('POST', `/api/neonatal-hypoglycemia/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T11:00',
      hoursOnProtocol: 1.0,
      bloodGlucoseMgDl: 54,
      fluidDextrosePercent: 10,
      fluidRateMlHr: 10.8,
      feedingVolumeMl: 20,
      feedingType: 'breast_milk',
      notes: 'Blood sugar normalized on D10W. Tolerated oral feed.',
    });

    expect(logRes.status).toBe(201);
    expect(logRes.body.calculatedGir).toBe(6.0);

    // Verify episode updated with new GIR
    const getRes = await call('GET', `/api/neonatal-hypoglycemia/episodes/${episodeId}`, doctor);
    expect(getRes.body.episode.current_gir_mg_kg_min).toBe(6.0);
    expect(getRes.body.logs.length).toBe(1);
  });

  it('prevents attender desk staff from creating hypoglycemia records (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/neonatal-hypoglycemia/episodes', attender, {
      patientId,
      evaluationDatetime: '2026-11-07T10:00',
      ageHours: 4,
      birthWeightKg: 3.0,
      currentWeightKg: 3.0,
      initialBloodGlucoseMgDl: 30,
    });
    expect(res.status).toBe(403);
  });
});
