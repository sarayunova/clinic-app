import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricGbs,
} from '../../web/src/pediatricGbsEngine.js';

function assertCanManageGbs(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric GBS protocols');
  }
  return user;
}

const gbsEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.2).max(21.0),
  weightKg: z.coerce.number().min(2.0).max(120.0),
  antecedentInfectionType: z.enum([
    'campylobacter_gastroenteritis',
    'upper_respiratory_viral',
    'ebv_cmv_infection',
    'none_identified',
  ]),
  brightonCriteriaLevel: z.enum([
    'level_1_highest_certainty_csf_ncs',
    'level_2_csf_or_ncs',
    'level_3_clinical_only',
    'level_4_unclassifiable',
  ]),
  hughesDisabilityScore: z.coerce.number().int().min(0).max(6),
  ascendingSymmetricWeakness: z.boolean().default(true),
  areflexiaOrHyporeflexia: z.boolean().default(true),
  csfProteinMgDl: z.coerce.number().min(5.0).max(1500.0),
  csfWbcCountPerUl: z.coerce.number().int().min(0).max(500),
  vitalCapacityMlKg: z.coerce.number().min(2.0).max(80.0),
  negativeInspiratoryForceCmh2o: z.coerce.number().min(-120.0).max(0.0),
  peakExpiratoryPressureCmh2o: z.coerce.number().min(5.0).max(150.0),
  dysautonomiaSignsPresent: z.boolean().default(false),
  immunotherapyRegimen: z.enum([
    'ivig_2g_kg_over_2_days',
    'ivig_2g_kg_over_5_days',
    'plasma_exchange_tpe',
    'supportive_care_only',
  ]).default('ivig_2g_kg_over_2_days'),
  corticosteroidsAvoided: z.boolean().default(true),
  status: z.enum([
    'acute_diagnostic_evaluation',
    'picu_ventilatory_support',
    'immunotherapy_infusion_active',
    'dysautonomia_telemetry_monitoring',
    'subacute_rehabilitation_weaning',
    'resolved_full_motor_recovery',
  ]).default('acute_diagnostic_evaluation'),
  clinicalNotes: z.string().optional().nullable(),
});

const gbsFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  dayOfIllness: z.coerce.number().int().min(1).max(120),
  hughesScoreCurrent: z.coerce.number().int().min(0).max(6),
  vitalCapacityMlKg: z.coerce.number().min(2.0).max(80.0),
  singleBreathCount: z.coerce.number().int().min(0).max(60),
  cranialNervePalsyFacialBulbar: z.boolean().default(false),
  neckFlexionPowerMrc: z.coerce.number().int().min(0).max(5),
  heartRateBpm: z.coerce.number().int().min(30).max(250),
  systolicBp: z.coerce.number().int().min(40).max(250),
  diastolicBp: z.coerce.number().int().min(20).max(150),
  urinaryRetentionCatheterized: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export function registerPediatricGbsRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/pediatric-gbs/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(gbsEpisodeSchema.omit({ patientId: true }).partial({ onsetDatetime: true, status: true }), req.body);
    const evaluation = evaluatePediatricGbs({
      ageYears: data.ageYears,
      weightKg: data.weightKg,
      antecedentInfectionType: data.antecedentInfectionType,
      brightonCriteriaLevel: data.brightonCriteriaLevel,
      hughesDisabilityScore: data.hughesDisabilityScore,
      ascendingSymmetricWeakness: data.ascendingSymmetricWeakness,
      areflexiaOrHyporeflexia: data.areflexiaOrHyporeflexia,
      csfProteinMgDl: data.csfProteinMgDl,
      csfWbcCountPerUl: data.csfWbcCountPerUl,
      vitalCapacityMlKg: data.vitalCapacityMlKg,
      negativeInspiratoryForceCmh2o: data.negativeInspiratoryForceCmh2o,
      peakExpiratoryPressureCmh2o: data.peakExpiratoryPressureCmh2o,
      dysautonomiaSignsPresent: data.dysautonomiaSignsPresent,
      immunotherapyRegimen: data.immunotherapyRegimen,
      corticosteroidsAvoided: data.corticosteroidsAvoided,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-gbs/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM pediatric_gbs_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM pediatric_gbs_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.created_at DESC
      `).all();
    }

    return { episodes };
  });

  // 3. Get Single Episode with Evaluation and Flowsheet Logs
  app.get('/api/pediatric-gbs/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, p.date_of_birth, u.full_name as consultant_name
      FROM pediatric_gbs_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric GBS episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM pediatric_gbs_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.gbs_episode_id = ?
      ORDER BY f.log_datetime DESC
    `).all(Number(id));

    const evaluation = evaluatePediatricGbs({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      antecedentInfectionType: episode.antecedent_infection_type,
      brightonCriteriaLevel: episode.brighton_criteria_level,
      hughesDisabilityScore: episode.hughes_disability_score,
      ascendingSymmetricWeakness: Boolean(episode.ascending_symmetric_weakness),
      areflexiaOrHyporeflexia: Boolean(episode.areflexia_or_hyporeflexia),
      csfProteinMgDl: episode.csf_protein_mg_dl,
      csfWbcCountPerUl: episode.csf_wbc_count_per_ul,
      vitalCapacityMlKg: episode.vital_capacity_ml_kg,
      negativeInspiratoryForceCmh2o: episode.negative_inspiratory_force_cmh2o,
      peakExpiratoryPressureCmh2o: episode.peak_expiratory_pressure_cmh2o,
      dysautonomiaSignsPresent: Boolean(episode.dysautonomia_signs_present),
      immunotherapyRegimen: episode.immunotherapy_regimen,
      corticosteroidsAvoided: Boolean(episode.corticosteroids_avoided),
    });

    return { episode, evaluation, flowsheetLogs };
  });

  // 4. Create Episode
  app.post('/api/pediatric-gbs/episodes', async (req, reply) => {
    const user = assertCanManageGbs(req);
    const data = parse(gbsEpisodeSchema, req.body);

    const patient = db.prepare(`SELECT id FROM patients WHERE id = ?`).get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const episodeCode = `GBS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const result = db.prepare(`
      INSERT INTO pediatric_gbs_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_years, weight_kg,
        antecedent_infection_type, brighton_criteria_level, hughes_disability_score,
        ascending_symmetric_weakness, areflexia_or_hyporeflexia,
        csf_protein_mg_dl, csf_wbc_count_per_ul,
        vital_capacity_ml_kg, negative_inspiratory_force_cmh2o, peak_expiratory_pressure_cmh2o,
        dysautonomia_signs_present, immunotherapy_regimen, corticosteroids_avoided,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.antecedentInfectionType,
      data.brightonCriteriaLevel,
      data.hughesDisabilityScore,
      data.ascendingSymmetricWeakness ? 1 : 0,
      data.areflexiaOrHyporeflexia ? 1 : 0,
      data.csfProteinMgDl,
      data.csfWbcCountPerUl,
      data.vitalCapacityMlKg,
      data.negativeInspiratoryForceCmh2o,
      data.peakExpiratoryPressureCmh2o,
      data.dysautonomiaSignsPresent ? 1 : 0,
      data.immunotherapyRegimen,
      data.corticosteroidsAvoided ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const created = db.prepare(`SELECT * FROM pediatric_gbs_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_gbs.episode_create',
      entity: 'pediatric_gbs_episodes',
      entityId: created.id,
      detail: { episodeId: created.id, episodeCode, patientId: data.patientId },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/pediatric-gbs/episodes/:id', async (req) => {
    const user = assertCanManageGbs(req);
    const { id } = req.params as { id: string };
    const data = parse(gbsEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_gbs_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric GBS episode not found');

    db.prepare(`
      UPDATE pediatric_gbs_episodes SET
        admission_id = ?,
        onset_datetime = ?,
        age_years = ?,
        weight_kg = ?,
        antecedent_infection_type = ?,
        brighton_criteria_level = ?,
        hughes_disability_score = ?,
        ascending_symmetric_weakness = ?,
        areflexia_or_hyporeflexia = ?,
        csf_protein_mg_dl = ?,
        csf_wbc_count_per_ul = ?,
        vital_capacity_ml_kg = ?,
        negative_inspiratory_force_cmh2o = ?,
        peak_expiratory_pressure_cmh2o = ?,
        dysautonomia_signs_present = ?,
        immunotherapy_regimen = ?,
        corticosteroids_avoided = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.admissionId || null,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.antecedentInfectionType,
      data.brightonCriteriaLevel,
      data.hughesDisabilityScore,
      data.ascendingSymmetricWeakness ? 1 : 0,
      data.areflexiaOrHyporeflexia ? 1 : 0,
      data.csfProteinMgDl,
      data.csfWbcCountPerUl,
      data.vitalCapacityMlKg,
      data.negativeInspiratoryForceCmh2o,
      data.peakExpiratoryPressureCmh2o,
      data.dysautonomiaSignsPresent ? 1 : 0,
      data.immunotherapyRegimen,
      data.corticosteroidsAvoided ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM pediatric_gbs_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_gbs.episode_update',
      entity: 'pediatric_gbs_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: data.patientId },
    });

    return { episode: updated };
  });

  // 6. Patch Status
  app.patch('/api/pediatric-gbs/episodes/:id/status', async (req) => {
    const user = assertCanManageGbs(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({
      status: gbsEpisodeSchema.shape.status,
    }), req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_gbs_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric GBS episode not found');

    db.prepare(`
      UPDATE pediatric_gbs_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_gbs.status_patch',
      entity: 'pediatric_gbs_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), previousStatus: existing.status, newStatus: status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/pediatric-gbs/episodes/:id', async (req) => {
    const user = assertCanManageGbs(req);
    if (user.role !== 'doctor') throw forbidden('Only doctors can delete GBS episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM pediatric_gbs_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric GBS episode not found');

    db.prepare(`DELETE FROM pediatric_gbs_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_gbs.episode_delete',
      entity: 'pediatric_gbs_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: existing.patient_id },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Checkpoint
  app.post('/api/pediatric-gbs/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageGbs(req);
    const { id } = req.params as { id: string };
    const data = parse(gbsFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM pediatric_gbs_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric GBS episode not found');

    const result = db.prepare(`
      INSERT INTO pediatric_gbs_flowsheet_logs (
        gbs_episode_id, patient_id, log_datetime, day_of_illness,
        hughes_score_current, vital_capacity_ml_kg, single_breath_count,
        cranial_nerve_palsy_facial_bulbar, neck_flexion_power_mrc,
        heart_rate_bpm, systolic_bp, diastolic_bp,
        urinary_retention_catheterized, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.dayOfIllness,
      data.hughesScoreCurrent,
      data.vitalCapacityMlKg,
      data.singleBreathCount,
      data.cranialNervePalsyFacialBulbar ? 1 : 0,
      data.neckFlexionPowerMrc,
      data.heartRateBpm,
      data.systolicBp,
      data.diastolicBp,
      data.urinaryRetentionCatheterized ? 1 : 0,
      data.notes || null,
      user.id
    );

    const created = db.prepare(`SELECT * FROM pediatric_gbs_flowsheet_logs WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_gbs.flowsheet_add',
      entity: 'pediatric_gbs_flowsheet_logs',
      entityId: created.id,
      detail: { flowsheetId: created.id, episodeId: Number(id), patientId: episode.patient_id },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Checkpoint
  app.delete('/api/pediatric-gbs/flowsheet/:flowsheetId', async (req) => {
    const user = assertCanManageGbs(req);
    const { flowsheetId } = req.params as { flowsheetId: string };

    const existing = db.prepare(`SELECT * FROM pediatric_gbs_flowsheet_logs WHERE id = ?`).get(Number(flowsheetId)) as any;
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM pediatric_gbs_flowsheet_logs WHERE id = ?`).run(Number(flowsheetId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_gbs.flowsheet_delete',
      entity: 'pediatric_gbs_flowsheet_logs',
      entityId: Number(flowsheetId),
      detail: { flowsheetId: Number(flowsheetId), episodeId: existing.gbs_episode_id },
    });

    return { ok: true };
  });
}
