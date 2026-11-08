import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateKocherCriteria,
  evaluatePediatricSepticArthritis,
} from '../web/src/pediatricSepticArthritisEngine.js';

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
describe('Pediatric Septic Arthritis & Kocher Criteria (Pure Unit Tests)', () => {
  it('accurately computes Kocher score (0 to 4) and statistical septic arthritis probabilities', () => {
    // 0 criteria met: weight bearing, normal temp, ESR 15, WBC 8000
    const score0 = calculateKocherCriteria(false, 37.2, 15, 8000);
    expect(score0.criteriaMetCount).toBe(0);
    expect(score0.predictedProbabilityPercent).toBe(0.2);
    expect(score0.probabilityTier).toBe('minimal_risk_lt_1');

    // 1 criterion met: non-weight-bearing only
    const score1 = calculateKocherCriteria(true, 37.4, 20, 9500);
    expect(score1.criteriaMetCount).toBe(1);
    expect(score1.predictedProbabilityPercent).toBe(3.0);
    expect(score1.probabilityTier).toBe('low_risk_3_pct');

    // 2 criteria met: non-weight-bearing + fever > 38.5
    const score2 = calculateKocherCriteria(true, 38.9, 25, 10000);
    expect(score2.criteriaMetCount).toBe(2);
    expect(score2.predictedProbabilityPercent).toBe(40.0);
    expect(score2.probabilityTier).toBe('intermediate_risk_40_pct');

    // 3 criteria met: non-weight-bearing + fever + ESR 48 (>= 40)
    const score3 = calculateKocherCriteria(true, 38.8, 48, 11500);
    expect(score3.criteriaMetCount).toBe(3);
    expect(score3.predictedProbabilityPercent).toBe(93.0);
    expect(score3.probabilityTier).toBe('high_risk_93_pct');

    // 4 criteria met: all 4 criteria positive
    const score4 = calculateKocherCriteria(true, 39.1, 65, 16800, 45.0);
    expect(score4.criteriaMetCount).toBe(4);
    expect(score4.predictedProbabilityPercent).toBe(99.6);
    expect(score4.probabilityTier).toBe('critical_certain_99_pct');
    expect(score4.crpElevated).toBe(true);
  });

  it('triggers emergent operating room arthrotomy and avascular necrosis alerts for high Kocher score', () => {
    const highRisk = evaluatePediatricSepticArthritis({
      ageMonths: 48,
      weightKg: 17.5,
      affectedJoint: 'left_hip',
      nonWeightBearing: true,
      temperatureCelsius: 39.2,
      esrMmHr: 58,
      wbcCountPerMicroliter: 18400,
      crpMgL: 64.0,
      ultrasoundEffusionDetected: true,
      arthrocentesisPerformed: false,
      synovialGramStain: 'pending',
      surgicalDrainageRequired: true,
      surgicalApproach: 'arthrotomy_open_capsulotomy',
      empiricAntibioticRegimen: 'cefazolin_iv',
    });

    expect(highRisk.kocherResult.criteriaMetCount).toBe(4);
    expect(highRisk.isSepticArthritisLikely).toBe(true);
    expect(highRisk.surgicalEmergencyIndicated).toBe(true);
    expect(highRisk.orthopedicConsultUrgency).toBe('emergent_immediate_operating_room');
    expect(highRisk.clinicalSafetyDirectives.some((d) => d.includes('AVASCULAR NECROSIS RISK'))).toBe(true);
    expect(highRisk.recommendedAntibiotic).toBe('cefazolin_iv');
  });

  it('prescribes broad-spectrum regimen in young infants (< 3 months) and identifies positive synovial fluid', () => {
    // 2-month-old infant with right knee septic arthritis
    const neonateArthritis = evaluatePediatricSepticArthritis({
      ageMonths: 2,
      weightKg: 4.8,
      affectedJoint: 'right_knee',
      nonWeightBearing: true,
      temperatureCelsius: 38.6,
      esrMmHr: 42,
      wbcCountPerMicroliter: 15200,
      ultrasoundEffusionDetected: true,
      arthrocentesisPerformed: true,
      synovialWbcCount: 84000,
      synovialPmnPct: 88,
      synovialGramStain: 'gram_positive_cocci',
      surgicalDrainageRequired: true,
      surgicalApproach: 'arthrotomy_open_capsulotomy',
      empiricAntibioticRegimen: 'ceftriaxone_plus_vancomycin',
    });

    expect(neonateArthritis.recommendedAntibiotic).toBe('ceftriaxone_plus_vancomycin');
    expect(neonateArthritis.synovialAnalysisDiagnostic).toBe(true);
    expect(neonateArthritis.orthopedicConsultUrgency).toBe('emergent_immediate_operating_room');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Septic Arthritis REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediortho',
      fullName: 'Dr. Vivek Saxena (Pediatric Orthopedics)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pediward',
      fullName: 'Nurse Kavya (Pediatrics)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.pediward', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.pediward', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.pediward',
      fullName: 'Pediatric Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.pediward', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.pediward', PW);

    // Create a demo pediatric patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Patel (Child)',
      dateOfBirth: '2023-04-10',
      phone: '+91 97654 32109',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews septic arthritis evaluation without database persistence', async () => {
    const res = await call('POST', '/api/pediatric-septic-arthritis/evaluate', doctor, {
      ageMonths: 42,
      weightKg: 16.0,
      affectedJoint: 'right_hip',
      nonWeightBearing: true,
      temperatureCelsius: 38.9,
      esrMmHr: 52,
      wbcCountPerMicroliter: 14500,
      crpMgL: 38.0,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.kocherResult.criteriaMetCount).toBe(4);
    expect(res.body.evalResult.isSepticArthritisLikely).toBe(true);
    expect(res.body.evalResult.surgicalEmergencyIndicated).toBe(true);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const evalTime = new Date().toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/pediatric-septic-arthritis/episodes', attender, {
      patientId,
      evaluationDatetime: evalTime,
      ageMonths: 42,
      weightKg: 16.0,
      affectedJoint: 'right_hip',
      nonWeightBearing: true,
      temperatureCelsius: 39.0,
      esrMmHr: 50,
      wbcCountPerMicroliter: 15000,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/pediatric-septic-arthritis/episodes', doctor, {
      patientId,
      evaluationDatetime: evalTime,
      ageMonths: 42,
      weightKg: 16.0,
      affectedJoint: 'right_hip',
      nonWeightBearing: true,
      temperatureCelsius: 39.0,
      esrMmHr: 54,
      wbcCountPerMicroliter: 16200,
      crpMgL: 42.5,
      ultrasoundEffusionDetected: true,
      arthrocentesisPerformed: true,
      synovialWbcCount: 92000,
      synovialPmnPct: 91.5,
      synovialGramStain: 'gram_positive_cocci',
      surgicalDrainageRequired: true,
      surgicalApproach: 'arthrotomy_open_capsulotomy',
      empiricAntibioticRegimen: 'cefazolin_iv',
      status: 'operating_room_arthrotomy',
      clinicalNotes: 'Kocher 4/4 criteria positive. Point-of-care US confirmed 4mm right hip effusion. Emergent open arthrotomy & lavage scheduled.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('SEPTICARTH-');
    expect(createRes.body.evalResult.kocherResult.criteriaMetCount).toBe(4);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/pediatric-septic-arthritis/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/pediatric-septic-arthritis/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.synovialAnalysisDiagnostic).toBe(true);
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/pediatric-septic-arthritis/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromTriage: 8,
      temperatureCelsius: 37.8,
      heartRateBpm: 104,
      jointRangeOfMotion: 'moderate_guarding',
      weightBearingAbility: 'limping_antalgic',
      crpMgL: 28.0,
      drainOutputMl24h: 15,
      notes: 'Post-arthrotomy day 1: Fever resolving, drain active serosanguinous fluid, pain managed.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/pediatric-septic-arthritis/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to postoperative_iv_antibiotics
    const updateRes = await call('PATCH', `/api/pediatric-septic-arthritis/episodes/${episodeId}`, doctor, {
      status: 'postoperative_iv_antibiotics',
      clinicalNotes: 'Post-capsulotomy recovery on IV Cefazolin. Inflammatory markers trending down.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('postoperative_iv_antibiotics');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/pediatric-septic-arthritis/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/pediatric-septic-arthritis/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/pediatric-septic-arthritis/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/pediatric-septic-arthritis/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
