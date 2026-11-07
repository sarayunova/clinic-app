import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateKaiserEosRisk,
  calculateItRatio,
  calculateNeonatalAntibioticDosing,
  calculateInotropeInfusionRates,
} from '../web/src/neonatalSepsisEngine.js';

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
describe('Neonatal Sepsis & Inotropes Engine (Pure Unit Tests)', () => {
  it('correctly calculates Kaiser EOS risk and recommends routine care for well-appearing infant', () => {
    const res = calculateKaiserEosRisk({
      gestationalAgeWeeks: 39,
      gestationalAgeDays: 2,
      birthWeightGrams: 3200,
      maternalTempCelsius: 37.0,
      romHours: 4,
      maternalGbsStatus: 'negative',
      maternalIapStatus: 'none',
      clinicalPresentation: 'well_appearing',
    });

    expect(res.eosRiskPer1000).toBeLessThan(0.7);
    expect(res.recommendation).toBe('routine_care');
    expect(res.antibioticIndicated).toBe(false);
  });

  it('correctly elevates risk to serial physical exams for equivocal infant or moderate ROM', () => {
    const res = calculateKaiserEosRisk({
      gestationalAgeWeeks: 38,
      gestationalAgeDays: 0,
      birthWeightGrams: 3000,
      maternalTempCelsius: 37.4,
      romHours: 19,
      maternalGbsStatus: 'positive',
      maternalIapStatus: 'adequate',
      clinicalPresentation: 'equivocal',
    });

    expect(res.eosRiskPer1000).toBeGreaterThanOrEqual(0.7);
    expect(res.recommendation).toBe('serial_physical_exams');
    expect(res.vitalSignFrequencyHours).toBe(4);
  });

  it('triggers blood culture and empiric antibiotics for clinical illness or severe maternal fever', () => {
    const res = calculateKaiserEosRisk({
      gestationalAgeWeeks: 34,
      gestationalAgeDays: 0,
      birthWeightGrams: 2100,
      maternalTempCelsius: 38.6,
      romHours: 24,
      maternalGbsStatus: 'positive',
      maternalIapStatus: 'inadequate',
      clinicalPresentation: 'clinical_illness',
    });

    expect(res.eosRiskPer1000).toBeGreaterThan(3.0);
    expect(res.recommendation).toBe('blood_culture_empiric_antibiotics');
    expect(res.antibioticIndicated).toBe(true);
    expect(res.bloodCultureIndicated).toBe(true);
  });

  it('calculates Immature-to-Total (I/T) neutrophil ratio and flags significant left shift >= 0.20', () => {
    // Normal: Bands 5%, Segs 50% => 5 / 55 = 0.09
    const normalIt = calculateItRatio({
      bandsPercent: 5,
      segmentedNeutrophilsPercent: 50,
    });
    expect(normalIt.itRatio).toBeLessThan(0.2);
    expect(normalIt.isElevated).toBe(false);

    // Left shift: Bands 20%, Metas 5%, Segs 50% => 25 / 75 = 0.33 (Markedly Elevated)
    const elevatedIt = calculateItRatio({
      bandsPercent: 20,
      metamyelocytesPercent: 5,
      segmentedNeutrophilsPercent: 50,
    });
    expect(elevatedIt.itRatio).toBeGreaterThanOrEqual(0.25);
    expect(elevatedIt.isElevated).toBe(true);
    expect(elevatedIt.severityGrade).toBe('abnormal_sepsis_alert');
  });

  it('calculates weight-adjusted Ampicillin and Gentamicin empiric dosages', () => {
    // 2.0 kg infant, 34 weeks
    const abx = calculateNeonatalAntibioticDosing(2000, 34);
    expect(abx.ampicillinDoseMg).toBe(100); // 50 mg/kg * 2 = 100 mg
    expect(abx.ampicillinIntervalHours).toBe(12);
    expect(abx.gentamicinDoseMg).toBe(9); // 4.5 mg/kg * 2 = 9 mg
    expect(abx.gentamicinIntervalHours).toBe(24);
  });

  it('calculates standard inotrope infusion rates (mL/hr) based on neonatal weight', () => {
    const inotropes = calculateInotropeInfusionRates({
      weightKg: 2.0,
      dopamineMcgKgMin: 10,
      epinephrineMcgKgMin: 0.2,
      milrinoneMcgKgMin: 0.5,
    });

    expect(inotropes.dopamineRateMlHr).toBe(1.0);
    expect(inotropes.epinephrineRateMlHr).toBe(1.0);
    expect(inotropes.milrinoneRateMlHr).toBe(1.0);
  });
});

// -------------------------------------------------------------
// REST API & Integration Tests
// -------------------------------------------------------------
describe('Neonatal Sepsis & Inotropes REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. S. Mukherjee (Neonatology)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Sister Priya NICU',
      role: 'nurse',
      password: 'temp-pass-nurse-nicu',
    });
    const nurseFirst = await login('nurse.nicu', 'temp-pass-nurse-nicu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-nicu',
      newPassword: PW,
    });
    nurse = await login('nurse.nicu', PW);

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

    // Preterm infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Kavita (Preterm 29w)',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 43210',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and validates Kaiser EOS predictions', async () => {
    const res = await call('POST', '/api/neonatal-sepsis/calculate-eos', doctor, {
      gestationalAgeWeeks: 33,
      birthWeightKg: 1.8,
      maternalTempCelsius: 38.4,
      romHours: 22,
      maternalGbsStatus: 'positive',
      clinicalPresentation: 'clinical_illness',
      bandsPercent: 18,
      segmentedNeutrophilsPercent: 42,
    });

    expect(res.status).toBe(200);
    expect(res.body.eosResult.recommendation).toBe('blood_culture_empiric_antibiotics');
    expect(res.body.itResult.isElevated).toBe(true);
    expect(res.body.abxDosing.ampicillinDoseMg).toBeGreaterThan(0);
  });

  it('creates a neonatal sepsis episode with Kaiser risk and audits the event', async () => {
    const res = await call('POST', '/api/neonatal-sepsis/episodes', doctor, {
      patientId,
      evaluationDatetime: '2026-11-07T10:00',
      gestationalAgeWeeks: 32,
      gestationalAgeDays: 4,
      birthWeightKg: 1.65,
      maternalTempCelsius: 38.2,
      romHours: 20,
      maternalGbsStatus: 'positive',
      maternalIapStatus: 'inadequate',
      clinicalPresentation: 'clinical_illness',
      bloodCultureDrawn: true,
      clinicalNotes: 'Prompt empirical IV Ampicillin and Gentamicin started.',
    });

    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toContain('EOS-');
    expect(res.body.episode.eos_recommendation).toBe('blood_culture_empiric_antibiotics');

    // Check audit event
    const auditRow = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'neonatal_sepsis.episode_create' AND entity = 'neonatal_sepsis_episodes'`,
    ).get();
    expect(auditRow).toBeDefined();
  });

  it('allows nurses to log bedside inotrope flowsheet checkpoints with MAP and pre/post ductal SpO2', async () => {
    // 1. Create episode first
    const epRes = await call('POST', '/api/neonatal-sepsis/episodes', doctor, {
      patientId,
      evaluationDatetime: '2026-11-07T10:00',
      gestationalAgeWeeks: 34,
      birthWeightKg: 2.1,
      maternalTempCelsius: 37.8,
      romHours: 12,
      maternalGbsStatus: 'unknown',
      maternalIapStatus: 'none',
      clinicalPresentation: 'clinical_illness',
    });
    const episodeId = epRes.body.episode.id;

    // 2. Nurse logs inotrope checkpoint
    const logRes = await call('POST', `/api/neonatal-sepsis/episodes/${episodeId}/inotrope-logs`, nurse, {
      logDatetime: '2026-11-07T11:00',
      hoursOnInotropes: 1,
      heartRateBpm: 155,
      bloodPressureSystolic: 54,
      bloodPressureDiastolic: 28,
      preDuctalSpo2: 96,
      postDuctalSpo2: 89,
      dopamineMcgKgMin: 7.5,
      epinephrineMcgKgMin: 0.1,
      notes: 'Right-to-left ductal shunting suspected; inotropes titrated.',
    });

    expect(logRes.status).toBe(201);
    expect(logRes.body.log).toBeDefined();
    expect(logRes.body.log.map_mmhg).toBe(36.7);
    expect(logRes.body.log.delta_spo2).toBe(7.0);

    // Episode status should be auto-escalated to escalated_septic_shock
    const updatedEp = db.prepare('SELECT status FROM neonatal_sepsis_episodes WHERE id = ?').get(episodeId) as any;
    expect(updatedEp.status).toBe('escalated_septic_shock');
  });

  it('prevents attender desk staff from creating sepsis episodes (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/neonatal-sepsis/episodes', attender, {
      patientId,
      evaluationDatetime: '2026-11-07T10:00',
      gestationalAgeWeeks: 38,
      birthWeightKg: 3.0,
      maternalTempCelsius: 37.0,
    });
    expect(res.status).toBe(403);
  });
});
