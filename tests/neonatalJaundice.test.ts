import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  getBhutaniPercentiles,
  classifyBhutaniRiskZone,
  determineAapRiskTier,
  evaluateNeonatalBilirubin,
  calculateBilirubinRateOfRise,
  calculateAgeInHours,
} from '../web/src/neonatalJaundiceEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string;
let babyPatientId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
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
  await call('POST', '/api/users', doctor, { username: 'desk1', fullName: 'Desk Staff', role: 'attender', password: 'temporary-pass-1' });
  const first = await login('desk1', 'temporary-pass-1');
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  desk = await login('desk1');

  babyPatientId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Baby of Kavita',
    dateOfBirth: '2024-09-10',
    phone: '9876543210',
    gravida: 0,
    para: 0,
    living: 0,
    abortions: 0,
  })).body.patient.id;
});

describe('Bhutani Hour-Specific Nomogram & Bilirubin Calculations', () => {
  it('interpolates Bhutani percentiles accurately across postnatal hours', () => {
    // 24 hours
    const p24 = getBhutaniPercentiles(24);
    expect(p24.p40).toBe(5.0);
    expect(p24.p75).toBe(6.2);
    expect(p24.p95).toBe(8.0);

    // 48 hours
    const p48 = getBhutaniPercentiles(48);
    expect(p48.p40).toBe(8.5);
    expect(p48.p75).toBe(11.0);
    expect(p48.p95).toBe(13.2);

    // 72 hours
    const p72 = getBhutaniPercentiles(72);
    expect(p72.p40).toBe(11.0);
    expect(p72.p75).toBe(14.0);
    expect(p72.p95).toBe(16.5);
  });

  it('classifies bilirubin readings into correct Bhutani risk zones', () => {
    // At 48 hours: p40=8.5, p75=11.0, p95=13.2
    // Low risk: 6.0 mg/dL (< 40th)
    const low = classifyBhutaniRiskZone(6.0, 48);
    expect(low.zone).toBe('low');

    // Low-intermediate risk: 9.5 mg/dL (40th - 75th)
    const lowInt = classifyBhutaniRiskZone(9.5, 48);
    expect(lowInt.zone).toBe('low_intermediate');

    // High-intermediate risk: 12.0 mg/dL (75th - 95th)
    const highInt = classifyBhutaniRiskZone(12.0, 48);
    expect(highInt.zone).toBe('high_intermediate');

    // High risk: 14.5 mg/dL (> 95th)
    const high = classifyBhutaniRiskZone(14.5, 48);
    expect(high.zone).toBe('high');
  });

  it('determines AAP 2022 risk tiers and evaluates phototherapy and exchange thresholds', () => {
    // Tier 1: 39 weeks, no risk factors -> lower risk
    expect(determineAapRiskTier(39, false)).toBe('lower_risk');

    // Tier 2: 36 weeks, no risk factors -> medium risk
    expect(determineAapRiskTier(36, false)).toBe('medium_risk');

    // Tier 2: 39 weeks with neurotoxicity risk -> medium risk
    expect(determineAapRiskTier(39, true)).toBe('medium_risk');

    // Tier 3: 36 weeks with neurotoxicity risk -> higher risk
    expect(determineAapRiskTier(36, true)).toBe('higher_risk');

    // Evaluate infant at 48 hours, 39 weeks, lower risk:
    // TSB 12.0 mg/dL (below phototherapy cutoff of 15.0)
    const evalSafe = evaluateNeonatalBilirubin({
      bilirubinMgDl: 12.0,
      ageHours: 48,
      gaWeeks: 39,
      hasNeurotoxicityRisk: false,
    });
    expect(evalSafe.phototherapyIndicated).toBe(false);
    expect(evalSafe.exchangeIndicated).toBe(false);

    // TSB 16.0 mg/dL (above phototherapy cutoff of 15.0)
    const evalPhoto = evaluateNeonatalBilirubin({
      bilirubinMgDl: 16.0,
      ageHours: 48,
      gaWeeks: 39,
      hasNeurotoxicityRisk: false,
    });
    expect(evalPhoto.phototherapyIndicated).toBe(true);
    expect(evalPhoto.exchangeIndicated).toBe(false);
    expect(evalPhoto.clinicalAction).toContain('Phototherapy Indicated');

    // TSB 20.5 mg/dL (within 2 mg/dL of exchange threshold 22.0) -> Escalation
    const evalEscalate = evaluateNeonatalBilirubin({
      bilirubinMgDl: 20.5,
      ageHours: 48,
      gaWeeks: 39,
      hasNeurotoxicityRisk: false,
    });
    expect(evalEscalate.escalationIndicated).toBe(true);
    expect(evalEscalate.clinicalAction).toContain('ESCALATION OF CARE');

    // TSB 23.0 mg/dL (above exchange cutoff of 22.0) -> Exchange Transfusion
    const evalExchange = evaluateNeonatalBilirubin({
      bilirubinMgDl: 23.0,
      ageHours: 48,
      gaWeeks: 39,
      hasNeurotoxicityRisk: false,
    });
    expect(evalExchange.exchangeIndicated).toBe(true);
    expect(evalExchange.clinicalAction).toContain('CRITICAL EMERGENCY');
  });

  it('calculates rate of rise and flags rapid hemolysis', () => {
    // 24h: 6.0 mg/dL, 36h: 12.5 mg/dL (delta: +6.5 mg/dL in 12h = 0.54 mg/dL/hr >= 0.5)
    const ror = calculateBilirubinRateOfRise(
      { ageHours: 24, bilirubinMgDl: 6.0 },
      { ageHours: 36, bilirubinMgDl: 12.5 }
    );
    expect(ror).not.toBeNull();
    expect(ror!.ratePerHour).toBe(0.54);
    expect(ror!.isRapidRise).toBe(true);
    expect(ror!.interpretation).toContain('CRITICAL RAPID RISE');

    // Normal rise: 24h: 6.0, 36h: 7.5 (+1.5 in 12h = 0.13 mg/dL/hr)
    const rorNormal = calculateBilirubinRateOfRise(
      { ageHours: 24, bilirubinMgDl: 6.0 },
      { ageHours: 36, bilirubinMgDl: 7.5 }
    );
    expect(rorNormal!.ratePerHour).toBe(0.13);
    expect(rorNormal!.isRapidRise).toBe(false);
  });

  it('calculates age in hours between birth and sample', () => {
    const hours = calculateAgeInHours('2026-09-10T08:00:00Z', '2026-09-12T14:00:00Z');
    expect(hours).toBe(54);
  });
});

describe('Neonatal Hyperbilirubinemia REST API Integration', () => {
  it('creates an episode, logs serial bilirubin readings, auto-evaluates thresholds, and enforces RBAC', async () => {
    // 1. Desk staff is blocked
    const deskBlocked = await call('POST', `/api/patients/${babyPatientId}/neonatal-jaundice`, desk, {
      birthDatetime: '2026-09-10T08:00:00',
      gestationalAgeWeeks: 38,
    });
    expect(deskBlocked.status).toBe(403);

    // 2. Doctor creates episode
    const epRes = await call('POST', `/api/patients/${babyPatientId}/neonatal-jaundice`, doctor, {
      birthDatetime: '2026-09-10T08:00:00',
      gestationalAgeWeeks: 38,
      birthWeightGrams: 3200,
      bloodGroup: 'B+',
      maternalBloodGroup: 'O+',
      directCoombsTest: 'negative',
      g6pdDeficiency: 'normal',
      neurotoxicityRisk: false,
      feedingType: 'exclusive_breastfeeding',
      status: 'monitoring',
      clinicalSummary: 'Term female infant born via SVD. Monitored for physiological vs pathological jaundice.',
    });
    expect(epRes.status).toBe(201);
    const episode = epRes.body;
    expect(episode.id).toBeGreaterThan(0);
    expect(episode.gestationalAgeWeeks).toBe(38);
    expect(episode.status).toBe('monitoring');

    // 3. Log initial reading at 24 hours: 5.5 mg/dL (Low-intermediate zone, safe)
    const rd1 = await call('POST', `/api/neonatal-jaundice/${episode.id}/readings`, doctor, {
      sampleDatetime: '2026-09-11T08:00:00',
      ageHours: 24,
      readingType: 'tcb_transcutaneous',
      bilirubinMgDl: 5.5,
      activePhototherapy: false,
    });
    expect(rd1.status).toBe(201);
    expect(rd1.body.bhutaniRiskZone).toBe('low_intermediate');
    expect(rd1.body.phototherapyIndicated).toBe(0);

    // 4. Log second reading at 48 hours: 16.0 mg/dL (High zone, above phototherapy cutoff 15.0)
    const rd2 = await call('POST', `/api/neonatal-jaundice/${episode.id}/readings`, doctor, {
      sampleDatetime: '2026-09-12T08:00:00',
      ageHours: 48,
      readingType: 'tsb_serum',
      bilirubinMgDl: 16.0,
      activePhototherapy: true,
      phototherapyDevice: 'Double LED Phototherapy Unit',
      notes: 'Baby placed under double LED phototherapy with eye protection.',
    });
    expect(rd2.status).toBe(201);
    expect(rd2.body.bhutaniRiskZone).toBe('high');
    expect(rd2.body.phototherapyIndicated).toBe(1);
    // Rate of rise from 5.5 to 16.0 in 24 hours = 0.44 mg/dL/hr
    expect(rd2.body.rateOfRiseMgDlHr).toBe(0.44);

    // 5. Fetch full episode with all readings
    const getEp = await call('GET', `/api/neonatal-jaundice/${episode.id}`, doctor);
    expect(getEp.status).toBe(200);
    expect(getEp.body.status).toBe('under_phototherapy'); // Auto-progressed
    expect(getEp.body.readingsCount).toBe(2);
    expect(getEp.body.readings[1].bilirubinMgDl).toBe(16.0);

    // 6. Update status to resolved
    const patchEp = await call('PATCH', `/api/neonatal-jaundice/${episode.id}`, doctor, {
      status: 'resolved',
      clinicalSummary: 'Phototherapy discontinued after rebound check. TSB stable at 9.0 mg/dL.',
    });
    expect(patchEp.status).toBe(200);
    expect(patchEp.body.status).toBe('resolved');

    // 7. Delete first reading
    const delRes = await call('DELETE', `/api/neonatal-jaundice/readings/${rd1.body.id}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const getEpAfterDel = await call('GET', `/api/neonatal-jaundice/${episode.id}`, doctor);
    expect(getEpAfterDel.body.readingsCount).toBe(1);
  });
});
