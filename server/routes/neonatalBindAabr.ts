import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluateNeonatalBindAabr,
  calculateBindScore,
  calculateBARatio,
} from '../../web/src/neonatalBindAabrEngine.js';

function assertCanManageNeonatalBind(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical pediatricians and NICU nurses can manage neonatal BIND & AABR records');
  }
  return user;
}

export const neonatalBindEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  gestationalAgeWeeks: z.number().min(23).max(44),
  birthWeightGrams: z.number().min(400).max(6000),
  peakTsbMgDl: z.number().min(0.5).max(50.0),
  directBilirubinMgDl: z.number().min(0).max(30.0).nullable().optional(),
  albuminGDl: z.number().min(0.5).max(6.0).nullable().optional(),
  mentalStatusScore: z.number().int().min(0).max(3).default(0),
  muscleToneScore: z.number().int().min(0).max(3).default(0),
  cryScore: z.number().int().min(0).max(3).default(0),
  aabrRightEar: z.enum(['not_tested', 'pass', 'refer']).default('not_tested'),
  aabrLeftEar: z.enum(['not_tested', 'pass', 'refer']).default('not_tested'),
  aabrTestDatetime: z.string().nullable().optional(),
  exchangeTransfusionPerformed: z.boolean().default(false),
  ivigGiven: z.boolean().default(false),
  status: z.enum([
    'evaluating',
    'under_phototherapy',
    'post_exchange_transfusion',
    'cleared_pass',
    'high_risk_neuro_followup',
  ]).default('evaluating'),
  neuroAuditoryFollowupPlan: z.string().max(1000).nullable().optional(),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const neonatalBindFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromAdmission: z.number().min(0).max(720).default(0),
  mentalStatusScore: z.number().int().min(0).max(3).default(0),
  muscleToneScore: z.number().int().min(0).max(3).default(0),
  cryScore: z.number().int().min(0).max(3).default(0),
  tsbMgDl: z.number().min(0.5).max(50.0).nullable().optional(),
  phototherapyType: z.string().max(100).default('none'),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNeonatalBindAabrRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Preview Calculation Endpoint
  app.post('/api/neonatal-bind/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        gestationalAgeWeeks: z.number().min(23).max(44),
        birthWeightGrams: z.number().min(400).max(6000),
        peakTsbMgDl: z.number().min(0.5).max(50.0),
        albuminGDl: z.number().min(0.5).max(6.0).optional(),
        mentalStatusScore: z.number().int().min(0).max(3).default(0),
        muscleToneScore: z.number().int().min(0).max(3).default(0),
        cryScore: z.number().int().min(0).max(3).default(0),
        aabrRightEar: z.enum(['not_tested', 'pass', 'refer']).default('not_tested'),
        aabrLeftEar: z.enum(['not_tested', 'pass', 'refer']).default('not_tested'),
      }),
      req.body,
    );

    const evalResult = evaluateNeonatalBindAabr({
      gestationalAgeWeeks: body.gestationalAgeWeeks,
      birthWeightGrams: body.birthWeightGrams,
      peakTsbMgDl: body.peakTsbMgDl,
      albuminGDl: body.albuminGDl,
      mentalStatusScore: body.mentalStatusScore,
      muscleToneScore: body.muscleToneScore,
      cryScore: body.cryScore,
      aabrRightEar: body.aabrRightEar,
      aabrLeftEar: body.aabrLeftEar,
    });

    return { evalResult };
  });

  // 2. Create BIND Episode
  app.post('/api/neonatal-bind/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalBind(req);
    const data = parse(neonatalBindEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateNeonatalBindAabr({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      peakTsbMgDl: data.peakTsbMgDl,
      albuminGDl: data.albuminGDl ?? undefined,
      mentalStatusScore: data.mentalStatusScore,
      muscleToneScore: data.muscleToneScore,
      cryScore: data.cryScore,
      aabrRightEar: data.aabrRightEar,
      aabrLeftEar: data.aabrLeftEar,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `BIND-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_bind_aabr_episodes (
        patient_id, admission_id, episode_code, assessment_datetime,
        gestational_age_weeks, birth_weight_grams, peak_tsb_mg_dl,
        direct_bilirubin_mg_dl, albumin_g_dl, calculated_b_a_ratio,
        mental_status_score, muscle_tone_score, cry_score,
        total_bind_score, bind_severity, aabr_right_ear,
        aabr_left_ear, aabr_test_datetime, exchange_transfusion_performed,
        ivig_given, status, consultant_id, neuro_auditory_followup_plan,
        clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.assessmentDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.peakTsbMgDl,
      data.directBilirubinMgDl ?? null,
      data.albuminGDl ?? null,
      evalResult.calculatedBARatio,
      data.mentalStatusScore,
      data.muscleToneScore,
      data.cryScore,
      evalResult.totalBindScore,
      evalResult.bindSeverity,
      data.aabrRightEar,
      data.aabrLeftEar,
      data.aabrTestDatetime ?? null,
      data.exchangeTransfusionPerformed ? 1 : 0,
      data.ivigGiven ? 1 : 0,
      data.status,
      user.id,
      evalResult.followUpPlan,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM neonatal_bind_aabr_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bind.episode_create',
      entity: 'neonatal_bind_aabr_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        peakTsbMgDl: data.peakTsbMgDl,
        totalBindScore: evalResult.totalBindScore,
        bindSeverity: evalResult.bindSeverity,
        bARatio: evalResult.calculatedBARatio,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/neonatal-bind/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM neonatal_bind_aabr_episodes WHERE 1=1';
    const params: any[] = [];

    if (query.patientId) {
      sql += ' AND patient_id = ?';
      params.push(query.patientId);
    }
    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY assessment_datetime DESC';

    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 4. Get Single Episode with Flowsheet
  app.get('/api/neonatal-bind/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM neonatal_bind_aabr_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal BIND episode not found');

    const logs = db
      .prepare('SELECT * FROM neonatal_bind_serial_flowsheet_logs WHERE episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-bind/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalBind(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(neonatalBindEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM neonatal_bind_aabr_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal BIND episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.aabrRightEar !== undefined) {
      fields.push('aabr_right_ear = ?');
      values.push(data.aabrRightEar);
    }
    if (data.aabrLeftEar !== undefined) {
      fields.push('aabr_left_ear = ?');
      values.push(data.aabrLeftEar);
    }
    if (data.exchangeTransfusionPerformed !== undefined) {
      fields.push('exchange_transfusion_performed = ?');
      values.push(data.exchangeTransfusionPerformed ? 1 : 0);
    }
    if (data.ivigGiven !== undefined) {
      fields.push('ivig_given = ?');
      values.push(data.ivigGiven ? 1 : 0);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE neonatal_bind_aabr_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM neonatal_bind_aabr_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bind.episode_update',
      entity: 'neonatal_bind_aabr_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-bind/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalBind(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM neonatal_bind_aabr_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal BIND episode not found');

    db.prepare('DELETE FROM neonatal_bind_aabr_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bind.episode_delete',
      entity: 'neonatal_bind_aabr_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-bind/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalBind(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(neonatalBindFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM neonatal_bind_aabr_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal BIND episode not found');

    const { totalScore, severity } = calculateBindScore({
      mentalStatusScore: data.mentalStatusScore,
      muscleToneScore: data.muscleToneScore,
      cryScore: data.cryScore,
    });

    const stmt = db.prepare(`
      INSERT INTO neonatal_bind_serial_flowsheet_logs (
        episode_id, patient_id, log_datetime, hours_from_admission,
        mental_status_score, muscle_tone_score, cry_score,
        total_bind_score, tsb_mg_dl, phototherapy_type, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.mentalStatusScore,
      data.muscleToneScore,
      data.cryScore,
      totalScore,
      data.tsbMgDl ?? null,
      data.phototherapyType,
      data.notes ?? null,
      user.id,
    );

    // Update episode current BIND score and severity
    db.prepare(`
      UPDATE neonatal_bind_aabr_episodes
      SET total_bind_score = ?, bind_severity = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(totalScore, severity, id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bind.flowsheet_log',
      entity: 'neonatal_bind_serial_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        totalBindScore: totalScore,
        severity,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      totalBindScore: totalScore,
      severity,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-bind/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalBind(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db
      .prepare('SELECT * FROM neonatal_bind_serial_flowsheet_logs WHERE id = ? AND episode_id = ?')
      .get(logId, episodeId) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_bind_serial_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bind.flowsheet_delete',
      entity: 'neonatal_bind_serial_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, patientId: log.patient_id },
    });

    return { success: true };
  });

  // 9. Printable Dossier Endpoint
  app.get('/api/neonatal-bind/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM neonatal_bind_aabr_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal BIND episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id) as any;
    const logs = db
      .prepare('SELECT * FROM neonatal_bind_serial_flowsheet_logs WHERE episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bind.print',
      entity: 'neonatal_bind_aabr_episodes',
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
