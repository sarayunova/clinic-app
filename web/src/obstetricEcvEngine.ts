// Pure TypeScript calculation engine for Obstetric External Cephalic Version (ECV) & Non-Cephalic Protocol
// Guidelines: ACOG Practice Bulletin No. 13 / RCOG Green-top Guideline No. 20a

export interface ObstetricEcvParams {
  gestationalAgeWeeks: number;
  maternalParity: number;
  maternalBmi: number;
  fetalPresentationInitial: 'frank_breech' | 'complete_breech' | 'footling_incomplete_breech' | 'transverse_lie' | 'oblique_lie';
  placentalLocation: 'posterior' | 'fundal' | 'lateral' | 'anterior' | 'low_lying_placenta_previa';
  amnioticFluidIndexCm: number;
  estimatedFetalWeightG: number;
  fetalSpinePosition: 'posterior' | 'lateral' | 'anterior';
  fetalEngagementLevel: 'high_unengaged_floating' | 'dipping_in_pelvis' | 'deeply_engaged';
  terbutalineGiven: boolean;
  maternalRhNegative: boolean;
  priorCesareanSection?: boolean;
}

export interface ObstetricEcvResult {
  isEligibleForEcv: boolean;
  hasAbsoluteContraindications: boolean;
  hasRelativeContraindications: boolean;
  contraindicationsList: string[];
  calculatedSuccessProbabilityPct: number;
  successLikelihoodTier: 'high' | 'moderate' | 'unfavorable' | 'contraindicated';
  successLikelihoodTierLabel: string;
  tocolysisRecommendation: string;
  rhManagementProtocol: {
    antiDIndicated: boolean;
    recommendedDoseMcg: number;
    kleihauerBetkeIndicated: boolean;
    instructions: string;
  };
  proceduralSafetyChecklist: string[];
  recommendations: string[];
  alerts: string[];
}

export type ObstetricEcvEvaluationResult = ObstetricEcvResult;

export function evaluateObstetricEcv(params: ObstetricEcvParams): ObstetricEcvResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const contraindicationsList: string[] = [];
  const proceduralSafetyChecklist: string[] = [];

  // 1. Evaluate Absolute Contraindications
  if (params.placentalLocation === 'low_lying_placenta_previa') {
    contraindicationsList.push('Absolute Contraindication: Low-lying placenta / Placenta previa (risk of catastrophic hemorrhage).');
  }
  if (params.gestationalAgeWeeks < 36.0) {
    contraindicationsList.push('Absolute Contraindication: Gestational age < 36.0 weeks (high spontaneous version rate and prematurity risk).');
  }

  const hasAbsoluteContraindications = contraindicationsList.length > 0;
  if (hasAbsoluteContraindications) {
    alerts.push(`ECV CONTRAINDICATED: ${contraindicationsList.join('; ')}.`);
  }

  // 2. Evaluate Relative Contraindications / Unfavorable Features
  const relativeList: string[] = [];
  if (params.amnioticFluidIndexCm < 5.0) {
    relativeList.push('Oligohydramnios (AFI < 5.0 cm): substantially decreases maneuverability and increases cord compression risk.');
  }
  if (params.fetalEngagementLevel === 'deeply_engaged') {
    relativeList.push('Deeply engaged fetal breech in the maternal pelvis: low success rate, difficult elevation.');
  }
  if (params.placentalLocation === 'anterior') {
    relativeList.push('Anterior placenta: technical impediment to hand placement and higher rate of procedural discomfort.');
  }
  if (params.maternalBmi >= 35.0) {
    relativeList.push('Severe maternal obesity (BMI ≥ 35 kg/m²): reduced abdominal wall palpability.');
  }
  if (params.priorCesareanSection) {
    relativeList.push('Prior Cesarean scar: ECV can be considered with caution in selected patients, but carries theoretical scar disruption risk.');
  }

  const hasRelativeContraindications = relativeList.length > 0;
  if (hasRelativeContraindications) {
    alerts.push(`CAUTIONARY FACTORS: ${relativeList.join('; ')}`);
  }

  // 3. Calculated Success Probability Estimation (Validated Multi-variable Clinical Model)
  // Baseline success for multiparous with tocolysis is ~60-70%; nulliparous without tocolysis is ~35-40%
  let probability = 50.0;

  // Parity
  if (params.maternalParity >= 1) probability += 18.0; // Multiparity is strongly positive
  else probability -= 10.0; // Nulliparity

  // Tocolysis (Terbutaline 0.25 mg SC)
  if (params.terbutalineGiven) probability += 15.0;
  else probability -= 10.0;

  // Amniotic fluid index
  if (params.amnioticFluidIndexCm >= 12.0) probability += 8.0;
  else if (params.amnioticFluidIndexCm < 8.0) probability -= 12.0;

  // Fetal engagement
  if (params.fetalEngagementLevel === 'high_unengaged_floating') probability += 10.0;
  else if (params.fetalEngagementLevel === 'deeply_engaged') probability -= 25.0;

  // Placental location
  if (params.placentalLocation === 'posterior' || params.placentalLocation === 'fundal') probability += 6.0;
  else if (params.placentalLocation === 'anterior') probability -= 8.0;

  // Fetal spine
  if (params.fetalSpinePosition === 'lateral') probability += 5.0;

  // Maternal BMI
  if (params.maternalBmi >= 35.0) probability -= 8.0;

  // Clamp probability between 10% and 90%
  let calculatedSuccessProbabilityPct = Math.max(10, Math.min(90, Math.round(probability)));
  if (hasAbsoluteContraindications) {
    calculatedSuccessProbabilityPct = 0;
  }

  const isEligibleForEcv = !hasAbsoluteContraindications && params.gestationalAgeWeeks >= 36.0;

  let successLikelihoodTier: 'high' | 'moderate' | 'unfavorable' | 'contraindicated' = 'moderate';
  let successLikelihoodTierLabel = 'Moderate Likelihood of Cephalic Conversion (45-65%)';

  if (!isEligibleForEcv) {
    successLikelihoodTier = 'contraindicated';
    successLikelihoodTierLabel = 'Procedure Contraindicated';
  } else if (calculatedSuccessProbabilityPct >= 65) {
    successLikelihoodTier = 'high';
    successLikelihoodTierLabel = `Favorable Candidate: High Success Probability (~${calculatedSuccessProbabilityPct}%)`;
  } else if (calculatedSuccessProbabilityPct < 40) {
    successLikelihoodTier = 'unfavorable';
    successLikelihoodTierLabel = `Unfavorable Candidate: Low Success Probability (~${calculatedSuccessProbabilityPct}%)`;
  }

  // 4. Tocolysis Guidance
  const tocolysisRecommendation = params.terbutalineGiven
    ? 'Tocolytic premedication verified: Terbutaline 0.25 mg SC given 15-30 minutes prior to maneuver enhances uterine relaxation.'
    : 'Administer Terbutaline 0.25 mg SC 15 to 30 min before version attempts to significantly improve cephalic conversion rates (Grade A).';

  // 5. Rh-D Alloimmunization Protocol
  const rhManagementProtocol = {
    antiDIndicated: params.maternalRhNegative,
    recommendedDoseMcg: params.maternalRhNegative ? 300 : 0,
    kleihauerBetkeIndicated: params.maternalRhNegative,
    instructions: params.maternalRhNegative
      ? 'Rh-Negative Mother: Administer Rh immune globulin (Anti-D 300 mcg / 1500 IU IM) within 72 hours of ECV. Send maternal blood for Kleihauer-Betke acid-elution test to detect excessive fetomaternal hemorrhage requiring dose augmentation.'
      : 'Mother is Rh-Positive: No Anti-D immune globulin required.',
  };

  if (params.maternalRhNegative) {
    alerts.push('RH IMMUNOPROPHYLAXIS: Mother is Rh-negative. Perform Kleihauer-Betke test and administer Anti-D 300 mcg stat post-procedure.');
  }

  // 6. Procedural Safety Checklist
  proceduralSafetyChecklist.push('Perform real-time ultrasound immediately prior to version to verify persistent breech/transverse lie, placental position, and absence of nuchal cord loops.');
  proceduralSafetyChecklist.push('Continuous Cardiotocography (EFM): Verify reassuring Category-1 tracing for at least 20 minutes before starting.');
  proceduralSafetyChecklist.push('Establish operating theater readiness: Confirm anesthesiologist, obstetrician, and neonatal resuscitation lead are immediately available for emergent crash cesarean if persistent bradycardia occurs.');
  proceduralSafetyChecklist.push('Limit attempts: Maximum 3 to 4 attempts or total procedural duration ≤ 10 minutes. Abort immediately if maternal pain is intolerable or fetal deceleration occurs.');
  proceduralSafetyChecklist.push('Post-procedure monitoring: Minimum 30 to 60 minutes of continuous electronic fetal heart rate tracing.');

  recommendations.push(
    isEligibleForEcv
      ? `Counsel patient on external cephalic version risks and benefits. Estimated success probability is ${calculatedSuccessProbabilityPct}%.`
      : 'External cephalic version is not recommended. Plan scheduled elective cesarean delivery at 39 weeks.'
  );

  return {
    isEligibleForEcv,
    hasAbsoluteContraindications,
    hasRelativeContraindications,
    contraindicationsList: [...contraindicationsList, ...relativeList],
    calculatedSuccessProbabilityPct,
    successLikelihoodTier,
    successLikelihoodTierLabel,
    tocolysisRecommendation,
    rhManagementProtocol,
    proceduralSafetyChecklist,
    recommendations,
    alerts,
  };
}
