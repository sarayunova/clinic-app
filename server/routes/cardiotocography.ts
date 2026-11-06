import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import {
  evaluateCtgParams,
  generateSyntheticCtgTrace,
  type FhrVariabilityCategory,
  type DecelerationType,
} from '../../web/src/ctgEngine.js';

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

export const createCtgEpisodeSchema = z
  .object({
    admissionId: z.number().int().positive().nullable().optional(),
    testType: z
      .enum(['antenatal_nst', 'intrapartum_continuous', 'intrapartum_intermittent', 'oxytocin_challenge_test'])
      .default('antenatal_nst'),
    performedAt: z.string().min(1, 'Performance datetime is required'),
    gestationalAgeWeeks: optNullableNumber(20, 44),
    indication: optNullableString(500),
    durationMinutes: z.number().int().min(10).max(180).default(20),
    paperSpeedCmMin: z.number().min(0.5).max(5).default(1.0),
    baselineFhrBpm: z.number().int().min(50).max(220),
    variabilityCategory: z.enum(['absent', 'minimal', 'moderate', 'marked', 'sinusoidal']),
    variabilityAmplitudeBpm: optNullableNumber(0, 50),
    accelerationsCount: z.number().int().min(0).max(50).default(0),
    accelerationsCriteria: z.enum(['15x15', '10x10']).default('15x15'),
    decelerationsType: z
      .enum(['none', 'early', 'variable_uncomplicated', 'variable_complicated', 'late', 'prolonged'])
      .default('none'),
    decelerationsRecurrent: z.boolean().default(false),
    decelerationsDetails: optNullableString(500),
    uterineContractionsPer10min: z.number().min(0).max(15).default(0),
    fetalMovementFelt: z.boolean().default(true),
    vibroacousticStimulationDone: z.boolean().default(false),
    vasResponse: optNullableString(500),
    resuscitationMeasures: z.array(z.string()).optional(),
    clinicalActionPlan: optNullableString(1000),
    recommendedFollowUp: optNullableString(500),
    notes: optNullableString(1000),
  })
  .strict();

export const patchCtgEpisodeSchema = z
  .object({
    clinicalActionPlan: optNullableString(1000),
    recommendedFollowUp: optNullableString(500),
    resuscitationMeasures: z.array(z.string()).optional(),
    notes: optNullableString(1000),
  })
  .strict();

function assertPatientExists(ctx: Ctx, patientId: number) {
  const row = ctx.db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId) as
    | { id: number; full_name: string }
    | undefined;
  if (!row) throw notFound('Patient not found');
  return row;
}

export function registerCardiotocographyRoutes(app: FastifyInstance, ctx: Ctx) {
  // GET /api/patients/:id/ctg/episodes
  app.get('/api/patients/:id/ctg/episodes', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const episodes = ctx.db
      .prepare(
        `SELECT e.*, u.full_name as performed_by_name, uu.full_name as reviewed_by_name
         FROM ctg_episodes e
         LEFT JOIN users u ON e.performed_by = u.id
         LEFT JOIN users uu ON e.reviewed_by = uu.id
         WHERE e.patient_id = ?
         ORDER BY e.performed_at DESC, e.id DESC`,
      )
      .all(patientId);

    return { episodes };
  });

  // POST /api/patients/:id/ctg/episodes
  app.post('/api/patients/:id/ctg/episodes', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const parseResult = createCtgEpisodeSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    // Automatic clinical calculation
    const evalResult = evaluateCtgParams({
      gestationalAgeWeeks: b.gestationalAgeWeeks,
      durationMinutes: b.durationMinutes,
      baselineFhrBpm: b.baselineFhrBpm,
      variabilityCategory: b.variabilityCategory as FhrVariabilityCategory,
      variabilityAmplitudeBpm: b.variabilityAmplitudeBpm,
      accelerationsCount: b.accelerationsCount,
      accelerationsCriteria: b.accelerationsCriteria,
      decelerationsType: b.decelerationsType as DecelerationType,
      decelerationsRecurrent: b.decelerationsRecurrent,
      uterineContractionsPer10min: b.uterineContractionsPer10min,
      fetalMovementFelt: b.fetalMovementFelt,
    });

    // Generate high-fidelity trace points for SVG rendering
    const tracePoints = generateSyntheticCtgTrace(
      b.baselineFhrBpm,
      b.variabilityCategory as FhrVariabilityCategory,
      b.durationMinutes,
      b.accelerationsCount,
      b.decelerationsType as DecelerationType,
      b.uterineContractionsPer10min,
    );

    const now = nowIso();
    const resuscitationJson = b.resuscitationMeasures ? JSON.stringify(b.resuscitationMeasures) : null;
    const traceJson = JSON.stringify(tracePoints);

    const res = ctx.db
      .prepare(
        `INSERT INTO ctg_episodes (
          patient_id, admission_id, test_type, performed_at, gestational_age_weeks,
          indication, duration_minutes, paper_speed_cm_min, baseline_fhr_bpm,
          variability_category, variability_amplitude_bpm, accelerations_count,
          accelerations_criteria, decelerations_type, decelerations_recurrent,
          decelerations_details, uterine_contractions_per_10min, tachysystole_present,
          fetal_movement_felt, vibroacoustic_stimulation_done, vas_response,
          nst_classification, figo_classification, nichd_category,
          intrauterine_resuscitation_required, resuscitation_measures,
          clinical_action_plan, recommended_follow_up, fhr_trace_data_json,
          notes, performed_by, reviewed_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )`,
      )
      .run(
        patientId,
        b.admissionId ?? null,
        b.testType,
        b.performedAt,
        b.gestationalAgeWeeks ?? null,
        b.indication ?? null,
        b.durationMinutes,
        b.paperSpeedCmMin,
        b.baselineFhrBpm,
        b.variabilityCategory,
        b.variabilityAmplitudeBpm ?? null,
        b.accelerationsCount,
        b.accelerationsCriteria,
        b.decelerationsType,
        b.decelerationsRecurrent ? 1 : 0,
        b.decelerationsDetails ?? null,
        b.uterineContractionsPer10min,
        evalResult.tachysystolePresent ? 1 : 0,
        b.fetalMovementFelt ? 1 : 0,
        b.vibroacousticStimulationDone ? 1 : 0,
        b.vasResponse ?? null,
        evalResult.nstClassification,
        evalResult.figoClassification,
        evalResult.nichdCategory,
        evalResult.resuscitationRequired ? 1 : 0,
        resuscitationJson,
        b.clinicalActionPlan ?? evalResult.recommendedActions.join('; '),
        b.recommendedFollowUp ?? null,
        traceJson,
        b.notes ?? null,
        user?.id ?? null,
        user?.id ?? null,
        now,
        now,
      );

    const episodeId = Number(res.lastInsertRowid);
    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'create_ctg_episode',
      entity: 'ctg_episode',
      entityId: episodeId,
      detail: {
        patientId,
        episodeId,
        figo: evalResult.figoClassification,
        nichd: evalResult.nichdCategory,
        nst: evalResult.nstClassification,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM ctg_episodes WHERE id = ?').get(episodeId);
    return { episode: created, evaluation: evalResult };
  });

  // GET /api/patients/:id/ctg/episodes/:episodeId
  app.get('/api/patients/:id/ctg/episodes/:episodeId', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    const episodeId = Number((req.params as { episodeId: string }).episodeId);
    if (!Number.isInteger(patientId) || !Number.isInteger(episodeId)) throw badRequest('Invalid parameters');

    const ep = ctx.db
      .prepare(
        `SELECT e.*, u.full_name as performed_by_name, uu.full_name as reviewed_by_name
         FROM ctg_episodes e
         LEFT JOIN users u ON e.performed_by = u.id
         LEFT JOIN users uu ON e.reviewed_by = uu.id
         WHERE e.id = ? AND e.patient_id = ?`,
      )
      .get(episodeId, patientId) as any;

    if (!ep) throw notFound('CTG Episode not found');

    if (ep.fhr_trace_data_json) {
      try {
        ep.tracePoints = JSON.parse(ep.fhr_trace_data_json);
      } catch {
        ep.tracePoints = [];
      }
    }
    if (ep.resuscitation_measures) {
      try {
        ep.resuscitationMeasuresList = JSON.parse(ep.resuscitation_measures);
      } catch {
        ep.resuscitationMeasuresList = [];
      }
    }

    return { episode: ep };
  });

  // PATCH /api/patients/:id/ctg/episodes/:episodeId
  app.patch('/api/patients/:id/ctg/episodes/:episodeId', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    const episodeId = Number((req.params as { episodeId: string }).episodeId);
    if (!Number.isInteger(patientId) || !Number.isInteger(episodeId)) throw badRequest('Invalid parameters');

    const existing = ctx.db
      .prepare('SELECT id FROM ctg_episodes WHERE id = ? AND patient_id = ?')
      .get(episodeId, patientId);
    if (!existing) throw notFound('CTG Episode not found');

    const parseResult = patchCtgEpisodeSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    const resusJson = b.resuscitationMeasures !== undefined ? JSON.stringify(b.resuscitationMeasures) : undefined;

    let sql = 'UPDATE ctg_episodes SET updated_at = ?, reviewed_by = ?';
    const params: any[] = [nowIso(), user?.id ?? null];

    if (b.clinicalActionPlan !== undefined) {
      sql += ', clinical_action_plan = ?';
      params.push(b.clinicalActionPlan);
    }
    if (b.recommendedFollowUp !== undefined) {
      sql += ', recommended_follow_up = ?';
      params.push(b.recommendedFollowUp);
    }
    if (resusJson !== undefined) {
      sql += ', resuscitation_measures = ?';
      params.push(resusJson);
    }
    if (b.notes !== undefined) {
      sql += ', notes = ?';
      params.push(b.notes);
    }

    sql += ' WHERE id = ?';
    params.push(episodeId);

    ctx.db.prepare(sql).run(...params);

    const updated = ctx.db.prepare('SELECT * FROM ctg_episodes WHERE id = ?').get(episodeId);
    return { episode: updated };
  });

  // DELETE /api/patients/:id/ctg/episodes/:episodeId
  app.delete('/api/patients/:id/ctg/episodes/:episodeId', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const patientId = Number((req.params as { id: string }).id);
    const episodeId = Number((req.params as { episodeId: string }).episodeId);
    if (!Number.isInteger(patientId) || !Number.isInteger(episodeId)) throw badRequest('Invalid parameters');

    const existing = ctx.db
      .prepare('SELECT id FROM ctg_episodes WHERE id = ? AND patient_id = ?')
      .get(episodeId, patientId);
    if (!existing) throw notFound('CTG Episode not found');

    ctx.db.prepare('DELETE FROM ctg_episodes WHERE id = ?').run(episodeId);
    return { success: true, deletedId: episodeId };
  });
}
