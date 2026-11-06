import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let motherId: number;

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
  for (const [username, role] of [['nurse1', 'nurse'], ['desk1', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse1');
  desk = await login('desk1');

  motherId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Pooja Hegde',
    dateOfBirth: '1994-08-20',
    phone: '9845012345',
    lastMenstrualPeriod: '2026-02-10',
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
  })).body.patient.id;
});

describe('Obstetric Postnatal Discharge Summary & Puerperium Care API', () => {
  it('creates an obstetric discharge summary without auto-creating baby patient', async () => {
    const res = await call('POST', `/api/patients/${motherId}/obstetric-discharges`, doctor, {
      dischargeDate: '2026-11-06',
      deliveryAt: '2026-11-04 10:15',
      deliveryMode: 'normal_vaginal',
      deliveryIndication: 'Spontaneous vertex delivery at term',
      deliveryNotes: 'Healthy live female infant born, spontaneous placental expulsion, minimal blood loss',
      primaryObstetrician: 'Dr. Rao, MD (OBGYN)',
      perineumWoundStatus: 'episiotomy_healed',
      perineumNotes: 'Right mediolateral episiotomy clean, sutures intact',
      fundalInvolution: 'contracted_normal',
      fundalHeightCm: 'Firm at umbilicus',
      lochiaCharacter: 'rubra',
      lochiaNotes: 'Normal lochia rubra without clots',
      lactationStatus: 'established',
      breastExamination: 'Soft, colostrum copious, nipples healthy',
      bladderBowelStatus: 'Voiding well, bowels moved',
      dischargeBpSystolic: 118,
      dischargeBpDiastolic: 76,
      dischargePulse: 74,
      dischargeTempF: 98.4,
      dischargeSpo2: 99,
      contraceptionCounselled: true,
      contraceptionChosen: 'progestin_only_pill',
      contraceptionNotes: 'Counselled on POP and LAM',
      dischargeMedicinesText: 'Tab Iron OD, Tab Calcium BD',
      alarmSignsCounselled: true,
      babyGender: 'female',
      babyBirthWeightGrams: 3150,
      babyDischargeWeightGrams: 3050,
      babyLengthCm: 50.0,
      babyHcCm: 34.5,
      babyGestationalAgeWeeks: 39,
      babyGestationalAgeDays: 4,
      babyApgar1min: 8,
      babyApgar5min: 9,
      babyCryAtBirth: 'immediate_vigorous',
      babyResuscitationDetails: 'Routine care, immediate skin-to-skin',
      babyBloodGroup: 'B+',
      neonatalExam: {
        tone: 'Active and alert',
        fontanelle: 'Soft and flat',
        cord: 'Clean and dry',
      },
      neonatalFeedingMethod: 'exclusive_breastfeeding',
      meconiumPassed: true,
      urinePassed: true,
      jaundiceAssessment: 'none',
      bcgGiven: true,
      bcgDate: '2026-11-05',
      opvZeroGiven: true,
      opvZeroDate: '2026-11-05',
      hepbBirthGiven: true,
      hepbBirthDate: '2026-11-04',
      hearingScreenResult: 'pass',
      metabolicScreenResult: 'normal',
      maternalFollowupDate: '2026-11-13',
      newbornFollowupDate: '2026-12-16',
      consultantSpecialInstructions: 'Return immediately if excessive bleeding or fever',
      status: 'finalized',
      autoCreateBabyPatient: false,
    });

    expect(res.status).toBe(201);
    expect(res.body.patientId).toBe(motherId);
    expect(res.body.deliveryMode).toBe('normal_vaginal');
    expect(res.body.babyBirthWeightGrams).toBe(3150);
    expect(res.body.babyApgar1min).toBe(8);
    expect(res.body.babyApgar5min).toBe(9);
    expect(res.body.contraceptionChosen).toBe('progestin_only_pill');
    expect(res.body.babyPediatricPatientId).toBeNull();

    // Verify audit event
    const auditRows = db.prepare("SELECT * FROM audit_events WHERE action = 'obstetric_discharge.create'").all();
    expect(auditRows.length).toBe(1);
  });

  it('automatically registers baby patient, pediatric profile, and birth vaccines when autoCreateBabyPatient is true', async () => {
    const res = await call('POST', `/api/patients/${motherId}/obstetric-discharges`, doctor, {
      dischargeDate: '2026-11-06',
      deliveryAt: '2026-11-04 15:45',
      deliveryMode: 'emergency_lscs',
      deliveryIndication: 'Fetal distress in secondary arrest of labor',
      deliveryNotes: 'Emergency lower segment cesarean section performed under spinal anesthesia',
      primaryObstetrician: 'Dr. Rao, MD',
      perineumWoundStatus: 'lscs_wound_clean',
      perineumNotes: 'Pfannenstiel dressing intact, wound clean and dry',
      fundalInvolution: 'contracted_normal',
      fundalHeightCm: 'Well contracted, 20w size',
      lochiaCharacter: 'rubra',
      lactationStatus: 'initiating',
      contraceptionCounselled: true,
      contraceptionChosen: 'undecided',
      babyName: 'Baby Boy of Pooja',
      babyGender: 'male',
      babyBirthWeightGrams: 3400,
      babyDischargeWeightGrams: 3300,
      babyLengthCm: 51.0,
      babyHcCm: 35.0,
      babyGestationalAgeWeeks: 38,
      babyGestationalAgeDays: 5,
      babyApgar1min: 7,
      babyApgar5min: 9,
      babyCryAtBirth: 'immediate_vigorous',
      babyBloodGroup: 'O+',
      neonatalFeedingMethod: 'exclusive_breastfeeding',
      meconiumPassed: true,
      urinePassed: true,
      jaundiceAssessment: 'none',
      bcgGiven: true,
      bcgDate: '2026-11-05',
      opvZeroGiven: true,
      opvZeroDate: '2026-11-05',
      hepbBirthGiven: true,
      hepbBirthDate: '2026-11-04',
      status: 'finalized',
      autoCreateBabyPatient: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.babyPediatricPatientId).toBeGreaterThan(0);
    const babyId = res.body.babyPediatricPatientId;

    // Verify Baby patient record in database
    const babyPat = db.prepare('SELECT * FROM patients WHERE id = ?').get(babyId) as any;
    expect(babyPat).toBeDefined();
    expect(babyPat.full_name).toBe('Baby Boy of Pooja');
    expect(babyPat.date_of_birth).toBe('2026-11-04');
    expect(babyPat.phone).toBe('9845012345'); // inherits mother's phone

    // Verify Pediatric profile in patient_pediatric_profiles
    const pedProfile = db.prepare('SELECT * FROM patient_pediatric_profiles WHERE patient_id = ?').get(babyId) as any;
    expect(pedProfile).toBeDefined();
    expect(pedProfile.birth_weight_kg).toBe(3.4);
    expect(pedProfile.delivery_type).toBe('cesarean');
    expect(pedProfile.apgar_1min).toBe(7);
    expect(pedProfile.apgar_5min).toBe(9);
    expect(pedProfile.blood_group).toBe('O+');

    // Verify Birth vaccines in patient_vaccinations
    const vaccines = db.prepare('SELECT * FROM patient_vaccinations WHERE patient_id = ? ORDER BY vaccine_key').all(babyId) as any[];
    expect(vaccines.length).toBe(3);
    const vKeys = vaccines.map((v) => v.vaccine_key);
    expect(vKeys).toContain('bcg');
    expect(vKeys).toContain('opv_0');
    expect(vKeys).toContain('hepb_0');
    expect(vaccines.every((v) => v.status === 'given')).toBe(true);
  });

  it('supports 1-click registration of baby record post-hoc on existing discharge', async () => {
    // 1. Create discharge without baby patient
    const createRes = await call('POST', `/api/patients/${motherId}/obstetric-discharges`, nurse, {
      dischargeDate: '2026-11-06',
      deliveryMode: 'normal_vaginal',
      babyGender: 'female',
      babyBirthWeightGrams: 2800,
      babyGestationalAgeWeeks: 39,
      babyApgar1min: 9,
      babyApgar5min: 10,
      bcgGiven: true,
      opvZeroGiven: true,
      hepbBirthGiven: true,
      autoCreateBabyPatient: false,
    });
    expect(createRes.status).toBe(201);
    const dischargeId = createRes.body.id;
    expect(createRes.body.babyPediatricPatientId).toBeNull();

    // 2. Call create-baby-record endpoint
    const babyRes = await call('POST', `/api/obstetric-discharges/${dischargeId}/create-baby-record`, nurse);
    expect(babyRes.status).toBe(200);
    expect(babyRes.body.ok).toBe(true);
    expect(babyRes.body.babyPatientId).toBeGreaterThan(0);

    // 3. Subsequent call returns alreadyCreated
    const secondCall = await call('POST', `/api/obstetric-discharges/${dischargeId}/create-baby-record`, nurse);
    expect(secondCall.status).toBe(200);
    expect(secondCall.body.alreadyCreated).toBe(true);

    // 4. Verify fetch includes baby info
    const getRes = await call('GET', `/api/obstetric-discharges/${dischargeId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.babyPediatricPatientId).toBe(babyRes.body.babyPatientId);
    expect(getRes.body.babyPatientName).toBe('Baby of Pooja Hegde');
  });

  it('allows updating fields via PATCH and deleting via DELETE', async () => {
    const createRes = await call('POST', `/api/patients/${motherId}/obstetric-discharges`, doctor, {
      dischargeDate: '2026-11-06',
      deliveryMode: 'elective_lscs',
      babyGender: 'male',
      status: 'draft',
      autoCreateBabyPatient: false,
    });
    const dischargeId = createRes.body.id;

    // PATCH update
    const patchRes = await call('PATCH', `/api/obstetric-discharges/${dischargeId}`, doctor, {
      fundalInvolution: 'well_contracted',
      lochiaCharacter: 'serosa',
      contraceptionChosen: 'ppiucd_inserted',
      status: 'finalized',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.fundalInvolution).toBe('well_contracted');
    expect(patchRes.body.lochiaCharacter).toBe('serosa');
    expect(patchRes.body.contraceptionChosen).toBe('ppiucd_inserted');
    expect(patchRes.body.status).toBe('finalized');

    // DELETE
    const delRes = await call('DELETE', `/api/obstetric-discharges/${dischargeId}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    // Verify 404
    const getRes = await call('GET', `/api/obstetric-discharges/${dischargeId}`, doctor);
    expect(getRes.status).toBe(404);
  });

  it('enforces RBAC: attender is forbidden from managing discharge summaries', async () => {
    // Attender cannot create
    const createRes = await call('POST', `/api/patients/${motherId}/obstetric-discharges`, desk, {
      dischargeDate: '2026-11-06',
      deliveryMode: 'normal_vaginal',
    });
    expect(createRes.status).toBe(403);

    // Doctor creates one
    const docCreate = await call('POST', `/api/patients/${motherId}/obstetric-discharges`, doctor, {
      dischargeDate: '2026-11-06',
      deliveryMode: 'normal_vaginal',
      autoCreateBabyPatient: false,
    });
    const dischargeId = docCreate.body.id;

    // Attender cannot update
    const patchRes = await call('PATCH', `/api/obstetric-discharges/${dischargeId}`, desk, {
      deliveryNotes: 'Unauthorized update',
    });
    expect(patchRes.status).toBe(403);

    // Attender cannot delete
    const delRes = await call('DELETE', `/api/obstetric-discharges/${dischargeId}`, desk);
    expect(delRes.status).toBe(403);
  });
});
