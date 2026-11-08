-- Migration 098: Obstetric Shoulder Dystocia & HELPERR Emergency Protocol
-- References: RCOG Greentop Guideline No. 42 (2020); ACOG Practice Bulletin No. 178; ALSO Guidelines

CREATE TABLE IF NOT EXISTS obstetric_shoulder_dystocia_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  delivery_datetime TEXT NOT NULL,

  -- Maternal Risk Profile & Labor Factors
  maternal_age INTEGER,
  gestational_age_weeks REAL NOT NULL,
  estimated_fetal_weight_grams REAL,
  actual_birth_weight_grams REAL NOT NULL,
  gestational_diabetes INTEGER NOT NULL DEFAULT 0 CHECK(gestational_diabetes IN (0, 1)),
  operative_vaginal_delivery TEXT NOT NULL DEFAULT 'spontaneous_vaginal' CHECK(operative_vaginal_delivery IN (
    'spontaneous_vaginal',
    'vacuum_assisted',
    'forceps_assisted'
  )),

  -- Dystocia Identification & Head-to-Body Interval
  turtle_sign_observed INTEGER NOT NULL DEFAULT 1 CHECK(turtle_sign_observed IN (0, 1)),
  head_delivery_datetime TEXT NOT NULL,
  body_delivery_datetime TEXT NOT NULL,
  head_to_body_interval_seconds INTEGER NOT NULL,

  -- HELPERR Maneuvers Execution
  help_called INTEGER NOT NULL DEFAULT 1 CHECK(help_called IN (0, 1)),
  episiotomy_performed INTEGER NOT NULL DEFAULT 0 CHECK(episiotomy_performed IN (0, 1)),
  mcroberts_maneuver_success INTEGER NOT NULL DEFAULT 0 CHECK(mcroberts_maneuver_success IN (0, 1)),
  suprapubic_pressure_success INTEGER NOT NULL DEFAULT 0 CHECK(suprapubic_pressure_success IN (0, 1)),
  internal_rotational_maneuver TEXT NOT NULL DEFAULT 'none' CHECK(internal_rotational_maneuver IN (
    'none',
    'rubin_ii',
    'woods_screw',
    'reverse_woods_screw'
  )),
  internal_rotational_success INTEGER NOT NULL DEFAULT 0 CHECK(internal_rotational_success IN (0, 1)),
  posterior_arm_delivery_success INTEGER NOT NULL DEFAULT 0 CHECK(posterior_arm_delivery_success IN (0, 1)),
  gaskin_all_fours_success INTEGER NOT NULL DEFAULT 0 CHECK(gaskin_all_fours_success IN (0, 1)),
  advanced_maneuvers_required TEXT NOT NULL DEFAULT 'none' CHECK(advanced_maneuvers_required IN (
    'none',
    'intentional_clavicle_fracture_cleidotomy',
    'zavanelli_cephalic_replacement',
    'symphysiotomy'
  )),

  -- Critical Safety Auditing
  fundal_pressure_avoided INTEGER NOT NULL DEFAULT 1 CHECK(fundal_pressure_avoided IN (0, 1)),

  -- Neonatal & Maternal Outcomes
  apgar_1min INTEGER,
  apgar_5min INTEGER,
  apgar_10min INTEGER,
  umbilical_arterial_ph REAL,
  neonatal_injury TEXT NOT NULL DEFAULT 'none' CHECK(neonatal_injury IN (
    'none',
    'brachial_plexus_erb_palsy',
    'brachial_plexus_klumpke',
    'clavicular_fracture',
    'humeral_fracture',
    'hypoxic_ischemic_encephalopathy'
  )),
  postpartum_hemorrhage_observed INTEGER NOT NULL DEFAULT 0 CHECK(postpartum_hemorrhage_observed IN (0, 1)),
  perineal_tear_degree TEXT NOT NULL DEFAULT 'none_or_first_degree' CHECK(perineal_tear_degree IN (
    'none_or_first_degree',
    'second_degree',
    'third_degree_oasi',
    'fourth_degree_oasi'
  )),

  status TEXT NOT NULL DEFAULT 'resuscitation_active' CHECK(status IN (
    'resuscitation_active',
    'postpartum_hie_monitoring',
    'transferred_to_nicu',
    'discharged_stable'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shoulder_dystocia_patient ON obstetric_shoulder_dystocia_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_shoulder_dystocia_status ON obstetric_shoulder_dystocia_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_shoulder_dystocia_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shoulder_dystocia_episode_id INTEGER NOT NULL REFERENCES obstetric_shoulder_dystocia_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  seconds_from_head_delivery INTEGER NOT NULL,

  maneuver_attempted TEXT NOT NULL CHECK(maneuver_attempted IN (
    'call_help_timer_started',
    'mcroberts_hyperflexion',
    'suprapubic_rubin_i_pressure',
    'episiotomy_incision',
    'rubin_ii_internal_rotation',
    'woods_screw_rotation',
    'reverse_woods_rotation',
    'delivery_posterior_arm',
    'gaskin_all_fours_roll',
    'cleidotomy_fracture',
    'zavanelli_or_emergency_csection'
  )),
  maneuver_outcome TEXT NOT NULL CHECK(maneuver_outcome IN (
    'successful_restitution_and_delivery',
    'failed_advance_to_next_step',
    'partial_rotation_incomplete'
  )),
  traction_applied TEXT NOT NULL DEFAULT 'gentle_axial_traction_only' CHECK(traction_applied IN (
    'none',
    'gentle_axial_traction_only',
    'excessive_lateral_traction_prevented'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shoulder_dystocia_flowsheet_ep ON obstetric_shoulder_dystocia_flowsheet_logs(shoulder_dystocia_episode_id);
