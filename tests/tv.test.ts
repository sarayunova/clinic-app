import { describe, expect, it, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { maskPatientName, type TvQueueResponse } from '../server/routes/tv.js';

let db: DB;
let app: FastifyInstance;
let doctor: string;
let desk: string;

const PW = 'password-12345';
type Json = Record<string, unknown> & { id: number; version?: number };

async function call(method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return {
    status: res.statusCode,
    body: (res.body ? JSON.parse(res.body) : null) as any,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}

async function staff(username: string, role: string) {
  await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username, password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  return (await call('POST', '/api/auth/login', undefined, { username, password: PW })).setCookie!.split(';')[0]!;
}

const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  desk = await staff('desk1', 'attender');
});

describe('Privacy-safe patient name masking', () => {
  it('masks names to First Name + Last Initial', () => {
    expect(maskPatientName('Asha Verma')).toBe('Asha V.');
    expect(maskPatientName('Meera S. Iyer')).toBe('Meera I.');
    expect(maskPatientName('John Michael Smith')).toBe('John S.');
  });

  it('strips common clinical honorifics and titles', () => {
    expect(maskPatientName('Dr. Anita Sharma')).toBe('Anita S.');
    expect(maskPatientName('Mr. Rajesh Kumar')).toBe('Rajesh K.');
    expect(maskPatientName('Mrs. Sunita Patel')).toBe('Sunita P.');
    expect(maskPatientName('Ms. Priya Nair')).toBe('Priya N.');
  });

  it('handles single names and edge cases gracefully', () => {
    expect(maskPatientName('Kavitha')).toBe('Kavitha');
    expect(maskPatientName('')).toBe('Patient');
    expect(maskPatientName('   ')).toBe('Patient');
  });
});

describe('Waiting Room Queue TV Display API (/api/tv/queue)', () => {
  it('is accessible without authentication and returns empty queue when no appointments', async () => {
    const res = await call('GET', '/api/tv/queue');
    expect(res.status).toBe(200);
    const data = res.body as TvQueueResponse;
    expect(data.current).toEqual([]);
    expect(data.next).toEqual([]);
    expect(data.waiting).toEqual([]);
    expect(data.scheduled).toEqual([]);
    expect(data.completedCount).toBe(0);
    expect(data.totalToday).toBe(0);
  });

  it('correctly tracks tokens, stages patients (Current, Next, Waiting), and preserves privacy', async () => {
    // 1. Configure clinic name
    await call('PUT', '/api/settings', doctor, { clinicName: 'Matruchhaya Maternity Clinic', doctorName: 'Dr. Rao' });

    // 2. Register patients
    const p1 = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma', phone: '9876543210' })).body.patient;
    const p2 = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer', phone: '9876543211' })).body.patient;
    const p3 = (await call('POST', '/api/patients', desk, { fullName: 'Sunita Patil', phone: '9876543212' })).body.patient;
    const p4 = (await call('POST', '/api/patients', desk, { fullName: 'Kavitha Rao', phone: '9876543213' })).body.patient;

    // 3. Book 4 appointments for today
    const d = today();
    const a1 = (await call('POST', '/api/appointments', desk, { patientId: p1.id, date: d, time: '10:00', reason: 'Antenatal Checkup' })).body;
    const a2 = (await call('POST', '/api/appointments', desk, { patientId: p2.id, date: d, time: '10:15', reason: 'Blood pressure review' })).body;
    const a3 = (await call('POST', '/api/appointments', desk, { patientId: p3.id, date: d, time: '10:30', reason: 'Fever' })).body;
    const a4 = (await call('POST', '/api/appointments', desk, { patientId: p4.id, date: d, time: '10:45', reason: 'Routine consultation' })).body;

    // 4. Update statuses:
    // a1 -> waiting -> in_consultation
    await call('PATCH', `/api/appointments/${a1.id}/status`, desk, { status: 'waiting', version: a1.version });
    await call('PATCH', `/api/appointments/${a1.id}/status`, doctor, { status: 'in_consultation', version: a1.version + 1 });

    // a2 -> waiting
    await call('PATCH', `/api/appointments/${a2.id}/status`, desk, { status: 'waiting', version: a2.version });

    // a3 -> waiting
    await call('PATCH', `/api/appointments/${a3.id}/status`, desk, { status: 'waiting', version: a3.version });

    // a4 stays 'scheduled' (hasn't arrived yet)

    // 5. Query /api/tv/queue without login credentials
    const tvRes = await call('GET', '/api/tv/queue');
    expect(tvRes.status).toBe(200);
    const data = tvRes.body as TvQueueResponse;

    expect(data.clinicName).toBe('Matruchhaya Maternity Clinic');
    expect(data.doctorName).toBe('Dr. Rao');
    expect(data.totalToday).toBe(4);

    // Current: a1 (Token #1, Asha V.)
    expect(data.current).toHaveLength(1);
    expect(data.current[0]).toMatchObject({
      tokenNumber: 1,
      displayName: 'Asha V.',
      status: 'in_consultation',
      scheduledTime: '10:00',
    });
    // Ensure privacy: no phone number, no reason for visit, no full address
    expect((data.current[0] as any).patientPhone).toBeUndefined();
    expect((data.current[0] as any).reason).toBeUndefined();

    // Next in line: a2 and a3
    expect(data.next).toHaveLength(2);
    expect(data.next[0]).toMatchObject({ tokenNumber: 2, displayName: 'Meera I.', status: 'waiting' });
    expect(data.next[1]).toMatchObject({ tokenNumber: 3, displayName: 'Sunita P.', status: 'waiting' });

    // Remaining waiting queue: empty because next took the 2 waiting patients
    expect(data.waiting).toHaveLength(0);

    // Scheduled: a4 (Token #4, Kavitha R.)
    expect(data.scheduled).toHaveLength(1);
    expect(data.scheduled[0]).toMatchObject({ tokenNumber: 4, displayName: 'Kavitha R.', status: 'scheduled' });
  });

  it('updates completed count when patient finishes consultation', async () => {
    const p1 = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient;
    const a1 = (await call('POST', '/api/appointments', desk, { patientId: p1.id, date: today(), time: '09:00', reason: 'Checkup' })).body;

    await call('PATCH', `/api/appointments/${a1.id}/status`, desk, { status: 'waiting', version: a1.version });
    await call('PATCH', `/api/appointments/${a1.id}/status`, doctor, { status: 'in_consultation', version: a1.version + 1 });
    await call('PATCH', `/api/appointments/${a1.id}/status`, doctor, { status: 'completed', version: a1.version + 2 });

    const tvRes = await call('GET', '/api/tv/queue');
    const data = tvRes.body as TvQueueResponse;
    expect(data.current).toHaveLength(0);
    expect(data.completedCount).toBe(1);
  });
});
