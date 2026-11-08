-- Migration 093: Pediatric Supraventricular Tachycardia (SVT) & Emergency Dysrhythmia Protocol
-- References: AHA / AAP Pediatric Advanced Life Support (PALS 2020); Pediatric & Congenital Electrophysiology Society (PACES)

CREATE TABLE IF NOT EXISTS pediatric_svt_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  onset_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,

  -- Dysrhythmia Presentation & ECG
  heart_rate_bpm INTEGER NOT NULL,
  qrs_duration_ms INTEGER NOT NULL,
  qrs_morphology TEXT NOT NULL CHECK(qrs_morphology IN (
    'narrow_complex_le_0_09s',
    'wide_complex_aberrancy_gt_0_09s'
  )),
  rhythm_regularity TEXT NOT NULL CHECK(rhythm_regularity IN ('regular', 'irregular')),
  p_waves_identifiable INTEGER NOT NULL DEFAULT 0 CHECK(p_waves_identifiable IN (0, 1)),
  svt_confirmed INTEGER NOT NULL CHECK(svt_confirmed IN (0, 1)),

  -- Hemodynamic Stability
  hemodynamic_stability TEXT NOT NULL CHECK(hemodynamic_stability IN (
    'stable_compensated',
    'unstable_decompensated_shock'
  )),
  signs_of_shock TEXT NOT NULL CHECK(signs_of_shock IN (
    'poor_perfusion_cap_refill_gt_3s',
    'hypotension',
    'lethargy_altered_mental_status',
    'pulmonary_congestion',
    'none'
  )),

  -- Interventions & Response
  vagal_maneuver_attempted TEXT NOT NULL CHECK(vagal_maneuver_attempted IN (
    'ice_bag_to_face_infant',
    'modified_valsalva_child',
    'none_unstable'
  )),
  vagal_maneuver_successful INTEGER NOT NULL DEFAULT 0 CHECK(vagal_maneuver_successful IN (0, 1)),

  adenosine_first_dose_mg REAL NOT NULL,
  adenosine_first_dose_given INTEGER NOT NULL DEFAULT 0 CHECK(adenosine_first_dose_given IN (0, 1)),
  adenosine_first_dose_successful INTEGER NOT NULL DEFAULT 0 CHECK(adenosine_first_dose_successful IN (0, 1)),

  adenosine_second_dose_mg REAL NOT NULL,
  adenosine_second_dose_given INTEGER NOT NULL DEFAULT 0 CHECK(adenosine_second_dose_given IN (0, 1)),
  adenosine_second_dose_successful INTEGER NOT NULL DEFAULT 0 CHECK(adenosine_second_dose_successful IN (0, 1)),

  synchronized_cardioversion_joules REAL,
  synchronized_cardioversion_delivered INTEGER NOT NULL DEFAULT 0 CHECK(synchronized_cardioversion_delivered IN (0, 1)),
  cardioversion_successful INTEGER NOT NULL DEFAULT 0 CHECK(cardioversion_successful IN (0, 1)),

  maintenance_antiarrhythmic TEXT NOT NULL DEFAULT 'none' CHECK(maintenance_antiarrhythmic IN (
    'none',
    'amiodarone_infusion',
    'procainamide_infusion',
    'esmolol_infusion',
    'oral_propranolol'
  )),

  status TEXT NOT NULL DEFAULT 'acute_svt_resuscitation' CHECK(status IN (
    'acute_svt_resuscitation',
    'converted_sinus_surveillance',
    'refractory_picu_transfer',
    'discharged_maintenance_therapy'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_svt_patient ON pediatric_svt_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_svt_status ON pediatric_svt_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_svt_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  svt_episode_id INTEGER NOT NULL REFERENCES pediatric_svt_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_triage INTEGER NOT NULL DEFAULT 0,
  heart_rate_bpm INTEGER NOT NULL,
  rhythm_state TEXT NOT NULL CHECK(rhythm_state IN (
    'svt_active',
    'sinus_rhythm_restored',
    'sinus_bradycardia',
    'junctional_or_other'
  )),
  sbp_mmhg INTEGER NOT NULL,
  dbp_mmhg INTEGER,
  capillary_refill_seconds REAL NOT NULL,
  mental_status TEXT NOT NULL CHECK(mental_status IN (
    'alert_normal',
    'irritable',
    'lethargic',
    'unresponsive'
  )),
  spo2_percent REAL NOT NULL,
  intervention_administered TEXT NOT NULL CHECK(intervention_administered IN (
    'none',
    'ice_bag_to_face',
    'valsalva',
    'adenosine_dose_1',
    'adenosine_dose_2',
    'synchronized_cardioversion',
    'antiarrhythmic_infusion'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_svt_logs_episode ON pediatric_svt_flowsheet_logs(svt_episode_id);
