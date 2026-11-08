import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalMeconiumIleus } from '../web/src/neonatalMeconiumIleusEngine.js';

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

describe('Neonatal Meconium Ileus Engine (Pure Unit Tests)', () => {
  it('detects simple uncomplicated meconium ileus with disuse microcolon and directs dilute Gastrografin decompression', () => {
    const res = evaluateNeonatalMeconiumIleus({
      ageHours: 24,
      weightKg: 3.1,
      meconiumPassedYet: false,
      abdominalDistension: 'marked_tense',
      emesisCharacter: 'bilious_green',
      palpableDoughyMasses: true,
      familyHistoryCysticFibrosis: false,
      plainAbdominalXrayFindings: 'neuhauser_soap_bubble_sign',
      contrastEnemaPerformed: true,
      contrastEnemaType: 'gastrografin_dilute',
      microcolonConfirmed: true,
      meconiumPelletsVisualized: true,
      complicationPresent: 'uncomplicated_simple_ileus',
      enemaAttemptsCount: 1,
      enemaSuccessOutcome: 'successful_evacuation_reflux_into_ileum',
    });

    expect(res.isCysticFibrosisSuspected).toBe(true);
    expect(res.isComplicatedIleus).toBe(false);
    expect(res.surgeryIndicated).toBe(false);
    expect(res.urgencyTier).toBe('stable_monitoring_repeat');
    expect(res.gastrografinProtocolDirectives.some(d => d.includes('Gastrografin'))).toBe(true);
    expect(res.cysticFibrosisDirectives.some(d => d.includes('CFTR'))).toBe(true);
  });

  it('triggers immediate laparotomy and Bishop-Koop enterostomy for complicated ileus with perforation or volvulus', () => {
    const res = evaluateNeonatalMeconiumIleus({
      ageHours: 18,
      weightKg: 2.9,
      meconiumPassedYet: false,
      abdominalDistension: 'marked_tense',
      emesisCharacter: 'bilious_green',
      palpableDoughyMasses: true,
      familyHistoryCysticFibrosis: true,
      plainAbdominalXrayFindings: 'pneumoperitoneum_free_air',
      contrastEnemaPerformed: false,
      contrastEnemaType: 'none',
      microcolonConfirmed: true,
      meconiumPelletsVisualized: true,
      complicationPresent: 'perforation_free_air',
      enemaAttemptsCount: 0,
      enemaSuccessOutcome: 'not_attempted_surgery_first',
    });

    expect(res.isComplicatedIleus).toBe(true);
    expect(res.surgeryIndicated).toBe(true);
    expect(res.urgencyTier).toBe('immediate_laparotomy_crash');
    expect(res.recommendedProcedure).toContain('Bishop-Koop');
    expect(res.alerts.some(a => a.includes('SURGICAL RED ALERT'))).toBe(true);
  });

  it('indicates surgical intervention when non-operative enema decompression fails repeatedly', () => {
    const res = evaluateNeonatalMeconiumIleus({
      ageHours: 48,
      weightKg: 3.0,
      meconiumPassedYet: false,
      abdominalDistension: 'marked_tense',
      emesisCharacter: 'bilious_green',
      palpableDoughyMasses: true,
      familyHistoryCysticFibrosis: false,
      plainAbdominalXrayFindings: 'dilated_loops_no_fluid_levels',
      contrastEnemaPerformed: true,
      contrastEnemaType: 'gastrografin_dilute',
      microcolonConfirmed: true,
      meconiumPelletsVisualized: true,
      complicationPresent: 'uncomplicated_simple_ileus',
      enemaAttemptsCount: 3,
      enemaSuccessOutcome: 'failed_refractory_obstruction',
    });

    expect(res.surgeryIndicated).toBe(true);
    expect(res.urgencyTier).toBe('immediate_laparotomy_crash');
    expect(res.recommendedProcedure).toContain('Bishop-Koop');
  });
});

describe('Neonatal Meconium Ileus Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.mec',
      fullName: 'Dr. Tarun PediatricSurgeon',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.mec',
      fullName: 'Nurse Neha NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.mec', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.mec', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.mec',
      fullName: 'Attender Ajay',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.mec', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.mec', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Neonate of Radhika',
      dateOfBirth: '2026-11-07',
      phone: '9876543299',
      address: 'NICU Incubator 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview evaluation, create episode, update status, and log flowsheet with nurse', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/neonatal-meconium-ileus/evaluate', doctor, {
      ageHours: 24,
      weightKg: 3.1,
      meconiumPassedYet: false,
      abdominalDistension: 'marked_tense',
      emesisCharacter: 'bilious_green',
      palpableDoughyMasses: true,
      familyHistoryCysticFibrosis: false,
      plainAbdominalXrayFindings: 'neuhauser_soap_bubble_sign',
      contrastEnemaPerformed: true,
      contrastEnemaType: 'gastrografin_dilute',
      microcolonConfirmed: true,
      meconiumPelletsVisualized: true,
      complicationPresent: 'uncomplicated_simple_ileus',
      enemaAttemptsCount: 1,
      enemaSuccessOutcome: 'successful_evacuation_reflux_into_ileum',
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.urgencyTier).toBe('stable_monitoring_repeat');
    expect(preview.body.evaluation.isCysticFibrosisSuspected).toBe(true);

    // 2. Create episode
    const created = await call('POST', '/api/neonatal-meconium-ileus/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T04:00:00',
      ageHours: 24,
      weightKg: 3.1,
      meconiumPassedYet: false,
      abdominalDistension: 'marked_tense',
      emesisCharacter: 'bilious_green',
      palpableDoughyMasses: true,
      familyHistoryCysticFibrosis: false,
      plainAbdominalXrayFindings: 'neuhauser_soap_bubble_sign',
      contrastEnemaPerformed: true,
      contrastEnemaType: 'gastrografin_dilute',
      microcolonConfirmed: true,
      meconiumPelletsVisualized: true,
      complicationPresent: 'uncomplicated_simple_ileus',
      enemaAttemptsCount: 1,
      enemaSuccessOutcome: 'successful_evacuation_reflux_into_ileum',
      surgeryIndicated: false,
      surgicalProcedurePlanned: 'none_medical_decompression',
      cftrGeneMutationSent: true,
      pancreaticEnzymeReplacementStarted: false,
      status: 'initial_contrast_decompression',
      clinicalNotes: 'Successful reflux into dilated ileum under fluoroscopy with dilute Gastrografin 1:3.',
    });

    expect(created.status).toBe(201);
    expect(created.body.episodeCode).toMatch(/^MECIL-/);
    const episodeId = created.body.episodeId || created.body.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get episode details
    const detail = await call('GET', `/api/neonatal-meconium-ileus/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.plain_abdominal_xray_findings).toBe('neuhauser_soap_bubble_sign');
    expect(detail.body.evaluation.isCysticFibrosisSuspected).toBe(true);

    // 4. Update status with doctor
    const statusUpdate = await call('PATCH', `/api/neonatal-meconium-ileus/episodes/${episodeId}/status`, doctor, {
      status: 'resolved_normal_stooling',
      clinicalNotes: 'Patient stooling yellow transition meconium, feeds tolerated.',
    });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.success).toBe(true);

    // 5. Nurse adds flowsheet log
    const logAdd = await call('POST', `/api/neonatal-meconium-ileus/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-08T06:00:00',
      hoursFromOnset: 2.0,
      abdominalGirthCm: 31.0,
      gastricAspirateMl: 8.0,
      gastricAspirateColor: 'Light green',
      meconiumEvacuatedAmount: 'large_thick_meconium_plug',
      hydrationStatus: 'euvolemic',
      urineOutputMlKgHr: 2.5,
      serumSodiumMeqL: 139.0,
      heartRate: 146,
      notes: 'Passage of dark thick plug followed by loose stool.',
    });
    expect(logAdd.status).toBe(201);
    const logId = logAdd.body.id || logAdd.body.logId;
    expect(logId).toBeGreaterThan(0);

    // 6. Delete flowsheet log
    const logDel = await call('DELETE', `/api/neonatal-meconium-ileus/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(logDel.status).toBe(200);
    expect(logDel.body.success).toBe(true);
  });

  it('enforces RBAC preventing attender from creating meconium ileus episodes', async () => {
    const unauth = await call('POST', '/api/neonatal-meconium-ileus/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T04:00:00',
      ageHours: 24,
      weightKg: 3.1,
      meconiumPassedYet: false,
      abdominalDistension: 'marked_tense',
      emesisCharacter: 'bilious_green',
      plainAbdominalXrayFindings: 'neuhauser_soap_bubble_sign',
      contrastEnemaPerformed: false,
      contrastEnemaType: 'none',
      complicationPresent: 'uncomplicated_simple_ileus',
      enemaAttemptsCount: 0,
      enemaSuccessOutcome: 'not_attempted_surgery_first',
    });
    expect(unauth.status).toBe(403);
  });
});
