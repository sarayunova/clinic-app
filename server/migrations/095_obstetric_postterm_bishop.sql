-- Migration 095: Obstetric Post-Term Pregnancy, Oligohydramnios & Bishop Cervical Ripening Protocol
-- References: ACOG Practice Bulletin No. 146 (2021); SMFM Consult Series; WHO Labor Induction Guidelines

CREATE TABLE IF NOT EXISTS obstetric_postterm_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  assessment_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  postterm_classification TEXT NOT NULL CHECK(postterm_classification IN (
    'late_term_41_0_to_41_6',
    'post_term_ge_42_0'
  )),
  dating_method TEXT NOT NULL CHECK(dating_method IN (
    'first_trimester_ultrasound_crl',
    'early_second_trimester_bpd_fl',
    'reliable_lmp_concordant',
    'uncertain_dating'
  )),

  -- Antenatal Fetal Surveillance & Amniotic Fluid
  amniotic_fluid_index_cm REAL NOT NULL,
  single_deepest_pocket_cm REAL NOT NULL,
  oligohydramnios_present INTEGER NOT NULL CHECK(oligohydramnios_present IN (0, 1)),
  estimated_fetal_weight_grams REAL,
  fetal_growth_percentile REAL,
  non_stress_test_result TEXT NOT NULL CHECK(non_stress_test_result IN ('reactive', 'non_reactive')),
  biophysical_profile_score INTEGER,

  -- Modified Bishop Score Components (0 - 13)
  cervical_dilation_cm REAL NOT NULL,
  cervical_effacement_pct INTEGER NOT NULL,
  fetal_station INTEGER NOT NULL,
  cervical_consistency TEXT NOT NULL CHECK(cervical_consistency IN ('firm', 'medium', 'soft')),
  cervical_position TEXT NOT NULL CHECK(cervical_position IN ('posterior', 'midposition', 'anterior')),
  bishop_score_total INTEGER NOT NULL,
  cervix_favorable INTEGER NOT NULL CHECK(cervix_favorable IN (0, 1)),

  -- Prior Uterine Surgery & Safety Routing
  prior_cesarean_section INTEGER NOT NULL DEFAULT 0 CHECK(prior_cesarean_section IN (0, 1)),
  recommended_ripening_method TEXT NOT NULL CHECK(recommended_ripening_method IN (
    'mechanical_foley_balloon',
    'dinoprostone_pge2_insert',
    'misoprostol_pge1_oral_vaginal',
    'oxytocin_direct_infusion',
    'cesarean_delivery_indicated'
  )),

  status TEXT NOT NULL DEFAULT 'outpatient_surveillance' CHECK(status IN (
    'outpatient_surveillance',
    'inpatient_cervical_ripening',
    'oxytocin_labor_induction',
    'cesarean_delivery',
    'postpartum_completed'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_postterm_patient ON obstetric_postterm_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_postterm_status ON obstetric_postterm_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_postterm_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postterm_episode_id INTEGER NOT NULL REFERENCES obstetric_postterm_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_ripening_start REAL NOT NULL DEFAULT 0,
  bishop_score_current INTEGER NOT NULL,
  dilation_cm REAL NOT NULL,
  effacement_pct INTEGER NOT NULL,
  contractions_per_10min INTEGER NOT NULL DEFAULT 0,
  fetal_heart_rate_bpm INTEGER NOT NULL,
  fhr_category TEXT NOT NULL CHECK(fhr_category IN ('category_1_normal', 'category_2_indeterminate', 'category_3_abnormal')),
  tachysystole_present INTEGER NOT NULL DEFAULT 0 CHECK(tachysystole_present IN (0, 1)),
  action_taken TEXT NOT NULL CHECK(action_taken IN (
    'continue_monitoring',
    'oxytocin_initiated',
    'insert_removed_spontaneous_labor',
    'insert_removed_tachysystole_terbutaline',
    'balloon_expelled_ready_amniotomy',
    'emergency_cesarean_transfer'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_postterm_logs_ep ON obstetric_postterm_flowsheet_logs(postterm_episode_id);
