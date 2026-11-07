import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  calculateKaiserEosRisk,
  calculateItRatio,
  calculateNeonatalAntibioticDosing,
  calculateInotropeInfusionRates,
  type KaiserEosInput,
} from '../../web/src/neonatalSepsisEngine.js';

function assertCanManageNeonatalSepsis(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and neonatal nursing staff can manage neonatal sepsis records');
  }
  return user;
}

export const neonatalSepsisEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  evaluationDatetime: z.string().min(1, 'Evaluation datetime is required'),
  gestationalAgeWeeks: z.number().min(22.0).max(44.0),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  birthWeightKg: z.number().min(0.4).max(6.0),
  maternalTempCelsius: z.number().min(35.0).max(42.0),
  romHours: z.number().min(0).max(300).default(0),
  maternalGbsStatus: z.enum(['positive', 'negative', 'unknown']).default('unknown'),
  maternalIapStatus: z.enum(['adequate', 'inadequate', 'none']).default('none'),
  clinicalPresentation: z.enum(['well_appearing', 'equivocal', 'clinical_illness']).default('well_appearing'),
  bloodCultureDrawn: z.boolean().default(false),
  bloodCultureResult: z.string().nullable().optional(),
  empiricAntibioticsStarted: z.boolean().default(false),
  ampicillinDoseMg: z.number().nullable().optional(),
  gentamicinDoseMg: z.number().nullable().optional(),
  itRatio: z.number().min(0).max(1.0).nullable().optional(),
  crpMgL: z.number().min(0).max(500).nullable().optional(),
  microEsrMmHr: z.number().min(0).max(100).nullable().optional(),
  plateletsKUl: z.number().min(0).max(1000).nullable().optional(),
  losSuspected: z.boolean().default(false),
  losActionPlan: z.string().max(1000).nullable().optional(),
  status: z.enum([
    'evaluating',
    'active_treatment',
    'surveillance_complete',
    'resolved',
    'escalated_septic_shock',
  ]).default('evaluating'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const neonatalInotropeFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursOnInotropes: z.number().min(0).max(720).default(0),
  heartRateBpm: z.number().int().min(40).max(240).nullable().optional(),
  bloodPressureSystolic: z.number().int().min(30).max(160).nullable().optional(),
  bloodPressureDiastolic: z.number().int().min(15).max(110).nullable().optional(),
  preDuctalSpo2: z.number().min(40).max(100).nullable().optional(),
  postDuctalSpo2: z.number().min(40).max(100).nullable().optional(),
  svcFlowMlKgMin: z.number().min(0).max(250).nullable().optional(),
  urineOutputMlKgHr: z.number().min(0).max(20).nullable().optional(),
  dopamineMcgKgMin: z.number().min(0).max(30).default(0),
  dobutamineMcgKgMin: z.number().min(0).max(30).default(0),
  epinephrineMcgKgMin: z.number().min(0).max(2.0).default(0),
  milrinoneMcgKgMin: z.number().min(0).max(2.0).default(0),
  hydrocortisoneMgKg: z.number().min(0).max(10).default(0),
  inoPpm: z.number().min(0).max(80).default(0),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNeonatalSepsisRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List sepsis episodes
  app.get('/api/neonatal-sepsis/episodes', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_name
      FROM neonatal_sepsis_episodes e
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

    query += ` ORDER BY e.evaluation_datetime DESC`;
    const rows = ctx.db.prepare(query).all(...params);
    return reply.send({ episodes: rows });
  });

  // 2. Get single episode with flowsheet logs
  app.get('/api/neonatal-sepsis/episodes/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare(`
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_name
      FROM neonatal_sepsis_episodes e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id);

    if (!episode) throw notFound('Neonatal sepsis episode not found');

    const inotropeLogs = ctx.db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_inotrope_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.sepsis_episode_id = ?
      ORDER BY l.hours_on_inotropes ASC, l.log_datetime ASC
    `).all(id);

    return reply.send({ episode, inotropeLogs });
  });

  // 3. Clinical Calculator endpoint
  app.post('/api/neonatal-sepsis/calculate-eos', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as any;

    const input: KaiserEosInput = {
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks) || 38,
      gestationalAgeDays: Number(body.gestationalAgeDays) || 0,
      birthWeightGrams: (Number(body.birthWeightKg) || 3.0) * 1000,
      maternalTempCelsius: Number(body.maternalTempCelsius) || 37.0,
      romHours: Number(body.romHours) || 0,
      maternalGbsStatus: body.maternalGbsStatus || 'unknown',
      maternalIapStatus: body.maternalIapStatus || 'none',
      clinicalPresentation: body.clinicalPresentation || 'well_appearing',
    };

    const eosResult = calculateKaiserEosRisk(input);
    const abxDosing = calculateNeonatalAntibioticDosing(input.birthWeightGrams, input.gestationalAgeWeeks);

    let itResult = null;
    if (body.bandsPercent !== undefined && body.segmentedNeutrophilsPercent !== undefined) {
      itResult = calculateItRatio({
        bandsPercent: Number(body.bandsPercent) || 0,
        metamyelocytesPercent: Number(body.metamyelocytesPercent) || 0,
        segmentedNeutrophilsPercent: Number(body.segmentedNeutrophilsPercent) || 0,
      });
    }

    const inotropes = calculateInotropeInfusionRates({
      weightKg: Number(body.birthWeightKg) || 3.0,
      dopamineMcgKgMin: Number(body.dopamineMcgKgMin) || 0,
      dobutamineMcgKgMin: Number(body.dobutamineMcgKgMin) || 0,
      epinephrineMcgKgMin: Number(body.epinephrineMcgKgMin) || 0,
      milrinoneMcgKgMin: Number(body.milrinoneMcgKgMin) || 0,
    });

    return reply.send({
      eosResult,
      abxDosing,
      itResult,
      inotropes,
    });
  });

  // 4. Create Sepsis Episode
  app.post('/api/neonatal-sepsis/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalSepsis(req);
    const body = parse(neonatalSepsisEpisodeSchema, req.body);

    const episodeCode = `EOS-${Date.now().toString().slice(-6)}`;

    // Automated Kaiser EOS Calculation
    const eosCalc = calculateKaiserEosRisk({
      gestationalAgeWeeks: body.gestationalAgeWeeks,
      gestationalAgeDays: body.gestationalAgeDays,
      birthWeightGrams: body.birthWeightKg * 1000,
      maternalTempCelsius: body.maternalTempCelsius,
      romHours: body.romHours,
      maternalGbsStatus: body.maternalGbsStatus,
      maternalIapStatus: body.maternalIapStatus,
      clinicalPresentation: body.clinicalPresentation,
    });

    const abxDosing = calculateNeonatalAntibioticDosing(body.birthWeightKg * 1000, body.gestationalAgeWeeks);

    const insertStmt = ctx.db.prepare(`
      INSERT INTO neonatal_sepsis_episodes (
        patient_id, admission_id, episode_code, evaluation_datetime,
        gestational_age_weeks, gestational_age_days, birth_weight_kg,
        maternal_temp_celsius, rom_hours, maternal_gbs_status, maternal_iap_status,
        clinical_presentation, eos_risk_per_1000, eos_recommendation,
        blood_culture_drawn, blood_culture_result, empiric_antibiotics_started,
        ampicillin_dose_mg, gentamicin_dose_mg,
        it_ratio, crp_mg_l, micro_esr_mm_hr, platelets_k_ul,
        los_suspected, los_action_plan, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      body.patientId,
      body.admissionId ?? null,
      episodeCode,
      body.evaluationDatetime,
      body.gestationalAgeWeeks,
      body.gestationalAgeDays,
      body.birthWeightKg,
      body.maternalTempCelsius,
      body.romHours,
      body.maternalGbsStatus,
      body.maternalIapStatus,
      body.clinicalPresentation,
      eosCalc.eosRiskPer1000,
      eosCalc.recommendation,
      body.bloodCultureDrawn ? 1 : 0,
      body.bloodCultureResult ?? 'pending',
      body.empiricAntibioticsStarted ? 1 : (eosCalc.antibioticIndicated ? 1 : 0),
      body.ampicillinDoseMg ?? abxDosing.ampicillinDoseMg,
      body.gentamicinDoseMg ?? abxDosing.gentamicinDoseMg,
      body.itRatio ?? null,
      body.crpMgL ?? null,
      body.microEsrMmHr ?? null,
      body.plateletsKUl ?? null,
      body.losSuspected ? 1 : 0,
      body.losActionPlan ?? null,
      body.status,
      user.id,
      body.clinicalNotes ?? null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_sepsis.episode_create',
      entity: 'neonatal_sepsis_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: body.patientId,
        eosRiskPer1000: eosCalc.eosRiskPer1000,
        recommendation: eosCalc.recommendation,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM neonatal_sepsis_episodes WHERE id = ?').get(episodeId);
    return reply.status(201).send({ episode: created });
  });

  // 5. Update Sepsis Episode
  app.put('/api/neonatal-sepsis/episodes/:id', async (req, reply) => {
    const user = assertCanManageNeonatalSepsis(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM neonatal_sepsis_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal sepsis episode not found');

    const body = req.body as any;

    ctx.db.prepare(`
      UPDATE neonatal_sepsis_episodes
      SET status = COALESCE(?, status),
          blood_culture_drawn = COALESCE(?, blood_culture_drawn),
          blood_culture_result = COALESCE(?, blood_culture_result),
          empiric_antibiotics_started = COALESCE(?, empiric_antibiotics_started),
          ampicillin_dose_mg = COALESCE(?, ampicillin_dose_mg),
          gentamicin_dose_mg = COALESCE(?, gentamicin_dose_mg),
          it_ratio = COALESCE(?, it_ratio),
          crp_mg_l = COALESCE(?, crp_mg_l),
          micro_esr_mm_hr = COALESCE(?, micro_esr_mm_hr),
          platelets_k_ul = COALESCE(?, platelets_k_ul),
          los_suspected = COALESCE(?, los_suspected),
          los_action_plan = COALESCE(?, los_action_plan),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.status ?? null,
      body.bloodCultureDrawn !== undefined ? (body.bloodCultureDrawn ? 1 : 0) : null,
      body.bloodCultureResult ?? null,
      body.empiricAntibioticsStarted !== undefined ? (body.empiricAntibioticsStarted ? 1 : 0) : null,
      body.ampicillinDoseMg ?? null,
      body.gentamicinDoseMg ?? null,
      body.itRatio ?? null,
      body.crpMgL ?? null,
      body.microEsrMmHr ?? null,
      body.plateletsKUl ?? null,
      body.losSuspected !== undefined ? (body.losSuspected ? 1 : 0) : null,
      body.losActionPlan ?? null,
      body.clinicalNotes ?? null,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_sepsis.episode_update',
      entity: 'neonatal_sepsis_episodes',
      entityId: id,
      detail: { status: body.status, bloodCultureResult: body.bloodCultureResult },
    });

    const updated = ctx.db.prepare('SELECT * FROM neonatal_sepsis_episodes WHERE id = ?').get(id);
    return reply.send({ episode: updated });
  });

  // 6. Delete Sepsis Episode
  app.delete('/api/neonatal-sepsis/episodes/:id', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only physicians may delete neonatal sepsis records');
    }
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM neonatal_sepsis_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal sepsis episode not found');

    ctx.db.prepare('DELETE FROM neonatal_sepsis_episodes WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_sepsis.episode_delete',
      entity: 'neonatal_sepsis_episodes',
      entityId: id,
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return reply.send({ success: true, message: 'Episode removed' });
  });

  // 7. Add Inotrope Flowsheet Log
  app.post('/api/neonatal-sepsis/episodes/:id/inotrope-logs', async (req, reply) => {
    const user = assertCanManageNeonatalSepsis(req);
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare('SELECT * FROM neonatal_sepsis_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal sepsis episode not found');

    const body = parse(neonatalInotropeFlowsheetSchema, req.body);

    let mapMmhg: number | null = null;
    if (body.bloodPressureSystolic && body.bloodPressureDiastolic) {
      mapMmhg = Math.round((body.bloodPressureDiastolic + (body.bloodPressureSystolic - body.bloodPressureDiastolic) / 3) * 10) / 10;
    }

    let deltaSpo2: number | null = null;
    if (body.preDuctalSpo2 !== null && body.postDuctalSpo2 !== null && body.preDuctalSpo2 !== undefined && body.postDuctalSpo2 !== undefined) {
      deltaSpo2 = Math.round(Math.abs(body.preDuctalSpo2 - body.postDuctalSpo2) * 10) / 10;
    }

    const insertStmt = ctx.db.prepare(`
      INSERT INTO neonatal_inotrope_flowsheet_logs (
        sepsis_episode_id, patient_id, log_datetime, hours_on_inotropes,
        heart_rate_bpm, blood_pressure_systolic, blood_pressure_diastolic, map_mmhg,
        pre_ductal_spo2, post_ductal_spo2, delta_spo2,
        svc_flow_ml_kg_min, urine_output_ml_kg_hr,
        dopamine_mcg_kg_min, dobutamine_mcg_kg_min, epinephrine_mcg_kg_min,
        milrinone_mcg_kg_min, hydrocortisone_mg_kg, ino_ppm, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      id,
      episode.patient_id,
      body.logDatetime,
      body.hoursOnInotropes,
      body.heartRateBpm ?? null,
      body.bloodPressureSystolic ?? null,
      body.bloodPressureDiastolic ?? null,
      mapMmhg,
      body.preDuctalSpo2 ?? null,
      body.postDuctalSpo2 ?? null,
      deltaSpo2,
      body.svcFlowMlKgMin ?? null,
      body.urineOutputMlKgHr ?? null,
      body.dopamineMcgKgMin,
      body.dobutamineMcgKgMin,
      body.epinephrineMcgKgMin,
      body.milrinoneMcgKgMin,
      body.hydrocortisoneMgKg,
      body.inoPpm,
      body.notes ?? null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    // Auto-escalate status if on inotropes
    if ((body.dopamineMcgKgMin > 0 || body.epinephrineMcgKgMin > 0) && episode.status === 'evaluating') {
      ctx.db.prepare("UPDATE neonatal_sepsis_episodes SET status = 'escalated_septic_shock' WHERE id = ?").run(id);
    }

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_sepsis.inotrope_log',
      entity: 'neonatal_inotrope_flowsheet_logs',
      entityId: logId,
      detail: {
        sepsisEpisodeId: id,
        dopamine: body.dopamineMcgKgMin,
        epinephrine: body.epinephrineMcgKgMin,
        mapMmhg,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM neonatal_inotrope_flowsheet_logs WHERE id = ?').get(logId);
    return reply.status(201).send({ log: created });
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-sepsis/flowsheet-logs/:logId', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only physicians may remove flowsheet records');
    }
    const { logId } = req.params as { logId: string };

    const existing = ctx.db.prepare('SELECT * FROM neonatal_inotrope_flowsheet_logs WHERE id = ?').get(logId) as any;
    if (!existing) throw notFound('Inotrope flowsheet log not found');

    ctx.db.prepare('DELETE FROM neonatal_inotrope_flowsheet_logs WHERE id = ?').run(logId);

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_sepsis.inotrope_delete',
      entity: 'neonatal_inotrope_flowsheet_logs',
      entityId: logId,
      detail: { sepsisEpisodeId: existing.sepsis_episode_id },
    });

    return reply.send({ success: true, message: 'Log deleted' });
  });

  // 9. Audit Print Event
  app.post('/api/neonatal-sepsis/episodes/:id/audit-print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const episode = ctx.db.prepare('SELECT * FROM neonatal_sepsis_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal sepsis episode not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_sepsis.print',
      entity: 'neonatal_sepsis_episodes',
      entityId: id,
      detail: { episodeCode: episode.episode_code, patientId: episode.patient_id },
    });

    return reply.send({ success: true });
  });
}
