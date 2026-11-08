import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  calculateSilvermanAndersonScore,
  evaluateNeonatalTtn,
} from '../web/src/neonatalTtnEngine.js';

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

describe('Neonatal TTN Engine (Pure Unit Tests)', () => {
  it('correctly calculates Silverman-Anderson Retraction Score and classifies severity', () => {
    // Synchronized (0), just visible lower (1), marked xiphoid (2), minimal flaring (1), naked-ear grunt (2) = 6 (Moderate)
    const score = calculateSilvermanAndersonScore({
      chestRetractionUpper: 0,
      chestRetractionLower: 1,
      xiphoidRetraction: 2,
      nasalFlaring: 1,
      expiratoryGrunt: 2,
    });
    expect(score).toBe(6);

    const evalResult = evaluateNeonatalTtn({
      gestationalAgeWeeks: 38,
      birthWeightKg: 3.4,
      deliveryMode: 'elective_cesarean_no_labor',
      maternalDiabetes: true,
      maternalAsthma: false,
      maternalFluidOverload: true,
      initialRespiratoryRate: 88,
      silvermanAndersonInputs: {
        chestRetractionUpper: 0,
        chestRetractionLower: 1,
        xiphoidRetraction: 2,
        nasalFlaring: 1,
        expiratoryGrunt: 2,
      },
      cxrFindings: 'perihilar_streaking_sunburst',
      initialFio2Percent: 30,
      respiratorySupportInitial: 'bubble_cpap',
      cpapPeepCmh2o: 5.0,
      feedingStatus: 'npo_iv_fluids',
    });

    expect(evalResult.silvermanAndersonScore).toBe(6);
    expect(evalResult.distressSeverity).toBe('moderate_distress');
    expect(evalResult.feedingRecommendation).toContain('Strict NPO');
    expect(evalResult.riskFactorSummary.length).toBeGreaterThanOrEqual(2);
    expect(evalResult.cxrInterpretation).toContain('sunburst pattern');
  });

  it('triggers critical failure alert for severe score or ground glass RDS overlap', () => {
    const severeEval = evaluateNeonatalTtn({
      gestationalAgeWeeks: 36,
      birthWeightKg: 2.7,
      deliveryMode: 'emergency_cesarean_in_labor',
      maternalDiabetes: false,
      maternalAsthma: false,
      maternalFluidOverload: false,
      initialRespiratoryRate: 104,
      silvermanAndersonInputs: {
        chestRetractionUpper: 2,
        chestRetractionLower: 2,
        xiphoidRetraction: 2,
        nasalFlaring: 1,
        expiratoryGrunt: 1,
      },
      cxrFindings: 'ground_glass_rds_overlap',
      initialFio2Percent: 45,
      respiratorySupportInitial: 'bubble_cpap',
      cpapPeepCmh2o: 6.0,
      bloodGasPh: 7.22,
      bloodGasPco2: 58,
    });

    expect(severeEval.silvermanAndersonScore).toBe(8);
    expect(severeEval.distressSeverity).toBe('severe_respiratory_failure');
    expect(severeEval.isHighRiskEscalation).toBe(true);
    expect(severeEval.alerts.some(a => a.includes('CRITICAL'))).toBe(true);
    expect(severeEval.alerts.some(a => a.includes('RDS overlap'))).toBe(true);
  });
});

describe('Neonatal TTN REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.ttn',
      fullName: 'Dr. Sarah Neonatologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ttn',
      fullName: 'Nurse Nancy NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ttn', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ttn', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ttn',
      fullName: 'Attender Alex',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ttn', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ttn', PW);

    // Create a newborn patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby Girl Sharma',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 43210',
      address: 'NICU Incubator Bed 2',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('previews TTN evaluation without database persistence', async () => {
    const res = await call('POST', '/api/neonatal-ttn/evaluate', doctor, {
      gestationalAgeWeeks: 38,
      birthWeightKg: 3.2,
      initialRespiratoryRate: 75,
      chestRetractionUpper: 1,
      chestRetractionLower: 1,
      xiphoidRetraction: 1,
      nasalFlaring: 0,
      expiratoryGrunt: 0,
      cxrFindings: 'perihilar_streaking_sunburst',
      initialFio2Percent: 25,
      deliveryMode: 'elective_cesarean_no_labor',
    });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.silvermanAndersonScore).toBe(3);
    expect(res.body.evaluation.distressSeverity).toBe('mild_distress');
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    // 1. Non-clinical attender blocked
    const forbiddenRes = await call('POST', '/api/neonatal-ttn/episodes', attender, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 38.5,
      birthWeightKg: 3.3,
      deliveryMode: 'elective_cesarean_no_labor',
      initialRespiratoryRate: 84,
      silvermanAndersonInputs: {
        chestRetractionUpper: 1,
        chestRetractionLower: 1,
        xiphoidRetraction: 1,
        nasalFlaring: 1,
        expiratoryGrunt: 0,
      },
      cxrFindings: 'perihilar_streaking_sunburst',
      initialFio2Percent: 30,
      respiratorySupportInitial: 'bubble_cpap',
      feedingStatus: 'npo_iv_fluids',
    });
    expect(forbiddenRes.status).toBe(403);

    // 2. Doctor creates episode
    const createRes = await call('POST', '/api/neonatal-ttn/episodes', doctor, {
      patientId,
      diagnosisDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 38.5,
      birthWeightKg: 3.3,
      deliveryMode: 'elective_cesarean_no_labor',
      maternalDiabetes: true,
      maternalAsthma: false,
      maternalFluidOverload: false,
      initialRespiratoryRate: 84,
      silvermanAndersonInputs: {
        chestRetractionUpper: 1,
        chestRetractionLower: 1,
        xiphoidRetraction: 1,
        nasalFlaring: 1,
        expiratoryGrunt: 0,
      },
      cxrFindings: 'perihilar_streaking_sunburst',
      initialFio2Percent: 30,
      respiratorySupportInitial: 'bubble_cpap',
      cpapPeepCmh2o: 5.0,
      feedingStatus: 'npo_iv_fluids',
      bloodGasPh: 7.33,
      bloodGasPco2: 48,
      bloodGasPao2: 65,
      status: 'active_monitoring',
      clinicalNotes: 'Term male infant delivered via elective CS without labor; presenting with tachypnea 84 bpm.',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.episodeCode).toContain('TTN-');
    expect(createRes.body.silvermanScore).toBe(4);
    const episodeId = createRes.body.episodeId;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/neonatal-ttn/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with evaluation and flowsheet
    const getRes = await call('GET', `/api/neonatal-ttn/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evaluation.distressSeverity).toBe('moderate_distress');

    // 5. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/neonatal-ttn/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      respiratoryRate: 68,
      heartRate: 138,
      spo2Percent: 96,
      fio2Percent: 25,
      cpapPeepCmh2o: 5.0,
      silvermanAndersonScore: 2,
      gruntingPresent: false,
      feedingRoute: 'gavage_tube',
      bloodGasPh: 7.36,
      bloodGasPco2: 44,
      notes: 'Work of breathing improving on CPAP 5 cmH2O. Started gavage feeds.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Doctor updates episode status
    const updateRes = await call('PATCH', `/api/neonatal-ttn/episodes/${episodeId}/status`, doctor, {
      status: 'weaning_support',
      clinicalNotes: 'Transitioning from CPAP to room air trial.',
    });
    expect(updateRes.status).toBe(200);

    // 7. Nurse deletes flowsheet log
    const delLogRes = await call('DELETE', `/api/neonatal-ttn/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(delLogRes.status).toBe(200);

    // 8. Verify audit logs
    const auditRes = await call('GET', `/api/audit?entityId=${episodeId}`, doctor);
    expect(auditRes.status).toBe(200);
  });
});
