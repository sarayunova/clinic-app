import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricPlacentalAbruption } from '../web/src/obstetricPlacentalAbruptionEngine.js';

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

describe('Obstetric Placental Abruption Engine (Pure Unit Tests)', () => {
  it('classifies Page Grade 3 severe abruption with shock, hypofibrinogenemia and activates MTP + Crash Cesarean', () => {
    const res = evaluateObstetricPlacentalAbruption({
      gestationalAgeWeeks: 35.5,
      maternalParity: 1,
      vaginalBleedingSeverity: 'moderate_bleeding',
      abdominalPainCharacter: 'severe_constant_knife_like',
      uterineTonus: 'tetanic_woody_hard',
      fetalHeartRateStatus: 'severe_bradycardia_category_3',
      maternalSystolicBp: 90,
      maternalDiastolicBp: 52,
      maternalHeartRate: 130,
      serumFibrinogenMgDl: 130,
      plateletCount: 90000,
      hemoglobinGDl: 8.2,
      ultrasoundRetroplacentalHematoma: 'retroplacental_hematoma_present',
    });

    expect(res.pageClassificationGrade).toBe('grade_3_severe_maternal_shock_demise_or_dic');
    expect(res.isConsumptiveCoagulopathyPresent).toBe(true);
    expect(res.mtpActivated).toBe(true);
    expect(res.shockIndex).toBeGreaterThanOrEqual(0.9);
    expect(res.deliveryModeIndicated).toBe('emergent_crash_cesarean');
    expect(res.bloodProductRequirements.cryoprecipitatePools).toBeGreaterThanOrEqual(2);
    expect(res.alerts.some(a => a.includes('CRITICAL HYPOFIBRINOGENEMIA'))).toBe(true);
  });

  it('recommends augmented vaginal delivery rather than emergent hysterotomy in fetal demise without exsanguinating shock', () => {
    const res = evaluateObstetricPlacentalAbruption({
      gestationalAgeWeeks: 38.0,
      maternalParity: 2,
      vaginalBleedingSeverity: 'moderate_bleeding',
      abdominalPainCharacter: 'mild_cramping',
      uterineTonus: 'increased_hypertonic',
      fetalHeartRateStatus: 'intrauterine_fetal_demise_confirmed',
      maternalSystolicBp: 110,
      maternalDiastolicBp: 70,
      maternalHeartRate: 92,
      serumFibrinogenMgDl: 160,
      plateletCount: 110000,
      hemoglobinGDl: 9.8,
      ultrasoundRetroplacentalHematoma: 'retroplacental_hematoma_present',
    });

    expect(res.pageClassificationGrade).toBe('grade_3_severe_maternal_shock_demise_or_dic');
    expect(res.deliveryModeIndicated).toBe('augmented_vaginal_delivery_under_monitoring');
    expect(res.recommendations.some(d => d.includes('Intrauterine fetal demise confirmed'))).toBe(true);
  });

  it('identifies Page Grade 2 moderate abruption with fetal distress live and recommends urgent cesarean delivery', () => {
    const res = evaluateObstetricPlacentalAbruption({
      gestationalAgeWeeks: 34.0,
      maternalParity: 0,
      vaginalBleedingSeverity: 'moderate_bleeding',
      abdominalPainCharacter: 'severe_constant_knife_like',
      uterineTonus: 'increased_hypertonic',
      fetalHeartRateStatus: 'indeterminate_category_2',
      maternalSystolicBp: 116,
      maternalDiastolicBp: 74,
      maternalHeartRate: 98,
      serumFibrinogenMgDl: 240,
      plateletCount: 160000,
      hemoglobinGDl: 10.5,
      ultrasoundRetroplacentalHematoma: 'marginal_collection',
    });

    expect(res.pageClassificationGrade).toBe('grade_2_moderate_fetal_distress_live');
    expect(res.isConsumptiveCoagulopathyPresent).toBe(false);
    expect(res.mtpActivated).toBe(false);
    expect(res.deliveryModeIndicated).toBe('urgent_cesarean_transfer');
  });
});

describe('Obstetric Placental Abruption Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.abrupt',
      fullName: 'Dr. Meenakshi ObGyn',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.abrupt',
      fullName: 'Nurse Shanti LabourWard',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.abrupt', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.abrupt', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.abrupt',
      fullName: 'Attender Ashok',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.abrupt', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.abrupt', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Ramesh',
      dateOfBirth: '1996-05-12',
      phone: '9876543201',
      address: 'Labor & Delivery Bed 2',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview, create, update, and nurse to log flowsheet', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/obstetric-placental-abruption/evaluate', doctor, {
      gestationalAgeWeeks: 35.5,
      maternalParity: 1,
      vaginalBleedingSeverity: 'moderate_bleeding',
      abdominalPainCharacter: 'severe_constant_knife_like',
      uterineTonus: 'tetanic_woody_hard',
      fetalHeartRateStatus: 'severe_bradycardia_category_3',
      maternalSystolicBp: 92,
      maternalDiastolicBp: 54,
      maternalHeartRate: 128,
      serumFibrinogenMgDl: 135,
      plateletCount: 92000,
      hemoglobinGDl: 8.4,
      ultrasoundRetroplacentalHematoma: 'retroplacental_hematoma_present',
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.pageClassificationGrade).toBe('grade_3_severe_maternal_shock_demise_or_dic');
    expect(preview.body.evaluation.isConsumptiveCoagulopathyPresent).toBe(true);

    // 2. Create episode
    const created = await call('POST', '/api/obstetric-placental-abruption/episodes', doctor, {
      patientId,
      presentationDatetime: '2026-11-08T05:30:00',
      gestationalAgeWeeks: 35.5,
      maternalParity: 1,
      vaginalBleedingSeverity: 'moderate_bleeding',
      abdominalPainCharacter: 'severe_constant_knife_like',
      uterineTonus: 'tetanic_woody_hard',
      fetalHeartRateStatus: 'severe_bradycardia_category_3',
      maternalSystolicBp: 92,
      maternalDiastolicBp: 54,
      maternalHeartRate: 128,
      serumFibrinogenMgDl: 135,
      plateletCount: 92000,
      hemoglobinGDl: 8.4,
      ptInr: 1.4,
      kleihauerBetkeSent: true,
      ultrasoundRetroplacentalHematoma: 'retroplacental_hematoma_present',
      pageClassificationGrade: 'grade_3_severe_maternal_shock_demise_or_dic',
      mtpActivated: true,
      prbcUnitsTransfused: 2,
      ffpUnitsTransfused: 2,
      cryoprecipitatePoolsTransfused: 2,
      deliveryModeIndicated: 'emergent_crash_cesarean',
      status: 'crash_cesarean_in_progress',
      clinicalNotes: 'Severe abruptio placentae with tetanic woody uterus and Category 3 deceleration. Crash cesarean underway.',
    });

    expect(created.status).toBe(201);
    expect(created.body.episodeCode).toMatch(/^ABRUPT-/);
    const episodeId = created.body.episodeId || created.body.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get episode details
    const detail = await call('GET', `/api/obstetric-placental-abruption/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.uterine_tonus).toBe('tetanic_woody_hard');
    expect(detail.body.evaluation.isConsumptiveCoagulopathyPresent).toBe(true);

    // 4. Update status with doctor
    const statusUpdate = await call('PATCH', `/api/obstetric-placental-abruption/episodes/${episodeId}/status`, doctor, {
      status: 'postpartum_dic_resuscitation',
      clinicalNotes: 'Baby delivered alive. Couvelaire uterus noted. Cryoprecipitate and TXA infusing.',
    });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.success).toBe(true);

    // 5. Nurse adds flowsheet log
    const logAdd = await call('POST', `/api/obstetric-placental-abruption/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T06:00:00',
      minutesFromPresentation: 30.0,
      maternalHeartRate: 110,
      maternalBloodPressureSys: 100,
      maternalBloodPressureDia: 60,
      fetalHeartRate: null,
      uterineToneAssessment: 'woody_rigid',
      vaginalBloodLossMl: 750,
      fibrinogenMgDl: 160,
      bloodProductsInfused: '2U PRBC, 2 pools Cryo completed',
      notes: 'Hemostasis improving post Cryo infusion.',
    });
    expect(logAdd.status).toBe(201);
    const logId = logAdd.body.id || logAdd.body.logId;
    expect(logId).toBeGreaterThan(0);

    // 6. Delete flowsheet log
    const logDel = await call('DELETE', `/api/obstetric-placental-abruption/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(logDel.status).toBe(200);
    expect(logDel.body.success).toBe(true);
  });

  it('enforces RBAC preventing attender from creating abruption episodes', async () => {
    const unauth = await call('POST', '/api/obstetric-placental-abruption/episodes', attender, {
      patientId,
      presentationDatetime: '2026-11-08T05:30:00',
      gestationalAgeWeeks: 35.5,
      vaginalBleedingSeverity: 'moderate_bleeding',
      abdominalPainCharacter: 'severe_constant_knife_like',
      uterineTonus: 'tetanic_woody_hard',
      fetalHeartRateStatus: 'severe_bradycardia_category_3',
      maternalSystolicBp: 92,
      maternalDiastolicBp: 54,
      maternalHeartRate: 128,
      serumFibrinogenMgDl: 135,
      plateletCount: 92000,
      hemoglobinGDl: 8.4,
      ultrasoundRetroplacentalHematoma: 'retroplacental_hematoma_present',
      pageClassificationGrade: 'grade_3_severe_maternal_shock_demise_or_dic',
      deliveryModeIndicated: 'emergent_crash_cesarean',
    });
    expect(unauth.status).toBe(403);
  });
});
