-- Migration 094: Neonatal Hypocalcemia, Hypomagnesemia & Electrolyte Emergencies Protocol
-- References: AAP / NICE Neonatal Guidelines; Gomella's Neonatology (8th Ed); Pediatric Endocrine Society

CREATE TABLE IF NOT EXISTS neonatal_hypocalcemia_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  chronological_age_hours INTEGER NOT NULL,
  onset_timing TEXT NOT NULL CHECK(onset_timing IN ('early_onset_le_72h', 'late_onset_gt_72h')),
  etiology_category TEXT NOT NULL CHECK(etiology_category IN (
    'prematurity_respiratory_distress',
    'infant_of_diabetic_mother_idm',
    'birth_asphyxia_hie',
    'maternal_hyperparathyroidism',
    'hypoparathyroidism_digeorge',
    'high_phosphate_formula',
    'hypomagnesemia_induced',
    'idiopathic_other'
  )),

  -- Laboratory Biomarkers
  ionized_calcium_mmol_l REAL NOT NULL,
  total_calcium_mg_dl REAL NOT NULL,
  serum_magnesium_mg_dl REAL NOT NULL,
  serum_phosphorus_mg_dl REAL,
  serum_albumin_g_dl REAL,
  alkaline_phosphatase_u_l REAL,

  -- Symptoms & ECG
  symptoms_present INTEGER NOT NULL DEFAULT 0 CHECK(symptoms_present IN (0, 1)),
  symptom_details TEXT NOT NULL CHECK(symptom_details IN (
    'asymptomatic',
    'jitteriness_hyperreflexia',
    'tetany_carpopedal_spasm',
    'hypocalcemic_seizures',
    'apnea_cyanosis',
    'lethargy_poor_feeding'
  )),
  ecg_qtc_seconds REAL,
  ecg_prolonged_qtc INTEGER NOT NULL DEFAULT 0 CHECK(ecg_prolonged_qtc IN (0, 1)),

  -- Protocol Calculations & Treatment
  emergency_bolus_indicated INTEGER NOT NULL CHECK(emergency_bolus_indicated IN (0, 1)),
  calcium_gluconate_10pct_bolus_ml REAL NOT NULL,
  calcium_gluconate_maintenance_mg_kg_day REAL NOT NULL,
  concurrent_hypomagnesemia INTEGER NOT NULL CHECK(concurrent_hypomagnesemia IN (0, 1)),
  magnesium_sulfate_50pct_dose_ml REAL,

  status TEXT NOT NULL DEFAULT 'acute_iv_correction' CHECK(status IN (
    'acute_iv_correction',
    'maintenance_infusion_weaning',
    'transitioned_to_oral_supplements',
    'eucalcemic_resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_hypocalcemia_patient ON neonatal_hypocalcemia_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_hypocalcemia_status ON neonatal_hypocalcemia_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_hypocalcemia_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hypocalcemia_episode_id INTEGER NOT NULL REFERENCES neonatal_hypocalcemia_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_initiation REAL NOT NULL DEFAULT 0,
  heart_rate_bpm INTEGER NOT NULL,
  ionized_calcium_mmol_l REAL NOT NULL,
  total_calcium_mg_dl REAL,
  serum_magnesium_mg_dl REAL,
  calcium_infusion_rate_ml_hr REAL NOT NULL DEFAULT 0,
  iv_site_condition TEXT NOT NULL CHECK(iv_site_condition IN (
    'patent_no_extravasation',
    'mild_erythema_monitored',
    'extravasation_infusion_stopped'
  )),
  clinical_neuromuscular_state TEXT NOT NULL CHECK(clinical_neuromuscular_state IN (
    'normal_tone_calm',
    'mild_tremor_on_handling',
    'marked_jitteriness',
    'active_seizure'
  )),
  ecg_rhythm_strip TEXT NOT NULL CHECK(ecg_rhythm_strip IN (
    'normal_sinus_rhythm',
    'sinus_bradycardia',
    'qtc_prolongation_improving',
    'arrhythmia_noted'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_hypocalcemia_logs_ep ON neonatal_hypocalcemia_flowsheet_logs(hypocalcemia_episode_id);
