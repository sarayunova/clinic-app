import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import { lookupAwareTier, isRestrictedApprovalRequired, generateAntibiogram } from '../../web/src/amsEngine.js';

function assertCanManageAms(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and pediatric nursing staff can manage antimicrobial stewardship records');
  }
  return user;
}

export const amsPrescriptionSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  prescribedDatetime: z.string().min(1, 'Prescribed datetime is required'),
  drugName: z.string().min(1, 'Drug name is required'),
  route: z.enum(['iv', 'oral', 'im', 'ip']).default('iv'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  indication: z.enum([
    'empiric_early_onset_sepsis',
    'empiric_late_onset_sepsis',
    'ventilator_associated_pneumonia',
    'urinary_tract_infection',
    'surgical_prophylaxis',
    'meningitis',
    'necrotizing_enterocolitis',
    'culture_proven_pathogen',
    'other',
  ]),
  suspectedFocus: z.string().max(500).nullable().optional(),
  baselineWbc: z.number().nullable().optional(),
  baselineCrpMgL: z.number().nullable().optional(),
  baselineProcalcitoninNgMl: z.number().nullable().optional(),
  culturesSent: z.boolean().default(true),
  cultureSpecimenTypes: z.array(z.string()).default([]),
  plannedDurationDays: z.number().int().min(1).max(30).default(7),
  restrictedApprovalNotes: z.string().max(1000).nullable().optional(),
});

export const amsTimeoutReviewSchema = z.object({
  reviewDatetime: z.string().min(1, 'Review datetime is required'),
  timeoutAction: z.enum([
    'de_escalate',
    'targeted_switch',
    'discontinue',
    'continue_unchanged',
    'iv_to_oral_switch',
  ]),
  cultureResultSummary: z.enum([
    'pathogen_isolated_sensitivities_available',
    'no_growth_sterile',
    'contaminant_suspected',
    'culture_pending',
  ]),
  clinicalResponse: z.enum([
    'improving_afebrile',
    'stable_persistent_markers',
    'deteriorating_septic_shock',
  ]),
  justificationNotes: z.string().min(5, 'Justification notes are required'),
  newAntimicrobialRegimen: z.string().max(500).nullable().optional(),
});

export const amsMicrobiologyIsolateSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  amsPrescriptionId: z.number().int().positive().nullable().optional(),
  collectionDatetime: z.string().min(1, 'Collection datetime is required'),
  specimenType: z.enum([
    'blood',
    'csf',
    'urine',
    'eta_respiratory',
    'peritoneal_fluid',
    'wound_pus',
    'other',
  ]),
  pathogenIsolated: z.string().min(1, 'Pathogen name is required'),
  colonyCountCfuMl: z.string().max(100).nullable().optional(),
  sensitivities: z.record(z.string(), z.enum(['S', 'I', 'R', 's', 'i', 'r'])),
  multidrugResistant: z.boolean().default(false),
  reportedAt: z.string().min(1, 'Reported datetime is required'),
});

export function registerAmsRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List AMS Prescriptions
  app.get('/api/ams/prescriptions', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { patientId?: string; status?: string; awareTier?: string };
    const patientId = query.patientId ? Number(query.patientId) : null;
    const status = query.status || null;
    const awareTier = query.awareTier || null;

    let sql = `
      SELECT p.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as prescribed_by_name,
             (SELECT COUNT(*) FROM ams_timeout_reviews WHERE ams_prescription_id = p.id) as timeout_reviews_count
      FROM ams_prescriptions p
      JOIN patients pat ON p.patient_id = pat.id
      JOIN users u ON p.prescribed_by_id = u.id
    `;
    const params: (string | number | null)[] = [];
    const conditions: string[] = [];

    if (patientId) {
      conditions.push('p.patient_id = ?');
      params.push(patientId);
    }
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    if (awareTier) {
      conditions.push('p.aware_tier = ?');
      params.push(awareTier);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.prescribed_datetime DESC LIMIT 100';

    const rows = ctx.db.prepare(sql).all(...params);
    return reply.send({ prescriptions: rows });
  });

  // 2. Create AMS Prescription with AWaRe Tier Classification
  app.post('/api/ams/prescriptions', async (req, reply) => {
    const user = assertCanManageAms(req);
    const body = parse(amsPrescriptionSchema, req.body);

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patientId);
    if (!patient) {
      throw notFound('Patient not found');
    }

    const awareTier = lookupAwareTier(body.drugName);
    const requiresApproval = isRestrictedApprovalRequired(body.drugName);
    const restrictedApprovalById = requiresApproval && user.role === 'doctor' ? user.id : null;

    const result = ctx.db
      .prepare(
        `INSERT INTO ams_prescriptions (
          patient_id, admission_id, prescribed_by_id, prescribed_datetime, drug_name,
          aware_tier, route, dosage, frequency, indication, suspected_focus,
          baseline_wbc, baseline_crp_mg_l, baseline_procalcitonin_ng_ml, cultures_sent,
          culture_specimen_types, planned_duration_days, status, restricted_approval_by_id,
          restricted_approval_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      )
      .run(
        body.patientId,
        body.admissionId ?? null,
        user.id,
        body.prescribedDatetime,
        body.drugName,
        awareTier,
        body.route,
        body.dosage,
        body.frequency,
        body.indication,
        body.suspectedFocus ?? null,
        body.baselineWbc ?? null,
        body.baselineCrpMgL ?? null,
        body.baselineProcalcitoninNgMl ?? null,
        body.culturesSent ? 1 : 0,
        JSON.stringify(body.cultureSpecimenTypes),
        body.plannedDurationDays,
        restrictedApprovalById,
        body.restrictedApprovalNotes ?? null
      );

    const inserted = ctx.db
      .prepare('SELECT * FROM ams_prescriptions WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'ams.prescription_create',
      entity: 'ams_prescriptions',
      entityId: Number(result.lastInsertRowid),
      detail: {
        prescriptionId: Number(result.lastInsertRowid),
        patientId: body.patientId,
        drugName: body.drugName,
        awareTier,
      },
    });

    return reply.status(201).send({ prescription: inserted });
  });

  // 3. Get single AMS Prescription with Timeout Reviews and linked Isolates
  app.get('/api/ams/prescriptions/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const prescription = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as prescribed_by_name,
                ru.full_name as approved_by_name
         FROM ams_prescriptions p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN users u ON p.prescribed_by_id = u.id
         LEFT JOIN users ru ON p.restricted_approval_by_id = ru.id
         WHERE p.id = ?`
      )
      .get(Number(id));

    if (!prescription) {
      throw notFound('Antimicrobial prescription not found');
    }

    const reviews = ctx.db
      .prepare(
        `SELECT r.*, u.full_name as reviewed_by_name
         FROM ams_timeout_reviews r
         JOIN users u ON r.reviewed_by_id = u.id
         WHERE r.ams_prescription_id = ?
         ORDER BY r.review_datetime DESC`
      )
      .all(Number(id));

    const isolates = ctx.db
      .prepare('SELECT * FROM ams_microbiology_isolates WHERE ams_prescription_id = ? ORDER BY collection_datetime DESC')
      .all(Number(id));

    return reply.send({ prescription, reviews, isolates });
  });

  // 4. Update AMS Prescription Status
  app.put('/api/ams/prescriptions/:id/status', async (req, reply) => {
    const user = assertCanManageAms(req);
    const { id } = req.params as { id: string };
    const schema = z.object({
      status: z.enum(['active', 'de_escalated', 'switched_oral', 'completed', 'discontinued']),
    });
    const body = parse(schema, req.body);

    const existing = ctx.db.prepare('SELECT id FROM ams_prescriptions WHERE id = ?').get(Number(id));
    if (!existing) {
      throw notFound('Antimicrobial prescription not found');
    }

    ctx.db.prepare('UPDATE ams_prescriptions SET status = ? WHERE id = ?').run(body.status, Number(id));

    const updated = ctx.db.prepare('SELECT * FROM ams_prescriptions WHERE id = ?').get(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'ams.status_update',
      entity: 'ams_prescriptions',
      entityId: Number(id),
      detail: { status: body.status },
    });

    return reply.send({ prescription: updated });
  });

  // 5. Conduct 48-72 Hour Antibiotic Timeout Review
  app.post('/api/ams/prescriptions/:id/timeout', async (req, reply) => {
    const user = assertCanManageAms(req);
    const { id } = req.params as { id: string };
    const body = parse(amsTimeoutReviewSchema, req.body);

    const prescription = ctx.db
      .prepare('SELECT * FROM ams_prescriptions WHERE id = ?')
      .get(Number(id)) as { id: number; patient_id: number; prescribed_datetime: string } | undefined;

    if (!prescription) {
      throw notFound('Antimicrobial prescription not found');
    }

    const start = new Date(prescription.prescribed_datetime);
    const review = new Date(body.reviewDatetime);
    const hoursElapsed = Math.max(0, Math.round(((review.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10);

    const result = ctx.db
      .prepare(
        `INSERT INTO ams_timeout_reviews (
          ams_prescription_id, patient_id, reviewed_by_id, review_datetime,
          hours_since_initiation, timeout_action, culture_result_summary,
          clinical_response, justification_notes, new_antimicrobial_regimen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number(id),
        prescription.patient_id,
        user.id,
        body.reviewDatetime,
        hoursElapsed,
        body.timeoutAction,
        body.cultureResultSummary,
        body.clinicalResponse,
        body.justificationNotes,
        body.newAntimicrobialRegimen ?? null
      );

    // Update parent status if de-escalated, discontinued or oral switch
    if (body.timeoutAction === 'discontinue') {
      ctx.db.prepare('UPDATE ams_prescriptions SET status = ? WHERE id = ?').run('discontinued', Number(id));
    } else if (body.timeoutAction === 'de_escalate') {
      ctx.db.prepare('UPDATE ams_prescriptions SET status = ? WHERE id = ?').run('de_escalated', Number(id));
    } else if (body.timeoutAction === 'iv_to_oral_switch') {
      ctx.db.prepare('UPDATE ams_prescriptions SET status = ? WHERE id = ?').run('switched_oral', Number(id));
    }

    const record = ctx.db.prepare('SELECT * FROM ams_timeout_reviews WHERE id = ?').get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'ams.timeout_review',
      entity: 'ams_timeout_reviews',
      entityId: Number(result.lastInsertRowid),
      detail: {
        prescriptionId: Number(id),
        timeoutAction: body.timeoutAction,
        hoursElapsed,
      },
    });

    return reply.status(201).send({ timeoutReview: record });
  });

  // 6. Record Microbiology Isolate & Sensitivity Matrix
  app.get('/api/ams/isolates', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { patientId?: string };
    const patientId = query.patientId ? Number(query.patientId) : null;
    let sql = `
      SELECT i.*, pat.full_name as patient_name, pat.patient_number as patient_uhid
      FROM ams_microbiology_isolates i
      JOIN patients pat ON i.patient_id = pat.id
    `;
    const params: (number | string)[] = [];
    if (patientId) {
      sql += ' WHERE i.patient_id = ?';
      params.push(patientId);
    }
    sql += ' ORDER BY i.collection_datetime DESC';
    const isolates = ctx.db.prepare(sql).all(...params);
    return reply.send({ isolates });
  });

  app.post('/api/ams/isolates', async (req, reply) => {
    const user = assertCanManageAms(req);
    const body = parse(amsMicrobiologyIsolateSchema, req.body);

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patientId);
    if (!patient) {
      throw notFound('Patient not found');
    }

    const sensitivitiesJson = JSON.stringify(body.sensitivities);

    const result = ctx.db
      .prepare(
        `INSERT INTO ams_microbiology_isolates (
          patient_id, ams_prescription_id, collection_datetime, specimen_type,
          pathogen_isolated, colony_count_cfu_ml, sensitivities_json, multidrug_resistant, reported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.patientId,
        body.amsPrescriptionId ?? null,
        body.collectionDatetime,
        body.specimenType,
        body.pathogenIsolated,
        body.colonyCountCfuMl ?? null,
        sensitivitiesJson,
        body.multidrugResistant ? 1 : 0,
        body.reportedAt
      );

    const inserted = ctx.db
      .prepare('SELECT * FROM ams_microbiology_isolates WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'ams.isolate_record',
      entity: 'ams_microbiology_isolates',
      entityId: Number(result.lastInsertRowid),
      detail: {
        patientId: body.patientId,
        pathogen: body.pathogenIsolated,
        specimen: body.specimenType,
      },
    });

    return reply.status(201).send({ isolate: inserted });
  });

  // 7. Get Cumulative Antibiogram Matrix
  app.get('/api/ams/antibiogram', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');

    const isolates = ctx.db
      .prepare('SELECT pathogen_isolated, sensitivities_json FROM ams_microbiology_isolates')
      .all() as Array<{ pathogen_isolated: string; sensitivities_json: string }>;

    const antibiogram = generateAntibiogram(isolates);
    return reply.send({ antibiogram, totalIsolatesCount: isolates.length });
  });

  // 8. AMS Dashboard
  app.get('/api/ams/dashboard', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');

    const activePrescriptions = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                (SELECT COUNT(*) FROM ams_timeout_reviews WHERE ams_prescription_id = p.id) as timeout_reviews_count
         FROM ams_prescriptions p
         JOIN patients pat ON p.patient_id = pat.id
         WHERE p.status = 'active'
         ORDER BY p.prescribed_datetime ASC`
      )
      .all();

    const recentIsolates = ctx.db
      .prepare(
        `SELECT i.*, pat.full_name as patient_name, pat.patient_number as patient_uhid
         FROM ams_microbiology_isolates i
         JOIN patients pat ON i.patient_id = pat.id
         ORDER BY i.collection_datetime DESC
         LIMIT 15`
      )
      .all();

    return reply.send({
      activePrescriptions,
      recentIsolates,
    });
  });
}
