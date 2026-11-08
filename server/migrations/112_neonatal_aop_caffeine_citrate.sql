-- Migration 112: Neonatal Apnea of Prematurity (AOP) & Methylxanthine (Caffeine Citrate) Therapy Protocol
-- Reference: AAP Clinical Report / Cochrane Neonatal AOP Review / CAP Trial Guidance

CREATE TABLE IF NOT EXISTS neonatal_aop_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  onset_datetime                      TEXT NOT NULL,
  gestational_age_weeks               REAL NOT NULL,
  chronological_age_days              INTEGER NOT NULL,
  post_conceptional_age_weeks         REAL NOT NULL,
  current_weight_kg                   REAL NOT NULL,
  apnea_subtype                       TEXT NOT NULL CHECK (apnea_subtype IN (
                                        'mixed',
                                        'central',
                                        'obstructive'
                                      )),
  apnea_frequency_per_24h             INTEGER NOT NULL DEFAULT 1,
  bradycardia_present                 INTEGER NOT NULL DEFAULT 1 CHECK (bradycardia_present IN (0, 1)),
  lowest_heart_rate_bpm               INTEGER,
  desaturation_present                INTEGER NOT NULL DEFAULT 1 CHECK (desaturation_present IN (0, 1)),
  lowest_spo2_percent                 REAL,
  stimulation_required                TEXT NOT NULL CHECK (stimulation_required IN (
                                        'self_resolved',
                                        'tactile_gentle',
                                        'vigorous_stimulation',
                                        'bag_mask_positive_pressure'
                                      )),
  caffeine_citrate_active             INTEGER NOT NULL DEFAULT 1 CHECK (caffeine_citrate_active IN (0, 1)),
  caffeine_loading_dose_mg_kg         REAL NOT NULL DEFAULT 20.0,
  caffeine_maintenance_dose_mg_kg_day REAL NOT NULL DEFAULT 7.5,
  serum_caffeine_level_mcg_ml         REAL,
  secondary_causes_excluded           INTEGER NOT NULL DEFAULT 1 CHECK (secondary_causes_excluded IN (0, 1)),
  respiratory_support_mode            TEXT NOT NULL CHECK (respiratory_support_mode IN (
                                        'room_air',
                                        'low_flow_nasal_cannula',
                                        'high_flow_hfnc',
                                        'bubble_cpap',
                                        'niv_nava',
                                        'invasive_mechanical_ventilation'
                                      )),
  cpap_peep_cmh2o                     REAL,
  weaning_eligible                    INTEGER NOT NULL DEFAULT 0 CHECK (weaning_eligible IN (0, 1)),
  apnea_free_days_count               INTEGER NOT NULL DEFAULT 0,
  status                              TEXT NOT NULL DEFAULT 'active_treatment' CHECK (status IN (
                                        'active_treatment',
                                        'dose_escalation_refractory',
                                        'weaning_phase',
                                        'caffeine_discontinued_monitoring',
                                        'resolved_discharged'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_aop_patient ON neonatal_aop_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_aop_status ON neonatal_aop_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_aop_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  aop_episode_id                      INTEGER NOT NULL REFERENCES neonatal_aop_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  apnea_events_count_in_shift         INTEGER NOT NULL DEFAULT 0,
  bradycardia_events_count            INTEGER NOT NULL DEFAULT 0,
  desaturation_events_count           INTEGER NOT NULL DEFAULT 0,
  lowest_heart_rate_bpm               INTEGER,
  lowest_spo2_percent                 REAL,
  stimulation_mode_used               TEXT CHECK (stimulation_mode_used IN (
                                        'none',
                                        'tactile_rubbing',
                                        'repositioning',
                                        'bag_valve_mask'
                                      )),
  caffeine_dose_given_mg              REAL,
  current_respiratory_support         TEXT,
  caffeine_toxicity_signs             INTEGER NOT NULL DEFAULT 0 CHECK (caffeine_toxicity_signs IN (0, 1)),
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_aop_logs_episode ON neonatal_aop_flowsheet_logs(aop_episode_id);
