-- Obstetric Postnatal Discharge Summary & Puerperium Care Pack
-- Comprehensive maternal involution/lochia progress, delivery details, neonatal examination, contraception, and birth immunizations.

CREATE TABLE obstetric_discharge_summaries (
  id                              INTEGER PRIMARY KEY,
  patient_id                      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE, -- Mother
  admission_id                    INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  discharge_date                  TEXT NOT NULL,            -- YYYY-MM-DD

  -- Labor & Delivery Details
  delivery_at                     TEXT,                     -- ISO timestamp or YYYY-MM-DD HH:MM
  delivery_mode                   TEXT NOT NULL CHECK (delivery_mode IN ('normal_vaginal', 'assisted_vacuum', 'assisted_forceps', 'elective_lscs', 'emergency_lscs', 'vbac')),
  delivery_indication             TEXT,
  delivery_notes                  TEXT,
  primary_obstetrician            TEXT,

  -- Maternal Puerperium & Involution Progress
  perineum_wound_status           TEXT NOT NULL DEFAULT 'intact' CHECK (perineum_wound_status IN ('intact', 'episiotomy_healed', 'perineal_tear_repaired', 'lscs_wound_clean', 'superficial_dehiscence', 'infected', 'other')),
  perineum_notes                  TEXT,
  fundal_involution               TEXT NOT NULL DEFAULT 'contracted_normal' CHECK (fundal_involution IN ('contracted_normal', 'well_contracted', 'subinvoluted', 'tender', 'boggy')),
  fundal_height_cm                TEXT,                     -- e.g. "Firm at 20w size", "Just below umbilicus"
  lochia_character                TEXT NOT NULL DEFAULT 'rubra' CHECK (lochia_character IN ('rubra', 'serosa', 'alba', 'excessive', 'foul_smelling')),
  lochia_notes                    TEXT,
  lactation_status                TEXT NOT NULL DEFAULT 'established' CHECK (lactation_status IN ('established', 'initiating', 'suppressed', 'cracked_nipples', 'engorgement', 'mastitis')),
  breast_examination              TEXT,
  bladder_bowel_status            TEXT,                     -- e.g. "Voiding freely, bowels moved normal"

  -- Maternal Discharge Vitals
  discharge_bp_systolic           INTEGER,
  discharge_bp_diastolic          INTEGER,
  discharge_pulse                 INTEGER,
  discharge_temp_f                REAL,
  discharge_spo2                  INTEGER,

  -- Postnatal Contraception Plan
  contraception_counselled        INTEGER NOT NULL DEFAULT 1,
  contraception_chosen            TEXT NOT NULL DEFAULT 'undecided' CHECK (contraception_chosen IN ('ppiucd_inserted', 'progestin_only_pill', 'lactational_amenorrhea', 'barrier_condom', 'tubal_sterilization', 'inj_depo', 'undecided', 'none')),
  contraception_notes             TEXT,

  -- Maternal Discharge Medications & Alarm Signs
  discharge_medicines_text        TEXT,                     -- e.g. Iron, Calcium, Paracetamol, etc.
  alarm_signs_counselled          INTEGER NOT NULL DEFAULT 1, -- Excessive bleeding, fever, calf pain, severe headache

  -- Newborn Delivery & Resuscitation Summary
  baby_gender                     TEXT NOT NULL DEFAULT 'female' CHECK (baby_gender IN ('female', 'male', 'ambiguous')),
  baby_birth_weight_grams         INTEGER,
  baby_discharge_weight_grams     INTEGER,
  baby_length_cm                  REAL,
  baby_hc_cm                      REAL,
  baby_gestational_age_weeks      INTEGER,
  baby_gestational_age_days       INTEGER,
  baby_apgar_1min                 INTEGER,
  baby_apgar_5min                 INTEGER,
  baby_cry_at_birth               TEXT NOT NULL DEFAULT 'immediate_vigorous' CHECK (baby_cry_at_birth IN ('immediate_vigorous', 'delayed', 'required_stimulation', 'none')),
  baby_resuscitation_details      TEXT,
  baby_blood_group                TEXT,
  baby_pediatric_patient_id       INTEGER REFERENCES patients(id) ON DELETE SET NULL,

  -- Neonatal Discharge Examination & Wellbeing
  neonatal_exam_json              TEXT NOT NULL DEFAULT '{}', -- color, tone, fontanelle, palate, heart, lungs, abdomen, cord, genitalia, anus, hips, spine
  neonatal_feeding_method         TEXT NOT NULL DEFAULT 'exclusive_breastfeeding' CHECK (neonatal_feeding_method IN ('exclusive_breastfeeding', 'expressed_breast_milk', 'mixed_feeding', 'formula_feeding')),
  meconium_passed                 INTEGER NOT NULL DEFAULT 1,
  urine_passed                    INTEGER NOT NULL DEFAULT 1,
  jaundice_assessment             TEXT NOT NULL DEFAULT 'none' CHECK (jaundice_assessment IN ('none', 'mild_physiological', 'phototherapy_required', 'pathological')),

  -- Newborn Birth Immunization & Screening Pack
  bcg_given                       INTEGER NOT NULL DEFAULT 1,
  bcg_date                        TEXT,
  opv_zero_given                  INTEGER NOT NULL DEFAULT 1,
  opv_zero_date                   TEXT,
  hepb_birth_given                INTEGER NOT NULL DEFAULT 1,
  hepb_birth_date                 TEXT,
  hearing_screen_result           TEXT DEFAULT 'pass' CHECK (hearing_screen_result IN ('pass', 'refer', 'not_screened')),
  metabolic_screen_result         TEXT DEFAULT 'normal' CHECK (metabolic_screen_result IN ('normal', 'pending', 'abnormal', 'not_screened')),

  -- Follow-up Schedule
  maternal_followup_date          TEXT,                     -- e.g. Day 7 for suture check
  newborn_followup_date           TEXT,                     -- e.g. Day 7 / 6 weeks
  consultant_special_instructions TEXT,

  status                          TEXT NOT NULL DEFAULT 'finalized' CHECK (status IN ('draft', 'finalized')),
  created_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL
);

CREATE INDEX idx_obstetric_discharge_patient ON obstetric_discharge_summaries(patient_id, discharge_date DESC);
CREATE INDEX idx_obstetric_discharge_admission ON obstetric_discharge_summaries(admission_id);
