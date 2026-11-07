import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateAntiDRequirements,
  calculatePerinatalLossAudit,
  type PerinatalLossInput,
} from '../web/src/perinatalLossEngine.js';

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

describe('Perinatal Loss & Stillbirth Audit Engine', () => {
  it('calculates Anti-D requirements based on maternal blood group and Kleihauer-Betke FMH', () => {
    // 1. Rh-positive mother -> not indicated
    const posMother = calculateAntiDRequirements('O_positive', 10);
    expect(posMother.indicated).toBe(false);
    expect(posMother.recommendedDoseMcg).toBe(0);

    // 2. Rh-negative mother with standard FMH <= 30 mL -> 300 mcg (1500 IU)
    const negMotherStandard = calculateAntiDRequirements('O_negative', 15);
    expect(negMotherStandard.indicated).toBe(true);
    expect(negMotherStandard.recommendedDoseMcg).toBe(300);

    // 3. Rh-negative mother with massive fetomaternal hemorrhage (>30 mL) -> escalated dose
    const negMotherMassive = calculateAntiDRequirements('A_negative', 50);
    expect(negMotherMassive.indicated).toBe(true);
    expect(negMotherMassive.recommendedDoseMcg).toBe(500); // 300 + (20 * 10)
  });

  it('evaluates placental abruption recurrence risk and generates evidence-based prevention plan', () => {
    const input: PerinatalLossInput = {
      lossType: 'stillbirth_antepartum',
      gestationalAgeWeeks: 32,
      fetalBirthWeightG: 1600,
      primaryCauseCategory: 'placental_abruption',
      primaryCauseDetails: 'Severe concealed abruption with coagulopathy',
      maternalBloodGroup: 'O_negative',
      fetomaternalHemorrhageMl: 20,
    };

    const audit = calculatePerinatalLossAudit(input);
    expect(audit.recurrenceRiskCategory).toBe('moderate_2_to_5_pct');
    expect(audit.recurrenceRiskPercentageText).toContain('2% to 5%');
    expect(audit.antiDRecommendation.indicated).toBe(true);
    expect(audit.lactationSuppressionPlan).toContain('Cabergoline 1 mg PO');
    expect(audit.futurePregnancyPlan.some((p) => p.includes('Aspirin 150 mg'))).toBe(true);
    expect(audit.bereavementGuidelines.some((b) => b.includes('memory box'))).toBe(true);
  });
});

describe('Perinatal Loss REST API & Audit Trails', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.meera',
      fullName: 'Dr. Meera Nambiar',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse
    await call('POST', '/api/users', doctor, {
      username: 'nurse1',
      fullName: 'Staff Nurse Geeta',
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
      fullName: 'Desk Receptionist',
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
      fullName: 'Shalini Verma',
      phone: '9844001122',
      dateOfBirth: '1993-11-15',
      address: 'Bengaluru',
      lastMenstrualPeriod: '2026-04-10',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('provides live audit calculation preview endpoint', async () => {
    const res = await call('POST', '/api/perinatal-loss/calculate', doctor, {
      lossType: 'stillbirth_antepartum',
      gestationalAgeWeeks: 34,
      primaryCauseCategory: 'placental_insufficiency_infarction',
      primaryCauseDetails: 'Severe placental infarction >30%',
      maternalBloodGroup: 'B_negative',
      fetomaternalHemorrhageMl: 12,
    });
    expect(res.status).toBe(200);
    expect(res.body.recurrenceRiskCategory).toBe('moderate_2_to_5_pct');
    expect(res.body.antiDRecommendation.indicated).toBe(true);
  });

  it('allows clinical staff to record perinatal loss episode with audit logging', async () => {
    const payload = {
      patientId,
      lossType: 'stillbirth_antepartum',
      diagnosisDate: '2026-03-01',
      deliveryDate: '2026-03-02',
      deliveryTime: '04:15',
      gestationalAgeWeeks: 33,
      gestationalAgeDays: 4,
      fetalBirthWeightG: 1720,
      modeOfDelivery: 'induced_vaginal',
      fetalAppearance: 'fresh_stillbirth',
      primaryCauseCategory: 'placental_abruption',
      primaryCauseDetails: 'Retroplacental hemorrhage ~250 mL',
      contributingFactors: 'Pre-existing gestational hypertension',
      maternalBloodGroup: 'A_negative',
      fetomaternalHemorrhageMl: 15,
      antiDAdministered: true,
      antiDDoseMcg: 300,
      lactationSuppressionGiven: true,
      lactationSuppressionDetails: 'Cabergoline 1 mg stat',
      memoryBoxOffered: true,
      memoryBoxAccepted: true,
      bereavementCounselorContacted: true,
      recurrenceRiskCategory: 'moderate_2_to_5_pct',
      futurePregnancyPlan: 'Aspirin 150 mg PO nightly from 11w, Calcium 2g/d, Doppler surveillance from 24w',
      consultantName: 'Dr. Meera Nambiar',
      reviewedBy: 1,
    };

    const res = await call('POST', '/api/perinatal-loss', nurse, payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.lossType).toBe('stillbirth_antepartum');
    expect(res.body.antiDAdministered).toBe(true);

    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'perinatal_loss.episode_create'").get() as any;
    expect(auditRow).toBeDefined();
    expect(Number(auditRow.entity_id)).toBe(res.body.id);
  });

  it('blocks non-clinical attenders from creating perinatal loss record', async () => {
    const payload = {
      patientId,
      lossType: 'stillbirth_antepartum',
      diagnosisDate: '2026-03-01',
      gestationalAgeWeeks: 30,
      modeOfDelivery: 'spontaneous_vaginal',
      primaryCauseCategory: 'unexplained_idiopathic',
      primaryCauseDetails: 'Unexplained demise',
      futurePregnancyPlan: 'Follow-up plan',
    };

    const res = await call('POST', '/api/perinatal-loss', desk, payload);
    expect(res.status).toBe(403);
  });

  it('updates perinatal loss episode with pathology findings', async () => {
    const createRes = await call('POST', '/api/perinatal-loss', doctor, {
      patientId,
      lossType: 'stillbirth_antepartum',
      diagnosisDate: '2026-03-01',
      gestationalAgeWeeks: 32,
      modeOfDelivery: 'induced_vaginal',
      primaryCauseCategory: 'placental_abruption',
      primaryCauseDetails: 'Abruption observed on scan',
      futurePregnancyPlan: 'Aspirin in next pregnancy',
      reviewedBy: 1,
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    // Doctor updates with autopsy consent & placental histopathology findings
    const updateRes = await call('PUT', `/api/perinatal-loss/${id}`, doctor, {
      patientId,
      lossType: 'stillbirth_antepartum',
      diagnosisDate: '2026-03-01',
      gestationalAgeWeeks: 32,
      modeOfDelivery: 'induced_vaginal',
      primaryCauseCategory: 'placental_abruption',
      primaryCauseDetails: 'Placental histopathology confirms 30% retroplacental hematoma with villous ischemia',
      placentalHistologyFindings: 'Marked maternal vascular malperfusion with diffuse intervillous thrombi',
      cmaChromosomalResult: 'Chromosomal Microarray: Arr(1-22,X)x2 - Normal female molecular karyotype',
      futurePregnancyPlan: 'Maternal-fetal medicine joint clinic booking at 8w; Aspirin 150 mg from 12w',
      counselingNotes: 'Reviewed full pathology report with parents. Supported emotionally.',
      reviewedBy: 1,
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.primaryCauseDetails).toContain('histopathology confirms');
  });

  it('records print audit log entry', async () => {
    const createRes = await call('POST', '/api/perinatal-loss', doctor, {
      patientId,
      lossType: 'stillbirth_antepartum',
      diagnosisDate: '2026-03-01',
      gestationalAgeWeeks: 32,
      modeOfDelivery: 'induced_vaginal',
      primaryCauseCategory: 'unexplained_idiopathic',
      primaryCauseDetails: 'Initial assessment',
      futurePregnancyPlan: 'Planned review',
      reviewedBy: 1,
    });
    const id = createRes.body.id;

    const printRes = await call('POST', `/api/perinatal-loss/${id}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'perinatal_loss.episode_print'").get() as any;
    expect(auditRow).toBeDefined();
    expect(Number(auditRow.entity_id)).toBe(id);
  });

  it('enforces delete permission (only doctor/admin)', async () => {
    const createRes = await call('POST', '/api/perinatal-loss', doctor, {
      patientId,
      lossType: 'early_miscarriage_lt_12w',
      diagnosisDate: '2026-03-01',
      gestationalAgeWeeks: 10,
      modeOfDelivery: 'surgical_evacuation_d_and_e',
      primaryCauseCategory: 'fetal_anomaly_genetic',
      primaryCauseDetails: 'Early missed miscarriage with hydropic changes',
      futurePregnancyPlan: 'Preconception genetic counseling',
      reviewedBy: 1,
    });
    const id = createRes.body.id;

    // Nurse blocked from deleting
    const nurseDel = await call('DELETE', `/api/perinatal-loss/${id}`, nurse);
    expect(nurseDel.status).toBe(403);

    // Doctor can delete
    const docDel = await call('DELETE', `/api/perinatal-loss/${id}`, doctor);
    expect(docDel.status).toBe(200);
    expect(docDel.body.deletedId).toBe(id);
  });
});
