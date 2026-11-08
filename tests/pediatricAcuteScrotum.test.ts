import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricAcuteScrotum } from '../web/src/pediatricAcuteScrotumEngine.js';

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

describe('Pediatric Acute Scrotum & TWIST Score Engine (Pure Unit Tests)', () => {
  it('evaluates high-risk TWIST score (7/7) in golden salvage window mandating immediate OR exploration', () => {
    const res = evaluatePediatricAcuteScrotum({
      ageYears: 12.0,
      affectedSide: 'left',
      symptomDurationHours: 2.5,
      twistTestisSwelling: 2,
      twistHardTestis: 2,
      twistAbsentCremastericReflex: 1,
      twistNauseaVomiting: 1,
      twistHighRidingTestis: 1,
      dopplerUltrasoundPerformed: false,
      dopplerFindings: 'not_performed',
      manualDetorsionAttempted: true,
      surgicalExplorationPerformed: true,
      intraoperativeFindings: 'viable_testis_after_detorsion',
      bilateralOrchiopexyPerformed: true,
    });

    expect(res.twistScoreTotal).toBe(7);
    expect(res.twistRiskCategory).toBe('high_risk');
    expect(res.isImmediateSurgeryMandated).toBe(true);
    expect(res.isGoldenWindowActive).toBe(true);
    expect(res.alerts.some((a) => a.includes('EMERGENCY: TWIST score'))).toBe(true);
    expect(res.preoperativeDirectives.some((d) => d.includes('manual detorsion'))).toBe(true);
    expect(res.surgicalExplorationDirectives.some((d) => d.includes('3-point dartos pouch orchiopexy'))).toBe(true);
  });

  it('indicates emergent color Doppler duplex ultrasound for intermediate risk TWIST score (3/7)', () => {
    const res = evaluatePediatricAcuteScrotum({
      ageYears: 10.0,
      affectedSide: 'right',
      symptomDurationHours: 8.0, // Past golden window
      twistTestisSwelling: 2,
      twistHardTestis: 0,
      twistAbsentCremastericReflex: 0,
      twistNauseaVomiting: 0,
      twistHighRidingTestis: 1,
      dopplerUltrasoundPerformed: false,
      dopplerFindings: 'not_performed',
      manualDetorsionAttempted: false,
      surgicalExplorationPerformed: false,
      intraoperativeFindings: 'preop_evaluation',
      bilateralOrchiopexyPerformed: false,
    });

    expect(res.twistScoreTotal).toBe(3);
    expect(res.twistRiskCategory).toBe('intermediate_risk');
    expect(res.isDopplerUltrasoundIndicated).toBe(true);
    expect(res.isImmediateSurgeryMandated).toBe(false);
    expect(res.isGoldenWindowActive).toBe(false);
    expect(res.recommendations.some((r) => r.includes('Doppler duplex ultrasound indicated'))).toBe(true);
  });

  it('triggers critical alert when unilateral surgery is done without bilateral orchiopexy', () => {
    const res = evaluatePediatricAcuteScrotum({
      ageYears: 14.0,
      affectedSide: 'left',
      symptomDurationHours: 4.0,
      twistTestisSwelling: 2,
      twistHardTestis: 2,
      twistAbsentCremastericReflex: 1,
      twistNauseaVomiting: 1,
      twistHighRidingTestis: 0,
      dopplerUltrasoundPerformed: false,
      dopplerFindings: 'not_performed',
      manualDetorsionAttempted: false,
      surgicalExplorationPerformed: true,
      intraoperativeFindings: 'viable_testis_after_detorsion',
      bilateralOrchiopexyPerformed: false, // VIOLATION
    });

    expect(res.twistScoreTotal).toBe(6);
    expect(res.alerts.some((a) => a.includes('Contralateral orchiopexy was not performed'))).toBe(true);
    expect(res.surgicalExplorationDirectives.some((d) => d.includes('Bell-clapper deformity is bilateral'))).toBe(true);
  });
});

describe('Pediatric Acute Scrotum Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.urology',
      fullName: 'Dr. Vikram Pediatric Urologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.urology',
      fullName: 'Nurse Sunita PACU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.urology', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.urology', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.scrotum',
      fullName: 'Attender Manoj',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.scrotum', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.scrotum', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Patel',
      dateOfBirth: '2015-03-22',
      phone: '9876543203',
      address: 'Day Care Surgery Bed 2',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to create an acute scrotum episode and retrieve calculated evaluation', async () => {
    const res = await call('POST', '/api/pediatric-acute-scrotum/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageYears: 11.5,
      affectedSide: 'left',
      symptomDurationHours: 2.0,
      twistTestisSwelling: 2,
      twistHardTestis: 2,
      twistAbsentCremastericReflex: 1,
      twistNauseaVomiting: 1,
      twistHighRidingTestis: 1,
      dopplerUltrasoundPerformed: false,
      dopplerFindings: 'not_performed',
      manualDetorsionAttempted: true,
      surgicalExplorationPerformed: true,
      intraoperativeFindings: 'viable_testis_after_detorsion',
      bilateralOrchiopexyPerformed: true,
      status: 'postop_scrotal_support_recovery',
      clinicalNotes: 'Testicular torsion detorted, bilateral dartos pouch orchiopexy complete.',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.episode.episode_code).toMatch(/^TWIST-\d+-\d+/);
    const episodeId = res.body.episode.id;

    // Retrieve details
    const detail = await call('GET', `/api/pediatric-acute-scrotum/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.evaluation.twistScoreTotal).toBe(7);
    expect(detail.body.evaluation.twistRiskCategory).toBe('high_risk');
  });

  it('allows nurse to record flowsheet checkpoint and verifies audit event logging', async () => {
    const ep = await call('POST', '/api/pediatric-acute-scrotum/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageYears: 12.0,
      affectedSide: 'left',
      symptomDurationHours: 3.0,
      twistTestisSwelling: 2,
      twistHardTestis: 2,
      twistAbsentCremastericReflex: 1,
      twistNauseaVomiting: 0,
      twistHighRidingTestis: 1,
      dopplerUltrasoundPerformed: false,
      dopplerFindings: 'not_performed',
      manualDetorsionAttempted: false,
      surgicalExplorationPerformed: true,
      intraoperativeFindings: 'viable_testis_after_detorsion',
      bilateralOrchiopexyPerformed: true,
      status: 'in_operating_room_exploration',
    });
    const episodeId = ep.body.episode.id;

    const logRes = await call('POST', `/api/pediatric-acute-scrotum/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:00:00',
      hoursFromPresentation: 3.0,
      painScoreFlaccOrVas: 3,
      scrotalEdemaErythema: 'mild',
      cremastericReflexStatus: 'sluggish',
      woundDressingClean: true,
      ambulationStatus: 'bedrest_scrotal_elevation',
      notes: 'Bilateral dressings clean and dry. Scrotal elevation support maintained.',
    });

    expect([200, 201]).toContain(logRes.status);
    expect(logRes.body.flowsheetLog.pain_score_flacc_or_vas).toBe(3);

    // Verify audit event
    const auditRow = db.prepare(`
      SELECT * FROM audit_events WHERE action = 'pediatric_acute_scrotum.flowsheet_add'
    `).get() as any;
    expect(auditRow).toBeDefined();
  });

  it('blocks attender with 403 Forbidden', async () => {
    const res = await call('POST', '/api/pediatric-acute-scrotum/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageYears: 10.0,
      affectedSide: 'right',
      symptomDurationHours: 4.0,
      twistTestisSwelling: 2,
      twistHardTestis: 0,
      twistAbsentCremastericReflex: 0,
      twistNauseaVomiting: 0,
      twistHighRidingTestis: 0,
      dopplerUltrasoundPerformed: false,
      dopplerFindings: 'not_performed',
      manualDetorsionAttempted: false,
      surgicalExplorationPerformed: false,
      intraoperativeFindings: 'preop_evaluation',
      bilateralOrchiopexyPerformed: false,
    });
    expect(res.status).toBe(403);
  });
});
