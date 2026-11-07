import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  evaluateSwanseaCriteria,
  type SwanseaCriteriaInput,
} from '../web/src/obstetricAflpEngine.js';

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
describe('Obstetric AFLP & Swansea Criteria Engine (Pure Unit Tests)', () => {
  it('correctly evaluates negative / non-qualifying AFLP when fewer than 6 criteria are met', () => {
    const input: SwanseaCriteriaInput = {
      vomiting: true,
      abdominalPain: true,
      polydipsiaPolyuria: false,
      encephalopathy: false,
      elevatedBilirubin: false,
      hypoglycemia: false,
      elevatedUrate: false,
      leukocytosis: false,
      ascitesOrBrightLiver: false,
      elevatedTransaminases: true,
      elevatedAmmonia: false,
      renalImpairment: false,
      coagulopathy: false,
      microvesicularSteatosisBiopsy: false,
      serumBilirubinMgDl: 0.6,
      serumGlucoseMgDl: 85,
      astUL: 55,
      creatinineMgDl: 1.1,
      inr: 1.0,
      ptSeconds: 12.5,
    };

    const result = evaluateSwanseaCriteria(input);
    expect(result.totalCriteriaMet).toBe(3); // vomiting, abdominalPain, elevatedTransaminases
    expect(result.aflpConfirmed).toBe(false);
    expect(result.clinicalSeverity).toBe('unlikely');
    expect(result.deliveryRecommendation).toContain('Continue close fetomaternal monitoring');
  });

  it('correctly confirms AFLP and assigns severe tier when >= 6 criteria including coagulopathy/hypoglycemia are met', () => {
    const input: SwanseaCriteriaInput = {
      vomiting: true,
      abdominalPain: true,
      polydipsiaPolyuria: true,
      encephalopathy: true,
      elevatedBilirubin: true,
      hypoglycemia: true,
      elevatedUrate: true,
      leukocytosis: true,
      ascitesOrBrightLiver: true,
      elevatedTransaminases: true,
      elevatedAmmonia: true,
      renalImpairment: true,
      coagulopathy: true,
      microvesicularSteatosisBiopsy: false,
      serumBilirubinMgDl: 2.8,
      serumGlucoseMgDl: 48,
      astUL: 380,
      creatinineMgDl: 1.9,
      inr: 2.1,
      ptSeconds: 22.0,
    };

    const result = evaluateSwanseaCriteria(input);
    expect(result.totalCriteriaMet).toBe(13);
    expect(result.aflpConfirmed).toBe(true);
    expect(result.clinicalSeverity).toBe('fulminant_aflp');
    expect(result.deliveryRecommendation).toContain('EMERGENT DELIVERY INDICATED');
    expect(result.hypoglycemiaProtocol).toContain('continuous 10% Dextrose');
    expect(result.lchadScreeningAlert).toContain('LCHAD');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Obstetric AFLP REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.obstetrician',
      fullName: 'Dr. M. Patel (Consultant Obstetrician)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.icu',
      fullName: 'Staff Nurse Sunita (Maternal HDU)',
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

    // Obstetric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Anita Devi (G2P1 at 36w with Jaundice & Vomiting)',
      dateOfBirth: '1998-05-12',
      phone: '+91 98765 11111',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create an AFLP episode and perform Swansea calculations', async () => {
    const payload = {
      patientId,
      diagnosisDatetime: '2026-11-07T11:00:00',
      gestationWeeks: 36.2,
      vomitingPresent: true,
      abdominalPainPresent: true,
      polydipsiaPolyuriaPresent: false,
      encephalopathyPresent: false,
      elevatedBilirubin: true,
      hypoglycemiaPresent: true,
      elevatedUrate: true,
      leukocytosisPresent: true,
      ascitesOrBrightLiver: true,
      elevatedTransaminases: true,
      elevatedAmmonia: true,
      renalImpairment: false,
      coagulopathyPresent: true,
      microvesicularSteatosisBiopsy: false,
      serumGlucoseMgDl: 54,
      serumBilirubinTotalMgDl: 2.1,
      astUL: 210,
      altUL: 195,
      serumCreatinineMgDl: 1.4,
      ptSeconds: 16.2,
      inr: 1.45,
      dextroseInfusionActive: true,
      deliveryUrgency: 'immediate_emergent_delivery',
      status: 'active_critical_resuscitation',
      clinicalNotes: 'Marked hypoglycemia 54 mg/dL with INR 1.45 and hyperammonemia. Initiated D10W bolus + infusion.',
    };

    const res = await call('POST', '/api/obstetric-aflp/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode).toBeDefined();
    expect(res.body.episode.episode_code).toMatch(/^AFLP-/);
    expect(res.body.episode.aflp_confirmed).toBe(1);
    expect(res.body.episode.total_swansea_criteria_met).toBeGreaterThanOrEqual(6);
    expect(res.body.evalResult).toBeDefined();

    const episodeId = res.body.episode.id;

    // List episodes
    const listRes = await call('GET', `/api/obstetric-aflp/episodes?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // Get detail
    const detailRes = await call('GET', `/api/obstetric-aflp/episodes/${episodeId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.episode.id).toBe(episodeId);

    // Nurse logs flowsheet checkpoint
    const flowRes = await call('POST', `/api/obstetric-aflp/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-07T13:00:00',
      hoursFromDiagnosis: 2,
      bloodGlucoseMgDl: 78,
      dextroseInfusionRateMlHr: 100,
      dextroseConcentrationPercent: 10,
      sbpMmhg: 124,
      dbpMmhg: 78,
      hrBpm: 88,
      urineOutputMlHr: 45,
      encephalopathyGrade: 0,
      notes: 'Blood sugar stabilized to 78 mg/dL on D10W 100 mL/hr.',
    });
    expect(flowRes.status).toBe(201);
    expect(flowRes.body.logId).toBeDefined();

    // Check detail includes logs
    const detailAfterFlow = await call('GET', `/api/obstetric-aflp/episodes/${episodeId}`, nurse);
    expect(detailAfterFlow.body.logs.length).toBe(1);
    expect(detailAfterFlow.body.logs[0].blood_glucose_mg_dl).toBe(78);

    // Update episode
    const updateRes = await call('PATCH', `/api/obstetric-aflp/episodes/${episodeId}`, doctor, {
      status: 'postpartum_icu_monitoring',
      deliveryUrgency: 'delivered_postpartum_management',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('postpartum_icu_monitoring');

    // Attender forbidden
    const attenderCreate = await call('POST', '/api/obstetric-aflp/episodes', attender, payload);
    expect(attenderCreate.status).toBe(403);

    // Doctor can delete log and episode
    const deleteLog = await call('DELETE', `/api/obstetric-aflp/episodes/${episodeId}/flowsheet-logs/${flowRes.body.logId}`, doctor);
    expect(deleteLog.status).toBe(200);

    const deleteEp = await call('DELETE', `/api/obstetric-aflp/episodes/${episodeId}`, doctor);
    expect(deleteEp.status).toBe(200);
  });
});
