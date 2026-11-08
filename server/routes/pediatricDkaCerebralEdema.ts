import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricDkaCerebralEdema,
} from '../../web/src/pediatricDkaCerebralEdemaEngine.js';

function assertCanManageDkaCe(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric DKA cerebral edema protocols');
  }
  return user;
}

const dkaCeEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  detectionDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.1).max(21.0),
  weightKg: z.coerce.number().min(2.0).max(150.0),
  gcsScore: z.coerce.number().int().min(3).max(15),
  headacheSevereSudden: z.boolean().default(true),
  lethargyOrConfusion: z.boolean().default(true),
  recurrentEmesisPostHydration: z.boolean().default(true),
  bradycardiaCushingTriad: z.boolean().default(false),
  hypertensionDiastolicGe90: z.boolean().default(false),
  cranialNervePalsy: z.boolean().default(false),
  pupillaryAbnormality: z.enum([
    'normal_reactive',
    'sluggish',
    'unequal_anisocoria',
    'dilated_fixed',
  ]),
  decorticateDecerebratePosturing: z.boolean().default(false),
  bloodGlucoseMgDl: z.coerce.number().min(50).max(2500),
  serumSodiumMeasuredMeqL: z.coerce.number().min(100).max(190),
  serumPotassiumMeqL: z.coerce.number().min(1.0).max(10.0),
  bloodPh: z.coerce.number().min(6.5).max(7.8),
  serumBicarbonateMeqL: z.coerce.number().min(1.0).max(45.0),
  fluidRateReducedBy30pct: z.boolean().default(true),
  headOfBedElevated30deg: z.boolean().default(true),
  status: z.enum([
    'emergent_hyperosmolar_rescue',
    'hypertonic_saline_infusing',
    'picu_neuro_monitoring',
    'neurological_recovery_gcs15',
    'brainstem_herniation_critical',
  ]).default('emergent_hyperosmolar_rescue'),
  clinicalNotes: z.string().optional().nullable(),
});

const dkaCeFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromDetection: z.coerce.number().min(0).max(720),
  gcsScore: z.coerce.number().int().min(3).max(15),
  pupilSizeAndReactivity: z.string().min(1),
  heartRate: z.coerce.number().int().min(30).max(250),
  bloodPressureSys: z.coerce.number().int().min(40).max(250),
  bloodPressureDia: z.coerce.number().int().min(20).max(150),
  bloodGlucoseMgDl: z.coerce.number().min(20).max(2500),
  serumSodiumMeasuredMeqL: z.coerce.number().min(100).max(190),
  hyperosmolarAgentGiven: z.string().optional().nullable(),
  ivFluidRateMlHr: z.coerce.number().min(0).max(1000),
  neurologicalExamNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerPediatricDkaCerebralEdemaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/pediatric-dka-ce/evaluate', async (req) => {
    assertCanManageDkaCe(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricDkaCerebralEdema({
      ageYears: Number(body.ageYears || 8),
      weightKg: Number(body.weightKg || 25),
      gcsScore: Number(body.gcsScore || 11),
      headacheSevereSudden: body.headacheSevereSudden !== undefined ? Boolean(body.headacheSevereSudden) : true,
      lethargyOrConfusion: body.lethargyOrConfusion !== undefined ? Boolean(body.lethargyOrConfusion) : true,
      recurrentEmesisPostHydration: body.recurrentEmesisPostHydration !== undefined ? Boolean(body.recurrentEmesisPostHydration) : true,
      bradycardiaCushingTriad: Boolean(body.bradycardiaCushingTriad),
      hypertensionDiastolicGe90: Boolean(body.hypertensionDiastolicGe90),
      cranialNervePalsy: Boolean(body.cranialNervePalsy),
      pupillaryAbnormality: body.pupillaryAbnormality || 'sluggish',
      decorticateDecerebratePosturing: Boolean(body.decorticateDecerebratePosturing),
      bloodGlucoseMgDl: Number(body.bloodGlucoseMgDl || 620),
      serumSodiumMeasuredMeqL: Number(body.serumSodiumMeasuredMeqL || 132),
      serumPotassiumMeqL: Number(body.serumPotassiumMeqL || 4.2),
      bloodPh: Number(body.bloodPh || 7.08),
      serumBicarbonateMeqL: Number(body.serumBicarbonateMeqL || 7),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-dka-ce/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_dka_cerebral_edema_episodes e
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
  app.get('/api/pediatric-dka-ce/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_dka_cerebral_edema_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric DKA cerebral edema episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_dka_cerebral_edema_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.dka_cerebral_episode_id = ?
      ORDER BY l.hours_from_detection ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluatePediatricDkaCerebralEdema({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      gcsScore: episode.gcs_score,
      headacheSevereSudden: Boolean(episode.headache_severe_sudden),
      lethargyOrConfusion: Boolean(episode.lethargy_or_confusion),
      recurrentEmesisPostHydration: Boolean(episode.recurrent_emesis_post_hydration),
      bradycardiaCushingTriad: Boolean(episode.bradycardia_cushing_triad),
      hypertensionDiastolicGe90: Boolean(episode.hypertension_diastolic_ge_90),
      cranialNervePalsy: Boolean(episode.cranial_nerve_palsy),
      pupillaryAbnormality: episode.pupillary_abnormality,
      decorticateDecerebratePosturing: Boolean(episode.decorticate_decerebrate_posturing),
      bloodGlucoseMgDl: episode.blood_glucose_mg_dl,
      serumSodiumMeasuredMeqL: episode.serum_sodium_measured_meq_l,
      serumPotassiumMeqL: episode.serum_potassium_meq_l,
      bloodPh: episode.blood_ph,
      serumBicarbonateMeqL: episode.serum_bicarbonate_meq_l,
    });

    return { episode, flowsheet: flowsheetLogs, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-dka-ce/episodes', async (req, reply) => {
    const user = assertCanManageDkaCe(req);
    requirePerm(req, 'patient:write_clinical');
    const input = parse(dkaCeEpisodeSchema, req.body);

    const evaluation = evaluatePediatricDkaCerebralEdema({
      ageYears: input.ageYears,
      weightKg: input.weightKg,
      gcsScore: input.gcsScore,
      headacheSevereSudden: input.headacheSevereSudden,
      lethargyOrConfusion: input.lethargyOrConfusion,
      recurrentEmesisPostHydration: input.recurrentEmesisPostHydration,
      bradycardiaCushingTriad: input.bradycardiaCushingTriad,
      hypertensionDiastolicGe90: input.hypertensionDiastolicGe90,
      cranialNervePalsy: input.cranialNervePalsy,
      pupillaryAbnormality: input.pupillaryAbnormality,
      decorticateDecerebratePosturing: input.decorticateDecerebratePosturing,
      bloodGlucoseMgDl: input.bloodGlucoseMgDl,
      serumSodiumMeasuredMeqL: input.serumSodiumMeasuredMeqL,
      serumPotassiumMeqL: input.serumPotassiumMeqL,
      bloodPh: input.bloodPh,
      serumBicarbonateMeqL: input.serumBicarbonateMeqL,
    });

    const episodeCode = `DKACE-${Date.now().toString(36).toUpperCase()}`;
    const primaryAgentDose =
      evaluation.primaryHyperosmolarAgent === 'hypertonic_saline_3pct'
        ? evaluation.hyperosmolarSaline3PctDoseMl
        : evaluation.mannitol20PctDoseMl;

    const insert = db.prepare(`
      INSERT INTO pediatric_dka_cerebral_edema_episodes (
        patient_id, admission_id, episode_code, detection_datetime,
        age_years, weight_kg, gcs_score, headache_severe_sudden,
        lethargy_or_confusion, recurrent_emesis_post_hydration,
        bradycardia_cushing_triad, hypertension_diastolic_ge_90,
        cranial_nerve_palsy, pupillary_abnormality, decorticate_decerebrate_posturing,
        blood_glucose_mg_dl, serum_sodium_measured_meq_l, serum_sodium_corrected_meq_l,
        serum_potassium_meq_l, effective_serum_osmolality_mosm_kg, blood_ph,
        serum_bicarbonate_meq_l, muir_criteria_category, primary_hyperosmolar_agent,
        hyperosmolar_dose_ml, fluid_rate_reduced_by_30pct, head_of_bed_elevated_30deg,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
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
      input.detectionDatetime,
      input.ageYears,
      input.weightKg,
      input.gcsScore,
      input.headacheSevereSudden ? 1 : 0,
      input.lethargyOrConfusion ? 1 : 0,
      input.recurrentEmesisPostHydration ? 1 : 0,
      input.bradycardiaCushingTriad ? 1 : 0,
      input.hypertensionDiastolicGe90 ? 1 : 0,
      input.cranialNervePalsy ? 1 : 0,
      input.pupillaryAbnormality,
      input.decorticateDecerebratePosturing ? 1 : 0,
      input.bloodGlucoseMgDl,
      input.serumSodiumMeasuredMeqL,
      evaluation.serumSodiumCorrectedMeqL,
      input.serumPotassiumMeqL,
      evaluation.effectiveSerumOsmolalityMosmKg,
      input.bloodPh,
      input.serumBicarbonateMeqL,
      evaluation.muirCriteriaCategory,
      evaluation.primaryHyperosmolarAgent,
      primaryAgentDose,
      input.fluidRateReducedBy30pct ? 1 : 0,
      input.headOfBedElevated30deg ? 1 : 0,
      input.status,
      user.id,
      input.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_dka_ce.create',
      entity: 'pediatric_dka_cerebral_edema_episodes',
      entityId: episodeId,
      detail: {
        episodeId,
        episodeCode,
        patientId: input.patientId,
        category: evaluation.muirCriteriaCategory,
      },
    });

    reply.status(201);
    return {
      episodeId,
      id: episodeId,
      episodeCode,
      category: evaluation.muirCriteriaCategory,
      evaluation,
      success: true,
    };
  });

  // 5. Update Status
  app.patch('/api/pediatric-dka-ce/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageDkaCe(req);
    const { id } = req.params as { id: string };

    const statusSchema = z.object({
      status: z.enum([
        'emergent_hyperosmolar_rescue',
        'hypertonic_saline_infusing',
        'picu_neuro_monitoring',
        'neurological_recovery_gcs15',
        'brainstem_herniation_critical',
      ]),
      clinicalNotes: z.string().optional().nullable(),
    });

    const input = parse(statusSchema, req.body);

    const update = db.prepare(`
      UPDATE pediatric_dka_cerebral_edema_episodes
      SET status = ?, clinical_notes = COALESCE(?, clinical_notes), updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = update.run(input.status, input.clinicalNotes ?? null, Number(id));
    if (result.changes === 0) throw notFound('Episode not found');

    audit(db, {
      actorId: user.id,
      action: 'pediatric_dka_ce.status_update',
      entity: 'pediatric_dka_cerebral_edema_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), newStatus: input.status },
    });

    return { success: true, status: input.status };
  });

  // 6. Add Flowsheet Entry
  const addFlowsheetHandler = async (req: FastifyRequest, reply: any) => {
    const user = assertCanManageDkaCe(req);
    const { id } = req.params as { id: string };
    const input = parse(dkaCeFlowsheetSchema, req.body);

    const episode = db.prepare(`
      SELECT patient_id FROM pediatric_dka_cerebral_edema_episodes WHERE id = ?
    `).get(Number(id)) as { patient_id: number } | undefined;

    if (!episode) throw notFound('Pediatric DKA cerebral edema episode not found');

    // Calculate corrected sodium for flowsheet
    const glucoseExcess = Math.max(0, input.bloodGlucoseMgDl - 100);
    const correctedSodium = Math.round((input.serumSodiumMeasuredMeqL + 1.6 * (glucoseExcess / 100)) * 10) / 10;

    const insert = db.prepare(`
      INSERT INTO pediatric_dka_cerebral_edema_flowsheet_logs (
        dka_cerebral_episode_id, patient_id, log_datetime, hours_from_detection,
        gcs_score, pupil_size_and_reactivity, heart_rate,
        blood_pressure_sys, blood_pressure_dia, blood_glucose_mg_dl,
        serum_sodium_measured_meq_l, serum_sodium_corrected_meq_l,
        hyperosmolar_agent_given, iv_fluid_rate_ml_hr,
        neurological_exam_notes, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const res = insert.run(
      Number(id),
      episode.patient_id,
      input.logDatetime,
      input.hoursFromDetection,
      input.gcsScore,
      input.pupilSizeAndReactivity,
      input.heartRate,
      input.bloodPressureSys,
      input.bloodPressureDia,
      input.bloodGlucoseMgDl,
      input.serumSodiumMeasuredMeqL,
      correctedSodium,
      input.hyperosmolarAgentGiven ?? null,
      input.ivFluidRateMlHr,
      input.neurologicalExamNotes ?? null,
      input.notes ?? null,
      user.id
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_dka_ce.flowsheet_add',
      entity: 'pediatric_dka_cerebral_edema_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, hoursFromDetection: input.hoursFromDetection },
    });

    reply.status(201);
    return { id: logId, logId, success: true, serumSodiumCorrectedMeqL: correctedSodium };
  };

  app.post('/api/pediatric-dka-ce/episodes/:id/flowsheet', addFlowsheetHandler);
  app.post('/api/pediatric-dka-ce/episodes/:id/flowsheet-logs', addFlowsheetHandler);

  // 7. Delete Flowsheet Entry
  app.delete('/api/pediatric-dka-ce/flowsheet/:id', async (req) => {
    const user = assertCanManageDkaCe(req);
    const { id } = req.params as { id: string };

    const entry = db.prepare(`
      SELECT * FROM pediatric_dka_cerebral_edema_flowsheet_logs WHERE id = ?
    `).get(Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_dka_cerebral_edema_flowsheet_logs WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_dka_ce.flowsheet_delete',
      entity: 'pediatric_dka_cerebral_edema_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: entry.dka_cerebral_episode_id },
    });

    return { success: true };
  });

  app.delete('/api/pediatric-dka-ce/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageDkaCe(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const entry = db.prepare(`
      SELECT * FROM pediatric_dka_cerebral_edema_flowsheet_logs WHERE id = ? AND dka_cerebral_episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_dka_cerebral_edema_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_dka_ce.flowsheet_delete',
      entity: 'pediatric_dka_cerebral_edema_flowsheet_logs',
      entityId: Number(logId),
      detail: { logId: Number(logId), episodeId: Number(id) },
    });

    return { success: true };
  });
}
