import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricHyperemesis } from '../web/src/obstetricHyperemesisEngine.js';

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

describe('Obstetric Hyperemesis Gravidarum & PUQE-24 Engine (Pure Unit Tests)', () => {
  it('evaluates severe PUQE-24 with hypokalemic alkalosis and catabolic starvation', () => {
    const res = evaluateObstetricHyperemesis({
      gestationalAgeWeeks: 9.2,
      puqeNauseaHours: 5,
      puqeVomitingEpisodes: 5,
      puqeRetchingEpisodes: 4,
      weightLossPercent: 7.5,
      ketonuriaLevel: 'three_plus',
      serumPotassiumMmolL: 2.9,
      serumSodiumMmolL: 131.0,
      serumChlorideMmolL: 88.0,
      bicarbonateMmolL: 33.0,
      parenteralThiamineGivenBeforeDextrose: true,
      wernickeTriadSymptomsPresent: false,
      currentAntiemeticTier: 'tier_3_ondansetron_5ht3_antagonist',
      thromboprophylaxisLmwhPrescribed: true,
    });

    expect(res.puqeScoreTotal).toBe(14);
    expect(res.puqeSeverityCategory).toBe('severe');
    expect(res.isSevereWeightLoss).toBe(true);
    expect(res.isHypokalemicAlkalosis).toBe(true);
    expect(res.alerts.some((a) => a.includes('SEVERE PUQE-24 SCORE'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('SEVERE HYPOKALEMIA'))).toBe(true);
    expect(res.hydrationDirectives.some((h) => h.includes('hypokalemic metabolic alkalosis'))).toBe(true);
    expect(res.thiamineDirectives.some((d) => d.includes('Thiamine Prophylaxis'))).toBe(true);
    expect(res.hydrationDirectives.some((h) => h.includes('0.9% Normal Saline'))).toBe(true);
  });

  it('triggers critical Wernicke encephalopathy alert if IV dextrose given without thiamine', () => {
    const res = evaluateObstetricHyperemesis({
      gestationalAgeWeeks: 10.0,
      puqeNauseaHours: 4,
      puqeVomitingEpisodes: 4,
      puqeRetchingEpisodes: 3,
      weightLossPercent: 6.0,
      ketonuriaLevel: 'two_plus',
      serumPotassiumMmolL: 3.4,
      serumSodiumMmolL: 133.0,
      serumChlorideMmolL: 94.0,
      bicarbonateMmolL: 29.0,
      parenteralThiamineGivenBeforeDextrose: false, // OMISSION
      wernickeTriadSymptomsPresent: false,
      currentAntiemeticTier: 'tier_2_dimenhydrinate_or_metoclopramide',
      thromboprophylaxisLmwhPrescribed: false,
    });

    expect(res.wernickeRiskTier).toBe('high_risk_thiamine_required');
    expect(res.alerts.some((a) => a.includes('CATASTROPHIC RISK: Intravenous dextrose infusion without prior parenteral Thiamine'))).toBe(true);
    expect(res.thiamineDirectives.some((d) => d.includes('Always give Thiamine prior to starting dextrose'))).toBe(true);
  });

  it('identifies emergency tier when acute Wernicke triad neurological symptoms exist', () => {
    const res = evaluateObstetricHyperemesis({
      gestationalAgeWeeks: 11.5,
      puqeNauseaHours: 5,
      puqeVomitingEpisodes: 5,
      puqeRetchingEpisodes: 5,
      weightLossPercent: 9.0,
      ketonuriaLevel: 'four_plus',
      serumPotassiumMmolL: 3.1,
      serumSodiumMmolL: 129.0,
      serumChlorideMmolL: 86.0,
      bicarbonateMmolL: 34.0,
      parenteralThiamineGivenBeforeDextrose: true,
      wernickeTriadSymptomsPresent: true, // ACTIVE NEUROLOGICAL SYMPTOMS
      currentAntiemeticTier: 'tier_4_corticosteroid_methylprednisolone_pulse',
      thromboprophylaxisLmwhPrescribed: true,
    });

    expect(res.wernickeRiskTier).toBe('emergency_active_symptoms');
    expect(res.urgencyTier).toBe('emergency_wernicke_or_severe_derangement');
    expect(res.alerts.some((a) => a.includes('CRITICAL WERNICKE EMERGENCY'))).toBe(true);
    expect(res.thiamineDirectives.some((d) => d.includes('Thiamine'))).toBe(true);
  });
});

describe('Obstetric Hyperemesis Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Sunita Obstetrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.maternity',
      fullName: 'Nurse Priya Ward',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.maternity', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.maternity', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.hg',
      fullName: 'Attender Ramesh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.hg', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.hg', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Sharma',
      dateOfBirth: '1998-05-12',
      phone: '9876543202',
      address: 'Obstetric Ward Bed 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to create a hyperemesis episode and retrieve calculated evaluation', async () => {
    const res = await call('POST', '/api/obstetric-hyperemesis/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T02:00:00',
      gestationalAgeWeeks: 9.4,
      puqeNauseaHours: 5,
      puqeVomitingEpisodes: 4,
      puqeRetchingEpisodes: 4,
      weightLossPercent: 7.2,
      ketonuriaLevel: 'three_plus',
      serumPotassiumMmolL: 3.1,
      serumSodiumMmolL: 132.0,
      serumChlorideMmolL: 90.0,
      bicarbonateMmolL: 31.0,
      parenteralThiamineGivenBeforeDextrose: true,
      wernickeTriadSymptomsPresent: false,
      currentAntiemeticTier: 'tier_3_ondansetron_5ht3_antagonist',
      thromboprophylaxisLmwhPrescribed: true,
      status: 'inpatient_iv_hydration_thiamine',
      clinicalNotes: 'Severe hyperemesis gravidarum with 7.2% weight loss and 3+ ketonuria.',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.episode.episode_code).toMatch(/^HG-\d+-\d+/);
    const episodeId = res.body.episode.id;

    // Retrieve details
    const detail = await call('GET', `/api/obstetric-hyperemesis/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.evaluation.puqeScoreTotal).toBe(13);
    expect(detail.body.evaluation.puqeSeverityCategory).toBe('severe');
  });

  it('allows nurse to record flowsheet checkpoint and verifies audit event logging', async () => {
    const ep = await call('POST', '/api/obstetric-hyperemesis/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T02:00:00',
      gestationalAgeWeeks: 10.0,
      puqeNauseaHours: 4,
      puqeVomitingEpisodes: 3,
      puqeRetchingEpisodes: 3,
      weightLossPercent: 5.5,
      ketonuriaLevel: 'two_plus',
      serumPotassiumMmolL: 3.6,
      serumSodiumMmolL: 136.0,
      serumChlorideMmolL: 98.0,
      bicarbonateMmolL: 26.0,
      parenteralThiamineGivenBeforeDextrose: true,
      wernickeTriadSymptomsPresent: false,
      currentAntiemeticTier: 'tier_2_dimenhydrinate_or_metoclopramide',
      thromboprophylaxisLmwhPrescribed: true,
      status: 'inpatient_iv_hydration_thiamine',
    });
    const episodeId = ep.body.episode.id;

    const logRes = await call('POST', `/api/obstetric-hyperemesis/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T08:00:00',
      dayOfTreatment: 1,
      puqeScoreTotal: 10,
      vomitingEpisodes24h: 3,
      ketonuriaDipstick: 'two_plus',
      ivFluidBalanceMl24h: 2000.0,
      oralFluidIntakeMl: 350.0,
      potassiumMmolL: 3.7,
      thiamineAdministered: true,
      notes: 'Thiamine 100 mg IV administered with NS + KCl; nausea improving.',
    });

    expect([200, 201]).toContain(logRes.status);
    expect(logRes.body.flowsheetLog.puqe_score_total).toBe(10);

    // Verify audit event
    const auditRow = db.prepare(`
      SELECT * FROM audit_events WHERE action = 'obstetric_hyperemesis.flowsheet_add'
    `).get() as any;
    expect(auditRow).toBeDefined();
  });

  it('blocks attender with 403 Forbidden', async () => {
    const res = await call('POST', '/api/obstetric-hyperemesis/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T02:00:00',
      gestationalAgeWeeks: 9.0,
      puqeNauseaHours: 4,
      puqeVomitingEpisodes: 3,
      puqeRetchingEpisodes: 3,
      weightLossPercent: 4.0,
      ketonuriaLevel: 'one_plus',
      serumPotassiumMmolL: 3.8,
      serumSodiumMmolL: 138.0,
      serumChlorideMmolL: 100.0,
      bicarbonateMmolL: 24.0,
      parenteralThiamineGivenBeforeDextrose: true,
      wernickeTriadSymptomsPresent: false,
      currentAntiemeticTier: 'tier_1_doxylamine_pyridoxine',
      thromboprophylaxisLmwhPrescribed: false,
    });
    expect(res.status).toBe(403);
  });
});
