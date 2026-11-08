-- Migration 101: Obstetric Peripartum Cardiomyopathy (PPCM) & Acute Heart Failure Protocol
-- References: ESC Guidelines for Cardiovascular Diseases during Pregnancy; ACOG Practice Bulletin; HFA PPCM Registry

CREATE TABLE IF NOT EXISTS obstetric_ppcm_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  presentation_datetime TEXT NOT NULL,
  timing_category TEXT NOT NULL CHECK(timing_category IN (
    'antepartum_late_third_trimester',
    'postpartum_first_month',
    'postpartum_months_2_to_5'
  )),
  maternal_age INTEGER,
  gestational_age_weeks REAL,
  days_postpartum INTEGER,

  -- Echocardiography & Hemodynamic Criteria
  nyha_class TEXT NOT NULL CHECK(nyha_class IN ('class_i', 'class_ii', 'class_iii', 'class_iv')),
  lvef_percent REAL NOT NULL,
  lvedd_mm REAL,
  nt_probnp_pg_ml REAL,
  troponin_i_ng_ml REAL,
  pulmonary_edema_present INTEGER NOT NULL DEFAULT 0 CHECK(pulmonary_edema_present IN (0, 1)),
  cardiogenic_shock_present INTEGER NOT NULL DEFAULT 0 CHECK(cardiogenic_shock_present IN (0, 1)),

  -- BOARD Protocol: Bromocriptine & Prolactin Blockade
  bromocriptine_regimen TEXT NOT NULL DEFAULT 'none' CHECK(bromocriptine_regimen IN (
    'none',
    'standard_2_5mg_daily_1week',
    'intensive_2_5mg_bid_2weeks_then_daily_6weeks'
  )),
  bromocriptine_initiated INTEGER NOT NULL DEFAULT 0 CHECK(bromocriptine_initiated IN (0, 1)),

  -- Anticoagulation Safety Auditing (MANDATORY with Bromocriptine / LVEF <= 35%)
  anticoagulation_prescribed INTEGER NOT NULL DEFAULT 0 CHECK(anticoagulation_prescribed IN (0, 1)),
  anticoagulation_agent TEXT NOT NULL DEFAULT 'none' CHECK(anticoagulation_agent IN (
    'none',
    'lmwh_prophylactic',
    'lmwh_therapeutic',
    'warfarin_therapeutic_postpartum_only',
    'unfractionated_heparin'
  )),

  -- Standard Heart Failure Pharmacotherapy
  loop_diuretic_given INTEGER NOT NULL DEFAULT 0 CHECK(loop_diuretic_given IN (0, 1)),
  beta_blocker_given INTEGER NOT NULL DEFAULT 0 CHECK(beta_blocker_given IN (0, 1)),
  vasodilator_agent TEXT NOT NULL DEFAULT 'none' CHECK(vasodilator_agent IN (
    'none',
    'hydralazine_nitrates_pregnancy_safe',
    'acei_arb_arni_strictly_postpartum_non_lactating',
    'nitroprusside_icu_only'
  )),

  status TEXT NOT NULL DEFAULT 'acute_decompensation' CHECK(status IN (
    'acute_decompensation',
    'icu_mechanical_support',
    'stabilized_on_board_protocol',
    'recovered_ejection_fraction'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_ppcm_patient ON obstetric_ppcm_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_ppcm_status ON obstetric_ppcm_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_ppcm_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ppcm_episode_id INTEGER NOT NULL REFERENCES obstetric_ppcm_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_presentation REAL NOT NULL DEFAULT 0,

  heart_rate_bpm INTEGER NOT NULL,
  blood_pressure_sys INTEGER NOT NULL,
  blood_pressure_dia INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,
  oxygen_requirement_l_min REAL NOT NULL DEFAULT 0,
  urine_output_ml_hr REAL NOT NULL DEFAULT 0,
  fluid_balance_cumulative_ml REAL NOT NULL DEFAULT 0,
  orthopnea_pillows INTEGER NOT NULL DEFAULT 1,
  inotropic_support TEXT NOT NULL DEFAULT 'none' CHECK(inotropic_support IN (
    'none',
    'dobutamine',
    'milrinone',
    'norepinephrine'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_ppcm_flowsheet_ep ON obstetric_ppcm_flowsheet_logs(ppcm_episode_id);
