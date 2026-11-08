-- Migration 102: Pediatric Septic Arthritis & Kocher Diagnostic Criteria Protocol
-- References: Kocher MS et al. (JBJS 1999/2004); AAP Pediatric Orthopedics; PALS MSK Infections

CREATE TABLE IF NOT EXISTS pediatric_septic_arthritis_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  evaluation_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  affected_joint TEXT NOT NULL CHECK(affected_joint IN (
    'right_hip',
    'left_hip',
    'right_knee',
    'left_knee',
    'right_ankle',
    'left_ankle',
    'other_joint'
  )),

  -- 4 Kocher Criteria
  non_weight_bearing INTEGER NOT NULL DEFAULT 1 CHECK(non_weight_bearing IN (0, 1)),
  temperature_celsius REAL NOT NULL,
  fever_gt_38_5 INTEGER NOT NULL DEFAULT 0 CHECK(fever_gt_38_5 IN (0, 1)),
  esr_mm_hr REAL NOT NULL,
  esr_ge_40 INTEGER NOT NULL DEFAULT 0 CHECK(esr_ge_40 IN (0, 1)),
  wbc_count_per_microliter INTEGER NOT NULL,
  wbc_gt_12000 INTEGER NOT NULL DEFAULT 0 CHECK(wbc_gt_12000 IN (0, 1)),
  crp_mg_l REAL,
  kocher_criteria_met_count INTEGER NOT NULL,
  predicted_probability_percent REAL NOT NULL,

  -- Ultrasound & Arthrocentesis
  ultrasound_effusion_detected INTEGER NOT NULL DEFAULT 0 CHECK(ultrasound_effusion_detected IN (0, 1)),
  arthrocentesis_performed INTEGER NOT NULL DEFAULT 0 CHECK(arthrocentesis_performed IN (0, 1)),
  synovial_wbc_count INTEGER,
  synovial_pmb_pct REAL,
  synovial_gram_stain TEXT NOT NULL DEFAULT 'pending' CHECK(synovial_gram_stain IN (
    'pending',
    'gram_positive_cocci',
    'gram_negative_bacilli',
    'no_organisms_seen'
  )),

  -- Surgical Management & Antibiotics
  surgical_drainage_required INTEGER NOT NULL DEFAULT 0 CHECK(surgical_drainage_required IN (0, 1)),
  surgical_approach TEXT NOT NULL DEFAULT 'none' CHECK(surgical_approach IN (
    'none',
    'arthrotomy_open_capsulotomy',
    'arthroscopic_lavage',
    'needle_aspiration_serial'
  )),
  empiric_antibiotic_regimen TEXT NOT NULL DEFAULT 'none' CHECK(empiric_antibiotic_regimen IN (
    'none',
    'cefazolin_iv',
    'vancomycin_iv',
    'ceftriaxone_plus_vancomycin',
    'clindamycin_iv'
  )),

  status TEXT NOT NULL DEFAULT 'evaluation_pending' CHECK(status IN (
    'evaluation_pending',
    'operating_room_arthrotomy',
    'postoperative_iv_antibiotics',
    'transient_synovitis_observed',
    'infection_resolved_discharged'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_septic_arth_patient ON pediatric_septic_arthritis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_septic_arth_status ON pediatric_septic_arthritis_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_septic_arthritis_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  septic_arthritis_episode_id INTEGER NOT NULL REFERENCES pediatric_septic_arthritis_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_triage REAL NOT NULL DEFAULT 0,

  temperature_celsius REAL NOT NULL,
  heart_rate_bpm INTEGER NOT NULL,
  joint_range_of_motion TEXT NOT NULL CHECK(joint_range_of_motion IN (
    'severely_restricted_pseudoparalysis',
    'moderate_guarding',
    'mild_limitation',
    'full_painless_rom'
  )),
  weight_bearing_ability TEXT NOT NULL CHECK(weight_bearing_ability IN (
    'non_weight_bearing',
    'limping_antalgic',
    'full_independent'
  )),
  crp_mg_l REAL,
  drain_output_ml_24h REAL NOT NULL DEFAULT 0,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_septic_arth_flowsheet_ep ON pediatric_septic_arthritis_flowsheet_logs(septic_arthritis_episode_id);
