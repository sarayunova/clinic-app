import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateCycleDay,
  determineLeadingFollicle,
  calculateFollicleGrowthRate,
  evaluateEndometrialReceptivity,
  evaluateFollicularReadiness,
  interpretSemenAnalysis,
} from '../web/src/folliculometryEngine.js';

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
    fullName: 'Ananya Deshmukh',
    dateOfBirth: '1995-04-12',
    phone: '9822011223',
    lastMenstrualPeriod: '2026-03-01',
    gravida: 0,
    para: 0,
    living: 0,
    abortions: 0,
  })).body.patient.id;
});

describe('Infertility & Folliculometry Engine Calculations', () => {
  it('calculates cycle day relative to LMP accurately', () => {
    const lmp = '2026-03-01';
    expect(calculateCycleDay(lmp, '2026-03-01T09:00:00')).toBe(1);
    expect(calculateCycleDay(lmp, '2026-03-03T10:00:00')).toBe(3);
    expect(calculateCycleDay(lmp, '2026-03-12T14:30:00')).toBe(12);
    expect(calculateCycleDay(lmp, '2026-03-14T11:00:00')).toBe(14);
  });

  it('determines leading follicle and ovary dominance from bilateral arrays', () => {
    // Right ovary dominant
    const r1 = determineLeadingFollicle([18.5, 12, 10], [14, 11]);
    expect(r1.leadingSizeMm).toBe(18.5);
    expect(r1.leadingOvary).toBe('right');
    expect(r1.dominantCountGe16mm).toBe(1);
    expect(r1.dominantCountGe18mm).toBe(1);

    // Left ovary dominant
    const r2 = determineLeadingFollicle([10, 11], [19.0, 14, 11]);
    expect(r2.leadingSizeMm).toBe(19.0);
    expect(r2.leadingOvary).toBe('left');

    // Bilateral equal size
    const r3 = determineLeadingFollicle([16.0], [16.0]);
    expect(r3.leadingSizeMm).toBe(16.0);
    expect(r3.leadingOvary).toBe('bilateral');
    expect(r3.dominantCountGe16mm).toBe(2);

    // Baseline antral follicles only
    const r4 = determineLeadingFollicle([], []);
    expect(r4.leadingSizeMm).toBe(0);
    expect(r4.leadingOvary).toBe('none');
  });

  it('calculates daily follicular growth velocity', () => {
    // 14mm on CD 10 to 18mm on CD 12 -> 4mm over 2 days = 2.0 mm/day
    const velocity = calculateFollicleGrowthRate(
      { cycleDay: 10, sizeMm: 14.0 },
      { cycleDay: 12, sizeMm: 18.0 }
    );
    expect(velocity).toBe(2.0);

    // Same day returns null
    expect(calculateFollicleGrowthRate({ cycleDay: 10, sizeMm: 14 }, { cycleDay: 10, sizeMm: 15 })).toBeNull();
  });

  it('evaluates endometrial receptivity and trilaminar pattern', () => {
    // Optimal: >= 8mm with trilaminar Pattern A
    const optimal = evaluateEndometrialReceptivity(8.5, 'trilaminar_a');
    expect(optimal.status).toBe('optimal');
    expect(optimal.isTrilaminar).toBe(true);

    // Adequate: 7.2mm
    const adequate = evaluateEndometrialReceptivity(7.2, 'isogenous_b');
    expect(adequate.status).toBe('adequate');

    // Suboptimal thin: < 7.0mm
    const thin = evaluateEndometrialReceptivity(5.8, 'isogenous_b');
    expect(thin.status).toBe('thin');
    expect(thin.clinicalComment).toContain('<7 mm');

    // Hyperplastic: > 14mm
    const thick = evaluateEndometrialReceptivity(15.2, 'hyperechoic_c');
    expect(thick.status).toBe('hyperplastic');
  });

  it('evaluates follicular maturity, trigger eligibility, and protects against OHSS / high-order multiples', () => {
    // Early follicular (< 12mm)
    const early = evaluateFollicularReadiness({
      leadingSizeMm: 10.5,
      dominantCountGe16mm: 0,
      protocolType: 'letrozole',
    });
    expect(early.stage).toBe('early_follicular');
    expect(early.triggerEligible).toBe(false);

    // Mid follicular (15mm)
    const mid = evaluateFollicularReadiness({
      leadingSizeMm: 15.0,
      dominantCountGe16mm: 0,
      protocolType: 'letrozole',
    });
    expect(mid.stage).toBe('mid_follicular');
    expect(mid.triggerEligible).toBe(false);

    // Mature ready for trigger (19mm on Letrozole)
    const ready = evaluateFollicularReadiness({
      leadingSizeMm: 19.0,
      etMm: 9.0,
      pattern: 'trilaminar_a',
      dominantCountGe16mm: 1,
      protocolType: 'letrozole',
    });
    expect(ready.stage).toBe('mature_ready_to_trigger');
    expect(ready.triggerEligible).toBe(true);
    expect(ready.ohssRisk).toBe(false);

    // OHSS / High multiple gestation protection: >= 3 dominant follicles >= 16mm
    const ohss = evaluateFollicularReadiness({
      leadingSizeMm: 20.0,
      dominantCountGe16mm: 3,
      protocolType: 'letrozole',
    });
    expect(ohss.stage).toBe('hyperstimulation_risk');
    expect(ohss.triggerEligible).toBe(false);
    expect(ohss.ohssRisk).toBe(true);
    expect(ohss.recommendations.some((r) => r.includes('CANCEL') || r.includes('withhold'))).toBe(true);

    // Ovulation confirmed / corpus luteum
    const ovulated = evaluateFollicularReadiness({
      leadingSizeMm: 0,
      dominantCountGe16mm: 0,
      ruptureObserved: true,
    });
    expect(ovulated.stage).toBe('ovulated_corpus_luteum');
    expect(ovulated.triggerEligible).toBe(false);
  });

  it('interprets semen analysis parameters against WHO 6th edition criteria', () => {
    // Normal semen analysis
    const normal = interpretSemenAnalysis({
      volumeMl: 2.5,
      concentrationMilMl: 45,
      progressiveMotilityPct: 40,
      totalMotilityPct: 58,
      normalMorphologyPct: 6,
    });
    expect(normal.isNormal).toBe(true);
    expect(normal.classification).toBe('Normozoospermia');

    // Oligo-astheno-teratozoospermia (OAT)
    const oat = interpretSemenAnalysis({
      volumeMl: 1.8,
      concentrationMilMl: 10, // < 16 M/mL -> Oligozoospermia
      progressiveMotilityPct: 20, // < 30% -> Asthenozoospermia
      normalMorphologyPct: 2, // < 4% -> Teratozoospermia
    });
    expect(oat.isNormal).toBe(false);
    expect(oat.classification).toContain('Oligozoospermia');
    expect(oat.classification).toContain('Asthenozoospermia');
    expect(oat.classification).toContain('Teratozoospermia');

    // Azoospermia
    const azo = interpretSemenAnalysis({
      volumeMl: 2.0,
      concentrationMilMl: 0,
    });
    expect(azo.classification).toBe('Azoospermia');
  });
});

describe('Infertility & Folliculometry REST API Integration', () => {
  it('saves workup, initiates cycle, logs serial TVS scans, and updates trigger & outcome', async () => {
    // 1. Save Infertility Workup
    const wRes = await call('POST', `/api/patients/${patientId}/infertility-workup`, doctor, {
      infertilityType: 'primary',
      durationYears: 2.5,
      partnerName: 'Vikram Deshmukh',
      partnerAge: 32,
      femaleFactors: ['ovulatory_dysfunction_pcos'],
      baselineAmhNgMl: 5.4,
      baselineAfcTotal: 22,
      hsgFindings: 'Bilateral patent fallopian tubes',
      semenVolumeMl: 3.0,
      semenConcentrationMilMl: 55,
      semenProgressiveMotilityPct: 45,
      semenNormalMorphologyPct: 5,
      clinicalNotes: 'PCOS with anovulatory cycles, normal semen analysis.',
    });
    expect(wRes.status).toBe(200);
    expect(wRes.body.infertilityType).toBe('primary');
    expect(wRes.body.semenAnalysisInterpretation).toBe('Normozoospermia');
    const workupId = wRes.body.id;

    // Fetch workup
    const getW = await call('GET', `/api/patients/${patientId}/infertility-workup`, doctor);
    expect(getW.status).toBe(200);
    expect(getW.body.workup.id).toBe(workupId);

    // 2. Initiate Folliculometry Cycle
    const cRes = await call('POST', `/api/patients/${patientId}/folliculometry-cycles`, doctor, {
      workupId,
      cycleNumber: 1,
      lmpDate: '2026-03-01',
      protocolType: 'letrozole',
      protocolDetails: 'Letrozole 2.5mg OD CD 3 to 7',
      plannedProcedure: 'timed_intercourse',
      lutealSupport: 'Micronized Progesterone 200mg BD x 14 days',
    });
    expect(cRes.status).toBe(201);
    const cycle = cRes.body;
    expect(cycle.status).toBe('active');
    expect(cycle.protocolType).toBe('letrozole');

    // 3. Log Baseline Scan (CD 3)
    const scan1 = await call('POST', `/api/folliculometry-cycles/${cycle.id}/scans`, doctor, {
      scanDatetime: '2026-03-03T09:30:00',
      cycleDay: 3,
      rightOvaryFollicles: [6, 7, 8],
      leftOvaryFollicles: [5, 6, 7],
      endometrialThicknessMm: 3.5,
      endometrialPattern: 'isogenous_b',
    });
    expect(scan1.status).toBe(201);
    expect(scan1.body.cycleDay).toBe(3);
    expect(scan1.body.leadingFollicleSizeMm).toBe(8);
    expect(scan1.body.readinessStage).toBe('early_follicular');

    // 4. Log Mid-follicular Scan (CD 10)
    const scan2 = await call('POST', `/api/folliculometry-cycles/${cycle.id}/scans`, doctor, {
      scanDatetime: '2026-03-10T10:00:00',
      cycleDay: 10,
      rightOvaryFollicles: [14.0, 11.0],
      leftOvaryFollicles: [10.0, 9.0],
      endometrialThicknessMm: 6.8,
      endometrialPattern: 'trilaminar_a',
    });
    expect(scan2.status).toBe(201);
    expect(scan2.body.cycleDay).toBe(10);
    expect(scan2.body.leadingFollicleSizeMm).toBe(14.0);
    expect(scan2.body.growthRateMmDay).toBeGreaterThan(0); // growth from CD 3 to 10
    expect(scan2.body.readinessStage).toBe('mid_follicular');

    // 5. Log Pre-ovulatory Mature Scan (CD 12)
    const scan3 = await call('POST', `/api/folliculometry-cycles/${cycle.id}/scans`, doctor, {
      scanDatetime: '2026-03-12T11:00:00',
      cycleDay: 12,
      rightOvaryFollicles: [18.5, 12.0],
      leftOvaryFollicles: [11.0],
      endometrialThicknessMm: 8.8,
      endometrialPattern: 'trilaminar_a',
    });
    expect(scan3.status).toBe(201);
    expect(scan3.body.leadingFollicleSizeMm).toBe(18.5);
    expect(scan3.body.growthRateMmDay).toBe(2.25); // (18.5 - 14) / 2 days = 2.25 mm/d
    expect(scan3.body.readinessStage).toBe('mature_ready_to_trigger');

    // 6. Record hCG Trigger Administration
    const patchTrigger = await call('PATCH', `/api/folliculometry-cycles/${cycle.id}`, doctor, {
      status: 'triggered',
      triggerDrug: 'rhCG 250 mcg (Ovitrelle) SC stat',
      triggerDatetime: '2026-03-12T20:00:00',
      advisedTicIuiDatetime: '2026-03-14T08:00:00',
    });
    expect(patchTrigger.status).toBe(200);
    expect(patchTrigger.body.status).toBe('triggered');

    // 7. Log Post-ovulation Rupture Scan (CD 14)
    const scan4 = await call('POST', `/api/folliculometry-cycles/${cycle.id}/scans`, doctor, {
      scanDatetime: '2026-03-14T10:00:00',
      cycleDay: 14,
      rightOvaryFollicles: [],
      leftOvaryFollicles: [11.0],
      endometrialThicknessMm: 9.5,
      endometrialPattern: 'hyperechoic_c',
      freeFluidPod: true,
      ovulationRuptureObserved: true,
      clinicalAdvice: 'Dominant follicle collapsed. Corpus luteum seen with POD fluid. Ovulation confirmed.',
    });
    expect(scan4.status).toBe(201);
    expect(scan4.body.ovulationRuptureObserved).toBe(true);
    expect(scan4.body.readinessStage).toBe('ovulated_corpus_luteum');

    // Verify cycle status was automatically progressed to 'ovulated_ruptured'
    const updatedCycle = await call('GET', `/api/folliculometry-cycles/${cycle.id}`, doctor);
    expect(updatedCycle.status).toBe(200);
    expect(updatedCycle.body.status).toBe('ovulated_ruptured');
    expect(updatedCycle.body.scansCount).toBe(4);

    // 8. Record Pregnancy Outcome
    const outcome = await call('PATCH', `/api/folliculometry-cycles/${cycle.id}`, doctor, {
      status: 'completed',
      cycleOutcome: 'clinical_pregnancy',
      outcomeNotes: 'Positive urine pregnancy test. TVS confirmed single intrauterine gestation with fetal cardiac activity at 6 weeks.',
    });
    expect(outcome.status).toBe(200);
    expect(outcome.body.cycleOutcome).toBe('clinical_pregnancy');

    // 9. Enforce RBAC: Attender cannot create/modify folliculometry cycles
    const attenderCreate = await call('POST', `/api/patients/${patientId}/folliculometry-cycles`, desk, {
      lmpDate: '2026-04-01',
      protocolType: 'letrozole',
    });
    expect(attenderCreate.status).toBe(403);
  });
});
