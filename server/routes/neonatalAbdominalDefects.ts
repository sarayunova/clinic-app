import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalAbdominalDefects,
} from '../../web/src/neonatalAbdominalDefectsEngine.js';

function assertCanManageAbdominalDefects(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal abdominal wall defect protocols');
  }
  return user;
}

const wallDefectEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  defectType: z.enum(['gastroschisis', 'omphalocele_intact', 'omphalocele_ruptured']),
  defectDiameterCm: z.coerce.number().min(0.5).max(25.0),
  cordInsertionSite: z.enum(['normal_left_of_defect', 'sac_apex', 'disrupted']),
  membraneSacPresent: z.boolean().default(false),
  evisceratedOrgans: z.enum(['small_and_large_bowel', 'bowel_and_liver', 'bowel_liver_spleen_gonads']),
  bowelCondition: z.enum(['healthy_normal_peristalsis', 'edematous_fibrin_peel', 'ischemic_gangrenous', 'perforated_atresia']),
  closureApproach: z.enum(['primary_bedside_sutureless', 'primary_operative_closure', 'staged_silo_reduction', 'delayed_escharotic_paint_and_wait']),
  siloType: z.enum(['none', 'preformed_spring_loaded_bedside', 'surgically_fashioned_dacron_silo']),
  siloHeightCm: z.coerce.number().min(0).max(30.0).optional().nullable(),
  currentBladderPressureMmHg: z.coerce.number().min(0).max(50.0).default(8.0),
  peakInspiratoryPressureCmH2O: z.coerce.number().min(5).max(60.0).default(16.0),
  beckwithWiedemannSuspected: z.boolean().default(false),
  cardiacEchoCompleted: z.boolean().default(false),
  associatedAnomaliesNote: z.string().optional().nullable(),
  status: z.enum([
    'initial_stabilization_silo_placement',
    'active_daily_serial_reduction',
    'ready_for_fascial_closure',
    'post_closure_compartment_monitoring',
    'resolved_enteral_feeds_established',
  ]).default('initial_stabilization_silo_placement'),
  clinicalNotes: z.string().optional().nullable(),
});

const wallDefectFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  dayOfReduction: z.coerce.number().int().min(1).max(30).default(1),
  siloHeightReducedCm: z.coerce.number().min(0).max(10.0).default(0.0),
  residualSiloHeightCm: z.coerce.number().min(0).max(30.0),
  bladderPressureMmHg: z.coerce.number().min(0).max(50.0),
  peakInspiratoryPressureCmH2O: z.coerce.number().min(5).max(60.0),
  urineOutputMlKgHr: z.coerce.number().min(0).max(20.0),
  lowerExtremityPerfusion: z.enum(['warm_pink_pulses_brisk', 'sluggish_cap_refill_delayed', 'pale_cool_pulses_diminished']),
  bowelVisceralColor: z.enum(['pink_viable', 'hyperemic_mild_edema', 'dusky_venous_congestion', 'ischemic_black']),
  heartRate: z.coerce.number().int().min(40).max(250),
  respiratoryRate: z.coerce.number().int().min(10).max(120),
  meanArterialPressureMmHg: z.coerce.number().min(20).max(120),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalAbdominalDefectsRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/neonatal-abdominal-defects/evaluate', async (req) => {
    assertCanManageAbdominalDefects(req);
    const body = req.body as any;

    const evaluation = evaluateNeonatalAbdominalDefects({
      defectType: body.defectType || 'gastroschisis',
      defectDiameterCm: Number(body.defectDiameterCm || 3.5),
      cordInsertionSite: body.cordInsertionSite || 'normal_left_of_defect',
      membraneSacPresent: Boolean(body.membraneSacPresent),
      evisceratedOrgans: body.evisceratedOrgans || 'small_and_large_bowel',
      bowelCondition: body.bowelCondition || 'edematous_fibrin_peel',
      closureApproach: body.closureApproach || 'staged_silo_reduction',
      siloType: body.siloType || 'preformed_spring_loaded_bedside',
      siloHeightCm: body.siloHeightCm !== undefined && body.siloHeightCm !== null ? Number(body.siloHeightCm) : 8.0,
      currentBladderPressureMmHg: Number(body.currentBladderPressureMmHg || 8.0),
      peakInspiratoryPressureCmH2O: Number(body.peakInspiratoryPressureCmH2O || 16.0),
      beckwithWiedemannSuspected: Boolean(body.beckwithWiedemannSuspected),
      cardiacEchoCompleted: Boolean(body.cardiacEchoCompleted),
      associatedAnomaliesNote: body.associatedAnomaliesNote || null,
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-abdominal-defects/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_wall_defect_episodes e
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

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/neonatal-abdominal-defects/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_wall_defect_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal abdominal wall defect episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_wall_defect_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.wall_defect_episode_id = ?
      ORDER BY l.day_of_reduction ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateNeonatalAbdominalDefects({
      defectType: episode.defect_type,
      defectDiameterCm: episode.defect_diameter_cm,
      cordInsertionSite: episode.cord_insertion_site,
      membraneSacPresent: Boolean(episode.membrane_sac_present),
      evisceratedOrgans: episode.eviscerated_organs,
      bowelCondition: episode.bowel_condition,
      closureApproach: episode.closure_approach,
      siloType: episode.silo_type,
      siloHeightCm: episode.silo_height_cm,
      currentBladderPressureMmHg: episode.current_bladder_pressure_mmhg,
      peakInspiratoryPressureCmH2O: episode.peak_inspiratory_pressure_cmh2o,
      beckwithWiedemannSuspected: Boolean(episode.beckwith_wiedemann_suspected),
      cardiacEchoCompleted: Boolean(episode.cardiac_echo_completed),
      associatedAnomaliesNote: episode.associated_anomalies_note,
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/neonatal-abdominal-defects/episodes', async (req) => {
    const user = assertCanManageAbdominalDefects(req);
    const data = parse(wallDefectEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM neonatal_wall_defect_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `DEFECT-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_wall_defect_episodes (
        patient_id, admission_id, episode_code, defect_type, defect_diameter_cm,
        cord_insertion_site, membrane_sac_present, eviscerated_organs, bowel_condition,
        closure_approach, silo_type, silo_height_cm, current_bladder_pressure_mmhg,
        peak_inspiratory_pressure_cmh2o, beckwith_wiedemann_suspected,
        cardiac_echo_completed, associated_anomalies_note, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.defectType,
      data.defectDiameterCm,
      data.cordInsertionSite,
      data.membraneSacPresent ? 1 : 0,
      data.evisceratedOrgans,
      data.bowelCondition,
      data.closureApproach,
      data.siloType,
      data.siloHeightCm || null,
      data.currentBladderPressureMmHg,
      data.peakInspiratoryPressureCmH2O,
      data.beckwithWiedemannSuspected ? 1 : 0,
      data.cardiacEchoCompleted ? 1 : 0,
      data.associatedAnomaliesNote || null,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_abdominal_defects.create',
      entity: 'neonatal_wall_defect_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM neonatal_wall_defect_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/neonatal-abdominal-defects/episodes/:id', async (req) => {
    const user = assertCanManageAbdominalDefects(req);
    const { id } = req.params as { id: string };
    const data = parse(wallDefectEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_wall_defect_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal abdominal wall defect episode not found');

    db.prepare(`
      UPDATE neonatal_wall_defect_episodes SET
        patient_id = ?, admission_id = ?, defect_type = ?, defect_diameter_cm = ?,
        cord_insertion_site = ?, membrane_sac_present = ?, eviscerated_organs = ?, bowel_condition = ?,
        closure_approach = ?, silo_type = ?, silo_height_cm = ?, current_bladder_pressure_mmhg = ?,
        peak_inspiratory_pressure_cmh2o = ?, beckwith_wiedemann_suspected = ?,
        cardiac_echo_completed = ?, associated_anomalies_note = ?, status = ?, clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.defectType,
      data.defectDiameterCm,
      data.cordInsertionSite,
      data.membraneSacPresent ? 1 : 0,
      data.evisceratedOrgans,
      data.bowelCondition,
      data.closureApproach,
      data.siloType,
      data.siloHeightCm || null,
      data.currentBladderPressureMmHg,
      data.peakInspiratoryPressureCmH2O,
      data.beckwithWiedemannSuspected ? 1 : 0,
      data.cardiacEchoCompleted ? 1 : 0,
      data.associatedAnomaliesNote || null,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_abdominal_defects.update',
      entity: 'neonatal_wall_defect_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    const episode = db.prepare(`SELECT * FROM neonatal_wall_defect_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Update Status
  app.patch('/api/neonatal-abdominal-defects/episodes/:id/status', async (req) => {
    const user = assertCanManageAbdominalDefects(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM neonatal_wall_defect_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal abdominal wall defect episode not found');

    db.prepare(`
      UPDATE neonatal_wall_defect_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_abdominal_defects.status_update',
      entity: 'neonatal_wall_defect_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/neonatal-abdominal-defects/episodes/:id', async (req) => {
    const user = assertCanManageAbdominalDefects(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM neonatal_wall_defect_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal abdominal wall defect episode not found');

    db.prepare(`DELETE FROM neonatal_wall_defect_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_abdominal_defects.delete',
      entity: 'neonatal_wall_defect_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/neonatal-abdominal-defects/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageAbdominalDefects(req);
    const { id } = req.params as { id: string };
    const data = parse(wallDefectFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM neonatal_wall_defect_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal abdominal wall defect episode not found');

    const result = db.prepare(`
      INSERT INTO neonatal_wall_defect_flowsheet_logs (
        wall_defect_episode_id, patient_id, log_datetime, day_of_reduction,
        silo_height_reduced_cm, residual_silo_height_cm, bladder_pressure_mmhg,
        peak_inspiratory_pressure_cmh2o, urine_output_ml_kg_hr, lower_extremity_perfusion,
        bowel_visceral_color, heart_rate, respiratory_rate, mean_arterial_pressure_mmhg,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.dayOfReduction,
      data.siloHeightReducedCm,
      data.residualSiloHeightCm,
      data.bladderPressureMmHg,
      data.peakInspiratoryPressureCmH2O,
      data.urineOutputMlKgHr,
      data.lowerExtremityPerfusion,
      data.bowelVisceralColor,
      data.heartRate,
      data.respiratoryRate,
      data.meanArterialPressureMmHg,
      data.notes || null,
      user.id
    );

    // Also update current bladder pressure & PIP on episode
    db.prepare(`
      UPDATE neonatal_wall_defect_episodes
      SET current_bladder_pressure_mmhg = ?,
          peak_inspiratory_pressure_cmh2o = ?,
          silo_height_cm = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(data.bladderPressureMmHg, data.peakInspiratoryPressureCmH2O, data.residualSiloHeightCm, Number(id));

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_abdominal_defects.flowsheet_add',
      entity: 'neonatal_wall_defect_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, bladderPressure: data.bladderPressureMmHg },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM neonatal_wall_defect_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/neonatal-abdominal-defects/flowsheet/:id', async (req) => {
    const user = assertCanManageAbdominalDefects(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM neonatal_wall_defect_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM neonatal_wall_defect_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_abdominal_defects.flowsheet_delete',
      entity: 'neonatal_wall_defect_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.wall_defect_episode_id },
    });

    return { ok: true };
  });
}
