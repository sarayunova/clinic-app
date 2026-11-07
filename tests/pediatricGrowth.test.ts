import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluatePediatricGrowth,
  detectDevelopmentalRedFlags,
  interpolateWhoRef,
  calculateZScore,
  WHO_WEIGHT_BOYS,
} from '../web/src/pediatricGrowthEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string;
let childId: number;

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

  childId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Master Aarav',
    dateOfBirth: '2025-11-01', // 12 months old
    phone: '9845022334',
    gravida: 0,
    para: 0,
    living: 0,
    abortions: 0,
  })).body.patient.id;
});

describe('Pediatric WHO Growth Standards & Milestones Engine', () => {
  it('interpolates WHO reference points correctly', () => {
    // 0 month exact
    const ref0 = interpolateWhoRef(WHO_WEIGHT_BOYS, 0);
    expect(ref0.median).toBe(3.3);

    // 1.5 months interpolated
    const ref1_5 = interpolateWhoRef(WHO_WEIGHT_BOYS, 1.5);
    expect(ref1_5.median).toBeGreaterThan(4.5);
    expect(ref1_5.median).toBeLessThan(5.6);
  });

  it('calculates Z-scores and classifies growth status appropriately', () => {
    // 12-month-old boy: normal weight (9.6 kg is median)
    const norm = evaluatePediatricGrowth(12, 'male', 9.6, 75.7, 46.1);
    expect(norm.weightZ).toBeCloseTo(0, 0.1);
    expect(norm.weightStatus).toBe('normal');
    expect(norm.heightStatus).toBe('normal');
    expect(norm.hcStatus).toBe('normal');

    // 12-month-old boy: underweight (7.2 kg < -2 SD)
    const under = evaluatePediatricGrowth(12, 'male', 7.2, 75.7, 46.1);
    expect(under.weightZ).toBeLessThan(-2);
    expect(under.weightStatus).toBe('underweight');

    // Severe stunting (68 cm < -3 SD)
    const stunt = evaluatePediatricGrowth(12, 'male', 9.0, 68.0, 46.1);
    expect(stunt.heightZ).toBeLessThan(-3);
    expect(stunt.heightStatus).toBe('severe_stunting');

    // Microcephaly (42 cm < -3 SD)
    const micro = evaluatePediatricGrowth(12, 'male', 9.6, 75.7, 42.0);
    expect(micro.hcZ).toBeLessThan(-3);
    expect(micro.hcStatus).toBe('severe_microcephaly');
  });

  it('detects developmental red flags when child age exceeds upper milestone threshold without achievement', () => {
    // Child is 12 months old
    const evaluations = [
      { milestone_key: 'neck_holding_3m', status: 'achieved' },
      { milestone_key: 'social_smile_2m', status: 'achieved' },
      { milestone_key: 'sits_without_support_6m', status: 'delayed' }, // upper limit 9m -> Red flag!
    ];

    const result = detectDevelopmentalRedFlags(12, evaluations);
    expect(result.delayCount).toBeGreaterThan(0);
    expect(result.redFlags.some((f) => f.includes('Sits Without Support'))).toBe(true);
  });
});

describe('Pediatric Growth & Milestones API Integration', () => {
  it('logs a new growth measurement and retrieves calculated Z-scores', async () => {
    const postRes = await call('POST', `/api/patients/${childId}/pediatric/growth`, doctor, {
      recordedDate: '2026-11-01',
      ageMonths: 12,
      sex: 'male',
      weightKg: 9.8,
      heightLengthCm: 76.0,
      headCircumferenceCm: 46.2,
      clinicalNotes: '1-year routine well-baby checkup. Growth thriving on family diet.',
    });

    expect(postRes.status).toBe(200);
    expect(postRes.body.record.weight_for_age_status).toBe('normal');
    expect(postRes.body.evaluation.weightZ).toBeDefined();

    const getRes = await call('GET', `/api/patients/${childId}/pediatric/growth`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.records.length).toBe(1);
    expect(getRes.body.records[0].weight_kg).toBe(9.8);
  });

  it('deletes an erroneous growth measurement', async () => {
    const postRes = await call('POST', `/api/patients/${childId}/pediatric/growth`, doctor, {
      recordedDate: '2026-11-02',
      ageMonths: 12.1,
      sex: 'male',
      weightKg: 9.8,
    });
    const growthId = postRes.body.record.id;

    const delRes = await call('DELETE', `/api/patients/${childId}/pediatric/growth/${growthId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await call('GET', `/api/patients/${childId}/pediatric/growth`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.records.length).toBe(0);
  });

  it('retrieves merged standard developmental milestones and updates achievement status', async () => {
    // 1. Fetch milestone list
    const getRes = await call('GET', `/api/patients/${childId}/pediatric/milestones`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.milestones.length).toBeGreaterThan(15);
    expect(getRes.body.currentAgeMonths).toBeDefined();

    // 2. Update a milestone
    const updateRes = await call('POST', `/api/patients/${childId}/pediatric/milestones`, doctor, {
      milestoneKey: 'pincer_grasp_9m',
      status: 'achieved',
      achievedDate: '2026-08-15',
      ageAchievedMonths: 9.5,
      notes: 'Picks up cheerios cleanly with index finger and thumb.',
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('achieved');

    // 3. Verify in list
    const getAgain = await call('GET', `/api/patients/${childId}/pediatric/milestones`, doctor);
    const pincer = getAgain.body.milestones.find((m: any) => m.key === 'pincer_grasp_9m');
    expect(pincer.status).toBe('achieved');
    expect(pincer.achievedDate).toBe('2026-08-15');
  });

  it('enforces RBAC: desk attender staff is blocked from writing growth records', async () => {
    const res = await call('POST', `/api/patients/${childId}/pediatric/growth`, desk, {
      recordedDate: '2026-11-01',
      ageMonths: 12,
      sex: 'male',
      weightKg: 9.5,
    });
    expect(res.status).toBe(403);
  });
});
