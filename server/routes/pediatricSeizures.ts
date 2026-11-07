import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluatePediatricSeizureProtocol,
  getBroselowZone,
  type PediatricSeizureParams,
} from '../../web/src/pediatricSeizureEngine.js';

function assertCanManagePediatricSeizures(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians, pediatricians, and pediatric emergency nurses can manage pediatric seizure episodes');
  }
  return user;
}

export const pediatricSeizureEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  seizureStartDatetime: z.string().min(1, 'Seizure start datetime is required'),
  seizureType: z.enum([
    'generalized_tonic_clonic',
    'focal_with_impaired_awareness',
    'myoclonic',
    'absence_atypical',
    'subtle_neonatal',
    'non_convulsive_status',
  ]),
  etiology: z.enum([
    'febrile_status',
    'known_epilepsy',
    'cns_infection_meningitis_encephalitis',
    'electrolyte_derangement_hypoglycemia_hyponatremia',
    'acute_trauma_intracranial_hemorrhage',
    'toxic_ingestion',
    'unknown_cryptogenic',
  ]).nullable().optional(),
  patientAgeMonths: z.number().min(0).max(216),
  weightKg: z.number().min(1.0).max(120.0),
  broselowColorZone: z.enum([
    'grey', 'pink', 'red', 'purple', 'yellow', 'white', 'blue', 'orange', 'green', 'not_applicable'
  ]).nullable().optional(),
  currentAlgorithmPhase: z.enum([
    'phase_1_stabilization_0_5m',
    'phase_2_first_line_bzd_5_20m',
    'phase_3_second_line_asm_20_40m',
    'phase_4_refractory_rsi_picu_gt_40m',
    'seizure_aborted_postictal',
  ]).default('phase_1_stabilization_0_5m'),
  seizureCessationDatetime: z.string().nullable().optional(),
  totalSeizureDurationMinutes: z.number().min(0).max(360).nullable().optional(),
  bloodGlucoseMgDl: z.number().min(10).max(1000).nullable().optional(),
  d10wBolusGivenMl: z.number().nullable().optional(),
  phase2BenzodiazepineGiven: z.string().nullable().optional(),
  phase2DoseCount: z.number().int().min(0).max(4).default(0),
  phase3SecondLineAgent: z.string().nullable().optional(),
  phase3SecondLineDoseMg: z.number().nullable().optional(),
  phase3InfusionStatus: z.enum(['not_started', 'infusing', 'completed', 'failed_to_abort']).nullable().optional(),
  phase4PicuEscalationStatus: z.enum([
    'not_needed',
    'rsi_intubation_underway',
    'midazolam_infusion_titrating',
    'propofol_infusion_titrating',
    'ketamine_infusion_titrating',
    'admitted_picu_continuous_eeg',
  ]).nullable().optional(),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const pediatricSeizureTimelineSchema = z.object({
  elapsedMinutes: z.number().min(0).max(360),
  timestamp: z.string().min(1, 'Timestamp is required'),
  actionType: z.enum([
    'airway_oxygen_positioning',
    'blood_glucose_checked',
    'd10w_bolus_administered',
    'iv_io_access_secured',
    'first_line_benzodiazepine',
    'second_line_asm_administered',
    'rsi_intubation_preoxygenation',
    'anesthetic_infusion_started',
    'seizure_aborted',
    'eeg_monitoring_initiated',
    'vital_signs_recorded',
  ]),
  medicationName: z.string().nullable().optional(),
  doseAdministered: z.string().nullable().optional(),
  route: z.enum(['iv', 'io', 'intranasal', 'buccal', 'rectal', 'im', 'infusion', 'inhalation', 'oral', 'subcutaneous']).nullable().optional(),
  heartRateBpm: z.number().int().min(30).max(250).nullable().optional(),
  bloodPressureSystolic: z.number().int().min(40).max(220).nullable().optional(),
  bloodPressureDiastolic: z.number().int().min(20).max(140).nullable().optional(),
  spo2Percent: z.number().min(40).max(100).nullable().optional(),
  activeMotorActivity: z.boolean().default(true),
  clinicalObservations: z.string().max(500).nullable().optional(),
});

export function registerPediatricSeizuresRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List seizure episodes
  app.get('/api/pediatric-seizures/episodes', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, phase } = req.query as { patientId?: string; phase?: string };

    let query = `
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as attending_pediatrician_name
      FROM pediatric_seizure_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.attending_pediatrician_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` AND e.patient_id = ?`;
      params.push(parseInt(patientId, 10));
    }
    if (phase) {
      query += ` AND e.current_algorithm_phase = ?`;
      params.push(phase);
    }

    query += ` ORDER BY e.seizure_start_datetime DESC`;
    const rows = ctx.db.prepare(query).all(...params);
    return reply.send({ episodes: rows });
  });

  // 2. Get single seizure episode with timeline
  app.get('/api/pediatric-seizures/episodes/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare(`
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as attending_pediatrician_name
      FROM pediatric_seizure_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.attending_pediatrician_id = u.id
      WHERE e.id = ?
    `).get(id);

    if (!episode) throw notFound('Pediatric seizure episode not found');

    const timelineLogs = ctx.db.prepare(`
      SELECT t.*, u.full_name as logged_by_name
      FROM pediatric_seizure_timeline_logs t
      JOIN users u ON t.logged_by_id = u.id
      WHERE t.seizure_episode_id = ?
      ORDER BY t.elapsed_minutes ASC, t.timestamp ASC
    `).all(id);

    return reply.send({ episode, timelineLogs });
  });

  // 3. Calculator / Phase Evaluation endpoint
  app.post('/api/pediatric-seizures/calculate', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as PediatricSeizureParams;
    const result = evaluatePediatricSeizureProtocol(body);
    return reply.send(result);
  });

  // 4. Create Seizure Episode
  app.post('/api/pediatric-seizures/episodes', async (req, reply) => {
    const user = assertCanManagePediatricSeizures(req);
    const body = parse(pediatricSeizureEpisodeSchema, req.body);

    const episodeCode = `SZ-${Date.now().toString().slice(-6)}`;
    const broselowZone = body.broselowColorZone || getBroselowZone(body.weightKg);

    const insertStmt = ctx.db.prepare(`
      INSERT INTO pediatric_seizure_episodes (
        patient_id, admission_id, episode_code, seizure_start_datetime,
        seizure_type, etiology, patient_age_months, weight_kg,
        broselow_color_zone, current_algorithm_phase, seizure_cessation_datetime,
        total_seizure_duration_minutes, blood_glucose_mg_dl, d10w_bolus_given_ml,
        phase2_benzodiazepine_given, phase2_dose_count, phase3_second_line_agent,
        phase3_second_line_dose_mg, phase3_infusion_status, phase4_picu_escalation_status,
        attending_pediatrician_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = insertStmt.run(
      body.patientId,
      body.admissionId ?? null,
      episodeCode,
      body.seizureStartDatetime,
      body.seizureType,
      body.etiology ?? null,
      body.patientAgeMonths,
      body.weightKg,
      broselowZone,
      body.currentAlgorithmPhase,
      body.seizureCessationDatetime ?? null,
      body.totalSeizureDurationMinutes ?? null,
      body.bloodGlucoseMgDl ?? null,
      body.d10wBolusGivenMl ?? null,
      body.phase2BenzodiazepineGiven ?? null,
      body.phase2DoseCount,
      body.phase3SecondLineAgent ?? null,
      body.phase3SecondLineDoseMg ?? null,
      body.phase3InfusionStatus ?? null,
      body.phase4PicuEscalationStatus ?? null,
      user.id,
      body.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_seizure.episode_create',
      entity: 'pediatric_seizure_episodes',
      entityId: episodeId,
      detail: `Initiated seizure episode ${episodeCode} (${body.seizureType}, Weight: ${body.weightKg} kg, Broselow: ${broselowZone})`,
    });

    const created = ctx.db.prepare('SELECT * FROM pediatric_seizure_episodes WHERE id = ?').get(episodeId);
    return reply.status(201).send({ episode: created });
  });

  // 5. Update Seizure Episode
  app.put('/api/pediatric-seizures/episodes/:id', async (req, reply) => {
    const user = assertCanManagePediatricSeizures(req);
    const { id } = req.params as { id: string };
    const body = parse(pediatricSeizureEpisodeSchema.partial(), req.body);

    const existing = ctx.db.prepare('SELECT * FROM pediatric_seizure_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric seizure episode not found');

    const updateStmt = ctx.db.prepare(`
      UPDATE pediatric_seizure_episodes SET
        current_algorithm_phase = COALESCE(?, current_algorithm_phase),
        seizure_cessation_datetime = COALESCE(?, seizure_cessation_datetime),
        total_seizure_duration_minutes = COALESCE(?, total_seizure_duration_minutes),
        blood_glucose_mg_dl = COALESCE(?, blood_glucose_mg_dl),
        d10w_bolus_given_ml = COALESCE(?, d10w_bolus_given_ml),
        phase2_benzodiazepine_given = COALESCE(?, phase2_benzodiazepine_given),
        phase2_dose_count = COALESCE(?, phase2_dose_count),
        phase3_second_line_agent = COALESCE(?, phase3_second_line_agent),
        phase3_second_line_dose_mg = COALESCE(?, phase3_second_line_dose_mg),
        phase3_infusion_status = COALESCE(?, phase3_infusion_status),
        phase4_picu_escalation_status = COALESCE(?, phase4_picu_escalation_status),
        clinical_notes = COALESCE(?, clinical_notes)
      WHERE id = ?
    `);

    updateStmt.run(
      body.currentAlgorithmPhase ?? null,
      body.seizureCessationDatetime ?? null,
      body.totalSeizureDurationMinutes ?? null,
      body.bloodGlucoseMgDl ?? null,
      body.d10wBolusGivenMl ?? null,
      body.phase2BenzodiazepineGiven ?? null,
      body.phase2DoseCount ?? null,
      body.phase3SecondLineAgent ?? null,
      body.phase3SecondLineDoseMg ?? null,
      body.phase3InfusionStatus ?? null,
      body.phase4PicuEscalationStatus ?? null,
      body.clinicalNotes ?? null,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_seizure.episode_update',
      entity: 'pediatric_seizure_episodes',
      entityId: Number(id),
      detail: `Updated seizure episode ${existing.episode_code}: Phase: ${body.currentAlgorithmPhase ?? existing.current_algorithm_phase}`,
    });

    const updated = ctx.db.prepare('SELECT * FROM pediatric_seizure_episodes WHERE id = ?').get(id);
    return reply.send({ episode: updated });
  });

  // 6. Delete Seizure Episode
  app.delete('/api/pediatric-seizures/episodes/:id', async (req, reply) => {
    const user = assertCanManagePediatricSeizures(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM pediatric_seizure_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric seizure episode not found');

    ctx.db.prepare('DELETE FROM pediatric_seizure_episodes WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_seizure.episode_delete',
      entity: 'pediatric_seizure_episodes',
      entityId: Number(id),
      detail: `Deleted seizure episode ${existing.episode_code}`,
    });

    return reply.send({ success: true, message: 'Seizure episode deleted successfully' });
  });

  // Print audit
  app.post('/api/pediatric-seizures/episodes/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const existing = ctx.db.prepare('SELECT * FROM pediatric_seizure_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric seizure episode not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_seizure.print',
      entity: 'pediatric_seizure_episodes',
      entityId: Number(id),
      detail: `Printed pediatric seizure resuscitation dossier for episode ${existing.episode_code}`,
    });

    return reply.send({ success: true, message: 'Pediatric seizure print audited' });
  });

  // 7. List Timeline Logs
  app.get('/api/pediatric-seizures/episodes/:id/timeline', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const logs = ctx.db.prepare(`
      SELECT t.*, u.full_name as logged_by_name
      FROM pediatric_seizure_timeline_logs t
      JOIN users u ON t.logged_by_id = u.id
      WHERE t.seizure_episode_id = ?
      ORDER BY t.elapsed_minutes ASC, t.timestamp ASC
    `).all(id);

    return reply.send(logs);
  });

  // 8. Add Timeline Event
  app.post('/api/pediatric-seizures/episodes/:id/timeline', async (req, reply) => {
    const user = assertCanManagePediatricSeizures(req);
    const { id } = req.params as { id: string };
    const body = parse(pediatricSeizureTimelineSchema, req.body);

    const episode = ctx.db.prepare('SELECT * FROM pediatric_seizure_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Seizure episode not found');

    const insertStmt = ctx.db.prepare(`
      INSERT INTO pediatric_seizure_timeline_logs (
        seizure_episode_id, elapsed_minutes, timestamp,
        action_type, medication_name, dose_administered,
        route, heart_rate_bpm, blood_pressure_systolic,
        blood_pressure_diastolic, spo2_percent, active_motor_activity,
        logged_by_id, clinical_observations
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = insertStmt.run(
      id,
      body.elapsedMinutes,
      body.timestamp,
      body.actionType,
      body.medicationName ?? null,
      body.doseAdministered ?? null,
      body.route ?? null,
      body.heartRateBpm ?? null,
      body.bloodPressureSystolic ?? null,
      body.bloodPressureDiastolic ?? null,
      body.spo2Percent ?? null,
      body.activeMotorActivity ? 1 : 0,
      user.id,
      body.clinicalObservations ?? null
    );

    // If seizure aborted, optionally update episode status
    if (body.actionType === 'seizure_aborted' || !body.activeMotorActivity) {
      ctx.db.prepare(`
        UPDATE pediatric_seizure_episodes SET
          current_algorithm_phase = 'seizure_aborted_postictal',
          seizure_cessation_datetime = COALESCE(seizure_cessation_datetime, ?),
          total_seizure_duration_minutes = COALESCE(total_seizure_duration_minutes, ?)
        WHERE id = ?
      `).run(body.timestamp, body.elapsedMinutes, id);
    }

    const logId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_seizure.timeline_log',
      entity: 'pediatric_seizure_timeline_logs',
      entityId: logId,
      detail: `Logged timeline event (${body.actionType}) at ${body.elapsedMinutes} min: ${body.medicationName ?? ''} ${body.doseAdministered ?? ''}`,
    });

    const created = ctx.db.prepare(`
      SELECT t.*, u.full_name as logged_by_name
      FROM pediatric_seizure_timeline_logs t
      JOIN users u ON t.logged_by_id = u.id
      WHERE t.id = ?
    `).get(logId);

    return reply.status(201).send({ log: created });
  });

  // 9. Delete Timeline Event
  app.delete('/api/pediatric-seizures/timeline/:id', async (req, reply) => {
    const user = assertCanManagePediatricSeizures(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM pediatric_seizure_timeline_logs WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Timeline log not found');

    ctx.db.prepare('DELETE FROM pediatric_seizure_timeline_logs WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_seizure.timeline_delete',
      entity: 'pediatric_seizure_timeline_logs',
      entityId: Number(id),
      detail: `Deleted timeline log ID ${id}`,
    });

    return reply.send({ success: true, message: 'Timeline log deleted successfully' });
  });
}
