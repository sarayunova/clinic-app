import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricScfe,
} from '../../web/src/pediatricScfeEngine.js';

function assertCanManageScfe(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric SCFE protocols');
  }
  return user;
}

const scfeEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(5.0).max(21.0),
  weightKg: z.coerce.number().min(15.0).max(200.0),
  bmiPercentile: z.coerce.number().min(1.0).max(100.0),
  affectedHip: z.enum(['right', 'left', 'bilateral']),
  loderStability: z.enum(['stable_able_to_ambulate', 'unstable_cannot_bear_weight']),
  symptomDurationDays: z.coerce.number().int().min(0).max(720),
  southwickSlipAngleDegrees: z.coerce.number().min(0).max(90.0),
  kleinLineTrethowanAbnormal: z.boolean().default(true),
  referredKneeThighPain: z.boolean().default(true),
  endocrineDisorderSuspected: z.boolean().default(false),
  strictNonWeightBearingEnforced: z.boolean().default(true),
  surgicalProcedurePerformed: z.enum([
    'none_preoperative_traction',
    'in_situ_single_cannulated_screw',
    'two_screw_fixation',
    'open_modified_dunn_procedure',
    'contralateral_prophylactic_pinning_only',
  ]).default('in_situ_single_cannulated_screw'),
  contralateralHipProphylacticPinning: z.boolean().default(false),
  status: z.enum([
    'strict_bedrest_non_weight_bearing',
    'urgent_preop_radiographic_workup',
    'in_operating_room_percutaneous_pinning',
    'postop_crutch_training_healing',
    'resolved_growth_plate_fusion',
  ]).default('strict_bedrest_non_weight_bearing'),
  clinicalNotes: z.string().optional().nullable(),
});

const scfeFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  dayFromPresentation: z.coerce.number().int().min(1).max(180).default(1),
  painScoreVas: z.coerce.number().int().min(0).max(10),
  nonWeightBearingCompliance: z.enum([
    'strict_wheelchair_bedrest',
    'partial_crutches',
    'full_weight_bearing',
  ]),
  hipInternalRotationDegrees: z.coerce.number().min(-30).max(60),
  woundDressingClean: z.boolean().default(true),
  distalNeurovascularStatus: z.enum([
    'intact_pulses_sensation_normal',
    'paresthesias_delayed_cap_refill',
  ]),
  notes: z.string().optional().nullable(),
});

export function registerPediatricScfeRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/pediatric-scfe/evaluate', async (req) => {
    assertCanManageScfe(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricScfe({
      ageYears: Number(body.ageYears || 13),
      weightKg: Number(body.weightKg || 68),
      bmiPercentile: Number(body.bmiPercentile || 96),
      affectedHip: body.affectedHip || 'left',
      loderStability: body.loderStability || 'stable_able_to_ambulate',
      symptomDurationDays: Number(body.symptomDurationDays || 21),
      southwickSlipAngleDegrees: Number(body.southwickSlipAngleDegrees || 28),
      kleinLineTrethowanAbnormal: body.kleinLineTrethowanAbnormal !== undefined ? Boolean(body.kleinLineTrethowanAbnormal) : true,
      referredKneeThighPain: body.referredKneeThighPain !== undefined ? Boolean(body.referredKneeThighPain) : true,
      endocrineDisorderSuspected: Boolean(body.endocrineDisorderSuspected),
      strictNonWeightBearingEnforced: body.strictNonWeightBearingEnforced !== undefined ? Boolean(body.strictNonWeightBearingEnforced) : true,
      surgicalProcedurePerformed: body.surgicalProcedurePerformed || 'in_situ_single_cannulated_screw',
      contralateralHipProphylacticPinning: Boolean(body.contralateralHipProphylacticPinning),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-scfe/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_scfe_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` WHERE e.patient_id = ? `;
      params.push(Number(patientId));
    }

    query += ` ORDER BY e.id DESC`;

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/pediatric-scfe/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_scfe_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric SCFE episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_scfe_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.scfe_episode_id = ?
      ORDER BY l.day_from_presentation ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluatePediatricScfe({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      bmiPercentile: episode.bmi_percentile,
      affectedHip: episode.affected_hip,
      loderStability: episode.loder_stability,
      symptomDurationDays: episode.symptom_duration_days,
      southwickSlipAngleDegrees: episode.southwick_slip_angle_degrees,
      kleinLineTrethowanAbnormal: Boolean(episode.klein_line_trethowan_abnormal),
      referredKneeThighPain: Boolean(episode.referred_knee_thigh_pain),
      endocrineDisorderSuspected: Boolean(episode.endocrine_disorder_suspected),
      strictNonWeightBearingEnforced: Boolean(episode.strict_non_weight_bearing_enforced),
      surgicalProcedurePerformed: episode.surgical_procedure_performed,
      contralateralHipProphylacticPinning: Boolean(episode.contralateral_hip_prophylactic_pinning),
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-scfe/episodes', async (req) => {
    const user = assertCanManageScfe(req);
    const data = parse(scfeEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM pediatric_scfe_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `SCFE-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_scfe_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_years, weight_kg,
        bmi_percentile, affected_hip, loder_stability, symptom_duration_days,
        southwick_slip_angle_degrees, klein_line_trethowan_abnormal, referred_knee_thigh_pain,
        endocrine_disorder_suspected, strict_non_weight_bearing_enforced,
        surgical_procedure_performed, contralateral_hip_prophylactic_pinning,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.bmiPercentile,
      data.affectedHip,
      data.loderStability,
      data.symptomDurationDays,
      data.southwickSlipAngleDegrees,
      data.kleinLineTrethowanAbnormal ? 1 : 0,
      data.referredKneeThighPain ? 1 : 0,
      data.endocrineDisorderSuspected ? 1 : 0,
      data.strictNonWeightBearingEnforced ? 1 : 0,
      data.surgicalProcedurePerformed,
      data.contralateralHipProphylacticPinning ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_scfe.create',
      entity: 'pediatric_scfe_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM pediatric_scfe_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/pediatric-scfe/episodes/:id', async (req) => {
    const user = assertCanManageScfe(req);
    const { id } = req.params as { id: string };
    const data = parse(scfeEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_scfe_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Pediatric SCFE episode not found');

    db.prepare(`
      UPDATE pediatric_scfe_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, age_years = ?, weight_kg = ?,
        bmi_percentile = ?, affected_hip = ?, loder_stability = ?, symptom_duration_days = ?,
        southwick_slip_angle_degrees = ?, klein_line_trethowan_abnormal = ?, referred_knee_thigh_pain = ?,
        endocrine_disorder_suspected = ?, strict_non_weight_bearing_enforced = ?,
        surgical_procedure_performed = ?, contralateral_hip_prophylactic_pinning = ?,
        status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.bmiPercentile,
      data.affectedHip,
      data.loderStability,
      data.symptomDurationDays,
      data.southwickSlipAngleDegrees,
      data.kleinLineTrethowanAbnormal ? 1 : 0,
      data.referredKneeThighPain ? 1 : 0,
      data.endocrineDisorderSuspected ? 1 : 0,
      data.strictNonWeightBearingEnforced ? 1 : 0,
      data.surgicalProcedurePerformed,
      data.contralateralHipProphylacticPinning ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_scfe.update',
      entity: 'pediatric_scfe_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    const episode = db.prepare(`SELECT * FROM pediatric_scfe_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Update Status
  app.patch('/api/pediatric-scfe/episodes/:id/status', async (req) => {
    const user = assertCanManageScfe(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM pediatric_scfe_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Pediatric SCFE episode not found');

    db.prepare(`
      UPDATE pediatric_scfe_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_scfe.status_update',
      entity: 'pediatric_scfe_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/pediatric-scfe/episodes/:id', async (req) => {
    const user = assertCanManageScfe(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM pediatric_scfe_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Pediatric SCFE episode not found');

    db.prepare(`DELETE FROM pediatric_scfe_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_scfe.delete',
      entity: 'pediatric_scfe_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/pediatric-scfe/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageScfe(req);
    const { id } = req.params as { id: string };
    const data = parse(scfeFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM pediatric_scfe_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric SCFE episode not found');

    const result = db.prepare(`
      INSERT INTO pediatric_scfe_flowsheet_logs (
        scfe_episode_id, patient_id, log_datetime, day_from_presentation,
        pain_score_vas, non_weight_bearing_compliance, hip_internal_rotation_degrees,
        wound_dressing_clean, distal_neurovascular_status, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.dayFromPresentation,
      data.painScoreVas,
      data.nonWeightBearingCompliance,
      data.hipInternalRotationDegrees,
      data.woundDressingClean ? 1 : 0,
      data.distalNeurovascularStatus,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_scfe.flowsheet_add',
      entity: 'pediatric_scfe_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, pain: data.painScoreVas },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM pediatric_scfe_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/pediatric-scfe/flowsheet/:id', async (req) => {
    const user = assertCanManageScfe(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM pediatric_scfe_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM pediatric_scfe_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_scfe.flowsheet_delete',
      entity: 'pediatric_scfe_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.scfe_episode_id },
    });

    return { ok: true };
  });
}
