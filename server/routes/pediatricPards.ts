import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluatePediatricPards,
  calculateOxygenationIndex,
  calculateOxygenSaturationIndex,
  calculateDrivingPressure,
} from '../../web/src/pediatricPardsEngine.js';

function assertCanManagePediatricPards(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical pediatricians and PICU nurses can manage pediatric ARDS records');
  }
  return user;
}

export const pediatricPardsEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDatetime: z.string().min(1, 'Diagnosis datetime is required'),
  ageMonths: z.number().int().min(0).max(216),
  weightKg: z.number().min(1.0).max(120.0),
  predictedBodyWeightKg: z.number().min(1.0).max(120.0).optional(),
  triggerCause: z.enum(['pneumonia', 'aspiration', 'sepsis_shock', 'trauma', 'drowning', 'other']).default('pneumonia'),
  ventilationMode: z.enum(['invasive_mechanical', 'non_invasive_cpap_bipap', 'high_frequency_oscillation']).default('invasive_mechanical'),
  currentPeepCmh2o: z.number().min(0).max(30).default(5.0),
  currentMapCmh2o: z.number().min(2).max(45).default(8.0),
  currentFio2Percent: z.number().min(21).max(100).default(40.0),
  pao2Mmhg: z.number().min(20).max(500).nullable().optional(),
  spo2Percent: z.number().min(50).max(100).default(95.0),
  plateauPressureLimitCmh2o: z.number().min(15).max(40).default(28.0),
  drivingPressureLimitCmh2o: z.number().min(8).max(25).default(15.0),
  pronePositioningActive: z.boolean().default(false),
  neuromuscularBlockadeActive: z.boolean().default(false),
  status: z.enum([
    'acute_management',
    'stabilized_weaning',
    'extubated',
    'picu_stepdown',
    'resolved',
  ]).default('acute_management'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const pediatricPardsFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursOnProtocol: z.number().min(0).max(720).default(0),
  pipCmh2o: z.number().min(5).max(60).nullable().optional(),
  plateauPressureCmh2o: z.number().min(5).max(50).nullable().optional(),
  peepCmh2o: z.number().min(0).max(30).default(5.0),
  mapCmh2o: z.number().min(2).max(45).default(8.0),
  fio2Percent: z.number().min(21).max(100).default(40.0),
  tidalVolumeSetMl: z.number().min(5).max(1000).nullable().optional(),
  tidalVolumeMeasuredMlKg: z.number().min(1).max(20).nullable().optional(),
  respiratoryRateSet: z.number().int().min(5).max(80).nullable().optional(),
  respiratoryRateTotal: z.number().int().min(5).max(100).nullable().optional(),
  abgPh: z.number().min(6.8).max(7.8).nullable().optional(),
  abgPao2Mmhg: z.number().min(20).max(500).nullable().optional(),
  abgPco2Mmhg: z.number().min(15).max(150).nullable().optional(),
  abgHco3MeqL: z.number().min(5).max(60).nullable().optional(),
  spo2Percent: z.number().min(50).max(100).nullable().optional(),
  pronePositioningHours: z.number().min(0).max(24).default(0),
  notes: z.string().max(500).nullable().optional(),
});

export function registerPediatricPardsRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Preview Calculation Endpoint
  app.post('/api/pediatric-pards/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        ageMonths: z.number().int().min(0).max(216),
        weightKg: z.number().min(1.0).max(120.0),
        predictedBodyWeightKg: z.number().min(1.0).max(120.0).optional(),
        ventilationMode: z.enum(['invasive_mechanical', 'non_invasive_cpap_bipap', 'high_frequency_oscillation']).default('invasive_mechanical'),
        mapCmh2o: z.number().min(2).max(45).default(8.0),
        peepCmh2o: z.number().min(0).max(30).default(5.0),
        plateauPressureCmh2o: z.number().min(5).max(50).optional(),
        fio2Percent: z.number().min(21).max(100).default(40.0),
        pao2Mmhg: z.number().min(20).max(500).optional(),
        spo2Percent: z.number().min(50).max(100).default(95.0),
        measuredTidalVolumeMl: z.number().min(5).max(1000).optional(),
        abgPh: z.number().min(6.8).max(7.8).optional(),
      }),
      req.body,
    );

    const evalResult = evaluatePediatricPards({
      ageMonths: body.ageMonths,
      weightKg: body.weightKg,
      predictedBodyWeightKg: body.predictedBodyWeightKg,
      ventilationMode: body.ventilationMode,
      mapCmh2o: body.mapCmh2o,
      peepCmh2o: body.peepCmh2o,
      plateauPressureCmh2o: body.plateauPressureCmh2o,
      fio2Percent: body.fio2Percent,
      pao2Mmhg: body.pao2Mmhg,
      spo2Percent: body.spo2Percent,
      measuredTidalVolumeMl: body.measuredTidalVolumeMl,
      abgPh: body.abgPh,
    });

    return { evalResult };
  });

  // 2. Create PARDS Episode
  app.post('/api/pediatric-pards/episodes', async (req, reply) => {
    const user = assertCanManagePediatricPards(req);
    const data = parse(pediatricPardsEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const pbw = data.predictedBodyWeightKg ?? data.weightKg;
    const evalResult = evaluatePediatricPards({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      predictedBodyWeightKg: pbw,
      ventilationMode: data.ventilationMode,
      mapCmh2o: data.currentMapCmh2o,
      peepCmh2o: data.currentPeepCmh2o,
      fio2Percent: data.currentFio2Percent,
      pao2Mmhg: data.pao2Mmhg ?? undefined,
      spo2Percent: data.spo2Percent,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `PARDS-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_pards_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        age_months, weight_kg, predicted_body_weight_kg, trigger_cause,
        ventilation_mode, current_peep_cmh2o, current_map_cmh2o,
        current_fio2_percent, pao2_mmhg, spo2_percent, calculated_oi,
        calculated_osi, pards_severity, target_tidal_volume_ml_min,
        target_tidal_volume_ml_max, plateau_pressure_limit_cmh2o,
        driving_pressure_limit_cmh2o, prone_positioning_active,
        neuromuscular_blockade_active, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
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
      data.ageMonths,
      data.weightKg,
      pbw,
      data.triggerCause,
      data.ventilationMode,
      data.currentPeepCmh2o,
      data.currentMapCmh2o,
      data.currentFio2Percent,
      data.pao2Mmhg ?? null,
      data.spo2Percent,
      evalResult.oxygenationIndex,
      evalResult.oxygenSaturationIndex,
      evalResult.pardsSeverity,
      evalResult.targetTidalVolumeMinMl,
      evalResult.targetTidalVolumeMaxMl,
      data.plateauPressureLimitCmh2o,
      data.drivingPressureLimitCmh2o,
      data.pronePositioningActive ? 1 : 0,
      data.neuromuscularBlockadeActive ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM pediatric_pards_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pards.episode_create',
      entity: 'pediatric_pards_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        triggerCause: data.triggerCause,
        pardsSeverity: evalResult.pardsSeverity,
        calculatedOi: evalResult.oxygenationIndex,
        calculatedOsi: evalResult.oxygenSaturationIndex,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/pediatric-pards/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM pediatric_pards_episodes WHERE 1=1';
    const params: any[] = [];

    if (query.patientId) {
      sql += ' AND patient_id = ?';
      params.push(query.patientId);
    }
    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY diagnosis_datetime DESC';

    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 4. Get Single Episode with Flowsheet
  app.get('/api/pediatric-pards/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM pediatric_pards_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric PARDS episode not found');

    const logs = db
      .prepare('SELECT * FROM pediatric_pards_flowsheet_logs WHERE pards_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-pards/episodes/:id', async (req) => {
    const user = assertCanManagePediatricPards(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(pediatricPardsEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM pediatric_pards_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric PARDS episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.currentPeepCmh2o !== undefined) {
      fields.push('current_peep_cmh2o = ?');
      values.push(data.currentPeepCmh2o);
    }
    if (data.currentMapCmh2o !== undefined) {
      fields.push('current_map_cmh2o = ?');
      values.push(data.currentMapCmh2o);
    }
    if (data.currentFio2Percent !== undefined) {
      fields.push('current_fio2_percent = ?');
      values.push(data.currentFio2Percent);
    }
    if (data.pronePositioningActive !== undefined) {
      fields.push('prone_positioning_active = ?');
      values.push(data.pronePositioningActive ? 1 : 0);
    }
    if (data.neuromuscularBlockadeActive !== undefined) {
      fields.push('neuromuscular_blockade_active = ?');
      values.push(data.neuromuscularBlockadeActive ? 1 : 0);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE pediatric_pards_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM pediatric_pards_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pards.episode_update',
      entity: 'pediatric_pards_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-pards/episodes/:id', async (req) => {
    const user = assertCanManagePediatricPards(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM pediatric_pards_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric PARDS episode not found');

    db.prepare('DELETE FROM pediatric_pards_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pards.episode_delete',
      entity: 'pediatric_pards_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-pards/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricPards(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(pediatricPardsFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM pediatric_pards_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric PARDS episode not found');

    const oi = calculateOxygenationIndex(data.mapCmh2o, data.fio2Percent, data.abgPao2Mmhg ?? undefined);
    const osi = calculateOxygenSaturationIndex(data.mapCmh2o, data.fio2Percent, data.spo2Percent ?? 95.0);
    const drivingPressure = calculateDrivingPressure(data.plateauPressureCmh2o ?? undefined, data.peepCmh2o);

    const weight = episode.predicted_body_weight_kg > 0 ? episode.predicted_body_weight_kg : episode.weight_kg;
    let measuredVtMlKg = data.tidalVolumeMeasuredMlKg;
    if (!measuredVtMlKg && data.tidalVolumeSetMl && weight > 0) {
      measuredVtMlKg = Math.round((data.tidalVolumeSetMl / weight) * 10) / 10;
    }

    const stmt = db.prepare(`
      INSERT INTO pediatric_pards_flowsheet_logs (
        pards_episode_id, patient_id, log_datetime, hours_on_protocol,
        pip_cmh2o, plateau_pressure_cmh2o, peep_cmh2o,
        calculated_driving_pressure_cmh2o, map_cmh2o, fio2_percent,
        tidal_volume_set_ml, tidal_volume_measured_ml_kg,
        respiratory_rate_set, respiratory_rate_total, abg_ph,
        abg_pao2_mmhg, abg_pco2_mmhg, abg_hco3_meq_l,
        spo2_percent, calculated_oi, calculated_osi,
        prone_positioning_hours, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursOnProtocol,
      data.pipCmh2o ?? null,
      data.plateauPressureCmh2o ?? null,
      data.peepCmh2o,
      drivingPressure,
      data.mapCmh2o,
      data.fio2Percent,
      data.tidalVolumeSetMl ?? null,
      measuredVtMlKg ?? null,
      data.respiratoryRateSet ?? null,
      data.respiratoryRateTotal ?? null,
      data.abgPh ?? null,
      data.abgPao2Mmhg ?? null,
      data.abgPco2Mmhg ?? null,
      data.abgHco3MeqL ?? null,
      data.spo2Percent ?? null,
      oi,
      osi,
      data.pronePositioningHours,
      data.notes ?? null,
      user.id,
    );

    // Update episode current ventilation metrics
    let newSeverity = episode.pards_severity;
    if (oi !== null) {
      if (oi >= 16) newSeverity = 'severe';
      else if (oi >= 8) newSeverity = 'moderate';
      else if (oi >= 4) newSeverity = 'mild';
      else newSeverity = 'none_at_risk';
    } else if (osi !== null) {
      if (osi >= 12.3) newSeverity = 'severe';
      else if (osi >= 7.5) newSeverity = 'moderate';
      else if (osi >= 5.0) newSeverity = 'mild';
      else newSeverity = 'none_at_risk';
    }

    db.prepare(`
      UPDATE pediatric_pards_episodes
      SET current_peep_cmh2o = ?, current_map_cmh2o = ?, current_fio2_percent = ?,
          pao2_mmhg = COALESCE(?, pao2_mmhg), spo2_percent = COALESCE(?, spo2_percent),
          calculated_oi = ?, calculated_osi = ?, pards_severity = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.peepCmh2o,
      data.mapCmh2o,
      data.fio2Percent,
      data.abgPao2Mmhg ?? null,
      data.spo2Percent ?? null,
      oi,
      osi,
      newSeverity,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pards.flowsheet_log',
      entity: 'pediatric_pards_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        calculatedOi: oi,
        calculatedOsi: osi,
        drivingPressure,
        severity: newSeverity,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      calculatedOi: oi,
      calculatedOsi: osi,
      drivingPressure,
      severity: newSeverity,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-pards/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricPards(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db
      .prepare('SELECT * FROM pediatric_pards_flowsheet_logs WHERE id = ? AND pards_episode_id = ?')
      .get(logId, episodeId) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_pards_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pards.flowsheet_delete',
      entity: 'pediatric_pards_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, patientId: log.patient_id },
    });

    return { success: true };
  });

  // 9. Printable Dossier Endpoint
  app.get('/api/pediatric-pards/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM pediatric_pards_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric PARDS episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id) as any;
    const logs = db
      .prepare('SELECT * FROM pediatric_pards_flowsheet_logs WHERE pards_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_pards.print',
      entity: 'pediatric_pards_episodes',
      entityId: id,
      detail: { patientId: episode.patient_id, episodeCode: episode.episode_code },
    });

    return {
      episode,
      patient,
      logs,
      printedAt: new Date().toISOString(),
      printedBy: user.fullName,
    };
  });
}
