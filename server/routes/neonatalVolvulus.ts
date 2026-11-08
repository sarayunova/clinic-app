import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalVolvulus,
} from '../../web/src/neonatalVolvulusEngine.js';

function assertCanManageVolvulus(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal volvulus protocols');
  }
  return user;
}

const volvulusEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageDays: z.coerce.number().int().min(0).max(180),
  weightKg: z.coerce.number().min(0.4).max(15.0),
  emesisColor: z.enum([
    'bilious_dark_green',
    'bilious_light_green_yellow',
    'non_bilious_gastric',
  ]),
  abdominalDistension: z.enum([
    'absent_scaphoid',
    'mild_epigastric',
    'marked_generalized',
  ]),
  abdominalTenderness: z.boolean().default(true),
  rectalBleedingMelena: z.boolean().default(false),
  peritonitisSigns: z.boolean().default(false),
  hemodynamicShock: z.boolean().default(false),
  serumLactateMmolL: z.coerce.number().min(0.1).max(30.0),
  bloodPh: z.coerce.number().min(6.5).max(7.8).optional().nullable(),
  baseExcessMeqL: z.coerce.number().min(-35.0).max(35.0).optional().nullable(),
  plainRadiographFinding: z.enum([
    'normal_gas_pattern',
    'gasless_abdomen',
    'double_bubble',
    'distended_stomach_scant_distal_gas',
    'pneumoperitoneum_free_air',
  ]),
  upperGiContrastDone: z.boolean().default(true),
  upperGiFinding: z.enum([
    'corkscrew_duodenum_positive',
    'ligament_of_treitz_right_sided',
    'duodenal_beaking_complete_obstruction',
    'normal_c_loop_treitz_left',
    'deferred_emergency_laparotomy',
  ]).optional().nullable(),
  dopplerUsWhirlpoolSign: z.boolean().default(false),
  dopplerSmaSmvInversion: z.boolean().default(false),
  status: z.enum([
    'emergent_surgical_consult',
    'in_operating_room_ladd',
    'post_op_bowel_recovery',
    'resolved_feeding_tolerated',
    'short_bowel_syndrome_care',
  ]).default('emergent_surgical_consult'),
  clinicalNotes: z.string().optional().nullable(),
});

const volvulusFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromOnset: z.coerce.number().min(0).max(720),
  serumLactateMmolL: z.coerce.number().min(0.1).max(30.0).optional().nullable(),
  heartRate: z.coerce.number().int().min(30).max(250),
  bloodPressureSys: z.coerce.number().int().min(20).max(150).optional().nullable(),
  bloodPressureDia: z.coerce.number().int().min(10).max(100).optional().nullable(),
  capillaryRefillSeconds: z.coerce.number().min(0).max(15).optional().nullable(),
  ngTubeOutputMl: z.coerce.number().min(0).max(1000).optional().nullable(),
  ngAspirateAppearance: z.string().optional().nullable(),
  abdominalExamNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalVolvulusRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/neonatal-volvulus/evaluate', async (req) => {
    assertCanManageVolvulus(req);
    const body = req.body as any;

    const evaluation = evaluateNeonatalVolvulus({
      ageDays: Number(body.ageDays || 5),
      weightKg: Number(body.weightKg || 3.2),
      emesisColor: body.emesisColor || 'bilious_dark_green',
      abdominalDistension: body.abdominalDistension || 'mild_epigastric',
      abdominalTenderness: body.abdominalTenderness !== undefined ? Boolean(body.abdominalTenderness) : true,
      rectalBleedingMelena: Boolean(body.rectalBleedingMelena),
      peritonitisSigns: Boolean(body.peritonitisSigns),
      hemodynamicShock: Boolean(body.hemodynamicShock),
      serumLactateMmolL: Number(body.serumLactateMmolL || 2.1),
      bloodPh: body.bloodPh !== undefined ? Number(body.bloodPh) : undefined,
      baseExcessMeqL: body.baseExcessMeqL !== undefined ? Number(body.baseExcessMeqL) : undefined,
      plainRadiographFinding: body.plainRadiographFinding || 'normal_gas_pattern',
      upperGiContrastDone: body.upperGiContrastDone !== undefined ? Boolean(body.upperGiContrastDone) : true,
      upperGiFinding: body.upperGiFinding || undefined,
      dopplerUsWhirlpoolSign: Boolean(body.dopplerUsWhirlpoolSign),
      dopplerSmaSmvInversion: Boolean(body.dopplerSmaSmvInversion),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-volvulus/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_volvulus_episodes e
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
  app.get('/api/neonatal-volvulus/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_volvulus_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal volvulus episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_volvulus_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.volvulus_episode_id = ?
      ORDER BY l.hours_from_onset ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateNeonatalVolvulus({
      ageDays: episode.age_days,
      weightKg: episode.weight_kg,
      emesisColor: episode.emesis_color,
      abdominalDistension: episode.abdominal_distension,
      abdominalTenderness: Boolean(episode.abdominal_tenderness),
      rectalBleedingMelena: Boolean(episode.rectal_bleeding_melena),
      peritonitisSigns: Boolean(episode.peritonitis_signs),
      hemodynamicShock: Boolean(episode.hemodynamic_shock),
      serumLactateMmolL: episode.serum_lactate_mmol_l,
      bloodPh: episode.blood_ph !== null ? episode.blood_ph : undefined,
      baseExcessMeqL: episode.base_excess_meq_l !== null ? episode.base_excess_meq_l : undefined,
      plainRadiographFinding: episode.plain_radiograph_finding,
      upperGiContrastDone: Boolean(episode.upper_gi_contrast_done),
      upperGiFinding: episode.upper_gi_finding || undefined,
      dopplerUsWhirlpoolSign: Boolean(episode.doppler_us_whirlpool_sign),
      dopplerSmaSmvInversion: Boolean(episode.doppler_sma_smv_inversion),
    });

    return { episode, flowsheet: flowsheetLogs, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/neonatal-volvulus/episodes', async (req, reply) => {
    const user = assertCanManageVolvulus(req);
    requirePerm(req, 'patient:write_clinical');
    const input = parse(volvulusEpisodeSchema, req.body);

    const evaluation = evaluateNeonatalVolvulus({
      ageDays: input.ageDays,
      weightKg: input.weightKg,
      emesisColor: input.emesisColor,
      abdominalDistension: input.abdominalDistension,
      abdominalTenderness: input.abdominalTenderness,
      rectalBleedingMelena: input.rectalBleedingMelena,
      peritonitisSigns: input.peritonitisSigns,
      hemodynamicShock: input.hemodynamicShock,
      serumLactateMmolL: input.serumLactateMmolL,
      bloodPh: input.bloodPh ?? undefined,
      baseExcessMeqL: input.baseExcessMeqL ?? undefined,
      plainRadiographFinding: input.plainRadiographFinding,
      upperGiContrastDone: input.upperGiContrastDone,
      upperGiFinding: input.upperGiFinding ?? undefined,
      dopplerUsWhirlpoolSign: input.dopplerUsWhirlpoolSign,
      dopplerSmaSmvInversion: input.dopplerSmaSmvInversion,
    });

    const episodeCode = `VOLV-${Date.now().toString(36).toUpperCase()}`;

    const insert = db.prepare(`
      INSERT INTO neonatal_volvulus_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        age_days, weight_kg, emesis_color, abdominal_distension,
        abdominal_tenderness, rectal_bleeding_melena, peritonitis_signs,
        hemodynamic_shock, serum_lactate_mmol_l, blood_ph, base_excess_meq_l,
        plain_radiograph_finding, upper_gi_contrast_done, upper_gi_finding,
        doppler_us_whirlpool_sign, doppler_sma_smv_inversion,
        urgency_tier, ladd_procedure_indicated,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const result = insert.run(
      input.patientId,
      input.admissionId ?? null,
      episodeCode,
      input.onsetDatetime,
      input.ageDays,
      input.weightKg,
      input.emesisColor,
      input.abdominalDistension,
      input.abdominalTenderness ? 1 : 0,
      input.rectalBleedingMelena ? 1 : 0,
      input.peritonitisSigns ? 1 : 0,
      input.hemodynamicShock ? 1 : 0,
      input.serumLactateMmolL,
      input.bloodPh ?? null,
      input.baseExcessMeqL ?? null,
      input.plainRadiographFinding,
      input.upperGiContrastDone ? 1 : 0,
      input.upperGiFinding ?? null,
      input.dopplerUsWhirlpoolSign ? 1 : 0,
      input.dopplerSmaSmvInversion ? 1 : 0,
      evaluation.urgencyTier,
      evaluation.laddProcedureIndicated ? 1 : 0,
      input.status,
      user.id,
      input.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_volvulus.create',
      entity: 'neonatal_volvulus_episodes',
      entityId: episodeId,
      detail: { episodeId, episodeCode, patientId: input.patientId, urgencyTier: evaluation.urgencyTier },
    });

    reply.status(201);
    return { episodeId, id: episodeId, episodeCode, urgencyTier: evaluation.urgencyTier, evaluation, success: true };
  });

  // 5. Update Status
  app.patch('/api/neonatal-volvulus/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageVolvulus(req);
    const { id } = req.params as { id: string };

    const statusSchema = z.object({
      status: z.enum([
        'emergent_surgical_consult',
        'in_operating_room_ladd',
        'post_op_bowel_recovery',
        'resolved_feeding_tolerated',
        'short_bowel_syndrome_care',
      ]),
      clinicalNotes: z.string().optional().nullable(),
    });

    const input = parse(statusSchema, req.body);

    const update = db.prepare(`
      UPDATE neonatal_volvulus_episodes
      SET status = ?, clinical_notes = COALESCE(?, clinical_notes), updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = update.run(input.status, input.clinicalNotes ?? null, Number(id));
    if (result.changes === 0) throw notFound('Episode not found');

    audit(db, {
      actorId: user.id,
      action: 'neonatal_volvulus.status_update',
      entity: 'neonatal_volvulus_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), newStatus: input.status },
    });

    return { success: true, status: input.status };
  });

  // 6. Add Flowsheet Entry (handles both routes)
  const addFlowsheetHandler = async (req: FastifyRequest, reply: any) => {
    const user = assertCanManageVolvulus(req);
    const { id } = req.params as { id: string };
    const input = parse(volvulusFlowsheetSchema, req.body);

    const episode = db.prepare(`
      SELECT patient_id FROM neonatal_volvulus_episodes WHERE id = ?
    `).get(Number(id)) as { patient_id: number } | undefined;

    if (!episode) throw notFound('Neonatal volvulus episode not found');

    const insert = db.prepare(`
      INSERT INTO neonatal_volvulus_flowsheet_logs (
        volvulus_episode_id, patient_id, log_datetime, hours_from_onset,
        serum_lactate_mmol_l, heart_rate, blood_pressure_sys, blood_pressure_dia,
        capillary_refill_seconds, ng_tube_output_ml, ng_aspirate_appearance,
        abdominal_exam_notes, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const res = insert.run(
      Number(id),
      episode.patient_id,
      input.logDatetime,
      input.hoursFromOnset,
      input.serumLactateMmolL ?? null,
      input.heartRate,
      input.bloodPressureSys ?? null,
      input.bloodPressureDia ?? null,
      input.capillaryRefillSeconds ?? null,
      input.ngTubeOutputMl ?? null,
      input.ngAspirateAppearance ?? null,
      input.abdominalExamNotes ?? null,
      input.notes ?? null,
      user.id
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_volvulus.flowsheet_add',
      entity: 'neonatal_volvulus_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, hoursFromOnset: input.hoursFromOnset },
    });

    reply.status(201);
    return { id: logId, logId, success: true };
  };

  app.post('/api/neonatal-volvulus/episodes/:id/flowsheet', addFlowsheetHandler);
  app.post('/api/neonatal-volvulus/episodes/:id/flowsheet-logs', addFlowsheetHandler);

  // 7. Delete Flowsheet Entry
  app.delete('/api/neonatal-volvulus/flowsheet/:id', async (req) => {
    const user = assertCanManageVolvulus(req);
    const { id } = req.params as { id: string };

    const entry = db.prepare(`
      SELECT * FROM neonatal_volvulus_flowsheet_logs WHERE id = ?
    `).get(Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_volvulus_flowsheet_logs WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_volvulus.flowsheet_delete',
      entity: 'neonatal_volvulus_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: entry.volvulus_episode_id },
    });

    return { success: true };
  });

  app.delete('/api/neonatal-volvulus/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageVolvulus(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const entry = db.prepare(`
      SELECT * FROM neonatal_volvulus_flowsheet_logs WHERE id = ? AND volvulus_episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_volvulus_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_volvulus.flowsheet_delete',
      entity: 'neonatal_volvulus_flowsheet_logs',
      entityId: Number(logId),
      detail: { logId: Number(logId), episodeId: Number(id) },
    });

    return { success: true };
  });
}
