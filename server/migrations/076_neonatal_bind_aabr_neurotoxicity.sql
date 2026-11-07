-- Migration 076: Neonatal Hyperbilirubinemia BIND Scoring (Bilirubin-Induced Neurologic Dysfunction) & AABR Hearing Screening
-- AAP 2022 / NICE CG98 / Joint Committee on Infant Hearing (JCIH 2019)

CREATE TABLE IF NOT EXISTS neonatal_bind_aabr_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  assessment_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  peak_tsb_mg_dl REAL NOT NULL,
  direct_bilirubin_mg_dl REAL,
  albumin_g_dl REAL,
  calculated_b_a_ratio REAL,
  mental_status_score INTEGER NOT NULL DEFAULT 0,
  muscle_tone_score INTEGER NOT NULL DEFAULT 0,
  cry_score INTEGER NOT NULL DEFAULT 0,
  total_bind_score INTEGER NOT NULL DEFAULT 0,
  bind_severity TEXT NOT NULL CHECK(bind_severity IN ('normal', 'mild_abe', 'moderate_abe', 'severe_abe')),
  aabr_right_ear TEXT NOT NULL DEFAULT 'not_tested' CHECK(aabr_right_ear IN ('not_tested', 'pass', 'refer')),
  aabr_left_ear TEXT NOT NULL DEFAULT 'not_tested' CHECK(aabr_left_ear IN ('not_tested', 'pass', 'refer')),
  aabr_test_datetime TEXT,
  exchange_transfusion_performed INTEGER NOT NULL DEFAULT 0 CHECK(exchange_transfusion_performed IN (0, 1)),
  ivig_given INTEGER NOT NULL DEFAULT 0 CHECK(ivig_given IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'evaluating' CHECK(status IN (
    'evaluating',
    'under_phototherapy',
    'post_exchange_transfusion',
    'cleared_pass',
    'high_risk_neuro_followup'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  neuro_auditory_followup_plan TEXT,
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_bind_patient ON neonatal_bind_aabr_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_bind_status ON neonatal_bind_aabr_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_bind_serial_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES neonatal_bind_aabr_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_admission REAL NOT NULL DEFAULT 0,
  mental_status_score INTEGER NOT NULL DEFAULT 0 CHECK(mental_status_score BETWEEN 0 AND 3),
  muscle_tone_score INTEGER NOT NULL DEFAULT 0 CHECK(muscle_tone_score BETWEEN 0 AND 3),
  cry_score INTEGER NOT NULL DEFAULT 0 CHECK(cry_score BETWEEN 0 AND 3),
  total_bind_score INTEGER NOT NULL DEFAULT 0 CHECK(total_bind_score BETWEEN 0 AND 9),
  tsb_mg_dl REAL,
  phototherapy_type TEXT DEFAULT 'none',
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_bind_logs_episode ON neonatal_bind_serial_flowsheet_logs(episode_id);
