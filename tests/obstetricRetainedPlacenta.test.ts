import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  evaluateObstetricRetainedPlacenta,
} from '../web/src/obstetricRetainedPlacentaEngine.js';

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

describe('Obstetric Retained Placenta Engine (Pure Unit Tests)', () => {
  it('correctly classifies prolonged third stage and recommends IUV oxytocin trial when stable', () => {
    const evalResult = evaluateObstetricRetainedPlacenta({
      thirdStageDurationMinutes: 35,
      activeManagementThirdStage: true,
      estimatedBloodLossMl: 250,
      hemodynamicStability: 'stable',
      bladderCatheterized: true,
      retainedPlacentaType: 'placenta_adherens',
      iuvOxytocinAttempted: false,
      iuvOxytocinSuccessful: false,
      mropPerformed: false,
      placentaCompletePostRemoval: false,
      prophylacticAntibioticsGiven: false,
      postRemovalOxytocinInfusion: false,
    });

    expect(evalResult.durationCategory).toBe('prolonged_retained');
    expect(evalResult.mropUrgency).toBe('conservative_iuv_trial');
    expect(evalResult.iuvProtocol.recommended).toBe(true);
    expect(evalResult.iuvProtocol.regimen).toContain('20 IU Oxytocin diluted in 20 mL');
    expect(evalResult.antibioticGuidance).toContain('Ampicillin 2g');
  });

  it('triggers emergency MROP and critical delay alert when blood loss is heavy or shock develops', () => {
    const shockEval = evaluateObstetricRetainedPlacenta({
      thirdStageDurationMinutes: 65,
      activeManagementThirdStage: true,
      estimatedBloodLossMl: 1200,
      hemodynamicStability: 'decompensated_hypotensive_shock',
      bladderCatheterized: false, // Not catheterized
      retainedPlacentaType: 'partial_accreta_suspected',
      iuvOxytocinAttempted: true,
      iuvOxytocinSuccessful: false,
      mropPerformed: false,
      placentaCompletePostRemoval: false,
      prophylacticAntibioticsGiven: false,
      postRemovalOxytocinInfusion: false,
    });

    expect(shockEval.durationCategory).toBe('critical_hemorrhage_delay');
    expect(shockEval.mropUrgency).toBe('immediate_emergent_mrop');
    expect(shockEval.iuvProtocol.recommended).toBe(false); // bypassed in shock
    expect(shockEval.alerts.some(a => a.includes('CRITICAL'))).toBe(true);
    expect(shockEval.alerts.some(a => a.includes('ACTION REQUIRED: Perform in-and-out urinary catheterization'))).toBe(true);
  });
});

describe('Obstetric Retained Placenta REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Kavita Obstetrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.maternity',
      fullName: 'Nurse Maya Midwife',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.maternity', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.maternity', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ward',
      fullName: 'Attender Anil',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ward', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ward', PW);

    // Create a postpartum patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Mehra',
      dateOfBirth: '1996-05-12',
      phone: '+91 98765 11223',
      address: 'Labor Room Bed 3',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('previews Retained Placenta evaluation without database persistence', async () => {
    const res = await call('POST', '/api/obstetric-retained-placenta/evaluate', doctor, {
      thirdStageDurationMinutes: 40,
      activeManagementThirdStage: true,
      estimatedBloodLossMl: 350,
      hemodynamicStability: 'stable',
      bladderCatheterized: true,
      retainedPlacentaType: 'placenta_adherens',
      iuvOxytocinAttempted: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.durationCategory).toBe('prolonged_retained');
    expect(res.body.evaluation.iuvProtocol.recommended).toBe(true);
  });

  it('creates an episode, updates status with MROP details, and reads details', async () => {
    const createRes = await call('POST', '/api/obstetric-retained-placenta/episodes', doctor, {
      patientId,
      deliveryDatetime: '2026-11-08T07:30:00',
      thirdStageDurationMinutes: 45,
      activeManagementThirdStage: true,
      estimatedBloodLossMl: 400,
      hemodynamicStability: 'stable',
      bladderCatheterized: true,
      retainedPlacentaType: 'placenta_adherens',
      iuvOxytocinAttempted: true,
      iuvOxytocinDoseIu: 20,
      iuvOxytocinSuccessful: false,
      mropIndicated: true,
      mropPerformed: false,
      placentaCompletePostRemoval: false,
      prophylacticAntibioticsGiven: true,
      postRemovalOxytocinInfusion: true,
      status: 'under_conservative_management',
      clinicalNotes: 'Failed IUV trial. Arranging theater transfer.',
    });

    expect(createRes.status).toBe(201);
    const { episodeId, episodeCode } = createRes.body;
    expect(episodeId).toBeGreaterThan(0);
    expect(episodeCode).toMatch(/^RET-\d+-\d+$/);

    // Update status to post_removal_recovery with MROP performed
    const updateRes = await call('PATCH', `/api/obstetric-retained-placenta/episodes/${episodeId}/status`, doctor, {
      status: 'post_removal_recovery',
      mropPerformed: true,
      mropDatetime: '2026-11-08T08:30:00',
      anesthesiaType: 'spinal_regional',
      placentaCompletePostRemoval: true,
    });
    expect(updateRes.status).toBe(200);

    // Get details
    const getRes = await call('GET', `/api/obstetric-retained-placenta/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.mrop_performed).toBe(true);
    expect(getRes.body.episode.status).toBe('post_removal_recovery');
  });

  it('records, queries, and deletes flowsheet surveillance checkpoints', async () => {
    const createRes = await call('POST', '/api/obstetric-retained-placenta/episodes', doctor, {
      patientId,
      deliveryDatetime: '2026-11-08T07:30:00',
      thirdStageDurationMinutes: 35,
      activeManagementThirdStage: true,
      estimatedBloodLossMl: 300,
      hemodynamicStability: 'stable',
      bladderCatheterized: true,
      retainedPlacentaType: 'placenta_adherens',
    });
    const { episodeId } = createRes.body;

    // Add flowsheet log by nurse
    const logRes = await call('POST', `/api/obstetric-retained-placenta/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T08:10:00',
      minutesFromDelivery: 40,
      bloodPressureSys: 114,
      bloodPressureDia: 72,
      heartRate: 82,
      cumulativeBloodLossMl: 350,
      uterineFundusTone: 'firm_contracted',
      activeVaginalBleeding: 'minimal_trickle',
      cordLengtheningObserved: false,
      interventionApplied: 'Gentle traction with counter-traction',
      notes: 'No signs of placental separation yet.',
    });
    expect(logRes.status).toBe(201);
    const { logId } = logRes.body;

    // List logs
    const listRes = await call('GET', `/api/obstetric-retained-placenta/episodes/${episodeId}/flowsheet-logs`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.logs.length).toBe(1);
    expect(listRes.body.logs[0].cumulative_blood_loss_ml).toBe(350);

    // Delete log
    const delRes = await call('DELETE', `/api/obstetric-retained-placenta/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delRes.status).toBe(200);

    const postDel = await call('GET', `/api/obstetric-retained-placenta/episodes/${episodeId}/flowsheet-logs`, doctor);
    expect(postDel.body.logs.length).toBe(0);
  });

  it('enforces RBAC permissions: attender cannot create episodes', async () => {
    const createRes = await call('POST', '/api/obstetric-retained-placenta/episodes', attender, {
      patientId,
      deliveryDatetime: '2026-11-08T07:30:00',
      thirdStageDurationMinutes: 40,
      estimatedBloodLossMl: 300,
      hemodynamicStability: 'stable',
      retainedPlacentaType: 'placenta_adherens',
    });
    expect(createRes.status).toBe(403);
  });
});
