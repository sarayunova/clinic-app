-- Migration 104: Obstetric Umbilical Cord Prolapse & Emergent Decompression Protocol
-- References: RCOG Green-top Guideline No. 50; ACOG Practice Bulletin; SOGC Clinical Practice Guidelines

CREATE TABLE IF NOT EXISTS obstetric_cord_prolapse_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  detection_datetime TEXT NOT NULL,
  maternal_age INTEGER,
  gestational_age_weeks REAL NOT NULL,
  cervical_dilation_cm REAL NOT NULL CHECK(cervical_dilation_cm >= 0.0 AND cervical_dilation_cm <= 10.0),
  membrane_status TEXT NOT NULL CHECK(membrane_status IN (
    'ruptured_artificial',
    'ruptured_spontaneous',
    'intact_funicular_presentation'
  )),
  fetal_presentation TEXT NOT NULL CHECK(fetal_presentation IN (
    'cephalic_vertex',
    'breech_frank',
    'breech_complete_footling',
    'transverse_shoulder',
    'compound'
  )),
  prolapse_type TEXT NOT NULL CHECK(prolapse_type IN (
    'overt_cord_visible_or_in_vagina',
    'occult_cord_adjacent_to_head'
  )),
  cord_pulsation_present INTEGER NOT NULL DEFAULT 1 CHECK(cord_pulsation_present IN (0, 1)),
  baseline_fhr_bpm INTEGER NOT NULL CHECK(baseline_fhr_bpm >= 40 AND baseline_fhr_bpm <= 220),
  fhr_deceleration_type TEXT NOT NULL CHECK(fhr_deceleration_type IN (
    'prolonged_bradycardia',
    'severe_variable_decelerations',
    'normal_fhr_reassuring'
  )),

  -- Time-Critical Decompression Interventions
  manual_elevation_performed INTEGER NOT NULL DEFAULT 1 CHECK(manual_elevation_performed IN (0, 1)),
  maternal_positioning TEXT NOT NULL CHECK(maternal_positioning IN (
    'knee_chest_genupectoral',
    'exaggerated_trendelenburg',
    'left_lateral_with_pillow',
    'supine_unfavorable'
  )),
  bladder_filling_performed INTEGER NOT NULL DEFAULT 0 CHECK(bladder_filling_performed IN (0, 1)),
  bladder_saline_volume_ml INTEGER NOT NULL DEFAULT 0 CHECK(bladder_saline_volume_ml >= 0 AND bladder_saline_volume_ml <= 1000),
  tocolysis_administered INTEGER NOT NULL DEFAULT 0 CHECK(tocolysis_administered IN (0, 1)),
  tocolysis_agent TEXT NOT NULL CHECK(tocolysis_agent IN (
    'none',
    'terbutaline_sc',
    'salbutamol_iv',
    'nitroglycerin_sublingual'
  )) DEFAULT 'none',
  cord_manipulation_avoided INTEGER NOT NULL DEFAULT 1 CHECK(cord_manipulation_avoided IN (0, 1)),
  cord_wrapped_warm_saline INTEGER NOT NULL DEFAULT 1 CHECK(cord_wrapped_warm_saline IN (0, 1)),

  -- Emergency Delivery & Neonatal Status
  delivery_mode TEXT NOT NULL CHECK(delivery_mode IN (
    'category_1_emergency_cesarean',
    'assisted_operative_vaginal_vacuum',
    'assisted_operative_vaginal_forceps',
    'spontaneous_vaginal_imminent'
  )),
  decision_to_delivery_minutes INTEGER CHECK(decision_to_delivery_minutes IS NULL OR (decision_to_delivery_minutes >= 1 AND decision_to_delivery_minutes <= 120)),
  apgar_1min INTEGER CHECK(apgar_1min IS NULL OR (apgar_1min >= 0 AND apgar_1min <= 10)),
  apgar_5min INTEGER CHECK(apgar_5min IS NULL OR (apgar_5min >= 0 AND apgar_5min <= 10)),
  umbilical_arterial_ph REAL CHECK(umbilical_arterial_ph IS NULL OR (umbilical_arterial_ph >= 6.5 AND umbilical_arterial_ph <= 7.6)),

  status TEXT NOT NULL DEFAULT 'emergent_decompression_active' CHECK(status IN (
    'emergent_decompression_active',
    'operating_room_in_transit',
    'delivered_neonatal_resuscitation',
    'postpartum_surveillance_stable'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cord_prolapse_patient ON obstetric_cord_prolapse_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_cord_prolapse_status ON obstetric_cord_prolapse_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_cord_prolapse_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cord_prolapse_episode_id INTEGER NOT NULL REFERENCES obstetric_cord_prolapse_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_detection INTEGER NOT NULL DEFAULT 0,

  fetal_heart_rate_bpm INTEGER NOT NULL,
  cord_pulsation_palpable INTEGER NOT NULL DEFAULT 1 CHECK(cord_pulsation_palpable IN (0, 1)),
  manual_elevation_maintained INTEGER NOT NULL DEFAULT 1 CHECK(manual_elevation_maintained IN (0, 1)),
  maternal_blood_pressure_sys INTEGER NOT NULL,
  maternal_blood_pressure_dia INTEGER NOT NULL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cord_prolapse_flowsheet_ep ON obstetric_cord_prolapse_flowsheet_logs(cord_prolapse_episode_id);
