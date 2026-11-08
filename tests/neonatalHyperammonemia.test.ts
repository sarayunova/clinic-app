import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalHyperammonemia } from '../web/src/neonatalHyperammonemiaEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown
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

describe('Neonatal IEM Hyperammonemic Crisis Engine (Pure Unit Tests)', () => {
  it('evaluates critical hyperammonemia > 400 umol/L requiring emergency CRRT hemodialysis and Ammonul', () => {
    const res = evaluateNeonatalHyperammonemia({
      ageHours: 72,
      birthWeightGrams: 3200,
      gestationalAgeWeeks: 39.5,
      plasmaAmmoniaUmolL: 520.0,
      bloodGasAcidBasePattern: 'respiratory_alkalosis',
      plasmaLactateMmolL: 1.6,
      anionGapMeqL: 10.0,
      urineKetonesPresent: false,
      suspectedDisorderCategory: 'urea_cycle_disorder_ucd',
      proteinIntakeHalted: true,
      highCalorieDextroseActive: true,
      girMgKgMin: 11.0,
      nitrogenScavengerAmmonulActive: true,
      ivLArginineActive: true,
      ivLCarnitineActive: false,
      crrtDialysisIndicated: true,
      crrtDialysisActive: false,
    });

    expect(res.ammoniaCrisisTier).toBe('extreme_hemodialysis_threshold');
    expect(res.isCrrtHemodialysisMandated).toBe(true);
    expect(res.ammonulLoadingDoseMg).toBe(800); // 3.2 kg * 250 mg
    expect(res.arginineLoadingDoseMg).toBe(800);
    expect(res.alerts.some((a) => a.includes('EXTREME HYPERAMMONEMIA'))).toBe(true);
    expect(res.dialysisDirectives.some((d) => d.includes('EMERGENCY CRRT / CVVHD'))).toBe(true);
    expect(res.urgencyTier).toBe('emergency_crrt_dialysis_and_scavengers');
  });

  it('evaluates moderate hyperammonemia in Urea Cycle Disorder with respiratory alkalosis', () => {
    const res = evaluateNeonatalHyperammonemia({
      ageHours: 60,
      birthWeightGrams: 3000,
      gestationalAgeWeeks: 39.0,
      plasmaAmmoniaUmolL: 280.0,
      bloodGasAcidBasePattern: 'respiratory_alkalosis',
      plasmaLactateMmolL: 1.8,
      anionGapMeqL: 11.0,
      urineKetonesPresent: false,
      suspectedDisorderCategory: 'urea_cycle_disorder_ucd',
      proteinIntakeHalted: true,
      highCalorieDextroseActive: true,
      girMgKgMin: 10.5,
      nitrogenScavengerAmmonulActive: true,
      ivLArginineActive: true,
      ivLCarnitineActive: false,
      crrtDialysisIndicated: false,
      crrtDialysisActive: false,
    });

    expect(res.ammoniaCrisisTier).toBe('severe_neurotoxic_crisis');
    expect(res.diagnosticDifferentiationNotes.some((n) => n.includes('Urea Cycle Disorder'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('SEVERE HYPERAMMONEMIC CRISIS'))).toBe(true);
  });

  it('evaluates Organic Acidemia pattern with severe metabolic acidosis and recommends L-Carnitine', () => {
    const res = evaluateNeonatalHyperammonemia({
      ageHours: 48,
      birthWeightGrams: 2800,
      gestationalAgeWeeks: 38.0,
      plasmaAmmoniaUmolL: 180.0,
      bloodGasAcidBasePattern: 'high_anion_gap_metabolic_acidosis',
      plasmaLactateMmolL: 5.2,
      anionGapMeqL: 24.0,
      urineKetonesPresent: true,
      suspectedDisorderCategory: 'organic_acidemia_oa',
      proteinIntakeHalted: true,
      highCalorieDextroseActive: true,
      girMgKgMin: 10.0,
      nitrogenScavengerAmmonulActive: true,
      ivLArginineActive: false,
      ivLCarnitineActive: true,
      crrtDialysisIndicated: false,
      crrtDialysisActive: false,
    });

    expect(res.diagnosticDifferentiationNotes.some((n) => n.includes('Organic Acidemia'))).toBe(true);
    expect(res.carnitineDoseMg).toBe(280); // 2.8 kg * 100 mg/kg
    expect(res.nitrogenScavengerDirectives.some((d) => d.includes('IV L-Carnitine'))).toBe(true);
  });
});

describe('Neonatal IEM Hyperammonemia Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.metabolic',
      fullName: 'Dr. Sanjay Neonatal Geneticist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Nurse Anjali NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.nicu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.nicu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.nicu',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.nicu', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.nicu', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Kavita (Hyperammonemia)',
      dateOfBirth: '2026-11-05',
      phone: '9876543212',
      address: 'NICU Bed 3',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to manage neonatal hyperammonemia episodes and nurse to record serial ammonia levels', async () => {
    // 1. Evaluate Preview API
    const evalRes = await call('POST', '/api/neonatal-hyperammonemia/evaluate', doctor, {
      ageHours: 68,
      birthWeightGrams: 3200,
      gestationalAgeWeeks: 39.5,
      plasmaAmmoniaUmolL: 385.0,
      bloodGasAcidBasePattern: 'respiratory_alkalosis',
      plasmaLactateMmolL: 1.8,
      anionGapMeqL: 11.0,
      urineKetonesPresent: false,
      suspectedDisorderCategory: 'urea_cycle_disorder_ucd',
      proteinIntakeHalted: true,
      highCalorieDextroseActive: true,
      girMgKgMin: 11.5,
      nitrogenScavengerAmmonulActive: true,
      ivLArginineActive: true,
      ivLCarnitineActive: false,
      crrtDialysisIndicated: false,
      crrtDialysisActive: false,
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.ammonulLoadingDoseMg).toBe(800);

    // 2. Create Episode
    const createRes = await call('POST', '/api/neonatal-hyperammonemia/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T04:30:00',
      ageHours: 68,
      birthWeightGrams: 3200,
      gestationalAgeWeeks: 39.5,
      plasmaAmmoniaUmolL: 385.0,
      bloodGasAcidBasePattern: 'respiratory_alkalosis',
      plasmaLactateMmolL: 1.8,
      anionGapMeqL: 11.0,
      urineKetonesPresent: false,
      suspectedDisorderCategory: 'urea_cycle_disorder_ucd',
      proteinIntakeHalted: true,
      highCalorieDextroseActive: true,
      girMgKgMin: 11.5,
      nitrogenScavengerAmmonulActive: true,
      ivLArginineActive: true,
      ivLCarnitineActive: false,
      crrtDialysisIndicated: false,
      crrtDialysisActive: false,
      status: 'medical_scavenger_infusion',
      clinicalNotes: 'Day 3 infant with UCD hyperammonemia treated with Ammonul and high GIR.',
    });
    expect(createRes.status).toBe(201);
    const epId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toMatch(/^IEM-/);

    // 3. Nurse logs flowsheet entry
    const flowRes = await call('POST', `/api/neonatal-hyperammonemia/episodes/${epId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:30:00',
      hoursFromCrisisOnset: 2.0,
      plasmaAmmoniaUmolL: 310.0,
      phValue: 7.48,
      pco2Mmhg: 29.0,
      bicarbonateMeqL: 21.0,
      glucoseMgDl: 138.0,
      girMgKgMin: 11.5,
      dialysisBloodFlowMlMin: 0.0,
      encephalopathyGrade: 'grade_2_moderate_somnolence_hyperreflexia',
      notes: 'Ammonul load complete. Ammonia trending down.',
    });
    expect(flowRes.status).toBe(201);
    const flowLogId = flowRes.body.flowsheetLog.id;

    // 4. Fetch Episode Detail
    const getRes = await call('GET', `/api/neonatal-hyperammonemia/episodes/${epId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(epId);
    expect(getRes.body.flowsheet.length).toBe(1);
    expect(getRes.body.evaluation.ammonulLoadingDoseMg).toBe(800);

    // 5. Update Status
    const statusRes = await call('PATCH', `/api/neonatal-hyperammonemia/episodes/${epId}/status`, doctor, {
      status: 'catabolism_reversal_stabilization',
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.episode.status).toBe('catabolism_reversal_stabilization');

    // 6. Delete Flowsheet Entry
    const delFlowRes = await call('DELETE', `/api/neonatal-hyperammonemia/episodes/${epId}/flowsheet/${flowLogId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. Attender unauthorized
    const unauthRes = await call('POST', '/api/neonatal-hyperammonemia/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T04:30:00',
      ageHours: 68,
      birthWeightGrams: 3200,
      gestationalAgeWeeks: 39.5,
      plasmaAmmoniaUmolL: 385.0,
      bloodGasAcidBasePattern: 'respiratory_alkalosis',
      plasmaLactateMmolL: 1.8,
      anionGapMeqL: 11.0,
      suspectedDisorderCategory: 'urea_cycle_disorder_ucd',
    });
    expect(unauthRes.status).toBe(403);
  });
});
