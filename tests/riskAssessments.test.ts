import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluatePreEclampsiaRisk,
  evaluateVteRisk,
  evaluateGdmRisk,
  evaluatePtbRisk,
  evaluateOverallRisk,
} from '../web/src/antenatalRiskScoring.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
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

  patientId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Ananya Sharma',
    dateOfBirth: '1989-03-15',
    phone: '9876543210',
    lastMenstrualPeriod: '2026-02-01',
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('Antenatal Clinical Risk Stratification Calculations', () => {
  it('evaluates Pre-eclampsia risk and Aspirin indications per NICE/ACOG standards', () => {
    // 1 Major factor (Chronic HTN) -> High Risk, Aspirin indicated
    const r1 = evaluatePreEclampsiaRisk(['chronic_htn']);
    expect(r1.level).toBe('high');
    expect(r1.aspirinIndicated).toBe(true);
    expect(r1.calciumIndicated).toBe(true);
    expect(r1.dosageAdvice).toContain('Aspirin 150 mg');

    // 2 Moderate factors (Nulliparity + Age >= 35) -> High Risk, Aspirin indicated
    const r2 = evaluatePreEclampsiaRisk(['nulliparity', 'age_ge_35']);
    expect(r2.level).toBe('high');
    expect(r2.aspirinIndicated).toBe(true);

    // 1 Moderate factor alone (Family history only) -> Moderate Risk, Aspirin not mandatory
    const r3 = evaluatePreEclampsiaRisk(['family_history_pe']);
    expect(r3.level).toBe('moderate');
    expect(r3.aspirinIndicated).toBe(false);

    // Zero factors -> Low Risk
    const r0 = evaluatePreEclampsiaRisk([]);
    expect(r0.level).toBe('low');
    expect(r0.aspirinIndicated).toBe(false);
  });

  it('calculates VTE Obstetric score and LMWH prophylaxis timing per RCOG Green-top 37a', () => {
    // Previous unprovoked VTE (4 points) -> High Risk, 1st trimester LMWH
    const v1 = evaluateVteRisk(['prev_vte_unprovoked']);
    expect(v1.score).toBe(4);
    expect(v1.level).toBe('high');
    expect(v1.lmwhTiming).toContain('1st trimester');

    // Intermediate risk: score 3 (e.g. Previous provoked VTE) -> LMWH from 28 weeks
    const v2 = evaluateVteRisk(['prev_vte_provoked']);
    expect(v2.score).toBe(3);
    expect(v2.level).toBe('intermediate');
    expect(v2.lmwhTiming).toContain('28 weeks');

    // Score 2 (e.g. Age > 35 + Obesity BMI 32) -> Postpartum LMWH for 10 days
    const v3 = evaluateVteRisk(['age_gt_35', 'obesity_bmi_30_39']);
    expect(v3.score).toBe(2);
    expect(v3.level).toBe('low_moderate');
    expect(v3.lmwhTiming).toContain('Postpartum');

    // Score 0 -> Low Risk
    const v0 = evaluateVteRisk([]);
    expect(v0.score).toBe(0);
    expect(v0.level).toBe('low');
  });

  it('evaluates GDM risk and OGTT diagnostic plasma glucose cutoffs (DIPSI/FIGO)', () => {
    // High-risk factors (Prior GDM + BMI >= 30)
    const g1 = evaluateGdmRisk(['prior_gdm', 'bmi_ge_30']);
    expect(g1.riskLevel).toBe('high');
    expect(g1.screeningAdvice).toContain('12–16 weeks');

    // Test entry with elevated fasting glucose (98 mg/dL >= 92 cutoff) -> GDM Confirmed
    const g2 = evaluateGdmRisk(['prior_gdm'], { fasting: 98, oneHour: 155, twoHour: 130 });
    expect(g2.diagnosisStatus).toBe('gdm_confirmed');
    expect(g2.diagnosisDetail).toContain('Gestational Diabetes Mellitus Confirmed');

    // Test entry with normal values -> Euglycemic
    const g3 = evaluateGdmRisk([], { fasting: 84, oneHour: 140, twoHour: 122 });
    expect(g3.diagnosisStatus).toBe('normal');
  });

  it('evaluates Preterm Birth risk and Progesterone indications', () => {
    // Prior spontaneous preterm delivery -> High risk, progesterone indicated
    const p1 = evaluatePtbRisk(['prior_spontaneous_ptb']);
    expect(p1.riskLevel).toBe('high');
    expect(p1.progesteroneIndicated).toBe(true);

    // No factors -> Low risk
    const p0 = evaluatePtbRisk([]);
    expect(p0.riskLevel).toBe('low');
    expect(p0.progesteroneIndicated).toBe(false);
  });

  it('aggregates multi-system risk into an overall pregnancy risk level', () => {
    const pe = evaluatePreEclampsiaRisk(['chronic_htn']);
    const vte = evaluateVteRisk(['age_gt_35']);
    const gdm = evaluateGdmRisk(['family_history_dm']);
    const ptb = evaluatePtbRisk([]);

    const overall = evaluateOverallRisk(pe, vte, gdm, ptb);
    expect(overall.overallLevel).toBe('high_risk');
    expect(overall.prophylaxisSummary).toEqual(expect.arrayContaining([expect.stringContaining('Aspirin')]));
  });
});

describe('Antenatal Risk Assessments API', () => {
  it('enforces role permissions: doctor & nurse allowed, desk & unauthenticated blocked', async () => {
    const payload = {
      assessmentDate: '2026-05-01',
      gestationalAgeWeeks: 12,
      gestationalAgeDays: 4,
      peFactors: ['chronic_htn'],
      peRiskLevel: 'high',
      peAspirinIndicated: true,
      peAspirinPrescribed: true,
      peAspirinDosage: 'Aspirin 150 mg PO bedtime',
      overallRiskLevel: 'high_risk',
    };

    // Desk attender blocked
    const resDesk = await call('POST', `/api/patients/${patientId}/risk-assessments`, desk, payload);
    expect(resDesk.status).toBe(403);

    // Unauthenticated blocked
    const resAnon = await call('POST', `/api/patients/${patientId}/risk-assessments`, undefined, payload);
    expect(resAnon.status).toBe(401);

    // Doctor allowed
    const resDoc = await call('POST', `/api/patients/${patientId}/risk-assessments`, doctor, payload);
    expect(resDoc.status).toBe(201);
    expect(resDoc.body.peRiskLevel).toBe('high');
    expect(resDoc.body.peAspirinIndicated).toBe(true);
    expect(resDoc.body.peAspirinPrescribed).toBe(true);
  });

  it('records, lists, updates, deletes and summarizes antenatal risk assessments with audit trail', async () => {
    // 1. Create risk assessment with multi-system risk criteria
    const created = await call('POST', `/api/patients/${patientId}/risk-assessments`, nurse, {
      assessmentDate: '2026-05-10',
      gestationalAgeWeeks: 14,
      gestationalAgeDays: 0,
      peFactors: ['prior_pe'],
      peRiskLevel: 'high',
      peAspirinIndicated: true,
      peAspirinPrescribed: true,
      peAspirinDosage: 'Aspirin 150mg PO at bedtime (12 to 36 weeks)',
      peCalciumIndicated: true,
      peCalciumPrescribed: true,
      vteFactors: ['prev_vte_provoked'],
      vteScore: 3,
      vteRiskLevel: 'intermediate',
      vteProphylaxisRecommended: 'LMWH from 28 weeks + 10 days postpartum',
      vteLmwhPrescribed: true,
      vteLmwhDosage: 'Enoxaparin 40mg SC daily starting at 28w',
      gdmFactors: ['prior_gdm'],
      gdmRiskLevel: 'high',
      gdmScreeningTiming: 'Early OGTT at 14 weeks',
      gdmDiagnosisStatus: 'pending',
      ptbFactors: [],
      ptbRiskLevel: 'low',
      overallRiskLevel: 'high_risk',
      highRiskReasons: 'Prior Pre-eclampsia, Prior Provoked VTE (Score 3), Prior GDM',
      clinicalActionPlan: 'Initiated Aspirin 150mg + Calcium 1g. Scheduled LMWH for 28w. Ordered early 75g OGTT.',
      nextReviewDate: '2026-06-07',
    });

    expect(created.status).toBe(201);
    const assessmentId = created.body.id;
    expect(assessmentId).toBeGreaterThan(0);
    expect(created.body.peFactors).toEqual(['prior_pe']);
    expect(created.body.vteScore).toBe(3);

    // 2. Fetch single assessment
    const getSingle = await call('GET', `/api/risk-assessments/${assessmentId}`, doctor);
    expect(getSingle.status).toBe(200);
    expect(getSingle.body.patientName).toBe('Ananya Sharma');
    expect(getSingle.body.peAspirinDosage).toContain('Aspirin 150mg');

    // 3. List patient assessments
    const listRes = await call('GET', `/api/patients/${patientId}/risk-assessments`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.assessments).toHaveLength(1);
    expect(listRes.body.assessments[0].id).toBe(assessmentId);

    // 4. Update assessment with GDM lab findings
    const patchRes = await call('PATCH', `/api/risk-assessments/${assessmentId}`, doctor, {
      gdmDiagnosisStatus: 'gdm_confirmed',
      gdmFastingMgdl: 104,
      gdm2hrMgdl: 168,
      gdmManagementPlan: 'Initiate Medical Nutrition Therapy (MNT). Endocrine review.',
      consultantNotes: 'Counselled on blood glucose targets (<95 fasting, <120 2hr post-prandial).',
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.gdmDiagnosisStatus).toBe('gdm_confirmed');
    expect(patchRes.body.gdmFastingMgdl).toBe(104);
    expect(patchRes.body.consultantNotes).toContain('blood glucose targets');

    // 5. Query Patient Risk Summary for header/dashboard
    const summaryRes = await call('GET', `/api/patients/${patientId}/risk-summary`, doctor);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.hasAssessment).toBe(true);
    expect(summaryRes.body.isHighRisk).toBe(true);
    expect(summaryRes.body.activeAlerts).toEqual(
      expect.arrayContaining([
        expect.stringContaining('High Pre-eclampsia Risk'),
        expect.stringContaining('VTE Prophylaxis Required'),
        expect.stringContaining('Gestational Diabetes Mellitus'),
      ])
    );
    expect(summaryRes.body.prophylaxisPrescribed).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Aspirin 150mg prescribed'),
        expect.stringContaining('LMWH thromboprophylaxis prescribed'),
      ])
    );

    // 6. Delete assessment
    const delRes = await call('DELETE', `/api/risk-assessments/${assessmentId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ ok: true });

    // Verify deleted
    const getAfterDel = await call('GET', `/api/risk-assessments/${assessmentId}`, doctor);
    expect(getAfterDel.status).toBe(404);

    // Check audit trail
    const auditRows = db.prepare("SELECT action FROM audit_events WHERE action LIKE 'risk_assessment.%' ORDER BY id ASC").all() as any[];
    const actions = auditRows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['risk_assessment.create', 'risk_assessment.update', 'risk_assessment.delete']));
  });
});
