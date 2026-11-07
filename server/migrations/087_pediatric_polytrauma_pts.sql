-- Migration 087: Pediatric Polytrauma Resuscitation, Pediatric Trauma Score (PTS) & Damage Control Protocol
-- References: American College of Surgeons Committee on Trauma (ACS-COT) Pediatric Trauma, ATLS 10th Edition, Tepas et al. Pediatric Trauma Score

CREATE TABLE IF NOT EXISTS pediatric_polytrauma_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  trauma_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  trauma_mechanism TEXT NOT NULL CHECK(trauma_mechanism IN (
    'motor_vehicle_collision',
    'pedestrian_vs_auto',
    'fall_greater_than_2_meters',
    'bicycle_collision',
    'penetrating_trauma',
    'crush_injury',
    'non_accidental_trauma',
    'other'
  )),
  weight_score INTEGER NOT NULL CHECK(weight_score IN (-1, 1, 2)),
  airway_score INTEGER NOT NULL CHECK(airway_score IN (-1, 1, 2)),
  systolic_bp_score INTEGER NOT NULL CHECK(systolic_bp_score IN (-1, 1, 2)),
  cns_score INTEGER NOT NULL CHECK(cns_score IN (-1, 1, 2)),
  skeletal_score INTEGER NOT NULL CHECK(skeletal_score IN (-1, 1, 2)),
  cutaneous_score INTEGER NOT NULL CHECK(cutaneous_score IN (-1, 1, 2)),
  total_pts_score INTEGER NOT NULL CHECK(total_pts_score BETWEEN -6 AND 12),
  pts_mortality_tier TEXT NOT NULL CHECK(pts_mortality_tier IN (
    'critical_high_mortality_le_8',
    'moderate_potential_lethal_9_10',
    'minor_low_mortality_11_12'
  )),
  fast_exam_positive INTEGER NOT NULL DEFAULT 0 CHECK(fast_exam_positive IN (0, 1)),
  pelvic_binder_placed INTEGER NOT NULL DEFAULT 0 CHECK(pelvic_binder_placed IN (0, 1)),
  txa_administered INTEGER NOT NULL DEFAULT 0 CHECK(txa_administered IN (0, 1)),
  txa_dose_mg REAL,
  pediatric_mtp_activated INTEGER NOT NULL DEFAULT 0 CHECK(pediatric_mtp_activated IN (0, 1)),
  prbc_volume_ml REAL NOT NULL DEFAULT 0,
  ffp_volume_ml REAL NOT NULL DEFAULT 0,
  platelets_volume_ml REAL NOT NULL DEFAULT 0,
  initial_gcs INTEGER NOT NULL CHECK(initial_gcs BETWEEN 3 AND 15),
  initial_sbp INTEGER NOT NULL,
  initial_heart_rate INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'acute_trauma_bay' CHECK(status IN (
    'acute_trauma_bay',
    'emergent_or_surgery',
    'picu_damage_control',
    'stepdown_ward',
    'convalescent'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_polytrauma_patient ON pediatric_polytrauma_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_polytrauma_status ON pediatric_polytrauma_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_polytrauma_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  polytrauma_episode_id INTEGER NOT NULL REFERENCES pediatric_polytrauma_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_arrival INTEGER NOT NULL DEFAULT 0,
  gcs_total INTEGER NOT NULL CHECK(gcs_total BETWEEN 3 AND 15),
  sbp_mmhg INTEGER NOT NULL,
  dbp_mmhg INTEGER,
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,
  temperature_celsius REAL NOT NULL,
  cumulative_crystalloid_ml REAL NOT NULL DEFAULT 0,
  cumulative_prbc_ml REAL NOT NULL DEFAULT 0,
  cumulative_ffp_ml REAL NOT NULL DEFAULT 0,
  cumulative_platelets_ml REAL NOT NULL DEFAULT 0,
  urine_output_ml_kg_hr REAL,
  pupil_status TEXT NOT NULL DEFAULT 'equal_reactive' CHECK(pupil_status IN (
    'equal_reactive',
    'sluggish_asymmetric',
    'unilateral_dilated_fixed',
    'bilateral_fixed_dilated'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_polytrauma_logs_episode ON pediatric_polytrauma_flowsheet_logs(polytrauma_episode_id);
