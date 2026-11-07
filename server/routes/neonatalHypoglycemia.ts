import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluateNeonatalHypoglycemia,
  calculateGir,
  calculateInfusionRateForGir,
  calculateD10wBolus,
  calculateNeonatalSeizureMedication,
  interpretAeegPattern,
} from '../../web/src/neonatalHypoglycemiaEngine.js';

function assertCanManageNeonatalHypoglycemia(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and neonatal nursing staff can manage neonatal hypoglycemia records');
  }
  return user;
}

export const neonatalHypoglycemiaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  evaluationDatetime: z.string().min(1, 'Evaluation datetime is required'),
  ageHours: z.number().min(0).max(720),
  birthWeightKg: z.number().min(0.4).max(6.5),
  currentWeightKg: z.number().min(0.4).max(6.5),
  riskFactors: z.array(z.string()).default([]),
  symptomsPresent: z.boolean().default(false),
  initialBloodGlucoseMgDl: z.number().min(5).max(300),
  d10wBolusGivenMl: z.number().min(0).max(50).default(0),
  currentGirMgKgMin: z.number().min(0).max(25).default(0),
  fluidDextrosePercent: z.number().min(5).max(30).default(10.0),
  fluidRateMlHr: z.number().min(0).max(100).default(0),
  seizureActivityObserved: z.boolean().default(false),
  seizureType: z.enum([
    'none',
    'subclinical_only',
    'electroclinical_clonic',
    'electroclinical_tonic',
    'electroclinical_myoclonic',
    'electroclinical_subtle',
  ]).default('none'),
  aeegBackgroundPattern: z.enum([
    'continuous_normal_voltage',
    'discontinuous_normal_voltage',
    'continuous_low_voltage',
    'burst_suppression',
    'flat_trace',
  ]).default('continuous_normal_voltage'),
  firstLineAsmGiven: z.boolean().default(false),
  phenobarbitalDoseMg: z.number().nullable().optional(),
  levetiracetamDoseMg: z.number().nullable().optional(),
  status: z.enum(['evaluating', 'active_infusion', 'stabilized_weaning', 'resolved']).default('evaluating'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const neonatalGirFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursOnProtocol: z.number().min(0).max(720).default(0),
  bloodGlucoseMgDl: z.number().min(5).max(300),
  fluidDextrosePercent: z.number().min(5).max(30).default(10.0),
  fluidRateMlHr: z.number().min(0).max(100).default(0),
  d10wBolusMl: z.number().min(0).max(50).default(0),
  feedingVolumeMl: z.number().min(0).max(150).default(0),
  feedingType: z.enum(['breast_milk', 'formula', 'tpn_npo']).default('breast_milk'),
  aeegPattern: z.enum([
    'continuous_normal_voltage',
    'discontinuous_normal_voltage',
    'continuous_low_voltage',
    'burst_suppression',
    'flat_trace',
  ]).default('continuous_normal_voltage'),
  seizureEventsCount: z.number().int().min(0).max(50).default(0),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNeonatalHypoglycemiaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Preview Calculation Endpoint
  app.post('/api/neonatal-hypoglycemia/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(
      z.object({
        ageHours: z.number().min(0).max(720),
        bloodGlucoseMgDl: z.number().min(5).max(300),
        birthWeightKg: z.number().min(0.4).max(6.5),
        currentWeightKg: z.number().min(0.4).max(6.5),
        symptomsPresent: z.boolean().default(false),
        riskFactors: z.array(z.string()).default([]),
        fluidDextrosePercent: z.number().min(5).max(30).default(10.0),
        fluidRateMlHr: z.number().min(0).max(100).default(0),
        aeegPattern: z.string().default('continuous_normal_voltage'),
      }),
      req.body,
    );

    const evalResult = evaluateNeonatalHypoglycemia({
      ageHours: body.ageHours,
      bloodGlucoseMgDl: body.bloodGlucoseMgDl,
      birthWeightKg: body.birthWeightKg,
      currentWeightKg: body.currentWeightKg,
      symptomsPresent: body.symptomsPresent,
      riskFactors: body.riskFactors,
    });

    const weight = body.currentWeightKg > 0 ? body.currentWeightKg : body.birthWeightKg;
    const currentGir = calculateGir({
      dextrosePercent: body.fluidDextrosePercent,
      rateMlHr: body.fluidRateMlHr,
      weightKg: weight,
    });

    const seizureDosing = calculateNeonatalSeizureMedication(weight);
    const aeegInterpretation = interpretAeegPattern(body.aeegPattern);

    return {
      evalResult,
      currentGir,
      seizureDosing,
      aeegInterpretation,
    };
  });

  // 2. Create Hypoglycemia Episode
  app.post('/api/neonatal-hypoglycemia/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalHypoglycemia(req);
    const data = parse(neonatalHypoglycemiaEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateNeonatalHypoglycemia({
      ageHours: data.ageHours,
      bloodGlucoseMgDl: data.initialBloodGlucoseMgDl,
      birthWeightKg: data.birthWeightKg,
      currentWeightKg: data.currentWeightKg,
      symptomsPresent: data.symptomsPresent,
      riskFactors: data.riskFactors,
    });

    const weight = data.currentWeightKg > 0 ? data.currentWeightKg : data.birthWeightKg;
    let computedGir = data.currentGirMgKgMin;
    if (computedGir === 0 && data.fluidRateMlHr > 0) {
      computedGir = calculateGir({
        dextrosePercent: data.fluidDextrosePercent,
        rateMlHr: data.fluidRateMlHr,
        weightKg: weight,
      });
    }

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `NHYP-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_hypoglycemia_episodes (
        patient_id, admission_id, episode_code, evaluation_datetime,
        age_hours, birth_weight_kg, current_weight_kg, risk_factors_json,
        symptoms_present, initial_blood_glucose_mg_dl, glucose_target_mg_dl,
        d10w_bolus_given_ml, current_gir_mg_kg_min, fluid_dextrose_percent,
        fluid_rate_ml_hr, seizure_activity_observed, seizure_type,
        aeeg_background_pattern, first_line_asm_given, phenobarbital_dose_mg,
        levetiracetam_dose_mg, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
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
      data.evaluationDatetime,
      data.ageHours,
      data.birthWeightKg,
      data.currentWeightKg,
      JSON.stringify(data.riskFactors),
      data.symptomsPresent ? 1 : 0,
      data.initialBloodGlucoseMgDl,
      evalResult.targetGlucoseMgDl,
      data.d10wBolusGivenMl,
      computedGir,
      data.fluidDextrosePercent,
      data.fluidRateMlHr,
      data.seizureActivityObserved ? 1 : 0,
      data.seizureType,
      data.aeegBackgroundPattern,
      data.firstLineAsmGiven ? 1 : 0,
      data.phenobarbitalDoseMg ?? null,
      data.levetiracetamDoseMg ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM neonatal_hypoglycemia_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypoglycemia.episode_create',
      entity: 'neonatal_hypoglycemia_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        initialBloodGlucoseMgDl: data.initialBloodGlucoseMgDl,
        targetGlucoseMgDl: evalResult.targetGlucoseMgDl,
        currentGir: computedGir,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List Episodes
  app.get('/api/neonatal-hypoglycemia/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM neonatal_hypoglycemia_episodes WHERE 1=1';
    const params: any[] = [];

    if (query.patientId) {
      sql += ' AND patient_id = ?';
      params.push(query.patientId);
    }
    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY evaluation_datetime DESC';

    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 4. Get Single Episode with Flowsheet
  app.get('/api/neonatal-hypoglycemia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM neonatal_hypoglycemia_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal hypoglycemia episode not found');

    const logs = db
      .prepare('SELECT * FROM neonatal_glucose_gir_flowsheet_logs WHERE episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-hypoglycemia/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalHypoglycemia(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(neonatalHypoglycemiaEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM neonatal_hypoglycemia_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal hypoglycemia episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.currentGirMgKgMin !== undefined) {
      fields.push('current_gir_mg_kg_min = ?');
      values.push(data.currentGirMgKgMin);
    }
    if (data.fluidDextrosePercent !== undefined) {
      fields.push('fluid_dextrose_percent = ?');
      values.push(data.fluidDextrosePercent);
    }
    if (data.fluidRateMlHr !== undefined) {
      fields.push('fluid_rate_ml_hr = ?');
      values.push(data.fluidRateMlHr);
    }
    if (data.seizureActivityObserved !== undefined) {
      fields.push('seizure_activity_observed = ?');
      values.push(data.seizureActivityObserved ? 1 : 0);
    }
    if (data.seizureType !== undefined) {
      fields.push('seizure_type = ?');
      values.push(data.seizureType);
    }
    if (data.aeegBackgroundPattern !== undefined) {
      fields.push('aeeg_background_pattern = ?');
      values.push(data.aeegBackgroundPattern);
    }
    if (data.firstLineAsmGiven !== undefined) {
      fields.push('first_line_asm_given = ?');
      values.push(data.firstLineAsmGiven ? 1 : 0);
    }
    if (data.phenobarbitalDoseMg !== undefined) {
      fields.push('phenobarbital_dose_mg = ?');
      values.push(data.phenobarbitalDoseMg);
    }
    if (data.levetiracetamDoseMg !== undefined) {
      fields.push('levetiracetam_dose_mg = ?');
      values.push(data.levetiracetamDoseMg);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE neonatal_hypoglycemia_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM neonatal_hypoglycemia_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypoglycemia.episode_update',
      entity: 'neonatal_hypoglycemia_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-hypoglycemia/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalHypoglycemia(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM neonatal_hypoglycemia_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal hypoglycemia episode not found');

    db.prepare('DELETE FROM neonatal_hypoglycemia_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypoglycemia.episode_delete',
      entity: 'neonatal_hypoglycemia_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-hypoglycemia/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalHypoglycemia(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(neonatalGirFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM neonatal_hypoglycemia_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal hypoglycemia episode not found');

    const weight = episode.current_weight_kg > 0 ? episode.current_weight_kg : episode.birth_weight_kg;
    const computedGir = calculateGir({
      dextrosePercent: data.fluidDextrosePercent,
      rateMlHr: data.fluidRateMlHr,
      weightKg: weight,
    });

    const stmt = db.prepare(`
      INSERT INTO neonatal_glucose_gir_flowsheet_logs (
        episode_id, patient_id, log_datetime, hours_on_protocol,
        blood_glucose_mg_dl, fluid_dextrose_percent, fluid_rate_ml_hr,
        calculated_gir_mg_kg_min, d10w_bolus_ml, feeding_volume_ml,
        feeding_type, aeeg_pattern, seizure_events_count, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursOnProtocol,
      data.bloodGlucoseMgDl,
      data.fluidDextrosePercent,
      data.fluidRateMlHr,
      computedGir,
      data.d10wBolusMl,
      data.feedingVolumeMl,
      data.feedingType,
      data.aeegPattern,
      data.seizureEventsCount,
      data.notes ?? null,
      user.id,
    );

    // Update episode current GIR and fluids
    db.prepare(`
      UPDATE neonatal_hypoglycemia_episodes
      SET current_gir_mg_kg_min = ?, fluid_dextrose_percent = ?, fluid_rate_ml_hr = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(computedGir, data.fluidDextrosePercent, data.fluidRateMlHr, id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypoglycemia.flowsheet_log',
      entity: 'neonatal_glucose_gir_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        bloodGlucoseMgDl: data.bloodGlucoseMgDl,
        calculatedGir: computedGir,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      calculatedGir: computedGir,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-hypoglycemia/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalHypoglycemia(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db
      .prepare('SELECT * FROM neonatal_glucose_gir_flowsheet_logs WHERE id = ? AND episode_id = ?')
      .get(logId, episodeId) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_glucose_gir_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypoglycemia.flowsheet_delete',
      entity: 'neonatal_glucose_gir_flowsheet_logs',
      entityId: logId,
      detail: { episodeId, patientId: log.patient_id },
    });

    return { success: true };
  });

  // 9. Printable Dossier Endpoint
  app.get('/api/neonatal-hypoglycemia/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM neonatal_hypoglycemia_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal hypoglycemia episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id) as any;
    const logs = db
      .prepare('SELECT * FROM neonatal_glucose_gir_flowsheet_logs WHERE episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_hypoglycemia.print',
      entity: 'neonatal_hypoglycemia_episodes',
      entityId: id,
      detail: { patientId: episode.patient_id, episodeCode: episode.episode_code },
    });

    return {
      episode,
      patient,
      logs,
      printedAt: new Date().toISOString(),
      printedBy: user.fullName,
    };
  });
}
