import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  evaluateWhoMec,
  calculateIucdLifespanAndExpiry,
  evaluateFollowupFindings,
} from '../../web/src/contraceptionEngine.js';

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

export const contraceptiveCounselingSchema = z.object({
  counselingDate: z.string().min(1, 'Counseling date is required'),
  reproductivePlan: z.enum([
    'spacing_pregnancies',
    'limiting_completed_family',
    'delaying_first_pregnancy',
    'undecided',
  ]),
  desiredSpacingYears: optNullableNumber(0.5, 15),
  breastfeedingStatus: z
    .enum([
      'exclusive_breastfeeding_lt_6w',
      'exclusive_breastfeeding_6w_6m',
      'partial_breastfeeding',
      'not_breastfeeding',
    ])
    .default('not_breastfeeding'),
  medicalConditions: z.array(z.string()).default([]),
  chosenMethod: z.string().min(1, 'Chosen method is required'),
  methodRationale: optNullableString(1000),
  prescribedUnits: optNullableString(200),
  nextFollowupDate: optNullableString(50),
});

export const iucdInsertionSchema = z.object({
  counselingId: z.number().int().nullable().optional(),
  deviceType: z.enum([
    'cu_t_380a',
    'cu_t_375',
    'lng_ius_52mg_mirena',
    'lng_ius_19_5mg_kyleena',
    'other',
  ]),
  deviceBrandName: optNullableString(100),
  lotBatchNumber: optNullableString(100),
  deviceExpiryDate: optNullableString(50),
  insertionTiming: z.enum([
    'post_placental_vaginal',
    'post_cesarean_intracesarean',
    'early_postpartum_lt_48h',
    'interval_extended_gt_6w',
    'post_abortion_immediate',
    'emergency_contraception',
  ]),
  insertionDate: z.string().min(1, 'Insertion date is required'),
  insertionTime: optNullableString(20),
  insertedBy: z.string().min(1, 'Operator name is required'),
  uterineDepthCm: optNullableNumber(4, 15),
  analgesiaUsed: z
    .enum(['none', 'nsaid_premed', 'paracervical_block', 'general_epidural_anesthesia'])
    .default('none'),
  threadLengthCutCm: optNullableNumber(1, 10),
  insertionEase: z
    .enum(['smooth', 'moderate_resistance', 'difficult_cervical_stenosis', 'ultrasound_guided'])
    .default('smooth'),
  complications: z
    .enum([
      'none',
      'mild_cramping',
      'vasovagal_syncope',
      'bleeding_gt_50ml',
      'suspected_perforation',
      'immediate_expulsion',
    ])
    .default('none'),
  postInsertionUltrasound: z
    .enum(['not_done', 'fundal_position_confirmed', 'low_lying_segment', 'not_visualized'])
    .default('not_done'),
  status: z
    .enum([
      'in_situ',
      'partially_expelled',
      'fully_expelled',
      'removed_patient_request',
      'removed_medical_reason',
      'removed_expired',
      'pregnancy_in_situ',
    ])
    .default('in_situ'),
  removalDate: optNullableString(50),
  removalReason: optNullableString(500),
  clinicalNotes: optNullableString(1000),
});

export const iucdFollowupSchema = z.object({
  followupDate: z.string().min(1, 'Follow-up date is required'),
  visitInterval: z.enum([
    '6_weeks_post_insertion',
    '3_months',
    '6_months',
    '1_year',
    'annual_surveillance',
    'unscheduled_complaint',
  ]),
  threadStatus: z.enum([
    'threads_visible_normal',
    'threads_long',
    'threads_short',
    'threads_not_visible',
    'curled_in_canal',
  ]),
  pelvicUltrasoundDone: z.boolean().default(false),
  ultrasoundFinding: z
    .enum([
      'normal_fundal',
      'myometrial_embedment',
      'low_lying_cervical',
      'perforation_extrauterine',
      'absent_lost',
    ])
    .nullable()
    .optional(),
  bleedingPattern: z.enum([
    'normal_regular',
    'amenorrhea',
    'spotting_intermenstrual',
    'heavy_prolonged_bleeding',
  ]),
  pelvicPainScore: z.number().int().min(0).max(10).default(0),
  signsOfInfection: z.boolean().default(false),
  actionTaken: z.enum([
    'continue_in_situ_reassured',
    'antibiotics_prescribed',
    'threads_trimmed',
    'ultrasound_ordered',
    'device_removed',
    'hysteroscopic_removal_scheduled',
  ]),
  clinicalNotes: optNullableString(1000),
});

function assertPatientExists(ctx: Ctx, patientId: number) {
  const patient = ctx.db
    .prepare('SELECT id, full_name, date_of_birth, last_menstrual_period FROM patients WHERE id = ?')
    .get(patientId) as
    | { id: number; full_name: string; date_of_birth: string | null; last_menstrual_period: string | null }
    | undefined;
  if (!patient) throw notFound('Patient not found');
  return patient;
}

export function registerContraceptionRoutes(app: FastifyInstance, ctx: Ctx) {
  // GET /api/patients/:patientId/contraception/counselings
  app.get('/api/patients/:patientId/contraception/counselings', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid <= 0) throw badRequest('Invalid patient ID');

    assertPatientExists(ctx, pid);

    const rows = ctx.db
      .prepare(
        `SELECT c.*, u.full_name as counseled_by_name
         FROM contraceptive_counseling_records c
         LEFT JOIN users u ON c.counseled_by = u.id
         WHERE c.patient_id = ?
         ORDER BY c.counseling_date DESC, c.id DESC`,
      )
      .all(pid) as Record<string, unknown>[];

    const records = rows.map((r) => ({
      ...r,
      medical_conditions: r.medical_conditions_json ? JSON.parse(r.medical_conditions_json as string) : [],
      eligibility_results: r.eligibility_results_json ? JSON.parse(r.eligibility_results_json as string) : null,
    }));

    return reply.send({ records });
  });

  // POST /api/patients/:patientId/contraception/counselings
  app.post('/api/patients/:patientId/contraception/counselings', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid <= 0) throw badRequest('Invalid patient ID');

    assertPatientExists(ctx, pid);

    const parsed = contraceptiveCounselingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const now = nowIso();
    const user = req.user;

    // Evaluate WHO MEC categories
    const conditions = [...b.medicalConditions];
    if (b.breastfeedingStatus === 'exclusive_breastfeeding_lt_6w') conditions.push('breastfeeding_lt_6w');
    if (b.breastfeedingStatus === 'exclusive_breastfeeding_6w_6m') conditions.push('breastfeeding_6w_6m');

    const mecResults = evaluateWhoMec(conditions);

    const res = ctx.db
      .prepare(
        `INSERT INTO contraceptive_counseling_records (
          patient_id, counseling_date, reproductive_plan, desired_spacing_years,
          breastfeeding_status, medical_conditions_json, eligibility_results_json,
          chosen_method, method_rationale, prescribed_units, next_followup_date,
          counseled_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        pid,
        b.counselingDate,
        b.reproductivePlan,
        b.desiredSpacingYears ?? null,
        b.breastfeedingStatus,
        JSON.stringify(b.medicalConditions),
        JSON.stringify(mecResults),
        b.chosenMethod,
        b.methodRationale ?? null,
        b.prescribedUnits ?? null,
        b.nextFollowupDate ?? null,
        user?.id ?? null,
        now,
        now,
      );

    const counselingId = Number(res.lastInsertRowid);

    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'contraception.counseling_create',
      entity: 'contraceptive_counseling_records',
      entityId: counselingId,
      detail: JSON.stringify({ patientId: pid, chosenMethod: b.chosenMethod }),
    });

    return reply.status(201).send({
      id: counselingId,
      eligibilityResults: mecResults,
      message: 'Contraceptive counseling session recorded',
    });
  });

  // DELETE /api/patients/:patientId/contraception/counselings/:id
  app.delete('/api/patients/:patientId/contraception/counselings/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const cid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(cid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);
    const existing = ctx.db
      .prepare('SELECT id FROM contraceptive_counseling_records WHERE id = ? AND patient_id = ?')
      .get(cid, pid);
    if (!existing) throw notFound('Counseling record not found');

    ctx.db.prepare('DELETE FROM contraceptive_counseling_records WHERE id = ?').run(cid);

    audit(ctx.db, {
      actorId: req.user?.id ?? null,
      action: 'contraception.counseling_delete',
      entity: 'contraceptive_counseling_records',
      entityId: cid,
      detail: JSON.stringify({ patientId: pid }),
    });

    return reply.send({ ok: true, message: 'Counseling record deleted' });
  });

  // GET /api/patients/:patientId/contraception/iucd-insertions
  app.get('/api/patients/:patientId/contraception/iucd-insertions', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid <= 0) throw badRequest('Invalid patient ID');

    assertPatientExists(ctx, pid);

    const rows = ctx.db
      .prepare(
        `SELECT i.*, u.full_name as created_by_name
         FROM iucd_insertions i
         LEFT JOIN users u ON i.created_by = u.id
         WHERE i.patient_id = ?
         ORDER BY i.insertion_date DESC, i.id DESC`,
      )
      .all(pid) as Record<string, unknown>[];

    const insertions = rows.map((r) => {
      const followups = ctx.db
        .prepare(
          `SELECT f.*, u.full_name as examined_by_name
           FROM iucd_followups f
           LEFT JOIN users u ON f.examined_by = u.id
           WHERE f.insertion_id = ?
           ORDER BY f.followup_date DESC, f.id DESC`,
        )
        .all(r.id as number);

      return {
        ...r,
        followups,
      };
    });

    return reply.send({ insertions });
  });

  // GET /api/patients/:patientId/contraception/iucd-insertions/:id
  app.get('/api/patients/:patientId/contraception/iucd-insertions/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const iid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(iid)) throw badRequest('Invalid ID');

    const patient = assertPatientExists(ctx, pid);

    const insertion = ctx.db
      .prepare(
        `SELECT i.*, u.full_name as created_by_name
         FROM iucd_insertions i
         LEFT JOIN users u ON i.created_by = u.id
         WHERE i.id = ? AND i.patient_id = ?`,
      )
      .get(iid, pid) as Record<string, unknown> | undefined;

    if (!insertion) throw notFound('IUCD insertion record not found');

    const followups = ctx.db
      .prepare(
        `SELECT f.*, u.full_name as examined_by_name
         FROM iucd_followups f
         LEFT JOIN users u ON f.examined_by = u.id
         WHERE f.insertion_id = ?
         ORDER BY f.followup_date DESC, f.id DESC`,
      )
      .all(iid);

    return reply.send({
      insertion: {
        ...insertion,
        followups,
      },
      patient,
    });
  });

  // POST /api/patients/:patientId/contraception/iucd-insertions
  app.post('/api/patients/:patientId/contraception/iucd-insertions', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid <= 0) throw badRequest('Invalid patient ID');

    assertPatientExists(ctx, pid);

    const parsed = iucdInsertionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const now = nowIso();
    const user = req.user;

    const { lifespanYears, expectedRemovalDate } = calculateIucdLifespanAndExpiry(
      b.deviceType,
      b.insertionDate,
    );

    const res = ctx.db
      .prepare(
        `INSERT INTO iucd_insertions (
          patient_id, counseling_id, device_type, device_brand_name, lot_batch_number,
          device_expiry_date, insertion_timing, insertion_date, insertion_time, inserted_by,
          uterine_depth_cm, analgesia_used, thread_length_cut_cm, insertion_ease,
          complications, post_insertion_ultrasound, lifespan_years, expected_removal_date,
          status, removal_date, removal_reason, clinical_notes,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )`,
      )
      .run(
        pid,
        b.counselingId ?? null,
        b.deviceType,
        b.deviceBrandName ?? null,
        b.lotBatchNumber ?? null,
        b.deviceExpiryDate ?? null,
        b.insertionTiming,
        b.insertionDate,
        b.insertionTime ?? null,
        b.insertedBy,
        b.uterineDepthCm ?? null,
        b.analgesiaUsed,
        b.threadLengthCutCm ?? null,
        b.insertionEase,
        b.complications,
        b.postInsertionUltrasound,
        lifespanYears,
        expectedRemovalDate,
        b.status,
        b.removalDate ?? null,
        b.removalReason ?? null,
        b.clinicalNotes ?? null,
        user?.id ?? null,
        user?.id ?? null,
        now,
        now,
      );

    const insertionId = Number(res.lastInsertRowid);

    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'iucd.insertion_create',
      entity: 'iucd_insertions',
      entityId: insertionId,
      detail: JSON.stringify({
        patientId: pid,
        deviceType: b.deviceType,
        insertionTiming: b.insertionTiming,
        expectedRemovalDate,
      }),
    });

    return reply.status(201).send({
      id: insertionId,
      lifespanYears,
      expectedRemovalDate,
      message: 'IUCD insertion procedure recorded successfully',
    });
  });

  // PUT /api/patients/:patientId/contraception/iucd-insertions/:id
  app.put('/api/patients/:patientId/contraception/iucd-insertions/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const iid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(iid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);
    const existing = ctx.db
      .prepare('SELECT id FROM iucd_insertions WHERE id = ? AND patient_id = ?')
      .get(iid, pid);
    if (!existing) throw notFound('IUCD insertion record not found');

    const parsed = iucdInsertionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const now = nowIso();
    const user = req.user;

    const { lifespanYears, expectedRemovalDate } = calculateIucdLifespanAndExpiry(
      b.deviceType,
      b.insertionDate,
    );

    ctx.db
      .prepare(
        `UPDATE iucd_insertions SET
          counseling_id = ?, device_type = ?, device_brand_name = ?, lot_batch_number = ?,
          device_expiry_date = ?, insertion_timing = ?, insertion_date = ?, insertion_time = ?, inserted_by = ?,
          uterine_depth_cm = ?, analgesia_used = ?, thread_length_cut_cm = ?, insertion_ease = ?,
          complications = ?, post_insertion_ultrasound = ?, lifespan_years = ?, expected_removal_date = ?,
          status = ?, removal_date = ?, removal_reason = ?, clinical_notes = ?,
          updated_by = ?, updated_at = ?
        WHERE id = ? AND patient_id = ?`,
      )
      .run(
        b.counselingId ?? null,
        b.deviceType,
        b.deviceBrandName ?? null,
        b.lotBatchNumber ?? null,
        b.deviceExpiryDate ?? null,
        b.insertionTiming,
        b.insertionDate,
        b.insertionTime ?? null,
        b.insertedBy,
        b.uterineDepthCm ?? null,
        b.analgesiaUsed,
        b.threadLengthCutCm ?? null,
        b.insertionEase,
        b.complications,
        b.postInsertionUltrasound,
        lifespanYears,
        expectedRemovalDate,
        b.status,
        b.removalDate ?? null,
        b.removalReason ?? null,
        b.clinicalNotes ?? null,
        user?.id ?? null,
        now,
        iid,
        pid,
      );

    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'iucd.insertion_update',
      entity: 'iucd_insertions',
      entityId: iid,
      detail: JSON.stringify({ patientId: pid, status: b.status, removalDate: b.removalDate }),
    });

    return reply.send({
      id: iid,
      status: b.status,
      message: 'IUCD record updated successfully',
    });
  });

  // DELETE /api/patients/:patientId/contraception/iucd-insertions/:id
  app.delete('/api/patients/:patientId/contraception/iucd-insertions/:id', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const iid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(iid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);
    const existing = ctx.db
      .prepare('SELECT id FROM iucd_insertions WHERE id = ? AND patient_id = ?')
      .get(iid, pid);
    if (!existing) throw notFound('IUCD insertion record not found');

    ctx.db.prepare('DELETE FROM iucd_insertions WHERE id = ?').run(iid);

    audit(ctx.db, {
      actorId: req.user?.id ?? null,
      action: 'iucd.insertion_delete',
      entity: 'iucd_insertions',
      entityId: iid,
      detail: JSON.stringify({ patientId: pid }),
    });

    return reply.send({ ok: true, message: 'IUCD insertion record deleted' });
  });

  // POST /api/patients/:patientId/contraception/iucd-insertions/:id/followups
  app.post('/api/patients/:patientId/contraception/iucd-insertions/:id/followups', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const iid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(iid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);
    const insertion = ctx.db
      .prepare('SELECT id FROM iucd_insertions WHERE id = ? AND patient_id = ?')
      .get(iid, pid);
    if (!insertion) throw notFound('IUCD insertion record not found');

    const parsed = iucdFollowupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const b = parsed.data;
    const now = nowIso();
    const user = req.user;

    const evaluation = evaluateFollowupFindings({
      threadStatus: b.threadStatus,
      ultrasoundFinding: b.ultrasoundFinding,
      bleedingPattern: b.bleedingPattern,
      painScore: b.pelvicPainScore,
      infectionSigns: b.signsOfInfection,
    });

    const res = ctx.db
      .prepare(
        `INSERT INTO iucd_followups (
          insertion_id, patient_id, followup_date, visit_interval,
          thread_status, pelvic_ultrasound_done, ultrasound_finding,
          bleeding_pattern, pelvic_pain_score, signs_of_infection,
          action_taken, clinical_notes, examined_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        iid,
        pid,
        b.followupDate,
        b.visitInterval,
        b.threadStatus,
        b.pelvicUltrasoundDone ? 1 : 0,
        b.ultrasoundFinding ?? null,
        b.bleedingPattern,
        b.pelvicPainScore,
        b.signsOfInfection ? 1 : 0,
        b.actionTaken,
        b.clinicalNotes ?? null,
        user?.id ?? null,
        now,
        now,
      );

    const followupId = Number(res.lastInsertRowid);

    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'iucd.followup_create',
      entity: 'iucd_followups',
      entityId: followupId,
      detail: JSON.stringify({
        insertionId: iid,
        threadStatus: b.threadStatus,
        alertLevel: evaluation.alertLevel,
      }),
    });

    return reply.status(201).send({
      id: followupId,
      evaluation,
      message: 'IUCD follow-up visit logged',
    });
  });

  // POST /api/patients/:patientId/contraception/iucd-insertions/:id/print
  app.post('/api/patients/:patientId/contraception/iucd-insertions/:id/print', async (req: FastifyRequest, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, id } = req.params as { patientId: string; id: string };
    const pid = Number(patientId);
    const iid = Number(id);
    if (!Number.isInteger(pid) || !Number.isInteger(iid)) throw badRequest('Invalid ID');

    assertPatientExists(ctx, pid);

    audit(ctx.db, {
      actorId: req.user?.id ?? null,
      action: 'iucd.print',
      entity: 'iucd_insertions',
      entityId: iid,
      detail: JSON.stringify({ patientId: pid }),
    });

    return reply.send({ ok: true, printedAt: nowIso() });
  });
}
