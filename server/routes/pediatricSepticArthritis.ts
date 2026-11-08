import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricSepticArthritis,
  type AffectedJointLocation,
  type SynovialGramStain,
  type SurgicalApproach,
  type EmpiricAntibioticRegimen,
} from '../../web/src/pediatricSepticArthritisEngine.js';

function assertCanManagePediatricSepticArthritis(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only pediatricians, orthopedic surgeons, and nurses can manage septic arthritis records');
  }
  return user;
}

export const pediatricSepticArthritisEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  evaluationDatetime: z.string().min(1, 'Evaluation datetime is required'),
  ageMonths: z.number().int().min(1).max(216),
  weightKg: z.number().min(2.0).max(120.0),
  affectedJoint: z.enum([
    'right_hip',
    'left_hip',
    'right_knee',
    'left_knee',
    'right_ankle',
    'left_ankle',
    'other_joint',
  ]),

  nonWeightBearing: z.boolean().default(true),
  temperatureCelsius: z.number().min(34.0).max(43.0),
  esrMmHr: z.number().min(0).max(150),
  wbcCountPerMicroliter: z.number().int().min(500).max(80000),
  crpMgL: z.number().min(0.1).max(400.0).nullable().optional(),

  ultrasoundEffusionDetected: z.boolean().default(false),
  arthrocentesisPerformed: z.boolean().default(false),
  synovialWbcCount: z.number().int().min(0).max(500000).nullable().optional(),
  synovialPmnPct: z.number().min(0).max(100.0).nullable().optional(),
  synovialGramStain: z.enum([
    'pending',
    'gram_positive_cocci',
    'gram_negative_bacilli',
    'no_organisms_seen',
  ]).default('pending'),

  surgicalDrainageRequired: z.boolean().default(false),
  surgicalApproach: z.enum([
    'none',
    'arthrotomy_open_capsulotomy',
    'arthroscopic_lavage',
    'needle_aspiration_serial',
  ]).default('none'),
  empiricAntibioticRegimen: z.enum([
    'none',
    'cefazolin_iv',
    'vancomycin_iv',
    'ceftriaxone_plus_vancomycin',
    'clindamycin_iv',
  ]).default('none'),

  status: z.enum([
    'evaluation_pending',
    'operating_room_arthrotomy',
    'postoperative_iv_antibiotics',
    'transient_synovitis_observed',
    'infection_resolved_discharged',
  ]).default('evaluation_pending'),
  clinicalNotes: z.string().nullable().optional(),
});

export const pediatricSepticArthritisFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromTriage: z.number().min(0).default(0),

  temperatureCelsius: z.number().min(34.0).max(43.0),
  heartRateBpm: z.number().int().min(40).max(250),
  jointRangeOfMotion: z.enum([
    'severely_restricted_pseudoparalysis',
    'moderate_guarding',
    'mild_limitation',
    'full_painless_rom',
  ]),
  weightBearingAbility: z.enum([
    'non_weight_bearing',
    'limping_antalgic',
    'full_independent',
  ]),
  crpMgL: z.number().min(0.1).max(400.0).nullable().optional(),
  drainOutputMl24h: z.number().min(0).max(1000.0).default(0),
  notes: z.string().nullable().optional(),
});

export function registerPediatricSepticArthritisRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/pediatric-septic-arthritis/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(pediatricSepticArthritisEpisodeSchema.partial(), req.body);

    const evalResult = evaluatePediatricSepticArthritis({
      ageMonths: data.ageMonths ?? 36,
      weightKg: data.weightKg ?? 15.0,
      affectedJoint: (data.affectedJoint as AffectedJointLocation) ?? 'right_hip',
      nonWeightBearing: data.nonWeightBearing ?? true,
      temperatureCelsius: data.temperatureCelsius ?? 38.8,
      esrMmHr: data.esrMmHr ?? 45,
      wbcCountPerMicroliter: data.wbcCountPerMicroliter ?? 14500,
      crpMgL: data.crpMgL ?? undefined,
      ultrasoundEffusionDetected: data.ultrasoundEffusionDetected ?? true,
      arthrocentesisPerformed: data.arthrocentesisPerformed ?? false,
      synovialWbcCount: data.synovialWbcCount ?? undefined,
      synovialPmnPct: data.synovialPmnPct ?? undefined,
      synovialGramStain: (data.synovialGramStain as SynovialGramStain) ?? 'pending',
      surgicalDrainageRequired: data.surgicalDrainageRequired ?? false,
      surgicalApproach: (data.surgicalApproach as SurgicalApproach) ?? 'none',
      empiricAntibioticRegimen: (data.empiricAntibioticRegimen as EmpiricAntibioticRegimen) ?? 'cefazolin_iv',
    });

    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/pediatric-septic-arthritis/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_septic_arthritis_episodes e
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

    query += ' ORDER BY e.evaluation_datetime DESC';
    const episodes = db.prepare(query).all(...params);

    return { episodes };
  });

  // 3. Create Episode
  app.post('/api/pediatric-septic-arthritis/episodes', async (req, reply) => {
    const user = assertCanManagePediatricSepticArthritis(req);
    const data = parse(pediatricSepticArthritisEpisodeSchema, req.body);

    const evalResult = evaluatePediatricSepticArthritis({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      affectedJoint: data.affectedJoint as AffectedJointLocation,
      nonWeightBearing: data.nonWeightBearing,
      temperatureCelsius: data.temperatureCelsius,
      esrMmHr: data.esrMmHr,
      wbcCountPerMicroliter: data.wbcCountPerMicroliter,
      crpMgL: data.crpMgL ?? undefined,
      ultrasoundEffusionDetected: data.ultrasoundEffusionDetected,
      arthrocentesisPerformed: data.arthrocentesisPerformed,
      synovialWbcCount: data.synovialWbcCount ?? undefined,
      synovialPmnPct: data.synovialPmnPct ?? undefined,
      synovialGramStain: data.synovialGramStain as SynovialGramStain,
      surgicalDrainageRequired: data.surgicalDrainageRequired,
      surgicalApproach: data.surgicalApproach as SurgicalApproach,
      empiricAntibioticRegimen: data.empiricAntibioticRegimen as EmpiricAntibioticRegimen,
    });

    const episodeCode = `SEPTICARTH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const res = db.prepare(`
      INSERT INTO pediatric_septic_arthritis_episodes (
        patient_id, admission_id, episode_code, evaluation_datetime,
        age_months, weight_kg, affected_joint,
        non_weight_bearing, temperature_celsius, fever_gt_38_5,
        esr_mm_hr, esr_ge_40, wbc_count_per_microliter, wbc_gt_12000,
        crp_mg_l, kocher_criteria_met_count, predicted_probability_percent,
        ultrasound_effusion_detected, arthrocentesis_performed,
        synovial_wbc_count, synovial_pmb_pct, synovial_gram_stain,
        surgical_drainage_required, surgical_approach, empiric_antibiotic_regimen,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.evaluationDatetime,
      data.ageMonths,
      data.weightKg,
      data.affectedJoint,
      data.nonWeightBearing ? 1 : 0,
      data.temperatureCelsius,
      evalResult.kocherResult.feverCriterionMet ? 1 : 0,
      data.esrMmHr,
      evalResult.kocherResult.esrCriterionMet ? 1 : 0,
      data.wbcCountPerMicroliter,
      evalResult.kocherResult.wbcCriterionMet ? 1 : 0,
      data.crpMgL ?? null,
      evalResult.kocherResult.criteriaMetCount,
      evalResult.kocherResult.predictedProbabilityPercent,
      data.ultrasoundEffusionDetected ? 1 : 0,
      data.arthrocentesisPerformed ? 1 : 0,
      data.synovialWbcCount ?? null,
      data.synovialPmnPct ?? null,
      data.synovialGramStain,
      data.surgicalDrainageRequired ? 1 : 0,
      data.surgicalApproach,
      data.empiricAntibioticRegimen,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_septic_arthritis.create',
      entity: 'pediatric_septic_arthritis_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, kocherScore: evalResult.kocherResult.criteriaMetCount, joint: data.affectedJoint },
    });

    const created = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_septic_arthritis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(episodeId);

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 4. Get Episode Detail with Flowsheet and Live Evaluation
  app.get('/api/pediatric-septic-arthritis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_septic_arthritis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric septic arthritis episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM pediatric_septic_arthritis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.septic_arthritis_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluatePediatricSepticArthritis({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      affectedJoint: episode.affected_joint as AffectedJointLocation,
      nonWeightBearing: Boolean(episode.non_weight_bearing),
      temperatureCelsius: episode.temperature_celsius,
      esrMmHr: episode.esr_mm_hr,
      wbcCountPerMicroliter: episode.wbc_count_per_microliter,
      crpMgL: episode.crp_mg_l ?? undefined,
      ultrasoundEffusionDetected: Boolean(episode.ultrasound_effusion_detected),
      arthrocentesisPerformed: Boolean(episode.arthrocentesis_performed),
      synovialWbcCount: episode.synovial_wbc_count ?? undefined,
      synovialPmnPct: episode.synovial_pmb_pct ?? undefined,
      synovialGramStain: episode.synovial_gram_stain as SynovialGramStain,
      surgicalDrainageRequired: Boolean(episode.surgical_drainage_required),
      surgicalApproach: episode.surgical_approach as SurgicalApproach,
      empiricAntibioticRegimen: episode.empiric_antibiotic_regimen as EmpiricAntibioticRegimen,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-septic-arthritis/episodes/:id', async (req) => {
    const user = assertCanManagePediatricSepticArthritis(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const existing = db.prepare('SELECT id FROM pediatric_septic_arthritis_episodes WHERE id = ?').get(episodeId);
    if (!existing) throw notFound('Pediatric septic arthritis episode not found');

    const data = parse(pediatricSepticArthritisEpisodeSchema.partial(), req.body);

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
    if (data.surgicalDrainageRequired !== undefined) {
      fields.push('surgical_drainage_required = ?');
      values.push(data.surgicalDrainageRequired ? 1 : 0);
    }
    if (data.surgicalApproach !== undefined) {
      fields.push('surgical_approach = ?');
      values.push(data.surgicalApproach);
    }
    if (data.empiricAntibioticRegimen !== undefined) {
      fields.push('empiric_antibiotic_regimen = ?');
      values.push(data.empiricAntibioticRegimen);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(episodeId);
      db.prepare(`UPDATE pediatric_septic_arthritis_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    audit(db, {
      actorId: user.id,
      action: 'pediatric_septic_arthritis.update',
      entity: 'pediatric_septic_arthritis_episodes',
      entityId: episodeId,
      detail: { updatedFields: fields },
    });

    const updated = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_septic_arthritis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(episodeId);

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-septic-arthritis/episodes/:id', async (req) => {
    const user = assertCanManagePediatricSepticArthritis(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM pediatric_septic_arthritis_episodes WHERE id = ?').get(episodeId) as any;
    if (!existing) throw notFound('Episode not found');

    db.prepare('DELETE FROM pediatric_septic_arthritis_episodes WHERE id = ?').run(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_septic_arthritis.delete',
      entity: 'pediatric_septic_arthritis_episodes',
      entityId: episodeId,
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-septic-arthritis/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricSepticArthritis(req);
    const { id } = req.params as { id: string };
    const episodeId = Number(id);

    const episode = db.prepare('SELECT id, patient_id FROM pediatric_septic_arthritis_episodes WHERE id = ?').get(episodeId) as any;
    if (!episode) throw notFound('Episode not found');

    const data = parse(pediatricSepticArthritisFlowsheetSchema, req.body);

    const res = db.prepare(`
      INSERT INTO pediatric_septic_arthritis_flowsheet_logs (
        septic_arthritis_episode_id, patient_id, log_datetime, hours_from_triage,
        temperature_celsius, heart_rate_bpm, joint_range_of_motion, weight_bearing_ability,
        crp_mg_l, drain_output_ml_24h, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      episodeId,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromTriage,
      data.temperatureCelsius,
      data.heartRateBpm,
      data.jointRangeOfMotion,
      data.weightBearingAbility,
      data.crpMgL ?? null,
      data.drainOutputMl24h,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_septic_arthritis.flowsheet_log',
      entity: 'pediatric_septic_arthritis_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, temp: data.temperatureCelsius, rom: data.jointRangeOfMotion, wb: data.weightBearingAbility },
    });

    reply.status(201);
    return { logId };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-septic-arthritis/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricSepticArthritis(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM pediatric_septic_arthritis_flowsheet_logs WHERE id = ? AND septic_arthritis_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_septic_arthritis_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_septic_arthritis.flowsheet_delete',
      entity: 'pediatric_septic_arthritis_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
