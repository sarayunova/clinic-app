-- Migration 081: Pediatric Traumatic Brain Injury (TBI), PECARN Decision Rules & Tiered Raised ICP Management
-- Reference: PECARN Head Trauma Rule (Lancet 2009), Brain Trauma Foundation (BTF) Guidelines for Pediatric Severe TBI (2019)

CREATE TABLE IF NOT EXISTS pediatric_tbi_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  injury_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  injury_mechanism TEXT NOT NULL CHECK(injury_mechanism IN (
    'severe_motor_vehicle_collision',
    'fall_greater_than_threshold',
    'pedestrian_or_cyclist_vs_vehicle',
    'struck_by_high_velocity_object',
    'ground_level_fall',
    'assault_non_accidental_trauma',
    'other'
  )),
  age_bracket TEXT NOT NULL CHECK(age_bracket IN ('under_2_years', '2_years_and_older')),
  gcs_score INTEGER NOT NULL CHECK(gcs_score BETWEEN 3 AND 15),
  altered_mental_status INTEGER NOT NULL DEFAULT 0 CHECK(altered_mental_status IN (0, 1)),
  palpable_skull_fracture INTEGER NOT NULL DEFAULT 0 CHECK(palpable_skull_fracture IN (0, 1)),
  non_frontal_scalp_hematoma INTEGER NOT NULL DEFAULT 0 CHECK(non_frontal_scalp_hematoma IN (0, 1)),
  loss_of_consciousness_seconds INTEGER NOT NULL DEFAULT 0,
  acting_abnormal_parent INTEGER NOT NULL DEFAULT 0 CHECK(acting_abnormal_parent IN (0, 1)),
  signs_of_basilar_fracture INTEGER NOT NULL DEFAULT 0 CHECK(signs_of_basilar_fracture IN (0, 1)),
  vomiting_episodes_count INTEGER NOT NULL DEFAULT 0,
  severe_headache INTEGER NOT NULL DEFAULT 0 CHECK(severe_headache IN (0, 1)),
  pecarn_risk_category TEXT NOT NULL CHECK(pecarn_risk_category IN (
    'high_risk_ct_indicated',
    'intermediate_risk_observation_vs_ct',
    'low_risk_no_ct'
  )),
  ct_performed INTEGER NOT NULL DEFAULT 0 CHECK(ct_performed IN (0, 1)),
  ct_findings TEXT NOT NULL DEFAULT 'not_performed' CHECK(ct_findings IN (
    'not_performed',
    'normal',
    'isolated_linear_fracture',
    'depressed_skull_fracture',
    'epidural_hematoma',
    'subdural_hematoma',
    'subarachnoid_hemorrhage',
    'cerebral_contusion',
    'diffuse_cerebral_edema_midline_shift'
  )),
  raised_icp_suspected INTEGER NOT NULL DEFAULT 0 CHECK(raised_icp_suspected IN (0, 1)),
  icp_management_tier TEXT NOT NULL DEFAULT 'tier_0_observation' CHECK(icp_management_tier IN (
    'tier_0_observation',
    'tier_1_neuroprotective',
    'tier_2_hyperosmolar_therapy',
    'tier_3_refractory_decompression'
  )),
  hyperosmolar_agent TEXT NOT NULL DEFAULT 'none' CHECK(hyperosmolar_agent IN ('none', 'hypertonic_saline_3pct', 'mannitol_20pct')),
  intubation_status TEXT NOT NULL DEFAULT 'natural_airway' CHECK(intubation_status IN (
    'natural_airway',
    'intubated_mechanical_ventilation'
  )),
  status TEXT NOT NULL DEFAULT 'acute_ed_eval' CHECK(status IN (
    'acute_ed_eval',
    'picu_icp_monitoring',
    'post_operative_craniotomy',
    'step_down_ward',
    'discharged_convalescent'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_tbi_patient ON pediatric_tbi_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_tbi_status ON pediatric_tbi_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_tbi_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tbi_episode_id INTEGER NOT NULL REFERENCES pediatric_tbi_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_injury INTEGER NOT NULL DEFAULT 0,
  gcs_total INTEGER NOT NULL CHECK(gcs_total BETWEEN 3 AND 15),
  gcs_eye INTEGER NOT NULL CHECK(gcs_eye BETWEEN 1 AND 4),
  gcs_verbal INTEGER NOT NULL CHECK(gcs_verbal BETWEEN 1 AND 5),
  gcs_motor INTEGER NOT NULL CHECK(gcs_motor BETWEEN 1 AND 6),
  pupil_reactivity TEXT NOT NULL DEFAULT 'brisk_bilateral' CHECK(pupil_reactivity IN (
    'brisk_bilateral',
    'sluggish_bilateral',
    'unilateral_fixed_dilated',
    'bilateral_fixed_dilated'
  )),
  pupil_size_right_mm REAL,
  pupil_size_left_mm REAL,
  vitals_hr INTEGER,
  vitals_sbp INTEGER,
  vitals_dbp INTEGER,
  vitals_spo2 REAL,
  icp_mmhg REAL,
  calculated_cpp_mmhg REAL,
  serum_sodium_meq_l REAL,
  serum_osmolarity_mosm_kg REAL,
  hyperosmolar_bolus_given TEXT NOT NULL DEFAULT 'none' CHECK(hyperosmolar_bolus_given IN (
    'none',
    'hypertonic_saline_3pct',
    'mannitol_20pct'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_tbi_logs_episode ON pediatric_tbi_flowsheet_logs(tbi_episode_id);
