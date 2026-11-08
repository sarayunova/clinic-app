import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalMeconiumIleus,
} from '../../web/src/neonatalMeconiumIleusEngine.js';

function assertCanManageMeconiumIleus(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal meconium ileus protocols');
  }
  return user;
}

const meconiumEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageHours: z.coerce.number().int().min(0).max(720),
  weightKg: z.coerce.number().min(0.4).max(15.0),
  meconiumPassedYet: z.boolean().default(false),
  abdominalDistension: z.enum(['absent', 'mild', 'marked_tense']),
  emesisCharacter: z.enum(['none', 'gastric_clear', 'bilious_green']),
  palpableDoughyMasses: z.boolean().default(true),
  familyHistoryCysticFibrosis: z.boolean().default(false),
  plainAbdominalXrayFindings: z.enum([
    'neuhauser_soap_bubble_sign',
    'dilated_loops_no_fluid_levels',
    'calcifications_meconium_peritonitis',
    'pneumoperitoneum_free_air',
    'non_specific_distension',
  ]),
  contrastEnemaPerformed: z.boolean().default(true),
  contrastEnemaType: z.enum([
    'gastrografin_dilute',
    'omnipaque_water_soluble',
    'barium_contraindicated',
    'none',
  ]),
  microcolonConfirmed: z.boolean().default(true),
  meconiumPelletsVisualized: z.boolean().default(true),
  complicationPresent: z.enum([
    'uncomplicated_simple_ileus',
    'volvulus_gangrene',
    'atresia_segmental',
    'meconium_peritonitis_pseudocyst',
    'perforation_free_air',
  ]),
  enemaAttemptsCount: z.coerce.number().int().min(0).max(10).default(1),
  enemaSuccessOutcome: z.enum([
    'successful_evacuation_reflux_into_ileum',
    'partial_evacuation_repeat_indicated',
    'failed_refractory_obstruction',
    'procedure_aborted_perforation_risk',
    'not_attempted_surgery_first',
  ]),
  surgeryIndicated: z.boolean().default(false),
  surgicalProcedurePlanned: z.enum([
    'none_medical_decompression',
    'bishop_koop_t_tube_enterostomy',
    'santulli_enterostomy',
    'resection_primary_anastomosis',
    'laparotomy_enterotomy_irrigation',
  ]).default('none_medical_decompression'),
  cftrGeneMutationSent: z.boolean().default(true),
  pancreaticEnzymeReplacementStarted: z.boolean().default(false),
  status: z.enum([
    'initial_contrast_decompression',
    'repeat_enema_observation',
    'in_operating_room_enterostomy',
    'post_op_stoma_recovery',
    'resolved_normal_stooling',
  ]).default('initial_contrast_decompression'),
  clinicalNotes: z.string().optional().nullable(),
});

const meconiumFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromOnset: z.coerce.number().min(0).max(720),
  abdominalGirthCm: z.coerce.number().min(15.0).max(65.0),
  gastricAspirateMl: z.coerce.number().min(0).max(500).optional().nullable(),
  gastricAspirateColor: z.string().optional().nullable(),
  meconiumEvacuatedAmount: z.enum([
    'none',
    'scant_mucus',
    'small_hard_pellets',
    'large_thick_meconium_plug',
    'copious_liquid_meconium',
  ]),
  hydrationStatus: z.enum([
    'euvolemic',
    'mild_hypovolemia',
    'moderate_dehydration',
    'severe_shock',
  ]),
  urineOutputMlKgHr: z.coerce.number().min(0).max(20).optional().nullable(),
  serumSodiumMeqL: z.coerce.number().min(100).max(180).optional().nullable(),
  heartRate: z.coerce.number().int().min(30).max(250),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalMeconiumIleusRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/neonatal-meconium-ileus/evaluate', async (req) => {
    assertCanManageMeconiumIleus(req);
    const body = req.body as any;

    const evaluation = evaluateNeonatalMeconiumIleus({
      ageHours: Number(body.ageHours || 24),
      weightKg: Number(body.weightKg || 3.1),
      meconiumPassedYet: Boolean(body.meconiumPassedYet),
      abdominalDistension: body.abdominalDistension || 'marked_tense',
      emesisCharacter: body.emesisCharacter || 'bilious_green',
      palpableDoughyMasses: body.palpableDoughyMasses !== undefined ? Boolean(body.palpableDoughyMasses) : true,
      familyHistoryCysticFibrosis: Boolean(body.familyHistoryCysticFibrosis),
      plainAbdominalXrayFindings: body.plainAbdominalXrayFindings || 'neuhauser_soap_bubble_sign',
      contrastEnemaPerformed: body.contrastEnemaPerformed !== undefined ? Boolean(body.contrastEnemaPerformed) : true,
      contrastEnemaType: body.contrastEnemaType || 'gastrografin_dilute',
      microcolonConfirmed: body.microcolonConfirmed !== undefined ? Boolean(body.microcolonConfirmed) : true,
      meconiumPelletsVisualized: body.meconiumPelletsVisualized !== undefined ? Boolean(body.meconiumPelletsVisualized) : true,
      complicationPresent: body.complicationPresent || 'uncomplicated_simple_ileus',
      enemaAttemptsCount: Number(body.enemaAttemptsCount || 1),
      enemaSuccessOutcome: body.enemaSuccessOutcome || 'successful_evacuation_reflux_into_ileum',
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-meconium-ileus/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_meconium_ileus_episodes e
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
  app.get('/api/neonatal-meconium-ileus/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_meconium_ileus_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal meconium ileus episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_meconium_ileus_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.meconium_ileus_episode_id = ?
      ORDER BY l.hours_from_onset ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateNeonatalMeconiumIleus({
      ageHours: episode.age_hours,
      weightKg: episode.weight_kg,
      meconiumPassedYet: Boolean(episode.meconium_passed_yet),
      abdominalDistension: episode.abdominal_distension,
      emesisCharacter: episode.emesis_character,
      palpableDoughyMasses: Boolean(episode.palpable_doughy_masses),
      familyHistoryCysticFibrosis: Boolean(episode.family_history_cystic_fibrosis),
      plainAbdominalXrayFindings: episode.plain_abdominal_xray_findings,
      contrastEnemaPerformed: Boolean(episode.contrast_enema_performed),
      contrastEnemaType: episode.contrast_enema_type,
      microcolonConfirmed: Boolean(episode.microcolon_confirmed),
      meconiumPelletsVisualized: Boolean(episode.meconium_pellets_visualized),
      complicationPresent: episode.complication_present,
      enemaAttemptsCount: episode.enema_attempts_count,
      enemaSuccessOutcome: episode.enema_success_outcome,
    });

    return { episode, flowsheet: flowsheetLogs, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/neonatal-meconium-ileus/episodes', async (req, reply) => {
    const user = assertCanManageMeconiumIleus(req);
    requirePerm(req, 'patient:write_clinical');
    const input = parse(meconiumEpisodeSchema, req.body);

    const evaluation = evaluateNeonatalMeconiumIleus({
      ageHours: input.ageHours,
      weightKg: input.weightKg,
      meconiumPassedYet: input.meconiumPassedYet,
      abdominalDistension: input.abdominalDistension,
      emesisCharacter: input.emesisCharacter,
      palpableDoughyMasses: input.palpableDoughyMasses,
      familyHistoryCysticFibrosis: input.familyHistoryCysticFibrosis,
      plainAbdominalXrayFindings: input.plainAbdominalXrayFindings,
      contrastEnemaPerformed: input.contrastEnemaPerformed,
      contrastEnemaType: input.contrastEnemaType,
      microcolonConfirmed: input.microcolonConfirmed,
      meconiumPelletsVisualized: input.meconiumPelletsVisualized,
      complicationPresent: input.complicationPresent,
      enemaAttemptsCount: input.enemaAttemptsCount,
      enemaSuccessOutcome: input.enemaSuccessOutcome,
    });

    const episodeCode = `MECIL-${Date.now().toString(36).toUpperCase()}`;

    const insert = db.prepare(`
      INSERT INTO neonatal_meconium_ileus_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        age_hours, weight_kg, meconium_passed_yet, abdominal_distension,
        emesis_character, palpable_doughy_masses, family_history_cystic_fibrosis,
        plain_abdominal_xray_findings, contrast_enema_performed, contrast_enema_type,
        microcolon_confirmed, meconium_pellets_visualized, complication_present,
        enema_attempts_count, enema_success_outcome, surgery_indicated,
        surgical_procedure_planned, cftr_gene_mutation_sent,
        pancreatic_enzyme_replacement_started, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?
      )
    `);

    const result = insert.run(
      input.patientId,
      input.admissionId ?? null,
      episodeCode,
      input.onsetDatetime,
      input.ageHours,
      input.weightKg,
      input.meconiumPassedYet ? 1 : 0,
      input.abdominalDistension,
      input.emesisCharacter,
      input.palpableDoughyMasses ? 1 : 0,
      input.familyHistoryCysticFibrosis ? 1 : 0,
      input.plainAbdominalXrayFindings,
      input.contrastEnemaPerformed ? 1 : 0,
      input.contrastEnemaType,
      input.microcolonConfirmed ? 1 : 0,
      input.meconiumPelletsVisualized ? 1 : 0,
      input.complicationPresent,
      input.enemaAttemptsCount,
      input.enemaSuccessOutcome,
      (evaluation.surgeryIndicated || input.surgeryIndicated) ? 1 : 0,
      input.surgicalProcedurePlanned,
      input.cftrGeneMutationSent ? 1 : 0,
      input.pancreaticEnzymeReplacementStarted ? 1 : 0,
      input.status,
      user.id,
      input.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_meconium_ileus.create',
      entity: 'neonatal_meconium_ileus_episodes',
      entityId: episodeId,
      detail: { episodeId, episodeCode, patientId: input.patientId, urgencyTier: evaluation.urgencyTier },
    });

    reply.status(201);
    return {
      episodeId,
      id: episodeId,
      episodeCode,
      urgencyTier: evaluation.urgencyTier,
      evaluation,
      success: true,
    };
  });

  // 5. Update Status
  app.patch('/api/neonatal-meconium-ileus/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageMeconiumIleus(req);
    const { id } = req.params as { id: string };

    const statusSchema = z.object({
      status: z.enum([
        'initial_contrast_decompression',
        'repeat_enema_observation',
        'in_operating_room_enterostomy',
        'post_op_stoma_recovery',
        'resolved_normal_stooling',
      ]),
      enemaSuccessOutcome: z.enum([
        'successful_evacuation_reflux_into_ileum',
        'partial_evacuation_repeat_indicated',
        'failed_refractory_obstruction',
        'procedure_aborted_perforation_risk',
        'not_attempted_surgery_first',
      ]).optional(),
      clinicalNotes: z.string().optional().nullable(),
    });

    const input = parse(statusSchema, req.body);

    const update = db.prepare(`
      UPDATE neonatal_meconium_ileus_episodes
      SET status = ?,
          enema_success_outcome = COALESCE(?, enema_success_outcome),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = update.run(input.status, input.enemaSuccessOutcome ?? null, input.clinicalNotes ?? null, Number(id));
    if (result.changes === 0) throw notFound('Episode not found');

    audit(db, {
      actorId: user.id,
      action: 'neonatal_meconium_ileus.status_update',
      entity: 'neonatal_meconium_ileus_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), newStatus: input.status },
    });

    return { success: true, status: input.status };
  });

  // 6. Add Flowsheet Entry
  const addFlowsheetHandler = async (req: FastifyRequest, reply: any) => {
    const user = assertCanManageMeconiumIleus(req);
    const { id } = req.params as { id: string };
    const input = parse(meconiumFlowsheetSchema, req.body);

    const episode = db.prepare(`
      SELECT patient_id FROM neonatal_meconium_ileus_episodes WHERE id = ?
    `).get(Number(id)) as { patient_id: number } | undefined;

    if (!episode) throw notFound('Neonatal meconium ileus episode not found');

    const insert = db.prepare(`
      INSERT INTO neonatal_meconium_ileus_flowsheet_logs (
        meconium_ileus_episode_id, patient_id, log_datetime, hours_from_onset,
        abdominal_girth_cm, gastric_aspirate_ml, gastric_aspirate_color,
        meconium_evacuated_amount, hydration_status, urine_output_ml_kg_hr,
        serum_sodium_meq_l, heart_rate, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const res = insert.run(
      Number(id),
      episode.patient_id,
      input.logDatetime,
      input.hoursFromOnset,
      input.abdominalGirthCm,
      input.gastricAspirateMl ?? null,
      input.gastricAspirateColor ?? null,
      input.meconiumEvacuatedAmount,
      input.hydrationStatus,
      input.urineOutputMlKgHr ?? null,
      input.serumSodiumMeqL ?? null,
      input.heartRate,
      input.notes ?? null,
      user.id
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_meconium_ileus.flowsheet_add',
      entity: 'neonatal_meconium_ileus_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, girth: input.abdominalGirthCm },
    });

    reply.status(201);
    return { id: logId, logId, success: true };
  };

  app.post('/api/neonatal-meconium-ileus/episodes/:id/flowsheet', addFlowsheetHandler);
  app.post('/api/neonatal-meconium-ileus/episodes/:id/flowsheet-logs', addFlowsheetHandler);

  // 7. Delete Flowsheet Entry
  app.delete('/api/neonatal-meconium-ileus/flowsheet/:id', async (req) => {
    const user = assertCanManageMeconiumIleus(req);
    const { id } = req.params as { id: string };

    const entry = db.prepare(`
      SELECT * FROM neonatal_meconium_ileus_flowsheet_logs WHERE id = ?
    `).get(Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_meconium_ileus_flowsheet_logs WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_meconium_ileus.flowsheet_delete',
      entity: 'neonatal_meconium_ileus_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: entry.meconium_ileus_episode_id },
    });

    return { success: true };
  });

  app.delete('/api/neonatal-meconium-ileus/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageMeconiumIleus(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const entry = db.prepare(`
      SELECT * FROM neonatal_meconium_ileus_flowsheet_logs WHERE id = ? AND meconium_ileus_episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_meconium_ileus_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_meconium_ileus.flowsheet_delete',
      entity: 'neonatal_meconium_ileus_flowsheet_logs',
      entityId: Number(logId),
      detail: { logId: Number(logId), episodeId: Number(id) },
    });

    return { success: true };
  });
}
