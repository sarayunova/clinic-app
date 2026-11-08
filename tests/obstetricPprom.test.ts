import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  evaluateTripleICriteria,
  evaluateObstetricPprom,
} from '../web/src/obstetricPpromEngine.js';

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
describe('Obstetric PPROM & Triple I Engine (Pure Unit Tests)', () => {
  it('correctly assesses Triple I criteria according to NICHD / ACOG standards', () => {
    // Isolated fever without other criteria
    const isolated = evaluateTripleICriteria({
      gestationWeeks: 30,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      maternalTemperatureCelsius: 38.2,
      maternalHeartRateBpm: 84,
      fetalHeartRateBpm: 140,
    });
    expect(isolated.category).toBe('isolated_maternal_fever');

    // Suspected Triple I: Fever + Fetal Tachycardia (>160 bpm)
    const suspected = evaluateTripleICriteria({
      gestationWeeks: 30,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      maternalTemperatureCelsius: 38.4,
      maternalHeartRateBpm: 95,
      fetalHeartRateBpm: 172,
    });
    expect(suspected.category).toBe('suspected_triple_i');

    // Confirmed Triple I: Fever + Amniocentesis Gram stain / culture positive
    const confirmed = evaluateTripleICriteria({
      gestationWeeks: 30,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      maternalTemperatureCelsius: 38.6,
      maternalHeartRateBpm: 105,
      fetalHeartRateBpm: 175,
      amniocentesisPositive: true,
    });
    expect(confirmed.category).toBe('confirmed_triple_i');
  });

  it('guides expectant latency management at 29w with steroids, MgSO4, and 7-day latency antibiotics', () => {
    const res = evaluateObstetricPprom({
      gestationWeeks: 29.3,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      maternalTemperatureCelsius: 36.8,
      maternalHeartRateBpm: 78,
      fetalHeartRateBpm: 135,
      maternalWbcPerUl: 9500,
      uterineTenderness: false,
      foulCervicalDischarge: false,
      gbsScreeningStatus: 'unknown',
    });

    expect(res.deliveryTimingPlan).toBe('expectant_management_to_34w');
    expect(res.immediateDeliveryIndicated).toBe(false);
    expect(res.antenatalCorticosteroidsIndicated).toBe(true);
    expect(res.mgso4NeuroprotectionIndicated).toBe(true); // GA < 32 weeks
    expect(res.latencyAntibioticsIndicated).toBe(true);
    expect(res.recommendedLatencyRegimen).toBe('ampicillin_erythromycin_standard');
    expect(res.deliveryTimingGuidance).toContain('34+0 WEEKS');
  });

  it('mandates immediate delivery when PPROM occurs at >= 34w 0d', () => {
    const res = evaluateObstetricPprom({
      gestationWeeks: 34.4,
      ruptureConfirmationMethod: 'biochemical_amnisure_actim_prom',
      maternalTemperatureCelsius: 36.9,
      maternalHeartRateBpm: 82,
      fetalHeartRateBpm: 140,
    });

    expect(res.deliveryTimingPlan).toBe('immediate_delivery_ge_34w');
    expect(res.immediateDeliveryIndicated).toBe(true);
    expect(res.mgso4NeuroprotectionIndicated).toBe(false); // GA >= 32w
    expect(res.antenatalCorticosteroidsIndicated).toBe(false); // >= 34w
    expect(res.deliveryTimingGuidance).toContain('34 weeks of gestation');
  });

  it('mandates immediate delivery and therapeutic IV antibiotics when suspected Triple I arises preterm', () => {
    const res = evaluateObstetricPprom({
      gestationWeeks: 28.0,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      maternalTemperatureCelsius: 38.6,
      maternalHeartRateBpm: 110,
      fetalHeartRateBpm: 172,
      maternalWbcPerUl: 18200,
      uterineTenderness: true,
      foulCervicalDischarge: true,
    });

    expect(res.deliveryTimingPlan).toBe('immediate_delivery_triple_i');
    expect(res.immediateDeliveryIndicated).toBe(true);
    expect(res.tripleICategory).toBe('suspected_triple_i');
    expect(res.deliveryTimingGuidance).toContain('proceed with delivery regardless of gestational age');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric PPROM REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. P. Sharma (Maternal-Fetal Specialist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.maternity',
      fullName: 'Staff Nurse Deepa (L&D)',
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
      username: 'attender.ld',
      fullName: 'Attender LD',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ld', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ld', PW);

    // Pregnant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Devi (PPROM 29w)',
      dateOfBirth: '1998-04-12',
      phone: '+91 98765 33333',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to preview evaluation, create episode, log flowsheet, and retrieve detail', async () => {
    // 1. Live preview calculation
    const previewRes = await call('POST', '/api/obstetric-pprom/evaluate', doctor, {
      gestationWeeks: 29.2,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      maternalTemperatureCelsius: 36.8,
      maternalHeartRateBpm: 80,
      fetalHeartRateBpm: 140,
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.evalResult.deliveryTimingPlan).toBe('expectant_management_to_34w');

    // 2. Create episode
    const createRes = await call('POST', '/api/obstetric-pprom/episodes', doctor, {
      patientId,
      ruptureDatetime: '2026-11-05T06:00',
      presentationDatetime: '2026-11-05T07:00',
      gestationWeeks: 29.2,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      amnioticFluidIndexCm: 4.5,
      latencyAntibioticsInitiated: true,
      latencyAntibioticRegimen: 'ampicillin_erythromycin_standard',
      antenatalCorticosteroidStatus: 'course_initiated',
      mgso4NeuroprotectionActive: false,
      gbsScreeningStatus: 'unknown',
      maternalTemperatureCelsius: 36.8,
      maternalHeartRateBpm: 80,
      fetalHeartRateBpm: 142,
      uterineTenderness: false,
      foulCervicalDischarge: false,
      maternalWbcPerUl: 9800,
      status: 'inpatient_latency_surveillance',
      clinicalNotes: 'PPROM confirmed by sterile speculum pooling. Latency protocol initiated.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('PPROM-');

    // 3. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/obstetric-pprom/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-05T18:00',
      hoursFromAdmission: 11.0,
      maternalTempC: 37.0,
      maternalHrBpm: 82,
      maternalBpSbp: 118,
      maternalBpDbp: 74,
      fetalHrBpm: 145,
      uterineContractionsPer10min: 0,
      amnioticFluidCharacter: 'clear',
      maternalWbc: 9900,
      ctgCategory: 'category_1_normal',
      notes: 'Afebrile, FHR reactive, no foul odor.',
    });
    expect(logRes.status).toBe(201);

    // 4. Retrieve single episode with flowsheet logs
    const getRes = await call('GET', `/api/obstetric-pprom/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.logs.length).toBe(1);
    expect(getRes.body.logs[0].maternal_temp_c).toBe(37.0);
    expect(getRes.body.evalResult.antenatalCorticosteroidsIndicated).toBe(true);

    // 5. Query episodes by status
    const listRes = await call('GET', '/api/obstetric-pprom/episodes?status=inpatient_latency_surveillance', doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 6. Doctor updates episode status
    const updateRes = await call('PATCH', `/api/obstetric-pprom/episodes/${episodeId}`, doctor, {
      status: 'labor_induction_delivery',
      clinicalNotes: 'Transitioned to delivery ward at 34w 0d.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('labor_induction_delivery');

    // 7. Attender is rejected with 403
    const attenderRes = await call('POST', '/api/obstetric-pprom/episodes', attender, {
      patientId,
      ruptureDatetime: '2026-11-06T10:00',
      presentationDatetime: '2026-11-06T11:00',
      gestationWeeks: 29.0,
      ruptureConfirmationMethod: 'pooling_ferning_nitrazine',
      maternalTemperatureCelsius: 37.0,
      maternalHeartRateBpm: 80,
      fetalHeartRateBpm: 140,
    });
    expect(attenderRes.status).toBe(403);

    // 8. Nurse cannot delete episode
    const nurseDelRes = await call('DELETE', `/api/obstetric-pprom/episodes/${episodeId}`, nurse);
    expect(nurseDelRes.status).toBe(403);

    // 9. Doctor deletes flowsheet log and episode
    const delLogRes = await call('DELETE', `/api/obstetric-pprom/episodes/${episodeId}/flowsheet-logs/${getRes.body.logs[0].id}`, doctor);
    expect(delLogRes.status).toBe(200);

    const delEpRes = await call('DELETE', `/api/obstetric-pprom/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });
});
