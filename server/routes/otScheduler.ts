import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';

const OtScheduleCreateSchema = z.object({
  patientId: z.number().int().positive(),
  admissionId: z.number().int().positive().optional().nullable(),
  otRoom: z.enum(['OT_1_MAIN', 'OT_2_MATERNITY', 'OT_3_MINOR', 'LABOR_OT']).default('OT_1_MAIN'),
  scheduledDate: z.string().min(10).max(10), // YYYY-MM-DD
  scheduledStartTime: z.string().min(4).max(8), // HH:MM
  estimatedDurationMinutes: z.number().int().positive().default(60),
  procedureName: z.string().min(2),
  procedureCategory: z.enum(['OBSTETRIC', 'GYNECOLOGICAL', 'LAPAROSCOPIC', 'INFERTILITY_REPRODUCTIVE', 'PEDIATRIC_SURGERY', 'OTHER']).default('OBSTETRIC'),
  priority: z.enum(['ELECTIVE', 'URGENT', 'EMERGENCY_CAT_1']).default('ELECTIVE'),
  primarySurgeonId: z.number().int().positive(),
  assistantSurgeonName: z.string().optional().nullable(),
  anesthesiologistId: z.number().int().positive().optional().nullable(),
  scrubNurseName: z.string().optional().nullable(),
  pediatricianStandbyName: z.string().optional().nullable(),
  bloodUnitsReserved: z.number().int().min(0).default(0),
  specialEquipmentNeeded: z.string().optional().nullable(),
});

const OtScheduleUpdateSchema = z.object({
  otRoom: z.enum(['OT_1_MAIN', 'OT_2_MATERNITY', 'OT_3_MINOR', 'LABOR_OT']).optional(),
  scheduledDate: z.string().min(10).max(10).optional(),
  scheduledStartTime: z.string().min(4).max(8).optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  procedureName: z.string().min(2).optional(),
  procedureCategory: z.enum(['OBSTETRIC', 'GYNECOLOGICAL', 'LAPAROSCOPIC', 'INFERTILITY_REPRODUCTIVE', 'PEDIATRIC_SURGERY', 'OTHER']).optional(),
  priority: z.enum(['ELECTIVE', 'URGENT', 'EMERGENCY_CAT_1']).optional(),
  status: z.enum(['SCHEDULED', 'PATIENT_IN_OT', 'SURGERY_IN_PROGRESS', 'PACU_RECOVERY', 'COMPLETED', 'CANCELLED']).optional(),
  primarySurgeonId: z.number().int().positive().optional(),
  assistantSurgeonName: z.string().optional().nullable(),
  anesthesiologistId: z.number().int().positive().optional().nullable(),
  scrubNurseName: z.string().optional().nullable(),
  pediatricianStandbyName: z.string().optional().nullable(),
  bloodUnitsReserved: z.number().int().min(0).optional(),
  specialEquipmentNeeded: z.string().optional().nullable(),
  cancellationReason: z.string().optional().nullable(),
});

const PacCreateSchema = z.object({
  patientId: z.number().int().positive().optional(),
  otScheduleId: z.number().int().positive().optional().nullable(),
  evaluationDate: z.string().min(10).max(10),
  asaGrade: z.enum([
    'ASA_I', 'ASA_II', 'ASA_III', 'ASA_IV', 'ASA_V',
    'ASA_I_E', 'ASA_II_E', 'ASA_III_E', 'ASA_IV_E', 'ASA_V_E',
  ]),
  mallampatiClass: z.enum(['CLASS_I', 'CLASS_II', 'CLASS_III', 'CLASS_IV']).default('CLASS_I'),
  mouthOpeningCm: z.number().min(0.5).max(10).default(4.0),
  thyromentalDistanceCm: z.number().min(1).max(15).default(6.5),
  dentitionStatus: z.enum(['intact', 'loose_teeth', 'edentulous', 'dentures_present']).default('intact'),
  neckMobility: z.enum(['normal_full', 'restricted_extension', 'fixed_flexion']).default('normal_full'),
  npoSolidHours: z.number().int().min(0).max(48).default(8),
  npoClearLiquidHours: z.number().int().min(0).max(24).default(2),
  cardiovascularAssessment: z.string().optional().nullable(),
  respiratoryAssessment: z.string().optional().nullable(),
  airwayNotes: z.string().optional().nullable(),
  plannedAnesthesiaTechnique: z.enum(['SPINAL', 'EPIDURAL', 'CSE', 'GENERAL_ENDOTRACHEAL', 'TIVA', 'LOCAL_MAC']).default('SPINAL'),
  pacClearanceStatus: z.enum(['FIT_FOR_SURGERY', 'FIT_WITH_HIGH_RISK', 'PROCEED_EMERGENCY_LIFE_SAVING', 'DEFERRED_PENDING_OPTIMIZATION']).default('FIT_FOR_SURGERY'),
  highRiskWarnings: z.string().optional().nullable(),
  preopOrdersInstructions: z.string().optional().nullable(),
  bloodProductsCrossmatched: z.string().optional().nullable(),
});

const WhoChecklistUpdateSchema = z.object({
  signinCompleted: z.boolean().optional(),
  signinPatientConfirmed: z.boolean().optional(),
  signinSiteMarked: z.boolean().optional(),
  signinAnesthesiaSafetyCheck: z.boolean().optional(),
  signinPulseOximeterFunctioning: z.boolean().optional(),
  signinKnownAllergy: z.boolean().optional(),
  signinDifficultAirwayRisk: z.boolean().optional(),
  signinBloodLossRisk: z.boolean().optional(),
  signinNurseAnesthetistName: z.string().optional().nullable(),
  timeoutCompleted: z.boolean().optional(),
  timeoutTeamIntroduced: z.boolean().optional(),
  timeoutVerbalConfirmation: z.boolean().optional(),
  timeoutSurgeonReview: z.string().optional().nullable(),
  timeoutAnesthetistReview: z.string().optional().nullable(),
  timeoutNursingSterilityConfirmed: z.boolean().optional(),
  timeoutAntibioticProphylaxisGiven: z.boolean().optional(),
  timeoutAntibioticNameDose: z.string().optional().nullable(),
  timeoutImagingDisplayed: z.boolean().optional(),
  timeoutCompletedByName: z.string().optional().nullable(),
  signoutCompleted: z.boolean().optional(),
  signoutProcedureRecordedName: z.string().optional().nullable(),
  signoutCountsCorrect: z.boolean().optional(),
  signoutSpecimenLabeled: z.boolean().optional(),
  signoutEquipmentProblems: z.string().optional().nullable(),
  signoutRecoveryConcerns: z.string().optional().nullable(),
  signoutCompletedByName: z.string().optional().nullable(),
});

export function registerOtSchedulerRoutes(app: FastifyInstance, ctx: Ctx) {
  // Staff list for OT booking (Surgeons, Anesthesiologists, Nurses)
  app.get('/api/ot-schedules/staff', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const staff = ctx.db
      .prepare('SELECT id, full_name as fullName, username, role FROM users WHERE active = 1 ORDER BY full_name COLLATE NOCASE')
      .all();
    return { staff };
  });

  // 1. List OT Schedules
  app.get('/api/ot-schedules', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');

    const q = req.query as {
      date?: string;
      otRoom?: string;
      status?: string;
      patientId?: string;
    };

    let sql = `
      SELECT 
        s.*,
        p.patient_number as uhid,
        p.full_name as patient_name,
        p.estimated_age_years as patient_age,
        p.phone as patient_phone,
        doc.full_name as primary_surgeon_full_name,
        anes.full_name as anesthesiologist_full_name,
        pac.asa_grade,
        pac.pac_clearance_status,
        who.signin_completed,
        who.timeout_completed,
        who.signout_completed
      FROM ot_schedules s
      JOIN patients p ON s.patient_id = p.id
      JOIN users doc ON s.primary_surgeon_id = doc.id
      LEFT JOIN users anes ON s.anesthesiologist_id = anes.id
      LEFT JOIN pre_anesthesia_clearances pac ON pac.ot_schedule_id = s.id
      LEFT JOIN who_surgical_safety_checklists who ON who.ot_schedule_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q.date) {
      sql += ' AND s.scheduled_date = ?';
      params.push(q.date);
    }
    if (q.otRoom) {
      sql += ' AND s.ot_room = ?';
      params.push(q.otRoom);
    }
    if (q.status) {
      sql += ' AND s.status = ?';
      params.push(q.status);
    }
    if (q.patientId) {
      sql += ' AND s.patient_id = ?';
      params.push(Number.parseInt(q.patientId, 10));
    }

    sql += ' ORDER BY s.scheduled_date ASC, s.scheduled_start_time ASC';

    const schedules = ctx.db.prepare(sql).all(...params);
    return { schedules };
  });

  // 2. Create OT Schedule
  app.post('/api/ot-schedules', async (req: FastifyRequest) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot schedule surgical operations');
    }

    const parsed = OtScheduleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const surgeon: any = ctx.db.prepare('SELECT full_name FROM users WHERE id = ?').get(data.primarySurgeonId);
    const surgeonName = surgeon?.full_name || 'Primary Surgeon';

    let anesthesiologistName: string | null = null;
    if (data.anesthesiologistId) {
      const anes: any = ctx.db.prepare('SELECT full_name FROM users WHERE id = ?').get(data.anesthesiologistId);
      anesthesiologistName = anes?.full_name ?? null;
    }

    let scheduleId: number = 0;
    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(`
          INSERT INTO ot_schedules (
            patient_id, admission_id, ot_room, scheduled_date, scheduled_start_time,
            estimated_duration_minutes, procedure_name, procedure_category, priority,
            status, primary_surgeon_id, primary_surgeon_name, assistant_surgeon_name,
            anesthesiologist_id, anesthesiologist_name, scrub_nurse_name,
            pediatrician_standby_name, blood_units_reserved, special_equipment_needed,
            created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.patientId,
          data.admissionId ?? null,
          data.otRoom,
          data.scheduledDate,
          data.scheduledStartTime,
          data.estimatedDurationMinutes,
          data.procedureName,
          data.procedureCategory,
          data.priority,
          data.primarySurgeonId,
          surgeonName,
          data.assistantSurgeonName ?? null,
          data.anesthesiologistId ?? null,
          anesthesiologistName,
          data.scrubNurseName ?? null,
          data.pediatricianStandbyName ?? null,
          data.bloodUnitsReserved,
          data.specialEquipmentNeeded ?? null,
          user.id,
        );

      scheduleId = Number(res.lastInsertRowid);

      // Auto-create blank WHO surgical safety checklist row
      ctx.db
        .prepare(`
          INSERT INTO who_surgical_safety_checklists (
            ot_schedule_id, patient_id
          ) VALUES (?, ?)
        `)
        .run(scheduleId, data.patientId);

      audit(ctx.db, {
        actorId: user.id,
        action: 'ot.schedule_create',
        entity: 'ot_schedules',
        entityId: scheduleId,
        detail: {
          patientId: data.patientId,
          otRoom: data.otRoom,
          scheduledDate: data.scheduledDate,
          procedureName: data.procedureName,
          priority: data.priority,
        },
      });
    });

    const record = ctx.db.prepare('SELECT * FROM ot_schedules WHERE id = ?').get(scheduleId);
    return record;
  });

  // 3. Get OT Schedule by ID
  app.get<{ Params: { id: string } }>('/api/ot-schedules/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid schedule ID');

    const schedule: any = ctx.db
      .prepare(`
        SELECT 
          s.*,
          p.patient_number as uhid,
          p.full_name as patient_name,
          p.estimated_age_years as patient_age,
          p.phone as patient_phone,
          p.address as patient_address,
          p.gravida,
          p.para,
          p.last_menstrual_period as lastMenstrualPeriod,
          doc.full_name as primary_surgeon_full_name,
          anes.full_name as anesthesiologist_full_name
        FROM ot_schedules s
        JOIN patients p ON s.patient_id = p.id
        JOIN users doc ON s.primary_surgeon_id = doc.id
        LEFT JOIN users anes ON s.anesthesiologist_id = anes.id
        WHERE s.id = ?
      `)
      .get(id);

    if (!schedule) throw notFound('OT Schedule not found');

    let pac = ctx.db
      .prepare('SELECT * FROM pre_anesthesia_clearances WHERE ot_schedule_id = ? ORDER BY evaluation_date DESC, id DESC LIMIT 1')
      .get(id);

    if (!pac) {
      pac = ctx.db
        .prepare('SELECT * FROM pre_anesthesia_clearances WHERE patient_id = ? ORDER BY evaluation_date DESC, id DESC LIMIT 1')
        .get(schedule.patient_id);
    }

    const whoChecklist = ctx.db
      .prepare('SELECT * FROM who_surgical_safety_checklists WHERE ot_schedule_id = ?')
      .get(id);

    return {
      schedule,
      pac: pac ?? null,
      whoChecklist: whoChecklist ?? null,
    };
  });

  // 4. Update OT Schedule
  app.put<{ Params: { id: string } }>('/api/ot-schedules/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot update surgical schedules');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid schedule ID');

    const existing: any = ctx.db.prepare('SELECT * FROM ot_schedules WHERE id = ?').get(id);
    if (!existing) throw notFound('OT Schedule not found');

    const parsed = OtScheduleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    let surgeonName = existing.primary_surgeon_name;
    if (data.primarySurgeonId && data.primarySurgeonId !== existing.primary_surgeon_id) {
      const doc: any = ctx.db.prepare('SELECT full_name FROM users WHERE id = ?').get(data.primarySurgeonId);
      if (doc) surgeonName = doc.full_name;
    }

    let anesName = existing.anesthesiologist_name;
    if (data.anesthesiologistId !== undefined) {
      if (data.anesthesiologistId) {
        const anes: any = ctx.db.prepare('SELECT full_name FROM users WHERE id = ?').get(data.anesthesiologistId);
        anesName = anes ? anes.full_name : null;
      } else {
        anesName = null;
      }
    }

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE ot_schedules
          SET ot_room = ?,
              scheduled_date = ?,
              scheduled_start_time = ?,
              estimated_duration_minutes = ?,
              procedure_name = ?,
              procedure_category = ?,
              priority = ?,
              status = ?,
              primary_surgeon_id = ?,
              primary_surgeon_name = ?,
              assistant_surgeon_name = ?,
              anesthesiologist_id = ?,
              anesthesiologist_name = ?,
              scrub_nurse_name = ?,
              pediatrician_standby_name = ?,
              blood_units_reserved = ?,
              special_equipment_needed = ?,
              cancellation_reason = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(
          data.otRoom ?? existing.ot_room,
          data.scheduledDate ?? existing.scheduled_date,
          data.scheduledStartTime ?? existing.scheduled_start_time,
          data.estimatedDurationMinutes ?? existing.estimated_duration_minutes,
          data.procedureName ?? existing.procedure_name,
          data.procedureCategory ?? existing.procedure_category,
          data.priority ?? existing.priority,
          data.status ?? existing.status,
          data.primarySurgeonId ?? existing.primary_surgeon_id,
          surgeonName,
          data.assistantSurgeonName !== undefined ? data.assistantSurgeonName : existing.assistant_surgeon_name,
          data.anesthesiologistId !== undefined ? data.anesthesiologistId : existing.anesthesiologist_id,
          anesName,
          data.scrubNurseName !== undefined ? data.scrubNurseName : existing.scrub_nurse_name,
          data.pediatricianStandbyName !== undefined ? data.pediatricianStandbyName : existing.pediatrician_standby_name,
          data.bloodUnitsReserved !== undefined ? data.bloodUnitsReserved : existing.blood_units_reserved,
          data.specialEquipmentNeeded !== undefined ? data.specialEquipmentNeeded : existing.special_equipment_needed,
          data.cancellationReason !== undefined ? data.cancellationReason : existing.cancellation_reason,
          nowIso(),
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'ot.schedule_update',
        entity: 'ot_schedules',
        entityId: id,
        detail: { status: data.status ?? existing.status, otRoom: data.otRoom ?? existing.ot_room },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM ot_schedules WHERE id = ?').get(id);
    return updated;
  });

  // 5. Delete OT Schedule (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/ot-schedules/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only doctors can cancel and delete surgical bookings');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid schedule ID');

    const existing: any = ctx.db.prepare('SELECT * FROM ot_schedules WHERE id = ?').get(id);
    if (!existing) throw notFound('OT Schedule not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM ot_schedules WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'ot.schedule_delete',
        entity: 'ot_schedules',
        entityId: id,
        detail: { procedureName: existing.procedure_name, patientId: existing.patient_id },
      });
    });

    return { success: true, message: 'OT Schedule deleted' };
  });

  // 6. Update WHO Surgical Safety Checklist
  app.post<{ Params: { id: string } }>('/api/ot-schedules/:id/who-checklist', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk attenders cannot update surgical safety checklists');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid schedule ID');

    const schedule: any = ctx.db.prepare('SELECT * FROM ot_schedules WHERE id = ?').get(id);
    if (!schedule) throw notFound('OT Schedule not found');

    const parsed = WhoChecklistUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const existing: any = ctx.db.prepare('SELECT * FROM who_surgical_safety_checklists WHERE ot_schedule_id = ?').get(id);

    const now = nowIso();
    const signinTime = data.signinCompleted ? (existing?.signin_timestamp || now) : existing?.signin_timestamp;
    const timeoutTime = data.timeoutCompleted ? (existing?.timeout_timestamp || now) : existing?.timeout_timestamp;
    const signoutTime = data.signoutCompleted ? (existing?.signout_timestamp || now) : existing?.signout_timestamp;

    const toBoolInt = (val: boolean | number | undefined | null, def = 1): number => {
      if (val === undefined || val === null) return def;
      return val ? 1 : 0;
    };

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          INSERT INTO who_surgical_safety_checklists (
            ot_schedule_id, patient_id,
            signin_completed, signin_patient_confirmed, signin_site_marked,
            signin_anesthesia_safety_check, signin_pulse_oximeter_functioning,
            signin_known_allergy, signin_difficult_airway_risk, signin_blood_loss_risk,
            signin_nurse_anesthetist_name, signin_timestamp,
            timeout_completed, timeout_team_introduced, timeout_verbal_confirmation,
            timeout_surgeon_review, timeout_anesthetist_review, timeout_nursing_sterility_confirmed,
            timeout_antibiotic_prophylaxis_given, timeout_antibiotic_name_dose,
            timeout_imaging_displayed, timeout_completed_by_name, timeout_timestamp,
            signout_completed, signout_procedure_recorded_name, signout_counts_correct,
            signout_specimen_labeled, signout_equipment_problems, signout_recovery_concerns,
            signout_completed_by_name, signout_timestamp, updated_at
          ) VALUES (
            ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
          ON CONFLICT(ot_schedule_id) DO UPDATE SET
            signin_completed = excluded.signin_completed,
            signin_patient_confirmed = excluded.signin_patient_confirmed,
            signin_site_marked = excluded.signin_site_marked,
            signin_anesthesia_safety_check = excluded.signin_anesthesia_safety_check,
            signin_pulse_oximeter_functioning = excluded.signin_pulse_oximeter_functioning,
            signin_known_allergy = excluded.signin_known_allergy,
            signin_difficult_airway_risk = excluded.signin_difficult_airway_risk,
            signin_blood_loss_risk = excluded.signin_blood_loss_risk,
            signin_nurse_anesthetist_name = excluded.signin_nurse_anesthetist_name,
            signin_timestamp = excluded.signin_timestamp,
            timeout_completed = excluded.timeout_completed,
            timeout_team_introduced = excluded.timeout_team_introduced,
            timeout_verbal_confirmation = excluded.timeout_verbal_confirmation,
            timeout_surgeon_review = excluded.timeout_surgeon_review,
            timeout_anesthetist_review = excluded.timeout_anesthetist_review,
            timeout_nursing_sterility_confirmed = excluded.timeout_nursing_sterility_confirmed,
            timeout_antibiotic_prophylaxis_given = excluded.timeout_antibiotic_prophylaxis_given,
            timeout_antibiotic_name_dose = excluded.timeout_antibiotic_name_dose,
            timeout_imaging_displayed = excluded.timeout_imaging_displayed,
            timeout_completed_by_name = excluded.timeout_completed_by_name,
            timeout_timestamp = excluded.timeout_timestamp,
            signout_completed = excluded.signout_completed,
            signout_procedure_recorded_name = excluded.signout_procedure_recorded_name,
            signout_counts_correct = excluded.signout_counts_correct,
            signout_specimen_labeled = excluded.signout_specimen_labeled,
            signout_equipment_problems = excluded.signout_equipment_problems,
            signout_recovery_concerns = excluded.signout_recovery_concerns,
            signout_completed_by_name = excluded.signout_completed_by_name,
            signout_timestamp = excluded.signout_timestamp,
            updated_at = excluded.updated_at
        `)
        .run(
          id,
          schedule.patient_id,
          toBoolInt(data.signinCompleted, 0),
          toBoolInt(data.signinPatientConfirmed, existing?.signin_patient_confirmed ?? 1),
          toBoolInt(data.signinSiteMarked, existing?.signin_site_marked ?? 1),
          toBoolInt(data.signinAnesthesiaSafetyCheck, existing?.signin_anesthesia_safety_check ?? 1),
          toBoolInt(data.signinPulseOximeterFunctioning, existing?.signin_pulse_oximeter_functioning ?? 1),
          toBoolInt(data.signinKnownAllergy, existing?.signin_known_allergy ?? 0),
          toBoolInt(data.signinDifficultAirwayRisk, existing?.signin_difficult_airway_risk ?? 0),
          toBoolInt(data.signinBloodLossRisk, existing?.signin_blood_loss_risk ?? 0),
          data.signinNurseAnesthetistName ?? existing?.signin_nurse_anesthetist_name ?? user.fullName,
          signinTime,
          toBoolInt(data.timeoutCompleted, 0),
          toBoolInt(data.timeoutTeamIntroduced, existing?.timeout_team_introduced ?? 1),
          toBoolInt(data.timeoutVerbalConfirmation, existing?.timeout_verbal_confirmation ?? 1),
          data.timeoutSurgeonReview ?? existing?.timeout_surgeon_review ?? null,
          data.timeoutAnesthetistReview ?? existing?.timeout_anesthetist_review ?? null,
          toBoolInt(data.timeoutNursingSterilityConfirmed, existing?.timeout_nursing_sterility_confirmed ?? 1),
          toBoolInt(data.timeoutAntibioticProphylaxisGiven, existing?.timeout_antibiotic_prophylaxis_given ?? 1),
          data.timeoutAntibioticNameDose ?? existing?.timeout_antibiotic_name_dose ?? null,
          toBoolInt(data.timeoutImagingDisplayed, existing?.timeout_imaging_displayed ?? 1),
          data.timeoutCompletedByName ?? existing?.timeout_completed_by_name ?? user.fullName,
          timeoutTime,
          toBoolInt(data.signoutCompleted, 0),
          data.signoutProcedureRecordedName ?? existing?.signout_procedure_recorded_name ?? schedule.procedure_name,
          toBoolInt(data.signoutCountsCorrect, existing?.signout_counts_correct ?? 1),
          toBoolInt(data.signoutSpecimenLabeled, existing?.signout_specimen_labeled ?? 1),
          data.signoutEquipmentProblems ?? existing?.signout_equipment_problems ?? null,
          data.signoutRecoveryConcerns ?? existing?.signout_recovery_concerns ?? null,
          data.signoutCompletedByName ?? existing?.signout_completed_by_name ?? user.fullName,
          signoutTime,
          now,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'ot.who_checklist_update',
        entity: 'who_surgical_safety_checklists',
        entityId: id,
        detail: {
          otScheduleId: id,
          signinCompleted: data.signinCompleted,
          timeoutCompleted: data.timeoutCompleted,
          signoutCompleted: data.signoutCompleted,
        },
      });
    });

    const updatedChecklist = ctx.db.prepare('SELECT * FROM who_surgical_safety_checklists WHERE ot_schedule_id = ?').get(id);
    return updatedChecklist;
  });

  // 7. Get Pre-Anesthesia Clearances for Patient
  app.get<{ Params: { patientId: string } }>('/api/patients/:patientId/pac', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const records = ctx.db
      .prepare(`
        SELECT * FROM pre_anesthesia_clearances
        WHERE patient_id = ?
        ORDER BY evaluation_date DESC, id DESC
      `)
      .all(patientId);

    return { clearances: records };
  });

  // 8. Create Pre-Anesthesia Clearance (PAC)
  app.post<{ Params: { patientId: string } }>('/api/patients/:patientId/pac', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only medical doctors can issue Pre-Anesthesia Clearances (PAC)');
    }

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const parsed = PacCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    let pacId: number = 0;
    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(`
          INSERT INTO pre_anesthesia_clearances (
            patient_id, ot_schedule_id, evaluation_date, anesthesiologist_id,
            anesthesiologist_name, asa_grade, mallampati_class, mouth_opening_cm,
            thyromental_distance_cm, dentition_status, neck_mobility,
            npo_solid_hours, npo_clear_liquid_hours, cardiovascular_assessment,
            respiratory_assessment, airway_notes, planned_anesthesia_technique,
            pac_clearance_status, high_risk_warnings, preop_orders_instructions,
            blood_products_crossmatched
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          patientId,
          data.otScheduleId ?? null,
          data.evaluationDate,
          user.id,
          user.fullName,
          data.asaGrade,
          data.mallampatiClass,
          data.mouthOpeningCm,
          data.thyromentalDistanceCm,
          data.dentitionStatus,
          data.neckMobility,
          data.npoSolidHours,
          data.npoClearLiquidHours,
          data.cardiovascularAssessment ?? null,
          data.respiratoryAssessment ?? null,
          data.airwayNotes ?? null,
          data.plannedAnesthesiaTechnique,
          data.pacClearanceStatus,
          data.highRiskWarnings ?? null,
          data.preopOrdersInstructions ?? null,
          data.bloodProductsCrossmatched ?? null,
        );

      pacId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'ot.pac_create',
        entity: 'pre_anesthesia_clearances',
        entityId: pacId,
        detail: {
          patientId,
          asaGrade: data.asaGrade,
          pacClearanceStatus: data.pacClearanceStatus,
        },
      });
    });

    const record = ctx.db.prepare('SELECT * FROM pre_anesthesia_clearances WHERE id = ?').get(pacId);
    return record;
  });

  // 9. Delete PAC (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/pac/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only doctors can delete Pre-Anesthesia Clearance records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid PAC ID');

    const existing: any = ctx.db.prepare('SELECT * FROM pre_anesthesia_clearances WHERE id = ?').get(id);
    if (!existing) throw notFound('PAC record not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM pre_anesthesia_clearances WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'ot.pac_delete',
        entity: 'pre_anesthesia_clearances',
        entityId: id,
        detail: { patientId: existing.patient_id, asaGrade: existing.asa_grade },
      });
    });

    return { success: true, message: 'PAC record deleted' };
  });

  // 10. Audit Print OT Schedule / WHO Checklist
  app.post<{ Params: { id: string } }>('/api/ot-schedules/:id/audit-print', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:read_clinical')) {
      throw forbidden('Desk attenders cannot print surgical dossiers');
    }

    const id = Number.parseInt(req.params.id, 10);
    audit(ctx.db, {
      actorId: user.id,
      action: 'ot.print',
      entity: 'ot_schedules',
      entityId: id,
    });

    return { success: true };
  });
}
