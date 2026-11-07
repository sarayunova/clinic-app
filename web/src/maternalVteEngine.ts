/**
 * Maternal Venous Thromboembolism (VTE) Risk Assessment & Thromboprophylaxis Engine
 * References:
 * - Royal College of Obstetricians and Gynaecologists (RCOG) Green-top Guideline No. 37a (2015 / confirmed 2020)
 * - American College of Obstetricians and Gynecologists (ACOG) Practice Bulletin No. 196 (2018)
 * - American Society of Regional Anesthesia and Pain Medicine (ASRA) Neuraxial Guidelines
 */

export interface MaternalVteRiskFactors {
  assessmentType: 'antenatal_early' | 'antenatal_intrapartum' | 'postnatal';
  gestationalAgeWeeks?: number;
  weightKg: number;
  heightCm?: number;
  bmi: number;

  // Pre-existing risk factors
  previousVteUnprovokedOrEstrogen?: boolean; // +4
  previousVteProvoked?: boolean; // +3
  knownHighRiskThrombophilia?: boolean; // +3 (Antithrombin deficiency, Protein C/S deficiency, homozygous FVL)
  medicalComorbidities?: boolean; // +3 (Cancer, heart disease, SLE, nephrotic, T1DM nephropathy, sickle cell)
  surgicalProcedureInPregnancy?: boolean; // +3 (e.g. appendectomy, orthopedic)
  grossVaricoseVeins?: boolean; // +1
  ageOver35?: boolean; // +1
  parityGeq3?: boolean; // +1
  smoker?: boolean; // +1
  bmiGeq30?: boolean; // +1
  bmiGeq40?: boolean; // +2
  lowRiskThrombophilia?: boolean; // +1 (Heterozygous FVL or Prothrombin gene mutation)
  familyHistoryVteFirstDegree?: boolean; // +1

  // Obstetric risk factors
  multiplePregnancy?: boolean; // +1
  assistedReproductiveTechIvf?: boolean; // +1
  preEclampsia?: boolean; // +1
  cesareanSectionEmergency?: boolean; // +2 (postnatal)
  cesareanSectionElective?: boolean; // +1 (postnatal)
  prolongedLaborOver24h?: boolean; // +1 (postnatal)
  postpartumHemorrhageOver1000ml?: boolean; // +1 (postnatal)
  pretermBirthUnder37w?: boolean; // +1 (postnatal)
  stillbirthInThisPregnancy?: boolean; // +1 (postnatal)

  // Transient risk factors
  systemicInfectionCurrent?: boolean; // +1
  immobilityBedrestOver3d?: boolean; // +1
  hyperemesisOrDehydration?: boolean; // +1
}

export interface MaternalVteRiskScoreResult {
  totalScore: number;
  riskTier: 'low_mobilization_hydration' | 'intermediate_prophylaxis_indicated' | 'high_immediate_prophylaxis_indicated';
  prophylaxisIndicated: boolean;
  recommendedDuration: string;
  enoxaparinDose: string;
  dalteparinDose: string;
  weightTierBracket: string;
  antiEmbolicStockingsIndicated: boolean;
  reasons: string[];
}

export interface NeuraxialSafetyCountdown {
  isEligibleNow: boolean;
  hoursElapsedSinceLastDose: number | null;
  requiredClearanceHours: number; // 12h for prophylactic, 24h for therapeutic
  nextSafeNeuraxialTime: string | null;
  statusLabel: string;
  warningAlert?: string;
}

/**
 * Calculates total RCOG VTE Risk Score and stratifies risk tier
 */
export function calculateMaternalVteScore(factors: MaternalVteRiskFactors): MaternalVteRiskScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // 4 points
  if (factors.previousVteUnprovokedOrEstrogen) {
    score += 4;
    reasons.push('Previous unprovoked or estrogen-related VTE (+4)');
  }

  // 3 points
  if (factors.previousVteProvoked) {
    score += 3;
    reasons.push('Previous provoked VTE (+3)');
  }
  if (factors.knownHighRiskThrombophilia) {
    score += 3;
    reasons.push('Known high-risk thrombophilia (+3)');
  }
  if (factors.medicalComorbidities) {
    score += 3;
    reasons.push('Medical comorbidity (SLE, active cancer, nephrotic syndrome, cardiac disease) (+3)');
  }
  if (factors.surgicalProcedureInPregnancy) {
    score += 3;
    reasons.push('Surgical procedure during pregnancy or puerperium (+3)');
  }

  // 2 points
  if (factors.bmiGeq40 || factors.bmi >= 40) {
    score += 2;
    reasons.push('Severe obesity BMI >= 40 kg/m² (+2)');
  } else if (factors.bmiGeq30 || factors.bmi >= 30) {
    score += 1;
    reasons.push('Obesity BMI >= 30 kg/m² (+1)');
  }

  if (factors.cesareanSectionEmergency) {
    score += 2;
    reasons.push('Emergency Cesarean Section / CS in labor (+2)');
  } else if (factors.cesareanSectionElective) {
    score += 1;
    reasons.push('Elective Cesarean Section (+1)');
  }

  // 1 point
  if (factors.grossVaricoseVeins) {
    score += 1;
    reasons.push('Gross / symptomatic varicose veins (+1)');
  }
  if (factors.ageOver35) {
    score += 1;
    reasons.push('Maternal age > 35 years (+1)');
  }
  if (factors.parityGeq3) {
    score += 1;
    reasons.push('Parity >= 3 (+1)');
  }
  if (factors.smoker) {
    score += 1;
    reasons.push('Current cigarette smoker (+1)');
  }
  if (factors.lowRiskThrombophilia) {
    score += 1;
    reasons.push('Low-risk thrombophilia (+1)');
  }
  if (factors.familyHistoryVteFirstDegree) {
    score += 1;
    reasons.push('Family history of VTE in first-degree relative (+1)');
  }
  if (factors.multiplePregnancy) {
    score += 1;
    reasons.push('Multiple pregnancy (+1)');
  }
  if (factors.assistedReproductiveTechIvf) {
    score += 1;
    reasons.push('Assisted Reproductive Technology (IVF) (+1)');
  }
  if (factors.preEclampsia) {
    score += 1;
    reasons.push('Pre-eclampsia in current pregnancy (+1)');
  }
  if (factors.prolongedLaborOver24h) {
    score += 1;
    reasons.push('Prolonged labor > 24 hours (+1)');
  }
  if (factors.postpartumHemorrhageOver1000ml) {
    score += 1;
    reasons.push('Postpartum hemorrhage > 1000 mL or transfusion (+1)');
  }
  if (factors.pretermBirthUnder37w) {
    score += 1;
    reasons.push('Preterm birth < 37 weeks (+1)');
  }
  if (factors.stillbirthInThisPregnancy) {
    score += 1;
    reasons.push('Perinatal loss / stillbirth in this pregnancy (+1)');
  }
  if (factors.systemicInfectionCurrent) {
    score += 1;
    reasons.push('Current systemic infection / sepsis (+1)');
  }
  if (factors.immobilityBedrestOver3d) {
    score += 1;
    reasons.push('Immobility / bed rest > 3 days (+1)');
  }
  if (factors.hyperemesisOrDehydration) {
    score += 1;
    reasons.push('Hyperemesis gravidarum / dehydration (+1)');
  }

  // Weight-banded dosing calculations
  const weight = factors.weightKg;
  let weightTierBracket = '';
  let enoxaparinDose = '';
  let dalteparinDose = '';

  if (weight < 50) {
    weightTierBracket = '< 50 kg (Low body weight)';
    enoxaparinDose = '20 mg SC once daily';
    dalteparinDose = '2,500 IU SC once daily';
  } else if (weight <= 90) {
    weightTierBracket = '50 - 90 kg (Standard body weight)';
    enoxaparinDose = '40 mg SC once daily';
    dalteparinDose = '5,000 IU SC once daily';
  } else if (weight <= 130) {
    weightTierBracket = '91 - 130 kg (High body weight)';
    enoxaparinDose = '60 mg SC once daily';
    dalteparinDose = '7,500 IU SC once daily';
  } else if (weight <= 170) {
    weightTierBracket = '131 - 170 kg (Very high body weight)';
    enoxaparinDose = '80 mg SC once daily (or 40 mg BID)';
    dalteparinDose = '10,000 IU SC once daily (or 5,000 IU BID)';
  } else {
    weightTierBracket = '> 170 kg (Extreme body weight)';
    enoxaparinDose = `${Math.round(weight * 0.6)} mg/day (0.6 mg/kg/day divided BID)`;
    dalteparinDose = `${Math.round(weight * 75)} IU/day (75 IU/kg/day divided BID)`;
  }

  // Stratification
  const isPostnatal = factors.assessmentType === 'postnatal';
  let riskTier: 'low_mobilization_hydration' | 'intermediate_prophylaxis_indicated' | 'high_immediate_prophylaxis_indicated' = 'low_mobilization_hydration';
  let recommendedDuration = '';
  let prophylaxisIndicated = false;

  if (isPostnatal) {
    // Postnatal RCOG 37a rules:
    // Score >= 3 or previous VTE or high-risk thrombophilia: Prophylaxis for 6 weeks
    // Score 2: Prophylaxis for at least 10 days
    // Score < 2: Early mobilization and adequate hydration
    if (score >= 3 || factors.previousVteUnprovokedOrEstrogen || factors.previousVteProvoked || factors.knownHighRiskThrombophilia) {
      riskTier = 'high_immediate_prophylaxis_indicated';
      prophylaxisIndicated = true;
      recommendedDuration = '6 weeks postpartum therapeutic/prophylactic LMWH';
    } else if (score >= 2) {
      riskTier = 'intermediate_prophylaxis_indicated';
      prophylaxisIndicated = true;
      recommendedDuration = 'At least 10 days postpartum prophylactic LMWH';
    } else {
      riskTier = 'low_mobilization_hydration';
      prophylaxisIndicated = false;
      recommendedDuration = 'Early mobilization & hydration. Routine LMWH not indicated.';
    }
  } else {
    // Antenatal RCOG 37a rules:
    // Score >= 4 or previous VTE: Prophylaxis throughout antenatal period & 6 weeks postnatal
    // Score 3: Prophylaxis from 28 weeks gestation onwards until 6 weeks postnatal
    // Score < 3: Mobilization and hydration
    if (score >= 4 || factors.previousVteUnprovokedOrEstrogen || factors.previousVteProvoked) {
      riskTier = 'high_immediate_prophylaxis_indicated';
      prophylaxisIndicated = true;
      recommendedDuration = 'Immediate antenatal LMWH prophylaxis throughout pregnancy and 6 weeks postnatal';
    } else if (score >= 3) {
      riskTier = 'intermediate_prophylaxis_indicated';
      prophylaxisIndicated = true;
      const ga = factors.gestationalAgeWeeks ?? 0;
      recommendedDuration = ga >= 28
        ? 'LMWH prophylaxis indicated now (gestational age >= 28 weeks) until 6 weeks postnatal'
        : 'Commence LMWH prophylaxis at 28 weeks gestation onwards until 6 weeks postnatal';
    } else {
      riskTier = 'low_mobilization_hydration';
      prophylaxisIndicated = false;
      recommendedDuration = 'Mobilization and hydration. Re-evaluate if risk factors change or in labor.';
    }
  }

  const antiEmbolicStockingsIndicated = prophylaxisIndicated || factors.grossVaricoseVeins || (factors.bmi >= 30);

  return {
    totalScore: score,
    riskTier,
    prophylaxisIndicated,
    recommendedDuration,
    enoxaparinDose,
    dalteparinDose,
    weightTierBracket,
    antiEmbolicStockingsIndicated: !!antiEmbolicStockingsIndicated,
    reasons
  };
}

/**
 * Checks safety window for neuraxial regional anesthesia (Spinal / Epidural) after LMWH
 * Minimum clearance is 12 hours for prophylactic dose, 24 hours for therapeutic dose.
 */
export function evaluateNeuraxialClearance(
  lastDoseIsoString: string | null | undefined,
  isTherapeuticDose: boolean = false,
  currentTimeIsoString?: string
): NeuraxialSafetyCountdown {
  const requiredClearanceHours = isTherapeuticDose ? 24 : 12;

  if (!lastDoseIsoString) {
    return {
      isEligibleNow: true,
      hoursElapsedSinceLastDose: null,
      requiredClearanceHours,
      nextSafeNeuraxialTime: null,
      statusLabel: 'Safe for Neuraxial Anesthesia (No recent LMWH recorded)'
    };
  }

  const lastDoseTime = new Date(lastDoseIsoString).getTime();
  const now = currentTimeIsoString ? new Date(currentTimeIsoString).getTime() : Date.now();
  const elapsedMillis = now - lastDoseTime;
  const hoursElapsed = Math.round((elapsedMillis / (1000 * 60 * 60)) * 10) / 10;

  const safeTimeMillis = lastDoseTime + (requiredClearanceHours * 60 * 60 * 1000);
  const nextSafeNeuraxialTime = new Date(safeTimeMillis).toISOString();

  if (hoursElapsed >= requiredClearanceHours) {
    return {
      isEligibleNow: true,
      hoursElapsedSinceLastDose: hoursElapsed,
      requiredClearanceHours,
      nextSafeNeuraxialTime,
      statusLabel: `Safe: ${hoursElapsed}h elapsed since last dose (>= ${requiredClearanceHours}h safety threshold)`
    };
  } else {
    const remainingHours = Math.round((requiredClearanceHours - hoursElapsed) * 10) / 10;
    return {
      isEligibleNow: false,
      hoursElapsedSinceLastDose: hoursElapsed,
      requiredClearanceHours,
      nextSafeNeuraxialTime,
      statusLabel: `CONTRAINDICATED: Only ${hoursElapsed}h elapsed (${remainingHours}h remaining until safe)`,
      warningAlert: `HIGH RISK SPINAL HEMATOMA: Do not perform spinal/epidural needle placement or remove epidural catheter. Safe clearance expected at ${new Date(safeTimeMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    };
  }
}
