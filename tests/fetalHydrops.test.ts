import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateFetalHydrops } from '../web/src/fetalHydropsEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown
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

describe('Non-Immune Fetal Hydrops (NIHF) & Mirror Syndrome Engine (Pure Unit Tests)', () => {
  it('detects severe fetal hydrops with severe anemia (MCA MoM >= 1.50) and Maternal Mirror Syndrome', () => {
    const res = evaluateFetalHydrops({
      gestationalAgeWeeks: 26.5,
      fetalCompartmentsInvolvedCount: 4,
      ascitesPresent: true,
      pleuralEffusionPresent: true,
      pericardialEffusionPresent: true,
      skinEdemaPresent: true,
      placentalEdemaPresent: true,
      polyhydramniosPresent: true,
      mcaPsvMom: 1.75,
      suspectedEtiologyCategory: 'fetal_anemia_parvovirus_or_hemoglobinopathy',
      fetalArrhythmiaDetected: false,
      maternalMirrorSyndromeSuspected: true,
      maternalSystolicBpMmhg: 154,
      maternalDiastolicBpMmhg: 96,
      maternalProteinuriaGrade: '2_plus',
      maternalGeneralizedAnasarca: true,
      inUteroInterventionPlanned: 'intrauterine_blood_transfusion_iut',
      status: 'in_utero_intervention_active',
    });

    expect(res.isHydropsConfirmed).toBe(true);
    expect(res.isSevereFetalAnemia).toBe(true);
    expect(res.isMirrorSyndromeTriggered).toBe(true);
    expect(res.urgencyCategory).toBe('emergent_intervention_or_delivery');
    expect(res.clinicalAlerts.some((a) => a.includes('MATERNAL MIRROR SYNDROME'))).toBe(true);
    expect(res.clinicalAlerts.some((a) => a.includes('SEVERE FETAL ANEMIA'))).toBe(true);
    expect(res.managementDirectives.some((d) => d.includes('cordocentesis'))).toBe(true);
  });

  it('evaluates isolated fetal ascites (< 2 compartments) as pre-hydrops / surveillance', () => {
    const res = evaluateFetalHydrops({
      gestationalAgeWeeks: 28.0,
      fetalCompartmentsInvolvedCount: 1,
      ascitesPresent: true,
      pleuralEffusionPresent: false,
      pericardialEffusionPresent: false,
      skinEdemaPresent: false,
      placentalEdemaPresent: false,
      polyhydramniosPresent: false,
      mcaPsvMom: 1.10,
      suspectedEtiologyCategory: 'idiopathic_unexplained',
      fetalArrhythmiaDetected: false,
      maternalMirrorSyndromeSuspected: false,
      maternalSystolicBpMmhg: 118,
      maternalDiastolicBpMmhg: 74,
      maternalProteinuriaGrade: 'nil',
      maternalGeneralizedAnasarca: false,
      inUteroInterventionPlanned: 'conservative_surveillance',
      status: 'diagnostic_workup',
    });

    expect(res.isHydropsConfirmed).toBe(false);
    expect(res.isSevereFetalAnemia).toBe(false);
    expect(res.isMirrorSyndromeTriggered).toBe(false);
    expect(res.urgencyCategory).toBe('elective_diagnostic_workup');
  });

  it('triggers antiarrhythmic transplacental therapy for fetal tachyarrhythmia hydrops', () => {
    const res = evaluateFetalHydrops({
      gestationalAgeWeeks: 24.0,
      fetalCompartmentsInvolvedCount: 2,
      ascitesPresent: true,
      pleuralEffusionPresent: false,
      pericardialEffusionPresent: true,
      skinEdemaPresent: false,
      placentalEdemaPresent: false,
      polyhydramniosPresent: false,
      mcaPsvMom: 1.05,
      suspectedEtiologyCategory: 'cardiovascular_structural_or_arrhythmia',
      fetalArrhythmiaDetected: true,
      maternalMirrorSyndromeSuspected: false,
      maternalSystolicBpMmhg: 120,
      maternalDiastolicBpMmhg: 80,
      maternalProteinuriaGrade: 'nil',
      maternalGeneralizedAnasarca: false,
      inUteroInterventionPlanned: 'antiarrhythmic_transplacental_therapy',
      status: 'in_utero_intervention_active',
    });

    expect(res.isHydropsConfirmed).toBe(true);
    expect(res.managementDirectives.some((d) => d.includes('antiarrhythmic therapy'))).toBe(true);
  });
});

describe('Non-Immune Fetal Hydrops (NIHF) Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.mfm',
      fullName: 'Dr. Anita Roy MFM Specialist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.antenatal',
      fullName: 'Nurse Suman',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.antenatal', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.antenatal', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.mfm',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.mfm', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.mfm', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Sharma (NIHF)',
      dateOfBirth: '1996-04-12',
      phone: '9876543212',
      address: 'Obstetric HDU Bed 1',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, record, update, flowsheet log, and delete fetal hydrops episodes', async () => {
    // 1. Evaluate endpoint
    const evalRes = await call('POST', '/api/fetal-hydrops/evaluate', doctor, {
      gestationalAgeWeeks: 26.4,
      fetalCompartmentsInvolvedCount: 3,
      ascitesPresent: true,
      pleuralEffusionPresent: true,
      pericardialEffusionPresent: true,
      skinEdemaPresent: false,
      placentalEdemaPresent: true,
      polyhydramniosPresent: true,
      mcaPsvMom: 1.72,
      suspectedEtiologyCategory: 'fetal_anemia_parvovirus_or_hemoglobinopathy',
      fetalArrhythmiaDetected: false,
      maternalMirrorSyndromeSuspected: true,
      maternalSystolicBpMmhg: 150,
      maternalDiastolicBpMmhg: 94,
      maternalProteinuriaGrade: '2_plus',
      maternalGeneralizedAnasarca: true,
      inUteroInterventionPlanned: 'intrauterine_blood_transfusion_iut',
      status: 'in_utero_intervention_active',
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.isHydropsConfirmed).toBe(true);
    expect(evalRes.body.evaluation.isSevereFetalAnemia).toBe(true);
    expect(evalRes.body.evaluation.isMirrorSyndromeTriggered).toBe(true);

    // 2. Create Episode
    const createRes = await call('POST', '/api/fetal-hydrops/episodes', doctor, {
      patientId,
      diagnosisDatetime: '2026-11-08T06:00:00',
      gestationalAgeWeeks: 26.4,
      fetalCompartmentsInvolvedCount: 3,
      ascitesPresent: true,
      pleuralEffusionPresent: true,
      pericardialEffusionPresent: true,
      skinEdemaPresent: false,
      placentalEdemaPresent: true,
      polyhydramniosPresent: true,
      mcaPsvMom: 1.72,
      suspectedEtiologyCategory: 'fetal_anemia_parvovirus_or_hemoglobinopathy',
      fetalArrhythmiaDetected: false,
      maternalMirrorSyndromeSuspected: true,
      maternalSystolicBpMmhg: 150,
      maternalDiastolicBpMmhg: 94,
      maternalProteinuriaGrade: '2_plus',
      maternalGeneralizedAnasarca: true,
      inUteroInterventionPlanned: 'intrauterine_blood_transfusion_iut',
      status: 'in_utero_intervention_active',
      clinicalNotes: 'Severe NIHF secondary to parvovirus B19 anemia. IUT planned.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('HYD-');

    // 3. Nurse records flowsheet checkpoint
    const flowRes = await call('POST', `/api/fetal-hydrops/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T07:00:00',
      gestationalAgeWeeks: 26.4,
      fetalHeartRateBpm: 156,
      mcaPsvCmS: 64.0,
      mcaPsvMom: 1.72,
      pleuralEffusionDepthMm: 12.0,
      ascitesDepthMm: 15.0,
      maternalBpSystolic: 150,
      maternalBpDiastolic: 94,
      maternalWeightKg: 72.0,
      notes: 'Initial surveillance pre-transfusion',
    });
    expect(flowRes.status).toBe(201);
    expect(flowRes.body.flowsheetLog.id).toBeDefined();
    const logId = flowRes.body.flowsheetLog.id;

    // 4. Retrieve single episode with flowsheet & evaluation
    const getRes = await call('GET', `/api/fetal-hydrops/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.flowsheet.length).toBe(1);
    expect(getRes.body.evaluation.isHydropsConfirmed).toBe(true);

    // 5. Patch status
    const patchRes = await call('PATCH', `/api/fetal-hydrops/episodes/${episodeId}/status`, doctor, {
      status: 'fetal_hydrops_resolving',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('fetal_hydrops_resolving');

    // 6. Delete flowsheet log
    const delFlowRes = await call('DELETE', `/api/fetal-hydrops/episodes/${episodeId}/flowsheet/${logId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. List episodes by query and by patient
    const listQuery = await call('GET', `/api/fetal-hydrops/episodes?patientId=${patientId}`, doctor);
    expect(listQuery.status).toBe(200);
    expect(listQuery.body.episodes.length).toBe(1);

    const listPatient = await call('GET', `/api/fetal-hydrops/patient/${patientId}`, nurse);
    expect(listPatient.status).toBe(200);
    expect(listPatient.body.episodes.length).toBe(1);

    // 8. Delete episode
    const delEpRes = await call('DELETE', `/api/fetal-hydrops/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);

    const reGet = await call('GET', `/api/fetal-hydrops/episodes/${episodeId}`, doctor);
    expect(reGet.status).toBe(404);
  });

  it('enforces RBAC preventing non-clinical staff (attender) from modifying hydrops records', async () => {
    const forbiddenCreate = await call('POST', '/api/fetal-hydrops/episodes', attender, {
      patientId,
      diagnosisDatetime: '2026-11-08T06:00:00',
      gestationalAgeWeeks: 26.4,
      fetalCompartmentsInvolvedCount: 3,
      ascitesPresent: true,
      pleuralEffusionPresent: true,
      pericardialEffusionPresent: true,
      skinEdemaPresent: false,
      placentalEdemaPresent: true,
      polyhydramniosPresent: true,
      mcaPsvMom: 1.72,
      suspectedEtiologyCategory: 'fetal_anemia_parvovirus_or_hemoglobinopathy',
      status: 'in_utero_intervention_active',
    });
    expect(forbiddenCreate.status).toBe(403);
  });
});
