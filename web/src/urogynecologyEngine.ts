/**
 * Urogynecology & Pelvic Floor Dysfunction / POP-Q Calculation Engine
 *
 * References:
 * - Bump RC et al. The standardization of terminology of female pelvic organ prolapse and pelvic floor dysfunction. Am J Obstet Gynecol 1996.
 * - International Urogynecological Association (IUGA) / International Continence Society (ICS) Joint Report.
 * - ACOG Practice Bulletin No. 214: Pelvic Organ Prolapse.
 */

export type PopqStage = 'stage_0' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4';
export type LeadingCompartment =
  | 'anterior_cystocele'
  | 'apical_uterine_vault'
  | 'posterior_rectocele'
  | 'multicompartment'
  | 'none';

export interface PopqGridInput {
  aa: number; // -3 to +3
  ba: number; // -3 to +tvl
  c: number;  // -tvl to +tvl
  gh: number; // genital hiatus > 0
  pb: number; // perineal body > 0
  tvl: number; // total vaginal length > 0
  ap: number; // -3 to +3
  bp: number; // -3 to +tvl
  d?: number | null; // posterior fornix (omit in post-hysterectomy)
}

export interface PopqCalculationResult {
  stage: PopqStage;
  stageLabel: string;
  leadingEdgeDistanceCm: number;
  leadingCompartment: LeadingCompartment;
  compartmentSummary: string;
  pessaryRecommendation: string;
  surgicalConsiderations: string[];
}

export function calculatePopqStage(grid: PopqGridInput): PopqCalculationResult {
  const { aa, ba, c, ap, bp, tvl } = grid;
  const d = grid.d ?? c; // if post-hysterectomy, use C

  // Points to evaluate leading edge
  const anteriorMax = Math.max(aa, ba);
  const apicalMax = Math.max(c, d);
  const posteriorMax = Math.max(ap, bp);
  const leadingEdgeDistanceCm = Math.max(anteriorMax, apicalMax, posteriorMax);

  // Determine leading compartment
  let leadingCompartment: LeadingCompartment = 'none';
  if (leadingEdgeDistanceCm > -3) {
    const isAnt = anteriorMax === leadingEdgeDistanceCm;
    const isApi = apicalMax === leadingEdgeDistanceCm;
    const isPost = posteriorMax === leadingEdgeDistanceCm;

    const count = (isAnt ? 1 : 0) + (isApi ? 1 : 0) + (isPost ? 1 : 0);
    if (count > 1) {
      leadingCompartment = 'multicompartment';
    } else if (isAnt) {
      leadingCompartment = 'anterior_cystocele';
    } else if (isApi) {
      leadingCompartment = 'apical_uterine_vault';
    } else if (isPost) {
      leadingCompartment = 'posterior_rectocele';
    }
  }

  // Stage 0: Aa=-3, Ba=-3, Ap=-3, Bp=-3 and C or D <= -(tvl - 2)
  const isStage0 =
    aa === -3 &&
    ba === -3 &&
    ap === -3 &&
    bp === -3 &&
    c <= -(tvl - 2) &&
    d <= -(tvl - 2);

  let stage: PopqStage = 'stage_1';
  let stageLabel = 'Stage I (Leading edge > 1 cm above hymen)';

  if (isStage0) {
    stage = 'stage_0';
    stageLabel = 'Stage 0 (No prolapse: all points at baseline normal positions)';
    leadingCompartment = 'none';
  } else if (leadingEdgeDistanceCm >= tvl - 2) {
    stage = 'stage_4';
    stageLabel = `Stage IV (Complete eversion / procidentia: leading edge >= +${tvl - 2} cm)`;
  } else if (leadingEdgeDistanceCm > 1) {
    stage = 'stage_3';
    stageLabel = 'Stage III (Marked prolapse: leading edge > +1 cm outside hymen)';
  } else if (leadingEdgeDistanceCm >= -1 && leadingEdgeDistanceCm <= 1) {
    stage = 'stage_2';
    stageLabel = 'Stage II (Leading edge within -1 cm to +1 cm relative to hymenal ring)';
  } else {
    stage = 'stage_1';
    stageLabel = 'Stage I (Leading edge > 1 cm above hymen / < -1 cm)';
  }

  let compartmentSummary = '';
  switch (leadingCompartment) {
    case 'anterior_cystocele':
      compartmentSummary = `Predominant Anterior Compartment Prolapse (Cystocele, Ba = ${ba >= 0 ? `+${ba}` : ba} cm).`;
      break;
    case 'apical_uterine_vault':
      compartmentSummary = `Predominant Apical Compartment Prolapse (Uterocervical / Vault Descent, C = ${c >= 0 ? `+${c}` : c} cm).`;
      break;
    case 'posterior_rectocele':
      compartmentSummary = `Predominant Posterior Compartment Prolapse (Rectocele / Enterocele, Bp = ${bp >= 0 ? `+${bp}` : bp} cm).`;
      break;
    case 'multicompartment':
      compartmentSummary = `Multicompartment Pelvic Floor Prolapse (Concomitant Anterior, Apical, and/or Posterior Descent).`;
      break;
    default:
      compartmentSummary = 'Normal pelvic organ support without clinically significant prolapse.';
  }

  // Pessary & Surgical planning
  let pessaryRecommendation = '';
  const surgicalConsiderations: string[] = [];

  if (stage === 'stage_0' || stage === 'stage_1') {
    pessaryRecommendation = 'Pelvic floor muscle training (PFMT / Kegel exercises) with biofeedback. Pessary not routinely indicated.';
    surgicalConsiderations.push('Conservative management indicated; surgery not recommended for asymptomatic Stage 0/I.');
  } else if (stage === 'stage_2') {
    pessaryRecommendation = 'First-line support pessary (e.g. Ring with support size 2–4 or Shaatz pessary). Trial of conservative fit.';
    surgicalConsiderations.push(
      'Surgical reconstruction if conservative therapy fails or symptomatic: Site-specific anterior/posterior repair or sacrospinous fixation.',
    );
  } else {
    // Stage 3 or 4
    pessaryRecommendation =
      'Space-occupying pessary indicated (e.g. Gellhorn pessary size 2.5–3.0 inches or Cube pessary) if surgery is declined or medically contraindicated.';
    if (leadingCompartment === 'apical_uterine_vault' || leadingCompartment === 'multicompartment') {
      surgicalConsiderations.push(
        'Apical suspension: Laparoscopic Sacrocolpopexy (gold standard for vault prolapse) or Vaginal Sacrospinous / Uterosacral Ligament Fixation.',
      );
    }
    if (leadingCompartment === 'anterior_cystocele' || leadingCompartment === 'multicompartment') {
      surgicalConsiderations.push(
        'Native-tissue anterior colporrhaphy with midline fascial plication.',
      );
    }
    if (leadingCompartment === 'posterior_rectocele' || leadingCompartment === 'multicompartment') {
      surgicalConsiderations.push(
        'Posterior colporrhaphy with perineorrhaphy for deficient perineal body.',
      );
    }
  }

  return {
    stage,
    stageLabel,
    leadingEdgeDistanceCm,
    leadingCompartment,
    compartmentSummary,
    pessaryRecommendation,
    surgicalConsiderations,
  };
}
