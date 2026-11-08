import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricRetainedPlacenta,
} from '../../web/src/obstetricRetainedPlacentaEngine.js';

function assertCanManageRetainedPlacenta(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage retained placenta protocols');
  }
  return user;
}

const retainedPlacentaEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  deliveryDatetime: z.string().min(1),
  thirdStageDurationMinutes: z.coerce.number().min(0).max(1440),
  activeManagementThirdStage: z.boolean().default(true),
  estimatedBloodLossMl: z.coerce.number().min(0).max(10000).default(200),
  hemodynamicStability: z.enum([
    'stable',
    'borderline_tachycardic',
    'decompensated_hypotensive_shock',
  ]),
  bladderCatheterized: z.boolean().default(true),
  retainedPlacentaType: z.enum([
    'placenta_adherens',
    'trapped_incarcerated_placenta',
    'partial_accreta_suspected',
  ]),
  iuvOxytocinAttempted: z.boolean().default(false),
  iuvOxytocinDoseIu: z.coerce.number().min(0).max(50).default(20),
  iuvOxytocinSuccessful: z.boolean().default(false),
  mropIndicated: z.boolean().default(true),
  mropPerformed: z.boolean().default(false),
  mropDatetime: z.string().optional().nullable(),
  anesthesiaType: z.enum([
    'spinal_regional',
    'epidural_topup',
    'general_anesthesia',
    'iv_sedation_analgesia',
  ]).optional().nullable(),
  placentaCompletePostRemoval: z.boolean().default(true),
  prophylacticAntibioticsGiven: z.boolean().default(true),
  postRemovalOxytocinInfusion: z.boolean().default(true),
  status: z.enum([
    'under_conservative_management',
    'iuv_oxytocin_in_progress',
    'mrop_in_theater',
    'post_removal_recovery',
    'resolved_discharged',
    'escalated_to_laparotomy_hysterectomy',
  ]).default('under_conservative_management'),
  clinicalNotes: z.string().optional().nullable(),
});

const retainedPlacentaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  minutesFromDelivery: z.coerce.number().min(0).max(1440),
  bloodPressureSys: z.coerce.number().min(30).max(300).optional().nullable(),
  bloodPressureDia: z.coerce.number().min(20).max(200).optional().nullable(),
  heartRate: z.coerce.number().min(30).max(250).optional().nullable(),
  cumulativeBloodLossMl: z.coerce.number().min(0).max(10000).default(200),
  uterineFundusTone: z.enum([
    'firm_contracted',
    'soft_boggy',
    'contracted_with_lower_spasm',
  ]),
  activeVaginalBleeding: z.enum([
    'minimal_trickle',
    'moderate_lochia',
    'brisk_hemorrhage',
  ]),
  cordLengtheningObserved: z.boolean().default(false),
  interventionApplied: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerObstetricRetainedPlacentaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/obstetric-retained-placenta/evaluate', async (req) => {
    assertCanManageRetainedPlacenta(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricRetainedPlacenta({
      thirdStageDurationMinutes: Number(body.thirdStageDurationMinutes || 35),
      activeManagementThirdStage: body.activeManagementThirdStage !== undefined ? Boolean(body.activeManagementThirdStage) : true,
      estimatedBloodLossMl: Number(body.estimatedBloodLossMl || 300),
      hemodynamicStability: body.hemodynamicStability || 'stable',
      bladderCatheterized: body.bladderCatheterized !== undefined ? Boolean(body.bladderCatheterized) : true,
      retainedPlacentaType: body.retainedPlacentaType || 'placenta_adherens',
      iuvOxytocinAttempted: Boolean(body.iuvOxytocinAttempted),
      iuvOxytocinSuccessful: Boolean(body.iuvOxytocinSuccessful),
      mropPerformed: Boolean(body.mropPerformed),
      placentaCompletePostRemoval: body.placentaCompletePostRemoval !== undefined ? Boolean(body.placentaCompletePostRemoval) : true,
      prophylacticAntibioticsGiven: body.prophylacticAntibioticsGiven !== undefined ? Boolean(body.prophylacticAntibioticsGiven) : true,
      postRemovalOxytocinInfusion: body.postRemovalOxytocinInfusion !== undefined ? Boolean(body.postRemovalOxytocinInfusion) : true,
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-retained-placenta/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_retained_placenta_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` WHERE e.patient_id = ? `;
      params.push(patientId);
    }

    query += ` ORDER BY e.id DESC`;
    const rows = db.prepare(query).all(...params) as any[];

    return {
      episodes: rows.map(r => ({
        ...r,
        active_management_third_stage: Boolean(r.active_management_third_stage),
        bladder_catheterized: Boolean(r.bladder_catheterized),
        iuv_oxytocin_attempted: Boolean(r.iuv_oxytocin_attempted),
        iuv_oxytocin_successful: Boolean(r.iuv_oxytocin_successful),
        mrop_indicated: Boolean(r.mrop_indicated),
        mrop_performed: Boolean(r.mrop_performed),
        placenta_complete_post_removal: Boolean(r.placenta_complete_post_removal),
        prophylactic_antibiotics_given: Boolean(r.prophylactic_antibiotics_given),
        post_removal_oxytocin_infusion: Boolean(r.post_removal_oxytocin_infusion),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/obstetric-retained-placenta/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_retained_placenta_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Obstetric retained placenta episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_retained_placenta_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.retained_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluateObstetricRetainedPlacenta({
      thirdStageDurationMinutes: episode.third_stage_duration_minutes,
      activeManagementThirdStage: Boolean(episode.active_management_third_stage),
      estimatedBloodLossMl: episode.estimated_blood_loss_ml,
      hemodynamicStability: episode.hemodynamic_stability,
      bladderCatheterized: Boolean(episode.bladder_catheterized),
      retainedPlacentaType: episode.retained_placenta_type,
      iuvOxytocinAttempted: Boolean(episode.iuv_oxytocin_attempted),
      iuvOxytocinSuccessful: Boolean(episode.iuv_oxytocin_successful),
      mropPerformed: Boolean(episode.mrop_performed),
      placentaCompletePostRemoval: Boolean(episode.placenta_complete_post_removal),
      prophylacticAntibioticsGiven: Boolean(episode.prophylactic_antibiotics_given),
      postRemovalOxytocinInfusion: Boolean(episode.post_removal_oxytocin_infusion),
    });

    return {
      episode: {
        ...episode,
        active_management_third_stage: Boolean(episode.active_management_third_stage),
        bladder_catheterized: Boolean(episode.bladder_catheterized),
        iuv_oxytocin_attempted: Boolean(episode.iuv_oxytocin_attempted),
        iuv_oxytocin_successful: Boolean(episode.iuv_oxytocin_successful),
        mrop_indicated: Boolean(episode.mrop_indicated),
        mrop_performed: Boolean(episode.mrop_performed),
        placenta_complete_post_removal: Boolean(episode.placenta_complete_post_removal),
        prophylactic_antibiotics_given: Boolean(episode.prophylactic_antibiotics_given),
        post_removal_oxytocin_infusion: Boolean(episode.post_removal_oxytocin_infusion),
      },
      evaluation,
      flowsheet: flowsheet.map(f => ({
        ...f,
        cord_lengthening_observed: Boolean(f.cord_lengthening_observed),
      })),
    };
  });

  // 4. Create Episode
  app.post('/api/obstetric-retained-placenta/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageRetainedPlacenta(req);
    const data = parse(retainedPlacentaEpisodeSchema, req.body);

    const evaluation = evaluateObstetricRetainedPlacenta({
      thirdStageDurationMinutes: data.thirdStageDurationMinutes,
      activeManagementThirdStage: data.activeManagementThirdStage,
      estimatedBloodLossMl: data.estimatedBloodLossMl,
      hemodynamicStability: data.hemodynamicStability,
      bladderCatheterized: data.bladderCatheterized,
      retainedPlacentaType: data.retainedPlacentaType,
      iuvOxytocinAttempted: data.iuvOxytocinAttempted,
      iuvOxytocinSuccessful: data.iuvOxytocinSuccessful,
      mropPerformed: data.mropPerformed,
      placentaCompletePostRemoval: data.placentaCompletePostRemoval,
      prophylacticAntibioticsGiven: data.prophylacticAntibioticsGiven,
      postRemovalOxytocinInfusion: data.postRemovalOxytocinInfusion,
    });

    const dateStr = data.deliveryDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `RET-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO obstetric_retained_placenta_episodes (
        patient_id, admission_id, episode_code, delivery_datetime,
        third_stage_duration_minutes, active_management_third_stage, estimated_blood_loss_ml,
        hemodynamic_stability, bladder_catheterized, retained_placenta_type,
        iuv_oxytocin_attempted, iuv_oxytocin_dose_iu, iuv_oxytocin_successful,
        mrop_indicated, mrop_performed, mrop_datetime,
        anesthesia_type, placenta_complete_post_removal,
        prophylactic_antibiotics_given, post_removal_oxytocin_infusion,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.deliveryDatetime,
      data.thirdStageDurationMinutes,
      data.activeManagementThirdStage ? 1 : 0,
      data.estimatedBloodLossMl,
      data.hemodynamicStability,
      data.bladderCatheterized ? 1 : 0,
      data.retainedPlacentaType,
      data.iuvOxytocinAttempted ? 1 : 0,
      data.iuvOxytocinDoseIu,
      data.iuvOxytocinSuccessful ? 1 : 0,
      data.mropIndicated ? 1 : 0,
      data.mropPerformed ? 1 : 0,
      data.mropDatetime ?? null,
      data.anesthesiaType ?? null,
      data.placentaCompletePostRemoval ? 1 : 0,
      data.prophylacticAntibioticsGiven ? 1 : 0,
      data.postRemovalOxytocinInfusion ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_retained_placenta.create',
      entity: 'obstetric_retained_placenta_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, duration: data.thirdStageDurationMinutes, urgency: evaluation.mropUrgency },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status
  app.patch('/api/obstetric-retained-placenta/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageRetainedPlacenta(req);
    const { id } = req.params as { id: string };
    const {
      status,
      mropPerformed,
      mropDatetime,
      anesthesiaType,
      placentaCompletePostRemoval,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'under_conservative_management',
      'iuv_oxytocin_in_progress',
      'mrop_in_theater',
      'post_removal_recovery',
      'resolved_discharged',
      'escalated_to_laparotomy_hysterectomy',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE obstetric_retained_placenta_episodes
      SET status = COALESCE(?, status),
          mrop_performed = CASE WHEN ? IS NOT NULL THEN ? ELSE mrop_performed END,
          mrop_datetime = COALESCE(?, mrop_datetime),
          anesthesia_type = COALESCE(?, anesthesia_type),
          placenta_complete_post_removal = CASE WHEN ? IS NOT NULL THEN ? ELSE placenta_complete_post_removal END,
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      mropPerformed !== undefined ? (mropPerformed ? 1 : 0) : null,
      mropPerformed !== undefined ? (mropPerformed ? 1 : 0) : null,
      mropDatetime ?? null,
      anesthesiaType ?? null,
      placentaCompletePostRemoval !== undefined ? (placentaCompletePostRemoval ? 1 : 0) : null,
      placentaCompletePostRemoval !== undefined ? (placentaCompletePostRemoval ? 1 : 0) : null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_retained_placenta.status_update',
      entity: 'obstetric_retained_placenta_episodes',
      entityId: Number(id),
      detail: { status, mropPerformed },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/obstetric-retained-placenta/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_retained_placenta_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.retained_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return {
      logs: rows.map(r => ({
        ...r,
        cord_lengthening_observed: Boolean(r.cord_lengthening_observed),
      })),
    };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-retained-placenta/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageRetainedPlacenta(req);
    const { id } = req.params as { id: string };
    const data = parse(retainedPlacentaFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM obstetric_retained_placenta_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric retained placenta episode not found');

    const res = db.prepare(`
      INSERT INTO obstetric_retained_placenta_flowsheet_logs (
        retained_episode_id, patient_id, log_datetime,
        minutes_from_delivery, blood_pressure_sys, blood_pressure_dia,
        heart_rate, cumulative_blood_loss_ml, uterine_fundus_tone,
        active_vaginal_bleeding, cord_lengthening_observed,
        intervention_applied, notes, logged_by_id
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromDelivery,
      data.bloodPressureSys ?? null,
      data.bloodPressureDia ?? null,
      data.heartRate ?? null,
      data.cumulativeBloodLossMl,
      data.uterineFundusTone,
      data.activeVaginalBleeding,
      data.cordLengtheningObserved ? 1 : 0,
      data.interventionApplied ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_retained_placenta.flowsheet_add',
      entity: 'obstetric_retained_placenta_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), cumulativeLoss: data.cumulativeBloodLossMl },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-retained-placenta/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageRetainedPlacenta(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM obstetric_retained_placenta_flowsheet_logs
      WHERE id = ? AND retained_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_retained_placenta_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_retained_placenta.flowsheet_delete',
      entity: 'obstetric_retained_placenta_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
