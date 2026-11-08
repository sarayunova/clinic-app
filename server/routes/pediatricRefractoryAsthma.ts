import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricRefractoryAsthma,
  type VentilatorySupportMode,
  type HelioxMixtureRatio,
} from '../../web/src/pediatricRefractoryAsthmaEngine.js';

function assertCanManageRefractoryAsthma(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric refractory asthma protocols');
  }
  return user;
}

const refractoryAsthmaEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.1).max(18.0),
  weightKg: z.coerce.number().min(2.0).max(120.0),
  initialPediatricAsthmaScore: z.coerce.number().int().min(0).max(12).default(9),
  respiratoryRate: z.coerce.number().int().min(10).max(120),
  heartRateBpm: z.coerce.number().int().min(40).max(250),
  spo2Percent: z.coerce.number().min(50.0).max(100.0),
  pco2Mmhg: z.coerce.number().min(15.0).max(120.0).default(40.0),
  phValue: z.coerce.number().min(6.8).max(7.8).default(7.35),
  silentChestOrExhaustion: z.boolean().default(false),
  refractoryToFirstLine: z.boolean().default(true),
  continuousIvTerbutalineActive: z.boolean().default(false),
  terbutalineDoseMcgKgMin: z.coerce.number().min(0.0).max(10.0).default(0.0),
  ivKetamineInfusionActive: z.boolean().default(false),
  ketamineDoseMgKgHr: z.coerce.number().min(0.0).max(5.0).default(0.0),
  helioxInhalationActive: z.boolean().default(false),
  helioxMixtureRatio: z.enum(['none', 'heliox_80_20', 'heliox_70_30']).default('none'),
  ivTheophyllineAminophyllineActive: z.boolean().default(false),
  ventilatorySupportMode: z.enum([
    'high_flow_nasal_cannula',
    'bipap_noninvasive_positive_pressure',
    'invasive_mechanical_ventilation_permissive_hypercapnia',
    'standard_low_flow_oxygen',
  ]).default('high_flow_nasal_cannula'),
  status: z.enum([
    'impending_respiratory_failure',
    'second_line_iv_bronchodilator_infusion',
    'bipap_noninvasive_support',
    'invasive_mechanical_ventilation_picu',
    'bronchospasm_relieving_weaning',
    'extubated_convalescent_stepdown',
    'resolved_transferred_to_ward',
  ]).default('impending_respiratory_failure'),
  clinicalNotes: z.string().optional().nullable(),
});

const refractoryAsthmaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromPicuAdmission: z.coerce.number().min(0.0).max(720.0),
  respiratoryRate: z.coerce.number().int().min(10).max(120),
  heartRateBpm: z.coerce.number().int().min(40).max(250),
  spo2Percent: z.coerce.number().min(50.0).max(100.0),
  pco2Mmhg: z.coerce.number().min(15.0).max(120.0),
  phValue: z.coerce.number().min(6.8).max(7.8),
  terbutalineInfusionRate: z.coerce.number().min(0.0).max(10.0).default(0.0),
  ketamineInfusionRate: z.coerce.number().min(0.0).max(5.0).default(0.0),
  inspiratoryExpiratoryRatio: z.string().default('1_to_3'),
  airEntryAuscultation: z.enum([
    'bilateral_good_clear',
    'mild_expiratory_wheeze',
    'severe_widespread_wheezing',
    'markedly_reduced_poor_air_movement',
    'silent_chest',
  ]),
  notes: z.string().optional().nullable(),
});

export function registerPediatricRefractoryAsthmaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview API (No DB Persistence)
  app.post('/api/pediatric-refractory-asthma/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const b = req.body as any;
    const evaluation = evaluatePediatricRefractoryAsthma({
      ageYears: Number(b.ageYears ?? 6.0),
      weightKg: Number(b.weightKg ?? 20.0),
      initialPediatricAsthmaScore: Number(b.initialPediatricAsthmaScore ?? 9),
      respiratoryRate: Number(b.respiratoryRate ?? 48),
      heartRateBpm: Number(b.heartRateBpm ?? 145),
      spo2Percent: Number(b.spo2Percent ?? 89.0),
      pco2Mmhg: Number(b.pco2Mmhg ?? 44.0),
      phValue: Number(b.phValue ?? 7.26),
      silentChestOrExhaustion: Boolean(b.silentChestOrExhaustion),
      refractoryToFirstLine: Boolean(b.refractoryToFirstLine ?? true),
      continuousIvTerbutalineActive: Boolean(b.continuousIvTerbutalineActive),
      terbutalineDoseMcgKgMin: Number(b.terbutalineDoseMcgKgMin ?? 0.0),
      ivKetamineInfusionActive: Boolean(b.ivKetamineInfusionActive),
      ketamineDoseMgKgHr: Number(b.ketamineDoseMgKgHr ?? 0.0),
      helioxInhalationActive: Boolean(b.helioxInhalationActive),
      helioxMixtureRatio: b.helioxMixtureRatio || 'none',
      ivTheophyllineAminophyllineActive: Boolean(b.ivTheophyllineAminophyllineActive),
      ventilatorySupportMode: b.ventilatorySupportMode || 'high_flow_nasal_cannula',
    });
    return { evaluation };
  });

  // 2. List Episodes (supports ?patientId= query or all)
  app.get('/api/pediatric-refractory-asthma/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM pediatric_refractory_asthma_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.onset_datetime DESC, e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM pediatric_refractory_asthma_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.onset_datetime DESC, e.created_at DESC
      `).all();
    }
    return { episodes };
  });

  // 2b. List Episodes for Patient (URL param compatibility)
  app.get('/api/pediatric-refractory-asthma/patient/:patientId', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const episodes = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM pediatric_refractory_asthma_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.patient_id = ?
      ORDER BY e.onset_datetime DESC, e.created_at DESC
    `).all(Number(patientId));
    return { episodes };
  });

  // 3. Get Single Episode with Flowsheet and Evaluation
  app.get('/api/pediatric-refractory-asthma/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM pediatric_refractory_asthma_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric refractory asthma episode not found');

    const flowsheet = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM pediatric_refractory_asthma_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.episode_id = ?
      ORDER BY f.hours_from_picu_admission ASC, f.created_at ASC
    `).all(Number(id));

    const evaluation = evaluatePediatricRefractoryAsthma({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      initialPediatricAsthmaScore: episode.initial_pediatric_asthma_score,
      respiratoryRate: episode.respiratory_rate,
      heartRateBpm: episode.heart_rate_bpm,
      spo2Percent: episode.spo2_percent,
      pco2Mmhg: episode.pco2_mmhg,
      phValue: episode.ph_value,
      silentChestOrExhaustion: Boolean(episode.silent_chest_or_exhaustion),
      refractoryToFirstLine: Boolean(episode.refractory_to_first_line),
      continuousIvTerbutalineActive: Boolean(episode.continuous_iv_terbutaline_active),
      terbutalineDoseMcgKgMin: episode.terbutaline_dose_mcg_kg_min,
      ivKetamineInfusionActive: Boolean(episode.iv_ketamine_infusion_active),
      ketamineDoseMgKgHr: episode.ketamine_dose_mg_kg_hr,
      helioxInhalationActive: Boolean(episode.heliox_inhalation_active),
      helioxMixtureRatio: episode.heliox_mixture_ratio,
      ivTheophyllineAminophyllineActive: Boolean(episode.iv_theophylline_aminophylline_active),
      ventilatorySupportMode: episode.ventilatory_support_mode,
    });

    return { episode, flowsheet, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-refractory-asthma/episodes', async (req, reply) => {
    const user = assertCanManageRefractoryAsthma(req);
    const data = parse(refractoryAsthmaEpisodeSchema, req.body);

    const codeSuffix = Math.floor(100 + Math.random() * 900);
    const episodeCode = `RAST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${codeSuffix}`;

    const result = db.prepare(`
      INSERT INTO pediatric_refractory_asthma_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        age_years, weight_kg, initial_pediatric_asthma_score,
        respiratory_rate, heart_rate_bpm, spo2_percent,
        pco2_mmhg, ph_value, silent_chest_or_exhaustion,
        refractory_to_first_line, continuous_iv_terbutaline_active,
        terbutaline_dose_mcg_kg_min, iv_ketamine_infusion_active,
        ketamine_dose_mg_kg_hr, heliox_inhalation_active,
        heliox_mixture_ratio, iv_theophylline_aminophylline_active,
        ventilatory_support_mode, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.initialPediatricAsthmaScore,
      data.respiratoryRate,
      data.heartRateBpm,
      data.spo2Percent,
      data.pco2Mmhg,
      data.phValue,
      data.silentChestOrExhaustion ? 1 : 0,
      data.refractoryToFirstLine ? 1 : 0,
      data.continuousIvTerbutalineActive ? 1 : 0,
      data.terbutalineDoseMcgKgMin,
      data.ivKetamineInfusionActive ? 1 : 0,
      data.ketamineDoseMgKgHr,
      data.helioxInhalationActive ? 1 : 0,
      data.helioxMixtureRatio,
      data.ivTheophyllineAminophyllineActive ? 1 : 0,
      data.ventilatorySupportMode,
      data.status,
      user.id,
      data.clinicalNotes ?? null
    );

    const created = db.prepare(`SELECT * FROM pediatric_refractory_asthma_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_refractory_asthma.create',
      entity: 'pediatric_refractory_asthma_episodes',
      entityId: created.id,
      detail: { patientId: data.patientId, episodeCode, status: data.status },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/pediatric-refractory-asthma/episodes/:id', async (req) => {
    const user = assertCanManageRefractoryAsthma(req);
    const { id } = req.params as { id: string };
    const data = parse(refractoryAsthmaEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_refractory_asthma_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric refractory asthma episode not found');

    db.prepare(`
      UPDATE pediatric_refractory_asthma_episodes SET
        initial_pediatric_asthma_score = ?,
        respiratory_rate = ?,
        heart_rate_bpm = ?,
        spo2_percent = ?,
        pco2_mmhg = ?,
        ph_value = ?,
        silent_chest_or_exhaustion = ?,
        refractory_to_first_line = ?,
        continuous_iv_terbutaline_active = ?,
        terbutaline_dose_mcg_kg_min = ?,
        iv_ketamine_infusion_active = ?,
        ketamine_dose_mg_kg_hr = ?,
        heliox_inhalation_active = ?,
        heliox_mixture_ratio = ?,
        iv_theophylline_aminophylline_active = ?,
        ventilatory_support_mode = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.initialPediatricAsthmaScore,
      data.respiratoryRate,
      data.heartRateBpm,
      data.spo2Percent,
      data.pco2Mmhg,
      data.phValue,
      data.silentChestOrExhaustion ? 1 : 0,
      data.refractoryToFirstLine ? 1 : 0,
      data.continuousIvTerbutalineActive ? 1 : 0,
      data.terbutalineDoseMcgKgMin,
      data.ivKetamineInfusionActive ? 1 : 0,
      data.ketamineDoseMgKgHr,
      data.helioxInhalationActive ? 1 : 0,
      data.helioxMixtureRatio,
      data.ivTheophyllineAminophyllineActive ? 1 : 0,
      data.ventilatorySupportMode,
      data.status,
      data.clinicalNotes ?? null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM pediatric_refractory_asthma_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_refractory_asthma.update',
      entity: 'pediatric_refractory_asthma_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status: data.status },
    });

    return { episode: updated };
  });

  // 6. Update Status Only
  app.patch('/api/pediatric-refractory-asthma/episodes/:id/status', async (req) => {
    const user = assertCanManageRefractoryAsthma(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({ status: z.string() }), req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_refractory_asthma_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric refractory asthma episode not found');

    db.prepare(`
      UPDATE pediatric_refractory_asthma_episodes SET
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    const updated = db.prepare(`SELECT * FROM pediatric_refractory_asthma_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_refractory_asthma.status_change',
      entity: 'pediatric_refractory_asthma_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), oldStatus: existing.status, newStatus: status },
    });

    return { episode: updated };
  });

  // 7. Delete Episode
  app.delete('/api/pediatric-refractory-asthma/episodes/:id', async (req) => {
    const user = assertCanManageRefractoryAsthma(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM pediatric_refractory_asthma_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric refractory asthma episode not found');

    db.prepare(`DELETE FROM pediatric_refractory_asthma_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_refractory_asthma.delete',
      entity: 'pediatric_refractory_asthma_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), code: existing.episode_code },
    });

    return { success: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/pediatric-refractory-asthma/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageRefractoryAsthma(req);
    const { id } = req.params as { id: string };
    const data = parse(refractoryAsthmaFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM pediatric_refractory_asthma_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric refractory asthma episode not found');

    const result = db.prepare(`
      INSERT INTO pediatric_refractory_asthma_flowsheet_logs (
        episode_id, patient_id, log_datetime, hours_from_picu_admission,
        respiratory_rate, heart_rate_bpm, spo2_percent, pco2_mmhg,
        ph_value, terbutaline_infusion_rate, ketamine_infusion_rate,
        inspiratory_expiratory_ratio, air_entry_auscultation, notes,
        logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromPicuAdmission,
      data.respiratoryRate,
      data.heartRateBpm,
      data.spo2Percent,
      data.pco2Mmhg,
      data.phValue,
      data.terbutalineInfusionRate,
      data.ketamineInfusionRate,
      data.inspiratoryExpiratoryRatio,
      data.airEntryAuscultation,
      data.notes ?? null,
      user.id
    );

    const created = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM pediatric_refractory_asthma_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.id = ?
    `).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_refractory_asthma.flowsheet_add',
      entity: 'pediatric_refractory_asthma_flowsheet_logs',
      entityId: created.id,
      detail: { episodeId: Number(id), pco2Mmhg: data.pco2Mmhg, spo2Percent: data.spo2Percent },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/pediatric-refractory-asthma/episodes/:id/flowsheet/:logId', async (req) => {
    const user = assertCanManageRefractoryAsthma(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare(`
      SELECT * FROM pediatric_refractory_asthma_flowsheet_logs
      WHERE id = ? AND episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM pediatric_refractory_asthma_flowsheet_logs WHERE id = ?`).run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_refractory_asthma.flowsheet_delete',
      entity: 'pediatric_refractory_asthma_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id), logId: Number(logId) },
    });

    return { success: true };
  });
}
