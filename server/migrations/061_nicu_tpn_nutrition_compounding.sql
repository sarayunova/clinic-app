-- Migration 061: NICU (Level-3) Total Parenteral Nutrition (TPN) & Electrolyte Infusion Compounding Engine
-- Reference: ESPGHAN/ESPEN/ESPR Guidelines on Pediatric Parenteral Nutrition,
-- NNF Clinical Practice Guidelines for ELBW/VLBW Neonates, and ASPEN Precision TPN Compounding Standards.

CREATE TABLE IF NOT EXISTS nicu_tpn_prescriptions (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  prescription_code                   TEXT NOT NULL UNIQUE,
  prescription_date                   TEXT NOT NULL,
  day_of_life                         INTEGER NOT NULL,
  gestational_age_weeks               REAL,
  birth_weight_kg                     REAL NOT NULL,
  current_weight_kg                   REAL NOT NULL,
  target_total_fluid_ml_per_kg_day    REAL NOT NULL,
  enteral_intake_ml_day               REAL NOT NULL DEFAULT 0.0,
  parenteral_fluid_ml_day             REAL NOT NULL,
  dextrose_percent                    REAL NOT NULL,
  glucose_infusion_rate_gir           REAL NOT NULL, -- mg/kg/min
  dextrose_volume_ml                  REAL NOT NULL,
  amino_acid_solution_type            TEXT NOT NULL CHECK (amino_acid_solution_type IN (
                                        'trophamine_6', 'trophamine_10', 'primene_10', 'aminoven_infant_10'
                                      )),
  amino_acid_g_per_kg_day             REAL NOT NULL,
  amino_acid_volume_ml                REAL NOT NULL,
  lipid_emulsion_type                 TEXT NOT NULL CHECK (lipid_emulsion_type IN (
                                        'intralipid_20', 'smoflipid_20', 'lipofundin_20'
                                      )),
  lipid_g_per_kg_day                  REAL NOT NULL,
  lipid_volume_ml                     REAL NOT NULL,
  lipid_infusion_hours                REAL NOT NULL DEFAULT 24.0,
  sodium_meq_per_kg_day               REAL NOT NULL DEFAULT 0.0,
  potassium_meq_per_kg_day            REAL NOT NULL DEFAULT 0.0,
  calcium_gluconate_ml_per_kg_day     REAL NOT NULL DEFAULT 0.0,
  magnesium_sulfate_ml_day            REAL NOT NULL DEFAULT 0.0,
  phosphate_mmol_per_kg_day           REAL NOT NULL DEFAULT 0.0,
  heparin_units_per_ml                REAL NOT NULL DEFAULT 0.5,
  multivitamin_mvi_ml_day             REAL NOT NULL DEFAULT 1.5,
  total_calories_kcal_day             REAL NOT NULL,
  calories_per_kg_day                 REAL NOT NULL,
  non_protein_calorie_nitrogen_ratio  REAL NOT NULL,
  total_osmolarity_mosm_l             REAL NOT NULL,
  route_category                      TEXT NOT NULL CHECK (route_category IN ('peripheral', 'central_line_uvc_picc')),
  status                              TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                                        'active', 'compounded', 'discontinued', 'completed'
                                      )),
  prescribed_by_id                    INTEGER NOT NULL REFERENCES users(id),
  verified_by_pharmacist_id           INTEGER REFERENCES users(id),
  compounded_at                       TEXT,
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tpn_patient ON nicu_tpn_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_tpn_date ON nicu_tpn_prescriptions(prescription_date);
CREATE INDEX IF NOT EXISTS idx_tpn_status ON nicu_tpn_prescriptions(status);

CREATE TABLE IF NOT EXISTS nicu_tpn_lab_monitorings (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tpn_prescription_id                 INTEGER NOT NULL REFERENCES nicu_tpn_prescriptions(id) ON DELETE CASCADE,
  monitoring_datetime                 TEXT NOT NULL,
  blood_glucose_mg_dl                 REAL NOT NULL,
  serum_sodium_meq_l                  REAL,
  serum_potassium_meq_l               REAL,
  serum_calcium_mg_dl                 REAL,
  serum_triglycerides_mg_dl           REAL,
  serum_urea_mg_dl                    REAL,
  serum_creatinine_mg_dl              REAL,
  direct_bilirubin_mg_dl              REAL,
  gir_adjusted_flag                   INTEGER NOT NULL DEFAULT 0,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tpn_lab_presc ON nicu_tpn_lab_monitorings(tpn_prescription_id);
