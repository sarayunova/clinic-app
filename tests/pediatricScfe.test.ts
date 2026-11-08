import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricScfe } from '../web/src/pediatricScfeEngine.js';

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

describe('Pediatric SCFE & Loder Instability Engine (Pure Unit Tests)', () => {
  it('identifies unstable SCFE with 40-50% AVN risk and bans forceful reduction', () => {
    const res = evaluatePediatricScfe({
      ageYears: 13,
      weightKg: 65,
      bmiPercentile: 96,
      affectedHip: 'left',
      loderStability: 'unstable_cannot_bear_weight',
      symptomDurationDays: 3,
      southwickSlipAngleDegrees: 45,
      kleinLineTrethowanAbnormal: true,
      referredKneeThighPain: true,
      endocrineDisorderSuspected: false,
      strictNonWeightBearingEnforced: true,
      surgicalProcedurePerformed: 'in_situ_single_cannulated_screw',
      contralateralHipProphylacticPinning: false,
    });

    expect(res.isUnstableScfe).toBe(true);
    expect(res.avascularNecrosisRiskPct).toContain('40%');
    expect(res.southwickSeverity).toBe('moderate_30_to_50_deg');
    expect(res.diagnosticKneePainPitfallAlert).toBe(true);
    expect(res.alerts.some((a) => a.includes('DO NOT ATTEMPT CLOSED REDUCTION'))).toBe(true);
    expect(res.surgicalDirectives.some((d) => d.includes('single central cannulated screw'))).toBe(true);
  });

  it('evaluates young patient with endocrinopathy and flags contralateral prophylactic pinning', () => {
    const res = evaluatePediatricScfe({
      ageYears: 9.5,
      weightKg: 40,
      bmiPercentile: 88,
      affectedHip: 'right',
      loderStability: 'stable_able_to_ambulate',
      symptomDurationDays: 45,
      southwickSlipAngleDegrees: 22,
      kleinLineTrethowanAbnormal: true,
      referredKneeThighPain: false,
      endocrineDisorderSuspected: true,
      strictNonWeightBearingEnforced: true,
      surgicalProcedurePerformed: 'in_situ_single_cannulated_screw',
      contralateralHipProphylacticPinning: false,
    });

    expect(res.isUnstableScfe).toBe(false);
    expect(res.avascularNecrosisRiskPct).toContain('< 2%');
    expect(res.southwickSeverity).toBe('mild_less_30_deg');
    expect(res.isContralateralProphylacticPinningIndicated).toBe(true);
    expect(res.contralateralPinningRationale).toContain('atypical age');
  });
});

describe('Pediatric SCFE Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedortho',
      fullName: 'Dr. Rahul Pediatric Orthopedics',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ward',
      fullName: 'Nurse Deepa Ortho',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ward', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ward', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ward',
      fullName: 'Attender Vijay',
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
      fullName: 'Master Aarav Deshmukh',
      dateOfBirth: '2013-08-15',
      phone: '9876543266',
      address: 'Orthopedic Ward Bed 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to create SCFE episode and retrieve calculation', async () => {
    const res = await call('POST', '/api/pediatric-scfe/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T05:00:00',
      ageYears: 13.0,
      weightKg: 68.0,
      bmiPercentile: 97.0,
      affectedHip: 'left',
      loderStability: 'unstable_cannot_bear_weight',
      symptomDurationDays: 4,
      southwickSlipAngleDegrees: 42.0,
      kleinLineTrethowanAbnormal: true,
      referredKneeThighPain: true,
      endocrineDisorderSuspected: false,
      strictNonWeightBearingEnforced: true,
      surgicalProcedurePerformed: 'in_situ_single_cannulated_screw',
      contralateralHipProphylacticPinning: false,
      status: 'strict_bedrest_non_weight_bearing',
      clinicalNotes: 'Unstable SCFE presenting with referred knee pain and positive Trethowan sign.',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.episode.episode_code).toMatch(/^SCFE-\d+-\d+/);
    const episodeId = res.body.episode.id;

    const detail = await call('GET', `/api/pediatric-scfe/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.evaluation.isUnstableScfe).toBe(true);
    expect(detail.body.evaluation.avascularNecrosisRiskPct).toContain('40%');
  });

  it('allows nurse to record flowsheet log and audit logging occurs', async () => {
    const ep = await call('POST', '/api/pediatric-scfe/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T05:00:00',
      ageYears: 13.0,
      weightKg: 68.0,
      bmiPercentile: 97.0,
      affectedHip: 'left',
      loderStability: 'unstable_cannot_bear_weight',
      symptomDurationDays: 4,
      southwickSlipAngleDegrees: 42.0,
      kleinLineTrethowanAbnormal: true,
      referredKneeThighPain: true,
      endocrineDisorderSuspected: false,
      strictNonWeightBearingEnforced: true,
      surgicalProcedurePerformed: 'in_situ_single_cannulated_screw',
      contralateralHipProphylacticPinning: false,
      status: 'strict_bedrest_non_weight_bearing',
    });
    const episodeId = ep.body.episode.id;

    const logRes = await call('POST', `/api/pediatric-scfe/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T09:00:00',
      dayFromPresentation: 1,
      painScoreVas: 6,
      nonWeightBearingCompliance: 'strict_wheelchair_bedrest',
      hipInternalRotationDegrees: 0.0,
      woundDressingClean: true,
      distalNeurovascularStatus: 'intact_pulses_sensation_normal',
      notes: 'Strict non-weight bearing maintained. Distal neurovascular exam intact.',
    });

    expect([200, 201]).toContain(logRes.status);
    expect(logRes.body.flowsheetLog.pain_score_vas).toBe(6);

    // Verify audit log
    const auditRow = db.prepare(`
      SELECT * FROM audit_events WHERE action = 'pediatric_scfe.flowsheet_add'
    `).get() as any;
    expect(auditRow).toBeDefined();
  });

  it('blocks attender with 403 Forbidden', async () => {
    const res = await call('POST', '/api/pediatric-scfe/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T05:00:00',
      ageYears: 13.0,
      weightKg: 68.0,
      bmiPercentile: 97.0,
      affectedHip: 'left',
      loderStability: 'unstable_cannot_bear_weight',
      symptomDurationDays: 4,
      southwickSlipAngleDegrees: 42.0,
      kleinLineTrethowanAbnormal: true,
      referredKneeThighPain: true,
      endocrineDisorderSuspected: false,
      strictNonWeightBearingEnforced: true,
      surgicalProcedurePerformed: 'in_situ_single_cannulated_screw',
      contralateralHipProphylacticPinning: false,
    });

    expect(res.status).toBe(403);
  });
});
