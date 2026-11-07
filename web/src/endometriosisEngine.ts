/**
 * Endometriosis & Deep Infiltrating Endometriosis (DIE) Staging Engine
 *
 * References:
 * - Revised American Society for Reproductive Medicine (rASRM) classification of endometriosis: 1996. Fertil Steril 1997.
 * - Keckstein J et al. The #Enzian classification: A comprehensive code for recording the severity and location of endometriosis. Hum Reprod 2021.
 * - ESHRE Guideline: Endometriosis. Hum Reprod Open 2022.
 * - World Endometriosis Society consensus on the classification of endometriosis. Hum Reprod 2017.
 */

export type RasrmStage = 'stage_1_minimal' | 'stage_2_mild' | 'stage_3_moderate' | 'stage_4_severe';

export interface RasrmScoreInput {
  peritonealSuperficialPts: number;
  peritonealDeepPts: number;
  ovaryRightSuperficialPts: number;
  ovaryRightDeepPts: number;
  ovaryLeftSuperficialPts: number;
  ovaryLeftDeepPts: number;
  adhesionsOvaryRightPts: number;
  adhesionsOvaryLeftPts: number;
  adhesionsTubeRightPts: number;
  adhesionsTubeLeftPts: number;
  pouchOfDouglasObliteration: 'none' | 'partial_4pts' | 'complete_40pts';
}

export interface EnzianInput {
  peritoneum?: string | null; // e.g. "P1", "P2", "P3"
  ovaryRight?: string | null; // e.g. "O1", "O2", "O3"
  ovaryLeft?: string | null;
  tubeRight?: string | null;  // e.g. "T1", "T2", "T3"
  tubeLeft?: string | null;
  compartmentA?: string | null; // Vagina / RV space (A1, A2, A3)
  compartmentB?: string | null; // USL / parametrium (B1, B2, B3)
  compartmentC?: string | null; // Rectum / sigmoid (C1, C2, C3)
  extragenitalF?: string | null; // FB, FU, FI, FA
  adenomyosisFa?: boolean;
}

export interface VasPainScores {
  dysmenorrhea: number; // 0 to 10
  dyspareunia: number;
  dyschezia: number;
  dysuria: number;
  chronicPelvicPain: number;
}

export interface EndometriosisCalculationResult {
  rasrmTotalScore: number;
  rasrmStage: RasrmStage;
  rasrmStageLabel: string;
  enzianCompositeCode: string;
  painSeverityTier: 'minimal' | 'mild' | 'moderate' | 'severe';
  painSummary: string;
  deepInfiltratingEndometriosisPresent: boolean;
  bowelInvolvementNoted: boolean;
  urinaryInvolvementNoted: boolean;
  surgicalRecommendations: string[];
  medicalTherapyRecommendations: string[];
}

export function calculateRasrmScore(input: RasrmScoreInput): {
  totalScore: number;
  stage: RasrmStage;
  label: string;
} {
  let podPoints = 0;
  if (input.pouchOfDouglasObliteration === 'partial_4pts') podPoints = 4;
  else if (input.pouchOfDouglasObliteration === 'complete_40pts') podPoints = 40;

  const totalScore =
    (input.peritonealSuperficialPts || 0) +
    (input.peritonealDeepPts || 0) +
    (input.ovaryRightSuperficialPts || 0) +
    (input.ovaryRightDeepPts || 0) +
    (input.ovaryLeftSuperficialPts || 0) +
    (input.ovaryLeftDeepPts || 0) +
    (input.adhesionsOvaryRightPts || 0) +
    (input.adhesionsOvaryLeftPts || 0) +
    (input.adhesionsTubeRightPts || 0) +
    (input.adhesionsTubeLeftPts || 0) +
    podPoints;

  let stage: RasrmStage = 'stage_1_minimal';
  let label = 'Stage I (Minimal, 1–5 points)';

  if (totalScore >= 41) {
    stage = 'stage_4_severe';
    label = 'Stage IV (Severe, >40 points)';
  } else if (totalScore >= 16) {
    stage = 'stage_3_moderate';
    label = 'Stage III (Moderate, 16–40 points)';
  } else if (totalScore >= 6) {
    stage = 'stage_2_mild';
    label = 'Stage II (Mild, 6–15 points)';
  }

  return { totalScore, stage, label };
}

export function buildEnzianCompositeCode(input: EnzianInput): string {
  const parts: string[] = [];

  if (input.peritoneum) parts.push(`P${input.peritoneum.replace(/[^0-9]/g, '') || '1'}`);
  if (input.ovaryRight || input.ovaryLeft) {
    const r = input.ovaryRight?.replace(/[^0-9]/g, '') || '0';
    const l = input.ovaryLeft?.replace(/[^0-9]/g, '') || '0';
    parts.push(`O${r}/${l}`);
  }
  if (input.tubeRight || input.tubeLeft) {
    const r = input.tubeRight?.replace(/[^0-9]/g, '') || '0';
    const l = input.tubeLeft?.replace(/[^0-9]/g, '') || '0';
    parts.push(`T${r}/${l}`);
  }

  // DIE Compartments A, B, C
  if (input.compartmentA) parts.push(`A${input.compartmentA.replace(/[^0-9]/g, '') || '1'}`);
  if (input.compartmentB) parts.push(`B${input.compartmentB.replace(/[^0-9]/g, '') || '1'}`);
  if (input.compartmentC) parts.push(`C${input.compartmentC.replace(/[^0-9]/g, '') || '1'}`);

  // Extragenital & Adenomyosis
  if (input.extragenitalF) parts.push(`F(${input.extragenitalF})`);
  if (input.adenomyosisFa) parts.push('FA');

  return parts.length > 0 ? `#Enzian ${parts.join(', ')}` : '#Enzian (None)';
}

export function evaluateEndometriosis(
  rasrmInput: RasrmScoreInput,
  enzianInput: EnzianInput,
  pain: VasPainScores,
): EndometriosisCalculationResult {
  const { totalScore, stage, label: rasrmStageLabel } = calculateRasrmScore(rasrmInput);
  const enzianCompositeCode = buildEnzianCompositeCode(enzianInput);

  const maxPain = Math.max(
    pain.dysmenorrhea,
    pain.dyspareunia,
    pain.dyschezia,
    pain.dysuria,
    pain.chronicPelvicPain,
  );

  let painSeverityTier: 'minimal' | 'mild' | 'moderate' | 'severe' = 'minimal';
  if (maxPain >= 7) painSeverityTier = 'severe';
  else if (maxPain >= 4) painSeverityTier = 'moderate';
  else if (maxPain >= 1) painSeverityTier = 'mild';

  const painSummary = `Peak pain VAS ${maxPain}/10 (${painSeverityTier}). Dysmenorrhea: ${pain.dysmenorrhea}/10, Dyspareunia: ${pain.dyspareunia}/10, Dyschezia: ${pain.dyschezia}/10.`;

  const deepInfiltratingEndometriosisPresent = Boolean(
    enzianInput.compartmentA ||
    enzianInput.compartmentB ||
    enzianInput.compartmentC ||
    enzianInput.extragenitalF,
  );

  const bowelInvolvementNoted = Boolean(
    enzianInput.compartmentC || (enzianInput.extragenitalF && enzianInput.extragenitalF.includes('FI')),
  );

  const urinaryInvolvementNoted = Boolean(
    enzianInput.extragenitalF && (enzianInput.extragenitalF.includes('FB') || enzianInput.extragenitalF.includes('FU')),
  );

  const surgicalRecommendations: string[] = [];
  const medicalTherapyRecommendations: string[] = [];

  // Surgical guidance
  if (deepInfiltratingEndometriosisPresent) {
    surgicalRecommendations.push(
      'Multidisciplinary advanced laparoscopic excision: Complete cytoreductive resection of all visible peritoneal and deep infiltrating lesions.',
    );
    if (bowelInvolvementNoted) {
      surgicalRecommendations.push(
        'Colorectal surgical collaboration: Shaving vs disc excision vs segmental bowel resection indicated based on depth of muscularis invasion and distance from anal verge.',
      );
    }
    if (urinaryInvolvementNoted) {
      surgicalRecommendations.push(
        'Urological consultation: Double-J ureteric stenting and ureterolysis / partial cystectomy indicated for ureteric / bladder DIE.',
      );
    }
  } else if (stage === 'stage_3_moderate' || stage === 'stage_4_severe') {
    surgicalRecommendations.push(
      'Laparoscopic cystectomy with stripping of endometrioma pseudocapsule and meticulous preservation of ovarian cortex / follicular reserve.',
    );
  } else {
    surgicalRecommendations.push(
      'Conservative surgical ablation / excision of superficial peritoneal implants with adhesiolysis.',
    );
  }

  // Medical therapy
  medicalTherapyRecommendations.push(
    'First-line progestin: Dienogest 2 mg PO daily continuously to suppress ovulation and induce decidualization of endometriotic tissue.',
  );
  if (painSeverityTier === 'severe' || stage === 'stage_4_severe') {
    medicalTherapyRecommendations.push(
      'GnRH agonist/antagonist with low-dose add-back therapy (e.g. Leuprolide 3.75 mg monthly + Tibolone/Norethindrone) for 6 months.',
    );
  }
  medicalTherapyRecommendations.push(
    'Levonorgestrel intrauterine system (LNG-IUS 52 mg) provides effective long-term secondary prevention of recurrent dysmenorrhea.',
  );

  return {
    rasrmTotalScore: totalScore,
    rasrmStage: stage,
    rasrmStageLabel,
    enzianCompositeCode,
    painSeverityTier,
    painSummary,
    deepInfiltratingEndometriosisPresent,
    bowelInvolvementNoted,
    urinaryInvolvementNoted,
    surgicalRecommendations,
    medicalTherapyRecommendations,
  };
}
