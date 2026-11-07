import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  calculateSilvermanScore,
  calculateDownesScore,
  calculateAaRatio,
  calculateOxygenationIndex,
  calculateSurfactantDosing,
  assessCpapFailure,
  type SilvermanAndersonInput,
  type DownesInput,
} from '../../web/src/neonatalRdsEngine.js';

function assertCanManageNeonatalRds(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and neonatal nursing staff can manage neonatal RDS records');
  }
  return user;
}

export const neonatalRdsEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  onsetDatetime: z.string().min(1, 'Onset datetime is required'),
  gestationalAgeWeeks: z.number().min(22.0).max(44.0),
  birthWeightKg: z.number().min(0.4).max(6.0),
  currentWeightKg: z.number().min(0.4).max(6.0),
  silvermanAndersonScore: z.number().int().min(0).max(10),
  downesScore: z.number().int().min(0).max(10),
  fio2RequirementPercent: z.number().min(21.0).max(100.0),
  arterialPao2Mmhg: z.number().min(10).max(300).nullable().optional(),
  alveolarPao2Mmhg: z.number().min(20).max(760).nullable().optional(),
  aARatio: z.number().nullable().optional(),
  oxygenationIndex: z.number().nullable().optional(),
  surfactantIndicated: z.boolean().default(false),
  surfactantBrand: z.enum(['curosurf_poractant_alfa', 'survanta_beractant', 'infasurf_calfactant']).nullable().optional(),
  surfactantDoseMgPerKg: z.number().nullable().optional(),
  surfactantTotalDoseMg: z.number().nullable().optional(),
  surfactantTotalVolumeMl: z.number().nullable().optional(),
  administrationMethod: z.enum(['lisa_mist_thin_catheter', 'insure_intubate_surfactant_extubate', 'endotracheal_invasive']).nullable().optional(),
  surfactantAdministeredAt: z.string().nullable().optional(),
  repeatSurfactantNeeded: z.boolean().default(false),
  nivModality: z.enum(['bubble_cpap', 'variable_flow_cpap', 'high_flow_nasal_cannula', 'biphasic_niv', 'intubated_conventional_cmv']).default('bubble_cpap'),
  currentPeepCmh2o: z.number().min(3.0).max(12.0).default(5.0),
  currentFlowLpm: z.number().min(1.0).max(15.0).default(6.0),
  currentFio2Percent: z.number().min(21.0).max(100.0).default(30.0),
  status: z.enum([
    'active_niv',
    'surfactant_administered_stabilized',
    'escalated_to_invasive_ventilation',
    'weaned_to_room_air',
    'discontinued',
  ]).default('active_niv'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const neonatalNivFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursOnProtocol: z.number().min(0).max(720),
  respiratoryRateBpm: z.number().int().min(10).max(160),
  heartRateBpm: z.number().int().min(40).max(240),
  spo2Percent: z.number().min(50).max(100),
  silvermanScore: z.number().int().min(0).max(10),
  downesScore: z.number().int().min(0).max(10),
  peepCmh2o: z.number().min(3.0).max(15.0),
  flowLpm: z.number().min(1.0).max(15.0),
  fio2Percent: z.number().min(21.0).max(100.0),
  nasalColumellaSkinCheck: z.enum(['intact', 'erythema', 'erosion', 'necrosis']).default('intact'),
  gastricDistension: z.enum(['none', 'mild', 'marked_vented']).default('none'),
  arterialBloodGasPh: z.number().min(6.8).max(7.8).nullable().optional(),
  arterialPco2Mmhg: z.number().min(15).max(150).nullable().optional(),
  arterialPao2Mmhg: z.number().min(15).max(300).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNeonatalRdsRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List RDS episodes
  app.get('/api/neonatal-rds/episodes', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_neonatologist_name
      FROM neonatal_rds_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.consultant_neonatologist_id = u.id
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

    query += ` ORDER BY e.onset_datetime DESC`;
    const rows = ctx.db.prepare(query).all(...params);
    return reply.send({ episodes: rows });
  });

  // 2. Get single RDS episode with flowsheet
  app.get('/api/neonatal-rds/episodes/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare(`
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_neonatologist_name
      FROM neonatal_rds_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.consultant_neonatologist_id = u.id
      WHERE e.id = ?
    `).get(id);

    if (!episode) throw notFound('Neonatal RDS episode not found');

    const flowsheetLogs = ctx.db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_niv_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.rds_episode_id = ?
      ORDER BY l.hours_on_protocol ASC, l.log_datetime ASC
    `).all(id);

    return reply.send({ episode, flowsheetLogs });
  });

  // 3. Clinical Calculator endpoint
  app.post('/api/neonatal-rds/calculate', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as any;

    const silverman = body.silverman ? calculateSilvermanScore(body.silverman) : null;
    const downes = body.downes ? calculateDownesScore(body.downes) : null;

    let aaRatio = null;
    if (body.arterialPao2Mmhg && body.fio2Percent && body.arterialPco2Mmhg) {
      aaRatio = calculateAaRatio(body.arterialPao2Mmhg, body.fio2Percent, body.arterialPco2Mmhg);
    }

    let oi = null;
    if (body.meanAirwayPressure && body.fio2Percent && body.arterialPao2Mmhg) {
      oi = calculateOxygenationIndex(body.meanAirwayPressure, body.fio2Percent, body.arterialPao2Mmhg);
    }

    let surfactant = null;
    if (body.brand && body.weightKg && body.gestationalAgeWeeks) {
      surfactant = calculateSurfactantDosing({
        brand: body.brand,
        weightKg: body.weightKg,
        gestationalAgeWeeks: body.gestationalAgeWeeks,
        currentFiO2Percent: body.fio2Percent || 21,
        peepCmh2o: body.peepCmh2o || 5,
        isFirstDose: body.isFirstDose ?? true,
      });
    }

    const cpapFailure = assessCpapFailure({
      peepCmh2o: body.peepCmh2o || 5,
      fio2Percent: body.fio2Percent || 21,
      silvermanScore: silverman ? silverman.score : (body.silvermanScore || 0),
      abgPh: body.abgPh,
      abgPco2Mmhg: body.arterialPco2Mmhg,
      frequentApneasCount: body.frequentApneasCount,
    });

    return reply.send({
      silverman,
      downes,
      aaRatio,
      oxygenationIndex: oi,
      surfactant,
      cpapFailure,
    });
  });

  // 4. Create RDS Episode
  app.post('/api/neonatal-rds/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalRds(req);
    const body = parse(neonatalRdsEpisodeSchema, req.body);

    const episodeCode = `RDS-${Date.now().toString().slice(-6)}`;

    // Automatic calculation for dosing if brand selected
    let surfactantDoseMgPerKg = body.surfactantDoseMgPerKg;
    let surfactantTotalDoseMg = body.surfactantTotalDoseMg;
    let surfactantTotalVolumeMl = body.surfactantTotalVolumeMl;

    if (body.surfactantBrand && (!surfactantTotalDoseMg || !surfactantTotalVolumeMl)) {
      const calc = calculateSurfactantDosing({
        brand: body.surfactantBrand,
        weightKg: body.currentWeightKg,
        gestationalAgeWeeks: body.gestationalAgeWeeks,
        currentFiO2Percent: body.currentFio2Percent,
        peepCmh2o: body.currentPeepCmh2o,
      });
      surfactantDoseMgPerKg = calc.doseMgPerKg;
      surfactantTotalDoseMg = calc.totalDoseMg;
      surfactantTotalVolumeMl = calc.totalVolumeMl;
    }

    const insertStmt = ctx.db.prepare(`
      INSERT INTO neonatal_rds_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        gestational_age_weeks, birth_weight_kg, current_weight_kg,
        silverman_anderson_score, downes_score, fio2_requirement_percent,
        arterial_pao2_mmhg, alveolar_pao2_mmhg, a_a_ratio, oxygenation_index,
        surfactant_indicated, surfactant_brand, surfactant_dose_mg_per_kg,
        surfactant_total_dose_mg, surfactant_total_volume_ml, administration_method,
        surfactant_administered_at, repeat_surfactant_needed, niv_modality,
        current_peep_cmh2o, current_flow_lpm, current_fio2_percent, status,
        consultant_neonatologist_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);

    const result = insertStmt.run(
      body.patientId,
      body.admissionId ?? null,
      episodeCode,
      body.onsetDatetime,
      body.gestationalAgeWeeks,
      body.birthWeightKg,
      body.currentWeightKg,
      body.silvermanAndersonScore,
      body.downesScore,
      body.fio2RequirementPercent,
      body.arterialPao2Mmhg ?? null,
      body.alveolarPao2Mmhg ?? null,
      body.aARatio ?? null,
      body.oxygenationIndex ?? null,
      body.surfactantIndicated ? 1 : 0,
      body.surfactantBrand ?? null,
      surfactantDoseMgPerKg ?? null,
      surfactantTotalDoseMg ?? null,
      surfactantTotalVolumeMl ?? null,
      body.administrationMethod ?? null,
      body.surfactantAdministeredAt ?? null,
      body.repeatSurfactantNeeded ? 1 : 0,
      body.nivModality,
      body.currentPeepCmh2o,
      body.currentFlowLpm,
      body.currentFio2Percent,
      body.status,
      user.id,
      body.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_rds.episode_create',
      entity: 'neonatal_rds_episodes',
      entityId: episodeId,
      detail: `Initiated RDS episode ${episodeCode} (Silverman ${body.silvermanAndersonScore}, Downes ${body.downesScore}, PEEP ${body.currentPeepCmh2o} cm H2O)`,
    });

    const created = ctx.db.prepare('SELECT * FROM neonatal_rds_episodes WHERE id = ?').get(episodeId);
    return reply.status(201).send({ episode: created });
  });

  // 5. Update RDS Episode
  app.put('/api/neonatal-rds/episodes/:id', async (req, reply) => {
    const user = assertCanManageNeonatalRds(req);
    const { id } = req.params as { id: string };
    const body = parse(neonatalRdsEpisodeSchema.partial(), req.body);

    const existing = ctx.db.prepare('SELECT * FROM neonatal_rds_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('RDS episode not found');

    const updateStmt = ctx.db.prepare(`
      UPDATE neonatal_rds_episodes SET
        gestational_age_weeks = COALESCE(?, gestational_age_weeks),
        birth_weight_kg = COALESCE(?, birth_weight_kg),
        current_weight_kg = COALESCE(?, current_weight_kg),
        silverman_anderson_score = COALESCE(?, silverman_anderson_score),
        downes_score = COALESCE(?, downes_score),
        fio2_requirement_percent = COALESCE(?, fio2_requirement_percent),
        arterial_pao2_mmhg = COALESCE(?, arterial_pao2_mmhg),
        alveolar_pao2_mmhg = COALESCE(?, alveolar_pao2_mmhg),
        a_a_ratio = COALESCE(?, a_a_ratio),
        oxygenation_index = COALESCE(?, oxygenation_index),
        surfactant_indicated = COALESCE(?, surfactant_indicated),
        surfactant_brand = COALESCE(?, surfactant_brand),
        surfactant_dose_mg_per_kg = COALESCE(?, surfactant_dose_mg_per_kg),
        surfactant_total_dose_mg = COALESCE(?, surfactant_total_dose_mg),
        surfactant_total_volume_ml = COALESCE(?, surfactant_total_volume_ml),
        administration_method = COALESCE(?, administration_method),
        surfactant_administered_at = COALESCE(?, surfactant_administered_at),
        repeat_surfactant_needed = COALESCE(?, repeat_surfactant_needed),
        niv_modality = COALESCE(?, niv_modality),
        current_peep_cmh2o = COALESCE(?, current_peep_cmh2o),
        current_flow_lpm = COALESCE(?, current_flow_lpm),
        current_fio2_percent = COALESCE(?, current_fio2_percent),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes)
      WHERE id = ?
    `);

    updateStmt.run(
      body.gestationalAgeWeeks ?? null,
      body.birthWeightKg ?? null,
      body.currentWeightKg ?? null,
      body.silvermanAndersonScore ?? null,
      body.downesScore ?? null,
      body.fio2RequirementPercent ?? null,
      body.arterialPao2Mmhg ?? null,
      body.alveolarPao2Mmhg ?? null,
      body.aARatio ?? null,
      body.oxygenationIndex ?? null,
      body.surfactantIndicated !== undefined ? (body.surfactantIndicated ? 1 : 0) : null,
      body.surfactantBrand ?? null,
      body.surfactantDoseMgPerKg ?? null,
      body.surfactantTotalDoseMg ?? null,
      body.surfactantTotalVolumeMl ?? null,
      body.administrationMethod ?? null,
      body.surfactantAdministeredAt ?? null,
      body.repeatSurfactantNeeded !== undefined ? (body.repeatSurfactantNeeded ? 1 : 0) : null,
      body.nivModality ?? null,
      body.currentPeepCmh2o ?? null,
      body.currentFlowLpm ?? null,
      body.currentFio2Percent ?? null,
      body.status ?? null,
      body.clinicalNotes ?? null,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_rds.episode_update',
      entity: 'neonatal_rds_episodes',
      entityId: Number(id),
      detail: `Updated RDS episode ${existing.episode_code} status: ${body.status ?? existing.status}`,
    });

    const updated = ctx.db.prepare('SELECT * FROM neonatal_rds_episodes WHERE id = ?').get(id);
    return reply.send({ episode: updated });
  });

  // 6. Delete RDS Episode
  app.delete('/api/neonatal-rds/episodes/:id', async (req, reply) => {
    const user = assertCanManageNeonatalRds(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM neonatal_rds_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('RDS episode not found');

    ctx.db.prepare('DELETE FROM neonatal_rds_episodes WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_rds.episode_delete',
      entity: 'neonatal_rds_episodes',
      entityId: Number(id),
      detail: `Deleted RDS episode ${existing.episode_code}`,
    });

    return reply.send({ success: true, message: 'RDS episode deleted successfully' });
  });

  // Print audit
  app.post('/api/neonatal-rds/episodes/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const existing = ctx.db.prepare('SELECT * FROM neonatal_rds_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('RDS episode not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_rds.print',
      entity: 'neonatal_rds_episodes',
      entityId: Number(id),
      detail: `Printed RDS & Bubble CPAP flowsheet dossier for episode ${existing.episode_code}`,
    });

    return reply.send({ success: true, message: 'Neonatal RDS print audited' });
  });

  // 7. List Flowsheet Logs
  app.get('/api/neonatal-rds/episodes/:id/flowsheet', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const logs = ctx.db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_niv_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.rds_episode_id = ?
      ORDER BY l.hours_on_protocol ASC, l.log_datetime ASC
    `).all(id);

    return reply.send(logs);
  });

  // 8. Add Flowsheet Log
  app.post('/api/neonatal-rds/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageNeonatalRds(req);
    const { id } = req.params as { id: string };
    const body = parse(neonatalNivFlowsheetSchema, req.body);

    const episode = ctx.db.prepare('SELECT * FROM neonatal_rds_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('RDS episode not found');

    const insertStmt = ctx.db.prepare(`
      INSERT INTO neonatal_niv_flowsheet_logs (
        rds_episode_id, log_datetime, hours_on_protocol,
        respiratory_rate_bpm, heart_rate_bpm, spo2_percent,
        silverman_score, downes_score, peep_cmh2o, flow_lpm,
        fio2_percent, nasal_columella_skin_check, gastric_distension,
        arterial_blood_gas_ph, arterial_pco2_mmhg, arterial_pao2_mmhg,
        logged_by_id, notes
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = insertStmt.run(
      id,
      body.logDatetime,
      body.hoursOnProtocol,
      body.respiratoryRateBpm,
      body.heartRateBpm,
      body.spo2Percent,
      body.silvermanScore,
      body.downesScore,
      body.peepCmh2o,
      body.flowLpm,
      body.fio2Percent,
      body.nasalColumellaSkinCheck,
      body.gastricDistension,
      body.arterialBloodGasPh ?? null,
      body.arterialPco2Mmhg ?? null,
      body.arterialPao2Mmhg ?? null,
      user.id,
      body.notes ?? null
    );

    // Also update current parameters on parent episode
    ctx.db.prepare(`
      UPDATE neonatal_rds_episodes SET
        current_peep_cmh2o = ?,
        current_flow_lpm = ?,
        current_fio2_percent = ?,
        silverman_anderson_score = ?,
        downes_score = ?
      WHERE id = ?
    `).run(body.peepCmh2o, body.flowLpm, body.fio2Percent, body.silvermanScore, body.downesScore, id);

    const logId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_rds.flowsheet_log',
      entity: 'neonatal_niv_flowsheet_logs',
      entityId: logId,
      detail: `Logged NIV flowsheet at Hr ${body.hoursOnProtocol} (PEEP ${body.peepCmh2o}, FiO2 ${body.fio2Percent}%, Silverman ${body.silvermanScore}, Columella: ${body.nasalColumellaSkinCheck})`,
    });

    const created = ctx.db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_niv_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.id = ?
    `).get(logId);

    return reply.status(201).send({ log: created });
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/neonatal-rds/flowsheet/:id', async (req, reply) => {
    const user = assertCanManageNeonatalRds(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM neonatal_niv_flowsheet_logs WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('NIV flowsheet log not found');

    ctx.db.prepare('DELETE FROM neonatal_niv_flowsheet_logs WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_rds.flowsheet_delete',
      entity: 'neonatal_niv_flowsheet_logs',
      entityId: Number(id),
      detail: `Deleted NIV flowsheet log ID ${id}`,
    });

    return reply.send({ success: true, message: 'NIV flowsheet log deleted successfully' });
  });
}
