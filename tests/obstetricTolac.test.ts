import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricTolac } from '../web/src/obstetricTolacEngine.js';

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

describe('Obstetric TOLAC Engine (Pure Unit Tests)', () => {
  it('correctly calculates Grobman VBAC success probability for favorable candidate', () => {
    const res = evaluateObstetricTolac({
      gestationalAgeWeeks: 39.2,
      maternalAge: 29,
      maternalBmi: 24.5,
      priorCesareanCount: 1,
      priorUterineIncisionType: 'low_transverse',
      priorVaginalDelivery: 'prior_vbac',
      indicationForPriorCesarean: 'Breech malpresentation',
      interdeliveryIntervalMonths: 30,
      bishopScore: 8,
      efmAbnormality: 'normal_category_1',
      iupcLossOfUterineTone: false,
      acuteScarTenderness: false,
      vaginalBleedingFresh: false,
      cessationOfContractions: false,
      presentingPartRetraction: false,
    });

    expect(res.hasContraindications).toBe(false);
    expect(res.grobmanVbacSuccessPct).toBeGreaterThanOrEqual(80);
    expect(res.ruptureRiskTier).toBe('standard_tolac_candidate');
    expect(res.isCrashCesareanIndicated).toBe(false);
  });

  it('detects absolute contraindications (Classical vertical incision, inverted T/J)', () => {
    const classicalRes = evaluateObstetricTolac({
      gestationalAgeWeeks: 38.5,
      maternalAge: 32,
      maternalBmi: 28.0,
      priorCesareanCount: 1,
      priorUterineIncisionType: 'classical_vertical',
      priorVaginalDelivery: 'no_prior_vaginal_delivery',
      indicationForPriorCesarean: 'Premature breech',
      interdeliveryIntervalMonths: 24,
      bishopScore: 4,
      efmAbnormality: 'normal_category_1',
      iupcLossOfUterineTone: false,
      acuteScarTenderness: false,
      vaginalBleedingFresh: false,
      cessationOfContractions: false,
      presentingPartRetraction: false,
    });

    expect(classicalRes.hasContraindications).toBe(true);
    expect(classicalRes.contraindicationList.some(c => c.includes('Classical'))).toBe(true);
    expect(classicalRes.alerts.some(a => a.includes('TOLAC CONTRAINDICATION'))).toBe(true);
  });

  it('detects impending uterine rupture triad triggering emergent crash cesarean', () => {
    const ruptureRes = evaluateObstetricTolac({
      gestationalAgeWeeks: 40.0,
      maternalAge: 33,
      maternalBmi: 27.0,
      priorCesareanCount: 1,
      priorUterineIncisionType: 'low_transverse',
      priorVaginalDelivery: 'no_prior_vaginal_delivery',
      indicationForPriorCesarean: 'Labor arrest',
      interdeliveryIntervalMonths: 20,
      bishopScore: 7,
      efmAbnormality: 'persistent_bradycardia_lt_90',
      iupcLossOfUterineTone: true,
      acuteScarTenderness: true,
      vaginalBleedingFresh: true,
      cessationOfContractions: true,
      presentingPartRetraction: true,
    });

    expect(ruptureRes.ruptureRiskTier).toBe('impending_or_active_uterine_rupture');
    expect(ruptureRes.isCrashCesareanIndicated).toBe(true);
    expect(ruptureRes.alerts.some(a => a.includes('CRITICAL SURGICAL EMERGENCY'))).toBe(true);
    expect(ruptureRes.recommendations.some(r => r.includes('CALL CODE CESAREAN'))).toBe(true);
  });
});

describe('Obstetric TOLAC Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.tolac',
      fullName: 'Dr. Tara Obstetrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.tolac',
      fullName: 'Nurse Natasha L&D',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.tolac', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.tolac', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.tolac',
      fullName: 'Attender Ajay',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.tolac', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.tolac', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Seraphina Sterling',
      dateOfBirth: '1995-04-12',
      phone: '9876543211',
      address: 'Labor & Delivery Suite 3',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview TOLAC evaluation and create an active episode', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/obstetric-tolac/evaluate', doctor, {
      gestationalAgeWeeks: 39.5,
      maternalAge: 30,
      maternalBmi: 26.0,
      priorCesareanCount: 1,
      priorUterineIncisionType: 'low_transverse',
      priorVaginalDelivery: 'prior_vbac',
      indicationForPriorCesarean: 'Breech',
      interdeliveryIntervalMonths: 28,
      bishopScore: 7,
      efmAbnormality: 'normal_category_1',
      iupcLossOfUterineTone: false,
      acuteScarTenderness: false,
      vaginalBleedingFresh: false,
      cessationOfContractions: false,
      presentingPartRetraction: false,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.grobmanVbacSuccessPct).toBeGreaterThanOrEqual(75);

    // 2. Create episode
    const created = await call('POST', '/api/obstetric-tolac/episodes', doctor, {
      patientId,
      assessmentDatetime: '2026-11-08T08:00',
      gestationalAgeWeeks: 39.5,
      maternalAge: 30,
      maternalBmi: 26.0,
      priorCesareanCount: 1,
      priorUterineIncisionType: 'low_transverse',
      priorVaginalDelivery: 'prior_vbac',
      indicationForPriorCesarean: 'Breech presentation',
      interdeliveryIntervalMonths: 28,
      bishopScore: 7,
      efmAbnormality: 'normal_category_1',
      iupcLossOfUterineTone: false,
      acuteScarTenderness: false,
      vaginalBleedingFresh: false,
      cessationOfContractions: false,
      presentingPartRetraction: false,
      status: 'active_labor_efm_monitoring',
      clinicalNotes: 'Epidural running, continuous EFM in situ',
    });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    const episodeId = created.body.episodeId;

    // 3. Get episode details
    const details = await call('GET', `/api/obstetric-tolac/episodes/${episodeId}`, doctor);
    expect(details.status).toBe(200);
    expect(details.body.episode.status).toBe('active_labor_efm_monitoring');
    expect(details.body.episode.prior_uterine_incision_type).toBe('low_transverse');

    // 4. Update status
    const updated = await call('PATCH', `/api/obstetric-tolac/episodes/${episodeId}/status`, doctor, {
      status: 'successful_vbac',
      clinicalNotes: 'Delivered female infant weighing 3.4 kg. Intact lower segment palpated.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.success).toBe(true);

    // 5. Add serial flowsheet log
    const log = await call('POST', `/api/obstetric-tolac/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T10:00',
      hoursInActiveLabor: 4.0,
      cervicalDilationCm: 6.0,
      fetalHeartRateBaseline: 138,
      efmCategory: 'category_1_normal',
      contractionsPer10min: 4,
      restingUterineToneMmhg: 12,
      lowerSegmentScarPain: false,
      interventionApplied: 'Encouraged ambulation and left lateral rest',
      notes: 'Progressing nicely',
    });
    expect(log.status).toBe(201);
    expect(log.body.success).toBe(true);
    const logId = log.body.logId;

    // 6. Delete flowsheet log
    const del = await call('DELETE', `/api/obstetric-tolac/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);
  });

  it('enforces RBAC permissions: desk attender cannot create or modify TOLAC records', async () => {
    const unauth = await call('POST', '/api/obstetric-tolac/episodes', attender, {
      patientId,
      assessmentDatetime: '2026-11-08T08:00',
      gestationalAgeWeeks: 39.5,
      maternalAge: 30,
      maternalBmi: 26.0,
      priorCesareanCount: 1,
      priorUterineIncisionType: 'low_transverse',
      priorVaginalDelivery: 'prior_vbac',
      indicationForPriorCesarean: 'Breech',
      interdeliveryIntervalMonths: 28,
      bishopScore: 7,
      efmAbnormality: 'normal_category_1',
    });
    expect(unauth.status).toBe(403);
  });
});
