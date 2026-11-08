import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricVasaPrevia } from '../web/src/obstetricVasaPreviaEngine.js';

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

describe('Obstetric Vasa Previa Engine (Pure Unit Tests)', () => {
  it('confirms vasa previa when vessels are <= 20mm with color Doppler and directs planned 34-36w delivery', () => {
    const res = evaluateObstetricVasaPrevia({
      gestationalAgeWeeks: 32.5,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 12.0,
      colorDopplerConfirmed: true,
      cervicalLengthMm: 34.0,
      vaginalBleedingPresent: false,
      aptTestResult: 'not_performed',
      membraneStatus: 'intact',
      fetalHeartRateBpm: 140,
      ctgPattern: 'category_1_normal',
      corticosteroidsAdministered: true,
      electiveDeliveryWindowWeeks: '34_0_to_35_6_weeks',
    });

    expect(res.isVasaPreviaConfirmed).toBe(true);
    expect(res.isFetalExsanguinationEmergency).toBe(false);
    expect(res.urgencyTier).toBe('antenatal_surveillance_scheduled');
    expect(res.recommendedDeliveryTiming).toContain('34 0/7 to 35 6/7 weeks');
    expect(res.rupturePrecautionDirectives.some((d) => d.includes('CONTRAINDICATION'))).toBe(true);
  });

  it('triggers STAT Crash Cesarean for active bleeding with positive Apt test (fetal HbF pink)', () => {
    const res = evaluateObstetricVasaPrevia({
      gestationalAgeWeeks: 34.2,
      vasaPreviaType: 'type_2_succenturiate_or_bilobed_lobe',
      distanceToInternalOsMm: 8.0,
      colorDopplerConfirmed: true,
      cervicalLengthMm: 22.0,
      vaginalBleedingPresent: true,
      aptTestResult: 'positive_fetal_hemoglobin_pink',
      membraneStatus: 'ruptured_spontaneous',
      fetalHeartRateBpm: 105,
      ctgPattern: 'category_2_variable_decelerations',
      corticosteroidsAdministered: true,
      electiveDeliveryWindowWeeks: 'emergent_crash_cesarean',
    });

    expect(res.isFetalExsanguinationEmergency).toBe(true);
    expect(res.urgencyTier).toBe('crash_cesarean_emergency');
    expect(res.urgencyTierLabel).toContain('CRASH CESAREAN');
    expect(res.neonatalResuscitationPrepDirectives.some((d) => d.includes('O-negative'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('APT TEST POSITIVE'))).toBe(true);
  });

  it('detects sinusoidal CTG tracing indicating profound fetal exsanguination anemia and triggers crash delivery', () => {
    const res = evaluateObstetricVasaPrevia({
      gestationalAgeWeeks: 33.0,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 15.0,
      colorDopplerConfirmed: true,
      cervicalLengthMm: 28.0,
      vaginalBleedingPresent: false,
      aptTestResult: 'not_performed',
      membraneStatus: 'intact',
      fetalHeartRateBpm: 130,
      ctgPattern: 'category_3_sinusoidal_pattern',
      corticosteroidsAdministered: true,
      electiveDeliveryWindowWeeks: 'emergent_crash_cesarean',
    });

    expect(res.isFetalExsanguinationEmergency).toBe(true);
    expect(res.urgencyTier).toBe('crash_cesarean_emergency');
    expect(res.alerts.some((a) => a.includes('SINUSOIDAL TRACING'))).toBe(true);
  });

  it('alerts when short cervix (<25mm) heightens risk of spontaneous membrane rupture', () => {
    const res = evaluateObstetricVasaPrevia({
      gestationalAgeWeeks: 31.0,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 10.0,
      colorDopplerConfirmed: true,
      cervicalLengthMm: 21.0,
      vaginalBleedingPresent: false,
      aptTestResult: 'not_performed',
      membraneStatus: 'intact',
      fetalHeartRateBpm: 145,
      ctgPattern: 'category_1_normal',
      corticosteroidsAdministered: false,
      electiveDeliveryWindowWeeks: 'outpatient_surveillance_pre_34w',
    });

    expect(res.alerts.some((a) => a.includes('SHORT CERVIX ALERT'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('CORTICOSTEROID DEFICIENCY'))).toBe(true);
    expect(res.urgencyTier).toBe('inpatient_rupture_precautions');
  });
});

describe('Obstetric Vasa Previa Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.vasa',
      fullName: 'Dr. Sunita MFM',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.vasa',
      fullName: 'Nurse Preeti L&D',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.vasa', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.vasa', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.vasa',
      fullName: 'Attender Suresh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.vasa', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.vasa', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Sharma',
      dateOfBirth: '1995-04-12',
      phone: '9876543222',
      address: 'L&D Suite 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, create episode, update, and log flowsheet', async () => {
    // 1. Evaluate endpoint
    const preview = await call('POST', '/api/obstetric-vasa-previa/evaluate', doctor, {
      gestationalAgeWeeks: 33.5,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 12.0,
      colorDopplerConfirmed: true,
      vaginalBleedingPresent: false,
      aptTestResult: 'not_performed',
      membraneStatus: 'intact',
      ctgPattern: 'category_1_normal',
      corticosteroidsAdministered: true,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.isVasaPreviaConfirmed).toBe(true);

    // 2. Create episode
    const created = await call('POST', '/api/obstetric-vasa-previa/episodes', doctor, {
      patientId,
      gestationalAgeWeeks: 33.5,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 12.0,
      colorDopplerConfirmed: true,
      cervicalLengthMm: 31.0,
      vaginalBleedingPresent: false,
      aptTestResult: 'not_performed',
      membraneStatus: 'intact',
      fetalHeartRateBpm: 142,
      ctgPattern: 'category_1_normal',
      corticosteroidsAdministered: true,
      electiveDeliveryWindowWeeks: '34_0_to_35_6_weeks',
      status: 'inpatient_rupture_precautions',
      clinicalNotes: 'Type 1 vasa previa confirmed on color Doppler at 12 mm from os.',
    });
    expect(created.status).toBe(200);
    const episodeId = created.body.episode.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/obstetric-vasa-previa/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T08:00:00',
      gestationalAgeWeeks: 33.5,
      maternalSystolicBp: 118,
      maternalDiastolicBp: 74,
      maternalHeartRate: 80,
      fetalHeartRateBpm: 144,
      ctgBaselineVariability: 'normal_moderate',
      vaginalBleedingSeverity: 'none',
      uterineContractionsPer10min: 0,
      notes: 'EFM Category 1, patient on pelvic rest.',
    });
    expect(logRes.status).toBe(200);
    expect(logRes.body.log.fetal_heart_rate_bpm).toBe(144);

    // 4. Get episode details
    const detail = await call('GET', `/api/obstetric-vasa-previa/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.episode_code).toMatch(/^VASA-/);
    expect(detail.body.flowsheetLogs.length).toBe(1);

    // 5. Update episode status
    const updated = await call('PUT', `/api/obstetric-vasa-previa/episodes/${episodeId}`, doctor, {
      patientId,
      gestationalAgeWeeks: 34.0,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 12.0,
      colorDopplerConfirmed: true,
      cervicalLengthMm: 31.0,
      vaginalBleedingPresent: false,
      aptTestResult: 'not_performed',
      membraneStatus: 'intact',
      fetalHeartRateBpm: 140,
      ctgPattern: 'category_1_normal',
      corticosteroidsAdministered: true,
      electiveDeliveryWindowWeeks: '34_0_to_35_6_weeks',
      status: 'resolved_maternal_neonatal_discharge',
      clinicalNotes: 'Scheduled elective CS completed safely without vessel rupture.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.episode.status).toBe('resolved_maternal_neonatal_discharge');
  });

  it('blocks unauthenticated and attender requests to vasa previa endpoints', async () => {
    const unauth = await call('POST', '/api/obstetric-vasa-previa/episodes', undefined, {
      patientId,
      gestationalAgeWeeks: 33.5,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 12.0,
      colorDopplerConfirmed: true,
      membraneStatus: 'intact',
      ctgPattern: 'category_1_normal',
      electiveDeliveryWindowWeeks: '34_0_to_35_6_weeks',
    });
    expect(unauth.status).toBe(403);

    const attenderTry = await call('POST', '/api/obstetric-vasa-previa/episodes', attender, {
      patientId,
      gestationalAgeWeeks: 33.5,
      vasaPreviaType: 'type_1_velamentous_cord',
      distanceToInternalOsMm: 12.0,
      colorDopplerConfirmed: true,
      membraneStatus: 'intact',
      ctgPattern: 'category_1_normal',
      electiveDeliveryWindowWeeks: '34_0_to_35_6_weeks',
    });
    expect(attenderTry.status).toBe(403);
  });
});
