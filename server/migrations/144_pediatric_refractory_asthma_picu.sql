-- Migration 144: Pediatric Refractory Status Asthmaticus Resuscitation (PICU Rescue) Protocol
-- References: British Thoracic Society (BTS) / SIGN Guideline 158 / PALS / GINA Refractory Pediatric Asthma

CREATE TABLE IF NOT EXISTS pediatric_refractory_asthma_episodes (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  admission_id                                  INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                                  TEXT NOT NULL UNIQUE,
  onset_datetime                                TEXT NOT NULL,
  age_years                                     REAL NOT NULL,
  weight_kg                                     REAL NOT NULL,
  initial_pediatric_asthma_score                INTEGER NOT NULL DEFAULT 9,
  respiratory_rate                              INTEGER NOT NULL,
  heart_rate_bpm                                INTEGER NOT NULL,
  spo2_percent                                  REAL NOT NULL,
  pco2_mmhg                                     REAL NOT NULL DEFAULT 40.0,
  ph_value                                      REAL NOT NULL DEFAULT 7.35,
  silent_chest_or_exhaustion                    INTEGER NOT NULL DEFAULT 0 CHECK (silent_chest_or_exhaustion IN (0, 1)),
  refractory_to_first_line                      INTEGER NOT NULL DEFAULT 1 CHECK (refractory_to_first_line IN (0, 1)),
  continuous_iv_terbutaline_active              INTEGER NOT NULL DEFAULT 0 CHECK (continuous_iv_terbutaline_active IN (0, 1)),
  terbutaline_dose_mcg_kg_min                   REAL NOT NULL DEFAULT 0.0,
  iv_ketamine_infusion_active                   INTEGER NOT NULL DEFAULT 0 CHECK (iv_ketamine_infusion_active IN (0, 1)),
  ketamine_dose_mg_kg_hr                        REAL NOT NULL DEFAULT 0.0,
  heliox_inhalation_active                      INTEGER NOT NULL DEFAULT 0 CHECK (heliox_inhalation_active IN (0, 1)),
  heliox_mixture_ratio                          TEXT NOT NULL DEFAULT 'none' CHECK (heliox_mixture_ratio IN ('none', 'heliox_80_20', 'heliox_70_30')),
  iv_theophylline_aminophylline_active          INTEGER NOT NULL DEFAULT 0 CHECK (iv_theophylline_aminophylline_active IN (0, 1)),
  ventilatory_support_mode                      TEXT NOT NULL DEFAULT 'high_flow_nasal_cannula' CHECK (ventilatory_support_mode IN (
                                                  'high_flow_nasal_cannula',
                                                  'bipap_noninvasive_positive_pressure',
                                                  'invasive_mechanical_ventilation_permissive_hypercapnia',
                                                  'standard_low_flow_oxygen'
                                                )),
  status                                        TEXT NOT NULL DEFAULT 'impending_respiratory_failure' CHECK (status IN (
                                                  'impending_respiratory_failure',
                                                  'second_line_iv_bronchodilator_infusion',
                                                  'bipap_noninvasive_support',
                                                  'invasive_mechanical_ventilation_picu',
                                                  'bronchospasm_relieving_weaning',
                                                  'extubated_convalescent_stepdown',
                                                  'resolved_transferred_to_ward'
                                                )),
  consultant_id                                 INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                                TEXT,
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refractory_asthma_patient ON pediatric_refractory_asthma_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_refractory_asthma_status ON pediatric_refractory_asthma_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_refractory_asthma_flowsheet_logs (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id                                    INTEGER NOT NULL REFERENCES pediatric_refractory_asthma_episodes(id) ON DELETE CASCADE,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                                  TEXT NOT NULL,
  hours_from_picu_admission                     REAL NOT NULL,
  respiratory_rate                              INTEGER NOT NULL,
  heart_rate_bpm                                INTEGER NOT NULL,
  spo2_percent                                  REAL NOT NULL,
  pco2_mmhg                                     REAL NOT NULL,
  ph_value                                      REAL NOT NULL,
  terbutaline_infusion_rate                     REAL NOT NULL DEFAULT 0.0,
  ketamine_infusion_rate                        REAL NOT NULL DEFAULT 0.0,
  inspiratory_expiratory_ratio                  TEXT NOT NULL DEFAULT '1_to_3',
  air_entry_auscultation                        TEXT NOT NULL CHECK (air_entry_auscultation IN (
                                                  'bilateral_good_clear',
                                                  'mild_expiratory_wheeze',
                                                  'severe_widespread_wheezing',
                                                  'markedly_reduced_poor_air_movement',
                                                  'silent_chest'
                                                )),
  notes                                         TEXT,
  logged_by_id                                  INTEGER NOT NULL REFERENCES users(id),
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refractory_asthma_flowsheet_ep ON pediatric_refractory_asthma_flowsheet_logs(episode_id);
CREATE INDEX IF NOT EXISTS idx_refractory_asthma_flowsheet_pat ON pediatric_refractory_asthma_flowsheet_logs(patient_id);
