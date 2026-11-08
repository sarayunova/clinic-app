import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricKawasaki } from '../web/src/pediatricKawasakiEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown,
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

describe('Pediatric Kawasaki Disease Engine (Pure Unit Tests)', () => {
  it('correctly classifies Classic Complete KD and calculates IVIG and Aspirin dosing', () => {
    // 2-year-old (24 months), 12.0 kg, 5 days fever, 4 principal criteria
    const res = evaluatePediatricKawasaki({
      ageMonths: 24,
      weightKg: 12.0,
      feverDurationDays: 5,
      conjunctivitisBilateralBulbar: true,
      oralMucosalChanges: true,
      polymorphousExanthemRash: true,
      peripheralExtremityChanges: true,
      cervicalLymphadenopathyGe15cm: false,
      crpMgL: 65,
      esrMmHr: 55,
      echoPerformed: true,
      ladZScore: 1.5,
      rcaZScore: 1.2,
    });

    expect(res.principalCriteriaCount).toBe(4);
    expect(res.diagnosisClassification).toBe('classic_complete_kd');
    expect(res.coronaryAneurysmClassification).toBe('normal_z_lt_2');
    expect(res.treatmentRegimen.ivigDoseGrams).toBe(24.0); // 12 * 2.0
    expect(res.treatmentRegimen.aspirinAcuteDoseMgDay).toBe(480); // 12 * 40
    expect(res.treatmentRegimen.aspirinMaintenanceDoseMgDay).toBe(48); // 12 * 4
  });

  it('correctly computes Kobayashi Score and identifies High Risk IVIG Resistance (score >= 5)', () => {
    // Criteria:
    // Na <= 133 (+2)
    // Fever <= 4 days (+2)
    // ALT >= 100 (+2)
    // Neutrophils >= 80% (+2)
    // CRP >= 100 (+1)
    // Age <= 6 months (+1)
    // Platelets <= 300,000 (+1)
    const highRisk = evaluatePediatricKawasaki({
      ageMonths: 5, // <= 6m (+1)
      weightKg: 7.5,
      feverDurationDays: 4, // <= 4d (+2)
      conjunctivitisBilateralBulbar: true,
      oralMucosalChanges: true,
      polymorphousExanthemRash: true,
      peripheralExtremityChanges: true,
      cervicalLymphadenopathyGe15cm: false,
      crpMgL: 120, // >= 100 (+1)
      esrMmHr: 80,
      serumSodiumMeqL: 130, // <= 133 (+2)
      altUL: 125, // >= 100 (+2)
      neutrophilPct: 85, // >= 80% (+2)
      plateletCount: 250000, // <= 300,000 (+1)
      echoPerformed: true,
      ladZScore: 3.2,
    });

    // Total Kobayashi: 1 + 2 + 1 + 2 + 2 + 2 + 1 = 11
    expect(highRisk.kobayashiScore).toBe(11);
    expect(highRisk.ivigResistanceRisk).toBe('high_risk');
    expect(highRisk.coronaryAneurysmClassification).toBe('small_aneurysm_z_2_5_to_5');
    expect(highRisk.alerts.some(a => a.includes('HIGH RISK IVIG RESISTANCE'))).toBe(true);
  });

  it('detects Giant Coronary Artery Aneurysm (Z >= 10.0) requiring systemic anticoagulation', () => {
    const giantRes = evaluatePediatricKawasaki({
      ageMonths: 18,
      weightKg: 11.0,
      feverDurationDays: 7,
      conjunctivitisBilateralBulbar: true,
      oralMucosalChanges: true,
      polymorphousExanthemRash: true,
      peripheralExtremityChanges: true,
      cervicalLymphadenopathyGe15cm: true,
      crpMgL: 90,
      esrMmHr: 70,
      echoPerformed: true,
      ladZScore: 11.2,
      rcaZScore: 4.5,
    });

    expect(giantRes.coronaryAneurysmClassification).toBe('giant_aneurysm_ge_10_or_ge_8mm');
    expect(giantRes.alerts.some(a => a.includes('Giant coronary artery aneurysm'))).toBe(true);
  });
});

describe('Pediatric Kawasaki Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.kawasaki',
      fullName: 'Dr. Kenji Cardiologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.kawasaki',
      fullName: 'Nurse Karen Peds',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.kawasaki', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.kawasaki', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.kawasaki',
      fullName: 'Attender Ajay',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.kawasaki', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.kawasaki', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Aiden Takahashi',
      dateOfBirth: '2024-08-15',
      phone: '9876543212',
      address: 'Pediatric Ward Bed 12',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview Kawasaki evaluation and create an active episode', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/pediatric-kawasaki/evaluate', doctor, {
      ageMonths: 20,
      weightKg: 11.5,
      feverDurationDays: 6,
      conjunctivitisBilateralBulbar: true,
      oralMucosalChanges: true,
      polymorphousExanthemRash: true,
      peripheralExtremityChanges: true,
      cervicalLymphadenopathyGe15cm: false,
      crpMgL: 75.0,
      esrMmHr: 58.0,
      serumAlbuminGDl: 2.8,
      serumSodiumMeqL: 132,
      plateletCount: 290000,
      wbcCount: 17200,
      altUL: 105,
      neutrophilPct: 84,
      sterilePyuriaPresent: true,
      echoPerformed: true,
      ladZScore: 2.8,
      rcaZScore: 2.1,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.diagnosisClassification).toBe('classic_complete_kd');
    expect(preview.body.evaluation.kobayashiScore).toBeGreaterThanOrEqual(5);

    // 2. Create episode
    const created = await call('POST', '/api/pediatric-kawasaki/episodes', doctor, {
      patientId,
      presentationDatetime: '2026-11-08T07:30',
      ageMonths: 20,
      weightKg: 11.5,
      feverDurationDays: 6,
      conjunctivitisBilateralBulbar: true,
      oralMucosalChanges: true,
      polymorphousExanthemRash: true,
      peripheralExtremityChanges: true,
      cervicalLymphadenopathyGe15cm: false,
      bcgScarErythema: true,
      perinealErythemaDesquamation: true,
      crpMgL: 75.0,
      esrMmHr: 58.0,
      serumAlbuminGDl: 2.8,
      serumSodiumMeqL: 132,
      plateletCount: 290000,
      wbcCount: 17200,
      altUL: 105,
      neutrophilPct: 84,
      sterilePyuriaPresent: true,
      ivigAdministered: true,
      ivigDoseGKg: 2.0,
      aspirinDoseMgKgDay: 40.0,
      echoPerformed: true,
      ladZScore: 2.8,
      rcaZScore: 2.1,
      status: 'ivig_infusion_in_progress',
      clinicalNotes: 'IVIG 23g running over 12 hours via dedicated IV line',
    });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    const episodeId = created.body.episodeId;

    // 3. Get episode details
    const details = await call('GET', `/api/pediatric-kawasaki/episodes/${episodeId}`, doctor);
    expect(details.status).toBe(200);
    expect(details.body.episode.status).toBe('ivig_infusion_in_progress');
    expect(details.body.episode.diagnosis_classification).toBe('classic_complete_kd');

    // 4. Update status
    const updated = await call('PATCH', `/api/pediatric-kawasaki/episodes/${episodeId}/status`, doctor, {
      status: 'afebrile_post_ivig_monitoring',
      clinicalNotes: 'Afebrile for 24 hours post completion of IVIG.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.success).toBe(true);

    // 5. Add serial flowsheet log
    const log = await call('POST', `/api/pediatric-kawasaki/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T12:00',
      hoursFromAdmission: 6.0,
      temperatureCelsius: 37.4,
      heartRate: 115,
      bloodPressureSys: 96,
      bloodPressureDia: 60,
      ivigInfusionRunning: true,
      aspirinDoseGivenMg: 115,
      rashAppearance: 'Rash fading, no urticaria',
      extremityEdema: 'Mild swelling on dorsum of hands',
      notes: 'Infusion well-tolerated',
    });
    expect(log.status).toBe(201);
    expect(log.body.success).toBe(true);
    const logId = log.body.logId;

    // 6. Delete flowsheet log
    const del = await call('DELETE', `/api/pediatric-kawasaki/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);
  });

  it('enforces RBAC permissions: desk attender cannot create or modify Kawasaki records', async () => {
    const unauth = await call('POST', '/api/pediatric-kawasaki/episodes', attender, {
      patientId,
      presentationDatetime: '2026-11-08T07:30',
      ageMonths: 20,
      weightKg: 11.5,
      feverDurationDays: 6,
      crpMgL: 75.0,
      esrMmHr: 58.0,
    });
    expect(unauth.status).toBe(403);
  });
});
