import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalSeizures,
  type NeonatalSeizureSemiology,
  type NeonatalSeizureDuration,
  type NeonatalSeizureEtiology,
} from '../../web/src/neonatalSeizuresEngine.js';

function assertCanManageSeizures(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal seizure protocols');
  }
  return user;
}

const neonatalSeizuresEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  diagnosisDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(22.0).max(44.0),
  postnatalAgeDays: z.coerce.number().int().min(0).max(90),
  currentWeightKg: z.coerce.number().min(0.3).max(10.0),
  seizureSemiology: z.enum([
    'clonic',
    'tonic',
    'myoclonic',
    'autonomic',
    'subtle',
    'electrographic_only',
  ]),
  seizureDurationCategory: z.enum([
    'isolated_brief',
    'recurrent_cluster',
    'status_epilepticus',
  ]),
  suspectedEtiology: z.enum([
    'hie',
    'cns_infection',
    'stroke_thrombosis',
    'ich',
    'inborn_metabolism',
    'hypoglycemia',
    'hypocalcemia',
    'benign_familial',
    'unknown',
  ]),
  bloodGlucoseMgDl: z.coerce.number().min(0).max(1000).optional().nullable(),
  ionizedCalciumMmolL: z.coerce.number().min(0.1).max(5.0).optional().nullable(),
  serumMagnesiumMgDl: z.coerce.number().min(0.1).max(15.0).optional().nullable(),
  sodiumMeqL: z.coerce.number().min(80).max(200).optional().nullable(),
  firstLinePhenobarbitalGiven: z.boolean().default(false),
  cumulativePhenobarbitalMgKg: z.coerce.number().min(0).max(100).default(0),
  secondLineAnticonvulsant: z.string().optional().nullable(),
  secondLineGiven: z.boolean().default(false),
  pyridoxineTrialDone: z.boolean().default(false),
  pyridoxineResponsive: z.boolean().default(false),
  respiratorySupportStatus: z.enum([
    'room_air',
    'nasal_prongs',
    'cpap',
    'mechanical_ventilation',
  ]).default('room_air'),
  status: z.enum(['active', 'stabilized', 'resolved', 'transferred']).default('active'),
  clinicalSummary: z.string().optional().nullable(),
});

const flowsheetLogSchema = z.object({
  recordedAt: z.string().min(1),
  seizureCountPastHour: z.coerce.number().int().min(0).max(100).default(0),
  currentSeizureState: z.enum([
    'seizure_free',
    'infrequent_twitches',
    'active_clinical_seizures',
    'continuous_status',
  ]),
  heartRateBpm: z.coerce.number().int().min(30).max(300).optional().nullable(),
  respiratoryRateBpm: z.coerce.number().int().min(0).max(150).optional().nullable(),
  spo2Percent: z.coerce.number().min(0).max(100).optional().nullable(),
  bloodPressureSys: z.coerce.number().int().min(20).max(200).optional().nullable(),
  bloodPressureDia: z.coerce.number().int().min(10).max(150).optional().nullable(),
  sedationScore: z.enum([
    'normal_alert',
    'mild_somnolence',
    'deep_stupor',
    'unresponsive',
  ]),
  medicationAdministered: z.string().optional().nullable(),
  eegBackground: z.enum([
    'normal',
    'mildly_abnormal',
    'discontinuous',
    'burst_suppression',
    'isoelectric',
    'not_available',
  ]).default('not_available'),
  nurseNotes: z.string().optional().nullable(),
});

export function registerNeonatalSeizuresRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  function fetchFullEpisode(id: number) {
    const episode = db
      .prepare(
        `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
           FROM neonatal_seizures_episodes e
           JOIN patients p ON p.id = e.patient_id
           LEFT JOIN users u ON u.id = e.created_by
          WHERE e.id = ?`
      )
      .get(id) as any;
    if (!episode) return null;

    const flowsheet = db
      .prepare(
        `SELECT l.*, u.full_name as recorded_by_name
           FROM neonatal_seizures_flowsheet_logs l
           LEFT JOIN users u ON l.recorded_by = u.id
          WHERE l.episode_id = ?
          ORDER BY l.recorded_at ASC, l.id ASC`
      )
      .all(id) as any[];

    const evaluation = evaluateNeonatalSeizures({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      postnatalAgeDays: episode.postnatal_age_days,
      currentWeightKg: episode.current_weight_kg,
      seizureSemiology: episode.seizure_semiology,
      seizureDurationCategory: episode.seizure_duration_category,
      suspectedEtiology: episode.suspected_etiology,
      bloodGlucoseMgDl: episode.blood_glucose_mg_dl,
      ionizedCalciumMmolL: episode.ionized_calcium_mmol_l,
      serumMagnesiumMgDl: episode.serum_magnesium_mg_dl,
      sodiumMeqL: episode.sodium_meq_l,
      cumulativePhenobarbitalMgKg: episode.cumulative_phenobarbital_mg_kg,
      secondLineGiven: Boolean(episode.second_line_given),
      pyridoxineTrialDone: Boolean(episode.pyridoxine_trial_done),
    });

    return { episode, flowsheet, evaluation };
  }

  // 1. Evaluate Preview
  app.post('/api/neonatal-seizures/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        gestationalAgeWeeks: z.coerce.number().default(38),
        postnatalAgeDays: z.coerce.number().default(2),
        currentWeightKg: z.coerce.number().default(3.0),
        seizureSemiology: z.enum([
          'clonic',
          'tonic',
          'myoclonic',
          'autonomic',
          'subtle',
          'electrographic_only',
        ]).default('clonic'),
        seizureDurationCategory: z.enum([
          'isolated_brief',
          'recurrent_cluster',
          'status_epilepticus',
        ]).default('recurrent_cluster'),
        suspectedEtiology: z.enum([
          'hie',
          'cns_infection',
          'stroke_thrombosis',
          'ich',
          'inborn_metabolism',
          'hypoglycemia',
          'hypocalcemia',
          'benign_familial',
          'unknown',
        ]).default('hie'),
        bloodGlucoseMgDl: z.coerce.number().optional().nullable(),
        ionizedCalciumMmolL: z.coerce.number().optional().nullable(),
        serumMagnesiumMgDl: z.coerce.number().optional().nullable(),
        sodiumMeqL: z.coerce.number().optional().nullable(),
        cumulativePhenobarbitalMgKg: z.coerce.number().default(0),
        secondLineGiven: z.boolean().default(false),
        pyridoxineTrialDone: z.boolean().default(false),
      }),
      req.body
    );

    const evaluation = evaluateNeonatalSeizures({
      gestationalAgeWeeks: body.gestationalAgeWeeks,
      postnatalAgeDays: body.postnatalAgeDays,
      currentWeightKg: body.currentWeightKg,
      seizureSemiology: body.seizureSemiology as NeonatalSeizureSemiology,
      seizureDurationCategory: body.seizureDurationCategory as NeonatalSeizureDuration,
      suspectedEtiology: body.suspectedEtiology as NeonatalSeizureEtiology,
      bloodGlucoseMgDl: body.bloodGlucoseMgDl,
      ionizedCalciumMmolL: body.ionizedCalciumMmolL,
      serumMagnesiumMgDl: body.serumMagnesiumMgDl,
      sodiumMeqL: body.sodiumMeqL,
      cumulativePhenobarbitalMgKg: body.cumulativePhenobarbitalMgKg,
      secondLineGiven: body.secondLineGiven,
      pyridoxineTrialDone: body.pyridoxineTrialDone,
    });

    return { evaluation };
  });

  // 2. List Episodes (supports ?patientId= query or all)
  app.get('/api/neonatal-seizures/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM neonatal_seizures_episodes e
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
             FROM neonatal_seizures_episodes e
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
    '/api/neonatal-seizures/patient/:patientId',
    async (req) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number(req.params.patientId);
      const episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM neonatal_seizures_episodes e
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
  app.get<{ Params: { id: string } }>('/api/neonatal-seizures/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number(req.params.id);
    const data = fetchFullEpisode(id);
    if (!data) throw notFound('Neonatal seizure episode not found');
    return data;
  });

  // 4. Create Episode
  app.post('/api/neonatal-seizures/episodes', async (req) => {
    const user = assertCanManageSeizures(req);
    const body = parse(neonatalSeizuresEpisodeSchema, req.body);

    const episodeNumber = `NSZ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const info = db
      .prepare(
        `INSERT INTO neonatal_seizures_episodes (
           patient_id, episode_number, diagnosis_datetime, gestational_age_weeks, postnatal_age_days, current_weight_kg,
           seizure_semiology, seizure_duration_category, suspected_etiology, blood_glucose_mg_dl, ionized_calcium_mmol_l,
           serum_magnesium_mg_dl, sodium_meq_l, first_line_phenobarbital_given, cumulative_phenobarbital_mg_kg,
           second_line_anticonvulsant, second_line_given, pyridoxine_trial_done, pyridoxine_responsive,
           respiratory_support_status, status, clinical_summary, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.patientId,
        episodeNumber,
        body.diagnosisDatetime,
        body.gestationalAgeWeeks,
        body.postnatalAgeDays,
        body.currentWeightKg,
        body.seizureSemiology,
        body.seizureDurationCategory,
        body.suspectedEtiology,
        body.bloodGlucoseMgDl ?? null,
        body.ionizedCalciumMmolL ?? null,
        body.serumMagnesiumMgDl ?? null,
        body.sodiumMeqL ?? null,
        body.firstLinePhenobarbitalGiven ? 1 : 0,
        body.cumulativePhenobarbitalMgKg,
        body.secondLineAnticonvulsant ?? null,
        body.secondLineGiven ? 1 : 0,
        body.pyridoxineTrialDone ? 1 : 0,
        body.pyridoxineResponsive ? 1 : 0,
        body.respiratorySupportStatus,
        body.status,
        body.clinicalSummary ?? null,
        user.id
      );

    const episodeId = Number(info.lastInsertRowid);
    audit(db, {
      actorId: user.id,
      action: 'neonatal_seizures.create',
      entity: 'neonatal_seizures_episodes',
      entityId: episodeId,
      detail: { patientId: body.patientId, episodeNumber },
    });

    const full = fetchFullEpisode(episodeId);
    return { episode: full?.episode, id: episodeId, episodeNumber, ok: true };
  });

  // 5. Update Episode
  app.put<{ Params: { id: string } }>('/api/neonatal-seizures/episodes/:id', async (req) => {
    const user = assertCanManageSeizures(req);
    const episodeId = Number(req.params.id);
    const body = parse(neonatalSeizuresEpisodeSchema.partial(), req.body);

    const existing = db
      .prepare('SELECT * FROM neonatal_seizures_episodes WHERE id = ?')
      .get(episodeId) as any;
    if (!existing) throw notFound('Neonatal seizure episode not found');

    db.prepare(
      `UPDATE neonatal_seizures_episodes
          SET gestational_age_weeks = COALESCE(?, gestational_age_weeks),
              postnatal_age_days = COALESCE(?, postnatal_age_days),
              current_weight_kg = COALESCE(?, current_weight_kg),
              seizure_semiology = COALESCE(?, seizure_semiology),
              seizure_duration_category = COALESCE(?, seizure_duration_category),
              suspected_etiology = COALESCE(?, suspected_etiology),
              blood_glucose_mg_dl = COALESCE(?, blood_glucose_mg_dl),
              ionized_calcium_mmol_l = COALESCE(?, ionized_calcium_mmol_l),
              serum_magnesium_mg_dl = COALESCE(?, serum_magnesium_mg_dl),
              sodium_meq_l = COALESCE(?, sodium_meq_l),
              first_line_phenobarbital_given = COALESCE(?, first_line_phenobarbital_given),
              cumulative_phenobarbital_mg_kg = COALESCE(?, cumulative_phenobarbital_mg_kg),
              second_line_anticonvulsant = COALESCE(?, second_line_anticonvulsant),
              second_line_given = COALESCE(?, second_line_given),
              pyridoxine_trial_done = COALESCE(?, pyridoxine_trial_done),
              pyridoxine_responsive = COALESCE(?, pyridoxine_responsive),
              respiratory_support_status = COALESCE(?, respiratory_support_status),
              status = COALESCE(?, status),
              clinical_summary = COALESCE(?, clinical_summary),
              updated_at = datetime('now')
        WHERE id = ?`
    ).run(
      body.gestationalAgeWeeks ?? null,
      body.postnatalAgeDays ?? null,
      body.currentWeightKg ?? null,
      body.seizureSemiology ?? null,
      body.seizureDurationCategory ?? null,
      body.suspectedEtiology ?? null,
      body.bloodGlucoseMgDl ?? null,
      body.ionizedCalciumMmolL ?? null,
      body.serumMagnesiumMgDl ?? null,
      body.sodiumMeqL ?? null,
      body.firstLinePhenobarbitalGiven !== undefined ? (body.firstLinePhenobarbitalGiven ? 1 : 0) : null,
      body.cumulativePhenobarbitalMgKg ?? null,
      body.secondLineAnticonvulsant ?? null,
      body.secondLineGiven !== undefined ? (body.secondLineGiven ? 1 : 0) : null,
      body.pyridoxineTrialDone !== undefined ? (body.pyridoxineTrialDone ? 1 : 0) : null,
      body.pyridoxineResponsive !== undefined ? (body.pyridoxineResponsive ? 1 : 0) : null,
      body.respiratorySupportStatus ?? null,
      body.status ?? null,
      body.clinicalSummary ?? null,
      episodeId
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_seizures.update',
      entity: 'neonatal_seizures_episodes',
      entityId: episodeId,
      detail: { patientId: existing.patient_id },
    });

    const full = fetchFullEpisode(episodeId);
    return { episode: full?.episode, ok: true };
  });

  // 6. Update Status
  app.patch<{ Params: { id: string } }>(
    '/api/neonatal-seizures/episodes/:id/status',
    async (req) => {
      const user = assertCanManageSeizures(req);
      const episodeId = Number(req.params.id);
      const { status } = parse(
        z.object({ status: z.enum(['active', 'stabilized', 'resolved', 'transferred']) }),
        req.body
      );

      const existing = db
        .prepare('SELECT patient_id FROM neonatal_seizures_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('Episode not found');

      db.prepare(
        "UPDATE neonatal_seizures_episodes SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(status, episodeId);

      audit(db, {
        actorId: user.id,
        action: 'neonatal_seizures.status_change',
        entity: 'neonatal_seizures_episodes',
        entityId: episodeId,
        detail: { patientId: existing.patient_id, status },
      });

      const full = fetchFullEpisode(episodeId);
      return { episode: full?.episode, ok: true };
    }
  );

  // 7. Delete Episode (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/neonatal-seizures/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors can delete neonatal seizure episodes');
    }
    const episodeId = Number(req.params.id);
    const existing = db
      .prepare('SELECT patient_id FROM neonatal_seizures_episodes WHERE id = ?')
      .get(episodeId) as any;
    if (!existing) throw notFound('Episode not found');

    db.prepare('DELETE FROM neonatal_seizures_episodes WHERE id = ?').run(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_seizures.delete',
      entity: 'neonatal_seizures_episodes',
      entityId: episodeId,
      detail: { patientId: existing.patient_id },
    });

    return { success: true, ok: true };
  });

  // 8. Add Flowsheet Log
  app.post<{ Params: { id: string } }>(
    '/api/neonatal-seizures/episodes/:id/flowsheet',
    async (req) => {
      const user = assertCanManageSeizures(req);
      const episodeId = Number(req.params.id);
      const body = parse(flowsheetLogSchema, req.body);

      const existing = db
        .prepare('SELECT patient_id FROM neonatal_seizures_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('Episode not found');

      const info = db
        .prepare(
          `INSERT INTO neonatal_seizures_flowsheet_logs (
             episode_id, recorded_at, seizure_count_past_hour, current_seizure_state,
             heart_rate_bpm, respiratory_rate_bpm, spo2_percent, blood_pressure_sys,
             blood_pressure_dia, sedation_score, medication_administered, eeg_background,
             nurse_notes, recorded_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          episodeId,
          body.recordedAt,
          body.seizureCountPastHour,
          body.currentSeizureState,
          body.heartRateBpm ?? null,
          body.respiratoryRateBpm ?? null,
          body.spo2Percent ?? null,
          body.bloodPressureSys ?? null,
          body.bloodPressureDia ?? null,
          body.sedationScore,
          body.medicationAdministered ?? null,
          body.eegBackground,
          body.nurseNotes ?? null,
          user.id
        );

      const logId = Number(info.lastInsertRowid);
      audit(db, {
        actorId: user.id,
        action: 'neonatal_seizures.flowsheet_add',
        entity: 'neonatal_seizures_flowsheet_logs',
        entityId: logId,
        detail: { episodeId, patientId: existing.patient_id },
      });

      const log = db
        .prepare(
          `SELECT l.*, u.full_name as recorded_by_name
             FROM neonatal_seizures_flowsheet_logs l
             LEFT JOIN users u ON l.recorded_by = u.id
            WHERE l.id = ?`
        )
        .get(logId);

      return { flowsheetLog: log, id: logId, ok: true };
    }
  );

  // 9. Delete Flowsheet Log
  app.delete<{ Params: { id: string; logId: string } }>(
    '/api/neonatal-seizures/episodes/:id/flowsheet/:logId',
    async (req) => {
      const user = assertCanManageSeizures(req);
      const episodeId = Number(req.params.id);
      const logId = Number(req.params.logId);

      const existing = db
        .prepare(
          `SELECT l.id, e.patient_id
             FROM neonatal_seizures_flowsheet_logs l
             JOIN neonatal_seizures_episodes e ON l.episode_id = e.id
            WHERE l.id = ? AND l.episode_id = ?`
        )
        .get(logId, episodeId) as any;
      if (!existing) throw notFound('Flowsheet log not found');

      db.prepare('DELETE FROM neonatal_seizures_flowsheet_logs WHERE id = ?').run(logId);

      audit(db, {
        actorId: user.id,
        action: 'neonatal_seizures.flowsheet_delete',
        entity: 'neonatal_seizures_flowsheet_logs',
        entityId: logId,
        detail: { episodeId, patientId: existing.patient_id },
      });

      return { success: true, ok: true };
    }
  );
}
