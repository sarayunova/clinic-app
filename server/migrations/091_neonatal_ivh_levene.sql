-- Migration 091: Neonatal Intraventricular Hemorrhage (IVH) & Post-Hemorrhagic Hydrocephalus (PHH)
-- References: Papile et al. (1978); Volpe (2008); Levene (1981) Ventricular Index Curve & Davies Threshold; ELVIS Trial (Pediatrics 2019)

CREATE TABLE IF NOT EXISTS neonatal_ivh_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  scan_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  chronological_age_days INTEGER NOT NULL,
  current_pma_weeks REAL NOT NULL,

  -- Cranial Ultrasound Indication & Staging
  cranial_ultrasound_indication TEXT NOT NULL,
  papile_grade TEXT NOT NULL CHECK(papile_grade IN (
    'grade_1_subependymal',
    'grade_2_intraventricular_normal_size',
    'grade_3_intraventricular_dilatation',
    'grade_4_periventricular_infarction'
  )),
  hemorrhage_laterality TEXT NOT NULL CHECK(hemorrhage_laterality IN (
    'unilateral_left',
    'unilateral_right',
    'bilateral'
  )),
  parenchymal_infarction_location TEXT,

  -- Ventricular Morphometry & Hemodynamic Doppler
  ventricular_index_left_mm REAL NOT NULL,
  ventricular_index_right_mm REAL NOT NULL,
  anterior_horn_width_left_mm REAL NOT NULL,
  anterior_horn_width_right_mm REAL NOT NULL,
  thalamo_occipital_distance_mm REAL NOT NULL DEFAULT 0,
  resistive_index_aca REAL,

  -- Head Circumference & Growth Velocity
  head_circumference_cm REAL NOT NULL,
  head_circumference_growth_cm_week REAL NOT NULL DEFAULT 0,

  -- Levene Staging & Intervention Thresholds
  levene_97th_percentile_mm REAL NOT NULL,
  levene_action_line_threshold_mm REAL NOT NULL,
  phh_intervention_threshold_crossed INTEGER NOT NULL CHECK(phh_intervention_threshold_crossed IN (0, 1)),
  intervention_status TEXT NOT NULL DEFAULT 'conservative_surveillance' CHECK(intervention_status IN (
    'conservative_surveillance',
    'serial_lumbar_punctures',
    'ventricular_access_device_reservoir',
    'subgaleal_shunt',
    'permanent_vp_shunt'
  )),
  lumbar_puncture_performed INTEGER NOT NULL DEFAULT 0 CHECK(lumbar_puncture_performed IN (0, 1)),
  csf_protein_g_l REAL,
  csf_rbc_count INTEGER,

  status TEXT NOT NULL DEFAULT 'ultrasound_surveillance_active' CHECK(status IN (
    'ultrasound_surveillance_active',
    'phh_active_decompression',
    'post_surgical_shunt_monitoring',
    'stable_arrested_hydrocephalus',
    'resolved_quiescent'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_ivh_patient ON neonatal_ivh_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_ivh_status ON neonatal_ivh_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_ivh_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ivh_episode_id INTEGER NOT NULL REFERENCES neonatal_ivh_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  days_from_baseline REAL NOT NULL DEFAULT 0,
  ventricular_index_mm REAL NOT NULL,
  anterior_horn_width_mm REAL NOT NULL,
  head_circumference_cm REAL NOT NULL,
  fontanelle_tension TEXT NOT NULL CHECK(fontanelle_tension IN ('normal_soft', 'full', 'bulging_tense')),
  split_cranial_sutures INTEGER NOT NULL DEFAULT 0 CHECK(split_cranial_sutures IN (0, 1)),
  apneic_episodes_24h INTEGER NOT NULL DEFAULT 0,
  csf_volume_tapped_ml REAL NOT NULL DEFAULT 0,
  resistive_index_aca REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_ivh_logs_episode ON neonatal_ivh_flowsheet_logs(ivh_episode_id);
