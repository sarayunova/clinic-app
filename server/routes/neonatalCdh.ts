import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalCdh,
} from '../../web/src/neonatalCdhEngine.js';

function assertCanManageCdh(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal CDH protocols');
  }
  return user;
}

const cdhEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageHours: z.coerce.number().int().min(0).max(720),
  weightKg: z.coerce.number().min(0.4).max(15.0),
  defectSide: z.enum([
    'left_bochdalek',
    'right_bochdalek',
    'bilateral_bochdalek',
    'anterior_morgagni',
  ]),
  liverHerniationUp: z.boolean().default(false),
  observedExpectedLhrPercent: z.coerce.number().min(5.0).max(100.0),
  bagMaskAvoidedInDeliveryRoom: z.boolean().default(true),
  replogleSumpDecompressionActive: z.boolean().default(true),
  preductalSpo2Percent: z.coerce.number().int().min(40).max(100),
  postductalSpo2Percent: z.coerce.number().int().min(40).max(100),
  peakInspiratoryPressureCmh2o: z.coerce.number().min(10.0).max(50.0),
  peepCmh2o: z.coerce.number().min(2.0).max(15.0).default(4.5),
  paco2Mmhg: z.coerce.number().min(20.0).max(120.0),
  inhaledNitricOxideActive: z.boolean().default(false),
  sildenafilInfusionActive: z.boolean().default(false),
  surgicalRepairStatus: z.enum([
    'preop_physiological_stabilization',
    'ready_for_repair_criteria_met',
    'primary_repair_performed',
    'prosthetic_patch_repair_performed',
    'ecmo_cannulated_bridge',
  ]).default('preop_physiological_stabilization'),
  status: z.enum([
    'preop_gentle_ventilation',
    'pulmonary_hypertension_crisis',
    'in_operating_room_repair',
    'postop_ventilatory_weaning',
    'recovering_extubated',
    'resolved_discharged_home',
  ]).default('preop_gentle_ventilation'),
  clinicalNotes: z.string().optional().nullable(),
});

const cdhFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromAdmission: z.coerce.number().int().min(0).max(720),
  pipCmh2o: z.coerce.number().min(10.0).max(50.0),
  peepCmh2o: z.coerce.number().min(2.0).max(15.0),
  fio2Percent: z.coerce.number().min(21.0).max(100.0),
  preductalSpo2: z.coerce.number().int().min(40).max(100),
  postductalSpo2: z.coerce.number().int().min(40).max(100),
  arterialPh: z.coerce.number().min(6.8).max(7.8),
  paco2Mmhg: z.coerce.number().min(15.0).max(140.0),
  lactateMmolL: z.coerce.number().min(0.2).max(25.0),
  meanArterialPressureMmhg: z.coerce.number().min(15.0).max(90.0),
  inoPpm: z.coerce.number().min(0.0).max(80.0).default(0.0),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalCdhRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/neonatal-cdh/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(cdhEpisodeSchema.omit({ patientId: true }), req.body);
    const evaluation = evaluateNeonatalCdh({
      defectSide: data.defectSide,
      liverHerniationUp: data.liverHerniationUp,
      observedExpectedLhrPercent: data.observedExpectedLhrPercent,
      bagMaskAvoidedInDeliveryRoom: data.bagMaskAvoidedInDeliveryRoom,
      replogleSumpDecompressionActive: data.replogleSumpDecompressionActive,
      preductalSpo2Percent: data.preductalSpo2Percent,
      postductalSpo2Percent: data.postductalSpo2Percent,
      peakInspiratoryPressureCmh2o: data.peakInspiratoryPressureCmh2o,
      peepCmh2o: data.peepCmh2o,
      paco2Mmhg: data.paco2Mmhg,
      inhaledNitricOxideActive: data.inhaledNitricOxideActive,
      sildenafilInfusionActive: data.sildenafilInfusionActive,
      surgicalRepairStatus: data.surgicalRepairStatus,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-cdh/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*, p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_cdh_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];
    if (patientId) {
      query += ' WHERE e.patient_id = ?';
      params.push(Number(patientId));
    }
    query += ' ORDER BY e.id DESC';

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/neonatal-cdh/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_cdh_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal CDH episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_cdh_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.cdh_episode_id = ?
      ORDER BY l.hours_from_admission ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateNeonatalCdh({
      defectSide: episode.defect_side,
      liverHerniationUp: Boolean(episode.liver_herniation_up),
      observedExpectedLhrPercent: episode.observed_expected_lhr_percent,
      bagMaskAvoidedInDeliveryRoom: Boolean(episode.bag_mask_avoided_in_delivery_room),
      replogleSumpDecompressionActive: Boolean(episode.replogle_sump_decompression_active),
      preductalSpo2Percent: episode.preductal_spo2_percent,
      postductalSpo2Percent: episode.postductal_spo2_percent,
      peakInspiratoryPressureCmh2o: episode.peak_inspiratory_pressure_cmh2o,
      peepCmh2o: episode.peep_cmh2o,
      paco2Mmhg: episode.paco2_mmhg,
      inhaledNitricOxideActive: Boolean(episode.inhaled_nitric_oxide_active),
      sildenafilInfusionActive: Boolean(episode.sildenafil_infusion_active),
      surgicalRepairStatus: episode.surgical_repair_status,
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/neonatal-cdh/episodes', async (req) => {
    const user = assertCanManageCdh(req);
    const data = parse(cdhEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM neonatal_cdh_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `CDH-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_cdh_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_hours, weight_kg,
        defect_side, liver_herniation_up, observed_expected_lhr_percent,
        bag_mask_avoided_in_delivery_room, replogle_sump_decompression_active,
        preductal_spo2_percent, postductal_spo2_percent,
        peak_inspiratory_pressure_cmh2o, peep_cmh2o, paco2_mmhg,
        inhaled_nitric_oxide_active, sildenafil_infusion_active,
        surgical_repair_status, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.ageHours,
      data.weightKg,
      data.defectSide,
      data.liverHerniationUp ? 1 : 0,
      data.observedExpectedLhrPercent,
      data.bagMaskAvoidedInDeliveryRoom ? 1 : 0,
      data.replogleSumpDecompressionActive ? 1 : 0,
      data.preductalSpo2Percent,
      data.postductalSpo2Percent,
      data.peakInspiratoryPressureCmh2o,
      data.peepCmh2o,
      data.paco2Mmhg,
      data.inhaledNitricOxideActive ? 1 : 0,
      data.sildenafilInfusionActive ? 1 : 0,
      data.surgicalRepairStatus,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_cdh.create',
      entity: 'neonatal_cdh_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, defectSide: data.defectSide },
    });

    const episode = db.prepare(`SELECT * FROM neonatal_cdh_episodes WHERE id = ?`).get(episodeId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/neonatal-cdh/episodes/:id', async (req) => {
    const user = assertCanManageCdh(req);
    const { id } = req.params as { id: string };
    const data = parse(cdhEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_cdh_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal CDH episode not found');

    db.prepare(`
      UPDATE neonatal_cdh_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, age_hours = ?, weight_kg = ?,
        defect_side = ?, liver_herniation_up = ?, observed_expected_lhr_percent = ?,
        bag_mask_avoided_in_delivery_room = ?, replogle_sump_decompression_active = ?,
        preductal_spo2_percent = ?, postductal_spo2_percent = ?,
        peak_inspiratory_pressure_cmh2o = ?, peep_cmh2o = ?, paco2_mmhg = ?,
        inhaled_nitric_oxide_active = ?, sildenafil_infusion_active = ?,
        surgical_repair_status = ?, status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.ageHours,
      data.weightKg,
      data.defectSide,
      data.liverHerniationUp ? 1 : 0,
      data.observedExpectedLhrPercent,
      data.bagMaskAvoidedInDeliveryRoom ? 1 : 0,
      data.replogleSumpDecompressionActive ? 1 : 0,
      data.preductalSpo2Percent,
      data.postductalSpo2Percent,
      data.peakInspiratoryPressureCmh2o,
      data.peepCmh2o,
      data.paco2Mmhg,
      data.inhaledNitricOxideActive ? 1 : 0,
      data.sildenafilInfusionActive ? 1 : 0,
      data.surgicalRepairStatus,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_cdh.update',
      entity: 'neonatal_cdh_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status: data.status },
    });

    const episode = db.prepare(`SELECT * FROM neonatal_cdh_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Patch Status
  app.patch('/api/neonatal-cdh/episodes/:id/status', async (req) => {
    const user = assertCanManageCdh(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM neonatal_cdh_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal CDH episode not found');

    db.prepare(`
      UPDATE neonatal_cdh_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_cdh.status_change',
      entity: 'neonatal_cdh_episodes',
      entityId: Number(id),
      detail: { status },
    });

    return { ok: true };
  });

  // 7. Delete Episode (Doctor only)
  app.delete('/api/neonatal-cdh/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete CDH episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM neonatal_cdh_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal CDH episode not found');

    db.prepare(`DELETE FROM neonatal_cdh_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_cdh.delete',
      entity: 'neonatal_cdh_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/neonatal-cdh/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageCdh(req);
    const { id } = req.params as { id: string };
    const data = parse(cdhFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM neonatal_cdh_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal CDH episode not found');

    const result = db.prepare(`
      INSERT INTO neonatal_cdh_flowsheet_logs (
        cdh_episode_id, patient_id, log_datetime, hours_from_admission,
        pip_cmh2o, peep_cmh2o, fio2_percent, preductal_spo2, postductal_spo2,
        arterial_ph, paco2_mmhg, lactate_mmol_l, mean_arterial_pressure_mmhg,
        ino_ppm, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.pipCmh2o,
      data.peepCmh2o,
      data.fio2Percent,
      data.preductalSpo2,
      data.postductalSpo2,
      data.arterialPh,
      data.paco2Mmhg,
      data.lactateMmolL,
      data.meanArterialPressureMmhg,
      data.inoPpm,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_cdh.flowsheet_add',
      entity: 'neonatal_cdh_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, pip: data.pipCmh2o, preductal: data.preductalSpo2 },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM neonatal_cdh_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/neonatal-cdh/flowsheet/:id', async (req) => {
    const user = assertCanManageCdh(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM neonatal_cdh_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM neonatal_cdh_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_cdh.flowsheet_delete',
      entity: 'neonatal_cdh_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.cdh_episode_id },
    });

    return { ok: true };
  });
}
