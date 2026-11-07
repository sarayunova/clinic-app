import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  calculateSilvermanScore,
  calculateDownesScore,
  calculateAaRatio,
  calculateOxygenationIndex,
  calculateSurfactantDosing,
  assessCpapFailure,
} from '../web/src/neonatalRdsEngine.js';

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
describe('Neonatal RDS & Bubble CPAP Engine (Pure Unit Tests)', () => {
  it('correctly calculates Silverman-Anderson Retraction Score severity', () => {
    // Mild score 2
    const mild = calculateSilvermanScore({
      upperChest: 1,
      lowerChest: 1,
      xiphoidRetractions: 0,
      naresDilation: 0,
      expiratoryGrunt: 0,
    });
    expect(mild.score).toBe(2);
    expect(mild.severity).toBe('mild');

    // Severe score 8 (impending respiratory failure)
    const severe = calculateSilvermanScore({
      upperChest: 2,
      lowerChest: 2,
      xiphoidRetractions: 2,
      naresDilation: 1,
      expiratoryGrunt: 1,
    });
    expect(severe.score).toBe(8);
    expect(severe.severity).toBe('severe_impending_failure');
  });

  it('correctly calculates Downes Score and clinical distress category', () => {
    const downes = calculateDownesScore({
      cyanosis: 1,
      retractions: 2,
      grunting: 1,
      airEntry: 1,
      respiratoryRate: 2,
    });
    expect(downes.score).toBe(7);
    expect(downes.severity).toBe('moderate');
  });

  it('calculates alveolar-arterial oxygen ratio (a/A ratio) indicating surfactant deficiency', () => {
    // PaO2 50 mmHg, FiO2 60%, PaCO2 45 mmHg
    const res = calculateAaRatio(50, 60, 45);
    expect(res.calculatedPAO2).toBeGreaterThan(300);
    expect(res.aaRatio).toBeLessThan(0.22);
    expect(res.interpretation).toBe('severe_surfactant_deficiency');
  });

  it('calculates Oxygenation Index (OI) and stratifies respiratory failure', () => {
    // MAP 10, FiO2 80%, PaO2 40 => OI = (10 * 80) / 40 = 20 (Severe)
    const severeOi = calculateOxygenationIndex(10, 80, 40);
    expect(severeOi.oi).toBe(20);
    expect(severeOi.severity).toBe('severe');

    // MAP 14, FiO2 100%, PaO2 45 => OI = 31.1 (ECMO threshold)
    const criticalOi = calculateOxygenationIndex(14, 100, 45);
    expect(criticalOi.oi).toBeGreaterThan(25);
    expect(criticalOi.severity).toBe('ecmo_threshold');
  });

  it('calculates Poractant alfa (Curosurf) 200 mg/kg initial dose and LISA indication for preterm < 30 weeks', () => {
    const calc = calculateSurfactantDosing({
      brand: 'curosurf_poractant_alfa',
      weightKg: 1.2,
      gestationalAgeWeeks: 28.0,
      currentFiO2Percent: 35.0,
      peepCmh2o: 6.0,
      isFirstDose: true,
    });

    expect(calc.doseMgPerKg).toBe(200);
    expect(calc.totalDoseMg).toBe(240); // 1.2 kg * 200 mg/kg
    expect(calc.totalVolumeMl).toBe(3.0); // 240 mg / 80 mg/mL = 3.0 mL
    expect(calc.indicationAlert).toBe(true);
    expect(calc.recommendedMethod).toBe('lisa_mist_thin_catheter');
  });

  it('detects CPAP failure criteria requiring escalation to invasive mechanical ventilation', () => {
    const failureCheck = assessCpapFailure({
      peepCmh2o: 8.0,
      fio2Percent: 45.0,
      silvermanScore: 7,
      abgPh: 7.18,
      abgPco2Mmhg: 68,
      frequentApneasCount: 3,
    });

    expect(failureCheck.isFailing).toBe(true);
    expect(failureCheck.failureCriteriaMet.length).toBeGreaterThanOrEqual(3);
    expect(failureCheck.recommendedAction).toContain('CPAP Failure Alert');
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal RDS & Bubble CPAP REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. Anand Rao (Neonatology)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.nicu',
      fullName: 'Sister Mary NICU',
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
      fullName: 'Reception Staff',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('desk.attender', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Preterm infant patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Baby of Sunita Preterm',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 43210',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('runs calculation endpoint and validates surfactant dosing', async () => {
    const res = await call('POST', '/api/neonatal-rds/calculate', doctor, {
      silverman: { upperChest: 1, lowerChest: 1, xiphoidRetractions: 1, naresDilation: 1, expiratoryGrunt: 1 },
      downes: { cyanosis: 1, retractions: 1, grunting: 1, airEntry: 1, respiratoryRate: 1 },
      brand: 'curosurf_poractant_alfa',
      weightKg: 1.1,
      gestationalAgeWeeks: 29.0,
      fio2Percent: 35.0,
      peepCmh2o: 6.0,
      arterialPao2Mmhg: 55,
      arterialPco2Mmhg: 48,
      meanAirwayPressure: 6.5,
    });

    expect(res.status).toBe(200);
    expect(res.body.silverman.score).toBe(5);
    expect(res.body.downes.score).toBe(5);
    expect(res.body.surfactant.totalDoseMg).toBe(220); // 1.1 * 200
    expect(res.body.surfactant.totalVolumeMl).toBe(2.75);
    expect(res.body.surfactant.indicationAlert).toBe(true);
  });

  it('creates an RDS episode with LISA surfactant and audits the event', async () => {
    const res = await call('POST', '/api/neonatal-rds/episodes', doctor, {
      patientId,
      onsetDatetime: new Date().toISOString().slice(0, 16),
      gestationalAgeWeeks: 28.5,
      birthWeightKg: 1.15,
      currentWeightKg: 1.15,
      silvermanAndersonScore: 5,
      downesScore: 5,
      fio2RequirementPercent: 35.0,
      arterialPao2Mmhg: 54.0,
      surfactantIndicated: true,
      surfactantBrand: 'curosurf_poractant_alfa',
      administrationMethod: 'lisa_mist_thin_catheter',
      surfactantAdministeredAt: new Date().toISOString().slice(0, 16),
      nivModality: 'bubble_cpap',
      currentPeepCmh2o: 6.0,
      currentFlowLpm: 6.0,
      currentFio2Percent: 35.0,
      status: 'surfactant_administered_stabilized',
      clinicalNotes: 'Preterm infant received LISA Curosurf 230 mg via 16G angiocatheter.',
    });

    expect(res.status).toBe(201);
    const ep = res.body.episode;
    expect(ep.episode_code).toMatch(/^RDS-/);
    expect(ep.surfactant_total_dose_mg).toBe(230); // 1.15 * 200
    expect(ep.surfactant_total_volume_ml).toBe(2.88); // 230 / 80

    // Verify audit record
    const auditRecord = db.prepare(
      `SELECT * FROM audit_events WHERE action = 'neonatal_rds.episode_create' AND entity = 'neonatal_rds_episodes'`
    ).get() as any;
    expect(auditRecord).toBeDefined();
    expect(auditRecord.detail).toContain(ep.episode_code);
  });

  it('allows nurses to log bedside NIV flowsheet with columella skin check', async () => {
    // 1. Create episode by doctor
    const epRes = await call('POST', '/api/neonatal-rds/episodes', doctor, {
      patientId,
      onsetDatetime: new Date().toISOString().slice(0, 16),
      gestationalAgeWeeks: 30.0,
      birthWeightKg: 1.4,
      currentWeightKg: 1.4,
      silvermanAndersonScore: 4,
      downesScore: 4,
      fio2RequirementPercent: 30.0,
      nivModality: 'bubble_cpap',
      currentPeepCmh2o: 5.0,
      currentFlowLpm: 6.0,
      currentFio2Percent: 30.0,
    });
    const epId = epRes.body.episode.id;

    // 2. Nurse logs flowsheet checkpoint
    const flowRes = await call('POST', `/api/neonatal-rds/episodes/${epId}/flowsheet`, nurse, {
      logDatetime: new Date().toISOString().slice(0, 16),
      hoursOnProtocol: 2.0,
      respiratoryRateBpm: 56,
      heartRateBpm: 138,
      spo2Percent: 94.0,
      silvermanScore: 3,
      downesScore: 3,
      peepCmh2o: 5.5,
      flowLpm: 6.0,
      fio2Percent: 28.0,
      nasalColumellaSkinCheck: 'intact',
      gastricDistension: 'none',
      notes: 'Water column bubbling vigorous; nasal prongs secure with 2mm gap from columella.',
    });

    expect(flowRes.status).toBe(201);
    expect(flowRes.body.log.nasal_columella_skin_check).toBe('intact');

    // 3. Fetch episode with flowsheet logs
    const getRes = await call('GET', `/api/neonatal-rds/episodes/${epId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.current_peep_cmh2o).toBe(5.5); // auto-updated
    expect(getRes.body.flowsheetLogs.length).toBe(1);
    expect(getRes.body.flowsheetLogs[0].logged_by_name).toContain('Sister Mary NICU');
  });

  it('prevents attender from creating RDS episodes (RBAC 403 Forbidden)', async () => {
    const res = await call('POST', '/api/neonatal-rds/episodes', attender, {
      patientId,
      onsetDatetime: new Date().toISOString().slice(0, 16),
      gestationalAgeWeeks: 32.0,
      birthWeightKg: 1.8,
      currentWeightKg: 1.8,
      silvermanAndersonScore: 3,
      downesScore: 3,
      fio2RequirementPercent: 25.0,
    });

    expect(res.status).toBe(403);
  });
});
