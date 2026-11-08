import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricMassivePe,
} from '../../web/src/obstetricMassivePeEngine.js';

function assertCanManagePe(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric PE protocols');
  }
  return user;
}

const peEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(12.0).max(43.0),
  clinicalSetting: z.enum([
    'antenatal_antepartum',
    'intrapartum_labor',
    'immediate_postpartum_puerperium',
    'post_cesarean_section',
  ]),
  systolicBpMmhg: z.coerce.number().int().min(30).max(250),
  heartRateBpm: z.coerce.number().int().min(30).max(250),
  respiratoryRate: z.coerce.number().int().min(5).max(80),
  spo2Percent: z.coerce.number().min(40.0).max(100.0),
  hemodynamicInstabilityShock: z.boolean().default(true),
  rvDysfunctionEchoConfirmed: z.boolean().default(true),
  cardiacBiomarkersElevated: z.boolean().default(true),
  peRiskStratification: z.enum([
    'high_risk_massive_pe',
    'intermediate_high_risk_submassive',
    'intermediate_low_risk',
    'low_risk_nonmassive',
  ]),
  thrombolyticTherapyAdministered: z.boolean().default(false),
  thrombolyticAgentDose: z.enum([
    'alteplase_100mg_over_2hr',
    'alteplase_50mg_rapid_cardiac_arrest',
    'alteplase_0_6mg_kg_bolus_15min',
    'none_contraindicated_or_surgical',
  ]).default('none_contraindicated_or_surgical'),
  systemicUfhInfusionActive: z.boolean().default(true),
  targetApttSeconds: z.coerce.number().min(40.0).max(120.0).default(70.0),
  catheterDirectedOrSurgicalEmbolectomy: z.boolean().default(false),
  inferiorVenaCavaFilterPlaced: z.boolean().default(false),
  status: z.enum([
    'acute_massive_pe_resuscitation',
    'thrombolytic_infusion_icu',
    'therapeutic_heparin_titration',
    'catheter_embolectomy_surgical',
    'subacute_transition_lmwh',
    'convalescent_anticoagulation_plan',
    'maternal_demise',
  ]).default('acute_massive_pe_resuscitation'),
  clinicalNotes: z.string().optional().nullable(),
});

const peFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromPresentation: z.coerce.number().min(0.0).max(720.0),
  systolicBpMmhg: z.coerce.number().int().min(30).max(250),
  diastolicBpMmhg: z.coerce.number().int().min(20).max(150),
  heartRateBpm: z.coerce.number().int().min(30).max(250),
  spo2Percent: z.coerce.number().min(40.0).max(100.0),
  apttSeconds: z.coerce.number().min(20.0).max(200.0),
  heparinInfusionRateUnitsHr: z.coerce.number().min(0.0).max(3000.0),
  vasopressorNorepinephrineMcgMin: z.coerce.number().min(0.0).max(100.0).default(0.0),
  bleedingComplicationObserved: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export function registerObstetricMassivePeRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/obstetric-massive-pe/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(peEpisodeSchema.omit({ patientId: true }).partial({ onsetDatetime: true, status: true }), req.body);
    const evaluation = evaluateObstetricMassivePe({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      clinicalSetting: data.clinicalSetting,
      systolicBpMmhg: data.systolicBpMmhg,
      heartRateBpm: data.heartRateBpm,
      respiratoryRate: data.respiratoryRate,
      spo2Percent: data.spo2Percent,
      hemodynamicInstabilityShock: data.hemodynamicInstabilityShock,
      rvDysfunctionEchoConfirmed: data.rvDysfunctionEchoConfirmed,
      cardiacBiomarkersElevated: data.cardiacBiomarkersElevated,
      peRiskStratification: data.peRiskStratification,
      thrombolyticTherapyAdministered: data.thrombolyticTherapyAdministered,
      thrombolyticAgentDose: data.thrombolyticAgentDose,
      systemicUfhInfusionActive: data.systemicUfhInfusionActive,
      targetApttSeconds: data.targetApttSeconds,
      catheterDirectedOrSurgicalEmbolectomy: data.catheterDirectedOrSurgicalEmbolectomy,
      inferiorVenaCavaFilterPlaced: data.inferiorVenaCavaFilterPlaced,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-massive-pe/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM obstetric_massive_pe_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM obstetric_massive_pe_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.created_at DESC
      `).all();
    }

    return { episodes };
  });

  // 3. Get Episode by ID
  app.get('/api/obstetric-massive-pe/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM obstetric_massive_pe_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric massive PE episode not found');

    const flowsheet = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM obstetric_massive_pe_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.episode_id = ?
      ORDER BY f.hours_from_presentation ASC, f.created_at ASC
    `).all(Number(id));

    const evaluation = evaluateObstetricMassivePe({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      clinicalSetting: episode.clinical_setting,
      systolicBpMmhg: episode.systolic_bp_mmhg,
      heartRateBpm: episode.heart_rate_bpm,
      respiratoryRate: episode.respiratory_rate,
      spo2Percent: episode.spo2_percent,
      hemodynamicInstabilityShock: Boolean(episode.hemodynamic_instability_shock),
      rvDysfunctionEchoConfirmed: Boolean(episode.rv_dysfunction_echo_confirmed),
      cardiacBiomarkersElevated: Boolean(episode.cardiac_biomarkers_elevated),
      peRiskStratification: episode.pe_risk_stratification,
      thrombolyticTherapyAdministered: Boolean(episode.thrombolytic_therapy_administered),
      thrombolyticAgentDose: episode.thrombolytic_agent_dose,
      systemicUfhInfusionActive: Boolean(episode.systemic_ufh_infusion_active),
      targetApttSeconds: episode.target_aptt_seconds,
      catheterDirectedOrSurgicalEmbolectomy: Boolean(episode.catheter_directed_or_surgical_embolectomy),
      inferiorVenaCavaFilterPlaced: Boolean(episode.inferior_vena_cava_filter_placed),
    });

    return { episode, flowsheet, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-massive-pe/episodes', async (req, reply) => {
    const user = assertCanManagePe(req);
    const data = parse(peEpisodeSchema, req.body);

    const episodeCode = `PE-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;

    const result = db.prepare(`
      INSERT INTO obstetric_massive_pe_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        gestational_age_weeks, clinical_setting,
        systolic_bp_mmhg, heart_rate_bpm, respiratory_rate, spo2_percent,
        hemodynamic_instability_shock, rv_dysfunction_echo_confirmed,
        cardiac_biomarkers_elevated, pe_risk_stratification,
        thrombolytic_therapy_administered, thrombolytic_agent_dose,
        systemic_ufh_infusion_active, target_aptt_seconds,
        catheter_directed_or_surgical_embolectomy, inferior_vena_cava_filter_placed,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.clinicalSetting,
      data.systolicBpMmhg,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.hemodynamicInstabilityShock ? 1 : 0,
      data.rvDysfunctionEchoConfirmed ? 1 : 0,
      data.cardiacBiomarkersElevated ? 1 : 0,
      data.peRiskStratification,
      data.thrombolyticTherapyAdministered ? 1 : 0,
      data.thrombolyticAgentDose,
      data.systemicUfhInfusionActive ? 1 : 0,
      data.targetApttSeconds,
      data.catheterDirectedOrSurgicalEmbolectomy ? 1 : 0,
      data.inferiorVenaCavaFilterPlaced ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const created = db.prepare(`SELECT * FROM obstetric_massive_pe_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_massive_pe.episode_create',
      entity: 'obstetric_massive_pe_episodes',
      entityId: created.id,
      detail: { episodeId: created.id, episodeCode, patientId: data.patientId },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/obstetric-massive-pe/episodes/:id', async (req) => {
    const user = assertCanManagePe(req);
    const { id } = req.params as { id: string };
    const data = parse(peEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_massive_pe_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric massive PE episode not found');

    db.prepare(`
      UPDATE obstetric_massive_pe_episodes SET
        admission_id = ?,
        onset_datetime = ?,
        gestational_age_weeks = ?,
        clinical_setting = ?,
        systolic_bp_mmhg = ?,
        heart_rate_bpm = ?,
        respiratory_rate = ?,
        spo2_percent = ?,
        hemodynamic_instability_shock = ?,
        rv_dysfunction_echo_confirmed = ?,
        cardiac_biomarkers_elevated = ?,
        pe_risk_stratification = ?,
        thrombolytic_therapy_administered = ?,
        thrombolytic_agent_dose = ?,
        systemic_ufh_infusion_active = ?,
        target_aptt_seconds = ?,
        catheter_directed_or_surgical_embolectomy = ?,
        inferior_vena_cava_filter_placed = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.admissionId || null,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.clinicalSetting,
      data.systolicBpMmhg,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.hemodynamicInstabilityShock ? 1 : 0,
      data.rvDysfunctionEchoConfirmed ? 1 : 0,
      data.cardiacBiomarkersElevated ? 1 : 0,
      data.peRiskStratification,
      data.thrombolyticTherapyAdministered ? 1 : 0,
      data.thrombolyticAgentDose,
      data.systemicUfhInfusionActive ? 1 : 0,
      data.targetApttSeconds,
      data.catheterDirectedOrSurgicalEmbolectomy ? 1 : 0,
      data.inferiorVenaCavaFilterPlaced ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM obstetric_massive_pe_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_massive_pe.episode_update',
      entity: 'obstetric_massive_pe_episodes',
      entityId: updated.id,
      detail: { episodeId: updated.id, status: data.status },
    });

    return { episode: updated };
  });

  // 6. Patch Status
  app.patch('/api/obstetric-massive-pe/episodes/:id/status', async (req) => {
    const user = assertCanManagePe(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({ status: peEpisodeSchema.shape.status }), req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_massive_pe_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric massive PE episode not found');

    db.prepare(`
      UPDATE obstetric_massive_pe_episodes SET
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    const updated = db.prepare(`SELECT * FROM obstetric_massive_pe_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_massive_pe.status_change',
      entity: 'obstetric_massive_pe_episodes',
      entityId: updated.id,
      detail: { episodeId: updated.id, previousStatus: existing.status, newStatus: status },
    });

    return { episode: updated };
  });

  // 7. Delete Episode
  app.delete('/api/obstetric-massive-pe/episodes/:id', async (req) => {
    const user = assertCanManagePe(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM obstetric_massive_pe_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric massive PE episode not found');

    db.prepare(`DELETE FROM obstetric_massive_pe_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_massive_pe.episode_delete',
      entity: 'obstetric_massive_pe_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/obstetric-massive-pe/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManagePe(req);
    const { id } = req.params as { id: string };
    const data = parse(peFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM obstetric_massive_pe_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric massive PE episode not found');

    const result = db.prepare(`
      INSERT INTO obstetric_massive_pe_flowsheet_logs (
        episode_id, patient_id, log_datetime, hours_from_presentation,
        systolic_bp_mmhg, diastolic_bp_mmhg, heart_rate_bpm, spo2_percent,
        aptt_seconds, heparin_infusion_rate_units_hr,
        vasopressor_norepinephrine_mcg_min, bleeding_complication_observed,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromPresentation,
      data.systolicBpMmhg,
      data.diastolicBpMmhg,
      data.heartRateBpm,
      data.spo2Percent,
      data.apttSeconds,
      data.heparinInfusionRateUnitsHr,
      data.vasopressorNorepinephrineMcgMin,
      data.bleedingComplicationObserved ? 1 : 0,
      data.notes || null,
      user.id
    );

    const created = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM obstetric_massive_pe_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.id = ?
    `).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'obstetric_massive_pe.flowsheet_add',
      entity: 'obstetric_massive_pe_flowsheet_logs',
      entityId: created.id,
      detail: { episodeId: Number(id), apttSeconds: data.apttSeconds, systolicBpMmhg: data.systolicBpMmhg },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/obstetric-massive-pe/episodes/:id/flowsheet/:logId', async (req) => {
    const user = assertCanManagePe(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare(`
      SELECT * FROM obstetric_massive_pe_flowsheet_logs
      WHERE id = ? AND episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM obstetric_massive_pe_flowsheet_logs WHERE id = ?`).run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_massive_pe.flowsheet_delete',
      entity: 'obstetric_massive_pe_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id), logId: Number(logId) },
    });

    return { success: true };
  });
}
