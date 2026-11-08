-- Migration 092: Obstetric Preterm Premature Rupture of Membranes (PPROM) & Intra-Amniotic Infection (Triple I)
-- References: ACOG Practice Bulletin No. 217; SMFM Consult Series; NICHD Triple I Diagnostic Criteria

CREATE TABLE IF NOT EXISTS obstetric_pprom_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  rupture_datetime TEXT NOT NULL,
  presentation_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,

  -- Rupture Confirmation & Ultrasound
  rupture_confirmation_method TEXT NOT NULL CHECK(rupture_confirmation_method IN (
    'pooling_ferning_nitrazine',
    'biochemical_amnisure_actim_prom',
    'direct_visualization',
    'ultrasound_oligohydramnios'
  )),
  amniotic_fluid_index_cm REAL,
  single_deepest_pocket_cm REAL,

  -- Latency & Neuroprotection Regimens
  latency_antibiotics_initiated INTEGER NOT NULL DEFAULT 0 CHECK(latency_antibiotics_initiated IN (0, 1)),
  latency_antibiotic_regimen TEXT NOT NULL CHECK(latency_antibiotic_regimen IN (
    'ampicillin_erythromycin_standard',
    'ampicillin_azithromycin_alternative',
    'penicillin_allergic_cefazolin_erythro',
    'vancomycin_gentamicin_severe_allergy',
    'none_not_indicated'
  )),
  antenatal_corticosteroid_status TEXT NOT NULL CHECK(antenatal_corticosteroid_status IN (
    'not_indicated_ge_34w',
    'course_initiated',
    'course_completed',
    'rescue_course_given'
  )),
  mgso4_neuroprotection_active INTEGER NOT NULL DEFAULT 0 CHECK(mgso4_neuroprotection_active IN (0, 1)),
  gbs_screening_status TEXT NOT NULL CHECK(gbs_screening_status IN ('positive', 'negative', 'unknown')),

  -- Triple I / Chorioamnionitis Markers
  maternal_temperature_celsius REAL NOT NULL,
  maternal_heart_rate_bpm INTEGER NOT NULL,
  fetal_heart_rate_bpm INTEGER NOT NULL,
  uterine_tenderness INTEGER NOT NULL DEFAULT 0 CHECK(uterine_tenderness IN (0, 1)),
  foul_cervical_discharge INTEGER NOT NULL DEFAULT 0 CHECK(foul_cervical_discharge IN (0, 1)),
  maternal_wbc_per_ul INTEGER,
  triple_i_category TEXT NOT NULL CHECK(triple_i_category IN (
    'no_infection_uncomplicated',
    'isolated_maternal_fever',
    'suspected_triple_i',
    'confirmed_triple_i'
  )),

  -- Clinical Management & Delivery Timing
  delivery_timing_plan TEXT NOT NULL CHECK(delivery_timing_plan IN (
    'expectant_management_to_34w',
    'previable_expectant_or_termination',
    'immediate_delivery_triple_i',
    'immediate_delivery_ge_34w',
    'immediate_delivery_non_reassuring_fhr'
  )),
  status TEXT NOT NULL DEFAULT 'inpatient_latency_surveillance' CHECK(status IN (
    'inpatient_latency_surveillance',
    'active_triple_i_sepsis_resuscitation',
    'labor_induction_delivery',
    'postpartum_resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_pprom_patient ON obstetric_pprom_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_pprom_status ON obstetric_pprom_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_pprom_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pprom_episode_id INTEGER NOT NULL REFERENCES obstetric_pprom_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_admission REAL NOT NULL DEFAULT 0,
  maternal_temp_c REAL NOT NULL,
  maternal_hr_bpm INTEGER NOT NULL,
  maternal_bp_sbp INTEGER NOT NULL,
  maternal_bp_dbp INTEGER NOT NULL,
  fetal_hr_bpm INTEGER NOT NULL,
  uterine_contractions_per_10min INTEGER NOT NULL DEFAULT 0,
  amniotic_fluid_character TEXT NOT NULL CHECK(amniotic_fluid_character IN (
    'clear',
    'blood_tinged',
    'purulent_malodorous'
  )),
  maternal_wbc INTEGER,
  ctg_category TEXT NOT NULL CHECK(ctg_category IN (
    'category_1_normal',
    'category_2_indeterminate',
    'category_3_abnormal'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_pprom_logs_episode ON obstetric_pprom_flowsheet_logs(pprom_episode_id);
