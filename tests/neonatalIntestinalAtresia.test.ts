import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalIntestinalAtresia } from '../web/src/neonatalIntestinalAtresiaEngine.js';

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

describe('Neonatal Intestinal Atresia Engine (Pure Unit Tests)', () => {
  it('evaluates complete duodenal atresia with Down syndrome Trisomy 21 and AVSD risk', () => {
    const res = evaluateNeonatalIntestinalAtresia({
      ageHours: 12,
      weightKg: 2.9,
      atresiaLevel: 'duodenal_atresia_complete',
      polyhydramniosAntenatal: true,
      biliousEmesisPresent: true,
      abdominalDistensionPattern: 'scaphoid_epigastric_fullness_only',
      radiographicGasPattern: 'double_bubble_sign_gasless_distal',
      downSyndromeFeaturesPresent: true,
      karyotypeTrisomy21Confirmed: true,
      echocardiogramCardiacDefect: true,
      replogleDecompressionActive: true,
      surgicalProcedurePlanned: 'duodenoduodenostomy_diamond_anastomosis',
      transanastomoticTubePlaced: true,
      tpnCentralLineInSitu: true,
    });

    expect(res.isDuodenalAtresia).toBe(true);
    expect(res.syndromicTrisomy21Risk).toBe('high_confirmed');
    expect(res.shortBowelSyndromeRisk).toBe('low_isolated_atresia');
    expect(res.surgicalDirectives.some((d) => d.includes('Kimura'))).toBe(true);
    expect(res.surgicalDirectives.some((d) => d.includes('annular pancreas'))).toBe(true);
    expect(res.decompressionDirectives.some((d) => d.includes('Replogle'))).toBe(true);
  });

  it('identifies Type IIIb apple-peel jejunoileal atresia with extreme short bowel syndrome risk', () => {
    const res = evaluateNeonatalIntestinalAtresia({
      ageHours: 24,
      weightKg: 2.4,
      atresiaLevel: 'jejunoileal_atresia_type_3b_apple_peel',
      polyhydramniosAntenatal: true,
      biliousEmesisPresent: true,
      abdominalDistensionPattern: 'generalized_distension_visible_loops',
      radiographicGasPattern: 'multiple_dilated_loops_air_fluid_levels',
      downSyndromeFeaturesPresent: false,
      karyotypeTrisomy21Confirmed: false,
      echocardiogramCardiacDefect: false,
      replogleDecompressionActive: true,
      surgicalProcedurePlanned: 'tapering_enteroplasty_anastomosis',
      transanastomoticTubePlaced: false,
      tpnCentralLineInSitu: true,
    });

    expect(res.isDuodenalAtresia).toBe(false);
    expect(res.isApplePeelAtresia).toBe(true);
    expect(res.shortBowelSyndromeRisk).toBe('extreme_apple_peel');
    expect(res.alerts.some((a) => a.includes('Type IIIb Apple-Peel'))).toBe(true);
    expect(res.surgicalDirectives.some((d) => d.toLowerCase().includes('tapering enteroplasty'))).toBe(true);
    expect(res.nutritionalDirectives.some((n) => n.includes('Total Parenteral Nutrition'))).toBe(true);
  });
});

describe('Neonatal Intestinal Atresia Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedsurg',
      fullName: 'Dr. Anita Pediatric Surgery',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Nurse Neha NICU',
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
      fullName: 'Attender Suresh',
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
      dateOfBirth: '2026-11-07',
      phone: '9876543299',
      address: 'NICU Incubator 3',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to create an atresia episode and retrieve calculated evaluation', async () => {
    const res = await call('POST', '/api/neonatal-intestinal-atresia/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T04:00:00',
      ageHours: 16,
      weightKg: 2.8,
      atresiaLevel: 'duodenal_atresia_complete',
      polyhydramniosAntenatal: true,
      biliousEmesisPresent: true,
      abdominalDistensionPattern: 'scaphoid_epigastric_fullness_only',
      radiographicGasPattern: 'double_bubble_sign_gasless_distal',
      downSyndromeFeaturesPresent: true,
      karyotypeTrisomy21Confirmed: true,
      echocardiogramCardiacDefect: true,
      replogleDecompressionActive: true,
      surgicalProcedurePlanned: 'duodenoduodenostomy_diamond_anastomosis',
      transanastomoticTubePlaced: true,
      tpnCentralLineInSitu: true,
      status: 'preop_nasogastric_decompression',
      clinicalNotes: 'Double-bubble on plain film with complete duodenal obstruction.',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.episode.episode_code).toMatch(/^ATRESIA-\d+-\d+/);
    const episodeId = res.body.episode.id;

    // Retrieve details
    const detail = await call('GET', `/api/neonatal-intestinal-atresia/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.evaluation.isDuodenalAtresia).toBe(true);
    expect(detail.body.evaluation.syndromicTrisomy21Risk).toBe('high_confirmed');
  });

  it('allows nurse to add flowsheet checkpoint and audit logging occurs', async () => {
    const ep = await call('POST', '/api/neonatal-intestinal-atresia/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T04:00:00',
      ageHours: 10,
      weightKg: 2.7,
      atresiaLevel: 'jejunoileal_atresia_type_3b_apple_peel',
      polyhydramniosAntenatal: true,
      biliousEmesisPresent: true,
      abdominalDistensionPattern: 'generalized_distension_visible_loops',
      radiographicGasPattern: 'multiple_dilated_loops_air_fluid_levels',
      downSyndromeFeaturesPresent: false,
      karyotypeTrisomy21Confirmed: false,
      echocardiogramCardiacDefect: false,
      replogleDecompressionActive: true,
      surgicalProcedurePlanned: 'tapering_enteroplasty_anastomosis',
      transanastomoticTubePlaced: false,
      tpnCentralLineInSitu: true,
      status: 'contrast_imaging_enema_workup',
    });
    const episodeId = ep.body.episode.id;

    const logRes = await call('POST', `/api/neonatal-intestinal-atresia/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T06:00:00',
      hoursFromAdmission: 2,
      nasogastricOutputMl: 12.5,
      nasogastricAspirateCharacter: 'bilious_dark_green',
      abdominalGirthCm: 29.0,
      enteralFeedRateMlHr: 0.0,
      stoolPassageObserved: false,
      stoolCharacter: 'none',
      heartRate: 142,
      respiratoryRate: 46,
      notes: 'Continuous suction working well. Bilious return noted.',
    });

    expect([200, 201]).toContain(logRes.status);
    expect(logRes.body.flowsheetLog.nasogastric_output_ml).toBe(12.5);

    // Verify audit log
    const auditRow = db.prepare(`
      SELECT * FROM audit_events WHERE action = 'neonatal_intestinal_atresia.flowsheet_add'
    `).get() as any;
    expect(auditRow).toBeDefined();
  });

  it('blocks attender with 403 Forbidden', async () => {
    const res = await call('POST', '/api/neonatal-intestinal-atresia/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T04:00:00',
      ageHours: 12,
      weightKg: 3.0,
      atresiaLevel: 'duodenal_atresia_complete',
      polyhydramniosAntenatal: true,
      biliousEmesisPresent: true,
      abdominalDistensionPattern: 'scaphoid_epigastric_fullness_only',
      radiographicGasPattern: 'double_bubble_sign_gasless_distal',
      downSyndromeFeaturesPresent: false,
      karyotypeTrisomy21Confirmed: false,
      echocardiogramCardiacDefect: false,
      replogleDecompressionActive: true,
      surgicalProcedurePlanned: 'duodenoduodenostomy_diamond_anastomosis',
      transanastomoticTubePlaced: false,
      tpnCentralLineInSitu: false,
    });

    expect(res.status).toBe(403);
  });
});
