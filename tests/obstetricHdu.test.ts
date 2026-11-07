import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluateMgso4Safety,
  getHypertensiveCrisisLadder,
} from '../web/src/mgso4Engine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: unknown,
) {
  const res = await app.inject({
    method,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
  const sc = res.headers['set-cookie'];
  return {
    status: res.statusCode,
    headers: res.headers,
    body: (res.body ? (res.headers['content-type']?.includes('application/json') ? JSON.parse(res.body) : res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

// -------------------------------------------------------------
// Pure Clinical Engine Tests
// -------------------------------------------------------------
describe('Obstetric HDU & MgSO4 Resuscitation Engine (Pure Unit Tests)', () => {
  it('correctly assesses therapeutic safety vs warning vs critical toxicity', () => {
    // 1. Normal therapeutic check
    const normalCheck = evaluateMgso4Safety({
      patellarReflex: 'normal_2_plus',
      respiratoryRateBpm: 18,
      urineOutputLastHourMl: 45,
      serumMagnesiumMgDl: 6.0,
    });
    expect(normalCheck.isSafeToContinue).toBe(true);
    expect(normalCheck.toxicitySeverity).toBe('normal_therapeutic');
    expect(normalCheck.emergencyActionRequired).toBe(false);

    // 2. Warning threshold: Oliguria (<30 mL/hr)
    const oliguricCheck = evaluateMgso4Safety({
      patellarReflex: 'normal_2_plus',
      respiratoryRateBpm: 18,
      urineOutputLastHourMl: 22,
    });
    expect(oliguricCheck.isSafeToContinue).toBe(false);
    expect(oliguricCheck.toxicitySeverity).toBe('warning_hold_recheck');
    expect(oliguricCheck.recommendedActions.some(a => a.includes('HOLD next IM dose or pause IV'))).toBe(true);

    // 3. Critical Toxicity: Absent Knee Jerk (DTR = 0)
    const absentReflexCheck = evaluateMgso4Safety({
      patellarReflex: 'absent_0',
      respiratoryRateBpm: 16,
      urineOutputLastHourMl: 40,
    });
    expect(absentReflexCheck.isSafeToContinue).toBe(false);
    expect(absentReflexCheck.toxicitySeverity).toBe('critical_antidote_indicated');
    expect(absentReflexCheck.emergencyActionRequired).toBe(true);
    expect(absentReflexCheck.recommendedActions.some(a => a.includes('10% Calcium Gluconate'))).toBe(true);

    // 4. Critical Toxicity: Severe bradypnea (RR < 12)
    const bradypneaCheck = evaluateMgso4Safety({
      patellarReflex: 'normal_2_plus',
      respiratoryRateBpm: 10,
      urineOutputLastHourMl: 40,
    });
    expect(bradypneaCheck.toxicitySeverity).toBe('critical_antidote_indicated');
    expect(bradypneaCheck.emergencyActionRequired).toBe(true);
  });

  it('provides stepped hypertensive crisis titration ladder for acute BP >= 160/110', () => {
    const steps = getHypertensiveCrisisLadder();
    expect(steps.length).toBe(3);
    expect(steps[0]?.agent).toBe('IV Labetalol');
    expect(steps[0]?.doseRoute).toContain('20 mg IV');
    expect(steps[1]?.agent).toBe('Oral Nifedipine');
    expect(steps[2]?.agent).toBe('IV Hydralazine');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric HDU & MgSO4 Resuscitation REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Sunita Deshmukh, MD (OBGYN)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.hdu',
      fullName: 'Sister Priya HDU',
      role: 'nurse',
      password: 'temp-pass-nurse-hdu',
    });
    const nurseFirst = await login('nurse.hdu', 'temp-pass-nurse-hdu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-hdu',
      newPassword: PW,
    });
    nurse = await login('nurse.hdu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.reception',
      fullName: 'Front Desk Attender',
      role: 'attender',
      password: 'temp-pass-desk-hdu',
    });
    const deskFirst = await login('desk.reception', 'temp-pass-desk-hdu');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-hdu',
      newPassword: PW,
    });
    attender = await login('desk.reception', PW);

    // Create obstetric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Mrs. Kavita Verma',
      dateOfBirth: '1996-08-15',
      estimatedAgeYears: 28,
      phone: '9811223344',
      address: 'Bhopal, MP',
      gravida: 1,
      para: 0,
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('initiates Zuspan IV protocol, records hourly checks, triggers toxicity antidote, and manages status', async () => {
    // 1. Initiate Zuspan Regimen (4g IV load + 1g/h IV)
    const protoRes = await call('POST', '/api/mgso4/protocols', doctor, {
      patientId,
      regimenType: 'zuspan_iv',
      indication: 'severe_preeclampsia_impending',
      initiationDatetime: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      loadingDoseDetails: '4g IV over 20 min in 100 mL NS',
      maintenanceRateGPerH: 1.0,
    });
    expect(protoRes.status).toBe(201);
    expect(protoRes.body.protocol.regimen_type).toBe('zuspan_iv');
    expect(protoRes.body.protocol.status).toBe('active');
    const protocolId = protoRes.body.protocol.id;

    // 2. Nurse logs Hour 1 flowsheet check (Normal)
    const check1 = await call('POST', `/api/mgso4/protocols/${protocolId}/flowsheet`, nurse, {
      observationDatetime: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      hourNumber: 1,
      patellarReflex: 'normal_2_plus',
      respiratoryRateBpm: 18,
      urineOutputLastHourMl: 45,
      bloodPressureSys: 154,
      bloodPressureDia: 96,
      heartRateBpm: 88,
      spo2Percent: 99,
      serumMagnesiumMgDl: 5.2,
      actionTaken: 'continue_regimen',
      notes: 'Patient stable, alert, no visual disturbances.',
    });
    expect(check1.status).toBe(201);
    expect(check1.body.flowsheetEntry.toxicity_warning_triggered).toBe(0);

    // 3. Nurse logs Hour 2 flowsheet check (Toxic: Absent Knee Jerk + Oliguria)
    const check2 = await call('POST', `/api/mgso4/protocols/${protocolId}/flowsheet`, nurse, {
      observationDatetime: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      hourNumber: 2,
      patellarReflex: 'absent_0',
      respiratoryRateBpm: 14,
      urineOutputLastHourMl: 20,
      bloodPressureSys: 162,
      bloodPressureDia: 112,
      heartRateBpm: 82,
      spo2Percent: 96,
      actionTaken: 'hold_dose_recheck',
      antihypertensiveGiven: 'IV Labetalol 20mg bolus',
      notes: 'Knee jerk lost, oliguria noted. Infusion halted.',
    });
    expect(check2.status).toBe(201);
    expect(check2.body.flowsheetEntry.toxicity_warning_triggered).toBe(1);

    // 4. Trigger Emergency 10% Calcium Gluconate Antidote
    const antidoteRes = await call('POST', `/api/mgso4/protocols/${protocolId}/antidote`, doctor, {
      antidoteIndication: 'Loss of patellar reflexes, respiratory rate drop to 14 bpm',
    });
    expect(antidoteRes.status).toBe(200);
    expect(antidoteRes.body.success).toBe(true);

    // 5. Verify protocol detail has antidote flagged and 2 flowsheet entries
    const detailRes = await call('GET', `/api/mgso4/protocols/${protocolId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.protocol.antidote_calcium_gluconate_given).toBe(1);
    expect(detailRes.body.flowsheet.length).toBe(2);

    // 6. Terminate protocol due to toxicity
    const termRes = await call('PUT', `/api/mgso4/protocols/${protocolId}/status`, doctor, {
      status: 'held_toxicity',
      terminationReason: 'Stopped after Calcium Gluconate antidote; patient stabilized.',
    });
    expect(termRes.status).toBe(200);
    expect(termRes.body.protocol.status).toBe('held_toxicity');

    // 7. Test audit print endpoint
    const printRes = await call('POST', `/api/mgso4/protocols/${protocolId}/print`, nurse);
    expect(printRes.status).toBe(200);
    expect(printRes.body.success).toBe(true);

    // 8. Test HDU dashboard endpoint
    const dashRes = await call('GET', '/api/mgso4/dashboard', doctor);
    expect(dashRes.status).toBe(200);
    expect(Array.isArray(dashRes.body.activeProtocols)).toBe(true);

    // 9. RBAC: Attender blocked from creating protocol or flowsheet checks (403)
    const blockedProto = await call('POST', '/api/mgso4/protocols', attender, {
      patientId,
      regimenType: 'zuspan_iv',
      indication: 'severe_preeclampsia_impending',
      initiationDatetime: new Date().toISOString(),
      loadingDoseDetails: '4g IV',
    });
    expect(blockedProto.status).toBe(403);
  });
});
