import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricCvst,
  type ClinicalTiming,
  type HeadacheType,
  type AnticoagulantAgent,
  type IntracranialHypertensionManagement,
} from '../../web/src/obstetricCvstEngine.js';

function assertCanManageCvst(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric CVST protocols');
  }
  return user;
}

const cvstEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(0.0).max(43.0),
  clinicalTiming: z.enum([
    'antepartum_first_trimester',
    'antepartum_second_trimester',
    'antepartum_third_trimester',
    'early_postpartum_puerperium',
    'late_postpartum',
  ]),
  presentingHeadacheType: z.enum([
    'thunderclap_sudden_severe',
    'progressive_unremitting_subacute',
    'postural_headache_mimicking_pdph',
    'mild_intermittent',
  ]),
  seizuresPresent: z.boolean().default(false),
  papilledemaPresent: z.boolean().default(false),
  focalNeurologicalDeficit: z.boolean().default(false),
  alteredMentalStatusComa: z.boolean().default(false),
  thrombosedSinusLocations: z.array(z.string()).default([]),
  intracranialHemorrhagicVenousInfarct: z.boolean().default(false),
  therapeuticAnticoagulationActive: z.boolean().default(true),
  anticoagulantAgent: z.enum([
    'therapeutic_lmwh_enoxaparin_1mg_kg_q12h',
    'therapeutic_ufh_continuous_infusion',
    'withheld_severe_mass_effect_neurosurgery',
    'other',
  ]).default('therapeutic_lmwh_enoxaparin_1mg_kg_q12h'),
  intracranialHypertensionManagement: z.enum([
    'elevate_head_bed_and_osmotherapy',
    'mannitol_or_hypertonic_saline_infusion',
    'decompressive_hemicraniectomy_eval',
    'conservative_monitoring',
  ]).default('elevate_head_bed_and_osmotherapy'),
  antiepilepticTherapyActive: z.boolean().default(false),
  status: z.enum([
    'acute_cvst_inpatient_resuscitation',
    'therapeutic_anticoagulation_active',
    'elevated_icp_critical_monitoring',
    'endovascular_or_surgical_intervention',
    'subacute_neurological_rehabilitation',
    'convalescent_long_term_anticoagulation',
    'maternal_demise',
  ]).default('acute_cvst_inpatient_resuscitation'),
  clinicalNotes: z.string().optional().nullable(),
});

const cvstFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  gcsScore: z.coerce.number().int().min(3).max(15),
  pupillaryReactivity: z.enum(['equal_and_reactive', 'sluggish', 'unilateral_dilated', 'bilateral_fixed']),
  headacheSeverityNrs: z.coerce.number().int().min(0).max(10),
  systolicBpMmhg: z.coerce.number().int().min(60).max(250),
  diastolicBpMmhg: z.coerce.number().int().min(40).max(160),
  heartRateBpm: z.coerce.number().int().min(30).max(220),
  antiXaOrApttLevel: z.coerce.number().min(0.0).max(200.0).default(0.0),
  seizureActivityObserved: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export function registerObstetricCvstRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview API (No DB Persistence)
  app.post('/api/obstetric-cvst/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const b = req.body as any;
    const evaluation = evaluateObstetricCvst({
      gestationalAgeWeeks: Number(b.gestationalAgeWeeks ?? 38.0),
      clinicalTiming: b.clinicalTiming || 'early_postpartum_puerperium',
      presentingHeadacheType: b.presentingHeadacheType || 'progressive_unremitting_subacute',
      seizuresPresent: Boolean(b.seizuresPresent),
      papilledemaPresent: Boolean(b.papilledemaPresent),
      focalNeurologicalDeficit: Boolean(b.focalNeurologicalDeficit),
      alteredMentalStatusComa: Boolean(b.alteredMentalStatusComa),
      thrombosedSinusLocations: Array.isArray(b.thrombosedSinusLocations) ? b.thrombosedSinusLocations : [],
      intracranialHemorrhagicVenousInfarct: Boolean(b.intracranialHemorrhagicVenousInfarct),
      therapeuticAnticoagulationActive: Boolean(b.therapeuticAnticoagulationActive ?? true),
      anticoagulantAgent: b.anticoagulantAgent || 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h',
      intracranialHypertensionManagement: b.intracranialHypertensionManagement || 'elevate_head_bed_and_osmotherapy',
      antiepilepticTherapyActive: Boolean(b.antiepilepticTherapyActive),
    });
    return { evaluation };
  });

  // 2. List Episodes (supports ?patientId= query or all)
  app.get('/api/obstetric-cvst/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM obstetric_cvst_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.onset_datetime DESC, e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM obstetric_cvst_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.onset_datetime DESC, e.created_at DESC
      `).all();
    }
    return { episodes };
  });

  // 2b. List Episodes for Patient (URL param compatibility)
  app.get('/api/obstetric-cvst/patient/:patientId', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const episodes = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM obstetric_cvst_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.patient_id = ?
      ORDER BY e.onset_datetime DESC, e.created_at DESC
    `).all(Number(patientId));
    return { episodes };
  });

  // 3. Get Single Episode with Flowsheet and Evaluation
  app.get('/api/obstetric-cvst/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM obstetric_cvst_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric CVST episode not found');

    const flowsheet = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM obstetric_cvst_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.episode_id = ?
      ORDER BY f.log_datetime ASC, f.created_at ASC
    `).all(Number(id));

    let sinusLocations: string[] = [];
    try {
      sinusLocations = JSON.parse(episode.thrombosed_sinus_locations_json || '[]');
    } catch {
      sinusLocations = [];
    }

    const evaluation = evaluateObstetricCvst({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      clinicalTiming: episode.clinical_timing,
      presentingHeadacheType: episode.presenting_headache_type,
      seizuresPresent: Boolean(episode.seizures_present),
      papilledemaPresent: Boolean(episode.papilledema_present),
      focalNeurologicalDeficit: Boolean(episode.focal_neurological_deficit),
      alteredMentalStatusComa: Boolean(episode.altered_mental_status_coma),
      thrombosedSinusLocations: sinusLocations,
      intracranialHemorrhagicVenousInfarct: Boolean(episode.intracranial_hemorrhagic_venous_infarct),
      therapeuticAnticoagulationActive: Boolean(episode.therapeutic_anticoagulation_active),
      anticoagulantAgent: episode.anticoagulant_agent,
      intracranialHypertensionManagement: episode.intracranial_hypertension_management,
      antiepilepticTherapyActive: Boolean(episode.antiepileptic_therapy_active),
    });

    return { episode, flowsheet, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-cvst/episodes', async (req, reply) => {
    const user = assertCanManageCvst(req);
    const data = parse(cvstEpisodeSchema, req.body);

    const codeSuffix = Math.floor(100 + Math.random() * 900);
    const episodeCode = `CVST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${codeSuffix}`;

    const result = db.prepare(`
      INSERT INTO obstetric_cvst_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        gestational_age_weeks, clinical_timing, presenting_headache_type,
        seizures_present, papilledema_present, focal_neurological_deficit,
        altered_mental_status_coma, thrombosed_sinus_locations_json,
        intracranial_hemorrhagic_venous_infarct, therapeutic_anticoagulation_active,
        anticoagulant_agent, intracranial_hypertension_management,
        antiepileptic_therapy_active, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.clinicalTiming,
      data.presentingHeadacheType,
      data.seizuresPresent ? 1 : 0,
      data.papilledemaPresent ? 1 : 0,
      data.focalNeurologicalDeficit ? 1 : 0,
      data.alteredMentalStatusComa ? 1 : 0,
      JSON.stringify(data.thrombosedSinusLocations),
      data.intracranialHemorrhagicVenousInfarct ? 1 : 0,
      data.therapeuticAnticoagulationActive ? 1 : 0,
      data.anticoagulantAgent,
      data.intracranialHypertensionManagement,
      data.antiepilepticTherapyActive ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null
    );

    const created = db.prepare(`SELECT * FROM obstetric_cvst_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cvst.create',
      entity: 'obstetric_cvst_episodes',
      entityId: created.id,
      detail: { patientId: data.patientId, episodeCode, status: data.status },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/obstetric-cvst/episodes/:id', async (req) => {
    const user = assertCanManageCvst(req);
    const { id } = req.params as { id: string };
    const data = parse(cvstEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_cvst_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric CVST episode not found');

    db.prepare(`
      UPDATE obstetric_cvst_episodes SET
        gestational_age_weeks = ?,
        clinical_timing = ?,
        presenting_headache_type = ?,
        seizures_present = ?,
        papilledema_present = ?,
        focal_neurological_deficit = ?,
        altered_mental_status_coma = ?,
        thrombosed_sinus_locations_json = ?,
        intracranial_hemorrhagic_venous_infarct = ?,
        therapeutic_anticoagulation_active = ?,
        anticoagulant_agent = ?,
        intracranial_hypertension_management = ?,
        antiepileptic_therapy_active = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.gestationalAgeWeeks,
      data.clinicalTiming,
      data.presentingHeadacheType,
      data.seizuresPresent ? 1 : 0,
      data.papilledemaPresent ? 1 : 0,
      data.focalNeurologicalDeficit ? 1 : 0,
      data.alteredMentalStatusComa ? 1 : 0,
      JSON.stringify(data.thrombosedSinusLocations),
      data.intracranialHemorrhagicVenousInfarct ? 1 : 0,
      data.therapeuticAnticoagulationActive ? 1 : 0,
      data.anticoagulantAgent,
      data.intracranialHypertensionManagement,
      data.antiepilepticTherapyActive ? 1 : 0,
      data.status,
      data.clinicalNotes ?? null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM obstetric_cvst_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cvst.update',
      entity: 'obstetric_cvst_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status: data.status },
    });

    return { episode: updated };
  });

  // 6. Update Status Only
  app.patch('/api/obstetric-cvst/episodes/:id/status', async (req) => {
    const user = assertCanManageCvst(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({ status: z.string() }), req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_cvst_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric CVST episode not found');

    db.prepare(`
      UPDATE obstetric_cvst_episodes SET
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    const updated = db.prepare(`SELECT * FROM obstetric_cvst_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cvst.status_change',
      entity: 'obstetric_cvst_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), oldStatus: existing.status, newStatus: status },
    });

    return { episode: updated };
  });

  // 7. Delete Episode
  app.delete('/api/obstetric-cvst/episodes/:id', async (req) => {
    const user = assertCanManageCvst(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM obstetric_cvst_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric CVST episode not found');

    db.prepare(`DELETE FROM obstetric_cvst_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cvst.delete',
      entity: 'obstetric_cvst_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), code: existing.episode_code },
    });

    return { success: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/obstetric-cvst/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageCvst(req);
    const { id } = req.params as { id: string };
    const data = parse(cvstFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM obstetric_cvst_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric CVST episode not found');

    const result = db.prepare(`
      INSERT INTO obstetric_cvst_flowsheet_logs (
        episode_id, patient_id, log_datetime, gcs_score,
        pupillary_reactivity, headache_severity_nrs, systolic_bp_mmhg,
        diastolic_bp_mmhg, heart_rate_bpm, anti_xa_or_aptt_level,
        seizure_activity_observed, notes, logged_by_id
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
      data.gcsScore,
      data.pupillaryReactivity,
      data.headacheSeverityNrs,
      data.systolicBpMmhg,
      data.diastolicBpMmhg,
      data.heartRateBpm,
      data.antiXaOrApttLevel,
      data.seizureActivityObserved ? 1 : 0,
      data.notes ?? null,
      user.id
    );

    const created = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM obstetric_cvst_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.id = ?
    `).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cvst.flowsheet_add',
      entity: 'obstetric_cvst_flowsheet_logs',
      entityId: created.id,
      detail: { episodeId: Number(id), gcsScore: data.gcsScore, headacheSeverity: data.headacheSeverityNrs },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/obstetric-cvst/episodes/:id/flowsheet/:logId', async (req) => {
    const user = assertCanManageCvst(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare(`
      SELECT * FROM obstetric_cvst_flowsheet_logs
      WHERE id = ? AND episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM obstetric_cvst_flowsheet_logs WHERE id = ?`).run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_cvst.flowsheet_delete',
      entity: 'obstetric_cvst_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id), logId: Number(logId) },
    });

    return { success: true };
  });
}
