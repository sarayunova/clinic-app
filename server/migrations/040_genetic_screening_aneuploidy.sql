-- Migration 040: Antenatal Genetic Screening & Aneuploidy Risk Registry
-- First Trimester Combined Screening, Quadruple Marker, NIPT/cfDNA, and Invasive Procedures

CREATE TABLE IF NOT EXISTS genetic_screening_episodes (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                      INTEGER NOT NULL REFERENCES patients(id),
  visit_id                        INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  screening_date                  TEXT NOT NULL, -- YYYY-MM-DD
  screening_type                  TEXT NOT NULL CHECK (screening_type IN ('first_trimester_combined', 'quadruple_marker', 'nipt_cfdna', 'integrated_sequential', 'invasive_diagnostic')),
  gestational_age_weeks           INTEGER NOT NULL,
  gestational_age_days            INTEGER NOT NULL DEFAULT 0,
  maternal_age_at_delivery        INTEGER NOT NULL,
  maternal_weight_kg              REAL,
  pregnancy_type                  TEXT DEFAULT 'singleton' CHECK (pregnancy_type IN ('singleton', 'twins_dichorionic', 'twins_monochorionic', 'triplets')),
  ivf_pregnancy                   INTEGER DEFAULT 0 CHECK (ivf_pregnancy IN (0, 1)),
  diabetes_status                 INTEGER DEFAULT 0 CHECK (diabetes_status IN (0, 1)),
  smoker                          INTEGER DEFAULT 0 CHECK (smoker IN (0, 1)),

  -- First Trimester Combined Screening Parameters
  crl_mm                          REAL,
  nt_measured_mm                  REAL,
  nt_mom                          REAL,
  nasal_bone                      TEXT CHECK (nasal_bone IS NULL OR nasal_bone IN ('present', 'absent', 'hypoplastic', 'not_visualized')),
  tricuspid_regurgitation         TEXT CHECK (tricuspid_regurgitation IS NULL OR tricuspid_regurgitation IN ('normal', 'regurgitant', 'not_performed')),
  ductus_venosus                  TEXT CHECK (ductus_venosus IS NULL OR ductus_venosus IN ('positive', 'reversed', 'not_performed')),
  free_beta_hcg_raw               REAL,
  free_beta_hcg_mom               REAL,
  papp_a_raw                      REAL,
  papp_a_mom                      REAL,

  -- Second Trimester Quadruple Marker Parameters
  bpd_mm                          REAL,
  afp_raw                         REAL,
  afp_mom                         REAL,
  total_hcg_raw                   REAL,
  total_hcg_mom                   REAL,
  ue3_raw                         REAL,
  ue3_mom                         REAL,
  inhibin_a_raw                   REAL,
  inhibin_a_mom                   REAL,

  -- Calculated Risks & Ratios
  background_t21_risk_ratio       TEXT NOT NULL,
  adjusted_t21_risk_ratio         TEXT NOT NULL,
  adjusted_t21_risk_numeric       REAL NOT NULL, -- e.g. 0.00222 for 1:450
  adjusted_t18_risk_ratio         TEXT NOT NULL,
  adjusted_t18_risk_numeric       REAL NOT NULL,
  adjusted_t13_risk_ratio         TEXT NOT NULL,
  adjusted_t13_risk_numeric       REAL NOT NULL,
  ontd_risk_status                TEXT DEFAULT 'not_applicable' CHECK (ontd_risk_status IS NULL OR ontd_risk_status IN ('low_risk', 'high_risk', 'not_applicable')),
  overall_risk_tier               TEXT NOT NULL CHECK (overall_risk_tier IN ('low_risk', 'intermediate_risk', 'high_risk', 'inconclusive')),

  -- NIPT / Cell-Free Fetal DNA (cfDNA)
  nipt_sample_date                TEXT,
  nipt_fetal_fraction_percent     REAL,
  nipt_t21_result                 TEXT CHECK (nipt_t21_result IS NULL OR nipt_t21_result IN ('low_risk', 'high_risk', 'inconclusive')),
  nipt_t18_result                 TEXT CHECK (nipt_t18_result IS NULL OR nipt_t18_result IN ('low_risk', 'high_risk', 'inconclusive')),
  nipt_t13_result                 TEXT CHECK (nipt_t13_result IS NULL OR nipt_t13_result IN ('low_risk', 'high_risk', 'inconclusive')),
  nipt_sex_chromosomes            TEXT,
  nipt_microdeletions             TEXT,
  nipt_lab_name                   TEXT,

  -- Clinical Recommendation & Counseling
  clinical_recommendation         TEXT NOT NULL,
  counseling_notes                TEXT,
  counseled_by                    INTEGER NOT NULL REFERENCES users(id),
  patient_decision                TEXT CHECK (patient_decision IS NULL OR patient_decision IN ('routine_care', 'opt_for_nipt', 'opt_for_invasive_diagnostic', 'declined_further_testing', 'undecided')),

  -- Invasive Diagnostic Procedure (CVS / Amniocentesis)
  invasive_procedure_type         TEXT CHECK (invasive_procedure_type IS NULL OR invasive_procedure_type IN ('cvs', 'amniocentesis', 'cordocentesis', 'none')),
  invasive_procedure_date         TEXT,
  invasive_performed_by           TEXT,
  invasive_sample_details         TEXT,
  anti_d_given                    INTEGER DEFAULT 0 CHECK (anti_d_given IN (0, 1)),
  karyotype_result                TEXT,
  microarray_cma_result           TEXT,
  rapid_qfpcr_result              TEXT,
  final_genetic_diagnosis         TEXT,

  -- Metadata
  created_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_genetic_patient ON genetic_screening_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_genetic_date ON genetic_screening_episodes(screening_date);
CREATE INDEX IF NOT EXISTS idx_genetic_tier ON genetic_screening_episodes(overall_risk_tier);
