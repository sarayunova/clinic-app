import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricDic,
  type ObstetricDicTrigger,
  type OvertBleedingSites,
} from '../../web/src/obstetricDicEngine.js';

function assertCanManageDic(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric DIC protocols');
  }
  return user;
}

const obstetricDicEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  diagnosisDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(12.0).max(44.0).optional().nullable(),
  clinicalTrigger: z.enum([
    'placental_abruption',
    'severe_pph',
    'amniotic_fluid_embolism',
    'severe_preeclampsia_hellp',
    'septic_abortion_chorioamnionitis',
    'retained_dead_fetus',
    'acute_fatty_liver',
  ]),
  plateletCountKUl: z.coerce.number().min(1).max(1000),
  fibrinogenMgDl: z.coerce.number().min(0).max(1200),
  prothrombinTimeSec: z.coerce.number().min(5).max(150).optional().nullable(),
  controlPtSec: z.coerce.number().min(5).max(50).optional().nullable(),
  inr: z.coerce.number().min(0.5).max(20.0),
  apttSec: z.coerce.number().min(10).max(300).optional().nullable(),
  dDimerUgMl: z.coerce.number().min(0).max(200).optional().nullable(),
  estimatedBloodLossMl: z.coerce.number().min(0).max(20000).default(0),
  overtBleedingSites: z.enum([
    'none',
    'surgical_site_oozing',
    'iv_cannula_sites',
    'hematuria_gi',
    'catastrophic_generalized',
  ]),
  isMtpActivated: z.boolean().default(false),
  prbcUnitsGiven: z.coerce.number().int().min(0).max(50).default(0),
  ffpUnitsGiven: z.coerce.number().int().min(0).max(50).default(0),
  plateletPoolsGiven: z.coerce.number().int().min(0).max(20).default(0),
  cryoprecipitateUnitsGiven: z.coerce.number().int().min(0).max(100).default(0),
  fibrinogenConcentrateGGiven: z.coerce.number().min(0).max(20).default(0),
  tranexamicAcidGiven: z.boolean().default(false),
  ionizedCalciumMmolL: z.coerce.number().min(0.1).max(5.0).optional().nullable(),
  coreTemperatureC: z.coerce.number().min(30.0).max(43.0).optional().nullable(),
  status: z.enum(['active', 'stabilized', 'resolved', 'transferred']).default('active'),
  clinicalSummary: z.string().optional().nullable(),
});

const dicFlowsheetLogSchema = z.object({
  recordedAt: z.string().min(1),
  systolicBp: z.coerce.number().int().min(30).max(260).optional().nullable(),
  diastolicBp: z.coerce.number().int().min(20).max(180).optional().nullable(),
  heartRateBpm: z.coerce.number().int().min(30).max(250).optional().nullable(),
  spo2Percent: z.coerce.number().min(50).max(100).optional().nullable(),
  hourlyBloodLossMl: z.coerce.number().min(0).max(5000).default(0),
  serialFibrinogenMgDl: z.coerce.number().min(0).max(1200).optional().nullable(),
  serialPlateletsKUl: z.coerce.number().min(1).max(1000).optional().nullable(),
  serialInr: z.coerce.number().min(0.5).max(20.0).optional().nullable(),
  urineOutputMlHr: z.coerce.number().min(0).max(1000).optional().nullable(),
  bloodComponentsInfused: z.string().optional().nullable(),
  clinicalHemostasisState: z.enum([
    'uncontrolled_diffuse_ooze',
    'partial_clot_formation',
    'firm_hemostatic_clots',
    'bleeding_controlled',
  ]),
  nurseNotes: z.string().optional().nullable(),
});

export function registerObstetricDicRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  function fetchFullEpisode(id: number) {
    const episode = db
      .prepare(
        `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
           FROM obstetric_dic_episodes e
           JOIN patients p ON p.id = e.patient_id
           LEFT JOIN users u ON u.id = e.created_by
          WHERE e.id = ?`
      )
      .get(id) as any;
    if (!episode) return null;

    const flowsheet = db
      .prepare(
        `SELECT l.*, u.full_name as recorded_by_name
           FROM obstetric_dic_flowsheet_logs l
           LEFT JOIN users u ON l.recorded_by = u.id
          WHERE l.episode_id = ?
          ORDER BY l.recorded_at ASC, l.id ASC`
      )
      .all(id) as any[];

    const evaluation = evaluateObstetricDic({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      clinicalTrigger: episode.clinical_trigger,
      plateletCountKUl: episode.platelet_count_k_ul,
      fibrinogenMgDl: episode.fibrinogen_mg_dl,
      inr: episode.inr,
      prothrombinTimeSec: episode.prothrombin_time_sec,
      controlPtSec: episode.control_pt_sec,
      apttSec: episode.aptt_sec,
      dDimerUgMl: episode.d_dimer_ug_ml,
      estimatedBloodLossMl: episode.estimated_blood_loss_ml,
      overtBleedingSites: episode.overt_bleeding_sites,
      isMtpActivated: Boolean(episode.is_mtp_activated),
      ionizedCalciumMmolL: episode.ionized_calcium_mmol_l,
      coreTemperatureC: episode.core_temperature_c,
    });

    return { episode, flowsheet, evaluation };
  }

  // 1. Evaluate Preview
  app.post('/api/obstetric-dic/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        gestationalAgeWeeks: z.coerce.number().optional().nullable(),
        clinicalTrigger: z.enum([
          'placental_abruption',
          'severe_pph',
          'amniotic_fluid_embolism',
          'severe_preeclampsia_hellp',
          'septic_abortion_chorioamnionitis',
          'retained_dead_fetus',
          'acute_fatty_liver',
        ]).default('severe_pph'),
        plateletCountKUl: z.coerce.number().default(85),
        fibrinogenMgDl: z.coerce.number().default(140),
        inr: z.coerce.number().default(1.4),
        prothrombinTimeSec: z.coerce.number().optional().nullable(),
        controlPtSec: z.coerce.number().optional().nullable(),
        apttSec: z.coerce.number().optional().nullable(),
        dDimerUgMl: z.coerce.number().optional().nullable(),
        estimatedBloodLossMl: z.coerce.number().default(1200),
        overtBleedingSites: z.enum([
          'none',
          'surgical_site_oozing',
          'iv_cannula_sites',
          'hematuria_gi',
          'catastrophic_generalized',
        ]).default('surgical_site_oozing'),
        isMtpActivated: z.boolean().default(false),
        ionizedCalciumMmolL: z.coerce.number().optional().nullable(),
        coreTemperatureC: z.coerce.number().optional().nullable(),
      }),
      req.body
    );

    const evaluation = evaluateObstetricDic({
      gestationalAgeWeeks: body.gestationalAgeWeeks,
      clinicalTrigger: body.clinicalTrigger as ObstetricDicTrigger,
      plateletCountKUl: body.plateletCountKUl,
      fibrinogenMgDl: body.fibrinogenMgDl,
      inr: body.inr,
      prothrombinTimeSec: body.prothrombinTimeSec,
      controlPtSec: body.controlPtSec,
      apttSec: body.apttSec,
      dDimerUgMl: body.dDimerUgMl,
      estimatedBloodLossMl: body.estimatedBloodLossMl,
      overtBleedingSites: body.overtBleedingSites as OvertBleedingSites,
      isMtpActivated: body.isMtpActivated,
      ionizedCalciumMmolL: body.ionizedCalciumMmolL,
      coreTemperatureC: body.coreTemperatureC,
    });

    return { evaluation };
  });

  // 2. List Episodes (supports ?patientId= query or all)
  app.get('/api/obstetric-dic/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM obstetric_dic_episodes e
             JOIN patients p ON p.id = e.patient_id
             LEFT JOIN users u ON u.id = e.created_by
            WHERE e.patient_id = ?
            ORDER BY e.diagnosis_datetime DESC, e.id DESC`
        )
        .all(Number(patientId));
    } else {
      episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM obstetric_dic_episodes e
             JOIN patients p ON p.id = e.patient_id
             LEFT JOIN users u ON u.id = e.created_by
            ORDER BY e.diagnosis_datetime DESC, e.id DESC`
        )
        .all();
    }
    return { episodes };
  });

  // 2b. List Episodes for Patient
  app.get<{ Params: { patientId: string } }>(
    '/api/obstetric-dic/patient/:patientId',
    async (req) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number(req.params.patientId);
      const episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM obstetric_dic_episodes e
             JOIN patients p ON p.id = e.patient_id
             LEFT JOIN users u ON u.id = e.created_by
            WHERE e.patient_id = ?
            ORDER BY e.diagnosis_datetime DESC, e.id DESC`
        )
        .all(patientId);

      return { episodes };
    }
  );

  // 3. Get Single Episode with Flowsheet and Evaluation
  app.get<{ Params: { id: string } }>('/api/obstetric-dic/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number(req.params.id);
    const data = fetchFullEpisode(id);
    if (!data) throw notFound('Obstetric DIC episode not found');
    return data;
  });

  // 4. Create Episode
  app.post('/api/obstetric-dic/episodes', async (req) => {
    const user = assertCanManageDic(req);
    const body = parse(obstetricDicEpisodeSchema, req.body);

    const episodeNumber = `DIC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const info = db
      .prepare(
        `INSERT INTO obstetric_dic_episodes (
           patient_id, episode_number, diagnosis_datetime, gestational_age_weeks, clinical_trigger,
           platelet_count_k_ul, fibrinogen_mg_dl, prothrombin_time_sec, control_pt_sec, inr, aptt_sec, d_dimer_ug_ml,
           estimated_blood_loss_ml, overt_bleeding_sites, is_mtp_activated, prbc_units_given, ffp_units_given,
           platelet_pools_given, cryoprecipitate_units_given, fibrinogen_concentrate_g_given, tranexamic_acid_given,
           ionized_calcium_mmol_l, core_temperature_c, status, clinical_summary, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.patientId,
        episodeNumber,
        body.diagnosisDatetime,
        body.gestationalAgeWeeks ?? null,
        body.clinicalTrigger,
        body.plateletCountKUl,
        body.fibrinogenMgDl,
        body.prothrombinTimeSec ?? null,
        body.controlPtSec ?? null,
        body.inr,
        body.apttSec ?? null,
        body.dDimerUgMl ?? null,
        body.estimatedBloodLossMl,
        body.overtBleedingSites,
        body.isMtpActivated ? 1 : 0,
        body.prbcUnitsGiven,
        body.ffpUnitsGiven,
        body.plateletPoolsGiven,
        body.cryoprecipitateUnitsGiven,
        body.fibrinogenConcentrateGGiven,
        body.tranexamicAcidGiven ? 1 : 0,
        body.ionizedCalciumMmolL ?? null,
        body.coreTemperatureC ?? null,
        body.status,
        body.clinicalSummary ?? null,
        user.id
      );

    const episodeId = Number(info.lastInsertRowid);
    audit(db, {
      actorId: user.id,
      action: 'obstetric_dic.create',
      entity: 'obstetric_dic_episodes',
      entityId: episodeId,
      detail: { patientId: body.patientId, episodeNumber },
    });

    const full = fetchFullEpisode(episodeId);
    return { episode: full?.episode, id: episodeId, episodeNumber, ok: true };
  });

  // 5. Update Episode
  app.put<{ Params: { id: string } }>('/api/obstetric-dic/episodes/:id', async (req) => {
    const user = assertCanManageDic(req);
    const episodeId = Number(req.params.id);
    const body = parse(obstetricDicEpisodeSchema.partial(), req.body);

    const existing = db
      .prepare('SELECT * FROM obstetric_dic_episodes WHERE id = ?')
      .get(episodeId) as any;
    if (!existing) throw notFound('Obstetric DIC episode not found');

    db.prepare(
      `UPDATE obstetric_dic_episodes
          SET gestational_age_weeks = COALESCE(?, gestational_age_weeks),
              clinical_trigger = COALESCE(?, clinical_trigger),
              platelet_count_k_ul = COALESCE(?, platelet_count_k_ul),
              fibrinogen_mg_dl = COALESCE(?, fibrinogen_mg_dl),
              prothrombin_time_sec = COALESCE(?, prothrombin_time_sec),
              control_pt_sec = COALESCE(?, control_pt_sec),
              inr = COALESCE(?, inr),
              aptt_sec = COALESCE(?, aptt_sec),
              d_dimer_ug_ml = COALESCE(?, d_dimer_ug_ml),
              estimated_blood_loss_ml = COALESCE(?, estimated_blood_loss_ml),
              overt_bleeding_sites = COALESCE(?, overt_bleeding_sites),
              is_mtp_activated = COALESCE(?, is_mtp_activated),
              prbc_units_given = COALESCE(?, prbc_units_given),
              ffp_units_given = COALESCE(?, ffp_units_given),
              platelet_pools_given = COALESCE(?, platelet_pools_given),
              cryoprecipitate_units_given = COALESCE(?, cryoprecipitate_units_given),
              fibrinogen_concentrate_g_given = COALESCE(?, fibrinogen_concentrate_g_given),
              tranexamic_acid_given = COALESCE(?, tranexamic_acid_given),
              ionized_calcium_mmol_l = COALESCE(?, ionized_calcium_mmol_l),
              core_temperature_c = COALESCE(?, core_temperature_c),
              status = COALESCE(?, status),
              clinical_summary = COALESCE(?, clinical_summary),
              updated_at = datetime('now')
        WHERE id = ?`
    ).run(
      body.gestationalAgeWeeks ?? null,
      body.clinicalTrigger ?? null,
      body.plateletCountKUl ?? null,
      body.fibrinogenMgDl ?? null,
      body.prothrombinTimeSec ?? null,
      body.controlPtSec ?? null,
      body.inr ?? null,
      body.apttSec ?? null,
      body.dDimerUgMl ?? null,
      body.estimatedBloodLossMl ?? null,
      body.overtBleedingSites ?? null,
      body.isMtpActivated !== undefined ? (body.isMtpActivated ? 1 : 0) : null,
      body.prbcUnitsGiven ?? null,
      body.ffpUnitsGiven ?? null,
      body.plateletPoolsGiven ?? null,
      body.cryoprecipitateUnitsGiven ?? null,
      body.fibrinogenConcentrateGGiven ?? null,
      body.tranexamicAcidGiven !== undefined ? (body.tranexamicAcidGiven ? 1 : 0) : null,
      body.ionizedCalciumMmolL ?? null,
      body.coreTemperatureC ?? null,
      body.status ?? null,
      body.clinicalSummary ?? null,
      episodeId
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_dic.update',
      entity: 'obstetric_dic_episodes',
      entityId: episodeId,
      detail: { patientId: existing.patient_id },
    });

    const full = fetchFullEpisode(episodeId);
    return { episode: full?.episode, ok: true };
  });

  // 6. Update Status
  app.patch<{ Params: { id: string } }>(
    '/api/obstetric-dic/episodes/:id/status',
    async (req) => {
      const user = assertCanManageDic(req);
      const episodeId = Number(req.params.id);
      const { status } = parse(
        z.object({ status: z.enum(['active', 'stabilized', 'resolved', 'transferred']) }),
        req.body
      );

      const existing = db
        .prepare('SELECT patient_id FROM obstetric_dic_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('Episode not found');

      db.prepare(
        "UPDATE obstetric_dic_episodes SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(status, episodeId);

      audit(db, {
        actorId: user.id,
        action: 'obstetric_dic.status_change',
        entity: 'obstetric_dic_episodes',
        entityId: episodeId,
        detail: { patientId: existing.patient_id, status },
      });

      const full = fetchFullEpisode(episodeId);
      return { episode: full?.episode, ok: true };
    }
  );

  // 7. Delete Episode (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/obstetric-dic/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors can delete obstetric DIC episodes');
    }
    const episodeId = Number(req.params.id);
    const existing = db
      .prepare('SELECT patient_id FROM obstetric_dic_episodes WHERE id = ?')
      .get(episodeId) as any;
    if (!existing) throw notFound('Episode not found');

    db.prepare('DELETE FROM obstetric_dic_episodes WHERE id = ?').run(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_dic.delete',
      entity: 'obstetric_dic_episodes',
      entityId: episodeId,
      detail: { patientId: existing.patient_id },
    });

    return { success: true, ok: true };
  });

  // 8. Add Flowsheet Log
  app.post<{ Params: { id: string } }>(
    '/api/obstetric-dic/episodes/:id/flowsheet',
    async (req) => {
      const user = assertCanManageDic(req);
      const episodeId = Number(req.params.id);
      const body = parse(dicFlowsheetLogSchema, req.body);

      const existing = db
        .prepare('SELECT patient_id FROM obstetric_dic_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('Episode not found');

      const info = db
        .prepare(
          `INSERT INTO obstetric_dic_flowsheet_logs (
             episode_id, recorded_at, systolic_bp, diastolic_bp, heart_rate_bpm,
             spo2_percent, hourly_blood_loss_ml, serial_fibrinogen_mg_dl,
             serial_platelets_k_ul, serial_inr, urine_output_ml_hr, blood_components_infused,
             clinical_hemostasis_state, nurse_notes, recorded_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          episodeId,
          body.recordedAt,
          body.systolicBp ?? null,
          body.diastolicBp ?? null,
          body.heartRateBpm ?? null,
          body.spo2Percent ?? null,
          body.hourlyBloodLossMl,
          body.serialFibrinogenMgDl ?? null,
          body.serialPlateletsKUl ?? null,
          body.serialInr ?? null,
          body.urineOutputMlHr ?? null,
          body.bloodComponentsInfused ?? null,
          body.clinicalHemostasisState,
          body.nurseNotes ?? null,
          user.id
        );

      const logId = Number(info.lastInsertRowid);
      audit(db, {
        actorId: user.id,
        action: 'obstetric_dic.flowsheet_add',
        entity: 'obstetric_dic_flowsheet_logs',
        entityId: logId,
        detail: { episodeId, patientId: existing.patient_id },
      });

      const log = db
        .prepare(
          `SELECT l.*, u.full_name as recorded_by_name
             FROM obstetric_dic_flowsheet_logs l
             LEFT JOIN users u ON l.recorded_by = u.id
            WHERE l.id = ?`
        )
        .get(logId);

      return { flowsheetLog: log, id: logId, ok: true };
    }
  );

  // 9. Delete Flowsheet Log
  app.delete<{ Params: { id: string; logId: string } }>(
    '/api/obstetric-dic/episodes/:id/flowsheet/:logId',
    async (req) => {
      const user = assertCanManageDic(req);
      const episodeId = Number(req.params.id);
      const logId = Number(req.params.logId);

      const existing = db
        .prepare(
          `SELECT l.id, e.patient_id
             FROM obstetric_dic_flowsheet_logs l
             JOIN obstetric_dic_episodes e ON l.episode_id = e.id
            WHERE l.id = ? AND l.episode_id = ?`
        )
        .get(logId, episodeId) as any;
      if (!existing) throw notFound('Flowsheet log not found');

      db.prepare('DELETE FROM obstetric_dic_flowsheet_logs WHERE id = ?').run(logId);

      audit(db, {
        actorId: user.id,
        action: 'obstetric_dic.flowsheet_delete',
        entity: 'obstetric_dic_flowsheet_logs',
        entityId: logId,
        detail: { episodeId, patientId: existing.patient_id },
      });

      return { success: true, ok: true };
    }
  );
}
