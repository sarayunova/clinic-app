import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  calculateMaternalVteScore,
  evaluateNeuraxialClearance,
  type MaternalVteRiskFactors,
} from '../../web/src/maternalVteEngine.js';

function assertCanManageMaternalVte(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians, obstetricians, and maternity nursing staff can manage maternal VTE records');
  }
  return user;
}

export const maternalVteAssessmentSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentType: z.enum(['antenatal_early', 'antenatal_intrapartum', 'postnatal']),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  gestationalAgeWeeks: z.number().min(4.0).max(44.0).nullable().optional(),
  currentWeightKg: z.number().min(30.0).max(250.0),
  bmi: z.number().min(12.0).max(70.0),
  previousVteUnprovokedOrEstrogen: z.boolean().default(false),
  previousVteProvoked: z.boolean().default(false),
  knownHighRiskThrombophilia: z.boolean().default(false),
  medicalComorbidities: z.boolean().default(false),
  surgicalProcedureInPregnancy: z.boolean().default(false),
  grossVaricoseVeins: z.boolean().default(false),
  ageOver35: z.boolean().default(false),
  parityGeq3: z.boolean().default(false),
  smoker: z.boolean().default(false),
  bmiGeq30: z.boolean().default(false),
  bmiGeq40: z.boolean().default(false),
  multiplePregnancy: z.boolean().default(false),
  assistedReproductiveTechIvf: z.boolean().default(false),
  preEclampsia: z.boolean().default(false),
  cesareanSectionEmergency: z.boolean().default(false),
  cesareanSectionElective: z.boolean().default(false),
  prolongedLaborOver24h: z.boolean().default(false),
  postpartumHemorrhageOver1000ml: z.boolean().default(false),
  pretermBirthUnder37w: z.boolean().default(false),
  stillbirthInThisPregnancy: z.boolean().default(false),
  systemicInfectionCurrent: z.boolean().default(false),
  immobilityBedrestOver3d: z.boolean().default(false),
  hyperemesisOrDehydration: z.boolean().default(false),
  lowRiskThrombophilia: z.boolean().default(false),
  familyHistoryVteFirstDegree: z.boolean().default(false),
  lmwhPrescribed: z.boolean().default(false),
  lmwhAgent: z.enum(['enoxaparin', 'dalteparin', 'tinzaparin', 'unfractionated_heparin']).nullable().optional(),
  lmwhDailyDoseMgOrUnits: z.string().nullable().optional(),
  weightTierBracket: z.string().nullable().optional(),
  antiEmbolicStockingsOrdered: z.boolean().default(false),
  neuraxialAnesthesiaEligible: z.boolean().default(true),
  lastDoseDatetime: z.string().nullable().optional(),
  nextSafeNeuraxialDatetime: z.string().nullable().optional(),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const maternalVteDoseLogSchema = z.object({
  administeredAt: z.string().min(1, 'Administration datetime is required'),
  agent: z.string().min(1, 'Agent is required'),
  dose: z.string().min(1, 'Dose is required'),
  route: z.string().default('subcutaneous'),
  site: z.enum(['abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'upper_arm']).nullable().optional(),
  plateletCount: z.number().nullable().optional(),
  antiXaLevel: z.number().nullable().optional(),
  bleedingSignsObserved: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});

export function registerMaternalVteRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List assessments
  app.get('/api/maternal-vte/assessments', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, riskTier, assessmentType } = req.query as { patientId?: string; riskTier?: string; assessmentType?: string };

    let query = `
      SELECT a.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as assessed_by_name
      FROM maternal_vte_assessments a
      JOIN patients pat ON a.patient_id = pat.id
      JOIN users u ON a.assessed_by_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` AND a.patient_id = ?`;
      params.push(parseInt(patientId, 10));
    }
    if (riskTier) {
      query += ` AND a.risk_tier = ?`;
      params.push(riskTier);
    }
    if (assessmentType) {
      query += ` AND a.assessment_type = ?`;
      params.push(assessmentType);
    }

    query += ` ORDER BY a.assessment_datetime DESC`;
    const rows = ctx.db.prepare(query).all(...params);
    return reply.send({ assessments: rows });
  });

  // 2. Get single assessment with dose logs and neuraxial countdown
  app.get('/api/maternal-vte/assessments/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const assessment = ctx.db.prepare(`
      SELECT a.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as assessed_by_name
      FROM maternal_vte_assessments a
      JOIN patients pat ON a.patient_id = pat.id
      JOIN users u ON a.assessed_by_id = u.id
      WHERE a.id = ?
    `).get(id) as any;

    if (!assessment) throw notFound('Maternal VTE assessment not found');

    const doseLogs = ctx.db.prepare(`
      SELECT d.*, u.full_name as administered_by_name
      FROM maternal_vte_dose_logs d
      JOIN users u ON d.administered_by_id = u.id
      WHERE d.assessment_id = ?
      ORDER BY d.administered_at DESC
    `).all(id);

    // Compute live neuraxial clearance
    const lastDose = doseLogs.length > 0 ? (doseLogs[0] as any).administered_at : assessment.last_dose_datetime;
    const neuraxialStatus = evaluateNeuraxialClearance(lastDose, false);

    return reply.send({
      assessment,
      doseLogs,
      neuraxialStatus,
    });
  });

  // 3. Clinical Calculator endpoint
  app.post('/api/maternal-vte/calculate', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as MaternalVteRiskFactors;
    const result = calculateMaternalVteScore(body);
    return reply.send(result);
  });

  // 4. Create Maternal VTE assessment
  app.post('/api/maternal-vte/assessments', async (req, reply) => {
    const user = assertCanManageMaternalVte(req);
    const body = parse(maternalVteAssessmentSchema, req.body);

    const calculated = calculateMaternalVteScore({
      assessmentType: body.assessmentType,
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? undefined,
      weightKg: body.currentWeightKg,
      bmi: body.bmi,
      previousVteUnprovokedOrEstrogen: body.previousVteUnprovokedOrEstrogen,
      previousVteProvoked: body.previousVteProvoked,
      knownHighRiskThrombophilia: body.knownHighRiskThrombophilia,
      medicalComorbidities: body.medicalComorbidities,
      surgicalProcedureInPregnancy: body.surgicalProcedureInPregnancy,
      grossVaricoseVeins: body.grossVaricoseVeins,
      ageOver35: body.ageOver35,
      parityGeq3: body.parityGeq3,
      smoker: body.smoker,
      bmiGeq30: body.bmiGeq30,
      bmiGeq40: body.bmiGeq40,
      multiplePregnancy: body.multiplePregnancy,
      assistedReproductiveTechIvf: body.assistedReproductiveTechIvf,
      preEclampsia: body.preEclampsia,
      cesareanSectionEmergency: body.cesareanSectionEmergency,
      cesareanSectionElective: body.cesareanSectionElective,
      prolongedLaborOver24h: body.prolongedLaborOver24h,
      postpartumHemorrhageOver1000ml: body.postpartumHemorrhageOver1000ml,
      pretermBirthUnder37w: body.pretermBirthUnder37w,
      stillbirthInThisPregnancy: body.stillbirthInThisPregnancy,
      systemicInfectionCurrent: body.systemicInfectionCurrent,
      immobilityBedrestOver3d: body.immobilityBedrestOver3d,
      hyperemesisOrDehydration: body.hyperemesisOrDehydration,
      lowRiskThrombophilia: body.lowRiskThrombophilia,
      familyHistoryVteFirstDegree: body.familyHistoryVteFirstDegree,
    });

    const totalVteScore = calculated.totalScore;
    const riskTier = calculated.riskTier;
    const lmwhDailyDoseMgOrUnits = body.lmwhDailyDoseMgOrUnits || (body.lmwhAgent === 'dalteparin' ? calculated.dalteparinDose : calculated.enoxaparinDose);
    const weightTierBracket = body.weightTierBracket || calculated.weightTierBracket;

    const insertStmt = ctx.db.prepare(`
      INSERT INTO maternal_vte_assessments (
        patient_id, admission_id, assessment_type, assessment_datetime,
        gestational_age_weeks, current_weight_kg, bmi,
        previous_vte_unprovoked_or_estrogen, previous_vte_provoked,
        known_high_risk_thrombophilia, medical_comorbidities, surgical_procedure_in_pregnancy,
        gross_varicose_veins, age_over_35, parity_geq_3, smoker,
        bmi_geq_30, bmi_geq_40, multiple_pregnancy, assisted_reproductive_tech_ivf,
        pre_eclampsia, cesarean_section_emergency, cesarean_section_elective,
        prolonged_labor_over_24h, postpartum_hemorrhage_over_1000ml, preterm_birth_under_37w,
        stillbirth_in_this_pregnancy, systemic_infection_current, immobility_bedrest_over_3d,
        hyperemesis_or_dehydration, low_risk_thrombophilia, family_history_vte_first_degree,
        total_vte_score, risk_tier, lmwh_prescribed, lmwh_agent,
        lmwh_daily_dose_mg_or_units, weight_tier_bracket, anti_embolic_stockings_ordered,
        neuraxial_anesthesia_eligible, last_dose_datetime, next_safe_neuraxial_datetime,
        assessed_by_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = insertStmt.run(
      body.patientId,
      body.admissionId ?? null,
      body.assessmentType,
      body.assessmentDatetime,
      body.gestationalAgeWeeks ?? null,
      body.currentWeightKg,
      body.bmi,
      body.previousVteUnprovokedOrEstrogen ? 1 : 0,
      body.previousVteProvoked ? 1 : 0,
      body.knownHighRiskThrombophilia ? 1 : 0,
      body.medicalComorbidities ? 1 : 0,
      body.surgicalProcedureInPregnancy ? 1 : 0,
      body.grossVaricoseVeins ? 1 : 0,
      body.ageOver35 ? 1 : 0,
      body.parityGeq3 ? 1 : 0,
      body.smoker ? 1 : 0,
      body.bmiGeq30 ? 1 : 0,
      body.bmiGeq40 ? 1 : 0,
      body.multiplePregnancy ? 1 : 0,
      body.assistedReproductiveTechIvf ? 1 : 0,
      body.preEclampsia ? 1 : 0,
      body.cesareanSectionEmergency ? 1 : 0,
      body.cesareanSectionElective ? 1 : 0,
      body.prolongedLaborOver24h ? 1 : 0,
      body.postpartumHemorrhageOver1000ml ? 1 : 0,
      body.pretermBirthUnder37w ? 1 : 0,
      body.stillbirthInThisPregnancy ? 1 : 0,
      body.systemicInfectionCurrent ? 1 : 0,
      body.immobilityBedrestOver3d ? 1 : 0,
      body.hyperemesisOrDehydration ? 1 : 0,
      body.lowRiskThrombophilia ? 1 : 0,
      body.familyHistoryVteFirstDegree ? 1 : 0,
      totalVteScore,
      riskTier,
      body.lmwhPrescribed ? 1 : 0,
      body.lmwhAgent ?? null,
      lmwhDailyDoseMgOrUnits ?? null,
      weightTierBracket ?? null,
      body.antiEmbolicStockingsOrdered ? 1 : 0,
      body.neuraxialAnesthesiaEligible ? 1 : 0,
      body.lastDoseDatetime ?? null,
      body.nextSafeNeuraxialDatetime ?? null,
      user.id,
      body.clinicalNotes ?? null
    );

    const assessmentId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_vte.assessment_create',
      entity: 'maternal_vte_assessments',
      entityId: assessmentId,
      detail: `Created maternal VTE risk assessment (${body.assessmentType}): Score ${totalVteScore}, Tier: ${riskTier}`,
    });

    const created = ctx.db.prepare('SELECT * FROM maternal_vte_assessments WHERE id = ?').get(assessmentId);
    return reply.status(201).send({ assessment: created });
  });

  // 5. Update Maternal VTE assessment
  app.put('/api/maternal-vte/assessments/:id', async (req, reply) => {
    const user = assertCanManageMaternalVte(req);
    const { id } = req.params as { id: string };
    const body = parse(maternalVteAssessmentSchema.partial(), req.body);

    const existing = ctx.db.prepare('SELECT * FROM maternal_vte_assessments WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Maternal VTE assessment not found');

    const updateStmt = ctx.db.prepare(`
      UPDATE maternal_vte_assessments SET
        assessment_type = COALESCE(?, assessment_type),
        current_weight_kg = COALESCE(?, current_weight_kg),
        bmi = COALESCE(?, bmi),
        lmwh_prescribed = COALESCE(?, lmwh_prescribed),
        lmwh_agent = COALESCE(?, lmwh_agent),
        lmwh_daily_dose_mg_or_units = COALESCE(?, lmwh_daily_dose_mg_or_units),
        anti_embolic_stockings_ordered = COALESCE(?, anti_embolic_stockings_ordered),
        neuraxial_anesthesia_eligible = COALESCE(?, neuraxial_anesthesia_eligible),
        last_dose_datetime = COALESCE(?, last_dose_datetime),
        next_safe_neuraxial_datetime = COALESCE(?, next_safe_neuraxial_datetime),
        clinical_notes = COALESCE(?, clinical_notes)
      WHERE id = ?
    `);

    updateStmt.run(
      body.assessmentType ?? null,
      body.currentWeightKg ?? null,
      body.bmi ?? null,
      body.lmwhPrescribed !== undefined ? (body.lmwhPrescribed ? 1 : 0) : null,
      body.lmwhAgent ?? null,
      body.lmwhDailyDoseMgOrUnits ?? null,
      body.antiEmbolicStockingsOrdered !== undefined ? (body.antiEmbolicStockingsOrdered ? 1 : 0) : null,
      body.neuraxialAnesthesiaEligible !== undefined ? (body.neuraxialAnesthesiaEligible ? 1 : 0) : null,
      body.lastDoseDatetime ?? null,
      body.nextSafeNeuraxialDatetime ?? null,
      body.clinicalNotes ?? null,
      id
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_vte.assessment_update',
      entity: 'maternal_vte_assessments',
      entityId: Number(id),
      detail: `Updated maternal VTE assessment ID ${id}`,
    });

    const updated = ctx.db.prepare('SELECT * FROM maternal_vte_assessments WHERE id = ?').get(id);
    return reply.send({ assessment: updated });
  });

  // 6. Delete Maternal VTE assessment
  app.delete('/api/maternal-vte/assessments/:id', async (req, reply) => {
    const user = assertCanManageMaternalVte(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM maternal_vte_assessments WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Maternal VTE assessment not found');

    ctx.db.prepare('DELETE FROM maternal_vte_assessments WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_vte.assessment_delete',
      entity: 'maternal_vte_assessments',
      entityId: Number(id),
      detail: `Deleted maternal VTE assessment ID ${id}`,
    });

    return reply.send({ success: true, message: 'Maternal VTE assessment deleted successfully' });
  });

  // Print audit
  app.post('/api/maternal-vte/assessments/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const existing = ctx.db.prepare('SELECT * FROM maternal_vte_assessments WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Maternal VTE assessment not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_vte.print',
      entity: 'maternal_vte_assessments',
      entityId: Number(id),
      detail: `Printed maternal VTE risk assessment & thromboprophylaxis dossier for ID ${id}`,
    });

    return reply.send({ success: true, message: 'Maternal VTE print audited' });
  });

  // 7. List Dose Logs
  app.get('/api/maternal-vte/assessments/:id/doses', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const doses = ctx.db.prepare(`
      SELECT d.*, u.full_name as administered_by_name
      FROM maternal_vte_dose_logs d
      JOIN users u ON d.administered_by_id = u.id
      WHERE d.assessment_id = ?
      ORDER BY d.administered_at DESC
    `).all(id);

    return reply.send(doses);
  });

  // 8. Add Dose Log
  app.post('/api/maternal-vte/assessments/:id/doses', async (req, reply) => {
    const user = assertCanManageMaternalVte(req);
    const { id } = req.params as { id: string };
    const body = parse(maternalVteDoseLogSchema, req.body);

    const assessment = ctx.db.prepare('SELECT * FROM maternal_vte_assessments WHERE id = ?').get(id) as any;
    if (!assessment) throw notFound('Maternal VTE assessment not found');

    const insertStmt = ctx.db.prepare(`
      INSERT INTO maternal_vte_dose_logs (
        assessment_id, administered_at, agent, dose,
        route, site, administered_by_id, platelet_count,
        anti_xa_level, bleeding_signs_observed, notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      id,
      body.administeredAt,
      body.agent,
      body.dose,
      body.route,
      body.site ?? null,
      user.id,
      body.plateletCount ?? null,
      body.antiXaLevel ?? null,
      body.bleedingSignsObserved ? 1 : 0,
      body.notes ?? null
    );

    // Update last_dose_datetime and next safe neuraxial time (+12 hours) on parent assessment
    const safeTime = new Date(new Date(body.administeredAt).getTime() + 12 * 60 * 60 * 1000).toISOString();
    ctx.db.prepare(`
      UPDATE maternal_vte_assessments SET
        last_dose_datetime = ?,
        next_safe_neuraxial_datetime = ?,
        neuraxial_anesthesia_eligible = 0
      WHERE id = ?
    `).run(body.administeredAt, safeTime, id);

    const logId = Number(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_vte.dose_log',
      entity: 'maternal_vte_dose_logs',
      entityId: logId,
      detail: `Administered LMWH ${body.agent} ${body.dose} at ${body.administeredAt}. Neuraxial clearance countdown set to 12h.`,
    });

    const created = ctx.db.prepare(`
      SELECT d.*, u.full_name as administered_by_name
      FROM maternal_vte_dose_logs d
      JOIN users u ON d.administered_by_id = u.id
      WHERE d.id = ?
    `).get(logId);

    return reply.status(201).send({ log: created });
  });

  // 9. Delete Dose Log
  app.delete('/api/maternal-vte/doses/:id', async (req, reply) => {
    const user = assertCanManageMaternalVte(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT * FROM maternal_vte_dose_logs WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('LMWH dose log not found');

    ctx.db.prepare('DELETE FROM maternal_vte_dose_logs WHERE id = ?').run(id);

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_vte.dose_delete',
      entity: 'maternal_vte_dose_logs',
      entityId: Number(id),
      detail: `Deleted LMWH dose log ID ${id}`,
    });

    return reply.send({ success: true, message: 'Dose log deleted successfully' });
  });
}
