-- Migration 089: Obstetric Diabetic Ketoacidosis (DKA) & Euglycemic DKA in Pregnancy
-- References: ACOG Practice Bulletin; Sibai & Viteri (Am J Obstet Gynecol 2014); Kamalakannan et al. (Obstet Med 2010); Endocrine Society

CREATE TABLE IF NOT EXISTS obstetric_dka_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  presentation_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,
  diabetes_type TEXT NOT NULL CHECK(diabetes_type IN (
    'pregestational_type1',
    'pregestational_type2',
    'gestational_gdm',
    'new_onset'
  )),
  precipitating_trigger TEXT NOT NULL CHECK(precipitating_trigger IN (
    'infection_sepsis',
    'antenatal_steroid_betamethasone',
    'emesis_starvation',
    'insulin_omission',
    'pump_failure',
    'beta_mimetic_tocolysis',
    'unknown'
  )),

  -- Initial Biochemical Parameters
  blood_glucose_mg_dl REAL NOT NULL,
  is_euglycemic_dka INTEGER NOT NULL DEFAULT 0 CHECK(is_euglycemic_dka IN (0, 1)),
  arterial_or_venous_ph REAL NOT NULL,
  serum_bicarbonate_meq_l REAL NOT NULL,
  serum_ketones_beta_ohb_mmol_l REAL,
  urine_ketones TEXT NOT NULL CHECK(urine_ketones IN ('negative', 'trace', '1_plus', '2_plus', '3_plus', '4_plus')),
  serum_sodium_meq_l REAL NOT NULL,
  serum_potassium_meq_l REAL NOT NULL,
  serum_chloride_meq_l REAL NOT NULL,
  calculated_anion_gap REAL NOT NULL,
  corrected_sodium_meq_l REAL NOT NULL,
  effective_osmolality_mosm_kg REAL,

  -- Fetal Heart Rate Monitoring & Intrauterine Resuscitation
  fetal_heart_rate_baseline_bpm INTEGER,
  fetal_variability TEXT CHECK(fetal_variability IN ('normal_moderate', 'minimal', 'absent', 'marked')),
  decelerations_present TEXT CHECK(decelerations_present IN ('none', 'early', 'variable', 'late', 'prolonged')),
  efm_category TEXT CHECK(efm_category IN ('category_1_normal', 'category_2_indeterminate', 'category_3_abnormal')),
  intrauterine_resuscitation_advisement TEXT,

  -- Staging & Resuscitation Orders
  dka_severity_tier TEXT NOT NULL CHECK(dka_severity_tier IN ('mild', 'moderate', 'severe_critical')),
  insulin_infusion_rate_units_hr REAL NOT NULL DEFAULT 0,
  dextrose_added_to_fluids INTEGER NOT NULL DEFAULT 0 CHECK(dextrose_added_to_fluids IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'active_acidosis_resuscitation' CHECK(status IN (
    'active_acidosis_resuscitation',
    'euglycemic_dextrose_infusion',
    'acidosis_resolved_transitioning',
    'resolved_subcutaneous_insulin'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_dka_patient ON obstetric_dka_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_dka_status ON obstetric_dka_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_dka_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dka_episode_id INTEGER NOT NULL REFERENCES obstetric_dka_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_presentation REAL NOT NULL DEFAULT 0,
  blood_glucose_mg_dl REAL NOT NULL,
  insulin_rate_units_hr REAL NOT NULL,
  iv_fluid_type TEXT NOT NULL,
  iv_fluid_rate_ml_hr REAL NOT NULL,
  vbg_ph REAL,
  serum_bicarbonate_meq_l REAL,
  calculated_anion_gap REAL,
  serum_potassium_meq_l REAL NOT NULL,
  potassium_replacement_meq_l REAL NOT NULL DEFAULT 0,
  fhr_baseline_bpm INTEGER,
  fhr_variability TEXT,
  fhr_decelerations TEXT,
  maternal_sbp_mmhg INTEGER,
  maternal_dbp_mmhg INTEGER,
  maternal_hr_bpm INTEGER,
  urine_output_ml_hr REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_dka_logs_episode ON obstetric_dka_flowsheet_logs(dka_episode_id);
