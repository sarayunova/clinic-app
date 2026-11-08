import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateBishopScore,
  evaluateObstetricPostterm,
  type DatingMethod,
  type CervicalConsistency,
  type CervicalPosition,
  type RecommendedRipeningMethod,
} from '../../web/src/obstetricPosttermEngine.js';

function assertCanManageObstetricPostterm(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only obstetricians, maternal-fetal medicine specialists, and labor nurses can manage post-term pregnancy records');
  }
  return user;
}

export const obstetricPosttermEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  gestationalAgeWeeks: z.number().min(41.0).max(45.0),
  datingMethod: z.enum([
    'first_trimester_ultrasound_crl',
    'early_second_trimester_bpd_fl',
    'reliable_lmp_concordant',
    'uncertain_dating',
  ]),

  amnioticFluidIndexCm: z.number().min(0).max(35.0),
  singleDeepestPocketCm: z.number().min(0).max(15.0),
  estimatedFetalWeightGrams: z.number().min(1000).max(6500).nullable().optional(),
  fetalGrowthPercentile: z.number().min(1).max(99).nullable().optional(),
  nonStressTestResult: z.enum(['reactive', 'non_reactive']).default('reactive'),
  biophysicalProfileScore: z.number().int().min(0).max(10).nullable().optional(),

  cervicalDilationCm: z.number().min(0).max(10),
  cervicalEffacementPct: z.number().int().min(0).max(100),
  fetalStation: z.number().int().min(-3).max(3),
  cervicalConsistency: z.enum(['firm', 'medium', 'soft']),
  cervicalPosition: z.enum(['posterior', 'midposition', 'anterior']),

  priorCesareanSection: z.boolean().default(false),
  status: z.enum([
    'outpatient_surveillance',
    'inpatient_cervical_ripening',
    'oxytocin_labor_induction',
    'cesarean_delivery',
    'postpartum_completed',
  ]).default('inpatient_cervical_ripening'),
  clinicalNotes: z.string().nullable().optional(),
});

export const obstetricPosttermFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromRipeningStart: z.number().min(0).default(0),
  bishopScoreCurrent: z.number().int().min(0).max(13),
  dilationCm: z.number().min(0).max(10),
  effacementPct: z.number().int().min(0).max(100),
  contractionsPer10min: z.number().int().min(0).max(10).default(0),
  fetalHeartRateBpm: z.number().int().min(60).max(240),
  fhrCategory: z.enum(['category_1_normal', 'category_2_indeterminate', 'category_3_abnormal']),
  tachysystolePresent: z.boolean().default(false),
  actionTaken: z.enum([
    'continue_monitoring',
    'oxytocin_initiated',
    'insert_removed_spontaneous_labor',
    'insert_removed_tachysystole_terbutaline',
    'balloon_expelled_ready_amniotomy',
    'emergency_cesarean_transfer',
  ]),
  notes: z.string().nullable().optional(),
});

export function registerObstetricPosttermRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Post-Term & Bishop Evaluation Preview
  app.post('/api/obstetric-postterm/evaluate', async (req) => {
    assertCanManageObstetricPostterm(req);
    const body = req.body as Partial<z.infer<typeof obstetricPosttermEpisodeSchema>>;

    const evalResult = evaluateObstetricPostterm({
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? 41.3,
      datingMethod: (body.datingMethod as DatingMethod) ?? 'first_trimester_ultrasound_crl',
      amnioticFluidIndexCm: body.amnioticFluidIndexCm ?? 6.5,
      singleDeepestPocketCm: body.singleDeepestPocketCm ?? 2.5,
      nonStressTestResult: body.nonStressTestResult ?? 'reactive',
      biophysicalProfileScore: body.biophysicalProfileScore ?? 8,
      estimatedFetalWeightGrams: body.estimatedFetalWeightGrams ?? 3600,
      cervicalDilationCm: body.cervicalDilationCm ?? 1.5,
      cervicalEffacementPct: body.cervicalEffacementPct ?? 40,
      fetalStation: body.fetalStation ?? -2,
      cervicalConsistency: (body.cervicalConsistency as CervicalConsistency) ?? 'firm',
      cervicalPosition: (body.cervicalPosition as CervicalPosition) ?? 'posterior',
      priorCesareanSection: body.priorCesareanSection ?? false,
    });

    return { evalResult };
  });

  // 2. Create Post-Term Episode
  app.post('/api/obstetric-postterm/episodes', async (req, reply) => {
    const user = assertCanManageObstetricPostterm(req);
    const data = parse(obstetricPosttermEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateObstetricPostterm({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      datingMethod: data.datingMethod,
      amnioticFluidIndexCm: data.amnioticFluidIndexCm,
      singleDeepestPocketCm: data.singleDeepestPocketCm,
      nonStressTestResult: data.nonStressTestResult,
      biophysicalProfileScore: data.biophysicalProfileScore ?? undefined,
      estimatedFetalWeightGrams: data.estimatedFetalWeightGrams ?? undefined,
      cervicalDilationCm: data.cervicalDilationCm,
      cervicalEffacementPct: data.cervicalEffacementPct,
      fetalStation: data.fetalStation,
      cervicalConsistency: data.cervicalConsistency,
      cervicalPosition: data.cervicalPosition,
      priorCesareanSection: data.priorCesareanSection,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `POSTTERM-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_postterm_episodes (
        patient_id, admission_id, episode_code, assessment_datetime,
        gestational_age_weeks, postterm_classification, dating_method,
        amniotic_fluid_index_cm, single_deepest_pocket_cm, oligohydramnios_present,
        estimated_fetal_weight_grams, fetal_growth_percentile,
        non_stress_test_result, biophysical_profile_score,
        cervical_dilation_cm, cervical_effacement_pct, fetal_station,
        cervical_consistency, cervical_position, bishop_score_total, cervix_favorable,
        prior_cesarean_section, recommended_ripening_method,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.assessmentDatetime,
      data.gestationalAgeWeeks,
      evalResult.posttermClassification,
      data.datingMethod,
      data.amnioticFluidIndexCm,
      data.singleDeepestPocketCm,
      evalResult.oligohydramniosPresent ? 1 : 0,
      data.estimatedFetalWeightGrams ?? null,
      data.fetalGrowthPercentile ?? null,
      data.nonStressTestResult,
      data.biophysicalProfileScore ?? null,
      data.cervicalDilationCm,
      data.cervicalEffacementPct,
      data.fetalStation,
      data.cervicalConsistency,
      data.cervicalPosition,
      evalResult.bishop.totalScore,
      evalResult.bishop.isFavorable ? 1 : 0,
      data.priorCesareanSection ? 1 : 0,
      evalResult.recommendedRipeningMethod,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_postterm.episode_create',
      entity: 'obstetric_postterm_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, bishop: evalResult.bishop.totalScore },
    });

    const episode = db.prepare('SELECT * FROM obstetric_postterm_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/obstetric-postterm/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const q = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name as patient_name, p.patient_number, p.date_of_birth, u.full_name as consultant_name
      FROM obstetric_postterm_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q.patientId) {
      query += ' AND e.patient_id = ?';
      params.push(Number(q.patientId));
    }
    if (q.status && q.status !== 'all') {
      query += ' AND e.status = ?';
      params.push(q.status);
    }
    query += ' ORDER BY e.created_at DESC';

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail
  app.get('/api/obstetric-postterm/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, p.patient_number, p.date_of_birth, u.full_name as consultant_name
      FROM obstetric_postterm_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric post-term episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_postterm_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.postterm_episode_id = ?
      ORDER BY l.hours_from_ripening_start ASC, l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateObstetricPostterm({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      datingMethod: episode.dating_method,
      amnioticFluidIndexCm: episode.amniotic_fluid_index_cm,
      singleDeepestPocketCm: episode.single_deepest_pocket_cm,
      nonStressTestResult: episode.non_stress_test_result,
      biophysicalProfileScore: episode.biophysical_profile_score ?? undefined,
      estimatedFetalWeightGrams: episode.estimated_fetal_weight_grams ?? undefined,
      cervicalDilationCm: episode.cervical_dilation_cm,
      cervicalEffacementPct: episode.cervical_effacement_pct,
      fetalStation: episode.fetal_station,
      cervicalConsistency: episode.cervical_consistency,
      cervicalPosition: episode.cervical_position,
      priorCesareanSection: Boolean(episode.prior_cesarean_section),
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/obstetric-postterm/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPostterm(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM obstetric_postterm_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric post-term episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE obstetric_postterm_episodes
      SET status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_postterm.episode_update',
      entity: 'obstetric_postterm_episodes',
      entityId: Number(id),
      detail: { nextStatus },
    });

    const updated = db.prepare('SELECT * FROM obstetric_postterm_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-postterm/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete post-term episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM obstetric_postterm_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric post-term episode not found');

    db.prepare('DELETE FROM obstetric_postterm_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_postterm.episode_delete',
      entity: 'obstetric_postterm_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-postterm/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricPostterm(req);
    const { id } = req.params as { id: string };
    const data = parse(obstetricPosttermFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM obstetric_postterm_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric post-term episode not found');

    const stmt = db.prepare(`
      INSERT INTO obstetric_postterm_flowsheet_logs (
        postterm_episode_id, patient_id, log_datetime, hours_from_ripening_start,
        bishop_score_current, dilation_cm, effacement_pct, contractions_per_10min,
        fetal_heart_rate_bpm, fhr_category, tachysystole_present, action_taken,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromRipeningStart,
      data.bishopScoreCurrent,
      data.dilationCm,
      data.effacementPct,
      data.contractionsPer10min,
      data.fetalHeartRateBpm,
      data.fhrCategory,
      data.tachysystolePresent ? 1 : 0,
      data.actionTaken,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_postterm.flowsheet_create',
      entity: 'obstetric_postterm_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), bishop: data.bishopScoreCurrent, action: data.actionTaken },
    });

    reply.status(201);
    return { logId };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-postterm/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete flowsheet logs');
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM obstetric_postterm_flowsheet_logs WHERE id = ? AND postterm_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_postterm_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_postterm.flowsheet_delete',
      entity: 'obstetric_postterm_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
