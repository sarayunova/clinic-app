-- Migration 066: Pediatric Diabetic Ketoacidosis (DKA) Resuscitation & Two-Bag Protocol
-- Reference: ISPAD Clinical Practice Consensus Guidelines 2022 (Diabetic Ketoacidosis),
-- PECARN Fluid Resuscitation Trial, and BSPED Pediatric DKA Calculator Standards.

CREATE TABLE IF NOT EXISTS pediatric_dka_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  diagnosis_datetime                  TEXT NOT NULL,
  child_weight_kg                     REAL NOT NULL,
  child_height_cm                     REAL,
  initial_blood_glucose_mg_dl         REAL NOT NULL,
  venous_ph                           REAL NOT NULL,
  serum_bicarbonate_mmol_l            REAL NOT NULL,
  serum_beta_hydroxybutyrate_mmol_l   REAL,
  ketones_urine_or_blood              TEXT NOT NULL CHECK (ketones_urine_or_blood IN ('moderate_2_plus', 'large_3_plus', 'beta_hydroxybutyrate_gte_3')),
  dka_severity                        TEXT NOT NULL CHECK (dka_severity IN ('mild_ph_7_20_7_29', 'moderate_ph_7_10_7_19', 'severe_ph_lt_7_10')),
  estimated_dehydration_percent       REAL NOT NULL, -- e.g. 5% mild/mod, 7-10% severe
  total_fluid_deficit_ml              REAL NOT NULL,
  maintenance_fluid_ml_day            REAL NOT NULL,
  initial_saline_bolus_ml             REAL NOT NULL, -- 10-20 mL/kg 0.9% NS over 1 hr
  rehydration_rate_ml_hr              REAL NOT NULL, -- Deficit + Maintenance evenly over 48 hrs
  insulin_infusion_rate_u_kg_hr       REAL NOT NULL DEFAULT 0.05, -- 0.05 to 0.10 U/kg/hr (No bolus)
  two_bag_system_active               INTEGER NOT NULL DEFAULT 1,
  status                              TEXT NOT NULL DEFAULT 'active_resuscitation' CHECK (status IN (
                                        'active_resuscitation', 'ketoacidosis_resolved_subcutaneous_bridged', 'completed', 'discontinued'
                                      )),
  attending_pediatrician_id           INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dka_patient ON pediatric_dka_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_dka_severity ON pediatric_dka_episodes(dka_severity);
CREATE INDEX IF NOT EXISTS idx_dka_status ON pediatric_dka_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_dka_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  dka_episode_id                      INTEGER NOT NULL REFERENCES pediatric_dka_episodes(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_on_protocol                   REAL NOT NULL,
  blood_glucose_mg_dl                 REAL NOT NULL,
  venous_ph                           REAL,
  serum_bicarbonate_mmol_l            REAL,
  serum_sodium_meq_l                  REAL,
  corrected_sodium_meq_l              REAL, -- Na + 1.6 * ((glucose - 100) / 100)
  serum_potassium_meq_l               REAL,
  effective_serum_osmolality_mosm_kg  REAL,
  anion_gap_mmol_l                    REAL, -- Na - (Cl + HCO3)
  bag_1_rate_ml_hr                    REAL NOT NULL DEFAULT 0.0, -- Normal Saline / Electrolyte solution
  bag_2_rate_ml_hr                    REAL NOT NULL DEFAULT 0.0, -- 10% Dextrose with electrolytes
  insulin_infusion_units_hr           REAL NOT NULL,
  glasgow_coma_scale_score            INTEGER NOT NULL CHECK (glasgow_coma_scale_score BETWEEN 3 AND 15),
  neurological_headache_vomiting      INTEGER NOT NULL DEFAULT 0,
  cushing_triad_warning               INTEGER NOT NULL DEFAULT 0, -- Bradycardia, hypertension, irregular breathing
  emergency_hyperosmolar_saline_given INTEGER NOT NULL DEFAULT 0, -- 3% Saline or Mannitol given for cerebral edema
  urine_output_ml_kg_hr               REAL,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flowsheet_dka ON pediatric_dka_flowsheet_logs(dka_episode_id);
