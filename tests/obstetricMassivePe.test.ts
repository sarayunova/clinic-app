import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluateObstetricMassivePe } from '../web/src/obstetricMassivePeEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown
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

describe('Obstetric Massive PE & Acute Right Heart Failure Engine (Pure Unit Tests)', () => {
  it('identifies High-Risk Massive PE with shock and RV failure requiring immediate Alteplase', () => {
    const res = evaluateObstetricMassivePe({
      gestationalAgeWeeks: 38.0,
      clinicalSetting: 'post_cesarean_section',
      systolicBpMmhg: 78,
      heartRateBpm: 125,
      respiratoryRate: 32,
      spo2Percent: 88.0,
      hemodynamicInstabilityShock: true,
      rvDysfunctionEchoConfirmed: true,
      cardiacBiomarkersElevated: true,
      peRiskStratification: 'high_risk_massive_pe',
      thrombolyticTherapyAdministered: true,
      thrombolyticAgentDose: 'alteplase_100mg_over_2hr',
      systemicUfhInfusionActive: true,
      targetApttSeconds: 70.0,
      catheterDirectedOrSurgicalEmbolectomy: false,
      inferiorVenaCavaFilterPlaced: false,
    });

    expect(res.isMassiveHighRiskPe).toBe(true);
    expect(res.thrombolysisIndicated).toBe(true);
    expect(res.initialUfhBolusUnits).toBe(5000);
    expect(res.initialUfhInfusionUnitsHr).toBe(1000);
    expect(res.alerts.some((a) => a.includes('CRITICAL MASSIVE PULMONARY EMBOLISM'))).toBe(true);
    expect(res.neuraxialContraindicationDirectives.some((d) => d.includes('STRICT NEURAXIAL CONTRAINDICATION'))).toBe(true);
    expect(res.urgencyTier).toBe('emergency_massive_pe_thrombolysis');
  });

  it('stratifies intermediate-high risk submassive PE with RV strain but normal blood pressure', () => {
    const res = evaluateObstetricMassivePe({
      gestationalAgeWeeks: 34.0,
      clinicalSetting: 'antenatal_antepartum',
      systolicBpMmhg: 115,
      heartRateBpm: 105,
      respiratoryRate: 22,
      spo2Percent: 95.0,
      hemodynamicInstabilityShock: false,
      rvDysfunctionEchoConfirmed: true,
      cardiacBiomarkersElevated: true,
      peRiskStratification: 'intermediate_high_risk_submassive',
      thrombolyticTherapyAdministered: false,
      thrombolyticAgentDose: 'none_contraindicated_or_surgical',
      systemicUfhInfusionActive: true,
      targetApttSeconds: 70.0,
      catheterDirectedOrSurgicalEmbolectomy: false,
      inferiorVenaCavaFilterPlaced: false,
    });

    expect(res.isMassiveHighRiskPe).toBe(false);
    expect(res.isSubmassiveIntermediateRisk).toBe(true);
    expect(res.thrombolysisIndicated).toBe(false);
    expect(res.alerts.some((a) => a.includes('SUBMASSIVE (INTERMEDIATE-RISK) PE'))).toBe(true);
    expect(res.urgencyTier).toBe('urgent_submassive_icu_ufh');
  });

  it('identifies low-risk PE requiring standard anticoagulation', () => {
    const res = evaluateObstetricMassivePe({
      gestationalAgeWeeks: 28.0,
      clinicalSetting: 'antenatal_antepartum',
      systolicBpMmhg: 120,
      heartRateBpm: 84,
      respiratoryRate: 16,
      spo2Percent: 99.0,
      hemodynamicInstabilityShock: false,
      rvDysfunctionEchoConfirmed: false,
      cardiacBiomarkersElevated: false,
      peRiskStratification: 'low_risk_nonmassive',
      thrombolyticTherapyAdministered: false,
      thrombolyticAgentDose: 'none_contraindicated_or_surgical',
      systemicUfhInfusionActive: true,
      targetApttSeconds: 70.0,
      catheterDirectedOrSurgicalEmbolectomy: false,
      inferiorVenaCavaFilterPlaced: false,
    });

    expect(res.isMassiveHighRiskPe).toBe(false);
    expect(res.isSubmassiveIntermediateRisk).toBe(false);
    expect(res.thrombolysisIndicated).toBe(false);
    expect(res.urgencyTier).toBe('inpatient_therapeutic_anticoagulation');
  });
});

describe('Obstetric Massive PE Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.maternalfetal',
      fullName: 'Dr. Radhika MFM Specialist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.icu',
      fullName: 'Nurse Pooja HDU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.icu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.icu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.icu',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.icu', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.icu', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Sunita Rao (Massive PE)',
      dateOfBirth: '1995-02-14',
      phone: '9876543211',
      address: 'ICU Bed 4',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to manage massive PE episodes and nurse to record serial aPTT and vitals', async () => {
    // 1. Evaluate Preview API
    const evalRes = await call('POST', '/api/obstetric-massive-pe/evaluate', doctor, {
      gestationalAgeWeeks: 39.0,
      clinicalSetting: 'post_cesarean_section',
      systolicBpMmhg: 78,
      heartRateBpm: 128,
      respiratoryRate: 34,
      spo2Percent: 87.0,
      hemodynamicInstabilityShock: true,
      rvDysfunctionEchoConfirmed: true,
      cardiacBiomarkersElevated: true,
      peRiskStratification: 'high_risk_massive_pe',
      thrombolyticTherapyAdministered: true,
      thrombolyticAgentDose: 'alteplase_100mg_over_2hr',
      systemicUfhInfusionActive: true,
      targetApttSeconds: 70.0,
      catheterDirectedOrSurgicalEmbolectomy: false,
      inferiorVenaCavaFilterPlaced: false,
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.isMassiveHighRiskPe).toBe(true);

    // 2. Create Episode
    const createRes = await call('POST', '/api/obstetric-massive-pe/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-08T07:15:00',
      gestationalAgeWeeks: 39.0,
      clinicalSetting: 'post_cesarean_section',
      systolicBpMmhg: 78,
      heartRateBpm: 128,
      respiratoryRate: 34,
      spo2Percent: 87.0,
      hemodynamicInstabilityShock: true,
      rvDysfunctionEchoConfirmed: true,
      cardiacBiomarkersElevated: true,
      peRiskStratification: 'high_risk_massive_pe',
      thrombolyticTherapyAdministered: true,
      thrombolyticAgentDose: 'alteplase_100mg_over_2hr',
      systemicUfhInfusionActive: true,
      targetApttSeconds: 70.0,
      catheterDirectedOrSurgicalEmbolectomy: false,
      inferiorVenaCavaFilterPlaced: false,
      status: 'thrombolytic_infusion_icu',
      clinicalNotes: 'Post-CS day 3 sudden collapse with shock. Systemic rtPA initiated.',
    });
    expect(createRes.status).toBe(201);
    const epId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toMatch(/^PE-/);

    // 3. Nurse logs flowsheet entry
    const flowRes = await call('POST', `/api/obstetric-massive-pe/episodes/${epId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T08:00:00',
      hoursFromPresentation: 0.75,
      systolicBpMmhg: 84,
      diastolicBpMmhg: 52,
      heartRateBpm: 120,
      spo2Percent: 92.0,
      apttSeconds: 55.0,
      heparinInfusionRateUnitsHr: 1000.0,
      vasopressorNorepinephrineMcgMin: 0.08,
      bleedingComplicationObserved: false,
      notes: 'Alteplase running. SBP improving.',
    });
    expect(flowRes.status).toBe(201);
    const flowLogId = flowRes.body.flowsheetLog.id;

    // 4. Fetch Episode Detail
    const getRes = await call('GET', `/api/obstetric-massive-pe/episodes/${epId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(epId);
    expect(getRes.body.flowsheet.length).toBe(1);

    // 5. Update Status
    const statusRes = await call('PATCH', `/api/obstetric-massive-pe/episodes/${epId}/status`, doctor, {
      status: 'therapeutic_heparin_titration',
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.episode.status).toBe('therapeutic_heparin_titration');

    // 6. Delete Flowsheet Entry
    const delFlowRes = await call('DELETE', `/api/obstetric-massive-pe/episodes/${epId}/flowsheet/${flowLogId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. Attender unauthorized
    const unauthRes = await call('POST', '/api/obstetric-massive-pe/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-08T07:15:00',
      gestationalAgeWeeks: 39.0,
      clinicalSetting: 'post_cesarean_section',
      systolicBpMmhg: 80,
      heartRateBpm: 120,
      respiratoryRate: 30,
      spo2Percent: 88.0,
      peRiskStratification: 'high_risk_massive_pe',
    });
    expect(unauthRes.status).toBe(403);
  });
});
