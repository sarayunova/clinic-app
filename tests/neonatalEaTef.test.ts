import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalEaTef } from '../web/src/neonatalEaTefEngine.js';

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

describe('Neonatal EA/TEF Engine (Pure Unit Tests)', () => {
  it('correctly stages Gross Type C with aerated bowel, Replogle continuous sump, and standard right thoracotomy', () => {
    const res = evaluateNeonatalEaTef({
      ageHours: 12,
      weightKg: 3.0,
      frothyOralSecretions: true,
      chokingCyanosisWithFeed: true,
      ogTubeCoilingDistanceCm: 10.0,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'aerated_gastrointestinal_tract',
      replogleTubeInSitu: true,
      replogleSuctionPressureMmHg: 25,
      gapLengthClassification: 'short_gap_primary_anastomosis',
      vacterlVertebralAnomaly: false,
      vacterlAnorectalMalformation: false,
      vacterlCardiacAnomaly: false,
      vacterlRightAorticArch: false,
      vacterlRenalUltrasoundAbnormal: false,
      vacterlLimbRadialAnomaly: false,
      headOfBedElevated30deg: true,
      surgicalProcedurePlanned: 'primary_extrapleural_repair_fistula_ligation',
    });

    expect(res.hasDistalFistula).toBe(true);
    expect(res.isLongGap).toBe(false);
    expect(res.surgicalThoracotomySide).toBe('right_thoracotomy_standard');
    expect(res.surgicalThoracotomySideLabel).toContain('Right Extrapleural Thoracotomy');
    expect(res.grossTypeDescription).toContain('Gross Type C');
    expect(res.replogleProtocolDirectives.some((d) => d.includes('20-30 mmHg'))).toBe(true);
  });

  it('mandates LEFT thoracotomy when right-sided aortic arch is present on echocardiogram', () => {
    const res = evaluateNeonatalEaTef({
      ageHours: 8,
      weightKg: 2.9,
      frothyOralSecretions: true,
      chokingCyanosisWithFeed: true,
      ogTubeCoilingDistanceCm: 9.5,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'aerated_gastrointestinal_tract',
      replogleTubeInSitu: true,
      replogleSuctionPressureMmHg: 25,
      gapLengthClassification: 'short_gap_primary_anastomosis',
      vacterlVertebralAnomaly: true,
      vacterlAnorectalMalformation: false,
      vacterlCardiacAnomaly: true,
      vacterlRightAorticArch: true,
      vacterlRenalUltrasoundAbnormal: true,
      vacterlLimbRadialAnomaly: false,
      headOfBedElevated30deg: true,
      surgicalProcedurePlanned: 'primary_extrapleural_repair_fistula_ligation',
    });

    expect(res.surgicalThoracotomySide).toBe('left_thoracotomy_right_arch');
    expect(res.surgicalThoracotomySideLabel).toContain('Left Thoracotomy Required');
    expect(res.isVacterlSyndromeSuspected).toBe(true);
    expect(res.vacterlFeatureCount).toBeGreaterThanOrEqual(3);
    expect(res.alerts.some((a) => a.includes('Right-sided aortic arch'))).toBe(true);
  });

  it('detects massive gastric distension barotrauma risk and triggers emergency repair urgency', () => {
    const res = evaluateNeonatalEaTef({
      ageHours: 6,
      weightKg: 2.7,
      frothyOralSecretions: true,
      chokingCyanosisWithFeed: true,
      ogTubeCoilingDistanceCm: 10.0,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'massive_gastric_distension',
      replogleTubeInSitu: true,
      replogleSuctionPressureMmHg: 25,
      gapLengthClassification: 'short_gap_primary_anastomosis',
      vacterlVertebralAnomaly: false,
      vacterlAnorectalMalformation: false,
      vacterlCardiacAnomaly: false,
      vacterlRightAorticArch: false,
      vacterlRenalUltrasoundAbnormal: false,
      vacterlLimbRadialAnomaly: false,
      headOfBedElevated30deg: true,
      surgicalProcedurePlanned: 'primary_extrapleural_repair_fistula_ligation',
    });

    expect(res.urgencyTier).toBe('emergency_surgical_repair');
    expect(res.alerts.some((a) => a.includes('BAROTRAUMA'))).toBe(true);
  });

  it('identifies pure Gross Type A with gasless abdomen and directs staged long-gap management', () => {
    const res = evaluateNeonatalEaTef({
      ageHours: 14,
      weightKg: 2.5,
      frothyOralSecretions: true,
      chokingCyanosisWithFeed: false,
      ogTubeCoilingDistanceCm: 8.0,
      grossClassificationType: 'type_a_isolated_ea_no_fistula',
      abdominalGasPattern: 'gasless_abdomen_no_distal_fistula',
      replogleTubeInSitu: true,
      replogleSuctionPressureMmHg: 25,
      gapLengthClassification: 'long_gap_greater_3_cm_or_vertebrae',
      vacterlVertebralAnomaly: false,
      vacterlAnorectalMalformation: false,
      vacterlCardiacAnomaly: false,
      vacterlRightAorticArch: false,
      vacterlRenalUltrasoundAbnormal: false,
      vacterlLimbRadialAnomaly: false,
      headOfBedElevated30deg: true,
      surgicalProcedurePlanned: 'staged_gastrostomy_delayed_anastomosis',
    });

    expect(res.hasDistalFistula).toBe(false);
    expect(res.isLongGap).toBe(true);
    expect(res.urgencyTier).toBe('staged_long_gap_management');
    expect(res.recommendations.some((r) => r.includes('gastrostomy tube'))).toBe(true);
  });
});

describe('Neonatal EA/TEF Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.eatef',
      fullName: 'Dr. Anita PediatricSurgeon',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.eatef',
      fullName: 'Nurse Kavita NICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.eatef', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.eatef', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.eatef',
      fullName: 'Attender Manoj',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.eatef', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.eatef', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Maya',
      dateOfBirth: '2026-11-08',
      phone: '9876543210',
      address: 'NICU Bed 3',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor and nurse to evaluate, create episode, update, and log Replogle flowsheet', async () => {
    // 1. Evaluate endpoint
    const preview = await call('POST', '/api/neonatal-ea-tef/evaluate', doctor, {
      ageHours: 10,
      weightKg: 2.8,
      ogTubeCoilingDistanceCm: 10.0,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'aerated_gastrointestinal_tract',
      replogleTubeInSitu: true,
      replogleSuctionPressureMmHg: 25,
      gapLengthClassification: 'short_gap_primary_anastomosis',
      vacterlRightAorticArch: false,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.surgicalThoracotomySide).toBe('right_thoracotomy_standard');

    // 2. Create episode
    const created = await call('POST', '/api/neonatal-ea-tef/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T06:00:00',
      ageHours: 10,
      weightKg: 2.8,
      frothyOralSecretions: true,
      chokingCyanosisWithFeed: true,
      ogTubeCoilingDistanceCm: 10.0,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'aerated_gastrointestinal_tract',
      replogleTubeInSitu: true,
      replogleSuctionPressureMmHg: 25,
      gapLengthClassification: 'short_gap_primary_anastomosis',
      vacterlVertebralAnomaly: false,
      vacterlAnorectalMalformation: false,
      vacterlCardiacAnomaly: false,
      vacterlRightAorticArch: false,
      vacterlRenalUltrasoundAbnormal: false,
      vacterlLimbRadialAnomaly: false,
      headOfBedElevated30deg: true,
      surgicalProcedurePlanned: 'primary_extrapleural_repair_fistula_ligation',
      status: 'preop_replogle_sump_decompression',
      clinicalNotes: 'Replogle sump 8 Fr placed, patent on 25 mmHg continuous suction.',
    });
    expect(created.status).toBe(200);
    const episodeId = created.body.episode.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/neonatal-ea-tef/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T07:00:00',
      hoursFromAdmission: 1.0,
      replogleSalineFlushed: true,
      replogleAspirateVolumeMl: 6.5,
      replogleAspirateCharacter: 'frothy_mucus',
      heartRate: 142,
      respiratoryRate: 40,
      oxygenSaturationPct: 98,
      abdominalGirthCm: 28.0,
      notes: 'Suction patent, clear aspirate after saline flush.',
    });
    expect(logRes.status).toBe(200);
    expect(logRes.body.log.replogle_aspirate_volume_ml).toBe(6.5);

    // 4. Get episode details with flowsheet
    const detail = await call('GET', `/api/neonatal-ea-tef/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.episode_code).toMatch(/^EATEF-/);
    expect(detail.body.flowsheetLogs.length).toBe(1);

    // 5. Update status
    const updated = await call('PUT', `/api/neonatal-ea-tef/episodes/${episodeId}`, doctor, {
      patientId,
      onsetDatetime: '2026-11-08T06:00:00',
      ageHours: 10,
      weightKg: 2.8,
      frothyOralSecretions: true,
      chokingCyanosisWithFeed: true,
      ogTubeCoilingDistanceCm: 10.0,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'aerated_gastrointestinal_tract',
      replogleTubeInSitu: true,
      replogleSuctionPressureMmHg: 25,
      gapLengthClassification: 'short_gap_primary_anastomosis',
      vacterlVertebralAnomaly: false,
      vacterlAnorectalMalformation: false,
      vacterlCardiacAnomaly: false,
      vacterlRightAorticArch: false,
      vacterlRenalUltrasoundAbnormal: false,
      vacterlLimbRadialAnomaly: false,
      headOfBedElevated30deg: true,
      surgicalProcedurePlanned: 'primary_extrapleural_repair_fistula_ligation',
      status: 'in_operating_room_thoracotomy',
      clinicalNotes: 'Transferring to pediatric surgery OT 2.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.episode.status).toBe('in_operating_room_thoracotomy');
  });

  it('rejects unauthenticated and attender attempts to manage EA/TEF episodes', async () => {
    const unauth = await call('POST', '/api/neonatal-ea-tef/episodes', undefined, {
      patientId,
      onsetDatetime: '2026-11-08T06:00:00',
      ageHours: 10,
      weightKg: 2.8,
      ogTubeCoilingDistanceCm: 10.0,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'aerated_gastrointestinal_tract',
      gapLengthClassification: 'short_gap_primary_anastomosis',
      surgicalProcedurePlanned: 'primary_extrapleural_repair_fistula_ligation',
    });
    expect(unauth.status).toBe(403);

    const attenderTry = await call('POST', '/api/neonatal-ea-tef/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T06:00:00',
      ageHours: 10,
      weightKg: 2.8,
      ogTubeCoilingDistanceCm: 10.0,
      grossClassificationType: 'type_c_ea_with_distal_tef',
      abdominalGasPattern: 'aerated_gastrointestinal_tract',
      gapLengthClassification: 'short_gap_primary_anastomosis',
      surgicalProcedurePlanned: 'primary_extrapleural_repair_fistula_ligation',
    });
    expect(attenderTry.status).toBe(403);
  });
});
