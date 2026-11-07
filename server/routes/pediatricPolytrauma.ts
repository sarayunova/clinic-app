import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculatePtsComponentScores,
  evaluatePediatricPolytrauma,
} from '../../web/src/pediatricPolytraumaEngine.js';

function assertCanManagePediatricPolytrauma(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical pediatricians, emergency physicians and trauma team nurses can manage pediatric polytrauma records');
  }
  return user;
}

export const pediatricPolytraumaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  traumaDatetime: z.string().min(1, 'Trauma datetime is required'),
  ageMonths: z.number().int().min(1).max(216),
  weightKg: z.number().min(2.5).max(120),
  traumaMechanism: z.enum([
    'motor_vehicle_collision',
    'pedestrian_vs_auto',
    'fall_greater_than_2_meters',
    'bicycle_collision',
    'penetrating_trauma',
    'crush_injury',
    'non_accidental_trauma',
    'other',
  ]),
  airwayStatus: z.enum(['normal', 'maintainable', 'unmaintainable_or_intubated']),
  systolicBp: z.number().int().min(30).max(250),
  cnsStatus: z.enum(['awake', 'obtunded_loc', 'coma_decerebrate']),
  skeletalInjury: z.enum(['none', 'closed_fracture', 'open_or_multiple_fractures']),
  cutaneousInjury: z.enum(['none', 'contusion_abrasion', 'tissue_loss_or_penetrating']),
  initialGcs: z.number().int().min(3).max(15).default(15),
  initialSbp: z.number().int().min(30).max(250),
  initialHeartRate: z.number().int().min(30).max(250),
  fastExamPositive: z.boolean().default(false),
  pelvicBinderPlaced: z.boolean().default(false),
  txaAdministered: z.boolean().default(false),
  txaDoseMg: z.number().min(0).nullable().optional(),
  pediatricMtpActivated: z.boolean().default(false),
  prbcVolumeMl: z.number().min(0).default(0),
  ffpVolumeMl: z.number().min(0).default(0),
  plateletsVolumeMl: z.number().min(0).default(0),
  status: z.enum([
    'acute_trauma_bay',
    'emergent_or_surgery',
    'picu_damage_control',
    'stepdown_ward',
    'convalescent',
  ]).default('acute_trauma_bay'),
  clinicalNotes: z.string().nullable().optional(),
});

export const pediatricPolytraumaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromArrival: z.number().int().min(0).default(0),
  gcsTotal: z.number().int().min(3).max(15),
  sbpMmhg: z.number().int().min(30).max(250),
  dbpMmhg: z.number().int().min(10).max(150).nullable().optional(),
  heartRateBpm: z.number().int().min(30).max(250),
  respiratoryRate: z.number().int().min(5).max(100),
  spo2Percent: z.number().min(40).max(100),
  temperatureCelsius: z.number().min(28).max(43),
  cumulativeCrystalloidMl: z.number().min(0).default(0),
  cumulativePrbcMl: z.number().min(0).default(0),
  cumulativeFfpMl: z.number().min(0).default(0),
  cumulativePlateletsMl: z.number().min(0).default(0),
  urineOutputMlKgHr: z.number().min(0).max(50).nullable().optional(),
  pupilStatus: z.enum([
    'equal_reactive',
    'sluggish_asymmetric',
    'unilateral_dilated_fixed',
    'bilateral_fixed_dilated',
  ]).default('equal_reactive'),
  notes: z.string().nullable().optional(),
});

export function registerPediatricPolytraumaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. PTS Calculation Preview Endpoint
  app.post('/api/pediatric-polytrauma/calculate-pts', async (req) => {
    assertCanManagePediatricPolytrauma(req);
    const body = req.body as Partial<z.infer<typeof pediatricPolytraumaEpisodeSchema>>;

    const evalResult = evaluatePediatricPolytrauma({
      weightKg: body.weightKg ?? 15,
      airwayStatus: body.airwayStatus ?? 'normal',
      systolicBp: body.systolicBp ?? 100,
      cnsStatus: body.cnsStatus ?? 'awake',
      skeletalInjury: body.skeletalInjury ?? 'none',
      cutaneousInjury: body.cutaneousInjury ?? 'none',
      initialGcs: body.initialGcs ?? 15,
      fastExamPositive: body.fastExamPositive,
    });

    return { evalResult };
  });

  // 2. Create Pediatric Polytrauma Episode
  app.post('/api/pediatric-polytrauma/episodes', async (req, reply) => {
    const user = assertCanManagePediatricPolytrauma(req);
    const data = parse(pediatricPolytraumaEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluatePediatricPolytrauma({
      weightKg: data.weightKg,
      airwayStatus: data.airwayStatus,
      systolicBp: data.systolicBp,
      cnsStatus: data.cnsStatus,
      skeletalInjury: data.skeletalInjury,
      cutaneousInjury: data.cutaneousInjury,
      initialGcs: data.initialGcs,
      fastExamPositive: data.fastExamPositive,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `TRAUMA-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_polytrauma_episodes (
        patient_id, admission_id, episode_code, trauma_datetime,
        age_months, weight_kg, trauma_mechanism,
        weight_score, airway_score, systolic_bp_score, cns_score,
        skeletal_score, cutaneous_score, total_pts_score, pts_mortality_tier,
        fast_exam_positive, pelvic_binder_placed, txa_administered, txa_dose_mg,
        pediatric_mtp_activated, prbc_volume_ml, ffp_volume_ml, platelets_volume_ml,
        initial_gcs, initial_sbp, initial_heart_rate,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.traumaDatetime,
      data.ageMonths,
      data.weightKg,
      data.traumaMechanism,
      evalResult.weightScore,
      evalResult.airwayScore,
      evalResult.systolicBpScore,
      evalResult.cnsScore,
      evalResult.skeletalScore,
      evalResult.cutaneousScore,
      evalResult.totalPtsScore,
      evalResult.ptsMortalityTier,
      data.fastExamPositive ? 1 : 0,
      data.pelvicBinderPlaced ? 1 : 0,
      data.txaAdministered ? 1 : 0,
      data.txaDoseMg ?? null,
      data.pediatricMtpActivated ? 1 : 0,
      data.prbcVolumeMl,
      data.ffpVolumeMl,
      data.plateletsVolumeMl,
      data.initialGcs,
      data.initialSbp,
      data.initialHeartRate,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM pediatric_polytrauma_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_polytrauma.episode_create',
      entity: 'pediatric_polytrauma_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        totalPtsScore: evalResult.totalPtsScore,
        ptsMortalityTier: evalResult.ptsMortalityTier,
        mtpActivated: data.pediatricMtpActivated,
      },
    });

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Episodes
  app.get('/api/pediatric-polytrauma/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM pediatric_polytrauma_episodes e
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

    query += ' ORDER BY e.trauma_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/pediatric-polytrauma/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_polytrauma_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric Polytrauma episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM pediatric_polytrauma_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.polytrauma_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    return { episode, logs };
  });

  // 5. Update Episode Status / Resuscitation Info
  app.patch('/api/pediatric-polytrauma/episodes/:id', async (req) => {
    const user = assertCanManagePediatricPolytrauma(req);
    const { id } = req.params as { id: string };
    const patch = req.body as Partial<z.infer<typeof pediatricPolytraumaEpisodeSchema>>;

    const existing = db.prepare('SELECT id FROM pediatric_polytrauma_episodes WHERE id = ?').get(Number(id));
    if (!existing) throw notFound('Pediatric Polytrauma episode not found');

    db.prepare(`
      UPDATE pediatric_polytrauma_episodes SET
        fast_exam_positive = COALESCE(?, fast_exam_positive),
        pelvic_binder_placed = COALESCE(?, pelvic_binder_placed),
        txa_administered = COALESCE(?, txa_administered),
        txa_dose_mg = COALESCE(?, txa_dose_mg),
        pediatric_mtp_activated = COALESCE(?, pediatric_mtp_activated),
        prbc_volume_ml = COALESCE(?, prbc_volume_ml),
        ffp_volume_ml = COALESCE(?, ffp_volume_ml),
        platelets_volume_ml = COALESCE(?, platelets_volume_ml),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      patch.fastExamPositive !== undefined ? (patch.fastExamPositive ? 1 : 0) : null,
      patch.pelvicBinderPlaced !== undefined ? (patch.pelvicBinderPlaced ? 1 : 0) : null,
      patch.txaAdministered !== undefined ? (patch.txaAdministered ? 1 : 0) : null,
      patch.txaDoseMg ?? null,
      patch.pediatricMtpActivated !== undefined ? (patch.pediatricMtpActivated ? 1 : 0) : null,
      patch.prbcVolumeMl ?? null,
      patch.ffpVolumeMl ?? null,
      patch.plateletsVolumeMl ?? null,
      patch.status ?? null,
      patch.clinicalNotes ?? null,
      Number(id),
    );

    const updated = db.prepare('SELECT * FROM pediatric_polytrauma_episodes WHERE id = ?').get(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_polytrauma.episode_update',
      entity: 'pediatric_polytrauma_episodes',
      entityId: Number(id),
      detail: patch,
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-polytrauma/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete polytrauma episodes');
    }
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM pediatric_polytrauma_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric Polytrauma episode not found');

    db.prepare('DELETE FROM pediatric_polytrauma_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_polytrauma.episode_delete',
      entity: 'pediatric_polytrauma_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Bedside Flowsheet Log
  app.post('/api/pediatric-polytrauma/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricPolytrauma(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricPolytraumaFlowsheetSchema, req.body);

    const ep = db.prepare('SELECT id, patient_id FROM pediatric_polytrauma_episodes WHERE id = ?').get(Number(id)) as any;
    if (!ep) throw notFound('Pediatric Polytrauma episode not found');

    const stmt = db.prepare(`
      INSERT INTO pediatric_polytrauma_flowsheet_logs (
        polytrauma_episode_id, patient_id, log_datetime, minutes_from_arrival,
        gcs_total, sbp_mmhg, dbp_mmhg, heart_rate_bpm, respiratory_rate,
        spo2_percent, temperature_celsius, cumulative_crystalloid_ml,
        cumulative_prbc_ml, cumulative_ffp_ml, cumulative_platelets_ml,
        urine_output_ml_kg_hr, pupil_status, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      ep.id,
      ep.patient_id,
      data.logDatetime,
      data.minutesFromArrival,
      data.gcsTotal,
      data.sbpMmhg,
      data.dbpMmhg ?? null,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.temperatureCelsius,
      data.cumulativeCrystalloidMl,
      data.cumulativePrbcMl,
      data.cumulativeFfpMl,
      data.cumulativePlateletsMl,
      data.urineOutputMlKgHr ?? null,
      data.pupilStatus,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_polytrauma.flowsheet_log',
      entity: 'pediatric_polytrauma_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), gcs: data.gcsTotal, sbp: data.sbpMmhg, hr: data.heartRateBpm },
    });

    reply.status(201);
    return { logId: info.lastInsertRowid };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-polytrauma/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete polytrauma flowsheet logs');
    }
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM pediatric_polytrauma_flowsheet_logs WHERE id = ? AND polytrauma_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_polytrauma_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_polytrauma.flowsheet_delete',
      entity: 'pediatric_polytrauma_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
