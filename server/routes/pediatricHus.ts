import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricHus,
} from '../../web/src/pediatricHusEngine.js';

function assertCanManageHus(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric HUS protocols');
  }
  return user;
}

const husEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.1).max(21.0),
  weightKg: z.coerce.number().min(2.0).max(150.0),
  prodromalBloodyDiarrhea: z.boolean().default(true),
  shigaToxinTested: z.boolean().default(true),
  shigaToxinResult: z.enum(['positive_stec', 'negative', 'pending']),
  hemoglobinGDl: z.coerce.number().min(2.0).max(25.0),
  plateletCount: z.coerce.number().int().min(1000).max(1000000),
  serumCreatinineMgDl: z.coerce.number().min(0.1).max(25.0),
  baselineCreatinineMgDl: z.coerce.number().min(0.1).max(5.0),
  schistocytesPresentPct: z.coerce.number().min(0.0).max(25.0),
  serumLdhUL: z.coerce.number().int().min(50).max(15000),
  directCoombsTest: z.enum(['negative', 'positive_non_stec', 'not_performed']).default('negative'),
  serumPotassiumMeqL: z.coerce.number().min(1.0).max(12.0),
  oliguriaAnuriaDurationHours: z.coerce.number().min(0.0).max(240.0).default(0.0),
  hypertensionPresent: z.boolean().default(false),
  neurologicalInvolvement: z.enum([
    'none',
    'lethargy_irritability',
    'seizures_altered_mental_status',
    'coma_stroke',
  ]).default('none'),
  husPhenotype: z.enum([
    'typical_stec_d_plus',
    'atypical_complement_mediated_ahus',
    'secondary_pneumococcal_or_other',
  ]).default('typical_stec_d_plus'),
  antibioticsAvoidedStrict: z.boolean().default(true),
  antimotilityAgentsAvoided: z.boolean().default(true),
  dialysisRrtIndicated: z.boolean().default(false),
  dialysisModality: z.enum([
    'none',
    'peritoneal_dialysis',
    'crrt_cvvhdf',
    'hemodialysis',
  ]).default('none'),
  eculizumabIndicated: z.boolean().default(false),
  status: z.enum([
    'active_fluid_electrolyte_management',
    'dialysis_crrt_running',
    'eculizumab_infusion',
    'renal_recovery_phase',
    'resolved_normal_renal_function',
  ]).default('active_fluid_electrolyte_management'),
  clinicalNotes: z.string().optional().nullable(),
});

const husFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromOnset: z.coerce.number().min(0).max(720),
  urineOutputMlKgHr: z.coerce.number().min(0.0).max(20.0),
  fluidBalance24hMl: z.coerce.number().min(-5000).max(5000).optional().nullable(),
  plateletCount: z.coerce.number().int().min(1000).max(1000000),
  serumCreatinineMgDl: z.coerce.number().min(0.1).max(25.0),
  serumPotassiumMeqL: z.coerce.number().min(1.0).max(12.0),
  bloodPressureSys: z.coerce.number().int().min(40).max(260),
  bloodPressureDia: z.coerce.number().int().min(20).max(160),
  neurologicalStatus: z.enum(['alert', 'irritable', 'somnolent', 'seizure_activity']),
  dialysisUltrafiltrationMl: z.coerce.number().min(0).max(5000).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerPediatricHusRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/pediatric-hus/evaluate', async (req) => {
    assertCanManageHus(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricHus({
      ageYears: Number(body.ageYears || 4.5),
      weightKg: Number(body.weightKg || 16.0),
      prodromalBloodyDiarrhea: body.prodromalBloodyDiarrhea !== undefined ? Boolean(body.prodromalBloodyDiarrhea) : true,
      shigaToxinTested: body.shigaToxinTested !== undefined ? Boolean(body.shigaToxinTested) : true,
      shigaToxinResult: body.shigaToxinResult || 'positive_stec',
      hemoglobinGDl: Number(body.hemoglobinGDl || 7.2),
      plateletCount: Number(body.plateletCount || 42000),
      serumCreatinineMgDl: Number(body.serumCreatinineMgDl || 2.8),
      baselineCreatinineMgDl: Number(body.baselineCreatinineMgDl || 0.4),
      schistocytesPresentPct: Number(body.schistocytesPresentPct || 3.5),
      serumLdhUL: Number(body.serumLdhUL || 2150),
      directCoombsTest: body.directCoombsTest || 'negative',
      serumPotassiumMeqL: Number(body.serumPotassiumMeqL || 5.4),
      oliguriaAnuriaDurationHours: Number(body.oliguriaAnuriaDurationHours || 16.0),
      hypertensionPresent: Boolean(body.hypertensionPresent),
      neurologicalInvolvement: body.neurologicalInvolvement || 'lethargy_irritability',
      husPhenotype: body.husPhenotype || 'typical_stec_d_plus',
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-hus/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_hus_episodes e
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
  app.get('/api/pediatric-hus/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_hus_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric HUS episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_hus_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.hus_episode_id = ?
      ORDER BY l.hours_from_onset ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluatePediatricHus({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      prodromalBloodyDiarrhea: Boolean(episode.prodromal_bloody_diarrhea),
      shigaToxinTested: Boolean(episode.shiga_toxin_tested),
      shigaToxinResult: episode.shiga_toxin_result,
      hemoglobinGDl: episode.hemoglobin_g_dl,
      plateletCount: episode.platelet_count,
      serumCreatinineMgDl: episode.serum_creatinine_mg_dl,
      baselineCreatinineMgDl: episode.baseline_creatinine_mg_dl,
      schistocytesPresentPct: episode.schistocytes_present_pct,
      serumLdhUL: episode.serum_ldh_u_l,
      directCoombsTest: episode.direct_coombs_test,
      serumPotassiumMeqL: episode.serum_potassium_meq_l,
      oliguriaAnuriaDurationHours: episode.oliguria_anuria_duration_hours,
      hypertensionPresent: Boolean(episode.hypertension_present),
      neurologicalInvolvement: episode.neurological_involvement,
      husPhenotype: episode.hus_phenotype,
    });

    return { episode, flowsheet: flowsheetLogs, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-hus/episodes', async (req, reply) => {
    const user = assertCanManageHus(req);
    requirePerm(req, 'patient:write_clinical');
    const input = parse(husEpisodeSchema, req.body);

    const evaluation = evaluatePediatricHus({
      ageYears: input.ageYears,
      weightKg: input.weightKg,
      prodromalBloodyDiarrhea: input.prodromalBloodyDiarrhea,
      shigaToxinTested: input.shigaToxinTested,
      shigaToxinResult: input.shigaToxinResult,
      hemoglobinGDl: input.hemoglobinGDl,
      plateletCount: input.plateletCount,
      serumCreatinineMgDl: input.serumCreatinineMgDl,
      baselineCreatinineMgDl: input.baselineCreatinineMgDl,
      schistocytesPresentPct: input.schistocytesPresentPct,
      serumLdhUL: input.serumLdhUL,
      directCoombsTest: input.directCoombsTest,
      serumPotassiumMeqL: input.serumPotassiumMeqL,
      oliguriaAnuriaDurationHours: input.oliguriaAnuriaDurationHours,
      hypertensionPresent: input.hypertensionPresent,
      neurologicalInvolvement: input.neurologicalInvolvement,
      husPhenotype: input.husPhenotype,
    });

    const episodeCode = `HUS-${Date.now().toString(36).toUpperCase()}`;

    const insert = db.prepare(`
      INSERT INTO pediatric_hus_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        age_years, weight_kg, prodromal_bloody_diarrhea, shiga_toxin_tested,
        shiga_toxin_result, hemoglobin_g_dl, platelet_count, serum_creatinine_mg_dl,
        baseline_creatinine_mg_dl, kdigo_aki_stage, schistocytes_present_pct,
        serum_ldh_u_l, direct_coombs_test, serum_potassium_meq_l,
        oliguria_anuria_duration_hours, hypertension_present, neurological_involvement,
        hus_phenotype, antibiotics_avoided_strict, antimotility_agents_avoided,
        dialysis_rrt_indicated, dialysis_modality, eculizumab_indicated,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = insert.run(
      input.patientId,
      input.admissionId ?? null,
      episodeCode,
      input.onsetDatetime,
      input.ageYears,
      input.weightKg,
      input.prodromalBloodyDiarrhea ? 1 : 0,
      input.shigaToxinTested ? 1 : 0,
      input.shigaToxinResult,
      input.hemoglobinGDl,
      input.plateletCount,
      input.serumCreatinineMgDl,
      input.baselineCreatinineMgDl,
      evaluation.kdigoAkiStage,
      input.schistocytesPresentPct,
      input.serumLdhUL,
      input.directCoombsTest,
      input.serumPotassiumMeqL,
      input.oliguriaAnuriaDurationHours,
      input.hypertensionPresent ? 1 : 0,
      input.neurologicalInvolvement,
      input.husPhenotype,
      input.antibioticsAvoidedStrict ? 1 : 0,
      input.antimotilityAgentsAvoided ? 1 : 0,
      (evaluation.dialysisRrtIndicated || input.dialysisRrtIndicated) ? 1 : 0,
      input.dialysisModality,
      (evaluation.eculizumabIndicated || input.eculizumabIndicated) ? 1 : 0,
      input.status,
      user.id,
      input.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_hus.create',
      entity: 'pediatric_hus_episodes',
      entityId: episodeId,
      detail: {
        episodeId,
        episodeCode,
        patientId: input.patientId,
        kdigoStage: evaluation.kdigoAkiStage,
        triadMet: evaluation.isTriadDiagnosticMet,
      },
    });

    reply.status(201);
    return {
      episodeId,
      id: episodeId,
      episodeCode,
      kdigoStage: evaluation.kdigoAkiStage,
      triadMet: evaluation.isTriadDiagnosticMet,
      evaluation,
      success: true,
    };
  });

  // 5. Update Status
  app.patch('/api/pediatric-hus/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageHus(req);
    const { id } = req.params as { id: string };

    const statusSchema = z.object({
      status: z.enum([
        'active_fluid_electrolyte_management',
        'dialysis_crrt_running',
        'eculizumab_infusion',
        'renal_recovery_phase',
        'resolved_normal_renal_function',
      ]),
      dialysisModality: z.enum([
        'none',
        'peritoneal_dialysis',
        'crrt_cvvhdf',
        'hemodialysis',
      ]).optional(),
      dialysisRrtIndicated: z.boolean().optional(),
      eculizumabIndicated: z.boolean().optional(),
      clinicalNotes: z.string().optional().nullable(),
    });

    const input = parse(statusSchema, req.body);

    const update = db.prepare(`
      UPDATE pediatric_hus_episodes
      SET status = ?,
          dialysis_modality = COALESCE(?, dialysis_modality),
          dialysis_rrt_indicated = CASE WHEN ? IS NOT NULL THEN ? ELSE dialysis_rrt_indicated END,
          eculizumab_indicated = CASE WHEN ? IS NOT NULL THEN ? ELSE eculizumab_indicated END,
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = update.run(
      input.status,
      input.dialysisModality ?? null,
      input.dialysisRrtIndicated !== undefined ? (input.dialysisRrtIndicated ? 1 : 0) : null,
      input.dialysisRrtIndicated !== undefined ? (input.dialysisRrtIndicated ? 1 : 0) : null,
      input.eculizumabIndicated !== undefined ? (input.eculizumabIndicated ? 1 : 0) : null,
      input.eculizumabIndicated !== undefined ? (input.eculizumabIndicated ? 1 : 0) : null,
      input.clinicalNotes ?? null,
      Number(id)
    );
    if (result.changes === 0) throw notFound('Episode not found');

    audit(db, {
      actorId: user.id,
      action: 'pediatric_hus.status_update',
      entity: 'pediatric_hus_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), newStatus: input.status },
    });

    return { success: true, status: input.status };
  });

  // 6. Add Flowsheet Entry
  const addFlowsheetHandler = async (req: FastifyRequest, reply: any) => {
    const user = assertCanManageHus(req);
    const { id } = req.params as { id: string };
    const input = parse(husFlowsheetSchema, req.body);

    const episode = db.prepare(`
      SELECT patient_id FROM pediatric_hus_episodes WHERE id = ?
    `).get(Number(id)) as { patient_id: number } | undefined;

    if (!episode) throw notFound('Pediatric HUS episode not found');

    const insert = db.prepare(`
      INSERT INTO pediatric_hus_flowsheet_logs (
        hus_episode_id, patient_id, log_datetime, hours_from_onset,
        urine_output_ml_kg_hr, fluid_balance_24h_ml, platelet_count,
        serum_creatinine_mg_dl, serum_potassium_meq_l, blood_pressure_sys,
        blood_pressure_dia, neurological_status, dialysis_ultrafiltration_ml,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const res = insert.run(
      Number(id),
      episode.patient_id,
      input.logDatetime,
      input.hoursFromOnset,
      input.urineOutputMlKgHr,
      input.fluidBalance24hMl ?? null,
      input.plateletCount,
      input.serumCreatinineMgDl,
      input.serumPotassiumMeqL,
      input.bloodPressureSys,
      input.bloodPressureDia,
      input.neurologicalStatus,
      input.dialysisUltrafiltrationMl ?? null,
      input.notes ?? null,
      user.id
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_hus.flowsheet_add',
      entity: 'pediatric_hus_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, hours: input.hoursFromOnset },
    });

    reply.status(201);
    return { id: logId, logId, success: true };
  };

  app.post('/api/pediatric-hus/episodes/:id/flowsheet', addFlowsheetHandler);
  app.post('/api/pediatric-hus/episodes/:id/flowsheet-logs', addFlowsheetHandler);

  // 7. Delete Flowsheet Entry
  app.delete('/api/pediatric-hus/flowsheet/:id', async (req) => {
    const user = assertCanManageHus(req);
    const { id } = req.params as { id: string };

    const entry = db.prepare(`
      SELECT * FROM pediatric_hus_flowsheet_logs WHERE id = ?
    `).get(Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_hus_flowsheet_logs WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_hus.flowsheet_delete',
      entity: 'pediatric_hus_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: entry.hus_episode_id },
    });

    return { success: true };
  });

  app.delete('/api/pediatric-hus/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageHus(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const entry = db.prepare(`
      SELECT * FROM pediatric_hus_flowsheet_logs WHERE id = ? AND hus_episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_hus_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_hus.flowsheet_delete',
      entity: 'pediatric_hus_flowsheet_logs',
      entityId: Number(logId),
      detail: { logId: Number(logId), episodeId: Number(id) },
    });

    return { success: true };
  });
}
