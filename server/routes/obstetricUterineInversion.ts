import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricUterineInversion,
  calculateObstetricShockIndex,
  type InversionDegree,
  type PlacentalStatus,
  type ReductionTechnique,
  type UterineRelaxantAgent,
} from '../../web/src/obstetricUterineInversionEngine.js';

function assertCanManageUterineInversion(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric uterine inversion protocols');
  }
  return user;
}

const obstetricUterineInversionEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  occurrenceDatetime: z.string().min(1),
  maternalAge: z.coerce.number().int().min(12).max(60).optional().nullable(),
  parity: z.coerce.number().int().min(0).max(15).default(1),
  deliveryMode: z.enum([
    'spontaneous_vaginal',
    'operative_vaginal_vacuum',
    'operative_vaginal_forceps',
    'cesarean_section',
  ]),

  placentalStatusAtInversion: z.enum([
    'attached_undelivered',
    'partially_separated',
    'completely_separated',
  ]),
  umbilicalCordTractionApplied: z.boolean(),
  fundalPressureApplied: z.boolean(),
  inversionDegree: z.enum([
    'first_degree_incomplete_intrauterine',
    'second_degree_complete_through_cervix',
    'third_degree_prolapsed_outside_introitus',
    'fourth_degree_total_inversion_with_vagina',
  ]),

  neurogenicShockPresent: z.boolean(),
  systolicBpAtPresentation: z.coerce.number().int().min(30).max(250),
  diastolicBpAtPresentation: z.coerce.number().int().min(10).max(160),
  heartRateAtPresentation: z.coerce.number().int().min(30).max(220),
  estimatedBloodLossMl: z.coerce.number().min(0).max(10000),

  reductionAttemptedImmediate: z.boolean(),
  reductionTechniquePrimary: z.enum([
    'johnson_manual_maneuver',
    'osullivan_hydrostatic_technique',
    'laparotomy_huntington_procedure',
    'laparotomy_haultain_procedure',
  ]),
  uterineRelaxantAdministered: z.boolean(),
  uterineRelaxantAgent: z.enum([
    'none',
    'terbutaline_sc',
    'nitroglycerin_iv',
    'magnesium_sulfate',
    'general_halogenated_anesthesia',
  ]).default('none'),
  uterotonicGivenBeforeReplacement: z.boolean(),
  placentaRemovedBeforeReinversion: z.boolean(),

  reinversionSuccessful: z.boolean(),
  timeToReinversionMinutes: z.coerce.number().int().min(1).max(180).optional().nullable(),
  postReplacementUterotonicsStarted: z.boolean(),
  bimanualUterineCompressionMaintained: z.boolean(),
  bloodProductsTransfusedUnits: z.coerce.number().int().min(0).max(50).default(0),

  status: z.enum([
    'acute_neurogenic_shock_reduction',
    'post_reinversion_bimanual_compression',
    'laparotomy_operative_repair',
    'stabilized_icu_surveillance',
    'resolved_ward_recovery',
  ]).default('acute_neurogenic_shock_reduction'),
  clinicalNotes: z.string().optional().nullable(),
});

const obstetricUterineInversionFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  minutesFromInversion: z.coerce.number().int().min(0).max(1440).default(0),
  systolicBp: z.coerce.number().int().min(30).max(250),
  diastolicBp: z.coerce.number().int().min(10).max(160),
  heartRateBpm: z.coerce.number().int().min(30).max(220),
  uterineTone: z.enum([
    'firm_well_contracted',
    'boggy_hypotonic',
    'relaxing_re_inversion_risk',
  ]),
  bimanualCompressionActive: z.boolean(),
  oxytocinInfusionRunning: z.boolean(),
  estimatedOngoingBloodLossMl: z.coerce.number().min(0).max(5000).default(0),
  urineOutputMlHr: z.coerce.number().min(0).max(1000).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerObstetricUterineInversionRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;
  // 1. Pure Preview Evaluation
  app.post('/api/obstetric-uterine-inversion/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    assertCanManageUterineInversion(req);
    const data = parse(obstetricUterineInversionEpisodeSchema.partial(), req.body);
    const evalResult = evaluateObstetricUterineInversion({
      maternalAge: data.maternalAge ?? undefined,
      parity: data.parity ?? 1,
      deliveryMode: data.deliveryMode ?? 'spontaneous_vaginal',
      placentalStatusAtInversion: data.placentalStatusAtInversion ?? 'attached_undelivered',
      umbilicalCordTractionApplied: data.umbilicalCordTractionApplied ?? false,
      fundalPressureApplied: data.fundalPressureApplied ?? false,
      inversionDegree: data.inversionDegree ?? 'third_degree_prolapsed_outside_introitus',
      neurogenicShockPresent: data.neurogenicShockPresent ?? false,
      systolicBpAtPresentation: data.systolicBpAtPresentation ?? 80,
      diastolicBpAtPresentation: data.diastolicBpAtPresentation ?? 50,
      heartRateAtPresentation: data.heartRateAtPresentation ?? 60,
      estimatedBloodLossMl: data.estimatedBloodLossMl ?? 500,
      reductionAttemptedImmediate: data.reductionAttemptedImmediate ?? true,
      reductionTechniquePrimary: data.reductionTechniquePrimary ?? 'johnson_manual_maneuver',
      uterineRelaxantAdministered: data.uterineRelaxantAdministered ?? false,
      uterineRelaxantAgent: data.uterineRelaxantAgent ?? 'none',
      uterotonicGivenBeforeReplacement: data.uterotonicGivenBeforeReplacement ?? false,
      placentaRemovedBeforeReinversion: data.placentaRemovedBeforeReinversion ?? false,
      reinversionSuccessful: data.reinversionSuccessful ?? false,
      timeToReinversionMinutes: data.timeToReinversionMinutes ?? undefined,
      postReplacementUterotonicsStarted: data.postReplacementUterotonicsStarted ?? false,
      bimanualUterineCompressionMaintained: data.bimanualUterineCompressionMaintained ?? false,
      bloodProductsTransfusedUnits: data.bloodProductsTransfusedUnits ?? 0,
    });
    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/obstetric-uterine-inversion/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let sql = `
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM obstetric_uterine_inversion_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      sql += ' AND e.patient_id = ?';
      params.push(patientId);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.created_at DESC';
    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 3. Create Episode
  app.post('/api/obstetric-uterine-inversion/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageUterineInversion(req);
    const data = parse(obstetricUterineInversionEpisodeSchema, req.body);

    const evalResult = evaluateObstetricUterineInversion({
      maternalAge: data.maternalAge ?? undefined,
      parity: data.parity,
      deliveryMode: data.deliveryMode,
      placentalStatusAtInversion: data.placentalStatusAtInversion,
      umbilicalCordTractionApplied: data.umbilicalCordTractionApplied,
      fundalPressureApplied: data.fundalPressureApplied,
      inversionDegree: data.inversionDegree,
      neurogenicShockPresent: data.neurogenicShockPresent,
      systolicBpAtPresentation: data.systolicBpAtPresentation,
      diastolicBpAtPresentation: data.diastolicBpAtPresentation,
      heartRateAtPresentation: data.heartRateAtPresentation,
      estimatedBloodLossMl: data.estimatedBloodLossMl,
      reductionAttemptedImmediate: data.reductionAttemptedImmediate,
      reductionTechniquePrimary: data.reductionTechniquePrimary,
      uterineRelaxantAdministered: data.uterineRelaxantAdministered,
      uterineRelaxantAgent: data.uterineRelaxantAgent,
      uterotonicGivenBeforeReplacement: data.uterotonicGivenBeforeReplacement,
      placentaRemovedBeforeReinversion: data.placentaRemovedBeforeReinversion,
      reinversionSuccessful: data.reinversionSuccessful,
      timeToReinversionMinutes: data.timeToReinversionMinutes ?? undefined,
      postReplacementUterotonicsStarted: data.postReplacementUterotonicsStarted,
      bimanualUterineCompressionMaintained: data.bimanualUterineCompressionMaintained,
      bloodProductsTransfusedUnits: data.bloodProductsTransfusedUnits,
    });

    const episodeCode = `INV-${Date.now().toString().slice(-8)}`;

    const res = db.prepare(`
      INSERT INTO obstetric_uterine_inversion_episodes (
        patient_id, admission_id, episode_code, occurrence_datetime,
        maternal_age, parity, delivery_mode,
        placental_status_at_inversion, umbilical_cord_traction_applied, fundal_pressure_applied,
        inversion_degree, neurogenic_shock_present,
        systolic_bp_at_presentation, diastolic_bp_at_presentation, heart_rate_at_presentation,
        estimated_blood_loss_ml, reduction_attempted_immediate, reduction_technique_primary,
        uterine_relaxant_administered, uterine_relaxant_agent,
        uterotonic_given_before_replacement, placenta_removed_before_reinversion,
        reinversion_successful, time_to_reinversion_minutes,
        post_replacement_uterotonics_started, bimanual_uterine_compression_maintained,
        blood_products_transfused_units, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.occurrenceDatetime,
      data.maternalAge ?? null,
      data.parity,
      data.deliveryMode,
      data.placentalStatusAtInversion,
      data.umbilicalCordTractionApplied ? 1 : 0,
      data.fundalPressureApplied ? 1 : 0,
      data.inversionDegree,
      data.neurogenicShockPresent ? 1 : 0,
      data.systolicBpAtPresentation,
      data.diastolicBpAtPresentation,
      data.heartRateAtPresentation,
      data.estimatedBloodLossMl,
      data.reductionAttemptedImmediate ? 1 : 0,
      data.reductionTechniquePrimary,
      data.uterineRelaxantAdministered ? 1 : 0,
      data.uterineRelaxantAgent,
      data.uterotonicGivenBeforeReplacement ? 1 : 0,
      data.placentaRemovedBeforeReinversion ? 1 : 0,
      data.reinversionSuccessful ? 1 : 0,
      data.timeToReinversionMinutes ?? null,
      data.postReplacementUterotonicsStarted ? 1 : 0,
      data.bimanualUterineCompressionMaintained ? 1 : 0,
      data.bloodProductsTransfusedUnits,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_uterine_inversion.create',
      entity: 'obstetric_uterine_inversion_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, degree: data.inversionDegree, status: data.status },
    });

    const episode = db.prepare('SELECT * FROM obstetric_uterine_inversion_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 4. Retrieve Single Episode
  app.get('/api/obstetric-uterine-inversion/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM obstetric_uterine_inversion_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Obstetric uterine inversion episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_uterine_inversion_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.inversion_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(id);

    const evalResult = evaluateObstetricUterineInversion({
      maternalAge: episode.maternal_age,
      parity: episode.parity,
      deliveryMode: episode.delivery_mode,
      placentalStatusAtInversion: episode.placental_status_at_inversion as PlacentalStatus,
      umbilicalCordTractionApplied: episode.umbilical_cord_traction_applied === 1,
      fundalPressureApplied: episode.fundal_pressure_applied === 1,
      inversionDegree: episode.inversion_degree as InversionDegree,
      neurogenicShockPresent: episode.neurogenic_shock_present === 1,
      systolicBpAtPresentation: episode.systolic_bp_at_presentation,
      diastolicBpAtPresentation: episode.diastolic_bp_at_presentation,
      heartRateAtPresentation: episode.heart_rate_at_presentation,
      estimatedBloodLossMl: episode.estimated_blood_loss_ml,
      reductionAttemptedImmediate: episode.reduction_attempted_immediate === 1,
      reductionTechniquePrimary: episode.reduction_technique_primary as ReductionTechnique,
      uterineRelaxantAdministered: episode.uterine_relaxant_administered === 1,
      uterineRelaxantAgent: episode.uterine_relaxant_agent as UterineRelaxantAgent,
      uterotonicGivenBeforeReplacement: episode.uterotonic_given_before_replacement === 1,
      placentaRemovedBeforeReinversion: episode.placenta_removed_before_reinversion === 1,
      reinversionSuccessful: episode.reinversion_successful === 1,
      timeToReinversionMinutes: episode.time_to_reinversion_minutes,
      postReplacementUterotonicsStarted: episode.post_replacement_uterotonics_started === 1,
      bimanualUterineCompressionMaintained: episode.bimanual_uterine_compression_maintained === 1,
      bloodProductsTransfusedUnits: episode.blood_products_transfused_units,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-uterine-inversion/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageUterineInversion(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM obstetric_uterine_inversion_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric uterine inversion episode not found');

    const data = parse(obstetricUterineInversionEpisodeSchema.partial(), req.body);

    db.prepare(`
      UPDATE obstetric_uterine_inversion_episodes
      SET
        reduction_attempted_immediate = COALESCE(?, reduction_attempted_immediate),
        reduction_technique_primary = COALESCE(?, reduction_technique_primary),
        uterine_relaxant_administered = COALESCE(?, uterine_relaxant_administered),
        uterine_relaxant_agent = COALESCE(?, uterine_relaxant_agent),
        uterotonic_given_before_replacement = COALESCE(?, uterotonic_given_before_replacement),
        placenta_removed_before_reinversion = COALESCE(?, placenta_removed_before_reinversion),
        reinversion_successful = COALESCE(?, reinversion_successful),
        time_to_reinversion_minutes = COALESCE(?, time_to_reinversion_minutes),
        post_replacement_uterotonics_started = COALESCE(?, post_replacement_uterotonics_started),
        bimanual_uterine_compression_maintained = COALESCE(?, bimanual_uterine_compression_maintained),
        blood_products_transfused_units = COALESCE(?, blood_products_transfused_units),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.reductionAttemptedImmediate !== undefined ? (data.reductionAttemptedImmediate ? 1 : 0) : null,
      data.reductionTechniquePrimary ?? null,
      data.uterineRelaxantAdministered !== undefined ? (data.uterineRelaxantAdministered ? 1 : 0) : null,
      data.uterineRelaxantAgent ?? null,
      data.uterotonicGivenBeforeReplacement !== undefined ? (data.uterotonicGivenBeforeReplacement ? 1 : 0) : null,
      data.placentaRemovedBeforeReinversion !== undefined ? (data.placentaRemovedBeforeReinversion ? 1 : 0) : null,
      data.reinversionSuccessful !== undefined ? (data.reinversionSuccessful ? 1 : 0) : null,
      data.timeToReinversionMinutes ?? null,
      data.postReplacementUterotonicsStarted !== undefined ? (data.postReplacementUterotonicsStarted ? 1 : 0) : null,
      data.bimanualUterineCompressionMaintained !== undefined ? (data.bimanualUterineCompressionMaintained ? 1 : 0) : null,
      data.bloodProductsTransfusedUnits ?? null,
      data.status ?? null,
      data.clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_uterine_inversion.update',
      entity: 'obstetric_uterine_inversion_episodes',
      entityId: Number(id),
      detail: { updatedFields: Object.keys(data) },
    });

    const episode = db.prepare('SELECT * FROM obstetric_uterine_inversion_episodes WHERE id = ?').get(id);
    return { episode };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-uterine-inversion/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageUterineInversion(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM obstetric_uterine_inversion_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric uterine inversion episode not found');

    db.prepare('DELETE FROM obstetric_uterine_inversion_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_uterine_inversion.delete',
      entity: 'obstetric_uterine_inversion_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-uterine-inversion/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageUterineInversion(req);
    const { id } = req.params as { id: string };

    const episode = db.prepare('SELECT * FROM obstetric_uterine_inversion_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric uterine inversion episode not found');

    const data = parse(obstetricUterineInversionFlowsheetSchema, req.body);

    const res = db.prepare(`
      INSERT INTO obstetric_uterine_inversion_flowsheet_logs (
        inversion_episode_id, patient_id, log_datetime, minutes_from_inversion,
        systolic_bp, diastolic_bp, heart_rate_bpm, uterine_tone,
        bimanual_compression_active, oxytocin_infusion_running,
        estimated_ongoing_blood_loss_ml, urine_output_ml_hr,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromInversion,
      data.systolicBp,
      data.diastolicBp,
      data.heartRateBpm,
      data.uterineTone,
      data.bimanualCompressionActive ? 1 : 0,
      data.oxytocinInfusionRunning ? 1 : 0,
      data.estimatedOngoingBloodLossMl,
      data.urineOutputMlHr ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_uterine_inversion.flowsheet_add',
      entity: 'obstetric_uterine_inversion_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), sbp: data.systolicBp, tone: data.uterineTone },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-uterine-inversion/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageUterineInversion(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM obstetric_uterine_inversion_flowsheet_logs
      WHERE id = ? AND inversion_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_uterine_inversion_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_uterine_inversion.flowsheet_delete',
      entity: 'obstetric_uterine_inversion_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
