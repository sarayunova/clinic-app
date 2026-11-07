import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';

const HandoverSchema = z.object({
  admissionId: z.number().int().positive(),
  shiftType: z.enum(['morning', 'evening', 'night']),
  shiftDate: z.string().min(10).max(10),
  situation: z.string().min(2),
  background: z.string().min(2),
  assessment: z.string().min(2),
  recommendation: z.string().min(2),
  pendingTasks: z.union([z.string(), z.array(z.string())]).optional(),
  ivFluidsStatus: z.string().optional().nullable(),
  dietaryOrder: z.string().optional().nullable(),
});

export function registerWardBoardRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Get Live Inpatient Ward Board with Critical Deterioration Alerts
  app.get('/api/ipd/ward-board/live', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');

    // Get all beds with their active admission status
    const allBeds = ctx.db
      .prepare(`
        SELECT 
          b.id as bedId,
          b.label as bedNumber,
          b.room as ward,
          b.active as bedActive,
          a.id as admissionId,
          a.patient_id as patientId,
          a.admitted_at as admittedAt,
          a.diagnosis as primaryDiagnosis,
          a.created_by as attendingDoctorId,
          u.full_name as attendingDoctorName,
          p.patient_number as uhid,
          p.full_name as patientName,
          p.estimated_age_years as ageYears,
          p.phone as patientPhone,
          p.gravida,
          p.para,
          p.last_menstrual_period as lastMenstrualPeriod
        FROM beds b
        LEFT JOIN admissions a ON a.bed_id = b.id AND a.status = 'admitted'
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN users u ON a.created_by = u.id
        ORDER BY b.room, b.label
      `)
      .all() as any[];

    const occupiedAdmissions: any[] = [];

    for (const bed of allBeds) {
      if (!bed.admissionId) continue;

      // Check latest MEOWS
      const latestMeows = ctx.db
        .prepare(`
          SELECT * FROM maternal_meows_observations
          WHERE patient_id = ?
          ORDER BY recorded_at DESC, id DESC LIMIT 1
        `)
        .get(bed.patientId) as any;

      // Check SNCU admission if any
      const sncuRecord = ctx.db
        .prepare(`
          SELECT * FROM sncu_admissions
          WHERE admission_id = ?
          ORDER BY admission_datetime DESC, id DESC LIMIT 1
        `)
        .get(bed.admissionId) as any;

      // Check latest SBAR handover
      const latestHandover = ctx.db
        .prepare(`
          SELECT * FROM ward_handover_notes
          WHERE admission_id = ?
          ORDER BY shift_date DESC, id DESC LIMIT 1
        `)
        .get(bed.admissionId) as any;

      // Check active alerts
      const activeAlerts = ctx.db
        .prepare(`
          SELECT * FROM ward_critical_alerts
          WHERE admission_id = ? AND status = 'ACTIVE'
          ORDER BY created_at DESC
        `)
        .all(bed.admissionId) as any[];

      // Determine Deterioration Status
      let deteriorationStatus: 'NORMAL_GREEN' | 'WARNING_YELLOW' | 'CRITICAL_RED' = 'NORMAL_GREEN';
      const triggerReasons: string[] = [];

      if (latestMeows) {
        if (
          latestMeows.overall_alert_level === 'critical_multiple_red' ||
          latestMeows.overall_alert_level === 'urgent_two_yellow_one_red' ||
          latestMeows.red_triggers_count > 0 ||
          latestMeows.sos_risk_level === 'high_septic_shock'
        ) {
          deteriorationStatus = 'CRITICAL_RED';
          triggerReasons.push(`MEOWS Alert: ${latestMeows.overall_alert_level} (${latestMeows.red_triggers_count} red triggers)`);
        } else if (
          latestMeows.overall_alert_level === 'single_yellow' ||
          latestMeows.yellow_triggers_count > 0
        ) {
          deteriorationStatus = 'WARNING_YELLOW';
          triggerReasons.push(`MEOWS Yellow Alert: ${latestMeows.yellow_triggers_count} triggers`);
        }

        // Check severe BP
        if (latestMeows.bp_systolic >= 160 || latestMeows.bp_systolic <= 90 || latestMeows.bp_diastolic >= 110) {
          deteriorationStatus = 'CRITICAL_RED';
          triggerReasons.push(`Critical BP: ${latestMeows.bp_systolic}/${latestMeows.bp_diastolic} mmHg`);
        }
        if (latestMeows.heart_rate >= 120 || latestMeows.heart_rate <= 50) {
          deteriorationStatus = 'CRITICAL_RED';
          triggerReasons.push(`Abnormal HR: ${latestMeows.heart_rate} bpm`);
        }
        if (latestMeows.spo2_percent && latestMeows.spo2_percent < 92) {
          deteriorationStatus = 'CRITICAL_RED';
          triggerReasons.push(`Low SpO2: ${latestMeows.spo2_percent}%`);
        }
      }

      if (sncuRecord) {
        if (
          (sncuRecord.silverman_anderson_score != null && sncuRecord.silverman_anderson_score >= 6) ||
          (sncuRecord.downes_score != null && sncuRecord.downes_score >= 6) ||
          (sncuRecord.oxygen_saturation_percent != null && sncuRecord.oxygen_saturation_percent < 90)
        ) {
          deteriorationStatus = 'CRITICAL_RED';
          triggerReasons.push(`Neonatal Respiratory Distress: Silverman ${sncuRecord.silverman_anderson_score ?? '-'}, Downes ${sncuRecord.downes_score ?? '-'}`);
        } else if (
          (sncuRecord.silverman_anderson_score != null && sncuRecord.silverman_anderson_score >= 4) ||
          (sncuRecord.downes_score != null && sncuRecord.downes_score >= 4)
        ) {
          if (deteriorationStatus !== 'CRITICAL_RED') {
            deteriorationStatus = 'WARNING_YELLOW';
          }
          triggerReasons.push(`Moderate Respiratory Distress`);
        }
      }

      occupiedAdmissions.push({
        ...bed,
        latestMeows,
        sncuRecord,
        latestHandover,
        activeAlerts,
        deteriorationStatus,
        triggerReasons,
      });
    }

    const totalBeds = allBeds.length;
    const occupiedCount = occupiedAdmissions.length;
    const vacantCount = totalBeds - occupiedCount;
    const criticalRedCount = occupiedAdmissions.filter((b) => b.deteriorationStatus === 'CRITICAL_RED').length;
    const warningYellowCount = occupiedAdmissions.filter((b) => b.deteriorationStatus === 'WARNING_YELLOW').length;

    return {
      stats: {
        totalBeds,
        occupiedCount,
        vacantCount,
        criticalRedCount,
        warningYellowCount,
      },
      allBeds,
      occupiedAdmissions,
    };
  });

  // 2. Log Shift Handover Note (SBAR)
  app.post('/api/ipd/ward-board/handover', async (req: FastifyRequest) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk staff cannot record clinical shift handovers');
    }

    const parsed = HandoverSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const pendingJson = Array.isArray(data.pendingTasks)
      ? JSON.stringify(data.pendingTasks)
      : data.pendingTasks ?? null;

    let handoverId: number = 0;
    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(`
          INSERT INTO ward_handover_notes (
            admission_id, shift_type, shift_date, nurse_id, nurse_name,
            situation, background, assessment, recommendation,
            pending_tasks, iv_fluids_status, dietary_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.admissionId,
          data.shiftType,
          data.shiftDate,
          user.id,
          user.fullName,
          data.situation,
          data.background,
          data.assessment,
          data.recommendation,
          pendingJson,
          data.ivFluidsStatus ?? null,
          data.dietaryOrder ?? null,
        );

      handoverId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'ward.handover_create',
        entity: 'ward_handover_notes',
        entityId: handoverId,
        detail: { admissionId: data.admissionId, shiftType: data.shiftType, shiftDate: data.shiftDate },
      });
    });

    const record = ctx.db.prepare('SELECT * FROM ward_handover_notes WHERE id = ?').get(handoverId);
    return record;
  });

  // 3. Get Handover Notes for Admission
  app.get<{ Params: { admissionId: string } }>('/api/ipd/ward-board/handover/:admissionId', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const admissionId = Number.parseInt(req.params.admissionId, 10);
    if (Number.isNaN(admissionId)) throw badRequest('Invalid admission ID');

    const handovers = ctx.db
      .prepare(`
        SELECT * FROM ward_handover_notes
        WHERE admission_id = ?
        ORDER BY shift_date DESC, id DESC
      `)
      .all(admissionId);

    return { handovers };
  });

  // 4. Delete Handover Note (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/ipd/ward-board/handover/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only doctors can delete handover notes');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid handover ID');

    const existing: any = ctx.db.prepare('SELECT * FROM ward_handover_notes WHERE id = ?').get(id);
    if (!existing) throw notFound('Handover note not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM ward_handover_notes WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'ward.handover_delete',
        entity: 'ward_handover_notes',
        entityId: id,
        detail: { admissionId: existing.admission_id, shiftType: existing.shift_type },
      });
    });

    return { success: true, message: 'Handover note deleted' };
  });

  // 5. Acknowledge Critical Alert
  app.post<{ Params: { id: string }; Body: { resolutionNotes?: string } }>('/api/ipd/ward-board/alert-acknowledge/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk staff cannot acknowledge clinical alerts');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid alert ID');

    const alertRecord: any = ctx.db.prepare('SELECT * FROM ward_critical_alerts WHERE id = ?').get(id);
    if (!alertRecord) throw notFound('Alert not found');

    const notes = req.body?.resolutionNotes ?? 'Acknowledged by bedside clinical staff';
    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE ward_critical_alerts
          SET status = 'ACKNOWLEDGED',
              acknowledged_by_user_id = ?,
              acknowledged_at = ?,
              resolution_notes = ?
          WHERE id = ?
        `)
        .run(user.id, nowIso(), notes, id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'ward.alert_acknowledge',
        entity: 'ward_critical_alerts',
        entityId: id,
        detail: { admissionId: alertRecord.admission_id, alertType: alertRecord.alert_type },
      });
    });

    return { success: true, message: 'Alert acknowledged' };
  });

  // 6. Audit Handover Sheet Print
  app.post<{ Body: { admissionId?: number; ward?: string } }>('/api/ipd/ward-board/audit-print', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:read_clinical')) {
      throw forbidden('Desk staff cannot print clinical shift handovers');
    }

    audit(ctx.db, {
      actorId: user.id,
      action: 'ward.handover_print',
      entity: 'ward_handover_notes',
      entityId: req.body?.admissionId ?? null,
      detail: { ward: req.body?.ward ?? 'All Wards' },
    });

    return { success: true };
  });
}
