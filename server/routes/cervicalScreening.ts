import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  calculateSwedeScore,
  calculateReidIndex,
  determineBethesdaRisk,
  generateManagementGuideline,
} from '../../web/src/cervicalEngine.js';

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const optNullableInt = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max)
    .nullable()
    .optional();

export const cervicalScreeningSchema = z.object({
  screeningDate: z.string().min(1, 'Screening date is required'),
  screeningType: z.enum([
    'pap_cytology',
    'hpv_dna',
    'co_test',
    'colposcopy_only',
    'post_treatment_followup',
  ]),
  indication: z.enum([
    'routine_screening',
    'abnormal_prior_screening',
    'postcoital_bleeding',
    'intermenstrual_bleeding',
    'persistent_vaginal_discharge',
    'visible_cervical_lesion',
    'post_treatment_surveillance',
    'other',
  ]),

  // Pap Cytology
  papPerformed: z.boolean().default(false),
  papSampleType: z.enum(['liquid_based', 'conventional_smear']).nullable().optional(),
  papAdequacy: z
    .enum([
      'satisfactory_with_ec_tz',
      'satisfactory_without_ec_tz',
      'unsatisfactory_obscured',
      'unsatisfactory_scant',
    ])
    .nullable()
    .optional(),
  papResult: z
    .enum([
      'nilm',
      'asc_us',
      'asc_h',
      'lsil',
      'hsil',
      'scc',
      'agc_nos',
      'agc_neoplastic',
      'ais',
      'adenocarcinoma',
    ])
    .nullable()
    .optional(),
  papInfections: z.array(z.string()).optional(),
  papLabName: optNullableString(200),
  papReportNumber: optNullableString(100),

  // HPV DNA
  hpvPerformed: z.boolean().default(false),
  hpvTestType: z.enum(['pcr', 'hybrid_capture_2', 'cobas', 'genexpert', 'other']).nullable().optional(),
  hpvOverallResult: z.enum(['negative', 'positive', 'invalid_inconclusive']).nullable().optional(),
  hpv16Positive: z.boolean().default(false),
  hpv18Positive: z.boolean().default(false),
  hpv45Positive: z.boolean().default(false),
  hpvOtherHighRiskPositive: z.boolean().default(false),
  hpvViralLoad: optNullableString(100),

  // Colposcopy
  colposcopyPerformed: z.boolean().default(false),
  colposcopyDate: optNullableString(50),
  examinerName: optNullableString(150),
  cervixVisibility: z.enum(['fully_visible', 'partially_visible', 'not_visible']).nullable().optional(),
  transformationZoneType: z.enum(['type_1', 'type_2', 'type_3']).nullable().optional(),
  squamocolumnarJunctionVisible: z
    .enum(['completely_visible', 'partially_visible', 'not_visible'])
    .nullable()
    .optional(),

  // Swede Score
  swedeAcetowhitening: optNullableInt(0, 2),
  swedeMargins: optNullableInt(0, 2),
  swedeVessels: optNullableInt(0, 2),
  swedeLesionSize: optNullableInt(0, 2),
  swedeIodineStaining: optNullableInt(0, 2),

  // Reid Index
  reidMargin: optNullableInt(0, 2),
  reidColor: optNullableInt(0, 2),
  reidVessels: optNullableInt(0, 2),
  reidIodine: optNullableInt(0, 2),

  lesionQuadrants: z.array(z.string()).optional(),
  endocervicalCurettageDone: z.boolean().default(false),

  // Biopsy
  biopsyTaken: z.boolean().default(false),
  biopsyType: z
    .enum([
      'none',
      'punch_biopsy',
      'ecc_only',
      'punch_and_ecc',
      'leep_lletz',
      'cold_knife_conization',
      'cryotherapy',
      'thermal_ablation',
    ])
    .nullable()
    .optional(),
  biopsySites: optNullableString(300),
  biopsyResult: z
    .enum([
      'pending',
      'normal_cervicitis',
      'cin_1_mild',
      'cin_2_moderate',
      'cin_3_severe_cis',
      'squamous_cell_carcinoma',
      'ais',
      'adenocarcinoma',
      'inadequate_sample',
    ])
    .nullable()
    .optional(),
  histopathologyNumber: optNullableString(100),

  // Biopsy details array if passed on creation
  biopsies: z
    .array(
      z.object({
        siteLocation: z.string().min(1),
        clockPosition: z.number().int().min(1).max(12).nullable().optional(),
        specimenLabel: optNullableString(100),
        histopathologyResult: z
          .enum([
            'pending',
            'normal_benign',
            'cin_1',
            'cin_2',
            'cin_3_cis',
            'scc',
            'ais',
            'adenocarcinoma',
            'inconclusive',
          ])
          .default('pending'),
        pathologistNotes: optNullableString(500),
      }),
    )
    .optional(),

  managementRecommendation: optNullableString(500),
  nextRecallMonths: optNullableInt(1, 120),
  clinicalNotes: optNullableString(2000),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('completed'),
});

export const cervicalBiopsySchema = z.object({
  siteLocation: z.string().min(1, 'Site location is required'),
  clockPosition: z.number().int().min(1).max(12).nullable().optional(),
  specimenLabel: optNullableString(100),
  histopathologyResult: z
    .enum([
      'pending',
      'normal_benign',
      'cin_1',
      'cin_2',
      'cin_3_cis',
      'scc',
      'ais',
      'adenocarcinoma',
      'inconclusive',
    ])
    .default('pending'),
  pathologistNotes: optNullableString(500),
});

function assertPatientExists(ctx: Ctx, patientId: number) {
  const patient = ctx.db
    .prepare('SELECT id, full_name, date_of_birth, last_menstrual_period FROM patients WHERE id = ?')
    .get(patientId) as { id: number; full_name: string; date_of_birth: string | null; last_menstrual_period: string | null } | undefined;
  if (!patient) throw notFound('Patient not found');
  return patient;
}

export function registerCervicalScreeningRoutes(app: FastifyInstance, ctx: Ctx) {
  // GET /api/patients/:patientId/cervical-screenings
  app.get('/api/patients/:patientId/cervical-screenings', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid <= 0) throw badRequest('Invalid patient ID');

    assertPatientExists(ctx, pid);

    const rows = ctx.db
      .prepare(
        `SELECT r.*, u.full_name as created_by_name
         FROM cervical_screening_records r
         LEFT JOIN users u ON r.created_by = u.id
         WHERE r.patient_id = ?
         ORDER BY r.screening_date DESC, r.id DESC`,
      )
      .all(pid) as Record<string, unknown>[];

    const records = rows.map((r) => {
      const biopsies = ctx.db
        .prepare('SELECT * FROM cervical_biopsies WHERE screening_id = ? ORDER BY id ASC')
        .all(r.id as number);

      const papInfections = r.pap_infections ? JSON.parse(r.pap_infections as string) : [];
      const lesionQuadrants = r.lesion_quadrants ? JSON.parse(r.lesion_quadrants as string) : [];

      return {
        ...r,
        papInfections,
        lesionQuadrants,
        biopsies,
      };
    });

    return reply.send({ records });
  });

  // GET /api/patients/:patientId/cervical-screenings/:id
  app.get('/api/patients/:patientId/cervical-screenings/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const sid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(sid)) throw badRequest('Invalid ID');

    const patient = assertPatientExists(ctx, pid);

    const record = ctx.db
      .prepare(
        `SELECT r.*, u.full_name as created_by_name
         FROM cervical_screening_records r
         LEFT JOIN users u ON r.created_by = u.id
         WHERE r.id = ? AND r.patient_id = ?`,
      )
      .get(sid, pid) as Record<string, unknown> | undefined;

    if (!record) throw notFound('Cervical screening record not found');

    const biopsies = ctx.db
      .prepare('SELECT * FROM cervical_biopsies WHERE screening_id = ? ORDER BY id ASC')
      .all(sid);

    const papInfections = record.pap_infections ? JSON.parse(record.pap_infections as string) : [];
    const lesionQuadrants = record.lesion_quadrants ? JSON.parse(record.lesion_quadrants as string) : [];

    const isPregnant = Boolean(patient.last_menstrual_period);
    const bethesdaMeta = determineBethesdaRisk(record.pap_result as string | null);

    return reply.send({
      record: {
        ...record,
        papInfections,
        lesionQuadrants,
        biopsies,
      },
      patient,
      isPregnant,
      bethesdaMeta,
    });
  });

  // POST /api/patients/:patientId/cervical-screenings
  app.post('/api/patients/:patientId/cervical-screenings', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid <= 0) throw badRequest('Invalid patient ID');

    const patient = assertPatientExists(ctx, pid);
    const parsed = cervicalScreeningSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const user = req.user;
    const now = nowIso();

    // Auto-calculate Swede score if colposcopy is performed and components are present
    let swedeTotal: number | null = null;
    let swedeInterp: string | null = null;
    if (
      b.colposcopyPerformed &&
      b.swedeAcetowhitening != null &&
      b.swedeMargins != null &&
      b.swedeVessels != null &&
      b.swedeLesionSize != null &&
      b.swedeIodineStaining != null
    ) {
      const swedeRes = calculateSwedeScore({
        acetowhitening: b.swedeAcetowhitening,
        margins: b.swedeMargins,
        vessels: b.swedeVessels,
        lesionSize: b.swedeLesionSize,
        iodineStaining: b.swedeIodineStaining,
      });
      swedeTotal = swedeRes.total;
      swedeInterp = swedeRes.interpretation;
    }

    // Auto-calculate Reid index if provided
    let reidTotal: number | null = null;
    let reidInterp: string | null = null;
    if (
      b.colposcopyPerformed &&
      b.reidMargin != null &&
      b.reidColor != null &&
      b.reidVessels != null &&
      b.reidIodine != null
    ) {
      const reidRes = calculateReidIndex({
        margin: b.reidMargin,
        color: b.reidColor,
        vessels: b.reidVessels,
        iodine: b.reidIodine,
      });
      reidTotal = reidRes.total;
      reidInterp = reidRes.title;
    }

    // Auto-generate management recommendation if not customized
    const isPregnant = Boolean(patient.last_menstrual_period);
    const autoRec = generateManagementGuideline({
      papResult: b.papResult,
      papAdequacy: b.papAdequacy,
      hpvOverall: b.hpvOverallResult,
      hpv16: b.hpv16Positive,
      hpv18: b.hpv18Positive,
      hpv45: b.hpv45Positive,
      hpvOtherHighRisk: b.hpvOtherHighRiskPositive,
      swedeScore: swedeTotal,
      biopsyResult: b.biopsyResult,
      isPregnant,
    });

    const finalRecommendation = b.managementRecommendation || autoRec.recommendation;
    const finalRecallMonths = b.nextRecallMonths ?? autoRec.recallMonths;

    let screeningId = 0;

    tx(ctx.db, () => {
      const stmt = ctx.db.prepare(
        `INSERT INTO cervical_screening_records (
          patient_id, screening_date, screening_type, indication,
          pap_performed, pap_sample_type, pap_adequacy, pap_result, pap_infections, pap_lab_name, pap_report_number,
          hpv_performed, hpv_test_type, hpv_overall_result, hpv_16_positive, hpv_18_positive, hpv_45_positive, hpv_other_high_risk_positive, hpv_viral_load,
          colposcopy_performed, colposcopy_date, examiner_name, cervix_visibility, transformation_zone_type, squamocolumnar_junction_visible,
          swede_acetowhitening, swede_margins, swede_vessels, swede_lesion_size, swede_iodine_staining, swede_score_total, swede_interpretation,
          reid_margin, reid_color, reid_vessels, reid_iodine, reid_score_total, reid_interpretation,
          lesion_quadrants, endocervical_curettage_done,
          biopsy_taken, biopsy_type, biopsy_sites, biopsy_result, histopathology_number,
          management_recommendation, next_recall_months, clinical_notes, status,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )`,
      );

      const res = stmt.run(
        pid,
        b.screeningDate,
        b.screeningType,
        b.indication,
        b.papPerformed ? 1 : 0,
        b.papSampleType ?? null,
        b.papAdequacy ?? null,
        b.papResult ?? null,
        b.papInfections ? JSON.stringify(b.papInfections) : null,
        b.papLabName ?? null,
        b.papReportNumber ?? null,
        b.hpvPerformed ? 1 : 0,
        b.hpvTestType ?? null,
        b.hpvOverallResult ?? null,
        b.hpv16Positive ? 1 : 0,
        b.hpv18Positive ? 1 : 0,
        b.hpv45Positive ? 1 : 0,
        b.hpvOtherHighRiskPositive ? 1 : 0,
        b.hpvViralLoad ?? null,
        b.colposcopyPerformed ? 1 : 0,
        b.colposcopyDate ?? null,
        b.examinerName ?? null,
        b.cervixVisibility ?? null,
        b.transformationZoneType ?? null,
        b.squamocolumnarJunctionVisible ?? null,
        b.swedeAcetowhitening ?? null,
        b.swedeMargins ?? null,
        b.swedeVessels ?? null,
        b.swedeLesionSize ?? null,
        b.swedeIodineStaining ?? null,
        swedeTotal,
        swedeInterp,
        b.reidMargin ?? null,
        b.reidColor ?? null,
        b.reidVessels ?? null,
        b.reidIodine ?? null,
        reidTotal,
        reidInterp,
        b.lesionQuadrants ? JSON.stringify(b.lesionQuadrants) : null,
        b.endocervicalCurettageDone ? 1 : 0,
        b.biopsyTaken ? 1 : 0,
        b.biopsyType ?? null,
        b.biopsySites ?? null,
        b.biopsyResult ?? null,
        b.histopathologyNumber ?? null,
        finalRecommendation,
        finalRecallMonths,
        b.clinicalNotes ?? null,
        b.status,
        user?.id ?? null,
        user?.id ?? null,
        now,
        now,
      );

      screeningId = Number(res.lastInsertRowid);

      if (b.biopsies && b.biopsies.length > 0) {
        const biopsyStmt = ctx.db.prepare(
          `INSERT INTO cervical_biopsies (
            screening_id, patient_id, site_location, clock_position, specimen_label,
            histopathology_result, pathologist_notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const bx of b.biopsies) {
          biopsyStmt.run(
            screeningId,
            pid,
            bx.siteLocation,
            bx.clockPosition ?? null,
            bx.specimenLabel ?? null,
            bx.histopathologyResult,
            bx.pathologistNotes ?? null,
            now,
            now,
          );
        }
      }
    });

    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'cervical.screening_create',
      entity: 'cervical_screening_records',
      entityId: screeningId,
      detail: JSON.stringify({
        patientId: pid,
        screeningType: b.screeningType,
        papResult: b.papResult,
        hpvOverall: b.hpvOverallResult,
        swedeTotal,
        recommendation: finalRecommendation,
      }),
    });

    return reply.status(201).send({
      id: screeningId,
      swedeScoreTotal: swedeTotal,
      swedeInterpretation: swedeInterp,
      reidScoreTotal: reidTotal,
      managementRecommendation: finalRecommendation,
      nextRecallMonths: finalRecallMonths,
      message: 'Cervical screening and colposcopy record created successfully',
    });
  });

  // PUT /api/patients/:patientId/cervical-screenings/:id
  app.put('/api/patients/:patientId/cervical-screenings/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const sid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(sid)) throw badRequest('Invalid ID');

    const patient = assertPatientExists(ctx, pid);
    const existing = ctx.db
      .prepare('SELECT id FROM cervical_screening_records WHERE id = ? AND patient_id = ?')
      .get(sid, pid);
    if (!existing) throw notFound('Cervical screening record not found');

    const parsed = cervicalScreeningSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const user = req.user;
    const now = nowIso();

    let swedeTotal: number | null = null;
    let swedeInterp: string | null = null;
    if (
      b.colposcopyPerformed &&
      b.swedeAcetowhitening != null &&
      b.swedeMargins != null &&
      b.swedeVessels != null &&
      b.swedeLesionSize != null &&
      b.swedeIodineStaining != null
    ) {
      const swedeRes = calculateSwedeScore({
        acetowhitening: b.swedeAcetowhitening,
        margins: b.swedeMargins,
        vessels: b.swedeVessels,
        lesionSize: b.swedeLesionSize,
        iodineStaining: b.swedeIodineStaining,
      });
      swedeTotal = swedeRes.total;
      swedeInterp = swedeRes.interpretation;
    }

    let reidTotal: number | null = null;
    let reidInterp: string | null = null;
    if (
      b.colposcopyPerformed &&
      b.reidMargin != null &&
      b.reidColor != null &&
      b.reidVessels != null &&
      b.reidIodine != null
    ) {
      const reidRes = calculateReidIndex({
        margin: b.reidMargin,
        color: b.reidColor,
        vessels: b.reidVessels,
        iodine: b.reidIodine,
      });
      reidTotal = reidRes.total;
      reidInterp = reidRes.title;
    }

    const isPregnant = Boolean(patient.last_menstrual_period);
    const autoRec = generateManagementGuideline({
      papResult: b.papResult,
      papAdequacy: b.papAdequacy,
      hpvOverall: b.hpvOverallResult,
      hpv16: b.hpv16Positive,
      hpv18: b.hpv18Positive,
      hpv45: b.hpv45Positive,
      hpvOtherHighRisk: b.hpvOtherHighRiskPositive,
      swedeScore: swedeTotal,
      biopsyResult: b.biopsyResult,
      isPregnant,
    });

    const finalRecommendation = b.managementRecommendation || autoRec.recommendation;
    const finalRecallMonths = b.nextRecallMonths ?? autoRec.recallMonths;

    ctx.db
      .prepare(
        `UPDATE cervical_screening_records SET
          screening_date = ?, screening_type = ?, indication = ?,
          pap_performed = ?, pap_sample_type = ?, pap_adequacy = ?, pap_result = ?, pap_infections = ?, pap_lab_name = ?, pap_report_number = ?,
          hpv_performed = ?, hpv_test_type = ?, hpv_overall_result = ?, hpv_16_positive = ?, hpv_18_positive = ?, hpv_45_positive = ?, hpv_other_high_risk_positive = ?, hpv_viral_load = ?,
          colposcopy_performed = ?, colposcopy_date = ?, examiner_name = ?, cervix_visibility = ?, transformation_zone_type = ?, squamocolumnar_junction_visible = ?,
          swede_acetowhitening = ?, swede_margins = ?, swede_vessels = ?, swede_lesion_size = ?, swede_iodine_staining = ?, swede_score_total = ?, swede_interpretation = ?,
          reid_margin = ?, reid_color = ?, reid_vessels = ?, reid_iodine = ?, reid_score_total = ?, reid_interpretation = ?,
          lesion_quadrants = ?, endocervical_curettage_done = ?,
          biopsy_taken = ?, biopsy_type = ?, biopsy_sites = ?, biopsy_result = ?, histopathology_number = ?,
          management_recommendation = ?, next_recall_months = ?, clinical_notes = ?, status = ?,
          updated_by = ?, updated_at = ?
        WHERE id = ? AND patient_id = ?`,
      )
      .run(
        b.screeningDate,
        b.screeningType,
        b.indication,
        b.papPerformed ? 1 : 0,
        b.papSampleType ?? null,
        b.papAdequacy ?? null,
        b.papResult ?? null,
        b.papInfections ? JSON.stringify(b.papInfections) : null,
        b.papLabName ?? null,
        b.papReportNumber ?? null,
        b.hpvPerformed ? 1 : 0,
        b.hpvTestType ?? null,
        b.hpvOverallResult ?? null,
        b.hpv16Positive ? 1 : 0,
        b.hpv18Positive ? 1 : 0,
        b.hpv45Positive ? 1 : 0,
        b.hpvOtherHighRiskPositive ? 1 : 0,
        b.hpvViralLoad ?? null,
        b.colposcopyPerformed ? 1 : 0,
        b.colposcopyDate ?? null,
        b.examinerName ?? null,
        b.cervixVisibility ?? null,
        b.transformationZoneType ?? null,
        b.squamocolumnarJunctionVisible ?? null,
        b.swedeAcetowhitening ?? null,
        b.swedeMargins ?? null,
        b.swedeVessels ?? null,
        b.swedeLesionSize ?? null,
        b.swedeIodineStaining ?? null,
        swedeTotal,
        swedeInterp,
        b.reidMargin ?? null,
        b.reidColor ?? null,
        b.reidVessels ?? null,
        b.reidIodine ?? null,
        reidTotal,
        reidInterp,
        b.lesionQuadrants ? JSON.stringify(b.lesionQuadrants) : null,
        b.endocervicalCurettageDone ? 1 : 0,
        b.biopsyTaken ? 1 : 0,
        b.biopsyType ?? null,
        b.biopsySites ?? null,
        b.biopsyResult ?? null,
        b.histopathologyNumber ?? null,
        finalRecommendation,
        finalRecallMonths,
        b.clinicalNotes ?? null,
        b.status,
        user?.id ?? null,
        now,
        sid,
        pid,
      );

    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'cervical.screening_update',
      entity: 'cervical_screening_records',
      entityId: sid,
      detail: JSON.stringify({ patientId: pid, swedeTotal, recommendation: finalRecommendation }),
    });

    return reply.send({
      id: sid,
      swedeScoreTotal: swedeTotal,
      swedeInterpretation: swedeInterp,
      managementRecommendation: finalRecommendation,
      nextRecallMonths: finalRecallMonths,
      message: 'Cervical screening record updated successfully',
    });
  });

  // DELETE /api/patients/:patientId/cervical-screenings/:id
  app.delete('/api/patients/:patientId/cervical-screenings/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const sid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(sid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);
    const existing = ctx.db
      .prepare('SELECT id FROM cervical_screening_records WHERE id = ? AND patient_id = ?')
      .get(sid, pid);
    if (!existing) throw notFound('Cervical screening record not found');

    ctx.db.prepare('DELETE FROM cervical_screening_records WHERE id = ? AND patient_id = ?').run(sid, pid);

    audit(ctx.db, {
      actorId: req.user?.id ?? null,
      action: 'cervical.screening_delete',
      entity: 'cervical_screening_records',
      entityId: sid,
      detail: JSON.stringify({ patientId: pid }),
    });

    return reply.send({ ok: true, message: 'Screening record deleted' });
  });

  // POST /api/patients/:patientId/cervical-screenings/:id/biopsies
  app.post('/api/patients/:patientId/cervical-screenings/:id/biopsies', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const sid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(sid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);
    const screening = ctx.db
      .prepare('SELECT id FROM cervical_screening_records WHERE id = ? AND patient_id = ?')
      .get(sid, pid);
    if (!screening) throw notFound('Screening record not found');

    const parsed = cervicalBiopsySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const now = nowIso();

    const res = ctx.db
      .prepare(
        `INSERT INTO cervical_biopsies (
          screening_id, patient_id, site_location, clock_position, specimen_label,
          histopathology_result, pathologist_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sid,
        pid,
        b.siteLocation,
        b.clockPosition ?? null,
        b.specimenLabel ?? null,
        b.histopathologyResult,
        b.pathologistNotes ?? null,
        now,
        now,
      );

    const biopsyId = Number(res.lastInsertRowid);

    audit(ctx.db, {
      actorId: req.user?.id ?? null,
      action: 'cervical.biopsy_add',
      entity: 'cervical_biopsies',
      entityId: biopsyId,
      detail: JSON.stringify({ screeningId: sid, siteLocation: b.siteLocation }),
    });

    return reply.status(201).send({
      id: biopsyId,
      screeningId: sid,
      message: 'Biopsy specimen logged successfully',
    });
  });

  // PUT /api/patients/:patientId/cervical-screenings/:id/biopsies/:biopsyId
  app.put('/api/patients/:patientId/cervical-screenings/:id/biopsies/:biopsyId', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id, biopsyId } = req.params as {
      patientId: string;
      id: string;
      biopsyId: string;
    };
    const pid = Number(patientId);
    const sid = Number(id);
    const bid = Number(biopsyId);
    if (!Number.isInteger(pid) || !Number.isInteger(sid) || !Number.isInteger(bid)) {
      throw badRequest('Invalid ID');
    }

    assertPatientExists(ctx, pid);
    const existing = ctx.db
      .prepare('SELECT id FROM cervical_biopsies WHERE id = ? AND screening_id = ? AND patient_id = ?')
      .get(bid, sid, pid);
    if (!existing) throw notFound('Biopsy record not found');

    const parsed = cervicalBiopsySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const now = nowIso();

    ctx.db
      .prepare(
        `UPDATE cervical_biopsies SET
          site_location = ?, clock_position = ?, specimen_label = ?,
          histopathology_result = ?, pathologist_notes = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(
        b.siteLocation,
        b.clockPosition ?? null,
        b.specimenLabel ?? null,
        b.histopathologyResult,
        b.pathologistNotes ?? null,
        now,
        bid,
      );

    audit(ctx.db, {
      actorId: req.user?.id ?? null,
      action: 'cervical.biopsy_update',
      entity: 'cervical_biopsies',
      entityId: bid,
      detail: JSON.stringify({ screeningId: sid, histopathologyResult: b.histopathologyResult }),
    });

    return reply.send({
      id: bid,
      histopathologyResult: b.histopathologyResult,
      message: 'Biopsy result updated',
    });
  });

  // POST /api/patients/:patientId/cervical-screenings/:id/print
  app.post('/api/patients/:patientId/cervical-screenings/:id/print', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const sid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(sid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);

    audit(ctx.db, {
      actorId: req.user?.id ?? null,
      action: 'cervical.print',
      entity: 'cervical_screening_records',
      entityId: sid,
      detail: JSON.stringify({ patientId: pid }),
    });

    return reply.send({ ok: true, printedAt: nowIso() });
  });
}
