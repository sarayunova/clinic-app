import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageUltrasound(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can create or edit ultrasound reports');
  }
  return user;
}

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const optNullableNumber = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .nullable()
    .optional();

const scanTypeEnum = z.enum([
  'early_pregnancy',
  'nt_first_trimester',
  'anomaly_scan',
  'growth_wellbeing',
  'pelvic_gyn',
  'other',
]);

const fetalNumberEnum = z.enum(['single', 'twins', 'triplets', 'none']);
const cardiacActivityEnum = z.enum(['present', 'absent', 'not_applicable']);
const presentationEnum = z.enum(['cephalic', 'breech', 'transverse', 'oblique', 'variable', 'not_applicable']);
const placentaLocationEnum = z.enum(['anterior', 'posterior', 'fundal', 'low_lying', 'previa', 'not_applicable']);
const placentaGradeEnum = z.enum(['0', '1', '2', '3', 'not_applicable']);
const amnioticFluidTypeEnum = z.enum(['afi', 'sdp', 'adequate', 'reduced', 'increased', 'not_applicable']);
const amnioticFluidAssessmentEnum = z.enum(['normal', 'borderline', 'oligohydramnios', 'polyhydramnios', 'not_applicable']);
const nasalBoneEnum = z.enum(['present', 'absent', 'hypoplastic', 'not_visualized']);
const freeFluidEnum = z.enum(['none', 'minimal', 'moderate', 'gross']);

export const ultrasoundReportSchema = z
  .object({
    scanDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    scanType: scanTypeEnum,
    indication: optNullableString(500),
    visitId: z.number().int().positive().nullable().optional(),
    clinicalLmp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
    eddByLmp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
    eddByScan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
    gestationalAgeWeeks: optNullableNumber(0, 44),
    gestationalAgeDays: optNullableNumber(0, 6),
    fetalNumber: fetalNumberEnum.optional(),
    cardiacActivity: cardiacActivityEnum.optional(),
    fhrBpm: optNullableNumber(30, 250),
    presentation: presentationEnum.nullable().optional(),
    placentaLocation: placentaLocationEnum.nullable().optional(),
    placentaGrade: placentaGradeEnum.nullable().optional(),
    amnioticFluidType: amnioticFluidTypeEnum.nullable().optional(),
    amnioticFluidCm: optNullableNumber(0, 60),
    amnioticFluidAssessment: amnioticFluidAssessmentEnum.nullable().optional(),
    gsdMm: optNullableNumber(1, 150),
    crlMm: optNullableNumber(1, 150),
    ntMm: optNullableNumber(0.1, 20),
    nasalBone: nasalBoneEnum.nullable().optional(),
    bpdMm: optNullableNumber(5, 150),
    hcMm: optNullableNumber(20, 450),
    acMm: optNullableNumber(20, 450),
    flMm: optNullableNumber(5, 120),
    efwGrams: optNullableNumber(50, 7000),
    efwPercentile: optNullableString(200),
    anatomySurvey: optNullableString(4000),
    uterusFindings: optNullableString(1000),
    endometrialThicknessMm: optNullableNumber(0.1, 50),
    rightOvaryFindings: optNullableString(1000),
    leftOvaryFindings: optNullableString(1000),
    freeFluid: freeFluidEnum.nullable().optional(),
    impression: z.string().trim().min(2, 'Impression is required').max(3000),
    recommendations: optNullableString(1000),
    sonographerName: optNullableString(200),
    attachmentId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const patchUltrasoundSchema = ultrasoundReportSchema.partial();

type DbUltrasoundRow = {
  id: number;
  patient_id: number;
  visit_id: number | null;
  scan_date: string;
  scan_type: string;
  indication: string | null;
  clinical_lmp: string | null;
  edd_by_lmp: string | null;
  edd_by_scan: string | null;
  gestational_age_weeks: number | null;
  gestational_age_days: number | null;
  fetal_number: string;
  cardiac_activity: string;
  fhr_bpm: number | null;
  presentation: string | null;
  placenta_location: string | null;
  placenta_grade: string | null;
  amniotic_fluid_type: string | null;
  amniotic_fluid_cm: number | null;
  amniotic_fluid_assessment: string | null;
  gsd_mm: number | null;
  crl_mm: number | null;
  nt_mm: number | null;
  nasal_bone: string | null;
  bpd_mm: number | null;
  hc_mm: number | null;
  ac_mm: number | null;
  fl_mm: number | null;
  efw_grams: number | null;
  efw_percentile: string | null;
  anatomy_survey: string | null;
  uterus_findings: string | null;
  endometrial_thickness_mm: number | null;
  right_ovary_findings: string | null;
  left_ovary_findings: string | null;
  free_fluid: string | null;
  impression: string;
  recommendations: string | null;
  sonographer_name: string | null;
  attachment_id: number | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  attachment_title?: string | null;
  attachment_original_name?: string | null;
  patient_number?: string;
  patient_name?: string;
  date_of_birth?: string | null;
  patient_phone?: string | null;
};

function mapRow(r: DbUltrasoundRow) {
  return {
    id: r.id,
    patientId: r.patient_id,
    visitId: r.visit_id,
    scanDate: r.scan_date,
    scanType: r.scan_type,
    indication: r.indication,
    clinicalLmp: r.clinical_lmp,
    eddByLmp: r.edd_by_lmp,
    eddByScan: r.edd_by_scan,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    fetalNumber: r.fetal_number,
    cardiacActivity: r.cardiac_activity,
    fhrBpm: r.fhr_bpm,
    presentation: r.presentation,
    placentaLocation: r.placenta_location,
    placentaGrade: r.placenta_grade,
    amnioticFluidType: r.amniotic_fluid_type,
    amnioticFluidCm: r.amniotic_fluid_cm,
    amnioticFluidAssessment: r.amniotic_fluid_assessment,
    gsdMm: r.gsd_mm,
    crlMm: r.crl_mm,
    ntMm: r.nt_mm,
    nasalBone: r.nasal_bone,
    bpdMm: r.bpd_mm,
    hcMm: r.hc_mm,
    acMm: r.ac_mm,
    flMm: r.fl_mm,
    efwGrams: r.efw_grams,
    efwPercentile: r.efw_percentile,
    anatomySurvey: r.anatomy_survey,
    uterusFindings: r.uterus_findings,
    endometrialThicknessMm: r.endometrial_thickness_mm,
    rightOvaryFindings: r.right_ovary_findings,
    leftOvaryFindings: r.left_ovary_findings,
    freeFluid: r.free_fluid,
    impression: r.impression,
    recommendations: r.recommendations,
    sonographerName: r.sonographer_name,
    attachmentId: r.attachment_id,
    attachmentTitle: r.attachment_title ?? null,
    attachmentOriginalName: r.attachment_original_name ?? null,
    createdByName: r.created_by_name ?? null,
    updatedByName: r.updated_by_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patientNumber: r.patient_number,
    patientName: r.patient_name,
    dateOfBirth: r.date_of_birth,
    patientPhone: r.patient_phone,
  };
}

export function registerUltrasoundRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/patients/:id/ultrasounds
  app.get('/api/patients/:id/ultrasounds', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT u.*,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name,
                a.title AS attachment_title,
                a.original_name AS attachment_original_name
         FROM patient_ultrasound_reports u
         LEFT JOIN users cu ON cu.id = u.created_by
         LEFT JOIN users uu ON uu.id = u.updated_by
         LEFT JOIN attachments a ON a.id = u.attachment_id AND a.voided_at IS NULL
         WHERE u.patient_id = ?
         ORDER BY u.scan_date DESC, u.id DESC`
      )
      .all(patientId) as DbUltrasoundRow[];

    return {
      patientId,
      reports: rows.map(mapRow),
    };
  });

  // GET /api/ultrasounds/:id
  app.get('/api/ultrasounds/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid ultrasound ID');

    const row = db
      .prepare(
        `SELECT u.*,
                p.patient_number,
                p.full_name AS patient_name,
                p.date_of_birth,
                p.phone AS patient_phone,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name,
                a.title AS attachment_title,
                a.original_name AS attachment_original_name
         FROM patient_ultrasound_reports u
         JOIN patients p ON p.id = u.patient_id
         LEFT JOIN users cu ON cu.id = u.created_by
         LEFT JOIN users uu ON uu.id = u.updated_by
         LEFT JOIN attachments a ON a.id = u.attachment_id AND a.voided_at IS NULL
         WHERE u.id = ?`
      )
      .get(id) as DbUltrasoundRow | undefined;

    if (!row) throw notFound('Ultrasound report not found');
    return mapRow(row);
  });

  // POST /api/patients/:id/ultrasounds
  app.post('/api/patients/:id/ultrasounds', async (req, reply) => {
    const user = assertCanManageUltrasound(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(ultrasoundReportSchema, req.body);
    const now = nowIso();

    const stmt = db.prepare(`
      INSERT INTO patient_ultrasound_reports (
        patient_id, visit_id, scan_date, scan_type, indication, clinical_lmp, edd_by_lmp, edd_by_scan,
        gestational_age_weeks, gestational_age_days, fetal_number, cardiac_activity, fhr_bpm,
        presentation, placenta_location, placenta_grade, amniotic_fluid_type, amniotic_fluid_cm, amniotic_fluid_assessment,
        gsd_mm, crl_mm, nt_mm, nasal_bone, bpd_mm, hc_mm, ac_mm, fl_mm, efw_grams, efw_percentile,
        anatomy_survey, uterus_findings, endometrial_thickness_mm, right_ovary_findings, left_ovary_findings, free_fluid,
        impression, recommendations, sonographer_name, attachment_id, created_by, updated_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      patientId,
      b.visitId ?? null,
      b.scanDate,
      b.scanType,
      b.indication ?? null,
      b.clinicalLmp ?? null,
      b.eddByLmp ?? null,
      b.eddByScan ?? null,
      b.gestationalAgeWeeks ?? null,
      b.gestationalAgeDays ?? null,
      b.fetalNumber ?? 'single',
      b.cardiacActivity ?? 'present',
      b.fhrBpm ?? null,
      b.presentation ?? null,
      b.placentaLocation ?? null,
      b.placentaGrade ?? null,
      b.amnioticFluidType ?? null,
      b.amnioticFluidCm ?? null,
      b.amnioticFluidAssessment ?? null,
      b.gsdMm ?? null,
      b.crlMm ?? null,
      b.ntMm ?? null,
      b.nasalBone ?? null,
      b.bpdMm ?? null,
      b.hcMm ?? null,
      b.acMm ?? null,
      b.flMm ?? null,
      b.efwGrams ?? null,
      b.efwPercentile ?? null,
      b.anatomySurvey ?? null,
      b.uterusFindings ?? null,
      b.endometrialThicknessMm ?? null,
      b.rightOvaryFindings ?? null,
      b.leftOvaryFindings ?? null,
      b.freeFluid ?? null,
      b.impression,
      b.recommendations ?? null,
      b.sonographerName ?? null,
      b.attachmentId ?? null,
      user.id,
      user.id,
      now,
      now
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'ultrasound.create',
      entity: 'patient',
      entityId: patientId,
      detail: {
        ultrasoundId: newId,
        scanType: b.scanType,
        scanDate: b.scanDate,
        gestationalAge: b.gestationalAgeWeeks != null ? `${b.gestationalAgeWeeks}w ${b.gestationalAgeDays ?? 0}d` : undefined,
        efwGrams: b.efwGrams ?? undefined,
        impression: b.impression.slice(0, 100),
      },
    });

    const created = db.prepare('SELECT * FROM patient_ultrasound_reports WHERE id = ?').get(newId) as DbUltrasoundRow;
    return reply.status(201).send(mapRow(created));
  });

  // PATCH /api/ultrasounds/:id
  app.patch('/api/ultrasounds/:id', async (req) => {
    const user = assertCanManageUltrasound(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid ultrasound ID');

    const existing = db.prepare('SELECT * FROM patient_ultrasound_reports WHERE id = ?').get(id) as DbUltrasoundRow | undefined;
    if (!existing) throw notFound('Ultrasound report not found');

    const b = parse(patchUltrasoundSchema, req.body);
    const now = nowIso();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const fieldMap: Record<string, string> = {
      scanDate: 'scan_date',
      scanType: 'scan_type',
      indication: 'indication',
      visitId: 'visit_id',
      clinicalLmp: 'clinical_lmp',
      eddByLmp: 'edd_by_lmp',
      eddByScan: 'edd_by_scan',
      gestationalAgeWeeks: 'gestational_age_weeks',
      gestationalAgeDays: 'gestational_age_days',
      fetalNumber: 'fetal_number',
      cardiacActivity: 'cardiac_activity',
      fhrBpm: 'fhr_bpm',
      presentation: 'presentation',
      placentaLocation: 'placenta_location',
      placentaGrade: 'placenta_grade',
      amnioticFluidType: 'amniotic_fluid_type',
      amnioticFluidCm: 'amniotic_fluid_cm',
      amnioticFluidAssessment: 'amniotic_fluid_assessment',
      gsdMm: 'gsd_mm',
      crlMm: 'crl_mm',
      ntMm: 'nt_mm',
      nasalBone: 'nasal_bone',
      bpdMm: 'bpd_mm',
      hcMm: 'hc_mm',
      acMm: 'ac_mm',
      flMm: 'fl_mm',
      efwGrams: 'efw_grams',
      efwPercentile: 'efw_percentile',
      anatomySurvey: 'anatomy_survey',
      uterusFindings: 'uterus_findings',
      endometrialThicknessMm: 'endometrial_thickness_mm',
      rightOvaryFindings: 'right_ovary_findings',
      leftOvaryFindings: 'left_ovary_findings',
      freeFluid: 'free_fluid',
      impression: 'impression',
      recommendations: 'recommendations',
      sonographerName: 'sonographer_name',
      attachmentId: 'attachment_id',
    };

    for (const [k, col] of Object.entries(fieldMap)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as Record<string, string | number | null>)[k] ?? null);
      }
    }

    if (fields.length === 0) throw badRequest('No fields to update');

    fields.push('updated_by = ?', 'updated_at = ?');
    values.push(user.id, now, id);

    db.prepare(`UPDATE patient_ultrasound_reports SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit(db, {
      actorId: user.id,
      action: 'ultrasound.update',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        ultrasoundId: id,
        updatedFields: Object.keys(b),
      },
    });

    const updated = db.prepare('SELECT * FROM patient_ultrasound_reports WHERE id = ?').get(id) as DbUltrasoundRow;
    return mapRow(updated);
  });

  // DELETE /api/ultrasounds/:id
  app.delete('/api/ultrasounds/:id', async (req) => {
    const user = assertCanManageUltrasound(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid ultrasound ID');

    const existing = db.prepare('SELECT * FROM patient_ultrasound_reports WHERE id = ?').get(id) as DbUltrasoundRow | undefined;
    if (!existing) throw notFound('Ultrasound report not found');

    db.prepare('DELETE FROM patient_ultrasound_reports WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'ultrasound.delete',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        ultrasoundId: id,
        scanType: existing.scan_type,
        scanDate: existing.scan_date,
      },
    });

    return { ok: true };
  });

  // POST /api/ultrasounds/:id/print
  app.post('/api/ultrasounds/:id/print', async (req) => {
    const user = requirePerm(req, 'patient:read_clinical');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid ultrasound ID');

    const existing = db.prepare('SELECT * FROM patient_ultrasound_reports WHERE id = ?').get(id) as DbUltrasoundRow | undefined;
    if (!existing) throw notFound('Ultrasound report not found');

    audit(db, {
      actorId: user.id,
      action: 'ultrasound.print',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        ultrasoundId: id,
        scanType: existing.scan_type,
        scanDate: existing.scan_date,
      },
    });

    return { ok: true };
  });
}
