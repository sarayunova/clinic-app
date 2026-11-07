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
  evaluateEndometriosis,
  type RasrmScoreInput,
  type EnzianInput,
  type VasPainScores,
} from '../../web/src/endometriosisEngine.js';

function assertCanManageEndometriosis(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage endometriosis staging records');
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

export const endometriosisCalculateSchema = z.object({
  peritonealSuperficialPts: z.number().int().min(0).max(50).default(0),
  peritonealDeepPts: z.number().int().min(0).max(50).default(0),
  ovaryRightSuperficialPts: z.number().int().min(0).max(50).default(0),
  ovaryRightDeepPts: z.number().int().min(0).max(50).default(0),
  ovaryLeftSuperficialPts: z.number().int().min(0).max(50).default(0),
  ovaryLeftDeepPts: z.number().int().min(0).max(50).default(0),
  adhesionsOvaryRightPts: z.number().int().min(0).max(50).default(0),
  adhesionsOvaryLeftPts: z.number().int().min(0).max(50).default(0),
  adhesionsTubeRightPts: z.number().int().min(0).max(50).default(0),
  adhesionsTubeLeftPts: z.number().int().min(0).max(50).default(0),
  pouchOfDouglasObliteration: z.enum(['none', 'partial_4pts', 'complete_40pts']).default('none'),

  peritoneum: optNullableString(50),
  ovaryRight: optNullableString(50),
  ovaryLeft: optNullableString(50),
  tubeRight: optNullableString(50),
  tubeLeft: optNullableString(50),
  compartmentA: optNullableString(50),
  compartmentB: optNullableString(50),
  compartmentC: optNullableString(50),
  extragenitalF: optNullableString(50),
  adenomyosisFa: z.boolean().default(false),

  vasDysmenorrhea: z.number().int().min(0).max(10).default(0),
  vasDyspareunia: z.number().int().min(0).max(10).default(0),
  vasDyschezia: z.number().int().min(0).max(10).default(0),
  vasDysuria: z.number().int().min(0).max(10).default(0),
  vasChronicPelvicPain: z.number().int().min(0).max(10).default(0),
});

export const endometriosisEpisodeSchema = endometriosisCalculateSchema.extend({
  patientId: z.number().int().positive('Valid patient ID required'),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDate: z.string().regex(dateRegex, 'Assessment date must be YYYY-MM-DD'),
  assessmentType: z.enum(['clinical_and_imaging', 'laparoscopic_surgical', 'post_operative_followup']),

  medicalManagementRegimen: optNullableString(1000),
  surgicalProcedurePerformed: optNullableString(1000),
  fertilitySparing: z.boolean().default(true),
  postOpHormonalSuppression: optNullableString(1000),
  clinicalNotes: optNullableString(4000),

  leadSurgeon: optNullableString(120),
  reviewedBy: z.number().int().positive('Valid reviewer ID required'),
});

function rowToEndometriosis(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    assessmentDate: r.assessment_date,
    assessmentType: r.assessment_type,

    vasDysmenorrhea: r.vas_dysmenorrhea,
    vasDyspareunia: r.vas_dyspareunia,
    vasDyschezia: r.vas_dyschezia,
    vasDysuria: r.vas_dysuria,
    vasChronicPelvicPain: r.vas_chronic_pelvic_pain,

    rasrmPeritonealSuperficialPts: r.rasrm_peritoneal_superficial_pts,
    rasrmPeritonealDeepPts: r.rasrm_peritoneal_deep_pts,
    rasrmOvaryRightSuperficialPts: r.rasrm_ovary_right_superficial_pts,
    rasrmOvaryRightDeepPts: r.rasrm_ovary_right_deep_pts,
    rasrmOvaryLeftSuperficialPts: r.rasrm_ovary_left_superficial_pts,
    rasrmOvaryLeftDeepPts: r.rasrm_ovary_left_deep_pts,
    rasrmAdhesionsOvaryRightPts: r.rasrm_adhesions_ovary_right_pts,
    rasrmAdhesionsOvaryLeftPts: r.rasrm_adhesions_ovary_left_pts,
    rasrmAdhesionsTubeRightPts: r.rasrm_adhesions_tube_right_pts,
    rasrmAdhesionsTubeLeftPts: r.rasrm_adhesions_tube_left_pts,
    pouchOfDouglasObliteration: r.rasrm_pouch_of_douglas_obliteration,
    rasrmTotalScore: r.rasrm_total_score,
    rasrmStage: r.rasrm_stage,

    enzianPeritoneum: r.enzian_peritoneum,
    enzianOvaryLeft: r.enzian_ovary_left,
    enzianOvaryRight: r.enzian_ovary_right,
    enzianTubeLeft: r.enzian_tube_left,
    enzianTubeRight: r.enzian_tube_right,
    enzianCompartmentA: r.enzian_compartment_a,
    enzianCompartmentB: r.enzian_compartment_b,
    enzianCompartmentC: r.enzian_compartment_c,
    enzianExtragenitalF: r.enzian_extragenital_f,
    enzianAdenomyosisFa: Boolean(r.enzian_adenomyosis_fa),
    enzianCompositeCode: r.enzian_composite_code,

    medicalManagementRegimen: r.medical_management_regimen,
    surgicalProcedurePerformed: r.surgical_procedure_performed,
    fertilitySparing: Boolean(r.fertility_sparing),
    postOpHormonalSuppression: r.post_op_hormonal_suppression,
    clinicalNotes: r.clinical_notes,

    leadSurgeon: r.lead_surgeon,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerEndometriosisRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Live Staging Preview
  app.post('/api/endometriosis/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = endometriosisCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;

    const rasrmInput: RasrmScoreInput = {
      peritonealSuperficialPts: d.peritonealSuperficialPts,
      peritonealDeepPts: d.peritonealDeepPts,
      ovaryRightSuperficialPts: d.ovaryRightSuperficialPts,
      ovaryRightDeepPts: d.ovaryRightDeepPts,
      ovaryLeftSuperficialPts: d.ovaryLeftSuperficialPts,
      ovaryLeftDeepPts: d.ovaryLeftDeepPts,
      adhesionsOvaryRightPts: d.adhesionsOvaryRightPts,
      adhesionsOvaryLeftPts: d.adhesionsOvaryLeftPts,
      adhesionsTubeRightPts: d.adhesionsTubeRightPts,
      adhesionsTubeLeftPts: d.adhesionsTubeLeftPts,
      pouchOfDouglasObliteration: d.pouchOfDouglasObliteration,
    };

    const enzianInput: EnzianInput = {
      peritoneum: d.peritoneum,
      ovaryRight: d.ovaryRight,
      ovaryLeft: d.ovaryLeft,
      tubeRight: d.tubeRight,
      tubeLeft: d.tubeLeft,
      compartmentA: d.compartmentA,
      compartmentB: d.compartmentB,
      compartmentC: d.compartmentC,
      extragenitalF: d.extragenitalF,
      adenomyosisFa: d.adenomyosisFa,
    };

    const pain: VasPainScores = {
      dysmenorrhea: d.vasDysmenorrhea,
      dyspareunia: d.vasDyspareunia,
      dyschezia: d.vasDyschezia,
      dysuria: d.vasDysuria,
      chronicPelvicPain: d.vasChronicPelvicPain,
    };

    return evaluateEndometriosis(rasrmInput, enzianInput, pain);
  });

  // 2. List episodes for a patient
  app.get<{ Params: { patientId: string } }>('/api/patients/:patientId/endometriosis', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const rows = ctx.db
      .prepare(
        `SELECT e.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM endometriosis_episodes e
         LEFT JOIN users u ON u.id = e.reviewed_by
         LEFT JOIN users c ON c.id = e.created_by
         WHERE e.patient_id = ?
         ORDER BY e.assessment_date DESC, e.id DESC`,
      )
      .all(patientId);

    return rows.map(rowToEndometriosis);
  });

  // 3. Get episode by ID
  app.get<{ Params: { id: string } }>('/api/endometriosis/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const row = ctx.db
      .prepare(
        `SELECT e.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM endometriosis_episodes e
         LEFT JOIN users u ON u.id = e.reviewed_by
         LEFT JOIN users c ON c.id = e.created_by
         WHERE e.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('Endometriosis assessment not found');
    return rowToEndometriosis(row);
  });

  // 4. Create episode
  app.post('/api/endometriosis', async (req, reply) => {
    const user = assertCanManageEndometriosis(req);
    const parsed = endometriosisEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateEndometriosis(
      {
        peritonealSuperficialPts: data.peritonealSuperficialPts,
        peritonealDeepPts: data.peritonealDeepPts,
        ovaryRightSuperficialPts: data.ovaryRightSuperficialPts,
        ovaryRightDeepPts: data.ovaryRightDeepPts,
        ovaryLeftSuperficialPts: data.ovaryLeftSuperficialPts,
        ovaryLeftDeepPts: data.ovaryLeftDeepPts,
        adhesionsOvaryRightPts: data.adhesionsOvaryRightPts,
        adhesionsOvaryLeftPts: data.adhesionsOvaryLeftPts,
        adhesionsTubeRightPts: data.adhesionsTubeRightPts,
        adhesionsTubeLeftPts: data.adhesionsTubeLeftPts,
        pouchOfDouglasObliteration: data.pouchOfDouglasObliteration,
      },
      {
        peritoneum: data.peritoneum,
        ovaryRight: data.ovaryRight,
        ovaryLeft: data.ovaryLeft,
        tubeRight: data.tubeRight,
        tubeLeft: data.tubeLeft,
        compartmentA: data.compartmentA,
        compartmentB: data.compartmentB,
        compartmentC: data.compartmentC,
        extragenitalF: data.extragenitalF,
        adenomyosisFa: data.adenomyosisFa,
      },
      {
        dysmenorrhea: data.vasDysmenorrhea,
        dyspareunia: data.vasDyspareunia,
        dyschezia: data.vasDyschezia,
        dysuria: data.vasDysuria,
        chronicPelvicPain: data.vasChronicPelvicPain,
      },
    );

    const now = nowIso();
    const episodeId = tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        INSERT INTO endometriosis_episodes (
          patient_id, admission_id, assessment_date, assessment_type,
          vas_dysmenorrhea, vas_dyspareunia, vas_dyschezia, vas_dysuria, vas_chronic_pelvic_pain,
          rasrm_peritoneal_superficial_pts, rasrm_peritoneal_deep_pts,
          rasrm_ovary_right_superficial_pts, rasrm_ovary_right_deep_pts,
          rasrm_ovary_left_superficial_pts, rasrm_ovary_left_deep_pts,
          rasrm_adhesions_ovary_right_pts, rasrm_adhesions_ovary_left_pts,
          rasrm_adhesions_tube_right_pts, rasrm_adhesions_tube_left_pts,
          rasrm_pouch_of_douglas_obliteration, rasrm_total_score, rasrm_stage,
          enzian_peritoneum, enzian_ovary_left, enzian_ovary_right,
          enzian_tube_left, enzian_tube_right, enzian_compartment_a,
          enzian_compartment_b, enzian_compartment_c, enzian_extragenital_f,
          enzian_adenomyosis_fa, enzian_composite_code,
          medical_management_regimen, surgical_procedure_performed,
          fertility_sparing, post_op_hormonal_suppression, clinical_notes,
          lead_surgeon, reviewed_by, created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      const info = stmt.run(
        data.patientId,
        data.admissionId ?? null,
        data.assessmentDate,
        data.assessmentType,
        data.vasDysmenorrhea,
        data.vasDyspareunia,
        data.vasDyschezia,
        data.vasDysuria,
        data.vasChronicPelvicPain,
        data.peritonealSuperficialPts,
        data.peritonealDeepPts,
        data.ovaryRightSuperficialPts,
        data.ovaryRightDeepPts,
        data.ovaryLeftSuperficialPts,
        data.ovaryLeftDeepPts,
        data.adhesionsOvaryRightPts,
        data.adhesionsOvaryLeftPts,
        data.adhesionsTubeRightPts,
        data.adhesionsTubeLeftPts,
        data.pouchOfDouglasObliteration,
        evalResult.rasrmTotalScore,
        evalResult.rasrmStage,
        data.peritoneum ?? null,
        data.ovaryLeft ?? null,
        data.ovaryRight ?? null,
        data.tubeLeft ?? null,
        data.tubeRight ?? null,
        data.compartmentA ?? null,
        data.compartmentB ?? null,
        data.compartmentC ?? null,
        data.extragenitalF ?? null,
        data.adenomyosisFa ? 1 : 0,
        evalResult.enzianCompositeCode,
        data.medicalManagementRegimen ?? null,
        data.surgicalProcedurePerformed ?? null,
        data.fertilitySparing ? 1 : 0,
        data.postOpHormonalSuppression ?? null,
        data.clinicalNotes ?? null,
        data.leadSurgeon ?? null,
        data.reviewedBy,
        user.id,
        user.id,
        now,
        now,
      );

      const id = Number(info.lastInsertRowid);
      audit(ctx.db, {
        actorId: user.id,
        action: 'endometriosis.assessment_create',
        entity: 'endometriosis_episodes',
        entityId: id,
        detail: JSON.stringify({
          patientId: data.patientId,
          stage: evalResult.rasrmStage,
          enzian: evalResult.enzianCompositeCode,
        }),
      });

      return id;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT e.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM endometriosis_episodes e
         LEFT JOIN users u ON u.id = e.reviewed_by
         LEFT JOIN users c ON c.id = e.created_by
         WHERE e.id = ?`,
      )
      .get(episodeId);

    return rowToEndometriosis(created);
  });

  // 5. Update episode
  app.put<{ Params: { id: string } }>('/api/endometriosis/:id', async (req) => {
    const user = assertCanManageEndometriosis(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing = ctx.db.prepare('SELECT id, patient_id FROM endometriosis_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Endometriosis assessment not found');

    const parsed = endometriosisEpisodeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;
    const evalResult = evaluateEndometriosis(
      {
        peritonealSuperficialPts: data.peritonealSuperficialPts,
        peritonealDeepPts: data.peritonealDeepPts,
        ovaryRightSuperficialPts: data.ovaryRightSuperficialPts,
        ovaryRightDeepPts: data.ovaryRightDeepPts,
        ovaryLeftSuperficialPts: data.ovaryLeftSuperficialPts,
        ovaryLeftDeepPts: data.ovaryLeftDeepPts,
        adhesionsOvaryRightPts: data.adhesionsOvaryRightPts,
        adhesionsOvaryLeftPts: data.adhesionsOvaryLeftPts,
        adhesionsTubeRightPts: data.adhesionsTubeRightPts,
        adhesionsTubeLeftPts: data.adhesionsTubeLeftPts,
        pouchOfDouglasObliteration: data.pouchOfDouglasObliteration,
      },
      {
        peritoneum: data.peritoneum,
        ovaryRight: data.ovaryRight,
        ovaryLeft: data.ovaryLeft,
        tubeRight: data.tubeRight,
        tubeLeft: data.tubeLeft,
        compartmentA: data.compartmentA,
        compartmentB: data.compartmentB,
        compartmentC: data.compartmentC,
        extragenitalF: data.extragenitalF,
        adenomyosisFa: data.adenomyosisFa,
      },
      {
        dysmenorrhea: data.vasDysmenorrhea,
        dyspareunia: data.vasDyspareunia,
        dyschezia: data.vasDyschezia,
        dysuria: data.vasDysuria,
        chronicPelvicPain: data.vasChronicPelvicPain,
      },
    );

    const now = nowIso();
    tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        UPDATE endometriosis_episodes SET
          assessment_date = ?,
          assessment_type = ?,
          vas_dysmenorrhea = ?,
          vas_dyspareunia = ?,
          vas_dyschezia = ?,
          vas_dysuria = ?,
          vas_chronic_pelvic_pain = ?,
          rasrm_peritoneal_superficial_pts = ?,
          rasrm_peritoneal_deep_pts = ?,
          rasrm_ovary_right_superficial_pts = ?,
          rasrm_ovary_right_deep_pts = ?,
          rasrm_ovary_left_superficial_pts = ?,
          rasrm_ovary_left_deep_pts = ?,
          rasrm_adhesions_ovary_right_pts = ?,
          rasrm_adhesions_ovary_left_pts = ?,
          rasrm_adhesions_tube_right_pts = ?,
          rasrm_adhesions_tube_left_pts = ?,
          rasrm_pouch_of_douglas_obliteration = ?,
          rasrm_total_score = ?,
          rasrm_stage = ?,
          enzian_peritoneum = ?,
          enzian_ovary_left = ?,
          enzian_ovary_right = ?,
          enzian_tube_left = ?,
          enzian_tube_right = ?,
          enzian_compartment_a = ?,
          enzian_compartment_b = ?,
          enzian_compartment_c = ?,
          enzian_extragenital_f = ?,
          enzian_adenomyosis_fa = ?,
          enzian_composite_code = ?,
          medical_management_regimen = ?,
          surgical_procedure_performed = ?,
          fertility_sparing = ?,
          post_op_hormonal_suppression = ?,
          clinical_notes = ?,
          lead_surgeon = ?,
          reviewed_by = ?,
          updated_by = ?,
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        data.assessmentDate,
        data.assessmentType,
        data.vasDysmenorrhea,
        data.vasDyspareunia,
        data.vasDyschezia,
        data.vasDysuria,
        data.vasChronicPelvicPain,
        data.peritonealSuperficialPts,
        data.peritonealDeepPts,
        data.ovaryRightSuperficialPts,
        data.ovaryRightDeepPts,
        data.ovaryLeftSuperficialPts,
        data.ovaryLeftDeepPts,
        data.adhesionsOvaryRightPts,
        data.adhesionsOvaryLeftPts,
        data.adhesionsTubeRightPts,
        data.adhesionsTubeLeftPts,
        data.pouchOfDouglasObliteration,
        evalResult.rasrmTotalScore,
        evalResult.rasrmStage,
        data.peritoneum ?? null,
        data.ovaryLeft ?? null,
        data.ovaryRight ?? null,
        data.tubeLeft ?? null,
        data.tubeRight ?? null,
        data.compartmentA ?? null,
        data.compartmentB ?? null,
        data.compartmentC ?? null,
        data.extragenitalF ?? null,
        data.adenomyosisFa ? 1 : 0,
        evalResult.enzianCompositeCode,
        data.medicalManagementRegimen ?? null,
        data.surgicalProcedurePerformed ?? null,
        data.fertilitySparing ? 1 : 0,
        data.postOpHormonalSuppression ?? null,
        data.clinicalNotes ?? null,
        data.leadSurgeon ?? null,
        data.reviewedBy,
        user.id,
        now,
        id,
      );

      audit(ctx.db, {
        actorId: user.id,
        action: 'endometriosis.assessment_update',
        entity: 'endometriosis_episodes',
        entityId: id,
        detail: JSON.stringify({
          patientId: existing.patient_id,
          stage: evalResult.rasrmStage,
        }),
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT e.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM endometriosis_episodes e
         LEFT JOIN users u ON u.id = e.reviewed_by
         LEFT JOIN users c ON c.id = e.created_by
         WHERE e.id = ?`,
      )
      .get(id);

    return rowToEndometriosis(updated);
  });

  // 6. Delete episode
  app.delete<{ Params: { id: string } }>('/api/endometriosis/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'user:manage') && !can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only doctors or administrators can delete endometriosis assessment records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing = ctx.db.prepare('SELECT id, patient_id FROM endometriosis_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Endometriosis assessment not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM endometriosis_episodes WHERE id = ?').run(id);
      audit(ctx.db, {
        actorId: user.id,
        action: 'endometriosis.assessment_delete',
        entity: 'endometriosis_episodes',
        entityId: id,
        detail: JSON.stringify({ patientId: existing.patient_id }),
      });
    });

    return { ok: true, deletedId: id };
  });

  // 7. Audit Print
  app.post<{ Params: { id: string } }>('/api/endometriosis/:id/audit-print', async (req) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid episode ID');

    const existing = ctx.db.prepare('SELECT id, patient_id FROM endometriosis_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Endometriosis assessment not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'endometriosis.assessment_print',
      entity: 'endometriosis_episodes',
      entityId: id,
      detail: JSON.stringify({ patientId: existing.patient_id }),
    });

    return { ok: true };
  });
}
