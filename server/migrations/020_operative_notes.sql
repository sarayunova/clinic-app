-- Obstetric Surgery & LSCS Operative Delivery Note Generator
-- Comprehensive operative records: pre-op safety checklist, incision & presentation,
-- infant extraction, placenta, APGAR scores, blood loss, swab/instrument counts, post-op orders.

INSERT OR IGNORE INTO counters(name, value) VALUES ('operative_note', 0);

CREATE TABLE operative_notes (
  id                               INTEGER PRIMARY KEY,
  operative_number                 TEXT NOT NULL UNIQUE,       -- e.g. OP-202611-0001
  patient_id                       INTEGER NOT NULL REFERENCES patients(id),
  admission_id                     INTEGER REFERENCES admissions(id),
  surgeon_id                       INTEGER NOT NULL REFERENCES users(id),
  surgeon_name                     TEXT NOT NULL,
  assistant_name                   TEXT,
  anesthetist_name                 TEXT,
  pediatrician_name                TEXT,
  scrub_nurse_name                 TEXT,

  -- Surgery timing & details
  surgery_date                     TEXT NOT NULL,              -- YYYY-MM-DD
  start_time                       TEXT NOT NULL,              -- HH:MM
  end_time                         TEXT,                       -- HH:MM
  procedure_name                   TEXT NOT NULL,              -- e.g. Emergency LSCS, Elective LSCS, Assisted Vacuum
  procedure_category               TEXT NOT NULL DEFAULT 'lscs' CHECK (procedure_category IN ('lscs', 'operative_vaginal', 'laparotomy', 'cervical_encirclage', 'other')),
  indication                       TEXT NOT NULL,              -- e.g. Fetal distress, Non-progress of labor, Severe preeclampsia
  urgency                          TEXT NOT NULL DEFAULT 'emergency' CHECK (urgency IN ('elective', 'emergency')),
  anesthesia_type                  TEXT NOT NULL DEFAULT 'spinal' CHECK (anesthesia_type IN ('spinal', 'general', 'epidural', 'cse', 'local')),

  -- WHO Pre-operative surgical safety checklist
  preop_identity_consent_verified  INTEGER NOT NULL DEFAULT 1, -- 1=yes, 0=no
  preop_site_marked                INTEGER NOT NULL DEFAULT 1,
  preop_anesthesia_safety_checked  INTEGER NOT NULL DEFAULT 1,
  preop_pulse_oximeter_functioning INTEGER NOT NULL DEFAULT 1,
  preop_allergies_reviewed         INTEGER NOT NULL DEFAULT 1,
  preop_difficult_airway_assessed  INTEGER NOT NULL DEFAULT 0,
  preop_blood_availability_units   TEXT,                       -- e.g. "2 units PRBC crossmatched and available"
  preop_antibiotic_prophylaxis     TEXT,                       -- e.g. "Inj. Cefazolin 2g IV given 30 mins before incision"

  -- Operative findings & technique
  incision_type                    TEXT DEFAULT 'pfannenstiel' CHECK (incision_type IN ('pfannenstiel', 'joel_cohen', 'subumbilical_midline', 'other')),
  presentation                     TEXT DEFAULT 'cephalic' CHECK (presentation IN ('cephalic', 'breech', 'transverse', 'compound', 'other')),
  liquor_characteristics           TEXT DEFAULT 'clear' CHECK (liquor_characteristics IN ('clear', 'meconium_thin', 'meconium_thick', 'blood_stained', 'oligohydramnios')),
  extraction_details               TEXT,                       -- Delivery details (vertex delivered with gentle fundal pressure...)
  baby_delivery_time               TEXT,                       -- HH:MM or ISO
  placenta_delivery                TEXT DEFAULT 'spontaneous_cct' CHECK (placenta_delivery IN ('spontaneous_cct', 'manual_removal')),
  placenta_completeness            TEXT DEFAULT 'complete_intact' CHECK (placenta_completeness IN ('complete_intact', 'incomplete_explored', 'morbidly_adherent')),
  uterine_closure                  TEXT,                       -- e.g. "Lower uterine segment closed in 2 layers continuous interlocking Vicryl 1-0"
  tubal_ligation_performed         INTEGER NOT NULL DEFAULT 0, -- 1=yes (bilateral tubectomy performed with consent), 0=no
  tubal_ligation_notes             TEXT,                       -- e.g. "Modified Pomeroy technique with Vicryl 1-0"
  estimated_blood_loss_ml          INTEGER NOT NULL DEFAULT 400,
  findings_notes                   TEXT,                       -- Uterus, ovaries, fallopian tubes, adhesions, peritoneal findings

  -- Newborn summary
  baby_gender                      TEXT CHECK (baby_gender IS NULL OR baby_gender IN ('male', 'female', 'ambiguous')),
  baby_weight_grams                INTEGER,                    -- e.g. 3100
  apgar_1min                       INTEGER CHECK (apgar_1min IS NULL OR (apgar_1min >= 0 AND apgar_1min <= 10)),
  apgar_5min                       INTEGER CHECK (apgar_5min IS NULL OR (apgar_5min >= 0 AND apgar_5min <= 10)),
  baby_resuscitation_details       TEXT,                       -- Routine drying and suction, cried immediately

  -- Sponge, needle, and instrument count verification
  sponge_count_verified            INTEGER NOT NULL DEFAULT 1, -- 1=correct
  instrument_count_verified        INTEGER NOT NULL DEFAULT 1, -- 1=correct
  needle_count_verified            INTEGER NOT NULL DEFAULT 1, -- 1=correct
  drain_placed                     INTEGER NOT NULL DEFAULT 0,
  drain_type                       TEXT,                       -- e.g. "Corrugated rubber drain / Romovac suction drain"
  closure_details                  TEXT,                       -- Rectus sheath with Loop PDS, skin with Monocryl 3-0 subcuticular

  -- Post-operative orders
  postop_vitals_monitoring         TEXT,                       -- Monitor vitals q15m for 2h, then q1h for 4h; monitor lochia and uterine contraction
  postop_iv_fluids                 TEXT,                       -- RL + 20 IU Oxytocin @ 125 ml/hr
  postop_analgesia                 TEXT,                       -- Inj. Paracetamol 1g IV TDS, Inj. Tramadol 50mg IV SOS
  postop_antibiotics               TEXT,                       -- Inj. Cefuroxime 750mg IV BD x 24 hrs
  postop_thromboprophylaxis        TEXT,                       -- Early ambulation, compression stockings
  postop_diet                      TEXT,                       -- NPO until bowel sounds return, then clear liquids
  postop_catheter_instructions     TEXT,                       -- Foley catheter removal in 12-24 hours
  special_instructions             TEXT,

  -- Status & signatures
  status                           TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'amended')),
  created_by                       INTEGER NOT NULL REFERENCES users(id),
  created_at                       TEXT NOT NULL,
  updated_at                       TEXT NOT NULL
);

CREATE INDEX idx_operative_notes_patient ON operative_notes(patient_id, surgery_date DESC);
CREATE INDEX idx_operative_notes_admission ON operative_notes(admission_id);
