-- Migration 055: Operating Theater (OT) Surgical Scheduler, Pre-Anesthesia Clearance (ASA Triage)
-- & WHO Surgical Safety Checklist Flowsheet.
-- Standardizes perioperative workflow across Elective, Urgent and Category-1 Emergency surgeries,
-- pre-anesthesia airway & comorbidity clearance, and WHO 3-phase surgical checklist (Sign In, Time Out, Sign Out).

CREATE TABLE IF NOT EXISTS ot_schedules (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  ot_room                             TEXT NOT NULL CHECK (ot_room IN ('OT_1_MAIN', 'OT_2_MATERNITY', 'OT_3_MINOR', 'LABOR_OT')),
  scheduled_date                      TEXT NOT NULL, -- YYYY-MM-DD
  scheduled_start_time                TEXT NOT NULL, -- HH:MM
  estimated_duration_minutes          INTEGER NOT NULL DEFAULT 60,
  procedure_name                      TEXT NOT NULL,
  procedure_category                  TEXT NOT NULL CHECK (procedure_category IN (
                                        'OBSTETRIC', 'GYNECOLOGICAL', 'LAPAROSCOPIC',
                                        'INFERTILITY_REPRODUCTIVE', 'PEDIATRIC_SURGERY', 'OTHER'
                                      )),
  priority                            TEXT NOT NULL DEFAULT 'ELECTIVE' CHECK (priority IN ('ELECTIVE', 'URGENT', 'EMERGENCY_CAT_1')),
  status                              TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
                                        'SCHEDULED', 'PATIENT_IN_OT', 'SURGERY_IN_PROGRESS', 'PACU_RECOVERY', 'COMPLETED', 'CANCELLED'
                                      )),
  primary_surgeon_id                  INTEGER NOT NULL REFERENCES users(id),
  primary_surgeon_name                TEXT NOT NULL,
  assistant_surgeon_name              TEXT,
  anesthesiologist_id                 INTEGER REFERENCES users(id),
  anesthesiologist_name               TEXT,
  scrub_nurse_name                    TEXT,
  pediatrician_standby_name           TEXT,
  blood_units_reserved                INTEGER DEFAULT 0,
  special_equipment_needed            TEXT,
  cancellation_reason                 TEXT,
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ot_schedules_date ON ot_schedules(scheduled_date, ot_room);
CREATE INDEX IF NOT EXISTS idx_ot_schedules_patient ON ot_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_ot_schedules_status ON ot_schedules(status);

CREATE TABLE IF NOT EXISTS pre_anesthesia_clearances (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ot_schedule_id                      INTEGER REFERENCES ot_schedules(id) ON DELETE SET NULL,
  evaluation_date                     TEXT NOT NULL, -- YYYY-MM-DD
  anesthesiologist_id                 INTEGER NOT NULL REFERENCES users(id),
  anesthesiologist_name               TEXT NOT NULL,
  asa_grade                           TEXT NOT NULL CHECK (asa_grade IN (
                                        'ASA_I', 'ASA_II', 'ASA_III', 'ASA_IV', 'ASA_V',
                                        'ASA_I_E', 'ASA_II_E', 'ASA_III_E', 'ASA_IV_E', 'ASA_V_E'
                                      )),
  mallampati_class                    TEXT NOT NULL DEFAULT 'CLASS_I' CHECK (mallampati_class IN ('CLASS_I', 'CLASS_II', 'CLASS_III', 'CLASS_IV')),
  mouth_opening_cm                    REAL DEFAULT 4.0,
  thyromental_distance_cm             REAL DEFAULT 6.5,
  dentition_status                    TEXT NOT NULL DEFAULT 'intact' CHECK (dentition_status IN ('intact', 'loose_teeth', 'edentulous', 'dentures_present')),
  neck_mobility                       TEXT NOT NULL DEFAULT 'normal_full' CHECK (neck_mobility IN ('normal_full', 'restricted_extension', 'fixed_flexion')),
  npo_solid_hours                     INTEGER DEFAULT 8,
  npo_clear_liquid_hours              INTEGER DEFAULT 2,
  cardiovascular_assessment           TEXT,
  respiratory_assessment              TEXT,
  airway_notes                        TEXT,
  planned_anesthesia_technique        TEXT NOT NULL DEFAULT 'SPINAL' CHECK (planned_anesthesia_technique IN (
                                        'SPINAL', 'EPIDURAL', 'CSE', 'GENERAL_ENDOTRACHEAL', 'TIVA', 'LOCAL_MAC'
                                      )),
  pac_clearance_status                TEXT NOT NULL DEFAULT 'FIT_FOR_SURGERY' CHECK (pac_clearance_status IN (
                                        'FIT_FOR_SURGERY', 'FIT_WITH_HIGH_RISK', 'PROCEED_EMERGENCY_LIFE_SAVING', 'DEFERRED_PENDING_OPTIMIZATION'
                                      )),
  high_risk_warnings                  TEXT,
  preop_orders_instructions          TEXT,
  blood_products_crossmatched         TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pac_patient ON pre_anesthesia_clearances(patient_id);
CREATE INDEX IF NOT EXISTS idx_pac_schedule ON pre_anesthesia_clearances(ot_schedule_id);

CREATE TABLE IF NOT EXISTS who_surgical_safety_checklists (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ot_schedule_id                      INTEGER NOT NULL UNIQUE REFERENCES ot_schedules(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Phase 1: Sign In (Before Induction)
  signin_completed                    INTEGER NOT NULL DEFAULT 0 CHECK (signin_completed IN (0, 1)),
  signin_patient_confirmed            INTEGER NOT NULL DEFAULT 1,
  signin_site_marked                  INTEGER NOT NULL DEFAULT 1,
  signin_anesthesia_safety_check      INTEGER NOT NULL DEFAULT 1,
  signin_pulse_oximeter_functioning   INTEGER NOT NULL DEFAULT 1,
  signin_known_allergy                INTEGER NOT NULL DEFAULT 0,
  signin_difficult_airway_risk        INTEGER NOT NULL DEFAULT 0,
  signin_blood_loss_risk              INTEGER NOT NULL DEFAULT 0,
  signin_nurse_anesthetist_name       TEXT,
  signin_timestamp                    TEXT,
  
  -- Phase 2: Time Out (Before Incision)
  timeout_completed                   INTEGER NOT NULL DEFAULT 0 CHECK (timeout_completed IN (0, 1)),
  timeout_team_introduced             INTEGER NOT NULL DEFAULT 1,
  timeout_verbal_confirmation         INTEGER NOT NULL DEFAULT 1,
  timeout_surgeon_review              TEXT,
  timeout_anesthetist_review          TEXT,
  timeout_nursing_sterility_confirmed INTEGER NOT NULL DEFAULT 1,
  timeout_antibiotic_prophylaxis_given INTEGER NOT NULL DEFAULT 1,
  timeout_antibiotic_name_dose        TEXT,
  timeout_imaging_displayed           INTEGER NOT NULL DEFAULT 1,
  timeout_completed_by_name           TEXT,
  timeout_timestamp                   TEXT,
  
  -- Phase 3: Sign Out (Before Leaving OR)
  signout_completed                   INTEGER NOT NULL DEFAULT 0 CHECK (signout_completed IN (0, 1)),
  signout_procedure_recorded_name     TEXT,
  signout_counts_correct              INTEGER NOT NULL DEFAULT 1,
  signout_specimen_labeled            INTEGER NOT NULL DEFAULT 1,
  signout_equipment_problems          TEXT,
  signout_recovery_concerns           TEXT,
  signout_completed_by_name           TEXT,
  signout_timestamp                   TEXT,
  
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_who_checklist_schedule ON who_surgical_safety_checklists(ot_schedule_id);
CREATE INDEX IF NOT EXISTS idx_who_checklist_patient ON who_surgical_safety_checklists(patient_id);
