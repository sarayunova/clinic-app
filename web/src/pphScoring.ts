/**
 * Postpartum Hemorrhage (PPH) & Quantitative Blood Loss (QBL) Clinical Scoring Engine
 * Standards: ACOG Practice Bulletin No. 183, WHO Guidelines, FIGO, RCOG Green-top 52.
 */

export interface QblBreakdown {
  calibratedDrapeMl: number;
  suctionCanisterMl: number;
  spongesWetWeightG: number;
  spongesDryWeightG: number;
  clotsWeighedG: number;
  eblVisualEstimateMl?: number | null;
}

export interface QblCalculationResult {
  totalQblMl: number;
  gravimetricMl: number;
  volumetricMl: number;
  underestimationDifferenceMl?: number | null;
  underestimationRatio?: number | null;
}

export type ShockIndexSeverity = 'normal' | 'early_warning' | 'high_risk' | 'critical_collapse';

export interface ShockIndexResult {
  shockIndex: number | null;
  severity: ShockIndexSeverity;
  title: string;
  clinicalMessage: string;
  badgeClass: string;
}

export type PphStage = 'stage_0_routine' | 'stage_1_alert' | 'stage_2_moderate' | 'stage_3_severe_mtp';

export interface PphStageInfo {
  stage: PphStage;
  title: string;
  summary: string;
  badgeClass: string;
  priorityActions: string[];
}

/**
 * Calculates Quantitative Blood Loss (QBL) from gravimetric (1 g = 1 mL) and volumetric sources.
 */
export function calculateQbl(b: QblBreakdown): QblCalculationResult {
  const drape = Math.max(0, b.calibratedDrapeMl || 0);
  const suction = Math.max(0, b.suctionCanisterMl || 0);
  const volumetricMl = drape + suction;

  const wet = Math.max(0, b.spongesWetWeightG || 0);
  const dry = Math.max(0, b.spongesDryWeightG || 0);
  const netSpongeBlood = Math.max(0, wet - dry);
  const clots = Math.max(0, b.clotsWeighedG || 0);
  const gravimetricMl = netSpongeBlood + clots;

  const totalQblMl = volumetricMl + gravimetricMl;

  let underestimationDifferenceMl: number | null = null;
  let underestimationRatio: number | null = null;
  if (b.eblVisualEstimateMl != null && b.eblVisualEstimateMl > 0) {
    underestimationDifferenceMl = totalQblMl - b.eblVisualEstimateMl;
    underestimationRatio = Math.round((totalQblMl / b.eblVisualEstimateMl) * 10) / 10;
  }

  return {
    totalQblMl,
    gravimetricMl,
    volumetricMl,
    underestimationDifferenceMl,
    underestimationRatio,
  };
}

/**
 * Calculates Obstetric Shock Index (OSI = Heart Rate / Systolic Blood Pressure).
 * Standard values in late pregnancy/immediate postpartum: 0.7 - 0.9.
 */
export function calculateObstetricShockIndex(
  pulse?: number | null,
  systolic?: number | null
): ShockIndexResult {
  if (!pulse || !systolic || pulse <= 0 || systolic <= 0) {
    return {
      shockIndex: null,
      severity: 'normal',
      title: 'Vitals Incomplete',
      clinicalMessage: 'Record maternal pulse and systolic BP to calculate Obstetric Shock Index.',
      badgeClass: 'badge',
    };
  }

  const si = Math.round((pulse / systolic) * 100) / 100;

  if (si < 0.9) {
    return {
      shockIndex: si,
      severity: 'normal',
      title: 'Normal Hemodynamics (SI < 0.9)',
      clinicalMessage: 'Compensated circulation. Low risk of occult severe hemorrhage.',
      badgeClass: 'badge ok',
    };
  }

  if (si < 1.0) {
    return {
      shockIndex: si,
      severity: 'early_warning',
      title: 'Early Warning (SI 0.9 – 0.99)',
      clinicalMessage: 'Tachycardia out of proportion to blood pressure. Alert obstetrician; suspect concealed blood loss.',
      badgeClass: 'badge warn',
    };
  }

  if (si < 1.4) {
    return {
      shockIndex: si,
      severity: 'high_risk',
      title: 'High Risk / Hypovolemia (SI 1.0 – 1.39)',
      clinicalMessage: 'Strongly predictive of blood transfusion, ICU admission, and hemodynamic collapse. Advance resuscitation.',
      badgeClass: 'badge err',
    };
  }

  return {
    shockIndex: si,
    severity: 'critical_collapse',
    title: 'CRITICAL COLLAPSE / MTP INDICATED (SI ≥ 1.4)',
    clinicalMessage: 'Severe metabolic acidosis and hemorrhagic shock. Immediately activate Massive Transfusion Protocol (MTP).',
    badgeClass: 'badge err',
  };
}

/**
 * Calculates Mean Arterial Pressure (MAP = DBP + (SBP - DBP)/3).
 */
export function calculateMeanArterialPressure(
  systolic?: number | null,
  diastolic?: number | null
): number | null {
  if (!systolic || !diastolic || systolic <= 0 || diastolic <= 0) return null;
  return Math.round(diastolic + (systolic - diastolic) / 3);
}

/**
 * Determines stage-based PPH categorization based on cumulative QBL and Shock Index.
 */
export function determinePphStage(
  totalQblMl: number,
  deliveryMode: 'vaginal' | 'cesarean' | 'assisted_vacuum_forceps' = 'vaginal',
  shockIndex?: number | null
): PphStageInfo {
  const isCesarean = deliveryMode === 'cesarean';
  const stage1Threshold = isCesarean ? 1000 : 500;
  const stage2Threshold = isCesarean ? 1500 : 1000;
  const stage3Threshold = isCesarean ? 2000 : 1500;

  // Stage 3 Trigger
  if (totalQblMl >= stage3Threshold || (shockIndex != null && shockIndex >= 1.4)) {
    return {
      stage: 'stage_3_severe_mtp',
      title: 'STAGE 3: SEVERE HEMORRHAGE / MTP ACTIVATION',
      summary: `Blood loss ≥ ${stage3Threshold} mL or Shock Index ≥ 1.4. Critical life-threatening hemorrhage.`,
      badgeClass: 'badge err',
      priorityActions: [
        'Activate Massive Transfusion Protocol (MTP: 1 PRBC : 1 FFP : 1 Platelets).',
        'Call for senior Obstetrician, Anesthetist, Surgical Assistant, Hematology & Blood Bank.',
        'Immediate surgical intervention: B-Lynch uterine compression sutures / Uterine artery ligation / Emergency Hysterectomy.',
        'Continuous invasive hemodynamic monitoring & ICU bed reservation.',
      ],
    };
  }

  // Stage 2 Trigger
  if (totalQblMl >= stage2Threshold || (shockIndex != null && shockIndex >= 1.0)) {
    return {
      stage: 'stage_2_moderate',
      title: 'STAGE 2: MODERATE / ADVANCED PPH',
      summary: `Blood loss ≥ ${stage2Threshold} mL or Shock Index ≥ 1.0. Bleeding refractory to first-line measures.`,
      badgeClass: 'badge warn',
      priorityActions: [
        'Second-line uterotonics: Carboprost (PGF2α) 250mcg IM (if no asthma) + Misoprostol 800mcg sublingual/rectal.',
        'Insert intrauterine tamponade balloon (Bakri balloon with 300–500 mL warm sterile saline).',
        'Send STAT labs: Type & Crossmatch 4 units PRBC, CBC, Platelets, PT/INR, aPTT, Fibrinogen (target > 200mg/dL).',
        'Prepare Operating Theatre (OT) for examination under anesthesia and laparotomy.',
      ],
    };
  }

  // Stage 1 Trigger
  if (totalQblMl >= stage1Threshold || (shockIndex != null && shockIndex >= 0.9)) {
    return {
      stage: 'stage_1_alert',
      title: 'STAGE 1: MILD PPH / RESUSCITATION ALERT',
      summary: `Blood loss ≥ ${stage1Threshold} mL or Shock Index ≥ 0.9. Early clinical intervention required.`,
      badgeClass: 'badge warn',
      priorityActions: [
        'Continuous vigorous bimanual uterine massage; express clots from lower uterine segment.',
        'Insert Foley catheter to empty bladder and track urine output (>30 mL/hr).',
        'Establish 2 wide-bore IV lines (14G or 16G); infuse rapid crystalloids (Ringer’s Lactate).',
        'Step 1 Uterotonics: Oxytocin 20–40 IU infusion + Methylergometrine 0.2mg IM (if normotensive).',
        'Administer Tranexamic Acid (TXA) 1g IV over 10 minutes within 3 hours of birth.',
        'Inspect perineum, vagina, and cervix under good light for lacerations.',
      ],
    };
  }

  // Stage 0: Routine AMTSL
  return {
    stage: 'stage_0_routine',
    title: 'STAGE 0: ROUTINE ACTIVE MANAGEMENT (AMTSL)',
    summary: `Blood loss < ${stage1Threshold} mL and normal hemodynamics (SI < 0.9).`,
    badgeClass: 'badge ok',
    priorityActions: [
      'Prophylactic Oxytocin 10 IU IM with delivery of anterior shoulder.',
      'Controlled cord traction (Brandt-Andrews technique).',
      'Examine placenta and fetal membranes for completeness.',
      'Ongoing cumulative QBL measurement with under-buttocks drape.',
    ],
  };
}

export const FOUR_T_ETIOLOGY_INFO = {
  tone_atony: {
    name: 'Tone (Uterine Atony)',
    prevalence: '70% – 80% of PPH Cases',
    findings: 'Soft, boggy, poorly contracted uterus palpable above the umbilicus.',
    keyInterventions: 'Bimanual massage, bladder drainage, Oxytocin, TXA, Methergine, Carboprost, Misoprostol, Bakri balloon.',
  },
  trauma_laceration: {
    name: 'Trauma (Lacerations & Hematoma)',
    prevalence: '15% – 20% of PPH Cases',
    findings: 'Bleeding despite well-contracted firm uterus; cervical tears, sulcus vaginal tears, uterine inversion.',
    keyInterventions: 'Immediate speculum examination under anesthesia, surgical repair of tears, reposition inverted uterus.',
  },
  tissue_retained: {
    name: 'Tissue (Retained Products & Accreta)',
    prevalence: '5% – 10% of PPH Cases',
    findings: 'Missing placental cotyledon or succenturiate lobe, adherent placenta, uterine mass.',
    keyInterventions: 'Manual removal of placenta (MROP) under anesthesia, bedside ultrasound, gentle curettage.',
  },
  thrombin_coagulopathy: {
    name: 'Thrombin (Coagulopathy & DIC)',
    prevalence: '1% – 2% of PPH Cases',
    findings: 'Blood fails to clot in red top tube (Lee-White 7-min test); oozing from IV sites, abruptio, HELLP.',
    keyInterventions: 'Cryoprecipitate (target fibrinogen > 200 mg/dL), FFP, Platelets, MTP, Tranexamic Acid.',
  },
  mixed_unclear: {
    name: 'Mixed / Unclear Etiology',
    prevalence: 'Multifactorial',
    findings: 'Combination of atony and trauma, or secondary coagulopathy from delayed resuscitation.',
    keyInterventions: 'Systematic 4T checklist workup while advancing stage-based medical resuscitation.',
  },
};

export interface UterotonicSafetyReport {
  methergineSafe: boolean;
  methergineWarning?: string;
  carboprostSafe: boolean;
  carboprostWarning?: string;
}

/**
 * Checks safety and contraindications for second-line uterotonics based on maternal comorbidities.
 */
export function checkUterotonicSafety(
  hasHypertension: boolean,
  hasAsthma: boolean
): UterotonicSafetyReport {
  const methergineSafe = !hasHypertension;
  const carboprostSafe = !hasAsthma;

  return {
    methergineSafe,
    methergineWarning: methergineSafe
      ? undefined
      : 'CONTRAINDICATED: Patient has hypertension / pre-eclampsia. Methylergometrine causes severe peripheral vasoconstriction and stroke risk.',
    carboprostSafe,
    carboprostWarning: carboprostSafe
      ? undefined
      : 'CONTRAINDICATED: Patient has active bronchial asthma. Carboprost (PGF2α) causes severe bronchospasm and bronchoconstriction.',
  };
}
