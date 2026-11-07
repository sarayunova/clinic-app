import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateApgarScore,
  calculateSilvermanScore,
  calculateNeonatalNews,
  evaluateNeonatalGlucose,
  evaluateNrpChecklist,
} from '../web/src/neonatalScoring.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let motherId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

describe('Neonatal Scoring & Clinical Decision Engine', () => {
  it('accurately evaluates APGAR score cutoffs (Normal vs Moderate vs Severe Depression)', () => {
    // Normal / Reassuring infant (Score 9: pink body/blue hands, normal HR, tone, reflex, cry)
    const normal = calculateApgarScore({
      heartRate: 2,
      respiratoryEffort: 2,
      muscleTone: 2,
      reflexIrritability: 2,
      color: 1,
    });
    expect(normal.total).toBe(9);
    expect(normal.interpretation).toBe('reassuring');

    // Moderately depressed infant (Score 5)
    const moderate = calculateApgarScore({
      heartRate: 1, // < 100
      respiratoryEffort: 1, // slow/irregular
      muscleTone: 1, // some flexion
      reflexIrritability: 1, // grimace
      color: 1, // acrocyanosis
    });
    expect(moderate.total).toBe(5);
    expect(moderate.interpretation).toBe('moderately_depressed');

    // Severely depressed infant (Score 1 - asphyxia)
    const severe = calculateApgarScore({
      heartRate: 1,
      respiratoryEffort: 0,
      muscleTone: 0,
      reflexIrritability: 0,
      color: 0,
    });
    expect(severe.total).toBe(1);
    expect(severe.interpretation).toBe('severely_depressed');
  });

  it('calculates Silverman-Anderson Retraction Score (SAS) for respiratory distress', () => {
    // Score 0: None
    const zero = calculateSilvermanScore({
      thoracoabdominalMovement: 0,
      intercostalRetraction: 0,
      xiphoidRetraction: 0,
      naresDilation: 0,
      expiratoryGrunt: 0,
    });
    expect(zero.total).toBe(0);
    expect(zero.severity).toBe('none');

    // Score 2: Mild (lag on inspiration + mild nares flaring)
    const mild = calculateSilvermanScore({
      thoracoabdominalMovement: 1,
      intercostalRetraction: 0,
      xiphoidRetraction: 0,
      naresDilation: 1,
      expiratoryGrunt: 0,
    });
    expect(mild.total).toBe(2);
    expect(mild.severity).toBe('mild');

    // Score 5: Moderate (lag, marked intercostal retraction, mild xiphoid, audible grunt with stethoscope)
    const moderate = calculateSilvermanScore({
      thoracoabdominalMovement: 1,
      intercostalRetraction: 2,
      xiphoidRetraction: 1,
      naresDilation: 0,
      expiratoryGrunt: 1,
    });
    expect(moderate.total).toBe(5);
    expect(moderate.severity).toBe('moderate');

    // Score 8: Severe respiratory distress / impending failure
    const severe = calculateSilvermanScore({
      thoracoabdominalMovement: 2, // see-saw
      intercostalRetraction: 2, // marked
      xiphoidRetraction: 2, // marked
      naresDilation: 1,
      expiratoryGrunt: 1,
    });
    expect(severe.total).toBe(8);
    expect(severe.severity).toBe('severe');
  });

  it('evaluates Newborn Early Warning Score (NEWS / NEWTT) Track-and-Trigger categories', () => {
    // Normal newborn: Green
    const green = calculateNeonatalNews({
      heartRate: 135,
      respiratoryRate: 46,
      temperatureC: 36.8,
      spo2Percent: 97,
      supplementalOxygen: false,
      color: 'pink',
      toneNeurology: 'normal_active',
      gruntingStridor: 'none',
    });
    expect(green.totalScore).toBe(0);
    expect(green.alertSeverity).toBe('green_low');

    // Mild tachypnea (RR 66, score 1) + Acrocyanosis (score 1): Total 2 -> Yellow
    const yellow = calculateNeonatalNews({
      heartRate: 140,
      respiratoryRate: 66,
      temperatureC: 36.6,
      spo2Percent: 96,
      supplementalOxygen: false,
      color: 'acrocyanosis',
      toneNeurology: 'normal_active',
      gruntingStridor: 'none',
    });
    expect(yellow.totalScore).toBe(2);
    expect(yellow.alertSeverity).toBe('yellow_medium');

    // Severe bradycardia (HR 85 bpm -> score 3): Triggers Red Alert even if other vitals normal
    const redBradycardia = calculateNeonatalNews({
      heartRate: 85,
      respiratoryRate: 45,
      temperatureC: 36.6,
      spo2Percent: 96,
      supplementalOxygen: false,
      color: 'pink',
      toneNeurology: 'normal_active',
      gruntingStridor: 'none',
    });
    expect(redBradycardia.hrScore).toBe(3);
    expect(redBradycardia.alertSeverity).toBe('red_high');

    // Supplemental Oxygen: Oxygen score 3 -> Triggers Red Alert
    const redOxygen = calculateNeonatalNews({
      heartRate: 130,
      respiratoryRate: 50,
      temperatureC: 36.7,
      spo2Percent: 94,
      supplementalOxygen: true,
      color: 'pink',
      toneNeurology: 'normal_active',
      gruntingStridor: 'none',
    });
    expect(redOxygen.oxygenScore).toBe(3);
    expect(redOxygen.alertSeverity).toBe('red_high');
  });

  it('evaluates age-specific neonatal blood glucose cutoffs (0-4h vs 4-24h vs >24h)', () => {
    // Age 2 hours (<4h): Cutoff 40 mg/dL, Critical < 25 mg/dL
    const hr2Critical = evaluateNeonatalGlucose(2, 22);
    expect(hr2Critical.status).toBe('critical_hypoglycemia');

    const hr2Hypo = evaluateNeonatalGlucose(2, 34);
    expect(hr2Hypo.status).toBe('hypoglycemia');

    const hr2Normal = evaluateNeonatalGlucose(2, 45);
    expect(hr2Normal.status).toBe('normal');

    // Age 8 hours (4-24h): Cutoff 45 mg/dL
    const hr8Hypo = evaluateNeonatalGlucose(8, 42);
    expect(hr8Hypo.status).toBe('hypoglycemia');

    const hr8Normal = evaluateNeonatalGlucose(8, 55);
    expect(hr8Normal.status).toBe('normal');

    // Age 30 hours (>24h): Cutoff 50 mg/dL
    const hr30Hypo = evaluateNeonatalGlucose(30, 47);
    expect(hr30Hypo.status).toBe('hypoglycemia');

    const hr30Normal = evaluateNeonatalGlucose(30, 62);
    expect(hr30Normal.status).toBe('normal');
  });

  it('evaluates NRP 8th Edition algorithm progression and Golden Minute compliance', () => {
    // Vigorous infant: No PPV needed
    const vigorous = evaluateNrpChecklist({
      apgar1mTotal: 9,
      initialStepsDone: true,
      heartRateUnder100: false,
      apneicOrGasping: false,
      ppvInitiated: false,
      chestNotMovingOrHrUnder100AfterPpv: false,
      hrUnder60AfterEffectivePpv: false,
    });
    expect(vigorous.ppvNeeded).toBe(false);
    expect(vigorous.goldenMinuteAchieved).toBe(true);

    // Apneic infant where PPV started at 45 seconds: Golden minute achieved
    const resus45s = evaluateNrpChecklist({
      apgar1mTotal: 4,
      initialStepsDone: true,
      heartRateUnder100: true,
      apneicOrGasping: true,
      ppvInitiated: true,
      ppvStartSeconds: 45,
      chestNotMovingOrHrUnder100AfterPpv: false,
      hrUnder60AfterEffectivePpv: false,
    });
    expect(resus45s.ppvNeeded).toBe(true);
    expect(resus45s.goldenMinuteAchieved).toBe(true);

    // Severe depression with HR < 60 after PPV: Chest compressions and Epinephrine indicated
    const advanced = evaluateNrpChecklist({
      apgar1mTotal: 2,
      initialStepsDone: true,
      heartRateUnder100: true,
      apneicOrGasping: true,
      ppvInitiated: true,
      ppvStartSeconds: 50,
      chestNotMovingOrHrUnder100AfterPpv: true,
      hrUnder60AfterEffectivePpv: true,
    });
    expect(advanced.chestCompressionsIndicated).toBe(true);
    expect(advanced.epinephrineIndicated).toBe(true);
  });
});

describe('Neonatal Resuscitation & Serial NEW-S REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });
    const setup = await call('POST', '/api/setup', undefined, { username: 'dr.deshmukh', fullName: 'Dr. Anita Deshmukh', password: PW });
    doctor = setup.setCookie!.split(';')[0]!;
    for (const [username, role] of [['nurse_sneha', 'nurse'], ['desk_rohit', 'attender']] as const) {
      await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
      const first = await login(username, 'temporary-pass-1');
      await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
    }
    nurse = await login('nurse_sneha');
    desk = await login('desk_rohit');

    motherId = (await call('POST', '/api/patients', doctor, {
      fullName: 'Pooja Verma',
      dateOfBirth: '1998-05-14',
      phone: '9821098765',
      lastMenstrualPeriod: '2026-02-10',
      gravida: 1,
      para: 0,
      living: 0,
      abortions: 0,
    })).body.patient.id;
  });

  it('creates a neonatal resuscitation record, logs serial NEW-S bedside observation, and retrieves enriched details', async () => {
    // 1. Doctor creates a resuscitation episode for the newborn
    const createRes = await call('POST', `/api/patients/${motherId}/neonatal-resuscitations`, doctor, {
      deliveryTimestamp: '2026-11-06T19:30:00.000Z',
      gestationalAgeWeeks: 38,
      gestationalAgeDays: 4,
      birthWeightGrams: 3150,
      babyGender: 'male',
      deliveryMode: 'vaginal',
      liquorAppearance: 'clear',

      // 1-min APGAR = 8
      apgar1mHeartRate: 2,
      apgar1mRespiratoryEffort: 2,
      apgar1mMuscleTone: 2,
      apgar1mReflexIrritability: 1,
      apgar1mColor: 1,

      // 5-min APGAR = 10
      apgar5mHeartRate: 2,
      apgar5mRespiratoryEffort: 2,
      apgar5mMuscleTone: 2,
      apgar5mReflexIrritability: 2,
      apgar5mColor: 2,

      // Silverman-Anderson = 0
      sasThoracoabdominalMovement: 0,
      sasIntercostalRetraction: 0,
      sasXiphoidRetraction: 0,
      sasNaresDilation: 0,
      sasExpiratoryGrunt: 0,

      // NRP Steps
      initialStepsCompleted: true,
      delayedCordClampingSeconds: 60,
      temperatureControlMethod: 'skin_to_skin',
      initialTemperatureC: 36.9,
      ppvInitiated: false,

      // Glycemia
      atRiskHypoglycemia: false,
      primaryResuscitationOutcome: 'routine_maternal_side',
      pediatricianAttending: 'Dr. Anita Deshmukh',
      resuscitationNurse: 'Nurse Sneha',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.apgar1mTotal).toBe(8);
    expect(createRes.body.apgar5mTotal).toBe(10);
    expect(createRes.body.sasTotalScore).toBe(0);
    expect(createRes.body.sasDistressSeverity).toBe('none');

    const eventId = createRes.body.id;

    // 2. Nurse logs a serial NEW-S observation at 1 hour post-delivery
    const newsRes = await call('POST', `/api/neonatal-resuscitations/${eventId}/news`, nurse, {
      postnatalAgeHours: 1.0,
      heartRateBpm: 138,
      respiratoryRateBpm: 48,
      temperatureC: 36.8,
      spo2Percent: 98,
      supplementalOxygen: false,
      color: 'pink',
      toneNeurology: 'normal_active',
      gruntingStridor: 'none',
      bloodGlucoseMgDl: 52,
      feedingStatus: 'breastfeeding_well',
      clinicalActionTaken: 'First breastfeed completed with good latch. Normal vitals.',
    });

    expect(newsRes.status).toBe(201);
    expect(newsRes.body.totalNewsScore).toBe(0);
    expect(newsRes.body.alertSeverity).toBe('green_low');
    expect(newsRes.body.recordedByName).toBe('nurse_sneha');

    const obsId = newsRes.body.id;

    // 3. Retrieve detailed resuscitation event with its NEW-S observation history
    const getRes = await call('GET', `/api/neonatal-resuscitations/${eventId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(eventId);
    expect(getRes.body.motherName).toBe('Pooja Verma');
    expect(getRes.body.newsObservations).toHaveLength(1);
    expect(getRes.body.newsObservations[0].id).toBe(obsId);

    // 4. Verify audit trail event logged
    const auditEvents = db.prepare('SELECT action FROM audit_events WHERE entity_id = ?').all(String(motherId)) as { action: string }[];
    expect(auditEvents.map(a => a.action)).toContain('neonatal_resuscitation.create');
    expect(auditEvents.map(a => a.action)).toContain('neonatal_news.observation');

    // 5. Delete NEW-S observation and then delete resuscitation event
    const delObs = await call('DELETE', `/api/neonatal-news/${obsId}`, nurse);
    expect(delObs.status).toBe(200);

    const delEvent = await call('DELETE', `/api/neonatal-resuscitations/${eventId}`, doctor);
    expect(delEvent.status).toBe(200);
  });

  it('enforces RBAC: desk attender is blocked from managing neonatal resuscitation and NEW-S records', async () => {
    // Attender tries to create neonatal resuscitation record -> 403 Forbidden
    const createRes = await call('POST', `/api/patients/${motherId}/neonatal-resuscitations`, desk, {
      deliveryTimestamp: '2026-11-06T19:30:00.000Z',
      apgar1mHeartRate: 2,
      apgar1mRespiratoryEffort: 2,
      apgar1mMuscleTone: 2,
      apgar1mReflexIrritability: 2,
      apgar1mColor: 2,
      apgar5mHeartRate: 2,
      apgar5mRespiratoryEffort: 2,
      apgar5mMuscleTone: 2,
      apgar5mReflexIrritability: 2,
      apgar5mColor: 2,
    });
    expect(createRes.status).toBe(403);
  });
});
