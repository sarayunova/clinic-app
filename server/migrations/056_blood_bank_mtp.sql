-- Series 11B: Blood Bank Cross-Match Requisition & Massive Transfusion Protocol (MTP) Flowsheet

CREATE TABLE IF NOT EXISTS blood_requisitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  admission_id INTEGER REFERENCES admissions(id),
  ot_schedule_id INTEGER REFERENCES ot_schedules(id),
  requisition_number TEXT NOT NULL UNIQUE,
  blood_group_abo TEXT NOT NULL DEFAULT 'UNKNOWN', -- A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG, UNKNOWN
  urgency TEXT NOT NULL DEFAULT 'ROUTINE', -- ROUTINE, URGENT_WITHIN_2HR, STAT_EMERGENCY_UNMATCHED
  clinical_indication TEXT NOT NULL,
  prbc_units INTEGER NOT NULL DEFAULT 0,
  ffp_units INTEGER NOT NULL DEFAULT 0,
  platelet_units INTEGER NOT NULL DEFAULT 0,
  cryoprecipitate_units INTEGER NOT NULL DEFAULT 0,
  whole_blood_units INTEGER NOT NULL DEFAULT 0,
  special_requirements TEXT, -- JSON or comma-separated e.g. leukodepleted, irradiated, cmv_negative
  status TEXT NOT NULL DEFAULT 'REQUESTED', -- REQUESTED, SAMPLE_RECEIVED, CROSSMATCHED, ISSUED, PARTIALLY_TRANSFUSED, COMPLETED, CANCELLED
  requesting_doctor_id INTEGER NOT NULL REFERENCES users(id),
  requesting_doctor_name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blood_req_patient ON blood_requisitions(patient_id);
CREATE INDEX IF NOT EXISTS idx_blood_req_status ON blood_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_blood_req_urgency ON blood_requisitions(urgency);

CREATE TABLE IF NOT EXISTS massive_transfusion_activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  admission_id INTEGER REFERENCES admissions(id),
  ot_schedule_id INTEGER REFERENCES ot_schedules(id),
  mtp_code TEXT NOT NULL UNIQUE,
  activation_time TEXT NOT NULL,
  activated_by_id INTEGER NOT NULL REFERENCES users(id),
  activated_by_name TEXT NOT NULL,
  trigger_reason TEXT NOT NULL, -- PPH_ATONY, PLACENTA_ACCRETA_SPECTRUM, UTERINE_RUPTURE, SURGICAL_TRAUMA, ABRUPTIO_PLACENTAE_DIC, ECTOPIC_HEMORRHAGE, OTHER
  baseline_shock_index REAL,
  baseline_estimated_blood_loss_ml INTEGER DEFAULT 1000,
  current_pack_round INTEGER NOT NULL DEFAULT 1,
  total_prbc_transfused INTEGER NOT NULL DEFAULT 0,
  total_ffp_transfused INTEGER NOT NULL DEFAULT 0,
  total_platelets_transfused INTEGER NOT NULL DEFAULT 0,
  total_cryo_transfused INTEGER NOT NULL DEFAULT 0,
  txa_given INTEGER NOT NULL DEFAULT 0, -- 1=true, 0=false
  calcium_gluconate_given INTEGER NOT NULL DEFAULT 0,
  deactivation_time TEXT,
  deactivated_by_name TEXT,
  outcome_summary TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DEACTIVATED, CANCELLED
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mtp_patient ON massive_transfusion_activations(patient_id);
CREATE INDEX IF NOT EXISTS idx_mtp_status ON massive_transfusion_activations(status);

CREATE TABLE IF NOT EXISTS mtp_flowsheet_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mtp_id INTEGER NOT NULL REFERENCES massive_transfusion_activations(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_start_time TEXT NOT NULL,
  prbc_issued INTEGER NOT NULL DEFAULT 0,
  prbc_transfused INTEGER NOT NULL DEFAULT 0,
  ffp_issued INTEGER NOT NULL DEFAULT 0,
  ffp_transfused INTEGER NOT NULL DEFAULT 0,
  platelets_issued INTEGER NOT NULL DEFAULT 0,
  platelets_transfused INTEGER NOT NULL DEFAULT 0,
  cryo_issued INTEGER NOT NULL DEFAULT 0,
  cryo_transfused INTEGER NOT NULL DEFAULT 0,
  temp_celsius REAL,
  heart_rate INTEGER,
  blood_pressure_sys INTEGER,
  blood_pressure_dia INTEGER,
  spo2 INTEGER,
  hb_g_dl REAL,
  platelets_k_ul INTEGER,
  inr REAL,
  fibrinogen_mg_dl REAL,
  ionized_calcium_mmol_l REAL,
  ph_abg REAL,
  lactate_mmol_l REAL,
  clinical_notes TEXT,
  recorded_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mtp_rounds_mtp_id ON mtp_flowsheet_rounds(mtp_id);

CREATE TABLE IF NOT EXISTS blood_transfusion_administrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_id INTEGER REFERENCES blood_requisitions(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  mtp_id INTEGER REFERENCES massive_transfusion_activations(id),
  unit_number TEXT NOT NULL,
  component_type TEXT NOT NULL, -- PRBC, FFP, PLATELET_RDP, PLATELET_SDP, CRYOPRECIPITATE, WHOLE_BLOOD
  unit_blood_group TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  two_nurse_verifier_1 TEXT NOT NULL,
  two_nurse_verifier_2 TEXT NOT NULL,
  pre_vitals_temp REAL,
  pre_vitals_hr INTEGER,
  pre_vitals_bp TEXT,
  vitals_15m_temp REAL,
  vitals_15m_hr INTEGER,
  vitals_15m_bp TEXT,
  post_vitals_temp REAL,
  post_vitals_hr INTEGER,
  post_vitals_bp TEXT,
  adverse_reaction_observed INTEGER NOT NULL DEFAULT 0,
  reaction_type TEXT, -- NONE, FEBRILE_NON_HEMOLYTIC, ALLERGIC_URTICARIAL, ACUTE_HEMOLYTIC, TRALI, TACO, BACTERIAL_SEPSIS, OTHER
  reaction_details TEXT,
  action_taken TEXT,
  transfusion_status TEXT NOT NULL DEFAULT 'TRANSFUSING', -- TRANSFUSING, COMPLETED, STOPPED_REACTION, DISCARDED
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transfusion_patient ON blood_transfusion_administrations(patient_id);
CREATE INDEX IF NOT EXISTS idx_transfusion_status ON blood_transfusion_administrations(transfusion_status);
