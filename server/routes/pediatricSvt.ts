import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateAdenosineDoses,
  calculateCardioversionJoules,
  evaluatePediatricSvt,
  type QrsMorphology,
  type HemodynamicStability,
  type VagalManeuverType,
  type MaintenanceAntiarrhythmic,
} from '../../web/src/pediatricSvtEngine.js';

function assertCanManagePediatricSvt(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only pediatricians, emergency physicians, and PICU nurses can manage pediatric SVT records');
  }
  return user;
}

export const pediatricSvtEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  onsetDatetime: z.string().min(1, 'Onset datetime is required'),
  ageMonths: z.number().int().min(0).max(216),
  weightKg: z.number().min(2.0).max(120),

  heartRateBpm: z.number().int().min(100).max(350),
  qrsDurationMs: z.number().int().min(30).max(250),
  qrsMorphology: z.enum([
    'narrow_complex_le_0_09s',
    'wide_complex_aberrancy_gt_0_09s',
  ]),
  rhythmRegularity: z.enum(['regular', 'irregular']),
  pWavesIdentifiable: z.boolean().default(false),

  hemodynamicStability: z.enum([
    'stable_compensated',
    'unstable_decompensated_shock',
  ]),
  signsOfShock: z.enum([
    'poor_perfusion_cap_refill_gt_3s',
    'hypotension',
    'lethargy_altered_mental_status',
    'pulmonary_congestion',
    'none',
  ]).default('none'),

  vagalManeuverAttempted: z.enum([
    'ice_bag_to_face_infant',
    'modified_valsalva_child',
    'none_unstable',
  ]).default('none_unstable'),
  vagalManeuverSuccessful: z.boolean().default(false),

  adenosineFirstDoseGiven: z.boolean().default(false),
  adenosineFirstDoseSuccessful: z.boolean().default(false),
  adenosineSecondDoseGiven: z.boolean().default(false),
  adenosineSecondDoseSuccessful: z.boolean().default(false),

  synchronizedCardioversionDelivered: z.boolean().default(false),
  cardioversionSuccessful: z.boolean().default(false),

  maintenanceAntiarrhythmic: z.enum([
    'none',
    'amiodarone_infusion',
    'procainamide_infusion',
    'esmolol_infusion',
    'oral_propranolol',
  ]).default('none'),

  status: z.enum([
    'acute_svt_resuscitation',
    'converted_sinus_surveillance',
    'refractory_picu_transfer',
    'discharged_maintenance_therapy',
  ]).default('acute_svt_resuscitation'),
  clinicalNotes: z.string().nullable().optional(),
});

export const pediatricSvtFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromTriage: z.number().int().min(0).default(0),
  heartRateBpm: z.number().int().min(30).max(350),
  rhythmState: z.enum([
    'svt_active',
    'sinus_rhythm_restored',
    'sinus_bradycardia',
    'junctional_or_other',
  ]),
  sbpMmhg: z.number().int().min(30).max(250),
  dbpMmhg: z.number().int().min(10).max(150).nullable().optional(),
  capillaryRefillSeconds: z.number().min(0.5).max(10.0),
  mentalStatus: z.enum(['alert_normal', 'irritable', 'lethargic', 'unresponsive']),
  spo2Percent: z.number().min(50).max(100),
  interventionAdministered: z.enum([
    'none',
    'ice_bag_to_face',
    'valsalva',
    'adenosine_dose_1',
    'adenosine_dose_2',
    'synchronized_cardioversion',
    'antiarrhythmic_infusion',
  ]).default('none'),
  notes: z.string().nullable().optional(),
});

export function registerPediatricSvtRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Pediatric SVT Evaluation Preview
  app.post('/api/pediatric-svt/evaluate', async (req) => {
    assertCanManagePediatricSvt(req);
    const body = req.body as Partial<z.infer<typeof pediatricSvtEpisodeSchema>>;

    const evalResult = evaluatePediatricSvt({
      ageMonths: body.ageMonths ?? 8,
      weightKg: body.weightKg ?? 8.5,
      heartRateBpm: body.heartRateBpm ?? 240,
      qrsDurationMs: body.qrsDurationMs ?? 70,
      qrsMorphology: (body.qrsMorphology as QrsMorphology) ?? 'narrow_complex_le_0_09s',
      rhythmRegularity: body.rhythmRegularity ?? 'regular',
      pWavesIdentifiable: body.pWavesIdentifiable ?? false,
      hemodynamicStability: (body.hemodynamicStability as HemodynamicStability) ?? 'stable_compensated',
    });

    return { evalResult };
  });

  // 2. Create Pediatric SVT Episode
  app.post('/api/pediatric-svt/episodes', async (req, reply) => {
    const user = assertCanManagePediatricSvt(req);
    const data = parse(pediatricSvtEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluatePediatricSvt({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      heartRateBpm: data.heartRateBpm,
      qrsDurationMs: data.qrsDurationMs,
      qrsMorphology: data.qrsMorphology,
      rhythmRegularity: data.rhythmRegularity,
      pWavesIdentifiable: data.pWavesIdentifiable,
      hemodynamicStability: data.hemodynamicStability,
      vagalAttempted: data.vagalManeuverAttempted,
      priorAdenosineDosesGiven: data.adenosineSecondDoseGiven ? 2 : data.adenosineFirstDoseGiven ? 1 : 0,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `SVT-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_svt_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        age_months, weight_kg, heart_rate_bpm, qrs_duration_ms, qrs_morphology,
        rhythm_regularity, p_waves_identifiable, svt_confirmed,
        hemodynamic_stability, signs_of_shock,
        vagal_maneuver_attempted, vagal_maneuver_successful,
        adenosine_first_dose_mg, adenosine_first_dose_given, adenosine_first_dose_successful,
        adenosine_second_dose_mg, adenosine_second_dose_given, adenosine_second_dose_successful,
        synchronized_cardioversion_joules, synchronized_cardioversion_delivered, cardioversion_successful,
        maintenance_antiarrhythmic, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.ageMonths,
      data.weightKg,
      data.heartRateBpm,
      data.qrsDurationMs,
      data.qrsMorphology,
      data.rhythmRegularity,
      data.pWavesIdentifiable ? 1 : 0,
      evalResult.svtConfirmed ? 1 : 0,
      data.hemodynamicStability,
      data.signsOfShock,
      data.vagalManeuverAttempted,
      data.vagalManeuverSuccessful ? 1 : 0,
      evalResult.adenosineDose1Mg,
      data.adenosineFirstDoseGiven ? 1 : 0,
      data.adenosineFirstDoseSuccessful ? 1 : 0,
      evalResult.adenosineDose2Mg,
      data.adenosineSecondDoseGiven ? 1 : 0,
      data.adenosineSecondDoseSuccessful ? 1 : 0,
      evalResult.initialCardioversionJoules,
      data.synchronizedCardioversionDelivered ? 1 : 0,
      data.cardioversionSuccessful ? 1 : 0,
      data.maintenanceAntiarrhythmic,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    audit(db, {
      actorId: user.id,
      action: 'pediatric_svt.episode_create',
      entity: 'pediatric_svt_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, heartRateBpm: data.heartRateBpm },
    });

    const created = db.prepare('SELECT * FROM pediatric_svt_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Pediatric SVT Episodes
  app.get('/api/pediatric-svt/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_svt_episodes e
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
  app.get('/api/pediatric-svt/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_svt_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric SVT episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM pediatric_svt_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.svt_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluatePediatricSvt({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      heartRateBpm: episode.heart_rate_bpm,
      qrsDurationMs: episode.qrs_duration_ms,
      qrsMorphology: episode.qrs_morphology,
      rhythmRegularity: episode.rhythm_regularity,
      pWavesIdentifiable: Boolean(episode.p_waves_identifiable),
      hemodynamicStability: episode.hemodynamic_stability,
      vagalAttempted: episode.vagal_maneuver_attempted,
      priorAdenosineDosesGiven: episode.adenosine_second_dose_given ? 2 : episode.adenosine_first_dose_given ? 1 : 0,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update SVT Episode
  app.patch('/api/pediatric-svt/episodes/:id', async (req) => {
    const user = assertCanManagePediatricSvt(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM pediatric_svt_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric SVT episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextAntiarrhythmic = body.maintenanceAntiarrhythmic ?? existing.maintenance_antiarrhythmic;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE pediatric_svt_episodes
      SET status = ?, maintenance_antiarrhythmic = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextAntiarrhythmic, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_svt.episode_update',
      entity: 'pediatric_svt_episodes',
      entityId: Number(id),
      detail: { nextStatus, nextAntiarrhythmic },
    });

    const updated = db.prepare('SELECT * FROM pediatric_svt_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete SVT Episode
  app.delete('/api/pediatric-svt/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete pediatric SVT episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM pediatric_svt_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric SVT episode not found');

    db.prepare('DELETE FROM pediatric_svt_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_svt.episode_delete',
      entity: 'pediatric_svt_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Bedside Flowsheet Log
  app.post('/api/pediatric-svt/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricSvt(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricSvtFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM pediatric_svt_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric SVT episode not found');

    const stmt = db.prepare(`
      INSERT INTO pediatric_svt_flowsheet_logs (
        svt_episode_id, patient_id, log_datetime, minutes_from_triage,
        heart_rate_bpm, rhythm_state, sbp_mmhg, dbp_mmhg,
        capillary_refill_seconds, mental_status, spo2_percent,
        intervention_administered, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.minutesFromTriage,
      data.heartRateBpm,
      data.rhythmState,
      data.sbpMmhg,
      data.dbpMmhg ?? null,
      data.capillaryRefillSeconds,
      data.mentalStatus,
      data.spo2Percent,
      data.interventionAdministered,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_svt.flowsheet_create',
      entity: 'pediatric_svt_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), heartRateBpm: data.heartRateBpm, rhythmState: data.rhythmState },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Bedside Flowsheet Log
  app.delete('/api/pediatric-svt/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricSvt(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM pediatric_svt_flowsheet_logs WHERE id = ? AND svt_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_svt_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_svt.flowsheet_delete',
      entity: 'pediatric_svt_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
