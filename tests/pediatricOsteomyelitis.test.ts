import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricOsteomyelitis } from '../web/src/pediatricOsteomyelitisEngine.js';

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

describe('Pediatric Acute Osteomyelitis Engine (Pure Unit Tests)', () => {
  it('correctly scores Kocher criteria 4/4 and warns of high probability concurrent septic arthritis', () => {
    const res = evaluatePediatricOsteomyelitis({
      ageYears: 5,
      weightKg: 19,
      boneInvolved: 'distal_femur',
      laterality: 'right',
      kocherFeverGt385: true,
      kocherNonWeightBearing: true,
      kocherEsrGt40: true,
      kocherWbcGt12k: true,
      crpAdmissionMgL: 75,
      crpPeakMgL: 95,
      subperiostealAbscessPresent: false,
      abscessSizeDepthMm: 0,
      imagingModalityConfirmatory: 'mri_with_contrast',
      surgicalDecompressionPerformed: false,
      surgicalProcedure: 'none_medical_management',
      isolatedPathogen: 'staphylococcus_aureus_mssa',
      currentAntibioticRegimen: 'iv_cefazolin',
      oralSwitchCriteriaMet: false,
    });

    expect(res.kocherScore).toBe(4);
    expect(res.kocherRiskCategory).toContain('High Risk');
    expect(res.septicArthritisCoexistenceProbability).toContain('~99%');
    expect(res.alerts.some((a) => a.includes('Kocher Score 4/4'))).toBe(true);
  });

  it('identifies subperiosteal abscess >= 3 mm and mandates emergency surgical bone fenestration', () => {
    const res = evaluatePediatricOsteomyelitis({
      ageYears: 4,
      weightKg: 16,
      boneInvolved: 'proximal_tibia',
      laterality: 'left',
      kocherFeverGt385: true,
      kocherNonWeightBearing: true,
      kocherEsrGt40: true,
      kocherWbcGt12k: false,
      crpAdmissionMgL: 82,
      crpPeakMgL: 110,
      subperiostealAbscessPresent: true,
      abscessSizeDepthMm: 4.2,
      imagingModalityConfirmatory: 'ultrasound_subperiosteal_fluid',
      surgicalDecompressionPerformed: false,
      surgicalProcedure: 'none_medical_management',
      isolatedPathogen: 'staphylococcus_aureus_mrsa',
      currentAntibioticRegimen: 'iv_vancomycin',
      oralSwitchCriteriaMet: false,
    });

    expect(res.isSurgicalDecompressionIndicated).toBe(true);
    expect(res.subperiostealAbscessSeverity).toBe('large_surgical_abscess');
    expect(res.urgencyTier).toBe('emergency_surgical_decompression');
    expect(res.surgicalDirectives.some((d) => d.includes('Orthopedic surgery consult'))).toBe(true);
  });

  it('validates oral step-down switch eligibility when afebrile with >= 30% CRP decline and resolving symptoms', () => {
    const res = evaluatePediatricOsteomyelitis({
      ageYears: 7,
      weightKg: 24,
      boneInvolved: 'distal_tibia',
      laterality: 'right',
      kocherFeverGt385: false,
      kocherNonWeightBearing: false,
      kocherEsrGt40: false,
      kocherWbcGt12k: false,
      crpAdmissionMgL: 65,
      crpPeakMgL: 90,
      currentCrpMgL: 20,
      currentTemperatureCelsius: 36.8,
      subperiostealAbscessPresent: false,
      abscessSizeDepthMm: 0,
      imagingModalityConfirmatory: 'mri_with_contrast',
      surgicalDecompressionPerformed: false,
      surgicalProcedure: 'none_medical_management',
      isolatedPathogen: 'staphylococcus_aureus_mssa',
      currentAntibioticRegimen: 'iv_cefazolin',
      oralSwitchCriteriaMet: true,
    });

    expect(res.isOralSwitchEligible).toBe(true);
    expect(res.crpDeclinePercent).toBeGreaterThanOrEqual(70);
    expect(res.urgencyTier).toBe('step_down_oral_recovery');
    expect(res.targetedAntibioticRecommendation).toContain('Oral Cephalexin');
  });
});

describe('Pediatric Acute Osteomyelitis Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.ortho',
      fullName: 'Dr. Vikram OrthoPeds',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ortho',
      fullName: 'Nurse Priya Peds',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ortho', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ortho', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ortho',
      fullName: 'Attender Gopal',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ortho', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ortho', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Rohan Verma',
      dateOfBirth: '2020-04-10',
      phone: '9876543212',
      address: 'Pediatric Ward Bed 8',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, create episode, update, and log AHO biomarker flowsheet', async () => {
    // 1. Evaluate preview
    const preview = await call('POST', '/api/pediatric-osteomyelitis/evaluate', doctor, {
      ageYears: 6,
      weightKg: 20,
      boneInvolved: 'distal_femur',
      laterality: 'right',
      kocherFeverGt385: true,
      kocherNonWeightBearing: true,
      kocherEsrGt40: true,
      kocherWbcGt12k: true,
      crpAdmissionMgL: 68,
      crpPeakMgL: 92,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.kocherScore).toBe(4);

    // 2. Create episode
    const created = await call('POST', '/api/pediatric-osteomyelitis/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-06T10:00:00',
      ageYears: 6,
      weightKg: 20,
      boneInvolved: 'distal_femur',
      laterality: 'right',
      kocherFeverGt385: true,
      kocherNonWeightBearing: true,
      kocherEsrGt40: true,
      kocherWbcGt12k: true,
      crpAdmissionMgL: 68,
      crpPeakMgL: 92,
      subperiostealAbscessPresent: true,
      abscessSizeDepthMm: 3.5,
      imagingModalityConfirmatory: 'mri_with_contrast',
      surgicalDecompressionPerformed: true,
      surgicalProcedure: 'cortical_fenestration_and_drainage',
      isolatedPathogen: 'staphylococcus_aureus_mssa',
      currentAntibioticRegimen: 'iv_cefazolin',
      oralSwitchCriteriaMet: false,
      status: 'surgical_drainage_and_culture',
      clinicalNotes: 'Underwent cortical windowing and subperiosteal abscess drainage.',
    });
    expect(created.status).toBe(200);
    const episodeId = created.body.episode.id;
    expect(episodeId).toBeDefined();

    // 3. Nurse logs flowsheet
    const logRes = await call('POST', `/api/pediatric-osteomyelitis/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T09:00:00',
      dayOfTherapy: 2,
      temperatureCelsius: 37.4,
      crpLevelMgL: 45.0,
      esrMmHr: 38,
      painScoreFlaccOrVas: 4,
      weightBearingStatus: 'partial_weight_bearing_limp',
      localSigns: 'moderately_tender_improving',
      routeOfAdministration: 'iv_infusion',
      notes: 'Child comfortable, bearing partial weight with antalgic limp.',
    });
    expect(logRes.status).toBe(200);

    // 4. Check episode details
    const getRes = await call('GET', `/api/pediatric-osteomyelitis/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.flowsheetLogs.length).toBe(1);
    expect(getRes.body.evaluation.crpDeclinePercent).toBeGreaterThan(0);
  });

  it('rejects attender role from managing pediatric osteomyelitis protocols', async () => {
    const res = await call('POST', '/api/pediatric-osteomyelitis/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-06T10:00:00',
      ageYears: 6,
      weightKg: 20,
      boneInvolved: 'distal_femur',
      laterality: 'right',
      kocherFeverGt385: true,
      kocherNonWeightBearing: true,
      kocherEsrGt40: true,
      kocherWbcGt12k: true,
      crpAdmissionMgL: 68,
      crpPeakMgL: 92,
      subperiostealAbscessPresent: false,
      abscessSizeDepthMm: 0,
      imagingModalityConfirmatory: 'mri_with_contrast',
      surgicalDecompressionPerformed: false,
      surgicalProcedure: 'none_medical_management',
      isolatedPathogen: 'staphylococcus_aureus_mssa',
      currentAntibioticRegimen: 'iv_cefazolin',
      oralSwitchCriteriaMet: false,
    });
    expect(res.status).toBe(403);
  });
});
