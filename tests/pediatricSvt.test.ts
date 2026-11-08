import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import type { DB } from '../server/db.js';
import {
  calculateAdenosineDoses,
  calculateCardioversionJoules,
  evaluatePediatricSvt,
} from '../web/src/pediatricSvtEngine.js';

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
describe('Pediatric SVT & PALS Resuscitation Engine (Pure Unit Tests)', () => {
  it('correctly calculates weight-based Adenosine doses and caps at adult maximums', () => {
    // 8.5 kg infant: 0.85 mg 1st dose, 1.70 mg 2nd dose
    const infant = calculateAdenosineDoses(8.5);
    expect(infant.dose1Mg).toBe(0.85);
    expect(infant.dose2Mg).toBe(1.70);

    // 70 kg adolescent: capped at 6 mg and 12 mg
    const teen = calculateAdenosineDoses(70);
    expect(teen.dose1Mg).toBe(6.0);
    expect(teen.dose2Mg).toBe(12.0);
  });

  it('correctly calculates synchronized electrical cardioversion Joules', () => {
    // 8.5 kg: 1.0 J/kg = 9 J (rounded), 2.0 J/kg = 17 J
    const infantJoules = calculateCardioversionJoules(8.5);
    expect(infantJoules.initialJoules).toBe(9);
    expect(infantJoules.secondJoules).toBe(17);

    // 20 kg child: 20 J and 40 J
    const childJoules = calculateCardioversionJoules(20);
    expect(childJoules.initialJoules).toBe(20);
    expect(childJoules.secondJoules).toBe(40);
  });

  it('evaluates stable SVT in infant (HR 240) and prescribes ice bag to face + adenosine', () => {
    const res = evaluatePediatricSvt({
      ageMonths: 7,
      weightKg: 7.8,
      heartRateBpm: 240,
      qrsDurationMs: 68,
      qrsMorphology: 'narrow_complex_le_0_09s',
      rhythmRegularity: 'regular',
      pWavesIdentifiable: false,
      hemodynamicStability: 'stable_compensated',
    });

    expect(res.svtConfirmed).toBe(true);
    expect(res.isInfant).toBe(true);
    expect(res.rateThresholdBpm).toBe(220);
    expect(res.recommendedVagalManeuver).toBe('ice_bag_to_face_infant');
    expect(res.adenosineDose1Mg).toBe(0.78);
    expect(res.synchronizedCardioversionIndicated).toBe(false);
    expect(res.vagalGuidance).toContain('crushed ice in a plastic bag');
  });

  it('evaluates stable SVT in child (HR 200) and prescribes modified Valsalva', () => {
    const res = evaluatePediatricSvt({
      ageMonths: 48,
      weightKg: 16.0,
      heartRateBpm: 205,
      qrsDurationMs: 75,
      qrsMorphology: 'narrow_complex_le_0_09s',
      rhythmRegularity: 'regular',
      pWavesIdentifiable: false,
      hemodynamicStability: 'stable_compensated',
    });

    expect(res.svtConfirmed).toBe(true);
    expect(res.isInfant).toBe(false);
    expect(res.rateThresholdBpm).toBe(180);
    expect(res.recommendedVagalManeuver).toBe('modified_valsalva_child');
    expect(res.adenosineDose1Mg).toBe(1.6);
    expect(res.vagalGuidance).toContain('blow into a 10 mL syringe');
  });

  it('escalates to immediate synchronized cardioversion for unstable shock', () => {
    const res = evaluatePediatricSvt({
      ageMonths: 10,
      weightKg: 9.0,
      heartRateBpm: 260,
      qrsDurationMs: 70,
      qrsMorphology: 'narrow_complex_le_0_09s',
      rhythmRegularity: 'regular',
      pWavesIdentifiable: false,
      hemodynamicStability: 'unstable_decompensated_shock',
      alteredMentalStatus: true,
      capillaryRefillSeconds: 4.5,
      systolicBp: 55,
    });

    expect(res.svtConfirmed).toBe(true);
    expect(res.synchronizedCardioversionIndicated).toBe(true);
    expect(res.initialCardioversionJoules).toBe(9);
    expect(res.secondCardioversionJoules).toBe(18);
    expect(res.vagalGuidance).toContain('DO NOT delay cardioversion');
    expect(res.criticalResuscitationSteps[0]).toContain('Immediate Synchronized Electrical Cardioversion');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Pediatric SVT REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pediatrician',
      fullName: 'Dr. A. Verma (Pediatric Emergency Specialist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ed',
      fullName: 'Nurse Pooja (Emergency Dept)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.ed', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.ed', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.ped',
      fullName: 'Pediatric Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.ped', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.ped', PW);

    // Pediatric patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav (8m SVT)',
      dateOfBirth: '2026-03-10',
      phone: '+91 98765 44444',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to preview evaluation, create episode, log flowsheet, and retrieve detail', async () => {
    // 1. Live preview calculation
    const previewRes = await call('POST', '/api/pediatric-svt/evaluate', doctor, {
      ageMonths: 8,
      weightKg: 8.5,
      heartRateBpm: 250,
      qrsDurationMs: 70,
      qrsMorphology: 'narrow_complex_le_0_09s',
      rhythmRegularity: 'regular',
      pWavesIdentifiable: false,
      hemodynamicStability: 'stable_compensated',
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.evalResult.svtConfirmed).toBe(true);
    expect(previewRes.body.evalResult.adenosineDose1Mg).toBe(0.85);

    // 2. Create episode
    const createRes = await call('POST', '/api/pediatric-svt/episodes', doctor, {
      patientId,
      onsetDatetime: '2026-11-06T14:30',
      ageMonths: 8,
      weightKg: 8.5,
      heartRateBpm: 250,
      qrsDurationMs: 70,
      qrsMorphology: 'narrow_complex_le_0_09s',
      rhythmRegularity: 'regular',
      pWavesIdentifiable: false,
      hemodynamicStability: 'stable_compensated',
      signsOfShock: 'none',
      vagalManeuverAttempted: 'ice_bag_to_face_infant',
      vagalManeuverSuccessful: false,
      adenosineFirstDoseGiven: true,
      adenosineFirstDoseSuccessful: true,
      adenosineSecondDoseGiven: false,
      adenosineSecondDoseSuccessful: false,
      synchronizedCardioversionDelivered: false,
      cardioversionSuccessful: false,
      maintenanceAntiarrhythmic: 'oral_propranolol',
      status: 'converted_sinus_surveillance',
      clinicalNotes: 'Prompt conversion to sinus rhythm at 120 bpm following 1st Adenosine 0.85 mg rapid push.',
    });
    expect(createRes.status).toBe(201);
    const episodeId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toContain('SVT-');

    // 3. Nurse adds flowsheet log
    const logRes = await call('POST', `/api/pediatric-svt/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: '2026-11-06T14:45',
      minutesFromTriage: 15,
      heartRateBpm: 120,
      rhythmState: 'sinus_rhythm_restored',
      sbpMmhg: 88,
      dbpMmhg: 52,
      capillaryRefillSeconds: 1.5,
      mentalStatus: 'alert_normal',
      spo2Percent: 99,
      interventionAdministered: 'adenosine_dose_1',
      notes: 'Sinus rhythm confirmed on 12-lead ECG. Well perfused.',
    });
    expect(logRes.status).toBe(201);

    // 4. Retrieve single episode with flowsheet logs
    const getRes = await call('GET', `/api/pediatric-svt/episodes/${episodeId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.logs.length).toBe(1);
    expect(getRes.body.logs[0].rhythm_state).toBe('sinus_rhythm_restored');
    expect(getRes.body.evalResult.svtConfirmed).toBe(true);

    // 5. Query episodes by status
    const listRes = await call('GET', '/api/pediatric-svt/episodes?status=converted_sinus_surveillance', doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 6. Doctor updates episode status
    const updateRes = await call('PATCH', `/api/pediatric-svt/episodes/${episodeId}`, doctor, {
      status: 'discharged_maintenance_therapy',
      maintenanceAntiarrhythmic: 'oral_propranolol',
      clinicalNotes: 'Patient observed for 6 hours post-conversion. Discharged on oral propranolol.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.episode.status).toBe('discharged_maintenance_therapy');

    // 7. Attender is rejected with 403
    const attenderRes = await call('POST', '/api/pediatric-svt/episodes', attender, {
      patientId,
      onsetDatetime: '2026-11-06T16:00',
    });
    expect(attenderRes.status).toBe(403);

    // 8. Nurse cannot delete episode
    const nurseDelRes = await call('DELETE', `/api/pediatric-svt/episodes/${episodeId}`, nurse);
    expect(nurseDelRes.status).toBe(403);

    // 9. Doctor deletes flowsheet log and episode
    const delLogRes = await call('DELETE', `/api/pediatric-svt/episodes/${episodeId}/flowsheet-logs/${getRes.body.logs[0].id}`, doctor);
    expect(delLogRes.status).toBe(200);

    const delEpRes = await call('DELETE', `/api/pediatric-svt/episodes/${episodeId}`, doctor);
    expect(delEpRes.status).toBe(200);
  });
});
