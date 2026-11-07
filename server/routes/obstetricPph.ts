import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluateObstetricPph,
  calculateGravimetricQbl,
  calculateShockIndex,
  checkUterotonicContraindications,
} from '../../web/src/obstetricPphEngine.js';

function assertCanManageObstetricPph(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical obstetricians and labor ward nurses can manage postpartum hemorrhage records');
  }
  return user;
}

export const obstetricPphEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  deliveryMode: z.enum(['vaginal', 'cesarean']).default('vaginal'),
  pphRecognitionDatetime: z.string().min(1, 'PPH recognition datetime is required'),
  gestationWeeks: z.number().min(20).max(44).nullable().optional(),
  drapeBloodVolumeMl: z.number().min(0).max(5000).default(0),
  swabSpongeWeightNetG: z.number().min(0).max(5000).default(0),
  initialSbp: z.number().int().min(40).max(250),
  initialDbp: z.number().int().min(20).max(180),
  initialHeartRate: z.number().int().min(30).max(220),
  etiology4t: z.enum(['tone_atony', 'trauma_laceration', 'tissue_retained', 'thrombin_coagulopathy']).default('tone_atony'),
  maternalHypertensionHistory: z.boolean().default(false),
  maternalAsthmaHistory: z.boolean().default(false),
  emotiveMassageDone: z.boolean().default(false),
  emotiveOxytocinGiven: z.boolean().default(false),
  emotiveTxaGiven: z.boolean().default(false),
  emotiveIvFluidsGiven: z.boolean().default(false),
  emotiveExamCompleted: z.boolean().default(false),
  emotiveEscalationNeeded: z.boolean().default(false),
  bakriBalloonPlaced: z.boolean().default(false),
  bakriFillVolumeMl: z.number().min(0).max(800).default(0),
  tamponadeTestResult: z.enum(['not_performed', 'success_bleeding_stopped', 'failure_ongoing_bleeding']).default('not_performed'),
  status: z.enum([
    'resuscitation_active',
    'tamponade_active',
    'stabilized',
    'surgical_escalation',
    'resolved',
  ]).default('resuscitation_active'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const obstetricPphFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromRecognition: z.number().int().min(0).max(1440).default(0),
  intervalBloodLossMl: z.number().min(0).max(4000).default(0),
  sbp: z.number().int().min(40).max(250),
  dbp: z.number().int().min(20).max(180),
  heartRateBpm: z.number().int().min(30).max(220),
  uterineTone: z.enum(['firm_contracted', 'boggy_soft', 'relaxed']).default('firm_contracted'),
  medicationGiven: z.string().max(250).nullable().optional(),
  bakriDrainageMl: z.number().min(0).max(2000).default(0),
  urineOutputMl: z.number().min(0).max(1000).default(0),
  notes: z.string().max(500).nullable().optional(),
});

export function registerObstetricPphRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Preview Calculation Endpoint
  app.post('/api/obstetric-pph/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        deliveryMode: z.enum(['vaginal', 'cesarean']).default('vaginal'),
        drapeBloodVolumeMl: z.number().min(0).max(5000).default(0),
        swabSpongeWeightNetG: z.number().min(0).max(5000).default(0),
        sbp: z.number().int().min(40).max(250),
        dbp: z.number().int().min(20).max(180),
        heartRate: z.number().int().min(30).max(220),
        maternalHypertensionHistory: z.boolean().default(false),
        maternalAsthmaHistory: z.boolean().default(false),
      }),
      req.body,
    );

    const evalResult = evaluateObstetricPph({
      deliveryMode: body.deliveryMode,
      drapeBloodVolumeMl: body.drapeBloodVolumeMl,
      swabSpongeWeightNetG: body.swabSpongeWeightNetG,
      sbp: body.sbp,
      dbp: body.dbp,
      heartRate: body.heartRate,
      maternalHypertensionHistory: body.maternalHypertensionHistory,
      maternalAsthmaHistory: body.maternalAsthmaHistory,
    });

    return { evalResult };
  });

  // 2. Create PPH Episode
  app.post('/api/obstetric-pph/episodes', async (req, reply) => {
    const user = assertCanManageObstetricPph(req);
    const data = parse(obstetricPphEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateObstetricPph({
      deliveryMode: data.deliveryMode,
      drapeBloodVolumeMl: data.drapeBloodVolumeMl,
      swabSpongeWeightNetG: data.swabSpongeWeightNetG,
      sbp: data.initialSbp,
      dbp: data.initialDbp,
      heartRate: data.initialHeartRate,
      maternalHypertensionHistory: data.maternalHypertensionHistory,
      maternalAsthmaHistory: data.maternalAsthmaHistory,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `PPH-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_pph_episodes (
        patient_id, admission_id, episode_code, delivery_mode,
        pph_recognition_datetime, gestation_weeks, gravimetric_qbl_ml,
        drape_blood_volume_ml, swab_sponge_weight_net_g, initial_sbp,
        initial_dbp, initial_heart_rate, shock_index, etiology_4t,
        maternal_hypertension_history, maternal_asthma_history,
        emotive_massage_done, emotive_oxytocin_given, emotive_txa_given,
        emotive_iv_fluids_given, emotive_exam_completed, emotive_escalation_needed,
        bakri_balloon_placed, bakri_fill_volume_ml, tamponade_test_result,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.deliveryMode,
      data.pphRecognitionDatetime,
      data.gestationWeeks ?? null,
      evalResult.cumulativeQblMl,
      data.drapeBloodVolumeMl,
      data.swabSpongeWeightNetG,
      data.initialSbp,
      data.initialDbp,
      data.initialHeartRate,
      evalResult.shockIndex,
      data.etiology4t,
      data.maternalHypertensionHistory ? 1 : 0,
      data.maternalAsthmaHistory ? 1 : 0,
      data.emotiveMassageDone ? 1 : 0,
      data.emotiveOxytocinGiven ? 1 : 0,
      data.emotiveTxaGiven ? 1 : 0,
      data.emotiveIvFluidsGiven ? 1 : 0,
      data.emotiveExamCompleted ? 1 : 0,
      data.emotiveEscalationNeeded ? 1 : 0,
      data.bakriBalloonPlaced ? 1 : 0,
      data.bakriFillVolumeMl,
      data.tamponadeTestResult,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM obstetric_pph_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pph.episode_create',
      entity: 'obstetric_pph_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        deliveryMode: data.deliveryMode,
        cumulativeQblMl: evalResult.cumulativeQblMl,
        shockIndex: evalResult.shockIndex,
        severityTier: evalResult.severityTier,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/obstetric-pph/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM obstetric_pph_episodes WHERE 1=1';
    const params: any[] = [];

    if (query.patientId) {
      sql += ' AND patient_id = ?';
      params.push(query.patientId);
    }
    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY pph_recognition_datetime DESC';

    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 4. Get Single Episode with Flowsheet
  app.get('/api/obstetric-pph/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM obstetric_pph_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric PPH episode not found');

    const logs = db
      .prepare('SELECT * FROM obstetric_pph_flowsheet_logs WHERE pph_episode_id = ? ORDER BY minutes_from_recognition ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-pph/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPph(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(obstetricPphEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM obstetric_pph_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric PPH episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.emotiveMassageDone !== undefined) {
      fields.push('emotive_massage_done = ?');
      values.push(data.emotiveMassageDone ? 1 : 0);
    }
    if (data.emotiveOxytocinGiven !== undefined) {
      fields.push('emotive_oxytocin_given = ?');
      values.push(data.emotiveOxytocinGiven ? 1 : 0);
    }
    if (data.emotiveTxaGiven !== undefined) {
      fields.push('emotive_txa_given = ?');
      values.push(data.emotiveTxaGiven ? 1 : 0);
    }
    if (data.emotiveIvFluidsGiven !== undefined) {
      fields.push('emotive_iv_fluids_given = ?');
      values.push(data.emotiveIvFluidsGiven ? 1 : 0);
    }
    if (data.emotiveExamCompleted !== undefined) {
      fields.push('emotive_exam_completed = ?');
      values.push(data.emotiveExamCompleted ? 1 : 0);
    }
    if (data.emotiveEscalationNeeded !== undefined) {
      fields.push('emotive_escalation_needed = ?');
      values.push(data.emotiveEscalationNeeded ? 1 : 0);
    }
    if (data.bakriBalloonPlaced !== undefined) {
      fields.push('bakri_balloon_placed = ?');
      values.push(data.bakriBalloonPlaced ? 1 : 0);
    }
    if (data.bakriFillVolumeMl !== undefined) {
      fields.push('bakri_fill_volume_ml = ?');
      values.push(data.bakriFillVolumeMl);
    }
    if (data.tamponadeTestResult !== undefined) {
      fields.push('tamponade_test_result = ?');
      values.push(data.tamponadeTestResult);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE obstetric_pph_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM obstetric_pph_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pph.episode_update',
      entity: 'obstetric_pph_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-pph/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPph(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM obstetric_pph_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric PPH episode not found');

    db.prepare('DELETE FROM obstetric_pph_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pph.episode_delete',
      entity: 'obstetric_pph_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-pph/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricPph(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(obstetricPphFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM obstetric_pph_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric PPH episode not found');

    const newCumulative = episode.gravimetric_qbl_ml + data.intervalBloodLossMl;
    const shockIndex = calculateShockIndex(data.heartRateBpm, data.sbp);

    const stmt = db.prepare(`
      INSERT INTO obstetric_pph_flowsheet_logs (
        pph_episode_id, patient_id, log_datetime, minutes_from_recognition,
        interval_blood_loss_ml, cumulative_qbl_ml, sbp, dbp,
        heart_rate_bpm, calculated_shock_index, uterine_tone,
        medication_given, bakri_drainage_ml, urine_output_ml, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromRecognition,
      data.intervalBloodLossMl,
      newCumulative,
      data.sbp,
      data.dbp,
      data.heartRateBpm,
      shockIndex,
      data.uterineTone,
      data.medicationGiven ?? null,
      data.bakriDrainageMl,
      data.urineOutputMl,
      data.notes ?? null,
      user.id,
    );

    // Update episode cumulative blood loss and shock index
    db.prepare(`
      UPDATE obstetric_pph_episodes
      SET gravimetric_qbl_ml = ?, shock_index = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newCumulative, shockIndex, id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pph.flowsheet_log',
      entity: 'obstetric_pph_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        newCumulativeQblMl: newCumulative,
        shockIndex,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      newCumulativeQblMl: newCumulative,
      shockIndex,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-pph/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageObstetricPph(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db
      .prepare('SELECT * FROM obstetric_pph_flowsheet_logs WHERE id = ? AND pph_episode_id = ?')
      .get(logId, episodeId) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_pph_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pph.flowsheet_delete',
      entity: 'obstetric_pph_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, patientId: log.patient_id },
    });

    return { success: true };
  });

  // 9. Printable Dossier Endpoint
  app.get('/api/obstetric-pph/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM obstetric_pph_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric PPH episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id) as any;
    const logs = db
      .prepare('SELECT * FROM obstetric_pph_flowsheet_logs WHERE pph_episode_id = ? ORDER BY minutes_from_recognition ASC')
      .all(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pph.print',
      entity: 'obstetric_pph_episodes',
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
