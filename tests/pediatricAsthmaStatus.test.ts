import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateMwcas,
  evaluatePediatricAsthmaStatus,
} from '../web/src/pediatricAsthmaStatusEngine.js';

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
describe('Pediatric Status Asthmaticus & M-WCAS Engine (Pure Unit Tests)', () => {
  it('correctly calculates Modified Wood Clinical Asthma Score (M-WCAS) and classifies severity tier', () => {
    // Mild: 0-3 points
    const mild = calculateMwcas({
      spo2Score: 0,
      wheezingScore: 1,
      retractionsScore: 1,
      airEntryScore: 0,
      mentalStateScore: 0,
    });
    expect(mild.totalScore).toBe(2);
    expect(mild.severityTier).toBe('mild_1_3');

    // Moderate: 4-6 points
    const mod = calculateMwcas({
      spo2Score: 1,
      wheezingScore: 1,
      retractionsScore: 2,
      airEntryScore: 1,
      mentalStateScore: 0,
    });
    expect(mod.totalScore).toBe(5);
    expect(mod.severityTier).toBe('moderate_4_6');

    // Severe / Impending Failure: 7-10 points (exhaustion, silent chest, severe retractions)
    const severe = calculateMwcas({
      spo2Score: 2,
      wheezingScore: 2,
      retractionsScore: 2,
      airEntryScore: 2,
      mentalStateScore: 1,
    });
    expect(severe.totalScore).toBe(9);
    expect(severe.severityTier).toBe('severe_impending_failure_7_10');
  });

  it('calculates weight-calibrated drug doses (Albuterol, IV Mag, IV Terbutaline, Steroids) and flags VBG fatigue', () => {
    // 16 kg child presenting with severe status asthmaticus
    const evaluation = evaluatePediatricAsthmaStatus({
      ageMonths: 48,
      weightKg: 16.0,
      spo2RoomAirPercent: 89, // Score 2
      wheezingScore: 2,
      retractionsScore: 2,
      airEntryScore: 1,
      mentalStateScore: 1,
      vbgPh: 7.28,
      vbgPco2Mmhg: 45, // Rising pCO2 indicating diaphragmatic fatigue
    });

    expect(evaluation.totalMwcasScore).toBe(8);
    expect(evaluation.severityTier).toBe('severe_impending_failure_7_10');
    expect(evaluation.respiratoryExhaustionRisk).toBe(true);
    expect(evaluation.vbgInterpretation).toContain('CRITICAL RESPIRATORY ARREST WARNING');

    // Continuous Albuterol 0.5 mg/kg/hr for 16 kg = 8.0 mg/hr
    expect(evaluation.albuterolContinuous.recommendedDose).toBe('8 mg/hour');

    // IV Magnesium 50 mg/kg for 16 kg = 800 mg
    expect(evaluation.ivMagnesiumSulfate.recommendedDose).toContain('800 mg');

    // IV Terbutaline loading 10 mcg/kg for 16 kg = 160 mcg
    expect(evaluation.ivTerbutaline.recommendedDose).toContain('160 mcg');

    // Methylprednisolone 2 mg/kg for 16 kg = 32 mg
    expect(evaluation.systemicSteroids.recommendedDose).toContain('32 mg');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Status Asthmaticus REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatrician',
      fullName: 'Dr. Rahul Mehta (Pediatric Intensivist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Staff Nurse Neha (PICU)',
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

    // Pediatric asthma patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Verma (4yo Status Asthmaticus)',
      dateOfBirth: '2022-09-10',
      phone: '+91 98765 88888',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a pediatric asthma episode and logs audit', async () => {
    const payload = {
      patientId,
      onsetDatetime: '2026-11-07T08:00:00',
      ageMonths: 50,
      weightKg: 17.0,
      spo2RoomAirPercent: 90,
      wheezingScore: 2,
      retractionsScore: 2,
      airEntryScore: 1,
      mentalStateScore: 1,
      tier1ContinuousAlbuterol: true,
      tier1Ipratropium: true,
      tier1SystemicSteroids: true,
      tier2IvMagnesium: true,
      tier3IvTerbutaline: false,
      tier4RespiratorySupport: 'hfnc',
      vbgPh: 7.31,
      vbgPco2Mmhg: 40,
      status: 'acute_ed_treatment',
      clinicalNotes: 'Initiated continuous Albuterol 8.5 mg/hr and IV Magnesium Sulfate 850 mg over 20 min.',
    };

    const res = await call('POST', '/api/pediatric-asthma/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.total_mwcas_score).toBe(8);
    expect(res.body.episode.severity_tier).toBe('severe_impending_failure_7_10');

    // Verify audit log
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'pediatric_asthma.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record serial M-WCAS flowsheet logs and checks progression', async () => {
    const epRes = await call('POST', '/api/pediatric-asthma/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-07T07:00:00',
      ageMonths: 48,
      weightKg: 16.0,
      spo2RoomAirPercent: 91,
      wheezingScore: 2,
      retractionsScore: 2,
      airEntryScore: 1,
      mentalStateScore: 1,
      status: 'acute_ed_treatment',
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Nurse records 30-minute post-treatment observation
    const fsRes = await call('POST', `/api/pediatric-asthma/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T07:30:00',
      minutesFromTriage: 30,
      respiratoryRate: 36,
      heartRate: 142,
      spo2Percent: 95,
      fio2Percent: 35,
      spo2Score: 1,
      wheezingScore: 1,
      retractionsScore: 1,
      airEntryScore: 1,
      mentalStateScore: 0,
      albuterolRateMgHr: 8.0,
      notes: 'Child visibly calmer, retractions decreased from severe to moderate. Tolerating HFNC.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();
    expect(fsRes.body.totalMwcasScore).toBe(4); // Improved from 8 to 4 (Moderate)

    // Fetch episode detail and check flowsheet array
    const detail = await call('GET', `/api/pediatric-asthma/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].respiratory_rate).toBe(36);
  });

  it('allows doctor to update episode status and delete records', async () => {
    const epRes = await call('POST', '/api/pediatric-asthma/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      ageMonths: 48,
      weightKg: 16.0,
      spo2RoomAirPercent: 94,
      wheezingScore: 1,
      retractionsScore: 1,
      airEntryScore: 0,
      mentalStateScore: 0,
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Doctor updates episode
    const patchRes = await call('PATCH', `/api/pediatric-asthma/episodes/${epId}`, doctor, {
      status: 'discharged_resolved',
      clinicalNotes: 'Wheezing completely resolved. Discharged on Fluticasone/Salmeterol inhaler and Prednisolone 5-day course.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('discharged_resolved');

    // Doctor deletes episode
    const delRes = await call('DELETE', `/api/pediatric-asthma/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/pediatric-asthma/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating asthma episodes', async () => {
    const res = await call('POST', '/api/pediatric-asthma/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      ageMonths: 48,
      weightKg: 16.0,
      spo2RoomAirPercent: 92,
      wheezingScore: 1,
      retractionsScore: 1,
      airEntryScore: 0,
      mentalStateScore: 0,
    });
    expect(res.status).toBe(403);
  });
});
