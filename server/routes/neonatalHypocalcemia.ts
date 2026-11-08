import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateCalciumGluconateBolus,
  calculateCalciumMaintenance,
  calculateMagnesiumBolus,
  evaluateNeonatalHypocalcemia,
  type HypocalcemiaEtiology,
  type NeonatalSymptomDetails,
} from '../../web/src/neonatalHypocalcemiaEngine.js';

function assertCanManageNeonatalHypocalcemia(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical neonatologists, pediatricians, and NICU nurses can manage neonatal hypocalcemia records');
  }
  return user;
}

export const neonatalHypocalcemiaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDatetime: z.string().min(1, 'Diagnosis datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6000),
  chronologicalAgeHours: z.number().int().min(0).max(720),
  currentWeightKg: z.number().min(0.3).max(10.0),
  etiologyCategory: z.enum([
    'prematurity_respiratory_distress',
    'infant_of_diabetic_mother_idm',
    'birth_asphyxia_hie',
    'maternal_hyperparathyroidism',
    'hypoparathyroidism_digeorge',
    'high_phosphate_formula',
    'hypomagnesemia_induced',
    'idiopathic_other',
  ]),

  ionizedCalciumMmolL: z.number().min(0.2).max(2.5),
  totalCalciumMgDl: z.number().min(2.0).max(18.0),
  serumMagnesiumMgDl: z.number().min(0.2).max(5.0),
  serumPhosphorusMgDl: z.number().min(0.5).max(15.0).nullable().optional(),
  serumAlbuminGDl: z.number().min(0.5).max(6.0).nullable().optional(),
  alkalinePhosphataseUL: z.number().min(10).max(2000).nullable().optional(),

  symptomsPresent: z.boolean().default(false),
  symptomDetails: z.enum([
    'asymptomatic',
    'jitteriness_hyperreflexia',
    'tetany_carpopedal_spasm',
    'hypocalcemic_seizures',
    'apnea_cyanosis',
    'lethargy_poor_feeding',
  ]).default('asymptomatic'),
  ecgQtcSeconds: z.number().min(0.2).max(0.8).nullable().optional(),

  status: z.enum([
    'acute_iv_correction',
    'maintenance_infusion_weaning',
    'transitioned_to_oral_supplements',
    'eucalcemic_resolved',
  ]).default('acute_iv_correction'),
  clinicalNotes: z.string().nullable().optional(),
});

export const neonatalHypocalcemiaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromInitiation: z.number().min(0).default(0),
  heartRateBpm: z.number().int().min(40).max(250),
  ionizedCalciumMmolL: z.number().min(0.2).max(2.5),
  totalCalciumMgDl: z.number().min(2.0).max(18.0).nullable().optional(),
  serumMagnesiumMgDl: z.number().min(0.2).max(5.0).nullable().optional(),
  calciumInfusionRateMlHr: z.number().min(0).max(20).default(0),
  ivSiteCondition: z.enum([
    'patent_no_extravasation',
    'mild_erythema_monitored',
    'extravasation_infusion_stopped',
  ]),
  clinicalNeuromuscularState: z.enum([
    'normal_tone_calm',
    'mild_tremor_on_handling',
    'marked_jitteriness',
    'active_seizure',
  ]),
  ecgRhythmStrip: z.enum([
    'normal_sinus_rhythm',
    'sinus_bradycardia',
    'qtc_prolongation_improving',
    'arrhythmia_noted',
  ]),
  notes: z.string().nullable().optional(),
});

export function registerNeonatalHypocalcemiaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Hypocalcemia Evaluation Preview
  app.post('/api/neonatal-hypocalcemia/evaluate', async (req) => {
    assertCanManageNeonatalHypocalcemia(req);
    const body = req.body as Partial<z.infer<typeof neonatalHypocalcemiaEpisodeSchema>>;

    const evalResult = evaluateNeonatalHypocalcemia({
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? 30,
      birthWeightGrams: body.birthWeightGrams ?? 1200,
      chronologicalAgeHours: body.chronologicalAgeHours ?? 24,
      currentWeightKg: body.currentWeightKg ?? 1.2,
      etiologyCategory: (body.etiologyCategory as HypocalcemiaEtiology) ?? 'prematurity_respiratory_distress',
      ionizedCalciumMmolL: body.ionizedCalciumMmolL ?? 0.85,
      totalCalciumMgDl: body.totalCalciumMgDl ?? 6.5,
      serumMagnesiumMgDl: body.serumMagnesiumMgDl ?? 1.4,
      serumPhosphorusMgDl: body.serumPhosphorusMgDl ?? undefined,
      serumAlbuminGDl: body.serumAlbuminGDl ?? undefined,
      symptomsPresent: body.symptomsPresent ?? false,
      symptomDetails: (body.symptomDetails as NeonatalSymptomDetails) ?? 'asymptomatic',
      ecgQtcSeconds: body.ecgQtcSeconds ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create Neonatal Hypocalcemia Episode
  app.post('/api/neonatal-hypocalcemia/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalHypocalcemia(req);
    const data = parse(neonatalHypocalcemiaEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateNeonatalHypocalcemia({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      chronologicalAgeHours: data.chronologicalAgeHours,
      currentWeightKg: data.currentWeightKg,
      etiologyCategory: data.etiologyCategory,
      ionizedCalciumMmolL: data.ionizedCalciumMmolL,
      totalCalciumMgDl: data.totalCalciumMgDl,
      serumMagnesiumMgDl: data.serumMagnesiumMgDl,
      serumPhosphorusMgDl: data.serumPhosphorusMgDl ?? undefined,
      serumAlbuminGDl: data.serumAlbuminGDl ?? undefined,
      alkalinePhosphataseUL: data.alkalinePhosphataseUL ?? undefined,
      symptomsPresent: data.symptomsPresent,
      symptomDetails: data.symptomDetails,
      ecgQtcSeconds: data.ecgQtcSeconds ?? undefined,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `HYPOCAL-${todayCode}-${rand}`;

    const onsetTiming = data.chronologicalAgeHours <= 72 ? 'early_onset_le_72h' : 'late_onset_gt_72h';
    const ecgProlonged = data.ecgQtcSeconds ? (data.ecgQtcSeconds > 0.44 ? 1 : 0) : 0;

    const stmt = db.prepare(`
      INSERT INTO neonatal_hypocalcemia_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestational_age_weeks, birth_weight_grams, chronological_age_hours, onset_timing,
        etiology_category, ionized_calcium_mmol_l, total_calcium_mg_dl,
        serum_magnesium_mg_dl, serum_phosphorus_mg_dl, serum_albumin_g_dl, alkaline_phosphatase_u_l,
        symptoms_present, symptom_details, ecg_qtc_seconds, ecg_prolonged_qtc,
        emergency_bolus_indicated, calcium_gluconate_10pct_bolus_ml,
        calcium_gluconate_maintenance_mg_kg_day, concurrent_hypomagnesemia,
        magnesium_sulfate_50pct_dose_ml, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.chronologicalAgeHours,
      onsetTiming,
      data.etiologyCategory,
      data.ionizedCalciumMmolL,
      data.totalCalciumMgDl,
      data.serumMagnesiumMgDl,
      data.serumPhosphorusMgDl ?? null,
      data.serumAlbuminGDl ?? null,
      data.alkalinePhosphataseUL ?? null,
      data.symptomsPresent ? 1 : 0,
      data.symptomDetails,
      data.ecgQtcSeconds ?? null,
      ecgProlonged,
      evalResult.emergencyBolusIndicated ? 1 : 0,
      evalResult.calciumGluconate10pctBolusMl,
      evalResult.calciumGluconateMaintenanceMgKgDay,
      evalResult.concurrentHypomagnesemia ? 1 : 0,
      evalResult.magnesiumSulfate50pctDoseMl ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypocalcemia.episode_create',
      entity: 'neonatal_hypocalcemia_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, iCa: data.ionizedCalciumMmolL },
    });

    const episode = db.prepare('SELECT * FROM neonatal_hypocalcemia_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/neonatal-hypocalcemia/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const q = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name as patient_name, p.patient_number, p.date_of_birth, u.full_name as consultant_name
      FROM neonatal_hypocalcemia_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q.patientId) {
      query += ' AND e.patient_id = ?';
      params.push(Number(q.patientId));
    }
    if (q.status && q.status !== 'all') {
      query += ' AND e.status = ?';
      params.push(q.status);
    }
    query += ' ORDER BY e.created_at DESC';

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail
  app.get('/api/neonatal-hypocalcemia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, p.patient_number, p.date_of_birth, u.full_name as consultant_name
      FROM neonatal_hypocalcemia_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal hypocalcemia episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_hypocalcemia_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.hypocalcemia_episode_id = ?
      ORDER BY l.hours_from_initiation ASC, l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateNeonatalHypocalcemia({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      chronologicalAgeHours: episode.chronological_age_hours,
      currentWeightKg: (episode.birth_weight_grams / 1000) || 1.5,
      etiologyCategory: episode.etiology_category,
      ionizedCalciumMmolL: episode.ionized_calcium_mmol_l,
      totalCalciumMgDl: episode.total_calcium_mg_dl,
      serumMagnesiumMgDl: episode.serum_magnesium_mg_dl,
      serumPhosphorusMgDl: episode.serum_phosphorus_mg_dl ?? undefined,
      serumAlbuminGDl: episode.serum_albumin_g_dl ?? undefined,
      symptomsPresent: Boolean(episode.symptoms_present),
      symptomDetails: episode.symptom_details,
      ecgQtcSeconds: episode.ecg_qtc_seconds ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-hypocalcemia/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalHypocalcemia(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM neonatal_hypocalcemia_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal hypocalcemia episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE neonatal_hypocalcemia_episodes
      SET status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypocalcemia.episode_update',
      entity: 'neonatal_hypocalcemia_episodes',
      entityId: Number(id),
      detail: { nextStatus },
    });

    const updated = db.prepare('SELECT * FROM neonatal_hypocalcemia_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-hypocalcemia/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete neonatal hypocalcemia episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM neonatal_hypocalcemia_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal hypocalcemia episode not found');

    db.prepare('DELETE FROM neonatal_hypocalcemia_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypocalcemia.episode_delete',
      entity: 'neonatal_hypocalcemia_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-hypocalcemia/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalHypocalcemia(req);
    const { id } = req.params as { id: string };
    const data = parse(neonatalHypocalcemiaFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM neonatal_hypocalcemia_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal hypocalcemia episode not found');

    const stmt = db.prepare(`
      INSERT INTO neonatal_hypocalcemia_flowsheet_logs (
        hypocalcemia_episode_id, patient_id, log_datetime, hours_from_initiation,
        heart_rate_bpm, ionized_calcium_mmol_l, total_calcium_mg_dl, serum_magnesium_mg_dl,
        calcium_infusion_rate_ml_hr, iv_site_condition, clinical_neuromuscular_state,
        ecg_rhythm_strip, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromInitiation,
      data.heartRateBpm,
      data.ionizedCalciumMmolL,
      data.totalCalciumMgDl ?? null,
      data.serumMagnesiumMgDl ?? null,
      data.calciumInfusionRateMlHr,
      data.ivSiteCondition,
      data.clinicalNeuromuscularState,
      data.ecgRhythmStrip,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypocalcemia.flowsheet_create',
      entity: 'neonatal_hypocalcemia_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), iCa: data.ionizedCalciumMmolL, hr: data.heartRateBpm },
    });

    reply.status(201);
    return { logId };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-hypocalcemia/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete flowsheet logs');
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM neonatal_hypocalcemia_flowsheet_logs WHERE id = ? AND hypocalcemia_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_hypocalcemia_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypocalcemia.flowsheet_delete',
      entity: 'neonatal_hypocalcemia_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
