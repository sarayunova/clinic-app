import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalVolvulus } from '../web/src/neonatalVolvulusEngine.js';

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

describe('Neonatal Volvulus Engine (Pure Unit Tests)', () => {
  it('identifies immediate operating room crash when bilious emesis is accompanied by peritonitis or shock', () => {
    const res = evaluateNeonatalVolvulus({
      ageDays: 4,
      weightKg: 3.2,
      emesisColor: 'bilious_dark_green',
      abdominalDistension: 'mild_epigastric',
      abdominalTenderness: true,
      rectalBleedingMelena: true,
      peritonitisSigns: true,
      hemodynamicShock: true,
      serumLactateMmolL: 5.2,
      bloodPh: 7.21,
      plainRadiographFinding: 'distended_stomach_scant_distal_gas',
      upperGiContrastDone: false,
    });

    expect(res.isBiliousEmesis).toBe(true);
    expect(res.isBowelIschemiaSuspected).toBe(true);
    expect(res.urgencyTier).toBe('immediate_operating_room_crash');
    expect(res.laddProcedureIndicated).toBe(true);
    expect(res.alerts.some(a => a.includes('SURGICAL RED ALERT'))).toBe(true);
    expect(res.imagingRecommendation).toContain('BYPASS CONTRAST IMAGING');
  });

  it('identifies confirmed malrotation and volvulus when corkscrew duodenum sign is positive on UGI', () => {
    const res = evaluateNeonatalVolvulus({
      ageDays: 6,
      weightKg: 3.4,
      emesisColor: 'bilious_light_green_yellow',
      abdominalDistension: 'mild_epigastric',
      abdominalTenderness: true,
      rectalBleedingMelena: false,
      peritonitisSigns: false,
      hemodynamicShock: false,
      serumLactateMmolL: 2.1,
      plainRadiographFinding: 'normal_gas_pattern',
      upperGiContrastDone: true,
      upperGiFinding: 'corkscrew_duodenum_positive',
      dopplerUsWhirlpoolSign: true,
      dopplerSmaSmvInversion: true,
    });

    expect(res.isBiliousEmesis).toBe(true);
    expect(res.urgencyTier).toBe('immediate_operating_room_crash');
    expect(res.laddProcedureIndicated).toBe(true);
    expect(res.alerts.some(a => a.includes('CONFIRMED VOLVULUS'))).toBe(true);
    expect(res.recommendations.some(r => r.includes('Ladd procedure'))).toBe(true);
  });

  it('orders urgent Upper GI series when neonate presents with bilious vomiting but no peritonitis or shock', () => {
    const res = evaluateNeonatalVolvulus({
      ageDays: 3,
      weightKg: 3.1,
      emesisColor: 'bilious_dark_green',
      abdominalDistension: 'absent_scaphoid',
      abdominalTenderness: false,
      rectalBleedingMelena: false,
      peritonitisSigns: false,
      hemodynamicShock: false,
      serumLactateMmolL: 1.4,
      plainRadiographFinding: 'normal_gas_pattern',
      upperGiContrastDone: false,
    });

    expect(res.isBiliousEmesis).toBe(true);
    expect(res.urgencyTier).toBe('emergent_imaging_workup');
    expect(res.laddProcedureIndicated).toBe(false);
    expect(res.imagingRecommendation).toContain('Upper Gastrointestinal (UGI) Contrast Fluoroscopy');
    expect(res.alerts.some(a => a.includes('CARDINAL SURGICAL SIGN'))).toBe(true);
  });
});

describe('Neonatal Volvulus Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.volv',
      fullName: 'Dr. Priya PediatricSurgeon',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.volv',
      fullName: 'Nurse Nisha NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.volv', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.volv', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.volv',
      fullName: 'Attender Anil',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.volv', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.volv', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Infant Boy of Lakshmi',
      dateOfBirth: '2026-11-04',
      phone: '9876543210',
      address: 'NICU Bed 3',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview evaluation and create an active volvulus episode', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/neonatal-volvulus/evaluate', doctor, {
      ageDays: 4,
      weightKg: 3.2,
      emesisColor: 'bilious_dark_green',
      abdominalDistension: 'mild_epigastric',
      abdominalTenderness: true,
      rectalBleedingMelena: false,
      peritonitisSigns: false,
      hemodynamicShock: false,
      serumLactateMmolL: 2.2,
      plainRadiographFinding: 'distended_stomach_scant_distal_gas',
      upperGiContrastDone: true,
      upperGiFinding: 'corkscrew_duodenum_positive',
      dopplerUsWhirlpoolSign: true,
      dopplerSmaSmvInversion: true,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.urgencyTier).toBe('immediate_operating_room_crash');
    expect(preview.body.evaluation.laddProcedureIndicated).toBe(true);

    // 2. Create episode
    const created = await call('POST', '/api/neonatal-volvulus/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T04:00:00',
      ageDays: 4,
      weightKg: 3.2,
      emesisColor: 'bilious_dark_green',
      abdominalDistension: 'mild_epigastric',
      abdominalTenderness: true,
      rectalBleedingMelena: false,
      peritonitisSigns: false,
      hemodynamicShock: false,
      serumLactateMmolL: 2.2,
      bloodPh: 7.33,
      baseExcessMeqL: -3.5,
      plainRadiographFinding: 'distended_stomach_scant_distal_gas',
      upperGiContrastDone: true,
      upperGiFinding: 'corkscrew_duodenum_positive',
      dopplerUsWhirlpoolSign: true,
      dopplerSmaSmvInversion: true,
      status: 'in_operating_room_ladd',
      clinicalNotes: 'Pathognomonic corkscrew sign confirmed. Ladd procedure underway.',
    });

    expect(created.status).toBe(201);
    expect(created.body.episodeCode).toMatch(/^VOLV-/);
    const episodeId = created.body.episodeId || created.body.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get episode details
    const detail = await call('GET', `/api/neonatal-volvulus/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.emesis_color).toBe('bilious_dark_green');
    expect(detail.body.evaluation.laddProcedureIndicated).toBe(true);

    // 4. Update status with doctor
    const statusUpdate = await call('PATCH', `/api/neonatal-volvulus/episodes/${episodeId}/status`, doctor, {
      status: 'post_op_bowel_recovery',
      clinicalNotes: 'Bowel derotated 720 degrees, Ladd bands divided, viability intact.',
    });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.success).toBe(true);

    // 5. Nurse adds flowsheet log
    const logAdd = await call('POST', `/api/neonatal-volvulus/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:00:00',
      hoursFromOnset: 2.0,
      serumLactateMmolL: 1.8,
      heartRate: 148,
      bloodPressureSys: 72,
      bloodPressureDia: 42,
      capillaryRefillSeconds: 2.0,
      ngTubeOutputMl: 8.5,
      ngAspirateAppearance: 'Clear serous',
      notes: 'Bowel sound auscultated, abdomen soft.',
    });
    expect(logAdd.status).toBe(201);
    const logId = logAdd.body.id || logAdd.body.logId;
    expect(logId).toBeGreaterThan(0);

    // 6. Delete flowsheet log
    const logDel = await call('DELETE', `/api/neonatal-volvulus/flowsheet/${logId}`, nurse);
    expect(logDel.status).toBe(200);
    expect(logDel.body.success).toBe(true);
  });

  it('enforces RBAC preventing attender from creating or altering volvulus records', async () => {
    const unauth = await call('POST', '/api/neonatal-volvulus/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T04:00:00',
      ageDays: 4,
      weightKg: 3.2,
      emesisColor: 'bilious_dark_green',
      abdominalDistension: 'mild_epigastric',
      serumLactateMmolL: 2.2,
      plainRadiographFinding: 'normal_gas_pattern',
      upperGiContrastDone: false,
    });
    expect(unauth.status).toBe(403);
  });
});
