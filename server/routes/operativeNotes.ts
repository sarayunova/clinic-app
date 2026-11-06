import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can, type Role } from '../permissions.js';
import { tx } from '../db.js';
import { audit, diff } from '../audit.js';
import { badRequest, forbidden, notFound, parse } from '../errors.js';
import { isRealDate, nowIso } from '../time.js';
import { camelize, toSnake } from '../util.js';

const dateSchema = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const optNumber = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .nullable()
    .optional();

const procedureCategoryEnum = z.enum(['lscs', 'operative_vaginal', 'laparotomy', 'cervical_encirclage', 'other']);
const urgencyEnum = z.enum(['elective', 'emergency']);
const anesthesiaTypeEnum = z.enum(['spinal', 'general', 'epidural', 'cse', 'local']);
const incisionTypeEnum = z.enum(['pfannenstiel', 'joel_cohen', 'subumbilical_midline', 'other']);
const presentationEnum = z.enum(['cephalic', 'breech', 'transverse', 'compound', 'other']);
const liquorEnum = z.enum(['clear', 'meconium_thin', 'meconium_thick', 'blood_stained', 'oligohydramnios']);
const placentaDeliveryEnum = z.enum(['spontaneous_cct', 'manual_removal']);
const placentaCompletenessEnum = z.enum(['complete_intact', 'incomplete_explored', 'morbidly_adherent']);
const babyGenderEnum = z.enum(['male', 'female', 'ambiguous']);
const statusEnum = z.enum(['draft', 'completed', 'amended']);

export const operativeNoteSchema = z
  .object({
    admissionId: z.number().int().positive().nullable().optional(),
    surgeonId: z.number().int().positive().optional(),
    surgeonName: z.string().trim().min(2, 'Surgeon name is required').max(100),
    assistantName: optText(100),
    anesthetistName: optText(100),
    pediatricianName: optText(100),
    scrubNurseName: optText(100),

    // Surgery timing & details
    surgeryDate: dateSchema,
    startTime: clockSchema,
    endTime: clockSchema.nullable().optional(),
    procedureName: z.string().trim().min(3, 'Procedure name is required').max(200),
    procedureCategory: procedureCategoryEnum.default('lscs'),
    indication: z.string().trim().min(3, 'Surgical indication is required').max(500),
    urgency: urgencyEnum.default('emergency'),
    anesthesiaType: anesthesiaTypeEnum.default('spinal'),

    // WHO Pre-operative surgical safety checklist
    preopIdentityConsentVerified: z.boolean().default(true),
    preopSiteMarked: z.boolean().default(true),
    preopAnesthesiaSafetyChecked: z.boolean().default(true),
    preopPulseOximeterFunctioning: z.boolean().default(true),
    preopAllergiesReviewed: z.boolean().default(true),
    preopDifficultAirwayAssessed: z.boolean().default(false),
    preopBloodAvailabilityUnits: optText(200),
    preopAntibioticProphylaxis: optText(300),

    // Operative findings & technique
    incisionType: incisionTypeEnum.default('pfannenstiel'),
    presentation: presentationEnum.default('cephalic'),
    liquorCharacteristics: liquorEnum.default('clear'),
    extractionDetails: optText(1000),
    babyDeliveryTime: clockSchema.nullable().optional(),
    placentaDelivery: placentaDeliveryEnum.default('spontaneous_cct'),
    placentaCompleteness: placentaCompletenessEnum.default('complete_intact'),
    uterineClosure: optText(1000),
    tubalLigationPerformed: z.boolean().default(false),
    tubalLigationNotes: optText(500),
    estimatedBloodLossMl: z.number().int().min(0).max(10000).default(400),
    findingsNotes: optText(4000),

    // Newborn summary
    babyGender: babyGenderEnum.nullable().optional(),
    babyWeightGrams: optNumber(300, 7000),
    apgar1min: optNumber(0, 10),
    apgar5min: optNumber(0, 10),
    babyResuscitationDetails: optText(1000),

    // Sponge, needle, and instrument count verification
    spongeCountVerified: z.boolean().default(true),
    instrumentCountVerified: z.boolean().default(true),
    needleCountVerified: z.boolean().default(true),
    drainPlaced: z.boolean().default(false),
    drainType: optText(200),
    closureDetails: optText(2000),

    // Post-operative orders
    postopVitalsMonitoring: optText(1000),
    postopIvFluids: optText(1000),
    postopAnalgesia: optText(1000),
    postopAntibiotics: optText(1000),
    postopThromboprophylaxis: optText(1000),
    postopDiet: optText(1000),
    postopCatheterInstructions: optText(1000),
    specialInstructions: optText(2000),

    status: statusEnum.default('completed'),
  })
  .strict();

export const updateOperativeNoteSchema = operativeNoteSchema.partial().strict();

function assertCanWriteOperativeNote(role: Role) {
  if (!can(role, 'care:write_clinical')) {
    throw forbidden('Only doctors / surgeons can record or edit operative delivery notes');
  }
}

function assertCanReadOperativeNote(role: Role) {
  if (!can(role, 'patient:read_clinical') && !can(role, 'ipd:read')) {
    throw forbidden('Only clinical staff can read operative delivery notes');
  }
}

function formatOperativeNoteRow(row: Record<string, unknown>) {
  const o = camelize(row);
  o.preopIdentityConsentVerified = Boolean(row.preop_identity_consent_verified);
  o.preopSiteMarked = Boolean(row.preop_site_marked);
  o.preopAnesthesiaSafetyChecked = Boolean(row.preop_anesthesia_safety_checked);
  o.preopPulseOximeterFunctioning = Boolean(row.preop_pulse_oximeter_functioning);
  o.preopAllergiesReviewed = Boolean(row.preop_allergies_reviewed);
  o.preopDifficultAirwayAssessed = Boolean(row.preop_difficult_airway_assessed);
  o.tubalLigationPerformed = Boolean(row.tubal_ligation_performed);
  o.spongeCountVerified = Boolean(row.sponge_count_verified);
  o.instrumentCountVerified = Boolean(row.instrument_count_verified);
  o.needleCountVerified = Boolean(row.needle_count_verified);
  o.drainPlaced = Boolean(row.drain_placed);
  o.apgar1min = row.apgar_1min as number | null;
  o.apgar5min = row.apgar_5min as number | null;
  return o;
}

const SELECT_OPERATIVE_NOTE = `
  SELECT o.*,
         p.patient_number, p.full_name AS patient_name, p.date_of_birth, p.phone AS patient_phone,
         p.allergy_status, p.allergy_details,
         a.admission_number, a.admitted_at,
         b.room AS bed_room, b.label AS bed_label,
         u.full_name AS created_by_name
    FROM operative_notes o
    JOIN patients p ON p.id = o.patient_id
    LEFT JOIN admissions a ON a.id = o.admission_id
    LEFT JOIN beds b ON b.id = a.bed_id
    JOIN users u ON u.id = o.created_by
`;

export function registerOperativeNoteRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  // ---------- List Operative Notes for a Patient ----------
  app.get('/api/patients/:patientId/operative-notes', async (req) => {
    const user = requireUser(req);
    assertCanReadOperativeNote(user.role);

    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Patient');

    const rows = db
      .prepare(`${SELECT_OPERATIVE_NOTE} WHERE o.patient_id = ? ORDER BY o.surgery_date DESC, o.start_time DESC, o.id DESC`)
      .all(pid) as Record<string, unknown>[];

    return rows.map(formatOperativeNoteRow);
  });

  // ---------- List Operative Notes for an Admission ----------
  app.get('/api/admissions/:admissionId/operative-notes', async (req) => {
    const user = requireUser(req);
    assertCanReadOperativeNote(user.role);

    const { admissionId } = req.params as { admissionId: string };
    const aid = Number(admissionId);
    if (!Number.isInteger(aid) || aid < 1) throw notFound('Admission');

    const rows = db
      .prepare(`${SELECT_OPERATIVE_NOTE} WHERE o.admission_id = ? ORDER BY o.surgery_date DESC, o.start_time DESC, o.id DESC`)
      .all(aid) as Record<string, unknown>[];

    return rows.map(formatOperativeNoteRow);
  });

  // ---------- Get a Single Operative Note ----------
  app.get('/api/operative-notes/:id', async (req) => {
    const user = requireUser(req);
    assertCanReadOperativeNote(user.role);

    const { id } = req.params as { id: string };
    const opId = Number(id);
    if (!Number.isInteger(opId) || opId < 1) throw notFound('Operative Note');

    const row = db.prepare(`${SELECT_OPERATIVE_NOTE} WHERE o.id = ?`).get(opId) as Record<string, unknown> | undefined;
    if (!row) throw notFound('Operative Note');

    return formatOperativeNoteRow(row);
  });

  // ---------- Create a New Operative Delivery Note ----------
  app.post('/api/patients/:patientId/operative-notes', async (req, reply) => {
    const user = requireUser(req);
    assertCanWriteOperativeNote(user.role);

    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Patient');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(pid);
    if (!patient) throw notFound('Patient');

    const b = parse(operativeNoteSchema, req.body);

    if (b.admissionId) {
      const adm = db.prepare('SELECT id, patient_id FROM admissions WHERE id = ?').get(b.admissionId) as { id: number; patient_id: number } | undefined;
      if (!adm || adm.patient_id !== pid) {
        throw badRequest('Specified admission does not belong to this patient', [{ field: 'admissionId', message: 'Invalid admission' }]);
      }
    }

    const now = nowIso();

    const opId = tx(db, () => {
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'operative_note'").run();
      const count = (db.prepare("SELECT value FROM counters WHERE name = 'operative_note'").get() as { value: number }).value;
      const stamp = b.surgeryDate.replace(/-/g, '').slice(0, 6);
      const operativeNumber = `OP-${stamp}-${String(count).padStart(4, '0')}`;

      const res = db
        .prepare(
          `INSERT INTO operative_notes (
            operative_number, patient_id, admission_id, surgeon_id, surgeon_name,
            assistant_name, anesthetist_name, pediatrician_name, scrub_nurse_name,
            surgery_date, start_time, end_time, procedure_name, procedure_category,
            indication, urgency, anesthesia_type,
            preop_identity_consent_verified, preop_site_marked, preop_anesthesia_safety_checked,
            preop_pulse_oximeter_functioning, preop_allergies_reviewed, preop_difficult_airway_assessed,
            preop_blood_availability_units, preop_antibiotic_prophylaxis,
            incision_type, presentation, liquor_characteristics, extraction_details,
            baby_delivery_time, placenta_delivery, placenta_completeness, uterine_closure,
            tubal_ligation_performed, tubal_ligation_notes, estimated_blood_loss_ml, findings_notes,
            baby_gender, baby_weight_grams, apgar_1min, apgar_5min, baby_resuscitation_details,
            sponge_count_verified, instrument_count_verified, needle_count_verified,
            drain_placed, drain_type, closure_details,
            postop_vitals_monitoring, postop_iv_fluids, postop_analgesia, postop_antibiotics,
            postop_thromboprophylaxis, postop_diet, postop_catheter_instructions, special_instructions,
            status, created_by, created_at, updated_at
          ) VALUES (
            ?,?,?,?,?,
            ?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,
            ?,?,?,
            ?,?,?,
            ?, ?,
            ?,?,?,?,
            ?,?,?,?,
            ?,?,?, ?,
            ?,?,?,?,?,
            ?,?,?,
            ?,?,?,
            ?,?,?,?,
            ?,?,?,?,
            ?,?,?,?
          )`,
        )
        .run(
          operativeNumber,
          pid,
          b.admissionId ?? null,
          b.surgeonId ?? user.id,
          b.surgeonName,
          b.assistantName ?? null,
          b.anesthetistName ?? null,
          b.pediatricianName ?? null,
          b.scrubNurseName ?? null,
          b.surgeryDate,
          b.startTime,
          b.endTime ?? null,
          b.procedureName,
          b.procedureCategory,
          b.indication,
          b.urgency,
          b.anesthesiaType,
          b.preopIdentityConsentVerified ? 1 : 0,
          b.preopSiteMarked ? 1 : 0,
          b.preopAnesthesiaSafetyChecked ? 1 : 0,
          b.preopPulseOximeterFunctioning ? 1 : 0,
          b.preopAllergiesReviewed ? 1 : 0,
          b.preopDifficultAirwayAssessed ? 1 : 0,
          b.preopBloodAvailabilityUnits ?? null,
          b.preopAntibioticProphylaxis ?? null,
          b.incisionType ?? 'pfannenstiel',
          b.presentation ?? 'cephalic',
          b.liquorCharacteristics ?? 'clear',
          b.extractionDetails ?? null,
          b.babyDeliveryTime ?? null,
          b.placentaDelivery ?? 'spontaneous_cct',
          b.placentaCompleteness ?? 'complete_intact',
          b.uterineClosure ?? null,
          b.tubalLigationPerformed ? 1 : 0,
          b.tubalLigationNotes ?? null,
          b.estimatedBloodLossMl ?? 400,
          b.findingsNotes ?? null,
          b.babyGender ?? null,
          b.babyWeightGrams ?? null,
          b.apgar1min ?? null,
          b.apgar5min ?? null,
          b.babyResuscitationDetails ?? null,
          b.spongeCountVerified ? 1 : 0,
          b.instrumentCountVerified ? 1 : 0,
          b.needleCountVerified ? 1 : 0,
          b.drainPlaced ? 1 : 0,
          b.drainType ?? null,
          b.closureDetails ?? null,
          b.postopVitalsMonitoring ?? null,
          b.postopIvFluids ?? null,
          b.postopAnalgesia ?? null,
          b.postopAntibiotics ?? null,
          b.postopThromboprophylaxis ?? null,
          b.postopDiet ?? null,
          b.postopCatheterInstructions ?? null,
          b.specialInstructions ?? null,
          b.status ?? 'completed',
          user.id,
          now,
          now,
        );

      const insertedId = Number(res.lastInsertRowid);
      audit(db, {
        actorId: user.id,
        action: 'operative_note.create',
        entity: 'operative_note',
        entityId: insertedId,
        detail: { operativeNumber, patientId: pid, procedureName: b.procedureName, surgeryDate: b.surgeryDate },
      });
      return insertedId;
    });

    const created = db.prepare(`${SELECT_OPERATIVE_NOTE} WHERE o.id = ?`).get(opId) as Record<string, unknown>;
    return reply.status(201).send(formatOperativeNoteRow(created));
  });

  // ---------- Update Operative Delivery Note ----------
  app.patch('/api/operative-notes/:id', async (req) => {
    const user = requireUser(req);
    assertCanWriteOperativeNote(user.role);

    const { id } = req.params as { id: string };
    const opId = Number(id);
    if (!Number.isInteger(opId) || opId < 1) throw notFound('Operative Note');

    const existing = db.prepare('SELECT * FROM operative_notes WHERE id = ?').get(opId) as Record<string, unknown> | undefined;
    if (!existing) throw notFound('Operative Note');

    const b = parse(updateOperativeNoteSchema, req.body);
    const now = nowIso();

    tx(db, () => {
      const updates: string[] = [];
      const values: unknown[] = [];

      const booleanKeys = new Set([
        'preopIdentityConsentVerified',
        'preopSiteMarked',
        'preopAnesthesiaSafetyChecked',
        'preopPulseOximeterFunctioning',
        'preopAllergiesReviewed',
        'preopDifficultAirwayAssessed',
        'tubalLigationPerformed',
        'spongeCountVerified',
        'instrumentCountVerified',
        'needleCountVerified',
        'drainPlaced',
      ]);

      for (const [k, v] of Object.entries(b)) {
        if (v !== undefined) {
          let snakeKey = toSnake(k);
          if (k === 'apgar1min') snakeKey = 'apgar_1min';
          if (k === 'apgar5min') snakeKey = 'apgar_5min';
          updates.push(`${snakeKey} = ?`);
          if (booleanKeys.has(k)) {
            values.push(v ? 1 : 0);
          } else {
            values.push(v);
          }
        }
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        values.push(now);
        values.push(opId);

        db.prepare(`UPDATE operative_notes SET ${updates.join(', ')} WHERE id = ?`).run(...(values as (string | number | null)[]));

        audit(db, {
          actorId: user.id,
          action: 'operative_note.update',
          entity: 'operative_note',
          entityId: opId,
          detail: { changes: Object.keys(b) },
        });
      }
    });

    const updated = db.prepare(`${SELECT_OPERATIVE_NOTE} WHERE o.id = ?`).get(opId) as Record<string, unknown>;
    return formatOperativeNoteRow(updated);
  });

  // ---------- Audit Print Record ----------
  app.post('/api/operative-notes/:id/print', async (req) => {
    const user = requireUser(req);
    assertCanReadOperativeNote(user.role);

    const { id } = req.params as { id: string };
    const opId = Number(id);
    if (!Number.isInteger(opId) || opId < 1) throw notFound('Operative Note');

    const existing = db.prepare('SELECT id, operative_number, patient_id FROM operative_notes WHERE id = ?').get(opId) as
      | { id: number; operative_number: string; patient_id: number }
      | undefined;
    if (!existing) throw notFound('Operative Note');

    audit(db, {
      actorId: user.id,
      action: 'operative_note.print',
      entity: 'operative_note',
      entityId: opId,
      detail: { operativeNumber: existing.operative_number, patientId: existing.patient_id },
    });

    return { ok: true };
  });
}
