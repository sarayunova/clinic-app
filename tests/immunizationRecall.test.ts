import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  evaluatePatientVaccines,
  generateReminderText,
  buildWhatsAppLink,
  generateEmergencyPassportPayload,
} from '../web/src/immunizationRecallEngine.js';

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

describe('Immunization Recall & Emergency Passport Engine', () => {
  it('correctly evaluates pediatric age milestones and flags due and overdue vaccines', () => {
    // 10-week-old infant who received only birth doses
    const tenWeeksAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const evalResult = evaluatePatientVaccines(tenWeeksAgo, ['bcg', 'opv_0', 'hepb_0']);

    expect(evalResult.completedCount).toBe(3);
    expect(evalResult.ageWeeks).toBeGreaterThanOrEqual(9);

    // 6-week vaccines (penta_1, ipv_1, rota_1, pcv_1) should be flagged overdue or due now
    const allPendingCodes = [
      ...evalResult.overdue.map((i) => i.vaccine.code),
      ...evalResult.dueNow.map((i) => i.vaccine.code),
    ];
    expect(allPendingCodes).toContain('penta_1');
    expect(allPendingCodes).toContain('penta_2');
  });

  it('generates bilingual (English & Hindi) reminder templates for immunization and antenatal care', () => {
    const enText = generateReminderText({
      patientName: 'Aarav Patel',
      parentName: 'Ramesh Patel',
      clinicName: 'LiVi Clinic',
      phone: '+91 98765 43210',
      doctorName: 'Dr. Vidya',
      itemsDue: ['MMR 1', 'PCV Booster'],
      dueDateFormatted: 'Immediately',
      language: 'english',
      reminderType: 'immunization',
    });
    expect(enText).toContain('Parent of Aarav Patel');
    expect(enText).toContain('MMR 1, PCV Booster');
    expect(enText).toContain('LiVi Clinic');

    const hiText = generateReminderText({
      patientName: 'Aarav Patel',
      parentName: 'Ramesh Patel',
      clinicName: 'LiVi Clinic',
      phone: '+91 98765 43210',
      doctorName: 'Dr. Vidya',
      itemsDue: ['MMR 1'],
      dueDateFormatted: 'शीघ्र',
      language: 'hindi',
      reminderType: 'immunization',
    });
    expect(hiText).toContain('नमस्ते Parent of Aarav Patel');
    expect(hiText).toContain('टीकाकरण अनुस्मारक');
    expect(hiText).toContain('MMR 1');
  });

  it('builds direct Click-to-Chat WhatsApp URLs with country code formatting', () => {
    // 10-digit Indian mobile
    const link1 = buildWhatsAppLink('9845011005', 'Hello Aarav');
    expect(link1).toContain('https://wa.me/919845011005?text=Hello%20Aarav');

    // Number with formatting characters (+91 98450-11005)
    const link2 = buildWhatsAppLink('+91 98450-11005', 'Test message');
    expect(link2).toContain('https://wa.me/919845011005?text=Test%20message');
  });

  it('generates digital emergency passport compact JSON payload', () => {
    const payload = generateEmergencyPassportPayload({
      patientId: 101,
      fullName: 'Anita Sharma',
      ageYears: 28,
      bloodGroup: 'B+',
      allergies: 'Penicillin (Anaphylaxis)',
      obstetricSummary: 'G2P1 EDD: 2026-12-15',
      highRiskConditions: ['Gestational Diabetes', 'Previous LSCS'],
      edd: '2026-12-15',
      emergencyContact: 'Rajesh Sharma: 9845011001',
      hospitalName: 'LiVi Maternity Hospital',
      hospitalHelpline: '+91 98765 43210',
    });

    const parsed = JSON.parse(payload);
    expect(parsed.app).toBe('LiVi-Clinic-Emergency-Passport');
    expect(parsed.id).toBe(101);
    expect(parsed.name).toBe('Anita Sharma');
    expect(parsed.bg).toBe('B+');
    expect(parsed.al).toContain('Penicillin');
    expect(parsed.risk).toContain('Gestational Diabetes');
  });
});

describe('Immunization Recall & Communication Dispatch Endpoints', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatrician',
      fullName: 'Dr. Vidya Pediatrician',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.comm',
      fullName: 'Nurse Priya',
      role: 'nurse',
      password: 'temp-pass-nurse-comm',
    });
    const nurseFirst = await login('nurse.comm', 'temp-pass-nurse-comm');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-comm',
      newPassword: PW,
    });
    nurse = await login('nurse.comm');

    // Create 1-year-old child patient
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav',
      phone: '9845011005',
      dateOfBirth: oneYearAgo,
      address: 'Indiranagar Bangalore',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;

    // Seed given birth & 6-week vaccines
    db.prepare(`
      INSERT INTO patient_vaccinations (patient_id, vaccine_key, vaccine_name, milestone_group, target_disease, status, given_date, updated_by, updated_at)
      VALUES (?, 'bcg', 'BCG', 'birth', 'Tuberculosis', 'given', '2025-11-05', 1, '2025-11-05T00:00:00Z'),
             (?, 'opv_0', 'OPV 0', 'birth', 'Polio', 'given', '2025-11-05', 1, '2025-11-05T00:00:00Z'),
             (?, 'penta_1', 'Pentavalent 1', '6_weeks', 'DTP-HepB-Hib', 'given', '2025-12-15', 1, '2025-12-15T00:00:00Z')
    `).run(patientId, patientId, patientId);
  });

  it('scans and queries immunization recall list via GET /api/immunization/recall-list', async () => {
    const res = await call('GET', '/api/immunization/recall-list', nurse);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const match = res.body.find((item: any) => item.patientId === patientId);
    expect(match).toBeDefined();
    expect(match.fullName).toBe('Master Aarav');
    expect(match.overdue.length).toBeGreaterThan(0);
    expect(match.englishReminderText).toContain('Master Aarav');
    expect(match.englishWhatsAppLink).toContain('https://wa.me/919845011005');
  });

  it('gets patient immunization status via GET /api/patients/:patientId/immunization-status', async () => {
    const res = await call('GET', `/api/patients/${patientId}/immunization-status`, doctor);
    expect(res.status).toBe(200);
    expect(res.body.hasDob).toBe(true);
    expect(res.body.evaluation.completedCount).toBe(3);
    expect(res.body.englishWhatsAppLink).toContain('https://wa.me/919845011005');
  });

  it('logs WhatsApp dispatch and audits event via POST /api/communication/dispatch-whatsapp', async () => {
    const res = await call('POST', '/api/communication/dispatch-whatsapp', nurse, {
      patientId,
      recipientPhone: '9845011005',
      triggerEvent: 'immunization_due',
      language: 'english',
      messageBody: 'Hello, your infant is due for MMR vaccination at LiVi Clinic.',
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.dispatchId).toBeTypeOf('number');

    // Verify audit log
    const auditEvent = db
      .prepare("SELECT * FROM audit_events WHERE action = 'communication.whatsapp_dispatch'")
      .get() as any;
    expect(auditEvent).toBeDefined();

    // Verify communication logs endpoint
    const logsRes = await call('GET', `/api/patients/${patientId}/communication-logs`, doctor);
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.length).toBe(1);
    expect(logsRes.body[0].recipientPhone).toBe('9845011005');
  });

  it('generates emergency passport bundle and audits QR card print', async () => {
    // 1. Get emergency passport bundle
    const passportRes = await call('GET', `/api/patients/${patientId}/emergency-passport`, doctor);
    expect(passportRes.status).toBe(200);
    expect(passportRes.body.passportData.patientId).toBe(patientId);
    expect(passportRes.body.qrPayload).toContain('LiVi-Clinic-Emergency-Passport');

    // 2. Audit QR card print
    const auditPrintRes = await call('POST', '/api/communication/audit-qr-card', nurse, {
      patientId,
    });
    expect(auditPrintRes.status).toBe(200);

    const auditEvent = db
      .prepare("SELECT * FROM audit_events WHERE action = 'communication.qr_passport_print'")
      .get() as any;
    expect(auditEvent).toBeDefined();
    expect(Number(auditEvent.entity_id)).toBe(patientId);
  });
});
