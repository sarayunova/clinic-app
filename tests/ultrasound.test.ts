import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateGestationalAgeByCrl,
  calculateEddByScan,
  calculateEfwHadlock,
  evaluateEfwPercentile,
  interpretAfi,
  interpretSdp,
} from '../web/src/ultrasoundBiometry.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
    fullName: 'Kavita Sundaram',
    dateOfBirth: '1996-04-12',
    phone: '9876543210',
    lastMenstrualPeriod: '2026-04-01',
    gravida: 1,
    para: 0,
    living: 0,
    abortions: 0,
  })).body.patient.id;
});

describe('Ultrasound Biometry Calculations', () => {
  it('calculates gestational age from Crown-Rump Length (Robinson & Fleming)', () => {
    // CRL 10mm -> ~7w 0d (49 days)
    const ga1 = calculateGestationalAgeByCrl(10);
    expect(ga1).not.toBeNull();
    expect(ga1!.weeks).toBe(7);
    expect(ga1!.days).toBe(0);

    // CRL 45mm -> ~11w 1d (78 days)
    const ga2 = calculateGestationalAgeByCrl(45);
    expect(ga2).not.toBeNull();
    expect(ga2!.weeks).toBe(11);
    expect(ga2!.days).toBe(1);

    // CRL 80mm -> ~13w 5d (96 days)
    const ga3 = calculateGestationalAgeByCrl(80);
    expect(ga3).not.toBeNull();
    expect(ga3!.weeks).toBe(13);
    expect(ga3!.days).toBe(5);

    // Invalid / out of range
    expect(calculateGestationalAgeByCrl(-5)).toBeNull();
    expect(calculateGestationalAgeByCrl(200)).toBeNull();
  });

  it('calculates EDD from scan date and GA', () => {
    // At 20w 0d on 2026-06-01, remaining days = 280 - 140 = 140 days -> 2026-10-19
    const edd = calculateEddByScan('2026-06-01', 20, 0);
    expect(edd).toBe('2026-10-19');

    // Invalid GA
    expect(calculateEddByScan('2026-06-01', 50, 0)).toBeNull();
  });

  it('calculates Estimated Fetal Weight (Hadlock models) and evaluates percentiles', () => {
    // Biometry at ~28 weeks: BPD 71mm, HC 260mm, AC 238mm, FL 53mm
    const efw4 = calculateEfwHadlock({
      bpdMm: 71,
      hcMm: 260,
      acMm: 238,
      flMm: 53,
    });
    expect(efw4).not.toBeNull();
    expect(efw4).toBeGreaterThan(1100);
    expect(efw4).toBeLessThan(1300);

    // Percentile classification at 28w (~1210g median)
    const evalAga = evaluateEfwPercentile(efw4!, 28);
    expect(evalAga).not.toBeNull();
    expect(evalAga!.category).toBe('aga');

    // Small for Gestational Age (< 1030g at 28w)
    const evalSga = evaluateEfwPercentile(900, 28);
    expect(evalSga!.category).toBe('sga');
    expect(evalSga!.label).toContain('Small for Gestational Age');

    // Large for Gestational Age (> 1410g at 28w)
    const evalLga = evaluateEfwPercentile(1500, 28);
    expect(evalLga!.category).toBe('lga');
    expect(evalLga!.label).toContain('Large for Gestational Age');

    // Hadlock 3 (BPD, AC, FL) fallback
    const efw3 = calculateEfwHadlock({
      bpdMm: 71,
      acMm: 238,
      flMm: 53,
    });
    expect(efw3).not.toBeNull();
    expect(efw3).toBeGreaterThan(1100);

    // Hadlock 2 (AC, FL only) fallback
    const efw2 = calculateEfwHadlock({
      acMm: 238,
      flMm: 53,
    });
    expect(efw2).not.toBeNull();
    expect(efw2).toBeGreaterThan(1000);
  });

  it('interprets Amniotic Fluid Index (AFI) and Single Deepest Pocket (SDP)', () => {
    expect(interpretAfi(3.5).assessment).toBe('oligohydramnios');
    expect(interpretAfi(3.5).alert).toBe(true);

    expect(interpretAfi(7.2).assessment).toBe('borderline');
    expect(interpretAfi(7.2).alert).toBe(true);

    expect(interpretAfi(14.0).assessment).toBe('normal');
    expect(interpretAfi(14.0).alert).toBe(false);

    expect(interpretAfi(26.0).assessment).toBe('polyhydramnios');
    expect(interpretAfi(26.0).alert).toBe(true);

    expect(interpretSdp(1.2).assessment).toBe('oligohydramnios');
    expect(interpretSdp(4.5).assessment).toBe('normal');
    expect(interpretSdp(9.2).assessment).toBe('polyhydramnios');
  });
});

describe('Ultrasound Reports API', () => {
  it('enforces role access: doctor & nurse allowed, desk & unauthenticated blocked', async () => {
    const payload = {
      scanDate: '2026-06-15',
      scanType: 'growth_wellbeing',
      gestationalAgeWeeks: 28,
      gestationalAgeDays: 2,
      presentation: 'cephalic',
      placentaLocation: 'fundal',
      placentaGrade: '1',
      amnioticFluidType: 'afi',
      amnioticFluidCm: 14.5,
      amnioticFluidAssessment: 'normal',
      bpdMm: 72.0,
      hcMm: 265.0,
      acMm: 240.0,
      flMm: 54.0,
      efwGrams: 1240,
      efwPercentile: 'Appropriate for Gestational Age (AGA)',
      impression: 'Single live fetus in cephalic presentation. Adequate liquor.',
    };

    // Unauthenticated -> 401
    const r1 = await call('POST', `/api/patients/${patientId}/ultrasounds`, undefined, payload);
    expect(r1.status).toBe(401);

    // Desk staff (attender) -> 403
    const r2 = await call('POST', `/api/patients/${patientId}/ultrasounds`, desk, payload);
    expect(r2.status).toBe(403);

    // Nurse -> 201
    const r3 = await call('POST', `/api/patients/${patientId}/ultrasounds`, nurse, payload);
    expect(r3.status).toBe(201);
    expect(r3.body.id).toBeTypeOf('number');
    expect(r3.body.efwGrams).toBe(1240);

    // Doctor -> 201
    const r4 = await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      ...payload,
      scanDate: '2026-07-15',
      gestationalAgeWeeks: 32,
      efwGrams: 1950,
    });
    expect(r4.status).toBe(201);
  });

  it('validates schema bounds and required fields', async () => {
    // Missing impression
    const r1 = await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-06-15',
      scanType: 'growth_wellbeing',
    });
    expect(r1.status).toBe(400);

    // Invalid scan type
    const r2 = await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-06-15',
      scanType: 'cardiac_mri',
      impression: 'Test',
    });
    expect(r2.status).toBe(400);

    // Out of bound GA
    const r3 = await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-06-15',
      scanType: 'growth_wellbeing',
      gestationalAgeWeeks: 55,
      impression: 'Test',
    });
    expect(r3.status).toBe(400);
  });

  it('records, lists, updates, prints and deletes ultrasound reports with audit trail', async () => {
    // 1. Create Anomaly Scan
    const created = await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-05-10',
      scanType: 'anomaly_scan',
      indication: 'Targeted Anomaly Scan (TIFFA)',
      gestationalAgeWeeks: 20,
      gestationalAgeDays: 4,
      fetalNumber: 'single',
      cardiacActivity: 'present',
      fhrBpm: 148,
      presentation: 'cephalic',
      placentaLocation: 'anterior',
      placentaGrade: '0',
      amnioticFluidType: 'afi',
      amnioticFluidCm: 15.0,
      bpdMm: 48.0,
      hcMm: 178.0,
      acMm: 152.0,
      flMm: 33.0,
      efwGrams: 350,
      anatomySurvey: JSON.stringify({
        cns: 'Normal',
        spine: 'Normal',
        face: 'Normal',
        heart: 'Normal',
      }),
      impression: 'Targeted anomaly survey gross morphological defects not detected.',
      recommendations: 'Follow up growth scan at 28-30 weeks.',
      sonographerName: 'Dr. Rao, MD',
    });
    expect(created.status).toBe(201);
    const reportId = created.body.id;

    // 2. Fetch single report
    const single = await call('GET', `/api/ultrasounds/${reportId}`, nurse);
    expect(single.status).toBe(200);
    expect(single.body.patientName).toBe('Kavita Sundaram');
    expect(single.body.scanType).toBe('anomaly_scan');
    expect(single.body.fhrBpm).toBe(148);

    // 3. List reports for patient
    const list = await call('GET', `/api/patients/${patientId}/ultrasounds`, doctor);
    expect(list.status).toBe(200);
    expect(list.body.reports.length).toBe(1);
    expect(list.body.reports[0].id).toBe(reportId);

    // 4. Update report
    const updated = await call('PATCH', `/api/ultrasounds/${reportId}`, doctor, {
      placentaGrade: '1',
      recommendations: 'Growth scan with Doppler at 28 weeks.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.placentaGrade).toBe('1');
    expect(updated.body.recommendations).toBe('Growth scan with Doppler at 28 weeks.');

    // 5. Print report (logs audit)
    const printRes = await call('POST', `/api/ultrasounds/${reportId}/print`, nurse);
    expect(printRes.status).toBe(200);
    expect(printRes.body.ok).toBe(true);

    // 6. Verify inclusion in Clinical Summary
    const summary = await call('GET', `/api/patients/${patientId}/clinical-summary`, doctor);
    expect(summary.status).toBe(200);
    expect(summary.body.latestUltrasound).not.toBeNull();
    expect(summary.body.latestUltrasound.id).toBe(reportId);
    expect(summary.body.latestUltrasound.efwGrams).toBe(350);

    // 7. Delete report
    const delRes = await call('DELETE', `/api/ultrasounds/${reportId}`, doctor);
    expect(delRes.status).toBe(200);

    const afterDel = await call('GET', `/api/ultrasounds/${reportId}`, doctor);
    expect(afterDel.status).toBe(404);

    // 8. Verify audit logs
    const auditEvents = db
      .prepare("SELECT action, entity_id FROM audit_events WHERE action LIKE 'ultrasound.%' ORDER BY id ASC")
      .all() as { action: string; entity_id: string }[];

    expect(auditEvents.length).toBe(4);
    expect(auditEvents.map((a) => a.action)).toEqual([
      'ultrasound.create',
      'ultrasound.update',
      'ultrasound.print',
      'ultrasound.delete',
    ]);
  });
});
