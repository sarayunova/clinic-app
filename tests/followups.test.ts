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
let patientId: number;

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
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
  patientId = (await call('POST', '/api/patients', desk, { fullName: 'Sunita Devi', phone: '9876543210' })).body.patient.id;
});

describe('Follow-up appointment integration & recall list', () => {
  it('tracks advised follow-ups and links newly booked appointments', async () => {
    // 1. Check in patient and start consultation
    const appt = (await call('POST', '/api/appointments', desk, { patientId, date: '2026-11-10', time: '10:00', reason: 'Routine antenatal' })).body;
    await call('PATCH', `/api/appointments/${appt.id}/status`, desk, { status: 'waiting', version: appt.version });
    const visitRes = await call('POST', '/api/visits', doctor, { patientId, appointmentId: appt.id });
    const visitId = visitRes.body.id;

    // 2. Doctor writes notes, sets follow-up date to 2026-11-24, and finalises
    await call('PATCH', `/api/visits/${visitId}`, doctor, {
      version: 1,
      assessment: 'Normal singleton pregnancy at 28 weeks',
      followUpDate: '2026-11-24',
    });
    await call('POST', `/api/visits/${visitId}/finalise`, doctor, { version: 2 });

    // 3. Visit presentation includes follow-up date and no appointment yet
    const v = (await call('GET', `/api/visits/${visitId}`, doctor)).body;
    expect(v.followUpDate).toBe('2026-11-24');
    expect(v.followUpAppointment).toBeNull();

    // 4. Recall list shows patient as pending follow-up
    const listPending = (await call('GET', '/api/appointments/follow-ups?from=2026-11-20&to=2026-11-30&status=pending', desk)).body;
    expect(listPending).toHaveLength(1);
    expect(listPending[0].patientName).toBe('Sunita Devi');
    expect(listPending[0].followUpDate).toBe('2026-11-24');
    expect(listPending[0].appointmentId).toBeNull();
    // Clinical assessment is hidden from reception
    expect(listPending[0].assessment).toBeUndefined();

    // Doctor sees clinical assessment
    const docList = (await call('GET', '/api/appointments/follow-ups?from=2026-11-20&to=2026-11-30&status=pending', doctor)).body;
    expect(docList[0].assessment).toBe('Normal singleton pregnancy at 28 weeks');

    // 5. Book follow-up appointment for 2026-11-24
    await call('POST', '/api/appointments', desk, {
      patientId,
      date: '2026-11-24',
      time: '11:00',
      reason: 'Follow-up consultation',
    });

    // 6. Visit presentation now shows the linked follow-up appointment
    const vUpdated = (await call('GET', `/api/visits/${visitId}`, doctor)).body;
    expect(vUpdated.followUpAppointment).not.toBeNull();
    expect(vUpdated.followUpAppointment.scheduledDate).toBe('2026-11-24');
    expect(vUpdated.followUpAppointment.scheduledTime).toBe('11:00');

    // 7. Patient is resolved from pending recall list
    const listPendingAfter = (await call('GET', '/api/appointments/follow-ups?from=2026-11-20&to=2026-11-30&status=pending', desk)).body;
    expect(listPendingAfter).toHaveLength(0);

    // Shows under booked
    const listBooked = (await call('GET', '/api/appointments/follow-ups?from=2026-11-20&to=2026-11-30&status=booked', desk)).body;
    expect(listBooked).toHaveLength(1);
    expect(listBooked[0].appointmentId).not.toBeNull();
    expect(listBooked[0].appointmentDate).toBe('2026-11-24');
  });

  it('correctly marks past pending follow-ups as overdue', async () => {
    // Direct visit creation with past visit date
    const vRes = await call('POST', '/api/visits', doctor, { patientId });
    const visitId = vRes.body.id;
    db.prepare('UPDATE visits SET visit_at = ? WHERE id = ?').run('2026-10-25T10:00:00.000Z', visitId);
    await call('PATCH', `/api/visits/${visitId}`, doctor, {
      version: 1,
      complaints: 'Mild fever',
      followUpDate: '2026-11-01',
    });
    await call('POST', `/api/visits/${visitId}/finalise`, doctor, { version: 2 });

    const overdueList = (await call('GET', '/api/appointments/follow-ups?from=2026-10-25&to=2026-11-10&status=pending', desk)).body;
    expect(overdueList).toHaveLength(1);
    expect(overdueList[0].isOverdue).toBe(true);
  });
});
