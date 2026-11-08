-- Migration 135: Pediatric Acute Scrotum & TWIST Score Protocol
-- Reference: AUA / ESPU / AAP Clinical Practice Guidelines

CREATE TABLE IF NOT EXISTS pediatric_acute_scrotum_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_years                             REAL NOT NULL,
  affected_side                         TEXT NOT NULL CHECK (affected_side IN ('right', 'left', 'bilateral')),
  symptom_duration_hours                REAL NOT NULL,
  twist_testis_swelling                 INTEGER NOT NULL CHECK (twist_testis_swelling IN (0, 2)),
  twist_hard_testis                     INTEGER NOT NULL CHECK (twist_hard_testis IN (0, 2)),
  twist_absent_cremasteric_reflex       INTEGER NOT NULL CHECK (twist_absent_cremasteric_reflex IN (0, 1)),
  twist_nausea_vomiting                 INTEGER NOT NULL CHECK (twist_nausea_vomiting IN (0, 1)),
  twist_high_riding_testis              INTEGER NOT NULL CHECK (twist_high_riding_testis IN (0, 1)),
  doppler_ultrasound_performed          INTEGER NOT NULL DEFAULT 0 CHECK (doppler_ultrasound_performed IN (0, 1)),
  doppler_findings                      TEXT NOT NULL DEFAULT 'not_performed' CHECK (doppler_findings IN (
                                          'not_performed',
                                          'absent_arterial_flow_torsion_confirmed',
                                          'decreased_flow_partial_torsion',
                                          'normal_flow_appendix_torsion_blue_dot',
                                          'increased_hyperemic_flow_epididymo_orchitis'
                                        )),
  manual_detorsion_attempted            INTEGER NOT NULL DEFAULT 0 CHECK (manual_detorsion_attempted IN (0, 1)),
  surgical_exploration_performed        INTEGER NOT NULL DEFAULT 0 CHECK (surgical_exploration_performed IN (0, 1)),
  intraoperative_findings               TEXT NOT NULL DEFAULT 'preop_evaluation' CHECK (intraoperative_findings IN (
                                          'preop_evaluation',
                                          'viable_testis_after_detorsion',
                                          'necrotic_nonviable_orchiectomy_performed',
                                          'torsion_appendix_testis_excised',
                                          'normal_testis_epididymitis_managed'
                                        )),
  bilateral_orchiopexy_performed        INTEGER NOT NULL DEFAULT 0 CHECK (bilateral_orchiopexy_performed IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'emergency_triage_under_6h' CHECK (status IN (
                                          'emergency_triage_under_6h',
                                          'urgent_ultrasound_intermediate_risk',
                                          'in_operating_room_exploration',
                                          'postop_scrotal_support_recovery',
                                          'resolved_discharged_home'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scrotum_patient ON pediatric_acute_scrotum_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_scrotum_status ON pediatric_acute_scrotum_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_acute_scrotum_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  scrotum_episode_id                    INTEGER NOT NULL REFERENCES pediatric_acute_scrotum_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  hours_from_presentation               REAL NOT NULL,
  pain_score_flacc_or_vas               INTEGER NOT NULL CHECK (pain_score_flacc_or_vas BETWEEN 0 AND 10),
  scrotal_edema_erythema                TEXT NOT NULL CHECK (scrotal_edema_erythema IN (
                                          'mild',
                                          'moderate',
                                          'severe_tense',
                                          'resolving'
                                        )),
  cremasteric_reflex_status             TEXT NOT NULL CHECK (cremasteric_reflex_status IN (
                                          'absent',
                                          'sluggish',
                                          'intact_normal'
                                        )),
  wound_dressing_clean                  INTEGER NOT NULL DEFAULT 1 CHECK (wound_dressing_clean IN (0, 1)),
  ambulation_status                     TEXT NOT NULL CHECK (ambulation_status IN (
                                          'bedrest_scrotal_elevation',
                                          'gentle_ambulation_supported',
                                          'full_activity'
                                        )),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scrotum_flowsheet_episode ON pediatric_acute_scrotum_flowsheet_logs(scrotum_episode_id);
CREATE INDEX IF NOT EXISTS idx_scrotum_flowsheet_patient ON pediatric_acute_scrotum_flowsheet_logs(patient_id);
