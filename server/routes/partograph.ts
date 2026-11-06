import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can, type Role } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const liquorEnum = z.enum(['I', 'C', 'M', 'A', 'B']); // Intact, Clear, Meconium, Absent, Blood
const moldingEnum = z.enum(['0', '+', '++', '+++']);
const stationEnum = z.enum(['5/5', '4/5', '3/5', '2/5', '1/5', '0/5']);
const intensityEnum = z.enum(['mild', 'moderate', 'strong']);
const outcomeEnum = z.enum([
  'normal_vaginal',
  'assisted_vacuum',
  'assisted_forceps',
  'emergency_lscs',
  'elective_lscs',
  'transferred',
]);
const babyGenderEnum = z.enum(['male', 'female', 'ambiguous']);
const statusEnum = z.enum(['active', 'completed', 'discontinued']);

export const createPartographSchema = z
  .object({
    admissionId: z.number().int().positive().nullable().optional(),
    startTime: z.string().min(10, 'Start time is required'),
    parity: optText(50),
    gestationalAgeWeeks: z.number().min(20).max(45).nullable().optional(),
    ruptureOfMembranesTime: optText(50),
    fetalPosition: optText(50),
    alertLineStartHours: z.number().min(0).max(48).default(0.0),
    alertLineStartCm: z.number().min(3.0).max(10.0).default(4.0),
    initialDilatationCm: z.number().min(0).max(10).nullable().optional(),
    initialStation: stationEnum.nullable().optional(),
    initialFhr: z.number().int().min(60).max(220).nullable().optional(),
    initialLiquor: liquorEnum.nullable().optional(),
    initialMolding: moldingEnum.nullable().optional(),
  })
  .strict();

export const createPartographEntrySchema = z
  .object({
    recordedAt: z.string().min(10, 'Observation timestamp is required'),
    hoursFromStart: z.number().min(0).max(72).optional(),
    fetalHeartRate: z.number().int().min(60).max(220).nullable().optional(),
    liquor: liquorEnum.nullable().optional(),
    molding: moldingEnum.nullable().optional(),
    cervicalDilatationCm: z.number().min(0.0).max(10.0).nullable().optional(),
    stationDescent: stationEnum.nullable().optional(),
    contractionsCount: z.number().int().min(0).max(10).nullable().optional(),
    contractionsIntensity: intensityEnum.nullable().optional(),
    contractionsDurationSec: z.number().int().min(0).max(180).nullable().optional(),
    oxytocinUPerL: z.number().min(0).max(50).nullable().optional(),
    oxytocinDropsPerMin: z.number().int().min(0).max(120).nullable().optional(),
    drugsGiven: optText(300),
    ivFluids: optText(300),
    maternalPulseBpm: z.number().int().min(30).max(220).nullable().optional(),
    maternalSystolicMmhg: z.number().int().min(50).max(280).nullable().optional(),
    maternalDiastolicMmhg: z.number().int().min(30).max(180).nullable().optional(),
    maternalTemperatureC: z.number().min(32.0).max(43.0).nullable().optional(),
    urineProtein: optText(50),
    urineKetones: optText(50),
    urineVolumeMl: z.number().int().min(0).max(5000).nullable().optional(),
    clinicalNotes: optText(1000),
  })
  .strict();

export const updatePartographOutcomeSchema = z
  .object({
    status: statusEnum.default('completed'),
    outcome: outcomeEnum,
    outcomeNotes: optText(1000),
    deliveryTime: optText(50),
    babyGender: babyGenderEnum.nullable().optional(),
    babyWeightGrams: z.number().int().min(300).max(7000).nullable().optional(),
    apgar1min: z.number().int().min(0).max(10).nullable().optional(),
    apgar5min: z.number().int().min(0).max(10).nullable().optional(),
  })
  .strict();

export const updatePartographSchema = z
  .object({
    parity: optText(50),
    gestationalAgeWeeks: z.number().min(20).max(45).nullable().optional(),
    ruptureOfMembranesTime: optText(50),
    fetalPosition: optText(50),
    alertLineStartHours: z.number().min(0).max(48).optional(),
    alertLineStartCm: z.number().min(3.0).max(10.0).optional(),
    status: statusEnum.optional(),
  })
  .strict();

function assertCanManageLabor(role: Role) {
  if (!can(role, 'patient:write_clinical') && !can(role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff (doctor or nurse) can manage labor progress partographs');
  }
}

export function registerPartographRoutes(app: FastifyInstance, { db }: Ctx): void {
  // ---------- List Partographs for a Patient ----------
  app.get('/api/patients/:patientId/partographs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Patient');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(pid);
    if (!patient) throw notFound('Patient');

    const rows = db
      .prepare(
        `SELECT p.*,
                u.full_name AS created_by_name,
                a.admission_number,
                (SELECT COUNT(*) FROM partograph_entries e WHERE e.partograph_id = p.id) AS entry_count,
                (SELECT e.cervical_dilatation_cm FROM partograph_entries e WHERE e.partograph_id = p.id AND e.cervical_dilatation_cm IS NOT NULL ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1) AS latest_dilatation,
                (SELECT e.recorded_at FROM partograph_entries e WHERE e.partograph_id = p.id ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1) AS latest_recorded_at
         FROM partographs p
         JOIN users u ON u.id = p.created_by
         LEFT JOIN admissions a ON a.id = p.admission_id
         WHERE p.patient_id = ?
         ORDER BY p.start_time DESC, p.id DESC`
      )
      .all(pid) as any[];

    return {
      patientId: pid,
      partographs: rows.map((r) => ({
        id: r.id,
        partographNumber: r.partograph_number,
        patientId: r.patient_id,
        admissionId: r.admission_id,
        admissionNumber: r.admission_number ?? null,
        startTime: r.start_time,
        status: r.status,
        parity: r.parity,
        gestationalAgeWeeks: r.gestational_age_weeks,
        ruptureOfMembranesTime: r.rupture_of_membranes_time,
        fetalPosition: r.fetal_position,
        alertLineStartHours: r.alert_line_start_hours,
        alertLineStartCm: r.alert_line_start_cm,
        outcome: r.outcome,
        outcomeNotes: r.outcome_notes,
        deliveryTime: r.delivery_time,
        babyGender: r.baby_gender,
        babyWeightGrams: r.baby_weight_grams,
        apgar1min: r.apgar_1min,
        apgar5min: r.apgar_5min,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        entryCount: r.entry_count ?? 0,
        latestDilatation: r.latest_dilatation ?? null,
        latestRecordedAt: r.latest_recorded_at ?? null,
      })),
    };
  });

  // ---------- List Partographs for an Admission ----------
  app.get('/api/admissions/:admissionId/partographs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { admissionId } = req.params as { admissionId: string };
    const aid = Number(admissionId);
    if (!Number.isInteger(aid) || aid < 1) throw notFound('Admission');

    const admission = db.prepare('SELECT id, patient_id FROM admissions WHERE id = ?').get(aid) as any;
    if (!admission) throw notFound('Admission');

    const rows = db
      .prepare(
        `SELECT p.*,
                u.full_name AS created_by_name,
                (SELECT COUNT(*) FROM partograph_entries e WHERE e.partograph_id = p.id) AS entry_count,
                (SELECT e.cervical_dilatation_cm FROM partograph_entries e WHERE e.partograph_id = p.id AND e.cervical_dilatation_cm IS NOT NULL ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1) AS latest_dilatation,
                (SELECT e.recorded_at FROM partograph_entries e WHERE e.partograph_id = p.id ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1) AS latest_recorded_at
         FROM partographs p
         JOIN users u ON u.id = p.created_by
         WHERE p.admission_id = ?
         ORDER BY p.start_time DESC, p.id DESC`
      )
      .all(aid) as any[];

    return {
      admissionId: aid,
      patientId: admission.patient_id,
      partographs: rows.map((r) => ({
        id: r.id,
        partographNumber: r.partograph_number,
        patientId: r.patient_id,
        admissionId: r.admission_id,
        startTime: r.start_time,
        status: r.status,
        parity: r.parity,
        gestationalAgeWeeks: r.gestational_age_weeks,
        ruptureOfMembranesTime: r.rupture_of_membranes_time,
        fetalPosition: r.fetal_position,
        alertLineStartHours: r.alert_line_start_hours,
        alertLineStartCm: r.alert_line_start_cm,
        outcome: r.outcome,
        outcomeNotes: r.outcome_notes,
        deliveryTime: r.delivery_time,
        babyGender: r.baby_gender,
        babyWeightGrams: r.baby_weight_grams,
        apgar1min: r.apgar_1min,
        apgar5min: r.apgar_5min,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        entryCount: r.entry_count ?? 0,
        latestDilatation: r.latest_dilatation ?? null,
        latestRecordedAt: r.latest_recorded_at ?? null,
      })),
    };
  });

  // ---------- Get Partograph by ID with All Entries ----------
  app.get('/api/partographs/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Partograph');

    const row = db
      .prepare(
        `SELECT p.*,
                u.full_name AS created_by_name,
                pat.patient_number,
                pat.full_name AS patient_name,
                pat.date_of_birth,
                pat.phone AS patient_phone,
                pat.last_menstrual_period,
                pat.gravida,
                pat.para AS patient_para,
                a.admission_number,
                b.label AS bed_label,
                b.room AS bed_room
         FROM partographs p
         JOIN patients pat ON pat.id = p.patient_id
         JOIN users u ON u.id = p.created_by
         LEFT JOIN admissions a ON a.id = p.admission_id
         LEFT JOIN beds b ON b.id = a.bed_id
         WHERE p.id = ?`
      )
      .get(pid) as any;

    if (!row) throw notFound('Partograph');

    const entries = db
      .prepare(
        `SELECT e.*, u.full_name AS recorded_by_name
         FROM partograph_entries e
         JOIN users u ON u.id = e.recorded_by
         WHERE e.partograph_id = ?
         ORDER BY e.hours_from_start ASC, e.recorded_at ASC, e.id ASC`
      )
      .all(pid) as any[];

    return {
      id: row.id,
      partographNumber: row.partograph_number,
      patientId: row.patient_id,
      admissionId: row.admission_id,
      startTime: row.start_time,
      status: row.status,
      parity: row.parity || (row.patient_para ? `P${row.patient_para}` : null),
      gestationalAgeWeeks: row.gestational_age_weeks,
      ruptureOfMembranesTime: row.rupture_of_membranes_time,
      fetalPosition: row.fetal_position,
      alertLineStartHours: row.alert_line_start_hours,
      alertLineStartCm: row.alert_line_start_cm,
      outcome: row.outcome,
      outcomeNotes: row.outcome_notes,
      deliveryTime: row.delivery_time,
      babyGender: row.baby_gender,
      babyWeightGrams: row.baby_weight_grams,
      apgar1min: row.apgar_1min,
      apgar5min: row.apgar_5min,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      patientNumber: row.patient_number,
      patientName: row.patient_name,
      dateOfBirth: row.date_of_birth,
      patientPhone: row.patient_phone,
      lastMenstrualPeriod: row.last_menstrual_period,
      gravida: row.gravida,
      admissionNumber: row.admission_number ?? null,
      bedLabel: row.bed_label ? `${row.bed_room} - ${row.bed_label}` : null,
      entries: entries.map((e) => ({
        id: e.id,
        partographId: e.partograph_id,
        recordedAt: e.recorded_at,
        hoursFromStart: e.hours_from_start,
        fetalHeartRate: e.fetal_heart_rate,
        liquor: e.liquor,
        molding: e.molding,
        cervicalDilatationCm: e.cervical_dilatation_cm,
        stationDescent: e.station_descent,
        contractionsCount: e.contractions_count,
        contractionsIntensity: e.contractions_intensity,
        contractionsDurationSec: e.contractions_duration_sec,
        oxytocinUPerL: e.oxytocin_u_per_l,
        oxytocinDropsPerMin: e.oxytocin_drops_per_min,
        drugsGiven: e.drugs_given,
        ivFluids: e.iv_fluids,
        maternalPulseBpm: e.maternal_pulse_bpm,
        maternalSystolicMmhg: e.maternal_systolic_mmhg,
        maternalDiastolicMmhg: e.maternal_diastolic_mmhg,
        maternalTemperatureC: e.maternal_temperature_c,
        urineProtein: e.urine_protein,
        urineKetones: e.urine_ketones,
        urineVolumeMl: e.urine_volume_ml,
        clinicalNotes: e.clinical_notes,
        recordedByName: e.recorded_by_name,
        createdAt: e.created_at,
      })),
    };
  });

  // ---------- Start a New Partograph Session ----------
  app.post('/api/patients/:patientId/partographs', async (req, reply) => {
    const user = requirePerm(req, 'patient:read_clinical');
    assertCanManageLabor(user.role);

    const { patientId } = req.params as { patientId: string };
    const pid = Number(patientId);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Patient');

    const patient = db.prepare('SELECT id, full_name, para, gravida FROM patients WHERE id = ?').get(pid) as any;
    if (!patient) throw notFound('Patient');

    const b = parse(createPartographSchema, req.body);
    const now = new Date().toISOString();

    // Verify admission if provided
    if (b.admissionId) {
      const adm = db.prepare('SELECT id, patient_id FROM admissions WHERE id = ?').get(b.admissionId) as any;
      if (!adm || adm.patient_id !== pid) {
        throw badRequest('Admission does not belong to this patient');
      }
    }

    const created = tx(db, () => {
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'partograph'").run();
      const count = (db.prepare("SELECT value FROM counters WHERE name = 'partograph'").get() as { value: number }).value;
      const stamp = (b.startTime.slice(2, 10).replace(/[^0-9]/g, '') || now.slice(2, 10).replace(/[^0-9]/g, '')).padEnd(6, '0').slice(0, 6);
      const partographNumber = `PTG-${stamp}-${String(count).padStart(4, '0')}`;

      const res = db
        .prepare(
          `INSERT INTO partographs (
            partograph_number, patient_id, admission_id, start_time, status,
            parity, gestational_age_weeks, rupture_of_membranes_time, fetal_position,
            alert_line_start_hours, alert_line_start_cm,
            created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          partographNumber,
          pid,
          b.admissionId ?? null,
          b.startTime,
          b.parity ?? (patient.para != null ? `G${patient.gravida || 1} P${patient.para}` : null),
          b.gestationalAgeWeeks ?? null,
          b.ruptureOfMembranesTime ?? null,
          b.fetalPosition ?? null,
          b.alertLineStartHours,
          b.alertLineStartCm,
          user.id,
          now,
          now
        );

      const partographId = Number(res.lastInsertRowid);

      // Record initial observation at T=0 if initial values were provided
      if (
        b.initialDilatationCm != null ||
        b.initialStation != null ||
        b.initialFhr != null ||
        b.initialLiquor != null ||
        b.initialMolding != null
      ) {
        db.prepare(
          `INSERT INTO partograph_entries (
            partograph_id, recorded_at, hours_from_start,
            fetal_heart_rate, liquor, molding,
            cervical_dilatation_cm, station_descent,
            recorded_by, created_at
          ) VALUES (?, ?, 0.0, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          partographId,
          b.startTime,
          b.initialFhr ?? null,
          b.initialLiquor ?? null,
          b.initialMolding ?? null,
          b.initialDilatationCm ?? null,
          b.initialStation ?? null,
          user.id,
          now
        );
      }

      audit(db, {
        actorId: user.id,
        action: 'partograph.create',
        entity: 'partograph',
        entityId: partographId,
        detail: {
          patientId: pid,
          partographNumber,
          startTime: b.startTime,
          initialDilatation: b.initialDilatationCm,
        },
      });

      return { id: partographId, partographNumber };
    });

    reply.code(201);
    return created;
  });

  // ---------- Record a Partograph Observation Entry ----------
  app.post('/api/partographs/:id/entries', async (req, reply) => {
    const user = requirePerm(req, 'patient:read_clinical');
    assertCanManageLabor(user.role);

    const { id } = req.params as { id: string };
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Partograph');

    const partograph = db.prepare('SELECT id, patient_id, start_time, status FROM partographs WHERE id = ?').get(pid) as any;
    if (!partograph) throw notFound('Partograph');

    const b = parse(createPartographEntrySchema, req.body);
    const now = new Date().toISOString();

    // Calculate hours from start if not manually specified
    let elapsedHours = b.hoursFromStart;
    if (elapsedHours == null) {
      const startMs = Date.parse(partograph.start_time);
      const entryMs = Date.parse(b.recordedAt);
      if (!isNaN(startMs) && !isNaN(entryMs)) {
        elapsedHours = Math.max(0, Math.round(((entryMs - startMs) / 3600000) * 10) / 10);
      } else {
        elapsedHours = 0.0;
      }
    }

    const created = tx(db, () => {
      const res = db
        .prepare(
          `INSERT INTO partograph_entries (
            partograph_id, recorded_at, hours_from_start,
            fetal_heart_rate, liquor, molding,
            cervical_dilatation_cm, station_descent,
            contractions_count, contractions_intensity, contractions_duration_sec,
            oxytocin_u_per_l, oxytocin_drops_per_min,
            drugs_given, iv_fluids,
            maternal_pulse_bpm, maternal_systolic_mmhg, maternal_diastolic_mmhg,
            maternal_temperature_c, urine_protein, urine_ketones, urine_volume_ml,
            clinical_notes, recorded_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          pid,
          b.recordedAt,
          elapsedHours,
          b.fetalHeartRate ?? null,
          b.liquor ?? null,
          b.molding ?? null,
          b.cervicalDilatationCm ?? null,
          b.stationDescent ?? null,
          b.contractionsCount ?? null,
          b.contractionsIntensity ?? null,
          b.contractionsDurationSec ?? null,
          b.oxytocinUPerL ?? null,
          b.oxytocinDropsPerMin ?? null,
          b.drugsGiven ?? null,
          b.ivFluids ?? null,
          b.maternalPulseBpm ?? null,
          b.maternalSystolicMmhg ?? null,
          b.maternalDiastolicMmhg ?? null,
          b.maternalTemperatureC ?? null,
          b.urineProtein ?? null,
          b.urineKetones ?? null,
          b.urineVolumeMl ?? null,
          b.clinicalNotes ?? null,
          user.id,
          now
        );

      db.prepare('UPDATE partographs SET updated_at = ? WHERE id = ?').run(now, pid);

      audit(db, {
        actorId: user.id,
        action: 'partograph.entry',
        entity: 'partograph',
        entityId: pid,
        detail: {
          entryId: Number(res.lastInsertRowid),
          hoursFromStart: elapsedHours,
          fetalHeartRate: b.fetalHeartRate,
          cervicalDilatationCm: b.cervicalDilatationCm,
          contractionsCount: b.contractionsCount,
        },
      });

      return { id: Number(res.lastInsertRowid), hoursFromStart: elapsedHours };
    });

    reply.code(201);
    return created;
  });

  // ---------- Record Delivery Outcome & Complete Labor ----------
  app.patch('/api/partographs/:id/outcome', async (req) => {
    const user = requirePerm(req, 'patient:read_clinical');
    assertCanManageLabor(user.role);

    const { id } = req.params as { id: string };
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Partograph');

    const partograph = db.prepare('SELECT id, patient_id FROM partographs WHERE id = ?').get(pid) as any;
    if (!partograph) throw notFound('Partograph');

    const b = parse(updatePartographOutcomeSchema, req.body);
    const now = new Date().toISOString();

    tx(db, () => {
      db.prepare(
        `UPDATE partographs SET
          status = ?,
          outcome = ?,
          outcome_notes = ?,
          delivery_time = ?,
          baby_gender = ?,
          baby_weight_grams = ?,
          apgar_1min = ?,
          apgar_5min = ?,
          updated_at = ?
         WHERE id = ?`
      ).run(
        b.status,
        b.outcome,
        b.outcomeNotes ?? null,
        b.deliveryTime ?? now,
        b.babyGender ?? null,
        b.babyWeightGrams ?? null,
        b.apgar1min ?? null,
        b.apgar5min ?? null,
        now,
        pid
      );

      audit(db, {
        actorId: user.id,
        action: 'partograph.outcome',
        entity: 'partograph',
        entityId: pid,
        detail: {
          outcome: b.outcome,
          deliveryTime: b.deliveryTime ?? now,
          babyWeightGrams: b.babyWeightGrams,
          apgar1min: b.apgar1min,
          apgar5min: b.apgar5min,
        },
      });
    });

    return { ok: true, partographId: pid, status: b.status };
  });

  // ---------- Update Partograph Baseline Parameters ----------
  app.patch('/api/partographs/:id', async (req) => {
    const user = requirePerm(req, 'patient:read_clinical');
    assertCanManageLabor(user.role);

    const { id } = req.params as { id: string };
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Partograph');

    const partograph = db.prepare('SELECT id FROM partographs WHERE id = ?').get(pid);
    if (!partograph) throw notFound('Partograph');

    const b = parse(updatePartographSchema, req.body);
    const now = new Date().toISOString();

    tx(db, () => {
      const updates: string[] = ['updated_at = ?'];
      const vals: any[] = [now];

      if (b.parity !== undefined) {
        updates.push('parity = ?');
        vals.push(b.parity);
      }
      if (b.gestationalAgeWeeks !== undefined) {
        updates.push('gestational_age_weeks = ?');
        vals.push(b.gestationalAgeWeeks);
      }
      if (b.ruptureOfMembranesTime !== undefined) {
        updates.push('rupture_of_membranes_time = ?');
        vals.push(b.ruptureOfMembranesTime);
      }
      if (b.fetalPosition !== undefined) {
        updates.push('fetal_position = ?');
        vals.push(b.fetalPosition);
      }
      if (b.alertLineStartHours !== undefined) {
        updates.push('alert_line_start_hours = ?');
        vals.push(b.alertLineStartHours);
      }
      if (b.alertLineStartCm !== undefined) {
        updates.push('alert_line_start_cm = ?');
        vals.push(b.alertLineStartCm);
      }
      if (b.status !== undefined) {
        updates.push('status = ?');
        vals.push(b.status);
      }

      vals.push(pid);
      db.prepare(`UPDATE partographs SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

      audit(db, {
        actorId: user.id,
        action: 'partograph.update',
        entity: 'partograph',
        entityId: pid,
        detail: b,
      });
    });

    return { ok: true, partographId: pid };
  });

  // ---------- Audit Print Action ----------
  app.post('/api/partographs/:id/print', async (req) => {
    const user = requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Partograph');

    const partograph = db.prepare('SELECT id, partograph_number, patient_id FROM partographs WHERE id = ?').get(pid) as any;
    if (!partograph) throw notFound('Partograph');

    audit(db, {
      actorId: user.id,
      action: 'partograph.print',
      entity: 'partograph',
      entityId: pid,
      detail: {
        partographNumber: partograph.partograph_number,
        patientId: partograph.patient_id,
      },
    });

    return { ok: true };
  });
}
