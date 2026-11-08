import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateBishopScore,
  evaluateObstetricPostterm,
} from '../web/src/obstetricPosttermEngine.js';

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
describe('Obstetric Post-Term & Bishop Engine (Pure Unit Tests)', () => {
  it('calculates modified Bishop score for unfavorable cervix (score <= 6)', () => {
    // Dilation 1cm (1), Effacement 40% (1), Station -2 (1), Firm (0), Posterior (0) => 3
    const score = calculateBishopScore(1.0, 40, -2, 'firm', 'posterior');

    expect(score.dilationPoints).toBe(1);
    expect(score.effacementPoints).toBe(1);
    expect(score.stationPoints).toBe(1);
    expect(score.consistencyPoints).toBe(0);
    expect(score.positionPoints).toBe(0);
    expect(score.totalScore).toBe(3);
    expect(score.isFavorable).toBe(false);
  });

  it('calculates modified Bishop score for favorable cervix (score > 6)', () => {
    // Dilation 4cm (2), Effacement 70% (2), Station +1 (2), Soft (2), Anterior (2) => 10
    const score = calculateBishopScore(4.0, 70, 1, 'soft', 'anterior');

    expect(score.totalScore).toBe(11);
    expect(score.isFavorable).toBe(true);
  });

  it('identifies post-term (>=42w) with oligohydramnios and mandates delivery', () => {
    const res = evaluateObstetricPostterm({
      gestationalAgeWeeks: 42.2,
      datingMethod: 'first_trimester_ultrasound_crl',
      amnioticFluidIndexCm: 4.2, // oligohydramnios <= 5.0
      singleDeepestPocketCm: 1.8, // < 2.0
      nonStressTestResult: 'reactive',
      cervicalDilationCm: 1.0,
      cervicalEffacementPct: 30,
      fetalStation: -3,
      cervicalConsistency: 'firm',
      cervicalPosition: 'posterior',
      priorCesareanSection: false,
    });

    expect(res.posttermClassification).toBe('post_term_ge_42_0');
    expect(res.oligohydramniosPresent).toBe(true);
    expect(res.immediateInductionIndicated).toBe(true);
    expect(res.bishop.isFavorable).toBe(false);
    expect(res.recommendedRipeningMethod).toBe('dinoprostone_pge2_insert');
  });

  it('strictly contraindicates prostaglandins when prior Cesarean section is present', () => {
    const res = evaluateObstetricPostterm({
      gestationalAgeWeeks: 41.3,
      datingMethod: 'reliable_lmp_concordant',
      amnioticFluidIndexCm: 9.0,
      singleDeepestPocketCm: 3.5,
      nonStressTestResult: 'reactive',
      cervicalDilationCm: 1.5,
      cervicalEffacementPct: 40,
      fetalStation: -2,
      cervicalConsistency: 'medium',
      cervicalPosition: 'midposition',
      priorCesareanSection: true, // Prior C-section
    });

    expect(res.posttermClassification).toBe('late_term_41_0_to_41_6');
    expect(res.oligohydramniosPresent).toBe(false);
    expect(res.recommendedRipeningMethod).toBe('mechanical_foley_balloon');
    expect(res.contraindicationsNote).toContain('STRICTLY CONTRAINDICATED');
    expect(res.contraindicationsNote).toContain('uterine rupture');
    expect(res.ripeningGuidance).toContain('Foley catheter');
  });

  it('recommends direct oxytocin infusion for favorable Bishop score (>6)', () => {
    const res = evaluateObstetricPostterm({
      gestationalAgeWeeks: 41.1,
      datingMethod: 'first_trimester_ultrasound_crl',
      amnioticFluidIndexCm: 8.5,
      singleDeepestPocketCm: 3.2,
      nonStressTestResult: 'reactive',
      cervicalDilationCm: 4.0,
      cervicalEffacementPct: 80,
      fetalStation: 1,
      cervicalConsistency: 'soft',
      cervicalPosition: 'anterior',
      priorCesareanSection: false,
    });

    expect(res.bishop.isFavorable).toBe(true);
    expect(res.recommendedRipeningMethod).toBe('oxytocin_direct_infusion');
    expect(res.ripeningGuidance).toContain('Oxytocin');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric Post-Term REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. Meera Sen (MFM Obstetrician)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.lnd',
      fullName: 'Nurse Sunita (Labor & Delivery)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.lnd', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.lnd', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.lnd',
      fullName: 'L&D Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.lnd', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.lnd', PW);

    // Create a demo patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Roy (41w Postterm)',
      dateOfBirth: '1995-04-12',
      phone: '+91 98112 23344',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('evaluates postterm preview without database persistence', async () => {
    const res = await call('POST', '/api/obstetric-postterm/evaluate', doctor, {
      gestationalAgeWeeks: 41.5,
      datingMethod: 'first_trimester_ultrasound_crl',
      amnioticFluidIndexCm: 4.8,
      singleDeepestPocketCm: 1.9,
      nonStressTestResult: 'reactive',
      cervicalDilationCm: 1.0,
      cervicalEffacementPct: 30,
      fetalStation: -2,
      cervicalConsistency: 'firm',
      cervicalPosition: 'posterior',
      priorCesareanSection: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.oligohydramniosPresent).toBe(true);
    expect(res.body.evalResult.recommendedRipeningMethod).toBe('dinoprostone_pge2_insert');
  });

  it('creates, retrieves, logs flowsheet, updates, and deletes episode with strict RBAC', async () => {
    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/obstetric-postterm/episodes', attender, {
      patientId,
      assessmentDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 41.4,
      datingMethod: 'first_trimester_ultrasound_crl',
      amnioticFluidIndexCm: 6.2,
      singleDeepestPocketCm: 2.5,
      nonStressTestResult: 'reactive',
      cervicalDilationCm: 1.5,
      cervicalEffacementPct: 40,
      fetalStation: -2,
      cervicalConsistency: 'firm',
      cervicalPosition: 'posterior',
      priorCesareanSection: true,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/obstetric-postterm/episodes', doctor, {
      patientId,
      assessmentDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 41.4,
      datingMethod: 'first_trimester_ultrasound_crl',
      amnioticFluidIndexCm: 6.2,
      singleDeepestPocketCm: 2.5,
      nonStressTestResult: 'reactive',
      cervicalDilationCm: 1.5,
      cervicalEffacementPct: 40,
      fetalStation: -2,
      cervicalConsistency: 'firm',
      cervicalPosition: 'posterior',
      priorCesareanSection: true,
      status: 'inpatient_cervical_ripening',
      clinicalNotes: 'Prior LSCS, prostaglandins contraindicated, Foley balloon placed',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('POSTTERM-');
    expect(createRes.body.episode.recommended_ripening_method).toBe('mechanical_foley_balloon');

    // 3. Nurse lists episodes (200)
    const listRes = await call('GET', `/api/obstetric-postterm/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Nurse adds flowsheet log (201)
    const logRes = await call('POST', `/api/obstetric-postterm/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromRipeningStart: 6.0,
      bishopScoreCurrent: 7,
      dilationCm: 3.5,
      effacementPct: 70,
      contractionsPer10min: 3,
      fetalHeartRateBpm: 138,
      fhrCategory: 'category_1_normal',
      tachysystolePresent: false,
      actionTaken: 'balloon_expelled_ready_amniotomy',
      notes: 'Foley balloon expelled spontaneously, cervix now ripe',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 5. Get episode by ID
    const getRes = await call('GET', `/api/obstetric-postterm/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.logs.length).toBe(1);

    // 6. Doctor updates episode
    const updateRes = await call('PATCH', `/api/obstetric-postterm/episodes/${episodeId}`, doctor, {
      status: 'oxytocin_labor_induction',
      clinicalNotes: 'Amniotomy performed, oxytocin infusion started at 2 mU/min',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('oxytocin_labor_induction');

    // 7. Nurse cannot delete episode (403)
    const nurseDel = await call('DELETE', `/api/obstetric-postterm/episodes/${episodeId}`, nurse);
    expect(nurseDel.status).toBe(403);

    // 8. Delete flowsheet log
    const delLog = await call('DELETE', `/api/obstetric-postterm/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLog.status).toBe(200);

    // 9. Doctor deletes episode
    const delRes = await call('DELETE', `/api/obstetric-postterm/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
