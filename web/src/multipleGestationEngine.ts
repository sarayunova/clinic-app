/**
 * Multiple Gestation Surveillance & Complications Engine (Twins & Triplets)
 *
 * References:
 * - ACOG Practice Bulletin No. 231: Multifetal Gestations: Twin, Triplet, and Higher-Order Multifetal Pregnancies
 * - ISUOG Practice Guidelines: Role of ultrasound in twin pregnancy (Khalil et al., 2016)
 * - RCOG Green-top Guideline No. 51: Management of Monochorionic Twin Pregnancy
 * - Quintero Staging of Twin-to-Twin Transfusion Syndrome (TTTS) (Quintero et al., J Perinatol 1999)
 * - Gratacós Classification of Selective Fetal Growth Restriction (sFGR) (Gratacós et al., Ultrasound Obstet Gynecol 2007)
 * - Slaghekke et al., Twin Anemia-Polycythemia Sequence (TAPS) Diagnostic Criteria (AJP 2010)
 */

export type Plurality = 'twins' | 'triplets';
export type Chorionicity = 'dcda' | 'mcda' | 'mcma' | 'tcta' | 'dcta' | 'mc';
export type Amnionicity = 'diamniotic' | 'monoamniotic' | 'triamniotic';
export type FetalPresentation = 'cephalic' | 'breech' | 'transverse' | 'oblique';
export type UaFlow =
  | 'normal_positive'
  | 'reduced'
  | 'absent_aedf'
  | 'reversed_redf'
  | 'intermittent_absent_reversed';

export interface FetusAssessmentData {
  label: string; // "Twin A", "Twin B", "Twin C"
  presentation: FetalPresentation;
  bpdMm?: number;
  hcMm?: number;
  acMm?: number;
  flMm?: number;
  efwG: number; // Estimated fetal weight in grams
  efwPercentile?: number;
  dvpCm: number; // Deepest vertical pocket in cm
  bladderVisualized: boolean;

  // Doppler velocimetry
  uaPi?: number;
  uaFlow: UaFlow;
  mcaPi?: number;
  mcaPsvCmS?: number;
  mcaPsvMom?: number;
  dvAWave?: 'positive' | 'absent' | 'reversed' | 'not_performed';

  hydropsPresent?: boolean;
  demised?: boolean;
}

export interface MultipleGestationInput {
  plurality: Plurality;
  chorionicity: Chorionicity;
  amnionicity: Amnionicity;
  gestationalAgeWeeks: number;
  gestationalAgeDays?: number;
  fetuses: FetusAssessmentData[];
  cordEntanglementNoted?: boolean;
}

export type DiscordanceSeverity =
  | 'concordant'
  | 'mild_discordance'
  | 'significant_discordance_gt_20'
  | 'severe_discordance_gt_25';

export type TttsStage =
  | 'none'
  | 'stage_1'
  | 'stage_2'
  | 'stage_3'
  | 'stage_4'
  | 'stage_5';

export type SfgrType = 'none' | 'type_1' | 'type_2' | 'type_3';

export type TapsStage =
  | 'none'
  | 'stage_1'
  | 'stage_2'
  | 'stage_3'
  | 'stage_4'
  | 'stage_5';

export interface MultipleGestationResult {
  plurality: Plurality;
  chorionicity: Chorionicity;
  amnionicity: Amnionicity;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;

  // Discordance
  efwDiscordancePercent: number;
  acDiscordancePercent: number;
  dvpDiscordanceCm: number;
  discordanceSeverity: DiscordanceSeverity;
  largerFetusLabel: string;
  smallerFetusLabel: string;

  // Complication Staging
  tttsStage: TttsStage;
  tttsSummary: string;
  sfgrType: SfgrType;
  sfgrSummary: string;
  tapsStage: TapsStage;
  tapsSummary: string;
  cordEntanglementNoted: boolean;

  // Clinical Directives
  surveillanceIntervalRecommendation: string;
  deliveryTimingRecommendation: string;
  deliveryModeRecommendation: string;
  corticosteroidsIndicated: boolean;
  actionPlan: string;
  clinicalAlerts: string[];
}

export function calculateMultipleGestation(
  input: MultipleGestationInput,
): MultipleGestationResult {
  const { plurality, chorionicity, amnionicity, gestationalAgeWeeks, fetuses } = input;
  const gaDays = input.gestationalAgeDays || 0;
  const clinicalAlerts: string[] = [];

  if (!fetuses || fetuses.length < 2 || !fetuses[0] || !fetuses[1]) {
    throw new Error('At least two fetuses are required for multiple gestation assessment');
  }

  // 1. Concordance & Discordance Calculations
  let largerFetus: FetusAssessmentData = fetuses[0];
  let smallerFetus: FetusAssessmentData = fetuses[1];

  if (fetuses[1].efwG > fetuses[0].efwG) {
    largerFetus = fetuses[1];
    smallerFetus = fetuses[0];
  }

  // If triplets, find overall max and min EFW
  for (let i = 2; i < fetuses.length; i++) {
    const f = fetuses[i];
    if (f) {
      if (f.efwG > largerFetus.efwG) largerFetus = f;
      if (f.efwG < smallerFetus.efwG) smallerFetus = f;
    }
  }

  const maxEfw = Math.max(1, largerFetus.efwG);
  const minEfw = smallerFetus.efwG;
  const efwDiscordancePercent =
    Math.round(((maxEfw - minEfw) / maxEfw) * 1000) / 10.0;

  // AC Discordance
  let acDiscordancePercent = 0;
  if (largerFetus.acMm && smallerFetus.acMm) {
    const maxAc = Math.max(largerFetus.acMm, smallerFetus.acMm);
    const minAc = Math.min(largerFetus.acMm, smallerFetus.acMm);
    acDiscordancePercent = Math.round(((maxAc - minAc) / maxAc) * 1000) / 10.0;
  }

  // DVP Discordance
  const maxDvp = Math.max(...fetuses.map((f) => f.dvpCm));
  const minDvp = Math.min(...fetuses.map((f) => f.dvpCm));
  const dvpDiscordanceCm = Math.round((maxDvp - minDvp) * 10) / 10.0;

  let discordanceSeverity: DiscordanceSeverity = 'concordant';
  if (efwDiscordancePercent >= 25.0) {
    discordanceSeverity = 'severe_discordance_gt_25';
    clinicalAlerts.push(
      `Severe growth discordance of ${efwDiscordancePercent}% (>=25% indicates high perinatal risk)`,
    );
  } else if (efwDiscordancePercent >= 20.0) {
    discordanceSeverity = 'significant_discordance_gt_20';
    clinicalAlerts.push(
      `Clinically significant growth discordance of ${efwDiscordancePercent}% (>=20%)`,
    );
  } else if (efwDiscordancePercent >= 10.0) {
    discordanceSeverity = 'mild_discordance';
  }

  // 2. Monochorionic Complications Assessment (MCDA, MCMA, MC)
  const isMonochorionic =
    chorionicity === 'mcda' || chorionicity === 'mcma' || chorionicity === 'mc';

  let tttsStage: TttsStage = 'none';
  let tttsSummary = 'No criteria for Twin-to-Twin Transfusion Syndrome (TTTS)';

  let sfgrType: SfgrType = 'none';
  let sfgrSummary = 'No Selective Fetal Growth Restriction (sFGR)';

  let tapsStage: TapsStage = 'none';
  let tapsSummary = 'No Twin Anemia-Polycythemia Sequence (TAPS)';

  if (isMonochorionic && fetuses.length >= 2) {
    // Check for TTTS: Polyhydramnios in Recipient and Oligohydramnios in Donor
    // Standard TOPS definition:
    // Donor DVP < 2.0 cm AND Recipient DVP > 8.0 cm (or > 10.0 cm if > 20 weeks)
    const polyhydramniosThreshold = gestationalAgeWeeks > 20 ? 10.0 : 8.0;

    const donorCandidate = fetuses.find((f) => f.dvpCm < 2.0);
    const recipientCandidate = fetuses.find((f) => f.dvpCm > polyhydramniosThreshold);

    const hasDemised = fetuses.some((f) => f.demised);
    const hasHydrops = fetuses.some((f) => f.hydropsPresent);
    const hasAbnormalDoppler = fetuses.some(
      (f) =>
        f.uaFlow === 'absent_aedf' ||
        f.uaFlow === 'reversed_redf' ||
        f.dvAWave === 'absent' ||
        f.dvAWave === 'reversed',
    );

    if (donorCandidate && recipientCandidate) {
      if (hasDemised) {
        tttsStage = 'stage_5';
        tttsSummary =
          'Quintero Stage V: Intrauterine fetal demise in one or both twins due to TTTS';
        clinicalAlerts.push('CRITICAL: Quintero Stage V TTTS (demise of twin)');
      } else if (hasHydrops) {
        tttsStage = 'stage_4';
        tttsSummary =
          'Quintero Stage IV: Fetal hydrops (ascites, pericardial or pleural effusion, subcutaneous edema) present in twin';
        clinicalAlerts.push(
          'CRITICAL: Quintero Stage IV TTTS (Fetal Hydrops detected) - Immediate tertiary intervention required',
        );
      } else if (hasAbnormalDoppler) {
        tttsStage = 'stage_3';
        tttsSummary =
          'Quintero Stage III: Critically abnormal Doppler velocimetry (absent/reversed UA EDF or absent/reversed DV a-wave)';
        clinicalAlerts.push(
          'HIGH ALERT: Quintero Stage III TTTS (Severe Doppler decompensation)',
        );
      } else if (!donorCandidate.bladderVisualized) {
        tttsStage = 'stage_2';
        tttsSummary =
          'Quintero Stage II: Donor fetal urinary bladder persistently collapsed / not visualized';
        clinicalAlerts.push(
          'HIGH ALERT: Quintero Stage II TTTS (Donor bladder non-visualized)',
        );
      } else {
        tttsStage = 'stage_1';
        tttsSummary =
          'Quintero Stage I: Polyhydramnios-Oligohydramnios sequence with donor bladder visible and normal Doppler';
        clinicalAlerts.push('ALERT: Quintero Stage I TTTS confirmed');
      }
    }

    // Check for Selective FGR (sFGR) - Gratacós Classification
    // Criteria: EFW discordance >= 20% OR smaller twin EFW < 10th percentile
    const isSmallTwinSga =
      (smallerFetus.efwPercentile !== undefined && smallerFetus.efwPercentile < 10) ||
      efwDiscordancePercent >= 20.0;

    if (isSmallTwinSga) {
      if (
        smallerFetus.uaFlow === 'absent_aedf' ||
        smallerFetus.uaFlow === 'reversed_redf'
      ) {
        sfgrType = 'type_2';
        sfgrSummary =
          'Gratacós Type II: Persistent absent or reversed end-diastolic flow (AEDF/REDF) in smaller twin UA. High risk of intrauterine demise.';
        clinicalAlerts.push(
          'HIGH ALERT: Gratacós Type II sFGR (Persistent AEDF/REDF in growth-restricted twin)',
        );
      } else if (smallerFetus.uaFlow === 'intermittent_absent_reversed') {
        sfgrType = 'type_3';
        sfgrSummary =
          'Gratacós Type III: Intermittent absent or reversed UA end-diastolic flow (cyclical waveform due to large arterio-arterial anastomoses). Unpredictable hemodynamic shifts.';
        clinicalAlerts.push(
          'HIGH ALERT: Gratacós Type III sFGR (Intermittent UA EDF - cyclical pattern)',
        );
      } else {
        sfgrType = 'type_1';
        sfgrSummary =
          'Gratacós Type I: Normal positive end-diastolic flow in smaller twin UA. Generally favorable perinatal outcome with vigilant monitoring.';
        clinicalAlerts.push('ALERT: Gratacós Type I sFGR (Discordant growth with positive UA EDF)');
      }
    }

    // Check for TAPS (Twin Anemia-Polycythemia Sequence)
    // Criteria: MCA-PSV > 1.5 MoM in donor and < 1.0 MoM in recipient, delta >= 0.5 MoM
    const anemicCandidate = fetuses.find(
      (f) => f.mcaPsvMom !== undefined && f.mcaPsvMom > 1.5,
    );
    const polycythemicCandidate = fetuses.find(
      (f) => f.mcaPsvMom !== undefined && f.mcaPsvMom < 1.0,
    );

    if (anemicCandidate && polycythemicCandidate) {
      const deltaMom =
        Math.round(
          ((anemicCandidate.mcaPsvMom || 0) - (polycythemicCandidate.mcaPsvMom || 0)) *
            100,
        ) / 100;
      if (deltaMom >= 0.5) {
        if (hasDemised) {
          tapsStage = 'stage_5';
          tapsSummary = 'TAPS Stage 5: Intrauterine demise of anemic or polycythemic twin';
        } else if (hasHydrops) {
          tapsStage = 'stage_4';
          tapsSummary = 'TAPS Stage 4: Hydrops fetalis in anemic twin';
        } else if (hasAbnormalDoppler) {
          tapsStage = 'stage_3';
          tapsSummary = 'TAPS Stage 3: Cardiomegaly or severe Doppler compromise';
        } else if (
          (anemicCandidate.mcaPsvMom || 0) > 1.7 &&
          (polycythemicCandidate.mcaPsvMom || 0) < 0.8
        ) {
          tapsStage = 'stage_2';
          tapsSummary = `TAPS Stage 2: Severe MCA-PSV discordance (Donor ${anemicCandidate.mcaPsvMom} MoM, Recipient ${polycythemicCandidate.mcaPsvMom} MoM, Δ ${deltaMom} MoM)`;
        } else {
          tapsStage = 'stage_1';
          tapsSummary = `TAPS Stage 1: MCA-PSV discordance (Donor ${anemicCandidate.mcaPsvMom} MoM, Recipient ${polycythemicCandidate.mcaPsvMom} MoM, Δ ${deltaMom} MoM)`;
        }
        clinicalAlerts.push(`ALERT: Twin Anemia-Polycythemia Sequence (TAPS) Stage ${tapsStage.slice(-1)} detected`);
      }
    }
  }

  // 3. Surveillance Interval Recommendation
  let surveillanceIntervalRecommendation = '';
  if (tttsStage !== 'none') {
    if (tttsStage === 'stage_1') {
      surveillanceIntervalRecommendation =
        'Weekly ultrasound monitoring of amniotic fluid DVP, fetal bladders, and Doppler velocimetry. Prepare for emergent referral if progression occurs.';
    } else {
      surveillanceIntervalRecommendation =
        'URGENT TERTIARY REFERRAL: Urgent consult at a designated Fetal Medicine Center for Fetoscopic Laser Photocoagulation (FLPC) / amnioreduction evaluation.';
    }
  } else if (sfgrType === 'type_2' || sfgrType === 'type_3') {
    surveillanceIntervalRecommendation =
      'Twice-weekly fetal Doppler surveillance (UA, MCA, DV) and biweekly biometry. Inpatient or day-care monitoring recommended.';
  } else if (sfgrType === 'type_1') {
    surveillanceIntervalRecommendation =
      'Weekly Doppler velocimetry (UA PI & EDF) and biweekly fetal biometry.';
  } else if (chorionicity === 'mcma') {
    surveillanceIntervalRecommendation =
      'High-frequency surveillance: Ultrasound every 1–2 weeks from 16 to 24 weeks; daily or thrice-weekly inpatient/outpatient fetal monitoring from 24 weeks due to cord entanglement risk.';
  } else if (isMonochorionic) {
    surveillanceIntervalRecommendation =
      'Fortnightly (every 2 weeks) ultrasound surveillance starting from 16 weeks to screen for TTTS and sFGR (amniotic fluid DVP, fetal bladders, and biometry every 2–3 weeks).';
  } else {
    // DCDA or triplets
    surveillanceIntervalRecommendation =
      'Every 4 weeks ultrasound biometry and amniotic fluid assessment starting from 20 weeks gestation.';
  }

  // 4. Delivery Timing Recommendation
  let deliveryTimingRecommendation = '';
  if (tttsStage !== 'none' || sfgrType === 'type_2' || sfgrType === 'type_3') {
    deliveryTimingRecommendation =
      'Individualized delivery timing at 30–34 weeks depending on ductus venosus pulsatility, biophysical score, and maternal-fetal center recommendation following steroid administration.';
  } else if (chorionicity === 'mcma') {
    deliveryTimingRecommendation =
      'Elective delivery at 32+0 to 34+0 weeks gestation by planned Cesarean section following a full course of antenatal corticosteroids.';
  } else if (isMonochorionic) {
    if (sfgrType === 'type_1') {
      deliveryTimingRecommendation =
        'Planned delivery at 34+0 to 36+0 weeks gestation with reassuring Doppler surveillance.';
    } else {
      deliveryTimingRecommendation =
        'Uncomplicated MCDA twins: Planned delivery at 36+0 to 36+6 weeks gestation.';
    }
  } else if (plurality === 'triplets') {
    deliveryTimingRecommendation =
      'Planned delivery at 35+0 to 35+6 weeks gestation (or earlier if spontaneous labor/complications intervene).';
  } else {
    // DCDA
    if (discordanceSeverity === 'severe_discordance_gt_25') {
      deliveryTimingRecommendation =
        'Planned delivery at 36+0 to 37+0 weeks gestation with continuous fetal surveillance.';
    } else {
      deliveryTimingRecommendation =
        'Uncomplicated DCDA twins: Planned delivery at 37+0 to 37+6 weeks gestation.';
    }
  }

  // 5. Delivery Mode Recommendation
  let deliveryModeRecommendation = '';
  const twinA = fetuses.find((f) => f.label.toLowerCase().includes('a')) || (fetuses[0] as FetusAssessmentData);

  if (chorionicity === 'mcma') {
    deliveryModeRecommendation =
      'Cesarean section is mandatory for monoamniotic twins to prevent catastrophic cord entanglement and umbilical accidents during labor.';
  } else if (plurality === 'triplets') {
    deliveryModeRecommendation =
      'Cesarean section is strongly recommended for triplet pregnancies.';
  } else if (twinA.presentation === 'cephalic') {
    deliveryModeRecommendation =
      'Trial of vaginal delivery is safe and appropriate, provided the labor ward has continuous electronic fetal heart rate monitoring and obstetricians experienced in internal podalic version / breech extraction of Twin B.';
  } else {
    deliveryModeRecommendation =
      'Planned Cesarean section recommended because Twin A is non-cephalic (breech or transverse presentation).';
  }

  // 6. Corticosteroids Indicated
  const corticosteroidsIndicated =
    gestationalAgeWeeks < 34 &&
    (tttsStage !== 'none' ||
      sfgrType !== 'none' ||
      chorionicity === 'mcma' ||
      efwDiscordancePercent >= 20.0);

  // 7. Action Plan
  const actionPlanParts: string[] = [];
  if (tttsStage !== 'none') {
    actionPlanParts.push(
      `TTTS ${tttsStage.toUpperCase()}: ${tttsSummary}. Initiate urgent MFM referral.`,
    );
  }
  if (sfgrType !== 'none') {
    actionPlanParts.push(`sFGR ${sfgrType.toUpperCase()}: ${sfgrSummary}.`);
  }
  if (tapsStage !== 'none') {
    actionPlanParts.push(`TAPS ${tapsStage.toUpperCase()}: ${tapsSummary}.`);
  }
  if (corticosteroidsIndicated) {
    actionPlanParts.push(
      'Administer Betamethasone 12 mg IM every 24 hours x 2 doses for fetal lung maturation.',
    );
  }
  actionPlanParts.push(
    `Surveillance: ${surveillanceIntervalRecommendation}`,
    `Timing: ${deliveryTimingRecommendation}`,
    `Mode: ${deliveryModeRecommendation}`,
  );

  return {
    plurality,
    chorionicity,
    amnionicity,
    gestationalAgeWeeks,
    gestationalAgeDays: gaDays,
    efwDiscordancePercent,
    acDiscordancePercent,
    dvpDiscordanceCm,
    discordanceSeverity,
    largerFetusLabel: largerFetus.label,
    smallerFetusLabel: smallerFetus.label,
    tttsStage,
    tttsSummary,
    sfgrType,
    sfgrSummary,
    tapsStage,
    tapsSummary,
    cordEntanglementNoted: Boolean(input.cordEntanglementNoted),
    surveillanceIntervalRecommendation,
    deliveryTimingRecommendation,
    deliveryModeRecommendation,
    corticosteroidsIndicated,
    actionPlan: actionPlanParts.join(' | '),
    clinicalAlerts,
  };
}
