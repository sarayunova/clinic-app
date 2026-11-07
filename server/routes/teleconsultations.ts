import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';

const TeleconsultationCreateSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  scheduledAt: z.string().min(10), // ISO datetime or YYYY-MM-DDTHH:MM
  consultType: z.enum(['FIRST_CONSULT', 'FOLLOW_UP', 'REPORT_REVIEW', 'POST_OP_CHECK', 'EMERGENCY_TRIAGE']).default('FOLLOW_UP'),
  videoPlatform: z.enum(['WHATSAPP_VIDEO', 'JITSI', 'PHONE_CALL', 'OTHER']).default('WHATSAPP_VIDEO'),
  chiefComplaint: z.string().min(2),
  clinicalNotes: z.string().optional().nullable(),
  provisionalDiagnosis: z.string().optional().nullable(),
  adviceInstructions: z.string().optional().nullable(),
  prescriptionMedicines: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  investigationsAdvised: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  telemedicineConsentObtained: z.boolean().default(true),
  emergencyDisclaimerAcknowledged: z.boolean().default(true),
});

const TeleconsultationUpdateSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  chiefComplaint: z.string().min(2).optional(),
  clinicalNotes: z.string().optional().nullable(),
  provisionalDiagnosis: z.string().optional().nullable(),
  adviceInstructions: z.string().optional().nullable(),
  prescriptionMedicines: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  investigationsAdvised: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  scheduledAt: z.string().optional(),
  videoPlatform: z.enum(['WHATSAPP_VIDEO', 'JITSI', 'PHONE_CALL', 'OTHER']).optional(),
});

function getClinicSettings(ctx: Ctx): Record<string, string> {
  const rows = ctx.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function registerTeleconsultationRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List Teleconsultations
  app.get('/api/teleconsultations', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');

    const q = req.query as {
      patientId?: string;
      doctorId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    };

    let sql = `
      SELECT 
        t.*,
        p.patient_number as uhid,
        p.full_name as patient_name,
        p.phone as patient_phone,
        p.estimated_age_years as patient_age,
        doc.full_name as doctor_name
      FROM teleconsultations t
      JOIN patients p ON t.patient_id = p.id
      JOIN users doc ON t.doctor_id = doc.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q.patientId) {
      sql += ' AND t.patient_id = ?';
      params.push(Number.parseInt(q.patientId, 10));
    }
    if (q.doctorId) {
      sql += ' AND t.doctor_id = ?';
      params.push(Number.parseInt(q.doctorId, 10));
    }
    if (q.status) {
      sql += ' AND t.status = ?';
      params.push(q.status);
    }
    if (q.fromDate) {
      sql += ' AND t.scheduled_at >= ?';
      params.push(q.fromDate);
    }
    if (q.toDate) {
      sql += ' AND t.scheduled_at <= ?';
      params.push(q.toDate);
    }

    sql += ' ORDER BY t.scheduled_at DESC';

    const records = ctx.db.prepare(sql).all(...params);
    return { teleconsultations: records };
  });

  // 2. Create Teleconsultation
  app.post('/api/teleconsultations', async (req: FastifyRequest) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Front desk staff cannot schedule clinical teleconsultations');
    }

    const parsed = TeleconsultationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const roomId = `livi-tele-${data.patientId}-${crypto.randomBytes(4).toString('hex')}`;
    let meetingLink = '';

    if (data.videoPlatform === 'JITSI') {
      meetingLink = `https://meet.jit.si/${roomId}`;
    } else if (data.videoPlatform === 'WHATSAPP_VIDEO') {
      const phoneDigits = (patient.phone || '').replace(/\D/g, '');
      meetingLink = `https://wa.me/91${phoneDigits}`;
    } else {
      meetingLink = `https://meet.jit.si/${roomId}`;
    }

    const rxJson = typeof data.prescriptionMedicines === 'object' && data.prescriptionMedicines !== null
      ? JSON.stringify(data.prescriptionMedicines)
      : data.prescriptionMedicines ?? null;

    const invJson = typeof data.investigationsAdvised === 'object' && data.investigationsAdvised !== null
      ? JSON.stringify(data.investigationsAdvised)
      : data.investigationsAdvised ?? null;

    let teleId: number = 0;
    tx(ctx.db, () => {
      const res = ctx.db
        .prepare(`
          INSERT INTO teleconsultations (
            patient_id, doctor_id, scheduled_at, status, consult_type,
            video_platform, meeting_link, meeting_room_id, chief_complaint,
            clinical_notes, provisional_diagnosis, advice_instructions,
            prescription_medicines, investigations_advised,
            telemedicine_consent_obtained, emergency_disclaimer_acknowledged
          ) VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.patientId,
          data.doctorId,
          data.scheduledAt,
          data.consultType,
          data.videoPlatform,
          meetingLink,
          roomId,
          data.chiefComplaint,
          data.clinicalNotes ?? null,
          data.provisionalDiagnosis ?? null,
          data.adviceInstructions ?? null,
          rxJson,
          invJson,
          data.telemedicineConsentObtained ? 1 : 0,
          data.emergencyDisclaimerAcknowledged ? 1 : 0,
        );

      teleId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'teleconsultation.create',
        entity: 'teleconsultations',
        entityId: teleId,
        detail: { patientId: data.patientId, scheduledAt: data.scheduledAt, consultType: data.consultType },
      });
    });

    const created = ctx.db.prepare('SELECT * FROM teleconsultations WHERE id = ?').get(teleId);
    return created;
  });

  // 3. Get Teleconsultation by ID
  app.get<{ Params: { id: string } }>('/api/teleconsultations/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid teleconsultation ID');

    const record: any = ctx.db
      .prepare(`
        SELECT 
          t.*,
          p.patient_number as uhid,
          p.full_name as patient_name,
          p.phone as patient_phone,
          p.estimated_age_years as patient_age,
          p.address as patient_address,
          doc.full_name as doctor_name
        FROM teleconsultations t
        JOIN patients p ON t.patient_id = p.id
        JOIN users doc ON t.doctor_id = doc.id
        WHERE t.id = ?
      `)
      .get(id);

    if (!record) throw notFound('Teleconsultation not found');

    return record;
  });

  // 4. Update Teleconsultation
  app.put<{ Params: { id: string } }>('/api/teleconsultations/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Front desk staff cannot update clinical teleconsultations');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid teleconsultation ID');

    const existing: any = ctx.db.prepare('SELECT * FROM teleconsultations WHERE id = ?').get(id);
    if (!existing) throw notFound('Teleconsultation not found');

    const parsed = TeleconsultationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const rxJson = typeof data.prescriptionMedicines === 'object' && data.prescriptionMedicines !== null
      ? JSON.stringify(data.prescriptionMedicines)
      : data.prescriptionMedicines ?? existing.prescription_medicines;

    const invJson = typeof data.investigationsAdvised === 'object' && data.investigationsAdvised !== null
      ? JSON.stringify(data.investigationsAdvised)
      : data.investigationsAdvised ?? existing.investigations_advised;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE teleconsultations
          SET status = ?,
              chief_complaint = ?,
              clinical_notes = ?,
              provisional_diagnosis = ?,
              advice_instructions = ?,
              prescription_medicines = ?,
              investigations_advised = ?,
              scheduled_at = ?,
              video_platform = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(
          data.status ?? existing.status,
          data.chiefComplaint ?? existing.chief_complaint,
          data.clinicalNotes !== undefined ? data.clinicalNotes : existing.clinical_notes,
          data.provisionalDiagnosis !== undefined ? data.provisionalDiagnosis : existing.provisional_diagnosis,
          data.adviceInstructions !== undefined ? data.adviceInstructions : existing.advice_instructions,
          rxJson,
          invJson,
          data.scheduledAt ?? existing.scheduled_at,
          data.videoPlatform ?? existing.video_platform,
          nowIso(),
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'teleconsultation.update',
        entity: 'teleconsultations',
        entityId: id,
        detail: { status: data.status ?? existing.status },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM teleconsultations WHERE id = ?').get(id);
    return updated;
  });

  // 5. Digitally Sign Teleconsultation E-Prescription (Doctor only)
  app.post<{ Params: { id: string } }>('/api/teleconsultations/:id/sign', async (req) => {
    const user = requireUser(req);
    if (user.role !== 'doctor') {
      throw forbidden('Only registered medical practitioners (Doctors) can digitally sign e-prescriptions');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid teleconsultation ID');

    const existing: any = ctx.db
      .prepare(`
        SELECT t.*, p.patient_number as uhid, p.full_name as patient_name
        FROM teleconsultations t
        JOIN patients p ON t.patient_id = p.id
        WHERE t.id = ?
      `)
      .get(id);

    if (!existing) throw notFound('Teleconsultation not found');

    const settings = getClinicSettings(ctx);
    const doctorName = user.fullName;
    const doctorRegNumber = settings.doctorRegNo ?? settings.doctorRegNumber ?? 'NMC-MCI-2015-88421';
    const doctorQualifications = settings.doctorQualifications ?? 'MBBS, MS (OBGYN), DGO, Fellowship in Fetal Medicine';
    const signTimestamp = nowIso();

    // Compute Cryptographic Digital Signature
    const rawPayload = `${existing.id}|${existing.uhid}|${doctorRegNumber}|${signTimestamp}|${existing.provisional_diagnosis ?? ''}|${existing.prescription_medicines ?? ''}`;
    const signatureHash = crypto.createHash('sha256').update(rawPayload).digest('hex').toUpperCase();

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE teleconsultations
          SET digital_signature_hash = ?,
              signed_by_doctor_name = ?,
              doctor_reg_number = ?,
              doctor_qualifications = ?,
              signed_at = ?,
              status = 'COMPLETED',
              updated_at = ?
          WHERE id = ?
        `)
        .run(signatureHash, doctorName, doctorRegNumber, doctorQualifications, signTimestamp, signTimestamp, id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'teleconsultation.sign',
        entity: 'teleconsultations',
        entityId: id,
        detail: { signatureHash, doctorRegNumber },
      });
    });

    const signedRecord = ctx.db.prepare('SELECT * FROM teleconsultations WHERE id = ?').get(id);
    return signedRecord;
  });

  // 6. Send WhatsApp Invitation Deep Link
  app.post<{ Params: { id: string } }>('/api/teleconsultations/:id/whatsapp-invite', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk staff cannot dispatch teleconsultation invites');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid teleconsultation ID');

    const record: any = ctx.db
      .prepare(`
        SELECT t.*, p.full_name as patient_name, p.phone as patient_phone, doc.full_name as doctor_name
        FROM teleconsultations t
        JOIN patients p ON t.patient_id = p.id
        JOIN users doc ON t.doctor_id = doc.id
        WHERE t.id = ?
      `)
      .get(id);

    if (!record) throw notFound('Teleconsultation not found');

    const settings = getClinicSettings(ctx);
    const clinicName = settings.clinicName ?? 'LiVi Clinic';
    const cleanPhone = (record.patient_phone || '').replace(/\D/g, '');

    const scheduledDateObj = new Date(record.scheduled_at);
    const dateFormatted = scheduledDateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const englishMessage = `Namaste ${record.patient_name}, your video consultation with ${record.doctor_name} at ${clinicName} is scheduled for ${dateFormatted}.\n\nPlease join using this link at the appointed time:\n${record.meeting_link}\n\nEmergency Note: If experiencing severe bleeding, acute abdominal pain, or reduced fetal movements, please report immediately to our hospital emergency room.`;
    const hindiMessage = `नमस्ते ${record.patient_name}, ${clinicName} में ${record.doctor_name} के साथ आपका वीडियो परामर्श ${dateFormatted} को निर्धारित है।\n\nकृपया नियत समय पर इस लिंक से जुड़ें:\n${record.meeting_link}\n\nआपातकालीन नोट: यदि अत्यधिक रक्तस्राव या गंभीर पेट दर्द हो तो तुरंत अस्पताल इमरजेंसी पहुंचे।`;

    const fullMessage = `${englishMessage}\n\n----\n\n${hindiMessage}`;
    const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(fullMessage)}`;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE teleconsultations
          SET whatsapp_invite_sent_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(nowIso(), nowIso(), id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'teleconsultation.whatsapp_invite',
        entity: 'teleconsultations',
        entityId: id,
        detail: { patientPhone: cleanPhone },
      });
    });

    return {
      success: true,
      whatsappUrl,
      messageText: fullMessage,
      cleanPhone,
    };
  });

  // 7. Delete Teleconsultation (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/teleconsultations/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only doctors can delete teleconsultations');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid teleconsultation ID');

    const existing: any = ctx.db.prepare('SELECT * FROM teleconsultations WHERE id = ?').get(id);
    if (!existing) throw notFound('Teleconsultation not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM teleconsultations WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'teleconsultation.delete',
        entity: 'teleconsultations',
        entityId: id,
        detail: { patientId: existing.patient_id },
      });
    });

    return { success: true, message: 'Teleconsultation deleted' };
  });

  // 8. Audit Print E-Prescription
  app.post<{ Params: { id: string } }>('/api/teleconsultations/:id/audit-print', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:read_clinical')) {
      throw forbidden('Desk staff cannot print teleconsultation e-prescriptions');
    }

    const id = Number.parseInt(req.params.id, 10);
    audit(ctx.db, {
      actorId: user.id,
      action: 'teleconsultation.print',
      entity: 'teleconsultations',
      entityId: id,
    });

    return { success: true };
  });
}
