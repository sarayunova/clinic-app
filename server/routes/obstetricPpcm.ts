import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricPpcm,
  type PpcmTimingCategory,
  type NyhaFunctionalClass,
  type BromocriptineRegimen,
  type AnticoagulationAgent,
  type VasodilatorAgent,
} from '../../web/src/obstetricPpcmEngine.js';

function assertCanManageObstetricPpcm(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only obstetricians, cardiologists, and ICU nurses can manage PPCM records');
  }
  return user;
}

export const obstetricPpcmEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  presentationDatetime: z.string().min(1, 'Presentation datetime is required'),
  timingCategory: z.enum([
    'antepartum_late_third_trimester',
    'postpartum_first_month',
    'postpartum_months_2_to_5',
  ]),
  maternalAge: z.number().int().min(14).max(55).nullable().optional(),
  gestationalAgeWeeks: z.number().min(24.0).max(44.0).nullable().optional(),
  daysPostpartum: z.number().int().min(0).max(180).nullable().optional(),

  nyhaClass: z.enum(['class_i', 'class_ii', 'class_iii', 'class_iv']),
  lvefPercent: z.number().min(5.0).max(65.0),
  lveddMm: z.number().min(30.0).max(90.0).nullable().optional(),
  ntProbnpPgMl: z.number().min(10.0).max(50000.0).nullable().optional(),
  troponinINgMl: z.number().min(0.001).max(50.0).nullable().optional(),
  pulmonaryEdemaPresent: z.boolean().default(false),
  cardiogenicShockPresent: z.boolean().default(false),

  bromocriptineRegimen: z.enum([
    'none',
    'standard_2_5mg_daily_1week',
    'intensive_2_5mg_bid_2weeks_then_daily_6weeks',
  ]).default('none'),
  bromocriptineInitiated: z.boolean().default(false),
  anticoagulationPrescribed: z.boolean().default(false),
  anticoagulationAgent: z.enum([
    'none',
    'lmwh_prophylactic',
    'lmwh_therapeutic',
    'warfarin_therapeutic_postpartum_only',
    'unfractionated_heparin',
  ]).default('none'),

  loopDiureticGiven: z.boolean().default(false),
  betaBlockerGiven: z.boolean().default(false),
  vasodilatorAgent: z.enum([
    'none',
    'hydralazine_nitrates_pregnancy_safe',
    'acei_arb_arni_strictly_postpartum_non_lactating',
    'nitroprusside_icu_only',
  ]).default('none'),

  status: z.enum([
    'acute_decompensation',
    'icu_mechanical_support',
    'stabilized_on_board_protocol',
    'recovered_ejection_fraction',
  ]).default('acute_decompensation'),
  clinicalNotes: z.string().nullable().optional(),
});

export const obstetricPpcmFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromPresentation: z.number().min(0).default(0),

  heartRateBpm: z.number().int().min(30).max(220),
  bloodPressureSys: z.number().int().min(50).max(250),
  bloodPressureDia: z.number().int().min(20).max(160),
  respiratoryRate: z.number().int().min(5).max(70),
  spo2Percent: z.number().min(40.0).max(100.0),
  oxygenRequirementLMin: z.number().min(0).max(30.0).default(0),
  urineOutputMlHr: z.number().min(0).max(1000.0).default(0),
  fluidBalanceCumulativeMl: z.number().min(-10000).max(10000).default(0),
  orthopneaPillows: z.number().int().min(1).max(5).default(1),
  inotropicSupport: z.enum([
    'none',
    'dobutamine',
    'milrinone',
    'norepinephrine',
  ]).default('none'),
  notes: z.string().nullable().optional(),
});

export function registerObstetricPpcmRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/obstetric-ppcm/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(obstetricPpcmEpisodeSchema.partial(), req.body);

    const evalResult = evaluateObstetricPpcm({
      maternalAge: data.maternalAge ?? 30,
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? undefined,
      daysPostpartum: data.daysPostpartum ?? undefined,
      timingCategory: (data.timingCategory as PpcmTimingCategory) ?? 'postpartum_first_month',
      nyhaClass: (data.nyhaClass as NyhaFunctionalClass) ?? 'class_iii',
      lvefPercent: data.lvefPercent ?? 32.0,
      lveddMm: data.lveddMm ?? 58,
      ntProbnpPgMl: data.ntProbnpPgMl ?? 4200,
      troponinINgMl: data.troponinINgMl ?? 0.08,
      pulmonaryEdemaPresent: data.pulmonaryEdemaPresent ?? true,
      cardiogenicShockPresent: data.cardiogenicShockPresent ?? false,
      bromocriptineRegimen: (data.bromocriptineRegimen as BromocriptineRegimen) ?? 'intensive_2_5mg_bid_2weeks_then_daily_6weeks',
      bromocriptineInitiated: data.bromocriptineInitiated ?? true,
      anticoagulationPrescribed: data.anticoagulationPrescribed ?? true,
      anticoagulationAgent: (data.anticoagulationAgent as AnticoagulationAgent) ?? 'lmwh_therapeutic',
      loopDiureticGiven: data.loopDiureticGiven ?? true,
      betaBlockerGiven: data.betaBlockerGiven ?? true,
      vasodilatorAgent: (data.vasodilatorAgent as VasodilatorAgent) ?? 'hydralazine_nitrates_pregnancy_safe',
    });

    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/obstetric-ppcm/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_ppcm_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND e.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status && status !== 'all') {
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.presentation_datetime DESC';
    const episodes = db.prepare(query).all(...params);

    return { episodes };
  });

  // 3. Create Episode
  app.post('/api/obstetric-ppcm/episodes', async (req, reply) => {
    const user = assertCanManageObstetricPpcm(req);
    const data = parse(obstetricPpcmEpisodeSchema, req.body);

    const evalResult = evaluateObstetricPpcm({
      maternalAge: data.maternalAge ?? undefined,
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? undefined,
      daysPostpartum: data.daysPostpartum ?? undefined,
      timingCategory: data.timingCategory as PpcmTimingCategory,
      nyhaClass: data.nyhaClass as NyhaFunctionalClass,
      lvefPercent: data.lvefPercent,
      lveddMm: data.lveddMm ?? undefined,
      ntProbnpPgMl: data.ntProbnpPgMl ?? undefined,
      troponinINgMl: data.troponinINgMl ?? undefined,
      pulmonaryEdemaPresent: data.pulmonaryEdemaPresent,
      cardiogenicShockPresent: data.cardiogenicShockPresent,
      bromocriptineRegimen: data.bromocriptineRegimen as BromocriptineRegimen,
      bromocriptineInitiated: data.bromocriptineInitiated,
      anticoagulationPrescribed: data.anticoagulationPrescribed,
      anticoagulationAgent: data.anticoagulationAgent as AnticoagulationAgent,
      loopDiureticGiven: data.loopDiureticGiven,
      betaBlockerGiven: data.betaBlockerGiven,
      vasodilatorAgent: data.vasodilatorAgent as VasodilatorAgent,
    });

    const episodeCode = `PPCM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const res = db.prepare(`
      INSERT INTO obstetric_ppcm_episodes (
        patient_id, admission_id, episode_code, presentation_datetime,
        timing_category, maternal_age, gestational_age_weeks, days_postpartum,
        nyha_class, lvef_percent, lvedd_mm, nt_probnp_pg_ml, troponin_i_ng_ml,
        pulmonary_edema_present, cardiogenic_shock_present,
        bromocriptine_regimen, bromocriptine_initiated,
        anticoagulation_prescribed, anticoagulation_agent,
        loop_diuretic_given, beta_blocker_given, vasodilator_agent,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.presentationDatetime,
      data.timingCategory,
      data.maternalAge ?? null,
      data.gestationalAgeWeeks ?? null,
      data.daysPostpartum ?? null,
      data.nyhaClass,
      data.lvefPercent,
      data.lveddMm ?? null,
      data.ntProbnpPgMl ?? null,
      data.troponinINgMl ?? null,
      data.pulmonaryEdemaPresent ? 1 : 0,
      data.cardiogenicShockPresent ? 1 : 0,
      data.bromocriptineRegimen,
      data.bromocriptineInitiated ? 1 : 0,
      data.anticoagulationPrescribed ? 1 : 0,
      data.anticoagulationAgent,
      data.loopDiureticGiven ? 1 : 0,
      data.betaBlockerGiven ? 1 : 0,
      data.vasodilatorAgent,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ppcm.create',
      entity: 'obstetric_ppcm_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, lvef: data.lvefPercent, nyha: data.nyhaClass, bromocriptine: data.bromocriptineInitiated },
    });

    const created = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_ppcm_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(episodeId);

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 4. Get Episode Detail with Flowsheet and Live Evaluation
  app.get('/api/obstetric-ppcm/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_ppcm_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric PPCM episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM obstetric_ppcm_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.ppcm_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateObstetricPpcm({
      maternalAge: episode.maternal_age ?? undefined,
      gestationalAgeWeeks: episode.gestational_age_weeks ?? undefined,
      daysPostpartum: episode.days_postpartum ?? undefined,
      timingCategory: episode.timing_category as PpcmTimingCategory,
      nyhaClass: episode.nyha_class as NyhaFunctionalClass,
      lvefPercent: episode.lvef_percent,
      lveddMm: episode.lvedd_mm ?? undefined,
      ntProbnpPgMl: episode.nt_probnp_pg_ml ?? undefined,
      troponinINgMl: episode.troponin_i_ng_ml ?? undefined,
      pulmonaryEdemaPresent: Boolean(episode.pulmonary_edema_present),
      cardiogenicShockPresent: Boolean(episode.cardiogenic_shock_present),
      bromocriptineRegimen: episode.bromocriptine_regimen as BromocriptineRegimen,
      bromocriptineInitiated: Boolean(episode.bromocriptine_initiated),
      anticoagulationPrescribed: Boolean(episode.anticoagulation_prescribed),
      anticoagulationAgent: episode.anticoagulation_agent as AnticoagulationAgent,
      loopDiureticGiven: Boolean(episode.loop_diuretic_given),
      betaBlockerGiven: Boolean(episode.beta_blocker_given),
      vasodilatorAgent: episode.vasodilator_agent as VasodilatorAgent,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-ppcm/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPpcm(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const existing = db.prepare('SELECT id FROM obstetric_ppcm_episodes WHERE id = ?').get(episodeId);
    if (!existing) throw notFound('Obstetric PPCM episode not found');

    const data = parse(obstetricPpcmEpisodeSchema.partial(), req.body);

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }
    if (data.lvefPercent !== undefined) {
      fields.push('lvef_percent = ?');
      values.push(data.lvefPercent);
    }
    if (data.nyhaClass !== undefined) {
      fields.push('nyha_class = ?');
      values.push(data.nyhaClass);
    }
    if (data.bromocriptineInitiated !== undefined) {
      fields.push('bromocriptine_initiated = ?');
      values.push(data.bromocriptineInitiated ? 1 : 0);
    }
    if (data.anticoagulationPrescribed !== undefined) {
      fields.push('anticoagulation_prescribed = ?');
      values.push(data.anticoagulationPrescribed ? 1 : 0);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(episodeId);
      db.prepare(`UPDATE obstetric_ppcm_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ppcm.update',
      entity: 'obstetric_ppcm_episodes',
      entityId: episodeId,
      detail: { updatedFields: fields },
    });

    const updated = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_ppcm_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(episodeId);

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-ppcm/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPpcm(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM obstetric_ppcm_episodes WHERE id = ?').get(episodeId) as any;
    if (!existing) throw notFound('Episode not found');

    db.prepare('DELETE FROM obstetric_ppcm_episodes WHERE id = ?').run(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ppcm.delete',
      entity: 'obstetric_ppcm_episodes',
      entityId: episodeId,
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-ppcm/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricPpcm(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const episode = db.prepare('SELECT id, patient_id FROM obstetric_ppcm_episodes WHERE id = ?').get(episodeId) as any;
    if (!episode) throw notFound('Episode not found');

    const data = parse(obstetricPpcmFlowsheetSchema, req.body);

    const res = db.prepare(`
      INSERT INTO obstetric_ppcm_flowsheet_logs (
        ppcm_episode_id, patient_id, log_datetime, hours_from_presentation,
        heart_rate_bpm, blood_pressure_sys, blood_pressure_dia, respiratory_rate,
        spo2_percent, oxygen_requirement_l_min, urine_output_ml_hr, fluid_balance_cumulative_ml,
        orthopnea_pillows, inotropic_support, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      episodeId,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromPresentation,
      data.heartRateBpm,
      data.bloodPressureSys,
      data.bloodPressureDia,
      data.respiratoryRate,
      data.spo2Percent,
      data.oxygenRequirementLMin,
      data.urineOutputMlHr,
      data.fluidBalanceCumulativeMl,
      data.orthopneaPillows,
      data.inotropicSupport,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ppcm.flowsheet_log',
      entity: 'obstetric_ppcm_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, bp: `${data.bloodPressureSys}/${data.bloodPressureDia}`, inotrope: data.inotropicSupport },
    });

    reply.status(201);
    return { logId };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-ppcm/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageObstetricPpcm(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM obstetric_ppcm_flowsheet_logs WHERE id = ? AND ppcm_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_ppcm_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_ppcm.flowsheet_delete',
      entity: 'obstetric_ppcm_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
