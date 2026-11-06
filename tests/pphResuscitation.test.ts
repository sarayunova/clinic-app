import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateQbl,
  calculateObstetricShockIndex,
  calculateMeanArterialPressure,
  determinePphStage,
  checkUterotonicSafety,
} from '../web/src/pphScoring.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let motherId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
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
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.sharma', fullName: 'Dr Sharma', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse_mary', 'nurse'], ['desk_raj', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse_mary');
  desk = await login('desk_raj');

  motherId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Shreya Kulkarni',
    dateOfBirth: '1995-11-20',
    phone: '9822012345',
    lastMenstrualPeriod: '2026-02-15',
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('PPH & Quantitative Blood Loss (QBL) Mathematical Engine', () => {
  it('accurately computes QBL from gravimetric and volumetric sources with visual delta', () => {
    const res = calculateQbl({
      calibratedDrapeMl: 400,
      suctionCanisterMl: 200,
      spongesWetWeightG: 350,
      spongesDryWeightG: 50, // Net 300g = 300 mL
      clotsWeighedG: 150,     // 150g = 150 mL
      eblVisualEstimateMl: 400,
    });

    expect(res.volumetricMl).toBe(600); // 400 + 200
    expect(res.gravimetricMl).toBe(450); // 300 + 150
    expect(res.totalQblMl).toBe(1050);
    expect(res.underestimationDifferenceMl).toBe(650);
    expect(res.underestimationRatio).toBe(2.6);
  });

  it('evaluates Obstetric Shock Index (OSI = HR / SBP) risk categories', () => {
    // Normal (<0.9)
    const normal = calculateObstetricShockIndex(80, 120);
    expect(normal.shockIndex).toBe(0.67);
    expect(normal.severity).toBe('normal');

    // Early warning (0.9 - 0.99)
    const early = calculateObstetricShockIndex(95, 100);
    expect(early.shockIndex).toBe(0.95);
    expect(early.severity).toBe('early_warning');

    // High risk (1.0 - 1.39)
    const high = calculateObstetricShockIndex(115, 95);
    expect(high.shockIndex).toBe(1.21);
    expect(high.severity).toBe('high_risk');

    // Critical collapse (>=1.4) -> MTP indication
    const critical = calculateObstetricShockIndex(135, 80);
    expect(critical.shockIndex).toBe(1.69);
    expect(critical.severity).toBe('critical_collapse');
    expect(critical.title).toContain('CRITICAL COLLAPSE');
  });

  it('calculates Mean Arterial Pressure (MAP)', () => {
    expect(calculateMeanArterialPressure(120, 80)).toBe(93);
    expect(calculateMeanArterialPressure(90, 60)).toBe(70);
    expect(calculateMeanArterialPressure(null, 60)).toBeNull();
  });

  it('determines PPH clinical stages by delivery mode and shock index', () => {
    // Vaginal delivery
    expect(determinePphStage(400, 'vaginal', 0.7).stage).toBe('stage_0_routine');
    expect(determinePphStage(650, 'vaginal', 0.8).stage).toBe('stage_1_alert');
    expect(determinePphStage(1100, 'vaginal', 0.85).stage).toBe('stage_2_moderate');
    expect(determinePphStage(1600, 'vaginal', 0.95).stage).toBe('stage_3_severe_mtp');
    // Elevated Shock Index elevates stage to Stage 3 even if blood loss was below threshold
    expect(determinePphStage(800, 'vaginal', 1.45).stage).toBe('stage_3_severe_mtp');

    // Cesarean delivery (higher physiological baseline)
    expect(determinePphStage(800, 'cesarean', 0.7).stage).toBe('stage_0_routine');
    expect(determinePphStage(1200, 'cesarean', 0.8).stage).toBe('stage_1_alert');
    expect(determinePphStage(1600, 'cesarean', 0.85).stage).toBe('stage_2_moderate');
    expect(determinePphStage(2200, 'cesarean', 0.95).stage).toBe('stage_3_severe_mtp');
  });

  it('enforces uterotonic safety contraindications (hypertension vs asthma)', () => {
    // Hypertensive patient: Methergine contraindicated
    const ht = checkUterotonicSafety(true, false);
    expect(ht.methergineSafe).toBe(false);
    expect(ht.methergineWarning).toContain('CONTRAINDICATED');
    expect(ht.carboprostSafe).toBe(true);

    // Asthmatic patient: Carboprost contraindicated
    const asthma = checkUterotonicSafety(false, true);
    expect(asthma.methergineSafe).toBe(true);
    expect(asthma.carboprostSafe).toBe(false);
    expect(asthma.carboprostWarning).toContain('CONTRAINDICATED');

    // Both comorbidities
    const both = checkUterotonicSafety(true, true);
    expect(both.methergineSafe).toBe(false);
    expect(both.carboprostSafe).toBe(false);
  });
});

describe('PPH Resuscitation & QBL API Integration', () => {
  it('creates a PPH assessment with QBL calculation, logs timeline increment, and updates cumulative loss', async () => {
    // 1. Doctor creates PPH Assessment for atonic bleeding post-vaginal delivery
    const createRes = await call('POST', `/api/patients/${motherId}/pph-assessments`, doctor, {
      deliveryMode: 'vaginal',
      deliveryTimestamp: '2026-11-06T14:30',
      assessmentTimestamp: '2026-11-06T14:45',
      primaryEtiology4t: 'tone_atony',
      etiologyDetails: 'Uterine atony; heavy vaginal bleeding with clots',
      uterineTone: 'soft_boggy',
      qblCalibratedDrapeMl: 450,
      qblSuctionCanisterMl: 150,
      qblSpongesWetWeightG: 300,
      qblSpongesDryWeightG: 50, // Net 250
      qblClotsWeighedG: 150,
      eblVisualEstimateMl: 500,
      maternalPulse: 110,
      maternalBpSystolic: 95,
      maternalBpDiastolic: 60,
      bimanualCompressionDone: true,
      bladderCatheterized: true,
      ivAccessTwoWideBore: true,
      crystalloidsInfusedMl: 1000,
      oxytocinGiven: true,
      oxytocinDoseRoute: '10 IU IM + 20 IU in 500mL RL @ 250mL/hr',
      tranexamicAcidGiven: true,
      txaGivenAt: '2026-11-06T14:40',
      carboprostGiven: true,
      carboprostDosesCount: 1,
      misoprostolGiven: true,
      misoprostolDoseMcg: 800,
      attendingObstetrician: 'Dr Sharma',
      nurseInCharge: 'Nurse Mary',
      outcomeStatus: 'bleeding_controlled',
    });

    expect(createRes.status).toBe(201);
    const pphId = createRes.body.id;
    expect(pphId).toBeGreaterThan(0);
    expect(createRes.body.qblTotalMl).toBe(1000); // 450 + 150 + 250 + 150
    expect(createRes.body.shockIndex).toBe(1.16); // 110 / 95
    expect(createRes.body.shockIndexSeverity).toBe('high_risk');
    expect(createRes.body.tranexamicAcidGiven).toBe(true);

    // 2. Nurse logs subsequent QBL increment 15 mins later during active surveillance
    const timelineRes = await call('POST', `/api/pph-assessments/${pphId}/timeline`, nurse, {
      loggedAt: '2026-11-06T15:00',
      drapeIncrementMl: 100,
      spongeIncrementG: 50,
      clotsIncrementG: 50,
      cumulativeQblMl: 1200,
      pulse: 98,
      bpSystolic: 105,
      bpDiastolic: 68,
      actionTaken: 'Uterus well contracted following bimanual massage; vitals stabilizing',
    });

    expect(timelineRes.status).toBe(201);
    expect(timelineRes.body.cumulativeQblMl).toBe(1200);
    expect(timelineRes.body.shockIndex).toBe(0.93); // 98 / 105

    // 3. Retrieve detailed assessment with timeline
    const getRes = await call('GET', `/api/pph-assessments/${pphId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(pphId);
    expect(getRes.body.qblTotalMl).toBe(1200); // Updated by timeline entry!
    expect(getRes.body.maternalPulse).toBe(98);
    expect(getRes.body.timelineEntries).toHaveLength(2); // Initial + 1 subsequent

    // 4. Verify Audit Event
    const auditEvents = db.prepare('SELECT action FROM audit_events WHERE entity_id = ?').all(String(motherId)) as { action: string }[];
    const actions = auditEvents.map((a) => a.action);
    expect(actions).toContain('pph_assessment.create');
    expect(actions).toContain('pph_assessment.timeline_entry');

    // 5. Delete assessment
    const delRes = await call('DELETE', `/api/pph-assessments/${pphId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const afterDel = await call('GET', `/api/patients/${motherId}/pph-assessments`, doctor);
    expect(afterDel.body.count).toBe(0);
  });

  it('enforces RBAC: desk attender is forbidden from managing PPH assessments', async () => {
    const res = await call('POST', `/api/patients/${motherId}/pph-assessments`, desk, {
      deliveryMode: 'vaginal',
      deliveryTimestamp: '2026-11-06T14:30',
      qblTotalMl: 500,
    });
    expect(res.status).toBe(403);
  });
});
