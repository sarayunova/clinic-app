-- Migration 110: Obstetric Postdural Puncture Headache (PDPH) & Epidural Blood Patch Protocol
-- Reference: Obstetric Anaesthetists' Association (OAA) / SOAP / ASA Guidelines on PDPH & Epidural Blood Patch (EBP)

CREATE TABLE IF NOT EXISTS obstetric_pdph_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  procedure_type                      TEXT NOT NULL CHECK (procedure_type IN (
                                        'labor_epidural_adp',
                                        'spinal_anesthesia',
                                        'combined_spinal_epidural',
                                        'diagnostic_lumbar_puncture'
                                      )),
  puncture_datetime                   TEXT NOT NULL,
  needle_gauge                        TEXT NOT NULL CHECK (needle_gauge IN (
                                        '16G_tuohy',
                                        '17G_tuohy',
                                        '18G_tuohy',
                                        '22G_quincke',
                                        '25G_whitacre',
                                        '27G_whitacre',
                                        'other'
                                      )),
  headache_onset_datetime             TEXT NOT NULL,
  initial_vas_score                   INTEGER NOT NULL CHECK (initial_vas_score BETWEEN 0 AND 10),
  postural_component                  INTEGER NOT NULL DEFAULT 1 CHECK (postural_component IN (0, 1)),
  neck_stiffness                      INTEGER NOT NULL DEFAULT 0 CHECK (neck_stiffness IN (0, 1)),
  auditory_symptoms                   INTEGER NOT NULL DEFAULT 0 CHECK (auditory_symptoms IN (0, 1)), -- tinnitus, hypoacusia
  visual_symptoms_diplopia            INTEGER NOT NULL DEFAULT 0 CHECK (visual_symptoms_diplopia IN (0, 1)), -- CN VI palsy
  conservative_hydration_ml_24h       INTEGER NOT NULL DEFAULT 2500,
  caffeine_administered               INTEGER NOT NULL DEFAULT 0 CHECK (caffeine_administered IN (0, 1)),
  analgesics_prescribed               TEXT,
  ebp_indicated                       INTEGER NOT NULL DEFAULT 0 CHECK (ebp_indicated IN (0, 1)),
  ebp_performed                       INTEGER NOT NULL DEFAULT 0 CHECK (ebp_performed IN (0, 1)),
  ebp_datetime                        TEXT,
  ebp_blood_volume_ml                 REAL,
  ebp_interspace                      TEXT,
  post_ebp_vas_score                  INTEGER CHECK (post_ebp_vas_score BETWEEN 0 AND 10),
  red_flags_present                   INTEGER NOT NULL DEFAULT 0 CHECK (red_flags_present IN (0, 1)),
  red_flag_notes                      TEXT,
  status                              TEXT NOT NULL DEFAULT 'conservative_management' CHECK (status IN (
                                        'conservative_management',
                                        'ebp_scheduled',
                                        'ebp_completed_resolving',
                                        'headache_resolved',
                                        'referred_neurology_imaging'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_pdph_patient ON obstetric_pdph_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_pdph_status ON obstetric_pdph_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_pdph_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  pdph_episode_id                     INTEGER NOT NULL REFERENCES obstetric_pdph_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  posture_assessed                    TEXT NOT NULL CHECK (posture_assessed IN (
                                        'supine',
                                        'sitting_upright',
                                        'standing_ambulating'
                                      )),
  vas_pain_score                      INTEGER NOT NULL CHECK (vas_pain_score BETWEEN 0 AND 10),
  headache_relief_on_lying            INTEGER NOT NULL DEFAULT 1 CHECK (headache_relief_on_lying IN (0, 1)),
  blood_pressure_sys                  INTEGER,
  blood_pressure_dia                  INTEGER,
  heart_rate                          INTEGER,
  temperature_celsius                 REAL,
  neurological_symptoms_present       INTEGER NOT NULL DEFAULT 0 CHECK (neurological_symptoms_present IN (0, 1)),
  interventions_given                 TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_pdph_logs_episode ON obstetric_pdph_flowsheet_logs(pdph_episode_id);
