import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateReedaScore,
  calculatePostOpHours,
  evaluateErasMilestoneAdherence,
} from '../web/src/erasReedaEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string;
let patientId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.sharma', fullName: 'Dr Sharma', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  await call('POST', '/api/users', doctor, { username: 'desk1', fullName: 'Desk Staff', role: 'attender', password: 'temporary-pass-1' });
  const first = await login('desk1', 'temporary-pass-1');
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  desk = await login('desk1');

  patientId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Shreya Patil',
    dateOfBirth: '1996-08-20',
    phone: '9845011223',
    gravida: 1,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('ERAS Recovery Milestones & REEDA Engine', () => {
  it('calculates total REEDA score and categorizes wound healing correctly', () => {
    // 0: Optimal normal healing
    const s0 = calculateReedaScore({ redness: 0, edema: 0, ecchymosis: 0, discharge: 0, approximation: 0 });
    expect(s0.totalScore).toBe(0);
    expect(s0.category).toBe('optimal_healing');
    expect(s0.riskLevel).toBe('low');
    expect(s0.isDehiscenceRisk).toBe(false);

    // 1 - 3: Mild inflammation
    const s2 = calculateReedaScore({ redness: 1, edema: 1, ecchymosis: 0, discharge: 0, approximation: 0 });
    expect(s2.totalScore).toBe(2);
    expect(s2.category).toBe('mild_inflammation');
    expect(s2.riskLevel).toBe('low');

    // 4 - 7: Moderate impairment / early SSI concern
    const s5 = calculateReedaScore({ redness: 2, edema: 2, ecchymosis: 0, discharge: 1, approximation: 0 });
    expect(s5.totalScore).toBe(5);
    expect(s5.category).toBe('moderate_impairment_suspected_ssi');
    expect(s5.riskLevel).toBe('moderate');
    expect(s5.isSsiRisk).toBe(true);

    // >= 8: Severe complication / dehiscence
    const s9 = calculateReedaScore({ redness: 3, edema: 2, ecchymosis: 1, discharge: 1, approximation: 2 });
    expect(s9.totalScore).toBe(9);
    expect(s9.category).toBe('severe_complication_dehiscence');
    expect(s9.riskLevel).toBe('high');
    expect(s9.isDehiscenceRisk).toBe(true);
    expect(s9.recommendations.some((r) => r.includes('URGENT surgical review'))).toBe(true);
  });

  it('detects purulent discharge and dehiscence red flags', () => {
    const redFlag = calculateReedaScore({
      redness: 1,
      edema: 1,
      ecchymosis: 0,
      discharge: 3, // Purulent / bloody
      approximation: 2, // Separation > 3mm
    });
    expect(redFlag.totalScore).toBe(7);
    expect(redFlag.isDehiscenceRisk).toBe(true);
    expect(redFlag.recommendations.some((r) => r.includes('Purulent') || r.includes('exudate'))).toBe(true);
    expect(redFlag.recommendations.some((r) => r.includes('Skin separation'))).toBe(true);
  });

  it('calculates elapsed postoperative hours accurately', () => {
    const surgery = '2026-03-01T08:00:00';
    const post6h = '2026-03-01T14:00:00';
    const post24h = '2026-03-02T08:00:00';

    expect(calculatePostOpHours(surgery, post6h)).toBe(6.0);
    expect(calculatePostOpHours(surgery, post24h)).toBe(24.0);
  });

  it('evaluates ERAS recovery milestone benchmarks and discharge readiness', () => {
    // All milestones met on time
    const adherent = evaluateErasMilestoneAdherence({
      oralFluidsAchievedHours: 1.5, // <= 2h
      regularDietAchievedHours: 5.0, // <= 6h
      catheterRemovedHours: 8.0, // <= 12h
      firstMobilizationHours: 9.0, // <= 12h
      multimodalAnalgesiaAdherent: true,
    });
    expect(adherent.adherencePercentage).toBe(100);
    expect(adherent.isDischargeReady).toBe(true);
    expect(adherent.benchmarks.every((b) => b.met)).toBe(true);

    // Delayed catheter and mobilization
    const delayed = evaluateErasMilestoneAdherence({
      oralFluidsAchievedHours: 2.0,
      regularDietAchievedHours: 6.0,
      catheterRemovedHours: 18.0, // > 12h
      firstMobilizationHours: 20.0, // > 12h
      multimodalAnalgesiaAdherent: true,
    });
    expect(delayed.adherencePercentage).toBe(60);
    expect(delayed.benchmarks.find((b) => b.milestone.includes('Catheter'))?.met).toBe(false);
  });
});

describe('ERAS Pathway & REEDA REST API Integration', () => {
  it('creates pathway, updates milestones, logs serial REEDA scores, and handles escalation', async () => {
    // 1. Create Post-Op ERAS Pathway
    const pwRes = await call('POST', `/api/patients/${patientId}/eras-pathways`, doctor, {
      surgeryDatetime: '2026-03-01T08:30:00',
      surgeryType: 'elective_lscs',
      incisionType: 'pfannenstiel',
      skinClosureType: 'subcuticular_monocryl',
      dvtProphylaxisApplied: 'early_mobilization_ted',
      clinicalNotes: 'Uncomplicated LSCS for previous cesarean delivery. Healthy infant delivered.',
    });
    expect(pwRes.status).toBe(201);
    const pathway = pwRes.body;
    expect(pathway.status).toBe('active');
    expect(pathway.surgeryType).toBe('elective_lscs');

    // Fetch pathway
    const getPw = await call('GET', `/api/eras-pathways/${pathway.id}`, doctor);
    expect(getPw.status).toBe(200);
    expect(getPw.body.id).toBe(pathway.id);

    // 2. Update ERAS Milestones
    const patchMw = await call('PATCH', `/api/eras-pathways/${pathway.id}`, doctor, {
      oralFluidsAchievedHours: 1.5,
      regularDietAchievedHours: 5.5,
      catheterRemovedHours: 8.0,
      firstMobilizationHours: 10.0,
      multimodalAnalgesiaAdherent: true,
    });
    expect(patchMw.status).toBe(200);
    expect(patchMw.body.oralFluidsAchievedHours).toBe(1.5);
    expect(patchMw.body.catheterRemovedHours).toBe(8.0);

    // 3. Log POD 0 REEDA Assessment (Score 0)
    const a0 = await call('POST', `/api/eras-pathways/${pathway.id}/reeda-assessments`, doctor, {
      assessmentDatetime: '2026-03-01T16:00:00',
      postOpDay: 0,
      rednessScore: 0,
      edemaScore: 0,
      ecchymosisScore: 0,
      dischargeScore: 0,
      approximationScore: 0,
      painScore10: 3,
      dressingCondition: 'dry_intact',
    });
    expect(a0.status).toBe(201);
    expect(a0.body.totalReedaScore).toBe(0);
    expect(a0.body.healingCategory).toBe('optimal_healing');

    // 4. Log POD 1 REEDA Assessment (Mild physiological erythema, Score 2)
    const a1 = await call('POST', `/api/eras-pathways/${pathway.id}/reeda-assessments`, doctor, {
      assessmentDatetime: '2026-03-02T10:00:00',
      postOpDay: 1,
      rednessScore: 1,
      edemaScore: 1,
      ecchymosisScore: 0,
      dischargeScore: 0,
      approximationScore: 0,
      painScore10: 2,
      dressingCondition: 'removed_clean',
    });
    expect(a1.status).toBe(201);
    expect(a1.body.totalReedaScore).toBe(2);
    expect(a1.body.healingCategory).toBe('mild_inflammation');

    // 5. Log POD 3 REEDA Assessment with wound breakdown (Score 9, severe complication)
    const a3 = await call('POST', `/api/eras-pathways/${pathway.id}/reeda-assessments`, doctor, {
      assessmentDatetime: '2026-03-04T11:00:00',
      postOpDay: 3,
      rednessScore: 3,
      edemaScore: 2,
      ecchymosisScore: 1,
      dischargeScore: 1,
      approximationScore: 2, // separation > 3mm
      painScore10: 6,
      dressingCondition: 'reinforcement_needed',
      assessorNotes: 'Erythematous wound edges with 5mm gap at center. Swab taken.',
    });
    expect(a3.status).toBe(201);
    expect(a3.body.totalReedaScore).toBe(9);
    expect(a3.body.healingCategory).toBe('severe_complication_dehiscence');

    // Verify pathway status was auto-escalated to 'escalated_complication'
    const escalatedPw = await call('GET', `/api/eras-pathways/${pathway.id}`, doctor);
    expect(escalatedPw.status).toBe(200);
    expect(escalatedPw.body.status).toBe('escalated_complication');
    expect(escalatedPw.body.assessmentsCount).toBe(3);

    // 6. Delete an assessment
    const delRes = await call('DELETE', `/api/reeda-assessments/${a0.body.id}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    // 7. Enforce RBAC: Attender cannot create ERAS pathways
    const deskCreate = await call('POST', `/api/patients/${patientId}/eras-pathways`, desk, {
      surgeryDatetime: '2026-03-01T08:30:00',
      surgeryType: 'elective_lscs',
    });
    expect(deskCreate.status).toBe(403);
  });
});
