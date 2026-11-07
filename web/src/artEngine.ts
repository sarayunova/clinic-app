/**
 * Assisted Reproductive Technology (ART) & IVF-ICSI Embryo Transfer Engine
 *
 * References:
 * - ASRM / SART Practice Guidelines: Blastocyst transfer and Single Embryo Transfer (SET) policies.
 * - Gardner DK et al. Assessment of human blastocyst development in vitro and its relation to pregnancy. Fertil Steril 1999.
 * - ESHRE Guideline: Ovarian Stimulation for IVF/ICSI.
 * - Barnhart KT et al. Symptomatic patients with an early viable intrauterine pregnancy: HCG curves redefined. Obstet Gynecol 2004.
 */

export type GardnerExpansion = 1 | 2 | 3 | 4 | 5 | 6;
export type GardnerQuality = 'A' | 'B' | 'C';

export interface BlastocystGrade {
  expansion: GardnerExpansion;
  innerCellMass: GardnerQuality;
  trophectoderm: GardnerQuality;
  code: string; // e.g. "4AA", "3BB"
}

export type EmbryoQualityTier = 'top_quality' | 'good_quality' | 'fair_quality' | 'poor_quality';

export interface HcgKineticsInput {
  hcg1Value: number; // mIU/mL
  hcg1Datetime: string; // ISO or YYYY-MM-DDTHH:MM
  hcg2Value: number; // mIU/mL
  hcg2Datetime: string;
}

export interface HcgKineticsResult {
  hoursDifference: number;
  hcgRatio: number;
  doublingTimeHours: number;
  twoDayPercentIncrease: number;
  interpretation: 'normal_viable_trajectory' | 'slow_suboptimal_rise' | 'plateau_or_falling' | 'invalid_values';
  clinicalSummary: string;
}

export function parseGardnerGrade(code: string): {
  grade: BlastocystGrade | null;
  tier: EmbryoQualityTier;
  summary: string;
} {
  const clean = code.trim().toUpperCase();
  const match = clean.match(/^([1-6])([A-C])([A-C])$/);

  if (!match || !match[1] || !match[2] || !match[3]) {
    return {
      grade: null,
      tier: 'poor_quality',
      summary: 'Unclassified embryo morphology',
    };
  }

  const expansion = Number.parseInt(match[1], 10) as GardnerExpansion;
  const icm = match[2] as GardnerQuality;
  const te = match[3] as GardnerQuality;

  let tier: EmbryoQualityTier = 'fair_quality';
  let summary = '';

  if (expansion >= 3 && icm === 'A' && te === 'A') {
    tier = 'top_quality';
    summary = `Top Quality Blastocyst (${clean}) - Optimal inner cell mass and cohesive trophectoderm. High implantation potential (~60-65%).`;
  } else if (expansion >= 3 && ((icm === 'A' && te === 'B') || (icm === 'B' && te === 'A'))) {
    tier = 'good_quality';
    summary = `Good Quality Blastocyst (${clean}) - Robust morphology suitable for elective Single Embryo Transfer (~50-55% implantation).`;
  } else if (icm === 'B' && te === 'B') {
    tier = 'fair_quality';
    summary = `Fair Quality Blastocyst (${clean}) - Moderate cellularity (~35-40% implantation).`;
  } else {
    tier = 'poor_quality';
    summary = `Poor Quality Blastocyst (${clean}) - Sparse inner cell mass or trophectoderm cells (<20% implantation).`;
  }

  return {
    grade: { expansion, innerCellMass: icm, trophectoderm: te, code: clean },
    tier,
    summary,
  };
}

export function calculateHcgDoublingKinetics(input: HcgKineticsInput): HcgKineticsResult {
  const { hcg1Value, hcg2Value, hcg1Datetime, hcg2Datetime } = input;

  if (hcg1Value <= 0 || hcg2Value <= 0) {
    return {
      hoursDifference: 0,
      hcgRatio: 0,
      doublingTimeHours: 0,
      twoDayPercentIncrease: 0,
      interpretation: 'invalid_values',
      clinicalSummary: 'Invalid hCG values; non-positive concentrations cannot be analyzed.',
    };
  }

  const t1 = new Date(hcg1Datetime).getTime();
  const t2 = new Date(hcg2Datetime).getTime();
  const hours = Math.max(1, (t2 - t1) / (1000 * 60 * 60));

  const ratio = hcg2Value / hcg1Value;

  if (ratio <= 1.0) {
    return {
      hoursDifference: Math.round(hours * 10) / 10,
      hcgRatio: Math.round(ratio * 100) / 100,
      doublingTimeHours: -1,
      twoDayPercentIncrease: Math.round(((ratio - 1) * 100) * 10) / 10,
      interpretation: 'plateau_or_falling',
      clinicalSummary:
        'Declining or plateaued beta-hCG trajectory. Indicates non-viable gestation, failing biochemical pregnancy, or resolving ectopic pregnancy.',
    };
  }

  // Doubling time formula: T_d = hours * ln(2) / ln(hCG2 / hCG1)
  const doublingTimeHours = (hours * Math.log(2)) / Math.log(ratio);
  const twoDayPercentIncrease = (Math.pow(ratio, 48 / hours) - 1) * 100;

  let interpretation: 'normal_viable_trajectory' | 'slow_suboptimal_rise' | 'plateau_or_falling' =
    'normal_viable_trajectory';
  let summary = '';

  if (doublingTimeHours <= 72.0 && twoDayPercentIncrease >= 53.0) {
    interpretation = 'normal_viable_trajectory';
    summary = `Normal robust beta-hCG progression: doubling time of ${Math.round(doublingTimeHours * 10) / 10} hours (+${Math.round(twoDayPercentIncrease)}% in 48h). Reassuring intrauterine implantation trajectory.`;
  } else {
    interpretation = 'slow_suboptimal_rise';
    summary = `Suboptimal beta-hCG rise: doubling time of ${Math.round(doublingTimeHours * 10) / 10} hours (+${Math.round(twoDayPercentIncrease)}% in 48h; normal is >=53%). Requires high-resolution TVS to rule out ectopic pregnancy or early embryonic demise.`;
  }

  return {
    hoursDifference: Math.round(hours * 10) / 10,
    hcgRatio: Math.round(ratio * 100) / 100,
    doublingTimeHours: Math.round(doublingTimeHours * 10) / 10,
    twoDayPercentIncrease: Math.round(twoDayPercentIncrease * 10) / 10,
    interpretation,
    clinicalSummary: summary,
  };
}
