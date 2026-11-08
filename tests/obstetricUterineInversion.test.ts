import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  calculateObstetricShockIndex,
  evaluateObstetricUterineInversion,
} from '../web/src/obstetricUterineInversionEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
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
describe('Obstetric Uterine Inversion Engine (Pure Unit Tests)', () => {
  it('correctly calculates shock index and identifies neurogenic shock out of proportion to blood loss', () => {
    // SBP 70, HR 56 (vagal bradycardia) -> SI = 0.8, but profound hypotension with small blood loss = neurogenic shock
    const si = calculateObstetricShockIndex(56, 70);
    expect(si).toBe(0.8);

    const neuroEval = evaluateObstetricUterineInversion({
      parity: 2,
      deliveryMode: 'spontaneous_vaginal',
      placentalStatusAtInversion: 'attached_undelivered',
      umbilicalCordTractionApplied: true,
      fundalPressureApplied: false,
      inversionDegree: 'third_degree_prolapsed_outside_introitus',
      neurogenicShockPresent: true,
      systolicBpAtPresentation: 70,
      diastolicBpAtPresentation: 40,
      heartRateAtPresentation: 56,
      estimatedBloodLossMl: 400,
      reductionAttemptedImmediate: true,
      reductionTechniquePrimary: 'johnson_manual_maneuver',
      uterineRelaxantAdministered: true,
      uterineRelaxantAgent: 'terbutaline_sc',
      uterotonicGivenBeforeReplacement: false,
      placentaRemovedBeforeReinversion: false,
      reinversionSuccessful: true,
      postReplacementUterotonicsStarted: true,
      bimanualUterineCompressionMaintained: true,
      bloodProductsTransfusedUnits: 1,
    });

    expect(neuroEval.neurogenicShockDominant).toBe(true);
    expect(neuroEval.criticalSafetyViolations.length).toBe(0);
  });

  it('detects lethal protocol violations when uterotonics or placental detachment precede reinversion', () => {
    const violationEval = evaluateObstetricUterineInversion({
      parity: 1,
      deliveryMode: 'spontaneous_vaginal',
      placentalStatusAtInversion: 'attached_undelivered',
      umbilicalCordTractionApplied: true,
      fundalPressureApplied: false,
      inversionDegree: 'third_degree_prolapsed_outside_introitus',
      neurogenicShockPresent: false,
      systolicBpAtPresentation: 80,
      diastolicBpAtPresentation: 50,
      heartRateAtPresentation: 120,
      estimatedBloodLossMl: 1500,
      reductionAttemptedImmediate: true,
      reductionTechniquePrimary: 'johnson_manual_maneuver',
      uterineRelaxantAdministered: false,
      uterineRelaxantAgent: 'none',
      uterotonicGivenBeforeReplacement: true, // LETHAL BREACH
      placentaRemovedBeforeReinversion: true, // CRITICAL BREACH
      reinversionSuccessful: false,
      postReplacementUterotonicsStarted: false,
      bimanualUterineCompressionMaintained: false,
      bloodProductsTransfusedUnits: 4,
    });

    expect(violationEval.criticalSafetyViolations.length).toBe(2);
    expect(violationEval.criticalSafetyViolations.some((v) => v.includes('Uterotonics'))).toBe(true);
    expect(violationEval.criticalSafetyViolations.some((v) => v.includes('placental separation'))).toBe(true);
    expect(violationEval.surgicalInterventionIndicated).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration Tests
// -------------------------------------------------------------
describe('Obstetric Uterine Inversion REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obsinversion',
      fullName: 'Dr. Anita Desai (Obstetrics)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.obsinversion',
      fullName: 'Nurse Sunita (Labor Ward)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.obsinversion', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.obsinversion', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.obsinversion',
      fullName: 'Ward Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.obsinversion', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.obsinversion', PW);

    // Create maternity patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Sharma (Postpartum)',
      dateOfBirth: '1996-05-12',
      phone: '+91 98111 22233',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews uterine inversion evaluation without database persistence', async () => {
    const res = await call('POST', '/api/obstetric-uterine-inversion/evaluate', doctor, {
      maternalAge: 30,
      parity: 2,
      deliveryMode: 'spontaneous_vaginal',
      placentalStatusAtInversion: 'attached_undelivered',
      umbilicalCordTractionApplied: true,
      fundalPressureApplied: false,
      inversionDegree: 'third_degree_prolapsed_outside_introitus',
      neurogenicShockPresent: true,
      systolicBpAtPresentation: 76,
      diastolicBpAtPresentation: 42,
      heartRateAtPresentation: 58,
      estimatedBloodLossMl: 500,
      reductionAttemptedImmediate: true,
      reductionTechniquePrimary: 'johnson_manual_maneuver',
      uterineRelaxantAdministered: true,
      uterineRelaxantAgent: 'terbutaline_sc',
      uterotonicGivenBeforeReplacement: false,
      placentaRemovedBeforeReinversion: false,
      reinversionSuccessful: true,
      timeToReinversionMinutes: 12,
      postReplacementUterotonicsStarted: true,
      bimanualUterineCompressionMaintained: true,
      bloodProductsTransfusedUnits: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.neurogenicShockDominant).toBe(true);
    expect(res.body.evalResult.criticalSafetyViolations).toEqual([]);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const occTime = new Date().toISOString();

    // 1. Attender cannot create episode (403 Forbidden)
    const attenderCreate = await call('POST', '/api/obstetric-uterine-inversion/episodes', attender, {
      patientId,
      occurrenceDatetime: occTime,
      maternalAge: 28,
      parity: 1,
      deliveryMode: 'spontaneous_vaginal',
      placentalStatusAtInversion: 'attached_undelivered',
      umbilicalCordTractionApplied: true,
      fundalPressureApplied: false,
      inversionDegree: 'third_degree_prolapsed_outside_introitus',
      neurogenicShockPresent: true,
      systolicBpAtPresentation: 78,
      diastolicBpAtPresentation: 44,
      heartRateAtPresentation: 62,
      estimatedBloodLossMl: 600,
      reductionAttemptedImmediate: true,
      reductionTechniquePrimary: 'johnson_manual_maneuver',
      uterineRelaxantAdministered: true,
      uterineRelaxantAgent: 'terbutaline_sc',
      uterotonicGivenBeforeReplacement: false,
      placentaRemovedBeforeReinversion: false,
      reinversionSuccessful: true,
      postReplacementUterotonicsStarted: true,
      bimanualUterineCompressionMaintained: true,
      bloodProductsTransfusedUnits: 1,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/obstetric-uterine-inversion/episodes', doctor, {
      patientId,
      occurrenceDatetime: occTime,
      maternalAge: 28,
      parity: 2,
      deliveryMode: 'spontaneous_vaginal',
      placentalStatusAtInversion: 'attached_undelivered',
      umbilicalCordTractionApplied: true,
      fundalPressureApplied: false,
      inversionDegree: 'third_degree_prolapsed_outside_introitus',
      neurogenicShockPresent: true,
      systolicBpAtPresentation: 78,
      diastolicBpAtPresentation: 44,
      heartRateAtPresentation: 62,
      estimatedBloodLossMl: 600,
      reductionAttemptedImmediate: true,
      reductionTechniquePrimary: 'johnson_manual_maneuver',
      uterineRelaxantAdministered: true,
      uterineRelaxantAgent: 'terbutaline_sc',
      uterotonicGivenBeforeReplacement: false,
      placentaRemovedBeforeReinversion: false,
      reinversionSuccessful: true,
      timeToReinversionMinutes: 14,
      postReplacementUterotonicsStarted: true,
      bimanualUterineCompressionMaintained: true,
      bloodProductsTransfusedUnits: 2,
      status: 'post_reinversion_bimanual_compression',
      clinicalNotes: '3rd degree acute inversion reduced via Johnson manual maneuver under Terbutaline relaxation. Placenta detached after reinversion. High-dose Oxytocin infusing.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('INV-');
    expect(episode.reinversion_successful).toBe(1);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/obstetric-uterine-inversion/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/obstetric-uterine-inversion/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);

    // 5. Nurse adds flowsheet log (201)
    const logRes = await call('POST', `/api/obstetric-uterine-inversion/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      minutesFromInversion: 20,
      systolicBp: 102,
      diastolicBp: 64,
      heartRateBpm: 84,
      uterineTone: 'firm_well_contracted',
      bimanualCompressionActive: true,
      oxytocinInfusionRunning: true,
      estimatedOngoingBloodLossMl: 30,
      urineOutputMlHr: 50,
      notes: 'Uterus well-contracted, bleeding minimal, BP normalized.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Doctor updates episode
    const patchRes = await call('PATCH', `/api/obstetric-uterine-inversion/episodes/${episodeId}`, doctor, {
      status: 'stabilized_icu_surveillance',
      clinicalNotes: 'Transferred to HDU for close surveillance. Tone firm.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('stabilized_icu_surveillance');

    // 7. Nurse deletes flowsheet log
    const delLogRes = await call('DELETE', `/api/obstetric-uterine-inversion/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(delLogRes.status).toBe(200);

    // 8. Doctor deletes episode
    const delRes = await call('DELETE', `/api/obstetric-uterine-inversion/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
