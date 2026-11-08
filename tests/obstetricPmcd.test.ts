import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricPmcd } from '../web/src/obstetricPmcdEngine.js';

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

describe('Obstetric PMCD & Resuscitative Hysterotomy Engine (Pure Unit Tests)', () => {
  it('evaluates compliant 4-to-5 minute resuscitative hysterotomy in 35w arrest with LUD', () => {
    const res = evaluateObstetricPmcd({
      gestationalAgeWeeks: 35.0,
      initialArrestRhythm: 'pea',
      continuousLeftUterineDisplacement: true,
      pmcdDecisionMinute: 3.5,
      elapsedArrestToDeliveryMinutes: 4.8,
      roscAchievedPostDelivery: true,
      primaryEtiologyBeauChops: 'embolism_afe_pte',
      uterineClosureMethod: 'rapid_single_layer_in_situ',
    });

    expect(res.isAortocavalCompressionSignificant).toBe(true);
    expect(res.isFourMinuteRuleCompliant).toBe(true);
    expect(res.timeComplianceLabel).toContain('Target Met');
    expect(res.alerts.some((a) => a.includes('SEVERE AORTOCAVAL COMPRESSION'))).toBe(true);
    expect(res.operativeHysterotomyDirectives.some((d) => d.includes('ZERO TRANSPORT DELAY'))).toBe(true);
    expect(res.postRoscCareDirectives.some((d) => d.includes('Targeted Temperature Management (TTM)'))).toBe(true);
    expect(res.etiologySpecificDirectives.some((d) => d.includes('Amniotic Fluid Embolism (AFE)'))).toBe(true);
  });

  it('triggers critical alert when left uterine displacement is omitted during chest compressions', () => {
    const res = evaluateObstetricPmcd({
      gestationalAgeWeeks: 28.0,
      initialArrestRhythm: 'asystole',
      continuousLeftUterineDisplacement: false, // VIOLATION
      pmcdDecisionMinute: 6.0, // Delayed
      elapsedArrestToDeliveryMinutes: 8.5,
      roscAchievedPostDelivery: false,
      primaryEtiologyBeauChops: 'bleeding_dic',
      uterineClosureMethod: 'hemostatic_packing_temporary_closure',
    });

    expect(res.isFourMinuteRuleCompliant).toBe(false);
    expect(res.alerts.some((a) => a.includes('CRITICAL CPR VIOLATION: Continuous manual Left Uterine Displacement'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('TIME COMPLIANCE BREACH'))).toBe(true);
  });

  it('recommends 20% lipid emulsion infusion for local anesthetic systemic toxicity (LAST)', () => {
    const res = evaluateObstetricPmcd({
      gestationalAgeWeeks: 38.0,
      initialArrestRhythm: 'ventricular_fibrillation',
      continuousLeftUterineDisplacement: true,
      pmcdDecisionMinute: 4.0,
      elapsedArrestToDeliveryMinutes: 5.0,
      roscAchievedPostDelivery: true,
      primaryEtiologyBeauChops: 'anesthetic_complication_last',
      uterineClosureMethod: 'rapid_single_layer_in_situ',
    });

    expect(res.etiologySpecificDirectives.some((d) => d.includes('20% Lipid Emulsion (Intralipid)'))).toBe(true);
  });
});

describe('Obstetric PMCD Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Meera Maternal Fetal Specialist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ld',
      fullName: 'Nurse Shweta L&D',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ld', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ld', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ld',
      fullName: 'Attender Manoj',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ld', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ld', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Devi (Labor Arrest)',
      dateOfBirth: '1998-05-14',
      phone: '9876543203',
      address: 'L&D Suite 3',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to manage PMCD episodes and nurse to add flowsheet checkpoints', async () => {
    // 1. Evaluate Preview API
    const evalRes = await call('POST', '/api/obstetric-pmcd/evaluate', doctor, {
      gestationalAgeWeeks: 34.5,
      initialArrestRhythm: 'pea',
      continuousLeftUterineDisplacement: true,
      pmcdDecisionMinute: 3.5,
      elapsedArrestToDeliveryMinutes: 4.8,
      roscAchievedPostDelivery: true,
      primaryEtiologyBeauChops: 'embolism_afe_pte',
      uterineClosureMethod: 'rapid_single_layer_in_situ',
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.isFourMinuteRuleCompliant).toBe(true);

    // 2. Create Episode
    const createRes = await call('POST', '/api/obstetric-pmcd/episodes', doctor, {
      patientId,
      arrestDatetime: '2026-11-08T06:00:00',
      gestationalAgeWeeks: 34.5,
      initialArrestRhythm: 'pea',
      cprInitiatedDatetime: '2026-11-08T06:00:30',
      continuousLeftUterineDisplacement: true,
      pmcdDecisionMinute: 3.5,
      incisionDatetime: '2026-11-08T06:03:30',
      infantDeliveryDatetime: '2026-11-08T06:04:45',
      elapsedArrestToDeliveryMinutes: 4.75,
      roscAchievedPostDelivery: true,
      roscDatetime: '2026-11-08T06:05:15',
      primaryEtiologyBeauChops: 'embolism_afe_pte',
      uterineClosureMethod: 'rapid_single_layer_in_situ',
      maternalSurvivalStatus: 'active_icu_targeted_temperature_management',
      neonatalSurvivalStatus: 'nicu_active_hypothermia_hie',
      status: 'post_rosc_intensive_care',
      clinicalNotes: 'Emergent bedside hysterotomy in triage. Rapid delivery restored IVC return with maternal ROSC.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get Episode
    const getRes = await call('GET', `/api/obstetric-pmcd/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.pmcd_decision_minute).toBe(3.5);

    // 4. Update Episode
    const updateRes = await call('PUT', `/api/obstetric-pmcd/episodes/${episodeId}`, doctor, {
      patientId,
      arrestDatetime: '2026-11-08T06:00:00',
      gestationalAgeWeeks: 34.5,
      initialArrestRhythm: 'pea',
      cprInitiatedDatetime: '2026-11-08T06:00:30',
      continuousLeftUterineDisplacement: true,
      pmcdDecisionMinute: 3.5,
      incisionDatetime: '2026-11-08T06:03:30',
      infantDeliveryDatetime: '2026-11-08T06:04:45',
      elapsedArrestToDeliveryMinutes: 4.75,
      roscAchievedPostDelivery: true,
      roscDatetime: '2026-11-08T06:05:15',
      primaryEtiologyBeauChops: 'embolism_afe_pte',
      uterineClosureMethod: 'rapid_single_layer_in_situ',
      maternalSurvivalStatus: 'neurologically_intact_recovery',
      neonatalSurvivalStatus: 'stable_nicu_survivor',
      status: 'convalescent_rehabilitation',
      clinicalNotes: 'Extubated, neurologically intact on Day 3 post-ROSC.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('convalescent_rehabilitation');

    // 5. Nurse adds flowsheet checkpoint
    const flowRes = await call('POST', `/api/obstetric-pmcd/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:20:00',
      minutesPostArrest: 20.0,
      heartRateBpm: 94,
      systolicBp: 104,
      diastolicBp: 62,
      endTidalCo2Mmhg: 36.5,
      pupillaryResponse: 'reactive_equal',
      chestCompressionsQuality: 'rosc_sustained',
      epinephrineCumulativeDoses: 2,
      defibrillationShocksCount: 0,
      bloodProductsTransfusedUnits: 4,
      notes: 'Post-ROSC vitals stable. Normal pupillary response.',
    });
    expect(flowRes.status).toBe(201);
    const flowsheetId = flowRes.body.flowsheetLog.id;

    // 6. Delete Flowsheet
    const delFlowRes = await call('DELETE', `/api/obstetric-pmcd/flowsheet/${flowsheetId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. Attender unauthorized check
    const attenderTry = await call('POST', `/api/obstetric-pmcd/episodes/${episodeId}/flowsheet`, attender, {
      logDatetime: '2026-11-08T06:20:00',
      minutesPostArrest: 20.0,
      heartRateBpm: 94,
      systolicBp: 104,
      diastolicBp: 62,
      endTidalCo2Mmhg: 36.5,
      pupillaryResponse: 'reactive_equal',
      chestCompressionsQuality: 'rosc_sustained',
    });
    expect(attenderTry.status).toBe(403);

    // 8. Delete Episode by Doctor
    const delEpRes = await call('DELETE', `/api/obstetric-pmcd/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });
});
