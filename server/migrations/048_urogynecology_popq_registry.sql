-- Migration 048: Urogynecology & Pelvic Floor Dysfunction / POP-Q Registry
-- Standardized 9-point Pelvic Organ Prolapse Quantification (POP-Q) grid examination,
-- stage 0-IV classification, urinary incontinence stratification, pessary registry, and surgical repair.

CREATE TABLE IF NOT EXISTS urogynecology_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_date                     TEXT NOT NULL, -- YYYY-MM-DD
  parity                              TEXT, -- e.g. "G3P3"
  menopausal_status                   TEXT NOT NULL CHECK (menopausal_status IN ('premenopausal', 'perimenopausal', 'postmenopausal')),

  -- POP-Q 9-Point Examination Grid (All in cm relative to hymen; above is negative, below is positive)
  popq_aa_cm                          REAL NOT NULL, -- -3 to +3 cm (anterior wall 3cm proximal to meatus)
  popq_ba_cm                          REAL NOT NULL, -- -3 to +tvl cm (most dependent anterior wall)
  popq_c_cm                           REAL NOT NULL, -- -tvl to +tvl cm (cervix or vaginal cuff)
  popq_gh_cm                          REAL NOT NULL, -- Genital hiatus (cm)
  popq_pb_cm                          REAL NOT NULL, -- Perineal body (cm)
  popq_tvl_cm                         REAL NOT NULL, -- Total vaginal length (cm)
  popq_ap_cm                          REAL NOT NULL, -- -3 to +3 cm (posterior wall 3cm proximal to hymen)
  popq_bp_cm                          REAL NOT NULL, -- -3 to +tvl cm (most dependent posterior wall)
  popq_d_cm                           REAL,          -- Posterior fornix (omit in post-hysterectomy)

  -- Computed Prolapse Staging & Leading Edge
  popq_stage                          TEXT NOT NULL CHECK (popq_stage IN ('stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_4')),
  leading_compartment                 TEXT NOT NULL CHECK (leading_compartment IN ('anterior_cystocele', 'apical_uterine_vault', 'posterior_rectocele', 'multicompartment', 'none')),
  leading_edge_distance_cm            REAL NOT NULL,

  -- Urinary Incontinence & Bladder Diary
  urinary_incontinence_type           TEXT NOT NULL CHECK (urinary_incontinence_type IN ('none', 'stress_sui', 'urge_uui', 'mixed_mui', 'overflow')),
  pad_count_per_day                   INTEGER DEFAULT 0,
  bladder_diary_day_frequency         INTEGER,
  bladder_diary_nocturia              INTEGER,
  leak_episodes_24h                   INTEGER,
  bother_score_iciq_sf                INTEGER CHECK (bother_score_iciq_sf IS NULL OR bother_score_iciq_sf BETWEEN 0 AND 21),

  -- Management Pathway (Pessary vs Surgical)
  pessary_management                  TEXT NOT NULL DEFAULT 'none' CHECK (pessary_management IN ('none', 'fitted_ring', 'fitted_gellhorn', 'fitted_cube', 'pessary_declined', 'pessary_failed')),
  pessary_size_mm                     INTEGER,
  pessary_change_interval_weeks       INTEGER,
  pelvic_floor_physiotherapy          INTEGER NOT NULL DEFAULT 0 CHECK (pelvic_floor_physiotherapy IN (0, 1)),
  surgical_procedure_planned          TEXT, -- e.g. "Sacrocolpopexy", "Midurethral Sling", "Anterior Colporrhaphy"
  clinical_notes                      TEXT,

  performed_by                        TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_urogyn_patient ON urogynecology_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_urogyn_stage ON urogynecology_episodes(popq_stage);
