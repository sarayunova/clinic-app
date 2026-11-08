import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateAnionGap,
  calculateCorrectedSodium,
  calculateEffectiveOsmolality,
  evaluateObstetricDka,
} from '../web/src/obstetricDkaEngine.js';

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
describe('Obstetric DKA & Euglycemic Acidosis Engine (Pure Unit Tests)', () => {
  it('correctly calculates serum anion gap', () => {
    // Na 136 - (Cl 102 + HCO3 12) = 22 mEq/L
    expect(calculateAnionGap(136, 102, 12)).toBe(22);

    // Normal gap: Na 140 - (Cl 104 + HCO3 24) = 12 mEq/L
    expect(calculateAnionGap(140, 104, 24)).toBe(12);
  });

  it('correctly calculates corrected sodium for hyperglycemia', () => {
    // Measured Na 130, Glucose 400: 130 + 1.6 * (400 - 100) / 100 = 130 + 4.8 = 134.8
    expect(calculateCorrectedSodium(130, 400)).toBe(134.8);

    // Glucose <= 100: returns measured Na
    expect(calculateCorrectedSodium(138, 95)).toBe(138);
  });

  it('correctly calculates effective serum osmolality', () => {
    // 2 * 135 + 360 / 18 = 270 + 20 = 290 mOsm/kg
    expect(calculateEffectiveOsmolality(135, 360)).toBe(290);
  });

  it('identifies Euglycemic DKA when blood glucose < 200 mg/dL with high anion gap acidosis', () => {
    const res = evaluateObstetricDka({
      gestationWeeks: 31,
      maternalWeightKg: 68,
      diabetesType: 'pregestational_type1',
      bloodGlucoseMgDl: 175, // Euglycemic presentation
      arterialOrVenousPh: 7.22,
      serumBicarbonateMeqL: 11,
      serumSodiumMeqL: 137,
      serumPotassiumMeqL: 4.1,
      serumChlorideMeqL: 104,
      serumKetonesBetaOhbMmolL: 4.8,
      urineKetones: '3_plus',
    });

    expect(res.isEuglycemicDka).toBe(true);
    expect(res.calculatedAnionGap).toBe(22);
    expect(res.summary).toContain('Obstetric Euglycemic DKA');
    expect(res.regularInsulinInfusionRateUnitsHr).toBe(3.4); // 0.05 U/kg/hr for 68 kg
    expect(res.clinicalActionProtocol.some((p) => p.includes('D5W or D10W'))).toBe(true);
  });

  it('evaluates severe hyperglycemic obstetric DKA and emphasizes avoiding premature cesarean delivery', () => {
    const res = evaluateObstetricDka({
      gestationWeeks: 34,
      maternalWeightKg: 75,
      diabetesType: 'gestational_gdm',
      bloodGlucoseMgDl: 460,
      arterialOrVenousPh: 7.12,
      serumBicarbonateMeqL: 8,
      serumSodiumMeqL: 132,
      serumPotassiumMeqL: 4.5,
      serumChlorideMeqL: 98,
      fetalHeartRateBaselineBpm: 168,
      fetalVariability: 'minimal',
      decelerationsPresent: 'late',
      efmCategory: 'category_2_indeterminate',
    });

    expect(res.isEuglycemicDka).toBe(false);
    expect(res.dkaSeverityTier).toBe('severe_critical');
    expect(res.deliveryContraindicatedDuringAcidosis).toBe(true);
    expect(res.fetalResuscitationGuidance).toContain('DO NOT PERFORM IMMEDIATE CESAREAN DELIVERY');
  });

  it('safely holds insulin infusion when serum potassium is critically low (< 3.3 mEq/L)', () => {
    const res = evaluateObstetricDka({
      gestationWeeks: 28,
      maternalWeightKg: 60,
      diabetesType: 'pregestational_type2',
      bloodGlucoseMgDl: 320,
      arterialOrVenousPh: 7.28,
      serumBicarbonateMeqL: 14,
      serumSodiumMeqL: 135,
      serumPotassiumMeqL: 3.1, // Hypokalemia
      serumChlorideMeqL: 102,
    });

    expect(res.holdInsulinForHypokalemia).toBe(true);
    expect(res.potassiumReplacementAdvice).toContain('HOLD insulin infusion');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric DKA REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. M. Roy (Maternal-Fetal Specialist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.maternity',
      fullName: 'Staff Nurse Sunita (Labor Ward)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.maternity', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.maternity', PW);

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

    // Pregnant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Sharma (32w GDM / DKA)',
      dateOfBirth: '1995-04-12',
      phone: '+91 98765 22222',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to preview calculation and create an obstetric DKA episode', async () => {
    // 1. Preview calculation
    const previewRes = await call('POST', '/api/obstetric-dka/evaluate', doctor, {
      gestationWeeks: 32,
      maternalWeightKg: 70,
      diabetesType: 'pregestational_type1',
      bloodGlucoseMgDl: 180,
      arterialOrVenousPh: 7.23,
      serumBicarbonateMeqL: 12,
      serumSodiumMeqL: 136,
      serumPotassiumMeqL: 4.2,
      serumChlorideMeqL: 102,
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.evalResult.isEuglycemicDka).toBe(true);

    // 2. Create episode
    const payload = {
      patientId,
      presentationDatetime: '2026-11-08T09:30:00',
      gestationWeeks: 32,
      maternalWeightKg: 70,
      diabetesType: 'pregestational_type1',
      precipitatingTrigger: 'infection_sepsis',
      bloodGlucoseMgDl: 180,
      arterialOrVenousPh: 7.23,
      serumBicarbonateMeqL: 12,
      serumKetonesBetaOhbMmolL: 4.6,
      urineKetones: '3_plus',
      serumSodiumMeqL: 136,
      serumPotassiumMeqL: 4.2,
      serumChlorideMeqL: 102,
      fetalHeartRateBaselineBpm: 155,
      fetalVariability: 'minimal',
      decelerationsPresent: 'late',
      efmCategory: 'category_2_indeterminate',
      status: 'euglycemic_dextrose_infusion',
      clinicalNotes: 'Commenced IV D5W + 0.45% NS with regular insulin at 3.5 units/hr. Continuous EFM active.',
    };

    const res = await call('POST', '/api/obstetric-dka/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toMatch(/^OBDKA-/);
    expect(res.body.episode.is_euglycemic_dka).toBe(1);
    expect(res.body.evalResult).toBeDefined();

    const episodeId = res.body.episode.id;

    // 3. Nurse logs bedside flowsheet
    const logRes = await call('POST', `/api/obstetric-dka/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T11:30:00',
      hoursFromPresentation: 2,
      bloodGlucoseMgDl: 165,
      insulinRateUnitsHr: 3.5,
      ivFluidType: 'd5_half_normal_saline',
      ivFluidRateMlHr: 250,
      vbgPh: 7.27,
      serumBicarbonateMeqL: 14,
      calculatedAnionGap: 18,
      serumPotassiumMeqL: 4.0,
      potassiumReplacementMeqL: 20,
      fhrBaselineBpm: 145,
      fhrVariability: 'normal_moderate',
      urineOutputMlHr: 55,
      notes: 'Glucose stable. Fetal heart rate variability improved to moderate.',
    });
    expect(logRes.status).toBe(201);
    expect(logRes.body.logId).toBeDefined();

    // 4. Get episode detail
    const detailRes = await call('GET', `/api/obstetric-dka/episodes/${episodeId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.episode.id).toBe(episodeId);
    expect(detailRes.body.logs.length).toBe(1);
    expect(detailRes.body.evalResult.isEuglycemicDka).toBe(true);

    // 5. Delete flowsheet log and episode
    const flowsheetId = logRes.body.logId;
    const delFlowRes = await call('DELETE', `/api/obstetric-dka/episodes/${episodeId}/flowsheet-logs/${flowsheetId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    const delEpRes = await call('DELETE', `/api/obstetric-dka/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });

  it('enforces RBAC: attender cannot create episodes or log flowsheet', async () => {
    // First create episode as doctor
    const epPayload = {
      patientId,
      presentationDatetime: '2026-11-08T09:30:00',
      gestationWeeks: 32,
      maternalWeightKg: 70,
      diabetesType: 'pregestational_type1',
      precipitatingTrigger: 'infection_sepsis',
      bloodGlucoseMgDl: 250,
      arterialOrVenousPh: 7.25,
      serumBicarbonateMeqL: 14,
      urineKetones: '3_plus',
      serumSodiumMeqL: 138,
      serumPotassiumMeqL: 4.0,
      serumChlorideMeqL: 104,
      status: 'active_acidosis_resuscitation',
    };

    const epRes = await call('POST', '/api/obstetric-dka/episodes', doctor, epPayload);
    expect(epRes.status).toBe(201);
    const validEpId = epRes.body.episode.id;

    const resCreate = await call('POST', '/api/obstetric-dka/episodes', attender, epPayload);
    expect(resCreate.status).toBe(403);

    const resFlow = await call('POST', `/api/obstetric-dka/episodes/${validEpId}/flowsheet-logs`, attender, {
      logDatetime: '2026-11-08T11:00:00',
      hoursFromPresentation: 1,
      bloodGlucoseMgDl: 200,
      insulinRateUnitsHr: 4.0,
      ivFluidType: 'normal_saline_0_9',
      ivFluidRateMlHr: 250,
      serumPotassiumMeqL: 4.0,
      potassiumReplacementMeqL: 20,
      urineOutputMlHr: 50,
    });
    expect(resFlow.status).toBe(403);
  });
});
