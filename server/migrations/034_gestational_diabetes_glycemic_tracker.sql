-- Migration 034: Gestational Diabetes Mellitus (GDM) & Glycemic Tracker
-- Supports DIPSI, IADPSG, Carpenter-Coustan OGTT diagnostics, White's classification,
-- multi-point daily blood glucose self-monitoring (SMBG), insulin/pharmacotherapy titration,
-- and fetal macrosomia / polyhydramnios ultrasound surveillance.

CREATE TABLE IF NOT EXISTS gdm_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  gestational_age_weeks NUMERIC,
  diagnostic_criteria TEXT NOT NULL CHECK(diagnostic_criteria IN ('dipsi', 'iadpsg', 'carpenter_coustan', 'prior_pregestational', 'clinical_hba1c')),
  diagnostic_date TEXT NOT NULL,
  ogtt_fasting_mg_dl NUMERIC,
  ogtt_1hr_mg_dl NUMERIC,
  ogtt_2hr_mg_dl NUMERIC,
  ogtt_3hr_mg_dl NUMERIC,
  baseline_hba1c NUMERIC,
  white_classification TEXT NOT NULL DEFAULT 'a1_diet' CHECK(white_classification IN ('a1_diet', 'a2_medication', 'class_b_pregestational', 'class_c', 'class_d')),
  current_management TEXT NOT NULL DEFAULT 'medical_nutrition_therapy' CHECK(current_management IN ('medical_nutrition_therapy', 'metformin', 'insulin', 'insulin_plus_metformin')),
  target_fasting_mg_dl NUMERIC NOT NULL DEFAULT 95,
  target_postprandial_mg_dl NUMERIC NOT NULL DEFAULT 120,
  postprandial_window TEXT NOT NULL DEFAULT '2_hour' CHECK(postprandial_window IN ('1_hour', '2_hour')),
  target_hba1c NUMERIC NOT NULL DEFAULT 6.0,
  insulin_regimen_type TEXT NOT NULL DEFAULT 'none' CHECK(insulin_regimen_type IN ('none', 'basal_only', 'bolus_only', 'basal_bolus', 'split_mixed_nph_reg')),
  basal_insulin_name TEXT,
  basal_units_morning NUMERIC,
  basal_units_night NUMERIC,
  bolus_insulin_name TEXT,
  bolus_units_breakfast NUMERIC,
  bolus_units_lunch NUMERIC,
  bolus_units_dinner NUMERIC,
  metformin_dose_mg_day NUMERIC,
  dietary_calories_prescribed NUMERIC,
  fetal_surveillance_notes TEXT,
  planned_delivery_weeks NUMERIC,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'resolved_postpartum', 'converted_type2')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gdm_profiles_patient ON gdm_profiles(patient_id, status);

CREATE TABLE IF NOT EXISTS gdm_glucose_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES gdm_profiles(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  log_time TEXT NOT NULL,
  meal_slot TEXT NOT NULL CHECK(meal_slot IN ('fasting', 'post_breakfast', 'pre_lunch', 'post_lunch', 'pre_dinner', 'post_dinner', 'bedtime', '3_am_nocturnal', 'random')),
  blood_glucose_mg_dl NUMERIC NOT NULL,
  target_status TEXT NOT NULL CHECK(target_status IN ('severe_hypoglycemia', 'mild_hypoglycemia', 'in_target', 'mild_excursion', 'severe_excursion')),
  carbs_consumed_estimate TEXT,
  insulin_administered_units NUMERIC,
  physical_activity_min INTEGER,
  symptoms TEXT,
  action_taken TEXT,
  source TEXT NOT NULL DEFAULT 'patient_log' CHECK(source IN ('patient_log', 'ward_nurse_glucometer', 'lab_venous')),
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gdm_glucose_logs_patient_date ON gdm_glucose_logs(patient_id, log_date DESC, meal_slot);
CREATE INDEX IF NOT EXISTS idx_gdm_glucose_logs_profile ON gdm_glucose_logs(profile_id, log_date DESC);

CREATE TABLE IF NOT EXISTS gdm_fetal_surveillance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES gdm_profiles(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessment_date TEXT NOT NULL,
  gestational_age_weeks NUMERIC,
  estimated_fetal_weight_g NUMERIC,
  efw_percentile NUMERIC,
  abdominal_circumference_mm NUMERIC,
  ac_percentile NUMERIC,
  amniotic_fluid_index_cm NUMERIC,
  single_deepest_pocket_cm NUMERIC,
  macrosomia_risk_flag TEXT NOT NULL DEFAULT 'normal' CHECK(macrosomia_risk_flag IN ('normal', 'borderline_ac_over_75', 'macrosomia_suspected', 'polyhydramnios')),
  clinical_plan TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gdm_fetal_surveillance_patient ON gdm_fetal_surveillance(patient_id, assessment_date DESC);
