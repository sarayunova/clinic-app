/**
 * Blood Bank, Massive Transfusion Protocol (MTP) & Hemotherapy Engine
 * Compliant with RCOG Greentop Guidelines, ACOG Obstetric Hemorrhage Bulletins,
 * WHO Postpartum Hemorrhage Recommendations, and National Blood Transfusion Council guidelines.
 */

export interface ShockIndexResult {
  shockIndex: number;
  category: 'normal' | 'borderline' | 'severe_shock' | 'critical_collapse';
  label: string;
  isMtpTriggerRecommended: boolean;
  alertColor: 'green' | 'yellow' | 'amber' | 'red';
  clinicalAction: string;
}

/**
 * Calculates Obstetric Shock Index (HR / SBP).
 * Normal pregnant baseline is lower (~0.7-0.8); an obstetric SI >= 0.9 indicates significant hypovolemia,
 * and SI >= 1.0 indicates severe shock with high mortality/ICU admission risk requiring MTP activation.
 */
export function evaluateShockIndex(heartRateBpm: number, systolicBpMmHg: number): ShockIndexResult {
  if (systolicBpMmHg <= 0 || heartRateBpm <= 0) {
    return {
      shockIndex: 0,
      category: 'normal',
      label: 'Invalid Vitals',
      isMtpTriggerRecommended: false,
      alertColor: 'green',
      clinicalAction: 'Record valid heart rate and systolic blood pressure.',
    };
  }

  const si = Number((heartRateBpm / systolicBpMmHg).toFixed(2));

  if (si >= 1.4) {
    return {
      shockIndex: si,
      category: 'critical_collapse',
      label: 'Critical Hemodynamic Collapse (SI >= 1.4)',
      isMtpTriggerRecommended: true,
      alertColor: 'red',
      clinicalAction: 'ACTIVATE MTP STAT! Uncompensated hemorrhagic shock. Immediate rapid infusion, call senior surgeon & anesthetist, warm blood lines, transfer to theater.',
    };
  }

  if (si >= 1.0) {
    return {
      shockIndex: si,
      category: 'severe_shock',
      label: 'Severe Obstetric Shock (SI >= 1.0)',
      isMtpTriggerRecommended: true,
      alertColor: 'red',
      clinicalAction: 'Activate Massive Transfusion Protocol (MTP). Severe occult/overt hemorrhage. Request Pack 1 (4 PRBC : 4 FFP), prepare 1g IV Tranexamic Acid.',
    };
  }

  if (si >= 0.9) {
    return {
      shockIndex: si,
      category: 'borderline',
      label: 'Elevated Shock Index (SI 0.9 - 0.99)',
      isMtpTriggerRecommended: false,
      alertColor: 'amber',
      clinicalAction: 'Early hemodynamic compensation. Draw crossmatch and coagulogram. Recheck vitals every 5-10 minutes. Standby 2 units PRBC.',
    };
  }

  return {
    shockIndex: si,
    category: 'normal',
    label: 'Reassuring Hemodynamics (SI < 0.9)',
    isMtpTriggerRecommended: false,
    alertColor: 'green',
    clinicalAction: 'Normal physiological compensation. Continue standard post-delivery / post-operative vital checks.',
  };
}

export interface MtpPackRecommendation {
  roundNumber: number;
  packName: string;
  prbcUnits: number;
  ffpUnits: number;
  plateletAdultDoses: number; // 1 adult dose = 1 SDP or 4-6 RDPs
  cryoUnits: number;
  tranexamicAcidGrams: number;
  calciumGluconateGrams: number; // 10% ampoule (1g in 10mL)
  rationale: string;
  actionItems: string[];
}

/**
 * Returns balanced 1:1:1 resuscitation pack compositions and medication adjuncts based on the round number.
 */
export function calculateMtpPackRecommendation(
  roundNumber: number,
  fibrinogenMgDl?: number | null,
  ionizedCalciumMmolL?: number | null,
): MtpPackRecommendation {
  if (roundNumber === 1) {
    return {
      roundNumber: 1,
      packName: 'Pack 1 (Immediate Emergency Resuscitation)',
      prbcUnits: 4,
      ffpUnits: 4,
      plateletAdultDoses: 0,
      cryoUnits: 0,
      tranexamicAcidGrams: 1,
      calciumGluconateGrams: 0,
      rationale: 'Initial 1:1 PRBC to FFP ratio to prevent dilution coagulopathy. Use O-negative if uncrossed or type-specific blood.',
      actionItems: [
        'Administer Tranexamic Acid (TXA) 1g IV over 10 minutes within 3 hours of bleeding onset (WOMAN trial).',
        'Insert two 14G or 16G wide-bore peripheral cannulae.',
        'Use blood warmer and rapid infusion system (prevent hypothermia).',
        'Send baseline CBC, PT/INR, aPTT, Fibrinogen, and ABG.',
      ],
    };
  }

  if (roundNumber === 2) {
    return {
      roundNumber: 2,
      packName: 'Pack 2 (Balanced Component Resuscitation)',
      prbcUnits: 4,
      ffpUnits: 4,
      plateletAdultDoses: 1,
      cryoUnits: (fibrinogenMgDl !== undefined && fibrinogenMgDl !== null && fibrinogenMgDl < 200) ? 10 : 0,
      tranexamicAcidGrams: 1, // Repeat 1g if bleeding persists after 30 mins
      calciumGluconateGrams: (ionizedCalciumMmolL !== undefined && ionizedCalciumMmolL !== null && ionizedCalciumMmolL < 1.1) ? 1 : 0,
      rationale: 'Balanced 1:1:1 PRBC:FFP:Platelets resuscitation to maintain hemostasis and platelet counts >50,000/uL.',
      actionItems: [
        'Transfuse 1 Adult Dose Platelets (1 SDP or 5 Pooled RDPs).',
        'Repeat TXA 1g IV if active hemorrhage continues after 30 minutes.',
        'Assess fibrinogen: if < 200 mg/dL, add 10 units Cryoprecipitate.',
        'Check ionized calcium: if < 1.1 mmol/L, give 10% Calcium Gluconate 10 mL IV.',
      ],
    };
  }

  // Round 3 and subsequent rounds
  return {
    roundNumber: roundNumber,
    packName: `Pack ${roundNumber} (Target-Directed Coagulopathy Support)`,
    prbcUnits: 4,
    ffpUnits: 4,
    plateletAdultDoses: 1,
    cryoUnits: (fibrinogenMgDl !== undefined && fibrinogenMgDl !== null && fibrinogenMgDl < 200) ? 10 : 10, // Default 10 units in deep rounds
    tranexamicAcidGrams: 0,
    calciumGluconateGrams: 1,
    rationale: 'Ongoing refractory hemorrhage. Aggressive replacement of consumed fibrinogen and ionized calcium consumed by citrate.',
    actionItems: [
      'Transfuse 10 Units Cryoprecipitate to keep fibrinogen > 200 mg/dL.',
      'Administer 10% Calcium Gluconate 10-20 mL IV (citrate toxicity from >8 blood units).',
      'Maintain active patient warming (fluid warmer, warm air blanket, OT ambient temp > 24°C).',
      'Consider definitive surgical / radiological intervention (uterine artery ligation, B-Lynch suture, hysterectomy).',
    ],
  };
}

export interface HemostaticLabValues {
  hbGDl?: number | null;
  plateletsKUl?: number | null;
  inr?: number | null;
  fibrinogenMgDl?: number | null;
  ionizedCalciumMmolL?: number | null;
  tempCelsius?: number | null;
  phAbg?: number | null;
  lactateMmolL?: number | null;
}

export interface TargetEvaluationResult {
  allTargetsMet: boolean;
  lethalTriadPresent: boolean;
  warnings: string[];
  recommendations: string[];
  metrics: {
    name: string;
    value: string;
    target: string;
    status: 'optimal' | 'warning' | 'critical';
  }[];
}

/**
 * Checks laboratory and Point-of-Care parameters against international resuscitation targets.
 */
export function evaluateTransfusionTargets(labs: HemostaticLabValues): TargetEvaluationResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const metrics: TargetEvaluationResult['metrics'] = [];

  let lethalAcidosis = false;
  let lethalHypothermia = false;
  let lethalCoagulopathy = false;

  // 1. Hemoglobin (Target >= 8.0 g/dL)
  if (labs.hbGDl !== undefined && labs.hbGDl !== null) {
    if (labs.hbGDl < 7.0) {
      metrics.push({ name: 'Hemoglobin', value: `${labs.hbGDl} g/dL`, target: '>= 8.0 g/dL', status: 'critical' });
      warnings.push(`Severe anemia (Hb ${labs.hbGDl} g/dL < 7.0 g/dL): Inadequate oxygen carriage.`);
      recommendations.push('Accelerate PRBC transfusion.');
    } else if (labs.hbGDl < 8.0) {
      metrics.push({ name: 'Hemoglobin', value: `${labs.hbGDl} g/dL`, target: '>= 8.0 g/dL', status: 'warning' });
      warnings.push(`Sub-target Hemoglobin (${labs.hbGDl} g/dL): Target >= 8.0 g/dL.`);
    } else {
      metrics.push({ name: 'Hemoglobin', value: `${labs.hbGDl} g/dL`, target: '>= 8.0 g/dL', status: 'optimal' });
    }
  }

  // 2. Platelets (Target >= 50,000 / uL)
  if (labs.plateletsKUl !== undefined && labs.plateletsKUl !== null) {
    if (labs.plateletsKUl < 50) {
      metrics.push({ name: 'Platelets', value: `${labs.plateletsKUl}k/uL`, target: '>= 50k/uL', status: 'critical' });
      warnings.push(`Thrombocytopenia (Platelets ${labs.plateletsKUl}k < 50k): Primary hemostasis compromised.`);
      recommendations.push('Transfuse 1 adult dose Platelets (SDP or pooled RDPs).');
      lethalCoagulopathy = true;
    } else if (labs.plateletsKUl < 75) {
      metrics.push({ name: 'Platelets', value: `${labs.plateletsKUl}k/uL`, target: '>= 50k/uL', status: 'warning' });
    } else {
      metrics.push({ name: 'Platelets', value: `${labs.plateletsKUl}k/uL`, target: '>= 50k/uL', status: 'optimal' });
    }
  }

  // 3. INR (Target <= 1.5)
  if (labs.inr !== undefined && labs.inr !== null) {
    if (labs.inr > 1.5) {
      metrics.push({ name: 'INR', value: String(labs.inr), target: '<= 1.5', status: 'critical' });
      warnings.push(`Prolonged INR (${labs.inr} > 1.5): Clotting factor exhaustion.`);
      recommendations.push('Transfuse Fresh Frozen Plasma (FFP 15 mL/kg).');
      lethalCoagulopathy = true;
    } else {
      metrics.push({ name: 'INR', value: String(labs.inr), target: '<= 1.5', status: 'optimal' });
    }
  }

  // 4. Fibrinogen (Obstetric Target >= 200 mg/dL)
  if (labs.fibrinogenMgDl !== undefined && labs.fibrinogenMgDl !== null) {
    if (labs.fibrinogenMgDl < 150) {
      metrics.push({ name: 'Fibrinogen', value: `${labs.fibrinogenMgDl} mg/dL`, target: '>= 200 mg/dL', status: 'critical' });
      warnings.push(`Severe Hypofibrinogenemia (${labs.fibrinogenMgDl} mg/dL < 150 mg/dL): High risk of microvascular bleeding / DIC.`);
      recommendations.push('Transfuse 10–20 Units Cryoprecipitate or Fibrinogen Concentrate immediately.');
      lethalCoagulopathy = true;
    } else if (labs.fibrinogenMgDl < 200) {
      metrics.push({ name: 'Fibrinogen', value: `${labs.fibrinogenMgDl} mg/dL`, target: '>= 200 mg/dL', status: 'warning' });
      warnings.push(`Borderline Fibrinogen (${labs.fibrinogenMgDl} mg/dL < 200 mg/dL in pregnancy).`);
      recommendations.push('Transfuse Cryoprecipitate 10 Units.');
    } else {
      metrics.push({ name: 'Fibrinogen', value: `${labs.fibrinogenMgDl} mg/dL`, target: '>= 200 mg/dL', status: 'optimal' });
    }
  }

  // 5. Temperature (Target >= 36.0°C)
  if (labs.tempCelsius !== undefined && labs.tempCelsius !== null) {
    if (labs.tempCelsius < 35.0) {
      metrics.push({ name: 'Core Temp', value: `${labs.tempCelsius}°C`, target: '>= 36.0°C', status: 'critical' });
      warnings.push(`Severe Hypothermia (${labs.tempCelsius}°C < 35.0°C): Severe enzyme inhibition of clotting cascade.`);
      recommendations.push('Aggressive forced-air patient warming and warm all IV fluids & blood products.');
      lethalHypothermia = true;
    } else if (labs.tempCelsius < 36.0) {
      metrics.push({ name: 'Core Temp', value: `${labs.tempCelsius}°C`, target: '>= 36.0°C', status: 'warning' });
      warnings.push(`Hypothermia (${labs.tempCelsius}°C < 36.0°C): Impairs platelet aggregation.`);
      recommendations.push('Employ active warming blanket.');
      lethalHypothermia = true;
    } else {
      metrics.push({ name: 'Core Temp', value: `${labs.tempCelsius}°C`, target: '>= 36.0°C', status: 'optimal' });
    }
  }

  // 6. Ionized Calcium (Target >= 1.10 mmol/L)
  if (labs.ionizedCalciumMmolL !== undefined && labs.ionizedCalciumMmolL !== null) {
    if (labs.ionizedCalciumMmolL < 1.0) {
      metrics.push({ name: 'Ionized Calcium', value: `${labs.ionizedCalciumMmolL} mmol/L`, target: '>= 1.10 mmol/L', status: 'critical' });
      warnings.push(`Severe Hypocalcemia (${labs.ionizedCalciumMmolL} mmol/L < 1.0 mmol/L): Risk of myocardial depression and coagulopathy.`);
      recommendations.push('Give 10% Calcium Gluconate 10–20 mL IV slow push.');
    } else if (labs.ionizedCalciumMmolL < 1.10) {
      metrics.push({ name: 'Ionized Calcium', value: `${labs.ionizedCalciumMmolL} mmol/L`, target: '>= 1.10 mmol/L', status: 'warning' });
      recommendations.push('Supplement 10% Calcium Gluconate 10 mL IV.');
    } else {
      metrics.push({ name: 'Ionized Calcium', value: `${labs.ionizedCalciumMmolL} mmol/L`, target: '>= 1.10 mmol/L', status: 'optimal' });
    }
  }

  // 7. pH & Lactate
  if (labs.phAbg !== undefined && labs.phAbg !== null) {
    if (labs.phAbg < 7.20) {
      metrics.push({ name: 'ABG pH', value: String(labs.phAbg), target: '>= 7.30', status: 'critical' });
      warnings.push(`Severe Acidosis (pH ${labs.phAbg} < 7.20): Blunts clotting factor complexes.`);
      recommendations.push('Correct tissue perfusion, ensure adequate ventilation, treat hypovolemia.');
      lethalAcidosis = true;
    } else if (labs.phAbg < 7.30) {
      metrics.push({ name: 'ABG pH', value: String(labs.phAbg), target: '>= 7.30', status: 'warning' });
    } else {
      metrics.push({ name: 'ABG pH', value: String(labs.phAbg), target: '>= 7.30', status: 'optimal' });
    }
  }

  const lethalTriadPresent = lethalAcidosis && lethalHypothermia && lethalCoagulopathy;
  if (lethalTriadPresent) {
    warnings.unshift('LETHAL TRIAD DETECTED: Acidosis + Hypothermia + Coagulopathy! Extreme mortality risk. Focus on damage control surgery and physiological correction.');
  }

  const allTargetsMet = warnings.length === 0;

  return {
    allTargetsMet,
    lethalTriadPresent,
    warnings,
    recommendations,
    metrics,
  };
}

export interface TransfusionReactionInput {
  tempRiseCelsius: number; // Post - Pre temp
  maxTempCelsius: number;
  systolicBpDropMmHg: number;
  hasUrticariaRash: boolean;
  hasWheezingDyspnea: boolean;
  hasFlankBackPain: boolean;
  hasDarkUrineHemoglobinuria: boolean;
  hasChillsRigors: boolean;
  hasJvdOrCrackles: boolean;
}

export interface TransfusionReactionTriage {
  suspectedReaction: 'ACUTE_HEMOLYTIC' | 'FEBRILE_NON_HEMOLYTIC' | 'ANAPHYLAXIS' | 'TRALI' | 'TACO' | 'BACTERIAL_CONTAMINATION' | 'NONE';
  severity: 'mild' | 'moderate' | 'life_threatening';
  immediateActions: string[];
}

export function classifyTransfusionReaction(input: TransfusionReactionInput): TransfusionReactionTriage {
  // Acute Hemolytic (ABO mismatch): Back pain, dark urine, hypotension, rigors
  if (input.hasDarkUrineHemoglobinuria || (input.hasFlankBackPain && input.systolicBpDropMmHg >= 20)) {
    return {
      suspectedReaction: 'ACUTE_HEMOLYTIC',
      severity: 'life_threatening',
      immediateActions: [
        'STOP TRANSFUSION IMMEDIATELY. Disconnect IV tubing at cannula.',
        'Keep IV line patent with Normal Saline via separate fresh tubing.',
        'Verify patient ID against donor blood bag label (clerical check).',
        'Send blood bag, remaining tubing, and fresh post-transfusion EDTA & urine sample to Blood Bank.',
        'Aggressive IV fluid hydration with furosemide to maintain urine output > 100 mL/hr.',
        'Support blood pressure with vasopressors if refractory shock.',
      ],
    };
  }

  // TRALI / TACO (Respiratory distress)
  if (input.hasWheezingDyspnea) {
    if (input.hasJvdOrCrackles || input.systolicBpDropMmHg < -20) {
      return {
        suspectedReaction: 'TACO',
        severity: 'life_threatening',
        immediateActions: [
          'STOP or slow transfusion immediately.',
          'Sit patient upright in high Fowler position, administer high-flow oxygen.',
          'Administer IV Furosemide (20–40 mg) stat for circulatory overload.',
          'Monitor chest auscultation, SpO2, and fluid balance.',
        ],
      };
    }

    return {
      suspectedReaction: 'TRALI',
      severity: 'life_threatening',
      immediateActions: [
        'STOP TRANSFUSION IMMEDIATELY. Do NOT give diuretics.',
        'High-flow oxygen / Non-invasive or invasive mechanical ventilation support.',
        'Notify Blood Bank to quarantine other components from the same donor.',
        'Chest X-Ray (bilateral non-cardiogenic pulmonary infiltrates).',
      ],
    };
  }

  // Anaphylaxis / Allergic
  if (input.hasUrticariaRash) {
    if (input.systolicBpDropMmHg >= 20 || input.hasWheezingDyspnea) {
      return {
        suspectedReaction: 'ANAPHYLAXIS',
        severity: 'life_threatening',
        immediateActions: [
          'STOP TRANSFUSION IMMEDIATELY.',
          'Administer Intramuscular Epinephrine (Adrenaline 1:1000, 0.5 mg IM in anterolateral thigh).',
          'IV Hydrocortisone 100 mg and IV Chlorpheniramine 10 mg.',
          'Aggressive crystalloid fluid bolus for anaphylactic shock.',
        ],
      };
    }

    return {
      suspectedReaction: 'FEBRILE_NON_HEMOLYTIC',
      severity: 'mild',
      immediateActions: [
        'Pause transfusion temporarily.',
        'Administer oral/IV Antihistamine (Cetirizine or Diphenhydramine).',
        'If rash resolves and no wheeze/hypotension develops, transfusion may be restarted cautiously under direct observation.',
      ],
    };
  }

  // Febrile Non-Hemolytic Reaction (FNHTR) or Bacterial Contamination
  if (input.tempRiseCelsius >= 1.0 || input.maxTempCelsius >= 38.0 || input.hasChillsRigors) {
    if (input.systolicBpDropMmHg >= 30) {
      return {
        suspectedReaction: 'BACTERIAL_CONTAMINATION',
        severity: 'life_threatening',
        immediateActions: [
          'STOP TRANSFUSION IMMEDIATELY.',
          'Draw blood cultures from patient and blood bag unit.',
          'Commence broad-spectrum IV antibiotics immediately (Septic shock).',
          'Fluid resuscitation and inotropic support.',
        ],
      };
    }

    return {
      suspectedReaction: 'FEBRILE_NON_HEMOLYTIC',
      severity: 'mild',
      immediateActions: [
        'STOP transfusion.',
        'Administer Paracetamol 1g PO / IV.',
        'Check for hemolytic signs (urine color, clerical label check).',
        'Notify Blood Bank.',
      ],
    };
  }

  return {
    suspectedReaction: 'NONE',
    severity: 'mild',
    immediateActions: ['Transfusion progressing normally. Continue standard vital checks.'],
  };
}
