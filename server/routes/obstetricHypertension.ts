import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluateSevereHypertension,
  getNextHypertensiveStep,
  evaluatePpcmBoardCriteria,
  calculateMap,
} from '../../web/src/obstetricHypertensionEngine.js';

function assertCanManageObstetricHypertension(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and obstetric nursing staff can manage obstetric hypertensive crisis records');
  }
  return user;
}

export const obstetricHypertensiveCrisisSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  crisisDatetime: z.string().min(1, 'Crisis datetime is required'),
  gestationWeeks: z.number().min(10).max(44).nullable().optional(),
  onsetPhase: z.enum(['antepartum', 'intrapartum', 'postpartum']).default('antepartum'),
  initialSbp: z.number().int().min(70).max(280),
  initialDbp: z.number().int().min(40).max(180),
  firstLineAgent: z.enum(['labetalol', 'hydralazine', 'nifedipine']).default('labetalol'),
  asthmaHistory: z.boolean().default(false),
  bradycardiaHistory: z.boolean().default(false),
  mgso4CoAdministered: z.boolean().default(false),
  fetalHeartRateStatus: z.enum(['normal', 'category_1', 'category_2', 'category_3', 'postpartum_na']).default('normal'),
  ppcmScreenPositive: z.boolean().default(false),
  lvefPercent: z.number().min(10).max(80).nullable().optional(),
  ntProBnpPgMl: z.number().min(0).max(50000).nullable().optional(),
  troponinINgMl: z.number().min(0).max(50).nullable().optional(),
  boardBromocriptineStarted: z.boolean().default(false),
  boardOralHfRx: z.string().max(500).nullable().optional(),
  boardAnticoagulationStarted: z.boolean().default(false),
  boardDiureticsStarted: z.boolean().default(false),
  status: z.enum(['active_crisis', 'controlled_surveillance', 'resolved', 'icu_transferred']).default('active_crisis'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const obstetricHypertensiveDoseLogSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  stepNumber: z.number().int().min(1).max(20).default(1),
  sbp: z.number().int().min(60).max(280),
  dbp: z.number().int().min(30).max(180),
  medicationAdministered: z.string().min(1, 'Medication name is required'),
  doseValue: z.number().min(0.1).max(500),
  doseUnit: z.string().default('mg'),
  route: z.string().default('IV'),
  fetalHeartRate: z.number().int().min(50).max(220).nullable().optional(),
  maternalSymptoms: z.string().max(500).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerObstetricHypertensionRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List crises
  app.get('/api/obstetric-hypertension/crises', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT c.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_name
      FROM obstetric_hypertensive_crises c
      JOIN patients pat ON c.patient_id = pat.id
      JOIN users u ON c.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` AND c.patient_id = ?`;
      params.push(parseInt(patientId, 10));
    }
    if (status) {
      query += ` AND c.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY c.crisis_datetime DESC`;
    const rows = ctx.db.prepare(query).all(...params);
    return reply.send({ crises: rows });
  });

  // 2. Get single crisis with dose logs
  app.get('/api/obstetric-hypertension/crises/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const crisis = ctx.db.prepare(`
      SELECT c.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_name
      FROM obstetric_hypertensive_crises c
      JOIN patients pat ON c.patient_id = pat.id
      JOIN users u ON c.consultant_id = u.id
      WHERE c.id = ?
    `).get(id);

    if (!crisis) throw notFound('Obstetric hypertensive crisis record not found');

    const doseLogs = ctx.db.prepare(`
      SELECT d.*, u.full_name as logged_by_name
      FROM obstetric_hypertensive_dose_logs d
      JOIN users u ON d.logged_by_id = u.id
      WHERE d.crisis_id = ?
      ORDER BY d.step_number ASC, d.log_datetime ASC
    `).all(id);

    return reply.send({ crisis, doseLogs });
  });

  // 3. Clinical Calculator endpoint
  app.post('/api/obstetric-hypertension/calculate', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as any;

    const sbp = Number(body.sbp) || 120;
    const dbp = Number(body.dbp) || 80;
    const asthmaHistory = Boolean(body.asthmaHistory);
    const bradycardiaHistory = Boolean(body.bradycardiaHistory);

    const screenResult = evaluateSevereHypertension({
      sbp,
      dbp,
      asthmaHistory,
      bradycardiaHistory,
    });

    const stepRecommendation = getNextHypertensiveStep({
      agent: body.agent || screenResult.recommendedFirstLine,
      currentStep: Number(body.currentStep) || 1,
      currentSbp: sbp,
      currentDbp: dbp,
      initialMap: Number(body.initialMap) || screenResult.mapMmhg,
      cumulativeLabetalolMg: Number(body.cumulativeLabetalolMg) || 0,
      cumulativeHydralazineMg: Number(body.cumulativeHydralazineMg) || 0,
      cumulativeNifedipineMg: Number(body.cumulativeNifedipineMg) || 0,
    });

    let ppcmResult = null;
    if (body.lvefPercent !== undefined || body.dyspneaOrOrthopnea !== undefined) {
      ppcmResult = evaluatePpcmBoardCriteria({
        lvefPercent: body.lvefPercent !== undefined ? Number(body.lvefPercent) : undefined,
        ntProBnpPgMl: body.ntProBnpPgMl !== undefined ? Number(body.ntProBnpPgMl) : undefined,
        troponinINgMl: body.troponinINgMl !== undefined ? Number(body.troponinINgMl) : undefined,
        dyspneaOrOrthopnea: Boolean(body.dyspneaOrOrthopnea),
        peripheralEdema: Boolean(body.peripheralEdema),
        pulmonaryCrackles: Boolean(body.pulmonaryCrackles),
        onsetWeeksPostpartumOrGestation: Number(body.onsetWeeksPostpartumOrGestation) || 38,
        isPostpartum: Boolean(body.isPostpartum),
      });
    }

    return reply.send({
      screenResult,
      stepRecommendation,
      ppcmResult,
    });
  });

  // 4. Create Hypertensive Crisis Record
  app.post('/api/obstetric-hypertension/crises', async (req, reply) => {
    const user = assertCanManageObstetricHypertension(req);
    const body = parse(obstetricHypertensiveCrisisSchema, req.body);

    const crisisCode = `OHTN-${Date.now().toString().slice(-6)}`;
    const initialMap = calculateMap(body.initialSbp, body.initialDbp);

    const firstLine = body.asthmaHistory || body.bradycardiaHistory ? 'hydralazine' : body.firstLineAgent;

    const insertStmt = ctx.db.prepare(`
      INSERT INTO obstetric_hypertensive_crises (
        patient_id, admission_id, crisis_code, crisis_datetime,
        gestation_weeks, onset_phase, initial_sbp, initial_dbp, initial_map,
        first_line_agent, asthma_history, bradycardia_history, mgso4_co_administered,
        cumulative_labetalol_mg, cumulative_hydralazine_mg, cumulative_nifedipine_mg,
        final_sbp, final_dbp, final_map, blood_pressure_controlled,
        fetal_heart_rate_status, ppcm_screen_positive, lvef_percent,
        nt_pro_bnp_pg_ml, troponin_i_ng_ml,
        board_bromocriptine_started, board_oral_hf_rx,
        board_anticoagulation_started, board_diuretics_started,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        0, 0, 0,
        ?, ?, ?, 0,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      body.patientId,
      body.admissionId ?? null,
      crisisCode,
      body.crisisDatetime,
      body.gestationWeeks ?? null,
      body.onsetPhase,
      body.initialSbp,
      body.initialDbp,
      initialMap,
      firstLine,
      body.asthmaHistory ? 1 : 0,
      body.bradycardiaHistory ? 1 : 0,
      body.mgso4CoAdministered ? 1 : 0,
      body.initialSbp,
      body.initialDbp,
      initialMap,
      body.fetalHeartRateStatus,
      body.ppcmScreenPositive ? 1 : 0,
      body.lvefPercent ?? null,
      body.ntProBnpPgMl ?? null,
      body.troponinINgMl ?? null,
      body.boardBromocriptineStarted ? 1 : 0,
      body.boardOralHfRx ?? null,
      body.boardAnticoagulationStarted ? 1 : 0,
      body.boardDiureticsStarted ? 1 : 0,
      body.status,
      user.id,
      body.clinicalNotes ?? null
    );

    const crisisId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'obstetric_hypertension.crisis_create',
      entity: 'obstetric_hypertensive_crises',
      entityId: crisisId,
      detail: {
        crisisCode,
        patientId: body.patientId,
        initialSbp: body.initialSbp,
        initialDbp: body.initialDbp,
        firstLineAgent: firstLine,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_crises WHERE id = ?').get(crisisId);
    return reply.status(201).send({ crisis: created });
  });

  // 5. Update Crisis Record
  app.put('/api/obstetric-hypertension/crises/:id', async (req, reply) => {
    const user = assertCanManageObstetricHypertension(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_crises WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric hypertensive crisis record not found');

    const body = req.body as any;

    let finalMap: number | null = null;
    if (body.finalSbp !== undefined && body.finalDbp !== undefined) {
      finalMap = calculateMap(Number(body.finalSbp), Number(body.finalDbp));
    }

    ctx.db.prepare(`
      UPDATE obstetric_hypertensive_crises
      SET status = COALESCE(?, status),
          blood_pressure_controlled = COALESCE(?, blood_pressure_controlled),
          final_sbp = COALESCE(?, final_sbp),
          final_dbp = COALESCE(?, final_dbp),
          final_map = COALESCE(?, final_map),
          fetal_heart_rate_status = COALESCE(?, fetal_heart_rate_status),
          ppcm_screen_positive = COALESCE(?, ppcm_screen_positive),
          lvef_percent = COALESCE(?, lvef_percent),
          nt_pro_bnp_pg_ml = COALESCE(?, nt_pro_bnp_pg_ml),
          troponin_i_ng_ml = COALESCE(?, troponin_i_ng_ml),
          board_bromocriptine_started = COALESCE(?, board_bromocriptine_started),
          board_oral_hf_rx = COALESCE(?, board_oral_hf_rx),
          board_anticoagulation_started = COALESCE(?, board_anticoagulation_started),
          board_diuretics_started = COALESCE(?, board_diuretics_started),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.status ?? null,
      body.bloodPressureControlled !== undefined ? (body.bloodPressureControlled ? 1 : 0) : null,
      body.finalSbp ?? null,
      body.finalDbp ?? null,
      finalMap,
      body.fetalHeartRateStatus ?? null,
      body.ppcmScreenPositive !== undefined ? (body.ppcmScreenPositive ? 1 : 0) : null,
      body.lvefPercent ?? null,
      body.ntProBnpPgMl ?? null,
      body.troponinINgMl ?? null,
      body.boardBromocriptineStarted !== undefined ? (body.boardBromocriptineStarted ? 1 : 0) : null,
      body.boardOralHfRx ?? null,
      body.boardAnticoagulationStarted !== undefined ? (body.boardAnticoagulationStarted ? 1 : 0) : null,
      body.boardDiureticsStarted !== undefined ? (body.boardDiureticsStarted ? 1 : 0) : null,
      body.clinicalNotes ?? null,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'obstetric_hypertension.crisis_update',
      entity: 'obstetric_hypertensive_crises',
      entityId: id,
      detail: { status: body.status, bloodPressureControlled: body.bloodPressureControlled },
    });

    const updated = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_crises WHERE id = ?').get(id);
    return reply.send({ crisis: updated });
  });

  // 6. Delete Crisis Record
  app.delete('/api/obstetric-hypertension/crises/:id', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only physicians may delete hypertensive crisis records');
    }
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_crises WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Obstetric hypertensive crisis record not found');

    ctx.db.prepare('DELETE FROM obstetric_hypertensive_crises WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'obstetric_hypertension.crisis_delete',
      entity: 'obstetric_hypertensive_crises',
      entityId: id,
      detail: { crisisCode: existing.crisis_code, patientId: existing.patient_id },
    });

    return reply.send({ success: true, message: 'Crisis record deleted' });
  });

  // 7. Add Dose Administration Log
  app.post('/api/obstetric-hypertension/crises/:id/dose-logs', async (req, reply) => {
    const user = assertCanManageObstetricHypertension(req);
    const { id } = req.params as { id: string };

    const crisis = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_crises WHERE id = ?').get(id) as any;
    if (!crisis) throw notFound('Obstetric hypertensive crisis record not found');

    const body = parse(obstetricHypertensiveDoseLogSchema, req.body);
    const mapMmhg = calculateMap(body.sbp, body.dbp);

    const insertStmt = ctx.db.prepare(`
      INSERT INTO obstetric_hypertensive_dose_logs (
        crisis_id, patient_id, log_datetime, step_number,
        sbp, dbp, map_mmhg, medication_administered, dose_value, dose_unit, route,
        fetal_heart_rate, maternal_symptoms, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      id,
      crisis.patient_id,
      body.logDatetime,
      body.stepNumber,
      body.sbp,
      body.dbp,
      mapMmhg,
      body.medicationAdministered,
      body.doseValue,
      body.doseUnit,
      body.route,
      body.fetalHeartRate ?? null,
      body.maternalSymptoms ?? null,
      body.notes ?? null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    // Track cumulative doses
    const medLower = body.medicationAdministered.toLowerCase();
    let addLab = 0;
    let addHyd = 0;
    let addNif = 0;
    if (medLower.includes('labetalol')) addLab = body.doseValue;
    else if (medLower.includes('hydralazine')) addHyd = body.doseValue;
    else if (medLower.includes('nifedipine')) addNif = body.doseValue;

    const isControlled = body.sbp < 160 && body.dbp < 110;

    ctx.db.prepare(`
      UPDATE obstetric_hypertensive_crises
      SET cumulative_labetalol_mg = cumulative_labetalol_mg + ?,
          cumulative_hydralazine_mg = cumulative_hydralazine_mg + ?,
          cumulative_nifedipine_mg = cumulative_nifedipine_mg + ?,
          final_sbp = ?,
          final_dbp = ?,
          final_map = ?,
          blood_pressure_controlled = CASE WHEN ? THEN 1 ELSE blood_pressure_controlled END,
          status = CASE WHEN ? AND status = 'active_crisis' THEN 'controlled_surveillance' ELSE status END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      addLab,
      addHyd,
      addNif,
      body.sbp,
      body.dbp,
      mapMmhg,
      isControlled ? 1 : 0,
      isControlled ? 1 : 0,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'obstetric_hypertension.dose_log',
      entity: 'obstetric_hypertensive_dose_logs',
      entityId: logId,
      detail: {
        crisisId: id,
        medication: body.medicationAdministered,
        dose: body.doseValue,
        sbp: body.sbp,
        dbp: body.dbp,
        isControlled,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_dose_logs WHERE id = ?').get(logId);
    return reply.status(201).send({ log: created, isControlled });
  });

  // 8. Delete Dose Log
  app.delete('/api/obstetric-hypertension/dose-logs/:logId', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only physicians may remove dose logs');
    }
    const { logId } = req.params as { logId: string };

    const existing = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_dose_logs WHERE id = ?').get(logId) as any;
    if (!existing) throw notFound('Dose log not found');

    ctx.db.prepare('DELETE FROM obstetric_hypertensive_dose_logs WHERE id = ?').run(logId);

    audit(ctx.db, {
      actorId: user.id,
      action: 'obstetric_hypertension.dose_delete',
      entity: 'obstetric_hypertensive_dose_logs',
      entityId: logId,
      detail: { crisisId: existing.crisis_id },
    });

    return reply.send({ success: true, message: 'Dose log removed' });
  });

  // 9. Audit Print Event
  app.post('/api/obstetric-hypertension/crises/:id/audit-print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const crisis = ctx.db.prepare('SELECT * FROM obstetric_hypertensive_crises WHERE id = ?').get(id) as any;
    if (!crisis) throw notFound('Obstetric hypertensive crisis record not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'obstetric_hypertension.print',
      entity: 'obstetric_hypertensive_crises',
      entityId: id,
      detail: { crisisCode: crisis.crisis_code, patientId: crisis.patient_id },
    });

    return reply.send({ success: true });
  });
}
