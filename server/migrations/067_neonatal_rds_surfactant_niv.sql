-- Migration 067: Neonatal Respiratory Distress Syndrome (RDS), Surfactant & Non-Invasive Ventilation (NIV / Bubble CPAP)
-- Reference: European Consensus Guidelines on the Management of RDS (2022/2023 update) & AAP Surfactant Guidelines.

CREATE TABLE IF NOT EXISTS neonatal_rds_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  onset_datetime                      TEXT NOT NULL,
  gestational_age_weeks               REAL NOT NULL,
  birth_weight_kg                     REAL NOT NULL,
  current_weight_kg                   REAL NOT NULL,
  silverman_anderson_score            INTEGER NOT NULL, -- 0 to 10
  downes_score                        INTEGER NOT NULL, -- 0 to 10
  fio2_requirement_percent            REAL NOT NULL, -- e.g. 40.0%
  arterial_pao2_mmhg                  REAL,
  alveolar_pao2_mmhg                  REAL,
  a_a_ratio                           REAL, -- paO2 / PAO2 (< 0.22 indicates surfactant deficiency)
  oxygenation_index                   REAL, -- (MAP * FiO2 * 100) / PaO2
  surfactant_indicated                INTEGER NOT NULL DEFAULT 0,
  surfactant_brand                    TEXT CHECK (surfactant_brand IN ('curosurf_poractant_alfa', 'survanta_beractant', 'infasurf_calfactant')),
  surfactant_dose_mg_per_kg           REAL, -- 100 or 200 mg/kg
  surfactant_total_dose_mg            REAL,
  surfactant_total_volume_ml          REAL,
  administration_method               TEXT CHECK (administration_method IN ('lisa_mist_thin_catheter', 'insure_intubate_surfactant_extubate', 'endotracheal_invasive')),
  surfactant_administered_at          TEXT,
  repeat_surfactant_needed            INTEGER NOT NULL DEFAULT 0,
  niv_modality                        TEXT NOT NULL CHECK (niv_modality IN ('bubble_cpap', 'variable_flow_cpap', 'high_flow_nasal_cannula', 'biphasic_niv', 'intubated_conventional_cmv')),
  current_peep_cmh2o                  REAL NOT NULL DEFAULT 5.0,
  current_flow_lpm                    REAL NOT NULL DEFAULT 6.0,
  current_fio2_percent                REAL NOT NULL DEFAULT 30.0,
  status                              TEXT NOT NULL DEFAULT 'active_niv' CHECK (status IN (
                                        'active_niv', 'surfactant_administered_stabilized', 'escalated_to_invasive_ventilation', 'weaned_to_room_air', 'discontinued'
                                      )),
  consultant_neonatologist_id         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rds_patient ON neonatal_rds_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_rds_status ON neonatal_rds_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_niv_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  rds_episode_id                      INTEGER NOT NULL REFERENCES neonatal_rds_episodes(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_on_protocol                   REAL NOT NULL,
  respiratory_rate_bpm                INTEGER NOT NULL,
  heart_rate_bpm                      INTEGER NOT NULL,
  spo2_percent                        REAL NOT NULL,
  silverman_score                     INTEGER NOT NULL,
  downes_score                        INTEGER NOT NULL,
  peep_cmh2o                          REAL NOT NULL,
  flow_lpm                            REAL NOT NULL,
  fio2_percent                        REAL NOT NULL,
  nasal_columella_skin_check          TEXT NOT NULL DEFAULT 'intact' CHECK (nasal_columella_skin_check IN ('intact', 'erythema', 'erosion', 'necrosis')),
  gastric_distension                  TEXT NOT NULL DEFAULT 'none' CHECK (gastric_distension IN ('none', 'mild', 'marked_vented')),
  arterial_blood_gas_ph               REAL,
  arterial_pco2_mmhg                  REAL,
  arterial_pao2_mmhg                  REAL,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_niv_episode ON neonatal_niv_flowsheet_logs(rds_episode_id);
