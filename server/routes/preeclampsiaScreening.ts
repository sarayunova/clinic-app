import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  calculatePreeclampsiaScreening,
  type PreeclampsiaScreeningInput,
  type PreeclampsiaScreeningResult,
} from '../../web/src/preeclampsiaEngine.js';

function assertCanManagePreeclampsia(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can create or edit pre-eclampsia screenings');
  }
  return user;
}

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

export const preeclampsiaCalculateSchema = z.object({
  gestationalAgeWeeks: z.number().int().min(11).max(14, 'GA must be 11 to 14 weeks for 1st-trimester PE screening'),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  crlMm: optNullableNumber(45, 84),
  maternalAge: z.number().int().min(12).max(65),
  maternalWeightKg: optNullableNumber(30, 250),
  maternalHeightCm: optNullableNumber(100, 220),
  bmi: optNullableNumber(12, 60),
  ethnicity: z.enum(['south_asian', 'caucasian', 'afro_caribbean', 'east_asian', 'other']).default('south_asian'),
  parity: z.enum(['nulliparous', 'multiparous_no_pe', 'multiparous_prior_pe']).default('nulliparous'),
  priorPeOnsetGestation: z.enum(['early_lt_34', 'preterm_34_37', 'term_gt_37']).nullable().optional(),
  conceptionMethod: z.enum(['spontaneous', 'ivf_art', 'ovulation_induction']).default('spontaneous'),
  smokingStatus: z.enum(['non_smoker', 'smoker', 'cessation_early_pregnancy']).default('non_smoker'),
  familyHistoryPe: z.boolean().default(false),
  chronicHypertension: z.boolean().default(false),
  pregestationalDiabetes: z.boolean().default(false),
  systemicLupusOrAps: z.boolean().default(false),
  chronicKidneyDisease: z.boolean().default(false),
  interpregnancyIntervalYears: optNullableNumber(0, 40),

  // MAP
  sbpRight: optNullableNumber(60, 250),
  dbpRight: optNullableNumber(30, 160),
  sbpLeft: optNullableNumber(60, 250),
  dbpLeft: optNullableNumber(30, 160),
  meanArterialPressure: optNullableNumber(40, 200),

  // UtA PI
  utaPiLeft: optNullableNumber(0.2, 5.0),
  utaPiRight: optNullableNumber(0.2, 5.0),
  utaPiMean: optNullableNumber(0.2, 5.0),
  utaBilateralNotching: z.boolean().default(false),

  // Serum
  serumPlgfPgMl: optNullableNumber(1, 1000),
  plgfMom: optNullableNumber(0.01, 10.0),
  serumPappaIuL: optNullableNumber(0.01, 100.0),
  pappaMom: optNullableNumber(0.01, 10.0),
});

export const preeclampsiaScreeningSchema = preeclampsiaCalculateSchema.extend({
  patientId: z.number().int().positive('Valid patient ID required'),
  visitId: z.number().int().positive().nullable().optional(),
  ultrasoundReportId: z.number().int().positive().nullable().optional(),
  assessmentDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  assessmentTime: z.string().max(10).nullable().optional(),
  clinicalNotes: optNullableString(2000),
  performedBy: optNullableString(120),
  reviewedBy: z.number().int().positive().optional(),
});

function rowToScreening(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    visitId: r.visit_id,
    ultrasoundReportId: r.ultrasound_report_id,
    assessmentDate: r.assessment_date,
    assessmentTime: r.assessment_time,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    crlMm: r.crl_mm,

    maternalAge: r.maternal_age,
    maternalWeightKg: r.maternal_weight_kg,
    maternalHeightCm: r.maternal_height_cm,
    bmi: r.bmi,
    ethnicity: r.ethnicity,
    parity: r.parity,
    priorPeOnsetGestation: r.prior_pe_onset_gestation,
    conceptionMethod: r.conception_method,
    smokingStatus: r.smoking_status,
    familyHistoryPe: Boolean(r.family_history_pe),
    chronicHypertension: Boolean(r.chronic_hypertension),
    pregestationalDiabetes: Boolean(r.pregestational_diabetes),
    systemicLupusOrAps: Boolean(r.systemic_lupus_or_aps),
    chronicKidneyDisease: Boolean(r.chronic_kidney_disease),
    interpregnancyIntervalYears: r.interpregnancy_interval_years,

    sbpRight: r.sbp_right,
    dbpRight: r.dbp_right,
    sbpLeft: r.sbp_left,
    dbpLeft: r.dbp_left,
    meanArterialPressure: r.mean_arterial_pressure,
    mapMom: r.map_mom,

    utaPiLeft: r.uta_pi_left,
    utaPiRight: r.uta_pi_right,
    utaPiMean: r.uta_pi_mean,
    utaPiMom: r.uta_pi_mom,
    utaBilateralNotching: Boolean(r.uta_bilateral_notching),

    serumPlgfPgMl: r.serum_plgf_pg_ml,
    plgfMom: r.plgf_mom,
    serumPappaIuL: r.serum_pappa_iu_l,
    pappaMom: r.pappa_mom,

    backgroundRiskRatio: r.background_risk_ratio,
    backgroundRiskNumeric: r.background_risk_numeric,
    fmfRiskRatio: r.fmf_risk_ratio,
    fmfRiskNumeric: r.fmf_risk_numeric,
    fmfRiskCategory: r.fmf_risk_category,
    clinicalRiskCategory: r.clinical_risk_category,
    overallRiskTier: r.overall_risk_tier,

    aspirinIndicated: Boolean(r.aspirin_indicated),
    aspirinDoseMg: r.aspirin_dose_mg,
    aspirinTimingRationale: r.aspirin_timing_rationale,
    calciumIndicated: Boolean(r.calcium_indicated),
    calciumDoseMg: r.calcium_dose_mg,
    surveillanceInterval: r.surveillance_interval,
    repeatScanWeeks: r.repeat_scan_weeks,

    clinicalNotes: r.clinical_notes,
    performedBy: r.performed_by,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,

    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerPreeclampsiaScreeningRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Real-time Calculation Preview
  app.post('/api/preeclampsia/calculate', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = preeclampsiaCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid pre-eclampsia screening parameters', parsed.error.format());
    }

    const calcResult = calculatePreeclampsiaScreening({
      gestationalAgeWeeks: parsed.data.gestationalAgeWeeks,
      gestationalAgeDays: parsed.data.gestationalAgeDays,
      crlMm: parsed.data.crlMm ?? undefined,
      maternalAge: parsed.data.maternalAge,
      maternalWeightKg: parsed.data.maternalWeightKg ?? undefined,
      maternalHeightCm: parsed.data.maternalHeightCm ?? undefined,
      bmi: parsed.data.bmi ?? undefined,
      ethnicity: parsed.data.ethnicity,
      parity: parsed.data.parity,
      priorPeOnsetGestation: parsed.data.priorPeOnsetGestation ?? undefined,
      conceptionMethod: parsed.data.conceptionMethod,
      smokingStatus: parsed.data.smokingStatus,
      familyHistoryPe: parsed.data.familyHistoryPe,
      chronicHypertension: parsed.data.chronicHypertension,
      pregestationalDiabetes: parsed.data.pregestationalDiabetes,
      systemicLupusOrAps: parsed.data.systemicLupusOrAps,
      chronicKidneyDisease: parsed.data.chronicKidneyDisease,
      interpregnancyIntervalYears: parsed.data.interpregnancyIntervalYears ?? undefined,
      sbpRight: parsed.data.sbpRight ?? undefined,
      dbpRight: parsed.data.dbpRight ?? undefined,
      sbpLeft: parsed.data.sbpLeft ?? undefined,
      dbpLeft: parsed.data.dbpLeft ?? undefined,
      meanArterialPressure: parsed.data.meanArterialPressure ?? undefined,
      utaPiLeft: parsed.data.utaPiLeft ?? undefined,
      utaPiRight: parsed.data.utaPiRight ?? undefined,
      utaPiMean: parsed.data.utaPiMean ?? undefined,
      utaBilateralNotching: parsed.data.utaBilateralNotching,
      serumPlgfPgMl: parsed.data.serumPlgfPgMl ?? undefined,
      plgfMom: parsed.data.plgfMom ?? undefined,
      serumPappaIuL: parsed.data.serumPappaIuL ?? undefined,
      pappaMom: parsed.data.pappaMom ?? undefined,
    });

    return calcResult;
  });

  // 2. List Patient Screenings
  app.get<{ Params: { patientId: string } }>(
    '/api/patients/:patientId/preeclampsia',
    async (req, reply) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number.parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

      const rows = ctx.db
        .prepare(
          `SELECT pe.*, u.full_name as reviewed_by_name
           FROM preeclampsia_screenings pe
           LEFT JOIN users u ON u.id = pe.reviewed_by
           WHERE pe.patient_id = ?
           ORDER BY pe.assessment_date DESC, pe.created_at DESC`,
        )
        .all(patientId);

      return rows.map(rowToScreening);
    },
  );

  // 3. Get Single Screening
  app.get<{ Params: { id: string } }>('/api/preeclampsia/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid screening ID');

    const row = ctx.db
      .prepare(
        `SELECT pe.*, u.full_name as reviewed_by_name
         FROM preeclampsia_screenings pe
         LEFT JOIN users u ON u.id = pe.reviewed_by
         WHERE pe.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('Pre-eclampsia screening record not found');
    return rowToScreening(row);
  });

  // 4. Create Screening Record
  app.post('/api/preeclampsia', async (req: FastifyRequest, reply) => {
    const user = assertCanManagePreeclampsia(req);
    const parsed = preeclampsiaScreeningSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const calc = calculatePreeclampsiaScreening({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      gestationalAgeDays: data.gestationalAgeDays,
      crlMm: data.crlMm ?? undefined,
      maternalAge: data.maternalAge,
      maternalWeightKg: data.maternalWeightKg ?? undefined,
      maternalHeightCm: data.maternalHeightCm ?? undefined,
      bmi: data.bmi ?? undefined,
      ethnicity: data.ethnicity,
      parity: data.parity,
      priorPeOnsetGestation: data.priorPeOnsetGestation ?? undefined,
      conceptionMethod: data.conceptionMethod,
      smokingStatus: data.smokingStatus,
      familyHistoryPe: data.familyHistoryPe,
      chronicHypertension: data.chronicHypertension,
      pregestationalDiabetes: data.pregestationalDiabetes,
      systemicLupusOrAps: data.systemicLupusOrAps,
      chronicKidneyDisease: data.chronicKidneyDisease,
      interpregnancyIntervalYears: data.interpregnancyIntervalYears ?? undefined,
      sbpRight: data.sbpRight ?? undefined,
      dbpRight: data.dbpRight ?? undefined,
      sbpLeft: data.sbpLeft ?? undefined,
      dbpLeft: data.dbpLeft ?? undefined,
      meanArterialPressure: data.meanArterialPressure ?? undefined,
      utaPiLeft: data.utaPiLeft ?? undefined,
      utaPiRight: data.utaPiRight ?? undefined,
      utaPiMean: data.utaPiMean ?? undefined,
      utaBilateralNotching: data.utaBilateralNotching,
      serumPlgfPgMl: data.serumPlgfPgMl ?? undefined,
      plgfMom: data.plgfMom ?? undefined,
      serumPappaIuL: data.serumPappaIuL ?? undefined,
      pappaMom: data.pappaMom ?? undefined,
    });

    const now = nowIso();
    const reviewedBy = data.reviewedBy || user.id;

    const insertedId = tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        INSERT INTO preeclampsia_screenings (
          patient_id, visit_id, ultrasound_report_id, assessment_date, assessment_time,
          gestational_age_weeks, gestational_age_days, crl_mm,
          maternal_age, maternal_weight_kg, maternal_height_cm, bmi,
          ethnicity, parity, prior_pe_onset_gestation, conception_method, smoking_status,
          family_history_pe, chronic_hypertension, pregestational_diabetes,
          systemic_lupus_or_aps, chronic_kidney_disease, interpregnancy_interval_years,
          sbp_right, dbp_right, sbp_left, dbp_left,
          mean_arterial_pressure, map_mom,
          uta_pi_left, uta_pi_right, uta_pi_mean, uta_pi_mom, uta_bilateral_notching,
          serum_plgf_pg_ml, plgf_mom, serum_pappa_iu_l, pappa_mom,
          background_risk_ratio, background_risk_numeric,
          fmf_risk_ratio, fmf_risk_numeric, fmf_risk_category,
          clinical_risk_category, overall_risk_tier,
          aspirin_indicated, aspirin_dose_mg, aspirin_timing_rationale,
          calcium_indicated, calcium_dose_mg, surveillance_interval, repeat_scan_weeks,
          clinical_notes, performed_by, reviewed_by, created_by, updated_by,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      const result = stmt.run(
        data.patientId,
        data.visitId ?? null,
        data.ultrasoundReportId ?? null,
        data.assessmentDate,
        data.assessmentTime ?? null,
        data.gestationalAgeWeeks,
        data.gestationalAgeDays,
        calc.crlMm ?? null,
        data.maternalAge,
        data.maternalWeightKg ?? null,
        data.maternalHeightCm ?? null,
        calc.bmi,
        data.ethnicity,
        data.parity,
        data.priorPeOnsetGestation ?? null,
        data.conceptionMethod,
        data.smokingStatus,
        data.familyHistoryPe ? 1 : 0,
        data.chronicHypertension ? 1 : 0,
        data.pregestationalDiabetes ? 1 : 0,
        data.systemicLupusOrAps ? 1 : 0,
        data.chronicKidneyDisease ? 1 : 0,
        data.interpregnancyIntervalYears ?? null,
        data.sbpRight ?? null,
        data.dbpRight ?? null,
        data.sbpLeft ?? null,
        data.dbpLeft ?? null,
        calc.meanArterialPressure,
        calc.mapMom,
        data.utaPiLeft ?? null,
        data.utaPiRight ?? null,
        calc.utaPiMean,
        calc.utaPiMom,
        calc.utaBilateralNotching ? 1 : 0,
        data.serumPlgfPgMl ?? null,
        calc.plgfMom ?? null,
        data.serumPappaIuL ?? null,
        calc.pappaMom ?? null,
        calc.backgroundRiskRatio,
        calc.backgroundRiskNumeric,
        calc.fmfRiskRatio,
        calc.fmfRiskNumeric,
        calc.fmfRiskCategory,
        calc.clinicalRiskCategory,
        calc.overallRiskTier,
        calc.aspirinIndicated ? 1 : 0,
        calc.aspirinDoseMg,
        calc.aspirinTimingRationale,
        calc.calciumIndicated ? 1 : 0,
        calc.calciumDoseMg,
        calc.surveillanceInterval,
        calc.repeatScanWeeks,
        data.clinicalNotes ?? null,
        data.performedBy ?? null,
        reviewedBy,
        user.id,
        user.id,
        now,
        now,
      );

      const newId = Number(result.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'preeclampsia.screening_create',
        entity: 'preeclampsia_screenings',
        entityId: newId,
        detail: JSON.stringify({
          patientId: data.patientId,
          gaWeeks: data.gestationalAgeWeeks,
          overallRiskTier: calc.overallRiskTier,
          aspirinIndicated: calc.aspirinIndicated,
          fmfRiskRatio: calc.fmfRiskRatio,
        }),
      });

      return newId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT pe.*, u.full_name as reviewed_by_name
         FROM preeclampsia_screenings pe
         LEFT JOIN users u ON u.id = pe.reviewed_by
         WHERE pe.id = ?`,
      )
      .get(insertedId);

    return rowToScreening(created);
  });

  // 5. Update Screening Record
  app.put<{ Params: { id: string } }>('/api/preeclampsia/:id', async (req, reply) => {
    const user = assertCanManagePreeclampsia(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid screening ID');

    const existing = ctx.db
      .prepare('SELECT * FROM preeclampsia_screenings WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Screening record not found');

    const parsed = preeclampsiaScreeningSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const calc = calculatePreeclampsiaScreening({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      gestationalAgeDays: data.gestationalAgeDays,
      crlMm: data.crlMm ?? undefined,
      maternalAge: data.maternalAge,
      maternalWeightKg: data.maternalWeightKg ?? undefined,
      maternalHeightCm: data.maternalHeightCm ?? undefined,
      bmi: data.bmi ?? undefined,
      ethnicity: data.ethnicity,
      parity: data.parity,
      priorPeOnsetGestation: data.priorPeOnsetGestation ?? undefined,
      conceptionMethod: data.conceptionMethod,
      smokingStatus: data.smokingStatus,
      familyHistoryPe: data.familyHistoryPe,
      chronicHypertension: data.chronicHypertension,
      pregestationalDiabetes: data.pregestationalDiabetes,
      systemicLupusOrAps: data.systemicLupusOrAps,
      chronicKidneyDisease: data.chronicKidneyDisease,
      interpregnancyIntervalYears: data.interpregnancyIntervalYears ?? undefined,
      sbpRight: data.sbpRight ?? undefined,
      dbpRight: data.dbpRight ?? undefined,
      sbpLeft: data.sbpLeft ?? undefined,
      dbpLeft: data.dbpLeft ?? undefined,
      meanArterialPressure: data.meanArterialPressure ?? undefined,
      utaPiLeft: data.utaPiLeft ?? undefined,
      utaPiRight: data.utaPiRight ?? undefined,
      utaPiMean: data.utaPiMean ?? undefined,
      utaBilateralNotching: data.utaBilateralNotching,
      serumPlgfPgMl: data.serumPlgfPgMl ?? undefined,
      plgfMom: data.plgfMom ?? undefined,
      serumPappaIuL: data.serumPappaIuL ?? undefined,
      pappaMom: data.pappaMom ?? undefined,
    });

    const now = nowIso();
    const reviewedBy = data.reviewedBy || existing.reviewed_by;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE preeclampsia_screenings SET
            visit_id = ?, ultrasound_report_id = ?, assessment_date = ?, assessment_time = ?,
            gestational_age_weeks = ?, gestational_age_days = ?, crl_mm = ?,
            maternal_age = ?, maternal_weight_kg = ?, maternal_height_cm = ?, bmi = ?,
            ethnicity = ?, parity = ?, prior_pe_onset_gestation = ?, conception_method = ?, smoking_status = ?,
            family_history_pe = ?, chronic_hypertension = ?, pregestational_diabetes = ?,
            systemic_lupus_or_aps = ?, chronic_kidney_disease = ?, interpregnancy_interval_years = ?,
            sbp_right = ?, dbp_right = ?, sbp_left = ?, dbp_left = ?,
            mean_arterial_pressure = ?, map_mom = ?,
            uta_pi_left = ?, uta_pi_right = ?, uta_pi_mean = ?, uta_pi_mom = ?, uta_bilateral_notching = ?,
            serum_plgf_pg_ml = ?, plgf_mom = ?, serum_pappa_iu_l = ?, pappa_mom = ?,
            background_risk_ratio = ?, background_risk_numeric = ?,
            fmf_risk_ratio = ?, fmf_risk_numeric = ?, fmf_risk_category = ?,
            clinical_risk_category = ?, overall_risk_tier = ?,
            aspirin_indicated = ?, aspirin_dose_mg = ?, aspirin_timing_rationale = ?,
            calcium_indicated = ?, calcium_dose_mg = ?, surveillance_interval = ?, repeat_scan_weeks = ?,
            clinical_notes = ?, performed_by = ?, reviewed_by = ?, updated_by = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          data.visitId ?? null,
          data.ultrasoundReportId ?? null,
          data.assessmentDate,
          data.assessmentTime ?? null,
          data.gestationalAgeWeeks,
          data.gestationalAgeDays,
          calc.crlMm ?? null,
          data.maternalAge,
          data.maternalWeightKg ?? null,
          data.maternalHeightCm ?? null,
          calc.bmi,
          data.ethnicity,
          data.parity,
          data.priorPeOnsetGestation ?? null,
          data.conceptionMethod,
          data.smokingStatus,
          data.familyHistoryPe ? 1 : 0,
          data.chronicHypertension ? 1 : 0,
          data.pregestationalDiabetes ? 1 : 0,
          data.systemicLupusOrAps ? 1 : 0,
          data.chronicKidneyDisease ? 1 : 0,
          data.interpregnancyIntervalYears ?? null,
          data.sbpRight ?? null,
          data.dbpRight ?? null,
          data.sbpLeft ?? null,
          data.dbpLeft ?? null,
          calc.meanArterialPressure,
          calc.mapMom,
          data.utaPiLeft ?? null,
          data.utaPiRight ?? null,
          calc.utaPiMean,
          calc.utaPiMom,
          calc.utaBilateralNotching ? 1 : 0,
          data.serumPlgfPgMl ?? null,
          calc.plgfMom ?? null,
          data.serumPappaIuL ?? null,
          calc.pappaMom ?? null,
          calc.backgroundRiskRatio,
          calc.backgroundRiskNumeric,
          calc.fmfRiskRatio,
          calc.fmfRiskNumeric,
          calc.fmfRiskCategory,
          calc.clinicalRiskCategory,
          calc.overallRiskTier,
          calc.aspirinIndicated ? 1 : 0,
          calc.aspirinDoseMg,
          calc.aspirinTimingRationale,
          calc.calciumIndicated ? 1 : 0,
          calc.calciumDoseMg,
          calc.surveillanceInterval,
          calc.repeatScanWeeks,
          data.clinicalNotes ?? null,
          data.performedBy ?? null,
          reviewedBy,
          user.id,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'preeclampsia.screening_update',
        entity: 'preeclampsia_screenings',
        entityId: id,
        detail: JSON.stringify({
          patientId: existing.patient_id,
          overallRiskTier: calc.overallRiskTier,
          fmfRiskRatio: calc.fmfRiskRatio,
        }),
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT pe.*, u.full_name as reviewed_by_name
         FROM preeclampsia_screenings pe
         LEFT JOIN users u ON u.id = pe.reviewed_by
         WHERE pe.id = ?`,
      )
      .get(id);

    return rowToScreening(updated);
  });

  // 6. Delete Screening Record
  app.delete<{ Params: { id: string } }>('/api/preeclampsia/:id', async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'user:manage') && !can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only doctors or administrators can delete pre-eclampsia records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid screening ID');

    const existing = ctx.db
      .prepare('SELECT id, patient_id FROM preeclampsia_screenings WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Screening record not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM preeclampsia_screenings WHERE id = ?').run(id);
      audit(ctx.db, {
        actorId: user.id,
        action: 'preeclampsia.screening_delete',
        entity: 'preeclampsia_screenings',
        entityId: id,
        detail: JSON.stringify({ patientId: existing.patient_id }),
      });
    });

    return { ok: true, deletedId: id };
  });

  // 7. Audit Print Event
  app.post<{ Params: { id: string } }>('/api/preeclampsia/:id/audit-print', async (req, reply) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid screening ID');

    const existing = ctx.db
      .prepare('SELECT id, patient_id FROM preeclampsia_screenings WHERE id = ?')
      .get(id) as any;
    if (!existing) throw notFound('Screening record not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'preeclampsia.screening_print',
      entity: 'preeclampsia_screenings',
      entityId: id,
      detail: JSON.stringify({ patientId: existing.patient_id }),
    });

    return { ok: true };
  });
}
