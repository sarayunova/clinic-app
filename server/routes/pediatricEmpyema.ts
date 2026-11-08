import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricEmpyema,
} from '../../web/src/pediatricEmpyemaEngine.js';

function assertCanManagePediatricEmpyema(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric empyema protocols');
  }
  return user;
}

const pediatricEmpyemaEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.0).max(21.0),
  weightKg: z.coerce.number().min(1.0).max(150.0),
  stagingPhase: z.enum([
    'stage_1_exudative_simple',
    'stage_2_fibrinopurulent_complicated',
    'stage_3_organizing_pleural_peel',
  ]),
  ultrasoundFindings: z.enum([
    'free_flowing_anechoic',
    'fibrinous_strands_early_septation',
    'dense_multiloculated_honeycomb',
    'thickened_visceral_pleura_trapped_lung',
  ]),
  pleuralFluidPh: z.coerce.number().min(6.0).max(8.5).optional().nullable(),
  pleuralFluidGlucoseMgDl: z.coerce.number().min(0).max(400).optional().nullable(),
  pleuralFluidLdhUL: z.coerce.number().min(0).max(20000).optional().nullable(),
  pleuralFluidAppearance: z.enum([
    'clear_serous',
    'turbid_cloudy',
    'frank_pus_purulent',
  ]),
  gramStainCultureIsolated: z.string().optional().nullable(),
  chestTubePlaced: z.boolean().default(true),
  chestTubeSizeFr: z.coerce.number().int().min(6).max(36).optional().nullable(),
  intrapleuralFibrinolyticTherapy: z.enum([
    'not_indicated_antibiotics_only',
    'tpa_plus_dornase_alfa_twice_daily',
    'single_agent_tpa',
    'saline_flush_control',
  ]),
  dosesCompleted: z.coerce.number().int().min(0).max(12).default(0),
  vatsDecorticationIndicated: z.boolean().default(false),
  status: z.enum([
    'chest_tube_insertion',
    'intrapleural_fibrinolysis_active',
    'vats_surgical_decortication',
    'resolving_drain_removal_phase',
    'discharged_complete_resolution',
  ]).default('chest_tube_insertion'),
  clinicalNotes: z.string().optional().nullable(),
});

const pediatricEmpyemaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromDrainPlacement: z.coerce.number().min(0).max(720),
  chestDrainOutputMl: z.coerce.number().min(0).max(5000),
  drainEffluentAppearance: z.enum([
    'purulent_thick_pus',
    'turbid_serosanguinous',
    'serous_straw_colored',
    'no_output_blocked',
  ]),
  airLeakGrade: z.enum([
    'none',
    'cough_only',
    'expiratory',
    'continuous',
  ]),
  temperatureCelsius: z.coerce.number().min(30.0).max(44.0),
  respiratoryRate: z.coerce.number().int().min(5).max(120),
  oxygenSaturationPct: z.coerce.number().min(50).max(100),
  fibrinolyticInstilledDwellCompleted: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export function registerPediatricEmpyemaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate
  app.post('/api/pediatric-empyema/evaluate', async (req) => {
    assertCanManagePediatricEmpyema(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricEmpyema({
      ageYears: Number(body.ageYears || 4.0),
      weightKg: Number(body.weightKg || 16.0),
      stagingPhase: body.stagingPhase || 'stage_2_fibrinopurulent_complicated',
      ultrasoundFindings: body.ultrasoundFindings || 'dense_multiloculated_honeycomb',
      pleuralFluidPh: body.pleuralFluidPh !== undefined && body.pleuralFluidPh !== null ? Number(body.pleuralFluidPh) : undefined,
      pleuralFluidGlucoseMgDl: body.pleuralFluidGlucoseMgDl !== undefined && body.pleuralFluidGlucoseMgDl !== null ? Number(body.pleuralFluidGlucoseMgDl) : undefined,
      pleuralFluidLdhUL: body.pleuralFluidLdhUL !== undefined && body.pleuralFluidLdhUL !== null ? Number(body.pleuralFluidLdhUL) : undefined,
      pleuralFluidAppearance: body.pleuralFluidAppearance || 'frank_pus_purulent',
      gramStainCultureIsolated: body.gramStainCultureIsolated || undefined,
      chestTubePlaced: body.chestTubePlaced !== undefined ? Boolean(body.chestTubePlaced) : true,
      chestTubeSizeFr: body.chestTubeSizeFr !== undefined && body.chestTubeSizeFr !== null ? Number(body.chestTubeSizeFr) : undefined,
      intrapleuralFibrinolyticTherapy: body.intrapleuralFibrinolyticTherapy || 'tpa_plus_dornase_alfa_twice_daily',
      dosesCompleted: Number(body.dosesCompleted || 0),
      vatsDecorticationIndicated: Boolean(body.vatsDecorticationIndicated),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-empyema/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_empyema_episodes e
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
  app.get('/api/pediatric-empyema/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_empyema_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric empyema episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_empyema_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.empyema_episode_id = ?
      ORDER BY l.hours_from_drain_placement ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluatePediatricEmpyema({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      stagingPhase: episode.staging_phase,
      ultrasoundFindings: episode.ultrasound_findings,
      pleuralFluidPh: episode.pleural_fluid_ph !== null ? episode.pleural_fluid_ph : undefined,
      pleuralFluidGlucoseMgDl: episode.pleural_fluid_glucose_mg_dl !== null ? episode.pleural_fluid_glucose_mg_dl : undefined,
      pleuralFluidLdhUL: episode.pleural_fluid_ldh_u_l !== null ? episode.pleural_fluid_ldh_u_l : undefined,
      pleuralFluidAppearance: episode.pleural_fluid_appearance,
      gramStainCultureIsolated: episode.gram_stain_culture_isolated || undefined,
      chestTubePlaced: Boolean(episode.chest_tube_placed),
      chestTubeSizeFr: episode.chest_tube_size_fr !== null ? episode.chest_tube_size_fr : undefined,
      intrapleuralFibrinolyticTherapy: episode.intrapleural_fibrinolytic_therapy,
      dosesCompleted: episode.doses_completed,
      vatsDecorticationIndicated: Boolean(episode.vats_decortication_indicated),
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-empyema/episodes', async (req) => {
    const user = assertCanManagePediatricEmpyema(req);
    const data = parse(pediatricEmpyemaEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM pediatric_empyema_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `EMPY-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_empyema_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_years, weight_kg,
        staging_phase, ultrasound_findings, pleural_fluid_ph, pleural_fluid_glucose_mg_dl,
        pleural_fluid_ldh_u_l, pleural_fluid_appearance, gram_stain_culture_isolated,
        chest_tube_placed, chest_tube_size_fr, intrapleural_fibrinolytic_therapy,
        doses_completed, vats_decortication_indicated, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.stagingPhase,
      data.ultrasoundFindings,
      data.pleuralFluidPh !== undefined ? data.pleuralFluidPh : null,
      data.pleuralFluidGlucoseMgDl !== undefined ? data.pleuralFluidGlucoseMgDl : null,
      data.pleuralFluidLdhUL !== undefined ? data.pleuralFluidLdhUL : null,
      data.pleuralFluidAppearance,
      data.gramStainCultureIsolated || null,
      data.chestTubePlaced ? 1 : 0,
      data.chestTubeSizeFr !== undefined ? data.chestTubeSizeFr : null,
      data.intrapleuralFibrinolyticTherapy,
      data.dosesCompleted,
      data.vatsDecorticationIndicated ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_empyema.create',
      entity: 'pediatric_empyema_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM pediatric_empyema_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/pediatric-empyema/episodes/:id', async (req) => {
    const user = assertCanManagePediatricEmpyema(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricEmpyemaEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_empyema_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Pediatric empyema episode not found');

    db.prepare(`
      UPDATE pediatric_empyema_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, age_years = ?, weight_kg = ?,
        staging_phase = ?, ultrasound_findings = ?, pleural_fluid_ph = ?, pleural_fluid_glucose_mg_dl = ?,
        pleural_fluid_ldh_u_l = ?, pleural_fluid_appearance = ?, gram_stain_culture_isolated = ?,
        chest_tube_placed = ?, chest_tube_size_fr = ?, intrapleural_fibrinolytic_therapy = ?,
        doses_completed = ?, vats_decortication_indicated = ?, status = ?,
        clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.stagingPhase,
      data.ultrasoundFindings,
      data.pleuralFluidPh !== undefined ? data.pleuralFluidPh : null,
      data.pleuralFluidGlucoseMgDl !== undefined ? data.pleuralFluidGlucoseMgDl : null,
      data.pleuralFluidLdhUL !== undefined ? data.pleuralFluidLdhUL : null,
      data.pleuralFluidAppearance,
      data.gramStainCultureIsolated || null,
      data.chestTubePlaced ? 1 : 0,
      data.chestTubeSizeFr !== undefined ? data.chestTubeSizeFr : null,
      data.intrapleuralFibrinolyticTherapy,
      data.dosesCompleted,
      data.vatsDecorticationIndicated ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_empyema.update',
      entity: 'pediatric_empyema_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: data.patientId },
    });

    const updated = db.prepare(`SELECT * FROM pediatric_empyema_episodes WHERE id = ?`).get(Number(id));
    return { episode: updated };
  });

  // 6. Add Flowsheet Log
  app.post('/api/pediatric-empyema/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManagePediatricEmpyema(req);
    const { id } = req.params as { id: string };
    const data = parse(pediatricEmpyemaFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT patient_id FROM pediatric_empyema_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric empyema episode not found');

    const result = db.prepare(`
      INSERT INTO pediatric_empyema_flowsheet_logs (
        empyema_episode_id, patient_id, log_datetime, hours_from_drain_placement,
        chest_drain_output_ml, drain_effluent_appearance, air_leak_grade,
        temperature_celsius, respiratory_rate, oxygen_saturation_pct,
        fibrinolytic_instilled_dwell_completed, notes, logged_by_id
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
      data.hoursFromDrainPlacement,
      data.chestDrainOutputMl,
      data.drainEffluentAppearance,
      data.airLeakGrade,
      data.temperatureCelsius,
      data.respiratoryRate,
      data.oxygenSaturationPct,
      data.fibrinolyticInstilledDwellCompleted ? 1 : 0,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_empyema.flowsheet_add',
      entity: 'pediatric_empyema_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, patientId: episode.patient_id },
    });

    const log = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_empyema_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.id = ?
    `).get(logId);

    return { log };
  });
}
