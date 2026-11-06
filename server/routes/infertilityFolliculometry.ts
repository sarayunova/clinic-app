import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { requirePerm } from '../app.js';
import { nowIso } from '../time.js';
import {
  calculateCycleDay,
  determineLeadingFollicle,
  calculateFollicleGrowthRate,
  evaluateEndometrialReceptivity,
  evaluateFollicularReadiness,
  interpretSemenAnalysis,
} from '../../web/src/folliculometryEngine.js';

// Schemas
const infertilityWorkupSchema = z.object({
  partnerName: z.string().trim().max(120).nullable().optional(),
  partnerAge: z.number().int().min(15).max(100).nullable().optional(),
  infertilityType: z.enum(['primary', 'secondary']).default('primary'),
  durationYears: z.number().min(0).max(40).nullable().optional(),
  femaleFactors: z.array(z.string().trim().max(100)).optional(),
  baselineAmhNgMl: z.number().min(0).max(50).nullable().optional(),
  baselineFshMiuMl: z.number().min(0).max(150).nullable().optional(),
  baselineAfcTotal: z.number().int().min(0).max(80).nullable().optional(),
  hsgFindings: z.string().trim().max(1000).nullable().optional(),
  semenVolumeMl: z.number().min(0).max(20).nullable().optional(),
  semenConcentrationMilMl: z.number().min(0).max(500).nullable().optional(),
  semenTotalMotilityPct: z.number().min(0).max(100).nullable().optional(),
  semenProgressiveMotilityPct: z.number().min(0).max(100).nullable().optional(),
  semenNormalMorphologyPct: z.number().min(0).max(100).nullable().optional(),
  clinicalNotes: z.string().trim().max(2000).nullable().optional(),
}).strict();

const createCycleSchema = z.object({
  workupId: z.number().int().positive().nullable().optional(),
  cycleNumber: z.number().int().min(1).max(50).default(1),
  lmpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'LMP must be YYYY-MM-DD'),
  protocolType: z.enum([
    'natural',
    'letrozole',
    'clomiphene',
    'gonadotropins',
    'letrozole_plus_gonadotropins',
    'clomiphene_plus_gonadotropins',
    'other',
  ]).default('letrozole'),
  protocolDetails: z.string().trim().max(1000).nullable().optional(),
  plannedProcedure: z.enum(['timed_intercourse', 'iui', 'ivf_referral', 'cancelled']).default('timed_intercourse'),
  status: z.enum(['active', 'triggered', 'ovulated_ruptured', 'completed', 'cancelled']).default('active'),
  lutealSupport: z.string().trim().max(500).nullable().optional(),
  triggerDrug: z.string().trim().max(200).nullable().optional(),
  triggerDatetime: z.string().nullable().optional(),
  advisedTicIuiDatetime: z.string().nullable().optional(),
}).strict();

const patchCycleSchema = z.object({
  protocolType: z.enum([
    'natural',
    'letrozole',
    'clomiphene',
    'gonadotropins',
    'letrozole_plus_gonadotropins',
    'clomiphene_plus_gonadotropins',
    'other',
  ]).optional(),
  protocolDetails: z.string().trim().max(1000).nullable().optional(),
  plannedProcedure: z.enum(['timed_intercourse', 'iui', 'ivf_referral', 'cancelled']).optional(),
  status: z.enum(['active', 'triggered', 'ovulated_ruptured', 'completed', 'cancelled']).optional(),
  cancellationReason: z.string().trim().max(500).nullable().optional(),
  triggerDrug: z.string().trim().max(200).nullable().optional(),
  triggerDatetime: z.string().nullable().optional(),
  advisedTicIuiDatetime: z.string().nullable().optional(),
  lutealSupport: z.string().trim().max(500).nullable().optional(),
  cycleOutcome: z.enum(['pending', 'not_pregnant', 'biochemical_pregnancy', 'clinical_pregnancy', 'ectopic', 'cancelled']).optional(),
  outcomeNotes: z.string().trim().max(1000).nullable().optional(),
}).strict();

const createFolliculometryScanSchema = z.object({
  scanDatetime: z.string().min(10, 'Scan datetime required'),
  cycleDay: z.number().int().min(1).max(60).optional(),
  rightOvaryFollicles: z.array(z.number().min(1).max(50)).default([]),
  leftOvaryFollicles: z.array(z.number().min(1).max(50)).default([]),
  endometrialThicknessMm: z.number().min(0.5).max(30).nullable().optional(),
  endometrialPattern: z.enum(['trilaminar_a', 'isogenous_b', 'hyperechoic_c', 'irregular']).nullable().optional(),
  freeFluidPod: z.boolean().default(false),
  ovulationRuptureObserved: z.boolean().default(false),
  clinicalAdvice: z.string().trim().max(1000).nullable().optional(),
  sonographerNotes: z.string().trim().max(1000).nullable().optional(),
}).strict();

function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw badRequest('Validation failed', issues);
  }
  return parsed.data;
}

function assertCanManage(req: FastifyRequest) {
  requirePerm(req, 'patient:write_clinical');
  const user = req.user as { id: number; username: string } | undefined;
  if (!user) throw badRequest('Unauthorized');
  return user;
}

type DbWorkupRow = {
  id: number;
  patient_id: number;
  partner_name: string | null;
  partner_age: number | null;
  infertility_type: string;
  duration_years: number | null;
  female_factors: string | null;
  baseline_amh_ng_ml: number | null;
  baseline_fsh_miu_ml: number | null;
  baseline_afc_total: number | null;
  hsg_findings: string | null;
  semen_volume_ml: number | null;
  semen_concentration_mil_ml: number | null;
  semen_total_motility_pct: number | null;
  semen_progressive_motility_pct: number | null;
  semen_normal_morphology_pct: number | null;
  semen_analysis_interpretation: string | null;
  clinical_notes: string | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
};

type DbCycleRow = {
  id: number;
  patient_id: number;
  workup_id: number | null;
  cycle_number: number;
  lmp_date: string;
  protocol_type: string;
  protocol_details: string | null;
  planned_procedure: string;
  status: string;
  cancellation_reason: string | null;
  trigger_drug: string | null;
  trigger_datetime: string | null;
  advised_tic_iui_datetime: string | null;
  luteal_support: string | null;
  cycle_outcome: string;
  outcome_notes: string | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  patient_name?: string;
  patient_number?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
};

type DbScanRow = {
  id: number;
  cycle_id: number;
  patient_id: number;
  scan_datetime: string;
  cycle_day: number;
  right_ovary_follicles: string | null;
  left_ovary_follicles: string | null;
  leading_follicle_size_mm: number | null;
  leading_follicle_ovary: string | null;
  endometrial_thickness_mm: number | null;
  endometrial_pattern: string | null;
  free_fluid_pod: number;
  ovulation_rupture_observed: number;
  growth_rate_mm_day: number | null;
  readiness_stage: string | null;
  clinical_advice: string | null;
  sonographer_notes: string | null;
  created_by: number;
  created_at: string;
  created_by_name?: string | null;
};

function mapWorkupRow(r: DbWorkupRow) {
  let femaleFactors: string[] = [];
  if (r.female_factors) {
    try {
      femaleFactors = JSON.parse(r.female_factors);
    } catch {
      femaleFactors = [];
    }
  }

  return {
    id: r.id,
    patientId: r.patient_id,
    partnerName: r.partner_name,
    partnerAge: r.partner_age,
    infertilityType: r.infertility_type,
    durationYears: r.duration_years,
    femaleFactors,
    baselineAmhNgMl: r.baseline_amh_ng_ml,
    baselineFshMiuMl: r.baseline_fsh_miu_ml,
    baselineAfcTotal: r.baseline_afc_total,
    hsgFindings: r.hsg_findings,
    semenVolumeMl: r.semen_volume_ml,
    semenConcentrationMilMl: r.semen_concentration_mil_ml,
    semenTotalMotilityPct: r.semen_total_motility_pct,
    semenProgressiveMotilityPct: r.semen_progressive_motility_pct,
    semenNormalMorphologyPct: r.semen_normal_morphology_pct,
    semenAnalysisInterpretation: r.semen_analysis_interpretation,
    clinicalNotes: r.clinical_notes,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapScanRow(r: DbScanRow) {
  let rightFollicles: number[] = [];
  let leftFollicles: number[] = [];
  try {
    if (r.right_ovary_follicles) rightFollicles = JSON.parse(r.right_ovary_follicles);
  } catch {
    rightFollicles = [];
  }
  try {
    if (r.left_ovary_follicles) leftFollicles = JSON.parse(r.left_ovary_follicles);
  } catch {
    leftFollicles = [];
  }

  return {
    id: r.id,
    cycleId: r.cycle_id,
    patientId: r.patient_id,
    scanDatetime: r.scan_datetime,
    cycleDay: r.cycle_day,
    rightOvaryFollicles: rightFollicles,
    leftOvaryFollicles: leftFollicles,
    leadingFollicleSizeMm: r.leading_follicle_size_mm,
    leadingFollicleOvary: r.leading_follicle_ovary,
    endometrialThicknessMm: r.endometrial_thickness_mm,
    endometrialPattern: r.endometrial_pattern,
    freeFluidPod: Boolean(r.free_fluid_pod),
    ovulationRuptureObserved: Boolean(r.ovulation_rupture_observed),
    growthRateMmDay: r.growth_rate_mm_day,
    readinessStage: r.readiness_stage,
    clinicalAdvice: r.clinical_advice,
    sonographerNotes: r.sonographer_notes,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    createdAt: r.created_at,
  };
}

function mapCycleRow(r: DbCycleRow, scans: DbScanRow[] = []) {
  const mappedScans = scans.map(mapScanRow);
  const latestScan = mappedScans.length > 0 ? mappedScans[mappedScans.length - 1] : null;

  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name ?? null,
    patientNumber: r.patient_number ?? null,
    workupId: r.workup_id,
    cycleNumber: r.cycle_number,
    lmpDate: r.lmp_date,
    protocolType: r.protocol_type,
    protocolDetails: r.protocol_details,
    plannedProcedure: r.planned_procedure,
    status: r.status,
    cancellationReason: r.cancellation_reason,
    triggerDrug: r.trigger_drug,
    triggerDatetime: r.trigger_datetime,
    advisedTicIuiDatetime: r.advised_tic_iui_datetime,
    lutealSupport: r.luteal_support,
    cycleOutcome: r.cycle_outcome,
    outcomeNotes: r.outcome_notes,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    scansCount: mappedScans.length,
    scans: mappedScans,
    latestScan,
  };
}

export function registerInfertilityFolliculometryRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // GET /api/patients/:id/infertility-workup
  app.get('/api/patients/:id/infertility-workup', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const row = db
      .prepare(
        `SELECT w.*, cu.full_name AS created_by_name
         FROM infertility_workups w
         LEFT JOIN users cu ON cu.id = w.created_by
         WHERE w.patient_id = ?
         ORDER BY w.id DESC
         LIMIT 1`
      )
      .get(patientId) as DbWorkupRow | undefined;

    return { patientId, workup: row ? mapWorkupRow(row) : null };
  });

  // POST /api/patients/:id/infertility-workup
  app.post('/api/patients/:id/infertility-workup', async (req, reply) => {
    const user = assertCanManage(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(infertilityWorkupSchema, req.body);
    const now = nowIso();

    // Auto-calculate semen interpretation if parameters provided
    const semenInterp = interpretSemenAnalysis({
      volumeMl: b.semenVolumeMl,
      concentrationMilMl: b.semenConcentrationMilMl,
      progressiveMotilityPct: b.semenProgressiveMotilityPct,
      totalMotilityPct: b.semenTotalMotilityPct,
      normalMorphologyPct: b.semenNormalMorphologyPct,
    });

    const femaleFactorsJson = b.femaleFactors ? JSON.stringify(b.femaleFactors) : null;

    // Check if workup already exists for patient
    const existing = db.prepare('SELECT id FROM infertility_workups WHERE patient_id = ?').get(patientId) as { id: number } | undefined;

    let workupId: number;
    if (existing) {
      workupId = existing.id;
      db.prepare(`
        UPDATE infertility_workups SET
          partner_name = ?, partner_age = ?, infertility_type = ?, duration_years = ?,
          female_factors = ?, baseline_amh_ng_ml = ?, baseline_fsh_miu_ml = ?, baseline_afc_total = ?,
          hsg_findings = ?, semen_volume_ml = ?, semen_concentration_mil_ml = ?, semen_total_motility_pct = ?,
          semen_progressive_motility_pct = ?, semen_normal_morphology_pct = ?, semen_analysis_interpretation = ?,
          clinical_notes = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        b.partnerName ?? null,
        b.partnerAge ?? null,
        b.infertilityType,
        b.durationYears ?? null,
        femaleFactorsJson,
        b.baselineAmhNgMl ?? null,
        b.baselineFshMiuMl ?? null,
        b.baselineAfcTotal ?? null,
        b.hsgFindings ?? null,
        b.semenVolumeMl ?? null,
        b.semenConcentrationMilMl ?? null,
        b.semenTotalMotilityPct ?? null,
        b.semenProgressiveMotilityPct ?? null,
        b.semenNormalMorphologyPct ?? null,
        semenInterp.classification,
        b.clinicalNotes ?? null,
        user.id,
        now,
        workupId
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO infertility_workups (
          patient_id, partner_name, partner_age, infertility_type, duration_years,
          female_factors, baseline_amh_ng_ml, baseline_fsh_miu_ml, baseline_afc_total,
          hsg_findings, semen_volume_ml, semen_concentration_mil_ml, semen_total_motility_pct,
          semen_progressive_motility_pct, semen_normal_morphology_pct, semen_analysis_interpretation,
          clinical_notes, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const res = stmt.run(
        patientId,
        b.partnerName ?? null,
        b.partnerAge ?? null,
        b.infertilityType,
        b.durationYears ?? null,
        femaleFactorsJson,
        b.baselineAmhNgMl ?? null,
        b.baselineFshMiuMl ?? null,
        b.baselineAfcTotal ?? null,
        b.hsgFindings ?? null,
        b.semenVolumeMl ?? null,
        b.semenConcentrationMilMl ?? null,
        b.semenTotalMotilityPct ?? null,
        b.semenProgressiveMotilityPct ?? null,
        b.semenNormalMorphologyPct ?? null,
        semenInterp.classification,
        b.clinicalNotes ?? null,
        user.id,
        user.id,
        now,
        now
      );
      workupId = Number(res.lastInsertRowid);
    }

    audit(db, {
      actorId: user.id,
      action: 'infertility.save_workup',
      entity: 'patient',
      entityId: patientId,
      detail: { workupId, infertilityType: b.infertilityType },
    });

    const updated = db
      .prepare('SELECT w.*, cu.full_name AS created_by_name FROM infertility_workups w LEFT JOIN users cu ON cu.id = w.created_by WHERE w.id = ?')
      .get(workupId) as DbWorkupRow;

    return reply.status(200).send(mapWorkupRow(updated));
  });

  // GET /api/patients/:id/folliculometry-cycles
  app.get('/api/patients/:id/folliculometry-cycles', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const cycles = db
      .prepare(
        `SELECT c.*,
                p.full_name AS patient_name,
                p.patient_number,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name
         FROM folliculometry_cycles c
         JOIN patients p ON p.id = c.patient_id
         LEFT JOIN users cu ON cu.id = c.created_by
         LEFT JOIN users uu ON uu.id = c.updated_by
         WHERE c.patient_id = ?
         ORDER BY c.lmp_date DESC, c.id DESC`
      )
      .all(patientId) as DbCycleRow[];

    const result = [];
    for (const cycle of cycles) {
      const scans = db
        .prepare(
          `SELECT s.*, cu.full_name AS created_by_name
           FROM folliculometry_scans s
           LEFT JOIN users cu ON cu.id = s.created_by
           WHERE s.cycle_id = ?
           ORDER BY s.cycle_day ASC, s.scan_datetime ASC`
        )
        .all(cycle.id) as DbScanRow[];
      result.push(mapCycleRow(cycle, scans));
    }

    return { patientId, cycles: result };
  });

  // POST /api/patients/:id/folliculometry-cycles
  app.post('/api/patients/:id/folliculometry-cycles', async (req, reply) => {
    const user = assertCanManage(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(createCycleSchema, req.body);
    const now = nowIso();

    const stmt = db.prepare(`
      INSERT INTO folliculometry_cycles (
        patient_id, workup_id, cycle_number, lmp_date, protocol_type, protocol_details,
        planned_procedure, status, trigger_drug, trigger_datetime, advised_tic_iui_datetime,
        luteal_support, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      patientId,
      b.workupId ?? null,
      b.cycleNumber,
      b.lmpDate,
      b.protocolType,
      b.protocolDetails ?? null,
      b.plannedProcedure,
      b.status,
      b.triggerDrug ?? null,
      b.triggerDatetime ?? null,
      b.advisedTicIuiDatetime ?? null,
      b.lutealSupport ?? null,
      user.id,
      user.id,
      now,
      now
    );

    const cycleId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'folliculometry.create_cycle',
      entity: 'patient',
      entityId: patientId,
      detail: { cycleId, lmpDate: b.lmpDate, protocolType: b.protocolType },
    });

    const created = db.prepare('SELECT * FROM folliculometry_cycles WHERE id = ?').get(cycleId) as DbCycleRow;
    return reply.status(201).send(mapCycleRow(created, []));
  });

  // GET /api/folliculometry-cycles/:cycleId
  app.get('/api/folliculometry-cycles/:cycleId', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const cycleId = Number((req.params as { cycleId: string }).cycleId);
    if (!Number.isInteger(cycleId) || cycleId <= 0) throw badRequest('Invalid cycle ID');

    const cycle = db
      .prepare(
        `SELECT c.*,
                p.full_name AS patient_name,
                p.patient_number,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name
         FROM folliculometry_cycles c
         JOIN patients p ON p.id = c.patient_id
         LEFT JOIN users cu ON cu.id = c.created_by
         LEFT JOIN users uu ON uu.id = c.updated_by
         WHERE c.id = ?`
      )
      .get(cycleId) as DbCycleRow | undefined;

    if (!cycle) throw notFound('Cycle not found');

    const scans = db
      .prepare(
        `SELECT s.*, cu.full_name AS created_by_name
         FROM folliculometry_scans s
         LEFT JOIN users cu ON cu.id = s.created_by
         WHERE s.cycle_id = ?
         ORDER BY s.cycle_day ASC, s.scan_datetime ASC`
      )
      .all(cycleId) as DbScanRow[];

    return mapCycleRow(cycle, scans);
  });

  // PATCH /api/folliculometry-cycles/:cycleId
  app.patch('/api/folliculometry-cycles/:cycleId', async (req) => {
    const user = assertCanManage(req);
    const cycleId = Number((req.params as { cycleId: string }).cycleId);
    if (!Number.isInteger(cycleId) || cycleId <= 0) throw badRequest('Invalid cycle ID');

    const existing = db.prepare('SELECT * FROM folliculometry_cycles WHERE id = ?').get(cycleId) as DbCycleRow | undefined;
    if (!existing) throw notFound('Cycle not found');

    const b = parse(patchCycleSchema, req.body);
    const now = nowIso();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const fieldMap: Record<string, string> = {
      protocolType: 'protocol_type',
      protocolDetails: 'protocol_details',
      plannedProcedure: 'planned_procedure',
      status: 'status',
      cancellationReason: 'cancellation_reason',
      triggerDrug: 'trigger_drug',
      triggerDatetime: 'trigger_datetime',
      advisedTicIuiDatetime: 'advised_tic_iui_datetime',
      lutealSupport: 'luteal_support',
      cycleOutcome: 'cycle_outcome',
      outcomeNotes: 'outcome_notes',
    };

    for (const [k, col] of Object.entries(fieldMap)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as Record<string, any>)[k] ?? null);
      }
    }

    if (fields.length === 0) throw badRequest('No fields to update');

    fields.push('updated_by = ?', 'updated_at = ?');
    values.push(user.id, now, cycleId);

    db.prepare(`UPDATE folliculometry_cycles SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit(db, {
      actorId: user.id,
      action: 'folliculometry.update_cycle',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: { cycleId, updatedFields: Object.keys(b) },
    });

    const updated = db.prepare('SELECT * FROM folliculometry_cycles WHERE id = ?').get(cycleId) as DbCycleRow;
    const scans = db.prepare('SELECT s.*, cu.full_name AS created_by_name FROM folliculometry_scans s LEFT JOIN users cu ON cu.id = s.created_by WHERE s.cycle_id = ? ORDER BY s.cycle_day ASC, s.scan_datetime ASC').all(cycleId) as DbScanRow[];
    return mapCycleRow(updated, scans);
  });

  // POST /api/folliculometry-cycles/:cycleId/scans
  app.post('/api/folliculometry-cycles/:cycleId/scans', async (req, reply) => {
    const user = assertCanManage(req);
    const cycleId = Number((req.params as { cycleId: string }).cycleId);
    if (!Number.isInteger(cycleId) || cycleId <= 0) throw badRequest('Invalid cycle ID');

    const cycle = db.prepare('SELECT * FROM folliculometry_cycles WHERE id = ?').get(cycleId) as DbCycleRow | undefined;
    if (!cycle) throw notFound('Cycle not found');

    const b = parse(createFolliculometryScanSchema, req.body);
    const now = nowIso();

    // 1. Calculate Cycle Day
    const cycleDay = b.cycleDay != null && b.cycleDay > 0
      ? b.cycleDay
      : calculateCycleDay(cycle.lmp_date, b.scanDatetime);

    // 2. Determine Leading Follicle
    const leading = determineLeadingFollicle(b.rightOvaryFollicles, b.leftOvaryFollicles);

    // 3. Compare with previous scan for this cycle to calculate growth rate
    const prevScan = db
      .prepare(
        `SELECT cycle_day, leading_follicle_size_mm
         FROM folliculometry_scans
         WHERE cycle_id = ? AND cycle_day < ? AND leading_follicle_size_mm IS NOT NULL
         ORDER BY cycle_day DESC, id DESC
         LIMIT 1`
      )
      .get(cycleId, cycleDay) as { cycle_day: number; leading_follicle_size_mm: number } | undefined;

    let growthRate: number | null = null;
    if (prevScan && leading.leadingSizeMm > 0) {
      growthRate = calculateFollicleGrowthRate(
        { cycleDay: prevScan.cycle_day, sizeMm: prevScan.leading_follicle_size_mm },
        { cycleDay, sizeMm: leading.leadingSizeMm }
      );
    }

    // 4. Evaluate Follicular Readiness & Safety
    const readiness = evaluateFollicularReadiness({
      leadingSizeMm: leading.leadingSizeMm,
      etMm: b.endometrialThicknessMm,
      pattern: b.endometrialPattern,
      dominantCountGe16mm: leading.dominantCountGe16mm,
      ruptureObserved: b.ovulationRuptureObserved,
      protocolType: cycle.protocol_type,
    });

    const stmt = db.prepare(`
      INSERT INTO folliculometry_scans (
        cycle_id, patient_id, scan_datetime, cycle_day, right_ovary_follicles, left_ovary_follicles,
        leading_follicle_size_mm, leading_follicle_ovary, endometrial_thickness_mm, endometrial_pattern,
        free_fluid_pod, ovulation_rupture_observed, growth_rate_mm_day, readiness_stage, clinical_advice,
        sonographer_notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      cycleId,
      cycle.patient_id,
      b.scanDatetime,
      cycleDay,
      JSON.stringify(b.rightOvaryFollicles),
      JSON.stringify(b.leftOvaryFollicles),
      leading.leadingSizeMm,
      leading.leadingOvary,
      b.endometrialThicknessMm ?? null,
      b.endometrialPattern ?? null,
      b.freeFluidPod ? 1 : 0,
      b.ovulationRuptureObserved ? 1 : 0,
      growthRate,
      readiness.stage,
      b.clinicalAdvice ?? readiness.summary,
      b.sonographerNotes ?? null,
      user.id,
      now
    );

    const scanId = Number(result.lastInsertRowid);

    // If rupture observed and cycle is still active/triggered, update to ovulated_ruptured
    if (b.ovulationRuptureObserved && (cycle.status === 'active' || cycle.status === 'triggered')) {
      db.prepare('UPDATE folliculometry_cycles SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
        'ovulated_ruptured',
        user.id,
        now,
        cycleId
      );
    }

    audit(db, {
      actorId: user.id,
      action: 'folliculometry.log_scan',
      entity: 'patient',
      entityId: cycle.patient_id,
      detail: {
        cycleId,
        scanId,
        cycleDay,
        leadingSizeMm: leading.leadingSizeMm,
        readinessStage: readiness.stage,
        ruptureObserved: b.ovulationRuptureObserved,
      },
    });

    const createdScan = db
      .prepare('SELECT s.*, cu.full_name AS created_by_name FROM folliculometry_scans s LEFT JOIN users cu ON cu.id = s.created_by WHERE s.id = ?')
      .get(scanId) as DbScanRow;

    return reply.status(201).send(mapScanRow(createdScan));
  });

  // DELETE /api/folliculometry-scans/:scanId
  app.delete('/api/folliculometry-scans/:scanId', async (req) => {
    const user = assertCanManage(req);
    const scanId = Number((req.params as { scanId: string }).scanId);
    if (!Number.isInteger(scanId) || scanId <= 0) throw badRequest('Invalid scan ID');

    const scan = db.prepare('SELECT * FROM folliculometry_scans WHERE id = ?').get(scanId) as DbScanRow | undefined;
    if (!scan) throw notFound('Scan not found');

    db.prepare('DELETE FROM folliculometry_scans WHERE id = ?').run(scanId);

    audit(db, {
      actorId: user.id,
      action: 'folliculometry.delete_scan',
      entity: 'patient',
      entityId: scan.patient_id,
      detail: { cycleId: scan.cycle_id, scanId },
    });

    return { ok: true };
  });
}
