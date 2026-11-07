import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  formatPndtFormNumber,
  inferIndicationsFromUltrasound,
  aggregateMonthlyPndtReturn,
  generatePndtMonthlyCsv,
  type PndtFormFRecord,
} from '../../web/src/pndtEngine.js';

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const pndtFormFSchema = z.object({
  patientId: z.number().int().positive('Valid patient ID required'),
  ultrasoundReportId: z.number().int().positive().nullable().optional(),
  visitId: z.number().int().positive().nullable().optional(),
  scanDate: z.string().regex(dateRegex, 'Scan date must be YYYY-MM-DD'),
  scanTime: optNullableString(10),
  clinicPndtRegNo: z.string().trim().min(1, 'Clinic PC-PNDT Registration Number is mandatory').max(150),
  doctorId: z.number().int().positive().nullable().optional(),
  doctorName: z.string().trim().min(1, 'Doctor / Sonologist name is mandatory').max(300),
  doctorRegNo: z.string().trim().min(1, 'Doctor registration number is mandatory').max(150),
  machineModelSerial: z.string().trim().min(1, 'Ultrasound machine model & serial is mandatory').max(300),

  // Section A: Patient particulars
  patientName: z.string().trim().min(1, 'Patient name is mandatory').max(300),
  patientAge: z.number().int().min(10).max(70, 'Patient age must be between 10 and 70'),
  husbandOrFatherName: z.string().trim().min(1, "Husband or Father's name is mandatory").max(300),
  fullAddress: z.string().trim().min(1, 'Full residential address is mandatory under PC-PNDT Act').max(600),
  contactPhone: optNullableString(50),
  numLivingMaleChildren: z.number().int().min(0).max(20).default(0),
  maleChildrenAges: optNullableString(100),
  numLivingFemaleChildren: z.number().int().min(0).max(20).default(0),
  femaleChildrenAges: optNullableString(100),
  totalLivingChildren: z.number().int().min(0).max(40).default(0),
  lmp: z.string().regex(dateRegex).nullable().optional(),
  gestationalAgeWeeks: z.number().int().min(1).max(44, 'Gestational age must be between 1 and 44 weeks'),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),

  // Section B: Referral
  referralType: z.enum(['self_referred', 'doctor_referred']),
  referringDoctorName: optNullableString(300),
  referringDoctorRegNo: optNullableString(150),
  referringClinicAddress: optNullableString(500),
  referralSlipDate: optNullableString(50),
  selfReferralReason: optNullableString(500),

  // Section C: Indications
  indicationCodes: z.array(z.string()).min(1, 'At least one statutory indication must be selected under Rule 9(5)'),
  otherIndicationDetail: optNullableString(500),
  invasiveProcedureDone: z.boolean().default(false),
  invasiveProcedureDetails: optNullableString(500),

  // Section D & E: Mandatory Declarations
  pregnantWomanDeclarationSigned: z.boolean().default(true),
  pregnantWomanDeclarationTime: z.string().min(1, 'Date and time of patient declaration required'),
  pregnantWomanSignatureName: z.string().trim().min(1, 'Patient signature name is required').max(300),
  doctorDeclarationSigned: z.boolean().default(true),
  doctorDeclarationTime: z.string().min(1, 'Date and time of doctor declaration required'),
  doctorDeclarationName: z.string().trim().min(1, 'Doctor declaration name is required').max(300),

  // Diagnostic Findings
  fetalNumber: z.enum(['single', 'twins', 'triplets', 'multiple']).default('single'),
  cardiacActivity: z.enum(['present', 'absent', 'not_applicable']).default('present'),
  congenitalAnomalyDetected: z.boolean().default(false),
  congenitalAnomalyDetails: optNullableString(1000),
  scanResultSummary: optNullableString(2000),
});

function rowToRecord(r: Record<string, unknown>): PndtFormFRecord {
  let indications: string[] = [];
  try {
    indications = r.indication_codes ? JSON.parse(r.indication_codes as string) : [];
  } catch {
    indications = [];
  }

  return {
    id: Number(r.id),
    formFNumber: String(r.form_f_number),
    patientId: Number(r.patient_id),
    ultrasoundReportId: r.ultrasound_report_id != null ? Number(r.ultrasound_report_id) : null,
    visitId: r.visit_id != null ? Number(r.visit_id) : null,
    scanDate: String(r.scan_date),
    scanTime: r.scan_time ? String(r.scan_time) : null,
    clinicPndtRegNo: String(r.clinic_pndt_reg_no),
    doctorId: r.doctor_id != null ? Number(r.doctor_id) : null,
    doctorName: String(r.doctor_name),
    doctorRegNo: String(r.doctor_reg_no),
    machineModelSerial: String(r.machine_model_serial),

    patientName: String(r.patient_name),
    patientAge: Number(r.patient_age),
    husbandOrFatherName: String(r.husband_or_father_name),
    fullAddress: String(r.full_address),
    contactPhone: r.contact_phone ? String(r.contact_phone) : null,
    numLivingMaleChildren: Number(r.num_living_male_children || 0),
    maleChildrenAges: r.male_children_ages ? String(r.male_children_ages) : null,
    numLivingFemaleChildren: Number(r.num_living_female_children || 0),
    femaleChildrenAges: r.female_children_ages ? String(r.female_children_ages) : null,
    totalLivingChildren: Number(r.total_living_children || 0),
    lmp: r.lmp ? String(r.lmp) : null,
    gestationalAgeWeeks: Number(r.gestational_age_weeks),
    gestationalAgeDays: Number(r.gestational_age_days || 0),

    referralType: r.referral_type as 'self_referred' | 'doctor_referred',
    referringDoctorName: r.referring_doctor_name ? String(r.referring_doctor_name) : null,
    referringDoctorRegNo: r.referring_doctor_reg_no ? String(r.referring_doctor_reg_no) : null,
    referringClinicAddress: r.referring_clinic_address ? String(r.referring_clinic_address) : null,
    referralSlipDate: r.referral_slip_date ? String(r.referral_slip_date) : null,
    selfReferralReason: r.self_referral_reason ? String(r.self_referral_reason) : null,

    indicationCodes: indications,
    otherIndicationDetail: r.other_indication_detail ? String(r.other_indication_detail) : null,
    invasiveProcedureDone: Boolean(r.invasive_procedure_done),
    invasiveProcedureDetails: r.invasive_procedure_details ? String(r.invasive_procedure_details) : null,

    pregnantWomanDeclarationSigned: Boolean(r.pregnant_woman_declaration_signed),
    pregnantWomanDeclarationTime: String(r.pregnant_woman_declaration_time),
    pregnantWomanSignatureName: String(r.pregnant_woman_signature_name),
    doctorDeclarationSigned: Boolean(r.doctor_declaration_signed),
    doctorDeclarationTime: String(r.doctor_declaration_time),
    doctorDeclarationName: String(r.doctor_declaration_name),

    fetalNumber: (r.fetal_number as 'single' | 'twins' | 'triplets' | 'multiple') || 'single',
    cardiacActivity: (r.cardiac_activity as 'present' | 'absent' | 'not_applicable') || 'present',
    congenitalAnomalyDetected: Boolean(r.congenital_anomaly_detected),
    congenitalAnomalyDetails: r.congenital_anomaly_details ? String(r.congenital_anomaly_details) : null,
    scanResultSummary: r.scan_result_summary ? String(r.scan_result_summary) : null,

    createdBy: Number(r.created_by),
    updatedBy: Number(r.updated_by),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function getClinicSettings(ctx: Ctx): Record<string, string> {
  const rows = ctx.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function registerPndtRoutes(app: FastifyInstance, ctx: Ctx) {
  // GET /api/pndt/forms - List forms with optional filtering
  app.get('/api/pndt/forms', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const q = req.query as {
      patientId?: string;
      month?: string; // YYYY-MM
      startDate?: string;
      endDate?: string;
      search?: string;
    };

    const clauses: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (q.patientId) {
      const pid = Number(q.patientId);
      if (Number.isInteger(pid) && pid > 0) {
        clauses.push('patient_id = ?');
        params.push(pid);
      }
    }

    if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
      clauses.push("strftime('%Y-%m', scan_date) = ?");
      params.push(q.month);
    }

    if (q.startDate && dateRegex.test(q.startDate)) {
      clauses.push('scan_date >= ?');
      params.push(q.startDate);
    }

    if (q.endDate && dateRegex.test(q.endDate)) {
      clauses.push('scan_date <= ?');
      params.push(q.endDate);
    }

    if (q.search && q.search.trim()) {
      clauses.push('(patient_name LIKE ? OR form_f_number LIKE ?)');
      const term = `%${q.search.trim()}%`;
      params.push(term, term);
    }

    const sql = `SELECT * FROM pndt_form_f_records WHERE ${clauses.join(' AND ')} ORDER BY scan_date DESC, id DESC`;
    const rows = ctx.db.prepare(sql).all(...params) as Record<string, unknown>[];
    const forms = rows.map(rowToRecord);

    return reply.send({
      total: forms.length,
      forms,
    });
  });

  // GET /api/pndt/forms/:id - Single form details
  app.get('/api/pndt/forms/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid Form F ID');

    const row = ctx.db.prepare('SELECT * FROM pndt_form_f_records WHERE id = ?').get(numId) as Record<string, unknown> | undefined;
    if (!row) throw notFound('PC-PNDT Form F record not found');

    const form = rowToRecord(row);
    return reply.send(form);
  });

  // POST /api/pndt/forms - Create statutory Form F
  app.post('/api/pndt/forms', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:write_clinical');
    const parsed = pndtFormFSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed for Form F', parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })));
    }
    const b = parsed.data;

    // Verify patient
    const patient = ctx.db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(b.patientId);
    if (!patient) throw notFound('Patient not found');

    const now = nowIso();

    const created = tx(ctx.db, () => {
      // Increment counter
      ctx.db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'pndt_form_f'").run();
      const counterRow = ctx.db.prepare("SELECT value FROM counters WHERE name = 'pndt_form_f'").get() as { value: number };
      const formFNumber = formatPndtFormNumber(counterRow.value, b.scanDate);

      const computedTotalLiving = (b.numLivingMaleChildren || 0) + (b.numLivingFemaleChildren || 0);

      const res = ctx.db.prepare(`
        INSERT INTO pndt_form_f_records (
          form_f_number, patient_id, ultrasound_report_id, visit_id,
          scan_date, scan_time, clinic_pndt_reg_no, doctor_id, doctor_name, doctor_reg_no, machine_model_serial,
          patient_name, patient_age, husband_or_father_name, full_address, contact_phone,
          num_living_male_children, male_children_ages, num_living_female_children, female_children_ages, total_living_children,
          lmp, gestational_age_weeks, gestational_age_days,
          referral_type, referring_doctor_name, referring_doctor_reg_no, referring_clinic_address, referral_slip_date, self_referral_reason,
          indication_codes, other_indication_detail, invasive_procedure_done, invasive_procedure_details,
          pregnant_woman_declaration_signed, pregnant_woman_declaration_time, pregnant_woman_signature_name,
          doctor_declaration_signed, doctor_declaration_time, doctor_declaration_name,
          fetal_number, cardiac_activity, congenital_anomaly_detected, congenital_anomaly_details, scan_result_summary,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        formFNumber,
        b.patientId,
        b.ultrasoundReportId ?? null,
        b.visitId ?? null,
        b.scanDate,
        b.scanTime ?? null,
        b.clinicPndtRegNo,
        b.doctorId ?? user.id,
        b.doctorName,
        b.doctorRegNo,
        b.machineModelSerial,
        b.patientName,
        b.patientAge,
        b.husbandOrFatherName,
        b.fullAddress,
        b.contactPhone ?? null,
        b.numLivingMaleChildren,
        b.maleChildrenAges ?? null,
        b.numLivingFemaleChildren,
        b.femaleChildrenAges ?? null,
        computedTotalLiving,
        b.lmp ?? null,
        b.gestationalAgeWeeks,
        b.gestationalAgeDays,
        b.referralType,
        b.referringDoctorName ?? null,
        b.referringDoctorRegNo ?? null,
        b.referringClinicAddress ?? null,
        b.referralSlipDate ?? null,
        b.selfReferralReason ?? null,
        JSON.stringify(b.indicationCodes),
        b.otherIndicationDetail ?? null,
        b.invasiveProcedureDone ? 1 : 0,
        b.invasiveProcedureDetails ?? null,
        b.pregnantWomanDeclarationSigned ? 1 : 0,
        b.pregnantWomanDeclarationTime,
        b.pregnantWomanSignatureName,
        b.doctorDeclarationSigned ? 1 : 0,
        b.doctorDeclarationTime,
        b.doctorDeclarationName,
        b.fetalNumber,
        b.cardiacActivity,
        b.congenitalAnomalyDetected ? 1 : 0,
        b.congenitalAnomalyDetails ?? null,
        b.scanResultSummary ?? null,
        user.id,
        user.id,
        now,
        now,
      );

      const newId = Number(res.lastInsertRowid);
      audit(ctx.db, {
        actorId: user.id,
        action: 'pndt.form_f_create',
        entity: 'pndt_form_f',
        entityId: newId,
        detail: { patientId: b.patientId, formFNumber, scanDate: b.scanDate, doctorName: b.doctorName },
      });

      const row = ctx.db.prepare('SELECT * FROM pndt_form_f_records WHERE id = ?').get(newId) as Record<string, unknown>;
      return rowToRecord(row);
    });

    return reply.status(201).send(created);
  });

  // PUT /api/pndt/forms/:id - Update Form F
  app.put('/api/pndt/forms/:id', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:write_clinical');
    const { id } = req.params as { id: string };
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid Form F ID');

    const existing = ctx.db.prepare('SELECT * FROM pndt_form_f_records WHERE id = ?').get(numId) as Record<string, unknown> | undefined;
    if (!existing) throw notFound('PC-PNDT Form F record not found');

    const parsed = pndtFormFSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed for Form F', parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })));
    }
    const b = parsed.data;
    const now = nowIso();
    const computedTotalLiving = (b.numLivingMaleChildren || 0) + (b.numLivingFemaleChildren || 0);

    tx(ctx.db, () => {
      ctx.db.prepare(`
        UPDATE pndt_form_f_records SET
          ultrasound_report_id = ?, visit_id = ?,
          scan_date = ?, scan_time = ?, clinic_pndt_reg_no = ?, doctor_id = ?, doctor_name = ?, doctor_reg_no = ?, machine_model_serial = ?,
          patient_name = ?, patient_age = ?, husband_or_father_name = ?, full_address = ?, contact_phone = ?,
          num_living_male_children = ?, male_children_ages = ?, num_living_female_children = ?, female_children_ages = ?, total_living_children = ?,
          lmp = ?, gestational_age_weeks = ?, gestational_age_days = ?,
          referral_type = ?, referring_doctor_name = ?, referring_doctor_reg_no = ?, referring_clinic_address = ?, referral_slip_date = ?, self_referral_reason = ?,
          indication_codes = ?, other_indication_detail = ?, invasive_procedure_done = ?, invasive_procedure_details = ?,
          pregnant_woman_declaration_signed = ?, pregnant_woman_declaration_time = ?, pregnant_woman_signature_name = ?,
          doctor_declaration_signed = ?, doctor_declaration_time = ?, doctor_declaration_name = ?,
          fetal_number = ?, cardiac_activity = ?, congenital_anomaly_detected = ?, congenital_anomaly_details = ?, scan_result_summary = ?,
          updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        b.ultrasoundReportId ?? null,
        b.visitId ?? null,
        b.scanDate,
        b.scanTime ?? null,
        b.clinicPndtRegNo,
        b.doctorId ?? user.id,
        b.doctorName,
        b.doctorRegNo,
        b.machineModelSerial,
        b.patientName,
        b.patientAge,
        b.husbandOrFatherName,
        b.fullAddress,
        b.contactPhone ?? null,
        b.numLivingMaleChildren,
        b.maleChildrenAges ?? null,
        b.numLivingFemaleChildren,
        b.femaleChildrenAges ?? null,
        computedTotalLiving,
        b.lmp ?? null,
        b.gestationalAgeWeeks,
        b.gestationalAgeDays,
        b.referralType,
        b.referringDoctorName ?? null,
        b.referringDoctorRegNo ?? null,
        b.referringClinicAddress ?? null,
        b.referralSlipDate ?? null,
        b.selfReferralReason ?? null,
        JSON.stringify(b.indicationCodes),
        b.otherIndicationDetail ?? null,
        b.invasiveProcedureDone ? 1 : 0,
        b.invasiveProcedureDetails ?? null,
        b.pregnantWomanDeclarationSigned ? 1 : 0,
        b.pregnantWomanDeclarationTime,
        b.pregnantWomanSignatureName,
        b.doctorDeclarationSigned ? 1 : 0,
        b.doctorDeclarationTime,
        b.doctorDeclarationName,
        b.fetalNumber,
        b.cardiacActivity,
        b.congenitalAnomalyDetected ? 1 : 0,
        b.congenitalAnomalyDetails ?? null,
        b.scanResultSummary ?? null,
        user.id,
        now,
        numId,
      );

      audit(ctx.db, {
        actorId: user.id,
        action: 'pndt.form_f_update',
        entity: 'pndt_form_f',
        entityId: numId,
        detail: { patientId: Number(existing.patient_id), formFNumber: String(existing.form_f_number) },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM pndt_form_f_records WHERE id = ?').get(numId) as Record<string, unknown>;
    return reply.send(rowToRecord(updated));
  });

  // DELETE /api/pndt/forms/:id - Delete Form F (Doctor only)
  app.delete('/api/pndt/forms/:id', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:write_clinical');
    if (user.role !== 'doctor') {
      throw badRequest('Statutory PC-PNDT records can only be removed by an authorized Doctor');
    }
    const { id } = req.params as { id: string };
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid Form F ID');

    const existing = ctx.db.prepare('SELECT * FROM pndt_form_f_records WHERE id = ?').get(numId) as Record<string, unknown> | undefined;
    if (!existing) throw notFound('PC-PNDT Form F record not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM pndt_form_f_records WHERE id = ?').run(numId);
      audit(ctx.db, {
        actorId: user.id,
        action: 'pndt.form_f_delete',
        entity: 'pndt_form_f',
        entityId: numId,
        detail: { patientId: Number(existing.patient_id), formFNumber: String(existing.form_f_number), patientName: String(existing.patient_name) },
      });
    });

    return reply.send({ ok: true, deletedId: numId });
  });

  // POST /api/pndt/forms/:id/audit-print - Log statutory document printing
  app.post('/api/pndt/forms/:id/audit-print', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid Form F ID');

    const existing = ctx.db.prepare('SELECT * FROM pndt_form_f_records WHERE id = ?').get(numId) as Record<string, unknown> | undefined;
    if (!existing) throw notFound('PC-PNDT Form F record not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'pndt.form_f_print',
      entity: 'pndt_form_f',
      entityId: numId,
      detail: { patientId: Number(existing.patient_id), formFNumber: String(existing.form_f_number) },
    });

    return reply.send({ ok: true });
  });

  // GET /api/pndt/monthly-return - Aggregated monthly statistics
  app.get('/api/pndt/monthly-return', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const q = req.query as { month?: string };
    const currentMonth = new Date().toISOString().substring(0, 7);
    const month = q.month && /^\d{4}-\d{2}$/.test(q.month) ? q.month : currentMonth;

    const rows = ctx.db
      .prepare("SELECT * FROM pndt_form_f_records WHERE strftime('%Y-%m', scan_date) = ? ORDER BY scan_date ASC, id ASC")
      .all(month) as Record<string, unknown>[];

    const records = rows.map(rowToRecord);
    const summary = aggregateMonthlyPndtReturn(records, month);

    return reply.send({
      month,
      summary,
      records,
    });
  });

  // GET /api/pndt/monthly-return/export - Download CSV file for CMO return
  app.get('/api/pndt/monthly-return/export', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:read_clinical');
    const q = req.query as { month?: string };
    const currentMonth = new Date().toISOString().substring(0, 7);
    const month = q.month && /^\d{4}-\d{2}$/.test(q.month) ? q.month : currentMonth;

    const rows = ctx.db
      .prepare("SELECT * FROM pndt_form_f_records WHERE strftime('%Y-%m', scan_date) = ? ORDER BY scan_date ASC, id ASC")
      .all(month) as Record<string, unknown>[];

    const records = rows.map(rowToRecord);
    const settings = getClinicSettings(ctx);
    const clinicName = settings.clinicName || 'Clinic';
    const regNo = settings.pndtRegistrationNo || settings.registrationNo || 'PC-PNDT Registered';

    const csvData = generatePndtMonthlyCsv(records, clinicName, regNo);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pndt.monthly_return_export',
      entity: 'pndt_monthly_return',
      entityId: 0,
      detail: { month, totalScans: records.length },
    });

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="PNDT_Monthly_Return_${month}.csv"`);
    return reply.send(csvData);
  });

  // POST /api/pndt/auto-generate - Pre-populate Form F from patient & ultrasound
  app.post('/api/pndt/auto-generate', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:write_clinical');
    const body = req.body as { patientId?: number; ultrasoundReportId?: number };

    if (!body || !body.patientId) {
      throw badRequest('patientId is required');
    }

    const patient = ctx.db.prepare(`
      SELECT id, full_name, date_of_birth, estimated_age_years, address, phone, emergency_contact_name,
             last_menstrual_period, gravida, para, living
      FROM patients WHERE id = ?
    `).get(body.patientId) as Record<string, unknown> | undefined;

    if (!patient) throw notFound('Patient not found');

    let ultrasound: Record<string, unknown> | undefined;
    if (body.ultrasoundReportId) {
      ultrasound = ctx.db.prepare('SELECT * FROM patient_ultrasound_reports WHERE id = ?').get(body.ultrasoundReportId) as Record<string, unknown> | undefined;
    } else {
      // Find latest ultrasound
      ultrasound = ctx.db.prepare(`
        SELECT * FROM patient_ultrasound_reports
        WHERE patient_id = ?
        ORDER BY scan_date DESC, id DESC LIMIT 1
      `).get(body.patientId) as Record<string, unknown> | undefined;
    }

    const settings = getClinicSettings(ctx);

    // Calculate age
    let patientAge = 26;
    if (patient.date_of_birth) {
      const birthYear = new Date(patient.date_of_birth as string).getFullYear();
      if (!isNaN(birthYear)) {
        patientAge = Math.max(12, new Date().getFullYear() - birthYear);
      }
    } else if (patient.estimated_age_years) {
      patientAge = Number(patient.estimated_age_years);
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const nowTimeStr = new Date().toTimeString().substring(0, 5);

    const scanDate = ultrasound?.scan_date ? String(ultrasound.scan_date) : todayStr;
    const lmp = (ultrasound?.clinical_lmp ? String(ultrasound.clinical_lmp) : (patient.last_menstrual_period ? String(patient.last_menstrual_period) : null));

    // GA calculation
    let gaWeeks = ultrasound?.gestational_age_weeks != null ? Number(ultrasound.gestational_age_weeks) : 12;
    let gaDays = ultrasound?.gestational_age_days != null ? Number(ultrasound.gestational_age_days) : 0;

    if (ultrasound?.gestational_age_weeks == null && lmp) {
      const lmpDate = new Date(lmp);
      const scanD = new Date(scanDate);
      const diffMs = scanD.getTime() - lmpDate.getTime();
      if (diffMs > 0) {
        const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        gaWeeks = Math.floor(totalDays / 7);
        gaDays = totalDays % 7;
      }
    }

    // Indications
    const inferredIndications = inferIndicationsFromUltrasound(
      ultrasound?.scan_type ? String(ultrasound.scan_type) : null,
      ultrasound?.indication ? String(ultrasound.indication) : null,
      patientAge,
      ultrasound?.fetal_number ? String(ultrasound.fetal_number) : null,
    );

    const doctorName = settings.doctorName || user.fullName || 'Dr. K. Sarayu Rao';
    const doctorRegNo = settings.registrationNo || 'MCI-54892';
    const clinicPndtRegNo = settings.pndtRegistrationNo || 'MH/PNDT/2021/045';
    const machineModelSerial = settings.pndtMachineDetails || 'GE Voluson E8 Expert, S/N: GE-US-89241';

    // Living children estimate from patient.living
    const livingCount = Number(patient.living || 0);

    const draft = {
      patientId: Number(patient.id),
      ultrasoundReportId: ultrasound?.id != null ? Number(ultrasound.id) : null,
      visitId: ultrasound?.visit_id != null ? Number(ultrasound.visit_id) : null,
      scanDate,
      scanTime: nowTimeStr,
      clinicPndtRegNo,
      doctorId: user.id,
      doctorName,
      doctorRegNo,
      machineModelSerial,

      patientName: String(patient.full_name),
      patientAge,
      husbandOrFatherName: patient.emergency_contact_name ? String(patient.emergency_contact_name) : 'Husband',
      fullAddress: patient.address ? String(patient.address) : 'Local, Pune, Maharashtra',
      contactPhone: patient.phone ? String(patient.phone) : null,
      numLivingMaleChildren: 0,
      maleChildrenAges: '',
      numLivingFemaleChildren: livingCount,
      femaleChildrenAges: livingCount > 0 ? '3' : '',
      totalLivingChildren: livingCount,
      lmp,
      gestationalAgeWeeks: gaWeeks,
      gestationalAgeDays: gaDays,

      referralType: 'self_referred' as const,
      referringDoctorName: null,
      referringDoctorRegNo: null,
      referringClinicAddress: null,
      referralSlipDate: null,
      selfReferralReason: 'Routine antenatal ultrasound examination & obstetric checkup',

      indicationCodes: inferredIndications,
      otherIndicationDetail: null,
      invasiveProcedureDone: false,
      invasiveProcedureDetails: null,

      pregnantWomanDeclarationSigned: true,
      pregnantWomanDeclarationTime: `${scanDate} ${nowTimeStr}`,
      pregnantWomanSignatureName: String(patient.full_name),
      doctorDeclarationSigned: true,
      doctorDeclarationTime: `${scanDate} ${nowTimeStr}`,
      doctorDeclarationName: doctorName,

      fetalNumber: (ultrasound?.fetal_number as 'single' | 'twins' | 'triplets' | 'multiple') || 'single',
      cardiacActivity: (ultrasound?.cardiac_activity as 'present' | 'absent' | 'not_applicable') || 'present',
      congenitalAnomalyDetected: false,
      congenitalAnomalyDetails: null,
      scanResultSummary: ultrasound?.impression ? String(ultrasound.impression) : 'Single live intrauterine gestation with normal fetal cardiac activity and biometry concordant with dates.',
    };

    return reply.send(draft);
  });
}
