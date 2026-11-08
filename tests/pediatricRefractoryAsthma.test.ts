import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricRefractoryAsthma } from '../web/src/pediatricRefractoryAsthmaEngine.js';

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

describe('Pediatric Refractory Status Asthmaticus Resuscitation Engine (Pure Unit Tests)', () => {
  it('detects impending hypercapnic respiratory arrest (pCO2 >= 42, pH <= 7.28, silent chest) and generates weight-based infusion directives', () => {
    const res = evaluatePediatricRefractoryAsthma({
      ageYears: 6.5,
      weightKg: 22.0,
      initialPediatricAsthmaScore: 11,
      respiratoryRate: 54,
      heartRateBpm: 162,
      spo2Percent: 87.0,
      pco2Mmhg: 46.0,
      phValue: 7.24,
      silentChestOrExhaustion: true,
      refractoryToFirstLine: true,
      continuousIvTerbutalineActive: true,
      terbutalineDoseMcgKgMin: 1.5,
      ivKetamineInfusionActive: true,
      ketamineDoseMgKgHr: 1.0,
      helioxInhalationActive: true,
      helioxMixtureRatio: 'heliox_70_30',
      ivTheophyllineAminophyllineActive: false,
      ventilatorySupportMode: 'bipap_noninvasive_positive_pressure',
      status: 'second_line_iv_bronchodilator_infusion',
    });

    expect(res.isImpendingRespiratoryArrest).toBe(true);
    expect(res.isRefractoryToStandardTherapy).toBe(true);
    expect(res.terbutalineIndicated).toBe(true);
    expect(res.ketamineIndicated).toBe(true);
    expect(res.severityCategory).toBe('imminent_arrest_extremis');
    expect(res.terbutalineDosingDirectives.initialBolusMcgKg).toBe(2.0);
    expect(res.terbutalineDosingDirectives.maxRateMcgKgMin).toBe(6.0);
    expect(res.ketamineDosingDirectives.bolusDoseMgKg).toBe(1.0);
    expect(res.ketamineDosingDirectives.maxRateMgKgHr).toBe(2.0);
    expect(res.clinicalAlerts.some((a) => a.includes('IMPENDING RESPIRATORY ARREST'))).toBe(true);
    expect(res.ventilatoryStrategyDirectives.permissiveHypercapniaTarget).toContain('pH >= 7.20');
  });

  it('evaluates moderate refractory episode without hypercapnic arrest', () => {
    const res = evaluatePediatricRefractoryAsthma({
      ageYears: 8.0,
      weightKg: 28.0,
      initialPediatricAsthmaScore: 8,
      respiratoryRate: 36,
      heartRateBpm: 130,
      spo2Percent: 93.0,
      pco2Mmhg: 35.0,
      phValue: 7.36,
      silentChestOrExhaustion: false,
      refractoryToFirstLine: true,
      continuousIvTerbutalineActive: false,
      terbutalineDoseMcgKgMin: 0.0,
      ivKetamineInfusionActive: false,
      ketamineDoseMgKgHr: 0.0,
      helioxInhalationActive: false,
      helioxMixtureRatio: 'none',
      ivTheophyllineAminophyllineActive: false,
      ventilatorySupportMode: 'high_flow_nasal_cannula',
      status: 'impending_respiratory_failure',
    });

    expect(res.isImpendingRespiratoryArrest).toBe(false);
    expect(res.severityCategory).toBe('severe_acute_asthma');
  });
});

describe('Pediatric Refractory Status Asthmaticus Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.picu',
      fullName: 'Dr. Aarav Pediatric Intensivist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Nurse Kavita PICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.picu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.picu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.picu',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.picu', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.picu', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Patel (Refractory Asthma)',
      dateOfBirth: '2020-05-10',
      phone: '9876543214',
      address: 'PICU Bay 1',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, create, log flowsheet, patch status, and manage PICU asthma episodes', async () => {
    // 1. Evaluate endpoint
    const evalRes = await call('POST', '/api/pediatric-refractory-asthma/evaluate', doctor, {
      ageYears: 6.5,
      weightKg: 22.0,
      initialPediatricAsthmaScore: 11,
      respiratoryRate: 54,
      heartRateBpm: 162,
      spo2Percent: 87.0,
      pco2Mmhg: 46.0,
      phValue: 7.24,
      silentChestOrExhaustion: true,
      refractoryToFirstLine: true,
      continuousIvTerbutalineActive: true,
      terbutalineDoseMcgKgMin: 1.5,
      ivKetamineInfusionActive: true,
      ketamineDoseMgKgHr: 1.0,
      helioxInhalationActive: true,
      helioxMixtureRatio: 'heliox_70_30',
      ivTheophyllineAminophyllineActive: false,
      ventilatorySupportMode: 'bipap_noninvasive_positive_pressure',
      status: 'second_line_iv_bronchodilator_infusion',
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.isImpendingRespiratoryArrest).toBe(true);

    // 2. Create Episode
    const createRes = await call('POST', '/api/pediatric-refractory-asthma/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T08:30:00',
      ageYears: 6.5,
      weightKg: 22.0,
      initialPediatricAsthmaScore: 11,
      respiratoryRate: 54,
      heartRateBpm: 162,
      spo2Percent: 87.0,
      pco2Mmhg: 46.0,
      phValue: 7.24,
      silentChestOrExhaustion: true,
      refractoryToFirstLine: true,
      continuousIvTerbutalineActive: true,
      terbutalineDoseMcgKgMin: 1.5,
      ivKetamineInfusionActive: true,
      ketamineDoseMgKgHr: 1.0,
      helioxInhalationActive: true,
      helioxMixtureRatio: 'heliox_70_30',
      ivTheophyllineAminophyllineActive: false,
      ventilatorySupportMode: 'bipap_noninvasive_positive_pressure',
      status: 'second_line_iv_bronchodilator_infusion',
      clinicalNotes: 'Refractory status asthmaticus with diaphragmatic exhaustion. Commencing Terbutaline & Ketamine.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('RAST-');

    // 3. Nurse records flowsheet checkpoint
    const flowRes = await call('POST', `/api/pediatric-refractory-asthma/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T09:00:00',
      hoursFromPicuAdmission: 0.5,
      respiratoryRate: 50,
      heartRateBpm: 158,
      spo2Percent: 90.0,
      pco2Mmhg: 44.0,
      phValue: 7.26,
      terbutalineInfusionRate: 1.5,
      ketamineInfusionRate: 1.0,
      inspiratoryExpiratoryRatio: '1_to_3',
      airEntryAuscultation: 'markedly_reduced_poor_air_movement',
      notes: 'Ketamine bolus given. Patient calmer.',
    });
    expect(flowRes.status).toBe(201);
    expect(flowRes.body.flowsheetLog.id).toBeDefined();
    const logId = flowRes.body.flowsheetLog.id;

    // 4. Retrieve episode with flowsheet & evaluation
    const getRes = await call('GET', `/api/pediatric-refractory-asthma/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.flowsheet.length).toBe(1);
    expect(getRes.body.evaluation.isImpendingRespiratoryArrest).toBe(true);

    // 5. Status patch
    const patchRes = await call('PATCH', `/api/pediatric-refractory-asthma/episodes/${episodeId}/status`, doctor, {
      status: 'bronchospasm_relieving_weaning',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('bronchospasm_relieving_weaning');

    // 6. Delete flowsheet log
    const delFlowRes = await call('DELETE', `/api/pediatric-refractory-asthma/episodes/${episodeId}/flowsheet/${logId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. List episodes by query and by patient
    const listQuery = await call('GET', `/api/pediatric-refractory-asthma/episodes?patientId=${patientId}`, doctor);
    expect(listQuery.status).toBe(200);
    expect(listQuery.body.episodes.length).toBe(1);

    const listPatient = await call('GET', `/api/pediatric-refractory-asthma/patient/${patientId}`, nurse);
    expect(listPatient.status).toBe(200);
    expect(listPatient.body.episodes.length).toBe(1);

    // 8. Delete episode
    const delEpRes = await call('DELETE', `/api/pediatric-refractory-asthma/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);

    const reGet = await call('GET', `/api/pediatric-refractory-asthma/episodes/${episodeId}`, doctor);
    expect(reGet.status).toBe(404);
  });

  it('enforces RBAC preventing non-clinical staff (attender) from modifying refractory asthma records', async () => {
    const forbiddenCreate = await call('POST', '/api/pediatric-refractory-asthma/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T08:30:00',
      ageYears: 6.5,
      weightKg: 22.0,
      initialPediatricAsthmaScore: 11,
      respiratoryRate: 54,
      heartRateBpm: 162,
      spo2Percent: 87.0,
      pco2Mmhg: 46.0,
      phValue: 7.24,
      status: 'second_line_iv_bronchodilator_infusion',
    });
    expect(forbiddenCreate.status).toBe(403);
  });
});
