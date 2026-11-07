import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculatePhase1Benzo,
  calculatePhase2Agents,
  calculatePhase3Infusions,
  evaluatePediatricStatusEpilepticus,
} from '../web/src/pediatricStatusEpilepticusEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let db: DB;
let app: FastifyInstance;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  const res = await app.inject({
    method,
    url,
    headers,
    payload: body as any,
  });
  return {
    status: res.statusCode,
    body: res.body ? JSON.parse(res.body) : null,
    setCookie: res.headers['set-cookie'] as string | undefined,
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
describe('Pediatric Status Epilepticus Resuscitation Engine (Pure Unit Tests)', () => {
  it('calculates weight-based Phase 1 Benzodiazepine dosing accurately', () => {
    // 15 kg child
    // IV Lorazepam: 0.1 mg/kg -> 1.5 mg
    const ivLorazepam = calculatePhase1Benzo(15, 'iv');
    expect(ivLorazepam.doseMg).toBe(1.5);
    expect(ivLorazepam.agentName).toContain('Lorazepam');

    // Buccal/IN Midazolam: 0.2 mg/kg -> 3.0 mg
    const inMidazolam = calculatePhase1Benzo(15, 'buccal_in');
    expect(inMidazolam.doseMg).toBe(3.0);
    expect(inMidazolam.agentName).toContain('Midazolam');

    // Rectal Diazepam: 0.3 mg/kg -> 4.5 mg
    const rectalDiazepam = calculatePhase1Benzo(15, 'rectal');
    expect(rectalDiazepam.doseMg).toBe(4.5);
    expect(rectalDiazepam.agentName).toContain('Diazepam');

    // Max capping: 50 kg adolescent
    // IV Lorazepam cap 4 mg
    expect(calculatePhase1Benzo(50, 'iv').doseMg).toBe(4.0);
    // IN Midazolam cap 10 mg
    expect(calculatePhase1Benzo(60, 'buccal_in').doseMg).toBe(10.0);
  });

  it('calculates Phase 2 non-sedating second-line AEDs according to ESETT 2019 / AES', () => {
    // 20 kg child
    const agents = calculatePhase2Agents(20);
    expect(agents.length).toBe(3);

    // Levetiracetam: 60 mg/kg -> 1200 mg
    const keppra = agents.find((a) => a.agentName.includes('Levetiracetam'));
    expect(keppra?.doseMg).toBe(1200);

    // Fosphenytoin: 20 mg PE/kg -> 400 mg PE
    const fosphen = agents.find((a) => a.agentName.includes('Fosphenytoin'));
    expect(fosphen?.doseMg).toBe(400);

    // Valproate Sodium: 40 mg/kg -> 800 mg
    const valproate = agents.find((a) => a.agentName.includes('Valproate'));
    expect(valproate?.doseMg).toBe(800);
  });

  it('calculates Phase 3 refractory status continuous infusions', () => {
    // 12 kg child
    const infusions = calculatePhase3Infusions(12);
    expect(infusions.length).toBe(3);

    const midazolam = infusions.find((i) => i.agentName.includes('Midazolam'));
    expect(midazolam?.doseMg).toBe(2.4); // 0.2 mg/kg * 12

    const ketamine = infusions.find((i) => i.agentName.includes('Ketamine'));
    expect(ketamine?.doseMg).toBe(18.0); // 1.5 mg/kg * 12
  });

  it('evaluates comprehensive status epilepticus staging and triggers refractory protocol after 30 minutes', () => {
    // Phase 1: 5 minutes onset
    const p1 = evaluatePediatricStatusEpilepticus({
      ageMonths: 36,
      weightKg: 14,
      minutesFromOnset: 5,
      seizureOngoing: true,
    });
    expect(p1.currentPhase).toBe('phase_1_emergent_benzo');
    expect(p1.urgencyLevel).toBe('critical_emergency');

    // Phase 2: 15 minutes onset with 2 doses of benzo given
    const p2 = evaluatePediatricStatusEpilepticus({
      ageMonths: 36,
      weightKg: 14,
      minutesFromOnset: 15,
      phase1BenzoGiven: true,
      phase1DosesCount: 2,
      seizureOngoing: true,
    });
    expect(p2.currentPhase).toBe('phase_2_urgent_control');
    expect(p2.urgencyLevel).toBe('high_priority');

    // Phase 3: 35 minutes ongoing or failing phase 2
    const p3 = evaluatePediatricStatusEpilepticus({
      ageMonths: 36,
      weightKg: 14,
      minutesFromOnset: 35,
      phase1BenzoGiven: true,
      phase2Given: true,
      seizureOngoing: true,
    });
    expect(p3.currentPhase).toBe('phase_3_refractory_infusion');
    expect(p3.airwayActionPlan).toContain('Endotracheal intubation');

    // Seizure stopped
    const stopped = evaluatePediatricStatusEpilepticus({
      ageMonths: 36,
      weightKg: 14,
      minutesFromOnset: 20,
      seizureOngoing: false,
    });
    expect(stopped.currentPhase).toBe('seizure_abated_stabilization');
    expect(stopped.urgencyLevel).toBe('post_ictal_surveillance');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric Status Epilepticus REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.picu',
      fullName: 'Dr. Rahul Bose (Pediatric Intensivist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Sister Maya PICU Resus',
      role: 'nurse',
      password: 'temp-pass-nurse-picu',
    });
    const nurseFirst = await login('nurse.picu', 'temp-pass-nurse-picu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-picu',
      newPassword: PW,
    });
    nurse = await login('nurse.picu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.picu',
      fullName: 'PICU Ward Clerk',
      role: 'attender',
      password: 'temp-pass-picu-clerk',
    });
    const attenderFirst = await login('desk.picu', 'temp-pass-picu-clerk');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-picu-clerk',
      newPassword: PW,
    });
    attender = await login('desk.picu', PW);

    // Pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Kumar (3yo)',
      dateOfBirth: '2023-04-10',
      phone: '+91 98765 44444',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create status epilepticus resuscitation episode and logs audit', async () => {
    const payload = {
      patientId,
      seizureOnsetDatetime: '2026-11-07T09:00:00',
      ageMonths: 36,
      weightKg: 14.5,
      etiology: 'febrile_status',
      seizureSemiology: 'generalized_tonic_clonic',
      phase1BenzoGiven: true,
      phase1BenzoAgent: 'lorazepam_iv',
      phase1BenzoDoseMg: 1.5,
      phase1AdministeredMinute: 5,
      phase2SecondLineGiven: true,
      phase2Agent: 'levetiracetam',
      phase2DoseMg: 870,
      phase2AdministeredMinute: 15,
      phase3RefractoryStatus: false,
      status: 'active_seizure',
      clinicalNotes: 'Persistent convulsions despite 2 doses Lorazepam. Loading Levetiracetam 60 mg/kg.',
    };

    const res = await call('POST', '/api/pediatric-status-epilepticus/episodes', doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.episode.id).toBeDefined();
    expect(res.body.episode.weight_kg).toBe(14.5);

    // Audit check
    const auditRes = await call('GET', '/api/audit', doctor);
    expect(auditRes.status).toBe(200);
    const hasAudit = auditRes.body.some(
      (a: any) =>
        a.action === 'pediatric_status_epilepticus.episode_create' &&
        Number(a.entityId) === res.body.episode.id,
    );
    expect(hasAudit).toBe(true);
  });

  it('allows nurse to record serial flowsheet resuscitation logs', async () => {
    // 1. Create episode
    const epRes = await call('POST', '/api/pediatric-status-epilepticus/episodes', doctor, {
      patientId,
      seizureOnsetDatetime: '2026-11-07T09:00:00',
      ageMonths: 24,
      weightKg: 12.0,
      etiology: 'febrile_status',
      seizureSemiology: 'generalized_tonic_clonic',
      status: 'active_seizure',
    });
    const epId = epRes.body.episode.id;

    // 2. Nurse records 5-minute resuscitation log
    const fsRes = await call(
      'POST',
      `/api/pediatric-status-epilepticus/episodes/${epId}/flowsheet-logs`,
      nurse,
      {
        logDatetime: '2026-11-07T09:05:00',
        minutesFromOnset: 5,
        phaseActive: 'phase_1_emergent_benzo',
        seizureActivityPresent: true,
        vitalsHr: 155,
        vitalsSbp: 98,
        vitalsDbp: 60,
        vitalsSpo2: 97,
        airwayStatus: 'patent_spontaneous',
        infusionRateMcgKgMin: 0,
        eegBackground: 'not_monitoring',
        notes: 'Suctioned oral secretions, placed high-flow O2 via non-rebreather mask.',
      },
    );

    expect(fsRes.status).toBe(201);
    expect(fsRes.body.logId).toBeDefined();

    // 3. Fetch episode detail and check flowsheet array
    const detail = await call('GET', `/api/pediatric-status-epilepticus/episodes/${epId}`, nurse);
    expect(detail.status).toBe(200);
    expect(detail.body.logs.length).toBe(1);
    expect(detail.body.logs[0].vitals_hr).toBe(155);
  });

  it('allows doctor to update episode status and delete records', async () => {
    const epRes = await call('POST', '/api/pediatric-status-epilepticus/episodes', doctor, {
      patientId,
      seizureOnsetDatetime: '2026-11-07T09:00:00',
      ageMonths: 48,
      weightKg: 16.0,
      etiology: 'known_epilepsy',
      seizureSemiology: 'generalized_tonic_clonic',
      status: 'active_seizure',
    });
    const epId = epRes.body.episode.id;

    // Update
    const patchRes = await call(
      'PATCH',
      `/api/pediatric-status-epilepticus/episodes/${epId}`,
      doctor,
      {
        status: 'seizure_abated_post_ictal',
        seizureCessationMinute: 22,
        clinicalNotes: 'Seizure terminated after Levetiracetam infusion completed. Child post-ictal, breathing comfortably.',
      },
    );
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('seizure_abated_post_ictal');
    expect(patchRes.body.episode.seizure_cessation_minute).toBe(22);

    // Delete
    const delRes = await call(
      'DELETE',
      `/api/pediatric-status-epilepticus/episodes/${epId}`,
      doctor,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkGet = await call(
      'GET',
      `/api/pediatric-status-epilepticus/episodes/${epId}`,
      doctor,
    );
    expect(checkGet.status).toBe(404);
  });

  it('enforces RBAC preventing attender from creating episodes', async () => {
    const res = await call('POST', '/api/pediatric-status-epilepticus/episodes', attender, {
      patientId,
      seizureOnsetDatetime: '2026-11-07T09:00:00',
      ageMonths: 36,
      weightKg: 15.0,
      etiology: 'unknown',
      seizureSemiology: 'generalized_tonic_clonic',
    });
    expect(res.status).toBe(403);
  });
});
