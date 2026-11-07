-- Migration 044: Labor Induction & Modified Bishop Score Cervical Ripening Optimizer
-- Evidence-based cervical readiness evaluation, mechanical vs pharmacological ripening selection,
-- oxytocin titration, and induction progression tracking compliant with ACOG / NICE guidelines.

CREATE TABLE IF NOT EXISTS labor_induction_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  initiation_date                     TEXT NOT NULL, -- YYYY-MM-DD
  initiation_time                     TEXT, -- HH:MM
  gestational_age_weeks               INTEGER NOT NULL,
  gestational_age_days                INTEGER NOT NULL DEFAULT 0,
  indication                          TEXT NOT NULL CHECK (indication IN ('post_dates', 'preeclampsia_gest_htn', 'prom_rom', 'oligohydramnios', 'fgr_placental', 'gdm_diabetes', 'maternal_medical', 'elective_39w', 'other')),
  indication_details                  TEXT,
  parity                              TEXT NOT NULL CHECK (parity IN ('nulliparous', 'multiparous')),
  previous_cesarean                   INTEGER NOT NULL DEFAULT 0 CHECK (previous_cesarean IN (0, 1)),
  previous_cesarean_count             INTEGER NOT NULL DEFAULT 0,

  -- Baseline Modified Bishop Score (Dilation, Effacement, Station, Consistency, Position)
  dilation_cm                         REAL NOT NULL, -- 0 to 10
  effacement_percent                  INTEGER NOT NULL, -- 0 to 100
  fetal_station                       INTEGER NOT NULL, -- -3 to +3
  consistency                         TEXT NOT NULL CHECK (consistency IN ('firm', 'medium', 'soft')),
  position                            TEXT NOT NULL CHECK (position IN ('posterior', 'mid', 'anterior')),
  bishop_score_total                  INTEGER NOT NULL, -- 0 to 13
  cervical_favorability               TEXT NOT NULL CHECK (cervical_favorability IN ('unfavorable_le_5', 'intermediate_6_7', 'favorable_ge_8')),

  -- Selected Ripening & Induction Method
  ripening_method                     TEXT NOT NULL CHECK (ripening_method IN ('foley_bulb_mechanical', 'cook_double_balloon', 'dinoprostone_pge2_tape', 'dinoprostone_pge2_gel', 'misoprostol_pge1_oral', 'misoprostol_pge1_vaginal', 'direct_arm_oxytocin', 'none')),
  ripening_dose_details               TEXT,
  contraindications_checked           INTEGER NOT NULL DEFAULT 1 CHECK (contraindications_checked IN (0, 1)),

  -- Oxytocin Infusion Details
  oxytocin_used                       INTEGER NOT NULL DEFAULT 0 CHECK (oxytocin_used IN (0, 1)),
  oxytocin_start_time                 TEXT,
  oxytocin_start_rate_m_u_min         REAL,
  oxytocin_max_rate_m_u_min           REAL,
  arm_performed                       INTEGER NOT NULL DEFAULT 0 CHECK (arm_performed IN (0, 1)),
  arm_time                            TEXT,
  liquor_status                       TEXT CHECK (liquor_status IS NULL OR liquor_status IN ('clear', 'meconium_grade_1', 'meconium_grade_2', 'meconium_grade_3', 'blood_stained')),

  -- Serial Bishop Assessments JSON array
  serial_bishop_json                  TEXT NOT NULL DEFAULT '[]',

  -- Complications & Outcome
  tachysystole_detected               INTEGER NOT NULL DEFAULT 0 CHECK (tachysystole_detected IN (0, 1)),
  uterine_hyperstimulation_action     TEXT,
  induction_outcome                   TEXT NOT NULL DEFAULT 'in_progress' CHECK (induction_outcome IN ('in_progress', 'vaginal_delivery', 'emergency_cesarean_fetal_distress', 'emergency_cesarean_failed_induction', 'emergency_cesarean_arrest', 'assisted_vacuum_forceps')),
  induction_to_delivery_hours         REAL,
  clinical_notes                      TEXT,

  performed_by                        TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_induction_patient ON labor_induction_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_induction_date ON labor_induction_episodes(initiation_date);
CREATE INDEX IF NOT EXISTS idx_induction_outcome ON labor_induction_episodes(induction_outcome);
