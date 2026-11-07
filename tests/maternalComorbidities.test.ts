import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateMaternalCardiacRisk,
  calculateMaternalIcp,
} from '../web/src/maternalComorbidityEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: unknown,
) {
  const res = await app.inject({
    method,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
  const sc = res.headers['set-cookie'];
  return {
    status: res.statusCode,
    headers: res.headers,
    body: (res.body ? (res.headers['content-type']?.includes('application/json') ? JSON.parse(res.body) : res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
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
describe('Maternal Comorbidities Clinical Engine (Pure Unit Tests)', () => {
  it('correctly calculates CARPREG-II score and stratifies maternal cardiac risk', () => {
    // 1. Low risk: 0 points (5% event rate)
    const lowRisk = calculateMaternalCardiacRisk({
      mwhoClass: 'mwho_I',
      nyhaClassBaseline: 'I',
    });
    expect(lowRisk.carpregIiScore).toBe(0);
    expect(lowRisk.riskTier).toBe('low');
    expect(lowRisk.predictedEventRiskPct).toBe(5.0);
    expect(lowRisk.contraindicatedPregnancy).toBe(false);

    // 2. Intermediate risk: 2-4 points (12% event rate)
    const interRisk = calculateMaternalCardiacRisk({
      mwhoClass: 'mwho_II',
      nyhaClassBaseline: 'II',
      leftHeartObstruction: true, // +2 pts
      priorArrhythmia: true, // +1 pt
    });
    expect(interRisk.carpregIiScore).toBe(3);
    expect(interRisk.riskTier).toBe('intermediate');
    expect(interRisk.predictedEventRiskPct).toBe(12.0);

    // 3. High risk: > 4 points (41% event rate) with mWHO IV
    const highRisk = calculateMaternalCardiacRisk({
      mwhoClass: 'mwho_IV',
      nyhaClassBaseline: 'III', // +3 pts
      priorCardiacEvent: true, // +3 pts
      reducedSystemicVentricularFunction: true, // +2 pts
    });
    expect(highRisk.carpregIiScore).toBe(8);
    expect(highRisk.riskTier).toBe('high');
    expect(highRisk.predictedEventRiskPct).toBe(41.0);
    expect(highRisk.contraindicatedPregnancy).toBe(true);
    expect(highRisk.multidisciplinaryTeamAlerts[0]).toContain('CRITICAL ALERT');
  });

  it('correctly stratifies ICP severity and calculates UDCA dosing & delivery timeline', () => {
    // 1. Mild ICP (< 40 µmol/L)
    const mild = calculateMaternalIcp({
      totalSerumBileAcidsUmolL: 24,
      gestationalAgeWeeks: 34,
      patientWeightKg: 60,
    });
    expect(mild.severityTier).toBe('mild_10_39');
    expect(mild.recommendedDeliveryGestationWeeks).toBe(38.5);
    expect(mild.surveillanceIntervalDays).toBe(7);
    expect(mild.recommendedUdcaDailyMg).toBe(900); // 60 * 15 = 900 mg

    // 2. Moderate ICP (40 - 99 µmol/L)
    const moderate = calculateMaternalIcp({
      totalSerumBileAcidsUmolL: 65,
      gestationalAgeWeeks: 35,
      patientWeightKg: 70,
    });
    expect(moderate.severityTier).toBe('moderate_40_99');
    expect(moderate.recommendedDeliveryGestationWeeks).toBe(37.5);
    expect(moderate.surveillanceIntervalDays).toBe(5);

    // 3. Severe ICP (≥ 100 µmol/L) - Critical stillbirth risk
    const severe = calculateMaternalIcp({
      totalSerumBileAcidsUmolL: 130,
      gestationalAgeWeeks: 33,
      patientWeightKg: 65,
    });
    expect(severe.severityTier).toBe('severe_100_plus');
    expect(severe.recommendedDeliveryGestationWeeks).toBe(35.5);
    expect(severe.surveillanceIntervalDays).toBe(3);
    expect(severe.clinicalActionItems[0]).toContain('Dexamethasone');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Maternal Comorbidities REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Sunita Sharma (Maternal-Fetal Medicine)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.obgyn',
      fullName: 'Sister Maya Labor Ward',
      role: 'nurse',
      password: 'temp-pass-nurse-obgyn',
    });
    const nurseFirst = await login('nurse.obgyn', 'temp-pass-nurse-obgyn');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-obgyn',
      newPassword: PW,
    });
    nurse = await login('nurse.obgyn', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'Front Desk',
      role: 'attender',
      password: 'temp-pass-desk-obgyn',
    });
    const deskFirst = await login('desk.attender', 'temp-pass-desk-obgyn');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-obgyn',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Create high-risk antenatal patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Mrs. Kavita Rao (G2P1, 26 wks)',
      dateOfBirth: '1996-05-12',
      phone: '+91 98765 22222',
    });
    patientId = patRes.body.patient.id;
  });

  it('records maternal cardiac assessment, calculates CARPREG-II, and audits log', async () => {
    const res = await call('POST', '/api/maternal-comorbidities/cardiac', doctor, {
      patientId,
      assessmentDatetime: '2026-11-07T11:00',
      gestationalAgeWeeks: 26,
      cardiacDiagnosis: 'Repaired Tetralogy of Fallot with moderate pulmonary regurgitation',
      mwhoClass: 'mwho_II',
      nyhaClassBaseline: 'I',
      priorCardiacEvent: false,
      priorArrhythmia: false,
      leftHeartObstruction: false,
      reducedSystemicVentricularFunctionEfLt50: false,
      highRiskValveOrAorta: false,
      latePregnancyPresentation: false,
      attendingCardiologistName: 'Dr. Anand (Cardiology)',
      icuPostpartumBedReserved: true,
      notes: 'Joint clinic evaluation; planned instrumental delivery at 39 weeks.',
    });

    expect(res.status).toBe(201);
    expect(res.body.assessment.assessment_code).toMatch(/^CARDIAC-/);
    expect(res.body.assessment.carpreg_ii_score).toBe(0);
    expect(res.body.calculation.predictedEventRiskPct).toBe(5.0);

    const cardiacId = res.body.assessment.id;

    // List cardiac assessments
    const listRes = await call('GET', `/api/maternal-comorbidities/cardiac?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.assessments.length).toBe(1);

    // Print audit
    const printRes = await call('POST', `/api/maternal-comorbidities/cardiac/${cardiacId}/print`, doctor, {});
    expect(printRes.status).toBe(200);

    const auditRows = db.prepare('SELECT action FROM audit_events WHERE entity = ?').all('maternal_cardiac_assessments');
    const actions = auditRows.map((r: any) => r.action);
    expect(actions).toContain('maternal_cardiac.assessment_create');
    expect(actions).toContain('maternal_comorbidities.print');
  });

  it('records ICP surveillance episode, computes UDCA titration & delivery week', async () => {
    const res = await call('POST', '/api/maternal-comorbidities/icp', doctor, {
      patientId,
      observationDatetime: '2026-11-07T12:00',
      gestationalAgeWeeks: 34,
      pruritusSeverity: 'moderate_continuous',
      totalSerumBileAcidsUmolL: 54,
      altUL: 88,
      astUL: 76,
      totalBilirubinMgDl: 1.1,
      patientWeightKg: 64,
      status: 'active_monitoring',
      clinicalNotes: 'Severe nighttime pruritus of palms & soles; starting UDCA',
    });

    expect(res.status).toBe(201);
    expect(res.body.episode.episode_code).toMatch(/^ICP-/);
    expect(res.body.episode.icp_severity_tier).toBe('moderate_40_99');
    expect(res.body.episode.recommended_delivery_gestation_weeks).toBe(37.5);

    const icpId = res.body.episode.id;

    // Nurse updates ICP episode
    const updateRes = await call('PUT', `/api/maternal-comorbidities/icp/${icpId}`, nurse, {
      patientId,
      observationDatetime: '2026-11-07T16:00',
      gestationalAgeWeeks: 34,
      pruritusSeverity: 'mild_nocturnal_palms_soles',
      totalSerumBileAcidsUmolL: 38,
      patientWeightKg: 64,
      status: 'active_monitoring',
      clinicalNotes: 'Pruritus significantly improved after 3 days of UDCA',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.icp_severity_tier).toBe('mild_10_39');

    // Audit log check
    const auditRows = db.prepare('SELECT action FROM audit_events WHERE entity = ?').all('maternal_icp_surveillance');
    const actions = auditRows.map((r: any) => r.action);
    expect(actions).toContain('maternal_icp.surveillance_create');
    expect(actions).toContain('maternal_icp.surveillance_update');
  });

  it('blocks attender role from recording or updating maternal comorbidity records', async () => {
    const res = await call('POST', '/api/maternal-comorbidities/cardiac', attender, {
      patientId,
      assessmentDatetime: '2026-11-07T11:00',
      cardiacDiagnosis: 'VSD',
      mwhoClass: 'mwho_I',
      nyhaClassBaseline: 'I',
    });
    expect(res.status).toBe(403);
  });
});
