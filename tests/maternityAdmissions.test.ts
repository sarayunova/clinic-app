import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateBishopScore,
  calculateRuptureHours,
  isProlongedProm,
  isTachysystole,
} from '../web/src/maternityScoring.js';

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
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse1', 'nurse'], ['desk1', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse1');
  desk = await login('desk1');

  motherId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Kavita Sundaram',
    dateOfBirth: '1995-04-12',
    phone: '9880012345',
    lastMenstrualPeriod: '2026-02-05',
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('Maternity Scoring & Decision Calculations', () => {
  it('calculates Modified Bishop Score and interpretation correctly', () => {
    // Unfavorable cervix (Score 0)
    const b0 = calculateBishopScore({ dilation: 0, effacement: 0, station: 0, consistency: 0, position: 0 });
    expect(b0.totalScore).toBe(0);
    expect(b0.interpretation).toBe('unfavorable');
    expect(b0.inductionAdvice).toContain('Cervical ripening required');

    // Intermediate cervix (Score 7: 2 + 2 + 1 + 1 + 1)
    const b1 = calculateBishopScore({ dilation: 2, effacement: 2, station: 1, consistency: 1, position: 1 });
    expect(b1.totalScore).toBe(7);
    expect(b1.interpretation).toBe('intermediate');

    // Favorable cervix (Score 11: 3 + 3 + 2 + 2 + 1)
    const b2 = calculateBishopScore({ dilation: 3, effacement: 3, station: 2, consistency: 2, position: 1 });
    expect(b2.totalScore).toBe(11);
    expect(b2.interpretation).toBe('favorable');
  });

  it('evaluates PROM duration and identifies prolonged rupture (>= 18 hours)', () => {
    expect(isProlongedProm(null)).toBe(false);
    expect(isProlongedProm(6.5)).toBe(false);
    expect(isProlongedProm(17.9)).toBe(false);
    expect(isProlongedProm(18.0)).toBe(true);
    expect(isProlongedProm(22.5)).toBe(true);

    const now = '2026-11-06T12:00:00.000Z';
    const tMinus19h = '2026-11-05T17:00:00.000Z';
    const hrs = calculateRuptureHours(tMinus19h, now);
    expect(hrs).toBe(19);
    expect(isProlongedProm(hrs)).toBe(true);
  });

  it('detects uterine tachysystole (> 5 in 10 mins or duration > 90 seconds)', () => {
    // Normal contractions: 3 in 10 min lasting 45s
    expect(isTachysystole(3, 45)).toBe(false);
    // Tachysystole: 6 in 10 mins
    expect(isTachysystole(6, 45)).toBe(true);
    // Hyperstimulation duration: 3 in 10 mins but lasting 100s
    expect(isTachysystole(3, 100)).toBe(true);
  });
});

describe('Maternity Admission & Delivery Ward Handover API', () => {
  it('creates a maternity admission card with Bishop score calculation and PROM tracking', async () => {
    const res = await call('POST', `/api/patients/${motherId}/maternity-admissions`, doctor, {
      admissionDate: '2026-11-06',
      laborStage: 'active_phase',
      admissionIndication: 'in_labor',
      indicationDetails: 'Spontaneous labor at term with active regular uterine contractions',
      contractionOnsetAt: '2026-11-06 04:30',
      gestationalAgeWeeks: 39,
      gestationalAgeDays: 3,
      gravida: 2,
      para: 1,
      bloodGroup: 'O+',
      highRiskAlerts: 'Previous 1 LSCS in 2023, trial of labor planned (TOLAC/VBAC)',
      bishopDilation: 2,
      bishopEffacement: 2,
      bishopStation: 2,
      bishopConsistency: 1,
      bishopPosition: 1,
      membraneStatus: 'ruptured_clear',
      membraneRupturedAt: '2026-11-06 05:00',
      membraneRuptureHours: 4.5,
      promAntibioticsGiven: false,
      liquorNotes: 'Clear amniotic fluid draining',
      fetalHeartRate: 142,
      fetalPresentation: 'cephalic_vertex',
      ctgCategory: 'category_1',
      bpSystolic: 122,
      bpDiastolic: 78,
      pulse: 80,
      temperatureF: 98.4,
      spo2: 99,
      currentLocation: 'labor_room',
      attendingMidwifeNurse: 'Sister Deepa, RN',
      primaryObstetrician: 'Dr. Rao, MD',
      latestCervicalDilationCm: 6.0,
      latestFetalStation: '0',
      status: 'in_labor',
    });

    expect(res.status).toBe(201);
    expect(res.body.patientId).toBe(motherId);
    expect(res.body.laborStage).toBe('active_phase');
    expect(res.body.bishopTotalScore).toBe(8); // 2+2+2+1+1
    expect(res.body.bishopInterpretation).toBe('intermediate');
    expect(res.body.latestCervicalDilationCm).toBe(6.0);
    expect(res.body.membraneStatus).toBe('ruptured_clear');

    // Verify audit event
    const auditRows = db.prepare("SELECT * FROM audit_events WHERE action = 'maternity_admission.create'").all();
    expect(auditRows.length).toBe(1);
  });

  it('records an SBAR shift handover note with urgency level', async () => {
    // 1. Create admission
    const adm = (await call('POST', `/api/patients/${motherId}/maternity-admissions`, nurse, {
      admissionDate: '2026-11-06',
      laborStage: 'latent_phase',
      admissionIndication: 'induction_of_labor',
      status: 'in_labor',
    })).body;

    // 2. Add SBAR Handover note
    const sbarRes = await call('POST', `/api/maternity-admissions/${adm.id}/handover`, nurse, {
      shiftName: 'morning',
      outgoingStaff: 'Nurse Anitha (Night shift)',
      incomingStaff: 'Nurse Meena (Morning shift)',
      situation: 'Patient in Labor Room 2. G2 P1, 39w. Admitted for elective induction.',
      background: 'Previous vaginal delivery. No allergies. Favorable cervix.',
      assessment: 'Cervix 4 cm, soft, 60% effaced. Contractions 2 in 10 mins. FHR 138 bpm Cat I.',
      recommendation: 'Start low-dose Oxytocin 2 mU/min titration. Next VE due at 11:00 AM.',
      urgencyLevel: 'routine',
    });

    expect(sbarRes.status).toBe(201);
    expect(sbarRes.body.shiftName).toBe('morning');
    expect(sbarRes.body.outgoingStaff).toBe('Nurse Anitha (Night shift)');
    expect(sbarRes.body.situation).toContain('Labor Room 2');
    expect(sbarRes.body.urgencyLevel).toBe('routine');

    // Verify fetch includes handovers list
    const getRes = await call('GET', `/api/maternity-admissions/${adm.id}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.handovers.length).toBe(1);
    expect(getRes.body.handovers[0].recommendation).toContain('Oxytocin');
  });

  it('logs oxytocin titration step and auto-detects hyperstimulation / tachysystole', async () => {
    const adm = (await call('POST', `/api/patients/${motherId}/maternity-admissions`, doctor, {
      admissionDate: '2026-11-06',
      status: 'in_labor',
    })).body;

    // Step 1: Normal titration (3 in 10m, 45s) -> hyperstimulation false
    const oxy1 = await call('POST', `/api/maternity-admissions/${adm.id}/oxytocin`, nurse, {
      infusionRateMUPerMin: 4.0,
      dropsPerMin: 12,
      contractionsPer10min: 3,
      contractionDurationSec: 45,
      contractionIntensity: 'moderate',
      fetalHeartRate: 140,
      actionTaken: 'Increased to 4 mU/min per protocol',
    });
    expect(oxy1.status).toBe(201);
    expect(oxy1.body.infusionRateMUPerMin).toBe(4.0);
    expect(oxy1.body.hyperstimulationNoted).toBe(false);

    // Verify admission active_oxytocin_rate was updated
    const getAdm = await call('GET', `/api/maternity-admissions/${adm.id}`, nurse);
    expect(getAdm.body.activeOxytocinRate).toBe('4 mU/min (12 drops/min)');

    // Step 2: Tachysystole (6 contractions in 10m) -> hyperstimulation true
    const oxy2 = await call('POST', `/api/maternity-admissions/${adm.id}/oxytocin`, nurse, {
      infusionRateMUPerMin: 8.0,
      dropsPerMin: 24,
      contractionsPer10min: 6,
      contractionDurationSec: 50,
      contractionIntensity: 'strong',
      fetalHeartRate: 145,
      actionTaken: 'Tachysystole noted. Paused infusion.',
    });
    expect(oxy2.status).toBe(201);
    expect(oxy2.body.hyperstimulationNoted).toBe(true);

    // Verify oxytocin logs list endpoint
    const listOxy = await call('GET', `/api/maternity-admissions/${adm.id}/oxytocin`, nurse);
    expect(listOxy.status).toBe(200);
    expect(listOxy.body.logs.length).toBe(2);
  });

  it('manages Emergency LSCS readiness checklist and updates location when shifted to OT', async () => {
    const adm = (await call('POST', `/api/patients/${motherId}/maternity-admissions`, doctor, {
      admissionDate: '2026-11-06',
      currentLocation: 'labor_room',
      status: 'in_labor',
    })).body;

    // 1. Initial LSCS checklist creation
    const putRes = await call('PUT', `/api/maternity-admissions/${adm.id}/lscs-checklist`, doctor, {
      lscsCategory: 'category_1_immediate_threat',
      decisionToDeliveryTargetMins: 30,
      surgicalIndication: 'Persistent severe fetal bradycardia (FHR 80 bpm)',
      operatingSurgeon: 'Dr. Rao, MD',
      anesthetistNotified: true,
      anesthetistName: 'Dr. Sharma, DA',
      pediatricianNotified: true,
      pediatricianName: 'Dr. Patel, MD (Peds)',
      consentSigned: true,
      wideBoreIvAccess: true,
      bloodArranged: true,
      bloodUnitsArranged: 2,
      preopAntacidGiven: true,
      antibioticProphylaxisGiven: true,
      antibioticNameTime: 'Inj. Cefazolin 2g IV at 10:15',
      foleyCatheterInserted: true,
      abdominalPrepDone: true,
      otReady: true,
      notes: 'Transfer to Emergency OT immediately',
    });

    expect(putRes.status).toBe(200);
    expect(putRes.body.lscsCategory).toBe('category_1_immediate_threat');
    expect(putRes.body.decisionToDeliveryTargetMins).toBe(30);
    expect(putRes.body.anesthetistNotified).toBe(true);
    expect(putRes.body.otReady).toBe(true);

    // 2. Update with shiftedToOtAt
    const updateRes = await call('PUT', `/api/maternity-admissions/${adm.id}/lscs-checklist`, nurse, {
      lscsCategory: 'category_1_immediate_threat',
      decisionToDeliveryTargetMins: 30,
      surgicalIndication: 'Persistent severe fetal bradycardia (FHR 80 bpm)',
      shiftedToOtAt: '2026-11-06 10:20',
      otReady: true,
    });
    expect(updateRes.status).toBe(200);

    // Verify admission location and status updated
    const updatedAdm = await call('GET', `/api/maternity-admissions/${adm.id}`, doctor);
    expect(updatedAdm.body.currentLocation).toBe('operating_theatre');
    expect(updatedAdm.body.status).toBe('transferred_to_ot');
  });

  it('retrieves delivery ward board list with active filters and enriched stats', async () => {
    // Mother 1: In active labor
    await call('POST', `/api/patients/${motherId}/maternity-admissions`, doctor, {
      admissionDate: '2026-11-06',
      laborStage: 'active_phase',
      latestCervicalDilationCm: 7.0,
      fetalHeartRate: 144,
      status: 'in_labor',
    });

    const boardRes = await call('GET', '/api/maternity-admissions?activeOnly=true', nurse);
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.count).toBeGreaterThan(0);
    const m1 = boardRes.body.admissions.find((a: any) => a.patientId === motherId);
    expect(m1).toBeDefined();
    expect(m1.patientName).toBe('Kavita Sundaram');
    expect(m1.latestCervicalDilationCm).toBe(7.0);
  });

  it('enforces RBAC: desk attender is blocked from writing maternity records', async () => {
    const res = await call('POST', `/api/patients/${motherId}/maternity-admissions`, desk, {
      admissionDate: '2026-11-06',
    });
    expect(res.status).toBe(403);
  });
});
