import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateActionLineDilatation,
  calculateAlertLineDilatation,
  evaluateLaborAlerts,
  isActionLineReached,
  isAlertLineCrossed,
  type PartographEntry,
} from '../web/src/partographLogic.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;
let admissionId: number;

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

  // Create a maternity bed and patient
  const bedRes = await call('POST', '/api/beds', doctor, { room: 'Labor Room', label: 'LR-01' });
  const bedId = bedRes.body?.id ?? 1;

  patientId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Ananya Deshpande',
    dateOfBirth: '1996-04-12',
    phone: '9876543210',
    lastMenstrualPeriod: '2026-02-05',
    gravida: 2,
    para: 1,
  })).body.patient.id;

  // Admit patient to Labor Room
  const admRes = await call('POST', '/api/admissions', doctor, {
    patientId,
    bedId,
    reason: 'Active spontaneous labor pains at 39 weeks gestation',
    diagnosis: 'G2 P1 L1 at 39.2 weeks in active first stage labor',
  });
  admissionId = admRes.body?.id ?? 1;
});

describe('WHO Partograph Mathematical & Clinical Logic', () => {
  it('computes Alert Line (1 cm/hr) and Action Line (4 hours parallel)', () => {
    // Alert Line starting at T=0 with 4cm
    expect(calculateAlertLineDilatation(0, 0, 4)).toBe(4);
    expect(calculateAlertLineDilatation(2, 0, 4)).toBe(6);
    expect(calculateAlertLineDilatation(4, 0, 4)).toBe(8);
    expect(calculateAlertLineDilatation(6, 0, 4)).toBe(10);
    expect(calculateAlertLineDilatation(8, 0, 4)).toBe(10); // clamped at 10

    // Action Line starting at T=4 with 4cm
    expect(calculateActionLineDilatation(0, 0, 4)).toBeNull();
    expect(calculateActionLineDilatation(3.9, 0, 4)).toBeNull();
    expect(calculateActionLineDilatation(4, 0, 4)).toBe(4);
    expect(calculateActionLineDilatation(6, 0, 4)).toBe(6);
    expect(calculateActionLineDilatation(10, 0, 4)).toBe(10);
  });

  it('correctly evaluates alert line crossed and action line reached boundaries', () => {
    // Normal progress: At T+2h, dilatation is 6.5 cm (expected alert is 6.0 cm) -> NOT crossed
    expect(isAlertLineCrossed(2, 6.5, 0, 4)).toBe(false);

    // Lagging progress: At T+2h, dilatation is only 5.0 cm (expected alert is 6.0 cm) -> CROSSED
    expect(isAlertLineCrossed(2, 5.0, 0, 4)).toBe(true);
    expect(isActionLineReached(2, 5.0, 0, 4)).toBe(false); // action line starts at T+4

    // Arrest / Obstructed labor: At T+5h, dilatation is still 4.5 cm (expected action is 5.0 cm) -> ACTION REACHED
    expect(isAlertLineCrossed(5, 4.5, 0, 4)).toBe(true);
    expect(isActionLineReached(5, 4.5, 0, 4)).toBe(true);
  });

  it('evaluates clinical alert engine for fetal distress, maternal warning, and CPD', () => {
    const entries: PartographEntry[] = [
      {
        id: 1,
        partographId: 1,
        recordedAt: '2026-11-06T10:00:00Z',
        hoursFromStart: 0,
        cervicalDilatationCm: 4.0,
        fetalHeartRate: 140,
        liquor: 'C',
        molding: '0',
        createdAt: '2026-11-06T10:00:00Z',
      },
      {
        id: 2,
        partographId: 1,
        recordedAt: '2026-11-06T12:00:00Z',
        hoursFromStart: 2,
        cervicalDilatationCm: 5.0, // Lagging: Alert line is 6.0
        fetalHeartRate: 95, // Severe bradycardia (< 100)
        liquor: 'M', // Meconium
        molding: '+++', // Severe molding (CPD)
        maternalSystolicMmhg: 165, // Severe HTN crisis (>=160)
        maternalDiastolicMmhg: 112,
        contractionsCount: 6, // Tachysystole (> 5)
        createdAt: '2026-11-06T12:00:00Z',
      },
    ];

    const alerts = evaluateLaborAlerts(entries, { alertLineStartHours: 0, alertLineStartCm: 4 });
    expect(alerts.length).toBeGreaterThanOrEqual(5);

    const alertCrossed = alerts.find((a) => a.kind === 'alert_line_crossed');
    expect(alertCrossed).toBeDefined();

    const fhrAlert = alerts.find((a) => a.kind === 'fetal_distress');
    expect(fhrAlert).toBeDefined();
    expect(fhrAlert?.severity).toBe('critical');

    const htnAlert = alerts.find((a) => a.kind === 'maternal_warning' && a.title.includes('Hypertensive'));
    expect(htnAlert).toBeDefined();
    expect(htnAlert?.severity).toBe('critical');

    const contAlert = alerts.find((a) => a.kind === 'contraction_warning');
    expect(contAlert).toBeDefined();
  });
});

describe('WHO Partograph API & Workflow', () => {
  it('enforces RBAC: clinical staff allowed to manage, desk and unauthenticated blocked', async () => {
    const payload = {
      startTime: '2026-11-06T08:00:00Z',
      parity: 'G2 P1',
      gestationalAgeWeeks: 39.4,
      fetalPosition: 'LOA',
      initialDilatationCm: 4.0,
      initialStation: '4/5',
      initialFhr: 138,
      initialLiquor: 'C',
      initialMolding: '0',
    };

    // Unauthenticated -> 401
    const r1 = await call('POST', `/api/patients/${patientId}/partographs`, undefined, payload);
    expect(r1.status).toBe(401);

    // Desk staff -> 403
    const r2 = await call('POST', `/api/patients/${patientId}/partographs`, desk, payload);
    expect(r2.status).toBe(403);

    // Nurse -> 201
    const r3 = await call('POST', `/api/patients/${patientId}/partographs`, nurse, payload);
    expect(r3.status).toBe(201);
    expect(r3.body.partographNumber).toMatch(/^PTG-\d{6}-\d{4}$/);

    // Doctor -> 201
    const r4 = await call('POST', `/api/patients/${patientId}/partographs`, doctor, payload);
    expect(r4.status).toBe(201);
  });

  it('runs complete labor progress lifecycle: start -> log observations -> outcome & print audit', async () => {
    // 1. Start partograph session
    const startRes = await call('POST', `/api/patients/${patientId}/partographs`, doctor, {
      admissionId,
      startTime: '2026-11-06T06:00:00Z',
      parity: 'G2 P1 L1',
      gestationalAgeWeeks: 39.5,
      fetalPosition: 'LOA',
      initialDilatationCm: 4.0,
      initialStation: '4/5',
      initialFhr: 140,
      initialLiquor: 'C',
      initialMolding: '0',
    });
    expect(startRes.status).toBe(201);
    const partographId = startRes.body.id;
    expect(partographId).toBeGreaterThan(0);

    // 2. Record periodic observations at T+1h, T+2h, T+3.5h
    const entry1 = await call('POST', `/api/partographs/${partographId}/entries`, nurse, {
      recordedAt: '2026-11-06T07:00:00Z',
      fetalHeartRate: 144,
      liquor: 'C',
      molding: '0',
      cervicalDilatationCm: 5.0,
      stationDescent: '3/5',
      contractionsCount: 3,
      contractionsIntensity: 'moderate',
      contractionsDurationSec: 35,
      maternalPulseBpm: 82,
      maternalSystolicMmhg: 118,
      maternalDiastolicMmhg: 76,
      maternalTemperatureC: 36.8,
    });
    expect(entry1.status).toBe(201);
    expect(entry1.body.hoursFromStart).toBe(1.0);

    const entry2 = await call('POST', `/api/partographs/${partographId}/entries`, doctor, {
      recordedAt: '2026-11-06T09:30:00Z',
      fetalHeartRate: 136,
      liquor: 'C',
      molding: '+',
      cervicalDilatationCm: 8.0,
      stationDescent: '1/5',
      contractionsCount: 4,
      contractionsIntensity: 'strong',
      contractionsDurationSec: 45,
      maternalPulseBpm: 88,
      maternalSystolicMmhg: 122,
      maternalDiastolicMmhg: 80,
    });
    expect(entry2.status).toBe(201);
    expect(entry2.body.hoursFromStart).toBe(3.5);

    // 3. Query details
    const getRes = await call('GET', `/api/partographs/${partographId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.patientName).toBe('Ananya Deshpande');
    expect(getRes.body.status).toBe('active');
    expect(getRes.body.entries.length).toBe(3); // Initial at T=0, plus entry1 and entry2

    // 4. Record delivery outcome
    const outcomeRes = await call('PATCH', `/api/partographs/${partographId}/outcome`, doctor, {
      status: 'completed',
      outcome: 'normal_vaginal',
      outcomeNotes: 'Live healthy female neonate delivered with intact perineum. Placenta complete.',
      deliveryTime: '2026-11-06T10:45:00Z',
      babyGender: 'female',
      babyWeightGrams: 3250,
      apgar1min: 8,
      apgar5min: 9,
    });
    expect(outcomeRes.status).toBe(200);
    expect(outcomeRes.body.status).toBe('completed');

    // 5. Verify outcome in GET
    const completedGet = await call('GET', `/api/partographs/${partographId}`, doctor);
    expect(completedGet.body.status).toBe('completed');
    expect(completedGet.body.outcome).toBe('normal_vaginal');
    expect(completedGet.body.babyWeightGrams).toBe(3250);
    expect(completedGet.body.apgar1min).toBe(8);

    // 6. Audit Print
    const printRes = await call('POST', `/api/partographs/${partographId}/print`, doctor);
    expect(printRes.status).toBe(200);

    // Verify audit logs
    const auditRows = db
      .prepare("SELECT action, entity_id FROM audit_events WHERE action LIKE 'partograph.%' ORDER BY id ASC")
      .all() as { action: string; entity_id: string }[];
    const actions = auditRows.map((r) => r.action);
    expect(actions).toContain('partograph.create');
    expect(actions).toContain('partograph.entry');
    expect(actions).toContain('partograph.outcome');
    expect(actions).toContain('partograph.print');
  });
});
