import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluateWhoMec,
  calculateIucdLifespanAndExpiry,
  evaluateFollowupFindings,
} from '../web/src/contraceptionEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string;
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
    body: (res.body ? JSON.parse(res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
  const setup = await call('POST', '/api/setup', undefined, {
    username: 'dr.sharma',
    fullName: 'Dr Sharma',
    password: PW,
  });
  doctor = setup.setCookie!.split(';')[0]!;
  await call('POST', '/api/users', doctor, {
    username: 'desk1',
    fullName: 'Desk Staff',
    role: 'attender',
    password: 'temporary-pass-1',
  });
  const first = await login('desk1', 'temporary-pass-1');
  await call('POST', '/api/auth/change-password', first, {
    currentPassword: 'temporary-pass-1',
    newPassword: PW,
  });
  desk = await login('desk1');

  patientId = (
    await call('POST', '/api/patients', doctor, {
      fullName: 'Priyanka Sen',
      dateOfBirth: '1995-03-20',
      phone: '9845033445',
      gravida: 2,
      para: 2,
      living: 2,
      abortions: 0,
      lastMenstrualPeriod: '2026-09-01',
    })
  ).body.patient.id;
});

describe('WHO Medical Eligibility Criteria (MEC) Engine', () => {
  it('correctly classifies eligibility for completely healthy women', () => {
    const res = evaluateWhoMec([]);
    expect(res.coc_pills.category).toBe(1);
    expect(res.copper_t.category).toBe(1);
    expect(res.lng_ius.category).toBe(1);
    expect(res.dmpa_injectable.category).toBe(1);
    expect(res.barrier_condoms.category).toBe(1);
  });

  it('contraindicates COCs for migraine with aura, while keeping Copper IUD & POP eligible', () => {
    const res = evaluateWhoMec(['migraine_with_aura']);
    expect(res.coc_pills.category).toBe(4);
    expect(res.coc_pills.status).toBe('contraindicated');
    expect(res.pop_mini_pill.category).toBe(2);
    expect(res.copper_t.category).toBe(1);
  });

  it('contraindicates COCs for smoking >= 35 yrs, while keeping IUDs first-line', () => {
    const res = evaluateWhoMec(['age_gte_35_smoking_gt_15']);
    expect(res.coc_pills.category).toBe(4);
    expect(res.copper_t.category).toBe(1);
    expect(res.lng_ius.category).toBe(1);
  });

  it('contraindicates IUD insertion during acute PID or purulent cervicitis', () => {
    const res = evaluateWhoMec(['current_pid_or_purulent_cervicitis']);
    expect(res.copper_t.category).toBe(4);
    expect(res.lng_ius.category).toBe(4);
    expect(res.copper_t.status).toBe('contraindicated');
    expect(res.coc_pills.category).toBe(1);
  });

  it('warns against IUD insertion in postpartum 48h to 4 weeks window (MEC 3)', () => {
    const res = evaluateWhoMec(['postpartum_48h_to_4w']);
    expect(res.copper_t.category).toBe(3);
    expect(res.lng_ius.category).toBe(3);
    expect(res.copper_t.status).toBe('cautious');
  });

  it('calculates IUCD lifespan and removal expiry accurately', () => {
    const cu380 = calculateIucdLifespanAndExpiry('cu_t_380a', '2026-11-05');
    expect(cu380.lifespanYears).toBe(10);
    expect(cu380.expectedRemovalDate).toBe('2036-11-05');

    const mirena = calculateIucdLifespanAndExpiry('lng_ius_52mg_mirena', '2026-11-05');
    expect(mirena.lifespanYears).toBe(8);
    expect(mirena.expectedRemovalDate).toBe('2034-11-05');
  });

  it('evaluates follow-up findings and flags missing strings or acute infection', () => {
    const normal = evaluateFollowupFindings({
      threadStatus: 'threads_visible_normal',
      bleedingPattern: 'normal_regular',
      painScore: 1,
      infectionSigns: false,
    });
    expect(normal.alertLevel).toBe('normal');
    expect(normal.needUltrasound).toBe(false);

    const lostString = evaluateFollowupFindings({
      threadStatus: 'threads_not_visible',
      bleedingPattern: 'spotting_intermenstrual',
      painScore: 2,
      infectionSigns: false,
    });
    expect(lostString.alertLevel).toBe('warning');
    expect(lostString.needUltrasound).toBe(true);

    const infection = evaluateFollowupFindings({
      threadStatus: 'threads_visible_normal',
      bleedingPattern: 'normal_regular',
      painScore: 8,
      infectionSigns: true,
    });
    expect(infection.alertLevel).toBe('urgent');
  });
});

describe('Contraceptive Counseling & IUCD REST API Endpoints', () => {
  it('creates and retrieves a contraceptive counseling session with WHO MEC evaluation', async () => {
    const res = await call('POST', `/api/patients/${patientId}/contraception/counselings`, doctor, {
      counselingDate: '2026-11-05',
      reproductivePlan: 'spacing_pregnancies',
      desiredSpacingYears: 3.0,
      breastfeedingStatus: 'exclusive_breastfeeding_lt_6w',
      medicalConditions: ['migraine_with_aura'],
      chosenMethod: 'cu_t_380a',
      methodRationale: 'Client desires 3-year spacing. Non-hormonal Copper IUD chosen due to migraine with aura and breastfeeding.',
      nextFollowupDate: '2026-12-15',
    });

    expect(res.status).toBe(201);
    expect(res.body.eligibilityResults).toBeDefined();
    expect(res.body.eligibilityResults.coc_pills.category).toBe(4); // MEC 4 due to migraine with aura + breastfeeding
    expect(res.body.eligibilityResults.copper_t.category).toBe(1);

    const list = await call('GET', `/api/patients/${patientId}/contraception/counselings`, doctor);
    expect(list.status).toBe(200);
    expect(list.body.records).toHaveLength(1);
    expect(list.body.records[0].chosen_method).toBe('cu_t_380a');
  });

  it('records an IUCD insertion, logs follow-up, and updates removal status', async () => {
    // 1. Insertion
    const insRes = await call('POST', `/api/patients/${patientId}/contraception/iucd-insertions`, doctor, {
      deviceType: 'cu_t_380a',
      deviceBrandName: 'Pregna TCu380A',
      lotBatchNumber: 'LOT-9921',
      deviceExpiryDate: '2031-10-01',
      insertionTiming: 'post_placental_vaginal',
      insertionDate: '2026-11-04',
      insertionTime: '10:45',
      insertedBy: 'Dr Sharma',
      uterineDepthCm: 8.0,
      analgesiaUsed: 'none',
      threadLengthCutCm: 3.5,
      insertionEase: 'smooth',
      complications: 'none',
      postInsertionUltrasound: 'fundal_position_confirmed',
    });

    expect(insRes.status).toBe(201);
    expect(insRes.body.lifespanYears).toBe(10);
    expect(insRes.body.expectedRemovalDate).toBe('2036-11-04');
    const iid = insRes.body.id;

    // 2. Follow-up check
    const fRes = await call(
      'POST',
      `/api/patients/${patientId}/contraception/iucd-insertions/${iid}/followups`,
      doctor,
      {
        followupDate: '2026-12-15',
        visitInterval: '6_weeks_post_insertion',
        threadStatus: 'threads_visible_normal',
        pelvicUltrasoundDone: true,
        ultrasoundFinding: 'normal_fundal',
        bleedingPattern: 'normal_regular',
        pelvicPainScore: 0,
        signsOfInfection: false,
        actionTaken: 'continue_in_situ_reassured',
        clinicalNotes: 'Well positioned PPIUCD, threads curled comfortably in posterior fornix.',
      },
    );

    expect(fRes.status).toBe(201);
    expect(fRes.body.evaluation.alertLevel).toBe('normal');

    // 3. Detail fetch
    const detail = await call('GET', `/api/patients/${patientId}/contraception/iucd-insertions/${iid}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.insertion.followups).toHaveLength(1);

    // 4. Print audit
    const printRes = await call(
      'POST',
      `/api/patients/${patientId}/contraception/iucd-insertions/${iid}/print`,
      doctor,
    );
    expect(printRes.status).toBe(200);
  });

  it('enforces RBAC: desk attender is blocked from creating counseling or insertion records', async () => {
    const postRes = await call('POST', `/api/patients/${patientId}/contraception/counselings`, desk, {
      counselingDate: '2026-11-05',
      reproductivePlan: 'spacing_pregnancies',
      chosenMethod: 'condoms',
    });
    expect(postRes.status).toBe(403);

    const getRes = await call('GET', `/api/patients/${patientId}/contraception/iucd-insertions`, desk);
    expect(getRes.status).toBe(403);
  });
});
