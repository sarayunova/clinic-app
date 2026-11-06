import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
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
});

describe('Clinic Branding, Document Header & Digital Signature Settings', () => {
  it('enforces RBAC: doctor can update, other staff can only read, unauthenticated blocked', async () => {
    // Unauthenticated GET -> 401
    expect((await call('GET', '/api/settings')).status).toBe(401);

    // Unauthenticated PUT -> 401
    expect((await call('PUT', '/api/settings', undefined, { clinicName: 'Hack Clinic' })).status).toBe(401);

    // Nurse PUT -> 403
    expect((await call('PUT', '/api/settings', nurse, { clinicName: 'Nurse Clinic' })).status).toBe(403);

    // Desk PUT -> 403
    expect((await call('PUT', '/api/settings', desk, { clinicName: 'Desk Clinic' })).status).toBe(403);

    // Doctor PUT -> 200
    const saveRes = await call('PUT', '/api/settings', doctor, {
      clinicName: "Dr. Rao's Maternity & Surgical Hospital",
      clinicTagline: 'Centre for Advanced Obstetrics & Fetal Medicine',
      doctorName: 'Dr. K. Sarayu Rao',
      doctorQualifications: 'MBBS, MS (OBGYN), DNB, FMAS',
      registrationNo: 'KMC-54219',
    });
    expect(saveRes.status).toBe(200);

    // Nurse & Desk can read newly saved branding
    const nurseGet = await call('GET', '/api/settings', nurse);
    expect(nurseGet.status).toBe(200);
    expect(nurseGet.body.clinicName).toBe("Dr. Rao's Maternity & Surgical Hospital");
    expect(nurseGet.body.clinicTagline).toBe('Centre for Advanced Obstetrics & Fetal Medicine');
    expect(nurseGet.body.doctorQualifications).toBe('MBBS, MS (OBGYN), DNB, FMAS');
    expect(nurseGet.body.registrationNo).toBe('KMC-54219');
  });

  it('validates schema: rejects unknown fields, invalid layout enums, and invalid margins', async () => {
    // Unknown field -> 400
    const r1 = await call('PUT', '/api/settings', doctor, { randomField: 'value' });
    expect(r1.status).toBe(400);

    // Invalid header layout -> 400
    const r2 = await call('PUT', '/api/settings', doctor, { headerLayout: 'unsupported_layout' });
    expect(r2.status).toBe(400);

    // Invalid margin -> 400
    const r3 = await call('PUT', '/api/settings', doctor, { topMarginMm: 'abc' });
    expect(r3.status).toBe(400);

    // Valid header layout options: centered, split, modern
    expect((await call('PUT', '/api/settings', doctor, { headerLayout: 'split' })).status).toBe(200);
    expect((await call('PUT', '/api/settings', doctor, { headerLayout: 'modern' })).status).toBe(200);
    expect((await call('PUT', '/api/settings', doctor, { headerLayout: 'centered' })).status).toBe(200);
  });

  it('saves and retrieves complete branding including logo and digital signature data URLs', async () => {
    const sampleLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjAwQAAA2vwP5R6/n6gAAAABJRU5ErkJggg==';

    const fullBranding = {
      clinicName: 'Sarayu High-Risk Maternity Centre',
      clinicTagline: 'Excellence in Fetal Medicine and Birthing Care',
      address: '104 Healthcare Boulevard, Belagavi, Karnataka',
      phone: '+91 98765 43210',
      email: 'care@sarayuhospital.com',
      website: 'www.sarayuhospital.com',
      doctorName: 'Dr. Sarayu Rao',
      doctorQualifications: 'MBBS, MD, FICOG',
      registrationNo: 'KMC-88129',
      headerLayout: 'modern',
      footerText: 'Valid for 30 days. Emergency 24/7 labor room helpline: +91 98765 00000',
      showLogoOnPrint: '1',
      showSignatureOnPrint: '1',
      preprintedStationery: '1',
      topMarginMm: '45',
      stampText: 'OFFICIALLY VERIFIED & DIGITALLY SIGNED',
      logoDataUrl: sampleLogo,
      signatureDataUrl: sampleSignature,
    };

    const putRes = await call('PUT', '/api/settings', doctor, fullBranding);
    expect(putRes.status).toBe(200);

    const getRes = await call('GET', '/api/settings', doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject(fullBranding);
  });

  it('records settings.update audit log and sanitizes large image data in audit detail', async () => {
    const bigLogo = 'data:image/png;base64,' + 'A'.repeat(500);
    const bigSignature = 'data:image/png;base64,' + 'B'.repeat(500);

    await call('PUT', '/api/settings', doctor, {
      clinicName: 'Audit Verified Clinic',
      logoDataUrl: bigLogo,
      signatureDataUrl: bigSignature,
    });

    const auditRow = db.prepare(
      "SELECT * FROM audit_events WHERE action = 'settings.update' ORDER BY id DESC LIMIT 1"
    ).get() as any;

    expect(auditRow).toBeDefined();
    expect(auditRow.entity).toBe('settings');

    const detail = JSON.parse(auditRow.detail);
    expect(detail.clinicName).toBe('Audit Verified Clinic');
    // Sanitized to avoid massive string bloat in audit logs
    expect(detail.logoDataUrl).toBe('[image data attached]');
    expect(detail.signatureDataUrl).toBe('[signature data attached]');
  });
});
