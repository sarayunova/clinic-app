import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateSilvermanScore,
  calculateDownesScore,
  calculateDailyFluidGoal,
  calculateWeightVelocity,
} from '../web/src/sncuEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
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

describe('Special Newborn Care Unit (SNCU / Level-2 NICU) Clinical Engine', () => {
  it('correctly calculates Silverman-Anderson respiratory distress score and severity tiers', () => {
    // Normal / No distress (Score 0)
    const score0 = calculateSilvermanScore({
      upperChestRetraction: 0,
      lowerChestRetraction: 0,
      xiphoidRetraction: 0,
      naresDilation: 0,
      expiratoryGrunt: 0,
    });
    expect(score0.score).toBe(0);
    expect(score0.severity).toBe('none');

    // Moderate distress (Score 4) -> Bubble CPAP recommendation
    const score4 = calculateSilvermanScore({
      upperChestRetraction: 1,
      lowerChestRetraction: 1,
      xiphoidRetraction: 1,
      naresDilation: 1,
      expiratoryGrunt: 0,
    });
    expect(score4.score).toBe(4);
    expect(score4.severity).toBe('moderate');
    expect(score4.respiratoryRecommendation).toContain('Bubble CPAP');

    // Severe respiratory failure (Score 8 > 6) -> Intubation alert
    const score8 = calculateSilvermanScore({
      upperChestRetraction: 2,
      lowerChestRetraction: 2,
      xiphoidRetraction: 2,
      naresDilation: 1,
      expiratoryGrunt: 1,
    });
    expect(score8.score).toBe(8);
    expect(score8.severity).toBe('severe_impending_failure');
    expect(score8.respiratoryRecommendation).toContain('intubation');
  });

  it('correctly calculates Downes score across clinical thresholds', () => {
    // Normal (Score 0)
    const normal = calculateDownesScore({
      respiratoryRateScore: 0,
      cyanosisScore: 0,
      airEntryScore: 0,
      gruntingScore: 0,
      retractionsScore: 0,
    });
    expect(normal.score).toBe(0);
    expect(normal.severity).toBe('none');

    // Moderate (Score 5: 4-7)
    const moderate = calculateDownesScore({
      respiratoryRateScore: 1,
      cyanosisScore: 1,
      airEntryScore: 1,
      gruntingScore: 1,
      retractionsScore: 1,
    });
    expect(moderate.score).toBe(5);
    expect(moderate.severity).toBe('moderate');
    expect(moderate.recommendation).toContain('CPAP');

    // Severe (Score 8 > 7)
    const severe = calculateDownesScore({
      respiratoryRateScore: 2,
      cyanosisScore: 2,
      airEntryScore: 2,
      gruntingScore: 1,
      retractionsScore: 1,
    });
    expect(severe.score).toBe(8);
    expect(severe.severity).toBe('severe');
  });

  it('calculates daily fluid goals by gestation, Day of Life, and phototherapy water loss', () => {
    // Term infant DOL 1 (60 mL/kg/d)
    const termDol1 = calculateDailyFluidGoal(39, 1, false);
    expect(termDol1.recommendedMlKgDay).toBe(60);

    // Preterm infant DOL 1 (80 mL/kg/d)
    const pretermDol1 = calculateDailyFluidGoal(32, 1, false);
    expect(pretermDol1.recommendedMlKgDay).toBe(80);

    // Preterm infant DOL 2 on phototherapy (+15 mL/kg/d: 95 + 15 = 110)
    const pretermDol2Photo = calculateDailyFluidGoal(33, 2, true);
    expect(pretermDol2Photo.recommendedMlKgDay).toBe(110);
    expect(pretermDol2Photo.scheduleBasis).toContain('phototherapy water loss');

    // Preterm infant DOL 5+ (150 mL/kg/d)
    const pretermDol5 = calculateDailyFluidGoal(32, 5, false);
    expect(pretermDol5.recommendedMlKgDay).toBe(150);
  });

  it('computes neonatal weight velocity and flags excessive weight loss', () => {
    // Normal 5% loss
    const normalLoss = calculateWeightVelocity(2000, 1900, 2);
    expect(normalLoss.percentageChangeFromBirth).toBe(-5.0);
    expect(normalLoss.weightLossExceedsThreshold).toBe(false);

    // Excessive 12% loss (> 10% threshold)
    const excessiveLoss = calculateWeightVelocity(2000, 1760, 3);
    expect(excessiveLoss.percentageChangeFromBirth).toBe(-12.0);
    expect(excessiveLoss.weightLossExceedsThreshold).toBe(true);
    expect(excessiveLoss.summary).toContain('Excessive physiological loss');

    // Weight gain
    const gain = calculateWeightVelocity(2000, 2100, 5);
    expect(gain.percentageChangeFromBirth).toBe(5.0);
    expect(gain.velocityGPerDay).toBe(20.0);
  });
});

describe('SNCU Inpatient Endpoints & Lifecycle', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. Lingeshwar Neonatologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.sncu',
      fullName: 'Nurse Kavitha SNCU',
      role: 'nurse',
      password: 'temp-pass-nurse-sncu',
    });
    const nurseFirst = await login('nurse.sncu', 'temp-pass-nurse-sncu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-sncu',
      newPassword: PW,
    });
    nurse = await login('nurse.sncu');

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.sncu',
      fullName: 'Desk Attender',
      role: 'attender',
      password: 'temp-pass-desk-sncu',
    });
    const deskFirst = await login('desk.sncu', 'temp-pass-desk-sncu');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-sncu',
      newPassword: PW,
    });
    desk = await login('desk.sncu');

    // Create Preterm Infant Patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Meera Preterm',
      phone: '9845012345',
      dateOfBirth: '2026-11-05',
      address: 'Bangalore',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('calculates live fluid and respiratory indices via POST /api/sncu/calculate-fluid-silverman', async () => {
    const res = await call('POST', '/api/sncu/calculate-fluid-silverman', nurse, {
      gestationalAgeWeeks: 33,
      dayOfLife: 2,
      phototherapyActive: true,
      birthWeightG: 1800,
      currentWeightG: 1720,
      upperChestRetraction: 1,
      lowerChestRetraction: 1,
      xiphoidRetraction: 1,
      naresDilation: 1,
      expiratoryGrunt: 0,
      respiratoryRateScore: 1,
      cyanosisScore: 0,
      airEntryScore: 1,
      gruntingScore: 1,
      retractionsScore: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.fluidGoal.recommendedMlKgDay).toBe(110);
    expect(res.body.silvermanEval.score).toBe(4);
    expect(res.body.silvermanEval.severity).toBe('moderate');
    expect(res.body.downesEval.score).toBe(4);
  });

  it('creates, lists, updates, audits, and deletes an SNCU admission with RBAC', async () => {
    // 1. Attender cannot create admission (403)
    const failAttender = await call('POST', '/api/sncu', desk, {
      patientId,
      admissionDatetime: '2026-11-05T08:00:00',
      birthWeightG: 1850,
      gestationalAgeWeeks: 33,
      admissionIndication: 'respiratory_distress',
    });
    expect(failAttender.status).toBe(403);

    // 2. Nurse creates SNCU admission
    const createRes = await call('POST', '/api/sncu', nurse, {
      patientId,
      admissionDatetime: '2026-11-05T08:00:00',
      birthWeightG: 1850,
      gestationalAgeWeeks: 33,
      gestationalAgeDays: 4,
      admissionIndication: 'respiratory_distress',
      respiratorySupport: 'bubble_cpap',
      fio2Percent: 30,
      peepCmH2o: 5,
      flowRateLMin: 5,
      silvermanAndersonScore: 4,
      downesScore: 4,
      phototherapyStatus: 'single_surface_led',
      kmcDurationHoursToday: 2.5,
      temperatureCelsius: 36.8,
      currentWeightG: 1810,
      feedingMode: 'og_tube_ebm',
      feedingVolumeMl: 15,
      feedingFrequencyHours: 2,
      ivFluidTypeRate: '10% Dextrose with electrolytes @ 4.0 mL/hr',
      heartRateBpm: 142,
      respiratoryRateBpm: 64,
      spo2Percent: 94,
      capillaryBloodGlucoseMgDl: 68,
      antibioticRegimen: 'Inj Ampicillin + Inj Gentamicin Day 1',
      clinicalNotes: 'Admitted with moderate RDS. Bubble CPAP started with good chest excursion.',
      status: 'admitted',
      attendingPediatrician: 'Dr. Lingeshwar',
    });

    expect(createRes.status).toBe(200);
    const sncuId = createRes.body.id;
    expect(sncuId).toBeTypeOf('number');
    expect(createRes.body.respiratorySupport).toBe('bubble_cpap');
    expect(createRes.body.silvermanAndersonScore).toBe(4);

    // 3. Verify audit log for creation
    const auditCreate = db
      .prepare("SELECT * FROM audit_events WHERE action = 'sncu.admission_create'")
      .get() as any;
    expect(auditCreate).toBeDefined();
    expect(Number(auditCreate.entity_id)).toBe(sncuId);

    // 4. List admissions for patient
    const listRes = await call('GET', `/api/patients/${patientId}/sncu`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(sncuId);

    // 5. Get by ID
    const getRes = await call('GET', `/api/sncu/${sncuId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.birthWeightG).toBe(1850);

    // 6. Nurse updates clinical round (weaned to low-flow nasal prongs)
    const updateRes = await call('PUT', `/api/sncu/${sncuId}`, nurse, {
      ...createRes.body,
      respiratorySupport: 'low_flow_nasal_prongs',
      fio2Percent: 25,
      silvermanAndersonScore: 1,
      downesScore: 1,
      currentWeightG: 1840,
      clinicalNotes: 'Respiratory distress resolved. Weaned off CPAP to nasal prongs.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.respiratorySupport).toBe('low_flow_nasal_prongs');
    expect(updateRes.body.silvermanAndersonScore).toBe(1);

    // 7. Audit print sheet
    const printRes = await call('POST', `/api/sncu/${sncuId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);
    const auditPrint = db
      .prepare("SELECT * FROM audit_events WHERE action = 'sncu.admission_print'")
      .get() as any;
    expect(auditPrint).toBeDefined();

    // 8. Attender cannot delete (403)
    const failDelete = await call('DELETE', `/api/sncu/${sncuId}`, desk);
    expect(failDelete.status).toBe(403);

    // 9. Doctor deletes admission (200)
    const delRes = await call('DELETE', `/api/sncu/${sncuId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deletedId).toBe(sncuId);

    const auditDelete = db
      .prepare("SELECT * FROM audit_events WHERE action = 'sncu.admission_delete'")
      .get() as any;
    expect(auditDelete).toBeDefined();
  });
});
