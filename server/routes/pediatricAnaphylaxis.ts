import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateWaoCriteria,
  calculateEpinephrineImDose,
  recommendAutoinjector,
  evaluatePediatricAnaphylaxis,
  type AnaphylaxisTriggerType,
} from '../../web/src/pediatricAnaphylaxisEngine.js';

function assertCanManagePediatricAnaphylaxis(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only pediatricians, emergency physicians, and resuscitation nurses can manage anaphylaxis resuscitation records');
  }
  return user;
}

export const pediatricAnaphylaxisEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  triageDatetime: z.string().min(1, 'Triage datetime is required'),
  ageMonths: z.number().int().min(1).max(216),
  weightKg: z.number().min(2.5).max(120),
  triggerType: z.enum([
    'food_peanut_nut_milk_egg',
    'insect_venom_bee_wasp',
    'medication_antibiotic_nsaid',
    'vaccine_biologic',
    'latex',
    'exercise_or_cold',
    'idiopathic',
  ]),
  triggerDetails: z.string().nullable().optional(),

  // Signs & Symptoms
  skinMucosalInvolvement: z.boolean().default(false),
  respiratoryCompromise: z.boolean().default(false),
  cardiovascularHypotension: z.boolean().default(false),
  persistentGastrointestinal: z.boolean().default(false),

  // Dosing & Timing
  imEpinephrineDosesGiven: z.number().int().min(1).max(10).default(1),
  epinephrineFirstDoseDatetime: z.string().min(1, 'First dose datetime is required'),
  epinephrineSecondDoseDatetime: z.string().nullable().optional(),

  // Refractory & Advanced
  refractoryShockDeclared: z.boolean().default(false),
  ivEpinephrineInfusionActive: z.boolean().default(false),
  epinephrineInfusionRateMcgKgMin: z.number().min(0).max(5).nullable().optional(),
  secondLineH1AntihistamineGiven: z.boolean().default(false),
  secondLineH2AntihistamineGiven: z.boolean().default(false),
  systemicSteroidGiven: z.boolean().default(false),
  glucagonAdministered: z.boolean().default(false),
  fluidBolusVolumeMl: z.number().min(0).default(0),

  status: z.enum([
    'acute_resuscitation_bay',
    'refractory_picu_infusion',
    'biphasic_surveillance_observation',
    'discharged_auto_injector_prescribed',
  ]).default('acute_resuscitation_bay'),
  clinicalNotes: z.string().nullable().optional(),
});

export const pediatricAnaphylaxisFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  minutesFromArrival: z.number().int().min(0).default(0),
  sbpMmhg: z.number().int().min(30).max(250),
  dbpMmhg: z.number().int().min(10).max(150).nullable().optional(),
  heartRateBpm: z.number().int().min(40).max(250),
  respiratoryRate: z.number().int().min(8).max(100),
  spo2Percent: z.number().min(50).max(100),
  stridorPresent: z.boolean().default(false),
  wheezeSeverity: z.enum(['none', 'mild', 'moderate', 'severe']),
  urticariaCoverage: z.enum(['none', 'localized', 'generalized']),
  epinephrineIvRateMcgKgMin: z.number().min(0).max(5).nullable().optional(),
  cumulativeImEpinephrineDoses: z.number().int().min(1).max(10).default(1),
  cumulativeCrystalloidMl: z.number().min(0).default(0),
  notes: z.string().nullable().optional(),
});

export function registerPediatricAnaphylaxisRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Anaphylaxis Evaluation Preview
  app.post('/api/pediatric-anaphylaxis/evaluate', async (req) => {
    assertCanManagePediatricAnaphylaxis(req);
    const body = req.body as Partial<z.infer<typeof pediatricAnaphylaxisEpisodeSchema>>;

    const evalResult = evaluatePediatricAnaphylaxis({
      ageMonths: body.ageMonths ?? 36,
      weightKg: body.weightKg ?? 15,
      triggerType: (body.triggerType as AnaphylaxisTriggerType) ?? 'food_peanut_nut_milk_egg',
      triggerDetails: body.triggerDetails ?? undefined,
      skinMucosalInvolvement: Boolean(body.skinMucosalInvolvement),
      respiratoryCompromise: Boolean(body.respiratoryCompromise),
      cardiovascularHypotension: Boolean(body.cardiovascularHypotension),
      persistentGastrointestinal: Boolean(body.persistentGastrointestinal),
      priorImEpinephrineDosesGiven: body.imEpinephrineDosesGiven ?? 1,
    });

    return { evalResult };
  });

  // 2. Create Pediatric Anaphylaxis Episode
  app.post('/api/pediatric-anaphylaxis/episodes', async (req, reply) => {
    const user = assertCanManagePediatricAnaphylaxis(req);
    const data = parse(pediatricAnaphylaxisEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluatePediatricAnaphylaxis({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      triggerType: data.triggerType,
      triggerDetails: data.triggerDetails ?? undefined,
      skinMucosalInvolvement: data.skinMucosalInvolvement,
      respiratoryCompromise: data.respiratoryCompromise,
      cardiovascularHypotension: data.cardiovascularHypotension,
      persistentGastrointestinal: data.persistentGastrointestinal,
      priorImEpinephrineDosesGiven: data.imEpinephrineDosesGiven,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `ANAPH-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_anaphylaxis_episodes (
        patient_id, admission_id, episode_code, triage_datetime,
        age_months, weight_kg, trigger_type, trigger_details,
        skin_mucosal_involvement, respiratory_compromise,
        cardiovascular_hypotension, persistent_gastrointestinal,
        anaphylaxis_criteria_met, severity_tier, weight_adjusted_epinephrine_im_dose_mg,
        autoinjector_recommended, im_epinephrine_doses_given,
        epinephrine_first_dose_datetime, epinephrine_second_dose_datetime,
        refractory_shock_declared, iv_epinephrine_infusion_active,
        epinephrine_infusion_rate_mcg_kg_min, second_line_h1_antihistamine_given,
        second_line_h2_antihistamine_given, systemic_steroid_given, glucagon_administered,
        fluid_bolus_volume_ml, biphasic_surveillance_recommended_hours,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.triageDatetime,
      data.ageMonths,
      data.weightKg,
      data.triggerType,
      data.triggerDetails ?? null,
      data.skinMucosalInvolvement ? 1 : 0,
      data.respiratoryCompromise ? 1 : 0,
      data.cardiovascularHypotension ? 1 : 0,
      data.persistentGastrointestinal ? 1 : 0,
      evalResult.anaphylaxisCriteriaMet ? 1 : 0,
      evalResult.severityTier,
      evalResult.epinephrineImDoseMg,
      evalResult.recommendedAutoinjector,
      data.imEpinephrineDosesGiven,
      data.epinephrineFirstDoseDatetime,
      data.epinephrineSecondDoseDatetime ?? null,
      data.refractoryShockDeclared || evalResult.refractoryShockDeclared ? 1 : 0,
      data.ivEpinephrineInfusionActive ? 1 : 0,
      data.epinephrineInfusionRateMcgKgMin ?? null,
      data.secondLineH1AntihistamineGiven ? 1 : 0,
      data.secondLineH2AntihistamineGiven ? 1 : 0,
      data.systemicSteroidGiven ? 1 : 0,
      data.glucagonAdministered ? 1 : 0,
      data.fluidBolusVolumeMl > 0 ? data.fluidBolusVolumeMl : evalResult.fluidBolusVolumeMl,
      evalResult.biphasicSurveillanceHours,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM pediatric_anaphylaxis_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_anaphylaxis.episode_create',
      entity: 'pediatric_anaphylaxis_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        severityTier: evalResult.severityTier,
        epinephrineImDoseMg: evalResult.epinephrineImDoseMg,
      },
    });

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Episodes
  app.get('/api/pediatric-anaphylaxis/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_anaphylaxis_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND e.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.triage_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/pediatric-anaphylaxis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM pediatric_anaphylaxis_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric anaphylaxis episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM pediatric_anaphylaxis_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.anaphylaxis_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluatePediatricAnaphylaxis({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      triggerType: episode.trigger_type,
      triggerDetails: episode.trigger_details,
      skinMucosalInvolvement: Boolean(episode.skin_mucosal_involvement),
      respiratoryCompromise: Boolean(episode.respiratory_compromise),
      cardiovascularHypotension: Boolean(episode.cardiovascular_hypotension),
      persistentGastrointestinal: Boolean(episode.persistent_gastrointestinal),
      priorImEpinephrineDosesGiven: episode.im_epinephrine_doses_given,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode Status / Parameters
  app.patch('/api/pediatric-anaphylaxis/episodes/:id', async (req) => {
    const user = assertCanManagePediatricAnaphylaxis(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM pediatric_anaphylaxis_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric anaphylaxis episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextDoses = body.imEpinephrineDosesGiven ?? existing.im_epinephrine_doses_given;
    const nextIvInfusion = body.ivEpinephrineInfusionActive !== undefined ? (body.ivEpinephrineInfusionActive ? 1 : 0) : existing.iv_epinephrine_infusion_active;
    const nextIvRate = body.epinephrineInfusionRateMcgKgMin ?? existing.epinephrine_infusion_rate_mcg_kg_min;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE pediatric_anaphylaxis_episodes
      SET status = ?, im_epinephrine_doses_given = ?, iv_epinephrine_infusion_active = ?, epinephrine_infusion_rate_mcg_kg_min = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextDoses, nextIvInfusion, nextIvRate, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_anaphylaxis.episode_update',
      entity: 'pediatric_anaphylaxis_episodes',
      entityId: Number(id),
      detail: { nextStatus, nextDoses, nextIvInfusion },
    });

    const updated = db.prepare('SELECT * FROM pediatric_anaphylaxis_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-anaphylaxis/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete pediatric anaphylaxis episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM pediatric_anaphylaxis_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric anaphylaxis episode not found');

    db.prepare('DELETE FROM pediatric_anaphylaxis_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_anaphylaxis.episode_delete',
      entity: 'pediatric_anaphylaxis_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Bedside Flowsheet Log
  app.post('/api/pediatric-anaphylaxis/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricAnaphylaxis(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricAnaphylaxisFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM pediatric_anaphylaxis_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric anaphylaxis episode not found');

    const stmt = db.prepare(`
      INSERT INTO pediatric_anaphylaxis_flowsheet_logs (
        anaphylaxis_episode_id, patient_id, log_datetime, minutes_from_arrival,
        sbp_mmhg, dbp_mmhg, heart_rate_bpm, respiratory_rate, spo2_percent,
        stridor_present, wheeze_severity, urticaria_coverage,
        epinephrine_iv_rate_mcg_kg_min, cumulative_im_epinephrine_doses,
        cumulative_crystalloid_ml, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.minutesFromArrival,
      data.sbpMmhg,
      data.dbpMmhg ?? null,
      data.heartRateBpm,
      data.respiratoryRate,
      data.spo2Percent,
      data.stridorPresent ? 1 : 0,
      data.wheezeSeverity,
      data.urticariaCoverage,
      data.epinephrineIvRateMcgKgMin ?? null,
      data.cumulativeImEpinephrineDoses,
      data.cumulativeCrystalloidMl,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_anaphylaxis.flowsheet_create',
      entity: 'pediatric_anaphylaxis_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), sbpMmhg: data.sbpMmhg, heartRateBpm: data.heartRateBpm },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Bedside Flowsheet Log
  app.delete('/api/pediatric-anaphylaxis/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricAnaphylaxis(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM pediatric_anaphylaxis_flowsheet_logs WHERE id = ? AND anaphylaxis_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_anaphylaxis_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_anaphylaxis.flowsheet_delete',
      entity: 'pediatric_anaphylaxis_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
