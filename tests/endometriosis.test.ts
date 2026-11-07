import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateRasrmScore,
  buildEnzianCompositeCode,
  evaluateEndometriosis,
  type RasrmScoreInput,
  type EnzianInput,
  type VasPainScores,
} from '../web/src/endometriosisEngine.js';

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

describe('Endometriosis & DIE Staging Engine (rASRM & #Enzian 2021)', () => {
  it('correctly stages rASRM scores across minimal, mild, moderate, and severe stages', () => {
    // Stage I: Minimal (1-5 points)
    const stage1 = calculateRasrmScore({
      peritonealSuperficialPts: 2,
      peritonealDeepPts: 0,
      ovaryRightSuperficialPts: 1,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 0,
      ovaryLeftDeepPts: 0,
      adhesionsOvaryRightPts: 0,
      adhesionsOvaryLeftPts: 0,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 0,
      pouchOfDouglasObliteration: 'none',
    });
    expect(stage1.totalScore).toBe(3);
    expect(stage1.stage).toBe('stage_1_minimal');

    // Stage II: Mild (6-15 points)
    const stage2 = calculateRasrmScore({
      peritonealSuperficialPts: 4,
      peritonealDeepPts: 2,
      ovaryRightSuperficialPts: 2,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 0,
      ovaryLeftDeepPts: 0,
      adhesionsOvaryRightPts: 2,
      adhesionsOvaryLeftPts: 0,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 0,
      pouchOfDouglasObliteration: 'none',
    });
    expect(stage2.totalScore).toBe(10);
    expect(stage2.stage).toBe('stage_2_mild');

    // Stage III: Moderate (16-40 points)
    const stage3 = calculateRasrmScore({
      peritonealSuperficialPts: 4,
      peritonealDeepPts: 4,
      ovaryRightSuperficialPts: 0,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 2,
      ovaryLeftDeepPts: 16,
      adhesionsOvaryRightPts: 0,
      adhesionsOvaryLeftPts: 4,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 0,
      pouchOfDouglasObliteration: 'none',
    });
    expect(stage3.totalScore).toBe(30);
    expect(stage3.stage).toBe('stage_3_moderate');

    // Stage IV: Severe (>40 points), triggered by complete POD obliteration (40 points alone)
    const stage4 = calculateRasrmScore({
      peritonealSuperficialPts: 4,
      peritonealDeepPts: 4,
      ovaryRightSuperficialPts: 0,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 0,
      ovaryLeftDeepPts: 0,
      adhesionsOvaryRightPts: 0,
      adhesionsOvaryLeftPts: 0,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 0,
      pouchOfDouglasObliteration: 'complete_40pts',
    });
    expect(stage4.totalScore).toBe(48);
    expect(stage4.stage).toBe('stage_4_severe');
  });

  it('builds standard #Enzian 2021 composite classification code', () => {
    const enzian: EnzianInput = {
      peritoneum: 'P2',
      ovaryRight: 'O1',
      ovaryLeft: 'O2',
      tubeRight: null,
      tubeLeft: 'T2',
      compartmentA: 'A1',
      compartmentB: 'B2',
      compartmentC: 'C1',
      extragenitalF: 'FB',
      adenomyosisFa: true,
    };

    const code = buildEnzianCompositeCode(enzian);
    expect(code).toContain('P2');
    expect(code).toContain('O1/2');
    expect(code).toContain('A1');
    expect(code).toContain('B2');
    expect(code).toContain('C1');
    expect(code).toContain('FB');
    expect(code).toContain('FA');
  });

  it('evaluates comprehensive endometriosis pain metrics and clinical recommendations', () => {
    const rasrmInput: RasrmScoreInput = {
      peritonealSuperficialPts: 2,
      peritonealDeepPts: 4,
      ovaryRightSuperficialPts: 0,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 2,
      ovaryLeftDeepPts: 16,
      adhesionsOvaryRightPts: 0,
      adhesionsOvaryLeftPts: 4,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 4,
      pouchOfDouglasObliteration: 'partial_4pts',
    };

    const enzianInput: EnzianInput = {
      compartmentA: 'A1',
      compartmentB: 'B2',
      compartmentC: 'C1',
      extragenitalF: 'FU',
    };

    const pain: VasPainScores = {
      dysmenorrhea: 8,
      dyspareunia: 7,
      dyschezia: 5,
      dysuria: 4,
      chronicPelvicPain: 6,
    };

    const evalResult = evaluateEndometriosis(rasrmInput, enzianInput, pain);
    expect(evalResult.rasrmStage).toBe('stage_3_moderate');
    expect(evalResult.deepInfiltratingEndometriosisPresent).toBe(true);
    expect(evalResult.bowelInvolvementNoted).toBe(true);
    expect(evalResult.urinaryInvolvementNoted).toBe(true);
    expect(evalResult.painSeverityTier).toBe('severe');
    expect(evalResult.surgicalRecommendations.length).toBeGreaterThan(0);
    expect(evalResult.medicalTherapyRecommendations.some((m) => m.includes('Dienogest'))).toBe(true);
  });
});

describe('Endometriosis REST API & Audit Trails', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.endosurgeon',
      fullName: 'Dr. Kavita Sharma',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.gyn',
      fullName: 'Nurse Preeti',
      role: 'nurse',
      password: 'temp-pass-nurse-gyn',
    });
    const nurseFirst = await login('nurse.gyn', 'temp-pass-nurse-gyn');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-gyn',
      newPassword: PW,
    });
    nurse = await login('nurse.gyn');

    // Desk attender
    await call('POST', '/api/users', doctor, {
      username: 'desk.gyn',
      fullName: 'Desk Reception',
      role: 'attender',
      password: 'temp-pass-desk-gyn',
    });
    const deskFirst = await login('desk.gyn', 'temp-pass-desk-gyn');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-gyn',
      newPassword: PW,
    });
    desk = await login('desk.gyn');

    // Create Patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Ananya Deshmukh',
      phone: '9822334455',
      dateOfBirth: '1994-08-22',
      address: 'Mumbai',
      lastMenstrualPeriod: '2026-03-01',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('provides live preview calculation via POST /api/endometriosis/calculate', async () => {
    const res = await call('POST', '/api/endometriosis/calculate', doctor, {
      peritonealSuperficialPts: 2,
      peritonealDeepPts: 4,
      ovaryRightSuperficialPts: 0,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 2,
      ovaryLeftDeepPts: 16,
      adhesionsOvaryRightPts: 0,
      adhesionsOvaryLeftPts: 4,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 4,
      pouchOfDouglasObliteration: 'complete_40pts',
      compartmentA: 'A1',
      compartmentB: 'B2',
      compartmentC: 'C1',
      vasDysmenorrhea: 9,
      vasDyspareunia: 8,
      vasDyschezia: 6,
      vasDysuria: 2,
      vasChronicPelvicPain: 7,
    });

    expect(res.status).toBe(200);
    expect(res.body.rasrmTotalScore).toBe(72);
    expect(res.body.rasrmStage).toBe('stage_4_severe');
    expect(res.body.deepInfiltratingEndometriosisPresent).toBe(true);
    expect(res.body.bowelInvolvementNoted).toBe(true);
    expect(res.body.painSeverityTier).toBe('severe');
  });

  it('creates, retrieves, updates, audits, and prints endometriosis episodes', async () => {
    // 1. Create episode
    const createRes = await call('POST', '/api/endometriosis', doctor, {
      patientId,
      assessmentDate: '2026-04-12',
      assessmentType: 'laparoscopic_surgical',
      indication: 'deep_dyspareunia',
      surgicalApproach: 'laparoscopy',

      vasDysmenorrhea: 8,
      vasDyspareunia: 7,
      vasDyschezia: 4,
      vasDysuria: 1,
      vasChronicPelvicPain: 5,

      peritonealSuperficialPts: 2,
      peritonealDeepPts: 4,
      ovaryRightSuperficialPts: 0,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 2,
      ovaryLeftDeepPts: 16,
      adhesionsOvaryRightPts: 0,
      adhesionsOvaryLeftPts: 4,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 4,
      pouchOfDouglasObliteration: 'partial_4pts',

      peritoneum: 'P1',
      ovaryLeft: 'O2',
      tubeLeft: 'T1',
      compartmentA: 'A1',
      compartmentB: 'B2',
      compartmentC: 'C1',
      extragenitalF: 'FU',
      adenomyosisFa: true,

      medicalManagementRegimen: 'Dienogest 2 mg daily orally',
      surgicalProcedurePerformed: 'Laparoscopic excision of DIE nodules, ureterolysis, and left ovarian cystectomy',
      fertilitySparing: true,
      postOpHormonalSuppression: 'GnRH depot 3.75 mg monthly x 3 months',
      clinicalNotes: 'Ureterolysis performed on left ureter; normal peristalsis confirmed.',
      leadSurgeon: 'Dr. Kavita Sharma',
      reviewedBy: 1,
    });

    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.id;
    expect(episodeId).toBeGreaterThan(0);
    expect(createRes.body.rasrmStage).toBe('stage_3_moderate');
    expect(createRes.body.rasrmTotalScore).toBe(36);
    expect(createRes.body.enzianCompositeCode).toContain('FA');

    // Verify audit log
    const auditCreate = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('endometriosis.assessment_create') as any;
    expect(auditCreate).toBeDefined();
    expect(Number(auditCreate.entity_id)).toBe(episodeId);

    // 2. Retrieve episode by ID
    const getRes = await call('GET', `/api/endometriosis/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(episodeId);
    expect(getRes.body.leadSurgeon).toBe('Dr. Kavita Sharma');

    // 3. List episodes for patient
    const listRes = await call('GET', `/api/patients/${patientId}/endometriosis`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(episodeId);

    // 4. Update episode
    const updateRes = await call('PUT', `/api/endometriosis/${episodeId}`, doctor, {
      patientId,
      assessmentDate: '2026-04-12',
      assessmentType: 'laparoscopic_surgical',
      indication: 'deep_dyspareunia',
      surgicalApproach: 'laparoscopy',
      vasDysmenorrhea: 2, // Post-op reduction
      vasDyspareunia: 2,
      vasDyschezia: 1,
      vasDysuria: 0,
      vasChronicPelvicPain: 1,
      peritonealSuperficialPts: 2,
      peritonealDeepPts: 4,
      ovaryRightSuperficialPts: 0,
      ovaryRightDeepPts: 0,
      ovaryLeftSuperficialPts: 2,
      ovaryLeftDeepPts: 16,
      adhesionsOvaryRightPts: 0,
      adhesionsOvaryLeftPts: 4,
      adhesionsTubeRightPts: 0,
      adhesionsTubeLeftPts: 4,
      pouchOfDouglasObliteration: 'partial_4pts',
      medicalManagementRegimen: 'Dienogest 2mg daily continuing with symptom resolution',
      fertilitySparing: true,
      reviewedBy: 1,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.vasDysmenorrhea).toBe(2);

    const auditUpdate = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('endometriosis.assessment_update') as any;
    expect(auditUpdate).toBeDefined();

    // 5. Audit print
    const printRes = await call('POST', `/api/endometriosis/${episodeId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);
    const auditPrint = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('endometriosis.assessment_print') as any;
    expect(auditPrint).toBeDefined();

    // 6. Attender cannot delete
    const deskDelete = await call('DELETE', `/api/endometriosis/${episodeId}`, desk);
    expect(deskDelete.status).toBe(403);

    // 7. Doctor deletes episode
    const docDelete = await call('DELETE', `/api/endometriosis/${episodeId}`, doctor);
    expect(docDelete.status).toBe(200);
    expect(docDelete.body.deletedId).toBe(episodeId);

    const auditDelete = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('endometriosis.assessment_delete') as any;
    expect(auditDelete).toBeDefined();
  });
});
