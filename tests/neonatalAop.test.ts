import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  calculatePostConceptionalAge,
  evaluateNeonatalAop,
} from '../web/src/neonatalAopEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
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

describe('Neonatal AOP Engine (Pure Unit Tests)', () => {
  it('correctly calculates Post-Conceptional Age (PCA) and Caffeine Citrate loading & maintenance doses', () => {
    // 30 weeks GA + 14 days = 32.0 weeks PCA
    const pca = calculatePostConceptionalAge(30.0, 14);
    expect(pca).toBe(32.0);

    const evalResult = evaluateNeonatalAop({
      gestationalAgeWeeks: 30.0,
      chronologicalAgeDays: 14,
      currentWeightKg: 1.4,
      apneaSubtype: 'mixed',
      apneaFrequencyPer24h: 3,
      lowestHeartRateBpm: 76,
      lowestSpo2Percent: 83,
      stimulationRequired: 'tactile_gentle',
      caffeineCitrateActive: true,
      caffeineLoadingDoseMgKg: 20.0,
      caffeineMaintenanceDoseMgKgDay: 7.5,
      serumCaffeineLevelMcgMl: 14.5,
      secondaryCausesExcluded: true,
      respiratorySupportMode: 'bubble_cpap',
      cpapPeepCmh2o: 5.0,
      apneaFreeDaysCount: 2,
    });

    expect(evalResult.postConceptionalAgeWeeks).toBe(32.0);
    expect(evalResult.apneaSeverityTier).toBe('moderate');
    expect(evalResult.caffeineDosing.recommendedLoadingDoseMg).toBe(28.0); // 20 * 1.4
    expect(evalResult.caffeineDosing.recommendedDailyMaintenanceMg).toBe(10.5); // 7.5 * 1.4
    expect(evalResult.therapeuticDrugMonitoring?.status).toBe('target_therapeutic');
    expect(evalResult.weaningEligibility.eligible).toBe(false); // PCA 32.0 < 33.5
  });

  it('correctly determines weaning eligibility when PCA >= 33.5 and apnea-free >= 5 days', () => {
    const weaningEval = evaluateNeonatalAop({
      gestationalAgeWeeks: 29.0,
      chronologicalAgeDays: 35, // PCA = 34.0 weeks
      currentWeightKg: 1.95,
      apneaSubtype: 'central',
      apneaFrequencyPer24h: 0,
      stimulationRequired: 'self_resolved',
      caffeineCitrateActive: true,
      caffeineLoadingDoseMgKg: 20.0,
      caffeineMaintenanceDoseMgKgDay: 5.0,
      secondaryCausesExcluded: true,
      respiratorySupportMode: 'room_air',
      apneaFreeDaysCount: 6,
    });

    expect(weaningEval.postConceptionalAgeWeeks).toBe(34.0);
    expect(weaningEval.weaningEligibility.eligible).toBe(true);
    expect(weaningEval.weaningEligibility.reason).toContain('Eligible for caffeine citrate discontinuation');
  });

  it('triggers toxicity alerts for supratherapeutic or toxic caffeine serum levels', () => {
    const toxicEval = evaluateNeonatalAop({
      gestationalAgeWeeks: 31.0,
      chronologicalAgeDays: 10,
      currentWeightKg: 1.5,
      apneaSubtype: 'central',
      apneaFrequencyPer24h: 1,
      stimulationRequired: 'self_resolved',
      caffeineCitrateActive: true,
      caffeineLoadingDoseMgKg: 20.0,
      caffeineMaintenanceDoseMgKgDay: 10.0,
      serumCaffeineLevelMcgMl: 34.0, // Toxic > 30
      secondaryCausesExcluded: true,
      respiratorySupportMode: 'room_air',
      apneaFreeDaysCount: 1,
    });

    expect(toxicEval.therapeuticDrugMonitoring?.status).toBe('toxic');
    expect(toxicEval.alerts.some(a => a.includes('TOXICITY RISK'))).toBe(true);
  });
});

describe('Neonatal AOP REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.aop',
      fullName: 'Dr. Neha Neonatologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.aop',
      fullName: 'Nurse Neetu NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.aop', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.aop', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.aop',
      fullName: 'Attender Ajay',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.aop', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.aop', PW);

    // Create a preterm newborn patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby Boy Rao',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 43210',
      address: 'NICU Pod 1 Bed 4',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('previews AOP evaluation without database persistence', async () => {
    const res = await call('POST', '/api/neonatal-aop/evaluate', doctor, {
      gestationalAgeWeeks: 30,
      chronologicalAgeDays: 8,
      currentWeightKg: 1.3,
      apneaSubtype: 'mixed',
      apneaFrequencyPer24h: 4,
      lowestHeartRateBpm: 72,
      lowestSpo2Percent: 80,
      stimulationRequired: 'tactile_gentle',
      caffeineLoadingDoseMgKg: 20,
      caffeineMaintenanceDoseMgKgDay: 7.5,
      respiratorySupportMode: 'bubble_cpap',
      apneaFreeDaysCount: 0,
    });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.postConceptionalAgeWeeks).toBe(31.1);
    expect(res.body.evaluation.caffeineDosing.recommendedLoadingDoseMg).toBe(26.0);
  });

  it('creates an AOP episode, lists it, and updates status', async () => {
    const createRes = await call('POST', '/api/neonatal-aop/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T06:00:00',
      gestationalAgeWeeks: 30.5,
      chronologicalAgeDays: 7,
      currentWeightKg: 1.35,
      apneaSubtype: 'mixed',
      apneaFrequencyPer24h: 3,
      bradycardiaPresent: true,
      lowestHeartRateBpm: 75,
      desaturationPresent: true,
      lowestSpo2Percent: 82,
      stimulationRequired: 'tactile_gentle',
      caffeineCitrateActive: true,
      caffeineLoadingDoseMgKg: 20.0,
      caffeineMaintenanceDoseMgKgDay: 7.5,
      serumCaffeineLevelMcgMl: 13.0,
      secondaryCausesExcluded: true,
      respiratorySupportMode: 'bubble_cpap',
      cpapPeepCmh2o: 5.0,
      weaningEligible: false,
      apneaFreeDaysCount: 1,
      status: 'active_treatment',
      clinicalNotes: 'Initial caffeine loading administered smoothly.',
    });

    expect(createRes.status).toBe(201);
    const { episodeId, episodeCode } = createRes.body;
    expect(episodeId).toBeGreaterThan(0);
    expect(episodeCode).toMatch(/^AOP-\d+-\d+$/);

    // List episodes
    const listRes = await call('GET', `/api/neonatal-aop/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);
    expect(listRes.body.episodes[0].caffeine_citrate_active).toBe(true);

    // Update status to weaning phase
    const updateRes = await call('PATCH', `/api/neonatal-aop/episodes/${episodeId}/status`, doctor, {
      status: 'weaning_phase',
      apneaFreeDaysCount: 5,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
  });

  it('records, retrieves, and deletes serial flowsheet logs', async () => {
    const createRes = await call('POST', '/api/neonatal-aop/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T06:00:00',
      gestationalAgeWeeks: 31.0,
      chronologicalAgeDays: 10,
      currentWeightKg: 1.45,
      apneaSubtype: 'central',
      apneaFrequencyPer24h: 2,
      bradycardiaPresent: true,
      lowestHeartRateBpm: 78,
      desaturationPresent: true,
      lowestSpo2Percent: 85,
      stimulationRequired: 'tactile_gentle',
      caffeineCitrateActive: true,
      caffeineLoadingDoseMgKg: 20.0,
      caffeineMaintenanceDoseMgKgDay: 7.5,
      secondaryCausesExcluded: true,
      respiratorySupportMode: 'bubble_cpap',
      status: 'active_treatment',
    });
    const { episodeId } = createRes.body;

    // Add flowsheet log by nurse
    const logRes = await call('POST', `/api/neonatal-aop/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T08:00:00',
      apneaEventsCountInShift: 1,
      bradycardiaEventsCount: 1,
      desaturationEventsCount: 1,
      lowestHeartRateBpm: 78,
      lowestSpo2Percent: 84,
      stimulationModeUsed: 'tactile_rubbing',
      caffeineDoseGivenMg: 10.8,
      currentRespiratorySupport: 'Bubble CPAP 5 cmH2O',
      caffeineToxicitySigns: false,
      notes: 'Infant responded rapidly to gentle sole rubbing.',
    });
    expect(logRes.status).toBe(201);
    const { logId } = logRes.body;

    // Get episode with flowsheet
    const detailRes = await call('GET', `/api/neonatal-aop/episodes/${episodeId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.flowsheet.length).toBe(1);
    expect(detailRes.body.flowsheet[0].caffeine_dose_given_mg).toBe(10.8);

    // Delete flowsheet log
    const delRes = await call('DELETE', `/api/neonatal-aop/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delRes.status).toBe(200);

    const postDelRes = await call('GET', `/api/neonatal-aop/episodes/${episodeId}/flowsheet-logs`, doctor);
    expect(postDelRes.body.logs.length).toBe(0);
  });

  it('enforces RBAC permissions: attender cannot create episodes or log flowsheets', async () => {
    const createRes = await call('POST', '/api/neonatal-aop/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T06:00:00',
      gestationalAgeWeeks: 30.0,
      chronologicalAgeDays: 5,
      currentWeightKg: 1.2,
      apneaSubtype: 'mixed',
      stimulationRequired: 'tactile_gentle',
      respiratorySupportMode: 'room_air',
    });
    expect(createRes.status).toBe(403);
  });
});
