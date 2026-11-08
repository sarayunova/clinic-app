import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateNeonatalSip } from '../web/src/neonatalSipEngine.js';

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

describe('Neonatal SIP & Primary Peritoneal Drainage Engine (Pure Unit Tests)', () => {
  it('evaluates classic isolated SIP profile in ELBW infant with steroid-NSAID synergy', () => {
    const res = evaluateNeonatalSip({
      ageDays: 8,
      birthWeightGrams: 750,
      gestationalAgeWeeks: 25.5,
      antenatalOrEarlySteroidsExposed: true,
      indomethacinOrIbuprofenPdaExposed: true,
      pneumoperitoneumConfirmed: true,
      pneumatosisIntestinalisAbsent: true,
      portalVenousGasAbsent: true,
      abdominalWallBluishDiscoloration: true,
      peritonealDrainagePerformed: true,
      drainType: 'penrose_drain',
      peritonealFluidYeastCandidaPositive: false,
      surgicalApproach: 'bedside_primary_peritoneal_drainage',
      status: 'bedside_peritoneal_drain_active',
    });

    expect(res.isElbwExtremelyLowBirthWeight).toBe(true);
    expect(res.hasSteroidNsaidSynergyRisk).toBe(true);
    expect(res.isIsolatedSipProfile).toBe(true);
    expect(res.sipConfidenceCategory).toBe('definitive_isolated_sip');
    expect(res.alerts.some((a) => a.includes('EXTREMELY LOW BIRTH WEIGHT'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('HIGH MEDICATION SYNERGY HAZARD'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('BLUISH ABDOMINAL WALL / SCROTAL SIGN'))).toBe(true);
    expect(res.drainageTechniqueDirectives.some((d) => d.includes('Right Lower Quadrant (RLQ)'))).toBe(true);
    expect(res.laparotomyConversionCriteria.some((c) => c.includes('Failure to improve within 24–48 hours'))).toBe(true);
  });

  it('triggers emergency alert for un-decompressed pneumoperitoneum', () => {
    const res = evaluateNeonatalSip({
      ageDays: 6,
      birthWeightGrams: 900,
      gestationalAgeWeeks: 27.0,
      antenatalOrEarlySteroidsExposed: false,
      indomethacinOrIbuprofenPdaExposed: true,
      pneumoperitoneumConfirmed: true,
      pneumatosisIntestinalisAbsent: true,
      portalVenousGasAbsent: true,
      abdominalWallBluishDiscoloration: false,
      peritonealDrainagePerformed: false,
      drainType: 'none_laparotomy_primary',
      peritonealFluidYeastCandidaPositive: false,
      surgicalApproach: 'bedside_primary_peritoneal_drainage',
      status: 'acute_perforation_triage',
    });

    expect(res.urgencyTier).toBe('emergency_pneumoperitoneum_decompression');
    expect(res.urgencyTierLabel).toContain('EMERGENCY');
  });

  it('identifies fungal peritonitis and issues Fluconazole / Amphotericin B mandates', () => {
    const res = evaluateNeonatalSip({
      ageDays: 14,
      birthWeightGrams: 820,
      gestationalAgeWeeks: 26.0,
      antenatalOrEarlySteroidsExposed: true,
      indomethacinOrIbuprofenPdaExposed: true,
      pneumoperitoneumConfirmed: true,
      pneumatosisIntestinalisAbsent: true,
      portalVenousGasAbsent: true,
      abdominalWallBluishDiscoloration: true,
      peritonealDrainagePerformed: true,
      drainType: 'chest_tube_10fr',
      peritonealFluidYeastCandidaPositive: true,
      surgicalApproach: 'bedside_primary_peritoneal_drainage',
      status: 'bedside_peritoneal_drain_active',
    });

    expect(res.alerts.some((a) => a.includes('FUNGAL PERITONITIS DETECTED'))).toBe(true);
    expect(res.antimicrobialDirectives.some((d) => d.includes('Systemic antifungal therapy mandatory'))).toBe(true);
  });
});

describe('Neonatal SIP Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedisurg',
      fullName: 'Dr. Vikram Pediatric Surgeon',
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
      fullName: 'Baby of Ananya (ELBW)',
      dateOfBirth: '2026-11-01',
      phone: '9876543202',
      address: 'NICU Incubator 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview evaluation, create, update, and manage neonatal SIP episodes', async () => {
    // 1. Evaluate Preview API
    const evalRes = await call('POST', '/api/neonatal-sip/evaluate', doctor, {
      ageDays: 7,
      birthWeightGrams: 720,
      gestationalAgeWeeks: 25.1,
      antenatalOrEarlySteroidsExposed: true,
      indomethacinOrIbuprofenPdaExposed: true,
      pneumoperitoneumConfirmed: true,
      pneumatosisIntestinalisAbsent: true,
      portalVenousGasAbsent: true,
      abdominalWallBluishDiscoloration: true,
      peritonealDrainagePerformed: true,
      drainType: 'penrose_drain',
      peritonealFluidYeastCandidaPositive: false,
      surgicalApproach: 'bedside_primary_peritoneal_drainage',
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.isElbwExtremelyLowBirthWeight).toBe(true);

    // 2. Create Episode
    const createRes = await call('POST', '/api/neonatal-sip/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageDays: 7,
      birthWeightGrams: 720,
      gestationalAgeWeeks: 25.1,
      antenatalOrEarlySteroidsExposed: true,
      indomethacinOrIbuprofenPdaExposed: true,
      pneumoperitoneumConfirmed: true,
      pneumatosisIntestinalisAbsent: true,
      portalVenousGasAbsent: true,
      abdominalWallBluishDiscoloration: true,
      peritonealDrainagePerformed: true,
      drainType: 'penrose_drain',
      peritonealFluidYeastCandidaPositive: false,
      surgicalApproach: 'bedside_primary_peritoneal_drainage',
      status: 'bedside_peritoneal_drain_active',
      clinicalNotes: 'Bedside Penrose drain inserted under local anesthesia in RLQ.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get Episode
    const getRes = await call('GET', `/api/neonatal-sip/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.birth_weight_grams).toBe(720);
    expect(getRes.body.evaluation.sipConfidenceCategory).toBe('definitive_isolated_sip');

    // 4. Update Episode
    const updateRes = await call('PUT', `/api/neonatal-sip/episodes/${episodeId}`, doctor, {
      patientId,
      onsetDatetime: '2026-11-08T03:00:00',
      ageDays: 8,
      birthWeightGrams: 720,
      gestationalAgeWeeks: 25.1,
      antenatalOrEarlySteroidsExposed: true,
      indomethacinOrIbuprofenPdaExposed: true,
      pneumoperitoneumConfirmed: true,
      pneumatosisIntestinalisAbsent: true,
      portalVenousGasAbsent: true,
      abdominalWallBluishDiscoloration: false,
      peritonealDrainagePerformed: true,
      drainType: 'penrose_drain',
      peritonealFluidYeastCandidaPositive: false,
      surgicalApproach: 'bedside_primary_peritoneal_drainage',
      status: 'drain_weaning_resolution',
      clinicalNotes: 'Drain output decreased to < 5 mL/day. Weaning initiated.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('drain_weaning_resolution');

    // 5. Nurse adds flowsheet checkpoint
    const flowRes = await call('POST', `/api/neonatal-sip/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T08:00:00',
      hoursFromIntervention: 12,
      drainOutputMl24h: 8.5,
      drainOutputCharacter: 'bilious',
      abdominalGirthCm: 22.0,
      meanAirwayPressureCmh2o: 8.0,
      inotropicSupportActive: true,
      plateletCountKUl: 140,
      crpMgL: 28.0,
      notes: 'Penrose drain draining serobilious fluid. Abdomen soft.',
    });
    expect(flowRes.status).toBe(201);
    const flowsheetId = flowRes.body.flowsheetLog.id;

    // 6. Delete Flowsheet checkpoint
    const delFlowRes = await call('DELETE', `/api/neonatal-sip/flowsheet/${flowsheetId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. Attender cannot modify or delete
    const attenderTry = await call('POST', `/api/neonatal-sip/episodes/${episodeId}/flowsheet`, attender, {
      logDatetime: '2026-11-08T08:00:00',
      hoursFromIntervention: 12,
      drainOutputMl24h: 8.5,
      drainOutputCharacter: 'bilious',
      abdominalGirthCm: 22.0,
      meanAirwayPressureCmh2o: 8.0,
      inotropicSupportActive: true,
      plateletCountKUl: 140,
      crpMgL: 28.0,
    });
    expect(attenderTry.status).toBe(403);

    // 8. Delete Episode by Doctor
    const delEpRes = await call('DELETE', `/api/neonatal-sip/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });
});
