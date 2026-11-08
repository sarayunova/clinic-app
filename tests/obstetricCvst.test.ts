import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricCvst } from '../web/src/obstetricCvstEngine.js';

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

describe('Obstetric Cerebral Venous Sinus Thrombosis (CVST) Engine (Pure Unit Tests)', () => {
  it('confirms therapeutic anticoagulation is SAFE & MANDATORY despite hemorrhagic venous infarction (ESO/AHA)', () => {
    const res = evaluateObstetricCvst({
      gestationalAgeWeeks: 38.0,
      clinicalTiming: 'early_postpartum_puerperium',
      presentingHeadacheType: 'thunderclap_sudden_severe',
      seizuresPresent: true,
      papilledemaPresent: true,
      focalNeurologicalDeficit: true,
      alteredMentalStatusComa: false,
      thrombosedSinusLocations: ['superior_sagittal_sinus', 'left_transverse_sinus'],
      intracranialHemorrhagicVenousInfarct: true,
      therapeuticAnticoagulationActive: true,
      anticoagulantAgent: 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h',
      intracranialHypertensionManagement: 'elevate_head_bed_and_osmotherapy',
      antiepilepticTherapyActive: true,
    });

    expect(res.isHighRiskCvst).toBe(true);
    expect(res.isAnticoagulationIndicated).toBe(true);
    expect(res.anticoagulationSafeDespiteHemorrhage).toBe(true);
    expect(res.antiepilepticIndicated).toBe(true);
    expect(res.intracranialHypertensionUrgent).toBe(true);
    expect(res.clinicalAlerts.some((a) => a.includes('CRITICAL CVST GUIDELINE RULE'))).toBe(true);
    expect(res.anticoagulationDirectives.some((d) => d.includes('DO NOT withhold therapeutic anticoagulation'))).toBe(true);
    expect(res.antiepilepticDirectives.some((d) => d.includes('Levetiracetam'))).toBe(true);
  });

  it('evaluates subacute low-risk presentation with mild symptoms', () => {
    const res = evaluateObstetricCvst({
      gestationalAgeWeeks: 20.0,
      clinicalTiming: 'antepartum_second_trimester',
      presentingHeadacheType: 'mild_intermittent',
      seizuresPresent: false,
      papilledemaPresent: false,
      focalNeurologicalDeficit: false,
      alteredMentalStatusComa: false,
      thrombosedSinusLocations: ['left_transverse_sinus'],
      intracranialHemorrhagicVenousInfarct: false,
      therapeuticAnticoagulationActive: true,
      anticoagulantAgent: 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h',
      intracranialHypertensionManagement: 'conservative_monitoring',
      antiepilepticTherapyActive: false,
    });

    expect(res.isHighRiskCvst).toBe(false);
    expect(res.isAnticoagulationIndicated).toBe(true);
    expect(res.antiepilepticIndicated).toBe(false);
    expect(res.intracranialHypertensionUrgent).toBe(false);
    expect(res.urgencyCategory).toBe('urgent_therapeutic_anticoagulation');
  });
});

describe('Obstetric Cerebral Venous Sinus Thrombosis (CVST) Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neuromaternal',
      fullName: 'Dr. Sunita Neuro-Obstetrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.neuro',
      fullName: 'Nurse Neha Neuro HDU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.neuro', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.neuro', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.neuro',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.neuro', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.neuro', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Rao (Obstetric CVST)',
      dateOfBirth: '1995-02-14',
      phone: '9876543213',
      address: 'Neuro HDU Bed 2',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, record, flowsheet log, update status, and manage CVST episodes', async () => {
    // 1. Evaluate endpoint
    const evalRes = await call('POST', '/api/obstetric-cvst/evaluate', doctor, {
      gestationalAgeWeeks: 38.0,
      clinicalTiming: 'early_postpartum_puerperium',
      presentingHeadacheType: 'thunderclap_sudden_severe',
      seizuresPresent: true,
      papilledemaPresent: true,
      focalNeurologicalDeficit: true,
      alteredMentalStatusComa: false,
      thrombosedSinusLocations: ['superior_sagittal_sinus'],
      intracranialHemorrhagicVenousInfarct: true,
      therapeuticAnticoagulationActive: true,
      anticoagulantAgent: 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h',
      intracranialHypertensionManagement: 'elevate_head_bed_and_osmotherapy',
      antiepilepticTherapyActive: true,
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.isHighRiskCvst).toBe(true);
    expect(evalRes.body.evaluation.anticoagulationSafeDespiteHemorrhage).toBe(true);

    // 2. Create Episode
    const createRes = await call('POST', '/api/obstetric-cvst/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T07:15:00',
      gestationalAgeWeeks: 38.0,
      clinicalTiming: 'early_postpartum_puerperium',
      presentingHeadacheType: 'thunderclap_sudden_severe',
      seizuresPresent: true,
      papilledemaPresent: true,
      focalNeurologicalDeficit: true,
      alteredMentalStatusComa: false,
      thrombosedSinusLocations: ['superior_sagittal_sinus', 'left_transverse_sinus'],
      intracranialHemorrhagicVenousInfarct: true,
      therapeuticAnticoagulationActive: true,
      anticoagulantAgent: 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h',
      intracranialHypertensionManagement: 'elevate_head_bed_and_osmotherapy',
      antiepilepticTherapyActive: true,
      status: 'therapeutic_anticoagulation_active',
      clinicalNotes: 'Postpartum day 5 CVST with hemorrhagic venous infarction. LMWH active.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('CVST-');

    // 3. Nurse records flowsheet checkpoint
    const flowRes = await call('POST', `/api/obstetric-cvst/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T08:00:00',
      gcsScore: 14,
      pupillaryReactivity: 'equal_and_reactive',
      headacheSeverityNrs: 7,
      systolicBpMmhg: 136,
      diastolicBpMmhg: 84,
      heartRateBpm: 76,
      antiXaOrApttLevel: 0.75,
      seizureActivityObserved: false,
      notes: 'LMWH administered. Anti-Xa within target.',
    });
    expect(flowRes.status).toBe(201);
    expect(flowRes.body.flowsheetLog.id).toBeDefined();
    const logId = flowRes.body.flowsheetLog.id;

    // 4. Retrieve episode with flowsheet & evaluation
    const getRes = await call('GET', `/api/obstetric-cvst/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.flowsheet.length).toBe(1);
    expect(getRes.body.evaluation.anticoagulationSafeDespiteHemorrhage).toBe(true);

    // 5. Status patch
    const patchRes = await call('PATCH', `/api/obstetric-cvst/episodes/${episodeId}/status`, doctor, {
      status: 'convalescent_long_term_anticoagulation',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('convalescent_long_term_anticoagulation');

    // 6. Delete flowsheet log
    const delFlowRes = await call('DELETE', `/api/obstetric-cvst/episodes/${episodeId}/flowsheet/${logId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. List episodes by query and by patient
    const listQuery = await call('GET', `/api/obstetric-cvst/episodes?patientId=${patientId}`, doctor);
    expect(listQuery.status).toBe(200);
    expect(listQuery.body.episodes.length).toBe(1);

    const listPatient = await call('GET', `/api/obstetric-cvst/patient/${patientId}`, nurse);
    expect(listPatient.status).toBe(200);
    expect(listPatient.body.episodes.length).toBe(1);

    // 8. Delete episode
    const delEpRes = await call('DELETE', `/api/obstetric-cvst/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);

    const reGet = await call('GET', `/api/obstetric-cvst/episodes/${episodeId}`, doctor);
    expect(reGet.status).toBe(404);
  });

  it('enforces RBAC preventing non-clinical staff (attender) from modifying CVST records', async () => {
    const forbiddenCreate = await call('POST', '/api/obstetric-cvst/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T07:15:00',
      gestationalAgeWeeks: 38.0,
      clinicalTiming: 'early_postpartum_puerperium',
      presentingHeadacheType: 'thunderclap_sudden_severe',
      status: 'therapeutic_anticoagulation_active',
    });
    expect(forbiddenCreate.status).toBe(403);
  });
});
