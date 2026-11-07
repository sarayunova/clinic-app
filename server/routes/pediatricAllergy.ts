import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  calculatePramScore,
  calculatePediatricAnaphylaxisPlan,
  type PramAssessmentInput,
} from '../../web/src/pediatricAllergyEngine.js';

function assertCanManagePediatricAllergy(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and pediatric nursing staff can manage pediatric allergy and respiratory records');
  }
  return user;
}

export const pramAssessmentSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  oxygenSaturationPct: z.number().min(50).max(100),
  suprasternalRetractionsScore: z.union([z.literal(0), z.literal(2)]),
  scaleneMuscleContractionScore: z.union([z.literal(0), z.literal(2)]),
  airEntryScore: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  wheezingScore: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  responseToBurstSaba: z.enum(['good_response', 'partial_response', 'poor_deteriorating']).default('good_response'),
  systemicSteroidGiven: z.boolean().default(false),
  ivMagnesiumGiven: z.boolean().default(false),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const anaphylaxisPlanSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  diagnosisDate: z.string().min(1, 'Diagnosis date is required'),
  knownAllergens: z.array(z.string().min(1)).min(1, 'At least one allergen is required'),
  childWeightKg: z.number().min(2).max(120, 'Child weight must be between 2 and 120 kg'),
  injectionSite: z.string().default('anterolateral_right_thigh'),
  antihistaminePrescribed: z.string().max(500).nullable().optional(),
  steroidPrescribed: z.string().max(500).nullable().optional(),
  schoolHealthActionPlanShared: z.boolean().default(true),
  emergencyContactName: z.string().min(2, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(5, 'Emergency contact phone is required'),
  clinicalInstructions: z.string().max(1000).nullable().optional(),
});

export function registerPediatricAllergyRoutes(app: FastifyInstance, ctx: Ctx) {
  // --- A. Pediatric PRAM Respiratory Assessments ---

  // 1. List PRAM assessments
  app.get('/api/pediatric-allergy/pram', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT p.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as assessed_by_name
      FROM pediatric_pram_assessments p
      JOIN patients pat ON p.patient_id = pat.id
      JOIN users u ON p.assessed_by_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND p.patient_id = ?';
      params.push(Number(patientId));
    }

    query += ' ORDER BY p.assessment_datetime DESC, p.id DESC';

    const assessments = ctx.db.prepare(query).all(...params);
    return reply.send({ assessments });
  });

  // 2. Create PRAM assessment
  app.post('/api/pediatric-allergy/pram', async (req, reply) => {
    const user = assertCanManagePediatricAllergy(req);
    const body = parse(pramAssessmentSchema, req.body);

    const pramCalc = calculatePramScore({
      oxygenSaturationPct: body.oxygenSaturationPct,
      suprasternalRetractionsScore: body.suprasternalRetractionsScore,
      scaleneMuscleContractionScore: body.scaleneMuscleContractionScore,
      airEntryScore: body.airEntryScore,
      wheezingScore: body.wheezingScore,
      responseToBurstSaba: body.responseToBurstSaba,
    });

    const dateCode = (body.assessmentDatetime || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const assessmentCode = `PRAM-${dateCode}-${randSuffix}`;

    const stmt = ctx.db.prepare(`
      INSERT INTO pediatric_pram_assessments (
        patient_id, admission_id, assessment_code, assessment_datetime, oxygen_saturation_pct,
        o2_score, suprasternal_retractions_score, scalene_muscle_contraction_score,
        air_entry_score, wheezing_score, total_pram_score, severity_tier,
        response_to_burst_saba, systemic_steroid_given, iv_magnesium_given,
        assessed_by_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = stmt.run(
      body.patientId,
      body.admissionId ?? null,
      assessmentCode,
      body.assessmentDatetime,
      body.oxygenSaturationPct,
      pramCalc.o2Score,
      body.suprasternalRetractionsScore,
      body.scaleneMuscleContractionScore,
      body.airEntryScore,
      body.wheezingScore,
      pramCalc.totalPramScore,
      pramCalc.severityTier,
      body.responseToBurstSaba,
      body.systemicSteroidGiven ? 1 : 0,
      body.ivMagnesiumGiven ? 1 : 0,
      user.id,
      body.clinicalNotes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_pram.assessment_create',
      entity: 'pediatric_pram_assessments',
      entityId: Number(result.lastInsertRowid),
      detail: {
        assessmentCode,
        patientId: body.patientId,
        totalPramScore: pramCalc.totalPramScore,
        severityTier: pramCalc.severityTier,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as assessed_by_name
         FROM pediatric_pram_assessments p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN users u ON p.assessed_by_id = u.id
         WHERE p.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ assessment: inserted, calculation: pramCalc });
  });

  // 3. Get single PRAM assessment
  app.get('/api/pediatric-allergy/pram/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const assessment = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as assessed_by_name
         FROM pediatric_pram_assessments p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN users u ON p.assessed_by_id = u.id
         WHERE p.id = ?`
      )
      .get(Number(id));

    if (!assessment) {
      throw notFound('Pediatric PRAM assessment not found');
    }

    return reply.send({ assessment });
  });

  // 4. Delete PRAM assessment
  app.delete('/api/pediatric-allergy/pram/:id', async (req, reply) => {
    const user = assertCanManagePediatricAllergy(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, assessment_code FROM pediatric_pram_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Pediatric PRAM assessment not found');
    }

    ctx.db.prepare('DELETE FROM pediatric_pram_assessments WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_pram.assessment_delete',
      entity: 'pediatric_pram_assessments',
      entityId: Number(id),
      detail: { assessmentCode: existing.assessment_code },
    });

    return reply.send({ success: true, message: 'Pediatric PRAM assessment deleted' });
  });

  // --- B. Pediatric Anaphylaxis Emergency Action Plans ---

  // 5. List Anaphylaxis Action Plans
  app.get('/api/pediatric-allergy/anaphylaxis-plans', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT a.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as attending_physician_name
      FROM pediatric_anaphylaxis_action_plans a
      JOIN patients pat ON a.patient_id = pat.id
      JOIN users u ON a.attending_physician_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND a.patient_id = ?';
      params.push(Number(patientId));
    }

    query += ' ORDER BY a.diagnosis_date DESC, a.id DESC';

    const rawPlans = ctx.db.prepare(query).all(...params) as any[];
    const plans = rawPlans.map(p => ({
      ...p,
      known_allergens: JSON.parse(p.known_allergens || '[]'),
    }));

    return reply.send({ plans });
  });

  // 6. Create Anaphylaxis Action Plan
  app.post('/api/pediatric-allergy/anaphylaxis-plans', async (req, reply) => {
    const user = assertCanManagePediatricAllergy(req);
    const body = parse(anaphylaxisPlanSchema, req.body);

    const calcResult = calculatePediatricAnaphylaxisPlan({
      childWeightKg: body.childWeightKg,
      knownAllergens: body.knownAllergens,
    });

    const dateCode = (body.diagnosisDate || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const planCode = `ANAPH-${dateCode}-${randSuffix}`;

    const stmt = ctx.db.prepare(`
      INSERT INTO pediatric_anaphylaxis_action_plans (
        patient_id, plan_code, diagnosis_date, known_allergens, child_weight_kg,
        epinephrine_im_dose_mg, epinephrine_im_volume_ml, autoinjector_type,
        injection_site, antihistamine_prescribed, steroid_prescribed,
        school_health_action_plan_shared, emergency_contact_name, emergency_contact_phone,
        attending_physician_id, clinical_instructions
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = stmt.run(
      body.patientId,
      planCode,
      body.diagnosisDate,
      JSON.stringify(body.knownAllergens),
      body.childWeightKg,
      calcResult.epinephrineImDoseMg,
      calcResult.epinephrineImVolumeMl,
      calcResult.recommendedAutoinjectorType,
      body.injectionSite || 'anterolateral_right_thigh',
      body.antihistaminePrescribed ?? null,
      body.steroidPrescribed ?? null,
      body.schoolHealthActionPlanShared ? 1 : 0,
      body.emergencyContactName,
      body.emergencyContactPhone,
      user.id,
      body.clinicalInstructions ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'anaphylaxis_plan.create',
      entity: 'pediatric_anaphylaxis_action_plans',
      entityId: Number(result.lastInsertRowid),
      detail: {
        planCode,
        patientId: body.patientId,
        weightKg: body.childWeightKg,
        autoinjector: calcResult.recommendedAutoinjectorType,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT a.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as attending_physician_name
         FROM pediatric_anaphylaxis_action_plans a
         JOIN patients pat ON a.patient_id = pat.id
         JOIN users u ON a.attending_physician_id = u.id
         WHERE a.id = ?`
      )
      .get(Number(result.lastInsertRowid)) as any;

    inserted.known_allergens = JSON.parse(inserted.known_allergens || '[]');

    return reply.status(201).send({ plan: inserted, calculation: calcResult });
  });

  // 7. Get single Anaphylaxis Action Plan
  app.get('/api/pediatric-allergy/anaphylaxis-plans/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const plan = ctx.db
      .prepare(
        `SELECT a.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as attending_physician_name
         FROM pediatric_anaphylaxis_action_plans a
         JOIN patients pat ON a.patient_id = pat.id
         JOIN users u ON a.attending_physician_id = u.id
         WHERE a.id = ?`
      )
      .get(Number(id)) as any;

    if (!plan) {
      throw notFound('Pediatric anaphylaxis action plan not found');
    }

    plan.known_allergens = JSON.parse(plan.known_allergens || '[]');
    return reply.send({ plan });
  });

  // 8. Update Anaphylaxis Action Plan
  app.put('/api/pediatric-allergy/anaphylaxis-plans/:id', async (req, reply) => {
    const user = assertCanManagePediatricAllergy(req);
    const { id } = req.params as { id: string };
    const body = parse(anaphylaxisPlanSchema, req.body);

    const existing = ctx.db.prepare('SELECT id, plan_code FROM pediatric_anaphylaxis_action_plans WHERE id = ?').get(Number(id)) as
      | { id: number; plan_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Pediatric anaphylaxis action plan not found');
    }

    const calcResult = calculatePediatricAnaphylaxisPlan({
      childWeightKg: body.childWeightKg,
      knownAllergens: body.knownAllergens,
    });

    ctx.db
      .prepare(
        `UPDATE pediatric_anaphylaxis_action_plans
         SET diagnosis_date = ?, known_allergens = ?, child_weight_kg = ?,
             epinephrine_im_dose_mg = ?, epinephrine_im_volume_ml = ?, autoinjector_type = ?,
             injection_site = ?, antihistamine_prescribed = ?, steroid_prescribed = ?,
             school_health_action_plan_shared = ?, emergency_contact_name = ?,
             emergency_contact_phone = ?, clinical_instructions = ?
         WHERE id = ?`
      )
      .run(
        body.diagnosisDate,
        JSON.stringify(body.knownAllergens),
        body.childWeightKg,
        calcResult.epinephrineImDoseMg,
        calcResult.epinephrineImVolumeMl,
        calcResult.recommendedAutoinjectorType,
        body.injectionSite,
        body.antihistaminePrescribed ?? null,
        body.steroidPrescribed ?? null,
        body.schoolHealthActionPlanShared ? 1 : 0,
        body.emergencyContactName,
        body.emergencyContactPhone,
        body.clinicalInstructions ?? null,
        Number(id)
      );

    audit(ctx.db, {
      actorId: user.id,
      action: 'anaphylaxis_plan.update',
      entity: 'pediatric_anaphylaxis_action_plans',
      entityId: Number(id),
      detail: { planCode: existing.plan_code, weightKg: body.childWeightKg },
    });

    const updated = ctx.db
      .prepare(
        `SELECT a.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                u.full_name as attending_physician_name
         FROM pediatric_anaphylaxis_action_plans a
         JOIN patients pat ON a.patient_id = pat.id
         JOIN users u ON a.attending_physician_id = u.id
         WHERE a.id = ?`
      )
      .get(Number(id)) as any;

    updated.known_allergens = JSON.parse(updated.known_allergens || '[]');
    return reply.send({ plan: updated });
  });

  // 9. Delete Anaphylaxis Action Plan
  app.delete('/api/pediatric-allergy/anaphylaxis-plans/:id', async (req, reply) => {
    const user = assertCanManagePediatricAllergy(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, plan_code FROM pediatric_anaphylaxis_action_plans WHERE id = ?').get(Number(id)) as
      | { id: number; plan_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Pediatric anaphylaxis action plan not found');
    }

    ctx.db.prepare('DELETE FROM pediatric_anaphylaxis_action_plans WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'anaphylaxis_plan.delete',
      entity: 'pediatric_anaphylaxis_action_plans',
      entityId: Number(id),
      detail: { planCode: existing.plan_code },
    });

    return reply.send({ success: true, message: 'Pediatric anaphylaxis action plan deleted' });
  });

  // 10. Print audit
  app.post('/api/pediatric-allergy/:type/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { type, id } = req.params as { type: string; id: string };

    audit(ctx.db, {
      actorId: user.id,
      action: 'pediatric_allergy.print',
      entity: type === 'pram' ? 'pediatric_pram_assessments' : 'pediatric_anaphylaxis_action_plans',
      entityId: Number(id),
      detail: { type },
    });

    return reply.send({ success: true, message: 'Pediatric allergy/respiratory document print audited' });
  });
}
