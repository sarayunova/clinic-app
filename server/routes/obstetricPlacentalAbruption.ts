import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricPlacentalAbruption,
} from '../../web/src/obstetricPlacentalAbruptionEngine.js';

function assertCanManageAbruption(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric placental abruption protocols');
  }
  return user;
}

const abruptionEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  presentationDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(20.0).max(44.0),
  maternalParity: z.coerce.number().int().min(0).max(15).default(0),
  vaginalBleedingSeverity: z.enum([
    'concealed_no_external_bleeding',
    'mild_spotting',
    'moderate_bleeding',
    'severe_massive_hemorrhage',
  ]),
  abdominalPainCharacter: z.enum([
    'none',
    'mild_cramping',
    'severe_constant_knife_like',
  ]),
  uterineTonus: z.enum([
    'normal_soft',
    'increased_hypertonic',
    'tetanic_woody_hard',
  ]),
  fetalHeartRateStatus: z.enum([
    'reassuring_category_1',
    'indeterminate_category_2',
    'severe_bradycardia_category_3',
    'intrauterine_fetal_demise_confirmed',
  ]),
  maternalSystolicBp: z.coerce.number().int().min(40).max(260),
  maternalDiastolicBp: z.coerce.number().int().min(20).max(160),
  maternalHeartRate: z.coerce.number().int().min(40).max(240),
  serumFibrinogenMgDl: z.coerce.number().min(10).max(800),
  plateletCount: z.coerce.number().int().min(1000).max(1000000),
  hemoglobinGDl: z.coerce.number().min(2.0).max(20.0),
  ptInr: z.coerce.number().min(0.5).max(10.0).optional().nullable(),
  kleihauerBetkeSent: z.boolean().default(false),
  ultrasoundRetroplacentalHematoma: z.enum([
    'none_visualized_abruption_not_excluded',
    'marginal_collection',
    'retroplacental_hematoma_present',
    'couvelaire_uterus_suspected',
  ]),
  mtpActivated: z.boolean().default(false),
  prbcUnitsTransfused: z.coerce.number().int().min(0).max(50).default(0),
  ffpUnitsTransfused: z.coerce.number().int().min(0).max(50).default(0),
  cryoprecipitatePoolsTransfused: z.coerce.number().int().min(0).max(20).default(0),
  deliveryModeIndicated: z.enum([
    'emergent_crash_cesarean',
    'urgent_cesarean_transfer',
    'augmented_vaginal_delivery_under_monitoring',
    'conservative_surveillance_preterm',
  ]),
  status: z.enum([
    'emergent_stabilization',
    'crash_cesarean_in_progress',
    'postpartum_dic_resuscitation',
    'stabilized_ward_observation',
    'resolved_discharged',
  ]).default('emergent_stabilization'),
  clinicalNotes: z.string().optional().nullable(),
});

const abruptionFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  minutesFromPresentation: z.coerce.number().min(0).max(1440),
  maternalHeartRate: z.coerce.number().int().min(30).max(250),
  maternalBloodPressureSys: z.coerce.number().int().min(40).max(260),
  maternalBloodPressureDia: z.coerce.number().int().min(20).max(160),
  fetalHeartRate: z.coerce.number().int().min(40).max(240).optional().nullable(),
  uterineToneAssessment: z.enum([
    'soft_relaxed_between_contractions',
    'tense_hypertonic',
    'woody_rigid',
  ]),
  vaginalBloodLossMl: z.coerce.number().min(0).max(5000).optional().nullable(),
  fibrinogenMgDl: z.coerce.number().min(10).max(800).optional().nullable(),
  bloodProductsInfused: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerObstetricPlacentalAbruptionRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/obstetric-placental-abruption/evaluate', async (req) => {
    assertCanManageAbruption(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricPlacentalAbruption({
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 35.0),
      maternalParity: Number(body.maternalParity || 1),
      vaginalBleedingSeverity: body.vaginalBleedingSeverity || 'moderate_bleeding',
      abdominalPainCharacter: body.abdominalPainCharacter || 'severe_constant_knife_like',
      uterineTonus: body.uterineTonus || 'tetanic_woody_hard',
      fetalHeartRateStatus: body.fetalHeartRateStatus || 'severe_bradycardia_category_3',
      maternalSystolicBp: Number(body.maternalSystolicBp || 95),
      maternalDiastolicBp: Number(body.maternalDiastolicBp || 55),
      maternalHeartRate: Number(body.maternalHeartRate || 128),
      serumFibrinogenMgDl: Number(body.serumFibrinogenMgDl || 140),
      plateletCount: Number(body.plateletCount || 95000),
      hemoglobinGDl: Number(body.hemoglobinGDl || 8.5),
      ptInr: body.ptInr !== undefined ? Number(body.ptInr) : undefined,
      ultrasoundRetroplacentalHematoma: body.ultrasoundRetroplacentalHematoma || 'retroplacental_hematoma_present',
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-placental-abruption/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_placental_abruption_episodes e
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

  // 3. Get Episode Details with Flowsheet Logs
  app.get('/api/obstetric-placental-abruption/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_placental_abruption_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric placental abruption episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_placental_abruption_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.abruption_episode_id = ?
      ORDER BY l.minutes_from_presentation ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateObstetricPlacentalAbruption({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      maternalParity: episode.maternal_parity,
      vaginalBleedingSeverity: episode.vaginal_bleeding_severity,
      abdominalPainCharacter: episode.abdominal_pain_character,
      uterineTonus: episode.uterine_tonus,
      fetalHeartRateStatus: episode.fetal_heart_rate_status,
      maternalSystolicBp: episode.maternal_systolic_bp,
      maternalDiastolicBp: episode.maternal_diastolic_bp,
      maternalHeartRate: episode.maternal_heart_rate,
      serumFibrinogenMgDl: episode.serum_fibrinogen_mg_dl,
      plateletCount: episode.platelet_count,
      hemoglobinGDl: episode.hemoglobin_g_dl,
      ptInr: episode.pt_inr !== null ? episode.pt_inr : undefined,
      ultrasoundRetroplacentalHematoma: episode.ultrasound_retroplacental_hematoma,
    });

    return { episode, flowsheet: flowsheetLogs, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-placental-abruption/episodes', async (req, reply) => {
    const user = assertCanManageAbruption(req);
    requirePerm(req, 'patient:write_clinical');
    const input = parse(abruptionEpisodeSchema, req.body);

    const evaluation = evaluateObstetricPlacentalAbruption({
      gestationalAgeWeeks: input.gestationalAgeWeeks,
      maternalParity: input.maternalParity,
      vaginalBleedingSeverity: input.vaginalBleedingSeverity,
      abdominalPainCharacter: input.abdominalPainCharacter,
      uterineTonus: input.uterineTonus,
      fetalHeartRateStatus: input.fetalHeartRateStatus,
      maternalSystolicBp: input.maternalSystolicBp,
      maternalDiastolicBp: input.maternalDiastolicBp,
      maternalHeartRate: input.maternalHeartRate,
      serumFibrinogenMgDl: input.serumFibrinogenMgDl,
      plateletCount: input.plateletCount,
      hemoglobinGDl: input.hemoglobinGDl,
      ptInr: input.ptInr ?? undefined,
      ultrasoundRetroplacentalHematoma: input.ultrasoundRetroplacentalHematoma,
    });

    const episodeCode = `ABRUPT-${Date.now().toString(36).toUpperCase()}`;

    const insert = db.prepare(`
      INSERT INTO obstetric_placental_abruption_episodes (
        patient_id, admission_id, episode_code, presentation_datetime,
        gestational_age_weeks, maternal_parity, vaginal_bleeding_severity,
        abdominal_pain_character, uterine_tonus, fetal_heart_rate_status,
        maternal_systolic_bp, maternal_diastolic_bp, maternal_heart_rate,
        serum_fibrinogen_mg_dl, platelet_count, hemoglobin_g_dl, pt_inr,
        kleihauer_betke_sent, ultrasound_retroplacental_hematoma,
        page_classification_grade, mtp_activated, prbc_units_transfused,
        ffp_units_transfused, cryoprecipitate_pools_transfused,
        delivery_mode_indicated, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = insert.run(
      input.patientId,
      input.admissionId ?? null,
      episodeCode,
      input.presentationDatetime,
      input.gestationalAgeWeeks,
      input.maternalParity,
      input.vaginalBleedingSeverity,
      input.abdominalPainCharacter,
      input.uterineTonus,
      input.fetalHeartRateStatus,
      input.maternalSystolicBp,
      input.maternalDiastolicBp,
      input.maternalHeartRate,
      input.serumFibrinogenMgDl,
      input.plateletCount,
      input.hemoglobinGDl,
      input.ptInr ?? null,
      input.kleihauerBetkeSent ? 1 : 0,
      input.ultrasoundRetroplacentalHematoma,
      evaluation.pageClassificationGrade,
      (evaluation.mtpActivated || input.mtpActivated) ? 1 : 0,
      input.prbcUnitsTransfused,
      input.ffpUnitsTransfused,
      input.cryoprecipitatePoolsTransfused,
      input.deliveryModeIndicated || evaluation.deliveryModeIndicated,
      input.status,
      user.id,
      input.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_placental_abruption.create',
      entity: 'obstetric_placental_abruption_episodes',
      entityId: episodeId,
      detail: {
        episodeId,
        episodeCode,
        patientId: input.patientId,
        grade: evaluation.pageClassificationGrade,
        deliveryMode: evaluation.deliveryModeIndicated,
      },
    });

    reply.status(201);
    return {
      episodeId,
      id: episodeId,
      episodeCode,
      grade: evaluation.pageClassificationGrade,
      deliveryMode: evaluation.deliveryModeIndicated,
      evaluation,
      success: true,
    };
  });

  // 5. Update Status
  app.patch('/api/obstetric-placental-abruption/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageAbruption(req);
    const { id } = req.params as { id: string };

    const statusSchema = z.object({
      status: z.enum([
        'emergent_stabilization',
        'crash_cesarean_in_progress',
        'postpartum_dic_resuscitation',
        'stabilized_ward_observation',
        'resolved_discharged',
      ]),
      deliveryModeIndicated: z.enum([
        'emergent_crash_cesarean',
        'urgent_cesarean_transfer',
        'augmented_vaginal_delivery_under_monitoring',
        'conservative_surveillance_preterm',
      ]).optional(),
      prbcUnitsTransfused: z.coerce.number().int().min(0).max(50).optional(),
      ffpUnitsTransfused: z.coerce.number().int().min(0).max(50).optional(),
      cryoprecipitatePoolsTransfused: z.coerce.number().int().min(0).max(20).optional(),
      clinicalNotes: z.string().optional().nullable(),
    });

    const input = parse(statusSchema, req.body);

    const update = db.prepare(`
      UPDATE obstetric_placental_abruption_episodes
      SET status = ?,
          delivery_mode_indicated = COALESCE(?, delivery_mode_indicated),
          prbc_units_transfused = COALESCE(?, prbc_units_transfused),
          ffp_units_transfused = COALESCE(?, ffp_units_transfused),
          cryoprecipitate_pools_transfused = COALESCE(?, cryoprecipitate_pools_transfused),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = update.run(
      input.status,
      input.deliveryModeIndicated ?? null,
      input.prbcUnitsTransfused ?? null,
      input.ffpUnitsTransfused ?? null,
      input.cryoprecipitatePoolsTransfused ?? null,
      input.clinicalNotes ?? null,
      Number(id)
    );
    if (result.changes === 0) throw notFound('Episode not found');

    audit(db, {
      actorId: user.id,
      action: 'obstetric_placental_abruption.status_update',
      entity: 'obstetric_placental_abruption_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), newStatus: input.status },
    });

    return { success: true, status: input.status };
  });

  // 6. Add Flowsheet Entry
  const addFlowsheetHandler = async (req: FastifyRequest, reply: any) => {
    const user = assertCanManageAbruption(req);
    const { id } = req.params as { id: string };
    const input = parse(abruptionFlowsheetSchema, req.body);

    const episode = db.prepare(`
      SELECT patient_id FROM obstetric_placental_abruption_episodes WHERE id = ?
    `).get(Number(id)) as { patient_id: number } | undefined;

    if (!episode) throw notFound('Obstetric placental abruption episode not found');

    const insert = db.prepare(`
      INSERT INTO obstetric_placental_abruption_flowsheet_logs (
        abruption_episode_id, patient_id, log_datetime, minutes_from_presentation,
        maternal_heart_rate, maternal_blood_pressure_sys, maternal_blood_pressure_dia,
        fetal_heart_rate, uterine_tone_assessment, vaginal_blood_loss_ml,
        fibrinogen_mg_dl, blood_products_infused, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const res = insert.run(
      Number(id),
      episode.patient_id,
      input.logDatetime,
      input.minutesFromPresentation,
      input.maternalHeartRate,
      input.maternalBloodPressureSys,
      input.maternalBloodPressureDia,
      input.fetalHeartRate ?? null,
      input.uterineToneAssessment,
      input.vaginalBloodLossMl ?? null,
      input.fibrinogenMgDl ?? null,
      input.bloodProductsInfused ?? null,
      input.notes ?? null,
      user.id
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_placental_abruption.flowsheet_add',
      entity: 'obstetric_placental_abruption_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, minutes: input.minutesFromPresentation },
    });

    reply.status(201);
    return { id: logId, logId, success: true };
  };

  app.post('/api/obstetric-placental-abruption/episodes/:id/flowsheet', addFlowsheetHandler);
  app.post('/api/obstetric-placental-abruption/episodes/:id/flowsheet-logs', addFlowsheetHandler);

  // 7. Delete Flowsheet Entry
  app.delete('/api/obstetric-placental-abruption/flowsheet/:id', async (req) => {
    const user = assertCanManageAbruption(req);
    const { id } = req.params as { id: string };

    const entry = db.prepare(`
      SELECT * FROM obstetric_placental_abruption_flowsheet_logs WHERE id = ?
    `).get(Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_placental_abruption_flowsheet_logs WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_placental_abruption.flowsheet_delete',
      entity: 'obstetric_placental_abruption_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: entry.abruption_episode_id },
    });

    return { success: true };
  });

  app.delete('/api/obstetric-placental-abruption/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageAbruption(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const entry = db.prepare(`
      SELECT * FROM obstetric_placental_abruption_flowsheet_logs WHERE id = ? AND abruption_episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!entry) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_placental_abruption_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_placental_abruption.flowsheet_delete',
      entity: 'obstetric_placental_abruption_flowsheet_logs',
      entityId: Number(logId),
      detail: { logId: Number(logId), episodeId: Number(id) },
    });

    return { success: true };
  });
}
