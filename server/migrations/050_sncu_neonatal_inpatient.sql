-- Migration 050: Special Newborn Care Unit (SNCU / Level-2 NICU) Clinical Tracker
-- High-risk neonatal inpatient admission, Silverman-Anderson & Downes respiratory distress scores,
-- CPAP & oxygen flowsheet, phototherapy tracking, neonatal fluid & caloric calculations, and KMC logger.

CREATE TABLE IF NOT EXISTS sncu_admissions (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  admission_datetime                  TEXT NOT NULL, -- YYYY-MM-DDTHH:MM:SS
  birth_weight_g                      REAL NOT NULL,
  gestational_age_weeks               INTEGER NOT NULL,
  gestational_age_days                INTEGER NOT NULL,
  admission_indication                TEXT NOT NULL CHECK (admission_indication IN (
                                        'prematurity_lbw', 'respiratory_distress', 'neonatal_sepsis',
                                        'hypoglycemia', 'hyperbilirubinemia_severe', 'perinatal_asphyxia',
                                        'feeding_difficulty', 'congenital_anomaly', 'other'
                                      )),

  -- Respiratory Support & Distress Scores
  respiratory_support                 TEXT NOT NULL DEFAULT 'room_air' CHECK (respiratory_support IN (
                                        'room_air', 'low_flow_nasal_prongs', 'bubble_cpap',
                                        'high_flow_nasal_cannula', 'mechanical_ventilation'
                                      )),
  fio2_percent                        REAL DEFAULT 21.0,
  peep_cm_h2o                         REAL,
  flow_rate_l_min                     REAL,
  silverman_anderson_score            INTEGER CHECK (silverman_anderson_score IS NULL OR silverman_anderson_score BETWEEN 0 AND 10),
  downes_score                        INTEGER CHECK (downes_score IS NULL OR downes_score BETWEEN 0 AND 10),

  -- Phototherapy & Thermoregulation
  phototherapy_status                 TEXT NOT NULL DEFAULT 'none' CHECK (phototherapy_status IN (
                                        'none', 'single_surface_led', 'double_surface_led', 'biliblanket'
                                      )),
  kmc_duration_hours_today            REAL DEFAULT 0,
  temperature_celsius                 REAL,

  -- Fluid & Nutritional Calculations
  current_weight_g                    REAL,
  total_fluid_goal_ml_kg_day          REAL,
  feeding_mode                        TEXT NOT NULL DEFAULT 'npo_iv_fluids' CHECK (feeding_mode IN (
                                        'npo_iv_fluids', 'og_tube_ebm', 'paladai_ebm',
                                        'direct_breastfeeding', 'formula'
                                      )),
  feeding_volume_ml                   REAL,
  feeding_frequency_hours             INTEGER DEFAULT 2,
  iv_fluid_type_rate                  TEXT,
  daily_weight_gain_g_kg_day          REAL,

  -- Vitals & Metabolic Surveillance
  heart_rate_bpm                      INTEGER,
  respiratory_rate_bpm                INTEGER,
  spo2_percent                        REAL,
  capillary_blood_glucose_mg_dl       REAL,
  antibiotic_regimen                  TEXT,
  clinical_notes                      TEXT,

  -- Discharge & Status
  status                              TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN (
                                        'admitted', 'transferred_tertiary_nicu', 'discharged_to_mother',
                                        'discharged_home', 'deceased'
                                      )),
  discharge_datetime                  TEXT,
  discharge_weight_g                  REAL,

  attending_pediatrician              TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sncu_patient ON sncu_admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sncu_status ON sncu_admissions(status);
