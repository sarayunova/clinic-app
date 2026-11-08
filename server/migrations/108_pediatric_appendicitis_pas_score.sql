-- Migration 108: Pediatric Acute Appendicitis & Pediatric Appendicitis Score (PAS / Samuel)
-- References: Samuel M (Pediatric Appendicitis Score); Alvarado Score; APSA Guidelines; Nelson Pediatric Surgery

CREATE TABLE IF NOT EXISTS pediatric_appendicitis_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  triage_datetime TEXT NOT NULL,
  age_years REAL NOT NULL CHECK(age_years >= 0.5 AND age_years <= 18.0),
  weight_kg REAL NOT NULL CHECK(weight_kg >= 4.0 AND weight_kg <= 120.0),
  symptom_duration_hours REAL NOT NULL CHECK(symptom_duration_hours >= 1.0 AND symptom_duration_hours <= 336.0),

  -- Samuel Pediatric Appendicitis Score (0 - 10)
  cough_percussion_hopping_rlq_pain INTEGER NOT NULL DEFAULT 0 CHECK(cough_percussion_hopping_rlq_pain IN (0, 1)), -- 2 pts
  rlq_tenderness_light_palpation INTEGER NOT NULL DEFAULT 0 CHECK(rlq_tenderness_light_palpation IN (0, 1)),    -- 2 pts
  migration_pain_to_rlq INTEGER NOT NULL DEFAULT 0 CHECK(migration_pain_to_rlq IN (0, 1)),                     -- 1 pt
  fever_gt_38c INTEGER NOT NULL DEFAULT 0 CHECK(fever_gt_38c IN (0, 1)),                                       -- 1 pt
  nausea_or_vomiting INTEGER NOT NULL DEFAULT 0 CHECK(nausea_or_vomiting IN (0, 1)),                           -- 1 pt
  anorexia INTEGER NOT NULL DEFAULT 0 CHECK(anorexia IN (0, 1)),                                               -- 1 pt
  leukocytosis_wbc_gt_10000 INTEGER NOT NULL DEFAULT 0 CHECK(leukocytosis_wbc_gt_10000 IN (0, 1)),             -- 1 pt
  neutrophilia_anc_gt_7500_or_ge_75pct INTEGER NOT NULL DEFAULT 0 CHECK(neutrophilia_anc_gt_7500_or_ge_75pct IN (0, 1)), -- 1 pt
  pas_score_total INTEGER NOT NULL CHECK(pas_score_total >= 0 AND pas_score_total <= 10),

  -- Laboratory Diagnostics
  wbc_count_per_microliter REAL,
  neutrophil_percent REAL,
  crp_mg_l REAL,

  -- Graded-Compression Ultrasound
  ultrasound_performed INTEGER NOT NULL DEFAULT 1 CHECK(ultrasound_performed IN (0, 1)),
  appendix_visualized INTEGER NOT NULL DEFAULT 1 CHECK(appendix_visualized IN (0, 1)),
  outer_diameter_mm REAL CHECK(outer_diameter_mm IS NULL OR (outer_diameter_mm >= 2.0 AND outer_diameter_mm <= 25.0)),
  non_compressible INTEGER NOT NULL DEFAULT 1 CHECK(non_compressible IN (0, 1)),
  hypervascular_ring_of_fire INTEGER NOT NULL DEFAULT 0 CHECK(hypervascular_ring_of_fire IN (0, 1)),
  appendicolith_fecalith_present INTEGER NOT NULL DEFAULT 0 CHECK(appendicolith_fecalith_present IN (0, 1)),
  periappendiceal_fluid_or_fat_stranding INTEGER NOT NULL DEFAULT 0 CHECK(periappendiceal_fluid_or_fat_stranding IN (0, 1)),
  perforation_or_abscess_suspected INTEGER NOT NULL DEFAULT 0 CHECK(perforation_or_abscess_suspected IN (0, 1)),

  -- Management & Operative Details
  management_pathway TEXT NOT NULL CHECK(management_pathway IN (
    'urgent_laparoscopic_appendectomy',
    'open_appendectomy',
    'non_operative_iv_antibiotics',
    'percutaneous_abscess_drainage_interval',
    'discharge_observation'
  )),
  empiric_antibiotic_regimen TEXT NOT NULL CHECK(empiric_antibiotic_regimen IN (
    'none',
    'ceftriaxone_plus_metronidazole',
    'piperacillin_tazobactam',
    'ampicillin_gentamicin_metronidazole',
    'ciprofloxacin_plus_metronidazole'
  )) DEFAULT 'none',
  surgical_findings TEXT CHECK(surgical_findings IS NULL OR surgical_findings IN (
    'uncomplicated_suppurative',
    'gangrenous_intact',
    'perforated_localized_phlegmon',
    'perforated_generalized_peritonitis',
    'normal_appendix'
  )),

  status TEXT NOT NULL DEFAULT 'triage_diagnostic_evaluation' CHECK(status IN (
    'triage_diagnostic_evaluation',
    'operating_room_in_transit',
    'postoperative_recovery',
    'conservative_antibiotics_inpatient',
    'resolved_discharged'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_app_patient ON pediatric_appendicitis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_app_status ON pediatric_appendicitis_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_appendicitis_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appendicitis_episode_id INTEGER NOT NULL REFERENCES pediatric_appendicitis_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_triage REAL NOT NULL DEFAULT 0,

  temperature_celsius REAL NOT NULL,
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  pain_score_flacc_wong_baker INTEGER NOT NULL CHECK(pain_score_flacc_wong_baker >= 0 AND pain_score_flacc_wong_baker <= 10),
  abdominal_exam_findings TEXT NOT NULL CHECK(abdominal_exam_findings IN (
    'soft_non_tender',
    'focal_rlq_tenderness_improving',
    'rebound_guarding_worsening',
    'diffuse_peritonitis'
  )),
  oral_intake_status TEXT NOT NULL CHECK(oral_intake_status IN (
    'npo_strict',
    'clear_liquids_tolerated',
    'age_appropriate_diet'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_app_flowsheet_ep ON pediatric_appendicitis_flowsheet_logs(appendicitis_episode_id);
