import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricPmcd,
} from '../../web/src/obstetricPmcdEngine.js';

function assertCanManagePmcd(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric PMCD protocols');
  }
  return user;
}

const pmcdEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  arrestDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(16.0).max(43.0),
  initialArrestRhythm: z.enum([
    'asystole',
    'pea',
    'ventricular_fibrillation',
    'pulseless_vt',
  ]),
  cprInitiatedDatetime: z.string().min(1),
  continuousLeftUterineDisplacement: z.boolean().default(true),
  pmcdDecisionMinute: z.coerce.number().min(0.0).max(60.0).default(4.0),
  incisionDatetime: z.string().optional().nullable(),
  infantDeliveryDatetime: z.string().optional().nullable(),
  elapsedArrestToDeliveryMinutes: z.coerce.number().min(0.0).max(120.0).optional().nullable(),
  roscAchievedPostDelivery: z.boolean().default(true),
  roscDatetime: z.string().optional().nullable(),
  primaryEtiologyBeauChops: z.enum([
    'bleeding_dic',
    'embolism_afe_pte',
    'anesthetic_complication_last',
    'uterine_atony',
    'cardiac_underlying',
    'hypertension_preeclampsia',
    'other_toxic_metabolic',
    'placenta_abruption_accreta',
    'sepsis_shock',
  ]),
  uterineClosureMethod: z.enum([
    'rapid_single_layer_in_situ',
    'hemostatic_packing_temporary_closure',
    'emergent_hysterectomy',
  ]).default('rapid_single_layer_in_situ'),
  maternalSurvivalStatus: z.enum([
    'active_icu_targeted_temperature_management',
    'post_cardiac_arrest_stable',
    'neurologically_intact_recovery',
    'maternal_demise',
  ]).default('active_icu_targeted_temperature_management'),
  neonatalSurvivalStatus: z.enum([
    'nicu_active_hypothermia_hie',
    'stable_nicu_survivor',
    'neonatal_demise',
  ]).default('nicu_active_hypothermia_hie'),
  status: z.enum([
    'cardiac_arrest_resuscitation',
    'hysterotomy_evacuation_active',
    'post_rosc_intensive_care',
    'surgical_hemostasis_icu',
    'convalescent_rehabilitation',
    'case_closed',
  ]).default('cardiac_arrest_resuscitation'),
  clinicalNotes: z.string().optional().nullable(),
});

const pmcdFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  minutesPostArrest: z.coerce.number().min(0.0).max(1440.0),
  heartRateBpm: z.coerce.number().int().min(0).max(300),
  systolicBp: z.coerce.number().int().min(0).max(300),
  diastolicBp: z.coerce.number().int().min(0).max(200),
  endTidalCo2Mmhg: z.coerce.number().min(0.0).max(100.0),
  pupillaryResponse: z.enum([
    'reactive_equal',
    'sluggish',
    'fixed_dilated',
  ]),
  chestCompressionsQuality: z.enum([
    'optimal_etco2_gt_20',
    'suboptimal_etco2_lt_10',
    'rosc_sustained',
  ]),
  epinephrineCumulativeDoses: z.coerce.number().int().min(0).max(50).default(0),
  defibrillationShocksCount: z.coerce.number().int().min(0).max(20).default(0),
  bloodProductsTransfusedUnits: z.coerce.number().int().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
});

export function registerObstetricPmcdRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/obstetric-pmcd/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(pmcdEpisodeSchema.omit({ patientId: true }).partial({ arrestDatetime: true, cprInitiatedDatetime: true, status: true }), req.body);
    const evaluation = evaluateObstetricPmcd({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      initialArrestRhythm: data.initialArrestRhythm,
      continuousLeftUterineDisplacement: data.continuousLeftUterineDisplacement,
      pmcdDecisionMinute: data.pmcdDecisionMinute,
      elapsedArrestToDeliveryMinutes: data.elapsedArrestToDeliveryMinutes || null,
      roscAchievedPostDelivery: data.roscAchievedPostDelivery,
      primaryEtiologyBeauChops: data.primaryEtiologyBeauChops,
      uterineClosureMethod: data.uterineClosureMethod,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-pmcd/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM obstetric_pmcd_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM obstetric_pmcd_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.created_at DESC
      `).all();
    }

    return { episodes };
  });

  // 3. Get Single Episode with Evaluation and Flowsheet Logs
  app.get('/api/obstetric-pmcd/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, p.date_of_birth, u.full_name as consultant_name
      FROM obstetric_pmcd_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric PMCD episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM obstetric_pmcd_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.pmcd_episode_id = ?
      ORDER BY f.log_datetime DESC
    `).all(Number(id));

    const evaluation = evaluateObstetricPmcd({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      initialArrestRhythm: episode.initial_arrest_rhythm,
      continuousLeftUterineDisplacement: Boolean(episode.continuous_left_uterine_displacement),
      pmcdDecisionMinute: episode.pmcd_decision_minute,
      elapsedArrestToDeliveryMinutes: episode.elapsed_arrest_to_delivery_minutes,
      roscAchievedPostDelivery: Boolean(episode.rosc_achieved_post_delivery),
      primaryEtiologyBeauChops: episode.primary_etiology_beau_chops,
      uterineClosureMethod: episode.uterine_closure_method,
    });

    return { episode, evaluation, flowsheetLogs };
  });

  // 4. Create Episode
  app.post('/api/obstetric-pmcd/episodes', async (req, reply) => {
    const user = assertCanManagePmcd(req);
    const data = parse(pmcdEpisodeSchema, req.body);

    const patient = db.prepare(`SELECT id FROM patients WHERE id = ?`).get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const episodeCode = `PMCD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const result = db.prepare(`
      INSERT INTO obstetric_pmcd_episodes (
        patient_id, admission_id, episode_code, arrest_datetime, gestational_age_weeks,
        initial_arrest_rhythm, cpr_initiated_datetime, continuous_left_uterine_displacement,
        pmcd_decision_minute, incision_datetime, infant_delivery_datetime,
        elapsed_arrest_to_delivery_minutes, rosc_achieved_post_delivery, rosc_datetime,
        primary_etiology_beau_chops, uterine_closure_method,
        maternal_survival_status, neonatal_survival_status,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.arrestDatetime,
      data.gestationalAgeWeeks,
      data.initialArrestRhythm,
      data.cprInitiatedDatetime,
      data.continuousLeftUterineDisplacement ? 1 : 0,
      data.pmcdDecisionMinute,
      data.incisionDatetime || null,
      data.infantDeliveryDatetime || null,
      data.elapsedArrestToDeliveryMinutes || null,
      data.roscAchievedPostDelivery ? 1 : 0,
      data.roscDatetime || null,
      data.primaryEtiologyBeauChops,
      data.uterineClosureMethod,
      data.maternalSurvivalStatus,
      data.neonatalSurvivalStatus,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const created = db.prepare(`SELECT * FROM obstetric_pmcd_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pmcd.episode_create',
      entity: 'obstetric_pmcd_episodes',
      entityId: created.id,
      detail: { episodeId: created.id, episodeCode, patientId: data.patientId },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/obstetric-pmcd/episodes/:id', async (req) => {
    const user = assertCanManagePmcd(req);
    const { id } = req.params as { id: string };
    const data = parse(pmcdEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_pmcd_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric PMCD episode not found');

    db.prepare(`
      UPDATE obstetric_pmcd_episodes SET
        admission_id = ?,
        arrest_datetime = ?,
        gestational_age_weeks = ?,
        initial_arrest_rhythm = ?,
        cpr_initiated_datetime = ?,
        continuous_left_uterine_displacement = ?,
        pmcd_decision_minute = ?,
        incision_datetime = ?,
        infant_delivery_datetime = ?,
        elapsed_arrest_to_delivery_minutes = ?,
        rosc_achieved_post_delivery = ?,
        rosc_datetime = ?,
        primary_etiology_beau_chops = ?,
        uterine_closure_method = ?,
        maternal_survival_status = ?,
        neonatal_survival_status = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.admissionId || null,
      data.arrestDatetime,
      data.gestationalAgeWeeks,
      data.initialArrestRhythm,
      data.cprInitiatedDatetime,
      data.continuousLeftUterineDisplacement ? 1 : 0,
      data.pmcdDecisionMinute,
      data.incisionDatetime || null,
      data.infantDeliveryDatetime || null,
      data.elapsedArrestToDeliveryMinutes || null,
      data.roscAchievedPostDelivery ? 1 : 0,
      data.roscDatetime || null,
      data.primaryEtiologyBeauChops,
      data.uterineClosureMethod,
      data.maternalSurvivalStatus,
      data.neonatalSurvivalStatus,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM obstetric_pmcd_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pmcd.episode_update',
      entity: 'obstetric_pmcd_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: data.patientId },
    });

    return { episode: updated };
  });

  // 6. Patch Status
  app.patch('/api/obstetric-pmcd/episodes/:id/status', async (req) => {
    const user = assertCanManagePmcd(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({
      status: pmcdEpisodeSchema.shape.status,
    }), req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_pmcd_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric PMCD episode not found');

    db.prepare(`
      UPDATE obstetric_pmcd_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pmcd.status_patch',
      entity: 'obstetric_pmcd_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), previousStatus: existing.status, newStatus: status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/obstetric-pmcd/episodes/:id', async (req) => {
    const user = assertCanManagePmcd(req);
    if (user.role !== 'doctor') throw forbidden('Only doctors can delete PMCD episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM obstetric_pmcd_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric PMCD episode not found');

    db.prepare(`DELETE FROM obstetric_pmcd_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pmcd.episode_delete',
      entity: 'obstetric_pmcd_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: existing.patient_id },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Checkpoint
  app.post('/api/obstetric-pmcd/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManagePmcd(req);
    const { id } = req.params as { id: string };
    const data = parse(pmcdFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM obstetric_pmcd_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric PMCD episode not found');

    const result = db.prepare(`
      INSERT INTO obstetric_pmcd_flowsheet_logs (
        pmcd_episode_id, patient_id, log_datetime, minutes_post_arrest,
        heart_rate_bpm, systolic_bp, diastolic_bp, end_tidal_co2_mmhg,
        pupillary_response, chest_compressions_quality,
        epinephrine_cumulative_doses, defibrillation_shocks_count,
        blood_products_transfused_units, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.minutesPostArrest,
      data.heartRateBpm,
      data.systolicBp,
      data.diastolicBp,
      data.endTidalCo2Mmhg,
      data.pupillaryResponse,
      data.chestCompressionsQuality,
      data.epinephrineCumulativeDoses,
      data.defibrillationShocksCount,
      data.bloodProductsTransfusedUnits,
      data.notes || null,
      user.id
    );

    const created = db.prepare(`SELECT * FROM obstetric_pmcd_flowsheet_logs WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pmcd.flowsheet_add',
      entity: 'obstetric_pmcd_flowsheet_logs',
      entityId: created.id,
      detail: { flowsheetId: created.id, episodeId: Number(id), patientId: episode.patient_id },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Checkpoint
  app.delete('/api/obstetric-pmcd/flowsheet/:flowsheetId', async (req) => {
    const user = assertCanManagePmcd(req);
    const { flowsheetId } = req.params as { flowsheetId: string };

    const existing = db.prepare(`SELECT * FROM obstetric_pmcd_flowsheet_logs WHERE id = ?`).get(Number(flowsheetId)) as any;
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM obstetric_pmcd_flowsheet_logs WHERE id = ?`).run(Number(flowsheetId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pmcd.flowsheet_delete',
      entity: 'obstetric_pmcd_flowsheet_logs',
      entityId: Number(flowsheetId),
      detail: { flowsheetId: Number(flowsheetId), episodeId: existing.pmcd_episode_id },
    });

    return { ok: true };
  });
}
