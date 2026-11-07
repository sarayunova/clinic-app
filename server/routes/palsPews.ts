import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import { calculatePews, lookupBroselowZone } from '../../web/src/palsEngine.js';
import { nowIso } from '../time.js';

function assertCanManagePals(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only pediatric emergency, PICU clinicians and nursing staff can manage PALS & PEWS records');
  }
  return user;
}

export const pewsObservationSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  observationDatetime: z.string().min(1, 'Observation datetime is required'),
  behaviorScore: z.number().int().min(0).max(3),
  cardiovascularScore: z.number().int().min(0).max(3),
  respiratoryScore: z.number().int().min(0).max(3),
  persistentVomitingPostop: z.boolean().default(false),
  heartRateBpm: z.number().int().min(30).max(260),
  respiratoryRateBpm: z.number().int().min(6).max(120),
  crtSeconds: z.number().int().min(1).max(10),
  spo2Percent: z.number().min(50).max(100),
  temperatureCelsius: z.number().nullable().optional(),
  fio2Percent: z.number().min(21).max(100).default(21),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const broselowEventSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  eventDatetime: z.string().min(1, 'Event datetime is required'),
  eventType: z.enum([
    'cardiac_arrest_code_blue',
    'status_epilepticus',
    'anaphylaxis',
    'severe_septic_shock',
    'acute_respiratory_failure',
    'other',
  ]),
  measuredLengthCm: z.number().positive().max(200),
  outcome: z.enum([
    'rosc_achieved',
    'stabilized_transferred_picu',
    'ongoing_cpr',
    'expired',
  ]),
  clinicalSummary: z.string().max(2000).nullable().optional(),
});

export function registerPalsPewsRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List PEWS observations
  app.get('/api/pals/pews', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { patientId?: string; limit?: string };
    const patientId = query.patientId ? Number(query.patientId) : null;
    const limit = Math.min(Number(query.limit) || 50, 100);

    let sql = `
      SELECT p.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as assessed_by_name
      FROM pews_observations p
      JOIN patients pat ON p.patient_id = pat.id
      JOIN users u ON p.assessed_by_id = u.id
    `;
    const params: (string | number | null)[] = [];

    if (patientId) {
      sql += ' WHERE p.patient_id = ?';
      params.push(patientId);
    }

    sql += ' ORDER BY p.observation_datetime DESC LIMIT ?';
    params.push(limit);

    const rows = ctx.db.prepare(sql).all(...params);
    return reply.send({ observations: rows });
  });

  // 2. Record PEWS Observation
  app.post('/api/pals/pews', async (req, reply) => {
    const user = assertCanManagePals(req);
    const body = parse(pewsObservationSchema, req.body);

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patientId);
    if (!patient) {
      throw notFound('Patient not found');
    }

    const pewsCalc = calculatePews({
      behaviorScore: body.behaviorScore,
      cardiovascularScore: body.cardiovascularScore,
      respiratoryScore: body.respiratoryScore,
      persistentVomitingPostOp: body.persistentVomitingPostop,
    });

    const result = ctx.db
      .prepare(
        `INSERT INTO pews_observations (
          patient_id, admission_id, observation_datetime, behavior_score,
          cardiovascular_score, respiratory_score, persistent_vomiting_postop,
          total_pews_score, risk_level, heart_rate_bpm, respiratory_rate_bpm,
          crt_seconds, spo2_percent, temperature_celsius, fio2_percent,
          escalation_triggered, assessed_by_id, clinical_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.patientId,
        body.admissionId ?? null,
        body.observationDatetime,
        body.behaviorScore,
        body.cardiovascularScore,
        body.respiratoryScore,
        body.persistentVomitingPostop ? 1 : 0,
        pewsCalc.totalScore,
        pewsCalc.riskLevel,
        body.heartRateBpm,
        body.respiratoryRateBpm,
        body.crtSeconds,
        body.spo2Percent,
        body.temperatureCelsius ?? null,
        body.fio2Percent,
        pewsCalc.escalationRequired ? 1 : 0,
        user.id,
        body.clinicalNotes ?? null
      );

    const inserted = ctx.db.prepare('SELECT * FROM pews_observations WHERE id = ?').get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pals.pews_observation',
      entity: 'pews_observations',
      entityId: Number(result.lastInsertRowid),
      detail: {
        patientId: body.patientId,
        totalScore: pewsCalc.totalScore,
        riskLevel: pewsCalc.riskLevel,
      },
    });

    return reply.status(201).send({ observation: inserted, calculation: pewsCalc });
  });

  // 3. Lookup Broselow Resuscitation Zone & Formulary
  app.get('/api/pals/broselow', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { lengthCm?: string; weightKg?: string };
    const lengthCm = query.lengthCm ? parseFloat(query.lengthCm) : undefined;
    const weightKg = query.weightKg ? parseFloat(query.weightKg) : undefined;

    const zone = lookupBroselowZone({ lengthCm, weightKg });
    return reply.send({ zone });
  });

  // 4. Record Broselow Code Resuscitation Event
  app.post('/api/pals/broselow-events', async (req, reply) => {
    const user = assertCanManagePals(req);
    const body = parse(broselowEventSchema, req.body);

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patientId);
    if (!patient) {
      throw notFound('Patient not found');
    }

    const zone = lookupBroselowZone({ lengthCm: body.measuredLengthCm });

    const dateStr = nowIso().slice(0, 10).replace(/-/g, '');
    const randStr = Math.floor(1000 + Math.random() * 9000).toString();
    const eventCode = `CODE-${dateStr}-${randStr}`;

    const result = ctx.db
      .prepare(
        `INSERT INTO broselow_resuscitation_events (
          patient_id, event_code, event_datetime, event_type, measured_length_cm,
          estimated_weight_kg, broselow_color_zone, ett_cuffed_size, ett_depth_cm,
          defib_joules_initial, epinephrine_iv_dose_ml, fluid_bolus_ml,
          team_leader_id, outcome, clinical_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.patientId,
        eventCode,
        body.eventDatetime,
        body.eventType,
        body.measuredLengthCm,
        zone.midWeightKg,
        zone.color,
        zone.ettCuffedSize,
        zone.ettDepthLipCm,
        zone.defibInitialJoules,
        zone.epinephrineIvDoseMl,
        zone.fluidBolusMl,
        user.id,
        body.outcome,
        body.clinicalSummary ?? null
      );

    const inserted = ctx.db
      .prepare('SELECT * FROM broselow_resuscitation_events WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'pals.broselow_resuscitation',
      entity: 'broselow_resuscitation_events',
      entityId: Number(result.lastInsertRowid),
      detail: {
        eventCode,
        patientId: body.patientId,
        zone: zone.color,
        outcome: body.outcome,
      },
    });

    return reply.status(201).send({ event: inserted, zone });
  });

  // 5. List Broselow Events
  app.get('/api/pals/broselow-events', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { patientId?: string };
    const patientId = query.patientId ? Number(query.patientId) : null;

    let sql = `
      SELECT e.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as team_leader_name
      FROM broselow_resuscitation_events e
      JOIN patients pat ON e.patient_id = pat.id
      JOIN users u ON e.team_leader_id = u.id
    `;
    const params: (string | number | null)[] = [];

    if (patientId) {
      sql += ' WHERE e.patient_id = ?';
      params.push(patientId);
    }

    sql += ' ORDER BY e.event_datetime DESC LIMIT 50';

    const events = ctx.db.prepare(sql).all(...params);
    return reply.send({ events });
  });

  // 6. Get single Broselow event
  app.get('/api/pals/broselow-events/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const event = ctx.db
      .prepare(
        `SELECT e.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as team_leader_name
         FROM broselow_resuscitation_events e
         JOIN patients pat ON e.patient_id = pat.id
         JOIN users u ON e.team_leader_id = u.id
         WHERE e.id = ?`
      )
      .get(Number(id));

    if (!event) {
      throw notFound('Resuscitation event not found');
    }

    return reply.send({ event });
  });

  // 7. Print PALS Code Sheet Audit
  app.post('/api/pals/broselow-events/:id/print', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    audit(ctx.db, {
      actorId: user.id,
      action: 'pals.print',
      entity: 'broselow_resuscitation_events',
      entityId: Number(id),
      detail: { eventId: Number(id) },
    });

    return reply.send({ success: true, message: 'Print logged' });
  });

  // 8. PALS & PEWS Dashboard
  app.get('/api/pals/dashboard', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');

    const highRiskObservations = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid
         FROM pews_observations p
         JOIN patients pat ON p.patient_id = pat.id
         WHERE p.total_pews_score >= 3
         ORDER BY p.observation_datetime DESC
         LIMIT 20`
      )
      .all();

    const recentEvents = ctx.db
      .prepare(
        `SELECT e.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid
         FROM broselow_resuscitation_events e
         JOIN patients pat ON e.patient_id = pat.id
         ORDER BY e.event_datetime DESC
         LIMIT 10`
      )
      .all();

    return reply.send({ highRiskObservations, recentEvents });
  });
}
