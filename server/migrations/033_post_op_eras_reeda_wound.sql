-- Migration 033: Post-Cesarean Enhanced Recovery (ERAS) & REEDA Wound Healing Score
-- Tracks post-op mobilization milestones (early feeding, catheter removal, ambulation) and serial REEDA surgical incision assessments.

CREATE TABLE IF NOT EXISTS eras_post_op_pathways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  operative_note_id INTEGER,
  surgery_datetime TEXT NOT NULL,
  surgery_type TEXT NOT NULL DEFAULT 'elective_lscs' CHECK (surgery_type IN ('elective_lscs', 'emergency_lscs', 'laparotomy', 'myomectomy', 'other_gynecologic_surgery')),
  incision_type TEXT NOT NULL DEFAULT 'pfannenstiel' CHECK (incision_type IN ('pfannenstiel', 'joel_cohen', 'midline_vertical', 'other')),
  skin_closure_type TEXT NOT NULL DEFAULT 'subcuticular_monocryl' CHECK (skin_closure_type IN ('subcuticular_monocryl', 'staples', 'interrupted_mattress', 'dermabond_glue')),
  oral_fluids_achieved_hours REAL,
  regular_diet_achieved_hours REAL,
  catheter_removed_hours REAL,
  first_mobilization_hours REAL,
  multimodal_analgesia_adherent INTEGER DEFAULT 1,
  dvt_prophylaxis_applied TEXT DEFAULT 'early_mobilization_ted' CHECK (dvt_prophylaxis_applied IN ('early_mobilization_ted', 'scd_mechanical', 'lmwh_pharmacological', 'none')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discharge_ready', 'discharged', 'escalated_complication')),
  clinical_notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eras_pathways_patient ON eras_post_op_pathways(patient_id);
CREATE INDEX IF NOT EXISTS idx_eras_pathways_status ON eras_post_op_pathways(status);

CREATE TABLE IF NOT EXISTS reeda_wound_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pathway_id INTEGER NOT NULL REFERENCES eras_post_op_pathways(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessment_datetime TEXT NOT NULL,
  post_op_day INTEGER NOT NULL DEFAULT 1,
  redness_score INTEGER NOT NULL CHECK (redness_score BETWEEN 0 AND 3),
  edema_score INTEGER NOT NULL CHECK (edema_score BETWEEN 0 AND 3),
  ecchymosis_score INTEGER NOT NULL CHECK (ecchymosis_score BETWEEN 0 AND 3),
  discharge_score INTEGER NOT NULL CHECK (discharge_score BETWEEN 0 AND 3),
  approximation_score INTEGER NOT NULL CHECK (approximation_score BETWEEN 0 AND 3),
  total_reeda_score INTEGER NOT NULL CHECK (total_reeda_score BETWEEN 0 AND 15),
  pain_score_10 INTEGER CHECK (pain_score_10 BETWEEN 0 AND 10),
  dressing_condition TEXT DEFAULT 'dry_intact' CHECK (dressing_condition IN ('dry_intact', 'soaked', 'removed_clean', 'reinforcement_needed')),
  healing_category TEXT NOT NULL CHECK (healing_category IN ('optimal_healing', 'mild_inflammation', 'moderate_impairment_suspected_ssi', 'severe_complication_dehiscence')),
  action_plan TEXT,
  assessor_notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reeda_assessments_pathway ON reeda_wound_assessments(pathway_id);
CREATE INDEX IF NOT EXISTS idx_reeda_assessments_patient ON reeda_wound_assessments(patient_id);
