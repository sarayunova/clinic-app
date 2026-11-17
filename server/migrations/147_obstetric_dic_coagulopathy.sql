-- Series 41B: Obstetric Disseminated Intravascular Coagulation (DIC) & Fibrinogen-Guided Resuscitation
CREATE TABLE IF NOT EXISTS obstetric_dic_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  episode_number TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestational_age_weeks REAL,
  clinical_trigger TEXT NOT NULL, -- 'placental_abruption', 'severe_pph', 'amniotic_fluid_embolism', 'severe_preeclampsia_hellp', 'septic_abortion_chorioamnionitis', 'retained_dead_fetus', 'acute_fatty_liver'
  platelet_count_k_ul REAL NOT NULL,
  fibrinogen_mg_dl REAL NOT NULL,
  prothrombin_time_sec REAL,
  control_pt_sec REAL,
  inr REAL NOT NULL,
  aptt_sec REAL,
  d_dimer_ug_ml REAL,
  estimated_blood_loss_ml REAL NOT NULL DEFAULT 0,
  overt_bleeding_sites TEXT NOT NULL, -- 'none', 'surgical_site_oozing', 'iv_cannula_sites', 'hematuria_gi', 'catastrophic_generalized'
  is_mtp_activated INTEGER NOT NULL DEFAULT 0,
  prbc_units_given INTEGER NOT NULL DEFAULT 0,
  ffp_units_given INTEGER NOT NULL DEFAULT 0,
  platelet_pools_given INTEGER NOT NULL DEFAULT 0,
  cryoprecipitate_units_given INTEGER NOT NULL DEFAULT 0,
  fibrinogen_concentrate_g_given REAL NOT NULL DEFAULT 0,
  tranexamic_acid_given INTEGER NOT NULL DEFAULT 0,
  ionized_calcium_mmol_l REAL,
  core_temperature_c REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'stabilized', 'resolved', 'transferred')),
  clinical_summary TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_dic_patient ON obstetric_dic_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_dic_status ON obstetric_dic_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_dic_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES obstetric_dic_episodes(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  systolic_bp INTEGER,
  diastolic_bp INTEGER,
  heart_rate_bpm INTEGER,
  spo2_percent REAL,
  hourly_blood_loss_ml REAL NOT NULL DEFAULT 0,
  serial_fibrinogen_mg_dl REAL,
  serial_platelets_k_ul REAL,
  serial_inr REAL,
  urine_output_ml_hr REAL,
  blood_components_infused TEXT,
  clinical_hemostasis_state TEXT NOT NULL, -- 'uncontrolled_diffuse_ooze', 'partial_clot_formation', 'firm_hemostatic_clots', 'bleeding_controlled'
  nurse_notes TEXT,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_dic_flowsheet_episode ON obstetric_dic_flowsheet_logs(episode_id);
