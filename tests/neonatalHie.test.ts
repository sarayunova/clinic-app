import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { evaluateNeonatalHie } from '../web/src/neonatalHieEngine.js';

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
describe('Neonatal HIE & Therapeutic Hypothermia Engine (Pure Unit Tests)', () => {
  it('correctly stages Sarnat Stage II Moderate HIE and confirms TOBY cooling eligibility within 6 hours', () => {
    const result = evaluateNeonatalHie({
      gestationalAgeWeeks: 38.5,
      birthWeightKg: 3.1,
      hoursFromBirth: 2.5,
      cordOrArterialPh: 6.94, // Criteria A: < 7.00
      baseDeficitMmolL: 18.0, // Criteria A: >= 16 mmol/L
      apgar10m: 4, // Criteria A: <= 5
      resuscitationDurationMinutes: 12,
      levelOfConsciousness: 'lethargic_obtunded',
      muscleTone: 'hypotonic',
      primitiveReflexesSuckMoro: 'weak_incomplete',
      autonomicFunction: 'sympathetic_parasympathetic_skew',
      clinicalSeizuresPresent: true,
    });

    expect(result.sarnatStage).toBe('stage_II_moderate');
    expect(result.isCoolingEligible).toBe(true);
    expect(result.timeWindowStatus).toBe('optimal_under_6h');
    expect(result.coolingProtocolSummary.targetCoreTempCelsius).toBe(33.5);
    expect(result.coolingProtocolSummary.coolingDurationHours).toBe(72);
    expect(result.coolingProtocolSummary.rewarmingRateCelsiusPerHour).toBe(0.5);
    expect(result.coolingProtocolSummary.rewarmingDurationHours).toBe(6);
  });

  it('correctly stages Sarnat Stage III Severe HIE with stupor and flaccid tone', () => {
    const result = evaluateNeonatalHie({
      gestationalAgeWeeks: 39.0,
      birthWeightKg: 3.4,
      hoursFromBirth: 3.0,
      cordOrArterialPh: 6.85,
      baseDeficitMmolL: 22.0,
      apgar10m: 2,
      resuscitationDurationMinutes: 20,
      levelOfConsciousness: 'stuporous_comatose',
      muscleTone: 'flaccid',
      primitiveReflexesSuckMoro: 'absent',
      autonomicFunction: 'depressed_bradycardia',
      clinicalSeizuresPresent: true,
    });

    expect(result.sarnatStage).toBe('stage_III_severe');
    expect(result.isCoolingEligible).toBe(true);
    expect(result.contraindicationsOrExclusions).toHaveLength(0);
  });

  it('rejects cooling eligibility if presentation is delayed past the 6-hour initiation window', () => {
    const result = evaluateNeonatalHie({
      gestationalAgeWeeks: 38.0,
      birthWeightKg: 3.0,
      hoursFromBirth: 7.5, // > 6 hours
      cordOrArterialPh: 6.92,
      baseDeficitMmolL: 17.0,
      levelOfConsciousness: 'lethargic_obtunded',
      muscleTone: 'hypotonic',
      primitiveReflexesSuckMoro: 'weak_incomplete',
      autonomicFunction: 'sympathetic_parasympathetic_skew',
      clinicalSeizuresPresent: false,
    });

    expect(result.timeWindowStatus).toBe('window_closed_over_6h');
    expect(result.isCoolingEligible).toBe(false);
    expect(result.contraindicationsOrExclusions.some(c => c.includes('> 6.0 hours'))).toBe(true);
  });

  it('rejects cooling eligibility for preterms < 36 weeks gestational age', () => {
    const result = evaluateNeonatalHie({
      gestationalAgeWeeks: 34.0, // < 35 weeks
      birthWeightKg: 2.0,
      hoursFromBirth: 1.5,
      cordOrArterialPh: 6.90,
      baseDeficitMmolL: 19.0,
      levelOfConsciousness: 'lethargic_obtunded',
      muscleTone: 'hypotonic',
      primitiveReflexesSuckMoro: 'weak_incomplete',
      autonomicFunction: 'sympathetic_parasympathetic_skew',
      clinicalSeizuresPresent: false,
    });

    expect(result.isCoolingEligible).toBe(false);
    expect(result.contraindicationsOrExclusions.some(c => c.includes('< 35.0 wks'))).toBe(true);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Neonatal HIE & TTM REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.neonatologist',
      fullName: 'Dr. Sneha Roy (Neonatologist)',
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
      fullName: 'Baby of Kavita',
      dateOfBirth: new Date().toISOString().slice(0, 10),
      phone: '+91 98765 22222',
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('allows doctor to create HIE assessment and auto-calculates Sarnat stage and TOBY eligibility', async () => {
    const birthTime = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const assessTime = new Date().toISOString();

    const res = await call('POST', '/api/neonatal-hie/assessments', doctor, {
      patientId,
      birthDatetime: birthTime,
      assessmentDatetime: assessTime,
      gestationalAgeWeeks: 38.5,
      birthWeightKg: 3.1,
      apgar10m: 4,
      resuscitationDurationMinutes: 12,
      cordOrArterialPh: 6.95,
      baseDeficitMmolL: 18.0,
      levelOfConsciousness: 'lethargic_obtunded',
      muscleTone: 'hypotonic',
      primitiveReflexesSuckMoro: 'weak_incomplete',
      autonomicFunction: 'sympathetic_parasympathetic_skew',
      clinicalSeizuresPresent: true,
      coolingDeviceType: 'servo_controlled_cooling_blanket',
      targetCoreTempCelsius: 33.5,
      protocolStatus: 'cooling_active',
      clinicalNotes: 'Severe perinatal asphyxia. Cooling initiated at 2 hours of life.',
    });

    expect(res.status).toBe(201);
    expect(res.body.assessment).toBeDefined();
    expect(res.body.assessment.sarnat_stage).toBe('stage_II_moderate');
    expect(res.body.assessment.cooling_criteria_met).toBe(1);
    expect(res.body.calculation.isCoolingEligible).toBe(true);

    // Verify audit log
    const auditRow = db.prepare('SELECT action FROM audit_events WHERE entity = ?').get('neonatal_hie_assessments') as any;
    expect(auditRow).toBeDefined();
    expect(auditRow.action).toBe('neonatal_hie.assessment_create');
  });

  it('allows nurse to record hourly TTM flowsheet logs and query history', async () => {
    const birthTime = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const assessTime = new Date().toISOString();

    const createRes = await call('POST', '/api/neonatal-hie/assessments', doctor, {
      patientId,
      birthDatetime: birthTime,
      assessmentDatetime: assessTime,
      gestationalAgeWeeks: 39.0,
      birthWeightKg: 3.2,
      cordOrArterialPh: 6.92,
      baseDeficitMmolL: 17.5,
      levelOfConsciousness: 'lethargic_obtunded',
      muscleTone: 'hypotonic',
      primitiveReflexesSuckMoro: 'weak_incomplete',
      autonomicFunction: 'sympathetic_parasympathetic_skew',
      clinicalSeizuresPresent: false,
    });
    const assessmentId = createRes.body.assessment.id;

    // Nurse logs Hour 1 flowsheet
    const log1 = await call('POST', `/api/neonatal-hie/assessments/${assessmentId}/flowsheet`, nurse, {
      hoursIntoProtocol: 1,
      logDatetime: new Date().toISOString(),
      coreTemperatureCelsius: 33.5,
      skinTemperatureCelsius: 33.0,
      phase: 'maintenance_cooling',
      heartRateBpm: 110,
      meanArterialPressureMmhg: 45,
      bloodGlucoseMgDl: 85,
      serumPotassiumMeqL: 4.2,
      aeegBackgroundPattern: 'discontinuous_normal_voltage_dnv',
      aeegSleepWakeCycling: false,
      electrographicSeizuresDetected: false,
      inotropicSupport: 'Dopamine 5 mcg/kg/min',
      notes: 'Blanket temp servo-controlled. Baby resting comfortably.',
    });

    expect(log1.status).toBe(201);
    expect(log1.body.log.core_temperature_celsius).toBe(33.5);

    // Query assessment detail
    const detail = await call('GET', `/api/neonatal-hie/assessments/${assessmentId}`, doctor);
    expect(detail.status).toBe(200);
    expect(detail.body.flowsheetLogs).toHaveLength(1);
    expect(detail.body.flowsheetLogs[0].hours_into_protocol).toBe(1);

    // Audit print
    const printRes = await call('POST', `/api/neonatal-hie/assessments/${assessmentId}/print`, doctor);
    expect(printRes.status).toBe(200);
    const printAudit = db.prepare('SELECT action FROM audit_events WHERE action = ?').get('neonatal_hie.print') as any;
    expect(printAudit).toBeDefined();
  });

  it('rejects clinical writes by unprivileged attender role with 403 Forbidden', async () => {
    const res = await call('POST', '/api/neonatal-hie/assessments', attender, {
      patientId,
      birthDatetime: new Date().toISOString(),
      assessmentDatetime: new Date().toISOString(),
      gestationalAgeWeeks: 38.0,
      birthWeightKg: 3.0,
      levelOfConsciousness: 'hyperalert',
      muscleTone: 'normal',
      primitiveReflexesSuckMoro: 'normal_exaggerated',
      autonomicFunction: 'normal',
    });

    expect(res.status).toBe(403);
  });
});
