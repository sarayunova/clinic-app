import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluateCtgParams,
  generateSyntheticCtgTrace,
} from '../web/src/ctgEngine.js';

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
    fullName: 'Anita Sharma',
    dateOfBirth: '1994-03-25',
    phone: '9845011001',
    gravida: 1,
    para: 0,
    living: 0,
    abortions: 0,
    lastMenstrualPeriod: '2026-03-25',
  })).body.patient.id;
});

describe('Cardiotocography (CTG) & Non-Stress Test (NST) Engine', () => {
  it('correctly classifies a normal / Category I reactive CTG trace', () => {
    const res = evaluateCtgParams({
      gestationalAgeWeeks: 34,
      durationMinutes: 20,
      baselineFhrBpm: 140,
      variabilityCategory: 'moderate',
      accelerationsCount: 3,
      accelerationsCriteria: '15x15',
      decelerationsType: 'none',
      decelerationsRecurrent: false,
      uterineContractionsPer10min: 2,
    });

    expect(res.figoClassification).toBe('normal');
    expect(res.nichdCategory).toBe('category_1_normal');
    expect(res.nstClassification).toBe('reactive');
    expect(res.resuscitationRequired).toBe(false);
    expect(res.tachysystolePresent).toBe(false);
  });

  it('correctly classifies a suspicious / Category II trace with minimal variability and tachycardia', () => {
    const res = evaluateCtgParams({
      gestationalAgeWeeks: 38,
      durationMinutes: 30,
      baselineFhrBpm: 168, // Tachycardia
      variabilityCategory: 'minimal',
      accelerationsCount: 0,
      decelerationsType: 'variable_uncomplicated',
      decelerationsRecurrent: true,
      uterineContractionsPer10min: 3,
    });

    expect(res.figoClassification).toBe('suspicious');
    expect(res.nichdCategory).toBe('category_2_indeterminate');
    expect(res.abnormalFeatures.length).toBeGreaterThan(0);
    expect(res.recommendedActions).toEqual(expect.arrayContaining([expect.stringContaining('Continuous electronic fetal monitoring')]));
  });

  it('correctly classifies a pathological / Category III trace with absent variability and recurrent late decelerations', () => {
    const res = evaluateCtgParams({
      gestationalAgeWeeks: 39,
      durationMinutes: 30,
      baselineFhrBpm: 130,
      variabilityCategory: 'absent',
      accelerationsCount: 0,
      decelerationsType: 'late',
      decelerationsRecurrent: true,
      uterineContractionsPer10min: 4,
    });

    expect(res.figoClassification).toBe('pathological');
    expect(res.nichdCategory).toBe('category_3_abnormal');
    expect(res.resuscitationRequired).toBe(true);
    expect(res.recommendedActions).toEqual(expect.arrayContaining([expect.stringContaining('URGENT OBSTETRICIAN REVIEW')]));
  });

  it('detects ominous sinusoidal pattern as pathological Category III', () => {
    const res = evaluateCtgParams({
      gestationalAgeWeeks: 36,
      durationMinutes: 25,
      baselineFhrBpm: 135,
      variabilityCategory: 'sinusoidal',
      accelerationsCount: 0,
      decelerationsType: 'none',
      decelerationsRecurrent: false,
      uterineContractionsPer10min: 1,
    });

    expect(res.figoClassification).toBe('pathological');
    expect(res.nichdCategory).toBe('category_3_abnormal');
    expect(res.resuscitationRequired).toBe(true);
  });

  it('identifies uterine tachysystole (> 5 contractions/10 min) and triggers oxytocin stop advisory', () => {
    const res = evaluateCtgParams({
      gestationalAgeWeeks: 40,
      durationMinutes: 20,
      baselineFhrBpm: 145,
      variabilityCategory: 'moderate',
      accelerationsCount: 1,
      decelerationsType: 'none',
      decelerationsRecurrent: false,
      uterineContractionsPer10min: 6, // Tachysystole!
    });

    expect(res.tachysystolePresent).toBe(true);
    expect(res.resuscitationRequired).toBe(true);
    expect(res.recommendedActions).toEqual(expect.arrayContaining([expect.stringContaining('discontinue or pause Oxytocin')]));
  });

  it('generates high-fidelity continuous synthetic CTG trace points', () => {
    const points = generateSyntheticCtgTrace(140, 'moderate', 20, 2, 'none', 3);
    expect(points.length).toBeGreaterThan(100);
    // All points have realistic FHR bounds (50 - 210 bpm) and Toco bounds (0 - 100 mmHg)
    for (const pt of points) {
      expect(pt.fhrBpm).toBeGreaterThanOrEqual(50);
      expect(pt.fhrBpm).toBeLessThanOrEqual(210);
      expect(pt.tocoMmHg).toBeGreaterThanOrEqual(5);
      expect(pt.tocoMmHg).toBeLessThanOrEqual(100);
    }
  });
});

describe('Cardiotocography REST API Endpoints', () => {
  it('creates a new CTG episode with automated FIGO & NICHD classification and retrieves it', async () => {
    const createRes = await call('POST', `/api/patients/${patientId}/ctg/episodes`, doctor, {
      testType: 'antenatal_nst',
      performedAt: '2026-11-06T11:00:00',
      gestationalAgeWeeks: 34,
      indication: 'Routine antenatal surveillance in 3rd trimester',
      durationMinutes: 20,
      baselineFhrBpm: 142,
      variabilityCategory: 'moderate',
      variabilityAmplitudeBpm: 12,
      accelerationsCount: 2,
      accelerationsCriteria: '15x15',
      decelerationsType: 'none',
      decelerationsRecurrent: false,
      uterineContractionsPer10min: 1,
      fetalMovementFelt: true,
      notes: 'Active fetal movements felt during recording.',
    });

    expect(createRes.status).toBe(200);
    expect(createRes.body.episode.figo_classification).toBe('normal');
    expect(createRes.body.episode.nichd_category).toBe('category_1_normal');
    expect(createRes.body.episode.nst_classification).toBe('reactive');
    expect(createRes.body.episode.fhr_trace_data_json).toBeDefined();

    const episodeId = createRes.body.episode.id;

    // Get single episode
    const getRes = await call('GET', `/api/patients/${patientId}/ctg/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.baseline_fhr_bpm).toBe(142);
    expect(getRes.body.episode.tracePoints.length).toBeGreaterThan(50);

    // List episodes
    const listRes = await call('GET', `/api/patients/${patientId}/ctg/episodes`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);
  });

  it('updates CTG episode review and clinical action plan', async () => {
    const ep = (await call('POST', `/api/patients/${patientId}/ctg/episodes`, doctor, {
      testType: 'intrapartum_continuous',
      performedAt: '2026-11-06T14:00:00',
      baselineFhrBpm: 155,
      variabilityCategory: 'minimal',
      decelerationsType: 'variable_uncomplicated',
      decelerationsRecurrent: true,
      uterineContractionsPer10min: 4,
    })).body.episode;

    const patchRes = await call('PATCH', `/api/patients/${patientId}/ctg/episodes/${ep.id}`, doctor, {
      clinicalActionPlan: 'Turned patient to left lateral position. Normal saline 500ml bolus running.',
      resuscitationMeasures: ['left_lateral_position', 'iv_fluid_bolus', 'oxygen_administered'],
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.clinical_action_plan).toContain('left lateral position');
  });

  it('deletes an erroneous CTG episode', async () => {
    const ep = (await call('POST', `/api/patients/${patientId}/ctg/episodes`, doctor, {
      testType: 'antenatal_nst',
      performedAt: '2026-11-06T15:00:00',
      baselineFhrBpm: 138,
      variabilityCategory: 'moderate',
    })).body.episode;

    const delRes = await call('DELETE', `/api/patients/${patientId}/ctg/episodes/${ep.id}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await call('GET', `/api/patients/${patientId}/ctg/episodes/${ep.id}`, doctor);
    expect(getRes.status).toBe(404);
  });

  it('enforces RBAC: attender desk staff is forbidden from creating CTG records', async () => {
    const res = await call('POST', `/api/patients/${patientId}/ctg/episodes`, desk, {
      testType: 'antenatal_nst',
      performedAt: '2026-11-06T16:00:00',
      baselineFhrBpm: 140,
      variabilityCategory: 'moderate',
    });
    expect(res.status).toBe(403);
  });
});
