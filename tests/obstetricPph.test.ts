import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateGravimetricQbl,
  calculateShockIndex,
  checkUterotonicContraindications,
  evaluateObstetricPph,
} from '../web/src/obstetricPphEngine.js';

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
describe('Obstetric PPH & WHO E-MOTIVE Engine (Pure Unit Tests)', () => {
  it('correctly calculates gravimetric quantitative blood loss (QBL)', () => {
    // Drape 650 mL + Sponges 180 grams = 830 mL
    expect(calculateGravimetricQbl(650, 180)).toBe(830.0);
  });

  it('correctly calculates Shock Index (SI = HR / SBP)', () => {
    // HR 110, SBP 100 -> SI = 1.10
    expect(calculateShockIndex(110, 100)).toBe(1.10);
    // HR 80, SBP 120 -> SI = 0.67
    expect(calculateShockIndex(80, 120)).toBe(0.67);
  });

  it('detects maternal contraindications for uterotonics', () => {
    // Maternal hypertension: Ergometrine contraindicated
    const resHtn = checkUterotonicContraindications(true, false);
    expect(resHtn.contraindicated.some((d) => d.includes('Ergometrine'))).toBe(true);
    expect(resHtn.safe.some((d) => d.includes('Oxytocin'))).toBe(true);

    // Maternal asthma: Carboprost contraindicated
    const resAsthma = checkUterotonicContraindications(false, true);
    expect(resAsthma.contraindicated.some((d) => d.includes('Carboprost'))).toBe(true);
  });

  it('evaluates severe PPH with high shock index and recommends Bakri balloon & MTP', () => {
    const res = evaluateObstetricPph({
      deliveryMode: 'vaginal',
      drapeBloodVolumeMl: 1200,
      swabSpongeWeightNetG: 400,
      sbp: 85,
      dbp: 50,
      heartRate: 125,
      maternalHypertensionHistory: true,
      maternalAsthmaHistory: false,
    });

    expect(res.cumulativeQblMl).toBe(1600);
    expect(res.shockIndex).toBe(1.47);
    expect(res.isPphConfirmed).toBe(true);
    expect(res.severityTier).toBe('massive_pph');
    expect(res.bakriTamponadeRecommended).toBe(true);
    expect(res.mtpActivationAdvised).toBe(true);
    expect(res.contraindicatedDrugs.some((d) => d.includes('Ergometrine'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric PPH REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. S. Kulkarni (OBGYN)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ld',
      fullName: 'Sister Rekha L&D',
      role: 'nurse',
      password: 'temp-pass-nurse-ld',
    });
    const nurseFirst = await login('nurse.ld', 'temp-pass-nurse-ld');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-ld',
      newPassword: PW,
    });
    nurse = await login('nurse.ld', PW);

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

    // Obstetric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Pooja Hegde (G2P1 39w)',
      dateOfBirth: '1996-08-14',
      phone: '+91 98765 22222',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and validates QBL & E-MOTIVE evaluation', async () => {
    const res = await call('POST', '/api/obstetric-pph/calculate', doctor, {
      deliveryMode: 'vaginal',
      drapeBloodVolumeMl: 700,
      swabSpongeWeightNetG: 200,
      sbp: 95,
      dbp: 60,
      heartRate: 110,
      maternalHypertensionHistory: false,
      maternalAsthmaHistory: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.cumulativeQblMl).toBe(900);
    expect(res.body.evalResult.shockIndex).toBe(1.16);
    expect(res.body.evalResult.isPphConfirmed).toBe(true);
    expect(res.body.evalResult.contraindicatedDrugs.some((d: string) => d.includes('Carboprost'))).toBe(true);
  });

  it('creates an obstetric PPH episode and audits the event', async () => {
    const res = await call('POST', '/api/obstetric-pph/episodes', doctor, {
      patientId,
      deliveryMode: 'vaginal',
      pphRecognitionDatetime: '2026-11-07T12:00',
      gestationWeeks: 39.5,
      drapeBloodVolumeMl: 800,
      swabSpongeWeightNetG: 250,
      initialSbp: 90,
      initialDbp: 55,
      initialHeartRate: 115,
      etiology4t: 'tone_atony',
      emotiveMassageDone: true,
      emotiveOxytocinGiven: true,
      emotiveTxaGiven: true,
      emotiveIvFluidsGiven: true,
      emotiveExamCompleted: true,
      bakriBalloonPlaced: true,
      bakriFillVolumeMl: 400,
      tamponadeTestResult: 'success_bleeding_stopped',
      status: 'tamponade_active',
      clinicalNotes: 'Uterine atony postpartum. E-MOTIVE initiated; Bakri balloon placed with 400 mL saline. Bleeding controlled.',
    });

    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toContain('PPH-');
    expect(res.body.episode.gravimetric_qbl_ml).toBe(1050);

    const auditRow = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'obstetric_pph.episode_create' AND entity = 'obstetric_pph_episodes'`,
    ).get();
    expect(auditRow).toBeDefined();
  });

  it('allows nurses to log flowsheet entries, accumulates QBL and updates shock index', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/obstetric-pph/episodes', doctor, {
      patientId,
      deliveryMode: 'vaginal',
      pphRecognitionDatetime: '2026-11-07T12:00',
      drapeBloodVolumeMl: 600,
      swabSpongeWeightNetG: 100,
      initialSbp: 100,
      initialDbp: 60,
      initialHeartRate: 100,
    });
    const episodeId = epRes.body.episode.id;

    // 2. Nurse logs flowsheet entry with interval loss 200 mL
    const logRes = await call('POST', `/api/obstetric-pph/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T12:15',
      minutesFromRecognition: 15,
      intervalBloodLossMl: 200,
      sbp: 92,
      dbp: 56,
      heartRateBpm: 112,
      uterineTone: 'boggy_soft',
      medicationGiven: 'TXA 1g IV given over 10m',
      notes: 'Second IV line started with warm saline.',
    });

    expect(logRes.status).toBe(201);
    expect(logRes.body.newCumulativeQblMl).toBe(900); // 700 + 200
    expect(logRes.body.shockIndex).toBe(1.22);

    // Verify episode updated with accumulated QBL
    const getRes = await call('GET', `/api/obstetric-pph/episodes/${episodeId}`, doctor);
    expect(getRes.body.episode.gravimetric_qbl_ml).toBe(900);
    expect(getRes.body.episode.shock_index).toBe(1.22);
    expect(getRes.body.logs.length).toBe(1);
  });

  it('prevents attender desk staff from creating PPH records (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/obstetric-pph/episodes', attender, {
      patientId,
      deliveryMode: 'vaginal',
      pphRecognitionDatetime: '2026-11-07T12:00',
      initialSbp: 100,
      initialDbp: 60,
      initialHeartRate: 100,
    });
    expect(res.status).toBe(403);
  });
});
