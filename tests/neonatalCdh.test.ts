import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalCdh } from '../web/src/neonatalCdhEngine.js';

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

describe('Neonatal CDH & Gentle Ventilation Engine (Pure Unit Tests)', () => {
  it('evaluates severe pulmonary hypoplasia with liver-up herniation and ductal shunting', () => {
    const res = evaluateNeonatalCdh({
      defectSide: 'left_bochdalek',
      liverHerniationUp: true,
      observedExpectedLhrPercent: 21.0,
      bagMaskAvoidedInDeliveryRoom: true,
      replogleSumpDecompressionActive: true,
      preductalSpo2Percent: 94,
      postductalSpo2Percent: 80,
      peakInspiratoryPressureCmh2o: 23,
      peepCmh2o: 4.5,
      paco2Mmhg: 58,
      inhaledNitricOxideActive: true,
      sildenafilInfusionActive: true,
      surgicalRepairStatus: 'preop_physiological_stabilization',
    });

    expect(res.hypoplasiaSeverity).toBe('extreme_severe');
    expect(res.isLiverUp).toBe(true);
    expect(res.ductalGradientPercent).toBe(14);
    expect(res.hasSignificantPphnShunt).toBe(true);
    expect(res.isGentleVentilationCompliant).toBe(true);
    expect(res.isPermissiveHypercapniaAchieved).toBe(true);
    expect(res.alerts.some((a) => a.includes('CRITICAL PULMONARY HYPOPLASIA'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('INTRATHORACIC LIVER HERNIATION'))).toBe(true);
    expect(res.deliveryRoomDirectives.some((d) => d.includes('bag-valve-mask'))).toBe(true);
    expect(res.gentleVentilationDirectives.some((d) => d.includes('PIP < 25 cmH2O'))).toBe(true);
  });

  it('triggers critical alert when bag-valve-mask is inadvertently used in delivery room', () => {
    const res = evaluateNeonatalCdh({
      defectSide: 'left_bochdalek',
      liverHerniationUp: false,
      observedExpectedLhrPercent: 38.0,
      bagMaskAvoidedInDeliveryRoom: false, // VIOLATION
      replogleSumpDecompressionActive: false,
      preductalSpo2Percent: 92,
      postductalSpo2Percent: 90,
      peakInspiratoryPressureCmh2o: 28, // High PIP
      peepCmh2o: 4.0,
      paco2Mmhg: 45,
      inhaledNitricOxideActive: false,
      sildenafilInfusionActive: false,
      surgicalRepairStatus: 'preop_physiological_stabilization',
    });

    expect(res.alerts.some((a) => a.includes('CATASTROPHIC VIOLATION: Bag-mask ventilation is strictly contraindicated'))).toBe(true);
    expect(res.isGentleVentilationCompliant).toBe(false);
    expect(res.alerts.some((a) => a.includes('BAROTRAUMA ALERT'))).toBe(true);
  });

  it('confirms physiological readiness criteria met for delayed surgical repair', () => {
    const res = evaluateNeonatalCdh({
      defectSide: 'left_bochdalek',
      liverHerniationUp: false,
      observedExpectedLhrPercent: 36.0,
      bagMaskAvoidedInDeliveryRoom: true,
      replogleSumpDecompressionActive: true,
      preductalSpo2Percent: 97,
      postductalSpo2Percent: 93, // >= 85%
      peakInspiratoryPressureCmh2o: 21, // < 25
      peepCmh2o: 4.0,
      paco2Mmhg: 52,
      inhaledNitricOxideActive: true,
      sildenafilInfusionActive: false,
      surgicalRepairStatus: 'ready_for_repair_criteria_met',
    });

    expect(res.isPhysiologicallyReadyForSurgery).toBe(true);
    expect(res.ductalGradientPercent).toBe(4);
    expect(res.hasSignificantPphnShunt).toBe(false);
    expect(res.readinessCriteriaStatus).toContain('CRITERIA MET');
  });
});

describe('Neonatal CDH Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.nicu',
      fullName: 'Dr. Anita Neonatologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.cdh',
      fullName: 'Nurse Kavita NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.cdh', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.cdh', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.cdh',
      fullName: 'Attender Suresh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.cdh', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.cdh', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Radhika',
      dateOfBirth: '2026-11-08',
      phone: '9876543201',
      address: 'NICU Pod 1',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to create a CDH episode and retrieve calculated evaluation', async () => {
    const res = await call('POST', '/api/neonatal-cdh/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageHours: 4,
      weightKg: 3.1,
      defectSide: 'left_bochdalek',
      liverHerniationUp: true,
      observedExpectedLhrPercent: 24.0,
      bagMaskAvoidedInDeliveryRoom: true,
      replogleSumpDecompressionActive: true,
      preductalSpo2Percent: 93,
      postductalSpo2Percent: 81,
      peakInspiratoryPressureCmh2o: 23,
      peepCmh2o: 4.5,
      paco2Mmhg: 62,
      inhaledNitricOxideActive: true,
      sildenafilInfusionActive: true,
      surgicalRepairStatus: 'preop_physiological_stabilization',
      status: 'preop_gentle_ventilation',
      clinicalNotes: 'Antenatal left CDH, intubated at delivery with 10 Fr Replogle sump active.',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.episode.episode_code).toMatch(/^CDH-\d+-\d+/);
    const episodeId = res.body.episode.id;

    // Retrieve details
    const detail = await call('GET', `/api/neonatal-cdh/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.evaluation.isLiverUp).toBe(true);
    expect(detail.body.evaluation.hypoplasiaSeverity).toBe('extreme_severe');
  });

  it('allows nurse to record flowsheet checkpoint and verifies audit event logging', async () => {
    const ep = await call('POST', '/api/neonatal-cdh/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageHours: 2,
      weightKg: 2.9,
      defectSide: 'left_bochdalek',
      liverHerniationUp: false,
      observedExpectedLhrPercent: 30.0,
      bagMaskAvoidedInDeliveryRoom: true,
      replogleSumpDecompressionActive: true,
      preductalSpo2Percent: 94,
      postductalSpo2Percent: 86,
      peakInspiratoryPressureCmh2o: 22,
      peepCmh2o: 4.5,
      paco2Mmhg: 54,
      inhaledNitricOxideActive: true,
      sildenafilInfusionActive: false,
      surgicalRepairStatus: 'preop_physiological_stabilization',
      status: 'preop_gentle_ventilation',
    });
    const episodeId = ep.body.episode.id;

    const logRes = await call('POST', `/api/neonatal-cdh/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T05:00:00',
      hoursFromAdmission: 2,
      pipCmh2o: 22.0,
      peepCmh2o: 4.5,
      fio2Percent: 45.0,
      preductalSpo2: 95,
      postductalSpo2: 88,
      arterialPh: 7.31,
      paco2Mmhg: 56.0,
      lactateMmolL: 1.8,
      meanArterialPressureMmhg: 44.0,
      inoPpm: 20.0,
      notes: 'Permissive hypercapnia well tolerated; ductal gradient narrowed to 7%.',
    });

    expect([200, 201]).toContain(logRes.status);
    expect(logRes.body.flowsheetLog.pip_cmh2o).toBe(22.0);

    // Verify audit event
    const auditRow = db.prepare(`
      SELECT * FROM audit_events WHERE action = 'neonatal_cdh.flowsheet_add'
    `).get() as any;
    expect(auditRow).toBeDefined();
  });

  it('blocks attender with 403 Forbidden', async () => {
    const res = await call('POST', '/api/neonatal-cdh/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageHours: 4,
      weightKg: 3.1,
      defectSide: 'left_bochdalek',
      liverHerniationUp: false,
      observedExpectedLhrPercent: 32.0,
      bagMaskAvoidedInDeliveryRoom: true,
      replogleSumpDecompressionActive: true,
      preductalSpo2Percent: 92,
      postductalSpo2Percent: 86,
      peakInspiratoryPressureCmh2o: 23,
      peepCmh2o: 4.5,
      paco2Mmhg: 55,
      inhaledNitricOxideActive: false,
      sildenafilInfusionActive: false,
    });
    expect(res.status).toBe(403);
  });
});
