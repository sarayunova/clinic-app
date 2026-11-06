import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageRisk(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can record or edit antenatal risk assessments');
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

export const riskAssessmentSchema = z
  .object({
    assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    gestationalAgeWeeks: optNullableNumber(0, 44),
    gestationalAgeDays: optNullableNumber(0, 6),

    // Pre-eclampsia
    peFactors: z.array(z.string()).default([]),
    peRiskLevel: z.enum(['low', 'moderate', 'high']).default('low'),
    peAspirinIndicated: z.boolean().default(false),
    peAspirinPrescribed: z.boolean().default(false),
    peAspirinDosage: optNullableString(200),
    peCalciumIndicated: z.boolean().default(false),
    peCalciumPrescribed: z.boolean().default(false),

    // VTE
    vteFactors: z.array(z.string()).default([]),
    vteScore: z.number().int().min(0).max(50).default(0),
    vteRiskLevel: z.enum(['low', 'low_moderate', 'intermediate', 'high']).default('low'),
    vteProphylaxisRecommended: optNullableString(300),
    vteLmwhPrescribed: z.boolean().default(false),
    vteLmwhDosage: optNullableString(200),

    // GDM
    gdmFactors: z.array(z.string()).default([]),
    gdmRiskLevel: z.enum(['standard', 'high']).default('standard'),
    gdmScreeningTiming: optNullableString(200),
    gdmDiagnosisStatus: z.enum(['not_tested', 'pending', 'normal', 'gdm_confirmed']).default('not_tested'),
    gdmFastingMgdl: optNullableNumber(20, 500),
    gdm1hrMgdl: optNullableNumber(20, 500),
    gdm2hrMgdl: optNullableNumber(20, 500),
    gdmManagementPlan: optNullableString(500),

    // Preterm Birth
    ptbFactors: z.array(z.string()).default([]),
    ptbRiskLevel: z.enum(['low', 'high']).default('low'),
    ptbProgesteroneIndicated: z.boolean().default(false),
    ptbProgesteronePrescribed: z.boolean().default(false),
    ptbCerclageAdvised: z.boolean().default(false),

    // Overall
    overallRiskLevel: z.enum(['low_risk', 'moderate_risk', 'high_risk']).default('low_risk'),
    highRiskReasons: optNullableString(1000),
    clinicalActionPlan: optNullableString(2000),
    consultantNotes: optNullableString(1000),
    nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
  })
  .strict();

export const patchRiskAssessmentSchema = z
  .object({
    assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
    gestationalAgeWeeks: optNullableNumber(0, 44),
    gestationalAgeDays: optNullableNumber(0, 6),
    peFactors: z.array(z.string()).optional(),
    peRiskLevel: z.enum(['low', 'moderate', 'high']).optional(),
    peAspirinIndicated: z.boolean().optional(),
    peAspirinPrescribed: z.boolean().optional(),
    peAspirinDosage: optNullableString(200),
    peCalciumIndicated: z.boolean().optional(),
    peCalciumPrescribed: z.boolean().optional(),
    vteFactors: z.array(z.string()).optional(),
    vteScore: z.number().int().min(0).max(50).optional(),
    vteRiskLevel: z.enum(['low', 'low_moderate', 'intermediate', 'high']).optional(),
    vteProphylaxisRecommended: optNullableString(300),
    vteLmwhPrescribed: z.boolean().optional(),
    vteLmwhDosage: optNullableString(200),
    gdmFactors: z.array(z.string()).optional(),
    gdmRiskLevel: z.enum(['standard', 'high']).optional(),
    gdmScreeningTiming: optNullableString(200),
    gdmDiagnosisStatus: z.enum(['not_tested', 'pending', 'normal', 'gdm_confirmed']).optional(),
    gdmFastingMgdl: optNullableNumber(20, 500),
    gdm1hrMgdl: optNullableNumber(20, 500),
    gdm2hrMgdl: optNullableNumber(20, 500),
    gdmManagementPlan: optNullableString(500),
    ptbFactors: z.array(z.string()).optional(),
    ptbRiskLevel: z.enum(['low', 'high']).optional(),
    ptbProgesteroneIndicated: z.boolean().optional(),
    ptbProgesteronePrescribed: z.boolean().optional(),
    ptbCerclageAdvised: z.boolean().optional(),
    overallRiskLevel: z.enum(['low_risk', 'moderate_risk', 'high_risk']).optional(),
    highRiskReasons: optNullableString(1000),
    clinicalActionPlan: optNullableString(2000),
    consultantNotes: optNullableString(1000),
    nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
  })
  .strict();

type DbRiskRow = {
  id: number;
  patient_id: number;
  assessment_date: string;
  gestational_age_weeks: number | null;
  gestational_age_days: number | null;
  assessed_by: number;
  pe_factors_json: string;
  pe_risk_level: 'low' | 'moderate' | 'high';
  pe_aspirin_indicated: number;
  pe_aspirin_prescribed: number;
  pe_aspirin_dosage: string | null;
  pe_calcium_indicated: number;
  pe_calcium_prescribed: number;
  vte_factors_json: string;
  vte_score: number;
  vte_risk_level: 'low' | 'low_moderate' | 'intermediate' | 'high';
  vte_prophylaxis_recommended: string | null;
  vte_lmwh_prescribed: number;
  vte_lmwh_dosage: string | null;
  gdm_factors_json: string;
  gdm_risk_level: 'standard' | 'high';
  gdm_screening_timing: string | null;
  gdm_diagnosis_status: 'not_tested' | 'pending' | 'normal' | 'gdm_confirmed';
  gdm_fasting_mgdl: number | null;
  gdm_1hr_mgdl: number | null;
  gdm_2hr_mgdl: number | null;
  gdm_management_plan: string | null;
  ptb_factors_json: string;
  ptb_risk_level: 'low' | 'high';
  ptb_progesterone_indicated: number;
  ptb_progesterone_prescribed: number;
  ptb_cerclage_advised: number;
  overall_risk_level: 'low_risk' | 'moderate_risk' | 'high_risk';
  high_risk_reasons: string | null;
  clinical_action_plan: string | null;
  consultant_notes: string | null;
  next_review_date: string | null;
  created_at: string;
  updated_at: string;
  assessed_by_name?: string | null;
  patient_number?: string;
  patient_name?: string;
  date_of_birth?: string | null;
  patient_phone?: string | null;
  last_menstrual_period?: string | null;
  gravida?: number | null;
  para?: number | null;
};

function safeJsonArray(str: string): string[] {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRow(r: DbRiskRow) {
  return {
    id: r.id,
    patientId: r.patient_id,
    assessmentDate: r.assessment_date,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    assessedBy: r.assessed_by,
    assessedByName: r.assessed_by_name ?? null,
    peFactors: safeJsonArray(r.pe_factors_json),
    peRiskLevel: r.pe_risk_level,
    peAspirinIndicated: r.pe_aspirin_indicated === 1,
    peAspirinPrescribed: r.pe_aspirin_prescribed === 1,
    peAspirinDosage: r.pe_aspirin_dosage,
    peCalciumIndicated: r.pe_calcium_indicated === 1,
    peCalciumPrescribed: r.pe_calcium_prescribed === 1,
    vteFactors: safeJsonArray(r.vte_factors_json),
    vteScore: r.vte_score,
    vteRiskLevel: r.vte_risk_level,
    vteProphylaxisRecommended: r.vte_prophylaxis_recommended,
    vteLmwhPrescribed: r.vte_lmwh_prescribed === 1,
    vteLmwhDosage: r.vte_lmwh_dosage,
    gdmFactors: safeJsonArray(r.gdm_factors_json),
    gdmRiskLevel: r.gdm_risk_level,
    gdmScreeningTiming: r.gdm_screening_timing,
    gdmDiagnosisStatus: r.gdm_diagnosis_status,
    gdmFastingMgdl: r.gdm_fasting_mgdl,
    gdm1hrMgdl: r.gdm_1hr_mgdl,
    gdm2hrMgdl: r.gdm_2hr_mgdl,
    gdmManagementPlan: r.gdm_management_plan,
    ptbFactors: safeJsonArray(r.ptb_factors_json),
    ptbRiskLevel: r.ptb_risk_level,
    ptbProgesteroneIndicated: r.ptb_progesterone_indicated === 1,
    ptbProgesteronePrescribed: r.ptb_progesterone_prescribed === 1,
    ptbCerclageAdvised: r.ptb_cerclage_advised === 1,
    overallRiskLevel: r.overall_risk_level,
    highRiskReasons: r.high_risk_reasons,
    clinicalActionPlan: r.clinical_action_plan,
    consultantNotes: r.consultant_notes,
    nextReviewDate: r.next_review_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patientNumber: r.patient_number,
    patientName: r.patient_name,
    dateOfBirth: r.date_of_birth,
    patientPhone: r.patient_phone,
    lastMenstrualPeriod: r.last_menstrual_period,
    gravida: r.gravida,
    para: r.para,
  };
}

export function registerRiskAssessmentRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/patients/:id/risk-assessments
  app.get('/api/patients/:id/risk-assessments', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT r.*,
                u.full_name AS assessed_by_name
         FROM antenatal_risk_assessments r
         LEFT JOIN users u ON u.id = r.assessed_by
         WHERE r.patient_id = ?
         ORDER BY r.assessment_date DESC, r.id DESC`
      )
      .all(patientId) as DbRiskRow[];

    return {
      patientId,
      assessments: rows.map(mapRow),
    };
  });

  // GET /api/risk-assessments/:id
  app.get('/api/risk-assessments/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid assessment ID');

    const row = db
      .prepare(
        `SELECT r.*,
                u.full_name AS assessed_by_name,
                p.patient_number,
                p.full_name AS patient_name,
                p.date_of_birth,
                p.phone AS patient_phone,
                p.last_menstrual_period,
                p.gravida,
                p.para
         FROM antenatal_risk_assessments r
         JOIN patients p ON p.id = r.patient_id
         LEFT JOIN users u ON u.id = r.assessed_by
         WHERE r.id = ?`
      )
      .get(id) as DbRiskRow | undefined;

    if (!row) throw notFound('Risk assessment not found');
    return mapRow(row);
  });

  // POST /api/patients/:id/risk-assessments
  app.post('/api/patients/:id/risk-assessments', async (req, reply) => {
    const user = assertCanManageRisk(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(riskAssessmentSchema, req.body);
    const now = nowIso();

    const stmt = db.prepare(`
      INSERT INTO antenatal_risk_assessments (
        patient_id, assessment_date, gestational_age_weeks, gestational_age_days, assessed_by,
        pe_factors_json, pe_risk_level, pe_aspirin_indicated, pe_aspirin_prescribed, pe_aspirin_dosage,
        pe_calcium_indicated, pe_calcium_prescribed,
        vte_factors_json, vte_score, vte_risk_level, vte_prophylaxis_recommended, vte_lmwh_prescribed, vte_lmwh_dosage,
        gdm_factors_json, gdm_risk_level, gdm_screening_timing, gdm_diagnosis_status, gdm_fasting_mgdl, gdm_1hr_mgdl, gdm_2hr_mgdl, gdm_management_plan,
        ptb_factors_json, ptb_risk_level, ptb_progesterone_indicated, ptb_progesterone_prescribed, ptb_cerclage_advised,
        overall_risk_level, high_risk_reasons, clinical_action_plan, consultant_notes, next_review_date,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    const result = stmt.run(
      patientId,
      b.assessmentDate,
      b.gestationalAgeWeeks ?? null,
      b.gestationalAgeDays ?? null,
      user.id,
      JSON.stringify(b.peFactors),
      b.peRiskLevel,
      b.peAspirinIndicated ? 1 : 0,
      b.peAspirinPrescribed ? 1 : 0,
      b.peAspirinDosage ?? null,
      b.peCalciumIndicated ? 1 : 0,
      b.peCalciumPrescribed ? 1 : 0,
      JSON.stringify(b.vteFactors),
      b.vteScore,
      b.vteRiskLevel,
      b.vteProphylaxisRecommended ?? null,
      b.vteLmwhPrescribed ? 1 : 0,
      b.vteLmwhDosage ?? null,
      JSON.stringify(b.gdmFactors),
      b.gdmRiskLevel,
      b.gdmScreeningTiming ?? null,
      b.gdmDiagnosisStatus,
      b.gdmFastingMgdl ?? null,
      b.gdm1hrMgdl ?? null,
      b.gdm2hrMgdl ?? null,
      b.gdmManagementPlan ?? null,
      JSON.stringify(b.ptbFactors),
      b.ptbRiskLevel,
      b.ptbProgesteroneIndicated ? 1 : 0,
      b.ptbProgesteronePrescribed ? 1 : 0,
      b.ptbCerclageAdvised ? 1 : 0,
      b.overallRiskLevel,
      b.highRiskReasons ?? null,
      b.clinicalActionPlan ?? null,
      b.consultantNotes ?? null,
      b.nextReviewDate ?? null,
      now,
      now
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'risk_assessment.create',
      entity: 'patient',
      entityId: patientId,
      detail: {
        assessmentId: newId,
        overallRiskLevel: b.overallRiskLevel,
        peRiskLevel: b.peRiskLevel,
        vteScore: b.vteScore,
        aspirinIndicated: b.peAspirinIndicated,
      },
    });

    const created = db.prepare('SELECT * FROM antenatal_risk_assessments WHERE id = ?').get(newId) as DbRiskRow;
    return reply.status(201).send(mapRow(created));
  });

  // PATCH /api/risk-assessments/:id
  app.patch('/api/risk-assessments/:id', async (req) => {
    const user = assertCanManageRisk(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid assessment ID');

    const existing = db.prepare('SELECT * FROM antenatal_risk_assessments WHERE id = ?').get(id) as DbRiskRow | undefined;
    if (!existing) throw notFound('Risk assessment not found');

    const b = parse(patchRiskAssessmentSchema, req.body);
    const now = nowIso();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const mappings: Record<string, string> = {
      assessmentDate: 'assessment_date',
      gestationalAgeWeeks: 'gestational_age_weeks',
      gestationalAgeDays: 'gestational_age_days',
      peRiskLevel: 'pe_risk_level',
      peAspirinDosage: 'pe_aspirin_dosage',
      vteScore: 'vte_score',
      vteRiskLevel: 'vte_risk_level',
      vteProphylaxisRecommended: 'vte_prophylaxis_recommended',
      vteLmwhDosage: 'vte_lmwh_dosage',
      gdmRiskLevel: 'gdm_risk_level',
      gdmScreeningTiming: 'gdm_screening_timing',
      gdmDiagnosisStatus: 'gdm_diagnosis_status',
      gdmFastingMgdl: 'gdm_fasting_mgdl',
      gdm1hrMgdl: 'gdm_1hr_mgdl',
      gdm2hrMgdl: 'gdm_2hr_mgdl',
      gdmManagementPlan: 'gdm_management_plan',
      ptbRiskLevel: 'ptb_risk_level',
      overallRiskLevel: 'overall_risk_level',
      highRiskReasons: 'high_risk_reasons',
      clinicalActionPlan: 'clinical_action_plan',
      consultantNotes: 'consultant_notes',
      nextReviewDate: 'next_review_date',
    };

    for (const [k, col] of Object.entries(mappings)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as any)[k] ?? null);
      }
    }

    // Boolean fields mapped to 1/0
    const boolMappings: Record<string, string> = {
      peAspirinIndicated: 'pe_aspirin_indicated',
      peAspirinPrescribed: 'pe_aspirin_prescribed',
      peCalciumIndicated: 'pe_calcium_indicated',
      peCalciumPrescribed: 'pe_calcium_prescribed',
      vteLmwhPrescribed: 'vte_lmwh_prescribed',
      ptbProgesteroneIndicated: 'ptb_progesterone_indicated',
      ptbProgesteronePrescribed: 'ptb_progesterone_prescribed',
      ptbCerclageAdvised: 'ptb_cerclage_advised',
    };

    for (const [k, col] of Object.entries(boolMappings)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as any)[k] ? 1 : 0);
      }
    }

    // Array JSON fields
    if ('peFactors' in b) {
      fields.push('pe_factors_json = ?');
      values.push(JSON.stringify(b.peFactors));
    }
    if ('vteFactors' in b) {
      fields.push('vte_factors_json = ?');
      values.push(JSON.stringify(b.vteFactors));
    }
    if ('gdmFactors' in b) {
      fields.push('gdm_factors_json = ?');
      values.push(JSON.stringify(b.gdmFactors));
    }
    if ('ptbFactors' in b) {
      fields.push('ptb_factors_json = ?');
      values.push(JSON.stringify(b.ptbFactors));
    }

    if (fields.length === 0) throw badRequest('No fields to update');

    fields.push('updated_at = ?');
    values.push(now, id);

    db.prepare(`UPDATE antenatal_risk_assessments SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit(db, {
      actorId: user.id,
      action: 'risk_assessment.update',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        assessmentId: id,
        updatedFields: Object.keys(b),
      },
    });

    const updated = db.prepare('SELECT * FROM antenatal_risk_assessments WHERE id = ?').get(id) as DbRiskRow;
    return mapRow(updated);
  });

  // DELETE /api/risk-assessments/:id
  app.delete('/api/risk-assessments/:id', async (req) => {
    const user = assertCanManageRisk(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid assessment ID');

    const existing = db.prepare('SELECT * FROM antenatal_risk_assessments WHERE id = ?').get(id) as DbRiskRow | undefined;
    if (!existing) throw notFound('Risk assessment not found');

    db.prepare('DELETE FROM antenatal_risk_assessments WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'risk_assessment.delete',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        assessmentId: id,
        overallRiskLevel: existing.overall_risk_level,
      },
    });

    return { ok: true };
  });

  // GET /api/patients/:id/risk-summary
  app.get('/api/patients/:id/risk-summary', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const latest = db
      .prepare(
        `SELECT r.*,
                u.full_name AS assessed_by_name
         FROM antenatal_risk_assessments r
         LEFT JOIN users u ON u.id = r.assessed_by
         WHERE r.patient_id = ?
         ORDER BY r.assessment_date DESC, r.id DESC
         LIMIT 1`
      )
      .get(patientId) as DbRiskRow | undefined;

    if (!latest) {
      return {
        patientId,
        hasAssessment: false,
        isHighRisk: false,
        overallRiskLevel: 'not_assessed',
        activeAlerts: [],
        prophylaxisPrescribed: [],
        latestAssessment: null,
      };
    }

    const mapped = mapRow(latest);
    const activeAlerts: string[] = [];
    const prophylaxisPrescribed: string[] = [];

    if (mapped.peRiskLevel === 'high') {
      activeAlerts.push('High Pre-eclampsia Risk');
      if (mapped.peAspirinPrescribed) prophylaxisPrescribed.push('Aspirin 150mg prescribed');
      else if (mapped.peAspirinIndicated) activeAlerts.push('Aspirin indicated (not recorded as prescribed)');
    }

    if (mapped.vteScore >= 3 || mapped.vteRiskLevel === 'high' || mapped.vteRiskLevel === 'intermediate') {
      activeAlerts.push(`VTE Prophylaxis Required (Score: ${mapped.vteScore})`);
      if (mapped.vteLmwhPrescribed) prophylaxisPrescribed.push('LMWH thromboprophylaxis prescribed');
    }

    if (mapped.gdmDiagnosisStatus === 'gdm_confirmed') {
      activeAlerts.push('Gestational Diabetes Mellitus (GDM)');
    } else if (mapped.gdmRiskLevel === 'high' && mapped.gdmDiagnosisStatus === 'not_tested') {
      activeAlerts.push('Early GDM Screening Indicated');
    }

    if (mapped.ptbRiskLevel === 'high') {
      activeAlerts.push('High Risk of Preterm Birth');
      if (mapped.ptbProgesteronePrescribed) prophylaxisPrescribed.push('Vaginal Progesterone prescribed');
    }

    const isHighRisk = mapped.overallRiskLevel === 'high_risk' || activeAlerts.length > 0;

    return {
      patientId,
      hasAssessment: true,
      isHighRisk,
      overallRiskLevel: mapped.overallRiskLevel,
      activeAlerts,
      prophylaxisPrescribed,
      latestAssessment: mapped,
    };
  });
}
