import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  calculateNigrovicBmsScore,
  evaluatePediatricBacterialMeningitis,
} from '../web/src/pediatricBacterialMeningitisEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
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

describe('Pediatric Bacterial Meningitis Engine (Pure Unit Tests)', () => {
  it('correctly calculates Nigrovic BMS score and stratifies high risk', () => {
    const bms = calculateNigrovicBmsScore({
      csfGramStainPositive: true, // +2
      csfProteinMgDl: 140, // +1
      peripheralAnc: 12500, // +1
      seizureAtPresentation: true, // +1
      csfAncCalculated: 1600, // +1
    });

    expect(bms.totalBmsScore).toBe(6);

    const evalResult = evaluatePediatricBacterialMeningitis({
      ageMonths: 18,
      weightKg: 11.0,
      priorAntibioticExposure72h: false,
      seizureAtPresentation: true,
      gcsScore: 14,
      kernigBrudzinskiSign: true,
      fontanelleBulging: false,
      purpuricRash: false,
      csfWbcCount: 2000,
      csfNeutrophilPercent: 80,
      csfProteinMgDl: 140,
      csfGlucoseMgDl: 22,
      bloodGlucoseMgDl: 110,
      csfGramStainPositive: true,
      csfGramStainOrganism: 'gram_positive_cocci_pairs',
      peripheralWbc: 19.2,
      peripheralAnc: 12500,
    });

    expect(evalResult.bmsBreakdown.totalBmsScore).toBe(6);
    expect(evalResult.riskTier).toBe('high_risk');
    expect(evalResult.csfToBloodGlucoseRatio).toBe(0.2); // Marked hypoglycorrhachia
    expect(evalResult.antibioticRecommendations.ceftriaxoneDoseMg).toBe(550); // 11kg * 100mg/kg/d / 2
    expect(evalResult.antibioticRecommendations.vancomycinDoseMg).toBe(165); // 11kg * 60mg/kg/d / 4
    expect(evalResult.alerts.some(a => a.includes('hypoglycorrhachia'))).toBe(true);
  });

  it('identifies prior antibiotic pretreatment as a critical confounder even if BMS = 0', () => {
    const evalResult = evaluatePediatricBacterialMeningitis({
      ageMonths: 36,
      weightKg: 15.0,
      priorAntibioticExposure72h: true, // Confounder!
      seizureAtPresentation: false,
      gcsScore: 15,
      kernigBrudzinskiSign: false,
      fontanelleBulging: false,
      purpuricRash: false,
      csfWbcCount: 40,
      csfNeutrophilPercent: 20, // CSF ANC = 8 (not >= 1000)
      csfProteinMgDl: 45, // not >= 80
      csfGlucoseMgDl: 60,
      bloodGlucoseMgDl: 100,
      csfGramStainPositive: false,
      csfGramStainOrganism: 'none_seen',
      peripheralWbc: 8.5,
      peripheralAnc: 5200, // not >= 10,000
    });

    expect(evalResult.bmsBreakdown.totalBmsScore).toBe(0);
    // Even though score is 0, prior antibiotic exposure shifts to high clinical suspicion
    expect(evalResult.riskTier).toBe('high_risk');
    expect(evalResult.isPriorAntibioticsConfounder).toBe(true);
    expect(evalResult.alerts.some(a => a.includes('prior 72 hours'))).toBe(true);
  });
});

describe('Pediatric Bacterial Meningitis REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.meningitis',
      fullName: 'Dr. Priya Pediatrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.meningitis',
      fullName: 'Nurse Peter PICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.meningitis', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.meningitis', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.meningitis',
      fullName: 'Attender Alex',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.meningitis', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.meningitis', PW);

    // Create a pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Aarav Patel',
      dateOfBirth: '2024-02-14',
      phone: '+91 98223 34455',
      address: 'Pediatric Emergency Bed 1',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('previews meningitis evaluation without database persistence', async () => {
    const res = await call('POST', '/api/pediatric-bacterial-meningitis/evaluate', doctor, {
      ageMonths: 24,
      weightKg: 12.0,
      priorAntibioticExposure72h: false,
      seizureAtPresentation: false,
      gcsScore: 15,
      csfWbcCount: 450,
      csfNeutrophilPercent: 85,
      csfProteinMgDl: 110,
      csfGlucoseMgDl: 25,
      bloodGlucoseMgDl: 95,
      csfGramStainPositive: false,
      peripheralWbc: 16.5,
      peripheralAnc: 11200,
    });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.riskTier).toBe('high_risk');
    expect(res.body.evaluation.bmsBreakdown.totalBmsScore).toBeGreaterThanOrEqual(2);
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    // 1. Non-clinical attender blocked
    const forbiddenRes = await call('POST', '/api/pediatric-bacterial-meningitis/episodes', attender, {
      patientId,
      triageDatetime: new Date().toISOString(),
      ageMonths: 20,
      weightKg: 11.5,
      gcsScore: 14,
      csfWbcCount: 600,
      csfNeutrophilPercent: 80,
      csfProteinMgDl: 95,
      csfGlucoseMgDl: 30,
      bloodGlucoseMgDl: 100,
      peripheralWbc: 15.0,
      peripheralAnc: 10500,
    });
    expect(forbiddenRes.status).toBe(403);

    // 2. Doctor creates episode
    const createRes = await call('POST', '/api/pediatric-bacterial-meningitis/episodes', doctor, {
      patientId,
      triageDatetime: new Date().toISOString(),
      ageMonths: 20,
      weightKg: 11.5,
      priorAntibioticExposure72h: false,
      seizureAtPresentation: true,
      gcsScore: 14,
      kernigBrudzinskiSign: true,
      fontanelleBulging: false,
      purpuricRash: false,
      csfWbcCount: 850,
      csfNeutrophilPercent: 82,
      csfProteinMgDl: 125,
      csfGlucoseMgDl: 28,
      bloodGlucoseMgDl: 104,
      csfGramStainPositive: true,
      csfGramStainOrganism: 'gram_positive_cocci_pairs',
      peripheralWbc: 18.2,
      peripheralAnc: 12600,
      empiricCeftriaxoneOrdered: true,
      empiricVancomycinOrdered: true,
      dexamethasoneGivenPreAntibiotic: true,
      isolationPrecautions: 'droplet_precautions',
      status: 'active_triage',
      clinicalNotes: '20-month-old presenting with febrile seizure, nuchal rigidity, CSF pleocytosis with Gram+ diplococci. Initiated emergency antibiotics and dexamethasone.',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.episodeCode).toContain('MEN-');
    expect(createRes.body.evaluation.riskTier).toBe('high_risk');
    const episodeId = createRes.body.episodeId;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/pediatric-bacterial-meningitis/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with evaluation and flowsheet
    const getRes = await call('GET', `/api/pediatric-bacterial-meningitis/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.episode.bms_score).toBeGreaterThanOrEqual(3);

    // 5. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/pediatric-bacterial-meningitis/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      gcsScore: 14,
      pupilReactivity: 'brisk_bilateral',
      heartRate: 118,
      bloodPressureSys: 98,
      bloodPressureDia: 60,
      temperatureCelsius: 38.8,
      respiratoryRate: 26,
      seizureActivityObserved: false,
      neurologicalNotes: 'Irritable, responds to voice, no cranial nerve palsy.',
      antibioticDoseAdministered: 'Ceftriaxone 575mg IV administered',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Doctor updates episode status
    const updateRes = await call('PATCH', `/api/pediatric-bacterial-meningitis/episodes/${episodeId}/status`, doctor, {
      status: 'picu_critical_care',
      clinicalNotes: 'Admitted to PICU for continuous neuro-cardiopulmonary monitoring.',
    });
    expect(updateRes.status).toBe(200);

    // 7. Nurse deletes flowsheet log
    const delLogRes = await call('DELETE', `/api/pediatric-bacterial-meningitis/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(delLogRes.status).toBe(200);

    // 8. Verify audit logs
    const auditRes = await call('GET', `/api/audit?entityId=${episodeId}`, doctor);
    expect(auditRes.status).toBe(200);
  });
});
