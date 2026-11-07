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
  evaluatePatientVaccines,
  generateReminderText,
  buildWhatsAppLink,
  generateEmergencyPassportPayload,
  type EmergencyPassportData,
} from '../../web/src/immunizationRecallEngine.js';

function getClinicSettings(ctx: Ctx): Record<string, string> {
  const rows = ctx.db.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export const dispatchWhatsappSchema = z.object({
  patientId: z.number().int().positive(),
  recipientPhone: z.string().min(5).max(30),
  triggerEvent: z.enum([
    'immunization_due',
    'antenatal_appointment_reminder',
    'ultrasound_scheduled',
    'abnormal_lab_recall',
    'discharge_instructions',
    'general_followup',
  ]),
  language: z.enum(['english', 'hindi']).default('english'),
  messageBody: z.string().min(1).max(2000),
  deepLinkUrl: z.string().max(2000).nullable().optional(),
});

export const auditQrCardSchema = z.object({
  patientId: z.number().int().positive(),
});

export function registerCommunicationRecallRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Get automated immunization recall list across all pediatric patients
  app.get('/api/immunization/recall-list', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const settings = getClinicSettings(ctx);
    const clinicName = settings.clinicName || 'LiVi Maternity & Pediatric Clinic';
    const clinicPhone = settings.clinicPhone || '+91 98765 43210';
    const doctorName = settings.doctorName || 'Dr. Vidya / Dr. Lingeshwar';

    // Find all patients who are pediatric (have date_of_birth, pediatric profile, or are <= 16 years)
    const patients = ctx.db
      .prepare(
        `SELECT p.id, p.patient_number, p.full_name, p.date_of_birth, p.estimated_age_years,
                p.phone, p.emergency_contact_name, p.emergency_contact_phone,
                prof.birth_weight_kg, prof.blood_group
         FROM patients p
         LEFT JOIN patient_pediatric_profiles prof ON prof.patient_id = p.id
         WHERE p.date_of_birth IS NOT NULL
            OR prof.patient_id IS NOT NULL
            OR (p.estimated_age_years IS NOT NULL AND p.estimated_age_years <= 16)
         ORDER BY p.id DESC`,
      )
      .all() as any[];

    const results: any[] = [];

    for (const pat of patients) {
      if (!pat.date_of_birth) continue;

      // Get all given vaccines for this patient
      const givenRows = ctx.db
        .prepare(
          `SELECT vaccine_key FROM patient_vaccinations WHERE patient_id = ? AND status = 'given'`,
        )
        .all(pat.id) as { vaccine_key: string }[];
      const givenCodes = givenRows.map((r) => r.vaccine_key);

      const evaluation = evaluatePatientVaccines(pat.date_of_birth, givenCodes);

      // Only include if they have vaccines due now, overdue, or upcoming
      if (
        evaluation.overdue.length > 0 ||
        evaluation.dueNow.length > 0 ||
        evaluation.upcomingNext30d.length > 0
      ) {
        const phone = pat.phone || pat.emergency_contact_phone || '';
        const itemsDueNames = [
          ...evaluation.overdue.map((i) => `${i.vaccine.name} (OVERDUE)`),
          ...evaluation.dueNow.map((i) => `${i.vaccine.name} (Due Now)`),
        ];

        const englishText = generateReminderText({
          patientName: pat.full_name,
          parentName: pat.emergency_contact_name || undefined,
          clinicName,
          phone: clinicPhone,
          doctorName,
          itemsDue: itemsDueNames.length > 0 ? itemsDueNames : ['Routine Pediatric Follow-up'],
          dueDateFormatted: 'Immediately',
          language: 'english',
          reminderType: 'immunization',
        });

        const hindiText = generateReminderText({
          patientName: pat.full_name,
          parentName: pat.emergency_contact_name || undefined,
          clinicName,
          phone: clinicPhone,
          doctorName,
          itemsDue: itemsDueNames.length > 0 ? itemsDueNames : ['नियमित बाल टीकाकरण'],
          dueDateFormatted: 'शीघ्र',
          language: 'hindi',
          reminderType: 'immunization',
        });

        results.push({
          patientId: pat.id,
          patientNumber: pat.patient_number,
          fullName: pat.full_name,
          dateOfBirth: pat.date_of_birth,
          ageWeeks: evaluation.ageWeeks,
          ageDays: evaluation.ageDays,
          phone,
          parentName: pat.emergency_contact_name || null,
          completedCount: evaluation.completedCount,
          dueNow: evaluation.dueNow,
          overdue: evaluation.overdue,
          upcomingNext30d: evaluation.upcomingNext30d,
          englishReminderText: englishText,
          hindiReminderText: hindiText,
          englishWhatsAppLink: phone ? buildWhatsAppLink(phone, englishText) : null,
          hindiWhatsAppLink: phone ? buildWhatsAppLink(phone, hindiText) : null,
        });
      }
    }

    return results;
  });

  // 2. Get detailed immunization recall status for a specific patient
  app.get<{ Params: { patientId: string } }>(
    '/api/patients/:patientId/immunization-status',
    async (req) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number.parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

      const pat: any = ctx.db
        .prepare(
          `SELECT p.*, prof.birth_weight_kg, prof.blood_group as pediatric_blood_group
         FROM patients p
         LEFT JOIN patient_pediatric_profiles prof ON prof.patient_id = p.id
         WHERE p.id = ?`,
        )
        .get(patientId);

      if (!pat) throw notFound('Patient not found');
      if (!pat.date_of_birth) {
        return {
          hasDob: false,
          message: 'Date of birth is not recorded for this patient.',
        };
      }

      const givenRows = ctx.db
        .prepare(
          `SELECT vaccine_key FROM patient_vaccinations WHERE patient_id = ? AND status = 'given'`,
        )
        .all(patientId) as { vaccine_key: string }[];
      const givenCodes = givenRows.map((r) => r.vaccine_key);

      const evaluation = evaluatePatientVaccines(pat.date_of_birth, givenCodes);
      const settings = getClinicSettings(ctx);
      const clinicName = settings.clinicName || 'LiVi Maternity & Pediatric Clinic';
      const clinicPhone = settings.clinicPhone || '+91 98765 43210';
      const doctorName = settings.doctorName || 'Dr. Vidya / Dr. Lingeshwar';
      const phone = pat.phone || pat.emergency_contact_phone || '';

      const itemsDueNames = [
        ...evaluation.overdue.map((i) => `${i.vaccine.name} (OVERDUE)`),
        ...evaluation.dueNow.map((i) => `${i.vaccine.name} (Due Now)`),
      ];

      const englishText = generateReminderText({
        patientName: pat.full_name,
        parentName: pat.emergency_contact_name || undefined,
        clinicName,
        phone: clinicPhone,
        doctorName,
        itemsDue: itemsDueNames.length > 0 ? itemsDueNames : ['Routine Pediatric Follow-up'],
        dueDateFormatted: 'Immediately',
        language: 'english',
        reminderType: 'immunization',
      });

      const hindiText = generateReminderText({
        patientName: pat.full_name,
        parentName: pat.emergency_contact_name || undefined,
        clinicName,
        phone: clinicPhone,
        doctorName,
        itemsDue: itemsDueNames.length > 0 ? itemsDueNames : ['नियमित बाल टीकाकरण'],
        dueDateFormatted: 'शीघ्र',
        language: 'hindi',
        reminderType: 'immunization',
      });

      return {
        hasDob: true,
        patientId: pat.id,
        patientNumber: pat.patient_number,
        fullName: pat.full_name,
        dateOfBirth: pat.date_of_birth,
        phone,
        parentName: pat.emergency_contact_name || null,
        evaluation,
        englishReminderText: englishText,
        hindiReminderText: hindiText,
        englishWhatsAppLink: phone ? buildWhatsAppLink(phone, englishText) : null,
        hindiWhatsAppLink: phone ? buildWhatsAppLink(phone, hindiText) : null,
      };
    },
  );

  // 3. Log a communication dispatch (e.g. WhatsApp Click-to-Chat trigger)
  app.post('/api/communication/dispatch-whatsapp', async (req) => {
    const user = requireUser(req);
    const parsed = dispatchWhatsappSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(d.patientId);
    if (!patient) throw notFound('Patient not found');

    const now = nowIso();
    const deepLinkUrl = d.deepLinkUrl || buildWhatsAppLink(d.recipientPhone, d.messageBody);

    const logId = tx(ctx.db, () => {
      const res = ctx.db
        .prepare(
          `INSERT INTO communication_dispatch_logs (
            patient_id, communication_type, trigger_event, recipient_phone,
            language, message_body, deep_link_url, sent_by, created_at
          ) VALUES (?, 'whatsapp_click_to_chat', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          d.patientId,
          d.triggerEvent,
          d.recipientPhone,
          d.language,
          d.messageBody,
          deepLinkUrl,
          user.id,
          now,
        );

      const id = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'communication.whatsapp_dispatch',
        entity: 'communication_dispatch_logs',
        entityId: id,
        detail: {
          patientId: d.patientId,
          recipientPhone: d.recipientPhone,
          triggerEvent: d.triggerEvent,
          language: d.language,
        },
      });

      return id;
    });

    return {
      ok: true,
      dispatchId: logId,
      deepLinkUrl,
    };
  });

  // 4. Get communication dispatch logs for a patient
  app.get<{ Params: { patientId: string } }>(
    '/api/patients/:patientId/communication-logs',
    async (req) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number.parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

      const rows = ctx.db
        .prepare(
          `SELECT l.*, u.full_name as sent_by_name
         FROM communication_dispatch_logs l
         LEFT JOIN users u ON u.id = l.sent_by
         WHERE l.patient_id = ?
         ORDER BY l.created_at DESC, l.id DESC`,
        )
        .all(patientId);

      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patient_id,
        communicationType: r.communication_type,
        triggerEvent: r.trigger_event,
        recipientPhone: r.recipient_phone,
        language: r.language,
        messageBody: r.message_body,
        deepLinkUrl: r.deep_link_url,
        sentBy: r.sent_by,
        sentByName: r.sent_by_name,
        createdAt: r.created_at,
      }));
    },
  );

  // 5. Get Digital Emergency Passport data bundle for wallet QR card
  app.get<{ Params: { patientId: string } }>(
    '/api/patients/:patientId/emergency-passport',
    async (req) => {
      requirePerm(req, 'patient:read_clinical');
      const patientId = Number.parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

      const pat: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
      if (!pat) throw notFound('Patient not found');

      // Check pediatric profile
      const ped: any = ctx.db
        .prepare('SELECT * FROM patient_pediatric_profiles WHERE patient_id = ?')
        .get(patientId);

      // Check latest active risk assessment if any
      const riskAss: any = ctx.db
        .prepare(
          `SELECT * FROM antenatal_risk_assessments WHERE patient_id = ? ORDER BY id DESC LIMIT 1`,
        )
        .get(patientId);

      // Collect high-risk alerts
      const highRiskList: string[] = [];
      if (riskAss?.overall_risk_tier === 'high' || riskAss?.pe_risk_level === 'high') {
        highRiskList.push('High-Risk Pregnancy (PE/Preterm)');
      }
      if (riskAss?.vte_risk_level === 'high') {
        highRiskList.push('High VTE Thrombosis Risk');
      }

      // Calculate EDD from LMP if available
      let eddStr: string | null = null;
      if (pat.last_menstrual_period) {
        const lmpDate = new Date(pat.last_menstrual_period);
        const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
        eddStr = eddDate.toISOString().slice(0, 10);
      }

      const settings = getClinicSettings(ctx);
      const hospitalName = settings.clinicName || 'LiVi Hospital & Maternity Center';
      const hospitalHelpline = settings.clinicPhone || '+91 98765 43210';

      const obSummary =
        pat.gravida != null
          ? `G${pat.gravida}P${pat.para ?? 0}${eddStr ? ` EDD: ${eddStr}` : ''}`
          : eddStr
            ? `EDD: ${eddStr}`
            : null;

      const passportData: EmergencyPassportData = {
        patientId: pat.id,
        fullName: pat.full_name,
        ageYears: pat.estimated_age_years ?? null,
        bloodGroup: pat.blood_group || ped?.blood_group || null,
        allergies:
          pat.allergy_status === 'known'
            ? pat.allergy_details || 'Known Allergies'
            : pat.allergy_status === 'none'
              ? 'None'
              : 'Unknown',
        obstetricSummary: obSummary,
        highRiskConditions: highRiskList.length > 0 ? highRiskList : undefined,
        edd: eddStr,
        emergencyContact: pat.emergency_contact_phone
          ? `${pat.emergency_contact_name || 'Emergency'}: ${pat.emergency_contact_phone}`
          : null,
        hospitalName,
        hospitalHelpline,
      };

      const qrPayload = generateEmergencyPassportPayload(passportData);

      return {
        passportData,
        qrPayload,
      };
    },
  );

  // 6. Audit printing of emergency QR card
  app.post('/api/communication/audit-qr-card', async (req) => {
    const user = requireUser(req);
    const parsed = auditQrCardSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(d.patientId);
    if (!patient) throw notFound('Patient not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'communication.qr_passport_print',
      entity: 'patients',
      entityId: d.patientId,
      detail: {
        patientId: d.patientId,
      },
    });

    return { ok: true };
  });
}
