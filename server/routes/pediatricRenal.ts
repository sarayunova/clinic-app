import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageRenal(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only pediatric, neonatal, or clinical nursing staff can manage renal assessments and peritoneal dialysis records');
  }
  return user;
}

function assertCanDeleteRenal(req: FastifyRequest) {
  const user = requireUser(req);
  if (user.role !== 'doctor') {
    throw forbidden('Only physicians can delete pediatric renal records');
  }
  return user;
}

const optNullableNumber = (min: number, max: number) =>
  z.number().min(min).max(max).nullable().optional();

export const renalAssessmentSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  patientCategory: z.enum([
    'preterm_infant',
    'term_infant',
    'child',
    'adolescent_female',
    'adolescent_male',
  ]),
  heightCm: z.number().positive().max(250),
  dryWeightKg: z.number().positive().max(150),
  currentWeightKg: z.number().positive().max(150),
  baselineCreatinineMgDl: z.number().positive().max(20),
  currentCreatinineMgDl: z.number().positive().max(20),
  urineOutputMl: optNullableNumber(0, 10000),
  urineOutputHours: optNullableNumber(1, 48),
  serumSodiumMeqL: optNullableNumber(80, 200),
  urineSodiumMeqL: optNullableNumber(0, 300),
  serumBunMgDl: optNullableNumber(1, 300),
  urineUreaMgDl: optNullableNumber(0, 3000),
  urineCreatinineMgDl: optNullableNumber(1, 500),
  nephrotoxicMedications: z.array(z.string()).default([]),
  clinicalActionPlan: z.string().max(2000).nullable().optional(),
});

export const pdSessionSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  startDatetime: z.string().min(1, 'Start datetime is required'),
  indication: z.enum([
    'kdigo_stage_3_aki',
    'severe_fluid_overload_gt20',
    'refractory_hyperkalemia',
    'severe_metabolic_acidosis',
    'inborn_error_metabolism',
    'uremic_encephalopathy',
    'other',
  ]),
  catheterType: z.enum([
    'acute_rigid_percutaneous',
    'flexible_curved_cook',
    'tenckhoff_single_cuff',
    'tenckhoff_double_cuff',
    'other',
  ]),
  catheterInsertionDate: z.string().nullable().optional(),
  patientWeightKg: z.number().positive().max(150),
  solutionType: z.enum([
    'dextrose_1_5',
    'dextrose_2_5',
    'dextrose_4_25',
    'custom_compound',
  ]),
  fillVolumeMlPerKg: z.number().positive().max(60),
  inflowTimeMinutes: z.number().int().min(5).max(60).default(15),
  dwellTimeMinutes: z.number().int().min(10).max(240).default(45),
  drainTimeMinutes: z.number().int().min(5).max(60).default(20),
  targetCyclesCount: z.number().int().min(1).max(100).default(12),
  heparinUnitsPerLiter: z.number().min(0).max(5000).default(500),
  potassiumMeqPerLiter: z.number().min(0).max(10).default(0),
  antibioticAdditive: z.string().max(255).nullable().optional(),
});

export const pdCycleSchema = z.object({
  cycleNumber: z.number().int().positive(),
  cycleStartTime: z.string().min(1, 'Cycle start time is required'),
  inflowMl: z.number().min(0).max(5000),
  dwellDurationMinutes: z.number().int().min(0).max(360),
  outflowMl: z.number().min(0).max(5000),
  effluentAppearance: z.enum([
    'clear_straw',
    'hazy',
    'cloudy_turbid',
    'blood_tinged',
    'frank_blood',
    'fibrin_clots',
  ]),
  abdominalGirthCm: optNullableNumber(10, 150),
  catheterSiteLeakage: z.boolean().default(false),
  patientTolerance: z.enum([
    'well_tolerated',
    'mild_distress',
    'severe_pain_distension',
    'respiratory_compromise',
  ]).default('well_tolerated'),
  notes: z.string().max(1000).nullable().optional(),
});

export const pdEffluentLabSchema = z.object({
  sampleDatetime: z.string().min(1, 'Sample datetime is required'),
  wbcCountPerMcl: z.number().int().min(0).max(500000),
  neutrophilsPercent: z.number().min(0).max(100),
  gramStain: z.string().max(255).nullable().optional(),
  cultureGrowth: z.string().max(255).nullable().optional(),
  empiricAntibioticInitiated: z.string().max(255).nullable().optional(),
});

export function registerPediatricRenalRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List or search renal assessments
  app.get('/api/pediatric-renal/assessments', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { patientId?: string; limit?: string };
    const patientId = query.patientId ? Number(query.patientId) : null;
    const limit = Math.min(Number(query.limit) || 50, 100);

    let sql = `
      SELECT a.*,
             p.full_name as patient_name,
             p.patient_number as patient_uhid,
             p.date_of_birth as patient_dob,
             u.full_name as assessed_by_name
      FROM pediatric_renal_assessments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.assessed_by_id = u.id
    `;
    const params: (string | number | null)[] = [];

    if (patientId) {
      sql += ' WHERE a.patient_id = ?';
      params.push(patientId);
    }

    sql += ' ORDER BY a.assessment_datetime DESC LIMIT ?';
    params.push(limit);

    const rows = ctx.db.prepare(sql).all(...params);
    return reply.send({ assessments: rows });
  });

  // 2. Create pediatric renal assessment with auto KDIGO & Schwartz calculation
  app.post('/api/pediatric-renal/assessments', async (req, reply) => {
    const user = assertCanManageRenal(req);
    const body = parse(renalAssessmentSchema, req.body);

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patientId);
    if (!patient) {
      throw notFound('Patient not found');
    }

    // 1. Calculate Bedside Schwartz eGFR
    let k = 0.413;
    if (body.patientCategory === 'preterm_infant') k = 0.33;
    else if (body.patientCategory === 'term_infant') k = 0.45;
    else if (body.patientCategory === 'adolescent_female') k = 0.55;
    else if (body.patientCategory === 'adolescent_male') k = 0.70;

    const calculatedEgfr = Math.round(((k * body.heightCm) / body.currentCreatinineMgDl) * 10) / 10;

    // 2. Fluid Overload %
    const calculatedFluidOverloadPct =
      Math.round((((body.currentWeightKg - body.dryWeightKg) / body.dryWeightKg) * 100) * 10) / 10;

    // 3. Hourly UOP (mL/kg/h)
    let calculatedUopMlKgH: number | null = null;
    if (body.urineOutputMl !== null && body.urineOutputMl !== undefined && body.urineOutputHours) {
      calculatedUopMlKgH =
        Math.round((body.urineOutputMl / (body.currentWeightKg * body.urineOutputHours)) * 100) / 100;
    }

    // 4. KDIGO SCr Stage
    const isNeonate = body.patientCategory === 'preterm_infant' || body.patientCategory === 'term_infant';
    const scrDelta = body.currentCreatinineMgDl - body.baselineCreatinineMgDl;
    const scrRatio = body.baselineCreatinineMgDl > 0 ? body.currentCreatinineMgDl / body.baselineCreatinineMgDl : 1.0;

    let kdigoScrStage = 0;
    if ((isNeonate && body.currentCreatinineMgDl >= 2.5) || scrRatio >= 3.0) {
      kdigoScrStage = 3;
    } else if (scrRatio >= 2.0) {
      kdigoScrStage = 2;
    } else if (scrDelta >= 0.3 || scrRatio >= 1.5) {
      kdigoScrStage = 1;
    }

    // 5. KDIGO UOP Stage
    let kdigoUopStage: number | null = null;
    if (calculatedUopMlKgH !== null) {
      const duration = body.urineOutputHours || 6;
      if (calculatedUopMlKgH < 0.3 && duration >= 24) {
        kdigoUopStage = 3;
      } else if (calculatedUopMlKgH === 0 && duration >= 12) {
        kdigoUopStage = 3;
      } else if (calculatedUopMlKgH < 0.5 && duration >= 12) {
        kdigoUopStage = 2;
      } else if (isNeonate ? (calculatedUopMlKgH < 1.0 && duration >= 6) : (calculatedUopMlKgH < 0.5 && duration >= 6)) {
        kdigoUopStage = 1;
      } else {
        kdigoUopStage = 0;
      }
    }

    const kdigoOverallStage = Math.max(kdigoScrStage, kdigoUopStage ?? 0);

    // 6. Urinary Indices (FENa / FEUrea)
    let calculatedFenaPct: number | null = null;
    let calculatedFeureaPct: number | null = null;
    let prerenalVsAtn: 'prerenal' | 'intrinsic_atn' | 'indeterminate' | 'not_evaluated' = 'not_evaluated';

    if (
      body.serumSodiumMeqL &&
      body.urineSodiumMeqL !== null &&
      body.urineSodiumMeqL !== undefined &&
      body.currentCreatinineMgDl &&
      body.urineCreatinineMgDl
    ) {
      calculatedFenaPct =
        Math.round(((body.urineSodiumMeqL * body.currentCreatinineMgDl) / (body.serumSodiumMeqL * body.urineCreatinineMgDl)) * 1000) / 10;
    }

    if (
      body.serumBunMgDl &&
      body.urineUreaMgDl !== null &&
      body.urineUreaMgDl !== undefined &&
      body.currentCreatinineMgDl &&
      body.urineCreatinineMgDl
    ) {
      calculatedFeureaPct =
        Math.round(((body.urineUreaMgDl * body.currentCreatinineMgDl) / (body.serumBunMgDl * body.urineCreatinineMgDl)) * 1000) / 10;
    }

    const fenaThreshold = isNeonate ? 2.5 : 1.0;
    if (calculatedFenaPct !== null) {
      prerenalVsAtn = calculatedFenaPct < fenaThreshold ? 'prerenal' : 'intrinsic_atn';
    } else if (calculatedFeureaPct !== null) {
      prerenalVsAtn = calculatedFeureaPct < 35.0 ? 'prerenal' : 'intrinsic_atn';
    }

    const result = ctx.db
      .prepare(
        `INSERT INTO pediatric_renal_assessments (
          patient_id, assessment_datetime, patient_category, height_cm, dry_weight_kg, current_weight_kg,
          baseline_creatinine_mg_dl, current_creatinine_mg_dl, urine_output_ml, urine_output_hours,
          serum_sodium_meq_l, urine_sodium_meq_l, serum_bun_mg_dl, urine_urea_mg_dl, urine_creatinine_mg_dl,
          calculated_egfr, calculated_uop_ml_kg_h, calculated_fluid_overload_pct, calculated_fena_pct,
          calculated_feurea_pct, kdigo_scr_stage, kdigo_uop_stage, kdigo_overall_stage, prerenal_vs_atn,
          nephrotoxic_medications, clinical_action_plan, assessed_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.patientId,
        body.assessmentDatetime,
        body.patientCategory,
        body.heightCm,
        body.dryWeightKg,
        body.currentWeightKg,
        body.baselineCreatinineMgDl,
        body.currentCreatinineMgDl,
        body.urineOutputMl ?? null,
        body.urineOutputHours ?? null,
        body.serumSodiumMeqL ?? null,
        body.urineSodiumMeqL ?? null,
        body.serumBunMgDl ?? null,
        body.urineUreaMgDl ?? null,
        body.urineCreatinineMgDl ?? null,
        calculatedEgfr,
        calculatedUopMlKgH,
        calculatedFluidOverloadPct,
        calculatedFenaPct,
        calculatedFeureaPct,
        kdigoScrStage,
        kdigoUopStage,
        kdigoOverallStage,
        prerenalVsAtn,
        JSON.stringify(body.nephrotoxicMedications),
        body.clinicalActionPlan ?? null,
        user.id
      );

    const inserted = ctx.db
      .prepare('SELECT * FROM pediatric_renal_assessments WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.assessment_create',
      entity: 'pediatric_renal_assessments',
      entityId: Number(result.lastInsertRowid),
      detail: {
        assessmentId: Number(result.lastInsertRowid),
        patientId: body.patientId,
        kdigoOverallStage,
        calculatedEgfr,
        calculatedFluidOverloadPct,
      },
    });

    return reply.status(201).send({ assessment: inserted });
  });

  // 3. Get single assessment
  app.get('/api/pediatric-renal/assessments/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const assessment = ctx.db
      .prepare(
        `SELECT a.*,
                p.full_name as patient_name,
                p.patient_number as patient_uhid,
                p.date_of_birth as patient_dob,
                u.full_name as assessed_by_name
         FROM pediatric_renal_assessments a
         JOIN patients p ON a.patient_id = p.id
         JOIN users u ON a.assessed_by_id = u.id
         WHERE a.id = ?`
      )
      .get(Number(id));

    if (!assessment) {
      throw notFound('Renal assessment not found');
    }

    return reply.send({ assessment });
  });

  // 4. Delete assessment (Doctor / Admin only)
  app.delete('/api/pediatric-renal/assessments/:id', async (req, reply) => {
    const user = assertCanDeleteRenal(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM pediatric_renal_assessments WHERE id = ?').get(Number(id));
    if (!existing) {
      throw notFound('Renal assessment not found');
    }

    ctx.db.prepare('DELETE FROM pediatric_renal_assessments WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.assessment_delete',
      entity: 'pediatric_renal_assessments',
      entityId: Number(id),
      detail: { assessmentId: Number(id) },
    });

    return reply.send({ success: true, message: 'Assessment deleted' });
  });

  // 5. List Peritoneal Dialysis Sessions
  app.get('/api/pediatric-renal/pd-sessions', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { patientId?: string; status?: string };
    const patientId = query.patientId ? Number(query.patientId) : null;
    const status = query.status || null;

    let sql = `
      SELECT s.*,
             p.full_name as patient_name,
             p.patient_number as patient_uhid,
             p.date_of_birth as patient_dob,
             u.full_name as prescribed_by_name,
             cu.full_name as completed_by_name,
             (SELECT COUNT(*) FROM pd_cycle_flowsheet_logs WHERE session_id = s.id) as total_cycles_logged
      FROM peritoneal_dialysis_sessions s
      JOIN patients p ON s.patient_id = p.id
      JOIN users u ON s.prescribed_by_id = u.id
      LEFT JOIN users cu ON s.completed_by_id = cu.id
    `;
    const params: (string | number | null)[] = [];
    const conditions: string[] = [];

    if (patientId) {
      conditions.push('s.patient_id = ?');
      params.push(patientId);
    }
    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY s.start_datetime DESC';

    const sessions = ctx.db.prepare(sql).all(...params);
    return reply.send({ sessions });
  });

  // 6. Initiate Acute Peritoneal Dialysis Session
  app.post('/api/pediatric-renal/pd-sessions', async (req, reply) => {
    const user = assertCanManageRenal(req);
    const body = parse(pdSessionSchema, req.body);

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patientId);
    if (!patient) {
      throw notFound('Patient not found');
    }

    // Auto-calculate fill volume (mL) = fillVolumeMlPerKg * patientWeightKg
    const calculatedFillVolumeMl = Math.round(body.fillVolumeMlPerKg * body.patientWeightKg);

    // Generate unique session number: PD-YYYYMMDD-XXXX
    const dateStr = nowIso().slice(0, 10).replace(/-/g, '');
    const randStr = Math.floor(1000 + Math.random() * 9000).toString();
    const sessionNumber = `PD-${dateStr}-${randStr}`;

    const result = ctx.db
      .prepare(
        `INSERT INTO peritoneal_dialysis_sessions (
          patient_id, session_number, start_datetime, indication, catheter_type, catheter_insertion_date,
          patient_weight_kg, solution_type, fill_volume_ml_per_kg, calculated_fill_volume_ml,
          inflow_time_minutes, dwell_time_minutes, drain_time_minutes, target_cycles_count,
          heparin_units_per_liter, potassium_meq_per_liter, antibiotic_additive, status, prescribed_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .run(
        body.patientId,
        sessionNumber,
        body.startDatetime,
        body.indication,
        body.catheterType,
        body.catheterInsertionDate ?? null,
        body.patientWeightKg,
        body.solutionType,
        body.fillVolumeMlPerKg,
        calculatedFillVolumeMl,
        body.inflowTimeMinutes,
        body.dwellTimeMinutes,
        body.drainTimeMinutes,
        body.targetCyclesCount,
        body.heparinUnitsPerLiter,
        body.potassiumMeqPerLiter,
        body.antibioticAdditive ?? null,
        user.id
      );

    const inserted = ctx.db
      .prepare('SELECT * FROM peritoneal_dialysis_sessions WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.pd_session_create',
      entity: 'peritoneal_dialysis_sessions',
      entityId: Number(result.lastInsertRowid),
      detail: {
        sessionId: Number(result.lastInsertRowid),
        patientId: body.patientId,
        sessionNumber,
        indication: body.indication,
        solutionType: body.solutionType,
      },
    });

    return reply.status(201).send({ session: inserted });
  });

  // 7. Get single PD Session with all cycle logs & effluent surveillance
  app.get('/api/pediatric-renal/pd-sessions/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const session = ctx.db
      .prepare(
        `SELECT s.*,
                p.full_name as patient_name,
                p.patient_number as patient_uhid,
                p.date_of_birth as patient_dob,
                u.full_name as prescribed_by_name,
                cu.full_name as completed_by_name
         FROM peritoneal_dialysis_sessions s
         JOIN patients p ON s.patient_id = p.id
         JOIN users u ON s.prescribed_by_id = u.id
         LEFT JOIN users cu ON s.completed_by_id = cu.id
         WHERE s.id = ?`
      )
      .get(Number(id));

    if (!session) {
      throw notFound('Peritoneal dialysis session not found');
    }

    const cycles = ctx.db
      .prepare(
        `SELECT c.*, u.full_name as nurse_name
         FROM pd_cycle_flowsheet_logs c
         JOIN users u ON c.nurse_id = u.id
         WHERE c.session_id = ?
         ORDER BY c.cycle_number ASC`
      )
      .all(Number(id));

    const effluentLabs = ctx.db
      .prepare(
        `SELECT e.*, u.full_name as logged_by_name
         FROM pd_effluent_surveillance e
         JOIN users u ON e.logged_by_id = u.id
         WHERE e.session_id = ?
         ORDER BY e.sample_datetime DESC`
      )
      .all(Number(id));

    return reply.send({ session, cycles, effluentLabs });
  });

  // 8. Update PD session status (Complete or Abort)
  app.put('/api/pediatric-renal/pd-sessions/:id/status', async (req, reply) => {
    const user = assertCanManageRenal(req);
    const { id } = req.params as { id: string };
    const schema = z.object({
      status: z.enum(['completed', 'aborted', 'active']),
      deactivationReason: z.string().max(500).optional(),
    });
    const body = parse(schema, req.body);

    const session = ctx.db.prepare('SELECT * FROM peritoneal_dialysis_sessions WHERE id = ?').get(Number(id));
    if (!session) {
      throw notFound('Peritoneal dialysis session not found');
    }

    const endDatetime = body.status !== 'active' ? nowIso() : null;
    const completedById = body.status !== 'active' ? user.id : null;

    ctx.db
      .prepare(
        `UPDATE peritoneal_dialysis_sessions
         SET status = ?, end_datetime = ?, deactivation_reason = ?, completed_by_id = ?
         WHERE id = ?`
      )
      .run(body.status, endDatetime, body.deactivationReason ?? null, completedById, Number(id));

    const updated = ctx.db.prepare('SELECT * FROM peritoneal_dialysis_sessions WHERE id = ?').get(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.pd_session_update_status',
      entity: 'peritoneal_dialysis_sessions',
      entityId: Number(id),
      detail: { sessionId: Number(id), newStatus: body.status, reason: body.deactivationReason },
    });

    return reply.send({ session: updated });
  });

  // 9. Log Bedside Peritoneal Dialysis Cycle
  app.post('/api/pediatric-renal/pd-sessions/:id/cycles', async (req, reply) => {
    const user = assertCanManageRenal(req);
    const { id } = req.params as { id: string };
    const body = parse(pdCycleSchema, req.body);

    const session = ctx.db.prepare('SELECT * FROM peritoneal_dialysis_sessions WHERE id = ?').get(Number(id)) as
      | {
          id: number;
          status: string;
          cumulative_inflow_ml: number;
          cumulative_outflow_ml: number;
          cumulative_net_uf_ml: number;
        }
      | undefined;

    if (!session) {
      throw notFound('Peritoneal dialysis session not found');
    }
    if (session.status !== 'active') {
      throw badRequest('Cannot log cycles for an inactive peritoneal dialysis session');
    }

    // Net UF for this cycle = outflow - inflow
    const netUfMl = Math.round((body.outflowMl - body.inflowMl) * 10) / 10;
    const prevCumulativeUf = Number(session.cumulative_net_uf_ml || 0);
    const newCumulativeUf = Math.round((prevCumulativeUf + netUfMl) * 10) / 10;

    const result = ctx.db
      .prepare(
        `INSERT INTO pd_cycle_flowsheet_logs (
          session_id, cycle_number, cycle_start_time, inflow_ml, dwell_duration_minutes,
          outflow_ml, net_uf_ml, cumulative_uf_ml, effluent_appearance, abdominal_girth_cm,
          catheter_site_leakage, patient_tolerance, nurse_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number(id),
        body.cycleNumber,
        body.cycleStartTime,
        body.inflowMl,
        body.dwellDurationMinutes,
        body.outflowMl,
        netUfMl,
        newCumulativeUf,
        body.effluentAppearance,
        body.abdominalGirthCm ?? null,
        body.catheterSiteLeakage ? 1 : 0,
        body.patientTolerance,
        user.id,
        body.notes ?? null
      );

    // Update parent session totals
    const newInflow = Number(session.cumulative_inflow_ml || 0) + body.inflowMl;
    const newOutflow = Number(session.cumulative_outflow_ml || 0) + body.outflowMl;

    ctx.db
      .prepare(
        `UPDATE peritoneal_dialysis_sessions
         SET cumulative_inflow_ml = ?, cumulative_outflow_ml = ?, cumulative_net_uf_ml = ?
         WHERE id = ?`
      )
      .run(newInflow, newOutflow, newCumulativeUf, Number(id));

    const cycle = ctx.db
      .prepare('SELECT * FROM pd_cycle_flowsheet_logs WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.pd_cycle_log',
      entity: 'pd_cycle_flowsheet_logs',
      entityId: Number(result.lastInsertRowid),
      detail: {
        sessionId: Number(id),
        cycleId: Number(result.lastInsertRowid),
        cycleNumber: body.cycleNumber,
        netUfMl,
        cumulativeUfMl: newCumulativeUf,
        effluentAppearance: body.effluentAppearance,
      },
    });

    return reply.status(201).send({ cycle });
  });

  // 10. Delete a cycle log and recalculate totals
  app.delete('/api/pediatric-renal/pd-sessions/:sessionId/cycles/:cycleId', async (req, reply) => {
    const user = assertCanDeleteRenal(req);
    const { sessionId, cycleId } = req.params as { sessionId: string; cycleId: string };

    const cycle = ctx.db
      .prepare('SELECT * FROM pd_cycle_flowsheet_logs WHERE id = ? AND session_id = ?')
      .get(Number(cycleId), Number(sessionId));

    if (!cycle) {
      throw notFound('Cycle flowsheet entry not found');
    }

    ctx.db.prepare('DELETE FROM pd_cycle_flowsheet_logs WHERE id = ?').run(Number(cycleId));

    // Recalculate parent session cumulative totals
    const allCycles = ctx.db
      .prepare('SELECT * FROM pd_cycle_flowsheet_logs WHERE session_id = ? ORDER BY cycle_number ASC')
      .all(Number(sessionId)) as Array<{ id: number; inflow_ml: number; outflow_ml: number }>;

    let runningInflow = 0;
    let runningOutflow = 0;
    let runningNetUf = 0;

    for (const c of allCycles) {
      runningInflow += Number(c.inflow_ml);
      runningOutflow += Number(c.outflow_ml);
      runningNetUf += Number(c.outflow_ml) - Number(c.inflow_ml);
      ctx.db
        .prepare('UPDATE pd_cycle_flowsheet_logs SET cumulative_uf_ml = ? WHERE id = ?')
        .run(runningNetUf, c.id);
    }

    ctx.db
      .prepare(
        `UPDATE peritoneal_dialysis_sessions
         SET cumulative_inflow_ml = ?, cumulative_outflow_ml = ?, cumulative_net_uf_ml = ?
         WHERE id = ?`
      )
      .run(runningInflow, runningOutflow, runningNetUf, Number(sessionId));

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.pd_cycle_delete',
      entity: 'pd_cycle_flowsheet_logs',
      entityId: Number(cycleId),
      detail: { sessionId: Number(sessionId), cycleId: Number(cycleId) },
    });

    return reply.send({ success: true, message: 'Cycle deleted and cumulative UF recalculated' });
  });

  // 11. Log Dialysate Effluent Lab Surveillance (WBC, Neutrophils & Culture)
  app.post('/api/pediatric-renal/pd-sessions/:id/effluent-labs', async (req, reply) => {
    const user = assertCanManageRenal(req);
    const { id } = req.params as { id: string };
    const body = parse(pdEffluentLabSchema, req.body);

    const session = ctx.db.prepare('SELECT id FROM peritoneal_dialysis_sessions WHERE id = ?').get(Number(id));
    if (!session) {
      throw notFound('Peritoneal dialysis session not found');
    }

    // Peritonitis Diagnostic Criteria: WBC > 100/mcL AND Neutrophils > 50%
    const peritonitisConfirmed = body.wbcCountPerMcl > 100 && body.neutrophilsPercent > 50 ? 1 : 0;

    const result = ctx.db
      .prepare(
        `INSERT INTO pd_effluent_surveillance (
          session_id, sample_datetime, wbc_count_per_mcl, neutrophils_percent,
          gram_stain, culture_growth, peritonitis_confirmed, empiric_antibiotic_initiated, logged_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number(id),
        body.sampleDatetime,
        body.wbcCountPerMcl,
        body.neutrophilsPercent,
        body.gramStain ?? null,
        body.cultureGrowth ?? null,
        peritonitisConfirmed,
        body.empiricAntibioticInitiated ?? null,
        user.id
      );

    const record = ctx.db
      .prepare('SELECT * FROM pd_effluent_surveillance WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.pd_effluent_log',
      entity: 'pd_effluent_surveillance',
      entityId: Number(result.lastInsertRowid),
      detail: {
        sessionId: Number(id),
        effluentId: Number(result.lastInsertRowid),
        wbcCountPerMcl: body.wbcCountPerMcl,
        neutrophilsPercent: body.neutrophilsPercent,
        peritonitisConfirmed: peritonitisConfirmed === 1,
      },
    });

    return reply.status(201).send({ effluentLab: record });
  });

  // 12. Pediatric Renal Dashboard
  app.get('/api/pediatric-renal/dashboard', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');

    // Active PD sessions
    const activeSessions = ctx.db
      .prepare(
        `SELECT s.*,
                p.full_name as patient_name,
                p.patient_number as patient_uhid,
                p.date_of_birth as patient_dob,
                (SELECT COUNT(*) FROM pd_cycle_flowsheet_logs WHERE session_id = s.id) as cycles_logged
         FROM peritoneal_dialysis_sessions s
         JOIN patients p ON s.patient_id = p.id
         WHERE s.status = 'active'
         ORDER BY s.start_datetime DESC`
      )
      .all();

    // Patients with Stage 2 or 3 AKI or severe fluid overload
    const highRiskRenalPatients = ctx.db
      .prepare(
        `SELECT a.*,
                p.full_name as patient_name,
                p.patient_number as patient_uhid,
                p.date_of_birth as patient_dob
         FROM pediatric_renal_assessments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.kdigo_overall_stage >= 2 OR a.calculated_fluid_overload_pct >= 10.0
         ORDER BY a.assessment_datetime DESC
         LIMIT 20`
      )
      .all();

    // Recent Peritonitis Alerts
    const peritonitisAlerts = ctx.db
      .prepare(
        `SELECT e.*, s.session_number, s.patient_id, p.full_name as patient_name, p.patient_number as patient_uhid
         FROM pd_effluent_surveillance e
         JOIN peritoneal_dialysis_sessions s ON e.session_id = s.id
         JOIN patients p ON s.patient_id = p.id
         WHERE e.peritonitis_confirmed = 1
         ORDER BY e.sample_datetime DESC
         LIMIT 10`
      )
      .all();

    return reply.send({
      activeSessions,
      highRiskRenalPatients,
      peritonitisAlerts,
    });
  });

  // 13. Printable Dossier Audit
  app.post('/api/pediatric-renal/pd-sessions/:id/print', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_renal.print',
      entity: 'peritoneal_dialysis_sessions',
      entityId: Number(id),
      detail: { sessionId: Number(id) },
    });

    return reply.send({ success: true, message: 'Print logged' });
  });
}
