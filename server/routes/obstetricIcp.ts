import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluateObstetricIcp,
  classifyIcpSeverity,
  calculateDeliveryTiming,
} from '../../web/src/obstetricIcpEngine.js';

function assertCanManageObstetricIcp(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical obstetricians and antenatal nurses can manage obstetric cholestasis (ICP) records');
  }
  return user;
}

export const obstetricIcpEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDatetime: z.string().min(1, 'Diagnosis datetime is required'),
  gestationWeeks: z.number().min(12).max(43),
  peakTsbaUmolL: z.number().min(1.0).max(500.0),
  baselineAltUL: z.number().min(1).max(2000).nullable().optional(),
  baselineAstUL: z.number().min(1).max(2000).nullable().optional(),
  pruritusSeverityScore: z.number().int().min(0).max(10).default(5),
  pruritusPalmsSoles: z.boolean().default(true),
  nocturnalWorsening: z.boolean().default(true),
  udcaStarted: z.boolean().default(true),
  udcaDoseMgDay: z.number().min(300).max(3000).default(900),
  ctgSurveillanceFrequency: z.enum(['weekly', 'twice_weekly', 'daily', 'continuous_inpatient']).default('twice_weekly'),
  plannedDeliveryWeeks: z.number().min(32).max(41).default(37.0),
  deliveryTimingRationale: z.string().max(1000).nullable().optional(),
  status: z.enum([
    'active_surveillance',
    'medication_titration',
    'planned_induction',
    'delivered',
    'resolved',
  ]).default('active_surveillance'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const obstetricIcpFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  gestationWeeks: z.number().min(12).max(43),
  currentTsbaUmolL: z.number().min(1.0).max(500.0),
  altUL: z.number().min(1).max(2000).nullable().optional(),
  astUL: z.number().min(1).max(2000).nullable().optional(),
  pruritusScore: z.number().int().min(0).max(10),
  ctgResult: z.enum(['reactive', 'equivocal', 'non_reactive']).default('reactive'),
  fetalMovementsAdequate: z.boolean().default(true),
  udcaCurrentDoseMgDay: z.number().min(0).max(3000).default(900),
  notes: z.string().max(500).nullable().optional(),
});

export function registerObstetricIcpRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Preview Calculation Endpoint
  app.post('/api/obstetric-icp/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        gestationWeeks: z.number().min(12).max(43),
        peakTsbaUmolL: z.number().min(1.0).max(500.0),
        baselineAltUL: z.number().min(1).max(2000).optional(),
        baselineAstUL: z.number().min(1).max(2000).optional(),
        pruritusSeverityScore: z.number().int().min(0).max(10).default(5),
        pruritusPalmsSoles: z.boolean().default(true),
        nocturnalWorsening: z.boolean().default(true),
      }),
      req.body,
    );

    const evalResult = evaluateObstetricIcp({
      gestationWeeks: body.gestationWeeks,
      peakTsbaUmolL: body.peakTsbaUmolL,
      baselineAltUL: body.baselineAltUL,
      baselineAstUL: body.baselineAstUL,
      pruritusSeverityScore: body.pruritusSeverityScore,
      pruritusPalmsSoles: body.pruritusPalmsSoles,
      nocturnalWorsening: body.nocturnalWorsening,
    });

    return { evalResult };
  });

  // 2. Create ICP Episode
  app.post('/api/obstetric-icp/episodes', async (req, reply) => {
    const user = assertCanManageObstetricIcp(req);
    const data = parse(obstetricIcpEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateObstetricIcp({
      gestationWeeks: data.gestationWeeks,
      peakTsbaUmolL: data.peakTsbaUmolL,
      baselineAltUL: data.baselineAltUL ?? undefined,
      baselineAstUL: data.baselineAstUL ?? undefined,
      pruritusSeverityScore: data.pruritusSeverityScore,
      pruritusPalmsSoles: data.pruritusPalmsSoles,
      nocturnalWorsening: data.nocturnalWorsening,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `ICP-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_icp_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestation_weeks, peak_tsba_umol_l, baseline_alt_u_l,
        baseline_ast_u_l, pruritus_severity_score, pruritus_palms_soles,
        nocturnal_worsening, icp_severity_tier, udca_started,
        udca_dose_mg_day, ctg_surveillance_frequency, planned_delivery_weeks,
        delivery_timing_rationale, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationWeeks,
      data.peakTsbaUmolL,
      data.baselineAltUL ?? null,
      data.baselineAstUL ?? null,
      data.pruritusSeverityScore,
      data.pruritusPalmsSoles ? 1 : 0,
      data.nocturnalWorsening ? 1 : 0,
      evalResult.icpSeverityTier,
      data.udcaStarted ? 1 : 0,
      data.udcaDoseMgDay,
      data.ctgSurveillanceFrequency,
      data.plannedDeliveryWeeks,
      data.deliveryTimingRationale ?? evalResult.deliveryTimingRationale,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM obstetric_icp_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_icp.episode_create',
      entity: 'obstetric_icp_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        peakTsbaUmolL: data.peakTsbaUmolL,
        icpSeverityTier: evalResult.icpSeverityTier,
        plannedDeliveryWeeks: data.plannedDeliveryWeeks,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/obstetric-icp/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM obstetric_icp_episodes WHERE 1=1';
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
  app.get('/api/obstetric-icp/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM obstetric_icp_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric ICP episode not found');

    const logs = db
      .prepare('SELECT * FROM obstetric_icp_flowsheet_logs WHERE icp_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-icp/episodes/:id', async (req) => {
    const user = assertCanManageObstetricIcp(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(obstetricIcpEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM obstetric_icp_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric ICP episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.udcaDoseMgDay !== undefined) {
      fields.push('udca_dose_mg_day = ?');
      values.push(data.udcaDoseMgDay);
    }
    if (data.ctgSurveillanceFrequency !== undefined) {
      fields.push('ctg_surveillance_frequency = ?');
      values.push(data.ctgSurveillanceFrequency);
    }
    if (data.plannedDeliveryWeeks !== undefined) {
      fields.push('planned_delivery_weeks = ?');
      values.push(data.plannedDeliveryWeeks);
    }
    if (data.deliveryTimingRationale !== undefined) {
      fields.push('delivery_timing_rationale = ?');
      values.push(data.deliveryTimingRationale);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE obstetric_icp_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM obstetric_icp_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_icp.episode_update',
      entity: 'obstetric_icp_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-icp/episodes/:id', async (req) => {
    const user = assertCanManageObstetricIcp(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM obstetric_icp_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric ICP episode not found');

    db.prepare('DELETE FROM obstetric_icp_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_icp.episode_delete',
      entity: 'obstetric_icp_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-icp/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricIcp(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(obstetricIcpFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM obstetric_icp_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric ICP episode not found');

    const stmt = db.prepare(`
      INSERT INTO obstetric_icp_flowsheet_logs (
        icp_episode_id, patient_id, log_datetime, gestation_weeks,
        current_tsba_umol_l, alt_u_l, ast_u_l, pruritus_score,
        ctg_result, fetal_movements_adequate, udca_current_dose_mg_day,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.gestationWeeks,
      data.currentTsbaUmolL,
      data.altUL ?? null,
      data.astUL ?? null,
      data.pruritusScore,
      data.ctgResult,
      data.fetalMovementsAdequate ? 1 : 0,
      data.udcaCurrentDoseMgDay,
      data.notes ?? null,
      user.id,
    );

    // If new TSBA is higher than peak, update peak and tier
    if (data.currentTsbaUmolL > episode.peak_tsba_umol_l) {
      const newTier = classifyIcpSeverity(data.currentTsbaUmolL);
      db.prepare(`
        UPDATE obstetric_icp_episodes
        SET peak_tsba_umol_l = ?, icp_severity_tier = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(data.currentTsbaUmolL, newTier, id);
    }

    audit(db, {
      actorId: user.id,
      action: 'obstetric_icp.flowsheet_log',
      entity: 'obstetric_icp_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        currentTsbaUmolL: data.currentTsbaUmolL,
        pruritusScore: data.pruritusScore,
        ctgResult: data.ctgResult,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      currentTsbaUmolL: data.currentTsbaUmolL,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-icp/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageObstetricIcp(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db
      .prepare('SELECT * FROM obstetric_icp_flowsheet_logs WHERE id = ? AND icp_episode_id = ?')
      .get(logId, episodeId) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_icp_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_icp.flowsheet_delete',
      entity: 'obstetric_icp_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, patientId: log.patient_id },
    });

    return { success: true };
  });

  // 9. Printable Dossier Endpoint
  app.get('/api/obstetric-icp/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM obstetric_icp_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric ICP episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id) as any;
    const logs = db
      .prepare('SELECT * FROM obstetric_icp_flowsheet_logs WHERE icp_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_icp.print',
      entity: 'obstetric_icp_episodes',
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
