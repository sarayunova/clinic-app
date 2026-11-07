/**
 * Perinatal Loss & Intrauterine Fetal Demise (IUFD) Workup Engine
 *
 * References:
 * - RCOG Green-top Guideline No. 55: Late Intrauterine Fetal Death and Stillbirth.
 * - ACOG Practice Bulletin No. 200: Early Pregnancy Loss.
 * - Gardosi et al. ReCoDe (Relevant Condition at Death) Classification.
 * - WHO Standards for Stillbirth Investigation and Audit.
 */

export type LossType =
  | 'early_miscarriage_lt_12w'
  | 'late_miscarriage_12_20w'
  | 'stillbirth_antepartum'
  | 'stillbirth_intrapartum'
  | 'neonatal_death_early'
  | 'medical_termination_anomaly';

export type PrimaryCauseCategory =
  | 'fetal_anomaly_genetic'
  | 'umbilical_cord_accident'
  | 'placental_insufficiency_infarction'
  | 'placental_abruption'
  | 'chorioamnionitis_infection'
  | 'maternal_medical_preeclampsia'
  | 'maternal_medical_diabetes'
  | 'maternal_cholestasis_icp'
  | 'intrapartum_asphyxia'
  | 'unexplained_idiopathic';

export type RecurrenceRiskCategory =
  | 'low_less_than_1_pct'
  | 'moderate_2_to_5_pct'
  | 'high_gt_5_pct'
  | 'dependent_on_genetics';

export interface PerinatalLossInput {
  lossType: LossType;
  gestationalAgeWeeks: number;
  gestationalAgeDays?: number;
  fetalBirthWeightG?: number;
  primaryCauseCategory: PrimaryCauseCategory;
  primaryCauseDetails?: string;
  maternalBloodGroup?: string; // e.g. "O_negative", "A_positive"
  fetomaternalHemorrhageMl?: number; // from Kleihauer-Betke
  autopsyConsentStatus?: 'full_autopsy' | 'limited_autopsy' | 'external_and_imaging' | 'declined';
  cmaChromosomalResult?: string;
  placentalHistologyFindings?: string;
}

export interface DiagnosticChecklistSummary {
  totalItems: number;
  completedItems: number;
  completionRatePercent: number;
  pendingInvestigations: string[];
}

export interface PerinatalLossAuditResult {
  lossClassification: string;
  causeCategoryLabel: string;
  recurrenceRiskCategory: RecurrenceRiskCategory;
  recurrenceRiskPercentageText: string;
  antiDRecommendation: {
    indicated: boolean;
    recommendedDoseMcg: number;
    rationale: string;
  };
  lactationSuppressionPlan: string;
  futurePregnancyPlan: string[];
  bereavementGuidelines: string[];
}

export function calculateAntiDRequirements(
  bloodGroup?: string,
  fmhMl?: number,
): { indicated: boolean; recommendedDoseMcg: number; rationale: string } {
  const isRhNegative =
    bloodGroup &&
    (bloodGroup.toLowerCase().includes('negative') || bloodGroup.toLowerCase().includes('neg') || bloodGroup.toLowerCase().includes('-'));

  if (!isRhNegative) {
    return {
      indicated: false,
      recommendedDoseMcg: 0,
      rationale: 'Maternal blood group is Rh(D)-positive; Anti-D immunoglobulin is not indicated.',
    };
  }

  const fmh = fmhMl || 0;
  // Standard 300 mcg (1500 IU) covers up to 30 mL of fetal whole blood (or 15 mL fetal RBCs).
  // If FMH > 30 mL, add 10 mcg per additional 1 mL fetal blood.
  let dose = 300;
  if (fmh > 30) {
    const extra = Math.ceil((fmh - 30) * 10);
    dose += extra;
  }

  return {
    indicated: true,
    recommendedDoseMcg: dose,
    rationale: `Mother is Rh(D)-negative. ${fmh > 30 ? `Significant fetomaternal hemorrhage of ${fmh} mL detected. Elevated Anti-D dose of ${dose} mcg (10 mcg/mL excess blood)` : `Standard dose of ${dose} mcg (1500 IU)`} within 72 hours of delivery.`,
  };
}

export function calculatePerinatalLossAudit(
  input: PerinatalLossInput,
): PerinatalLossAuditResult {
  const { lossType, primaryCauseCategory, maternalBloodGroup, fetomaternalHemorrhageMl } = input;

  const antiD = calculateAntiDRequirements(maternalBloodGroup, fetomaternalHemorrhageMl);

  let recurrenceRiskCategory: RecurrenceRiskCategory = 'low_less_than_1_pct';
  let recurrenceRiskPercentageText = '< 1%';
  const futurePlans: string[] = [];

  switch (primaryCauseCategory) {
    case 'umbilical_cord_accident':
    case 'unexplained_idiopathic':
      recurrenceRiskCategory = 'low_less_than_1_pct';
      recurrenceRiskPercentageText = '< 1% (reassuring baseline recurrence for isolated cord accident or unexplained stillbirth)';
      futurePlans.push(
        'Early reassurance ultrasound scan at 6–8 weeks and combined first-trimester screening at 11–13+6 weeks.',
        'Serial growth ultrasounds and umbilical artery Dopplers every 3–4 weeks starting from 24 weeks gestation.',
        'Planned elective induction of labor at 37+0 to 38+0 weeks to relieve maternal anxiety.',
      );
      break;

    case 'placental_insufficiency_infarction':
    case 'placental_abruption':
    case 'maternal_medical_preeclampsia':
      recurrenceRiskCategory = 'moderate_2_to_5_pct';
      recurrenceRiskPercentageText = '2% to 5% (placental ischemic etiology)';
      futurePlans.push(
        'Initiate low-dose Aspirin 150 mg PO nightly before 16 weeks (strictly 11–14 weeks) up to 36 weeks.',
        'Elemental Calcium 1.5–2.0 g/day supplementation.',
        'Uterine artery Doppler screening at 20–24 weeks anomaly scan.',
        'Fortnightly maternal blood pressure surveillance and serial fetal biometry from 24 weeks.',
      );
      break;

    case 'fetal_anomaly_genetic':
      recurrenceRiskCategory = 'dependent_on_genetics';
      recurrenceRiskPercentageText = 'Dependent on genetic diagnosis (e.g. 1% for sporadic trisomy vs 25% for autosomal recessive vs up to 50% for parental balanced translocation)';
      futurePlans.push(
        'Formal clinical geneticist consultation and parental karyotype / chromosomal microarray testing.',
        'Offer pre-implantation genetic testing for monogenic disorders / structural rearrangements (PGT-M / PGT-SR) if translocations identified.',
        'Early detailed fetal neurosonography / targeted anomaly scan at 16 and 20 weeks.',
      );
      break;

    case 'maternal_medical_diabetes':
    case 'maternal_cholestasis_icp':
      recurrenceRiskCategory = 'moderate_2_to_5_pct';
      recurrenceRiskPercentageText = '3% to 5% without glycemic/bile acid control; < 1% with optimal control';
      futurePlans.push(
        'Pre-conceptional glycemic optimization aiming for HbA1c < 6.5%.',
        'Early OGTT at booking / 14–16 weeks and repeat at 24–28 weeks.',
        'Monitor serum bile acids monthly if pruritus develops; initiate Ursodeoxycholic acid (UDCA).',
      );
      break;

    case 'chorioamnionitis_infection':
    case 'intrapartum_asphyxia':
      recurrenceRiskCategory = 'low_less_than_1_pct';
      recurrenceRiskPercentageText = '< 1%';
      futurePlans.push(
        'High vaginal swab (HVS) and urine culture screening in early pregnancy.',
        'Close intrapartum continuous electronic fetal monitoring in consultant-led obstetric unit.',
      );
      break;
  }

  const bereavementGuidelines = [
    'Provide empathetic, compassionate, patient-centered communication in a private bereavement room.',
    'Offer memory box containing memory items, photographs, footprints, handprints, and wristband.',
    'Offer option of seeing and holding the baby when parents are ready.',
    'Provide clear information regarding death registration, cremation/burial arrangements, and psychological support services.',
    'Schedule formal 6-to-8 week postnatal bereavement review with consultant obstetrician to discuss final post-mortem and pathology results.',
  ];

  const lactationSuppressionPlan =
    'Cabergoline 1 mg PO as a single dose within 24 hours of delivery. Supports comfortable, rapid lactation suppression without rebound engorgement.';

  return {
    lossClassification: lossType.replace(/_/g, ' ').toUpperCase(),
    causeCategoryLabel: primaryCauseCategory.replace(/_/g, ' ').toUpperCase(),
    recurrenceRiskCategory,
    recurrenceRiskPercentageText,
    antiDRecommendation: antiD,
    lactationSuppressionPlan,
    futurePregnancyPlan: futurePlans,
    bereavementGuidelines,
  };
}
