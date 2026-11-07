-- Migration 047: Endometriosis & Deep Infiltrating Endometriosis (DIE) Staging (#Enzian & rASRM)
-- Standardized classification according to revised ASRM (rASRM) staging (Stages I-IV)
-- and #Enzian 2021 classification for deep infiltrating endometriosis (DIE) compartments A, B, C, F, T.

CREATE TABLE IF NOT EXISTS endometriosis_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_date                     TEXT NOT NULL, -- YYYY-MM-DD
  assessment_type                     TEXT NOT NULL CHECK (assessment_type IN ('clinical_and_imaging', 'laparoscopic_surgical', 'post_operative_followup')),

  -- Pain Symptoms & Visual Analog Scale (VAS 0-10)
  vas_dysmenorrhea                    INTEGER NOT NULL DEFAULT 0 CHECK (vas_dysmenorrhea BETWEEN 0 AND 10),
  vas_dyspareunia                     INTEGER NOT NULL DEFAULT 0 CHECK (vas_dyspareunia BETWEEN 0 AND 10),
  vas_dyschezia                       INTEGER NOT NULL DEFAULT 0 CHECK (vas_dyschezia BETWEEN 0 AND 10),
  vas_dysuria                         INTEGER NOT NULL DEFAULT 0 CHECK (vas_dysuria BETWEEN 0 AND 10),
  vas_chronic_pelvic_pain             INTEGER NOT NULL DEFAULT 0 CHECK (vas_chronic_pelvic_pain BETWEEN 0 AND 10),

  -- rASRM Staging Components (Point Scoring 1-150+)
  rasrm_peritoneal_superficial_pts    INTEGER NOT NULL DEFAULT 0,
  rasrm_peritoneal_deep_pts           INTEGER NOT NULL DEFAULT 0,
  rasrm_ovary_right_superficial_pts   INTEGER NOT NULL DEFAULT 0,
  rasrm_ovary_right_deep_pts          INTEGER NOT NULL DEFAULT 0,
  rasrm_ovary_left_superficial_pts    INTEGER NOT NULL DEFAULT 0,
  rasrm_ovary_left_deep_pts           INTEGER NOT NULL DEFAULT 0,
  rasrm_adhesions_ovary_right_pts     INTEGER NOT NULL DEFAULT 0,
  rasrm_adhesions_ovary_left_pts      INTEGER NOT NULL DEFAULT 0,
  rasrm_adhesions_tube_right_pts      INTEGER NOT NULL DEFAULT 0,
  rasrm_adhesions_tube_left_pts       INTEGER NOT NULL DEFAULT 0,
  rasrm_pouch_of_douglas_obliteration TEXT NOT NULL DEFAULT 'none' CHECK (rasrm_pouch_of_douglas_obliteration IN ('none', 'partial_4pts', 'complete_40pts')),
  rasrm_total_score                   INTEGER NOT NULL DEFAULT 0,
  rasrm_stage                         TEXT NOT NULL CHECK (rasrm_stage IN ('stage_1_minimal', 'stage_2_mild', 'stage_3_moderate', 'stage_4_severe')),

  -- #Enzian (2021) DIE Classification
  enzian_peritoneum                   TEXT, -- e.g. "P1", "P2", "P3"
  enzian_ovary_left                   TEXT, -- e.g. "O1", "O2", "O3"
  enzian_ovary_right                  TEXT, -- e.g. "O1", "O2", "O3"
  enzian_tube_left                    TEXT, -- e.g. "T1", "T2", "T3"
  enzian_tube_right                   TEXT, -- e.g. "T1", "T2", "T3"
  enzian_compartment_a                TEXT, -- Vagina / rectovaginal septum (A1 <1cm, A2 1-3cm, A3 >3cm)
  enzian_compartment_b                TEXT, -- Uterosacral / parametrium (B1 <1cm, B2 1-3cm, B3 >3cm)
  enzian_compartment_c                TEXT, -- Rectum / sigmoid (C1 <1cm, C2 1-3cm, C3 >3cm)
  enzian_extragenital_f               TEXT, -- Bladder (FB), Ureter (FU), Bowel/Ileum (FI), Other (FA)
  enzian_adenomyosis_fa               INTEGER NOT NULL DEFAULT 0 CHECK (enzian_adenomyosis_fa IN (0, 1)),
  enzian_composite_code               TEXT, -- e.g. "#Enzian P1, O2/0, T1/0, A1, B2/0, C0, FA"

  -- Clinical Management & Surgical Findings
  medical_management_regimen          TEXT, -- e.g. "Dienogest 2mg daily + tranexamic acid PRN"
  surgical_procedure_performed        TEXT, -- e.g. "Laparoscopic excision of DIE, bilateral cystectomy, shaving of rectal nodule"
  fertility_sparing                   INTEGER NOT NULL DEFAULT 1 CHECK (fertility_sparing IN (0, 1)),
  post_op_hormonal_suppression        TEXT,
  clinical_notes                      TEXT,

  lead_surgeon                        TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_endo_patient ON endometriosis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_endo_stage ON endometriosis_episodes(rasrm_stage);
