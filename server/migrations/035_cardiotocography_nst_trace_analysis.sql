-- Migration 035: Non-Stress Test (NST) & Cardiotocography (CTG) Analysis
-- Implements FIGO 2015 Guidelines, ACOG / NICHD 3-Tier Classification,
-- FHR morphology (Baseline, Variability, Accelerations, Decelerations),
-- Uterine contraction frequency / Tachysystole detection,
-- Intrauterine resuscitation bundle, and digital trace plotting.

CREATE TABLE IF NOT EXISTS ctg_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL DEFAULT 'antenatal_nst' CHECK(test_type IN ('antenatal_nst', 'intrapartum_continuous', 'intrapartum_intermittent', 'oxytocin_challenge_test')),
  performed_at TEXT NOT NULL,
  gestational_age_weeks NUMERIC,
  indication TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  paper_speed_cm_min NUMERIC NOT NULL DEFAULT 1.0,
  baseline_fhr_bpm INTEGER NOT NULL,
  variability_category TEXT NOT NULL CHECK(variability_category IN ('absent', 'minimal', 'moderate', 'marked', 'sinusoidal')),
  variability_amplitude_bpm NUMERIC,
  accelerations_count INTEGER NOT NULL DEFAULT 0,
  accelerations_criteria TEXT NOT NULL DEFAULT '15x15' CHECK(accelerations_criteria IN ('15x15', '10x10')),
  decelerations_type TEXT NOT NULL DEFAULT 'none' CHECK(decelerations_type IN ('none', 'early', 'variable_uncomplicated', 'variable_complicated', 'late', 'prolonged')),
  decelerations_recurrent INTEGER NOT NULL DEFAULT 0,
  decelerations_details TEXT,
  uterine_contractions_per_10min NUMERIC NOT NULL DEFAULT 0,
  tachysystole_present INTEGER NOT NULL DEFAULT 0,
  fetal_movement_felt INTEGER NOT NULL DEFAULT 1,
  vibroacoustic_stimulation_done INTEGER NOT NULL DEFAULT 0,
  vas_response TEXT,
  nst_classification TEXT NOT NULL CHECK(nst_classification IN ('reactive', 'non_reactive', 'equivocal_unsatisfactory')),
  figo_classification TEXT NOT NULL CHECK(figo_classification IN ('normal', 'suspicious', 'pathological')),
  nichd_category TEXT NOT NULL CHECK(nichd_category IN ('category_1_normal', 'category_2_indeterminate', 'category_3_abnormal')),
  intrauterine_resuscitation_required INTEGER NOT NULL DEFAULT 0,
  resuscitation_measures TEXT,
  clinical_action_plan TEXT,
  recommended_follow_up TEXT,
  fhr_trace_data_json TEXT,
  notes TEXT,
  performed_by INTEGER REFERENCES users(id),
  reviewed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ctg_episodes_patient_date ON ctg_episodes(patient_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctg_episodes_admission ON ctg_episodes(admission_id);
