import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import { PEDIATRIC_VACCINE_CATALOG } from '../pediatricCatalog.js';

function assertCanManageDischarge(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'discharge:write')
  ) {
    throw forbidden('Only clinical staff can manage obstetric discharge summaries');
  }
  return user;
}

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

export const deliveryModes = [
  'normal_vaginal',
  'assisted_vacuum',
  'assisted_forceps',
  'elective_lscs',
  'emergency_lscs',
  'vbac',
] as const;

export const perineumWoundStatuses = [
  'intact',
  'episiotomy_healed',
  'perineal_tear_repaired',
  'lscs_wound_clean',
  'superficial_dehiscence',
  'infected',
  'other',
] as const;

export const fundalInvolutions = [
  'contracted_normal',
  'well_contracted',
  'subinvoluted',
  'tender',
  'boggy',
] as const;

export const lochiaCharacters = [
  'rubra',
  'serosa',
  'alba',
  'excessive',
  'foul_smelling',
] as const;

export const lactationStatuses = [
  'established',
  'initiating',
  'suppressed',
  'cracked_nipples',
  'engorgement',
  'mastitis',
] as const;

export const contraceptionMethods = [
  'ppiucd_inserted',
  'progestin_only_pill',
  'lactational_amenorrhea',
  'barrier_condom',
  'tubal_sterilization',
  'inj_depo',
  'undecided',
  'none',
] as const;

export const obstetricDischargeSchema = z
  .object({
    admissionId: z.number().int().positive().nullable().optional(),
    dischargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),

    // Delivery Details
    deliveryAt: optNullableString(50),
    deliveryMode: z.enum(deliveryModes),
    deliveryIndication: optNullableString(500),
    deliveryNotes: optNullableString(2000),
    primaryObstetrician: optNullableString(150),

    // Maternal Puerperium & Involution
    perineumWoundStatus: z.enum(perineumWoundStatuses).default('intact'),
    perineumNotes: optNullableString(500),
    fundalInvolution: z.enum(fundalInvolutions).default('contracted_normal'),
    fundalHeightCm: optNullableString(100),
    lochiaCharacter: z.enum(lochiaCharacters).default('rubra'),
    lochiaNotes: optNullableString(500),
    lactationStatus: z.enum(lactationStatuses).default('established'),
    breastExamination: optNullableString(500),
    bladderBowelStatus: optNullableString(300),

    // Maternal Vitals
    dischargeBpSystolic: optNullableNumber(60, 260),
    dischargeBpDiastolic: optNullableNumber(30, 160),
    dischargePulse: optNullableNumber(30, 220),
    dischargeTempF: optNullableNumber(90, 110),
    dischargeSpo2: optNullableNumber(50, 100),

    // Contraception
    contraceptionCounselled: z.boolean().default(true),
    contraceptionChosen: z.enum(contraceptionMethods).default('undecided'),
    contraceptionNotes: optNullableString(500),

    // Medications & Alarm Signs
    dischargeMedicinesText: optNullableString(2000),
    alarmSignsCounselled: z.boolean().default(true),

    // Newborn Summary
    babyName: optNullableString(150),
    babyGender: z.enum(['female', 'male', 'ambiguous']).default('female'),
    babyBirthWeightGrams: optNullableNumber(300, 7000),
    babyDischargeWeightGrams: optNullableNumber(300, 7000),
    babyLengthCm: optNullableNumber(20, 70),
    babyHcCm: optNullableNumber(15, 50),
    babyGestationalAgeWeeks: optNullableNumber(20, 44),
    babyGestationalAgeDays: optNullableNumber(0, 6),
    babyApgar1min: optNullableNumber(0, 10),
    babyApgar5min: optNullableNumber(0, 10),
    babyCryAtBirth: z.enum(['immediate_vigorous', 'delayed', 'required_stimulation', 'none']).default('immediate_vigorous'),
    babyResuscitationDetails: optNullableString(500),
    babyBloodGroup: optNullableString(20),

    // Neonatal Exam
    neonatalExam: z.record(z.string(), z.string()).default({}),
    neonatalFeedingMethod: z.enum(['exclusive_breastfeeding', 'expressed_breast_milk', 'mixed_feeding', 'formula_feeding']).default('exclusive_breastfeeding'),
    meconiumPassed: z.boolean().default(true),
    urinePassed: z.boolean().default(true),
    jaundiceAssessment: z.enum(['none', 'mild_physiological', 'phototherapy_required', 'pathological']).default('none'),

    // Immunizations
    bcgGiven: z.boolean().default(true),
    bcgDate: optNullableString(50),
    opvZeroGiven: z.boolean().default(true),
    opvZeroDate: optNullableString(50),
    hepbBirthGiven: z.boolean().default(true),
    hepbBirthDate: optNullableString(50),
    hearingScreenResult: z.enum(['pass', 'refer', 'not_screened']).default('pass'),
    metabolicScreenResult: z.enum(['normal', 'pending', 'abnormal', 'not_screened']).default('normal'),

    // Follow-up
    maternalFollowupDate: optNullableString(50),
    newbornFollowupDate: optNullableString(50),
    consultantSpecialInstructions: optNullableString(2000),

    status: z.enum(['draft', 'finalized']).default('finalized'),
    autoCreateBabyPatient: z.boolean().default(false),
  })
  .strict();

export const patchObstetricDischargeSchema = z
  .object({
    dischargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
    deliveryAt: optNullableString(50),
    deliveryMode: z.enum(deliveryModes).optional(),
    deliveryIndication: optNullableString(500),
    deliveryNotes: optNullableString(2000),
    primaryObstetrician: optNullableString(150),
    perineumWoundStatus: z.enum(perineumWoundStatuses).optional(),
    perineumNotes: optNullableString(500),
    fundalInvolution: z.enum(fundalInvolutions).optional(),
    fundalHeightCm: optNullableString(100),
    lochiaCharacter: z.enum(lochiaCharacters).optional(),
    lochiaNotes: optNullableString(500),
    lactationStatus: z.enum(lactationStatuses).optional(),
    breastExamination: optNullableString(500),
    bladderBowelStatus: optNullableString(300),
    dischargeBpSystolic: optNullableNumber(60, 260),
    dischargeBpDiastolic: optNullableNumber(30, 160),
    dischargePulse: optNullableNumber(30, 220),
    dischargeTempF: optNullableNumber(90, 110),
    dischargeSpo2: optNullableNumber(50, 100),
    contraceptionCounselled: z.boolean().optional(),
    contraceptionChosen: z.enum(contraceptionMethods).optional(),
    contraceptionNotes: optNullableString(500),
    dischargeMedicinesText: optNullableString(2000),
    alarmSignsCounselled: z.boolean().optional(),
    babyGender: z.enum(['female', 'male', 'ambiguous']).optional(),
    babyBirthWeightGrams: optNullableNumber(300, 7000),
    babyDischargeWeightGrams: optNullableNumber(300, 7000),
    babyLengthCm: optNullableNumber(20, 70),
    babyHcCm: optNullableNumber(15, 50),
    babyGestationalAgeWeeks: optNullableNumber(20, 44),
    babyGestationalAgeDays: optNullableNumber(0, 6),
    babyApgar1min: optNullableNumber(0, 10),
    babyApgar5min: optNullableNumber(0, 10),
    babyCryAtBirth: z.enum(['immediate_vigorous', 'delayed', 'required_stimulation', 'none']).optional(),
    babyResuscitationDetails: optNullableString(500),
    babyBloodGroup: optNullableString(20),
    neonatalExam: z.record(z.string(), z.string()).optional(),
    neonatalFeedingMethod: z.enum(['exclusive_breastfeeding', 'expressed_breast_milk', 'mixed_feeding', 'formula_feeding']).optional(),
    meconiumPassed: z.boolean().optional(),
    urinePassed: z.boolean().optional(),
    jaundiceAssessment: z.enum(['none', 'mild_physiological', 'phototherapy_required', 'pathological']).optional(),
    bcgGiven: z.boolean().optional(),
    bcgDate: optNullableString(50),
    opvZeroGiven: z.boolean().optional(),
    opvZeroDate: optNullableString(50),
    hepbBirthGiven: z.boolean().optional(),
    hepbBirthDate: optNullableString(50),
    hearingScreenResult: z.enum(['pass', 'refer', 'not_screened']).optional(),
    metabolicScreenResult: z.enum(['normal', 'pending', 'abnormal', 'not_screened']).optional(),
    maternalFollowupDate: optNullableString(50),
    newbornFollowupDate: optNullableString(50),
    consultantSpecialInstructions: optNullableString(2000),
    status: z.enum(['draft', 'finalized']).optional(),
  })
  .strict();

type DbObstetricDischargeRow = {
  id: number;
  patient_id: number;
  admission_id: number | null;
  discharge_date: string;
  delivery_at: string | null;
  delivery_mode: string;
  delivery_indication: string | null;
  delivery_notes: string | null;
  primary_obstetrician: string | null;
  perineum_wound_status: string;
  perineum_notes: string | null;
  fundal_involution: string;
  fundal_height_cm: string | null;
  lochia_character: string;
  lochia_notes: string | null;
  lactation_status: string;
  breast_examination: string | null;
  bladder_bowel_status: string | null;
  discharge_bp_systolic: number | null;
  discharge_bp_diastolic: number | null;
  discharge_pulse: number | null;
  discharge_temp_f: number | null;
  discharge_spo2: number | null;
  contraception_counselled: number;
  contraception_chosen: string;
  contraception_notes: string | null;
  discharge_medicines_text: string | null;
  alarm_signs_counselled: number;
  baby_gender: string;
  baby_birth_weight_grams: number | null;
  baby_discharge_weight_grams: number | null;
  baby_length_cm: number | null;
  baby_hc_cm: number | null;
  baby_gestational_age_weeks: number | null;
  baby_gestational_age_days: number | null;
  baby_apgar_1min: number | null;
  baby_apgar_5min: number | null;
  baby_cry_at_birth: string;
  baby_resuscitation_details: string | null;
  baby_blood_group: string | null;
  baby_pediatric_patient_id: number | null;
  neonatal_exam_json: string;
  neonatal_feeding_method: string;
  meconium_passed: number;
  urine_passed: number;
  jaundice_assessment: string;
  bcg_given: number;
  bcg_date: string | null;
  opv_zero_given: number;
  opv_zero_date: string | null;
  hepb_birth_given: number;
  hepb_birth_date: string | null;
  hearing_screen_result: string | null;
  metabolic_screen_result: string | null;
  maternal_followup_date: string | null;
  newborn_followup_date: string | null;
  consultant_special_instructions: string | null;
  status: string;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  admission_number?: string | null;
  patient_number?: string;
  patient_name?: string;
  date_of_birth?: string | null;
  patient_phone?: string | null;
  gravida?: number | null;
  para?: number | null;
  baby_patient_number?: string | null;
  baby_patient_name?: string | null;
};

function safeJson(str: string): Record<string, string> {
  try {
    const parsed = JSON.parse(str);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mapRow(r: DbObstetricDischargeRow) {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    admissionNumber: r.admission_number ?? null,
    dischargeDate: r.discharge_date,
    deliveryAt: r.delivery_at,
    deliveryMode: r.delivery_mode,
    deliveryIndication: r.delivery_indication,
    deliveryNotes: r.delivery_notes,
    primaryObstetrician: r.primary_obstetrician,
    perineumWoundStatus: r.perineum_wound_status,
    perineumNotes: r.perineum_notes,
    fundalInvolution: r.fundal_involution,
    fundalHeightCm: r.fundal_height_cm,
    lochiaCharacter: r.lochia_character,
    lochiaNotes: r.lochia_notes,
    lactationStatus: r.lactation_status,
    breastExamination: r.breast_examination,
    bladderBowelStatus: r.bladder_bowel_status,
    dischargeBpSystolic: r.discharge_bp_systolic,
    dischargeBpDiastolic: r.discharge_bp_diastolic,
    dischargePulse: r.discharge_pulse,
    dischargeTempF: r.discharge_temp_f,
    dischargeSpo2: r.discharge_spo2,
    contraceptionCounselled: r.contraception_counselled === 1,
    contraceptionChosen: r.contraception_chosen,
    contraceptionNotes: r.contraception_notes,
    dischargeMedicinesText: r.discharge_medicines_text,
    alarmSignsCounselled: r.alarm_signs_counselled === 1,
    babyGender: r.baby_gender,
    babyBirthWeightGrams: r.baby_birth_weight_grams,
    babyDischargeWeightGrams: r.baby_discharge_weight_grams,
    babyLengthCm: r.baby_length_cm,
    babyHcCm: r.baby_hc_cm,
    babyGestationalAgeWeeks: r.baby_gestational_age_weeks,
    babyGestationalAgeDays: r.baby_gestational_age_days,
    babyApgar1min: r.baby_apgar_1min,
    babyApgar5min: r.baby_apgar_5min,
    babyCryAtBirth: r.baby_cry_at_birth,
    babyResuscitationDetails: r.baby_resuscitation_details,
    babyBloodGroup: r.baby_blood_group,
    babyPediatricPatientId: r.baby_pediatric_patient_id,
    babyPatientNumber: r.baby_patient_number ?? null,
    babyPatientName: r.baby_patient_name ?? null,
    neonatalExam: safeJson(r.neonatal_exam_json),
    neonatalFeedingMethod: r.neonatal_feeding_method,
    meconiumPassed: r.meconium_passed === 1,
    urinePassed: r.urine_passed === 1,
    jaundiceAssessment: r.jaundice_assessment,
    bcgGiven: r.bcg_given === 1,
    bcgDate: r.bcg_date,
    opvZeroGiven: r.opv_zero_given === 1,
    opvZeroDate: r.opv_zero_date,
    hepbBirthGiven: r.hepb_birth_given === 1,
    hepbBirthDate: r.hepb_birth_date,
    hearingScreenResult: r.hearing_screen_result,
    metabolicScreenResult: r.metabolic_screen_result,
    maternalFollowupDate: r.maternal_followup_date,
    newbornFollowupDate: r.newborn_followup_date,
    consultantSpecialInstructions: r.consultant_special_instructions,
    status: r.status,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patientNumber: r.patient_number,
    patientName: r.patient_name,
    dateOfBirth: r.date_of_birth,
    patientPhone: r.patient_phone,
    gravida: r.gravida,
    para: r.para,
  };
}

export function registerObstetricDischargeRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/patients/:id/obstetric-discharges
  app.get('/api/patients/:id/obstetric-discharges', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT d.*,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name,
                adm.admission_number,
                bp.patient_number AS baby_patient_number,
                bp.full_name AS baby_patient_name
         FROM obstetric_discharge_summaries d
         LEFT JOIN users cu ON cu.id = d.created_by
         LEFT JOIN users uu ON uu.id = d.updated_by
         LEFT JOIN admissions adm ON adm.id = d.admission_id
         LEFT JOIN patients bp ON bp.id = d.baby_pediatric_patient_id
         WHERE d.patient_id = ?
         ORDER BY d.discharge_date DESC, d.id DESC`
      )
      .all(patientId) as DbObstetricDischargeRow[];

    return {
      patientId,
      discharges: rows.map(mapRow),
    };
  });

  // GET /api/obstetric-discharges/:id
  app.get('/api/obstetric-discharges/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid discharge ID');

    const row = db
      .prepare(
        `SELECT d.*,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name,
                adm.admission_number,
                p.patient_number,
                p.full_name AS patient_name,
                p.date_of_birth,
                p.phone AS patient_phone,
                p.gravida,
                p.para,
                bp.patient_number AS baby_patient_number,
                bp.full_name AS baby_patient_name
         FROM obstetric_discharge_summaries d
         JOIN patients p ON p.id = d.patient_id
         LEFT JOIN users cu ON cu.id = d.created_by
         LEFT JOIN users uu ON uu.id = d.updated_by
         LEFT JOIN admissions adm ON adm.id = d.admission_id
         LEFT JOIN patients bp ON bp.id = d.baby_pediatric_patient_id
         WHERE d.id = ?`
      )
      .get(id) as DbObstetricDischargeRow | undefined;

    if (!row) throw notFound('Obstetric discharge summary not found');
    return mapRow(row);
  });

  // POST /api/patients/:id/obstetric-discharges
  app.post('/api/patients/:id/obstetric-discharges', async (req, reply) => {
    const user = assertCanManageDischarge(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const mother = db
      .prepare('SELECT id, full_name, phone FROM patients WHERE id = ?')
      .get(patientId) as { id: number; full_name: string; phone: string | null } | undefined;
    if (!mother) throw notFound('Patient not found');

    const b = parse(obstetricDischargeSchema, req.body);
    const now = nowIso();

    const newId = tx(db, () => {
      let babyPatientId: number | null = null;

      // Auto-create baby patient record if requested
      if (b.autoCreateBabyPatient) {
        const babyName = b.babyName?.trim() || `Baby of ${mother.full_name}`;
        const babyDob = b.deliveryAt ? b.deliveryAt.slice(0, 10) : b.dischargeDate;

        // Generate patient number via counter
        db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'patient'").run();
        const n = (db.prepare("SELECT value FROM counters WHERE name = 'patient'").get() as { value: number }).value;
        const babyPatNum = 'P' + String(n).padStart(6, '0');

        const patRes = db
          .prepare(
            `INSERT INTO patients (
               patient_number, full_name, date_of_birth,
               phone, created_by, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(babyPatNum, babyName, babyDob, mother.phone, user.id, now, now);
        babyPatientId = Number(patRes.lastInsertRowid);
        audit(db, { actorId: user.id, action: 'patient.create', entity: 'patient', entityId: babyPatientId, detail: { patientNumber: babyPatNum } });

        // Map delivery mode to pediatric delivery_type
        let pedDeliveryType: 'normal_vaginal' | 'cesarean' | 'assisted' | 'other' = 'normal_vaginal';
        if (b.deliveryMode.includes('lscs')) pedDeliveryType = 'cesarean';
        else if (b.deliveryMode.includes('vacuum') || b.deliveryMode.includes('forceps')) pedDeliveryType = 'assisted';

        // Insert pediatric profile
        db.prepare(
          `INSERT INTO patient_pediatric_profiles (
             patient_id, birth_weight_kg, birth_length_cm, birth_head_circumference_cm,
             gestational_age_weeks, delivery_type, apgar_1min, apgar_5min,
             blood_group, updated_by, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          babyPatientId,
          b.babyBirthWeightGrams ? b.babyBirthWeightGrams / 1000 : null,
          b.babyLengthCm ?? null,
          b.babyHcCm ?? null,
          b.babyGestationalAgeWeeks ?? null,
          pedDeliveryType,
          b.babyApgar1min ?? null,
          b.babyApgar5min ?? null,
          b.babyBloodGroup ?? null,
          user.id,
          now
        );

        // Record birth immunizations in patient_vaccinations
        const birthDate = b.deliveryAt ? b.deliveryAt.slice(0, 10) : b.dischargeDate;
        const catalogMap = new Map(PEDIATRIC_VACCINE_CATALOG.map((v) => [v.key, v]));

        const recordVaccine = (key: string, given: boolean, givenDate?: string | null) => {
          const vDef = catalogMap.get(key);
          if (!vDef) return;
          db.prepare(
            `INSERT INTO patient_vaccinations (
               patient_id, vaccine_key, vaccine_name, milestone_group, target_disease,
               status, given_date, updated_by, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            babyPatientId,
            vDef.key,
            vDef.name,
            vDef.milestone,
            vDef.targetDisease,
            given ? 'given' : 'pending',
            given ? givenDate || birthDate : null,
            user.id,
            now
          );
        };

        recordVaccine('bcg', b.bcgGiven, b.bcgDate);
        recordVaccine('opv_0', b.opvZeroGiven, b.opvZeroDate);
        recordVaccine('hepb_0', b.hepbBirthGiven, b.hepbBirthDate);
      }

      const stmt = db.prepare(`
        INSERT INTO obstetric_discharge_summaries (
          patient_id, admission_id, discharge_date, delivery_at, delivery_mode, delivery_indication, delivery_notes, primary_obstetrician,
          perineum_wound_status, perineum_notes, fundal_involution, fundal_height_cm, lochia_character, lochia_notes,
          lactation_status, breast_examination, bladder_bowel_status,
          discharge_bp_systolic, discharge_bp_diastolic, discharge_pulse, discharge_temp_f, discharge_spo2,
          contraception_counselled, contraception_chosen, contraception_notes,
          discharge_medicines_text, alarm_signs_counselled,
          baby_gender, baby_birth_weight_grams, baby_discharge_weight_grams, baby_length_cm, baby_hc_cm,
          baby_gestational_age_weeks, baby_gestational_age_days, baby_apgar_1min, baby_apgar_5min, baby_cry_at_birth,
          baby_resuscitation_details, baby_blood_group, baby_pediatric_patient_id,
          neonatal_exam_json, neonatal_feeding_method, meconium_passed, urine_passed, jaundice_assessment,
          bcg_given, bcg_date, opv_zero_given, opv_zero_date, hepb_birth_given, hepb_birth_date,
          hearing_screen_result, metabolic_screen_result,
          maternal_followup_date, newborn_followup_date, consultant_special_instructions,
          status, created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `);

      const res = stmt.run(
        patientId,
        b.admissionId ?? null,
        b.dischargeDate,
        b.deliveryAt ?? null,
        b.deliveryMode,
        b.deliveryIndication ?? null,
        b.deliveryNotes ?? null,
        b.primaryObstetrician ?? null,
        b.perineumWoundStatus,
        b.perineumNotes ?? null,
        b.fundalInvolution,
        b.fundalHeightCm ?? null,
        b.lochiaCharacter,
        b.lochiaNotes ?? null,
        b.lactationStatus,
        b.breastExamination ?? null,
        b.bladderBowelStatus ?? null,
        b.dischargeBpSystolic ?? null,
        b.dischargeBpDiastolic ?? null,
        b.dischargePulse ?? null,
        b.dischargeTempF ?? null,
        b.dischargeSpo2 ?? null,
        b.contraceptionCounselled ? 1 : 0,
        b.contraceptionChosen,
        b.contraceptionNotes ?? null,
        b.dischargeMedicinesText ?? null,
        b.alarmSignsCounselled ? 1 : 0,
        b.babyGender,
        b.babyBirthWeightGrams ?? null,
        b.babyDischargeWeightGrams ?? null,
        b.babyLengthCm ?? null,
        b.babyHcCm ?? null,
        b.babyGestationalAgeWeeks ?? null,
        b.babyGestationalAgeDays ?? null,
        b.babyApgar1min ?? null,
        b.babyApgar5min ?? null,
        b.babyCryAtBirth,
        b.babyResuscitationDetails ?? null,
        b.babyBloodGroup ?? null,
        babyPatientId,
        JSON.stringify(b.neonatalExam),
        b.neonatalFeedingMethod,
        b.meconiumPassed ? 1 : 0,
        b.urinePassed ? 1 : 0,
        b.jaundiceAssessment,
        b.bcgGiven ? 1 : 0,
        b.bcgDate ?? null,
        b.opvZeroGiven ? 1 : 0,
        b.opvZeroDate ?? null,
        b.hepbBirthGiven ? 1 : 0,
        b.hepbBirthDate ?? null,
        b.hearingScreenResult,
        b.metabolicScreenResult,
        b.maternalFollowupDate ?? null,
        b.newbornFollowupDate ?? null,
        b.consultantSpecialInstructions ?? null,
        b.status,
        user.id,
        user.id,
        now,
        now
      );

      return Number(res.lastInsertRowid);
    });

    audit(db, {
      actorId: user.id,
      action: 'obstetric_discharge.create',
      entity: 'patient',
      entityId: patientId,
      detail: {
        dischargeId: newId,
        deliveryMode: b.deliveryMode,
        babyGender: b.babyGender,
        babyBirthWeightGrams: b.babyBirthWeightGrams,
        status: b.status,
      },
    });

    const created = db.prepare('SELECT * FROM obstetric_discharge_summaries WHERE id = ?').get(newId) as DbObstetricDischargeRow;
    return reply.status(201).send(mapRow(created));
  });

  // PATCH /api/obstetric-discharges/:id
  app.patch('/api/obstetric-discharges/:id', async (req) => {
    const user = assertCanManageDischarge(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid discharge ID');

    const existing = db.prepare('SELECT * FROM obstetric_discharge_summaries WHERE id = ?').get(id) as DbObstetricDischargeRow | undefined;
    if (!existing) throw notFound('Obstetric discharge summary not found');

    const b = parse(patchObstetricDischargeSchema, req.body);
    const now = nowIso();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const stringMap: Record<string, string> = {
      dischargeDate: 'discharge_date',
      deliveryAt: 'delivery_at',
      deliveryMode: 'delivery_mode',
      deliveryIndication: 'delivery_indication',
      deliveryNotes: 'delivery_notes',
      primaryObstetrician: 'primary_obstetrician',
      perineumWoundStatus: 'perineum_wound_status',
      perineumNotes: 'perineum_notes',
      fundalInvolution: 'fundal_involution',
      fundalHeightCm: 'fundal_height_cm',
      lochiaCharacter: 'lochia_character',
      lochiaNotes: 'lochia_notes',
      lactationStatus: 'lactation_status',
      breastExamination: 'breast_examination',
      bladderBowelStatus: 'bladder_bowel_status',
      dischargeBpSystolic: 'discharge_bp_systolic',
      dischargeBpDiastolic: 'discharge_bp_diastolic',
      dischargePulse: 'discharge_pulse',
      dischargeTempF: 'discharge_temp_f',
      dischargeSpo2: 'discharge_spo2',
      contraceptionChosen: 'contraception_chosen',
      contraceptionNotes: 'contraception_notes',
      dischargeMedicinesText: 'discharge_medicines_text',
      babyGender: 'baby_gender',
      babyBirthWeightGrams: 'baby_birth_weight_grams',
      babyDischargeWeightGrams: 'baby_discharge_weight_grams',
      babyLengthCm: 'baby_length_cm',
      babyHcCm: 'baby_hc_cm',
      babyGestationalAgeWeeks: 'baby_gestational_age_weeks',
      babyGestationalAgeDays: 'baby_gestational_age_days',
      babyApgar1min: 'baby_apgar_1min',
      babyApgar5min: 'baby_apgar_5min',
      babyCryAtBirth: 'baby_cry_at_birth',
      babyResuscitationDetails: 'baby_resuscitation_details',
      babyBloodGroup: 'baby_blood_group',
      neonatalFeedingMethod: 'neonatal_feeding_method',
      jaundiceAssessment: 'jaundice_assessment',
      bcgDate: 'bcg_date',
      opvZeroDate: 'opv_zero_date',
      hepbBirthDate: 'hepb_birth_date',
      hearingScreenResult: 'hearing_screen_result',
      metabolicScreenResult: 'metabolic_screen_result',
      maternalFollowupDate: 'maternal_followup_date',
      newbornFollowupDate: 'newborn_followup_date',
      consultantSpecialInstructions: 'consultant_special_instructions',
      status: 'status',
    };

    for (const [k, col] of Object.entries(stringMap)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as any)[k] ?? null);
      }
    }

    const boolMap: Record<string, string> = {
      contraceptionCounselled: 'contraception_counselled',
      alarmSignsCounselled: 'alarm_signs_counselled',
      meconiumPassed: 'meconium_passed',
      urinePassed: 'urine_passed',
      bcgGiven: 'bcg_given',
      opvZeroGiven: 'opv_zero_given',
      hepbBirthGiven: 'hepb_birth_given',
    };

    for (const [k, col] of Object.entries(boolMap)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as any)[k] ? 1 : 0);
      }
    }

    if ('neonatalExam' in b && b.neonatalExam) {
      fields.push('neonatal_exam_json = ?');
      values.push(JSON.stringify(b.neonatalExam));
    }

    if (fields.length === 0) throw badRequest('No fields to update');

    fields.push('updated_by = ?', 'updated_at = ?');
    values.push(user.id, now, id);

    db.prepare(`UPDATE obstetric_discharge_summaries SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_discharge.update',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        dischargeId: id,
        updatedFields: Object.keys(b),
      },
    });

    const updated = db.prepare('SELECT * FROM obstetric_discharge_summaries WHERE id = ?').get(id) as DbObstetricDischargeRow;
    return mapRow(updated);
  });

  // DELETE /api/obstetric-discharges/:id
  app.delete('/api/obstetric-discharges/:id', async (req) => {
    const user = assertCanManageDischarge(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid discharge ID');

    const existing = db.prepare('SELECT * FROM obstetric_discharge_summaries WHERE id = ?').get(id) as DbObstetricDischargeRow | undefined;
    if (!existing) throw notFound('Obstetric discharge summary not found');

    db.prepare('DELETE FROM obstetric_discharge_summaries WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_discharge.delete',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        dischargeId: id,
        deliveryMode: existing.delivery_mode,
      },
    });

    return { ok: true };
  });

  // POST /api/obstetric-discharges/:id/create-baby-record
  app.post('/api/obstetric-discharges/:id/create-baby-record', async (req) => {
    const user = assertCanManageDischarge(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid discharge ID');

    const discharge = db
      .prepare('SELECT * FROM obstetric_discharge_summaries WHERE id = ?')
      .get(id) as DbObstetricDischargeRow | undefined;
    if (!discharge) throw notFound('Obstetric discharge summary not found');

    if (discharge.baby_pediatric_patient_id) {
      return { ok: true, babyPatientId: discharge.baby_pediatric_patient_id, alreadyCreated: true };
    }

    const mother = db
      .prepare('SELECT id, full_name, phone FROM patients WHERE id = ?')
      .get(discharge.patient_id) as { id: number; full_name: string; phone: string | null } | undefined;
    if (!mother) throw notFound('Mother patient not found');

    const now = nowIso();
    const babyDob = discharge.delivery_at ? discharge.delivery_at.slice(0, 10) : discharge.discharge_date;
    const babyName = `Baby of ${mother.full_name}`;

    const babyId = tx(db, () => {
      // 1. Insert patient
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'patient'").run();
      const n = (db.prepare("SELECT value FROM counters WHERE name = 'patient'").get() as { value: number }).value;
      const babyPatNum = 'P' + String(n).padStart(6, '0');

      const patRes = db
        .prepare(
          `INSERT INTO patients (
             patient_number, full_name, date_of_birth,
             phone, created_by, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(babyPatNum, babyName, babyDob, mother.phone, user.id, now, now);
      const newBabyId = Number(patRes.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'patient.create', entity: 'patient', entityId: newBabyId, detail: { patientNumber: babyPatNum } });

      // 2. Insert pediatric profile
      let pedDeliveryType: 'normal_vaginal' | 'cesarean' | 'assisted' | 'other' = 'normal_vaginal';
      if (discharge.delivery_mode.includes('lscs')) pedDeliveryType = 'cesarean';
      else if (discharge.delivery_mode.includes('vacuum') || discharge.delivery_mode.includes('forceps')) pedDeliveryType = 'assisted';

      db.prepare(
        `INSERT INTO patient_pediatric_profiles (
           patient_id, birth_weight_kg, birth_length_cm, birth_head_circumference_cm,
           gestational_age_weeks, delivery_type, apgar_1min, apgar_5min,
           blood_group, updated_by, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newBabyId,
        discharge.baby_birth_weight_grams ? discharge.baby_birth_weight_grams / 1000 : null,
        discharge.baby_length_cm ?? null,
        discharge.baby_hc_cm ?? null,
        discharge.baby_gestational_age_weeks ?? null,
        pedDeliveryType,
        discharge.baby_apgar_1min ?? null,
        discharge.baby_apgar_5min ?? null,
        discharge.baby_blood_group ?? null,
        user.id,
        now
      );

      // 3. Insert birth vaccinations
      const catalogMap = new Map(PEDIATRIC_VACCINE_CATALOG.map((v) => [v.key, v]));
      const recordVaccine = (key: string, given: boolean, givenDate?: string | null) => {
        const vDef = catalogMap.get(key);
        if (!vDef) return;
        db.prepare(
          `INSERT INTO patient_vaccinations (
             patient_id, vaccine_key, vaccine_name, milestone_group, target_disease,
             status, given_date, updated_by, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          newBabyId,
          vDef.key,
          vDef.name,
          vDef.milestone,
          vDef.targetDisease,
          given ? 'given' : 'pending',
          given ? givenDate || babyDob : null,
          user.id,
          now
        );
      };

      recordVaccine('bcg', discharge.bcg_given === 1, discharge.bcg_date);
      recordVaccine('opv_0', discharge.opv_zero_given === 1, discharge.opv_zero_date);
      recordVaccine('hepb_0', discharge.hepb_birth_given === 1, discharge.hepb_birth_date);

      // 4. Link to discharge summary
      db.prepare('UPDATE obstetric_discharge_summaries SET baby_pediatric_patient_id = ?, updated_at = ? WHERE id = ?').run(
        newBabyId,
        now,
        id
      );

      return newBabyId;
    });

    audit(db, {
      actorId: user.id,
      action: 'obstetric_discharge.create_baby_record',
      entity: 'patient',
      entityId: discharge.patient_id,
      detail: {
        dischargeId: id,
        babyPatientId: babyId,
      },
    });

    return { ok: true, babyPatientId: babyId };
  });
}
