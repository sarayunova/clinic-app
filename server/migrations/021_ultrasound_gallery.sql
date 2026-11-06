-- Antenatal Ultrasound Image & Scan Document Gallery
-- Multi-file image attachments with biometric tags, image captions, and print selection flags.

CREATE TABLE ultrasound_images (
  id                  INTEGER PRIMARY KEY,
  report_id           INTEGER NOT NULL REFERENCES patient_ultrasound_reports(id) ON DELETE CASCADE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id),
  attachment_id       INTEGER NOT NULL REFERENCES attachments(id),
  image_label         TEXT,                 -- e.g. "BPD / HC Axial Plane", "Abdominal Circumference", "Femur Length"
  biometric_tag       TEXT DEFAULT 'general' CHECK (biometric_tag IN ('bpd', 'hc', 'ac', 'fl', 'crl', 'nt', 'cardiac', 'doppler', 'placenta', '3d_face', 'general')),
  measurement_value   TEXT,                 -- e.g. "BPD = 48.2 mm (20w4d)"
  include_in_print    INTEGER NOT NULL DEFAULT 1, -- 1=yes, 0=no
  display_order       INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL
);

CREATE INDEX idx_ultrasound_images_report ON ultrasound_images(report_id, display_order, id);
CREATE INDEX idx_ultrasound_images_patient ON ultrasound_images(patient_id);
