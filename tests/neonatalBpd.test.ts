import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculatePmaWeeks,
  classifyJensenBpdGrade,
  evaluateNeonatalBpd,
} from '../web/src/neonatalBpdEngine.js';

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
describe('Neonatal BPD & Jensen 2019 Staging Engine (Pure Unit Tests)', () => {
  it('correctly calculates Postmenstrual Age (PMA) from GA and chronological age', () => {
    // 27.0 weeks GA + 63 days (9 weeks) = 36.0 weeks PMA
    expect(calculatePmaWeeks(27.0, 63)).toBe(36.0);

    // 28.0 weeks GA + 56 days (8 weeks) = 36.0 weeks PMA
    expect(calculatePmaWeeks(28.0, 56)).toBe(36.0);

    // 26.5 weeks GA + 70 days (10 weeks) = 36.5 weeks PMA
    expect(calculatePmaWeeks(26.5, 70)).toBe(36.5);
  });

  it('correctly assigns Jensen 2019 BPD Grade based on respiratory support modality at 36w PMA', () => {
    // No support -> No BPD
    expect(classifyJensenBpdGrade('none_room_air', 0)).toBe('no_bpd');

    // Cannula <= 2 L/min -> Grade 1
    expect(classifyJensenBpdGrade('nasal_cannula_low_flow', 1.0)).toBe('grade_1');
    expect(classifyJensenBpdGrade('nasal_cannula_high_flow', 2.0)).toBe('grade_1');

    // Cannula > 2 L/min -> Grade 2
    expect(classifyJensenBpdGrade('nasal_cannula_high_flow', 3.0)).toBe('grade_2');

    // Non-invasive positive pressure (NIPPV / CPAP) -> Grade 2
    expect(classifyJensenBpdGrade('cpap_nippv', 0)).toBe('grade_2');

    // Invasive mechanical ventilation -> Grade 3
    expect(classifyJensenBpdGrade('invasive_mechanical_ventilation', 0)).toBe('grade_3');
  });

  it('evaluates comprehensive BPD staging, target SpO2 (91-95%) and home oxygen readiness', () => {
    // Infant born at 26 weeks, now at 36 weeks on CPAP + FiO2 28%
    const grade2Eval = evaluateNeonatalBpd({
      gestationalAgeWeeks: 26.0,
      birthWeightGrams: 850,
      currentPmaWeeks: 36.0,
      respiratorySupportType: 'cpap_nippv',
      cannulaFlowLpm: 0,
      fio2Percent: 28,
      caffeineActive: true,
      diureticsActive: false,
      postnatalSteroidsActive: true,
    });

    expect(grade2Eval.currentPmaWeeks).toBe(36.0);
    expect(grade2Eval.jensenBpdGrade).toBe('grade_2');
    expect(grade2Eval.targetSpo2Min).toBe(91);
    expect(grade2Eval.targetSpo2Max).toBe(95);
    expect(grade2Eval.homeOxygenCandidate).toBe(true);

    // Infant born at 25 weeks, now at 36 weeks on invasive mechanical ventilation
    const grade3Eval = evaluateNeonatalBpd({
      gestationalAgeWeeks: 25.0,
      birthWeightGrams: 680,
      currentPmaWeeks: 36.0,
      respiratorySupportType: 'invasive_mechanical_ventilation',
      cannulaFlowLpm: 0,
      fio2Percent: 40,
      caffeineActive: true,
      diureticsActive: true,
      postnatalSteroidsActive: true,
    });

    expect(grade3Eval.jensenBpdGrade).toBe('grade_3');
    expect(grade3Eval.gradeLabel).toContain('Grade 3 BPD');
    expect(grade3Eval.homeOxygenCandidate).toBe(false);
    expect(grade3Eval.steroidGuidance).toContain('DART Protocol');

    // Non-qualifying infant born at 34 weeks
    const latePretermEval = evaluateNeonatalBpd({
      gestationalAgeWeeks: 34.0,
      birthWeightGrams: 2100,
      currentPmaWeeks: 36.0,
      respiratorySupportType: 'nasal_cannula_low_flow',
      cannulaFlowLpm: 0.5,
      fio2Percent: 25,
      caffeineActive: false,
      diureticsActive: false,
      postnatalSteroidsActive: false,
    });

    expect(latePretermEval.isEligibleForJensenStaging).toBe(false);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal BPD REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. R. Sharma (Consultant Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Staff Nurse Ananya (NICU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.nicu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.nicu', PW);

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

    // Premature infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Sunita (27w Premature / BPD)',
      dateOfBirth: '2026-09-01',
      phone: '+91 98765 43210',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a neonatal BPD episode with calculation', async () => {
    const payload = {
      patientId,
      evaluationDatetime: '2026-11-07T10:00:00',
      gestationalAgeWeeks: 27.0,
      birthWeightGrams: 890,
      currentPmaWeeks: 36.0,
      respiratorySupportType: 'nasal_cannula_low_flow',
      cannulaFlowLpm: 1.0,
      fio2Percent: 25,
      caffeineTherapyActive: true,
      diureticTherapyActive: false,
      postnatalSteroidsActive: false,
      homeOxygenPlanned: false,
      status: 'inpatient_respiratory_care',
      clinicalNotes: 'Transitioned from CPAP to LFNC at 36w PMA. Mild subcostal retractions.',
    };

    const res = await call('POST', '/api/neonatal-bpd/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toMatch(/^BPD-/);
    expect(res.body.episode.jensen_bpd_grade).toBe('grade_1');
    expect(res.body.episode.current_pma_weeks).toBe(36.0);
    expect(res.body.evalResult).toBeDefined();
    expect(res.body.evalResult.targetSpo2Min).toBe(91);

    const episodeId = res.body.episode.id;

    // List episodes
    const listRes = await call('GET', `/api/neonatal-bpd/episodes?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // Get detail
    const detailRes = await call('GET', `/api/neonatal-bpd/episodes/${episodeId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.episode.id).toBe(episodeId);

    // Nurse logs flowsheet observation
    const flowRes = await call('POST', `/api/neonatal-bpd/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T12:00:00',
      pmaWeeks: 36.0,
      respiratorySupport: 'nasal_cannula_low_flow',
      flowLpm: 0.5,
      fio2Percent: 21,
      spo2Percent: 94,
      targetSpo2InRange: true,
      apneaBradycardiaEpisodes24h: 1,
      notes: 'Tolerating flow reduction to 0.5 L/min with SpO2 94% in target.',
    });
    expect(flowRes.status).toBe(201);
    expect(flowRes.body.logId).toBeDefined();

    // Check flowsheet appears in detail
    const detailAfterFlow = await call('GET', `/api/neonatal-bpd/episodes/${episodeId}`, nurse);
    expect(detailAfterFlow.body.logs.length).toBe(1);
    expect(detailAfterFlow.body.logs[0].spo2_percent).toBe(94);

    // Update status
    const updateRes = await call('PATCH', `/api/neonatal-bpd/episodes/${episodeId}`, doctor, {
      status: 'weaning_protocol',
      homeOxygenPlanned: true,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('weaning_protocol');
    expect(updateRes.body.episode.home_oxygen_planned).toBe(1);

    // Attender is forbidden from modifying or deleting
    const attenderCreate = await call('POST', '/api/neonatal-bpd/episodes', attender, payload);
    expect(attenderCreate.status).toBe(403);

    const attenderDelete = await call('DELETE', `/api/neonatal-bpd/episodes/${episodeId}`, attender);
    expect(attenderDelete.status).toBe(403);

    // Doctor can delete flowsheet log and episode
    const deleteLogRes = await call('DELETE', `/api/neonatal-bpd/episodes/${episodeId}/flowsheet-logs/${flowRes.body.logId}`, doctor);
    expect(deleteLogRes.status).toBe(200);

    const deleteEpRes = await call('DELETE', `/api/neonatal-bpd/episodes/${episodeId}`, doctor);
    expect(deleteEpRes.status).toBe(200);
  });
});
