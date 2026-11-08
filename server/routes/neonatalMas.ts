import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalMas,
  calculateOxygenationIndex,
  type MeconiumConsistency,
  type DeliveryRoomVigor,
  type RespiratorySupportMode,
  type PphnSeverity,
  type AirLeakType,
  type SurfactantDeliveryMethod,
} from '../../web/src/neonatalMasEngine.js';

function assertCanManageNeonatalMas(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal MAS protocols');
  }
  return user;
}

const neonatalMasEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  diagnosisDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(24.0).max(44.0),
  birthWeightGrams: z.coerce.number().min(400).max(6500),
  chronologicalAgeHours: z.coerce.number().min(0).max(720),
  currentWeightKg: z.coerce.number().min(0.4).max(7.0),

  amnioticFluidMeconiumConsistency: z.enum([
    'thick_particulate_pea_soup',
    'moderate_meconium',
    'thin_light_meconium',
  ]),
  deliveryRoomVigor: z.enum([
    'non_vigorous_depressed',
    'vigorous_active',
  ]),
  endotrachealSuctioningPerformed: z.boolean(),
  meconiumClearedBelowCords: z.boolean(),
  apgar1min: z.coerce.number().min(0).max(10).optional().nullable(),
  apgar5min: z.coerce.number().min(0).max(10).optional().nullable(),

  respiratorySupportMode: z.enum([
    'room_air_low_flow_o2',
    'nasal_cpap_bubble',
    'non_invasive_nipv',
    'conventional_mechanical_ventilation',
    'high_frequency_oscillatory_ventilation',
    'ecmo_rescue',
  ]),
  fio2Percent: z.coerce.number().min(21.0).max(100.0),
  meanAirwayPressureCmh2o: z.coerce.number().min(4.0).max(35.0),
  pao2Mmhg: z.coerce.number().min(15.0).max(400.0).optional().nullable(),
  paco2Mmhg: z.coerce.number().min(15.0).max(150.0).optional().nullable(),
  arterialPh: z.coerce.number().min(6.7).max(7.7).optional().nullable(),

  prePostDuctalSpo2DiffPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  echocardiogramPphnConfirmed: z.boolean(),
  pphnSeverity: z.enum([
    'none_or_not_assessed',
    'mild_right_ventricular_strain',
    'moderate_suprasystemic_shunting',
    'severe_refractory_right_to_left',
  ]),
  pulmonaryAirLeakPresent: z.boolean(),
  airLeakType: z.enum([
    'none',
    'pneumothorax_tension',
    'pneumothorax_simple',
    'pneumomediastinum',
    'pulmonary_interstitial_emphysema',
  ]),

  surfactantAdministered: z.boolean(),
  surfactantDeliveryMethod: z.enum([
    'none',
    'bolus_endotracheal',
    'dilute_surfactant_bronchoalveolar_lavage',
  ]),
  surfactantDoseMgKg: z.coerce.number().min(0).max(400).default(0),
  inhaledNitricOxidePrescribed: z.boolean(),
  inoDosePpm: z.coerce.number().min(0).max(40).default(0),
  empiricAntibioticsActive: z.boolean(),

  status: z.enum([
    'acute_respiratory_failure',
    'hfov_ino_escalation',
    'weaning_recovering',
    'resolved_extubated',
    'ecmo_transferred',
  ]).default('acute_respiratory_failure'),
  clinicalNotes: z.string().optional().nullable(),
});

const neonatalMasFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromAdmission: z.coerce.number().min(0).max(720).default(0),
  respiratoryRate: z.coerce.number().int().min(10).max(160),
  heartRateBpm: z.coerce.number().int().min(40).max(250),
  preDuctalSpo2Percent: z.coerce.number().min(50).max(100),
  postDuctalSpo2Percent: z.coerce.number().min(50).max(100),
  fio2Percent: z.coerce.number().min(21.0).max(100.0),
  meanAirwayPressureCmh2o: z.coerce.number().min(4.0).max(35.0),
  pao2Mmhg: z.coerce.number().min(15.0).max(400.0).optional().nullable(),
  paco2Mmhg: z.coerce.number().min(15.0).max(150.0).optional().nullable(),
  arterialPh: z.coerce.number().min(6.7).max(7.7).optional().nullable(),
  inoDosePpm: z.coerce.number().min(0).max(40).default(0),
  meanBloodPressureMmhg: z.coerce.number().min(20).max(100),
  chestTubeDrainageActive: z.boolean(),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalMasRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;
  // 1. Pure preview evaluation endpoint
  app.post('/api/neonatal-mas/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    assertCanManageNeonatalMas(req);
    const data = parse(neonatalMasEpisodeSchema.partial(), req.body);
    const evalResult = evaluateNeonatalMas({
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? 39.0,
      birthWeightGrams: data.birthWeightGrams ?? 3200,
      chronologicalAgeHours: data.chronologicalAgeHours ?? 4,
      currentWeightKg: data.currentWeightKg ?? 3.1,
      amnioticFluidMeconiumConsistency: data.amnioticFluidMeconiumConsistency ?? 'thick_particulate_pea_soup',
      deliveryRoomVigor: data.deliveryRoomVigor ?? 'non_vigorous_depressed',
      endotrachealSuctioningPerformed: data.endotrachealSuctioningPerformed ?? false,
      meconiumClearedBelowCords: data.meconiumClearedBelowCords ?? false,
      apgar1min: data.apgar1min ?? undefined,
      apgar5min: data.apgar5min ?? undefined,
      respiratorySupportMode: data.respiratorySupportMode ?? 'conventional_mechanical_ventilation',
      fio2Percent: data.fio2Percent ?? 60.0,
      meanAirwayPressureCmh2o: data.meanAirwayPressureCmh2o ?? 12.0,
      pao2Mmhg: data.pao2Mmhg ?? undefined,
      paco2Mmhg: data.paco2Mmhg ?? undefined,
      arterialPh: data.arterialPh ?? undefined,
      prePostDuctalSpo2DiffPercent: data.prePostDuctalSpo2DiffPercent ?? undefined,
      echocardiogramPphnConfirmed: data.echocardiogramPphnConfirmed ?? false,
      pphnSeverity: data.pphnSeverity ?? 'none_or_not_assessed',
      pulmonaryAirLeakPresent: data.pulmonaryAirLeakPresent ?? false,
      airLeakType: data.airLeakType ?? 'none',
      surfactantAdministered: data.surfactantAdministered ?? false,
      surfactantDeliveryMethod: data.surfactantDeliveryMethod ?? 'none',
      inhaledNitricOxidePrescribed: data.inhaledNitricOxidePrescribed ?? false,
      inoDosePpm: data.inoDosePpm ?? 0,
    });
    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/neonatal-mas/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let sql = `
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM neonatal_mas_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      sql += ' AND e.patient_id = ?';
      params.push(patientId);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.created_at DESC';
    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 3. Create Episode
  app.post('/api/neonatal-mas/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalMas(req);
    const data = parse(neonatalMasEpisodeSchema, req.body);

    const oi = calculateOxygenationIndex(
      data.meanAirwayPressureCmh2o,
      data.fio2Percent,
      data.pao2Mmhg ?? undefined,
    );

    const evalResult = evaluateNeonatalMas({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      chronologicalAgeHours: data.chronologicalAgeHours,
      currentWeightKg: data.currentWeightKg,
      amnioticFluidMeconiumConsistency: data.amnioticFluidMeconiumConsistency,
      deliveryRoomVigor: data.deliveryRoomVigor,
      endotrachealSuctioningPerformed: data.endotrachealSuctioningPerformed,
      meconiumClearedBelowCords: data.meconiumClearedBelowCords,
      apgar1min: data.apgar1min ?? undefined,
      apgar5min: data.apgar5min ?? undefined,
      respiratorySupportMode: data.respiratorySupportMode,
      fio2Percent: data.fio2Percent,
      meanAirwayPressureCmh2o: data.meanAirwayPressureCmh2o,
      pao2Mmhg: data.pao2Mmhg ?? undefined,
      paco2Mmhg: data.paco2Mmhg ?? undefined,
      arterialPh: data.arterialPh ?? undefined,
      prePostDuctalSpo2DiffPercent: data.prePostDuctalSpo2DiffPercent ?? undefined,
      echocardiogramPphnConfirmed: data.echocardiogramPphnConfirmed,
      pphnSeverity: data.pphnSeverity,
      pulmonaryAirLeakPresent: data.pulmonaryAirLeakPresent,
      airLeakType: data.airLeakType,
      surfactantAdministered: data.surfactantAdministered,
      surfactantDeliveryMethod: data.surfactantDeliveryMethod,
      inhaledNitricOxidePrescribed: data.inhaledNitricOxidePrescribed,
      inoDosePpm: data.inoDosePpm,
    });

    const episodeCode = `MAS-${Date.now().toString().slice(-8)}`;

    const res = db.prepare(`
      INSERT INTO neonatal_mas_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestational_age_weeks, birth_weight_grams, chronological_age_hours, current_weight_kg,
        amniotic_fluid_meconium_consistency, delivery_room_vigor,
        endotracheal_suctioning_performed, meconium_cleared_below_cords,
        apgar_1min, apgar_5min,
        respiratory_support_mode, fio2_percent, mean_airway_pressure_cmh2o,
        pao2_mmhg, paco2_mmhg, arterial_ph, oxygenation_index,
        pre_post_ductal_spo2_diff_percent, echocardiogram_pphn_confirmed, pphn_severity,
        pulmonary_air_leak_present, air_leak_type,
        surfactant_administered, surfactant_delivery_method, surfactant_dose_mg_kg,
        inhaled_nitric_oxide_prescribed, ino_dose_ppm, empiric_antibiotics_active,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.chronologicalAgeHours,
      data.currentWeightKg,
      data.amnioticFluidMeconiumConsistency,
      data.deliveryRoomVigor,
      data.endotrachealSuctioningPerformed ? 1 : 0,
      data.meconiumClearedBelowCords ? 1 : 0,
      data.apgar1min ?? null,
      data.apgar5min ?? null,
      data.respiratorySupportMode,
      data.fio2Percent,
      data.meanAirwayPressureCmh2o,
      data.pao2Mmhg ?? null,
      data.paco2Mmhg ?? null,
      data.arterialPh ?? null,
      oi,
      data.prePostDuctalSpo2DiffPercent ?? null,
      data.echocardiogramPphnConfirmed ? 1 : 0,
      data.pphnSeverity,
      data.pulmonaryAirLeakPresent ? 1 : 0,
      data.airLeakType,
      data.surfactantAdministered ? 1 : 0,
      data.surfactantDeliveryMethod,
      data.surfactantDoseMgKg,
      data.inhaledNitricOxidePrescribed ? 1 : 0,
      data.inoDosePpm,
      data.empiricAntibioticsActive ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_mas.create',
      entity: 'neonatal_mas_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, oi, status: data.status },
    });

    const episode = db.prepare('SELECT * FROM neonatal_mas_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 4. Retrieve Single Episode
  app.get('/api/neonatal-mas/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM neonatal_mas_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Neonatal MAS episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_mas_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.mas_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(id);

    const evalResult = evaluateNeonatalMas({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      chronologicalAgeHours: episode.chronological_age_hours,
      currentWeightKg: episode.current_weight_kg,
      amnioticFluidMeconiumConsistency: episode.amniotic_fluid_meconium_consistency as MeconiumConsistency,
      deliveryRoomVigor: episode.delivery_room_vigor as DeliveryRoomVigor,
      endotrachealSuctioningPerformed: episode.endotracheal_suctioning_performed === 1,
      meconiumClearedBelowCords: episode.meconium_cleared_below_cords === 1,
      apgar1min: episode.apgar_1min,
      apgar5min: episode.apgar_5min,
      respiratorySupportMode: episode.respiratory_support_mode as RespiratorySupportMode,
      fio2Percent: episode.fio2_percent,
      meanAirwayPressureCmh2o: episode.mean_airway_pressure_cmh2o,
      pao2Mmhg: episode.pao2_mmhg,
      paco2Mmhg: episode.paco2_mmhg,
      arterialPh: episode.arterial_ph,
      prePostDuctalSpo2DiffPercent: episode.pre_post_ductal_spo2_diff_percent,
      echocardiogramPphnConfirmed: episode.echocardiogram_pphn_confirmed === 1,
      pphnSeverity: episode.pphn_severity as PphnSeverity,
      pulmonaryAirLeakPresent: episode.pulmonary_air_leak_present === 1,
      airLeakType: episode.air_leak_type as AirLeakType,
      surfactantAdministered: episode.surfactant_administered === 1,
      surfactantDeliveryMethod: episode.surfactant_delivery_method as SurfactantDeliveryMethod,
      inhaledNitricOxidePrescribed: episode.inhaled_nitric_oxide_prescribed === 1,
      inoDosePpm: episode.ino_dose_ppm,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-mas/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalMas(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM neonatal_mas_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal MAS episode not found');

    const data = parse(neonatalMasEpisodeSchema.partial(), req.body);

    const map = data.meanAirwayPressureCmh2o ?? existing.mean_airway_pressure_cmh2o;
    const fio2 = data.fio2Percent ?? existing.fio2_percent;
    const pao2 = data.pao2Mmhg ?? existing.pao2_mmhg;
    const oi = calculateOxygenationIndex(map, fio2, pao2);

    db.prepare(`
      UPDATE neonatal_mas_episodes
      SET
        respiratory_support_mode = COALESCE(?, respiratory_support_mode),
        fio2_percent = COALESCE(?, fio2_percent),
        mean_airway_pressure_cmh2o = COALESCE(?, mean_airway_pressure_cmh2o),
        pao2_mmhg = COALESCE(?, pao2_mmhg),
        paco2_mmhg = COALESCE(?, paco2_mmhg),
        arterial_ph = COALESCE(?, arterial_ph),
        oxygenation_index = ?,
        pre_post_ductal_spo2_diff_percent = COALESCE(?, pre_post_ductal_spo2_diff_percent),
        echocardiogram_pphn_confirmed = COALESCE(?, echocardiogram_pphn_confirmed),
        pphn_severity = COALESCE(?, pphn_severity),
        pulmonary_air_leak_present = COALESCE(?, pulmonary_air_leak_present),
        air_leak_type = COALESCE(?, air_leak_type),
        surfactant_administered = COALESCE(?, surfactant_administered),
        surfactant_delivery_method = COALESCE(?, surfactant_delivery_method),
        inhaled_nitric_oxide_prescribed = COALESCE(?, inhaled_nitric_oxide_prescribed),
        ino_dose_ppm = COALESCE(?, ino_dose_ppm),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.respiratorySupportMode ?? null,
      data.fio2Percent ?? null,
      data.meanAirwayPressureCmh2o ?? null,
      data.pao2Mmhg ?? null,
      data.paco2Mmhg ?? null,
      data.arterialPh ?? null,
      oi,
      data.prePostDuctalSpo2DiffPercent ?? null,
      data.echocardiogramPphnConfirmed !== undefined ? (data.echocardiogramPphnConfirmed ? 1 : 0) : null,
      data.pphnSeverity ?? null,
      data.pulmonaryAirLeakPresent !== undefined ? (data.pulmonaryAirLeakPresent ? 1 : 0) : null,
      data.airLeakType ?? null,
      data.surfactantAdministered !== undefined ? (data.surfactantAdministered ? 1 : 0) : null,
      data.surfactantDeliveryMethod ?? null,
      data.inhaledNitricOxidePrescribed !== undefined ? (data.inhaledNitricOxidePrescribed ? 1 : 0) : null,
      data.inoDosePpm ?? null,
      data.status ?? null,
      data.clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_mas.update',
      entity: 'neonatal_mas_episodes',
      entityId: Number(id),
      detail: { updatedFields: Object.keys(data), oi },
    });

    const episode = db.prepare('SELECT * FROM neonatal_mas_episodes WHERE id = ?').get(id);
    return { episode };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-mas/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalMas(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM neonatal_mas_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal MAS episode not found');

    db.prepare('DELETE FROM neonatal_mas_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_mas.delete',
      entity: 'neonatal_mas_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-mas/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalMas(req);
    const { id } = req.params as { id: string };

    const episode = db.prepare('SELECT * FROM neonatal_mas_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal MAS episode not found');

    const data = parse(neonatalMasFlowsheetSchema, req.body);
    const oi = calculateOxygenationIndex(
      data.meanAirwayPressureCmh2o,
      data.fio2Percent,
      data.pao2Mmhg ?? undefined,
    );

    const res = db.prepare(`
      INSERT INTO neonatal_mas_flowsheet_logs (
        mas_episode_id, patient_id, log_datetime, hours_from_admission,
        respiratory_rate, heart_rate_bpm, pre_ductal_spo2_percent, post_ductal_spo2_percent,
        fio2_percent, mean_airway_pressure_cmh2o, pao2_mmhg, paco2_mmhg, arterial_ph,
        oxygenation_index, ino_dose_ppm, mean_blood_pressure_mmhg, chest_tube_drainage_active,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.respiratoryRate,
      data.heartRateBpm,
      data.preDuctalSpo2Percent,
      data.postDuctalSpo2Percent,
      data.fio2Percent,
      data.meanAirwayPressureCmh2o,
      data.pao2Mmhg ?? null,
      data.paco2Mmhg ?? null,
      data.arterialPh ?? null,
      oi,
      data.inoDosePpm,
      data.meanBloodPressureMmhg,
      data.chestTubeDrainageActive ? 1 : 0,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_mas.flowsheet_add',
      entity: 'neonatal_mas_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), oi, fio2: data.fio2Percent },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-mas/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalMas(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM neonatal_mas_flowsheet_logs
      WHERE id = ? AND mas_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_mas_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_mas.flowsheet_delete',
      entity: 'neonatal_mas_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
