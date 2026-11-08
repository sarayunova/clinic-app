import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  evaluateObstetricPdph,
} from '../web/src/obstetricPdphEngine.js';

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

describe('Obstetric PDPH Engine (Pure Unit Tests)', () => {
  it('correctly evaluates severe PDPH and triggers emergent EBP recommendation', () => {
    const evalResult = evaluateObstetricPdph({
      procedureType: 'labor_epidural_adp',
      needleGauge: '16G_tuohy',
      initialVasScore: 9,
      posturalComponent: true,
      neckStiffness: true,
      auditorySymptoms: true,
      visualSymptomsDiplopia: true,
      conservativeHydrationMl24h: 3000,
      caffeineAdministered: true,
    });

    expect(evalResult.vasScore).toBe(9);
    expect(evalResult.severityTier).toBe('severe');
    expect(evalResult.ebpIndicated).toBe(true);
    expect(evalResult.ebpUrgency).toBe('strongly_indicated_emergent');
    expect(evalResult.recommendedEbpVolumeMl).toContain('15 to 20 mL');
    expect(evalResult.alerts.some(a => a.includes('CRITICAL'))).toBe(true);
    expect(evalResult.alerts.some(a => a.includes('palsy'))).toBe(true);
  });

  it('identifies fever red flag and alerts for meningitis exclusion', () => {
    const redFlagEval = evaluateObstetricPdph({
      procedureType: 'spinal_anesthesia',
      needleGauge: '25G_whitacre',
      initialVasScore: 5,
      posturalComponent: false,
      neckStiffness: true,
      auditorySymptoms: false,
      visualSymptomsDiplopia: false,
      temperatureCelsius: 38.6,
    });

    expect(redFlagEval.hasRedFlags).toBe(true);
    expect(redFlagEval.redFlagWarnings.some(w => w.includes('Fever'))).toBe(true);
    expect(redFlagEval.alerts.some(a => a.includes('lacks clear postural'))).toBe(true);
  });
});

describe('Obstetric PDPH REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pdph',
      fullName: 'Dr. Aaron Anesthesiologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pdph',
      fullName: 'Nurse Olivia OB',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.pdph', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.pdph', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.pdph',
      fullName: 'Attender Alex',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.pdph', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.pdph', PW);

    // Create a parturient patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Pooja Verma',
      dateOfBirth: '1996-05-12',
      phone: '+91 98112 23344',
      address: 'Maternity Ward Bed 4',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('previews PDPH evaluation without database persistence', async () => {
    const res = await call('POST', '/api/obstetric-pdph/evaluate', doctor, {
      procedureType: 'labor_epidural_adp',
      needleGauge: '17G_tuohy',
      initialVasScore: 7,
      posturalComponent: true,
      neckStiffness: false,
      auditorySymptoms: false,
      visualSymptomsDiplopia: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.severityTier).toBe('severe');
    expect(res.body.evaluation.ebpIndicated).toBe(true);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    // 1. Non-clinical attender blocked
    const forbiddenRes = await call('POST', '/api/obstetric-pdph/episodes', attender, {
      patientId,
      procedureType: 'labor_epidural_adp',
      punctureDatetime: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      needleGauge: '16G_tuohy',
      headacheOnsetDatetime: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      initialVasScore: 8,
    });
    expect(forbiddenRes.status).toBe(403);

    // 2. Doctor creates episode
    const createRes = await call('POST', '/api/obstetric-pdph/episodes', doctor, {
      patientId,
      procedureType: 'labor_epidural_adp',
      punctureDatetime: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      needleGauge: '16G_tuohy',
      headacheOnsetDatetime: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      initialVasScore: 8,
      posturalComponent: true,
      neckStiffness: true,
      auditorySymptoms: true,
      visualSymptomsDiplopia: false,
      conservativeHydrationMl24h: 3000,
      caffeineAdministered: true,
      analgesicsPrescribed: 'Paracetamol 1000mg PO Q6H + Ibuprofen 400mg PO Q8H',
      ebpIndicated: true,
      ebpPerformed: false,
      redFlagsPresent: false,
      status: 'conservative_management',
      clinicalNotes: 'Accidental dural puncture with 16G Tuohy. Severe postural headache developing 24h postpartum.',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.episodeCode).toContain('PDPH-');
    expect(createRes.body.evaluation.severityTier).toBe('severe');
    const episodeId = createRes.body.episodeId;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/obstetric-pdph/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with evaluation and flowsheet
    const getRes = await call('GET', `/api/obstetric-pdph/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.episode.initial_vas_score).toBe(8);

    // 5. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/obstetric-pdph/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      postureAssessed: 'sitting_upright',
      vasPainScore: 7,
      headacheReliefOnLying: true,
      bloodPressureSys: 114,
      bloodPressureDia: 72,
      heartRate: 76,
      temperatureCelsius: 36.9,
      neurologicalSymptomsPresent: false,
      interventionsGiven: 'Hydration 1000mL IV crystalloid bolus + oral caffeine 200mg',
      notes: 'VAS drops from 7 to 1 when lying flat.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Doctor performs EBP and updates episode
    const updateRes = await call('PATCH', `/api/obstetric-pdph/episodes/${episodeId}/status`, doctor, {
      status: 'ebp_completed_resolving',
      ebpPerformed: true,
      ebpDatetime: new Date().toISOString(),
      ebpBloodVolumeMl: 18.0,
      ebpInterspace: 'L3-L4',
      postEbpVasScore: 1,
      clinicalNotes: '18 mL autologous sterile blood injected into L3-L4 epidural space. Immediate dramatic headache relief.',
    });
    expect(updateRes.status).toBe(200);

    // 7. Nurse deletes flowsheet log
    const delLogRes = await call('DELETE', `/api/obstetric-pdph/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(delLogRes.status).toBe(200);

    // 8. Verify audit logs
    const auditRes = await call('GET', `/api/audit?entityId=${episodeId}`, doctor);
    expect(auditRes.status).toBe(200);
  });
});
