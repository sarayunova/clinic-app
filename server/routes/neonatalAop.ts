import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalAop,
} from '../../web/src/neonatalAopEngine.js';

function assertCanManageNeonatalAop(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal AOP protocols');
  }
  return user;
}

const neonatalAopEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(23.0).max(37.0),
  chronologicalAgeDays: z.coerce.number().min(0).max(180),
  postConceptionalAgeWeeks: z.coerce.number().min(23.0).max(50.0).optional().nullable(),
  currentWeightKg: z.coerce.number().min(0.4).max(5.0),
  apneaSubtype: z.enum(['mixed', 'central', 'obstructive']),
  apneaFrequencyPer24h: z.coerce.number().min(0).max(100).default(1),
  bradycardiaPresent: z.boolean().default(true),
  lowestHeartRateBpm: z.coerce.number().min(30).max(220).optional().nullable(),
  desaturationPresent: z.boolean().default(true),
  lowestSpo2Percent: z.coerce.number().min(30).max(100).optional().nullable(),
  stimulationRequired: z.enum([
    'self_resolved',
    'tactile_gentle',
    'vigorous_stimulation',
    'bag_mask_positive_pressure',
  ]),
  caffeineCitrateActive: z.boolean().default(true),
  caffeineLoadingDoseMgKg: z.coerce.number().min(10).max(40).default(20.0),
  caffeineMaintenanceDoseMgKgDay: z.coerce.number().min(2.5).max(25.0).default(7.5),
  serumCaffeineLevelMcgMl: z.coerce.number().min(0).max(100).optional().nullable(),
  secondaryCausesExcluded: z.boolean().default(true),
  respiratorySupportMode: z.enum([
    'room_air',
    'low_flow_nasal_cannula',
    'high_flow_hfnc',
    'bubble_cpap',
    'niv_nava',
    'invasive_mechanical_ventilation',
  ]),
  cpapPeepCmh2o: z.coerce.number().min(0).max(15).optional().nullable(),
  weaningEligible: z.boolean().default(false),
  apneaFreeDaysCount: z.coerce.number().min(0).max(60).default(0),
  status: z.enum([
    'active_treatment',
    'dose_escalation_refractory',
    'weaning_phase',
    'caffeine_discontinued_monitoring',
    'resolved_discharged',
  ]).default('active_treatment'),
  clinicalNotes: z.string().optional().nullable(),
});

const aopFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  apneaEventsCountInShift: z.coerce.number().min(0).max(50).default(0),
  bradycardiaEventsCount: z.coerce.number().min(0).max(50).default(0),
  desaturationEventsCount: z.coerce.number().min(0).max(50).default(0),
  lowestHeartRateBpm: z.coerce.number().min(30).max(220).optional().nullable(),
  lowestSpo2Percent: z.coerce.number().min(30).max(100).optional().nullable(),
  stimulationModeUsed: z.enum(['none', 'tactile_rubbing', 'repositioning', 'bag_valve_mask']).optional().nullable(),
  caffeineDoseGivenMg: z.coerce.number().min(0).max(50).optional().nullable(),
  currentRespiratorySupport: z.string().optional().nullable(),
  caffeineToxicitySigns: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalAopRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate AOP algorithm
  app.post('/api/neonatal-aop/evaluate', async (req) => {
    assertCanManageNeonatalAop(req);
    const body = req.body as any;

    const evaluation = evaluateNeonatalAop({
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 30),
      chronologicalAgeDays: Number(body.chronologicalAgeDays || 10),
      postConceptionalAgeWeeks: body.postConceptionalAgeWeeks ? Number(body.postConceptionalAgeWeeks) : undefined,
      currentWeightKg: Number(body.currentWeightKg || 1.3),
      apneaSubtype: body.apneaSubtype || 'mixed',
      apneaFrequencyPer24h: Number(body.apneaFrequencyPer24h || 3),
      lowestHeartRateBpm: body.lowestHeartRateBpm ? Number(body.lowestHeartRateBpm) : undefined,
      lowestSpo2Percent: body.lowestSpo2Percent ? Number(body.lowestSpo2Percent) : undefined,
      stimulationRequired: body.stimulationRequired || 'tactile_gentle',
      caffeineCitrateActive: body.caffeineCitrateActive !== undefined ? Boolean(body.caffeineCitrateActive) : true,
      caffeineLoadingDoseMgKg: body.caffeineLoadingDoseMgKg ? Number(body.caffeineLoadingDoseMgKg) : 20.0,
      caffeineMaintenanceDoseMgKgDay: body.caffeineMaintenanceDoseMgKgDay ? Number(body.caffeineMaintenanceDoseMgKgDay) : 7.5,
      serumCaffeineLevelMcgMl: body.serumCaffeineLevelMcgMl ? Number(body.serumCaffeineLevelMcgMl) : undefined,
      secondaryCausesExcluded: Boolean(body.secondaryCausesExcluded ?? true),
      respiratorySupportMode: body.respiratorySupportMode || 'bubble_cpap',
      cpapPeepCmh2o: body.cpapPeepCmh2o ? Number(body.cpapPeepCmh2o) : undefined,
      apneaFreeDaysCount: Number(body.apneaFreeDaysCount || 0),
    });

    return { evaluation };
  });

  // 2. List AOP Episodes
  app.get('/api/neonatal-aop/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_aop_episodes e
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
        bradycardia_present: Boolean(r.bradycardia_present),
        desaturation_present: Boolean(r.desaturation_present),
        caffeine_citrate_active: Boolean(r.caffeine_citrate_active),
        secondary_causes_excluded: Boolean(r.secondary_causes_excluded),
        weaning_eligible: Boolean(r.weaning_eligible),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/neonatal-aop/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_aop_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Neonatal AOP episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_aop_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.aop_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluateNeonatalAop({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      chronologicalAgeDays: episode.chronological_age_days,
      postConceptionalAgeWeeks: episode.post_conceptional_age_weeks,
      currentWeightKg: episode.current_weight_kg,
      apneaSubtype: episode.apnea_subtype,
      apneaFrequencyPer24h: episode.apnea_frequency_per_24h,
      lowestHeartRateBpm: episode.lowest_heart_rate_bpm ?? undefined,
      lowestSpo2Percent: episode.lowest_spo2_percent ?? undefined,
      stimulationRequired: episode.stimulation_required,
      caffeineCitrateActive: Boolean(episode.caffeine_citrate_active),
      caffeineLoadingDoseMgKg: episode.caffeine_loading_dose_mg_kg,
      caffeineMaintenanceDoseMgKgDay: episode.caffeine_maintenance_dose_mg_kg_day,
      serumCaffeineLevelMcgMl: episode.serum_caffeine_level_mcg_ml ?? undefined,
      secondaryCausesExcluded: Boolean(episode.secondary_causes_excluded),
      respiratorySupportMode: episode.respiratory_support_mode,
      cpapPeepCmh2o: episode.cpap_peep_cmh2o ?? undefined,
      apneaFreeDaysCount: episode.apnea_free_days_count,
    });

    return {
      episode: {
        ...episode,
        bradycardia_present: Boolean(episode.bradycardia_present),
        desaturation_present: Boolean(episode.desaturation_present),
        caffeine_citrate_active: Boolean(episode.caffeine_citrate_active),
        secondary_causes_excluded: Boolean(episode.secondary_causes_excluded),
        weaning_eligible: Boolean(episode.weaning_eligible),
      },
      evaluation,
      flowsheet: flowsheet.map(f => ({
        ...f,
        caffeine_toxicity_signs: Boolean(f.caffeine_toxicity_signs),
      })),
    };
  });

  // 4. Create AOP Episode
  app.post('/api/neonatal-aop/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalAop(req);
    const data = parse(neonatalAopEpisodeSchema, req.body);

    const evaluation = evaluateNeonatalAop({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      chronologicalAgeDays: data.chronologicalAgeDays,
      postConceptionalAgeWeeks: data.postConceptionalAgeWeeks ?? undefined,
      currentWeightKg: data.currentWeightKg,
      apneaSubtype: data.apneaSubtype,
      apneaFrequencyPer24h: data.apneaFrequencyPer24h,
      lowestHeartRateBpm: data.lowestHeartRateBpm ?? undefined,
      lowestSpo2Percent: data.lowestSpo2Percent ?? undefined,
      stimulationRequired: data.stimulationRequired,
      caffeineCitrateActive: data.caffeineCitrateActive,
      caffeineLoadingDoseMgKg: data.caffeineLoadingDoseMgKg,
      caffeineMaintenanceDoseMgKgDay: data.caffeineMaintenanceDoseMgKgDay,
      serumCaffeineLevelMcgMl: data.serumCaffeineLevelMcgMl ?? undefined,
      secondaryCausesExcluded: data.secondaryCausesExcluded,
      respiratorySupportMode: data.respiratorySupportMode,
      cpapPeepCmh2o: data.cpapPeepCmh2o ?? undefined,
      apneaFreeDaysCount: data.apneaFreeDaysCount,
    });

    const dateStr = data.onsetDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `AOP-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO neonatal_aop_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        gestational_age_weeks, chronological_age_days, post_conceptional_age_weeks,
        current_weight_kg, apnea_subtype, apnea_frequency_per_24h,
        bradycardia_present, lowest_heart_rate_bpm, desaturation_present,
        lowest_spo2_percent, stimulation_required,
        caffeine_citrate_active, caffeine_loading_dose_mg_kg, caffeine_maintenance_dose_mg_kg_day,
        serum_caffeine_level_mcg_ml, secondary_causes_excluded,
        respiratory_support_mode, cpap_peep_cmh2o,
        weaning_eligible, apnea_free_days_count,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.chronologicalAgeDays,
      evaluation.postConceptionalAgeWeeks,
      data.currentWeightKg,
      data.apneaSubtype,
      data.apneaFrequencyPer24h,
      data.bradycardiaPresent ? 1 : 0,
      data.lowestHeartRateBpm ?? null,
      data.desaturationPresent ? 1 : 0,
      data.lowestSpo2Percent ?? null,
      data.stimulationRequired,
      data.caffeineCitrateActive ? 1 : 0,
      data.caffeineLoadingDoseMgKg,
      data.caffeineMaintenanceDoseMgKgDay,
      data.serumCaffeineLevelMcgMl ?? null,
      data.secondaryCausesExcluded ? 1 : 0,
      data.respiratorySupportMode,
      data.cpapPeepCmh2o ?? null,
      evaluation.weaningEligibility.eligible ? 1 : 0,
      data.apneaFreeDaysCount,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_aop.create',
      entity: 'neonatal_aop_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, pca: evaluation.postConceptionalAgeWeeks, severity: evaluation.apneaSeverityTier },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status & Weaning Parameters
  app.patch('/api/neonatal-aop/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalAop(req);
    const { id } = req.params as { id: string };
    const {
      status,
      apneaFreeDaysCount,
      caffeineCitrateActive,
      serumCaffeineLevelMcgMl,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'active_treatment',
      'dose_escalation_refractory',
      'weaning_phase',
      'caffeine_discontinued_monitoring',
      'resolved_discharged',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE neonatal_aop_episodes
      SET status = COALESCE(?, status),
          apnea_free_days_count = COALESCE(?, apnea_free_days_count),
          caffeine_citrate_active = CASE WHEN ? IS NOT NULL THEN ? ELSE caffeine_citrate_active END,
          serum_caffeine_level_mcg_ml = COALESCE(?, serum_caffeine_level_mcg_ml),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      apneaFreeDaysCount ?? null,
      caffeineCitrateActive !== undefined ? (caffeineCitrateActive ? 1 : 0) : null,
      caffeineCitrateActive !== undefined ? (caffeineCitrateActive ? 1 : 0) : null,
      serumCaffeineLevelMcgMl ?? null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_aop.status_update',
      entity: 'neonatal_aop_episodes',
      entityId: Number(id),
      detail: { status },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/neonatal-aop/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_aop_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.aop_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return {
      logs: rows.map(r => ({
        ...r,
        caffeine_toxicity_signs: Boolean(r.caffeine_toxicity_signs),
      })),
    };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-aop/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalAop(req);
    const { id } = req.params as { id: string };
    const data = parse(aopFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM neonatal_aop_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal AOP episode not found');

    const res = db.prepare(`
      INSERT INTO neonatal_aop_flowsheet_logs (
        aop_episode_id, patient_id, log_datetime,
        apnea_events_count_in_shift, bradycardia_events_count, desaturation_events_count,
        lowest_heart_rate_bpm, lowest_spo2_percent, stimulation_mode_used,
        caffeine_dose_given_mg, current_respiratory_support, caffeine_toxicity_signs,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.apneaEventsCountInShift,
      data.bradycardiaEventsCount,
      data.desaturationEventsCount,
      data.lowestHeartRateBpm ?? null,
      data.lowestSpo2Percent ?? null,
      data.stimulationModeUsed ?? null,
      data.caffeineDoseGivenMg ?? null,
      data.currentRespiratorySupport ?? null,
      data.caffeineToxicitySigns ? 1 : 0,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_aop.flowsheet_add',
      entity: 'neonatal_aop_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), apneaEvents: data.apneaEventsCountInShift },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-aop/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalAop(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM neonatal_aop_flowsheet_logs
      WHERE id = ? AND aop_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_aop_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_aop.flowsheet_delete',
      entity: 'neonatal_aop_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
