import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageHdu(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only obstetricians and maternity HDU nurses can manage magnesium resuscitation protocols');
  }
  return user;
}

export const mgso4ProtocolSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  regimenType: z.enum(['zuspan_iv', 'pritchard_im', 'neuroprotection_preterm']),
  indication: z.enum([
    'severe_preeclampsia_impending',
    'antepartum_eclampsia',
    'intrapartum_eclampsia',
    'postpartum_eclampsia',
    'fetal_neuroprotection_lt32w',
  ]),
  initiationDatetime: z.string().min(1, 'Initiation datetime is required'),
  loadingDoseDetails: z.string().min(1, 'Loading dose details required'),
  maintenanceRateGPerH: z.number().min(0).max(5).default(1.0),
});

export const mgso4FlowsheetSchema = z.object({
  observationDatetime: z.string().min(1, 'Observation datetime is required'),
  hourNumber: z.number().int().min(1).max(72),
  patellarReflex: z.enum([
    'absent_0',
    'sluggish_1_plus',
    'normal_2_plus',
    'brisk_3_plus',
    'hyperactive_clonus_4_plus',
  ]),
  respiratoryRateBpm: z.number().int().min(4).max(60),
  urineOutputLastHourMl: z.number().min(0).max(1000),
  bloodPressureSys: z.number().int().min(60).max(280),
  bloodPressureDia: z.number().int().min(30).max(180),
  heartRateBpm: z.number().int().min(30).max(220),
  spo2Percent: z.number().min(50).max(100).default(98),
  serumMagnesiumMgDl: z.number().nullable().optional(),
  fetalHeartRateBpm: z.number().nullable().optional(),
  actionTaken: z.enum([
    'continue_regimen',
    'hold_dose_recheck',
    'infusion_rate_reduced',
    'stopped_antidote_given',
  ]),
  antihypertensiveGiven: z.string().max(255).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export function registerObstetricHduRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List MgSO4 Protocols
  app.get('/api/mgso4/protocols', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const query = req.query as { patientId?: string; status?: string };
    const patientId = query.patientId ? Number(query.patientId) : null;
    const status = query.status || null;

    let sql = `
      SELECT p.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as prescribed_by_name,
             (SELECT COUNT(*) FROM mgso4_hourly_flowsheet_logs WHERE protocol_id = p.id) as hours_logged
      FROM mgso4_resuscitation_protocols p
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

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.initiation_datetime DESC LIMIT 100';

    const rows = ctx.db.prepare(sql).all(...params);
    return reply.send({ protocols: rows });
  });

  // 2. Initiate MgSO4 Protocol
  app.post('/api/mgso4/protocols', async (req, reply) => {
    const user = assertCanManageHdu(req);
    const body = parse(mgso4ProtocolSchema, req.body);

    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patientId);
    if (!patient) {
      throw notFound('Patient not found');
    }

    const dateStr = nowIso().slice(0, 10).replace(/-/g, '');
    const randStr = Math.floor(1000 + Math.random() * 9000).toString();
    const protocolCode = `MGSO4-${dateStr}-${randStr}`;

    const result = ctx.db
      .prepare(
        `INSERT INTO mgso4_resuscitation_protocols (
          patient_id, admission_id, protocol_code, regimen_type, indication,
          initiation_datetime, prescribed_by_id, loading_dose_given, loading_dose_details,
          maintenance_rate_g_per_h, recurrent_seizure_bolus_given, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 'active')`
      )
      .run(
        body.patientId,
        body.admissionId ?? null,
        protocolCode,
        body.regimenType,
        body.indication,
        body.initiationDatetime,
        user.id,
        body.loadingDoseDetails,
        body.maintenanceRateGPerH
      );

    const inserted = ctx.db
      .prepare('SELECT * FROM mgso4_resuscitation_protocols WHERE id = ?')
      .get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'mgso4.protocol_initiate',
      entity: 'mgso4_resuscitation_protocols',
      entityId: Number(result.lastInsertRowid),
      detail: {
        protocolId: Number(result.lastInsertRowid),
        patientId: body.patientId,
        regimenType: body.regimenType,
        protocolCode,
      },
    });

    return reply.status(201).send({ protocol: inserted });
  });

  // 3. Get single protocol with hourly flowsheet logs
  app.get('/api/mgso4/protocols/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const protocol = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as prescribed_by_name
         FROM mgso4_resuscitation_protocols p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN users u ON p.prescribed_by_id = u.id
         WHERE p.id = ?`
      )
      .get(Number(id));

    if (!protocol) {
      throw notFound('Magnesium resuscitation protocol not found');
    }

    const flowsheet = ctx.db
      .prepare(
        `SELECT f.*, u.full_name as nurse_name
         FROM mgso4_hourly_flowsheet_logs f
         JOIN users u ON f.nurse_id = u.id
         WHERE f.protocol_id = ?
         ORDER BY f.hour_number ASC`
      )
      .all(Number(id));

    return reply.send({ protocol, flowsheet });
  });

  // 4. Update Protocol Status (Complete, Hold, Abort)
  app.put('/api/mgso4/protocols/:id/status', async (req, reply) => {
    const user = assertCanManageHdu(req);
    const { id } = req.params as { id: string };
    const schema = z.object({
      status: z.enum(['active', 'completed_24h', 'held_toxicity', 'aborted']),
      terminationReason: z.string().max(500).optional(),
    });
    const body = parse(schema, req.body);

    const protocol = ctx.db.prepare('SELECT id FROM mgso4_resuscitation_protocols WHERE id = ?').get(Number(id));
    if (!protocol) {
      throw notFound('Protocol not found');
    }

    const termTime = body.status !== 'active' ? nowIso() : null;

    ctx.db
      .prepare(
        `UPDATE mgso4_resuscitation_protocols
         SET status = ?, termination_datetime = ?, termination_reason = ?
         WHERE id = ?`
      )
      .run(body.status, termTime, body.terminationReason ?? null, Number(id));

    const updated = ctx.db.prepare('SELECT * FROM mgso4_resuscitation_protocols WHERE id = ?').get(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'mgso4.status_update',
      entity: 'mgso4_resuscitation_protocols',
      entityId: Number(id),
      detail: { newStatus: body.status, reason: body.terminationReason },
    });

    return reply.send({ protocol: updated });
  });

  // 5. Log Hourly Magnesium Toxicity & Safety Flowsheet Checkpoint
  app.post('/api/mgso4/protocols/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageHdu(req);
    const { id } = req.params as { id: string };
    const body = parse(mgso4FlowsheetSchema, req.body);

    const protocol = ctx.db
      .prepare('SELECT id, status FROM mgso4_resuscitation_protocols WHERE id = ?')
      .get(Number(id)) as { id: number; status: string } | undefined;

    if (!protocol) {
      throw notFound('Protocol not found');
    }

    // Toxicity warning trigger: Loss of DTR (absent_0) OR RR < 16 OR UOP < 30 mL/h
    const isToxicityTriggered =
      body.patellarReflex === 'absent_0' || body.respiratoryRateBpm < 16 || body.urineOutputLastHourMl < 30;

    const result = ctx.db
      .prepare(
        `INSERT INTO mgso4_hourly_flowsheet_logs (
          protocol_id, observation_datetime, hour_number, patellar_reflex,
          respiratory_rate_bpm, urine_output_last_hour_ml, blood_pressure_sys, blood_pressure_dia,
          heart_rate_bpm, spo2_percent, serum_magnesium_mg_dl, fetal_heart_rate_bpm,
          toxicity_warning_triggered, action_taken, antihypertensive_given, nurse_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number(id),
        body.observationDatetime,
        body.hourNumber,
        body.patellarReflex,
        body.respiratoryRateBpm,
        body.urineOutputLastHourMl,
        body.bloodPressureSys,
        body.bloodPressureDia,
        body.heartRateBpm,
        body.spo2Percent,
        body.serumMagnesiumMgDl ?? null,
        body.fetalHeartRateBpm ?? null,
        isToxicityTriggered ? 1 : 0,
        body.actionTaken,
        body.antihypertensiveGiven ?? null,
        user.id,
        body.notes ?? null
      );

    const entry = ctx.db.prepare('SELECT * FROM mgso4_hourly_flowsheet_logs WHERE id = ?').get(result.lastInsertRowid);

    audit(ctx.db, {
      actorId: user.id,
      action: 'mgso4.flowsheet_log',
      entity: 'mgso4_hourly_flowsheet_logs',
      entityId: Number(result.lastInsertRowid),
      detail: {
        protocolId: Number(id),
        hourNumber: body.hourNumber,
        patellarReflex: body.patellarReflex,
        rr: body.respiratoryRateBpm,
        uop: body.urineOutputLastHourMl,
        toxicityTriggered: isToxicityTriggered,
      },
    });

    return reply.status(201).send({ flowsheetEntry: entry });
  });

  // 6. Administer Emergency 10% Calcium Gluconate Antidote
  app.post('/api/mgso4/protocols/:id/antidote', async (req, reply) => {
    const user = assertCanManageHdu(req);
    const { id } = req.params as { id: string };
    const schema = z.object({
      antidoteIndication: z.string().min(5, 'Indication is required'),
    });
    const body = parse(schema, req.body);

    const protocol = ctx.db.prepare('SELECT id FROM mgso4_resuscitation_protocols WHERE id = ?').get(Number(id));
    if (!protocol) {
      throw notFound('Protocol not found');
    }

    const antidoteTime = nowIso();

    ctx.db
      .prepare(
        `UPDATE mgso4_resuscitation_protocols
         SET antidote_calcium_gluconate_given = 1,
             antidote_datetime = ?,
             antidote_indication = ?,
             status = 'held_toxicity'
         WHERE id = ?`
      )
      .run(antidoteTime, body.antidoteIndication, Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'mgso4.antidote_trigger',
      entity: 'mgso4_resuscitation_protocols',
      entityId: Number(id),
      detail: { indication: body.antidoteIndication, administeredAt: antidoteTime },
    });

    return reply.send({ success: true, message: '10% Calcium Gluconate antidote recorded' });
  });

  // 7. Print Flowsheet Audit
  app.post('/api/mgso4/protocols/:id/print', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    audit(ctx.db, {
      actorId: user.id,
      action: 'mgso4.print',
      entity: 'mgso4_resuscitation_protocols',
      entityId: Number(id),
      detail: { protocolId: Number(id) },
    });

    return reply.send({ success: true, message: 'Print logged' });
  });

  // 8. Obstetric HDU Dashboard
  app.get('/api/mgso4/dashboard', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');

    const activeProtocols = ctx.db
      .prepare(
        `SELECT p.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                (SELECT COUNT(*) FROM mgso4_hourly_flowsheet_logs WHERE protocol_id = p.id) as hours_logged
         FROM mgso4_resuscitation_protocols p
         JOIN patients pat ON p.patient_id = pat.id
         WHERE p.status = 'active'
         ORDER BY p.initiation_datetime DESC`
      )
      .all();

    return reply.send({ activeProtocols });
  });
}
