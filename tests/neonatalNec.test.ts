import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  classifyBellStage,
  evaluateNeonatalNec,
} from '../web/src/neonatalNecEngine.js';

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
describe('Neonatal NEC & Bell Staging Engine (Pure Unit Tests)', () => {
  it('correctly classifies Modified Bell stages from clinical, abdominal, and radiologic findings', () => {
    // Stage IA: Suspected NEC (nonspecific residuals, distension)
    expect(
      classifyBellStage({
        gestationalAgeWeeks: 28,
        birthWeightGrams: 1100,
        currentWeightGrams: 1100,
        temperatureInstability: true,
        lethargyHypotonia: true,
        gastricResidualsPercent: 30,
        abdominalDistension: true,
      }),
    ).toBe('stage_1a_suspected');

    // Stage IB: Suspected NEC with gross hematochezia
    expect(
      classifyBellStage({
        gestationalAgeWeeks: 28,
        birthWeightGrams: 1100,
        currentWeightGrams: 1100,
        apneaBradycardia: true,
        grossHematochezia: true,
        abdominalDistension: true,
      }),
    ).toBe('stage_1b_suspected');

    // Stage IIA: Definite mild NEC (pneumatosis intestinalis)
    expect(
      classifyBellStage({
        gestationalAgeWeeks: 28,
        birthWeightGrams: 1100,
        currentWeightGrams: 1100,
        lethargyHypotonia: true,
        radiographicPneumatosis: true,
      }),
    ).toBe('stage_2a_definite_mild');

    // Stage IIB: Definite moderate NEC (portal venous gas, abdominal wall erythema)
    expect(
      classifyBellStage({
        gestationalAgeWeeks: 28,
        birthWeightGrams: 1100,
        currentWeightGrams: 1100,
        radiographicPortalVenousGas: true,
        abdominalWallErythemaOrInduration: true,
      }),
    ).toBe('stage_2b_definite_moderate');

    // Stage IIIA: Advanced intact NEC (hypotension/shock, severe acidosis, thrombocytopenia)
    expect(
      classifyBellStage({
        gestationalAgeWeeks: 28,
        birthWeightGrams: 1100,
        currentWeightGrams: 1100,
        hypotensionShock: true,
        abgPh: 7.15,
        plateletCount: 40000,
      }),
    ).toBe('stage_3a_advanced_intact');

    // Stage IIIB: Advanced perforated NEC (pneumoperitoneum)
    expect(
      classifyBellStage({
        gestationalAgeWeeks: 28,
        birthWeightGrams: 1100,
        currentWeightGrams: 1100,
        radiographicPneumoperitoneum: true,
      }),
    ).toBe('stage_3b_advanced_perforated');
  });

  it('evaluates comprehensive NEC decision recommendations including surgical triggers and antibiotics', () => {
    const evaluation = evaluateNeonatalNec({
      gestationalAgeWeeks: 27,
      birthWeightGrams: 920,
      currentWeightGrams: 950,
      radiographicPneumoperitoneum: true,
      abgPh: 7.12,
      baseExcess: -12,
      plateletCount: 35000,
      hypotensionShock: true,
    });

    expect(evaluation.bellStage).toBe('stage_3b_advanced_perforated');
    expect(evaluation.surgicalInterventionIndicated).toBe(true);
    expect(evaluation.surgicalUrgency).toBe('emergency_surgical_intervention');
    expect(evaluation.recommendedNpoDaysMax).toBe(14);
    expect(evaluation.recommendedAntibiotics.some((a) => a.includes('Ampicillin'))).toBe(true);
    expect(evaluation.recommendedAntibiotics.some((a) => a.includes('Metronidazole'))).toBe(true);
    expect(evaluation.clinicalAlerts.some((a) => a.includes('EMERGENCY'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal NEC REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. Sarah Smith (Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Nurse Karen NICU',
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
      username: 'attender.desk',
      fullName: 'NICU Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.desk', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.desk', PW);

    // Preterm infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Ananya (Preterm 28w)',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 33333',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create a neonatal NEC episode and verifies audit logging', async () => {
    const payload = {
      patientId,
      onsetDatetime: '2026-11-07T08:00:00',
      gestationalAgeWeeks: 28,
      birthWeightGrams: 1050,
      currentWeightGrams: 1100,
      temperatureInstability: true,
      lethargyHypotonia: true,
      gastricResidualsPercent: 40,
      abdominalDistension: true,
      radiographicPneumatosis: true,
      plateletCount: 88000,
      abgPh: 7.28,
      baseExcess: -6.5,
      npoActive: true,
      surgicalConsultStatus: 'consulted_medical_management',
      status: 'active_medical_management',
      clinicalNotes: 'Initiated 10-day NPO with triple intravenous antibiotics.',
    };

    const res = await call('POST', '/api/neonatal-nec/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.bell_stage).toBe('stage_2b_definite_moderate');

    // Verify audit log
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'neonatal_nec.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record serial abdominal girth & flowsheet observations', async () => {
    const epRes = await call('POST', '/api/neonatal-nec/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 29,
      birthWeightGrams: 1200,
      currentWeightGrams: 1220,
      lethargyHypotonia: true,
      abdominalDistension: true,
      radiographicPneumatosis: true,
      status: 'active_medical_management',
    });
    const epId = epRes.body.episode.id;

    // Nurse records 6-hour bedside observation
    const fsRes = await call('POST', `/api/neonatal-nec/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T12:00:00',
      hoursFromOnset: 6,
      abdominalGirthCm: 24.5,
      gastricResidualVolumeMl: 4.5,
      gastricResidualCharacter: 'bilious',
      bowelSounds: 'hypoactive',
      abdominalWallAppearance: 'erythematous',
      notes: 'Abdominal wall mildly erythematous around umbilicus. Surgical team notified.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();

    // Fetch episode detail
    const detail = await call('GET', `/api/neonatal-nec/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].abdominal_girth_cm).toBe(24.5);
  });

  it('allows doctor to update episode status and delete records', async () => {
    const epRes = await call('POST', '/api/neonatal-nec/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 30,
      birthWeightGrams: 1350,
      currentWeightGrams: 1380,
      temperatureInstability: true,
      abdominalDistension: true,
      status: 'evaluating',
    });
    const epId = epRes.body.episode.id;

    // Doctor updates episode to resolved
    const patchRes = await call('PATCH', `/api/neonatal-nec/episodes/${epId}`, doctor, {
      status: 'resolved_feeding_restarted',
      clinicalNotes: 'Feeds restarted slowly with maternal colostrum. Girth stable.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('resolved_feeding_restarted');

    // Doctor deletes episode
    const delRes = await call('DELETE', `/api/neonatal-nec/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/neonatal-nec/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating NEC episodes', async () => {
    const res = await call('POST', '/api/neonatal-nec/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-07T06:00:00',
      gestationalAgeWeeks: 30,
      birthWeightGrams: 1350,
      currentWeightGrams: 1380,
    });
    expect(res.status).toBe(403);
  });
});
