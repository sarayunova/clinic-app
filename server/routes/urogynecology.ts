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
  calculatePopqStage,
  type PopqGridInput,
  type PopqCalculationResult,
} from '../../web/src/urogynecologyEngine.js';

function assertCanManageUrogyn(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage urogynecology and POP-Q records');
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

export const popqCalculateSchema = z.object({
  aa: z.number().min(-3).max(3),
  ba: z.number().min(-3).max(20),
  c: z.number().min(-20).max(20),
  gh: z.number().min(0.5).max(15),
  pb: z.number().min(0.5).max(15),
  tvl: z.number().min(2).max(20),
  ap: z.number().min(-3).max(3),
  bp: z.number().min(-3).max(20),
  d: z.number().min(-20).max(20).nullable().optional(),
});

export const urogynEpisodeSchema = z.object({
  patientId: z.number().int().positive(),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDate: z.string().regex(dateRegex, 'Assessment date must be YYYY-MM-DD'),
  parity: optNullableString(50),
  menopausalStatus: z.enum(['premenopausal', 'perimenopausal', 'postmenopausal']),

  // 9-point POP-Q grid
  popqAaCm: z.number().min(-3).max(3),
  popqBaCm: z.number().min(-3).max(20),
  popqCCm: z.number().min(-20).max(20),
  popqGhCm: z.number().min(0.5).max(15),
  popqPbCm: z.number().min(0.5).max(15),
  popqTvlCm: z.number().min(2).max(20),
  popqApCm: z.number().min(-3).max(3),
  popqBpCm: z.number().min(-3).max(20),
  popqDCm: z.number().min(-20).max(20).nullable().optional(),

  // Urinary Incontinence & Bladder Diary
  urinaryIncontinenceType: z.enum(['none', 'stress_sui', 'urge_uui', 'mixed_mui', 'overflow']).default('none'),
  padCountPerDay: z.number().int().min(0).max(50).default(0),
  bladderDiaryDayFrequency: optNullableNumber(0, 100),
  bladderDiaryNocturia: optNullableNumber(0, 50),
  leakEpisodes24h: optNullableNumber(0, 100),
  botherScoreIciqSf: optNullableNumber(0, 21),

  // Management Pathway
  pessaryManagement: z.enum(['none', 'fitted_ring', 'fitted_gellhorn', 'fitted_cube', 'pessary_declined', 'pessary_failed']).default('none'),
  pessarySizeMm: optNullableNumber(30, 120),
  pessaryChangeIntervalWeeks: optNullableNumber(1, 52),
  pelvicFloorPhysiotherapy: z.boolean().default(false),
  surgicalProcedurePlanned: optNullableString(500),
  clinicalNotes: optNullableString(2000),

  performedBy: optNullableString(150),
  reviewedBy: z.number().int().positive().optional(),
});

function rowToUrogyn(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    assessmentDate: r.assessment_date,
    parity: r.parity,
    menopausalStatus: r.menopausal_status,

    popqAaCm: r.popq_aa_cm,
    popqBaCm: r.popq_ba_cm,
    popqCCm: r.popq_c_cm,
    popqGhCm: r.popq_gh_cm,
    popqPbCm: r.popq_pb_cm,
    popqTvlCm: r.popq_tvl_cm,
    popqApCm: r.popq_ap_cm,
    popqBpCm: r.popq_bp_cm,
    popqDCm: r.popq_d_cm,

    popqStage: r.popq_stage,
    leadingCompartment: r.leading_compartment,
    leadingEdgeDistanceCm: r.leading_edge_distance_cm,

    urinaryIncontinenceType: r.urinary_incontinence_type,
    padCountPerDay: r.pad_count_per_day,
    bladderDiaryDayFrequency: r.bladder_diary_day_frequency,
    bladderDiaryNocturia: r.bladder_diary_nocturia,
    leakEpisodes24h: r.leak_episodes_24h,
    botherScoreIciqSf: r.bother_score_iciq_sf,

    pessaryManagement: r.pessary_management,
    pessarySizeMm: r.pessary_size_mm,
    pessaryChangeIntervalWeeks: r.pessary_change_interval_weeks,
    pelvicFloorPhysiotherapy: Boolean(r.pelvic_floor_physiotherapy),
    surgicalProcedurePlanned: r.surgical_procedure_planned,
    clinicalNotes: r.clinical_notes,

    performedBy: r.performed_by,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerUrogynecologyRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Live POP-Q Calculation
  app.post('/api/urogynecology/calculate-popq', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = popqCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;
    const grid: PopqGridInput = {
      aa: d.aa,
      ba: d.ba,
      c: d.c,
      gh: d.gh,
      pb: d.pb,
      tvl: d.tvl,
      ap: d.ap,
      bp: d.bp,
      d: d.d ?? null,
    };
    return calculatePopqStage(grid);
  });

  // 2. List episodes for a patient
  app.get<{ Params: { patientId: string } }>('/api/patients/:patientId/urogynecology', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const rows = ctx.db
      .prepare(
        `SELECT u.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM urogynecology_episodes u
         LEFT JOIN users rev ON rev.id = u.reviewed_by
         LEFT JOIN users c ON c.id = u.created_by
         WHERE u.patient_id = ?
         ORDER BY u.assessment_date DESC, u.id DESC`,
      )
      .all(patientId);

    return rows.map(rowToUrogyn);
  });

  // 3. Get episode by ID
  app.get<{ Params: { id: string } }>('/api/urogynecology/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const row = ctx.db
      .prepare(
        `SELECT u.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM urogynecology_episodes u
         LEFT JOIN users rev ON rev.id = u.reviewed_by
         LEFT JOIN users c ON c.id = u.created_by
         WHERE u.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('Urogynecology assessment not found');
    return rowToUrogyn(row);
  });

  // 4. Create episode
  app.post('/api/urogynecology', async (req, reply) => {
    const user = assertCanManageUrogyn(req);
    const parsed = urogynEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const d = parsed.data;
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(d.patientId);
    if (!patient) throw notFound('Patient not found');

    if (d.admissionId) {
      const admission = ctx.db
        .prepare('SELECT id FROM admissions WHERE id = ? AND patient_id = ?')
        .get(d.admissionId, d.patientId);
      if (!admission) throw badRequest('Admission does not belong to this patient');
    }

    const grid: PopqGridInput = {
      aa: d.popqAaCm,
      ba: d.popqBaCm,
      c: d.popqCCm,
      gh: d.popqGhCm,
      pb: d.popqPbCm,
      tvl: d.popqTvlCm,
      ap: d.popqApCm,
      bp: d.popqBpCm,
      d: d.popqDCm ?? null,
    };
    const calc = calculatePopqStage(grid);

    const reviewedBy = d.reviewedBy ?? user.id;
    const reviewer = ctx.db.prepare('SELECT id FROM users WHERE id = ?').get(reviewedBy);
    if (!reviewer) throw badRequest('Reviewing clinician does not exist');

    const now = nowIso();

    const insertSql = `
      INSERT INTO urogynecology_episodes (
        patient_id, admission_id, assessment_date, parity, menopausal_status,
        popq_aa_cm, popq_ba_cm, popq_c_cm, popq_gh_cm, popq_pb_cm, popq_tvl_cm,
        popq_ap_cm, popq_bp_cm, popq_d_cm,
        popq_stage, leading_compartment, leading_edge_distance_cm,
        urinary_incontinence_type, pad_count_per_day,
        bladder_diary_day_frequency, bladder_diary_nocturia, leak_episodes_24h,
        bother_score_iciq_sf, pessary_management, pessary_size_mm,
        pessary_change_interval_weeks, pelvic_floor_physiotherapy,
        surgical_procedure_planned, clinical_notes,
        performed_by, reviewed_by, created_by, updated_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `;

    const newId = tx(ctx.db, () => {
      const res = ctx.db
        .prepare(insertSql)
        .run(
          d.patientId,
          d.admissionId ?? null,
          d.assessmentDate,
          d.parity ?? null,
          d.menopausalStatus,
          d.popqAaCm,
          d.popqBaCm,
          d.popqCCm,
          d.popqGhCm,
          d.popqPbCm,
          d.popqTvlCm,
          d.popqApCm,
          d.popqBpCm,
          d.popqDCm ?? null,
          calc.stage,
          calc.leadingCompartment,
          calc.leadingEdgeDistanceCm,
          d.urinaryIncontinenceType,
          d.padCountPerDay,
          d.bladderDiaryDayFrequency ?? null,
          d.bladderDiaryNocturia ?? null,
          d.leakEpisodes24h ?? null,
          d.botherScoreIciqSf ?? null,
          d.pessaryManagement,
          d.pessarySizeMm ?? null,
          d.pessaryChangeIntervalWeeks ?? null,
          d.pelvicFloorPhysiotherapy ? 1 : 0,
          d.surgicalProcedurePlanned ?? null,
          d.clinicalNotes ?? null,
          d.performedBy ?? null,
          reviewedBy,
          user.id,
          user.id,
          now,
          now,
        );

      const recordId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'urogynecology.assessment_create',
        entity: 'urogynecology_episodes',
        entityId: recordId,
        detail: {
          patientId: d.patientId,
          episodeId: recordId,
          assessmentDate: d.assessmentDate,
          popqStage: calc.stage,
          leadingCompartment: calc.leadingCompartment,
          leadingEdgeDistanceCm: calc.leadingEdgeDistanceCm,
          urinaryIncontinenceType: d.urinaryIncontinenceType,
          pessaryManagement: d.pessaryManagement,
        },
      });

      return recordId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT u.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM urogynecology_episodes u
         LEFT JOIN users rev ON rev.id = u.reviewed_by
         LEFT JOIN users c ON c.id = u.created_by
         WHERE u.id = ?`,
      )
      .get(newId);

    return rowToUrogyn(created);
  });

  // 5. Update episode
  app.put<{ Params: { id: string } }>('/api/urogynecology/:id', async (req) => {
    const user = assertCanManageUrogyn(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing: any = ctx.db.prepare('SELECT * FROM urogynecology_episodes WHERE id = ?').get(id);
    if (!existing) throw notFound('Urogynecology assessment not found');

    const parsed = urogynEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const d = parsed.data;
    if (d.patientId !== existing.patient_id) {
      throw badRequest('Patient ID cannot be changed');
    }

    if (d.admissionId) {
      const admission = ctx.db
        .prepare('SELECT id FROM admissions WHERE id = ? AND patient_id = ?')
        .get(d.admissionId, d.patientId);
      if (!admission) throw badRequest('Admission does not belong to this patient');
    }

    const grid: PopqGridInput = {
      aa: d.popqAaCm,
      ba: d.popqBaCm,
      c: d.popqCCm,
      gh: d.popqGhCm,
      pb: d.popqPbCm,
      tvl: d.popqTvlCm,
      ap: d.popqApCm,
      bp: d.popqBpCm,
      d: d.popqDCm ?? null,
    };
    const calc = calculatePopqStage(grid);

    const reviewedBy = d.reviewedBy ?? existing.reviewed_by;
    const reviewer = ctx.db.prepare('SELECT id FROM users WHERE id = ?').get(reviewedBy);
    if (!reviewer) throw badRequest('Reviewing clinician does not exist');

    const now = nowIso();

    const updateSql = `
      UPDATE urogynecology_episodes SET
        admission_id = ?,
        assessment_date = ?,
        parity = ?,
        menopausal_status = ?,
        popq_aa_cm = ?,
        popq_ba_cm = ?,
        popq_c_cm = ?,
        popq_gh_cm = ?,
        popq_pb_cm = ?,
        popq_tvl_cm = ?,
        popq_ap_cm = ?,
        popq_bp_cm = ?,
        popq_d_cm = ?,
        popq_stage = ?,
        leading_compartment = ?,
        leading_edge_distance_cm = ?,
        urinary_incontinence_type = ?,
        pad_count_per_day = ?,
        bladder_diary_day_frequency = ?,
        bladder_diary_nocturia = ?,
        leak_episodes_24h = ?,
        bother_score_iciq_sf = ?,
        pessary_management = ?,
        pessary_size_mm = ?,
        pessary_change_interval_weeks = ?,
        pelvic_floor_physiotherapy = ?,
        surgical_procedure_planned = ?,
        clinical_notes = ?,
        performed_by = ?,
        reviewed_by = ?,
        updated_by = ?,
        updated_at = ?
      WHERE id = ?
    `;

    tx(ctx.db, () => {
      ctx.db
        .prepare(updateSql)
        .run(
          d.admissionId ?? null,
          d.assessmentDate,
          d.parity ?? null,
          d.menopausalStatus,
          d.popqAaCm,
          d.popqBaCm,
          d.popqCCm,
          d.popqGhCm,
          d.popqPbCm,
          d.popqTvlCm,
          d.popqApCm,
          d.popqBpCm,
          d.popqDCm ?? null,
          calc.stage,
          calc.leadingCompartment,
          calc.leadingEdgeDistanceCm,
          d.urinaryIncontinenceType,
          d.padCountPerDay,
          d.bladderDiaryDayFrequency ?? null,
          d.bladderDiaryNocturia ?? null,
          d.leakEpisodes24h ?? null,
          d.botherScoreIciqSf ?? null,
          d.pessaryManagement,
          d.pessarySizeMm ?? null,
          d.pessaryChangeIntervalWeeks ?? null,
          d.pelvicFloorPhysiotherapy ? 1 : 0,
          d.surgicalProcedurePlanned ?? null,
          d.clinicalNotes ?? null,
          d.performedBy ?? null,
          reviewedBy,
          user.id,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'urogynecology.assessment_update',
        entity: 'urogynecology_episodes',
        entityId: id,
        detail: {
          patientId: d.patientId,
          episodeId: id,
          assessmentDate: d.assessmentDate,
          popqStage: calc.stage,
          leadingCompartment: calc.leadingCompartment,
          pessaryManagement: d.pessaryManagement,
        },
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT u.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM urogynecology_episodes u
         LEFT JOIN users rev ON rev.id = u.reviewed_by
         LEFT JOIN users c ON c.id = u.created_by
         WHERE u.id = ?`,
      )
      .get(id);

    return rowToUrogyn(updated);
  });

  // 6. Delete episode
  app.delete<{ Params: { id: string } }>('/api/urogynecology/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only senior medical staff can delete urogynecology records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing: any = ctx.db.prepare('SELECT * FROM urogynecology_episodes WHERE id = ?').get(id);
    if (!existing) throw notFound('Urogynecology assessment not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM urogynecology_episodes WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'urogynecology.assessment_delete',
        entity: 'urogynecology_episodes',
        entityId: id,
        detail: {
          patientId: existing.patient_id,
          episodeId: id,
          assessmentDate: existing.assessment_date,
          popqStage: existing.popq_stage,
        },
      });
    });

    return { ok: true, deletedId: id };
  });

  // 7. Audit print
  app.post<{ Params: { id: string } }>('/api/urogynecology/:id/audit-print', async (req) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const row: any = ctx.db.prepare('SELECT * FROM urogynecology_episodes WHERE id = ?').get(id);
    if (!row) throw notFound('Urogynecology assessment not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'urogynecology.assessment_print',
      entity: 'urogynecology_episodes',
      entityId: id,
      detail: {
        patientId: row.patient_id,
        episodeId: id,
        assessmentDate: row.assessment_date,
        popqStage: row.popq_stage,
      },
    });

    return { ok: true };
  });
}
