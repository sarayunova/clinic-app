-- Migration 109: Neonatal Transient Tachypnea of the Newborn (TTN) & Delayed Lung Fluid Resorption Protocol
-- Reference: AAP Clinical Report / European Guidelines on Neonatal Respiratory Distress / Silverman-Anderson Score

CREATE TABLE IF NOT EXISTS neonatal_ttn_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  diagnosis_datetime                  TEXT NOT NULL,
  gestational_age_weeks               REAL NOT NULL,
  birth_weight_kg                     REAL NOT NULL,
  delivery_mode                       TEXT NOT NULL CHECK (delivery_mode IN (
                                        'elective_cesarean_no_labor',
                                        'emergency_cesarean_in_labor',
                                        'vaginal_spontaneous',
                                        'vaginal_instrumental'
                                      )),
  maternal_diabetes                   INTEGER NOT NULL DEFAULT 0 CHECK (maternal_diabetes IN (0, 1)),
  maternal_asthma                     INTEGER NOT NULL DEFAULT 0 CHECK (maternal_asthma IN (0, 1)),
  maternal_fluid_overload             INTEGER NOT NULL DEFAULT 0 CHECK (maternal_fluid_overload IN (0, 1)),
  initial_respiratory_rate            INTEGER NOT NULL,
  silverman_anderson_score            INTEGER NOT NULL DEFAULT 0, -- 0 to 10
  chest_retraction_upper              INTEGER NOT NULL DEFAULT 0 CHECK (chest_retraction_upper IN (0, 1, 2)),
  chest_retraction_lower              INTEGER NOT NULL DEFAULT 0 CHECK (chest_retraction_lower IN (0, 1, 2)),
  xiphoid_retraction                  INTEGER NOT NULL DEFAULT 0 CHECK (xiphoid_retraction IN (0, 1, 2)),
  nasal_flaring                       INTEGER NOT NULL DEFAULT 0 CHECK (nasal_flaring IN (0, 1, 2)),
  expiratory_grunt                    INTEGER NOT NULL DEFAULT 0 CHECK (expiratory_grunt IN (0, 1, 2)),
  cxr_findings                        TEXT NOT NULL CHECK (cxr_findings IN (
                                        'perihilar_streaking_sunburst',
                                        'fissural_fluid_line',
                                        'prominent_vascularity',
                                        'hyperaeration',
                                        'normal_or_equivocal',
                                        'ground_glass_rds_overlap'
                                      )),
  initial_fio2_percent                REAL NOT NULL DEFAULT 21.0,
  respiratory_support_initial         TEXT NOT NULL CHECK (respiratory_support_initial IN (
                                        'room_air',
                                        'nasal_cannula_low_flow',
                                        'hfnc',
                                        'bubble_cpap',
                                        'mechanical_ventilation'
                                      )),
  cpap_peep_cmh2o                     REAL,
  feeding_status                      TEXT NOT NULL CHECK (feeding_status IN (
                                        'npo_iv_fluids',
                                        'orogastric_gavage',
                                        'oral_breast_bottle'
                                      )),
  blood_gas_ph                        REAL,
  blood_gas_pco2                      REAL,
  blood_gas_pao2                      REAL,
  status                              TEXT NOT NULL DEFAULT 'active_monitoring' CHECK (status IN (
                                        'active_monitoring',
                                        'weaning_support',
                                        'resolved_discharged',
                                        'escalated_to_rds_surfactant',
                                        'escalated_to_pphn'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_ttn_patient ON neonatal_ttn_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_ttn_status ON neonatal_ttn_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_ttn_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ttn_episode_id                      INTEGER NOT NULL REFERENCES neonatal_ttn_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  respiratory_rate                    INTEGER NOT NULL,
  heart_rate                          INTEGER NOT NULL,
  spo2_percent                        REAL NOT NULL,
  fio2_percent                        REAL NOT NULL,
  cpap_peep_cmh2o                     REAL,
  silverman_anderson_score            INTEGER NOT NULL DEFAULT 0,
  grunting_present                    INTEGER NOT NULL DEFAULT 0 CHECK (grunting_present IN (0, 1)),
  feeding_route                       TEXT CHECK (feeding_route IN ('npo_iv', 'gavage_tube', 'oral_breast', 'oral_bottle')),
  blood_gas_ph                        REAL,
  blood_gas_pco2                      REAL,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_ttn_logs_episode ON neonatal_ttn_flowsheet_logs(ttn_episode_id);
