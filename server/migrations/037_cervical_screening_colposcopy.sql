-- Migration 037: Cervical Cancer Screening & Colposcopy Registry
-- Supports Bethesda 2014 Cytology (NILM, ASC-US, LSIL, HSIL, AGC, SCC),
-- HPV DNA molecular genotyping (HPV 16, 18, 45, high-risk pool),
-- Colposcopic examination with Swede score (0-10) and Reid Colposcopic Index (0-8),
-- transformation zone classification, cervical clock lesion mapping,
-- cervical punch/LEEP/ECC biopsy histopathology tracking, and ASCCP/WHO guideline recommendations.

CREATE TABLE IF NOT EXISTS cervical_screening_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  screening_date TEXT NOT NULL,
  screening_type TEXT NOT NULL CHECK(screening_type IN ('pap_cytology', 'hpv_dna', 'co_test', 'colposcopy_only', 'post_treatment_followup')),
  indication TEXT NOT NULL CHECK(indication IN ('routine_screening', 'abnormal_prior_screening', 'postcoital_bleeding', 'intermenstrual_bleeding', 'persistent_vaginal_discharge', 'visible_cervical_lesion', 'post_treatment_surveillance', 'other')),

  -- Bethesda System 2014 Cytology
  pap_performed INTEGER NOT NULL DEFAULT 0,
  pap_sample_type TEXT CHECK(pap_sample_type IN ('liquid_based', 'conventional_smear')),
  pap_adequacy TEXT CHECK(pap_adequacy IN ('satisfactory_with_ec_tz', 'satisfactory_without_ec_tz', 'unsatisfactory_obscured', 'unsatisfactory_scant')),
  pap_result TEXT CHECK(pap_result IN ('nilm', 'asc_us', 'asc_h', 'lsil', 'hsil', 'scc', 'agc_nos', 'agc_neoplastic', 'ais', 'adenocarcinoma')),
  pap_infections TEXT, -- JSON string array of non-neoplastic organisms
  pap_lab_name TEXT,
  pap_report_number TEXT,

  -- HPV DNA Molecular Testing
  hpv_performed INTEGER NOT NULL DEFAULT 0,
  hpv_test_type TEXT CHECK(hpv_test_type IN ('pcr', 'hybrid_capture_2', 'cobas', 'genexpert', 'other')),
  hpv_overall_result TEXT CHECK(hpv_overall_result IN ('negative', 'positive', 'invalid_inconclusive')),
  hpv_16_positive INTEGER NOT NULL DEFAULT 0,
  hpv_18_positive INTEGER NOT NULL DEFAULT 0,
  hpv_45_positive INTEGER NOT NULL DEFAULT 0,
  hpv_other_high_risk_positive INTEGER NOT NULL DEFAULT 0,
  hpv_viral_load TEXT,

  -- Colposcopy Assessment
  colposcopy_performed INTEGER NOT NULL DEFAULT 0,
  colposcopy_date TEXT,
  examiner_name TEXT,
  cervix_visibility TEXT CHECK(cervix_visibility IN ('fully_visible', 'partially_visible', 'not_visible')),
  transformation_zone_type TEXT CHECK(transformation_zone_type IN ('type_1', 'type_2', 'type_3')),
  squamocolumnar_junction_visible TEXT CHECK(squamocolumnar_junction_visible IN ('completely_visible', 'partially_visible', 'not_visible')),

  -- Swede Score parameters (0-2 each)
  swede_acetowhitening INTEGER CHECK(swede_acetowhitening IN (0, 1, 2)),
  swede_margins INTEGER CHECK(swede_margins IN (0, 1, 2)),
  swede_vessels INTEGER CHECK(swede_vessels IN (0, 1, 2)),
  swede_lesion_size INTEGER CHECK(swede_lesion_size IN (0, 1, 2)),
  swede_iodine_staining INTEGER CHECK(swede_iodine_staining IN (0, 1, 2)),
  swede_score_total INTEGER,
  swede_interpretation TEXT CHECK(swede_interpretation IN ('normal_benign', 'low_grade_cin1', 'suspicious_cin2_3', 'high_probability_cin2_3_cancer')),

  -- Reid Colposcopic Index (0-8)
  reid_margin INTEGER CHECK(reid_margin IN (0, 1, 2)),
  reid_color INTEGER CHECK(reid_color IN (0, 1, 2)),
  reid_vessels INTEGER CHECK(reid_vessels IN (0, 1, 2)),
  reid_iodine INTEGER CHECK(reid_iodine IN (0, 1, 2)),
  reid_score_total INTEGER,
  reid_interpretation TEXT,

  -- Lesion Distribution & Cervical Clock Locations (JSON array e.g. ["12_oclock", "6_oclock"])
  lesion_quadrants TEXT,
  endocervical_curettage_done INTEGER NOT NULL DEFAULT 0,

  -- Biopsy & Procedure
  biopsy_taken INTEGER NOT NULL DEFAULT 0,
  biopsy_type TEXT CHECK(biopsy_type IN ('none', 'punch_biopsy', 'ecc_only', 'punch_and_ecc', 'leep_lletz', 'cold_knife_conization', 'cryotherapy', 'thermal_ablation')),
  biopsy_sites TEXT,
  biopsy_result TEXT CHECK(biopsy_result IN ('pending', 'normal_cervicitis', 'cin_1_mild', 'cin_2_moderate', 'cin_3_severe_cis', 'squamous_cell_carcinoma', 'ais', 'adenocarcinoma', 'inadequate_sample')),
  histopathology_number TEXT,

  -- Clinical Management Plan
  management_recommendation TEXT NOT NULL,
  next_recall_months INTEGER,
  clinical_notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),

  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cervical_screening_patient ON cervical_screening_records(patient_id, screening_date DESC);

CREATE TABLE IF NOT EXISTS cervical_biopsies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screening_id INTEGER NOT NULL REFERENCES cervical_screening_records(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  site_location TEXT NOT NULL,
  clock_position INTEGER CHECK(clock_position BETWEEN 1 AND 12),
  specimen_label TEXT,
  histopathology_result TEXT NOT NULL DEFAULT 'pending' CHECK(histopathology_result IN ('pending', 'normal_benign', 'cin_1', 'cin_2', 'cin_3_cis', 'scc', 'ais', 'adenocarcinoma', 'inconclusive')),
  pathologist_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cervical_biopsies_screening ON cervical_biopsies(screening_id);
