-- Migration 088: Neonatal Hemodynamically Significant Patent Ductus Arteriosus (hsPDA)
-- References: McNamara & Sehgal (Semin Perinatol 2007); El-Khuffash et al. (J Pediatr 2015); AAP Ductus Arteriosus Management Guidelines

CREATE TABLE IF NOT EXISTS neonatal_hspda_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  echo_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  chronological_age_days INTEGER NOT NULL,
  current_weight_grams REAL NOT NULL,

  -- Echocardiographic Markers
  ductal_diameter_mm REAL NOT NULL,
  ductal_velocity_vmax_ms REAL NOT NULL DEFAULT 0,
  shunt_direction TEXT NOT NULL CHECK(shunt_direction IN ('left_to_right', 'bidirectional', 'right_to_left')),
  la_ao_ratio REAL NOT NULL,
  lpa_diastolic_velocity_ms REAL NOT NULL DEFAULT 0,
  descending_aorta_diastolic_flow TEXT NOT NULL CHECK(descending_aorta_diastolic_flow IN (
    'antegrade_normal',
    'absent_diastolic',
    'retrograde_steal'
  )),

  -- Clinical & Hemodynamic Markers
  cardiomegaly_present INTEGER NOT NULL DEFAULT 0 CHECK(cardiomegaly_present IN (0, 1)),
  pulmonary_edema_present INTEGER NOT NULL DEFAULT 0 CHECK(pulmonary_edema_present IN (0, 1)),
  bounding_pulses INTEGER NOT NULL DEFAULT 0 CHECK(bounding_pulses IN (0, 1)),
  hypotension_wide_pulse_pressure INTEGER NOT NULL DEFAULT 0 CHECK(hypotension_wide_pulse_pressure IN (0, 1)),
  metabolic_acidosis INTEGER NOT NULL DEFAULT 0 CHECK(metabolic_acidosis IN (0, 1)),
  oliguria_present INTEGER NOT NULL DEFAULT 0 CHECK(oliguria_present IN (0, 1)),
  respiratory_support_escalation INTEGER NOT NULL DEFAULT 0 CHECK(respiratory_support_escalation IN (0, 1)),

  -- Staging & Assessment
  mcnamara_echo_stage TEXT NOT NULL CHECK(mcnamara_echo_stage IN ('stage_1_mild', 'stage_2_moderate', 'stage_3_severe')),
  mcnamara_clinical_stage TEXT NOT NULL CHECK(mcnamara_clinical_stage IN ('stage_1_mild', 'stage_2_moderate', 'stage_3_severe')),
  hspda_confirmed INTEGER NOT NULL CHECK(hspda_confirmed IN (0, 1)),

  -- Pharmacotherapy & Interventions
  pharmacotherapy_selected TEXT NOT NULL CHECK(pharmacotherapy_selected IN (
    'none_conservative',
    'iv_ibuprofen',
    'iv_indomethacin',
    'iv_paracetamol',
    'contraindicated'
  )),
  paracetamol_rationale TEXT,
  contraindications_present INTEGER NOT NULL DEFAULT 0 CHECK(contraindications_present IN (0, 1)),
  interventional_referral TEXT NOT NULL DEFAULT 'none' CHECK(interventional_referral IN (
    'none',
    'catheter_closure',
    'surgical_ligation'
  )),

  status TEXT NOT NULL DEFAULT 'echocardiographic_surveillance' CHECK(status IN (
    'echocardiographic_surveillance',
    'medical_therapy_active',
    'post_therapy_echo_reassessment',
    'interventional_referral',
    'resolved_closed'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_hspda_patient ON neonatal_hspda_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_hspda_status ON neonatal_hspda_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_hspda_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hspda_episode_id INTEGER NOT NULL REFERENCES neonatal_hspda_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_initiation REAL NOT NULL DEFAULT 0,
  heart_rate_bpm INTEGER NOT NULL,
  sbp_mmhg INTEGER NOT NULL,
  dbp_mmhg INTEGER NOT NULL,
  map_mmhg INTEGER NOT NULL,
  pulse_pressure_mmhg INTEGER NOT NULL,
  respiratory_support_type TEXT NOT NULL,
  fio2_percent REAL NOT NULL DEFAULT 21,
  spo2_percent REAL NOT NULL,
  urine_output_ml_kg_hr REAL,
  serum_creatinine_mg_dl REAL,
  platelet_count INTEGER,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_hspda_logs_episode ON neonatal_hspda_flowsheet_logs(hspda_episode_id);
