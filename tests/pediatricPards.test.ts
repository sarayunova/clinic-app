import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateOxygenationIndex,
  calculateOxygenSaturationIndex,
  calculateDrivingPressure,
  evaluatePediatricPards,
} from '../web/src/pediatricPardsEngine.js';

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
describe('Pediatric ARDS & PALICC-2 Engine (Pure Unit Tests)', () => {
  it('correctly calculates Oxygenation Index (OI)', () => {
    // MAP 15 cmH2O, FiO2 60%, PaO2 75 mmHg -> OI = (15 * 60) / 75 = 900 / 75 = 12.0 (Moderate PARDS)
    const oi = calculateOxygenationIndex(15.0, 60.0, 75.0);
    expect(oi).toBe(12.0);
  });

  it('correctly calculates Oxygen Saturation Index (OSI) when ABG unavailable', () => {
    // MAP 12 cmH2O, FiO2 50%, SpO2 90% -> OSI = (12 * 50) / 90 = 600 / 90 = 6.7 (Mild PARDS)
    const osi = calculateOxygenSaturationIndex(12.0, 50.0, 90.0);
    expect(osi).toBe(6.7);
  });

  it('correctly calculates Driving Pressure (Delta P = Pplat - PEEP)', () => {
    // Pplat 24 cmH2O, PEEP 10 cmH2O -> Delta P = 14 cmH2O (Safe <15)
    expect(calculateDrivingPressure(24.0, 10.0)).toBe(14.0);
    // Pplat 28 cmH2O, PEEP 8 cmH2O -> Delta P = 20 cmH2O (High >=15)
    expect(calculateDrivingPressure(28.0, 8.0)).toBe(20.0);
  });

  it('evaluates severe PARDS with OI >= 16 and recommends prone positioning & NMB', () => {
    // MAP 18 cmH2O, FiO2 80%, PaO2 70 mmHg -> OI = (18 * 80) / 70 = 20.6
    const res = evaluatePediatricPards({
      ageMonths: 48,
      weightKg: 16.0,
      ventilationMode: 'invasive_mechanical',
      mapCmh2o: 18.0,
      peepCmh2o: 12.0,
      fio2Percent: 80.0,
      pao2Mmhg: 70.0,
      spo2Percent: 89.0,
    });

    expect(res.oxygenationIndex).toBe(20.6);
    expect(res.pardsSeverity).toBe('severe');
    expect(res.targetTidalVolumeMinMl).toBe(48.0); // 3 mL/kg * 16 kg
    expect(res.targetTidalVolumeMaxMl).toBe(96.0); // 6 mL/kg * 16 kg
    expect(res.pronePositioningIndicated).toBe(true);
    expect(res.neuromuscularBlockadeIndicated).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric ARDS REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.intensivist',
      fullName: 'Dr. M. Chacko (PICU Intensivist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Sister Mary PICU',
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
      fullName: 'Master Reyansh Gupta (4yo)',
      dateOfBirth: '2022-04-10',
      phone: '+91 98765 33333',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and returns severity & driving pressure', async () => {
    const res = await call('POST', '/api/pediatric-pards/calculate', doctor, {
      ageMonths: 48,
      weightKg: 15.0,
      ventilationMode: 'invasive_mechanical',
      mapCmh2o: 16.0,
      peepCmh2o: 10.0,
      plateauPressureCmh2o: 24.0,
      fio2Percent: 65.0,
      pao2Mmhg: 80.0,
      spo2Percent: 92.0,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.oxygenationIndex).toBe(13.0);
    expect(res.body.evalResult.pardsSeverity).toBe('moderate');
    expect(res.body.evalResult.drivingPressureCmh2o).toBe(14.0);
    expect(res.body.evalResult.isDrivingPressureSafe).toBe(true);
  });

  it('creates a pediatric PARDS episode and audits the event', async () => {
    const res = await call('POST', '/api/pediatric-pards/episodes', doctor, {
      patientId,
      diagnosisDatetime: '2026-11-07T14:00',
      ageMonths: 48,
      weightKg: 15.0,
      triggerCause: 'pneumonia',
      ventilationMode: 'invasive_mechanical',
      currentPeepCmh2o: 10.0,
      currentMapCmh2o: 16.0,
      currentFio2Percent: 65.0,
      pao2Mmhg: 80.0,
      spo2Percent: 92.0,
      pronePositioningActive: true,
      neuromuscularBlockadeActive: false,
      status: 'acute_management',
      clinicalNotes: 'Severe RSV pneumonia with moderate PARDS (OI 13.0). Intubated, tidal volume 5 mL/kg target, prone positioning started.',
    });

    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toContain('PARDS-');
    expect(res.body.episode.pards_severity).toBe('moderate');

    const auditRow = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'pediatric_pards.episode_create' AND entity = 'pediatric_pards_episodes'`,
    ).get();
    expect(auditRow).toBeDefined();
  });

  it('allows nurses to log flowsheet entries, recalculating driving pressure and updating severity', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/pediatric-pards/episodes', doctor, {
      patientId,
      diagnosisDatetime: '2026-11-07T14:00',
      ageMonths: 36,
      weightKg: 12.0,
      triggerCause: 'aspiration',
      currentPeepCmh2o: 8.0,
      currentMapCmh2o: 14.0,
      currentFio2Percent: 50.0,
    });
    const episodeId = epRes.body.episode.id;

    // 2. Nurse logs flowsheet entry with Pplat 22, PEEP 8 -> Driving pressure 14 cmH2O
    const logRes = await call('POST', `/api/pediatric-pards/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T15:00',
      hoursOnProtocol: 1.0,
      pipCmh2o: 26.0,
      plateauPressureCmh2o: 22.0,
      peepCmh2o: 8.0,
      mapCmh2o: 13.0,
      fio2Percent: 45.0,
      tidalVolumeSetMl: 60.0,
      abgPh: 7.32,
      abgPao2Mmhg: 88.0,
      abgPco2Mmhg: 48.0,
      spo2Percent: 94.0,
      pronePositioningHours: 2.0,
      notes: 'Lungs recruited well on PEEP 8. Prone cycle underway.',
    });

    expect(logRes.status).toBe(201);
    expect(logRes.body.drivingPressure).toBe(14.0);
    expect(logRes.body.calculatedOi).toBe(6.6); // (13 * 45) / 88 = 6.64 -> Mild PARDS
    expect(logRes.body.severity).toBe('mild');

    // Verify episode updated with mild severity and new mechanics
    const getRes = await call('GET', `/api/pediatric-pards/episodes/${episodeId}`, doctor);
    expect(getRes.body.episode.pards_severity).toBe('mild');
    expect(getRes.body.logs.length).toBe(1);
  });

  it('prevents attender desk staff from creating PARDS records (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/pediatric-pards/episodes', attender, {
      patientId,
      diagnosisDatetime: '2026-11-07T14:00',
      ageMonths: 36,
      weightKg: 12.0,
    });
    expect(res.status).toBe(403);
  });
});
