-- Migration 132: Pediatric Slipped Capital Femoral Epiphysis (SCFE) & Loder Instability Protocol
-- Reference: POSNA / AAOS Clinical Practice Guidelines

CREATE TABLE IF NOT EXISTS pediatric_scfe_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_years                             REAL NOT NULL,
  weight_kg                             REAL NOT NULL,
  bmi_percentile                        REAL NOT NULL,
  affected_hip                          TEXT NOT NULL CHECK (affected_hip IN ('right', 'left', 'bilateral')),
  loder_stability                       TEXT NOT NULL CHECK (loder_stability IN (
                                          'stable_able_to_ambulate',
                                          'unstable_cannot_bear_weight'
                                        )),
  symptom_duration_days                 INTEGER NOT NULL,
  southwick_slip_angle_degrees          REAL NOT NULL,
  klein_line_trethowan_abnormal         INTEGER NOT NULL DEFAULT 1 CHECK (klein_line_trethowan_abnormal IN (0, 1)),
  referred_knee_thigh_pain              INTEGER NOT NULL DEFAULT 1 CHECK (referred_knee_thigh_pain IN (0, 1)),
  endocrine_disorder_suspected          INTEGER NOT NULL DEFAULT 0 CHECK (endocrine_disorder_suspected IN (0, 1)),
  strict_non_weight_bearing_enforced    INTEGER NOT NULL DEFAULT 1 CHECK (strict_non_weight_bearing_enforced IN (0, 1)),
  surgical_procedure_performed          TEXT NOT NULL CHECK (surgical_procedure_performed IN (
                                          'none_preoperative_traction',
                                          'in_situ_single_cannulated_screw',
                                          'two_screw_fixation',
                                          'open_modified_dunn_procedure',
                                          'contralateral_prophylactic_pinning_only'
                                        )),
  contralateral_hip_prophylactic_pinning INTEGER NOT NULL DEFAULT 0 CHECK (contralateral_hip_prophylactic_pinning IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'strict_bedrest_non_weight_bearing' CHECK (status IN (
                                          'strict_bedrest_non_weight_bearing',
                                          'urgent_preop_radiographic_workup',
                                          'in_operating_room_percutaneous_pinning',
                                          'postop_crutch_training_healing',
                                          'resolved_growth_plate_fusion'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scfe_patient ON pediatric_scfe_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_scfe_status ON pediatric_scfe_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_scfe_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  scfe_episode_id                       INTEGER NOT NULL REFERENCES pediatric_scfe_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  day_from_presentation                 INTEGER NOT NULL DEFAULT 1,
  pain_score_vas                        INTEGER NOT NULL CHECK (pain_score_vas BETWEEN 0 AND 10),
  non_weight_bearing_compliance         TEXT NOT NULL CHECK (non_weight_bearing_compliance IN (
                                          'strict_wheelchair_bedrest',
                                          'partial_crutches',
                                          'full_weight_bearing'
                                        )),
  hip_internal_rotation_degrees         REAL NOT NULL,
  wound_dressing_clean                  INTEGER NOT NULL DEFAULT 1 CHECK (wound_dressing_clean IN (0, 1)),
  distal_neurovascular_status           TEXT NOT NULL CHECK (distal_neurovascular_status IN (
                                          'intact_pulses_sensation_normal',
                                          'paresthesias_delayed_cap_refill'
                                        )),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scfe_logs_episode ON pediatric_scfe_flowsheet_logs(scfe_episode_id);
