import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricHus } from '../web/src/pediatricHusEngine.js';

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

describe('Pediatric Hemolytic Uremic Syndrome Engine (Pure Unit Tests)', () => {
  it('confirms diagnostic triad of STEC-HUS and flags dialysis requirement and strict antibiotic contraindication', () => {
    const res = evaluatePediatricHus({
      ageYears: 4.5,
      weightKg: 16.0,
      prodromalBloodyDiarrhea: true,
      shigaToxinTested: true,
      shigaToxinResult: 'positive_stec',
      hemoglobinGDl: 7.1,
      plateletCount: 38000,
      serumCreatinineMgDl: 2.9,
      baselineCreatinineMgDl: 0.4,
      schistocytesPresentPct: 3.8,
      serumLdhUL: 2240,
      directCoombsTest: 'negative',
      serumPotassiumMeqL: 5.6,
      oliguriaAnuriaDurationHours: 18.0,
      hypertensionPresent: true,
      neurologicalInvolvement: 'lethargy_irritability',
      husPhenotype: 'typical_stec_d_plus',
    });

    expect(res.isTriadDiagnosticMet).toBe(true);
    expect(res.kdigoAkiStage).toBe('stage_3_failure');
    expect(res.dialysisRrtIndicated).toBe(true);
    expect(res.antibioticContraindicationAlert).toContain('Strictly avoid antibiotics and antimotility agents');
    expect(res.alerts.some(a => a.includes('RENAL REPLACEMENT THERAPY INDICATED'))).toBe(true);
    expect(res.fluidManagementDirectives.some(d => d.includes('Insensible fluid calculation'))).toBe(true);
  });

  it('identifies atypical HUS (aHUS) and indicates terminal complement inhibitor Eculizumab therapy', () => {
    const res = evaluatePediatricHus({
      ageYears: 3.0,
      weightKg: 13.5,
      prodromalBloodyDiarrhea: false,
      shigaToxinTested: true,
      shigaToxinResult: 'negative',
      hemoglobinGDl: 6.8,
      plateletCount: 28000,
      serumCreatinineMgDl: 2.4,
      baselineCreatinineMgDl: 0.35,
      schistocytesPresentPct: 4.2,
      serumLdhUL: 2800,
      directCoombsTest: 'negative',
      serumPotassiumMeqL: 4.8,
      oliguriaAnuriaDurationHours: 8.0,
      hypertensionPresent: true,
      neurologicalInvolvement: 'none',
      husPhenotype: 'atypical_complement_mediated_ahus',
    });

    expect(res.isTriadDiagnosticMet).toBe(true);
    expect(res.eculizumabIndicated).toBe(true);
    expect(res.recommendations.some(r => r.includes('Eculizumab'))).toBe(true);
  });

  it('manages mild stage 1 AKI with conservative fluid monitoring when no dialysis criteria are met', () => {
    const res = evaluatePediatricHus({
      ageYears: 6.0,
      weightKg: 20.0,
      prodromalBloodyDiarrhea: true,
      shigaToxinTested: true,
      shigaToxinResult: 'positive_stec',
      hemoglobinGDl: 9.2,
      plateletCount: 65000,
      serumCreatinineMgDl: 0.9,
      baselineCreatinineMgDl: 0.5,
      schistocytesPresentPct: 1.5,
      serumLdhUL: 720,
      directCoombsTest: 'negative',
      serumPotassiumMeqL: 4.2,
      oliguriaAnuriaDurationHours: 4.0,
      hypertensionPresent: false,
      neurologicalInvolvement: 'none',
      husPhenotype: 'typical_stec_d_plus',
    });

    expect(res.isTriadDiagnosticMet).toBe(true);
    expect(res.kdigoAkiStage).toBe('stage_1');
    expect(res.dialysisRrtIndicated).toBe(false);
    expect(res.eculizumabIndicated).toBe(false);
  });
});

describe('Pediatric Hemolytic Uremic Syndrome Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.hus',
      fullName: 'Dr. Suresh PediatricNephrologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.hus',
      fullName: 'Nurse Kavita PICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.hus', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.hus', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.hus',
      fullName: 'Attender Manoj',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.hus', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.hus', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Sharma',
      dateOfBirth: '2022-05-10',
      phone: '9876543202',
      address: 'PICU Bed 1',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview, create, update, and nurse to log flowsheet', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/pediatric-hus/evaluate', doctor, {
      ageYears: 4.5,
      weightKg: 16.0,
      prodromalBloodyDiarrhea: true,
      shigaToxinTested: true,
      shigaToxinResult: 'positive_stec',
      hemoglobinGDl: 7.1,
      plateletCount: 38000,
      serumCreatinineMgDl: 2.9,
      baselineCreatinineMgDl: 0.4,
      schistocytesPresentPct: 3.8,
      serumLdhUL: 2240,
      directCoombsTest: 'negative',
      serumPotassiumMeqL: 5.6,
      oliguriaAnuriaDurationHours: 18.0,
      hypertensionPresent: true,
      neurologicalInvolvement: 'lethargy_irritability',
      husPhenotype: 'typical_stec_d_plus',
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.isTriadDiagnosticMet).toBe(true);
    expect(preview.body.evaluation.dialysisRrtIndicated).toBe(true);

    // 2. Create episode
    const created = await call('POST', '/api/pediatric-hus/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageYears: 4.5,
      weightKg: 16.0,
      prodromalBloodyDiarrhea: true,
      shigaToxinTested: true,
      shigaToxinResult: 'positive_stec',
      hemoglobinGDl: 7.1,
      plateletCount: 38000,
      serumCreatinineMgDl: 2.9,
      baselineCreatinineMgDl: 0.4,
      schistocytesPresentPct: 3.8,
      serumLdhUL: 2240,
      directCoombsTest: 'negative',
      serumPotassiumMeqL: 5.6,
      oliguriaAnuriaDurationHours: 18.0,
      hypertensionPresent: true,
      neurologicalInvolvement: 'lethargy_irritability',
      husPhenotype: 'typical_stec_d_plus',
      antibioticsAvoidedStrict: true,
      antimotilityAgentsAvoided: true,
      dialysisRrtIndicated: true,
      dialysisModality: 'peritoneal_dialysis',
      eculizumabIndicated: false,
      status: 'active_fluid_electrolyte_management',
      clinicalNotes: 'STEC-HUS post bloody diarrhea with Stage 3 AKI and hyperkalemia. PD catheter placed.',
    });

    expect(created.status).toBe(201);
    expect(created.body.episodeCode).toMatch(/^HUS-/);
    const episodeId = created.body.episodeId || created.body.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get episode details
    const detail = await call('GET', `/api/pediatric-hus/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.hus_phenotype).toBe('typical_stec_d_plus');
    expect(detail.body.evaluation.isTriadDiagnosticMet).toBe(true);

    // 4. Update status with doctor
    const statusUpdate = await call('PATCH', `/api/pediatric-hus/episodes/${episodeId}/status`, doctor, {
      status: 'dialysis_crrt_running',
      clinicalNotes: 'Peritoneal dialysis running smoothly. Potassium normalizing.',
    });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.success).toBe(true);

    // 5. Nurse adds flowsheet log
    const logAdd = await call('POST', `/api/pediatric-hus/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T05:00:00',
      hoursFromOnset: 2.0,
      urineOutputMlKgHr: 0.2,
      fluidBalance24hMl: 100,
      plateletCount: 36000,
      serumCreatinineMgDl: 3.0,
      serumPotassiumMeqL: 5.2,
      bloodPressureSys: 118,
      bloodPressureDia: 74,
      neurologicalStatus: 'irritable',
      dialysisUltrafiltrationMl: 150,
      notes: 'PD cycle 1 complete. Urine output remains low.',
    });
    expect(logAdd.status).toBe(201);
    const logId = logAdd.body.id || logAdd.body.logId;
    expect(logId).toBeGreaterThan(0);

    // 6. Delete flowsheet log
    const logDel = await call('DELETE', `/api/pediatric-hus/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(logDel.status).toBe(200);
    expect(logDel.body.success).toBe(true);
  });

  it('enforces RBAC preventing attender from creating HUS episodes', async () => {
    const unauth = await call('POST', '/api/pediatric-hus/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageYears: 4.5,
      weightKg: 16.0,
      hemoglobinGDl: 7.1,
      plateletCount: 38000,
      serumCreatinineMgDl: 2.9,
      baselineCreatinineMgDl: 0.4,
      schistocytesPresentPct: 3.8,
      serumLdhUL: 2240,
      serumPotassiumMeqL: 5.6,
      oliguriaAnuriaDurationHours: 18.0,
    });
    expect(unauth.status).toBe(403);
  });
});
