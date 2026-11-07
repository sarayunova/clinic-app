import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluatePediatricSeizureProtocol,
  getBroselowZone,
} from '../web/src/pediatricSeizureEngine.js';

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
describe('Pediatric Status Epilepticus Resuscitation Engine (Pure Unit Tests)', () => {
  it('maps child weight to accurate Broselow resuscitation color zone', () => {
    expect(getBroselowZone(4.5)).toBe('grey');
    expect(getBroselowZone(7.0)).toBe('pink');
    expect(getBroselowZone(9.0)).toBe('red');
    expect(getBroselowZone(11.0)).toBe('purple');
    expect(getBroselowZone(13.5)).toBe('yellow');
    expect(getBroselowZone(17.0)).toBe('white');
    expect(getBroselowZone(21.0)).toBe('blue');
    expect(getBroselowZone(26.0)).toBe('orange');
    expect(getBroselowZone(34.0)).toBe('green');
    expect(getBroselowZone(42.0)).toBe('not_applicable');
  });

  it('detects hypoglycemia and calculates emergency 10% Dextrose (D10W) 2 mL/kg bolus', () => {
    const res = evaluatePediatricSeizureProtocol({
      weightKg: 12.0,
      ageMonths: 24,
      seizureDurationMinutes: 3.0,
      bloodGlucoseMgDl: 42, // severe hypoglycemia
      ivIoAccessEstablished: true,
      benzodiazepineDosesGiven: 0,
    });

    expect(res.glucoseEmergency).toBe(true);
    expect(res.d10wBolusMl).toBe(24); // 12kg * 2 mL/kg
    expect(res.medicationOptions.some(m => m.category === 'hypoglycemia')).toBe(true);
  });

  it('recommends Intranasal Midazolam 0.2 mg/kg when IV access is not yet established', () => {
    const res = evaluatePediatricSeizureProtocol({
      weightKg: 15.0,
      ageMonths: 36,
      seizureDurationMinutes: 8.0,
      bloodGlucoseMgDl: 100,
      ivIoAccessEstablished: false,
      benzodiazepineDosesGiven: 0,
    });

    expect(res.phase).toBe('phase_2_first_line_bzd_5_20m');
    const midaz = res.medicationOptions.find(m => m.drugName.includes('Midazolam'));
    expect(midaz).toBeDefined();
    expect(midaz?.calculatedDoseMgOrMl).toBe('3 mg (0.6 mL of 5 mg/mL solution)');
    expect(midaz?.route).toContain('Intranasal');
  });

  it('calculates second-line Levetiracetam (Keppra) 60 mg/kg for Established Status (>20m)', () => {
    const res = evaluatePediatricSeizureProtocol({
      weightKg: 20.0,
      ageMonths: 60,
      seizureDurationMinutes: 25.0,
      bloodGlucoseMgDl: 110,
      ivIoAccessEstablished: true,
      benzodiazepineDosesGiven: 2,
      secondLineAsmGiven: false,
    });

    expect(res.phase).toBe('phase_3_second_line_asm_20_40m');
    const keppra = res.medicationOptions.find(m => m.drugName.includes('Levetiracetam'));
    expect(keppra).toBeDefined();
    expect(keppra?.calculatedDoseMgOrMl).toBe('1200 mg'); // 20kg * 60 mg/kg
    expect(keppra?.maxDose).toBe('4,500 mg');
  });

  it('escalates to Phase 4 Refractory Status Epilepticus (>40m) requiring RSI and continuous PICU sedation', () => {
    const res = evaluatePediatricSeizureProtocol({
      weightKg: 18.0,
      ageMonths: 48,
      seizureDurationMinutes: 45.0,
      bloodGlucoseMgDl: 90,
      ivIoAccessEstablished: true,
      benzodiazepineDosesGiven: 2,
      secondLineAsmGiven: true,
    });

    expect(res.phase).toBe('phase_4_refractory_rsi_picu_gt_40m');
    expect(res.escalationWarning).toContain('CRITICAL CODE SEIZURE');
    const midazInfusion = res.medicationOptions.find(m => m.category === 'refractory_infusion');
    expect(midazInfusion).toBeDefined();
    expect(midazInfusion?.calculatedDoseMgOrMl).toContain('Load: 3.6 mg | Infuse: 1.8 - 36 mg/hr');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Status Epilepticus Resuscitation REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatrician',
      fullName: 'Dr. Vivek Menon (Pediatric Intensivist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pedser',
      fullName: 'Sister Anjali Emergency',
      role: 'nurse',
      password: 'temp-pass-nurse-er',
    });
    const nurseFirst = await login('nurse.pedser', 'temp-pass-nurse-er');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-er',
      newPassword: PW,
    });
    nurse = await login('nurse.pedser', PW);

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
      fullName: 'Master Aarav Sharma',
      dateOfBirth: '2023-04-12',
      phone: '+91 98450 09988',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculator endpoint and returns weight-calibrated AES dosages', async () => {
    const res = await call('POST', '/api/pediatric-seizures/calculate', doctor, {
      weightKg: 14.0,
      ageMonths: 36,
      seizureDurationMinutes: 12.0,
      bloodGlucoseMgDl: 52,
      ivIoAccessEstablished: false,
      benzodiazepineDosesGiven: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.phase).toBe('phase_2_first_line_bzd_5_20m');
    expect(res.body.glucoseEmergency).toBe(true);
    expect(res.body.d10wBolusMl).toBe(28); // 14 * 2 mL/kg
    expect(res.body.broselowZone).toBe('yellow');
  });

  it('creates a pediatric seizure episode and audits the event', async () => {
    const res = await call('POST', '/api/pediatric-seizures/episodes', doctor, {
      patientId,
      seizureStartDatetime: new Date().toISOString().slice(0, 16),
      seizureType: 'generalized_tonic_clonic',
      etiology: 'febrile_status',
      patientAgeMonths: 36,
      weightKg: 14.5,
      currentAlgorithmPhase: 'phase_2_first_line_bzd_5_20m',
      totalSeizureDurationMinutes: 8.0,
      bloodGlucoseMgDl: 88,
      phase2BenzodiazepineGiven: 'Midazolam IN 2.8 mg',
      phase2DoseCount: 1,
      clinicalNotes: 'Febrile convulsion in 3-year-old child; temp 39.2C. High-flow O2 given.',
    });

    expect(res.status).toBe(201);
    const ep = res.body.episode;
    expect(ep.episode_code).toMatch(/^SZ-/);
    expect(ep.broselow_color_zone).toBe('yellow');

    // Verify audit
    const auditRecord = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'pediatric_seizure.episode_create' AND entity = 'pediatric_seizure_episodes'`
    ).get() as any;
    expect(auditRecord).toBeDefined();
    expect(auditRecord.detail).toContain(ep.episode_code);
  });

  it('allows nurses to log resuscitation timeline events and auto-updates to aborted when convulsion ceases', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/pediatric-seizures/episodes', doctor, {
      patientId,
      seizureStartDatetime: new Date().toISOString().slice(0, 16),
      seizureType: 'generalized_tonic_clonic',
      etiology: 'febrile_status',
      patientAgeMonths: 36,
      weightKg: 14.0,
      currentAlgorithmPhase: 'phase_2_first_line_bzd_5_20m',
    });
    const epId = epRes.body.episode.id;

    // 2. Nurse logs first-line BZD push
    const event1 = await call('POST', `/api/pediatric-seizures/episodes/${epId}/timeline`, nurse, {
      elapsedMinutes: 6.0,
      timestamp: new Date().toISOString().slice(0, 16),
      actionType: 'first_line_benzodiazepine',
      medicationName: 'Midazolam (Intranasal)',
      doseAdministered: '2.8 mg',
      route: 'intranasal',
      heartRateBpm: 142,
      spo2Percent: 96,
      activeMotorActivity: true,
      clinicalObservations: 'Administered with MAD device. Tonic-clonic jerking continues.',
    });
    expect(event1.status).toBe(201);

    // 3. Nurse logs seizure aborted event
    const event2 = await call('POST', `/api/pediatric-seizures/episodes/${epId}/timeline`, nurse, {
      elapsedMinutes: 9.0,
      timestamp: new Date().toISOString().slice(0, 16),
      actionType: 'seizure_aborted',
      activeMotorActivity: false,
      heartRateBpm: 122,
      spo2Percent: 98,
      clinicalObservations: 'Full motor cessation. Patient in postictal sleep.',
    });
    expect(event2.status).toBe(201);

    // 4. Fetch episode and verify parent phase auto-updated to 'seizure_aborted_postictal'
    const getRes = await call('GET', `/api/pediatric-seizures/episodes/${epId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.current_algorithm_phase).toBe('seizure_aborted_postictal');
    expect(getRes.body.episode.total_seizure_duration_minutes).toBe(9.0);
    expect(getRes.body.timelineLogs.length).toBe(2);
  });

  it('prevents attender from creating seizure episodes (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/pediatric-seizures/episodes', attender, {
      patientId,
      seizureStartDatetime: new Date().toISOString().slice(0, 16),
      seizureType: 'generalized_tonic_clonic',
      patientAgeMonths: 24,
      weightKg: 12.0,
    });

    expect(res.status).toBe(403);
  });
});
