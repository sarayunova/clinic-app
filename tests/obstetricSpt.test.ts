import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricSpt } from '../web/src/obstetricSptEngine.js';

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

describe('Obstetric SPT Engine (Pure Unit Tests)', () => {
  it('identifies confirmed radiographic Ovarian Vein Thrombosis and recommends 6 weeks anticoagulation', () => {
    const res = evaluateObstetricSpt({
      deliveryMode: 'cesarean_section',
      postpartumDay: 4,
      sptPhenotype: 'ovarian_vein_thrombosis',
      affectedVein: 'right_ovarian_vein',
      peakTemperatureCelsius: 39.0,
      hoursRefractoryTripleAntibiotics: 48,
      pelvicCtMriFindings: 'thrombus_with_rim_enhancement',
      pelvicAbscessRuledOut: true,
      heparinChallengeInitiated: true,
      anticoagulantRegimen: 'iv_unfractionated_heparin_infusion',
      heparinChallengeResponse: 'pending_under_48h',
    });

    expect(res.diagnosticLikelihood).toBe('confirmed_radiographic_ovt');
    expect(res.isFeverRefractoryCriteriaMet).toBe(true);
    expect(res.recommendedAnticoagulationDuration).toContain('6 weeks');
    expect(res.heparinDosingDirectives.some((d) => d.includes('80 units/kg IV bolus'))).toBe(true);
    expect(res.antimicrobialDirectives.some((d) => d.includes('afebrile and symptom-free for at least 48 hours'))).toBe(true);
  });

  it('confirms DSPT diagnosis via positive heparin challenge with rapid defervescence', () => {
    const res = evaluateObstetricSpt({
      deliveryMode: 'cesarean_section',
      postpartumDay: 5,
      sptPhenotype: 'deep_septic_pelvic_thrombophlebitis',
      affectedVein: 'internal_iliac_plexus',
      peakTemperatureCelsius: 38.8,
      hoursRefractoryTripleAntibiotics: 54,
      pelvicCtMriFindings: 'negative_no_thrombus_seen',
      pelvicAbscessRuledOut: true,
      heparinChallengeInitiated: true,
      anticoagulantRegimen: 'iv_unfractionated_heparin_infusion',
      defervescenceHours: 32,
      heparinChallengeResponse: 'positive_defervescence_within_48_72h',
    });

    expect(res.diagnosticLikelihood).toBe('probable_dspt_heparin_responsive');
    expect(res.heparinChallengeInterpretation).toContain('Rapid defervescence within 48-72 hours');
    expect(res.urgencyTier).toBe('active_therapeutic_management');
  });

  it('alerts when persistent fever > 72h on heparin suggests alternative occult pathology', () => {
    const res = evaluateObstetricSpt({
      deliveryMode: 'cesarean_section',
      postpartumDay: 6,
      sptPhenotype: 'undifferentiated_refractory_fever',
      affectedVein: 'not_visualized_clinical_diagnosis',
      peakTemperatureCelsius: 39.2,
      hoursRefractoryTripleAntibiotics: 72,
      pelvicCtMriFindings: 'pelvic_phlebitis_perivascular_stranding',
      pelvicAbscessRuledOut: true,
      heparinChallengeInitiated: true,
      anticoagulantRegimen: 'iv_unfractionated_heparin_infusion',
      heparinChallengeResponse: 'refractory_persistent_fever',
    });

    expect(res.diagnosticLikelihood).toBe('unlikely_alternative_source');
    expect(res.alerts.some((a) => a.includes('HEPARIN CHALLENGE NEGATIVE'))).toBe(true);
  });
});

describe('Obstetric SPT Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Sunita OBGYN',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.obgyn',
      fullName: 'Nurse Rupa Labor',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.obgyn', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.obgyn', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.obgyn',
      fullName: 'Attender Shyam',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.obgyn', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.obgyn', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Sharma',
      dateOfBirth: '1996-05-12',
      phone: '9876543211',
      address: 'Maternity Ward Bed 12',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, create episode, update, and log flowsheet with defervescence', async () => {
    // 1. Evaluate preview
    const preview = await call('POST', '/api/obstetric-spt/evaluate', doctor, {
      deliveryMode: 'cesarean_section',
      postpartumDay: 4,
      sptPhenotype: 'ovarian_vein_thrombosis',
      affectedVein: 'right_ovarian_vein',
      peakTemperatureCelsius: 38.9,
      hoursRefractoryTripleAntibiotics: 48,
      pelvicCtMriFindings: 'thrombus_with_rim_enhancement',
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.diagnosticLikelihood).toBe('confirmed_radiographic_ovt');

    // 2. Create episode
    const created = await call('POST', '/api/obstetric-spt/episodes', doctor, {
      patientId,
      deliveryDatetime: '2026-11-04T12:00:00',
      deliveryMode: 'cesarean_section',
      postpartumDay: 4,
      sptPhenotype: 'ovarian_vein_thrombosis',
      affectedVein: 'right_ovarian_vein',
      peakTemperatureCelsius: 38.9,
      hoursRefractoryTripleAntibiotics: 48,
      pelvicCtMriFindings: 'thrombus_with_rim_enhancement',
      pelvicAbscessRuledOut: true,
      heparinChallengeInitiated: true,
      heparinChallengeStartDatetime: '2026-11-08T06:00:00',
      anticoagulantRegimen: 'iv_unfractionated_heparin_infusion',
      targetApttSeconds: '60-85s (1.5-2.5x control)',
      heparinChallengeResponse: 'pending_under_48h',
      status: 'heparin_challenge_eval',
      clinicalNotes: 'Initiated therapeutic heparin infusion.',
    });
    expect(created.status).toBe(200);
    const episodeId = created.body.episode.id;
    expect(episodeId).toBeDefined();

    // 3. Nurse logs flowsheet with normal temperature at 28h (defervescence)
    const logRes = await call('POST', `/api/obstetric-spt/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T18:00:00',
      hoursSinceHeparinStart: 28.0,
      temperatureCelsius: 37.3,
      heartRate: 78,
      systolicBp: 116,
      diastolicBp: 74,
      apttSeconds: 70.0,
      heparinInfusionRateUnitsHr: 1300,
      bleedingSigns: 'none',
      flankAbdominalPainScore: 2,
      notes: 'Temperature normal, pain markedly decreased.',
    });
    expect(logRes.status).toBe(200);

    // 4. Check episode details
    const getRes = await call('GET', `/api/obstetric-spt/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.flowsheetLogs.length).toBe(1);
    expect(getRes.body.episode.defervescence_hours).toBe(28.0);
    expect(getRes.body.episode.heparin_challenge_response).toBe('positive_defervescence_within_48_72h');
  });

  it('rejects attender role from managing obstetric SPT protocols', async () => {
    const res = await call('POST', '/api/obstetric-spt/episodes', attender, {
      patientId,
      deliveryDatetime: '2026-11-04T12:00:00',
      deliveryMode: 'cesarean_section',
      postpartumDay: 4,
      sptPhenotype: 'ovarian_vein_thrombosis',
      affectedVein: 'right_ovarian_vein',
      peakTemperatureCelsius: 38.9,
      hoursRefractoryTripleAntibiotics: 48,
      pelvicCtMriFindings: 'thrombus_with_rim_enhancement',
      pelvicAbscessRuledOut: true,
      heparinChallengeInitiated: true,
      anticoagulantRegimen: 'iv_unfractionated_heparin_infusion',
      heparinChallengeResponse: 'pending_under_48h',
    });
    expect(res.status).toBe(403);
  });
});
