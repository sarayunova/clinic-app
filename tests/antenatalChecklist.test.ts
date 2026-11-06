import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { localDate } from '../server/time.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
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

  const reg = await call('POST', '/api/patients', desk, {
    fullName: 'Pooja Sharma',
    phone: '9876543210',
    dateOfBirth: '1996-05-15',
  });
  expect(reg.status).toBe(201);
  patientId = reg.body.patient.id;

  // Set obstetric profile
  await call('PATCH', `/api/patients/${patientId}`, doctor, {
    version: reg.body.patient.version,
    lastMenstrualPeriod: '2026-06-01',
    gravida: 2,
    para: 1,
    abortions: 0,
    living: 1,
  });
});

describe('Antenatal Routine Investigation & Screening Checklist API', () => {
  it('enforces role permissions: doctor/nurse read, doctor write only', async () => {
    // Read: Doctor and nurse can read; desk and unauthenticated cannot
    expect((await call('GET', `/api/patients/${patientId}/antenatal-checklist`, doctor)).status).toBe(200);
    expect((await call('GET', `/api/patients/${patientId}/antenatal-checklist`, nurse)).status).toBe(200);
    expect((await call('GET', `/api/patients/${patientId}/antenatal-checklist`, desk)).status).toBe(403);
    expect((await call('GET', `/api/patients/${patientId}/antenatal-checklist`)).status).toBe(401);

    // Write: Doctor only
    expect(
      (
        await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/blood_group`, doctor, {
          status: 'completed',
          resultValue: 'B Positive',
        })
      ).status
    ).toBe(200);

    expect(
      (
        await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/blood_group`, nurse, {
          status: 'completed',
          resultValue: 'B Positive',
        })
      ).status
    ).toBe(403);

    expect(
      (
        await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/blood_group`, desk, {
          status: 'completed',
        })
      ).status
    ).toBe(403);
  });

  it('returns standard tests and computes completion statistics', async () => {
    const res = await call('GET', `/api/patients/${patientId}/antenatal-checklist`, doctor);
    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.tests.length).toBeGreaterThanOrEqual(15);

    // Initial stats
    expect(res.body.summary.completed).toBe(0);
    expect(res.body.summary.pending).toBe(res.body.tests.length);
    expect(res.body.summary.completionPercentage).toBe(0);

    // Update 2 tests: 1 completed, 1 ordered
    const today = localDate(new Date(), cfg.timezone);
    await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/blood_group`, doctor, {
      status: 'completed',
      resultValue: 'O Rh-Negative',
      performedDate: today,
    });

    await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/scan_nt`, doctor, {
      status: 'ordered',
      notes: 'Scheduled with ultrasound clinic for 12w',
    });

    const after = await call('GET', `/api/patients/${patientId}/antenatal-checklist`, doctor);
    expect(after.status).toBe(200);
    expect(after.body.summary.completed).toBe(1);
    expect(after.body.summary.ordered).toBe(1);
    expect(after.body.summary.completionPercentage).toBeGreaterThan(0);

    const bg = after.body.tests.find((t: any) => t.testKey === 'blood_group');
    expect(bg.status).toBe('completed');
    expect(bg.resultValue).toBe('O Rh-Negative');
    expect(bg.performedDate).toBe(today);
    expect(bg.updatedByName).toBe('Dr Rao');
  });

  it('rejects invalid inputs: bad test key, future dates, non-existent patient', async () => {
    // Non-existent patient
    expect((await call('GET', '/api/patients/99999/antenatal-checklist', doctor)).status).toBe(404);

    // Unknown test key
    expect(
      (await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/non_existent_key`, doctor, { status: 'completed' }))
        .status
    ).toBe(400);

    // Future performed date
    expect(
      (
        await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/cbc_1`, doctor, {
          status: 'completed',
          performedDate: '2099-01-01',
        })
      ).status
    ).toBe(400);

    // Non-existent attachment
    expect(
      (
        await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/cbc_1`, doctor, {
          status: 'completed',
          attachmentId: 8888,
        })
      ).status
    ).toBe(400);
  });

  it('links an uploaded attachment and logs audit trail', async () => {
    // Upload a lab document for this patient
    const validPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('1 0 obj<<>>endobj\n'), Buffer.from('%%EOF')]);
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/attachments`,
      headers: { cookie: doctor },
      payload: {
        docType: 'lab_report',
        title: 'First Trimester CBC Report',
        documentDate: localDate(new Date(), cfg.timezone),
        fileName: 'cbc_report.pdf',
        data: validPdf.toString('base64'),
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    const docId = JSON.parse(uploadRes.body).id;

    // Link attachment to cbc_1 test
    const patchRes = await call('PATCH', `/api/patients/${patientId}/antenatal-checklist/cbc_1`, doctor, {
      status: 'completed',
      resultValue: 'Hb 11.6 g/dL, Platelets 240k',
      attachmentId: docId,
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.attachmentId).toBe(docId);
    expect(patchRes.body.attachmentTitle).toBe('First Trimester CBC Report');

    // Verify audit log entry
    const auditRes = await call('GET', `/api/audit?patientId=${patientId}&action=antenatal.checklist_update`, doctor);
    expect(auditRes.status).toBe(200);
    const logs = auditRes.body as Json[];
    expect(logs.length).toBeGreaterThan(0);
    const updateLog = logs.find((l: any) => l.action === 'antenatal.checklist_update');
    expect(updateLog).toBeDefined();
    expect(updateLog.detail.testKey).toBe('cbc_1');
    expect(updateLog.detail.status).toBe('completed');
  });
});
