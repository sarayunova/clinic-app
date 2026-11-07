import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import { calculatePediatricDka, type PediatricDkaInput } from '../../web/src/pediatricDkaEngine.js';

function assertCanManagePediatricDka(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and pediatric nursing staff can manage pediatric DKA records');
  }
  return user;
}

export const pediatricDkaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDatetime: z.string().min(1, 'Diagnosis datetime is required'),
  childWeightKg: z.number().min(3.0).max(120.0),
  childHeightCm: z.number().min(40).max(220).nullable().optional(),
  initialBloodGlucoseMgDl: z.number().min(150).max(2000),
  venousPh: z.number().min(6.5).max(7.5),
  serumBicarbonateMmolL: z.number().min(0.5).max(30.0),
  serumBetaHydroxybutyrateMmolL: z.number().min(0).max(20).nullable().optional(),
  ketonesUrineOrBlood: z.enum(['moderate_2_plus', 'large_3_plus', 'beta_hydroxybutyrate_gte_3']),
  measuredSodiumMeqL: z.number().nullable().optional(),
  measuredPotassiumMeqL: z.number().nullable().optional(),
  measuredChlorideMeqL: z.number().nullable().optional(),
  initialSalineBolusMl: z.number().nullable().optional(),
  status: z.enum([
    'active_resuscitation',
    'ketoacidosis_resolved_subcutaneous_bridged',
    'completed',
    'discontinued',
  ]).default('active_resuscitation'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const pediatricDkaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursOnProtocol: z.number().min(0).max(120),
  bloodGlucoseMgDl: z.number().min(20).max(1500),
  venousPh: z.number().nullable().optional(),
  serumBicarbonateMmolL: z.number().nullable().optional(),
  serumSodiumMeqL: z.number().nullable().optional(),
  serumPotassiumMeqL: z.number().nullable().optional(),
  serumChlorideMeqL: z.number().nullable().optional(),
  bag1RateMlHr: z.number().min(0).default(0.0),
  bag2RateMlHr: z.number().min(0).default(0.0),
  insulinInfusionUnitsHr: z.number().min(0),
  glasgowComaScaleScore: z.number().int().min(3).max(15).default(15),
  neurologicalHeadacheVomiting: z.boolean().default(false),
  cushingTriadWarning: z.boolean().default(false),
  emergencyHyperosmolarSalineGiven: z.boolean().default(false),
  urineOutputMlKgHr: z.number().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerPediatricDkaRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List DKA episodes
  app.get('/api/pediatric-dka/episodes', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as attending_pediatrician_name
      FROM pediatric_dka_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.attending_pediatrician_id = u.id
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

    query += ' ORDER BY e.diagnosis_datetime DESC, e.id DESC';

    const episodes = ctx.db.prepare(query).all(...params);
    return reply.send({ episodes });
  });

  // 2. Create DKA resuscitation episode
  app.post('/api/pediatric-dka/episodes', async (req, reply) => {
    const user = assertCanManagePediatricDka(req);
    const body = parse(pediatricDkaEpisodeSchema, req.body);

    const calcResult = calculatePediatricDka({
      childWeightKg: body.childWeightKg,
      initialBloodGlucoseMgDl: body.initialBloodGlucoseMgDl,
      venousPh: body.venousPh,
      serumBicarbonateMmolL: body.serumBicarbonateMmolL,
      measuredSodiumMeqL: body.measuredSodiumMeqL ?? undefined,
      measuredPotassiumMeqL: body.measuredPotassiumMeqL ?? undefined,
      measuredChlorideMeqL: body.measuredChlorideMeqL ?? undefined,
      serumBetaHydroxybutyrateMmolL: body.serumBetaHydroxybutyrateMmolL ?? undefined,
    });

    const dateCode = (body.diagnosisDatetime || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `DKA-${dateCode}-${randSuffix}`;

    const bolusVolume = body.initialSalineBolusMl ?? calcResult.initialBolusVolumeMl;

    const stmt = ctx.db.prepare(`
      INSERT INTO pediatric_dka_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime, child_weight_kg,
        child_height_cm, initial_blood_glucose_mg_dl, venous_ph, serum_bicarbonate_mmol_l,
        serum_beta_hydroxybutyrate_mmol_l, ketones_urine_or_blood, dka_severity,
        estimated_dehydration_percent, total_fluid_deficit_ml, maintenance_fluid_ml_day,
        initial_saline_bolus_ml, rehydration_rate_ml_hr, insulin_infusion_rate_u_kg_hr,
        two_bag_system_active, status, attending_pediatrician_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        1, ?, ?, ?
      )
    `);

    const result = stmt.run(
      body.patientId,
      body.admissionId ?? null,
      episodeCode,
      body.diagnosisDatetime,
      body.childWeightKg,
      body.childHeightCm ?? null,
      body.initialBloodGlucoseMgDl,
      body.venousPh,
      body.serumBicarbonateMmolL,
      body.serumBetaHydroxybutyrateMmolL ?? null,
      body.ketonesUrineOrBlood,
      calcResult.dkaSeverity,
      calcResult.estimatedDehydrationPercent,
      calcResult.totalFluidDeficitMl,
      calcResult.maintenanceFluidMlDay,
      bolusVolume,
      calcResult.totalHourlyRehydrationRateMlHr,
      calcResult.dkaSeverity === 'severe_ph_lt_7_10' ? 0.08 : 0.05,
      body.status,
      user.id,
      body.clinicalNotes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_dka.episode_create',
      entity: 'pediatric_dka_episodes',
      entityId: Number(result.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: body.patientId,
        weightKg: body.childWeightKg,
        severity: calcResult.dkaSeverity,
        rehydrationRate: calcResult.totalHourlyRehydrationRateMlHr,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT e.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as attending_pediatrician_name
         FROM pediatric_dka_episodes e
         JOIN patients pat ON e.patient_id = pat.id
         JOIN users u ON e.attending_pediatrician_id = u.id
         WHERE e.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ episode: inserted, calculation: calcResult });
  });

  // 3. Get single DKA episode with flowsheet logs
  app.get('/api/pediatric-dka/episodes/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = ctx.db
      .prepare(
        `SELECT e.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as attending_pediatrician_name
         FROM pediatric_dka_episodes e
         JOIN patients pat ON e.patient_id = pat.id
         JOIN users u ON e.attending_pediatrician_id = u.id
         WHERE e.id = ?`
      )
      .get(Number(id));

    if (!episode) {
      throw notFound('Pediatric DKA episode not found');
    }

    const flowsheetLogs = ctx.db
      .prepare(
        `SELECT f.*, u.full_name as logged_by_name
         FROM pediatric_dka_flowsheet_logs f
         JOIN users u ON f.logged_by_id = u.id
         WHERE f.dka_episode_id = ?
         ORDER BY f.hours_on_protocol ASC, f.id ASC`
      )
      .all(Number(id));

    return reply.send({ episode, flowsheetLogs });
  });

  // 4. Update DKA episode status
  app.put('/api/pediatric-dka/episodes/:id/status', async (req, reply) => {
    const user = assertCanManagePediatricDka(req);
    const { id } = req.params as { id: string };
    const schema = z.object({
      status: z.enum([
        'active_resuscitation',
        'ketoacidosis_resolved_subcutaneous_bridged',
        'completed',
        'discontinued',
      ]),
    });
    const body = parse(schema, req.body);

    const existing = ctx.db.prepare('SELECT id, episode_code FROM pediatric_dka_episodes WHERE id = ?').get(Number(id)) as
      | { id: number; episode_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Pediatric DKA episode not found');
    }

    ctx.db
      .prepare('UPDATE pediatric_dka_episodes SET status = ? WHERE id = ?')
      .run(body.status, Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_dka.episode_update',
      entity: 'pediatric_dka_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, newStatus: body.status },
    });

    const updated = ctx.db
      .prepare(
        `SELECT e.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                u.full_name as attending_pediatrician_name
         FROM pediatric_dka_episodes e
         JOIN patients pat ON e.patient_id = pat.id
         JOIN users u ON e.attending_pediatrician_id = u.id
         WHERE e.id = ?`
      )
      .get(Number(id));

    return reply.send({ episode: updated });
  });

  // 5. Delete DKA episode
  app.delete('/api/pediatric-dka/episodes/:id', async (req, reply) => {
    const user = assertCanManagePediatricDka(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, episode_code FROM pediatric_dka_episodes WHERE id = ?').get(Number(id)) as
      | { id: number; episode_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Pediatric DKA episode not found');
    }

    ctx.db.prepare('DELETE FROM pediatric_dka_episodes WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_dka.episode_delete',
      entity: 'pediatric_dka_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code },
    });

    return reply.send({ success: true, message: 'Pediatric DKA episode deleted' });
  });

  // 6. Log hourly flowsheet checkpoint
  app.post('/api/pediatric-dka/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManagePediatricDka(req);
    const { id } = req.params as { id: string };
    const body = parse(pediatricDkaFlowsheetSchema, req.body);

    const dka = ctx.db.prepare('SELECT id, episode_code FROM pediatric_dka_episodes WHERE id = ?').get(Number(id)) as
      | { id: number; episode_code: string }
      | undefined;
    if (!dka) {
      throw notFound('Pediatric DKA episode not found');
    }

    // Compute corrected sodium if sodium provided
    let correctedSodium: number | null = null;
    let effectiveOsmolality: number | null = null;
    let anionGap: number | null = null;

    if (body.serumSodiumMeqL !== undefined && body.serumSodiumMeqL !== null) {
      correctedSodium = Number((body.serumSodiumMeqL + 1.6 * ((body.bloodGlucoseMgDl - 100) / 100)).toFixed(1));
      effectiveOsmolality = Number((2 * body.serumSodiumMeqL + body.bloodGlucoseMgDl / 18).toFixed(1));
      if (body.serumChlorideMeqL && body.serumBicarbonateMmolL) {
        anionGap = Number((body.serumSodiumMeqL - (body.serumChlorideMeqL + body.serumBicarbonateMmolL)).toFixed(1));
      }
    }

    const stmt = ctx.db.prepare(`
      INSERT INTO pediatric_dka_flowsheet_logs (
        dka_episode_id, log_datetime, hours_on_protocol, blood_glucose_mg_dl,
        venous_ph, serum_bicarbonate_mmol_l, serum_sodium_meq_l, corrected_sodium_meq_l,
        serum_potassium_meq_l, effective_serum_osmolality_mosm_kg, anion_gap_mmol_l,
        bag_1_rate_ml_hr, bag_2_rate_ml_hr, insulin_infusion_units_hr,
        glasgow_coma_scale_score, neurological_headache_vomiting,
        cushing_triad_warning, emergency_hyperosmolar_saline_given,
        urine_output_ml_kg_hr, logged_by_id, notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      Number(id),
      body.logDatetime,
      body.hoursOnProtocol,
      body.bloodGlucoseMgDl,
      body.venousPh ?? null,
      body.serumBicarbonateMmolL ?? null,
      body.serumSodiumMeqL ?? null,
      correctedSodium,
      body.serumPotassiumMeqL ?? null,
      effectiveOsmolality,
      anionGap,
      body.bag1RateMlHr,
      body.bag2RateMlHr,
      body.insulinInfusionUnitsHr,
      body.glasgowComaScaleScore,
      body.neurologicalHeadacheVomiting ? 1 : 0,
      body.cushingTriadWarning ? 1 : 0,
      body.emergencyHyperosmolarSalineGiven ? 1 : 0,
      body.urineOutputMlKgHr ?? null,
      user.id,
      body.notes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_dka.flowsheet_log',
      entity: 'pediatric_dka_flowsheet_logs',
      entityId: Number(result.lastInsertRowid),
      detail: {
        dkaEpisodeId: Number(id),
        glucose: body.bloodGlucoseMgDl,
        gcs: body.glasgowComaScaleScore,
        cushingWarning: body.cushingTriadWarning,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT f.*, u.full_name as logged_by_name
         FROM pediatric_dka_flowsheet_logs f
         JOIN users u ON f.logged_by_id = u.id
         WHERE f.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ log: inserted });
  });

  // 7. Delete flowsheet log
  app.delete('/api/pediatric-dka/flowsheet/:logId', async (req, reply) => {
    const user = assertCanManagePediatricDka(req);
    const { logId } = req.params as { logId: string };

    const existing = ctx.db.prepare('SELECT id, dka_episode_id FROM pediatric_dka_flowsheet_logs WHERE id = ?').get(Number(logId)) as
      | { id: number; dka_episode_id: number }
      | undefined;
    if (!existing) {
      throw notFound('DKA flowsheet log not found');
    }

    ctx.db.prepare('DELETE FROM pediatric_dka_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_dka.flowsheet_delete',
      entity: 'pediatric_dka_flowsheet_logs',
      entityId: Number(logId),
      detail: { dkaEpisodeId: existing.dka_episode_id },
    });

    return reply.send({ success: true, message: 'DKA flowsheet log deleted' });
  });

  // 8. Print audit
  app.post('/api/pediatric-dka/episodes/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const dka = ctx.db.prepare('SELECT id, episode_code FROM pediatric_dka_episodes WHERE id = ?').get(Number(id)) as
      | { id: number; episode_code: string }
      | undefined;
    if (!dka) {
      throw notFound('Pediatric DKA episode not found');
    }

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_dka.print',
      entity: 'pediatric_dka_episodes',
      entityId: Number(id),
      detail: { episodeCode: dka.episode_code },
    });

    return reply.send({ success: true, message: 'Pediatric DKA flowsheet print audited' });
  });
}
