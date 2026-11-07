import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  classifyPasGrade,
  evaluateObstetricPas,
} from '../web/src/obstetricPasEngine.js';

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
describe('Obstetric PAS (Accreta Spectrum) Engine (Pure Unit Tests)', () => {
  it('correctly classifies PAS Grade 1 (Accreta), Grade 2 (Increta), and Grade 3 (Percreta)', () => {
    // Grade 1: Accreta (mild invasion, clear zone loss but without deep markers)
    expect(
      classifyPasGrade({
        gestationWeeks: 32,
        previousCesareansCount: 1,
        placentaPreviaPresent: true,
        lossOfClearZone: true,
        myometrialThicknessLess1mm: false,
        lacunaeGrade: 1,
        subplacentalHypervascularity: false,
        bridgingVesselsToBladder: false,
      }),
    ).toBe('grade_1_accreta');

    // Grade 2: Increta (deep myometrial invasion, confluent lacunae, myometrium < 1mm)
    expect(
      classifyPasGrade({
        gestationWeeks: 33,
        previousCesareansCount: 2,
        placentaPreviaPresent: true,
        lossOfClearZone: true,
        myometrialThicknessLess1mm: true,
        lacunaeGrade: 2,
        subplacentalHypervascularity: true,
        bridgingVesselsToBladder: false,
      }),
    ).toBe('grade_2_increta');

    // Grade 3: Percreta (bridging vessels to bladder serosa)
    expect(
      classifyPasGrade({
        gestationWeeks: 34,
        previousCesareansCount: 3,
        placentaPreviaPresent: true,
        lossOfClearZone: true,
        myometrialThicknessLess1mm: true,
        lacunaeGrade: 3,
        subplacentalHypervascularity: true,
        bridgingVesselsToBladder: true,
      }),
    ).toBe('grade_3_percreta');
  });

  it('evaluates comprehensive surgical preparedness, blood bank requirements and delivery timing', () => {
    // Severe Grade 3 Percreta evaluation
    const percretaEval = evaluateObstetricPas({
      gestationWeeks: 33.5,
      previousCesareansCount: 2,
      placentaPreviaPresent: true,
      lossOfClearZone: true,
      myometrialThicknessLess1mm: true,
      lacunaeGrade: 3,
      subplacentalHypervascularity: true,
      bridgingVesselsToBladder: true,
    });

    expect(percretaEval.pasGrade).toBe('grade_3_percreta');
    expect(percretaEval.pasRiskLevel).toBe('critical_percreta');
    expect(percretaEval.recommendedPrbcUnits).toBe(8);
    expect(percretaEval.recommendedFfpUnits).toBe(8);
    expect(percretaEval.recommendedPlateletUnits).toBe(4);
    expect(percretaEval.interventionalRadiologyIndicated).toBe(true);
    expect(percretaEval.ureteralStentingIndicated).toBe(true);
    expect(percretaEval.cellSaverIndicated).toBe(true);
    expect(percretaEval.recommendedDeliveryTimingWeeksMin).toBe(34.0);
    expect(percretaEval.recommendedDeliveryTimingWeeksMax).toBe(35.0);
    expect(percretaEval.mdtChecklist.some((item) => item.includes('Urology'))).toBe(true);
    expect(percretaEval.surgicalRecommendations.some((item) => item.includes('Cesarean Hysterectomy'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric PAS REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obgyn',
      fullName: 'Dr. Meera Patel (Consultant Obstetrician)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ot',
      fullName: 'Staff Nurse Sunita (Maternity OT)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ot', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ot', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.desk',
      fullName: 'Ward Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.desk', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.desk', PW);

    // Pregnant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Pooja Sharma (G3P2 Previous 2 LSCS with Placenta Previa)',
      dateOfBirth: '1995-04-12',
      phone: '+91 98765 44444',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create an obstetric PAS episode and logs audit', async () => {
    const payload = {
      patientId,
      evaluationDatetime: '2026-11-07T09:00:00',
      gestationWeeks: 33.2,
      previousCesareansCount: 2,
      placentaPreviaPresent: true,
      lossOfClearZone: true,
      myometrialThicknessLess1mm: true,
      lacunaeGrade: 3,
      subplacentalHypervascularity: true,
      bridgingVesselsToBladder: true,
      prbcUnitsReserved: 6,
      ffpUnitsReserved: 6,
      plateletUnitsReserved: 2,
      cellSaverRequested: true,
      surgicalApproach: 'planned_cesarean_hysterectomy',
      status: 'antepartum_planning',
      clinicalNotes: 'Antenatal betamethasone course planned at 33w6d.',
    };

    const res = await call('POST', '/api/obstetric-pas/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.pas_grade).toBe('grade_3_percreta');
    expect(res.body.episode.prbc_units_reserved).toBe(6);

    // Verify audit log
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) => a.action === 'obstetric_pas.episode_create' && Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record intraoperative/postoperative flowsheet observations', async () => {
    const epRes = await call('POST', '/api/obstetric-pas/episodes', doctor, {
      patientId,
      evaluationDatetime: '2026-11-07T08:00:00',
      gestationWeeks: 34.0,
      previousCesareansCount: 1,
      placentaPreviaPresent: true,
      lossOfClearZone: true,
      myometrialThicknessLess1mm: true,
      lacunaeGrade: 2,
      subplacentalHypervascularity: true,
      bridgingVesselsToBladder: false,
      prbcUnitsReserved: 4,
      ffpUnitsReserved: 4,
      surgicalApproach: 'planned_cesarean_hysterectomy',
      status: 'preoperative_optimization',
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Nurse records operative flowsheet
    const fsRes = await call('POST', `/api/obstetric-pas/episodes/${epId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T11:30:00',
      gestationWeeks: 34.0,
      antenatalBleedingEpisode: false,
      vaginalBleedingMl: 0,
      maternalSbp: 105,
      maternalDbp: 65,
      maternalHr: 88,
      ctgCategory: 'category_1',
      hemoglobinGDl: 11.2,
      crossmatchUnitsConfirmed: true,
      notes: 'Pre-op optimization complete. 4 units PRBC verified in blood bank.',
    });

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();

    // Fetch episode detail and check flowsheet
    const detail = await call('GET', `/api/obstetric-pas/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].maternal_sbp).toBe(105);
  });

  it('allows doctor to update episode status and delete records', async () => {
    const epRes = await call('POST', '/api/obstetric-pas/episodes', doctor, {
      patientId,
      evaluationDatetime: '2026-11-07T08:00:00',
      gestationWeeks: 32.0,
      previousCesareansCount: 1,
      placentaPreviaPresent: true,
      surgicalApproach: 'planned_cesarean_hysterectomy',
      status: 'antepartum_planning',
    });
    expect(epRes.status).toBe(201);
    const epId = epRes.body.episode.id;

    // Doctor updates episode
    const patchRes = await call('PATCH', `/api/obstetric-pas/episodes/${epId}`, doctor, {
      status: 'postoperative_recovery',
      clinicalNotes: 'Discharged to step-down ward with stable hematocrit.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('postoperative_recovery');

    // Doctor deletes episode
    const delRes = await call('DELETE', `/api/obstetric-pas/episodes/${epId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call('GET', `/api/obstetric-pas/episodes/${epId}`, doctor);
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating PAS episodes', async () => {
    const res = await call('POST', '/api/obstetric-pas/episodes', attender, {
      patientId,
      evaluationDatetime: '2026-11-07T08:00:00',
      gestationWeeks: 32.0,
      previousCesareansCount: 1,
      placentaPreviaPresent: true,
    });
    expect(res.status).toBe(403);
  });
});
