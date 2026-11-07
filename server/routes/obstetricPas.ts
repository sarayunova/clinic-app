import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluateObstetricPas,
  classifyPasGrade,
  type PasGrade,
} from '../../web/src/obstetricPasEngine.js';

function assertCanManageObstetricPas(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical obstetricians and maternal surgical specialists can manage Placenta Accreta Spectrum (PAS) records');
  }
  return user;
}

export const obstetricPasEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  evaluationDatetime: z.string().min(1, 'Evaluation datetime is required'),
  gestationWeeks: z.number().min(16).max(43),
  previousCesareansCount: z.number().int().min(0).max(10).default(0),
  placentaPreviaPresent: z.boolean().default(true),
  priorUterineSurgeriesJson: z.string().default('[]'),
  lossOfClearZone: z.boolean().default(true),
  myometrialThicknessLess1mm: z.boolean().default(true),
  lacunaeGrade: z.number().int().min(0).max(3).default(1),
  subplacentalHypervascularity: z.boolean().default(true),
  bridgingVesselsToBladder: z.boolean().default(false),
  mriPerformed: z.boolean().default(false),
  mriFindings: z.string().max(1000).nullable().optional(),
  mdtMembersJson: z.string().default('[]'),
  irEmbolizationPlanned: z.boolean().default(false),
  ureteralStentsPlanned: z.boolean().default(false),
  cellSaverRequested: z.boolean().default(true),
  prbcUnitsReserved: z.number().int().min(0).max(20).default(4),
  ffpUnitsReserved: z.number().int().min(0).max(20).default(4),
  plateletUnitsReserved: z.number().int().min(0).max(10).default(2),
  plannedDeliveryWeeks: z.number().min(32).max(40).default(34.5),
  plannedDeliveryDatetime: z.string().nullable().optional(),
  surgicalApproach: z.enum([
    'planned_cesarean_hysterectomy',
    'delayed_hysterectomy',
    'conservative_uterine_preservation',
  ]).default('planned_cesarean_hysterectomy'),
  status: z.enum([
    'antepartum_planning',
    'preoperative_optimization',
    'intraoperative_active',
    'postoperative_recovery',
    'discharged',
  ]).default('antepartum_planning'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const obstetricPasFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  gestationWeeks: z.number().min(16).max(43),
  antenatalBleedingEpisode: z.boolean().default(false),
  vaginalBleedingMl: z.number().min(0).default(0),
  maternalSbp: z.number().int().min(40).max(250).nullable().optional(),
  maternalDbp: z.number().int().min(20).max(150).nullable().optional(),
  maternalHr: z.number().int().min(30).max(220).nullable().optional(),
  ctgCategory: z.enum(['category_1', 'category_2', 'category_3']).default('category_1'),
  hemoglobinGDl: z.number().min(3.0).max(20.0).nullable().optional(),
  crossmatchUnitsConfirmed: z.boolean().default(true),
  notes: z.string().max(500).nullable().optional(),
});

export function registerObstetricPasRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Calculator Endpoint
  app.post('/api/obstetric-pas/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(obstetricPasEpisodeSchema.partial(), req.body);

    const evalResult = evaluateObstetricPas({
      gestationWeeks: body.gestationWeeks ?? 32,
      previousCesareansCount: body.previousCesareansCount ?? 1,
      placentaPreviaPresent: body.placentaPreviaPresent ?? true,
      lossOfClearZone: body.lossOfClearZone,
      myometrialThicknessLess1mm: body.myometrialThicknessLess1mm,
      lacunaeGrade: body.lacunaeGrade,
      subplacentalHypervascularity: body.subplacentalHypervascularity,
      bridgingVesselsToBladder: body.bridgingVesselsToBladder,
      mriFindings: body.mriFindings ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create PAS Episode
  app.post('/api/obstetric-pas/episodes', async (req, reply) => {
    const user = assertCanManageObstetricPas(req);
    const data = parse(obstetricPasEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateObstetricPas({
      gestationWeeks: data.gestationWeeks,
      previousCesareansCount: data.previousCesareansCount,
      placentaPreviaPresent: data.placentaPreviaPresent,
      lossOfClearZone: data.lossOfClearZone,
      myometrialThicknessLess1mm: data.myometrialThicknessLess1mm,
      lacunaeGrade: data.lacunaeGrade,
      subplacentalHypervascularity: data.subplacentalHypervascularity,
      bridgingVesselsToBladder: data.bridgingVesselsToBladder,
      mriFindings: data.mriFindings ?? undefined,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `PAS-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_pas_episodes (
        patient_id, admission_id, episode_code, evaluation_datetime,
        gestation_weeks, previous_cesareans_count, placenta_previa_present,
        prior_uterine_surgeries_json, loss_of_clear_zone,
        myometrial_thickness_less_1mm, lacunae_grade,
        subplacental_hypervascularity, bridging_vessels_to_bladder,
        mri_performed, mri_findings, pas_grade, mdt_members_json,
        ir_embolization_planned, ureteral_stents_planned,
        cell_saver_requested, prbc_units_reserved, ffp_units_reserved,
        platelet_units_reserved, planned_delivery_weeks,
        planned_delivery_datetime, surgical_approach, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.evaluationDatetime,
      data.gestationWeeks,
      data.previousCesareansCount,
      data.placentaPreviaPresent ? 1 : 0,
      data.priorUterineSurgeriesJson,
      data.lossOfClearZone ? 1 : 0,
      data.myometrialThicknessLess1mm ? 1 : 0,
      data.lacunaeGrade,
      data.subplacentalHypervascularity ? 1 : 0,
      data.bridgingVesselsToBladder ? 1 : 0,
      data.mriPerformed ? 1 : 0,
      data.mriFindings ?? null,
      evalResult.pasGrade,
      data.mdtMembersJson,
      data.irEmbolizationPlanned ? 1 : 0,
      data.ureteralStentsPlanned ? 1 : 0,
      data.cellSaverRequested ? 1 : 0,
      data.prbcUnitsReserved,
      data.ffpUnitsReserved,
      data.plateletUnitsReserved,
      data.plannedDeliveryWeeks,
      data.plannedDeliveryDatetime ?? null,
      data.surgicalApproach,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM obstetric_pas_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pas.episode_create',
      entity: 'obstetric_pas_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        pasGrade: evalResult.pasGrade,
        plannedDeliveryWeeks: data.plannedDeliveryWeeks,
        prbcUnits: data.prbcUnitsReserved,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List PAS Episodes
  app.get('/api/obstetric-pas/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM obstetric_pas_episodes WHERE 1=1';
    const params: any[] = [];

    if (query.patientId) {
      sql += ' AND patient_id = ?';
      params.push(query.patientId);
    }
    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY id DESC';

    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet Logs
  app.get('/api/obstetric-pas/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM obstetric_pas_episodes WHERE id = ?').get(id);
    if (!episode) throw notFound('PAS episode not found');

    const logs = db
      .prepare('SELECT * FROM obstetric_pas_flowsheet_logs WHERE pas_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-pas/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPas(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(obstetricPasEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM obstetric_pas_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('PAS episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.surgicalApproach !== undefined) {
      fields.push('surgical_approach = ?');
      values.push(data.surgicalApproach);
    }
    if (data.plannedDeliveryWeeks !== undefined) {
      fields.push('planned_delivery_weeks = ?');
      values.push(data.plannedDeliveryWeeks);
    }
    if (data.plannedDeliveryDatetime !== undefined) {
      fields.push('planned_delivery_datetime = ?');
      values.push(data.plannedDeliveryDatetime);
    }
    if (data.irEmbolizationPlanned !== undefined) {
      fields.push('ir_embolization_planned = ?');
      values.push(data.irEmbolizationPlanned ? 1 : 0);
    }
    if (data.ureteralStentsPlanned !== undefined) {
      fields.push('ureteral_stents_planned = ?');
      values.push(data.ureteralStentsPlanned ? 1 : 0);
    }
    if (data.prbcUnitsReserved !== undefined) {
      fields.push('prbc_units_reserved = ?');
      values.push(data.prbcUnitsReserved);
    }
    if (data.ffpUnitsReserved !== undefined) {
      fields.push('ffp_units_reserved = ?');
      values.push(data.ffpUnitsReserved);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE obstetric_pas_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM obstetric_pas_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pas.episode_update',
      entity: 'obstetric_pas_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-pas/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPas(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM obstetric_pas_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('PAS episode not found');

    db.prepare('DELETE FROM obstetric_pas_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pas.episode_delete',
      entity: 'obstetric_pas_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-pas/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricPas(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(obstetricPasFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM obstetric_pas_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('PAS episode not found');

    const stmt = db.prepare(`
      INSERT INTO obstetric_pas_flowsheet_logs (
        pas_episode_id, patient_id, log_datetime, gestation_weeks,
        antenatal_bleeding_episode, vaginal_bleeding_ml, maternal_sbp,
        maternal_dbp, maternal_hr, ctg_category, hemoglobin_g_dl,
        crossmatch_units_confirmed, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.gestationWeeks,
      data.antenatalBleedingEpisode ? 1 : 0,
      data.vaginalBleedingMl,
      data.maternalSbp ?? null,
      data.maternalDbp ?? null,
      data.maternalHr ?? null,
      data.ctgCategory,
      data.hemoglobinGDl ?? null,
      data.crossmatchUnitsConfirmed ? 1 : 0,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pas.flowsheet_log',
      entity: 'obstetric_pas_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        bleedingMl: data.vaginalBleedingMl,
        ctgCategory: data.ctgCategory,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      vaginalBleedingMl: data.vaginalBleedingMl,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-pas/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageObstetricPas(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db.prepare('SELECT * FROM obstetric_pas_flowsheet_logs WHERE id = ? AND pas_episode_id = ?').get(logId, episodeId);
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_pas_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pas.flowsheet_delete',
      entity: 'obstetric_pas_flowsheet_logs',
      entityId: logId,
      detail: { episodeId },
    });

    return { success: true };
  });

  // 9. Printable Clinical Dossier
  app.get('/api/obstetric-pas/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM obstetric_pas_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('PAS episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id);
    const logs = db
      .prepare('SELECT * FROM obstetric_pas_flowsheet_logs WHERE pas_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, patient, logs };
  });
}
