-- Migration 105: Pediatric Intussusception & Pneumatic / Hydrostatic Reduction Protocol
-- References: ACR Appropriateness Criteria on Intussusception; AAP Pediatric Surgery; BAPS Guidelines

CREATE TABLE IF NOT EXISTS pediatric_intussusception_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  presentation_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL CHECK(age_months >= 1 AND age_months <= 216),
  weight_kg REAL NOT NULL CHECK(weight_kg >= 2.0 AND weight_kg <= 120.0),
  symptom_duration_hours REAL NOT NULL CHECK(symptom_duration_hours >= 0.5 AND symptom_duration_hours <= 240.0),

  -- Clinical Cardinal Signs
  intermittent_colicky_pain INTEGER NOT NULL DEFAULT 1 CHECK(intermittent_colicky_pain IN (0, 1)),
  vomiting_bilious INTEGER NOT NULL DEFAULT 0 CHECK(vomiting_bilious IN (0, 1)),
  red_currant_jelly_stool INTEGER NOT NULL DEFAULT 0 CHECK(red_currant_jelly_stool IN (0, 1)),
  palpable_abdominal_mass INTEGER NOT NULL DEFAULT 0 CHECK(palpable_abdominal_mass IN (0, 1)),
  lethargy_altered_sensorium INTEGER NOT NULL DEFAULT 0 CHECK(lethargy_altered_sensorium IN (0, 1)),

  -- Ultrasound & Plain Radiograph Findings
  ultrasound_target_sign_detected INTEGER NOT NULL DEFAULT 1 CHECK(ultrasound_target_sign_detected IN (0, 1)),
  ultrasound_outer_diameter_mm REAL,
  pseudokidney_sign_present INTEGER NOT NULL DEFAULT 1 CHECK(pseudokidney_sign_present IN (0, 1)),
  pathologic_lead_point_suspected INTEGER NOT NULL DEFAULT 0 CHECK(pathologic_lead_point_suspected IN (0, 1)),
  lead_point_type TEXT NOT NULL CHECK(lead_point_type IN (
    'none_idiopathic',
    'meckels_diverticulum',
    'intestinal_duplication_cyst',
    'polyp',
    'lymphoma_malignancy'
  )) DEFAULT 'none_idiopathic',
  peritonitis_signs_present INTEGER NOT NULL DEFAULT 0 CHECK(peritonitis_signs_present IN (0, 1)),
  pneumoperitoneum_on_xray INTEGER NOT NULL DEFAULT 0 CHECK(pneumoperitoneum_on_xray IN (0, 1)),

  -- Non-Operative Reduction Procedure
  reduction_attempted INTEGER NOT NULL DEFAULT 1 CHECK(reduction_attempted IN (0, 1)),
  reduction_method TEXT NOT NULL CHECK(reduction_method IN (
    'pneumatic_air_enema',
    'hydrostatic_saline_enema',
    'none_primary_surgery'
  )),
  maximum_pressure_mmhg REAL NOT NULL DEFAULT 0 CHECK(maximum_pressure_mmhg >= 0.0 AND maximum_pressure_mmhg <= 160.0),
  reduction_attempts_count INTEGER NOT NULL DEFAULT 1 CHECK(reduction_attempts_count >= 0 AND reduction_attempts_count <= 5),
  reduction_successful INTEGER NOT NULL DEFAULT 0 CHECK(reduction_successful IN (0, 1)),
  cecal_ileal_reflux_visualized INTEGER NOT NULL DEFAULT 0 CHECK(cecal_ileal_reflux_visualized IN (0, 1)),
  surgical_exploration_required INTEGER NOT NULL DEFAULT 0 CHECK(surgical_exploration_required IN (0, 1)),
  surgical_findings TEXT,

  status TEXT NOT NULL DEFAULT 'evaluation_ultrasound' CHECK(status IN (
    'evaluation_ultrasound',
    'reduction_in_progress',
    'reduction_successful_observation',
    'operating_room_exploration',
    'resolved_discharged'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_intuss_patient ON pediatric_intussusception_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_intuss_status ON pediatric_intussusception_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_intussusception_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intussusception_episode_id INTEGER NOT NULL REFERENCES pediatric_intussusception_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_procedure INTEGER NOT NULL DEFAULT 0,

  heart_rate_bpm INTEGER NOT NULL,
  blood_pressure_sys INTEGER NOT NULL,
  blood_pressure_dia INTEGER NOT NULL,
  abdominal_soft_non_tender INTEGER NOT NULL DEFAULT 1 CHECK(abdominal_soft_non_tender IN (0, 1)),
  colicky_pain_recurrence INTEGER NOT NULL DEFAULT 0 CHECK(colicky_pain_recurrence IN (0, 1)),
  oral_intake_tolerated INTEGER NOT NULL DEFAULT 0 CHECK(oral_intake_tolerated IN (0, 1)),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_intuss_flowsheet_ep ON pediatric_intussusception_flowsheet_logs(intussusception_episode_id);
