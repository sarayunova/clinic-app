import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluateShockIndex,
  calculateMtpPackRecommendation,
  evaluateTransfusionTargets,
  classifyTransfusionReaction,
} from '../web/src/bloodMtpEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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

describe('Obstetric Shock Index & Balanced Resuscitation MTP Engine', () => {
  it('evaluates Obstetric Shock Index and indicates MTP trigger threshold', () => {
    // Normal postpartum vitals: HR 78, SBP 116 -> SI 0.67
    const normal = evaluateShockIndex(78, 116);
    expect(normal.shockIndex).toBe(0.67);
    expect(normal.category).toBe('normal');
    expect(normal.isMtpTriggerRecommended).toBe(false);

    // Elevated early compensation: HR 98, SBP 102 -> SI 0.96
    const elevated = evaluateShockIndex(98, 102);
    expect(elevated.shockIndex).toBe(0.96);
    expect(elevated.category).toBe('borderline');
    expect(elevated.isMtpTriggerRecommended).toBe(false);

    // Severe shock: HR 124, SBP 85 -> SI 1.46
    const severe = evaluateShockIndex(124, 85);
    expect(severe.shockIndex).toBe(1.46);
    expect(severe.category).toBe('critical_collapse');
    expect(severe.isMtpTriggerRecommended).toBe(true);
    expect(severe.clinicalAction).toContain('ACTIVATE MTP STAT');
  });

  it('calculates balanced 1:1:1 component pack ratios and TXA adjuncts per round', () => {
    // Round 1: 4 PRBC, 4 FFP, TXA 1g
    const pack1 = calculateMtpPackRecommendation(1);
    expect(pack1.prbcUnits).toBe(4);
    expect(pack1.ffpUnits).toBe(4);
    expect(pack1.tranexamicAcidGrams).toBe(1);

    // Round 2 with low fibrinogen (<200): Adds platelets and 10 units Cryo
    const pack2 = calculateMtpPackRecommendation(2, 140, 1.05);
    expect(pack2.prbcUnits).toBe(4);
    expect(pack2.ffpUnits).toBe(4);
    expect(pack2.plateletAdultDoses).toBe(1);
    expect(pack2.cryoUnits).toBe(10);
    expect(pack2.calciumGluconateGrams).toBe(1);
  });

  it('detects the Lethal Triad (acidosis + hypothermia + coagulopathy) from lab values', () => {
    const criticalLabs = evaluateTransfusionTargets({
      hbGDl: 6.2,
      plateletsKUl: 38,
      inr: 2.1,
      fibrinogenMgDl: 120,
      tempCelsius: 34.6,
      phAbg: 7.15,
      ionizedCalciumMmolL: 0.92,
    });

    expect(criticalLabs.allTargetsMet).toBe(false);
    expect(criticalLabs.lethalTriadPresent).toBe(true);
    expect(criticalLabs.warnings.some((w) => w.includes('LETHAL TRIAD DETECTED'))).toBe(true);
    expect(criticalLabs.recommendations.some((r) => r.includes('Cryoprecipitate'))).toBe(true);
  });

  it('triages suspected acute transfusion reactions', () => {
    // Suspected Acute Hemolytic Reaction (AHTR)
    const hemolytic = classifyTransfusionReaction({
      tempRiseCelsius: 1.8,
      maxTempCelsius: 38.8,
      systolicBpDropMmHg: 28,
      hasUrticariaRash: false,
      hasWheezingDyspnea: false,
      hasFlankBackPain: true,
      hasDarkUrineHemoglobinuria: true,
      hasChillsRigors: true,
      hasJvdOrCrackles: false,
    });

    expect(hemolytic.suspectedReaction).toBe('ACUTE_HEMOLYTIC');
    expect(hemolytic.severity).toBe('life_threatening');
    expect(hemolytic.immediateActions.some((a) => a.includes('STOP TRANSFUSION IMMEDIATELY'))).toBe(true);
  });
});

describe('Blood Bank Requisition & Massive Transfusion Protocol REST API', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.bloodbank',
      fullName: 'Dr. Tarun BloodBank',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.bloodbank',
      fullName: 'Sister Rekha ICU',
      role: 'nurse',
      password: 'temp-pass-nurse-bb',
    });
    const nurseFirst = await login('nurse.bloodbank', 'temp-pass-nurse-bb');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-bb',
      newPassword: PW,
    });
    nurse = await login('nurse.bloodbank');

    // Desk setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.bloodbank',
      fullName: 'Desk Attender BB',
      role: 'attender',
      password: 'temp-pass-desk-bb',
    });
    const deskFirst = await login('desk.bloodbank', 'temp-pass-desk-bb');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-bb',
      newPassword: PW,
    });
    desk = await login('desk.bloodbank');

    // Patient
    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Kavita Krishnamurthy',
      dateOfBirth: '1992-06-15',
      estimatedAgeYears: 32,
      phone: '9845112233',
      address: 'Jayanagar, Bengaluru',
      gravida: 2,
      para: 1,
    });
    patientId = p.body.patient.id;
  });

  it('creates blood requisition, updates status, and enforces RBAC', async () => {
    // Desk staff forbidden
    const deskReq = await call('POST', '/api/blood-requisitions', desk, {
      patientId,
      bloodGroupAbo: 'B_POS',
      urgency: 'URGENT_WITHIN_2HR',
      clinicalIndication: 'Pre-operative cross-match for Placenta Previa LSCS',
      prbcUnits: 2,
      ffpUnits: 2,
    });
    expect(deskReq.status).toBe(403);

    // Nurse creates requisition
    const nurseReq = await call('POST', '/api/blood-requisitions', nurse, {
      patientId,
      bloodGroupAbo: 'B_POS',
      urgency: 'URGENT_WITHIN_2HR',
      clinicalIndication: 'Pre-operative cross-match for Placenta Previa LSCS',
      prbcUnits: 2,
      ffpUnits: 2,
    });
    expect(nurseReq.status).toBe(200);
    expect(nurseReq.body.requisition_number).toMatch(/^REQ-\d{4}-\d{4}$/);
    const reqId = nurseReq.body.id;

    // Update status to CROSSMATCHED
    const patchRes = await call('PATCH', `/api/blood-requisitions/${reqId}/status`, nurse, {
      status: 'CROSSMATCHED',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe('CROSSMATCHED');

    // List requisitions
    const listRes = await call('GET', `/api/blood-requisitions?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.requisitions.length).toBe(1);
  });

  it('manages Massive Transfusion Protocol (MTP): activation, rounds, and deactivation', async () => {
    // Desk staff forbidden from activating MTP
    const deskMtp = await call('POST', '/api/mtp/activate', desk, {
      patientId,
      triggerReason: 'PPH_ATONY',
      baselineShockIndex: 1.35,
      baselineEstimatedBloodLossMl: 1500,
    });
    expect(deskMtp.status).toBe(403);

    // Doctor activates MTP
    const activateRes = await call('POST', '/api/mtp/activate', doctor, {
      patientId,
      triggerReason: 'PPH_ATONY',
      baselineShockIndex: 1.35,
      baselineEstimatedBloodLossMl: 1500,
    });
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.mtp_code).toMatch(/^MTP-\d{4}-\d{4}$/);
    expect(activateRes.body.status).toBe('ACTIVE');
    const mtpId = activateRes.body.id;

    // Check active MTPs list
    const activeList = await call('GET', '/api/mtp/active', nurse);
    expect(activeList.status).toBe(200);
    expect(activeList.body.activeMtps.some((m: any) => m.id === mtpId)).toBe(true);

    // Log Round 2 (Pack 2: 4 PRBC, 4 FFP, 1 Platelets, 10 Cryo)
    const round2Res = await call('POST', `/api/mtp/${mtpId}/rounds`, nurse, {
      roundNumber: 2,
      roundStartTime: '10:30',
      prbcIssued: 4,
      prbcTransfused: 4,
      ffpIssued: 4,
      ffpTransfused: 4,
      plateletsIssued: 1,
      plateletsTransfused: 1,
      cryoIssued: 10,
      cryoTransfused: 10,
      hbGDl: 8.4,
      plateletsKUl: 68,
      inr: 1.3,
      fibrinogenMgDl: 210,
      tempCelsius: 36.4,
      clinicalNotes: 'Uterine contraction achieved with carboprost and B-Lynch suture. Vitals stabilizing.',
    });
    expect(round2Res.status).toBe(200);
    expect(round2Res.body.total_prbc_transfused).toBe(4); // from round 2 transfusions
    expect(round2Res.body.total_cryo_transfused).toBe(10);

    // Fetch MTP details with rounds
    const detailRes = await call('GET', `/api/mtp/${mtpId}`, nurse);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.rounds.length).toBe(2); // Round 1 auto-created + Round 2

    // Deactivate MTP
    const deactRes = await call('POST', `/api/mtp/${mtpId}/deactivate`, doctor, {
      outcomeSummary: 'Hemostasis secured. Bleeding controlled. Transferred to ICU intubated and stable.',
    });
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.status).toBe('DEACTIVATED');
    expect(deactRes.body.outcome_summary).toContain('Hemostasis secured');
  });

  it('logs bedside 2-nurse verification and handles acute transfusion reaction', async () => {
    // Log unit administration
    const logRes = await call('POST', '/api/transfusions', nurse, {
      patientId,
      unitNumber: 'PRBC-2026-9901',
      componentType: 'PRBC',
      unitBloodGroup: 'B_POS',
      startTime: '11:00',
      twoNurseVerifier1: 'Sister Rekha RN',
      twoNurseVerifier2: 'Sister Anita RN',
      preVitalsTemp: 36.8,
      preVitalsHr: 88,
      preVitalsBp: '120/80',
      vitals15mTemp: 37.0,
      vitals15mHr: 90,
      vitals15mBp: '118/78',
    });
    expect(logRes.status).toBe(200);
    expect(logRes.body.transfusion_status).toBe('TRANSFUSING');
    const transId = logRes.body.id;

    // Report reaction (Urticaria / Anaphylaxis alert)
    const reactionRes = await call('POST', `/api/transfusions/${transId}/reaction`, nurse, {
      reactionType: 'ALLERGIC_URTICARIAL',
      reactionDetails: 'Patient developed generalized pruritic hives and facial flushing 25 mins into transfusion.',
      actionTaken: 'Transfusion stopped immediately. Given IV Hydrocortisone 100mg and Avil 1 amp. Blood Bank notified.',
      postVitalsTemp: 37.2,
      postVitalsHr: 96,
      postVitalsBp: '110/72',
    });
    expect(reactionRes.status).toBe(200);
    expect(reactionRes.body.adverse_reaction_observed).toBe(1);
    expect(reactionRes.body.transfusion_status).toBe('STOPPED_REACTION');
  });
});
