import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateShoulderDystocia,
  evaluateHeadToBodyInterval,
  type OperativeVaginalMode,
  type InternalRotationalManeuver,
  type AdvancedDystociaManeuver,
  type NeonatalInjuryType,
} from '../../web/src/obstetricShoulderDystociaEngine.js';

function assertCanManageShoulderDystocia(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only obstetricians, pediatricians, and labor & delivery nurses can manage shoulder dystocia records');
  }
  return user;
}

export const obstetricShoulderDystociaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  deliveryDatetime: z.string().min(1, 'Delivery datetime is required'),
  maternalAge: z.number().int().min(12).max(60).nullable().optional(),
  gestationalAgeWeeks: z.number().min(24.0).max(45.0),
  estimatedFetalWeightGrams: z.number().min(1000).max(7000).nullable().optional(),
  actualBirthWeightGrams: z.number().min(1000).max(7000),
  gestationalDiabetes: z.boolean().default(false),
  operativeVaginalDelivery: z.enum(['spontaneous_vaginal', 'vacuum_assisted', 'forceps_assisted']).default('spontaneous_vaginal'),

  turtleSignObserved: z.boolean().default(true),
  headDeliveryDatetime: z.string().min(1, 'Head delivery datetime is required'),
  bodyDeliveryDatetime: z.string().min(1, 'Body delivery datetime is required'),
  headToBodyIntervalSeconds: z.number().int().min(10).max(1800),

  helpCalled: z.boolean().default(true),
  episiotomyPerformed: z.boolean().default(false),
  mcrobertsManeuverSuccess: z.boolean().default(false),
  suprapubicPressureSuccess: z.boolean().default(false),
  internalRotationalManeuver: z.enum(['none', 'rubin_ii', 'woods_screw', 'reverse_woods_screw']).default('none'),
  internalRotationalSuccess: z.boolean().default(false),
  posteriorArmDeliverySuccess: z.boolean().default(false),
  gaskinAllFoursSuccess: z.boolean().default(false),
  advancedManeuversRequired: z.enum([
    'none',
    'intentional_clavicle_fracture_cleidotomy',
    'zavanelli_cephalic_replacement',
    'symphysiotomy',
  ]).default('none'),
  fundalPressureAvoided: z.boolean().default(true),

  apgar1min: z.number().int().min(0).max(10).nullable().optional(),
  apgar5min: z.number().int().min(0).max(10).nullable().optional(),
  apgar10min: z.number().int().min(0).max(10).nullable().optional(),
  umbilicalArterialPh: z.number().min(6.5).max(7.6).nullable().optional(),
  neonatalInjury: z.enum([
    'none',
    'brachial_plexus_erb_palsy',
    'brachial_plexus_klumpke',
    'clavicular_fracture',
    'humeral_fracture',
    'hypoxic_ischemic_encephalopathy',
  ]).default('none'),
  postpartumHemorrhageObserved: z.boolean().default(false),
  perinealTearDegree: z.enum([
    'none_or_first_degree',
    'second_degree',
    'third_degree_oasi',
    'fourth_degree_oasi',
  ]).default('none_or_first_degree'),

  status: z.enum([
    'resuscitation_active',
    'postpartum_hie_monitoring',
    'transferred_to_nicu',
    'discharged_stable',
  ]).default('resuscitation_active'),
  clinicalNotes: z.string().nullable().optional(),
});

export const obstetricShoulderDystociaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  secondsFromHeadDelivery: z.number().int().min(0).max(3600),
  maneuverAttempted: z.enum([
    'call_help_timer_started',
    'mcroberts_hyperflexion',
    'suprapubic_rubin_i_pressure',
    'episiotomy_incision',
    'rubin_ii_internal_rotation',
    'woods_screw_rotation',
    'reverse_woods_rotation',
    'delivery_posterior_arm',
    'gaskin_all_fours_roll',
    'cleidotomy_fracture',
    'zavanelli_or_emergency_csection',
  ]),
  maneuverOutcome: z.enum([
    'successful_restitution_and_delivery',
    'failed_advance_to_next_step',
    'partial_rotation_incomplete',
  ]),
  tractionApplied: z.enum([
    'none',
    'gentle_axial_traction_only',
    'excessive_lateral_traction_prevented',
  ]).default('gentle_axial_traction_only'),
  notes: z.string().nullable().optional(),
});

export function registerObstetricShoulderDystociaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/obstetric-shoulder-dystocia/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(obstetricShoulderDystociaEpisodeSchema.partial(), req.body);

    const evalResult = evaluateShoulderDystocia({
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? 39.5,
      actualBirthWeightGrams: data.actualBirthWeightGrams ?? 4100,
      gestationalDiabetes: data.gestationalDiabetes ?? false,
      operativeVaginalDelivery: (data.operativeVaginalDelivery as OperativeVaginalMode) ?? 'spontaneous_vaginal',
      turtleSignObserved: data.turtleSignObserved ?? true,
      headToBodyIntervalSeconds: data.headToBodyIntervalSeconds ?? 150,
      helpCalled: data.helpCalled ?? true,
      episiotomyPerformed: data.episiotomyPerformed ?? false,
      mcrobertsManeuverSuccess: data.mcrobertsManeuverSuccess ?? false,
      suprapubicPressureSuccess: data.suprapubicPressureSuccess ?? true,
      internalRotationalManeuver: (data.internalRotationalManeuver as InternalRotationalManeuver) ?? 'none',
      internalRotationalSuccess: data.internalRotationalSuccess ?? false,
      posteriorArmDeliverySuccess: data.posteriorArmDeliverySuccess ?? false,
      gaskinAllFoursSuccess: data.gaskinAllFoursSuccess ?? false,
      advancedManeuversRequired: (data.advancedManeuversRequired as AdvancedDystociaManeuver) ?? 'none',
      fundalPressureAvoided: data.fundalPressureAvoided ?? true,
      apgar1min: data.apgar1min ?? undefined,
      apgar5min: data.apgar5min ?? undefined,
      umbilicalArterialPh: data.umbilicalArterialPh ?? undefined,
      neonatalInjury: (data.neonatalInjury as NeonatalInjuryType) ?? 'none',
    });

    return { evalResult };
  });

  // 2. Create Shoulder Dystocia Episode
  app.post('/api/obstetric-shoulder-dystocia/episodes', async (req, reply) => {
    const user = assertCanManageShoulderDystocia(req);
    const data = parse(obstetricShoulderDystociaEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateShoulderDystocia({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      actualBirthWeightGrams: data.actualBirthWeightGrams,
      gestationalDiabetes: data.gestationalDiabetes,
      operativeVaginalDelivery: data.operativeVaginalDelivery,
      turtleSignObserved: data.turtleSignObserved,
      headToBodyIntervalSeconds: data.headToBodyIntervalSeconds,
      helpCalled: data.helpCalled,
      episiotomyPerformed: data.episiotomyPerformed,
      mcrobertsManeuverSuccess: data.mcrobertsManeuverSuccess,
      suprapubicPressureSuccess: data.suprapubicPressureSuccess,
      internalRotationalManeuver: data.internalRotationalManeuver,
      internalRotationalSuccess: data.internalRotationalSuccess,
      posteriorArmDeliverySuccess: data.posteriorArmDeliverySuccess,
      gaskinAllFoursSuccess: data.gaskinAllFoursSuccess,
      advancedManeuversRequired: data.advancedManeuversRequired,
      fundalPressureAvoided: data.fundalPressureAvoided,
      apgar1min: data.apgar1min ?? undefined,
      apgar5min: data.apgar5min ?? undefined,
      umbilicalArterialPh: data.umbilicalArterialPh ?? undefined,
      neonatalInjury: data.neonatalInjury,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `DYSTOCIA-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_shoulder_dystocia_episodes (
        patient_id, admission_id, episode_code, delivery_datetime,
        maternal_age, gestational_age_weeks, estimated_fetal_weight_grams, actual_birth_weight_grams,
        gestational_diabetes, operative_vaginal_delivery,
        turtle_sign_observed, head_delivery_datetime, body_delivery_datetime, head_to_body_interval_seconds,
        help_called, episiotomy_performed, mcroberts_maneuver_success, suprapubic_pressure_success,
        internal_rotational_maneuver, internal_rotational_success,
        posterior_arm_delivery_success, gaskin_all_fours_success, advanced_maneuvers_required,
        fundal_pressure_avoided,
        apgar_1min, apgar_5min, apgar_10min, umbilical_arterial_ph,
        neonatal_injury, postpartum_hemorrhage_observed, perineal_tear_degree,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.deliveryDatetime,
      data.maternalAge ?? null,
      data.gestationalAgeWeeks,
      data.estimatedFetalWeightGrams ?? null,
      data.actualBirthWeightGrams,
      data.gestationalDiabetes ? 1 : 0,
      data.operativeVaginalDelivery,
      data.turtleSignObserved ? 1 : 0,
      data.headDeliveryDatetime,
      data.bodyDeliveryDatetime,
      data.headToBodyIntervalSeconds,
      data.helpCalled ? 1 : 0,
      data.episiotomyPerformed ? 1 : 0,
      data.mcrobertsManeuverSuccess ? 1 : 0,
      data.suprapubicPressureSuccess ? 1 : 0,
      data.internalRotationalManeuver,
      data.internalRotationalSuccess ? 1 : 0,
      data.posteriorArmDeliverySuccess ? 1 : 0,
      data.gaskinAllFoursSuccess ? 1 : 0,
      data.advancedManeuversRequired,
      data.fundalPressureAvoided ? 1 : 0,
      data.apgar1min ?? null,
      data.apgar5min ?? null,
      data.apgar10min ?? null,
      data.umbilicalArterialPh ?? null,
      data.neonatalInjury,
      data.postpartumHemorrhageObserved ? 1 : 0,
      data.perinealTearDegree,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_shoulder_dystocia.create',
      entity: 'obstetric_shoulder_dystocia_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, intervalSeconds: data.headToBodyIntervalSeconds, successfulManeuver: evalResult.successfulManeuver },
    });

    const created = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_shoulder_dystocia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(episodeId);

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Episodes
  app.get('/api/obstetric-shoulder-dystocia/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_shoulder_dystocia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
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

    query += ' ORDER BY e.created_at DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet Logs
  app.get('/api/obstetric-shoulder-dystocia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode: any = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_shoulder_dystocia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id));

    if (!episode) throw notFound('Obstetric shoulder dystocia episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM obstetric_shoulder_dystocia_flowsheet_logs l
      LEFT JOIN users u ON u.id = l.logged_by_id
      WHERE l.shoulder_dystocia_episode_id = ?
      ORDER BY l.seconds_from_head_delivery ASC
    `).all(Number(id));

    const evalResult = evaluateShoulderDystocia({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      actualBirthWeightGrams: episode.actual_birth_weight_grams,
      gestationalDiabetes: Boolean(episode.gestational_diabetes),
      operativeVaginalDelivery: episode.operative_vaginal_delivery,
      turtleSignObserved: Boolean(episode.turtle_sign_observed),
      headToBodyIntervalSeconds: episode.head_to_body_interval_seconds,
      helpCalled: Boolean(episode.help_called),
      episiotomyPerformed: Boolean(episode.episiotomy_performed),
      mcrobertsManeuverSuccess: Boolean(episode.mcroberts_maneuver_success),
      suprapubicPressureSuccess: Boolean(episode.suprapubic_pressure_success),
      internalRotationalManeuver: episode.internal_rotational_maneuver,
      internalRotationalSuccess: Boolean(episode.internal_rotational_success),
      posteriorArmDeliverySuccess: Boolean(episode.posterior_arm_delivery_success),
      gaskinAllFoursSuccess: Boolean(episode.gaskin_all_fours_success),
      advancedManeuversRequired: episode.advanced_maneuvers_required,
      fundalPressureAvoided: Boolean(episode.fundal_pressure_avoided),
      apgar1min: episode.apgar_1min ?? undefined,
      apgar5min: episode.apgar_5min ?? undefined,
      umbilicalArterialPh: episode.umbilical_arterial_ph ?? undefined,
      neonatalInjury: episode.neonatal_injury,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode Status / Notes
  app.patch('/api/obstetric-shoulder-dystocia/episodes/:id', async (req) => {
    const user = assertCanManageShoulderDystocia(req);
    const { id } = req.params as { id: string };

    const updateSchema = z.object({
      status: z.enum([
        'resuscitation_active',
        'postpartum_hie_monitoring',
        'transferred_to_nicu',
        'discharged_stable',
      ]).optional(),
      neonatalInjury: z.enum([
        'none',
        'brachial_plexus_erb_palsy',
        'brachial_plexus_klumpke',
        'clavicular_fracture',
        'humeral_fracture',
        'hypoxic_ischemic_encephalopathy',
      ]).optional(),
      postpartumHemorrhageObserved: z.boolean().optional(),
      clinicalNotes: z.string().nullable().optional(),
    });

    const data = parse(updateSchema, req.body);
    const episode = db.prepare('SELECT * FROM obstetric_shoulder_dystocia_episodes WHERE id = ?').get(Number(id));
    if (!episode) throw notFound('Obstetric shoulder dystocia episode not found');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.neonatalInjury !== undefined) {
      updates.push('neonatal_injury = ?');
      params.push(data.neonatalInjury);
    }
    if (data.postpartumHemorrhageObserved !== undefined) {
      updates.push('postpartum_hemorrhage_observed = ?');
      params.push(data.postpartumHemorrhageObserved ? 1 : 0);
    }
    if (data.clinicalNotes !== undefined) {
      updates.push('clinical_notes = ?');
      params.push(data.clinicalNotes);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(Number(id));
      db.prepare(`UPDATE obstetric_shoulder_dystocia_episodes SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      audit(db, {
        actorId: user.id,
        action: 'obstetric_shoulder_dystocia.update',
        entity: 'obstetric_shoulder_dystocia_episodes',
        entityId: Number(id),
        detail: { ...data },
      });
    }

    const updated = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_shoulder_dystocia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id));

    return { episode: updated };
  });

  // 6. Delete Episode (Doctor only)
  app.delete('/api/obstetric-shoulder-dystocia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete shoulder dystocia episodes');

    const { id } = req.params as { id: string };
    const episode = db.prepare('SELECT id, patient_id, episode_code FROM obstetric_shoulder_dystocia_episodes WHERE id = ?').get(Number(id)) as { id: number; patient_id: number; episode_code: string } | undefined;
    if (!episode) throw notFound('Obstetric shoulder dystocia episode not found');

    db.prepare('DELETE FROM obstetric_shoulder_dystocia_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_shoulder_dystocia.delete',
      entity: 'obstetric_shoulder_dystocia_episodes',
      entityId: Number(id),
      detail: { episodeCode: episode.episode_code, patientId: episode.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Maneuver Execution Log
  app.post('/api/obstetric-shoulder-dystocia/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageShoulderDystocia(req);
    const { id } = req.params as { id: string };
    const data = parse(obstetricShoulderDystociaFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM obstetric_shoulder_dystocia_episodes WHERE id = ?').get(Number(id)) as { id: number; patient_id: number } | undefined;
    if (!episode) throw notFound('Obstetric shoulder dystocia episode not found');

    const stmt = db.prepare(`
      INSERT INTO obstetric_shoulder_dystocia_flowsheet_logs (
        shoulder_dystocia_episode_id, patient_id, log_datetime, seconds_from_head_delivery,
        maneuver_attempted, maneuver_outcome, traction_applied, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      episode.id,
      episode.patient_id,
      data.logDatetime,
      data.secondsFromHeadDelivery,
      data.maneuverAttempted,
      data.maneuverOutcome,
      data.tractionApplied,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_shoulder_dystocia.flowsheet_add',
      entity: 'obstetric_shoulder_dystocia_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: episode.id, maneuver: data.maneuverAttempted, seconds: data.secondsFromHeadDelivery },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-shoulder-dystocia/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageShoulderDystocia(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id, shoulder_dystocia_episode_id FROM obstetric_shoulder_dystocia_flowsheet_logs WHERE id = ? AND shoulder_dystocia_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_shoulder_dystocia_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_shoulder_dystocia.flowsheet_delete',
      entity: 'obstetric_shoulder_dystocia_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
