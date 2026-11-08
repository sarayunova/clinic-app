-- Migration 114: Pediatric Infantile Hypertrophic Pyloric Stenosis (IHPS) & Metabolic Alkalosis Resuscitation Protocol
-- Reference: APSA Guidelines / British Association of Paediatric Surgeons (BAPS) Consensus on IHPS Resuscitation

CREATE TABLE IF NOT EXISTS pediatric_pyloric_stenosis_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  presentation_datetime               TEXT NOT NULL,
  age_weeks                           REAL NOT NULL,
  weight_kg                           REAL NOT NULL,
  birth_weight_kg                     REAL NOT NULL,
  vomiting_projectile_non_bilious     INTEGER NOT NULL DEFAULT 1 CHECK (vomiting_projectile_non_bilious IN (0, 1)),
  hungry_vomiter_behavior             INTEGER NOT NULL DEFAULT 1 CHECK (hungry_vomiter_behavior IN (0, 1)),
  palpable_olive_mass                 INTEGER NOT NULL DEFAULT 0 CHECK (palpable_olive_mass IN (0, 1)),
  visible_gastric_peristalsis         INTEGER NOT NULL DEFAULT 0 CHECK (visible_gastric_peristalsis IN (0, 1)),
  dehydration_percentage              REAL NOT NULL DEFAULT 5.0, -- e.g. 5%, 10%
  ultrasound_performed                INTEGER NOT NULL DEFAULT 1 CHECK (ultrasound_performed IN (0, 1)),
  pyloric_muscle_thickness_mm         REAL, -- >= 3.0 mm is diagnostic
  pyloric_channel_length_mm           REAL, -- >= 14-15 mm is diagnostic
  pyloric_transverse_diameter_mm      REAL,
  ultrasound_diagnostic_target_sign   INTEGER NOT NULL DEFAULT 1 CHECK (ultrasound_diagnostic_target_sign IN (0, 1)),
  serum_sodium_meq_l                  REAL NOT NULL,
  serum_potassium_meq_l               REAL NOT NULL,
  serum_chloride_meq_l                REAL NOT NULL, -- hypochloremia < 98-100
  serum_bicarbonate_meq_l             REAL NOT NULL, -- alkalosis > 28-30
  blood_ph                            REAL NOT NULL, -- alkalemia > 7.45
  urine_output_ml_kg_hr               REAL NOT NULL DEFAULT 0.0,
  fluid_resuscitation_rate_ml_hr      REAL,
  potassium_supplementation_started   INTEGER NOT NULL DEFAULT 0 CHECK (potassium_supplementation_started IN (0, 1)),
  preop_electrolytes_normalized       INTEGER NOT NULL DEFAULT 0 CHECK (preop_electrolytes_normalized IN (0, 1)),
  surgical_clearance_granted          INTEGER NOT NULL DEFAULT 0 CHECK (surgical_clearance_granted IN (0, 1)),
  surgery_performed                   INTEGER NOT NULL DEFAULT 0 CHECK (surgery_performed IN (0, 1)),
  pyloromyotomy_technique             TEXT CHECK (pyloromyotomy_technique IN (
                                        'laparoscopic_ramstedt',
                                        'open_right_upper_quadrant',
                                        'open_circumumbilical_tan_bianchi'
                                      )),
  postop_feeding_started              INTEGER NOT NULL DEFAULT 0 CHECK (postop_feeding_started IN (0, 1)),
  status                              TEXT NOT NULL DEFAULT 'preop_fluid_resuscitation' CHECK (status IN (
                                        'preop_fluid_resuscitation',
                                        'metabolically_cleared_for_or',
                                        'surgery_in_progress',
                                        'postop_feeding_advancement',
                                        'resolved_discharged'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_pyloric_patient ON pediatric_pyloric_stenosis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_pyloric_status ON pediatric_pyloric_stenosis_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_pyloric_stenosis_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  pyloric_episode_id                  INTEGER NOT NULL REFERENCES pediatric_pyloric_stenosis_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_from_admission                INTEGER NOT NULL,
  serum_sodium_meq_l                  REAL,
  serum_potassium_meq_l               REAL,
  serum_chloride_meq_l                REAL,
  serum_bicarbonate_meq_l             REAL,
  blood_ph                            REAL,
  urine_output_ml_kg_hr               REAL NOT NULL,
  iv_fluid_rate_ml_hr                 REAL NOT NULL,
  capillary_refill_seconds            REAL,
  vomiting_episodes_count             INTEGER NOT NULL DEFAULT 0,
  gastric_decompression_output_ml     REAL,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pyloric_logs_episode ON pediatric_pyloric_stenosis_flowsheet_logs(pyloric_episode_id);
