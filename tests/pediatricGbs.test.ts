import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricGbs } from '../web/src/pediatricGbsEngine.js';

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

describe('Pediatric GBS & Brighton Criteria Engine (Pure Unit Tests)', () => {
  it('evaluates Brighton Level 1 GBS with 20/30/40 respiratory failure and IVIG dosing', () => {
    const res = evaluatePediatricGbs({
      ageYears: 7.0,
      weightKg: 24.0,
      antecedentInfectionType: 'campylobacter_gastroenteritis',
      brightonCriteriaLevel: 'level_1_highest_certainty_csf_ncs',
      hughesDisabilityScore: 4,
      ascendingSymmetricWeakness: true,
      areflexiaOrHyporeflexia: true,
      csfProteinMgDl: 155.0,
      csfWbcCountPerUl: 4,
      vitalCapacityMlKg: 17.0, // < 20 mL/kg (Fails)
      negativeInspiratoryForceCmh2o: -22.0, // > -30 cmH2O (Fails)
      peakExpiratoryPressureCmh2o: 34.0, // < 40 cmH2O (Fails)
      dysautonomiaSignsPresent: true,
      immunotherapyRegimen: 'ivig_2g_kg_over_2_days',
      corticosteroidsAvoided: true,
    });

    expect(res.hasAlbuminocytologicalDissociation).toBe(true);
    expect(res.isImpendingRespiratoryFailure).toBe(true);
    expect(res.ivigDoseGramsTotal).toBe(48.0); // 24 kg * 2 g/kg
    expect(res.hughesDisabilityLabel).toContain('Hughes 4');
    expect(res.respiratoryFailureRuleLabel).toContain('Impending Respiratory Arrest');
    expect(res.alerts.some((a) => a.includes('IMPENDING NEUROMUSCULAR RESPIRATORY FAILURE'))).toBe(true);
    expect(res.respiratoryMonitoringDirectives.some((d) => d.includes('Succinylcholine is strictly contraindicated'))).toBe(true);
    expect(res.autonomicDysreflexiaDirectives.some((d) => d.includes('Continuous Cardiac & Arterial Line Telemetry'))).toBe(true);
  });

  it('triggers contraindication alert when corticosteroids are improperly administered', () => {
    const res = evaluatePediatricGbs({
      ageYears: 5.0,
      weightKg: 18.0,
      antecedentInfectionType: 'upper_respiratory_viral',
      brightonCriteriaLevel: 'level_2_csf_or_ncs',
      hughesDisabilityScore: 2,
      ascendingSymmetricWeakness: true,
      areflexiaOrHyporeflexia: true,
      csfProteinMgDl: 85.0,
      csfWbcCountPerUl: 2,
      vitalCapacityMlKg: 32.0,
      negativeInspiratoryForceCmh2o: -45.0,
      peakExpiratoryPressureCmh2o: 55.0,
      dysautonomiaSignsPresent: false,
      immunotherapyRegimen: 'ivig_2g_kg_over_5_days',
      corticosteroidsAvoided: false, // VIOLATION
    });

    expect(res.isImpendingRespiratoryFailure).toBe(false);
    expect(res.ivigDoseGramsTotal).toBe(36.0); // 18 kg * 2
    expect(res.alerts.some((a) => a.includes('CORTICOSTEROID CONTRAINDICATION'))).toBe(true);
  });

  it('warns of CSF pleocytosis when WBC count exceeds 50', () => {
    const res = evaluatePediatricGbs({
      ageYears: 10.0,
      weightKg: 35.0,
      antecedentInfectionType: 'ebv_cmv_infection',
      brightonCriteriaLevel: 'level_3_clinical_only',
      hughesDisabilityScore: 3,
      ascendingSymmetricWeakness: true,
      areflexiaOrHyporeflexia: true,
      csfProteinMgDl: 40.0,
      csfWbcCountPerUl: 68, // Pleocytosis!
      vitalCapacityMlKg: 28.0,
      negativeInspiratoryForceCmh2o: -40.0,
      peakExpiratoryPressureCmh2o: 48.0,
      dysautonomiaSignsPresent: false,
      immunotherapyRegimen: 'supportive_care_only',
      corticosteroidsAvoided: true,
    });

    expect(res.hasAlbuminocytologicalDissociation).toBe(false);
    expect(res.alerts.some((a) => a.includes('CSF PLEOCYTOSIS'))).toBe(true);
  });
});

describe('Pediatric GBS Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedineuro',
      fullName: 'Dr. Arjun Pediatric Neurologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Nurse Neha PICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.picu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.picu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.picu',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.picu', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.picu', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Rohan (GBS)',
      dateOfBirth: '2019-03-20',
      phone: '9876543204',
      address: 'PICU Bed 2',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to manage pediatric GBS episodes and nurse to record 20/30/40 checkpoints', async () => {
    // 1. Evaluate Preview API
    const evalRes = await call('POST', '/api/pediatric-gbs/evaluate', doctor, {
      ageYears: 7.5,
      weightKg: 25.0,
      antecedentInfectionType: 'campylobacter_gastroenteritis',
      brightonCriteriaLevel: 'level_1_highest_certainty_csf_ncs',
      hughesDisabilityScore: 4,
      ascendingSymmetricWeakness: true,
      areflexiaOrHyporeflexia: true,
      csfProteinMgDl: 140.0,
      csfWbcCountPerUl: 3,
      vitalCapacityMlKg: 17.5,
      negativeInspiratoryForceCmh2o: -24.0,
      peakExpiratoryPressureCmh2o: 35.0,
      dysautonomiaSignsPresent: true,
      immunotherapyRegimen: 'ivig_2g_kg_over_2_days',
      corticosteroidsAvoided: true,
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.ivigDoseGramsTotal).toBe(50.0);

    // 2. Create Episode
    const createRes = await call('POST', '/api/pediatric-gbs/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T08:00:00',
      ageYears: 7.5,
      weightKg: 25.0,
      antecedentInfectionType: 'campylobacter_gastroenteritis',
      brightonCriteriaLevel: 'level_1_highest_certainty_csf_ncs',
      hughesDisabilityScore: 4,
      ascendingSymmetricWeakness: true,
      areflexiaOrHyporeflexia: true,
      csfProteinMgDl: 140.0,
      csfWbcCountPerUl: 3,
      vitalCapacityMlKg: 17.5,
      negativeInspiratoryForceCmh2o: -24.0,
      peakExpiratoryPressureCmh2o: 35.0,
      dysautonomiaSignsPresent: true,
      immunotherapyRegimen: 'ivig_2g_kg_over_2_days',
      corticosteroidsAvoided: true,
      status: 'picu_ventilatory_support',
      clinicalNotes: 'Ascending flaccid paralysis following C. jejuni. 20/30/40 breach warrants elective intubation.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get Episode
    const getRes = await call('GET', `/api/pediatric-gbs/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.hughes_disability_score).toBe(4);

    // 4. Update Episode
    const updateRes = await call('PUT', `/api/pediatric-gbs/episodes/${episodeId}`, doctor, {
      patientId,
      onsetDatetime: '2026-11-08T08:00:00',
      ageYears: 7.5,
      weightKg: 25.0,
      antecedentInfectionType: 'campylobacter_gastroenteritis',
      brightonCriteriaLevel: 'level_1_highest_certainty_csf_ncs',
      hughesDisabilityScore: 3,
      ascendingSymmetricWeakness: true,
      areflexiaOrHyporeflexia: true,
      csfProteinMgDl: 140.0,
      csfWbcCountPerUl: 3,
      vitalCapacityMlKg: 22.0,
      negativeInspiratoryForceCmh2o: -32.0,
      peakExpiratoryPressureCmh2o: 42.0,
      dysautonomiaSignsPresent: false,
      immunotherapyRegimen: 'ivig_2g_kg_over_2_days',
      corticosteroidsAvoided: true,
      status: 'subacute_rehabilitation_weaning',
      clinicalNotes: 'Extubated, motor power recovering. IVIG completed.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('subacute_rehabilitation_weaning');

    // 5. Nurse adds flowsheet log
    const flowRes = await call('POST', `/api/pediatric-gbs/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T12:00:00',
      dayOfIllness: 5,
      hughesScoreCurrent: 4,
      vitalCapacityMlKg: 18.0,
      singleBreathCount: 14,
      cranialNervePalsyFacialBulbar: false,
      neckFlexionPowerMrc: 3,
      heartRateBpm: 104,
      systolicBp: 118,
      diastolicBp: 74,
      urinaryRetentionCatheterized: true,
      notes: 'IVIG Day 1 running. Vital capacity stable.',
    });
    expect(flowRes.status).toBe(201);
    const flowsheetId = flowRes.body.flowsheetLog.id;

    // 6. Delete Flowsheet
    const delFlowRes = await call('DELETE', `/api/pediatric-gbs/flowsheet/${flowsheetId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. Attender forbidden check
    const attenderTry = await call('POST', `/api/pediatric-gbs/episodes/${episodeId}/flowsheet`, attender, {
      logDatetime: '2026-11-08T12:00:00',
      dayOfIllness: 5,
      hughesScoreCurrent: 4,
      vitalCapacityMlKg: 18.0,
      singleBreathCount: 14,
      neckFlexionPowerMrc: 3,
      heartRateBpm: 104,
      systolicBp: 118,
      diastolicBp: 74,
    });
    expect(attenderTry.status).toBe(403);

    // 8. Delete Episode by Doctor
    const delEpRes = await call('DELETE', `/api/pediatric-gbs/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });
});
