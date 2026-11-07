import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluatePecarn,
  classifyGcsSeverity,
  type PecarnRiskTier,
} from '../../web/src/pediatricTbiPecarnEngine.js';

function assertCanManagePediatricTbi(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical pediatricians, emergency physicians and PICU nurses can manage pediatric TBI & PECARN records');
  }
  return user;
}

export const pediatricTbiEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  injuryDatetime: z.string().min(1, 'Injury datetime is required'),
  ageMonths: z.number().int().min(0).max(216),
  weightKg: z.number().min(1.0).max(120.0),
  injuryMechanism: z.enum([
    'severe_motor_vehicle_collision',
    'fall_greater_than_threshold',
    'pedestrian_or_cyclist_vs_vehicle',
    'struck_by_high_velocity_object',
    'ground_level_fall',
    'assault_non_accidental_trauma',
    'other',
  ]).default('other'),
  gcsScore: z.number().int().min(3).max(15).default(15),
  alteredMentalStatus: z.boolean().default(false),
  palpableSkullFracture: z.boolean().default(false),
  nonFrontalScalpHematoma: z.boolean().default(false),
  lossOfConsciousnessSeconds: z.number().int().min(0).default(0),
  actingAbnormalParent: z.boolean().default(false),
  signsOfBasilarFracture: z.boolean().default(false),
  vomitingEpisodesCount: z.number().int().min(0).default(0),
  severeHeadache: z.boolean().default(false),
  severeMechanism: z.boolean().default(false),
  ctPerformed: z.boolean().default(false),
  ctFindings: z.enum([
    'not_performed',
    'normal',
    'isolated_linear_fracture',
    'depressed_skull_fracture',
    'epidural_hematoma',
    'subdural_hematoma',
    'subarachnoid_hemorrhage',
    'cerebral_contusion',
    'diffuse_cerebral_edema_midline_shift',
  ]).default('not_performed'),
  raisedIcpSuspected: z.boolean().default(false),
  icpManagementTier: z.enum([
    'tier_0_observation',
    'tier_1_neuroprotective',
    'tier_2_hyperosmolar_therapy',
    'tier_3_refractory_decompression',
  ]).default('tier_0_observation'),
  hyperosmolarAgent: z.enum(['none', 'hypertonic_saline_3pct', 'mannitol_20pct']).default('none'),
  intubationStatus: z.enum([
    'natural_airway',
    'intubated_mechanical_ventilation',
  ]).default('natural_airway'),
  status: z.enum([
    'acute_ed_eval',
    'picu_icp_monitoring',
    'post_operative_craniotomy',
    'step_down_ward',
    'discharged_convalescent',
  ]).default('acute_ed_eval'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const pediatricTbiFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromInjury: z.number().int().min(0).default(0),
  gcsTotal: z.number().int().min(3).max(15),
  gcsEye: z.number().int().min(1).max(4).default(4),
  gcsVerbal: z.number().int().min(1).max(5).default(5),
  gcsMotor: z.number().int().min(1).max(6).default(6),
  pupilReactivity: z.enum([
    'brisk_bilateral',
    'sluggish_bilateral',
    'unilateral_fixed_dilated',
    'bilateral_fixed_dilated',
  ]).default('brisk_bilateral'),
  pupilSizeRightMm: z.number().min(1).max(9).nullable().optional(),
  pupilSizeLeftMm: z.number().min(1).max(9).nullable().optional(),
  vitalsHr: z.number().int().min(30).max(250).nullable().optional(),
  vitalsSbp: z.number().int().min(30).max(250).nullable().optional(),
  vitalsDbp: z.number().int().min(15).max(150).nullable().optional(),
  vitalsSpo2: z.number().min(50).max(100).nullable().optional(),
  icpMmhg: z.number().min(0).max(100).nullable().optional(),
  serumSodiumMeqL: z.number().min(100).max(180).nullable().optional(),
  serumOsmolarityMosmKg: z.number().min(200).max(450).nullable().optional(),
  hyperosmolarBolusGiven: z.enum(['none', 'hypertonic_saline_3pct', 'mannitol_20pct']).default('none'),
  notes: z.string().max(500).nullable().optional(),
});

export function registerPediatricTbiPecarnRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Calculator Endpoint
  app.post('/api/pediatric-tbi/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(pediatricTbiEpisodeSchema.partial(), req.body);

    const evalResult = evaluatePecarn({
      ageMonths: body.ageMonths ?? 36,
      weightKg: body.weightKg ?? 15.0,
      gcsScore: body.gcsScore ?? 15,
      alteredMentalStatus: body.alteredMentalStatus,
      palpableSkullFracture: body.palpableSkullFracture,
      nonFrontalScalpHematoma: body.nonFrontalScalpHematoma,
      lossOfConsciousnessSeconds: body.lossOfConsciousnessSeconds,
      actingAbnormalParent: body.actingAbnormalParent,
      signsOfBasilarFracture: body.signsOfBasilarFracture,
      vomitingEpisodesCount: body.vomitingEpisodesCount,
      severeHeadache: body.severeHeadache,
      severeMechanism: body.severeMechanism,
      intubated: body.intubationStatus === 'intubated_mechanical_ventilation',
    });

    return { evalResult };
  });

  // 2. Create Pediatric TBI Episode
  app.post('/api/pediatric-tbi/episodes', async (req, reply) => {
    const user = assertCanManagePediatricTbi(req);
    const data = parse(pediatricTbiEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluatePecarn({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      gcsScore: data.gcsScore,
      alteredMentalStatus: data.alteredMentalStatus,
      palpableSkullFracture: data.palpableSkullFracture,
      nonFrontalScalpHematoma: data.nonFrontalScalpHematoma,
      lossOfConsciousnessSeconds: data.lossOfConsciousnessSeconds,
      actingAbnormalParent: data.actingAbnormalParent,
      signsOfBasilarFracture: data.signsOfBasilarFracture,
      vomitingEpisodesCount: data.vomitingEpisodesCount,
      severeHeadache: data.severeHeadache,
      severeMechanism: data.severeMechanism,
      intubated: data.intubationStatus === 'intubated_mechanical_ventilation',
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `TBI-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_tbi_episodes (
        patient_id, admission_id, episode_code, injury_datetime,
        age_months, weight_kg, injury_mechanism, age_bracket,
        gcs_score, altered_mental_status, palpable_skull_fracture,
        non_frontal_scalp_hematoma, loss_of_consciousness_seconds,
        acting_abnormal_parent, signs_of_basilar_fracture,
        vomiting_episodes_count, severe_headache, pecarn_risk_category,
        ct_performed, ct_findings, raised_icp_suspected,
        icp_management_tier, hyperosmolar_agent, intubation_status,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
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
      data.injuryDatetime,
      data.ageMonths,
      data.weightKg,
      data.injuryMechanism,
      evalResult.ageBracket,
      data.gcsScore,
      data.alteredMentalStatus ? 1 : 0,
      data.palpableSkullFracture ? 1 : 0,
      data.nonFrontalScalpHematoma ? 1 : 0,
      data.lossOfConsciousnessSeconds,
      data.actingAbnormalParent ? 1 : 0,
      data.signsOfBasilarFracture ? 1 : 0,
      data.vomitingEpisodesCount,
      data.severeHeadache ? 1 : 0,
      evalResult.pecarnRiskTier,
      data.ctPerformed ? 1 : 0,
      data.ctFindings,
      data.raisedIcpSuspected ? 1 : 0,
      data.icpManagementTier,
      data.hyperosmolarAgent,
      data.intubationStatus,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM pediatric_tbi_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_tbi.episode_create',
      entity: 'pediatric_tbi_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        pecarnRiskTier: evalResult.pecarnRiskTier,
        gcsScore: data.gcsScore,
        ageBracket: evalResult.ageBracket,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List TBI Episodes
  app.get('/api/pediatric-tbi/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM pediatric_tbi_episodes WHERE 1=1';
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
  app.get('/api/pediatric-tbi/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM pediatric_tbi_episodes WHERE id = ?').get(id);
    if (!episode) throw notFound('TBI episode not found');

    const logs = db
      .prepare('SELECT * FROM pediatric_tbi_flowsheet_logs WHERE tbi_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-tbi/episodes/:id', async (req) => {
    const user = assertCanManagePediatricTbi(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(pediatricTbiEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM pediatric_tbi_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('TBI episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.gcsScore !== undefined) {
      fields.push('gcs_score = ?');
      values.push(data.gcsScore);
    }
    if (data.ctPerformed !== undefined) {
      fields.push('ct_performed = ?');
      values.push(data.ctPerformed ? 1 : 0);
    }
    if (data.ctFindings !== undefined) {
      fields.push('ct_findings = ?');
      values.push(data.ctFindings);
    }
    if (data.raisedIcpSuspected !== undefined) {
      fields.push('raised_icp_suspected = ?');
      values.push(data.raisedIcpSuspected ? 1 : 0);
    }
    if (data.icpManagementTier !== undefined) {
      fields.push('icp_management_tier = ?');
      values.push(data.icpManagementTier);
    }
    if (data.hyperosmolarAgent !== undefined) {
      fields.push('hyperosmolar_agent = ?');
      values.push(data.hyperosmolarAgent);
    }
    if (data.intubationStatus !== undefined) {
      fields.push('intubation_status = ?');
      values.push(data.intubationStatus);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE pediatric_tbi_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM pediatric_tbi_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_tbi.episode_update',
      entity: 'pediatric_tbi_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-tbi/episodes/:id', async (req) => {
    const user = assertCanManagePediatricTbi(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM pediatric_tbi_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('TBI episode not found');

    db.prepare('DELETE FROM pediatric_tbi_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_tbi.episode_delete',
      entity: 'pediatric_tbi_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-tbi/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricTbi(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(pediatricTbiFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM pediatric_tbi_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('TBI episode not found');

    // Calculate CPP if MAP and ICP are available
    let cpp: number | null = null;
    if (data.vitalsSbp && data.vitalsDbp && data.icpMmhg) {
      const map = (2 * data.vitalsDbp + data.vitalsSbp) / 3;
      cpp = Math.round(map - data.icpMmhg);
    }

    const stmt = db.prepare(`
      INSERT INTO pediatric_tbi_flowsheet_logs (
        tbi_episode_id, patient_id, log_datetime, minutes_from_injury,
        gcs_total, gcs_eye, gcs_verbal, gcs_motor,
        pupil_reactivity, pupil_size_right_mm, pupil_size_left_mm,
        vitals_hr, vitals_sbp, vitals_dbp, vitals_spo2,
        icp_mmhg, calculated_cpp_mmhg, serum_sodium_meq_l,
        serum_osmolarity_mosm_kg, hyperosmolar_bolus_given,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromInjury,
      data.gcsTotal,
      data.gcsEye,
      data.gcsVerbal,
      data.gcsMotor,
      data.pupilReactivity,
      data.pupilSizeRightMm ?? null,
      data.pupilSizeLeftMm ?? null,
      data.vitalsHr ?? null,
      data.vitalsSbp ?? null,
      data.vitalsDbp ?? null,
      data.vitalsSpo2 ?? null,
      data.icpMmhg ?? null,
      cpp,
      data.serumSodiumMeqL ?? null,
      data.serumOsmolarityMosmKg ?? null,
      data.hyperosmolarBolusGiven,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_tbi.flowsheet_log',
      entity: 'pediatric_tbi_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        gcs: data.gcsTotal,
        icp: data.icpMmhg,
        cpp,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      gcsTotal: data.gcsTotal,
      cpp,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-tbi/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricTbi(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db.prepare('SELECT * FROM pediatric_tbi_flowsheet_logs WHERE id = ? AND tbi_episode_id = ?').get(logId, episodeId);
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_tbi_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_tbi.flowsheet_delete',
      entity: 'pediatric_tbi_flowsheet_logs',
      entityId: logId,
      detail: { episodeId },
    });

    return { success: true };
  });

  // 9. Printable Clinical Dossier
  app.get('/api/pediatric-tbi/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM pediatric_tbi_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('TBI episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id);
    const logs = db
      .prepare('SELECT * FROM pediatric_tbi_flowsheet_logs WHERE tbi_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, patient, logs };
  });
}
