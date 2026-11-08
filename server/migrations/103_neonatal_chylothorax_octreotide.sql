-- Migration 103: Neonatal Chylothorax & Pleural Effusion Octreotide Protocol
-- References: AAP Pediatric Pulmonology; BTS Pediatric Pleural Disease Guidelines; NeoReviews; Gomella's Neonatology (8th Ed)

CREATE TABLE IF NOT EXISTS neonatal_chylothorax_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  chronological_age_days INTEGER NOT NULL,
  current_weight_kg REAL NOT NULL,
  effusion_laterality TEXT NOT NULL CHECK(effusion_laterality IN ('unilateral_right', 'unilateral_left', 'bilateral')),
  etiology TEXT NOT NULL CHECK(etiology IN (
    'congenital_idiopathic',
    'post_cardiothoracic_surgery',
    'genetic_turner_noonan_trisomy21',
    'central_venous_thrombosis',
    'congenital_lymphangiomatosis'
  )),

  -- Laboratory Diagnostics: Pleural Fluid Biochemistry & Cytology
  pleural_triglycerides_mg_dl REAL,
  pleural_total_cells_per_microliter INTEGER,
  pleural_lymphocyte_percent REAL,
  pleural_cholesterol_mg_dl REAL,
  chylomicron_presence INTEGER NOT NULL DEFAULT 0 CHECK(chylomicron_presence IN (0, 1)),

  -- Thoracostomy Drainage & Medical Management
  chest_tube_inserted INTEGER NOT NULL DEFAULT 1 CHECK(chest_tube_inserted IN (0, 1)),
  initial_24h_drainage_ml REAL NOT NULL,
  drainage_ml_kg_day REAL NOT NULL,
  dietary_regimen TEXT NOT NULL CHECK(dietary_regimen IN (
    'nil_by_mouth_tpn',
    'exclusive_mct_formula',
    'mct_supplemented_breast_milk',
    'unrestricted_breast_milk_formula'
  )),
  octreotide_prescribed INTEGER NOT NULL DEFAULT 0 CHECK(octreotide_prescribed IN (0, 1)),
  octreotide_current_dose_mcg_kg_hr REAL NOT NULL DEFAULT 0 CHECK(octreotide_current_dose_mcg_kg_hr >= 0.0 AND octreotide_current_dose_mcg_kg_hr <= 15.0),
  chemical_pleurodesis_performed INTEGER NOT NULL DEFAULT 0 CHECK(chemical_pleurodesis_performed IN (0, 1)),
  surgical_ligation_indicated INTEGER NOT NULL DEFAULT 0 CHECK(surgical_ligation_indicated IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'acute_chest_tube_drainage' CHECK(status IN (
    'acute_chest_tube_drainage',
    'octreotide_titration',
    'dietary_mct_transition',
    'resolved_tube_removed',
    'refractory_surgical_referral'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_chylothorax_patient ON neonatal_chylothorax_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_chylothorax_status ON neonatal_chylothorax_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_chylothorax_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chylothorax_episode_id INTEGER NOT NULL REFERENCES neonatal_chylothorax_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  days_from_diagnosis INTEGER NOT NULL DEFAULT 0,

  drainage_24h_ml REAL NOT NULL,
  drainage_ml_kg_day REAL NOT NULL,
  octreotide_dose_mcg_kg_hr REAL NOT NULL DEFAULT 0,
  blood_glucose_mg_dl REAL,
  serum_sodium_mmol_l REAL,
  fluid_appearance TEXT NOT NULL CHECK(fluid_appearance IN ('milky_chylous', 'serosanguinous', 'straw_colored_serous', 'clear')),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_chylo_flowsheet_ep ON neonatal_chylothorax_flowsheet_logs(chylothorax_episode_id);
