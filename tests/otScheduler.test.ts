import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { evaluateAirwayRisk, evaluateNpoFasting } from '../web/src/otPacEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
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

describe('Pre-Anesthesia Airway & Fasting Decision Engine', () => {
  it('identifies potential difficult airway on Mallampati Class IV, short thyromental distance and restricted opening', () => {
    const difficultAirway = evaluateAirwayRisk({
      mallampatiClass: 'CLASS_IV',
      mouthOpeningCm: 2.5,
      thyromentalDistanceCm: 5.5,
      dentitionStatus: 'loose_teeth',
      neckMobility: 'restricted_extension',
    });

    expect(difficultAirway.difficultyRisk).toBe('high_difficult_airway');
    expect(difficultAirway.summary).toContain('POTENTIAL DIFFICULT AIRWAY');
    expect(difficultAirway.warnings.some((w) => w.includes('Mallampati Class IV'))).toBe(true);
    expect(difficultAirway.warnings.some((w) => w.includes('Restricted mouth opening'))).toBe(true);

    const normalAirway = evaluateAirwayRisk({
      mallampatiClass: 'CLASS_I',
      mouthOpeningCm: 4.5,
      thyromentalDistanceCm: 7.0,
      dentitionStatus: 'intact',
      neckMobility: 'normal_full',
    });

    expect(normalAirway.difficultyRisk).toBe('low');
    expect(normalAirway.summary).toContain('Standard airway parameters');
    expect(normalAirway.warnings.length).toBe(0);
  });

  it('evaluates NPO fasting guidelines compliance accurately', () => {
    // Compliant elective patient: 8h solid, 3h clear water
    const compliant = evaluateNpoFasting(8, 3);
    expect(compliant.isFastingCompliant).toBe(true);
    expect(compliant.clearFluidWarning).toBeUndefined();

    // Non-compliant: 1h clear water, 4h solid
    const nonCompliant = evaluateNpoFasting(4, 1);
    expect(nonCompliant.isFastingCompliant).toBe(false);
    expect(nonCompliant.clearFluidWarning).toContain('2-hour minimum');
    expect(nonCompliant.solidFastingWarning).toContain('6-hour minimum');
  });
});

describe('OT Scheduler, PAC Clearance & WHO Safety Checklist REST API', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.otsurgeon',
      fullName: 'Dr. Madhuri Surgeon',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ot',
      fullName: 'Nurse Sheela OT',
      role: 'nurse',
      password: 'temp-pass-nurse-ot',
    });
    const nurseFirst = await login('nurse.ot', 'temp-pass-nurse-ot');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-ot',
      newPassword: PW,
    });
    nurse = await login('nurse.ot');

    // Desk setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.ot',
      fullName: 'Desk Staff OT',
      role: 'attender',
      password: 'temp-pass-desk-ot',
    });
    const deskFirst = await login('desk.ot', 'temp-pass-desk-ot');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-ot',
      newPassword: PW,
    });
    desk = await login('desk.ot');

    // Patient
    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Deepika Padukone',
      dateOfBirth: '1990-01-05',
      estimatedAgeYears: 34,
      phone: '9840155555',
      address: 'Bengaluru, Karnataka',
      gravida: 1,
      para: 0,
      lastMenstrualPeriod: '2026-02-10',
    });
    patientId = p.body.patient.id;
  });

  it('schedules surgery, auto-initializes WHO checklist, and enforces RBAC', async () => {
    // Desk staff forbidden
    const deskTry = await call('POST', '/api/ot-schedules', desk, {
      patientId,
      otRoom: 'OT_2_MATERNITY',
      scheduledDate: '2026-11-09',
      scheduledStartTime: '09:00',
      procedureName: 'Elective Lower Segment Cesarean Section (LSCS)',
      procedureCategory: 'OBSTETRIC',
      priority: 'ELECTIVE',
      primarySurgeonId: 1,
    });
    expect(deskTry.status).toBe(403);

    // Nurse schedules surgery
    const schedRes = await call('POST', '/api/ot-schedules', nurse, {
      patientId,
      otRoom: 'OT_2_MATERNITY',
      scheduledDate: '2026-11-09',
      scheduledStartTime: '09:00',
      estimatedDurationMinutes: 60,
      procedureName: 'Elective Lower Segment Cesarean Section (LSCS)',
      procedureCategory: 'OBSTETRIC',
      priority: 'ELECTIVE',
      primarySurgeonId: 1,
      assistantSurgeonName: 'Dr. Assistant Obgyn',
      scrubNurseName: 'Nurse Sheela OT',
      pediatricianStandbyName: 'Dr. Pediatrician On-Duty',
      bloodUnitsReserved: 1,
    });
    expect(schedRes.status).toBe(200);
    expect(schedRes.body.status).toBe('SCHEDULED');
    expect(schedRes.body.ot_room).toBe('OT_2_MATERNITY');
    const scheduleId = schedRes.body.id;

    // Verify auto-initialized WHO checklist exists via GET
    const getRes = await call('GET', `/api/ot-schedules/${scheduleId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.schedule.procedure_name).toBe('Elective Lower Segment Cesarean Section (LSCS)');
    expect(getRes.body.whoChecklist).toBeDefined();
    expect(getRes.body.whoChecklist.signin_completed).toBe(0);

    // List OT schedules
    const listRes = await call('GET', '/api/ot-schedules?date=2026-11-09', doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.schedules.length).toBe(1);
    expect(listRes.body.schedules[0].patient_name).toBe('Deepika Padukone');

    // Update status to SURGERY_IN_PROGRESS
    const updateRes = await call('PUT', `/api/ot-schedules/${scheduleId}`, nurse, {
      status: 'SURGERY_IN_PROGRESS',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('SURGERY_IN_PROGRESS');
  });

  it('records Pre-Anesthesia Clearance (PAC) with ASA physical status grade', async () => {
    // Desk staff forbidden
    const deskPac = await call('POST', `/api/patients/${patientId}/pac`, desk, {
      evaluationDate: '2026-11-08',
      asaGrade: 'ASA_I',
    });
    expect(deskPac.status).toBe(403);

    // Doctor records PAC clearance
    const pacRes = await call('POST', `/api/patients/${patientId}/pac`, doctor, {
      evaluationDate: '2026-11-08',
      asaGrade: 'ASA_II',
      mallampatiClass: 'CLASS_I',
      mouthOpeningCm: 4.2,
      thyromentalDistanceCm: 6.8,
      dentitionStatus: 'intact',
      neckMobility: 'normal_full',
      npoSolidHours: 8,
      npoClearLiquidHours: 2,
      plannedAnesthesiaTechnique: 'SPINAL',
      pacClearanceStatus: 'FIT_FOR_SURGERY',
      cardiovascularAssessment: 'Heart sounds normal, S1 S2 present, no murmurs. BP 118/76 mmHg.',
      respiratoryAssessment: 'Bilateral air entry equal, clear chest. SpO2 99% on room air.',
      preopOrdersInstructions: 'Fasting 8h solids, 2h clear water. Continue prenatal vitamins. Pre-medication as per protocol.',
    });
    expect(pacRes.status).toBe(200);
    expect(pacRes.body.asa_grade).toBe('ASA_II');
    expect(pacRes.body.pac_clearance_status).toBe('FIT_FOR_SURGERY');
    const pacId = pacRes.body.id;

    // Retrieve PAC list for patient
    const listPac = await call('GET', `/api/patients/${patientId}/pac`, doctor);
    expect(listPac.status).toBe(200);
    expect(listPac.body.clearances.length).toBe(1);
    expect(listPac.body.clearances[0].anesthesiologist_name).toBe('Dr. Madhuri Surgeon');

    // Delete PAC (doctor only)
    const delRes = await call('DELETE', `/api/pac/${pacId}`, doctor);
    expect(delRes.status).toBe(200);
  });

  it('completes 3-Phase WHO Surgical Safety Checklist (Sign In, Time Out, Sign Out)', async () => {
    // 1. Create surgery schedule
    const schedRes = await call('POST', '/api/ot-schedules', doctor, {
      patientId,
      otRoom: 'OT_1_MAIN',
      scheduledDate: '2026-11-09',
      scheduledStartTime: '10:30',
      procedureName: 'Diagnostic Laparoscopy & Chromopertubation',
      procedureCategory: 'LAPAROSCOPIC',
      priority: 'ELECTIVE',
      primarySurgeonId: 1,
    });
    const scheduleId = schedRes.body.id;

    // 2. Complete Phase 1: Sign In (Before Induction)
    const signInRes = await call('POST', `/api/ot-schedules/${scheduleId}/who-checklist`, nurse, {
      signinCompleted: true,
      signinPatientConfirmed: true,
      signinSiteMarked: true,
      signinAnesthesiaSafetyCheck: true,
      signinPulseOximeterFunctioning: true,
      signinKnownAllergy: false,
      signinDifficultAirwayRisk: false,
      signinBloodLossRisk: false,
      signinNurseAnesthetistName: 'Nurse Sheela OT',
    });
    expect(signInRes.status).toBe(200);
    expect(signInRes.body.signin_completed).toBe(1);

    // 3. Complete Phase 2: Time Out (Before Incision)
    const timeOutRes = await call('POST', `/api/ot-schedules/${scheduleId}/who-checklist`, doctor, {
      timeoutCompleted: true,
      timeoutTeamIntroduced: true,
      timeoutVerbalConfirmation: true,
      timeoutSurgeonReview: 'Inspection of pelvis, bilateral tubal patency check with methylene blue.',
      timeoutAnesthetistReview: 'General endotracheal tube secured, muscle relaxation adequate, hemodynamic stability maintained.',
      timeoutNursingSterilityConfirmed: true,
      timeoutAntibioticProphylaxisGiven: true,
      timeoutAntibioticNameDose: 'Inj. Cefazolin 1g IV given 25 min prior',
      timeoutImagingDisplayed: true,
      timeoutCompletedByName: 'Dr. Madhuri Surgeon',
    });
    expect(timeOutRes.status).toBe(200);
    expect(timeOutRes.body.timeout_completed).toBe(1);

    // 4. Complete Phase 3: Sign Out (Before Leaving OR)
    const signOutRes = await call('POST', `/api/ot-schedules/${scheduleId}/who-checklist`, nurse, {
      signoutCompleted: true,
      signoutProcedureRecordedName: 'Diagnostic Laparoscopy & Chromopertubation',
      signoutCountsCorrect: true,
      signoutSpecimenLabeled: true,
      signoutEquipmentProblems: 'None. Laparoscopic insufflator functioning properly.',
      signoutRecoveryConcerns: 'Extubated smoothly. Monitor in PACU for 2 hours before shifting to day-care ward.',
      signoutCompletedByName: 'Nurse Sheela OT',
    });
    expect(signOutRes.status).toBe(200);
    expect(signOutRes.body.signout_completed).toBe(1);
    expect(signOutRes.body.signout_counts_correct).toBe(1);

    // Audit print
    const printRes = await call('POST', `/api/ot-schedules/${scheduleId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    // Delete schedule
    const delRes = await call('DELETE', `/api/ot-schedules/${scheduleId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
