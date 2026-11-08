-- Migration 133: Neonatal Congenital Diaphragmatic Hernia (CDH) & Gentle Ventilation Protocol
-- Reference: AAP / EURO-CDH Consortium Consensus Guidelines

CREATE TABLE IF NOT EXISTS neonatal_cdh_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_hours                             INTEGER NOT NULL,
  weight_kg                             REAL NOT NULL,
  defect_side                           TEXT NOT NULL CHECK (defect_side IN (
                                          'left_bochdalek',
                                          'right_bochdalek',
                                          'bilateral_bochdalek',
                                          'anterior_morgagni'
                                        )),
  liver_herniation_up                   INTEGER NOT NULL DEFAULT 0 CHECK (liver_herniation_up IN (0, 1)),
  observed_expected_lhr_percent         REAL NOT NULL,
  bag_mask_avoided_in_delivery_room     INTEGER NOT NULL DEFAULT 1 CHECK (bag_mask_avoided_in_delivery_room IN (0, 1)),
  replogle_sump_decompression_active    INTEGER NOT NULL DEFAULT 1 CHECK (replogle_sump_decompression_active IN (0, 1)),
  preductal_spo2_percent                INTEGER NOT NULL,
  postductal_spo2_percent               INTEGER NOT NULL,
  peak_inspiratory_pressure_cmh2o       REAL NOT NULL,
  peep_cmh2o                            REAL NOT NULL DEFAULT 4.5,
  paco2_mmhg                            REAL NOT NULL,
  inhaled_nitric_oxide_active           INTEGER NOT NULL DEFAULT 0 CHECK (inhaled_nitric_oxide_active IN (0, 1)),
  sildenafil_infusion_active            INTEGER NOT NULL DEFAULT 0 CHECK (sildenafil_infusion_active IN (0, 1)),
  surgical_repair_status                TEXT NOT NULL DEFAULT 'preop_physiological_stabilization' CHECK (surgical_repair_status IN (
                                          'preop_physiological_stabilization',
                                          'ready_for_repair_criteria_met',
                                          'primary_repair_performed',
                                          'prosthetic_patch_repair_performed',
                                          'ecmo_cannulated_bridge'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'preop_gentle_ventilation' CHECK (status IN (
                                          'preop_gentle_ventilation',
                                          'pulmonary_hypertension_crisis',
                                          'in_operating_room_repair',
                                          'postop_ventilatory_weaning',
                                          'recovering_extubated',
                                          'resolved_discharged_home'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cdh_patient ON neonatal_cdh_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_cdh_status ON neonatal_cdh_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_cdh_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  cdh_episode_id                        INTEGER NOT NULL REFERENCES neonatal_cdh_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  hours_from_admission                  INTEGER NOT NULL,
  pip_cmh2o                             REAL NOT NULL,
  peep_cmh2o                            REAL NOT NULL,
  fio2_percent                          REAL NOT NULL,
  preductal_spo2                        INTEGER NOT NULL,
  postductal_spo2                       INTEGER NOT NULL,
  arterial_ph                           REAL NOT NULL,
  paco2_mmhg                            REAL NOT NULL,
  lactate_mmol_l                        REAL NOT NULL,
  mean_arterial_pressure_mmhg           REAL NOT NULL,
  ino_ppm                               REAL NOT NULL DEFAULT 0.0,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cdh_flowsheet_episode ON neonatal_cdh_flowsheet_logs(cdh_episode_id);
CREATE INDEX IF NOT EXISTS idx_cdh_flowsheet_patient ON neonatal_cdh_flowsheet_logs(patient_id);
