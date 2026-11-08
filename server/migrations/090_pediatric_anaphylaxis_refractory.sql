-- Migration 090: Pediatric Anaphylaxis Emergency Resuscitation & Refractory Shock
-- References: World Allergy Organization (WAO 2020); EAACI Guidelines; AAP Pediatric Anaphylaxis Clinical Practice Guidance

CREATE TABLE IF NOT EXISTS pediatric_anaphylaxis_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  triage_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN (
    'food_peanut_nut_milk_egg',
    'insect_venom_bee_wasp',
    'medication_antibiotic_nsaid',
    'vaccine_biologic',
    'latex',
    'exercise_or_cold',
    'idiopathic'
  )),
  trigger_details TEXT,

  -- WAO Multi-System Criteria
  skin_mucosal_involvement INTEGER NOT NULL DEFAULT 0 CHECK(skin_mucosal_involvement IN (0, 1)),
  respiratory_compromise INTEGER NOT NULL DEFAULT 0 CHECK(respiratory_compromise IN (0, 1)),
  cardiovascular_hypotension INTEGER NOT NULL DEFAULT 0 CHECK(cardiovascular_hypotension IN (0, 1)),
  persistent_gastrointestinal INTEGER NOT NULL DEFAULT 0 CHECK(persistent_gastrointestinal IN (0, 1)),
  anaphylaxis_criteria_met INTEGER NOT NULL CHECK(anaphylaxis_criteria_met IN (0, 1)),

  -- Severity & Epinephrine Dosing
  severity_tier TEXT NOT NULL CHECK(severity_tier IN ('mild_moderate', 'severe_life_threatening', 'refractory_shock')),
  weight_adjusted_epinephrine_im_dose_mg REAL NOT NULL,
  autoinjector_recommended TEXT NOT NULL CHECK(autoinjector_recommended IN (
    'syringe_drawn',
    'epipen_jr_0_15mg',
    'epipen_adult_0_30mg'
  )),
  im_epinephrine_doses_given INTEGER NOT NULL DEFAULT 1,
  epinephrine_first_dose_datetime TEXT NOT NULL,
  epinephrine_second_dose_datetime TEXT,

  -- Refractory Shock & Advanced Interventions
  refractory_shock_declared INTEGER NOT NULL DEFAULT 0 CHECK(refractory_shock_declared IN (0, 1)),
  iv_epinephrine_infusion_active INTEGER NOT NULL DEFAULT 0 CHECK(iv_epinephrine_infusion_active IN (0, 1)),
  epinephrine_infusion_rate_mcg_kg_min REAL,
  second_line_h1_antihistamine_given INTEGER NOT NULL DEFAULT 0 CHECK(second_line_h1_antihistamine_given IN (0, 1)),
  second_line_h2_antihistamine_given INTEGER NOT NULL DEFAULT 0 CHECK(second_line_h2_antihistamine_given IN (0, 1)),
  systemic_steroid_given INTEGER NOT NULL DEFAULT 0 CHECK(systemic_steroid_given IN (0, 1)),
  glucagon_administered INTEGER NOT NULL DEFAULT 0 CHECK(glucagon_administered IN (0, 1)),
  fluid_bolus_volume_ml REAL NOT NULL DEFAULT 0,
  biphasic_surveillance_recommended_hours INTEGER NOT NULL DEFAULT 6,

  status TEXT NOT NULL DEFAULT 'acute_resuscitation_bay' CHECK(status IN (
    'acute_resuscitation_bay',
    'refractory_picu_infusion',
    'biphasic_surveillance_observation',
    'discharged_auto_injector_prescribed'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_anaphylaxis_patient ON pediatric_anaphylaxis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_anaphylaxis_status ON pediatric_anaphylaxis_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_anaphylaxis_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anaphylaxis_episode_id INTEGER NOT NULL REFERENCES pediatric_anaphylaxis_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_arrival INTEGER NOT NULL DEFAULT 0,
  sbp_mmhg INTEGER NOT NULL,
  dbp_mmhg INTEGER,
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,
  stridor_present INTEGER NOT NULL DEFAULT 0 CHECK(stridor_present IN (0, 1)),
  wheeze_severity TEXT NOT NULL CHECK(wheeze_severity IN ('none', 'mild', 'moderate', 'severe')),
  urticaria_coverage TEXT NOT NULL CHECK(urticaria_coverage IN ('none', 'localized', 'generalized')),
  epinephrine_iv_rate_mcg_kg_min REAL,
  cumulative_im_epinephrine_doses INTEGER NOT NULL DEFAULT 1,
  cumulative_crystalloid_ml REAL NOT NULL DEFAULT 0,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_anaphylaxis_logs_episode ON pediatric_anaphylaxis_flowsheet_logs(anaphylaxis_episode_id);
