import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateLeveneThresholds,
  evaluateNeonatalIvh,
} from '../web/src/neonatalIvhEngine.js';

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
describe('Neonatal IVH & Levene PHH Engine (Pure Unit Tests)', () => {
  it('correctly calculates Levene 97th percentile and Davies action line across gestational ages', () => {
    // At 26 weeks PMA
    const t26 = calculateLeveneThresholds(26);
    expect(t26.levene97th).toBe(11.5);
    expect(t26.actionLine).toBe(15.5);

    // At 34 weeks PMA: 11.5 + (34-26)*0.25 = 13.5 mm, action line = 17.5 mm
    const t34 = calculateLeveneThresholds(34);
    expect(t34.levene97th).toBe(13.5);
    expect(t34.actionLine).toBe(17.5);

    // At 40 weeks PMA: 15.0 mm, action line = 19.0 mm
    const t40 = calculateLeveneThresholds(40);
    expect(t40.levene97th).toBe(15.0);
    expect(t40.actionLine).toBe(19.0);
  });

  it('evaluates Grade I subependymal hemorrhage with normal ventricles without PHH threshold crossing', () => {
    const res = evaluateNeonatalIvh({
      gestationalAgeWeeks: 28,
      birthWeightGrams: 1100,
      chronologicalAgeDays: 3,
      currentPmaWeeks: 28.5,
      currentWeightGrams: 1080,
      papileGrade: 'grade_1_subependymal',
      hemorrhageLaterality: 'bilateral',
      ventricularIndexLeftMm: 8.5,
      ventricularIndexRightMm: 8.8,
      anteriorHornWidthLeftMm: 2.1,
      anteriorHornWidthRightMm: 2.2,
      headCircumferenceCm: 25.0,
      headCircumferenceGrowthCmWeek: 0.7,
      fontanelleTension: 'normal_soft',
      splitSutures: false,
      apneasOrBradycardiasPresent: false,
    });

    expect(res.phhInterventionThresholdCrossed).toBe(false);
    expect(res.actionLineThresholdCrossed).toBe(false);
    expect(res.recommendedIntervention).toBe('conservative_surveillance');
    expect(res.summary).toContain('Grade I');
  });

  it('detects Levene Action Line crossing in Grade III IVH and recommends subcutaneous reservoir for ELBW infant', () => {
    const res = evaluateNeonatalIvh({
      gestationalAgeWeeks: 26,
      birthWeightGrams: 850,
      chronologicalAgeDays: 14,
      currentPmaWeeks: 28,
      currentWeightGrams: 890,
      papileGrade: 'grade_3_intraventricular_dilatation',
      hemorrhageLaterality: 'bilateral',
      ventricularIndexLeftMm: 16.5,
      ventricularIndexRightMm: 16.8, // Action line at 28w is 12.0 + 4 = 16.0 mm
      anteriorHornWidthLeftMm: 7.2,
      anteriorHornWidthRightMm: 7.0,
      headCircumferenceCm: 26.2,
      headCircumferenceGrowthCmWeek: 2.1, // Excessive growth > 1.5 cm/wk
      fontanelleTension: 'bulging_tense',
      splitSutures: true,
      apneasOrBradycardiasPresent: true,
      csfProteinGL: 2.8,
    });

    expect(res.phhInterventionThresholdCrossed).toBe(true);
    expect(res.actionLineThresholdCrossed).toBe(true);
    expect(res.vpShuntReadiness.readyForVpShunt).toBe(false); // 890g < 2000g and protein 2.8 > 1.5
    expect(res.recommendedIntervention).toBe('ventricular_access_device_reservoir');
    expect(res.interventionGuidance).toContain('subcutaneous Ventricular Access Device (Rickham / Ommaya reservoir)');
  });

  it('recognizes candidate for permanent VP shunt when weight >= 2000g and CSF protein is low', () => {
    const res = evaluateNeonatalIvh({
      gestationalAgeWeeks: 30,
      birthWeightGrams: 1400,
      chronologicalAgeDays: 50,
      currentPmaWeeks: 37,
      currentWeightGrams: 2200, // Meets weight criteria
      papileGrade: 'grade_3_intraventricular_dilatation',
      hemorrhageLaterality: 'unilateral_right',
      ventricularIndexLeftMm: 12.0,
      ventricularIndexRightMm: 19.5, // Exceeds action line
      anteriorHornWidthLeftMm: 4.0,
      anteriorHornWidthRightMm: 8.5,
      headCircumferenceCm: 32.5,
      headCircumferenceGrowthCmWeek: 1.8,
      fontanelleTension: 'bulging_tense',
      splitSutures: true,
      csfProteinGL: 0.9, // Low protein < 1.5 g/L
    });

    expect(res.phhInterventionThresholdCrossed).toBe(true);
    expect(res.vpShuntReadiness.readyForVpShunt).toBe(true);
    expect(res.recommendedIntervention).toBe('permanent_vp_shunt');
    expect(res.interventionGuidance).toContain('Ventriculoperitoneal (VP) Shunt placement');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal IVH REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. V. Rao (Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Nurse Kavya (NICU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.nicu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.nicu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ward',
      fullName: 'Ward Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ward', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ward', PW);

    // Premature infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Sunita (27w IVH)',
      dateOfBirth: '2026-10-20',
      phone: '+91 98765 22222',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to preview evaluation, create episode, log flowsheet, and retrieve detail', async () => {
    // 1. Live preview calculation
    const previewRes = await call('POST', '/api/neonatal-ivh/evaluate', doctor, {
      currentPmaWeeks: 28,
      currentWeightGrams: 950,
      papileGrade: 'grade_3_intraventricular_dilatation',
      ventricularIndexLeftMm: 16.5,
      ventricularIndexRightMm: 16.5,
      anteriorHornWidthLeftMm: 7.0,
      anteriorHornWidthRightMm: 7.0,
      headCircumferenceGrowthCmWeek: 2.0,
      fontanelleTension: 'bulging_tense',
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.evalResult.phhInterventionThresholdCrossed).toBe(true);

    // 2. Create episode
    const createRes = await call('POST', '/api/neonatal-ivh/episodes', doctor, {
      patientId,
      scanDatetime: '2026-11-01T10:00',
      gestationalAgeWeeks: 27,
      birthWeightGrams: 950,
      chronologicalAgeDays: 12,
      currentPmaWeeks: 28.7,
      currentWeightGrams: 950,
      cranialUltrasoundIndication: 'Routine day 14 screening for extreme prematurity',
      papileGrade: 'grade_3_intraventricular_dilatation',
      hemorrhageLaterality: 'bilateral',
      ventricularIndexLeftMm: 16.8,
      ventricularIndexRightMm: 17.0,
      anteriorHornWidthLeftMm: 7.5,
      anteriorHornWidthRightMm: 7.5,
      thalamoOccipitalDistanceMm: 29.0,
      headCircumferenceCm: 25.8,
      headCircumferenceGrowthCmWeek: 2.2,
      fontanelleTension: 'bulging_tense',
      splitSutures: true,
      apneasOrBradycardiasPresent: true,
      csfProteinGL: 2.5,
      interventionStatus: 'ventricular_access_device_reservoir',
      status: 'phh_active_decompression',
      clinicalNotes: 'ELVIS trial criteria crossed. Pediatric neurosurgery placed Rickham reservoir.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('IVH-');

    // 3. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/neonatal-ivh/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-02T09:00',
      daysFromBaseline: 1.0,
      ventricularIndexMm: 15.2,
      anteriorHornWidthMm: 6.5,
      headCircumferenceCm: 25.9,
      fontanelleTension: 'full',
      splitCranialSutures: true,
      apneicEpisodes24h: 1,
      csfVolumeTappedMl: 12.0,
      resistiveIndexAca: 0.78,
      notes: '12 mL xanthochromic CSF removed via 25G butterfly needle.',
    });
    expect(logRes.status).toBe(201);

    // 4. Retrieve single episode with flowsheet logs
    const getRes = await call('GET', `/api/neonatal-ivh/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.logs.length).toBe(1);
    expect(getRes.body.logs[0].csf_volume_tapped_ml).toBe(12.0);
    expect(getRes.body.evalResult.phhInterventionThresholdCrossed).toBe(true);

    // 5. Query episodes by status
    const listRes = await call('GET', '/api/neonatal-ivh/episodes?status=phh_active_decompression', doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 6. Doctor updates episode status
    const updateRes = await call('PATCH', `/api/neonatal-ivh/episodes/${episodeId}`, doctor, {
      status: 'post_surgical_shunt_monitoring',
      interventionStatus: 'permanent_vp_shunt',
      clinicalNotes: 'Transitioned to permanent VP shunt after CSF protein normalized.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('post_surgical_shunt_monitoring');

    // 7. Attender is rejected with 403
    const attenderRes = await call('POST', '/api/neonatal-ivh/episodes', attender, {
      patientId,
      scanDatetime: '2026-11-03T10:00',
    });
    expect(attenderRes.status).toBe(403);

    // 8. Nurse cannot delete episode
    const nurseDelRes = await call('DELETE', `/api/neonatal-ivh/episodes/${episodeId}`, nurse);
    expect(nurseDelRes.status).toBe(403);

    // 9. Doctor deletes flowsheet log and episode
    const delLogRes = await call('DELETE', `/api/neonatal-ivh/episodes/${episodeId}/flowsheet-logs/${getRes.body.logs[0].id}`, doctor);
    expect(delLogRes.status).toBe(200);

    const delEpRes = await call('DELETE', `/api/neonatal-ivh/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });
});
