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

  // --- SERIES 9A: SNCU (Level-2 NICU) Neonatal Inpatient Tracker ---
  db.prepare(`
    INSERT OR IGNORE INTO sncu_admissions (
      patient_id, admission_datetime, birth_weight_g, gestational_age_weeks, gestational_age_days,
      admission_indication, respiratory_support, fio2_percent, peep_cm_h2o, flow_rate_l_min,
      silverman_anderson_score, downes_score, phototherapy_status, kmc_duration_hours_today,
      temperature_celsius, current_weight_g, total_fluid_goal_ml_kg_day, feeding_mode,
      feeding_volume_ml, feeding_frequency_hours, iv_fluid_type_rate, daily_weight_gain_g_kg_day,
      heart_rate_bpm, respiratory_rate_bpm, spo2_percent, capillary_blood_glucose_mg_dl,
      antibiotic_regimen, clinical_notes, status, attending_pediatrician,
      reviewed_by, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, '2026-11-04T12:00:00', 1850, 33, 4,
      'respiratory_distress', 'bubble_cpap', 30.0, 5.0, 5.0,
      4, 4, 'single_surface_led', 3.0,
      36.8, 1810, 110.0, 'og_tube_ebm',
      15.0, 2, '10% Dextrose with electrolytes 4.0 mL/hr', -20.0,
      142, 64, 94.0, 68.0,
      'Inj Ampicillin 50mg/kg q12h + Inj Gentamicin 4mg/kg q24h (Day 3)',
      'Preterm 33+4 weeks infant with moderate RDS stabilized on Bubble CPAP. Good chest expansion, no grunting on CPAP. Single surface LED phototherapy ongoing.',
      'admitted', 'Dr. Lingeshwar / Consultant Neonatologist',
      ?, ?, ?, ?, ?
    )
  `).run(babyId, docId, docId, docId, now, now);

  // --- SERIES 9B: Pediatric Vaccinations & Automated Recall Engine ---
  const initialVaccines = [
    { key: 'bcg', name: 'BCG', group: 'birth', status: 'given', date: '2025-11-02' },
    { key: 'opv_0', name: 'OPV 0', group: 'birth', status: 'given', date: '2025-11-02' },
    { key: 'hepb_0', name: 'Hepatitis B (0)', group: 'birth', status: 'given', date: '2025-11-02' },
    { key: 'penta_1', name: 'Pentavalent 1', group: '6_weeks', status: 'given', date: '2025-12-14' },
    { key: 'ipv_1', name: 'IPV 1', group: '6_weeks', status: 'given', date: '2025-12-14' },
    { key: 'rota_1', name: 'Rotavirus 1', group: '6_weeks', status: 'given', date: '2025-12-14' },
    { key: 'pcv_1', name: 'PCV 1', group: '6_weeks', status: 'given', date: '2025-12-14' },
    { key: 'penta_2', name: 'Pentavalent 2', group: '10_weeks', status: 'given', date: '2026-01-15' },
    { key: 'rota_2', name: 'Rotavirus 2', group: '10_weeks', status: 'given', date: '2026-01-15' },
    { key: 'pcv_2', name: 'PCV 2', group: '10_weeks', status: 'given', date: '2026-01-15' },
    { key: 'penta_3', name: 'Pentavalent 3', group: '14_weeks', status: 'given', date: '2026-02-18' },
    { key: 'ipv_2', name: 'IPV 2', group: '14_weeks', status: 'given', date: '2026-02-18' },
    { key: 'rota_3', name: 'Rotavirus 3', group: '14_weeks', status: 'given', date: '2026-02-18' },
    { key: 'mr_1', name: 'MR 1 / MMR 1', group: '9_12_months', status: 'pending', date: null },
    { key: 'pcv_booster', name: 'PCV Booster', group: '9_12_months', status: 'pending', date: null },
  ];

  for (const v of initialVaccines) {
    db.prepare(`
      INSERT OR IGNORE INTO patient_vaccinations (
        patient_id, vaccine_key, vaccine_name, milestone_group, target_disease, status, given_date, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, 'Pediatric Infectious Prevention', ?, ?, ?, ?)
    `).run(aaravId, v.key, v.name, v.group, v.status, v.date, docId, now);
  }

  // --- SERIES 9B: Communication Dispatch Logs & WhatsApp Reminders ---
  db.prepare(`
    INSERT OR IGNORE INTO communication_dispatch_logs (
      patient_id, communication_type, trigger_event, recipient_phone,
      language, message_body, deep_link_url, sent_by, created_at
    ) VALUES (
      ?, 'whatsapp_click_to_chat', 'immunization_due', '9845011005',
      'english', 'Hello Parent of Master Aarav Patel, this is a priority health reminder from LiVi Clinic. Master Aarav is due for MR 1 and PCV Booster vaccines. Please visit or call +91 98765 43210.',
      'https://wa.me/919845011005?text=Hello%20Parent%20of%20Master%20Aarav',
      ?, ?
    )
  `).run(aaravId, docId, now);

  // --- SERIES 10: Live Ward Board SBAR Handovers, Teleconsultations & ABDM FHIR ---
  const todayStr = new Date().toISOString().slice(0, 10);

  // 10A: SBAR Handover Note
  const activeAdm = db.prepare("SELECT id FROM admissions WHERE status = 'admitted' LIMIT 1").get() as { id: number } | undefined;
  if (activeAdm) {
    db.prepare(`
      INSERT OR IGNORE INTO ward_handover_notes (
        admission_id, shift_type, shift_date, nurse_id, nurse_name,
        situation, background, assessment, recommendation,
        pending_tasks, iv_fluids_status, dietary_order, created_at, updated_at
      ) VALUES (
        ?, 'morning', ?, ?, 'Nurse Priya',
        'Patient on Postnatal Ward Day 1. Vitals stable, uterine retraction good.',
        'G2P1 post uncomplicated LSCS for fetal distress at 39 weeks.',
        'BP 124/82 mmHg, HR 78 bpm, SpO2 99%, lochia rubra mild, pain score 2/10.',
        'Continue post-op analgesia, encourage early ambulation and exclusive breastfeeding.',
        '["Repeat Hb at 16:00","Check Foley output","Encourage KMC"]',
        'RL 500 mL @ 80 mL/h', 'Soft bland diet as tolerated', ?, ?
      )
    `).run(activeAdm.id, todayStr, nurseId, now, now);
  }

  // 10B: Teleconsultation with Cryptographic Digital Signature
  const mockSignatureHash = 'E4F90B22C79A171D6293A7F2494E5106941BF3A5432D6DE0D9A3B5D3941F7C51';
  db.prepare(`
    INSERT OR IGNORE INTO teleconsultations (
      patient_id, doctor_id, scheduled_at, status, consult_type,
      video_platform, meeting_link, meeting_room_id, chief_complaint,
      clinical_notes, provisional_diagnosis, advice_instructions,
      prescription_medicines, telemedicine_consent_obtained, emergency_disclaimer_acknowledged,
      digital_signature_hash, signed_by_doctor_name, doctor_reg_number, doctor_qualifications,
      signed_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, 'COMPLETED', 'REPORT_REVIEW',
      'WHATSAPP_VIDEO', 'https://wa.me/919845011003', 'livi-tele-sunita-9921',
      'Review of 6-week post-op thyroid profile and calcium supplementation.',
      'Patient reports good recovery, wound healed cleanly, lactation established.',
      'Post-op LSCS recovery, Euthyroid state maintained',
      'Continue Tab Calcium 500mg OD for 3 months during breastfeeding. Walk 30 min daily.',
      '[{"name":"Tab Calcium Carbonate & Vit D3","dosage":"500mg + 250IU","frequency":"Once daily after lunch","duration":"60 days","instructions":"With water"}]',
      1, 1,
      ?, 'Dr. K. Sarayu Rao', 'NMC-MCI-2012-77412', 'MBBS, MS (OBGYN), Fellowship in Fetal Medicine',
      ?, ?, ?
    )
  `).run(sunitaId, docId, `${todayStr}T14:30:00`, mockSignatureHash, now, now, now);

  // 10C: ABDM Patient Profile & FHIR R4 Bundle
  db.prepare(`
    INSERT OR IGNORE INTO abdm_patient_profiles (
      patient_id, abha_number, abha_address, status, auth_method,
      kyc_full_name, kyc_gender, kyc_dob, kyc_mobile, kyc_address,
      linked_at, updated_at
    ) VALUES (
      ?, '91-5832-1940-2019', 'anita.sharma@abdm', 'VERIFIED', 'AADHAAR_OTP',
      'Anita Sharma', 'Female', '1994-08-14', '9845011001', 'Koramangala, Bengaluru',
      ?, ?
    )
  `).run(anitaId, now, now);

  db.prepare(`
    INSERT OR IGNORE INTO abdm_consent_artifacts (
      patient_id, consent_id, purpose_code, status, hi_types,
      requester_name, requester_hip_id, date_range_from, date_range_to, expiry_at, created_at
    ) VALUES (
      ?, 'consent-art-demo-9901', 'CARETREE', 'GRANTED',
      'OPConsultation,DischargeSummary,ImmunizationRecord',
      'Manipal Hospital Whitefield', 'HIP-MANIPAL-002',
      ?, '2027-11-07', '2027-11-07', ?
    )
  `).run(anitaId, todayStr, now);

  // --- SERIES 11A: Operating Theater Scheduler, PAC Clearance & WHO Safety Checklist ---
  const otSchedRes = db.prepare(`
    INSERT OR IGNORE INTO ot_schedules (
      patient_id, admission_id, ot_room, scheduled_date, scheduled_start_time,
      estimated_duration_minutes, procedure_name, procedure_category, priority,
      status, primary_surgeon_id, primary_surgeon_name, assistant_surgeon_name,
      anesthesiologist_id, anesthesiologist_name, scrub_nurse_name,
      pediatrician_standby_name, blood_units_reserved, special_equipment_needed,
      created_by, created_at, updated_at
    ) VALUES (
      ?, NULL, 'OT_2_MATERNITY', ?, '09:00',
      60, 'Elective Lower Segment Cesarean Section (LSCS)', 'OBSTETRIC', 'ELECTIVE',
      'SURGERY_IN_PROGRESS', ?, 'Dr. Ananya Rao, MD (OBGYN)', 'Dr. Priya Desai',
      ?, 'Dr. S. K. Murthy (Consultant Anesthesiologist)', 'Sister Prema, RN',
      'Dr. Rohini Kulkarni, MD (Pediatrics)', 1, 'Radiant Infant Warmer & Cord Blood Collection Kit',
      ?, ?, ?
    )
  `).run(anitaId, todayStr, docId, docId, docId, now, now);

  const otSchedId = Number(otSchedRes.lastInsertRowid);
  if (otSchedId > 0) {
    // PAC Clearance
    db.prepare(`
      INSERT OR IGNORE INTO pre_anesthesia_clearances (
        patient_id, ot_schedule_id, evaluation_date, anesthesiologist_id,
        anesthesiologist_name, asa_grade, mallampati_class, mouth_opening_cm,
        thyromental_distance_cm, dentition_status, neck_mobility,
        npo_solid_hours, npo_clear_liquid_hours, cardiovascular_assessment,
        respiratory_assessment, airway_notes, planned_anesthesia_technique,
        pac_clearance_status, high_risk_warnings, preop_orders_instructions,
        blood_products_crossmatched, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        'Dr. S. K. Murthy', 'ASA_II', 'CLASS_I', 4.5,
        6.8, 'intact', 'normal_full',
        8, 3, 'S1, S2 audible, no murmur. BP 122/78 mmHg. Normal sinus rhythm.',
        'B/L air entry equal, clear chest. SpO2 99% on room air.',
        'Anticipate normal direct laryngoscopy and easy mask ventilation.', 'SPINAL',
        'FIT_FOR_SURGERY', 'Gestational diabetes on dietary control. Monitor perioperative capillary blood glucose.',
        'NPO from 01:00 AM. 18G IV cannula on left hand. Standby 1 Unit PRBC.',
        '1 Unit PRBC Crossmatched & Reserved', ?, ?
      )
    `).run(anitaId, otSchedId, todayStr, docId, now, now);

    // WHO Surgical Safety Checklist (Sign In & Time Out completed)
    db.prepare(`
      INSERT OR IGNORE INTO who_surgical_safety_checklists (
        ot_schedule_id, patient_id,
        signin_completed, signin_patient_confirmed, signin_site_marked,
        signin_anesthesia_safety_check, signin_pulse_oximeter_functioning,
        signin_known_allergy, signin_difficult_airway_risk, signin_blood_loss_risk,
        signin_nurse_anesthetist_name, signin_timestamp,
        timeout_completed, timeout_team_introduced, timeout_verbal_confirmation,
        timeout_surgeon_review, timeout_anesthetist_review, timeout_nursing_sterility_confirmed,
        timeout_antibiotic_prophylaxis_given, timeout_antibiotic_name_dose,
        timeout_imaging_displayed, timeout_completed_by_name, timeout_timestamp,
        signout_completed, signout_procedure_recorded_name, signout_counts_correct,
        signout_specimen_labeled, signout_equipment_problems, signout_recovery_concerns,
        signout_completed_by_name, signout_timestamp, updated_at
      ) VALUES (
        ?, ?,
        1, 1, 1,
        1, 1,
        0, 0, 1,
        'Sister Prema / Dr. Murthy', ?,
        1, 1, 1,
        'Anticipated LSCS with transverse lower segment incision, expected blood loss <500mL',
        'Spinal block L3-L4 0.5% Bupivacaine heavy 2.0mL + Fentanyl 15mcg given. Stable hemodynamics.', 1,
        1, 'Inj. Cefazolin 1g IV stat given at 08:35 AM',
        1, 'Dr. Ananya Rao', ?,
        0, 'Lower Segment Cesarean Section', 1,
        1, 'None', 'Monitor uterine retraction, oxytocin infusion 20 IU in 500mL RL',
        'Sister Prema', NULL, ?
      )
    `).run(otSchedId, anitaId, now, now, now);
  }

  // --- SERIES 11B: Blood Bank Requisition & Massive Transfusion Protocol (MTP) ---
  const bloodReqRes = db.prepare(`
    INSERT OR IGNORE INTO blood_requisitions (
      patient_id, admission_id, ot_schedule_id, requisition_number,
      blood_group_abo, urgency, clinical_indication,
      prbc_units, ffp_units, platelet_units, cryoprecipitate_units, whole_blood_units,
      special_requirements, status, requesting_doctor_id, requesting_doctor_name,
      notes, created_at, updated_at
    ) VALUES (
      ?, NULL, ?, 'REQ-2026-0001',
      'B_POS', 'URGENT_WITHIN_2HR', 'Elective LSCS High-Risk Standby (Prior uterine scar)',
      2, 2, 0, 0, 0,
      'Leukodepleted', 'CROSSMATCHED', ?, 'Dr. Ananya Rao, MD (OBGYN)',
      'Crossmatch complete. Two units PRBC reserved in OT blood bank refrigerator.', ?, ?
    )
  `).run(anitaId, otSchedId || null, docId, now, now);

  const existingReq = db.prepare('SELECT id FROM blood_requisitions WHERE requisition_number = ?').get('REQ-2026-0001') as { id: number } | undefined;
  const reqId = existingReq ? existingReq.id : Number(bloodReqRes.lastInsertRowid);

  // MTP Activation demo for acute atonic PPH
  const mtpRes = db.prepare(`
    INSERT OR IGNORE INTO massive_transfusion_activations (
      patient_id, admission_id, ot_schedule_id, mtp_code,
      activation_time, activated_by_id, activated_by_name,
      trigger_reason, baseline_shock_index, baseline_estimated_blood_loss_ml,
      current_pack_round, total_prbc_transfused, total_ffp_transfused,
      total_platelets_transfused, total_cryo_transfused, txa_given,
      calcium_gluconate_given, deactivation_time, deactivated_by_name, outcome_summary,
      status, created_at, updated_at
    ) VALUES (
      ?, NULL, ?, 'MTP-2026-0001',
      ?, ?, 'Dr. Ananya Rao',
      'PPH_ATONY', 1.35, 1800,
      2, 6, 6, 1, 10, 1, 1, ?, 'Dr. Ananya Rao',
      'Intractable atonic PPH managed with B-Lynch compression suture, intrauterine balloon tamponade, and balanced 1:1:1 component hemotherapy. Transferred to ICU stable.',
      'DEACTIVATED', ?, ?
    )
  `).run(sunitaId, otSchedId || null, `${todayStr}T04:15:00`, docId, `${todayStr}T06:30:00`, now, now);

  const existingMtp = db.prepare('SELECT id FROM massive_transfusion_activations WHERE mtp_code = ?').get('MTP-2026-0001') as { id: number } | undefined;
  const mtpDemoId = existingMtp ? existingMtp.id : Number(mtpRes.lastInsertRowid);
  if (mtpDemoId > 0) {
    // Round 1
    db.prepare(`
      INSERT OR IGNORE INTO mtp_flowsheet_rounds (
        mtp_id, round_number, round_start_time,
        prbc_issued, prbc_transfused, ffp_issued, ffp_transfused,
        platelets_issued, platelets_transfused, cryo_issued, cryo_transfused,
        temp_celsius, heart_rate, blood_pressure_sys, blood_pressure_dia, spo2,
        hb_g_dl, platelets_k_ul, inr, fibrinogen_mg_dl, ionized_calcium_mmol_l,
        ph_abg, lactate_mmol_l, clinical_notes, recorded_by_name, created_at
      ) VALUES (
        ?, 1, '04:20',
        4, 4, 4, 4, 0, 0, 0, 0,
        35.8, 128, 86, 52, 95,
        6.4, 82, 1.6, 140, 0.98,
        7.22, 4.8, 'MTP initiated. Pack 1 transfused with rapid infuser. TXA 1g IV bolus administered.', 'Sister Rekha RN', ?
      )
    `).run(mtpDemoId, now);

    // Round 2
    db.prepare(`
      INSERT OR IGNORE INTO mtp_flowsheet_rounds (
        mtp_id, round_number, round_start_time,
        prbc_issued, prbc_transfused, ffp_issued, ffp_transfused,
        platelets_issued, platelets_transfused, cryo_issued, cryo_transfused,
        temp_celsius, heart_rate, blood_pressure_sys, blood_pressure_dia, spo2,
        hb_g_dl, platelets_k_ul, inr, fibrinogen_mg_dl, ionized_calcium_mmol_l,
        ph_abg, lactate_mmol_l, clinical_notes, recorded_by_name, created_at
      ) VALUES (
        ?, 2, '05:05',
        2, 2, 2, 2, 1, 1, 10, 10,
        36.5, 96, 108, 68, 99,
        8.8, 95, 1.25, 230, 1.15,
        7.36, 2.1, 'Pack 2 completed with 10 units Cryoprecipitate and 10% Calcium Gluconate 10mL. Uterine hemostasis secured.', 'Sister Rekha RN', ?
      )
    `).run(mtpDemoId, now);
  }

  // Transfusion administration
  db.prepare(`
    INSERT OR IGNORE INTO blood_transfusion_administrations (
      requisition_id, patient_id, mtp_id, unit_number,
      component_type, unit_blood_group, start_time, end_time,
      two_nurse_verifier_1, two_nurse_verifier_2,
      pre_vitals_temp, pre_vitals_hr, pre_vitals_bp,
      vitals_15m_temp, vitals_15m_hr, vitals_15m_bp,
      post_vitals_temp, post_vitals_hr, post_vitals_bp,
      adverse_reaction_observed, reaction_type, reaction_details, action_taken,
      transfusion_status, created_at, updated_at
    ) VALUES (
      ?, ?, NULL, 'PRBC-2026-8802',
      'PRBC', 'B_POS', '09:15', '11:00',
      'Sister Prema RN', 'Sister Mary RN',
      36.6, 80, '120/78',
      36.8, 82, '118/76',
      36.7, 78, '122/80',
      0, NULL, NULL, NULL,
      'COMPLETED', ?, ?
    )
  `).run(reqId || null, anitaId, now, now);

  // --- SERIES 11C: Pediatric Renal Surveillance, Peritoneal Dialysis & KDIGO AKI ---
  const renalAssessRes = db.prepare(`
    INSERT OR IGNORE INTO pediatric_renal_assessments (
      patient_id, assessment_datetime, patient_category, height_cm, dry_weight_kg, current_weight_kg,
      baseline_creatinine_mg_dl, current_creatinine_mg_dl, urine_output_ml, urine_output_hours,
      serum_sodium_meq_l, urine_sodium_meq_l, serum_bun_mg_dl, urine_urea_mg_dl, urine_creatinine_mg_dl,
      calculated_egfr, calculated_uop_ml_kg_h, calculated_fluid_overload_pct, calculated_fena_pct,
      calculated_feurea_pct, kdigo_scr_stage, kdigo_uop_stage, kdigo_overall_stage, prerenal_vs_atn,
      nephrotoxic_medications, clinical_action_plan, assessed_by_id, created_at
    ) VALUES (
      ?, '2026-11-06T08:00:00', 'term_infant', 49.0, 3.10, 3.65,
      0.45, 1.65, 10.0, 12.0,
      136.0, 42.0, 38.0, 320.0, 35.0,
      13.4, 0.23, 17.7, 3.09,
      40.0, 3, 3, 3, 'intrinsic_atn',
      '["Amikacin","Vancomycin"]',
      'Severe oliguric KDIGO Stage 3 AKI with 17.7% Fluid Overload. Hold aminoglycosides immediately. Initiate urgent bedside Peritoneal Dialysis.',
      ?, ?
    )
  `).run(babyId, docId, now);

  const pdSessRes = db.prepare(`
    INSERT OR IGNORE INTO peritoneal_dialysis_sessions (
      patient_id, session_number, start_datetime, indication, catheter_type, catheter_insertion_date,
      patient_weight_kg, solution_type, fill_volume_ml_per_kg, calculated_fill_volume_ml,
      inflow_time_minutes, dwell_time_minutes, drain_time_minutes, target_cycles_count,
      heparin_units_per_liter, potassium_meq_per_liter, antibiotic_additive, status,
      prescribed_by_id, cumulative_inflow_ml, cumulative_outflow_ml, cumulative_net_uf_ml, created_at
    ) VALUES (
      ?, 'PD-20261107-1002', '2026-11-06T10:00:00', 'kdigo_stage_3_aki', 'flexible_curved_cook', '2026-11-06',
      3.65, 'dextrose_1_5', 15.0, 55.0,
      15, 45, 20, 12,
      500, 0, 'Cefazolin 500mg/L prophylactic IP', 'active',
      ?, 165.0, 207.0, 42.0, ?
    )
  `).run(babyId, docId, now);

  const existingPd = db.prepare('SELECT id FROM peritoneal_dialysis_sessions WHERE session_number = ?').get('PD-20261107-1002') as { id: number } | undefined;
  const pdSessionId = existingPd ? existingPd.id : Number(pdSessRes.lastInsertRowid);

  // 3 completed PD cycles
  const cyclesData = [
    { num: 1, time: '2026-11-06T10:15:00', inM: 55, dwell: 45, outM: 65, net: 10, cum: 10, app: 'clear_straw' },
    { num: 2, time: '2026-11-06T11:40:00', inM: 55, dwell: 45, outM: 72, net: 17, cum: 27, app: 'clear_straw' },
    { num: 3, time: '2026-11-06T13:05:00', inM: 55, dwell: 45, outM: 70, net: 15, cum: 42, app: 'clear_straw' },
  ];

  for (const c of cyclesData) {
    db.prepare(`
      INSERT OR IGNORE INTO pd_cycle_flowsheet_logs (
        session_id, cycle_number, cycle_start_time, inflow_ml, dwell_duration_minutes,
        outflow_ml, net_uf_ml, cumulative_uf_ml, effluent_appearance, abdominal_girth_cm,
        catheter_site_leakage, patient_tolerance, nurse_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 29.0, 0, 'well_tolerated', ?, 'Good drainage without distress', ?)
    `).run(pdSessionId, c.num, c.time, c.inM, c.dwell, c.outM, c.net, c.cum, c.app, nurseId, now);
  }

  // Effluent surveillance lab
  db.prepare(`
    INSERT OR IGNORE INTO pd_effluent_surveillance (
      session_id, sample_datetime, wbc_count_per_mcl, neutrophils_percent,
      gram_stain, culture_growth, peritonitis_confirmed, empiric_antibiotic_initiated, logged_by_id, created_at
    ) VALUES (
      ?, '2026-11-06T11:45:00', 18, 22.5,
      'No organisms seen on Gram stain', 'No bacterial growth at 48 hours', 0,
      'Cefazolin IP continuation', ?, ?
    )
  `).run(pdSessionId, docId, now);

  console.log('Seeding Series 12: Antimicrobial Stewardship (AMS), Obstetric HDU MgSO4, and Pediatric PALS/PEWS...');

  // 1. Series 12A: Antimicrobial Stewardship (AMS) Prescriptions & Isolates
  const amsPrescRes = db.prepare(`
    INSERT OR IGNORE INTO ams_prescriptions (
      patient_id, admission_id, prescribed_by_id, prescribed_datetime, drug_name, aware_tier,
      route, dosage, frequency, indication, suspected_focus, baseline_wbc, baseline_crp_mg_l,
      baseline_procalcitonin_ng_ml, cultures_sent, culture_specimen_types, planned_duration_days, status, created_at
    ) VALUES (
      ?, NULL, ?, '2026-11-05T09:00:00', 'Ampicillin', 'access',
      'iv', '100 mg/kg/dose', 'q8h', 'empiric_early_onset_sepsis', 'Neonatal Sepsis / Bloodstream',
      18500, 28.4, 1.85, 1, '["blood","urine"]', 7, 'de_escalated', ?
    )
  `).run(babyId, docId, now);

  const existingAmsPresc = db.prepare('SELECT id FROM ams_prescriptions WHERE patient_id = ? AND drug_name = ?').get(babyId, 'Ampicillin') as { id: number } | undefined;
  const amsPrescId = existingAmsPresc ? existingAmsPresc.id : Number(amsPrescRes.lastInsertRowid);

  // 48-72h Timeout Review logged
  db.prepare(`
    INSERT OR IGNORE INTO ams_timeout_reviews (
      ams_prescription_id, patient_id, reviewed_by_id, review_datetime, hours_since_initiation,
      timeout_action, culture_result_summary, clinical_response, justification_notes, new_antimicrobial_regimen, created_at
    ) VALUES (
      ?, ?, ?, '2026-11-07T10:00:00', 49.0,
      'de_escalate', 'pathogen_isolated_sensitivities_available', 'improving_afebrile',
      'Blood culture grew Enterococcus faecalis sensitive to Ampicillin. Discontinue empiric Gentamicin coverage.',
      'Continue Ampicillin IV monotherapy for 7 total days', ?
    )
  `).run(amsPrescId, babyId, docId, now);

  // Microbiology Culture Isolate
  db.prepare(`
    INSERT OR IGNORE INTO ams_microbiology_isolates (
      patient_id, ams_prescription_id, collection_datetime, specimen_type, pathogen_isolated,
      colony_count_cfu_ml, sensitivities_json, multidrug_resistant, reported_at, created_at
    ) VALUES (
      ?, ?, '2026-11-05T09:30:00', 'blood', 'Enterococcus faecalis',
      '>10^5 CFU/mL',
      '{"Ampicillin":"S","Gentamicin":"R","Vancomycin":"S","Linezolid":"S","Teicoplanin":"S"}',
      0, '2026-11-07T08:30:00', ?
    )
  `).run(babyId, amsPrescId, now);

  // Klebsiella isolate for Antibiogram diversity
  db.prepare(`
    INSERT OR IGNORE INTO ams_microbiology_isolates (
      patient_id, ams_prescription_id, collection_datetime, specimen_type, pathogen_isolated,
      colony_count_cfu_ml, sensitivities_json, multidrug_resistant, reported_at, created_at
    ) VALUES (
      ?, NULL, '2026-11-04T14:00:00', 'urine', 'Klebsiella pneumoniae',
      '>10^5 CFU/mL',
      '{"Ampicillin":"R","Cefotaxime":"R","Ceftriaxone":"R","Piperacillin-Tazobactam":"S","Meropenem":"S","Amikacin":"S","Colistin":"S"}',
      1, '2026-11-06T11:00:00', ?
    )
  `).run(aaravId, now);

  // 2. Series 12B: Obstetric HDU MgSO4 Resuscitation Protocol for Sunita Rao
  const mgso4Res = db.prepare(`
    INSERT OR IGNORE INTO mgso4_resuscitation_protocols (
      patient_id, protocol_code, regimen_type, indication, initiation_datetime,
      prescribed_by_id, loading_dose_given, loading_dose_details, maintenance_rate_g_per_h,
      recurrent_seizure_bolus_given, status, created_at
    ) VALUES (
      ?, 'MG-20261107-ZUSPAN-01', 'zuspan_iv', 'severe_preeclampsia_impending', '2026-11-07T06:00:00',
      ?, 1, '4g IV bolus in 100 mL NS over 20 min', 1.0,
      0, 'active', ?
    )
  `).run(sunitaId, docId, now);

  const existingMg = db.prepare('SELECT id FROM mgso4_resuscitation_protocols WHERE protocol_code = ?').get('MG-20261107-ZUSPAN-01') as { id: number } | undefined;
  const mgso4Id = existingMg ? existingMg.id : Number(mgso4Res.lastInsertRowid);

  // 4 Hourly checks logged
  const flowsheetEntries = [
    { hr: 1, time: '2026-11-07T07:00:00', dtr: 'normal_2_plus', rr: 18, uop: 45, bpS: 154, bpD: 98, hrB: 88, spo2: 99, mg: 5.2, act: 'continue_regimen' },
    { hr: 2, time: '2026-11-07T08:00:00', dtr: 'normal_2_plus', rr: 17, uop: 42, bpS: 150, bpD: 96, hrB: 84, spo2: 98, mg: 5.6, act: 'continue_regimen' },
    { hr: 3, time: '2026-11-07T09:00:00', dtr: 'normal_2_plus', rr: 16, uop: 38, bpS: 146, bpD: 92, hrB: 82, spo2: 98, mg: null, act: 'continue_regimen' },
    { hr: 4, time: '2026-11-07T10:00:00', dtr: 'normal_2_plus', rr: 18, uop: 40, bpS: 142, bpD: 90, hrB: 80, spo2: 99, mg: 5.8, act: 'continue_regimen' },
  ];

  for (const f of flowsheetEntries) {
    db.prepare(`
      INSERT OR IGNORE INTO mgso4_hourly_flowsheet_logs (
        protocol_id, observation_datetime, hour_number, patellar_reflex, respiratory_rate_bpm,
        urine_output_last_hour_ml, blood_pressure_sys, blood_pressure_dia, heart_rate_bpm,
        spo2_percent, serum_magnesium_mg_dl, toxicity_warning_triggered, action_taken,
        nurse_id, notes, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, 0, ?,
        ?, 'Reflexes normal, clear breath sounds, good urine output', ?
      )
    `).run(mgso4Id, f.time, f.hr, f.dtr, f.rr, f.uop, f.bpS, f.bpD, f.hrB, f.spo2, f.mg, f.act, nurseId, now);
  }

  // 3. Series 12C: Pediatric PALS, PEWS & Broselow Emergency for Master Aarav Patel
  db.prepare(`
    INSERT OR IGNORE INTO pews_observations (
      patient_id, observation_datetime, behavior_score, cardiovascular_score, respiratory_score,
      persistent_vomiting_postop, total_pews_score, risk_level, heart_rate_bpm, respiratory_rate_bpm,
      crt_seconds, spo2_percent, temperature_celsius, fio2_percent, escalation_triggered, assessed_by_id,
      clinical_notes, created_at
    ) VALUES (
      ?, '2026-11-07T08:30:00', 1, 1, 1,
      0, 3, 'moderate_3_4', 128, 32,
      2, 97.0, 38.2, 21.0, 1, ?,
      'Moderate respiratory distress with viral bronchiolitis. Increased vitals frequency to hourly.', ?
    )
  `).run(aaravId, nurseId, now);

  // Broselow Resuscitation Event (Purple Zone)
  db.prepare(`
    INSERT OR IGNORE INTO broselow_resuscitation_events (
      patient_id, event_code, event_datetime, event_type, measured_length_cm,
      estimated_weight_kg, broselow_color_zone, ett_cuffed_size, ett_depth_cm,
      defib_joules_initial, epinephrine_iv_dose_ml, fluid_bolus_ml,
      team_leader_id, outcome, clinical_summary, created_at
    ) VALUES (
      ?, 'CODE-20261107-PALS-01', '2026-11-07T09:15:00', 'status_epilepticus', 78.0,
      10.5, 'purple', 4.0, 12.0,
      22, 1.05, 210,
      ?, 'stabilized_transferred_picu',
      'Prolonged febrile seizure lasting >15 min. Midazolam 1.5 mg IV given, 210 mL NS bolus. Seizure aborted. Airway maintained on high-flow nasal cannula. Transferred to PICU.', ?
    )
  `).run(aaravId, docId, now);

  // =========================================================================
  // SERIES 13 DEMO DATA: NICU TPN, MATERNAL COMORBIDITIES & PEDIATRIC ALLERGY
  // =========================================================================

  // 13A: NICU TPN & Electrolyte Infusion Compounding
  db.prepare(`
    INSERT OR IGNORE INTO nicu_tpn_prescriptions (
      patient_id, admission_id, prescription_code, prescription_date, day_of_life,
      gestational_age_weeks, birth_weight_kg, current_weight_kg, target_total_fluid_ml_per_kg_day,
      enteral_intake_ml_day, parenteral_fluid_ml_day, dextrose_percent, glucose_infusion_rate_gir,
      dextrose_volume_ml, amino_acid_solution_type, amino_acid_g_per_kg_day, amino_acid_volume_ml,
      lipid_emulsion_type, lipid_g_per_kg_day, lipid_volume_ml, lipid_infusion_hours,
      sodium_meq_per_kg_day, potassium_meq_per_kg_day, calcium_gluconate_ml_per_kg_day,
      magnesium_sulfate_ml_day, phosphate_mmol_per_kg_day, heparin_units_per_ml,
      multivitamin_mvi_ml_day, total_calories_kcal_day, calories_per_kg_day,
      non_protein_calorie_nitrogen_ratio, total_osmolarity_mosm_l, route_category,
      status, prescribed_by_id, notes, created_at
    ) VALUES (
      ?, NULL, 'TPN-20261107-1001', '2026-11-07', 3,
      29.0, 1.25, 1.20, 120.0,
      10.0, 134.0, 10.0, 6.2,
      86.0, 'primene_10', 3.0, 36.0,
      'smoflipid_20', 2.0, 12.0, 24.0,
      3.0, 2.0, 2.0,
      0.2, 1.0, 0.5,
      1.5, 78.4, 65.3,
      94.2, 780, 'peripheral',
      'active', ?, 'ESPGHAN starter TPN protocol; advance lipids to 2.5 g/kg tomorrow if triglycerides < 200 mg/dL.', ?
    )
  `).run(babyId, docId, now);

  const existingTpn = db.prepare('SELECT id FROM nicu_tpn_prescriptions WHERE prescription_code = ?').get('TPN-20261107-1001') as { id: number } | undefined;
  if (existingTpn) {
    db.prepare(`
      INSERT OR IGNORE INTO nicu_tpn_lab_monitorings (
        tpn_prescription_id, monitoring_datetime, blood_glucose_mg_dl, serum_sodium_meq_l,
        serum_potassium_meq_l, serum_calcium_mg_dl, serum_triglycerides_mg_dl,
        serum_urea_mg_dl, direct_bilirubin_mg_dl, gir_adjusted_flag, logged_by_id, notes, created_at
      ) VALUES (
        ?, '2026-11-07T12:00:00', 82.0, 138.0,
        4.2, 8.8, 135.0,
        22.0, 0.8, 0, ?, 'Bedside glucometer within target; triglycerides stable.', ?
      )
    `).run(existingTpn.id, nurseId, now);
  }

  // 13B: High-Risk Maternal Medical Comorbidities
  // Maternal Cardiac (mWHO II, Fallot) for Sunita
  db.prepare(`
    INSERT OR IGNORE INTO maternal_cardiac_assessments (
      patient_id, admission_id, assessment_code, assessment_datetime, gestational_age_weeks,
      cardiac_diagnosis, mwho_class, prior_cardiac_event, prior_arrhythmia, nyha_class_baseline,
      left_heart_obstruction, reduced_systemic_ventricular_function_ef_lt50,
      high_risk_valve_or_aorta, late_pregnancy_presentation, carpreg_ii_score,
      predicted_cardiac_event_risk_pct, monitoring_plan_antepartum, delivery_mode_recommendation,
      anesthesia_recommendation, icu_postpartum_bed_reserved, attending_cardiologist_name,
      consultant_obgyn_id, notes, created_at
    ) VALUES (
      ?, NULL, 'CARDIAC-20261107-2001', '2026-11-07T10:00:00', 28.0,
      'Repaired Tetralogy of Fallot with moderate pulmonary regurgitation', 'mwho_II', 0, 0, 'I',
      0, 0,
      0, 0, 0,
      5.0, 'Serial echocardiography at 28 and 34 weeks; continuous pulse oximetry during labor.', 'Spontaneous or induced vaginal delivery with early lumbar epidural analgesia and assisted second stage to avoid Valsalva.',
      'Continuous lumbar epidural analgesia strongly recommended; avoid single-shot spinal.', 1, 'Dr. Rajesh Mehta, DM (Cardiology)',
      ?, 'Joint cardio-obstetric consultation completed. Patient counseled on red-flag heart failure symptoms.', ?
    )
  `).run(sunitaId, docId, now);

  // Maternal ICP Surveillance for Anita
  db.prepare(`
    INSERT OR IGNORE INTO maternal_icp_surveillance (
      patient_id, admission_id, episode_code, observation_datetime, gestational_age_weeks,
      pruritus_severity, total_serum_bile_acids_umol_l, icp_severity_tier,
      alt_u_l, ast_u_l, total_bilirubin_mg_dl, udca_prescribed_mg_day,
      udca_dose_mg_kg_day, recommended_delivery_gestation_weeks,
      fetal_surveillance_interval_days, status, assessed_by_id, clinical_notes, created_at
    ) VALUES (
      ?, NULL, 'ICP-20261107-3001', '2026-11-07T11:30:00', 33.0,
      'moderate_continuous', 56.0, 'moderate_40_99',
      88.0, 74.0, 1.2, 900.0,
      14.0, 37.5,
      5, 'active_monitoring', ?, 'Initiated UDCA 300 mg TDS with meals. Repeat bile acids in 5 days; planned delivery at 37+4 weeks.', ?
    )
  `).run(anitaId, docId, now);

  // 13C: Pediatric Asthma PRAM & Anaphylaxis Action Plan
  // PRAM Assessment for Aarav
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_pram_assessments (
      patient_id, admission_id, assessment_code, assessment_datetime, oxygen_saturation_pct,
      o2_score, suprasternal_retractions_score, scalene_muscle_contraction_score,
      air_entry_score, wheezing_score, total_pram_score, severity_tier,
      response_to_burst_saba, systemic_steroid_given, iv_magnesium_given,
      assessed_by_id, clinical_notes, created_at
    ) VALUES (
      ?, NULL, 'PRAM-20261107-4001', '2026-11-07T08:00:00', 93.0,
      1, 2, 0,
      1, 2, 6, 'moderate_4_7',
      'partial_response', 1, 0,
      ?, 'Moderate asthma exacerbation triggered by viral URI. Burst SABA 3 doses given with oral Prednisolone 20 mg.', ?
    )
  `).run(aaravId, docId, now);

  // Anaphylaxis Action Plan for Aarav
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_anaphylaxis_action_plans (
      patient_id, plan_code, diagnosis_date, known_allergens, child_weight_kg,
      epinephrine_im_dose_mg, epinephrine_im_volume_ml, autoinjector_type,
      injection_site, antihistamine_prescribed, steroid_prescribed,
      school_health_action_plan_shared, emergency_contact_name, emergency_contact_phone,
      attending_physician_id, clinical_instructions, created_at
    ) VALUES (
      ?, 'ANAPH-20261107-5001', '2026-11-07', '["Peanuts","Tree Nuts (Cashew)"]', 18.5,
      0.18, 0.18, 'epipen_jr_0_15mg',
      'anterolateral_right_thigh', 'Cetirizine 5 mg syrup', 'Prednisolone 20 mg daily x 3 days',
      1, 'Pooja Patel (Mother)', '+91 98765 43210',
      ?, 'EpiPen Jr prescribed. School emergency action plan signed. Instructed caregivers to inject immediately into outer mid-thigh upon accidental allergen exposure.', ?
    )
  `).run(aaravId, docId, now);

  // =========================================================================
  // SERIES 14 DEMO DATA: NEONATAL HIE / TTM, MATERNAL SEPSIS & PEDIATRIC DKA
  // =========================================================================

  // 14A: Neonatal Hypoxic-Ischemic Encephalopathy (HIE) & Targeted Temperature Management (TTM)
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_hie_assessments (
      patient_id, admission_id, assessment_code, birth_datetime, assessment_datetime,
      gestational_age_weeks, birth_weight_kg, apgar_10m, resuscitation_duration_minutes,
      cord_or_arterial_ph, base_deficit_mmol_l, sarnat_stage, level_of_consciousness,
      muscle_tone, primitive_reflexes_suck_moro, autonomic_function, clinical_seizures_present,
      cooling_criteria_met, hours_from_birth_to_cooling, cooling_device_type,
      target_core_temp_celsius, protocol_status, cooling_started_at,
      consultant_neonatologist_id, clinical_notes, created_at
    ) VALUES (
      ?, NULL, 'HIE-20261107-1001', '2026-11-07T03:30:00', '2026-11-07T05:30:00',
      38.5, 3.10, 4, 12,
      6.94, 18.0, 'stage_II_moderate', 'lethargic_obtunded',
      'hypotonic', 'weak_incomplete', 'sympathetic_parasympathetic_skew', 1,
      1, 2.5, 'servo_controlled_cooling_blanket',
      33.5, 'cooling_active', '2026-11-07T06:00:00',
      ?, 'Severe perinatal depression, cord pH 6.94, Sarnat II moderate encephalopathy with subtle seizures. TOBY criteria met; 72h servo-blanket cooling active.', ?
    )
  `).run(babyId, docId, now);

  const existingHie = db.prepare('SELECT id FROM neonatal_hie_assessments WHERE assessment_code = ?').get('HIE-20261107-1001') as { id: number } | undefined;
  if (existingHie) {
    const hieLogs = [
      { hr: 1, temp: 33.6, skin: 33.1, hrBpm: 112, map: 44, bg: 82, k: 4.3, aeeg: 'discontinuous_normal_voltage_dnv', notes: 'Core temp reached 33.6°C. Shivering suppressed.' },
      { hr: 2, temp: 33.5, skin: 33.0, hrBpm: 108, map: 46, bg: 88, k: 4.1, aeeg: 'discontinuous_normal_voltage_dnv', notes: 'Target 33.5°C steady. Dopamine 5 mcg/kg/min running.' },
      { hr: 3, temp: 33.4, skin: 32.9, hrBpm: 105, map: 45, bg: 85, k: 4.2, aeeg: 'discontinuous_normal_voltage_dnv', notes: 'Stable hemodynamics. Skin sites repositioned.' },
    ];
    for (const l of hieLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_ttm_flowsheet_logs (
          hie_assessment_id, log_datetime, hours_into_protocol, phase, core_temperature_celsius,
          skin_temperature_celsius, heart_rate_bpm, mean_arterial_pressure_mmhg,
          blood_glucose_mg_dl, serum_potassium_meq_l, aeeg_background_pattern,
          aeeg_sleep_wake_cycling, electrographic_seizures_detected,
          anticonvulsant_administered, inotropic_support, logged_by_id, notes, created_at
        ) VALUES (
          ?, '2026-11-07T08:00:00', ?, 'maintenance_cooling', ?,
          ?, ?, ?,
          ?, ?, ?,
          0, 0,
          'Phenobarbital 20 mg/kg load', 'Dopamine 5 mcg/kg/min', ?, ?, ?
        )
      `).run(existingHie.id, l.hr, l.temp, l.skin, l.hrBpm, l.map, l.bg, l.k, l.aeeg, docId, l.notes, now);
    }
  }

  // 14B: Maternal Critical Care Sepsis & Shock Index
  db.prepare(`
    INSERT OR IGNORE INTO maternal_sepsis_assessments (
      patient_id, admission_id, assessment_code, assessment_datetime, gestational_age_weeks,
      postpartum_days, suspected_source, temperature_celsius, systolic_bp_mmhg, diastolic_bp_mmhg,
      heart_rate_bpm, respiratory_rate_bpm, spo2_percent, wbc_count_per_ul, immature_bands_percent,
      serum_lactate_mmol_l, sos_score, sos_risk_level, obstetric_shock_index, shock_index_tier,
      mean_arterial_pressure_mmhg, icu_transfer_recommended, assessed_by_id, clinical_impression, created_at
    ) VALUES (
      ?, NULL, 'SOS-20261107-2001', '2026-11-07T07:15:00', 36.4,
      NULL, 'chorioamnionitis_intrauterine', 39.0, 86, 50,
      126, 26, 92.0, 19500, 12,
      3.2, 12, 'severe_septic_shock', 1.47, 'critical_shock_gte_1_4',
      62.0, 1, ?, 'Severe maternal sepsis secondary to acute chorioamnionitis. SOS 12, Shock Index 1.47, MAP 62. Emergency Hour-1 Bundle activated.', ?
    )
  `).run(anitaId, docId, now);

  const existingSepsis = db.prepare('SELECT id FROM maternal_sepsis_assessments WHERE assessment_code = ?').get('SOS-20261107-2001') as { id: number } | undefined;
  if (existingSepsis) {
    db.prepare(`
      INSERT OR IGNORE INTO maternal_sepsis_bundle_logs (
        sepsis_assessment_id, log_datetime, blood_cultures_drawn, blood_cultures_drawn_time,
        iv_antibiotics_given, antibiotic_name_regimen, iv_antibiotics_time, antibiotic_within_60m,
        fluid_bolus_30ml_per_kg_given, fluid_bolus_volume_ml, norepinephrine_vasopressor_active,
        vasopressor_dose_mcg_min, repeat_lactate_mmol_l, target_map_achieved_gte_65,
        urine_output_ml_hr, logged_by_id, interventions_summary, created_at
      ) VALUES (
        ?, '2026-11-07T08:00:00', 1, '2026-11-07T07:25:00',
        1, 'Piperacillin-Tazobactam 4.5g IV + Clindamycin 900mg IV', '2026-11-07T07:45:00', 1,
        1, 2000.0, 0,
        NULL, 1.9, 1,
        48.0, ?, 'Blood cultures taken at 10m. Antibiotics infused at 30m (<60m goal). 2L crystalloid bolus completed; MAP normalized to 68 mmHg.', ?
      )
    `).run(existingSepsis.id, docId, now);
  }

  // 14C: Pediatric Diabetic Ketoacidosis (DKA) Resuscitation & Two-Bag Protocol
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_dka_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime, child_weight_kg,
      child_height_cm, initial_blood_glucose_mg_dl, venous_ph, serum_bicarbonate_mmol_l,
      serum_beta_hydroxybutyrate_mmol_l, ketones_urine_or_blood, dka_severity,
      estimated_dehydration_percent, total_fluid_deficit_ml, maintenance_fluid_ml_day,
      initial_saline_bolus_ml, rehydration_rate_ml_hr, insulin_infusion_rate_u_kg_hr,
      two_bag_system_active, status, attending_pediatrician_id, clinical_notes, created_at
    ) VALUES (
      ?, NULL, 'DKA-20261107-3001', '2026-11-07T06:00:00', 18.0,
      112.0, 520.0, 7.06, 5.0,
      5.8, 'beta_hydroxybutyrate_gte_3', 'severe_ph_lt_7_10',
      7.0, 1260.0, 1400.0,
      180.0, 80.8, 0.08,
      1, 'active_resuscitation', ?, 'New onset T1D presenting with severe DKA and 7% dehydration. PICU Two-Bag IV titration active. Standby 3% NaCl bedside.', ?
    )
  `).run(aaravId, docId, now);

  const existingDka = db.prepare('SELECT id FROM pediatric_dka_episodes WHERE episode_code = ?').get('DKA-20261107-3001') as { id: number } | undefined;
  if (existingDka) {
    const dkaLogs = [
      { hr: 1, bg: 450, ph: 7.12, hco3: 7.5, na: 133, k: 4.6, b1: 65, b2: 15, gcs: 15, notes: 'BG decreased by 70 mg/dL. Bag 1 running primary.' },
      { hr: 2, bg: 380, ph: 7.18, hco3: 10.0, na: 135, k: 4.4, b1: 50, b2: 30, gcs: 15, notes: 'Bag 2 (D10) titrated up to maintain smooth glucose curve.' },
    ];
    for (const dl of dkaLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_dka_flowsheet_logs (
          dka_episode_id, log_datetime, hours_on_protocol, blood_glucose_mg_dl,
          venous_ph, serum_bicarbonate_mmol_l, serum_sodium_meq_l, corrected_sodium_meq_l,
          serum_potassium_meq_l, effective_serum_osmolality_mosm_kg, anion_gap_mmol_l,
          bag_1_rate_ml_hr, bag_2_rate_ml_hr, insulin_infusion_units_hr,
          glasgow_coma_scale_score, neurological_headache_vomiting, cushing_triad_warning,
          emergency_hyperosmolar_saline_given, urine_output_ml_kg_hr, logged_by_id, notes, created_at
        ) VALUES (
          ?, '2026-11-07T08:00:00', ?, ?,
          ?, ?, ?, 139.0,
          ?, 295.0, 16.0,
          ?, ?, 1.44,
          ?, 0, 0,
          0, 1.4, ?, ?, ?
        )
      `).run(existingDka.id, dl.hr, dl.bg, dl.ph, dl.hco3, dl.na, dl.k, dl.b1, dl.b2, dl.gcs, docId, dl.notes, now);
    }
  }

  // 15A: Neonatal RDS, Bubble CPAP & LISA Surfactant
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_rds_episodes (
      patient_id, admission_id, episode_code, onset_datetime, gestational_age_weeks,
      birth_weight_kg, current_weight_kg, silverman_anderson_score, downes_score,
      fio2_requirement_percent, arterial_pao2_mmhg, alveolar_pao2_mmhg, a_a_ratio,
      oxygenation_index, surfactant_indicated, surfactant_brand, surfactant_dose_mg_per_kg,
      surfactant_total_dose_mg, surfactant_total_volume_ml, administration_method,
      surfactant_administered_at, repeat_surfactant_needed, niv_modality, current_peep_cmh2o,
      current_flow_lpm, current_fio2_percent, status, consultant_neonatologist_id,
      clinical_notes, created_at
    ) VALUES (
      ?, NULL, 'RDS-20261107-1001', '2026-11-07T05:00:00', 29.5,
      1.25, 1.25, 5, 5,
      35.0, 52.0, 205.0, 0.25,
      4.4, 1, 'curosurf_poractant_alfa', 200.0,
      250.0, 3.13, 'lisa_mist_thin_catheter',
      '2026-11-07T05:30:00', 0, 'bubble_cpap', 6.0,
      6.0, 35.0, 'surfactant_administered_stabilized', ?,
      'Preterm 29.5w with respiratory distress. Less Invasive Surfactant Administration (LISA) completed with Curosurf 250mg. Maintained on Bubble CPAP.', ?
    )
  `).run(babyId, docId, now);

  const existingRds = db.prepare('SELECT id FROM neonatal_rds_episodes WHERE episode_code = ?').get('RDS-20261107-1001') as { id: number } | undefined;
  if (existingRds) {
    const nivLogs = [
      { hr: 1, rr: 58, hrBpm: 142, spo2: 93, silv: 3, down: 3, peep: 6.0, fio2: 32, columella: 'intact', notes: 'Post-LISA surfactant bubbling continuous. Good chest expansion.' },
      { hr: 2, rr: 52, hrBpm: 138, spo2: 95, silv: 2, down: 2, peep: 5.5, fio2: 28, columella: 'intact', notes: 'Weaning FiO2 to 28%. Nasal columella pink and intact with silicone barrier.' },
    ];
    for (const nl of nivLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_niv_flowsheet_logs (
          rds_episode_id, log_datetime, hours_on_protocol, respiratory_rate_bpm,
          heart_rate_bpm, spo2_percent, silverman_score, downes_score,
          peep_cmh2o, flow_lpm, fio2_percent, nasal_columella_skin_check,
          gastric_distension, arterial_blood_gas_ph, arterial_pco2_mmhg,
          arterial_pao2_mmhg, logged_by_id, notes, created_at
        ) VALUES (
          ?, '2026-11-07T07:00:00', ?, ?,
          ?, ?, ?, ?,
          ?, 6.0, ?, ?,
          'none', 7.34, 44.0,
          65.0, ?, ?, ?
        )
      `).run(existingRds.id, nl.hr, nl.rr, nl.hrBpm, nl.spo2, nl.silv, nl.down, nl.peep, nl.fio2, nl.columella, docId, nl.notes, now);
    }
  }

  // 15B: Maternal Venous Thromboembolism (VTE) Risk Assessment & Thromboprophylaxis
  db.prepare(`
    INSERT OR IGNORE INTO maternal_vte_assessments (
      patient_id, admission_id, assessment_type, assessment_datetime,
      gestational_age_weeks, current_weight_kg, bmi,
      previous_vte_unprovoked_or_estrogen, previous_vte_provoked,
      known_high_risk_thrombophilia, medical_comorbidities, surgical_procedure_in_pregnancy,
      gross_varicose_veins, age_over_35, parity_geq_3, smoker,
      bmi_geq_30, bmi_geq_40, multiple_pregnancy, assisted_reproductive_tech_ivf,
      pre_eclampsia, cesarean_section_emergency, cesarean_section_elective,
      prolonged_labor_over_24h, postpartum_hemorrhage_over_1000ml, preterm_birth_under_37w,
      stillbirth_in_this_pregnancy, systemic_infection_current, immobility_bedrest_over_3d,
      hyperemesis_or_dehydration, low_risk_thrombophilia, family_history_vte_first_degree,
      total_vte_score, risk_tier, lmwh_prescribed, lmwh_agent,
      lmwh_daily_dose_mg_or_units, weight_tier_bracket, anti_embolic_stockings_ordered,
      neuraxial_anesthesia_eligible, last_dose_datetime, next_safe_neuraxial_datetime,
      assessed_by_id, clinical_notes, created_at
    ) VALUES (
      ?, NULL, 'postnatal', '2026-11-07T07:00:00',
      NULL, 78.0, 29.2,
      0, 0,
      0, 0, 0,
      0, 1, 1, 0,
      0, 0, 0, 0,
      0, 1, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      4, 'high_immediate_prophylaxis_indicated', 1, 'enoxaparin',
      '40 mg SC once daily', '50 - 90 kg (Standard body weight)', 1,
      0, '2026-11-07T08:00:00', '2026-11-07T20:00:00',
      ?, 'Postnatal Day 1 following emergency CS for fetal bradycardia. Age > 35, Parity >= 3, Emergency CS (Score 4: High risk). Enoxaparin 40mg SC daily prescribed for 6 weeks.', ?
    )
  `).run(anitaId, docId, now);

  const existingVte = db.prepare('SELECT id FROM maternal_vte_assessments WHERE patient_id = ?').get(anitaId) as { id: number } | undefined;
  if (existingVte) {
    db.prepare(`
      INSERT OR IGNORE INTO maternal_vte_dose_logs (
        assessment_id, administered_at, agent, dose,
        route, site, administered_by_id, platelet_count,
        anti_xa_level, bleeding_signs_observed, notes, created_at
      ) VALUES (
        ?, '2026-11-07T08:00:00', 'Enoxaparin (Clexane)', '40 mg',
        'subcutaneous', 'abdomen_left', ?, 245000.0,
        NULL, 0, 'Subcutaneous injection into left abdominal wall. No hematoma. 12-hour spinal safety blackout active.', ?
      )
    `).run(existingVte.id, docId, now);
  }

  // 15C: Pediatric Status Epilepticus Resuscitation & Refractory Seizure Algorithm
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_seizure_episodes (
      patient_id, admission_id, episode_code, seizure_start_datetime,
      seizure_type, etiology, patient_age_months, weight_kg,
      broselow_color_zone, current_algorithm_phase, seizure_cessation_datetime,
      total_seizure_duration_minutes, blood_glucose_mg_dl, d10w_bolus_given_ml,
      phase2_benzodiazepine_given, phase2_dose_count, phase3_second_line_agent,
      phase3_second_line_dose_mg, phase3_infusion_status, phase4_picu_escalation_status,
      attending_pediatrician_id, clinical_notes, created_at
    ) VALUES (
      ?, NULL, 'SZ-20261107-2001', '2026-11-07T08:15:00',
      'generalized_tonic_clonic', 'febrile_status', 18.0, 11.5,
      'purple', 'seizure_aborted_postictal', '2026-11-07T08:23:30',
      8.5, 84.0, NULL,
      'Midazolam Intranasal 2.3 mg', 1, NULL,
      NULL, 'not_started', 'not_needed',
      ?, 'Febrile status epilepticus in 18-month-old child. Seizure lasted 8.5 minutes. Aborted within 3.5 minutes of Intranasal Midazolam 2.3 mg delivery. Stable in postictal recovery.', ?
    )
  `).run(aaravId, docId, now);

  const existingSz = db.prepare('SELECT id FROM pediatric_seizure_episodes WHERE episode_code = ?').get('SZ-20261107-2001') as { id: number } | undefined;
  if (existingSz) {
    const timelineEvents = [
      { elapsed: 1.0, action: 'airway_oxygen_positioning', med: null, dose: null, route: 'inhalation', hr: 148, bpS: 98, bpD: 60, spo2: 97, motor: 1, obs: 'Airway opened, lateral recovery positioning, 100% O2 via NRB mask at 15 LPM.' },
      { elapsed: 3.0, action: 'blood_glucose_checked', med: 'Point-of-care Blood Glucose', dose: '84 mg/dL', route: null, hr: 150, bpS: 100, bpD: 62, spo2: 98, motor: 1, obs: 'Normoglycemic (84 mg/dL). No D10W bolus required.' },
      { elapsed: 5.0, action: 'first_line_benzodiazepine', med: 'Midazolam (Intranasal)', dose: '2.3 mg', route: 'intranasal', hr: 144, bpS: 96, bpD: 58, spo2: 97, motor: 1, obs: 'Administered 0.46 mL of 5 mg/mL solution divided into bilateral nares via MAD atomizer.' },
      { elapsed: 8.5, action: 'seizure_aborted', med: null, dose: null, route: null, hr: 124, bpS: 94, bpD: 56, spo2: 99, motor: 0, obs: 'Complete cessation of bilateral clonic jerking. Pupils reactive, breathing regular.' },
    ];
    for (const te of timelineEvents) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_seizure_timeline_logs (
          seizure_episode_id, elapsed_minutes, timestamp,
          action_type, medication_name, dose_administered,
          route, heart_rate_bpm, blood_pressure_systolic,
          blood_pressure_diastolic, spo2_percent, active_motor_activity,
          logged_by_id, clinical_observations, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:20:00',
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingSz.id, te.elapsed, te.action, te.med, te.dose, te.route, te.hr, te.bpS, te.bpD, te.spo2, te.motor, docId, te.obs, now);
    }
  }

  // --- SERIES 16: NEONATAL SEPSIS, OBSTETRIC HYPERTENSIVE CRISIS, PEDIATRIC SEPTIC SHOCK ---
  // 16A: Neonatal Sepsis & Inotrope Stewardship (Kaiser EOS / I-T Ratio)
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_sepsis_episodes (
      patient_id, admission_id, episode_code, evaluation_datetime,
      gestational_age_weeks, gestational_age_days, birth_weight_kg,
      maternal_temp_celsius, rom_hours, maternal_gbs_status, maternal_iap_status,
      clinical_presentation, eos_risk_per_1000, eos_recommendation,
      blood_culture_drawn, blood_culture_result, empiric_antibiotics_started,
      ampicillin_dose_mg, gentamicin_dose_mg, it_ratio, crp_mg_l, micro_esr_mm_hr,
      platelets_k_ul, los_suspected, los_action_plan, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'EOS-20261107-001', '2026-11-07T06:00:00',
      36, 4, 2.4,
      38.2, 19.0, 'positive', 'inadequate',
      'equivocal', 4.12, 'blood_culture_empiric_antibiotics',
      1, 'pending', 1,
      120.0, 9.6, 0.23, 18.5, 12.0,
      180.0, 0, 'Serial observation in SCN', 'active_treatment', ?,
      'Late-preterm 36w4d infant with maternal chorioamnionitis risk (GBS+, ROM 19h, temp 38.2C). Kaiser EOS risk 4.12/1000 with I/T ratio 0.23 (>0.20). Blood culture drawn; IV Ampicillin + Gentamicin started. Dopamine titrated for MAP maintenance.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingSep = db.prepare('SELECT id FROM neonatal_sepsis_episodes WHERE episode_code = ?').get('EOS-20261107-001') as { id: number } | undefined;
  if (existingSep) {
    const inotropeLogs = [
      { hr: 1.0, bpm: 162, sbp: 48, dbp: 24, map: 32.0, preSpo2: 95, postSpo2: 91, svc: 72, uo: 0.8, dop: 5.0, notes: 'Dopamine started at 5 mcg/kg/min for MAP < GA (32 < 36 mmHg).' },
      { hr: 2.0, bpm: 152, sbp: 54, dbp: 30, map: 38.0, preSpo2: 98, postSpo2: 96, svc: 88, uo: 1.6, dop: 5.0, notes: 'Target MAP achieved (38 mmHg >= 36 mmHg). Capillary refill 2s, urine output normalized.' },
    ];
    for (const il of inotropeLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_inotrope_flowsheet_logs (
          sepsis_episode_id, patient_id, log_datetime, hours_on_inotropes,
          heart_rate_bpm, blood_pressure_systolic, blood_pressure_diastolic,
          map_mmhg, pre_ductal_spo2, post_ductal_spo2, delta_spo2, svc_flow_ml_kg_min,
          urine_output_ml_kg_hr, dopamine_mcg_kg_min, dobutamine_mcg_kg_min,
          epinephrine_mcg_kg_min, milrinone_mcg_kg_min, hydrocortisone_mg_kg,
          ino_ppm, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T07:00:00', ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, 0,
          0, 0, 0,
          0, ?, ?, ?
        )
      `).run(existingSep.id, babyId, il.hr, il.bpm, il.sbp, il.dbp, il.map, il.preSpo2, il.postSpo2, il.preSpo2 - il.postSpo2, il.svc, il.uo, il.dop, il.notes, nurseId, now);
    }
  }

  // 16B: Obstetric Hypertensive Crisis & PPCM (Sunita Rao / sunitaId)
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_hypertensive_crises (
      patient_id, admission_id, crisis_code, crisis_datetime, gestation_weeks,
      onset_phase, initial_sbp, initial_dbp, initial_map, first_line_agent,
      asthma_history, bradycardia_history, mgso4_co_administered,
      cumulative_labetalol_mg, cumulative_hydralazine_mg, cumulative_nifedipine_mg,
      final_sbp, final_dbp, final_map, blood_pressure_controlled,
      fetal_heart_rate_status, ppcm_screen_positive, lvef_percent, nt_pro_bnp_pg_ml,
      troponin_i_ng_ml, board_bromocriptine_started, board_oral_hf_rx,
      board_anticoagulation_started, board_diuretics_started, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'OHTN-20261107-101', '2026-11-07T06:30:00', 36.5,
      'postpartum', 178, 114, 135.3, 'labetalol',
      0, 0, 1,
      60.0, 0, 0,
      142, 92, 108.7, 1,
      'postpartum_na', 0, 60.0, 68.0,
      0.01, 0, NULL,
      0, 0, 'controlled_surveillance', ?,
      'Postpartum Day 2 severe hypertensive crisis (178/114 mmHg confirmed at 15m). Magnesium sulfate 4g IV loading given for eclampsia prophylaxis. IV Labetalol 20mg then 40mg achieved target BP 142/92 mmHg without maternal bradycardia.',
      ?, ?
    )
  `).run(sunitaId, docId, now, now);

  const existingHtn = db.prepare('SELECT id FROM obstetric_hypertensive_crises WHERE crisis_code = ?').get('OHTN-20261107-101') as { id: number } | undefined;
  if (existingHtn) {
    const htnLogs = [
      { step: 1, dt: '2026-11-07T06:46:00', sbp: 178, dbp: 114, map: 135.3, med: 'Labetalol IV', dose: 20, route: 'IV', hr: 84, notes: 'Step 1: 20mg IV push over 2 minutes. BP remained severe at 20 min.' },
      { step: 2, dt: '2026-11-07T07:07:00', sbp: 168, dbp: 108, map: 128.0, med: 'Labetalol IV', dose: 40, route: 'IV', hr: 78, notes: 'Step 2: 40mg IV push. Target BP achieved (142/92 mmHg). Maintained on 30-min vitals schedule.' },
    ];
    for (const hl of htnLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_hypertensive_dose_logs (
          crisis_id, patient_id, log_datetime, step_number,
          sbp, dbp, map_mmhg, medication_administered, dose_value, dose_unit,
          route, fetal_heart_rate, maternal_symptoms, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 'mg',
          ?, NULL, 'Headache improving', ?, ?, ?
        )
      `).run(existingHtn.id, sunitaId, hl.dt, hl.step, hl.sbp, hl.dbp, hl.map, hl.med, hl.dose, hl.route, hl.notes, nurseId, now);
    }
  }

  // 16C: Pediatric Septic Shock & VIS (Master Aarav Patel / aaravId)
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_septic_shock_episodes (
      patient_id, admission_id, episode_code, recognition_datetime,
      age_months, weight_kg, shock_phenotype, mental_status,
      capillary_refill_seconds, heart_rate_bpm, sbp, dbp, map_mmhg,
      pulse_quality, extremity_temperature, cumulative_fluid_ml,
      cumulative_fluid_ml_kg, hepatomegaly_present, pulmonary_crackles_present,
      fluid_overload_alert, fluid_refractory, first_line_vasoactive,
      stress_hydrocortisone_administered, current_vis_score, organ_dysfunction_flags,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PSEP-20261107-201', '2026-11-07T07:00:00',
      18, 11.5, 'cold_shock', 'lethargic',
      4.0, 168, 76, 42, 53.3,
      'weak_thready', 'cool_mottled', 345.0,
      30.0, 0, 0,
      0, 1, 'epinephrine',
      0, 7.0, '["hypotension", "tachycardia", "delayed_capillary_refill"]',
      'resuscitating', ?,
      '18-month-old male with septic shock secondary to severe pneumonia. Fluid-refractory after 30 mL/kg crystalloid boluses. Epinephrine peripheral infusion started for cold shock; VIS score stabilized from 12.0 down to 7.0.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingShock = db.prepare('SELECT id FROM pediatric_septic_shock_episodes WHERE episode_code = ?').get('PSEP-20261107-201') as { id: number } | undefined;
  if (existingShock) {
    const shockLogs = [
      { min: 15, bpm: 168, sbp: 76, dbp: 42, map: 53.3, crt: 4.0, mental: 'lethargic', fluidType: 'Normal Saline 0.9%', fluidMl: 230, totalMlKg: 20.0, epi: 0.12, vis: 12.0, notes: 'First bolus 20 mL/kg completed. Cold extremities persistent. Epinephrine started at 0.12 mcg/kg/min.' },
      { min: 45, bpm: 144, sbp: 92, dbp: 54, map: 66.7, crt: 2.0, mental: 'alert', fluidType: 'Normal Saline 0.9%', fluidMl: 115, totalMlKg: 30.0, epi: 0.07, vis: 7.0, notes: 'Second bolus 10 mL/kg given. Warm peripheries, CRT 2.0s, normal pulses, VIS weaned to 7.0.' },
    ];
    for (const sl of shockLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_septic_shock_flowsheet_logs (
          shock_episode_id, patient_id, log_datetime, minutes_from_recognition,
          heart_rate_bpm, sbp, dbp, map_mmhg, capillary_refill_seconds,
          mental_status, bolus_fluid_type, bolus_fluid_volume_ml, total_fluid_ml_kg,
          dopamine_mcg_kg_min, dobutamine_mcg_kg_min, epinephrine_mcg_kg_min,
          norepinephrine_mcg_kg_min, milrinone_mcg_kg_min, vasopressin_units_kg_min,
          vis_score, hepatomegaly_checked, pulmonary_crackles_checked, notes,
          logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T07:30:00', ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          0, 0, ?,
          0, 0, 0,
          ?, 1, 1, ?,
          ?, ?
        )
      `).run(existingShock.id, aaravId, sl.min, sl.bpm, sl.sbp, sl.dbp, sl.map, sl.crt, sl.mental, sl.fluidType, sl.fluidMl, sl.totalMlKg, sl.epi, sl.vis, sl.notes, nurseId, now);
    }
  }

  // --- SERIES 17A: Neonatal Hypoglycemia, GIR Titration & aEEG Neuro-Monitoring ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_hypoglycemia_episodes (
      patient_id, admission_id, episode_code, evaluation_datetime,
      age_hours, birth_weight_kg, current_weight_kg, risk_factors_json,
      symptoms_present, initial_blood_glucose_mg_dl, glucose_target_mg_dl,
      d10w_bolus_given_ml, current_gir_mg_kg_min, fluid_dextrose_percent,
      fluid_rate_ml_hr, seizure_activity_observed, seizure_type,
      aeeg_background_pattern, first_line_asm_given, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'NHYP-20261107-101', '2026-11-07T06:00:00',
      12, 3.1, 3.05, '["infant_of_diabetic_mother", "large_for_gestational_age"]',
      1, 28, 45,
      6.2, 5.0, 10.0,
      9.3, 0, 'none',
      'continuous_normal_voltage', 0, 'active_infusion', ?,
      '12-hour-old term infant of diabetic mother developed symptomatic hypoglycemia (blood glucose 28 mg/dL). Immediate D10W 2 mL/kg mini-bolus given. Maintenance GIR 5.0 mg/kg/min started with frequent SMBG.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingHypo = db.prepare('SELECT id FROM neonatal_hypoglycemia_episodes WHERE episode_code = ?').get('NHYP-20261107-101') as { id: number } | undefined;
  if (existingHypo) {
    const hypoLogs = [
      { dt: '2026-11-07T07:00:00', h: 1, bg: 38, dPct: 10.0, rate: 11.2, gir: 6.0, bolus: 0, feedMl: 10, feedType: 'ebm', aeeg: 'continuous_normal_voltage', seizures: 0, notes: 'GIR titrated to 6.0 mg/kg/min. Jitteriness improving. Sucking reflex vigorous.' },
      { dt: '2026-11-07T09:00:00', h: 3, bg: 52, dPct: 10.0, rate: 11.2, gir: 6.0, bolus: 0, feedMl: 15, feedType: 'ebm', aeeg: 'continuous_normal_voltage', seizures: 0, notes: 'Blood glucose reached AAP safe target (52 >= 45 mg/dL). Clinically stable, alert.' },
    ];
    for (const hl of hypoLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_glucose_gir_flowsheet_logs (
          episode_id, patient_id, log_datetime, hours_on_protocol,
          blood_glucose_mg_dl, fluid_dextrose_percent, fluid_rate_ml_hr,
          calculated_gir_mg_kg_min, d10w_bolus_ml, feeding_volume_ml,
          feeding_type, aeeg_pattern, seizure_events_count, notes,
          logged_by_id, created_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `).run(existingHypo.id, babyId, hl.dt, hl.h, hl.bg, hl.dPct, hl.rate, hl.gir, hl.bolus, hl.feedMl, hl.feedType, hl.aeeg, hl.seizures, hl.notes, nurseId, now);
    }
  }

  // --- SERIES 17B: Obstetric Postpartum Hemorrhage (PPH), WHO E-MOTIVE & Bakri Balloon ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_pph_episodes (
      patient_id, admission_id, episode_code, delivery_mode,
      pph_recognition_datetime, gestation_weeks, gravimetric_qbl_ml,
      drape_blood_volume_ml, swab_sponge_weight_net_g, initial_sbp,
      initial_dbp, initial_heart_rate, shock_index, etiology_4t,
      maternal_hypertension_history, maternal_asthma_history,
      emotive_massage_done, emotive_oxytocin_given, emotive_txa_given,
      emotive_iv_fluids_given, emotive_exam_completed, emotive_escalation_needed,
      bakri_balloon_placed, bakri_fill_volume_ml, tamponade_test_result,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PPH-20261107-101', 'vaginal',
      '2026-11-07T08:15:00', 39, 1150,
      850, 300, 90,
      55, 118, 1.31, 'tone_atony',
      0, 0,
      1, 1, 1,
      1, 1, 1,
      1, 350, 'success_bleeding_stopped',
      'tamponade_active', ?,
      'Severe atonic PPH recognized immediately after vaginal delivery with calibrated V-drape collection (850 mL) and weighed sponges (300g). WHO E-MOTIVE bundle instituted within 10 minutes: bimanual massage, IV Oxytocin infusion, 1g IV Tranexamic acid, and rapid crystalloid. Bleeding ongoing; Bakri balloon inserted and inflated with 350 mL saline. Positive tamponade test with cessation of active uterine bleeding.',
      ?, ?
    )
  `).run(meeraId, docId, now, now);

  const existingPph = db.prepare('SELECT id FROM obstetric_pph_episodes WHERE episode_code = ?').get('PPH-20261107-101') as { id: number } | undefined;
  if (existingPph) {
    const pphLogs = [
      { min: 15, intLoss: 150, cumQbl: 1300, sbp: 98, dbp: 62, hr: 108, si: 1.10, tone: 'boggy_soft', med: 'Inj. Oxytocin 20 IU + Ergometrine 0.2mg', bakriDrain: 40, uo: 35, notes: 'Bakri balloon in situ. Gentle uterine compression maintained.' },
      { min: 45, intLoss: 50, cumQbl: 1350, sbp: 112, dbp: 70, hr: 86, si: 0.77, tone: 'firm_contracted', med: 'Maintenance Oxytocin IV infusion', bakriDrain: 25, uo: 65, notes: 'Tamponade test positive. Hemodynamics normalized (Shock Index 0.77). Urine clear.' },
    ];
    for (const pl of pphLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_pph_flowsheet_logs (
          pph_episode_id, patient_id, log_datetime, minutes_from_recognition,
          interval_blood_loss_ml, cumulative_qbl_ml, sbp, dbp,
          heart_rate_bpm, calculated_shock_index, uterine_tone,
          medication_given, bakri_drainage_ml, urine_output_ml, notes,
          logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `).run(existingPph.id, meeraId, pl.min, pl.intLoss, pl.cumQbl, pl.sbp, pl.dbp, pl.hr, pl.si, pl.tone, pl.med, pl.bakriDrain, pl.uo, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 17C: Pediatric ARDS (PARDS), PALICC-2 Mechanics & Adjuvant Prone Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_pards_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      age_months, weight_kg, predicted_body_weight_kg, trigger_cause,
      ventilation_mode, current_peep_cmh2o, current_map_cmh2o,
      current_fio2_percent, pao2_mmhg, spo2_percent, calculated_oi,
      calculated_osi, pards_severity, target_tidal_volume_ml_min,
      target_tidal_volume_ml_max, plateau_pressure_limit_cmh2o,
      driving_pressure_limit_cmh2o, prone_positioning_active,
      neuromuscular_blockade_active, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PARDS-20261107-101', '2026-11-07T06:30:00',
      12, 10.0, 10.0, 'pneumonia',
      'invasive_mechanical', 8.0, 12.0,
      60.0, 68.0, 92.0, 10.6,
      7.8, 'moderate', 30.0,
      60.0, 28.0, 15.0, 1,
      1, 'acute_management', ?,
      '12-month-old infant with severe bilateral viral bronchopneumonia meeting PALICC-2 criteria for invasive Moderate PARDS (OI 10.6, P/F 113). Managed with lung-protective ventilation (Vt 5.5 mL/kg, Pplat 24, PEEP 8, Driving Pressure 16 -> target <15), adjuvant prone positioning protocol (16-hour cycle), and cisatracurium neuromuscular blockade.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingPards = db.prepare('SELECT id FROM pediatric_pards_episodes WHERE episode_code = ?').get('PARDS-20261107-101') as { id: number } | undefined;
  if (existingPards) {
    const pardsLogs = [
      { h: 2, pip: 26, pplat: 24, peep: 8.0, dp: 16.0, map: 12.0, fio2: 60.0, vt: 55, vtKg: 5.5, rrSet: 32, rrTot: 32, ph: 7.32, pao2: 68.0, pco2: 48.0, hco3: 24.5, spo2: 92.0, oi: 10.6, osi: 7.8, proneH: 2.0, notes: 'Prone position established. Permissive hypercapnia accepted (pH > 7.20).' },
      { h: 6, pip: 24, pplat: 21, peep: 8.0, dp: 13.0, map: 11.0, fio2: 45.0, vt: 50, vtKg: 5.0, rrSet: 30, rrTot: 30, ph: 7.38, pao2: 82.0, pco2: 42.0, hco3: 24.0, spo2: 96.0, oi: 6.0, osi: 5.2, proneH: 6.0, notes: 'Driving pressure decreased to 13 cmH2O following lung recruitment in prone position. FiO2 successfully weaned to 45%.' },
    ];
    for (const pl of pardsLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_pards_flowsheet_logs (
          pards_episode_id, patient_id, log_datetime, hours_on_protocol,
          pip_cmh2o, plateau_pressure_cmh2o, peep_cmh2o,
          calculated_driving_pressure_cmh2o, map_cmh2o, fio2_percent,
          tidal_volume_set_ml, tidal_volume_measured_ml_kg,
          respiratory_rate_set, respiratory_rate_total, abg_ph,
          abg_pao2_mmhg, abg_pco2_mmhg, abg_hco3_meq_l,
          spo2_percent, calculated_oi, calculated_osi,
          prone_positioning_hours, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:30:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingPards.id, aaravId, pl.h, pl.pip, pl.pplat, pl.peep, pl.dp, pl.map, pl.fio2, pl.vt, pl.vtKg, pl.rrSet, pl.rrTot, pl.ph, pl.pao2, pl.pco2, pl.hco3, pl.spo2, pl.oi, pl.osi, pl.proneH, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 18A: Neonatal Hyperbilirubinemia BIND Scoring & AABR Hearing Screening ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_bind_aabr_episodes (
      patient_id, admission_id, episode_code, assessment_datetime,
      gestational_age_weeks, birth_weight_grams, peak_tsb_mg_dl,
      direct_bilirubin_mg_dl, albumin_g_dl, calculated_b_a_ratio,
      mental_status_score, muscle_tone_score, cry_score,
      total_bind_score, bind_severity, aabr_right_ear,
      aabr_left_ear, aabr_test_datetime, exchange_transfusion_performed,
      ivig_given, status, consultant_id, neuro_auditory_followup_plan,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'BIND-20261107-101', '2026-11-07T07:30:00',
      36.0, 2600, 21.5,
      0.8, 3.0, 7.2,
      1, 1, 1,
      3, 'mild_abe', 'refer',
      'pass', '2026-11-07T08:00:00', 0,
      1, 'under_phototherapy', ?,
      'Diagnostic ABR and serial audiology evaluation at 1 month. High-risk neurodevelopmental follow-up clinic appointment at 3, 6, and 12 months.',
      '36-week late preterm male neonate with acute hyperbilirubinemia (peak TSB 21.5 mg/dL, B/A ratio 7.2). Mild ABE features (somnolence, mild hypotonia, high pitched cry, BIND 3). AABR hearing screen refers right ear. Quadruple intensive LED phototherapy started; IVIG 1 g/kg infused for ABO incompatibility.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingBind = db.prepare('SELECT id FROM neonatal_bind_aabr_episodes WHERE episode_code = ?').get('BIND-20261107-101') as { id: number } | undefined;
  if (existingBind) {
    const bindLogs = [
      { h: 0, m: 1, t: 1, c: 1, tot: 3, tsb: 21.5, photo: 'quadruple_intensive', notes: 'Initiated intensive LED phototherapy and IVIG infusion. Hydration monitored.' },
      { h: 4, m: 0, t: 1, c: 0, tot: 1, tsb: 17.8, photo: 'quadruple_intensive', notes: 'Tone improved, suckling vigorously. TSB responsive to phototherapy.' },
    ];
    for (const bl of bindLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_bind_serial_flowsheet_logs (
          episode_id, patient_id, log_datetime, hours_from_admission,
          mental_status_score, muscle_tone_score, cry_score,
          total_bind_score, tsb_mg_dl, phototherapy_type,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:00:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingBind.id, babyId, bl.h, bl.m, bl.t, bl.c, bl.tot, bl.tsb, bl.photo, bl.notes, nurseId, now);
    }
  }

  // --- SERIES 18B: Intrahepatic Cholestasis of Pregnancy (ICP) & Bile Acids ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_icp_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      gestation_weeks, peak_tsba_umol_l, baseline_alt_u_l, baseline_ast_u_l,
      pruritus_severity_score, pruritus_palms_soles, nocturnal_worsening,
      icp_severity_tier, udca_started, udca_dose_mg_day,
      ctg_surveillance_frequency, planned_delivery_weeks,
      delivery_timing_rationale, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'ICP-20261107-101', '2026-11-07T08:00:00',
      32.5, 48.5, 68.0, 54.0,
      7, 1, 1,
      'moderate_40_99', 1, 1000,
      'twice_weekly', 36.5,
      'SMFM/ACOG Moderate ICP Protocol: TSBA 48.5 umol/L. Planned induction between 36w0d and 37w0d with twice-weekly CTG surveillance and weekly fasting TSBA monitoring.',
      'active_surveillance', ?,
      '32.5 weeks gravida presenting with intractable palmar and plantar pruritus with nocturnal worsening. Fasting TSBA elevated at 48.5 umol/L confirming moderate obstetric cholestasis. Started on Ursodeoxycholic acid (UDCA) 500 mg PO BID (1000 mg/day). Twice weekly biophysical/CTG scheduled.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingIcp = db.prepare('SELECT id FROM obstetric_icp_episodes WHERE episode_code = ?').get('ICP-20261107-101') as { id: number } | undefined;
  if (existingIcp) {
    const icpLogs = [
      { gw: 32.5, tsba: 48.5, alt: 68.0, ast: 54.0, pr: 7, ctg: 'reactive', mv: 1, udca: 1000, notes: 'Baseline assessment upon presentation. Reactive CTG.' },
      { gw: 33.5, tsba: 36.2, alt: 48.0, ast: 38.0, pr: 4, ctg: 'reactive', mv: 1, udca: 1000, notes: 'Pruritus improved after 1 week on UDCA. TSBA trending down. Normal reactive CTG.' },
    ];
    for (const il of icpLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_icp_flowsheet_logs (
          icp_episode_id, patient_id, log_datetime, gestation_weeks,
          current_tsba_umol_l, alt_u_l, ast_u_l, pruritus_score,
          ctg_result, fetal_movements_adequate, udca_current_dose_mg_day,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingIcp.id, anitaId, il.gw, il.tsba, il.alt, il.ast, il.pr, il.ctg, il.mv, il.udca, il.notes, nurseId, now);
    }
  }

  // --- SERIES 18C: Pediatric Status Epilepticus Resuscitation ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_status_epilepticus_episodes (
      patient_id, admission_id, episode_code, seizure_onset_datetime,
      age_months, weight_kg, etiology, seizure_semiology,
      phase1_benzo_given, phase1_benzo_agent, phase1_benzo_dose_mg,
      phase1_administered_minute, phase2_second_line_given,
      phase2_agent, phase2_dose_mg, phase2_administered_minute,
      phase3_refractory_status, seizure_cessation_minute,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PSTAT-20261107-101', '2026-11-07T08:30:00',
      18, 11.5, 'febrile_status', 'generalized_tonic_clonic',
      1, 'lorazepam_iv', 1.2,
      4, 1,
      'levetiracetam', 690.0, 14,
      0, 19,
      'seizure_abated_post_ictal', ?,
      '18-month-old child presenting with prolonged febrile convulsion lasting >15 minutes. Phase 1 IV Lorazepam (0.1 mg/kg = 1.2 mg) given at minute 4. Due to ongoing clonic movements at minute 12, Phase 2 Levetiracetam 60 mg/kg (690 mg) infused over 10 minutes. Complete seizure cessation at minute 19. Blood glucose 98 mg/dL. Airway maintained on high-flow O2. Currently post-ictal, hemodynamically stable.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingStat = db.prepare('SELECT id FROM pediatric_status_epilepticus_episodes WHERE episode_code = ?').get('PSTAT-20261107-101') as { id: number } | undefined;
  if (existingStat) {
    const statLogs = [
      { min: 5, phase: 'phase_1_emergent_benzo', sz: 1, hr: 160, sbp: 95, dbp: 58, spo2: 96.0, air: 'patent_spontaneous', rate: 0.0, eeg: 'continuous_spikes', notes: 'Administered Lorazepam 1.2 mg IV push. High-flow blow-by oxygen.' },
      { min: 15, phase: 'phase_2_urgent_control', sz: 1, hr: 148, sbp: 98, dbp: 60, spo2: 98.0, air: 'patent_spontaneous', rate: 0.0, eeg: 'continuous_spikes', notes: 'Started IV Levetiracetam 690 mg infusion over 10 minutes.' },
      { min: 20, phase: 'post_seizure_stabilization', sz: 0, hr: 118, sbp: 96, dbp: 62, spo2: 99.0, air: 'patent_spontaneous', rate: 0.0, eeg: 'slowing', notes: 'Convulsion ceased at minute 19. Child placed in recovery position. Neurologic status post-ictal.' },
    ];
    for (const sl of statLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_status_epilepticus_flowsheet_logs (
          seizure_episode_id, patient_id, log_datetime, minutes_from_onset,
          phase_active, seizure_activity_present, vitals_hr, vitals_sbp,
          vitals_dbp, vitals_spo2, airway_status, infusion_rate_mcg_kg_min,
          eeg_background, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:35:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingStat.id, aaravId, sl.min, sl.phase, sl.sz, sl.hr, sl.sbp, sl.dbp, sl.spo2, sl.air, sl.rate, sl.eeg, sl.notes, nurseId, now);
    }
  }

  // --- SERIES 19A: Neonatal Necrotizing Enterocolitis (NEC) Bell's Staging ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_nec_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      gestational_age_weeks, birth_weight_grams, current_weight_grams,
      bell_stage, systemic_signs_json, intestinal_signs_json, radiological_signs_json,
      abg_ph, base_excess, platelet_count, crp_mg_l, serum_lactate_mmol_l,
      npo_active, ng_decompression_active, broad_spectrum_antibiotics_active,
      tpn_support_active, inotrope_support_active, surgical_consult_status,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'NEC-20261107-101', '2026-11-07T07:00:00',
      29.0, 1180, 1220,
      'stage_2a_definite_mild',
      '["temperature_instability", "apnea_bradycardia", "lethargy_hypotonia"]',
      '["gastric_residuals_bilious", "abdominal_distension", "heme_positive_stool", "erythema_wall"]',
      '["radiographic_pneumatosis"]',
      7.29, -5.5, 95000, 36.5, 2.4,
      1, 1, 1,
      1, 0, 'consulted_medical_management',
      'active_medical_management', ?,
      '29-week preterm infant developed abdominal distension with 45% bilious aspirates and abdominal wall erythema. Radiograph confirmed pathognomonic pneumatosis intestinalis in right lower quadrant. Modified Bell Stage II-A (Definite Mild NEC). Strict NPO initiated for 7-10 days with replogle decompression, triple IV antibiotics (Ampicillin + Gentamicin + Metronidazole), and pediatric surgical team co-management.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingNec = db.prepare('SELECT id FROM neonatal_nec_episodes WHERE episode_code = ?').get('NEC-20261107-101') as { id: number } | undefined;
  if (existingNec) {
    const necLogs = [
      { h: 0, girth: 23.5, resVol: 3.5, resChar: 'bilious', sounds: 'hypoactive', wall: 'distended_soft', plt: 95000, ph: 7.29, lac: 2.4, notes: 'Baseline onset findings. Low wall suction replogle tube placed.' },
      { h: 6, girth: 24.2, resVol: 2.0, resChar: 'bilious', sounds: 'hypoactive', wall: 'erythematous', plt: 92000, ph: 7.31, lac: 2.2, notes: 'Abdominal wall erythematous around periumbilical region. Serial X-ray stable without free air.' },
      { h: 12, girth: 24.0, resVol: 1.2, resChar: 'curdled_milk', sounds: 'hypoactive', wall: 'distended_soft', plt: 98000, ph: 7.34, lac: 1.8, notes: 'Abdominal erythema lessening. Color and perfusion brisk. Tolerating TPN.' },
    ];
    for (const nl of necLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_nec_flowsheet_logs (
          nec_episode_id, patient_id, log_datetime, hours_from_onset,
          abdominal_girth_cm, gastric_residual_volume_ml, gastric_residual_character,
          bowel_sounds, abdominal_wall_appearance, platelet_count, abg_ph, lactate_mmol_l,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:00:00', ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingNec.id, babyId, nl.h, nl.girth, nl.resVol, nl.resChar, nl.sounds, nl.wall, nl.plt, nl.ph, nl.lac, nl.notes, nurseId, now);
    }
  }

  // --- SERIES 19B: Obstetric Placenta Accreta Spectrum (PAS) ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_pas_episodes (
      patient_id, admission_id, episode_code, evaluation_datetime,
      gestation_weeks, previous_cesareans_count, placenta_previa_present,
      prior_uterine_surgeries_json, loss_of_clear_zone, myometrial_thickness_less_1mm,
      lacunae_grade, subplacental_hypervascularity, bridging_vessels_to_bladder,
      mri_performed, mri_findings, pas_grade, mdt_members_json,
      ir_embolization_planned, ureteral_stents_planned, cell_saver_requested,
      prbc_units_reserved, ffp_units_reserved, platelet_units_reserved,
      planned_delivery_weeks, planned_delivery_datetime, surgical_approach,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PAS-20261107-101', '2026-11-07T08:30:00',
      33.0, 2, 1,
      '["previous_lscs_2020", "previous_lscs_2023"]', 1, 1,
      2, 1, 0,
      1, 'Placenta increta: lower anterior uterine segment thinning <1mm with multiple deep vascular lacunae abutting but not penetrating the outer bladder serosa.',
      'grade_2_increta', '["Dr. Meera Patel (Lead Obstetrician)", "Dr. Vivek Rao (Senior Obstetric Anesthesiologist)", "Dr. Sarah Smith (NICU Consultant)", "Dr. R. Raman (Urologist standby)"]',
      1, 1, 1,
      6, 6, 2,
      34.5, '2026-11-18T08:30:00', 'planned_cesarean_hysterectomy',
      'antepartum_planning', ?,
      '33-week gravida G3P2 with 2 prior cesarean deliveries and anterior complete placenta previa. Targeted ultrasound and pelvic MRI demonstrate PAS Grade 2 (Placenta Increta) with confluent vascular lacunae and myometrial thinning <1mm. MDT conference convened. Planned elective cesarean hysterectomy at 34w4d with preoperative ureteral stenting, IR balloon standby, cell saver, and 6 units PRBC / 6 units FFP crossmatched in OR refrigerator. Antenatal betamethasone planned at 34w0d.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingPas = db.prepare('SELECT id FROM obstetric_pas_episodes WHERE episode_code = ?').get('PAS-20261107-101') as { id: number } | undefined;
  if (existingPas) {
    const pasLogs = [
      { gw: 33.0, bleed: 0, ml: 0, sbp: 114, dbp: 72, hr: 78, ctg: 'category_1', hb: 11.4, notes: 'Baseline outpatient MDT surveillance. No vaginal bleeding. Category 1 CTG.' },
      { gw: 33.5, bleed: 0, ml: 0, sbp: 118, dbp: 74, hr: 80, ctg: 'category_1', hb: 11.2, notes: 'Antenatal clinic review. Vitals stable. Betamethasone first dose scheduled.' },
    ];
    for (const pl of pasLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_pas_flowsheet_logs (
          pas_episode_id, patient_id, log_datetime, gestation_weeks,
          antenatal_bleeding_episode, vaginal_bleeding_ml, maternal_sbp,
          maternal_dbp, maternal_hr, ctg_category, hemoglobin_g_dl,
          crossmatch_units_confirmed, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T09:00:00', ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          1, ?, ?, ?
        )
      `).run(existingPas.id, anitaId, pl.gw, pl.bleed, pl.ml, pl.sbp, pl.dbp, pl.hr, pl.ctg, pl.hb, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 19C: Pediatric Traumatic Brain Injury (TBI) & PECARN ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_tbi_episodes (
      patient_id, admission_id, episode_code, injury_datetime,
      age_months, weight_kg, injury_mechanism, age_bracket,
      gcs_score, altered_mental_status, palpable_skull_fracture,
      non_frontal_scalp_hematoma, loss_of_consciousness_seconds,
      acting_abnormal_parent, signs_of_basilar_fracture,
      vomiting_episodes_count, severe_headache, pecarn_risk_category,
      ct_performed, ct_findings, raised_icp_suspected,
      icp_management_tier, hyperosmolar_agent, intubation_status,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'TBI-20261107-101', '2026-11-07T07:30:00',
      18, 11.5, 'fall_greater_than_threshold', 'under_2_years',
      14, 1, 0,
      1, 10,
      1, 0,
      1, 0, 'high_risk_ct_indicated',
      1, 'isolated_linear_fracture', 0,
      'tier_1_neuroprotective', 'none', 'natural_airway',
      'acute_ed_eval', ?,
      '18-month-old infant presenting following fall from balcony (>1.2 meters). Brief loss of consciousness (~10 seconds) with subsequent somnolence, vomiting, and prominent left parietal subgaleal hematoma. GCS 14 (E3 V5 M6) with irritability. PECARN High Risk category indicated emergency non-contrast head CT, which demonstrated a nondisplaced left parietal linear skull fracture without underlying intracranial hemorrhage or midline shift. Admitted to PICU for continuous neurologic observation with 30-degree head-of-bed elevation and normothermia maintenance.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingTbi = db.prepare('SELECT id FROM pediatric_tbi_episodes WHERE episode_code = ?').get('TBI-20261107-101') as { id: number } | undefined;
  if (existingTbi) {
    const tbiLogs = [
      { min: 30, gcs: 14, e: 3, v: 5, m: 6, react: 'brisk_bilateral', r: 3.0, l: 3.0, hr: 124, sbp: 98, dbp: 60, spo2: 99.0, icp: 12.0, na: 140.0, osm: 288.0, bolus: 'none', notes: 'Arrival in Emergency Department. Somnolent but consolable. Pupils briskly reactive.' },
      { min: 90, gcs: 15, e: 4, v: 5, m: 6, react: 'brisk_bilateral', r: 3.0, l: 3.0, hr: 110, sbp: 100, dbp: 62, spo2: 100.0, icp: 11.0, na: 141.0, osm: 289.0, bolus: 'none', notes: 'Post-CT scan. CT linear fracture confirmed. Child alert, recognizing parents, drinking sips of clear water.' },
    ];
    for (const tl of tbiLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_tbi_flowsheet_logs (
          tbi_episode_id, patient_id, log_datetime, minutes_from_injury,
          gcs_total, gcs_eye, gcs_verbal, gcs_motor,
          pupil_reactivity, pupil_size_right_mm, pupil_size_left_mm,
          vitals_hr, vitals_sbp, vitals_dbp, vitals_spo2,
          icp_mmhg, serum_sodium_meq_l, serum_osmolarity_mosm_kg,
          hyperosmolar_bolus_given, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:00:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingTbi.id, aaravId, tl.min, tl.gcs, tl.e, tl.v, tl.m, tl.react, tl.r, tl.l, tl.hr, tl.sbp, tl.dbp, tl.spo2, tl.icp, tl.na, tl.osm, tl.bolus, tl.notes, nurseId, now);
    }
  }

  // --- SERIES 20A: Neonatal Persistent Pulmonary Hypertension (PPHN) & Inhaled Nitric Oxide (iNO) ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_pphn_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      gestational_age_weeks, birth_weight_grams, primary_etiology,
      preductal_spo2, postductal_spo2, spo2_gradient,
      mean_airway_pressure_cmh2o, fio2_percent, pao2_mmhg,
      calculated_oi, pphn_severity_tier,
      echo_tr_jet_velocity_m_s, echo_estimated_rvsp_mmhg, echo_shunt_direction,
      ino_active, ino_dose_ppm, methemoglobin_percent,
      sildenafil_active, milrinone_active,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PPHN-20261107-101', '2026-11-07T08:00:00',
      39.0, 3200, 'meconium_aspiration_syndrome',
      91.0, 78.0, 13.0,
      14.5, 100.0, 52.0,
      27.9, 'severe_oi_25_39',
      3.8, 65.0, 'right_to_left',
      1, 20.0, 1.2,
      0, 0,
      'active_ino_therapy', ?,
      'Term infant born through thick meconium with acute hypoxemic respiratory failure. Pre/post-ductal SpO2 gradient 13% with OI 27.9 (Severe PPHN). Bedside echo demonstrates suprasystemic pulmonary pressures (RVSP 65 mmHg, TR jet 3.8 m/s) with pure right-to-left ductal shunting. Initiated iNO 20 ppm on HFOV with arterial line blood gas monitoring.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingPphn = db.prepare('SELECT id FROM neonatal_pphn_episodes WHERE episode_code = ?').get('PPHN-20261107-101') as { id: number } | undefined;
  if (existingPphn) {
    const pphnLogs = [
      { h: 0.5, pre: 91.0, post: 78.0, grad: 13.0, map: 14.5, fio2: 100.0, pao2: 52.0, oi: 27.9, ino: 20.0, methb: 1.2, no2: 0.3, bpMap: 48.0, is: 5.0, notes: 'Initiated iNO 20 ppm on HFOV (MAP 14.5 cmH2O). Baseline MetHb 1.2%.' },
      { h: 2.0, pre: 96.0, post: 93.0, grad: 3.0, map: 13.0, fio2: 60.0, pao2: 88.0, oi: 8.9, ino: 20.0, methb: 1.4, no2: 0.2, bpMap: 52.0, is: 5.0, notes: 'Dramatic positive response to iNO: OI dropped from 27.9 to 8.9. FiO2 successfully weaned to 60%. Ductal gradient resolved to 3%.' },
    ];
    for (const pl of pphnLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_pphn_flowsheet_logs (
          pphn_episode_id, patient_id, log_datetime, hours_from_onset,
          preductal_spo2, postductal_spo2, spo2_gradient,
          map_cmh2o, fio2_percent, pao2_mmhg, calculated_oi,
          ino_dose_ppm, methemoglobin_percent, circuit_no2_ppm,
          mean_arterial_pressure_mmhg, inotropic_score, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:30:00', ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingPphn.id, babyId, pl.h, pl.pre, pl.post, pl.grad, pl.map, pl.fio2, pl.pao2, pl.oi, pl.ino, pl.methb, pl.no2, pl.bpMap, pl.is, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 20B: Obstetric Amniotic Fluid Embolism (AFE) Emergency Clark Staging & A-OK Resuscitation ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_afe_episodes (
      patient_id, admission_id, episode_code, arrest_onset_datetime,
      gestation_weeks, timing_relation,
      cardiorespiratory_collapse, overt_dic_present, absence_of_fever, clark_criteria_met,
      atropine_given, ondansetron_given, ketorolac_given, aok_regimen_complete,
      fibrinogen_mg_dl, platelet_count, pt_inr,
      mtp_activated, prbc_transfused_units, ffp_transfused_units, platelets_transfused_units, cryoprecipitate_units,
      pmcd_performed, pmcd_decision_to_delivery_minutes, ecmo_initiated,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'AFE-20261107-101', '2026-11-07T08:15:00',
      38.5, 'cesarean_delivery',
      1, 1, 1, 1,
      1, 1, 1, 1,
      88.0, 52000, 2.3,
      1, 4, 4, 1, 10,
      1, 3.5, 0,
      'post_cardiac_arrest_icu', ?,
      'Catastrophic sudden cardiorespiratory collapse during emergent cesarean delivery meeting all 4 Clark Criteria for Amniotic Fluid Embolism (cardiorespiratory arrest, overt consumptive coagulopathy with fibrinogen 88 mg/dL, onset during delivery, absence of maternal fever). Immediate perimortem cesarean delivery (PMCD) performed with incision-to-delivery 3.5 min. A-OK regimen administered (Atropine 1mg, Ondansetron 8mg, Ketorolac 30mg IV). Massive Transfusion Protocol activated with 10 units cryoprecipitate. ROSC achieved after 6 minutes CPR. Transferred to ICU with arterial line and TEE monitoring.',
      ?, ?
    )
  `).run(sunitaId, docId, now, now);

  const existingAfe = db.prepare('SELECT id FROM obstetric_afe_episodes WHERE episode_code = ?').get('AFE-20261107-101') as { id: number } | undefined;
  if (existingAfe) {
    const afeLogs = [
      { min: 5.0, sbp: 62, dbp: 30, hr: 145, spo2: 78.0, etco2: 12.0, vaso: 'epinephrine', fib: 88.0, plt: 52000, inr: 2.3, qbl: 1800.0, notes: 'CPR in progress, PMCD delivering neonate. Epinephrine bolus given. A-OK triple protocol administered.' },
      { min: 20.0, sbp: 98, dbp: 58, hr: 108, spo2: 95.0, etco2: 32.0, vaso: 'norepinephrine', fib: 145.0, plt: 85000, inr: 1.5, qbl: 2100.0, notes: 'ROSC confirmed. ETCO2 increased to 32 mmHg. Norepinephrine infusion running. Cryoprecipitate 10 units infused; surgical hemostasis secured.' },
    ];
    for (const al of afeLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_afe_flowsheet_logs (
          afe_episode_id, patient_id, log_datetime, minutes_from_arrest,
          sbp_mmhg, dbp_mmhg, hr_bpm, spo2_percent, etco2_mmhg,
          vasopressor_active, fibrinogen_mg_dl, platelet_count, inr,
          qbl_total_ml, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:35:00', ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingAfe.id, sunitaId, al.min, al.sbp, al.dbp, al.hr, al.spo2, al.etco2, al.vaso, al.fib, al.plt, al.inr, al.qbl, al.notes, nurseId, now);
    }
  }

  // --- SERIES 20C: Pediatric Status Asthmaticus & Modified Wood's Clinical Asthma Score (M-WCAS) ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_asthma_status_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      age_months, weight_kg, spo2_room_air_percent,
      wheezing_score, retractions_score, air_entry_score, mental_state_score,
      total_mwcas_score, severity_tier,
      tier1_continuous_albuterol, tier1_ipratropium, tier1_systemic_steroids,
      tier2_iv_magnesium, tier3_iv_terbutaline, tier4_respiratory_support,
      vbg_ph, vbg_pco2_mmhg,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'ASTHMA-20261107-101', '2026-11-07T08:00:00',
      18, 11.5, 87.0,
      2, 2, 2, 2,
      8, 'severe_impending_failure_7_10',
      1, 1, 1,
      1, 1, 'bipap_nippv',
      7.26, 44.0,
      'picu_monitoring', ?,
      '18-month-old male presenting in severe status asthmaticus with impending respiratory failure (M-WCAS score 8/10, room air SpO2 87%, severe retractions, quiet chest with poor air entry, lethargy). VBG demonstrates respiratory acidosis with pseudonormal pCO2 (44 mmHg in a child breathing at 68/min), signaling diaphragmatic exhaustion. Admitted to PICU; initiated Continuous Albuterol 10 mg/hr, IV Dexamethasone 0.6 mg/kg, IV Magnesium Sulfate 50 mg/kg (575 mg) over 30 min, IV Terbutaline loading and infusion (0.4 mcg/kg/min), and BiPAP NIPPV support (IPAP 12, EPAP 6).',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingAsthma = db.prepare('SELECT id FROM pediatric_asthma_status_episodes WHERE episode_code = ?').get('ASTHMA-20261107-101') as { id: number } | undefined;
  if (existingAsthma) {
    const asthmaLogs = [
      { min: 15, rr: 68, hr: 172, spo2: 89.0, fio2: 40.0, mwcas: 8, alb: 10.0, terb: 0.4, bipap: 'IPAP 12 / EPAP 6 cmH2O', ph: 7.26, pco2: 44.0, notes: 'PICU admission. Tier 1-3 escalated. BiPAP applied with immediate relief of accessory muscle retraction.' },
      { min: 60, rr: 46, hr: 148, spo2: 96.0, fio2: 30.0, mwcas: 4, alb: 10.0, terb: 0.4, bipap: 'IPAP 10 / EPAP 5 cmH2O', ph: 7.35, pco2: 38.0, notes: 'Marked clinical improvement: M-WCAS improved from 8 to 4. Bilateral air entry restored, alert and interacting with mother.' },
    ];
    for (const al of asthmaLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_asthma_status_flowsheet_logs (
          asthma_episode_id, patient_id, log_datetime, minutes_from_triage,
          respiratory_rate, heart_rate, spo2_percent, fio2_percent,
          total_mwcas_score, albuterol_rate_mg_hr, terbutaline_rate_mcg_kg_min,
          bipap_settings, vbg_ph, vbg_pco2_mmhg, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T08:45:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `).run(existingAsthma.id, aaravId, al.min, al.rr, al.hr, al.spo2, al.fio2, al.mwcas, al.alb, al.terb, al.bipap, al.ph, al.pco2, al.notes, nurseId, now);
    }
  }

  // --- SERIES 21A: Neonatal Bronchopulmonary Dysplasia (BPD) & Jensen 2019 Staging ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_bpd_episodes (
      patient_id, admission_id, episode_code, evaluation_datetime,
      gestational_age_weeks, birth_weight_grams, current_pma_weeks,
      respiratory_support_type, cannula_flow_lpm, fio2_percent,
      jensen_bpd_grade, caffeine_therapy_active, diuretic_therapy_active,
      postnatal_steroids_active, steroid_regimen, home_oxygen_planned,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'BPD-20261107-101', '2026-11-07T10:00:00',
      27.0, 890, 36.0,
      'nasal_cannula_low_flow', 1.0, 25.0,
      'grade_1', 1, 0,
      0, NULL, 1,
      'inpatient_respiratory_care', ?,
      'Born 27+0w, now 36w PMA. Weaned from CPAP to low-flow nasal cannula 1.0 L/min. Target SpO2 91-95% achieved. Preparing for home oxygen weaning.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingBpd = db.prepare('SELECT id FROM neonatal_bpd_episodes WHERE episode_code = ?').get('BPD-20261107-101') as { id: number } | undefined;
  if (existingBpd) {
    const bpdLogs = [
      { pma: 36.0, supp: 'nasal_cannula_low_flow', flow: 1.0, fio2: 25.0, spo2: 93.0, inRange: 1, apnea: 0, wt: 1950, notes: 'Initiated 36w PMA evaluation. Target SpO2 91-95% maintained.' },
      { pma: 36.2, supp: 'nasal_cannula_low_flow', flow: 0.5, fio2: 21.0, spo2: 94.0, inRange: 1, apnea: 0, wt: 2010, notes: 'Successful reduction to 0.5 L/min at FiO2 21%. Retractions minimal.' },
    ];
    for (const bl of bpdLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_bpd_flowsheet_logs (
          bpd_episode_id, patient_id, log_datetime, pma_weeks,
          respiratory_support, flow_lpm, fio2_percent, spo2_percent,
          target_spo2_in_range, apnea_bradycardia_episodes_24h,
          weight_grams, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T12:00:00', ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingBpd.id, babyId, bl.pma, bl.supp, bl.flow, bl.fio2, bl.spo2, bl.inRange, bl.apnea, bl.wt, bl.notes, nurseId, now);
    }
  }

  // --- SERIES 21B: Obstetric Acute Fatty Liver of Pregnancy (AFLP) & Swansea Staging ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_aflp_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      gestation_weeks,
      vomiting_present, abdominal_pain_present, polydipsia_polyuria_present, encephalopathy_present,
      elevated_bilirubin, hypoglycemia_present, elevated_urate, leukocytosis_present,
      ascites_or_bright_liver, elevated_transaminases, elevated_ammonia, renal_impairment,
      coagulopathy_present, microvesicular_steatosis_biopsy,
      total_swansea_criteria_met, aflp_confirmed,
      serum_glucose_mg_dl, serum_bilirubin_total_mg_dl, ast_u_l, alt_u_l,
      serum_creatinine_mg_dl, pt_seconds, inr,
      dextrose_infusion_active, delivery_urgency, delivery_performed,
      lchad_newborn_screening_alert, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'AFLP-20261107-101', '2026-11-07T11:00:00',
      36.2,
      1, 1, 0, 0,
      1, 1, 1, 1,
      1, 1, 1, 0,
      1, 0,
      10, 1,
      52.0, 2.4, 220.0, 198.0,
      1.4, 16.5, 1.4,
      1, 'immediate_emergent_delivery', 0,
      1, 'active_critical_resuscitation', ?,
      'Primigravida at 36w with intractable vomiting, hypoglycemia 52 mg/dL, and coagulopathy. 10/14 Swansea criteria positive. D10W active. Emergent delivery planned.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingAflp = db.prepare('SELECT id FROM obstetric_aflp_episodes WHERE episode_code = ?').get('AFLP-20261107-101') as { id: number } | undefined;
  if (existingAflp) {
    const aflpLogs = [
      { h: 0.0, glu: 52.0, rate: 100.0, conc: 10.0, sbp: 128, dbp: 82, hr: 92, enc: 0, uo: 40.0, notes: 'Hypoglycemia identified on point-of-care test. D10W bolus and 100 mL/hr continuous infusion started.' },
      { h: 2.0, glu: 78.0, rate: 100.0, conc: 10.0, sbp: 122, dbp: 76, hr: 86, enc: 0, uo: 55.0, notes: 'Blood glucose stabilized at 78 mg/dL. MDT cesarean delivery scheduled in OR 2.' },
    ];
    for (const al of aflpLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_aflp_flowsheet_logs (
          aflp_episode_id, patient_id, log_datetime, hours_from_diagnosis,
          blood_glucose_mg_dl, dextrose_infusion_rate_ml_hr, dextrose_concentration_percent,
          sbp_mmhg, dbp_mmhg, hr_bpm, encephalopathy_grade, urine_output_ml_hr,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T12:00:00', ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingAflp.id, anitaId, al.h, al.glu, al.rate, al.conc, al.sbp, al.dbp, al.hr, al.enc, al.uo, al.notes, nurseId, now);
    }
  }

  // --- SERIES 21C: Pediatric Polytrauma Resuscitation & Pediatric Trauma Score (PTS) ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_polytrauma_episodes (
      patient_id, admission_id, episode_code, trauma_datetime,
      age_months, weight_kg, trauma_mechanism,
      weight_score, airway_score, systolic_bp_score, cns_score,
      skeletal_score, cutaneous_score, total_pts_score, pts_mortality_tier,
      fast_exam_positive, pelvic_binder_placed, txa_administered, txa_dose_mg,
      pediatric_mtp_activated, prbc_volume_ml, ffp_volume_ml, platelets_volume_ml,
      initial_gcs, initial_sbp, initial_heart_rate,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'TRAUMA-20261107-101', '2026-11-07T09:30:00',
      66, 18.5, 'motor_vehicle_collision',
      1, 1, 1, 1,
      1, 1, 6, 'critical_high_mortality_le_8',
      1, 0, 1, 370.0,
      1, 200.0, 200.0, 200.0,
      11, 80, 155,
      'acute_trauma_bay', ?,
      'Pedestrian vs automobile with closed femur deformity and positive FAST exam (splenic blush). PTS 6 mandates Level 1 trauma resuscitation. TXA & MTP 1:1:1 initiated.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingTrauma = db.prepare('SELECT id FROM pediatric_polytrauma_episodes WHERE episode_code = ?').get('TRAUMA-20261107-101') as { id: number } | undefined;
  if (existingTrauma) {
    const traumaLogs = [
      { min: 10, gcs: 11, sbp: 80, dbp: 48, hr: 158, rr: 34, spo2: 96.0, temp: 36.5, crys: 370.0, prbc: 0.0, ffp: 0.0, plt: 0.0, uo: 0.8, pupil: 'equal_reactive', notes: 'Initial 20 mL/kg Plasmalyte bolus infused. TXA 370 mg IV given over 10 min.' },
      { min: 25, gcs: 12, sbp: 94, dbp: 56, hr: 136, rr: 26, spo2: 99.0, temp: 36.7, crys: 370.0, prbc: 200.0, ffp: 200.0, plt: 0.0, uo: 1.4, pupil: 'equal_reactive', notes: 'Blood pressure improved post 1st MTP PRBC+FFP cycle. FAST re-check stable. CT scan arranged.' },
    ];
    for (const tl of traumaLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_polytrauma_flowsheet_logs (
          polytrauma_episode_id, patient_id, log_datetime, minutes_from_arrival,
          gcs_total, sbp_mmhg, dbp_mmhg, heart_rate_bpm, respiratory_rate,
          spo2_percent, temperature_celsius, cumulative_crystalloid_ml,
          cumulative_prbc_ml, cumulative_ffp_ml, cumulative_platelets_ml,
          urine_output_ml_kg_hr, pupil_status, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-07T09:45:00', ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingTrauma.id, aaravId, tl.min, tl.gcs, tl.sbp, tl.dbp, tl.hr, tl.rr, tl.spo2, tl.temp, tl.crys, tl.prbc, tl.ffp, tl.plt, tl.uo, tl.pupil, tl.notes, nurseId, now);
    }
  }

  // --- SERIES 22A: Neonatal Hemodynamically Significant Patent Ductus Arteriosus (hsPDA) ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_hspda_episodes (
      patient_id, admission_id, episode_code, echo_datetime,
      gestational_age_weeks, birth_weight_grams, chronological_age_days, current_weight_grams,
      ductal_diameter_mm, ductal_velocity_vmax_ms, shunt_direction,
      la_ao_ratio, lpa_diastolic_velocity_ms, descending_aorta_diastolic_flow,
      cardiomegaly_present, pulmonary_edema_present, bounding_pulses,
      hypotension_wide_pulse_pressure, metabolic_acidosis, oliguria_present,
      respiratory_support_escalation, mcnamara_echo_stage, mcnamara_clinical_stage,
      hspda_confirmed, pharmacotherapy_selected, paracetamol_rationale,
      contraindications_present, interventional_referral, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PDA-20261108-101', '2026-11-08T09:00:00',
      26.5, 820, 5, 840,
      2.4, 1.4, 'left_to_right',
      1.65, 0.32, 'retrograde_steal',
      1, 1, 1,
      1, 0, 0,
      1, 'stage_3_severe', 'stage_3_severe',
      1, 'iv_paracetamol', 'Platelets 42,000/uL and borderline creatinine contraindicate NSAIDs (Ibuprofen/Indomethacin).',
      1, 'none', 'medical_therapy_active', ?,
      'Born 26+5w. Echo shows large PDA 2.4 mm with holodiastolic reversal in descending aorta and LA:Ao 1.65. Initiated IV Paracetamol 15 mg/kg q6h due to severe thrombocytopenia.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingPda = db.prepare('SELECT id FROM neonatal_hspda_episodes WHERE episode_code = ?').get('PDA-20261108-101') as { id: number } | undefined;
  if (existingPda) {
    const pdaLogs = [
      { h: 2.0, hr: 158, sbp: 60, dbp: 26, map: 37, pp: 34, supp: 'HFOV', fio2: 35.0, spo2: 93.0, uo: 1.5, cr: 0.9, plt: 42000, notes: 'Paracetamol dose 1 infused over 15 min. Mild precordial hyperactivity noted.' },
      { h: 6.0, hr: 152, sbp: 64, dbp: 30, map: 41, pp: 34, supp: 'HFOV', fio2: 30.0, spo2: 95.0, uo: 1.8, cr: 0.85, plt: 45000, notes: 'FiO2 successfully reduced from 35% to 30%. Urine output reassuring at 1.8 mL/kg/h.' },
    ];
    for (const pl of pdaLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_hspda_flowsheet_logs (
          hspda_episode_id, patient_id, log_datetime, hours_from_initiation,
          heart_rate_bpm, sbp_mmhg, dbp_mmhg, map_mmhg, pulse_pressure_mmhg,
          respiratory_support_type, fio2_percent, spo2_percent,
          urine_output_ml_kg_hr, serum_creatinine_mg_dl, platelet_count,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T11:00:00', ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingPda.id, babyId, pl.h, pl.hr, pl.sbp, pl.dbp, pl.map, pl.pp, pl.supp, pl.fio2, pl.spo2, pl.uo, pl.cr, pl.plt, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 22B: Obstetric Diabetic Ketoacidosis (DKA) & Euglycemic DKA Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_dka_episodes (
      patient_id, admission_id, episode_code, presentation_datetime,
      gestation_weeks, diabetes_type, precipitating_trigger,
      blood_glucose_mg_dl, is_euglycemic_dka, arterial_or_venous_ph,
      serum_bicarbonate_meq_l, serum_ketones_beta_ohb_mmol_l, urine_ketones,
      serum_sodium_meq_l, serum_potassium_meq_l, serum_chloride_meq_l,
      calculated_anion_gap, corrected_sodium_meq_l, effective_osmolality_mosm_kg,
      fetal_heart_rate_baseline_bpm, fetal_variability, decelerations_present, efm_category,
      intrauterine_resuscitation_advisement, dka_severity_tier,
      insulin_infusion_rate_units_hr, dextrose_added_to_fluids, status,
      consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'OBDKA-20261108-101', '2026-11-08T09:30:00',
      31.5, 'pregestational_type1', 'infection_sepsis',
      175.0, 1, 7.22,
      11.0, 4.8, '3_plus',
      137.0, 4.1, 104.0,
      22.0, 138.2, 283.7,
      155, 'minimal', 'late', 'category_2_indeterminate',
      'DO NOT PERFORM IMMEDIATE CESAREAN DELIVERY FOR ABNORMAL FHR DURING ACUTE DKA: Fetal decelerations, tachycardia, and loss of variability reflect maternal acidemia and dehydration. Intrauterine resuscitation via maternal hydration, insulin, left lateral decubitus, and oxygen will restore reassuring fetal status.',
      'moderate',
      3.4, 1, 'euglycemic_dextrose_infusion', ?,
      'Euglycemic DKA presenting at 31+4w with pyelonephritis/sepsis. POC glucose 175 mg/dL, pH 7.22, HCO3 11 mEq/L, Anion gap 22. D5W with 0.45% NS started with continuous regular insulin 3.4 U/hr.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingObDka = db.prepare('SELECT id FROM obstetric_dka_episodes WHERE episode_code = ?').get('OBDKA-20261108-101') as { id: number } | undefined;
  if (existingObDka) {
    const dkaLogs = [
      { h: 1.0, glu: 170.0, rate: 3.4, fluid: 'd5_half_normal_saline', fluidRate: 250.0, ph: 7.24, hco3: 12.0, gap: 21.0, k: 4.0, kcl: 20.0, fhr: 150, fhrVar: 'minimal', sbp: 118, dbp: 74, hr: 98, uo: 45.0, notes: 'Initiated intrauterine resuscitation: left lateral positioning, O2 via face mask. Glucose stable.' },
      { h: 3.0, glu: 160.0, rate: 3.4, fluid: 'd5_half_normal_saline', fluidRate: 250.0, ph: 7.29, hco3: 15.0, gap: 17.0, k: 4.1, kcl: 20.0, fhr: 144, fhrVar: 'normal_moderate', sbp: 120, dbp: 76, hr: 88, uo: 60.0, notes: 'Anion gap closing (17 mEq/L). FHR baseline normalized to 144 bpm with return of moderate variability. Late decelerations resolved.' },
    ];
    for (const dl of dkaLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_dka_flowsheet_logs (
          dka_episode_id, patient_id, log_datetime, hours_from_presentation,
          blood_glucose_mg_dl, insulin_rate_units_hr, iv_fluid_type, iv_fluid_rate_ml_hr,
          vbg_ph, serum_bicarbonate_meq_l, calculated_anion_gap,
          serum_potassium_meq_l, potassium_replacement_meq_l,
          fhr_baseline_bpm, fhr_variability, fhr_decelerations,
          maternal_sbp_mmhg, maternal_dbp_mmhg, maternal_hr_bpm,
          urine_output_ml_hr, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T11:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, 'none',
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingObDka.id, anitaId, dl.h, dl.glu, dl.rate, dl.fluid, dl.fluidRate, dl.ph, dl.hco3, dl.gap, dl.k, dl.kcl, dl.fhr, dl.fhrVar, dl.sbp, dl.dbp, dl.hr, dl.uo, dl.notes, nurseId, now);
    }
  }

  // --- SERIES 22C: Pediatric Anaphylaxis Emergency Resuscitation & Refractory Shock ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_anaphylaxis_episodes (
      patient_id, admission_id, episode_code, triage_datetime,
      age_months, weight_kg, trigger_type, trigger_details,
      skin_mucosal_involvement, respiratory_compromise, cardiovascular_hypotension,
      persistent_gastrointestinal, anaphylaxis_criteria_met, severity_tier,
      weight_adjusted_epinephrine_im_dose_mg, autoinjector_recommended,
      im_epinephrine_doses_given, epinephrine_first_dose_datetime, epinephrine_second_dose_datetime,
      refractory_shock_declared, iv_epinephrine_infusion_active, epinephrine_infusion_rate_mcg_kg_min,
      second_line_h1_antihistamine_given, second_line_h2_antihistamine_given,
      systemic_steroid_given, glucagon_administered, fluid_bolus_volume_ml,
      biphasic_surveillance_recommended_hours, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'ANAPH-20261108-101', '2026-11-08T10:00:00',
      60, 18.0, 'food_peanut_nut_milk_egg', 'Ingestion of peanut-containing snack at preschool.',
      1, 1, 0,
      1, 1, 'mild_moderate',
      0.18, 'epipen_jr_0_15mg',
      1, '2026-11-08T10:05:00', NULL,
      0, 0, NULL,
      1, 0,
      1, 0, 360.0,
      6, 'biphasic_surveillance_observation', ?,
      '5yo male presented with generalized urticaria, wheezing, and vomiting within 15 min of eating peanut snack. WAO criteria met. IM Epinephrine 0.18 mg given in right vastus lateralis. Rapid clinical recovery.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingAnaph = db.prepare('SELECT id FROM pediatric_anaphylaxis_episodes WHERE episode_code = ?').get('ANAPH-20261108-101') as { id: number } | undefined;
  if (existingAnaph) {
    const anaphLogs = [
      { min: 10, sbp: 92, dbp: 54, hr: 128, rr: 28, spo2: 96.0, stridor: 0, wheeze: 'moderate', urticaria: 'generalized', epiIv: null, imDoses: 1, crys: 360.0, notes: 'IM Epinephrine 0.18 mg injected right mid-thigh. Normal saline 360 mL bolus infusing. Placed supine with legs elevated.' },
      { min: 30, sbp: 96, dbp: 58, hr: 110, rr: 22, spo2: 99.0, stridor: 0, wheeze: 'none', urticaria: 'localized', epiIv: null, imDoses: 1, crys: 360.0, notes: 'Wheeze cleared, urticaria fading. Child interactive and asking for water. Initiating 6-hour biphasic surveillance.' },
    ];
    for (const anl of anaphLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_anaphylaxis_flowsheet_logs (
          anaphylaxis_episode_id, patient_id, log_datetime, minutes_from_arrival,
          sbp_mmhg, dbp_mmhg, heart_rate_bpm, respiratory_rate, spo2_percent,
          stridor_present, wheeze_severity, urticaria_coverage,
          epinephrine_iv_rate_mcg_kg_min, cumulative_im_epinephrine_doses,
          cumulative_crystalloid_ml, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T10:15:00', ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingAnaph.id, aaravId, anl.min, anl.sbp, anl.dbp, anl.hr, anl.rr, anl.spo2, anl.stridor, anl.wheeze, anl.urticaria, anl.epiIv, anl.imDoses, anl.crys, anl.notes, nurseId, now);
    }
  }

  // --- SERIES 23A: Neonatal Intraventricular Hemorrhage (IVH) & Levene PHH Surveillance ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_ivh_episodes (
      patient_id, admission_id, episode_code, scan_datetime,
      gestational_age_weeks, birth_weight_grams, chronological_age_days, current_pma_weeks,
      cranial_ultrasound_indication, papile_grade, hemorrhage_laterality, parenchymal_infarction_location,
      ventricular_index_left_mm, ventricular_index_right_mm, anterior_horn_width_left_mm, anterior_horn_width_right_mm,
      thalamo_occipital_distance_mm, resistive_index_aca,
      head_circumference_cm, head_circumference_growth_cm_week,
      levene_97th_percentile_mm, levene_action_line_threshold_mm, phh_intervention_threshold_crossed,
      intervention_status, lumbar_puncture_performed, csf_protein_g_l, csf_rbc_count,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'IVH-20261108-101', '2026-11-08T08:00:00',
      27.0, 920.0, 14, 29.0,
      'Routine day 14 screening ultrasound in extremely low birth weight premature infant',
      'grade_3_intraventricular_dilatation', 'bilateral', NULL,
      16.5, 16.8, 7.2, 7.0,
      28.5, 0.86,
      26.4, 2.1,
      12.2, 16.2, 1,
      'ventricular_access_device_reservoir', 1, 2.6, 12000,
      'phh_active_decompression', ?,
      'Davies action line crossed (+4.6 mm above 97th centile). ELVIS trial criteria met. Subcutaneous Rickham reservoir placed for serial CSF taps.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingIvh = db.prepare('SELECT id FROM neonatal_ivh_episodes WHERE episode_code = ?').get('IVH-20261108-101') as { id: number } | undefined;
  if (existingIvh) {
    const ivhLogs = [
      { d: 1.0, vi: 15.2, ahw: 6.2, hc: 26.5, font: 'full' as const, split: 1, apneas: 2, csf: 12.0, ri: 0.78, notes: 'Reservoir aspirated 12 mL clear xanthochromic CSF under strict aseptic precautions.' },
      { d: 3.0, vi: 14.5, ahw: 5.6, hc: 26.6, font: 'normal_soft' as const, split: 0, apneas: 0, csf: 11.5, ri: 0.72, notes: 'Fontanelle soft, apneas ceased. Ventricular decompression sustained.' },
    ];
    for (const il of ivhLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_ivh_flowsheet_logs (
          ivh_episode_id, patient_id, log_datetime, days_from_baseline,
          ventricular_index_mm, anterior_horn_width_mm, head_circumference_cm,
          fontanelle_tension, split_cranial_sutures, apneic_episodes_24h,
          csf_volume_tapped_ml, resistive_index_aca, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T09:30:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingIvh.id, babyId, il.d, il.vi, il.ahw, il.hc, il.font, il.split, il.apneas, il.csf, il.ri, il.notes, nurseId, now);
    }
  }

  // --- SERIES 23B: Obstetric Preterm Premature Rupture of Membranes (PPROM) & Triple I ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_pprom_episodes (
      patient_id, admission_id, episode_code, rupture_datetime, presentation_datetime,
      gestation_weeks, rupture_confirmation_method, amniotic_fluid_index_cm, single_deepest_pocket_cm,
      latency_antibiotics_initiated, latency_antibiotic_regimen, antenatal_corticosteroid_status,
      mgso4_neuroprotection_active, gbs_screening_status,
      maternal_temperature_celsius, maternal_heart_rate_bpm, fetal_heart_rate_bpm,
      uterine_tenderness, foul_cervical_discharge, maternal_wbc_per_ul,
      triple_i_category, delivery_timing_plan, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PPROM-20261108-101', '2026-11-08T04:30:00', '2026-11-08T06:00:00',
      29.3, 'pooling_ferning_nitrazine', 3.8, 1.6,
      1, 'ampicillin_erythromycin_standard', 'course_initiated',
      0, 'unknown',
      36.8, 78, 138,
      0, 0, 9600,
      'no_infection_uncomplicated', 'expectant_management_to_34w', 'inpatient_latency_surveillance', ?,
      'Sterile speculum confirmed pooling and ferning. AFI 3.8 cm (oligohydramnios). 7-day latency antibiotics and Betamethasone dose 1 initiated.',
      ?, ?
    )
  `).run(sunitaId, docId, now, now);

  const existingPprom = db.prepare('SELECT id FROM obstetric_pprom_episodes WHERE episode_code = ?').get('PPROM-20261108-101') as { id: number } | undefined;
  if (existingPprom) {
    const ppromLogs = [
      { h: 6.0, temp: 36.9, hr: 80, sbp: 116, dbp: 72, fhr: 140, ctx: 0, fluid: 'clear' as const, wbc: 9800, ctg: 'category_1_normal' as const, notes: 'Afebrile, maternal vital signs stable. Continuous fetal heart monitoring shows baseline 140 bpm, moderate variability.' },
      { h: 12.0, temp: 37.0, hr: 82, sbp: 120, dbp: 74, fhr: 142, ctx: 0, fluid: 'clear' as const, wbc: 10100, ctg: 'category_1_normal' as const, notes: 'No uterine tenderness or contractions. Betamethasone 12 mg IM dose 1 completed.' },
    ];
    for (const ppl of ppromLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_pprom_flowsheet_logs (
          pprom_episode_id, patient_id, log_datetime, hours_from_admission,
          maternal_temp_c, maternal_hr_bpm, maternal_bp_sbp, maternal_bp_dbp,
          fetal_hr_bpm, uterine_contractions_per_10min, amniotic_fluid_character,
          maternal_wbc, ctg_category, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T12:00:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingPprom.id, sunitaId, ppl.h, ppl.temp, ppl.hr, ppl.sbp, ppl.dbp, ppl.fhr, ppl.ctx, ppl.fluid, ppl.wbc, ppl.ctg, ppl.notes, nurseId, now);
    }
  }

  // --- SERIES 23C: Pediatric Supraventricular Tachycardia (SVT) & PALS Emergency Resuscitation ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_svt_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      age_months, weight_kg, heart_rate_bpm, qrs_duration_ms,
      qrs_morphology, rhythm_regularity, p_waves_identifiable, svt_confirmed,
      hemodynamic_stability, signs_of_shock,
      vagal_maneuver_attempted, vagal_maneuver_successful,
      adenosine_first_dose_mg, adenosine_first_dose_given, adenosine_first_dose_successful,
      adenosine_second_dose_mg, adenosine_second_dose_given, adenosine_second_dose_successful,
      synchronized_cardioversion_joules, synchronized_cardioversion_delivered, cardioversion_successful,
      maintenance_antiarrhythmic, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'SVT-20261108-101', '2026-11-08T09:00:00',
      8, 8.5, 245, 68,
      'narrow_complex_le_0_09s', 'regular', 0, 1,
      'stable_compensated', 'none',
      'ice_bag_to_face_infant', 0,
      0.85, 1, 1,
      1.70, 0, 0,
      9.0, 0, 0,
      'oral_propranolol', 'converted_sinus_surveillance', ?,
      'Infant presented with irritability and poor feeding. ECG revealed narrow complex SVT at 245 bpm without visible P waves. Vagal ice slurry attempted without conversion. Adenosine 0.85 mg rapid IV push restored sinus rhythm at 125 bpm.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingSvt = db.prepare('SELECT id FROM pediatric_svt_episodes WHERE episode_code = ?').get('SVT-20261108-101') as { id: number } | undefined;
  if (existingSvt) {
    const svtLogs = [
      { min: 5, hr: 245, rhythm: 'svt_active' as const, sbp: 82, dbp: 48, crt: 2.5, mental: 'irritable' as const, spo2: 97, intv: 'ice_bag_to_face' as const, notes: 'Ice bag to face applied for 15 seconds. Transient deceleration to 200 bpm then immediately returned to 245 bpm.' },
      { min: 12, hr: 125, rhythm: 'sinus_rhythm_restored' as const, sbp: 90, dbp: 54, crt: 1.5, mental: 'alert_normal' as const, spo2: 100, intv: 'adenosine_dose_1' as const, notes: 'Adenosine 0.85 mg rapid push via left antecubital IV with 10 mL saline flush. Brief 1.5s pause then normal sinus rhythm restored.' },
    ];
    for (const sl of svtLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_svt_flowsheet_logs (
          svt_episode_id, patient_id, log_datetime, minutes_from_triage,
          heart_rate_bpm, rhythm_state, sbp_mmhg, dbp_mmhg,
          capillary_refill_seconds, mental_status, spo2_percent,
          intervention_administered, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T09:15:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingSvt.id, aaravId, sl.min, sl.hr, sl.rhythm, sl.sbp, sl.dbp, sl.crt, sl.mental, sl.spo2, sl.intv, sl.notes, nurseId, now);
    }
  }

  // --- SERIES 24A: Neonatal Hypocalcemia, Hypomagnesemia & Electrolyte Emergencies ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_hypocalcemia_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      gestational_age_weeks, birth_weight_grams, chronological_age_hours, onset_timing,
      etiology_category, ionized_calcium_mmol_l, total_calcium_mg_dl, serum_magnesium_mg_dl,
      symptoms_present, symptom_details, ecg_qtc_seconds, ecg_prolonged_qtc,
      emergency_bolus_indicated, calcium_gluconate_10pct_bolus_ml, calcium_gluconate_maintenance_mg_kg_day,
      concurrent_hypomagnesemia, magnesium_sulfate_50pct_dose_ml,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'HYPOCAL-20261108-101', '2026-11-08T06:00:00',
      33, 1850, 30, 'early_onset_le_72h',
      'prematurity_respiratory_distress', 0.82, 6.3, 1.3,
      1, 'hypocalcemic_seizures', 0.49, 1,
      1, 3.6, 400.0,
      1, 0.36,
      'maintenance_infusion_weaning', ?,
      'Preterm neonate developed focal clonic seizures and jitteriness at 30h of life. Lab revealed ionized Ca 0.82 mmol/L and concurrent Mg 1.3 mg/dL. 10% Calcium Gluconate bolus (3.6 mL in D5W) given with continuous ECG bradycardia monitoring, followed by 50% MgSO4 (0.36 mL IM). Maintenance calcium infusion ongoing at 7.2 mL/day.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingHypocal = db.prepare('SELECT id FROM neonatal_hypocalcemia_episodes WHERE episode_code = ?').get('HYPOCAL-20261108-101') as { id: number } | undefined;
  if (existingHypocal) {
    const hypocalLogs = [
      { h: 0.5, hr: 144, ica: 0.95, tca: 6.9, mg: 1.5, rate: 0.3, iv: 'patent_no_extravasation' as const, neuro: 'mild_tremor_on_handling' as const, ecg: 'normal_sinus_rhythm' as const, notes: 'Infusion completed over 25 min with no bradycardia. Seizures ceased.' },
      { h: 4.0, hr: 138, ica: 1.12, tca: 7.8, mg: 1.8, rate: 0.3, iv: 'patent_no_extravasation' as const, neuro: 'normal_tone_calm' as const, ecg: 'normal_sinus_rhythm' as const, notes: 'Ionized calcium normalized to 1.12 mmol/L. Calm tone, feeding well via NG tube.' },
    ];
    for (const hl of hypocalLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_hypocalcemia_flowsheet_logs (
          hypocalcemia_episode_id, patient_id, log_datetime, hours_from_initiation,
          heart_rate_bpm, ionized_calcium_mmol_l, total_calcium_mg_dl, serum_magnesium_mg_dl,
          calcium_infusion_rate_ml_hr, iv_site_condition, clinical_neuromuscular_state,
          ecg_rhythm_strip, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingHypocal.id, babyId, hl.h, hl.hr, hl.ica, hl.tca, hl.mg, hl.rate, hl.iv, hl.neuro, hl.ecg, hl.notes, nurseId, now);
    }
  }

  // --- SERIES 24B: Obstetric Post-Term Pregnancy, Oligohydramnios & Bishop Cervical Ripening ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_postterm_episodes (
      patient_id, admission_id, episode_code, assessment_datetime,
      gestational_age_weeks, postterm_classification, dating_method,
      amniotic_fluid_index_cm, single_deepest_pocket_cm, oligohydramnios_present,
      estimated_fetal_weight_grams, fetal_growth_percentile, non_stress_test_result, biophysical_profile_score,
      cervical_dilation_cm, cervical_effacement_pct, fetal_station,
      cervical_consistency, cervical_position, bishop_score_total, cervix_favorable,
      prior_cesarean_section, recommended_ripening_method, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'POSTTERM-20261108-101', '2026-11-08T08:00:00',
      41.4, 'late_term_41_0_to_41_6', 'first_trimester_ultrasound_crl',
      4.6, 1.8, 1,
      3600, 60, 'reactive', 8,
      1.0, 30, -2,
      'firm', 'posterior', 2, 0,
      1, 'mechanical_foley_balloon', 'inpatient_cervical_ripening', ?,
      'Gravida 2 Para 1 at 41w 4d with previous lower segment Cesarean delivery. Ultrasound confirms oligohydramnios (AFI 4.6 cm, SDP 1.8 cm). Cervix unfavorable (Bishop 2/13). Due to prior uterine scar, all prostaglandins are strictly contraindicated. 16 Fr Foley catheter with 40 mL saline placed through internal os for mechanical cervical ripening under continuous CTG.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingPostterm = db.prepare('SELECT id FROM obstetric_postterm_episodes WHERE episode_code = ?').get('POSTTERM-20261108-101') as { id: number } | undefined;
  if (existingPostterm) {
    const posttermLogs = [
      { h: 3.0, b: 4, dil: 2.0, eff: 50, ctx: 1, fhr: 140, cat: 'category_1_normal' as const, tachy: 0, act: 'continue_monitoring' as const, notes: 'Foley traction maintained. FHR reactive, no decelerations.' },
      { h: 8.0, b: 8, dil: 4.0, eff: 75, ctx: 3, fhr: 144, cat: 'category_1_normal' as const, tachy: 0, act: 'balloon_expelled_ready_amniotomy' as const, notes: 'Foley catheter balloon spontaneously expelled. Cervix ripe at 4 cm, 75% effaced, station -1. Transferred to labor room for amniotomy.' },
    ];
    for (const pl of posttermLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_postterm_flowsheet_logs (
          postterm_episode_id, patient_id, log_datetime, hours_from_ripening_start,
          bishop_score_current, dilation_cm, effacement_pct,
          contractions_per_10min, fetal_heart_rate_bpm, fhr_category,
          tachysystole_present, action_taken, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T11:00:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingPostterm.id, anitaId, pl.h, pl.b, pl.dil, pl.eff, pl.ctx, pl.fhr, pl.cat, pl.tachy, pl.act, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 24C: Pediatric Croup (Laryngotracheobronchitis) & Westley Scoring ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_croup_episodes (
      patient_id, admission_id, episode_code, triage_datetime,
      age_months, weight_kg,
      inspiratory_stridor_score, retractions_score, air_entry_score, cyanosis_score, consciousness_score,
      westley_croup_score_total, croup_severity_tier,
      heart_rate_bpm, respiratory_rate, spo2_percent,
      barking_cough_present, hoarseness_present,
      dexamethasone_dose_mg, dexamethasone_route, dexamethasone_administered,
      nebulized_epinephrine_indicated, epinephrine_nebulization_dose_ml, epinephrine_nebulization_administered,
      rebound_observation_hours_required, status, consultant_id,
      clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'CROUP-20261108-101', '2026-11-08T07:30:00',
      20, 12.0,
      2, 2, 1, 0, 0,
      5, 'moderate_croup_score_3_to_5',
      145, 44, 95.0,
      1, 1,
      7.2, 'oral', 1,
      1, 5.0, 1,
      4, 'post_nebulization_observation', ?,
      'Toddler presented at 07:30 with classic barking seal-like cough, hoarseness, and resting inspiratory stridor with moderate subcostal retractions (Westley score 5/17, moderate croup). Single oral dose of Dexamethasone 7.2 mg (0.6 mg/kg) administered. Nebulized with 5.0 mL L-Epinephrine 1:1000 in 3 mL NS with blow-by oxygen. 4-hour post-nebulization observation initiated.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingCroup = db.prepare('SELECT id FROM pediatric_croup_episodes WHERE episode_code = ?').get('CROUP-20261108-101') as { id: number } | undefined;
  if (existingCroup) {
    const croupLogs = [
      { min: 30, score: 2, hr: 130, rr: 32, spo2: 98.0, stridor: 0, retr: 'mild_subcostal' as const, intv: 'nebulized_epinephrine_1' as const, notes: 'Rapid response to nebulized epinephrine. Stridor resolved at rest, only audible during active crying. Respiratory rate down from 44 to 32.' },
      { min: 120, score: 1, hr: 118, rr: 26, spo2: 99.0, stridor: 0, retr: 'none' as const, intv: 'none_observation' as const, notes: 'Two hours post-nebulization. No stridor rebound. Alert, drinking oral fluids comfortably with mother.' },
    ];
    for (const cl of croupLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_croup_flowsheet_logs (
          croup_episode_id, patient_id, log_datetime, minutes_from_triage,
          westley_score_current, heart_rate_bpm, respiratory_rate, spo2_percent,
          stridor_at_rest, chest_retractions_severity, intervention_given,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T08:00:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingCroup.id, aaravId, cl.min, cl.score, cl.hr, cl.rr, cl.spo2, cl.stridor, cl.retr, cl.intv, cl.notes, nurseId, now);
    }
  }

  // --- SERIES 25A: Neonatal Polycythemia, Hyperviscosity & Partial Exchange Transfusion (PET) ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_polycythemia_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      gestational_age_weeks, birth_weight_grams, chronological_age_hours, current_weight_kg,
      sampling_site, venous_hematocrit_pct, hemoglobin_g_dl, blood_volume_ml_kg, target_hematocrit_pct,
      symptoms_present, symptom_details, serum_glucose_mg_dl, platelet_count, serum_bilirubin_mg_dl,
      partial_exchange_indicated, exchange_volume_ml, aliquot_size_ml, replacement_fluid,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'POLYCYT-20261108-101', '2026-11-08T06:00:00',
      39.0, 3450, 12, 3.4,
      'peripheral_venous', 71.5, 23.8, 80.0, 55.0,
      1, 'plethora_ruddy_appearance', 42.0, 165000, 9.4,
      1, 62.7, 17.0, 'normal_saline_0_9',
      'pet_procedure_in_progress', ?,
      'Term male infant born to mother with GDM. At 12 hours of life noted to have ruddy, plethoric appearance and marked peripheral cyanosis. Peripheral venous sample confirmed hematocrit 71.5% with hypoglycemia (42 mg/dL). Partial exchange transfusion indicated (exchange volume 62.7 mL Normal Saline 0.9%). Divided into 4 aliquots of 17 mL each via umbilical venous catheter.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingPolycyt = db.prepare('SELECT id FROM neonatal_polycythemia_episodes WHERE episode_code = ?').get('POLYCYT-20261108-101') as { id: number } | undefined;
  if (existingPolycyt) {
    const polyLogs = [
      { h: 0.5, num: 1, w: 17.0, inf: 17.0, cum: 17.0, hct: 67.5, hr: 144, rr: 46, map: 48, cr: 2.0, glu: 46, notes: 'Aliquot #1 exchanged smoothly over 3 minutes. Vitals stable.' },
      { h: 1.0, num: 2, w: 17.0, inf: 17.0, cum: 34.0, hct: 63.0, hr: 138, rr: 42, map: 50, cr: 2.0, glu: 52, notes: 'Aliquot #2 completed. Good perfusion, pink peripheries.' },
    ];
    for (const pl of polyLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_polycythemia_flowsheet_logs (
          polycythemia_episode_id, patient_id, log_datetime, hours_from_triage,
          aliquot_number, volume_withdrawn_ml, volume_infused_ml, cumulative_exchanged_ml,
          current_hematocrit_pct, heart_rate_bpm, respiratory_rate, mean_arterial_pressure_mmhg,
          capillary_refill_seconds, blood_glucose_mg_dl, adverse_events_observed,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 'none',
          ?, ?, ?
        )
      `).run(existingPolycyt.id, babyId, pl.h, pl.num, pl.w, pl.inf, pl.cum, pl.hct, pl.hr, pl.rr, pl.map, pl.cr, pl.glu, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 25B: Obstetric Shoulder Dystocia & HELPERR Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_shoulder_dystocia_episodes (
      patient_id, admission_id, episode_code, delivery_datetime,
      maternal_age, gestational_age_weeks, estimated_fetal_weight_grams, actual_birth_weight_grams,
      gestational_diabetes, operative_vaginal_delivery,
      turtle_sign_observed, head_delivery_datetime, body_delivery_datetime, head_to_body_interval_seconds,
      help_called, episiotomy_performed, mcroberts_maneuver_success, suprapubic_pressure_success,
      internal_rotational_maneuver, internal_rotational_success, posterior_arm_delivery_success,
      gaskin_all_fours_success, advanced_maneuvers_required, fundal_pressure_avoided,
      apgar_1min, apgar_5min, apgar_10min, umbilical_arterial_ph,
      neonatal_injury, postpartum_hemorrhage_observed, perineal_tear_degree,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'DYSTOCIA-20261108-101', '2026-11-08T08:15:00',
      29, 40.2, 4150, 4220,
      1, 'spontaneous_vaginal',
      1, '2026-11-08T08:15:00', '2026-11-08T08:17:45', 165,
      1, 1, 0, 0,
      'rubin_ii', 0, 1,
      0, 'none', 1,
      6, 9, 10, 7.22,
      'none', 0, 'second_degree',
      'postpartum_hie_monitoring', ?,
      'Spontaneous vaginal vertex delivery complicated by shoulder dystocia with classic turtle sign. HELPERR protocol enacted immediately: Help called (pediatrics + second obstetrician), episiotomy extended, McRoberts hyperflexion and Rubin I suprapubic pressure applied. Posterior arm swept across chest and delivered at 165 seconds. Fundal pressure strictly avoided throughout. Infant cried after brief bag-mask ventilation, Apgar 6/9. Bilateral arm movements active.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingDystocia = db.prepare('SELECT id FROM obstetric_shoulder_dystocia_episodes WHERE episode_code = ?').get('DYSTOCIA-20261108-101') as { id: number } | undefined;
  if (existingDystocia) {
    const dysLogs = [
      { sec: 60, m: 'mcroberts_hyperflexion' as const, o: 'failed_advance_to_next_step' as const, trac: 'gentle_axial_traction_only' as const, notes: 'Maternal hips hyperflexed to abdomen. Persistent impaction.' },
      { sec: 165, m: 'delivery_posterior_arm' as const, o: 'successful_restitution_and_delivery' as const, trac: 'gentle_axial_traction_only' as const, notes: 'Posterior arm reached and swept across anterior chest wall. Full body delivery achieved at 2 min 45 sec.' },
    ];
    for (const dl of dysLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_shoulder_dystocia_flowsheet_logs (
          shoulder_dystocia_episode_id, patient_id, log_datetime, seconds_from_head_delivery,
          maneuver_attempted, maneuver_outcome, traction_applied,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T08:16:00', ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingDystocia.id, anitaId, dl.sec, dl.m, dl.o, dl.trac, dl.notes, nurseId, now);
    }
  }

  // --- SERIES 25C: Pediatric Foreign Body Airway Obstruction & Choking Emergency Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_foreign_body_episodes (
      patient_id, admission_id, episode_code, incident_datetime,
      age_months, weight_kg,
      witnessed_choking_episode, suspected_foreign_body_nature, obstruction_severity,
      stridor_or_aphonia, cyanosis_present, silent_chest_noted,
      heart_rate_bpm, respiratory_rate, spo2_percent,
      intervention_applied, blind_finger_sweep_avoided,
      foreign_body_expelled, spontaneous_respiration_restored,
      rigid_bronchoscopy_required, bronchoscopy_location,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'FBAO-20261108-101', '2026-11-08T10:15:00',
      14, 10.8,
      1, 'organic_food_nut_seed', 'severe_complete_ineffective_cough',
      1, 1, 0,
      152, 46, 88.0,
      'subdiaphragmatic_heimlich_child', 1,
      1, 1,
      0, 'none',
      'post_clearance_observation', ?,
      'Toddler brought by parents in acute respiratory distress following witnessed ingestion of roasted peanuts. Silent, aphonic, unable to cry, with perioral cyanosis and suprasternal retractions (complete obstruction). Subdiaphragmatic Heimlich thrusts performed in rapid sequence. Peanut half expelled on 3rd thrust. Spontaneous vigorous crying and respiration restored immediately. Blind finger sweeps strictly avoided. SpO2 improved from 88% to 99% on room air.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingFbao = db.prepare('SELECT id FROM pediatric_foreign_body_episodes WHERE episode_code = ?').get('FBAO-20261108-101') as { id: number } | undefined;
  if (existingFbao) {
    const fbaoLogs = [
      { min: 1, ms: 'alert_vocalizing' as const, ap: 'clear_normal_air_entry' as const, hr: 140, rr: 38, spo2: 97.0, cyc: 'subdiaphragmatic_heimlich_thrusts' as const, vis: 1, notes: 'Peanut expelled onto exam sheet. Crying loudly with good bilateral air entry.' },
      { min: 15, ms: 'alert_vocalizing' as const, ap: 'clear_normal_air_entry' as const, hr: 116, rr: 26, spo2: 99.0, cyc: 'reassurance_and_spontaneous_coughing' as const, vis: 0, notes: '15 minutes post-clearance. Stable vital signs, drinking water, no stridor or retractions.' },
    ];
    for (const fl of fbaoLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_foreign_body_flowsheet_logs (
          foreign_body_episode_id, patient_id, log_datetime, minutes_from_choking,
          mental_status, airway_patency, heart_rate_bpm, respiratory_rate, spo2_percent,
          intervention_cycle, foreign_object_visualized_or_removed,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T10:16:00', ?,
          ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `).run(existingFbao.id, aaravId, fl.min, fl.ms, fl.ap, fl.hr, fl.rr, fl.spo2, fl.cyc, fl.vis, fl.notes, nurseId, now);
    }
  }

  // --- SERIES 26A: Neonatal Hypomagnesemia & Refractory Seizures Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_hypomagnesemia_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      gestational_age_weeks, birth_weight_grams, chronological_age_hours, current_weight_kg,
      serum_magnesium_mg_dl, serum_calcium_mg_dl, ionized_calcium_mmol_l, serum_potassium_meq_l,
      neuromuscular_symptoms, seizures_observed, calcium_refractory_tetany, ecg_abnormalities,
      renal_impairment_present, magnesium_sulfate_bolus_ml, administration_route,
      continuous_ecg_monitored, status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'HYPOMAG-20261108-101', '2026-11-08T06:30:00',
      37.5, 2950, 36, 2.85,
      1.05, 6.8, 0.82, 4.2,
      'clonic_seizures_refractory', 1, 1, 'prolonged_pr_interval',
      0, 0.57, 'slow_iv_infusion',
      1, 'maintenance_infusion', ?,
      'Late preterm male infant at 36 hours of life developed focal clonic twitches progressing to multifocal refractory seizures. Initial IV 10% calcium gluconate failed to abort seizure activity (refractory hypocalcemia). Serum Mg confirmed 1.05 mg/dL. 50% MgSO4 (0.2 mL/kg = 0.57 mL) diluted to 1% and infused over 45 minutes under continuous ECG telemetry. Prompt cessation of convulsions observed post-bolus. Maintenance infusion 0.1 mL/kg/day started.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingHypomag = db.prepare('SELECT id FROM neonatal_hypomagnesemia_episodes WHERE episode_code = ?').get('HYPOMAG-20261108-101') as { id: number } | undefined;
  if (existingHypomag) {
    const hypomagLogs = [
      { h: 0, mg: 1.05, ica: 0.82, hr: 146, rr: 46, dtr: 'normal_2_plus' as const, sz: 1, inf: 0, ecg: 'pr_prolongation' as const, tox: 0, notes: 'Initiating slow IV infusion of diluted MgSO4 over 45 min. Rhythm shows PR interval 138 ms.' },
      { h: 2, mg: 1.58, ica: 1.05, hr: 138, rr: 42, dtr: 'normal_2_plus' as const, sz: 0, inf: 0.29, ecg: 'normal_sinus' as const, tox: 0, notes: 'Seizures ceased. Serum Mg recovered to 1.58 mg/dL. DTRs 2+ symmetric. PR interval normalized to 110 ms.' },
      { h: 6, mg: 1.75, ica: 1.15, hr: 132, rr: 38, dtr: 'normal_2_plus' as const, sz: 0, inf: 0.29, ecg: 'normal_sinus' as const, tox: 0, notes: 'Infant alert, feeding well via NG tube. No jitteriness or twitches. Patellar reflexes active 2+.' },
    ];
    for (const hl of hypomagLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_hypomagnesemia_flowsheet_logs (
          hypomagnesemia_episode_id, patient_id, log_datetime, hours_from_onset,
          serum_magnesium_mg_dl, ionized_calcium_mmol_l, heart_rate_bpm, respiratory_rate,
          deep_tendon_reflexes, seizure_activity_present, magnesium_infusion_rate_ml_hr,
          ecg_rhythm_strip, toxicity_warning, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingHypomag.id, babyId, hl.h, hl.mg, hl.ica, hl.hr, hl.rr, hl.dtr, hl.sz, hl.inf, hl.ecg, hl.tox, hl.notes, nurseId, now);
    }
  }

  // --- SERIES 26B: Obstetric Peripartum Cardiomyopathy (PPCM) & Acute Heart Failure Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_ppcm_episodes (
      patient_id, admission_id, episode_code, presentation_datetime,
      timing_category, maternal_age, gestational_age_weeks, days_postpartum,
      nyha_class, lvef_percent, lvedd_mm, nt_probnp_pg_ml, troponin_i_ng_ml,
      pulmonary_edema_present, cardiogenic_shock_present,
      bromocriptine_regimen, bromocriptine_initiated,
      anticoagulation_prescribed, anticoagulation_agent,
      loop_diuretic_given, beta_blocker_given, vasodilator_agent,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PPCM-20261108-101', '2026-11-08T05:00:00',
      'postpartum_first_month', 28, NULL, 7,
      'class_iv', 28.0, 59.0, 5420.0, 0.08,
      1, 0,
      'intensive_2_5mg_bid_2weeks_then_daily_6weeks', 1,
      1, 'lmwh_therapeutic',
      1, 1, 'hydralazine_nitrates_pregnancy_safe',
      'stabilized_on_board_protocol', ?,
      'Postpartum Day 7 presenting with acute orthopnea, paroxysmal nocturnal dyspnea, and bibasilar crackles. Bedside echocardiogram demonstrated severe LV systolic dysfunction (LVEF 28%, LVEDD 59mm, apical hypokinesis). NT-proBNP 5,420 pg/mL. ESC BOARD Protocol instituted: Intensive Bromocriptine (2.5 mg BID), therapeutic enoxaparin (1 mg/kg SC q12h), IV furosemide decongestion, low-dose carvedilol, and hydralazine/nitrates. Marked symptomatic stabilization.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingPpcm = db.prepare('SELECT id FROM obstetric_ppcm_episodes WHERE episode_code = ?').get('PPCM-20261108-101') as { id: number } | undefined;
  if (existingPpcm) {
    const ppcmLogs = [
      { h: 0, hr: 112, sbp: 142, dbp: 92, rr: 28, spo2: 91.0, o2: 4, uo: 35, fb: 0, pil: 3, inot: 'none' as const, notes: 'Severe orthopnea, bilateral coarse crepitations. IV Furosemide 40 mg given. Bromocriptine 2.5 mg initiated.' },
      { h: 4, hr: 88, sbp: 118, dbp: 74, rr: 18, spo2: 98.0, o2: 1, uo: 90, fb: -1200, pil: 2, inot: 'none' as const, notes: 'Good diuresis. Orthopnea improved significantly. Dyspnea at rest resolved.' },
      { h: 12, hr: 78, sbp: 112, dbp: 70, rr: 16, spo2: 99.0, o2: 0, uo: 65, fb: -2400, pil: 1, inot: 'none' as const, notes: 'Euvolemic. LMWH administered on schedule. Tolerating carvedilol 3.125 mg BD.' },
    ];
    for (const pl of ppcmLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_ppcm_flowsheet_logs (
          ppcm_episode_id, patient_id, log_datetime, hours_from_presentation,
          heart_rate_bpm, blood_pressure_sys, blood_pressure_dia, respiratory_rate,
          spo2_percent, oxygen_requirement_l_min, urine_output_ml_hr, fluid_balance_cumulative_ml,
          orthopnea_pillows, inotropic_support, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T05:00:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingPpcm.id, anitaId, pl.h, pl.hr, pl.sbp, pl.dbp, pl.rr, pl.spo2, pl.o2, pl.uo, pl.fb, pl.pil, pl.inot, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 26C: Pediatric Septic Arthritis & Kocher Diagnostic Criteria Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_septic_arthritis_episodes (
      patient_id, admission_id, episode_code, evaluation_datetime,
      age_months, weight_kg, affected_joint,
      non_weight_bearing, temperature_celsius, fever_gt_38_5,
      esr_mm_hr, esr_ge_40, wbc_count_per_microliter, wbc_gt_12000,
      crp_mg_l, kocher_criteria_met_count, predicted_probability_percent,
      ultrasound_effusion_detected, arthrocentesis_performed,
      synovial_wbc_count, synovial_pmb_pct, synovial_gram_stain,
      surgical_drainage_required, surgical_approach, empiric_antibiotic_regimen,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'SEPTICARTH-20261108-101', '2026-11-08T07:30:00',
      24, 12.4, 'right_hip',
      1, 39.1, 1,
      54.0, 1, 16800, 1,
      46.5, 4, 99.6,
      1, 1,
      94000, 92.0, 'gram_positive_cocci',
      1, 'arthrotomy_open_capsulotomy', 'cefazolin_iv',
      'postoperative_iv_antibiotics', ?,
      '2-year-old boy presenting with acute refusal to bear weight on right leg, held in characteristic flexion, abduction, and external rotation (position of maximal intracapsular capacity). Temperature 39.1°C, ESR 54, WBC 16,800 (Kocher score 4/4 = 99.6% probability). Emergency point-of-care hip ultrasound demonstrated 4.2mm anterior recess capsular distension (effusion). Emergent open arthrotomy & capsulotomy performed within 3 hours to relieve retinacular vascular tamponade and prevent avascular necrosis of the femoral capital epiphysis. 3 mL frank purulent fluid evacuated, Gram-positive cocci seen. High-dose IV Cefazolin commenced.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingSepticArth = db.prepare('SELECT id FROM pediatric_septic_arthritis_episodes WHERE episode_code = ?').get('SEPTICARTH-20261108-101') as { id: number } | undefined;
  if (existingSepticArth) {
    const arthLogs = [
      { h: 2, t: 39.0, hr: 148, rom: 'severely_restricted_pseudoparalysis' as const, wb: 'non_weight_bearing' as const, crp: 46.5, dr: 0, notes: 'Right hip held in flexion and external rotation. Any attempted passive internal rotation produces severe distress.' },
      { h: 6, t: 38.0, hr: 118, rom: 'moderate_guarding' as const, wb: 'non_weight_bearing' as const, crp: 44.0, dr: 12, notes: 'Post-capsulotomy in recovery. Suction drain in situ active. IV Cefazolin 50 mg/kg infused.' },
      { h: 16, t: 37.3, hr: 102, rom: 'mild_limitation' as const, wb: 'limping_antalgic' as const, crp: 28.0, dr: 25, notes: 'Afebrile. Pain controlled on oral paracetamol. Child sitting up in bed and moving leg spontaneously.' },
    ];
    for (const al of arthLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_septic_arthritis_flowsheet_logs (
          septic_arthritis_episode_id, patient_id, log_datetime, hours_from_triage,
          temperature_celsius, heart_rate_bpm, joint_range_of_motion, weight_bearing_ability,
          crp_mg_l, drain_output_ml_24h, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T07:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingSepticArth.id, aaravId, al.h, al.t, al.hr, al.rom, al.wb, al.crp, al.dr, al.notes, nurseId, now);
    }
  }

  // --- SERIES 27A: Neonatal Chylothorax & Octreotide Titration Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_chylothorax_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      gestational_age_weeks, birth_weight_grams, chronological_age_days, current_weight_kg,
      effusion_laterality, etiology, pleural_triglycerides_mg_dl, pleural_total_cells_per_microliter,
      pleural_lymphocyte_percent, pleural_cholesterol_mg_dl, chylomicron_presence,
      chest_tube_inserted, initial_24h_drainage_ml, drainage_ml_kg_day,
      dietary_regimen, octreotide_prescribed, octreotide_current_dose_mcg_kg_hr,
      chemical_pleurodesis_performed, surgical_ligation_indicated,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'CHYLO-20261108-101', '2026-11-08T06:00:00',
      37.5, 2950, 6, 2.85,
      'unilateral_right', 'post_cardiothoracic_surgery', 184.0, 4800,
      89.0, 68.0, 1,
      1, 68.4, 24.0,
      'nil_by_mouth_tpn', 1, 3.0,
      0, 0,
      'octreotide_titration', ?,
      '6-day-old neonate post-coarctation of aorta repair with high-output chylous pleural drainage (24.0 mL/kg/day). Pleural fluid confirms chyle leak with triglycerides 184 mg/dL and 89% lymphocytes. Enteral feeds halted, total parenteral nutrition instituted with strict LCT avoidance. IV Octreotide infusion commenced at 1 mcg/kg/hr and uptitrated to 3 mcg/kg/hr with serial glycemic and electrolyte surveillance. Responsive with declining drainage.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingChylo = db.prepare('SELECT id FROM neonatal_chylothorax_episodes WHERE episode_code = ?').get('CHYLO-20261108-101') as { id: number } | undefined;
  if (existingChylo) {
    const chyloLogs = [
      { d: 1, dr: 68.4, rate: 24.0, oct: 1.0, glu: 86.0, na: 138.0, app: 'milky_chylous' as const, notes: 'Milky chest tube drainage post-coarctation repair. Diagnostic thoracentesis sent. Octreotide started at 1 mcg/kg/hr.' },
      { d: 2, dr: 45.6, rate: 16.0, oct: 2.0, glu: 92.0, na: 137.0, app: 'serosanguinous' as const, notes: 'Titrated octreotide to 2 mcg/kg/hr. Drainage volume down by 33%. Blood glucose stable on continuous D10W infusion.' },
      { d: 3, dr: 22.8, rate: 8.0, oct: 3.0, glu: 98.0, na: 139.0, app: 'straw_colored_serous' as const, notes: 'Octreotide 3 mcg/kg/hr. Drainage cleared to straw-colored serous. Fluid output down to 8.0 mL/kg/day (< 10 threshold).' },
    ];
    for (const cl of chyloLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_chylothorax_flowsheet_logs (
          chylothorax_episode_id, patient_id, log_datetime, days_from_diagnosis,
          drainage_24h_ml, drainage_ml_kg_day, octreotide_dose_mcg_kg_hr,
          blood_glucose_mg_dl, serum_sodium_mmol_l, fluid_appearance,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:00:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingChylo.id, babyId, cl.d, cl.dr, cl.rate, cl.oct, cl.glu, cl.na, cl.app, cl.notes, nurseId, now);
    }
  }

  // --- SERIES 27B: Obstetric Umbilical Cord Prolapse & Emergent Decompression Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_cord_prolapse_episodes (
      patient_id, admission_id, episode_code, detection_datetime,
      maternal_age, gestational_age_weeks, cervical_dilation_cm, membrane_status,
      fetal_presentation, prolapse_type, cord_pulsation_present, baseline_fhr_bpm,
      fhr_deceleration_type, manual_elevation_performed, maternal_positioning,
      bladder_filling_performed, bladder_saline_volume_ml, tocolysis_administered,
      tocolysis_agent, cord_manipulation_avoided, cord_wrapped_warm_saline,
      delivery_mode, decision_to_delivery_minutes, apgar_1min, apgar_5min,
      umbilical_arterial_ph, status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PROLAPSE-20261108-101', '2026-11-08T08:15:00',
      28, 38.2, 5.0, 'ruptured_spontaneous',
      'cephalic_vertex', 'overt_cord_visible_or_in_vagina', 1, 85,
      'prolonged_bradycardia', 1, 'knee_chest_genupectoral',
      1, 500, 1,
      'terbutaline_sc', 1, 1,
      'category_1_emergency_cesarean', 18, 7, 9,
      7.24, 'postpartum_surveillance_stable', ?,
      'Acute overt umbilical cord prolapse diagnosed immediately following spontaneous rupture of membranes at 5 cm cervical dilation with sudden deep fetal bradycardia to 85 bpm. Emergent digital elevation of the fetal vertex maintained continuously, patient placed into knee-chest position, 500 mL sterile warm saline instilled into urinary bladder via Foley catheter, and subcutaneous Terbutaline 0.25 mg administered for rapid uterine relaxation. Transferred to OT with elevated vertex. Emergency Category-1 Cesarean section performed with decision-to-delivery interval of 18 minutes. Vigorous male neonate delivered with Apgars 7 and 9, umbilical cord pH 7.24.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingProlapse = db.prepare('SELECT id FROM obstetric_cord_prolapse_episodes WHERE episode_code = ?').get('PROLAPSE-20261108-101') as { id: number } | undefined;
  if (existingProlapse) {
    const prolapseLogs = [
      { min: 2, fhr: 85, puls: 1, elev: 1, sbp: 118, dbp: 76, notes: 'Overt cord prolapsed loop palpable in vagina with bradycardia 85 bpm. Manual digital vertex elevation commenced, knee-chest positioning initiated.' },
      { min: 8, fhr: 110, puls: 1, elev: 1, sbp: 112, dbp: 70, notes: 'Foley inserted and bladder filled with 500 mL warm saline (Vago maneuver). Terbutaline 0.25 mg SC given. FHR recovering to 110 bpm.' },
      { min: 14, fhr: 135, puls: 1, elev: 1, sbp: 116, dbp: 72, notes: 'Patient in OT, spinal anesthesia administered. Elevation maintained until surgeon extracted vertex. FHR normalized to 135 bpm.' },
    ];
    for (const pl of prolapseLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_cord_prolapse_flowsheet_logs (
          cord_prolapse_episode_id, patient_id, log_datetime, minutes_from_detection,
          fetal_heart_rate_bpm, cord_pulsation_palpable, manual_elevation_maintained,
          maternal_blood_pressure_sys, maternal_blood_pressure_dia,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T08:15:00', ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `).run(existingProlapse.id, anitaId, pl.min, pl.fhr, pl.puls, pl.elev, pl.sbp, pl.dbp, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 27C: Pediatric Intussusception & Pneumatic / Hydrostatic Reduction Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_intussusception_episodes (
      patient_id, admission_id, episode_code, presentation_datetime,
      age_months, weight_kg, symptom_duration_hours,
      intermittent_colicky_pain, vomiting_bilious, red_currant_jelly_stool,
      palpable_abdominal_mass, lethargy_altered_sensorium,
      ultrasound_target_sign_detected, ultrasound_outer_diameter_mm, pseudokidney_sign_present,
      pathologic_lead_point_suspected, lead_point_type,
      peritonitis_signs_present, pneumoperitoneum_on_xray,
      reduction_attempted, reduction_method, maximum_pressure_mmhg, reduction_attempts_count,
      reduction_successful, cecal_ileal_reflux_visualized, surgical_exploration_required,
      surgical_findings, status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'INTUSS-20261108-101', '2026-11-08T09:00:00',
      9, 8.8, 14.0,
      1, 1, 1,
      1, 0,
      1, 28.5, 1,
      0, 'none_idiopathic',
      0, 0,
      1, 'pneumatic_air_enema', 100.0, 2,
      1, 1, 0,
      NULL, 'reduction_successful_observation', ?,
      '9-month-old infant presenting with acute classical triad of intermittent severe colicky abdominal pain with legs drawn up, bilious emesis, and "red currant jelly" stool. Abdominal ultrasound confirmed ileocolic intussusception with classic target sign (outer diameter 28.5 mm) and pseudokidney sign. No peritonitis or free air on radiograph. Pneumatic air enema reduction performed under fluoroscopy with surgical stand-by: column advanced at 80 mmHg, intussusceptum unraveled on second attempt at 100 mmHg with free reflux of air into multiple small bowel terminal ileal loops. Successfully reduced non-operatively without complication. Admitted for 24h surveillance and gradual refeeding.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingIntuss = db.prepare('SELECT id FROM pediatric_intussusception_episodes WHERE episode_code = ?').get('INTUSS-20261108-101') as { id: number } | undefined;
  if (existingIntuss) {
    const intussLogs = [
      { min: 30, hr: 112, sbp: 94, dbp: 56, soft: 1, pain: 0, oral: 0, notes: 'Post-reduction observation room. Abdomen soft and non-tender. Infant sleeping comfortably between parent arms. IV maintenance fluids running.' },
      { min: 120, hr: 104, sbp: 96, dbp: 58, soft: 1, pain: 0, oral: 1, notes: 'Child awake, playful, smiling. Trial of small volume oral rehydration solution tolerated well with no vomiting or irritability.' },
      { min: 240, hr: 98, sbp: 98, dbp: 60, soft: 1, pain: 0, oral: 1, notes: 'Full breastfeed tolerated well. Passed normal yellow transitional stool with no bloody component. Abdomen soft, no distension.' },
    ];
    for (const il of intussLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_intussusception_flowsheet_logs (
          intussusception_episode_id, patient_id, log_datetime, minutes_from_procedure,
          heart_rate_bpm, blood_pressure_sys, blood_pressure_dia,
          abdominal_soft_non_tender, colicky_pain_recurrence, oral_intake_tolerated,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T09:00:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingIntuss.id, aaravId, il.min, il.hr, il.sbp, il.dbp, il.soft, il.pain, il.oral, il.notes, nurseId, now);
    }
  }

  // --- SERIES 28A: Neonatal Meconium Aspiration Syndrome (MAS) Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_mas_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      gestational_age_weeks, birth_weight_grams, chronological_age_hours, current_weight_kg,
      amniotic_fluid_meconium_consistency, delivery_room_vigor,
      endotracheal_suctioning_performed, meconium_cleared_below_cords,
      apgar_1min, apgar_5min,
      respiratory_support_mode, fio2_percent, mean_airway_pressure_cmh2o,
      pao2_mmhg, paco2_mmhg, arterial_ph, oxygenation_index,
      pre_post_ductal_spo2_diff_percent, echocardiogram_pphn_confirmed, pphn_severity,
      pulmonary_air_leak_present, air_leak_type,
      surfactant_administered, surfactant_delivery_method, surfactant_dose_mg_kg,
      inhaled_nitric_oxide_prescribed, ino_dose_ppm, empiric_antibiotics_active,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'MAS-20261108-101', '2026-11-08T06:30:00',
      39.5, 3300, 4.0, 3.2,
      'thick_particulate_pea_soup', 'non_vigorous_depressed',
      1, 1,
      4, 7,
      'high_frequency_oscillatory_ventilation', 75.0, 15.0,
      52.0, 48.0, 7.28, 21.6,
      14.0, 1, 'moderate_suprasystemic_shunting',
      0, 'none',
      1, 'bolus_endotracheal', 150.0,
      1, 20.0, 1,
      'hfov_ino_escalation', ?,
      'Term neonate born through thick particulate pea-soup meconium with severe depression at birth. Suctioned below vocal cords. Developed acute hypoxemic respiratory failure with OI 21.6 and PPHN (14% pre/post ductal saturation difference, right-to-left ductal shunting on echocardiogram). Commenced on HFOV (MAP 15 cmH2O) and Inhaled Nitric Oxide (iNO 20 ppm) with bovine surfactant bolus (150 mg/kg). Pre-ductal saturation stabilizing to 95%.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingMas = db.prepare('SELECT id FROM neonatal_mas_episodes WHERE episode_code = ?').get('MAS-20261108-101') as { id: number } | undefined;
  if (existingMas) {
    const masLogs = [
      { h: 1, rr: 66, hr: 160, pre: 92, post: 78, fio2: 90, map: 16, pao2: 45, paco2: 54, ph: 7.24, oi: 32.0, ino: 20, bp: 42, dr: 0, notes: 'Extreme respiratory failure and critical PPHN prior to HFOV transition. OI 32.0. iNO started at 20 ppm.' },
      { h: 4, rr: 58, hr: 148, pre: 95, post: 88, fio2: 75, map: 15, pao2: 52, paco2: 48, ph: 7.28, oi: 21.6, ino: 20, bp: 45, dr: 0, notes: 'HFOV stable. Pre/post ductal gradient narrowed from 14% to 7%. Arterial blood gas improving.' },
      { h: 12, rr: 52, hr: 138, pre: 97, post: 94, fio2: 50, map: 12, pao2: 68, paco2: 42, ph: 7.34, oi: 8.8, ino: 10, bp: 48, dr: 0, notes: 'Significant clinical improvement. OI down to 8.8. Weaning iNO to 10 ppm. No pneumothorax.' },
    ];
    for (const ml of masLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_mas_flowsheet_logs (
          mas_episode_id, patient_id, log_datetime, hours_from_admission,
          respiratory_rate, heart_rate_bpm, pre_ductal_spo2_percent, post_ductal_spo2_percent,
          fio2_percent, mean_airway_pressure_cmh2o, pao2_mmhg, paco2_mmhg, arterial_ph,
          oxygenation_index, ino_dose_ppm, mean_blood_pressure_mmhg, chest_tube_drainage_active,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingMas.id, babyId, ml.h, ml.rr, ml.hr, ml.pre, ml.post, ml.fio2, ml.map, ml.pao2, ml.paco2, ml.ph, ml.oi, ml.ino, ml.bp, ml.dr, ml.notes, nurseId, now);
    }
  }

  // --- SERIES 28B: Obstetric Acute Uterine Inversion Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_uterine_inversion_episodes (
      patient_id, admission_id, episode_code, occurrence_datetime,
      maternal_age, parity, delivery_mode,
      placental_status_at_inversion, umbilical_cord_traction_applied, fundal_pressure_applied,
      inversion_degree, neurogenic_shock_present,
      systolic_bp_at_presentation, diastolic_bp_at_presentation, heart_rate_at_presentation,
      estimated_blood_loss_ml, reduction_attempted_immediate, reduction_technique_primary,
      uterine_relaxant_administered, uterine_relaxant_agent,
      uterotonic_given_before_replacement, placenta_removed_before_reinversion,
      reinversion_successful, time_to_reinversion_minutes,
      post_replacement_uterotonics_started, bimanual_uterine_compression_maintained,
      blood_products_transfused_units, status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'INV-20261108-101', '2026-11-08T08:00:00',
      29, 2, 'spontaneous_vaginal',
      'attached_undelivered', 1, 0,
      'third_degree_prolapsed_outside_introitus', 1,
      74, 42, 58,
      550.0, 1, 'johnson_manual_maneuver',
      1, 'terbutaline_sc',
      0, 0,
      1, 12,
      1, 1,
      2, 'post_reinversion_bimanual_compression', ?,
      'Acute 3rd degree uterine inversion following delivery of placenta with attached morbidly adherent component. Severe neurogenic shock triggered by peritoneal traction: BP 74/42 with vagal bradycardia 58 bpm. Uterotonics withheld; Subcutaneous Terbutaline 0.25 mg administered for cervical ring relaxation. Immediate Johnson manual maneuver performed with palm guiding inverted fundus towards umbilicus. Successful reinversion achieved at 12 minutes. Placenta removed manually following reinversion. High-dose IV Oxytocin (40 IU) and internal bimanual compression maintained. 2 units packed RBCs transfused. Patient stabilized.',
      ?, ?
    )
  `).run(sunitaId, docId, now, now);

  const existingInversion = db.prepare('SELECT id FROM obstetric_uterine_inversion_episodes WHERE episode_code = ?').get('INV-20261108-101') as { id: number } | undefined;
  if (existingInversion) {
    const invLogs = [
      { min: 5, sbp: 74, dbp: 42, hr: 58, tone: 'relaxing_re_inversion_risk' as const, bim: 1, oxy: 0, loss: 100, uo: 15, notes: 'Profound hypotension and vagal shock. Terbutaline administered. Johnson maneuver underway.' },
      { min: 15, sbp: 92, dbp: 56, hr: 78, tone: 'boggy_hypotonic' as const, bim: 1, oxy: 1, loss: 50, uo: 30, notes: 'Reinversion complete. High-dose Oxytocin running. Internal bimanual compression active.' },
      { min: 45, sbp: 110, dbp: 68, hr: 82, tone: 'firm_well_contracted' as const, bim: 1, oxy: 1, loss: 20, uo: 50, notes: 'Myometrial tone firm and contracted. Bleeding controlled. Transfusion completed.' },
    ];
    for (const il of invLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_uterine_inversion_flowsheet_logs (
          inversion_episode_id, patient_id, log_datetime, minutes_from_inversion,
          systolic_bp, diastolic_bp, heart_rate_bpm, uterine_tone,
          bimanual_compression_active, oxytocin_infusion_running,
          estimated_ongoing_blood_loss_ml, urine_output_ml_hr,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T08:00:00', ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `).run(existingInversion.id, sunitaId, il.min, il.sbp, il.dbp, il.hr, il.tone, il.bim, il.oxy, il.loss, il.uo, il.notes, nurseId, now);
    }
  }

  // --- SERIES 28C: Pediatric Acute Appendicitis & Samuel PAS Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_appendicitis_episodes (
      patient_id, admission_id, episode_code, triage_datetime,
      age_years, weight_kg, symptom_duration_hours,
      cough_percussion_hopping_rlq_pain, rlq_tenderness_light_palpation,
      migration_pain_to_rlq, fever_gt_38c, nausea_or_vomiting, anorexia,
      leukocytosis_wbc_gt_10000, neutrophilia_anc_gt_7500_or_ge_75pct, pas_score_total,
      wbc_count_per_microliter, neutrophil_percent, crp_mg_l,
      ultrasound_performed, appendix_visualized, outer_diameter_mm,
      non_compressible, hypervascular_ring_of_fire, appendicolith_fecalith_present,
      periappendiceal_fluid_or_fat_stranding, perforation_or_abscess_suspected,
      management_pathway, empiric_antibiotic_regimen, surgical_findings,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'APP-20261108-101', '2026-11-08T09:30:00',
      8.0, 26.5, 18.0,
      1, 1, 1, 1, 1, 1, 1, 1, 10,
      14200, 82.0, 38.0,
      1, 1, 7.8,
      1, 1, 0,
      1, 0,
      'urgent_laparoscopic_appendectomy', 'ceftriaxone_plus_metronidazole', 'uncomplicated_suppurative',
      'postoperative_recovery', ?,
      '8-year-old child presenting with classic migratory right lower quadrant abdominal pain, anorexia, vomiting, fever 38.4°C, and marked hopping/percussion tenderness. Samuel Pediatric Appendicitis Score 10/10 (> 90% predicted probability). Point-of-care graded-compression ultrasound demonstrated 7.8 mm non-compressible appendix with hypervascular wall hyperemia and periappendiceal fat stranding. Emergent laparoscopic appendectomy performed: suppurative non-perforated appendicitis successfully resected without complications.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingAppy = db.prepare('SELECT id FROM pediatric_appendicitis_episodes WHERE episode_code = ?').get('APP-20261108-101') as { id: number } | undefined;
  if (existingAppy) {
    const appyLogs = [
      { h: 2, temp: 38.4, hr: 118, rr: 24, pain: 7, exam: 'rebound_guarding_worsening' as const, oral: 'npo_strict' as const, notes: 'Pre-operative holding area. RLQ tenderness acute. IV Plasmalyte and analgesia running.' },
      { h: 6, temp: 37.6, hr: 98, rr: 20, pain: 4, exam: 'focal_rlq_tenderness_improving' as const, oral: 'npo_strict' as const, notes: 'Post-laparoscopic appendectomy in surgical recovery. Incisions clean. Pain well controlled.' },
      { h: 14, temp: 37.0, hr: 88, rr: 18, pain: 1, exam: 'soft_non_tender' as const, oral: 'clear_liquids_tolerated' as const, notes: 'Afebrile, walking in room. Clear oral fluids tolerated without emesis. Abdomen soft.' },
    ];
    for (const al of appyLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_appendicitis_flowsheet_logs (
          appendicitis_episode_id, patient_id, log_datetime, hours_from_triage,
          temperature_celsius, heart_rate_bpm, respiratory_rate,
          pain_score_flacc_wong_baker, abdominal_exam_findings, oral_intake_status,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T09:30:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingAppy.id, aaravId, al.h, al.temp, al.hr, al.rr, al.pain, al.exam, al.oral, al.notes, nurseId, now);
    }
  }

  // --- SERIES 29A: Neonatal Transient Tachypnea (TTN) Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_ttn_episodes (
      patient_id, admission_id, episode_code, diagnosis_datetime,
      gestational_age_weeks, birth_weight_kg, delivery_mode,
      maternal_diabetes, maternal_asthma, maternal_fluid_overload,
      initial_respiratory_rate, silverman_anderson_score,
      chest_retraction_upper, chest_retraction_lower, xiphoid_retraction,
      nasal_flaring, expiratory_grunt,
      cxr_findings, initial_fio2_percent, respiratory_support_initial,
      cpap_peep_cmh2o, feeding_status,
      blood_gas_ph, blood_gas_pco2, blood_gas_pao2,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'TTN-20261108-101', '2026-11-08T07:15:00',
      38.2, 3.35, 'elective_cesarean_no_labor',
      1, 0, 0,
      82, 4,
      1, 1, 1,
      1, 0,
      'perihilar_streaking_sunburst', 28.0, 'bubble_cpap',
      5.0, 'npo_iv_fluids',
      7.34, 46.0, 68.0,
      'active_monitoring', ?,
      'Late-term infant delivered via elective C-section without labor to mother with GDM. Developed transient tachypnea (RR 82 bpm) with mild-to-moderate intercostal and subcostal retractions. Silverman-Anderson score 4/10. CXR confirms prominent perihilar streaking sunburst pattern and fluid in minor fissure. Placed on Bubble CPAP 5 cmH2O at 28% FiO2 with IV 10% Dextrose infusion.',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingTtn = db.prepare('SELECT id FROM neonatal_ttn_episodes WHERE episode_code = ?').get('TTN-20261108-101') as any;
  if (existingTtn) {
    const ttnLogs = [
      { rr: 80, hr: 144, spo2: 95, fio2: 28, peep: 5.0, score: 4, grunt: 0, feed: 'npo_iv', ph: 7.35, pco2: 45, notes: 'Initiated Bubble CPAP 5 cmH2O with heated humidification.' },
      { rr: 68, hr: 136, spo2: 97, fio2: 25, peep: 5.0, score: 2, grunt: 0, feed: 'gavage_tube', ph: 7.38, pco2: 42, notes: 'Respiratory rate dropping; retractions significantly improved. Initiated gentle gavage feeds.' },
      { rr: 54, hr: 130, spo2: 98, fio2: 21, peep: 4.0, score: 1, grunt: 0, feed: 'oral_breast', ph: 7.40, pco2: 39, notes: 'Weaned to low-pressure CPAP 4 cmH2O on room air. Successful direct breastfeeding trial.' },
    ];
    for (const tl of ttnLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_ttn_flowsheet_logs (
          ttn_episode_id, patient_id, log_datetime,
          respiratory_rate, heart_rate, spo2_percent, fio2_percent,
          cpap_peep_cmh2o, silverman_anderson_score, grunting_present,
          feeding_route, blood_gas_ph, blood_gas_pco2, notes,
          logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T07:30:00',
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `).run(existingTtn.id, babyId, tl.rr, tl.hr, tl.spo2, tl.fio2, tl.peep, tl.score, tl.grunt, tl.feed, tl.ph, tl.pco2, tl.notes, nurseId, now);
    }
  }

  // --- SERIES 29B: Obstetric Postdural Puncture Headache (PDPH) Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_pdph_episodes (
      patient_id, admission_id, episode_code, procedure_type,
      puncture_datetime, needle_gauge, headache_onset_datetime,
      initial_vas_score, postural_component, neck_stiffness,
      auditory_symptoms, visual_symptoms_diplopia,
      conservative_hydration_ml_24h, caffeine_administered, analgesics_prescribed,
      ebp_indicated, ebp_performed, ebp_datetime,
      ebp_blood_volume_ml, ebp_interspace, post_ebp_vas_score,
      red_flags_present, red_flag_notes, status,
      consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PDPH-20261108-101', 'labor_epidural_adp',
      '2026-11-06T14:00:00', '16G_tuohy', '2026-11-07T10:00:00',
      8, 1, 1,
      1, 0,
      3000, 1, 'Paracetamol 1000mg PO Q6H + Ibuprofen 400mg PO Q8H + Oral Caffeine 200mg',
      1, 1, '2026-11-08T08:30:00',
      18.0, 'L3-L4', 1,
      0, NULL, 'ebp_completed_resolving', ?,
      'Postpartum G1P1 patient experienced accidental dural puncture during labor analgesia with 16G Tuohy needle. Developed incapacitating orthostatic fronto-occipital headache (VAS 8/10) with tinnitus and neck stiffness on sitting up to nurse. Trial of conservative therapy for 24h was unsuccessful. Autologous Epidural Blood Patch performed under strict sterile technique (18 mL autologous venous blood injected at L3-L4). Immediate relief with post-procedure VAS 1/10.',
      ?, ?
    )
  `).run(poojaId, docId, now, now);

  const existingPdph = db.prepare('SELECT id FROM obstetric_pdph_episodes WHERE episode_code = ?').get('PDPH-20261108-101') as any;
  if (existingPdph) {
    const pdphLogs = [
      { posture: 'sitting_upright', vas: 8, relief: 1, sbp: 116, dbp: 74, hr: 82, temp: 36.8, neuro: 0, rx: 'Caffeine 200mg + Paracetamol 1g', notes: 'Severe frontal pain on sitting; completely relieved lying supine.' },
      { posture: 'standing_ambulating', vas: 8, relief: 1, sbp: 118, dbp: 76, hr: 86, temp: 36.7, neuro: 0, rx: 'IV crystalloid 1000mL', notes: 'Unable to stand or care for infant. Proceeding to EBP counseling.' },
      { posture: 'sitting_upright', vas: 1, relief: 1, sbp: 114, dbp: 70, hr: 74, temp: 36.9, neuro: 0, rx: 'Post-EBP supine rest completed', notes: 'Sitting upright comfortably post-EBP with minimal discomfort. Infant rooming-in restored.' },
    ];
    for (const pl of pdphLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_pdph_flowsheet_logs (
          pdph_episode_id, patient_id, log_datetime,
          posture_assessed, vas_pain_score, headache_relief_on_lying,
          blood_pressure_sys, blood_pressure_dia, heart_rate,
          temperature_celsius, neurological_symptoms_present,
          interventions_given, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T08:00:00',
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingPdph.id, poojaId, pl.posture, pl.vas, pl.relief, pl.sbp, pl.dbp, pl.hr, pl.temp, pl.neuro, pl.rx, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 29C: Pediatric Bacterial Meningitis & Nigrovic BMS Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_bacterial_meningitis_episodes (
      patient_id, admission_id, episode_code, triage_datetime,
      age_months, weight_kg, prior_antibiotic_exposure_72h,
      seizure_at_presentation, gcs_score, kernig_brudzinski_sign,
      fontanelle_bulging, purpuric_rash, csf_wbc_count,
      csf_neutrophil_percent, csf_anc_calculated, csf_protein_mg_dl,
      csf_glucose_mg_dl, blood_glucose_mg_dl, csf_to_blood_glucose_ratio,
      csf_gram_stain_positive, csf_gram_stain_organism,
      peripheral_wbc, peripheral_anc, bms_score, risk_tier,
      empiric_ceftriaxone_ordered, empiric_vancomycin_ordered,
      dexamethasone_given_pre_antibiotic, isolation_precautions,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'MEN-20261108-101', '2026-11-08T05:45:00',
      22, 12.0, 0,
      1, 14, 1,
      0, 0, 1100,
      85.0, 935, 135.0,
      24.0, 108.0, 0.22,
      1, 'gram_positive_cocci_pairs',
      18.8, 13200, 5, 'high_risk',
      1, 1,
      1, 'droplet_precautions',
      'picu_critical_care', ?,
      '22-month-old male presenting with high fever (39.2°C), brief generalized tonic-clonic seizure, and pronounced nuchal rigidity. Lumbar puncture revealed turbid CSF with 1,100 WBCs (85% neutrophils), elevated protein 135 mg/dL, and marked hypoglycorrhachia (CSF:Blood glucose ratio 0.22). CSF Gram stain positive for Gram-positive diplococci (Streptococcus pneumoniae). Nigrovic BMS score 5/6 (High Risk). Administered IV Dexamethasone 1.8 mg followed immediately by empiric IV Ceftriaxone 600 mg Q12H and Vancomycin 180 mg Q6H under strict droplet precautions.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingMen = db.prepare('SELECT id FROM pediatric_bacterial_meningitis_episodes WHERE episode_code = ?').get('MEN-20261108-101') as any;
  if (existingMen) {
    const menLogs = [
      { gcs: 14, pupils: 'brisk_bilateral', hr: 130, sbp: 100, dbp: 62, temp: 39.1, rr: 28, seizure: 0, notes: 'Irritable, resisting neck flexion. Droplet isolation established.', abx: 'Dexamethasone 1.8mg IV + Ceftriaxone 600mg IV' },
      { gcs: 14, pupils: 'brisk_bilateral', hr: 122, sbp: 102, dbp: 64, temp: 38.3, rr: 24, seizure: 0, notes: 'Vancomycin 180mg IV infusion completed over 60 min. No allergic reaction.', abx: 'Vancomycin 180mg IV' },
      { gcs: 15, pupils: 'brisk_bilateral', hr: 110, sbp: 104, dbp: 66, temp: 37.6, rr: 22, seizure: 0, notes: 'Alert, recognizing parents, taking oral sips. No further seizure activity.', abx: 'Ceftriaxone Dose 2 scheduled' },
    ];
    for (const ml of menLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_bacterial_meningitis_flowsheet_logs (
          meningitis_episode_id, patient_id, log_datetime,
          gcs_score, pupil_reactivity, heart_rate,
          blood_pressure_sys, blood_pressure_dia, temperature_celsius,
          respiratory_rate, seizure_activity_observed, neurological_notes,
          antibiotic_dose_administered, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:00:00',
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingMen.id, aaravId, ml.gcs, ml.pupils, ml.hr, ml.sbp, ml.dbp, ml.temp, ml.rr, ml.seizure, ml.notes, ml.abx, nurseId, now);
    }
  }

  // =========================================================================
  // SERIES 30 DEMO DATA: NEONATAL AOP, OBSTETRIC RETAINED PLACENTA & PEDIATRIC PYLORIC STENOSIS
  // =========================================================================

  // --- SERIES 30A: Neonatal Apnea of Prematurity (AOP) & Caffeine Citrate ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_aop_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      gestational_age_weeks, chronological_age_days, post_conceptional_age_weeks,
      current_weight_kg, apnea_subtype, apnea_frequency_per_24h,
      bradycardia_present, lowest_heart_rate_bpm, desaturation_present,
      lowest_spo2_percent, stimulation_required,
      caffeine_citrate_active, caffeine_loading_dose_mg_kg, caffeine_maintenance_dose_mg_kg_day,
      serum_caffeine_level_mcg_ml, secondary_causes_excluded,
      respiratory_support_mode, cpap_peep_cmh2o,
      weaning_eligible, apnea_free_days_count,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'AOP-20261108-101', '2026-11-08T04:30:00',
      30.2, 9, 31.5,
      1.28, 'mixed', 4,
      1, 74, 1,
      82, 'tactile_gentle',
      1, 20.0, 7.5,
      12.5, 1,
      'bubble_cpap', 5.0,
      0, 1,
      'active_treatment', ?,
      'Preterm 30+2 week infant experiencing recurrent mixed apnea events accompanied by bradycardia (HR 74 bpm) and desaturations (SpO2 82%). Sepsis screen negative. Administered Caffeine Citrate IV loading dose 25.6 mg (20 mg/kg), maintained on 9.6 mg/day (7.5 mg/kg/day q24h). On Bubble CPAP +5 cmH2O. Serum caffeine level 12.5 mcg/mL in optimal therapeutic range (8-20 mcg/mL).',
      ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingAop = db.prepare('SELECT id FROM neonatal_aop_episodes WHERE episode_code = ?').get('AOP-20261108-101') as any;
  if (existingAop) {
    const aopLogs = [
      { ap: 2, br: 2, des: 2, hr: 74, spo2: 82, stim: 'tactile_rubbing', dose: 25.6, supp: 'Bubble CPAP 5 cmH2O, FiO2 25%', tox: 0, notes: 'Loading dose caffeine citrate 25.6 mg IV given over 30 min. Gentle sole stimulation for apnea.' },
      { ap: 1, br: 1, des: 1, hr: 78, spo2: 85, stim: 'tactile_rubbing', dose: 9.6, supp: 'Bubble CPAP 5 cmH2O, FiO2 23%', tox: 0, notes: 'Maintenance caffeine 9.6 mg daily given. Frequency of desaturations reduced.' },
      { ap: 0, br: 0, des: 0, hr: 138, spo2: 96, stim: 'none', dose: null, supp: 'Bubble CPAP 5 cmH2O, Room Air', tox: 0, notes: 'Stable through morning shift. No apnea or bradycardia. Good gut tolerance on trophic feeds.' },
    ];
    for (const al of aopLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_aop_flowsheet_logs (
          aop_episode_id, patient_id, log_datetime,
          apnea_events_count_in_shift, bradycardia_events_count, desaturation_events_count,
          lowest_heart_rate_bpm, lowest_spo2_percent, stimulation_mode_used,
          caffeine_dose_given_mg, current_respiratory_support, caffeine_toxicity_signs,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T05:00:00',
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingAop.id, babyId, al.ap, al.br, al.des, al.hr, al.spo2, al.stim, al.dose, al.supp, al.tox, al.notes, nurseId, now);
    }
  }

  // --- SERIES 30B: Obstetric Retained Placenta & MROP Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_retained_placenta_episodes (
      patient_id, admission_id, episode_code, delivery_datetime,
      third_stage_duration_minutes, active_management_third_stage, estimated_blood_loss_ml,
      hemodynamic_stability, bladder_catheterized, retained_placenta_type,
      iuv_oxytocin_attempted, iuv_oxytocin_dose_iu, iuv_oxytocin_successful,
      mrop_indicated, mrop_performed, mrop_datetime,
      anesthesia_type, placenta_complete_post_removal,
      prophylactic_antibiotics_given, post_removal_oxytocin_infusion,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'RET-20261108-101', '2026-11-08T08:15:00',
      42, 1, 450,
      'stable', 1, 'placenta_adherens',
      1, 20, 0,
      1, 1, '2026-11-08T09:10:00',
      'spinal_regional', 1,
      1, 1,
      'post_removal_recovery', ?,
      'Third stage exceeded 40 minutes despite active management. Foley catheterization performed draining 350 mL clear urine. Trial of intra-umbilical vein (IUV) oxytocin 20 IU in 20 mL normal saline yielded no separation after 20 minutes. Transferred to Operating Theatre for emergent MROP under spinal anesthesia. Successful manual extraction of complete intact placenta along natural cleavage plane. Prophylactic Ampicillin 2g + Metronidazole 500mg IV administered. High-dose oxytocin infusion ongoing. Uterus well contracted.',
      ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingRet = db.prepare('SELECT id FROM obstetric_retained_placenta_episodes WHERE episode_code = ?').get('RET-20261108-101') as any;
  if (existingRet) {
    const retLogs = [
      { min: 35, sbp: 118, dbp: 74, hr: 84, loss: 300, tone: 'firm_contracted', bleed: 'minimal_trickle', cord: 0, interv: 'Bladder catheterized, IUV oxytocin 20 IU trial injected into umbilical vein', notes: 'Awaiting placental detachment. Vital signs stable.' },
      { min: 55, sbp: 112, dbp: 70, hr: 92, loss: 420, tone: 'contracted_with_lower_spasm', bleed: 'moderate_lochia', cord: 0, interv: 'Transferred to OT for MROP under spinal block', notes: 'IUV oxytocin unsuccessful. Anesthesia team in theater.' },
      { min: 80, sbp: 116, dbp: 72, hr: 80, loss: 450, tone: 'firm_contracted', bleed: 'minimal_trickle', cord: 1, interv: 'MROP completed, Ampicillin 2g + Metronidazole 500mg given, Oxytocin infusion 20 IU running', notes: 'Placenta complete. Fundus hard and centrally positioned.' },
    ];
    for (const rl of retLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_retained_placenta_flowsheet_logs (
          retained_episode_id, patient_id, log_datetime,
          minutes_from_delivery, blood_pressure_sys, blood_pressure_dia,
          heart_rate, cumulative_blood_loss_ml, uterine_fundus_tone,
          active_vaginal_bleeding, cord_lengthening_observed,
          intervention_applied, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T08:50:00',
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingRet.id, anitaId, rl.min, rl.sbp, rl.dbp, rl.hr, rl.loss, rl.tone, rl.bleed, rl.cord, rl.interv, rl.notes, nurseId, now);
    }
  }

  // --- SERIES 30C: Pediatric Infantile Hypertrophic Pyloric Stenosis (IHPS) Resuscitation Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_pyloric_stenosis_episodes (
      patient_id, admission_id, episode_code, presentation_datetime,
      age_weeks, weight_kg, birth_weight_kg,
      vomiting_projectile_non_bilious, hungry_vomiter_behavior,
      palpable_olive_mass, visible_gastric_peristalsis, dehydration_percentage,
      ultrasound_performed, pyloric_muscle_thickness_mm, pyloric_channel_length_mm, pyloric_transverse_diameter_mm,
      ultrasound_diagnostic_target_sign, serum_sodium_meq_l, serum_potassium_meq_l,
      serum_chloride_meq_l, serum_bicarbonate_meq_l, blood_ph,
      urine_output_ml_kg_hr, fluid_resuscitation_rate_ml_hr,
      potassium_supplementation_started, preop_electrolytes_normalized,
      surgical_clearance_granted, surgery_performed, pyloromyotomy_technique,
      postop_feeding_started, status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'PYL-20261108-101', '2026-11-08T03:30:00',
      5.5, 3.85, 3.30,
      1, 1,
      1, 1, 7.0,
      1, 4.1, 17.2, 13.0,
      1, 136.0, 3.8,
      102.0, 26.0, 7.43,
      1.5, 24.0,
      1, 1,
      1, 1, 'laparoscopic_ramstedt',
      1, 'postop_feeding_advancement', ?,
      '5.5-week-old male infant presented with classic hungry-vomiter projectile non-bilious emesis. Palpable olive mass in right upper quadrant. Ultrasound diagnostic for IHPS with muscle thickness 4.1 mm and channel length 17.2 mm. Initial hypochloremic metabolic alkalosis successfully resuscitated over 18 hours with D5 0.45% NS + 20 mEq/L KCl at 1.5x maintenance. Pre-op clearance criteria met: Cl 102 mEq/L, HCO3 26 mEq/L, K 3.8 mEq/L, and UOP 1.5 mL/kg/h. Uneventful laparoscopic Ramstedt pyloromyotomy performed. Post-op feeding advancement initiated with oral Pedialyte transitioning to breast milk.',
      ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingPyl = db.prepare('SELECT id FROM pediatric_pyloric_stenosis_episodes WHERE episode_code = ?').get('PYL-20261108-101') as any;
  if (existingPyl) {
    const pylLogs = [
      { h: 0, na: 133, k: 3.2, cl: 88, hco3: 34, ph: 7.52, uop: 0.6, rate: 24, cr: 3.0, vom: 2, ng: 25, notes: 'Severe hypochloremic hypokalemic metabolic alkalosis on presentation. Started D5 0.45% NS.' },
      { h: 8, na: 135, k: 3.5, cl: 96, hco3: 30, ph: 7.47, uop: 1.2, rate: 24, cr: 2.0, vom: 0, ng: 15, notes: 'UOP established >1 mL/kg/h. KCl 20 mEq/L added to infusion. Alkalosis resolving.' },
      { h: 16, na: 136, k: 3.8, cl: 102, hco3: 26, ph: 7.43, uop: 1.5, rate: 16, cr: 1.8, vom: 0, ng: 5, notes: 'Strict pre-op criteria satisfied (Cl 102, HCO3 26, K 3.8, UOP 1.5). Surgical clearance signed.' },
    ];
    for (const pl of pylLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_pyloric_stenosis_flowsheet_logs (
          pyloric_episode_id, patient_id, log_datetime,
          hours_from_admission, serum_sodium_meq_l, serum_potassium_meq_l,
          serum_chloride_meq_l, serum_bicarbonate_meq_l, blood_ph,
          urine_output_ml_kg_hr, iv_fluid_rate_ml_hr, capillary_refill_seconds,
          vomiting_episodes_count, gastric_decompression_output_ml,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T04:00:00',
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `).run(existingPyl.id, aaravId, pl.h, pl.na, pl.k, pl.cl, pl.hco3, pl.ph, pl.uop, pl.rate, pl.cr, pl.vom, pl.ng, pl.notes, nurseId, now);
    }
  }

  // --- SERIES 31A: Neonatal Subgaleal Hemorrhage (SGH) & Emergent MTP Resuscitation ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_sgh_episodes (
      patient_id, admission_id, episode_code, birth_datetime, diagnosis_datetime,
      delivery_mode, vacuum_cup_popoffs, birth_weight_kg,
      initial_head_circumference_cm, current_head_circumference_cm,
      hc_increase_cm, estimated_occult_blood_loss_ml, circulating_volume_loss_pct,
      swelling_crosses_sutures, swelling_fluctuant_pitting,
      periorbital_ecchymosis, ear_displacement, pallor_severe,
      shock_state, heart_rate_bpm, blood_pressure_sys, blood_pressure_dia,
      shock_index, capillary_refill_seconds,
      hematocrit_initial_pct, hematocrit_lowest_pct,
      platelet_count, fibrinogen_mg_dl,
      mtp_activated, prbc_volume_transfused_ml, ffp_volume_transfused_ml, cryoprecipitate_volume_ml,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'SGH-20261108-101', '2026-11-08T02:30:00', '2026-11-08T06:00:00',
      'vacuum_assisted', 2, 3.4,
      34.0, 35.5,
      1.5, 57.0, 21.0,
      1, 1,
      1, 1, 1,
      'uncompensated_hypotensive_shock', 178, 50, 28,
      3.56, 4.0,
      48.0, 28.0,
      75000, 95.0,
      1, 68.0, 51.0, 34.0,
      'mtp_massive_transfusion', ?, 'Vacuum birth trauma with fluctuant subgaleal swelling crossing sagittal & coronal sutures. MTP Pack 1 active.', ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingSgh = db.prepare('SELECT id FROM neonatal_sgh_episodes WHERE episode_code = ?').get('SGH-20261108-101') as any;
  if (existingSgh) {
    const sghLogs = [
      { h: 3.5, hc: 35.0, sbp: 52, dbp: 28, hr: 175, idx: 3.37, cr: 4.0, hct: 32, trans: 'PRBC 35 mL bolus via UVC', notes: 'Severe pallor, fluctuant fluid wave crossing sagittal suture.' },
      { h: 5.0, hc: 35.5, sbp: 48, dbp: 26, hr: 180, idx: 3.75, cr: 4.5, hct: 28, trans: 'PRBC 33 mL + FFP 51 mL + Cryo 34 mL', notes: 'Fibrinogen 95 mg/dL. Consumptive coagulopathy managed with cryoprecipitate.' },
      { h: 8.0, hc: 35.5, sbp: 64, dbp: 38, hr: 148, idx: 2.31, cr: 2.5, hct: 38, trans: 'MTP infusion completed', notes: 'Perfusion restored, warm extremities, HC stabilized over last 3 hours.' },
    ];
    for (const sl of sghLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_sgh_flowsheet_logs (
          sgh_episode_id, patient_id, log_datetime,
          hours_from_birth, head_circumference_cm,
          blood_pressure_sys, blood_pressure_dia,
          heart_rate, shock_index, capillary_refill_seconds,
          hematocrit_pct, blood_products_transfused,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:00:00',
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `).run(existingSgh.id, babyId, sl.h, sl.hc, sl.sbp, sl.dbp, sl.hr, sl.idx, sl.cr, sl.hct, sl.trans, sl.notes, nurseId, now);
    }
  }

  // --- SERIES 31B: Obstetric TOLAC & Impending Uterine Rupture Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_tolac_episodes (
      patient_id, admission_id, episode_code, assessment_datetime,
      gestational_age_weeks, maternal_age, maternal_bmi,
      prior_cesarean_count, prior_uterine_incision_type, prior_vaginal_delivery,
      indication_for_prior_cesarean, interdelivery_interval_months,
      bishop_score, grobman_vbac_success_pct, contraindications_present,
      efm_abnormality, iupc_loss_of_uterine_tone, acute_scar_tenderness,
      vaginal_bleeding_fresh, cessation_of_contractions, presenting_part_retraction,
      rupture_risk_tier, status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'TOLAC-20261108-101', '2026-11-08T06:30:00',
      39.3, 30, 25.8,
      1, 'low_transverse', 'prior_vbac',
      'Breech presentation in prior pregnancy', 26,
      7, 83.0, 0,
      'normal_category_1', 0, 0,
      0, 0, 0,
      'standard_tolac_candidate', 'active_labor_efm_monitoring', ?,
      'Grobman score 83%. Continuous EFM and IUPC tone monitoring in progress.', ?, ?
    )
  `).run(meeraId, docId, now, now);

  const existingTolac = db.prepare('SELECT id FROM obstetric_tolac_episodes WHERE episode_code = ?').get('TOLAC-20261108-101') as any;
  if (existingTolac) {
    const tolacLogs = [
      { h: 2.0, dil: 4.5, fhr: 140, cat: 'category_1_normal', contr: 3, tone: 12, scar: 0, intv: 'IV access secured, type & screen crossmatched', notes: 'Patient tolerating active labor well with epidural.' },
      { h: 4.5, dil: 6.5, fhr: 136, cat: 'category_1_normal', contr: 4, tone: 14, scar: 0, intv: 'Left lateral position, continuous EFM', notes: 'Cervical dilation progressing smoothly, fetal heart reactive.' },
      { h: 7.0, dil: 9.0, fhr: 132, cat: 'category_1_normal', contr: 5, tone: 15, scar: 0, intv: 'Delivery trolley prepared, pediatrician on standby', notes: 'Transition phase. No scar tenderness. Presenting part deeply engaged.' },
    ];
    for (const tl of tolacLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_tolac_flowsheet_logs (
          tolac_episode_id, patient_id, log_datetime,
          hours_in_active_labor, cervical_dilation_cm,
          fetal_heart_rate_baseline, efm_category,
          contractions_per_10min, resting_uterine_tone_mmhg,
          lower_segment_scar_pain, intervention_applied,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T08:00:00',
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `).run(existingTolac.id, meeraId, tl.h, tl.dil, tl.fhr, tl.cat, tl.contr, tl.tone, tl.scar, tl.intv, tl.notes, nurseId, now);
    }
  }

  // --- SERIES 31C: Pediatric Kawasaki Disease (KD) & Coronary Aneurysm Prevention Protocol ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_kawasaki_episodes (
      patient_id, admission_id, episode_code, presentation_datetime,
      age_months, weight_kg, fever_duration_days,
      conjunctivitis_bilateral_bulbar, oral_mucosal_changes,
      polymorphous_exanthem_rash, peripheral_extremity_changes,
      cervical_lymphadenopathy_ge_1_5cm, bcg_scar_erythema, perineal_erythema_desquamation,
      principal_criteria_count, diagnosis_classification,
      crp_mg_l, esr_mm_hr, serum_albumin_g_dl, serum_sodium_meq_l,
      platelet_count, wbc_count, alt_u_l, neutrophil_pct,
      sterile_pyuria_present, kobayashi_score, ivig_resistance_risk,
      ivig_administered, ivig_dose_g_kg, aspirin_dose_mg_kg_day,
      echo_performed, lad_z_score, rca_z_score,
      coronary_aneurysm_classification, status,
      consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'KAW-20261108-101', '2026-11-08T05:00:00',
      18, 11.5, 6,
      1, 1,
      1, 1, 0,
      1, 1,
      4, 'classic_complete_kd',
      85.0, 68.0, 2.9, 131.0,
      280000, 16800, 115.0, 83.0,
      1, 7, 'high_risk',
      1, 2.0, 40.0,
      1, 2.8, 2.2,
      'small_aneurysm_z_2_5_to_5', 'ivig_infusion_in_progress',
      ?, 'Classic complete KD with BCG scar erythema, Kobayashi score 7 (High Risk). IVIG 23g infusing.', ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingKaw = db.prepare('SELECT id FROM pediatric_kawasaki_episodes WHERE episode_code = ?').get('KAW-20261108-101') as any;
  if (existingKaw) {
    const kawLogs = [
      { h: 2.0, temp: 39.1, hr: 135, sbp: 94, dbp: 56, ivig: 1, asp: 115, rash: 'Trunk polymorphous rash, strawberry tongue', edem: 'Indurated palmar erythema', notes: 'Premedicated with paracetamol. IVIG started at 0.5 mL/kg/h.' },
      { h: 6.0, temp: 38.3, hr: 122, sbp: 96, dbp: 60, ivig: 1, asp: 115, rash: 'Erythema lessening, conjunctival injection present', edem: 'Hand edema stable', notes: 'IVIG titrated to 2.0 mL/kg/h without adverse effect.' },
      { h: 12.0, temp: 37.2, hr: 108, sbp: 98, dbp: 62, ivig: 0, asp: 115, rash: 'Rash markedly faded, lips moistening', edem: 'Edema subsiding', notes: 'IVIG 23g completed. Infant afebrile for 4 hours. Continuing high-dose aspirin.' },
    ];
    for (const kl of kawLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_kawasaki_flowsheet_logs (
          kawasaki_episode_id, patient_id, log_datetime,
          hours_from_admission, temperature_celsius,
          heart_rate, blood_pressure_sys, blood_pressure_dia,
          ivig_infusion_running, aspirin_dose_given_mg,
          rash_appearance, extremity_edema,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T07:00:00',
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `).run(existingKaw.id, aaravId, kl.h, kl.temp, kl.hr, kl.sbp, kl.dbp, kl.ivig, kl.asp, kl.rash, kl.edem, kl.notes, nurseId, now);
    }
  }

  // --- SERIES 32A: Neonatal Bilious Emesis & Malrotation with Midgut Volvulus ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_volvulus_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      age_days, weight_kg, emesis_color, abdominal_distension,
      abdominal_tenderness, rectal_bleeding_melena, peritonitis_signs,
      hemodynamic_shock, serum_lactate_mmol_l, blood_ph, base_excess_meq_l,
      plain_radiograph_finding, upper_gi_contrast_done, upper_gi_finding,
      doppler_us_whirlpool_sign, doppler_sma_smv_inversion,
      urgency_tier, ladd_procedure_indicated,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'VOLV-20261108-101', '2026-11-08T04:15:00',
      4, 3.2, 'bilious_dark_green', 'mild_epigastric',
      1, 0, 0,
      0, 2.4, 7.32, -4.0,
      'distended_stomach_scant_distal_gas', 1, 'corkscrew_duodenum_positive',
      1, 1,
      'immediate_operating_room_crash', 1,
      'in_operating_room_ladd', ?, 'UGI series confirms corkscrew duodenum. Doppler shows clockwise whirlpool sign with SMA/SMV inversion. Emergent Ladd procedure initiated.', ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingVolv = db.prepare('SELECT id FROM neonatal_volvulus_episodes WHERE episode_code = ?').get('VOLV-20261108-101') as any;
  if (existingVolv) {
    const volvLogs = [
      { h: 1.0, lac: 2.4, hr: 165, sbp: 66, dbp: 38, cr: 2.5, ng: 18.0, asp: 'Dark green bilious fluid', abd: 'Epigastrium full, soft', notes: 'Replogle 8 Fr placed to low continuous suction, NS bolus running.' },
      { h: 2.5, lac: 2.2, hr: 155, sbp: 70, dbp: 40, cr: 2.0, ng: 12.0, asp: 'Green fluid clearing slightly', abd: 'Abdomen relaxed', notes: 'Pediatric surgery scrubbed, patient transferred to Operating Room 2.' },
      { h: 5.0, lac: 1.6, hr: 142, sbp: 74, dbp: 42, cr: 2.0, ng: 6.0, asp: 'Serous aspirate', abd: 'Post-op dressings intact, soft', notes: 'Ladd detorsion, Ladd bands divided, appendectomy performed. Intestine viable.' },
    ];
    for (const vl of volvLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_volvulus_flowsheet_logs (
          volvulus_episode_id, patient_id, log_datetime, hours_from_onset,
          serum_lactate_mmol_l, heart_rate, blood_pressure_sys, blood_pressure_dia,
          capillary_refill_seconds, ng_tube_output_ml, ng_aspirate_appearance,
          abdominal_exam_notes, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T05:30:00', ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingVolv.id, babyId, vl.h, vl.lac, vl.hr, vl.sbp, vl.dbp, vl.cr, vl.ng, vl.asp, vl.abd, vl.notes, nurseId, now);
    }
  }

  // --- SERIES 32B: Obstetric External Cephalic Version (ECV) & Breech Conversion ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_ecv_episodes (
      patient_id, admission_id, episode_code, procedure_datetime,
      gestational_age_weeks, maternal_parity, maternal_bmi,
      fetal_presentation_initial, placental_location, amniotic_fluid_index_cm,
      estimated_fetal_weight_g, fetal_spine_position, fetal_engagement_level,
      tocolytic_agent_administered, terbutaline_given, maternal_rh_negative,
      rh_anti_d_administered, kleihauer_betke_sent, contraindications_present,
      attempts_count, forward_roll_attempted, backward_flip_attempted,
      ecv_outcome, calculated_success_probability_pct, status,
      consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'ECV-20261108-101', '2026-11-08T07:15:00',
      37.3, 1, 26.2,
      'frank_breech', 'posterior', 13.2,
      3150, 'lateral', 'high_unengaged_floating',
      'terbutaline_0_25mg_sc', 1, 1,
      1, 1, 0,
      1, 1, 0,
      'successful_cephalic_conversion', 78.0, 'successful_monitoring_discharge',
      ?, 'Premedicated with Terbutaline 0.25 mg SC. Forward roll completed on attempt 1. Anti-D 300 mcg IM given and KB test sent.', ?, ?
    )
  `).run(meeraId, docId, now, now);

  const existingEcv = db.prepare('SELECT id FROM obstetric_ecv_episodes WHERE episode_code = ?').get('ECV-20261108-101') as any;
  if (existingEcv) {
    const ecvLogs = [
      { m: 0.0, hr: 82, sbp: 116, dbp: 72, fhr: 142, efm: 'reactive_reassuring', tone: 1, notes: 'Baseline NST reactive. Terbutaline 0.25 mg SC given at T-15m.' },
      { m: 15.0, hr: 98, sbp: 112, dbp: 68, fhr: 138, efm: 'reactive_reassuring', tone: 1, notes: 'Uterus palpably soft. Single forward roll executed. Cephalic lie verified on ultrasound.' },
      { m: 45.0, hr: 86, sbp: 118, dbp: 74, fhr: 140, efm: 'reactive_reassuring', tone: 1, notes: 'Post-procedure CTG reassuring, normal baseline variability, no decelerations.' },
    ];
    for (const el of ecvLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_ecv_flowsheet_logs (
          ecv_episode_id, patient_id, log_datetime, minutes_from_start,
          maternal_heart_rate, maternal_blood_pressure_sys, maternal_blood_pressure_dia,
          fetal_heart_rate_baseline, efm_pattern, uterine_relaxation_adequate,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T07:30:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingEcv.id, meeraId, el.m, el.hr, el.sbp, el.dbp, el.fhr, el.efm, el.tone, el.notes, nurseId, now);
    }
  }

  // --- SERIES 32C: Pediatric DKA Cerebral Edema & Emergent Hyperosmolar Rescue ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_dka_cerebral_edema_episodes (
      patient_id, admission_id, episode_code, detection_datetime,
      age_years, weight_kg, gcs_score, headache_severe_sudden,
      lethargy_or_confusion, recurrent_emesis_post_hydration,
      bradycardia_cushing_triad, hypertension_diastolic_ge_90,
      cranial_nerve_palsy, pupillary_abnormality, decorticate_decerebrate_posturing,
      blood_glucose_mg_dl, serum_sodium_measured_meq_l, serum_sodium_corrected_meq_l,
      serum_potassium_meq_l, effective_serum_osmolality_mosm_kg, blood_ph,
      serum_bicarbonate_meq_l, muir_criteria_category, primary_hyperosmolar_agent,
      hyperosmolar_dose_ml, fluid_rate_reduced_by_30pct, head_of_bed_elevated_30deg,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'DKACE-20261108-101', '2026-11-08T05:45:00',
      8.0, 25.0, 11, 1,
      1, 1,
      1, 1,
      0, 'sluggish', 0,
      620.0, 131.0, 139.3,
      4.2, 296.4, 7.08,
      6.5, 'diagnostic_cerebral_edema', 'hypertonic_saline_3pct',
      125.0, 1, 1,
      'hypertonic_saline_infusing', ?, 'Child with severe DKA developed sudden headache, lethargy, bradycardia (HR 62), and diastolic BP 94. 3% Hypertonic Saline 125 mL infused over 15 min.', ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingDkaCe = db.prepare('SELECT id FROM pediatric_dka_cerebral_edema_episodes WHERE episode_code = ?').get('DKACE-20261108-101') as any;
  if (existingDkaCe) {
    const dkaCeLogs = [
      { h: 0.5, gcs: 11, pup: 'Sluggish 3mm bilateral', hr: 64, sbp: 132, dbp: 94, glu: 600, na: 131, corr: 139.0, agent: '3% NaCl 125 mL running', rate: 70, notes: 'Fluid rate dropped by 30%, head of bed elevated to 30 degrees.' },
      { h: 1.5, gcs: 13, pup: 'Prompt 3mm bilateral', hr: 88, sbp: 120, dbp: 78, glu: 490, na: 135, corr: 141.2, agent: '3% NaCl completed', rate: 70, notes: 'Cushing triad resolving. Sensorium significantly improved. Alert to name.' },
      { h: 4.0, gcs: 15, pup: 'Brisk 3mm equal', hr: 96, sbp: 112, dbp: 70, glu: 320, na: 138, corr: 141.5, agent: 'Maintenance with D5W 0.45% NaCl', rate: 75, notes: 'Full neurological recovery. GCS 15. Measured sodium safely rising as glucose declines.' },
    ];
    for (const dcl of dkaCeLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_dka_cerebral_edema_flowsheet_logs (
          dka_cerebral_episode_id, patient_id, log_datetime, hours_from_detection,
          gcs_score, pupil_size_and_reactivity, heart_rate,
          blood_pressure_sys, blood_pressure_dia, blood_glucose_mg_dl,
          serum_sodium_measured_meq_l, serum_sodium_corrected_meq_l,
          hyperosmolar_agent_given, iv_fluid_rate_ml_hr,
          neurological_exam_notes, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T06:30:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?, ?
        )
      `).run(existingDkaCe.id, aaravId, dcl.h, dcl.gcs, dcl.pup, dcl.hr, dcl.sbp, dcl.dbp, dcl.glu, dcl.na, dcl.corr, dcl.agent, dcl.rate, dcl.notes, dcl.notes, nurseId, now);
    }
  }

  // --- SERIES 33A: Neonatal Meconium Ileus & Cystic Fibrosis Gastrografin Decompression ---
  db.prepare(`
    INSERT OR IGNORE INTO neonatal_meconium_ileus_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      age_hours, weight_kg, meconium_passed_yet, abdominal_distension,
      emesis_character, palpable_doughy_masses, family_history_cystic_fibrosis,
      plain_abdominal_xray_findings, contrast_enema_performed, contrast_enema_type,
      microcolon_confirmed, meconium_pellets_visualized, complication_present,
      enema_attempts_count, enema_success_outcome, surgery_indicated,
      surgical_procedure_planned, cftr_gene_mutation_sent, pancreatic_enzyme_replacement_started,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'MECIL-20261108-101', '2026-11-08T04:00:00',
      24, 3.1, 0, 'marked_tense',
      'bilious_green', 1, 0,
      'neuhauser_soap_bubble_sign', 1, 'gastrografin_dilute',
      1, 1, 'uncomplicated_simple_ileus',
      1, 'successful_evacuation_reflux_into_ileum', 0,
      'none_medical_decompression', 1, 0,
      'initial_contrast_decompression', ?, 'Neonate with failure to pass meconium, bilious emesis, RLQ doughy masses and Neuhauser sign on KUB. Therapeutic dilute Gastrografin (1:3) fluoroscopic enema performed with reflux into dilated terminal ileum and evacuation of inspissated plugs.', ?, ?
    )
  `).run(babyId, docId, now, now);

  const existingMecIl = db.prepare('SELECT id FROM neonatal_meconium_ileus_episodes WHERE episode_code = ?').get('MECIL-20261108-101') as any;
  if (existingMecIl) {
    const mecLogs = [
      { h: 2.0, girth: 32.0, aspMl: 14, aspCol: 'Dark green bilious', evac: 'large_thick_meconium_plug', hyd: 'euvolemic', uop: 2.1, na: 139, hr: 152, notes: 'Enema reflux into dilated distal ileum achieved under fluoroscopy. Passage of thick dark plugs with mucus.' },
      { h: 6.0, girth: 30.5, aspMl: 6, aspCol: 'Light green gastric', evac: 'copious_liquid_meconium', hyd: 'euvolemic', uop: 2.8, na: 138, hr: 144, notes: 'Abdomen softer, girth decreased by 1.5 cm. Continued evacuation of liquefied meconium. IV maintenance running.' },
      { h: 12.0, girth: 29.0, aspMl: 2, aspCol: 'Clear gastric', evac: 'copious_liquid_meconium', hyd: 'euvolemic', uop: 3.2, na: 140, hr: 138, notes: 'Complete relief of obstruction. Normal active bowel sounds. Awaiting CFTR mutation panel.' },
    ];
    for (const ml of mecLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO neonatal_meconium_ileus_flowsheet_logs (
          meconium_ileus_episode_id, patient_id, log_datetime, hours_from_onset,
          abdominal_girth_cm, gastric_aspirate_ml, gastric_aspirate_color,
          meconium_evacuated_amount, hydration_status, urine_output_ml_kg_hr,
          serum_sodium_meq_l, heart_rate, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T05:00:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingMecIl.id, babyId, ml.h, ml.girth, ml.aspMl, ml.aspCol, ml.evac, ml.hyd, ml.uop, ml.na, ml.hr, ml.notes, nurseId, now);
    }
  }

  // --- SERIES 33B: Obstetric Placental Abruption & Consumptive Coagulopathy ---
  db.prepare(`
    INSERT OR IGNORE INTO obstetric_placental_abruption_episodes (
      patient_id, admission_id, episode_code, presentation_datetime,
      gestational_age_weeks, maternal_parity, vaginal_bleeding_severity,
      abdominal_pain_character, uterine_tonus, fetal_heart_rate_status,
      maternal_systolic_bp, maternal_diastolic_bp, maternal_heart_rate,
      serum_fibrinogen_mg_dl, platelet_count, hemoglobin_g_dl, pt_inr,
      kleihauer_betke_sent, ultrasound_retroplacental_hematoma, page_classification_grade,
      mtp_activated, prbc_units_transfused, ffp_units_transfused,
      cryoprecipitate_pools_transfused, delivery_mode_indicated,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'ABRUPT-20261108-101', '2026-11-08T05:30:00',
      35.5, 1, 'moderate_bleeding',
      'severe_constant_knife_like', 'tetanic_woody_hard', 'severe_bradycardia_category_3',
      92, 54, 128,
      135.0, 92000, 8.4, 1.4,
      1, 'retroplacental_hematoma_present', 'grade_3_severe_maternal_shock_demise_or_dic',
      1, 2, 2,
      2, 'emergent_crash_cesarean',
      'crash_cesarean_in_progress', ?, 'G2P1 at 35+5 weeks presented with sudden woody rigid uterus, dark vaginal bleeding, shock index 1.39, severe fetal bradycardia (FHR 90 bpm), and hypofibrinogenemia 135 mg/dL. Code Crimson / Crash Cesarean Category 1 initiated with MTP 1:1:1 and Cryoprecipitate.', ?, ?
    )
  `).run(anitaId, docId, now, now);

  const existingAbrupt = db.prepare('SELECT id FROM obstetric_placental_abruption_episodes WHERE episode_code = ?').get('ABRUPT-20261108-101') as any;
  if (existingAbrupt) {
    const abLogs = [
      { m: 10.0, hr: 130, sbp: 90, dbp: 52, fhr: 88, tone: 'woody_rigid', loss: 500, fib: 135, prod: 'Pack 1 MTP requested, 2U O-neg PRBC on rapid warmer', notes: 'Crash Category 1 cesarean call activated, transfer to OT 1.' },
      { m: 25.0, hr: 114, sbp: 98, dbp: 58, fhr: 95, tone: 'woody_rigid', loss: 850, fib: 145, prod: '2U PRBC and 2 pools Cryoprecipitate infusing', notes: 'Rapid delivery of live male infant, APGAR 4/7, NICU resus team present. Retropacental clot ~400 mL evacuated.' },
      { m: 60.0, hr: 92, sbp: 112, dbp: 70, fhr: null, tone: 'soft_relaxed_between_contractions', loss: 1050, fib: 215, prod: 'Cryo 2 pools completed, TXA 1g IV finished', notes: 'Couvelaire uterus noted, uterine hemostasis secured with B-Lynch suture and Carbetocin. Fibrinogen corrected to >200 mg/dL.' },
    ];
    for (const abl of abLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO obstetric_placental_abruption_flowsheet_logs (
          abruption_episode_id, patient_id, log_datetime, minutes_from_presentation,
          maternal_heart_rate, maternal_blood_pressure_sys, maternal_blood_pressure_dia,
          fetal_heart_rate, uterine_tone_assessment, vaginal_blood_loss_ml,
          fibrinogen_mg_dl, blood_products_infused, notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T05:40:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(existingAbrupt.id, anitaId, abl.m, abl.hr, abl.sbp, abl.dbp, abl.fhr, abl.tone, abl.loss, abl.fib, abl.prod, abl.notes, nurseId, now);
    }
  }

  // --- SERIES 33C: Pediatric Hemolytic Uremic Syndrome (STEC-HUS & aHUS) ---
  db.prepare(`
    INSERT OR IGNORE INTO pediatric_hus_episodes (
      patient_id, admission_id, episode_code, onset_datetime,
      age_years, weight_kg, prodromal_bloody_diarrhea, shiga_toxin_tested,
      shiga_toxin_result, hemoglobin_g_dl, platelet_count, serum_creatinine_mg_dl,
      baseline_creatinine_mg_dl, kdigo_aki_stage, schistocytes_present_pct,
      serum_ldh_u_l, direct_coombs_test, serum_potassium_meq_l,
      oliguria_anuria_duration_hours, hypertension_present, neurological_involvement,
      hus_phenotype, antibiotics_avoided_strict, antimotility_agents_avoided,
      dialysis_rrt_indicated, dialysis_modality, eculizumab_indicated,
      status, consultant_id, clinical_notes, created_at, updated_at
    ) VALUES (
      ?, NULL, 'HUS-20261108-101', '2026-11-08T03:00:00',
      4.5, 16.0, 1, 1,
      'positive_stec', 7.1, 38000, 2.9,
      0.4, 'stage_3_failure', 3.8,
      2240, 'negative', 5.6,
      18.0, 1, 'lethargy_irritability',
      'typical_stec_d_plus', 1, 1,
      1, 'peritoneal_dialysis', 0,
      'active_fluid_electrolyte_management', ?, '4.5-year-old presenting 5 days post bloody diarrhea with classic STEC-HUS triad: Coombs-negative MAHA (Hb 7.1, schistocytes 3.8%, LDH 2240), severe thrombocytopenia (38k), and KDIGO stage 3 anuric AKI (Cr 2.9 vs base 0.4). Strict withholding of antibiotics; PD catheter placement arranged for volume overload and hyperkalemia.', ?, ?
    )
  `).run(aaravId, docId, now, now);

  const existingHus = db.prepare('SELECT id FROM pediatric_hus_episodes WHERE episode_code = ?').get('HUS-20261108-101') as any;
  if (existingHus) {
    const husLogs = [
      { h: 2.0, uop: 0.2, bal: 150, plt: 36000, cr: 3.0, k: 5.7, sbp: 122, dbp: 78, neuro: 'irritable', uf: 0, notes: 'Strict fluid restriction to insensible losses (400 mL/m2/day) + UOP. Kayexalate 1g/kg given PR for K+ 5.7.' },
      { h: 6.0, uop: 0.1, bal: 80, plt: 34000, cr: 3.3, k: 5.4, sbp: 118, dbp: 74, neuro: 'somnolent', uf: 180, notes: 'Peritoneal dialysis initiated with 1.5% Dianeal 15 mL/kg dwell cycles. Serum potassium controlled.' },
      { h: 12.0, uop: 0.4, bal: -120, plt: 42000, cr: 2.8, k: 4.8, sbp: 110, dbp: 68, neuro: 'alert', uf: 340, notes: 'Good ultrafiltration on PD. Sensorium normalized, alert and drinking sips. Platelets stabilizing.' },
    ];
    for (const hl of husLogs) {
      db.prepare(`
        INSERT OR IGNORE INTO pediatric_hus_flowsheet_logs (
          hus_episode_id, patient_id, log_datetime, hours_from_onset,
          urine_output_ml_kg_hr, fluid_balance_24h_ml, platelet_count,
          serum_creatinine_mg_dl, serum_potassium_meq_l, blood_pressure_sys,
          blood_pressure_dia, neurological_status, dialysis_ultrafiltration_ml,
          notes, logged_by_id, created_at
        ) VALUES (
          ?, ?, '2026-11-08T04:00:00', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `).run(existingHus.id, aaravId, hl.h, hl.uop, hl.bal, hl.plt, hl.cr, hl.k, hl.sbp, hl.dbp, hl.neuro, hl.uf, hl.notes, nurseId, now);
    }
  }

  // Book today's outpatient appointments for the active queue
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
