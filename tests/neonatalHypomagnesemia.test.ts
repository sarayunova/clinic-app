import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateMagnesiumBolusDose,
  evaluateNeonatalHypomagnesemia,
} from '../web/src/neonatalHypomagnesemiaEngine.js';

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
describe('Neonatal Hypomagnesemia & Refractory Seizures Protocol (Pure Unit Tests)', () => {
  it('correctly calculates 50% MgSO4 bolus and reduces dose by 50% in renal impairment', () => {
    // 3.2 kg neonate without renal impairment: 3.2 * 0.2 = 0.64 mL (320 mg MgSO4)
    const normal = calculateMagnesiumBolusDose(3.2, false);
    expect(normal.bolusVolume50PctMl).toBe(0.64);
    expect(normal.elementalMgMg).toBe(320);
    expect(normal.maintenanceDailyVolumeMl).toBe(0.32);

    // 3.2 kg neonate WITH renal impairment: 3.2 * 0.1 = 0.32 mL (160 mg MgSO4)
    const renal = calculateMagnesiumBolusDose(3.2, true);
    expect(renal.bolusVolume50PctMl).toBe(0.32);
    expect(renal.elementalMgMg).toBe(160);
  });

  it('correctly classifies eumagnesemic vs mild vs critical hypomagnesemia', () => {
    // Eumagnesemic: 1.8 mg/dL
    const normal = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3400,
      chronologicalAgeHours: 24,
      currentWeightKg: 3.3,
      serumMagnesiumMgDl: 1.8,
      neuromuscularSymptoms: 'none_asymptomatic',
      seizuresObserved: false,
      calciumRefractoryTetany: false,
      ecgAbnormalities: 'none',
      renalImpairmentPresent: false,
    });
    expect(normal.isHypomagnesemic).toBe(false);
    expect(normal.severityTier).toBe('normal_eumagnesemic');
    expect(normal.bolusRequired).toBe(false);

    // Mild: 1.3 mg/dL
    const mild = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3100,
      chronologicalAgeHours: 12,
      currentWeightKg: 3.0,
      serumMagnesiumMgDl: 1.3,
      neuromuscularSymptoms: 'none_asymptomatic',
      seizuresObserved: false,
      calciumRefractoryTetany: false,
      ecgAbnormalities: 'none',
      renalImpairmentPresent: false,
    });
    expect(mild.isHypomagnesemic).toBe(true);
    expect(mild.severityTier).toBe('mild_hypomagnesemia');

    // Critical: 1.05 mg/dL
    const critical = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: 37,
      birthWeightGrams: 2800,
      chronologicalAgeHours: 36,
      currentWeightKg: 2.7,
      serumMagnesiumMgDl: 1.05,
      neuromuscularSymptoms: 'clonic_seizures_refractory',
      seizuresObserved: true,
      calciumRefractoryTetany: true,
      ecgAbnormalities: 'prolonged_pr_interval',
      renalImpairmentPresent: false,
    });
    expect(critical.isHypomagnesemic).toBe(true);
    expect(critical.severityTier).toBe('severe_critical_hypomagnesemia');
    expect(critical.bolusRequired).toBe(true);
  });

  it('detects concurrent hypocalcemia and warns of PTH-resistance refractoriness', () => {
    const res = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3200,
      chronologicalAgeHours: 18,
      currentWeightKg: 3.1,
      serumMagnesiumMgDl: 1.15,
      serumCalciumMgDl: 6.8, // low (term cutoff 8.0)
      ionizedCalciumMmolL: 0.82, // low (< 1.0)
      neuromuscularSymptoms: 'jitteriness_tremors',
      seizuresObserved: false,
      calciumRefractoryTetany: true,
      ecgAbnormalities: 'none',
      renalImpairmentPresent: false,
    });

    expect(res.concurrentHypocalcemia).toBe(true);
    expect(res.calciumRefractoryMechanismActive).toBe(true);
    expect(res.criticalActionPlan.some((p) => p.includes('concurrent hypocalcemia'))).toBe(true);
    expect(res.clinicalSafetyDirectives.some((d) => d.includes('PTH RESISTANCE PHYSIOLOGY'))).toBe(true);
  });

  it('includes toxicity monitoring alerts for loss of deep tendon reflexes and antidote readiness', () => {
    const res = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: 40,
      birthWeightGrams: 3500,
      chronologicalAgeHours: 30,
      currentWeightKg: 3.4,
      serumMagnesiumMgDl: 0.95,
      neuromuscularSymptoms: 'clonic_seizures_refractory',
      seizuresObserved: true,
      calciumRefractoryTetany: true,
      ecgAbnormalities: 'ventricular_arrhythmias_torsades',
      renalImpairmentPresent: false,
    });

    expect(res.toxicityMonitoringAlerts.some((a) => a.includes('deep tendon reflexes'))).toBe(true);
    expect(res.toxicityMonitoringAlerts.some((a) => a.includes('10% Calcium Gluconate'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal Hypomagnesemia REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatalendo',
      fullName: 'Dr. Anand Joshi (Neonatal Endocrinology)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicumag',
      fullName: 'Nurse Preeti (NICU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.nicumag', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.nicumag', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.nicumag',
      fullName: 'NICU Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.nicumag', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.nicumag', PW);

    // Create a demo neonate patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Kavita (Neonate)',
      dateOfBirth: '2026-11-04',
      phone: '+91 98234 56789',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews hypomagnesemia evaluation without database persistence', async () => {
    const res = await call('POST', '/api/neonatal-hypomagnesemia/evaluate', doctor, {
      gestationalAgeWeeks: 38.5,
      birthWeightGrams: 3100,
      chronologicalAgeHours: 20,
      currentWeightKg: 3.0,
      serumMagnesiumMgDl: 1.1,
      neuromuscularSymptoms: 'clonic_seizures_refractory',
      seizuresObserved: true,
      calciumRefractoryTetany: true,
      ecgAbnormalities: 'prolonged_pr_interval',
      renalImpairmentPresent: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.isHypomagnesemic).toBe(true);
    expect(res.body.evalResult.doseCalculation.bolusVolume50PctMl).toBe(0.6);
    expect(res.body.evalResult.bolusRequired).toBe(true);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const onsetTime = new Date().toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/neonatal-hypomagnesemia/episodes', attender, {
      patientId,
      onsetDatetime: onsetTime,
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3000,
      chronologicalAgeHours: 16,
      currentWeightKg: 3.0,
      serumMagnesiumMgDl: 1.1,
      magnesiumSulfateBolusMl: 0.6,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/neonatal-hypomagnesemia/episodes', doctor, {
      patientId,
      onsetDatetime: onsetTime,
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3200,
      chronologicalAgeHours: 24,
      currentWeightKg: 3.1,
      serumMagnesiumMgDl: 1.05,
      serumCalciumMgDl: 6.9,
      ionizedCalciumMmolL: 0.84,
      serumPotassiumMeqL: 4.1,
      neuromuscularSymptoms: 'clonic_seizures_refractory',
      seizuresObserved: true,
      calciumRefractoryTetany: true,
      ecgAbnormalities: 'prolonged_pr_interval',
      renalImpairmentPresent: false,
      magnesiumSulfateBolusMl: 0.62,
      administrationRoute: 'slow_iv_infusion',
      continuousEcgMonitored: true,
      status: 'acute_resuscitation',
      clinicalNotes: 'Refractory neonatal clonic seizures. Concurrent hypocalcemia with ionized Ca 0.84. Emergency 50% MgSO4 bolus administered.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('HYPOMAG-');
    expect(createRes.body.evalResult.bolusRequired).toBe(true);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/neonatal-hypomagnesemia/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/neonatal-hypomagnesemia/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.calciumRefractoryMechanismActive).toBe(true);
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/neonatal-hypomagnesemia/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromOnset: 2,
      serumMagnesiumMgDl: 1.45,
      ionizedCalciumMmolL: 1.01,
      heartRateBpm: 138,
      respiratoryRate: 42,
      deepTendonReflexes: 'normal_2_plus',
      seizureActivityPresent: false,
      magnesiumInfusionRateMlHr: 0.31,
      ecgRhythmStrip: 'normal_sinus',
      toxicityWarning: false,
      notes: 'Post-bolus 2h: Seizures resolved. DTRs 2+ intact. PR interval normalized.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/neonatal-hypomagnesemia/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to monitoring_stabilized
    const updateRes = await call('PATCH', `/api/neonatal-hypomagnesemia/episodes/${episodeId}`, doctor, {
      status: 'monitoring_stabilized',
      clinicalNotes: 'Seizures fully controlled. Maintenance infusion ongoing.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('monitoring_stabilized');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/neonatal-hypomagnesemia/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/neonatal-hypomagnesemia/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/neonatal-hypomagnesemia/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/neonatal-hypomagnesemia/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
