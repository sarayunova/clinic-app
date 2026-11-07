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
  calculateLaborInduction,
  type BishopScoreInput,
  type InductionRecommendationResult,
} from '../../web/src/inductionEngine.js';

function assertCanManageInduction(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can record labor induction');
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

export const bishopScoreSchema = z.object({
  dilationCm: z.number().min(0).max(10),
  effacementPercent: z.number().int().min(0).max(100),
  fetalStation: z.number().int().min(-3).max(3),
  consistency: z.enum(['firm', 'medium', 'soft']),
  position: z.enum(['posterior', 'mid', 'anterior']),
  previousCesarean: z.boolean().default(false),
  gestationalAgeWeeks: z.number().int().min(24).max(44).optional(),
  parity: z.enum(['nulliparous', 'multiparous']).default('nulliparous'),
});

export const inductionEpisodeSchema = bishopScoreSchema.extend({
  patientId: z.number().int().positive('Valid patient ID required'),
  admissionId: z.number().int().positive().nullable().optional(),
  initiationDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  initiationTime: z.string().max(10).nullable().optional(),
  gestationalAgeWeeks: z.number().int().min(24).max(44),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  indication: z.enum([
    'post_dates',
    'preeclampsia_gest_htn',
    'prom_rom',
    'oligohydramnios',
    'fgr_placental',
    'gdm_diabetes',
    'maternal_medical',
    'elective_39w',
    'other',
  ]),
  indicationDetails: optNullableString(1000),
  previousCesareanCount: z.number().int().min(0).max(5).default(0),
  ripeningMethod: z.enum([
    'foley_bulb_mechanical',
    'cook_double_balloon',
    'dinoprostone_pge2_tape',
    'dinoprostone_pge2_gel',
    'misoprostol_pge1_oral',
    'misoprostol_pge1_vaginal',
    'direct_arm_oxytocin',
    'none',
  ]),
  ripeningDoseDetails: optNullableString(500),
  contraindicationsChecked: z.boolean().default(true),

  oxytocinUsed: z.boolean().default(false),
  oxytocinStartTime: optNullableString(20),
  oxytocinStartRateMUPerMin: optNullableNumber(0.1, 40),
  oxytocinMaxRateMUPerMin: optNullableNumber(0.1, 40),
  armPerformed: z.boolean().default(false),
  armTime: optNullableString(20),
  liquorStatus: z
    .enum(['clear', 'meconium_grade_1', 'meconium_grade_2', 'meconium_grade_3', 'blood_stained'])
    .nullable()
    .optional(),

  serialBishopJson: optNullableString(10000),

  tachysystoleDetected: z.boolean().default(false),
  uterineHyperstimulationAction: optNullableString(500),
  inductionOutcome: z
    .enum([
      'in_progress',
      'vaginal_delivery',
      'emergency_cesarean_fetal_distress',
      'emergency_cesarean_failed_induction',
      'emergency_cesarean_arrest',
      'assisted_vacuum_forceps',
    ])
    .default('in_progress'),
  inductionToDeliveryHours: optNullableNumber(0.1, 100),
  clinicalNotes: optNullableString(2000),
  performedBy: optNullableString(120),
  reviewedBy: z.number().int().positive().optional(),
});

function rowToInduction(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    initiationDate: r.initiation_date,
    initiationTime: r.initiation_time,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    indication: r.indication,
    indicationDetails: r.indication_details,
    parity: r.parity,
    previousCesarean: Boolean(r.previous_cesarean),
    previousCesareanCount: r.previous_cesarean_count,

    dilationCm: r.dilation_cm,
    effacementPercent: r.effacement_percent,
    fetalStation: r.fetal_station,
    consistency: r.consistency,
    position: r.position,
    bishopScoreTotal: r.bishop_score_total,
    cervicalFavorability: r.cervical_favorability,

    ripeningMethod: r.ripening_method,
    ripeningDoseDetails: r.ripening_dose_details,
    contraindicationsChecked: Boolean(r.contraindications_checked),

    oxytocinUsed: Boolean(r.oxytocin_used),
    oxytocinStartTime: r.oxytocin_start_time,
    oxytocinStartRateMUPerMin: r.oxytocin_start_rate_m_u_min,
    oxytocinMaxRateMUPerMin: r.oxytocin_max_rate_m_u_min,
    armPerformed: Boolean(r.arm_performed),
    armTime: r.arm_time,
    liquorStatus: r.liquor_status,

    serialBishopJson: r.serial_bishop_json,

    tachysystoleDetected: Boolean(r.tachysystole_detected),
    uterineHyperstimulationAction: r.uterine_hyperstimulation_action,
    inductionOutcome: r.induction_outcome,
    inductionToDeliveryHours: r.induction_to_delivery_hours,
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

export function registerInductionRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Calculate Modified Bishop Score & Ripening Advice Preview
  app.post('/api/induction/calculate', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = bishopScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid Bishop Score parameters', parsed.error.format());
    }

    const calcResult = calculateLaborInduction({
      dilationCm: parsed.data.dilationCm,
      effacementPercent: parsed.data.effacementPercent,
      fetalStation: parsed.data.fetalStation,
      consistency: parsed.data.consistency,
      position: parsed.data.position,
      previousCesarean: parsed.data.previousCesarean,
      gestationalAgeWeeks: parsed.data.gestationalAgeWeeks,
      parity: parsed.data.parity,
    });

    return calcResult;
  });

  // 2. List Patient Induction Episodes
  app.get<{ Params: { patientId: string } }>(
    '/api/patients/:patientId/induction',
    async (req, reply) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number.parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

      const rows = ctx.db
        .prepare(
          `SELECT ind.*, u.full_name as reviewed_by_name
           FROM labor_induction_episodes ind
           LEFT JOIN users u ON u.id = ind.reviewed_by
           WHERE ind.patient_id = ?
           ORDER BY ind.initiation_date DESC, ind.created_at DESC`,
        )
        .all(patientId);

      return rows.map(rowToInduction);
    },
  );

  // 3. Get Single Induction Episode
  app.get<{ Params: { id: string } }>('/api/induction/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid induction ID');

    const row = ctx.db
      .prepare(
        `SELECT ind.*, u.full_name as reviewed_by_name
         FROM labor_induction_episodes ind
         LEFT JOIN users u ON u.id = ind.reviewed_by
         WHERE ind.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('Induction episode not found');
    return rowToInduction(row);
  });

  // 4. Create Induction Episode
  app.post('/api/induction', async (req: FastifyRequest, reply) => {
    const user = assertCanManageInduction(req);
    const parsed = inductionEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const calc = calculateLaborInduction({
      dilationCm: data.dilationCm,
      effacementPercent: data.effacementPercent,
      fetalStation: data.fetalStation,
      consistency: data.consistency,
      position: data.position,
      previousCesarean: data.previousCesarean,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      parity: data.parity,
    });

    const now = nowIso();
    const reviewedBy = data.reviewedBy || user.id;

    const insertedId = tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        INSERT INTO labor_induction_episodes (
          patient_id, admission_id, initiation_date, initiation_time,
          gestational_age_weeks, gestational_age_days, indication, indication_details,
          parity, previous_cesarean, previous_cesarean_count,
          dilation_cm, effacement_percent, fetal_station, consistency, position,
          bishop_score_total, cervical_favorability,
          ripening_method, ripening_dose_details, contraindications_checked,
          oxytocin_used, oxytocin_start_time, oxytocin_start_rate_m_u_min, oxytocin_max_rate_m_u_min,
          arm_performed, arm_time, liquor_status, serial_bishop_json,
          tachysystole_detected, uterine_hyperstimulation_action, induction_outcome,
          induction_to_delivery_hours, clinical_notes, performed_by, reviewed_by,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `);

      const result = stmt.run(
        data.patientId,
        data.admissionId ?? null,
        data.initiationDate,
        data.initiationTime ?? null,
        data.gestationalAgeWeeks,
        data.gestationalAgeDays,
        data.indication,
        data.indicationDetails ?? null,
        data.parity,
        data.previousCesarean ? 1 : 0,
        data.previousCesareanCount,
        data.dilationCm,
        data.effacementPercent,
        data.fetalStation,
        data.consistency,
        data.position,
        calc.totalScore,
        calc.favorability,
        data.ripeningMethod,
        data.ripeningDoseDetails ?? null,
        data.contraindicationsChecked ? 1 : 0,
        data.oxytocinUsed ? 1 : 0,
        data.oxytocinStartTime ?? null,
        data.oxytocinStartRateMUPerMin ?? null,
        data.oxytocinMaxRateMUPerMin ?? null,
        data.armPerformed ? 1 : 0,
        data.armTime ?? null,
        data.liquorStatus ?? null,
        data.serialBishopJson ?? '[]',
        data.tachysystoleDetected ? 1 : 0,
        data.uterineHyperstimulationAction ?? null,
        data.inductionOutcome,
        data.inductionToDeliveryHours ?? null,
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
        action: 'induction.episode_create',
        entity: 'labor_induction_episodes',
        entityId: newId,
        detail: JSON.stringify({
          patientId: data.patientId,
          bishopScore: calc.totalScore,
          favorability: calc.favorability,
          ripeningMethod: data.ripeningMethod,
        }),
      });

      return newId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT ind.*, u.full_name as reviewed_by_name
         FROM labor_induction_episodes ind
         LEFT JOIN users u ON u.id = ind.reviewed_by
         WHERE ind.id = ?`,
      )
      .get(insertedId);

    return rowToInduction(created);
  });

  // 5. Update Induction Episode
  app.put<{ Params: { id: string } }>('/api/induction/:id', async (req, reply) => {
    const user = assertCanManageInduction(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid induction ID');

    const existing = ctx.db
      .prepare('SELECT * FROM labor_induction_episodes WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Induction episode not found');

    const parsed = inductionEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const calc = calculateLaborInduction({
      dilationCm: data.dilationCm,
      effacementPercent: data.effacementPercent,
      fetalStation: data.fetalStation,
      consistency: data.consistency,
      position: data.position,
      previousCesarean: data.previousCesarean,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      parity: data.parity,
    });

    const now = nowIso();
    const reviewedBy = data.reviewedBy || existing.reviewed_by;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE labor_induction_episodes SET
            admission_id = ?, initiation_date = ?, initiation_time = ?,
            gestational_age_weeks = ?, gestational_age_days = ?, indication = ?, indication_details = ?,
            parity = ?, previous_cesarean = ?, previous_cesarean_count = ?,
            dilation_cm = ?, effacement_percent = ?, fetal_station = ?, consistency = ?, position = ?,
            bishop_score_total = ?, cervical_favorability = ?,
            ripening_method = ?, ripening_dose_details = ?, contraindications_checked = ?,
            oxytocin_used = ?, oxytocin_start_time = ?, oxytocin_start_rate_m_u_min = ?, oxytocin_max_rate_m_u_min = ?,
            arm_performed = ?, arm_time = ?, liquor_status = ?, serial_bishop_json = ?,
            tachysystole_detected = ?, uterine_hyperstimulation_action = ?, induction_outcome = ?,
            induction_to_delivery_hours = ?, clinical_notes = ?, performed_by = ?, reviewed_by = ?,
            updated_by = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          data.admissionId ?? null,
          data.initiationDate,
          data.initiationTime ?? null,
          data.gestationalAgeWeeks,
          data.gestationalAgeDays,
          data.indication,
          data.indicationDetails ?? null,
          data.parity,
          data.previousCesarean ? 1 : 0,
          data.previousCesareanCount,
          data.dilationCm,
          data.effacementPercent,
          data.fetalStation,
          data.consistency,
          data.position,
          calc.totalScore,
          calc.favorability,
          data.ripeningMethod,
          data.ripeningDoseDetails ?? null,
          data.contraindicationsChecked ? 1 : 0,
          data.oxytocinUsed ? 1 : 0,
          data.oxytocinStartTime ?? null,
          data.oxytocinStartRateMUPerMin ?? null,
          data.oxytocinMaxRateMUPerMin ?? null,
          data.armPerformed ? 1 : 0,
          data.armTime ?? null,
          data.liquorStatus ?? null,
          data.serialBishopJson ?? '[]',
          data.tachysystoleDetected ? 1 : 0,
          data.uterineHyperstimulationAction ?? null,
          data.inductionOutcome,
          data.inductionToDeliveryHours ?? null,
          data.clinicalNotes ?? null,
          data.performedBy ?? null,
          reviewedBy,
          user.id,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'induction.episode_update',
        entity: 'labor_induction_episodes',
        entityId: id,
        detail: JSON.stringify({
          patientId: existing.patient_id,
          outcome: data.inductionOutcome,
        }),
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT ind.*, u.full_name as reviewed_by_name
         FROM labor_induction_episodes ind
         LEFT JOIN users u ON u.id = ind.reviewed_by
         WHERE ind.id = ?`,
      )
      .get(id);

    return rowToInduction(updated);
  });

  // 6. Delete Induction Episode
  app.delete<{ Params: { id: string } }>('/api/induction/:id', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'user:manage') && !can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only doctors or administrators can delete labor induction records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid induction ID');

    const existing = ctx.db
      .prepare('SELECT id, patient_id FROM labor_induction_episodes WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Induction episode not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM labor_induction_episodes WHERE id = ?').run(id);
      audit(ctx.db, {
        actorId: user.id,
        action: 'induction.episode_delete',
        entity: 'labor_induction_episodes',
        entityId: id,
        detail: JSON.stringify({ patientId: existing.patient_id }),
      });
    });

    return { ok: true, deletedId: id };
  });

  // 7. Audit Print
  app.post<{ Params: { id: string } }>('/api/induction/:id/audit-print', async (req, reply) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid induction ID');

    const existing = ctx.db
      .prepare('SELECT id, patient_id FROM labor_induction_episodes WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Induction episode not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'induction.episode_print',
      entity: 'labor_induction_episodes',
      entityId: id,
      detail: JSON.stringify({ patientId: existing.patient_id }),
    });

    return { ok: true };
  });
}
