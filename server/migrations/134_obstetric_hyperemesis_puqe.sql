-- Migration 134: Obstetric Hyperemesis Gravidarum (HG) & PUQE-24 Protocol
-- Reference: ACOG Practice Bulletin No. 189 / RCOG Green-top Guideline No. 69

CREATE TABLE IF NOT EXISTS obstetric_hyperemesis_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  puqe_nausea_hours                     INTEGER NOT NULL CHECK (puqe_nausea_hours BETWEEN 1 AND 5),
  puqe_vomiting_episodes                INTEGER NOT NULL CHECK (puqe_vomiting_episodes BETWEEN 1 AND 5),
  puqe_retching_episodes                INTEGER NOT NULL CHECK (puqe_retching_episodes BETWEEN 1 AND 5),
  weight_loss_percent                   REAL NOT NULL,
  ketonuria_level                       TEXT NOT NULL CHECK (ketonuria_level IN (
                                          'negative',
                                          'trace',
                                          'one_plus',
                                          'two_plus',
                                          'three_plus',
                                          'four_plus'
                                        )),
  serum_potassium_mmol_l                REAL NOT NULL,
  serum_sodium_mmol_l                   REAL NOT NULL,
  serum_chloride_mmol_l                 REAL NOT NULL,
  bicarbonate_mmol_l                    REAL NOT NULL,
  parenteral_thiamine_given_before_dextrose INTEGER NOT NULL DEFAULT 1 CHECK (parenteral_thiamine_given_before_dextrose IN (0, 1)),
  wernicke_triad_symptoms_present       INTEGER NOT NULL DEFAULT 0 CHECK (wernicke_triad_symptoms_present IN (0, 1)),
  current_antiemetic_tier               TEXT NOT NULL CHECK (current_antiemetic_tier IN (
                                          'tier_1_doxylamine_pyridoxine',
                                          'tier_2_dimenhydrinate_or_metoclopramide',
                                          'tier_3_ondansetron_5ht3_antagonist',
                                          'tier_4_corticosteroid_methylprednisolone_pulse',
                                          'refractory_enteral_jejunostomy_tpn'
                                        )),
  thromboprophylaxis_lmwh_prescribed    INTEGER NOT NULL DEFAULT 0 CHECK (thromboprophylaxis_lmwh_prescribed IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'inpatient_iv_hydration_thiamine' CHECK (status IN (
                                          'inpatient_iv_hydration_thiamine',
                                          'antiemetic_step_up_escalation',
                                          'corticosteroid_pulse_therapy',
                                          'oral_tolerance_dietary_reintroduction',
                                          'outpatient_maintenance_surveillance',
                                          'resolved_discharged_home'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hg_patient ON obstetric_hyperemesis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_hg_status ON obstetric_hyperemesis_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_hyperemesis_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  hyperemesis_episode_id                INTEGER NOT NULL REFERENCES obstetric_hyperemesis_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  day_of_treatment                      INTEGER NOT NULL,
  puqe_score_total                      INTEGER NOT NULL CHECK (puqe_score_total BETWEEN 3 AND 15),
  vomiting_episodes_24h                 INTEGER NOT NULL,
  ketonuria_dipstick                    TEXT NOT NULL CHECK (ketonuria_dipstick IN (
                                          'negative',
                                          'trace',
                                          'one_plus',
                                          'two_plus',
                                          'three_plus',
                                          'four_plus'
                                        )),
  iv_fluid_balance_ml_24h               REAL NOT NULL,
  oral_fluid_intake_ml                  REAL NOT NULL,
  potassium_mmol_l                      REAL NOT NULL,
  thiamine_administered                 INTEGER NOT NULL DEFAULT 1 CHECK (thiamine_administered IN (0, 1)),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hg_flowsheet_episode ON obstetric_hyperemesis_flowsheet_logs(hyperemesis_episode_id);
CREATE INDEX IF NOT EXISTS idx_hg_flowsheet_patient ON obstetric_hyperemesis_flowsheet_logs(patient_id);
