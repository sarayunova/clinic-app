import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricIntussusception,
  type LeadPointType,
  type ReductionMethod,
} from '../../web/src/pediatricIntussusceptionEngine.js';

function assertCanManageIntussusception(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only pediatric surgeons, pediatricians, and nurses can manage intussusception records');
  }
  return user;
}

export const pediatricIntussusceptionEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  presentationDatetime: z.string().min(1, 'Presentation datetime is required'),
  ageMonths: z.number().int().min(1).max(216),
  weightKg: z.number().min(2.0).max(120.0),
  symptomDurationHours: z.number().min(0.5).max(240.0),

  intermittentColickyPain: z.boolean().default(true),
  vomitingBilious: z.boolean().default(false),
  redCurrantJellyStool: z.boolean().default(false),
  palpableAbdominalMass: z.boolean().default(false),
  lethargyAlteredSensorium: z.boolean().default(false),

  ultrasoundTargetSignDetected: z.boolean().default(true),
  ultrasoundOuterDiameterMm: z.number().min(10.0).max(60.0).nullable().optional(),
  pseudokidneySignPresent: z.boolean().default(true),
  pathologicLeadPointSuspected: z.boolean().default(false),
  leadPointType: z.enum([
    'none_idiopathic',
    'meckels_diverticulum',
    'intestinal_duplication_cyst',
    'polyp',
    'lymphoma_malignancy',
  ]).default('none_idiopathic'),
  peritonitisSignsPresent: z.boolean().default(false),
  pneumoperitoneumOnXray: z.boolean().default(false),

  reductionAttempted: z.boolean().default(true),
  reductionMethod: z.enum([
    'pneumatic_air_enema',
    'hydrostatic_saline_enema',
    'none_primary_surgery',
  ]),
  maximumPressureMmhg: z.number().min(0).max(160.0).default(0),
  reductionAttemptsCount: z.number().int().min(0).max(5).default(1),
  reductionSuccessful: z.boolean().default(false),
  cecalIlealRefluxVisualized: z.boolean().default(false),
  surgicalExplorationRequired: z.boolean().default(false),
  surgicalFindings: z.string().nullable().optional(),

  status: z.enum([
    'evaluation_ultrasound',
    'reduction_in_progress',
    'reduction_successful_observation',
    'operating_room_exploration',
    'resolved_discharged',
  ]).default('evaluation_ultrasound'),
  clinicalNotes: z.string().nullable().optional(),
});

export const pediatricIntussusceptionFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromProcedure: z.number().int().min(0).default(0),
  heartRateBpm: z.number().int().min(40).max(220),
  bloodPressureSys: z.number().int().min(50).max(200),
  bloodPressureDia: z.number().int().min(30).max(140),
  abdominalSoftNonTender: z.boolean().default(true),
  colickyPainRecurrence: z.boolean().default(false),
  oralIntakeTolerated: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export function registerPediatricIntussusceptionRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/pediatric-intussusception/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(pediatricIntussusceptionEpisodeSchema.partial(), req.body);

    const evalResult = evaluatePediatricIntussusception({
      ageMonths: data.ageMonths ?? 9,
      weightKg: data.weightKg ?? 8.5,
      symptomDurationHours: data.symptomDurationHours ?? 12,
      intermittentColickyPain: data.intermittentColickyPain ?? true,
      vomitingBilious: data.vomitingBilious ?? false,
      redCurrantJellyStool: data.redCurrantJellyStool ?? false,
      palpableAbdominalMass: data.palpableAbdominalMass ?? true,
      lethargyAlteredSensorium: data.lethargyAlteredSensorium ?? false,
      ultrasoundTargetSignDetected: data.ultrasoundTargetSignDetected ?? true,
      ultrasoundOuterDiameterMm: data.ultrasoundOuterDiameterMm ?? 28.0,
      pseudokidneySignPresent: data.pseudokidneySignPresent ?? true,
      pathologicLeadPointSuspected: data.pathologicLeadPointSuspected ?? false,
      leadPointType: (data.leadPointType as LeadPointType) ?? 'none_idiopathic',
      peritonitisSignsPresent: data.peritonitisSignsPresent ?? false,
      pneumoperitoneumOnXray: data.pneumoperitoneumOnXray ?? false,
      reductionAttempted: data.reductionAttempted ?? true,
      reductionMethod: (data.reductionMethod as ReductionMethod) ?? 'pneumatic_air_enema',
      maximumPressureMmhg: data.maximumPressureMmhg ?? 90.0,
      reductionAttemptsCount: data.reductionAttemptsCount ?? 1,
      reductionSuccessful: data.reductionSuccessful ?? false,
      cecalIlealRefluxVisualized: data.cecalIlealRefluxVisualized ?? false,
      surgicalExplorationRequired: data.surgicalExplorationRequired ?? false,
      surgicalFindings: data.surgicalFindings ?? undefined,
    });

    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/pediatric-intussusception/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let sql = `
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM pediatric_intussusception_episodes e
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
  app.post('/api/pediatric-intussusception/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageIntussusception(req);
    const data = parse(pediatricIntussusceptionEpisodeSchema, req.body);

    const evalResult = evaluatePediatricIntussusception({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      symptomDurationHours: data.symptomDurationHours,
      intermittentColickyPain: data.intermittentColickyPain,
      vomitingBilious: data.vomitingBilious,
      redCurrantJellyStool: data.redCurrantJellyStool,
      palpableAbdominalMass: data.palpableAbdominalMass,
      lethargyAlteredSensorium: data.lethargyAlteredSensorium,
      ultrasoundTargetSignDetected: data.ultrasoundTargetSignDetected,
      ultrasoundOuterDiameterMm: data.ultrasoundOuterDiameterMm ?? undefined,
      pseudokidneySignPresent: data.pseudokidneySignPresent,
      pathologicLeadPointSuspected: data.pathologicLeadPointSuspected,
      leadPointType: data.leadPointType,
      peritonitisSignsPresent: data.peritonitisSignsPresent,
      pneumoperitoneumOnXray: data.pneumoperitoneumOnXray,
      reductionAttempted: data.reductionAttempted,
      reductionMethod: data.reductionMethod,
      maximumPressureMmhg: data.maximumPressureMmhg,
      reductionAttemptsCount: data.reductionAttemptsCount,
      reductionSuccessful: data.reductionSuccessful,
      cecalIlealRefluxVisualized: data.cecalIlealRefluxVisualized,
      surgicalExplorationRequired: data.surgicalExplorationRequired,
      surgicalFindings: data.surgicalFindings ?? undefined,
    });

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const episodeCode = `INTUSS-${timestamp}-${randomSuffix}`;

    const res = db.prepare(`
      INSERT INTO pediatric_intussusception_episodes (
        patient_id, admission_id, episode_code, presentation_datetime,
        age_months, weight_kg, symptom_duration_hours,
        intermittent_colicky_pain, vomiting_bilious, red_currant_jelly_stool,
        palpable_abdominal_mass, lethargy_altered_sensorium,
        ultrasound_target_sign_detected, ultrasound_outer_diameter_mm,
        pseudokidney_sign_present, pathologic_lead_point_suspected, lead_point_type,
        peritonitis_signs_present, pneumoperitoneum_on_xray,
        reduction_attempted, reduction_method, maximum_pressure_mmhg,
        reduction_attempts_count, reduction_successful, cecal_ileal_reflux_visualized,
        surgical_exploration_required, surgical_findings,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.presentationDatetime,
      data.ageMonths,
      data.weightKg,
      data.symptomDurationHours,
      data.intermittentColickyPain ? 1 : 0,
      data.vomitingBilious ? 1 : 0,
      data.redCurrantJellyStool ? 1 : 0,
      data.palpableAbdominalMass ? 1 : 0,
      data.lethargyAlteredSensorium ? 1 : 0,
      data.ultrasoundTargetSignDetected ? 1 : 0,
      data.ultrasoundOuterDiameterMm ?? null,
      data.pseudokidneySignPresent ? 1 : 0,
      data.pathologicLeadPointSuspected ? 1 : 0,
      data.leadPointType,
      data.peritonitisSignsPresent ? 1 : 0,
      data.pneumoperitoneumOnXray ? 1 : 0,
      data.reductionAttempted ? 1 : 0,
      data.reductionMethod,
      data.maximumPressureMmhg,
      data.reductionAttemptsCount,
      data.reductionSuccessful ? 1 : 0,
      data.cecalIlealRefluxVisualized ? 1 : 0,
      data.surgicalExplorationRequired ? 1 : 0,
      data.surgicalFindings ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_intussusception.create',
      entity: 'pediatric_intussusception_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, reductionMethod: data.reductionMethod, success: data.reductionSuccessful },
    });

    const episode = db.prepare('SELECT * FROM pediatric_intussusception_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 4. Retrieve Single Episode
  app.get('/api/pediatric-intussusception/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM pediatric_intussusception_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Pediatric intussusception episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_intussusception_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.intussusception_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(id);

    const evalResult = evaluatePediatricIntussusception({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      symptomDurationHours: episode.symptom_duration_hours,
      intermittentColickyPain: episode.intermittent_colicky_pain === 1,
      vomitingBilious: episode.vomiting_bilious === 1,
      redCurrantJellyStool: episode.red_currant_jelly_stool === 1,
      palpableAbdominalMass: episode.palpable_abdominal_mass === 1,
      lethargyAlteredSensorium: episode.lethargy_altered_sensorium === 1,
      ultrasoundTargetSignDetected: episode.ultrasound_target_sign_detected === 1,
      ultrasoundOuterDiameterMm: episode.ultrasound_outer_diameter_mm ?? undefined,
      pseudokidneySignPresent: episode.pseudokidney_sign_present === 1,
      pathologicLeadPointSuspected: episode.pathologic_lead_point_suspected === 1,
      leadPointType: episode.lead_point_type,
      peritonitisSignsPresent: episode.peritonitis_signs_present === 1,
      pneumoperitoneumOnXray: episode.pneumoperitoneum_on_xray === 1,
      reductionAttempted: episode.reduction_attempted === 1,
      reductionMethod: episode.reduction_method,
      maximumPressureMmhg: episode.maximum_pressure_mmhg,
      reductionAttemptsCount: episode.reduction_attempts_count,
      reductionSuccessful: episode.reduction_successful === 1,
      cecalIlealRefluxVisualized: episode.cecal_ileal_reflux_visualized === 1,
      surgicalExplorationRequired: episode.surgical_exploration_required === 1,
      surgicalFindings: episode.surgical_findings ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-intussusception/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageIntussusception(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM pediatric_intussusception_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric intussusception episode not found');

    const data = parse(pediatricIntussusceptionEpisodeSchema.partial(), req.body);

    db.prepare(`
      UPDATE pediatric_intussusception_episodes
      SET
        reduction_attempted = COALESCE(?, reduction_attempted),
        reduction_method = COALESCE(?, reduction_method),
        maximum_pressure_mmhg = COALESCE(?, maximum_pressure_mmhg),
        reduction_attempts_count = COALESCE(?, reduction_attempts_count),
        reduction_successful = COALESCE(?, reduction_successful),
        cecal_ileal_reflux_visualized = COALESCE(?, cecal_ileal_reflux_visualized),
        surgical_exploration_required = COALESCE(?, surgical_exploration_required),
        surgical_findings = COALESCE(?, surgical_findings),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.reductionAttempted !== undefined ? (data.reductionAttempted ? 1 : 0) : null,
      data.reductionMethod ?? null,
      data.maximumPressureMmhg ?? null,
      data.reductionAttemptsCount ?? null,
      data.reductionSuccessful !== undefined ? (data.reductionSuccessful ? 1 : 0) : null,
      data.cecalIlealRefluxVisualized !== undefined ? (data.cecalIlealRefluxVisualized ? 1 : 0) : null,
      data.surgicalExplorationRequired !== undefined ? (data.surgicalExplorationRequired ? 1 : 0) : null,
      data.surgicalFindings ?? null,
      data.status ?? null,
      data.clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_intussusception.update',
      entity: 'pediatric_intussusception_episodes',
      entityId: Number(id),
      detail: { updatedFields: Object.keys(data) },
    });

    const episode = db.prepare('SELECT * FROM pediatric_intussusception_episodes WHERE id = ?').get(id);
    return { episode };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-intussusception/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageIntussusception(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM pediatric_intussusception_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric intussusception episode not found');

    db.prepare('DELETE FROM pediatric_intussusception_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_intussusception.delete',
      entity: 'pediatric_intussusception_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-intussusception/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageIntussusception(req);
    const { id } = req.params as { id: string };

    const episode = db.prepare('SELECT * FROM pediatric_intussusception_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric intussusception episode not found');

    const data = parse(pediatricIntussusceptionFlowsheetSchema, req.body);

    const res = db.prepare(`
      INSERT INTO pediatric_intussusception_flowsheet_logs (
        intussusception_episode_id, patient_id, log_datetime, minutes_from_procedure,
        heart_rate_bpm, blood_pressure_sys, blood_pressure_dia,
        abdominal_soft_non_tender, colicky_pain_recurrence, oral_intake_tolerated,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromProcedure,
      data.heartRateBpm,
      data.bloodPressureSys,
      data.bloodPressureDia,
      data.abdominalSoftNonTender ? 1 : 0,
      data.colickyPainRecurrence ? 1 : 0,
      data.oralIntakeTolerated ? 1 : 0,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_intussusception.flowsheet_add',
      entity: 'pediatric_intussusception_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), painRecurrence: data.colickyPainRecurrence },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-intussusception/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageIntussusception(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM pediatric_intussusception_flowsheet_logs
      WHERE id = ? AND intussusception_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_intussusception_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_intussusception.flowsheet_delete',
      entity: 'pediatric_intussusception_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
