import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;
let bedId: number;
let admissionId: number;

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

describe('Ward Board & Critical Deterioration Alerts REST API', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.wardlead',
      fullName: 'Dr. Priya Obstetrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ward',
      fullName: 'Nurse Preeti Ward',
      role: 'nurse',
      password: 'temp-pass-nurse-ward',
    });
    const nurseFirst = await login('nurse.ward', 'temp-pass-nurse-ward');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-ward',
      newPassword: PW,
    });
    nurse = await login('nurse.ward');

    // Desk setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.ward',
      fullName: 'Desk Staff',
      role: 'attender',
      password: 'temp-pass-desk-ward',
    });
    const deskFirst = await login('desk.ward', 'temp-pass-desk-ward');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-ward',
      newPassword: PW,
    });
    desk = await login('desk.ward');

    // Patient
    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Meena Sharma',
      dateOfBirth: '1995-04-12',
      estimatedAgeYears: 29,
      phone: '9876500001',
      address: 'Ward-A Bed 101',
      gravida: 2,
      para: 1,
      lastMenstrualPeriod: '2026-02-15',
    });
    patientId = p.body.patient.id;

    // Create Bed & Admission
    const bRes = await call('POST', '/api/beds', doctor, {
      room: 'Labor Room',
      label: 'LDR-01',
    });
    bedId = bRes.body.id;

    const admRes = await call('POST', '/api/admissions', doctor, {
      patientId,
      bedId,
      admittedDate: '2026-11-07',
      admittedTime: '08:00',
      reason: 'Labor in progress with mild gestational hypertension',
      diagnosis: 'Labor in progress with mild gestational hypertension',
    });
    admissionId = admRes.body.id;
  });

  it('retrieves live ward board with bed occupancy and deterioration indicators', async () => {
    // Check initial board
    const board = await call('GET', '/api/ipd/ward-board/live', doctor);
    expect(board.status).toBe(200);
    expect(board.body.stats.occupiedCount).toBe(1);
    expect(board.body.stats.totalBeds).toBeGreaterThanOrEqual(1);

    // Create MEOWS episode and record observation with severe hypertension (165/110)
    const epRes = await call('POST', `/api/patients/${patientId}/meows-episodes`, doctor, {
      episodeType: 'intrapartum',
      clinicalIndication: 'Labor observation',
      primaryDiagnosis: 'Active labor with gestational hypertension',
      status: 'active_monitoring',
    });
    expect(epRes.status).toBe(201);
    const episodeId = epRes.body.id;

    await call('POST', `/api/meows-episodes/${episodeId}/observations`, nurse, {
      bpSystolic: 165,
      bpDiastolic: 110,
      heartRate: 125,
      respiratoryRate: 26,
      spo2Percent: 97,
      temperatureC: 37.4,
      avpuConsciousness: 'alert',
      lochiaStatus: 'normal',
      urineOutputMlHr: 45,
      proteinuria: '1+',
    });

    // Check ward board reflects CRITICAL_RED deterioration status
    const updatedBoard = await call('GET', '/api/ipd/ward-board/live', nurse);
    expect(updatedBoard.status).toBe(200);
    const occupied = updatedBoard.body.occupiedAdmissions.find((b: any) => b.admissionId === admissionId);
    expect(occupied).toBeDefined();
    expect(occupied.deteriorationStatus).toBe('CRITICAL_RED');
    expect(occupied.triggerReasons.some((r: string) => r.includes('Critical BP'))).toBe(true);
    expect(updatedBoard.body.stats.criticalRedCount).toBe(1);
  });

  it('records SBAR shift handover note, validates fields, and enforces RBAC', async () => {
    // Desk staff forbidden
    const deskAttempt = await call('POST', '/api/ipd/ward-board/handover', desk, {
      admissionId,
      shiftType: 'morning',
      shiftDate: '2026-11-07',
      situation: 'Patient in active labor',
      background: 'G2P1 previous normal vaginal delivery',
      assessment: 'Cervix 4cm dilated, clear liquor',
      recommendation: 'Continue CTG monitoring, review in 2 hours',
    });
    expect(deskAttempt.status).toBe(403);

    // Nurse records handover
    const nurseHandover = await call('POST', '/api/ipd/ward-board/handover', nurse, {
      admissionId,
      shiftType: 'morning',
      shiftDate: '2026-11-07',
      situation: 'Patient in active labor, Stage 1',
      background: 'G2P1 at 39 weeks, admitted for spontaneous labor',
      assessment: 'Cervix 4cm dilated, mild hypertension 140/90',
      recommendation: 'Continue partograph plotting, prepare delivery pack',
      pendingTasks: ['Repeat urine protein check', 'Confirm blood cross-match'],
      ivFluidsStatus: 'RL 500 mL running at 100 mL/h',
      dietaryOrder: 'Clear oral fluids only',
    });
    expect(nurseHandover.status).toBe(200);
    expect(nurseHandover.body.situation).toContain('active labor');
    const handoverId = nurseHandover.body.id;

    // Retrieve handover list for admission
    const listRes = await call('GET', `/api/ipd/ward-board/handover/${admissionId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.handovers.length).toBe(1);
    expect(listRes.body.handovers[0].shift_type).toBe('morning');

    // Audit print
    const printRes = await call('POST', '/api/ipd/ward-board/audit-print', nurse, {
      admissionId,
      ward: 'Labor Room',
    });
    expect(printRes.status).toBe(200);

    // Delete handover note: nurse forbidden, doctor allowed
    const nurseDel = await call('DELETE', `/api/ipd/ward-board/handover/${handoverId}`, nurse);
    expect(nurseDel.status).toBe(403);

    const docDel = await call('DELETE', `/api/ipd/ward-board/handover/${handoverId}`, doctor);
    expect(docDel.status).toBe(200);

    const afterDel = await call('GET', `/api/ipd/ward-board/handover/${admissionId}`, doctor);
    expect(afterDel.body.handovers.length).toBe(0);
  });
});
