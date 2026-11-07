import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  lookupBroselowZone,
  calculatePews,
} from '../web/src/palsEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, attender: string;
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

// -------------------------------------------------------------
// Pure Calculation Clinical Engine Tests
// -------------------------------------------------------------
describe('Pediatric PALS, PEWS & Broselow Emergency Tape Engine (Pure Unit Tests)', () => {
  it('correctly maps lengths and weights to standard Broselow color zones and resuscitation specs', () => {
    // 1. Infant length 55 cm -> Grey Zone (3-5 kg)
    const grey = lookupBroselowZone({ lengthCm: 55 });
    expect(grey.color).toBe('grey');
    expect(grey.midWeightKg).toBe(4);
    expect(grey.ettCuffedSize).toBe(3.0);
    expect(grey.defibInitialJoules).toBe(8); // 2 J/kg * 4 kg
    expect(grey.defibSubsequentJoules).toBe(16); // 4 J/kg * 4 kg
    expect(grey.epinephrineIvDoseMl).toBe(0.4); // 0.1 mL/kg * 4 kg

    // 2. Toddler length 95 cm -> Yellow Zone (12-14 kg)
    const yellow = lookupBroselowZone({ lengthCm: 95 });
    expect(yellow.color).toBe('yellow');
    expect(yellow.midWeightKg).toBe(13);
    expect(yellow.ettCuffedSize).toBe(4.5);
    expect(yellow.ettDepthLipCm).toBe(13.5);
    expect(yellow.defibInitialJoules).toBe(26);
    expect(yellow.epinephrineIvDoseMl).toBe(1.3);

    // 3. Child weight 21 kg -> Blue Zone (19-23 kg)
    const blue = lookupBroselowZone({ weightKg: 21 });
    expect(blue.color).toBe('blue');
    expect(blue.midWeightKg).toBe(21);
    expect(blue.ettCuffedSize).toBe(5.5);
    expect(blue.fluidBolusMl).toBe(420); // 20 mL/kg * 21 kg

    // 4. Older child weight 33 kg -> Green Zone (30-36 kg)
    const green = lookupBroselowZone({ weightKg: 33 });
    expect(green.color).toBe('green');
    expect(green.midWeightKg).toBe(33);
    expect(green.ettCuffedSize).toBe(6.5);
    expect(green.defibInitialJoules).toBe(66);
    expect(green.epinephrineIvDoseMl).toBe(3.3);
  });

  it('accurately calculates Monaghan PEWS score, risk tiers and escalation mandates', () => {
    // 1. Low Risk (Score 0)
    const low = calculatePews({
      behaviorScore: 0,
      cardiovascularScore: 0,
      respiratoryScore: 0,
    });
    expect(low.totalScore).toBe(0);
    expect(low.riskLevel).toBe('low_0_2');
    expect(low.escalationRequired).toBe(false);

    // 2. Moderate Risk (Score 3)
    const moderate = calculatePews({
      behaviorScore: 1,
      cardiovascularScore: 1,
      respiratoryScore: 1,
    });
    expect(moderate.totalScore).toBe(3);
    expect(moderate.riskLevel).toBe('moderate_3_4');
    expect(moderate.escalationRequired).toBe(true);
    expect(moderate.clinicalActions.some(a => a.includes('Notify charge nurse'))).toBe(true);

    // 3. Critical Risk (Score 6) with post-op vomiting
    const critical = calculatePews({
      behaviorScore: 2,
      cardiovascularScore: 2,
      respiratoryScore: 1,
      persistentVomitingPostOp: true, // +1
    });
    expect(critical.totalScore).toBe(6);
    expect(critical.riskLevel).toBe('critical_5_plus');
    expect(critical.escalationRequired).toBe(true);
    expect(critical.clinicalActions.some(a => a.includes('ACTIVATE PEDIATRIC RAPID RESPONSE TEAM'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric PALS & PEWS Emergency REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pals',
      fullName: 'Dr. Arjun Mehta (Pediatric Intensivist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.pals',
      fullName: 'Sister Rekha PICU',
      role: 'nurse',
      password: 'temp-pass-nurse-pals',
    });
    const nurseFirst = await login('nurse.pals', 'temp-pass-nurse-pals');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-pals',
      newPassword: PW,
    });
    nurse = await login('nurse.pals', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.reception',
      fullName: 'Desk Attender',
      role: 'attender',
      password: 'temp-pass-desk-pals',
    });
    const deskFirst = await login('desk.reception', 'temp-pass-desk-pals');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-pals',
      newPassword: PW,
    });
    attender = await login('desk.reception', PW);

    // Create pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby Diya Patel',
      dateOfBirth: '2024-02-14',
      estimatedAgeYears: 2,
      phone: '9765432100',
      address: 'Indore, MP',
      gravida: null,
      para: null,
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('records PEWS observations, looks up Broselow calibrations, and logs emergency Code Blue events', async () => {
    // 1. Record Bedside PEWS Observation (Critical score = 5)
    const pewsRes = await call('POST', '/api/pals/pews', nurse, {
      patientId,
      observationDatetime: new Date().toISOString(),
      behaviorScore: 2,
      cardiovascularScore: 2,
      respiratoryScore: 1,
      persistentVomitingPostop: false,
      heartRateBpm: 165,
      respiratoryRateBpm: 48,
      crtSeconds: 4,
      spo2Percent: 91,
      temperatureCelsius: 38.6,
      fio2Percent: 40,
      clinicalNotes: 'Severe respiratory distress with intercostal retractions, lethargic.',
    });
    expect(pewsRes.status).toBe(201);
    expect(pewsRes.body.observation.total_pews_score).toBe(5);
    expect(pewsRes.body.observation.risk_level).toBe('critical_5_plus');
    expect(pewsRes.body.observation.escalation_triggered).toBe(1);

    // 2. Query PEWS observations list
    const listRes = await call('GET', `/api/pals/pews?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.observations.length).toBe(1);
    expect(listRes.body.observations[0].total_pews_score).toBe(5);

    // 3. Query Broselow calibration lookup
    const lookupRes = await call('GET', '/api/pals/broselow?lengthCm=80', doctor);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.zone.color).toBe('purple');
    expect(lookupRes.body.zone.midWeightKg).toBe(10.5);

    // 4. Record Emergency Code Blue Resuscitation Event (Cardiac arrest with ROSC)
    const eventRes = await call('POST', '/api/pals/broselow-events', doctor, {
      patientId,
      eventDatetime: new Date().toISOString(),
      eventType: 'cardiac_arrest_code_blue',
      measuredLengthCm: 80,
      outcome: 'rosc_achieved',
      clinicalSummary: 'Pulseless arrest. 2 CPR cycles, 1 dose Epinephrine 1.05 mL IV, ETT 4.0 cuffed. ROSC after 3 minutes.',
    });
    expect(eventRes.status).toBe(201);
    expect(eventRes.body.event.broselow_color_zone).toBe('purple');
    expect(eventRes.body.event.ett_cuffed_size).toBe(4.0);
    expect(eventRes.body.event.outcome).toBe('rosc_achieved');
    const eventId = eventRes.body.event.id;

    // 5. Retrieve single resuscitation event
    const singleEvt = await call('GET', `/api/pals/broselow-events/${eventId}`, doctor);
    expect(singleEvt.status).toBe(200);
    expect(singleEvt.body.event.event_code).toContain('CODE-');

    // 6. Test Dashboard endpoint (High risk observations list)
    const dashRes = await call('GET', '/api/pals/dashboard', doctor);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.highRiskObservations.length).toBe(1);
    expect(dashRes.body.recentEvents.length).toBe(1);

    // 7. Test audit print endpoint
    const printRes = await call('POST', `/api/pals/broselow-events/${eventId}/print`, doctor);
    expect(printRes.status).toBe(200);
    expect(printRes.body.success).toBe(true);

    // 8. RBAC check: attender cannot record PEWS or resuscitation events (403)
    const blockedPews = await call('POST', '/api/pals/pews', attender, {
      patientId,
      observationDatetime: new Date().toISOString(),
      behaviorScore: 0,
      cardiovascularScore: 0,
      respiratoryScore: 0,
      heartRateBpm: 100,
      respiratoryRateBpm: 24,
      crtSeconds: 2,
      spo2Percent: 99,
    });
    expect(blockedPews.status).toBe(403);
  });
});
