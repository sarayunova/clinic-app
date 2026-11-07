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
  calculatePerinatalLossAudit,
  type PerinatalLossInput,
  type PerinatalLossAuditResult,
} from '../../web/src/perinatalLossEngine.js';

function assertCanManagePerinatalLoss(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can record perinatal loss audits');
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

export const perinatalLossCalculateSchema = z.object({
  lossType: z.enum([
    'early_miscarriage_lt_12w',
    'late_miscarriage_12_20w',
    'stillbirth_antepartum',
    'stillbirth_intrapartum',
    'neonatal_death_early',
    'medical_termination_anomaly',
  ]),
  gestationalAgeWeeks: z.number().int().min(4).max(44),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  fetalBirthWeightG: optNullableNumber(10, 7000),
  primaryCauseCategory: z.enum([
    'fetal_anomaly_genetic',
    'umbilical_cord_accident',
    'placental_insufficiency_infarction',
    'placental_abruption',
    'chorioamnionitis_infection',
    'maternal_medical_preeclampsia',
    'maternal_medical_diabetes',
    'maternal_cholestasis_icp',
    'intrapartum_asphyxia',
    'unexplained_idiopathic',
  ]),
  primaryCauseDetails: z.string().min(1).max(1000),
  maternalBloodGroup: optNullableString(20),
  fetomaternalHemorrhageMl: optNullableNumber(0, 500),
  autopsyConsentStatus: z.enum(['full_autopsy', 'limited_autopsy', 'external_and_imaging', 'declined']).optional(),
  cmaChromosomalResult: optNullableString(1000),
  placentalHistologyFindings: optNullableString(2000),
});

export const perinatalLossEpisodeSchema = perinatalLossCalculateSchema.extend({
  patientId: z.number().int().positive('Valid patient ID required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  deliveryDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').nullable().optional(),
  deliveryTime: optNullableString(10),
  parityPrior: optNullableString(50),
  modeOfDelivery: z.enum([
    'spontaneous_vaginal',
    'induced_vaginal',
    'emergency_cesarean',
    'elective_cesarean',
    'surgical_evacuation_d_and_e',
  ]),
  fetalPresentation: z.enum(['cephalic', 'breech', 'transverse', 'other']).nullable().optional(),
  fetalWeightCentile: optNullableNumber(0, 100),
  fetalAppearance: z
    .enum([
      'fresh_stillbirth',
      'macerated_slight_peeling',
      'macerated_moderate',
      'macerated_severe',
      'gross_anomalies_present',
    ])
    .default('fresh_stillbirth'),
  apparentDysmorphicFeatures: optNullableString(1000),
  contributingFactors: optNullableString(1000),
  diagnosticWorkupJson: optNullableString(10000),

  antiDAdministered: z.boolean().default(false),
  antiDDoseMcg: optNullableNumber(0, 5000),
  lactationSuppressionGiven: z.boolean().default(true),
  lactationSuppressionDetails: optNullableString(500),
  memoryBoxOffered: z.boolean().default(true),
  memoryBoxAccepted: z.boolean().default(true),
  bereavementCounselorContacted: z.boolean().default(true),

  recurrenceRiskCategory: z
    .enum([
      'low_less_than_1_pct',
      'moderate_2_to_5_pct',
      'high_gt_5_pct',
      'dependent_on_genetics',
    ])
    .optional(),
  futurePregnancyPlan: z.string().min(1).max(2000),
  counselingNotes: optNullableString(2000),
  consultantName: optNullableString(120),
  reviewedBy: z.number().int().positive().optional(),
});

function rowToLossEpisode(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    lossType: r.loss_type,
    diagnosisDate: r.diagnosis_date,
    deliveryDate: r.delivery_date,
    deliveryTime: r.delivery_time,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    parityPrior: r.parity_prior,

    modeOfDelivery: r.mode_of_delivery,
    fetalPresentation: r.fetal_presentation,
    fetalBirthWeightG: r.fetal_birth_weight_g,
    fetalWeightCentile: r.fetal_weight_centile,
    fetalAppearance: r.fetal_appearance,
    apparentDysmorphicFeatures: r.apparent_dysmorphic_features,

    primaryCauseCategory: r.primary_cause_category,
    primaryCauseDetails: r.primary_cause_details,
    contributingFactors: r.contributing_factors,
    diagnosticWorkupJson: r.diagnostic_workup_json,

    maternalBloodGroup: r.maternal_blood_group,
    antiDAdministered: Boolean(r.anti_d_administered),
    antiDDoseMcg: r.anti_d_dose_mcg,
    lactationSuppressionGiven: Boolean(r.lactation_suppression_given),
    lactationSuppressionDetails: r.lactation_suppression_details,
    memoryBoxOffered: Boolean(r.memory_box_offered),
    memoryBoxAccepted: Boolean(r.memory_box_accepted),
    bereavementCounselorContacted: Boolean(r.bereavement_counselor_contacted),

    recurrenceRiskCategory: r.recurrence_risk_category,
    futurePregnancyPlan: r.future_pregnancy_plan,
    counselingNotes: r.clinical_notes ?? r.counseling_notes,

    consultantName: r.consultant_name,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,

    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerPerinatalLossRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Live Audit Preview
  app.post('/api/perinatal-loss/calculate', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = perinatalLossCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid calculation parameters', parsed.error.format());
    }

    const calcResult = calculatePerinatalLossAudit({
      lossType: parsed.data.lossType,
      gestationalAgeWeeks: parsed.data.gestationalAgeWeeks,
      gestationalAgeDays: parsed.data.gestationalAgeDays,
      fetalBirthWeightG: parsed.data.fetalBirthWeightG ?? undefined,
      primaryCauseCategory: parsed.data.primaryCauseCategory,
      primaryCauseDetails: parsed.data.primaryCauseDetails,
      maternalBloodGroup: parsed.data.maternalBloodGroup ?? undefined,
      fetomaternalHemorrhageMl: parsed.data.fetomaternalHemorrhageMl ?? undefined,
      autopsyConsentStatus: parsed.data.autopsyConsentStatus,
      cmaChromosomalResult: parsed.data.cmaChromosomalResult ?? undefined,
      placentalHistologyFindings: parsed.data.placentalHistologyFindings ?? undefined,
    });

    return calcResult;
  });

  // 2. List Patient Loss Episodes
  app.get<{ Params: { patientId: string } }>(
    '/api/patients/:patientId/perinatal-loss',
    async (req, reply) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number.parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

      const rows = ctx.db
        .prepare(
          `SELECT pl.*, u.full_name as reviewed_by_name
           FROM perinatal_loss_episodes pl
           LEFT JOIN users u ON u.id = pl.reviewed_by
           WHERE pl.patient_id = ?
           ORDER BY pl.diagnosis_date DESC, pl.created_at DESC`,
        )
        .all(patientId);

      return rows.map(rowToLossEpisode);
    },
  );

  // 3. Get Single Loss Episode
  app.get<{ Params: { id: string } }>('/api/perinatal-loss/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const row = ctx.db
      .prepare(
        `SELECT pl.*, u.full_name as reviewed_by_name
         FROM perinatal_loss_episodes pl
         LEFT JOIN users u ON u.id = pl.reviewed_by
         WHERE pl.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('Perinatal loss record not found');
    return rowToLossEpisode(row);
  });

  // 4. Create Loss Episode
  app.post('/api/perinatal-loss', async (req: FastifyRequest, reply) => {
    const user = assertCanManagePerinatalLoss(req);
    const parsed = perinatalLossEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const calc = calculatePerinatalLossAudit({
      lossType: data.lossType,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      gestationalAgeDays: data.gestationalAgeDays,
      fetalBirthWeightG: data.fetalBirthWeightG ?? undefined,
      primaryCauseCategory: data.primaryCauseCategory,
      primaryCauseDetails: data.primaryCauseDetails,
      maternalBloodGroup: data.maternalBloodGroup ?? undefined,
      fetomaternalHemorrhageMl: data.fetomaternalHemorrhageMl ?? undefined,
      autopsyConsentStatus: data.autopsyConsentStatus,
    });

    const now = nowIso();
    const reviewedBy = data.reviewedBy || user.id;
    const recurrenceRiskCategory = data.recurrenceRiskCategory || calc.recurrenceRiskCategory;

    const insertedId = tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        INSERT INTO perinatal_loss_episodes (
          patient_id, admission_id, loss_type, diagnosis_date, delivery_date, delivery_time,
          gestational_age_weeks, gestational_age_days, parity_prior,
          mode_of_delivery, fetal_presentation, fetal_birth_weight_g, fetal_weight_centile,
          fetal_appearance, apparent_dysmorphic_features, primary_cause_category,
          primary_cause_details, contributing_factors, diagnostic_workup_json,
          maternal_blood_group, anti_d_administered, anti_d_dose_mcg,
          lactation_suppression_given, lactation_suppression_details,
          memory_box_offered, memory_box_accepted, bereavement_counselor_contacted,
          recurrence_risk_category, future_pregnancy_plan, counseling_notes,
          consultant_name, reviewed_by, created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      const result = stmt.run(
        data.patientId,
        data.admissionId ?? null,
        data.lossType,
        data.diagnosisDate,
        data.deliveryDate ?? null,
        data.deliveryTime ?? null,
        data.gestationalAgeWeeks,
        data.gestationalAgeDays,
        data.parityPrior ?? null,
        data.modeOfDelivery,
        data.fetalPresentation ?? null,
        data.fetalBirthWeightG ?? null,
        data.fetalWeightCentile ?? null,
        data.fetalAppearance,
        data.apparentDysmorphicFeatures ?? null,
        data.primaryCauseCategory,
        data.primaryCauseDetails,
        data.contributingFactors ?? null,
        data.diagnosticWorkupJson ?? '{}',
        data.maternalBloodGroup ?? null,
        data.antiDAdministered ? 1 : 0,
        data.antiDDoseMcg ?? (calc.antiDRecommendation.indicated ? calc.antiDRecommendation.recommendedDoseMcg : null),
        data.lactationSuppressionGiven ? 1 : 0,
        data.lactationSuppressionDetails ?? calc.lactationSuppressionPlan,
        data.memoryBoxOffered ? 1 : 0,
        data.memoryBoxAccepted ? 1 : 0,
        data.bereavementCounselorContacted ? 1 : 0,
        recurrenceRiskCategory,
        data.futurePregnancyPlan,
        data.counselingNotes ?? null,
        data.consultantName ?? null,
        reviewedBy,
        user.id,
        user.id,
        now,
        now,
      );

      const newId = Number(result.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'perinatal_loss.episode_create',
        entity: 'perinatal_loss_episodes',
        entityId: newId,
        detail: JSON.stringify({
          patientId: data.patientId,
          lossType: data.lossType,
          causeCategory: data.primaryCauseCategory,
        }),
      });

      return newId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT pl.*, u.full_name as reviewed_by_name
         FROM perinatal_loss_episodes pl
         LEFT JOIN users u ON u.id = pl.reviewed_by
         WHERE pl.id = ?`,
      )
      .get(insertedId);

    return rowToLossEpisode(created);
  });

  // 5. Update Loss Episode
  app.put<{ Params: { id: string } }>('/api/perinatal-loss/:id', async (req, reply) => {
    const user = assertCanManagePerinatalLoss(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing = ctx.db
      .prepare('SELECT * FROM perinatal_loss_episodes WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Perinatal loss record not found');

    const parsed = perinatalLossEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const now = nowIso();
    const reviewedBy = data.reviewedBy || existing.reviewed_by;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE perinatal_loss_episodes SET
            admission_id = ?, loss_type = ?, diagnosis_date = ?, delivery_date = ?, delivery_time = ?,
            gestational_age_weeks = ?, gestational_age_days = ?, parity_prior = ?,
            mode_of_delivery = ?, fetal_presentation = ?, fetal_birth_weight_g = ?, fetal_weight_centile = ?,
            fetal_appearance = ?, apparent_dysmorphic_features = ?, primary_cause_category = ?,
            primary_cause_details = ?, contributing_factors = ?, diagnostic_workup_json = ?,
            maternal_blood_group = ?, anti_d_administered = ?, anti_d_dose_mcg = ?,
            lactation_suppression_given = ?, lactation_suppression_details = ?,
            memory_box_offered = ?, memory_box_accepted = ?, bereavement_counselor_contacted = ?,
            recurrence_risk_category = ?, future_pregnancy_plan = ?, counseling_notes = ?,
            consultant_name = ?, reviewed_by = ?, updated_by = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          data.admissionId ?? null,
          data.lossType,
          data.diagnosisDate,
          data.deliveryDate ?? null,
          data.deliveryTime ?? null,
          data.gestationalAgeWeeks,
          data.gestationalAgeDays,
          data.parityPrior ?? null,
          data.modeOfDelivery,
          data.fetalPresentation ?? null,
          data.fetalBirthWeightG ?? null,
          data.fetalWeightCentile ?? null,
          data.fetalAppearance,
          data.apparentDysmorphicFeatures ?? null,
          data.primaryCauseCategory,
          data.primaryCauseDetails,
          data.contributingFactors ?? null,
          data.diagnosticWorkupJson ?? '{}',
          data.maternalBloodGroup ?? null,
          data.antiDAdministered ? 1 : 0,
          data.antiDDoseMcg ?? null,
          data.lactationSuppressionGiven ? 1 : 0,
          data.lactationSuppressionDetails ?? null,
          data.memoryBoxOffered ? 1 : 0,
          data.memoryBoxAccepted ? 1 : 0,
          data.bereavementCounselorContacted ? 1 : 0,
          data.recurrenceRiskCategory ?? existing.recurrence_risk_category,
          data.futurePregnancyPlan,
          data.counselingNotes ?? null,
          data.consultantName ?? null,
          reviewedBy,
          user.id,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'perinatal_loss.episode_update',
        entity: 'perinatal_loss_episodes',
        entityId: id,
        detail: JSON.stringify({ patientId: existing.patient_id }),
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT pl.*, u.full_name as reviewed_by_name
         FROM perinatal_loss_episodes pl
         LEFT JOIN users u ON u.id = pl.reviewed_by
         WHERE pl.id = ?`,
      )
      .get(id);

    return rowToLossEpisode(updated);
  });

  // 6. Delete Loss Episode
  app.delete<{ Params: { id: string } }>('/api/perinatal-loss/:id', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'user:manage') && !can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only doctors or administrators can delete perinatal loss records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing = ctx.db
      .prepare('SELECT id, patient_id FROM perinatal_loss_episodes WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Record not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM perinatal_loss_episodes WHERE id = ?').run(id);
      audit(ctx.db, {
        actorId: user.id,
        action: 'perinatal_loss.episode_delete',
        entity: 'perinatal_loss_episodes',
        entityId: id,
        detail: JSON.stringify({ patientId: existing.patient_id }),
      });
    });

    return { ok: true, deletedId: id };
  });

  // 7. Audit Print
  app.post<{ Params: { id: string } }>('/api/perinatal-loss/:id/audit-print', async (req, reply) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing = ctx.db
      .prepare('SELECT id, patient_id FROM perinatal_loss_episodes WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Record not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'perinatal_loss.episode_print',
      entity: 'perinatal_loss_episodes',
      entityId: id,
      detail: JSON.stringify({ patientId: existing.patient_id }),
    });

    return { ok: true };
  });
}
