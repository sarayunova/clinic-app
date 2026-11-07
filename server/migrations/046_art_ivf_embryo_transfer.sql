-- Migration 046: Assisted Reproductive Technology (ART) & IUI/IVF-ICSI Embryo Transfer Tracker
-- Full COH cycle tracking, Gardner blastocyst grading, embryo transfer (SET),
-- cryostorage registry, and serial beta-hCG doubling time monitoring.

CREATE TABLE IF NOT EXISTS art_cycles (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  cycle_number                        INTEGER NOT NULL DEFAULT 1,
  start_date                          TEXT NOT NULL, -- YYYY-MM-DD
  cycle_type                          TEXT NOT NULL CHECK (cycle_type IN ('ivf_fresh', 'icsi_fresh', 'fet_frozen_transfer', 'iui_husband', 'iui_donor', 'oocyte_vitrification', 'surrogacy')),
  protocol_type                       TEXT NOT NULL CHECK (protocol_type IN ('gnrh_antagonist', 'gnrh_agonist_long', 'gnrh_agonist_short', 'minimal_stimulation', 'natural_modified', 'hrt_programmed')),
  indication                          TEXT NOT NULL CHECK (indication IN ('tubal_factor', 'male_factor', 'pcos_ovulatory', 'diminished_ovarian_reserve', 'endometriosis', 'unexplained', 'genetic_pgt', 'secondary_infertility')),
  indication_notes                    TEXT,

  -- Controlled Ovarian Stimulation (COH) & Trigger
  gonadotropin_type                   TEXT,
  total_gonadotropin_dose_iu          INTEGER,
  stimulation_days                    INTEGER,
  peak_estradiol_pg_ml                REAL,
  trigger_progesterone_ng_ml          REAL,
  trigger_type                        TEXT CHECK (trigger_type IS NULL OR trigger_type IN ('rhcg_250mcg', 'urinary_hcg_10000iu', 'gnrh_agonist_dual', 'gnrh_agonist_solo_ohss_prevention')),
  trigger_datetime                    TEXT,

  -- Oocyte Retrieval (OPU) & Insemination
  opu_datetime                        TEXT,
  total_oocytes_retrieved             INTEGER DEFAULT 0,
  mature_mii_oocytes                  INTEGER DEFAULT 0,
  insemination_method                 TEXT CHECK (insemination_method IS NULL OR insemination_method IN ('standard_ivf', 'icsi', 'half_ivf_half_icsi', 'frozen_thawed')),
  fertilized_2pn_count                INTEGER DEFAULT 0,
  fertilization_rate_percent          REAL,

  -- Embryo Cohort & Transfer
  day3_embryos_count                  INTEGER DEFAULT 0,
  day5_blastocysts_count              INTEGER DEFAULT 0,
  embryos_transferred_count           INTEGER NOT NULL DEFAULT 0,
  transfer_stage                      TEXT CHECK (transfer_stage IS NULL OR transfer_stage IN ('day_3_cleavage', 'day_5_blastocyst', 'day_6_blastocyst', 'freeze_all_no_transfer')),
  transfer_datetime                   TEXT,
  transferred_embryos_details         TEXT,
  endometrial_thickness_at_transfer_mm REAL,
  transfer_difficulty                 TEXT DEFAULT 'easy' CHECK (transfer_difficulty IS NULL OR transfer_difficulty IN ('easy', 'moderate_tenaculum', 'difficult_stylet')),
  embryos_frozen_count                INTEGER NOT NULL DEFAULT 0,
  frozen_storage_straws               TEXT,

  -- Luteal Phase Support & Pregnancy Outcome
  luteal_support_regimen              TEXT,
  beta_hcg_day14_miu_ml               REAL,
  beta_hcg_day16_miu_ml               REAL,
  hcg_doubling_time_hours             REAL,
  clinical_pregnancy_status           TEXT NOT NULL DEFAULT 'cycle_in_progress' CHECK (clinical_pregnancy_status IN ('cycle_in_progress', 'biochemical_pregnancy', 'clinical_intrauterine_sac', 'ectopic_pregnancy', 'negative_not_pregnant', 'cancelled_ohss_risk', 'freeze_all')),
  gestational_sacs_count              INTEGER DEFAULT 0,
  fetal_heart_present                 INTEGER DEFAULT 0 CHECK (fetal_heart_present IN (0, 1)),
  cycle_notes                         TEXT,

  lead_embryologist                   TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_art_cycles_patient ON art_cycles(patient_id);
CREATE INDEX IF NOT EXISTS idx_art_cycles_status ON art_cycles(clinical_pregnancy_status);
CREATE INDEX IF NOT EXISTS idx_art_cycles_type ON art_cycles(cycle_type);
