import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';

const BloodGroupSchema = z.enum([
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN',
]);

const UrgencySchema = z.enum([
  'ROUTINE', 'URGENT_WITHIN_2HR', 'STAT_EMERGENCY_UNMATCHED',
]);

const ComponentSchema = z.enum([
  'PRBC', 'FFP', 'PLATELET_RDP', 'PLATELET_SDP', 'CRYOPRECIPITATE', 'WHOLE_BLOOD',
]);

const RequisitionCreateSchema = z.object({
  patientId: z.number().int().positive(),
  admissionId: z.number().int().positive().optional().nullable(),
  otScheduleId: z.number().int().positive().optional().nullable(),
  bloodGroupAbo: BloodGroupSchema.default('UNKNOWN'),
  urgency: UrgencySchema.default('ROUTINE'),
  clinicalIndication: z.string().min(2),
  prbcUnits: z.number().int().min(0).default(0),
  ffpUnits: z.number().int().min(0).default(0),
  plateletUnits: z.number().int().min(0).default(0),
  cryoprecipitateUnits: z.number().int().min(0).default(0),
  wholeBloodUnits: z.number().int().min(0).default(0),
  specialRequirements: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const RequisitionStatusSchema = z.object({
  status: z.enum([
    'REQUESTED', 'SAMPLE_RECEIVED', 'CROSSMATCHED', 'ISSUED', 'PARTIALLY_TRANSFUSED', 'COMPLETED', 'CANCELLED',
  ]),
});

const MtpActivateSchema = z.object({
  patientId: z.number().int().positive(),
  admissionId: z.number().int().positive().optional().nullable(),
  otScheduleId: z.number().int().positive().optional().nullable(),
  triggerReason: z.enum([
    'PPH_ATONY', 'PLACENTA_ACCRETA_SPECTRUM', 'UTERINE_RUPTURE', 'SURGICAL_TRAUMA', 'ABRUPTIO_PLACENTAE_DIC', 'ECTOPIC_HEMORRHAGE', 'OTHER',
  ]),
  baselineShockIndex: z.number().min(0).max(10).optional().nullable(),
  baselineEstimatedBloodLossMl: z.number().int().min(0).default(1000),
});

const MtpRoundSchema = z.object({
  roundNumber: z.number().int().positive(),
  roundStartTime: z.string().min(4),
  prbcIssued: z.number().int().min(0).default(0),
  prbcTransfused: z.number().int().min(0).default(0),
  ffpIssued: z.number().int().min(0).default(0),
  ffpTransfused: z.number().int().min(0).default(0),
  plateletsIssued: z.number().int().min(0).default(0),
  plateletsTransfused: z.number().int().min(0).default(0),
  cryoIssued: z.number().int().min(0).default(0),
  cryoTransfused: z.number().int().min(0).default(0),
  tempCelsius: z.number().min(25).max(45).optional().nullable(),
  heartRate: z.number().int().min(20).max(250).optional().nullable(),
  bloodPressureSys: z.number().int().min(30).max(300).optional().nullable(),
  bloodPressureDia: z.number().int().min(10).max(200).optional().nullable(),
  spo2: z.number().int().min(40).max(100).optional().nullable(),
  hbGDl: z.number().min(1).max(25).optional().nullable(),
  plateletsKUl: z.number().int().min(1).max(1500).optional().nullable(),
  inr: z.number().min(0.5).max(20).optional().nullable(),
  fibrinogenMgDl: z.number().min(10).max(1000).optional().nullable(),
  ionizedCalciumMmolL: z.number().min(0.2).max(3).optional().nullable(),
  phAbg: z.number().min(6.5).max(8.0).optional().nullable(),
  lactateMmolL: z.number().min(0.1).max(30).optional().nullable(),
  clinicalNotes: z.string().optional().nullable(),
});

const MtpDeactivateSchema = z.object({
  outcomeSummary: z.string().min(3),
  deactivatedByName: z.string().optional().nullable(),
});

const TransfusionLogSchema = z.object({
  requisitionId: z.number().int().positive().optional().nullable(),
  patientId: z.number().int().positive(),
  mtpId: z.number().int().positive().optional().nullable(),
  unitNumber: z.string().min(2),
  componentType: ComponentSchema,
  unitBloodGroup: BloodGroupSchema,
  startTime: z.string().min(4),
  twoNurseVerifier1: z.string().min(2),
  twoNurseVerifier2: z.string().min(2),
  preVitalsTemp: z.number().min(25).max(45).optional().nullable(),
  preVitalsHr: z.number().int().min(20).max(250).optional().nullable(),
  preVitalsBp: z.string().optional().nullable(),
  vitals15mTemp: z.number().min(25).max(45).optional().nullable(),
  vitals15mHr: z.number().int().min(20).max(250).optional().nullable(),
  vitals15mBp: z.string().optional().nullable(),
});

const TransfusionReactionSchema = z.object({
  reactionType: z.enum([
    'FEBRILE_NON_HEMOLYTIC', 'ALLERGIC_URTICARIAL', 'ACUTE_HEMOLYTIC', 'TRALI', 'TACO', 'BACTERIAL_SEPSIS', 'OTHER',
  ]),
  reactionDetails: z.string().min(3),
  actionTaken: z.string().min(3),
  endTime: z.string().optional().nullable(),
  postVitalsTemp: z.number().min(25).max(45).optional().nullable(),
  postVitalsHr: z.number().int().min(20).max(250).optional().nullable(),
  postVitalsBp: z.string().optional().nullable(),
});

export function registerBloodBankRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List Blood Requisitions
  app.get('/api/blood-requisitions', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');

    const q = req.query as {
      patientId?: string;
      status?: string;
      urgency?: string;
    };

    let sql = `
      SELECT 
        r.*,
        p.patient_number as uhid,
        p.full_name as patient_name,
        p.estimated_age_years as patient_age,
        p.phone as patient_phone,
        u.full_name as doctor_full_name
      FROM blood_requisitions r
      JOIN patients p ON r.patient_id = p.id
      JOIN users u ON r.requesting_doctor_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q.patientId) {
      sql += ' AND r.patient_id = ?';
      params.push(Number.parseInt(q.patientId, 10));
    }
    if (q.status) {
      sql += ' AND r.status = ?';
      params.push(q.status);
    }
    if (q.urgency) {
      sql += ' AND r.urgency = ?';
      params.push(q.urgency);
    }

    sql += ' ORDER BY r.created_at DESC';

    const requisitions = ctx.db.prepare(sql).all(...params);
    return { requisitions };
  });

  // 2. Create Blood Requisition
  app.post('/api/blood-requisitions', async (req: FastifyRequest) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot request blood products');
    }

    const parsed = RequisitionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const year = new Date().getFullYear();
    const countRow: any = ctx.db.prepare('SELECT count(*) as count FROM blood_requisitions').get();
    const seq = (countRow?.count || 0) + 1;
    const reqNumber = `REQ-${year}-${String(seq).padStart(4, '0')}`;

    let reqId = 0;
    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(`
          INSERT INTO blood_requisitions (
            patient_id, admission_id, ot_schedule_id, requisition_number,
            blood_group_abo, urgency, clinical_indication,
            prbc_units, ffp_units, platelet_units, cryoprecipitate_units, whole_blood_units,
            special_requirements, status, requesting_doctor_id, requesting_doctor_name,
            notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?)
        `)
        .run(
          data.patientId,
          data.admissionId ?? null,
          data.otScheduleId ?? null,
          reqNumber,
          data.bloodGroupAbo,
          data.urgency,
          data.clinicalIndication,
          data.prbcUnits,
          data.ffpUnits,
          data.plateletUnits,
          data.cryoprecipitateUnits,
          data.wholeBloodUnits,
          data.specialRequirements ?? null,
          user.id,
          user.fullName,
          data.notes ?? null,
          nowIso(),
          nowIso(),
        );

      reqId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.requisition_create',
        entity: 'blood_requisitions',
        entityId: reqId,
        detail: {
          requisitionNumber: reqNumber,
          patientId: data.patientId,
          urgency: data.urgency,
          prbcUnits: data.prbcUnits,
          ffpUnits: data.ffpUnits,
        },
      });
    });

    const record = ctx.db.prepare('SELECT * FROM blood_requisitions WHERE id = ?').get(reqId);
    return record;
  });

  // 3. Get Blood Requisition by ID
  app.get<{ Params: { id: string } }>('/api/blood-requisitions/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid requisition ID');

    const record: any = ctx.db
      .prepare(`
        SELECT 
          r.*,
          p.patient_number as uhid,
          p.full_name as patient_name,
          p.estimated_age_years as patient_age,
          p.phone as patient_phone,
          u.full_name as doctor_full_name
        FROM blood_requisitions r
        JOIN patients p ON r.patient_id = p.id
        JOIN users u ON r.requesting_doctor_id = u.id
        WHERE r.id = ?
      `)
      .get(id);

    if (!record) throw notFound('Blood requisition not found');

    const transfusions = ctx.db
      .prepare('SELECT * FROM blood_transfusion_administrations WHERE requisition_id = ? ORDER BY start_time DESC')
      .all(id);

    return { requisition: record, transfusions };
  });

  // 4. Update Requisition Status
  app.patch<{ Params: { id: string } }>('/api/blood-requisitions/:id/status', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot update blood requisition status');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid requisition ID');

    const existing: any = ctx.db.prepare('SELECT * FROM blood_requisitions WHERE id = ?').get(id);
    if (!existing) throw notFound('Blood requisition not found');

    const parsed = RequisitionStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const { status } = parsed.data;
    tx(ctx.db, () => {
      ctx.db
        .prepare('UPDATE blood_requisitions SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, nowIso(), id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.requisition_update',
        entity: 'blood_requisitions',
        entityId: id,
        detail: { status, requisitionNumber: existing.requisition_number },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM blood_requisitions WHERE id = ?').get(id);
    return updated;
  });

  // 5. Delete Blood Requisition (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/blood-requisitions/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only doctors can delete blood requisitions');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid requisition ID');

    const existing: any = ctx.db.prepare('SELECT * FROM blood_requisitions WHERE id = ?').get(id);
    if (!existing) throw notFound('Blood requisition not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM blood_requisitions WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.requisition_delete',
        entity: 'blood_requisitions',
        entityId: id,
        detail: { requisitionNumber: existing.requisition_number, patientId: existing.patient_id },
      });
    });

    return { success: true, message: 'Requisition deleted' };
  });

  // 6. Activate Massive Transfusion Protocol (MTP)
  app.post('/api/mtp/activate', async (req: FastifyRequest) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot activate Massive Transfusion Protocol');
    }

    const parsed = MtpActivateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const year = new Date().getFullYear();
    const countRow: any = ctx.db.prepare('SELECT count(*) as count FROM massive_transfusion_activations').get();
    const seq = (countRow?.count || 0) + 1;
    const mtpCode = `MTP-${year}-${String(seq).padStart(4, '0')}`;
    const now = nowIso();

    let mtpId = 0;
    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(`
          INSERT INTO massive_transfusion_activations (
            patient_id, admission_id, ot_schedule_id, mtp_code,
            activation_time, activated_by_id, activated_by_name,
            trigger_reason, baseline_shock_index, baseline_estimated_blood_loss_ml,
            current_pack_round, total_prbc_transfused, total_ffp_transfused,
            total_platelets_transfused, total_cryo_transfused, txa_given,
            calcium_gluconate_given, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 1, 0, 'ACTIVE', ?, ?)
        `)
        .run(
          data.patientId,
          data.admissionId ?? null,
          data.otScheduleId ?? null,
          mtpCode,
          now,
          user.id,
          user.fullName,
          data.triggerReason,
          data.baselineShockIndex ?? null,
          data.baselineEstimatedBloodLossMl,
          now,
          now,
        );

      mtpId = Number(res.lastInsertRowid);

      // Auto-create initial Round 1 flowsheet row
      ctx.db
        .prepare(`
          INSERT INTO mtp_flowsheet_rounds (
            mtp_id, round_number, round_start_time,
            prbc_issued, prbc_transfused, ffp_issued, ffp_transfused,
            platelets_issued, platelets_transfused, cryo_issued, cryo_transfused,
            clinical_notes, recorded_by_name, created_at
          ) VALUES (?, 1, ?, 4, 0, 4, 0, 0, 0, 0, 0, 'MTP Activated. Pack 1 (4 PRBC : 4 FFP) dispatched. TXA 1g IV ordered.', ?, ?)
        `)
        .run(mtpId, now, user.fullName, now);

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.mtp_activate',
        entity: 'massive_transfusion_activations',
        entityId: mtpId,
        detail: {
          mtpCode,
          patientId: data.patientId,
          triggerReason: data.triggerReason,
          shockIndex: data.baselineShockIndex,
        },
      });
    });

    const record = ctx.db.prepare('SELECT * FROM massive_transfusion_activations WHERE id = ?').get(mtpId);
    return record;
  });

  // 7. Get Active MTP Activations
  app.get('/api/mtp/active', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');

    const activeList = ctx.db
      .prepare(`
        SELECT 
          m.*,
          p.patient_number as uhid,
          p.full_name as patient_name,
          p.estimated_age_years as patient_age,
          p.phone as patient_phone
        FROM massive_transfusion_activations m
        JOIN patients p ON m.patient_id = p.id
        WHERE m.status = 'ACTIVE'
        ORDER BY m.activation_time DESC
      `)
      .all();

    return { activeMtps: activeList };
  });

  // 8. Get MTP Activation by ID (with full rounds)
  app.get<{ Params: { id: string } }>('/api/mtp/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid MTP ID');

    const mtp: any = ctx.db
      .prepare(`
        SELECT 
          m.*,
          p.patient_number as uhid,
          p.full_name as patient_name,
          p.estimated_age_years as patient_age,
          p.phone as patient_phone,
          u.full_name as activator_name
        FROM massive_transfusion_activations m
        JOIN patients p ON m.patient_id = p.id
        JOIN users u ON m.activated_by_id = u.id
        WHERE m.id = ?
      `)
      .get(id);

    if (!mtp) throw notFound('MTP activation record not found');

    const rounds = ctx.db
      .prepare('SELECT * FROM mtp_flowsheet_rounds WHERE mtp_id = ? ORDER BY round_number ASC')
      .all(id);

    const transfusions = ctx.db
      .prepare('SELECT * FROM blood_transfusion_administrations WHERE mtp_id = ? ORDER BY start_time DESC')
      .all(id);

    return { mtp, rounds, transfusions };
  });

  // 9. Log a New MTP Round / Resuscitation checkpoint
  app.post<{ Params: { id: string } }>('/api/mtp/:id/rounds', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot record MTP flowsheet rounds');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid MTP ID');

    const mtp: any = ctx.db.prepare('SELECT * FROM massive_transfusion_activations WHERE id = ?').get(id);
    if (!mtp) throw notFound('MTP activation record not found');

    const parsed = MtpRoundSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const d = parsed.data;
    const now = nowIso();

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          INSERT INTO mtp_flowsheet_rounds (
            mtp_id, round_number, round_start_time,
            prbc_issued, prbc_transfused, ffp_issued, ffp_transfused,
            platelets_issued, platelets_transfused, cryo_issued, cryo_transfused,
            temp_celsius, heart_rate, blood_pressure_sys, blood_pressure_dia, spo2,
            hb_g_dl, platelets_k_ul, inr, fibrinogen_mg_dl, ionized_calcium_mmol_l,
            ph_abg, lactate_mmol_l, clinical_notes, recorded_by_name, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          d.roundNumber,
          d.roundStartTime,
          d.prbcIssued,
          d.prbcTransfused,
          d.ffpIssued,
          d.ffpTransfused,
          d.plateletsIssued,
          d.plateletsTransfused,
          d.cryoIssued,
          d.cryoTransfused,
          d.tempCelsius ?? null,
          d.heartRate ?? null,
          d.bloodPressureSys ?? null,
          d.bloodPressureDia ?? null,
          d.spo2 ?? null,
          d.hbGDl ?? null,
          d.plateletsKUl ?? null,
          d.inr ?? null,
          d.fibrinogenMgDl ?? null,
          d.ionizedCalciumMmolL ?? null,
          d.phAbg ?? null,
          d.lactateMmolL ?? null,
          d.clinicalNotes ?? null,
          user.fullName,
          now,
        );

      // Recompute total components transfused for this MTP
      const totals: any = ctx.db
        .prepare(`
          SELECT 
            SUM(prbc_transfused) as total_prbc,
            SUM(ffp_transfused) as total_ffp,
            SUM(platelets_transfused) as total_platelets,
            SUM(cryo_transfused) as total_cryo,
            MAX(round_number) as max_round
          FROM mtp_flowsheet_rounds
          WHERE mtp_id = ?
        `)
        .get(id);

      ctx.db
        .prepare(`
          UPDATE massive_transfusion_activations
          SET current_pack_round = ?,
              total_prbc_transfused = ?,
              total_ffp_transfused = ?,
              total_platelets_transfused = ?,
              total_cryo_transfused = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(
          totals?.max_round || d.roundNumber,
          totals?.total_prbc || 0,
          totals?.total_ffp || 0,
          totals?.total_platelets || 0,
          totals?.total_cryo || 0,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.mtp_round_add',
        entity: 'massive_transfusion_activations',
        entityId: id,
        detail: {
          roundNumber: d.roundNumber,
          prbcTransfused: d.prbcTransfused,
          ffpTransfused: d.ffpTransfused,
        },
      });
    });

    const updatedMtp = ctx.db.prepare('SELECT * FROM massive_transfusion_activations WHERE id = ?').get(id);
    return updatedMtp;
  });

  // 10. Deactivate MTP
  app.post<{ Params: { id: string } }>('/api/mtp/:id/deactivate', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot deactivate MTP');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid MTP ID');

    const existing: any = ctx.db.prepare('SELECT * FROM massive_transfusion_activations WHERE id = ?').get(id);
    if (!existing) throw notFound('MTP activation record not found');

    const parsed = MtpDeactivateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const now = nowIso();
    const deactivator = parsed.data.deactivatedByName || user.fullName;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE massive_transfusion_activations
          SET status = 'DEACTIVATED',
              deactivation_time = ?,
              deactivated_by_name = ?,
              outcome_summary = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(now, deactivator, parsed.data.outcomeSummary, now, id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.mtp_deactivate',
        entity: 'massive_transfusion_activations',
        entityId: id,
        detail: { mtpCode: existing.mtp_code, outcomeSummary: parsed.data.outcomeSummary },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM massive_transfusion_activations WHERE id = ?').get(id);
    return updated;
  });

  // 11. List Transfusions
  app.get('/api/transfusions', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');

    const q = req.query as { patientId?: string; status?: string };
    let sql = `
      SELECT 
        t.*,
        p.patient_number as uhid,
        p.full_name as patient_name
      FROM blood_transfusion_administrations t
      JOIN patients p ON t.patient_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q.patientId) {
      sql += ' AND t.patient_id = ?';
      params.push(Number.parseInt(q.patientId, 10));
    }
    if (q.status) {
      sql += ' AND t.transfusion_status = ?';
      params.push(q.status);
    }

    sql += ' ORDER BY t.start_time DESC LIMIT 100';

    const transfusions = ctx.db.prepare(sql).all(...params);
    return { transfusions };
  });

  // 12. Log Bedside Transfusion Administration
  app.post('/api/transfusions', async (req: FastifyRequest) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot administer blood transfusions');
    }

    const parsed = TransfusionLogSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const d = parsed.data;
    const now = nowIso();
    let transId = 0;

    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(`
          INSERT INTO blood_transfusion_administrations (
            requisition_id, patient_id, mtp_id, unit_number,
            component_type, unit_blood_group, start_time,
            two_nurse_verifier_1, two_nurse_verifier_2,
            pre_vitals_temp, pre_vitals_hr, pre_vitals_bp,
            vitals_15m_temp, vitals_15m_hr, vitals_15m_bp,
            transfusion_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRANSFUSING', ?, ?)
        `)
        .run(
          d.requisitionId ?? null,
          d.patientId,
          d.mtpId ?? null,
          d.unitNumber,
          d.componentType,
          d.unitBloodGroup,
          d.startTime,
          d.twoNurseVerifier1,
          d.twoNurseVerifier2,
          d.preVitalsTemp ?? null,
          d.preVitalsHr ?? null,
          d.preVitalsBp ?? null,
          d.vitals15mTemp ?? null,
          d.vitals15mHr ?? null,
          d.vitals15mBp ?? null,
          now,
          now,
        );

      transId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.transfusion_log',
        entity: 'blood_transfusion_administrations',
        entityId: transId,
        detail: {
          unitNumber: d.unitNumber,
          componentType: d.componentType,
          patientId: d.patientId,
        },
      });
    });

    const record = ctx.db.prepare('SELECT * FROM blood_transfusion_administrations WHERE id = ?').get(transId);
    return record;
  });

  // 13. Log Transfusion Reaction
  app.post<{ Params: { id: string } }>('/api/transfusions/:id/reaction', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot report transfusion reactions');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid transfusion ID');

    const existing: any = ctx.db.prepare('SELECT * FROM blood_transfusion_administrations WHERE id = ?').get(id);
    if (!existing) throw notFound('Transfusion record not found');

    const parsed = TransfusionReactionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const d = parsed.data;
    const now = nowIso();

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE blood_transfusion_administrations
          SET adverse_reaction_observed = 1,
              reaction_type = ?,
              reaction_details = ?,
              action_taken = ?,
              end_time = ?,
              post_vitals_temp = ?,
              post_vitals_hr = ?,
              post_vitals_bp = ?,
              transfusion_status = 'STOPPED_REACTION',
              updated_at = ?
          WHERE id = ?
        `)
        .run(
          d.reactionType,
          d.reactionDetails,
          d.actionTaken,
          d.endTime || now,
          d.postVitalsTemp ?? null,
          d.postVitalsHr ?? null,
          d.postVitalsBp ?? null,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'blood_bank.transfusion_reaction',
        entity: 'blood_transfusion_administrations',
        entityId: id,
        detail: {
          reactionType: d.reactionType,
          unitNumber: existing.unit_number,
          patientId: existing.patient_id,
        },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM blood_transfusion_administrations WHERE id = ?').get(id);
    return updated;
  });

  // 14. Get Patient Blood Bank History
  app.get<{ Params: { patientId: string } }>('/api/patients/:patientId/blood-bank', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const requisitions = ctx.db
      .prepare('SELECT * FROM blood_requisitions WHERE patient_id = ? ORDER BY created_at DESC')
      .all(patientId);

    const mtpActivations = ctx.db
      .prepare('SELECT * FROM massive_transfusion_activations WHERE patient_id = ? ORDER BY activation_time DESC')
      .all(patientId);

    const transfusions = ctx.db
      .prepare('SELECT * FROM blood_transfusion_administrations WHERE patient_id = ? ORDER BY start_time DESC')
      .all(patientId);

    return { requisitions, mtpActivations, transfusions };
  });

  // 15. Audit Print MTP Dossier
  app.post<{ Params: { id: string } }>('/api/mtp/:id/audit-print', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:read_clinical')) {
      throw forbidden('Desk attenders cannot print MTP hemotherapy records');
    }

    const id = Number.parseInt(req.params.id, 10);
    audit(ctx.db, {
      actorId: user.id,
      action: 'blood_bank.print',
      entity: 'massive_transfusion_activations',
      entityId: id,
    });

    return { success: true };
  });
}
