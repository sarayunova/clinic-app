import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  classifyIcpSeverity,
  calculateDeliveryTiming,
  evaluateObstetricIcp,
} from '../web/src/obstetricIcpEngine.js';

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
describe('Obstetric ICP & Bile Acids Engine (Pure Unit Tests)', () => {
  it('classifies ICP severity based on fasting Total Serum Bile Acids (TSBA)', () => {
    expect(classifyIcpSeverity(18.5)).toBe('mild_10_39');
    expect(classifyIcpSeverity(39.9)).toBe('mild_10_39');
    expect(classifyIcpSeverity(40.0)).toBe('moderate_40_99');
    expect(classifyIcpSeverity(78.2)).toBe('moderate_40_99');
    expect(classifyIcpSeverity(100.0)).toBe('severe_ge_100');
    expect(classifyIcpSeverity(145.0)).toBe('severe_ge_100');
  });

  it('calculates evidence-based delivery timing according to SMFM 2021 & ACOG guidelines', () => {
    const mild = calculateDeliveryTiming('mild_10_39');
    expect(mild.minWeeks).toBe(37.0);
    expect(mild.maxWeeks).toBe(39.0);

    const moderate = calculateDeliveryTiming('moderate_40_99');
    expect(moderate.minWeeks).toBe(36.0);
    expect(moderate.maxWeeks).toBe(39.0);

    const severe = calculateDeliveryTiming('severe_ge_100');
    expect(severe.minWeeks).toBe(35.0);
    expect(severe.maxWeeks).toBe(36.0);
    expect(severe.rationale).toContain('3.4% risk of sudden unexpected intrauterine fetal demise');
  });

  it('evaluates comprehensive ICP risk with UDCA dosing and surveillance plan', () => {
    // Severe case: TSBA 115 umol/L at 32 weeks
    const severeResult = evaluateObstetricIcp({
      gestationWeeks: 32,
      peakTsbaUmolL: 115,
      baselineAltUL: 95,
      baselineAstUL: 82,
      pruritusSeverityScore: 9,
      pruritusPalmsSoles: true,
      nocturnalWorsening: true,
    });

    expect(severeResult.icpSeverityTier).toBe('severe_ge_100');
    expect(severeResult.recommendedUdcaDoseMgDay).toBe(1500);
    expect(severeResult.recommendedDeliveryTimingWeeksMin).toBe(35.0);
    expect(severeResult.recommendedDeliveryTimingWeeksMax).toBe(36.0);
    expect(severeResult.stillbirthRiskAssessment).toContain('HIGH RISK');
    expect(severeResult.clinicalRecommendations.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric ICP REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. Anita Sen (Consultant Obstetrician)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'sister.maternity',
      fullName: 'Sister Sunita Maternity HDU',
      role: 'nurse',
      password: 'temp-pass-nurse-mat',
    });
    const nurseFirst = await login('sister.maternity', 'temp-pass-nurse-mat');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-mat',
      newPassword: PW,
    });
    nurse = await login('sister.maternity', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'clerk.mat',
      fullName: 'Maternity Ward Clerk',
      role: 'attender',
      password: 'temp-pass-clerk',
    });
    const attenderFirst = await login('clerk.mat', 'temp-pass-clerk');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-clerk',
      newPassword: PW,
    });
    attender = await login('clerk.mat', PW);

    // Gravida patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Meena Sharma (G2P1 33w)',
      dateOfBirth: '1996-05-12',
      phone: '+91 98765 33333',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create an obstetric ICP episode and logs audit', async () => {
    const payload = {
      patientId,
      diagnosisDatetime: '2026-11-07T08:00:00',
      gestationWeeks: 33.2,
      peakTsbaUmolL: 52.4,
      baselineAltUL: 78,
      baselineAstUL: 65,
      pruritusSeverityScore: 7,
      pruritusPalmsSoles: true,
      nocturnalWorsening: true,
      udcaStarted: true,
      udcaDoseMgDay: 1000,
      ctgSurveillanceFrequency: 'twice_weekly',
      plannedDeliveryWeeks: 36.5,
      deliveryTimingRationale: 'Deliver at 36-37 weeks if TSBA remains 40-99.',
      clinicalNotes: 'Initiated UDCA 500mg BID. Scheduled serial TSBA every week.',
    };

    const res = await call('POST', '/api/obstetric-icp/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.icp_severity_tier).toBe('moderate_40_99');

    // Audit check
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'obstetric_icp.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record serial bile acid and pruritus flowsheet logs', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/obstetric-icp/episodes', doctor, {
      patientId,
      diagnosisDatetime: '2026-11-07T06:00:00',
      gestationWeeks: 31,
      peakTsbaUmolL: 28.0,
      pruritusSeverityScore: 5,
      pruritusPalmsSoles: true,
      nocturnalWorsening: false,
    });
    const epId = epRes.body.episode.id;

    // 2. Nurse records follow-up log at 32 weeks
    const fsRes = await call('POST', `/api/obstetric-icp/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T10:00:00',
      gestationWeeks: 32.0,
      currentTsbaUmolL: 32.5,
      pruritusScore: 4,
      altUL: 42,
      astUL: 38,
      ctgResult: 'reactive',
      fetalMovementsAdequate: true,
      udcaCurrentDoseMgDay: 900,
      notes: 'Pruritus improved after 1 week on UDCA. Normal reactive CTG.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();

    // 3. Fetch episode detail
    const detail = await call('GET', `/api/obstetric-icp/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].pruritus_score).toBe(4);
  });

  it('allows doctor to update episode and delete records', async () => {
    const epRes = await call('POST', '/api/obstetric-icp/episodes', doctor, {
      patientId,
      diagnosisDatetime: '2026-11-07T06:00:00',
      gestationWeeks: 34,
      peakTsbaUmolL: 45.0,
      pruritusSeverityScore: 6,
    });
    const epId = epRes.body.episode.id;

    // Update
    const patchRes = await call('PATCH', `/api/obstetric-icp/episodes/${epId}`, doctor, {
      plannedDeliveryWeeks: 35.5,
      clinicalNotes: 'Sudden spike in TSBA to 104; scheduled induction at 35w with Betamethasone cover.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.planned_delivery_weeks).toBe(35.5);

    // Delete
    const delRes = await call('DELETE', `/api/obstetric-icp/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/obstetric-icp/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating episodes', async () => {
    const res = await call('POST', '/api/obstetric-icp/episodes', attender, {
      patientId,
      diagnosisDatetime: '2026-11-07T06:00:00',
      gestationWeeks: 34,
      peakTsbaUmolL: 35.0,
      pruritusSeverityScore: 5,
    });
    expect(res.status).toBe(403);
  });
});
