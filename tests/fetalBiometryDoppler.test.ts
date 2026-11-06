import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateCephalicIndex,
  calculateAnatomicalRatios,
  classifyFetalGrowth,
  evaluateFetalDoppler,
  calculateBpp,
  calculateGrowthVelocity,
} from '../web/src/fetalBiometryEngine.js';

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
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  await call('POST', '/api/users', doctor, { username: 'desk1', fullName: 'Desk Staff', role: 'attender', password: 'temporary-pass-1' });
  const first = await login('desk1', 'temporary-pass-1');
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  desk = await login('desk1');

  patientId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Pooja Reddy',
    dateOfBirth: '1998-05-20',
    phone: '9848022338',
    lastMenstrualPeriod: '2026-03-01',
    gravida: 1,
    para: 0,
    living: 0,
    abortions: 0,
  })).body.patient.id;
});

describe('Fetal Biometry & Cranial Shapes Engine', () => {
  it('calculates Cephalic Index and classifies cranial shapes', () => {
    // Normal / Mesocephaly (70 - 86%): BPD 75, OFD 95 -> 78.9%
    const norm = calculateCephalicIndex(75, 95);
    expect(norm).not.toBeNull();
    expect(norm!.shape).toBe('mesocephaly');
    expect(norm!.index).toBe(78.9);

    // Dolichocephaly (< 70%): BPD 65, OFD 100 -> 65.0%
    const doli = calculateCephalicIndex(65, 100);
    expect(doli).not.toBeNull();
    expect(doli!.shape).toBe('dolichocephaly');
    expect(doli!.reliabilityNote).toContain('use HC for dating');

    // Brachycephaly (> 86%): BPD 88, OFD 98 -> 89.8%
    const brachy = calculateCephalicIndex(88, 98);
    expect(brachy).not.toBeNull();
    expect(brachy!.shape).toBe('brachycephaly');
    expect(brachy!.reliabilityNote).toContain('use HC for dating');

    // Zero / invalid
    expect(calculateCephalicIndex(0, 95)).toBeNull();
  });

  it('calculates anatomical ratios and flags asymmetric growth restriction', () => {
    // Normal third trimester ratios (HC 300, AC 290, FL 65 at 34w)
    const norm = calculateAnatomicalRatios(300, 290, 65, 34);
    expect(norm.hcAcRatio).toBe(1.03);
    expect(norm.asymmetryFlag).toBe(false);

    // Elevated HC/AC at 36 weeks (HC 320, AC 280 -> 1.14 > 1.05)
    const asymm = calculateAnatomicalRatios(320, 280, 65, 36);
    expect(asymm.hcAcRatio).toBe(1.14);
    expect(asymm.asymmetryFlag).toBe(true);
    expect(asymm.interpretation).toContain('head-sparing');
  });

  it('classifies fetal growth categories based on Hadlock percentiles', () => {
    // Macrosomia (>= 4000g)
    const macro = classifyFetalGrowth(4150, 38);
    expect(macro.category).toBe('macrosomia');

    // Severe FGR (< 3rd percentile, at 32w p3 is 1500g): 1350g
    const severe = classifyFetalGrowth(1350, 32);
    expect(severe.category).toBe('severe_fgr');

    // Moderate FGR (3rd - 9th percentile, at 32w p10 is 1670g): 1550g
    const mod = classifyFetalGrowth(1550, 32);
    expect(mod.category).toBe('moderate_fgr');

    // AGA (10th - 90th percentile, at 32w 1960g)
    const aga = classifyFetalGrowth(1960, 32);
    expect(aga.category).toBe('aga');

    // LGA (> 90th percentile, at 32w p90 is 2280g): 2450g
    const lga = classifyFetalGrowth(2450, 32);
    expect(lga.category).toBe('lga');
  });
});

describe('Fetal Doppler & Manning BPP Engine', () => {
  it('evaluates Umbilical Artery, MCA, and Cerebroplacental Ratio (CPR)', () => {
    // Normal CPR: MCA-PI 1.60, UA-PI 0.95 -> 1.68 >= 1.08
    const norm = evaluateFetalDoppler({
      uaPi: 0.95,
      mcaPi: 1.60,
      uaEndDiastolicFlow: 'normal_positive',
    });
    expect(norm.cprRatio).toBe(1.68);
    expect(norm.cprAssessment).toBe('normal');

    // Brain-sparing redistribution: MCA-PI 0.90, UA-PI 1.25 -> 0.72 < 1.08
    const brainSparing = evaluateFetalDoppler({
      uaPi: 1.25,
      mcaPi: 0.90,
      uaEndDiastolicFlow: 'normal_positive',
    });
    expect(brainSparing.cprRatio).toBe(0.72);
    expect(brainSparing.cprAssessment).toBe('brain_sparing_redistribution');
    expect(brainSparing.guidance).toContain('brain-sparing');

    // Critical reversed end-diastolic flow (REDF)
    const redf = evaluateFetalDoppler({
      uaPi: 2.1,
      uaEndDiastolicFlow: 'redf_reversed',
    });
    expect(redf.uaStatus).toContain('CRITICAL: Reversed');
    expect(redf.guidance).toContain('EMERGENCY');

    // Absent end-diastolic flow (AEDF)
    const aedf = evaluateFetalDoppler({
      uaPi: 1.8,
      uaEndDiastolicFlow: 'aedf_absent',
    });
    expect(aedf.uaStatus).toContain('HIGH RISK: Absent');
  });

  it('calculates Manning Biophysical Profile (BPP) scores and interpretations', () => {
    // Full 10/10 Reassuring
    const bpp10 = calculateBpp({
      breathing: 2,
      movement: 2,
      tone: 2,
      fluid: 2,
      nstReactive: 2,
    });
    expect(bpp10.totalScore).toBe(10);
    expect(bpp10.maxScore).toBe(10);
    expect(bpp10.interpretation).toBe('reassuring');

    // 8/8 Reassuring (without NST)
    const bpp8 = calculateBpp({
      breathing: 2,
      movement: 2,
      tone: 2,
      fluid: 2,
      nstReactive: null,
    });
    expect(bpp8.totalScore).toBe(8);
    expect(bpp8.maxScore).toBe(8);
    expect(bpp8.interpretation).toBe('reassuring');

    // 6/10 Equivocal
    const bpp6 = calculateBpp({
      breathing: 0,
      movement: 2,
      tone: 2,
      fluid: 2,
      nstReactive: 0,
    });
    expect(bpp6.totalScore).toBe(6);
    expect(bpp6.interpretation).toBe('equivocal');

    // <= 4/10 Abnormal Asphyxia Risk
    const bpp4 = calculateBpp({
      breathing: 0,
      movement: 2,
      tone: 0,
      fluid: 2,
      nstReactive: 0,
    });
    expect(bpp4.totalScore).toBe(4);
    expect(bpp4.interpretation).toBe('abnormal_asphyxia_risk');
  });

  it('calculates serial growth velocity across scan intervals', () => {
    // Scan 1: 2026-09-01, 1500g. Scan 2: 2026-09-15, 1850g (14 days, +350g -> 25.0 g/day, ~175 g/wk)
    const vNormal = calculateGrowthVelocity(
      { date: '2026-09-01', efwGrams: 1500 },
      { date: '2026-09-15', efwGrams: 1850 }
    );
    expect(vNormal).not.toBeNull();
    expect(vNormal!.intervalDays).toBe(14);
    expect(vNormal!.weightDeltaGrams).toBe(350);
    expect(vNormal!.gramsPerDay).toBe(25);
    expect(vNormal!.gramsPerWeek).toBe(175);
    expect(vNormal!.velocityStatus).toBe('normal');

    // Stagnant growth (< 10 g/day): 14 days, +70g -> 5.0 g/day
    const vStagnant = calculateGrowthVelocity(
      { date: '2026-09-01', efwGrams: 1500 },
      { date: '2026-09-15', efwGrams: 1570 }
    );
    expect(vStagnant!.velocityStatus).toBe('stagnant');

    // Negative growth (< 0 g/day)
    const vNeg = calculateGrowthVelocity(
      { date: '2026-09-01', efwGrams: 1500 },
      { date: '2026-09-15', efwGrams: 1450 }
    );
    expect(vNeg!.velocityStatus).toBe('negative');
  });
});

describe('Ultrasound Doppler & Growth REST API', () => {
  it('records, updates, and retrieves comprehensive ultrasound report with biometry, Doppler & BPP', async () => {
    // 1. Create ultrasound report with Doppler & BPP
    const res = await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-09-15',
      scanType: 'growth_wellbeing',
      indication: 'Suspected late-onset FGR, Doppler surveillance',
      gestationalAgeWeeks: 34,
      gestationalAgeDays: 2,
      fetalNumber: 'single',
      cardiacActivity: 'present',
      fhrBpm: 144,
      presentation: 'cephalic',
      placentaLocation: 'posterior',
      placentaGrade: '2',
      amnioticFluidType: 'afi',
      amnioticFluidCm: 11.5,
      amnioticFluidAssessment: 'normal',
      bpdMm: 82.0,
      ofdMm: 104.0,
      cephalicIndex: 78.8,
      cephalicShape: 'mesocephaly',
      hcMm: 295.0,
      acMm: 275.0,
      flMm: 64.0,
      hcAcRatio: 1.07,
      flAcRatio: 23.3,
      efwGrams: 1980,
      efwPercentile: '10th - 50th percentile',
      growthCategory: 'aga',
      uaPi: 1.10,
      uaRi: 0.68,
      uaSdRatio: 3.1,
      uaEndDiastolicFlow: 'normal_positive',
      mcaPi: 1.55,
      mcaRi: 0.72,
      mcaPsvCmS: 52.0,
      cprRatio: 1.41,
      cprAssessment: 'normal',
      utaMeanPi: 0.78,
      utaBilateralNotching: false,
      dvAWave: 'positive',
      bppBreathing: 2,
      bppMovement: 2,
      bppTone: 2,
      bppAmnioticFluid: 2,
      bppNstReactive: 2,
      bppTotalScore: 10,
      bppInterpretation: 'reassuring',
      impression: 'Single live intrauterine gestation at 34w 2d. AGA growth. Normal fetoplacental Doppler and reassuring BPP 10/10.',
    });

    expect(res.status).toBe(201);
    const created = res.body;
    expect(created.id).toBeGreaterThan(0);
    expect(created.bpdMm).toBe(82.0);
    expect(created.ofdMm).toBe(104.0);
    expect(created.cephalicIndex).toBe(78.8);
    expect(created.cephalicShape).toBe('mesocephaly');
    expect(created.hcAcRatio).toBe(1.07);
    expect(created.growthCategory).toBe('aga');
    expect(created.uaPi).toBe(1.10);
    expect(created.mcaPi).toBe(1.55);
    expect(created.cprRatio).toBe(1.41);
    expect(created.cprAssessment).toBe('normal');
    expect(created.bppTotalScore).toBe(10);
    expect(created.bppInterpretation).toBe('reassuring');

    // 2. Fetch single report
    const getRes = await call('GET', `/api/ultrasounds/${created.id}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.cprRatio).toBe(1.41);
    expect(getRes.body.bppInterpretation).toBe('reassuring');

    // 3. Update report with critical Doppler change (brain sparing redistribution)
    const patchRes = await call('PATCH', `/api/ultrasounds/${created.id}`, doctor, {
      uaPi: 1.45,
      mcaPi: 1.20,
      cprRatio: 0.83,
      cprAssessment: 'brain_sparing_redistribution',
      uaEndDiastolicFlow: 'reduced',
      growthCategory: 'moderate_fgr',
      impression: 'Updated: Cerebral redistribution detected (CPR 0.83). Close surveillance recommended.',
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.uaPi).toBe(1.45);
    expect(patchRes.body.mcaPi).toBe(1.20);
    expect(patchRes.body.cprRatio).toBe(0.83);
    expect(patchRes.body.cprAssessment).toBe('brain_sparing_redistribution');
    expect(patchRes.body.uaEndDiastolicFlow).toBe('reduced');
    expect(patchRes.body.growthCategory).toBe('moderate_fgr');
  });

  it('calculates serial growth velocity via the growth-velocity endpoint', async () => {
    // Insert Scan 1 (30 weeks, 1400g)
    await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-08-15',
      scanType: 'growth_wellbeing',
      gestationalAgeWeeks: 30,
      gestationalAgeDays: 0,
      fetalNumber: 'single',
      cardiacActivity: 'present',
      acMm: 250,
      flMm: 58,
      efwGrams: 1400,
      impression: 'Scan 1 at 30 weeks',
    });

    // Insert Scan 2 (33 weeks, 1960g, 21 days later: +560g -> ~26.7 g/day)
    await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-09-05',
      scanType: 'growth_wellbeing',
      gestationalAgeWeeks: 33,
      gestationalAgeDays: 0,
      fetalNumber: 'single',
      cardiacActivity: 'present',
      acMm: 280,
      flMm: 63,
      efwGrams: 1960,
      impression: 'Scan 2 at 33 weeks',
    });

    const vRes = await call('GET', `/api/patients/${patientId}/ultrasounds/growth-velocity`, doctor);
    expect(vRes.status).toBe(200);
    expect(vRes.body.scansCount).toBe(2);
    expect(vRes.body.intervals.length).toBe(1);

    const interval = vRes.body.intervals[0];
    expect(interval.intervalDays).toBe(21);
    expect(interval.weightDeltaGrams).toBe(560);
    expect(interval.gramsPerDay).toBe(26.7);
    expect(interval.gramsPerWeek).toBe(187);
    expect(interval.velocityStatus).toBe('normal');
  });
});
