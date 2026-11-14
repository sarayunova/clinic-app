import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalSeizures } from '../web/src/neonatalSeizuresEngine.js';

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

describe('Neonatal Seizures Engine (Pure Unit Tests)', () => {
  it('calculates weight-based 20 mg/kg Phenobarbital loading and alerts for status epilepticus', () => {
    const res = evaluateNeonatalSeizures({
      gestationalAgeWeeks: 39.0,
      postnatalAgeDays: 2,
      currentWeightKg: 3.2,
      seizureSemiology: 'clonic',
      seizureDurationCategory: 'status_epilepticus',
      suspectedEtiology: 'hie',
      bloodGlucoseMgDl: 65,
      ionizedCalciumMmolL: 1.15,
      serumMagnesiumMgDl: 1.9,
      sodiumMeqL: 138,
      cumulativePhenobarbitalMgKg: 0,
      secondLineGiven: false,
      pyridoxineTrialDone: false,
    });

    expect(res.urgencyCategory).toBe('emergency_resuscitation');
    expect(res.isStatusEpilepticus).toBe(true);
    expect(res.phenobarbitalLoading.bolusDoseMg).toBe(64); // 20 mg/kg * 3.2 kg
    expect(res.phenobarbitalLoading.bolusVolumeMl).toBe(0.32); // 200 mg/mL conc
    expect(res.phenobarbitalLoading.cautions.length).toBeGreaterThan(0);
    expect(res.pyridoxineTrialIndicated).toBe(false);
  });

  it('triggers emergency metabolic directives for hypoglycemia, hypocalcemia, and hypomagnesemia', () => {
    const res = evaluateNeonatalSeizures({
      gestationalAgeWeeks: 38.0,
      postnatalAgeDays: 1,
      currentWeightKg: 3.0,
      seizureSemiology: 'subtle',
      seizureDurationCategory: 'recurrent_cluster',
      suspectedEtiology: 'hypoglycemia',
      bloodGlucoseMgDl: 32, // Trigger < 45 mg/dL
      ionizedCalciumMmolL: 0.85, // Trigger < 1.0 mmol/L
      serumMagnesiumMgDl: 1.2, // Trigger < 1.5 mg/dL
      sodiumMeqL: 135,
      cumulativePhenobarbitalMgKg: 0,
      secondLineGiven: false,
      pyridoxineTrialDone: false,
    });

    const hypoGluc = res.metabolicDirectives.find((m) => m.condition.includes('Hypoglycemia'));
    expect(hypoGluc).toBeDefined();
    expect(hypoGluc?.isTriggered).toBe(true);
    expect(hypoGluc?.volumeMl).toBe(6); // 2 mL/kg * 3.0 kg

    const hypoCalc = res.metabolicDirectives.find((m) => m.condition.includes('Hypocalcemia'));
    expect(hypoCalc).toBeDefined();
    expect(hypoCalc?.isTriggered).toBe(true);
    expect(hypoCalc?.volumeMl).toBe(4.5); // 1.5 mL/kg * 3.0 kg

    const hypoMag = res.metabolicDirectives.find((m) => m.condition.includes('Hypomagnesemia'));
    expect(hypoMag).toBeDefined();
    expect(hypoMag?.isTriggered).toBe(true);
    expect(hypoMag?.volumeMl).toBe(0.6); // 0.2 mL/kg * 3.0 kg
  });

  it('recommends second-line Levetiracetam and Pyridoxine trial when seizures are refractory (PB >= 20 mg/kg)', () => {
    const res = evaluateNeonatalSeizures({
      gestationalAgeWeeks: 37.5,
      postnatalAgeDays: 3,
      currentWeightKg: 2.8,
      seizureSemiology: 'tonic',
      seizureDurationCategory: 'recurrent_cluster',
      suspectedEtiology: 'inborn_metabolism',
      bloodGlucoseMgDl: 75,
      ionizedCalciumMmolL: 1.2,
      serumMagnesiumMgDl: 2.0,
      sodiumMeqL: 136,
      cumulativePhenobarbitalMgKg: 20,
      secondLineGiven: false,
      pyridoxineTrialDone: false,
    });

    expect(res.isRefractorySeizures).toBe(true);
    expect(res.secondLineRecommendation).toBeDefined();
    expect(res.secondLineRecommendation?.drug).toContain('Levetiracetam');
    expect(res.secondLineRecommendation?.bolusDoseMg).toBe(140); // 50 mg/kg * 2.8 kg (WHO 2023)
    expect(res.pyridoxineTrialIndicated).toBe(true);
  });
});

describe('Neonatal Seizures Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. Ramesh Neonatal ICU',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Nurse Kavita NICU',
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
      username: 'attender.nicu',
      fullName: 'Attender Manoj',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.nicu', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.nicu', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Sunita (Neonatal Seizures)',
      dateOfBirth: '2026-11-10',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('runs evaluate preview endpoint successfully', async () => {
    const res = await call('POST', '/api/neonatal-seizures/evaluate', doctor, {
      gestationalAgeWeeks: 38,
      postnatalAgeDays: 2,
      currentWeightKg: 3.0,
      seizureSemiology: 'clonic',
      seizureDurationCategory: 'recurrent_cluster',
      suspectedEtiology: 'hie',
      bloodGlucoseMgDl: 60,
    });
    expect(res.status).toBe(200);
    expect(res.body.evaluation.phenobarbitalLoading.bolusDoseMg).toBe(60);
  });

  it('allows doctor and nurse to create, view, update and log flowsheet; blocks attender', async () => {
    // Attender blocked from creating
    const attenderTry = await call('POST', '/api/neonatal-seizures/episodes', attender, {
      patientId,
      diagnosisDatetime: '2026-11-12T08:00:00',
      gestationalAgeWeeks: 38,
      postnatalAgeDays: 2,
      currentWeightKg: 3.1,
      seizureSemiology: 'clonic',
      seizureDurationCategory: 'recurrent_cluster',
      suspectedEtiology: 'hie',
    });
    expect(attenderTry.status).toBe(403);

    // Nurse creates episode
    const nurseCreate = await call('POST', '/api/neonatal-seizures/episodes', nurse, {
      patientId,
      diagnosisDatetime: '2026-11-12T08:00:00',
      gestationalAgeWeeks: 38,
      postnatalAgeDays: 2,
      currentWeightKg: 3.1,
      seizureSemiology: 'clonic',
      seizureDurationCategory: 'recurrent_cluster',
      suspectedEtiology: 'hie',
      firstLinePhenobarbitalGiven: true,
      cumulativePhenobarbitalMgKg: 20,
    });
    expect(nurseCreate.status).toBe(200);
    const episodeId = nurseCreate.body.id;
    expect(episodeId).toBeGreaterThan(0);

    // Get episode by ID
    const getRes = await call('GET', `/api/neonatal-seizures/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.current_weight_kg).toBe(3.1);
    expect(getRes.body.evaluation).toBeDefined();

    // Nurse adds flowsheet log
    const logRes = await call('POST', `/api/neonatal-seizures/episodes/${episodeId}/flowsheet`, nurse, {
      recordedAt: '2026-11-12T08:30:00',
      seizureCountPastHour: 1,
      currentSeizureState: 'infrequent_twitches',
      heartRateBpm: 142,
      respiratoryRateBpm: 46,
      spo2Percent: 96,
      sedationScore: 'mild_somnolence',
      eegBackground: 'discontinuous',
      nurseNotes: 'Twitching subdued after PB load.',
    });
    expect(logRes.status).toBe(200);
    const logId = logRes.body.id;

    // Update status
    const statusRes = await call('PATCH', `/api/neonatal-seizures/episodes/${episodeId}/status`, nurse, {
      status: 'stabilized',
    });
    expect(statusRes.status).toBe(200);

    // Nurse attempts to delete episode -> 403 Forbidden (doctor only)
    const nurseDel = await call('DELETE', `/api/neonatal-seizures/episodes/${episodeId}`, nurse);
    expect(nurseDel.status).toBe(403);

    // Nurse deletes flowsheet log
    const delLog = await call('DELETE', `/api/neonatal-seizures/episodes/${episodeId}/flowsheet/${logId}`, nurse);
    expect(delLog.status).toBe(200);

    // Doctor deletes episode -> 200 OK
    const docDel = await call('DELETE', `/api/neonatal-seizures/episodes/${episodeId}`, doctor);
    expect(docDel.status).toBe(200);
  });
});
