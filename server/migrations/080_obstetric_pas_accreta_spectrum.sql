-- Migration 080: Placenta Accreta Spectrum (PAS) FIGO / SMFM Staging & MDT Cesarean Hysterectomy Protocol
-- Reference: FIGO Consensus Guidelines on Placenta Accreta Spectrum Disorders (2018), SMFM Consult Series #60 (2021)

CREATE TABLE IF NOT EXISTS obstetric_pas_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  evaluation_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,
  previous_cesareans_count INTEGER NOT NULL DEFAULT 0,
  placenta_previa_present INTEGER NOT NULL DEFAULT 1 CHECK(placenta_previa_present IN (0, 1)),
  prior_uterine_surgeries_json TEXT NOT NULL DEFAULT '[]',
  loss_of_clear_zone INTEGER NOT NULL DEFAULT 1 CHECK(loss_of_clear_zone IN (0, 1)),
  myometrial_thickness_less_1mm INTEGER NOT NULL DEFAULT 1 CHECK(myometrial_thickness_less_1mm IN (0, 1)),
  lacunae_grade INTEGER NOT NULL DEFAULT 1 CHECK(lacunae_grade BETWEEN 0 AND 3),
  subplacental_hypervascularity INTEGER NOT NULL DEFAULT 1 CHECK(subplacental_hypervascularity IN (0, 1)),
  bridging_vessels_to_bladder INTEGER NOT NULL DEFAULT 0 CHECK(bridging_vessels_to_bladder IN (0, 1)),
  mri_performed INTEGER NOT NULL DEFAULT 0 CHECK(mri_performed IN (0, 1)),
  mri_findings TEXT,
  pas_grade TEXT NOT NULL CHECK(pas_grade IN ('grade_1_accreta', 'grade_2_increta', 'grade_3_percreta')),
  mdt_members_json TEXT NOT NULL DEFAULT '[]',
  ir_embolization_planned INTEGER NOT NULL DEFAULT 0 CHECK(ir_embolization_planned IN (0, 1)),
  ureteral_stents_planned INTEGER NOT NULL DEFAULT 0 CHECK(ureteral_stents_planned IN (0, 1)),
  cell_saver_requested INTEGER NOT NULL DEFAULT 1 CHECK(cell_saver_requested IN (0, 1)),
  prbc_units_reserved INTEGER NOT NULL DEFAULT 4,
  ffp_units_reserved INTEGER NOT NULL DEFAULT 4,
  platelet_units_reserved INTEGER NOT NULL DEFAULT 2,
  planned_delivery_weeks REAL NOT NULL DEFAULT 34.5,
  planned_delivery_datetime TEXT,
  surgical_approach TEXT NOT NULL DEFAULT 'planned_cesarean_hysterectomy' CHECK(surgical_approach IN (
    'planned_cesarean_hysterectomy',
    'delayed_hysterectomy',
    'conservative_uterine_preservation'
  )),
  status TEXT NOT NULL DEFAULT 'antepartum_planning' CHECK(status IN (
    'antepartum_planning',
    'preoperative_optimization',
    'intraoperative_active',
    'postoperative_recovery',
    'discharged'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_pas_patient ON obstetric_pas_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_pas_status ON obstetric_pas_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_pas_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pas_episode_id INTEGER NOT NULL REFERENCES obstetric_pas_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,
  antenatal_bleeding_episode INTEGER NOT NULL DEFAULT 0 CHECK(antenatal_bleeding_episode IN (0, 1)),
  vaginal_bleeding_ml REAL NOT NULL DEFAULT 0,
  maternal_sbp INTEGER,
  maternal_dbp INTEGER,
  maternal_hr INTEGER,
  ctg_category TEXT NOT NULL DEFAULT 'category_1' CHECK(ctg_category IN ('category_1', 'category_2', 'category_3')),
  hemoglobin_g_dl REAL,
  crossmatch_units_confirmed INTEGER NOT NULL DEFAULT 1 CHECK(crossmatch_units_confirmed IN (0, 1)),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_pas_logs_episode ON obstetric_pas_flowsheet_logs(pas_episode_id);
