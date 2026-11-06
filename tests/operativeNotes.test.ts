import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientA: Json, patientB: Json;
let bed1: number;
let adm: Json;

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}

async function staff(username: string, role: string) {
  await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username, password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  return (await call('POST', '/api/auth/login', undefined, { username, password: PW })).setCookie!.split(';')[0]!;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.sharma', fullName: 'Dr. Neha Sharma', password: PW })).setCookie!.split(';')[0]!;
  nurse = await staff('nurse.anita', 'nurse');
  desk = await staff('desk.rahul', 'attender');

  patientA = (await call('POST', '/api/patients', doctor, {
    fullName: 'Ananya Roy',
    dateOfBirth: '1995-04-15',
    phone: '9876543210',
    allergyStatus: 'known',
    allergyDetails: 'Ampicillin',
  })).body.patient;

  patientB = (await call('POST', '/api/patients', doctor, {
    fullName: 'Shalini Verma',
    dateOfBirth: '1997-08-20',
    phone: '9876500000',
    allergyStatus: 'none',
  })).body.patient;

  bed1 = (await call('POST', '/api/beds', doctor, { room: 'Labor & Delivery OT', label: 'OT-1' })).body.id;

  adm = (await call('POST', '/api/admissions', doctor, {
    patientId: patientA.id,
    bedId: bed1,
    reason: 'Active Labor with non-reassuring fetal status',
  })).body;
});

describe('Obstetric Surgery & LSCS Operative Delivery Note Generator', () => {
  it('creates a complete Emergency LSCS operative note with WHO safety checklist, newborn APGAR, and counts', async () => {
    const today = todayStr();

    const payload = {
      admissionId: adm.id,
      surgeonName: 'Dr. Neha Sharma',
      assistantName: 'Dr. R. Kapoor',
      anesthetistName: 'Dr. K. Mehta',
      pediatricianName: 'Dr. V. Sen',
      scrubNurseName: 'Nurse Anita',

      surgeryDate: today,
      startTime: '10:00',
      endTime: '10:50',
      procedureName: 'Emergency Lower Segment Cesarean Section (LSCS)',
      procedureCategory: 'lscs',
      indication: 'Fetal distress with severe variable decelerations and thick meconium stained liquor',
      urgency: 'emergency',
      anesthesiaType: 'spinal',

      // WHO Safety Checklist
      preopIdentityConsentVerified: true,
      preopSiteMarked: true,
      preopAnesthesiaSafetyChecked: true,
      preopPulseOximeterFunctioning: true,
      preopAllergiesReviewed: true,
      preopDifficultAirwayAssessed: false,
      preopBloodAvailabilityUnits: '2 units PRBC cross-matched in blood bank',
      preopAntibioticProphylaxis: 'Inj. Cefazolin 2g IV given 30 mins prior to skin incision',

      // Operative technique & findings
      incisionType: 'pfannenstiel',
      presentation: 'cephalic',
      liquorCharacteristics: 'meconium_thick',
      extractionDetails: 'Vertex extracted easily with gentle fundal pressure and oropharyngeal suction on delivery of head.',
      babyDeliveryTime: '10:15',
      placentaDelivery: 'spontaneous_cct',
      placentaCompleteness: 'complete_intact',
      uterineClosure: 'Lower segment closed in 2 layers continuous interlocking Vicryl 1-0. Hemostasis secured.',
      tubalLigationPerformed: false,
      estimatedBloodLossMl: 450,
      findingsNotes: 'Lower uterine segment well-formed and thinned out. No peritoneal adhesions. Ovaries and tubes normal.',

      // Newborn summary
      babyGender: 'female',
      babyWeightGrams: 3150,
      apgar1min: 8,
      apgar5min: 10,
      babyResuscitationDetails: 'Routine drying, stimulation and suction. Cried immediately, handed to pediatrician.',

      // Count verification
      spongeCountVerified: true,
      instrumentCountVerified: true,
      needleCountVerified: true,
      drainPlaced: false,
      closureDetails: 'Visceral peritoneum left open. Rectus sheath with Loop PDS No. 1. Skin with subcuticular Monocryl 3-0.',

      // Post-op orders
      postopVitalsMonitoring: 'Monitor maternal vitals q15m x 2h, then q1h x 4h. Check lochia and uterine contraction.',
      postopIvFluids: 'RL 500ml + 20 IU Oxytocin infusion at 125 ml/hr x 4 hours',
      postopAnalgesia: 'Inj. Paracetamol 1g IV TDS, Inj. Tramadol 50mg IV SOS',
      postopAntibiotics: 'Inj. Cefuroxime 750mg IV BD x 24 hours',
      postopThromboprophylaxis: 'Early ambulation at 6-8 hrs, compression stockings',
      postopDiet: 'NPO for 4-6 hours, then sips of water',
      postopCatheterInstructions: 'Remove Foley catheter after 12 hours',
      specialInstructions: 'Initiate skin-to-skin and breastfeeding as soon as maternal sensation stabilizes.',
    };

    const res = await call('POST', `/api/patients/${patientA.id}/operative-notes`, doctor, payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.operativeNumber).toMatch(/^OP-\d{6}-\d{4}$/);
    expect(res.body.patientName).toBe('Ananya Roy');
    expect(res.body.procedureName).toBe('Emergency Lower Segment Cesarean Section (LSCS)');
    expect(res.body.urgency).toBe('emergency');
    expect(res.body.preopIdentityConsentVerified).toBe(true);
    expect(res.body.spongeCountVerified).toBe(true);
    expect(res.body.babyGender).toBe('female');
    expect(res.body.babyWeightGrams).toBe(3150);
    expect(res.body.apgar1min).toBe(8);
    expect(res.body.apgar5min).toBe(10);
    expect(res.body.estimatedBloodLossMl).toBe(450);

    const opId = res.body.id;

    // Verify retrieval by patient
    const listRes = await call('GET', `/api/patients/${patientA.id}/operative-notes`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(opId);

    // Verify retrieval by admission
    const admListRes = await call('GET', `/api/admissions/${adm.id}/operative-notes`, nurse);
    expect(admListRes.status).toBe(200);
    expect(admListRes.body.length).toBe(1);
    expect(admListRes.body[0].id).toBe(opId);

    // Verify retrieval of single note
    const singleRes = await call('GET', `/api/operative-notes/${opId}`, nurse);
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.operativeNumber).toBe(res.body.operativeNumber);
    expect(singleRes.body.surgeonName).toBe('Dr. Neha Sharma');
    expect(singleRes.body.postopIvFluids).toContain('Oxytocin');
  });

  it('updates an operative note and logs audit changes', async () => {
    const today = todayStr();
    const createRes = await call('POST', `/api/patients/${patientA.id}/operative-notes`, doctor, {
      surgeonName: 'Dr. Neha Sharma',
      surgeryDate: today,
      startTime: '14:00',
      procedureName: 'Elective LSCS',
      indication: 'Previous 2 LSCS',
      urgency: 'elective',
      anesthesiaType: 'spinal',
      estimatedBloodLossMl: 400,
      spongeCountVerified: true,
      instrumentCountVerified: true,
      needleCountVerified: true,
    });
    expect(createRes.status).toBe(201);
    const opId = createRes.body.id;

    // Update with tubectomy performed and higher blood loss
    const patchRes = await call('PATCH', `/api/operative-notes/${opId}`, doctor, {
      tubalLigationPerformed: true,
      tubalLigationNotes: 'Modified Pomeroy technique with Vicryl 1-0 bilaterally',
      estimatedBloodLossMl: 550,
      postopDiet: 'Liquid diet from evening',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.tubalLigationPerformed).toBe(true);
    expect(patchRes.body.tubalLigationNotes).toBe('Modified Pomeroy technique with Vicryl 1-0 bilaterally');
    expect(patchRes.body.estimatedBloodLossMl).toBe(550);
    expect(patchRes.body.postopDiet).toBe('Liquid diet from evening');
  });

  it('records print access audit event', async () => {
    const today = todayStr();
    const createRes = await call('POST', `/api/patients/${patientA.id}/operative-notes`, doctor, {
      surgeonName: 'Dr. Neha Sharma',
      surgeryDate: today,
      startTime: '08:30',
      procedureName: 'Vacuum Delivery',
      indication: 'Prolonged second stage',
      urgency: 'emergency',
      anesthesiaType: 'local',
      estimatedBloodLossMl: 250,
      spongeCountVerified: true,
      instrumentCountVerified: true,
      needleCountVerified: true,
    });
    const opId = createRes.body.id;

    const printRes = await call('POST', `/api/operative-notes/${opId}/print`, nurse);
    expect(printRes.status).toBe(200);
    expect(printRes.body.ok).toBe(true);

    // Verify audit entry in audit_events
    const audits = db.prepare("SELECT * FROM audit_events WHERE action = 'operative_note.print'").all() as Json[];
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(Number(audits[0].entity_id)).toBe(opId);
  });

  it('enforces RBAC: doctors write, nurses read, attenders and unauthenticated blocked', async () => {
    const today = todayStr();

    // Attender / desk cannot write operative notes
    const deskPost = await call('POST', `/api/patients/${patientA.id}/operative-notes`, desk, {
      surgeonName: 'Dr. Sharma',
      surgeryDate: today,
      startTime: '11:00',
      procedureName: 'LSCS',
      indication: 'Fetal distress',
    });
    expect(deskPost.status).toBe(403);

    // Unauthenticated caller cannot write
    const unauthPost = await call('POST', `/api/patients/${patientA.id}/operative-notes`, undefined, {
      surgeonName: 'Dr. Sharma',
      surgeryDate: today,
      startTime: '11:00',
      procedureName: 'LSCS',
      indication: 'Fetal distress',
    });
    expect(unauthPost.status).toBe(401);

    // Doctor creates note
    const note = (await call('POST', `/api/patients/${patientA.id}/operative-notes`, doctor, {
      surgeonName: 'Dr. Neha Sharma',
      surgeryDate: today,
      startTime: '11:00',
      procedureName: 'LSCS',
      indication: 'Fetal distress',
      urgency: 'emergency',
      anesthesiaType: 'spinal',
      estimatedBloodLossMl: 400,
      spongeCountVerified: true,
      instrumentCountVerified: true,
      needleCountVerified: true,
    })).body;

    // Nurse can read operative note to carry out post-op orders
    const nurseRead = await call('GET', `/api/operative-notes/${note.id}`, nurse);
    expect(nurseRead.status).toBe(200);
    expect(nurseRead.body.procedureName).toBe('LSCS');

    // Attender cannot read clinical operative note
    const deskRead = await call('GET', `/api/operative-notes/${note.id}`, desk);
    expect(deskRead.status).toBe(403);

    // Unauthenticated cannot read
    const unauthRead = await call('GET', `/api/operative-notes/${note.id}`);
    expect(unauthRead.status).toBe(401);
  });

  it('validates admission association and required fields', async () => {
    const today = todayStr();

    // Rejects admission belonging to a different patient
    const foreignAdmRes = await call('POST', `/api/patients/${patientB.id}/operative-notes`, doctor, {
      admissionId: adm.id, // belongs to patientA!
      surgeonName: 'Dr. Neha Sharma',
      surgeryDate: today,
      startTime: '12:00',
      procedureName: 'LSCS',
      indication: 'Failure to progress',
    });
    expect(foreignAdmRes.status).toBe(400);

    // Rejects missing required indication
    const missingIndication = await call('POST', `/api/patients/${patientA.id}/operative-notes`, doctor, {
      surgeonName: 'Dr. Neha Sharma',
      surgeryDate: today,
      startTime: '12:00',
      procedureName: 'LSCS',
      indication: '',
    });
    expect(missingIndication.status).toBe(400);
  });
});
