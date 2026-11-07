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

describe('ABDM Health ID & FHIR R4 Clinical Information Bridge', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.abdmlead',
      fullName: 'Dr. Sunita Patel',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.abdm',
      fullName: 'Nurse Pooja ABDM',
      role: 'nurse',
      password: 'temp-pass-nurse-abdm',
    });
    const nurseFirst = await login('nurse.abdm', 'temp-pass-nurse-abdm');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-abdm',
      newPassword: PW,
    });
    nurse = await login('nurse.abdm');

    // Desk setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.abdm',
      fullName: 'Desk Staff ABDM',
      role: 'attender',
      password: 'temp-pass-desk-abdm',
    });
    const deskFirst = await login('desk.abdm', 'temp-pass-desk-abdm');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-abdm',
      newPassword: PW,
    });
    desk = await login('desk.abdm');

    // Patient
    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Kavita Sundaram',
      dateOfBirth: '1996-09-24',
      estimatedAgeYears: 28,
      phone: '9840112345',
      address: 'Chennai, Tamil Nadu',
      gravida: 1,
      para: 0,
      lastMenstrualPeriod: '2026-01-10',
    });
    patientId = p.body.patient.id;
  });

  it('links ABHA credentials, formats 14-digit number, and enforces RBAC', async () => {
    // Desk staff forbidden
    const deskTry = await call('POST', `/api/abdm/patient/${patientId}/link`, desk, {
      abhaNumber: '14123456789012',
      abhaAddress: 'kavita.s@abdm',
    });
    expect(deskTry.status).toBe(403);

    // Nurse links ABHA credentials
    const linkRes = await call('POST', `/api/abdm/patient/${patientId}/link`, nurse, {
      abhaNumber: '14123456789012',
      abhaAddress: 'kavita.s@abdm',
      authMethod: 'AADHAAR_OTP',
      kycFullName: 'Kavita Sundaram',
    });
    expect(linkRes.status).toBe(200);
    expect(linkRes.body.abha_number).toBe('14-1234-5678-9012'); // automatically formatted
    expect(linkRes.body.abha_address).toBe('kavita.s@abdm');
    expect(linkRes.body.status).toBe('VERIFIED');

    // Get ABDM profile
    const profileRes = await call('GET', `/api/abdm/patient/${patientId}`, nurse);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.profile.abha_number).toBe('14-1234-5678-9012');
  });

  it('performs mock Aadhaar OTP auto-generation for sandbox demo', async () => {
    const mockRes = await call('POST', `/api/abdm/patient/${patientId}/mock-aadhaar-verify`, doctor);
    expect(mockRes.status).toBe(200);
    expect(mockRes.body.abha_number).toMatch(/^91-\d{4}-\d{4}-\d{4}$/);
    expect(mockRes.body.abha_address).toContain('@abdm');
    expect(mockRes.body.status).toBe('VERIFIED');
  });

  it('generates standardized FHIR R4 Bundle with Composition, Observations and SHA-256 checksum', async () => {
    // Link ABHA first
    await call('POST', `/api/abdm/patient/${patientId}/link`, doctor, {
      abhaNumber: '91-8844-2211-3355',
      abhaAddress: 'kavita.sundaram@abdm',
    });

    // Generate FHIR bundle
    const fhirRes = await call('POST', `/api/abdm/patient/${patientId}/generate-fhir`, doctor, {
      bundleType: 'AntenatalRecord',
    });
    expect(fhirRes.status).toBe(200);
    expect(fhirRes.body.bundleId).toBeDefined();
    expect(fhirRes.body.bundleHash).toBeDefined();
    expect(fhirRes.body.bundleHash.length).toBe(64);

    const fhir = fhirRes.body.fhirObject;
    expect(fhir.resourceType).toBe('Bundle');
    expect(fhir.type).toBe('document');
    expect(Array.isArray(fhir.entry)).toBe(true);
    expect(fhir.entry.length).toBeGreaterThanOrEqual(4);

    // Verify first entry is Composition
    expect(fhir.entry[0].resource.resourceType).toBe('Composition');
    // Verify Patient resource with ABHA
    const patientEntry = fhir.entry.find((e: any) => e.resource.resourceType === 'Patient');
    expect(patientEntry).toBeDefined();
    expect(patientEntry.resource.name[0].text).toBe('Kavita Sundaram');

    // Retrieve via GET
    const getBundle = await call('GET', `/api/abdm/fhir-bundle/${fhirRes.body.bundleId}`, doctor);
    expect(getBundle.status).toBe(200);
    expect(getBundle.body.bundle_type).toBe('AntenatalRecord');
  });

  it('manages ABDM consent artifacts and unlinking', async () => {
    // Create consent
    const consentRes = await call('POST', '/api/abdm/consent', nurse, {
      patientId,
      purposeCode: 'CARETREE',
      hiTypes: 'OPConsultation,DischargeSummary',
      requesterName: 'Apollo Cradle Hospital',
      requesterHipId: 'HIP-APOLLO-001',
      dateRangeFrom: '2026-01-01',
      dateRangeTo: '2026-11-07',
      expiryAt: '2026-12-31',
    });
    expect(consentRes.status).toBe(200);
    expect(consentRes.body.status).toBe('GRANTED');
    const consentId = consentRes.body.consent_id;

    // Revoke consent
    const revokeRes = await call('POST', `/api/abdm/consent/${consentId}/revoke`, nurse);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);

    // Unlink ABHA
    const unlinkRes = await call('DELETE', `/api/abdm/patient/${patientId}/unlink`, doctor);
    expect(unlinkRes.status).toBe(200);

    const afterUnlink = await call('GET', `/api/abdm/patient/${patientId}`, doctor);
    expect(afterUnlink.body.profile).toBeNull();
  });
});
