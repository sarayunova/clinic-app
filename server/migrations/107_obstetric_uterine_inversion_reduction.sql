-- Migration 107: Obstetric Uterine Inversion & Emergent Reduction Protocol
-- References: RCOG Green-top Guidelines; ACOG Practice Bulletin; WHO Postpartum Emergencies; Williams Obstetrics (26th Ed)

CREATE TABLE IF NOT EXISTS obstetric_uterine_inversion_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  occurrence_datetime TEXT NOT NULL,
  maternal_age INTEGER,
  parity INTEGER NOT NULL DEFAULT 1,
  delivery_mode TEXT NOT NULL CHECK(delivery_mode IN (
    'spontaneous_vaginal',
    'operative_vaginal_vacuum',
    'operative_vaginal_forceps',
    'cesarean_section'
  )),

  -- Presentation & Degree
  placental_status_at_inversion TEXT NOT NULL CHECK(placental_status_at_inversion IN (
    'attached_undelivered',
    'partially_separated',
    'completely_separated'
  )),
  umbilical_cord_traction_applied INTEGER NOT NULL DEFAULT 0 CHECK(umbilical_cord_traction_applied IN (0, 1)),
  fundal_pressure_applied INTEGER NOT NULL DEFAULT 0 CHECK(fundal_pressure_applied IN (0, 1)),
  inversion_degree TEXT NOT NULL CHECK(inversion_degree IN (
    'first_degree_incomplete_intrauterine',
    'second_degree_complete_through_cervix',
    'third_degree_prolapsed_outside_introitus',
    'fourth_degree_total_inversion_with_vagina'
  )),

  -- Hemodynamic & Shock State
  neurogenic_shock_present INTEGER NOT NULL DEFAULT 0 CHECK(neurogenic_shock_present IN (0, 1)),
  systolic_bp_at_presentation INTEGER NOT NULL,
  diastolic_bp_at_presentation INTEGER NOT NULL,
  heart_rate_at_presentation INTEGER NOT NULL,
  estimated_blood_loss_ml REAL NOT NULL CHECK(estimated_blood_loss_ml >= 0.0),

  -- Emergency Reduction Management
  reduction_attempted_immediate INTEGER NOT NULL DEFAULT 1 CHECK(reduction_attempted_immediate IN (0, 1)),
  reduction_technique_primary TEXT NOT NULL CHECK(reduction_technique_primary IN (
    'johnson_manual_maneuver',
    'osullivan_hydrostatic_technique',
    'laparotomy_huntington_procedure',
    'laparotomy_haultain_procedure'
  )),
  uterine_relaxant_administered INTEGER NOT NULL DEFAULT 0 CHECK(uterine_relaxant_administered IN (0, 1)),
  uterine_relaxant_agent TEXT NOT NULL CHECK(uterine_relaxant_agent IN (
    'none',
    'terbutaline_sc',
    'nitroglycerin_iv',
    'magnesium_sulfate',
    'general_halogenated_anesthesia'
  )) DEFAULT 'none',
  uterotonic_given_before_replacement INTEGER NOT NULL DEFAULT 0 CHECK(uterotonic_given_before_replacement IN (0, 1)),
  placenta_removed_before_reinversion INTEGER NOT NULL DEFAULT 0 CHECK(placenta_removed_before_reinversion IN (0, 1)),

  -- Stabilization & Outcome
  reinversion_successful INTEGER NOT NULL DEFAULT 0 CHECK(reinversion_successful IN (0, 1)),
  time_to_reinversion_minutes INTEGER CHECK(time_to_reinversion_minutes IS NULL OR (time_to_reinversion_minutes >= 1 AND time_to_reinversion_minutes <= 180)),
  post_replacement_uterotonics_started INTEGER NOT NULL DEFAULT 1 CHECK(post_replacement_uterotonics_started IN (0, 1)),
  bimanual_uterine_compression_maintained INTEGER NOT NULL DEFAULT 1 CHECK(bimanual_uterine_compression_maintained IN (0, 1)),
  blood_products_transfused_units INTEGER NOT NULL DEFAULT 0 CHECK(blood_products_transfused_units >= 0),

  status TEXT NOT NULL DEFAULT 'acute_neurogenic_shock_reduction' CHECK(status IN (
    'acute_neurogenic_shock_reduction',
    'post_reinversion_bimanual_compression',
    'laparotomy_operative_repair',
    'stabilized_icu_surveillance',
    'resolved_ward_recovery'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uterine_inversion_patient ON obstetric_uterine_inversion_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_uterine_inversion_status ON obstetric_uterine_inversion_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_uterine_inversion_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inversion_episode_id INTEGER NOT NULL REFERENCES obstetric_uterine_inversion_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_inversion INTEGER NOT NULL DEFAULT 0,

  systolic_bp INTEGER NOT NULL,
  diastolic_bp INTEGER NOT NULL,
  heart_rate_bpm INTEGER NOT NULL,
  uterine_tone TEXT NOT NULL CHECK(uterine_tone IN (
    'firm_well_contracted',
    'boggy_hypotonic',
    'relaxing_re_inversion_risk'
  )),
  bimanual_compression_active INTEGER NOT NULL DEFAULT 1 CHECK(bimanual_compression_active IN (0, 1)),
  oxytocin_infusion_running INTEGER NOT NULL DEFAULT 1 CHECK(oxytocin_infusion_running IN (0, 1)),
  estimated_ongoing_blood_loss_ml REAL NOT NULL DEFAULT 0,
  urine_output_ml_hr REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uterine_inv_flowsheet_ep ON obstetric_uterine_inversion_flowsheet_logs(inversion_episode_id);
