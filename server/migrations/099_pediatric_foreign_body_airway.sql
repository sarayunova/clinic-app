-- Migration 099: Pediatric Foreign Body Airway Obstruction & Choking Emergency Protocol
-- References: AAP / AHA PALS Guidelines for Foreign Body Airway Obstruction (FBAO); ILCOR Pediatric Resuscitation

CREATE TABLE IF NOT EXISTS pediatric_foreign_body_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  incident_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,

  -- Incident Details & Clinical Presentation
  witnessed_choking_episode INTEGER NOT NULL DEFAULT 1 CHECK(witnessed_choking_episode IN (0, 1)),
  suspected_foreign_body_nature TEXT NOT NULL CHECK(suspected_foreign_body_nature IN (
    'organic_food_nut_seed',
    'small_toy_plastic_bead',
    'coin_metallic_battery',
    'balloon_latex',
    'unknown_material'
  )),
  obstruction_severity TEXT NOT NULL CHECK(obstruction_severity IN (
    'mild_incomplete_effective_cough',
    'severe_complete_ineffective_cough',
    'unconscious_cardiorespiratory_arrest'
  )),
  stridor_or_aphonia INTEGER NOT NULL DEFAULT 1 CHECK(stridor_or_aphonia IN (0, 1)),
  cyanosis_present INTEGER NOT NULL DEFAULT 0 CHECK(cyanosis_present IN (0, 1)),
  silent_chest_noted INTEGER NOT NULL DEFAULT 0 CHECK(silent_chest_noted IN (0, 1)),

  -- Vital Signs
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,

  -- Resuscitation Maneuvers & Safety Auditing
  intervention_applied TEXT NOT NULL CHECK(intervention_applied IN (
    'encouraged_spontaneous_coughing',
    'back_blows_and_chest_thrusts_infant',
    'subdiaphragmatic_heimlich_child',
    'cpr_chest_compressions_ventilations',
    'rigid_bronchoscopy_or_surgical_airway'
  )),
  blind_finger_sweep_avoided INTEGER NOT NULL DEFAULT 1 CHECK(blind_finger_sweep_avoided IN (0, 1)),
  foreign_body_expelled INTEGER NOT NULL DEFAULT 0 CHECK(foreign_body_expelled IN (0, 1)),
  spontaneous_respiration_restored INTEGER NOT NULL DEFAULT 0 CHECK(spontaneous_respiration_restored IN (0, 1)),
  rigid_bronchoscopy_required INTEGER NOT NULL DEFAULT 0 CHECK(rigid_bronchoscopy_required IN (0, 1)),
  bronchoscopy_location TEXT DEFAULT 'none' CHECK(bronchoscopy_location IN (
    'none',
    'trachea_carina',
    'right_main_bronchus',
    'left_main_bronchus',
    'segmental_bronchi'
  )),

  status TEXT NOT NULL DEFAULT 'acute_choking_management' CHECK(status IN (
    'acute_choking_management',
    'post_clearance_observation',
    'picu_escalation_bronchoscopy',
    'discharged_home_stable'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_fbao_patient ON pediatric_foreign_body_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_fbao_status ON pediatric_foreign_body_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_foreign_body_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  foreign_body_episode_id INTEGER NOT NULL REFERENCES pediatric_foreign_body_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_choking INTEGER NOT NULL DEFAULT 0,

  mental_status TEXT NOT NULL CHECK(mental_status IN (
    'alert_vocalizing',
    'irritable_lethargic',
    'unresponsive_coma'
  )),
  airway_patency TEXT NOT NULL CHECK(airway_patency IN (
    'clear_normal_air_entry',
    'partial_wheeze_stridor',
    'silent_complete_obstruction'
  )),
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,

  intervention_cycle TEXT NOT NULL CHECK(intervention_cycle IN (
    'reassurance_and_spontaneous_coughing',
    'five_back_slaps_five_chest_thrusts',
    'subdiaphragmatic_heimlich_thrusts',
    'cpr_with_direct_laryngoscopy_removal',
    'urgent_or_rigid_bronchoscopy'
  )),
  foreign_object_visualized_or_removed INTEGER NOT NULL DEFAULT 0 CHECK(foreign_object_visualized_or_removed IN (0, 1)),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_fbao_flowsheet_ep ON pediatric_foreign_body_flowsheet_logs(foreign_body_episode_id);
