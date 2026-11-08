import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricDkaCerebralEdema } from '../web/src/pediatricDkaCerebralEdemaEngine.js';

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

describe('Pediatric DKA Cerebral Edema Engine (Pure Unit Tests)', () => {
  it('correctly calculates corrected sodium, effective osmolality, and Muir diagnostic criteria', () => {
    // 25 kg child, age 8, Glucose 620 mg/dL, measured Na 131 mEq/L
    // Corrected Na = 131 + 1.6 * (520 / 100) = 131 + 8.32 = 139.3
    // Effective Osm = 2 * 131 + (620 / 18) = 262 + 34.44 = 296.4
    // 3% Saline dose = 25 * 5 = 125 mL
    // Mannitol dose = 25 * 2.5 = 62.5 mL
    const res = evaluatePediatricDkaCerebralEdema({
      ageYears: 8.0,
      weightKg: 25.0,
      gcsScore: 11,
      headacheSevereSudden: true,
      lethargyOrConfusion: true,
      recurrentEmesisPostHydration: true,
      bradycardiaCushingTriad: true,
      hypertensionDiastolicGe90: true,
      cranialNervePalsy: false,
      pupillaryAbnormality: 'sluggish',
      decorticateDecerebratePosturing: false,
      bloodGlucoseMgDl: 620,
      serumSodiumMeasuredMeqL: 131,
      serumPotassiumMeqL: 4.2,
      bloodPh: 7.08,
      serumBicarbonateMeqL: 6.5,
    });

    expect(res.serumSodiumCorrectedMeqL).toBe(139.3);
    expect(res.effectiveSerumOsmolalityMosmKg).toBe(296.4);
    expect(res.muirCriteriaCategory).toBe('diagnostic_cerebral_edema');
    expect(res.hyperosmolarRescueIndicated).toBe(true);
    expect(res.hyperosmolarSaline3PctDoseMl).toBe(125.0);
    expect(res.mannitol20PctDoseMl).toBe(62.5);
    expect(res.fluidRateReductionPercent).toBe(30);
    expect(res.alerts.some(a => a.includes('RED ALERT: DIAGNOSTIC CEREBRAL EDEMA'))).toBe(true);
    expect(res.alerts.some(a => a.includes('CUSHING TRIAD'))).toBe(true);
  });

  it('triggers impending warning signs when multiple minor criteria are present without frank herniation', () => {
    const res = evaluatePediatricDkaCerebralEdema({
      ageYears: 9.0,
      weightKg: 28.0,
      gcsScore: 14,
      headacheSevereSudden: true,
      lethargyOrConfusion: true,
      recurrentEmesisPostHydration: true,
      bradycardiaCushingTriad: false,
      hypertensionDiastolicGe90: false,
      cranialNervePalsy: false,
      pupillaryAbnormality: 'normal_reactive',
      decorticateDecerebratePosturing: false,
      bloodGlucoseMgDl: 480,
      serumSodiumMeasuredMeqL: 136,
      serumPotassiumMeqL: 4.5,
      bloodPh: 7.15,
      serumBicarbonateMeqL: 10.0,
    });

    expect(res.muirCriteriaCategory).toBe('impending_warning_signs');
    expect(res.hyperosmolarRescueIndicated).toBe(true);
    expect(res.alerts.some(a => a.includes('NEUROLOGICAL WARNING'))).toBe(true);
  });
});

describe('Pediatric DKA Cerebral Edema Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.dkace',
      fullName: 'Dr. Vivek PICU',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.dkace',
      fullName: 'Nurse Kavita PICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.dkace', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.dkace', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.dkace',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.dkace', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.dkace', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Gupta (DKA Patient)',
      dateOfBirth: '2018-03-20',
      phone: '9876543212',
      address: 'PICU Bed 1',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview evaluation, create DKA CE episode, and nurse to track flowsheet', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/pediatric-dka-ce/evaluate', doctor, {
      ageYears: 8.5,
      weightKg: 25.0,
      gcsScore: 11,
      headacheSevereSudden: true,
      lethargyOrConfusion: true,
      recurrentEmesisPostHydration: true,
      bradycardiaCushingTriad: true,
      hypertensionDiastolicGe90: true,
      pupillaryAbnormality: 'sluggish',
      bloodGlucoseMgDl: 620,
      serumSodiumMeasuredMeqL: 131,
      serumPotassiumMeqL: 4.2,
      bloodPh: 7.08,
      serumBicarbonateMeqL: 6.5,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.muirCriteriaCategory).toBe('diagnostic_cerebral_edema');
    expect(preview.body.evaluation.hyperosmolarRescueIndicated).toBe(true);

    // 2. Create episode
    const created = await call('POST', '/api/pediatric-dka-ce/episodes', doctor, {
      patientId,
      detectionDatetime: '2026-11-08T05:45:00',
      ageYears: 8.5,
      weightKg: 25.0,
      gcsScore: 11,
      headacheSevereSudden: true,
      lethargyOrConfusion: true,
      recurrentEmesisPostHydration: true,
      bradycardiaCushingTriad: true,
      hypertensionDiastolicGe90: true,
      cranialNervePalsy: false,
      pupillaryAbnormality: 'sluggish',
      decorticateDecerebratePosturing: false,
      bloodGlucoseMgDl: 620,
      serumSodiumMeasuredMeqL: 131,
      serumPotassiumMeqL: 4.2,
      bloodPh: 7.08,
      serumBicarbonateMeqL: 6.5,
      fluidRateReducedBy30pct: true,
      headOfBedElevated30deg: true,
      status: 'hypertonic_saline_infusing',
      clinicalNotes: '3% Hypertonic Saline 125 mL ordered stat. Fluid rate cut by 30%.',
    });

    expect(created.status).toBe(201);
    expect(created.body.episodeCode).toMatch(/^DKACE-/);
    const episodeId = created.body.episodeId || created.body.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get episode details
    const detail = await call('GET', `/api/pediatric-dka-ce/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.gcs_score).toBe(11);
    expect(detail.body.evaluation.hyperosmolarRescueIndicated).toBe(true);

    // 4. Update status
    const statusUpdate = await call('PATCH', `/api/pediatric-dka-ce/episodes/${episodeId}/status`, doctor, {
      status: 'neurological_recovery_gcs15',
      clinicalNotes: 'Sensorium normalized. GCS 15. Alert and oriented.',
    });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.success).toBe(true);

    // 5. Nurse adds flowsheet log
    const logAdd = await call('POST', `/api/pediatric-dka-ce/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:30:00',
      hoursFromDetection: 1.0,
      gcsScore: 13,
      pupilSizeAndReactivity: '3mm equal, briskly reactive',
      heartRate: 88,
      bloodPressureSys: 112,
      bloodPressureDia: 70,
      bloodGlucoseMgDl: 480,
      serumSodiumMeasuredMeqL: 135,
      hyperosmolarAgentGiven: '3% NaCl 125 mL completed',
      ivFluidRateMlHr: 70,
      neurologicalExamNotes: 'Headache resolved, no posturing.',
      notes: 'Measured sodium safely rising.',
    });
    expect(logAdd.status).toBe(201);
    const logId = logAdd.body.id || logAdd.body.logId;
    expect(logId).toBeGreaterThan(0);
    expect(logAdd.body.serumSodiumCorrectedMeqL).toBeGreaterThan(135);

    // 6. Delete flowsheet log
    const logDel = await call('DELETE', `/api/pediatric-dka-ce/flowsheet/${logId}`, nurse);
    expect(logDel.status).toBe(200);
    expect(logDel.body.success).toBe(true);
  });

  it('enforces RBAC preventing attender from creating or altering DKA CE records', async () => {
    const unauth = await call('POST', '/api/pediatric-dka-ce/episodes', attender, {
      patientId,
      detectionDatetime: '2026-11-08T05:45:00',
      ageYears: 8.5,
      weightKg: 25.0,
      gcsScore: 11,
      pupillaryAbnormality: 'sluggish',
      bloodGlucoseMgDl: 620,
      serumSodiumMeasuredMeqL: 131,
      serumPotassiumMeqL: 4.2,
      bloodPh: 7.08,
      serumBicarbonateMeqL: 6.5,
    });
    expect(unauth.status).toBe(403);
  });
});
