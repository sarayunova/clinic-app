import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculatePtsComponentScores,
  evaluatePediatricPolytrauma,
  type PediatricPolytraumaInput,
} from '../web/src/pediatricPolytraumaEngine.js';

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
describe('Pediatric Polytrauma & PTS Calculation Engine (Pure Unit Tests)', () => {
  it('correctly calculates PTS component scores across all ranges (-6 to +12)', () => {
    // Perfect score (+12): >20kg, normal airway, SBP > 90, awake, no fracture, no cutaneous
    const perfectInput: PediatricPolytraumaInput = {
      weightKg: 25,
      airwayStatus: 'normal',
      systolicBp: 110,
      cnsStatus: 'awake',
      skeletalInjury: 'none',
      cutaneousInjury: 'none',
      initialGcs: 15,
    };
    const perfectScores = calculatePtsComponentScores(perfectInput);
    expect(perfectScores.totalPtsScore).toBe(12);

    // Worst possible score (-6): <10kg, intubated, SBP < 50, coma, open/multiple fractures, major tissue loss
    const worstInput: PediatricPolytraumaInput = {
      weightKg: 8,
      airwayStatus: 'unmaintainable_or_intubated',
      systolicBp: 40,
      cnsStatus: 'coma_decerebrate',
      skeletalInjury: 'open_or_multiple_fractures',
      cutaneousInjury: 'tissue_loss_or_penetrating',
      initialGcs: 4,
    };
    const worstScores = calculatePtsComponentScores(worstInput);
    expect(worstScores.totalPtsScore).toBe(-6);

    // Intermediate score: 15kg (+1), maintainable airway (+1), SBP 85 (+1), obtunded (+1), closed fracture (+1), contusion (+1) = +6
    const midInput: PediatricPolytraumaInput = {
      weightKg: 15,
      airwayStatus: 'maintainable',
      systolicBp: 85,
      cnsStatus: 'obtunded_loc',
      skeletalInjury: 'closed_fracture',
      cutaneousInjury: 'contusion_abrasion',
      initialGcs: 12,
    };
    const midScores = calculatePtsComponentScores(midInput);
    expect(midScores.totalPtsScore).toBe(6);
  });

  it('evaluates critical pediatric polytrauma resuscitation, MTP 1:1:1 and TXA protocols', () => {
    // Critical 18 kg child with severe trauma (PTS <= 8)
    const criticalEval = evaluatePediatricPolytrauma({
      weightKg: 18,
      airwayStatus: 'maintainable', // +1
      systolicBp: 75, // +1
      cnsStatus: 'obtunded_loc', // +1
      skeletalInjury: 'open_or_multiple_fractures', // -1
      cutaneousInjury: 'tissue_loss_or_penetrating', // -1
      // Weight 18kg = +1
      // Total PTS = 1 + 1 + 1 + 1 - 1 - 1 = +2 (<= 8 critical)
    });

    expect(criticalEval.totalPtsScore).toBe(2);
    expect(criticalEval.ptsMortalityTier).toBe('critical_high_mortality_le_8');
    expect(criticalEval.traumaCenterLevel1Mandatory).toBe(true);

    // Weight-based dosing:
    // Crystalloid bolus: 20 mL/kg * 18 = 360 mL
    expect(criticalEval.initialCrystalloidBolusMl).toBe(360);
    // MTP bolus: 10 mL/kg * 18 = 180 mL each of PRBC, FFP, Platelets
    expect(criticalEval.pediatricMtpBolusPrbcMl).toBe(180);
    expect(criticalEval.pediatricMtpBolusFfpMl).toBe(180);
    expect(criticalEval.pediatricMtpBolusPlateletsMl).toBe(180);
    // TXA loading dose: 20 mg/kg * 18 = 360 mg (max 1000 mg)
    expect(criticalEval.txaLoadingDoseMg).toBe(360);
    // TXA maintenance: 2 mg/kg/hr * 18 = 36 mg/hr
    expect(criticalEval.txaMaintenanceDoseMgHr).toBe(36);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Polytrauma REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.trauma',
      fullName: 'Dr. V. Rao (Pediatric Trauma Surgeon)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ed',
      fullName: 'Staff Nurse Arjun (Pediatric ED)',
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

    // Pediatric trauma patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Sharma (5y MVC Polytrauma)',
      dateOfBirth: '2021-04-15',
      phone: '+91 98765 22222',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a pediatric polytrauma episode and calculate PTS', async () => {
    // 1. Calculate PTS preview
    const calcRes = await call('POST', '/api/pediatric-polytrauma/calculate-pts', doctor, {
      weightKg: 18.5,
      airwayStatus: 'maintainable',
      systolicBp: 80,
      cnsStatus: 'obtunded_loc',
      skeletalInjury: 'closed_fracture',
      cutaneousInjury: 'contusion_abrasion',
      initialGcs: 11,
    });
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.evalResult).toBeDefined();
    expect(calcRes.body.evalResult.totalPtsScore).toBe(6);

    // 2. Create Episode
    const payload = {
      patientId,
      traumaDatetime: '2026-11-07T09:30:00',
      ageMonths: 66,
      weightKg: 18.5,
      traumaMechanism: 'motor_vehicle_collision',
      airwayStatus: 'maintainable',
      systolicBp: 80,
      cnsStatus: 'obtunded_loc',
      skeletalInjury: 'closed_fracture',
      cutaneousInjury: 'contusion_abrasion',
      fastExamPositive: true,
      pelvicBinderPlaced: false,
      txaAdministered: true,
      txaDoseMg: 370,
      pediatricMtpActivated: true,
      prbcVolumeMl: 200,
      ffpVolumeMl: 200,
      plateletsVolumeMl: 200,
      initialGcs: 11,
      initialSbp: 80,
      initialHeartRate: 155,
      status: 'acute_trauma_bay',
      clinicalNotes: 'MVC pedestrian vs car with closed femur fracture, splenic blush on FAST, resuscitating with TXA and MTP.',
    };

    const res = await call('POST', '/api/pediatric-polytrauma/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toMatch(/^TRAUMA-/);
    expect(res.body.episode.total_pts_score).toBe(6);
    expect(res.body.evalResult).toBeDefined();

    const episodeId = res.body.episode.id;

    // List episodes
    const listRes = await call('GET', `/api/pediatric-polytrauma/episodes?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // Get detail
    const detailRes = await call('GET', `/api/pediatric-polytrauma/episodes/${episodeId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.episode.id).toBe(episodeId);

    // Nurse logs flowsheet log
    const flowRes = await call('POST', `/api/pediatric-polytrauma/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T09:45:00',
      minutesFromArrival: 15,
      gcsTotal: 12,
      sbpMmhg: 92,
      dbpMmhg: 58,
      heartRateBpm: 138,
      respiratoryRate: 28,
      spo2Percent: 99,
      temperatureCelsius: 36.6,
      cumulativeCrystalloidMl: 370,
      cumulativePrbcMl: 200,
      cumulativeFfpMl: 200,
      cumulativePlateletsMl: 0,
      urineOutputMlKgHr: 1.2,
      pupilStatus: 'equal_reactive',
      notes: 'Initial bolus and 1st unit PRBC+FFP running. BP improved to 92/58 mmHg.',
    });
    expect(flowRes.status).toBe(201);
    expect(flowRes.body.logId).toBeDefined();

    // Check detail includes flowsheet logs
    const detailAfterFlow = await call('GET', `/api/pediatric-polytrauma/episodes/${episodeId}`, nurse);
    expect(detailAfterFlow.body.logs.length).toBe(1);
    expect(detailAfterFlow.body.logs[0].sbp_mmhg).toBe(92);

    // Update status to emergent surgery
    const updateRes = await call('PATCH', `/api/pediatric-polytrauma/episodes/${episodeId}`, doctor, {
      status: 'emergent_or_surgery',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('emergent_or_surgery');

    // Attender forbidden
    const attenderCreate = await call('POST', '/api/pediatric-polytrauma/episodes', attender, payload);
    expect(attenderCreate.status).toBe(403);

    // Doctor can delete log and episode
    const deleteLog = await call('DELETE', `/api/pediatric-polytrauma/episodes/${episodeId}/flowsheet-logs/${flowRes.body.logId}`, doctor);
    expect(deleteLog.status).toBe(200);

    const deleteEp = await call('DELETE', `/api/pediatric-polytrauma/episodes/${episodeId}`, doctor);
    expect(deleteEp.status).toBe(200);
  });
});
