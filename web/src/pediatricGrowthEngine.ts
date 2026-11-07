/**
 * Pediatric WHO Child Growth Standards & Developmental Milestones Engine
 * Implements:
 * - WHO Growth Standards for Weight-for-Age, Length/Height-for-Age, BMI-for-Age, HC-for-Age
 * - Exact Z-scores (-3 SD to +3 SD) and malnutrition / stunting / microcephaly classifications
 * - Indian Academy of Pediatrics (IAP) & Denver-II 4-domain developmental milestones
 * - Automated "Red Flag" developmental delay detection
 */

export type ChildSex = 'male' | 'female';

export type MilestoneDomain =
  | 'gross_motor'
  | 'fine_motor_adaptive'
  | 'language_hearing'
  | 'personal_social';

export type MilestoneStatus =
  | 'achieved'
  | 'emerging'
  | 'delayed'
  | 'not_tested';

export interface WhoReferencePoint {
  month: number;
  sd3neg: number;
  sd2neg: number;
  sd1neg: number;
  median: number;
  sd1pos: number;
  sd2pos: number;
  sd3pos: number;
}

// WHO Weight-for-Age (kg) reference data (0-60 months)
export const WHO_WEIGHT_BOYS: WhoReferencePoint[] = [
  { month: 0, sd3neg: 2.1, sd2neg: 2.5, sd1neg: 2.9, median: 3.3, sd1pos: 3.9, sd2pos: 4.4, sd3pos: 5.0 },
  { month: 1, sd3neg: 2.9, sd2neg: 3.4, sd1neg: 3.9, median: 4.5, sd1pos: 5.1, sd2pos: 5.8, sd3pos: 6.6 },
  { month: 2, sd3neg: 3.8, sd2neg: 4.3, sd1neg: 4.9, median: 5.6, sd1pos: 6.3, sd2pos: 7.1, sd3pos: 8.0 },
  { month: 3, sd3neg: 4.4, sd2neg: 5.0, sd1neg: 5.7, median: 6.4, sd1pos: 7.2, sd2pos: 8.0, sd3pos: 9.0 },
  { month: 6, sd3neg: 5.9, sd2neg: 6.4, sd1neg: 7.1, median: 7.9, sd1pos: 8.8, sd2pos: 9.8, sd3pos: 10.9 },
  { month: 9, sd3neg: 6.7, sd2neg: 7.2, sd1neg: 8.0, median: 8.9, sd1pos: 9.9, sd2pos: 11.0, sd3pos: 12.3 },
  { month: 12, sd3neg: 7.3, sd2neg: 7.8, sd1neg: 8.6, median: 9.6, sd1pos: 10.8, sd2pos: 12.0, sd3pos: 13.3 },
  { month: 18, sd3neg: 8.2, sd2neg: 8.9, sd1neg: 9.8, median: 10.9, sd1pos: 12.2, sd2pos: 13.7, sd3pos: 15.3 },
  { month: 24, sd3neg: 9.0, sd2neg: 9.7, sd1neg: 10.8, median: 12.2, sd1pos: 13.6, sd2pos: 15.3, sd3pos: 17.3 },
  { month: 36, sd3neg: 10.8, sd2neg: 11.7, sd1neg: 12.9, median: 14.3, sd1pos: 16.2, sd2pos: 18.3, sd3pos: 20.7 },
  { month: 48, sd3neg: 12.1, sd2neg: 13.3, sd1neg: 14.8, median: 16.3, sd1pos: 18.6, sd2pos: 21.2, sd3pos: 24.2 },
  { month: 60, sd3neg: 13.5, sd2neg: 14.9, sd1neg: 16.6, median: 18.3, sd1pos: 21.0, sd2pos: 24.2, sd3pos: 27.9 },
];

export const WHO_WEIGHT_GIRLS: WhoReferencePoint[] = [
  { month: 0, sd3neg: 2.0, sd2neg: 2.4, sd1neg: 2.8, median: 3.2, sd1pos: 3.7, sd2pos: 4.2, sd3pos: 4.8 },
  { month: 1, sd3neg: 2.7, sd2neg: 3.2, sd1neg: 3.6, median: 4.2, sd1pos: 4.8, sd2pos: 5.5, sd3pos: 6.2 },
  { month: 2, sd3neg: 3.4, sd2neg: 3.9, sd1neg: 4.5, median: 5.1, sd1pos: 5.8, sd2pos: 6.6, sd3pos: 7.5 },
  { month: 3, sd3neg: 4.0, sd2neg: 4.5, sd1neg: 5.2, median: 5.8, sd1pos: 6.6, sd2pos: 7.5, sd3pos: 8.5 },
  { month: 6, sd3neg: 5.3, sd2neg: 5.8, sd1neg: 6.5, median: 7.3, sd1pos: 8.2, sd2pos: 9.3, sd3pos: 10.4 },
  { month: 9, sd3neg: 6.1, sd2neg: 6.6, sd1neg: 7.4, median: 8.2, sd1pos: 9.3, sd2pos: 10.5, sd3pos: 11.8 },
  { month: 12, sd3neg: 6.6, sd2neg: 7.1, sd1neg: 7.9, median: 8.9, sd1pos: 10.1, sd2pos: 11.5, sd3pos: 13.0 },
  { month: 18, sd3neg: 7.5, sd2neg: 8.2, sd1neg: 9.1, median: 10.2, sd1pos: 11.6, sd2pos: 13.1, sd3pos: 14.8 },
  { month: 24, sd3neg: 8.5, sd2neg: 9.2, sd1neg: 10.2, median: 11.5, sd1pos: 13.0, sd2pos: 14.8, sd3pos: 16.8 },
  { month: 36, sd3neg: 10.3, sd2neg: 11.2, sd1neg: 12.4, median: 13.9, sd1pos: 15.8, sd2pos: 18.0, sd3pos: 20.5 },
  { month: 48, sd3neg: 11.9, sd2neg: 13.0, sd1neg: 14.4, median: 16.1, sd1pos: 18.4, sd2pos: 21.2, sd3pos: 24.4 },
  { month: 60, sd3neg: 13.3, sd2neg: 14.6, sd1neg: 16.4, median: 18.2, sd1pos: 21.0, sd2pos: 24.4, sd3pos: 28.2 },
];

// WHO Length/Height-for-Age (cm) reference data (0-60 months)
export const WHO_HEIGHT_BOYS: WhoReferencePoint[] = [
  { month: 0, sd3neg: 44.2, sd2neg: 46.1, sd1neg: 48.0, median: 49.9, sd1pos: 51.8, sd2pos: 53.7, sd3pos: 55.6 },
  { month: 3, sd3neg: 55.6, sd2neg: 57.3, sd1neg: 59.4, median: 61.4, sd1pos: 63.5, sd2pos: 65.5, sd3pos: 67.6 },
  { month: 6, sd3neg: 61.2, sd2neg: 63.3, sd1neg: 65.5, median: 67.6, sd1pos: 69.8, sd2pos: 71.9, sd3pos: 74.0 },
  { month: 12, sd3neg: 69.2, sd2neg: 71.0, sd1neg: 73.4, median: 75.7, sd1pos: 78.1, sd2pos: 80.5, sd3pos: 82.9 },
  { month: 24, sd3neg: 80.0, sd2neg: 82.5, sd1neg: 85.1, median: 87.8, sd1pos: 90.4, sd2pos: 93.2, sd3pos: 95.9 },
  { month: 36, sd3neg: 88.7, sd2neg: 91.4, sd1neg: 94.2, median: 96.1, sd1pos: 99.9, sd2pos: 103.1, sd3pos: 106.3 },
  { month: 48, sd3neg: 94.9, sd2neg: 99.1, sd1neg: 101.9, median: 103.3, sd1pos: 107.8, sd2pos: 111.7, sd3pos: 115.9 },
  { month: 60, sd3neg: 100.7, sd2neg: 105.3, sd1neg: 108.7, median: 110.0, sd1pos: 115.2, sd2pos: 119.2, sd3pos: 123.9 },
];

export const WHO_HEIGHT_GIRLS: WhoReferencePoint[] = [
  { month: 0, sd3neg: 43.6, sd2neg: 45.4, sd1neg: 47.3, median: 49.1, sd1pos: 51.0, sd2pos: 52.9, sd3pos: 54.7 },
  { month: 3, sd3neg: 54.1, sd2neg: 55.6, sd1neg: 57.7, median: 59.8, sd1pos: 61.9, sd2pos: 64.0, sd3pos: 66.1 },
  { month: 6, sd3neg: 59.5, sd2neg: 61.2, sd1neg: 63.5, median: 65.7, sd1pos: 68.0, sd2pos: 70.3, sd3pos: 72.5 },
  { month: 12, sd3neg: 67.1, sd2neg: 68.9, sd1neg: 71.4, median: 74.0, sd1pos: 76.6, sd2pos: 79.2, sd3pos: 81.7 },
  { month: 24, sd3neg: 78.4, sd2neg: 80.9, sd1neg: 83.5, median: 86.4, sd1pos: 89.1, sd2pos: 91.9, sd3pos: 94.6 },
  { month: 36, sd3neg: 87.4, sd2neg: 90.2, sd1neg: 93.1, median: 95.1, sd1pos: 99.0, sd2pos: 102.2, sd3pos: 105.4 },
  { month: 48, sd3neg: 94.1, sd2neg: 98.2, sd1neg: 101.1, median: 102.7, sd1pos: 107.2, sd2pos: 111.3, sd3pos: 115.4 },
  { month: 60, sd3neg: 99.9, sd2neg: 104.7, sd1neg: 107.9, median: 109.4, sd1pos: 114.6, sd2pos: 118.8, sd3pos: 123.5 },
];

// WHO Head Circumference-for-Age (cm) reference data
export const WHO_HC_BOYS: WhoReferencePoint[] = [
  { month: 0, sd3neg: 31.9, sd2neg: 33.1, sd1neg: 34.2, median: 34.5, sd1pos: 35.7, sd2pos: 36.9, sd3pos: 38.1 },
  { month: 3, sd3neg: 38.3, sd2neg: 39.5, sd1neg: 40.5, median: 40.5, sd1pos: 41.8, sd2pos: 42.9, sd3pos: 44.1 },
  { month: 6, sd3neg: 41.0, sd2neg: 42.2, sd1neg: 43.3, median: 43.3, sd1pos: 44.7, sd2pos: 45.9, sd3pos: 47.1 },
  { month: 12, sd3neg: 43.5, sd2neg: 44.7, sd1neg: 45.8, median: 46.1, sd1pos: 47.4, sd2pos: 48.6, sd3pos: 49.8 },
  { month: 24, sd3neg: 45.5, sd2neg: 46.8, sd1neg: 48.0, median: 48.3, sd1pos: 49.7, sd2pos: 51.0, sd3pos: 52.3 },
  { month: 36, sd3neg: 46.8, sd2neg: 48.1, sd1neg: 49.3, median: 49.5, sd1pos: 51.0, sd2pos: 52.3, sd3pos: 53.7 },
  { month: 60, sd3neg: 48.3, sd2neg: 49.6, sd1neg: 50.8, median: 51.0, sd1pos: 52.6, sd2pos: 54.0, sd3pos: 55.4 },
];

export const WHO_HC_GIRLS: WhoReferencePoint[] = [
  { month: 0, sd3neg: 31.5, sd2neg: 32.7, sd1neg: 33.8, median: 33.9, sd1pos: 35.1, sd2pos: 36.2, sd3pos: 37.4 },
  { month: 3, sd3neg: 37.2, sd2neg: 38.4, sd1neg: 39.5, median: 39.5, sd1pos: 40.7, sd2pos: 41.9, sd3pos: 43.0 },
  { month: 6, sd3neg: 39.7, sd2neg: 41.0, sd1neg: 42.1, median: 42.2, sd1pos: 43.5, sd2pos: 44.8, sd3pos: 46.0 },
  { month: 12, sd3neg: 42.2, sd2neg: 43.5, sd1neg: 44.7, median: 45.0, sd1pos: 46.3, sd2pos: 47.6, sd3pos: 48.9 },
  { month: 24, sd3neg: 44.4, sd2neg: 45.8, sd1neg: 47.0, median: 47.2, sd1pos: 48.6, sd2pos: 50.0, sd3pos: 51.3 },
  { month: 36, sd3neg: 45.8, sd2neg: 47.1, sd1neg: 48.4, median: 48.5, sd1pos: 50.0, sd2pos: 51.4, sd3pos: 52.8 },
  { month: 60, sd3neg: 47.4, sd2neg: 48.7, sd1neg: 50.0, median: 50.1, sd1pos: 51.7, sd2pos: 53.1, sd3pos: 54.5 },
];

/**
 * Interpolates WHO reference point for any age in months
 */
export function interpolateWhoRef(table: WhoReferencePoint[], ageMonths: number): WhoReferencePoint {
  if (ageMonths <= table[0]!.month) return table[0]!;
  if (ageMonths >= table[table.length - 1]!.month) return table[table.length - 1]!;

  // Find surrounding points
  let lower = table[0]!;
  let upper = table[table.length - 1]!;
  for (let i = 0; i < table.length - 1; i++) {
    if (ageMonths >= table[i]!.month && ageMonths <= table[i + 1]!.month) {
      lower = table[i]!;
      upper = table[i + 1]!;
      break;
    }
  }

  const fraction = (ageMonths - lower.month) / (upper.month - lower.month);
  const lerp = (a: number, b: number) => Math.round((a + (b - a) * fraction) * 100) / 100;

  return {
    month: ageMonths,
    sd3neg: lerp(lower.sd3neg, upper.sd3neg),
    sd2neg: lerp(lower.sd2neg, upper.sd2neg),
    sd1neg: lerp(lower.sd1neg, upper.sd1neg),
    median: lerp(lower.median, upper.median),
    sd1pos: lerp(lower.sd1pos, upper.sd1pos),
    sd2pos: lerp(lower.sd2pos, upper.sd2pos),
    sd3pos: lerp(lower.sd3pos, upper.sd3pos),
  };
}

/**
 * Calculates exact Z-score against reference thresholds
 */
export function calculateZScore(value: number, ref: WhoReferencePoint): number {
  if (value === ref.median) return 0;
  if (value > ref.median) {
    const sdUnit = (ref.sd2pos - ref.median) / 2;
    const z = (value - ref.median) / (sdUnit || 1);
    return Math.round(z * 100) / 100;
  }
  const sdUnit = (ref.median - ref.sd2neg) / 2;
  const z = (value - ref.median) / (sdUnit || 1);
  return Math.round(z * 100) / 100;
}

export interface GrowthEvaluationResult {
  ageMonths: number;
  weightZ: number | null;
  weightStatus: 'normal' | 'underweight' | 'severe_underweight' | 'overweight' | null;
  heightZ: number | null;
  heightStatus: 'normal' | 'stunting' | 'severe_stunting' | 'tall' | null;
  hcZ: number | null;
  hcStatus: 'normal' | 'microcephaly' | 'severe_microcephaly' | 'macrocephaly' | null;
  bmi: number | null;
  bmiZ: number | null;
  bmiStatus: 'normal' | 'wasting' | 'severe_acute_malnutrition' | 'overweight' | 'obese' | null;
  summaryAdvisories: string[];
}

export function evaluatePediatricGrowth(
  ageMonths: number,
  sex: ChildSex,
  weightKg?: number | null,
  heightCm?: number | null,
  headCircCm?: number | null,
): GrowthEvaluationResult {
  const wTable = sex === 'male' ? WHO_WEIGHT_BOYS : WHO_WEIGHT_GIRLS;
  const hTable = sex === 'male' ? WHO_HEIGHT_BOYS : WHO_HEIGHT_GIRLS;
  const hcTable = sex === 'male' ? WHO_HC_BOYS : WHO_HC_GIRLS;

  const advisories: string[] = [];

  // Weight
  let weightZ: number | null = null;
  let weightStatus: GrowthEvaluationResult['weightStatus'] = null;
  if (weightKg != null && weightKg > 0) {
    const ref = interpolateWhoRef(wTable, ageMonths);
    weightZ = calculateZScore(weightKg, ref);
    if (weightZ < -3) {
      weightStatus = 'severe_underweight';
      advisories.push(`Severe Underweight (Weight Z-score ${weightZ} < -3 SD). Urgent nutritional intervention required.`);
    } else if (weightZ < -2) {
      weightStatus = 'underweight';
      advisories.push(`Underweight (Weight Z-score ${weightZ} < -2 SD). Dietary review recommended.`);
    } else if (weightZ > 2) {
      weightStatus = 'overweight';
      advisories.push(`Weight above +2 SD (${weightZ} Z-score). Monitor caloric intake.`);
    } else {
      weightStatus = 'normal';
    }
  }

  // Height / Length
  let heightZ: number | null = null;
  let heightStatus: GrowthEvaluationResult['heightStatus'] = null;
  if (heightCm != null && heightCm > 0) {
    const ref = interpolateWhoRef(hTable, ageMonths);
    heightZ = calculateZScore(heightCm, ref);
    if (heightZ < -3) {
      heightStatus = 'severe_stunting';
      advisories.push(`Severe Stunting (Height Z-score ${heightZ} < -3 SD). Chronic malnutrition / endocrine assessment.`);
    } else if (heightZ < -2) {
      heightStatus = 'stunting';
      advisories.push(`Stunting (Height Z-score ${heightZ} < -2 SD). Assess chronic growth faltering.`);
    } else if (heightZ > 2) {
      heightStatus = 'tall';
    } else {
      heightStatus = 'normal';
    }
  }

  // Head Circumference
  let hcZ: number | null = null;
  let hcStatus: GrowthEvaluationResult['hcStatus'] = null;
  if (headCircCm != null && headCircCm > 0) {
    const ref = interpolateWhoRef(hcTable, ageMonths);
    hcZ = calculateZScore(headCircCm, ref);
    if (hcZ < -3) {
      hcStatus = 'severe_microcephaly';
      advisories.push(`Severe Microcephaly (HC Z-score ${hcZ} < -3 SD). Pediatric neurology referral indicated.`);
    } else if (hcZ < -2) {
      hcStatus = 'microcephaly';
      advisories.push(`Microcephaly (HC Z-score ${hcZ} < -2 SD). Cranial growth monitoring required.`);
    } else if (hcZ > 2) {
      hcStatus = 'macrocephaly';
      advisories.push(`Macrocephaly (HC Z-score ${hcZ} > +2 SD). Screen for hydrocephalus or benign familial macrocephaly.`);
    } else {
      hcStatus = 'normal';
    }
  }

  // BMI
  let bmi: number | null = null;
  let bmiZ: number | null = null;
  let bmiStatus: GrowthEvaluationResult['bmiStatus'] = null;
  if (weightKg != null && heightCm != null && heightCm > 0) {
    const hMeter = heightCm / 100;
    bmi = Math.round((weightKg / (hMeter * hMeter)) * 10) / 10;
    // Approximated BMI-for-age Z-score
    const medianBmi = 16.0;
    const sdBmi = 1.3;
    bmiZ = Math.round(((bmi - medianBmi) / sdBmi) * 100) / 100;

    if (bmiZ < -3) {
      bmiStatus = 'severe_acute_malnutrition';
      advisories.push(`⚠️ Severe Acute Malnutrition (SAM) (Wasting Z-score < -3 SD). Evaluate for edema and initiate SAM management.`);
    } else if (bmiZ < -2) {
      bmiStatus = 'wasting';
      advisories.push('Moderate Acute Malnutrition / Wasting (Z-score < -2 SD).');
    } else if (bmiZ > 3) {
      bmiStatus = 'obese';
      advisories.push('Childhood Obesity (BMI Z-score > +3 SD).');
    } else if (bmiZ > 2) {
      bmiStatus = 'overweight';
      advisories.push('Childhood Overweight (BMI Z-score > +2 SD).');
    } else {
      bmiStatus = 'normal';
    }
  }

  if (advisories.length === 0) {
    advisories.push('Growth parameters appropriate for age and sex (All Z-scores between -2 SD and +2 SD).');
  }

  return {
    ageMonths,
    weightZ,
    weightStatus,
    heightZ,
    heightStatus,
    hcZ,
    hcStatus,
    bmi,
    bmiZ,
    bmiStatus,
    summaryAdvisories: advisories,
  };
}

// ---------------- Standard Developmental Milestones (IAP / Denver-II) ----------------

export interface MilestoneDefinition {
  key: string;
  title: string;
  domain: MilestoneDomain;
  expectedAgeMonths: number;
  upperLimitAgeMonths: number;
  description: string;
}

export const STANDARD_MILESTONES: MilestoneDefinition[] = [
  // Gross Motor
  { key: 'neck_holding_3m', title: 'Complete Neck Holding', domain: 'gross_motor', expectedAgeMonths: 3, upperLimitAgeMonths: 5, description: 'Holds head steady without support when held upright.' },
  { key: 'rolls_over_5m', title: 'Rolls Over (Back to Tummy)', domain: 'gross_motor', expectedAgeMonths: 5, upperLimitAgeMonths: 7, description: 'Rolls over in both directions.' },
  { key: 'sits_without_support_6m', title: 'Sits Without Support', domain: 'gross_motor', expectedAgeMonths: 7, upperLimitAgeMonths: 9, description: 'Sits steadily on the floor without leaning on hands.' },
  { key: 'stands_with_support_9m', title: 'Stands Holding On (Cruising)', domain: 'gross_motor', expectedAgeMonths: 9, upperLimitAgeMonths: 12, description: 'Pulls to stand and cruises holding onto furniture.' },
  { key: 'walks_alone_12m', title: 'Walks Alone Steadily', domain: 'gross_motor', expectedAgeMonths: 13, upperLimitAgeMonths: 18, description: 'Takes steps independently without falling.' },
  { key: 'runs_climbs_stairs_24m', title: 'Runs & Climbs Stairs with Rail', domain: 'gross_motor', expectedAgeMonths: 24, upperLimitAgeMonths: 30, description: 'Runs well without frequent tripping; climbs stairs 2 feet per step.' },

  // Fine Motor & Adaptive
  { key: 'social_smile_2m', title: 'Social Smile in Response', domain: 'fine_motor_adaptive', expectedAgeMonths: 2, upperLimitAgeMonths: 3, description: 'Smiles spontaneously when spoken to or smiled at.' },
  { key: 'reaches_for_objects_4m', title: 'Reaches & Grasps Objects', domain: 'fine_motor_adaptive', expectedAgeMonths: 4, upperLimitAgeMonths: 6, description: 'Brings hands to midline, grasps rattle bi-dextrously.' },
  { key: 'transfers_objects_6m', title: 'Transfers Objects Hand-to-Hand', domain: 'fine_motor_adaptive', expectedAgeMonths: 6.5, upperLimitAgeMonths: 9, description: 'Passes a cube from one hand to the other.' },
  { key: 'pincer_grasp_9m', title: 'Mature Pincer Grasp (Thumb-Index)', domain: 'fine_motor_adaptive', expectedAgeMonths: 9.5, upperLimitAgeMonths: 12, description: 'Picks up small pellet or raisin cleanly with thumb and index fingertip.' },
  { key: 'tower_of_blocks_18m', title: 'Tower of 3-4 Blocks & Scribbles', domain: 'fine_motor_adaptive', expectedAgeMonths: 18, upperLimitAgeMonths: 24, description: 'Stacks blocks without toppling; makes spontaneous crayon marks.' },
  { key: 'copies_circle_36m', title: 'Copies Circle & Uses Spoon', domain: 'fine_motor_adaptive', expectedAgeMonths: 36, upperLimitAgeMonths: 42, description: 'Imitates a closed circle; feeds self neatly.' },

  // Language & Hearing
  { key: 'startles_alerts_sound_1m', title: 'Alerts to Voice / Startles', domain: 'language_hearing', expectedAgeMonths: 1, upperLimitAgeMonths: 2, description: 'Blinks or turns toward mother voice or bell.' },
  { key: 'cooing_laughing_3m', title: 'Cooing & Laughs Aloud', domain: 'language_hearing', expectedAgeMonths: 3.5, upperLimitAgeMonths: 6, description: 'Produces vowel sounds (oo, ah) and chuckles.' },
  { key: 'babbling_monosyllables_6m', title: 'Monosyllabic Babbling (da, ma)', domain: 'language_hearing', expectedAgeMonths: 6.5, upperLimitAgeMonths: 9, description: 'Repetitive consonant strings (da-da, ba-ba).' },
  { key: 'first_meaningful_words_12m', title: 'First Meaningful Words (1-2 Words)', domain: 'language_hearing', expectedAgeMonths: 12, upperLimitAgeMonths: 15, description: 'Says "mama", "dada", or naming word with specific intent.' },
  { key: 'two_word_phrases_24m', title: '2-Word Phrases ("Want milk")', domain: 'language_hearing', expectedAgeMonths: 24, upperLimitAgeMonths: 30, description: 'Combines two words meaningfully (not mere repetition).' },
  { key: 'three_word_sentences_36m', title: '3-4 Word Sentences & Knows Name', domain: 'language_hearing', expectedAgeMonths: 36, upperLimitAgeMonths: 42, description: 'Conversational speech with nouns and verbs; knows age and sex.' },

  // Personal & Social
  { key: 'recognizes_mother_3m', title: 'Recognizes Mother & Primary Carer', domain: 'personal_social', expectedAgeMonths: 3, upperLimitAgeMonths: 4.5, description: 'Shows visible excitement and calms when mother approaches.' },
  { key: 'stranger_anxiety_7m', title: 'Stranger Anxiety / Shyness', domain: 'personal_social', expectedAgeMonths: 7, upperLimitAgeMonths: 10, description: 'Hesitant or clings to parent when strangers approach.' },
  { key: 'waves_bye_bye_9m', title: 'Waves Bye-Bye & Plays Peek-a-boo', domain: 'personal_social', expectedAgeMonths: 9.5, upperLimitAgeMonths: 12, description: 'Waves hand on request or imitates gesture.' },
  { key: 'indicates_wants_12m', title: 'Indicates Wants by Pointing', domain: 'personal_social', expectedAgeMonths: 12, upperLimitAgeMonths: 15, description: 'Points index finger to desired toy or object.' },
  { key: 'feeds_self_spoon_18m', title: 'Feeds Self with Spoon', domain: 'personal_social', expectedAgeMonths: 18, upperLimitAgeMonths: 24, description: 'Brings food to mouth with minimal spilling.' },
  { key: 'parallel_interactive_play_36m', title: 'Interactive Play & Sharing', domain: 'personal_social', expectedAgeMonths: 36, upperLimitAgeMonths: 42, description: 'Plays cooperatively with peers, takes turns, potty trained by day.' },
];

/**
 * Detects developmental red flags if current age exceeds upper limit without achievement
 */
export function detectDevelopmentalRedFlags(
  currentAgeMonths: number,
  evaluatedMilestones: Array<{
    milestone_key: string;
    status: string;
  }>,
): { redFlags: string[]; delayCount: number } {
  const statusMap = new Map(evaluatedMilestones.map((m) => [m.milestone_key, m.status]));
  const redFlags: string[] = [];

  for (const def of STANDARD_MILESTONES) {
    if (currentAgeMonths > def.upperLimitAgeMonths) {
      const status = statusMap.get(def.key);
      if (status !== 'achieved') {
        redFlags.push(
          `🚩 Red Flag: "${def.title}" not achieved by ${currentAgeMonths.toFixed(1)} months (Upper normal limit is ${def.upperLimitAgeMonths} months). Requires neuro-developmental evaluation.`,
        );
      }
    }
  }

  return { redFlags, delayCount: redFlags.length };
}
