import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import {
  calculateReedaScore,
  calculatePostOpHours,
} from '../../web/src/erasReedaEngine.js';

// Schemas
const createErasPathwaySchema = z.object({
  admissionId: z.number().int().positive().nullable().optional(),
  operativeNoteId: z.number().int().positive().nullable().optional(),
  surgeryDatetime: z.string().min(10, 'Surgery datetime is required'),
  surgeryType: z.enum([
    'elective_lscs',
    'emergency_lscs',
    'laparotomy',
    'myomectomy',
    'other_gynecologic_surgery',
  ]).default('elective_lscs'),
  incisionType: z.enum(['pfannenstiel', 'joel_cohen', 'midline_vertical', 'other']).default('pfannenstiel'),
  skinClosureType: z.enum([
    'subcuticular_monocryl',
    'staples',
    'interrupted_mattress',
    'dermabond_glue',
  ]).default('subcuticular_monocryl'),
  oralFluidsAchievedHours: z.number().min(0).max(168).nullable().optional(),
  regularDietAchievedHours: z.number().min(0).max(168).nullable().optional(),
  catheterRemovedHours: z.number().min(0).max(168).nullable().optional(),
  firstMobilizationHours: z.number().min(0).max(168).nullable().optional(),
  multimodalAnalgesiaAdherent: z.boolean().default(true),
  dvtProphylaxisApplied: z.enum([
    'early_mobilization_ted',
    'scd_mechanical',
    'lmwh_pharmacological',
    'none',
  ]).default('early_mobilization_ted'),
  status: z.enum(['active', 'discharge_ready', 'discharged', 'escalated_complication']).default('active'),
  clinicalNotes: z.string().trim().max(2000).nullable().optional(),
}).strict();

const patchErasPathwaySchema = z.object({
  oralFluidsAchievedHours: z.number().min(0).max(168).nullable().optional(),
  regularDietAchievedHours: z.number().min(0).max(168).nullable().optional(),
  catheterRemovedHours: z.number().min(0).max(168).nullable().optional(),
  firstMobilizationHours: z.number().min(0).max(168).nullable().optional(),
  multimodalAnalgesiaAdherent: z.boolean().optional(),
  dvtProphylaxisApplied: z.enum([
    'early_mobilization_ted',
    'scd_mechanical',
    'lmwh_pharmacological',
    'none',
  ]).optional(),
  status: z.enum(['active', 'discharge_ready', 'discharged', 'escalated_complication']).optional(),
  clinicalNotes: z.string().trim().max(2000).nullable().optional(),
}).strict();

const createReedaAssessmentSchema = z.object({
  assessmentDatetime: z.string().min(10, 'Assessment datetime required'),
  postOpDay: z.number().int().min(0).max(30).optional(),
  rednessScore: z.number().int().min(0).max(3),
  edemaScore: z.number().int().min(0).max(3),
  ecchymosisScore: z.number().int().min(0).max(3),
  dischargeScore: z.number().int().min(0).max(3),
  approximationScore: z.number().int().min(0).max(3),
  painScore10: z.number().int().min(0).max(10).nullable().optional(),
  dressingCondition: z.enum(['dry_intact', 'soaked', 'removed_clean', 'reinforcement_needed']).default('dry_intact'),
  actionPlan: z.string().trim().max(1000).nullable().optional(),
  assessorNotes: z.string().trim().max(1000).nullable().optional(),
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

type DbPathwayRow = {
  id: number;
  patient_id: number;
  admission_id: number | null;
  operative_note_id: number | null;
  surgery_datetime: string;
  surgery_type: string;
  incision_type: string;
  skin_closure_type: string;
  oral_fluids_achieved_hours: number | null;
  regular_diet_achieved_hours: number | null;
  catheter_removed_hours: number | null;
  first_mobilization_hours: number | null;
  multimodal_analgesia_adherent: number;
  dvt_prophylaxis_applied: string;
  status: string;
  clinical_notes: string | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  patient_name?: string;
  patient_number?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
};

type DbReedaRow = {
  id: number;
  pathway_id: number;
  patient_id: number;
  assessment_datetime: string;
  post_op_day: number;
  redness_score: number;
  edema_score: number;
  ecchymosis_score: number;
  discharge_score: number;
  approximation_score: number;
  total_reeda_score: number;
  pain_score_10: number | null;
  dressing_condition: string;
  healing_category: string;
  action_plan: string | null;
  assessor_notes: string | null;
  created_by: number;
  created_at: string;
  created_by_name?: string | null;
};

function mapReedaRow(r: DbReedaRow) {
  return {
    id: r.id,
    pathwayId: r.pathway_id,
    patientId: r.patient_id,
    assessmentDatetime: r.assessment_datetime,
    postOpDay: r.post_op_day,
    rednessScore: r.redness_score,
    edemaScore: r.edema_score,
    ecchymosisScore: r.ecchymosis_score,
    dischargeScore: r.discharge_score,
    approximationScore: r.approximation_score,
    totalReedaScore: r.total_reeda_score,
    painScore10: r.pain_score_10,
    dressingCondition: r.dressing_condition,
    healingCategory: r.healing_category,
    actionPlan: r.action_plan,
    assessorNotes: r.assessor_notes,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    createdAt: r.created_at,
  };
}

function mapPathwayRow(r: DbPathwayRow, assessments: DbReedaRow[] = []) {
  const mappedAssessments = assessments.map(mapReedaRow);
  const latestAssessment = mappedAssessments.length > 0 ? mappedAssessments[mappedAssessments.length - 1] : null;

  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name ?? null,
    patientNumber: r.patient_number ?? null,
    admissionId: r.admission_id,
    operativeNoteId: r.operative_note_id,
    surgeryDatetime: r.surgery_datetime,
    surgeryType: r.surgery_type,
    incisionType: r.incision_type,
    skinClosureType: r.skin_closure_type,
    oralFluidsAchievedHours: r.oral_fluids_achieved_hours,
    regularDietAchievedHours: r.regular_diet_achieved_hours,
    catheterRemovedHours: r.catheter_removed_hours,
    firstMobilizationHours: r.first_mobilization_hours,
    multimodalAnalgesiaAdherent: Boolean(r.multimodal_analgesia_adherent),
    dvtProphylaxisApplied: r.dvt_prophylaxis_applied,
    status: r.status,
    clinicalNotes: r.clinical_notes,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    assessmentsCount: mappedAssessments.length,
    assessments: mappedAssessments,
    latestAssessment,
  };
}

export function registerErasReedaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // GET /api/patients/:id/eras-pathways
  app.get('/api/patients/:id/eras-pathways', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const pathways = db
      .prepare(
        `SELECT p.*,
                pat.full_name AS patient_name,
                pat.patient_number,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name
         FROM eras_post_op_pathways p
         JOIN patients pat ON pat.id = p.patient_id
         LEFT JOIN users cu ON cu.id = p.created_by
         LEFT JOIN users uu ON uu.id = p.updated_by
         WHERE p.patient_id = ?
         ORDER BY p.surgery_datetime DESC, p.id DESC`
      )
      .all(patientId) as DbPathwayRow[];

    const result = [];
    for (const pw of pathways) {
      const assessments = db
        .prepare(
          `SELECT a.*, cu.full_name AS created_by_name
           FROM reeda_wound_assessments a
           LEFT JOIN users cu ON cu.id = a.created_by
           WHERE a.pathway_id = ?
           ORDER BY a.post_op_day ASC, a.assessment_datetime ASC`
        )
        .all(pw.id) as DbReedaRow[];
      result.push(mapPathwayRow(pw, assessments));
    }

    return { patientId, pathways: result };
  });

  // POST /api/patients/:id/eras-pathways
  app.post('/api/patients/:id/eras-pathways', async (req, reply) => {
    const user = assertCanManage(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(createErasPathwaySchema, req.body);
    const now = nowIso();

    const stmt = db.prepare(`
      INSERT INTO eras_post_op_pathways (
        patient_id, admission_id, operative_note_id, surgery_datetime, surgery_type,
        incision_type, skin_closure_type, oral_fluids_achieved_hours, regular_diet_achieved_hours,
        catheter_removed_hours, first_mobilization_hours, multimodal_analgesia_adherent,
        dvt_prophylaxis_applied, status, clinical_notes, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      patientId,
      b.admissionId ?? null,
      b.operativeNoteId ?? null,
      b.surgeryDatetime,
      b.surgeryType,
      b.incisionType,
      b.skinClosureType,
      b.oralFluidsAchievedHours ?? null,
      b.regularDietAchievedHours ?? null,
      b.catheterRemovedHours ?? null,
      b.firstMobilizationHours ?? null,
      b.multimodalAnalgesiaAdherent ? 1 : 0,
      b.dvtProphylaxisApplied,
      b.status,
      b.clinicalNotes ?? null,
      user.id,
      user.id,
      now,
      now
    );

    const pathwayId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'eras_pathway.create',
      entity: 'patient',
      entityId: patientId,
      detail: { pathwayId, surgeryType: b.surgeryType, surgeryDatetime: b.surgeryDatetime },
    });

    const created = db.prepare('SELECT * FROM eras_post_op_pathways WHERE id = ?').get(pathwayId) as DbPathwayRow;
    return reply.status(201).send(mapPathwayRow(created, []));
  });

  // GET /api/eras-pathways/:pathwayId
  app.get('/api/eras-pathways/:pathwayId', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const pathwayId = Number((req.params as { pathwayId: string }).pathwayId);
    if (!Number.isInteger(pathwayId) || pathwayId <= 0) throw badRequest('Invalid pathway ID');

    const pathway = db
      .prepare(
        `SELECT p.*,
                pat.full_name AS patient_name,
                pat.patient_number,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name
         FROM eras_post_op_pathways p
         JOIN patients pat ON pat.id = p.patient_id
         LEFT JOIN users cu ON cu.id = p.created_by
         LEFT JOIN users uu ON uu.id = p.updated_by
         WHERE p.id = ?`
      )
      .get(pathwayId) as DbPathwayRow | undefined;

    if (!pathway) throw notFound('ERAS Pathway not found');

    const assessments = db
      .prepare(
        `SELECT a.*, cu.full_name AS created_by_name
         FROM reeda_wound_assessments a
         LEFT JOIN users cu ON cu.id = a.created_by
         WHERE a.pathway_id = ?
         ORDER BY a.post_op_day ASC, a.assessment_datetime ASC`
      )
      .all(pathwayId) as DbReedaRow[];

    return mapPathwayRow(pathway, assessments);
  });

  // PATCH /api/eras-pathways/:pathwayId
  app.patch('/api/eras-pathways/:pathwayId', async (req) => {
    const user = assertCanManage(req);
    const pathwayId = Number((req.params as { pathwayId: string }).pathwayId);
    if (!Number.isInteger(pathwayId) || pathwayId <= 0) throw badRequest('Invalid pathway ID');

    const existing = db.prepare('SELECT * FROM eras_post_op_pathways WHERE id = ?').get(pathwayId) as DbPathwayRow | undefined;
    if (!existing) throw notFound('ERAS Pathway not found');

    const b = parse(patchErasPathwaySchema, req.body);
    const now = nowIso();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const fieldMap: Record<string, string> = {
      oralFluidsAchievedHours: 'oral_fluids_achieved_hours',
      regularDietAchievedHours: 'regular_diet_achieved_hours',
      catheterRemovedHours: 'catheter_removed_hours',
      firstMobilizationHours: 'first_mobilization_hours',
      dvtProphylaxisApplied: 'dvt_prophylaxis_applied',
      status: 'status',
      clinicalNotes: 'clinical_notes',
    };

    for (const [k, col] of Object.entries(fieldMap)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as Record<string, any>)[k] ?? null);
      }
    }

    if ('multimodalAnalgesiaAdherent' in b) {
      fields.push('multimodal_analgesia_adherent = ?');
      values.push(b.multimodalAnalgesiaAdherent ? 1 : 0);
    }

    if (fields.length === 0) throw badRequest('No fields to update');

    fields.push('updated_by = ?', 'updated_at = ?');
    values.push(user.id, now, pathwayId);

    db.prepare(`UPDATE eras_post_op_pathways SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit(db, {
      actorId: user.id,
      action: 'eras_pathway.update',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: { pathwayId, updatedFields: Object.keys(b) },
    });

    const updated = db.prepare('SELECT * FROM eras_post_op_pathways WHERE id = ?').get(pathwayId) as DbPathwayRow;
    const assessments = db.prepare('SELECT a.*, cu.full_name AS created_by_name FROM reeda_wound_assessments a LEFT JOIN users cu ON cu.id = a.created_by WHERE a.pathway_id = ? ORDER BY a.post_op_day ASC, a.assessment_datetime ASC').all(pathwayId) as DbReedaRow[];
    return mapPathwayRow(updated, assessments);
  });

  // POST /api/eras-pathways/:pathwayId/reeda-assessments
  app.post('/api/eras-pathways/:pathwayId/reeda-assessments', async (req, reply) => {
    const user = assertCanManage(req);
    const pathwayId = Number((req.params as { pathwayId: string }).pathwayId);
    if (!Number.isInteger(pathwayId) || pathwayId <= 0) throw badRequest('Invalid pathway ID');

    const pathway = db.prepare('SELECT * FROM eras_post_op_pathways WHERE id = ?').get(pathwayId) as DbPathwayRow | undefined;
    if (!pathway) throw notFound('ERAS Pathway not found');

    const b = parse(createReedaAssessmentSchema, req.body);
    const now = nowIso();

    // Determine Post-Op Day
    let postOpDay = b.postOpDay;
    if (postOpDay == null || postOpDay < 0) {
      const elapsedHours = calculatePostOpHours(pathway.surgery_datetime, b.assessmentDatetime);
      postOpDay = Math.max(0, Math.floor(elapsedHours / 24));
    }

    // Evaluate REEDA scoring
    const evalResult = calculateReedaScore({
      redness: b.rednessScore,
      edema: b.edemaScore,
      ecchymosis: b.ecchymosisScore,
      discharge: b.dischargeScore,
      approximation: b.approximationScore,
    });

    const stmt = db.prepare(`
      INSERT INTO reeda_wound_assessments (
        pathway_id, patient_id, assessment_datetime, post_op_day, redness_score,
        edema_score, ecchymosis_score, discharge_score, approximation_score,
        total_reeda_score, pain_score_10, dressing_condition, healing_category,
        action_plan, assessor_notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      pathwayId,
      pathway.patient_id,
      b.assessmentDatetime,
      postOpDay,
      b.rednessScore,
      b.edemaScore,
      b.ecchymosisScore,
      b.dischargeScore,
      b.approximationScore,
      evalResult.totalScore,
      b.painScore10 ?? null,
      b.dressingCondition,
      evalResult.category,
      b.actionPlan ?? evalResult.recommendations.join('; '),
      b.assessorNotes ?? null,
      user.id,
      now
    );

    const assessmentId = Number(result.lastInsertRowid);

    // If severe complication / dehiscence, escalate pathway status
    if (evalResult.category === 'severe_complication_dehiscence' && pathway.status === 'active') {
      db.prepare('UPDATE eras_post_op_pathways SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
        'escalated_complication',
        user.id,
        now,
        pathwayId
      );
    }

    audit(db, {
      actorId: user.id,
      action: 'eras_pathway.log_reeda_assessment',
      entity: 'patient',
      entityId: pathway.patient_id,
      detail: {
        pathwayId,
        assessmentId,
        postOpDay,
        totalScore: evalResult.totalScore,
        category: evalResult.category,
      },
    });

    const created = db
      .prepare('SELECT a.*, cu.full_name AS created_by_name FROM reeda_wound_assessments a LEFT JOIN users cu ON cu.id = a.created_by WHERE a.id = ?')
      .get(assessmentId) as DbReedaRow;

    return reply.status(201).send(mapReedaRow(created));
  });

  // DELETE /api/reeda-assessments/:assessmentId
  app.delete('/api/reeda-assessments/:assessmentId', async (req) => {
    const user = assertCanManage(req);
    const assessmentId = Number((req.params as { assessmentId: string }).assessmentId);
    if (!Number.isInteger(assessmentId) || assessmentId <= 0) throw badRequest('Invalid assessment ID');

    const assessment = db.prepare('SELECT * FROM reeda_wound_assessments WHERE id = ?').get(assessmentId) as DbReedaRow | undefined;
    if (!assessment) throw notFound('REEDA assessment not found');

    db.prepare('DELETE FROM reeda_wound_assessments WHERE id = ?').run(assessmentId);

    audit(db, {
      actorId: user.id,
      action: 'eras_pathway.delete_reeda_assessment',
      entity: 'patient',
      entityId: assessment.patient_id,
      detail: { pathwayId: assessment.pathway_id, assessmentId },
    });

    return { ok: true };
  });
}
