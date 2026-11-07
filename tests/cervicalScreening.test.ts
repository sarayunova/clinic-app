import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateSwedeScore,
  calculateReidIndex,
  determineBethesdaRisk,
  generateManagementGuideline,
} from '../web/src/cervicalEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string;
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
    body: (res.body ? JSON.parse(res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
  const setup = await call('POST', '/api/setup', undefined, {
    username: 'dr.sharma',
    fullName: 'Dr Sharma',
    password: PW,
  });
  doctor = setup.setCookie!.split(';')[0]!;
  await call('POST', '/api/users', doctor, {
    username: 'desk1',
    fullName: 'Desk Staff',
    role: 'attender',
    password: 'temporary-pass-1',
  });
  const first = await login('desk1', 'temporary-pass-1');
  await call('POST', '/api/auth/change-password', first, {
    currentPassword: 'temporary-pass-1',
    newPassword: PW,
  });
  desk = await login('desk1');

  patientId = (
    await call('POST', '/api/patients', doctor, {
      fullName: 'Pooja Verma',
      dateOfBirth: '1992-06-15',
      phone: '9811223344',
      gravida: 2,
      para: 1,
      living: 1,
      abortions: 0,
    })
  ).body.patient.id;
});

describe('Cervical Screening & Colposcopy Decision Engine', () => {
  it('calculates Swede score and categorizes interpretation accurately', () => {
    // Normal / benign
    const normal = calculateSwedeScore({
      acetowhitening: 0,
      margins: 0,
      vessels: 0,
      lesionSize: 0,
      iodineStaining: 0,
    });
    expect(normal.total).toBe(0);
    expect(normal.interpretation).toBe('normal_benign');

    // Low grade (Score 3-4)
    const lowGrade = calculateSwedeScore({
      acetowhitening: 1,
      margins: 1,
      vessels: 1,
      lesionSize: 0,
      iodineStaining: 0,
    });
    expect(lowGrade.total).toBe(3);
    expect(lowGrade.interpretation).toBe('low_grade_cin1');

    // Suspicious CIN 2/3 (Score 5-7)
    const suspicious = calculateSwedeScore({
      acetowhitening: 2,
      margins: 1,
      vessels: 1,
      lesionSize: 1,
      iodineStaining: 1,
    });
    expect(suspicious.total).toBe(6);
    expect(suspicious.interpretation).toBe('suspicious_cin2_3');

    // High probability CIN 2/3 or invasive carcinoma (Score 8-10)
    const highProb = calculateSwedeScore({
      acetowhitening: 2,
      margins: 2,
      vessels: 2,
      lesionSize: 1,
      iodineStaining: 2,
    });
    expect(highProb.total).toBe(9);
    expect(highProb.interpretation).toBe('high_probability_cin2_3_cancer');
  });

  it('calculates Reid Colposcopic Index correctly', () => {
    const reidLow = calculateReidIndex({ margin: 0, color: 0, vessels: 1, iodine: 0 });
    expect(reidLow.total).toBe(1);
    expect(reidLow.title).toContain('Likely CIN 1');

    const reidHigh = calculateReidIndex({ margin: 2, color: 2, vessels: 2, iodine: 2 });
    expect(reidHigh.total).toBe(8);
    expect(reidHigh.title).toContain('High-Grade Lesion');
  });

  it('evaluates Bethesda cytology risks properly', () => {
    expect(determineBethesdaRisk('nilm').grade).toBe('normal');
    expect(determineBethesdaRisk('lsil').grade).toBe('low_grade');
    expect(determineBethesdaRisk('hsil').grade).toBe('high_grade');
    expect(determineBethesdaRisk('scc').grade).toBe('malignant');
    expect(determineBethesdaRisk('ais').grade).toBe('high_grade');
  });

  it('generates ASCCP/WHO guideline management recommendations', () => {
    // Normal cotest
    const routine = generateManagementGuideline({
      papResult: 'nilm',
      hpvOverall: 'negative',
    });
    expect(routine.recallMonths).toBe(60);
    expect(routine.urgency).toBe('routine');

    // High-risk HPV 16 positive
    const hpv16Alert = generateManagementGuideline({
      papResult: 'nilm',
      hpv16: true,
    });
    expect(hpv16Alert.urgency).toBe('priority');
    expect(hpv16Alert.recommendation).toContain('Colposcopy Recommended');

    // HSIL with Swede score >= 8
    const hsilSeeAndTreat = generateManagementGuideline({
      papResult: 'hsil',
      swedeScore: 9,
      isPregnant: false,
    });
    expect(hsilSeeAndTreat.recommendation).toContain('See-and-Treat');

    // Biopsy CIN 3 confirmed
    const cin3Biopsy = generateManagementGuideline({
      biopsyResult: 'cin_3_severe_cis',
      isPregnant: false,
    });
    expect(cin3Biopsy.recommendation).toContain('Excisional Procedure');

    // Pregnancy safety precautions
    const pregnantHsil = generateManagementGuideline({
      papResult: 'hsil',
      isPregnant: true,
    });
    expect(pregnantHsil.precautions.some((p) => p.includes('strictly CONTRAINDICATED'))).toBe(true);
  });
});

describe('Cervical Screening & Colposcopy REST API Endpoints', () => {
  it('creates a new screening record with automated Swede score calculation', async () => {
    const res = await call('POST', `/api/patients/${patientId}/cervical-screenings`, doctor, {
      screeningDate: '2026-11-05',
      screeningType: 'co_test',
      indication: 'abnormal_prior_screening',
      papPerformed: true,
      papSampleType: 'liquid_based',
      papAdequacy: 'satisfactory_with_ec_tz',
      papResult: 'hsil',
      hpvPerformed: true,
      hpvOverallResult: 'positive',
      hpv16Positive: true,
      colposcopyPerformed: true,
      colposcopyDate: '2026-11-05',
      examinerName: 'Dr Sharma',
      transformationZoneType: 'type_1',
      squamocolumnarJunctionVisible: 'completely_visible',
      swedeAcetowhitening: 2,
      swedeMargins: 2,
      swedeVessels: 1,
      swedeLesionSize: 1,
      swedeIodineStaining: 2,
      biopsyTaken: true,
      biopsyType: 'punch_biopsy',
      biopsies: [
        {
          siteLocation: "12 o'clock anterior lip",
          clockPosition: 12,
          specimenLabel: 'BX-12',
          histopathologyResult: 'pending',
          pathologistNotes: 'Acetowhite area biopsied',
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.swedeScoreTotal).toBe(8);
    expect(res.body.swedeInterpretation).toBe('high_probability_cin2_3_cancer');
    expect(res.body.managementRecommendation).toBeDefined();

    const screeningId = res.body.id;

    // Fetch detail
    const detail = await call('GET', `/api/patients/${patientId}/cervical-screenings/${screeningId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.record.swede_score_total).toBe(8);
    expect(detail.body.record.biopsies).toHaveLength(1);
    expect(detail.body.record.biopsies[0].site_location).toContain("12 o'clock");
  });

  it('updates a biopsy result with histopathology confirmation', async () => {
    // 1. Create record
    const createRes = await call('POST', `/api/patients/${patientId}/cervical-screenings`, doctor, {
      screeningDate: '2026-11-01',
      screeningType: 'pap_cytology',
      indication: 'routine_screening',
      papPerformed: true,
      papResult: 'lsil',
      colposcopyPerformed: true,
      swedeAcetowhitening: 1,
      swedeMargins: 1,
      swedeVessels: 0,
      swedeLesionSize: 1,
      swedeIodineStaining: 1,
    });
    expect(createRes.status).toBe(201);
    const sid = createRes.body.id;

    // 2. Add biopsy specimen
    const bxRes = await call('POST', `/api/patients/${patientId}/cervical-screenings/${sid}/biopsies`, doctor, {
      siteLocation: "6 o'clock posterior lip",
      clockPosition: 6,
      specimenLabel: 'BX-6',
      histopathologyResult: 'pending',
    });
    expect(bxRes.status).toBe(201);
    const bid = bxRes.body.id;

    // 3. Update biopsy result
    const updateBx = await call(
      'PUT',
      `/api/patients/${patientId}/cervical-screenings/${sid}/biopsies/${bid}`,
      doctor,
      {
        siteLocation: "6 o'clock posterior lip",
        clockPosition: 6,
        specimenLabel: 'BX-6',
        histopathologyResult: 'cin_2',
        pathologistNotes: 'Moderate dysplasia confirmed with p16 positivity',
      },
    );
    expect(updateBx.status).toBe(200);
    expect(updateBx.body.histopathologyResult).toBe('cin_2');

    // 4. Print audit log
    const printRes = await call('POST', `/api/patients/${patientId}/cervical-screenings/${sid}/print`, doctor);
    expect(printRes.status).toBe(200);
    expect(printRes.body.ok).toBe(true);
  });

  it('enforces RBAC: desk attender is blocked from creating or editing clinical records', async () => {
    const postRes = await call('POST', `/api/patients/${patientId}/cervical-screenings`, desk, {
      screeningDate: '2026-11-05',
      screeningType: 'pap_cytology',
      indication: 'routine_screening',
    });
    expect(postRes.status).toBe(403);

    const getRes = await call('GET', `/api/patients/${patientId}/cervical-screenings`, desk);
    expect(getRes.status).toBe(403);
  });
});
