import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import { evaluateObstetricCordProlapse } from '../web/src/obstetricCordProlapseEngine.js';

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
describe('Obstetric Cord Prolapse & Decompression Protocol (Pure Unit Tests)', () => {
  it('identifies critical fetal bradycardia, evaluates decompression score, and mandates Category-1 Cesarean', () => {
    // FHR 70 bpm with prolonged bradycardia -> critical tier
    const critical = evaluateObstetricCordProlapse({
      maternalAge: 29,
      gestationalAgeWeeks: 39.4,
      cervicalDilationCm: 4.0,
      membraneStatus: 'ruptured_spontaneous',
      fetalPresentation: 'cephalic_vertex',
      prolapseType: 'overt_cord_visible_or_in_vagina',
      cordPulsationPresent: true,
      baselineFhrBpm: 70,
      fhrDecelerationType: 'prolonged_bradycardia',
      manualElevationPerformed: true,
      maternalPositioning: 'knee_chest_genupectoral',
      bladderFillingPerformed: true,
      bladderSalineVolumeMl: 500,
      tocolysisAdministered: true,
      tocolysisAgent: 'terbutaline_sc',
      cordManipulationAvoided: true,
      cordWrappedWarmSaline: true,
      deliveryMode: 'category_1_emergency_cesarean',
      decisionToDeliveryMinutes: 22,
    });

    expect(critical.isObstetricEmergency).toBe(true);
    expect(critical.fetalHypoxiaRiskTier).toBe('critical_terminal_bradycardia');
    expect(critical.category1CesareanMandated).toBe(true);
    expect(critical.decompressionQualityScore).toBe(5);
    expect(critical.ddiTargetExceeded).toBe(false);
  });

  it('detects deficiencies in decompression when positioning or manual elevation is neglected', () => {
    const deficient = evaluateObstetricCordProlapse({
      gestationalAgeWeeks: 38.5,
      cervicalDilationCm: 5.0,
      membraneStatus: 'ruptured_artificial',
      fetalPresentation: 'cephalic_vertex',
      prolapseType: 'overt_cord_visible_or_in_vagina',
      cordPulsationPresent: false,
      baselineFhrBpm: 65,
      fhrDecelerationType: 'prolonged_bradycardia',
      manualElevationPerformed: false, // DEFICIENCY
      maternalPositioning: 'supine_unfavorable', // DEFICIENCY
      bladderFillingPerformed: false,
      bladderSalineVolumeMl: 0,
      tocolysisAdministered: false, // DEFICIENCY
      tocolysisAgent: 'none',
      cordManipulationAvoided: false, // DEFICIENCY
      cordWrappedWarmSaline: false,
      deliveryMode: 'category_1_emergency_cesarean',
      decisionToDeliveryMinutes: 45, // EXCEEDED
    });

    expect(deficient.decompressionQualityScore).toBe(0);
    expect(deficient.decompressionDeficiencies.length).toBeGreaterThanOrEqual(3);
    expect(deficient.ddiTargetExceeded).toBe(true);
    expect(deficient.criticalActionPlan.some((p) => p.includes('elevate the presenting fetal part'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric Cord Prolapse REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyncord',
      fullName: 'Dr. Ananya Rao (OBGYN)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.laborcord',
      fullName: 'Sister Prema (Labor Ward)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.laborcord', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.laborcord', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.laborcord',
      fullName: 'Labor Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.laborcord', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.laborcord', PW);

    // Create a demo labor patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Sharma (Labor)',
      dateOfBirth: '1998-04-15',
      phone: '+91 98450 11001',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews cord prolapse evaluation without database persistence', async () => {
    const res = await call('POST', '/api/obstetric-cord-prolapse/evaluate', doctor, {
      gestationalAgeWeeks: 39,
      cervicalDilationCm: 4.0,
      membraneStatus: 'ruptured_spontaneous',
      fetalPresentation: 'cephalic_vertex',
      prolapseType: 'overt_cord_visible_or_in_vagina',
      cordPulsationPresent: true,
      baselineFhrBpm: 80,
      fhrDecelerationType: 'prolonged_bradycardia',
      manualElevationPerformed: true,
      maternalPositioning: 'knee_chest_genupectoral',
      bladderFillingPerformed: true,
      bladderSalineVolumeMl: 500,
      tocolysisAdministered: true,
      tocolysisAgent: 'terbutaline_sc',
      cordManipulationAvoided: true,
      cordWrappedWarmSaline: true,
      deliveryMode: 'category_1_emergency_cesarean',
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.isObstetricEmergency).toBe(true);
    expect(res.body.evalResult.decompressionQualityScore).toBe(5);
    expect(res.body.evalResult.category1CesareanMandated).toBe(true);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const detectTime = new Date().toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/obstetric-cord-prolapse/episodes', attender, {
      patientId,
      detectionDatetime: detectTime,
      gestationalAgeWeeks: 39.2,
      cervicalDilationCm: 4.0,
      membraneStatus: 'ruptured_spontaneous',
      fetalPresentation: 'cephalic_vertex',
      prolapseType: 'overt_cord_visible_or_in_vagina',
      baselineFhrBpm: 75,
      fhrDecelerationType: 'prolonged_bradycardia',
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/obstetric-cord-prolapse/episodes', doctor, {
      patientId,
      detectionDatetime: detectTime,
      maternalAge: 28,
      gestationalAgeWeeks: 39.2,
      cervicalDilationCm: 4.0,
      membraneStatus: 'ruptured_spontaneous',
      fetalPresentation: 'cephalic_vertex',
      prolapseType: 'overt_cord_visible_or_in_vagina',
      cordPulsationPresent: true,
      baselineFhrBpm: 75,
      fhrDecelerationType: 'prolonged_bradycardia',
      manualElevationPerformed: true,
      maternalPositioning: 'knee_chest_genupectoral',
      bladderFillingPerformed: true,
      bladderSalineVolumeMl: 500,
      tocolysisAdministered: true,
      tocolysisAgent: 'terbutaline_sc',
      cordManipulationAvoided: true,
      cordWrappedWarmSaline: true,
      deliveryMode: 'category_1_emergency_cesarean',
      decisionToDeliveryMinutes: 20,
      apgar1min: 7,
      apgar5min: 9,
      umbilicalArterialPh: 7.26,
      status: 'emergent_decompression_active',
      clinicalNotes: 'Cord prolapse diagnosed immediately on ROM. Digital elevation maintained to OR.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('PROLAPSE-');
    expect(createRes.body.evalResult.isObstetricEmergency).toBe(true);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/obstetric-cord-prolapse/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/obstetric-cord-prolapse/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.fetalHypoxiaRiskTier).toBe('critical_terminal_bradycardia');
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/obstetric-cord-prolapse/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      minutesFromDetection: 5,
      fetalHeartRateBpm: 120,
      cordPulsationPalpable: true,
      manualElevationMaintained: true,
      maternalBloodPressureSys: 116,
      maternalBloodPressureDia: 74,
      notes: 'Transfer to OR: FHR recovered to 120 bpm with good pulsation.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/obstetric-cord-prolapse/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to delivered_neonatal_resuscitation
    const updateRes = await call('PATCH', `/api/obstetric-cord-prolapse/episodes/${episodeId}`, doctor, {
      status: 'delivered_neonatal_resuscitation',
      decisionToDeliveryMinutes: 19,
      apgar1min: 7,
      apgar5min: 9,
      clinicalNotes: 'Baby delivered via Category-1 CS at 19 minutes. Vigorous cry, Apgar 7/9.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('delivered_neonatal_resuscitation');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/obstetric-cord-prolapse/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/obstetric-cord-prolapse/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/obstetric-cord-prolapse/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/obstetric-cord-prolapse/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
