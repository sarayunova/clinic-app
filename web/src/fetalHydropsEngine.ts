/**
 * Pure calculation engine for Non-Immune Fetal Hydrops (NIHF) & Maternal Mirror Syndrome Protocol
 * References: Society for Maternal-Fetal Medicine (SMFM) Consult Series #37 / RCOG / ISUOG
 */

export type SuspectedHydropsEtiology =
  | 'cardiovascular_structural_or_arrhythmia'
  | 'fetal_anemia_parvovirus_or_hemoglobinopathy'
  | 'chromosomal_genetic_aneuploidy'
  | 'thoracic_lymphatic_cpam_chylothorax'
  | 'twin_transfusion_ttts_or_taps'
  | 'inborn_errors_metabolism_lysosomal'
  | 'idiopathic_unexplained';

export type InUteroInterventionPlanned =
  | 'intrauterine_blood_transfusion_iut'
  | 'fetal_thoracocentesis_or_pigtail_shunt'
  | 'antiarrhythmic_transplacental_therapy'
  | 'amnioreduction_serial'
  | 'conservative_surveillance'
  | 'emergent_delivery_indicated';

export type FetalHydropsStatus =
  | 'diagnostic_workup'
  | 'in_utero_intervention_active'
  | 'mirror_syndrome_monitoring'
  | 'fetal_hydrops_resolving'
  | 'preterm_emergency_delivery'
  | 'intrauterine_fetal_demise'
  | 'resolved_neonatal_transition';

export interface FetalHydropsParams {
  gestationalAgeWeeks: number;
  ascitesPresent: boolean;
  pleuralEffusionPresent: boolean;
  pericardialEffusionPresent: boolean;
  skinEdemaPresent: boolean;
  placentalEdemaPresent: boolean;
  polyhydramniosPresent: boolean;
  mcaPsvMom: number;
  suspectedEtiologyCategory: SuspectedHydropsEtiology;
  fetalArrhythmiaDetected: boolean;
  maternalMirrorSyndromeSuspected: boolean;
  maternalSystolicBpMmhg: number;
  maternalDiastolicBpMmhg: number;
  maternalProteinuriaGrade: string;
  maternalGeneralizedAnasarca: boolean;
  inUteroInterventionPlanned: InUteroInterventionPlanned;
  status?: string;
}

export interface FetalHydropsEvaluation {
  isTrueHydropsFetalis: boolean;
  isHydropsConfirmed: boolean;
  compartmentsCount: number;
  isSevereFetalAnemia: boolean;
  isMirrorSyndromeTriggered: boolean;
  etiologyClinicalDirectives: string[];
  interventionDirectives: string[];
  mirrorSyndromeDirectives: string[];
  managementDirectives: string[];
  recommendations: string[];
  alerts: string[];
  clinicalAlerts: string[];
  urgencyTier: 'emergency_maternal_fetal_crisis' | 'urgent_in_utero_intervention' | 'diagnostic_fetal_surveillance';
  urgencyTierLabel: string;
  urgencyCategory: 'emergent_intervention_or_delivery' | 'urgent_in_utero_intervention' | 'elective_diagnostic_workup';
}

export function evaluateFetalHydrops(params: FetalHydropsParams): FetalHydropsEvaluation {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const etiologyClinicalDirectives: string[] = [];
  const interventionDirectives: string[] = [];
  const mirrorSyndromeDirectives: string[] = [];

  // 1. Compartment Counting & Hydrops Definition (>= 2 fluid spaces)
  let compartmentsCount = 0;
  if (params.ascitesPresent) compartmentsCount++;
  if (params.pleuralEffusionPresent) compartmentsCount++;
  if (params.pericardialEffusionPresent) compartmentsCount++;
  if (params.skinEdemaPresent) compartmentsCount++;
  if (params.placentalEdemaPresent) compartmentsCount++;

  const isTrueHydropsFetalis = compartmentsCount >= 2;

  if (isTrueHydropsFetalis) {
    alerts.push(`NON-IMMUNE FETAL HYDROPS CONFIRMED: ${compartmentsCount} fluid compartments involved (diagnostic threshold >= 2). High perinatal mortality; comprehensive etiology workup and maternal-fetal subspecialist intervention required.`);
  } else if (compartmentsCount === 1) {
    recommendations.push('Isolated Fetal Fluid Collection: 1 compartment identified. Evaluate serial sonography q48-72h for evolution to generalized hydrops fetalis.');
  }

  // 2. Severe Fetal Anemia (MCA Doppler Peak Systolic Velocity)
  const isSevereFetalAnemia = params.mcaPsvMom >= 1.5;
  if (isSevereFetalAnemia) {
    alerts.push(`CRITICAL: SEVERE FETAL ANEMIA DETECTED: Middle Cerebral Artery (MCA) PSV is ${params.mcaPsvMom} MoM (>= 1.5 MoM threshold). Fetal hyperdynamic circulation secondary to profound anemia (Parvovirus B19, Alpha-Thalassemia Bart's, or Fetomaternal Hemorrhage). Emergent Intrauterine Blood Transfusion (IUT) indicated!`);
  }

  // 3. Maternal Mirror Syndrome (Ballantyne Syndrome)
  const isHypertensive = params.maternalSystolicBpMmhg >= 140 || params.maternalDiastolicBpMmhg >= 90;
  const hasProteinuria = params.maternalProteinuriaGrade !== 'nil' && params.maternalProteinuriaGrade !== 'trace';
  const isMirrorSyndromeTriggered =
    params.maternalMirrorSyndromeSuspected ||
    (params.maternalGeneralizedAnasarca && (isHypertensive || hasProteinuria));

  if (isMirrorSyndromeTriggered) {
    alerts.push(`CRITICAL MATERNAL MIRROR SYNDROME (BALLANTYNE SYNDROME): Mother is mirroring the hydropic fetus with severe generalized anasarca, hypertension (${params.maternalSystolicBpMmhg}/${params.maternalDiastolicBpMmhg} mmHg), and proteinuria (${params.maternalProteinuriaGrade}). High maternal pulmonary edema and mortality risk. Definitive resolution requires prompt fetal treatment or emergent delivery regardless of gestational age!`);
    mirrorSyndromeDirectives.push('Mirror Syndrome Vigilance: Daily maternal weights, strict fluid balance, pulmonary edema screening, and serial complete blood counts for hemodilution/thrombocytopenia.');
    mirrorSyndromeDirectives.push('Delivery Timing: If maternal cardiopulmonary status decompensates or fetal intervention fails, immediate maternal stabilization and delivery is mandated.');
  }

  // 4. Etiology-Specific Management
  switch (params.suspectedEtiologyCategory) {
    case 'cardiovascular_structural_or_arrhythmia':
      etiologyClinicalDirectives.push('Cardiovascular Etiology (~40% of NIHF): Urgent fetal echocardiography indicated to rule out Ebstein anomaly, AV canal defect, hypoplastic left heart, or cardiomyopathy.');
      if (params.fetalArrhythmiaDetected) {
        etiologyClinicalDirectives.push('Fetal Arrhythmia: Supraventricular tachycardia (SVT) or atrial flutter identified. Initiate transplacental antiarrhythmic therapy: Digoxin first-line, with Sotalol or Flecainide escalation under maternal telemetry.');
      }
      break;

    case 'fetal_anemia_parvovirus_or_hemoglobinopathy':
      etiologyClinicalDirectives.push('Fetal Anemia Workup: Order maternal Parvovirus B19 IgM/IgG and PCR, Kleihauer-Betke test or flow cytometry for fetomaternal hemorrhage, and parental hemoglobin electrophoresis (Alpha-Thalassemia Bart hemoglobinopathy).');
      if (isSevereFetalAnemia) {
        interventionDirectives.push('Intrauterine Transfusion (IUT): Coordinate emergent umbilical vein cordocentesis and transfusion of CMV-negative, irradiated, leukoreduced O-negative packed RBCs with Hct ~75–80%.');
      }
      break;

    case 'thoracic_lymphatic_cpam_chylothorax':
      etiologyClinicalDirectives.push('Thoracic / Lymphatic Lesion: Congenital pulmonary airway malformation (CPAM) or primary fetal chylothorax causing mediastinal compression and impaired venous return.');
      if (params.pleuralEffusionPresent) {
        interventionDirectives.push('Fetal Thoracocentesis & Shunt: Perform diagnostic and therapeutic fetal thoracocentesis (test pleural fluid for lymphocytes > 80%). If effusion re-accumulates rapidly, place double-pigtail thoracoamniotic shunt.');
      }
      break;

    case 'chromosomal_genetic_aneuploidy':
      etiologyClinicalDirectives.push('Genetic / Chromosomal (~10%): Perform urgent amniocentesis for chromosomal microarray analysis (CMA) and Noonan syndrome gene panel (PTPN11, SOS1). Screen for Turner syndrome (45,X) and Trisomy 21.');
      break;

    case 'twin_transfusion_ttts_or_taps':
      etiologyClinicalDirectives.push('Monochorionic Twin Complication: TTTS Quintero Stage IV or TAPS. Urgent referral to fetal surgery center for fetoscopic laser photocoagulation of communicating placental anastomoses.');
      break;

    case 'inborn_errors_metabolism_lysosomal':
      etiologyClinicalDirectives.push('Metabolic / Inborn Errors of Metabolism: Consider lysosomal storage disorders (Gaucher, GM1 gangliosidosis, Mucopolysaccharidosis VII). Send amniotic fluid biochemical analysis.');
      break;

    default:
      etiologyClinicalDirectives.push('Idiopathic NIHF: Complete standard SMFM diagnostic cascade including fetal infection panel, TORCH, CMA, fetal echo, and maternal antibody screening.');
      break;
  }

  // 5. Urgency Tier
  let urgencyTier: 'emergency_maternal_fetal_crisis' | 'urgent_in_utero_intervention' | 'diagnostic_fetal_surveillance' =
    'diagnostic_fetal_surveillance';
  let urgencyTierLabel = 'Diagnostic Surveillance & Fetal Etiology Workup';

  if (isMirrorSyndromeTriggered || (isTrueHydropsFetalis && (isSevereFetalAnemia || params.fetalArrhythmiaDetected))) {
    urgencyTier = 'emergency_maternal_fetal_crisis';
    urgencyTierLabel = 'EMERGENCY: Maternal-Fetal Crisis / Imminent Delivery or IUT';
  } else if (isTrueHydropsFetalis || params.inUteroInterventionPlanned !== 'conservative_surveillance') {
    urgencyTier = 'urgent_in_utero_intervention';
    urgencyTierLabel = 'Urgent In-Utero Intervention & MFM Subspecialty Transfer';
  }

  const urgencyCategory: 'emergent_intervention_or_delivery' | 'urgent_in_utero_intervention' | 'elective_diagnostic_workup' =
    urgencyTier === 'emergency_maternal_fetal_crisis'
      ? 'emergent_intervention_or_delivery'
      : urgencyTier === 'urgent_in_utero_intervention'
      ? 'urgent_in_utero_intervention'
      : 'elective_diagnostic_workup';

  const managementDirectives = [
    ...interventionDirectives,
    ...etiologyClinicalDirectives,
    ...mirrorSyndromeDirectives,
    ...recommendations,
  ];

  return {
    isTrueHydropsFetalis,
    isHydropsConfirmed: isTrueHydropsFetalis,
    compartmentsCount,
    isSevereFetalAnemia,
    isMirrorSyndromeTriggered,
    etiologyClinicalDirectives,
    interventionDirectives,
    mirrorSyndromeDirectives,
    managementDirectives,
    recommendations,
    alerts,
    clinicalAlerts: alerts,
    urgencyTier,
    urgencyTierLabel,
    urgencyCategory,
  };
}
