-- Migration 032: Gynecological Infertility & Serial Folliculometry Cycle Monitor
-- Tracks infertility workups, ovulation induction protocols, serial TVS folliculometry (follicle growth, endometrial receptivity), trigger & TIC/IUI timing.

CREATE TABLE IF NOT EXISTS infertility_workups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  partner_name TEXT,
  partner_age INTEGER,
  infertility_type TEXT NOT NULL DEFAULT 'primary' CHECK (infertility_type IN ('primary', 'secondary')),
  duration_years REAL,
  female_factors TEXT, -- JSON array of strings e.g. ["pcos", "tubal_factor"]
  baseline_amh_ng_ml REAL,
  baseline_fsh_miu_ml REAL,
  baseline_afc_total INTEGER,
  hsg_findings TEXT,
  semen_volume_ml REAL,
  semen_concentration_mil_ml REAL,
  semen_total_motility_pct REAL,
  semen_progressive_motility_pct REAL,
  semen_normal_morphology_pct REAL,
  semen_analysis_interpretation TEXT,
  clinical_notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_infertility_workups_patient ON infertility_workups(patient_id);

CREATE TABLE IF NOT EXISTS folliculometry_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  workup_id INTEGER REFERENCES infertility_workups(id) ON DELETE SET NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  lmp_date TEXT NOT NULL,
  protocol_type TEXT NOT NULL DEFAULT 'letrozole' CHECK (protocol_type IN ('natural', 'letrozole', 'clomiphene', 'gonadotropins', 'letrozole_plus_gonadotropins', 'clomiphene_plus_gonadotropins', 'other')),
  protocol_details TEXT,
  planned_procedure TEXT NOT NULL DEFAULT 'timed_intercourse' CHECK (planned_procedure IN ('timed_intercourse', 'iui', 'ivf_referral', 'cancelled')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'ovulated_ruptured', 'completed', 'cancelled')),
  cancellation_reason TEXT,
  trigger_drug TEXT,
  trigger_datetime TEXT,
  advised_tic_iui_datetime TEXT,
  luteal_support TEXT,
  cycle_outcome TEXT DEFAULT 'pending' CHECK (cycle_outcome IN ('pending', 'not_pregnant', 'biochemical_pregnancy', 'clinical_pregnancy', 'ectopic', 'cancelled')),
  outcome_notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folliculometry_cycles_patient ON folliculometry_cycles(patient_id);
CREATE INDEX IF NOT EXISTS idx_folliculometry_cycles_status ON folliculometry_cycles(status);

CREATE TABLE IF NOT EXISTS folliculometry_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES folliculometry_cycles(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scan_datetime TEXT NOT NULL,
  cycle_day INTEGER NOT NULL,
  right_ovary_follicles TEXT, -- JSON array of follicle mm sizes e.g. [18.5, 14.0]
  left_ovary_follicles TEXT,  -- JSON array of follicle mm sizes e.g. [12.0]
  leading_follicle_size_mm REAL,
  leading_follicle_ovary TEXT CHECK (leading_follicle_ovary IN ('right', 'left', 'bilateral', 'none')),
  endometrial_thickness_mm REAL,
  endometrial_pattern TEXT CHECK (endometrial_pattern IN ('trilaminar_a', 'isogenous_b', 'hyperechoic_c', 'irregular')),
  free_fluid_pod INTEGER DEFAULT 0,
  ovulation_rupture_observed INTEGER DEFAULT 0,
  growth_rate_mm_day REAL,
  readiness_stage TEXT CHECK (readiness_stage IN ('baseline', 'early_follicular', 'mid_follicular', 'mature_ready_to_trigger', 'ovulated_corpus_luteum', 'hyperstimulation_risk')),
  clinical_advice TEXT,
  sonographer_notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folliculometry_scans_cycle ON folliculometry_scans(cycle_id);
CREATE INDEX IF NOT EXISTS idx_folliculometry_scans_patient ON folliculometry_scans(patient_id);
