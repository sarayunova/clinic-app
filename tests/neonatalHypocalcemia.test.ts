import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateCalciumGluconateBolus,
  calculateCalciumMaintenance,
  calculateMagnesiumBolus,
  evaluateNeonatalHypocalcemia,
} from '../web/src/neonatalHypocalcemiaEngine.js';

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
describe('Neonatal Hypocalcemia & Electrolyte Protocol (Pure Unit Tests)', () => {
  it('correctly calculates 10% Calcium Gluconate acute bolus and caps at 10 mL', () => {
    // 1.5 kg neonate: 1.5 * 2.0 = 3.0 mL
    expect(calculateCalciumGluconateBolus(1.5)).toBe(3.0);

    // 3.2 kg neonate: 3.2 * 2.0 = 6.4 mL
    expect(calculateCalciumGluconateBolus(3.2)).toBe(6.4);

    // 6.0 kg infant: capped at 10.0 mL
    expect(calculateCalciumGluconateBolus(6.0)).toBe(10.0);
  });

  it('correctly calculates 24-hour maintenance calcium gluconate requirements', () => {
    // 2.0 kg neonate at default 400 mg/kg/day = 800 mg/day (8.0 mL/day of 10% solution)
    const maint = calculateCalciumMaintenance(2.0, 400);
    expect(maint.doseMgPerDay).toBe(800);
    expect(maint.volumeMlPerDay).toBe(8.0);
  });

  it('correctly calculates 50% Magnesium Sulfate dose for hypomagnesemia', () => {
    // 2.5 kg neonate: 2.5 * 0.2 mL/kg = 0.5 mL (100 mg/kg)
    expect(calculateMagnesiumBolus(2.5)).toBe(0.5);
    // 1.25 kg preterm: 1.25 * 0.2 = 0.25 mL
    expect(calculateMagnesiumBolus(1.25)).toBe(0.25);
  });

  it('evaluates early-onset symptomatic hypocalcemia in preterm infant', () => {
    const res = evaluateNeonatalHypocalcemia({
      gestationalAgeWeeks: 32,
      birthWeightGrams: 1600,
      chronologicalAgeHours: 24,
      currentWeightKg: 1.55,
      etiologyCategory: 'prematurity_respiratory_distress',
      ionizedCalciumMmolL: 0.82,
      totalCalciumMgDl: 6.2,
      serumMagnesiumMgDl: 1.8,
      symptomsPresent: true,
      symptomDetails: 'hypocalcemic_seizures',
      ecgQtcSeconds: 0.48,
    });

    expect(res.hypocalcemiaConfirmed).toBe(true);
    expect(res.isPreterm).toBe(true);
    expect(res.onsetTiming).toBe('early_onset_le_72h');
    expect(res.totalCalciumThresholdMgDl).toBe(7.0);
    expect(res.emergencyBolusIndicated).toBe(true);
    expect(res.calciumGluconate10pctBolusMl).toBe(3.1);
    expect(res.concurrentHypomagnesemia).toBe(false);
    expect(res.bradycardiaWarning).toContain('< 100 bpm');
    expect(res.criticalActionPlan[0]).toContain('10% Calcium Gluconate IV bolus');
  });

  it('evaluates late-onset hypocalcemia with concurrent hypomagnesemia', () => {
    const res = evaluateNeonatalHypocalcemia({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3400,
      chronologicalAgeHours: 96,
      currentWeightKg: 3.3,
      etiologyCategory: 'hypomagnesemia_induced',
      ionizedCalciumMmolL: 0.88,
      totalCalciumMgDl: 7.1,
      serumMagnesiumMgDl: 1.1, // < 1.5 mg/dL
      symptomsPresent: true,
      symptomDetails: 'tetany_carpopedal_spasm',
    });

    expect(res.hypocalcemiaConfirmed).toBe(true);
    expect(res.isPreterm).toBe(false);
    expect(res.onsetTiming).toBe('late_onset_gt_72h');
    expect(res.concurrentHypomagnesemia).toBe(true);
    expect(res.magnesiumSulfate50pctDoseMl).toBe(0.66);
    expect(res.criticalActionPlan.some((step) => step.includes('Replenish Magnesium'))).toBe(true);
  });

  it('evaluates normocalcemic infant without requiring emergency intervention', () => {
    const res = evaluateNeonatalHypocalcemia({
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3100,
      chronologicalAgeHours: 48,
      currentWeightKg: 3.0,
      etiologyCategory: 'idiopathic_other',
      ionizedCalciumMmolL: 1.25,
      totalCalciumMgDl: 9.4,
      serumMagnesiumMgDl: 2.0,
      symptomsPresent: false,
      symptomDetails: 'asymptomatic',
    });

    expect(res.hypocalcemiaConfirmed).toBe(false);
    expect(res.emergencyBolusIndicated).toBe(false);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal Hypocalcemia REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. S. Kulkarni (Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Nurse Kavita (NICU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.nicu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.nicu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.nicu',
      fullName: 'NICU Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.nicu', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.nicu', PW);

    // Create a demo patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Radhika (Hypocalcemia)',
      dateOfBirth: '2026-11-01',
      phone: '+91 98765 33333',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('evaluates hypocalcemia preview without database persistence', async () => {
    const res = await call('POST', '/api/neonatal-hypocalcemia/evaluate', doctor, {
      gestationalAgeWeeks: 30,
      birthWeightGrams: 1400,
      chronologicalAgeHours: 36,
      currentWeightKg: 1.35,
      etiologyCategory: 'prematurity_respiratory_distress',
      ionizedCalciumMmolL: 0.85,
      totalCalciumMgDl: 6.4,
      serumMagnesiumMgDl: 1.9,
      symptomsPresent: true,
      symptomDetails: 'jitteriness_hyperreflexia',
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.hypocalcemiaConfirmed).toBe(true);
    expect(res.body.evalResult.calciumGluconate10pctBolusMl).toBe(2.7);
  });

  it('creates, retrieves, logs flowsheet, updates, and deletes episode with strict RBAC', async () => {
    // 1. Attender cannot create an episode (403)
    const attenderCreate = await call('POST', '/api/neonatal-hypocalcemia/episodes', attender, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 34,
      birthWeightGrams: 2100,
      chronologicalAgeHours: 18,
      currentWeightKg: 2.0,
      etiologyCategory: 'infant_of_diabetic_mother_idm',
      ionizedCalciumMmolL: 0.79,
      totalCalciumMgDl: 6.0,
      serumMagnesiumMgDl: 1.4,
      symptomsPresent: true,
      symptomDetails: 'tetany_carpopedal_spasm',
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/neonatal-hypocalcemia/episodes', doctor, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 34,
      birthWeightGrams: 2100,
      chronologicalAgeHours: 18,
      currentWeightKg: 2.0,
      etiologyCategory: 'infant_of_diabetic_mother_idm',
      ionizedCalciumMmolL: 0.79,
      totalCalciumMgDl: 6.0,
      serumMagnesiumMgDl: 1.4,
      symptomsPresent: true,
      symptomDetails: 'tetany_carpopedal_spasm',
      status: 'acute_iv_correction',
      clinicalNotes: 'Initiated 10% calcium gluconate bolus under continuous ECG',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('HYPOCAL-');
    expect(createRes.body.episode.calcium_gluconate_10pct_bolus_ml).toBe(4.0);

    // 3. Nurse lists episodes (200)
    const listRes = await call('GET', `/api/neonatal-hypocalcemia/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Nurse adds a flowsheet observation log
    const logRes = await call('POST', `/api/neonatal-hypocalcemia/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromInitiation: 1.0,
      heartRateBpm: 142,
      ionizedCalciumMmolL: 0.98,
      totalCalciumMgDl: 7.2,
      serumMagnesiumMgDl: 1.6,
      calciumInfusionRateMlHr: 0.35,
      ivSiteCondition: 'patent_no_extravasation',
      clinicalNeuromuscularState: 'mild_tremor_on_handling',
      ecgRhythmStrip: 'normal_sinus_rhythm',
      notes: 'No bradycardia, twitching resolving nicely',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 5. Get episode by ID
    const getRes = await call('GET', `/api/neonatal-hypocalcemia/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.logs.length).toBe(1);
    expect(getRes.body.evalResult).toBeDefined();

    // 6. Doctor updates episode status
    const updateRes = await call('PATCH', `/api/neonatal-hypocalcemia/episodes/${episodeId}`, doctor, {
      status: 'eucalcemic_resolved',
      clinicalNotes: 'Serum calcium normalized to 1.15 mmol/L. Discharged to oral feeds.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('eucalcemic_resolved');

    // 7. Nurse cannot delete episode (403)
    const nurseDel = await call('DELETE', `/api/neonatal-hypocalcemia/episodes/${episodeId}`, nurse);
    expect(nurseDel.status).toBe(403);

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/neonatal-hypocalcemia/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/neonatal-hypocalcemia/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
