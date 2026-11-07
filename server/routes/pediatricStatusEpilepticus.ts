import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluatePediatricStatusEpilepticus,
  calculatePhase1Benzo,
  calculatePhase2Agents,
  calculatePhase3Infusions,
} from '../../web/src/pediatricStatusEpilepticusEngine.js';

function assertCanManagePediatricStatusEpilepticus(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical pediatricians and PICU emergency nurses can manage pediatric status epilepticus records');
  }
  return user;
}

export const pediatricStatusEpilepticusEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  seizureOnsetDatetime: z.string().min(1, 'Seizure onset datetime is required'),
  ageMonths: z.number().int().min(0).max(216),
  weightKg: z.number().min(1.0).max(120.0),
  etiology: z.enum([
    'febrile_status',
    'known_epilepsy',
    'cns_infection',
    'toxic_metabolic',
    'trauma_stroke',
    'unknown',
  ]).default('unknown'),
  seizureSemiology: z.enum([
    'generalized_tonic_clonic',
    'focal_motor',
    'non_convulsive_status',
    'myoclonic',
  ]).default('generalized_tonic_clonic'),
  phase1BenzoGiven: z.boolean().default(false),
  phase1BenzoAgent: z.enum(['midazolam_buccal_in', 'lorazepam_iv', 'diazepam_rectal']).nullable().optional(),
  phase1BenzoDoseMg: z.number().min(0.1).max(50.0).nullable().optional(),
  phase1AdministeredMinute: z.number().int().min(0).max(180).nullable().optional(),
  phase2SecondLineGiven: z.boolean().default(false),
  phase2Agent: z.enum(['levetiracetam', 'fosphenytoin', 'valproate_sodium']).nullable().optional(),
  phase2DoseMg: z.number().min(10).max(10000).nullable().optional(),
  phase2AdministeredMinute: z.number().int().min(0).max(360).nullable().optional(),
  phase3RefractoryStatus: z.boolean().default(false),
  phase3InfusionAgent: z.enum(['midazolam_infusion', 'propofol_infusion', 'ketamine_infusion']).nullable().optional(),
  phase3InfusionRateMcgKgMin: z.number().min(0.1).max(100.0).nullable().optional(),
  seizureCessationMinute: z.number().int().min(0).max(1440).nullable().optional(),
  status: z.enum([
    'active_seizure',
    'refractory_status',
    'seizure_abated_post_ictal',
    'picu_neuro_monitoring',
    'resolved',
  ]).default('active_seizure'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const pediatricSeizureFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromOnset: z.number().int().min(0).max(1440).default(0),
  phaseActive: z.enum([
    'phase_1_emergent_benzo',
    'phase_2_urgent_control',
    'phase_3_refractory_infusion',
    'post_seizure_stabilization',
  ]).default('phase_1_emergent_benzo'),
  seizureActivityPresent: z.boolean().default(true),
  vitalsHr: z.number().int().min(30).max(250).nullable().optional(),
  vitalsSbp: z.number().int().min(30).max(220).nullable().optional(),
  vitalsDbp: z.number().int().min(15).max(150).nullable().optional(),
  vitalsSpo2: z.number().min(40).max(100).nullable().optional(),
  airwayStatus: z.enum([
    'patent_spontaneous',
    'bag_valve_mask',
    'intubated_ett',
    'laryngeal_mask',
  ]).default('patent_spontaneous'),
  infusionRateMcgKgMin: z.number().min(0).max(100).nullable().optional(),
  eegBackground: z.enum([
    'not_monitoring',
    'normal',
    'slowing',
    'continuous_spikes',
    'burst_suppression',
    'flat',
  ]).default('not_monitoring'),
  notes: z.string().max(500).nullable().optional(),
});

export function registerPediatricStatusEpilepticusRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Preview Calculation Endpoint
  app.post('/api/pediatric-status-epilepticus/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        ageMonths: z.number().int().min(0).max(216),
        weightKg: z.number().min(1.0).max(120.0),
        minutesFromOnset: z.number().int().min(0).max(1440).default(5),
        etiology: z.string().optional(),
        seizureSemiology: z.string().optional(),
        phase1BenzoGiven: z.boolean().default(false),
        phase1DosesCount: z.number().int().min(0).max(5).default(0),
        phase2Given: z.boolean().default(false),
        seizureOngoing: z.boolean().default(true),
      }),
      req.body,
    );

    const evalResult = evaluatePediatricStatusEpilepticus({
      ageMonths: body.ageMonths,
      weightKg: body.weightKg,
      minutesFromOnset: body.minutesFromOnset,
      etiology: body.etiology,
      seizureSemiology: body.seizureSemiology,
      phase1BenzoGiven: body.phase1BenzoGiven,
      phase1DosesCount: body.phase1DosesCount,
      phase2Given: body.phase2Given,
      seizureOngoing: body.seizureOngoing,
    });

    return { evalResult };
  });

  // 2. Create Status Epilepticus Episode
  app.post('/api/pediatric-status-epilepticus/episodes', async (req, reply) => {
    const user = assertCanManagePediatricStatusEpilepticus(req);
    const data = parse(pediatricStatusEpilepticusEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluatePediatricStatusEpilepticus({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      minutesFromOnset: data.phase1AdministeredMinute ?? 5,
      etiology: data.etiology,
      seizureSemiology: data.seizureSemiology,
      phase1BenzoGiven: data.phase1BenzoGiven,
      phase2Given: data.phase2SecondLineGiven,
      seizureOngoing: data.status === 'active_seizure' || data.status === 'refractory_status',
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `PSTAT-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_status_epilepticus_episodes (
        patient_id, admission_id, episode_code, seizure_onset_datetime,
        age_months, weight_kg, etiology, seizure_semiology,
        phase1_benzo_given, phase1_benzo_agent, phase1_benzo_dose_mg,
        phase1_administered_minute, phase2_second_line_given, phase2_agent,
        phase2_dose_mg, phase2_administered_minute, phase3_refractory_status,
        phase3_infusion_agent, phase3_infusion_rate_mcg_kg_min,
        seizure_cessation_minute, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.seizureOnsetDatetime,
      data.ageMonths,
      data.weightKg,
      data.etiology,
      data.seizureSemiology,
      data.phase1BenzoGiven ? 1 : 0,
      data.phase1BenzoAgent ?? null,
      data.phase1BenzoDoseMg ?? null,
      data.phase1AdministeredMinute ?? null,
      data.phase2SecondLineGiven ? 1 : 0,
      data.phase2Agent ?? null,
      data.phase2DoseMg ?? null,
      data.phase2AdministeredMinute ?? null,
      data.phase3RefractoryStatus ? 1 : 0,
      data.phase3InfusionAgent ?? null,
      data.phase3InfusionRateMcgKgMin ?? null,
      data.seizureCessationMinute ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM pediatric_status_epilepticus_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_status_epilepticus.episode_create',
      entity: 'pediatric_status_epilepticus_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        etiology: data.etiology,
        seizureSemiology: data.seizureSemiology,
        currentPhase: evalResult.currentPhase,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/pediatric-status-epilepticus/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM pediatric_status_epilepticus_episodes WHERE 1=1';
    const params: any[] = [];

    if (query.patientId) {
      sql += ' AND patient_id = ?';
      params.push(query.patientId);
    }
    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY seizure_onset_datetime DESC';

    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 4. Get Single Episode with Flowsheet
  app.get('/api/pediatric-status-epilepticus/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM pediatric_status_epilepticus_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric status epilepticus episode not found');

    const logs = db
      .prepare('SELECT * FROM pediatric_status_epilepticus_flowsheet_logs WHERE seizure_episode_id = ? ORDER BY minutes_from_onset ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-status-epilepticus/episodes/:id', async (req) => {
    const user = assertCanManagePediatricStatusEpilepticus(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(pediatricStatusEpilepticusEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM pediatric_status_epilepticus_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric status epilepticus episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.phase1BenzoGiven !== undefined) {
      fields.push('phase1_benzo_given = ?');
      values.push(data.phase1BenzoGiven ? 1 : 0);
    }
    if (data.phase1BenzoAgent !== undefined) {
      fields.push('phase1_benzo_agent = ?');
      values.push(data.phase1BenzoAgent);
    }
    if (data.phase1BenzoDoseMg !== undefined) {
      fields.push('phase1_benzo_dose_mg = ?');
      values.push(data.phase1BenzoDoseMg);
    }
    if (data.phase2SecondLineGiven !== undefined) {
      fields.push('phase2_second_line_given = ?');
      values.push(data.phase2SecondLineGiven ? 1 : 0);
    }
    if (data.phase2Agent !== undefined) {
      fields.push('phase2_agent = ?');
      values.push(data.phase2Agent);
    }
    if (data.phase2DoseMg !== undefined) {
      fields.push('phase2_dose_mg = ?');
      values.push(data.phase2DoseMg);
    }
    if (data.phase3RefractoryStatus !== undefined) {
      fields.push('phase3_refractory_status = ?');
      values.push(data.phase3RefractoryStatus ? 1 : 0);
    }
    if (data.phase3InfusionAgent !== undefined) {
      fields.push('phase3_infusion_agent = ?');
      values.push(data.phase3InfusionAgent);
    }
    if (data.phase3InfusionRateMcgKgMin !== undefined) {
      fields.push('phase3_infusion_rate_mcg_kg_min = ?');
      values.push(data.phase3InfusionRateMcgKgMin);
    }
    if (data.seizureCessationMinute !== undefined) {
      fields.push('seizure_cessation_minute = ?');
      values.push(data.seizureCessationMinute);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE pediatric_status_epilepticus_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM pediatric_status_epilepticus_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_status_epilepticus.episode_update',
      entity: 'pediatric_status_epilepticus_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-status-epilepticus/episodes/:id', async (req) => {
    const user = assertCanManagePediatricStatusEpilepticus(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM pediatric_status_epilepticus_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric status epilepticus episode not found');

    db.prepare('DELETE FROM pediatric_status_epilepticus_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_status_epilepticus.episode_delete',
      entity: 'pediatric_status_epilepticus_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-status-epilepticus/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricStatusEpilepticus(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(pediatricSeizureFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM pediatric_status_epilepticus_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric status epilepticus episode not found');

    const stmt = db.prepare(`
      INSERT INTO pediatric_status_epilepticus_flowsheet_logs (
        seizure_episode_id, patient_id, log_datetime, minutes_from_onset,
        phase_active, seizure_activity_present, vitals_hr, vitals_sbp,
        vitals_dbp, vitals_spo2, airway_status, infusion_rate_mcg_kg_min,
        eeg_background, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromOnset,
      data.phaseActive,
      data.seizureActivityPresent ? 1 : 0,
      data.vitalsHr ?? null,
      data.vitalsSbp ?? null,
      data.vitalsDbp ?? null,
      data.vitalsSpo2 ?? null,
      data.airwayStatus,
      data.infusionRateMcgKgMin ?? null,
      data.eegBackground,
      data.notes ?? null,
      user.id,
    );

    // If seizure has abated in log, update status if not already
    if (!data.seizureActivityPresent && episode.status === 'active_seizure') {
      db.prepare(`
        UPDATE pediatric_status_epilepticus_episodes
        SET status = 'seizure_abated_post_ictal', seizure_cessation_minute = COALESCE(seizure_cessation_minute, ?), updated_at = datetime('now')
        WHERE id = ?
      `).run(data.minutesFromOnset, id);
    }

    audit(db, {
      actorId: user.id,
      action: 'pediatric_status_epilepticus.flowsheet_log',
      entity: 'pediatric_status_epilepticus_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        minutesFromOnset: data.minutesFromOnset,
        phaseActive: data.phaseActive,
        seizureOngoing: data.seizureActivityPresent,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      seizureActive: data.seizureActivityPresent,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-status-epilepticus/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricStatusEpilepticus(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db
      .prepare('SELECT * FROM pediatric_status_epilepticus_flowsheet_logs WHERE id = ? AND seizure_episode_id = ?')
      .get(logId, episodeId) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_status_epilepticus_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_status_epilepticus.flowsheet_delete',
      entity: 'pediatric_status_epilepticus_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, patientId: log.patient_id },
    });

    return { success: true };
  });

  // 9. Printable Dossier Endpoint
  app.get('/api/pediatric-status-epilepticus/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM pediatric_status_epilepticus_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric status epilepticus episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id) as any;
    const logs = db
      .prepare('SELECT * FROM pediatric_status_epilepticus_flowsheet_logs WHERE seizure_episode_id = ? ORDER BY minutes_from_onset ASC')
      .all(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_status_epilepticus.print',
      entity: 'pediatric_status_epilepticus_episodes',
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
