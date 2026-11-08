import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricCordProlapse,
  type MembraneStatus,
  type FetalPresentation,
  type ProlapseType,
  type FhrDecelerationType,
  type MaternalPositioning,
  type TocolysisAgent,
  type DeliveryMode,
} from '../../web/src/obstetricCordProlapseEngine.js';

function assertCanManageCordProlapse(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only obstetricians and labor ward nurses can manage umbilical cord prolapse records');
  }
  return user;
}

export const obstetricCordProlapseEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  detectionDatetime: z.string().min(1, 'Detection datetime is required'),
  maternalAge: z.number().int().min(14).max(55).nullable().optional(),
  gestationalAgeWeeks: z.number().min(20).max(44),
  cervicalDilationCm: z.number().min(0.0).max(10.0),
  membraneStatus: z.enum([
    'ruptured_artificial',
    'ruptured_spontaneous',
    'intact_funicular_presentation',
  ]),
  fetalPresentation: z.enum([
    'cephalic_vertex',
    'breech_frank',
    'breech_complete_footling',
    'transverse_shoulder',
    'compound',
  ]),
  prolapseType: z.enum([
    'overt_cord_visible_or_in_vagina',
    'occult_cord_adjacent_to_head',
  ]),
  cordPulsationPresent: z.boolean().default(true),
  baselineFhrBpm: z.number().int().min(40).max(220),
  fhrDecelerationType: z.enum([
    'prolonged_bradycardia',
    'severe_variable_decelerations',
    'normal_fhr_reassuring',
  ]),

  manualElevationPerformed: z.boolean().default(true),
  maternalPositioning: z.enum([
    'knee_chest_genupectoral',
    'exaggerated_trendelenburg',
    'left_lateral_with_pillow',
    'supine_unfavorable',
  ]).default('knee_chest_genupectoral'),
  bladderFillingPerformed: z.boolean().default(false),
  bladderSalineVolumeMl: z.number().int().min(0).max(1000).default(0),
  tocolysisAdministered: z.boolean().default(false),
  tocolysisAgent: z.enum([
    'none',
    'terbutaline_sc',
    'salbutamol_iv',
    'nitroglycerin_sublingual',
  ]).default('none'),
  cordManipulationAvoided: z.boolean().default(true),
  cordWrappedWarmSaline: z.boolean().default(true),

  deliveryMode: z.enum([
    'category_1_emergency_cesarean',
    'assisted_operative_vaginal_vacuum',
    'assisted_operative_vaginal_forceps',
    'spontaneous_vaginal_imminent',
  ]).default('category_1_emergency_cesarean'),
  decisionToDeliveryMinutes: z.number().int().min(1).max(120).nullable().optional(),
  apgar1min: z.number().int().min(0).max(10).nullable().optional(),
  apgar5min: z.number().int().min(0).max(10).nullable().optional(),
  umbilicalArterialPh: z.number().min(6.5).max(7.6).nullable().optional(),

  status: z.enum([
    'emergent_decompression_active',
    'operating_room_in_transit',
    'delivered_neonatal_resuscitation',
    'postpartum_surveillance_stable',
  ]).default('emergent_decompression_active'),
  clinicalNotes: z.string().nullable().optional(),
});

export const obstetricCordProlapseFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromDetection: z.number().int().min(0).default(0),
  fetalHeartRateBpm: z.number().int().min(40).max(220),
  cordPulsationPalpable: z.boolean().default(true),
  manualElevationMaintained: z.boolean().default(true),
  maternalBloodPressureSys: z.number().int().min(50).max(250),
  maternalBloodPressureDia: z.number().int().min(30).max(160),
  notes: z.string().nullable().optional(),
});

export function registerObstetricCordProlapseRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/obstetric-cord-prolapse/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(obstetricCordProlapseEpisodeSchema.partial(), req.body);

    const evalResult = evaluateObstetricCordProlapse({
      maternalAge: data.maternalAge ?? 28,
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? 39,
      cervicalDilationCm: data.cervicalDilationCm ?? 4.0,
      membraneStatus: (data.membraneStatus as MembraneStatus) ?? 'ruptured_spontaneous',
      fetalPresentation: (data.fetalPresentation as FetalPresentation) ?? 'cephalic_vertex',
      prolapseType: (data.prolapseType as ProlapseType) ?? 'overt_cord_visible_or_in_vagina',
      cordPulsationPresent: data.cordPulsationPresent ?? true,
      baselineFhrBpm: data.baselineFhrBpm ?? 80,
      fhrDecelerationType: (data.fhrDecelerationType as FhrDecelerationType) ?? 'prolonged_bradycardia',
      manualElevationPerformed: data.manualElevationPerformed ?? true,
      maternalPositioning: (data.maternalPositioning as MaternalPositioning) ?? 'knee_chest_genupectoral',
      bladderFillingPerformed: data.bladderFillingPerformed ?? false,
      bladderSalineVolumeMl: data.bladderSalineVolumeMl ?? 0,
      tocolysisAdministered: data.tocolysisAdministered ?? false,
      tocolysisAgent: (data.tocolysisAgent as TocolysisAgent) ?? 'none',
      cordManipulationAvoided: data.cordManipulationAvoided ?? true,
      cordWrappedWarmSaline: data.cordWrappedWarmSaline ?? true,
      deliveryMode: (data.deliveryMode as DeliveryMode) ?? 'category_1_emergency_cesarean',
      decisionToDeliveryMinutes: data.decisionToDeliveryMinutes ?? undefined,
      apgar1min: data.apgar1min ?? undefined,
      apgar5min: data.apgar5min ?? undefined,
      umbilicalArterialPh: data.umbilicalArterialPh ?? undefined,
    });

    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/obstetric-cord-prolapse/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let sql = `
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM obstetric_cord_prolapse_episodes e
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
  app.post('/api/obstetric-cord-prolapse/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageCordProlapse(req);
    const data = parse(obstetricCordProlapseEpisodeSchema, req.body);

    const evalResult = evaluateObstetricCordProlapse({
      maternalAge: data.maternalAge ?? undefined,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      cervicalDilationCm: data.cervicalDilationCm,
      membraneStatus: data.membraneStatus,
      fetalPresentation: data.fetalPresentation,
      prolapseType: data.prolapseType,
      cordPulsationPresent: data.cordPulsationPresent,
      baselineFhrBpm: data.baselineFhrBpm,
      fhrDecelerationType: data.fhrDecelerationType,
      manualElevationPerformed: data.manualElevationPerformed,
      maternalPositioning: data.maternalPositioning,
      bladderFillingPerformed: data.bladderFillingPerformed,
      bladderSalineVolumeMl: data.bladderSalineVolumeMl,
      tocolysisAdministered: data.tocolysisAdministered,
      tocolysisAgent: data.tocolysisAgent,
      cordManipulationAvoided: data.cordManipulationAvoided,
      cordWrappedWarmSaline: data.cordWrappedWarmSaline,
      deliveryMode: data.deliveryMode,
      decisionToDeliveryMinutes: data.decisionToDeliveryMinutes ?? undefined,
      apgar1min: data.apgar1min ?? undefined,
      apgar5min: data.apgar5min ?? undefined,
      umbilicalArterialPh: data.umbilicalArterialPh ?? undefined,
    });

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const episodeCode = `PROLAPSE-${timestamp}-${randomSuffix}`;

    const res = db.prepare(`
      INSERT INTO obstetric_cord_prolapse_episodes (
        patient_id, admission_id, episode_code, detection_datetime,
        maternal_age, gestational_age_weeks, cervical_dilation_cm,
        membrane_status, fetal_presentation, prolapse_type, cord_pulsation_present,
        baseline_fhr_bpm, fhr_deceleration_type,
        manual_elevation_performed, maternal_positioning,
        bladder_filling_performed, bladder_saline_volume_ml,
        tocolysis_administered, tocolysis_agent,
        cord_manipulation_avoided, cord_wrapped_warm_saline,
        delivery_mode, decision_to_delivery_minutes,
        apgar_1min, apgar_5min, umbilical_arterial_ph,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.detectionDatetime,
      data.maternalAge ?? null,
      data.gestationalAgeWeeks,
      data.cervicalDilationCm,
      data.membraneStatus,
      data.fetalPresentation,
      data.prolapseType,
      data.cordPulsationPresent ? 1 : 0,
      data.baselineFhrBpm,
      data.fhrDecelerationType,
      data.manualElevationPerformed ? 1 : 0,
      data.maternalPositioning,
      data.bladderFillingPerformed ? 1 : 0,
      data.bladderSalineVolumeMl,
      data.tocolysisAdministered ? 1 : 0,
      data.tocolysisAgent,
      data.cordManipulationAvoided ? 1 : 0,
      data.cordWrappedWarmSaline ? 1 : 0,
      data.deliveryMode,
      data.decisionToDeliveryMinutes ?? null,
      data.apgar1min ?? null,
      data.apgar5min ?? null,
      data.umbilicalArterialPh ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cord_prolapse.create',
      entity: 'obstetric_cord_prolapse_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, fhr: data.baselineFhrBpm, deliveryMode: data.deliveryMode },
    });

    const episode = db.prepare('SELECT * FROM obstetric_cord_prolapse_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 4. Retrieve Single Episode
  app.get('/api/obstetric-cord-prolapse/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM obstetric_cord_prolapse_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Obstetric cord prolapse episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_cord_prolapse_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.cord_prolapse_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(id);

    const evalResult = evaluateObstetricCordProlapse({
      maternalAge: episode.maternal_age ?? undefined,
      gestationalAgeWeeks: episode.gestational_age_weeks,
      cervicalDilationCm: episode.cervical_dilation_cm,
      membraneStatus: episode.membrane_status,
      fetalPresentation: episode.fetal_presentation,
      prolapseType: episode.prolapse_type,
      cordPulsationPresent: episode.cord_pulsation_present === 1,
      baselineFhrBpm: episode.baseline_fhr_bpm,
      fhrDecelerationType: episode.fhr_deceleration_type,
      manualElevationPerformed: episode.manual_elevation_performed === 1,
      maternalPositioning: episode.maternal_positioning,
      bladderFillingPerformed: episode.bladder_filling_performed === 1,
      bladderSalineVolumeMl: episode.bladder_saline_volume_ml,
      tocolysisAdministered: episode.tocolysis_administered === 1,
      tocolysisAgent: episode.tocolysis_agent,
      cordManipulationAvoided: episode.cord_manipulation_avoided === 1,
      cordWrappedWarmSaline: episode.cord_wrapped_warm_saline === 1,
      deliveryMode: episode.delivery_mode,
      decisionToDeliveryMinutes: episode.decision_to_delivery_minutes ?? undefined,
      apgar1min: episode.apgar_1min ?? undefined,
      apgar5min: episode.apgar_5min ?? undefined,
      umbilicalArterialPh: episode.umbilical_arterial_ph ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-cord-prolapse/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageCordProlapse(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM obstetric_cord_prolapse_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric cord prolapse episode not found');

    const data = parse(obstetricCordProlapseEpisodeSchema.partial(), req.body);

    db.prepare(`
      UPDATE obstetric_cord_prolapse_episodes
      SET
        manual_elevation_performed = COALESCE(?, manual_elevation_performed),
        maternal_positioning = COALESCE(?, maternal_positioning),
        bladder_filling_performed = COALESCE(?, bladder_filling_performed),
        bladder_saline_volume_ml = COALESCE(?, bladder_saline_volume_ml),
        tocolysis_administered = COALESCE(?, tocolysis_administered),
        tocolysis_agent = COALESCE(?, tocolysis_agent),
        decision_to_delivery_minutes = COALESCE(?, decision_to_delivery_minutes),
        apgar_1min = COALESCE(?, apgar_1min),
        apgar_5min = COALESCE(?, apgar_5min),
        umbilical_arterial_ph = COALESCE(?, umbilical_arterial_ph),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.manualElevationPerformed !== undefined ? (data.manualElevationPerformed ? 1 : 0) : null,
      data.maternalPositioning ?? null,
      data.bladderFillingPerformed !== undefined ? (data.bladderFillingPerformed ? 1 : 0) : null,
      data.bladderSalineVolumeMl ?? null,
      data.tocolysisAdministered !== undefined ? (data.tocolysisAdministered ? 1 : 0) : null,
      data.tocolysisAgent ?? null,
      data.decisionToDeliveryMinutes ?? null,
      data.apgar1min ?? null,
      data.apgar5min ?? null,
      data.umbilicalArterialPh ?? null,
      data.status ?? null,
      data.clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cord_prolapse.update',
      entity: 'obstetric_cord_prolapse_episodes',
      entityId: Number(id),
      detail: { updatedFields: Object.keys(data) },
    });

    const episode = db.prepare('SELECT * FROM obstetric_cord_prolapse_episodes WHERE id = ?').get(id);
    return { episode };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-cord-prolapse/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageCordProlapse(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM obstetric_cord_prolapse_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric cord prolapse episode not found');

    db.prepare('DELETE FROM obstetric_cord_prolapse_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cord_prolapse.delete',
      entity: 'obstetric_cord_prolapse_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-cord-prolapse/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageCordProlapse(req);
    const { id } = req.params as { id: string };

    const episode = db.prepare('SELECT * FROM obstetric_cord_prolapse_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric cord prolapse episode not found');

    const data = parse(obstetricCordProlapseFlowsheetSchema, req.body);

    const res = db.prepare(`
      INSERT INTO obstetric_cord_prolapse_flowsheet_logs (
        cord_prolapse_episode_id, patient_id, log_datetime, minutes_from_detection,
        fetal_heart_rate_bpm, cord_pulsation_palpable, manual_elevation_maintained,
        maternal_blood_pressure_sys, maternal_blood_pressure_dia,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.minutesFromDetection,
      data.fetalHeartRateBpm,
      data.cordPulsationPalpable ? 1 : 0,
      data.manualElevationMaintained ? 1 : 0,
      data.maternalBloodPressureSys,
      data.maternalBloodPressureDia,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cord_prolapse.flowsheet_add',
      entity: 'obstetric_cord_prolapse_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), fhr: data.fetalHeartRateBpm },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-cord-prolapse/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageCordProlapse(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM obstetric_cord_prolapse_flowsheet_logs
      WHERE id = ? AND cord_prolapse_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_cord_prolapse_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cord_prolapse.flowsheet_delete',
      entity: 'obstetric_cord_prolapse_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
