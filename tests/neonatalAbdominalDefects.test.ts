import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalAbdominalDefects } from '../web/src/neonatalAbdominalDefectsEngine.js';

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

describe('Neonatal Abdominal Wall Defects Engine (Pure Unit Tests)', () => {
  it('correctly stages Gastroschisis with edematous peel and staged silo reduction', () => {
    const res = evaluateNeonatalAbdominalDefects({
      defectType: 'gastroschisis',
      defectDiameterCm: 3.5,
      cordInsertionSite: 'normal_left_of_defect',
      membraneSacPresent: false,
      evisceratedOrgans: 'small_and_large_bowel',
      bowelCondition: 'edematous_fibrin_peel',
      closureApproach: 'staged_silo_reduction',
      siloType: 'preformed_spring_loaded_bedside',
      siloHeightCm: 8.0,
      currentBladderPressureMmHg: 8.5,
      peakInspiratoryPressureCmH2O: 16.0,
      beckwithWiedemannSuspected: false,
      cardiacEchoCompleted: true,
    });

    expect(res.defectClassification).toBe('gastroschisis');
    expect(res.iahGrade).toBe('normal');
    expect(res.isGiantDefect).toBe(false);
    expect(res.hasLiverEvisceration).toBe(false);
    expect(res.fluidManagementDirectives.some((d) => d.includes('150-175 mL/kg/day'))).toBe(true);
    expect(res.bedsideSiloDirectives.some((d) => d.includes('Spring-loaded preformed silo'))).toBe(true);
  });

  it('triggers critical alert when bladder pressure >= 20 mmHg indicates Abdominal Compartment Syndrome (ACS)', () => {
    const res = evaluateNeonatalAbdominalDefects({
      defectType: 'gastroschisis',
      defectDiameterCm: 4.0,
      cordInsertionSite: 'normal_left_of_defect',
      membraneSacPresent: false,
      evisceratedOrgans: 'small_and_large_bowel',
      bowelCondition: 'edematous_fibrin_peel',
      closureApproach: 'staged_silo_reduction',
      siloType: 'preformed_spring_loaded_bedside',
      siloHeightCm: 4.0,
      currentBladderPressureMmHg: 21.5,
      peakInspiratoryPressureCmH2O: 24.0,
      beckwithWiedemannSuspected: false,
      cardiacEchoCompleted: true,
    });

    expect(res.iahGrade).toBe('grade_4_compartment_syndrome');
    expect(res.isCompartmentSyndromeRisk).toBe(true);
    expect(res.urgencyTier).toBe('emergency_acs_or_compromise');
    expect(res.alerts.some((a) => a.includes('Abdominal Compartment Syndrome'))).toBe(true);
  });

  it('evaluates giant Omphalocele with liver evisceration, Beckwith-Wiedemann risk, and cardiac screening', () => {
    const res = evaluateNeonatalAbdominalDefects({
      defectType: 'omphalocele_intact',
      defectDiameterCm: 6.5,
      cordInsertionSite: 'sac_apex',
      membraneSacPresent: true,
      evisceratedOrgans: 'bowel_and_liver',
      bowelCondition: 'healthy_normal_peristalsis',
      closureApproach: 'staged_silo_reduction',
      siloType: 'surgically_fashioned_dacron_silo',
      siloHeightCm: 10.0,
      currentBladderPressureMmHg: 9.0,
      peakInspiratoryPressureCmH2O: 15.0,
      beckwithWiedemannSuspected: true,
      cardiacEchoCompleted: false,
    });

    expect(res.isGiantDefect).toBe(true);
    expect(res.hasLiverEvisceration).toBe(true);
    expect(res.alerts.some((a) => a.includes('Extracorporeal liver'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('Beckwith-Wiedemann'))).toBe(true);
    expect(res.anomaliesScreeningDirectives.some((d) => d.includes('Congenital heart defects'))).toBe(true);
  });
});

describe('Neonatal Abdominal Wall Defects Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatric',
      fullName: 'Dr. Suresh PedsSurgeon',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Nurse Preeti NICU',
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
      fullName: 'Attender Ram',
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
      fullName: 'Baby of Kavita',
      dateOfBirth: '2026-11-08',
      phone: '9876543210',
      address: 'NICU Bed 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, create episode, update, and log silo flowsheet', async () => {
    // 1. Evaluate preview
    const preview = await call('POST', '/api/neonatal-abdominal-defects/evaluate', doctor, {
      defectType: 'gastroschisis',
      defectDiameterCm: 3.5,
      cordInsertionSite: 'normal_left_of_defect',
      evisceratedOrgans: 'small_and_large_bowel',
      bowelCondition: 'edematous_fibrin_peel',
      closureApproach: 'staged_silo_reduction',
      currentBladderPressureMmHg: 8.0,
      peakInspiratoryPressureCmH2O: 16.0,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.defectClassification).toBe('gastroschisis');

    // 2. Create episode
    const created = await call('POST', '/api/neonatal-abdominal-defects/episodes', doctor, {
      patientId,
      defectType: 'gastroschisis',
      defectDiameterCm: 3.5,
      cordInsertionSite: 'normal_left_of_defect',
      membraneSacPresent: false,
      evisceratedOrgans: 'small_and_large_bowel',
      bowelCondition: 'edematous_fibrin_peel',
      closureApproach: 'staged_silo_reduction',
      siloType: 'preformed_spring_loaded_bedside',
      siloHeightCm: 8.0,
      currentBladderPressureMmHg: 8.0,
      peakInspiratoryPressureCmH2O: 16.0,
      beckwithWiedemannSuspected: false,
      cardiacEchoCompleted: true,
      status: 'initial_stabilization_silo_placement',
      clinicalNotes: 'Preformed spring-loaded silo placed at bedside.',
    });
    expect(created.status).toBe(200);
    const episodeId = created.body.episode.id;
    expect(episodeId).toBeDefined();

    // 3. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/neonatal-abdominal-defects/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T08:00:00',
      dayOfReduction: 1,
      siloHeightReducedCm: 1.0,
      residualSiloHeightCm: 7.0,
      bladderPressureMmHg: 9.0,
      peakInspiratoryPressureCmH2O: 17.0,
      urineOutputMlKgHr: 2.5,
      lowerExtremityPerfusion: 'warm_pink_pulses_brisk',
      bowelVisceralColor: 'pink_viable',
      heartRate: 140,
      respiratoryRate: 42,
      meanArterialPressureMmHg: 44,
      notes: '1 cm reduction completed without compromise.',
    });
    expect(logRes.status).toBe(200);
    expect(logRes.body.flowsheetLog.residual_silo_height_cm).toBe(7.0);

    // 4. Get episode details
    const getRes = await call('GET', `/api/neonatal-abdominal-defects/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.flowsheetLogs.length).toBe(1);
    expect(getRes.body.episode.silo_height_cm).toBe(7.0);
    expect(getRes.body.episode.current_bladder_pressure_mmhg).toBe(9.0);

    // 5. Update status
    const statusRes = await call('PATCH', `/api/neonatal-abdominal-defects/episodes/${episodeId}/status`, doctor, {
      status: 'active_daily_serial_reduction',
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('active_daily_serial_reduction');
  });

  it('rejects attender role from managing abdominal wall defect protocols', async () => {
    const res = await call('POST', '/api/neonatal-abdominal-defects/episodes', attender, {
      patientId,
      defectType: 'gastroschisis',
      defectDiameterCm: 3.0,
      cordInsertionSite: 'normal_left_of_defect',
      membraneSacPresent: false,
      evisceratedOrgans: 'small_and_large_bowel',
      bowelCondition: 'healthy_normal_peristalsis',
      closureApproach: 'primary_bedside_sutureless',
      siloType: 'none',
      currentBladderPressureMmHg: 7.0,
      peakInspiratoryPressureCmH2O: 15.0,
    });
    expect(res.status).toBe(403);
  });
});
