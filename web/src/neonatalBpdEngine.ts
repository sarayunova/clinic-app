// Pure TypeScript Clinical Calculation Engine: Neonatal Bronchopulmonary Dysplasia (BPD) & Jensen 2019 / NRN Staging
// References: Jensen EA et al. NEJM 2019; NICHD Neonatal Research Network BPD Definition

export type RespiratorySupportType =
  | 'none_room_air'
  | 'nasal_cannula_low_flow'
  | 'nasal_cannula_high_flow'
  | 'cpap_nippv'
  | 'invasive_mechanical_ventilation';

export type JensenBpdGrade =
  | 'no_bpd'
  | 'grade_1'
  | 'grade_2'
  | 'grade_3';

export interface NeonatalBpdInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  currentPmaWeeks: number;
  respiratorySupportType: RespiratorySupportType;
  cannulaFlowLpm?: number;
  fio2Percent?: number;
  spo2Percent?: number;
  caffeineActive?: boolean;
  diureticsActive?: boolean;
  postnatalSteroidsActive?: boolean;
}

export interface NeonatalBpdEvaluation {
  currentPmaWeeks: number;
  jensenBpdGrade: JensenBpdGrade;
  gradeLabel: string;
  isEligibleForJensenStaging: boolean; // Evaluated at >= 36 weeks PMA in preterm infants < 32w GA
  severitySummary: string;
  targetSpo2Min: number;
  targetSpo2Max: number;
  roomAirChallengeEligible: boolean;
  homeOxygenCandidate: boolean;
  caffeineRecommendation: string;
  steroidGuidance: string;
  diureticGuidance: string;
  clinicalActions: string[];
}

/**
 * Calculates Postmenstrual Age (PMA) in decimal weeks.
 */
export function calculatePmaWeeks(gestationalAgeWeeks: number, chronologicalAgeDays: number): number {
  const pma = gestationalAgeWeeks + (chronologicalAgeDays / 7);
  return Math.round(pma * 10) / 10;
}

/**
 * Classifies BPD according to Jensen et al. (NEJM 2019) criteria at 36 weeks PMA:
 * - No BPD: No respiratory support
 * - Grade 1: Nasal cannula <= 2 L/min (regardless of FiO2)
 * - Grade 2: Nasal cannula > 2 L/min OR non-invasive positive pressure (NIPPV/CPAP)
 * - Grade 3: Invasive mechanical ventilation
 */
export function classifyJensenBpdGrade(
  supportType: RespiratorySupportType,
  cannulaFlowLpm = 0,
): JensenBpdGrade {
  switch (supportType) {
    case 'none_room_air':
      return 'no_bpd';

    case 'nasal_cannula_low_flow':
      return cannulaFlowLpm <= 2.0 ? 'grade_1' : 'grade_2';

    case 'nasal_cannula_high_flow':
      return cannulaFlowLpm <= 2.0 ? 'grade_1' : 'grade_2';

    case 'cpap_nippv':
      return 'grade_2';

    case 'invasive_mechanical_ventilation':
      return 'grade_3';

    default:
      return 'no_bpd';
  }
}

/**
 * Evaluates comprehensive neonatal BPD management, target SpO2 titration, and pharmacotherapy.
 */
export function evaluateNeonatalBpd(input: NeonatalBpdInput): NeonatalBpdEvaluation {
  const flow = input.cannulaFlowLpm ?? 0;
  const grade = classifyJensenBpdGrade(input.respiratorySupportType, flow);
  const pma = input.currentPmaWeeks;
  const isEligibleForJensen = input.gestationalAgeWeeks < 32 && pma >= 36.0;

  let gradeLabel = 'No BPD';
  let severitySummary = 'Infant is breathing spontaneously in room air without positive pressure support.';

  switch (grade) {
    case 'grade_1':
      gradeLabel = 'Grade 1 BPD (Mild/Moderate Support)';
      severitySummary = `Receiving low-flow nasal cannula support (<= 2 L/min: ${flow} L/min). Low risk of late death or severe neurodevelopmental impairment.`;
      break;
    case 'grade_2':
      gradeLabel = 'Grade 2 BPD (Moderate/Severe Support)';
      severitySummary = `Receiving CPAP, NIPPV, or high-flow nasal cannula (> 2 L/min: ${flow} L/min). Intermediate risk of pulmonary hypertension and readmission.`;
      break;
    case 'grade_3':
      gradeLabel = 'Grade 3 BPD (Severe / Invasive Support)';
      severitySummary = 'Receiving invasive mechanical ventilation at/beyond 36 weeks PMA. High risk of severe tracheobronchomalacia, cor pulmonale, and prolonged hospitalization.';
      break;
    case 'no_bpd':
    default:
      gradeLabel = 'No BPD';
      severitySummary = 'Infant is breathing spontaneously in room air without positive pressure support.';
      break;
  }

  // AAP / NeOProM SpO2 target recommendations: 91 - 95%
  const targetSpo2Min = 91;
  const targetSpo2Max = 95;

  // Room air challenge eligibility: on low flow <= 0.5 L/min with FiO2 <= 30% maintaining SpO2 >= 92%
  const fio2 = input.fio2Percent ?? 21;
  const roomAirChallengeEligible =
    (input.respiratorySupportType === 'nasal_cannula_low_flow' && flow <= 0.5 && fio2 <= 30) ||
    (input.respiratorySupportType === 'none_room_air' && fio2 <= 21);

  // Home O2 candidacy: Grade 1 or 2 with persistent sub-atmospheric supplemental O2 need at >= 36w PMA
  const homeOxygenCandidate =
    pma >= 36.0 &&
    (grade === 'grade_1' || grade === 'grade_2') &&
    fio2 > 21;

  // Caffeine Guidance: Continue until 34-36w PMA and >= 5-7 days apnea-free
  let caffeineRecommendation = 'Caffeine citrate may be discontinued if >= 34-36 weeks PMA and >= 5 days apnea-free.';
  if (pma < 34.0) {
    caffeineRecommendation = 'Maintain caffeine citrate (20 mg/kg load, 5-10 mg/kg/day maintenance) for apnea of prematurity and extubation neuroprotection.';
  } else if (input.caffeineActive) {
    caffeineRecommendation = 'Wean caffeine citrate: verify infant has been apnea/bradycardia free for >= 5 to 7 days before discharge.';
  }

  // Steroid Guidance (DART protocol vs inhaled budesonide)
  let steroidGuidance = 'Routine systemic steroids NOT indicated. Use only for ventilator-dependent infants unable to extubate.';
  if (grade === 'grade_3' || (grade === 'grade_2' && pma >= 34.0 && fio2 >= 50)) {
    steroidGuidance = 'Consider low-dose dexamethasone taper (DART Protocol: 0.89 mg/kg cumulative over 10 days) to facilitate extubation, monitoring blood pressure and glucose.';
  }

  // Diuretic Guidance
  let diureticGuidance = 'Diuretics (chlorothiazide + spironolactone) reserved for acute pulmonary edema or cor pulmonale; not recommended for routine long-term BPD prevention.';
  if (input.diureticsActive) {
    diureticGuidance = 'Monitor serum electrolytes, urinary calcium-to-creatinine ratio (nephrocalcinosis risk), and linear growth weekly during diuretic therapy.';
  }

  const clinicalActions: string[] = [];
  if (pma >= 36.0 && !isEligibleForJensen && input.gestationalAgeWeeks >= 32) {
    clinicalActions.push('Note: Jensen criteria validated in infants < 32w GA. For >= 32w GA, evaluate clinical chronicity at 28-56 days of life.');
  }
  if (grade === 'grade_3') {
    clinicalActions.push('Screen for pulmonary hypertension via echocardiography (RV hypertrophy, septal flattening, TR jet velocity).');
    clinicalActions.push('Evaluate airway mechanics: check for subglottic stenosis or tracheomalacia via bronchoscopy if extubation failure occurs.');
  }
  if (grade === 'grade_2' || grade === 'grade_1') {
    clinicalActions.push('Maintain target pulse oximetry 91-95% to prevent both retinopathy of prematurity (hyperoxia) and pulmonary vasoconstriction (hypoxia).');
    if (homeOxygenCandidate) {
      clinicalActions.push('Initiate multidisciplinary discharge planning: family home O2 training, pulse oximeter monitoring, and RSV immunoprophylaxis (Palivizumab).');
    }
  }

  return {
    currentPmaWeeks: pma,
    jensenBpdGrade: grade,
    gradeLabel,
    isEligibleForJensenStaging: isEligibleForJensen,
    severitySummary,
    targetSpo2Min,
    targetSpo2Max,
    roomAirChallengeEligible,
    homeOxygenCandidate,
    caffeineRecommendation,
    steroidGuidance,
    diureticGuidance,
    clinicalActions,
  };
}
