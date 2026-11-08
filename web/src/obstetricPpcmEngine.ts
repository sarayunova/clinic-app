// Pure TypeScript Clinical Calculation Engine: Obstetric Peripartum Cardiomyopathy (PPCM) & Acute Heart Failure Protocol
// References: ESC Guidelines on Cardiovascular Diseases during Pregnancy; ACOG Practice Bulletin; HFA PPCM Study Group

export type PpcmTimingCategory =
  | 'antepartum_late_third_trimester'
  | 'postpartum_first_month'
  | 'postpartum_months_2_to_5';

export type NyhaFunctionalClass = 'class_i' | 'class_ii' | 'class_iii' | 'class_iv';

export type BromocriptineRegimen =
  | 'none'
  | 'standard_2_5mg_daily_1week'
  | 'intensive_2_5mg_bid_2weeks_then_daily_6weeks';

export type AnticoagulationAgent =
  | 'none'
  | 'lmwh_prophylactic'
  | 'lmwh_therapeutic'
  | 'warfarin_therapeutic_postpartum_only'
  | 'unfractionated_heparin';

export type VasodilatorAgent =
  | 'none'
  | 'hydralazine_nitrates_pregnancy_safe'
  | 'acei_arb_arni_strictly_postpartum_non_lactating'
  | 'nitroprusside_icu_only';

export interface ObstetricPpcmInput {
  maternalAge?: number;
  gestationalAgeWeeks?: number;
  daysPostpartum?: number;
  timingCategory: PpcmTimingCategory;

  nyhaClass: NyhaFunctionalClass;
  lvefPercent: number; // Diagnostic cutoff < 45%; severe < 35%
  lveddMm?: number; // LV end-diastolic diameter (dilation if > 2.7 cm/m2 or > 56 mm)
  ntProbnpPgMl?: number;
  troponinINgMl?: number;
  pulmonaryEdemaPresent: boolean;
  cardiogenicShockPresent: boolean;

  bromocriptineRegimen: BromocriptineRegimen;
  bromocriptineInitiated: boolean;
  anticoagulationPrescribed: boolean;
  anticoagulationAgent: AnticoagulationAgent;
  loopDiureticGiven: boolean;
  betaBlockerGiven: boolean;
  vasodilatorAgent: VasodilatorAgent;
}

export interface ObstetricPpcmEvaluation {
  ppcmDiagnosed: boolean;
  lvefSeverityTier: 'normal_or_recovered' | 'mild_moderate_impairment_35_to_44' | 'severe_dysfunction_lt_35';
  lvefSeverityLabel: string;
  isAntepartum: boolean;

  recommendedBromocriptineRegimen: BromocriptineRegimen;
  bromocriptineRationale: string;
  anticoagulationMandatory: boolean;
  anticoagulationAuditDeficiency: boolean;

  boardProtocolCompliance: {
    bromocriptineCompliant: boolean;
    oralHfCompliant: boolean;
    anticoagulationCompliant: boolean;
    relaxingVasodilatorCompliant: boolean;
    diureticsCompliant: boolean;
  };

  deliveryPlanningGuidance?: string;
  clinicalSafetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Evaluates Peripartum Cardiomyopathy diagnosis, BOARD protocol compliance, and maternal-fetal safety.
 */
export function evaluateObstetricPpcm(input: ObstetricPpcmInput): ObstetricPpcmEvaluation {
  const ppcmDiagnosed = input.lvefPercent < 45.0;
  const isAntepartum = input.timingCategory === 'antepartum_late_third_trimester';

  let lvefSeverityTier: 'normal_or_recovered' | 'mild_moderate_impairment_35_to_44' | 'severe_dysfunction_lt_35' =
    'normal_or_recovered';
  let lvefSeverityLabel = 'LVEF ≥ 45% (Preserved or Recovered EF)';

  if (input.lvefPercent < 35.0) {
    lvefSeverityTier = 'severe_dysfunction_lt_35';
    lvefSeverityLabel = `Severe LV Systolic Dysfunction (LVEF ${input.lvefPercent}% < 35%)`;
  } else if (input.lvefPercent < 45.0) {
    lvefSeverityTier = 'mild_moderate_impairment_35_to_44';
    lvefSeverityLabel = `Mild-Moderate LV Dysfunction (LVEF ${input.lvefPercent}%, 35-44%)`;
  }

  // Recommended Bromocriptine regimen based on ESC PPCM guidelines
  let recommendedBromocriptineRegimen: BromocriptineRegimen = 'none';
  let bromocriptineRationale = '';

  if (lvefSeverityTier === 'severe_dysfunction_lt_35' || input.cardiogenicShockPresent) {
    recommendedBromocriptineRegimen = 'intensive_2_5mg_bid_2weeks_then_daily_6weeks';
    bromocriptineRationale =
      'Intensive Bromocriptine Protocol (2.5 mg BID for 14 days, followed by 2.5 mg daily for 42 days) indicated for severe PPCM (LVEF < 35%) or cardiogenic shock to inhibit toxic 16-kDa prolactin fragment and accelerate myocardial recovery.';
  } else if (ppcmDiagnosed) {
    recommendedBromocriptineRegimen = 'standard_2_5mg_daily_1week';
    bromocriptineRationale =
      'Standard Bromocriptine Protocol (2.5 mg daily for 7 days) indicated for uncomplicated mild/moderate PPCM (LVEF 35-44%) in combination with standard heart failure medical therapy.';
  } else {
    bromocriptineRationale = 'LVEF ≥ 45%: Bromocriptine not indicated.';
  }

  // Anticoagulation is mandatory whenever Bromocriptine is given OR LVEF <= 35% (apical stasis & prothrombotic state)
  const anticoagulationMandatory =
    input.bromocriptineInitiated ||
    lvefSeverityTier === 'severe_dysfunction_lt_35' ||
    input.anticoagulationPrescribed;

  const anticoagulationAuditDeficiency =
    anticoagulationMandatory &&
    (!input.anticoagulationPrescribed || input.anticoagulationAgent === 'none');

  // BOARD Protocol Checklist:
  // B - Bromocriptine
  // O - Oral HF therapy (Beta-blocker)
  // A - Anticoagulation
  // R - Relaxing Vasodilator
  // D - Diuretics
  const boardProtocolCompliance = {
    bromocriptineCompliant: input.bromocriptineInitiated,
    oralHfCompliant: input.betaBlockerGiven,
    anticoagulationCompliant: input.anticoagulationPrescribed && input.anticoagulationAgent !== 'none',
    relaxingVasodilatorCompliant: input.vasodilatorAgent !== 'none',
    diureticsCompliant: input.loopDiureticGiven || !input.pulmonaryEdemaPresent,
  };

  let deliveryPlanningGuidance: string | undefined;
  if (isAntepartum) {
    if (input.cardiogenicShockPresent || lvefSeverityTier === 'severe_dysfunction_lt_35') {
      deliveryPlanningGuidance =
        'URGENT MULTIDISCIPLINARY DELIVERY: Severe antepartum decompensation or cardiogenic shock. Recommend emergency cesarean delivery under invasive arterial/cardiac monitoring in hybrid OR / cardiac surgical suite with ECMO/Impella readiness.';
    } else {
      deliveryPlanningGuidance =
        'STABLE ANTEPARTUM MANAGEMENT: Planned vaginal delivery preferred. Early epidural analgesia reduces cardiac workload. Assisted second stage (vacuum/forceps) avoids prolonged Valsalva-induced afterload spike.';
    }
  }

  const clinicalSafetyDirectives: string[] = [
    'BOARD PROTOCOL: Bromocriptine treatment must ALWAYS be accompanied by therapeutic or prophylactic anticoagulation (LMWH or therapeutic warfarin postpartum) to prevent thrombosis.',
    'CONTRAINDICATION AUDIT: ACE inhibitors, ARBs, and ARNIs (sacubitril/valsartan) are strictly TERATOGENIC and contraindicated during pregnancy (cause fetal renal dysgenesis and oligohydramnios). Hydralazine + nitrates must be used if pregnant.',
    'BETA-BLOCKER SELECTION: Titrate metoprolol succinate or carvedilol slowly once euvolemia is established; avoid atenolol (associated with intrauterine fetal growth restriction).',
    'LACTATION NOTE: Bromocriptine suppresses prolactin and terminates lactation. Women receiving Bromocriptine should be counseled that breastfeeding will cease.',
  ];

  const criticalActionPlan: string[] = [];
  if (ppcmDiagnosed) {
    criticalActionPlan.push(`Initiate ${recommendedBromocriptineRegimen.replace(/_/g, ' ').toUpperCase()}`);
    if (anticoagulationAuditDeficiency) {
      criticalActionPlan.push(
        'CRITICAL SAFETY AUDIT ERROR: Anticoagulation is MANDATORY with Bromocriptine / severe LV dysfunction. Prescribe prophylactic or therapeutic LMWH immediately!',
      );
    } else {
      criticalActionPlan.push(`Maintain anticoagulation with ${input.anticoagulationAgent.replace(/_/g, ' ')}`);
    }
    if (input.pulmonaryEdemaPresent) {
      criticalActionPlan.push('Decongest with IV loop diuretics (furosemide 20-40 mg IV); position semi-upright.');
    }
    if (input.cardiogenicShockPresent) {
      criticalActionPlan.push(
        'STAT CARDIOGENIC SHOCK: Inotropic support (dobutamine or milrinone); urgent cardiology/ICU consultation for mechanical circulatory support (Impella/ECMO).',
      );
    }
  } else {
    criticalActionPlan.push('Routine post-decompensation echocardiographic surveillance.');
  }

  const summary = `Obstetric PPCM (${lvefSeverityLabel}): NYHA ${input.nyhaClass.replace(/_/g, ' ').toUpperCase()}. ${input.bromocriptineInitiated ? 'Bromocriptine initiated.' : 'Bromocriptine pending.'} ${anticoagulationAuditDeficiency ? 'WARNING: ANTICOAGULATION OMISSION DEFICIENCY.' : 'Anticoagulation covered.'}`;

  return {
    ppcmDiagnosed,
    lvefSeverityTier,
    lvefSeverityLabel,
    isAntepartum,
    recommendedBromocriptineRegimen,
    bromocriptineRationale,
    anticoagulationMandatory,
    anticoagulationAuditDeficiency,
    boardProtocolCompliance,
    deliveryPlanningGuidance,
    clinicalSafetyDirectives,
    summary,
    criticalActionPlan,
  };
}
