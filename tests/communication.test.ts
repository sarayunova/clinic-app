import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  cleanPhoneNumber,
  buildWhatsAppUrl,
  buildSmsUrl,
  formatAppointmentReminderMessage,
  formatAntenatalRecallMessage,
  formatPrescriptionMessage,
  formatVaccineReminderMessage,
  formatCustomMessage,
} from '../web/src/communicationUtils.js';

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

  patientId = (await call('POST', '/api/patients', desk, {
    fullName: 'Ananya Sharma',
    phone: '9876543210',
  })).body.patient.id;
});

describe('communication log route', () => {
  it('blocks unauthenticated requests', async () => {
    const res = await call('POST', '/api/communication/log', undefined, {
      patientId,
      channel: 'whatsapp',
      messageType: 'appointment_reminder',
      recipientPhone: '919876543210',
    });
    expect(res.status).toBe(401);
  });

  it('validates request payload schema', async () => {
    // Missing required fields
    const res1 = await call('POST', '/api/communication/log', desk, {
      patientId,
    });
    expect(res1.status).toBe(400);

    // Invalid channel
    const res2 = await call('POST', '/api/communication/log', desk, {
      patientId,
      channel: 'telegram',
      messageType: 'appointment_reminder',
      recipientPhone: '919876543210',
    });
    expect(res2.status).toBe(400);

    // Invalid phone
    const res3 = await call('POST', '/api/communication/log', desk, {
      patientId,
      channel: 'sms',
      messageType: 'appointment_reminder',
      recipientPhone: '1',
    });
    expect(res3.status).toBe(400);
  });

  it('returns 404 for non-existent patient', async () => {
    const res = await call('POST', '/api/communication/log', desk, {
      patientId: 99999,
      channel: 'whatsapp',
      messageType: 'appointment_reminder',
      recipientPhone: '919876543210',
    });
    expect(res.status).toBe(404);
  });

  it('allows desk staff, nurses, and doctors to log patient communication and audits accurately', async () => {
    // Desk staff sends appointment reminder via WhatsApp
    const r1 = await call('POST', '/api/communication/log', desk, {
      patientId,
      channel: 'whatsapp',
      messageType: 'appointment_reminder',
      recipientPhone: '919876543210',
      summary: 'Appointment reminder for tomorrow',
    });
    expect(r1.status).toBe(201);
    expect(r1.body.ok).toBe(true);

    // Nurse sends vaccine recall via SMS
    const r2 = await call('POST', '/api/communication/log', nurse, {
      patientId,
      channel: 'sms',
      messageType: 'vaccination',
      recipientPhone: '919876543210',
      summary: 'OPV 1 vaccine reminder',
    });
    expect(r2.status).toBe(201);

    // Doctor shares prescription via clipboard
    const r3 = await call('POST', '/api/communication/log', doctor, {
      patientId,
      channel: 'clipboard',
      messageType: 'prescription',
      recipientPhone: '919876543210',
      summary: 'Prescription copied to clipboard',
    });
    expect(r3.status).toBe(201);

    // Verify audit events
    const auditRows = db
      .prepare(
        "SELECT action, entity, entity_id, detail FROM audit_events WHERE action = 'communication.send' ORDER BY id ASC"
      )
      .all() as { action: string; entity: string; entity_id: string; detail: string }[];

    expect(auditRows.length).toBe(3);
    expect(auditRows[0].action).toBe('communication.send');
    expect(auditRows[0].entity).toBe('patient');
    expect(auditRows[0].entity_id).toBe(String(patientId));

    const d1 = JSON.parse(auditRows[0].detail);
    expect(d1.channel).toBe('whatsapp');
    expect(d1.messageType).toBe('appointment_reminder');
    expect(d1.recipientPhone).toBe('919876543210');
    expect(d1.summary).toBe('Appointment reminder for tomorrow');

    const d2 = JSON.parse(auditRows[1].detail);
    expect(d2.channel).toBe('sms');
    expect(d2.messageType).toBe('vaccination');

    const d3 = JSON.parse(auditRows[2].detail);
    expect(d3.channel).toBe('clipboard');
    expect(d3.messageType).toBe('prescription');
  });
});

describe('communicationUtils', () => {
  describe('cleanPhoneNumber', () => {
    it('normalises 10-digit Indian numbers with country prefix 91', () => {
      expect(cleanPhoneNumber('9876543210')).toBe('919876543210');
      expect(cleanPhoneNumber(' 98765 43210 ')).toBe('919876543210');
      expect(cleanPhoneNumber('98765-43210')).toBe('919876543210');
    });

    it('strips leading 0 and attaches country prefix', () => {
      expect(cleanPhoneNumber('09876543210')).toBe('919876543210');
    });

    it('preserves existing international prefix +91', () => {
      expect(cleanPhoneNumber('+91 98765 43210')).toBe('919876543210');
      expect(cleanPhoneNumber('+91-9876543210')).toBe('919876543210');
    });

    it('handles empty or malformed input safely', () => {
      expect(cleanPhoneNumber('')).toBe('');
      expect(cleanPhoneNumber('abc')).toBe('');
    });
  });

  describe('deep links', () => {
    it('builds wa.me URL correctly', () => {
      const url = buildWhatsAppUrl('9876543210', 'Hello *Dr Rao* & Team');
      expect(url).toBe('https://wa.me/919876543210?text=Hello%20*Dr%20Rao*%20%26%20Team');
    });

    it('builds sms: URI correctly', () => {
      const uri = buildSmsUrl('+91 98765 43210', 'Your appointment is confirmed');
      expect(uri).toBe('sms:919876543210?body=Your%20appointment%20is%20confirmed');
    });
  });

  describe('message templates', () => {
    it('formats appointment reminder', () => {
      const msg = formatAppointmentReminderMessage({
        clinicName: 'Lifecare Clinic',
        doctorName: 'Dr. Rao',
        patientName: 'Pooja Patil',
        appointmentDate: '2026-11-10',
        appointmentTime: '10:30 AM',
        tokenNumber: 5,
        clinicPhone: '022-25001122',
      });
      expect(msg).toContain('Lifecare Clinic');
      expect(msg).toContain('Dr. Rao');
      expect(msg).toContain('Pooja Patil');
      expect(msg).toContain('2026-11-10');
      expect(msg).toContain('10:30 AM');
      expect(msg).toContain('#5');
      expect(msg).toContain('022-25001122');
    });

    it('formats antenatal recall message', () => {
      const msg = formatAntenatalRecallMessage({
        clinicName: 'Lifecare Maternity',
        doctorName: 'Dr. Rao',
        patientName: 'Sunita Mehra',
        nextVisitDate: '2026-11-15',
        gestationalAge: '28 weeks 3 days',
        edd: '2027-02-04',
        customNote: 'Repeat haemoglobin and ultrasound growth scan',
      });
      expect(msg).toContain('Sunita Mehra');
      expect(msg).toContain('28 weeks 3 days');
      expect(msg).toContain('2027-02-04');
      expect(msg).toContain('Repeat haemoglobin');
      expect(msg).toContain('ANC / Mother-Child card');
    });

    it('formats prescription summary message', () => {
      const msg = formatPrescriptionMessage({
        clinicName: 'Lifecare Clinic',
        doctorName: 'Dr. Rao',
        patientName: 'Rajesh Kumar',
        visitDate: '2026-11-06',
        items: [
          { name: 'Paracetamol', dose: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After food' },
          { name: 'Cetirizine', dose: '10mg', frequency: '0-0-1', duration: '5 days', instructions: 'At bedtime' },
        ],
        generalAdvice: 'Drink plenty of warm fluids and rest well.',
        followUpDate: '2026-11-13',
      });
      expect(msg).toContain('Rajesh Kumar');
      expect(msg).toContain('1. Paracetamol 650mg (1-0-1) for 3 days - After food');
      expect(msg).toContain('2. Cetirizine 10mg (0-0-1) for 5 days - At bedtime');
      expect(msg).toContain('Drink plenty of warm fluids');
      expect(msg).toContain('2026-11-13');
    });

    it('formats vaccine reminder message', () => {
      const msg = formatVaccineReminderMessage({
        clinicName: 'Lifecare Pediatric Care',
        childName: 'Aarav',
        parentName: 'Priya Sharma',
        vaccineName: 'Pentavalent 1 & Rotavirus 1',
        dueAge: '6 Weeks',
        dueDate: '2026-11-20',
        clinicPhone: '022-25001122',
      });
      expect(msg).toContain('Priya Sharma');
      expect(msg).toContain('Aarav');
      expect(msg).toContain('Pentavalent 1 & Rotavirus 1');
      expect(msg).toContain('6 Weeks');
      expect(msg).toContain('2026-11-20');
      expect(msg).toContain('Immunization Card');
    });

    it('formats custom message', () => {
      const msg = formatCustomMessage({
        clinicName: 'Lifecare Clinic',
        patientName: 'Devika',
        text: 'Your blood test report is ready for collection at the front desk.',
        clinicPhone: '022-25001122',
      });
      expect(msg).toContain('Devika');
      expect(msg).toContain('blood test report is ready');
      expect(msg).toContain('022-25001122');
    });
  });
});
