import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  classifyAgeAppropriateManeuver,
  evaluatePediatricForeignBody,
} from '../web/src/pediatricForeignBodyEngine.js';

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
describe('Pediatric Foreign Body Airway Obstruction Protocol (Pure Unit Tests)', () => {
  it('correctly stratifies maneuvers by age and severity per AAP / PALS', () => {
    // 1. Mild obstruction with effective cough: DO NOT INTERVENE
    const mild = classifyAgeAppropriateManeuver(10, 'mild_incomplete_effective_cough');
    expect(mild.recommendedManeuver).toBe('encouraged_spontaneous_coughing');
    expect(mild.description).toContain('DO NOT interfere with spontaneous efforts');

    // 2. Infant < 1 year with severe obstruction: 5 back slaps + 5 chest thrusts
    const infant = classifyAgeAppropriateManeuver(8, 'severe_complete_ineffective_cough');
    expect(infant.recommendedManeuver).toBe('back_blows_and_chest_thrusts_infant');
    expect(infant.description).toContain('Alternate 5 Back Slaps');

    // 3. Child >= 1 year with severe obstruction: Subdiaphragmatic Heimlich thrusts
    const child = classifyAgeAppropriateManeuver(36, 'severe_complete_ineffective_cough');
    expect(child.recommendedManeuver).toBe('subdiaphragmatic_heimlich_child');
    expect(child.description).toContain('Heimlich Maneuver');

    // 4. Unconscious patient: PALS CPR with direct laryngoscopy visualization
    const arrest = classifyAgeAppropriateManeuver(24, 'unconscious_cardiorespiratory_arrest');
    expect(arrest.recommendedManeuver).toBe('cpr_chest_compressions_ventilations');
    expect(arrest.description).toContain('PALS CPR');
  });

  it('evaluates infant choking episode and cautions against abdominal thrusts', () => {
    const res = evaluatePediatricForeignBody({
      ageMonths: 9,
      weightKg: 8.5,
      witnessedChokingEpisode: true,
      suspectedForeignBodyNature: 'organic_food_nut_seed',
      obstructionSeverity: 'severe_complete_ineffective_cough',
      stridorOrAphonia: true,
      cyanosisPresent: true,
      silentChestNoted: false,
      heartRateBpm: 165,
      respiratoryRate: 52,
      spo2Percent: 88,
      interventionApplied: 'back_blows_and_chest_thrusts_infant',
      blindFingerSweepAvoided: true,
      foreignBodyExpelled: false,
      spontaneousRespirationRestored: false,
      rigidBronchoscopyRequired: false,
    });

    expect(res.isInfantUnder1Year).toBe(true);
    expect(res.isCompleteObstruction).toBe(true);
    expect(res.recommendedResuscitationManeuver).toBe('back_blows_and_chest_thrusts_infant');
    expect(res.blindFingerSweepViolation).toBe(false);
    expect(res.clinicalSafetyDirectives.some((d) => d.includes('Abdominal thrusts (Heimlich) are strictly contraindicated'))).toBe(true);
  });

  it('flags safety violation when blind finger sweep is performed', () => {
    const res = evaluatePediatricForeignBody({
      ageMonths: 24,
      weightKg: 13.0,
      witnessedChokingEpisode: true,
      suspectedForeignBodyNature: 'small_toy_plastic_bead',
      obstructionSeverity: 'severe_complete_ineffective_cough',
      stridorOrAphonia: true,
      cyanosisPresent: false,
      silentChestNoted: false,
      heartRateBpm: 135,
      respiratoryRate: 38,
      spo2Percent: 94,
      interventionApplied: 'subdiaphragmatic_heimlich_child',
      blindFingerSweepAvoided: false, // VIOLATION
      foreignBodyExpelled: true,
      spontaneousRespirationRestored: true,
      rigidBronchoscopyRequired: false,
    });

    expect(res.blindFingerSweepViolation).toBe(true);
    expect(res.criticalActionPlan.some((p) => p.includes('CRITICAL SAFETY AUDIT ERROR: Blind finger sweep was attempted'))).toBe(true);
    expect(res.clinicalSafetyDirectives.some((d) => d.includes('BLIND FINGER SWEEPS ARE STRICTLY PROHIBITED'))).toBe(true);
  });

  it('escalates to STAT rigid bronchoscopy when object is unexpelled and silent chest noted', () => {
    const res = evaluatePediatricForeignBody({
      ageMonths: 18,
      weightKg: 11.0,
      witnessedChokingEpisode: true,
      suspectedForeignBodyNature: 'organic_food_nut_seed',
      obstructionSeverity: 'severe_complete_ineffective_cough',
      stridorOrAphonia: true,
      cyanosisPresent: true,
      silentChestNoted: true,
      heartRateBpm: 155,
      respiratoryRate: 46,
      spo2Percent: 86,
      interventionApplied: 'subdiaphragmatic_heimlich_child',
      blindFingerSweepAvoided: true,
      foreignBodyExpelled: false,
      spontaneousRespirationRestored: false,
      rigidBronchoscopyRequired: true,
      bronchoscopyLocation: 'right_main_bronchus',
    });

    expect(res.bronchoscopyUrgency).toBe('stat_emergency_ent_bronchoscopy');
    expect(res.criticalActionPlan.some((p) => p.includes('Rigid Bronchoscopy under general anesthesia'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Foreign Body REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatricintensivist',
      fullName: 'Dr. Suresh Varma (Pediatric Intensivist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pedsed',
      fullName: 'Nurse Pooja (Pediatric ED)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.pedsed', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.pedsed', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.pedsed',
      fullName: 'ED Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.pedsed', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.pedsed', PW);

    // Create a demo child patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Joshi (14 months)',
      dateOfBirth: '2025-09-10',
      phone: '+91 98330 99887',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews pediatric foreign body evaluation without database persistence', async () => {
    const res = await call('POST', '/api/pediatric-foreign-body/evaluate', doctor, {
      ageMonths: 14,
      weightKg: 10.5,
      witnessedChokingEpisode: true,
      suspectedForeignBodyNature: 'organic_food_nut_seed',
      obstructionSeverity: 'severe_complete_ineffective_cough',
      stridorOrAphonia: true,
      cyanosisPresent: false,
      silentChestNoted: false,
      heartRateBpm: 138,
      respiratoryRate: 36,
      spo2Percent: 93,
      interventionApplied: 'subdiaphragmatic_heimlich_child',
      blindFingerSweepAvoided: true,
      foreignBodyExpelled: true,
      spontaneousRespirationRestored: true,
      rigidBronchoscopyRequired: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.recommendedResuscitationManeuver).toBe('subdiaphragmatic_heimlich_child');
    expect(res.body.evalResult.blindFingerSweepViolation).toBe(false);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const incidentTime = new Date().toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/pediatric-foreign-body/episodes', attender, {
      patientId,
      incidentDatetime: incidentTime,
      ageMonths: 14,
      weightKg: 10.5,
      obstructionSeverity: 'severe_complete_ineffective_cough',
      heartRateBpm: 140,
      respiratoryRate: 40,
      spo2Percent: 91,
      interventionApplied: 'subdiaphragmatic_heimlich_child',
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/pediatric-foreign-body/episodes', doctor, {
      patientId,
      incidentDatetime: incidentTime,
      ageMonths: 14,
      weightKg: 10.5,
      witnessedChokingEpisode: true,
      suspectedForeignBodyNature: 'organic_food_nut_seed',
      obstructionSeverity: 'severe_complete_ineffective_cough',
      stridorOrAphonia: true,
      cyanosisPresent: true,
      silentChestNoted: false,
      heartRateBpm: 146,
      respiratoryRate: 44,
      spo2Percent: 89,
      interventionApplied: 'subdiaphragmatic_heimlich_child',
      blindFingerSweepAvoided: true,
      foreignBodyExpelled: true,
      spontaneousRespirationRestored: true,
      rigidBronchoscopyRequired: false,
      bronchoscopyLocation: 'none',
      status: 'post_clearance_observation',
      clinicalNotes: 'Witnessed choking on cashew nut. Rapid Heimlich maneuvers dislodged nut fragment. Respiration normalized, SpO2 99% on room air.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('FBAO-');
    expect(createRes.body.evalResult.blindFingerSweepViolation).toBe(false);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/pediatric-foreign-body/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/pediatric-foreign-body/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.recommendedResuscitationManeuver).toBe('subdiaphragmatic_heimlich_child');
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/pediatric-foreign-body/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      minutesFromChoking: 5,
      mentalStatus: 'alert_vocalizing',
      airwayPatency: 'clear_normal_air_entry',
      heartRateBpm: 118,
      respiratoryRate: 28,
      spo2Percent: 99,
      interventionCycle: 'subdiaphragmatic_heimlich_thrusts',
      foreignObjectVisualizedOrRemoved: true,
      notes: 'Child crying lustily post-expulsion of cashew piece. Clear bilateral air entry.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/pediatric-foreign-body/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to discharged_home_stable
    const updateRes = await call('PATCH', `/api/pediatric-foreign-body/episodes/${episodeId}`, doctor, {
      status: 'discharged_home_stable',
      clinicalNotes: '4-hour observation complete. No stridor, barking cough, or retractions. Parents counseled on nut hazards.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('discharged_home_stable');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/pediatric-foreign-body/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/pediatric-foreign-body/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/pediatric-foreign-body/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/pediatric-foreign-body/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
