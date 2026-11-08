import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import {
  calculateOxygenationIndex,
  evaluateNeonatalMas,
} from '../web/src/neonatalMasEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
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
describe('Neonatal MAS & PPHN Engine (Pure Unit Tests)', () => {
  it('correctly calculates Oxygenation Index (OI) and stratifies hypoxemic failure severity', () => {
    // MAP 12, FiO2 60%, PaO2 50 mmHg -> OI = (12 * 60) / 50 = 14.4 (Mild, < 15)
    const mildOi = calculateOxygenationIndex(12, 60, 50);
    expect(mildOi).toBe(14.4);

    const mildEval = evaluateNeonatalMas({
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3200,
      chronologicalAgeHours: 6,
      currentWeightKg: 3.1,
      amnioticFluidMeconiumConsistency: 'thick_particulate_pea_soup',
      deliveryRoomVigor: 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: true,
      meconiumClearedBelowCords: true,
      respiratorySupportMode: 'conventional_mechanical_ventilation',
      fio2Percent: 60,
      meanAirwayPressureCmh2o: 12,
      pao2Mmhg: 50,
      paco2Mmhg: 45,
      echocardiogramPphnConfirmed: false,
      pphnSeverity: 'none_or_not_assessed',
      pulmonaryAirLeakPresent: false,
      airLeakType: 'none',
      surfactantAdministered: false,
      surfactantDeliveryMethod: 'none',
      inhaledNitricOxidePrescribed: false,
    });
    expect(mildEval.hypoxemicFailureSeverity).toBe('mild');
    expect(mildEval.surfactantIndicated).toBe(true);

    // MAP 16, FiO2 100%, PaO2 45 mmHg -> OI = (16 * 100) / 45 = 35.6 (Severe, 25-39)
    const severeOi = calculateOxygenationIndex(16, 100, 45);
    expect(severeOi).toBe(35.6);

    const severeEval = evaluateNeonatalMas({
      gestationalAgeWeeks: 40,
      birthWeightGrams: 3400,
      chronologicalAgeHours: 4,
      currentWeightKg: 3.3,
      amnioticFluidMeconiumConsistency: 'thick_particulate_pea_soup',
      deliveryRoomVigor: 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: true,
      meconiumClearedBelowCords: true,
      respiratorySupportMode: 'conventional_mechanical_ventilation',
      fio2Percent: 100,
      meanAirwayPressureCmh2o: 16,
      pao2Mmhg: 45,
      echocardiogramPphnConfirmed: true,
      pphnSeverity: 'moderate_suprasystemic_shunting',
      pulmonaryAirLeakPresent: false,
      airLeakType: 'none',
      surfactantAdministered: false,
      surfactantDeliveryMethod: 'none',
      inhaledNitricOxidePrescribed: false,
    });
    expect(severeEval.hypoxemicFailureSeverity).toBe('severe');
    expect(severeEval.inoIndicated).toBe(true);
    expect(severeEval.hfovIndicated).toBe(true);

    // MAP 18, FiO2 100%, PaO2 40 mmHg -> OI = (18 * 100) / 40 = 45.0 (Extreme, >= 40 ECMO criteria)
    const extremeOi = calculateOxygenationIndex(18, 100, 40);
    expect(extremeOi).toBe(45.0);

    const extremeEval = evaluateNeonatalMas({
      gestationalAgeWeeks: 40.5,
      birthWeightGrams: 3600,
      chronologicalAgeHours: 12,
      currentWeightKg: 3.5,
      amnioticFluidMeconiumConsistency: 'thick_particulate_pea_soup',
      deliveryRoomVigor: 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: true,
      meconiumClearedBelowCords: true,
      respiratorySupportMode: 'high_frequency_oscillatory_ventilation',
      fio2Percent: 100,
      meanAirwayPressureCmh2o: 18,
      pao2Mmhg: 40,
      echocardiogramPphnConfirmed: true,
      pphnSeverity: 'severe_refractory_right_to_left',
      pulmonaryAirLeakPresent: false,
      airLeakType: 'none',
      surfactantAdministered: true,
      surfactantDeliveryMethod: 'bolus_endotracheal',
      inhaledNitricOxidePrescribed: true,
      inoDosePpm: 20,
    });
    expect(extremeEval.hypoxemicFailureSeverity).toBe('ecmo_eligible');
    expect(extremeEval.pphnRiskLevel).toBe('critical');
    expect(extremeEval.clinicalAlerts.some((a) => a.includes('ECMO'))).toBe(true);
  });

  it('triggers emergency alert on tension pneumothorax air-leak complication', () => {
    const leakEval = evaluateNeonatalMas({
      gestationalAgeWeeks: 38,
      birthWeightGrams: 2900,
      chronologicalAgeHours: 8,
      currentWeightKg: 2.8,
      amnioticFluidMeconiumConsistency: 'thick_particulate_pea_soup',
      deliveryRoomVigor: 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: false,
      meconiumClearedBelowCords: false,
      respiratorySupportMode: 'conventional_mechanical_ventilation',
      fio2Percent: 70,
      meanAirwayPressureCmh2o: 14,
      echocardiogramPphnConfirmed: false,
      pphnSeverity: 'none_or_not_assessed',
      pulmonaryAirLeakPresent: true,
      airLeakType: 'pneumothorax_tension',
      surfactantAdministered: false,
      surfactantDeliveryMethod: 'none',
      inhaledNitricOxidePrescribed: false,
    });

    expect(leakEval.airLeakEmergency).toBe(true);
    expect(leakEval.clinicalAlerts.some((a) => a.includes('Tension pneumothorax'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration Tests
// -------------------------------------------------------------
describe('Neonatal MAS REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neomas',
      fullName: 'Dr. Vivek Saxena (Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.neomas',
      fullName: 'Nurse Kavita (NICU)',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.neomas', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.neomas', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.neomas',
      fullName: 'NICU Attender',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.neomas', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.neomas', PW);

    // Create infant patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Sunita',
      dateOfBirth: '2026-11-06',
      phone: '+91 98888 77766',
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  });

  it('previews MAS evaluation without database persistence', async () => {
    const res = await call('POST', '/api/neonatal-mas/evaluate', doctor, {
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3200,
      chronologicalAgeHours: 6,
      currentWeightKg: 3.1,
      amnioticFluidMeconiumConsistency: 'thick_particulate_pea_soup',
      deliveryRoomVigor: 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: true,
      meconiumClearedBelowCords: true,
      respiratorySupportMode: 'conventional_mechanical_ventilation',
      fio2Percent: 80,
      meanAirwayPressureCmh2o: 14,
      pao2Mmhg: 50,
      paco2Mmhg: 48,
      arterialPh: 7.28,
      prePostDuctalSpo2DiffPercent: 12,
      echocardiogramPphnConfirmed: true,
      pphnSeverity: 'moderate_suprasystemic_shunting',
      pulmonaryAirLeakPresent: false,
      airLeakType: 'none',
      surfactantAdministered: false,
      surfactantDeliveryMethod: 'none',
      surfactantDoseMgKg: 0,
      inhaledNitricOxidePrescribed: false,
      inoDosePpm: 0,
      empiricAntibioticsActive: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.evalResult.oxygenationIndex).toBe(22.4);
    expect(res.body.evalResult.inoIndicated).toBe(true);
    expect(res.body.evalResult.pphnRiskLevel).toBe('high');
  });

  it('enforces RBAC, CRUD, flowsheet logging, and audit tracking', async () => {
    const diagTime = new Date().toISOString();

    // 1. Attender cannot create episode (403 Forbidden)
    const attenderCreate = await call('POST', '/api/neonatal-mas/episodes', attender, {
      patientId,
      diagnosisDatetime: diagTime,
      gestationalAgeWeeks: 39,
      birthWeightGrams: 3200,
      chronologicalAgeHours: 6,
      currentWeightKg: 3.1,
      amnioticFluidMeconiumConsistency: 'thick_particulate_pea_soup',
      deliveryRoomVigor: 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: true,
      meconiumClearedBelowCords: true,
      respiratorySupportMode: 'conventional_mechanical_ventilation',
      fio2Percent: 60,
      meanAirwayPressureCmh2o: 12,
      echocardiogramPphnConfirmed: false,
      pphnSeverity: 'none_or_not_assessed',
      pulmonaryAirLeakPresent: false,
      airLeakType: 'none',
      surfactantAdministered: false,
      surfactantDeliveryMethod: 'none',
      inhaledNitricOxidePrescribed: false,
      empiricAntibioticsActive: true,
    });
    expect(attenderCreate.status).toBe(403);

    // 2. Doctor creates episode (201)
    const createRes = await call('POST', '/api/neonatal-mas/episodes', doctor, {
      patientId,
      diagnosisDatetime: diagTime,
      gestationalAgeWeeks: 39.5,
      birthWeightGrams: 3300,
      chronologicalAgeHours: 4,
      currentWeightKg: 3.2,
      amnioticFluidMeconiumConsistency: 'thick_particulate_pea_soup',
      deliveryRoomVigor: 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: true,
      meconiumClearedBelowCords: true,
      apgar1min: 4,
      apgar5min: 7,
      respiratorySupportMode: 'conventional_mechanical_ventilation',
      fio2Percent: 80,
      meanAirwayPressureCmh2o: 14,
      pao2Mmhg: 50,
      paco2Mmhg: 50,
      arterialPh: 7.26,
      prePostDuctalSpo2DiffPercent: 14,
      echocardiogramPphnConfirmed: true,
      pphnSeverity: 'moderate_suprasystemic_shunting',
      pulmonaryAirLeakPresent: false,
      airLeakType: 'none',
      surfactantAdministered: false,
      surfactantDeliveryMethod: 'none',
      surfactantDoseMgKg: 0,
      inhaledNitricOxidePrescribed: true,
      inoDosePpm: 20,
      empiricAntibioticsActive: true,
      status: 'hfov_ino_escalation',
      clinicalNotes: 'Thick particulate meconium aspiration. PPHN with 14% pre/post ductal saturation gradient. iNO commenced at 20 ppm.',
    });

    expect(createRes.status).toBe(201);
    const episode = createRes.body.episode;
    expect(episode.episode_code).toContain('MAS-');
    expect(episode.oxygenation_index).toBe(22.4);
    const episodeId = episode.id;

    // 3. Nurse lists episodes
    const listRes = await call('GET', `/api/neonatal-mas/episodes?patientId=${patientId}`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.episodes.length).toBe(1);

    // 4. Retrieve single episode with calculated evalResult
    const getRes = await call('GET', `/api/neonatal-mas/episodes/${episodeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(episodeId);
    expect(getRes.body.evalResult.inoIndicated).toBe(true);

    // 5. Nurse adds flowsheet log (201)
    const logRes = await call('POST', `/api/neonatal-mas/episodes/${episodeId}/flowsheet-logs`, nurse, {
      logDatetime: new Date().toISOString(),
      hoursFromAdmission: 2,
      respiratoryRate: 60,
      heartRateBpm: 154,
      preDuctalSpo2Percent: 96,
      postDuctalSpo2Percent: 90,
      fio2Percent: 70,
      meanAirwayPressureCmh2o: 13,
      pao2Mmhg: 65,
      paco2Mmhg: 44,
      arterialPh: 7.32,
      inoDosePpm: 20,
      meanBloodPressureMmhg: 46,
      chestTubeDrainageActive: false,
      notes: 'Responsive to iNO 20 ppm; pre/post ductal gradient narrowed to 6%.',
    });
    expect(logRes.status).toBe(201);
    const logId = logRes.body.logId;

    // 6. Doctor updates episode
    const patchRes = await call('PATCH', `/api/neonatal-mas/episodes/${episodeId}`, doctor, {
      status: 'weaning_recovering',
      fio2Percent: 50,
      clinicalNotes: 'Improving gas exchange. Ductal gradient resolved.',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.episode.status).toBe('weaning_recovering');

    // 7. Nurse deletes flowsheet log
    const delLogRes = await call('DELETE', `/api/neonatal-mas/episodes/${episodeId}/flowsheet-logs/${logId}`, nurse);
    expect(delLogRes.status).toBe(200);

    // 8. Doctor deletes episode
    const delRes = await call('DELETE', `/api/neonatal-mas/episodes/${episodeId}`, doctor);
    expect(delRes.status).toBe(200);
  });
});
