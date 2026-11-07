import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateMultipleGestation,
  type FetusAssessmentData,
} from '../web/src/multipleGestationEngine.js';

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

describe('Multiple Gestation Surveillance & Complications Engine', () => {
  it('evaluates concordant uncomplicated DCDA twins', () => {
    const fetuses: FetusAssessmentData[] = [
      {
        label: 'Twin A',
        presentation: 'cephalic',
        bpdMm: 72,
        hcMm: 270,
        acMm: 245,
        flMm: 52,
        efwG: 1250,
        efwPercentile: 50,
        dvpCm: 4.8,
        bladderVisualized: true,
        uaPi: 1.05,
        uaFlow: 'normal_positive',
      },
      {
        label: 'Twin B',
        presentation: 'cephalic',
        bpdMm: 70,
        hcMm: 265,
        acMm: 240,
        flMm: 51,
        efwG: 1200,
        efwPercentile: 45,
        dvpCm: 4.5,
        bladderVisualized: true,
        uaPi: 1.08,
        uaFlow: 'normal_positive',
      },
    ];

    const result = calculateMultipleGestation({
      plurality: 'twins',
      chorionicity: 'dcda',
      amnionicity: 'diamniotic',
      gestationalAgeWeeks: 28,
      fetuses,
    });

    expect(result.efwDiscordancePercent).toBeCloseTo(4.0, 1);
    expect(result.discordanceSeverity).toBe('concordant');
    expect(result.tttsStage).toBe('none');
    expect(result.sfgrType).toBe('none');
    expect(result.deliveryTimingRecommendation).toContain('37+0 to 37+6 weeks');
    expect(result.deliveryModeRecommendation).toContain('Trial of vaginal delivery');
  });

  it('diagnoses Quintero Stage II TTTS in monochorionic diamniotic (MCDA) twins', () => {
    // Twin A (Donor): oligohydramnios (DVP 1.4 cm) & empty bladder
    // Twin B (Recipient): severe polyhydramnios (DVP 10.5 cm)
    const fetuses: FetusAssessmentData[] = [
      {
        label: 'Twin A (Donor)',
        presentation: 'cephalic',
        efwG: 410,
        efwPercentile: 12,
        dvpCm: 1.4, // Oligohydramnios < 2.0 cm
        bladderVisualized: false, // Collapsed / persistently empty
        uaFlow: 'normal_positive',
      },
      {
        label: 'Twin B (Recipient)',
        presentation: 'breech',
        efwG: 590,
        efwPercentile: 65,
        dvpCm: 10.5, // Polyhydramnios > 10.0 cm
        bladderVisualized: true,
        uaFlow: 'normal_positive',
      },
    ];

    const result = calculateMultipleGestation({
      plurality: 'twins',
      chorionicity: 'mcda',
      amnionicity: 'diamniotic',
      gestationalAgeWeeks: 21,
      fetuses,
    });

    expect(result.tttsStage).toBe('stage_2');
    expect(result.tttsSummary).toContain('Quintero Stage II');
    expect(result.surveillanceIntervalRecommendation).toContain('URGENT TERTIARY REFERRAL');
    expect(result.surveillanceIntervalRecommendation).toContain('Fetoscopic Laser Photocoagulation');
    expect(result.corticosteroidsIndicated).toBe(true);
  });

  it('diagnoses Gratacós Type II Selective Fetal Growth Restriction (sFGR) with persistent AEDF', () => {
    // Monochorionic pair with 32% EFW discordance and absent end-diastolic flow in smaller twin
    const fetuses: FetusAssessmentData[] = [
      {
        label: 'Twin A (Appropriate)',
        presentation: 'cephalic',
        efwG: 1500,
        efwPercentile: 55,
        dvpCm: 5.0,
        bladderVisualized: true,
        uaFlow: 'normal_positive',
      },
      {
        label: 'Twin B (Restricted)',
        presentation: 'transverse',
        efwG: 1010, // Discordance = (1500 - 1010) / 1500 = 32.7%
        efwPercentile: 4, // < 10th centile
        dvpCm: 3.8, // Normal fluid, NOT TTTS
        bladderVisualized: true,
        uaFlow: 'absent_aedf', // Persistent AEDF
      },
    ];

    const result = calculateMultipleGestation({
      plurality: 'twins',
      chorionicity: 'mcda',
      amnionicity: 'diamniotic',
      gestationalAgeWeeks: 29,
      fetuses,
    });

    expect(result.efwDiscordancePercent).toBeGreaterThanOrEqual(30.0);
    expect(result.discordanceSeverity).toBe('severe_discordance_gt_25');
    expect(result.sfgrType).toBe('type_2');
    expect(result.sfgrSummary).toContain('Gratacós Type II');
    expect(result.tttsStage).toBe('none'); // Amniotic fluid was normal
    expect(result.surveillanceIntervalRecommendation).toContain('Twice-weekly fetal Doppler');
  });

  it('mandates Cesarean delivery and early timing for MCMA monoamniotic twins', () => {
    const fetuses: FetusAssessmentData[] = [
      {
        label: 'Twin A',
        presentation: 'cephalic',
        efwG: 1750,
        dvpCm: 5.5,
        bladderVisualized: true,
        uaFlow: 'normal_positive',
      },
      {
        label: 'Twin B',
        presentation: 'cephalic',
        efwG: 1720,
        dvpCm: 5.2,
        bladderVisualized: true,
        uaFlow: 'normal_positive',
      },
    ];

    const result = calculateMultipleGestation({
      plurality: 'twins',
      chorionicity: 'mcma',
      amnionicity: 'monoamniotic',
      gestationalAgeWeeks: 31,
      fetuses,
      cordEntanglementNoted: true,
    });

    expect(result.deliveryTimingRecommendation).toContain('32+0 to 34+0 weeks');
    expect(result.deliveryModeRecommendation).toContain('Cesarean section is mandatory');
    expect(result.cordEntanglementNoted).toBe(true);
  });
});

describe('Multiple Gestation REST API & RBAC', () => {
  let pregnancyId: number;

  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.sarayu',
      fullName: 'Dr. Sarayu Rao',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse
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

    // Desk attender
    await call('POST', '/api/users', doctor, {
      username: 'desk1',
      fullName: 'Rajesh Reception',
      role: 'attender',
      password: 'temp-pass-desk-1',
    });
    const deskFirst = await login('desk1', 'temp-pass-desk-1');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-1',
      newPassword: PW,
    });
    desk = await login('desk1');

    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Pooja Agarwal',
      phone: '9898989802',
      dateOfBirth: '1996-08-20',
      address: 'Mumbai',
      lastMenstrualPeriod: '2026-05-15',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;

    // Create pregnancy profile
    const pregRes = await call('POST', '/api/multiple-gestation/pregnancies', doctor, {
      patientId,
      plurality: 'twins',
      chorionicity: 'mcda',
      amnionicity: 'diamniotic',
      firstTrimesterSign: 't_sign',
      dividingMembraneThicknessMm: 1.4,
      conceptionMethod: 'spontaneous',
      diagnosisGestationWeeks: 12,
      baselineNotes: 'Monochorionic diamniotic twins confirmed at 12w scan.',
    });
    expect(pregRes.status).toBe(201);
    pregnancyId = pregRes.body.id;
  });

  it('rejects unauthenticated requests to multiple gestation endpoints', async () => {
    const r = await call('GET', `/api/patients/${patientId}/multiple-gestation/pregnancies`);
    expect(r.status).toBe(401);
  });

  it('allows real-time discordance calculation without persisting to DB', async () => {
    const calcPayload = {
      plurality: 'twins',
      chorionicity: 'dcda',
      amnionicity: 'diamniotic',
      gestationalAgeWeeks: 24,
      fetuses: [
        { label: 'Twin A', presentation: 'cephalic', efwG: 650, dvpCm: 4.5, bladderVisualized: true, uaFlow: 'normal_positive' },
        { label: 'Twin B', presentation: 'breech', efwG: 620, dvpCm: 4.2, bladderVisualized: true, uaFlow: 'normal_positive' },
      ],
    };

    const res = await call('POST', '/api/multiple-gestation/calculate', nurse, calcPayload);
    expect(res.status).toBe(200);
    expect(res.body.efwDiscordancePercent).toBeLessThan(10);
    expect(res.body.discordanceSeverity).toBe('concordant');
  });

  it('allows clinical staff to record and retrieve longitudinal assessments', async () => {
    const assessmentPayload = {
      pregnancyId,
      patientId,
      assessmentDate: '2026-11-07',
      assessmentTime: '11:30',
      gestationalAgeWeeks: 24,
      gestationalAgeDays: 1,
      plurality: 'twins',
      chorionicity: 'mcda',
      amnionicity: 'diamniotic',
      fetuses: [
        {
          label: 'Twin A',
          presentation: 'cephalic',
          bpdMm: 60,
          hcMm: 220,
          acMm: 198,
          flMm: 44,
          efwG: 680,
          efwPercentile: 50,
          dvpCm: 4.5,
          bladderVisualized: true,
          uaPi: 1.15,
          uaFlow: 'normal_positive',
          mcaPi: 1.70,
          mcaPsvCmS: 28.0,
          mcaPsvMom: 1.02,
        },
        {
          label: 'Twin B',
          presentation: 'breech',
          bpdMm: 58,
          hcMm: 215,
          acMm: 192,
          flMm: 42,
          efwG: 630,
          efwPercentile: 40,
          dvpCm: 4.2,
          bladderVisualized: true,
          uaPi: 1.18,
          uaFlow: 'normal_positive',
          mcaPi: 1.72,
          mcaPsvCmS: 29.0,
          mcaPsvMom: 1.05,
        },
      ],
      clinicalNotes: 'Normal concordant growth, both bladders well visualized, reassuring Dopplers.',
      performedBy: 'Dr. Rajiv Twins',
    };

    const createRes = await call('POST', '/api/multiple-gestation/assessments', nurse, assessmentPayload);
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.tttsStage).toBe('none');
    expect(createRes.body.sfgrType).toBe('none');

    const assessId = createRes.body.id;

    // Retrieve single
    const getRes = await call('GET', `/api/multiple-gestation/assessments/${assessId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.fetuses).toHaveLength(2);
    expect(getRes.body.gestationalAgeWeeks).toBe(24);

    // List assessments for pregnancy
    const listRes = await call(
      'GET',
      `/api/multiple-gestation/pregnancies/${pregnancyId}/assessments`,
      doctor,
    );
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(assessId);
  });

  it('blocks front desk staff from writing multiple gestation records', async () => {
    const res = await call('POST', '/api/multiple-gestation/pregnancies', desk, {
      patientId,
      plurality: 'twins',
      chorionicity: 'dcda',
      amnionicity: 'diamniotic',
    });
    expect(res.status).toBe(403);
  });

  it('allows doctor to audit print and delete assessment', async () => {
    const payload = {
      pregnancyId,
      patientId,
      assessmentDate: '2026-11-07',
      gestationalAgeWeeks: 20,
      plurality: 'twins',
      chorionicity: 'mcda',
      amnionicity: 'diamniotic',
      fetuses: [
        { label: 'Twin A', presentation: 'cephalic', efwG: 350, dvpCm: 4.0, bladderVisualized: true, uaFlow: 'normal_positive' },
        { label: 'Twin B', presentation: 'cephalic', efwG: 340, dvpCm: 3.8, bladderVisualized: true, uaFlow: 'normal_positive' },
      ],
    };

    const c = await call('POST', '/api/multiple-gestation/assessments', doctor, payload);
    const id = c.body.id;

    const printRes = await call('POST', `/api/multiple-gestation/assessments/${id}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    const delRes = await call('DELETE', `/api/multiple-gestation/assessments/${id}`, doctor);
    expect(delRes.status).toBe(200);

    const getRes = await call('GET', `/api/multiple-gestation/assessments/${id}`, doctor);
    expect(getRes.status).toBe(404);
  });
});
