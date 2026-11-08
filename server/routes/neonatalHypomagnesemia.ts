import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateMagnesiumBolusDose,
  evaluateNeonatalHypomagnesemia,
  type NeuromuscularSymptom,
  type EcgAbnormality,
} from '../../web/src/neonatalHypomagnesemiaEngine.js';

function assertCanManageNeonatalHypomagnesemia(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal hypomagnesemia records');
  }
  return user;
}

export const neonatalHypomagnesemiaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  onsetDatetime: z.string().min(1, 'Onset datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6500),
  chronologicalAgeHours: z.number().int().min(0).max(720),
  currentWeightKg: z.number().min(0.3).max(10.0),

  serumMagnesiumMgDl: z.number().min(0.1).max(5.0),
  serumCalciumMgDl: z.number().min(1.0).max(18.0).nullable().optional(),
  ionizedCalciumMmolL: z.number().min(0.2).max(3.0).nullable().optional(),
  serumPotassiumMeqL: z.number().min(1.0).max(10.0).nullable().optional(),

  neuromuscularSymptoms: z.enum([
    'none_asymptomatic',
    'jitteriness_tremors',
    'hyperreflexia_clonus',
    'tetany_carpopedal',
    'clonic_seizures_refractory',
    'apnea_bradycardia',
  ]).default('none_asymptomatic'),
  seizuresObserved: z.boolean().default(false),
  calciumRefractoryTetany: z.boolean().default(false),
  ecgAbnormalities: z.enum([
    'none',
    'prolonged_pr_interval',
    'widened_qrs',
    'ventricular_arrhythmias_torsades',
    'sinus_bradycardia',
  ]).default('none'),
  renalImpairmentPresent: z.boolean().default(false),

  magnesiumSulfateBolusMl: z.number().min(0).max(10.0),
  administrationRoute: z.enum(['slow_iv_infusion', 'deep_intramuscular', 'oral_maintenance']).default('slow_iv_infusion'),
  continuousEcgMonitored: z.boolean().default(true),

  status: z.enum([
    'acute_resuscitation',
    'maintenance_infusion',
    'monitoring_stabilized',
    'resolved_eumagnesemic',
  ]).default('acute_resuscitation'),
  clinicalNotes: z.string().nullable().optional(),
});

export const neonatalHypomagnesemiaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromOnset: z.number().min(0).default(0),

  serumMagnesiumMgDl: z.number().min(0.1).max(10.0).nullable().optional(),
  ionizedCalciumMmolL: z.number().min(0.2).max(3.0).nullable().optional(),
  heartRateBpm: z.number().int().min(40).max(250),
  respiratoryRate: z.number().int().min(0).max(140),
  deepTendonReflexes: z.enum([
    'normal_2_plus',
    'brisk_3_plus_clonus',
    'diminished_1_plus',
    'absent_areflexia_toxicity',
  ]).default('normal_2_plus'),
  seizureActivityPresent: z.boolean().default(false),
  magnesiumInfusionRateMlHr: z.number().min(0).max(50.0).default(0),
  ecgRhythmStrip: z.enum([
    'normal_sinus',
    'sinus_bradycardia',
    'pr_prolongation',
    'heart_block',
    'arrhythmia',
  ]).default('normal_sinus'),
  toxicityWarning: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export function registerNeonatalHypomagnesemiaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/neonatal-hypomagnesemia/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(neonatalHypomagnesemiaEpisodeSchema.partial(), req.body);

    const evalResult = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? 39,
      birthWeightGrams: data.birthWeightGrams ?? 3200,
      chronologicalAgeHours: data.chronologicalAgeHours ?? 24,
      currentWeightKg: data.currentWeightKg ?? 3.2,
      serumMagnesiumMgDl: data.serumMagnesiumMgDl ?? 1.2,
      serumCalciumMgDl: data.serumCalciumMgDl ?? undefined,
      ionizedCalciumMmolL: data.ionizedCalciumMmolL ?? undefined,
      serumPotassiumMeqL: data.serumPotassiumMeqL ?? undefined,
      neuromuscularSymptoms: (data.neuromuscularSymptoms as NeuromuscularSymptom) ?? 'none_asymptomatic',
      seizuresObserved: data.seizuresObserved ?? false,
      calciumRefractoryTetany: data.calciumRefractoryTetany ?? false,
      ecgAbnormalities: (data.ecgAbnormalities as EcgAbnormality) ?? 'none',
      renalImpairmentPresent: data.renalImpairmentPresent ?? false,
    });

    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/neonatal-hypomagnesemia/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_hypomagnesemia_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND e.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status && status !== 'all') {
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.onset_datetime DESC';
    const episodes = db.prepare(query).all(...params);

    return { episodes };
  });

  // 3. Create Episode
  app.post('/api/neonatal-hypomagnesemia/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalHypomagnesemia(req);
    const data = parse(neonatalHypomagnesemiaEpisodeSchema, req.body);

    const evalResult = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      chronologicalAgeHours: data.chronologicalAgeHours,
      currentWeightKg: data.currentWeightKg,
      serumMagnesiumMgDl: data.serumMagnesiumMgDl,
      serumCalciumMgDl: data.serumCalciumMgDl ?? undefined,
      ionizedCalciumMmolL: data.ionizedCalciumMmolL ?? undefined,
      serumPotassiumMeqL: data.serumPotassiumMeqL ?? undefined,
      neuromuscularSymptoms: data.neuromuscularSymptoms as NeuromuscularSymptom,
      seizuresObserved: data.seizuresObserved,
      calciumRefractoryTetany: data.calciumRefractoryTetany,
      ecgAbnormalities: data.ecgAbnormalities as EcgAbnormality,
      renalImpairmentPresent: data.renalImpairmentPresent,
    });

    const episodeCode = `HYPOMAG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const res = db.prepare(`
      INSERT INTO neonatal_hypomagnesemia_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        gestational_age_weeks, birth_weight_grams, chronological_age_hours, current_weight_kg,
        serum_magnesium_mg_dl, serum_calcium_mg_dl, ionized_calcium_mmol_l, serum_potassium_meq_l,
        neuromuscular_symptoms, seizures_observed, calcium_refractory_tetany,
        ecg_abnormalities, renal_impairment_present,
        magnesium_sulfate_bolus_ml, administration_route, continuous_ecg_monitored,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.chronologicalAgeHours,
      data.currentWeightKg,
      data.serumMagnesiumMgDl,
      data.serumCalciumMgDl ?? null,
      data.ionizedCalciumMmolL ?? null,
      data.serumPotassiumMeqL ?? null,
      data.neuromuscularSymptoms,
      data.seizuresObserved ? 1 : 0,
      data.calciumRefractoryTetany ? 1 : 0,
      data.ecgAbnormalities,
      data.renalImpairmentPresent ? 1 : 0,
      data.magnesiumSulfateBolusMl,
      data.administrationRoute,
      data.continuousEcgMonitored ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypomagnesemia.create',
      entity: 'neonatal_hypomagnesemia_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, serumMg: data.serumMagnesiumMgDl, bolusMl: data.magnesiumSulfateBolusMl },
    });

    const created = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_hypomagnesemia_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(episodeId);

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 4. Get Episode Detail with Flowsheet and Live Evaluation
  app.get('/api/neonatal-hypomagnesemia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_hypomagnesemia_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal hypomagnesemia episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM neonatal_hypomagnesemia_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.hypomagnesemia_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateNeonatalHypomagnesemia({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      chronologicalAgeHours: episode.chronological_age_hours,
      currentWeightKg: episode.current_weight_kg,
      serumMagnesiumMgDl: episode.serum_magnesium_mg_dl,
      serumCalciumMgDl: episode.serum_calcium_mg_dl ?? undefined,
      ionizedCalciumMmolL: episode.ionized_calcium_mmol_l ?? undefined,
      serumPotassiumMeqL: episode.serum_potassium_meq_l ?? undefined,
      neuromuscularSymptoms: episode.neuromuscular_symptoms as NeuromuscularSymptom,
      seizuresObserved: Boolean(episode.seizures_observed),
      calciumRefractoryTetany: Boolean(episode.calcium_refractory_tetany),
      ecgAbnormalities: episode.ecg_abnormalities as EcgAbnormality,
      renalImpairmentPresent: Boolean(episode.renal_impairment_present),
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-hypomagnesemia/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalHypomagnesemia(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const existing = db.prepare('SELECT id FROM neonatal_hypomagnesemia_episodes WHERE id = ?').get(episodeId);
    if (!existing) throw notFound('Neonatal hypomagnesemia episode not found');

    const data = parse(neonatalHypomagnesemiaEpisodeSchema.partial(), req.body);

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }
    if (data.magnesiumSulfateBolusMl !== undefined) {
      fields.push('magnesium_sulfate_bolus_ml = ?');
      values.push(data.magnesiumSulfateBolusMl);
    }
    if (data.administrationRoute !== undefined) {
      fields.push('administration_route = ?');
      values.push(data.administrationRoute);
    }
    if (data.continuousEcgMonitored !== undefined) {
      fields.push('continuous_ecg_monitored = ?');
      values.push(data.continuousEcgMonitored ? 1 : 0);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(episodeId);
      db.prepare(`UPDATE neonatal_hypomagnesemia_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypomagnesemia.update',
      entity: 'neonatal_hypomagnesemia_episodes',
      entityId: episodeId,
      detail: { updatedFields: fields },
    });

    const updated = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_hypomagnesemia_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(episodeId);

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-hypomagnesemia/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalHypomagnesemia(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM neonatal_hypomagnesemia_episodes WHERE id = ?').get(episodeId) as any;
    if (!existing) throw notFound('Episode not found');

    db.prepare('DELETE FROM neonatal_hypomagnesemia_episodes WHERE id = ?').run(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypomagnesemia.delete',
      entity: 'neonatal_hypomagnesemia_episodes',
      entityId: episodeId,
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-hypomagnesemia/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalHypomagnesemia(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const episode = db.prepare('SELECT id, patient_id FROM neonatal_hypomagnesemia_episodes WHERE id = ?').get(episodeId) as any;
    if (!episode) throw notFound('Episode not found');

    const data = parse(neonatalHypomagnesemiaFlowsheetSchema, req.body);

    const res = db.prepare(`
      INSERT INTO neonatal_hypomagnesemia_flowsheet_logs (
        hypomagnesemia_episode_id, patient_id, log_datetime, hours_from_onset,
        serum_magnesium_mg_dl, ionized_calcium_mmol_l, heart_rate_bpm, respiratory_rate,
        deep_tendon_reflexes, seizure_activity_present, magnesium_infusion_rate_ml_hr,
        ecg_rhythm_strip, toxicity_warning, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      episodeId,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromOnset,
      data.serumMagnesiumMgDl ?? null,
      data.ionizedCalciumMmolL ?? null,
      data.heartRateBpm,
      data.respiratoryRate,
      data.deepTendonReflexes,
      data.seizureActivityPresent ? 1 : 0,
      data.magnesiumInfusionRateMlHr,
      data.ecgRhythmStrip,
      data.toxicityWarning ? 1 : 0,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypomagnesemia.flowsheet_log',
      entity: 'neonatal_hypomagnesemia_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, hr: data.heartRateBpm, dtr: data.deepTendonReflexes, toxicity: data.toxicityWarning },
    });

    reply.status(201);
    return { logId };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-hypomagnesemia/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalHypomagnesemia(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM neonatal_hypomagnesemia_flowsheet_logs WHERE id = ? AND hypomagnesemia_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_hypomagnesemia_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypomagnesemia.flowsheet_delete',
      entity: 'neonatal_hypomagnesemia_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
