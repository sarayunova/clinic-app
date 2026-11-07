-- Migration 079: Neonatal Necrotizing Enterocolitis (NEC) Modified Bell's Staging & Surgical Decompression Protocol
-- Reference: Modified Bell's Staging Criteria (Walsh & Kliegman), BAPM Neonatal Enteral & Surgical Consensus

CREATE TABLE IF NOT EXISTS neonatal_nec_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  onset_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  current_weight_grams REAL NOT NULL,
  bell_stage TEXT NOT NULL CHECK(bell_stage IN (
    'stage_1a_suspected',
    'stage_1b_suspected',
    'stage_2a_definite_mild',
    'stage_2b_definite_moderate',
    'stage_3a_advanced_intact',
    'stage_3b_advanced_perforated'
  )),
  systemic_signs_json TEXT NOT NULL DEFAULT '[]',
  intestinal_signs_json TEXT NOT NULL DEFAULT '[]',
  radiological_signs_json TEXT NOT NULL DEFAULT '[]',
  abg_ph REAL,
  base_excess REAL,
  platelet_count INTEGER,
  crp_mg_l REAL,
  serum_lactate_mmol_l REAL,
  npo_active INTEGER NOT NULL DEFAULT 1 CHECK(npo_active IN (0, 1)),
  ng_decompression_active INTEGER NOT NULL DEFAULT 1 CHECK(ng_decompression_active IN (0, 1)),
  broad_spectrum_antibiotics_active INTEGER NOT NULL DEFAULT 1 CHECK(broad_spectrum_antibiotics_active IN (0, 1)),
  tpn_support_active INTEGER NOT NULL DEFAULT 1 CHECK(tpn_support_active IN (0, 1)),
  inotrope_support_active INTEGER NOT NULL DEFAULT 0 CHECK(inotrope_support_active IN (0, 1)),
  surgical_consult_status TEXT NOT NULL DEFAULT 'not_consulted' CHECK(surgical_consult_status IN (
    'not_consulted',
    'consulted_medical_management',
    'bedside_peritoneal_drain_placed',
    'exploratory_laparotomy_performed'
  )),
  status TEXT NOT NULL DEFAULT 'active_medical_management' CHECK(status IN (
    'evaluating',
    'active_medical_management',
    'surgical_intervention',
    'post_operative_recovery',
    'resolved_feeding_restarted'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_nec_patient ON neonatal_nec_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_nec_status ON neonatal_nec_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_nec_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nec_episode_id INTEGER NOT NULL REFERENCES neonatal_nec_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_onset REAL NOT NULL DEFAULT 0,
  abdominal_girth_cm REAL,
  gastric_residual_volume_ml REAL,
  gastric_residual_character TEXT NOT NULL DEFAULT 'clear' CHECK(gastric_residual_character IN (
    'clear',
    'curdled_milk',
    'bilious',
    'feculent',
    'blood_stained'
  )),
  bowel_sounds TEXT NOT NULL DEFAULT 'normal' CHECK(bowel_sounds IN (
    'normal',
    'hypoactive',
    'absent'
  )),
  abdominal_wall_appearance TEXT NOT NULL DEFAULT 'normal' CHECK(abdominal_wall_appearance IN (
    'normal',
    'distended_soft',
    'erythematous',
    'indurated_tender',
    'discolored_bluish'
  )),
  platelet_count INTEGER,
  abg_ph REAL,
  lactate_mmol_l REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_nec_logs_episode ON neonatal_nec_flowsheet_logs(nec_episode_id);
