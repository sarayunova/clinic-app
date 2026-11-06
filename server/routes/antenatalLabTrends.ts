import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageAntenatalLabs(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage antenatal lab trends and serology matrix');
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

export const antenatalParamKeys = [
  'hb',
  'platelets',
  'tsh',
  'ft4',
  'ferritin',
  'serum_iron',
  'tibc',
  'ogtt_fasting',
  'ogtt_1hr',
  'ogtt_2hr',
  'fbs',
  'ppbs',
  'hba1c',
  'serum_creatinine',
  'uric_acid',
  'urine_albumin',
  'upcr',
] as const;

export const createLabTrendSchema = z
  .object({
    testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    gestationalAgeWeeks: optNullableNumber(0, 44),
    gestationalAgeDays: optNullableNumber(0, 6),
    trimester: z.enum(['t1', 't2', 't3']).optional(),
    parameterKey: z.enum(antenatalParamKeys),
    parameterName: z.string().trim().min(1).max(100),
    numericValue: z.number().min(-1000).max(1000000),
    unit: z.string().trim().min(1).max(50),
    referenceRange: optNullableString(100),
    abnormalFlag: z.enum(['normal', 'low', 'high', 'critical']).default('normal'),
    clinicalAction: optNullableString(500),
    labResultId: z.number().int().positive().nullable().optional(),
    attachmentId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const serologyMatrixSchema = z
  .object({
    bloodGroupAbo: optNullableString(10),
    rhFactor: z.enum(['positive', 'negative']).nullable().optional(),
    indirectCoombsTestBooking: z.enum(['negative', 'positive', 'not_done']).default('not_done'),
    indirectCoombsTest28w: z.enum(['negative', 'positive', 'not_done']).default('not_done'),
    antiDGiven: z.boolean().default(false),
    antiDGivenDate: optNullableString(50),
    antiDBatchDose: optNullableString(100),
    hivStatus: z.enum(['non_reactive', 'reactive', 'pending', 'not_tested']).default('not_tested'),
    hivTestedDate: optNullableString(50),
    hbsagStatus: z.enum(['non_reactive', 'reactive', 'pending', 'not_tested']).default('not_tested'),
    hbsagTestedDate: optNullableString(50),
    hcvStatus: z.enum(['non_reactive', 'reactive', 'pending', 'not_tested']).default('not_tested'),
    hcvTestedDate: optNullableString(50),
    vdrlRprStatus: z.enum(['non_reactive', 'reactive', 'pending', 'not_tested']).default('not_tested'),
    vdrlRprTiter: optNullableString(50),
    vdrlTestedDate: optNullableString(50),
    rubellaIggStatus: z.enum(['immune', 'non_immune', 'equivocal', 'not_tested']).default('not_tested'),
    rubellaIggValue: optNullableNumber(0, 5000),
    rubellaTestedDate: optNullableString(50),
    gbsCultureStatus: z.enum(['negative', 'positive', 'pending', 'not_tested']).default('not_tested'),
    gbsTestedDate: optNullableString(50),
    urineCultureStatus: z.enum(['no_growth', 'significant_growth', 'mixed_growth', 'not_tested']).default('not_tested'),
    urineCultureOrganism: optNullableString(200),
    urineCultureDate: optNullableString(50),
    hemoglobinopathyHplc: z.enum(['normal_a1_a2', 'beta_thalassemia_trait', 'sickle_cell_trait', 'hb_e_trait', 'other_variant', 'not_tested']).default('not_tested'),
    hplcHba2Pct: optNullableNumber(0, 100),
    hplcTestedDate: optNullableString(50),
    consultantReviewNotes: optNullableString(2000),
  })
  .strict();

export function registerAntenatalLabTrendsRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/patients/:id/antenatal-lab-trends
  app.get('/api/patients/:id/antenatal-lab-trends', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name, last_menstrual_period FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT t.*, u.full_name AS created_by_name
         FROM antenatal_lab_trends t
         LEFT JOIN users u ON u.id = t.created_by
         WHERE t.patient_id = ?
         ORDER BY t.test_date ASC, t.id ASC`
      )
      .all(patientId) as any[];

    // Grouping by parameter key
    const trendsByParam: Record<string, any[]> = {};
    for (const r of rows) {
      if (!trendsByParam[r.parameter_key]) {
        trendsByParam[r.parameter_key] = [];
      }
      trendsByParam[r.parameter_key]!.push({
        id: r.id,
        patientId: r.patient_id,
        testDate: r.test_date,
        gestationalAgeWeeks: r.gestational_age_weeks,
        gestationalAgeDays: r.gestational_age_days,
        trimester: r.trimester,
        parameterKey: r.parameter_key,
        parameterName: r.parameter_name,
        numericValue: r.numeric_value,
        unit: r.unit,
        referenceRange: r.reference_range,
        abnormalFlag: r.abnormal_flag,
        clinicalAction: r.clinical_action,
        labResultId: r.lab_result_id,
        attachmentId: r.attachment_id,
        createdBy: r.created_by,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
      });
    }

    return {
      patientId,
      totalCount: rows.length,
      trendsByParam,
      allTrends: rows.map((r) => ({
        id: r.id,
        patientId: r.patient_id,
        testDate: r.test_date,
        gestationalAgeWeeks: r.gestational_age_weeks,
        gestationalAgeDays: r.gestational_age_days,
        trimester: r.trimester,
        parameterKey: r.parameter_key,
        parameterName: r.parameter_name,
        numericValue: r.numeric_value,
        unit: r.unit,
        referenceRange: r.reference_range,
        abnormalFlag: r.abnormal_flag,
        clinicalAction: r.clinical_action,
        labResultId: r.lab_result_id,
        attachmentId: r.attachment_id,
        createdBy: r.created_by,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
      })),
    };
  });

  // POST /api/patients/:id/antenatal-lab-trends
  app.post('/api/patients/:id/antenatal-lab-trends', async (req, reply) => {
    const user = assertCanManageAntenatalLabs(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(createLabTrendSchema, req.body);
    const now = nowIso();

    // Determine trimester if not provided
    let trimester = b.trimester;
    if (!trimester) {
      const w = b.gestationalAgeWeeks || 0;
      if (w < 13) trimester = 't1';
      else if (w < 28) trimester = 't2';
      else trimester = 't3';
    }

    const res = db
      .prepare(
        `INSERT INTO antenatal_lab_trends (
           patient_id, test_date, gestational_age_weeks, gestational_age_days, trimester,
           parameter_key, parameter_name, numeric_value, unit, reference_range, abnormal_flag,
           clinical_action, lab_result_id, attachment_id, created_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        patientId,
        b.testDate,
        b.gestationalAgeWeeks ?? null,
        b.gestationalAgeDays ?? null,
        trimester,
        b.parameterKey,
        b.parameterName,
        b.numericValue,
        b.unit,
        b.referenceRange ?? null,
        b.abnormalFlag,
        b.clinicalAction ?? null,
        b.labResultId ?? null,
        b.attachmentId ?? null,
        user.id,
        now
      );

    const newId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'antenatal_lab_trend.create',
      entity: 'patient',
      entityId: patientId,
      detail: {
        trendId: newId,
        parameterKey: b.parameterKey,
        numericValue: b.numericValue,
        abnormalFlag: b.abnormalFlag,
      },
    });

    const created = db.prepare('SELECT * FROM antenatal_lab_trends WHERE id = ?').get(newId) as any;
    return reply.status(201).send({
      id: created.id,
      patientId: created.patient_id,
      testDate: created.test_date,
      gestationalAgeWeeks: created.gestational_age_weeks,
      gestationalAgeDays: created.gestational_age_days,
      trimester: created.trimester,
      parameterKey: created.parameter_key,
      parameterName: created.parameter_name,
      numericValue: created.numeric_value,
      unit: created.unit,
      referenceRange: created.reference_range,
      abnormalFlag: created.abnormal_flag,
      clinicalAction: created.clinical_action,
      labResultId: created.lab_result_id,
      attachmentId: created.attachment_id,
      createdBy: created.created_by,
      createdByName: user.fullName,
      createdAt: created.created_at,
    });
  });

  // DELETE /api/antenatal-lab-trends/:id
  app.delete('/api/antenatal-lab-trends/:id', async (req) => {
    const user = assertCanManageAntenatalLabs(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid trend ID');

    const existing = db.prepare('SELECT * FROM antenatal_lab_trends WHERE id = ?').get(id) as any | undefined;
    if (!existing) throw notFound('Antenatal lab trend record not found');

    db.prepare('DELETE FROM antenatal_lab_trends WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'antenatal_lab_trend.delete',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        trendId: id,
        parameterKey: existing.parameter_key,
      },
    });

    return { ok: true };
  });

  // GET /api/patients/:id/antenatal-serology
  app.get('/api/patients/:id/antenatal-serology', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const row = db
      .prepare(
        `SELECT s.*, u.full_name AS updated_by_name
         FROM antenatal_serology_matrix s
         LEFT JOIN users u ON u.id = s.updated_by
         WHERE s.patient_id = ?`
      )
      .get(patientId) as any | undefined;

    if (!row) {
      return {
        patientId,
        exists: false,
        serology: null,
      };
    }

    return {
      patientId,
      exists: true,
      serology: {
        id: row.id,
        patientId: row.patient_id,
        bloodGroupAbo: row.blood_group_abo,
        rhFactor: row.rh_factor,
        indirectCoombsTestBooking: row.indirect_coombs_test_booking,
        indirectCoombsTest28w: row.indirect_coombs_test_28w,
        antiDGiven: row.anti_d_given === 1,
        antiDGivenDate: row.anti_d_given_date,
        antiDBatchDose: row.anti_d_batch_dose,
        hivStatus: row.hiv_status,
        hivTestedDate: row.hiv_tested_date,
        hbsagStatus: row.hbsag_status,
        hbsagTestedDate: row.hbsag_tested_date,
        hcvStatus: row.hcv_status,
        hcvTestedDate: row.hcv_tested_date,
        vdrlRprStatus: row.vdrl_rpr_status,
        vdrlRprTiter: row.vdrl_rpr_titer,
        vdrlTestedDate: row.vdrl_tested_date,
        rubellaIggStatus: row.rubella_igg_status,
        rubellaIggValue: row.rubella_igg_value,
        rubellaTestedDate: row.rubella_tested_date,
        gbsCultureStatus: row.gbs_culture_status,
        gbsTestedDate: row.gbs_tested_date,
        urineCultureStatus: row.urine_culture_status,
        urineCultureOrganism: row.urine_culture_organism,
        urineCultureDate: row.urine_culture_date,
        hemoglobinopathyHplc: row.hemoglobinopathy_hplc,
        hplcHba2Pct: row.hplc_hba2_pct,
        hplcTestedDate: row.hplc_tested_date,
        consultantReviewNotes: row.consultant_review_notes,
        updatedBy: row.updated_by,
        updatedByName: row.updated_by_name,
        updatedAt: row.updated_at,
      },
    };
  });

  // PUT /api/patients/:id/antenatal-serology
  app.put('/api/patients/:id/antenatal-serology', async (req) => {
    const user = assertCanManageAntenatalLabs(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(serologyMatrixSchema, req.body);
    const now = nowIso();

    const existing = db.prepare('SELECT id FROM antenatal_serology_matrix WHERE patient_id = ?').get(patientId) as { id: number } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE antenatal_serology_matrix SET
          blood_group_abo = ?,
          rh_factor = ?,
          indirect_coombs_test_booking = ?,
          indirect_coombs_test_28w = ?,
          anti_d_given = ?,
          anti_d_given_date = ?,
          anti_d_batch_dose = ?,
          hiv_status = ?,
          hiv_tested_date = ?,
          hbsag_status = ?,
          hbsag_tested_date = ?,
          hcv_status = ?,
          hcv_tested_date = ?,
          vdrl_rpr_status = ?,
          vdrl_rpr_titer = ?,
          vdrl_tested_date = ?,
          rubella_igg_status = ?,
          rubella_igg_value = ?,
          rubella_tested_date = ?,
          gbs_culture_status = ?,
          gbs_tested_date = ?,
          urine_culture_status = ?,
          urine_culture_organism = ?,
          urine_culture_date = ?,
          hemoglobinopathy_hplc = ?,
          hplc_hba2_pct = ?,
          hplc_tested_date = ?,
          consultant_review_notes = ?,
          updated_by = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        b.bloodGroupAbo ?? null,
        b.rhFactor ?? null,
        b.indirectCoombsTestBooking,
        b.indirectCoombsTest28w,
        b.antiDGiven ? 1 : 0,
        b.antiDGivenDate ?? null,
        b.antiDBatchDose ?? null,
        b.hivStatus,
        b.hivTestedDate ?? null,
        b.hbsagStatus,
        b.hbsagTestedDate ?? null,
        b.hcvStatus,
        b.hcvTestedDate ?? null,
        b.vdrlRprStatus,
        b.vdrlRprTiter ?? null,
        b.vdrlTestedDate ?? null,
        b.rubellaIggStatus,
        b.rubellaIggValue ?? null,
        b.rubellaTestedDate ?? null,
        b.gbsCultureStatus,
        b.gbsTestedDate ?? null,
        b.urineCultureStatus,
        b.urineCultureOrganism ?? null,
        b.urineCultureDate ?? null,
        b.hemoglobinopathyHplc,
        b.hplcHba2Pct ?? null,
        b.hplcTestedDate ?? null,
        b.consultantReviewNotes ?? null,
        user.id,
        now,
        existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO antenatal_serology_matrix (
          patient_id, blood_group_abo, rh_factor, indirect_coombs_test_booking, indirect_coombs_test_28w,
          anti_d_given, anti_d_given_date, anti_d_batch_dose, hiv_status, hiv_tested_date,
          hbsag_status, hbsag_tested_date, hcv_status, hcv_tested_date, vdrl_rpr_status, vdrl_rpr_titer, vdrl_tested_date,
          rubella_igg_status, rubella_igg_value, rubella_tested_date, gbs_culture_status, gbs_tested_date,
          urine_culture_status, urine_culture_organism, urine_culture_date, hemoglobinopathy_hplc,
          hplc_hba2_pct, hplc_tested_date, consultant_review_notes, updated_by, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(
        patientId,
        b.bloodGroupAbo ?? null,
        b.rhFactor ?? null,
        b.indirectCoombsTestBooking,
        b.indirectCoombsTest28w,
        b.antiDGiven ? 1 : 0,
        b.antiDGivenDate ?? null,
        b.antiDBatchDose ?? null,
        b.hivStatus,
        b.hivTestedDate ?? null,
        b.hbsagStatus,
        b.hbsagTestedDate ?? null,
        b.hcvStatus,
        b.hcvTestedDate ?? null,
        b.vdrlRprStatus,
        b.vdrlRprTiter ?? null,
        b.vdrlTestedDate ?? null,
        b.rubellaIggStatus,
        b.rubellaIggValue ?? null,
        b.rubellaTestedDate ?? null,
        b.gbsCultureStatus,
        b.gbsTestedDate ?? null,
        b.urineCultureStatus,
        b.urineCultureOrganism ?? null,
        b.urineCultureDate ?? null,
        b.hemoglobinopathyHplc,
        b.hplcHba2Pct ?? null,
        b.hplcTestedDate ?? null,
        b.consultantReviewNotes ?? null,
        user.id,
        now
      );
    }

    audit(db, {
      actorId: user.id,
      action: 'antenatal_serology.update',
      entity: 'patient',
      entityId: patientId,
      detail: {
        bloodGroup: `${b.bloodGroupAbo || ''}${b.rhFactor === 'positive' ? '+' : b.rhFactor === 'negative' ? '-' : ''}`,
        hivStatus: b.hivStatus,
        hbsagStatus: b.hbsagStatus,
        vdrlStatus: b.vdrlRprStatus,
        antiDGiven: b.antiDGiven,
      },
    });

    const updated = db.prepare('SELECT * FROM antenatal_serology_matrix WHERE patient_id = ?').get(patientId) as any;
    return {
      id: updated.id,
      patientId: updated.patient_id,
      bloodGroupAbo: updated.blood_group_abo,
      rhFactor: updated.rh_factor,
      indirectCoombsTestBooking: updated.indirect_coombs_test_booking,
      indirectCoombsTest28w: updated.indirect_coombs_test_28w,
      antiDGiven: updated.anti_d_given === 1,
      antiDGivenDate: updated.anti_d_given_date,
      antiDBatchDose: updated.anti_d_batch_dose,
      hivStatus: updated.hiv_status,
      hivTestedDate: updated.hiv_tested_date,
      hbsagStatus: updated.hbsag_status,
      hbsagTestedDate: updated.hbsag_tested_date,
      hcvStatus: updated.hcv_status,
      hcvTestedDate: updated.hcv_tested_date,
      vdrlRprStatus: updated.vdrl_rpr_status,
      vdrlRprTiter: updated.vdrl_rpr_titer,
      vdrlTestedDate: updated.vdrl_tested_date,
      rubellaIggStatus: updated.rubella_igg_status,
      rubellaIggValue: updated.rubella_igg_value,
      rubellaTestedDate: updated.rubella_tested_date,
      gbsCultureStatus: updated.gbs_culture_status,
      gbsTestedDate: updated.gbs_tested_date,
      urineCultureStatus: updated.urine_culture_status,
      urineCultureOrganism: updated.urine_culture_organism,
      urineCultureDate: updated.urine_culture_date,
      hemoglobinopathyHplc: updated.hemoglobinopathy_hplc,
      hplcHba2Pct: updated.hplc_hba2_pct,
      hplcTestedDate: updated.hplc_tested_date,
      consultantReviewNotes: updated.consultant_review_notes,
      updatedBy: updated.updated_by,
      updatedByName: user.fullName,
      updatedAt: updated.updated_at,
    };
  });
}
