import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateWestleyScore,
  calculateDexamethasoneDose,
  calculateNebulizedEpinephrineDose,
  evaluatePediatricCroup,
  type DexamethasoneRoute,
} from '../../web/src/pediatricCroupEngine.js';

function assertCanManagePediatricCroup(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only pediatricians, pediatric emergency physicians, and nurses can manage pediatric croup records');
  }
  return user;
}

export const pediatricCroupEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  triageDatetime: z.string().min(1, 'Triage datetime is required'),
  ageMonths: z.number().int().min(1).max(216),
  weightKg: z.number().min(2.0).max(100.0),

  inspiratoryStridorScore: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  retractionsScore: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  airEntryScore: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  cyanosisScore: z.union([z.literal(0), z.literal(4), z.literal(5)]),
  consciousnessScore: z.union([z.literal(0), z.literal(5)]),

  heartRateBpm: z.number().int().min(40).max(250),
  respiratoryRate: z.number().int().min(10).max(100),
  spo2Percent: z.number().min(40.0).max(100.0),
  barkingCoughPresent: z.boolean().default(true),
  hoarsenessPresent: z.boolean().default(true),

  dexamethasoneRoute: z.enum(['oral', 'im', 'iv']).default('oral'),
  dexamethasoneAdministered: z.boolean().default(false),
  epinephrineNebulizationAdministered: z.boolean().default(false),

  status: z.enum([
    'acute_triage_resuscitation',
    'post_nebulization_observation',
    'picu_admission_escalation',
    'discharged_home_stable',
  ]).default('acute_triage_resuscitation'),
  clinicalNotes: z.string().nullable().optional(),
});

export const pediatricCroupFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromTriage: z.number().int().min(0).default(0),
  westleyScoreCurrent: z.number().int().min(0).max(17),
  heartRateBpm: z.number().int().min(40).max(250),
  respiratoryRate: z.number().int().min(10).max(100),
  spo2Percent: z.number().min(40.0).max(100.0),
  stridorAtRest: z.boolean().default(false),
  chestRetractionsSeverity: z.enum([
    'none',
    'mild_subcostal',
    'moderate_intercostal',
    'severe_sternal_indrawing',
  ]),
  interventionGiven: z.enum([
    'none_observation',
    'dexamethasone_oral',
    'dexamethasone_im_iv',
    'nebulized_epinephrine_1',
    'nebulized_epinephrine_repeat',
    'heliox_or_intubation_prep',
  ]),
  notes: z.string().nullable().optional(),
});

export function registerPediatricCroupRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Pediatric Croup Evaluation Preview
  app.post('/api/pediatric-croup/evaluate', async (req) => {
    assertCanManagePediatricCroup(req);
    const body = req.body as Partial<z.infer<typeof pediatricCroupEpisodeSchema>>;

    const evalResult = evaluatePediatricCroup({
      ageMonths: body.ageMonths ?? 24,
      weightKg: body.weightKg ?? 12.0,
      inspiratoryStridorScore: body.inspiratoryStridorScore ?? 1,
      retractionsScore: body.retractionsScore ?? 1,
      airEntryScore: body.airEntryScore ?? 0,
      cyanosisScore: body.cyanosisScore ?? 0,
      consciousnessScore: body.consciousnessScore ?? 0,
      heartRateBpm: body.heartRateBpm ?? 120,
      respiratoryRate: body.respiratoryRate ?? 32,
      spo2Percent: body.spo2Percent ?? 98,
      barkingCoughPresent: body.barkingCoughPresent ?? true,
      hoarsenessPresent: body.hoarsenessPresent ?? true,
    });

    return { evalResult };
  });

  // 2. Create Pediatric Croup Episode
  app.post('/api/pediatric-croup/episodes', async (req, reply) => {
    const user = assertCanManagePediatricCroup(req);
    const data = parse(pediatricCroupEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluatePediatricCroup({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      inspiratoryStridorScore: data.inspiratoryStridorScore,
      retractionsScore: data.retractionsScore,
      airEntryScore: data.airEntryScore,
      cyanosisScore: data.cyanosisScore,
      consciousnessScore: data.consciousnessScore,
      heartRateBpm: data.heartRateBpm,
      respiratoryRate: data.respiratoryRate,
      spo2Percent: data.spo2Percent,
      barkingCoughPresent: data.barkingCoughPresent,
      hoarsenessPresent: data.hoarsenessPresent,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `CROUP-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_croup_episodes (
        patient_id, admission_id, episode_code, triage_datetime,
        age_months, weight_kg,
        inspiratory_stridor_score, retractions_score, air_entry_score,
        cyanosis_score, consciousness_score, westley_croup_score_total,
        croup_severity_tier, heart_rate_bpm, respiratory_rate, spo2_percent,
        barking_cough_present, hoarseness_present,
        dexamethasone_dose_mg, dexamethasone_route, dexamethasone_administered,
        nebulized_epinephrine_indicated, epinephrine_nebulization_dose_ml,
        epinephrine_nebulization_administered, rebound_observation_hours_required,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.triageDatetime,
      data.ageMonths,
      data.weightKg,
      data.inspiratoryStridorScore,
      data.retractionsScore,
      data.airEntryScore,
      data.cyanosisScore,
      data.consciousnessScore,
      evalResult.westley.totalScore,
      evalResult.westley.severityTier,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.barkingCoughPresent ? 1 : 0,
      data.hoarsenessPresent ? 1 : 0,
      evalResult.dexamethasoneDoseMg,
      data.dexamethasoneRoute,
      data.dexamethasoneAdministered ? 1 : 0,
      evalResult.nebulizedEpinephrineIndicated ? 1 : 0,
      evalResult.epinephrineNebulizationDoseMl ?? null,
      data.epinephrineNebulizationAdministered ? 1 : 0,
      evalResult.reboundObservationHoursRequired,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_croup.episode_create',
      entity: 'pediatric_croup_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, score: evalResult.westley.totalScore },
    });

    const episode = db.prepare('SELECT * FROM pediatric_croup_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/pediatric-croup/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const q = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name as patient_name, p.patient_number, p.date_of_birth, u.full_name as consultant_name
      FROM pediatric_croup_episodes e
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
  app.get('/api/pediatric-croup/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, p.patient_number, p.date_of_birth, u.full_name as consultant_name
      FROM pediatric_croup_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric croup episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_croup_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.croup_episode_id = ?
      ORDER BY l.minutes_from_triage ASC, l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluatePediatricCroup({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      inspiratoryStridorScore: episode.inspiratory_stridor_score,
      retractionsScore: episode.retractions_score,
      airEntryScore: episode.air_entry_score,
      cyanosisScore: episode.cyanosis_score,
      consciousnessScore: episode.consciousness_score,
      heartRateBpm: episode.heart_rate_bpm,
      respiratoryRate: episode.respiratory_rate,
      spo2Percent: episode.spo2_percent,
      barkingCoughPresent: Boolean(episode.barking_cough_present),
      hoarsenessPresent: Boolean(episode.hoarseness_present),
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-croup/episodes/:id', async (req) => {
    const user = assertCanManagePediatricCroup(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM pediatric_croup_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric croup episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE pediatric_croup_episodes
      SET status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_croup.episode_update',
      entity: 'pediatric_croup_episodes',
      entityId: Number(id),
      detail: { nextStatus },
    });

    const updated = db.prepare('SELECT * FROM pediatric_croup_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-croup/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete pediatric croup episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM pediatric_croup_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric croup episode not found');

    db.prepare('DELETE FROM pediatric_croup_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_croup.episode_delete',
      entity: 'pediatric_croup_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-croup/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricCroup(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricCroupFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM pediatric_croup_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric croup episode not found');

    const stmt = db.prepare(`
      INSERT INTO pediatric_croup_flowsheet_logs (
        croup_episode_id, patient_id, log_datetime, minutes_from_triage,
        westley_score_current, heart_rate_bpm, respiratory_rate, spo2_percent,
        stridor_at_rest, chest_retractions_severity, intervention_given,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.minutesFromTriage,
      data.westleyScoreCurrent,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.stridorAtRest ? 1 : 0,
      data.chestRetractionsSeverity,
      data.interventionGiven,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_croup.flowsheet_create',
      entity: 'pediatric_croup_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), score: data.westleyScoreCurrent, intervention: data.interventionGiven },
    });

    reply.status(201);
    return { logId };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-croup/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete flowsheet logs');
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM pediatric_croup_flowsheet_logs WHERE id = ? AND croup_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_croup_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_croup.flowsheet_delete',
      entity: 'pediatric_croup_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
