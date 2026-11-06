import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, forbidden, notFound, parse } from '../errors.js';
import { can } from '../permissions.js';
import { localDate, nowIso } from '../time.js';
import {
  PEDIATRIC_VACCINE_CATALOG,
  PEDIATRIC_VACCINE_MAP,
  calculateVaccineDueDate,
  formatDetailedPediatricAge,
  type VaccineDef,
} from '../pediatricCatalog.js';

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const patchProfileSchema = z
  .object({
    birthWeightKg: z.number().min(0.2).max(12).nullable().optional(),
    birthLengthCm: z.number().min(15).max(90).nullable().optional(),
    birthHeadCircumferenceCm: z.number().min(15).max(70).nullable().optional(),
    gestationalAgeWeeks: z.number().int().min(20).max(45).nullable().optional(),
    deliveryType: z.enum(['normal_vaginal', 'cesarean', 'assisted', 'other']).nullable().optional(),
    birthHospital: optNullableString(200),
    apgar1min: z.number().int().min(0).max(10).nullable().optional(),
    apgar5min: z.number().int().min(0).max(10).nullable().optional(),
    bloodGroup: optNullableString(30),
    birthNotes: optNullableString(1000),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'No fields provided to update');

const patchVaccinationSchema = z
  .object({
    status: z.enum(['pending', 'given', 'scheduled', 'exempt', 'delayed']).optional(),
    givenDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
      .nullable()
      .optional(),
    batchNumber: optNullableString(100),
    routeSite: optNullableString(100),
    administeredBy: optNullableString(120),
    notes: optNullableString(500),
    attachmentId: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'No fields provided to update');

type DbProfileRow = {
  patient_id: number;
  birth_weight_kg: number | null;
  birth_length_cm: number | null;
  birth_head_circumference_cm: number | null;
  gestational_age_weeks: number | null;
  delivery_type: string | null;
  birth_hospital: string | null;
  apgar_1min: number | null;
  apgar_5min: number | null;
  blood_group: string | null;
  birth_notes: string | null;
  updated_at: string;
  updated_by: number;
};

type DbVaccineRow = {
  id: number;
  patient_id: number;
  vaccine_key: string;
  vaccine_name: string;
  milestone_group: string;
  target_disease: string;
  status: string;
  given_date: string | null;
  batch_number: string | null;
  route_site: string | null;
  administered_by: string | null;
  notes: string | null;
  attachment_id: number | null;
  updated_at: string;
  updated_by_name: string | null;
  attachment_title: string | null;
  attachment_original_name: string | null;
};

/** Asserts clinical staff permission (doctor or nurse). */
function assertCanManagePediatrics(req: FastifyRequest) {
  if (!req.user) throw forbidden();
  const role = req.user.role;
  if (!can(role, 'patient:write_clinical') && !can(role, 'care:write_nursing') && !can(role, 'vitals:write')) {
    throw forbidden('Only clinical staff can update pediatric records');
  }
  return req.user;
}

export function registerPediatricRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  // GET /api/patients/:id/pediatric
  app.get('/api/patients/:id/pediatric', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw badRequest('Invalid patient ID');
    }

    const patient = db
      .prepare('SELECT id, full_name, date_of_birth, phone, emergency_contact_name, emergency_contact_phone FROM patients WHERE id = ?')
      .get(patientId) as {
        id: number;
        full_name: string;
        date_of_birth: string | null;
        phone: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
      } | undefined;
    if (!patient) throw notFound('Patient not found');

    const today = localDate(new Date(), cfg.timezone);
    const dob = patient.date_of_birth;
    const ageFormatted = formatDetailedPediatricAge(dob, today);

    // Profile
    const profileRow = db
      .prepare('SELECT * FROM patient_pediatric_profiles WHERE patient_id = ?')
      .get(patientId) as DbProfileRow | undefined;

    const profile = profileRow
      ? {
          birthWeightKg: profileRow.birth_weight_kg,
          birthLengthCm: profileRow.birth_length_cm,
          birthHeadCircumferenceCm: profileRow.birth_head_circumference_cm,
          gestationalAgeWeeks: profileRow.gestational_age_weeks,
          deliveryType: profileRow.delivery_type,
          birthHospital: profileRow.birth_hospital,
          apgar1min: profileRow.apgar_1min,
          apgar5min: profileRow.apgar_5min,
          bloodGroup: profileRow.blood_group,
          birthNotes: profileRow.birth_notes,
          updatedAt: profileRow.updated_at,
        }
      : null;

    // Vaccinations
    const savedVaccines = db
      .prepare(
        `SELECT v.id, v.patient_id, v.vaccine_key, v.vaccine_name, v.milestone_group, v.target_disease,
                v.status, v.given_date, v.batch_number, v.route_site, v.administered_by, v.notes,
                v.attachment_id, v.updated_at,
                u.full_name AS updated_by_name,
                a.title AS attachment_title, a.original_name AS attachment_original_name
         FROM patient_vaccinations v
         LEFT JOIN users u ON u.id = v.updated_by
         LEFT JOIN attachments a ON a.id = v.attachment_id AND a.voided_at IS NULL
         WHERE v.patient_id = ?`
      )
      .all(patientId) as DbVaccineRow[];

    const savedMap = new Map<string, DbVaccineRow>(savedVaccines.map((r) => [r.vaccine_key, r]));

    const vaccinations = PEDIATRIC_VACCINE_CATALOG.map((def: VaccineDef) => {
      const saved = savedMap.get(def.key);
      const dueDate = calculateVaccineDueDate(dob, def.daysOffset);
      const status = saved?.status ?? 'pending';
      const isOverdue = Boolean(dueDate && today > dueDate && status === 'pending');
      const isDueNow = Boolean(
        dueDate &&
          status === 'pending' &&
          Math.abs(new Date(dueDate).getTime() - new Date(today).getTime()) <= 14 * 24 * 3600 * 1000
      );

      return {
        id: saved?.id ?? null,
        vaccineKey: def.key,
        milestone: def.milestone,
        milestoneLabel: def.milestoneLabel,
        vaccineName: def.name,
        targetDisease: def.targetDisease,
        recommendedAge: def.recommendedAge,
        standardRoute: def.standardRoute,
        standardDose: def.standardDose,
        isMandatory: Boolean(def.isMandatory),
        dueDate,
        isOverdue,
        isDueNow,
        status,
        givenDate: saved?.given_date ?? null,
        batchNumber: saved?.batch_number ?? null,
        routeSite: saved?.route_site ?? def.standardRoute,
        administeredBy: saved?.administered_by ?? null,
        notes: saved?.notes ?? null,
        attachmentId: saved?.attachment_id ?? null,
        attachmentTitle: saved?.attachment_title ?? null,
        attachmentOriginalName: saved?.attachment_original_name ?? null,
        updatedByName: saved?.updated_by_name ?? null,
        updatedAt: saved?.updated_at ?? null,
      };
    });

    // Growth progression from vitals recorded in consultations
    const vitalsRows = db
      .prepare(
        `SELECT v.weight_kg, v.height_cm, vis.visit_at
         FROM visit_vitals v
         JOIN visits vis ON vis.id = v.visit_id
         WHERE vis.patient_id = ? AND (v.weight_kg IS NOT NULL OR v.height_cm IS NOT NULL)
         ORDER BY vis.visit_at ASC`
      )
      .all(patientId) as { weight_kg: number | null; height_cm: number | null; visit_at: string }[];

    const latestWithWeight = [...vitalsRows].reverse().find((r) => r.weight_kg != null);
    const latestWithHeight = [...vitalsRows].reverse().find((r) => r.height_cm != null);
    const birthWeight = profile?.birthWeightKg ?? null;
    const currentWeight = latestWithWeight?.weight_kg ?? birthWeight;

    const totalWeightGainKg =
      birthWeight != null && currentWeight != null
        ? Math.round((currentWeight - birthWeight) * 100) / 100
        : null;

    const doubledBirthWeight =
      birthWeight != null && currentWeight != null ? currentWeight >= 2 * birthWeight : false;
    const tripledBirthWeight =
      birthWeight != null && currentWeight != null ? currentWeight >= 3 * birthWeight : false;

    // Summary
    const totalVaccines = vaccinations.length;
    const givenCount = vaccinations.filter((v) => v.status === 'given').length;
    const pendingCount = vaccinations.filter((v) => v.status === 'pending').length;
    const overdueCount = vaccinations.filter((v) => v.isOverdue).length;
    const exemptCount = vaccinations.filter((v) => v.status === 'exempt').length;
    const applicable = totalVaccines - exemptCount;
    const completionPercentage = applicable > 0 ? Math.round((givenCount / applicable) * 100) : 100;

    return {
      patientId,
      patientName: patient.full_name,
      phone: patient.phone || patient.emergency_contact_phone,
      parentName: patient.emergency_contact_name,
      dateOfBirth: dob,
      ageFormatted,
      profile,
      vaccinations,
      growth: {
        birthWeightKg: birthWeight,
        latestWeightKg: currentWeight,
        totalWeightGainKg,
        birthLengthCm: profile?.birthLengthCm ?? null,
        latestLengthCm: latestWithHeight?.height_cm ?? profile?.birthLengthCm ?? null,
        birthHeadCircumferenceCm: profile?.birthHeadCircumferenceCm ?? null,
        doubledBirthWeight,
        tripledBirthWeight,
        history: vitalsRows.map((r) => ({
          date: r.visit_at.slice(0, 10),
          weightKg: r.weight_kg,
          heightCm: r.height_cm,
        })),
      },
      summary: {
        totalVaccines,
        givenCount,
        pendingCount,
        overdueCount,
        exemptCount,
        completionPercentage,
      },
    };
  });

  // PATCH /api/patients/:id/pediatric/profile
  app.patch('/api/patients/:id/pediatric/profile', async (req) => {
    const user = assertCanManagePediatrics(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw badRequest('Invalid patient ID');
    }

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const body = parse(patchProfileSchema, req.body);
    const at = nowIso();

    const existing = db
      .prepare('SELECT * FROM patient_pediatric_profiles WHERE patient_id = ?')
      .get(patientId) as DbProfileRow | undefined;

    const val = (k: keyof typeof body, fallback: string | number | null = null): string | number | null => {
      const v = body[k];
      return (v !== undefined ? v : fallback) ?? null;
    };

    db.prepare(
      `INSERT INTO patient_pediatric_profiles (
         patient_id, birth_weight_kg, birth_length_cm, birth_head_circumference_cm,
         gestational_age_weeks, delivery_type, birth_hospital, apgar_1min, apgar_5min,
         blood_group, birth_notes, updated_by, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(patient_id) DO UPDATE SET
         birth_weight_kg = excluded.birth_weight_kg,
         birth_length_cm = excluded.birth_length_cm,
         birth_head_circumference_cm = excluded.birth_head_circumference_cm,
         gestational_age_weeks = excluded.gestational_age_weeks,
         delivery_type = excluded.delivery_type,
         birth_hospital = excluded.birth_hospital,
         apgar_1min = excluded.apgar_1min,
         apgar_5min = excluded.apgar_5min,
         blood_group = excluded.blood_group,
         birth_notes = excluded.birth_notes,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    ).run(
      patientId,
      val('birthWeightKg', existing?.birth_weight_kg ?? null),
      val('birthLengthCm', existing?.birth_length_cm ?? null),
      val('birthHeadCircumferenceCm', existing?.birth_head_circumference_cm ?? null),
      val('gestationalAgeWeeks', existing?.gestational_age_weeks ?? null),
      val('deliveryType', existing?.delivery_type ?? null),
      val('birthHospital', existing?.birth_hospital ?? null),
      val('apgar1min', existing?.apgar_1min ?? null),
      val('apgar5min', existing?.apgar_5min ?? null),
      val('bloodGroup', existing?.blood_group ?? null),
      val('birthNotes', existing?.birth_notes ?? null),
      user.id,
      at
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric.profile_update',
      entity: 'patient',
      entityId: patientId,
      detail: body,
    });

    const updated = db
      .prepare('SELECT * FROM patient_pediatric_profiles WHERE patient_id = ?')
      .get(patientId) as DbProfileRow;

    return {
      birthWeightKg: updated.birth_weight_kg,
      birthLengthCm: updated.birth_length_cm,
      birthHeadCircumferenceCm: updated.birth_head_circumference_cm,
      gestationalAgeWeeks: updated.gestational_age_weeks,
      deliveryType: updated.delivery_type,
      birthHospital: updated.birth_hospital,
      apgar1min: updated.apgar_1min,
      apgar5min: updated.apgar_5min,
      bloodGroup: updated.blood_group,
      birthNotes: updated.birth_notes,
      updatedAt: updated.updated_at,
    };
  });

  // PATCH /api/patients/:id/pediatric/vaccinations/:vaccineKey
  app.patch('/api/patients/:id/pediatric/vaccinations/:vaccineKey', async (req) => {
    const user = assertCanManagePediatrics(req);
    const { id, vaccineKey } = req.params as { id: string; vaccineKey: string };
    const patientId = Number(id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw badRequest('Invalid patient ID');
    }

    const def = PEDIATRIC_VACCINE_MAP[vaccineKey];
    if (!def) {
      throw badRequest(`Unknown pediatric vaccine key: ${vaccineKey}`);
    }

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const body = parse(patchVaccinationSchema, req.body);

    if (body.givenDate) {
      const today = localDate(new Date(), cfg.timezone);
      if (body.givenDate > today) {
        throw badRequest('Given date cannot be in the future', [
          { field: 'givenDate', message: 'Cannot be in the future' },
        ]);
      }
    }

    if (body.attachmentId != null) {
      const att = db
        .prepare('SELECT id FROM attachments WHERE id = ? AND patient_id = ? AND voided_at IS NULL')
        .get(body.attachmentId, patientId);
      if (!att) {
        throw badRequest('Document attachment not found or does not belong to this patient', [
          { field: 'attachmentId', message: 'Document not found' },
        ]);
      }
    }

    const existing = db
      .prepare('SELECT * FROM patient_vaccinations WHERE patient_id = ? AND vaccine_key = ?')
      .get(patientId, vaccineKey) as
      | {
          id: number;
          status: string;
          given_date: string | null;
          batch_number: string | null;
          route_site: string | null;
          administered_by: string | null;
          notes: string | null;
          attachment_id: number | null;
        }
      | undefined;

    const newStatus = body.status !== undefined ? body.status : (existing?.status ?? 'pending');
    const newDate = body.givenDate !== undefined ? body.givenDate : (existing?.given_date ?? null);
    const newBatch = body.batchNumber !== undefined ? body.batchNumber : (existing?.batch_number ?? null);
    const newRoute = body.routeSite !== undefined ? body.routeSite : (existing?.route_site ?? def.standardRoute);
    const newAdmin = body.administeredBy !== undefined ? body.administeredBy : (existing?.administered_by ?? null);
    const newNotes = body.notes !== undefined ? body.notes : (existing?.notes ?? null);
    const newAtt = body.attachmentId !== undefined ? body.attachmentId : (existing?.attachment_id ?? null);
    const at = nowIso();

    db.prepare(
      `INSERT INTO patient_vaccinations (
         patient_id, vaccine_key, vaccine_name, milestone_group, target_disease, status,
         given_date, batch_number, route_site, administered_by, notes, attachment_id, updated_by, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(patient_id, vaccine_key) DO UPDATE SET
         status = excluded.status,
         given_date = excluded.given_date,
         batch_number = excluded.batch_number,
         route_site = excluded.route_site,
         administered_by = excluded.administered_by,
         notes = excluded.notes,
         attachment_id = excluded.attachment_id,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    ).run(
      patientId,
      vaccineKey,
      def.name,
      def.milestone,
      def.targetDisease,
      newStatus,
      newDate,
      newBatch,
      newRoute,
      newAdmin,
      newNotes,
      newAtt,
      user.id,
      at
    );

    audit(db, {
      actorId: user.id,
      action: 'vaccination.record',
      entity: 'patient',
      entityId: patientId,
      detail: {
        vaccineKey,
        vaccineName: def.name,
        status: newStatus,
        givenDate: newDate,
      },
    });

    const updated = db
      .prepare(
        `SELECT v.id, v.patient_id, v.vaccine_key, v.vaccine_name, v.milestone_group, v.target_disease,
                v.status, v.given_date, v.batch_number, v.route_site, v.administered_by, v.notes,
                v.attachment_id, v.updated_at,
                u.full_name AS updated_by_name,
                a.title AS attachment_title, a.original_name AS attachment_original_name
         FROM patient_vaccinations v
         LEFT JOIN users u ON u.id = v.updated_by
         LEFT JOIN attachments a ON a.id = v.attachment_id AND a.voided_at IS NULL
         WHERE v.patient_id = ? AND v.vaccine_key = ?`
      )
      .get(patientId, vaccineKey) as DbVaccineRow;

    return {
      id: updated.id,
      vaccineKey: def.key,
      milestone: def.milestone,
      milestoneLabel: def.milestoneLabel,
      vaccineName: def.name,
      targetDisease: def.targetDisease,
      recommendedAge: def.recommendedAge,
      standardRoute: def.standardRoute,
      standardDose: def.standardDose,
      isMandatory: Boolean(def.isMandatory),
      status: updated.status,
      givenDate: updated.given_date,
      batchNumber: updated.batch_number,
      routeSite: updated.route_site,
      administeredBy: updated.administered_by,
      notes: updated.notes,
      attachmentId: updated.attachment_id,
      attachmentTitle: updated.attachment_title,
      attachmentOriginalName: updated.attachment_original_name,
      updatedByName: updated.updated_by_name,
      updatedAt: updated.updated_at,
    };
  });
}
