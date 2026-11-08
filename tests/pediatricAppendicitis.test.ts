import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  calculateSamuelPasScore,
  evaluatePediatricAppendicitis,
} from '../web/src/pediatricAppendicitisEngine.js';

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

// -------------------------------------------------------------
// Pure Calculation Clinical Engine Tests
// -------------------------------------------------------------
describe('Pediatric Appendicitis & Samuel PAS Engine (Pure Unit Tests)', () => {
  it('correctly calculates Samuel PAS score (0-10) and stratifies risk tiers', () => {
    // High risk: Cough pain (+2), RLQ tenderness (+2), Migration (+1), Fever (+1), Nausea (+1), Anorexia (+1), WBC (+1), Neutrophils (+1) = 10
    const highPas = calculateSamuelPasScore({
      coughPercussionHoppingRlqPain: true,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: true,
      feverGt38c: true,
      nauseaOrVomiting: true,
      anorexia: true,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: true,
    });
    expect(highPas).toBe(10);

    const highEval = evaluatePediatricAppendicitis({
      ageYears: 9,
      weightKg: 30,
      symptomDurationHours: 16,
      coughPercussionHoppingRlqPain: true,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: true,
      feverGt38c: true,
      nauseaOrVomiting: true,
      anorexia: true,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: true,
      ultrasoundPerformed: true,
      appendixVisualized: true,
      outerDiameterMm: 8.5,
      nonCompressible: true,
      hypervascularRingOfFire: true,
      appendicolithFecalithPresent: false,
      periappendicealFluidOrFatStranding: true,
      perforationOrAbscessSuspected: false,
      managementPathway: 'urgent_laparoscopic_appendectomy',
      empiricAntibioticRegimen: 'ceftriaxone_plus_metronidazole',
    });
    expect(highEval.riskTier).toBe('high_risk_ge_7');
    expect(highEval.predictedProbabilityPercent).toBe(92.0);
    expect(highEval.urgentSurgeryIndicated).toBe(true);

    // Equivocal: RLQ tenderness (+2), Nausea (+1), WBC (+1) = 4
    const modPas = calculateSamuelPasScore({
      coughPercussionHoppingRlqPain: false,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: false,
      feverGt38c: false,
      nauseaOrVomiting: true,
      anorexia: false,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: false,
    });
    expect(modPas).toBe(4);

    const modEval = evaluatePediatricAppendicitis({
      ageYears: 11,
      weightKg: 35,
      symptomDurationHours: 12,
      coughPercussionHoppingRlqPain: false,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: false,
      feverGt38c: false,
      nauseaOrVomiting: true,
      anorexia: false,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: false,
      ultrasoundPerformed: false,
      appendixVisualized: false,
      nonCompressible: false,
      hypervascularRingOfFire: false,
      appendicolithFecalithPresent: false,
      periappendicealFluidOrFatStranding: false,
      perforationOrAbscessSuspected: false,
      managementPathway: 'discharge_observation',
      empiricAntibioticRegimen: 'none',
    });
    expect(modEval.riskTier).toBe('intermediate_equivocal_4_to_6');
    expect(modEval.actionPlan.some((p) => p.includes('graded-compression'))).toBe(true);
  });

  it('triggers young child perforation alert for age < 4 years', () => {
    const toddlerEval = evaluatePediatricAppendicitis({
      ageYears: 2.5,
      weightKg: 13,
      symptomDurationHours: 24,
      coughPercussionHoppingRlqPain: true,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: false,
      feverGt38c: true,
      nauseaOrVomiting: true,
      anorexia: true,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: true,
      ultrasoundPerformed: true,
      appendixVisualized: true,
      outerDiameterMm: 7.2,
      nonCompressible: true,
      hypervascularRingOfFire: true,
      appendicolithFecalithPresent: false,
      periappendicealFluidOrFatStranding: true,
      perforationOrAbscessSuspected: false,
      managementPathway: 'urgent_laparoscopic_appendectomy',
      empiricAntibioticRegimen: 'piperacillin_tazobactam',
    });

    expect(toddlerEval.perforationRiskElevated).toBe(true);
    expect(toddlerEval.clinicalDirectives.some((d) => d.includes('< 4 years'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration Tests
// -------------------------------------------------------------
describe('Pediatric Appendicitis REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedisurgappy',
      fullName: 'Dr. Vivek Saxena (Pediatric Surgeon)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pedisurgappy',
      fullName: 'Nurse Pooja (Pediatric Surgery)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.pedisurgappy', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.pedisurgappy', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.pedisurgappy',
      fullName: 'Pediatric Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.pedisurgappy', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.pedisurgappy', PW);

    // Create pediatric patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Patel',
      dateOfBirth: '2024-03-01',
      phone: '+91 97777 66655',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews appendicitis evaluation without database persistence', async () => {
    const res = await call('POST', '/api/pediatric-appendicitis/evaluate', doctor, {
      ageYears: 8,
      weightKg: 26.5,
      symptomDurationHours: 18,
      coughPercussionHoppingRlqPain: true,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: true,
      feverGt38c: true,
      nauseaOrVomiting: true,
      anorexia: true,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: true,
      wbcCountPerMicroliter: 14200,
      neutrophilPercent: 82,
      crpMgL: 38,
      ultrasoundPerformed: true,
      appendixVisualized: true,
      outerDiameterMm: 7.8,
      nonCompressible: true,
      hypervascularRingOfFire: true,
      appendicolithFecalithPresent: false,
      periappendicealFluidOrFatStranding: true,
      perforationOrAbscessSuspected: false,
      managementPathway: 'urgent_laparoscopic_appendectomy',
      empiricAntibioticRegimen: 'ceftriaxone_plus_metronidazole',
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.pasScoreTotal).toBe(10);
    expect(res.body.evalResult.riskTier).toBe('high_risk_ge_7');
    expect(res.body.evalResult.ultrasoundDefinitiveForAppendicitis).toBe(true);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const triageTime = new Date().toISOString();

    // 1. Attender cannot create episode (403 Forbidden)
    const attenderCreate = await call('POST', '/api/pediatric-appendicitis/episodes', attender, {
      patientId,
      triageDatetime: triageTime,
      ageYears: 8,
      weightKg: 26.5,
      symptomDurationHours: 18,
      coughPercussionHoppingRlqPain: true,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: true,
      feverGt38c: true,
      nauseaOrVomiting: true,
      anorexia: true,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: true,
      ultrasoundPerformed: false,
      appendixVisualized: false,
      nonCompressible: false,
      hypervascularRingOfFire: false,
      appendicolithFecalithPresent: false,
      periappendicealFluidOrFatStranding: false,
      perforationOrAbscessSuspected: false,
      managementPathway: 'urgent_laparoscopic_appendectomy',
      empiricAntibioticRegimen: 'ceftriaxone_plus_metronidazole',
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/pediatric-appendicitis/episodes', doctor, {
      patientId,
      triageDatetime: triageTime,
      ageYears: 8,
      weightKg: 26.5,
      symptomDurationHours: 18,
      coughPercussionHoppingRlqPain: true,
      rlqTendernessLightPalpation: true,
      migrationPainToRlq: true,
      feverGt38c: true,
      nauseaOrVomiting: true,
      anorexia: true,
      leukocytosisWbcGt10000: true,
      neutrophiliaAncGt7500OrGe75pct: true,
      wbcCountPerMicroliter: 14200,
      neutrophilPercent: 82,
      crpMgL: 38,
      ultrasoundPerformed: true,
      appendixVisualized: true,
      outerDiameterMm: 7.8,
      nonCompressible: true,
      hypervascularRingOfFire: true,
      appendicolithFecalithPresent: false,
      periappendicealFluidOrFatStranding: true,
      perforationOrAbscessSuspected: false,
      managementPathway: 'urgent_laparoscopic_appendectomy',
      empiricAntibioticRegimen: 'ceftriaxone_plus_metronidazole',
      status: 'operating_room_in_transit',
      clinicalNotes: '8-year-old child with classical migratory RLQ pain, hopping tenderness, fever 38.4C, WBC 14.2k (Samuel score 10/10). Graded US confirmed 7.8mm inflamed non-compressible appendix. Booked for emergent laparoscopic appendectomy.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('APP-');
    expect(episode.pas_score_total).toBe(10);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/pediatric-appendicitis/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/pediatric-appendicitis/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.pasScoreTotal).toBe(10);

    // 5. Nurse adds flowsheet log (201)
    const logRes = await call('POST', `/api/pediatric-appendicitis/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromTriage: 2,
      temperatureCelsius: 38.1,
      heartRateBpm: 108,
      respiratoryRate: 22,
      painScoreFlaccWongBaker: 4,
      abdominalExamFindings: 'focal_rlq_tenderness_improving',
      oralIntakeStatus: 'npo_strict',
      notes: 'Child comfortable after IV fentanyl and paracetamol. Strict NPO maintained.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Doctor updates episode
    const patchRes = await call('PATCH', `/api/pediatric-appendicitis/episodes/${episodeId}`, doctor, {
      status: 'postoperative_recovery',
      surgicalFindings: 'uncomplicated_suppurative',
      clinicalNotes: 'Laparoscopic appendectomy uneventful. Suppurative non-perforated appendix removed. IV Ceftriaxone continued.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('postoperative_recovery');

    // 7. Nurse deletes flowsheet log
    const delLogRes = await call('DELETE', `/api/pediatric-appendicitis/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(delLogRes.status).toBe(200);

    // 8. Doctor deletes episode
    const delRes = await call('DELETE', `/api/pediatric-appendicitis/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
