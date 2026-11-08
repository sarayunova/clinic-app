import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateWestleyScore,
  calculateDexamethasoneDose,
  calculateNebulizedEpinephrineDose,
  evaluatePediatricCroup,
} from '../web/src/pediatricCroupEngine.js';

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
describe('Pediatric Croup & Westley Score Protocol (Pure Unit Tests)', () => {
  it('correctly calculates Westley score and classifies mild croup (score <= 2)', () => {
    // Stridor with agitation (1), mild retractions (1), normal air entry (0), no cyanosis (0), alert (0) = 2
    const score = calculateWestleyScore(1, 1, 0, 0, 0);

    expect(score.totalScore).toBe(2);
    expect(score.severityTier).toBe('mild_croup_score_le_2');
    expect(score.severityLabel).toContain('Mild Croup');
  });

  it('correctly calculates Westley score and classifies moderate croup (3 - 5)', () => {
    // Stridor at rest (2), moderate retractions (2), normal air entry (0), no cyanosis (0), alert (0) = 4
    const score = calculateWestleyScore(2, 2, 0, 0, 0);

    expect(score.totalScore).toBe(4);
    expect(score.severityTier).toBe('moderate_croup_score_3_to_5');
  });

  it('correctly calculates severe croup (6 - 11) and impending respiratory failure (>= 12)', () => {
    // Stridor at rest (2), severe retractions (3), decreased air entry (1), cyanosis with agitation (4), alert (0) = 10
    const severe = calculateWestleyScore(2, 3, 1, 4, 0);
    expect(severe.totalScore).toBe(10);
    expect(severe.severityTier).toBe('severe_croup_score_6_to_11');

    // Lethargy (5) + cyanosis at rest (5) + severe retractions (3) = 13
    const failure = calculateWestleyScore(0, 3, 0, 5, 5);
    expect(failure.totalScore).toBe(13);
    expect(failure.severityTier).toBe('impending_respiratory_failure_ge_12');
  });

  it('calculates single-dose Dexamethasone and caps at 16 mg', () => {
    // 10 kg infant with mild croup: 10 * 0.15 = 1.5 mg
    const mild = calculateDexamethasoneDose(10, 'mild_croup_score_le_2');
    expect(mild.doseMg).toBe(1.5);
    expect(mild.route).toBe('oral');

    // 15 kg child with moderate/severe croup: 15 * 0.6 = 9.0 mg
    const mod = calculateDexamethasoneDose(15, 'moderate_croup_score_3_to_5');
    expect(mod.doseMg).toBe(9.0);

    // 35 kg child with severe croup: 35 * 0.6 = 21 mg -> capped at 16.0 mg
    const heavy = calculateDexamethasoneDose(35, 'severe_croup_score_6_to_11');
    expect(heavy.doseMg).toBe(16.0);
  });

  it('calculates Nebulized Epinephrine dose 1:1000 and caps at 5 mL', () => {
    // 6 kg infant: 6 * 0.5 = 3.0 mL
    const infDose = calculateNebulizedEpinephrineDose(6);
    expect(infDose).toBe(3.0);

    // 14 kg child: 14 * 0.5 = 7.0 mL -> capped at 5.0 mL
    const bigDose = calculateNebulizedEpinephrineDose(14);
    expect(bigDose).toBe(5.0);
  });

  it('full evaluation requires 2-4 hours rebound observation when nebulized epinephrine is indicated', () => {
    const res = evaluatePediatricCroup({
      ageMonths: 18,
      weightKg: 11.5,
      inspiratoryStridorScore: 2, // at rest
      retractionsScore: 2, // moderate
      airEntryScore: 1, // decreased
      cyanosisScore: 0,
      consciousnessScore: 0,
      heartRateBpm: 140,
      respiratoryRate: 42,
      spo2Percent: 96,
      barkingCoughPresent: true,
      hoarsenessPresent: true,
    });

    expect(res.westley.totalScore).toBe(5);
    expect(res.westley.severityTier).toBe('moderate_croup_score_3_to_5');
    expect(res.nebulizedEpinephrineIndicated).toBe(true);
    expect(res.epinephrineNebulizationDoseMl).toBe(5.0);
    expect(res.reboundObservationHoursRequired).toBe(4);
    expect(res.criticalActionPlan.some((a) => a.includes('surveillance') || a.includes('Observe'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Croup REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatriced',
      fullName: 'Dr. Tarun Saxena (Pediatric ED)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.triage',
      fullName: 'Nurse Neha (Triage)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.triage', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.triage', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.croup',
      fullName: 'ED Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.croup', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.croup', PW);

    // Create a demo child patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Shah (Croup)',
      dateOfBirth: '2025-02-15',
      phone: '+91 98450 12345',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('evaluates croup score preview without database persistence', async () => {
    const res = await call('POST', '/api/pediatric-croup/evaluate', doctor, {
      ageMonths: 20,
      weightKg: 12.0,
      inspiratoryStridorScore: 1,
      retractionsScore: 1,
      airEntryScore: 0,
      cyanosisScore: 0,
      consciousnessScore: 0,
      heartRateBpm: 125,
      respiratoryRate: 32,
      spo2Percent: 98,
      barkingCoughPresent: true,
      hoarsenessPresent: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.westley.totalScore).toBe(2);
    expect(res.body.evalResult.nebulizedEpinephrineIndicated).toBe(false);
    expect(res.body.evalResult.dexamethasoneDoseMg).toBe(1.8);
  });

  it('creates, retrieves, logs flowsheet, updates, and deletes croup episode with strict RBAC', async () => {
    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/pediatric-croup/episodes', attender, {
      patientId,
      triageDatetime: new Date().toISOString(),
      ageMonths: 24,
      weightKg: 13.0,
      inspiratoryStridorScore: 2,
      retractionsScore: 2,
      airEntryScore: 1,
      cyanosisScore: 0,
      consciousnessScore: 0,
      heartRateBpm: 148,
      respiratoryRate: 46,
      spo2Percent: 94,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/pediatric-croup/episodes', doctor, {
      patientId,
      triageDatetime: new Date().toISOString(),
      ageMonths: 24,
      weightKg: 13.0,
      inspiratoryStridorScore: 2,
      retractionsScore: 2,
      airEntryScore: 1,
      cyanosisScore: 0,
      consciousnessScore: 0,
      heartRateBpm: 148,
      respiratoryRate: 46,
      spo2Percent: 94,
      barkingCoughPresent: true,
      hoarsenessPresent: true,
      dexamethasoneRoute: 'oral',
      dexamethasoneAdministered: true,
      epinephrineNebulizationAdministered: true,
      status: 'post_nebulization_observation',
      clinicalNotes: 'Nebulized with 5 mL L-Epi + Oral Dexamethasone given. Observing for rebound.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('CROUP-');
    expect(createRes.body.episode.nebulized_epinephrine_indicated).toBe(1);

    // 3. Nurse lists episodes (200)
    const listRes = await call('GET', `/api/pediatric-croup/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Nurse logs serial observation flowsheet (201)
    const logRes = await call('POST', `/api/pediatric-croup/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      minutesFromTriage: 60,
      westleyScoreCurrent: 2,
      heartRateBpm: 122,
      respiratoryRate: 30,
      spo2Percent: 98,
      stridorAtRest: false,
      chestRetractionsSeverity: 'mild_subcostal',
      interventionGiven: 'none_observation',
      notes: 'Marked clinical improvement post-nebulization; no resting stridor',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 5. Get episode by ID
    const getRes = await call('GET', `/api/pediatric-croup/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.logs.length).toBe(1);

    // 6. Doctor updates episode status
    const updateRes = await call('PATCH', `/api/pediatric-croup/episodes/${episodeId}`, doctor, {
      status: 'discharged_home_stable',
      clinicalNotes: '4 hours observation complete without stridor rebound. Safe for home care.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('discharged_home_stable');

    // 7. Nurse cannot delete episode (403)
    const nurseDel = await call('DELETE', `/api/pediatric-croup/episodes/${episodeId}`, nurse);
    expect(nurseDel.status).toBe(403);

    // 8. Delete flowsheet log
    const delLog = await call('DELETE', `/api/pediatric-croup/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLog.status).toBe(200);

    // 9. Doctor deletes episode
    const delRes = await call('DELETE', `/api/pediatric-croup/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
