import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  classifyMcnamaraEchoStage,
  classifyMcnamaraClinicalStage,
  evaluateNeonatalHspda,
} from '../web/src/neonatalHspdaEngine.js';

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
describe('Neonatal hsPDA & McNamara Staging Engine (Pure Unit Tests)', () => {
  it('correctly stages echocardiographic shunt by McNamara & Sehgal criteria', () => {
    // Stage 1 (Mild): duct <= 1.5mm, normal diastolic flow, la:ao < 1.4, weight 1200g
    expect(classifyMcnamaraEchoStage(1.2, 1.2, 'antegrade_normal', 1200)).toBe('stage_1_mild');

    // Stage 2 (Moderate): duct 1.8mm, absent diastolic flow, la:ao 1.45, weight 1500g
    expect(classifyMcnamaraEchoStage(1.8, 1.45, 'absent_diastolic', 1500)).toBe('stage_2_moderate');

    // Stage 3 (Severe): duct >= 2.0mm, retrograde steal, la:ao >= 1.5, weight 900g
    expect(classifyMcnamaraEchoStage(2.4, 1.7, 'retrograde_steal', 900)).toBe('stage_3_severe');
  });

  it('correctly stages clinical compromise by McNamara criteria', () => {
    // Stage 1 (Mild): bounding pulses only (count = 1 sign)
    expect(classifyMcnamaraClinicalStage({ boundingPulses: true } as any)).toBe('stage_1_mild');

    // Stage 2 (Moderate): bounding pulses and cardiomegaly (count = 2 signs)
    expect(classifyMcnamaraClinicalStage({ boundingPulses: true, cardiomegalyPresent: true } as any)).toBe('stage_2_moderate');

    // Stage 3 (Severe): respiratory support escalation triggers critical stage
    expect(classifyMcnamaraClinicalStage({ respiratorySupportEscalation: true } as any)).toBe('stage_3_severe');
    expect(classifyMcnamaraClinicalStage({ metabolicAcidosis: true } as any)).toBe('stage_3_severe');
  });

  it('evaluates hsPDA, recommends IV Ibuprofen when NSAIDs are tolerated', () => {
    const res = evaluateNeonatalHspda({
      gestationalAgeWeeks: 27,
      birthWeightGrams: 900,
      chronologicalAgeDays: 4,
      currentWeightGrams: 880,
      ductalDiameterMm: 2.2,
      shuntDirection: 'left_to_right',
      laAoRatio: 1.6,
      descendingAortaDiastolicFlow: 'retrograde_steal',
      lpaDiastolicVelocityMs: 0.28,
      respiratorySupportEscalation: true,
      boundingPulses: true,
      plateletCount: 180000,
      serumCreatinineMgDl: 0.8,
      urineOutputMlKgHr: 2.0,
      activeNecOrGiBleed: false,
    });

    expect(res.hspdaConfirmed).toBe(true);
    expect(res.mcnamaraEchoStage).toBe('stage_3_severe');
    expect(res.mcnamaraClinicalStage).toBe('stage_3_severe');
    expect(res.nsaidContraindicated).toBe(false);
    expect(res.recommendedTherapy).toBe('iv_ibuprofen');
    expect(res.ibuprofenRegimen).toContain('IV Ibuprofen');
  });

  it('identifies NSAID contraindication (thrombocytopenia & renal compromise) and recommends IV Paracetamol', () => {
    const res = evaluateNeonatalHspda({
      gestationalAgeWeeks: 26,
      birthWeightGrams: 800,
      chronologicalAgeDays: 5,
      currentWeightGrams: 790,
      ductalDiameterMm: 2.5,
      shuntDirection: 'left_to_right',
      laAoRatio: 1.7,
      descendingAortaDiastolicFlow: 'retrograde_steal',
      respiratorySupportEscalation: true,
      plateletCount: 38000, // < 50,000 -> contraindication
      serumCreatinineMgDl: 1.8, // > 1.6 -> contraindication
      urineOutputMlKgHr: 0.4, // < 0.6 -> oliguria
      activeNecOrGiBleed: false,
    });

    expect(res.hspdaConfirmed).toBe(true);
    expect(res.nsaidContraindicated).toBe(true);
    expect(res.paracetamolRecommendedAsAlternative).toBe(true);
    expect(res.recommendedTherapy).toBe('iv_paracetamol');
    expect(res.paracetamolRegimen).toContain('15 mg/kg');
    expect(res.contraindicationReasons.length).toBeGreaterThanOrEqual(2);
  });

  it('triggers interventional cardiology / catheter closure criteria after refractory medical therapy', () => {
    const res = evaluateNeonatalHspda({
      gestationalAgeWeeks: 25,
      birthWeightGrams: 750,
      chronologicalAgeDays: 14,
      currentWeightGrams: 820,
      ductalDiameterMm: 2.6,
      shuntDirection: 'left_to_right',
      laAoRatio: 1.8,
      descendingAortaDiastolicFlow: 'retrograde_steal',
      respiratorySupportEscalation: true,
      metabolicAcidosis: true,
      priorMedicalCoursesCompleted: 2, // Failed 2 medical courses
    });

    expect(res.mcnamaraEchoStage).toBe('stage_3_severe');
    expect(res.mcnamaraClinicalStage).toBe('stage_3_severe');
    expect(res.surgicalOrCatheterReferralIndicated).toBe(true);
    expect(res.interventionalGuidance).toContain('Piccolo device');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal hsPDA REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.cardiologist',
      fullName: 'Dr. S. Kulkarni (Pediatric Cardiologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Staff Nurse Geeta (NICU)',
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
      fullName: 'Ward Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.desk', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.desk', PW);

    // Premature infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Kavita (26w hsPDA)',
      dateOfBirth: '2026-10-25',
      phone: '+91 98765 11111',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to preview calculation and create an hsPDA episode', async () => {
    // 1. Preview calculation
    const previewRes = await call('POST', '/api/neonatal-hspda/evaluate', doctor, {
      ductalDiameterMm: 2.3,
      laAoRatio: 1.6,
      descendingAortaDiastolicFlow: 'retrograde_steal',
      lpaDiastolicVelocityMs: 0.3,
      currentWeightGrams: 850,
      boundingPulses: true,
      respiratorySupportEscalation: true,
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.evalResult.hspdaConfirmed).toBe(true);

    // 2. Create episode
    const payload = {
      patientId,
      echoDatetime: '2026-11-08T09:00:00',
      gestationalAgeWeeks: 26,
      birthWeightGrams: 820,
      chronologicalAgeDays: 5,
      currentWeightGrams: 840,
      ductalDiameterMm: 2.3,
      shuntDirection: 'left_to_right',
      laAoRatio: 1.6,
      descendingAortaDiastolicFlow: 'retrograde_steal',
      lpaDiastolicVelocityMs: 0.3,
      respiratorySupportEscalation: true,
      boundingPulses: true,
      precordialHyperactivity: true,
      metabolicAcidosis: false,
      oliguriaPresent: false,
      pharmacotherapySelected: 'iv_paracetamol',
      interventionalReferral: 'none',
      status: 'medical_therapy_active',
      clinicalNotes: 'Commenced IV Paracetamol 15 mg/kg q6h in view of severe thrombocytopenia.',
    };

    const res = await call('POST', '/api/neonatal-hspda/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toMatch(/^PDA-/);
    expect(res.body.episode.hspda_confirmed).toBe(1);
    expect(res.body.evalResult).toBeDefined();

    const episodeId = res.body.episode.id;

    // 3. Nurse logs bedside flowsheet
    const logRes = await call('POST', `/api/neonatal-hspda/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T12:00:00',
      hoursFromInitiation: 3,
      heartRateBpm: 158,
      sbpMmhg: 62,
      dbpMmhg: 28,
      mapMmhg: 39,
      pulsePressureMmhg: 34,
      respiratorySupportType: 'HFOV',
      fio2Percent: 35,
      spo2Percent: 93,
      urineOutputMlKgHr: 1.6,
      plateletCount: 45000,
      notes: 'Paracetamol Dose 1 infused over 15 min.',
    });
    expect(logRes.status).toBe(201);
    expect(logRes.body.logId).toBeDefined();

    // 4. Get episode detail
    const detailRes = await call('GET', `/api/neonatal-hspda/episodes/${episodeId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.episode.id).toBe(episodeId);
    expect(detailRes.body.logs.length).toBe(1);
    expect(detailRes.body.evalResult.hspdaConfirmed).toBe(true);

    // 5. Delete flowsheet log and episode
    const flowsheetId = logRes.body.logId;
    const delFlowRes = await call('DELETE', `/api/neonatal-hspda/episodes/${episodeId}/flowsheet-logs/${flowsheetId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    const delEpRes = await call('DELETE', `/api/neonatal-hspda/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });

  it('enforces RBAC: attender cannot create episodes or log flowsheet', async () => {
    // First create an episode as doctor so we have a valid episodeId to test flowsheet permissions
    const epRes = await call('POST', '/api/neonatal-hspda/episodes', doctor, {
      patientId,
      echoDatetime: '2026-11-08T09:00:00',
      gestationalAgeWeeks: 26,
      birthWeightGrams: 820,
      chronologicalAgeDays: 5,
      currentWeightGrams: 840,
      ductalDiameterMm: 2.0,
      shuntDirection: 'left_to_right',
      laAoRatio: 1.5,
      descendingAortaDiastolicFlow: 'retrograde_steal',
      pharmacotherapySelected: 'iv_ibuprofen',
      interventionalReferral: 'none',
      status: 'echocardiographic_surveillance',
    });
    expect(epRes.status).toBe(201);
    const validEpId = epRes.body.episode.id;

    const resCreate = await call('POST', '/api/neonatal-hspda/episodes', attender, {
      patientId,
      echoDatetime: '2026-11-08T09:00:00',
      gestationalAgeWeeks: 26,
      birthWeightGrams: 820,
      chronologicalAgeDays: 5,
      currentWeightGrams: 840,
      ductalDiameterMm: 2.0,
      shuntDirection: 'left_to_right',
      laAoRatio: 1.5,
      descendingAortaDiastolicFlow: 'retrograde_steal',
      pharmacotherapySelected: 'iv_ibuprofen',
      interventionalReferral: 'none',
      status: 'echocardiographic_surveillance',
    });
    expect(resCreate.status).toBe(403);

    const resFlow = await call('POST', `/api/neonatal-hspda/episodes/${validEpId}/flowsheet-logs`, attender, {
      logDatetime: '2026-11-08T12:00:00',
      hoursFromInitiation: 1,
      heartRateBpm: 150,
      sbpMmhg: 60,
      dbpMmhg: 30,
      mapMmhg: 40,
      pulsePressureMmhg: 30,
      respiratorySupportType: 'CPAP',
      spo2Percent: 92,
    });
    expect(resFlow.status).toBe(403);
  });
});
