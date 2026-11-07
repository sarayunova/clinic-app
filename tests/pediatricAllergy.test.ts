import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculatePramScore,
  calculatePediatricAnaphylaxisPlan,
} from '../web/src/pediatricAllergyEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, attender: string;
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
// Pure Calculation Clinical Engine Tests
// -------------------------------------------------------------
describe('Pediatric Asthma PRAM & Anaphylaxis Engine (Pure Unit Tests)', () => {
  it('accurately scores Pediatric Respiratory Assessment Measure (PRAM) across mild, moderate, and severe tiers', () => {
    // 1. Mild exacerbation (PRAM 1 / 12)
    const mild = calculatePramScore({
      oxygenSaturationPct: 97, // 0 pts
      suprasternalRetractionsScore: 0,
      scaleneMuscleContractionScore: 0,
      airEntryScore: 0,
      wheezingScore: 1, // expiratory only
    });
    expect(mild.totalPramScore).toBe(1);
    expect(mild.severityTier).toBe('mild_0_3');
    expect(mild.recommendedPathway).toContain('Step 1');

    // 2. Moderate exacerbation (PRAM 6 / 12)
    const moderate = calculatePramScore({
      oxygenSaturationPct: 93, // 1 pt (92-94%)
      suprasternalRetractionsScore: 2, // 2 pts
      scaleneMuscleContractionScore: 0,
      airEntryScore: 1, // 1 pt
      wheezingScore: 2, // 2 pts
    });
    expect(moderate.totalPramScore).toBe(6);
    expect(moderate.severityTier).toBe('moderate_4_7');
    expect(moderate.recommendedPathway).toContain('Burst SABA');

    // 3. Impending Respiratory Failure (PRAM 12 / 12)
    const severe = calculatePramScore({
      oxygenSaturationPct: 88, // 2 pts (<92%)
      suprasternalRetractionsScore: 2, // 2 pts
      scaleneMuscleContractionScore: 2, // 2 pts
      airEntryScore: 3, // 3 pts (silent chest)
      wheezingScore: 3, // 3 pts (audible)
    });
    expect(severe.totalPramScore).toBe(12);
    expect(severe.severityTier).toBe('impending_respiratory_failure_8_12');
    expect(severe.dispositionRecommendation).toContain('PICU');
    expect(severe.medicationsSummary.some(m => m.includes('Magnesium Sulfate'))).toBe(true);
  });

  it('calculates weight-based IM Epinephrine dose & autoinjector device selection', () => {
    // Infant (< 7.5 kg): Syringe drawn ampoule
    const infant = calculatePediatricAnaphylaxisPlan({
      childWeightKg: 6.0,
      knownAllergens: ["Cow's Milk"],
    });
    expect(infant.epinephrineImDoseMg).toBe(0.06);
    expect(infant.epinephrineImVolumeMl).toBe(0.06);
    expect(infant.recommendedAutoinjectorType).toBe('ampoule_syringe_drawn');

    // Young Child (7.5 - 25 kg): EpiPen Jr (0.15 mg)
    const child = calculatePediatricAnaphylaxisPlan({
      childWeightKg: 16.0,
      knownAllergens: ['Peanuts', 'Tree Nuts'],
    });
    expect(child.epinephrineImDoseMg).toBe(0.16);
    expect(child.recommendedAutoinjectorType).toBe('epipen_jr_0_15mg');

    // Older Child / Adolescent (≥ 25 kg): EpiPen Adult (0.30 mg)
    const adolescent = calculatePediatricAnaphylaxisPlan({
      childWeightKg: 35.0,
      knownAllergens: ['Bee Venom'],
    });
    expect(adolescent.epinephrineImDoseMg).toBe(0.35);
    expect(adolescent.recommendedAutoinjectorType).toBe('epipen_adult_0_30mg');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Asthma & Allergy REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedpulm',
      fullName: 'Dr. Ramesh Iyer (Pediatric Pulmonology)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ped',
      fullName: 'Sister Anita Pediatric ER',
      role: 'nurse',
      password: 'temp-pass-nurse-ped',
    });
    const nurseFirst = await login('nurse.ped', 'temp-pass-nurse-ped');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-ped',
      newPassword: PW,
    });
    nurse = await login('nurse.ped', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'ER Reception',
      role: 'attender',
      password: 'temp-pass-desk-ped',
    });
    const deskFirst = await login('desk.attender', 'temp-pass-desk-ped');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-ped',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Create pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Patel (Age 6)',
      dateOfBirth: '2020-03-15',
      phone: '+91 98765 33333',
    });
    patientId = patRes.body.patient.id;
  });

  it('records pediatric PRAM asthma assessment and audits score creation', async () => {
    const res = await call('POST', '/api/pediatric-allergy/pram', doctor, {
      patientId,
      assessmentDatetime: '2026-11-07T13:00',
      oxygenSaturationPct: 93,
      suprasternalRetractionsScore: 2,
      scaleneMuscleContractionScore: 0,
      airEntryScore: 1,
      wheezingScore: 2,
      responseToBurstSaba: 'partial_response',
      systemicSteroidGiven: true,
      ivMagnesiumGiven: false,
      clinicalNotes: 'Burst Salbutamol + Ipratropium started; Oral Prednisolone given',
    });

    expect(res.status).toBe(201);
    expect(res.body.assessment.assessment_code).toMatch(/^PRAM-/);
    expect(res.body.assessment.total_pram_score).toBe(6);
    expect(res.body.assessment.severity_tier).toBe('moderate_4_7');

    const pramId = res.body.assessment.id;

    // List assessments
    const listRes = await call('GET', `/api/pediatric-allergy/pram?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.assessments.length).toBe(1);

    // Print audit
    const printRes = await call('POST', `/api/pediatric-allergy/pram/${pramId}/print`, doctor, {});
    expect(printRes.status).toBe(200);

    const auditRows = db.prepare('SELECT action FROM audit_events WHERE entity = ?').all('pediatric_pram_assessments');
    const actions = auditRows.map((r: any) => r.action);
    expect(actions).toContain('pediatric_pram.assessment_create');
    expect(actions).toContain('pediatric_allergy.print');
  });

  it('creates pediatric anaphylaxis action plan with allergen array and weight-based Epinephrine', async () => {
    const res = await call('POST', '/api/pediatric-allergy/anaphylaxis-plans', doctor, {
      patientId,
      diagnosisDate: '2026-11-07',
      knownAllergens: ['Peanuts', 'Tree Nuts (Cashew)'],
      childWeightKg: 19.5,
      injectionSite: 'anterolateral_right_thigh',
      antihistaminePrescribed: 'Cetirizine 5 mg syrup',
      steroidPrescribed: 'Prednisolone 20 mg x 3 days',
      schoolHealthActionPlanShared: true,
      emergencyContactName: 'Pooja Patel (Mother)',
      emergencyContactPhone: '+91 98765 44444',
      clinicalInstructions: 'Carry two EpiPen Jr auto-injectors at all times.',
    });

    expect(res.status).toBe(201);
    expect(res.body.plan.plan_code).toMatch(/^ANAPH-/);
    expect(res.body.plan.epinephrine_im_dose_mg).toBe(0.2); // 19.5 * 0.01 rounded to 0.20
    expect(res.body.plan.autoinjector_type).toBe('epipen_jr_0_15mg');
    expect(res.body.plan.known_allergens).toContain('Peanuts');

    const planId = res.body.plan.id;

    // Nurse updates plan
    const updateRes = await call('PUT', `/api/pediatric-allergy/anaphylaxis-plans/${planId}`, nurse, {
      patientId,
      diagnosisDate: '2026-11-07',
      knownAllergens: ['Peanuts', 'Tree Nuts (Cashew)', 'Egg'],
      childWeightKg: 20.0,
      injectionSite: 'anterolateral_right_thigh',
      emergencyContactName: 'Pooja Patel (Mother)',
      emergencyContactPhone: '+91 98765 44444',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.plan.known_allergens).toContain('Egg');

    // Audit trail
    const auditRows = db.prepare('SELECT action FROM audit_events WHERE entity = ?').all('pediatric_anaphylaxis_action_plans');
    const actions = auditRows.map((r: any) => r.action);
    expect(actions).toContain('anaphylaxis_plan.create');
    expect(actions).toContain('anaphylaxis_plan.update');
  });

  it('blocks attender from creating PRAM or Anaphylaxis plans', async () => {
    const res = await call('POST', '/api/pediatric-allergy/pram', attender, {
      patientId,
      assessmentDatetime: '2026-11-07T13:00',
      oxygenSaturationPct: 98,
      suprasternalRetractionsScore: 0,
      scaleneMuscleContractionScore: 0,
      airEntryScore: 0,
      wheezingScore: 0,
    });
    expect(res.status).toBe(403);
  });
});
