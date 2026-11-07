import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateMaternalBackgroundRisk,
  calculateExpectedMedianNt,
  calculateFirstTrimesterCombinedRisk,
  calculateQuadrupleRisk,
  evaluateNiptResult,
} from '../web/src/geneticEngine.js';

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

describe('Antenatal Genetic Screening & Aneuploidy Mathematical Engine', () => {
  it('computes maternal age-specific baseline background risk', () => {
    const age20 = calculateMaternalBackgroundRisk(20);
    const age35 = calculateMaternalBackgroundRisk(35);
    const age40 = calculateMaternalBackgroundRisk(40);

    // Risk increases significantly with maternal age
    expect(age20.t21Odds).toBeLessThan(age35.t21Odds);
    expect(age35.t21Odds).toBeLessThan(age40.t21Odds);

    expect(age20.t21Odds).toBeLessThan(0.001); // ~ 1:1500
    expect(age35.t21Odds).toBeGreaterThan(0.002); // ~ 1:350
    expect(age40.t21Odds).toBeGreaterThan(0.009); // ~ 1:100
  });

  it('calculates expected median nuchal translucency for CRL', () => {
    const nt45 = calculateExpectedMedianNt(45);
    const nt65 = calculateExpectedMedianNt(65);
    const nt84 = calculateExpectedMedianNt(84);

    expect(nt45).toBeGreaterThan(1.0);
    expect(nt45).toBeLessThan(nt65);
    expect(nt65).toBeLessThan(nt84);
    expect(nt84).toBeLessThan(2.2);
  });

  it('evaluates reassuring Low Risk First Trimester Combined Screening', () => {
    const result = calculateFirstTrimesterCombinedRisk({
      maternalAge: 26,
      gestationalAgeWeeks: 12,
      crlMm: 62,
      ntMeasuredMm: 1.4,
      nasalBone: 'present',
      tricuspidRegurgitation: 'normal',
      ductusVenosus: 'positive',
      freeBetaHcgMom: 1.05,
      pappAMom: 1.15,
    });

    expect(result.overallRiskTier).toBe('low_risk');
    expect(result.adjustedT21Numeric).toBeLessThan(0.001); // < 1:1000
    expect(result.clinicalRecommendation).toContain('LOW RISK');
    expect(result.clinicalRecommendation).toContain('Level-II');
  });

  it('evaluates High Risk First Trimester Combined Screening for Trisomy 21', () => {
    const result = calculateFirstTrimesterCombinedRisk({
      maternalAge: 38,
      gestationalAgeWeeks: 12,
      crlMm: 58,
      ntMeasuredMm: 3.8, // Thickened NT >= 3.5 mm
      nasalBone: 'absent', // Absent nasal bone
      tricuspidRegurgitation: 'regurgitant',
      freeBetaHcgMom: 2.6, // High beta-hCG
      pappAMom: 0.35, // Low PAPP-A
    });

    expect(result.overallRiskTier).toBe('high_risk');
    expect(result.adjustedT21Numeric).toBeGreaterThan(0.01); // e.g. 1:10 or 1:20
    expect(result.clinicalRecommendation).toContain('HIGH RISK');
    expect(result.clinicalRecommendation).toContain('CVS');
    expect(result.clinicalRecommendation).toContain('Amniocentesis');
  });

  it('evaluates Second Trimester Quadruple Test and Open Neural Tube Defect (ONTD) Risk', () => {
    // Normal quad test
    const normalQuad = calculateQuadrupleRisk({
      maternalAge: 27,
      gestationalAgeWeeks: 16,
      afpMom: 1.1,
      totalHcgMom: 1.0,
      ue3Mom: 1.0,
      inhibinAMom: 1.0,
    });
    expect(normalQuad.overallRiskTier).toBe('low_risk');
    expect(normalQuad.ontdRiskStatus).toBe('low_risk');

    // High AFP >= 2.5 MoM -> ONTD Risk
    const highAfp = calculateQuadrupleRisk({
      maternalAge: 27,
      gestationalAgeWeeks: 16,
      afpMom: 3.2, // Elevated AFP
      totalHcgMom: 1.0,
      ue3Mom: 1.0,
      inhibinAMom: 1.0,
    });
    expect(highAfp.overallRiskTier).toBe('high_risk');
    expect(highAfp.ontdRiskStatus).toBe('high_risk');
    expect(highAfp.clinicalRecommendation).toContain('OPEN NEURAL TUBE DEFECT');
    expect(highAfp.clinicalRecommendation).toContain('spina bifida');
  });

  it('evaluates NIPT / cfDNA fetal fraction quality and high risk confirmation requirement', () => {
    // Low fetal fraction < 4%
    const lowFf = evaluateNiptResult({
      fetalFractionPercent: 2.8,
      t21Result: 'low_risk',
    });
    expect(lowFf.isAdequate).toBe(false);
    expect(lowFf.overallTier).toBe('inconclusive');
    expect(lowFf.qualityWarning).toContain('Low Fetal Fraction');

    // High risk T21 result
    const highRiskNipt = evaluateNiptResult({
      fetalFractionPercent: 9.2,
      t21Result: 'high_risk',
    });
    expect(highRiskNipt.isAdequate).toBe(true);
    expect(highRiskNipt.overallTier).toBe('high_risk');
    expect(highRiskNipt.recommendation).toContain('NOT diagnostic');
    expect(highRiskNipt.recommendation).toContain('Amniocentesis');
  });
});

describe('Antenatal Genetic Screening & Aneuploidy REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Setup doctor
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.sarayu',
      fullName: 'Dr. Sarayu Rao',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse and Desk users
    await call('POST', '/api/users', doctor, {
      username: 'nurse1',
      fullName: 'Sister Mary',
      role: 'nurse',
      password: 'temp-pass-nurse-1',
    });
    const nurseFirst = await login('nurse1', 'temp-pass-nurse-1');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-1',
      newPassword: PW,
    });
    nurse = await login('nurse1');

    await call('POST', '/api/users', doctor, {
      username: 'desk1',
      fullName: 'Attender Rajesh',
      role: 'attender',
      password: 'temp-pass-desk-1',
    });
    const deskFirst = await login('desk1', 'temp-pass-desk-1');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-1',
      newPassword: PW,
    });
    desk = await login('desk1');

    // Register a patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Kavita Deshmukh',
      dateOfBirth: '1992-08-20',
      phone: '9822998877',
      address: 'Pune, Maharashtra',
      emergencyContactName: 'Rahul Deshmukh',
      lastMenstrualPeriod: '2026-08-10',
      gravida: 1,
      para: 0,
      abortions: 0,
      living: 0,
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  }, 20000);

  it('runs real-time calculation preview via POST /api/genetic-screening/calculate', async () => {
    const calcRes = await call('POST', '/api/genetic-screening/calculate', doctor, {
      screeningType: 'first_trimester_combined',
      maternalAge: 32,
      gestationalAgeWeeks: 12,
      crlMm: 60,
      ntMeasuredMm: 1.6,
      nasalBone: 'present',
      freeBetaHcgMom: 1.2,
      pappAMom: 0.9,
    });
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.overallRiskTier).toBe('low_risk');
    expect(calcRes.body.adjustedT21Ratio).toMatch(/^1:(>\d+|\d+)$/);
  });

  it('creates, retrieves, updates and deletes a genetic screening episode', async () => {
    // 1. Create First Trimester Combined Screening
    const createRes = await call('POST', `/api/patients/${patientId}/genetic-screening`, doctor, {
      patientId,
      screeningDate: '2026-11-04',
      screeningType: 'first_trimester_combined',
      gestationalAgeWeeks: 12,
      gestationalAgeDays: 4,
      maternalAgeAtDelivery: 34,
      maternalWeightKg: 62.5,
      pregnancyType: 'singleton',
      crlMm: 63.5,
      ntMeasuredMm: 3.6, // Thickened NT
      nasalBone: 'absent',
      tricuspidRegurgitation: 'regurgitant',
      freeBetaHcgMom: 2.4,
      pappAMom: 0.38,
      counselingNotes: 'Detailed pre-test genetic counseling done with couple.',
      patientDecision: 'opt_for_invasive_diagnostic',
    });
    expect(createRes.status).toBe(201);
    const episode = createRes.body;
    expect(episode.overallRiskTier).toBe('high_risk');
    expect(episode.patientDecision).toBe('opt_for_invasive_diagnostic');
    const episodeId = episode.id;

    // 2. Retrieve episode
    const getRes = await call('GET', `/api/patients/${patientId}/genetic-screening/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(episodeId);
    expect(getRes.body.crlMm).toBe(63.5);

    // 3. List episodes for patient
    const listRes = await call('GET', `/api/patients/${patientId}/genetic-screening`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);

    // 4. Update episode with diagnostic CVS procedure and Karyotype result
    const updateRes = await call('PUT', `/api/patients/${patientId}/genetic-screening/${episodeId}`, doctor, {
      patientId,
      screeningDate: '2026-11-04',
      screeningType: 'first_trimester_combined',
      gestationalAgeWeeks: 12,
      gestationalAgeDays: 4,
      maternalAgeAtDelivery: 34,
      crlMm: 63.5,
      ntMeasuredMm: 3.6,
      nasalBone: 'absent',
      freeBetaHcgMom: 2.4,
      pappAMom: 0.38,
      counselingNotes: 'CVS performed transabdominally under continuous ultrasound guidance.',
      patientDecision: 'opt_for_invasive_diagnostic',
      invasiveProcedureType: 'cvs',
      invasiveProcedureDate: '2026-11-05',
      invasivePerformedBy: 'Dr. Sarayu Rao',
      invasiveSampleDetails: '25mg chorionic villi, clear sample, 20G Chiba needle single pass',
      rapidQfpcrResult: 'Positive for Trisomy 21 (3 copies of chromosome 21 markers)',
      karyotypeResult: '47,XX,+21 (Female with Trisomy 21 Down Syndrome)',
      microarrayCmaResult: 'arr(21)x3 (Whole chromosome 21 duplication)',
      finalGeneticDiagnosis: 'Confirmed Fetal Trisomy 21 (Down Syndrome)',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.karyotypeResult).toContain('47,XX,+21');

    // 5. Audit print
    const printRes = await call('POST', `/api/patients/${patientId}/genetic-screening/${episodeId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    // 6. Delete episode (doctor only)
    const delRes = await call('DELETE', `/api/patients/${patientId}/genetic-screening/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);

    // 7. Verify deletion
    const verifyRes = await call('GET', `/api/patients/${patientId}/genetic-screening/${episodeId}`, doctor);
    expect(verifyRes.status).toBe(404);
  });

  it('enforces RBAC: desk attender is blocked from reading or writing genetic records', async () => {
    // Desk attender tries to write genetic record -> 403 Forbidden
    const createRes = await call('POST', `/api/patients/${patientId}/genetic-screening`, desk, {
      patientId,
      screeningDate: '2026-11-04',
      screeningType: 'first_trimester_combined',
      gestationalAgeWeeks: 12,
      maternalAgeAtDelivery: 28,
      crlMm: 60,
      ntMeasuredMm: 1.4,
    });
    expect(createRes.status).toBe(403);

    // Desk attender tries to read genetic records -> 403 Forbidden
    const getRes = await call('GET', `/api/patients/${patientId}/genetic-screening`, desk);
    expect(getRes.status).toBe(403);

    // Unauthenticated GET -> 401
    const unauthRes = await call('GET', `/api/patients/${patientId}/genetic-screening`);
    expect(unauthRes.status).toBe(401);
  });
});
