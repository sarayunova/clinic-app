import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateTripleICriteria,
  evaluateObstetricPprom,
  type RuptureConfirmationMethod,
  type TripleICategory,
  type LatencyRegimen,
  type DeliveryTimingPlan,
} from '../../web/src/obstetricPpromEngine.js';

function assertCanManageObstetricPprom(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only obstetricians, maternal-fetal medicine specialists, and labor nurses can manage PPROM records');
  }
  return user;
}

export const obstetricPpromEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  ruptureDatetime: z.string().min(1, 'Rupture datetime is required'),
  presentationDatetime: z.string().min(1, 'Presentation datetime is required'),
  gestationWeeks: z.number().min(12).max(44),

  ruptureConfirmationMethod: z.enum([
    'pooling_ferning_nitrazine',
    'biochemical_amnisure_actim_prom',
    'direct_visualization',
    'ultrasound_oligohydramnios',
  ]),
  amnioticFluidIndexCm: z.number().min(0).max(40).nullable().optional(),
  singleDeepestPocketCm: z.number().min(0).max(20).nullable().optional(),

  latencyAntibioticsInitiated: z.boolean().default(false),
  latencyAntibioticRegimen: z.enum([
    'ampicillin_erythromycin_standard',
    'ampicillin_azithromycin_alternative',
    'penicillin_allergic_cefazolin_erythro',
    'vancomycin_gentamicin_severe_allergy',
    'none_not_indicated',
  ]).default('none_not_indicated'),
  antenatalCorticosteroidStatus: z.enum([
    'not_indicated_ge_34w',
    'course_initiated',
    'course_completed',
    'rescue_course_given',
  ]).default('not_indicated_ge_34w'),
  mgso4NeuroprotectionActive: z.boolean().default(false),
  gbsScreeningStatus: z.enum(['positive', 'negative', 'unknown']).default('unknown'),

  maternalTemperatureCelsius: z.number().min(34.0).max(42.5),
  maternalHeartRateBpm: z.number().int().min(40).max(200),
  fetalHeartRateBpm: z.number().int().min(60).max(240),
  uterineTenderness: z.boolean().default(false),
  foulCervicalDischarge: z.boolean().default(false),
  maternalWbcPerUl: z.number().int().min(1000).max(50000).nullable().optional(),
  amniocentesisPositive: z.boolean().default(false),

  status: z.enum([
    'inpatient_latency_surveillance',
    'active_triple_i_sepsis_resuscitation',
    'labor_induction_delivery',
    'postpartum_resolved',
  ]).default('inpatient_latency_surveillance'),
  clinicalNotes: z.string().nullable().optional(),
});

export const obstetricPpromFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromAdmission: z.number().min(0).default(0),
  maternalTempC: z.number().min(34.0).max(42.5),
  maternalHrBpm: z.number().int().min(40).max(200),
  maternalBpSbp: z.number().int().min(50).max(250),
  maternalBpDbp: z.number().int().min(30).max(150),
  fetalHrBpm: z.number().int().min(60).max(240),
  uterineContractionsPer10min: z.number().int().min(0).max(10).default(0),
  amnioticFluidCharacter: z.enum(['clear', 'blood_tinged', 'purulent_malodorous']),
  maternalWbc: z.number().int().min(1000).max(50000).nullable().optional(),
  ctgCategory: z.enum(['category_1_normal', 'category_2_indeterminate', 'category_3_abnormal']),
  notes: z.string().nullable().optional(),
});

export function registerObstetricPpromRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live PPROM & Triple I Preview
  app.post('/api/obstetric-pprom/evaluate', async (req) => {
    assertCanManageObstetricPprom(req);
    const body = req.body as Partial<z.infer<typeof obstetricPpromEpisodeSchema>>;

    const evalResult = evaluateObstetricPprom({
      gestationWeeks: body.gestationWeeks ?? 30.5,
      ruptureConfirmationMethod: (body.ruptureConfirmationMethod as RuptureConfirmationMethod) ?? 'pooling_ferning_nitrazine',
      amnioticFluidIndexCm: body.amnioticFluidIndexCm ?? undefined,
      singleDeepestPocketCm: body.singleDeepestPocketCm ?? undefined,
      maternalTemperatureCelsius: body.maternalTemperatureCelsius ?? 37.0,
      maternalHeartRateBpm: body.maternalHeartRateBpm ?? 82,
      fetalHeartRateBpm: body.fetalHeartRateBpm ?? 140,
      uterineTenderness: body.uterineTenderness,
      foulCervicalDischarge: body.foulCervicalDischarge,
      maternalWbcPerUl: body.maternalWbcPerUl ?? undefined,
      amniocentesisPositive: body.amniocentesisPositive,
      gbsScreeningStatus: body.gbsScreeningStatus,
    });

    return { evalResult };
  });

  // 2. Create PPROM Episode
  app.post('/api/obstetric-pprom/episodes', async (req, reply) => {
    const user = assertCanManageObstetricPprom(req);
    const data = parse(obstetricPpromEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateObstetricPprom({
      gestationWeeks: data.gestationWeeks,
      ruptureConfirmationMethod: data.ruptureConfirmationMethod,
      amnioticFluidIndexCm: data.amnioticFluidIndexCm ?? undefined,
      singleDeepestPocketCm: data.singleDeepestPocketCm ?? undefined,
      maternalTemperatureCelsius: data.maternalTemperatureCelsius,
      maternalHeartRateBpm: data.maternalHeartRateBpm,
      fetalHeartRateBpm: data.fetalHeartRateBpm,
      uterineTenderness: data.uterineTenderness,
      foulCervicalDischarge: data.foulCervicalDischarge,
      maternalWbcPerUl: data.maternalWbcPerUl ?? undefined,
      amniocentesisPositive: data.amniocentesisPositive,
      gbsScreeningStatus: data.gbsScreeningStatus,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `PPROM-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_pprom_episodes (
        patient_id, admission_id, episode_code, rupture_datetime, presentation_datetime,
        gestation_weeks, rupture_confirmation_method, amniotic_fluid_index_cm, single_deepest_pocket_cm,
        latency_antibiotics_initiated, latency_antibiotic_regimen, antenatal_corticosteroid_status,
        mgso4_neuroprotection_active, gbs_screening_status,
        maternal_temperature_celsius, maternal_heart_rate_bpm, fetal_heart_rate_bpm,
        uterine_tenderness, foul_cervical_discharge, maternal_wbc_per_ul,
        triple_i_category, delivery_timing_plan,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.ruptureDatetime,
      data.presentationDatetime,
      data.gestationWeeks,
      data.ruptureConfirmationMethod,
      data.amnioticFluidIndexCm ?? null,
      data.singleDeepestPocketCm ?? null,
      data.latencyAntibioticsInitiated ? 1 : 0,
      data.latencyAntibioticRegimen,
      data.antenatalCorticosteroidStatus,
      data.mgso4NeuroprotectionActive ? 1 : 0,
      data.gbsScreeningStatus,
      data.maternalTemperatureCelsius,
      data.maternalHeartRateBpm,
      data.fetalHeartRateBpm,
      data.uterineTenderness ? 1 : 0,
      data.foulCervicalDischarge ? 1 : 0,
      data.maternalWbcPerUl ?? null,
      evalResult.tripleICategory,
      evalResult.deliveryTimingPlan,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    audit(db, {
      actorId: user.id,
      action: 'obstetric_pprom.episode_create',
      entity: 'obstetric_pprom_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, gestationWeeks: data.gestationWeeks },
    });

    const created = db.prepare('SELECT * FROM obstetric_pprom_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List PPROM Episodes
  app.get('/api/obstetric-pprom/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_pprom_episodes e
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

    query += ' ORDER BY e.presentation_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/obstetric-pprom/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_pprom_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric PPROM episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM obstetric_pprom_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.pprom_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateObstetricPprom({
      gestationWeeks: episode.gestation_weeks,
      ruptureConfirmationMethod: episode.rupture_confirmation_method,
      amnioticFluidIndexCm: episode.amniotic_fluid_index_cm ?? undefined,
      singleDeepestPocketCm: episode.single_deepest_pocket_cm ?? undefined,
      maternalTemperatureCelsius: episode.maternal_temperature_celsius,
      maternalHeartRateBpm: episode.maternal_heart_rate_bpm,
      fetalHeartRateBpm: episode.fetal_heart_rate_bpm,
      uterineTenderness: Boolean(episode.uterine_tenderness),
      foulCervicalDischarge: Boolean(episode.foul_cervical_discharge),
      maternalWbcPerUl: episode.maternal_wbc_per_ul ?? undefined,
      gbsScreeningStatus: episode.gbs_screening_status,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update PPROM Episode
  app.patch('/api/obstetric-pprom/episodes/:id', async (req) => {
    const user = assertCanManageObstetricPprom(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM obstetric_pprom_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric PPROM episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextDeliveryTiming = body.deliveryTimingPlan ?? existing.delivery_timing_plan;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE obstetric_pprom_episodes
      SET status = ?, delivery_timing_plan = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextDeliveryTiming, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pprom.episode_update',
      entity: 'obstetric_pprom_episodes',
      entityId: Number(id),
      detail: { nextStatus, nextDeliveryTiming },
    });

    const updated = db.prepare('SELECT * FROM obstetric_pprom_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete PPROM Episode
  app.delete('/api/obstetric-pprom/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete obstetric PPROM episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM obstetric_pprom_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric PPROM episode not found');

    db.prepare('DELETE FROM obstetric_pprom_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pprom.episode_delete',
      entity: 'obstetric_pprom_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Bedside Flowsheet Log
  app.post('/api/obstetric-pprom/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricPprom(req);
    const { id } = req.params as { id: string };
    const data = parse(obstetricPpromFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM obstetric_pprom_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric PPROM episode not found');

    const stmt = db.prepare(`
      INSERT INTO obstetric_pprom_flowsheet_logs (
        pprom_episode_id, patient_id, log_datetime, hours_from_admission,
        maternal_temp_c, maternal_hr_bpm, maternal_bp_sbp, maternal_bp_dbp,
        fetal_hr_bpm, uterine_contractions_per_10min, amniotic_fluid_character,
        maternal_wbc, ctg_category, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.maternalTempC,
      data.maternalHrBpm,
      data.maternalBpSbp,
      data.maternalBpDbp,
      data.fetalHrBpm,
      data.uterineContractionsPer10min,
      data.amnioticFluidCharacter,
      data.maternalWbc ?? null,
      data.ctgCategory,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pprom.flowsheet_create',
      entity: 'obstetric_pprom_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), maternalTempC: data.maternalTempC, fetalHrBpm: data.fetalHrBpm },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Bedside Flowsheet Log
  app.delete('/api/obstetric-pprom/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageObstetricPprom(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM obstetric_pprom_flowsheet_logs WHERE id = ? AND pprom_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_pprom_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pprom.flowsheet_delete',
      entity: 'obstetric_pprom_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
