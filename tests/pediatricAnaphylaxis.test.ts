import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  evaluateWaoCriteria,
  calculateEpinephrineImDose,
  recommendAutoinjector,
  evaluatePediatricAnaphylaxis,
} from '../web/src/pediatricAnaphylaxisEngine.js';

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
describe('Pediatric Anaphylaxis Resuscitation Engine (Pure Unit Tests)', () => {
  it('correctly evaluates WAO 2020 diagnostic criteria across presentation phenotypes', () => {
    // Criterion 1: Skin + Respiratory
    const c1 = evaluateWaoCriteria({
      ageMonths: 36,
      weightKg: 14,
      triggerType: 'food_peanut_nut_milk_egg',
      skinMucosalInvolvement: true,
      respiratoryCompromise: true,
      cardiovascularHypotension: false,
      persistentGastrointestinal: false,
    });
    expect(c1.met).toBe(true);
    expect(c1.reason).toContain('Criterion 1');

    // Criterion 2: 2 systems without skin (Respiratory + GI)
    const c2 = evaluateWaoCriteria({
      ageMonths: 60,
      weightKg: 20,
      triggerType: 'insect_venom_bee_wasp',
      skinMucosalInvolvement: false,
      respiratoryCompromise: true,
      cardiovascularHypotension: false,
      persistentGastrointestinal: true,
    });
    expect(c2.met).toBe(true);
    expect(c2.reason).toContain('Criterion 2');

    // Isolated hives without systemic symptoms -> Not Met
    const notMet = evaluateWaoCriteria({
      ageMonths: 48,
      weightKg: 18,
      triggerType: 'idiopathic',
      skinMucosalInvolvement: true,
      respiratoryCompromise: false,
      cardiovascularHypotension: false,
      persistentGastrointestinal: false,
    });
    expect(notMet.met).toBe(false);
  });

  it('correctly calculates weight-adjusted IM Epinephrine dose with min/max safety boundaries', () => {
    // 15 kg child -> 0.15 mg (0.15 mL)
    expect(calculateEpinephrineImDose(15)).toEqual({ doseMg: 0.15, volumeMl: 0.15 });

    // 4 kg infant -> 0.05 mg (minimum floor)
    expect(calculateEpinephrineImDose(4)).toEqual({ doseMg: 0.05, volumeMl: 0.05 });

    // 60 kg adolescent -> 0.50 mg (maximum ceiling)
    expect(calculateEpinephrineImDose(60)).toEqual({ doseMg: 0.50, volumeMl: 0.50 });
  });

  it('recommends autoinjector or syringe drawn based on pediatric weight classes', () => {
    // < 7.5 kg -> Syringe drawn
    expect(recommendAutoinjector(6.0).type).toBe('syringe_drawn');

    // 7.5 - 25 kg -> EpiPen Jr 0.15 mg
    expect(recommendAutoinjector(15.0).type).toBe('epipen_jr_0_15mg');

    // > 25 kg -> EpiPen Adult 0.30 mg
    expect(recommendAutoinjector(32.0).type).toBe('epipen_adult_0_30mg');
  });

  it('identifies refractory anaphylactic shock after >= 2 IM doses and recommends IV Epinephrine infusion', () => {
    const res = evaluatePediatricAnaphylaxis({
      ageMonths: 72,
      weightKg: 22,
      triggerType: 'food_peanut_nut_milk_egg',
      skinMucosalInvolvement: true,
      respiratoryCompromise: true,
      cardiovascularHypotension: true,
      persistentGastrointestinal: false,
      stridorPresent: true,
      priorImEpinephrineDosesGiven: 2, // 2 prior IM doses with persistent hypotension
    });

    expect(res.severityTier).toBe('refractory_shock');
    expect(res.refractoryShockDeclared).toBe(true);
    expect(res.ivEpinephrineInfusionRecommended).toBe(true);
    expect(res.fluidBolusVolumeMl).toBe(440); // 22 kg * 20 mL/kg = 440 mL
    expect(res.biphasicSurveillanceHours).toBe(24);
  });

  it('flags glucagon for anaphylaxis in patients receiving beta-blocker therapy', () => {
    const res = evaluatePediatricAnaphylaxis({
      ageMonths: 120,
      weightKg: 35,
      triggerType: 'medication_antibiotic_nsaid',
      skinMucosalInvolvement: true,
      respiratoryCompromise: true,
      cardiovascularHypotension: true,
      persistentGastrointestinal: false,
      onBetaBlockerTherapy: true,
    });

    expect(res.glucagonIndicated).toBe(true);
    expect(res.glucagonDoseMg).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Anaphylaxis REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pem',
      fullName: 'Dr. V. Rao (Pediatric Emergency Medicine)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ed',
      fullName: 'Staff Nurse Rohit (Pediatric ED)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ed', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ed', PW);

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

    // Pediatric Patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Patel (5yo Anaphylaxis)',
      dateOfBirth: '2021-06-15',
      phone: '+91 98765 33333',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to preview calculation and create a pediatric anaphylaxis episode', async () => {
    // 1. Preview calculation
    const previewRes = await call('POST', '/api/pediatric-anaphylaxis/evaluate', doctor, {
      ageMonths: 60,
      weightKg: 18,
      triggerType: 'food_peanut_nut_milk_egg',
      skinMucosalInvolvement: true,
      respiratoryCompromise: true,
      cardiovascularHypotension: false,
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.evalResult.anaphylaxisCriteriaMet).toBe(true);
    expect(previewRes.body.evalResult.epinephrineImDoseMg).toBe(0.18);
    expect(previewRes.body.evalResult.recommendedAutoinjector).toBe('epipen_jr_0_15mg');

    // 2. Create episode
    const payload = {
      patientId,
      triageDatetime: '2026-11-08T10:00:00',
      ageMonths: 60,
      weightKg: 18,
      triggerType: 'food_peanut_nut_milk_egg',
      triggerDetails: 'Accidental peanut ingestion at school cafeteria.',
      skinMucosalInvolvement: true,
      respiratoryCompromise: true,
      cardiovascularHypotension: false,
      persistentGastrointestinal: false,
      imEpinephrineDosesGiven: 1,
      epinephrineFirstDoseDatetime: '2026-11-08T10:05:00',
      refractoryShockDeclared: false,
      ivEpinephrineInfusionActive: false,
      secondLineH1AntihistamineGiven: true,
      secondLineH2AntihistamineGiven: false,
      systemicSteroidGiven: true,
      glucagonAdministered: false,
      fluidBolusVolumeMl: 360,
      status: 'acute_resuscitation_bay',
      clinicalNotes: 'First IM dose (0.18 mg) administered in right anterolateral thigh. Wheezing improving.',
    };

    const res = await call('POST', '/api/pediatric-anaphylaxis/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toMatch(/^ANAPH-/);
    expect(res.body.episode.anaphylaxis_criteria_met).toBe(1);
    expect(res.body.evalResult).toBeDefined();

    const episodeId = res.body.episode.id;

    // 3. Nurse logs bedside flowsheet checkpoint
    const logRes = await call('POST', `/api/pediatric-anaphylaxis/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T10:15:00',
      minutesFromArrival: 15,
      sbpMmhg: 92,
      dbpMmhg: 56,
      heartRateBpm: 125,
      respiratoryRate: 26,
      spo2Percent: 97,
      stridorPresent: false,
      wheezeSeverity: 'mild',
      urticariaCoverage: 'localized',
      cumulativeImEpinephrineDoses: 1,
      cumulativeCrystalloidMl: 360,
      notes: 'Urticaria fading, good peripheral perfusion restored.',
    });
    expect(logRes.status).toBe(201);
    expect(logRes.body.logId).toBeDefined();

    // 4. Get episode detail
    const detailRes = await call('GET', `/api/pediatric-anaphylaxis/episodes/${episodeId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.episode.id).toBe(episodeId);
    expect(detailRes.body.logs.length).toBe(1);
    expect(detailRes.body.evalResult.anaphylaxisCriteriaMet).toBe(true);

    // 5. Delete flowsheet log and episode
    const flowsheetId = logRes.body.logId;
    const delFlowRes = await call('DELETE', `/api/pediatric-anaphylaxis/episodes/${episodeId}/flowsheet-logs/${flowsheetId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    const delEpRes = await call('DELETE', `/api/pediatric-anaphylaxis/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });

  it('enforces RBAC: attender cannot create episodes or log flowsheet', async () => {
    // First create episode as doctor
    const epPayload = {
      patientId,
      triageDatetime: '2026-11-08T10:00:00',
      ageMonths: 60,
      weightKg: 18,
      triggerType: 'food_peanut_nut_milk_egg',
      skinMucosalInvolvement: true,
      respiratoryCompromise: true,
      cardiovascularHypotension: false,
      persistentGastrointestinal: false,
      imEpinephrineDosesGiven: 1,
      epinephrineFirstDoseDatetime: '2026-11-08T10:05:00',
      status: 'acute_resuscitation_bay',
    };

    const epRes = await call('POST', '/api/pediatric-anaphylaxis/episodes', doctor, epPayload);
    expect(epRes.status).toBe(201);
    const validEpId = epRes.body.episode.id;

    const resCreate = await call('POST', '/api/pediatric-anaphylaxis/episodes', attender, epPayload);
    expect(resCreate.status).toBe(403);

    const resFlow = await call('POST', `/api/pediatric-anaphylaxis/episodes/${validEpId}/flowsheet-logs`, attender, {
      logDatetime: '2026-11-08T10:20:00',
      minutesFromArrival: 20,
      sbpMmhg: 90,
      heartRateBpm: 120,
      respiratoryRate: 24,
      spo2Percent: 98,
      stridorPresent: false,
      wheezeSeverity: 'none',
      urticariaCoverage: 'localized',
    });
    expect(resFlow.status).toBe(403);
  });
});
