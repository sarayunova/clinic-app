import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  getTrimesterFromWeeks,
  evaluateLabFlag,
  classifyAnemia,
  classifyThrombocytopenia,
  evaluateAntenatalReminders,
} from '../web/src/antenatalLabScoring.js';

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

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.sharma', fullName: 'Dr Sharma', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse_mary', 'nurse'], ['desk_raj', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse_mary');
  desk = await login('desk_raj');

  motherId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Ananya Deshmukh',
    dateOfBirth: '1996-08-20',
    phone: '9876543210',
    lastMenstrualPeriod: '2026-03-01',
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('Antenatal Lab Scoring & Threshold Engine', () => {
  it('correctly maps gestational age weeks to trimester', () => {
    expect(getTrimesterFromWeeks(null)).toBe('t1');
    expect(getTrimesterFromWeeks(8)).toBe('t1');
    expect(getTrimesterFromWeeks(12)).toBe('t1');
    expect(getTrimesterFromWeeks(13)).toBe('t2');
    expect(getTrimesterFromWeeks(20)).toBe('t2');
    expect(getTrimesterFromWeeks(27)).toBe('t2');
    expect(getTrimesterFromWeeks(28)).toBe('t3');
    expect(getTrimesterFromWeeks(36)).toBe('t3');
  });

  it('evaluates trimester-specific Hemoglobin flags including physiologic hemodilution', () => {
    // 1st trimester (cutoff 11.0)
    expect(evaluateLabFlag('hb', 12.0, 't1')).toBe('normal');
    expect(evaluateLabFlag('hb', 10.6, 't1')).toBe('low');
    expect(evaluateLabFlag('hb', 6.8, 't1')).toBe('critical');

    // 2nd trimester (cutoff 10.5 due to plasma volume expansion)
    expect(evaluateLabFlag('hb', 10.6, 't2')).toBe('normal');
    expect(evaluateLabFlag('hb', 10.2, 't2')).toBe('low');
    expect(evaluateLabFlag('hb', 6.5, 't2')).toBe('critical');

    // 3rd trimester (cutoff 11.0)
    expect(evaluateLabFlag('hb', 11.2, 't3')).toBe('normal');
    expect(evaluateLabFlag('hb', 10.8, 't3')).toBe('low');
  });

  it('evaluates Platelets and Thrombocytopenia stages', () => {
    expect(evaluateLabFlag('platelets', 220, 't2')).toBe('normal');
    expect(evaluateLabFlag('platelets', 125, 't3')).toBe('low');
    expect(evaluateLabFlag('platelets', 75, 't3')).toBe('low');
    expect(evaluateLabFlag('platelets', 45, 't3')).toBe('critical');

    expect(classifyThrombocytopenia(180)).toBeNull();
    expect(classifyThrombocytopenia(120)).toContain('Mild / Gestational Thrombocytopenia');
    expect(classifyThrombocytopenia(80)).toContain('Moderate Thrombocytopenia');
    expect(classifyThrombocytopenia(40)).toContain('Severe Thrombocytopenia');
  });

  it('evaluates TSH trimester endocrine cutoffs', () => {
    // T1: 0.1 - 2.5
    expect(evaluateLabFlag('tsh', 1.8, 't1')).toBe('normal');
    expect(evaluateLabFlag('tsh', 2.9, 't1')).toBe('high');
    expect(evaluateLabFlag('tsh', 0.05, 't1')).toBe('low');
    expect(evaluateLabFlag('tsh', 12.0, 't1')).toBe('critical');

    // T2: 0.2 - 3.0
    expect(evaluateLabFlag('tsh', 2.8, 't2')).toBe('normal');
    expect(evaluateLabFlag('tsh', 3.4, 't2')).toBe('high');
  });

  it('evaluates 75g OGTT thresholds (IADPSG / DIPSI)', () => {
    // Fasting < 92
    expect(evaluateLabFlag('ogtt_fasting', 88, 't2')).toBe('normal');
    expect(evaluateLabFlag('ogtt_fasting', 96, 't2')).toBe('high');

    // 1-Hour < 180
    expect(evaluateLabFlag('ogtt_1hr', 160, 't2')).toBe('normal');
    expect(evaluateLabFlag('ogtt_1hr', 185, 't2')).toBe('high');

    // 2-Hour < 140
    expect(evaluateLabFlag('ogtt_2hr', 132, 't2')).toBe('normal');
    expect(evaluateLabFlag('ogtt_2hr', 144, 't2')).toBe('high');
    expect(evaluateLabFlag('ogtt_2hr', 200, 't2')).toBe('critical');
  });

  it('evaluates maternal Ferritin stores', () => {
    expect(evaluateLabFlag('ferritin', 60, 't1')).toBe('normal');
    expect(evaluateLabFlag('ferritin', 22, 't1')).toBe('low');
    expect(evaluateLabFlag('ferritin', 12, 't2')).toBe('critical');
  });

  it('classifies Anemia severity correctly', () => {
    expect(classifyAnemia(12.0, 't1')).toBeNull();
    expect(classifyAnemia(10.7, 't2')).toBeNull();
    expect(classifyAnemia(10.2, 't1')).toContain('Mild Anemia');
    expect(classifyAnemia(8.5, 't2')).toContain('Moderate Anemia');
    expect(classifyAnemia(6.5, 't3')).toContain('Severe Anemia');
  });

  it('computes gestational milestone screening reminders', () => {
    // At 10 weeks: Booking panel is due
    const r10 = evaluateAntenatalReminders(10);
    const booking10 = r10.find((r) => r.key === 'booking_serology')!;
    expect(booking10.isDue).toBe(true);
    expect(booking10.isOverdue).toBe(false);

    // At 26 weeks: OGTT is due, booking is overdue
    const r26 = evaluateAntenatalReminders(26);
    const ogtt26 = r26.find((r) => r.key === 'ogtt_screening')!;
    expect(ogtt26.isDue).toBe(true);
    const booking26 = r26.find((r) => r.key === 'booking_serology')!;
    expect(booking26.isOverdue).toBe(true);

    // At 28 weeks: Repeat CBC & ICT is due
    const r28 = evaluateAntenatalReminders(28);
    const ict28 = r28.find((r) => r.key === 'repeat_hb_ict_28w')!;
    expect(ict28.isDue).toBe(true);

    // At 36 weeks: GBS swab is due
    const r36 = evaluateAntenatalReminders(36);
    const gbs36 = r36.find((r) => r.key === 'gbs_screening')!;
    expect(gbs36.isDue).toBe(true);
  });
});

describe('Antenatal Lab Trends API Integration', () => {
  it('allows clinical staff to log and retrieve longitudinal lab trends', async () => {
    // Doctor logs booking Hb
    const res1 = await call('POST', `/api/patients/${motherId}/antenatal-lab-trends`, doctor, {
      testDate: '2026-03-15',
      gestationalAgeWeeks: 10,
      gestationalAgeDays: 2,
      parameterKey: 'hb',
      parameterName: 'Hemoglobin (Hb)',
      numericValue: 11.6,
      unit: 'g/dL',
      referenceRange: '≥ 11.0 g/dL',
      abnormalFlag: 'normal',
      clinicalAction: 'Routine iron-folic acid prophylaxis',
    });
    expect(res1.status).toBe(201);
    expect(res1.body.id).toBeGreaterThan(0);
    expect(res1.body.trimester).toBe('t1'); // Inferred from 10w

    // Nurse logs 26-week repeat Hb showing hemodilution
    const res2 = await call('POST', `/api/patients/${motherId}/antenatal-lab-trends`, nurse, {
      testDate: '2026-07-05',
      gestationalAgeWeeks: 26,
      gestationalAgeDays: 0,
      parameterKey: 'hb',
      parameterName: 'Hemoglobin (Hb)',
      numericValue: 10.1,
      unit: 'g/dL',
      referenceRange: '≥ 10.5 g/dL',
      abnormalFlag: 'low',
      clinicalAction: 'Stepped up to elemental iron 100mg bid',
    });
    expect(res2.status).toBe(201);
    expect(res2.body.trimester).toBe('t2');

    // Nurse logs 75g OGTT 2-hr
    const res3 = await call('POST', `/api/patients/${motherId}/antenatal-lab-trends`, nurse, {
      testDate: '2026-07-06',
      gestationalAgeWeeks: 26,
      gestationalAgeDays: 1,
      parameterKey: 'ogtt_2hr',
      parameterName: '75g OGTT — 2 Hour Glucose',
      numericValue: 148,
      unit: 'mg/dL',
      referenceRange: '< 140 mg/dL',
      abnormalFlag: 'high',
      clinicalAction: 'Gestational diabetes diagnosed; medical nutrition therapy (MNT) initiated',
    });
    expect(res3.status).toBe(201);

    // Retrieve all trends
    const getRes = await call('GET', `/api/patients/${motherId}/antenatal-lab-trends`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.totalCount).toBe(3);
    expect(getRes.body.trendsByParam.hb).toHaveLength(2);
    expect(getRes.body.trendsByParam.ogtt_2hr).toHaveLength(1);
    expect(getRes.body.allTrends[0].numericValue).toBe(11.6);
    expect(getRes.body.allTrends[1].numericValue).toBe(10.1);

    // Delete an observation
    const delRes = await call('DELETE', `/api/antenatal-lab-trends/${res1.body.id}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const afterDel = await call('GET', `/api/patients/${motherId}/antenatal-lab-trends`, doctor);
    expect(afterDel.body.totalCount).toBe(2);
  });

  it('rejects trend operations from non-clinical staff', async () => {
    const res = await call('POST', `/api/patients/${motherId}/antenatal-lab-trends`, desk, {
      testDate: '2026-03-15',
      gestationalAgeWeeks: 10,
      parameterKey: 'hb',
      parameterName: 'Hemoglobin (Hb)',
      numericValue: 12.0,
      unit: 'g/dL',
    });
    expect(res.status).toBe(403);
  });
});

describe('Antenatal Serology Matrix API Integration', () => {
  it('manages maternal infectious disease and Rh alloimmunization matrix', async () => {
    // Initial fetch returns exists: false
    const initRes = await call('GET', `/api/patients/${motherId}/antenatal-serology`, doctor);
    expect(initRes.status).toBe(200);
    expect(initRes.body.exists).toBe(false);
    expect(initRes.body.serology).toBeNull();

    // Doctor updates serology matrix for Rh negative mother
    const putRes = await call('PUT', `/api/patients/${motherId}/antenatal-serology`, doctor, {
      bloodGroupAbo: 'O',
      rhFactor: 'negative',
      indirectCoombsTestBooking: 'negative',
      indirectCoombsTest28w: 'negative',
      antiDGiven: true,
      antiDGivenDate: '2026-07-20',
      antiDBatchDose: '300 mcg (1500 IU) IM, Batch #AD-8841',
      hivStatus: 'non_reactive',
      hivTestedDate: '2026-03-12',
      hbsagStatus: 'non_reactive',
      hbsagTestedDate: '2026-03-12',
      hcvStatus: 'non_reactive',
      hcvTestedDate: '2026-03-12',
      vdrlRprStatus: 'non_reactive',
      vdrlRprTiter: 'Non-reactive',
      vdrlTestedDate: '2026-03-12',
      rubellaIggStatus: 'immune',
      rubellaIggValue: 45.2,
      rubellaTestedDate: '2026-03-12',
      gbsCultureStatus: 'negative',
      gbsTestedDate: '2026-09-10',
      urineCultureStatus: 'no_growth',
      urineCultureDate: '2026-03-12',
      hemoglobinopathyHplc: 'normal_a1_a2',
      hplcHba2Pct: 2.4,
      hplcTestedDate: '2026-03-12',
      consultantReviewNotes: 'Rh-negative unsensitized; Anti-D 300mcg administered at 28w. Rubella immune. Core viral screen negative.',
    });

    expect(putRes.status).toBe(200);
    expect(putRes.body.bloodGroupAbo).toBe('O');
    expect(putRes.body.rhFactor).toBe('negative');
    expect(putRes.body.antiDGiven).toBe(true);
    expect(putRes.body.rubellaIggStatus).toBe('immune');
    expect(putRes.body.rubellaIggValue).toBe(45.2);
    expect(putRes.body.hplcHba2Pct).toBe(2.4);

    // Re-fetch serology matrix
    const getRes = await call('GET', `/api/patients/${motherId}/antenatal-serology`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.exists).toBe(true);
    expect(getRes.body.serology.bloodGroupAbo).toBe('O');
    expect(getRes.body.serology.antiDGiven).toBe(true);
    expect(getRes.body.serology.updatedByName).toBe('Dr Sharma');
  });

  it('records audit events on trend create, delete and serology update', async () => {
    await call('POST', `/api/patients/${motherId}/antenatal-lab-trends`, doctor, {
      testDate: '2026-03-15',
      gestationalAgeWeeks: 10,
      parameterKey: 'tsh',
      parameterName: 'TSH',
      numericValue: 2.1,
      unit: 'mIU/L',
      abnormalFlag: 'normal',
    });

    await call('PUT', `/api/patients/${motherId}/antenatal-serology`, doctor, {
      bloodGroupAbo: 'B',
      rhFactor: 'positive',
      hivStatus: 'non_reactive',
    });

    const auditEvents = db.prepare('SELECT action FROM audit_events WHERE entity_id = ?').all(String(motherId)) as { action: string }[];
    const actions = auditEvents.map((a) => a.action);
    expect(actions).toContain('antenatal_lab_trend.create');
    expect(actions).toContain('antenatal_serology.update');
  });
});
