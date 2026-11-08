import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  evaluatePediatricPyloricStenosis,
} from '../web/src/pediatricPyloricStenosisEngine.js';

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

describe('Pediatric Pyloric Stenosis Engine (Pure Unit Tests)', () => {
  it('identifies diagnostic ultrasound and blocks surgical clearance when alkalosis is uncorrected', () => {
    const uncorrectedEval = evaluatePediatricPyloricStenosis({
      ageWeeks: 5,
      weightKg: 3.8,
      birthWeightKg: 3.2,
      vomitingProjectileNonBilious: true,
      hungryVomiterBehavior: true,
      palpableOliveMass: true,
      visibleGastricPeristalsis: true,
      dehydrationPercentage: 7.0,
      ultrasoundPerformed: true,
      pyloricMuscleThicknessMm: 3.9,
      pyloricChannelLengthMm: 16.0,
      ultrasoundDiagnosticTargetSign: true,
      serumSodiumMeqL: 133,
      serumPotassiumMeqL: 3.2,
      serumChlorideMeqL: 89, // < 90 (severe)
      serumBicarbonateMeqL: 33, // > 32 (severe)
      bloodPh: 7.53,
      urineOutputMlKgHr: 0.7,
      potassiumSupplementationStarted: false,
    });

    expect(uncorrectedEval.ultrasoundDiagnostic).toBe(true);
    expect(uncorrectedEval.metabolicDerangementTier).toBe('severe_paradoxical_aciduria_risk');
    expect(uncorrectedEval.preOpClearance.allClearedForOr).toBe(false);
    expect(uncorrectedEval.preOpClearance.chlorideAdequate).toBe(false);
    expect(uncorrectedEval.preOpClearance.bicarbonateAdequate).toBe(false);
    expect(uncorrectedEval.alerts.some(a => a.includes('CONTRAINDICATION'))).toBe(true);
    expect(uncorrectedEval.fluidGuidance).toContain('D5 0.45%');
  });

  it('grants surgical clearance when strict resuscitation criteria are met', () => {
    const clearedEval = evaluatePediatricPyloricStenosis({
      ageWeeks: 6,
      weightKg: 4.0,
      birthWeightKg: 3.3,
      vomitingProjectileNonBilious: true,
      hungryVomiterBehavior: true,
      palpableOliveMass: true,
      visibleGastricPeristalsis: false,
      dehydrationPercentage: 2.0,
      ultrasoundPerformed: true,
      pyloricMuscleThicknessMm: 4.2,
      pyloricChannelLengthMm: 17.0,
      ultrasoundDiagnosticTargetSign: true,
      serumSodiumMeqL: 137,
      serumPotassiumMeqL: 3.8, // >= 3.5
      serumChlorideMeqL: 102, // >= 100
      serumBicarbonateMeqL: 26, // <= 28
      bloodPh: 7.42,
      urineOutputMlKgHr: 1.4, // >= 1.0
      potassiumSupplementationStarted: true,
    });

    expect(clearedEval.preOpClearance.allClearedForOr).toBe(true);
    expect(clearedEval.preOpClearance.clearanceSummary).toContain('SURGICALLY CLEARED');
    expect(clearedEval.recommendations.some(r => r.includes('Ramstedt pyloromyotomy'))).toBe(true);
  });
});

describe('Pediatric Pyloric Stenosis REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedsurg',
      fullName: 'Dr. Vivek Pediatric Surgeon',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.peds',
      fullName: 'Nurse Priya Peds',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.peds', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.peds', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.peds',
      fullName: 'Attender Amit',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.peds', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.peds', PW);

    // Create a pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Reyansh Gupta',
      dateOfBirth: '2026-10-01',
      phone: '+91 98765 33445',
      address: 'Pediatric Surgical Ward Bed 6',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('previews IHPS evaluation without database persistence', async () => {
    const res = await call('POST', '/api/pediatric-pyloric-stenosis/evaluate', doctor, {
      ageWeeks: 5,
      weightKg: 3.9,
      birthWeightKg: 3.3,
      pyloricMuscleThicknessMm: 3.8,
      pyloricChannelLengthMm: 16.0,
      ultrasoundDiagnosticTargetSign: true,
      serumSodiumMeqL: 135,
      serumPotassiumMeqL: 3.6,
      serumChlorideMeqL: 96,
      serumBicarbonateMeqL: 30,
      bloodPh: 7.48,
      urineOutputMlKgHr: 0.8,
    });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.ultrasoundDiagnostic).toBe(true);
    expect(res.body.evaluation.preOpClearance.allClearedForOr).toBe(false);
  });

  it('creates an IHPS episode, updates clearance and surgical status, and reads details', async () => {
    const createRes = await call('POST', '/api/pediatric-pyloric-stenosis/episodes', doctor, {
      patientId,
      presentationDatetime: '2026-11-08T05:00:00',
      ageWeeks: 5.5,
      weightKg: 3.9,
      birthWeightKg: 3.3,
      vomitingProjectileNonBilious: true,
      hungryVomiterBehavior: true,
      palpableOliveMass: true,
      visibleGastricPeristalsis: true,
      dehydrationPercentage: 5.0,
      ultrasoundPerformed: true,
      pyloricMuscleThicknessMm: 4.0,
      pyloricChannelLengthMm: 16.5,
      ultrasoundDiagnosticTargetSign: true,
      serumSodiumMeqL: 135,
      serumPotassiumMeqL: 3.5,
      serumChlorideMeqL: 97,
      serumBicarbonateMeqL: 29,
      bloodPh: 7.47,
      urineOutputMlKgHr: 0.9,
      fluidResuscitationRateMlHr: 24,
      potassiumSupplementationStarted: false,
      status: 'preop_fluid_resuscitation',
      clinicalNotes: 'Initiated aggressive fluid resuscitation with D5 0.45% NS.',
    });

    expect(createRes.status).toBe(201);
    const { episodeId, episodeCode } = createRes.body;
    expect(episodeId).toBeGreaterThan(0);
    expect(episodeCode).toMatch(/^PYL-\d+-\d+$/);

    // Update status to metabolically_cleared_for_or
    const updateRes = await call('PATCH', `/api/pediatric-pyloric-stenosis/episodes/${episodeId}/status`, doctor, {
      status: 'metabolically_cleared_for_or',
      preopElectrolytesNormalized: true,
      surgicalClearanceGranted: true,
      pyloromyotomyTechnique: 'laparoscopic_ramstedt',
    });
    expect(updateRes.status).toBe(200);

    // Get details
    const getRes = await call('GET', `/api/pediatric-pyloric-stenosis/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.surgical_clearance_granted).toBe(true);
    expect(getRes.body.episode.status).toBe('metabolically_cleared_for_or');
  });

  it('records, queries, and deletes flowsheet surveillance checkpoints', async () => {
    const createRes = await call('POST', '/api/pediatric-pyloric-stenosis/episodes', doctor, {
      patientId,
      presentationDatetime: '2026-11-08T05:00:00',
      ageWeeks: 5,
      weightKg: 3.7,
      birthWeightKg: 3.2,
      vomitingProjectileNonBilious: true,
      hungryVomiterBehavior: true,
      dehydrationPercentage: 6.0,
      ultrasoundPerformed: true,
      serumSodiumMeqL: 134,
      serumPotassiumMeqL: 3.4,
      serumChlorideMeqL: 92,
      serumBicarbonateMeqL: 31,
      bloodPh: 7.49,
      urineOutputMlKgHr: 0.7,
    });
    const { episodeId } = createRes.body;

    // Add flowsheet log by nurse
    const logRes = await call('POST', `/api/pediatric-pyloric-stenosis/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T09:00:00',
      hoursFromAdmission: 4,
      serumSodiumMeqL: 135,
      serumPotassiumMeqL: 3.6,
      serumChlorideMeqL: 98,
      serumBicarbonateMeqL: 28,
      bloodPh: 7.46,
      urineOutputMlKgHr: 1.2,
      ivFluidRateMlHr: 24,
      capillaryRefillSeconds: 2.0,
      vomitingEpisodesCount: 0,
      gastricDecompressionOutputMl: 10,
      notes: 'Electrolyte balance significantly improved.',
    });
    expect(logRes.status).toBe(201);
    const { logId } = logRes.body;

    // List logs
    const listRes = await call('GET', `/api/pediatric-pyloric-stenosis/episodes/${episodeId}/flowsheet-logs`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.logs.length).toBe(1);
    expect(listRes.body.logs[0].serum_chloride_meq_l).toBe(98);

    // Delete log
    const delRes = await call('DELETE', `/api/pediatric-pyloric-stenosis/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delRes.status).toBe(200);

    const postDel = await call('GET', `/api/pediatric-pyloric-stenosis/episodes/${episodeId}/flowsheet-logs`, doctor);
    expect(postDel.body.logs.length).toBe(0);
  });

  it('enforces RBAC permissions: attender cannot create episodes', async () => {
    const createRes = await call('POST', '/api/pediatric-pyloric-stenosis/episodes', attender, {
      patientId,
      presentationDatetime: '2026-11-08T05:00:00',
      ageWeeks: 5,
      weightKg: 3.8,
      birthWeightKg: 3.2,
      vomitingProjectileNonBilious: true,
      hungryVomiterBehavior: true,
      serumSodiumMeqL: 135,
      serumPotassiumMeqL: 3.5,
      serumChlorideMeqL: 95,
      serumBicarbonateMeqL: 30,
      bloodPh: 7.48,
    });
    expect(createRes.status).toBe(403);
  });
});
