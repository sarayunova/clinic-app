import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricAcuteLiverFailure,
  type PalfEtiology,
  type HepaticEncephalopathyGrade,
} from '../../web/src/pediatricAcuteLiverFailureEngine.js';

function assertCanManagePalf(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric acute liver failure protocols');
  }
  return user;
}

const palfEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  diagnosisDatetime: z.string().min(1),
  ageMonths: z.coerce.number().int().min(0).max(240),
  weightKg: z.coerce.number().min(1.0).max(120.0),
  suspectedEtiology: z.enum([
    'acetaminophen_toxicity',
    'viral_hepatitis',
    'autoimmune_hepatitis',
    'metabolic_wilson_galactosemia',
    'ischemic_shock',
    'drug_induced_dili',
    'gestational_neonatal_hemochromatosis',
    'indeterminate',
  ]),
  encephalopathyStage: z.coerce.number().int().min(0).max(4).default(0),
  inr: z.coerce.number().min(0.8).max(25.0),
  totalBilirubinMgDl: z.coerce.number().min(0.1).max(80.0),
  directBilirubinMgDl: z.coerce.number().min(0.0).max(50.0).optional().nullable(),
  altUL: z.coerce.number().min(5).max(30000),
  astUL: z.coerce.number().min(5).max(30000),
  serumAmmoniaUmolL: z.coerce.number().min(5).max(2000).optional().nullable(),
  bloodGlucoseMgDl: z.coerce.number().min(0).max(800),
  serumSodiumMeqL: z.coerce.number().min(100).max(180).optional().nullable(),
  serumCreatinineMgDl: z.coerce.number().min(0.1).max(15.0).optional().nullable(),
  hasCerebralEdema: z.boolean().default(false),
  hypertonicSaline3pctActive: z.boolean().default(false),
  mannitolAdministered: z.boolean().default(false),
  nacInfusionActive: z.boolean().default(false),
  lactuloseActive: z.boolean().default(false),
  transplantCenterContacted: z.boolean().default(false),
  status: z.enum(['active', 'stabilized', 'resolved', 'transferred']).default('active'),
  clinicalSummary: z.string().optional().nullable(),
});

const palfFlowsheetLogSchema = z.object({
  recordedAt: z.string().min(1),
  encephalopathyStage: z.coerce.number().int().min(0).max(4),
  pupilReactivity: z.enum(['brisk_equal', 'sluggish', 'asymmetric', 'fixed_dilated']),
  meanArterialPressureMmhg: z.coerce.number().min(20).max(180).optional().nullable(),
  heartRateBpm: z.coerce.number().int().min(30).max(250).optional().nullable(),
  gcsScore: z.coerce.number().int().min(3).max(15).optional().nullable(),
  bloodGlucoseMgDl: z.coerce.number().min(0).max(800).optional().nullable(),
  serumSodiumMeqL: z.coerce.number().min(100).max(180).optional().nullable(),
  serumAmmoniaUmolL: z.coerce.number().min(5).max(2000).optional().nullable(),
  dailyStoolCount: z.coerce.number().int().min(0).max(20).default(0),
  icpMonitoringNotes: z.string().optional().nullable(),
  nurseNotes: z.string().optional().nullable(),
});

export function registerPediatricAcuteLiverFailureRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  function fetchFullEpisode(id: number) {
    const episode = db
      .prepare(
        `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
           FROM pediatric_acute_liver_failure_episodes e
           JOIN patients p ON p.id = e.patient_id
           LEFT JOIN users u ON u.id = e.created_by
          WHERE e.id = ?`
      )
      .get(id) as any;
    if (!episode) return null;

    const flowsheet = db
      .prepare(
        `SELECT l.*, u.full_name as recorded_by_name
           FROM pediatric_acute_liver_failure_flowsheet_logs l
           LEFT JOIN users u ON l.recorded_by = u.id
          WHERE l.episode_id = ?
          ORDER BY l.recorded_at ASC, l.id ASC`
      )
      .all(id) as any[];

    const evaluation = evaluatePediatricAcuteLiverFailure({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      suspectedEtiology: episode.suspected_etiology,
      encephalopathyStage: episode.encephalopathy_stage,
      inr: episode.inr,
      totalBilirubinMgDl: episode.total_bilirubin_mg_dl,
      directBilirubinMgDl: episode.direct_bilirubin_mg_dl,
      altUL: episode.alt_u_l,
      astUL: episode.ast_u_l,
      serumAmmoniaUmolL: episode.serum_ammonia_umol_l,
      bloodGlucoseMgDl: episode.blood_glucose_mg_dl,
      serumSodiumMeqL: episode.serum_sodium_meq_l,
      serumCreatinineMgDl: episode.serum_creatinine_mg_dl,
      hasCerebralEdema: Boolean(episode.has_cerebral_edema),
    });

    return { episode, flowsheet, evaluation };
  }

  // 1. Evaluate Preview
  app.post('/api/pediatric-acute-liver-failure/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        ageMonths: z.coerce.number().default(48),
        weightKg: z.coerce.number().default(16.0),
        suspectedEtiology: z.enum([
          'acetaminophen_toxicity',
          'viral_hepatitis',
          'autoimmune_hepatitis',
          'metabolic_wilson_galactosemia',
          'ischemic_shock',
          'drug_induced_dili',
          'gestational_neonatal_hemochromatosis',
          'indeterminate',
        ]).default('viral_hepatitis'),
        encephalopathyStage: z.coerce.number().int().min(0).max(4).default(1),
        inr: z.coerce.number().default(2.4),
        totalBilirubinMgDl: z.coerce.number().default(12.5),
        directBilirubinMgDl: z.coerce.number().optional().nullable(),
        altUL: z.coerce.number().default(1450),
        astUL: z.coerce.number().default(1620),
        serumAmmoniaUmolL: z.coerce.number().optional().nullable(),
        bloodGlucoseMgDl: z.coerce.number().default(88),
        serumSodiumMeqL: z.coerce.number().optional().nullable(),
        serumCreatinineMgDl: z.coerce.number().optional().nullable(),
        hasCerebralEdema: z.boolean().default(false),
      }),
      req.body
    );

    const evaluation = evaluatePediatricAcuteLiverFailure({
      ageMonths: body.ageMonths,
      weightKg: body.weightKg,
      suspectedEtiology: body.suspectedEtiology as PalfEtiology,
      encephalopathyStage: body.encephalopathyStage as HepaticEncephalopathyGrade,
      inr: body.inr,
      totalBilirubinMgDl: body.totalBilirubinMgDl,
      directBilirubinMgDl: body.directBilirubinMgDl,
      altUL: body.altUL,
      astUL: body.astUL,
      serumAmmoniaUmolL: body.serumAmmoniaUmolL,
      bloodGlucoseMgDl: body.bloodGlucoseMgDl,
      serumSodiumMeqL: body.serumSodiumMeqL,
      serumCreatinineMgDl: body.serumCreatinineMgDl,
      hasCerebralEdema: body.hasCerebralEdema,
    });

    return { evaluation };
  });

  // 2. List Episodes (supports ?patientId= query or all)
  app.get('/api/pediatric-acute-liver-failure/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM pediatric_acute_liver_failure_episodes e
             JOIN patients p ON p.id = e.patient_id
             LEFT JOIN users u ON e.created_by = u.id
            WHERE e.patient_id = ?
            ORDER BY e.diagnosis_datetime DESC, e.id DESC`
        )
        .all(Number(patientId));
    } else {
      episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM pediatric_acute_liver_failure_episodes e
             JOIN patients p ON p.id = e.patient_id
             LEFT JOIN users u ON e.created_by = u.id
            ORDER BY e.diagnosis_datetime DESC, e.id DESC`
        )
        .all();
    }
    return { episodes };
  });

  // 2b. List Episodes for Patient
  app.get<{ Params: { patientId: string } }>(
    '/api/pediatric-acute-liver-failure/patient/:patientId',
    async (req) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number(req.params.patientId);
      const episodes = db
        .prepare(
          `SELECT e.*, p.full_name as patient_name, u.full_name as created_by_name
             FROM pediatric_acute_liver_failure_episodes e
             JOIN patients p ON p.id = e.patient_id
             LEFT JOIN users u ON e.created_by = u.id
            WHERE e.patient_id = ?
            ORDER BY e.diagnosis_datetime DESC, e.id DESC`
        )
        .all(patientId);

      return { episodes };
    }
  );

  // 3. Get Single Episode with Flowsheet and Evaluation
  app.get<{ Params: { id: string } }>(
    '/api/pediatric-acute-liver-failure/episodes/:id',
    async (req) => {
      requirePerm(req, 'patient:read_clinical');
      const id = Number(req.params.id);
      const data = fetchFullEpisode(id);
      if (!data) throw notFound('Pediatric acute liver failure episode not found');
      return data;
    }
  );

  // 4. Create Episode
  app.post('/api/pediatric-acute-liver-failure/episodes', async (req) => {
    const user = assertCanManagePalf(req);
    const body = parse(palfEpisodeSchema, req.body);

    const episodeNumber = `PALF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const info = db
      .prepare(
        `INSERT INTO pediatric_acute_liver_failure_episodes (
           patient_id, episode_number, diagnosis_datetime, age_months, weight_kg,
           suspected_etiology, encephalopathy_stage, inr, total_bilirubin_mg_dl, direct_bilirubin_mg_dl,
           alt_u_l, ast_u_l, serum_ammonia_umol_l, blood_glucose_mg_dl, serum_sodium_meq_l,
           serum_creatinine_mg_dl, has_cerebral_edema, hypertonic_saline_3pct_active,
           mannitol_administered, nac_infusion_active, lactulose_active, transplant_center_contacted,
           status, clinical_summary, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.patientId,
        episodeNumber,
        body.diagnosisDatetime,
        body.ageMonths,
        body.weightKg,
        body.suspectedEtiology,
        body.encephalopathyStage,
        body.inr,
        body.totalBilirubinMgDl,
        body.directBilirubinMgDl ?? null,
        body.altUL,
        body.astUL,
        body.serumAmmoniaUmolL ?? null,
        body.bloodGlucoseMgDl,
        body.serumSodiumMeqL ?? null,
        body.serumCreatinineMgDl ?? null,
        body.hasCerebralEdema ? 1 : 0,
        body.hypertonicSaline3pctActive ? 1 : 0,
        body.mannitolAdministered ? 1 : 0,
        body.nacInfusionActive ? 1 : 0,
        body.lactuloseActive ? 1 : 0,
        body.transplantCenterContacted ? 1 : 0,
        body.status,
        body.clinicalSummary ?? null,
        user.id
      );

    const episodeId = Number(info.lastInsertRowid);
    audit(db, {
      actorId: user.id,
      action: 'pediatric_acute_liver_failure.create',
      entity: 'pediatric_acute_liver_failure_episodes',
      entityId: episodeId,
      detail: { patientId: body.patientId, episodeNumber },
    });

    const full = fetchFullEpisode(episodeId);
    return { episode: full?.episode, id: episodeId, episodeNumber, ok: true };
  });

  // 5. Update Episode
  app.put<{ Params: { id: string } }>(
    '/api/pediatric-acute-liver-failure/episodes/:id',
    async (req) => {
      const user = assertCanManagePalf(req);
      const episodeId = Number(req.params.id);
      const body = parse(palfEpisodeSchema.partial(), req.body);

      const existing = db
        .prepare('SELECT * FROM pediatric_acute_liver_failure_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('PALF episode not found');

      db.prepare(
        `UPDATE pediatric_acute_liver_failure_episodes
            SET age_months = COALESCE(?, age_months),
                weight_kg = COALESCE(?, weight_kg),
                suspected_etiology = COALESCE(?, suspected_etiology),
                encephalopathy_stage = COALESCE(?, encephalopathy_stage),
                inr = COALESCE(?, inr),
                total_bilirubin_mg_dl = COALESCE(?, total_bilirubin_mg_dl),
                direct_bilirubin_mg_dl = COALESCE(?, direct_bilirubin_mg_dl),
                alt_u_l = COALESCE(?, alt_u_l),
                ast_u_l = COALESCE(?, ast_u_l),
                serum_ammonia_umol_l = COALESCE(?, serum_ammonia_umol_l),
                blood_glucose_mg_dl = COALESCE(?, blood_glucose_mg_dl),
                serum_sodium_meq_l = COALESCE(?, serum_sodium_meq_l),
                serum_creatinine_mg_dl = COALESCE(?, serum_creatinine_mg_dl),
                has_cerebral_edema = COALESCE(?, has_cerebral_edema),
                hypertonic_saline_3pct_active = COALESCE(?, hypertonic_saline_3pct_active),
                mannitol_administered = COALESCE(?, mannitol_administered),
                nac_infusion_active = COALESCE(?, nac_infusion_active),
                lactulose_active = COALESCE(?, lactulose_active),
                transplant_center_contacted = COALESCE(?, transplant_center_contacted),
                status = COALESCE(?, status),
                clinical_summary = COALESCE(?, clinical_summary),
                updated_at = datetime('now')
          WHERE id = ?`
      ).run(
        body.ageMonths ?? null,
        body.weightKg ?? null,
        body.suspectedEtiology ?? null,
        body.encephalopathyStage ?? null,
        body.inr ?? null,
        body.totalBilirubinMgDl ?? null,
        body.directBilirubinMgDl ?? null,
        body.altUL ?? null,
        body.astUL ?? null,
        body.serumAmmoniaUmolL ?? null,
        body.bloodGlucoseMgDl ?? null,
        body.serumSodiumMeqL ?? null,
        body.serumCreatinineMgDl ?? null,
        body.hasCerebralEdema !== undefined ? (body.hasCerebralEdema ? 1 : 0) : null,
        body.hypertonicSaline3pctActive !== undefined ? (body.hypertonicSaline3pctActive ? 1 : 0) : null,
        body.mannitolAdministered !== undefined ? (body.mannitolAdministered ? 1 : 0) : null,
        body.nacInfusionActive !== undefined ? (body.nacInfusionActive ? 1 : 0) : null,
        body.lactuloseActive !== undefined ? (body.lactuloseActive ? 1 : 0) : null,
        body.transplantCenterContacted !== undefined ? (body.transplantCenterContacted ? 1 : 0) : null,
        body.status ?? null,
        body.clinicalSummary ?? null,
        episodeId
      );

      audit(db, {
        actorId: user.id,
        action: 'pediatric_acute_liver_failure.update',
        entity: 'pediatric_acute_liver_failure_episodes',
        entityId: episodeId,
        detail: { patientId: existing.patient_id },
      });

      const full = fetchFullEpisode(episodeId);
      return { episode: full?.episode, ok: true };
    }
  );

  // 6. Update Status
  app.patch<{ Params: { id: string } }>(
    '/api/pediatric-acute-liver-failure/episodes/:id/status',
    async (req) => {
      const user = assertCanManagePalf(req);
      const episodeId = Number(req.params.id);
      const { status } = parse(
        z.object({ status: z.enum(['active', 'stabilized', 'resolved', 'transferred']) }),
        req.body
      );

      const existing = db
        .prepare('SELECT patient_id FROM pediatric_acute_liver_failure_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('Episode not found');

      db.prepare(
        "UPDATE pediatric_acute_liver_failure_episodes SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(status, episodeId);

      audit(db, {
        actorId: user.id,
        action: 'pediatric_acute_liver_failure.status_change',
        entity: 'pediatric_acute_liver_failure_episodes',
        entityId: episodeId,
        detail: { patientId: existing.patient_id, status },
      });

      const full = fetchFullEpisode(episodeId);
      return { episode: full?.episode, ok: true };
    }
  );

  // 7. Delete Episode (Doctor only)
  app.delete<{ Params: { id: string } }>(
    '/api/pediatric-acute-liver-failure/episodes/:id',
    async (req) => {
      const user = req.user;
      if (!user || user.role !== 'doctor') {
        throw forbidden('Only doctors can delete pediatric acute liver failure episodes');
      }
      const episodeId = Number(req.params.id);
      const existing = db
        .prepare('SELECT patient_id FROM pediatric_acute_liver_failure_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('Episode not found');

      db.prepare('DELETE FROM pediatric_acute_liver_failure_episodes WHERE id = ?').run(episodeId);

      audit(db, {
        actorId: user.id,
        action: 'pediatric_acute_liver_failure.delete',
        entity: 'pediatric_acute_liver_failure_episodes',
        entityId: episodeId,
        detail: { patientId: existing.patient_id },
      });

      return { success: true, ok: true };
    }
  );

  // 8. Add Flowsheet Log
  app.post<{ Params: { id: string } }>(
    '/api/pediatric-acute-liver-failure/episodes/:id/flowsheet',
    async (req) => {
      const user = assertCanManagePalf(req);
      const episodeId = Number(req.params.id);
      const body = parse(palfFlowsheetLogSchema, req.body);

      const existing = db
        .prepare('SELECT patient_id FROM pediatric_acute_liver_failure_episodes WHERE id = ?')
        .get(episodeId) as any;
      if (!existing) throw notFound('Episode not found');

      const info = db
        .prepare(
          `INSERT INTO pediatric_acute_liver_failure_flowsheet_logs (
             episode_id, recorded_at, encephalopathy_stage, pupil_reactivity,
             mean_arterial_pressure_mmhg, heart_rate_bpm, gcs_score, blood_glucose_mg_dl,
             serum_sodium_meq_l, serum_ammonia_umol_l, daily_stool_count, icp_monitoring_notes,
             nurse_notes, recorded_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          episodeId,
          body.recordedAt,
          body.encephalopathyStage,
          body.pupilReactivity,
          body.meanArterialPressureMmhg ?? null,
          body.heartRateBpm ?? null,
          body.gcsScore ?? null,
          body.bloodGlucoseMgDl ?? null,
          body.serumSodiumMeqL ?? null,
          body.serumAmmoniaUmolL ?? null,
          body.dailyStoolCount,
          body.icpMonitoringNotes ?? null,
          body.nurseNotes ?? null,
          user.id
        );

      const logId = Number(info.lastInsertRowid);
      audit(db, {
        actorId: user.id,
        action: 'pediatric_acute_liver_failure.flowsheet_add',
        entity: 'pediatric_acute_liver_failure_flowsheet_logs',
        entityId: logId,
        detail: { episodeId, patientId: existing.patient_id },
      });

      const log = db
        .prepare(
          `SELECT l.*, u.full_name as recorded_by_name
             FROM pediatric_acute_liver_failure_flowsheet_logs l
             LEFT JOIN users u ON l.recorded_by = u.id
            WHERE l.id = ?`
        )
        .get(logId);

      return { flowsheetLog: log, id: logId, ok: true };
    }
  );

  // 9. Delete Flowsheet Log
  app.delete<{ Params: { id: string; logId: string } }>(
    '/api/pediatric-acute-liver-failure/episodes/:id/flowsheet/:logId',
    async (req) => {
      const user = assertCanManagePalf(req);
      const episodeId = Number(req.params.id);
      const logId = Number(req.params.logId);

      const existing = db
        .prepare(
          `SELECT l.id, e.patient_id
             FROM pediatric_acute_liver_failure_flowsheet_logs l
             JOIN pediatric_acute_liver_failure_episodes e ON l.episode_id = e.id
            WHERE l.id = ? AND l.episode_id = ?`
        )
        .get(logId, episodeId) as any;
      if (!existing) throw notFound('Flowsheet log not found');

      db.prepare('DELETE FROM pediatric_acute_liver_failure_flowsheet_logs WHERE id = ?').run(logId);

      audit(db, {
        actorId: user.id,
        action: 'pediatric_acute_liver_failure.flowsheet_delete',
        entity: 'pediatric_acute_liver_failure_flowsheet_logs',
        entityId: logId,
        detail: { episodeId, patientId: existing.patient_id },
      });

      return { success: true, ok: true };
    }
  );
}
