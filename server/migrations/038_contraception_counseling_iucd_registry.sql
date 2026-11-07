-- Migration 038: Contraception Counseling & Postpartum / Interval IUCD Registry
-- Implements WHO Medical Eligibility Criteria (MEC Categories 1-4) clinical decision engine,
-- Postpartum IUCD (PPIUCD / post-placental / post-cesarean) and interval Copper-T / LNG-IUS insertion tracker,
-- serial follow-up surveillance (thread checks, bleeding patterns, pain, expulsion detection, removal).

CREATE TABLE IF NOT EXISTS contraceptive_counseling_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  counseling_date TEXT NOT NULL,
  reproductive_plan TEXT NOT NULL CHECK(reproductive_plan IN ('spacing_pregnancies', 'limiting_completed_family', 'delaying_first_pregnancy', 'undecided')),
  desired_spacing_years NUMERIC,
  breastfeeding_status TEXT NOT NULL DEFAULT 'not_breastfeeding' CHECK(breastfeeding_status IN ('exclusive_breastfeeding_lt_6w', 'exclusive_breastfeeding_6w_6m', 'partial_breastfeeding', 'not_breastfeeding')),
  medical_conditions_json TEXT, -- JSON array of strings: e.g. ["hypertension", "smoking_over_35", "migraine_with_aura", "history_dvt", "diabetes_vascular", "unexplained_vaginal_bleeding", "current_pid", "breast_cancer"]
  eligibility_results_json TEXT, -- JSON object: method key -> { mecCategory: 1|2|3|4, rationale: string }
  chosen_method TEXT NOT NULL,
  method_rationale TEXT,
  prescribed_units TEXT,
  next_followup_date TEXT,
  counseled_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contraceptive_patient ON contraceptive_counseling_records(patient_id, counseling_date DESC);

CREATE TABLE IF NOT EXISTS iucd_insertions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  counseling_id INTEGER REFERENCES contraceptive_counseling_records(id) ON DELETE SET NULL,
  device_type TEXT NOT NULL CHECK(device_type IN ('cu_t_380a', 'cu_t_375', 'lng_ius_52mg_mirena', 'lng_ius_19_5mg_kyleena', 'other')),
  device_brand_name TEXT,
  lot_batch_number TEXT,
  device_expiry_date TEXT,
  insertion_timing TEXT NOT NULL CHECK(insertion_timing IN ('post_placental_vaginal', 'post_cesarean_intracesarean', 'early_postpartum_lt_48h', 'interval_extended_gt_6w', 'post_abortion_immediate', 'emergency_contraception')),
  insertion_date TEXT NOT NULL,
  insertion_time TEXT,
  inserted_by TEXT NOT NULL,
  uterine_depth_cm NUMERIC,
  analgesia_used TEXT CHECK(analgesia_used IN ('none', 'nsaid_premed', 'paracervical_block', 'general_epidural_anesthesia')),
  thread_length_cut_cm NUMERIC,
  insertion_ease TEXT NOT NULL DEFAULT 'smooth' CHECK(insertion_ease IN ('smooth', 'moderate_resistance', 'difficult_cervical_stenosis', 'ultrasound_guided')),
  complications TEXT NOT NULL DEFAULT 'none' CHECK(complications IN ('none', 'mild_cramping', 'vasovagal_syncope', 'bleeding_gt_50ml', 'suspected_perforation', 'immediate_expulsion')),
  post_insertion_ultrasound TEXT CHECK(post_insertion_ultrasound IN ('not_done', 'fundal_position_confirmed', 'low_lying_segment', 'not_visualized')),
  lifespan_years INTEGER NOT NULL DEFAULT 10,
  expected_removal_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_situ' CHECK(status IN ('in_situ', 'partially_expelled', 'fully_expelled', 'removed_patient_request', 'removed_medical_reason', 'removed_expired', 'pregnancy_in_situ')),
  removal_date TEXT,
  removal_reason TEXT,
  clinical_notes TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iucd_insertions_patient ON iucd_insertions(patient_id, insertion_date DESC);

CREATE TABLE IF NOT EXISTS iucd_followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insertion_id INTEGER NOT NULL REFERENCES iucd_insertions(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  followup_date TEXT NOT NULL,
  visit_interval TEXT NOT NULL CHECK(visit_interval IN ('6_weeks_post_insertion', '3_months', '6_months', '1_year', 'annual_surveillance', 'unscheduled_complaint')),
  thread_status TEXT NOT NULL CHECK(thread_status IN ('threads_visible_normal', 'threads_long', 'threads_short', 'threads_not_visible', 'curled_in_canal')),
  pelvic_ultrasound_done INTEGER NOT NULL DEFAULT 0,
  ultrasound_finding TEXT CHECK(ultrasound_finding IN ('normal_fundal', 'myometrial_embedment', 'low_lying_cervical', 'perforation_extrauterine', 'absent_lost')),
  bleeding_pattern TEXT NOT NULL CHECK(bleeding_pattern IN ('normal_regular', 'amenorrhea', 'spotting_intermenstrual', 'heavy_prolonged_bleeding')),
  pelvic_pain_score INTEGER CHECK(pelvic_pain_score BETWEEN 0 AND 10),
  signs_of_infection INTEGER NOT NULL DEFAULT 0,
  action_taken TEXT NOT NULL CHECK(action_taken IN ('continue_in_situ_reassured', 'antibiotics_prescribed', 'threads_trimmed', 'ultrasound_ordered', 'device_removed', 'hysteroscopic_removal_scheduled')),
  clinical_notes TEXT,
  examined_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iucd_followups_insertion ON iucd_followups(insertion_id, followup_date DESC);
