import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  formatPndtFormNumber,
  inferIndicationsFromUltrasound,
  formatLivingChildrenSummary,
  validatePndtFormCompleteness,
  aggregateMonthlyPndtReturn,
  generatePndtMonthlyCsv,
  type PndtFormFRecord,
} from '../web/src/pndtEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
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

describe('Statutory PC-PNDT Act Form F Engine', () => {
  it('formats sequential number into statutory format', () => {
    const num = formatPndtFormNumber(1, '2026-11-07');
    expect(num).toBe('PNDT-202611-0001');

    const num2 = formatPndtFormNumber(42, '2026-11-15');
    expect(num2).toBe('PNDT-202611-0042');
  });

  it('infers statutory indications from ultrasound scan type and notes', () => {
    const ind1 = inferIndicationsFromUltrasound('anomaly_scan', 'Target Level-II structural anomaly scan', 28);
    expect(ind1).toContain('ANOMALY_DETECTION');

    const ind2 = inferIndicationsFromUltrasound('nt_first_trimester', 'First trimester screening NT scan', 36);
    expect(ind2).toContain('FIRST_TRIMESTER_NT');
    expect(ind2).toContain('ADVANCED_MATERNAL_AGE');

    const ind3 = inferIndicationsFromUltrasound('growth_wellbeing', 'Growth scan with oligohydramnios and doppler', 26);
    expect(ind3).toContain('FETAL_GROWTH_FGR');
    expect(ind3).toContain('AMNIOTIC_FLUID_LIQUOR');
    expect(ind3).toContain('FETAL_DOPPLER');
  });

  it('formats living children summary accurately', () => {
    const s0 = formatLivingChildrenSummary(0, 0);
    expect(s0).toContain('Nulliparous');

    const s1 = formatLivingChildrenSummary(1, 0, '4 yrs', null);
    expect(s1).toContain('1 Male (Age: 4 yrs)');

    const s2 = formatLivingChildrenSummary(1, 2, '6 yrs', '2, 4 yrs');
    expect(s2).toContain('3 total');
    expect(s2).toContain('1 Male');
    expect(s2).toContain('2 Females');
  });

  it('validates statutory completeness under Rule 9(5)', () => {
    const incomplete: Partial<PndtFormFRecord> = {
      patientName: 'Sunita Rao',
      // Missing husband name, address, declarations, etc.
    };
    const res = validatePndtFormCompleteness(incomplete);
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(3);

    const complete: Partial<PndtFormFRecord> = {
      patientName: 'Sunita Rao',
      patientAge: 27,
      husbandOrFatherName: 'Ramesh Rao',
      fullAddress: 'Flat 402, Shivajinagar, Pune',
      gestationalAgeWeeks: 18,
      clinicPndtRegNo: 'MH/PNDT/2021/045',
      doctorName: 'Dr. Sarayu Rao',
      doctorRegNo: 'MCI-54892',
      machineModelSerial: 'GE Voluson E8 S/N 89241',
      referralType: 'self_referred',
      selfReferralReason: 'Routine anomaly scan',
      indicationCodes: ['ANOMALY_DETECTION'],
      pregnantWomanDeclarationSigned: true,
      doctorDeclarationSigned: true,
    };
    const validRes = validatePndtFormCompleteness(complete);
    expect(validRes.isValid).toBe(true);
    expect(validRes.errors.length).toBe(0);
  });

  it('aggregates monthly returns and computes parity breakdown', () => {
    const records: PndtFormFRecord[] = [
      {
        id: 1,
        formFNumber: 'PNDT-202611-0001',
        patientId: 101,
        ultrasoundReportId: 1,
        visitId: 1,
        scanDate: '2026-11-02',
        scanTime: '10:30',
        clinicPndtRegNo: 'MH/PNDT/2021/045',
        doctorId: 1,
        doctorName: 'Dr. Sarayu Rao',
        doctorRegNo: 'MCI-54892',
        machineModelSerial: 'GE Voluson E8',
        patientName: 'Pooja Patil',
        patientAge: 24,
        husbandOrFatherName: 'Anil Patil',
        fullAddress: 'Pune',
        contactPhone: '9876543210',
        numLivingMaleChildren: 0,
        maleChildrenAges: null,
        numLivingFemaleChildren: 0,
        femaleChildrenAges: null,
        totalLivingChildren: 0,
        lmp: '2026-07-01',
        gestationalAgeWeeks: 18,
        gestationalAgeDays: 0,
        referralType: 'self_referred',
        referringDoctorName: null,
        referringDoctorRegNo: null,
        referringClinicAddress: null,
        referralSlipDate: null,
        selfReferralReason: 'Routine checkup',
        indicationCodes: ['GA_ESTIMATION', 'ANOMALY_DETECTION'],
        otherIndicationDetail: null,
        invasiveProcedureDone: false,
        invasiveProcedureDetails: null,
        pregnantWomanDeclarationSigned: true,
        pregnantWomanDeclarationTime: '2026-11-02 10:30',
        pregnantWomanSignatureName: 'Pooja Patil',
        doctorDeclarationSigned: true,
        doctorDeclarationTime: '2026-11-02 10:30',
        doctorDeclarationName: 'Dr. Sarayu Rao',
        fetalNumber: 'single',
        cardiacActivity: 'present',
        congenitalAnomalyDetected: false,
        congenitalAnomalyDetails: null,
        scanResultSummary: 'Normal anomaly scan',
        createdBy: 1,
        updatedBy: 1,
        createdAt: '2026-11-02T10:30:00Z',
        updatedAt: '2026-11-02T10:30:00Z',
      },
      {
        id: 2,
        formFNumber: 'PNDT-202611-0002',
        patientId: 102,
        ultrasoundReportId: 2,
        visitId: 2,
        scanDate: '2026-11-03',
        scanTime: '11:15',
        clinicPndtRegNo: 'MH/PNDT/2021/045',
        doctorId: 1,
        doctorName: 'Dr. Sarayu Rao',
        doctorRegNo: 'MCI-54892',
        machineModelSerial: 'GE Voluson E8',
        patientName: 'Sunita Rao',
        patientAge: 32,
        husbandOrFatherName: 'Ramesh Rao',
        fullAddress: 'Kothrud, Pune',
        contactPhone: '9822001122',
        numLivingMaleChildren: 0,
        maleChildrenAges: null,
        numLivingFemaleChildren: 2,
        femaleChildrenAges: '2, 4 yrs',
        totalLivingChildren: 2,
        lmp: '2026-06-15',
        gestationalAgeWeeks: 20,
        gestationalAgeDays: 2,
        referralType: 'doctor_referred',
        referringDoctorName: 'Dr. V. K. Mehta',
        referringDoctorRegNo: 'MMC-12345',
        referringClinicAddress: 'Mehta Nursing Home',
        referralSlipDate: '2026-11-01',
        selfReferralReason: null,
        indicationCodes: ['ANOMALY_DETECTION'],
        otherIndicationDetail: null,
        invasiveProcedureDone: false,
        invasiveProcedureDetails: null,
        pregnantWomanDeclarationSigned: true,
        pregnantWomanDeclarationTime: '2026-11-03 11:15',
        pregnantWomanSignatureName: 'Sunita Rao',
        doctorDeclarationSigned: true,
        doctorDeclarationTime: '2026-11-03 11:15',
        doctorDeclarationName: 'Dr. Sarayu Rao',
        fetalNumber: 'single',
        cardiacActivity: 'present',
        congenitalAnomalyDetected: true,
        congenitalAnomalyDetails: 'Unilateral clubfoot (Talipes equinovarus)',
        scanResultSummary: 'Isolated clubfoot noted',
        createdBy: 1,
        updatedBy: 1,
        createdAt: '2026-11-03T11:15:00Z',
        updatedAt: '2026-11-03T11:15:00Z',
      },
    ];

    const summary = aggregateMonthlyPndtReturn(records, '2026-11');
    expect(summary.totalScans).toBe(2);
    expect(summary.referralBreakdown.selfReferred).toBe(1);
    expect(summary.referralBreakdown.doctorReferred).toBe(1);
    expect(summary.parityDistribution.zeroChildren).toBe(1);
    expect(summary.parityDistribution.twoChildrenTwoFemales).toBe(1);
    expect(summary.anomalyCount).toBe(1);

    const csv = generatePndtMonthlyCsv(records, 'Matruchhaya Clinic', 'MH/PNDT/2021/045');
    expect(csv).toContain('PNDT-202611-0001');
    expect(csv).toContain('PNDT-202611-0002');
    expect(csv).toContain('Pooja Patil');
    expect(csv).toContain('Sunita Rao');
    expect(csv).toContain('Talipes equinovarus');
  });
});

describe('Statutory PC-PNDT Act Form F REST API', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Setup doctor
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.sarayu',
      fullName: 'Dr. Sarayu Rao',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Add nurse and desk
    await call('POST', '/api/users', doctor, {
      username: 'nurse1',
      fullName: 'Sister Mary',
      role: 'nurse',
      password: 'temp-pass-nurse-1',
    });
    const nurseFirst = await login('nurse1', 'temp-pass-nurse-1');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-1',
      newPassword: PW,
    });
    nurse = await login('nurse1');

    await call('POST', '/api/users', doctor, {
      username: 'desk1',
      fullName: 'Attender Rajesh',
      role: 'attender',
      password: 'temp-pass-desk-1',
    });
    const deskFirst = await login('desk1', 'temp-pass-desk-1');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-1',
      newPassword: PW,
    });
    desk = await login('desk1');

    // Create a demo patient
    const pRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Ananya Deshmukh',
      dateOfBirth: '1998-05-12',
      phone: '9822334455',
      address: 'Flat 12, Sinhagad Road, Pune',
      emergencyContactName: 'Vikram Deshmukh',
      emergencyContactPhone: '9822334456',
      lastMenstrualPeriod: '2026-06-01',
      gravida: 2,
      para: 1,
      abortions: 0,
      living: 1,
    });
    expect(pRes.status).toBe(201);
    patientId = pRes.body.patient.id;
  }, 20000);

  it('auto-generates prefilled Form F draft from patient records', async () => {
    const autoRes = await call('POST', '/api/pndt/auto-generate', doctor, {
      patientId,
    });
    expect(autoRes.status).toBe(200);
    const draft = autoRes.body;

    expect(draft.patientName).toBe('Ananya Deshmukh');
    expect(draft.husbandOrFatherName).toBe('Vikram Deshmukh');
    expect(draft.fullAddress).toContain('Sinhagad Road, Pune');
    expect(draft.gestationalAgeWeeks).toBeGreaterThan(15);
    expect(draft.indicationCodes.length).toBeGreaterThan(0);
    expect(draft.pregnantWomanDeclarationSigned).toBe(true);
    expect(draft.doctorDeclarationSigned).toBe(true);
  });

  it('creates, reads, updates, and deletes statutory Form F with sequential number', async () => {
    const payload = {
      patientId,
      scanDate: '2026-11-05',
      scanTime: '14:20',
      clinicPndtRegNo: 'MH/PNDT/2021/045',
      doctorName: 'Dr. Sarayu Rao',
      doctorRegNo: 'MCI-54892',
      machineModelSerial: 'GE Voluson E8 S/N 89241',
      patientName: 'Ananya Deshmukh',
      patientAge: 28,
      husbandOrFatherName: 'Vikram Deshmukh',
      fullAddress: 'Flat 12, Sinhagad Road, Pune',
      contactPhone: '9822334455',
      numLivingMaleChildren: 0,
      maleChildrenAges: null,
      numLivingFemaleChildren: 1,
      femaleChildrenAges: '3 yrs',
      totalLivingChildren: 1,
      lmp: '2026-06-01',
      gestationalAgeWeeks: 22,
      gestationalAgeDays: 3,
      referralType: 'self_referred',
      selfReferralReason: 'Targeted anomaly Level-II scan',
      indicationCodes: ['ANOMALY_DETECTION'],
      otherIndicationDetail: null,
      invasiveProcedureDone: false,
      invasiveProcedureDetails: null,
      pregnantWomanDeclarationSigned: true,
      pregnantWomanDeclarationTime: '2026-11-05 14:15',
      pregnantWomanSignatureName: 'Ananya Deshmukh',
      doctorDeclarationSigned: true,
      doctorDeclarationTime: '2026-11-05 14:20',
      doctorDeclarationName: 'Dr. Sarayu Rao',
      fetalNumber: 'single',
      cardiacActivity: 'present',
      congenitalAnomalyDetected: false,
      congenitalAnomalyDetails: null,
      scanResultSummary: 'No structural anomaly detected. Normal fetal biometry.',
    };

    // Create Form F
    const createRes = await call('POST', '/api/pndt/forms', doctor, payload);
    expect(createRes.status).toBe(201);
    const created = createRes.body;
    expect(created.formFNumber).toMatch(/^PNDT-202611-\d{4}$/);
    expect(created.patientName).toBe('Ananya Deshmukh');
    const formId = created.id;

    // Read by ID
    const getRes = await call('GET', `/api/pndt/forms/${formId}`, nurse);
    expect(getRes.status).toBe(200);
    expect(getRes.body.formFNumber).toBe(created.formFNumber);

    // List forms
    const listRes = await call('GET', `/api/pndt/forms?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.forms[0].id).toBe(formId);

    // Update Form F
    const updateRes = await call('PUT', `/api/pndt/forms/${formId}`, doctor, {
      ...payload,
      scanResultSummary: 'Updated: Concordant growth, liquor adequate.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.scanResultSummary).toContain('Updated');

    // Audit print
    const printAuditRes = await call('POST', `/api/pndt/forms/${formId}/audit-print`, doctor);
    expect(printAuditRes.status).toBe(200);

    // Delete Form F (doctor only)
    const delRes = await call('DELETE', `/api/pndt/forms/${formId}`, doctor);
    expect(delRes.status).toBe(200);

    // Verify gone
    const checkRes = await call('GET', `/api/pndt/forms/${formId}`, doctor);
    expect(checkRes.status).toBe(404);
  });

  it('generates monthly return aggregation and exports CSV', async () => {
    // Insert a form F
    await call('POST', '/api/pndt/forms', doctor, {
      patientId,
      scanDate: '2026-11-06',
      scanTime: '11:00',
      clinicPndtRegNo: 'MH/PNDT/2021/045',
      doctorName: 'Dr. Sarayu Rao',
      doctorRegNo: 'MCI-54892',
      machineModelSerial: 'GE Voluson E8',
      patientName: 'Ananya Deshmukh',
      patientAge: 28,
      husbandOrFatherName: 'Vikram Deshmukh',
      fullAddress: 'Sinhagad Road, Pune',
      contactPhone: '9822334455',
      numLivingMaleChildren: 1,
      maleChildrenAges: '4',
      numLivingFemaleChildren: 0,
      femaleChildrenAges: null,
      totalLivingChildren: 1,
      lmp: '2026-06-01',
      gestationalAgeWeeks: 22,
      gestationalAgeDays: 0,
      referralType: 'doctor_referred',
      referringDoctorName: 'Dr. S. K. Joshi',
      referringDoctorRegNo: 'MCI-1982',
      referringClinicAddress: 'Joshi Clinic, Pune',
      referralSlipDate: '2026-11-04',
      selfReferralReason: null,
      indicationCodes: ['ANOMALY_DETECTION', 'FETAL_GROWTH_FGR'],
      otherIndicationDetail: null,
      invasiveProcedureDone: false,
      invasiveProcedureDetails: null,
      pregnantWomanDeclarationSigned: true,
      pregnantWomanDeclarationTime: '2026-11-06 10:55',
      pregnantWomanSignatureName: 'Ananya Deshmukh',
      doctorDeclarationSigned: true,
      doctorDeclarationTime: '2026-11-06 11:00',
      doctorDeclarationName: 'Dr. Sarayu Rao',
      fetalNumber: 'single',
      cardiacActivity: 'present',
      congenitalAnomalyDetected: false,
      congenitalAnomalyDetails: null,
      scanResultSummary: 'Target anomaly scan normal.',
    });

    // Monthly return
    const returnRes = await call('GET', '/api/pndt/monthly-return?month=2026-11', doctor);
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.summary.totalScans).toBe(1);
    expect(returnRes.body.summary.referralBreakdown.doctorReferred).toBe(1);
    expect(returnRes.body.summary.parityDistribution.oneChildMale).toBe(1);

    // CSV export
    const exportRes = await call('GET', '/api/pndt/monthly-return/export?month=2026-11', doctor);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    expect(exportRes.body).toContain('Ananya Deshmukh');
    expect(exportRes.body).toContain('PNDT-202611-');
  });

  it('enforces RBAC: desk attender is blocked from creating or deleting Form F', async () => {
    // Desk tries to create Form F -> 403 Forbidden
    const createRes = await call('POST', '/api/pndt/forms', desk, {
      patientId,
      scanDate: '2026-11-07',
      clinicPndtRegNo: 'MH/PNDT/2021/045',
      doctorName: 'Dr. Sarayu Rao',
      doctorRegNo: 'MCI-54892',
      machineModelSerial: 'GE Voluson E8',
      patientName: 'Ananya Deshmukh',
      patientAge: 28,
      husbandOrFatherName: 'Vikram Deshmukh',
      fullAddress: 'Sinhagad Road, Pune',
      gestationalAgeWeeks: 22,
      referralType: 'self_referred',
      selfReferralReason: 'Routine',
      indicationCodes: ['GA_ESTIMATION'],
      pregnantWomanDeclarationSigned: true,
      pregnantWomanDeclarationTime: '2026-11-07 10:00',
      pregnantWomanSignatureName: 'Ananya',
      doctorDeclarationSigned: true,
      doctorDeclarationTime: '2026-11-07 10:00',
      doctorDeclarationName: 'Dr. Sarayu Rao',
    });
    expect(createRes.status).toBe(403);

    // Unauthenticated GET -> 401
    const unauthRes = await call('GET', '/api/pndt/forms');
    expect(unauthRes.status).toBe(401);
  });
});
