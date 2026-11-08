import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricPyloricStenosis,
} from '../../web/src/pediatricPyloricStenosisEngine.js';

function assertCanManagePyloricStenosis(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pyloric stenosis protocols');
  }
  return user;
}

const pyloricEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  presentationDatetime: z.string().min(1),
  ageWeeks: z.coerce.number().min(0).max(52),
  weightKg: z.coerce.number().min(1.0).max(15.0),
  birthWeightKg: z.coerce.number().min(0.5).max(10.0),
  vomitingProjectileNonBilious: z.boolean().default(true),
  hungryVomiterBehavior: z.boolean().default(true),
  palpableOliveMass: z.boolean().default(false),
  visibleGastricPeristalsis: z.boolean().default(false),
  dehydrationPercentage: z.coerce.number().min(0).max(25).default(5.0),
  ultrasoundPerformed: z.boolean().default(true),
  pyloricMuscleThicknessMm: z.coerce.number().min(0).max(20).optional().nullable(),
  pyloricChannelLengthMm: z.coerce.number().min(0).max(40).optional().nullable(),
  pyloricTransverseDiameterMm: z.coerce.number().min(0).max(40).optional().nullable(),
  ultrasoundDiagnosticTargetSign: z.boolean().default(true),
  serumSodiumMeqL: z.coerce.number().min(110).max(170).default(135),
  serumPotassiumMeqL: z.coerce.number().min(1.5).max(8.0).default(3.6),
  serumChlorideMeqL: z.coerce.number().min(50).max(130).default(95),
  serumBicarbonateMeqL: z.coerce.number().min(10).max(60).default(30),
  bloodPh: z.coerce.number().min(6.8).max(7.8).default(7.48),
  urineOutputMlKgHr: z.coerce.number().min(0).max(20).default(0.8),
  fluidResuscitationRateMlHr: z.coerce.number().min(0).max(500).optional().nullable(),
  potassiumSupplementationStarted: z.boolean().default(false),
  preopElectrolytesNormalized: z.boolean().default(false),
  surgicalClearanceGranted: z.boolean().default(false),
  surgeryPerformed: z.boolean().default(false),
  pyloromyotomyTechnique: z.enum([
    'laparoscopic_ramstedt',
    'open_right_upper_quadrant',
    'open_circumumbilical_tan_bianchi',
  ]).optional().nullable(),
  postopFeedingStarted: z.boolean().default(false),
  status: z.enum([
    'preop_fluid_resuscitation',
    'metabolically_cleared_for_or',
    'surgery_in_progress',
    'postop_feeding_advancement',
    'resolved_discharged',
  ]).default('preop_fluid_resuscitation'),
  clinicalNotes: z.string().optional().nullable(),
});

const pyloricFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromAdmission: z.coerce.number().min(0).max(720),
  serumSodiumMeqL: z.coerce.number().min(110).max(170).optional().nullable(),
  serumPotassiumMeqL: z.coerce.number().min(1.5).max(8.0).optional().nullable(),
  serumChlorideMeqL: z.coerce.number().min(50).max(130).optional().nullable(),
  serumBicarbonateMeqL: z.coerce.number().min(10).max(60).optional().nullable(),
  bloodPh: z.coerce.number().min(6.8).max(7.8).optional().nullable(),
  urineOutputMlKgHr: z.coerce.number().min(0).max(20).default(0.0),
  ivFluidRateMlHr: z.coerce.number().min(0).max(500).default(0.0),
  capillaryRefillSeconds: z.coerce.number().min(0).max(10).optional().nullable(),
  vomitingEpisodesCount: z.coerce.number().min(0).max(50).default(0),
  gastricDecompressionOutputMl: z.coerce.number().min(0).max(1000).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerPediatricPyloricStenosisRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/pediatric-pyloric-stenosis/evaluate', async (req) => {
    assertCanManagePyloricStenosis(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricPyloricStenosis({
      ageWeeks: Number(body.ageWeeks || 5),
      weightKg: Number(body.weightKg || 4.0),
      birthWeightKg: Number(body.birthWeightKg || 3.3),
      vomitingProjectileNonBilious: body.vomitingProjectileNonBilious !== undefined ? Boolean(body.vomitingProjectileNonBilious) : true,
      hungryVomiterBehavior: body.hungryVomiterBehavior !== undefined ? Boolean(body.hungryVomiterBehavior) : true,
      palpableOliveMass: Boolean(body.palpableOliveMass),
      visibleGastricPeristalsis: Boolean(body.visibleGastricPeristalsis),
      dehydrationPercentage: Number(body.dehydrationPercentage || 5.0),
      ultrasoundPerformed: body.ultrasoundPerformed !== undefined ? Boolean(body.ultrasoundPerformed) : true,
      pyloricMuscleThicknessMm: body.pyloricMuscleThicknessMm ? Number(body.pyloricMuscleThicknessMm) : undefined,
      pyloricChannelLengthMm: body.pyloricChannelLengthMm ? Number(body.pyloricChannelLengthMm) : undefined,
      pyloricTransverseDiameterMm: body.pyloricTransverseDiameterMm ? Number(body.pyloricTransverseDiameterMm) : undefined,
      ultrasoundDiagnosticTargetSign: body.ultrasoundDiagnosticTargetSign !== undefined ? Boolean(body.ultrasoundDiagnosticTargetSign) : true,
      serumSodiumMeqL: Number(body.serumSodiumMeqL || 135),
      serumPotassiumMeqL: Number(body.serumPotassiumMeqL || 3.6),
      serumChlorideMeqL: Number(body.serumChlorideMeqL || 95),
      serumBicarbonateMeqL: Number(body.serumBicarbonateMeqL || 30),
      bloodPh: Number(body.bloodPh || 7.48),
      urineOutputMlKgHr: Number(body.urineOutputMlKgHr || 0.8),
      potassiumSupplementationStarted: Boolean(body.potassiumSupplementationStarted),
      surgeryPerformed: Boolean(body.surgeryPerformed),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-pyloric-stenosis/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_pyloric_stenosis_episodes e
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
        vomiting_projectile_non_bilious: Boolean(r.vomiting_projectile_non_bilious),
        hungry_vomiter_behavior: Boolean(r.hungry_vomiter_behavior),
        palpable_olive_mass: Boolean(r.palpable_olive_mass),
        visible_gastric_peristalsis: Boolean(r.visible_gastric_peristalsis),
        ultrasound_performed: Boolean(r.ultrasound_performed),
        ultrasound_diagnostic_target_sign: Boolean(r.ultrasound_diagnostic_target_sign),
        potassium_supplementation_started: Boolean(r.potassium_supplementation_started),
        preop_electrolytes_normalized: Boolean(r.preop_electrolytes_normalized),
        surgical_clearance_granted: Boolean(r.surgical_clearance_granted),
        surgery_performed: Boolean(r.surgery_performed),
        postop_feeding_started: Boolean(r.postop_feeding_started),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/pediatric-pyloric-stenosis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_pyloric_stenosis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Pediatric pyloric stenosis episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_pyloric_stenosis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.pyloric_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluatePediatricPyloricStenosis({
      ageWeeks: episode.age_weeks,
      weightKg: episode.weight_kg,
      birthWeightKg: episode.birth_weight_kg,
      vomitingProjectileNonBilious: Boolean(episode.vomiting_projectile_non_bilious),
      hungryVomiterBehavior: Boolean(episode.hungry_vomiter_behavior),
      palpableOliveMass: Boolean(episode.palpable_olive_mass),
      visibleGastricPeristalsis: Boolean(episode.visible_gastric_peristalsis),
      dehydrationPercentage: episode.dehydration_percentage,
      ultrasoundPerformed: Boolean(episode.ultrasound_performed),
      pyloricMuscleThicknessMm: episode.pyloric_muscle_thickness_mm ?? undefined,
      pyloricChannelLengthMm: episode.pyloric_channel_length_mm ?? undefined,
      pyloricTransverseDiameterMm: episode.pyloric_transverse_diameter_mm ?? undefined,
      ultrasoundDiagnosticTargetSign: Boolean(episode.ultrasound_diagnostic_target_sign),
      serumSodiumMeqL: episode.serum_sodium_meq_l,
      serumPotassiumMeqL: episode.serum_potassium_meq_l,
      serumChlorideMeqL: episode.serum_chloride_meq_l,
      serumBicarbonateMeqL: episode.serum_bicarbonate_meq_l,
      bloodPh: episode.blood_ph,
      urineOutputMlKgHr: episode.urine_output_ml_kg_hr,
      potassiumSupplementationStarted: Boolean(episode.potassium_supplementation_started),
      surgeryPerformed: Boolean(episode.surgery_performed),
    });

    return {
      episode: {
        ...episode,
        vomiting_projectile_non_bilious: Boolean(episode.vomiting_projectile_non_bilious),
        hungry_vomiter_behavior: Boolean(episode.hungry_vomiter_behavior),
        palpable_olive_mass: Boolean(episode.palpable_olive_mass),
        visible_gastric_peristalsis: Boolean(episode.visible_gastric_peristalsis),
        ultrasound_performed: Boolean(episode.ultrasound_performed),
        ultrasound_diagnostic_target_sign: Boolean(episode.ultrasound_diagnostic_target_sign),
        potassium_supplementation_started: Boolean(episode.potassium_supplementation_started),
        preop_electrolytes_normalized: Boolean(episode.preop_electrolytes_normalized),
        surgical_clearance_granted: Boolean(episode.surgical_clearance_granted),
        surgery_performed: Boolean(episode.surgery_performed),
        postop_feeding_started: Boolean(episode.postop_feeding_started),
      },
      evaluation,
      flowsheet,
    };
  });

  // 4. Create Episode
  app.post('/api/pediatric-pyloric-stenosis/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManagePyloricStenosis(req);
    const data = parse(pyloricEpisodeSchema, req.body);

    const evaluation = evaluatePediatricPyloricStenosis({
      ageWeeks: data.ageWeeks,
      weightKg: data.weightKg,
      birthWeightKg: data.birthWeightKg,
      vomitingProjectileNonBilious: data.vomitingProjectileNonBilious,
      hungryVomiterBehavior: data.hungryVomiterBehavior,
      palpableOliveMass: data.palpableOliveMass,
      visibleGastricPeristalsis: data.visibleGastricPeristalsis,
      dehydrationPercentage: data.dehydrationPercentage,
      ultrasoundPerformed: data.ultrasoundPerformed,
      pyloricMuscleThicknessMm: data.pyloricMuscleThicknessMm ?? undefined,
      pyloricChannelLengthMm: data.pyloricChannelLengthMm ?? undefined,
      pyloricTransverseDiameterMm: data.pyloricTransverseDiameterMm ?? undefined,
      ultrasoundDiagnosticTargetSign: data.ultrasoundDiagnosticTargetSign,
      serumSodiumMeqL: data.serumSodiumMeqL,
      serumPotassiumMeqL: data.serumPotassiumMeqL,
      serumChlorideMeqL: data.serumChlorideMeqL,
      serumBicarbonateMeqL: data.serumBicarbonateMeqL,
      bloodPh: data.bloodPh,
      urineOutputMlKgHr: data.urineOutputMlKgHr,
      potassiumSupplementationStarted: data.potassiumSupplementationStarted,
      surgeryPerformed: data.surgeryPerformed,
    });

    const dateStr = data.presentationDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `PYL-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO pediatric_pyloric_stenosis_episodes (
        patient_id, admission_id, episode_code, presentation_datetime,
        age_weeks, weight_kg, birth_weight_kg,
        vomiting_projectile_non_bilious, hungry_vomiter_behavior,
        palpable_olive_mass, visible_gastric_peristalsis, dehydration_percentage,
        ultrasound_performed, pyloric_muscle_thickness_mm, pyloric_channel_length_mm, pyloric_transverse_diameter_mm,
        ultrasound_diagnostic_target_sign, serum_sodium_meq_l, serum_potassium_meq_l,
        serum_chloride_meq_l, serum_bicarbonate_meq_l, blood_ph,
        urine_output_ml_kg_hr, fluid_resuscitation_rate_ml_hr,
        potassium_supplementation_started, preop_electrolytes_normalized,
        surgical_clearance_granted, surgery_performed, pyloromyotomy_technique,
        postop_feeding_started, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.presentationDatetime,
      data.ageWeeks,
      data.weightKg,
      data.birthWeightKg,
      data.vomitingProjectileNonBilious ? 1 : 0,
      data.hungryVomiterBehavior ? 1 : 0,
      data.palpableOliveMass ? 1 : 0,
      data.visibleGastricPeristalsis ? 1 : 0,
      data.dehydrationPercentage,
      data.ultrasoundPerformed ? 1 : 0,
      data.pyloricMuscleThicknessMm ?? null,
      data.pyloricChannelLengthMm ?? null,
      data.pyloricTransverseDiameterMm ?? null,
      data.ultrasoundDiagnosticTargetSign ? 1 : 0,
      data.serumSodiumMeqL,
      data.serumPotassiumMeqL,
      data.serumChlorideMeqL,
      data.serumBicarbonateMeqL,
      data.bloodPh,
      data.urineOutputMlKgHr,
      data.fluidResuscitationRateMlHr ?? null,
      data.potassiumSupplementationStarted ? 1 : 0,
      evaluation.preOpClearance.allClearedForOr ? 1 : 0,
      evaluation.preOpClearance.allClearedForOr ? 1 : 0,
      data.surgeryPerformed ? 1 : 0,
      data.pyloromyotomyTechnique ?? null,
      data.postopFeedingStarted ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pyloric_stenosis.create',
      entity: 'pediatric_pyloric_stenosis_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, metabolicTier: evaluation.metabolicDerangementTier, cleared: evaluation.preOpClearance.allClearedForOr },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status & Pre-op Clearance
  app.patch('/api/pediatric-pyloric-stenosis/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManagePyloricStenosis(req);
    const { id } = req.params as { id: string };
    const {
      status,
      preopElectrolytesNormalized,
      surgicalClearanceGranted,
      surgeryPerformed,
      pyloromyotomyTechnique,
      postopFeedingStarted,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'preop_fluid_resuscitation',
      'metabolically_cleared_for_or',
      'surgery_in_progress',
      'postop_feeding_advancement',
      'resolved_discharged',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE pediatric_pyloric_stenosis_episodes
      SET status = COALESCE(?, status),
          preop_electrolytes_normalized = CASE WHEN ? IS NOT NULL THEN ? ELSE preop_electrolytes_normalized END,
          surgical_clearance_granted = CASE WHEN ? IS NOT NULL THEN ? ELSE surgical_clearance_granted END,
          surgery_performed = CASE WHEN ? IS NOT NULL THEN ? ELSE surgery_performed END,
          pyloromyotomy_technique = COALESCE(?, pyloromyotomy_technique),
          postop_feeding_started = CASE WHEN ? IS NOT NULL THEN ? ELSE postop_feeding_started END,
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      preopElectrolytesNormalized !== undefined ? (preopElectrolytesNormalized ? 1 : 0) : null,
      preopElectrolytesNormalized !== undefined ? (preopElectrolytesNormalized ? 1 : 0) : null,
      surgicalClearanceGranted !== undefined ? (surgicalClearanceGranted ? 1 : 0) : null,
      surgicalClearanceGranted !== undefined ? (surgicalClearanceGranted ? 1 : 0) : null,
      surgeryPerformed !== undefined ? (surgeryPerformed ? 1 : 0) : null,
      surgeryPerformed !== undefined ? (surgeryPerformed ? 1 : 0) : null,
      pyloromyotomyTechnique ?? null,
      postopFeedingStarted !== undefined ? (postopFeedingStarted ? 1 : 0) : null,
      postopFeedingStarted !== undefined ? (postopFeedingStarted ? 1 : 0) : null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pyloric_stenosis.status_update',
      entity: 'pediatric_pyloric_stenosis_episodes',
      entityId: Number(id),
      detail: { status, surgeryPerformed },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/pediatric-pyloric-stenosis/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_pyloric_stenosis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.pyloric_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return { logs: rows };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-pyloric-stenosis/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePyloricStenosis(req);
    const { id } = req.params as { id: string };
    const data = parse(pyloricFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM pediatric_pyloric_stenosis_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric pyloric stenosis episode not found');

    const res = db.prepare(`
      INSERT INTO pediatric_pyloric_stenosis_flowsheet_logs (
        pyloric_episode_id, patient_id, log_datetime,
        hours_from_admission, serum_sodium_meq_l, serum_potassium_meq_l,
        serum_chloride_meq_l, serum_bicarbonate_meq_l, blood_ph,
        urine_output_ml_kg_hr, iv_fluid_rate_ml_hr, capillary_refill_seconds,
        vomiting_episodes_count, gastric_decompression_output_ml,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.serumSodiumMeqL ?? null,
      data.serumPotassiumMeqL ?? null,
      data.serumChlorideMeqL ?? null,
      data.serumBicarbonateMeqL ?? null,
      data.bloodPh ?? null,
      data.urineOutputMlKgHr,
      data.ivFluidRateMlHr,
      data.capillaryRefillSeconds ?? null,
      data.vomitingEpisodesCount,
      data.gastricDecompressionOutputMl ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pyloric_stenosis.flowsheet_add',
      entity: 'pediatric_pyloric_stenosis_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), hours: data.hoursFromAdmission, chloride: data.serumChlorideMeqL },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-pyloric-stenosis/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePyloricStenosis(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM pediatric_pyloric_stenosis_flowsheet_logs
      WHERE id = ? AND pyloric_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_pyloric_stenosis_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pyloric_stenosis.flowsheet_delete',
      entity: 'pediatric_pyloric_stenosis_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
