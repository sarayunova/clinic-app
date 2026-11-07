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
  calculateMultipleGestation,
  type MultipleGestationInput,
  type MultipleGestationResult,
  type FetusAssessmentData,
} from '../../web/src/multipleGestationEngine.js';

function assertCanManageMultipleGestation(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage multiple gestation records');
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

export const fetusAssessmentSchema = z.object({
  label: z.string().min(1).max(50),
  presentation: z.enum(['cephalic', 'breech', 'transverse', 'oblique']),
  bpdMm: optNullableNumber(10, 150),
  hcMm: optNullableNumber(30, 400),
  acMm: optNullableNumber(30, 450),
  flMm: optNullableNumber(10, 120),
  efwG: z.number().min(50).max(6000),
  efwPercentile: optNullableNumber(0, 100),
  dvpCm: z.number().min(0).max(30),
  bladderVisualized: z.boolean().default(true),
  uaPi: optNullableNumber(0.1, 5.0),
  uaFlow: z
    .enum(['normal_positive', 'reduced', 'absent_aedf', 'reversed_redf', 'intermittent_absent_reversed'])
    .default('normal_positive'),
  mcaPi: optNullableNumber(0.1, 5.0),
  mcaPsvCmS: optNullableNumber(5, 200),
  mcaPsvMom: optNullableNumber(0.1, 5.0),
  dvAWave: z.enum(['positive', 'absent', 'reversed', 'not_performed']).default('positive'),
  hydropsPresent: z.boolean().default(false),
  demised: z.boolean().default(false),
});

export const mgCalculateSchema = z.object({
  plurality: z.enum(['twins', 'triplets']).default('twins'),
  chorionicity: z.enum(['dcda', 'mcda', 'mcma', 'tcta', 'dcta', 'mc']),
  amnionicity: z.enum(['diamniotic', 'monoamniotic', 'triamniotic']),
  gestationalAgeWeeks: z.number().int().min(14).max(42),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  fetuses: z.array(fetusAssessmentSchema).min(2).max(4),
  cordEntanglementNoted: z.boolean().default(false),
});

export const mgPregnancyProfileSchema = z.object({
  patientId: z.number().int().positive('Valid patient ID required'),
  plurality: z.enum(['twins', 'triplets']).default('twins'),
  chorionicity: z.enum(['dcda', 'mcda', 'mcma', 'tcta', 'dcta', 'mc']),
  amnionicity: z.enum(['diamniotic', 'monoamniotic', 'triamniotic']),
  firstTrimesterSign: z.enum(['lambda_sign', 't_sign', 'no_dividing_membrane']).nullable().optional(),
  dividingMembraneThicknessMm: optNullableNumber(0, 10),
  placentalConfiguration: z
    .enum(['two_separate', 'two_fused', 'single_anterior', 'single_posterior', 'single_fundal'])
    .nullable()
    .optional(),
  conceptionMethod: z.enum(['spontaneous', 'ivf_et', 'ovulation_induction']).default('spontaneous'),
  status: z.enum(['active', 'delivered', 'archived']).default('active'),
  diagnosisGestationWeeks: optNullableNumber(6, 40),
  baselineNotes: optNullableString(2000),
});

export const mgAssessmentSchema = mgCalculateSchema.extend({
  pregnancyId: z.number().int().positive('Valid pregnancy ID required'),
  patientId: z.number().int().positive('Valid patient ID required'),
  ultrasoundReportId: z.number().int().positive().nullable().optional(),
  assessmentDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  assessmentTime: z.string().max(10).nullable().optional(),
  clinicalNotes: optNullableString(2000),
  performedBy: optNullableString(120),
  reviewedBy: z.number().int().positive().optional(),
});

function rowToPregnancy(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    plurality: r.plurality,
    chorionicity: r.chorionicity,
    amnionicity: r.amnionicity,
    firstTrimesterSign: r.first_trimester_sign,
    dividingMembraneThicknessMm: r.dividing_membrane_thickness_mm,
    placentalConfiguration: r.placental_configuration,
    conceptionMethod: r.conception_method,
    status: r.status,
    diagnosisGestationWeeks: r.diagnosis_gestation_weeks,
    baselineNotes: r.baseline_notes,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToAssessment(r: any) {
  let fetuses: FetusAssessmentData[] = [];
  try {
    fetuses = JSON.parse(r.fetuses_json);
  } catch (e) {
    fetuses = [];
  }

  return {
    id: r.id,
    pregnancyId: r.pregnancy_id,
    patientId: r.patient_id,
    ultrasoundReportId: r.ultrasound_report_id,
    assessmentDate: r.assessment_date,
    assessmentTime: r.assessment_time,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    fetuses,

    efwDiscordancePercent: r.efw_discordance_percent,
    acDiscordancePercent: r.ac_discordance_percent,
    dvpDiscordanceCm: r.dvp_discordance_cm,
    discordanceSeverity: r.discordance_severity,
    largerFetusLabel: r.larger_fetus_label,
    smallerFetusLabel: r.smaller_fetus_label,

    tttsStage: r.ttts_stage,
    sfgrType: r.sfgr_type,
    tapsStage: r.taps_stage,
    cordEntanglementNoted: Boolean(r.cord_entanglement_noted),

    surveillanceIntervalRecommendation: r.surveillance_interval_recommendation,
    deliveryTimingRecommendation: r.delivery_timing_recommendation,
    deliveryModeRecommendation: r.delivery_mode_recommendation,
    corticosteroidsIndicated: Boolean(r.corticosteroids_indicated),
    actionPlan: r.action_plan,

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

export function registerMultipleGestationRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Live Calculation Preview
  app.post('/api/multiple-gestation/calculate', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = mgCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid multiple gestation calculation parameters', parsed.error.format());
    }

    const calcResult = calculateMultipleGestation({
      plurality: parsed.data.plurality,
      chorionicity: parsed.data.chorionicity,
      amnionicity: parsed.data.amnionicity,
      gestationalAgeWeeks: parsed.data.gestationalAgeWeeks,
      gestationalAgeDays: parsed.data.gestationalAgeDays,
      fetuses: parsed.data.fetuses as FetusAssessmentData[],
      cordEntanglementNoted: parsed.data.cordEntanglementNoted,
    });

    return calcResult;
  });

  // 2. Get Active or All Pregnancy Profiles for Patient
  app.get<{ Params: { patientId: string } }>(
    '/api/patients/:patientId/multiple-gestation/pregnancies',
    async (req, reply) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number.parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

      const rows = ctx.db
        .prepare(
          `SELECT * FROM multiple_gestation_pregnancies
           WHERE patient_id = ?
           ORDER BY status = 'active' DESC, created_at DESC`,
        )
        .all(patientId);

      return rows.map(rowToPregnancy);
    },
  );

  // 3. Create Pregnancy Profile
  app.post('/api/multiple-gestation/pregnancies', async (req: FastifyRequest, reply) => {
    const user = assertCanManageMultipleGestation(req);
    const parsed = mgPregnancyProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const now = nowIso();
    const insertedId = tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        INSERT INTO multiple_gestation_pregnancies (
          patient_id, plurality, chorionicity, amnionicity, first_trimester_sign,
          dividing_membrane_thickness_mm, placental_configuration, conception_method,
          status, diagnosis_gestation_weeks, baseline_notes,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `);

      const result = stmt.run(
        data.patientId,
        data.plurality,
        data.chorionicity,
        data.amnionicity,
        data.firstTrimesterSign ?? null,
        data.dividingMembraneThicknessMm ?? null,
        data.placentalConfiguration ?? null,
        data.conceptionMethod,
        data.status,
        data.diagnosisGestationWeeks ?? null,
        data.baselineNotes ?? null,
        user.id,
        user.id,
        now,
        now,
      );

      const newId = Number(result.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'multiple_gestation.profile_create',
        entity: 'multiple_gestation_pregnancies',
        entityId: newId,
        detail: JSON.stringify({
          patientId: data.patientId,
          plurality: data.plurality,
          chorionicity: data.chorionicity,
        }),
      });

      return newId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare('SELECT * FROM multiple_gestation_pregnancies WHERE id = ?')
      .get(insertedId);
    return rowToPregnancy(created);
  });

  // 4. Update Pregnancy Profile
  app.put<{ Params: { id: string } }>(
    '/api/multiple-gestation/pregnancies/:id',
    async (req, reply) => {
      const user = assertCanManageMultipleGestation(req);
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) throw badRequest('Invalid pregnancy ID');

      const existing = ctx.db
        .prepare('SELECT * FROM multiple_gestation_pregnancies WHERE id = ?')
        .get(id) as any;
      if (!existing) throw notFound('Pregnancy profile not found');

      const parsed = mgPregnancyProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest('Validation failed', parsed.error.format());
      }

      const data = parsed.data;
      const now = nowIso();

      tx(ctx.db, () => {
        ctx.db
          .prepare(`
            UPDATE multiple_gestation_pregnancies SET
              plurality = ?, chorionicity = ?, amnionicity = ?, first_trimester_sign = ?,
              dividing_membrane_thickness_mm = ?, placental_configuration = ?, conception_method = ?,
              status = ?, diagnosis_gestation_weeks = ?, baseline_notes = ?,
              updated_by = ?, updated_at = ?
            WHERE id = ?
          `)
          .run(
            data.plurality,
            data.chorionicity,
            data.amnionicity,
            data.firstTrimesterSign ?? null,
            data.dividingMembraneThicknessMm ?? null,
            data.placentalConfiguration ?? null,
            data.conceptionMethod,
            data.status,
            data.diagnosisGestationWeeks ?? null,
            data.baselineNotes ?? null,
            user.id,
            now,
            id,
          );

        audit(ctx.db, {
          actorId: user.id,
          action: 'multiple_gestation.profile_update',
          entity: 'multiple_gestation_pregnancies',
          entityId: id,
          detail: JSON.stringify({
            patientId: existing.patient_id,
            chorionicity: data.chorionicity,
            status: data.status,
          }),
        });
      });

      const updated = ctx.db
        .prepare('SELECT * FROM multiple_gestation_pregnancies WHERE id = ?')
        .get(id);
      return rowToPregnancy(updated);
    },
  );

  // 5. List Assessments for a Pregnancy Profile or Patient
  app.get<{ Params: { pregnancyId: string } }>(
    '/api/multiple-gestation/pregnancies/:pregnancyId/assessments',
    async (req, reply) => {
      requirePerm(req, 'patient:read_clinical');
      const pregnancyId = Number.parseInt(req.params.pregnancyId, 10);
      if (Number.isNaN(pregnancyId)) throw badRequest('Invalid pregnancy ID');

      const rows = ctx.db
        .prepare(
          `SELECT mga.*, u.full_name as reviewed_by_name
           FROM multiple_gestation_assessments mga
           LEFT JOIN users u ON u.id = mga.reviewed_by
           WHERE mga.pregnancy_id = ?
           ORDER BY mga.assessment_date DESC, mga.created_at DESC`,
        )
        .all(pregnancyId);

      return rows.map(rowToAssessment);
    },
  );

  // 6. Get Single Assessment
  app.get<{ Params: { id: string } }>('/api/multiple-gestation/assessments/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid assessment ID');

    const row = ctx.db
      .prepare(
        `SELECT mga.*, u.full_name as reviewed_by_name
         FROM multiple_gestation_assessments mga
         LEFT JOIN users u ON u.id = mga.reviewed_by
         WHERE mga.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('Assessment record not found');
    return rowToAssessment(row);
  });

  // 7. Create Assessment Record
  app.post('/api/multiple-gestation/assessments', async (req: FastifyRequest, reply) => {
    const user = assertCanManageMultipleGestation(req);
    const parsed = mgAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const pregnancy = ctx.db
      .prepare('SELECT * FROM multiple_gestation_pregnancies WHERE id = ?')
      .get(data.pregnancyId) as any;
    if (!pregnancy) throw notFound('Pregnancy profile not found');

    const calc = calculateMultipleGestation({
      plurality: data.plurality,
      chorionicity: data.chorionicity,
      amnionicity: data.amnionicity,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      gestationalAgeDays: data.gestationalAgeDays,
      fetuses: data.fetuses as FetusAssessmentData[],
      cordEntanglementNoted: data.cordEntanglementNoted,
    });

    const now = nowIso();
    const reviewedBy = data.reviewedBy || user.id;

    const insertedId = tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        INSERT INTO multiple_gestation_assessments (
          pregnancy_id, patient_id, ultrasound_report_id, assessment_date, assessment_time,
          gestational_age_weeks, gestational_age_days, fetuses_json,
          efw_discordance_percent, ac_discordance_percent, dvp_discordance_cm,
          discordance_severity, larger_fetus_label, smaller_fetus_label,
          ttts_stage, sfgr_type, taps_stage, cord_entanglement_noted,
          surveillance_interval_recommendation, delivery_timing_recommendation,
          delivery_mode_recommendation, corticosteroids_indicated, action_plan,
          clinical_notes, performed_by, reviewed_by, created_by, updated_by,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      const result = stmt.run(
        data.pregnancyId,
        data.patientId,
        data.ultrasoundReportId ?? null,
        data.assessmentDate,
        data.assessmentTime ?? null,
        data.gestationalAgeWeeks,
        data.gestationalAgeDays,
        JSON.stringify(data.fetuses),
        calc.efwDiscordancePercent,
        calc.acDiscordancePercent,
        calc.dvpDiscordanceCm,
        calc.discordanceSeverity,
        calc.largerFetusLabel,
        calc.smallerFetusLabel,
        calc.tttsStage,
        calc.sfgrType,
        calc.tapsStage,
        calc.cordEntanglementNoted ? 1 : 0,
        calc.surveillanceIntervalRecommendation,
        calc.deliveryTimingRecommendation,
        calc.deliveryModeRecommendation,
        calc.corticosteroidsIndicated ? 1 : 0,
        calc.actionPlan,
        data.clinicalNotes ?? null,
        data.performedBy ?? null,
        reviewedBy,
        user.id,
        user.id,
        now,
        now,
      );

      const newId = Number(result.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'multiple_gestation.assessment_create',
        entity: 'multiple_gestation_assessments',
        entityId: newId,
        detail: JSON.stringify({
          pregnancyId: data.pregnancyId,
          patientId: data.patientId,
          efwDiscordancePercent: calc.efwDiscordancePercent,
          tttsStage: calc.tttsStage,
          sfgrType: calc.sfgrType,
        }),
      });

      return newId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT mga.*, u.full_name as reviewed_by_name
         FROM multiple_gestation_assessments mga
         LEFT JOIN users u ON u.id = mga.reviewed_by
         WHERE mga.id = ?`,
      )
      .get(insertedId);

    return rowToAssessment(created);
  });

  // 8. Update Assessment Record
  app.put<{ Params: { id: string } }>('/api/multiple-gestation/assessments/:id', async (req, reply) => {
    const user = assertCanManageMultipleGestation(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid assessment ID');

    const existing = ctx.db
      .prepare('SELECT * FROM multiple_gestation_assessments WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Assessment record not found');

    const parsed = mgAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const calc = calculateMultipleGestation({
      plurality: data.plurality,
      chorionicity: data.chorionicity,
      amnionicity: data.amnionicity,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      gestationalAgeDays: data.gestationalAgeDays,
      fetuses: data.fetuses as FetusAssessmentData[],
      cordEntanglementNoted: data.cordEntanglementNoted,
    });

    const now = nowIso();
    const reviewedBy = data.reviewedBy || existing.reviewed_by;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE multiple_gestation_assessments SET
            pregnancy_id = ?, ultrasound_report_id = ?, assessment_date = ?, assessment_time = ?,
            gestational_age_weeks = ?, gestational_age_days = ?, fetuses_json = ?,
            efw_discordance_percent = ?, ac_discordance_percent = ?, dvp_discordance_cm = ?,
            discordance_severity = ?, larger_fetus_label = ?, smaller_fetus_label = ?,
            ttts_stage = ?, sfgr_type = ?, taps_stage = ?, cord_entanglement_noted = ?,
            surveillance_interval_recommendation = ?, delivery_timing_recommendation = ?,
            delivery_mode_recommendation = ?, corticosteroids_indicated = ?, action_plan = ?,
            clinical_notes = ?, performed_by = ?, reviewed_by = ?, updated_by = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          data.pregnancyId,
          data.ultrasoundReportId ?? null,
          data.assessmentDate,
          data.assessmentTime ?? null,
          data.gestationalAgeWeeks,
          data.gestationalAgeDays,
          JSON.stringify(data.fetuses),
          calc.efwDiscordancePercent,
          calc.acDiscordancePercent,
          calc.dvpDiscordanceCm,
          calc.discordanceSeverity,
          calc.largerFetusLabel,
          calc.smallerFetusLabel,
          calc.tttsStage,
          calc.sfgrType,
          calc.tapsStage,
          calc.cordEntanglementNoted ? 1 : 0,
          calc.surveillanceIntervalRecommendation,
          calc.deliveryTimingRecommendation,
          calc.deliveryModeRecommendation,
          calc.corticosteroidsIndicated ? 1 : 0,
          calc.actionPlan,
          data.clinicalNotes ?? null,
          data.performedBy ?? null,
          reviewedBy,
          user.id,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'multiple_gestation.assessment_update',
        entity: 'multiple_gestation_assessments',
        entityId: id,
        detail: JSON.stringify({
          pregnancyId: data.pregnancyId,
          efwDiscordancePercent: calc.efwDiscordancePercent,
          tttsStage: calc.tttsStage,
        }),
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT mga.*, u.full_name as reviewed_by_name
         FROM multiple_gestation_assessments mga
         LEFT JOIN users u ON u.id = mga.reviewed_by
         WHERE mga.id = ?`,
      )
      .get(id);

    return rowToAssessment(updated);
  });

  // 9. Delete Assessment Record
  app.delete<{ Params: { id: string } }>('/api/multiple-gestation/assessments/:id', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'user:manage') && !can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only doctors or administrators can delete multiple gestation assessments');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid assessment ID');

    const existing = ctx.db
      .prepare('SELECT id, pregnancy_id, patient_id FROM multiple_gestation_assessments WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Assessment record not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM multiple_gestation_assessments WHERE id = ?').run(id);
      audit(ctx.db, {
        actorId: user.id,
        action: 'multiple_gestation.assessment_delete',
        entity: 'multiple_gestation_assessments',
        entityId: id,
        detail: JSON.stringify({ pregnancyId: existing.pregnancy_id, patientId: existing.patient_id }),
      });
    });

    return { ok: true, deletedId: id };
  });

  // 10. Audit Print Event
  app.post<{ Params: { id: string } }>('/api/multiple-gestation/assessments/:id/audit-print', async (req, reply) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid assessment ID');

    const existing = ctx.db
      .prepare('SELECT id, patient_id, pregnancy_id FROM multiple_gestation_assessments WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Assessment record not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'multiple_gestation.assessment_print',
      entity: 'multiple_gestation_assessments',
      entityId: id,
      detail: JSON.stringify({ patientId: existing.patient_id, pregnancyId: existing.pregnancy_id }),
    });

    return { ok: true };
  });
}
