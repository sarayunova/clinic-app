-- Migration 064: Neonatal Hypoxic-Ischemic Encephalopathy (HIE) & Therapeutic Hypothermia (TTM)
-- Reference: Sarnat & Sarnat Staging (1976), TOBY / CoolCap Trial Criteria,
-- and NNF Neonatal Therapeutic Hypothermia Clinical Practice Guidelines.

CREATE TABLE IF NOT EXISTS neonatal_hie_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_code                     TEXT NOT NULL UNIQUE,
  birth_datetime                      TEXT NOT NULL,
  assessment_datetime                 TEXT NOT NULL,
  gestational_age_weeks               REAL NOT NULL,
  birth_weight_kg                     REAL NOT NULL,
  apgar_10m                           INTEGER,
  resuscitation_duration_minutes      INTEGER,
  cord_or_arterial_ph                 REAL,
  base_deficit_mmol_l                 REAL,
  sarnat_stage                        TEXT NOT NULL CHECK (sarnat_stage IN ('stage_I_mild', 'stage_II_moderate', 'stage_III_severe')),
  level_of_consciousness              TEXT NOT NULL CHECK (level_of_consciousness IN ('hyperalert', 'lethargic_obtunded', 'stuporous_comatose')),
  muscle_tone                         TEXT NOT NULL CHECK (muscle_tone IN ('normal', 'hypotonic', 'flaccid')),
  primitive_reflexes_suck_moro        TEXT NOT NULL CHECK (primitive_reflexes_suck_moro IN ('normal_exaggerated', 'weak_incomplete', 'absent')),
  autonomic_function                  TEXT NOT NULL CHECK (autonomic_function IN ('normal', 'sympathetic_parasympathetic_skew', 'depressed_bradycardia')),
  clinical_seizures_present           INTEGER NOT NULL DEFAULT 0,
  cooling_criteria_met                INTEGER NOT NULL DEFAULT 0, -- 1 = Meets physiological & neurological criteria
  hours_from_birth_to_cooling         REAL, -- Must be <= 6.0 hours for optimal neuroprotection
  cooling_device_type                 TEXT NOT NULL DEFAULT 'servo_controlled_cooling_blanket' CHECK (cooling_device_type IN (
                                        'servo_controlled_cooling_blanket', 'selective_head_cooling_cap', 'phase_change_material_mattress'
                                      )),
  target_core_temp_celsius            REAL NOT NULL DEFAULT 33.5,
  protocol_status                     TEXT NOT NULL DEFAULT 'cooling_active' CHECK (protocol_status IN (
                                        'eligible_pending', 'cooling_active', 'rewarming_phase', 'completed_normothermia', 'discontinued'
                                      )),
  cooling_started_at                  TEXT,
  rewarming_started_at                TEXT,
  protocol_completed_at               TEXT,
  consultant_neonatologist_id         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hie_patient ON neonatal_hie_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_hie_stage ON neonatal_hie_assessments(sarnat_stage);
CREATE INDEX IF NOT EXISTS idx_hie_status ON neonatal_hie_assessments(protocol_status);

CREATE TABLE IF NOT EXISTS neonatal_ttm_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  hie_assessment_id                   INTEGER NOT NULL REFERENCES neonatal_hie_assessments(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_into_protocol                 REAL NOT NULL, -- 0 to 72 (cooling), 72 to 78 (rewarming)
  phase                               TEXT NOT NULL CHECK (phase IN ('induction', 'maintenance_cooling', 'controlled_rewarming', 'post_cooling_normothermia')),
  core_temperature_celsius            REAL NOT NULL, -- Target 33.5°C during maintenance, +0.5°C/hr during rewarming
  skin_temperature_celsius            REAL,
  heart_rate_bpm                      INTEGER NOT NULL,
  mean_arterial_pressure_mmhg         REAL,
  blood_glucose_mg_dl                 REAL,
  serum_potassium_meq_l               REAL,
  aeeg_background_pattern             TEXT CHECK (aeeg_background_pattern IN (
                                        'continuous_normal_voltage_cnv',
                                        'discontinuous_normal_voltage_dnv',
                                        'continuous_low_voltage_clv',
                                        'burst_suppression_bs',
                                        'flat_trace_ft'
                                      )),
  aeeg_sleep_wake_cycling             INTEGER NOT NULL DEFAULT 0,
  electrographic_seizures_detected    INTEGER NOT NULL DEFAULT 0,
  anticonvulsant_administered         TEXT,
  inotropic_support                   TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ttm_hie ON neonatal_ttm_flowsheet_logs(hie_assessment_id);
