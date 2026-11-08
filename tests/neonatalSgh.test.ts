import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalSgh } from '../web/src/neonatalSghEngine.js';

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

describe('Neonatal SGH Engine (Pure Unit Tests)', () => {
  it('correctly calculates occult blood loss, TBV percentage, and MTP dosing', () => {
    // 3.4 kg infant, HC increased from 34.0 to 35.5 cm (+1.5 cm)
    // 1.5 cm * 38 mL = 57.0 mL occult blood loss
    // TBV = 3.4 * 80 mL/kg = 272 mL
    // Loss % = (57.0 / 272) * 100 = 21.0%
    const res = evaluateNeonatalSgh({
      birthWeightKg: 3.4,
      initialHeadCircumferenceCm: 34.0,
      currentHeadCircumferenceCm: 35.5,
      heartRateBpm: 180,
      bloodPressureSys: 48,
      capillaryRefillSeconds: 4.5,
      swellingCrossesSutures: true,
      swellingFluctuantPitting: true,
      earDisplacement: true,
      periorbitalEcchymosis: true,
      pallorSevere: true,
      vacuumCupPopoffs: 2,
      hematocritInitialPct: 48,
      hematocritLowestPct: 26,
      fibrinogenMgDl: 90,
      plateletCount: 65000,
    });

    expect(res.hcIncreaseCm).toBe(1.5);
    expect(res.estimatedOccultBloodLossMl).toBe(57.0);
    expect(res.estimatedTotalBloodVolumeMl).toBe(272);
    expect(res.circulatingVolumeLossPct).toBe(21.0);
    expect(res.shockState).toBe('uncompensated_hypotensive_shock');
    expect(res.mtpGuidance.prbcVolumeMl).toBe(51); // 15 * 3.4
    expect(res.mtpGuidance.ffpVolumeMl).toBe(34); // 10 * 3.4
    expect(res.mtpGuidance.cryoprecipitateVolumeMl).toBe(27); // 8 * 3.4
    expect(res.alerts.some(a => a.includes('CRITICAL OCCULT BLOOD LOSS'))).toBe(true);
    expect(res.recommendations.some(r => r.includes('MASSIVE TRANSFUSION PROTOCOL'))).toBe(true);
  });

  it('identifies life-threatening circulatory collapse when loss exceeds 30%', () => {
    // 3.0 kg infant, HC increased by 2.5 cm -> 95 mL loss / 240 TBV = 39.6%
    const collapseRes = evaluateNeonatalSgh({
      birthWeightKg: 3.0,
      initialHeadCircumferenceCm: 33.0,
      currentHeadCircumferenceCm: 35.5,
      heartRateBpm: 195,
      bloodPressureSys: 38,
      capillaryRefillSeconds: 6.0,
      swellingCrossesSutures: true,
      swellingFluctuantPitting: true,
      periorbitalEcchymosis: true,
      earDisplacement: true,
      pallorSevere: true,
    });

    expect(collapseRes.shockState).toBe('life_threatening_circulatory_collapse');
    expect(collapseRes.circulatingVolumeLossPct).toBeGreaterThan(30);
    expect(collapseRes.alerts.some(a => a.includes('CIRCULATORY COLLAPSE'))).toBe(true);
  });

  it('validates physical exam features crossing sutures distinguishing SGH from caput and cephalohematoma', () => {
    const examCheck = evaluateNeonatalSgh({
      birthWeightKg: 3.2,
      initialHeadCircumferenceCm: 34.0,
      currentHeadCircumferenceCm: 34.2,
      heartRateBpm: 145,
      swellingCrossesSutures: false,
      swellingFluctuantPitting: false,
      periorbitalEcchymosis: false,
      earDisplacement: false,
      pallorSevere: false,
    });

    expect(examCheck.isSghConfirmed).toBe(false);
    expect(examCheck.recommendations.some(r => r.includes('Re-examine mass'))).toBe(true);
  });
});

describe('Neonatal SGH Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.sgh',
      fullName: 'Dr. Neha Neonatologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.sgh',
      fullName: 'Nurse Neetu NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.sgh', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.sgh', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.sgh',
      fullName: 'Attender Ajay',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.sgh', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.sgh', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Infant of Victoria Woods',
      dateOfBirth: '2026-11-08',
      phone: '9876543210',
      address: 'NICU Incubator Bed 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview SGH evaluation and create an active episode', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/neonatal-sgh/evaluate', doctor, {
      birthWeightKg: 3.5,
      initialHeadCircumferenceCm: 34.0,
      currentHeadCircumferenceCm: 35.2,
      heartRateBpm: 172,
      bloodPressureSys: 50,
      capillaryRefillSeconds: 4.0,
      swellingCrossesSutures: true,
      swellingFluctuantPitting: true,
      earDisplacement: true,
      periorbitalEcchymosis: true,
      pallorSevere: true,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.estimatedOccultBloodLossMl).toBe(46); // 1.2 * 38 rounded

    // 2. Create episode
    const created = await call('POST', '/api/neonatal-sgh/episodes', doctor, {
      patientId,
      birthDatetime: '2026-11-08T06:00',
      diagnosisDatetime: '2026-11-08T09:30',
      deliveryMode: 'vacuum_assisted',
      vacuumCupPopoffs: 2,
      birthWeightKg: 3.5,
      initialHeadCircumferenceCm: 34.0,
      currentHeadCircumferenceCm: 35.2,
      swellingCrossesSutures: true,
      swellingFluctuantPitting: true,
      periorbitalEcchymosis: true,
      earDisplacement: true,
      pallorSevere: true,
      heartRateBpm: 172,
      bloodPressureSys: 50,
      bloodPressureDia: 28,
      capillaryRefillSeconds: 4.0,
      hematocritInitialPct: 49.0,
      hematocritLowestPct: 30.0,
      plateletCount: 85000,
      fibrinogenMgDl: 110,
      mtpActivated: true,
      prbcVolumeTransfusedMl: 70.0,
      ffpVolumeTransfusedMl: 50.0,
      cryoprecipitateVolumeMl: 35.0,
      status: 'active_resuscitation',
      clinicalNotes: 'Double UVC placed. MTP Pack 1 running.',
    });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    const episodeId = created.body.episodeId;

    // 3. Get episode details
    const details = await call('GET', `/api/neonatal-sgh/episodes/${episodeId}`, doctor);
    expect(details.status).toBe(200);
    expect(details.body.episode.estimated_occult_blood_loss_ml).toBe(46);
    expect(details.body.episode.status).toBe('active_resuscitation');

    // 4. Update status
    const updated = await call('PATCH', `/api/neonatal-sgh/episodes/${episodeId}/status`, doctor, {
      status: 'stabilized_monitoring',
      clinicalNotes: 'Head circumference stable over last 3 hours.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.success).toBe(true);

    // 5. Add serial flowsheet log
    const log = await call('POST', `/api/neonatal-sgh/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T11:00',
      hoursFromBirth: 5.0,
      headCircumferenceCm: 35.2,
      heartRate: 155,
      bloodPressureSys: 62,
      bloodPressureDia: 36,
      capillaryRefillSeconds: 2.5,
      hematocritPct: 36.5,
      bloodProductsTransfused: 'PRBC 70 mL completed',
      notes: 'Capillary refill normalized',
    });
    expect(log.status).toBe(201);
    expect(log.body.success).toBe(true);
    const logId = log.body.logId;

    // 6. Delete flowsheet log
    const del = await call('DELETE', `/api/neonatal-sgh/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);
  });

  it('enforces RBAC permissions: desk attender cannot create or modify SGH records', async () => {
    const unauth = await call('POST', '/api/neonatal-sgh/episodes', attender, {
      patientId,
      birthDatetime: '2026-11-08T06:00',
      diagnosisDatetime: '2026-11-08T09:30',
      deliveryMode: 'vacuum_assisted',
      birthWeightKg: 3.5,
      initialHeadCircumferenceCm: 34.0,
      currentHeadCircumferenceCm: 35.2,
      heartRateBpm: 172,
    });
    expect(unauth.status).toBe(403);
  });
});
