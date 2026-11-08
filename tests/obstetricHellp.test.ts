import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricHellp } from '../web/src/obstetricHellpEngine.js';

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

describe('Obstetric HELLP Engine (Pure Unit Tests)', () => {
  it('correctly stages Mississippi Class 1 & Tennessee Complete HELLP with severe thrombocytopenia', () => {
    const res = evaluateObstetricHellp({
      gestationalAgeWeeks: 32.5,
      plateletCountPerUl: 42000,
      astUL: 180,
      altUL: 155,
      ldhUL: 920,
      totalBilirubinMgDl: 2.4,
      schistocytesPresent: true,
      systolicBp: 172,
      diastolicBp: 112,
      epigastricRuqPain: true,
      hepaticSubcapsularHematomaSuspected: false,
      hepaticImagingPerformed: 'ultrasound_capsule_intact',
      dexamethasonePulseInitiated: true,
      magnesiumSulfateSeizureProphylaxis: true,
      plateletTransfusionAdministered: false,
      deliveryTimingPlan: 'planned_stabilization_and_delivery',
    });

    expect(res.mississippiClass).toBe('class_1_severe_thrombocytopenia');
    expect(res.tennesseeClassification).toBe('complete_hellp_syndrome');
    expect(res.isCompleteHellp).toBe(true);
    expect(res.isPlateletTransfusionIndicated).toBe(true);
    expect(res.dexamethasoneDirectives.some((d) => d.includes('10 mg IV every 12 hours'))).toBe(true);
    expect(res.magnesiumSulfateDirectives.some((d) => d.includes('Magnesium Sulfate'))).toBe(true);
  });

  it('triggers emergency rupture alerts and crash delivery tier when hemoperitoneum is present', () => {
    const res = evaluateObstetricHellp({
      gestationalAgeWeeks: 34.0,
      plateletCountPerUl: 28000,
      astUL: 450,
      altUL: 380,
      ldhUL: 1600,
      totalBilirubinMgDl: 3.5,
      schistocytesPresent: true,
      systolicBp: 85,
      diastolicBp: 50,
      epigastricRuqPain: true,
      hepaticSubcapsularHematomaSuspected: true,
      hepaticImagingPerformed: 'hepatic_rupture_hemoperitoneum',
      dexamethasonePulseInitiated: true,
      magnesiumSulfateSeizureProphylaxis: true,
      plateletTransfusionAdministered: true,
      deliveryTimingPlan: 'immediate_crash_delivery_under_2h',
    });

    expect(res.hepaticComplicationRisk).toBe('emergency_rupture');
    expect(res.urgencyTier).toBe('emergency_crash_delivery_or_rupture');
    expect(res.alerts.some((a) => a.toLowerCase().includes('hepatic rupture'))).toBe(true);
  });
});

describe('Obstetric HELLP Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.mfm',
      fullName: 'Dr. Sunita MFM Consultant',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.icu',
      fullName: 'Nurse Lakshmi ICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.icu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.icu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.mfm',
      fullName: 'Attender Rajesh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.mfm', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.mfm', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Mrs. Meera Patel',
      dateOfBirth: '1996-03-22',
      phone: '9876543277',
      address: 'Labor & Delivery Bed 2',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to create HELLP episode and fetch calculation', async () => {
    const res = await call('POST', '/api/obstetric-hellp/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      gestationalAgeWeeks: 33.0,
      plateletCountPerUl: 46000,
      astUL: 145,
      altUL: 120,
      ldhUL: 820,
      totalBilirubinMgDl: 1.8,
      schistocytesPresent: true,
      systolicBp: 165,
      diastolicBp: 108,
      epigastricRuqPain: true,
      hepaticSubcapsularHematomaSuspected: false,
      hepaticImagingPerformed: 'ultrasound_capsule_intact',
      dexamethasonePulseInitiated: true,
      magnesiumSulfateSeizureProphylaxis: true,
      plateletTransfusionAdministered: false,
      deliveryTimingPlan: 'planned_stabilization_and_delivery',
      status: 'acute_stabilization_icu_triage',
      clinicalNotes: 'Mississippi Class 1 with severe preeclampsia and epigastric discomfort.',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.episode.episode_code).toMatch(/^HELLP-\d+-\d+/);
    const episodeId = res.body.episode.id;

    const detail = await call('GET', `/api/obstetric-hellp/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.evaluation.mississippiClass).toBe('class_1_severe_thrombocytopenia');
  });

  it('allows nurse to record flowsheet log and patch status', async () => {
    const ep = await call('POST', '/api/obstetric-hellp/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      gestationalAgeWeeks: 33.0,
      plateletCountPerUl: 46000,
      astUL: 145,
      altUL: 120,
      ldhUL: 820,
      totalBilirubinMgDl: 1.8,
      schistocytesPresent: true,
      systolicBp: 165,
      diastolicBp: 108,
      epigastricRuqPain: true,
      hepaticSubcapsularHematomaSuspected: false,
      hepaticImagingPerformed: 'ultrasound_capsule_intact',
      dexamethasonePulseInitiated: true,
      magnesiumSulfateSeizureProphylaxis: true,
      plateletTransfusionAdministered: false,
      deliveryTimingPlan: 'planned_stabilization_and_delivery',
      status: 'acute_stabilization_icu_triage',
    });
    const episodeId = ep.body.episode.id;

    const logRes = await call('POST', `/api/obstetric-hellp/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:00:00',
      hoursFromAdmission: 3,
      plateletCountPerUl: 52000,
      astUL: 130,
      ldhUL: 760,
      systolicBp: 144,
      diastolicBp: 90,
      urineOutputMlHr: 38.0,
      deepTendonReflexes: 'normal_2_plus',
      epigastricPainScore: 3,
      notes: 'Post dose 1 Dexamethasone. BP stabilizing on Nicardipine infusion.',
    });

    expect([200, 201]).toContain(logRes.status);
    expect(logRes.body.flowsheetLog.platelet_count_per_ul).toBe(52000);

    // Patch status
    const patchRes = await call('PATCH', `/api/obstetric-hellp/episodes/${episodeId}/status`, doctor, {
      status: 'postpartum_icu_platelet_nadir_surveillance',
    });
    expect(patchRes.status).toBe(200);

    // Verify audit log
    const auditRow = db.prepare(`
      SELECT * FROM audit_events WHERE action = 'obstetric_hellp.flowsheet_add'
    `).get() as any;
    expect(auditRow).toBeDefined();
  });

  it('blocks attender with 403 Forbidden', async () => {
    const res = await call('POST', '/api/obstetric-hellp/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      gestationalAgeWeeks: 33.0,
      plateletCountPerUl: 46000,
      astUL: 145,
      altUL: 120,
      ldhUL: 820,
      totalBilirubinMgDl: 1.8,
      schistocytesPresent: true,
      systolicBp: 165,
      diastolicBp: 108,
      epigastricRuqPain: true,
      hepaticSubcapsularHematomaSuspected: false,
      hepaticImagingPerformed: 'ultrasound_capsule_intact',
      dexamethasonePulseInitiated: true,
      magnesiumSulfateSeizureProphylaxis: true,
      plateletTransfusionAdministered: false,
      deliveryTimingPlan: 'planned_stabilization_and_delivery',
    });

    expect(res.status).toBe(403);
  });
});
