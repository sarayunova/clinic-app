import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricEcv } from '../web/src/obstetricEcvEngine.js';

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

describe('Obstetric ECV Engine (Pure Unit Tests)', () => {
  it('correctly calculates high success likelihood for favorable multiparous candidate with tocolysis', () => {
    const res = evaluateObstetricEcv({
      gestationalAgeWeeks: 37.4,
      maternalParity: 2,
      maternalBmi: 24.5,
      fetalPresentationInitial: 'frank_breech',
      placentalLocation: 'posterior',
      amnioticFluidIndexCm: 14.0,
      estimatedFetalWeightG: 3200,
      fetalSpinePosition: 'lateral',
      fetalEngagementLevel: 'high_unengaged_floating',
      terbutalineGiven: true,
      maternalRhNegative: false,
    });

    expect(res.isEligibleForEcv).toBe(true);
    expect(res.hasAbsoluteContraindications).toBe(false);
    expect(res.calculatedSuccessProbabilityPct).toBeGreaterThanOrEqual(65);
    expect(res.successLikelihoodTier).toBe('high');
    expect(res.rhManagementProtocol.antiDIndicated).toBe(false);
  });

  it('identifies absolute contraindication for placenta previa and sets probability to 0%', () => {
    const res = evaluateObstetricEcv({
      gestationalAgeWeeks: 37.0,
      maternalParity: 1,
      maternalBmi: 25.0,
      fetalPresentationInitial: 'frank_breech',
      placentalLocation: 'low_lying_placenta_previa',
      amnioticFluidIndexCm: 12.0,
      estimatedFetalWeightG: 3100,
      fetalSpinePosition: 'lateral',
      fetalEngagementLevel: 'high_unengaged_floating',
      terbutalineGiven: true,
      maternalRhNegative: true,
    });

    expect(res.isEligibleForEcv).toBe(false);
    expect(res.hasAbsoluteContraindications).toBe(true);
    expect(res.calculatedSuccessProbabilityPct).toBe(0);
    expect(res.successLikelihoodTier).toBe('contraindicated');
    expect(res.alerts.some(a => a.includes('ECV CONTRAINDICATED'))).toBe(true);
  });

  it('mandates Anti-D and Kleihauer-Betke testing for Rh-negative mother', () => {
    const res = evaluateObstetricEcv({
      gestationalAgeWeeks: 37.2,
      maternalParity: 0,
      maternalBmi: 26.0,
      fetalPresentationInitial: 'complete_breech',
      placentalLocation: 'fundal',
      amnioticFluidIndexCm: 11.0,
      estimatedFetalWeightG: 2950,
      fetalSpinePosition: 'posterior',
      fetalEngagementLevel: 'dipping_in_pelvis',
      terbutalineGiven: true,
      maternalRhNegative: true,
    });

    expect(res.rhManagementProtocol.antiDIndicated).toBe(true);
    expect(res.rhManagementProtocol.recommendedDoseMcg).toBe(300);
    expect(res.rhManagementProtocol.kleihauerBetkeIndicated).toBe(true);
  });
});

describe('Obstetric ECV Protocol Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.ecv',
      fullName: 'Dr. Anita Obstetrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ecv',
      fullName: 'Nurse Priya L&D',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ecv', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ecv', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ecv',
      fullName: 'Attender Manoj',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ecv', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ecv', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Meera Sharma (G2P1)',
      dateOfBirth: '1996-05-14',
      phone: '9876543211',
      address: 'L&D Suite 2',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to preview evaluation, create ECV episode and track flowsheet', async () => {
    // 1. Preview evaluate
    const preview = await call('POST', '/api/obstetric-ecv/evaluate', doctor, {
      gestationalAgeWeeks: 37.3,
      maternalParity: 1,
      maternalBmi: 26.2,
      fetalPresentationInitial: 'frank_breech',
      placentalLocation: 'posterior',
      amnioticFluidIndexCm: 13.5,
      estimatedFetalWeightG: 3150,
      fetalSpinePosition: 'lateral',
      fetalEngagementLevel: 'high_unengaged_floating',
      terbutalineGiven: true,
      maternalRhNegative: true,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.evaluation.isEligibleForEcv).toBe(true);
    expect(preview.body.evaluation.calculatedSuccessProbabilityPct).toBeGreaterThan(60);

    // 2. Create episode
    const created = await call('POST', '/api/obstetric-ecv/episodes', doctor, {
      patientId,
      procedureDatetime: '2026-11-08T07:15:00',
      gestationalAgeWeeks: 37.3,
      maternalParity: 1,
      maternalBmi: 26.2,
      fetalPresentationInitial: 'frank_breech',
      placentalLocation: 'posterior',
      amnioticFluidIndexCm: 13.5,
      estimatedFetalWeightG: 3150,
      fetalSpinePosition: 'lateral',
      fetalEngagementLevel: 'high_unengaged_floating',
      tocolyticAgentAdministered: 'terbutaline_0_25mg_sc',
      terbutalineGiven: true,
      maternalRhNegative: true,
      rhAntiDAdministered: true,
      kleihauerBetkeSent: true,
      attemptsCount: 1,
      forwardRollAttempted: true,
      backwardFlipAttempted: false,
      ecvOutcome: 'successful_cephalic_conversion',
      status: 'successful_monitoring_discharge',
      clinicalNotes: 'Cephalic conversion achieved on initial forward roll maneuver.',
    });

    expect(created.status).toBe(201);
    expect(created.body.episodeCode).toMatch(/^ECV-/);
    const episodeId = created.body.episodeId || created.body.id;
    expect(episodeId).toBeGreaterThan(0);

    // 3. Get episode details
    const detail = await call('GET', `/api/obstetric-ecv/episodes/${episodeId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.episode.ecv_outcome).toBe('successful_cephalic_conversion');

    // 4. Update status
    const statusUpdate = await call('PATCH', `/api/obstetric-ecv/episodes/${episodeId}/status`, doctor, {
      status: 'successful_monitoring_discharge',
      clinicalNotes: 'Reactive CTG, cephalic vertex confirmed by bedside ultrasound, discharged.',
    });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.success).toBe(true);

    // 5. Nurse adds flowsheet log
    const logAdd = await call('POST', `/api/obstetric-ecv/episodes/${episodeId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T07:30:00',
      minutesFromStart: 15.0,
      maternalHeartRate: 88,
      maternalBloodPressureSys: 118,
      maternalBloodPressureDia: 74,
      fetalHeartRateBaseline: 142,
      efmPattern: 'reactive_reassuring',
      uterineRelaxationAdequate: true,
      notes: 'Uterus relaxed post-Terbutaline. Fetal heart reactive.',
    });
    expect(logAdd.status).toBe(201);
    const logId = logAdd.body.id || logAdd.body.logId;
    expect(logId).toBeGreaterThan(0);

    // 6. Delete flowsheet log
    const logDel = await call('DELETE', `/api/obstetric-ecv/flowsheet/${logId}`, nurse);
    expect(logDel.status).toBe(200);
    expect(logDel.body.success).toBe(true);
  });

  it('enforces RBAC preventing attender from creating or altering ECV records', async () => {
    const unauth = await call('POST', '/api/obstetric-ecv/episodes', attender, {
      patientId,
      procedureDatetime: '2026-11-08T07:15:00',
      gestationalAgeWeeks: 37.3,
      maternalParity: 1,
      maternalBmi: 26.2,
      fetalPresentationInitial: 'frank_breech',
      placentalLocation: 'posterior',
      amnioticFluidIndexCm: 13.5,
      estimatedFetalWeightG: 3150,
      fetalSpinePosition: 'lateral',
      fetalEngagementLevel: 'high_unengaged_floating',
    });
    expect(unauth.status).toBe(403);
  });
});
