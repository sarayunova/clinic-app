import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluateMeows,
  evaluateSepsisBundleCompliance,
} from '../web/src/meowsScoring.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let motherId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.deshmukh', fullName: 'Dr. Anita Deshmukh', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse_sneha', 'nurse'], ['desk_rohit', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse_sneha');
  desk = await login('desk_rohit');

  motherId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Meera Patwardhan',
    dateOfBirth: '1996-08-22',
    phone: '9822114455',
    lastMenstrualPeriod: '2026-02-12',
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('Maternal Early Obstetric Warning Score (MEOWS) & Sepsis (SOS) Engine', () => {
  it('classifies completely normal maternal vitals as All Green', () => {
    const res = evaluateMeows({
      respiratoryRate: 16,
      spo2Percent: 98,
      temperatureC: 36.8,
      bpSystolic: 118,
      bpDiastolic: 74,
      heartRate: 76,
      avpuConsciousness: 'alert',
      lochiaStatus: 'normal',
      urineOutputMlHr: 45,
      proteinuria: 'nil',
    });

    expect(res.rrTrigger).toBe('green');
    expect(res.spo2Trigger).toBe('green');
    expect(res.tempTrigger).toBe('green');
    expect(res.bpTrigger).toBe('green');
    expect(res.hrTrigger).toBe('green');
    expect(res.neuroTrigger).toBe('green');
    expect(res.lochiaTrigger).toBe('green');
    expect(res.urineTrigger).toBe('green');
    expect(res.proteinuriaTrigger).toBe('green');

    expect(res.yellowCount).toBe(0);
    expect(res.redCount).toBe(0);
    expect(res.alertLevel).toBe('normal_green');
  });

  it('triggers early warning on a single yellow parameter', () => {
    // Isolated mild tachypnea (RR 22 /min, normal 11-20)
    const res = evaluateMeows({
      respiratoryRate: 22,
      spo2Percent: 98,
      temperatureC: 36.8,
      bpSystolic: 120,
      bpDiastolic: 80,
      heartRate: 80,
      avpuConsciousness: 'alert',
      lochiaStatus: 'normal',
      urineOutputMlHr: 50,
      proteinuria: 'nil',
    });

    expect(res.rrTrigger).toBe('yellow');
    expect(res.yellowCount).toBe(1);
    expect(res.redCount).toBe(0);
    expect(res.alertLevel).toBe('single_yellow');
  });

  it('triggers urgent medical review on two yellow triggers OR one red trigger', () => {
    // Two yellow triggers: Mild tachycardia (HR 108) + Low-grade fever (Temp 37.7°C)
    const twoYellow = evaluateMeows({
      respiratoryRate: 18,
      spo2Percent: 97,
      temperatureC: 37.7,
      bpSystolic: 122,
      bpDiastolic: 78,
      heartRate: 108,
      avpuConsciousness: 'alert',
      lochiaStatus: 'normal',
      urineOutputMlHr: 40,
      proteinuria: 'nil',
    });

    expect(twoYellow.tempTrigger).toBe('yellow');
    expect(twoYellow.hrTrigger).toBe('yellow');
    expect(twoYellow.yellowCount).toBe(2);
    expect(twoYellow.redCount).toBe(0);
    expect(twoYellow.alertLevel).toBe('urgent_two_yellow_one_red');

    // One red trigger: Severe gestational hypertension / pre-eclampsia (BP 154/104 mmHg)
    const oneRed = evaluateMeows({
      respiratoryRate: 18,
      spo2Percent: 98,
      temperatureC: 36.9,
      bpSystolic: 154,
      bpDiastolic: 104,
      heartRate: 82,
      avpuConsciousness: 'alert',
      lochiaStatus: 'normal',
      urineOutputMlHr: 40,
      proteinuria: '2+', // 2+ proteinuria is also red
    });

    expect(oneRed.bpTrigger).toBe('red');
    expect(oneRed.proteinuriaTrigger).toBe('red');
    expect(oneRed.redCount).toBe(2);
    expect(oneRed.alertLevel).toBe('critical_multiple_red');
  });

  it('evaluates Sepsis in Obstetrics Score (SOS) and identifies high-risk maternal septic shock', () => {
    // Patient with chorioamnionitis/endometritis:
    // Temp 38.6°C (+1), SBP 86 mmHg (+2), HR 128 bpm (+1), RR 27 /min (+1), SpO2 91% (+2), Lactate 3.2 mmol/L (+1)
    // Total SOS = 8 (High risk / septic shock)
    const septicPatient = evaluateMeows({
      respiratoryRate: 27,
      spo2Percent: 91,
      temperatureC: 38.6,
      bpSystolic: 86,
      bpDiastolic: 48,
      heartRate: 128,
      avpuConsciousness: 'alert',
      lochiaStatus: 'heavy_foul_smelling',
      urineOutputMlHr: 20,
      proteinuria: 'nil',
      serumLactateMmolL: 3.2,
      whiteCellCountK: 18.5,
    });

    expect(septicPatient.sosScore).toBe(9); // 1 (temp) + 2 (sbp) + 1 (hr) + 1 (rr) + 2 (spo2) + 1 (wbc) + 1 (lactate)
    expect(septicPatient.sosRiskLevel).toBe('high_septic_shock');
    expect(septicPatient.alertLevel).toBe('critical_multiple_red');
  });

  it('evaluates 1-Hour Maternal Sepsis Resuscitation Bundle checklist compliance', () => {
    // Missing antibiotics and blood cultures
    const incomplete = evaluateSepsisBundleCompliance({
      bloodCulturesTaken: false,
      lactateDrawn: true,
      ivAntibioticsGiven: false,
      ivFluidsBolusGiven: true,
      oxygenApplied: true,
      foleyUrineHourly: true,
    });
    expect(incomplete.completedCount).toBe(4);
    expect(incomplete.isFullyCompliant).toBe(false);
    expect(incomplete.missingElements).toContain('Blood cultures prior to antibiotics');
    expect(incomplete.missingElements).toContain('Broad-spectrum IV antibiotics within 1h');

    // Fully compliant bundle
    const complete = evaluateSepsisBundleCompliance({
      bloodCulturesTaken: true,
      lactateDrawn: true,
      ivAntibioticsGiven: true,
      ivFluidsBolusGiven: true,
      oxygenApplied: true,
      foleyUrineHourly: true,
    });
    expect(complete.completedCount).toBe(6);
    expect(complete.isFullyCompliant).toBe(true);
    expect(complete.missingElements).toHaveLength(0);
  });
});

describe('Maternal MEOWS & Obstetric Sepsis REST API Integration', () => {
  it('creates a MEOWS episode, records serial observations, updates status, and retrieves enriched flowsheet', async () => {
    // 1. Doctor creates an inpatient postpartum MEOWS episode
    const episodeRes = await call('POST', `/api/patients/${motherId}/meows-episodes`, doctor, {
      episodeType: 'post_op_lscs',
      clinicalIndication: 'Day 1 Post-Emergency LSCS for Non-Progress & PROM',
      primaryDiagnosis: 'P1L1 post LSCS under spinal anesthesia',
      highRiskFlags: 'Prolonged PROM > 18h, Gestational Diabetes on Metformin',
      status: 'active_monitoring',
    });

    expect(episodeRes.status).toBe(201);
    expect(episodeRes.body.id).toBeDefined();
    expect(episodeRes.body.episodeType).toBe('post_op_lscs');
    expect(episodeRes.body.isActive).toBe(true);

    const episodeId = episodeRes.body.id;

    // 2. Nurse logs a serial MEOWS observation with vitals and sepsis bundle
    const obsRes = await call('POST', `/api/meows-episodes/${episodeId}/observations`, nurse, {
      respiratoryRate: 18,
      spo2Percent: 97,
      supplementalO2: false,
      temperatureC: 37.1,
      bpSystolic: 124,
      bpDiastolic: 82,
      heartRate: 84,
      avpuConsciousness: 'alert',
      painScore: 1,
      lochiaStatus: 'normal',
      urineOutputMlHr: 50,
      proteinuria: 'nil',
      actionRequired: 'Routine 4-hourly observations',
      actionTaken: 'Oral fluids encouraged, wound site dry and intact.',
    });

    expect(obsRes.status).toBe(201);
    expect(obsRes.body.id).toBeDefined();
    expect(obsRes.body.overallAlertLevel).toBe('normal_green');
    expect(obsRes.body.yellowTriggersCount).toBe(0);
    expect(obsRes.body.redTriggersCount).toBe(0);
    expect(obsRes.body.recordedByName).toBe('nurse_sneha');

    const obsId = obsRes.body.id;

    // 3. Retrieve detailed episode with observation history
    const getRes = await call('GET', `/api/meows-episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(episodeId);
    expect(getRes.body.patientName).toBe('Meera Patwardhan');
    expect(getRes.body.observations).toHaveLength(1);
    expect(getRes.body.observations[0].id).toBe(obsId);

    // 4. Update episode status to stepped down
    const putRes = await call('PUT', `/api/meows-episodes/${episodeId}`, doctor, {
      episodeType: 'post_op_lscs',
      clinicalIndication: 'Day 2 Post-LSCS, afebril and mobilized',
      status: 'stepped_down_stable',
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe('stepped_down_stable');
    expect(putRes.body.isActive).toBe(false);

    // 5. Verify audit log recorded
    const auditEvents = db.prepare('SELECT action FROM audit_events WHERE entity_id = ?').all(String(motherId)) as { action: string }[];
    expect(auditEvents.map(a => a.action)).toContain('meows_episode.create');
    expect(auditEvents.map(a => a.action)).toContain('meows_observation.create');
    expect(auditEvents.map(a => a.action)).toContain('meows_episode.update');

    // 6. Delete observation and delete episode
    const delObs = await call('DELETE', `/api/meows-observations/${obsId}`, nurse);
    expect(delObs.status).toBe(200);

    const delEp = await call('DELETE', `/api/meows-episodes/${episodeId}`, doctor);
    expect(delEp.status).toBe(200);
  });

  it('enforces RBAC: desk attender cannot create MEOWS episodes or log observations', async () => {
    const createEp = await call('POST', `/api/patients/${motherId}/meows-episodes`, desk, {
      episodeType: 'postpartum',
    });
    expect(createEp.status).toBe(403);
  });
});
