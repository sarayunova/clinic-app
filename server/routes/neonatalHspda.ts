import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  classifyMcnamaraEchoStage,
  classifyMcnamaraClinicalStage,
  evaluateNeonatalHspda,
  type ShuntDirection,
  type AortaDiastolicFlow,
} from '../../web/src/neonatalHspdaEngine.js';

function assertCanManageNeonatalHspda(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical pediatricians, neonatologists, and NICU nurses can manage hsPDA records');
  }
  return user;
}

export const neonatalHspdaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  echoDatetime: z.string().min(1, 'Echocardiogram datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6000),
  chronologicalAgeDays: z.number().int().min(0).max(365),
  currentWeightGrams: z.number().min(300).max(10000),

  // Echo parameters
  ductalDiameterMm: z.number().min(0.1).max(10.0),
  ductalVelocityVmaxMs: z.number().min(0).max(6.0).default(0),
  shuntDirection: z.enum(['left_to_right', 'bidirectional', 'right_to_left']),
  laAoRatio: z.number().min(0.5).max(4.0),
  lpaDiastolicVelocityMs: z.number().min(0).max(2.0).default(0),
  descendingAortaDiastolicFlow: z.enum(['antegrade_normal', 'absent_diastolic', 'retrograde_steal']),

  // Clinical & hemodynamic markers
  cardiomegalyPresent: z.boolean().default(false),
  pulmonaryEdemaPresent: z.boolean().default(false),
  boundingPulses: z.boolean().default(false),
  hypotensionWidePulsePressure: z.boolean().default(false),
  metabolicAcidosis: z.boolean().default(false),
  oliguriaPresent: z.boolean().default(false),
  respiratorySupportEscalation: z.boolean().default(false),

  // Pharmacotherapy & interventions
  pharmacotherapySelected: z.enum([
    'none_conservative',
    'iv_ibuprofen',
    'iv_indomethacin',
    'iv_paracetamol',
    'contraindicated',
  ]).default('none_conservative'),
  paracetamolRationale: z.string().nullable().optional(),
  contraindicationsPresent: z.boolean().default(false),
  interventionalReferral: z.enum(['none', 'catheter_closure', 'surgical_ligation']).default('none'),

  status: z.enum([
    'echocardiographic_surveillance',
    'medical_therapy_active',
    'post_therapy_echo_reassessment',
    'interventional_referral',
    'resolved_closed',
  ]).default('echocardiographic_surveillance'),
  clinicalNotes: z.string().nullable().optional(),
});

export const neonatalHspdaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromInitiation: z.number().min(0).default(0),
  heartRateBpm: z.number().int().min(40).max(250),
  sbpMmhg: z.number().int().min(20).max(150),
  dbpMmhg: z.number().int().min(10).max(100),
  mapMmhg: z.number().int().min(15).max(120),
  pulsePressureMmhg: z.number().int().min(5).max(100),
  respiratorySupportType: z.string().min(1, 'Support type is required'),
  fio2Percent: z.number().min(21).max(100).default(21),
  spo2Percent: z.number().min(50).max(100),
  urineOutputMlKgHr: z.number().min(0).max(20).nullable().optional(),
  serumCreatinineMgDl: z.number().min(0.1).max(15).nullable().optional(),
  plateletCount: z.number().int().min(1000).max(1500000).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export function registerNeonatalHspdaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live hsPDA Evaluation Preview Endpoint
  app.post('/api/neonatal-hspda/evaluate', async (req) => {
    assertCanManageNeonatalHspda(req);
    const body = req.body as Partial<z.infer<typeof neonatalHspdaEpisodeSchema>>;

    const evalResult = evaluateNeonatalHspda({
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? 28,
      birthWeightGrams: body.birthWeightGrams ?? 1000,
      chronologicalAgeDays: body.chronologicalAgeDays ?? 5,
      currentWeightGrams: body.currentWeightGrams ?? 1050,
      ductalDiameterMm: body.ductalDiameterMm ?? 2.2,
      ductalVelocityVmaxMs: body.ductalVelocityVmaxMs ?? 1.5,
      shuntDirection: (body.shuntDirection as ShuntDirection) ?? 'left_to_right',
      laAoRatio: body.laAoRatio ?? 1.6,
      lpaDiastolicVelocityMs: body.lpaDiastolicVelocityMs ?? 0.25,
      descendingAortaDiastolicFlow: (body.descendingAortaDiastolicFlow as AortaDiastolicFlow) ?? 'retrograde_steal',
      cardiomegalyPresent: body.cardiomegalyPresent,
      pulmonaryEdemaPresent: body.pulmonaryEdemaPresent,
      boundingPulses: body.boundingPulses,
      hypotensionWidePulsePressure: body.hypotensionWidePulsePressure,
      metabolicAcidosis: body.metabolicAcidosis,
      oliguriaPresent: body.oliguriaPresent,
      respiratorySupportEscalation: body.respiratorySupportEscalation,
    });

    return { evalResult };
  });

  // 2. Create hsPDA Episode
  app.post('/api/neonatal-hspda/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalHspda(req);
    const data = parse(neonatalHspdaEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateNeonatalHspda({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      chronologicalAgeDays: data.chronologicalAgeDays,
      currentWeightGrams: data.currentWeightGrams,
      ductalDiameterMm: data.ductalDiameterMm,
      ductalVelocityVmaxMs: data.ductalVelocityVmaxMs,
      shuntDirection: data.shuntDirection,
      laAoRatio: data.laAoRatio,
      lpaDiastolicVelocityMs: data.lpaDiastolicVelocityMs,
      descendingAortaDiastolicFlow: data.descendingAortaDiastolicFlow,
      cardiomegalyPresent: data.cardiomegalyPresent,
      pulmonaryEdemaPresent: data.pulmonaryEdemaPresent,
      boundingPulses: data.boundingPulses,
      hypotensionWidePulsePressure: data.hypotensionWidePulsePressure,
      metabolicAcidosis: data.metabolicAcidosis,
      oliguriaPresent: data.oliguriaPresent,
      respiratorySupportEscalation: data.respiratorySupportEscalation,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `PDA-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_hspda_episodes (
        patient_id, admission_id, episode_code, echo_datetime,
        gestational_age_weeks, birth_weight_grams, chronological_age_days, current_weight_grams,
        ductal_diameter_mm, ductal_velocity_vmax_ms, shunt_direction,
        la_ao_ratio, lpa_diastolic_velocity_ms, descending_aorta_diastolic_flow,
        cardiomegaly_present, pulmonary_edema_present, bounding_pulses,
        hypotension_wide_pulse_pressure, metabolic_acidosis, oliguria_present,
        respiratory_support_escalation, mcnamara_echo_stage, mcnamara_clinical_stage,
        hspda_confirmed, pharmacotherapy_selected, paracetamol_rationale,
        contraindications_present, interventional_referral, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.echoDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.chronologicalAgeDays,
      data.currentWeightGrams,
      data.ductalDiameterMm,
      data.ductalVelocityVmaxMs,
      data.shuntDirection,
      data.laAoRatio,
      data.lpaDiastolicVelocityMs,
      data.descendingAortaDiastolicFlow,
      data.cardiomegalyPresent ? 1 : 0,
      data.pulmonaryEdemaPresent ? 1 : 0,
      data.boundingPulses ? 1 : 0,
      data.hypotensionWidePulsePressure ? 1 : 0,
      data.metabolicAcidosis ? 1 : 0,
      data.oliguriaPresent ? 1 : 0,
      data.respiratorySupportEscalation ? 1 : 0,
      evalResult.mcnamaraEchoStage,
      evalResult.mcnamaraClinicalStage,
      evalResult.hspdaConfirmed ? 1 : 0,
      data.pharmacotherapySelected,
      data.paracetamolRationale ?? null,
      data.contraindicationsPresent ? 1 : 0,
      data.interventionalReferral,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM neonatal_hspda_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hspda.episode_create',
      entity: 'neonatal_hspda_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        mcnamaraEchoStage: evalResult.mcnamaraEchoStage,
        hspdaConfirmed: evalResult.hspdaConfirmed,
      },
    });

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List hsPDA Episodes
  app.get('/api/neonatal-hspda/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_hspda_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
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

    query += ' ORDER BY e.echo_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/neonatal-hspda/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_hspda_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal hsPDA episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM neonatal_hspda_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.hspda_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateNeonatalHspda({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      chronologicalAgeDays: episode.chronological_age_days,
      currentWeightGrams: episode.current_weight_grams,
      ductalDiameterMm: episode.ductal_diameter_mm,
      ductalVelocityVmaxMs: episode.ductal_velocity_vmax_ms,
      shuntDirection: episode.shunt_direction,
      laAoRatio: episode.la_ao_ratio,
      lpaDiastolicVelocityMs: episode.lpa_diastolic_velocity_ms,
      descendingAortaDiastolicFlow: episode.descending_aorta_diastolic_flow,
      cardiomegalyPresent: Boolean(episode.cardiomegaly_present),
      pulmonaryEdemaPresent: Boolean(episode.pulmonary_edema_present),
      boundingPulses: Boolean(episode.bounding_pulses),
      hypotensionWidePulsePressure: Boolean(episode.hypotension_wide_pulse_pressure),
      metabolicAcidosis: Boolean(episode.metabolic_acidosis),
      oliguriaPresent: Boolean(episode.oliguria_present),
      respiratorySupportEscalation: Boolean(episode.respiratory_support_escalation),
    });

    return { episode, logs, evalResult };
  });

  // 5. Update hsPDA Episode
  app.patch('/api/neonatal-hspda/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalHspda(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM neonatal_hspda_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal hsPDA episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextIntervention = body.interventionalReferral ?? existing.interventional_referral;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;
    const nextTherapy = body.pharmacotherapySelected ?? existing.pharmacotherapy_selected;

    db.prepare(`
      UPDATE neonatal_hspda_episodes
      SET status = ?, interventional_referral = ?, pharmacotherapy_selected = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextIntervention, nextTherapy, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hspda.episode_update',
      entity: 'neonatal_hspda_episodes',
      entityId: Number(id),
      detail: { nextStatus, nextIntervention, nextTherapy },
    });

    const updated = db.prepare('SELECT * FROM neonatal_hspda_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete hsPDA Episode
  app.delete('/api/neonatal-hspda/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete hsPDA episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM neonatal_hspda_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal hsPDA episode not found');

    db.prepare('DELETE FROM neonatal_hspda_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hspda.episode_delete',
      entity: 'neonatal_hspda_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Observation Log
  app.post('/api/neonatal-hspda/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalHspda(req);
    const { id } = req.params as { id: string };
    const data = parse(neonatalHspdaFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM neonatal_hspda_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal hsPDA episode not found');

    const stmt = db.prepare(`
      INSERT INTO neonatal_hspda_flowsheet_logs (
        hspda_episode_id, patient_id, log_datetime, hours_from_initiation,
        heart_rate_bpm, sbp_mmhg, dbp_mmhg, map_mmhg, pulse_pressure_mmhg,
        respiratory_support_type, fio2_percent, spo2_percent,
        urine_output_ml_kg_hr, serum_creatinine_mg_dl, platelet_count,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromInitiation,
      data.heartRateBpm,
      data.sbpMmhg,
      data.dbpMmhg,
      data.mapMmhg,
      data.pulsePressureMmhg,
      data.respiratorySupportType,
      data.fio2Percent,
      data.spo2Percent,
      data.urineOutputMlKgHr ?? null,
      data.serumCreatinineMgDl ?? null,
      data.plateletCount ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hspda.flowsheet_create',
      entity: 'neonatal_hspda_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), pulsePressureMmhg: data.pulsePressureMmhg },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-hspda/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalHspda(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM neonatal_hspda_flowsheet_logs WHERE id = ? AND hspda_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_hspda_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hspda.flowsheet_delete',
      entity: 'neonatal_hspda_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
