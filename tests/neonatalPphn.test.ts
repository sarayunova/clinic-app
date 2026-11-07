import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateOxygenationIndex,
  calculateSpo2Gradient,
  classifyPphnSeverity,
  evaluateNeonatalPphn,
} from '../web/src/neonatalPphnEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let db: DB;
let app: FastifyInstance;
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

// -------------------------------------------------------------
// Pure Calculation Clinical Engine Tests
// -------------------------------------------------------------
describe('Neonatal PPHN & iNO Engine (Pure Unit Tests)', () => {
  it('correctly calculates Oxygenation Index (OI) and pre/post-ductal SpO2 gradient', () => {
    // MAP 14 cmH2O, FiO2 100%, PaO2 50 mmHg -> OI = (14 * 100) / 50 = 28.0
    expect(calculateOxygenationIndex(14, 100, 50)).toBe(28.0);

    // MAP 12 cmH2O, FiO2 80%, PaO2 80 mmHg -> OI = (12 * 80) / 80 = 12.0
    expect(calculateOxygenationIndex(12, 80, 80)).toBe(12.0);

    // Preductal 94%, Postductal 80% -> Gradient = 14% (Significant ductal shunt >= 10%)
    expect(calculateSpo2Gradient(94, 80)).toBe(14);
    // Preductal 92%, Postductal 90% -> Gradient = 2%
    expect(calculateSpo2Gradient(92, 90)).toBe(2);
  });

  it('correctly classifies PPHN severity tiers based on OI thresholds', () => {
    expect(classifyPphnSeverity(10)).toBe('mild_oi_under_15');
    expect(classifyPphnSeverity(18)).toBe('moderate_oi_15_24');
    expect(classifyPphnSeverity(32)).toBe('severe_oi_25_39');
    expect(classifyPphnSeverity(45)).toBe('critical_ecmo_oi_40_plus');
  });

  it('evaluates comprehensive PPHN management, iNO recommendations and MetHb alarms', () => {
    // Severe PPHN with Meconium Aspiration Syndrome
    const severePphn = evaluateNeonatalPphn({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3250,
      primaryEtiology: 'meconium_aspiration_syndrome',
      preductalSpo2: 91,
      postductalSpo2: 78,
      meanAirwayPressureCmh2o: 15,
      fio2Percent: 100,
      pao2Mmhg: 48, // OI = (15 * 100) / 48 = 31.3
      echoTrJetVelocityMs: 3.9,
      echoEstimatedRvspMmhg: 68,
      echoShuntDirection: 'right_to_left',
      currentInoDosePpm: 20,
      methemoglobinPercent: 1.5,
    });

    expect(severePphn.calculatedOi).toBe(31.3);
    expect(severePphn.severityTier).toBe('severe_oi_25_39');
    expect(severePphn.inoRecommended).toBe(true);
    expect(severePphn.recommendedInoDosePpm).toBe(20);
    expect(severePphn.secondLineVasodilators.length).toBeGreaterThan(0);
    expect(severePphn.methemoglobinStatus).toBe('normal');

    // Critical PPHN with ECMO criteria
    const criticalPphn = evaluateNeonatalPphn({
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3000,
      primaryEtiology: 'idiopathic',
      preductalSpo2: 82,
      postductalSpo2: 70,
      meanAirwayPressureCmh2o: 18,
      fio2Percent: 100,
      pao2Mmhg: 42, // OI = (18 * 100) / 42 = 42.9
      methemoglobinPercent: 5.4, // Toxic
    });

    expect(criticalPphn.severityTier).toBe('critical_ecmo_oi_40_plus');
    expect(criticalPphn.ecmoReferralIndicated).toBe(true);
    expect(criticalPphn.methemoglobinStatus).toBe('toxic');
    expect(criticalPphn.methemoglobinAdvice).toContain('Methylene Blue');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal PPHN & iNO REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. C. Roy (Consultant Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Staff Nurse Kavita (NICU)',
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
      username: 'attender.desk',
      fullName: 'Ward Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.desk', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.desk', PW);

    // Newborn patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Kavita (Term MAS with PPHN)',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 66666',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a neonatal PPHN episode and logs audit', async () => {
    const payload = {
      patientId,
      onsetDatetime: '2026-11-07T08:00:00',
      gestationalAgeWeeks: 39.0,
      birthWeightGrams: 3200,
      primaryEtiology: 'meconium_aspiration_syndrome',
      preductalSpo2: 90,
      postductalSpo2: 78,
      meanAirwayPressureCmh2o: 14.5,
      fio2Percent: 100,
      pao2Mmhg: 52,
      echoTrJetVelocityMs: 3.8,
      echoEstimatedRvspMmhg: 65,
      echoShuntDirection: 'right_to_left',
      inoActive: true,
      inoDosePpm: 20,
      methemoglobinPercent: 1.2,
      sildenafilActive: false,
      milrinoneActive: false,
      status: 'active_ino_therapy',
      clinicalNotes: 'Initiated iNO 20 ppm on HFOV following meconium aspiration.',
    };

    const res = await call('POST', '/api/neonatal-pphn/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.calculated_oi).toBeGreaterThan(25);
    expect(res.body.episode.pphn_severity_tier).toBe('severe_oi_25_39');

    // Verify audit log
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'neonatal_pphn.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record serial bedside flowsheet observations and recalculate serial OI', async () => {
    const epRes = await call('POST', '/api/neonatal-pphn/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 38.5,
      birthWeightGrams: 3100,
      primaryEtiology: 'idiopathic',
      preductalSpo2: 88,
      postductalSpo2: 76,
      meanAirwayPressureCmh2o: 14.0,
      fio2Percent: 100,
      pao2Mmhg: 48,
      inoActive: true,
      inoDosePpm: 20,
      status: 'active_ino_therapy',
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Nurse records 2-hour post-iNO response flowsheet
    const fsRes = await call('POST', `/api/neonatal-pphn/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T08:00:00',
      hoursFromOnset: 2,
      preductalSpo2: 95,
      postductalSpo2: 92,
      mapCmh2o: 13.0,
      fio2Percent: 80,
      pao2Mmhg: 75,
      inoDosePpm: 20,
      methemoglobinPercent: 1.4,
      circuitNo2Ppm: 0.2,
      meanArterialPressureMmhg: 48,
      inotropicScore: 10,
      notes: 'Excellent response to iNO: PaO2 rose to 75 mmHg, pre/post gradient narrowed to 3%.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();
    expect(fsRes.body.spo2Gradient).toBe(3);

    // Fetch episode detail and check flowsheet array
    const detail = await call('GET', `/api/neonatal-pphn/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].pao2_mmhg).toBe(75);
  });

  it('allows doctor to update episode and delete records', async () => {
    const epRes = await call('POST', '/api/neonatal-pphn/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 38.0,
      birthWeightGrams: 3000,
      primaryEtiology: 'respiratory_distress_syndrome',
      preductalSpo2: 92,
      postductalSpo2: 88,
      meanAirwayPressureCmh2o: 11.0,
      fio2Percent: 60,
      pao2Mmhg: 65,
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Doctor updates episode
    const patchRes = await call('PATCH', `/api/neonatal-pphn/episodes/${epId}`, doctor, {
      status: 'resolved_weaned',
      inoActive: false,
      inoDosePpm: 0,
      clinicalNotes: 'Successfully weaned off iNO. Extubated to CPAP.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('resolved_weaned');

    // Doctor deletes episode
    const delRes = await call('DELETE', `/api/neonatal-pphn/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/neonatal-pphn/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating PPHN episodes', async () => {
    const res = await call('POST', '/api/neonatal-pphn/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 38.0,
      birthWeightGrams: 3000,
      primaryEtiology: 'idiopathic',
      preductalSpo2: 90,
      postductalSpo2: 80,
      meanAirwayPressureCmh2o: 12.0,
      fio2Percent: 80,
      pao2Mmhg: 60,
    });
    expect(res.status).toBe(403);
  });
});
