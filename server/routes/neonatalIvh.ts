import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateLeveneThresholds,
  evaluateNeonatalIvh,
  type PapileGrade,
  type HemorrhageLaterality,
  type PhhInterventionModality,
} from '../../web/src/neonatalIvhEngine.js';

function assertCanManageNeonatalIvh(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical pediatricians, neonatologists, and NICU nurses can manage neonatal IVH records');
  }
  return user;
}

export const neonatalIvhEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  scanDatetime: z.string().min(1, 'Scan datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6000),
  chronologicalAgeDays: z.number().int().min(0).max(365),
  currentPmaWeeks: z.number().min(22).max(52),
  currentWeightGrams: z.number().min(300).max(10000),

  cranialUltrasoundIndication: z.string().min(1, 'Indication is required'),
  papileGrade: z.enum([
    'grade_1_subependymal',
    'grade_2_intraventricular_normal_size',
    'grade_3_intraventricular_dilatation',
    'grade_4_periventricular_infarction',
  ]),
  hemorrhageLaterality: z.enum(['unilateral_left', 'unilateral_right', 'bilateral']),
  parenchymalInfarctionLocation: z.string().nullable().optional(),

  ventricularIndexLeftMm: z.number().min(1).max(40),
  ventricularIndexRightMm: z.number().min(1).max(40),
  anteriorHornWidthLeftMm: z.number().min(0).max(30),
  anteriorHornWidthRightMm: z.number().min(0).max(30),
  thalamoOccipitalDistanceMm: z.number().min(0).max(60).default(0),
  resistiveIndexAca: z.number().min(0.2).max(1.5).nullable().optional(),

  headCircumferenceCm: z.number().min(15).max(60),
  headCircumferenceGrowthCmWeek: z.number().min(0).max(10).default(0),
  fontanelleTension: z.enum(['normal_soft', 'full', 'bulging_tense']).default('normal_soft'),
  splitSutures: z.boolean().default(false),
  apneasOrBradycardiasPresent: z.boolean().default(false),

  interventionStatus: z.enum([
    'conservative_surveillance',
    'serial_lumbar_punctures',
    'ventricular_access_device_reservoir',
    'subgaleal_shunt',
    'permanent_vp_shunt',
  ]).default('conservative_surveillance'),
  lumbarPuncturePerformed: z.boolean().default(false),
  csfProteinGL: z.number().min(0).max(50).nullable().optional(),
  csfRbcCount: z.number().int().min(0).nullable().optional(),

  status: z.enum([
    'ultrasound_surveillance_active',
    'phh_active_decompression',
    'post_surgical_shunt_monitoring',
    'stable_arrested_hydrocephalus',
    'resolved_quiescent',
  ]).default('ultrasound_surveillance_active'),
  clinicalNotes: z.string().nullable().optional(),
});

export const neonatalIvhFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  daysFromBaseline: z.number().min(0).default(0),
  ventricularIndexMm: z.number().min(1).max(40),
  anteriorHornWidthMm: z.number().min(0).max(30),
  headCircumferenceCm: z.number().min(15).max(60),
  fontanelleTension: z.enum(['normal_soft', 'full', 'bulging_tense']),
  splitCranialSutures: z.boolean().default(false),
  apneicEpisodes24h: z.number().int().min(0).default(0),
  csfVolumeTappedMl: z.number().min(0).default(0),
  resistiveIndexAca: z.number().min(0.2).max(1.5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export function registerNeonatalIvhRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live IVH & Levene Evaluation Preview
  app.post('/api/neonatal-ivh/evaluate', async (req) => {
    assertCanManageNeonatalIvh(req);
    const body = req.body as Partial<z.infer<typeof neonatalIvhEpisodeSchema>>;

    const evalResult = evaluateNeonatalIvh({
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? 27,
      birthWeightGrams: body.birthWeightGrams ?? 900,
      chronologicalAgeDays: body.chronologicalAgeDays ?? 7,
      currentPmaWeeks: body.currentPmaWeeks ?? 28,
      currentWeightGrams: body.currentWeightGrams ?? 950,
      papileGrade: (body.papileGrade as PapileGrade) ?? 'grade_3_intraventricular_dilatation',
      hemorrhageLaterality: (body.hemorrhageLaterality as HemorrhageLaterality) ?? 'bilateral',
      parenchymalInfarctionLocation: body.parenchymalInfarctionLocation ?? undefined,
      ventricularIndexLeftMm: body.ventricularIndexLeftMm ?? 14.5,
      ventricularIndexRightMm: body.ventricularIndexRightMm ?? 16.2,
      anteriorHornWidthLeftMm: body.anteriorHornWidthLeftMm ?? 5.5,
      anteriorHornWidthRightMm: body.anteriorHornWidthRightMm ?? 6.8,
      thalamoOccipitalDistanceMm: body.thalamoOccipitalDistanceMm ?? 0,
      resistiveIndexAca: body.resistiveIndexAca ?? undefined,
      headCircumferenceCm: body.headCircumferenceCm ?? 24.5,
      headCircumferenceGrowthCmWeek: body.headCircumferenceGrowthCmWeek ?? 1.2,
      fontanelleTension: body.fontanelleTension,
      splitSutures: body.splitSutures,
      apneasOrBradycardiasPresent: body.apneasOrBradycardiasPresent,
      csfProteinGL: body.csfProteinGL ?? undefined,
      csfRbcCount: body.csfRbcCount ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create IVH Episode
  app.post('/api/neonatal-ivh/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalIvh(req);
    const data = parse(neonatalIvhEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateNeonatalIvh({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      chronologicalAgeDays: data.chronologicalAgeDays,
      currentPmaWeeks: data.currentPmaWeeks,
      currentWeightGrams: data.currentWeightGrams,
      papileGrade: data.papileGrade,
      hemorrhageLaterality: data.hemorrhageLaterality,
      parenchymalInfarctionLocation: data.parenchymalInfarctionLocation ?? undefined,
      ventricularIndexLeftMm: data.ventricularIndexLeftMm,
      ventricularIndexRightMm: data.ventricularIndexRightMm,
      anteriorHornWidthLeftMm: data.anteriorHornWidthLeftMm,
      anteriorHornWidthRightMm: data.anteriorHornWidthRightMm,
      thalamoOccipitalDistanceMm: data.thalamoOccipitalDistanceMm,
      resistiveIndexAca: data.resistiveIndexAca ?? undefined,
      headCircumferenceCm: data.headCircumferenceCm,
      headCircumferenceGrowthCmWeek: data.headCircumferenceGrowthCmWeek,
      fontanelleTension: data.fontanelleTension,
      splitSutures: data.splitSutures,
      apneasOrBradycardiasPresent: data.apneasOrBradycardiasPresent,
      csfProteinGL: data.csfProteinGL ?? undefined,
      csfRbcCount: data.csfRbcCount ?? undefined,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `IVH-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_ivh_episodes (
        patient_id, admission_id, episode_code, scan_datetime,
        gestational_age_weeks, birth_weight_grams, chronological_age_days, current_pma_weeks,
        cranial_ultrasound_indication, papile_grade, hemorrhage_laterality, parenchymal_infarction_location,
        ventricular_index_left_mm, ventricular_index_right_mm, anterior_horn_width_left_mm, anterior_horn_width_right_mm,
        thalamo_occipital_distance_mm, resistive_index_aca, head_circumference_cm, head_circumference_growth_cm_week,
        levene_97th_percentile_mm, levene_action_line_threshold_mm, phh_intervention_threshold_crossed,
        intervention_status, lumbar_puncture_performed, csf_protein_g_l, csf_rbc_count,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.scanDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.chronologicalAgeDays,
      data.currentPmaWeeks,
      data.cranialUltrasoundIndication,
      data.papileGrade,
      data.hemorrhageLaterality,
      data.parenchymalInfarctionLocation ?? null,
      data.ventricularIndexLeftMm,
      data.ventricularIndexRightMm,
      data.anteriorHornWidthLeftMm,
      data.anteriorHornWidthRightMm,
      data.thalamoOccipitalDistanceMm,
      data.resistiveIndexAca ?? null,
      data.headCircumferenceCm,
      data.headCircumferenceGrowthCmWeek,
      evalResult.levene97thPercentileMm,
      evalResult.leveneActionLineThresholdMm,
      evalResult.phhInterventionThresholdCrossed ? 1 : 0,
      data.interventionStatus,
      data.lumbarPuncturePerformed ? 1 : 0,
      data.csfProteinGL ?? null,
      data.csfRbcCount ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    audit(db, {
      actorId: user.id,
      action: 'neonatal_ivh.episode_create',
      entity: 'neonatal_ivh_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, papileGrade: data.papileGrade },
    });

    const created = db.prepare('SELECT * FROM neonatal_ivh_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List IVH Episodes
  app.get('/api/neonatal-ivh/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_ivh_episodes e
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

    query += ' ORDER BY e.scan_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/neonatal-ivh/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_ivh_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal IVH episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM neonatal_ivh_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.ivh_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateNeonatalIvh({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      chronologicalAgeDays: episode.chronological_age_days,
      currentPmaWeeks: episode.current_pma_weeks,
      currentWeightGrams: 1000,
      papileGrade: episode.papile_grade,
      hemorrhageLaterality: episode.hemorrhage_laterality,
      parenchymalInfarctionLocation: episode.parenchymal_infarction_location ?? undefined,
      ventricularIndexLeftMm: episode.ventricular_index_left_mm,
      ventricularIndexRightMm: episode.ventricular_index_right_mm,
      anteriorHornWidthLeftMm: episode.anterior_horn_width_left_mm,
      anteriorHornWidthRightMm: episode.anterior_horn_width_right_mm,
      thalamoOccipitalDistanceMm: episode.thalamo_occipital_distance_mm,
      resistiveIndexAca: episode.resistive_index_aca ?? undefined,
      headCircumferenceCm: episode.head_circumference_cm,
      headCircumferenceGrowthCmWeek: episode.head_circumference_growth_cm_week,
      csfProteinGL: episode.csf_protein_g_l ?? undefined,
      csfRbcCount: episode.csf_rbc_count ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update IVH Episode
  app.patch('/api/neonatal-ivh/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalIvh(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM neonatal_ivh_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal IVH episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextIntervention = body.interventionStatus ?? existing.intervention_status;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE neonatal_ivh_episodes
      SET status = ?, intervention_status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextIntervention, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ivh.episode_update',
      entity: 'neonatal_ivh_episodes',
      entityId: Number(id),
      detail: { nextStatus, nextIntervention },
    });

    const updated = db.prepare('SELECT * FROM neonatal_ivh_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete IVH Episode
  app.delete('/api/neonatal-ivh/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete neonatal IVH episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM neonatal_ivh_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal IVH episode not found');

    db.prepare('DELETE FROM neonatal_ivh_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ivh.episode_delete',
      entity: 'neonatal_ivh_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Observation Log
  app.post('/api/neonatal-ivh/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalIvh(req);
    const { id } = req.params as { id: string };
    const data = parse(neonatalIvhFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM neonatal_ivh_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal IVH episode not found');

    const stmt = db.prepare(`
      INSERT INTO neonatal_ivh_flowsheet_logs (
        ivh_episode_id, patient_id, log_datetime, days_from_baseline,
        ventricular_index_mm, anterior_horn_width_mm, head_circumference_cm,
        fontanelle_tension, split_cranial_sutures, apneic_episodes_24h,
        csf_volume_tapped_ml, resistive_index_aca, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.daysFromBaseline,
      data.ventricularIndexMm,
      data.anteriorHornWidthMm,
      data.headCircumferenceCm,
      data.fontanelleTension,
      data.splitCranialSutures ? 1 : 0,
      data.apneicEpisodes24h,
      data.csfVolumeTappedMl,
      data.resistiveIndexAca ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ivh.flowsheet_create',
      entity: 'neonatal_ivh_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), ventricularIndexMm: data.ventricularIndexMm },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-ivh/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalIvh(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM neonatal_ivh_flowsheet_logs WHERE id = ? AND ivh_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_ivh_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ivh.flowsheet_delete',
      entity: 'neonatal_ivh_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
