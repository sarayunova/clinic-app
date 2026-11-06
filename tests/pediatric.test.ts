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
let babyId: number;

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

  // Register baby patient born 6 weeks ago
  const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const reg = await call('POST', '/api/patients', desk, {
    fullName: 'Baby of Ananya',
    dateOfBirth: sixWeeksAgo,
  });
  expect(reg.status).toBe(201);
  babyId = reg.body.patient.id;
});

describe('Pediatric Birth Profile & Immunization Tracker API', () => {
  it('enforces role access: clinical staff read/write, desk & unauthenticated forbidden', async () => {
    // Read access
    expect((await call('GET', `/api/patients/${babyId}/pediatric`, doctor)).status).toBe(200);
    expect((await call('GET', `/api/patients/${babyId}/pediatric`, nurse)).status).toBe(200);
    expect((await call('GET', `/api/patients/${babyId}/pediatric`, desk)).status).toBe(403);
    expect((await call('GET', `/api/patients/${babyId}/pediatric`)).status).toBe(401);

    // Profile write: doctor & nurse yes, desk no
    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/profile`, nurse, {
          birthWeightKg: 3.25,
          birthLengthCm: 50,
          deliveryType: 'normal_vaginal',
        })
      ).status
    ).toBe(200);

    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/profile`, desk, {
          birthWeightKg: 3.25,
        })
      ).status
    ).toBe(403);

    // Vaccine write: doctor & nurse yes, desk no
    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/vaccinations/bcg`, nurse, {
          status: 'given',
          batchNumber: 'BCG-441',
        })
      ).status
    ).toBe(200);

    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/vaccinations/bcg`, desk, {
          status: 'given',
        })
      ).status
    ).toBe(403);
  });

  it('validates bounds on birth profile: weights, lengths, APGAR scores', async () => {
    // Unrealistic birth weight
    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/profile`, doctor, {
          birthWeightKg: 25.0,
        })
      ).status
    ).toBe(400);

    // APGAR out of 0-10 bounds
    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/profile`, doctor, {
          apgar1min: 15,
        })
      ).status
    ).toBe(400);

    // Future vaccination date
    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/vaccinations/opv_0`, doctor, {
          status: 'given',
          givenDate: '2099-01-01',
        })
      ).status
    ).toBe(400);

    // Unknown vaccine key
    expect(
      (
        await call('PATCH', `/api/patients/${babyId}/pediatric/vaccinations/unknown_vax`, doctor, {
          status: 'given',
        })
      ).status
    ).toBe(400);
  });

  it('records birth profile, calculates due dates, and tracks vaccination progress', async () => {
    // Save birth profile
    const profileRes = await call('PATCH', `/api/patients/${babyId}/pediatric/profile`, doctor, {
      birthWeightKg: 3.1,
      birthLengthCm: 49.5,
      birthHeadCircumferenceCm: 34.0,
      gestationalAgeWeeks: 39,
      deliveryType: 'normal_vaginal',
      birthHospital: 'City Maternity Centre',
      apgar1min: 8,
      apgar5min: 9,
      bloodGroup: 'B Positive',
      birthNotes: 'Cried vigorously at birth; skin-to-skin given',
    });
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.birthWeightKg).toBe(3.1);
    expect(profileRes.body.deliveryType).toBe('normal_vaginal');

    // Administer birth vaccines
    const today = localDate(new Date(), cfg.timezone);
    await call('PATCH', `/api/patients/${babyId}/pediatric/vaccinations/bcg`, nurse, {
      status: 'given',
      givenDate: today,
      batchNumber: 'BCG-2026-X',
      routeSite: 'Intradermal Left Upper Arm',
      administeredBy: 'Nurse 1',
    });

    await call('PATCH', `/api/patients/${babyId}/pediatric/vaccinations/opv_0`, nurse, {
      status: 'given',
      givenDate: today,
      batchNumber: 'OPV-009',
    });

    await call('PATCH', `/api/patients/${babyId}/pediatric/vaccinations/hepb_0`, doctor, {
      status: 'given',
      givenDate: today,
      batchNumber: 'HEP-552',
    });

    // Check full pediatric view
    const pedsRes = await call('GET', `/api/patients/${babyId}/pediatric`, doctor);
    expect(pedsRes.status).toBe(200);
    expect(pedsRes.body.profile.birthWeightKg).toBe(3.1);
    expect(pedsRes.body.ageFormatted).toContain('weeks');
    expect(pedsRes.body.summary.givenCount).toBe(3);
    expect(pedsRes.body.summary.completionPercentage).toBeGreaterThan(0);

    const bcg = pedsRes.body.vaccinations.find((v: any) => v.vaccineKey === 'bcg');
    expect(bcg.status).toBe('given');
    expect(bcg.batchNumber).toBe('BCG-2026-X');
    expect(bcg.updatedByName).toBe('nurse1');

    // Verify audit events
    const auditRes = await call('GET', `/api/audit?patientId=${babyId}&action=vaccination.record`, doctor);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.length).toBeGreaterThanOrEqual(3);
  });
});
