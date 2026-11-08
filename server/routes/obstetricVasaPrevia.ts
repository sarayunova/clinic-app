import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricVasaPrevia,
} from '../../web/src/obstetricVasaPreviaEngine.js';

function assertCanManageVasaPrevia(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric vasa previa protocols');
  }
  return user;
}

const vasaPreviaEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  gestationalAgeWeeks: z.coerce.number().min(12.0).max(43.0),
  vasaPreviaType: z.enum([
    'type_1_velamentous_cord',
    'type_2_succenturiate_or_bilobed_lobe',
    'undetermined_aberrant_vessel',
  ]),
  distanceToInternalOsMm: z.coerce.number().min(0.0).max(100.0),
  colorDopplerConfirmed: z.boolean().default(true),
  cervicalLengthMm: z.coerce.number().min(1.0).max(80.0).optional().nullable(),
  vaginalBleedingPresent: z.boolean().default(false),
  aptTestResult: z.enum([
    'not_performed',
    'positive_fetal_hemoglobin_pink',
    'negative_maternal_hemoglobin_yellow_brown',
  ]).default('not_performed'),
  membraneStatus: z.enum([
    'intact',
    'ruptured_spontaneous',
    'artificial_rupture_contraindicated',
  ]),
  fetalHeartRateBpm: z.coerce.number().int().min(40).max(220).optional().nullable(),
  ctgPattern: z.enum([
    'category_1_normal',
    'category_2_variable_decelerations',
    'category_3_sinusoidal_pattern',
    'category_3_severe_prolonged_bradycardia',
  ]),
  corticosteroidsAdministered: z.boolean().default(false),
  electiveDeliveryWindowWeeks: z.enum([
    '34_0_to_35_6_weeks',
    'emergent_crash_cesarean',
    'outpatient_surveillance_pre_34w',
  ]),
  status: z.enum([
    'antenatal_surveillance',
    'inpatient_rupture_precautions',
    'emergent_crash_cesarean_section',
    'postpartum_neonatal_resuscitation',
    'resolved_maternal_neonatal_discharge',
  ]).default('antenatal_surveillance'),
  clinicalNotes: z.string().optional().nullable(),
});

const vasaPreviaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(12.0).max(43.0),
  maternalSystolicBp: z.coerce.number().int().min(60).max(260),
  maternalDiastolicBp: z.coerce.number().int().min(30).max(160),
  maternalHeartRate: z.coerce.number().int().min(40).max(200),
  fetalHeartRateBpm: z.coerce.number().int().min(40).max(220),
  ctgBaselineVariability: z.enum([
    'normal_moderate',
    'minimal',
    'absent',
    'sinusoidal',
  ]),
  vaginalBleedingSeverity: z.enum([
    'none',
    'spotting_pink_mucus',
    'frank_fetal_blood_active',
    'massive_hemorrhage',
  ]),
  uterineContractionsPer10min: z.coerce.number().int().min(0).max(10).default(0),
  notes: z.string().optional().nullable(),
});

export function registerObstetricVasaPreviaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate
  app.post('/api/obstetric-vasa-previa/evaluate', async (req) => {
    assertCanManageVasaPrevia(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricVasaPrevia({
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 32.0),
      vasaPreviaType: body.vasaPreviaType || 'type_1_velamentous_cord',
      distanceToInternalOsMm: Number(body.distanceToInternalOsMm || 10.0),
      colorDopplerConfirmed: body.colorDopplerConfirmed !== undefined ? Boolean(body.colorDopplerConfirmed) : true,
      cervicalLengthMm: body.cervicalLengthMm !== undefined && body.cervicalLengthMm !== null ? Number(body.cervicalLengthMm) : undefined,
      vaginalBleedingPresent: Boolean(body.vaginalBleedingPresent),
      aptTestResult: body.aptTestResult || 'not_performed',
      membraneStatus: body.membraneStatus || 'intact',
      fetalHeartRateBpm: body.fetalHeartRateBpm !== undefined && body.fetalHeartRateBpm !== null ? Number(body.fetalHeartRateBpm) : undefined,
      ctgPattern: body.ctgPattern || 'category_1_normal',
      corticosteroidsAdministered: Boolean(body.corticosteroidsAdministered),
      electiveDeliveryWindowWeeks: body.electiveDeliveryWindowWeeks || '34_0_to_35_6_weeks',
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-vasa-previa/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_vasa_previa_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` WHERE e.patient_id = ? `;
      params.push(Number(patientId));
    }

    query += ` ORDER BY e.id DESC`;

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 3. Get Episode Details with Flowsheet Logs
  app.get('/api/obstetric-vasa-previa/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_vasa_previa_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric vasa previa episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_vasa_previa_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.vasa_previa_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateObstetricVasaPrevia({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      vasaPreviaType: episode.vasa_previa_type,
      distanceToInternalOsMm: episode.distance_to_internal_os_mm,
      colorDopplerConfirmed: Boolean(episode.color_doppler_confirmed),
      cervicalLengthMm: episode.cervical_length_mm !== null ? episode.cervical_length_mm : undefined,
      vaginalBleedingPresent: Boolean(episode.vaginal_bleeding_present),
      aptTestResult: episode.apt_test_result,
      membraneStatus: episode.membrane_status,
      fetalHeartRateBpm: episode.fetal_heart_rate_bpm !== null ? episode.fetal_heart_rate_bpm : undefined,
      ctgPattern: episode.ctg_pattern,
      corticosteroidsAdministered: Boolean(episode.corticosteroids_administered),
      electiveDeliveryWindowWeeks: episode.elective_delivery_window_weeks,
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-vasa-previa/episodes', async (req) => {
    const user = assertCanManageVasaPrevia(req);
    const data = parse(vasaPreviaEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM obstetric_vasa_previa_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `VASA-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_vasa_previa_episodes (
        patient_id, admission_id, episode_code, gestational_age_weeks,
        vasa_previa_type, distance_to_internal_os_mm, color_doppler_confirmed,
        cervical_length_mm, vaginal_bleeding_present, apt_test_result,
        membrane_status, fetal_heart_rate_bpm, ctg_pattern,
        corticosteroids_administered, elective_delivery_window_weeks, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.gestationalAgeWeeks,
      data.vasaPreviaType,
      data.distanceToInternalOsMm,
      data.colorDopplerConfirmed ? 1 : 0,
      data.cervicalLengthMm || null,
      data.vaginalBleedingPresent ? 1 : 0,
      data.aptTestResult,
      data.membraneStatus,
      data.fetalHeartRateBpm || null,
      data.ctgPattern,
      data.corticosteroidsAdministered ? 1 : 0,
      data.electiveDeliveryWindowWeeks,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_vasa_previa.create',
      entity: 'obstetric_vasa_previa_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM obstetric_vasa_previa_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/obstetric-vasa-previa/episodes/:id', async (req) => {
    const user = assertCanManageVasaPrevia(req);
    const { id } = req.params as { id: string };
    const data = parse(vasaPreviaEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_vasa_previa_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric vasa previa episode not found');

    db.prepare(`
      UPDATE obstetric_vasa_previa_episodes SET
        patient_id = ?, admission_id = ?, gestational_age_weeks = ?,
        vasa_previa_type = ?, distance_to_internal_os_mm = ?, color_doppler_confirmed = ?,
        cervical_length_mm = ?, vaginal_bleeding_present = ?, apt_test_result = ?,
        membrane_status = ?, fetal_heart_rate_bpm = ?, ctg_pattern = ?,
        corticosteroids_administered = ?, elective_delivery_window_weeks = ?, status = ?,
        clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.gestationalAgeWeeks,
      data.vasaPreviaType,
      data.distanceToInternalOsMm,
      data.colorDopplerConfirmed ? 1 : 0,
      data.cervicalLengthMm || null,
      data.vaginalBleedingPresent ? 1 : 0,
      data.aptTestResult,
      data.membraneStatus,
      data.fetalHeartRateBpm || null,
      data.ctgPattern,
      data.corticosteroidsAdministered ? 1 : 0,
      data.electiveDeliveryWindowWeeks,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_vasa_previa.update',
      entity: 'obstetric_vasa_previa_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: data.patientId },
    });

    const updated = db.prepare(`SELECT * FROM obstetric_vasa_previa_episodes WHERE id = ?`).get(Number(id));
    return { episode: updated };
  });

  // 6. Add Flowsheet Log
  app.post('/api/obstetric-vasa-previa/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageVasaPrevia(req);
    const { id } = req.params as { id: string };
    const data = parse(vasaPreviaFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT patient_id FROM obstetric_vasa_previa_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric vasa previa episode not found');

    const result = db.prepare(`
      INSERT INTO obstetric_vasa_previa_flowsheet_logs (
        vasa_previa_episode_id, patient_id, log_datetime, gestational_age_weeks,
        maternal_systolic_bp, maternal_diastolic_bp, maternal_heart_rate,
        fetal_heart_rate_bpm, ctg_baseline_variability, vaginal_bleeding_severity,
        uterine_contractions_per_10min, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.gestationalAgeWeeks,
      data.maternalSystolicBp,
      data.maternalDiastolicBp,
      data.maternalHeartRate,
      data.fetalHeartRateBpm,
      data.ctgBaselineVariability,
      data.vaginalBleedingSeverity,
      data.uterineContractionsPer10min,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_vasa_previa.flowsheet_add',
      entity: 'obstetric_vasa_previa_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, patientId: episode.patient_id },
    });

    const log = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_vasa_previa_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.id = ?
    `).get(logId);

    return { log };
  });
}
