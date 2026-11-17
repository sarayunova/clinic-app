import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricAcuteLiverFailure } from '../web/src/pediatricAcuteLiverFailureEngine.js';

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

describe('Pediatric Acute Liver Failure Engine (Pure Unit Tests)', () => {
  it('confirms PALF diagnosis and identifies King\'s College positive indications for emergency transplant', () => {
    const res = evaluatePediatricAcuteLiverFailure({
      ageMonths: 60, // 5 years (< 10 years factor)
      weightKg: 18.0,
      suspectedEtiology: 'viral_hepatitis', // Non-APAP adverse etiology
      encephalopathyStage: 2,
      inr: 3.6, // > 3.5 factor
      totalBilirubinMgDl: 18.5, // > 17.5 factor
      altUL: 2100,
      astUL: 2350,
      serumAmmoniaUmolL: 130, // Elevated > 100
      bloodGlucoseMgDl: 72,
      serumSodiumMeqL: 142,
      serumCreatinineMgDl: 0.65,
      hasCerebralEdema: true,
    });

    expect(res.isPalfConfirmed).toBe(true);
    expect(res.palfSeverityCategory).toBe('fulminant_hepatic_failure');
    expect(res.kingsCollege.isCriteriaMet).toBe(true);
    expect(res.kingsCollege.transplantListingUrgency).toBe('immediate_emergency_listing');
    expect(res.neuroprotectionPlan.isCerebralEdemaHighRisk).toBe(true);
    expect(res.neuroprotectionPlan.targetSodiumMeqL).toContain('145 - 150');
    expect(res.clinicalAlerts.some((a) => a.includes('King\'s College') || a.includes('EMERGENCY TRANSPLANT'))).toBe(true);
  });

  it('recognizes isolated acute hepatitis when INR < 1.5 without encephalopathy (non-PALF)', () => {
    const res = evaluatePediatricAcuteLiverFailure({
      ageMonths: 72,
      weightKg: 22.0,
      suspectedEtiology: 'viral_hepatitis',
      encephalopathyStage: 0,
      inr: 1.2,
      totalBilirubinMgDl: 4.2,
      altUL: 850,
      astUL: 920,
      bloodGlucoseMgDl: 95,
      hasCerebralEdema: false,
    });

    expect(res.isPalfConfirmed).toBe(false);
    expect(res.palfSeverityCategory).toBe('mild_acute_hepatitis');
    expect(res.kingsCollege.isCriteriaMet).toBe(false);
    expect(res.kingsCollege.transplantListingUrgency).toBe('supportive_observation');
  });
});

describe('Pediatric Acute Liver Failure Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedhepatologist',
      fullName: 'Dr. Anand Pediatric Hepatologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Nurse Priya PICU',
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
      fullName: 'Attender Suresh',
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
      fullName: 'Master Aarav (PALF)',
      dateOfBirth: '2022-05-10',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('runs evaluate preview endpoint successfully', async () => {
    const res = await call('POST', '/api/pediatric-acute-liver-failure/evaluate', doctor, {
      ageMonths: 48,
      weightKg: 16.0,
      suspectedEtiology: 'viral_hepatitis',
      encephalopathyStage: 2,
      inr: 2.8,
      totalBilirubinMgDl: 15.0,
      altUL: 1800,
      astUL: 1950,
      bloodGlucoseMgDl: 80,
    });
    expect(res.status).toBe(200);
    expect(res.body.evaluation.isPalfConfirmed).toBe(true);
  });

  it('allows doctor and nurse to manage PALF episode and flowsheet; blocks attender; restricts delete to doctor', async () => {
    // Attender blocked from creating
    const attenderTry = await call('POST', '/api/pediatric-acute-liver-failure/episodes', attender, {
      patientId,
      diagnosisDatetime: '2026-11-12T03:00:00',
      ageMonths: 48,
      weightKg: 16.0,
      suspectedEtiology: 'viral_hepatitis',
      encephalopathyStage: 1,
      inr: 2.5,
      totalBilirubinMgDl: 12.0,
      altUL: 1500,
      astUL: 1600,
      bloodGlucoseMgDl: 85,
    });
    expect(attenderTry.status).toBe(403);

    // Nurse creates episode
    const nurseCreate = await call('POST', '/api/pediatric-acute-liver-failure/episodes', nurse, {
      patientId,
      diagnosisDatetime: '2026-11-12T03:00:00',
      ageMonths: 48,
      weightKg: 16.0,
      suspectedEtiology: 'viral_hepatitis',
      encephalopathyStage: 1,
      inr: 2.5,
      totalBilirubinMgDl: 12.0,
      altUL: 1500,
      astUL: 1600,
      bloodGlucoseMgDl: 85,
      hypertonicSaline3pctActive: true,
      nacInfusionActive: true,
    });
    expect(nurseCreate.status).toBe(200);
    const episodeId = nurseCreate.body.id;

    // Get episode by ID
    const getRes = await call('GET', `/api/pediatric-acute-liver-failure/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.inr).toBe(2.5);

    // Nurse adds flowsheet log
    const logRes = await call('POST', `/api/pediatric-acute-liver-failure/episodes/${episodeId}/flowsheet`, nurse, {
      recordedAt: '2026-11-12T04:00:00',
      encephalopathyStage: 1,
      pupilReactivity: 'brisk_equal',
      meanArterialPressureMmhg: 72,
      heartRateBpm: 108,
      gcsScore: 14,
      serumSodiumMeqL: 146,
      serumAmmoniaUmolL: 98,
      dailyStoolCount: 2,
      nurseNotes: 'Child alert on gentle touch, obeying verbal commands.',
    });
    expect(logRes.status).toBe(200);
    const logId = logRes.body.id;

    // Patch status
    const statusRes = await call('PATCH', `/api/pediatric-acute-liver-failure/episodes/${episodeId}/status`, nurse, {
      status: 'stabilized',
    });
    expect(statusRes.status).toBe(200);

    // Nurse attempts delete episode -> 403 Forbidden
    const nurseDel = await call('DELETE', `/api/pediatric-acute-liver-failure/episodes/${episodeId}`, nurse);
    expect(nurseDel.status).toBe(403);

    // Nurse deletes flowsheet log -> 200 OK
    const delLog = await call('DELETE', `/api/pediatric-acute-liver-failure/episodes/${episodeId}/flowsheet/${logId}`, nurse);
    expect(delLog.status).toBe(200);

    // Doctor deletes episode -> 200 OK
    const docDel = await call('DELETE', `/api/pediatric-acute-liver-failure/episodes/${episodeId}`, doctor);
    expect(docDel.status).toBe(200);
  });
});
