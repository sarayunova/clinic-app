-- Migration 028: Newborn Early Warning Score (NEWS / NEWTT) & Golden Minute Neonatal Resuscitation Protocol
-- Comprehensive tracking of 1, 5, 10 min APGAR scores, Silverman-Anderson retraction scores,
-- NRP 8th Edition resuscitation timeline, bedside neonatal hypoglycemia monitoring, and serial NEW-S observations.

CREATE TABLE neonatal_resuscitation_events (
  id                                  INTEGER PRIMARY KEY,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id), -- Mother's patient ID or baby's ID
  baby_patient_id                     INTEGER REFERENCES patients(id) ON DELETE SET NULL, -- Linked child profile if registered
  maternity_admission_id              INTEGER REFERENCES maternity_admissions(id) ON DELETE SET NULL,
  
  -- Delivery Context & Timing
  delivery_timestamp                  TEXT NOT NULL,                            -- ISO-8601
  gestational_age_weeks               INTEGER,
  gestational_age_days                INTEGER,
  birth_weight_grams                  INTEGER,
  baby_gender                         TEXT NOT NULL DEFAULT 'unspecified' CHECK (baby_gender IN ('female', 'male', 'ambiguous', 'unspecified')),
  delivery_mode                       TEXT NOT NULL DEFAULT 'vaginal' CHECK (delivery_mode IN ('vaginal', 'cesarean', 'assisted_vacuum_forceps')),
  liquor_appearance                   TEXT NOT NULL DEFAULT 'clear' CHECK (liquor_appearance IN ('clear', 'meconium_thin', 'meconium_thick', 'blood_stained', 'absent')),
  
  -- APGAR 1-Minute Evaluation
  apgar_1m_heart_rate                 INTEGER NOT NULL DEFAULT 2 CHECK (apgar_1m_heart_rate BETWEEN 0 AND 2),
  apgar_1m_respiratory_effort         INTEGER NOT NULL DEFAULT 2 CHECK (apgar_1m_respiratory_effort BETWEEN 0 AND 2),
  apgar_1m_muscle_tone                INTEGER NOT NULL DEFAULT 2 CHECK (apgar_1m_muscle_tone BETWEEN 0 AND 2),
  apgar_1m_reflex_irritability        INTEGER NOT NULL DEFAULT 2 CHECK (apgar_1m_reflex_irritability BETWEEN 0 AND 2),
  apgar_1m_color                      INTEGER NOT NULL DEFAULT 1 CHECK (apgar_1m_color BETWEEN 0 AND 2),
  apgar_1m_total                      INTEGER NOT NULL DEFAULT 9 CHECK (apgar_1m_total BETWEEN 0 AND 10),

  -- APGAR 5-Minute Evaluation
  apgar_5m_heart_rate                 INTEGER NOT NULL DEFAULT 2 CHECK (apgar_5m_heart_rate BETWEEN 0 AND 2),
  apgar_5m_respiratory_effort         INTEGER NOT NULL DEFAULT 2 CHECK (apgar_5m_respiratory_effort BETWEEN 0 AND 2),
  apgar_5m_muscle_tone                INTEGER NOT NULL DEFAULT 2 CHECK (apgar_5m_muscle_tone BETWEEN 0 AND 2),
  apgar_5m_reflex_irritability        INTEGER NOT NULL DEFAULT 2 CHECK (apgar_5m_reflex_irritability BETWEEN 0 AND 2),
  apgar_5m_color                      INTEGER NOT NULL DEFAULT 2 CHECK (apgar_5m_color BETWEEN 0 AND 2),
  apgar_5m_total                      INTEGER NOT NULL DEFAULT 10 CHECK (apgar_5m_total BETWEEN 0 AND 10),

  -- APGAR 10-Minute Evaluation (Optional / For resuscitation)
  apgar_10m_heart_rate                INTEGER CHECK (apgar_10m_heart_rate IS NULL OR (apgar_10m_heart_rate BETWEEN 0 AND 2)),
  apgar_10m_respiratory_effort        INTEGER CHECK (apgar_10m_respiratory_effort IS NULL OR (apgar_10m_respiratory_effort BETWEEN 0 AND 2)),
  apgar_10m_muscle_tone               INTEGER CHECK (apgar_10m_muscle_tone IS NULL OR (apgar_10m_muscle_tone BETWEEN 0 AND 2)),
  apgar_10m_reflex_irritability       INTEGER CHECK (apgar_10m_reflex_irritability IS NULL OR (apgar_10m_reflex_irritability BETWEEN 0 AND 2)),
  apgar_10m_color                     INTEGER CHECK (apgar_10m_color IS NULL OR (apgar_10m_color BETWEEN 0 AND 2)),
  apgar_10m_total                     INTEGER CHECK (apgar_10m_total IS NULL OR (apgar_10m_total BETWEEN 0 AND 10)),

  -- Silverman-Anderson Retraction Score (SAS) for Respiratory Distress (0-10)
  sas_thoracoabdominal_movement       INTEGER NOT NULL DEFAULT 0 CHECK (sas_thoracoabdominal_movement BETWEEN 0 AND 2),
  sas_intercostal_retraction          INTEGER NOT NULL DEFAULT 0 CHECK (sas_intercostal_retraction BETWEEN 0 AND 2),
  sas_xiphoid_retraction              INTEGER NOT NULL DEFAULT 0 CHECK (sas_xiphoid_retraction BETWEEN 0 AND 2),
  sas_nares_dilation                  INTEGER NOT NULL DEFAULT 0 CHECK (sas_nares_dilation BETWEEN 0 AND 2),
  sas_expiratory_grunt                INTEGER NOT NULL DEFAULT 0 CHECK (sas_expiratory_grunt BETWEEN 0 AND 2),
  sas_total_score                     INTEGER NOT NULL DEFAULT 0 CHECK (sas_total_score BETWEEN 0 AND 10),
  sas_distress_severity               TEXT NOT NULL DEFAULT 'none' CHECK (sas_distress_severity IN ('none', 'mild', 'moderate', 'severe')),

  -- NRP 8th Edition "Golden Minute" & Resuscitation Steps
  initial_steps_completed             INTEGER NOT NULL DEFAULT 1, -- Warm, dry, position sniffing, clear airway, stimulate
  delayed_cord_clamping_seconds       INTEGER DEFAULT 60,         -- Recommended 30-60s in vigorous infant
  temperature_control_method          TEXT NOT NULL DEFAULT 'radiant_warmer' CHECK (temperature_control_method IN (
                                        'skin_to_skin',
                                        'radiant_warmer',
                                        'plastic_wrap_preterm',
                                        'transwarmer_mattress',
                                        'incubator'
                                      )),
  initial_temperature_c               REAL,                       -- Target: 36.5 - 37.5 C
  meconium_management                 TEXT NOT NULL DEFAULT 'not_applicable' CHECK (meconium_management IN (
                                        'not_applicable',
                                        'vigorous_routine_care',
                                        'non_vigorous_bulb_suction',
                                        'endotracheal_suctioning'
                                      )),
  supplemental_oxygen_given           INTEGER NOT NULL DEFAULT 0,
  target_fio2_percent                 INTEGER DEFAULT 21,
  ppv_initiated                       INTEGER NOT NULL DEFAULT 0, -- Positive Pressure Ventilation
  ppv_device                          TEXT CHECK (ppv_device IS NULL OR ppv_device IN ('t_piece_resuscitator', 'self_inflating_bag', 'flow_inflating_bag')),
  ppv_start_seconds                   INTEGER,                    -- Seconds from delivery (aim < 60s)
  mr_sopa_steps_required              INTEGER NOT NULL DEFAULT 0, -- Mask, Reposition, Suction, Open, Pressure, Alt airway
  laryngeal_mask_or_ett_used          TEXT NOT NULL DEFAULT 'none' CHECK (laryngeal_mask_or_ett_used IN ('none', 'lma_size_1', 'ett_oral', 'ett_nasal')),
  chest_compressions_performed        INTEGER NOT NULL DEFAULT 0, -- 3:1 ratio (90 compressions + 30 breaths/min)
  chest_compressions_duration_seconds INTEGER DEFAULT 0,
  epinephrine_given                   INTEGER NOT NULL DEFAULT 0, -- 1:10,000 IV/IO 0.02 mg/kg
  epinephrine_dose_mg                 REAL DEFAULT 0,
  volume_expander_given               INTEGER NOT NULL DEFAULT 0, -- NS 10 mL/kg
  volume_expander_ml                  INTEGER DEFAULT 0,

  -- At-Risk Neonatal Hypoglycemia Monitoring
  at_risk_hypoglycemia                INTEGER NOT NULL DEFAULT 0, -- IDM, SGA, LGA, Preterm, Asphyxia
  hypoglycemia_risk_reason            TEXT,                       -- e.g. "Infant of Diabetic Mother (IDM), BW > 4000g"
  initial_blood_glucose_mg_dl         REAL,
  glucose_management_action           TEXT NOT NULL DEFAULT 'none' CHECK (glucose_management_action IN (
                                        'none',
                                        'early_breastfeeding',
                                        'supplemental_formula_ebm',
                                        'dextrose_10pct_bolus_infusion'
                                      )),

  -- Disposition & Neonatal Outcome
  primary_resuscitation_outcome       TEXT NOT NULL DEFAULT 'routine_maternal_side' CHECK (primary_resuscitation_outcome IN (
                                        'routine_maternal_side',
                                        'postnatal_ward_observation',
                                        'sncu_level_2',
                                        'nicu_level_3',
                                        'neonatal_death'
                                      )),
  cord_blood_gas_ph                   REAL,
  cord_blood_gas_be                   REAL,                       -- Base excess (mmol/L)
  pediatrician_attending              TEXT,
  resuscitation_nurse                 TEXT,
  notes                               TEXT,

  -- Audit & Metadata
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX idx_neonatal_resus_patient ON neonatal_resuscitation_events(patient_id);
CREATE INDEX idx_neonatal_resus_baby ON neonatal_resuscitation_events(baby_patient_id);
CREATE INDEX idx_neonatal_resus_maternity ON neonatal_resuscitation_events(maternity_admission_id);

-- Serial Newborn Early Warning Score (NEWS / NEWTT) Bedside Track-and-Trigger Observations
CREATE TABLE neonatal_news_observations (
  id                                  INTEGER PRIMARY KEY,
  resuscitation_event_id              INTEGER NOT NULL REFERENCES neonatal_resuscitation_events(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  recorded_at                         TEXT NOT NULL,              -- ISO-8601
  postnatal_age_hours                 REAL,
  
  -- Vitals & Score allocations (0-3 each)
  heart_rate_bpm                      INTEGER,
  hr_score                            INTEGER NOT NULL DEFAULT 0 CHECK (hr_score BETWEEN 0 AND 3),
  respiratory_rate_bpm                INTEGER,
  rr_score                            INTEGER NOT NULL DEFAULT 0 CHECK (rr_score BETWEEN 0 AND 3),
  temperature_c                       REAL,
  temp_score                          INTEGER NOT NULL DEFAULT 0 CHECK (temp_score BETWEEN 0 AND 3),
  spo2_percent                        INTEGER,
  spo2_score                          INTEGER NOT NULL DEFAULT 0 CHECK (spo2_score BETWEEN 0 AND 3),
  supplemental_oxygen                 INTEGER NOT NULL DEFAULT 0 CHECK (supplemental_oxygen IN (0, 1)),
  oxygen_score                        INTEGER NOT NULL DEFAULT 0 CHECK (oxygen_score BETWEEN 0 AND 3),

  -- Neurological, Color, and Effort Components
  color                               TEXT NOT NULL DEFAULT 'pink' CHECK (color IN (
                                        'pink',
                                        'acrocyanosis',
                                        'pallor',
                                        'central_cyanosis',
                                        'jaundice_early'
                                      )),
  color_score                         INTEGER NOT NULL DEFAULT 0 CHECK (color_score BETWEEN 0 AND 3),
  tone_neurology                      TEXT NOT NULL DEFAULT 'normal_active' CHECK (tone_neurology IN (
                                        'normal_active',
                                        'mildly_floppy_jittery',
                                        'lethargic_poor_suck',
                                        'severely_hypotonic_seizures'
                                      )),
  tone_score                          INTEGER NOT NULL DEFAULT 0 CHECK (tone_score BETWEEN 0 AND 3),
  grunting_stridor                    TEXT NOT NULL DEFAULT 'none' CHECK (grunting_stridor IN (
                                        'none',
                                        'intermittent_audible_stethoscope',
                                        'persistent_audible_naked_ear'
                                      )),
  grunting_score                      INTEGER NOT NULL DEFAULT 0 CHECK (grunting_score BETWEEN 0 AND 3),

  -- Composite Early Warning Aggregates
  total_news_score                    INTEGER NOT NULL DEFAULT 0,
  alert_severity                      TEXT NOT NULL DEFAULT 'green_low' CHECK (alert_severity IN ('green_low', 'yellow_medium', 'red_high')),
  
  -- Metabolic & Feeding Checks
  blood_glucose_mg_dl                 REAL,
  feeding_status                      TEXT CHECK (feeding_status IS NULL OR feeding_status IN (
                                        'breastfeeding_well',
                                        'poor_latch',
                                        'expressed_breast_milk',
                                        'formula',
                                        'npo_iv_fluids'
                                      )),
  clinical_action_taken               TEXT,
  recorded_by                         INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL
);

CREATE INDEX idx_neonatal_news_event ON neonatal_news_observations(resuscitation_event_id);
CREATE INDEX idx_neonatal_news_patient ON neonatal_news_observations(patient_id);
