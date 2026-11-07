import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  checkClarkCriteria,
  evaluateObstetricAfe,
} from '../../web/src/obstetricAfeEngine.js';

function assertCanManageObstetricAfe(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical obstetricians, anesthesiologists and labor ward nurses can manage AFE resuscitation records');
  }
  return user;
}

export const obstetricAfeEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  arrestOnsetDatetime: z.string().min(1, 'Arrest onset datetime is required'),
  gestationWeeks: z.number().min(16).max(43),
  timingRelation: z.enum([
    'during_labor',
    'cesarean_delivery',
    'postpartum_under_30min',
    'post_dilatation_evacuation',
    'other',
  ]).default('during_labor'),
  cardiorespiratoryCollapse: z.boolean().default(true),
  overtDicPresent: z.boolean().default(true),
  absenceOfFever: z.boolean().default(true),
  atropineGiven: z.boolean().default(false),
  ondansetronGiven: z.boolean().default(false),
  ketorolacGiven: z.boolean().default(false),
  fibrinogenMgDl: z.number().min(0).max(1000).nullable().optional(),
  plateletCount: z.number().int().min(1000).max(1000000).nullable().optional(),
  ptInr: z.number().min(0.5).max(15.0).nullable().optional(),
  mtpActivated: z.boolean().default(false),
  prbcTransfusedUnits: z.number().int().min(0).max(50).default(0),
  ffpTransfusedUnits: z.number().int().min(0).max(50).default(0),
  plateletsTransfusedUnits: z.number().int().min(0).max(30).default(0),
  cryoprecipitateUnits: z.number().int().min(0).max(50).default(0),
  pmcdPerformed: z.boolean().default(false),
  pmcdDecisionToDeliveryMinutes: z.number().min(0).max(60).nullable().optional(),
  ecmoInitiated: z.boolean().default(false),
  status: z.enum([
    'acute_resuscitation',
    'post_cardiac_arrest_icu',
    'coagulopathy_stabilizing',
    'convalescent',
    'maternal_death',
  ]).default('acute_resuscitation'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const obstetricAfeFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromArrest: z.number().min(0).default(0),
  sbpMmhg: z.number().int().min(0).max(300).nullable().optional(),
  dbpMmhg: z.number().int().min(0).max(200).nullable().optional(),
  hrBpm: z.number().int().min(0).max(250).nullable().optional(),
  spo2Percent: z.number().min(0).max(100).nullable().optional(),
  etco2Mmhg: z.number().min(0).max(100).nullable().optional(),
  vasopressorActive: z.enum([
    'none',
    'epinephrine',
    'norepinephrine',
    'vasopressin',
    'multiple',
  ]).default('none'),
  fibrinogenMgDl: z.number().min(0).max(1000).nullable().optional(),
  plateletCount: z.number().int().min(1000).max(1000000).nullable().optional(),
  inr: z.number().min(0.5).max(15.0).nullable().optional(),
  qblTotalMl: z.number().min(0).max(20000).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerObstetricAfeRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Calculator Endpoint
  app.post('/api/obstetric-afe/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(obstetricAfeEpisodeSchema.partial(), req.body);

    const evalResult = evaluateObstetricAfe({
      gestationWeeks: body.gestationWeeks ?? 39,
      timingRelation: body.timingRelation ?? 'during_labor',
      cardiorespiratoryCollapse: body.cardiorespiratoryCollapse ?? true,
      overtDicPresent: body.overtDicPresent ?? true,
      absenceOfFever: body.absenceOfFever ?? true,
      fibrinogenMgDl: body.fibrinogenMgDl ?? undefined,
      plateletCount: body.plateletCount ?? undefined,
      ptInr: body.ptInr ?? undefined,
      atropineGiven: body.atropineGiven ?? false,
      ondansetronGiven: body.ondansetronGiven ?? false,
      ketorolacGiven: body.ketorolacGiven ?? false,
      fetusInUtero: body.timingRelation === 'during_labor',
    });

    return { evalResult };
  });

  // 2. Create Obstetric AFE Episode
  app.post('/api/obstetric-afe/episodes', async (req, reply) => {
    const user = assertCanManageObstetricAfe(req);
    const data = parse(obstetricAfeEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const clark = checkClarkCriteria({
      gestationWeeks: data.gestationWeeks,
      timingRelation: data.timingRelation,
      cardiorespiratoryCollapse: data.cardiorespiratoryCollapse,
      overtDicPresent: data.overtDicPresent,
      absenceOfFever: data.absenceOfFever,
      fibrinogenMgDl: data.fibrinogenMgDl ?? undefined,
      plateletCount: data.plateletCount ?? undefined,
      ptInr: data.ptInr ?? undefined,
    });

    const aokComplete = Boolean(data.atropineGiven && data.ondansetronGiven && data.ketorolacGiven);

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `AFE-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_afe_episodes (
        patient_id, admission_id, episode_code, arrest_onset_datetime,
        gestation_weeks, timing_relation,
        cardiorespiratory_collapse, overt_dic_present, absence_of_fever,
        clark_criteria_met, atropine_given, ondansetron_given, ketorolac_given,
        aok_regimen_complete, fibrinogen_mg_dl, platelet_count, pt_inr,
        mtp_activated, prbc_transfused_units, ffp_transfused_units,
        platelets_transfused_units, cryoprecipitate_units,
        pmcd_performed, pmcd_decision_to_delivery_minutes, ecmo_initiated,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.arrestOnsetDatetime,
      data.gestationWeeks,
      data.timingRelation,
      data.cardiorespiratoryCollapse ? 1 : 0,
      data.overtDicPresent ? 1 : 0,
      data.absenceOfFever ? 1 : 0,
      clark.clarkCriteriaMet ? 1 : 0,
      data.atropineGiven ? 1 : 0,
      data.ondansetronGiven ? 1 : 0,
      data.ketorolacGiven ? 1 : 0,
      aokComplete ? 1 : 0,
      data.fibrinogenMgDl ?? null,
      data.plateletCount ?? null,
      data.ptInr ?? null,
      data.mtpActivated ? 1 : 0,
      data.prbcTransfusedUnits,
      data.ffpTransfusedUnits,
      data.plateletsTransfusedUnits,
      data.cryoprecipitateUnits,
      data.pmcdPerformed ? 1 : 0,
      data.pmcdDecisionToDeliveryMinutes ?? null,
      data.ecmoInitiated ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM obstetric_afe_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_afe.episode_create',
      entity: 'obstetric_afe_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        clarkCriteriaMet: clark.clarkCriteriaMet,
        aokRegimenComplete: aokComplete,
        pmcdPerformed: data.pmcdPerformed,
      },
    });

    reply.status(201);
    return { episode: created };
  });

  // 3. List Episodes
  app.get('/api/obstetric-afe/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_afe_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND e.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.arrest_onset_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/obstetric-afe/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_afe_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric AFE episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM obstetric_afe_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.afe_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateObstetricAfe({
      gestationWeeks: episode.gestation_weeks,
      timingRelation: episode.timing_relation,
      cardiorespiratoryCollapse: Boolean(episode.cardiorespiratory_collapse),
      overtDicPresent: Boolean(episode.overt_dic_present),
      absenceOfFever: Boolean(episode.absence_of_fever),
      fibrinogenMgDl: episode.fibrinogen_mg_dl ?? undefined,
      plateletCount: episode.platelet_count ?? undefined,
      ptInr: episode.pt_inr ?? undefined,
      atropineGiven: Boolean(episode.atropine_given),
      ondansetronGiven: Boolean(episode.ondansetron_given),
      ketorolacGiven: Boolean(episode.ketorolac_given),
      fetusInUtero: episode.timing_relation === 'during_labor' && !episode.pmcd_performed,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-afe/episodes/:id', async (req) => {
    const user = assertCanManageObstetricAfe(req);
    const { id } = req.params as { id: string };
    const patch = parse(obstetricAfeEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM obstetric_afe_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric AFE episode not found');

    const atropine = patch.atropineGiven !== undefined ? (patch.atropineGiven ? 1 : 0) : existing.atropine_given;
    const ondansetron = patch.ondansetronGiven !== undefined ? (patch.ondansetronGiven ? 1 : 0) : existing.ondansetron_given;
    const ketorolac = patch.ketorolacGiven !== undefined ? (patch.ketorolacGiven ? 1 : 0) : existing.ketorolac_given;
    const aokComplete = atropine && ondansetron && ketorolac ? 1 : 0;

    db.prepare(`
      UPDATE obstetric_afe_episodes SET
        timing_relation = COALESCE(?, timing_relation),
        cardiorespiratory_collapse = COALESCE(?, cardiorespiratory_collapse),
        overt_dic_present = COALESCE(?, overt_dic_present),
        absence_of_fever = COALESCE(?, absence_of_fever),
        atropine_given = ?,
        ondansetron_given = ?,
        ketorolac_given = ?,
        aok_regimen_complete = ?,
        fibrinogen_mg_dl = COALESCE(?, fibrinogen_mg_dl),
        platelet_count = COALESCE(?, platelet_count),
        pt_inr = COALESCE(?, pt_inr),
        mtp_activated = COALESCE(?, mtp_activated),
        prbc_transfused_units = COALESCE(?, prbc_transfused_units),
        ffp_transfused_units = COALESCE(?, ffp_transfused_units),
        platelets_transfused_units = COALESCE(?, platelets_transfused_units),
        cryoprecipitate_units = COALESCE(?, cryoprecipitate_units),
        pmcd_performed = COALESCE(?, pmcd_performed),
        pmcd_decision_to_delivery_minutes = COALESCE(?, pmcd_decision_to_delivery_minutes),
        ecmo_initiated = COALESCE(?, ecmo_initiated),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      patch.timingRelation ?? null,
      patch.cardiorespiratoryCollapse !== undefined ? (patch.cardiorespiratoryCollapse ? 1 : 0) : null,
      patch.overtDicPresent !== undefined ? (patch.overtDicPresent ? 1 : 0) : null,
      patch.absenceOfFever !== undefined ? (patch.absenceOfFever ? 1 : 0) : null,
      atropine,
      ondansetron,
      ketorolac,
      aokComplete,
      patch.fibrinogenMgDl ?? null,
      patch.plateletCount ?? null,
      patch.ptInr ?? null,
      patch.mtpActivated !== undefined ? (patch.mtpActivated ? 1 : 0) : null,
      patch.prbcTransfusedUnits ?? null,
      patch.ffpTransfusedUnits ?? null,
      patch.plateletsTransfusedUnits ?? null,
      patch.cryoprecipitateUnits ?? null,
      patch.pmcdPerformed !== undefined ? (patch.pmcdPerformed ? 1 : 0) : null,
      patch.pmcdDecisionToDeliveryMinutes ?? null,
      patch.ecmoInitiated !== undefined ? (patch.ecmoInitiated ? 1 : 0) : null,
      patch.status ?? null,
      patch.clinicalNotes ?? null,
      Number(id),
    );

    const updated = db.prepare('SELECT * FROM obstetric_afe_episodes WHERE id = ?').get(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_afe.episode_update',
      entity: 'obstetric_afe_episodes',
      entityId: Number(id),
      detail: patch,
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-afe/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete AFE episodes');
    }
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM obstetric_afe_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric AFE episode not found');

    db.prepare('DELETE FROM obstetric_afe_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_afe.episode_delete',
      entity: 'obstetric_afe_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Observation Log
  app.post('/api/obstetric-afe/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricAfe(req);
    const { id } = req.params as { id: string };
    const data = parse(obstetricAfeFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM obstetric_afe_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric AFE episode not found');

    const info = db.prepare(`
      INSERT INTO obstetric_afe_flowsheet_logs (
        afe_episode_id, patient_id, log_datetime, minutes_from_arrest,
        sbp_mmhg, dbp_mmhg, hr_bpm, spo2_percent, etco2_mmhg,
        vasopressor_active, fibrinogen_mg_dl, platelet_count, inr,
        qbl_total_ml, notes, logged_by_id
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
      data.minutesFromArrest,
      data.sbpMmhg ?? null,
      data.dbpMmhg ?? null,
      data.hrBpm ?? null,
      data.spo2Percent ?? null,
      data.etco2Mmhg ?? null,
      data.vasopressorActive,
      data.fibrinogenMgDl ?? null,
      data.plateletCount ?? null,
      data.inr ?? null,
      data.qblTotalMl ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_afe.flowsheet_log',
      entity: 'obstetric_afe_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), sbp: data.sbpMmhg, vasopressor: data.vasopressorActive },
    });

    reply.status(201);
    return { logId: info.lastInsertRowid };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-afe/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete AFE flowsheet logs');
    }
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM obstetric_afe_flowsheet_logs WHERE id = ? AND afe_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_afe_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_afe.flowsheet_delete',
      entity: 'obstetric_afe_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
