import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../server/db.js';
import { hashPassword } from '../server/auth.js';
import { nowIso } from '../server/time.js';
import { generateSyntheticCtgTrace } from '../web/src/ctgEngine.js';

const DATA_DIR = path.resolve('.devdata');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Remove stale pid if present
const pidPath = path.join(DATA_DIR, 'server.pid');
if (fs.existsSync(pidPath)) {
  fs.rmSync(pidPath, { force: true });
}

const dbPath = path.join(DATA_DIR, 'clinic.sqlite');
console.log(`Connecting to database at: ${dbPath}`);
const db = openDb(dbPath);

async function seed() {
  console.log('Seeding demo users...');
  const now = nowIso();

  const doctorHash = await hashPassword('Doctor@12345');
  const nurseHash = await hashPassword('Nurse@12345');
  const deskHash = await hashPassword('Desk@12345');

  // Insert or update demo users
  const upsertUser = db.prepare(`
    INSERT INTO users (username, full_name, role, password_hash, must_change_password, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, 1, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      full_name = excluded.full_name,
      role = excluded.role,
      password_hash = excluded.password_hash,
      must_change_password = 0,
      active = 1,
      updated_at = excluded.updated_at
  `);

  upsertUser.run('drdemo', 'Dr. Demo Sharma (MD, OBGYN)', 'doctor', doctorHash, now, now);
  upsertUser.run('nurse1', 'Nurse Priya Patil (Staff Nurse)', 'nurse', nurseHash, now, now);
  upsertUser.run('desk1', 'Vishnu (Front Desk)', 'attender', deskHash, now, now);

  const doctorUser = db.prepare("SELECT id FROM users WHERE username = 'drdemo'").get() as { id: number };
  const nurseUser = db.prepare("SELECT id FROM users WHERE username = 'nurse1'").get() as { id: number };
  const deskUser = db.prepare("SELECT id FROM users WHERE username = 'desk1'").get() as { id: number };
  const docId = doctorUser.id;
  const nurseId = nurseUser.id;
  const deskId = deskUser.id;

  console.log('Seeding beds and wards...');
  const beds = [
    { room: 'Labor Ward', label: 'L-01' },
    { room: 'Labor Ward', label: 'L-02' },
    { room: 'Post-Op ICU', label: 'PO-01' },
    { room: 'Post-Op ICU', label: 'PO-02' },
    { room: 'Maternity Ward', label: 'MW-01' },
    { room: 'Maternity Ward', label: 'MW-02' },
    { room: 'Maternity Ward', label: 'MW-03' },
  ];
  for (const b of beds) {
    db.prepare('INSERT OR IGNORE INTO beds (room, label, created_at) VALUES (?, ?, ?)').run(b.room, b.label, now);
  }

  console.log('Seeding demo patients...');

  // Helper to insert or get patient
  function ensurePatient(p: {
    patientNumber: string;
    fullName: string;
    phone: string;
    dateOfBirth: string | null;
    estimatedAgeYears: number | null;
    gravida?: number;
    para?: number;
    living?: number;
    abortions?: number;
    lastMenstrualPeriod?: string | null;
    allergyStatus?: string;
    allergyDetails?: string | null;
    medicalHistory?: string | null;
    ongoingMedicines?: string | null;
  }): number {
    const existing = db.prepare('SELECT id FROM patients WHERE patient_number = ?').get(p.patientNumber) as { id: number } | undefined;
    if (existing) return existing.id;

    const res = db.prepare(`
      INSERT INTO patients (
        patient_number, full_name, phone, date_of_birth, estimated_age_years,
        gravida, para, living, abortions, last_menstrual_period,
        allergy_status, allergy_details, medical_history, ongoing_medicines,
        version, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      p.patientNumber, p.fullName, p.phone, p.dateOfBirth, p.estimatedAgeYears,
      p.gravida ?? 0, p.para ?? 0, p.living ?? 0, p.abortions ?? 0, p.lastMenstrualPeriod ?? null,
      p.allergyStatus ?? 'none', p.allergyDetails ?? null, p.medicalHistory ?? null, p.ongoingMedicines ?? null,
      docId, now, now
    );
    return Number(res.lastInsertRowid);
  }

  // --- PATIENT 1: Anita Sharma (Antenatal 32 weeks, Fetal Biometry Doppler, MEOWS) ---
  const anitaId = ensurePatient({
    patientNumber: 'P-1001',
    fullName: 'Anita Sharma',
    phone: '9845011001',
    dateOfBirth: '1998-04-15',
    estimatedAgeYears: 28,
    gravida: 2,
    para: 1,
    living: 1,
    abortions: 0,
    lastMenstrualPeriod: '2026-03-25',
    allergyStatus: 'none',
    medicalHistory: 'Previous uncomplicated vaginal delivery in 2023. GDM screen negative.',
    ongoingMedicines: 'Tab Folvite 5mg OD, Tab Autrin (Iron) OD, Tab Shelcal 500 BD',
  });

  // Antenatal Risk assessment for Anita
  db.prepare(`
    INSERT OR IGNORE INTO antenatal_risk_assessments (
      patient_id, assessment_date, gestational_age_weeks, assessed_by,
      pe_factors_json, pe_risk_level, vte_factors_json, vte_score, vte_risk_level,
      gdm_factors_json, gdm_risk_level, ptb_factors_json, ptb_risk_level,
      overall_risk_level, clinical_action_plan, consultant_notes,
      created_at, updated_at
    ) VALUES (?, '2026-11-04', 32, ?, '[]', 'low', '[]', 0, 'low', '[]', 'standard', '[]', 'low', 'low_risk', 'Routine antenatal surveillance, daily fetal kick chart.', 'Patient progressing well.', ?, ?)
  `).run(anitaId, docId, now, now);

  // Fetal Biometry & Doppler Scan for Anita
  db.prepare(`
    INSERT OR IGNORE INTO patient_ultrasound_reports (
      patient_id, scan_date, scan_type, indication, clinical_lmp, gestational_age_weeks,
      fetal_number, cardiac_activity, fhr_bpm, presentation, placenta_location, placenta_grade,
      amniotic_fluid_type, amniotic_fluid_cm, amniotic_fluid_assessment,
      bpd_mm, ofd_mm, hc_mm, ac_mm, fl_mm, efw_grams, efw_percentile,
      cephalic_index, cephalic_shape, ua_pi, ua_ri, ua_end_diastolic_flow,
      mca_pi, cpr_ratio, cpr_assessment, bpp_total_score, bpp_interpretation,
      impression, recommendations, sonographer_name, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-11-04', 'growth_wellbeing', 'Third trimester fetal growth and Doppler velocimetry', '2026-03-25', 32,
      'single', 'present', 142, 'cephalic', 'anterior', '2',
      'sdp', 4.8, 'normal',
      82.5, 105.0, 298.0, 280.0, 62.0, 1920, '52nd percentile (AGA)',
      78.5, 'mesocephaly', 0.95, 0.62, 'normal_positive',
      1.48, 1.56, 'normal', 10, 'reassuring',
      'Single live intrauterine gestation at 32 weeks with AGA growth and normal Doppler hemodynamics (CPR > 1.08).',
      'Continue routine antenatal care. Repeat growth scan at 36 weeks.', 'Dr. Demo Sharma',
      ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, now, now);

  // MEOWS observation for Anita
  const meowsEp = db.prepare(`
    INSERT OR IGNORE INTO maternal_meows_episodes (
      patient_id, episode_type, started_at, clinical_indication, primary_diagnosis,
      high_risk_flags, is_active, status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, 'antenatal', ?, 'Third trimester routine antenatal checkup', 'Pregnancy at 32 weeks', 'None', 1, 'active_monitoring', ?, ?, ?, ?)
  `).run(anitaId, now, docId, docId, now, now);
  const meowsEpId = Number(meowsEp.lastInsertRowid) || 1;

  db.prepare(`
    INSERT OR IGNORE INTO maternal_meows_observations (
      meows_episode_id, patient_id, recorded_at, respiratory_rate, rr_trigger,
      spo2_percent, spo2_trigger, temperature_c, temp_trigger, bp_systolic,
      bp_diastolic, bp_trigger, heart_rate, hr_trigger, avpu_consciousness,
      neuro_trigger, pain_score, lochia_status, lochia_trigger, urine_output_ml_hr,
      urine_trigger, proteinuria, proteinuria_trigger, yellow_triggers_count,
      red_triggers_count, overall_alert_level, action_required, action_taken,
      recorded_by, created_at
    ) VALUES (
      ?, ?, '2026-11-06T10:00:00', 16, 'green',
      99, 'green', 36.8, 'green', 116,
      74, 'green', 78, 'green', 'alert',
      'green', 0, 'normal', 'green', 55,
      'green', 'nil', 'green', 0,
      0, 'normal_green', 'Routine vitals monitoring', 'Documented in maternal chart',
      ?, ?
    )
  `).run(meowsEpId, anitaId, nurseId, now);

  // Anita Sharma GDM Profile (DIPSI 75g diagnostic, White Class A1 MNT)
  const gdmProfRes = db.prepare(`
    INSERT OR IGNORE INTO gdm_profiles (
      patient_id, gestational_age_weeks, diagnostic_criteria, diagnostic_date,
      ogtt_fasting_mg_dl, ogtt_1hr_mg_dl, ogtt_2hr_mg_dl, ogtt_3hr_mg_dl, baseline_hba1c,
      white_classification, current_management, target_fasting_mg_dl, target_postprandial_mg_dl,
      postprandial_window, target_hba1c, insulin_regimen_type, dietary_calories_prescribed,
      fetal_surveillance_notes, planned_delivery_weeks, status, notes,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, 26, 'dipsi', '2026-09-22',
      92, 172, 158, NULL, 5.7,
      'a1_diet', 'medical_nutrition_therapy', 95, 120,
      '2_hour', 6.0, 'none', 1800,
      'Fetal AC 65th centile. Normal amniotic fluid (AFI 15.5cm). No macrosomia.', 39, 'active',
      'Prescribed Medical Nutrition Therapy with 3 main meals and 2 low-glycemic snacks. Daily SMBG.',
      ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, now, now);
  const gdmProfileId = Number(gdmProfRes.lastInsertRowid) || 1;

  // Anita's Daily Multi-Point Blood Glucose Logbook (Past 3 days)
  const gdmLogs = [
    { d: '2026-11-04', t: '07:30', slot: 'fasting', val: 88, status: 'in_target', insulin: null, note: 'Pre-breakfast capillary sugar' },
    { d: '2026-11-04', t: '10:00', slot: 'post_breakfast', val: 114, status: 'in_target', insulin: null, note: 'Oats with nuts and milk' },
    { d: '2026-11-04', t: '14:30', slot: 'post_lunch', val: 118, status: 'in_target', insulin: null, note: 'Roti with dal, bhindi and curd' },
    { d: '2026-11-04', t: '21:30', slot: 'post_dinner', val: 132, status: 'mild_excursion', insulin: null, note: 'Had extra chapati and sweets' },
    { d: '2026-11-05', t: '07:45', slot: 'fasting', val: 91, status: 'in_target', insulin: null, note: 'Fasting' },
    { d: '2026-11-05', t: '10:15', slot: 'post_breakfast', val: 116, status: 'in_target', insulin: null, note: 'Besan chilla with mint chutney' },
    { d: '2026-11-05', t: '14:15', slot: 'post_lunch', val: 110, status: 'in_target', insulin: null, note: 'Brown rice with paneer' },
    { d: '2026-11-05', t: '21:15', slot: 'post_dinner', val: 119, status: 'in_target', insulin: null, note: 'Vegetable salad and dal soup' },
    { d: '2026-11-06', t: '07:30', slot: 'fasting', val: 89, status: 'in_target', insulin: null, note: 'Fasting before OPD checkup' },
    { d: '2026-11-06', t: '10:00', slot: 'post_breakfast', val: 112, status: 'in_target', insulin: null, note: 'Sprouts and boiled egg' },
  ];

  for (const l of gdmLogs) {
    db.prepare(`
      INSERT OR IGNORE INTO gdm_glucose_logs (
        profile_id, patient_id, log_date, log_time, meal_slot,
        blood_glucose_mg_dl, target_status, carbs_consumed_estimate,
        insulin_administered_units, source, notes, recorded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient_log', ?, ?, ?)
    `).run(
      gdmProfileId, anitaId, l.d, l.t, l.slot,
      l.val, l.status, l.note, l.insulin, l.note, docId, now
    );
  }

  // Fetal surveillance biometry check for Anita
  db.prepare(`
    INSERT OR IGNORE INTO gdm_fetal_surveillance (
      profile_id, patient_id, assessment_date, gestational_age_weeks,
      estimated_fetal_weight_g, efw_percentile, abdominal_circumference_mm,
      ac_percentile, amniotic_fluid_index_cm, single_deepest_pocket_cm,
      macrosomia_risk_flag, clinical_plan, created_by, created_at
    ) VALUES (
      ?, ?, '2026-11-04', 32,
      1920, 52, 280, 65, 15.5, 4.8,
      'normal', 'Adequate symmetric fetal growth (EFW 52nd centile, AC 65th centile). Normal AFI. Continue MNT.',
      ?, ?
    )
  `).run(gdmProfileId, anitaId, docId, now);

  // Anita's Antenatal CTG / Non-Stress Test (NST)
  const anitaCtgTrace = generateSyntheticCtgTrace(142, 'moderate', 20, 2, 'none', 1);
  db.prepare(`
    INSERT OR IGNORE INTO ctg_episodes (
      patient_id, test_type, performed_at, gestational_age_weeks,
      indication, duration_minutes, paper_speed_cm_min, baseline_fhr_bpm,
      variability_category, variability_amplitude_bpm, accelerations_count,
      accelerations_criteria, decelerations_type, decelerations_recurrent,
      uterine_contractions_per_10min, tachysystole_present, fetal_movement_felt,
      nst_classification, figo_classification, nichd_category,
      intrauterine_resuscitation_required, clinical_action_plan,
      recommended_follow_up, fhr_trace_data_json, notes,
      performed_by, reviewed_by, created_at, updated_at
    ) VALUES (
      ?, 'antenatal_nst', '2026-11-06T10:15:00', 32,
      'Third trimester fetal wellbeing surveillance (32w ANC)', 20, 1.0, 142,
      'moderate', 12, 2,
      '15x15', 'none', 0,
      1, 0, 1,
      'reactive', 'normal', 'category_1_normal',
      0, 'Reassuring Reactive NST. Normal baseline FHR and moderate variability.',
      'Routine follow-up in 2 weeks or earlier if decreased fetal movements.',
      ?, 'Mother in semi-Fowler position with left tilt. Reassuring fetal movements felt.',
      ?, ?, ?, ?
    )
  `).run(anitaId, JSON.stringify(anitaCtgTrace), nurseId, docId, now, now);

  // --- PATIENT 2: Baby of Kavita (Neonatal Jaundice & Bhutani Phototherapy Nomogram) ---
  const babyId = ensurePatient({
    patientNumber: 'P-1002',
    fullName: 'Baby of Kavita',
    phone: '9845011002',
    dateOfBirth: '2026-11-04',
    estimatedAgeYears: 0,
    gravida: 0,
    para: 0,
    living: 0,
    abortions: 0,
    allergyStatus: 'none',
    medicalHistory: 'Term female infant born via elective LSCS at 38 weeks. Birth weight 3100g. Apgar 9/10.',
  });

  const birthTime = '2026-11-04T10:00:00';
  const jRes = db.prepare(`
    INSERT OR IGNORE INTO neonatal_jaundice_episodes (
      patient_id, birth_datetime, gestational_age_weeks, birth_weight_grams, blood_group,
      maternal_blood_group, direct_coombs_test, g6pd_deficiency, neurotoxicity_risk,
      feeding_type, status, clinical_summary, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, 38, 3100, 'A+', 'O+', 'negative', 'normal', 0, 'exclusive_breastfeeding', 'under_phototherapy', 'Term infant with early physiologic-exaggerated neonatal hyperbilirubinemia.', ?, ?, ?, ?)
  `).run(babyId, birthTime, docId, docId, now, now);
  const jEpId = Number(jRes.lastInsertRowid) || 1;

  // Bilirubin readings plotted across Bhutani nomogram
  const readings = [
    { sample: '2026-11-05T04:00:00', hours: 18, type: 'tcb_transcutaneous', mg: 5.8, zone: 'low_intermediate', photoThresh: 11.2, indicated: 0, active: 0, action: 'Repeat transcutaneous check in 12 hours.' },
    { sample: '2026-11-05T16:00:00', hours: 30, type: 'tsb_serum', mg: 9.8, zone: 'high_intermediate', photoThresh: 13.0, indicated: 0, active: 0, action: 'Bilirubin rising. Promote frequent breastfeeding every 2 hours.' },
    { sample: '2026-11-06T04:00:00', hours: 42, type: 'tsb_serum', mg: 13.5, zone: 'high_intermediate', photoThresh: 14.2, indicated: 0, active: 0, action: 'Approaching phototherapy threshold. Monitor diaper output.' },
    { sample: '2026-11-06T10:00:00', hours: 48, type: 'tsb_serum', mg: 15.6, zone: 'high', photoThresh: 14.8, indicated: 1, active: 1, action: 'AAP Phototherapy threshold crossed (15.6 >= 14.8 mg/dL). Initiate intensive LED phototherapy with eye protection.' },
  ];

  for (const rd of readings) {
    db.prepare(`
      INSERT OR IGNORE INTO neonatal_bilirubin_readings (
        episode_id, patient_id, sample_datetime, age_hours, reading_type, bilirubin_mg_dl,
        bilirubin_umol_l, bhutani_risk_zone, phototherapy_threshold_mg_dl, exchange_threshold_mg_dl,
        phototherapy_indicated, exchange_indicated, clinical_action, active_phototherapy,
        phototherapy_device, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 22.0, ?, 0, ?, ?, 'LED Double Surface Overhead Bank', 'Eye shield placed, temperature monitored.', ?, ?)
    `).run(
      jEpId, babyId, rd.sample, rd.hours, rd.type, rd.mg,
      Math.round(rd.mg * 17.1), rd.zone, rd.photoThresh, rd.indicated,
      rd.action, rd.active, docId, now
    );
  }

  // --- PATIENT 3: Pooja Reddy (Infertility Workup & Serial Folliculometry Cycle) ---
  const poojaId = ensurePatient({
    patientNumber: 'P-1003',
    fullName: 'Pooja Reddy',
    phone: '9845011003',
    dateOfBirth: '1996-06-12',
    estimatedAgeYears: 29,
    gravida: 0,
    para: 0,
    living: 0,
    abortions: 0,
    lastMenstrualPeriod: '2026-10-24',
    allergyStatus: 'none',
    medicalHistory: 'Primary infertility 3 years. Irregular cycles 35-50 days. Polycystic ovarian morphology.',
    ongoingMedicines: 'Tab Metformin 500mg BD, Tab Myo-Inositol 2g BD, Tab Folic Acid 5mg OD',
  });

  const wRes = db.prepare(`
    INSERT OR IGNORE INTO infertility_workups (
      patient_id, partner_name, partner_age, infertility_type, duration_years, female_factors,
      baseline_amh_ng_ml, baseline_fsh_miu_ml, baseline_afc_total, hsg_findings, semen_volume_ml,
      semen_concentration_mil_ml, semen_total_motility_pct, semen_progressive_motility_pct,
      semen_normal_morphology_pct, semen_analysis_interpretation, clinical_notes,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, 'Karthik Reddy', 33, 'primary', 3.0, '["pcos", "anovulatory_cycles"]', 5.6, 6.2, 24, 'Bilateral patent fallopian tubes with free peritoneal spill', 2.8, 52, 60, 42, 5, 'Normozoospermia', 'Anovulatory PCOS. Advised Letrozole ovulation induction with serial TVS folliculometry.', ?, ?, ?, ?)
  `).run(poojaId, docId, docId, now, now);
  const workupId = Number(wRes.lastInsertRowid) || 1;

  const cRes = db.prepare(`
    INSERT OR IGNORE INTO folliculometry_cycles (
      patient_id, workup_id, cycle_number, lmp_date, protocol_type, protocol_details,
      planned_procedure, status, trigger_drug, trigger_datetime, advised_tic_iui_datetime,
      luteal_support, cycle_outcome, outcome_notes, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, 1, '2026-10-24', 'letrozole', 'Letrozole 5mg OD CD 3 to 7', 'timed_intercourse', 'ovulated_ruptured', 'rhCG 250 mcg (Ovitrelle) SC stat', '2026-11-04T21:00:00', '2026-11-06T09:00:00', 'Micronized Progesterone 200mg BD x 14 days post-ovulation', 'pending', 'Ovulation confirmed. Urine pregnancy test scheduled on CD 28.', ?, ?, ?, ?)
  `).run(poojaId, workupId, docId, docId, now, now);
  const cycleId = Number(cRes.lastInsertRowid) || 1;

  // Serial TVS scans for Pooja
  const scans = [
    { dt: '2026-10-26T09:00:00', cd: 3, r: [6, 7, 8], l: [5, 6, 7], lead: 8.0, ovary: 'right', et: 3.5, pat: 'isogenous_b', stage: 'early_follicular', advice: 'Baseline scan. Bilateral AFC 20+. Start Letrozole 5mg CD 3-7.' },
    { dt: '2026-11-01T10:30:00', cd: 9, r: [13.5, 10.0], l: [11.0, 9.0], lead: 13.5, ovary: 'right', et: 6.5, pat: 'trilaminar_a', stage: 'mid_follicular', advice: 'Right ovary dominant follicle growing at 1.8mm/day. Re-scan in 3 days.' },
    { dt: '2026-11-04T11:00:00', cd: 12, r: [18.5, 11.0], l: [10.0], lead: 18.5, ovary: 'right', et: 8.8, pat: 'trilaminar_a', stage: 'mature_ready_to_trigger', advice: 'Mature 18.5mm follicle, optimal trilaminar endometrium (8.8mm). Administer hCG trigger tonight at 9 PM. Timed intercourse 24h & 36h post-trigger.' },
    { dt: '2026-11-06T10:00:00', cd: 14, r: [], l: [10.0], lead: 0, ovary: 'none', et: 9.6, pat: 'hyperechoic_c', stage: 'ovulated_corpus_luteum', advice: 'Rupture confirmed. Right ovary corpus luteum with free fluid in POD. Initiate luteal progesterone support.' },
  ];

  for (const s of scans) {
    db.prepare(`
      INSERT OR IGNORE INTO folliculometry_scans (
        cycle_id, patient_id, scan_datetime, cycle_day, right_ovary_follicles, left_ovary_follicles,
        leading_follicle_size_mm, leading_follicle_ovary, endometrial_thickness_mm, endometrial_pattern,
        free_fluid_pod, ovulation_rupture_observed, growth_rate_mm_day, readiness_stage, clinical_advice,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cycleId, poojaId, s.dt, s.cd, JSON.stringify(s.r), JSON.stringify(s.l),
      s.lead, s.ovary, s.et, s.pat, s.stage === 'ovulated_corpus_luteum' ? 1 : 0,
      s.stage === 'ovulated_corpus_luteum' ? 1 : 0, s.cd === 12 ? 1.67 : null,
      s.stage, s.advice, docId, now
    );
  }

  // --- PATIENT 4: Sunita Rao (Post-Cesarean ERAS Pathway & REEDA Wound Healing) ---
  const sunitaId = ensurePatient({
    patientNumber: 'P-1004',
    fullName: 'Sunita Rao',
    phone: '9845011004',
    dateOfBirth: '1994-09-18',
    estimatedAgeYears: 31,
    gravida: 2,
    para: 2,
    living: 2,
    abortions: 0,
    allergyStatus: 'none',
    medicalHistory: 'Previous LSCS in 2021. Repeat elective LSCS performed 2 days ago.',
    ongoingMedicines: 'Tab Paracetamol 1g QID, Tab Ibuprofen 400mg TID, Tab Pantoprazole 40mg OD',
  });

  const surgeryDt = '2026-11-04T09:00:00';
  const pRes = db.prepare(`
    INSERT OR IGNORE INTO eras_post_op_pathways (
      patient_id, surgery_datetime, surgery_type, incision_type, skin_closure_type,
      oral_fluids_achieved_hours, regular_diet_achieved_hours, catheter_removed_hours,
      first_mobilization_hours, multimodal_analgesia_adherent, dvt_prophylaxis_applied,
      status, clinical_notes, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, 'elective_lscs', 'pfannenstiel', 'subcuticular_monocryl', 1.5, 5.0, 8.0, 10.0, 1, 'early_mobilization_ted', 'discharge_ready', 'Excellent post-op recovery. Full ERAS milestone compliance achieved. Patient ambulating comfortably and breastfeeding.', ?, ?, ?, ?)
  `).run(sunitaId, surgeryDt, docId, docId, now, now);
  const pathwayId = Number(pRes.lastInsertRowid) || 1;

  // REEDA wound evaluations
  const reedaEntries = [
    { dt: '2026-11-04T17:00:00', pod: 0, r: 0, e: 0, ec: 0, d: 0, a: 0, tot: 0, pain: 4, dress: 'dry_intact', cat: 'optimal_healing', plan: 'Incision intact under sterile dressing. Scheduled IV paracetamol.' },
    { dt: '2026-11-05T10:00:00', pod: 1, r: 1, e: 0, ec: 0, d: 0, a: 0, tot: 1, pain: 3, dress: 'removed_clean', cat: 'mild_inflammation', plan: 'Dressing removed. Mild physiologic erythema < 0.25cm. Keep clean and dry.' },
    { dt: '2026-11-06T09:30:00', pod: 2, r: 0, e: 0, ec: 0, d: 0, a: 0, tot: 0, pain: 1, dress: 'removed_clean', cat: 'optimal_healing', plan: 'Wound edges fully coapted, dry, non-tender. Afebrile. Cleared for discharge.' },
  ];

  for (const re of reedaEntries) {
    db.prepare(`
      INSERT OR IGNORE INTO reeda_wound_assessments (
        pathway_id, patient_id, assessment_datetime, post_op_day, redness_score,
        edema_score, ecchymosis_score, discharge_score, approximation_score,
        total_reeda_score, pain_score_10, dressing_condition, healing_category,
        action_plan, assessor_notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Evaluated by duty obstetrician', ?, ?)
    `).run(
      pathwayId, sunitaId, re.dt, re.pod, re.r, re.e, re.ec, re.d, re.a,
      re.tot, re.pain, re.dress, re.cat, re.plan, docId, now
    );
  }

  // --- PATIENT 5: Meera Patel (Labor Ward Inpatient, Partograph, Golden Minute) ---
  const meeraId = ensurePatient({
    patientNumber: 'P-1005',
    fullName: 'Meera Patel',
    phone: '9845011005',
    dateOfBirth: '1999-02-14',
    estimatedAgeYears: 27,
    gravida: 1,
    para: 0,
    living: 0,
    abortions: 0,
    lastMenstrualPeriod: '2026-02-01',
    allergyStatus: 'known',
    allergyDetails: 'Penicillin - skin rash',
    medicalHistory: 'Primigravida at 39 weeks. Spontaneous labor onset.',
  });

  // Assign Meera to Labor Ward Bed L-01
  const bedL1 = db.prepare("SELECT id FROM beds WHERE label = 'L-01'").get() as { id: number };
  if (bedL1) {
    db.prepare(`
      INSERT OR IGNORE INTO admissions (
        admission_number, patient_id, bed_id, admitted_at, status, reason,
        diagnosis, initial_assessment, treatment_plan, version, created_by, created_at, updated_at
      ) VALUES ('ADM-2026-001', ?, ?, '2026-11-06T06:00:00', 'admitted', 'Labor pains at term', 'Active Labor at 39 weeks', 'Cervix 4cm dilated, 80% effaced, vertex presentation', 'Monitor partograph, maternal-fetal vitals', 1, ?, ?, ?)
    `).run(meeraId, bedL1.id, docId, now, now);
  }

  // --- PATIENT 6: Master Aarav Patel (1-Year-Old Pediatric WHO Growth & Milestones) ---
  const aaravId = ensurePatient({
    patientNumber: 'P-1006',
    fullName: 'Master Aarav Patel',
    phone: '9845011005',
    dateOfBirth: '2025-11-01',
    estimatedAgeYears: 1,
    gravida: 0,
    para: 0,
    living: 0,
    abortions: 0,
    allergyStatus: 'none',
    medicalHistory: 'Term male infant delivered normal vaginal. Fully immunized to date. Exclusive breastfeeding x 6 months.',
  });

  // Longitudinal Growth Measurements across 12 months
  const aaravGrowth = [
    { d: '2025-11-01', m: 0, w: 3.3, h: 50.0, hc: 34.5, wz: 0.0, hz: 0.0, hcz: 0.0, notes: 'Birth anthropometry. Normal AGA.' },
    { d: '2026-02-01', m: 3, w: 6.4, h: 61.5, hc: 40.5, wz: 0.0, hz: 0.05, hcz: 0.0, notes: '3-month checkup. Smiling, head control improving.' },
    { d: '2026-05-01', m: 6, w: 7.9, h: 67.5, hc: 43.3, wz: 0.0, hz: -0.05, hcz: 0.0, notes: '6-month checkup. Complementary feeding started (khichdi, mashed banana).' },
    { d: '2026-08-01', m: 9, w: 8.9, h: 72.0, hc: 45.0, wz: 0.0, hz: -0.1, hcz: 0.0, notes: '9-month checkup. Sitting independently, babbling.' },
    { d: '2026-11-01', m: 12, w: 9.7, h: 75.8, hc: 46.2, wz: 0.1, hz: 0.05, hcz: 0.05, notes: '1-year well-baby checkup. Cruising, mature pincer grasp, waving bye-bye.' },
  ];

  for (const g of aaravGrowth) {
    db.prepare(`
      INSERT OR IGNORE INTO pediatric_growth_records (
        patient_id, recorded_date, age_months, sex, weight_kg, height_length_cm,
        head_circumference_cm, bmi, weight_for_age_z, weight_for_age_status,
        height_for_age_z, height_for_age_status, weight_for_height_z,
        weight_for_height_status, hc_for_age_z, hc_for_age_status,
        clinical_notes, recorded_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'male', ?, ?,
        ?, 16.9, ?, 'normal',
        ?, 'normal', 0.0,
        'normal', ?, 'normal',
        ?, ?, ?, ?
      )
    `).run(
      aaravId, g.d, g.m, g.w, g.h,
      g.hc, g.wz, g.hz, g.hcz,
      g.notes, docId, now, now
    );
  }

  // Milestones evaluated for Aarav
  const aaravMilestones = [
    { k: 'neck_holding_3m', t: 'Complete Neck Holding', d: 'gross_motor', exp: 3, up: 5, st: 'achieved', dt: '2026-01-28', age: 2.9 },
    { k: 'rolls_over_5m', t: 'Rolls Over (Back to Tummy)', d: 'gross_motor', exp: 5, up: 7, st: 'achieved', dt: '2026-03-25', age: 4.8 },
    { k: 'sits_without_support_6m', t: 'Sits Without Support', d: 'gross_motor', exp: 7, up: 9, st: 'achieved', dt: '2026-05-20', age: 6.6 },
    { k: 'stands_with_support_9m', t: 'Stands Holding On (Cruising)', d: 'gross_motor', exp: 9, up: 12, st: 'achieved', dt: '2026-08-10', age: 9.3 },
    { k: 'social_smile_2m', t: 'Social Smile in Response', d: 'fine_motor_adaptive', exp: 2, up: 3, st: 'achieved', dt: '2025-12-24', age: 1.8 },
    { k: 'pincer_grasp_9m', t: 'Mature Pincer Grasp (Thumb-Index)', d: 'fine_motor_adaptive', exp: 9.5, up: 12, st: 'achieved', dt: '2026-08-15', age: 9.5 },
    { k: 'cooing_laughing_3m', t: 'Cooing & Laughs Aloud', d: 'language_hearing', exp: 3.5, up: 6, st: 'achieved', dt: '2026-02-15', age: 3.5 },
    { k: 'babbling_monosyllables_6m', t: 'Monosyllabic Babbling (da, ma)', d: 'language_hearing', exp: 6.5, up: 9, st: 'achieved', dt: '2026-05-15', age: 6.5 },
    { k: 'first_meaningful_words_12m', t: 'First Meaningful Words (1-2 Words)', d: 'language_hearing', exp: 12, up: 15, st: 'achieved', dt: '2026-10-28', age: 11.9 },
    { k: 'waves_bye_bye_9m', t: 'Waves Bye-Bye & Plays Peek-a-boo', d: 'personal_social', exp: 9.5, up: 12, st: 'achieved', dt: '2026-08-20', age: 9.7 },
  ];

  for (const ms of aaravMilestones) {
    db.prepare(`
      INSERT OR IGNORE INTO pediatric_milestone_evaluations (
        patient_id, milestone_key, milestone_title, domain,
        expected_age_months, upper_limit_age_months, status,
        achieved_date, age_achieved_months, is_red_flag, notes,
        recorded_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Achieved on schedule.', ?, ?, ?)
    `).run(aaravId, ms.k, ms.t, ms.d, ms.exp, ms.up, ms.st, ms.dt, ms.age, docId, now, now);
  }

  // --- Cervical Cancer Screening & Colposcopy Records ---
  // 1. Sunita Rao (P-1004): Abnormal Cotest (HSIL + HPV 16) with Colposcopy, Swede Score 8/10, Biopsies (CIN 3/CIN 2)
  const sunitaScreeningRes = db.prepare(`
    INSERT OR IGNORE INTO cervical_screening_records (
      patient_id, screening_date, screening_type, indication,
      pap_performed, pap_sample_type, pap_adequacy, pap_result, pap_infections, pap_lab_name, pap_report_number,
      hpv_performed, hpv_test_type, hpv_overall_result, hpv_16_positive, hpv_18_positive, hpv_45_positive, hpv_other_high_risk_positive,
      colposcopy_performed, colposcopy_date, examiner_name, cervix_visibility, transformation_zone_type, squamocolumnar_junction_visible,
      swede_acetowhitening, swede_margins, swede_vessels, swede_lesion_size, swede_iodine_staining, swede_score_total, swede_interpretation,
      reid_margin, reid_color, reid_vessels, reid_iodine, reid_score_total, reid_interpretation,
      lesion_quadrants, endocervical_curettage_done,
      biopsy_taken, biopsy_type, biopsy_sites, biopsy_result, histopathology_number,
      management_recommendation, next_recall_months, clinical_notes, status,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-10-15', 'co_test', 'routine_screening',
      1, 'liquid_based', 'satisfactory_with_ec_tz', 'hsil', '[]', 'Metropolis Path Lab', 'CYT-2026-8812',
      1, 'pcr', 'positive', 1, 0, 0, 1,
      1, '2026-10-22', 'Dr. Demo Sharma', 'fully_visible', 'type_1', 'completely_visible',
      2, 2, 1, 1, 2, 8, 'high_probability_cin2_3_cancer',
      2, 2, 1, 2, 7, 'Likely High-Grade Lesion (CIN 2–3)',
      '["12_oclock", "1_oclock", "6_oclock"]', 0,
      1, 'punch_biopsy', '12 oclock and 6 oclock anterior and posterior lips', 'cin_2_moderate', 'HP-2026-4401',
      'Cervical Excisional Procedure (LEEP / LLETZ) Indicated', 3,
      'Dense acetowhite epithelium with coarse punctation at 12 oclock and rolled peeling borders. Directed punch biopsies taken at 12 and 6 oclock. Advised therapeutic LEEP.', 'completed',
      ?, ?, ?, ?
    )
  `).run(sunitaId, docId, docId, now, now);

  const sunitaScreeningId = Number(sunitaScreeningRes.lastInsertRowid) || 1;

  db.prepare(`
    INSERT OR IGNORE INTO cervical_biopsies (
      screening_id, patient_id, site_location, clock_position, specimen_label,
      histopathology_result, pathologist_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sunitaScreeningId, sunitaId, "12 o'clock anterior lip", 12, 'BX-A',
    'cin_3_cis', 'High-grade squamous intraepithelial lesion (CIN 3 / severe dysplasia) involving endocervical crypts with clear margins.',
    now, now
  );

  db.prepare(`
    INSERT OR IGNORE INTO cervical_biopsies (
      screening_id, patient_id, site_location, clock_position, specimen_label,
      histopathology_result, pathologist_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sunitaScreeningId, sunitaId, "6 o'clock posterior lip", 6, 'BX-B',
    'cin_2', 'Moderate squamous intraepithelial dysplasia (CIN 2) with prominent koilocytosis.',
    now, now
  );

  // 2. Anita Sharma (P-1001): Normal Well-Woman Cotest
  db.prepare(`
    INSERT OR IGNORE INTO cervical_screening_records (
      patient_id, screening_date, screening_type, indication,
      pap_performed, pap_sample_type, pap_adequacy, pap_result, pap_infections, pap_lab_name, pap_report_number,
      hpv_performed, hpv_test_type, hpv_overall_result, hpv_16_positive, hpv_18_positive, hpv_45_positive, hpv_other_high_risk_positive,
      colposcopy_performed, management_recommendation, next_recall_months, clinical_notes, status,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2025-08-10', 'co_test', 'routine_screening',
      1, 'liquid_based', 'satisfactory_with_ec_tz', 'nilm', '[]', 'Dr Lal PathLabs', 'LAL-9921',
      1, 'pcr', 'negative', 0, 0, 0, 0,
      0, 'Routine Cervical Cancer Screening (Cotesting in 5 Years or Cytology Smear in 3 Years)', 60,
      'Normal cervix. Squamous and endocervical cells present. Reassuring results.', 'completed',
      ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, now, now);

  // --- Contraception Counseling & Postpartum IUCD Registry ---
  // Sunita Rao (P-1004): Intracesarean PPIUCD (Cu-T 380A) with WHO MEC counseling
  const sunitaCounselingRes = db.prepare(`
    INSERT OR IGNORE INTO contraceptive_counseling_records (
      patient_id, counseling_date, reproductive_plan, desired_spacing_years,
      breastfeeding_status, medical_conditions_json, eligibility_results_json,
      chosen_method, method_rationale, next_followup_date, counseled_by, created_at, updated_at
    ) VALUES (
      ?, '2026-11-03', 'limiting_completed_family', NULL,
      'exclusive_breastfeeding_lt_6w', '["postpartum_lt_3w", "breastfeeding_lt_6w"]',
      '{}', 'cu_t_380a',
      'Patient Para 2 with completed family desires long-acting non-hormonal contraception. Decided on intracesarean PPIUCD Cu-T 380A.',
      '2026-12-16', ?, ?, ?
    )
  `).run(sunitaId, docId, now, now);
  const sunitaCounselingId = Number(sunitaCounselingRes.lastInsertRowid) || 1;

  const sunitaIucdRes = db.prepare(`
    INSERT OR IGNORE INTO iucd_insertions (
      patient_id, counseling_id, device_type, device_brand_name, lot_batch_number,
      device_expiry_date, insertion_timing, insertion_date, insertion_time, inserted_by,
      uterine_depth_cm, analgesia_used, thread_length_cut_cm, insertion_ease,
      complications, post_insertion_ultrasound, lifespan_years, expected_removal_date,
      status, clinical_notes, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, ?, 'cu_t_380a', 'Pregna TCu380A', 'LOT-PPIUCD-2026',
      '2031-10-01', 'post_cesarean_intracesarean', '2026-11-04', '09:35', 'Dr. Demo Sharma',
      9.0, 'general_epidural_anesthesia', 4.0, 'smooth',
      'none', 'fundal_position_confirmed', 10, '2036-11-04',
      'in_situ', 'High fundal placement achieved using ring forceps before uterine incision closure. Strings directed toward cervical os without entrapment in hysterotomy suture.',
      ?, ?, ?, ?
    )
  `).run(sunitaId, sunitaCounselingId, docId, docId, now, now);
  const sunitaIucdId = Number(sunitaIucdRes.lastInsertRowid) || 1;

  db.prepare(`
    INSERT OR IGNORE INTO iucd_followups (
      insertion_id, patient_id, followup_date, visit_interval,
      thread_status, pelvic_ultrasound_done, ultrasound_finding,
      bleeding_pattern, pelvic_pain_score, signs_of_infection,
      action_taken, clinical_notes, examined_by, created_at, updated_at
    ) VALUES (
      ?, ?, '2026-11-06', '6_weeks_post_insertion',
      'threads_visible_normal', 1, 'normal_fundal',
      'normal_regular', 1, 0,
      'continue_in_situ_reassured',
      'Bedside ultrasound confirms fundal position. Threads visible at external os ~3cm. Patient reassured.',
      ?, ?, ?
    )
  `).run(sunitaIucdId, sunitaId, docId, now, now);

  // --- STATUTORY PC-PNDT ACT SETTINGS & FORM 'F' SEEDING ---
  const clinicSettings = [
    ['clinicName', "Dr. Rao's Maternity, Fetal Medicine & Surgical Centre"],
    ['clinicTagline', 'Centre for Advanced Obstetrics & Prenatal Diagnosis'],
    ['doctorName', 'Dr. K. Sarayu Rao'],
    ['doctorQualifications', 'MBBS, MS (OBGYN), DNB, FMAS, Fellow in Fetal Medicine'],
    ['registrationNo', 'MMC-2012/04/0892'],
    ['pndtRegistrationNo', 'MH/PNDT/2021/045'],
    ['pndtMachineDetails', 'GE Voluson E8 Expert 4D, S/N: US-GE-89241'],
    ['address', 'Plot 42, Bhandarkar Road, Deccan Gymkhana, Pune, Maharashtra - 411004'],
    ['phone', '+91 98220 12345'],
    ['email', 'care@drraoclinic.com'],
    ['website', 'www.drraoclinic.com'],
  ];

  for (const [k, v] of clinicSettings) {
    db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(k, v, now);
  }

  // 1. Anita Sharma (P-1001) Form F: Growth & Doppler Scan at 32 weeks
  db.prepare(`
    INSERT OR IGNORE INTO pndt_form_f_records (
      form_f_number, patient_id, scan_date, scan_time, clinic_pndt_reg_no,
      doctor_id, doctor_name, doctor_reg_no, machine_model_serial,
      patient_name, patient_age, husband_or_father_name, full_address, contact_phone,
      num_living_male_children, male_children_ages, num_living_female_children, female_children_ages, total_living_children,
      lmp, gestational_age_weeks, gestational_age_days,
      referral_type, referring_doctor_name, referring_doctor_reg_no, referring_clinic_address, referral_slip_date, self_referral_reason,
      indication_codes, other_indication_detail, invasive_procedure_done, invasive_procedure_details,
      pregnant_woman_declaration_signed, pregnant_woman_declaration_time, pregnant_woman_signature_name,
      doctor_declaration_signed, doctor_declaration_time, doctor_declaration_name,
      fetal_number, cardiac_activity, congenital_anomaly_detected, congenital_anomaly_details, scan_result_summary,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      'PNDT-202611-0001', ?, '2026-11-04', '10:15', 'MH/PNDT/2021/045',
      ?, 'Dr. K. Sarayu Rao', 'MMC-2012/04/0892', 'GE Voluson E8 Expert 4D, S/N: US-GE-89241',
      'Anita Sharma', 28, 'Rajesh Sharma', 'Flat 402, Shivajinagar, Pune, Maharashtra', '9845011001',
      1, '3 yrs', 0, NULL, 1,
      '2026-03-25', 32, 0,
      'self_referred', NULL, NULL, NULL, NULL, 'Third trimester routine antenatal growth and Doppler surveillance',
      '["FETAL_GROWTH_FGR","AMNIOTIC_FLUID_LIQUOR","FETAL_DOPPLER"]', NULL, 0, NULL,
      1, '2026-11-04 10:10', 'Anita Sharma',
      1, '2026-11-04 10:15', 'Dr. K. Sarayu Rao',
      'single', 'present', 0, NULL, 'Single live intrauterine gestation at 32 weeks with AGA growth and normal Doppler hemodynamics (CPR 1.56).',
      ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, docId, now, now);

  // 2. Sunita Rao (P-1004) Form F: Mid-Trimester Anomaly Scan
  db.prepare(`
    INSERT OR IGNORE INTO pndt_form_f_records (
      form_f_number, patient_id, scan_date, scan_time, clinic_pndt_reg_no,
      doctor_id, doctor_name, doctor_reg_no, machine_model_serial,
      patient_name, patient_age, husband_or_father_name, full_address, contact_phone,
      num_living_male_children, male_children_ages, num_living_female_children, female_children_ages, total_living_children,
      lmp, gestational_age_weeks, gestational_age_days,
      referral_type, referring_doctor_name, referring_doctor_reg_no, referring_clinic_address, referral_slip_date, self_referral_reason,
      indication_codes, other_indication_detail, invasive_procedure_done, invasive_procedure_details,
      pregnant_woman_declaration_signed, pregnant_woman_declaration_time, pregnant_woman_signature_name,
      doctor_declaration_signed, doctor_declaration_time, doctor_declaration_name,
      fetal_number, cardiac_activity, congenital_anomaly_detected, congenital_anomaly_details, scan_result_summary,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      'PNDT-202611-0002', ?, '2026-11-02', '11:30', 'MH/PNDT/2021/045',
      ?, 'Dr. K. Sarayu Rao', 'MMC-2012/04/0892', 'GE Voluson E8 Expert 4D, S/N: US-GE-89241',
      'Sunita Rao', 32, 'Ramesh Rao', 'Plot 18, Kothrud, Pune, Maharashtra', '9845011004',
      0, NULL, 2, '2, 5 yrs', 2,
      '2026-06-15', 20, 2,
      'doctor_referred', 'Dr. V. K. Joshi', 'MMC-45812', 'Joshi Polyclinic, Karve Road, Pune', '2026-10-30', NULL,
      '["ANOMALY_DETECTION","GA_ESTIMATION"]', NULL, 0, NULL,
      1, '2026-11-02 11:25', 'Sunita Rao',
      1, '2026-11-02 11:30', 'Dr. K. Sarayu Rao',
      'single', 'present', 0, NULL, 'Normal targeted level-2 fetal anatomy survey. No congenital structural defect observed.',
      ?, ?, ?, ?
    )
  `).run(sunitaId, docId, docId, docId, now, now);

  // 3. Antenatal Genetic Screening & Aneuploidy Records
  // Anita Sharma (P-1001) - Low Risk First Trimester Combined Screening
  db.prepare(`
    INSERT OR IGNORE INTO genetic_screening_episodes (
      patient_id, screening_date, screening_type, gestational_age_weeks, gestational_age_days,
      maternal_age_at_delivery, maternal_weight_kg, pregnancy_type, ivf_pregnancy, diabetes_status, smoker,
      crl_mm, nt_measured_mm, nt_mom, nasal_bone, tricuspid_regurgitation, ductus_venosus,
      free_beta_hcg_mom, papp_a_mom,
      background_t21_risk_ratio, adjusted_t21_risk_ratio, adjusted_t21_risk_numeric,
      adjusted_t18_risk_ratio, adjusted_t18_risk_numeric,
      adjusted_t13_risk_ratio, adjusted_t13_risk_numeric,
      ontd_risk_status, overall_risk_tier,
      clinical_recommendation, counseling_notes, counseled_by, patient_decision,
      invasive_procedure_type,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-06-25', 'first_trimester_combined', 12, 3,
      28, 58.5, 'singleton', 0, 0, 0,
      62.5, 1.45, 0.90, 'present', 'normal', 'positive',
      1.10, 1.25,
      '1:1078', '1:4850', 0.000206,
      '1:12000', 0.000083,
      '1:35000', 0.000028,
      'not_applicable', 'low_risk',
      'LOW RISK: Reassuring first trimester screening. Reassure the patient and proceed with routine antenatal care. Schedule Level-II targeted anomaly ultrasound scan (TIFFA) at 18–20 weeks.',
      'Pre-test and post-test genetic counseling completed. Patient informed of high negative predictive value and advised routine ANC.',
      ?, 'routine_care',
      'none',
      ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, docId, now, now);

  // Sunita Rao (P-1004) - Cell-Free DNA / NIPT Screening
  db.prepare(`
    INSERT OR IGNORE INTO genetic_screening_episodes (
      patient_id, screening_date, screening_type, gestational_age_weeks, gestational_age_days,
      maternal_age_at_delivery, maternal_weight_kg, pregnancy_type, ivf_pregnancy, diabetes_status, smoker,
      background_t21_risk_ratio, adjusted_t21_risk_ratio, adjusted_t21_risk_numeric,
      adjusted_t18_risk_ratio, adjusted_t18_risk_numeric,
      adjusted_t13_risk_ratio, adjusted_t13_risk_numeric,
      ontd_risk_status, overall_risk_tier,
      nipt_sample_date, nipt_fetal_fraction_percent,
      nipt_t21_result, nipt_t18_result, nipt_t13_result,
      nipt_sex_chromosomes, nipt_microdeletions, nipt_lab_name,
      clinical_recommendation, counseling_notes, counseled_by, patient_decision,
      invasive_procedure_type,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-07-02', 'nipt_cfdna', 14, 1,
      32, 64.0, 'singleton', 0, 0, 0,
      '1:780', '1:50000', 0.00002,
      '1:50000', 0.00001,
      '1:50000', 0.00001,
      'not_applicable', 'low_risk',
      '2026-07-02', 9.4,
      'low_risk', 'low_risk', 'low_risk',
      'Consistent with Female (46,XX)', 'No microdeletions detected (22q11.2, 1p36, Angelman)', 'MedGenome Genomics',
      'LOW-RISK NIPT RESULT: Reassuring cell-free DNA result with detection rate > 99% for Trisomy 21 and > 98% for Trisomy 18. Fetal fraction adequate (9.4%). Continue routine antenatal care and Level-II ultrasound scan at 18–20 weeks.',
      'Advanced maternal age secondary screening discussed. Low-risk result explained, patient decided for routine Level-II scan.',
      ?, 'routine_care',
      'none',
      ?, ?, ?, ?
    )
  `).run(sunitaId, docId, docId, docId, now, now);

  // 4. Fetal Doppler Velocimetry & CPR Assessments
  // Anita Sharma (P-1001) - Normal Reassuring Doppler at 32 weeks
  db.prepare(`
    INSERT OR IGNORE INTO fetal_doppler_assessments (
      patient_id, assessment_date, assessment_time, gestational_age_weeks, gestational_age_days,
      estimated_fetal_weight_g, efw_percentile, abdominal_circumference_mm, ac_percentile,
      ua_pi, ua_ri, ua_sd_ratio, ua_end_diastolic_flow, ua_pi_centile, ua_pi_status,
      mca_pi, mca_ri, mca_psv_cm_s, mca_psv_mom, mca_pi_centile, mca_brain_sparing, fetal_anemia_risk,
      cpr_ratio, cpr_centile, cpr_status,
      uta_left_pi, uta_right_pi, uta_mean_pi, uta_mean_pi_centile, uta_notching,
      dv_piv, dv_piv_centile, dv_a_wave, dv_status,
      fgr_classification, barcelona_stage,
      monitoring_frequency_recommendation, delivery_timing_recommendation,
      steroids_indicated, mgso4_neuroprotection_indicated,
      clinical_notes, performed_by, reviewed_by,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-11-04', '10:15', 32, 0,
      1920, 52.0, 280.0, 65.0,
      0.95, 0.61, 2.58, 'normal_positive', 48.0, 'normal',
      2.05, 0.76, 44.0, 1.00, 55.0, 'none', 'none',
      2.16, 55.0, 'normal',
      0.72, 0.68, 0.70, 50.0, 'none',
      0.50, 48.0, 'positive', 'normal',
      'aga', 'stage_0',
      'Routine antenatal surveillance every 2–3 weeks.',
      'Expectant management; deliver at 39–40 weeks.',
      0, 0,
      'Reassuring fetal hemodynamics. Symmetrical AGA growth with normal umbilical artery impedance and healthy CPR.',
      'Dr. K. Sarayu Rao', ?,
      ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, docId, now, now);

  // Sunita Rao (P-1004) - Stage I Late FGR with Brain-Sparing Redistribution (CPR 0.79)
  db.prepare(`
    INSERT OR IGNORE INTO fetal_doppler_assessments (
      patient_id, assessment_date, assessment_time, gestational_age_weeks, gestational_age_days,
      estimated_fetal_weight_g, efw_percentile, abdominal_circumference_mm, ac_percentile,
      ua_pi, ua_ri, ua_sd_ratio, ua_end_diastolic_flow, ua_pi_centile, ua_pi_status,
      mca_pi, mca_ri, mca_psv_cm_s, mca_psv_mom, mca_pi_centile, mca_brain_sparing, fetal_anemia_risk,
      cpr_ratio, cpr_centile, cpr_status,
      uta_left_pi, uta_right_pi, uta_mean_pi, uta_mean_pi_centile, uta_notching,
      dv_piv, dv_piv_centile, dv_a_wave, dv_status,
      fgr_classification, barcelona_stage,
      monitoring_frequency_recommendation, delivery_timing_recommendation,
      steroids_indicated, mgso4_neuroprotection_indicated,
      clinical_notes, performed_by, reviewed_by,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-11-02', '11:45', 34, 0,
      1780, 8.0, 270.0, 7.0,
      1.42, 0.74, 3.85, 'normal_positive', 96.0, 'elevated_above_95th',
      1.12, 0.58, 48.5, 0.99, 3.0, 'vasodilation_below_5th', 'none',
      0.79, 2.0, 'brain_sparing_redistribution',
      1.15, 1.01, 1.08, 97.0, 'unilateral',
      0.65, 78.0, 'positive', 'normal',
      'late_fgr', 'stage_1',
      'Weekly Doppler velocimetry (UA PI, MCA PI, CPR) and Biophysical Profile (BPP).',
      'Induction of labor at 37 weeks (trial of vaginal delivery with continuous intrapartum CTG).',
      0, 0,
      'Late-onset FGR with cerebral vasodilation (brain-sparing reflex on CPR < 1.0). High resistance in umbilical artery. Plan close weekly surveillance.',
      'Dr. K. Sarayu Rao', ?,
      ?, ?, ?, ?
    )
  `).run(sunitaId, docId, docId, docId, now, now);

  // --- 6D: PRE-ECLAMPSIA FIRST-TRIMESTER SCREENING SEED ---
  // Sunita Rao (P-1004) - High Risk (1:45) due to prior PE & elevated UtA PI with bilateral notch -> Aspirin 150mg
  db.prepare(`
    INSERT OR IGNORE INTO preeclampsia_screenings (
      patient_id, assessment_date, assessment_time, gestational_age_weeks, gestational_age_days, crl_mm,
      maternal_age, maternal_weight_kg, maternal_height_cm, bmi,
      ethnicity, parity, prior_pe_onset_gestation, conception_method, smoking_status,
      family_history_pe, chronic_hypertension, pregestational_diabetes,
      systemic_lupus_or_aps, chronic_kidney_disease, interpregnancy_interval_years,
      sbp_right, dbp_right, sbp_left, dbp_left, mean_arterial_pressure, map_mom,
      uta_pi_left, uta_pi_right, uta_pi_mean, uta_pi_mom, uta_bilateral_notching,
      serum_plgf_pg_ml, plgf_mom, serum_pappa_iu_l, pappa_mom,
      background_risk_ratio, background_risk_numeric,
      fmf_risk_ratio, fmf_risk_numeric, fmf_risk_category,
      clinical_risk_category, overall_risk_tier,
      aspirin_indicated, aspirin_dose_mg, aspirin_timing_rationale,
      calcium_indicated, calcium_dose_mg, surveillance_interval, repeat_scan_weeks,
      clinical_notes, performed_by, reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-10-15', '10:00', 12, 2, 60.0,
      31, 72.0, 158.0, 28.8,
      'south_asian', 'multiparous_prior_pe', 'preterm_34_37', 'spontaneous', 'non_smoker',
      1, 0, 0,
      0, 0, 3.5,
      132, 84, 130, 82, 99.3, 1.15,
      2.10, 2.25, 2.18, 1.35, 1,
      18.5, 0.45, 0.85, 0.85,
      '1:25', 0.04,
      '1:18', 0.055, 'high_risk',
      'high_risk', 'high_risk',
      1, 150, 'Start Aspirin 150 mg PO once daily at bedtime immediately (strictly before 16+0 weeks). Continue uninterrupted until 36+0 weeks gestation.',
      1, 1500, 'Enhanced antenatal visits: Every 2 weeks until 28 weeks, then weekly until delivery.',
      'Repeat Uterine Artery Doppler at 20–24 weeks anomaly scan.',
      'High-risk first-trimester screening. Prescribed Aspirin 150mg bedtime + Calcium 1.5g daily.',
      'Dr. K. Sarayu Rao', ?, ?, ?, ?, ?
    )
  `).run(sunitaId, docId, docId, docId, now, now);

  // --- 6E: MULTIPLE GESTATION SURVEILLANCE SEED ---
  // Twin pregnancy profile for Anita Sharma (or demo patient)
  const twinPregRes = db.prepare(`
    INSERT OR IGNORE INTO multiple_gestation_pregnancies (
      patient_id, plurality, chorionicity, amnionicity, first_trimester_sign,
      dividing_membrane_thickness_mm, placental_configuration, conception_method,
      status, diagnosis_gestation_weeks, baseline_notes,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, 'twins', 'mcda', 'diamniotic', 't_sign',
      1.5, 'single_anterior', 'spontaneous',
      'active', 12, 'Monochorionic diamniotic (MCDA) twin pregnancy confirmed on 1st trimester ultrasound.',
      ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, now, now);

  const twinPregId = Number(twinPregRes.lastInsertRowid) || 1;

  db.prepare(`
    INSERT OR IGNORE INTO multiple_gestation_assessments (
      pregnancy_id, patient_id, assessment_date, assessment_time,
      gestational_age_weeks, gestational_age_days, fetuses_json,
      efw_discordance_percent, ac_discordance_percent, dvp_discordance_cm,
      discordance_severity, larger_fetus_label, smaller_fetus_label,
      ttts_stage, sfgr_type, taps_stage, cord_entanglement_noted,
      surveillance_interval_recommendation, delivery_timing_recommendation,
      delivery_mode_recommendation, corticosteroids_indicated, action_plan,
      clinical_notes, performed_by, reviewed_by, created_by, updated_by,
      created_at, updated_at
    ) VALUES (
      ?, ?, '2026-11-05', '11:15',
      24, 0, ?,
      7.4, 3.0, 0.4,
      'concordant', 'Twin A', 'Twin B',
      'none', 'none', 'none', 0,
      'Fortnightly (every 2 weeks) ultrasound surveillance starting from 16 weeks to screen for TTTS and sFGR.',
      'Uncomplicated MCDA twins: Planned delivery at 36+0 to 36+6 weeks gestation.',
      'Trial of vaginal delivery is safe and appropriate, provided Twin A presents cephalic.',
      0, 'Surveillance: Fortnightly USG | Timing: 36w | Mode: Trial of vaginal delivery',
      'Concordant growth. Both bladders well filled. Reassuring forward end-diastolic flow in both umbilical arteries.',
      'Dr. K. Sarayu Rao', ?, ?, ?, ?, ?
    )
  `).run(
    twinPregId,
    anitaId,
    JSON.stringify([
      {
        label: 'Twin A',
        presentation: 'cephalic',
        bpdMm: 60, hcMm: 222, acMm: 200, flMm: 44,
        efwG: 680, efwPercentile: 50,
        dvpCm: 4.6, bladderVisualized: true,
        uaPi: 1.15, uaFlow: 'normal_positive',
        mcaPi: 1.70, mcaPsvCmS: 28.0, mcaPsvMom: 1.02,
        dvAWave: 'positive', hydropsPresent: false, demised: false,
      },
      {
        label: 'Twin B',
        presentation: 'breech',
        bpdMm: 58, hcMm: 216, acMm: 194, flMm: 42,
        efwG: 630, efwPercentile: 40,
        dvpCm: 4.2, bladderVisualized: true,
        uaPi: 1.18, uaFlow: 'normal_positive',
        mcaPi: 1.72, mcaPsvCmS: 29.0, mcaPsvMom: 1.05,
        dvAWave: 'positive', hydropsPresent: false, demised: false,
      },
    ]),
    docId, docId, docId, now, now
  );

  // ============================================================================
  // Series 7 Seeds: Labor Induction, Perinatal Loss & ART Cycles
  // ============================================================================

  console.log('Seeding Series 7: Labor Induction, Perinatal Loss Registry & ART Cycles...');

  // 7A: Labor Induction Episode (Anita Sharma - Post-dates labor induction)
  db.prepare(`
    INSERT INTO labor_induction_episodes (
      patient_id, initiation_date, initiation_time, gestational_age_weeks, gestational_age_days,
      indication, indication_details, parity, previous_cesarean, previous_cesarean_count,
      dilation_cm, effacement_percent, fetal_station, consistency, position,
      bishop_score_total, cervical_favorability, ripening_method, ripening_dose_details,
      contraindications_checked, oxytocin_used, oxytocin_start_time, oxytocin_start_rate_m_u_min,
      oxytocin_max_rate_m_u_min, arm_performed, arm_time, liquor_status,
      tachysystole_detected, induction_outcome, induction_to_delivery_hours, clinical_notes,
      performed_by, reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-02-12', '07:30', 41, 1,
      'post_dates', '41+1 weeks prolonged pregnancy, AFI 6.2 cm, reassuring CTG Category 1', 'nulliparous', 0, 0,
      1.5, 30, -2, 'firm', 'posterior',
      2, 'unfavorable_le_5', 'dinoprostone_pge2_tape', 'Dinoprostone 10 mg controlled release tape (Propess) in posterior fornix for 24h',
      1, 1, '18:00', 2.0,
      12.0, 1, '19:30', 'clear',
      0, 'vaginal_delivery', 14.5, 'Spontaneous vaginal delivery of healthy male infant, APGAR 8/9, birth weight 3380g. Minimal blood loss.',
      'Dr. Demo Sharma', ?, ?, ?, ?, ?
    )
  `).run(anitaId, docId, docId, docId, now, now);

  // 7B: Perinatal Loss Audit Episode (Meera - Previous Stillbirth Demise Audit)
  db.prepare(`
    INSERT INTO perinatal_loss_episodes (
      patient_id, loss_type, diagnosis_date, delivery_date, delivery_time,
      gestational_age_weeks, gestational_age_days, parity_prior,
      mode_of_delivery, fetal_presentation, fetal_birth_weight_g, fetal_weight_centile,
      fetal_appearance, apparent_dysmorphic_features, primary_cause_category,
      primary_cause_details, contributing_factors, diagnostic_workup_json,
      maternal_blood_group, anti_d_administered, anti_d_dose_mcg,
      lactation_suppression_given, lactation_suppression_details,
      memory_box_offered, memory_box_accepted, bereavement_counselor_contacted,
      recurrence_risk_category, future_pregnancy_plan, counseling_notes,
      consultant_name, reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, 'stillbirth_antepartum', '2025-11-10', '2025-11-11', '02:40',
      31, 4, 'G2P0A1',
      'induced_vaginal', 'cephalic', 1420, 12.5,
      'fresh_stillbirth', 'No gross congenital anomalies or facial dysmorphisms noted',
      'placental_abruption', 'Acute placental abruption with 30% parenchymal infarction and 220 mL retroplacental clot',
      'Maternal chronic hypertension with superimposed preeclampsia',
      '{"hba1c": 5.4, "tsh": 1.9, "torch": "Negative IgM", "thrombophilia": "Negative", "cma": "Normal euploid female 46,XX"}',
      'O_negative', 1, 300,
      1, 'Cabergoline 1 mg PO stat single dose within 24 hours of delivery',
      1, 1, 1,
      'moderate_2_to_5_pct',
      'Pre-conceptional joint MFM review. Low-dose Aspirin 150 mg nightly from 11w to 36w. Calcium 2 g/day. Serial growth scans and uterine artery Doppler from 24w fortnightly.',
      'Conducted formal 6-week postnatal bereavement debrief with parents. Memory box provided.',
      'Dr. Demo Sharma', ?, ?, ?, ?, ?
    )
  `).run(meeraId, docId, docId, docId, now, now);

  // 7C: ART / IVF-ICSI Cycle (Pooja Sharma - ICSI Fresh Cycle with SET)
  db.prepare(`
    INSERT INTO art_cycles (
      patient_id, cycle_number, start_date, cycle_type, protocol_type,
      indication, indication_notes, gonadotropin_type, total_gonadotropin_dose_iu,
      stimulation_days, peak_estradiol_pg_ml, trigger_progesterone_ng_ml,
      trigger_type, trigger_datetime, opu_datetime, total_oocytes_retrieved,
      mature_mii_oocytes, insemination_method, fertilized_2pn_count,
      fertilization_rate_percent, day3_embryos_count, day5_blastocysts_count,
      embryos_transferred_count, transfer_stage, transfer_datetime,
      transferred_embryos_details, endometrial_thickness_at_transfer_mm,
      transfer_difficulty, embryos_frozen_count, frozen_storage_straws,
      luteal_support_regimen, beta_hcg_day14_miu_ml, beta_hcg_day16_miu_ml,
      hcg_doubling_time_hours, clinical_pregnancy_status, gestational_sacs_count,
      fetal_heart_present, cycle_notes, lead_embryologist,
      reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, 1, '2026-01-10', 'icsi_fresh', 'gnrh_antagonist',
      'tubal_factor', 'Bilateral tubal block, partner semen analysis within normal WHO parameters',
      'Recombinant FSH 225 IU + HMG 75 IU', 2250,
      10, 2750.0, 0.85,
      'rhcg_250mcg', '2026-01-20T22:00:00', '2026-01-22T10:00:00', 13,
      11, 'icsi', 9,
      81.8, 8, 4,
      1, 'day_5_blastocyst', '2026-01-27T11:30:00',
      '4AA', 10.1,
      'easy', 3, 'Tank 1, Canister B, Straw #881 (4BA), Straw #882 (4BB, 3BB)',
      'Micronized progesterone 400 mg BD vaginally + Estradiol valerate 2 mg BD',
      440.0, 960.0,
      42.7, 'clinical_intrauterine_sac', 1,
      1, 'TVS at 6w3d demonstrates single live intrauterine gestational sac with yolk sac and fetal pole, CRL 6.8 mm, FH 138 bpm (+).',
      'Senior Clinical Embryologist',
      ?, ?, ?, ?, ?
    )
  `).run(poojaId, docId, docId, docId, now, now);

  // ============================================================================
  // Series 8 Seeds: Endometriosis Staging, POP-Q Urogynecology & Gyn Oncology
  // ============================================================================

  console.log('Seeding Series 8: Endometriosis #Enzian, Urogynecology POP-Q & Gyn Oncology...');

  // 8A: Endometriosis Staging Episode (Pooja Sharma - DIE with rASRM Stage III & #Enzian)
  db.prepare(`
    INSERT INTO endometriosis_episodes (
      patient_id, assessment_date, assessment_type,
      vas_dysmenorrhea, vas_dyspareunia, vas_dyschezia, vas_dysuria, vas_chronic_pelvic_pain,
      rasrm_peritoneal_superficial_pts, rasrm_peritoneal_deep_pts,
      rasrm_ovary_right_superficial_pts, rasrm_ovary_right_deep_pts,
      rasrm_ovary_left_superficial_pts, rasrm_ovary_left_deep_pts,
      rasrm_adhesions_ovary_right_pts, rasrm_adhesions_ovary_left_pts,
      rasrm_adhesions_tube_right_pts, rasrm_adhesions_tube_left_pts,
      rasrm_pouch_of_douglas_obliteration, rasrm_total_score, rasrm_stage,
      enzian_peritoneum, enzian_ovary_left, enzian_ovary_right,
      enzian_tube_left, enzian_tube_right,
      enzian_compartment_a, enzian_compartment_b, enzian_compartment_c,
      enzian_extragenital_f, enzian_adenomyosis_fa, enzian_composite_code,
      medical_management_regimen, surgical_procedure_performed, fertility_sparing,
      post_op_hormonal_suppression, clinical_notes, lead_surgeon,
      reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-02-15', 'laparoscopic_surgical',
      7, 6, 3, 1, 4,
      2, 4,
      0, 0,
      2, 16,
      0, 4,
      0, 4,
      'partial_4pts', 36, 'stage_3_moderate',
      'P1', 'O2', null,
      'T1', null,
      'A1', 'B2', 'C1',
      'FA', 1, 'P1, O0/2, T0/1, A1, B2, C1, FA',
      'Dienogest 2 mg daily orally with calcium and Vitamin D3 supplementation',
      'Laparoscopic excision of DIE nodules in RV septum and left uterosacral ligament, left ovarian cystectomy, and left ureterolysis',
      1, 'GnRH agonist 3.75 mg monthly depot x 3 months followed by Dienogest',
      'Complete macroscopic clearance achieved without bowel resection. Left ureter preserved with clear margins.',
      'Dr. Demo Sharma',
      ?, ?, ?, ?, ?
    )
  `).run(poojaId, docId, docId, docId, now, now);

  // 8B: Urogynecology & POP-Q Episode (Sunita Rao - Postmenopausal Pelvic Prolapse)
  db.prepare(`
    INSERT INTO urogynecology_episodes (
      patient_id, assessment_date, parity, menopausal_status,
      popq_aa_cm, popq_ba_cm, popq_c_cm, popq_gh_cm, popq_pb_cm, popq_tvl_cm,
      popq_ap_cm, popq_bp_cm, popq_d_cm,
      popq_stage, leading_compartment, leading_edge_distance_cm,
      urinary_incontinence_type, pad_count_per_day,
      bladder_diary_day_frequency, bladder_diary_nocturia, leak_episodes_24h,
      bother_score_iciq_sf, pessary_management, pessary_size_mm,
      pessary_change_interval_weeks, pelvic_floor_physiotherapy,
      surgical_procedure_planned, clinical_notes, performed_by,
      reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-03-02', 'P3+0', 'postmenopausal',
      1.0, 3.0, -1.0, 4.5, 2.5, 9.0,
      -2.0, -1.0, -5.0,
      'stage_3', 'anterior_cystocele', 3.0,
      'mixed_mui', 2,
      8, 3, 3,
      14, 'fitted_ring', 70,
      12, 1,
      'Anterior Colporrhaphy + Midurethral Transobturator Tape (TOT)',
      'Stage III anterior prolapse (cystocele) with mixed urinary incontinence. Size 70mm ring pessary successfully fitted.',
      'Dr. Demo Sharma',
      ?, ?, ?, ?, ?
    )
  `).run(sunitaId, docId, docId, docId, now, now);

  // 8C: Gynecological Oncology Episode (Sunita Rao - Adnexal Mass with RMI & IOTA)
  db.prepare(`
    INSERT INTO gyn_oncology_episodes (
      patient_id, assessment_date, clinical_indication, menopausal_status,
      ca125_level_u_ml, he4_pmol_l, roma_score_percent,
      lesion_max_diameter_mm, proportion_solid_tissue_percent, papillary_projections_count,
      acoustic_shadows_present, ascites_present, bilateral_lesions, multilocular_cysts,
      color_doppler_score, iota_simple_rules_category, iota_predicted_malignancy_risk_pct,
      rmi_score, rmi_risk_tier, endometrial_thickness_mm, endometrial_biopsy_done,
      endometrial_histology, cervical_lesion_visible, figo_clinical_stage,
      multidisciplinary_tumor_board_status, management_plan, surgical_staging_details,
      clinical_notes, gyn_oncologist_name,
      reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-04-18', 'adnexal_mass', 'postmenopausal',
      185.0, 95.0, 42.5,
      68.0, 35.0, 2,
      0, 1, 1, 1,
      3, 'malignant', 85.0,
      1665.0, 'high_risk_gt_200', 6.5, 1,
      'Atrophic endometrium, negative for hyperplasia or malignancy', 0, 'Suspected FIGO Stage IC2',
      'discussed_approved',
      'Urgent multidisciplinary tumor board review. Approved for primary staging laparotomy and cytoreduction.',
      'Total abdominal hysterectomy, bilateral salpingo-oophorectomy, infragastric omentectomy, peritoneal biopsies, and pelvic lymph node sampling.',
      'Ascites identified with bilateral multilocular-solid adnexal masses. High-risk RMI (>200) mandates gynecologic oncology clearance.',
      'Consultant Gynecological Oncologist',
      ?, ?, ?, ?, ?
    )
  `).run(sunitaId, docId, docId, docId, now, now);

  // Book today's outpatient appointments for the active queue
  const todayStr = new Date().toISOString().slice(0, 10);
  const appts = [
    { pid: anitaId, time: '09:30:00', reason: 'Antenatal Checkup (32w Growth & Doppler)', status: 'completed' },
    { pid: poojaId, time: '10:15:00', reason: 'Folliculometry TVS & Trigger Decision', status: 'in_consultation' },
    { pid: sunitaId, time: '11:00:00', reason: 'Post-Cesarean ERAS Wound Check', status: 'waiting' },
    { pid: aaravId, time: '11:45:00', reason: '1-Year Well-Baby Checkup & Growth Assessment', status: 'waiting' },
  ];

  for (const ap of appts) {
    const scheduledAt = `${todayStr}T${ap.time}`;
    db.prepare(`
      INSERT OR IGNORE INTO appointments (
        patient_id, scheduled_at, scheduled_date, reason, status, version, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(ap.pid, scheduledAt, todayStr, ap.reason, ap.status, deskId, now, now);
  }

  console.log('✅ Demo database seeded successfully with rich clinical profiles!');
  console.log('----------------------------------------------------');
  console.log(`Doctor login: username 'drdemo' / password 'Doctor@12345'`);
  console.log(`Nurse login:  username 'nurse1' / password 'Nurse@12345'`);
  console.log(`Desk login:   username 'desk1'  / password 'Desk@12345'`);
  console.log('----------------------------------------------------');
}

seed().then(() => {
  db.close();
  process.exit(0);
}).catch((err) => {
  console.error('Seeding error:', err);
  db.close();
  process.exit(1);
});
