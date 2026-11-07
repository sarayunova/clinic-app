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
  calculateRmi1,
  evaluateIotaSimpleRules,
  evaluatePmbEndometrialThickness,
  type RmiCalculationInput,
  type IotaRulesInput,
} from '../../web/src/gynOncologyEngine.js';

function assertCanManageGynOnc(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage gynecological oncology records');
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

export const gynOncCalculateSchema = z.object({
  ca125LevelUml: z.number().min(0).max(100000).default(0),
  isPostmenopausal: z.boolean(),
  multilocularCysts: z.boolean().default(false),
  solidAreasPresent: z.boolean().default(false),
  bilateralLesions: z.boolean().default(false),
  ascitesPresent: z.boolean().default(false),
  metastasesPresent: z.boolean().default(false),

  // IOTA optional features for preview
  b1Unilocular: z.boolean().default(false),
  b2SolidLargestLt7mm: z.boolean().default(false),
  b3AcousticShadows: z.boolean().default(false),
  b4SmoothMultilocularLt100mm: z.boolean().default(false),
  b5NoBloodFlowScore1: z.boolean().default(false),

  m1IrregularSolid: z.boolean().default(false),
  m2Ascites: z.boolean().default(false),
  m3AtLeast4PapillaryStructures: z.boolean().default(false),
  m4IrregularMultilocularSolidGe100mm: z.boolean().default(false),
  m5VeryStrongBloodFlowScore4: z.boolean().default(false),

  // PMB optional features
  hasPostmenopausalBleeding: z.boolean().default(false),
  endometrialThicknessMm: z.number().min(0).max(100).default(0),
  onTamoxifen: z.boolean().default(false),
});

export const gynOncEpisodeSchema = z.object({
  patientId: z.number().int().positive(),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDate: z.string().regex(dateRegex, 'Assessment date must be YYYY-MM-DD'),
  clinicalIndication: z.enum([
    'adnexal_mass',
    'postmenopausal_bleeding',
    'cervical_neoplasia_suspected',
    'endometrial_thickening',
    'abnormal_uterine_bleeding',
  ]),
  menopausalStatus: z.enum(['premenopausal', 'postmenopausal']),

  // Tumor Markers
  ca125LevelUml: optNullableNumber(0, 100000),
  he4PmolL: optNullableNumber(0, 5000),
  romaScorePercent: optNullableNumber(0, 100),

  // Ultrasound Morphology
  lesionMaxDiameterMm: optNullableNumber(0, 500),
  proportionSolidTissuePercent: optNullableNumber(0, 100),
  papillaryProjectionsCount: z.number().int().min(0).max(50).default(0),
  acousticShadowsPresent: z.boolean().default(false),
  ascitesPresent: z.boolean().default(false),
  bilateralLesions: z.boolean().default(false),
  multilocularCysts: z.boolean().default(false),
  colorDopplerScore: optNullableNumber(1, 4),

  // IOTA & RMI outputs (auto-derived or user override)
  iotaSimpleRulesCategory: z.enum(['benign', 'malignant', 'inconclusive']).optional(),
  iotaPredictedMalignancyRiskPct: optNullableNumber(0, 100),
  rmiScore: optNullableNumber(0, 500000),
  rmiRiskTier: z.enum(['low_risk_le_25', 'intermediate_risk_26_200', 'high_risk_gt_200']).optional(),

  // Endometrial Assessment
  endometrialThicknessMm: optNullableNumber(0, 100),
  endometrialBiopsyDone: z.boolean().default(false),
  endometrialHistology: optNullableString(500),

  // Cervical & FIGO
  cervicalLesionVisible: z.boolean().default(false),
  figoClinicalStage: optNullableString(100),

  // Tumor Board & Care Plan
  multidisciplinaryTumorBoardStatus: z.enum(['not_required_benign', 'pending_board_review', 'discussed_approved']).default('not_required_benign'),
  managementPlan: optNullableString(1000),
  surgicalStagingDetails: optNullableString(1000),
  clinicalNotes: optNullableString(2000),

  gynOncologistName: optNullableString(150),
  reviewedBy: z.number().int().positive().optional(),
});

function rowToGynOnc(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    assessmentDate: r.assessment_date,
    clinicalIndication: r.clinical_indication,
    menopausalStatus: r.menopausal_status,

    ca125LevelUml: r.ca125_level_u_ml,
    he4PmolL: r.he4_pmol_l,
    romaScorePercent: r.roma_score_percent,

    lesionMaxDiameterMm: r.lesion_max_diameter_mm,
    proportionSolidTissuePercent: r.proportion_solid_tissue_percent,
    papillaryProjectionsCount: r.papillary_projections_count,
    acousticShadowsPresent: Boolean(r.acoustic_shadows_present),
    ascitesPresent: Boolean(r.ascites_present),
    bilateralLesions: Boolean(r.bilateral_lesions),
    multilocularCysts: Boolean(r.multilocular_cysts),
    colorDopplerScore: r.color_doppler_score,

    iotaSimpleRulesCategory: r.iota_simple_rules_category,
    iotaPredictedMalignancyRiskPct: r.iota_predicted_malignancy_risk_pct,
    rmiScore: r.rmi_score,
    rmiRiskTier: r.rmi_risk_tier,

    endometrialThicknessMm: r.endometrial_thickness_mm,
    endometrialBiopsyDone: Boolean(r.endometrial_biopsy_done),
    endometrialHistology: r.endometrial_histology,

    cervicalLesionVisible: Boolean(r.cervical_lesion_visible),
    figoClinicalStage: r.figo_clinical_stage,

    multidisciplinaryTumorBoardStatus: r.multidisciplinary_tumor_board_status,
    managementPlan: r.management_plan,
    surgicalStagingDetails: r.surgical_staging_details,
    clinicalNotes: r.clinical_notes,

    gynOncologistName: r.gyn_oncologist_name,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerGynOncologyRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Live Malignancy Risk Calculation Preview
  app.post('/api/gyn-oncology/calculate-rmi', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = gynOncCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;

    const rmiInput: RmiCalculationInput = {
      ca125LevelUml: d.ca125LevelUml,
      isPostmenopausal: d.isPostmenopausal,
      multilocularCysts: d.multilocularCysts,
      solidAreasPresent: d.solidAreasPresent,
      bilateralLesions: d.bilateralLesions,
      ascitesPresent: d.ascitesPresent,
      metastasesPresent: d.metastasesPresent,
    };
    const rmiRes = calculateRmi1(rmiInput);

    const iotaInput: IotaRulesInput = {
      b1Unilocular: d.b1Unilocular,
      b2SolidLargestLt7mm: d.b2SolidLargestLt7mm,
      b3AcousticShadows: d.b3AcousticShadows,
      b4SmoothMultilocularLt100mm: d.b4SmoothMultilocularLt100mm,
      b5NoBloodFlowScore1: d.b5NoBloodFlowScore1,
      m1IrregularSolid: d.m1IrregularSolid,
      m2Ascites: d.m2Ascites,
      m3AtLeast4PapillaryStructures: d.m3AtLeast4PapillaryStructures,
      m4IrregularMultilocularSolidGe100mm: d.m4IrregularMultilocularSolidGe100mm,
      m5VeryStrongBloodFlowScore4: d.m5VeryStrongBloodFlowScore4,
    };
    const iotaRes = evaluateIotaSimpleRules(iotaInput);

    const pmbRes = evaluatePmbEndometrialThickness({
      isPostmenopausal: d.isPostmenopausal,
      hasPostmenopausalBleeding: d.hasPostmenopausalBleeding,
      endometrialThicknessMm: d.endometrialThicknessMm,
      onTamoxifen: d.onTamoxifen,
    });

    return {
      rmi: rmiRes,
      iota: iotaRes,
      pmb: pmbRes,
    };
  });

  // 2. List episodes for a patient
  app.get<{ Params: { patientId: string } }>('/api/patients/:patientId/gyn-oncology', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const rows = ctx.db
      .prepare(
        `SELECT g.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM gyn_oncology_episodes g
         LEFT JOIN users rev ON rev.id = g.reviewed_by
         LEFT JOIN users c ON c.id = g.created_by
         WHERE g.patient_id = ?
         ORDER BY g.assessment_date DESC, g.id DESC`,
      )
      .all(patientId);

    return rows.map(rowToGynOnc);
  });

  // 3. Get episode by ID
  app.get<{ Params: { id: string } }>('/api/gyn-oncology/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const row = ctx.db
      .prepare(
        `SELECT g.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM gyn_oncology_episodes g
         LEFT JOIN users rev ON rev.id = g.reviewed_by
         LEFT JOIN users c ON c.id = g.created_by
         WHERE g.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('Gynecological oncology assessment not found');
    return rowToGynOnc(row);
  });

  // 4. Create episode
  app.post('/api/gyn-oncology', async (req, reply) => {
    const user = assertCanManageGynOnc(req);
    const parsed = gynOncEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const d = parsed.data;
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(d.patientId);
    if (!patient) throw notFound('Patient not found');

    if (d.admissionId) {
      const admission = ctx.db
        .prepare('SELECT id FROM admissions WHERE id = ? AND patient_id = ?')
        .get(d.admissionId, d.patientId);
      if (!admission) throw badRequest('Admission does not belong to this patient');
    }

    // Auto-calculate RMI if not supplied
    let rmiScore = d.rmiScore;
    let rmiRiskTier = d.rmiRiskTier;
    if (rmiScore === null || rmiScore === undefined || !rmiRiskTier) {
      const isPost = d.menopausalStatus === 'postmenopausal';
      const rmiCalc = calculateRmi1({
        ca125LevelUml: d.ca125LevelUml ?? 0,
        isPostmenopausal: isPost,
        multilocularCysts: d.multilocularCysts,
        solidAreasPresent: (d.proportionSolidTissuePercent ?? 0) > 0,
        bilateralLesions: d.bilateralLesions,
        ascitesPresent: d.ascitesPresent,
        metastasesPresent: false,
      });
      rmiScore = rmiCalc.rmiScore;
      rmiRiskTier = rmiCalc.riskTier;
    }

    // Derive IOTA simple rules category if not provided
    let iotaCategory = d.iotaSimpleRulesCategory;
    if (!iotaCategory) {
      const iotaCalc = evaluateIotaSimpleRules({
        b1Unilocular: !d.multilocularCysts && (d.proportionSolidTissuePercent ?? 0) === 0,
        b2SolidLargestLt7mm: false,
        b3AcousticShadows: d.acousticShadowsPresent,
        b4SmoothMultilocularLt100mm: d.multilocularCysts && (d.lesionMaxDiameterMm ?? 0) < 100,
        b5NoBloodFlowScore1: (d.colorDopplerScore ?? 1) === 1,
        m1IrregularSolid: (d.proportionSolidTissuePercent ?? 0) > 50,
        m2Ascites: d.ascitesPresent,
        m3AtLeast4PapillaryStructures: d.papillaryProjectionsCount >= 4,
        m4IrregularMultilocularSolidGe100mm: d.multilocularCysts && (d.lesionMaxDiameterMm ?? 0) >= 100,
        m5VeryStrongBloodFlowScore4: (d.colorDopplerScore ?? 1) === 4,
      });
      iotaCategory = iotaCalc.category;
    }

    const reviewedBy = d.reviewedBy ?? user.id;
    const reviewer = ctx.db.prepare('SELECT id FROM users WHERE id = ?').get(reviewedBy);
    if (!reviewer) throw badRequest('Reviewing clinician does not exist');

    const now = nowIso();

    const insertSql = `
      INSERT INTO gyn_oncology_episodes (
        patient_id, admission_id, assessment_date, clinical_indication, menopausal_status,
        ca125_level_u_ml, he4_pmol_l, roma_score_percent,
        lesion_max_diameter_mm, proportion_solid_tissue_percent, papillary_projections_count,
        acoustic_shadows_present, ascites_present, bilateral_lesions, multilocular_cysts,
        color_doppler_score,
        iota_simple_rules_category, iota_predicted_malignancy_risk_pct,
        rmi_score, rmi_risk_tier,
        endometrial_thickness_mm, endometrial_biopsy_done, endometrial_histology,
        cervical_lesion_visible, figo_clinical_stage,
        multidisciplinary_tumor_board_status, management_plan, surgical_staging_details, clinical_notes,
        gyn_oncologist_name, reviewed_by, created_by, updated_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `;

    const newId = tx(ctx.db, () => {
      const res = ctx.db
        .prepare(insertSql)
        .run(
          d.patientId,
          d.admissionId ?? null,
          d.assessmentDate,
          d.clinicalIndication,
          d.menopausalStatus,
          d.ca125LevelUml ?? null,
          d.he4PmolL ?? null,
          d.romaScorePercent ?? null,
          d.lesionMaxDiameterMm ?? null,
          d.proportionSolidTissuePercent ?? null,
          d.papillaryProjectionsCount,
          d.acousticShadowsPresent ? 1 : 0,
          d.ascitesPresent ? 1 : 0,
          d.bilateralLesions ? 1 : 0,
          d.multilocularCysts ? 1 : 0,
          d.colorDopplerScore ?? null,
          iotaCategory,
          d.iotaPredictedMalignancyRiskPct ?? null,
          rmiScore,
          rmiRiskTier,
          d.endometrialThicknessMm ?? null,
          d.endometrialBiopsyDone ? 1 : 0,
          d.endometrialHistology ?? null,
          d.cervicalLesionVisible ? 1 : 0,
          d.figoClinicalStage ?? null,
          d.multidisciplinaryTumorBoardStatus,
          d.managementPlan ?? null,
          d.surgicalStagingDetails ?? null,
          d.clinicalNotes ?? null,
          d.gynOncologistName ?? null,
          reviewedBy,
          user.id,
          user.id,
          now,
          now,
        );

      const recordId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'gyn_oncology.assessment_create',
        entity: 'gyn_oncology_episodes',
        entityId: recordId,
        detail: {
          patientId: d.patientId,
          episodeId: recordId,
          assessmentDate: d.assessmentDate,
          clinicalIndication: d.clinicalIndication,
          rmiScore,
          rmiRiskTier,
          iotaCategory,
          tumorBoardStatus: d.multidisciplinaryTumorBoardStatus,
        },
      });

      return recordId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT g.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM gyn_oncology_episodes g
         LEFT JOIN users rev ON rev.id = g.reviewed_by
         LEFT JOIN users c ON c.id = g.created_by
         WHERE g.id = ?`,
      )
      .get(newId);

    return rowToGynOnc(created);
  });

  // 5. Update episode
  app.put<{ Params: { id: string } }>('/api/gyn-oncology/:id', async (req) => {
    const user = assertCanManageGynOnc(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing: any = ctx.db.prepare('SELECT * FROM gyn_oncology_episodes WHERE id = ?').get(id);
    if (!existing) throw notFound('Gynecological oncology assessment not found');

    const parsed = gynOncEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const d = parsed.data;
    if (d.patientId !== existing.patient_id) {
      throw badRequest('Patient ID cannot be changed');
    }

    if (d.admissionId) {
      const admission = ctx.db
        .prepare('SELECT id FROM admissions WHERE id = ? AND patient_id = ?')
        .get(d.admissionId, d.patientId);
      if (!admission) throw badRequest('Admission does not belong to this patient');
    }

    let rmiScore = d.rmiScore;
    let rmiRiskTier = d.rmiRiskTier;
    if (rmiScore === null || rmiScore === undefined || !rmiRiskTier) {
      const isPost = d.menopausalStatus === 'postmenopausal';
      const rmiCalc = calculateRmi1({
        ca125LevelUml: d.ca125LevelUml ?? 0,
        isPostmenopausal: isPost,
        multilocularCysts: d.multilocularCysts,
        solidAreasPresent: (d.proportionSolidTissuePercent ?? 0) > 0,
        bilateralLesions: d.bilateralLesions,
        ascitesPresent: d.ascitesPresent,
        metastasesPresent: false,
      });
      rmiScore = rmiCalc.rmiScore;
      rmiRiskTier = rmiCalc.riskTier;
    }

    let iotaCategory = d.iotaSimpleRulesCategory ?? existing.iota_simple_rules_category;

    const reviewedBy = d.reviewedBy ?? existing.reviewed_by;
    const reviewer = ctx.db.prepare('SELECT id FROM users WHERE id = ?').get(reviewedBy);
    if (!reviewer) throw badRequest('Reviewing clinician does not exist');

    const now = nowIso();

    const updateSql = `
      UPDATE gyn_oncology_episodes SET
        admission_id = ?,
        assessment_date = ?,
        clinical_indication = ?,
        menopausal_status = ?,
        ca125_level_u_ml = ?,
        he4_pmol_l = ?,
        roma_score_percent = ?,
        lesion_max_diameter_mm = ?,
        proportion_solid_tissue_percent = ?,
        papillary_projections_count = ?,
        acoustic_shadows_present = ?,
        ascites_present = ?,
        bilateral_lesions = ?,
        multilocular_cysts = ?,
        color_doppler_score = ?,
        iota_simple_rules_category = ?,
        iota_predicted_malignancy_risk_pct = ?,
        rmi_score = ?,
        rmi_risk_tier = ?,
        endometrial_thickness_mm = ?,
        endometrial_biopsy_done = ?,
        endometrial_histology = ?,
        cervical_lesion_visible = ?,
        figo_clinical_stage = ?,
        multidisciplinary_tumor_board_status = ?,
        management_plan = ?,
        surgical_staging_details = ?,
        clinical_notes = ?,
        gyn_oncologist_name = ?,
        reviewed_by = ?,
        updated_by = ?,
        updated_at = ?
      WHERE id = ?
    `;

    tx(ctx.db, () => {
      ctx.db
        .prepare(updateSql)
        .run(
          d.admissionId ?? null,
          d.assessmentDate,
          d.clinicalIndication,
          d.menopausalStatus,
          d.ca125LevelUml ?? null,
          d.he4PmolL ?? null,
          d.romaScorePercent ?? null,
          d.lesionMaxDiameterMm ?? null,
          d.proportionSolidTissuePercent ?? null,
          d.papillaryProjectionsCount,
          d.acousticShadowsPresent ? 1 : 0,
          d.ascitesPresent ? 1 : 0,
          d.bilateralLesions ? 1 : 0,
          d.multilocularCysts ? 1 : 0,
          d.colorDopplerScore ?? null,
          iotaCategory,
          d.iotaPredictedMalignancyRiskPct ?? null,
          rmiScore,
          rmiRiskTier,
          d.endometrialThicknessMm ?? null,
          d.endometrialBiopsyDone ? 1 : 0,
          d.endometrialHistology ?? null,
          d.cervicalLesionVisible ? 1 : 0,
          d.figoClinicalStage ?? null,
          d.multidisciplinaryTumorBoardStatus,
          d.managementPlan ?? null,
          d.surgicalStagingDetails ?? null,
          d.clinicalNotes ?? null,
          d.gynOncologistName ?? null,
          reviewedBy,
          user.id,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'gyn_oncology.assessment_update',
        entity: 'gyn_oncology_episodes',
        entityId: id,
        detail: {
          patientId: d.patientId,
          episodeId: id,
          assessmentDate: d.assessmentDate,
          clinicalIndication: d.clinicalIndication,
          rmiScore,
          rmiRiskTier,
          iotaCategory,
          tumorBoardStatus: d.multidisciplinaryTumorBoardStatus,
        },
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT g.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM gyn_oncology_episodes g
         LEFT JOIN users rev ON rev.id = g.reviewed_by
         LEFT JOIN users c ON c.id = g.created_by
         WHERE g.id = ?`,
      )
      .get(id);

    return rowToGynOnc(updated);
  });

  // 6. Delete episode
  app.delete<{ Params: { id: string } }>('/api/gyn-oncology/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only senior medical staff can delete gynecological oncology records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing: any = ctx.db.prepare('SELECT * FROM gyn_oncology_episodes WHERE id = ?').get(id);
    if (!existing) throw notFound('Gynecological oncology assessment not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM gyn_oncology_episodes WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'gyn_oncology.assessment_delete',
        entity: 'gyn_oncology_episodes',
        entityId: id,
        detail: {
          patientId: existing.patient_id,
          episodeId: id,
          assessmentDate: existing.assessment_date,
          clinicalIndication: existing.clinical_indication,
          rmiScore: existing.rmi_score,
        },
      });
    });

    return { ok: true, deletedId: id };
  });

  // 7. Audit print
  app.post<{ Params: { id: string } }>('/api/gyn-oncology/:id/audit-print', async (req) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const row: any = ctx.db.prepare('SELECT * FROM gyn_oncology_episodes WHERE id = ?').get(id);
    if (!row) throw notFound('Gynecological oncology assessment not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'gyn_oncology.assessment_print',
      entity: 'gyn_oncology_episodes',
      entityId: id,
      detail: {
        patientId: row.patient_id,
        episodeId: id,
        assessmentDate: row.assessment_date,
        clinicalIndication: row.clinical_indication,
        rmiScore: row.rmi_score,
      },
    });

    return { ok: true };
  });
}
