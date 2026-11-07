import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateMwcas,
  evaluatePediatricAsthmaStatus,
} from '../../web/src/pediatricAsthmaStatusEngine.js';

function assertCanManagePediatricAsthma(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical pediatricians, emergency physicians and PICU nurses can manage status asthmaticus records');
  }
  return user;
}

export const pediatricAsthmaStatusEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  onsetDatetime: z.string().min(1, 'Onset datetime is required'),
  ageMonths: z.number().int().min(1).max(216),
  weightKg: z.number().min(2.5).max(120.0),
  spo2RoomAirPercent: z.number().min(40).max(100),
  wheezingScore: z.number().int().min(0).max(2),
  retractionsScore: z.number().int().min(0).max(2),
  airEntryScore: z.number().int().min(0).max(2),
  mentalStateScore: z.number().int().min(0).max(2),
  tier1ContinuousAlbuterol: z.boolean().default(true),
  tier1Ipratropium: z.boolean().default(true),
  tier1SystemicSteroids: z.boolean().default(true),
  tier2IvMagnesium: z.boolean().default(false),
  tier3IvTerbutaline: z.boolean().default(false),
  tier4RespiratorySupport: z.enum([
    'none',
    'hfnc',
    'bipap_nippv',
    'heliox',
    'invasive_mechanical_ventilation',
  ]).default('none'),
  vbgPh: z.number().min(6.7).max(7.8).nullable().optional(),
  vbgPco2Mmhg: z.number().min(10).max(150).nullable().optional(),
  status: z.enum([
    'acute_ed_treatment',
    'picu_monitoring',
    'stepdown_ward',
    'discharged_resolved',
  ]).default('acute_ed_treatment'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const pediatricAsthmaStatusFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromTriage: z.number().int().min(0).default(0),
  respiratoryRate: z.number().int().min(10).max(120),
  heartRate: z.number().int().min(40).max(240),
  spo2Percent: z.number().min(40).max(100),
  fio2Percent: z.number().min(21).max(100).default(21),
  spo2Score: z.number().int().min(0).max(2).default(0),
  wheezingScore: z.number().int().min(0).max(2),
  retractionsScore: z.number().int().min(0).max(2),
  airEntryScore: z.number().int().min(0).max(2),
  mentalStateScore: z.number().int().min(0).max(2),
  albuterolRateMgHr: z.number().min(0).max(30).nullable().optional(),
  terbutalineRateMcgKgMin: z.number().min(0).max(10).nullable().optional(),
  bipapSettings: z.string().max(200).nullable().optional(),
  vbgPh: z.number().min(6.7).max(7.8).nullable().optional(),
  vbgPco2Mmhg: z.number().min(10).max(150).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerPediatricAsthmaStatusRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Calculator Endpoint
  app.post('/api/pediatric-asthma/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(pediatricAsthmaStatusEpisodeSchema.partial(), req.body);

    const evalResult = evaluatePediatricAsthmaStatus({
      ageMonths: body.ageMonths ?? 48,
      weightKg: body.weightKg ?? 16.0,
      spo2RoomAirPercent: body.spo2RoomAirPercent ?? 91,
      wheezingScore: body.wheezingScore ?? 1,
      retractionsScore: body.retractionsScore ?? 2,
      airEntryScore: body.airEntryScore ?? 1,
      mentalStateScore: body.mentalStateScore ?? 1,
      vbgPh: body.vbgPh ?? undefined,
      vbgPco2Mmhg: body.vbgPco2Mmhg ?? undefined,
      currentAlbuterolMgHr: undefined,
      currentTerbutalineMcgKgMin: undefined,
    });

    return { evalResult };
  });

  // 2. Create Pediatric Asthma Episode
  app.post('/api/pediatric-asthma/episodes', async (req, reply) => {
    const user = assertCanManagePediatricAsthma(req);
    const data = parse(pediatricAsthmaStatusEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    let spo2Sc = 0;
    if (data.spo2RoomAirPercent < 92) spo2Sc = 2;
    else if (data.spo2RoomAirPercent <= 95) spo2Sc = 1;

    const mwcas = calculateMwcas({
      spo2Score: spo2Sc,
      wheezingScore: data.wheezingScore,
      retractionsScore: data.retractionsScore,
      airEntryScore: data.airEntryScore,
      mentalStateScore: data.mentalStateScore,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `ASTHMA-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_asthma_status_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        age_months, weight_kg, spo2_room_air_percent,
        wheezing_score, retractions_score, air_entry_score, mental_state_score,
        total_mwcas_score, severity_tier,
        tier1_continuous_albuterol, tier1_ipratropium, tier1_systemic_steroids,
        tier2_iv_magnesium, tier3_iv_terbutaline, tier4_respiratory_support,
        vbg_ph, vbg_pco2_mmhg, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.ageMonths,
      data.weightKg,
      data.spo2RoomAirPercent,
      data.wheezingScore,
      data.retractionsScore,
      data.airEntryScore,
      data.mentalStateScore,
      mwcas.totalScore,
      mwcas.severityTier,
      data.tier1ContinuousAlbuterol ? 1 : 0,
      data.tier1Ipratropium ? 1 : 0,
      data.tier1SystemicSteroids ? 1 : 0,
      data.tier2IvMagnesium ? 1 : 0,
      data.tier3IvTerbutaline ? 1 : 0,
      data.tier4RespiratorySupport,
      data.vbgPh ?? null,
      data.vbgPco2Mmhg ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM pediatric_asthma_status_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_asthma.episode_create',
      entity: 'pediatric_asthma_status_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        totalMwcasScore: mwcas.totalScore,
        severityTier: mwcas.severityTier,
        tier4RespiratorySupport: data.tier4RespiratorySupport,
      },
    });

    reply.status(201);
    return { episode: created };
  });

  // 3. List Episodes
  app.get('/api/pediatric-asthma/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_asthma_status_episodes e
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

    query += ' ORDER BY e.onset_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/pediatric-asthma/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_asthma_status_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric Status Asthmaticus episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM pediatric_asthma_status_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.asthma_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluatePediatricAsthmaStatus({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      spo2RoomAirPercent: episode.spo2_room_air_percent,
      wheezingScore: episode.wheezing_score,
      retractionsScore: episode.retractions_score,
      airEntryScore: episode.air_entry_score,
      mentalStateScore: episode.mental_state_score,
      vbgPh: episode.vbg_ph ?? undefined,
      vbgPco2Mmhg: episode.vbg_pco2_mmhg ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-asthma/episodes/:id', async (req) => {
    const user = assertCanManagePediatricAsthma(req);
    const { id } = req.params as { id: string };
    const patch = parse(pediatricAsthmaStatusEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM pediatric_asthma_status_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric Status Asthmaticus episode not found');

    const wheezing = patch.wheezingScore ?? existing.wheezing_score;
    const retractions = patch.retractionsScore ?? existing.retractions_score;
    const airEntry = patch.airEntryScore ?? existing.air_entry_score;
    const mental = patch.mentalStateScore ?? existing.mental_state_score;
    const spo2 = patch.spo2RoomAirPercent ?? existing.spo2_room_air_percent;

    let spo2Sc = 0;
    if (spo2 < 92) spo2Sc = 2;
    else if (spo2 <= 95) spo2Sc = 1;

    const mwcas = calculateMwcas({
      spo2Score: spo2Sc,
      wheezingScore: wheezing,
      retractionsScore: retractions,
      airEntryScore: airEntry,
      mentalStateScore: mental,
    });

    db.prepare(`
      UPDATE pediatric_asthma_status_episodes SET
        spo2_room_air_percent = ?,
        wheezing_score = ?,
        retractions_score = ?,
        air_entry_score = ?,
        mental_state_score = ?,
        total_mwcas_score = ?,
        severity_tier = ?,
        tier1_continuous_albuterol = COALESCE(?, tier1_continuous_albuterol),
        tier1_ipratropium = COALESCE(?, tier1_ipratropium),
        tier1_systemic_steroids = COALESCE(?, tier1_systemic_steroids),
        tier2_iv_magnesium = COALESCE(?, tier2_iv_magnesium),
        tier3_iv_terbutaline = COALESCE(?, tier3_iv_terbutaline),
        tier4_respiratory_support = COALESCE(?, tier4_respiratory_support),
        vbg_ph = COALESCE(?, vbg_ph),
        vbg_pco2_mmhg = COALESCE(?, vbg_pco2_mmhg),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      spo2,
      wheezing,
      retractions,
      airEntry,
      mental,
      mwcas.totalScore,
      mwcas.severityTier,
      patch.tier1ContinuousAlbuterol !== undefined ? (patch.tier1ContinuousAlbuterol ? 1 : 0) : null,
      patch.tier1Ipratropium !== undefined ? (patch.tier1Ipratropium ? 1 : 0) : null,
      patch.tier1SystemicSteroids !== undefined ? (patch.tier1SystemicSteroids ? 1 : 0) : null,
      patch.tier2IvMagnesium !== undefined ? (patch.tier2IvMagnesium ? 1 : 0) : null,
      patch.tier3IvTerbutaline !== undefined ? (patch.tier3IvTerbutaline ? 1 : 0) : null,
      patch.tier4RespiratorySupport ?? null,
      patch.vbgPh ?? null,
      patch.vbgPco2Mmhg ?? null,
      patch.status ?? null,
      patch.clinicalNotes ?? null,
      Number(id),
    );

    const updated = db.prepare('SELECT * FROM pediatric_asthma_status_episodes WHERE id = ?').get(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_asthma.episode_update',
      entity: 'pediatric_asthma_status_episodes',
      entityId: Number(id),
      detail: patch,
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-asthma/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete status asthmaticus episodes');
    }
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM pediatric_asthma_status_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric Status Asthmaticus episode not found');

    db.prepare('DELETE FROM pediatric_asthma_status_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_asthma.episode_delete',
      entity: 'pediatric_asthma_status_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Observation Log
  app.post('/api/pediatric-asthma/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricAsthma(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricAsthmaStatusFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM pediatric_asthma_status_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric Status Asthmaticus episode not found');

    const mwcas = calculateMwcas({
      spo2Score: data.spo2Score,
      wheezingScore: data.wheezingScore,
      retractionsScore: data.retractionsScore,
      airEntryScore: data.airEntryScore,
      mentalStateScore: data.mentalStateScore,
    });

    const info = db.prepare(`
      INSERT INTO pediatric_asthma_status_flowsheet_logs (
        asthma_episode_id, patient_id, log_datetime, minutes_from_triage,
        respiratory_rate, heart_rate, spo2_percent, fio2_percent,
        total_mwcas_score, albuterol_rate_mg_hr, terbutaline_rate_mcg_kg_min,
        bipap_settings, vbg_ph, vbg_pco2_mmhg, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.minutesFromTriage,
      data.respiratoryRate,
      data.heartRate,
      data.spo2Percent,
      data.fio2Percent,
      mwcas.totalScore,
      data.albuterolRateMgHr ?? null,
      data.terbutalineRateMcgKgMin ?? null,
      data.bipapSettings ?? null,
      data.vbgPh ?? null,
      data.vbgPco2Mmhg ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_asthma.flowsheet_log',
      entity: 'pediatric_asthma_status_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), totalMwcasScore: mwcas.totalScore, rr: data.respiratoryRate, spo2: data.spo2Percent },
    });

    reply.status(201);
    return { logId: info.lastInsertRowid, totalMwcasScore: mwcas.totalScore };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-asthma/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete status asthmaticus flowsheet logs');
    }
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM pediatric_asthma_status_flowsheet_logs WHERE id = ? AND asthma_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_asthma_status_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_asthma.flowsheet_delete',
      entity: 'pediatric_asthma_status_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
