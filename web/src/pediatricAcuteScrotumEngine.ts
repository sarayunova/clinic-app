// Pure TypeScript calculation engine for Pediatric Acute Scrotum & TWIST Score Protocol
// Guidelines: AUA (American Urological Association) / ESPU / AAP Clinical Practice Guidelines

export type ScrotumAffectedSide = 'right' | 'left' | 'bilateral';

export type TwistRiskCategory =
  | 'low_risk'
  | 'intermediate_risk'
  | 'high_risk';

export type DopplerScrotalFindings =
  | 'not_performed'
  | 'absent_arterial_flow_torsion_confirmed'
  | 'decreased_flow_partial_torsion'
  | 'normal_flow_appendix_torsion_blue_dot'
  | 'increased_hyperemic_flow_epididymo_orchitis';

export type IntraoperativeFindings =
  | 'preop_evaluation'
  | 'viable_testis_after_detorsion'
  | 'necrotic_nonviable_orchiectomy_performed'
  | 'torsion_appendix_testis_excised'
  | 'normal_testis_epididymitis_managed';

export interface PediatricAcuteScrotumParams {
  ageYears: number;
  affectedSide: ScrotumAffectedSide;
  symptomDurationHours: number;
  twistTestisSwelling: number; // 0 or 2
  twistHardTestis: number; // 0 or 2
  twistAbsentCremastericReflex: number; // 0 or 1
  twistNauseaVomiting: number; // 0 or 1
  twistHighRidingTestis: number; // 0 or 1
  dopplerUltrasoundPerformed: boolean;
  dopplerFindings: DopplerScrotalFindings;
  manualDetorsionAttempted: boolean;
  surgicalExplorationPerformed: boolean;
  intraoperativeFindings: IntraoperativeFindings;
  bilateralOrchiopexyPerformed: boolean;
}

export interface PediatricAcuteScrotumResult {
  twistScoreTotal: number;
  twistRiskCategory: TwistRiskCategory;
  twistRiskCategoryLabel: string;
  isGoldenWindowActive: boolean;
  salvageProbabilityEstimate: string;
  isImmediateSurgeryMandated: boolean;
  isDopplerUltrasoundIndicated: boolean;
  preoperativeDirectives: string[];
  surgicalExplorationDirectives: string[];
  postoperativeDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_immediate_surgical_exploration' | 'urgent_doppler_ultrasound_intermediate' | 'low_risk_surveillance' | 'postop_scrotal_recovery';
  urgencyTierLabel: string;
}

export type PediatricAcuteScrotumEvaluationResult = PediatricAcuteScrotumResult;

export function evaluatePediatricAcuteScrotum(params: PediatricAcuteScrotumParams): PediatricAcuteScrotumResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const preoperativeDirectives: string[] = [];
  const surgicalExplorationDirectives: string[] = [];
  const postoperativeDirectives: string[] = [];

  // 1. TWIST Score Calculation (0 to 7)
  const swelling = params.twistTestisSwelling >= 1 ? 2 : 0;
  const hard = params.twistHardTestis >= 1 ? 2 : 0;
  const reflex = params.twistAbsentCremastericReflex >= 1 ? 1 : 0;
  const nausea = params.twistNauseaVomiting >= 1 ? 1 : 0;
  const highRiding = params.twistHighRidingTestis >= 1 ? 1 : 0;

  const twistScoreTotal = swelling + hard + reflex + nausea + highRiding;

  let twistRiskCategory: TwistRiskCategory = 'low_risk';
  let twistRiskCategoryLabel = `Low Risk (TWIST Score: ${twistScoreTotal}/7)`;

  let isImmediateSurgeryMandated = false;
  let isDopplerUltrasoundIndicated = false;

  if (twistScoreTotal >= 5) {
    twistRiskCategory = 'high_risk';
    twistRiskCategoryLabel = `High Risk Torsion (TWIST Score: ${twistScoreTotal}/7)`;
    isImmediateSurgeryMandated = true;
    alerts.push(`EMERGENCY: TWIST score of ${twistScoreTotal}/7 carries 90–100% positive predictive value for testicular torsion. Transfer to OR immediately; do NOT delay for ultrasound!`);
  } else if (twistScoreTotal >= 3) {
    twistRiskCategory = 'intermediate_risk';
    twistRiskCategoryLabel = `Intermediate Risk (TWIST Score: ${twistScoreTotal}/7)`;
    isDopplerUltrasoundIndicated = true;
    recommendations.push(`Intermediate TWIST score (${twistScoreTotal}/7): Emergent color Doppler duplex ultrasound indicated to evaluate resistive indices and intratesticular perfusion.`);
  } else {
    twistRiskCategory = 'low_risk';
    twistRiskCategoryLabel = `Low Risk (TWIST Score: ${twistScoreTotal}/7)`;
    recommendations.push(`Low TWIST score (${twistScoreTotal}/7): Torsion unlikely. Evaluate for torsion of appendix testis (Morgagni hydatid), acute epididymo-orchitis, or hydrocele.`);
  }

  // 2. Ischemic Golden Window & Salvage Probability
  const isGoldenWindowActive = params.symptomDurationHours <= 6.0;
  let salvageProbabilityEstimate = '';

  if (params.symptomDurationHours <= 6.0) {
    salvageProbabilityEstimate = '> 90% Testicular Salvage Rate (Within 6h Golden Window)';
  } else if (params.symptomDurationHours <= 12.0) {
    salvageProbabilityEstimate = '50% – 70% Testicular Salvage Rate (Moderate Ischemia 6–12h)';
    alerts.push(`TIME-CRITICAL ISCHEMIA: Symptom duration is ${params.symptomDurationHours} hours. Salvage probability is falling rapidly; emergency exploration required without delay.`);
  } else if (params.symptomDurationHours <= 24.0) {
    salvageProbabilityEstimate = '20% – 40% Testicular Salvage Rate (Prolonged Ischemia 12–24h)';
    alerts.push(`SEVERE PROLONGED ISCHEMIA (${params.symptomDurationHours} hours): High risk of irreversible hemorrhagic testicular necrosis and Leydig/Sertoli cell death.`);
  } else {
    salvageProbabilityEstimate = '< 10% Testicular Salvage Rate (Delayed Presentation > 24h)';
    alerts.push('LATE PRESENTATION: Symptom duration > 24 hours. High probability of nonviable necrotic gonad requiring orchiectomy. Contralateral prophylactic orchiopexy is mandatory.');
  }

  // 3. Doppler Findings Confirmation
  if (params.dopplerFindings === 'absent_arterial_flow_torsion_confirmed') {
    isImmediateSurgeryMandated = true;
    alerts.push('DOPPLER CONFIRMED TORSION: Complete absence of intratesticular parenchymal blood flow and whirlpool sign on spermatic cord. Emergency scrotal exploration mandated.');
  }

  // 4. Preoperative Directives & Manual Detorsion
  preoperativeDirectives.push('Strict NPO status, placement of wide-bore IV access, and urgent pediatric urology / pediatric surgery consultation.');
  preoperativeDirectives.push('Attempt "open-book" manual detorsion while OR is prepared: Rotate testicle from medial to lateral (outward like opening a book, usually 180°–540°).');
  preoperativeDirectives.push('Immediate pain relief and resolution of high-riding position signals successful manual detorsion; note that surgical fixation is still required.');

  // 5. Surgical Directives & Bilateral Orchiopexy
  surgicalExplorationDirectives.push('Median raphe or transverse hemiscrotal incision; deliver the affected testis and untwist the spermatic cord counter-clockwise or clockwise.');
  surgicalExplorationDirectives.push('Wrap testis in warm moist laparotomy pad for 10–15 minutes and administer 100% FiO2 to evaluate microvascular reperfusion.');
  surgicalExplorationDirectives.push('Assess viability: Puncture tunica albuginea with a 25G needle; presence of bright red capillary bleeding confirms microvascular viability.');
  surgicalExplorationDirectives.push('MANDATORY BILATERAL ORCHIOPEXY: Always perform 3-point dartos pouch orchiopexy on the contralateral asymptomatic testis (Bell-clapper deformity is bilateral in 50–80% of patients).');

  if (params.surgicalExplorationPerformed && !params.bilateralOrchiopexyPerformed) {
    alerts.push('STANDARD OF CARE VIOLATION: Contralateral orchiopexy was not performed! The patient remains at high risk for future metachronous torsion and anorchia.');
  }

  // 6. Postoperative Recovery Directives
  postoperativeDirectives.push('Scrotal support (athletic supporter or rolled towel) and intermittent ice pack application for 48 hours to minimize hematoma and edema.');
  postoperativeDirectives.push('Strict avoidance of straddle toys, bicycle riding, and vigorous sports for 4 to 6 weeks.');
  postoperativeDirectives.push('Follow-up Doppler ultrasound at 6 to 12 weeks to assess testicular volume and rule out late ischemic atrophy.');

  // 7. Urgency Tier
  let urgencyTier: 'emergency_immediate_surgical_exploration' | 'urgent_doppler_ultrasound_intermediate' | 'low_risk_surveillance' | 'postop_scrotal_recovery' =
    'emergency_immediate_surgical_exploration';
  let urgencyTierLabel = 'EMERGENCY: Immediate Scrotal Exploration';

  if (params.surgicalExplorationPerformed) {
    urgencyTier = 'postop_scrotal_recovery';
    urgencyTierLabel = 'Postoperative Scrotal Recovery & Contralateral Protection';
  } else if (isImmediateSurgeryMandated) {
    urgencyTier = 'emergency_immediate_surgical_exploration';
    urgencyTierLabel = 'EMERGENCY: Immediate Scrotal Exploration (< 6h Window)';
  } else if (isDopplerUltrasoundIndicated) {
    urgencyTier = 'urgent_doppler_ultrasound_intermediate';
    urgencyTierLabel = 'Urgent Color Doppler Scrotal Ultrasound';
  } else {
    urgencyTier = 'low_risk_surveillance';
    urgencyTierLabel = 'Low-Risk Observation & Non-Operative Management';
  }

  return {
    twistScoreTotal,
    twistRiskCategory,
    twistRiskCategoryLabel,
    isGoldenWindowActive,
    salvageProbabilityEstimate,
    isImmediateSurgeryMandated,
    isDopplerUltrasoundIndicated,
    preoperativeDirectives,
    surgicalExplorationDirectives,
    postoperativeDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
