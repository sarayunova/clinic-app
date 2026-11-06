import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluateOgttDipsi,
  evaluateOgttIadpsg,
  evaluateOgttCarpenterCoustan,
  classifyGlucoseReading,
  calculateGlycemicSummary,
  assessMacrosomiaRisk,
  getGdmDeliveryAdvisory,
} from '../web/src/gdmEngine.js';

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
    fullName: 'Pooja Reddy',
    dateOfBirth: '1995-04-12',
    phone: '9845099887',
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('GDM Diagnostic & Glycemic Calculation Engine', () => {
  it('correctly evaluates DIPSI 75g non-fasting OGTT criteria', () => {
    // Normal < 120
    const normal = evaluateOgttDipsi(110);
    expect(normal.isGdm).toBe(false);
    expect(normal.category).toBe('normal');

    // Impaired 120-139
    const iggt = evaluateOgttDipsi(132);
    expect(iggt.isGdm).toBe(false);
    expect(iggt.category).toBe('impaired_glucose_tolerance');

    // GDM >= 140
    const gdm = evaluateOgttDipsi(158);
    expect(gdm.isGdm).toBe(true);
    expect(gdm.category).toBe('gdm');
  });

  it('correctly evaluates IADPSG 75g fasting OGTT criteria', () => {
    // All normal
    const normal = evaluateOgttIadpsg(85, 140, 120);
    expect(normal.isGdm).toBe(false);

    // Fasting >= 92 alone triggers GDM
    const highFasting = evaluateOgttIadpsg(96, 150, 130);
    expect(highFasting.isGdm).toBe(true);
    expect(highFasting.abnormalCount).toBe(1);

    // 2-hour >= 153 alone triggers GDM
    const high2hr = evaluateOgttIadpsg(88, 160, 162);
    expect(high2hr.isGdm).toBe(true);
  });

  it('correctly evaluates Carpenter-Coustan 100g 3-hour criteria (>= 2 abnormal required)', () => {
    // 1 abnormal: Impaired, not yet GDM
    const oneAbnormal = evaluateOgttCarpenterCoustan(98, 160, 140, 120);
    expect(oneAbnormal.isGdm).toBe(false);
    expect(oneAbnormal.category).toBe('impaired_glucose_tolerance');

    // 2 abnormal: GDM
    const twoAbnormal = evaluateOgttCarpenterCoustan(98, 192, 140, 120);
    expect(twoAbnormal.isGdm).toBe(true);
    expect(twoAbnormal.category).toBe('gdm');
    expect(twoAbnormal.abnormalCount).toBe(2);
  });

  it('classifies blood glucose readings into targets, excursions, and hypoglycemia', () => {
    // Fasting target <= 95
    expect(classifyGlucoseReading('fasting', 88).status).toBe('in_target');
    expect(classifyGlucoseReading('fasting', 105).status).toBe('mild_excursion');
    expect(classifyGlucoseReading('fasting', 135).status).toBe('severe_excursion');

    // Postprandial 2-hour target <= 120
    expect(classifyGlucoseReading('post_lunch', 115, 95, 120, '2_hour').status).toBe('in_target');
    expect(classifyGlucoseReading('post_lunch', 138, 95, 120, '2_hour').status).toBe('mild_excursion');
    expect(classifyGlucoseReading('post_lunch', 165, 95, 120, '2_hour').status).toBe('severe_excursion');

    // Hypoglycemia
    expect(classifyGlucoseReading('fasting', 64).status).toBe('mild_hypoglycemia');
    expect(classifyGlucoseReading('fasting', 52).status).toBe('severe_hypoglycemia');
  });

  it('computes accurate Time In Range (TIR %) and Mean Blood Glucose (MBG)', () => {
    const sampleLogs = [
      { blood_glucose_mg_dl: 85, meal_slot: 'fasting' },
      { blood_glucose_mg_dl: 110, meal_slot: 'post_breakfast' },
      { blood_glucose_mg_dl: 90, meal_slot: 'pre_lunch' },
      { blood_glucose_mg_dl: 118, meal_slot: 'post_lunch' },
      { blood_glucose_mg_dl: 155, meal_slot: 'post_dinner' }, // excursion
    ];

    const summary = calculateGlycemicSummary(sampleLogs);
    expect(summary.totalReadings).toBe(5);
    expect(summary.meanBloodGlucose).toBe(111.6);
    expect(summary.inTargetCount).toBe(4);
    expect(summary.excursionCount).toBe(1);
    expect(summary.timeInRangePercent).toBe(80);
    expect(summary.timeAboveRangePercent).toBe(20);
  });

  it('evaluates fetal macrosomia and polyhydramnios risk correctly', () => {
    // Normal
    const norm = assessMacrosomiaRisk(50, 2400, 48, 14);
    expect(norm.riskFlag).toBe('normal');

    // Borderline AC >= 75th percentile
    const borderline = assessMacrosomiaRisk(80, 3100, 70, 16);
    expect(borderline.riskFlag).toBe('borderline_ac_over_75');

    // Severe macrosomia / Polyhydramnios
    const macro = assessMacrosomiaRisk(92, 4200, 95, 26);
    expect(macro.riskFlag).toBe('polyhydramnios');
  });

  it('provides delivery timing recommendations based on White classification and EFW', () => {
    const advA1 = getGdmDeliveryAdvisory('a1_diet', 'good', 3200);
    expect(advA1).toContain('39w0d - 40w6d');

    const advA2 = getGdmDeliveryAdvisory('a2_medication', 'good', 3300);
    expect(advA2).toContain('39w0d and 39w6d');

    const advCeasarean = getGdmDeliveryAdvisory('a2_medication', 'good', 4600);
    expect(advCeasarean).toContain('elective cesarean');
  });
});

describe('Gestational Diabetes & Glycemic Tracker API Endpoints', () => {
  it('creates a new GDM profile and retrieves it', async () => {
    const createRes = await call('POST', `/api/patients/${patientId}/gdm/profile`, doctor, {
      gestationalAgeWeeks: 26,
      diagnosticCriteria: 'dipsi',
      diagnosticDate: '2026-10-15',
      ogtt2hrMgDl: 162,
      baselineHba1c: 5.8,
      whiteClassification: 'a1_diet',
      currentManagement: 'medical_nutrition_therapy',
      targetFastingMgDl: 95,
      targetPostprandialMgDl: 120,
      postprandialWindow: '2_hour',
      targetHba1c: 6.0,
      notes: 'Patient advised 1800 kcal pregnancy diabetic diet with 3 main meals and 2 snacks',
    });

    expect(createRes.status).toBe(200);
    expect(createRes.body.profile.diagnostic_criteria).toBe('dipsi');
    expect(createRes.body.profile.ogtt_2hr_mg_dl).toBe(162);

    const getRes = await call('GET', `/api/patients/${patientId}/gdm/profile`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.profile.white_classification).toBe('a1_diet');
    expect(getRes.body.summary.totalReadings).toBe(0);
  });

  it('logs blood glucose readings, verifies auto-classification and fetches logs', async () => {
    // 1. Create profile
    await call('POST', `/api/patients/${patientId}/gdm/profile`, doctor, {
      gestationalAgeWeeks: 28,
      diagnosticCriteria: 'iadpsg',
      diagnosticDate: '2026-10-10',
      ogttFastingMgDl: 96,
      ogtt1hrMgDl: 185,
      ogtt2hrMgDl: 148,
      whiteClassification: 'a1_diet',
      currentManagement: 'medical_nutrition_therapy',
    });

    // 2. Add single log
    const logRes = await call('POST', `/api/patients/${patientId}/gdm/logs`, doctor, {
      logDate: '2026-11-01',
      logTime: '08:00',
      mealSlot: 'fasting',
      bloodGlucoseMgDl: 92,
      notes: 'Before breakfast',
    });

    expect(logRes.status).toBe(200);
    expect(logRes.body.log.target_status).toBe('in_target');
    expect(logRes.body.classification.label).toContain('In Target');

    // 3. Batch add logs
    const batchRes = await call('POST', `/api/patients/${patientId}/gdm/logs/batch`, doctor, {
      logs: [
        {
          logDate: '2026-11-01',
          logTime: '10:00',
          mealSlot: 'post_breakfast',
          bloodGlucoseMgDl: 135,
          notes: 'Had paratha with tea',
        },
        {
          logDate: '2026-11-01',
          logTime: '14:30',
          mealSlot: 'post_lunch',
          bloodGlucoseMgDl: 112,
        },
        {
          logDate: '2026-11-01',
          logTime: '21:30',
          mealSlot: 'post_dinner',
          bloodGlucoseMgDl: 145, // excursion
        },
      ],
    });

    expect(batchRes.status).toBe(200);
    expect(batchRes.body.insertedCount).toBe(3);

    // 4. Check analytics
    const analyticsRes = await call('GET', `/api/patients/${patientId}/gdm/analytics`, doctor);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.summary.totalReadings).toBe(4);
    expect(analyticsRes.body.summary.excursionCount).toBe(2);

    // 5. Delete a log entry
    const logsList = await call('GET', `/api/patients/${patientId}/gdm/logs`, doctor);
    expect(logsList.status).toBe(200);
    expect(logsList.body.logs.length).toBe(4);

    const firstId = logsList.body.logs[0].id;
    const delRes = await call('DELETE', `/api/patients/${patientId}/gdm/logs/${firstId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  it('updates GDM profile management to insulin when excursions persist', async () => {
    const profRes = await call('POST', `/api/patients/${patientId}/gdm/profile`, doctor, {
      gestationalAgeWeeks: 30,
      diagnosticCriteria: 'dipsi',
      diagnosticDate: '2026-10-01',
      ogtt2hrMgDl: 172,
      whiteClassification: 'a1_diet',
      currentManagement: 'medical_nutrition_therapy',
    });
    const profId = profRes.body.profile.id;

    // Escalate to Basal-Bolus Insulin (A2)
    const patchRes = await call('PATCH', `/api/patients/${patientId}/gdm/profile/${profId}`, doctor, {
      whiteClassification: 'a2_medication',
      currentManagement: 'insulin',
      insulinRegimenType: 'basal_bolus',
      basalInsulinName: 'Insulin Glargine',
      basalUnitsNight: 10,
      bolusInsulinName: 'Insulin Aspart',
      bolusUnitsBreakfast: 4,
      bolusUnitsLunch: 4,
      bolusUnitsDinner: 6,
      notes: 'Initiated basal-bolus insulin due to recurring postprandial excursions.',
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.profile.white_classification).toBe('a2_medication');
    expect(patchRes.body.profile.current_management).toBe('insulin');
    expect(patchRes.body.profile.basal_units_night).toBe(10);
  });

  it('records fetal surveillance and macrosomia assessment', async () => {
    await call('POST', `/api/patients/${patientId}/gdm/profile`, doctor, {
      gestationalAgeWeeks: 32,
      diagnosticCriteria: 'dipsi',
      diagnosticDate: '2026-09-20',
      ogtt2hrMgDl: 150,
    });

    const surRes = await call('POST', `/api/patients/${patientId}/gdm/surveillance`, doctor, {
      assessmentDate: '2026-11-05',
      gestationalAgeWeeks: 34,
      estimatedFetalWeightG: 2850,
      efwPercentile: 82,
      abdominalCircumferenceMm: 318,
      acPercentile: 88,
      amnioticFluidIndexCm: 18.5,
      singleDeepestPocketCm: 6.2,
      clinicalPlan: 'Fetal AC 88th centile suggests mild fetal adiposity. Maintain tight maternal fasting control.',
    });

    expect(surRes.status).toBe(200);
    expect(surRes.body.surveillance.macrosomia_risk_flag).toBe('borderline_ac_over_75');
    expect(surRes.body.riskEvaluation.severityLabel).toContain('Borderline: Asymmetric Fetal Growth');

    const listRes = await call('GET', `/api/patients/${patientId}/gdm/surveillance`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.surveillance.length).toBe(1);
  });

  it('enforces permission restrictions: desk cannot write clinical GDM logs', async () => {
    const res = await call('POST', `/api/patients/${patientId}/gdm/profile`, desk, {
      diagnosticCriteria: 'dipsi',
      diagnosticDate: '2026-11-01',
      ogtt2hrMgDl: 150,
    });
    expect(res.status).toBe(403);
  });
});
