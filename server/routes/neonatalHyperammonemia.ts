import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalHyperammonemia,
} from '../../web/src/neonatalHyperammonemiaEngine.js';

function assertCanManageHyperammonemia(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal hyperammonemia protocols');
  }
  return user;
}

const hyperammonemiaEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageHours: z.coerce.number().int().min(0).max(720),
  birthWeightGrams: z.coerce.number().int().min(400).max(6000),
  gestationalAgeWeeks: z.coerce.number().min(22.0).max(43.0),
  plasmaAmmoniaUmolL: z.coerce.number().min(10.0).max(3000.0),
  bloodGasAcidBasePattern: z.enum([
    'respiratory_alkalosis',
    'high_anion_gap_metabolic_acidosis',
    'normal_compensated',
    'mixed_acid_base',
  ]),
  plasmaLactateMmolL: z.coerce.number().min(0.2).max(30.0),
  anionGapMeqL: z.coerce.number().min(2.0).max(50.0),
  urineKetonesPresent: z.boolean().default(false),
  suspectedDisorderCategory: z.enum([
    'urea_cycle_disorder_ucd',
    'organic_acidemia_oa',
    'fatty_acid_oxidation_faod',
    'undifferentiated_hyperammonemia',
  ]),
  proteinIntakeHalted: z.boolean().default(true),
  highCalorieDextroseActive: z.boolean().default(true),
  girMgKgMin: z.coerce.number().min(4.0).max(25.0).default(10.0),
  nitrogenScavengerAmmonulActive: z.boolean().default(true),
  ivLArginineActive: z.boolean().default(true),
  ivLCarnitineActive: z.boolean().default(false),
  crrtDialysisIndicated: z.boolean().default(false),
  crrtDialysisActive: z.boolean().default(false),
  status: z.enum([
    'acute_hyperammonemic_crisis',
    'medical_scavenger_infusion',
    'emergency_crrt_hemodialysis',
    'catabolism_reversal_stabilization',
    'controlled_protein_reintroduction',
    'convalescent_metabolic_maintenance',
    'neonatal_demise',
  ]).default('acute_hyperammonemic_crisis'),
  clinicalNotes: z.string().optional().nullable(),
});

const hyperammonemiaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromCrisisOnset: z.coerce.number().min(0.0).max(720.0),
  plasmaAmmoniaUmolL: z.coerce.number().min(10.0).max(3000.0),
  phValue: z.coerce.number().min(6.8).max(7.8),
  pco2Mmhg: z.coerce.number().min(10.0).max(120.0),
  bicarbonateMeqL: z.coerce.number().min(2.0).max(50.0),
  glucoseMgDl: z.coerce.number().min(20.0).max(600.0),
  girMgKgMin: z.coerce.number().min(4.0).max(25.0),
  dialysisBloodFlowMlMin: z.coerce.number().min(0.0).max(100.0).default(0.0),
  encephalopathyGrade: z.enum([
    'grade_1_mild_lethargy_poor_feeding',
    'grade_2_moderate_somnolence_hyperreflexia',
    'grade_3_severe_stupor_decerebrate_posturing',
    'grade_4_deep_coma_fixed_dilated_pupils',
  ]),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalHyperammonemiaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/neonatal-hyperammonemia/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(hyperammonemiaEpisodeSchema.omit({ patientId: true }).partial({ onsetDatetime: true, status: true }), req.body);
    const evaluation = evaluateNeonatalHyperammonemia({
      ageHours: data.ageHours,
      birthWeightGrams: data.birthWeightGrams,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      plasmaAmmoniaUmolL: data.plasmaAmmoniaUmolL,
      bloodGasAcidBasePattern: data.bloodGasAcidBasePattern,
      plasmaLactateMmolL: data.plasmaLactateMmolL,
      anionGapMeqL: data.anionGapMeqL,
      urineKetonesPresent: data.urineKetonesPresent,
      suspectedDisorderCategory: data.suspectedDisorderCategory,
      proteinIntakeHalted: data.proteinIntakeHalted,
      highCalorieDextroseActive: data.highCalorieDextroseActive,
      girMgKgMin: data.girMgKgMin,
      nitrogenScavengerAmmonulActive: data.nitrogenScavengerAmmonulActive,
      ivLArginineActive: data.ivLArginineActive,
      ivLCarnitineActive: data.ivLCarnitineActive,
      crrtDialysisIndicated: data.crrtDialysisIndicated,
      crrtDialysisActive: data.crrtDialysisActive,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-hyperammonemia/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM neonatal_hyperammonemia_iem_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM neonatal_hyperammonemia_iem_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.created_at DESC
      `).all();
    }

    return { episodes };
  });

  // 3. Get Episode by ID
  app.get('/api/neonatal-hyperammonemia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM neonatal_hyperammonemia_iem_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal hyperammonemia episode not found');

    const flowsheet = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM neonatal_hyperammonemia_iem_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.episode_id = ?
      ORDER BY f.hours_from_crisis_onset ASC, f.created_at ASC
    `).all(Number(id));

    const evaluation = evaluateNeonatalHyperammonemia({
      ageHours: episode.age_hours,
      birthWeightGrams: episode.birth_weight_grams,
      gestationalAgeWeeks: episode.gestational_age_weeks,
      plasmaAmmoniaUmolL: episode.plasma_ammonia_umol_l,
      bloodGasAcidBasePattern: episode.blood_gas_acid_base_pattern,
      plasmaLactateMmolL: episode.plasma_lactate_mmol_l,
      anionGapMeqL: episode.anion_gap_meq_l,
      urineKetonesPresent: Boolean(episode.urine_ketones_present),
      suspectedDisorderCategory: episode.suspected_disorder_category,
      proteinIntakeHalted: Boolean(episode.protein_intake_halted),
      highCalorieDextroseActive: Boolean(episode.high_calorie_dextrose_active),
      girMgKgMin: episode.gir_mg_kg_min,
      nitrogenScavengerAmmonulActive: Boolean(episode.nitrogen_scavenger_ammonul_active),
      ivLArginineActive: Boolean(episode.iv_l_arginine_active),
      ivLCarnitineActive: Boolean(episode.iv_l_carnitine_active),
      crrtDialysisIndicated: Boolean(episode.crrt_dialysis_indicated),
      crrtDialysisActive: Boolean(episode.crrt_dialysis_active),
    });

    return { episode, flowsheet, evaluation };
  });

  // 4. Create Episode
  app.post('/api/neonatal-hyperammonemia/episodes', async (req, reply) => {
    const user = assertCanManageHyperammonemia(req);
    const data = parse(hyperammonemiaEpisodeSchema, req.body);

    const episodeCode = `IEM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;

    const result = db.prepare(`
      INSERT INTO neonatal_hyperammonemia_iem_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        age_hours, birth_weight_grams, gestational_age_weeks,
        plasma_ammonia_umol_l, blood_gas_acid_base_pattern,
        plasma_lactate_mmol_l,
        anion_gap_meq_l, urine_ketones_present,
        suspected_disorder_category, protein_intake_halted,
        high_calorie_dextrose_active, gir_mg_kg_min,
        nitrogen_scavenger_ammonul_active, iv_l_arginine_active,
        iv_l_carnitine_active, crrt_dialysis_indicated, crrt_dialysis_active,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.ageHours,
      data.birthWeightGrams,
      data.gestationalAgeWeeks,
      data.plasmaAmmoniaUmolL,
      data.bloodGasAcidBasePattern,
      data.plasmaLactateMmolL,
      data.anionGapMeqL,
      data.urineKetonesPresent ? 1 : 0,
      data.suspectedDisorderCategory,
      data.proteinIntakeHalted ? 1 : 0,
      data.highCalorieDextroseActive ? 1 : 0,
      data.girMgKgMin,
      data.nitrogenScavengerAmmonulActive ? 1 : 0,
      data.ivLArginineActive ? 1 : 0,
      data.ivLCarnitineActive ? 1 : 0,
      data.crrtDialysisIndicated ? 1 : 0,
      data.crrtDialysisActive ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const created = db.prepare(`SELECT * FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hyperammonemia.episode_create',
      entity: 'neonatal_hyperammonemia_iem_episodes',
      entityId: created.id,
      detail: { episodeId: created.id, episodeCode, patientId: data.patientId },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/neonatal-hyperammonemia/episodes/:id', async (req) => {
    const user = assertCanManageHyperammonemia(req);
    const { id } = req.params as { id: string };
    const data = parse(hyperammonemiaEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal hyperammonemia episode not found');

    db.prepare(`
      UPDATE neonatal_hyperammonemia_iem_episodes SET
        admission_id = ?,
        onset_datetime = ?,
        age_hours = ?,
        birth_weight_grams = ?,
        gestational_age_weeks = ?,
        plasma_ammonia_umol_l = ?,
        blood_gas_acid_base_pattern = ?,
        plasma_lactate_mmol_l = ?,
        anion_gap_meq_l = ?,
        urine_ketones_present = ?,
        suspected_disorder_category = ?,
        protein_intake_halted = ?,
        high_calorie_dextrose_active = ?,
        gir_mg_kg_min = ?,
        nitrogen_scavenger_ammonul_active = ?,
        iv_l_arginine_active = ?,
        iv_l_carnitine_active = ?,
        crrt_dialysis_indicated = ?,
        crrt_dialysis_active = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.admissionId || null,
      data.onsetDatetime,
      data.ageHours,
      data.birthWeightGrams,
      data.gestationalAgeWeeks,
      data.plasmaAmmoniaUmolL,
      data.bloodGasAcidBasePattern,
      data.plasmaLactateMmolL,
      data.anionGapMeqL,
      data.urineKetonesPresent ? 1 : 0,
      data.suspectedDisorderCategory,
      data.proteinIntakeHalted ? 1 : 0,
      data.highCalorieDextroseActive ? 1 : 0,
      data.girMgKgMin,
      data.nitrogenScavengerAmmonulActive ? 1 : 0,
      data.ivLArginineActive ? 1 : 0,
      data.ivLCarnitineActive ? 1 : 0,
      data.crrtDialysisIndicated ? 1 : 0,
      data.crrtDialysisActive ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hyperammonemia.episode_update',
      entity: 'neonatal_hyperammonemia_iem_episodes',
      entityId: updated.id,
      detail: { episodeId: updated.id, status: data.status },
    });

    return { episode: updated };
  });

  // 6. Patch Status
  app.patch('/api/neonatal-hyperammonemia/episodes/:id/status', async (req) => {
    const user = assertCanManageHyperammonemia(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({ status: hyperammonemiaEpisodeSchema.shape.status }), req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal hyperammonemia episode not found');

    db.prepare(`
      UPDATE neonatal_hyperammonemia_iem_episodes SET
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    const updated = db.prepare(`SELECT * FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hyperammonemia.status_change',
      entity: 'neonatal_hyperammonemia_iem_episodes',
      entityId: updated.id,
      detail: { episodeId: updated.id, previousStatus: existing.status, newStatus: status },
    });

    return { episode: updated };
  });

  // 7. Delete Episode
  app.delete('/api/neonatal-hyperammonemia/episodes/:id', async (req) => {
    const user = assertCanManageHyperammonemia(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal hyperammonemia episode not found');

    db.prepare(`DELETE FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hyperammonemia.episode_delete',
      entity: 'neonatal_hyperammonemia_iem_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/neonatal-hyperammonemia/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageHyperammonemia(req);
    const { id } = req.params as { id: string };
    const data = parse(hyperammonemiaFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM neonatal_hyperammonemia_iem_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal hyperammonemia episode not found');

    const result = db.prepare(`
      INSERT INTO neonatal_hyperammonemia_iem_flowsheet_logs (
        episode_id, patient_id, log_datetime, hours_from_crisis_onset,
        plasma_ammonia_umol_l, ph_value, pco2_mmhg, bicarbonate_meq_l,
        glucose_mg_dl, gir_mg_kg_min, dialysis_blood_flow_ml_min,
        encephalopathy_grade, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromCrisisOnset,
      data.plasmaAmmoniaUmolL,
      data.phValue,
      data.pco2Mmhg,
      data.bicarbonateMeqL,
      data.glucoseMgDl,
      data.girMgKgMin,
      data.dialysisBloodFlowMlMin,
      data.encephalopathyGrade,
      data.notes || null,
      user.id
    );

    const created = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM neonatal_hyperammonemia_iem_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.id = ?
    `).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hyperammonemia.flowsheet_add',
      entity: 'neonatal_hyperammonemia_iem_flowsheet_logs',
      entityId: created.id,
      detail: { episodeId: Number(id), plasmaAmmoniaUmolL: data.plasmaAmmoniaUmolL, encephalopathyGrade: data.encephalopathyGrade },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/neonatal-hyperammonemia/episodes/:id/flowsheet/:logId', async (req) => {
    const user = assertCanManageHyperammonemia(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare(`
      SELECT * FROM neonatal_hyperammonemia_iem_flowsheet_logs
      WHERE id = ? AND episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM neonatal_hyperammonemia_iem_flowsheet_logs WHERE id = ?`).run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hyperammonemia.flowsheet_delete',
      entity: 'neonatal_hyperammonemia_iem_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id), logId: Number(logId) },
    });

    return { success: true };
  });
}
