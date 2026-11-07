-- Migration 036: Pediatric WHO Child Growth Standards (Z-Scores) & Developmental Milestones Tracker
-- Implements WHO Growth Standards (Weight-for-Age, Length/Height-for-Age, Weight-for-Height/Length, BMI-for-Age, HC-for-Age)
-- with Z-scores (-3 SD to +3 SD) and IAP/Denver-II 4-domain developmental milestones.

ALTER TABLE patient_pediatric_profiles ADD COLUMN sex TEXT CHECK(sex IN ('male', 'female'));

CREATE TABLE IF NOT EXISTS pediatric_growth_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_date TEXT NOT NULL,
  age_months NUMERIC NOT NULL,
  sex TEXT NOT NULL CHECK(sex IN ('male', 'female')),
  weight_kg NUMERIC,
  height_length_cm NUMERIC,
  head_circumference_cm NUMERIC,
  bmi NUMERIC,
  weight_for_age_z NUMERIC,
  weight_for_age_status TEXT CHECK(weight_for_age_status IN ('normal', 'underweight', 'severe_underweight', 'overweight')),
  height_for_age_z NUMERIC,
  height_for_age_status TEXT CHECK(height_for_age_status IN ('normal', 'stunting', 'severe_stunting', 'tall')),
  weight_for_height_z NUMERIC,
  weight_for_height_status TEXT CHECK(weight_for_height_status IN ('normal', 'wasting', 'severe_acute_malnutrition', 'overweight', 'obese')),
  hc_for_age_z NUMERIC,
  hc_for_age_status TEXT CHECK(hc_for_age_status IN ('normal', 'microcephaly', 'severe_microcephaly', 'macrocephaly')),
  clinical_notes TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pediatric_growth_patient_date ON pediatric_growth_records(patient_id, recorded_date DESC);

CREATE TABLE IF NOT EXISTS pediatric_milestone_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  milestone_title TEXT NOT NULL,
  domain TEXT NOT NULL CHECK(domain IN ('gross_motor', 'fine_motor_adaptive', 'language_hearing', 'personal_social')),
  expected_age_months NUMERIC NOT NULL,
  upper_limit_age_months NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_tested' CHECK(status IN ('achieved', 'emerging', 'delayed', 'not_tested')),
  achieved_date TEXT,
  age_achieved_months NUMERIC,
  is_red_flag INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(patient_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_pediatric_milestones_patient ON pediatric_milestone_evaluations(patient_id, expected_age_months);
