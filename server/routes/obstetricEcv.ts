import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricEcv,
} from '../../web/src/obstetricEcvEngine.js';

function assertCanManageEcv(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric ECV protocols');
  }
  return user;
}

const ecvEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  procedureDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(30.0).max(44.0),
  maternalParity: z.coerce.number().int().min(0).max(15).default(0),
  maternalBmi: z.coerce.number().min(15.0).max(65.0),
  fetalPresentationInitial: z.enum([
    'frank_breech',
    'complete_breech',
    'footling_incomplete_breech',
    'transverse_lie',
    'oblique_lie',
  ]),
  placentalLocation: z.enum([
    'posterior',
    'fundal',
    'lateral',
    'anterior',
    'low_lying_placenta_previa',
  ]),
  amnioticFluidIndexCm: z.coerce.number().min(0.5).max(40.0),
  estimatedFetalWeightG: z.coerce.number().int().min(500).max(6000),
  fetalSpinePosition: z.enum([
    'posterior',
    'lateral',
    'anterior',
  ]),
  fetalEngagementLevel: z.enum([
    'high_unengaged_floating',
    'dipping_in_pelvis',
    'deeply_engaged',
  ]),
  tocolyticAgentAdministered: z.enum([
    'terbutaline_0_25mg_sc',
    'salbutamol_iv',
    'nitroglycerin_sublingual',
    'none_attempted',
  ]).default('terbutaline_0_25mg_sc'),
  terbutalineGiven: z.boolean().default(true),
  maternalRhNegative: z.boolean().default(false),
  rhAntiDAdministered: z.boolean().default(false),
  kleihauerBetkeSent: z.boolean().default(false),
  contraindicationsPresent: z.boolean().default(false),
  attemptsCount: z.coerce.number().int().min(1).max(10).default(1),
  forwardRollAttempted: z.boolean().default(true),
  backwardFlipAttempted: z.boolean().default(false),
  ecvOutcome: z.enum([
    'successful_cephalic_conversion',
    'failed_breech_persistent',
    'procedure_aborted_fhr_deceleration',
    'emergency_cesarean_transfer',
  ]).default('failed_breech_persistent'),
  status: z.enum([
    'pre_procedure_assessment',
    'tocolysis_in_progress',
    'version_attempts_active',
    'successful_monitoring_discharge',
    'emergency_delivery_transfer',
    'elective_cesarean_scheduled',
  ]).default('pre_procedure_assessment'),
  clinicalNotes: z.string().optional().nullable(),
});

const ecvFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  minutesFromStart: z.coerce.number().min(0).max(600),
  maternalHeartRate: z.coerce.number().int().min(40).max(220),
  maternalBloodPressureSys: z.coerce.number().int().min(40).max(250).optional().nullable(),
  maternalBloodPressureDia: z.coerce.number().int().min(20).max(150).optional().nullable(),
  fetalHeartRateBaseline: z.coerce.number().int().min(60).max(220),
  efmPattern: z.enum([
    'reactive_reassuring',
    'transient_bradycardia_self_resolved',
    'persistent_severe_bradycardia',
    'tachycardia_post_terbutaline',
  ]),
  uterineRelaxationAdequate: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export function registerObstetricEcvRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/obstetric-ecv/evaluate', async (req) => {
    assertCanManageEcv(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricEcv({
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 37.0),
      maternalParity: Number(body.maternalParity || 0),
      maternalBmi: Number(body.maternalBmi || 26.5),
      fetalPresentationInitial: body.fetalPresentationInitial || 'frank_breech',
      placentalLocation: body.placentalLocation || 'posterior',
      amnioticFluidIndexCm: Number(body.amnioticFluidIndexCm || 12.0),
      estimatedFetalWeightG: Number(body.estimatedFetalWeightG || 3100),
      fetalSpinePosition: body.fetalSpinePosition || 'lateral',
      fetalEngagementLevel: body.fetalEngagementLevel || 'high_unengaged_floating',
      terbutalineGiven: body.terbutalineGiven !== undefined ? Boolean(body.terbutalineGiven) : true,
      maternalRhNegative: Boolean(body.maternalRhNegative),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-ecv/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_ecv_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` WHERE e.patient_id = ? `;
      params.push(Number(patientId));
    }

    query += ` ORDER BY e.id DESC`;

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 3. Get Episode Details with Flowsheet Logs
  app.get('/api/obstetric-ecv/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_ecv_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric ECV episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_ecv_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.ecv_episode_id = ?
      ORDER BY l.minutes_from_start ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateObstetricEcv({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      maternalParity: episode.maternal_parity,
      maternalBmi: episode.maternal_bmi,
      fetalPresentationInitial: episode.fetal_presentation_initial,
      placentalLocation: episode.placental_location,
      amnioticFluidIndexCm: episode.amniotic_fluid_index_cm,
      estimatedFetalWeightG: episode.estimated_fetal_weight_g,
      fetalSpinePosition: episode.fetal_spine_position,
      fetalEngagementLevel: episode.fetal_engagement_level,
      terbutalineGiven: Boolean(episode.terbutaline_given),
      maternalRhNegative: Boolean(episode.maternal_rh_negative),
    });

    return { episode, flowsheet: flowsheetLogs, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-ecv/episodes', async (req, reply) => {
    const user = assertCanManageEcv(req);
    requirePerm(req, 'patient:write_clinical');
    const input = parse(ecvEpisodeSchema, req.body);

    const evaluation = evaluateObstetricEcv({
      gestationalAgeWeeks: input.gestationalAgeWeeks,
      maternalParity: input.maternalParity,
      maternalBmi: input.maternalBmi,
      fetalPresentationInitial: input.fetalPresentationInitial,
      placentalLocation: input.placentalLocation,
      amnioticFluidIndexCm: input.amnioticFluidIndexCm,
      estimatedFetalWeightG: input.estimatedFetalWeightG,
      fetalSpinePosition: input.fetalSpinePosition,
      fetalEngagementLevel: input.fetalEngagementLevel,
      terbutalineGiven: input.terbutalineGiven,
      maternalRhNegative: input.maternalRhNegative,
    });

    const episodeCode = `ECV-${Date.now().toString(36).toUpperCase()}`;

    const insert = db.prepare(`
      INSERT INTO obstetric_ecv_episodes (
        patient_id, admission_id, episode_code, procedure_datetime,
        gestational_age_weeks, maternal_parity, maternal_bmi,
        fetal_presentation_initial, placental_location, amniotic_fluid_index_cm,
        estimated_fetal_weight_g, fetal_spine_position, fetal_engagement_level,
        tocolytic_agent_administered, terbutaline_given, maternal_rh_negative,
        rh_anti_d_administered, kleihauer_betke_sent, contraindications_present,
        attempts_count, forward_roll_attempted, backward_flip_attempted,
        ecv_outcome, calculated_success_probability_pct, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = insert.run(
      input.patientId,
      input.admissionId ?? null,
      episodeCode,
      input.procedureDatetime,
      input.gestationalAgeWeeks,
      input.maternalParity,
      input.maternalBmi,
      input.fetalPresentationInitial,
      input.placentalLocation,
      input.amnioticFluidIndexCm,
      input.estimatedFetalWeightG,
      input.fetalSpinePosition,
      input.fetalEngagementLevel,
      input.tocolyticAgentAdministered,
      input.terbutalineGiven ? 1 : 0,
      input.maternalRhNegative ? 1 : 0,
      input.rhAntiDAdministered ? 1 : 0,
      input.kleihauerBetkeSent ? 1 : 0,
      (evaluation.hasAbsoluteContraindications || input.contraindicationsPresent) ? 1 : 0,
      input.attemptsCount,
      input.forwardRollAttempted ? 1 : 0,
      input.backwardFlipAttempted ? 1 : 0,
      input.ecvOutcome,
      evaluation.calculatedSuccessProbabilityPct,
      input.status,
      user.id,
      input.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ecv.create',
      entity: 'obstetric_ecv_episodes',
      entityId: episodeId,
      detail: {
        episodeId,
        episodeCode,
        patientId: input.patientId,
        successProbability: evaluation.calculatedSuccessProbabilityPct,
      },
    });

    reply.status(201);
    return {
      episodeId,
      id: episodeId,
      episodeCode,
      successProbability: evaluation.calculatedSuccessProbabilityPct,
      evaluation,
      success: true,
    };
  });

  // 5. Update Status
  app.patch('/api/obstetric-ecv/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageEcv(req);
    const { id } = req.params as { id: string };

    const statusSchema = z.object({
      status: z.enum([
        'pre_procedure_assessment',
        'tocolysis_in_progress',
        'version_attempts_active',
        'successful_monitoring_discharge',
        'emergency_delivery_transfer',
        'elective_cesarean_scheduled',
      ]),
      ecvOutcome: z.enum([
        'successful_cephalic_conversion',
        'failed_breech_persistent',
        'procedure_aborted_fhr_deceleration',
        'emergency_cesarean_transfer',
      ]).optional(),
      clinicalNotes: z.string().optional().nullable(),
    });

    const input = parse(statusSchema, req.body);

    const update = db.prepare(`
      UPDATE obstetric_ecv_episodes
      SET status = ?,
          ecv_outcome = COALESCE(?, ecv_outcome),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = update.run(input.status, input.ecvOutcome ?? null, input.clinicalNotes ?? null, Number(id));
    if (result.changes === 0) throw notFound('Episode not found');

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ecv.status_update',
      entity: 'obstetric_ecv_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), newStatus: input.status, ecvOutcome: input.ecvOutcome },
    });

    return { success: true, status: input.status };
  });

  // 6. Add Flowsheet Entry
  const addFlowsheetHandler = async (req: FastifyRequest, reply: any) => {
    const user = assertCanManageEcv(req);
    const { id } = req.params as { id: string };
    const input = parse(ecvFlowsheetSchema, req.body);

    const episode = db.prepare(`
      SELECT patient_id FROM obstetric_ecv_episodes WHERE id = ?
    `).get(Number(id)) as { patient_id: number } | undefined;

    if (!episode) throw notFound('Obstetric ECV episode not found');

    const insert = db.prepare(`
      INSERT INTO obstetric_ecv_flowsheet_logs (
        ecv_episode_id, patient_id, log_datetime, minutes_from_start,
        maternal_heart_rate, maternal_blood_pressure_sys, maternal_blood_pressure_dia,
        fetal_heart_rate_baseline, efm_pattern, uterine_relaxation_adequate,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const res = insert.run(
      Number(id),
      episode.patient_id,
      input.logDatetime,
      input.minutesFromStart,
      input.maternalHeartRate,
      input.maternalBloodPressureSys ?? null,
      input.maternalBloodPressureDia ?? null,
      input.fetalHeartRateBaseline,
      input.efmPattern,
      input.uterineRelaxationAdequate ? 1 : 0,
      input.notes ?? null,
      user.id
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ecv.flowsheet_add',
      entity: 'obstetric_ecv_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, minutesFromStart: input.minutesFromStart },
    });

    reply.status(201);
    return { id: logId, logId, success: true };
  };

  app.post('/api/obstetric-ecv/episodes/:id/flowsheet', addFlowsheetHandler);
  app.post('/api/obstetric-ecv/episodes/:id/flowsheet-logs', addFlowsheetHandler);

  // 7. Delete Flowsheet Entry
  app.delete('/api/obstetric-ecv/flowsheet/:id', async (req) => {
    const user = assertCanManageEcv(req);
    const { id } = req.params as { id: string };

    const entry = db.prepare(`
      SELECT * FROM obstetric_ecv_flowsheet_logs WHERE id = ?
    `).get(Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_ecv_flowsheet_logs WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ecv.flowsheet_delete',
      entity: 'obstetric_ecv_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: entry.ecv_episode_id },
    });

    return { success: true };
  });

  app.delete('/api/obstetric-ecv/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageEcv(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const entry = db.prepare(`
      SELECT * FROM obstetric_ecv_flowsheet_logs WHERE id = ? AND ecv_episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_ecv_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ecv.flowsheet_delete',
      entity: 'obstetric_ecv_flowsheet_logs',
      entityId: Number(logId),
      detail: { logId: Number(logId), episodeId: Number(id) },
    });

    return { success: true };
  });
}
