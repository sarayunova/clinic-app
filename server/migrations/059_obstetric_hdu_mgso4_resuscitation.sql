-- Migration 059: Obstetric HDU & Severe Pre-Eclampsia Magnesium Sulfate (MgSO4) Resuscitation Flowsheet
-- Reference: Zuspan and Pritchard protocols for eclampsia seizure prophylaxis,
-- maternal hourly safety surveillance (Patellar Reflex, RR >= 16, Urine Output >= 30 mL/h, Serum Mg),
-- Antidote 10% Calcium Gluconate trigger, and severe hypertensive crisis management (Labetalol, Nifedipine, Hydralazine).

CREATE TABLE IF NOT EXISTS mgso4_resuscitation_protocols (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  protocol_code                       TEXT NOT NULL UNIQUE,
  regimen_type                        TEXT NOT NULL CHECK (regimen_type IN ('zuspan_iv', 'pritchard_im', 'neuroprotection_preterm')),
  indication                          TEXT NOT NULL CHECK (indication IN (
                                        'severe_preeclampsia_impending', 'antepartum_eclampsia',
                                        'intrapartum_eclampsia', 'postpartum_eclampsia', 'fetal_neuroprotection_lt32w'
                                      )),
  initiation_datetime                 TEXT NOT NULL,
  prescribed_by_id                    INTEGER NOT NULL REFERENCES users(id),
  loading_dose_given                  INTEGER NOT NULL DEFAULT 1, -- 1 = yes
  loading_dose_details                TEXT NOT NULL, -- e.g. "4g IV over 20 min" or "4g IV + 10g IM"
  maintenance_rate_g_per_h            REAL NOT NULL DEFAULT 1.0, -- e.g. 1.0 g/h IV or 5g q4h IM
  recurrent_seizure_bolus_given       INTEGER NOT NULL DEFAULT 0,
  status                              TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                                        'active', 'completed_24h', 'held_toxicity', 'aborted'
                                      )),
  termination_datetime                TEXT,
  termination_reason                  TEXT,
  antidote_calcium_gluconate_given    INTEGER NOT NULL DEFAULT 0, -- 1 if 10% calcium gluconate was pushed
  antidote_datetime                   TEXT,
  antidote_indication                 TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mgso4_patient ON mgso4_resuscitation_protocols(patient_id);
CREATE INDEX IF NOT EXISTS idx_mgso4_status ON mgso4_resuscitation_protocols(status);

-- Hourly Magnesium Sulfate Toxicity & Bedside Safety Flowsheet
CREATE TABLE IF NOT EXISTS mgso4_hourly_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id                         INTEGER NOT NULL REFERENCES mgso4_resuscitation_protocols(id) ON DELETE CASCADE,
  observation_datetime                TEXT NOT NULL,
  hour_number                         INTEGER NOT NULL,
  patellar_reflex                     TEXT NOT NULL CHECK (patellar_reflex IN (
                                        'absent_0', 'sluggish_1_plus', 'normal_2_plus',
                                        'brisk_3_plus', 'hyperactive_clonus_4_plus'
                                      )),
  respiratory_rate_bpm                INTEGER NOT NULL,
  urine_output_last_hour_ml           REAL NOT NULL,
  blood_pressure_sys                  INTEGER NOT NULL,
  blood_pressure_dia                  INTEGER NOT NULL,
  heart_rate_bpm                      INTEGER NOT NULL,
  spo2_percent                        REAL NOT NULL DEFAULT 98.0,
  serum_magnesium_mg_dl               REAL,
  fetal_heart_rate_bpm                INTEGER, -- for antepartum patients
  toxicity_warning_triggered          INTEGER NOT NULL DEFAULT 0, -- 1 if reflex=absent OR RR < 16 OR UOP < 30
  action_taken                        TEXT NOT NULL CHECK (action_taken IN (
                                        'continue_regimen', 'hold_dose_recheck',
                                        'infusion_rate_reduced', 'stopped_antidote_given'
                                      )),
  antihypertensive_given              TEXT, -- e.g. "IV Labetalol 20mg"
  nurse_id                            INTEGER NOT NULL REFERENCES users(id),
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mgso4_flowsheet_prot ON mgso4_hourly_flowsheet_logs(protocol_id);
CREATE INDEX IF NOT EXISTS idx_mgso4_flowsheet_hour ON mgso4_hourly_flowsheet_logs(protocol_id, hour_number);
