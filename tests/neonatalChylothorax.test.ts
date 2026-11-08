import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateDrainageRateMlKgDay,
  evaluateNeonatalChylothorax,
} from '../web/src/neonatalChylothoraxEngine.js';

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
describe('Neonatal Chylothorax & Octreotide Protocol (Pure Unit Tests)', () => {
  it('correctly calculates drainage rate (mL/kg/day) and stratifies output severity', () => {
    // 3.0 kg infant, 72 mL in 24h = 24.0 mL/kg/day (high-output)
    const highRate = calculateDrainageRateMlKgDay(72, 3.0);
    expect(highRate).toBe(24.0);

    const highEval = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3000,
      chronologicalAgeDays: 5,
      currentWeightKg: 3.0,
      effusionLaterality: 'unilateral_right',
      etiology: 'congenital_idiopathic',
      pleuralTriglyceridesMgDl: 160,
      pleuralLymphocytePercent: 88,
      chylomicronPresence: true,
      chestTubeInserted: true,
      initial24hDrainageMl: 72,
      dietaryRegimen: 'nil_by_mouth_tpn',
      octreotidePrescribed: true,
      octreotideCurrentDoseMcgKgHr: 2.0,
      chemicalPleurodesisPerformed: false,
      surgicalLigationIndicated: false,
    });
    expect(highEval.drainageSeverityTier).toBe('high_output_gt_20');
    expect(highEval.octreotideIndicated).toBe(true);
    expect(highEval.surgicalRefractoryRisk).toBe(true);

    // 3.0 kg infant, 36 mL in 24h = 12.0 mL/kg/day (moderate-output)
    const modRate = calculateDrainageRateMlKgDay(36, 3.0);
    expect(modRate).toBe(12.0);

    const modEval = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3200,
      chronologicalAgeDays: 8,
      currentWeightKg: 3.0,
      effusionLaterality: 'unilateral_left',
      etiology: 'post_cardiothoracic_surgery',
      pleuralTriglyceridesMgDl: 140,
      pleuralLymphocytePercent: 82,
      chylomicronPresence: false,
      chestTubeInserted: true,
      initial24hDrainageMl: 36,
      dietaryRegimen: 'exclusive_mct_formula',
      octreotidePrescribed: false,
      octreotideCurrentDoseMcgKgHr: 0,
      chemicalPleurodesisPerformed: false,
      surgicalLigationIndicated: false,
    });
    expect(modEval.drainageSeverityTier).toBe('moderate_output_10_to_20');
    expect(modEval.octreotideIndicated).toBe(true);
    expect(modEval.recommendedOctreotideStartingDoseMcgKgHr).toBe(2.0);

    // 3.0 kg infant, 18 mL in 24h = 6.0 mL/kg/day (low-output)
    const lowRate = calculateDrainageRateMlKgDay(18, 3.0);
    expect(lowRate).toBe(6.0);
  });

  it('verifies diagnostic criteria by pleural triglycerides and lymphocytic predominance', () => {
    // Triglycerides > 110 mg/dL confirms chyle leak
    const tgEval = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3100,
      chronologicalAgeDays: 10,
      currentWeightKg: 3.1,
      effusionLaterality: 'bilateral',
      etiology: 'genetic_turner_noonan_trisomy21',
      pleuralTriglyceridesMgDl: 185,
      chylomicronPresence: false,
      chestTubeInserted: true,
      initial24hDrainageMl: 40,
      dietaryRegimen: 'exclusive_mct_formula',
      octreotidePrescribed: true,
      octreotideCurrentDoseMcgKgHr: 2.0,
      chemicalPleurodesisPerformed: false,
      surgicalLigationIndicated: false,
    });
    expect(tgEval.chylothoraxConfirmed).toBe(true);
    expect(tgEval.diagnosticCriteriaMet.some((c) => c.toLowerCase().includes('triglycerides > 110'))).toBe(true);

    // Non-fed infant: lymphocytes > 80% confirms chylothorax
    const lymphEval = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: 37,
      birthWeightGrams: 2800,
      chronologicalAgeDays: 3,
      currentWeightKg: 2.7,
      effusionLaterality: 'unilateral_right',
      etiology: 'congenital_idiopathic',
      pleuralLymphocytePercent: 92,
      chylomicronPresence: false,
      chestTubeInserted: true,
      initial24hDrainageMl: 30,
      dietaryRegimen: 'nil_by_mouth_tpn',
      octreotidePrescribed: true,
      octreotideCurrentDoseMcgKgHr: 2.0,
      chemicalPleurodesisPerformed: false,
      surgicalLigationIndicated: false,
    });
    expect(lymphEval.chylothoraxConfirmed).toBe(true);
    expect(lymphEval.diagnosticCriteriaMet.some((c) => c.includes('lymphocytosis > 80%'))).toBe(true);
  });

  it('triggers critical alert when unrestricted standard feeding is prescribed', () => {
    const errorFeed = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: 40,
      birthWeightGrams: 3400,
      chronologicalAgeDays: 6,
      currentWeightKg: 3.3,
      effusionLaterality: 'unilateral_right',
      etiology: 'congenital_idiopathic',
      pleuralTriglyceridesMgDl: 150,
      chylomicronPresence: true,
      chestTubeInserted: true,
      initial24hDrainageMl: 50,
      dietaryRegimen: 'unrestricted_breast_milk_formula', // CONTRAINDICATED
      octreotidePrescribed: false,
      octreotideCurrentDoseMcgKgHr: 0,
      chemicalPleurodesisPerformed: false,
      surgicalLigationIndicated: false,
    });
    expect(errorFeed.dietaryRecommendation).toContain('CONTRAINDICATED');
    expect(errorFeed.criticalActionPlan.some((p) => p.includes('halt unrestricted feeding'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal Chylothorax REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neochylo',
      fullName: 'Dr. Anand Joshi (Neonatology)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicuchylo',
      fullName: 'Nurse Kavita (NICU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.nicuchylo', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.nicuchylo', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.nicuchylo',
      fullName: 'NICU Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.nicuchylo', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.nicuchylo', PW);

    // Create a demo neonate patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Anita (Neonate)',
      dateOfBirth: '2026-11-02',
      phone: '+91 98450 11001',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews chylothorax evaluation without database persistence', async () => {
    const res = await call('POST', '/api/neonatal-chylothorax/evaluate', doctor, {
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3000,
      chronologicalAgeDays: 5,
      currentWeightKg: 3.0,
      effusionLaterality: 'unilateral_right',
      etiology: 'congenital_idiopathic',
      pleuralTriglyceridesMgDl: 168,
      pleuralLymphocytePercent: 86,
      chylomicronPresence: true,
      initial24hDrainageMl: 66,
      dietaryRegimen: 'nil_by_mouth_tpn',
      octreotidePrescribed: true,
      octreotideCurrentDoseMcgKgHr: 2.0,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.chylothoraxConfirmed).toBe(true);
    expect(res.body.evalResult.drainageSeverityTier).toBe('high_output_gt_20');
    expect(res.body.evalResult.octreotideIndicated).toBe(true);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const diagTime = new Date().toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/neonatal-chylothorax/episodes', attender, {
      patientId,
      diagnosisDatetime: diagTime,
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3000,
      chronologicalAgeDays: 5,
      currentWeightKg: 3.0,
      effusionLaterality: 'unilateral_right',
      etiology: 'congenital_idiopathic',
      initial24hDrainageMl: 60,
      dietaryRegimen: 'nil_by_mouth_tpn',
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/neonatal-chylothorax/episodes', doctor, {
      patientId,
      diagnosisDatetime: diagTime,
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3000,
      chronologicalAgeDays: 5,
      currentWeightKg: 3.0,
      effusionLaterality: 'unilateral_right',
      etiology: 'congenital_idiopathic',
      pleuralTriglyceridesMgDl: 172,
      pleuralTotalCellsPerMicroliter: 4500,
      pleuralLymphocytePercent: 88,
      pleuralCholesterolMgDl: 70,
      chylomicronPresence: true,
      chestTubeInserted: true,
      initial24hDrainageMl: 72,
      dietaryRegimen: 'nil_by_mouth_tpn',
      octreotidePrescribed: true,
      octreotideCurrentDoseMcgKgHr: 2.0,
      chemicalPleurodesisPerformed: false,
      surgicalLigationIndicated: false,
      status: 'acute_chest_tube_drainage',
      clinicalNotes: 'Right pleural effusion confirmed chylothorax. High-output drainage 24 mL/kg/d. Started on Octreotide 2 µg/kg/hr.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('CHYLO-');
    expect(createRes.body.evalResult.chylothoraxConfirmed).toBe(true);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/neonatal-chylothorax/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/neonatal-chylothorax/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.drainageSeverityTier).toBe('high_output_gt_20');
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/neonatal-chylothorax/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      daysFromDiagnosis: 2,
      drainage24hMl: 39,
      octreotideDoseMcgKgHr: 3.0,
      bloodGlucoseMgDl: 92,
      serumSodiumMmolL: 139,
      fluidAppearance: 'straw_colored_serous',
      notes: 'Day 2 Octreotide: Output reduced to 13 mL/kg/day. Color clearing from milky to straw.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/neonatal-chylothorax/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to octreotide_titration
    const updateRes = await call('PATCH', `/api/neonatal-chylothorax/episodes/${episodeId}`, doctor, {
      status: 'octreotide_titration',
      octreotideCurrentDoseMcgKgHr: 3.0,
      clinicalNotes: 'Drainage trending down nicely. Titrated to 3 µg/kg/hr.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('octreotide_titration');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/neonatal-chylothorax/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/neonatal-chylothorax/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/neonatal-chylothorax/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/neonatal-chylothorax/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
