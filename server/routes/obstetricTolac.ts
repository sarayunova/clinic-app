import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricTolac,
} from '../../web/src/obstetricTolacEngine.js';

function assertCanManageTolac(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric TOLAC protocols');
  }
  return user;
}

const tolacEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  assessmentDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(24).max(44),
  maternalAge: z.coerce.number().min(12).max(60),
  maternalBmi: z.coerce.number().min(15).max(70),
  priorCesareanCount: z.coerce.number().min(1).max(10).default(1),
  priorUterineIncisionType: z.enum([
    'low_transverse',
    'unknown_low_transverse_presumed',
    'classical_vertical',
    'inverted_t_or_j',
    'prior_transmural_myomectomy',
  ]),
  priorVaginalDelivery: z.enum([
    'prior_vbac',
    'prior_vaginal_before_cesarean',
    'no_prior_vaginal_delivery',
  ]),
  indicationForPriorCesarean: z.string().min(1),
  interdeliveryIntervalMonths: z.coerce.number().min(0).max(240).default(24),
  bishopScore: z.coerce.number().min(0).max(13).default(5),
  efmAbnormality: z.enum([
    'normal_category_1',
    'indeterminate_category_2',
    'variable_decelerations_recurrent',
    'prolonged_deceleration',
    'persistent_bradycardia_lt_90',
  ]).default('normal_category_1'),
  iupcLossOfUterineTone: z.boolean().default(false),
  acuteScarTenderness: z.boolean().default(false),
  vaginalBleedingFresh: z.boolean().default(false),
  cessationOfContractions: z.boolean().default(false),
  presentingPartRetraction: z.boolean().default(false),
  status: z.enum([
    'eligible_tolac_counseled',
    'active_labor_efm_monitoring',
    'impending_rupture_detected',
    'crash_cesarean_transfer',
    'successful_vbac',
    'elective_repeat_cesarean',
  ]).default('eligible_tolac_counseled'),
  clinicalNotes: z.string().optional().nullable(),
});

const tolacFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursInActiveLabor: z.coerce.number().min(0).max(72),
  cervicalDilationCm: z.coerce.number().min(0).max(10),
  fetalHeartRateBaseline: z.coerce.number().min(40).max(220),
  efmCategory: z.enum([
    'category_1_normal',
    'category_2_indeterminate',
    'category_3_abnormal',
  ]),
  contractionsPer10min: z.coerce.number().min(0).max(10),
  restingUterineToneMmhg: z.coerce.number().min(0).max(50).optional().nullable(),
  lowerSegmentScarPain: z.boolean().default(false),
  interventionApplied: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerObstetricTolacRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/obstetric-tolac/evaluate', async (req) => {
    assertCanManageTolac(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricTolac({
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 39.0),
      maternalAge: Number(body.maternalAge || 29),
      maternalBmi: Number(body.maternalBmi || 26.5),
      priorCesareanCount: Number(body.priorCesareanCount || 1),
      priorUterineIncisionType: body.priorUterineIncisionType || 'low_transverse',
      priorVaginalDelivery: body.priorVaginalDelivery || 'no_prior_vaginal_delivery',
      indicationForPriorCesarean: body.indicationForPriorCesarean || 'Breech presentation',
      interdeliveryIntervalMonths: Number(body.interdeliveryIntervalMonths || 24),
      bishopScore: Number(body.bishopScore || 6),
      efmAbnormality: body.efmAbnormality || 'normal_category_1',
      iupcLossOfUterineTone: Boolean(body.iupcLossOfUterineTone),
      acuteScarTenderness: Boolean(body.acuteScarTenderness),
      vaginalBleedingFresh: Boolean(body.vaginalBleedingFresh),
      cessationOfContractions: Boolean(body.cessationOfContractions),
      presentingPartRetraction: Boolean(body.presentingPartRetraction),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-tolac/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_tolac_episodes e
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
        contraindications_present: Boolean(r.contraindications_present),
        iupc_loss_of_uterine_tone: Boolean(r.iupc_loss_of_uterine_tone),
        acute_scar_tenderness: Boolean(r.acute_scar_tenderness),
        vaginal_bleeding_fresh: Boolean(r.vaginal_bleeding_fresh),
        cessation_of_contractions: Boolean(r.cessation_of_contractions),
        presenting_part_retraction: Boolean(r.presenting_part_retraction),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/obstetric-tolac/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_tolac_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Obstetric TOLAC episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_tolac_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.tolac_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluateObstetricTolac({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      maternalAge: episode.maternal_age,
      maternalBmi: episode.maternal_bmi,
      priorCesareanCount: episode.prior_cesarean_count,
      priorUterineIncisionType: episode.prior_uterine_incision_type,
      priorVaginalDelivery: episode.prior_vaginal_delivery,
      indicationForPriorCesarean: episode.indication_for_prior_cesarean,
      interdeliveryIntervalMonths: episode.interdelivery_interval_months,
      bishopScore: episode.bishop_score,
      efmAbnormality: episode.efm_abnormality,
      iupcLossOfUterineTone: Boolean(episode.iupc_loss_of_uterine_tone),
      acuteScarTenderness: Boolean(episode.acute_scar_tenderness),
      vaginalBleedingFresh: Boolean(episode.vaginal_bleeding_fresh),
      cessationOfContractions: Boolean(episode.cessation_of_contractions),
      presentingPartRetraction: Boolean(episode.presenting_part_retraction),
    });

    return {
      episode: {
        ...episode,
        contraindications_present: Boolean(episode.contraindications_present),
        iupc_loss_of_uterine_tone: Boolean(episode.iupc_loss_of_uterine_tone),
        acute_scar_tenderness: Boolean(episode.acute_scar_tenderness),
        vaginal_bleeding_fresh: Boolean(episode.vaginal_bleeding_fresh),
        cessation_of_contractions: Boolean(episode.cessation_of_contractions),
        presenting_part_retraction: Boolean(episode.presenting_part_retraction),
      },
      evaluation,
      flowsheet: flowsheet.map(f => ({
        ...f,
        lower_segment_scar_pain: Boolean(f.lower_segment_scar_pain),
      })),
    };
  });

  // 4. Create Episode
  app.post('/api/obstetric-tolac/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageTolac(req);
    const data = parse(tolacEpisodeSchema, req.body);

    const evaluation = evaluateObstetricTolac({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      maternalAge: data.maternalAge,
      maternalBmi: data.maternalBmi,
      priorCesareanCount: data.priorCesareanCount,
      priorUterineIncisionType: data.priorUterineIncisionType,
      priorVaginalDelivery: data.priorVaginalDelivery,
      indicationForPriorCesarean: data.indicationForPriorCesarean,
      interdeliveryIntervalMonths: data.interdeliveryIntervalMonths,
      bishopScore: data.bishopScore,
      efmAbnormality: data.efmAbnormality,
      iupcLossOfUterineTone: data.iupcLossOfUterineTone,
      acuteScarTenderness: data.acuteScarTenderness,
      vaginalBleedingFresh: data.vaginalBleedingFresh,
      cessationOfContractions: data.cessationOfContractions,
      presentingPartRetraction: data.presentingPartRetraction,
    });

    const dateStr = data.assessmentDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `TOLAC-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO obstetric_tolac_episodes (
        patient_id, admission_id, episode_code, assessment_datetime,
        gestational_age_weeks, maternal_age, maternal_bmi,
        prior_cesarean_count, prior_uterine_incision_type, prior_vaginal_delivery,
        indication_for_prior_cesarean, interdelivery_interval_months, bishop_score,
        grobman_vbac_success_pct, contraindications_present, efm_abnormality,
        iupc_loss_of_uterine_tone, acute_scar_tenderness, vaginal_bleeding_fresh,
        cessation_of_contractions, presenting_part_retraction, rupture_risk_tier,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.assessmentDatetime,
      data.gestationalAgeWeeks,
      data.maternalAge,
      data.maternalBmi,
      data.priorCesareanCount,
      data.priorUterineIncisionType,
      data.priorVaginalDelivery,
      data.indicationForPriorCesarean,
      data.interdeliveryIntervalMonths,
      data.bishopScore,
      evaluation.grobmanVbacSuccessPct,
      evaluation.hasContraindications ? 1 : 0,
      data.efmAbnormality,
      data.iupcLossOfUterineTone ? 1 : 0,
      data.acuteScarTenderness ? 1 : 0,
      data.vaginalBleedingFresh ? 1 : 0,
      data.cessationOfContractions ? 1 : 0,
      data.presentingPartRetraction ? 1 : 0,
      evaluation.ruptureRiskTier,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_tolac.create',
      entity: 'obstetric_tolac_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, vbacSuccess: evaluation.grobmanVbacSuccessPct, ruptureTier: evaluation.ruptureRiskTier },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status
  app.patch('/api/obstetric-tolac/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageTolac(req);
    const { id } = req.params as { id: string };
    const {
      status,
      efmAbnormality,
      acuteScarTenderness,
      presentingPartRetraction,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'eligible_tolac_counseled',
      'active_labor_efm_monitoring',
      'impending_rupture_detected',
      'crash_cesarean_transfer',
      'successful_vbac',
      'elective_repeat_cesarean',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE obstetric_tolac_episodes
      SET status = COALESCE(?, status),
          efm_abnormality = COALESCE(?, efm_abnormality),
          acute_scar_tenderness = CASE WHEN ? IS NOT NULL THEN ? ELSE acute_scar_tenderness END,
          presenting_part_retraction = CASE WHEN ? IS NOT NULL THEN ? ELSE presenting_part_retraction END,
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      efmAbnormality ?? null,
      acuteScarTenderness !== undefined ? (acuteScarTenderness ? 1 : 0) : null,
      acuteScarTenderness !== undefined ? (acuteScarTenderness ? 1 : 0) : null,
      presentingPartRetraction !== undefined ? (presentingPartRetraction ? 1 : 0) : null,
      presentingPartRetraction !== undefined ? (presentingPartRetraction ? 1 : 0) : null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_tolac.status_update',
      entity: 'obstetric_tolac_episodes',
      entityId: Number(id),
      detail: { status },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/obstetric-tolac/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_tolac_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.tolac_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return {
      logs: rows.map(r => ({
        ...r,
        lower_segment_scar_pain: Boolean(r.lower_segment_scar_pain),
      })),
    };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-tolac/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageTolac(req);
    const { id } = req.params as { id: string };
    const data = parse(tolacFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM obstetric_tolac_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric TOLAC episode not found');

    const res = db.prepare(`
      INSERT INTO obstetric_tolac_flowsheet_logs (
        tolac_episode_id, patient_id, log_datetime,
        hours_in_active_labor, cervical_dilation_cm, fetal_heart_rate_baseline,
        efm_category, contractions_per_10min, resting_uterine_tone_mmhg,
        lower_segment_scar_pain, intervention_applied, notes, logged_by_id
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursInActiveLabor,
      data.cervicalDilationCm,
      data.fetalHeartRateBaseline,
      data.efmCategory,
      data.contractionsPer10min,
      data.restingUterineToneMmhg ?? null,
      data.lowerSegmentScarPain ? 1 : 0,
      data.interventionApplied ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_tolac.flowsheet_add',
      entity: 'obstetric_tolac_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), dilation: data.cervicalDilationCm, efm: data.efmCategory },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-tolac/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageTolac(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM obstetric_tolac_flowsheet_logs
      WHERE id = ? AND tolac_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_tolac_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_tolac.flowsheet_delete',
      entity: 'obstetric_tolac_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
