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

describe('Teleconsultations & E-Prescription Gateway REST API', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.teleconsult',
      fullName: 'Dr. Anita Consultant',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.tele',
      fullName: 'Nurse Kavita Tele',
      role: 'nurse',
      password: 'temp-pass-nurse-tele',
    });
    const nurseFirst = await login('nurse.tele', 'temp-pass-nurse-tele');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-tele',
      newPassword: PW,
    });
    nurse = await login('nurse.tele');

    // Desk setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.tele',
      fullName: 'Desk Tele Staff',
      role: 'attender',
      password: 'temp-pass-desk-tele',
    });
    const deskFirst = await login('desk.tele', 'temp-pass-desk-tele');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-tele',
      newPassword: PW,
    });
    desk = await login('desk.tele');

    // Patient
    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Rupali Deshmukh',
      dateOfBirth: '1992-07-18',
      estimatedAgeYears: 32,
      phone: '9820012345',
      address: 'Pune, Maharashtra',
      gravida: 1,
      para: 0,
      lastMenstrualPeriod: '2026-03-01',
    });
    patientId = p.body.patient.id;
  });

  it('schedules teleconsultation with automated room links and enforces RBAC', async () => {
    // Desk attender forbidden
    const deskTry = await call('POST', '/api/teleconsultations', desk, {
      patientId,
      doctorId: 1,
      scheduledAt: '2026-11-08T15:00:00Z',
      chiefComplaint: 'Follow-up for thyroid profile',
    });
    expect(deskTry.status).toBe(403);

    // Nurse schedules teleconsultation
    const createRes = await call('POST', '/api/teleconsultations', nurse, {
      patientId,
      doctorId: 1,
      scheduledAt: '2026-11-08T15:00:00Z',
      consultType: 'FOLLOW_UP',
      videoPlatform: 'JITSI',
      chiefComplaint: 'Gestational hypothyroidism review, TSH report',
      telemedicineConsentObtained: true,
      emergencyDisclaimerAcknowledged: true,
    });
    expect(createRes.status).toBe(200);
    expect(createRes.body.meeting_link).toContain('https://meet.jit.si/livi-tele-');
    expect(createRes.body.status).toBe('SCHEDULED');

    const teleId = createRes.body.id;

    // List teleconsultations
    const listRes = await call('GET', '/api/teleconsultations', nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.teleconsultations.length).toBe(1);
    expect(listRes.body.teleconsultations[0].patient_name).toBe('Rupali Deshmukh');

    // Dispatch WhatsApp invitation
    const waRes = await call('POST', `/api/teleconsultations/${teleId}/whatsapp-invite`, nurse);
    expect(waRes.status).toBe(200);
    expect(waRes.body.whatsappUrl).toContain('wa.me/919820012345');
    expect(waRes.body.messageText).toContain('Namaste Rupali Deshmukh');
    expect(waRes.body.messageText).toContain('नमस्ते Rupali Deshmukh');
  });

  it('updates consultation details, cryptographically signs prescription, and blocks non-doctors from signing', async () => {
    // Doctor schedules teleconsultation
    const createRes = await call('POST', '/api/teleconsultations', doctor, {
      patientId,
      doctorId: 1,
      scheduledAt: '2026-11-08T16:00:00Z',
      consultType: 'REPORT_REVIEW',
      videoPlatform: 'WHATSAPP_VIDEO',
      chiefComplaint: 'OGTT 75g screening review',
      provisionalDiagnosis: 'Gestational Diabetes Mellitus (Controlled on MNT)',
      prescriptionMedicines: [
        { name: 'Cap Calcium & Vit D3', dosage: '500mg', frequency: 'Once daily', duration: '30 days' },
        { name: 'Tab Iron & Folic Acid', dosage: '100mg elemental iron', frequency: 'Once daily after dinner', duration: '30 days' },
      ],
      adviceInstructions: 'Continue Medical Nutrition Therapy (MNT). Walk 15 min after each meal.',
    });
    expect(createRes.status).toBe(200);
    const teleId = createRes.body.id;

    // Nurse attempts to sign -> forbidden (doctor only)
    const nurseSign = await call('POST', `/api/teleconsultations/${teleId}/sign`, nurse);
    expect(nurseSign.status).toBe(403);

    // Doctor signs -> success
    const docSign = await call('POST', `/api/teleconsultations/${teleId}/sign`, doctor);
    expect(docSign.status).toBe(200);
    expect(docSign.body.status).toBe('COMPLETED');
    expect(docSign.body.digital_signature_hash).toBeDefined();
    expect(docSign.body.digital_signature_hash.length).toBe(64); // SHA-256 hex is 64 chars
    expect(docSign.body.signed_by_doctor_name).toBe('Dr. Anita Consultant');
    expect(docSign.body.signed_at).toBeDefined();

    // Print audit
    const printRes = await call('POST', `/api/teleconsultations/${teleId}/audit-print`, doctor);
    expect(printRes.status).toBe(200);

    // Delete teleconsultation (doctor only)
    const delRes = await call('DELETE', `/api/teleconsultations/${teleId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
