-- Migration 106: Neonatal Meconium Aspiration Syndrome (MAS) & Pulmonary Hypertension Rescue
-- References: AAP Neonatal Resuscitation Program (NRP 8th Ed); Cochrane Reviews on Surfactant in MAS; NeoReviews; Gomella's Neonatology

CREATE TABLE IF NOT EXISTS neonatal_mas_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  chronological_age_hours REAL NOT NULL,
  current_weight_kg REAL NOT NULL,

  -- Delivery & Aspiration Characteristics
  amniotic_fluid_meconium_consistency TEXT NOT NULL CHECK(amniotic_fluid_meconium_consistency IN (
    'thick_particulate_pea_soup',
    'moderate_meconium',
    'thin_light_meconium'
  )),
  delivery_room_vigor TEXT NOT NULL CHECK(delivery_room_vigor IN (
    'non_vigorous_depressed',
    'vigorous_active'
  )),
  endotracheal_suctioning_performed INTEGER NOT NULL DEFAULT 0 CHECK(endotracheal_suctioning_performed IN (0, 1)),
  meconium_cleared_below_cords INTEGER NOT NULL DEFAULT 0 CHECK(meconium_cleared_below_cords IN (0, 1)),
  apgar_1min INTEGER CHECK(apgar_1min IS NULL OR (apgar_1min >= 0 AND apgar_1min <= 10)),
  apgar_5min INTEGER CHECK(apgar_5min IS NULL OR (apgar_5min >= 0 AND apgar_5min <= 10)),

  -- Respiratory & Hemodynamic Metrics
  respiratory_support_mode TEXT NOT NULL CHECK(respiratory_support_mode IN (
    'room_air_low_flow_o2',
    'nasal_cpap_bubble',
    'non_invasive_nipv',
    'conventional_mechanical_ventilation',
    'high_frequency_oscillatory_ventilation',
    'ecmo_rescue'
  )),
  fio2_percent REAL NOT NULL CHECK(fio2_percent >= 21.0 AND fio2_percent <= 100.0),
  mean_airway_pressure_cmh2o REAL NOT NULL CHECK(mean_airway_pressure_cmh2o >= 4.0 AND mean_airway_pressure_cmh2o <= 35.0),
  pao2_mmhg REAL CHECK(pao2_mmhg IS NULL OR (pao2_mmhg >= 15.0 AND pao2_mmhg <= 400.0)),
  paco2_mmhg REAL CHECK(paco2_mmhg IS NULL OR (paco2_mmhg >= 15.0 AND paco2_mmhg <= 150.0)),
  arterial_ph REAL CHECK(arterial_ph IS NULL OR (arterial_ph >= 6.7 AND arterial_ph <= 7.7)),
  oxygenation_index REAL, -- Calculated: (MAP * FiO2 / PaO2)

  -- Pulmonary Hypertension & Air Leak
  pre_post_ductal_spo2_diff_percent REAL,
  echocardiogram_pphn_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(echocardiogram_pphn_confirmed IN (0, 1)),
  pphn_severity TEXT NOT NULL CHECK(pphn_severity IN (
    'none_or_not_assessed',
    'mild_right_ventricular_strain',
    'moderate_suprasystemic_shunting',
    'severe_refractory_right_to_left'
  )) DEFAULT 'none_or_not_assessed',
  pulmonary_air_leak_present INTEGER NOT NULL DEFAULT 0 CHECK(pulmonary_air_leak_present IN (0, 1)), -- Pneumothorax / pneumomediastinum
  air_leak_type TEXT NOT NULL CHECK(air_leak_type IN (
    'none',
    'pneumothorax_tension',
    'pneumothorax_simple',
    'pneumomediastinum',
    'pulmonary_interstitial_emphysema'
  )) DEFAULT 'none',

  -- Therapeutics
  surfactant_administered INTEGER NOT NULL DEFAULT 0 CHECK(surfactant_administered IN (0, 1)),
  surfactant_delivery_method TEXT NOT NULL CHECK(surfactant_delivery_method IN (
    'none',
    'bolus_endotracheal',
    'dilute_surfactant_bronchoalveolar_lavage'
  )) DEFAULT 'none',
  surfactant_dose_mg_kg REAL DEFAULT 0,
  inhaled_nitric_oxide_prescribed INTEGER NOT NULL DEFAULT 0 CHECK(inhaled_nitric_oxide_prescribed IN (0, 1)),
  ino_dose_ppm REAL DEFAULT 0 CHECK(ino_dose_ppm >= 0.0 AND ino_dose_ppm <= 40.0),
  empiric_antibiotics_active INTEGER NOT NULL DEFAULT 1 CHECK(empiric_antibiotics_active IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'acute_respiratory_failure' CHECK(status IN (
    'acute_respiratory_failure',
    'hfov_ino_escalation',
    'weaning_recovering',
    'resolved_extubated',
    'ecmo_transferred'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_mas_patient ON neonatal_mas_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_mas_status ON neonatal_mas_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_mas_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mas_episode_id INTEGER NOT NULL REFERENCES neonatal_mas_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_admission REAL NOT NULL DEFAULT 0,

  respiratory_rate INTEGER NOT NULL,
  heart_rate_bpm INTEGER NOT NULL,
  pre_ductal_spo2_percent REAL NOT NULL,
  post_ductal_spo2_percent REAL NOT NULL,
  fio2_percent REAL NOT NULL,
  mean_airway_pressure_cmh2o REAL NOT NULL,
  pao2_mmhg REAL,
  paco2_mmhg REAL,
  arterial_ph REAL,
  oxygenation_index REAL,
  ino_dose_ppm REAL DEFAULT 0,
  mean_blood_pressure_mmhg REAL NOT NULL,
  chest_tube_drainage_active INTEGER NOT NULL DEFAULT 0 CHECK(chest_tube_drainage_active IN (0, 1)),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_mas_flowsheet_ep ON neonatal_mas_flowsheet_logs(mas_episode_id);
