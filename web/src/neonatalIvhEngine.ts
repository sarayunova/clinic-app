// Pure TypeScript Clinical Calculation Engine: Neonatal Intraventricular Hemorrhage (IVH) & Post-Hemorrhagic Hydrocephalus (PHH)
// References: Papile et al. (J Pediatr 1978); Volpe (Neurology of the Newborn 2008); Levene (Arch Dis Child 1981); ELVIS Trial (Pediatrics 2019)

export type PapileGrade =
  | 'grade_1_subependymal'
  | 'grade_2_intraventricular_normal_size'
  | 'grade_3_intraventricular_dilatation'
  | 'grade_4_periventricular_infarction';

export type HemorrhageLaterality = 'unilateral_left' | 'unilateral_right' | 'bilateral';

export type PhhInterventionModality =
  | 'conservative_surveillance'
  | 'serial_lumbar_punctures'
  | 'ventricular_access_device_reservoir'
  | 'subgaleal_shunt'
  | 'permanent_vp_shunt';

export interface NeonatalIvhInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  chronologicalAgeDays: number;
  currentPmaWeeks: number;
  currentWeightGrams: number;

  papileGrade: PapileGrade;
  hemorrhageLaterality: HemorrhageLaterality;
  parenchymalInfarctionLocation?: string;

  // Ventricular Measurements (cranial ultrasound coronal & parasagittal)
  ventricularIndexLeftMm: number;
  ventricularIndexRightMm: number;
  anteriorHornWidthLeftMm: number;
  anteriorHornWidthRightMm: number;
  thalamoOccipitalDistanceMm?: number;
  resistiveIndexAca?: number; // Doppler of anterior cerebral artery (normal 0.65 - 0.75, > 0.85 = raised ICP)

  // Clinical & Cranial Growth
  headCircumferenceCm: number;
  headCircumferenceGrowthCmWeek?: number; // threshold > 1.5 cm/week indicates excessive expansion
  fontanelleTension?: 'normal_soft' | 'full' | 'bulging_tense';
  splitSutures?: boolean;
  apneasOrBradycardiasPresent?: boolean;

  // Laboratory / CSF if performed
  csfProteinGL?: number; // threshold < 1.5 g/L required before permanent VP shunt to avoid blockage
  csfRbcCount?: number;
}

export interface NeonatalIvhEvaluation {
  papileGrade: PapileGrade;
  papileGradeLabel: string;
  hemorrhageLaterality: HemorrhageLaterality;
  maxVentricularIndexMm: number;
  maxAnteriorHornWidthMm: number;

  // Levene Curve
  levene97thPercentileMm: number;
  leveneActionLineThresholdMm: number; // 97th percentile + 4 mm (Davies & Levene criteria)
  ventricularIndexExceeds97th: boolean;
  actionLineThresholdCrossed: boolean;
  phhInterventionThresholdCrossed: boolean;

  resistiveIndexElevated: boolean;
  headGrowthAccelerated: boolean;
  recommendedIntervention: PhhInterventionModality;
  interventionGuidance: string;
  vpShuntReadiness: {
    csfProteinAcceptable: boolean;
    weightAcceptable: boolean;
    readyForVpShunt: boolean;
    criteriaNotes: string;
  };
  summary: string;
  clinicalActionPlan: string[];
}

/**
 * Calculates Levene 97th percentile and Davies action line (+4 mm) based on Postmenstrual Age (PMA).
 * Levene standard curve (26 to 42 weeks PMA).
 */
export function calculateLeveneThresholds(pmaWeeks: number): { levene97th: number; actionLine: number } {
  const clampedPma = Math.max(26.0, Math.min(42.0, pmaWeeks));
  // Baseline at 26w is 11.5 mm, rises approx 0.25 mm/week to 15.0 mm at 40w
  const levene97th = Math.round((11.5 + (clampedPma - 26.0) * 0.25) * 10) / 10;
  const actionLine = Math.round((levene97th + 4.0) * 10) / 10;
  return { levene97th, actionLine };
}

/**
 * Evaluates comprehensive neonatal IVH staging, Levene PHH threshold crossing, and neurosurgical intervention timing.
 */
export function evaluateNeonatalIvh(input: NeonatalIvhInput): NeonatalIvhEvaluation {
  const { levene97th, actionLine } = calculateLeveneThresholds(input.currentPmaWeeks);
  const maxVentricularIndexMm = Math.max(input.ventricularIndexLeftMm, input.ventricularIndexRightMm);
  const maxAnteriorHornWidthMm = Math.max(input.anteriorHornWidthLeftMm, input.anteriorHornWidthRightMm);

  const ventricularIndexExceeds97th = maxVentricularIndexMm > levene97th;
  const actionLineThresholdCrossed = maxVentricularIndexMm >= actionLine;

  const resistiveIndexElevated = input.resistiveIndexAca !== undefined && input.resistiveIndexAca > 0.85;
  const headGrowthAccelerated = input.headCircumferenceGrowthCmWeek !== undefined && input.headCircumferenceGrowthCmWeek >= 1.5;
  const clinicalRaisedIcp = input.fontanelleTension === 'bulging_tense' || Boolean(input.splitSutures) || Boolean(input.apneasOrBradycardiasPresent);

  // ELVIS Trial (Early vs Late Ventricular Intervention Study):
  // Intervention is triggered when VI exceeds 97th percentile + 4 mm (action line) OR
  // when VI exceeds 97th percentile with AHW > 6 mm or clinical signs of raised ICP.
  const phhInterventionThresholdCrossed = Boolean(
    actionLineThresholdCrossed ||
    (ventricularIndexExceeds97th && (maxAnteriorHornWidthMm >= 6.0 || headGrowthAccelerated || clinicalRaisedIcp || resistiveIndexElevated))
  );

  let recommendedIntervention: PhhInterventionModality = 'conservative_surveillance';
  let interventionGuidance = 'Serial cranial ultrasound surveillance every 3-5 days. Monitor head circumference twice weekly.';

  const isLowWeight = input.currentWeightGrams < 2000;

  if (phhInterventionThresholdCrossed) {
    if (isLowWeight) {
      recommendedIntervention = 'ventricular_access_device_reservoir';
      interventionGuidance = 'MANDATORY PEDIATRIC NEUROSURGERY CONSULTATION: Post-hemorrhagic ventricular dilatation has crossed intervention thresholds. In view of low weight (< 2000g), insert a subcutaneous Ventricular Access Device (Rickham / Ommaya reservoir) or Subgaleal Shunt for serial CSF tapping (10-15 mL/kg/day) to prevent white matter compression.';
    } else {
      recommendedIntervention = 'permanent_vp_shunt';
      interventionGuidance = 'PEDIATRIC NEUROSURGERY EVALUATION: Infant meets criteria for surgical hydrocephalus intervention. If CSF protein < 1.5 g/L and CSF cleared of RBCs, proceed with Ventriculoperitoneal (VP) Shunt placement.';
    }
  } else if (ventricularIndexExceeds97th) {
    recommendedIntervention = 'serial_lumbar_punctures';
    interventionGuidance = 'Ventricular dilatation exceeds 97th percentile but below Davies action line (+4 mm). Daily cranial ultrasound Doppler surveillance. Consider temporizing serial lumbar punctures if communicating hydrocephalus is documented.';
  }

  // VP Shunt Readiness Verification
  const csfProteinAcceptable = input.csfProteinGL === undefined || input.csfProteinGL < 1.5;
  const weightAcceptable = input.currentWeightGrams >= 2000;
  const readyForVpShunt = csfProteinAcceptable && weightAcceptable && phhInterventionThresholdCrossed;

  let criteriaNotes = 'VP shunt requires infant weight >= 2000g and CSF protein < 1.5 g/L to minimize obstruction and infection risk.';
  if (!csfProteinAcceptable) {
    criteriaNotes = `CSF protein elevated (${input.csfProteinGL} g/L >= 1.5 g/L). High risk of VP shunt malfunction. Temporize with reservoir tapping.`;
  } else if (!weightAcceptable) {
    criteriaNotes = `Current weight (${input.currentWeightGrams}g < 2000g). Temporize with subcutaneous reservoir until infant reaches 2.0-2.5 kg.`;
  }

  const papileLabels: Record<PapileGrade, string> = {
    grade_1_subependymal: 'Grade I: Subependymal / Germinal Matrix Hemorrhage',
    grade_2_intraventricular_normal_size: 'Grade II: IVH without Ventricular Enlargement (< 50% lateral ventricle)',
    grade_3_intraventricular_dilatation: 'Grade III: IVH with Acute Ventricular Dilatation (> 50% lateral ventricle)',
    grade_4_periventricular_infarction: 'Grade IV: Periventricular Hemorrhagic Infarction (PVHI / Venous Infarct)',
  };

  const clinicalActionPlan: string[] = [];
  if (phhInterventionThresholdCrossed) {
    clinicalActionPlan.push('Urgent pediatric neurosurgical referral for surgical CSF diversion');
    clinicalActionPlan.push(`Target CSF tapping volume: ${Math.round((input.currentWeightGrams / 1000) * 12)} mL (10-15 mL/kg) per tap if reservoir in place`);
    clinicalActionPlan.push('Maintain midline head positioning and avoid head elevation swings');
    clinicalActionPlan.push('Daily head circumference and anterior fontanelle tension assessment');
  } else {
    clinicalActionPlan.push('Cranial ultrasound re-evaluation in 72 hours (measure VI, AHW, and TOD)');
    clinicalActionPlan.push('Head circumference measurement twice weekly plotted on Fenton / Intergrowth charts');
    clinicalActionPlan.push('Avoid bolus rapid fluid infusions or fluctuations in cerebral blood flow');
  }

  const summary = `Neonatal IVH (${papileLabels[input.papileGrade]}): Max VI ${maxVentricularIndexMm} mm (Levene 97th: ${levene97th} mm, Action Line: ${actionLine} mm). Max AHW ${maxAnteriorHornWidthMm} mm. ${phhInterventionThresholdCrossed ? 'PHH INTERVENTION THRESHOLD CROSSED.' : 'Stable post-hemorrhagic surveillance.'}`;

  return {
    papileGrade: input.papileGrade,
    papileGradeLabel: papileLabels[input.papileGrade],
    hemorrhageLaterality: input.hemorrhageLaterality,
    maxVentricularIndexMm,
    maxAnteriorHornWidthMm,
    levene97thPercentileMm: levene97th,
    leveneActionLineThresholdMm: actionLine,
    ventricularIndexExceeds97th,
    actionLineThresholdCrossed,
    phhInterventionThresholdCrossed,
    resistiveIndexElevated,
    headGrowthAccelerated,
    recommendedIntervention,
    interventionGuidance,
    vpShuntReadiness: {
      csfProteinAcceptable,
      weightAcceptable,
      readyForVpShunt,
      criteriaNotes,
    },
    summary,
    clinicalActionPlan,
  };
}
