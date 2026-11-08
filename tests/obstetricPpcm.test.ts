import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import { evaluateObstetricPpcm } from '../web/src/obstetricPpcmEngine.js';

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
describe('Obstetric PPCM & BOARD Protocol (Pure Unit Tests)', () => {
  it('correctly stratifies LVEF and prescribes Intensive vs Standard Bromocriptine', () => {
    // Case 1: Severe PPCM (LVEF 28% < 35%) -> Intensive Bromocriptine regimen
    const severe = evaluateObstetricPpcm({
      timingCategory: 'postpartum_first_month',
      nyhaClass: 'class_iv',
      lvefPercent: 28,
      lveddMm: 62,
      pulmonaryEdemaPresent: true,
      cardiogenicShockPresent: false,
      bromocriptineRegimen: 'intensive_2_5mg_bid_2weeks_then_daily_6weeks',
      bromocriptineInitiated: true,
      anticoagulationPrescribed: true,
      anticoagulationAgent: 'lmwh_therapeutic',
      loopDiureticGiven: true,
      betaBlockerGiven: true,
      vasodilatorAgent: 'hydralazine_nitrates_pregnancy_safe',
    });

    expect(severe.ppcmDiagnosed).toBe(true);
    expect(severe.lvefSeverityTier).toBe('severe_dysfunction_lt_35');
    expect(severe.recommendedBromocriptineRegimen).toBe('intensive_2_5mg_bid_2weeks_then_daily_6weeks');
    expect(severe.anticoagulationMandatory).toBe(true);
    expect(severe.anticoagulationAuditDeficiency).toBe(false);

    // Case 2: Mild/Moderate PPCM (LVEF 38%) -> Standard Bromocriptine regimen
    const mild = evaluateObstetricPpcm({
      timingCategory: 'postpartum_months_2_to_5',
      nyhaClass: 'class_ii',
      lvefPercent: 38,
      pulmonaryEdemaPresent: false,
      cardiogenicShockPresent: false,
      bromocriptineRegimen: 'standard_2_5mg_daily_1week',
      bromocriptineInitiated: true,
      anticoagulationPrescribed: true,
      anticoagulationAgent: 'lmwh_prophylactic',
      loopDiureticGiven: false,
      betaBlockerGiven: true,
      vasodilatorAgent: 'acei_arb_arni_strictly_postpartum_non_lactating',
    });

    expect(mild.ppcmDiagnosed).toBe(true);
    expect(mild.lvefSeverityTier).toBe('mild_moderate_impairment_35_to_44');
    expect(mild.recommendedBromocriptineRegimen).toBe('standard_2_5mg_daily_1week');
    expect(mild.anticoagulationAuditDeficiency).toBe(false);

    // Case 3: Preserved LVEF (52%) -> No PPCM diagnosis
    const preserved = evaluateObstetricPpcm({
      timingCategory: 'postpartum_first_month',
      nyhaClass: 'class_i',
      lvefPercent: 52,
      pulmonaryEdemaPresent: false,
      cardiogenicShockPresent: false,
      bromocriptineRegimen: 'none',
      bromocriptineInitiated: false,
      anticoagulationPrescribed: false,
      anticoagulationAgent: 'none',
      loopDiureticGiven: false,
      betaBlockerGiven: false,
      vasodilatorAgent: 'none',
    });

    expect(preserved.ppcmDiagnosed).toBe(false);
    expect(preserved.lvefSeverityTier).toBe('normal_or_recovered');
    expect(preserved.recommendedBromocriptineRegimen).toBe('none');
  });

  it('triggers critical safety audit deficiency when Bromocriptine or severe EF lacks anticoagulation', () => {
    // Bromocriptine initiated but anticoagulation not prescribed -> severe deficiency
    const auditFailure = evaluateObstetricPpcm({
      timingCategory: 'postpartum_first_month',
      nyhaClass: 'class_iii',
      lvefPercent: 32,
      pulmonaryEdemaPresent: true,
      cardiogenicShockPresent: false,
      bromocriptineRegimen: 'intensive_2_5mg_bid_2weeks_then_daily_6weeks',
      bromocriptineInitiated: true,
      anticoagulationPrescribed: false, // OMISSION
      anticoagulationAgent: 'none',
      loopDiureticGiven: true,
      betaBlockerGiven: false,
      vasodilatorAgent: 'none',
    });

    expect(auditFailure.anticoagulationMandatory).toBe(true);
    expect(auditFailure.anticoagulationAuditDeficiency).toBe(true);
    expect(auditFailure.criticalActionPlan.some((p) => p.includes('CRITICAL SAFETY AUDIT ERROR'))).toBe(true);
  });

  it('evaluates complete BOARD protocol compliance and provides antepartum delivery guidance', () => {
    // Antepartum with cardiogenic shock
    const antepartumShock = evaluateObstetricPpcm({
      timingCategory: 'antepartum_late_third_trimester',
      gestationalAgeWeeks: 34,
      nyhaClass: 'class_iv',
      lvefPercent: 24,
      pulmonaryEdemaPresent: true,
      cardiogenicShockPresent: true,
      bromocriptineRegimen: 'intensive_2_5mg_bid_2weeks_then_daily_6weeks',
      bromocriptineInitiated: true,
      anticoagulationPrescribed: true,
      anticoagulationAgent: 'unfractionated_heparin',
      loopDiureticGiven: true,
      betaBlockerGiven: false,
      vasodilatorAgent: 'hydralazine_nitrates_pregnancy_safe',
    });

    expect(antepartumShock.isAntepartum).toBe(true);
    expect(antepartumShock.boardProtocolCompliance.bromocriptineCompliant).toBe(true);
    expect(antepartumShock.boardProtocolCompliance.anticoagulationCompliant).toBe(true);
    expect(antepartumShock.boardProtocolCompliance.oralHfCompliant).toBe(false); // Beta blocker pending
    expect(antepartumShock.deliveryPlanningGuidance).toContain('URGENT MULTIDISCIPLINARY DELIVERY');
    expect(antepartumShock.deliveryPlanningGuidance).toContain('ECMO/Impella readiness');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric PPCM REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.cardioobstetrics',
      fullName: 'Dr. Sunita Rao (Cardio-Obstetrics)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.icuheart',
      fullName: 'Nurse Meena (Cardiac CCU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.icuheart', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.icuheart', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.icuheart',
      fullName: 'Cardiac Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.icuheart', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.icuheart', PW);

    // Create a demo postpartum patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Sharma (P3L3)',
      dateOfBirth: '1996-05-12',
      phone: '+91 99887 66554',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews PPCM evaluation without database persistence', async () => {
    const res = await call('POST', '/api/obstetric-ppcm/evaluate', doctor, {
      timingCategory: 'postpartum_first_month',
      nyhaClass: 'class_iii',
      lvefPercent: 30,
      pulmonaryEdemaPresent: true,
      cardiogenicShockPresent: false,
      bromocriptineRegimen: 'intensive_2_5mg_bid_2weeks_then_daily_6weeks',
      bromocriptineInitiated: true,
      anticoagulationPrescribed: true,
      anticoagulationAgent: 'lmwh_therapeutic',
      loopDiureticGiven: true,
      betaBlockerGiven: true,
      vasodilatorAgent: 'hydralazine_nitrates_pregnancy_safe',
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.ppcmDiagnosed).toBe(true);
    expect(res.body.evalResult.lvefSeverityTier).toBe('severe_dysfunction_lt_35');
    expect(res.body.evalResult.boardProtocolCompliance.bromocriptineCompliant).toBe(true);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const presentationTime = new Date().toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/obstetric-ppcm/episodes', attender, {
      patientId,
      presentationDatetime: presentationTime,
      timingCategory: 'postpartum_first_month',
      nyhaClass: 'class_iv',
      lvefPercent: 28,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/obstetric-ppcm/episodes', doctor, {
      patientId,
      presentationDatetime: presentationTime,
      maternalAge: 30,
      daysPostpartum: 8,
      timingCategory: 'postpartum_first_month',
      nyhaClass: 'class_iv',
      lvefPercent: 28,
      lveddMm: 60,
      ntProbnpPgMl: 4850,
      troponinINgMl: 0.12,
      pulmonaryEdemaPresent: true,
      cardiogenicShockPresent: false,
      bromocriptineRegimen: 'intensive_2_5mg_bid_2weeks_then_daily_6weeks',
      bromocriptineInitiated: true,
      anticoagulationPrescribed: true,
      anticoagulationAgent: 'lmwh_therapeutic',
      loopDiureticGiven: true,
      betaBlockerGiven: true,
      vasodilatorAgent: 'hydralazine_nitrates_pregnancy_safe',
      status: 'acute_decompensation',
      clinicalNotes: 'Severe postpartum PPCM Day 8 with acute pulmonary congestion. Intensive BOARD protocol instituted with enoxaparin anticoagulation.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('PPCM-');
    expect(createRes.body.evalResult.ppcmDiagnosed).toBe(true);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/obstetric-ppcm/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/obstetric-ppcm/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.lvefSeverityTier).toBe('severe_dysfunction_lt_35');
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/obstetric-ppcm/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromPresentation: 6,
      heartRateBpm: 88,
      bloodPressureSys: 114,
      bloodPressureDia: 72,
      respiratoryRate: 18,
      spo2Percent: 98,
      oxygenRequirementLMin: 2,
      urineOutputMlHr: 65,
      fluidBalanceCumulativeMl: -800,
      orthopneaPillows: 2,
      inotropicSupport: 'none',
      notes: 'Post-IV furosemide 40 mg: Orthopnea markedly improved. Clear breath sounds.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/obstetric-ppcm/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to stabilized_on_board_protocol
    const updateRes = await call('PATCH', `/api/obstetric-ppcm/episodes/${episodeId}`, doctor, {
      status: 'stabilized_on_board_protocol',
      clinicalNotes: 'Significant clinical recovery. Euvolemic, transitioned to oral medications.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('stabilized_on_board_protocol');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/obstetric-ppcm/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/obstetric-ppcm/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/obstetric-ppcm/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/obstetric-ppcm/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
