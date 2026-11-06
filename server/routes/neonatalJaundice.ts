import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import {
  evaluateNeonatalBilirubin,
  calculateBilirubinRateOfRise,
  calculateAgeInHours,
} from '../../web/src/neonatalJaundiceEngine.js';

function assertCanManageJaundice(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical pediatric, obstetric, and neonatal nursing staff can manage neonatal jaundice records');
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

export const createJaundiceEpisodeSchema = z
  .object({
    admissionId: z.number().int().positive().nullable().optional(),
    deliveryRecordId: z.number().int().positive().nullable().optional(),
    birthDatetime: z.string().min(1, 'Birth date/time is required'),
    gestationalAgeWeeks: z.number().int().min(24).max(45),
    birthWeightGrams: optNullableNumber(300, 7000),
    bloodGroup: optNullableString(10),
    maternalBloodGroup: optNullableString(10),
    directCoombsTest: z.enum(['positive', 'negative', 'not_tested']).default('not_tested'),
    g6pdDeficiency: z.enum(['normal', 'deficient', 'not_tested']).default('not_tested'),
    neurotoxicityRisk: z.boolean().default(false),
    feedingType: z.enum(['exclusive_breastfeeding', 'formula', 'mixed']).default('exclusive_breastfeeding'),
    status: z.enum(['monitoring', 'under_phototherapy', 'resolved', 'escalated_transfusion', 'discharged']).default('monitoring'),
    clinicalSummary: optNullableString(2000),
  })
  .strict();

export const patchJaundiceEpisodeSchema = createJaundiceEpisodeSchema.partial();

export const createBilirubinReadingSchema = z
  .object({
    sampleDatetime: z.string().min(1, 'Sample date/time is required'),
    ageHours: z.number().int().min(0).max(720).optional(),
    readingType: z.enum(['tsb_serum', 'tcb_transcutaneous']).default('tsb_serum'),
    bilirubinMgDl: z.number().min(0.1).max(50.0),
    activePhototherapy: z.boolean().default(false),
    phototherapyDevice: optNullableString(100),
    notes: optNullableString(1000),
  })
  .strict();

type DbJaundiceEpisodeRow = {
  id: number;
  patient_id: number;
  admission_id: number | null;
  delivery_record_id: number | null;
  birth_datetime: string;
  gestational_age_weeks: number;
  birth_weight_grams: number | null;
  blood_group: string | null;
  maternal_blood_group: string | null;
  direct_coombs_test: string;
  g6pd_deficiency: string;
  neurotoxicity_risk: number;
  feeding_type: string;
  status: string;
  clinical_summary: string | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  patient_name?: string;
  patient_number?: string;
};

type DbBilirubinReadingRow = {
  id: number;
  episode_id: number;
  patient_id: number;
  sample_datetime: string;
  age_hours: number;
  reading_type: string;
  bilirubin_mg_dl: number;
  bilirubin_umol_l: number | null;
  rate_of_rise_mg_dl_hr: number | null;
  bhutani_risk_zone: string | null;
  phototherapy_threshold_mg_dl: number | null;
  exchange_threshold_mg_dl: number | null;
  phototherapy_indicated: number;
  exchange_indicated: number;
  clinical_action: string | null;
  active_phototherapy: number;
  phototherapy_device: string | null;
  notes: string | null;
  created_by: number;
  created_at: string;
  created_by_name?: string | null;
};

function mapReadingRow(rd: DbBilirubinReadingRow) {
  return {
    id: rd.id,
    episodeId: rd.episode_id,
    patientId: rd.patient_id,
    sampleDatetime: rd.sample_datetime,
    ageHours: rd.age_hours,
    readingType: rd.reading_type,
    bilirubinMgDl: rd.bilirubin_mg_dl,
    bilirubinUmolL: rd.bilirubin_umol_l,
    rateOfRiseMgDlHr: rd.rate_of_rise_mg_dl_hr,
    bhutaniRiskZone: rd.bhutani_risk_zone,
    phototherapyThresholdMgDl: rd.phototherapy_threshold_mg_dl,
    exchangeThresholdMgDl: rd.exchange_threshold_mg_dl,
    phototherapyIndicated: rd.phototherapy_indicated ? 1 : 0,
    exchangeIndicated: rd.exchange_indicated ? 1 : 0,
    clinicalAction: rd.clinical_action,
    activePhototherapy: rd.active_phototherapy ? 1 : 0,
    phototherapyDevice: rd.phototherapy_device,
    notes: rd.notes,
    createdBy: rd.created_by,
    createdByName: rd.created_by_name ?? null,
    createdAt: rd.created_at,
  };
}

function mapEpisodeRow(r: DbJaundiceEpisodeRow, readings: DbBilirubinReadingRow[] = []) {
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name ?? null,
    patientNumber: r.patient_number ?? null,
    admissionId: r.admission_id,
    deliveryRecordId: r.delivery_record_id,
    birthDatetime: r.birth_datetime,
    gestationalAgeWeeks: r.gestational_age_weeks,
    birthWeightGrams: r.birth_weight_grams,
    bloodGroup: r.blood_group,
    maternalBloodGroup: r.maternal_blood_group,
    directCoombsTest: r.direct_coombs_test,
    g6pdDeficiency: r.g6pd_deficiency,
    neurotoxicityRisk: Boolean(r.neurotoxicity_risk),
    feedingType: r.feeding_type,
    status: r.status,
    clinicalSummary: r.clinical_summary,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    readingsCount: readings.length,
    readings: readings.map(mapReadingRow),
    latestReading: readings.length > 0 ? mapReadingRow(readings[readings.length - 1]!) : null,
  };
}

export function registerNeonatalJaundiceRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // GET /api/patients/:id/neonatal-jaundice
  app.get('/api/patients/:id/neonatal-jaundice', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const episodes = db
      .prepare(
        `SELECT e.*,
                p.full_name AS patient_name,
                p.patient_number,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name
         FROM neonatal_jaundice_episodes e
         JOIN patients p ON p.id = e.patient_id
         LEFT JOIN users cu ON cu.id = e.created_by
         LEFT JOIN users uu ON uu.id = e.updated_by
         WHERE e.patient_id = ?
         ORDER BY e.created_at DESC`
      )
      .all(patientId) as DbJaundiceEpisodeRow[];

    const result = [];
    for (const ep of episodes) {
      const readings = db
        .prepare(
          `SELECT r.*, cu.full_name AS created_by_name
           FROM neonatal_bilirubin_readings r
           LEFT JOIN users cu ON cu.id = r.created_by
           WHERE r.episode_id = ?
           ORDER BY r.age_hours ASC, r.id ASC`
        )
        .all(ep.id) as DbBilirubinReadingRow[];
      result.push(mapEpisodeRow(ep, readings));
    }

    return { patientId, episodes: result };
  });

  // POST /api/patients/:id/neonatal-jaundice
  app.post('/api/patients/:id/neonatal-jaundice', async (req, reply) => {
    const user = assertCanManageJaundice(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(createJaundiceEpisodeSchema, req.body);
    const now = nowIso();

    const stmt = db.prepare(`
      INSERT INTO neonatal_jaundice_episodes (
        patient_id, admission_id, delivery_record_id, birth_datetime, gestational_age_weeks,
        birth_weight_grams, blood_group, maternal_blood_group, direct_coombs_test, g6pd_deficiency,
        neurotoxicity_risk, feeding_type, status, clinical_summary, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      patientId,
      b.admissionId ?? null,
      b.deliveryRecordId ?? null,
      b.birthDatetime,
      b.gestationalAgeWeeks,
      b.birthWeightGrams ?? null,
      b.bloodGroup ?? null,
      b.maternalBloodGroup ?? null,
      b.directCoombsTest,
      b.g6pdDeficiency,
      b.neurotoxicityRisk ? 1 : 0,
      b.feedingType,
      b.status,
      b.clinicalSummary ?? null,
      user.id,
      user.id,
      now,
      now
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_jaundice.create_episode',
      entity: 'patient',
      entityId: patientId,
      detail: {
        episodeId,
        gestationalAgeWeeks: b.gestationalAgeWeeks,
        neurotoxicityRisk: b.neurotoxicityRisk,
        status: b.status,
      },
    });

    const created = db.prepare('SELECT * FROM neonatal_jaundice_episodes WHERE id = ?').get(episodeId) as DbJaundiceEpisodeRow;
    return reply.status(201).send(mapEpisodeRow(created, []));
  });

  // GET /api/neonatal-jaundice/:episodeId
  app.get('/api/neonatal-jaundice/:episodeId', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const episodeId = Number((req.params as { episodeId: string }).episodeId);
    if (!Number.isInteger(episodeId) || episodeId <= 0) throw badRequest('Invalid episode ID');

    const ep = db
      .prepare(
        `SELECT e.*,
                p.full_name AS patient_name,
                p.patient_number,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name
         FROM neonatal_jaundice_episodes e
         JOIN patients p ON p.id = e.patient_id
         LEFT JOIN users cu ON cu.id = e.created_by
         LEFT JOIN users uu ON uu.id = e.updated_by
         WHERE e.id = ?`
      )
      .get(episodeId) as DbJaundiceEpisodeRow | undefined;

    if (!ep) throw notFound('Jaundice episode not found');

    const readings = db
      .prepare(
        `SELECT r.*, cu.full_name AS created_by_name
         FROM neonatal_bilirubin_readings r
         LEFT JOIN users cu ON cu.id = r.created_by
         WHERE r.episode_id = ?
         ORDER BY r.age_hours ASC, r.id ASC`
      )
      .all(episodeId) as DbBilirubinReadingRow[];

    return mapEpisodeRow(ep, readings);
  });

  // PATCH /api/neonatal-jaundice/:episodeId
  app.patch('/api/neonatal-jaundice/:episodeId', async (req) => {
    const user = assertCanManageJaundice(req);
    const episodeId = Number((req.params as { episodeId: string }).episodeId);
    if (!Number.isInteger(episodeId) || episodeId <= 0) throw badRequest('Invalid episode ID');

    const existing = db.prepare('SELECT * FROM neonatal_jaundice_episodes WHERE id = ?').get(episodeId) as DbJaundiceEpisodeRow | undefined;
    if (!existing) throw notFound('Jaundice episode not found');

    const b = parse(patchJaundiceEpisodeSchema, req.body);
    const now = nowIso();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const fieldMap: Record<string, string> = {
      admissionId: 'admission_id',
      deliveryRecordId: 'delivery_record_id',
      birthDatetime: 'birth_datetime',
      gestationalAgeWeeks: 'gestational_age_weeks',
      birthWeightGrams: 'birth_weight_grams',
      bloodGroup: 'blood_group',
      maternalBloodGroup: 'maternal_blood_group',
      directCoombsTest: 'direct_coombs_test',
      g6pdDeficiency: 'g6pd_deficiency',
      feedingType: 'feeding_type',
      status: 'status',
      clinicalSummary: 'clinical_summary',
    };

    for (const [k, col] of Object.entries(fieldMap)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as Record<string, any>)[k] ?? null);
      }
    }

    if ('neurotoxicityRisk' in b) {
      fields.push('neurotoxicity_risk = ?');
      values.push(b.neurotoxicityRisk ? 1 : 0);
    }

    if (fields.length === 0) throw badRequest('No fields to update');

    fields.push('updated_by = ?', 'updated_at = ?');
    values.push(user.id, now, episodeId);

    db.prepare(`UPDATE neonatal_jaundice_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_jaundice.update_episode',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: { episodeId, updatedFields: Object.keys(b) },
    });

    const updated = db.prepare('SELECT * FROM neonatal_jaundice_episodes WHERE id = ?').get(episodeId) as DbJaundiceEpisodeRow;
    const readings = db
      .prepare(
        `SELECT r.*, cu.full_name AS created_by_name
         FROM neonatal_bilirubin_readings r
         LEFT JOIN users cu ON cu.id = r.created_by
         WHERE r.episode_id = ?
         ORDER BY r.age_hours ASC, r.id ASC`
      )
      .all(episodeId) as DbBilirubinReadingRow[];

    return mapEpisodeRow(updated, readings);
  });

  // POST /api/neonatal-jaundice/:episodeId/readings
  app.post('/api/neonatal-jaundice/:episodeId/readings', async (req, reply) => {
    const user = assertCanManageJaundice(req);
    const episodeId = Number((req.params as { episodeId: string }).episodeId);
    if (!Number.isInteger(episodeId) || episodeId <= 0) throw badRequest('Invalid episode ID');

    const episode = db.prepare('SELECT * FROM neonatal_jaundice_episodes WHERE id = ?').get(episodeId) as DbJaundiceEpisodeRow | undefined;
    if (!episode) throw notFound('Jaundice episode not found');

    const b = parse(createBilirubinReadingSchema, req.body);
    const now = nowIso();

    const ageHours = b.ageHours != null && b.ageHours > 0
      ? b.ageHours
      : calculateAgeInHours(episode.birth_datetime, b.sampleDatetime);

    // Evaluate AAP 2022 and Bhutani
    const evaluation = evaluateNeonatalBilirubin({
      bilirubinMgDl: b.bilirubinMgDl,
      ageHours,
      gaWeeks: episode.gestational_age_weeks,
      hasNeurotoxicityRisk: Boolean(episode.neurotoxicity_risk),
    });

    // Check rate of rise against latest previous reading
    const prevReading = db
      .prepare(
        `SELECT age_hours, bilirubin_mg_dl
         FROM neonatal_bilirubin_readings
         WHERE episode_id = ? AND age_hours < ?
         ORDER BY age_hours DESC, id DESC
         LIMIT 1`
      )
      .get(episodeId, ageHours) as { age_hours: number; bilirubin_mg_dl: number } | undefined;

    let rateOfRise: number | null = null;
    if (prevReading) {
      const ror = calculateBilirubinRateOfRise(
        { ageHours: prevReading.age_hours, bilirubinMgDl: prevReading.bilirubin_mg_dl },
        { ageHours, bilirubinMgDl: b.bilirubinMgDl }
      );
      if (ror) rateOfRise = ror.ratePerHour;
    }

    const stmt = db.prepare(`
      INSERT INTO neonatal_bilirubin_readings (
        episode_id, patient_id, sample_datetime, age_hours, reading_type, bilirubin_mg_dl,
        bilirubin_umol_l, rate_of_rise_mg_dl_hr, bhutani_risk_zone, phototherapy_threshold_mg_dl,
        exchange_threshold_mg_dl, phototherapy_indicated, exchange_indicated, clinical_action,
        active_phototherapy, phototherapy_device, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      episodeId,
      episode.patient_id,
      b.sampleDatetime,
      ageHours,
      b.readingType,
      b.bilirubinMgDl,
      evaluation.bilirubinUmolL,
      rateOfRise,
      evaluation.bhutaniZone,
      evaluation.phototherapyThreshold,
      evaluation.exchangeThreshold,
      evaluation.phototherapyIndicated ? 1 : 0,
      evaluation.exchangeIndicated ? 1 : 0,
      evaluation.clinicalAction,
      b.activePhototherapy ? 1 : 0,
      b.phototherapyDevice ?? null,
      b.notes ?? null,
      user.id,
      now
    );

    const readingId = Number(result.lastInsertRowid);

    // If phototherapy is indicated and baby is only 'monitoring', auto-progress status
    if (evaluation.phototherapyIndicated && episode.status === 'monitoring') {
      db.prepare('UPDATE neonatal_jaundice_episodes SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
        'under_phototherapy',
        user.id,
        now,
        episodeId
      );
    }

    audit(db, {
      actorId: user.id,
      action: 'neonatal_jaundice.log_reading',
      entity: 'patient',
      entityId: episode.patient_id,
      detail: {
        episodeId,
        readingId,
        ageHours,
        bilirubinMgDl: b.bilirubinMgDl,
        bhutaniZone: evaluation.bhutaniZone,
        phototherapyIndicated: evaluation.phototherapyIndicated,
      },
    });

    const createdReading = db
      .prepare('SELECT r.*, cu.full_name AS created_by_name FROM neonatal_bilirubin_readings r LEFT JOIN users cu ON cu.id = r.created_by WHERE r.id = ?')
      .get(readingId) as DbBilirubinReadingRow;

    return reply.status(201).send(mapReadingRow(createdReading));
  });

  // DELETE /api/neonatal-jaundice/readings/:readingId
  app.delete('/api/neonatal-jaundice/readings/:readingId', async (req) => {
    const user = assertCanManageJaundice(req);
    const readingId = Number((req.params as { readingId: string }).readingId);
    if (!Number.isInteger(readingId) || readingId <= 0) throw badRequest('Invalid reading ID');

    const reading = db.prepare('SELECT * FROM neonatal_bilirubin_readings WHERE id = ?').get(readingId) as DbBilirubinReadingRow | undefined;
    if (!reading) throw notFound('Reading not found');

    db.prepare('DELETE FROM neonatal_bilirubin_readings WHERE id = ?').run(readingId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_jaundice.delete_reading',
      entity: 'patient',
      entityId: reading.patient_id,
      detail: { episodeId: reading.episode_id, readingId },
    });

    return { ok: true };
  });
}
