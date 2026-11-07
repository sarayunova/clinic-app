import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateBedsideSchwartzEgfr,
  calculateFluidOverload,
  calculateUrinaryIndices,
  determineKdigoAkiStage,
  calculatePdCycleBalance,
  evaluatePeritonitisRisk,
  evaluateNephrotoxicMedications,
} from '../web/src/pediatricRenalEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
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
    headers: res.headers,
    body: (res.body ? (res.headers['content-type']?.includes('application/json') ? JSON.parse(res.body) : res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

// -------------------------------------------------------------
// Pure Calculation Clinical Engine Tests (Run instantly in-memory)
// -------------------------------------------------------------
describe('Pediatric & Neonatal Renal Engine (Pure Unit Tests)', () => {
  it('calculates Bedside Schwartz eGFR with age and gestation-specific k-factors', () => {
    // 1. Preterm infant (k = 0.33)
    const preterm = calculateBedsideSchwartzEgfr({
      heightCm: 45,
      scrMgDl: 0.8,
      patientCategory: 'preterm_infant',
    });
    // eGFR = (0.33 * 45) / 0.8 = 18.56 -> 18.6
    expect(preterm.kFactor).toBe(0.33);
    expect(preterm.egfr).toBe(18.6);
    expect(preterm.ckdStageDescription).toContain('Severe reduction');

    // 2. Full-term infant (k = 0.45)
    const term = calculateBedsideSchwartzEgfr({
      heightCm: 50,
      scrMgDl: 0.5,
      patientCategory: 'term_infant',
    });
    // eGFR = (0.45 * 50) / 0.5 = 45.0
    expect(term.kFactor).toBe(0.45);
    expect(term.egfr).toBe(45.0);

    // 3. Child 1-16 years (k = 0.413)
    const child = calculateBedsideSchwartzEgfr({
      heightCm: 100,
      scrMgDl: 0.6,
      patientCategory: 'child',
    });
    // eGFR = (0.413 * 100) / 0.6 = 68.8
    expect(child.kFactor).toBe(0.413);
    expect(child.egfr).toBe(68.8);
  });

  it('evaluates Fluid Overload Percentage (%FO) and identifies critical RRT threshold', () => {
    // Normal / mild (< 5%)
    const normal = calculateFluidOverload({ dryWeightKg: 3.0, currentWeightKg: 3.1 });
    expect(normal.fluidOverloadPct).toBe(3.3);
    expect(normal.severity).toBe('normal');
    expect(normal.rrtIndicationSuggested).toBe(false);

    // Moderate warning (10 - 19.9%)
    const moderate = calculateFluidOverload({ dryWeightKg: 3.0, currentWeightKg: 3.4 });
    expect(moderate.fluidOverloadPct).toBe(13.3);
    expect(moderate.severity).toBe('moderate_warning');
    expect(moderate.rrtIndicationSuggested).toBe(false);

    // Critical severe (>= 20%) -> RRT Indication
    const severe = calculateFluidOverload({ dryWeightKg: 3.0, currentWeightKg: 3.7 });
    expect(severe.fluidOverloadPct).toBe(23.3);
    expect(severe.severity).toBe('severe_critical');
    expect(severe.rrtIndicationSuggested).toBe(true);
  });

  it('computes neonatal and pediatric urinary indices (FENa & FEUrea)', () => {
    // Neonate with prerenal dehydration (FENa < 2.5%)
    const prerenal = calculateUrinaryIndices({
      serumNaMeqL: 140,
      urineNaMeqL: 15,
      serumCrMgDl: 1.0,
      urineCrMgDl: 50,
      isNeonate: true,
    });
    // FENa = (15 * 1.0) / (140 * 50) * 100 = 0.21%
    expect(prerenal.fenaPct).toBe(0.2);
    expect(prerenal.etiology).toBe('prerenal');

    // Neonate with intrinsic ATN (FENa >= 2.5%)
    const atn = calculateUrinaryIndices({
      serumNaMeqL: 135,
      urineNaMeqL: 60,
      serumCrMgDl: 1.5,
      urineCrMgDl: 20,
      isNeonate: true,
    });
    // FENa = (60 * 1.5) / (135 * 20) * 100 = 3.33%
    expect(atn.fenaPct).toBe(3.3);
    expect(atn.etiology).toBe('intrinsic_atn');
  });

  it('determines modified neonatal & pediatric KDIGO AKI staging (AWAKEN criteria)', () => {
    // Stage 1: SCr delta >= 0.3
    const stage1 = determineKdigoAkiStage({
      baselineScr: 0.4,
      currentScr: 0.7,
      isNeonate: true,
    });
    expect(stage1.overallStage).toBe(1);

    // Stage 2: SCr 2.0x baseline
    const stage2 = determineKdigoAkiStage({
      baselineScr: 0.4,
      currentScr: 0.9,
      isNeonate: true,
    });
    expect(stage2.overallStage).toBe(2);

    // Stage 3: SCr >= 2.5 mg/dL in neonate or 3x baseline
    const stage3 = determineKdigoAkiStage({
      baselineScr: 0.5,
      currentScr: 2.6,
      isNeonate: true,
    });
    expect(stage3.overallStage).toBe(3);
    expect(stage3.clinicalActions[0]).toContain('RENAL REPLACEMENT THERAPY');
  });

  it('calculates peritoneal dialysis cycle balance and surveillance peritonitis risk', () => {
    // Cycle balance: Inflow 50 mL, Outflow 65 mL (+15 mL net)
    const cycles = [
      { inflowMl: 50, outflowMl: 65 },
      { inflowMl: 50, outflowMl: 70 },
      { inflowMl: 50, outflowMl: 60 },
    ];
    const balance = calculatePdCycleBalance(cycles);
    expect(balance.totalInflowMl).toBe(150);
    expect(balance.totalOutflowMl).toBe(195);
    expect(balance.netUfMl).toBe(45);
    expect(balance.averageNetUfPerCycleMl).toBe(15);
    expect(balance.fluidRetentionAlert).toBe(false);

    // Peritonitis risk: Cloudy + WBC > 100 and PMN > 50%
    const peritonitis = evaluatePeritonitisRisk({
      appearance: 'cloudy_turbid',
      wbcCountPerMcl: 350,
      neutrophilsPercent: 78,
    });
    expect(peritonitis.isPeritonitisSuspected).toBe(true);
    expect(peritonitis.isPeritonitisConfirmed).toBe(true);
    expect(peritonitis.severity).toBe('critical');

    // Nephrotoxic guidance
    const alerts = evaluateNephrotoxicMedications(['Amikacin', 'Vancomycin'], 3, 14);
    expect(alerts.length).toBe(2);
    expect(alerts[0]?.drug).toBe('Amikacin');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Renal & Peritoneal Dialysis REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedrenal',
      fullName: 'Dr. Neha Rao (Pediatric Nephrologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pedrenal',
      fullName: 'Sister Rekha SNCU',
      role: 'nurse',
      password: 'temp-pass-nurse-pr',
    });
    const nurseFirst = await login('nurse.pedrenal', 'temp-pass-nurse-pr');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-pr',
      newPassword: PW,
    });
    nurse = await login('nurse.pedrenal');

    // Desk setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.pedrenal',
      fullName: 'Desk Attender PR',
      role: 'attender',
      password: 'temp-pass-desk-pr',
    });
    const deskFirst = await login('desk.pedrenal', 'temp-pass-desk-pr');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-pr',
      newPassword: PW,
    });
    desk = await login('desk.pedrenal');

    // Create a pediatric patient
    const pat = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Priya',
      dateOfBirth: '2026-11-01',
      estimatedAgeYears: 0,
      phone: '9876543210',
      address: 'Ward Bed SNCU-04',
      gravida: 0,
      para: 0,
    });
    expect(pat.status).toBe(201);
    patientId = pat.body.patient.id;
  });

  it('creates renal assessment, computes KDIGO/Schwartz, and enforces RBAC', async () => {
    // 1. Desk clerk cannot create clinical renal assessment
    const deskRes = await call('POST', '/api/pediatric-renal/assessments', desk, {
      patientId,
      assessmentDatetime: '2026-11-06T10:00:00',
      patientCategory: 'term_infant',
      heightCm: 50,
      dryWeightKg: 3.2,
      currentWeightKg: 3.6,
      baselineCreatinineMgDl: 0.45,
      currentCreatinineMgDl: 1.5,
      urineOutputMl: 15,
      urineOutputHours: 12,
      nephrotoxicMedications: ['Amikacin'],
    });
    expect(deskRes.status).toBe(403);

    // 2. Doctor creates assessment
    const docRes = await call('POST', '/api/pediatric-renal/assessments', doctor, {
      patientId,
      assessmentDatetime: '2026-11-06T10:00:00',
      patientCategory: 'term_infant',
      heightCm: 50,
      dryWeightKg: 3.2,
      currentWeightKg: 3.6,
      baselineCreatinineMgDl: 0.45,
      currentCreatinineMgDl: 1.5,
      urineOutputMl: 15,
      urineOutputHours: 12,
      serumSodiumMeqL: 138,
      urineSodiumMeqL: 50,
      serumBunMgDl: 30,
      urineUreaMgDl: 300,
      urineCreatinineMgDl: 35,
      nephrotoxicMedications: ['Amikacin'],
      clinicalActionPlan: 'Initiate acute renal protocol',
    });
    expect(docRes.status).toBe(201);
    const body = docRes.body;
    expect(body.assessment.kdigo_overall_stage).toBe(3); // 1.5 / 0.45 = 3.33x baseline -> Stage 3
    expect(body.assessment.calculated_fluid_overload_pct).toBe(12.5); // (3.6-3.2)/3.2 = 12.5%
    expect(body.assessment.calculated_egfr).toBe(15); // (0.45 * 50) / 1.5 = 15.0

    // 3. Retrieve assessment list
    const listRes = await call('GET', `/api/pediatric-renal/assessments?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.assessments.length).toBe(1);
  });

  it('manages acute Peritoneal Dialysis session: creation, cycle flowsheet logs, effluent surveillance and completion', async () => {
    // 1. Doctor initiates Acute PD session
    const sessRes = await call('POST', '/api/pediatric-renal/pd-sessions', doctor, {
      patientId,
      startDatetime: '2026-11-06T11:00:00',
      indication: 'kdigo_stage_3_aki',
      catheterType: 'flexible_curved_cook',
      patientWeightKg: 3.5,
      solutionType: 'dextrose_1_5',
      fillVolumeMlPerKg: 15,
      targetCyclesCount: 12,
      heparinUnitsPerLiter: 500,
    });
    expect(sessRes.status).toBe(201);
    const session = sessRes.body.session;
    expect(session.session_number).toContain('PD-');
    expect(session.calculated_fill_volume_ml).toBe(53); // 15 * 3.5 = 52.5 -> 53 mL

    // 2. Nurse logs Cycle #1
    const cycle1Res = await call('POST', `/api/pediatric-renal/pd-sessions/${session.id}/cycles`, nurse, {
      cycleNumber: 1,
      cycleStartTime: '2026-11-06T11:15:00',
      inflowMl: 53,
      dwellDurationMinutes: 45,
      outflowMl: 65,
      effluentAppearance: 'clear_straw',
      catheterSiteLeakage: false,
      patientTolerance: 'well_tolerated',
    });
    expect(cycle1Res.status).toBe(201);
    const cycle1 = cycle1Res.body.cycle;
    expect(cycle1.net_uf_ml).toBe(12); // 65 - 53
    expect(cycle1.cumulative_uf_ml).toBe(12);

    // 3. Nurse logs Cycle #2
    const cycle2Res = await call('POST', `/api/pediatric-renal/pd-sessions/${session.id}/cycles`, nurse, {
      cycleNumber: 2,
      cycleStartTime: '2026-11-06T12:30:00',
      inflowMl: 53,
      dwellDurationMinutes: 45,
      outflowMl: 70,
      effluentAppearance: 'clear_straw',
      catheterSiteLeakage: false,
      patientTolerance: 'well_tolerated',
    });
    expect(cycle2Res.status).toBe(201);
    const cycle2 = cycle2Res.body.cycle;
    expect(cycle2.net_uf_ml).toBe(17);
    expect(cycle2.cumulative_uf_ml).toBe(29); // 12 + 17 = 29

    // 4. Log effluent surveillance lab (WBC > 100 & PMN > 50 -> Peritonitis)
    const effRes = await call('POST', `/api/pediatric-renal/pd-sessions/${session.id}/effluent-labs`, doctor, {
      sampleDatetime: '2026-11-06T13:00:00',
      wbcCountPerMcl: 240,
      neutrophilsPercent: 70,
      gramStain: 'Gram-positive cocci',
      empiricAntibioticInitiated: 'IP Cefazolin 500mg/L',
    });
    expect(effRes.status).toBe(201);
    expect(effRes.body.effluentLab.peritonitis_confirmed).toBe(1);

    // 5. Complete session
    const compRes = await call('PUT', `/api/pediatric-renal/pd-sessions/${session.id}/status`, doctor, {
      status: 'completed',
      deactivationReason: 'AKI recovered, adequate diuresis established',
    });
    expect(compRes.status).toBe(200);
    expect(compRes.body.session.status).toBe('completed');

    // 6. Print audit endpoint
    const printRes = await call('POST', `/api/pediatric-renal/pd-sessions/${session.id}/print`, doctor, {});
    expect(printRes.status).toBe(200);
  });
});
