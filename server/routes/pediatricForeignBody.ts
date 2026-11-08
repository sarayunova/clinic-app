import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricForeignBody,
  type ForeignBodyNature,
  type ObstructionSeverity,
  type FBAOIntervention,
  type BronchoscopyLocation,
} from '../../web/src/pediatricForeignBodyEngine.js';

function assertCanManagePediatricForeignBody(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only pediatricians, emergency physicians, and pediatric nurses can manage foreign body airway records');
  }
  return user;
}

export const pediatricForeignBodyEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  incidentDatetime: z.string().min(1, 'Incident datetime is required'),
  ageMonths: z.number().int().min(1).max(216),
  weightKg: z.number().min(2.0).max(100.0),

  witnessedChokingEpisode: z.boolean().default(true),
  suspectedForeignBodyNature: z.enum([
    'organic_food_nut_seed',
    'small_toy_plastic_bead',
    'coin_metallic_battery',
    'balloon_latex',
    'unknown_material',
  ]).default('organic_food_nut_seed'),
  obstructionSeverity: z.enum([
    'mild_incomplete_effective_cough',
    'severe_complete_ineffective_cough',
    'unconscious_cardiorespiratory_arrest',
  ]),
  stridorOrAphonia: z.boolean().default(true),
  cyanosisPresent: z.boolean().default(false),
  silentChestNoted: z.boolean().default(false),

  heartRateBpm: z.number().int().min(40).max(250),
  respiratoryRate: z.number().int().min(0).max(120),
  spo2Percent: z.number().min(30.0).max(100.0),

  interventionApplied: z.enum([
    'encouraged_spontaneous_coughing',
    'back_blows_and_chest_thrusts_infant',
    'subdiaphragmatic_heimlich_child',
    'cpr_chest_compressions_ventilations',
    'rigid_bronchoscopy_or_surgical_airway',
  ]),
  blindFingerSweepAvoided: z.boolean().default(true),
  foreignBodyExpelled: z.boolean().default(false),
  spontaneousRespirationRestored: z.boolean().default(false),
  rigidBronchoscopyRequired: z.boolean().default(false),
  bronchoscopyLocation: z.enum([
    'none',
    'trachea_carina',
    'right_main_bronchus',
    'left_main_bronchus',
    'segmental_bronchi',
  ]).default('none'),

  status: z.enum([
    'acute_choking_management',
    'post_clearance_observation',
    'picu_escalation_bronchoscopy',
    'discharged_home_stable',
  ]).default('acute_choking_management'),
  clinicalNotes: z.string().nullable().optional(),
});

export const pediatricForeignBodyFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromChoking: z.number().int().min(0).default(0),

  mentalStatus: z.enum([
    'alert_vocalizing',
    'irritable_lethargic',
    'unresponsive_coma',
  ]),
  airwayPatency: z.enum([
    'clear_normal_air_entry',
    'partial_wheeze_stridor',
    'silent_complete_obstruction',
  ]),
  heartRateBpm: z.number().int().min(40).max(250),
  respiratoryRate: z.number().int().min(0).max(120),
  spo2Percent: z.number().min(30.0).max(100.0),

  interventionCycle: z.enum([
    'reassurance_and_spontaneous_coughing',
    'five_back_slaps_five_chest_thrusts',
    'subdiaphragmatic_heimlich_thrusts',
    'cpr_with_direct_laryngoscopy_removal',
    'urgent_or_rigid_bronchoscopy',
  ]),
  foreignObjectVisualizedOrRemoved: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export function registerPediatricForeignBodyRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/pediatric-foreign-body/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(pediatricForeignBodyEpisodeSchema.partial(), req.body);

    const evalResult = evaluatePediatricForeignBody({
      ageMonths: data.ageMonths ?? 18,
      weightKg: data.weightKg ?? 11.5,
      witnessedChokingEpisode: data.witnessedChokingEpisode ?? true,
      suspectedForeignBodyNature: (data.suspectedForeignBodyNature as ForeignBodyNature) ?? 'organic_food_nut_seed',
      obstructionSeverity: (data.obstructionSeverity as ObstructionSeverity) ?? 'severe_complete_ineffective_cough',
      stridorOrAphonia: data.stridorOrAphonia ?? true,
      cyanosisPresent: data.cyanosisPresent ?? false,
      silentChestNoted: data.silentChestNoted ?? false,
      heartRateBpm: data.heartRateBpm ?? 140,
      respiratoryRate: data.respiratoryRate ?? 40,
      spo2Percent: data.spo2Percent ?? 94.0,
      interventionApplied: (data.interventionApplied as FBAOIntervention) ?? 'subdiaphragmatic_heimlich_child',
      blindFingerSweepAvoided: data.blindFingerSweepAvoided ?? true,
      foreignBodyExpelled: data.foreignBodyExpelled ?? false,
      spontaneousRespirationRestored: data.spontaneousRespirationRestored ?? false,
      rigidBronchoscopyRequired: data.rigidBronchoscopyRequired ?? false,
      bronchoscopyLocation: (data.bronchoscopyLocation as BronchoscopyLocation) ?? 'none',
    });

    return { evalResult };
  });

  // 2. Create Pediatric Foreign Body Episode
  app.post('/api/pediatric-foreign-body/episodes', async (req, reply) => {
    const user = assertCanManagePediatricForeignBody(req);
    const data = parse(pediatricForeignBodyEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluatePediatricForeignBody({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      witnessedChokingEpisode: data.witnessedChokingEpisode,
      suspectedForeignBodyNature: data.suspectedForeignBodyNature,
      obstructionSeverity: data.obstructionSeverity,
      stridorOrAphonia: data.stridorOrAphonia,
      cyanosisPresent: data.cyanosisPresent,
      silentChestNoted: data.silentChestNoted,
      heartRateBpm: data.heartRateBpm,
      respiratoryRate: data.respiratoryRate,
      spo2Percent: data.spo2Percent,
      interventionApplied: data.interventionApplied,
      blindFingerSweepAvoided: data.blindFingerSweepAvoided,
      foreignBodyExpelled: data.foreignBodyExpelled,
      spontaneousRespirationRestored: data.spontaneousRespirationRestored,
      rigidBronchoscopyRequired: data.rigidBronchoscopyRequired,
      bronchoscopyLocation: data.bronchoscopyLocation,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `FBAO-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_foreign_body_episodes (
        patient_id, admission_id, episode_code, incident_datetime,
        age_months, weight_kg,
        witnessed_choking_episode, suspected_foreign_body_nature, obstruction_severity,
        stridor_or_aphonia, cyanosis_present, silent_chest_noted,
        heart_rate_bpm, respiratory_rate, spo2_percent,
        intervention_applied, blind_finger_sweep_avoided,
        foreign_body_expelled, spontaneous_respiration_restored,
        rigid_bronchoscopy_required, bronchoscopy_location,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.incidentDatetime,
      data.ageMonths,
      data.weightKg,
      data.witnessedChokingEpisode ? 1 : 0,
      data.suspectedForeignBodyNature,
      data.obstructionSeverity,
      data.stridorOrAphonia ? 1 : 0,
      data.cyanosisPresent ? 1 : 0,
      data.silentChestNoted ? 1 : 0,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.interventionApplied,
      data.blindFingerSweepAvoided ? 1 : 0,
      data.foreignBodyExpelled ? 1 : 0,
      data.spontaneousRespirationRestored ? 1 : 0,
      data.rigidBronchoscopyRequired ? 1 : 0,
      data.bronchoscopyLocation,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_foreign_body.create',
      entity: 'pediatric_foreign_body_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, severity: data.obstructionSeverity, expelled: data.foreignBodyExpelled },
    });

    const created = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_foreign_body_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(episodeId);

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Episodes
  app.get('/api/pediatric-foreign-body/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_foreign_body_episodes e
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
  app.get('/api/pediatric-foreign-body/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode: any = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_foreign_body_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id));

    if (!episode) throw notFound('Pediatric foreign body episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM pediatric_foreign_body_flowsheet_logs l
      LEFT JOIN users u ON u.id = l.logged_by_id
      WHERE l.foreign_body_episode_id = ?
      ORDER BY l.minutes_from_choking ASC
    `).all(Number(id));

    const evalResult = evaluatePediatricForeignBody({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      witnessedChokingEpisode: Boolean(episode.witnessed_choking_episode),
      suspectedForeignBodyNature: episode.suspected_foreign_body_nature,
      obstructionSeverity: episode.obstruction_severity,
      stridorOrAphonia: Boolean(episode.stridor_or_aphonia),
      cyanosisPresent: Boolean(episode.cyanosis_present),
      silentChestNoted: Boolean(episode.silent_chest_noted),
      heartRateBpm: episode.heart_rate_bpm,
      respiratoryRate: episode.respiratory_rate,
      spo2Percent: episode.spo2_percent,
      interventionApplied: episode.intervention_applied,
      blindFingerSweepAvoided: Boolean(episode.blind_finger_sweep_avoided),
      foreignBodyExpelled: Boolean(episode.foreign_body_expelled),
      spontaneousRespirationRestored: Boolean(episode.spontaneous_respiration_restored),
      rigidBronchoscopyRequired: Boolean(episode.rigid_bronchoscopy_required),
      bronchoscopyLocation: episode.bronchoscopy_location,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode Status / Notes
  app.patch('/api/pediatric-foreign-body/episodes/:id', async (req) => {
    const user = assertCanManagePediatricForeignBody(req);
    const { id } = req.params as { id: string };

    const updateSchema = z.object({
      status: z.enum([
        'acute_choking_management',
        'post_clearance_observation',
        'picu_escalation_bronchoscopy',
        'discharged_home_stable',
      ]).optional(),
      foreignBodyExpelled: z.boolean().optional(),
      spontaneousRespirationRestored: z.boolean().optional(),
      clinicalNotes: z.string().nullable().optional(),
    });

    const data = parse(updateSchema, req.body);
    const episode = db.prepare('SELECT * FROM pediatric_foreign_body_episodes WHERE id = ?').get(Number(id));
    if (!episode) throw notFound('Pediatric foreign body episode not found');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.foreignBodyExpelled !== undefined) {
      updates.push('foreign_body_expelled = ?');
      params.push(data.foreignBodyExpelled ? 1 : 0);
    }
    if (data.spontaneousRespirationRestored !== undefined) {
      updates.push('spontaneous_respiration_restored = ?');
      params.push(data.spontaneousRespirationRestored ? 1 : 0);
    }
    if (data.clinicalNotes !== undefined) {
      updates.push('clinical_notes = ?');
      params.push(data.clinicalNotes);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(Number(id));
      db.prepare(`UPDATE pediatric_foreign_body_episodes SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      audit(db, {
        actorId: user.id,
        action: 'pediatric_foreign_body.update',
        entity: 'pediatric_foreign_body_episodes',
        entityId: Number(id),
        detail: { ...data },
      });
    }

    const updated = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_foreign_body_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id));

    return { episode: updated };
  });

  // 6. Delete Episode (Doctor only)
  app.delete('/api/pediatric-foreign-body/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete foreign body airway episodes');

    const { id } = req.params as { id: string };
    const episode = db.prepare('SELECT id, patient_id, episode_code FROM pediatric_foreign_body_episodes WHERE id = ?').get(Number(id)) as { id: number; patient_id: number; episode_code: string } | undefined;
    if (!episode) throw notFound('Pediatric foreign body episode not found');

    db.prepare('DELETE FROM pediatric_foreign_body_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_foreign_body.delete',
      entity: 'pediatric_foreign_body_episodes',
      entityId: Number(id),
      detail: { episodeCode: episode.episode_code, patientId: episode.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Observation Log
  app.post('/api/pediatric-foreign-body/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricForeignBody(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricForeignBodyFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM pediatric_foreign_body_episodes WHERE id = ?').get(Number(id)) as { id: number; patient_id: number } | undefined;
    if (!episode) throw notFound('Pediatric foreign body episode not found');

    const stmt = db.prepare(`
      INSERT INTO pediatric_foreign_body_flowsheet_logs (
        foreign_body_episode_id, patient_id, log_datetime, minutes_from_choking,
        mental_status, airway_patency, heart_rate_bpm, respiratory_rate, spo2_percent,
        intervention_cycle, foreign_object_visualized_or_removed, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      episode.id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromChoking,
      data.mentalStatus,
      data.airwayPatency,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.interventionCycle,
      data.foreignObjectVisualizedOrRemoved ? 1 : 0,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_foreign_body.flowsheet_add',
      entity: 'pediatric_foreign_body_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: episode.id, cycle: data.interventionCycle, minutes: data.minutesFromChoking },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-foreign-body/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricForeignBody(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id, foreign_body_episode_id FROM pediatric_foreign_body_flowsheet_logs WHERE id = ? AND foreign_body_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_foreign_body_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_foreign_body.flowsheet_delete',
      entity: 'pediatric_foreign_body_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
