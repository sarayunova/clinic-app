import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import { calculateNicuTpn, type NicuTpnCalculationInput } from '../../web/src/nicuTpnEngine.js';

function assertCanManageTpn(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and neonatal nursing staff can manage NICU TPN records');
  }
  return user;
}

export const nicuTpnPrescriptionSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  prescriptionDate: z.string().min(1, 'Prescription date is required'),
  dayOfLife: z.number().int().min(1, 'Day of life must be at least 1'),
  gestationalAgeWeeks: z.number().min(22).max(44).nullable().optional(),
  birthWeightKg: z.number().min(0.3).max(6.0, 'Birth weight must be between 0.3 and 6.0 kg'),
  currentWeightKg: z.number().min(0.3).max(6.0, 'Current weight must be between 0.3 and 6.0 kg'),
  targetTotalFluidMlPerKgDay: z.number().min(40).max(220, 'Target fluid must be between 40 and 220 mL/kg/day'),
  enteralIntakeMlDay: z.number().min(0).default(0.0),
  dextrosePercent: z.number().min(5).max(30, 'Dextrose % must be between 5 and 30'),
  aminoAcidSolutionType: z.enum(['trophamine_6', 'trophamine_10', 'primene_10', 'aminoven_infant_10']),
  aminoAcidGPerKgDay: z.number().min(0.5).max(4.5, 'Amino acid must be between 0.5 and 4.5 g/kg/day'),
  lipidEmulsionType: z.enum(['intralipid_20', 'smoflipid_20', 'lipofundin_20']),
  lipidGPerKgDay: z.number().min(0.0).max(4.0, 'Lipid must be between 0 and 4.0 g/kg/day'),
  lipidInfusionHours: z.number().min(12).max(24).default(24.0),
  sodiumMeqPerKgDay: z.number().min(0).max(10).default(0.0),
  potassiumMeqPerKgDay: z.number().min(0).max(6).default(0.0),
  calciumGluconateMlPerKgDay: z.number().min(0).max(10).default(0.0),
  magnesiumSulfateMlDay: z.number().min(0).max(5).default(0.0),
  phosphateMmolPerKgDay: z.number().min(0).max(4).default(0.0),
  heparinUnitsPerMl: z.number().min(0).max(2).default(0.5),
  multivitaminMviMlDay: z.number().min(0).max(5).default(1.5),
  notes: z.string().max(1000).nullable().optional(),
});

export const nicuTpnLabSchema = z.object({
  monitoringDatetime: z.string().min(1, 'Monitoring datetime is required'),
  bloodGlucoseMgDl: z.number().min(10).max(800, 'Blood glucose required'),
  serumSodiumMeqL: z.number().nullable().optional(),
  serumPotassiumMeqL: z.number().nullable().optional(),
  serumCalciumMgDl: z.number().nullable().optional(),
  serumTriglyceridesMgDl: z.number().nullable().optional(),
  serumUreaMgDl: z.number().nullable().optional(),
  serumCreatinineMgDl: z.number().nullable().optional(),
  directBilirubinMgDl: z.number().nullable().optional(),
  girAdjustedFlag: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNicuTpnRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List TPN prescriptions
  app.get('/api/nicu-tpn/prescriptions', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT p.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as prescribed_by_name,
             v.full_name as verified_by_name
      FROM nicu_tpn_prescriptions p
      JOIN patients pat ON p.patient_id = pat.id
      JOIN users u ON p.prescribed_by_id = u.id
      LEFT JOIN users v ON p.verified_by_pharmacist_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND p.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.prescription_date DESC, p.id DESC';

    const prescriptions = ctx.db.prepare(query).all(...params);
    return reply.send({ prescriptions });
  });

  // 2. Create TPN Prescription
  app.post('/api/nicu-tpn/prescriptions', async (req, reply) => {
    const user = assertCanManageTpn(req);
    const body = parse(nicuTpnPrescriptionSchema, req.body);

    const calcInput: NicuTpnCalculationInput = {
      currentWeightKg: body.currentWeightKg,
      birthWeightKg: body.birthWeightKg,
      dayOfLife: body.dayOfLife,
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? undefined,
      targetTotalFluidMlPerKgDay: body.targetTotalFluidMlPerKgDay,
      enteralIntakeMlDay: body.enteralIntakeMlDay,
      dextrosePercent: body.dextrosePercent,
      aminoAcidGPerKgDay: body.aminoAcidGPerKgDay,
      aminoAcidSolutionType: body.aminoAcidSolutionType,
      lipidGPerKgDay: body.lipidGPerKgDay,
      lipidEmulsionType: body.lipidEmulsionType,
      sodiumMeqPerKgDay: body.sodiumMeqPerKgDay,
      potassiumMeqPerKgDay: body.potassiumMeqPerKgDay,
      calciumGluconateMlPerKgDay: body.calciumGluconateMlPerKgDay,
      magnesiumSulfateMlDay: body.magnesiumSulfateMlDay,
      phosphateMmolPerKgDay: body.phosphateMmolPerKgDay,
      heparinUnitsPerMl: body.heparinUnitsPerMl,
      multivitaminMviMlDay: body.multivitaminMviMlDay,
    };

    const calcResult = calculateNicuTpn(calcInput);
    const dateCode = (body.prescriptionDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const prescriptionCode = `TPN-${dateCode}-${randSuffix}`;

    const stmt = ctx.db.prepare(`
      INSERT INTO nicu_tpn_prescriptions (
        patient_id, admission_id, prescription_code, prescription_date, day_of_life,
        gestational_age_weeks, birth_weight_kg, current_weight_kg, target_total_fluid_ml_per_kg_day,
        enteral_intake_ml_day, parenteral_fluid_ml_day, dextrose_percent, glucose_infusion_rate_gir,
        dextrose_volume_ml, amino_acid_solution_type, amino_acid_g_per_kg_day, amino_acid_volume_ml,
        lipid_emulsion_type, lipid_g_per_kg_day, lipid_volume_ml, lipid_infusion_hours,
        sodium_meq_per_kg_day, potassium_meq_per_kg_day, calcium_gluconate_ml_per_kg_day,
        magnesium_sulfate_ml_day, phosphate_mmol_per_kg_day, heparin_units_per_ml,
        multivitamin_mvi_ml_day, total_calories_kcal_day, calories_per_kg_day,
        non_protein_calorie_nitrogen_ratio, total_osmolarity_mosm_l, route_category,
        status, prescribed_by_id, notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        'active', ?, ?
      )
    `);

    const result = stmt.run(
      body.patientId,
      body.admissionId ?? null,
      prescriptionCode,
      body.prescriptionDate,
      body.dayOfLife,
      body.gestationalAgeWeeks ?? null,
      body.birthWeightKg,
      body.currentWeightKg,
      body.targetTotalFluidMlPerKgDay,
      body.enteralIntakeMlDay,
      calcResult.parenteralFluidMlDay,
      body.dextrosePercent,
      calcResult.glucoseInfusionRateGir,
      calcResult.dextroseVolumeMl,
      body.aminoAcidSolutionType,
      body.aminoAcidGPerKgDay,
      calcResult.aminoAcidVolumeMl,
      body.lipidEmulsionType,
      body.lipidGPerKgDay,
      calcResult.lipidVolumeMl,
      body.lipidInfusionHours,
      body.sodiumMeqPerKgDay,
      body.potassiumMeqPerKgDay,
      body.calciumGluconateMlPerKgDay,
      body.magnesiumSulfateMlDay,
      body.phosphateMmolPerKgDay,
      body.heparinUnitsPerMl,
      body.multivitaminMviMlDay,
      calcResult.totalCaloriesKcalDay,
      calcResult.caloriesPerKgDay,
      calcResult.nonProteinCalorieToNitrogenRatio,
      calcResult.totalOsmolarityMOsmL,
      calcResult.recommendedRouteCategory,
      user.id,
      body.notes ?? null
    );

    const inserted = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as prescribed_by_name
         FROM nicu_tpn_prescriptions p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN users u ON p.prescribed_by_id = u.id
         WHERE p.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    audit(ctx.db, {
      actorId: user.id,
      action: 'nicu_tpn.prescription_create',
      entity: 'nicu_tpn_prescriptions',
      entityId: Number(result.lastInsertRowid),
      detail: {
        prescriptionCode,
        patientId: body.patientId,
        weightKg: body.currentWeightKg,
        osmolarity: calcResult.totalOsmolarityMOsmL,
        routeCategory: calcResult.recommendedRouteCategory,
      },
    });

    return reply.status(201).send({ prescription: inserted, calculation: calcResult });
  });

  // 3. Get single TPN prescription with lab logs
  app.get('/api/nicu-tpn/prescriptions/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const prescription = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as prescribed_by_name,
                v.full_name as verified_by_name
         FROM nicu_tpn_prescriptions p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN users u ON p.prescribed_by_id = u.id
         LEFT JOIN users v ON p.verified_by_pharmacist_id = v.id
         WHERE p.id = ?`
      )
      .get(Number(id));

    if (!prescription) {
      throw notFound('NICU TPN prescription not found');
    }

    const labs = ctx.db
      .prepare(
        `SELECT l.*, u.full_name as logged_by_name
         FROM nicu_tpn_lab_monitorings l
         JOIN users u ON l.logged_by_id = u.id
         WHERE l.tpn_prescription_id = ?
         ORDER BY l.monitoring_datetime DESC`
      )
      .all(Number(id));

    return reply.send({ prescription, labs });
  });

  // 4. Update TPN Prescription Status / Compounding verification
  app.put('/api/nicu-tpn/prescriptions/:id/status', async (req, reply) => {
    const user = assertCanManageTpn(req);
    const { id } = req.params as { id: string };
    const schema = z.object({
      status: z.enum(['active', 'compounded', 'discontinued', 'completed']),
    });
    const body = parse(schema, req.body);

    const existing = ctx.db.prepare('SELECT id, prescription_code FROM nicu_tpn_prescriptions WHERE id = ?').get(Number(id)) as
      | { id: number; prescription_code: string }
      | undefined;
    if (!existing) {
      throw notFound('NICU TPN prescription not found');
    }

    if (body.status === 'compounded') {
      ctx.db
        .prepare(
          `UPDATE nicu_tpn_prescriptions
           SET status = ?, verified_by_pharmacist_id = ?, compounded_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .run(body.status, user.id, Number(id));
    } else {
      ctx.db
        .prepare('UPDATE nicu_tpn_prescriptions SET status = ? WHERE id = ?')
        .run(body.status, Number(id));
    }

    audit(ctx.db, {
      actorId: user.id,
      action: 'nicu_tpn.status_update',
      entity: 'nicu_tpn_prescriptions',
      entityId: Number(id),
      detail: { prescriptionCode: existing.prescription_code, newStatus: body.status },
    });

    const updated = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                u.full_name as prescribed_by_name,
                v.full_name as verified_by_name
         FROM nicu_tpn_prescriptions p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN users u ON p.prescribed_by_id = u.id
         LEFT JOIN users v ON p.verified_by_pharmacist_id = v.id
         WHERE p.id = ?`
      )
      .get(Number(id));

    return reply.send({ prescription: updated });
  });

  // 5. Delete TPN Prescription
  app.delete('/api/nicu-tpn/prescriptions/:id', async (req, reply) => {
    const user = assertCanManageTpn(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, prescription_code FROM nicu_tpn_prescriptions WHERE id = ?').get(Number(id)) as
      | { id: number; prescription_code: string }
      | undefined;
    if (!existing) {
      throw notFound('NICU TPN prescription not found');
    }

    ctx.db.prepare('DELETE FROM nicu_tpn_prescriptions WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'nicu_tpn.prescription_delete',
      entity: 'nicu_tpn_prescriptions',
      entityId: Number(id),
      detail: { prescriptionCode: existing.prescription_code },
    });

    return reply.send({ success: true, message: 'NICU TPN prescription deleted' });
  });

  // 6. Log bedside glucose and lab monitoring
  app.post('/api/nicu-tpn/prescriptions/:id/labs', async (req, reply) => {
    const user = assertCanManageTpn(req);
    const { id } = req.params as { id: string };
    const body = parse(nicuTpnLabSchema, req.body);

    const prescription = ctx.db.prepare('SELECT id, prescription_code FROM nicu_tpn_prescriptions WHERE id = ?').get(Number(id)) as
      | { id: number; prescription_code: string }
      | undefined;
    if (!prescription) {
      throw notFound('NICU TPN prescription not found');
    }

    const stmt = ctx.db.prepare(`
      INSERT INTO nicu_tpn_lab_monitorings (
        tpn_prescription_id, monitoring_datetime, blood_glucose_mg_dl, serum_sodium_meq_l,
        serum_potassium_meq_l, serum_calcium_mg_dl, serum_triglycerides_mg_dl,
        serum_urea_mg_dl, serum_creatinine_mg_dl, direct_bilirubin_mg_dl,
        gir_adjusted_flag, logged_by_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      Number(id),
      body.monitoringDatetime,
      body.bloodGlucoseMgDl,
      body.serumSodiumMeqL ?? null,
      body.serumPotassiumMeqL ?? null,
      body.serumCalciumMgDl ?? null,
      body.serumTriglyceridesMgDl ?? null,
      body.serumUreaMgDl ?? null,
      body.serumCreatinineMgDl ?? null,
      body.directBilirubinMgDl ?? null,
      body.girAdjustedFlag ? 1 : 0,
      user.id,
      body.notes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'nicu_tpn.lab_log',
      entity: 'nicu_tpn_lab_monitorings',
      entityId: Number(result.lastInsertRowid),
      detail: {
        tpnPrescriptionId: Number(id),
        glucose: body.bloodGlucoseMgDl,
        girAdjusted: body.girAdjustedFlag,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT l.*, u.full_name as logged_by_name
         FROM nicu_tpn_lab_monitorings l
         JOIN users u ON l.logged_by_id = u.id
         WHERE l.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ lab: inserted });
  });

  // 7. Delete lab log
  app.delete('/api/nicu-tpn/labs/:labId', async (req, reply) => {
    const user = assertCanManageTpn(req);
    const { labId } = req.params as { labId: string };

    const lab = ctx.db.prepare('SELECT id, tpn_prescription_id FROM nicu_tpn_lab_monitorings WHERE id = ?').get(Number(labId)) as
      | { id: number; tpn_prescription_id: number }
      | undefined;
    if (!lab) {
      throw notFound('Lab monitoring log not found');
    }

    ctx.db.prepare('DELETE FROM nicu_tpn_lab_monitorings WHERE id = ?').run(Number(labId));

    audit(ctx.db, {
      actorId: user.id,
      action: 'nicu_tpn.lab_delete',
      entity: 'nicu_tpn_lab_monitorings',
      entityId: Number(labId),
      detail: { tpnPrescriptionId: lab.tpn_prescription_id },
    });

    return reply.send({ success: true, message: 'Lab monitoring record deleted' });
  });

  // 8. Print order sheet audit
  app.post('/api/nicu-tpn/prescriptions/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const prescription = ctx.db.prepare('SELECT id, prescription_code FROM nicu_tpn_prescriptions WHERE id = ?').get(Number(id)) as
      | { id: number; prescription_code: string }
      | undefined;
    if (!prescription) {
      throw notFound('NICU TPN prescription not found');
    }

    audit(ctx.db, {
      actorId: user.id,
      action: 'nicu_tpn.print',
      entity: 'nicu_tpn_prescriptions',
      entityId: Number(id),
      detail: { prescriptionCode: prescription.prescription_code },
    });

    return reply.send({ success: true, message: 'NICU TPN compounding order print audited' });
  });
}
