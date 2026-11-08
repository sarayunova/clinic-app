import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import { evaluatePediatricIntussusception } from '../web/src/pediatricIntussusceptionEngine.js';

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
describe('Pediatric Intussusception & Enema Reduction (Pure Unit Tests)', () => {
  it('confirms intussusception by ultrasound, verifies classic triad, and checks pressure limits', () => {
    // 8-month-old infant, 100 mmHg pneumatic enema (safe <= 120 mmHg)
    const infant = evaluatePediatricIntussusception({
      ageMonths: 8,
      weightKg: 8.5,
      symptomDurationHours: 12,
      intermittentColickyPain: true,
      vomitingBilious: true,
      redCurrantJellyStool: true,
      palpableAbdominalMass: true,
      lethargyAlteredSensorium: false,
      ultrasoundTargetSignDetected: true,
      ultrasoundOuterDiameterMm: 28.0,
      pseudokidneySignPresent: true,
      pathologicLeadPointSuspected: false,
      leadPointType: 'none_idiopathic',
      peritonitisSignsPresent: false,
      pneumoperitoneumOnXray: false,
      reductionAttempted: true,
      reductionMethod: 'pneumatic_air_enema',
      maximumPressureMmhg: 100.0,
      reductionAttemptsCount: 2,
      reductionSuccessful: true,
      cecalIlealRefluxVisualized: true,
      surgicalExplorationRequired: false,
    });

    expect(infant.intussusceptionDiagnosed).toBe(true);
    expect(infant.classicTriadPresent).toBe(true);
    expect(infant.contraindicationToEnemaReduction).toBe(false);
    expect(infant.pressureLimitExceeded).toBe(false);
    expect(infant.maximumPermissiblePressureMmhg).toBe(120.0);
    expect(infant.surgicalEmergencyIndicated).toBe(false);
  });

  it('detects pneumatic overpressurization beyond age-appropriate limits', () => {
    // 4-month-old infant (< 6 months, limit is 80 mmHg), 95 mmHg air pressure used -> exceeds limit
    const overpressure = evaluatePediatricIntussusception({
      ageMonths: 4,
      weightKg: 6.2,
      symptomDurationHours: 8,
      intermittentColickyPain: true,
      vomitingBilious: false,
      redCurrantJellyStool: false,
      palpableAbdominalMass: true,
      lethargyAlteredSensorium: false,
      ultrasoundTargetSignDetected: true,
      pseudokidneySignPresent: true,
      pathologicLeadPointSuspected: false,
      leadPointType: 'none_idiopathic',
      peritonitisSignsPresent: false,
      pneumoperitoneumOnXray: false,
      reductionAttempted: true,
      reductionMethod: 'pneumatic_air_enema',
      maximumPressureMmhg: 95.0, // EXCEEDS 80 mmHg limit for < 6 months
      reductionAttemptsCount: 1,
      reductionSuccessful: false,
      cecalIlealRefluxVisualized: false,
      surgicalExplorationRequired: false,
    });

    expect(overpressure.maximumPermissiblePressureMmhg).toBe(80.0);
    expect(overpressure.pressureLimitExceeded).toBe(true);
    expect(overpressure.criticalActionPlan.some((p) => p.includes('exceeds age-appropriate limit'))).toBe(true);
  });

  it('strictly contraindicates enema reduction when peritonitis or pneumoperitoneum is present', () => {
    const perforated = evaluatePediatricIntussusception({
      ageMonths: 10,
      weightKg: 9.0,
      symptomDurationHours: 36,
      intermittentColickyPain: true,
      vomitingBilious: true,
      redCurrantJellyStool: true,
      palpableAbdominalMass: true,
      lethargyAlteredSensorium: true,
      ultrasoundTargetSignDetected: true,
      pseudokidneySignPresent: true,
      pathologicLeadPointSuspected: false,
      leadPointType: 'none_idiopathic',
      peritonitisSignsPresent: true, // PERITONITIS
      pneumoperitoneumOnXray: true, // FREE AIR
      reductionAttempted: false,
      reductionMethod: 'none_primary_surgery',
      maximumPressureMmhg: 0,
      reductionAttemptsCount: 0,
      reductionSuccessful: false,
      cecalIlealRefluxVisualized: false,
      surgicalExplorationRequired: true,
    });

    expect(perforated.contraindicationToEnemaReduction).toBe(true);
    expect(perforated.surgicalEmergencyIndicated).toBe(true);
    expect(perforated.contraindicationReasons.length).toBe(2);
    expect(perforated.criticalActionPlan.some((p) => p.includes('STRICTLY CONTRAINDICATED'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Intussusception REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedisurgintuss',
      fullName: 'Dr. Vivek Saxena (Pediatric Surgery)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pediintuss',
      fullName: 'Nurse Pooja (Pediatrics)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.pediintuss', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.pediintuss', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.pediintuss',
      fullName: 'Pediatric Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.pediintuss', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.pediintuss', PW);

    // Create a demo pediatric patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Patel (Child)',
      dateOfBirth: '2026-03-01',
      phone: '+91 97654 32109',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews intussusception evaluation without database persistence', async () => {
    const res = await call('POST', '/api/pediatric-intussusception/evaluate', doctor, {
      ageMonths: 8,
      weightKg: 8.5,
      symptomDurationHours: 12,
      intermittentColickyPain: true,
      vomitingBilious: true,
      redCurrantJellyStool: true,
      palpableAbdominalMass: true,
      ultrasoundTargetSignDetected: true,
      reductionAttempted: true,
      reductionMethod: 'pneumatic_air_enema',
      maximumPressureMmhg: 100,
      reductionAttemptsCount: 2,
      reductionSuccessful: true,
      cecalIlealRefluxVisualized: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.intussusceptionDiagnosed).toBe(true);
    expect(res.body.evalResult.classicTriadPresent).toBe(true);
    expect(res.body.evalResult.contraindicationToEnemaReduction).toBe(false);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const presTime = new Date().toISOString();

    // 1. Attender cannot create episode (403)
    const attenderCreate = await call('POST', '/api/pediatric-intussusception/episodes', attender, {
      patientId,
      presentationDatetime: presTime,
      ageMonths: 8,
      weightKg: 8.5,
      symptomDurationHours: 12,
      reductionMethod: 'pneumatic_air_enema',
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/pediatric-intussusception/episodes', doctor, {
      patientId,
      presentationDatetime: presTime,
      ageMonths: 8,
      weightKg: 8.5,
      symptomDurationHours: 12,
      intermittentColickyPain: true,
      vomitingBilious: true,
      redCurrantJellyStool: true,
      palpableAbdominalMass: true,
      lethargyAlteredSensorium: false,
      ultrasoundTargetSignDetected: true,
      ultrasoundOuterDiameterMm: 28.0,
      pseudokidneySignPresent: true,
      pathologicLeadPointSuspected: false,
      leadPointType: 'none_idiopathic',
      peritonitisSignsPresent: false,
      pneumoperitoneumOnXray: false,
      reductionAttempted: true,
      reductionMethod: 'pneumatic_air_enema',
      maximumPressureMmhg: 100,
      reductionAttemptsCount: 2,
      reductionSuccessful: true,
      cecalIlealRefluxVisualized: true,
      surgicalExplorationRequired: false,
      status: 'reduction_successful_observation',
      clinicalNotes: 'Air enema reduction successful on second attempt at 100 mmHg. Free ileal reflux seen. Admitted for observation.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('INTUSS-');
    expect(episode.reduction_successful).toBe(1);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/pediatric-intussusception/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/pediatric-intussusception/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.classicTriadPresent).toBe(true);
    expect(getRes.body.logs).toEqual([]);

    // 5. Nurse adds a flowsheet log
    const logRes = await call('POST', `/api/pediatric-intussusception/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      minutesFromProcedure: 60,
      heartRateBpm: 108,
      bloodPressureSys: 96,
      bloodPressureDia: 58,
      abdominalSoftNonTender: true,
      colickyPainRecurrence: false,
      oralIntakeTolerated: true,
      notes: '1h post-reduction: Abdomen soft, oral sips of ORS tolerated without vomiting.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Verify flowsheet appears in detail
    const detailAfterLog = await call('GET', `/api/pediatric-intussusception/episodes/${episodeId}`, doctor);
    expect(detailAfterLog.body.logs.length).toBe(1);
    expect(detailAfterLog.body.logs[0].id).toBe(logId);

    // 7. Update status to resolved_discharged
    const updateRes = await call('PATCH', `/api/pediatric-intussusception/episodes/${episodeId}`, doctor, {
      status: 'resolved_discharged',
      clinicalNotes: '24-hour observation uneventful. Full feeds tolerated, no recurrence of colic.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('resolved_discharged');

    // 8. Delete flowsheet log
    const delLogRes = await call('DELETE', `/api/pediatric-intussusception/episodes/${episodeId}/flowsheet-logs/${logId}`, doctor);
    expect(delLogRes.status).toBe(200);

    // 9. Attender cannot delete episode (403)
    const attenderDel = await call('DELETE', `/api/pediatric-intussusception/episodes/${episodeId}`, attender);
    expect(attenderDel.status).toBe(403);

    // 10. Doctor deletes episode (200)
    const delRes = await call('DELETE', `/api/pediatric-intussusception/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 11. Confirm deleted
    const notFoundRes = await call('GET', `/api/pediatric-intussusception/episodes/${episodeId}`, doctor);
    expect(notFoundRes.status).toBe(404);
  });
});
