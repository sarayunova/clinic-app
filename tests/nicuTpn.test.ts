import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { calculateNicuTpn } from '../web/src/nicuTpnEngine.js';

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
describe('NICU Level-3 TPN & Electrolyte Compounding Engine (Pure Unit Tests)', () => {
  it('correctly calculates fluids, GIR, macronutrient volumes, and calories for a VLBW neonate', () => {
    // 1.2 kg preterm infant on DOL 3, target 120 mL/kg/day, Dextrose 10%, AA 3.0 g/kg, Lipids 2.0 g/kg
    const result = calculateNicuTpn({
      currentWeightKg: 1.2,
      birthWeightKg: 1.15,
      dayOfLife: 3,
      gestationalAgeWeeks: 29,
      targetTotalFluidMlPerKgDay: 120,
      enteralIntakeMlDay: 0,
      dextrosePercent: 10,
      aminoAcidSolutionType: 'primene_10',
      aminoAcidGPerKgDay: 3.0,
      lipidEmulsionType: 'smoflipid_20',
      lipidGPerKgDay: 2.0,
      sodiumMeqPerKgDay: 3.0,
      potassiumMeqPerKgDay: 2.0,
      calciumGluconateMlPerKgDay: 2.0,
      magnesiumSulfateMlDay: 0.2,
      phosphateMmolPerKgDay: 1.0,
      heparinUnitsPerMl: 0.5,
      multivitaminMviMlDay: 1.5,
    });

    // Fluid: 120 * 1.2 = 144 mL/day
    expect(result.parenteralFluidMlDay).toBe(144);
    expect(result.infusionRateMlHr).toBe(6);

    // Lipids: 2.0 * 1.2 = 2.4 g => 2.4 / 0.2 = 12 mL
    expect(result.lipidGramsDay).toBe(2.4);
    expect(result.lipidVolumeMl).toBe(12);

    // Amino Acids: 3.0 * 1.2 = 3.6 g => Primene 10% (0.1 g/mL) = 36 mL
    expect(result.aminoAcidGramsDay).toBe(3.6);
    expect(result.aminoAcidVolumeMl).toBe(36);

    // GIR is positive and within target neonatal range (4-8 mg/kg/min)
    expect(result.glucoseInfusionRateGir).toBeGreaterThan(4.0);
    expect(result.glucoseInfusionRateGir).toBeLessThan(10.0);

    // Caloric adequacy: > 50 kcal/kg/day for starter nutrition
    expect(result.caloriesPerKgDay).toBeGreaterThan(50);
    expect(result.nonProteinCalorieToNitrogenRatio).toBeGreaterThan(50);

    // Osmolarity should be safe for peripheral (<900 mOsm/L)
    expect(result.totalOsmolarityMOsmL).toBeLessThan(900);
    expect(result.isCentralLineMandatory).toBe(false);
    expect(result.recommendedRouteCategory).toBe('peripheral');
  });

  it('mandates central line access when osmolarity exceeds 900 mOsm/L or dextrose > 12.5%', () => {
    // 0.8 kg ELBW infant with Dextrose 15% and high amino acids
    const result = calculateNicuTpn({
      currentWeightKg: 0.8,
      birthWeightKg: 0.75,
      dayOfLife: 5,
      gestationalAgeWeeks: 26,
      targetTotalFluidMlPerKgDay: 140,
      enteralIntakeMlDay: 0,
      dextrosePercent: 15, // > 12.5% forces central access
      aminoAcidSolutionType: 'trophamine_10',
      aminoAcidGPerKgDay: 3.5,
      lipidEmulsionType: 'smoflipid_20',
      lipidGPerKgDay: 3.0,
      sodiumMeqPerKgDay: 4.0,
      potassiumMeqPerKgDay: 2.5,
    });

    expect(result.isCentralLineMandatory).toBe(true);
    expect(result.recommendedRouteCategory).toBe('central_line_uvc_picc');
    expect(result.osmolarityAlert).toContain('MANDATORY CENTRAL VASCULAR ACCESS');
  });

  it('detects dangerously low GIR (<4 mg/kg/min) and excessive GIR (>12 mg/kg/min)', () => {
    // Low dextrose % resulting in low GIR
    const lowGir = calculateNicuTpn({
      currentWeightKg: 2.0,
      birthWeightKg: 2.0,
      dayOfLife: 1,
      targetTotalFluidMlPerKgDay: 60,
      enteralIntakeMlDay: 0,
      dextrosePercent: 5,
      aminoAcidSolutionType: 'primene_10',
      aminoAcidGPerKgDay: 1.5,
      lipidEmulsionType: 'smoflipid_20',
      lipidGPerKgDay: 1.0,
    });
    expect(lowGir.girAlert).toContain('LOW GIR');

    // High dextrose resulting in excessive GIR
    const highGir = calculateNicuTpn({
      currentWeightKg: 1.0,
      birthWeightKg: 1.0,
      dayOfLife: 7,
      targetTotalFluidMlPerKgDay: 180,
      enteralIntakeMlDay: 0,
      dextrosePercent: 20,
      aminoAcidSolutionType: 'primene_10',
      aminoAcidGPerKgDay: 3.5,
      lipidEmulsionType: 'smoflipid_20',
      lipidGPerKgDay: 3.0,
    });
    expect(highGir.girAlert).toContain('EXCESSIVE GIR');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('NICU Level-3 TPN REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. Neha Shah (Neonatologist)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Sister Rekha NICU',
      role: 'nurse',
      password: 'temp-pass-nurse-nicu',
    });
    const nurseFirst = await login('nurse.nicu', 'temp-pass-nurse-nicu');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-nicu',
      newPassword: PW,
    });
    nurse = await login('nurse.nicu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'Reception Desk',
      role: 'attender',
      password: 'temp-pass-desk-nicu',
    });
    const deskFirst = await login('desk.attender', 'temp-pass-desk-nicu');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-nicu',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Create neonatal patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Anita (Twin 1)',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 11111',
    });
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to prescribe TPN and computes compounding recipe & osmolarity', async () => {
    const res = await call('POST', '/api/nicu-tpn/prescriptions', doctor, {
      patientId,
      prescriptionDate: '2026-11-07',
      dayOfLife: 2,
      gestationalAgeWeeks: 28.5,
      birthWeightKg: 1.05,
      currentWeightKg: 1.02,
      targetTotalFluidMlPerKgDay: 100,
      enteralIntakeMlDay: 5,
      dextrosePercent: 10,
      aminoAcidSolutionType: 'primene_10',
      aminoAcidGPerKgDay: 2.5,
      lipidEmulsionType: 'smoflipid_20',
      lipidGPerKgDay: 1.5,
      sodiumMeqPerKgDay: 2.0,
      potassiumMeqPerKgDay: 1.5,
      calciumGluconateMlPerKgDay: 2.0,
    });

    expect(res.status).toBe(201);
    expect(res.body.prescription.prescription_code).toMatch(/^TPN-/);
    expect(res.body.prescription.patient_name).toBe('Baby of Anita (Twin 1)');
    expect(res.body.prescription.status).toBe('active');
    expect(res.body.calculation.glucoseInfusionRateGir).toBeGreaterThan(0);

    const prescId = res.body.prescription.id;

    // Retrieve single prescription with labs
    const getRes = await call('GET', `/api/nicu-tpn/prescriptions/${prescId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.prescription.id).toBe(prescId);
    expect(getRes.body.labs).toEqual([]);

    // Nurse logs bedside glucose and electrolyte checkpoint
    const labRes = await call('POST', `/api/nicu-tpn/prescriptions/${prescId}/labs`, nurse, {
      monitoringDatetime: '2026-11-07T14:30',
      bloodGlucoseMgDl: 78,
      serumSodiumMeqL: 139,
      serumPotassiumMeqL: 4.1,
      serumCalciumMgDl: 8.9,
      serumTriglyceridesMgDl: 125,
      girAdjustedFlag: false,
      notes: 'Bedside glucometer stable; tolerating aqueous infusion well',
    });

    expect(labRes.status).toBe(201);
    expect(labRes.body.lab.blood_glucose_mg_dl).toBe(78);
    expect(labRes.body.lab.logged_by_name).toBe('Sister Rekha NICU');

    // Nurse pharmacist-verifies & updates status to 'compounded'
    const statusRes = await call('PUT', `/api/nicu-tpn/prescriptions/${prescId}/status`, nurse, {
      status: 'compounded',
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.prescription.status).toBe('compounded');
    expect(statusRes.body.prescription.verified_by_name).toBe('Sister Rekha NICU');

    // Print audit
    const printRes = await call('POST', `/api/nicu-tpn/prescriptions/${prescId}/print`, doctor, {});
    expect(printRes.status).toBe(200);

    // Verify audit logs
    const auditRows = db.prepare('SELECT action FROM audit_events WHERE entity = ?').all('nicu_tpn_prescriptions');
    const actions = auditRows.map((r: any) => r.action);
    expect(actions).toContain('nicu_tpn.prescription_create');
    expect(actions).toContain('nicu_tpn.status_update');
    expect(actions).toContain('nicu_tpn.print');
  });

  it('blocks unprivileged attender role from prescribing or logging TPN labs', async () => {
    const prescRes = await call('POST', '/api/nicu-tpn/prescriptions', attender, {
      patientId,
      prescriptionDate: '2026-11-07',
      dayOfLife: 1,
      birthWeightKg: 1.2,
      currentWeightKg: 1.2,
      targetTotalFluidMlPerKgDay: 80,
      dextrosePercent: 10,
      aminoAcidSolutionType: 'primene_10',
      aminoAcidGPerKgDay: 2.0,
      lipidEmulsionType: 'smoflipid_20',
      lipidGPerKgDay: 1.0,
    });
    expect(prescRes.status).toBe(403);
  });
});
