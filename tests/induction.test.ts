import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateBishopComponents,
  calculateLaborInduction,
  type BishopScoreInput,
} from '../web/src/inductionEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

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

describe('Labor Induction & Modified Bishop Score Engine', () => {
  it('calculates unfavorable cervix (Bishop <= 5) and recommends mechanical or prostaglandin ripening', () => {
    const input: BishopScoreInput = {
      dilationCm: 0, // 0 pts
      effacementPercent: 20, // 0 pts
      fetalStation: -3, // 0 pts
      consistency: 'firm', // 0 pts
      position: 'posterior', // 0 pts
      previousCesarean: false,
      gestationalAgeWeeks: 41,
    };

    const comp = calculateBishopComponents(input);
    expect(comp.totalScore).toBe(0);

    const rec = calculateLaborInduction(input);
    expect(rec.totalScore).toBe(0);
    expect(rec.favorability).toBe('unfavorable_le_5');
    expect(rec.recommendedRipening).toBe('dinoprostone_pge2_tape');
    expect(rec.ripeningRationale).toContain('Unfavorable cervix (Bishop <= 5)');
  });

  it('strictly contraindicates prostaglandins in previous Cesarean / scarred uterus', () => {
    const input: BishopScoreInput = {
      dilationCm: 1, // 1 pt
      effacementPercent: 30, // 0 pts
      fetalStation: -2, // 1 pt
      consistency: 'firm', // 0 pts
      position: 'posterior', // 0 pts
      previousCesarean: true, // Prior scar
      gestationalAgeWeeks: 40,
    };

    const rec = calculateLaborInduction(input);
    expect(rec.totalScore).toBe(2);
    expect(rec.recommendedRipening).toBe('foley_bulb_mechanical');
    expect(rec.contraindicationWarnings.some((w) => w.includes('CONTRAINDICATION: Prostaglandins'))).toBe(true);
  });

  it('evaluates favorable cervix (Bishop >= 8) and recommends direct amniotomy & oxytocin', () => {
    const input: BishopScoreInput = {
      dilationCm: 4, // 2 pts
      effacementPercent: 70, // 2 pts
      fetalStation: 0, // 2 pts
      consistency: 'soft', // 2 pts
      position: 'anterior', // 2 pts
      previousCesarean: false,
      gestationalAgeWeeks: 39,
    };

    const comp = calculateBishopComponents(input);
    expect(comp.totalScore).toBe(10);

    const rec = calculateLaborInduction(input);
    expect(rec.totalScore).toBe(10);
    expect(rec.favorability).toBe('favorable_ge_8');
    expect(rec.recommendedRipening).toBe('direct_arm_oxytocin');
    expect(rec.oxytocinProtocol.startingRateMUPerMin).toBe(1.0);
  });
});

describe('Labor Induction REST API & Audit Trails', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.rekha',
      fullName: 'Dr. Rekha Sharma',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse1',
      fullName: 'Sister Sneha',
      role: 'nurse',
      password: 'temp-pass-nurse-1',
    });
    const nurseFirst = await login('nurse1', 'temp-pass-nurse-1');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-1',
      newPassword: PW,
    });
    nurse = await login('nurse1');

    // Desk attender
    await call('POST', '/api/users', doctor, {
      username: 'desk1',
      fullName: 'Reception Sunil',
      role: 'attender',
      password: 'temp-pass-desk-1',
    });
    const deskFirst = await login('desk1', 'temp-pass-desk-1');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-1',
      newPassword: PW,
    });
    desk = await login('desk1');

    // Create patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Kavita Patel',
      phone: '9822334455',
      dateOfBirth: '1995-04-12',
      address: 'Ahmedabad',
      lastMenstrualPeriod: '2026-05-01',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('allows calculation preview endpoint', async () => {
    const res = await call('POST', '/api/induction/calculate', doctor, {
      dilationCm: 2,
      effacementPercent: 50,
      fetalStation: -1,
      consistency: 'medium',
      position: 'mid',
      previousCesarean: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.totalScore).toBe(6);
    expect(res.body.favorability).toBe('intermediate_6_7');
  });

  it('allows clinical staff to create induction episode with automated Bishop score', async () => {
    const payload = {
      patientId,
      initiationDate: '2026-02-10',
      initiationTime: '08:00',
      gestationalAgeWeeks: 41,
      gestationalAgeDays: 2,
      indication: 'post_dates',
      indicationDetails: '41+2 weeks gestation, AFI 5.5 cm, reactive CTG',
      previousCesareanCount: 0,
      dilationCm: 1,
      effacementPercent: 30,
      fetalStation: -2,
      consistency: 'firm',
      position: 'posterior',
      ripeningMethod: 'dinoprostone_pge2_tape',
      ripeningDoseDetails: 'Propess 10 mg vaginal insert in posterior fornix',
      contraindicationsChecked: true,
      oxytocinUsed: false,
      reviewedBy: 1,
    };

    const res = await call('POST', '/api/induction', nurse, payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.bishopScoreTotal).toBe(2);
    expect(res.body.cervicalFavorability).toBe('unfavorable_le_5');

    // Verify audit record exists
    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'induction.episode_create'").get() as any;
    expect(auditRow).toBeDefined();
    expect(Number(auditRow.entity_id)).toBe(res.body.id);
  });

  it('blocks non-clinical desk attenders from recording induction', async () => {
    const payload = {
      patientId,
      initiationDate: '2026-02-10',
      gestationalAgeWeeks: 40,
      gestationalAgeDays: 0,
      indication: 'post_dates',
      dilationCm: 0,
      effacementPercent: 0,
      fetalStation: -3,
      consistency: 'firm',
      position: 'posterior',
      ripeningMethod: 'foley_bulb_mechanical',
      reviewedBy: 1,
    };

    const res = await call('POST', '/api/induction', desk, payload);
    expect(res.status).toBe(403);
  });

  it('updates induction episode with labor progression and delivery outcome', async () => {
    const createRes = await call('POST', '/api/induction', doctor, {
      patientId,
      initiationDate: '2026-02-10',
      gestationalAgeWeeks: 41,
      gestationalAgeDays: 0,
      indication: 'post_dates',
      dilationCm: 1,
      effacementPercent: 30,
      fetalStation: -2,
      consistency: 'firm',
      position: 'posterior',
      ripeningMethod: 'foley_bulb_mechanical',
      reviewedBy: 1,
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    // Doctor updates with oxytocin augmentation and vaginal delivery
    const updateRes = await call('PUT', `/api/induction/${id}`, doctor, {
      patientId,
      initiationDate: '2026-02-10',
      gestationalAgeWeeks: 41,
      gestationalAgeDays: 0,
      indication: 'post_dates',
      dilationCm: 4,
      effacementPercent: 80,
      fetalStation: 1,
      consistency: 'soft',
      position: 'anterior',
      ripeningMethod: 'foley_bulb_mechanical',
      oxytocinUsed: true,
      oxytocinStartTime: '14:00',
      oxytocinStartRateMUPerMin: 2,
      oxytocinMaxRateMUPerMin: 12,
      armPerformed: true,
      armTime: '15:30',
      liquorStatus: 'clear',
      inductionOutcome: 'vaginal_delivery',
      inductionToDeliveryHours: 11.5,
      clinicalNotes: 'Smooth vaginal delivery without lacerations',
      reviewedBy: 1,
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.inductionOutcome).toBe('vaginal_delivery');
    expect(updateRes.body.inductionToDeliveryHours).toBe(11.5);
    expect(updateRes.body.oxytocinUsed).toBe(true);
  });

  it('records print audit log entry', async () => {
    const createRes = await call('POST', '/api/induction', doctor, {
      patientId,
      initiationDate: '2026-02-10',
      gestationalAgeWeeks: 40,
      indication: 'elective_39w',
      dilationCm: 2,
      effacementPercent: 50,
      fetalStation: -1,
      consistency: 'medium',
      position: 'mid',
      ripeningMethod: 'direct_arm_oxytocin',
      reviewedBy: 1,
    });
    const id = createRes.body.id;

    const printRes = await call('POST', `/api/induction/${id}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'induction.episode_print'").get() as any;
    expect(auditRow).toBeDefined();
    expect(Number(auditRow.entity_id)).toBe(id);
  });

  it('enforces delete permission (only doctor/admin)', async () => {
    const createRes = await call('POST', '/api/induction', doctor, {
      patientId,
      initiationDate: '2026-02-10',
      gestationalAgeWeeks: 40,
      indication: 'other',
      dilationCm: 0,
      effacementPercent: 0,
      fetalStation: -3,
      consistency: 'firm',
      position: 'posterior',
      ripeningMethod: 'none',
      reviewedBy: 1,
    });
    const id = createRes.body.id;

    // Nurse cannot delete
    const nurseDel = await call('DELETE', `/api/induction/${id}`, nurse);
    expect(nurseDel.status).toBe(403);

    // Doctor can delete
    const docDel = await call('DELETE', `/api/induction/${id}`, doctor);
    expect(docDel.status).toBe(200);
    expect(docDel.body.deletedId).toBe(id);
  });
});
