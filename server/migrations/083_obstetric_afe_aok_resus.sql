-- Migration 083: Obstetric Amniotic Fluid Embolism (AFE) Emergency Clark Staging, A-OK Resuscitation & Multidisciplinary Critical Care Protocol
-- References: SMFM Consult Series #38: Amniotic Fluid Embolism (2016), Clark Diagnostic Criteria, SOAP/SOCCA Resuscitation Guidance

CREATE TABLE IF NOT EXISTS obstetric_afe_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  arrest_onset_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,
  timing_relation TEXT NOT NULL CHECK(timing_relation IN (
    'during_labor',
    'cesarean_delivery',
    'postpartum_under_30min',
    'post_dilatation_evacuation',
    'other'
  )),
  cardiorespiratory_collapse INTEGER NOT NULL DEFAULT 1 CHECK(cardiorespiratory_collapse IN (0, 1)),
  overt_dic_present INTEGER NOT NULL DEFAULT 1 CHECK(overt_dic_present IN (0, 1)),
  absence_of_fever INTEGER NOT NULL DEFAULT 1 CHECK(absence_of_fever IN (0, 1)),
  clark_criteria_met INTEGER NOT NULL DEFAULT 1 CHECK(clark_criteria_met IN (0, 1)),
  atropine_given INTEGER NOT NULL DEFAULT 0 CHECK(atropine_given IN (0, 1)),
  ondansetron_given INTEGER NOT NULL DEFAULT 0 CHECK(ondansetron_given IN (0, 1)),
  ketorolac_given INTEGER NOT NULL DEFAULT 0 CHECK(ketorolac_given IN (0, 1)),
  aok_regimen_complete INTEGER NOT NULL DEFAULT 0 CHECK(aok_regimen_complete IN (0, 1)),
  fibrinogen_mg_dl REAL,
  platelet_count INTEGER,
  pt_inr REAL,
  mtp_activated INTEGER NOT NULL DEFAULT 0 CHECK(mtp_activated IN (0, 1)),
  prbc_transfused_units INTEGER NOT NULL DEFAULT 0,
  ffp_transfused_units INTEGER NOT NULL DEFAULT 0,
  platelets_transfused_units INTEGER NOT NULL DEFAULT 0,
  cryoprecipitate_units INTEGER NOT NULL DEFAULT 0,
  pmcd_performed INTEGER NOT NULL DEFAULT 0 CHECK(pmcd_performed IN (0, 1)),
  pmcd_decision_to_delivery_minutes REAL,
  ecmo_initiated INTEGER NOT NULL DEFAULT 0 CHECK(ecmo_initiated IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'acute_resuscitation' CHECK(status IN (
    'acute_resuscitation',
    'post_cardiac_arrest_icu',
    'coagulopathy_stabilizing',
    'convalescent',
    'maternal_death'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_afe_patient ON obstetric_afe_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_afe_status ON obstetric_afe_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_afe_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  afe_episode_id INTEGER NOT NULL REFERENCES obstetric_afe_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_arrest REAL NOT NULL DEFAULT 0,
  sbp_mmhg INTEGER,
  dbp_mmhg INTEGER,
  hr_bpm INTEGER,
  spo2_percent REAL,
  etco2_mmhg REAL,
  vasopressor_active TEXT NOT NULL DEFAULT 'none' CHECK(vasopressor_active IN (
    'none',
    'epinephrine',
    'norepinephrine',
    'vasopressin',
    'multiple'
  )),
  fibrinogen_mg_dl REAL,
  platelet_count INTEGER,
  inr REAL,
  qbl_total_ml REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_afe_logs_episode ON obstetric_afe_flowsheet_logs(afe_episode_id);
