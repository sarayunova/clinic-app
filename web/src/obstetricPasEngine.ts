/**
 * Placenta Accreta Spectrum (PAS) Clinical Engine
 * FIGO / SMFM Staging, MDT Surgical Preparedness & Delivery Timing Protocol
 *
 * References:
 * - FIGO Consensus Guidelines on Placenta Accreta Spectrum Disorders (Int J Gynecol Obstet 2018)
 * - SMFM Consult Series #60: Management of Placenta Accreta Spectrum (Am J Obstet Gynecol 2021)
 * - ACOG Obstetric Care Consensus No. 7: Placenta Accreta Spectrum (2018, reaffirmed 2021)
 */

export type PasGrade = 'grade_1_accreta' | 'grade_2_increta' | 'grade_3_percreta';

export interface PasEvaluationInput {
  gestationWeeks: number;
  previousCesareansCount: number;
  placentaPreviaPresent: boolean;
  lossOfClearZone?: boolean;
  myometrialThicknessLess1mm?: boolean;
  lacunaeGrade?: number; // 0: None, 1: 1-3 small, 2: 4-6 large, 3: multiple confluent/turbulent
  subplacentalHypervascularity?: boolean;
  bridgingVesselsToBladder?: boolean;
  mriFindings?: string;
}

export interface PasEvaluationResult {
  pasGrade: PasGrade;
  pasGradeTitle: string;
  pasRiskLevel: 'moderate' | 'high' | 'critical_percreta';
  estimatedHemorrhageRisk: string;
  recommendedDeliveryTimingWeeksMin: number;
  recommendedDeliveryTimingWeeksMax: number;
  recommendedDeliveryRationale: string;
  recommendedPrbcUnits: number;
  recommendedFfpUnits: number;
  recommendedPlateletUnits: number;
  interventionalRadiologyIndicated: boolean;
  ureteralStentingIndicated: boolean;
  cellSaverIndicated: boolean;
  mdtChecklist: string[];
  surgicalRecommendations: string[];
}

/**
 * Classifies PAS grade based on ultrasound and imaging markers
 */
export function classifyPasGrade(input: PasEvaluationInput): PasGrade {
  if (input.bridgingVesselsToBladder) {
    return 'grade_3_percreta';
  }

  const deepInvasionCount =
    (input.lossOfClearZone ? 1 : 0) +
    (input.myometrialThicknessLess1mm ? 1 : 0) +
    ((input.lacunaeGrade ?? 0) >= 2 ? 1 : 0) +
    (input.subplacentalHypervascularity ? 1 : 0);

  if (deepInvasionCount >= 3 || (input.lacunaeGrade ?? 0) === 3) {
    return 'grade_2_increta';
  }

  return 'grade_1_accreta';
}

/**
 * Evaluates comprehensive PAS risk, MDT surgical preparation, and delivery timing
 */
export function evaluateObstetricPas(input: PasEvaluationInput): PasEvaluationResult {
  const grade = classifyPasGrade(input);

  let gradeTitle = 'PAS Grade 1: Placenta Accreta (Adherent to superficial myometrium)';
  let riskLevel: 'moderate' | 'high' | 'critical_percreta' = 'high';
  let hemorrhageRisk = 'Significant obstetric hemorrhage risk (average QBL 1500-2500 mL).';
  let minWeeks = 34.0;
  let maxWeeks = 35.8; // 35w6d
  let prbc = 4;
  let ffp = 4;
  let platelets = 2;
  let irIndicated = false;
  let urologyIndicated = false;

  const mdtChecklist: string[] = [
    'Confirm Maternal-Fetal Medicine (MFM) and Senior Obstetrician availability for primary surgery.',
    'Confirm Senior Obstetric Anesthesiologist (arterial line and central line access ready).',
    'Blood Bank reservation confirmed with crossmatched blood products in operating room refrigerator.',
    'Level III Neonatal Intensive Care Unit (NICU) team notified for resuscitation of 34-35 week infant.',
    'Administer antenatal corticosteroids (Betamethasone 12 mg IM q24h x 2 doses) prior to planned surgery.',
  ];

  const surgicalRecs: string[] = [
    'Planned midline vertical skin incision to allow optimal pelvic exposure and fundal hysterotomy.',
    'High uterine fundal incision avoiding the placental edge; deliver infant without disturbing placenta.',
    'DO NOT attempt manual removal of the placenta (forcible detachment causes catastrophic hemorrhage).',
    'Close hysterotomy leaving placenta in situ, then proceed with Cesarean Hysterectomy.',
  ];

  if (grade === 'grade_3_percreta') {
    gradeTitle = 'PAS Grade 3: Placenta Percreta (Invasion through uterine serosa +/- bladder wall)';
    riskLevel = 'critical_percreta';
    hemorrhageRisk = 'EXTREME / CATASTROPHIC HEMORRHAGE RISK (average QBL 3000-5000+ mL, DIC, cystotomy risk).';
    minWeeks = 34.0;
    maxWeeks = 35.0;
    prbc = 8;
    ffp = 8;
    platelets = 4;
    irIndicated = true;
    urologyIndicated = true;

    mdtChecklist.push('Urology consultation for preoperative cystoscopy and prophylactic bilateral ureteral stent placement.');
    mdtChecklist.push('Interventional Radiology (IR) team on standby for prophylactic internal iliac / uterine artery balloon occlusion.');
    mdtChecklist.push('Gynecologic Oncology surgical assist on standby for complex retroperitoneal dissection.');

    surgicalRecs.push('Prepare for intentional cystotomy / partial bladder resection if bladder mucosa is invaded.');
  } else if (grade === 'grade_2_increta') {
    gradeTitle = 'PAS Grade 2: Placenta Increta (Deep myometrial invasion approaching serosa)';
    riskLevel = 'high';
    hemorrhageRisk = 'HIGH HEMORRHAGE RISK (average QBL 2000-3500 mL).';
    minWeeks = 34.0;
    maxWeeks = 35.6;
    prbc = 6;
    ffp = 6;
    platelets = 2;
    irIndicated = true;
    urologyIndicated = false;

    mdtChecklist.push('Urology standby if lower uterine segment dissection risks ureteral injury.');
    mdtChecklist.push('Interventional Radiology on standby for selective arterial embolization.');
  }

  const rationale = `SMFM/ACOG PAS Delivery Protocol: Planned delivery at 34w0d to 35w6d provides optimal balance between maternal emergency hemorrhage from unheralded labor/bleeding and neonatal prematurity. Betamethasone course indicated before 37 weeks.`;

  return {
    pasGrade: grade,
    pasGradeTitle: gradeTitle,
    pasRiskLevel: riskLevel,
    estimatedHemorrhageRisk: hemorrhageRisk,
    recommendedDeliveryTimingWeeksMin: minWeeks,
    recommendedDeliveryTimingWeeksMax: maxWeeks,
    recommendedDeliveryRationale: rationale,
    recommendedPrbcUnits: prbc,
    recommendedFfpUnits: ffp,
    recommendedPlateletUnits: platelets,
    interventionalRadiologyIndicated: irIndicated,
    ureteralStentingIndicated: urologyIndicated,
    cellSaverIndicated: true,
    mdtChecklist,
    surgicalRecommendations: surgicalRecs,
  };
}
