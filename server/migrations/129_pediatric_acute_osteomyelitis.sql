-- Migration 129: Pediatric Acute Hematogenous Osteomyelitis (AHO) & Subperiosteal Abscess Protocol
-- Reference: AAP / PIDS / IDSA / ESPID Clinical Practice Guidelines

CREATE TABLE IF NOT EXISTS pediatric_osteomyelitis_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_years                             REAL NOT NULL,
  weight_kg                             REAL NOT NULL,
  bone_involved                         TEXT NOT NULL CHECK (bone_involved IN (
                                          'distal_femur',
                                          'proximal_tibia',
                                          'distal_tibia',
                                          'proximal_humerus',
                                          'fibula',
                                          'radius_ulna',
                                          'pelvis',
                                          'other_bone'
                                        )),
  laterality                            TEXT NOT NULL CHECK (laterality IN ('right', 'left', 'bilateral')),
  kocher_fever_gt_38_5                  INTEGER NOT NULL DEFAULT 1 CHECK (kocher_fever_gt_38_5 IN (0, 1)),
  kocher_non_weight_bearing             INTEGER NOT NULL DEFAULT 1 CHECK (kocher_non_weight_bearing IN (0, 1)),
  kocher_esr_gt_40                      INTEGER NOT NULL DEFAULT 1 CHECK (kocher_esr_gt_40 IN (0, 1)),
  kocher_wbc_gt_12k                     INTEGER NOT NULL DEFAULT 1 CHECK (kocher_wbc_gt_12k IN (0, 1)),
  crp_admission_mg_l                    REAL NOT NULL,
  crp_peak_mg_l                         REAL NOT NULL,
  subperiosteal_abscess_present         INTEGER NOT NULL DEFAULT 0 CHECK (subperiosteal_abscess_present IN (0, 1)),
  abscess_size_depth_mm                 REAL NOT NULL DEFAULT 0.0,
  imaging_modality_confirmatory         TEXT NOT NULL CHECK (imaging_modality_confirmatory IN (
                                          'ultrasound_subperiosteal_fluid',
                                          'mri_with_contrast',
                                          'plain_radiograph_lytic_changes',
                                          'ct_scan'
                                        )),
  surgical_decompression_performed      INTEGER NOT NULL DEFAULT 0 CHECK (surgical_decompression_performed IN (0, 1)),
  surgical_procedure                    TEXT NOT NULL CHECK (surgical_procedure IN (
                                          'none_medical_management',
                                          'percutaneous_needle_aspiration',
                                          'cortical_fenestration_and_drainage',
                                          'extensive_debridement_sequestrectomy'
                                        )),
  isolated_pathogen                     TEXT NOT NULL CHECK (isolated_pathogen IN (
                                          'staphylococcus_aureus_mssa',
                                          'staphylococcus_aureus_mrsa',
                                          'streptococcus_pyogenes_group_a',
                                          'kingella_kingae',
                                          'pseudomonas_aeruginosa',
                                          'culture_negative_clinical_aho'
                                        )),
  current_antibiotic_regimen            TEXT NOT NULL CHECK (current_antibiotic_regimen IN (
                                          'iv_cefazolin',
                                          'iv_vancomycin',
                                          'iv_clindamycin',
                                          'iv_ceftriaxone',
                                          'oral_cephalexin',
                                          'oral_clindamycin',
                                          'oral_amoxicillin_clavulanate'
                                        )),
  oral_switch_criteria_met              INTEGER NOT NULL DEFAULT 0 CHECK (oral_switch_criteria_met IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'initial_iv_empiric_therapy' CHECK (status IN (
                                          'initial_iv_empiric_therapy',
                                          'surgical_drainage_and_culture',
                                          'pathogen_directed_iv_therapy',
                                          'oral_step_down_therapy',
                                          'resolved_treatment_completed'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ped_osteo_patient ON pediatric_osteomyelitis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_ped_osteo_status ON pediatric_osteomyelitis_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_osteomyelitis_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  osteomyelitis_episode_id              INTEGER NOT NULL REFERENCES pediatric_osteomyelitis_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  day_of_therapy                        INTEGER NOT NULL DEFAULT 1,
  temperature_celsius                   REAL NOT NULL,
  crp_level_mg_l                        REAL NOT NULL,
  esr_mm_hr                             REAL,
  pain_score_flacc_or_vas               INTEGER NOT NULL CHECK (pain_score_flacc_or_vas BETWEEN 0 AND 10),
  weight_bearing_status                 TEXT NOT NULL CHECK (weight_bearing_status IN (
                                          'unable_refuses_pseudoparalysis',
                                          'partial_weight_bearing_limp',
                                          'full_weight_bearing_pain_free'
                                        )),
  local_signs                           TEXT NOT NULL CHECK (local_signs IN (
                                          'marked_edema_erythema_warmth',
                                          'moderately_tender_improving',
                                          'mild_tenderness_no_swelling',
                                          'completely_quiescent'
                                        )),
  route_of_administration               TEXT NOT NULL CHECK (route_of_administration IN (
                                          'iv_infusion',
                                          'oral_step_down'
                                        )),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ped_osteo_logs_episode ON pediatric_osteomyelitis_flowsheet_logs(osteomyelitis_episode_id);
