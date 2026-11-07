import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  classifyPediatricShockPhenotype,
  evaluateFluidResuscitationSafety,
  calculateVisScore,
} from '../web/src/pediatricSepticShockEngine.js';

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
describe('Pediatric Septic Shock & VIS Engine (Pure Unit Tests)', () => {
  it('classifies Cold Shock phenotype (delayed refill, cool extremities, thready pulses) and recommends Epinephrine', () => {
    const cold = classifyPediatricShockPhenotype({
      capillaryRefillSeconds: 3.5,
      pulseQuality: 'weak_thready',
      extremityTemperature: 'cool_mottled',
      sbp: 72,
      dbp: 50,
    });

    expect(cold.phenotype).toBe('cold_shock');
    expect(cold.recommendedFirstLineVasoactive).toBe('epinephrine');
    expect(cold.isNarrowPulsePressure).toBe(true);
  });

  it('classifies Warm Shock phenotype (flash refill, bounding pulses, wide pulse pressure) and recommends Norepinephrine', () => {
    const warm = classifyPediatricShockPhenotype({
      capillaryRefillSeconds: 0.8,
      pulseQuality: 'bounding',
      extremityTemperature: 'warm',
      sbp: 95,
      dbp: 35, // Pulse pressure 60 mmHg (wide)
    });

    expect(warm.phenotype).toBe('warm_shock');
    expect(warm.recommendedFirstLineVasoactive).toBe('norepinephrine');
    expect(warm.isWidePulsePressure).toBe(true);
  });

  it('evaluates fluid safety and halts fluid boluses if hepatomegaly or pulmonary rales emerge', () => {
    // 10 kg infant, 200 mL given (20 mL/kg), clear lungs/liver
    const safe = evaluateFluidResuscitationSafety({
      weightKg: 10,
      cumulativeFluidMl: 200,
      hepatomegalyPresent: false,
      pulmonaryCracklesPresent: false,
    });
    expect(safe.bolusPermitted).toBe(true);
    expect(safe.cumulativeFluidMlKg).toBe(20);

    // Crackles detected: safety stop active
    const overload = evaluateFluidResuscitationSafety({
      weightKg: 10,
      cumulativeFluidMl: 300,
      hepatomegalyPresent: true,
      pulmonaryCracklesPresent: true,
    });
    expect(overload.bolusPermitted).toBe(false);
    expect(overload.isFluidOverload).toBe(true);
    expect(overload.overloadWarning).toContain('HOLD FURTHER FLUID BOLUSES');
  });

  it('identifies fluid-refractory shock once cumulative fluid reaches >= 40 mL/kg', () => {
    const refractory = evaluateFluidResuscitationSafety({
      weightKg: 15,
      cumulativeFluidMl: 600, // 40 mL/kg
      hepatomegalyPresent: false,
      pulmonaryCracklesPresent: false,
    });

    expect(refractory.isFluidRefractory).toBe(true);
  });

  it('calculates Vasoactive-Inotropic Score (VIS) accurately across all weighted inotropes', () => {
    // VIS = Dopamine + Dobutamine + 100*Epi + 100*Norepi + 10*Milrinone + 10000*Vasopressin
    // Dopa: 5, Epi: 0.1 (10), Milrinone: 0.5 (5) => VIS = 5 + 10 + 5 = 20 (Severe Tier)
    const severeVis = calculateVisScore({
      dopamineMcgKgMin: 5,
      epinephrineMcgKgMin: 0.1,
      milrinoneMcgKgMin: 0.5,
    });

    expect(severeVis.visScore).toBe(20);
    expect(severeVis.severityTier).toBe('severe_critical');
    expect(severeVis.picuEscalationRequired).toBe(true);

    // Low VIS: Dobutamine 5 => VIS = 5
    const lowVis = calculateVisScore({
      dobutamineMcgKgMin: 5,
    });
    expect(lowVis.visScore).toBe(5);
    expect(lowVis.severityTier).toBe('low');
  });
});

// -------------------------------------------------------------
// REST API & Integration Tests
// -------------------------------------------------------------
describe('Pediatric Septic Shock & VIS REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.peds',
      fullName: 'Dr. Arvind Sharma (Pediatrics)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Sister Anita PICU',
      role: 'nurse',
      password: 'temp-pass-nurse-picu',
    });
    const nurseFirst = await login('nurse.picu', 'temp-pass-nurse-picu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-picu',
      newPassword: PW,
    });
    nurse = await login('nurse.picu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'Reception Staff',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('desk.attender', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Patel (2y)',
      dateOfBirth: '2024-08-15',
      phone: '+91 98765 43212',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and returns phenotype and fluid safety', async () => {
    const res = await call('POST', '/api/pediatric-septic-shock/calculate', doctor, {
      capillaryRefillSeconds: 3.5,
      pulseQuality: 'weak_thready',
      extremityTemperature: 'cool_mottled',
      sbp: 70,
      dbp: 45,
      weightKg: 12,
      cumulativeFluidMl: 240,
      epinephrineMcgKgMin: 0.1,
    });

    expect(res.status).toBe(200);
    expect(res.body.phenotypeResult.phenotype).toBe('cold_shock');
    expect(res.body.fluidSafety.cumulativeFluidMlKg).toBe(20);
    expect(res.body.visResult.visScore).toBe(10);
  });

  it('creates a pediatric septic shock episode and audits the event', async () => {
    const res = await call('POST', '/api/pediatric-septic-shock/episodes', doctor, {
      patientId,
      recognitionDatetime: '2026-11-07T14:00',
      ageMonths: 26,
      weightKg: 12.5,
      heartRateBpm: 170,
      sbp: 72,
      dbp: 44,
      capillaryRefillSeconds: 3.5,
      pulseQuality: 'weak_thready',
      extremityTemperature: 'cool_mottled',
      clinicalNotes: 'Severe community acquired pneumonia with cold septic shock. Epinephrine IV line ready.',
    });

    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toContain('PSEP-');
    expect(res.body.episode.shock_phenotype).toBe('cold_shock');
    expect(res.body.episode.first_line_vasoactive).toBe('epinephrine');

    // Audit check
    const auditRow = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'pediatric_septic_shock.episode_create' AND entity = 'pediatric_septic_shock_episodes'`,
    ).get();
    expect(auditRow).toBeDefined();
  });

  it('allows nurses to log flowsheet entries, accumulates fluids and recalculates VIS score', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/pediatric-septic-shock/episodes', doctor, {
      patientId,
      recognitionDatetime: '2026-11-07T14:00',
      ageMonths: 24,
      weightKg: 10,
      heartRateBpm: 165,
      sbp: 75,
      dbp: 45,
    });
    const episodeId = epRes.body.episode.id;

    // 2. Nurse logs first 20 mL/kg bolus (200 mL)
    const log1 = await call('POST', `/api/pediatric-septic-shock/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T14:15',
      minutesFromRecognition: 15,
      heartRateBpm: 155,
      sbp: 80,
      dbp: 48,
      bolusFluidType: 'Plasma-Lyte',
      bolusFluidVolumeMl: 200,
      epinephrineMcgKgMin: 0.05,
    });

    expect(log1.status).toBe(201);
    expect(log1.body.newTotalFluidMlKg).toBe(20);
    expect(log1.body.visScore).toBe(5);

    // 3. Nurse logs second bolus (200 mL) -> Total 40 mL/kg => triggers fluid_refractory
    const log2 = await call('POST', `/api/pediatric-septic-shock/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T14:35',
      minutesFromRecognition: 35,
      heartRateBpm: 150,
      sbp: 82,
      dbp: 50,
      bolusFluidType: 'Plasma-Lyte',
      bolusFluidVolumeMl: 200,
      epinephrineMcgKgMin: 0.15,
    });

    expect(log2.status).toBe(201);
    expect(log2.body.newTotalFluidMlKg).toBe(40);
    expect(log2.body.visScore).toBe(15);

    // Parent episode check: should be marked fluid_refractory
    const updatedEp = db.prepare('SELECT status, fluid_refractory, current_vis_score FROM pediatric_septic_shock_episodes WHERE id = ?').get(episodeId) as any;
    expect(updatedEp.fluid_refractory).toBe(1);
    expect(updatedEp.status).toBe('fluid_refractory');
    expect(updatedEp.current_vis_score).toBe(15);
  });

  it('prevents attender desk staff from creating septic shock episodes (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/pediatric-septic-shock/episodes', attender, {
      patientId,
      recognitionDatetime: '2026-11-07T14:00',
      ageMonths: 24,
      weightKg: 10,
      heartRateBpm: 160,
      sbp: 75,
      dbp: 45,
    });
    expect(res.status).toBe(403);
  });
});
