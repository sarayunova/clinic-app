import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  calculateFetalDoppler,
  type DopplerCalculationInput,
  type DopplerCalculationResult,
} from '../../web/src/dopplerEngine.js';

function assertCanManageDoppler(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can create or edit Doppler reports');
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

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const dopplerAssessmentSchema = z.object({
  patientId: z.number().int().positive('Valid patient ID required'),
  ultrasoundReportId: z.number().int().positive().nullable().optional(),
  assessmentDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  assessmentTime: z.string().max(10).nullable().optional(),
  gestationalAgeWeeks: z.number().int().min(18).max(44, 'Gestational age must be between 18 and 44 weeks'),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),

  // Biometry
  estimatedFetalWeightG: optNullableNumber(100, 7000),
  efwPercentile: optNullableNumber(0, 100),
  abdominalCircumferenceMm: optNullableNumber(50, 450),
  acPercentile: optNullableNumber(0, 100),

  // Umbilical Artery
  uaPi: z.number().min(0.1).max(5.0, 'UA PI must be between 0.1 and 5.0'),
  uaRi: optNullableNumber(0.1, 1.5),
  uaSdRatio: optNullableNumber(0.5, 20),
  uaEndDiastolicFlow: z
    .enum(['normal_positive', 'reduced', 'aedf_absent', 'redf_reversed'])
    .default('normal_positive'),
  uaPiCentile: z.number().optional(),
  uaPiStatus: z.enum(['normal', 'elevated_above_95th']).optional(),

  // Middle Cerebral Artery
  mcaPi: z.number().min(0.1).max(5.0, 'MCA PI must be between 0.1 and 5.0'),
  mcaRi: optNullableNumber(0.1, 1.5),
  mcaPsvCmS: optNullableNumber(5, 200),
  mcaPsvMom: optNullableNumber(0.1, 5.0),
  mcaPiCentile: z.number().optional(),
  mcaBrainSparing: z.enum(['none', 'vasodilation_below_5th']).optional(),
  fetalAnemiaRisk: z.enum(['none', 'mild', 'moderate_to_severe']).default('none'),

  // Cerebroplacental Ratio
  cprRatio: z.number().optional(),
  cprCentile: z.number().optional(),
  cprStatus: z.enum(['normal', 'brain_sparing_redistribution']).optional(),

  // Uterine Artery
  utaLeftPi: optNullableNumber(0.1, 5.0),
  utaRightPi: optNullableNumber(0.1, 5.0),
  utaMeanPi: optNullableNumber(0.1, 5.0),
  utaMeanPiCentile: optNullableNumber(0, 100),
  utaNotching: z.enum(['none', 'unilateral', 'bilateral']).default('none'),

  // Ductus Venosus
  dvPiv: optNullableNumber(0.1, 3.0),
  dvPivCentile: optNullableNumber(0, 100),
  dvAWave: z.enum(['positive', 'absent', 'reversed', 'not_performed']).default('positive'),
  dvStatus: z.enum(['normal', 'elevated_above_95th', 'reversed_a_wave', 'not_performed']).optional(),

  // Staging & Plan
  fgrClassification: z.enum(['aga', 'sga', 'early_fgr', 'late_fgr']).optional(),
  barcelonaStage: z.enum(['stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_4']).optional(),
  monitoringFrequencyRecommendation: z.string().max(500).optional(),
  deliveryTimingRecommendation: z.string().max(500).optional(),
  steroidsIndicated: z.boolean().default(false),
  mgso4NeuroprotectionIndicated: z.boolean().default(false),

  clinicalNotes: optNullableString(2000),
  performedBy: optNullableString(150),
});

export const dopplerCalculateSchema = z.object({
  gestationalAgeWeeks: z.number().int().min(18).max(44),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  estimatedFetalWeightG: optNullableNumber(100, 7000),
  efwPercentile: optNullableNumber(0, 100),
  abdominalCircumferenceMm: optNullableNumber(50, 450),
  acPercentile: optNullableNumber(0, 100),

  uaPi: z.number().min(0.1).max(5.0),
  uaRi: optNullableNumber(0.1, 1.5),
  uaSdRatio: optNullableNumber(0.5, 20),
  uaEndDiastolicFlow: z
    .enum(['normal_positive', 'reduced', 'aedf_absent', 'redf_reversed'])
    .default('normal_positive'),

  mcaPi: z.number().min(0.1).max(5.0),
  mcaRi: optNullableNumber(0.1, 1.5),
  mcaPsvCmS: optNullableNumber(5, 200),

  utaLeftPi: optNullableNumber(0.1, 5.0),
  utaRightPi: optNullableNumber(0.1, 5.0),
  utaMeanPi: optNullableNumber(0.1, 5.0),
  utaNotching: z.enum(['none', 'unilateral', 'bilateral']).default('none'),

  dvPiv: optNullableNumber(0.1, 3.0),
  dvAWave: z.enum(['positive', 'absent', 'reversed', 'not_performed']).default('positive'),
});

function rowToAssessment(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    ultrasoundReportId: r.ultrasound_report_id,
    assessmentDate: r.assessment_date,
    assessmentTime: r.assessment_time,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,

    estimatedFetalWeightG: r.estimated_fetal_weight_g,
    efwPercentile: r.efw_percentile,
    abdominalCircumferenceMm: r.abdominal_circumference_mm,
    acPercentile: r.ac_percentile,

    uaPi: r.ua_pi,
    uaRi: r.ua_ri,
    uaSdRatio: r.ua_sd_ratio,
    uaEndDiastolicFlow: r.ua_end_diastolic_flow,
    uaPiCentile: r.ua_pi_centile,
    uaPiStatus: r.ua_pi_status,

    mcaPi: r.mca_pi,
    mcaRi: r.mca_ri,
    mcaPsvCmS: r.mca_psv_cm_s,
    mcaPsvMom: r.mca_psv_mom,
    mcaPiCentile: r.mca_pi_centile,
    mcaBrainSparing: r.mca_brain_sparing,
    fetalAnemiaRisk: r.fetal_anemia_risk,

    cprRatio: r.cpr_ratio,
    cprCentile: r.cpr_centile,
    cprStatus: r.cpr_status,

    utaLeftPi: r.uta_left_pi,
    utaRightPi: r.uta_right_pi,
    utaMeanPi: r.uta_mean_pi,
    utaMeanPiCentile: r.uta_mean_pi_centile,
    utaNotching: r.uta_notching,

    dvPiv: r.dv_piv,
    dvPivCentile: r.dv_piv_centile,
    dvAWave: r.dv_a_wave,
    dvStatus: r.dv_status,

    fgrClassification: r.fgr_classification,
    barcelonaStage: r.barcelona_stage,
    monitoringFrequencyRecommendation: r.monitoring_frequency_recommendation,
    deliveryTimingRecommendation: r.delivery_timing_recommendation,
    steroidsIndicated: Boolean(r.steroids_indicated),
    mgso4NeuroprotectionIndicated: Boolean(r.mgso4_neuroprotection_indicated),

    clinicalNotes: r.clinical_notes,
    performedBy: r.performed_by,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,

    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerFetalDopplerRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Real-time Calculation Preview
  app.post('/api/doppler/calculate', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = dopplerCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid Doppler parameters', parsed.error.format());
    }

    const calcResult = calculateFetalDoppler({
      gestationalAgeWeeks: parsed.data.gestationalAgeWeeks,
      gestationalAgeDays: parsed.data.gestationalAgeDays,
      estimatedFetalWeightG: parsed.data.estimatedFetalWeightG ?? undefined,
      efwPercentile: parsed.data.efwPercentile ?? undefined,
      abdominalCircumferenceMm: parsed.data.abdominalCircumferenceMm ?? undefined,
      acPercentile: parsed.data.acPercentile ?? undefined,
      uaPi: parsed.data.uaPi,
      uaRi: parsed.data.uaRi ?? undefined,
      uaSdRatio: parsed.data.uaSdRatio ?? undefined,
      uaEndDiastolicFlow: parsed.data.uaEndDiastolicFlow,
      mcaPi: parsed.data.mcaPi,
      mcaRi: parsed.data.mcaRi ?? undefined,
      mcaPsvCmS: parsed.data.mcaPsvCmS ?? undefined,
      utaLeftPi: parsed.data.utaLeftPi ?? undefined,
      utaRightPi: parsed.data.utaRightPi ?? undefined,
      utaMeanPi: parsed.data.utaMeanPi ?? undefined,
      utaNotching: parsed.data.utaNotching,
      dvPiv: parsed.data.dvPiv ?? undefined,
      dvAWave: parsed.data.dvAWave,
    });

    return reply.send(calcResult);
  });

  // 2. List Doppler Assessments for a Patient
  app.get('/api/patients/:patientId/doppler', async (req: FastifyRequest<{ Params: { patientId: string } }>, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number(req.params.patientId);
    if (!patientId || isNaN(patientId)) throw badRequest('Invalid patient ID');

    const rows = ctx.db
      .prepare(
        `SELECT d.*, u.full_name as reviewed_by_name
         FROM fetal_doppler_assessments d
         LEFT JOIN users u ON d.reviewed_by = u.id
         WHERE d.patient_id = ?
         ORDER BY d.assessment_date DESC, d.id DESC`,
      )
      .all(patientId);

    const assessments = rows.map(rowToAssessment);
    return reply.send({
      total: assessments.length,
      assessments,
    });
  });

  // 3. Get Single Doppler Assessment
  app.get('/api/patients/:patientId/doppler/:id', async (req: FastifyRequest<{ Params: { patientId: string; id: string } }>, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number(req.params.patientId);
    const id = Number(req.params.id);
    if (!patientId || !id) throw badRequest('Invalid patient or assessment ID');

    const row = ctx.db
      .prepare(
        `SELECT d.*, u.full_name as reviewed_by_name
         FROM fetal_doppler_assessments d
         LEFT JOIN users u ON d.reviewed_by = u.id
         WHERE d.id = ? AND d.patient_id = ?`,
      )
      .get(id, patientId);

    if (!row) throw notFound('Doppler assessment');
    return reply.send(rowToAssessment(row));
  });

  // 4. Create Doppler Assessment
  app.post('/api/patients/:patientId/doppler', async (req: FastifyRequest<{ Params: { patientId: string } }>, reply) => {
    const user = assertCanManageDoppler(req);
    const patientId = Number(req.params.patientId);
    if (!patientId || isNaN(patientId)) throw badRequest('Invalid patient ID');

    const pCheck = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!pCheck) throw notFound('Patient');

    const parsed = dopplerAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid assessment payload', parsed.error.format());
    }

    const d = parsed.data;

    // Run engine to ensure all calculations are populated
    const calc = calculateFetalDoppler({
      gestationalAgeWeeks: d.gestationalAgeWeeks,
      gestationalAgeDays: d.gestationalAgeDays,
      estimatedFetalWeightG: d.estimatedFetalWeightG ?? undefined,
      efwPercentile: d.efwPercentile ?? undefined,
      abdominalCircumferenceMm: d.abdominalCircumferenceMm ?? undefined,
      acPercentile: d.acPercentile ?? undefined,
      uaPi: d.uaPi,
      uaRi: d.uaRi ?? undefined,
      uaSdRatio: d.uaSdRatio ?? undefined,
      uaEndDiastolicFlow: d.uaEndDiastolicFlow,
      mcaPi: d.mcaPi,
      mcaRi: d.mcaRi ?? undefined,
      mcaPsvCmS: d.mcaPsvCmS ?? undefined,
      utaLeftPi: d.utaLeftPi ?? undefined,
      utaRightPi: d.utaRightPi ?? undefined,
      utaMeanPi: d.utaMeanPi ?? undefined,
      utaNotching: d.utaNotching,
      dvPiv: d.dvPiv ?? undefined,
      dvAWave: d.dvAWave,
    });

    const now = nowIso();
    let newId = 0;

    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(
          `INSERT INTO fetal_doppler_assessments (
            patient_id, ultrasound_report_id, assessment_date, assessment_time,
            gestational_age_weeks, gestational_age_days,
            estimated_fetal_weight_g, efw_percentile, abdominal_circumference_mm, ac_percentile,
            ua_pi, ua_ri, ua_sd_ratio, ua_end_diastolic_flow, ua_pi_centile, ua_pi_status,
            mca_pi, mca_ri, mca_psv_cm_s, mca_psv_mom, mca_pi_centile, mca_brain_sparing, fetal_anemia_risk,
            cpr_ratio, cpr_centile, cpr_status,
            uta_left_pi, uta_right_pi, uta_mean_pi, uta_mean_pi_centile, uta_notching,
            dv_piv, dv_piv_centile, dv_a_wave, dv_status,
            fgr_classification, barcelona_stage,
            monitoring_frequency_recommendation, delivery_timing_recommendation,
            steroids_indicated, mgso4_neuroprotection_indicated,
            clinical_notes, performed_by, reviewed_by,
            created_by, updated_by, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?
          )`,
        )
        .run(
          patientId,
          d.ultrasoundReportId ?? null,
          d.assessmentDate,
          d.assessmentTime ?? null,
          d.gestationalAgeWeeks,
          d.gestationalAgeDays,
          d.estimatedFetalWeightG ?? null,
          d.efwPercentile ?? null,
          d.abdominalCircumferenceMm ?? null,
          d.acPercentile ?? null,
          calc.uaPi,
          d.uaRi ?? null,
          d.uaSdRatio ?? null,
          calc.uaEndDiastolicFlow,
          calc.uaPiCentile,
          calc.uaPiStatus,
          calc.mcaPi,
          d.mcaRi ?? null,
          d.mcaPsvCmS ?? null,
          calc.mcaPsvMom ?? null,
          calc.mcaPiCentile,
          calc.mcaBrainSparing,
          calc.fetalAnemiaRisk,
          calc.cprRatio,
          calc.cprCentile,
          calc.cprStatus,
          d.utaLeftPi ?? null,
          d.utaRightPi ?? null,
          calc.utaMeanPi ?? null,
          calc.utaMeanPiCentile ?? null,
          calc.utaNotching,
          calc.dvPiv ?? null,
          calc.dvPivCentile ?? null,
          calc.dvAWave,
          calc.dvStatus,
          d.fgrClassification || calc.fgrClassification,
          d.barcelonaStage || calc.barcelonaStage,
          d.monitoringFrequencyRecommendation || calc.monitoringFrequencyRecommendation,
          d.deliveryTimingRecommendation || calc.deliveryTimingRecommendation,
          d.steroidsIndicated ? 1 : calc.steroidsIndicated ? 1 : 0,
          d.mgso4NeuroprotectionIndicated ? 1 : calc.mgso4NeuroprotectionIndicated ? 1 : 0,
          d.clinicalNotes ?? null,
          d.performedBy ?? user.fullName,
          user.id,
          user.id,
          user.id,
          now,
          now,
        );
      newId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'doppler.assessment_create',
        entity: 'fetal_doppler_assessments',
        entityId: newId,
        detail: {
          patientId,
          gestationalAgeWeeks: d.gestationalAgeWeeks,
          cprRatio: calc.cprRatio,
          cprStatus: calc.cprStatus,
          barcelonaStage: calc.barcelonaStage,
        },
      });
    });

    const created = ctx.db
      .prepare(
        `SELECT d.*, u.full_name as reviewed_by_name
         FROM fetal_doppler_assessments d
         LEFT JOIN users u ON d.reviewed_by = u.id
         WHERE d.id = ?`,
      )
      .get(newId);

    return reply.status(201).send(rowToAssessment(created));
  });

  // 5. Update Doppler Assessment
  app.put('/api/patients/:patientId/doppler/:id', async (req: FastifyRequest<{ Params: { patientId: string; id: string } }>, reply) => {
    const user = assertCanManageDoppler(req);
    const patientId = Number(req.params.patientId);
    const id = Number(req.params.id);
    if (!patientId || !id) throw badRequest('Invalid patient or assessment ID');

    const existing = ctx.db
      .prepare('SELECT id FROM fetal_doppler_assessments WHERE id = ? AND patient_id = ?')
      .get(id, patientId);
    if (!existing) throw notFound('Doppler assessment');

    const parsed = dopplerAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid assessment payload', parsed.error.format());
    }

    const d = parsed.data;

    const calc = calculateFetalDoppler({
      gestationalAgeWeeks: d.gestationalAgeWeeks,
      gestationalAgeDays: d.gestationalAgeDays,
      estimatedFetalWeightG: d.estimatedFetalWeightG ?? undefined,
      efwPercentile: d.efwPercentile ?? undefined,
      abdominalCircumferenceMm: d.abdominalCircumferenceMm ?? undefined,
      acPercentile: d.acPercentile ?? undefined,
      uaPi: d.uaPi,
      uaRi: d.uaRi ?? undefined,
      uaSdRatio: d.uaSdRatio ?? undefined,
      uaEndDiastolicFlow: d.uaEndDiastolicFlow,
      mcaPi: d.mcaPi,
      mcaRi: d.mcaRi ?? undefined,
      mcaPsvCmS: d.mcaPsvCmS ?? undefined,
      utaLeftPi: d.utaLeftPi ?? undefined,
      utaRightPi: d.utaRightPi ?? undefined,
      utaMeanPi: d.utaMeanPi ?? undefined,
      utaNotching: d.utaNotching,
      dvPiv: d.dvPiv ?? undefined,
      dvAWave: d.dvAWave,
    });

    const now = nowIso();

    tx(ctx.db, () => {
      ctx.db
        .prepare(
          `UPDATE fetal_doppler_assessments SET
            ultrasound_report_id = ?, assessment_date = ?, assessment_time = ?,
            gestational_age_weeks = ?, gestational_age_days = ?,
            estimated_fetal_weight_g = ?, efw_percentile = ?, abdominal_circumference_mm = ?, ac_percentile = ?,
            ua_pi = ?, ua_ri = ?, ua_sd_ratio = ?, ua_end_diastolic_flow = ?, ua_pi_centile = ?, ua_pi_status = ?,
            mca_pi = ?, mca_ri = ?, mca_psv_cm_s = ?, mca_psv_mom = ?, mca_pi_centile = ?, mca_brain_sparing = ?, fetal_anemia_risk = ?,
            cpr_ratio = ?, cpr_centile = ?, cpr_status = ?,
            uta_left_pi = ?, uta_right_pi = ?, uta_mean_pi = ?, uta_mean_pi_centile = ?, uta_notching = ?,
            dv_piv = ?, dv_piv_centile = ?, dv_a_wave = ?, dv_status = ?,
            fgr_classification = ?, barcelona_stage = ?,
            monitoring_frequency_recommendation = ?, delivery_timing_recommendation = ?,
            steroids_indicated = ?, mgso4_neuroprotection_indicated = ?,
            clinical_notes = ?, performed_by = ?, reviewed_by = ?,
            updated_by = ?, updated_at = ?
          WHERE id = ? AND patient_id = ?`,
        )
        .run(
          d.ultrasoundReportId ?? null,
          d.assessmentDate,
          d.assessmentTime ?? null,
          d.gestationalAgeWeeks,
          d.gestationalAgeDays,
          d.estimatedFetalWeightG ?? null,
          d.efwPercentile ?? null,
          d.abdominalCircumferenceMm ?? null,
          d.acPercentile ?? null,
          calc.uaPi,
          d.uaRi ?? null,
          d.uaSdRatio ?? null,
          calc.uaEndDiastolicFlow,
          calc.uaPiCentile,
          calc.uaPiStatus,
          calc.mcaPi,
          d.mcaRi ?? null,
          d.mcaPsvCmS ?? null,
          calc.mcaPsvMom ?? null,
          calc.mcaPiCentile,
          calc.mcaBrainSparing,
          calc.fetalAnemiaRisk,
          calc.cprRatio,
          calc.cprCentile,
          calc.cprStatus,
          d.utaLeftPi ?? null,
          d.utaRightPi ?? null,
          calc.utaMeanPi ?? null,
          calc.utaMeanPiCentile ?? null,
          calc.utaNotching,
          calc.dvPiv ?? null,
          calc.dvPivCentile ?? null,
          calc.dvAWave,
          calc.dvStatus,
          d.fgrClassification || calc.fgrClassification,
          d.barcelonaStage || calc.barcelonaStage,
          d.monitoringFrequencyRecommendation || calc.monitoringFrequencyRecommendation,
          d.deliveryTimingRecommendation || calc.deliveryTimingRecommendation,
          d.steroidsIndicated ? 1 : calc.steroidsIndicated ? 1 : 0,
          d.mgso4NeuroprotectionIndicated ? 1 : calc.mgso4NeuroprotectionIndicated ? 1 : 0,
          d.clinicalNotes ?? null,
          d.performedBy ?? user.fullName,
          user.id,
          user.id,
          now,
          id,
          patientId,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'doppler.assessment_update',
        entity: 'fetal_doppler_assessments',
        entityId: id,
        detail: {
          patientId,
          cprRatio: calc.cprRatio,
          barcelonaStage: calc.barcelonaStage,
        },
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT d.*, u.full_name as reviewed_by_name
         FROM fetal_doppler_assessments d
         LEFT JOIN users u ON d.reviewed_by = u.id
         WHERE d.id = ?`,
      )
      .get(id);

    return reply.send(rowToAssessment(updated));
  });

  // 6. Delete Doppler Assessment (Doctor only)
  app.delete('/api/patients/:patientId/doppler/:id', async (req: FastifyRequest<{ Params: { patientId: string; id: string } }>, reply) => {
    const user = requirePerm(req, 'user:manage'); // Doctor only
    const patientId = Number(req.params.patientId);
    const id = Number(req.params.id);
    if (!patientId || !id) throw badRequest('Invalid patient or assessment ID');

    const existing = ctx.db
      .prepare('SELECT id FROM fetal_doppler_assessments WHERE id = ? AND patient_id = ?')
      .get(id, patientId);
    if (!existing) throw notFound('Doppler assessment');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM fetal_doppler_assessments WHERE id = ? AND patient_id = ?').run(id, patientId);
      audit(ctx.db, {
        actorId: user.id,
        action: 'doppler.assessment_delete',
        entity: 'fetal_doppler_assessments',
        entityId: id,
        detail: { patientId },
      });
    });

    return reply.send({ success: true, message: 'Doppler assessment deleted' });
  });

  // 7. Audit Print Access
  app.post('/api/patients/:patientId/doppler/:id/audit-print', async (req: FastifyRequest<{ Params: { patientId: string; id: string } }>, reply) => {
    const user = requirePerm(req, 'patient:read_clinical');
    const patientId = Number(req.params.patientId);
    const id = Number(req.params.id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'doppler.assessment_print',
      entity: 'fetal_doppler_assessments',
      entityId: id,
      detail: { patientId },
    });

    return reply.send({ ok: true });
  });
}
