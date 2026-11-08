// Pure TypeScript calculation engine for Neonatal Spontaneous Intestinal Perforation (SIP) & Primary Peritoneal Drainage Protocol
// Guidelines: AAP Section on Surgery / APSA (American Pediatric Surgical Association) / VON Guidelines

export type SipDrainType =
  | 'penrose_drain'
  | 'chest_tube_10fr'
  | 'pigtail_catheter'
  | 'none_laparotomy_primary';

export type SipSurgicalApproach =
  | 'bedside_primary_peritoneal_drainage'
  | 'urgent_exploratory_laparotomy'
  | 'delayed_laparotomy_post_drain_failure';

export interface NeonatalSipParams {
  ageDays: number;
  birthWeightGrams: number;
  gestationalAgeWeeks: number;
  antenatalOrEarlySteroidsExposed: boolean;
  indomethacinOrIbuprofenPdaExposed: boolean;
  pneumoperitoneumConfirmed: boolean;
  pneumatosisIntestinalisAbsent: boolean;
  portalVenousGasAbsent: boolean;
  abdominalWallBluishDiscoloration: boolean;
  peritonealDrainagePerformed: boolean;
  drainType: SipDrainType;
  peritonealFluidYeastCandidaPositive: boolean;
  surgicalApproach: SipSurgicalApproach;
  status?: string;
}

export interface NeonatalSipResult {
  isIsolatedSipProfile: boolean;
  sipConfidenceCategory: 'definitive_isolated_sip' | 'possible_sip_nec_differential' | 'atypical_perforation';
  sipConfidenceLabel: string;
  isElbwExtremelyLowBirthWeight: boolean;
  hasSteroidNsaidSynergyRisk: boolean;
  drainageTechniqueDirectives: string[];
  antimicrobialDirectives: string[];
  laparotomyConversionCriteria: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_pneumoperitoneum_decompression' | 'active_peritoneal_drain_monitoring' | 'convalescent_weaning';
  urgencyTierLabel: string;
}

export type NeonatalSipEvaluationResult = NeonatalSipResult;

export function evaluateNeonatalSip(params: NeonatalSipParams): NeonatalSipResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const drainageTechniqueDirectives: string[] = [];
  const antimicrobialDirectives: string[] = [];
  const laparotomyConversionCriteria: string[] = [];

  // 1. ELBW & Gestational Vulnerability
  const isElbwExtremelyLowBirthWeight = params.birthWeightGrams < 1000;
  if (isElbwExtremelyLowBirthWeight) {
    alerts.push(`EXTREMELY LOW BIRTH WEIGHT (ELBW ${params.birthWeightGrams}g, ${params.gestationalAgeWeeks} wks): High surgical and anesthetic mortality. Bedside Primary Peritoneal Drainage (PPD) preferred over open laparotomy if unstable.`);
  }

  // 2. Medication Synergy Risk (Early Dexamethasone + Indomethacin/Ibuprofen)
  const hasSteroidNsaidSynergyRisk = params.antenatalOrEarlySteroidsExposed && params.indomethacinOrIbuprofenPdaExposed;
  if (hasSteroidNsaidSynergyRisk) {
    alerts.push('HIGH MEDICATION SYNERGY HAZARD: Concomitant postnatal corticosteroid and NSAID (Indomethacin/Ibuprofen) exposure confers a > 4-fold relative risk of focal antimesenteric terminal ileal perforation.');
  }

  // 3. SIP vs. NEC Diagnostic Confidence Stratification
  const isIsolatedSipProfile =
    params.pneumoperitoneumConfirmed &&
    params.pneumatosisIntestinalisAbsent &&
    params.portalVenousGasAbsent;

  let sipConfidenceCategory: 'definitive_isolated_sip' | 'possible_sip_nec_differential' | 'atypical_perforation' =
    'atypical_perforation';
  let sipConfidenceLabel = 'Atypical Perforation Profile';

  if (isIsolatedSipProfile) {
    sipConfidenceCategory = 'definitive_isolated_sip';
    sipConfidenceLabel = 'Definitive Isolated SIP (Pneumoperitoneum Without Pneumatosis)';
    recommendations.push('Isolated Spontaneous Intestinal Perforation (SIP): Focal terminal ileal perforation without generalized mucosal ischemic necrosis. Better long-term bowel preservation than surgical NEC.');
  } else if (params.pneumoperitoneumConfirmed) {
    sipConfidenceCategory = 'possible_sip_nec_differential';
    sipConfidenceLabel = 'Possible SIP vs. Perforated NEC Differential';
    recommendations.push('Pneumoperitoneum confirmed with possible overlapping NEC features. Evaluate platelet count, systemic acidosis, and serial radiographs.');
  }

  // 4. Clinical Exam Clues
  if (params.abdominalWallBluishDiscoloration) {
    alerts.push('BLUISH ABDOMINAL WALL / SCROTAL SIGN: Extravasation of meconium, blood, or bile through a patent processus vaginalis or thin ELBW abdominal wall signals free intra-abdominal fluid.');
  }

  // 5. Drainage Technique & Procedural Directives
  if (params.surgicalApproach === 'bedside_primary_peritoneal_drainage' || params.peritonealDrainagePerformed) {
    drainageTechniqueDirectives.push('Bedside Primary Peritoneal Drainage (PPD): Perform under local 1% lidocaine anesthesia (max 3 mg/kg) in the Right Lower Quadrant (RLQ), 2 cm lateral to midline and below the umbilicus.');
    drainageTechniqueDirectives.push('Penrose or 10–12 Fr chest tube drainage: Direct catheter tip gently into the pelvis to drain accumulated gas, meconium, and purulent ascites.');
    drainageTechniqueDirectives.push('Avoid vigorous suction or mechanical manipulation of fragile ELBW bowel loops to prevent secondary iatrogenic enterotomy.');
    drainageTechniqueDirectives.push('Affix drain securely to skin and connect to sterile gravity collection bag on dependent drainage.');
  } else {
    drainageTechniqueDirectives.push('Urgent exploratory laparotomy: Perform transverse right supraumbilical laparotomy; inspect terminal ileum antimesenteric border for focal perforation.');
    drainageTechniqueDirectives.push('Primary resection with exteriorization (Bishop-Koop or Mikulicz enterostomy) vs. primary enterotomy closure if defect is clean and small.');
  }

  // 6. Criteria for Drain Failure / Conversion to Laparotomy
  laparotomyConversionCriteria.push('Failure to improve within 24–48 hours post-peritoneal drain insertion (rising inotropic requirements, persistent oliguria, worsening metabolic acidosis).');
  laparotomyConversionCriteria.push('Progressive abdominal wall erythema, induration, or frank peritonitis suggesting ongoing uncontained fecal contamination.');
  laparotomyConversionCriteria.push('Development of secondary intestinal obstruction or persistent high bilious drain output (> 20 mL/kg/day) beyond 7 days.');
  laparotomyConversionCriteria.push('Suspected pan-necrosis or missed mechanical bowel volvulus.');

  // 7. Antimicrobial & Antifungal Directives
  if (params.peritonealFluidYeastCandidaPositive) {
    alerts.push('FUNGAL PERITONITIS DETECTED: Candida species identified in peritoneal aspirate. Initiate Fluconazole (12 mg/kg loading, then 6 mg/kg/day) or Liposomal Amphotericin B (3–5 mg/kg/day) immediately.');
    antimicrobialDirectives.push('Systemic antifungal therapy mandatory for minimum 14–21 days; remove central venous line if blood cultures are positive for Candida.');
  } else {
    antimicrobialDirectives.push('Send peritoneal fluid for urgent Gram stain, bacterial culture, and fungal culture.');
  }

  antimicrobialDirectives.push('Empirical broad-spectrum triple coverage: Ampicillin (100 mg/kg/day) + Gentamicin (4–5 mg/kg every 24–36h) + Metronidazole (15 mg/kg loading, then 7.5 mg/kg q12h).');
  antimicrobialDirectives.push('Maintain strict NPO, gastric sump decompression with Replogle 10 Fr, and Total Parenteral Nutrition (TPN) with amino acids.');

  // 8. Urgency Tier
  let urgencyTier: 'emergency_pneumoperitoneum_decompression' | 'active_peritoneal_drain_monitoring' | 'convalescent_weaning' =
    'active_peritoneal_drain_monitoring';
  let urgencyTierLabel = 'Active Peritoneal Drain & Systemic Stabilization';

  if (!params.peritonealDrainagePerformed && params.pneumoperitoneumConfirmed && params.surgicalApproach !== 'urgent_exploratory_laparotomy') {
    urgencyTier = 'emergency_pneumoperitoneum_decompression';
    urgencyTierLabel = 'EMERGENCY: Immediate Peritoneal Decompression Required';
  } else if (params.status === 'drain_weaning_resolution' || params.status === 'convalescent_enteral_feeding') {
    urgencyTier = 'convalescent_weaning';
    urgencyTierLabel = 'Convalescent Recovery & Enteral Reintroduction';
  }

  return {
    isIsolatedSipProfile,
    sipConfidenceCategory,
    sipConfidenceLabel,
    isElbwExtremelyLowBirthWeight,
    hasSteroidNsaidSynergyRisk,
    drainageTechniqueDirectives,
    antimicrobialDirectives,
    laparotomyConversionCriteria,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
