import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricDic } from '../web/src/obstetricDicEngine.js';

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

describe('Obstetric DIC & Fibrinogen Engine (Pure Unit Tests)', () => {
  it('detects overt DIC and calculates cryoprecipitate requirements when fibrinogen < 200 mg/dL', () => {
    const res = evaluateObstetricDic({
      gestationalAgeWeeks: 37.0,
      clinicalTrigger: 'severe_pph',
      plateletCountKUl: 65, // < 100k -> 1 point
      fibrinogenMgDl: 120, // < 300 mg/dL -> 2 points, severe deficit
      inr: 1.6, // > 1.5 -> 2 points
      dDimerUgMl: 6.0, // > 5 -> 2 points
      estimatedBloodLossMl: 2000,
      overtBleedingSites: 'surgical_site_oozing',
      isMtpActivated: true,
      ionizedCalciumMmolL: 1.05,
      coreTemperatureC: 35.5,
    });

    expect(res.modifiedIsthDicScore).toBe(7); // 1 + 2 + 2 + 2 = 7
    expect(res.isOvertDic).toBe(true);
    expect(res.severityCategory).toBe('overt_consumptive_dic');
    expect(res.fibrinogenPlan.isCriticalHypofibrinogenemia).toBe(true);
    expect(res.fibrinogenPlan.fibrinogenDeficitMgDl).toBe(80); // 200 - 120
    expect(res.fibrinogenPlan.recommendedCryoprecipitateUnits).toBeGreaterThanOrEqual(10);
    expect(res.mtpPlan.isMtpIndicated).toBe(true);
    expect(res.mtpPlan.txaDosingDirectives).toContain('Tranexamic Acid');
    expect(res.clinicalAlerts.some((a) => a.includes('CRITICAL HYPOFIBRINOGENEMIA'))).toBe(true);
  });

  it('correctly assesses mild compensated coagulopathy when fibrinogen is preserved (> 300 mg/dL)', () => {
    const res = evaluateObstetricDic({
      gestationalAgeWeeks: 38.0,
      clinicalTrigger: 'severe_pph',
      plateletCountKUl: 140,
      fibrinogenMgDl: 350,
      inr: 1.1,
      estimatedBloodLossMl: 700,
      overtBleedingSites: 'none',
      isMtpActivated: false,
    });

    expect(res.isOvertDic).toBe(false);
    expect(res.fibrinogenPlan.isCriticalHypofibrinogenemia).toBe(false);
    expect(res.fibrinogenPlan.recommendedCryoprecipitateUnits).toBe(0);
    expect(res.mtpPlan.isMtpIndicated).toBe(false);
  });
});

describe('Obstetric DIC Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.maternalfetal',
      fullName: 'Dr. Sunita Maternal Specialist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.labour',
      fullName: 'Nurse Deepa Labour Ward',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.labour', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.labour', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ward',
      fullName: 'Attender Ramesh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ward', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ward', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Rao (Obstetric DIC)',
      dateOfBirth: '1995-06-20',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('runs evaluate preview endpoint successfully', async () => {
    const res = await call('POST', '/api/obstetric-dic/evaluate', doctor, {
      clinicalTrigger: 'severe_pph',
      plateletCountKUl: 75,
      fibrinogenMgDl: 140,
      inr: 1.5,
      estimatedBloodLossMl: 1500,
    });
    expect(res.status).toBe(200);
    expect(res.body.evaluation.fibrinogenPlan.isCriticalHypofibrinogenemia).toBe(true);
  });

  it('allows doctor and nurse to manage DIC episode and flowsheet; blocks attender; restricts delete to doctor', async () => {
    // Attender blocked from creating
    const attenderTry = await call('POST', '/api/obstetric-dic/episodes', attender, {
      patientId,
      diagnosisDatetime: '2026-11-12T04:00:00',
      clinicalTrigger: 'placental_abruption',
      plateletCountKUl: 80,
      fibrinogenMgDl: 150,
      inr: 1.45,
      estimatedBloodLossMl: 1200,
      overtBleedingSites: 'surgical_site_oozing',
    });
    expect(attenderTry.status).toBe(403);

    // Nurse creates episode
    const nurseCreate = await call('POST', '/api/obstetric-dic/episodes', nurse, {
      patientId,
      diagnosisDatetime: '2026-11-12T04:00:00',
      clinicalTrigger: 'placental_abruption',
      plateletCountKUl: 80,
      fibrinogenMgDl: 150,
      inr: 1.45,
      estimatedBloodLossMl: 1200,
      overtBleedingSites: 'surgical_site_oozing',
      isMtpActivated: true,
      cryoprecipitateUnitsGiven: 10,
    });
    expect(nurseCreate.status).toBe(200);
    const episodeId = nurseCreate.body.id;

    // Get episode by ID
    const getRes = await call('GET', `/api/obstetric-dic/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.fibrinogen_mg_dl).toBe(150);

    // Nurse adds flowsheet log
    const logRes = await call('POST', `/api/obstetric-dic/episodes/${episodeId}/flowsheet`, nurse, {
      recordedAt: '2026-11-12T05:00:00',
      systolicBp: 96,
      diastolicBp: 60,
      heartRateBpm: 110,
      hourlyBloodLossMl: 200,
      serialFibrinogenMgDl: 185,
      clinicalHemostasisState: 'partial_clot_formation',
      bloodComponentsInfused: '10 Units Cryo given',
    });
    expect(logRes.status).toBe(200);
    const logId = logRes.body.id;

    // Patch status
    const statusRes = await call('PATCH', `/api/obstetric-dic/episodes/${episodeId}/status`, nurse, {
      status: 'stabilized',
    });
    expect(statusRes.status).toBe(200);

    // Nurse attempts delete episode -> 403 Forbidden
    const nurseDel = await call('DELETE', `/api/obstetric-dic/episodes/${episodeId}`, nurse);
    expect(nurseDel.status).toBe(403);

    // Nurse deletes flowsheet log -> 200 OK
    const delLog = await call('DELETE', `/api/obstetric-dic/episodes/${episodeId}/flowsheet/${logId}`, nurse);
    expect(delLog.status).toBe(200);

    // Doctor deletes episode -> 200 OK
    const docDel = await call('DELETE', `/api/obstetric-dic/episodes/${episodeId}`, doctor);
    expect(docDel.status).toBe(200);
  });
});
