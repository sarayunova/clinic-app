-- Migration 030: Antenatal Ultrasound Fetal Biometry, Doppler Velocimetry & Biophysical Profile (BPP)
-- Adds detailed Doppler velocimetry (Umbilical Artery, MCA, Cerebroplacental Ratio CPR, Uterine Artery, Ductus Venosus),
-- Manning Biophysical Profile (BPP), Cephalic Index, and Hadlock fetal growth velocity tracking.

ALTER TABLE patient_ultrasound_reports ADD COLUMN ofd_mm REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN cephalic_index REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN cephalic_shape TEXT CHECK (cephalic_shape IS NULL OR cephalic_shape IN ('dolichocephaly', 'mesocephaly', 'brachycephaly'));
ALTER TABLE patient_ultrasound_reports ADD COLUMN hc_ac_ratio REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN fl_ac_ratio REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN ga_discordance_days INTEGER;
ALTER TABLE patient_ultrasound_reports ADD COLUMN growth_category TEXT CHECK (growth_category IS NULL OR growth_category IN ('severe_fgr', 'moderate_fgr', 'aga', 'lga', 'macrosomia'));

-- Doppler Velocimetry
ALTER TABLE patient_ultrasound_reports ADD COLUMN ua_pi REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN ua_ri REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN ua_sd_ratio REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN ua_end_diastolic_flow TEXT DEFAULT 'normal_positive' CHECK (ua_end_diastolic_flow IS NULL OR ua_end_diastolic_flow IN ('normal_positive', 'reduced', 'aedf_absent', 'redf_reversed', 'not_performed'));

ALTER TABLE patient_ultrasound_reports ADD COLUMN mca_pi REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN mca_ri REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN mca_psv_cm_s REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN mca_mom REAL;

ALTER TABLE patient_ultrasound_reports ADD COLUMN cpr_ratio REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN cpr_assessment TEXT DEFAULT 'normal' CHECK (cpr_assessment IS NULL OR cpr_assessment IN ('normal', 'brain_sparing_redistribution', 'not_applicable'));

ALTER TABLE patient_ultrasound_reports ADD COLUMN uta_mean_pi REAL;
ALTER TABLE patient_ultrasound_reports ADD COLUMN uta_bilateral_notching INTEGER DEFAULT 0;

ALTER TABLE patient_ultrasound_reports ADD COLUMN dv_a_wave TEXT DEFAULT 'not_performed' CHECK (dv_a_wave IS NULL OR dv_a_wave IN ('positive', 'absent', 'reversed', 'not_performed'));

-- Manning Biophysical Profile (BPP)
ALTER TABLE patient_ultrasound_reports ADD COLUMN bpp_breathing INTEGER DEFAULT 2 CHECK (bpp_breathing IN (0, 2));
ALTER TABLE patient_ultrasound_reports ADD COLUMN bpp_movement INTEGER DEFAULT 2 CHECK (bpp_movement IN (0, 2));
ALTER TABLE patient_ultrasound_reports ADD COLUMN bpp_tone INTEGER DEFAULT 2 CHECK (bpp_tone IN (0, 2));
ALTER TABLE patient_ultrasound_reports ADD COLUMN bpp_amniotic_fluid INTEGER DEFAULT 2 CHECK (bpp_amniotic_fluid IN (0, 2));
ALTER TABLE patient_ultrasound_reports ADD COLUMN bpp_nst_reactive INTEGER CHECK (bpp_nst_reactive IS NULL OR bpp_nst_reactive IN (0, 2));
ALTER TABLE patient_ultrasound_reports ADD COLUMN bpp_total_score INTEGER DEFAULT 10 CHECK (bpp_total_score BETWEEN 0 AND 10);
ALTER TABLE patient_ultrasound_reports ADD COLUMN bpp_interpretation TEXT DEFAULT 'reassuring' CHECK (bpp_interpretation IS NULL OR bpp_interpretation IN ('reassuring', 'equivocal', 'abnormal_asphyxia_risk', 'not_performed'));
