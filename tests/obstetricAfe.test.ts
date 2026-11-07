import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  checkClarkCriteria,
  evaluateObstetricAfe,
} from '../web/src/obstetricAfeEngine.js';

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
describe('Obstetric AFE & A-OK Resuscitation Engine (Pure Unit Tests)', () => {
  it('correctly validates Clark 4-Criteria case definition for Amniotic Fluid Embolism', () => {
    // 4 / 4 criteria met -> Confirmed AFE
    const valid = checkClarkCriteria({
      gestationWeeks: 39.5,
      timingRelation: 'during_labor',
      cardiorespiratoryCollapse: true,
      overtDicPresent: true,
      absenceOfFever: true,
    });
    expect(valid.clarkCriteriaMet).toBe(true);
    expect(valid.criteriaMetCount).toBe(4);
    expect(valid.missingCriteria.length).toBe(0);

    // Fever present prior to arrest -> Not AFE (suggests maternal septic shock)
    const withFever = checkClarkCriteria({
      gestationWeeks: 39.0,
      timingRelation: 'during_labor',
      cardiorespiratoryCollapse: true,
      overtDicPresent: true,
      absenceOfFever: false, // Fever present
    });
    expect(withFever.clarkCriteriaMet).toBe(false);
    expect(withFever.criteriaMetCount).toBe(3);
    expect(withFever.missingCriteria[0]).toContain('Absence of fever');
  });

  it('evaluates comprehensive AFE resuscitation including A-OK regimen, cryoprecipitate triggers, and PMCD timer', () => {
    const evaluation = evaluateObstetricAfe({
      gestationWeeks: 39.0,
      timingRelation: 'during_labor',
      cardiorespiratoryCollapse: true,
      overtDicPresent: true,
      absenceOfFever: true,
      fibrinogenMgDl: 110, // Severe hypofibrinogenemia (< 150)
      plateletCount: 65000,
      ptInr: 2.3,
      atropineGiven: true,
      ondansetronGiven: true,
      ketorolacGiven: true,
      fetusInUtero: true,
    });

    expect(evaluation.clarkCriteriaMet).toBe(true);
    expect(evaluation.diagnosisConfidence).toBe('confirmed_afe');
    expect(evaluation.aokRegimenComplete).toBe(true);
    expect(evaluation.coagulopathyRisk).toBe('severe_consumptive_dic');
    expect(evaluation.cryoprecipitateIndicated).toBe(true);
    expect(evaluation.recommendedCryoUnits).toBe(10);
    expect(evaluation.pmcdIndicated).toBe(true);
    expect(evaluation.pmcdTimerMinutesMax).toBe(4);
    expect(evaluation.hemodynamicGuidance.some((g) => g.includes('Right Ventricular'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric AFE REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Meera Patel (Consultant Obstetrician)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.labor',
      fullName: 'Staff Nurse Sunita (Labor Ward)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.labor', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.labor', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.desk',
      fullName: 'Ward Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.desk', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.desk', PW);

    // Parturient patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Rao (G2P1 39w Active Labor Collapse)',
      dateOfBirth: '1996-03-22',
      phone: '+91 98765 77777',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create an obstetric AFE episode and logs audit', async () => {
    const payload = {
      patientId,
      arrestOnsetDatetime: '2026-11-07T09:00:00',
      gestationWeeks: 39.2,
      timingRelation: 'during_labor',
      cardiorespiratoryCollapse: true,
      overtDicPresent: true,
      absenceOfFever: true,
      atropineGiven: true,
      ondansetronGiven: true,
      ketorolacGiven: true,
      fibrinogenMgDl: 120,
      plateletCount: 72000,
      ptInr: 2.1,
      mtpActivated: true,
      prbcTransfusedUnits: 4,
      ffpTransfusedUnits: 4,
      plateletsTransfusedUnits: 2,
      cryoprecipitateUnits: 10,
      pmcdPerformed: true,
      pmcdDecisionToDeliveryMinutes: 3.5,
      ecmoInitiated: false,
      status: 'acute_resuscitation',
      clinicalNotes: 'Sudden collapse during second stage. A-OK given within 2 minutes. Bedside PMCD performed at 3.5 minutes with ROSC.',
    };

    const res = await call('POST', '/api/obstetric-afe/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.clark_criteria_met).toBe(1);
    expect(res.body.episode.aok_regimen_complete).toBe(1);

    // Verify audit log
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'obstetric_afe.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record serial resuscitation flowsheet checkpoints', async () => {
    const epRes = await call('POST', '/api/obstetric-afe/episodes', doctor, {
      patientId,
      arrestOnsetDatetime: '2026-11-07T08:30:00',
      gestationWeeks: 38.5,
      timingRelation: 'cesarean_delivery',
      cardiorespiratoryCollapse: true,
      overtDicPresent: true,
      absenceOfFever: true,
      status: 'acute_resuscitation',
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Nurse records 15-minute post-arrest checkpoint
    const fsRes = await call('POST', `/api/obstetric-afe/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T08:45:00',
      minutesFromArrest: 15,
      sbpMmhg: 90,
      dbpMmhg: 55,
      hrBpm: 118,
      spo2Percent: 94,
      etco2Mmhg: 28,
      vasopressorActive: 'norepinephrine',
      fibrinogenMgDl: 130,
      plateletCount: 68000,
      inr: 2.0,
      qblTotalMl: 2400,
      notes: 'ROSC maintained on Norepinephrine 0.15 mcg/kg/min. Transfusing 2nd MTP pack with Cryo.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();

    // Fetch episode detail and check flowsheet array
    const detail = await call('GET', `/api/obstetric-afe/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].sbp_mmhg).toBe(90);
  });

  it('allows doctor to update episode status and delete records', async () => {
    const epRes = await call('POST', '/api/obstetric-afe/episodes', doctor, {
      patientId,
      arrestOnsetDatetime: '2026-11-07T08:00:00',
      gestationWeeks: 39.0,
      timingRelation: 'during_labor',
      cardiorespiratoryCollapse: true,
      overtDicPresent: true,
      absenceOfFever: true,
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Doctor updates episode
    const patchRes = await call('PATCH', `/api/obstetric-afe/episodes/${epId}`, doctor, {
      status: 'post_cardiac_arrest_icu',
      clinicalNotes: 'Hemodynamics stabilized. Transferred to ICU with arterial line and central venous catheter.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('post_cardiac_arrest_icu');

    // Doctor deletes episode
    const delRes = await call('DELETE', `/api/obstetric-afe/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/obstetric-afe/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating AFE episodes', async () => {
    const res = await call('POST', '/api/obstetric-afe/episodes', attender, {
      patientId,
      arrestOnsetDatetime: '2026-11-07T08:00:00',
      gestationWeeks: 39.0,
      timingRelation: 'during_labor',
      cardiorespiratoryCollapse: true,
      overtDicPresent: true,
      absenceOfFever: true,
    });
    expect(res.status).toBe(403);
  });
});
