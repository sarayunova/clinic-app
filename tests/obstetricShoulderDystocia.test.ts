import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  evaluateHeadToBodyInterval,
  evaluateShoulderDystocia,
} from '../web/src/obstetricShoulderDystociaEngine.js';

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
describe('Obstetric Shoulder Dystocia & HELPERR Protocol (Pure Unit Tests)', () => {
  it('stratifies head-to-body intervals accurately across tiers', () => {
    // Under 60s
    const normal = evaluateHeadToBodyInterval(45);
    expect(normal.tier).toBe('normal_interval');
    expect(normal.risk).toBe('low');

    // 60 - 179s
    const moderate = evaluateHeadToBodyInterval(120);
    expect(moderate.tier).toBe('mild_dystocia_1_to_3min');
    expect(moderate.risk).toBe('moderate');

    // 180 - 300s
    const severe = evaluateHeadToBodyInterval(240);
    expect(severe.tier).toBe('severe_dystocia_3_to_5min');
    expect(severe.risk).toBe('high');

    // > 300s
    const critical = evaluateHeadToBodyInterval(360);
    expect(critical.tier).toBe('critical_anoxia_gt_5min');
    expect(critical.risk).toBe('critical_extreme');
  });

  it('evaluates shoulder dystocia resolved by McRoberts maneuver', () => {
    const res = evaluateShoulderDystocia({
      gestationalAgeWeeks: 39.5,
      actualBirthWeightGrams: 3850,
      gestationalDiabetes: true,
      operativeVaginalDelivery: 'spontaneous_vaginal',
      turtleSignObserved: true,
      headToBodyIntervalSeconds: 90,
      helpCalled: true,
      episiotomyPerformed: false,
      mcrobertsManeuverSuccess: true,
      suprapubicPressureSuccess: false,
      internalRotationalManeuver: 'none',
      internalRotationalSuccess: false,
      posteriorArmDeliverySuccess: false,
      gaskinAllFoursSuccess: false,
      advancedManeuversRequired: 'none',
      fundalPressureAvoided: true,
    });

    expect(res.dystociaConfirmed).toBe(true);
    expect(res.successfulManeuver).toBe('McRoberts Maneuver');
    expect(res.macrosomiaPresent).toBe(false);
    expect(res.fundalPressureViolation).toBe(false);
    expect(res.intervalSeverityTier).toBe('mild_dystocia_1_to_3min');
  });

  it('identifies macrosomia and resolves by posterior arm delivery', () => {
    const res = evaluateShoulderDystocia({
      gestationalAgeWeeks: 40.2,
      actualBirthWeightGrams: 4400,
      gestationalDiabetes: true,
      operativeVaginalDelivery: 'vacuum_assisted',
      turtleSignObserved: true,
      headToBodyIntervalSeconds: 210,
      helpCalled: true,
      episiotomyPerformed: true,
      mcrobertsManeuverSuccess: false,
      suprapubicPressureSuccess: false,
      internalRotationalManeuver: 'rubin_ii',
      internalRotationalSuccess: false,
      posteriorArmDeliverySuccess: true,
      gaskinAllFoursSuccess: false,
      advancedManeuversRequired: 'none',
      fundalPressureAvoided: true,
    });

    expect(res.macrosomiaPresent).toBe(true);
    expect(res.successfulManeuver).toBe('Delivery of Posterior Arm');
    expect(res.hypoxiaRiskLevel).toBe('high');
    expect(res.intervalSeverityTier).toBe('severe_dystocia_3_to_5min');
  });

  it('flags safety violation when fundal pressure is used', () => {
    const res = evaluateShoulderDystocia({
      gestationalAgeWeeks: 39.0,
      actualBirthWeightGrams: 3700,
      gestationalDiabetes: false,
      operativeVaginalDelivery: 'spontaneous_vaginal',
      turtleSignObserved: true,
      headToBodyIntervalSeconds: 150,
      helpCalled: true,
      episiotomyPerformed: false,
      mcrobertsManeuverSuccess: true,
      suprapubicPressureSuccess: false,
      internalRotationalManeuver: 'none',
      internalRotationalSuccess: false,
      posteriorArmDeliverySuccess: false,
      gaskinAllFoursSuccess: false,
      advancedManeuversRequired: 'none',
      fundalPressureAvoided: false, // VIOLATION
    });

    expect(res.fundalPressureViolation).toBe(true);
    expect(res.criticalActionPlan.some((p) => p.includes('CRITICAL AUDIT DEFICIENCY: Fundal pressure was NOT avoided'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric Shoulder Dystocia REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. Anita Roy (Obstetrician)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.labor',
      fullName: 'Nurse Sunita (Labor Room)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.labor', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.labor', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.labor',
      fullName: 'Labor Room Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.labor', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.labor', PW);

    // Create a demo mother patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Mrs. Priya Deshmukh (G2P1)',
      dateOfBirth: '1996-04-18',
      phone: '+91 98220 11223',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews shoulder dystocia evaluation without database persistence', async () => {
    const res = await call('POST', '/api/obstetric-shoulder-dystocia/evaluate', doctor, {
      gestationalAgeWeeks: 40.0,
      actualBirthWeightGrams: 4200,
      gestationalDiabetes: true,
      operativeVaginalDelivery: 'spontaneous_vaginal',
      turtleSignObserved: true,
      headToBodyIntervalSeconds: 140,
      helpCalled: true,
      episiotomyPerformed: false,
      mcrobertsManeuverSuccess: true,
      suprapubicPressureSuccess: true,
      internalRotationalManeuver: 'none',
      internalRotationalSuccess: false,
      posteriorArmDeliverySuccess: false,
      gaskinAllFoursSuccess: false,
      advancedManeuversRequired: 'none',
      fundalPressureAvoided: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.dystociaConfirmed).toBe(true);
    expect(res.body.evalResult.macrosomiaPresent).toBe(true);
    expect(res.body.evalResult.successfulManeuver).toBe('McRoberts Maneuver');
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const headTime = new Date('2026-11-08T08:00:00Z').toISOString();
    const bodyTime = new Date('2026-11-08T08:02:45Z').toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/obstetric-shoulder-dystocia/episodes', attender, {
      patientId,
      deliveryDatetime: headTime,
      gestationalAgeWeeks: 39.5,
      actualBirthWeightGrams: 3900,
      gestationalDiabetes: false,
      turtleSignObserved: true,
      headDeliveryDatetime: headTime,
      bodyDeliveryDatetime: bodyTime,
      headToBodyIntervalSeconds: 165,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/obstetric-shoulder-dystocia/episodes', doctor, {
      patientId,
      deliveryDatetime: headTime,
      maternalAge: 30,
      gestationalAgeWeeks: 40.1,
      estimatedFetalWeightGrams: 4100,
      actualBirthWeightGrams: 4180,
      gestationalDiabetes: true,
      operativeVaginalDelivery: 'spontaneous_vaginal',
      turtleSignObserved: true,
      headDeliveryDatetime: headTime,
      bodyDeliveryDatetime: bodyTime,
      headToBodyIntervalSeconds: 165,
      helpCalled: true,
      episiotomyPerformed: true,
      mcrobertsManeuverSuccess: false,
      suprapubicPressureSuccess: false,
      internalRotationalManeuver: 'rubin_ii',
      internalRotationalSuccess: false,
      posteriorArmDeliverySuccess: true,
      gaskinAllFoursSuccess: false,
      advancedManeuversRequired: 'none',
      fundalPressureAvoided: true,
      apgar1min: 6,
      apgar5min: 9,
      apgar10min: 10,
      umbilicalArterialPh: 7.21,
      neonatalInjury: 'none',
      postpartumHemorrhageObserved: false,
      perinealTearDegree: 'second_degree',
      status: 'postpartum_hie_monitoring',
      clinicalNotes: 'Shoulder dystocia with turtle sign. Resolved with delivery of posterior arm. Fundal pressure strictly avoided.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('DYSTOCIA-');
    expect(createRes.body.evalResult.successfulManeuver).toBe('Delivery of Posterior Arm');
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/obstetric-shoulder-dystocia/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.macrosomiaPresent).toBe(true);
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      secondsFromHeadDelivery: 60,
      maneuverAttempted: 'mcroberts_hyperflexion',
      maneuverOutcome: 'failed_advance_to_next_step',
      tractionApplied: 'gentle_axial_traction_only',
      notes: 'Hips hyperflexed to abdomen. Anterior shoulder remained impacted.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to discharged_stable
    const updateRes = await call('PATCH', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}`, doctor, {
      status: 'discharged_stable',
      clinicalNotes: 'Baby examined by neonatologist; bilateral arm movements symmetrical, no clavicular fracture. Mother stable.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('discharged_stable');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/obstetric-shoulder-dystocia/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
