import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculatePopqStage,
  type PopqGridInput,
} from '../web/src/urogynecologyEngine.js';

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

describe('Urogynecology & POP-Q Staging Engine', () => {
  it('correctly stages Pelvic Organ Prolapse from Stage 0 to Stage IV', () => {
    // Stage 0: Normal anatomical support (Aa, Ba, Ap, Bp all -3 cm, C & D <= -(tvl-2))
    const stage0 = calculatePopqStage({
      aa: -3,
      ba: -3,
      c: -7,
      gh: 3.0,
      pb: 3.0,
      tvl: 9.0,
      ap: -3,
      bp: -3,
      d: -7,
    });
    expect(stage0.stage).toBe('stage_0');
    expect(stage0.leadingCompartment).toBe('none');

    // Stage 1: Leading edge > 1 cm above hymen (< -1 cm)
    const stage1 = calculatePopqStage({
      aa: -2,
      ba: -2,
      c: -6,
      gh: 3.5,
      pb: 3.0,
      tvl: 9.0,
      ap: -3,
      bp: -3,
      d: -7,
    });
    expect(stage1.stage).toBe('stage_1');
    expect(stage1.leadingEdgeDistanceCm).toBe(-2);
    expect(stage1.leadingCompartment).toBe('anterior_cystocele');

    // Stage 2: Leading edge between -1 cm and +1 cm
    const stage2 = calculatePopqStage({
      aa: 0,
      ba: 0.5,
      c: -4,
      gh: 4.0,
      pb: 2.5,
      tvl: 9.0,
      ap: -2,
      bp: -2,
      d: -6,
    });
    expect(stage2.stage).toBe('stage_2');
    expect(stage2.leadingEdgeDistanceCm).toBe(0.5);

    // Stage 3: Marked prolapse > +1 cm outside hymen, but < (tvl - 2)
    const stage3 = calculatePopqStage({
      aa: +1,
      ba: +3,
      c: -1,
      gh: 4.5,
      pb: 2.5,
      tvl: 9.0,
      ap: -2,
      bp: -1,
      d: -5,
    });
    expect(stage3.stage).toBe('stage_3');
    expect(stage3.leadingEdgeDistanceCm).toBe(3);
    expect(stage3.leadingCompartment).toBe('anterior_cystocele');

    // Stage 4: Complete eversion / procidentia (>= tvl - 2 = 7 cm on tvl 9.0)
    const stage4 = calculatePopqStage({
      aa: +3,
      ba: +7,
      c: +7,
      gh: 6.0,
      pb: 1.5,
      tvl: 9.0,
      ap: +3,
      bp: +6,
      d: +6,
    });
    expect(stage4.stage).toBe('stage_4');
    expect(stage4.leadingEdgeDistanceCm).toBe(7);
  });

  it('determines leading prolapse compartment and pessary management recommendations', () => {
    // Stage 2 Cystocele
    const cystoceleStage2 = calculatePopqStage({
      aa: 0,
      ba: 0.5,
      c: -5,
      gh: 4,
      pb: 3,
      tvl: 9,
      ap: -3,
      bp: -3,
      d: -7,
    });
    expect(cystoceleStage2.leadingCompartment).toBe('anterior_cystocele');
    expect(cystoceleStage2.compartmentSummary).toContain('Cystocele');
    expect(cystoceleStage2.pessaryRecommendation).toContain('Ring with support');

    // Stage 3 Cystocele
    const cystoceleStage3 = calculatePopqStage({
      aa: 1,
      ba: 2.5,
      c: -5,
      gh: 4,
      pb: 3,
      tvl: 9,
      ap: -3,
      bp: -3,
      d: -7,
    });
    expect(cystoceleStage3.leadingCompartment).toBe('anterior_cystocele');
    expect(cystoceleStage3.compartmentSummary).toContain('Cystocele');
    expect(cystoceleStage3.pessaryRecommendation).toContain('Gellhorn pessary');

    // Rectocele
    const rectocele = calculatePopqStage({
      aa: -3,
      ba: -3,
      c: -6,
      gh: 4,
      pb: 2,
      tvl: 9,
      ap: 1,
      bp: 2.5,
      d: -7,
    });
    expect(rectocele.leadingCompartment).toBe('posterior_rectocele');
    expect(rectocele.compartmentSummary).toContain('Rectocele');
  });
});

describe('Urogynecology & POP-Q Registry REST API & Auditing', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.urogyn',
      fullName: 'Dr. Sunita Rao',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.urogyn',
      fullName: 'Nurse Sarah',
      role: 'nurse',
      password: 'temp-pass-nurse-urogyn',
    });
    const nurseFirst = await login('nurse.urogyn', 'temp-pass-nurse-urogyn');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-urogyn',
      newPassword: PW,
    });
    nurse = await login('nurse.urogyn');

    // Desk attender
    await call('POST', '/api/users', doctor, {
      username: 'desk.urogyn',
      fullName: 'Desk Clerk',
      role: 'attender',
      password: 'temp-pass-desk-urogyn',
    });
    const deskFirst = await login('desk.urogyn', 'temp-pass-desk-urogyn');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-urogyn',
      newPassword: PW,
    });
    desk = await login('desk.urogyn');

    // Create Patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Meenakshi Iyer',
      phone: '9844556677',
      dateOfBirth: '1968-03-15',
      address: 'Chennai',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('provides live POP-Q preview calculation via POST /api/urogynecology/calculate-popq', async () => {
    const res = await call('POST', '/api/urogynecology/calculate-popq', doctor, {
      aa: +1,
      ba: +3,
      c: -2,
      gh: 4.5,
      pb: 2.5,
      tvl: 9.0,
      ap: -2,
      bp: -1,
      d: -6,
    });

    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('stage_3');
    expect(res.body.leadingEdgeDistanceCm).toBe(3);
    expect(res.body.leadingCompartment).toBe('anterior_cystocele');
  });

  it('creates, retrieves, updates, audits, and prints urogynecology POP-Q records', async () => {
    // 1. Create episode
    const createRes = await call('POST', '/api/urogynecology', doctor, {
      patientId,
      assessmentDate: '2026-05-10',
      parity: 'P3+0',
      menopausalStatus: 'postmenopausal',

      popqAaCm: +1.0,
      popqBaCm: +3.0,
      popqCCm: -1.0,
      popqGhCm: 4.5,
      popqPbCm: 2.5,
      popqTvlCm: 9.0,
      popqApCm: -2.0,
      popqBpCm: -1.0,
      popqDCm: -5.0,

      urinaryIncontinenceType: 'mixed_mui',
      padCountPerDay: 2,
      bladderDiaryDayFrequency: 8,
      bladderDiaryNocturia: 3,
      leakEpisodes24h: 3,
      botherScoreIciqSf: 14,

      pessaryManagement: 'fitted_ring',
      pessarySizeMm: 70,
      pessaryChangeIntervalWeeks: 12,
      pelvicFloorPhysiotherapy: true,
      surgicalProcedurePlanned: 'Anterior Colporrhaphy + TOT Sling',
      clinicalNotes: 'Trial of ring pessary size 70 initiated with good retention and voiding without difficulty.',
      performedBy: 'Dr. Sunita Rao',
      reviewedBy: 1,
    });

    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.id;
    expect(episodeId).toBeGreaterThan(0);
    expect(createRes.body.popqStage).toBe('stage_3');
    expect(createRes.body.leadingCompartment).toBe('anterior_cystocele');
    expect(createRes.body.leadingEdgeDistanceCm).toBe(3);

    // Verify audit log
    const auditCreate = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('urogynecology.assessment_create') as any;
    expect(auditCreate).toBeDefined();
    expect(Number(auditCreate.entity_id)).toBe(episodeId);

    // 2. Retrieve episode by ID
    const getRes = await call('GET', `/api/urogynecology/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(episodeId);
    expect(getRes.body.performedBy).toBe('Dr. Sunita Rao');

    // 3. List episodes for patient
    const listRes = await call('GET', `/api/patients/${patientId}/urogynecology`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(episodeId);

    // 4. Update episode (e.g. pessary check follow-up)
    const updateRes = await call('PUT', `/api/urogynecology/${episodeId}`, doctor, {
      patientId,
      assessmentDate: '2026-05-10',
      parity: 'P3+0',
      menopausalStatus: 'postmenopausal',
      popqAaCm: -2.0, // Reduced with pessary in situ
      popqBaCm: -2.0,
      popqCCm: -6.0,
      popqGhCm: 4.0,
      popqPbCm: 2.5,
      popqTvlCm: 9.0,
      popqApCm: -2.0,
      popqBpCm: -2.0,
      popqDCm: -7.0,
      urinaryIncontinenceType: 'stress_sui',
      padCountPerDay: 0,
      pessaryManagement: 'fitted_ring',
      pessarySizeMm: 70,
      pelvicFloorPhysiotherapy: true,
      clinicalNotes: 'Pessary well retained. No vaginal erosion noted on speculum exam.',
      reviewedBy: 1,
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.padCountPerDay).toBe(0);

    const auditUpdate = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('urogynecology.assessment_update') as any;
    expect(auditUpdate).toBeDefined();

    // 5. Audit print
    const printRes = await call('POST', `/api/urogynecology/${episodeId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);
    const auditPrint = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('urogynecology.assessment_print') as any;
    expect(auditPrint).toBeDefined();

    // 6. Attender cannot delete
    const deskDelete = await call('DELETE', `/api/urogynecology/${episodeId}`, desk);
    expect(deskDelete.status).toBe(403);

    // 7. Doctor deletes episode
    const docDelete = await call('DELETE', `/api/urogynecology/${episodeId}`, doctor);
    expect(docDelete.status).toBe(200);
    expect(docDelete.body.deletedId).toBe(episodeId);

    const auditDelete = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('urogynecology.assessment_delete') as any;
    expect(auditDelete).toBeDefined();
  });
});
