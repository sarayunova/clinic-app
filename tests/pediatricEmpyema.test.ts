import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricEmpyema } from '../web/src/pediatricEmpyemaEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown
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

describe('Pediatric Empyema Engine (Pure Unit Tests)', () => {
  it('correctly stages simple Stage 1 parapneumonic effusion with normal biochemistry', () => {
    const res = evaluatePediatricEmpyema({
      ageYears: 3.5,
      weightKg: 15.0,
      stagingPhase: 'stage_1_exudative_simple',
      ultrasoundFindings: 'free_flowing_anechoic',
      pleuralFluidPh: 7.35,
      pleuralFluidGlucoseMgDl: 65.0,
      pleuralFluidLdhUL: 420.0,
      pleuralFluidAppearance: 'clear_serous',
      chestTubePlaced: true,
      chestTubeSizeFr: 10,
      intrapleuralFibrinolyticTherapy: 'not_indicated_antibiotics_only',
      dosesCompleted: 0,
      vatsDecorticationIndicated: false,
    });

    expect(res.isComplicatedEmpyema).toBe(false);
    expect(res.pleuralBiomarkersAbnormal).toBe(false);
    expect(res.calculatedRecommendedStage).toBe('stage_1_exudative_simple');
    expect(res.urgencyTier).toBe('chest_drain_antibiotic_medical');
    expect(res.vatsCriteriaMet).toBe(false);
  });

  it('identifies Stage 2 complicated empyema with low pH, low glucose, high LDH and calculates weight-based tPA/DNase dosing', () => {
    const res = evaluatePediatricEmpyema({
      ageYears: 4.0,
      weightKg: 16.5,
      stagingPhase: 'stage_2_fibrinopurulent_complicated',
      ultrasoundFindings: 'dense_multiloculated_honeycomb',
      pleuralFluidPh: 7.08,
      pleuralFluidGlucoseMgDl: 24.0,
      pleuralFluidLdhUL: 2850.0,
      pleuralFluidAppearance: 'frank_pus_purulent',
      chestTubePlaced: true,
      chestTubeSizeFr: 10,
      intrapleuralFibrinolyticTherapy: 'tpa_plus_dornase_alfa_twice_daily',
      dosesCompleted: 2,
      vatsDecorticationIndicated: false,
    });

    expect(res.isComplicatedEmpyema).toBe(true);
    expect(res.pleuralBiomarkersAbnormal).toBe(true);
    expect(res.calculatedRecommendedStage).toBe('stage_2_fibrinopurulent_complicated');
    expect(res.urgencyTier).toBe('intrapleural_fibrinolysis_active');
    expect(res.fibrinolyticDosing.tpaDoseMg).toBe(1.7); // 16.5 * 0.1 rounded to 1 dec = 1.7 mg
    expect(res.fibrinolyticDosing.dornaseAlfaDoseMg).toBe(5.0);
    expect(res.fibrinolyticDosing.dwellTimeHours).toBe(2);
    expect(res.alerts.some((a) => a.includes('ACIDIC PLEURAL FLUID'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('HYPOGLUCOPLEURIA'))).toBe(true);
  });

  it('triggers VATS surgical decortication for Stage 3 trapped lung or organizing peel', () => {
    const res = evaluatePediatricEmpyema({
      ageYears: 6.0,
      weightKg: 22.0,
      stagingPhase: 'stage_3_organizing_pleural_peel',
      ultrasoundFindings: 'thickened_visceral_pleura_trapped_lung',
      pleuralFluidPh: 7.02,
      pleuralFluidGlucoseMgDl: 18.0,
      pleuralFluidLdhUL: 3400.0,
      pleuralFluidAppearance: 'frank_pus_purulent',
      chestTubePlaced: true,
      chestTubeSizeFr: 12,
      intrapleuralFibrinolyticTherapy: 'tpa_plus_dornase_alfa_twice_daily',
      dosesCompleted: 6,
      vatsDecorticationIndicated: true,
    });

    expect(res.vatsCriteriaMet).toBe(true);
    expect(res.urgencyTier).toBe('vats_thoracoscopy_surgical');
    expect(res.urgencyTierLabel).toContain('VATS Video-Assisted Thoracoscopy');
    expect(res.alerts.some((a) => a.includes('SURGICAL INDICATION'))).toBe(true);
  });
});

describe('Pediatric Empyema Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.empyema',
      fullName: 'Dr. Vivek PediatricPulmonologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.empyema',
      fullName: 'Nurse Priya PICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.empyema', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.empyema', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.empyema',
      fullName: 'Attender Rakesh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.empyema', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.empyema', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav',
      dateOfBirth: '2022-05-10',
      phone: '9876543233',
      address: 'PICU Bed 2',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, create episode, update, and log drain flowsheet', async () => {
    // 1. Evaluate endpoint
    const preview = await call('POST', '/api/pediatric-empyema/evaluate', doctor, {
      ageYears: 4.0,
      weightKg: 16.5,
      stagingPhase: 'stage_2_fibrinopurulent_complicated',
      ultrasoundFindings: 'dense_multiloculated_honeycomb',
      pleuralFluidPh: 7.08,
      pleuralFluidGlucoseMgDl: 24.0,
      pleuralFluidLdhUL: 2850.0,
      pleuralFluidAppearance: 'frank_pus_purulent',
      chestTubePlaced: true,
      chestTubeSizeFr: 10,
      intrapleuralFibrinolyticTherapy: 'tpa_plus_dornase_alfa_twice_daily',
      dosesCompleted: 0,
      vatsDecorticationIndicated: false,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.isComplicatedEmpyema).toBe(true);
    expect(preview.body.evaluation.fibrinolyticDosing.tpaDoseMg).toBe(1.7);

    // 2. Create episode
    const created = await call('POST', '/api/pediatric-empyema/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T02:00:00',
      ageYears: 4.0,
      weightKg: 16.5,
      stagingPhase: 'stage_2_fibrinopurulent_complicated',
      ultrasoundFindings: 'dense_multiloculated_honeycomb',
      pleuralFluidPh: 7.08,
      pleuralFluidGlucoseMgDl: 24.0,
      pleuralFluidLdhUL: 2850.0,
      pleuralFluidAppearance: 'frank_pus_purulent',
      gramStainCultureIsolated: 'Streptococcus pneumoniae',
      chestTubePlaced: true,
      chestTubeSizeFr: 10,
      intrapleuralFibrinolyticTherapy: 'tpa_plus_dornase_alfa_twice_daily',
      dosesCompleted: 0,
      vatsDecorticationIndicated: false,
      status: 'chest_tube_insertion',
      clinicalNotes: '10 Fr pigtail drain inserted under ultrasound guidance.',
    });
    expect(created.status).toBe(200);
    const episodeId = created.body.episode.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Nurse logs flowsheet entry
    const logRes = await call('POST', `/api/pediatric-empyema/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:00:00',
      hoursFromDrainPlacement: 4.0,
      chestDrainOutputMl: 120.0,
      drainEffluentAppearance: 'purulent_thick_pus',
      airLeakGrade: 'none',
      temperatureCelsius: 38.2,
      respiratoryRate: 28,
      oxygenSaturationPct: 97,
      fibrinolyticInstilledDwellCompleted: true,
      notes: 'First dose of tPA/DNase completed with 2h clamp dwell.',
    });
    expect(logRes.status).toBe(200);
    expect(logRes.body.log.chest_drain_output_ml).toBe(120.0);

    // 4. Get episode details
    const detail = await call('GET', `/api/pediatric-empyema/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.episode_code).toMatch(/^EMPY-/);
    expect(detail.body.flowsheetLogs.length).toBe(1);

    // 5. Update episode status
    const updated = await call('PUT', `/api/pediatric-empyema/episodes/${episodeId}`, doctor, {
      patientId,
      onsetDatetime: '2026-11-08T02:00:00',
      ageYears: 4.0,
      weightKg: 16.5,
      stagingPhase: 'stage_2_fibrinopurulent_complicated',
      ultrasoundFindings: 'dense_multiloculated_honeycomb',
      pleuralFluidPh: 7.08,
      pleuralFluidGlucoseMgDl: 24.0,
      pleuralFluidLdhUL: 2850.0,
      pleuralFluidAppearance: 'frank_pus_purulent',
      gramStainCultureIsolated: 'Streptococcus pneumoniae',
      chestTubePlaced: true,
      chestTubeSizeFr: 10,
      intrapleuralFibrinolyticTherapy: 'tpa_plus_dornase_alfa_twice_daily',
      dosesCompleted: 2,
      vatsDecorticationIndicated: false,
      status: 'intrapleural_fibrinolysis_active',
      clinicalNotes: 'Intrapleural fibrinolysis ongoing with good clinical response.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.episode.status).toBe('intrapleural_fibrinolysis_active');
    expect(updated.body.episode.doses_completed).toBe(2);
  });

  it('blocks unauthenticated and attender attempts to manage empyema episodes', async () => {
    const unauth = await call('POST', '/api/pediatric-empyema/episodes', undefined, {
      patientId,
      onsetDatetime: '2026-11-08T02:00:00',
      ageYears: 4.0,
      weightKg: 16.5,
      stagingPhase: 'stage_2_fibrinopurulent_complicated',
      ultrasoundFindings: 'dense_multiloculated_honeycomb',
      pleuralFluidAppearance: 'frank_pus_purulent',
      intrapleuralFibrinolyticTherapy: 'tpa_plus_dornase_alfa_twice_daily',
    });
    expect(unauth.status).toBe(403);

    const attenderTry = await call('POST', '/api/pediatric-empyema/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T02:00:00',
      ageYears: 4.0,
      weightKg: 16.5,
      stagingPhase: 'stage_2_fibrinopurulent_complicated',
      ultrasoundFindings: 'dense_multiloculated_honeycomb',
      pleuralFluidAppearance: 'frank_pus_purulent',
      intrapleuralFibrinolyticTherapy: 'tpa_plus_dornase_alfa_twice_daily',
    });
    expect(attenderTry.status).toBe(403);
  });
});
