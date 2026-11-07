import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  classifyPediatricShockPhenotype,
  evaluateFluidResuscitationSafety,
  calculateVisScore,
} from '../../web/src/pediatricSepticShockEngine.js';

function assertCanManagePediatricSepticShock(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and pediatric nursing staff can manage pediatric septic shock records');
  }
  return user;
}

export const pediatricSepticShockEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  recognitionDatetime: z.string().min(1, 'Recognition datetime is required'),
  ageMonths: z.number().int().min(0).max(216),
  weightKg: z.number().min(0.5).max(120),
  shockPhenotype: z.enum(['cold_shock', 'warm_shock', 'unspecified', 'indeterminate']).default('unspecified'),
  mentalStatus: z.enum(['alert', 'voice', 'pain', 'unresponsive']).default('alert'),
  capillaryRefillSeconds: z.number().min(0).max(15).default(2.0),
  heartRateBpm: z.number().int().min(30).max(280),
  sbp: z.number().int().min(30).max(240),
  dbp: z.number().int().min(15).max(160),
  pulseQuality: z.enum(['normal', 'bounding', 'weak_thready', 'absent']).default('normal'),
  extremityTemperature: z.enum(['warm', 'cool_mottled']).default('warm'),
  cumulativeFluidMl: z.number().min(0).max(10000).default(0),
  hepatomegalyPresent: z.boolean().default(false),
  pulmonaryCracklesPresent: z.boolean().default(false),
  firstLineVasoactive: z.enum(['epinephrine', 'norepinephrine', 'dobutamine', 'none']).default('none'),
  stressHydrocortisoneAdministered: z.boolean().default(false),
  currentVisScore: z.number().min(0).max(200).default(0),
  organDysfunctionFlags: z.string().max(500).nullable().optional(),
  status: z.enum(['resuscitating', 'stabilized', 'fluid_refractory', 'picu_transferred', 'resolved']).default('resuscitating'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const pediatricSepticShockFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromRecognition: z.number().int().min(0).max(1440).default(0),
  heartRateBpm: z.number().int().min(30).max(280).nullable().optional(),
  sbp: z.number().int().min(30).max(240).nullable().optional(),
  dbp: z.number().int().min(15).max(160).nullable().optional(),
  capillaryRefillSeconds: z.number().min(0).max(15).nullable().optional(),
  mentalStatus: z.string().nullable().optional(),
  bolusFluidType: z.string().nullable().optional(),
  bolusFluidVolumeMl: z.number().min(0).max(2000).default(0),
  dopamineMcgKgMin: z.number().min(0).max(30).default(0),
  dobutamineMcgKgMin: z.number().min(0).max(30).default(0),
  epinephrineMcgKgMin: z.number().min(0).max(3.0).default(0),
  norepinephrineMcgKgMin: z.number().min(0).max(3.0).default(0),
  milrinoneMcgKgMin: z.number().min(0).max(3.0).default(0),
  vasopressinUnitsKgMin: z.number().min(0).max(0.01).default(0),
  hepatomegalyChecked: z.boolean().default(true),
  pulmonaryCracklesChecked: z.boolean().default(true),
  notes: z.string().max(500).nullable().optional(),
});

export function registerPediatricSepticShockRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List shock episodes
  app.get('/api/pediatric-septic-shock/episodes', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_name
      FROM pediatric_septic_shock_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` AND e.patient_id = ?`;
      params.push(parseInt(patientId, 10));
    }
    if (status) {
      query += ` AND e.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY e.recognition_datetime DESC`;
    const rows = ctx.db.prepare(query).all(...params);
    return reply.send({ episodes: rows });
  });

  // 2. Get single episode with flowsheet logs
  app.get('/api/pediatric-septic-shock/episodes/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare(`
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_name
      FROM pediatric_septic_shock_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id);

    if (!episode) throw notFound('Pediatric septic shock episode not found');

    const flowsheetLogs = ctx.db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_septic_shock_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.shock_episode_id = ?
      ORDER BY l.minutes_from_recognition ASC, l.log_datetime ASC
    `).all(id);

    return reply.send({ episode, flowsheetLogs });
  });

  // 3. Clinical Calculator endpoint
  app.post('/api/pediatric-septic-shock/calculate', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as any;

    const capRefill = Number(body.capillaryRefillSeconds) || 2.0;
    const pulseQuality = body.pulseQuality || 'normal';
    const extremityTemp = body.extremityTemperature || 'warm';
    const sbp = Number(body.sbp) || 90;
    const dbp = Number(body.dbp) || 60;
    const weightKg = Number(body.weightKg) || 15;

    const phenotypeResult = classifyPediatricShockPhenotype({
      capillaryRefillSeconds: capRefill,
      pulseQuality,
      extremityTemperature: extremityTemp,
      sbp,
      dbp,
    });

    const fluidSafety = evaluateFluidResuscitationSafety({
      weightKg,
      cumulativeFluidMl: Number(body.cumulativeFluidMl) || 0,
      proposedBolusMl: Number(body.proposedBolusMl) || undefined,
      hepatomegalyPresent: Boolean(body.hepatomegalyPresent),
      pulmonaryCracklesPresent: Boolean(body.pulmonaryCracklesPresent),
    });

    const visResult = calculateVisScore({
      dopamineMcgKgMin: Number(body.dopamineMcgKgMin) || 0,
      dobutamineMcgKgMin: Number(body.dobutamineMcgKgMin) || 0,
      epinephrineMcgKgMin: Number(body.epinephrineMcgKgMin) || 0,
      norepinephrineMcgKgMin: Number(body.norepinephrineMcgKgMin) || 0,
      milrinoneMcgKgMin: Number(body.milrinoneMcgKgMin) || 0,
      vasopressinUnitsKgMin: Number(body.vasopressinUnitsKgMin) || 0,
    });

    return reply.send({
      phenotypeResult,
      fluidSafety,
      visResult,
    });
  });

  // 4. Create Septic Shock Episode
  app.post('/api/pediatric-septic-shock/episodes', async (req, reply) => {
    const user = assertCanManagePediatricSepticShock(req);
    const body = parse(pediatricSepticShockEpisodeSchema, req.body);

    const episodeCode = `PSEP-${Date.now().toString().slice(-6)}`;
    const mapMmhg = Math.round((body.dbp + (body.sbp - body.dbp) / 3) * 10) / 10;
    const fluidMlKg = Math.round((body.cumulativeFluidMl / body.weightKg) * 10) / 10;

    const phenotypeCalc = classifyPediatricShockPhenotype({
      capillaryRefillSeconds: body.capillaryRefillSeconds,
      pulseQuality: body.pulseQuality,
      extremityTemperature: body.extremityTemperature,
      sbp: body.sbp,
      dbp: body.dbp,
    });

    const isFluidOverload = body.hepatomegalyPresent || body.pulmonaryCracklesPresent;
    const isFluidRefractory = fluidMlKg >= 40 || (fluidMlKg >= 20 && isFluidOverload);
    const firstLineVasoactive = body.firstLineVasoactive !== 'none' ? body.firstLineVasoactive : phenotypeCalc.recommendedFirstLineVasoactive;

    const insertStmt = ctx.db.prepare(`
      INSERT INTO pediatric_septic_shock_episodes (
        patient_id, admission_id, episode_code, recognition_datetime,
        age_months, weight_kg, shock_phenotype, mental_status,
        capillary_refill_seconds, heart_rate_bpm, sbp, dbp, map_mmhg,
        pulse_quality, extremity_temperature,
        cumulative_fluid_ml, cumulative_fluid_ml_kg,
        hepatomegaly_present, pulmonary_crackles_present,
        fluid_overload_alert, fluid_refractory,
        first_line_vasoactive, stress_hydrocortisone_administered,
        current_vis_score, organ_dysfunction_flags,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      body.patientId,
      body.admissionId ?? null,
      episodeCode,
      body.recognitionDatetime,
      body.ageMonths,
      body.weightKg,
      body.shockPhenotype !== 'unspecified' ? body.shockPhenotype : phenotypeCalc.phenotype,
      body.mentalStatus,
      body.capillaryRefillSeconds,
      body.heartRateBpm,
      body.sbp,
      body.dbp,
      mapMmhg,
      body.pulseQuality,
      body.extremityTemperature,
      body.cumulativeFluidMl,
      fluidMlKg,
      body.hepatomegalyPresent ? 1 : 0,
      body.pulmonaryCracklesPresent ? 1 : 0,
      isFluidOverload ? 1 : 0,
      isFluidRefractory ? 1 : 0,
      firstLineVasoactive,
      body.stressHydrocortisoneAdministered ? 1 : 0,
      body.currentVisScore,
      body.organDysfunctionFlags ?? null,
      body.status,
      user.id,
      body.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_septic_shock.episode_create',
      entity: 'pediatric_septic_shock_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: body.patientId,
        weightKg: body.weightKg,
        phenotype: phenotypeCalc.phenotype,
        fluidMlKg,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_episodes WHERE id = ?').get(episodeId);
    return reply.status(201).send({ episode: created });
  });

  // 5. Update Shock Episode
  app.put('/api/pediatric-septic-shock/episodes/:id', async (req, reply) => {
    const user = assertCanManagePediatricSepticShock(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric septic shock episode not found');

    const body = req.body as any;

    ctx.db.prepare(`
      UPDATE pediatric_septic_shock_episodes
      SET status = COALESCE(?, status),
          shock_phenotype = COALESCE(?, shock_phenotype),
          mental_status = COALESCE(?, mental_status),
          first_line_vasoactive = COALESCE(?, first_line_vasoactive),
          stress_hydrocortisone_administered = COALESCE(?, stress_hydrocortisone_administered),
          current_vis_score = COALESCE(?, current_vis_score),
          organ_dysfunction_flags = COALESCE(?, organ_dysfunction_flags),
          fluid_refractory = COALESCE(?, fluid_refractory),
          fluid_overload_alert = COALESCE(?, fluid_overload_alert),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.status ?? null,
      body.shockPhenotype ?? null,
      body.mentalStatus ?? null,
      body.firstLineVasoactive ?? null,
      body.stressHydrocortisoneAdministered !== undefined ? (body.stressHydrocortisoneAdministered ? 1 : 0) : null,
      body.currentVisScore ?? null,
      body.organDysfunctionFlags ?? null,
      body.fluidRefractory !== undefined ? (body.fluidRefractory ? 1 : 0) : null,
      body.fluidOverloadAlert !== undefined ? (body.fluidOverloadAlert ? 1 : 0) : null,
      body.clinicalNotes ?? null,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_septic_shock.episode_update',
      entity: 'pediatric_septic_shock_episodes',
      entityId: id,
      detail: { status: body.status, currentVisScore: body.currentVisScore },
    });

    const updated = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_episodes WHERE id = ?').get(id);
    return reply.send({ episode: updated });
  });

  // 6. Delete Shock Episode
  app.delete('/api/pediatric-septic-shock/episodes/:id', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only physicians may delete pediatric septic shock records');
    }
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric septic shock episode not found');

    ctx.db.prepare('DELETE FROM pediatric_septic_shock_episodes WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_septic_shock.episode_delete',
      entity: 'pediatric_septic_shock_episodes',
      entityId: id,
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return reply.send({ success: true, message: 'Episode removed' });
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-septic-shock/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricSepticShock(req);
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric septic shock episode not found');

    const body = parse(pediatricSepticShockFlowsheetSchema, req.body);

    const sbp = body.sbp ?? episode.sbp;
    const dbp = body.dbp ?? episode.dbp;
    const mapMmhg = Math.round((dbp + (sbp - dbp) / 3) * 10) / 10;
    const newTotalFluidMl = episode.cumulative_fluid_ml + body.bolusFluidVolumeMl;
    const newTotalFluidMlKg = Math.round((newTotalFluidMl / episode.weight_kg) * 10) / 10;

    const visCalc = calculateVisScore({
      dopamineMcgKgMin: body.dopamineMcgKgMin,
      dobutamineMcgKgMin: body.dobutamineMcgKgMin,
      epinephrineMcgKgMin: body.epinephrineMcgKgMin,
      norepinephrineMcgKgMin: body.norepinephrineMcgKgMin,
      milrinoneMcgKgMin: body.milrinoneMcgKgMin,
      vasopressinUnitsKgMin: body.vasopressinUnitsKgMin,
    });

    const insertStmt = ctx.db.prepare(`
      INSERT INTO pediatric_septic_shock_flowsheet_logs (
        shock_episode_id, patient_id, log_datetime, minutes_from_recognition,
        heart_rate_bpm, sbp, dbp, map_mmhg,
        capillary_refill_seconds, mental_status,
        bolus_fluid_type, bolus_fluid_volume_ml, total_fluid_ml_kg,
        dopamine_mcg_kg_min, dobutamine_mcg_kg_min,
        epinephrine_mcg_kg_min, norepinephrine_mcg_kg_min,
        milrinone_mcg_kg_min, vasopressin_units_kg_min,
        vis_score, hepatomegaly_checked, pulmonary_crackles_checked,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = insertStmt.run(
      id,
      episode.patient_id,
      body.logDatetime,
      body.minutesFromRecognition,
      body.heartRateBpm ?? episode.heart_rate_bpm,
      sbp,
      dbp,
      mapMmhg,
      body.capillaryRefillSeconds ?? episode.capillary_refill_seconds,
      body.mentalStatus ?? episode.mental_status,
      body.bolusFluidType ?? null,
      body.bolusFluidVolumeMl,
      newTotalFluidMlKg,
      body.dopamineMcgKgMin,
      body.dobutamineMcgKgMin,
      body.epinephrineMcgKgMin,
      body.norepinephrineMcgKgMin,
      body.milrinoneMcgKgMin,
      body.vasopressinUnitsKgMin,
      visCalc.visScore,
      body.hepatomegalyChecked ? 1 : 0,
      body.pulmonaryCracklesChecked ? 1 : 0,
      body.notes ?? null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    // Update parent episode cumulative fluids and VIS
    ctx.db.prepare(`
      UPDATE pediatric_septic_shock_episodes
      SET cumulative_fluid_ml = ?,
          cumulative_fluid_ml_kg = ?,
          current_vis_score = ?,
          sbp = ?,
          dbp = ?,
          map_mmhg = ?,
          fluid_refractory = CASE WHEN ? >= 40 THEN 1 ELSE fluid_refractory END,
          status = CASE WHEN ? >= 40 AND status = 'resuscitating' THEN 'fluid_refractory' ELSE status END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      newTotalFluidMl,
      newTotalFluidMlKg,
      visCalc.visScore,
      sbp,
      dbp,
      mapMmhg,
      newTotalFluidMlKg,
      newTotalFluidMlKg,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_septic_shock.flowsheet_log',
      entity: 'pediatric_septic_shock_flowsheet_logs',
      entityId: logId,
      detail: {
        shockEpisodeId: id,
        bolusFluidVolumeMl: body.bolusFluidVolumeMl,
        newTotalFluidMlKg,
        visScore: visCalc.visScore,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_flowsheet_logs WHERE id = ?').get(logId);
    return reply.status(201).send({ log: created, visScore: visCalc.visScore, newTotalFluidMlKg });
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-septic-shock/flowsheet-logs/:logId', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only physicians may remove flowsheet logs');
    }
    const { logId } = req.params as { logId: string };

    const existing = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_flowsheet_logs WHERE id = ?').get(logId) as any;
    if (!existing) throw notFound('Flowsheet log not found');

    ctx.db.prepare('DELETE FROM pediatric_septic_shock_flowsheet_logs WHERE id = ?').run(logId);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_septic_shock.flowsheet_delete',
      entity: 'pediatric_septic_shock_flowsheet_logs',
      entityId: logId,
      detail: { shockEpisodeId: existing.shock_episode_id },
    });

    return reply.send({ success: true, message: 'Flowsheet log removed' });
  });

  // 9. Audit Print Event
  app.post('/api/pediatric-septic-shock/episodes/:id/audit-print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare('SELECT * FROM pediatric_septic_shock_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric septic shock episode not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_septic_shock.print',
      entity: 'pediatric_septic_shock_episodes',
      entityId: id,
      detail: { episodeCode: episode.episode_code, patientId: episode.patient_id },
    });

    return reply.send({ success: true });
  });
}
