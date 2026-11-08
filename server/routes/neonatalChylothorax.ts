import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateDrainageRateMlKgDay,
  evaluateNeonatalChylothorax,
  type EffusionLaterality,
  type ChylothoraxEtiology,
  type DietaryRegimen,
} from '../../web/src/neonatalChylothoraxEngine.js';

function assertCanManageNeonatalChylothorax(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal chylothorax records');
  }
  return user;
}

export const neonatalChylothoraxEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDatetime: z.string().min(1, 'Diagnosis datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6500),
  chronologicalAgeDays: z.number().int().min(0).max(180),
  currentWeightKg: z.number().min(0.3).max(15.0),
  effusionLaterality: z.enum(['unilateral_right', 'unilateral_left', 'bilateral']),
  etiology: z.enum([
    'congenital_idiopathic',
    'post_cardiothoracic_surgery',
    'genetic_turner_noonan_trisomy21',
    'central_venous_thrombosis',
    'congenital_lymphangiomatosis',
  ]),

  pleuralTriglyceridesMgDl: z.number().min(0).max(2500).nullable().optional(),
  pleuralTotalCellsPerMicroliter: z.number().int().min(0).max(100000).nullable().optional(),
  pleuralLymphocytePercent: z.number().min(0).max(100).nullable().optional(),
  pleuralCholesterolMgDl: z.number().min(0).max(1000).nullable().optional(),
  chylomicronPresence: z.boolean().default(false),

  chestTubeInserted: z.boolean().default(true),
  initial24hDrainageMl: z.number().min(0).max(2000),
  dietaryRegimen: z.enum([
    'nil_by_mouth_tpn',
    'exclusive_mct_formula',
    'mct_supplemented_breast_milk',
    'unrestricted_breast_milk_formula',
  ]).default('nil_by_mouth_tpn'),
  octreotidePrescribed: z.boolean().default(false),
  octreotideCurrentDoseMcgKgHr: z.number().min(0).max(15.0).default(0),
  chemicalPleurodesisPerformed: z.boolean().default(false),
  surgicalLigationIndicated: z.boolean().default(false),

  status: z.enum([
    'acute_chest_tube_drainage',
    'octreotide_titration',
    'dietary_mct_transition',
    'resolved_tube_removed',
    'refractory_surgical_referral',
  ]).default('acute_chest_tube_drainage'),
  clinicalNotes: z.string().nullable().optional(),
});

export const neonatalChylothoraxFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  daysFromDiagnosis: z.number().int().min(0).default(0),
  drainage24hMl: z.number().min(0).max(2000),
  octreotideDoseMcgKgHr: z.number().min(0).max(15.0).default(0),
  bloodGlucoseMgDl: z.number().min(20).max(600).nullable().optional(),
  serumSodiumMmolL: z.number().min(100).max(180).nullable().optional(),
  fluidAppearance: z.enum([
    'milky_chylous',
    'serosanguinous',
    'straw_colored_serous',
    'clear',
  ]),
  notes: z.string().nullable().optional(),
});

export function registerNeonatalChylothoraxRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/neonatal-chylothorax/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(neonatalChylothoraxEpisodeSchema.partial(), req.body);

    const evalResult = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? 38,
      birthWeightGrams: data.birthWeightGrams ?? 3000,
      chronologicalAgeDays: data.chronologicalAgeDays ?? 5,
      currentWeightKg: data.currentWeightKg ?? 3.0,
      effusionLaterality: (data.effusionLaterality as EffusionLaterality) ?? 'unilateral_right',
      etiology: (data.etiology as ChylothoraxEtiology) ?? 'congenital_idiopathic',
      pleuralTriglyceridesMgDl: data.pleuralTriglyceridesMgDl ?? undefined,
      pleuralTotalCellsPerMicroliter: data.pleuralTotalCellsPerMicroliter ?? undefined,
      pleuralLymphocytePercent: data.pleuralLymphocytePercent ?? undefined,
      pleuralCholesterolMgDl: data.pleuralCholesterolMgDl ?? undefined,
      chylomicronPresence: data.chylomicronPresence ?? false,
      chestTubeInserted: data.chestTubeInserted ?? true,
      initial24hDrainageMl: data.initial24hDrainageMl ?? 45.0,
      dietaryRegimen: (data.dietaryRegimen as DietaryRegimen) ?? 'nil_by_mouth_tpn',
      octreotidePrescribed: data.octreotidePrescribed ?? false,
      octreotideCurrentDoseMcgKgHr: data.octreotideCurrentDoseMcgKgHr ?? 0,
      chemicalPleurodesisPerformed: data.chemicalPleurodesisPerformed ?? false,
      surgicalLigationIndicated: data.surgicalLigationIndicated ?? false,
    });

    return { evalResult };
  });

  // 2. List Episodes for a Patient or All Active
  app.get('/api/neonatal-chylothorax/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let sql = `
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM neonatal_chylothorax_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      sql += ' AND e.patient_id = ?';
      params.push(patientId);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.created_at DESC';
    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 3. Create Episode
  app.post('/api/neonatal-chylothorax/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalChylothorax(req);
    const data = parse(neonatalChylothoraxEpisodeSchema, req.body);

    const drainageRate = calculateDrainageRateMlKgDay(data.initial24hDrainageMl, data.currentWeightKg);

    const evalResult = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      chronologicalAgeDays: data.chronologicalAgeDays,
      currentWeightKg: data.currentWeightKg,
      effusionLaterality: data.effusionLaterality,
      etiology: data.etiology,
      pleuralTriglyceridesMgDl: data.pleuralTriglyceridesMgDl ?? undefined,
      pleuralTotalCellsPerMicroliter: data.pleuralTotalCellsPerMicroliter ?? undefined,
      pleuralLymphocytePercent: data.pleuralLymphocytePercent ?? undefined,
      pleuralCholesterolMgDl: data.pleuralCholesterolMgDl ?? undefined,
      chylomicronPresence: data.chylomicronPresence,
      chestTubeInserted: data.chestTubeInserted,
      initial24hDrainageMl: data.initial24hDrainageMl,
      dietaryRegimen: data.dietaryRegimen,
      octreotidePrescribed: data.octreotidePrescribed,
      octreotideCurrentDoseMcgKgHr: data.octreotideCurrentDoseMcgKgHr,
      chemicalPleurodesisPerformed: data.chemicalPleurodesisPerformed,
      surgicalLigationIndicated: data.surgicalLigationIndicated,
    });

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const episodeCode = `CHYLO-${timestamp}-${randomSuffix}`;

    const res = db.prepare(`
      INSERT INTO neonatal_chylothorax_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestational_age_weeks, birth_weight_grams, chronological_age_days, current_weight_kg,
        effusion_laterality, etiology,
        pleural_triglycerides_mg_dl, pleural_total_cells_per_microliter,
        pleural_lymphocyte_percent, pleural_cholesterol_mg_dl, chylomicron_presence,
        chest_tube_inserted, initial_24h_drainage_ml, drainage_ml_kg_day,
        dietary_regimen, octreotide_prescribed, octreotide_current_dose_mcg_kg_hr,
        chemical_pleurodesis_performed, surgical_ligation_indicated,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.chronologicalAgeDays,
      data.currentWeightKg,
      data.effusionLaterality,
      data.etiology,
      data.pleuralTriglyceridesMgDl ?? null,
      data.pleuralTotalCellsPerMicroliter ?? null,
      data.pleuralLymphocytePercent ?? null,
      data.pleuralCholesterolMgDl ?? null,
      data.chylomicronPresence ? 1 : 0,
      data.chestTubeInserted ? 1 : 0,
      data.initial24hDrainageMl,
      drainageRate,
      data.dietaryRegimen,
      data.octreotidePrescribed ? 1 : 0,
      data.octreotideCurrentDoseMcgKgHr,
      data.chemicalPleurodesisPerformed ? 1 : 0,
      data.surgicalLigationIndicated ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_chylothorax.create',
      entity: 'neonatal_chylothorax_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, drainageRate, status: data.status },
    });

    const episode = db.prepare('SELECT * FROM neonatal_chylothorax_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 4. Retrieve Single Episode with Flowsheet Logs & Calculation
  app.get('/api/neonatal-chylothorax/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM neonatal_chylothorax_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Neonatal chylothorax episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_chylothorax_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.chylothorax_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(id);

    const evalResult = evaluateNeonatalChylothorax({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      chronologicalAgeDays: episode.chronological_age_days,
      currentWeightKg: episode.current_weight_kg,
      effusionLaterality: episode.effusion_laterality,
      etiology: episode.etiology,
      pleuralTriglyceridesMgDl: episode.pleural_triglycerides_mg_dl ?? undefined,
      pleuralTotalCellsPerMicroliter: episode.pleural_total_cells_per_microliter ?? undefined,
      pleuralLymphocytePercent: episode.pleural_lymphocyte_percent ?? undefined,
      pleuralCholesterolMgDl: episode.pleural_cholesterol_mg_dl ?? undefined,
      chylomicronPresence: episode.chylomicron_presence === 1,
      chestTubeInserted: episode.chest_tube_inserted === 1,
      initial24hDrainageMl: episode.initial_24h_drainage_ml,
      dietaryRegimen: episode.dietary_regimen,
      octreotidePrescribed: episode.octreotide_prescribed === 1,
      octreotideCurrentDoseMcgKgHr: episode.octreotide_current_dose_mcg_kg_hr,
      chemicalPleurodesisPerformed: episode.chemical_pleurodesis_performed === 1,
      surgicalLigationIndicated: episode.surgical_ligation_indicated === 1,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-chylothorax/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalChylothorax(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM neonatal_chylothorax_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal chylothorax episode not found');

    const data = parse(neonatalChylothoraxEpisodeSchema.partial(), req.body);

    const initialDrainage = data.initial24hDrainageMl ?? existing.initial_24h_drainage_ml;
    const currentWeight = data.currentWeightKg ?? existing.current_weight_kg;
    const drainageRate = calculateDrainageRateMlKgDay(initialDrainage, currentWeight);

    db.prepare(`
      UPDATE neonatal_chylothorax_episodes
      SET
        current_weight_kg = COALESCE(?, current_weight_kg),
        dietary_regimen = COALESCE(?, dietary_regimen),
        octreotide_prescribed = COALESCE(?, octreotide_prescribed),
        octreotide_current_dose_mcg_kg_hr = COALESCE(?, octreotide_current_dose_mcg_kg_hr),
        chemical_pleurodesis_performed = COALESCE(?, chemical_pleurodesis_performed),
        surgical_ligation_indicated = COALESCE(?, surgical_ligation_indicated),
        drainage_ml_kg_day = ?,
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.currentWeightKg ?? null,
      data.dietaryRegimen ?? null,
      data.octreotidePrescribed !== undefined ? (data.octreotidePrescribed ? 1 : 0) : null,
      data.octreotideCurrentDoseMcgKgHr ?? null,
      data.chemicalPleurodesisPerformed !== undefined ? (data.chemicalPleurodesisPerformed ? 1 : 0) : null,
      data.surgicalLigationIndicated !== undefined ? (data.surgicalLigationIndicated ? 1 : 0) : null,
      drainageRate,
      data.status ?? null,
      data.clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_chylothorax.update',
      entity: 'neonatal_chylothorax_episodes',
      entityId: Number(id),
      detail: { updatedFields: Object.keys(data) },
    });

    const episode = db.prepare('SELECT * FROM neonatal_chylothorax_episodes WHERE id = ?').get(id);
    return { episode };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-chylothorax/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalChylothorax(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM neonatal_chylothorax_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal chylothorax episode not found');

    db.prepare('DELETE FROM neonatal_chylothorax_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_chylothorax.delete',
      entity: 'neonatal_chylothorax_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-chylothorax/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalChylothorax(req);
    const { id } = req.params as { id: string };

    const episode = db.prepare('SELECT * FROM neonatal_chylothorax_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal chylothorax episode not found');

    const data = parse(neonatalChylothoraxFlowsheetSchema, req.body);
    const drainageRate = calculateDrainageRateMlKgDay(data.drainage24hMl, episode.current_weight_kg);

    const res = db.prepare(`
      INSERT INTO neonatal_chylothorax_flowsheet_logs (
        chylothorax_episode_id, patient_id, log_datetime, days_from_diagnosis,
        drainage_24h_ml, drainage_ml_kg_day, octreotide_dose_mcg_kg_hr,
        blood_glucose_mg_dl, serum_sodium_mmol_l, fluid_appearance,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.daysFromDiagnosis,
      data.drainage24hMl,
      drainageRate,
      data.octreotideDoseMcgKgHr,
      data.bloodGlucoseMgDl ?? null,
      data.serumSodiumMmolL ?? null,
      data.fluidAppearance,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_chylothorax.flowsheet_add',
      entity: 'neonatal_chylothorax_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), drainageRate, appearance: data.fluidAppearance },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-chylothorax/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalChylothorax(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM neonatal_chylothorax_flowsheet_logs
      WHERE id = ? AND chylothorax_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_chylothorax_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_chylothorax.flowsheet_delete',
      entity: 'neonatal_chylothorax_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
