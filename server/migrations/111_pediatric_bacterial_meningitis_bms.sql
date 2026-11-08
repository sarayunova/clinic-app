-- Migration 111: Pediatric Bacterial Meningitis & Nigrovic Bacterial Meningitis Score (BMS) Protocol
-- Reference: Nigrovic et al. (JAMA / Pediatrics), IDSA Bacterial Meningitis Guidelines, AAP Clinical Guidance

CREATE TABLE IF NOT EXISTS pediatric_bacterial_meningitis_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  triage_datetime                     TEXT NOT NULL,
  age_months                          INTEGER NOT NULL,
  weight_kg                           REAL NOT NULL,
  prior_antibiotic_exposure_72h       INTEGER NOT NULL DEFAULT 0 CHECK (prior_antibiotic_exposure_72h IN (0, 1)),
  seizure_at_presentation             INTEGER NOT NULL DEFAULT 0 CHECK (seizure_at_presentation IN (0, 1)),
  gcs_score                           INTEGER NOT NULL CHECK (gcs_score BETWEEN 3 AND 15),
  kernig_brudzinski_sign              INTEGER NOT NULL DEFAULT 0 CHECK (kernig_brudzinski_sign IN (0, 1)),
  fontanelle_bulging                  INTEGER NOT NULL DEFAULT 0 CHECK (fontanelle_bulging IN (0, 1)),
  purpuric_rash                       INTEGER NOT NULL DEFAULT 0 CHECK (purpuric_rash IN (0, 1)),
  csf_wbc_count                       INTEGER NOT NULL,
  csf_neutrophil_percent              REAL NOT NULL,
  csf_anc_calculated                  INTEGER NOT NULL,
  csf_protein_mg_dl                   REAL NOT NULL,
  csf_glucose_mg_dl                   REAL NOT NULL,
  blood_glucose_mg_dl                 REAL NOT NULL,
  csf_to_blood_glucose_ratio          REAL NOT NULL,
  csf_gram_stain_positive             INTEGER NOT NULL DEFAULT 0 CHECK (csf_gram_stain_positive IN (0, 1)),
  csf_gram_stain_organism             TEXT NOT NULL CHECK (csf_gram_stain_organism IN (
                                        'none_seen',
                                        'gram_positive_cocci_pairs',
                                        'gram_negative_diplococci',
                                        'gram_negative_bacilli',
                                        'other'
                                      )),
  peripheral_wbc                      REAL NOT NULL,
  peripheral_anc                      REAL NOT NULL,
  bms_score                           INTEGER NOT NULL CHECK (bms_score BETWEEN 0 AND 6),
  risk_tier                           TEXT NOT NULL CHECK (risk_tier IN ('very_low_risk', 'high_risk')),
  empiric_ceftriaxone_ordered         INTEGER NOT NULL DEFAULT 0 CHECK (empiric_ceftriaxone_ordered IN (0, 1)),
  empiric_vancomycin_ordered          INTEGER NOT NULL DEFAULT 0 CHECK (empiric_vancomycin_ordered IN (0, 1)),
  dexamethasone_given_pre_antibiotic  INTEGER NOT NULL DEFAULT 0 CHECK (dexamethasone_given_pre_antibiotic IN (0, 1)),
  isolation_precautions               TEXT NOT NULL DEFAULT 'droplet_precautions' CHECK (isolation_precautions IN (
                                        'droplet_precautions',
                                        'standard'
                                      )),
  status                              TEXT NOT NULL DEFAULT 'active_triage' CHECK (status IN (
                                        'active_triage',
                                        'picu_critical_care',
                                        'ward_antimicrobial_therapy',
                                        'aseptic_meningitis_weaning',
                                        'resolved_discharged'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_meningitis_patient ON pediatric_bacterial_meningitis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_meningitis_status ON pediatric_bacterial_meningitis_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_bacterial_meningitis_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  meningitis_episode_id               INTEGER NOT NULL REFERENCES pediatric_bacterial_meningitis_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  gcs_score                           INTEGER NOT NULL CHECK (gcs_score BETWEEN 3 AND 15),
  pupil_reactivity                    TEXT NOT NULL CHECK (pupil_reactivity IN (
                                        'brisk_bilateral',
                                        'sluggish',
                                        'unequal_fixed'
                                      )),
  heart_rate                          INTEGER NOT NULL,
  blood_pressure_sys                  INTEGER NOT NULL,
  blood_pressure_dia                  INTEGER NOT NULL,
  temperature_celsius                 REAL NOT NULL,
  respiratory_rate                    INTEGER NOT NULL,
  seizure_activity_observed           INTEGER NOT NULL DEFAULT 0 CHECK (seizure_activity_observed IN (0, 1)),
  neurological_notes                  TEXT,
  antibiotic_dose_administered        TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_meningitis_logs_episode ON pediatric_bacterial_meningitis_flowsheet_logs(meningitis_episode_id);
