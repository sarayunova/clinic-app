-- Migration 049: Gynecological Oncology, Adnexal Mass & Malignancy Risk Stratifier (IOTA ADNEX & RMI)
-- Automated calculation of Risk of Malignancy Index (RMI-1 Jacobs), IOTA Simple Rules,
-- postmenopausal bleeding triage, endometrial thickness criteria, and FIGO oncological staging.

CREATE TABLE IF NOT EXISTS gyn_oncology_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_date                     TEXT NOT NULL, -- YYYY-MM-DD
  clinical_indication                 TEXT NOT NULL CHECK (clinical_indication IN ('adnexal_mass', 'postmenopausal_bleeding', 'cervical_neoplasia_suspected', 'endometrial_thickening', 'abnormal_uterine_bleeding')),
  menopausal_status                   TEXT NOT NULL CHECK (menopausal_status IN ('premenopausal', 'postmenopausal')),

  -- Tumor Markers
  ca125_level_u_ml                    REAL,
  he4_pmol_l                          REAL,
  roma_score_percent                  REAL,

  -- Ultrasound Morphology (IOTA ADNEX & RMI Parameters)
  lesion_max_diameter_mm              REAL,
  proportion_solid_tissue_percent     REAL,
  papillary_projections_count         INTEGER DEFAULT 0,
  acoustic_shadows_present            INTEGER NOT NULL DEFAULT 0 CHECK (acoustic_shadows_present IN (0, 1)),
  ascites_present                     INTEGER NOT NULL DEFAULT 0 CHECK (ascites_present IN (0, 1)),
  bilateral_lesions                   INTEGER NOT NULL DEFAULT 0 CHECK (bilateral_lesions IN (0, 1)),
  multilocular_cysts                  INTEGER NOT NULL DEFAULT 0 CHECK (multilocular_cysts IN (0, 1)),
  color_doppler_score                 INTEGER CHECK (color_doppler_score IS NULL OR color_doppler_score BETWEEN 1 AND 4),

  -- Computed IOTA & RMI Risk Outputs
  iota_simple_rules_category          TEXT NOT NULL CHECK (iota_simple_rules_category IN ('benign', 'malignant', 'inconclusive')),
  iota_predicted_malignancy_risk_pct  REAL,
  rmi_score                           REAL NOT NULL, -- U * M * CA125
  rmi_risk_tier                       TEXT NOT NULL CHECK (rmi_risk_tier IN ('low_risk_le_25', 'intermediate_risk_26_200', 'high_risk_gt_200')),

  -- Endometrial Assessment (PMB Protocol)
  endometrial_thickness_mm            REAL,
  endometrial_biopsy_done             INTEGER NOT NULL DEFAULT 0 CHECK (endometrial_biopsy_done IN (0, 1)),
  endometrial_histology               TEXT,

  -- Cervical & FIGO Clinical Staging
  cervical_lesion_visible             INTEGER NOT NULL DEFAULT 0 CHECK (cervical_lesion_visible IN (0, 1)),
  figo_clinical_stage                 TEXT, -- e.g. "Stage IA", "Stage IB1", "Stage II", "Benign"

  -- Tumor Board & Oncology Care Plan
  multidisciplinary_tumor_board_status TEXT NOT NULL DEFAULT 'not_required_benign' CHECK (multidisciplinary_tumor_board_status IN ('not_required_benign', 'pending_board_review', 'discussed_approved')),
  management_plan                     TEXT,
  surgical_staging_details            TEXT,
  clinical_notes                      TEXT,

  gyn_oncologist_name                 TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gyn_onc_patient ON gyn_oncology_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_gyn_onc_rmi ON gyn_oncology_episodes(rmi_risk_tier);
