import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  calculateMaternalBackgroundRisk,
  calculateFirstTrimesterCombinedRisk,
  calculateQuadrupleRisk,
  evaluateNiptResult,
  type GeneticRiskResult,
} from '../../web/src/geneticEngine.js';

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const optNullableNumber = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .nullable()
    .optional();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const geneticScreeningSchema = z.object({
  patientId: z.number().int().positive('Valid patient ID required'),
  visitId: z.number().int().positive().nullable().optional(),
  screeningDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  screeningType: z.enum([
    'first_trimester_combined',
    'quadruple_marker',
    'nipt_cfdna',
    'integrated_sequential',
    'invasive_diagnostic',
  ]),
  gestationalAgeWeeks: z.number().int().min(9).max(42, 'Gestational age must be between 9 and 42 weeks'),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  maternalAgeAtDelivery: z.number().int().min(12).max(65, 'Maternal age must be between 12 and 65'),
  maternalWeightKg: optNullableNumber(30, 250),
  pregnancyType: z.enum(['singleton', 'twins_dichorionic', 'twins_monochorionic', 'triplets']).default('singleton'),
  ivfPregnancy: z.boolean().default(false),
  diabetesStatus: z.boolean().default(false),
  smoker: z.boolean().default(false),

  // First Trimester
  crlMm: optNullableNumber(35, 120),
  ntMeasuredMm: optNullableNumber(0.4, 25),
  ntMom: optNullableNumber(0.1, 20),
  nasalBone: z.enum(['present', 'absent', 'hypoplastic', 'not_visualized']).nullable().optional(),
  tricuspidRegurgitation: z.enum(['normal', 'regurgitant', 'not_performed']).nullable().optional(),
  ductusVenosus: z.enum(['positive', 'reversed', 'not_performed']).nullable().optional(),
  freeBetaHcgRaw: optNullableNumber(0, 1000),
  freeBetaHcgMom: optNullableNumber(0.01, 30),
  pappARaw: optNullableNumber(0, 100),
  pappAMom: optNullableNumber(0.01, 30),

  // Second Trimester Quadruple
  bpdMm: optNullableNumber(15, 100),
  afpRaw: optNullableNumber(0, 1000),
  afpMom: optNullableNumber(0.05, 30),
  totalHcgRaw: optNullableNumber(0, 500000),
  totalHcgMom: optNullableNumber(0.05, 30),
  ue3Raw: optNullableNumber(0, 100),
  ue3Mom: optNullableNumber(0.01, 30),
  inhibinARaw: optNullableNumber(0, 5000),
  inhibinAMom: optNullableNumber(0.05, 30),

  // NIPT
  niptSampleDate: z.string().regex(dateRegex).nullable().optional(),
  niptFetalFractionPercent: optNullableNumber(0, 50),
  niptT21Result: z.enum(['low_risk', 'high_risk', 'inconclusive']).nullable().optional(),
  niptT18Result: z.enum(['low_risk', 'high_risk', 'inconclusive']).nullable().optional(),
  niptT13Result: z.enum(['low_risk', 'high_risk', 'inconclusive']).nullable().optional(),
  niptSexChromosomes: optNullableString(100),
  niptMicrodeletions: optNullableString(200),
  niptLabName: optNullableString(200),

  // Calculated Risks (optional in payload; calculated by engine if omitted)
  backgroundT21RiskRatio: z.string().optional(),
  adjustedT21RiskRatio: z.string().optional(),
  adjustedT21RiskNumeric: z.number().optional(),
  adjustedT18RiskRatio: z.string().optional(),
  adjustedT18RiskNumeric: z.number().optional(),
  adjustedT13RiskRatio: z.string().optional(),
  adjustedT13RiskNumeric: z.number().optional(),
  ontdRiskStatus: z.enum(['low_risk', 'high_risk', 'not_applicable']).optional(),
  overallRiskTier: z.enum(['low_risk', 'intermediate_risk', 'high_risk', 'inconclusive']).optional(),
  clinicalRecommendation: z.string().max(2000).optional(),

  // Counseling
  counselingNotes: optNullableString(2000),
  patientDecision: z
    .enum(['routine_care', 'opt_for_nipt', 'opt_for_invasive_diagnostic', 'declined_further_testing', 'undecided'])
    .nullable()
    .optional(),

  // Invasive Procedure
  invasiveProcedureType: z.enum(['cvs', 'amniocentesis', 'cordocentesis', 'none']).nullable().optional(),
  invasiveProcedureDate: z.string().regex(dateRegex).nullable().optional(),
  invasivePerformedBy: optNullableString(200),
  invasiveSampleDetails: optNullableString(500),
  antiDGiven: z.boolean().default(false),
  karyotypeResult: optNullableString(500),
  microarrayCmaResult: optNullableString(500),
  rapidQfpcrResult: optNullableString(500),
  finalGeneticDiagnosis: optNullableString(1000),
});

function rowToRecord(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    patientId: Number(r.patient_id),
    visitId: r.visit_id != null ? Number(r.visit_id) : null,
    screeningDate: String(r.screening_date),
    screeningType: r.screening_type as string,
    gestationalAgeWeeks: Number(r.gestational_age_weeks),
    gestationalAgeDays: Number(r.gestational_age_days || 0),
    maternalAgeAtDelivery: Number(r.maternal_age_at_delivery),
    maternalWeightKg: r.maternal_weight_kg != null ? Number(r.maternal_weight_kg) : null,
    pregnancyType: r.pregnancy_type as string,
    ivfPregnancy: Boolean(r.ivf_pregnancy),
    diabetesStatus: Boolean(r.diabetes_status),
    smoker: Boolean(r.smoker),

    crlMm: r.crl_mm != null ? Number(r.crl_mm) : null,
    ntMeasuredMm: r.nt_measured_mm != null ? Number(r.nt_measured_mm) : null,
    ntMom: r.nt_mom != null ? Number(r.nt_mom) : null,
    nasalBone: r.nasal_bone ? String(r.nasal_bone) : null,
    tricuspidRegurgitation: r.tricuspid_regurgitation ? String(r.tricuspid_regurgitation) : null,
    ductusVenosus: r.ductus_venosus ? String(r.ductus_venosus) : null,
    freeBetaHcgRaw: r.free_beta_hcg_raw != null ? Number(r.free_beta_hcg_raw) : null,
    freeBetaHcgMom: r.free_beta_hcg_mom != null ? Number(r.free_beta_hcg_mom) : null,
    pappARaw: r.papp_a_raw != null ? Number(r.papp_a_raw) : null,
    pappAMom: r.papp_a_mom != null ? Number(r.papp_a_mom) : null,

    bpdMm: r.bpd_mm != null ? Number(r.bpd_mm) : null,
    afpRaw: r.afp_raw != null ? Number(r.afp_raw) : null,
    afpMom: r.afp_mom != null ? Number(r.afp_mom) : null,
    totalHcgRaw: r.total_hcg_raw != null ? Number(r.total_hcg_raw) : null,
    totalHcgMom: r.total_hcg_mom != null ? Number(r.total_hcg_mom) : null,
    ue3Raw: r.ue3_raw != null ? Number(r.ue3_raw) : null,
    ue3Mom: r.ue3_mom != null ? Number(r.ue3_mom) : null,
    inhibinARaw: r.inhibin_a_raw != null ? Number(r.inhibin_a_raw) : null,
    inhibinAMom: r.inhibin_a_mom != null ? Number(r.inhibin_a_mom) : null,

    backgroundT21RiskRatio: String(r.background_t21_risk_ratio),
    adjustedT21RiskRatio: String(r.adjusted_t21_risk_ratio),
    adjustedT21RiskNumeric: Number(r.adjusted_t21_risk_numeric),
    adjustedT18RiskRatio: String(r.adjusted_t18_risk_ratio),
    adjustedT18RiskNumeric: Number(r.adjusted_t18_risk_numeric),
    adjustedT13RiskRatio: String(r.adjusted_t13_risk_ratio),
    adjustedT13RiskNumeric: Number(r.adjusted_t13_risk_numeric),
    ontdRiskStatus: (r.ontd_risk_status as string) || 'not_applicable',
    overallRiskTier: r.overall_risk_tier as string,

    niptSampleDate: r.nipt_sample_date ? String(r.nipt_sample_date) : null,
    niptFetalFractionPercent: r.nipt_fetal_fraction_percent != null ? Number(r.nipt_fetal_fraction_percent) : null,
    niptT21Result: r.nipt_t21_result ? String(r.nipt_t21_result) : null,
    niptT18Result: r.nipt_t18_result ? String(r.nipt_t18_result) : null,
    niptT13Result: r.nipt_t13_result ? String(r.nipt_t13_result) : null,
    niptSexChromosomes: r.nipt_sex_chromosomes ? String(r.nipt_sex_chromosomes) : null,
    niptMicrodeletions: r.nipt_microdeletions ? String(r.nipt_microdeletions) : null,
    niptLabName: r.nipt_lab_name ? String(r.nipt_lab_name) : null,

    clinicalRecommendation: String(r.clinical_recommendation),
    counselingNotes: r.counseling_notes ? String(r.counseling_notes) : null,
    counseledBy: Number(r.counseled_by),
    counseledByName: r.counseled_by_name ? String(r.counseled_by_name) : null,
    patientDecision: r.patient_decision ? String(r.patient_decision) : null,

    invasiveProcedureType: r.invasive_procedure_type ? String(r.invasive_procedure_type) : null,
    invasiveProcedureDate: r.invasive_procedure_date ? String(r.invasive_procedure_date) : null,
    invasivePerformedBy: r.invasive_performed_by ? String(r.invasive_performed_by) : null,
    invasiveSampleDetails: r.invasive_sample_details ? String(r.invasive_sample_details) : null,
    antiDGiven: Boolean(r.anti_d_given),
    karyotypeResult: r.karyotype_result ? String(r.karyotype_result) : null,
    microarrayCmaResult: r.microarray_cma_result ? String(r.microarray_cma_result) : null,
    rapidQfpcrResult: r.rapid_qfpcr_result ? String(r.rapid_qfpcr_result) : null,
    finalGeneticDiagnosis: r.final_genetic_diagnosis ? String(r.final_genetic_diagnosis) : null,

    createdBy: Number(r.created_by),
    updatedBy: Number(r.updated_by),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function registerGeneticScreeningRoutes(app: FastifyInstance, ctx: Ctx) {
  // POST /api/genetic-screening/calculate - Pure calculation endpoint
  app.post('/api/genetic-screening/calculate', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as Record<string, any>;

    if (body.screeningType === 'quadruple_marker') {
      const result = calculateQuadrupleRisk({
        maternalAge: Number(body.maternalAge || 28),
        gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 16),
        afpMom: Number(body.afpMom || 1.0),
        totalHcgMom: Number(body.totalHcgMom || 1.0),
        ue3Mom: Number(body.ue3Mom || 1.0),
        inhibinAMom: Number(body.inhibinAMom || 1.0),
      });
      return reply.send(result);
    } else if (body.screeningType === 'nipt_cfdna') {
      const result = evaluateNiptResult({
        fetalFractionPercent: Number(body.fetalFractionPercent || 8.5),
        t21Result: body.t21Result,
        t18Result: body.t18Result,
        t13Result: body.t13Result,
      });
      return reply.send(result);
    } else {
      // First trimester combined
      const result = calculateFirstTrimesterCombinedRisk({
        maternalAge: Number(body.maternalAge || 28),
        gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 12),
        crlMm: Number(body.crlMm || 60),
        ntMeasuredMm: Number(body.ntMeasuredMm || 1.6),
        nasalBone: body.nasalBone || 'present',
        tricuspidRegurgitation: body.tricuspidRegurgitation || 'normal',
        ductusVenosus: body.ductusVenosus || 'positive',
        freeBetaHcgMom: body.freeBetaHcgMom != null ? Number(body.freeBetaHcgMom) : undefined,
        pappAMom: body.pappAMom != null ? Number(body.pappAMom) : undefined,
      });
      return reply.send(result);
    }
  });

  // GET /api/patients/:patientId/genetic-screening - List episodes for patient
  app.get('/api/patients/:patientId/genetic-screening', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid <= 0) throw badRequest('Invalid patient ID');

    const rows = ctx.db
      .prepare(`
        SELECT g.*, u.full_name as counseled_by_name
        FROM genetic_screening_episodes g
        LEFT JOIN users u ON g.counseled_by = u.id
        WHERE g.patient_id = ?
        ORDER BY g.screening_date DESC, g.id DESC
      `)
      .all(pid) as Record<string, unknown>[];

    const records = rows.map(rowToRecord);
    return reply.send({ total: records.length, records });
  });

  // GET /api/patients/:patientId/genetic-screening/:id - Single episode
  app.get('/api/patients/:patientId/genetic-screening/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid episode ID');

    const row = ctx.db
      .prepare(`
        SELECT g.*, u.full_name as counseled_by_name
        FROM genetic_screening_episodes g
        LEFT JOIN users u ON g.counseled_by = u.id
        WHERE g.id = ?
      `)
      .get(numId) as Record<string, unknown> | undefined;

    if (!row) throw notFound('Genetic screening episode not found');
    return reply.send(rowToRecord(row));
  });

  // POST /api/patients/:patientId/genetic-screening - Create new episode
  app.post('/api/patients/:patientId/genetic-screening', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:write_clinical');
    const parsed = geneticScreeningSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed for genetic screening', parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })));
    }
    const b = parsed.data;

    // Verify patient
    const patient = ctx.db.prepare('SELECT id, full_name, date_of_birth FROM patients WHERE id = ?').get(b.patientId);
    if (!patient) throw notFound('Patient not found');

    // Run clinical decision engine if not explicitly supplied
    let evalResult: GeneticRiskResult;
    if (b.screeningType === 'quadruple_marker') {
      evalResult = calculateQuadrupleRisk({
        maternalAge: b.maternalAgeAtDelivery,
        gestationalAgeWeeks: b.gestationalAgeWeeks,
        afpMom: b.afpMom ?? 1.0,
        totalHcgMom: b.totalHcgMom ?? 1.0,
        ue3Mom: b.ue3Mom ?? 1.0,
        inhibinAMom: b.inhibinAMom ?? 1.0,
      });
    } else if (b.screeningType === 'nipt_cfdna') {
      const niptQuality = evaluateNiptResult({
        fetalFractionPercent: b.niptFetalFractionPercent ?? 8.0,
        t21Result: b.niptT21Result ?? undefined,
        t18Result: b.niptT18Result ?? undefined,
        t13Result: b.niptT13Result ?? undefined,
      });
      const bg = calculateMaternalBackgroundRisk(b.maternalAgeAtDelivery);
      evalResult = {
        screeningType: 'nipt_cfdna',
        backgroundT21Ratio: bg.t21Ratio,
        backgroundT21Numeric: bg.t21Odds,
        adjustedT21Ratio: b.niptT21Result === 'high_risk' ? '1:2' : '1:>10000',
        adjustedT21Numeric: b.niptT21Result === 'high_risk' ? 0.5 : 0.0001,
        adjustedT18Ratio: b.niptT18Result === 'high_risk' ? '1:2' : '1:>10000',
        adjustedT18Numeric: b.niptT18Result === 'high_risk' ? 0.5 : 0.0001,
        adjustedT13Ratio: b.niptT13Result === 'high_risk' ? '1:2' : '1:>10000',
        adjustedT13Numeric: b.niptT13Result === 'high_risk' ? 0.5 : 0.0001,
        overallRiskTier: niptQuality.overallTier,
        clinicalRecommendation: niptQuality.recommendation,
      };
    } else {
      // First trimester combined
      evalResult = calculateFirstTrimesterCombinedRisk({
        maternalAge: b.maternalAgeAtDelivery,
        gestationalAgeWeeks: b.gestationalAgeWeeks,
        crlMm: b.crlMm ?? 60,
        ntMeasuredMm: b.ntMeasuredMm ?? 1.6,
        nasalBone: b.nasalBone ?? 'present',
        tricuspidRegurgitation: b.tricuspidRegurgitation ?? 'normal',
        ductusVenosus: b.ductusVenosus ?? 'positive',
        freeBetaHcgMom: b.freeBetaHcgMom ?? undefined,
        pappAMom: b.pappAMom ?? undefined,
      });
    }

    const bgRatio = b.backgroundT21RiskRatio || evalResult.backgroundT21Ratio;
    const adjT21Ratio = b.adjustedT21RiskRatio || evalResult.adjustedT21Ratio;
    const adjT21Num = b.adjustedT21RiskNumeric ?? evalResult.adjustedT21Numeric;
    const adjT18Ratio = b.adjustedT18RiskRatio || evalResult.adjustedT18Ratio;
    const adjT18Num = b.adjustedT18RiskNumeric ?? evalResult.adjustedT18Numeric;
    const adjT13Ratio = b.adjustedT13RiskRatio || evalResult.adjustedT13Ratio;
    const adjT13Num = b.adjustedT13RiskNumeric ?? evalResult.adjustedT13Numeric;
    const ontdStatus = b.ontdRiskStatus || evalResult.ontdRiskStatus || 'not_applicable';
    const overallTier = b.overallRiskTier || evalResult.overallRiskTier;
    const recText = b.clinicalRecommendation || evalResult.clinicalRecommendation;

    const now = nowIso();

    const created = tx(ctx.db, () => {
      const res = ctx.db.prepare(`
        INSERT INTO genetic_screening_episodes (
          patient_id, visit_id, screening_date, screening_type,
          gestational_age_weeks, gestational_age_days, maternal_age_at_delivery, maternal_weight_kg,
          pregnancy_type, ivf_pregnancy, diabetes_status, smoker,
          crl_mm, nt_measured_mm, nt_mom, nasal_bone, tricuspid_regurgitation, ductus_venosus,
          free_beta_hcg_raw, free_beta_hcg_mom, papp_a_raw, papp_a_mom,
          bpd_mm, afp_raw, afp_mom, total_hcg_raw, total_hcg_mom, ue3_raw, ue3_mom, inhibin_a_raw, inhibin_a_mom,
          background_t21_risk_ratio, adjusted_t21_risk_ratio, adjusted_t21_risk_numeric,
          adjusted_t18_risk_ratio, adjusted_t18_risk_numeric, adjusted_t13_risk_ratio, adjusted_t13_risk_numeric,
          ontd_risk_status, overall_risk_tier,
          nipt_sample_date, nipt_fetal_fraction_percent, nipt_t21_result, nipt_t18_result, nipt_t13_result,
          nipt_sex_chromosomes, nipt_microdeletions, nipt_lab_name,
          clinical_recommendation, counseling_notes, counseled_by, patient_decision,
          invasive_procedure_type, invasive_procedure_date, invasive_performed_by, invasive_sample_details,
          anti_d_given, karyotype_result, microarray_cma_result, rapid_qfpcr_result, final_genetic_diagnosis,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        b.patientId,
        b.visitId ?? null,
        b.screeningDate,
        b.screeningType,
        b.gestationalAgeWeeks,
        b.gestationalAgeDays,
        b.maternalAgeAtDelivery,
        b.maternalWeightKg ?? null,
        b.pregnancyType,
        b.ivfPregnancy ? 1 : 0,
        b.diabetesStatus ? 1 : 0,
        b.smoker ? 1 : 0,
        b.crlMm ?? null,
        b.ntMeasuredMm ?? null,
        b.ntMom ?? null,
        b.nasalBone ?? null,
        b.tricuspidRegurgitation ?? null,
        b.ductusVenosus ?? null,
        b.freeBetaHcgRaw ?? null,
        b.freeBetaHcgMom ?? null,
        b.pappARaw ?? null,
        b.pappAMom ?? null,
        b.bpdMm ?? null,
        b.afpRaw ?? null,
        b.afpMom ?? null,
        b.totalHcgRaw ?? null,
        b.totalHcgMom ?? null,
        b.ue3Raw ?? null,
        b.ue3Mom ?? null,
        b.inhibinARaw ?? null,
        b.inhibinAMom ?? null,
        bgRatio,
        adjT21Ratio,
        adjT21Num,
        adjT18Ratio,
        adjT18Num,
        adjT13Ratio,
        adjT13Num,
        ontdStatus,
        overallTier,
        b.niptSampleDate ?? null,
        b.niptFetalFractionPercent ?? null,
        b.niptT21Result ?? null,
        b.niptT18Result ?? null,
        b.niptT13Result ?? null,
        b.niptSexChromosomes ?? null,
        b.niptMicrodeletions ?? null,
        b.niptLabName ?? null,
        recText,
        b.counselingNotes ?? null,
        user.id,
        b.patientDecision ?? null,
        b.invasiveProcedureType ?? null,
        b.invasiveProcedureDate ?? null,
        b.invasivePerformedBy ?? null,
        b.invasiveSampleDetails ?? null,
        b.antiDGiven ? 1 : 0,
        b.karyotypeResult ?? null,
        b.microarrayCmaResult ?? null,
        b.rapidQfpcrResult ?? null,
        b.finalGeneticDiagnosis ?? null,
        user.id,
        user.id,
        now,
        now,
      );

      const newId = Number(res.lastInsertRowid);
      audit(ctx.db, {
        actorId: user.id,
        action: 'genetic.screening_create',
        entity: 'genetic_screening_episode',
        entityId: newId,
        detail: {
          patientId: b.patientId,
          screeningType: b.screeningType,
          overallRiskTier: overallTier,
          adjustedT21Ratio: adjT21Ratio,
        },
      });

      const row = ctx.db.prepare('SELECT * FROM genetic_screening_episodes WHERE id = ?').get(newId) as Record<string, unknown>;
      return rowToRecord(row);
    });

    return reply.status(201).send(created);
  });

  // PUT /api/patients/:patientId/genetic-screening/:id - Update episode
  app.put('/api/patients/:patientId/genetic-screening/:id', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:write_clinical');
    const { id, patientId } = req.params as { id: string; patientId: string };
    const numId = Number(id);
    const numPatientId = Number(patientId);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid episode ID');

    const existing = ctx.db.prepare('SELECT * FROM genetic_screening_episodes WHERE id = ? AND patient_id = ?').get(numId, numPatientId) as Record<string, unknown> | undefined;
    if (!existing) throw notFound('Genetic screening episode not found');

    const parsed = geneticScreeningSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed for genetic screening', parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })));
    }
    const b = parsed.data;

    let evalResult: GeneticRiskResult;
    if (b.screeningType === 'quadruple_marker') {
      evalResult = calculateQuadrupleRisk({
        maternalAge: b.maternalAgeAtDelivery,
        gestationalAgeWeeks: b.gestationalAgeWeeks,
        afpMom: b.afpMom ?? 1.0,
        totalHcgMom: b.totalHcgMom ?? 1.0,
        ue3Mom: b.ue3Mom ?? 1.0,
        inhibinAMom: b.inhibinAMom ?? 1.0,
      });
    } else if (b.screeningType === 'nipt_cfdna') {
      const niptQuality = evaluateNiptResult({
        fetalFractionPercent: b.niptFetalFractionPercent ?? 8.0,
        t21Result: b.niptT21Result ?? undefined,
        t18Result: b.niptT18Result ?? undefined,
        t13Result: b.niptT13Result ?? undefined,
      });
      const bg = calculateMaternalBackgroundRisk(b.maternalAgeAtDelivery);
      evalResult = {
        screeningType: 'nipt_cfdna',
        backgroundT21Ratio: bg.t21Ratio,
        backgroundT21Numeric: bg.t21Odds,
        adjustedT21Ratio: b.niptT21Result === 'high_risk' ? '1:2' : '1:>10000',
        adjustedT21Numeric: b.niptT21Result === 'high_risk' ? 0.5 : 0.0001,
        adjustedT18Ratio: b.niptT18Result === 'high_risk' ? '1:2' : '1:>10000',
        adjustedT18Numeric: b.niptT18Result === 'high_risk' ? 0.5 : 0.0001,
        adjustedT13Ratio: b.niptT13Result === 'high_risk' ? '1:2' : '1:>10000',
        adjustedT13Numeric: b.niptT13Result === 'high_risk' ? 0.5 : 0.0001,
        overallRiskTier: niptQuality.overallTier,
        clinicalRecommendation: niptQuality.recommendation,
      };
    } else {
      evalResult = calculateFirstTrimesterCombinedRisk({
        maternalAge: b.maternalAgeAtDelivery,
        gestationalAgeWeeks: b.gestationalAgeWeeks,
        crlMm: b.crlMm ?? 60,
        ntMeasuredMm: b.ntMeasuredMm ?? 1.6,
        nasalBone: b.nasalBone ?? 'present',
        tricuspidRegurgitation: b.tricuspidRegurgitation ?? 'normal',
        ductusVenosus: b.ductusVenosus ?? 'positive',
        freeBetaHcgMom: b.freeBetaHcgMom ?? undefined,
        pappAMom: b.pappAMom ?? undefined,
      });
    }

    const bgRatio = b.backgroundT21RiskRatio || evalResult.backgroundT21Ratio;
    const adjT21Ratio = b.adjustedT21RiskRatio || evalResult.adjustedT21Ratio;
    const adjT21Num = b.adjustedT21RiskNumeric ?? evalResult.adjustedT21Numeric;
    const adjT18Ratio = b.adjustedT18RiskRatio || evalResult.adjustedT18Ratio;
    const adjT18Num = b.adjustedT18RiskNumeric ?? evalResult.adjustedT18Numeric;
    const adjT13Ratio = b.adjustedT13RiskRatio || evalResult.adjustedT13Ratio;
    const adjT13Num = b.adjustedT13RiskNumeric ?? evalResult.adjustedT13Numeric;
    const ontdStatus = b.ontdRiskStatus || evalResult.ontdRiskStatus || 'not_applicable';
    const overallTier = b.overallRiskTier || evalResult.overallRiskTier;
    const recText = b.clinicalRecommendation || evalResult.clinicalRecommendation;

    const now = nowIso();

    tx(ctx.db, () => {
      ctx.db.prepare(`
        UPDATE genetic_screening_episodes SET
          visit_id = ?, screening_date = ?, screening_type = ?,
          gestational_age_weeks = ?, gestational_age_days = ?, maternal_age_at_delivery = ?, maternal_weight_kg = ?,
          pregnancy_type = ?, ivf_pregnancy = ?, diabetes_status = ?, smoker = ?,
          crl_mm = ?, nt_measured_mm = ?, nt_mom = ?, nasal_bone = ?, tricuspid_regurgitation = ?, ductus_venosus = ?,
          free_beta_hcg_raw = ?, free_beta_hcg_mom = ?, papp_a_raw = ?, papp_a_mom = ?,
          bpd_mm = ?, afp_raw = ?, afp_mom = ?, total_hcg_raw = ?, total_hcg_mom = ?, ue3_raw = ?, ue3_mom = ?, inhibin_a_raw = ?, inhibin_a_mom = ?,
          background_t21_risk_ratio = ?, adjusted_t21_risk_ratio = ?, adjusted_t21_risk_numeric = ?,
          adjusted_t18_risk_ratio = ?, adjusted_t18_risk_numeric = ?, adjusted_t13_risk_ratio = ?, adjusted_t13_risk_numeric = ?,
          ontd_risk_status = ?, overall_risk_tier = ?,
          nipt_sample_date = ?, nipt_fetal_fraction_percent = ?, nipt_t21_result = ?, nipt_t18_result = ?, nipt_t13_result = ?,
          nipt_sex_chromosomes = ?, nipt_microdeletions = ?, nipt_lab_name = ?,
          clinical_recommendation = ?, counseling_notes = ?, patient_decision = ?,
          invasive_procedure_type = ?, invasive_procedure_date = ?, invasive_performed_by = ?, invasive_sample_details = ?,
          anti_d_given = ?, karyotype_result = ?, microarray_cma_result = ?, rapid_qfpcr_result = ?, final_genetic_diagnosis = ?,
          updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        b.visitId ?? null,
        b.screeningDate,
        b.screeningType,
        b.gestationalAgeWeeks,
        b.gestationalAgeDays,
        b.maternalAgeAtDelivery,
        b.maternalWeightKg ?? null,
        b.pregnancyType,
        b.ivfPregnancy ? 1 : 0,
        b.diabetesStatus ? 1 : 0,
        b.smoker ? 1 : 0,
        b.crlMm ?? null,
        b.ntMeasuredMm ?? null,
        b.ntMom ?? null,
        b.nasalBone ?? null,
        b.tricuspidRegurgitation ?? null,
        b.ductusVenosus ?? null,
        b.freeBetaHcgRaw ?? null,
        b.freeBetaHcgMom ?? null,
        b.pappARaw ?? null,
        b.pappAMom ?? null,
        b.bpdMm ?? null,
        b.afpRaw ?? null,
        b.afpMom ?? null,
        b.totalHcgRaw ?? null,
        b.totalHcgMom ?? null,
        b.ue3Raw ?? null,
        b.ue3Mom ?? null,
        b.inhibinARaw ?? null,
        b.inhibinAMom ?? null,
        bgRatio,
        adjT21Ratio,
        adjT21Num,
        adjT18Ratio,
        adjT18Num,
        adjT13Ratio,
        adjT13Num,
        ontdStatus,
        overallTier,
        b.niptSampleDate ?? null,
        b.niptFetalFractionPercent ?? null,
        b.niptT21Result ?? null,
        b.niptT18Result ?? null,
        b.niptT13Result ?? null,
        b.niptSexChromosomes ?? null,
        b.niptMicrodeletions ?? null,
        b.niptLabName ?? null,
        recText,
        b.counselingNotes ?? null,
        b.patientDecision ?? null,
        b.invasiveProcedureType ?? null,
        b.invasiveProcedureDate ?? null,
        b.invasivePerformedBy ?? null,
        b.invasiveSampleDetails ?? null,
        b.antiDGiven ? 1 : 0,
        b.karyotypeResult ?? null,
        b.microarrayCmaResult ?? null,
        b.rapidQfpcrResult ?? null,
        b.finalGeneticDiagnosis ?? null,
        user.id,
        now,
        numId,
      );

      audit(ctx.db, {
        actorId: user.id,
        action: 'genetic.screening_update',
        entity: 'genetic_screening_episode',
        entityId: numId,
        detail: { patientId: numPatientId, overallRiskTier: overallTier },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM genetic_screening_episodes WHERE id = ?').get(numId) as Record<string, unknown>;
    return reply.send(rowToRecord(updated));
  });

  // DELETE /api/patients/:patientId/genetic-screening/:id - Delete episode (Doctor only)
  app.delete('/api/patients/:patientId/genetic-screening/:id', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:write_clinical');
    if (user.role !== 'doctor') {
      throw badRequest('Only an authorized Doctor may delete a genetic screening record');
    }
    const { id, patientId } = req.params as { id: string; patientId: string };
    const numId = Number(id);
    const numPatientId = Number(patientId);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid episode ID');

    const existing = ctx.db.prepare('SELECT id FROM genetic_screening_episodes WHERE id = ? AND patient_id = ?').get(numId, numPatientId);
    if (!existing) throw notFound('Genetic screening episode not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM genetic_screening_episodes WHERE id = ?').run(numId);
      audit(ctx.db, {
        actorId: user.id,
        action: 'genetic.screening_delete',
        entity: 'genetic_screening_episode',
        entityId: numId,
        detail: { patientId: numPatientId },
      });
    });

    return reply.send({ ok: true, deletedId: numId });
  });

  // POST /api/patients/:patientId/genetic-screening/:id/audit-print
  app.post('/api/patients/:patientId/genetic-screening/:id/audit-print', async (req: FastifyRequest, reply) => {
    const user = requirePerm(req, 'patient:read_clinical');
    const { id, patientId } = req.params as { id: string; patientId: string };
    const numId = Number(id);
    const numPatientId = Number(patientId);
    if (!Number.isInteger(numId) || numId <= 0) throw badRequest('Invalid episode ID');

    const existing = ctx.db.prepare('SELECT id FROM genetic_screening_episodes WHERE id = ? AND patient_id = ?').get(numId, numPatientId);
    if (!existing) throw notFound('Genetic screening episode not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'genetic.screening_print',
      entity: 'genetic_screening_episode',
      entityId: numId,
      detail: { patientId: numPatientId },
    });

    return reply.send({ ok: true });
  });
}
