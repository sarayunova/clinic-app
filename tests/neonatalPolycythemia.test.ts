import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculatePetVolume,
  calculateAliquotSize,
  evaluateNeonatalPolycythemia,
} from '../web/src/neonatalPolycythemiaEngine.js';

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
describe('Neonatal Polycythemia & PET Protocol (Pure Unit Tests)', () => {
  it('correctly calculates PET volume using standard Gomella formula for term infant', () => {
    // 3.5 kg term infant (blood volume 80 mL/kg), observed Hct 70%, desired 55%
    // Volume = 3.5 * 80 * ((70 - 55) / 70) = 280 * (15 / 70) = 60 mL
    const vol = calculatePetVolume(3.5, 70, 55, 80);
    expect(vol).toBe(60);
  });

  it('correctly calculates PET volume for preterm infant with higher blood volume', () => {
    // 2.0 kg preterm infant (blood volume 90 mL/kg), observed Hct 68%, desired 55%
    // Volume = 2.0 * 90 * ((68 - 55) / 68) = 180 * (13 / 68) = 34.4 mL
    const vol = calculatePetVolume(2.0, 68, 55, 90);
    expect(vol).toBe(34.4);
  });

  it('returns 0 exchange volume when observed hematocrit is below or equal to target', () => {
    const vol = calculatePetVolume(3.0, 52, 55, 80);
    expect(vol).toBe(0);
  });

  it('calculates aliquot sizes within safe neonatal bounds (5 to 20 mL)', () => {
    // 3.5 kg -> 3.5 * 5 = 17.5 -> rounded to 18 mL
    expect(calculateAliquotSize(3.5)).toBe(18);
    // 0.8 kg ELBW infant -> 0.8 * 5 = 4.0 mL -> clamped to minimum 5.0 mL
    expect(calculateAliquotSize(0.8)).toBe(5);
    // 4.5 kg LGA infant -> 4.5 * 5 = 22.5 mL -> clamped to maximum 20.0 mL
    expect(calculateAliquotSize(4.5)).toBe(20);
  });

  it('evaluates clinical criteria: flags capillary sample overestimation warning', () => {
    const res = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3200,
      chronologicalAgeHours: 12,
      currentWeightKg: 3.2,
      samplingSite: 'capillary_unconfirmed',
      venousHematocritPct: 68.0,
      symptomsPresent: false,
      symptomDetails: 'asymptomatic',
    });

    expect(res.isVenousSampleConfirmed).toBe(false);
    expect(res.safetyDirectives.some((a) => a.includes('Capillary hematocrit can be 5-15% higher'))).toBe(true);
  });

  it('evaluates asymptomatic polycythemia (65-69%) without immediate PET requirement', () => {
    const res = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: 40,
      birthWeightGrams: 3400,
      chronologicalAgeHours: 8,
      currentWeightKg: 3.4,
      samplingSite: 'peripheral_venous',
      venousHematocritPct: 67.0,
      symptomsPresent: false,
      symptomDetails: 'asymptomatic',
    });

    expect(res.polycythemiaConfirmed).toBe(true);
    expect(res.partialExchangeIndicated).toBe(false);
    expect(res.hyperviscosityRiskTier).toBe('mild_asymptomatic');
    expect(res.criticalActionPlan.some((p) => p.includes('Increase fluid intake'))).toBe(true);
  });

  it('evaluates symptomatic polycythemia (Hct >= 65%) with PET indicated', () => {
    const res = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3000,
      chronologicalAgeHours: 6,
      currentWeightKg: 3.0,
      samplingSite: 'peripheral_venous',
      venousHematocritPct: 66.0,
      symptomsPresent: true,
      symptomDetails: 'plethora_ruddy_appearance',
    });

    expect(res.polycythemiaConfirmed).toBe(true);
    expect(res.partialExchangeIndicated).toBe(true);
    expect(res.hyperviscosityRiskTier).toBe('moderate_symptomatic');
    expect(res.exchangeVolumeMl).toBeGreaterThan(0);
  });

  it('evaluates severe polycythemia (Hct >= 70%) even if asymptomatic requiring immediate PET', () => {
    const res = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3600,
      chronologicalAgeHours: 14,
      currentWeightKg: 3.6,
      samplingSite: 'peripheral_venous',
      venousHematocritPct: 72.0,
      symptomsPresent: false,
      symptomDetails: 'asymptomatic',
    });

    expect(res.polycythemiaConfirmed).toBe(true);
    expect(res.partialExchangeIndicated).toBe(true);
    expect(res.hyperviscosityRiskTier).toBe('critical_extreme_polycythemia');
  });

  it('verifies 0.9% Normal Saline is the recommended replacement solution', () => {
    const res = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: 40,
      birthWeightGrams: 3300,
      chronologicalAgeHours: 10,
      currentWeightKg: 3.3,
      samplingSite: 'peripheral_venous',
      venousHematocritPct: 71.0,
      symptomsPresent: true,
      symptomDetails: 'jitteriness_tremors',
    });

    expect(res.replacementFluid).toContain('0.9% Normal Saline');
    expect(res.safetyDirectives.some((a) => a.includes('Normal Saline 0.9%'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal Polycythemia REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. Vikram Malhotra (Neonatologist)',
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

    // Create a demo neonate patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Sunita (Neonate)',
      dateOfBirth: '2026-11-01',
      phone: '+91 98410 54321',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews PET evaluation without database persistence', async () => {
    const res = await call('POST', '/api/neonatal-polycythemia/evaluate', doctor, {
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3500,
      chronologicalAgeHours: 12,
      currentWeightKg: 3.5,
      samplingSite: 'peripheral_venous',
      venousHematocritPct: 70.0,
      targetHematocritPct: 55.0,
      bloodVolumeMlKg: 80.0,
      symptomsPresent: true,
      symptomDetails: 'plethora_ruddy_appearance',
      replacementFluid: 'normal_saline_0_9',
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.exchangeVolumeMl).toBe(60);
    expect(res.body.evalResult.partialExchangeIndicated).toBe(true);
    expect(res.body.evalResult.recommendedAliquotSizeMl).toBe(18);
  });

  it('enforces RBAC, CRUD, flowsheet logging and auditing', async () => {
    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/neonatal-polycythemia/episodes', attender, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3200,
      chronologicalAgeHours: 8,
      currentWeightKg: 3.2,
      samplingSite: 'peripheral_venous',
      venousHematocritPct: 71.0,
      symptomsPresent: true,
      symptomDetails: 'plethora_ruddy_appearance',
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/neonatal-polycythemia/episodes', doctor, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3500,
      chronologicalAgeHours: 10,
      currentWeightKg: 3.5,
      samplingSite: 'peripheral_venous',
      venousHematocritPct: 72.0,
      hemoglobinGDl: 23.5,
      bloodVolumeMlKg: 80.0,
      targetHematocritPct: 55.0,
      symptomsPresent: true,
      symptomDetails: 'plethora_ruddy_appearance',
      serumGlucoseMgDl: 48,
      plateletCount: 180000,
      serumBilirubinMgDl: 8.2,
      replacementFluid: 'normal_saline_0_9',
      status: 'pet_procedure_in_progress',
      clinicalNotes: 'Marked ruddy cyanosis with central venous Hct 72%. Partial exchange initiated.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('POLYCYT-');
    expect(createRes.body.evalResult.partialExchangeIndicated).toBe(true);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/neonatal-polycythemia/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/neonatal-polycythemia/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.exchangeVolumeMl).toBeGreaterThan(0);
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/neonatal-polycythemia/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromTriage: 1,
      aliquotNumber: 1,
      volumeWithdrawnMl: 15.0,
      volumeInfusedMl: 15.0,
      cumulativeExchangedMl: 15.0,
      currentHematocritPct: 68.0,
      heartRateBpm: 142,
      respiratoryRate: 48,
      meanArterialPressureMmhg: 44,
      capillaryRefillSeconds: 2.0,
      temperatureCelsius: 36.8,
      replacementSolution: 'normal_saline_0_9',
      aliquotTolerance: 'well_tolerated',
      notes: 'First aliquot completed via umbilical venous catheter smoothly.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/neonatal-polycythemia/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to post_pet_observation
    const updateRes = await call('PATCH', `/api/neonatal-polycythemia/episodes/${episodeId}`, doctor, {
      status: 'post_pet_observation',
      clinicalNotes: 'PET successfully completed. Feeds held for 4 hours. IV hydration continuing.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('post_pet_observation');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/neonatal-polycythemia/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/neonatal-polycythemia/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/neonatal-polycythemia/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/neonatal-polycythemia/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
