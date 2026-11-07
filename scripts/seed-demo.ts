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
