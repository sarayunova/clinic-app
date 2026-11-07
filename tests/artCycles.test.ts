import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  parseGardnerGrade,
  calculateHcgDoublingKinetics,
  type HcgKineticsInput,
} from '../web/src/artEngine.js';

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

describe('ART Embryology & Beta-hCG Kinetics Engine', () => {
  it('correctly classifies Gardner blastocyst expansion and morphological tiers', () => {
    // 4AA - Top Quality
    const top = parseGardnerGrade('4AA');
    expect(top.tier).toBe('top_quality');
    expect(top.grade?.expansion).toBe(4);
    expect(top.grade?.innerCellMass).toBe('A');
    expect(top.grade?.trophectoderm).toBe('A');
    expect(top.summary).toContain('High implantation potential');

    // 4BA - Good Quality
    const good = parseGardnerGrade('4BA');
    expect(good.tier).toBe('good_quality');
    expect(good.summary).toContain('suitable for elective Single Embryo Transfer');

    // 3BB - Fair Quality
    const fair = parseGardnerGrade('3BB');
    expect(fair.tier).toBe('fair_quality');

    // Unclassified / malformed
    const invalid = parseGardnerGrade('XYZ');
    expect(invalid.grade).toBeNull();
    expect(invalid.tier).toBe('poor_quality');
  });

  it('calculates serial beta-hCG doubling time and identifies normal viable rise', () => {
    const input: HcgKineticsInput = {
      hcg1Value: 400,
      hcg1Datetime: '2026-03-01T08:00:00Z',
      hcg2Value: 920,
      hcg2Datetime: '2026-03-03T08:00:00Z', // 48 hours
    };

    const result = calculateHcgDoublingKinetics(input);
    expect(result.hoursDifference).toBe(48);
    expect(result.doublingTimeHours).toBeLessThanOrEqual(48);
    expect(result.interpretation).toBe('normal_viable_trajectory');
    expect(result.twoDayPercentIncrease).toBeGreaterThanOrEqual(53);
  });

  it('identifies slow suboptimal rise and warns of ectopic / non-viable pregnancy', () => {
    const input: HcgKineticsInput = {
      hcg1Value: 400,
      hcg1Datetime: '2026-03-01T08:00:00Z',
      hcg2Value: 480, // only +20% rise over 48h
      hcg2Datetime: '2026-03-03T08:00:00Z',
    };

    const result = calculateHcgDoublingKinetics(input);
    expect(result.interpretation).toBe('slow_suboptimal_rise');
    expect(result.clinicalSummary).toContain('Suboptimal beta-hCG rise');
  });

  it('detects falling beta-hCG for biochemical / failing gestation', () => {
    const input: HcgKineticsInput = {
      hcg1Value: 500,
      hcg1Datetime: '2026-03-01T08:00:00Z',
      hcg2Value: 320,
      hcg2Datetime: '2026-03-03T08:00:00Z',
    };

    const result = calculateHcgDoublingKinetics(input);
    expect(result.interpretation).toBe('plateau_or_falling');
    expect(result.doublingTimeHours).toBe(-1);
  });
});

describe('ART Cycles REST API & Audit Trails', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.anand',
      fullName: 'Dr. Anand Kumar',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse
    await call('POST', '/api/users', doctor, {
      username: 'nurse1',
      fullName: 'Nurse Priya',
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
      fullName: 'Desk Staff',
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
      fullName: 'Deepika Sen',
      phone: '9811223344',
      dateOfBirth: '1992-06-18',
      address: 'Kolkata',
      lastMenstrualPeriod: '2026-02-01',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('provides endpoints for kinetics calculation and Gardner grading', async () => {
    const kRes = await call('POST', '/api/art/calculate-kinetics', doctor, {
      hcg1Value: 350,
      hcg1Datetime: '2026-03-01T09:00:00Z',
      hcg2Value: 780,
      hcg2Datetime: '2026-03-03T09:00:00Z',
    });
    expect(kRes.status).toBe(200);
    expect(kRes.body.interpretation).toBe('normal_viable_trajectory');

    const gRes = await call('POST', '/api/art/parse-gardner-grade', doctor, {
      gradeCode: '5AA',
    });
    expect(gRes.status).toBe(200);
    expect(gRes.body.tier).toBe('top_quality');
  });

  it('allows clinical staff to create ART cycle with auto-calculated fertilization rate', async () => {
    const payload = {
      patientId,
      cycleNumber: 1,
      startDate: '2026-02-05',
      cycleType: 'icsi_fresh',
      protocolType: 'gnrh_antagonist',
      indication: 'tubal_factor',
      indicationNotes: 'Bilateral tubal block confirmed on HSG',
      gonadotropinType: 'Recombinant FSH 225 IU + HMG 75 IU',
      totalGonadotropinDoseIu: 2400,
      stimulationDays: 10,
      peakEstradiolPgMl: 3100,
      triggerProgesteroneNgMl: 0.9,
      triggerType: 'rhcg_250mcg',
      totalOocytesRetrieved: 14,
      matureMiiOocytes: 12,
      inseminationMethod: 'icsi',
      fertilized2pnCount: 10,
      day3EmbryosCount: 9,
      day5BlastocystsCount: 5,
      embryosTransferredCount: 1,
      transferStage: 'day_5_blastocyst',
      transferredEmbryosDetails: '4AA',
      endometrialThicknessAtTransferMm: 10.2,
      transferDifficulty: 'easy',
      embryosFrozenCount: 4,
      frozenStorageStraws: 'Canister A, Straw #101 (4BA, 4BB), Straw #102 (3BB, 3BB)',
      clinicalPregnancyStatus: 'cycle_in_progress',
      reviewedBy: 1,
    };

    const res = await call('POST', '/api/art-cycles', nurse, payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.fertilizationRatePercent).toBeCloseTo(83.3, 1); // 10 / 12 * 100

    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'art.cycle_create'").get() as any;
    expect(auditRow).toBeDefined();
    expect(Number(auditRow.entity_id)).toBe(res.body.id);
  });

  it('blocks non-clinical desk attenders from recording ART cycles', async () => {
    const payload = {
      patientId,
      cycleNumber: 1,
      startDate: '2026-02-05',
      cycleType: 'ivf_fresh',
      protocolType: 'gnrh_antagonist',
      indication: 'male_factor',
      reviewedBy: 1,
    };

    const res = await call('POST', '/api/art-cycles', desk, payload);
    expect(res.status).toBe(403);
  });

  it('updates ART cycle with clinical pregnancy outcome and serial hCG', async () => {
    const createRes = await call('POST', '/api/art-cycles', doctor, {
      patientId,
      cycleNumber: 1,
      startDate: '2026-02-05',
      cycleType: 'icsi_fresh',
      protocolType: 'gnrh_antagonist',
      indication: 'pcos_ovulatory',
      totalOocytesRetrieved: 16,
      matureMiiOocytes: 14,
      fertilized2pnCount: 12,
      embryosTransferredCount: 1,
      transferStage: 'day_5_blastocyst',
      transferredEmbryosDetails: '4AA',
      reviewedBy: 1,
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    // Doctor updates with day 14 and 16 hCG and ultrasound confirmed intrauterine sac
    const updateRes = await call('PUT', `/api/art-cycles/${id}`, doctor, {
      patientId,
      cycleNumber: 1,
      startDate: '2026-02-05',
      cycleType: 'icsi_fresh',
      protocolType: 'gnrh_antagonist',
      indication: 'pcos_ovulatory',
      totalOocytesRetrieved: 16,
      matureMiiOocytes: 14,
      fertilized2pnCount: 12,
      embryosTransferredCount: 1,
      transferStage: 'day_5_blastocyst',
      transferredEmbryosDetails: '4AA',
      betaHcgDay14MiuMl: 450,
      betaHcgDay16MiuMl: 980,
      hcgDoublingTimeHours: 42.8,
      clinicalPregnancyStatus: 'clinical_intrauterine_sac',
      gestationalSacsCount: 1,
      fetalHeartPresent: true,
      cycleNotes: 'TVS at 6+2 weeks confirms single intrauterine gestational sac with fetal cardiac activity (+)',
      reviewedBy: 1,
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clinicalPregnancyStatus).toBe('clinical_intrauterine_sac');
    expect(updateRes.body.fetalHeartPresent).toBe(true);
    expect(updateRes.body.betaHcgDay14MiuMl).toBe(450);
  });

  it('records print audit log entry', async () => {
    const createRes = await call('POST', '/api/art-cycles', doctor, {
      patientId,
      cycleNumber: 1,
      startDate: '2026-02-05',
      cycleType: 'iui_husband',
      protocolType: 'natural_modified',
      indication: 'unexplained',
      reviewedBy: 1,
    });
    const id = createRes.body.id;

    const printRes = await call('POST', `/api/art-cycles/${id}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    const auditRow = db.prepare("SELECT * FROM audit_events WHERE action = 'art.cycle_print'").get() as any;
    expect(auditRow).toBeDefined();
    expect(Number(auditRow.entity_id)).toBe(id);
  });

  it('enforces delete permission (only doctor/admin)', async () => {
    const createRes = await call('POST', '/api/art-cycles', doctor, {
      patientId,
      cycleNumber: 1,
      startDate: '2026-02-05',
      cycleType: 'ivf_fresh',
      protocolType: 'gnrh_agonist_short',
      indication: 'diminished_ovarian_reserve',
      reviewedBy: 1,
    });
    const id = createRes.body.id;

    // Nurse blocked from deleting
    const nurseDel = await call('DELETE', `/api/art-cycles/${id}`, nurse);
    expect(nurseDel.status).toBe(403);

    // Doctor can delete
    const docDel = await call('DELETE', `/api/art-cycles/${id}`, doctor);
    expect(docDel.status).toBe(200);
    expect(docDel.body.deletedId).toBe(id);
  });
});
