import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateRmi1,
  evaluateIotaSimpleRules,
  evaluatePmbEndometrialThickness,
} from '../web/src/gynOncologyEngine.js';

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

describe('Gynecological Oncology & Malignancy Risk Engine (RMI-1 & IOTA)', () => {
  it('correctly calculates Jacobs RMI-1 score across low, intermediate, and high risk tiers', () => {
    // Low risk: Premenopausal (M=1), 0 US features (U=0), CA125 = 15 -> RMI = 0
    const low = calculateRmi1({
      ca125LevelUml: 15,
      isPostmenopausal: false,
      multilocularCysts: false,
      solidAreasPresent: false,
      bilateralLesions: false,
      ascitesPresent: false,
      metastasesPresent: false,
    });
    expect(low.ultrasoundScoreU).toBe(0);
    expect(low.menopausalScoreM).toBe(1);
    expect(low.rmiScore).toBe(0);
    expect(low.riskTier).toBe('low_risk_le_25');

    // Intermediate risk: Postmenopausal (M=3), 1 US feature (U=1), CA125 = 40 -> RMI = 1 * 3 * 40 = 120
    const inter = calculateRmi1({
      ca125LevelUml: 40,
      isPostmenopausal: true,
      multilocularCysts: true,
      solidAreasPresent: false,
      bilateralLesions: false,
      ascitesPresent: false,
      metastasesPresent: false,
    });
    expect(inter.ultrasoundScoreU).toBe(1);
    expect(inter.menopausalScoreM).toBe(3);
    expect(inter.rmiScore).toBe(120);
    expect(inter.riskTier).toBe('intermediate_risk_26_200');

    // High risk: Postmenopausal (M=3), 2 US features (U=3), CA125 = 150 -> RMI = 3 * 3 * 150 = 1350 > 200
    const high = calculateRmi1({
      ca125LevelUml: 150,
      isPostmenopausal: true,
      multilocularCysts: true,
      solidAreasPresent: true,
      bilateralLesions: false,
      ascitesPresent: false,
      metastasesPresent: false,
    });
    expect(high.ultrasoundScoreU).toBe(3);
    expect(high.menopausalScoreM).toBe(3);
    expect(high.rmiScore).toBe(1350);
    expect(high.riskTier).toBe('high_risk_gt_200');
    expect(high.recommendation).toContain('Urgent Gynecological Oncologist referral');
  });

  it('evaluates IOTA Simple Rules categories (benign, malignant, inconclusive)', () => {
    // Benign mass (B-rules present, 0 M-rules)
    const benign = evaluateIotaSimpleRules({
      b1Unilocular: true,
      b2SolidLargestLt7mm: false,
      b3AcousticShadows: true,
      b4SmoothMultilocularLt100mm: false,
      b5NoBloodFlowScore1: true,
      m1IrregularSolid: false,
      m2Ascites: false,
      m3AtLeast4PapillaryStructures: false,
      m4IrregularMultilocularSolidGe100mm: false,
      m5VeryStrongBloodFlowScore4: false,
    });
    expect(benign.category).toBe('benign');
    expect(benign.bFeatureCount).toBe(3);
    expect(benign.mFeatureCount).toBe(0);

    // Malignant mass (M-rules present, 0 B-rules)
    const mal = evaluateIotaSimpleRules({
      b1Unilocular: false,
      b2SolidLargestLt7mm: false,
      b3AcousticShadows: false,
      b4SmoothMultilocularLt100mm: false,
      b5NoBloodFlowScore1: false,
      m1IrregularSolid: true,
      m2Ascites: true,
      m3AtLeast4PapillaryStructures: true,
      m4IrregularMultilocularSolidGe100mm: false,
      m5VeryStrongBloodFlowScore4: true,
    });
    expect(mal.category).toBe('malignant');
    expect(mal.mFeatureCount).toBe(4);
    expect(mal.bFeatureCount).toBe(0);

    // Inconclusive mass (both present)
    const incon = evaluateIotaSimpleRules({
      b1Unilocular: false,
      b2SolidLargestLt7mm: false,
      b3AcousticShadows: true,
      b4SmoothMultilocularLt100mm: false,
      b5NoBloodFlowScore1: false,
      m1IrregularSolid: true,
      m2Ascites: false,
      m3AtLeast4PapillaryStructures: false,
      m4IrregularMultilocularSolidGe100mm: false,
      m5VeryStrongBloodFlowScore4: false,
    });
    expect(incon.category).toBe('inconclusive');
  });

  it('evaluates postmenopausal bleeding (PMB) endometrial thickness thresholds', () => {
    // Postmenopausal with PMB and ET = 6mm (> 4mm cutoff)
    const pmbAbnormal = evaluatePmbEndometrialThickness({
      isPostmenopausal: true,
      hasPostmenopausalBleeding: true,
      endometrialThicknessMm: 6.0,
    });
    expect(pmbAbnormal.biopsyIndicated).toBe(true);
    expect(pmbAbnormal.cutoffMm).toBe(4.0);
    expect(pmbAbnormal.rationale).toContain('Urgent endometrial tissue sampling');

    // Postmenopausal with PMB and ET = 3mm (<= 4mm cutoff)
    const pmbNormal = evaluatePmbEndometrialThickness({
      isPostmenopausal: true,
      hasPostmenopausalBleeding: true,
      endometrialThicknessMm: 3.0,
    });
    expect(pmbNormal.biopsyIndicated).toBe(false);

    // Patient on Tamoxifen (cutoff 3mm)
    const tamoxifen = evaluatePmbEndometrialThickness({
      isPostmenopausal: true,
      hasPostmenopausalBleeding: true,
      endometrialThicknessMm: 3.5,
      onTamoxifen: true,
    });
    expect(tamoxifen.biopsyIndicated).toBe(true);
    expect(tamoxifen.cutoffMm).toBe(3.0);
  });
});

describe('Gynecological Oncology REST API & Audit Trails', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.oncologist',
      fullName: 'Dr. Radhika Mukherjee',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.onc',
      fullName: 'Nurse Deepa',
      role: 'nurse',
      password: 'temp-pass-nurse-onc',
    });
    const nurseFirst = await login('nurse.onc', 'temp-pass-nurse-onc');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-onc',
      newPassword: PW,
    });
    nurse = await login('nurse.onc');

    // Desk attender
    await call('POST', '/api/users', doctor, {
      username: 'desk.onc',
      fullName: 'Desk Staff',
      role: 'attender',
      password: 'temp-pass-desk-onc',
    });
    const deskFirst = await login('desk.onc', 'temp-pass-desk-onc');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-onc',
      newPassword: PW,
    });
    desk = await login('desk.onc');

    // Create Patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Saraswati Patel',
      phone: '9855667788',
      dateOfBirth: '1960-11-04',
      address: 'Ahmedabad',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('provides live preview calculation via POST /api/gyn-oncology/calculate-rmi', async () => {
    const res = await call('POST', '/api/gyn-oncology/calculate-rmi', doctor, {
      ca125LevelUml: 240,
      isPostmenopausal: true,
      multilocularCysts: true,
      solidAreasPresent: true,
      bilateralLesions: true,
      ascitesPresent: true,
      metastasesPresent: false,
      hasPostmenopausalBleeding: true,
      endometrialThicknessMm: 7.5,
    });

    expect(res.status).toBe(200);
    expect(res.body.rmi.rmiScore).toBe(2160);
    expect(res.body.rmi.riskTier).toBe('high_risk_gt_200');
    expect(res.body.pmb.biopsyIndicated).toBe(true);
  });

  it('creates, retrieves, updates, audits, and prints gynecological oncology episodes', async () => {
    // 1. Create episode
    const createRes = await call('POST', '/api/gyn-oncology', doctor, {
      patientId,
      assessmentDate: '2026-06-01',
      clinicalIndication: 'adnexal_mass',
      menopausalStatus: 'postmenopausal',

      ca125LevelUml: 185.0,
      he4PmolL: 95.0,
      romaScorePercent: 42.5,

      lesionMaxDiameterMm: 68.0,
      proportionSolidTissuePercent: 35.0,
      papillaryProjectionsCount: 2,
      acousticShadowsPresent: false,
      ascitesPresent: true,
      bilateralLesions: true,
      multilocularCysts: true,
      colorDopplerScore: 3,

      endometrialThicknessMm: 6.5,
      endometrialBiopsyDone: false,
      endometrialHistology: '',

      cervicalLesionVisible: false,
      figoClinicalStage: 'FIGO Stage IC2 suspected',

      multidisciplinaryTumorBoardStatus: 'pending_board_review',
      managementPlan: 'Urgent CECT abdomen and pelvis. Multi-disciplinary tumor board discussion scheduled.',
      surgicalStagingDetails: 'Total abdominal hysterectomy, bilateral salpingo-oophorectomy, infragastric omentectomy.',
      clinicalNotes: 'Ascites identified on ultrasound with bilateral multilocular-solid ovarian masses.',

      gynOncologistName: 'Dr. Radhika Mukherjee',
      reviewedBy: 1,
    });

    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.id;
    expect(episodeId).toBeGreaterThan(0);
    expect(createRes.body.rmiRiskTier).toBe('high_risk_gt_200');
    expect(createRes.body.rmiScore).toBeGreaterThan(200);

    // Verify audit log
    const auditCreate = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('gyn_oncology.assessment_create') as any;
    expect(auditCreate).toBeDefined();
    expect(Number(auditCreate.entity_id)).toBe(episodeId);

    // 2. Retrieve episode by ID
    const getRes = await call('GET', `/api/gyn-oncology/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(episodeId);
    expect(getRes.body.gynOncologistName).toBe('Dr. Radhika Mukherjee');

    // 3. List episodes for patient
    const listRes = await call('GET', `/api/patients/${patientId}/gyn-oncology`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(episodeId);

    // 4. Update episode with tumor board outcome
    const updateRes = await call('PUT', `/api/gyn-oncology/${episodeId}`, doctor, {
      patientId,
      assessmentDate: '2026-06-01',
      clinicalIndication: 'adnexal_mass',
      menopausalStatus: 'postmenopausal',
      ca125LevelUml: 185.0,
      lesionMaxDiameterMm: 68.0,
      multidisciplinaryTumorBoardStatus: 'discussed_approved',
      managementPlan: 'Approved for primary cytoreductive laparotomy with frozen section.',
      endometrialBiopsyDone: true,
      endometrialHistology: 'Benign atrophic endometrium',
      reviewedBy: 1,
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.multidisciplinaryTumorBoardStatus).toBe('discussed_approved');
    expect(updateRes.body.endometrialBiopsyDone).toBe(true);

    const auditUpdate = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('gyn_oncology.assessment_update') as any;
    expect(auditUpdate).toBeDefined();

    // 5. Audit print
    const printRes = await call('POST', `/api/gyn-oncology/${episodeId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);
    const auditPrint = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('gyn_oncology.assessment_print') as any;
    expect(auditPrint).toBeDefined();

    // 6. Attender cannot delete
    const deskDelete = await call('DELETE', `/api/gyn-oncology/${episodeId}`, desk);
    expect(deskDelete.status).toBe(403);

    // 7. Doctor deletes episode
    const docDelete = await call('DELETE', `/api/gyn-oncology/${episodeId}`, doctor);
    expect(docDelete.status).toBe(200);
    expect(docDelete.body.deletedId).toBe(episodeId);

    const auditDelete = db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1')
      .get('gyn_oncology.assessment_delete') as any;
    expect(auditDelete).toBeDefined();
  });
});
