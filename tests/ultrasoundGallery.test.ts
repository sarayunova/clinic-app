import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;
let reportId: number;

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('sample-ultrasound-jpeg-data')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('sample-png-data')]);

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
    fullName: 'Pooja Agarwal',
    dateOfBirth: '1995-08-20',
    phone: '9876543210',
    lastMenstrualPeriod: '2026-01-01',
    gravida: 1,
    para: 0,
    living: 0,
    abortions: 0,
  })).body.patient.id;

  // Create an initial ultrasound report
  const rep = await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
    scanDate: '2026-05-15',
    scanType: 'growth_wellbeing',
    indication: 'Routine fetal anatomy and growth assessment',
    gestationalAgeWeeks: 19,
    gestationalAgeDays: 2,
    bpdMm: 45,
    hcMm: 165,
    acMm: 145,
    flMm: 31,
    efwGrams: 300,
    efwPercentile: 'Appropriate for Gestational Age',
    impression: 'Single live intrauterine gestation with concordant biometry.',
  });
  expect(rep.status).toBe(201);
  reportId = rep.body.id;
});

describe('Ultrasound Image & Gallery API', () => {
  it('allows doctor and nurse to upload scan images with biometric tags and metadata', async () => {
    // Doctor uploads BPD axial image
    const up1 = await call('POST', `/api/ultrasounds/${reportId}/images/upload`, doctor, {
      title: 'BPD Measurement Plane',
      fileName: 'bpd_transverse.jpg',
      data: JPG.toString('base64'),
      imageLabel: 'Biparieal Diameter Transthalamic View',
      biometricTag: 'bpd',
      measurementValue: 'BPD 45.0 mm (19w2d)',
      includeInPrint: true,
      displayOrder: 1,
    });

    expect(up1.status).toBe(201);
    expect(up1.body).toMatchObject({
      reportId,
      patientId,
      biometricTag: 'bpd',
      imageLabel: 'Biparieal Diameter Transthalamic View',
      measurementValue: 'BPD 45.0 mm (19w2d)',
      includeInPrint: true,
      displayOrder: 1,
      mime: 'image/jpeg',
    });
    expect(up1.body.attachmentId).toBeGreaterThan(0);

    // Nurse uploads Femur Length image
    const up2 = await call('POST', `/api/ultrasounds/${reportId}/images/upload`, nurse, {
      title: 'Femur Diaphysis',
      fileName: 'femur.png',
      data: PNG.toString('base64'),
      imageLabel: 'Femur Length Measurement',
      biometricTag: 'fl',
      measurementValue: 'FL 31.0 mm (19w3d)',
      includeInPrint: true,
    });
    expect(up2.status).toBe(201);
    expect(up2.body.biometricTag).toBe('fl');
    expect(up2.body.mime).toBe('image/png');

    // Check that GET /api/ultrasounds/:id contains both images
    const getRep = await call('GET', `/api/ultrasounds/${reportId}`, doctor);
    expect(getRep.status).toBe(200);
    expect(getRep.body.images).toHaveLength(2);
    expect(getRep.body.images[0].biometricTag).toBe('bpd');
    expect(getRep.body.images[1].biometricTag).toBe('fl');

    // Check that GET /api/patients/:id/ultrasounds also lists images
    const listRep = await call('GET', `/api/patients/${patientId}/ultrasounds`, nurse);
    expect(listRep.status).toBe(200);
    expect(listRep.body.reports[0].images).toHaveLength(2);

    // Attender / desk is blocked
    const upDesk = await call('POST', `/api/ultrasounds/${reportId}/images/upload`, desk, {
      data: JPG.toString('base64'),
    });
    expect(upDesk.status).toBe(403);

    // Unauthenticated blocked
    const upAnon = await call('POST', `/api/ultrasounds/${reportId}/images/upload`, undefined, {
      data: JPG.toString('base64'),
    });
    expect(upAnon.status).toBe(401);
  });

  it('updates ultrasound image metadata including caption, tag and print flag', async () => {
    const up = await call('POST', `/api/ultrasounds/${reportId}/images/upload`, doctor, {
      fileName: 'cardiac.jpg',
      data: JPG.toString('base64'),
      biometricTag: 'cardiac',
      imageLabel: '4-Chamber Heart',
      includeInPrint: true,
    });
    expect(up.status).toBe(201);
    const imgId = up.body.id;

    // Patch label and toggle print inclusion
    const patch = await call('PATCH', `/api/ultrasounds/${reportId}/images/${imgId}`, doctor, {
      imageLabel: 'Four-Chamber View & Outflow Tracts Normal',
      measurementValue: 'FHR 144 bpm regular',
      includeInPrint: false,
    });
    expect(patch.status).toBe(200);
    expect(patch.body.imageLabel).toBe('Four-Chamber View & Outflow Tracts Normal');
    expect(patch.body.measurementValue).toBe('FHR 144 bpm regular');
    expect(patch.body.includeInPrint).toBe(false);

    // Verify in GET
    const rep = await call('GET', `/api/ultrasounds/${reportId}`, doctor);
    const updatedImg = rep.body.images.find((i: any) => i.id === imgId);
    expect(updatedImg.includeInPrint).toBe(false);
  });

  it('deletes an ultrasound image from gallery', async () => {
    const up = await call('POST', `/api/ultrasounds/${reportId}/images/upload`, doctor, {
      fileName: 'placenta.jpg',
      data: JPG.toString('base64'),
      biometricTag: 'placenta',
    });
    expect(up.status).toBe(201);
    const imgId = up.body.id;

    const del = await call('DELETE', `/api/ultrasounds/${reportId}/images/${imgId}`, doctor);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });

    // Verify removed
    const rep = await call('GET', `/api/ultrasounds/${reportId}`, doctor);
    expect(rep.body.images.some((i: any) => i.id === imgId)).toBe(false);
  });

  it('computes longitudinal gestational age discrepancies and serial biometry growth trajectory', async () => {
    // Patient has LMP: 2026-01-01
    // Scan 1: 2026-02-12 (at ~6w 0d LMP: 42 days). CRL = 10mm (~7w 0d = 49 days). Delta = +7 days
    await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-02-12',
      scanType: 'early_pregnancy',
      gestationalAgeWeeks: 7,
      gestationalAgeDays: 0,
      crlMm: 10,
      impression: 'Early viable intrauterine gestation.',
    });

    // Scan 2: 2026-07-23 (at 29w 0d LMP: 203 days). Scan GA: 26w 0d (182 days). Delta = -21 days (Growth Lag). EFW 850g (<10th percentile for 29w)
    await call('POST', `/api/patients/${patientId}/ultrasounds`, doctor, {
      scanDate: '2026-07-23',
      scanType: 'growth_wellbeing',
      gestationalAgeWeeks: 26,
      gestationalAgeDays: 0,
      bpdMm: 65,
      acMm: 210,
      flMm: 48,
      efwGrams: 850,
      efwPercentile: '< 10th percentile (SGA/FGR)',
      amnioticFluidAssessment: 'oligohydramnios',
      amnioticFluidCm: 4.2,
      impression: 'Asymmetric fetal growth restriction with oligohydramnios.',
    });

    // Query serial biometry endpoint
    const bio = await call('GET', `/api/patients/${patientId}/ultrasound-biometry`, doctor);
    expect(bio.status).toBe(200);
    expect(bio.body.patientId).toBe(patientId);
    expect(bio.body.scans.length).toBeGreaterThanOrEqual(3);

    // Verify chronological order: Scan 1 (Feb), Report 1 (May), Scan 2 (Jul)
    expect(bio.body.scans[0].scanDate).toBe('2026-02-12');
    expect(bio.body.scans[0].scanGaFormatted).toBe('7w 0d');
    expect(bio.body.scans[0].deltaDays).toBe(7);

    // Latest scan should have alert for FGR / Oligohydramnios
    const lastScan = bio.body.scans[bio.body.scans.length - 1];
    expect(lastScan.scanDate).toBe('2026-07-23');
    expect(lastScan.growthStatus).toMatch(/FGR|Small|Lag|Oligohydramnios/);
    expect(lastScan.deltaDays).toBe(-21);

    // Summary checks
    expect(bio.body.summary.totalScans).toBe(3);
    expect(bio.body.summary.hasGrowthRestrictionAlert).toBe(true);
    expect(bio.body.summary.latestEfwGrams).toBe(850);
    expect(bio.body.summary.latestAfiCm).toBe(4.2);
    expect(bio.body.summary.latestDiscrepancyDays).toBe(-21);
  });
});
