// WHO Medical Eligibility Criteria (MEC) & Contraceptive Clinical Decision Engine
// Implements WHO MEC 5th Edition (Categories 1 to 4) for hormonal, intrauterine, barrier, and permanent methods,
// Postpartum IUCD (PPIUCD / post-placental / post-cesarean) and interval Cu-T / LNG-IUS surveillance.

export type MecCategory = 1 | 2 | 3 | 4;

export type ContraceptiveMethod =
  | 'coc_pills'
  | 'pop_mini_pill'
  | 'dmpa_injectable'
  | 'subdermal_implant'
  | 'copper_t'
  | 'lng_ius'
  | 'barrier_condoms'
  | 'emergency_contraception'
  | 'tubal_ligation';

export interface MecEvaluationResult {
  method: ContraceptiveMethod;
  name: string;
  category: MecCategory;
  status: 'eligible' | 'cautious' | 'contraindicated';
  reasons: string[];
  clinicalNotes: string;
}

export interface MedicalConditionOption {
  key: string;
  label: string;
  group: 'postpartum_lactation' | 'cardiovascular' | 'neurological' | 'gynecological_infections' | 'oncology_hepatic' | 'other';
}

export const MEDICAL_CONDITIONS_LIST: MedicalConditionOption[] = [
  // Postpartum & Lactation
  { key: 'postpartum_lt_3w', label: 'Postpartum < 3 weeks (not breastfeeding)', group: 'postpartum_lactation' },
  { key: 'breastfeeding_lt_6w', label: 'Exclusively breastfeeding (< 6 weeks postpartum)', group: 'postpartum_lactation' },
  { key: 'breastfeeding_6w_6m', label: 'Breastfeeding (6 weeks to 6 months)', group: 'postpartum_lactation' },
  { key: 'postpartum_48h_to_4w', label: 'Postpartum between 48 hours and 4 weeks (IUCD insertion window)', group: 'postpartum_lactation' },

  // Cardiovascular
  { key: 'age_gte_35_smoking_gt_15', label: 'Age ≥ 35 and smoking ≥ 15 cigarettes/day', group: 'cardiovascular' },
  { key: 'age_gte_35_smoking_lt_15', label: 'Age ≥ 35 and smoking < 15 cigarettes/day', group: 'cardiovascular' },
  { key: 'hypertension_severe', label: 'Severe hypertension (Systolic ≥ 160 or Diastolic ≥ 100 mmHg)', group: 'cardiovascular' },
  { key: 'hypertension_moderate', label: 'Moderate hypertension (Systolic 140–159 or Diastolic 90–99 mmHg)', group: 'cardiovascular' },
  { key: 'history_dvt_pe', label: 'History of or acute Deep Vein Thrombosis (DVT) / Pulmonary Embolism (PE)', group: 'cardiovascular' },
  { key: 'known_thrombogenic_mutation', label: 'Known thrombogenic mutations (Factor V Leiden, Prothrombin mutation)', group: 'cardiovascular' },
  { key: 'ischemic_heart_disease', label: 'Known ischemic heart disease or stroke history', group: 'cardiovascular' },

  // Neurological
  { key: 'migraine_with_aura', label: 'Migraine with focal neurological aura (any age)', group: 'neurological' },
  { key: 'migraine_without_aura_gte_35', label: 'Migraine without aura (Age ≥ 35 years)', group: 'neurological' },

  // Gynecological & Infections
  { key: 'current_pid_or_purulent_cervicitis', label: 'Current Pelvic Inflammatory Disease (PID) or purulent cervicitis', group: 'gynecological_infections' },
  { key: 'unexplained_vaginal_bleeding', label: 'Unexplained abnormal vaginal bleeding (suspicious for serious condition)', group: 'gynecological_infections' },
  { key: 'uterine_cavity_distortion', label: 'Anatomical uterine distortion (submucous fibroid, congenital anomaly)', group: 'gynecological_infections' },
  { key: 'heavy_menstrual_bleeding', label: 'Heavy menstrual bleeding / dysmenorrhea (non-malignant)', group: 'gynecological_infections' },
  { key: 'high_sti_risk', label: 'Very high individual likelihood of STI exposure', group: 'gynecological_infections' },

  // Oncology & Hepatic
  { key: 'current_breast_cancer', label: 'Current breast cancer', group: 'oncology_hepatic' },
  { key: 'past_breast_cancer_5y_disease_free', label: 'Past breast cancer (no evidence of disease for 5 years)', group: 'oncology_hepatic' },
  { key: 'active_viral_hepatitis_or_decomp_cirrhosis', label: 'Acute viral hepatitis or decompensated severe cirrhosis', group: 'oncology_hepatic' },

  // Other
  { key: 'diabetes_vascular_complications', label: 'Diabetes with nephropathy / retinopathy / neuropathy or > 20 yrs duration', group: 'other' },
  { key: 'anticonvulsant_enzyme_inducers', label: 'Taking enzyme-inducing anticonvulsants (phenytoin, carbamazepine, topiramate)', group: 'other' },
];

export const IUCD_DEVICE_PROPERTIES: Record<
  string,
  { name: string; type: 'copper' | 'hormonal'; lifespanYears: number; pearlIndex: number; description: string }
> = {
  cu_t_380a: {
    name: 'Copper-T 380A (TCu380A)',
    type: 'copper',
    lifespanYears: 10,
    pearlIndex: 0.6,
    description: 'Gold standard non-hormonal IUD; pure copper surface area 380 mm². High efficacy for 10 full years.',
  },
  cu_t_375: {
    name: 'Multiload Cu-375',
    type: 'copper',
    lifespanYears: 5,
    pearlIndex: 0.8,
    description: 'Flexible serrated side arms for lower expulsion rates in multiparous women; 5-year duration.',
  },
  lng_ius_52mg_mirena: {
    name: 'LNG-IUS 52mg (Mirena)',
    type: 'hormonal',
    lifespanYears: 8,
    pearlIndex: 0.2,
    description: 'Releases levonorgestrel 20 mcg/day; markedly reduces menstrual blood loss and dysmenorrhea; approved for 8 years.',
  },
  lng_ius_19_5mg_kyleena: {
    name: 'LNG-IUS 19.5mg (Kyleena)',
    type: 'hormonal',
    lifespanYears: 5,
    pearlIndex: 0.2,
    description: 'Smaller frame and narrower insertion tube (3.8 mm) ideal for nulliparous women; approved for 5 years.',
  },
};

/**
 * Evaluates WHO Medical Eligibility Criteria (MEC Categories 1 to 4)
 * Returns structured eligibility, caution, and absolute contraindications for each contraceptive method.
 */
export function evaluateWhoMec(conditions: string[]): Record<ContraceptiveMethod, MecEvaluationResult> {
  const condSet = new Set(conditions);

  // Helper to test if any condition in a list is present
  const hasAny = (...keys: string[]) => keys.some((k) => condSet.has(k));

  // 1. Combined Oral Contraceptives (COCs)
  const cocReasons: string[] = [];
  let cocCat: MecCategory = 1;

  if (
    hasAny(
      'age_gte_35_smoking_gt_15',
      'hypertension_severe',
      'history_dvt_pe',
      'known_thrombogenic_mutation',
      'ischemic_heart_disease',
      'migraine_with_aura',
      'postpartum_lt_3w',
      'breastfeeding_lt_6w',
      'current_breast_cancer',
      'active_viral_hepatitis_or_decomp_cirrhosis',
    )
  ) {
    cocCat = 4;
    if (condSet.has('age_gte_35_smoking_gt_15')) cocReasons.push('Age ≥ 35 and smoking ≥ 15 cigs/day: marked myocardial infarction risk (MEC 4).');
    if (condSet.has('hypertension_severe')) cocReasons.push('Severe hypertension (≥ 160/100): substantial cardiovascular risk (MEC 4).');
    if (condSet.has('history_dvt_pe')) cocReasons.push('History of venous thromboembolism: estrogen promotes recurrent clotting (MEC 4).');
    if (condSet.has('migraine_with_aura')) cocReasons.push('Migraine with aura: unacceptable risk of ischemic stroke (MEC 4).');
    if (condSet.has('breastfeeding_lt_6w') || condSet.has('postpartum_lt_3w')) cocReasons.push('Early postpartum / lactation: hypercoagulability and suppression of milk supply (MEC 4).');
    if (condSet.has('current_breast_cancer')) cocReasons.push('Current breast cancer: hormonally responsive tumor (MEC 4).');
    if (condSet.has('active_viral_hepatitis_or_decomp_cirrhosis')) cocReasons.push('Severe hepatic impairment: impaired steroid metabolism (MEC 4).');
  } else if (
    hasAny(
      'age_gte_35_smoking_lt_15',
      'hypertension_moderate',
      'breastfeeding_6w_6m',
      'diabetes_vascular_complications',
      'migraine_without_aura_gte_35',
      'anticonvulsant_enzyme_inducers',
    )
  ) {
    cocCat = 3;
    if (condSet.has('age_gte_35_smoking_lt_15')) cocReasons.push('Age ≥ 35 smoking < 15 cigs: risks outweigh advantages (MEC 3).');
    if (condSet.has('hypertension_moderate')) cocReasons.push('Moderate hypertension: increased vascular risk (MEC 3).');
    if (condSet.has('breastfeeding_6w_6m')) cocReasons.push('Breastfeeding 6w to 6m: potential reduction in breast milk volume (MEC 3).');
    if (condSet.has('anticonvulsant_enzyme_inducers')) cocReasons.push('Enzyme-inducing AEDs: reduced pill contraceptive efficacy (MEC 3).');
  }

  // 2. Progestin-Only Pills (POPs)
  const popReasons: string[] = [];
  let popCat: MecCategory = 1;
  if (condSet.has('current_breast_cancer')) {
    popCat = 4;
    popReasons.push('Current breast cancer: hormonally sensitive tumor (MEC 4).');
  } else if (hasAny('active_viral_hepatitis_or_decomp_cirrhosis', 'ischemic_heart_disease', 'past_breast_cancer_5y_disease_free')) {
    popCat = 3;
    popReasons.push('Severe active liver disease or ischemic disease: theoretical risk (MEC 3).');
  } else if (hasAny('history_dvt_pe', 'migraine_with_aura', 'hypertension_severe')) {
    popCat = 2;
    popReasons.push('Safe estrogen-free alternative for hypertension, DVT, or migraine with aura (MEC 2).');
  }

  // 3. DMPA Injectables (Depo-Provera / Antara)
  const dmpaReasons: string[] = [];
  let dmpaCat: MecCategory = 1;
  if (condSet.has('current_breast_cancer')) {
    dmpaCat = 4;
    dmpaReasons.push('Current breast cancer: hormonally responsive malignancy (MEC 4).');
  } else if (
    hasAny(
      'hypertension_severe',
      'ischemic_heart_disease',
      'unexplained_vaginal_bleeding',
      'diabetes_vascular_complications',
      'active_viral_hepatitis_or_decomp_cirrhosis',
    )
  ) {
    dmpaCat = 3;
    if (condSet.has('hypertension_severe')) dmpaReasons.push('Severe hypertension: DMPA may modestly affect lipid profile/BP (MEC 3).');
    if (condSet.has('unexplained_vaginal_bleeding')) dmpaReasons.push('Unexplained vaginal bleeding: evaluate before initiating amenorrhea-inducing method (MEC 3).');
  } else if (condSet.has('breastfeeding_lt_6w')) {
    dmpaCat = 2; // WHO 2016 update allows DMPA immediately or at 6 weeks
    dmpaReasons.push('Breastfeeding < 6 weeks: advantages generally outweigh theoretical neonatal exposure risks (MEC 2).');
  }

  // 4. Subdermal Implants (Jadelle / Implanon)
  const implantReasons: string[] = [];
  let implantCat: MecCategory = 1;
  if (condSet.has('current_breast_cancer')) {
    implantCat = 4;
    implantReasons.push('Current breast cancer (MEC 4).');
  } else if (hasAny('active_viral_hepatitis_or_decomp_cirrhosis', 'unexplained_vaginal_bleeding')) {
    implantCat = 3;
    implantReasons.push('Evaluate bleeding or active liver disease before placement (MEC 3).');
  }

  // 5. Copper Intrauterine Device (Cu-T 380A / Cu-T 375)
  const cuReasons: string[] = [];
  let cuCat: MecCategory = 1;
  if (
    hasAny(
      'current_pid_or_purulent_cervicitis',
      'unexplained_vaginal_bleeding',
      'uterine_cavity_distortion',
    )
  ) {
    cuCat = 4;
    if (condSet.has('current_pid_or_purulent_cervicitis')) cuReasons.push('Current PID or purulent cervicitis: absolute contraindication to insertion due to upper tract sepsis risk (MEC 4).');
    if (condSet.has('unexplained_vaginal_bleeding')) cuReasons.push('Unexplained vaginal bleeding: investigate to rule out malignancy before insertion (MEC 4).');
    if (condSet.has('uterine_cavity_distortion')) cuReasons.push('Distorted uterine cavity: cannot safely accommodate device / high perforation risk (MEC 4).');
  } else if (hasAny('postpartum_48h_to_4w', 'high_sti_risk')) {
    cuCat = 3;
    if (condSet.has('postpartum_48h_to_4w')) cuReasons.push('Insertion between 48 hours and 4 weeks postpartum has elevated risk of uterine perforation (MEC 3). Best post-placental <48h or interval ≥6w.');
    if (condSet.has('high_sti_risk')) cuReasons.push('High individual STI risk: increased post-insertion pelvic infection risk (MEC 3).');
  } else if (condSet.has('heavy_menstrual_bleeding')) {
    cuCat = 2;
    cuReasons.push('Copper IUD may cause increased menstrual blood loss and cramping (MEC 2).');
  } else {
    cuReasons.push('Non-hormonal: excellent first-line choice unaffected by cardiovascular, migraine, thrombotic, or liver conditions (MEC 1).');
  }

  // 6. Levonorgestrel Intrauterine System (LNG-IUS / Mirena / Kyleena)
  const lngReasons: string[] = [];
  let lngCat: MecCategory = 1;
  if (
    hasAny(
      'current_pid_or_purulent_cervicitis',
      'unexplained_vaginal_bleeding',
      'uterine_cavity_distortion',
      'current_breast_cancer',
    )
  ) {
    lngCat = 4;
    if (condSet.has('current_pid_or_purulent_cervicitis')) lngReasons.push('Current PID or purulent cervicitis: absolute contraindication to insertion (MEC 4).');
    if (condSet.has('current_breast_cancer')) lngReasons.push('Current breast cancer: hormonally active progestin release (MEC 4).');
    if (condSet.has('unexplained_vaginal_bleeding')) lngReasons.push('Unexplained vaginal bleeding: rule out pathology prior to insertion (MEC 4).');
    if (condSet.has('uterine_cavity_distortion')) lngReasons.push('Cavity distortion precludes proper fundal positioning (MEC 4).');
  } else if (hasAny('postpartum_48h_to_4w', 'active_viral_hepatitis_or_decomp_cirrhosis')) {
    lngCat = 3;
    if (condSet.has('postpartum_48h_to_4w')) lngReasons.push('Postpartum 48h to 4w window carries higher perforation risk (MEC 3).');
  } else if (condSet.has('heavy_menstrual_bleeding')) {
    lngReasons.push('Highly recommended: LNG-IUS provides marked therapeutic reduction in heavy menstrual bleeding and dysmenorrhea (MEC 1).');
  }

  // 7. Barrier Methods (Male / Female Condoms)
  const barrierReasons: string[] = ['No medical restrictions (MEC 1). Provides dual protection against sexually transmitted infections (STIs/HIV).'];

  // 8. Emergency Contraception (LNG 1.5mg / Ulipristal Acetate / Cu-T)
  const ecReasons: string[] = ['Highly safe for all women; no medical condition contraindicates single-dose emergency contraception (MEC 1).'];

  // 9. Permanent Tubal Ligation
  const tubalReasons: string[] = [];
  let tubalCat: MecCategory = 1;
  if (hasAny('current_pid_or_purulent_cervicitis', 'hypertension_severe', 'active_viral_hepatitis_or_decomp_cirrhosis')) {
    tubalCat = 3;
    tubalReasons.push('Delay surgical procedure until acute medical condition or infection is fully treated and resolved.');
  } else {
    tubalReasons.push('Acceptable permanent surgical method for women who have completed their desired family size.');
  }

  const toStatus = (cat: MecCategory): 'eligible' | 'cautious' | 'contraindicated' => {
    if (cat === 1 || cat === 2) return 'eligible';
    if (cat === 3) return 'cautious';
    return 'contraindicated';
  };

  return {
    copper_t: {
      method: 'copper_t',
      name: 'Copper Intrauterine Device (Cu-T 380A / 375)',
      category: cuCat,
      status: toStatus(cuCat),
      reasons: cuReasons,
      clinicalNotes: 'Non-hormonal; 5–10 years duration; post-placental PPIUCD or interval insertion.',
    },
    lng_ius: {
      method: 'lng_ius',
      name: 'Levonorgestrel Intrauterine System (Mirena / Kyleena)',
      category: lngCat,
      status: toStatus(lngCat),
      reasons: lngReasons,
      clinicalNotes: 'Local intrauterine progestin delivery; 5–8 years duration; therapeutic for menorrhagia.',
    },
    coc_pills: {
      method: 'coc_pills',
      name: 'Combined Oral Contraceptive Pills (COCs)',
      category: cocCat,
      status: toStatus(cocCat),
      reasons: cocReasons,
      clinicalNotes: 'Estrogen + Progestin oral daily pills; cycle control; requires compliance.',
    },
    pop_mini_pill: {
      method: 'pop_mini_pill',
      name: 'Progestin-Only Pills (POPs / Mini-Pill)',
      category: popCat,
      status: toStatus(popCat),
      reasons: popReasons,
      clinicalNotes: 'Safe during early lactation and for women with estrogen contraindications.',
    },
    dmpa_injectable: {
      method: 'dmpa_injectable',
      name: 'Injectable DMPA (Depo-Provera / Antara)',
      category: dmpaCat,
      status: toStatus(dmpaCat),
      reasons: dmpaReasons,
      clinicalNotes: 'Intramuscular / subcutaneous injection every 3 months (12 weeks).',
    },
    subdermal_implant: {
      method: 'subdermal_implant',
      name: 'Subdermal Contraceptive Implant',
      category: implantCat,
      status: toStatus(implantCat),
      reasons: implantReasons,
      clinicalNotes: 'Long-acting reversible contraception (LARC); 3 to 5 years duration.',
    },
    barrier_condoms: {
      method: 'barrier_condoms',
      name: 'Barrier Methods (Condoms)',
      category: 1,
      status: 'eligible',
      reasons: barrierReasons,
      clinicalNotes: 'Essential for dual protection against STIs/HIV alongside any modern method.',
    },
    emergency_contraception: {
      method: 'emergency_contraception',
      name: 'Emergency Contraception (LNG 1.5mg / Cu-T)',
      category: 1,
      status: 'eligible',
      reasons: ecReasons,
      clinicalNotes: 'Post-coital rescue method within 72–120 hours of unprotected intercourse.',
    },
    tubal_ligation: {
      method: 'tubal_ligation',
      name: 'Permanent Female Sterilization (Tubectomy)',
      category: tubalCat,
      status: toStatus(tubalCat),
      reasons: tubalReasons,
      clinicalNotes: 'Minilap / laparoscopic occlusion; irreversible permanent contraception.',
    },
  };
}

/**
 * Calculates lifespan and projected removal date for an inserted IUD
 */
export function calculateIucdLifespanAndExpiry(
  deviceType: string,
  insertionDateStr: string,
): { lifespanYears: number; expectedRemovalDate: string } {
  const meta = IUCD_DEVICE_PROPERTIES[deviceType] || { lifespanYears: 10 };
  const d = new Date(insertionDateStr);
  if (isNaN(d.getTime())) {
    return { lifespanYears: meta.lifespanYears, expectedRemovalDate: '' };
  }
  const expiry = new Date(d);
  expiry.setFullYear(expiry.getFullYear() + meta.lifespanYears);
  return {
    lifespanYears: meta.lifespanYears,
    expectedRemovalDate: expiry.toISOString().slice(0, 10),
  };
}

/**
 * Evaluates follow-up findings and red flags for an in-situ IUD
 */
export function evaluateFollowupFindings(params: {
  threadStatus: string;
  ultrasoundFinding?: string | null;
  bleedingPattern: string;
  painScore: number;
  infectionSigns: boolean;
}): {
  alertLevel: 'normal' | 'warning' | 'urgent';
  recommendations: string[];
  needUltrasound: boolean;
} {
  const recommendations: string[] = [];
  let alertLevel: 'normal' | 'warning' | 'urgent' = 'normal';
  let needUltrasound = false;

  // 1. Thread Missing or Abnormal
  if (params.threadStatus === 'threads_not_visible') {
    alertLevel = 'warning';
    needUltrasound = true;
    recommendations.push('Strings not visible: Order pelvic ultrasound to differentiate expulsion vs uterine perforation vs curled endocervical threads. Advise barrier backup.');
  } else if (params.threadStatus === 'threads_long') {
    alertLevel = 'warning';
    needUltrasound = true;
    recommendations.push('Lengthened threads: Assess for partial expulsion or cervical displacement.');
  }

  // 2. Ultrasound Complications
  if (params.ultrasoundFinding === 'perforation_extrauterine' || params.ultrasoundFinding === 'myometrial_embedment') {
    alertLevel = 'urgent';
    recommendations.push('IUD displacement / perforation verified on ultrasound: Surgical or hysteroscopic/laparoscopic removal indicated.');
  } else if (params.ultrasoundFinding === 'low_lying_cervical') {
    alertLevel = 'warning';
    recommendations.push('Low-lying IUD in lower uterine segment: Reduced efficacy; offer gentle extraction and immediate replacement.');
  }

  // 3. Pelvic Infection / Sepsis
  if (params.infectionSigns) {
    alertLevel = 'urgent';
    recommendations.push('Signs of acute pelvic infection (PID / endometritis): Initiate broad-spectrum parenteral/oral antibiotics. If no improvement within 48-72h, remove IUD.');
  }

  // 4. Pain and Bleeding
  if (params.painScore >= 7) {
    if (alertLevel === 'normal') alertLevel = 'warning';
    recommendations.push('Severe pelvic pain (VAS ≥ 7): Investigate for myometrial spasm, embedment, or pelvic pathology.');
  }

  if (params.bleedingPattern === 'heavy_prolonged_bleeding') {
    if (alertLevel === 'normal') alertLevel = 'warning';
    recommendations.push('Heavy prolonged bleeding: Check hemoglobin; prescribe tranexamic acid / NSAIDs (mefenamic acid); consider LNG-IUS switch if using Copper IUD.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Reassuring follow-up: Threads visible, normal length; no signs of expulsion or infection. Continue routine annual surveillance.');
  }

  return { alertLevel, recommendations, needUltrasound };
}
