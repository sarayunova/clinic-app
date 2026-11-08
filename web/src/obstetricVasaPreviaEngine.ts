// Pure TypeScript calculation engine for Obstetric Vasa Previa & Fetal Exsanguination Emergency Protocol
// Guidelines: ACOG Practice Bulletin No. 204 / SMFM Consult Series #67

export type VasaPreviaType =
  | 'type_1_velamentous_cord'
  | 'type_2_succenturiate_or_bilobed_lobe'
  | 'undetermined_aberrant_vessel';

export type AptTestResult =
  | 'not_performed'
  | 'positive_fetal_hemoglobin_pink'
  | 'negative_maternal_hemoglobin_yellow_brown';

export type MembraneStatus =
  | 'intact'
  | 'ruptured_spontaneous'
  | 'artificial_rupture_contraindicated';

export type CtgPattern =
  | 'category_1_normal'
  | 'category_2_variable_decelerations'
  | 'category_3_sinusoidal_pattern'
  | 'category_3_severe_prolonged_bradycardia';

export type ElectiveDeliveryWindow =
  | '34_0_to_35_6_weeks'
  | 'emergent_crash_cesarean'
  | 'outpatient_surveillance_pre_34w';

export interface ObstetricVasaPreviaParams {
  gestationalAgeWeeks: number;
  vasaPreviaType: VasaPreviaType;
  distanceToInternalOsMm: number;
  colorDopplerConfirmed: boolean;
  cervicalLengthMm?: number;
  vaginalBleedingPresent: boolean;
  aptTestResult: AptTestResult;
  membraneStatus: MembraneStatus;
  fetalHeartRateBpm?: number;
  ctgPattern: CtgPattern;
  corticosteroidsAdministered: boolean;
  electiveDeliveryWindowWeeks: ElectiveDeliveryWindow;
}

export interface ObstetricVasaPreviaResult {
  isVasaPreviaConfirmed: boolean;
  isFetalExsanguinationEmergency: boolean;
  urgencyTier: 'crash_cesarean_emergency' | 'inpatient_rupture_precautions' | 'antenatal_surveillance_scheduled';
  urgencyTierLabel: string;
  recommendedDeliveryTiming: string;
  neonatalResuscitationPrepDirectives: string[];
  rupturePrecautionDirectives: string[];
  recommendations: string[];
  alerts: string[];
}

export type ObstetricVasaPreviaEvaluationResult = ObstetricVasaPreviaResult;

export function evaluateObstetricVasaPrevia(
  params: ObstetricVasaPreviaParams
): ObstetricVasaPreviaResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const neonatalResuscitationPrepDirectives: string[] = [];
  const rupturePrecautionDirectives: string[] = [];

  // Diagnostic threshold: aberrant fetal vessels within 20 mm (2.0 cm) of internal cervical os
  const isVasaPreviaConfirmed = params.distanceToInternalOsMm <= 20 && params.colorDopplerConfirmed;

  if (!params.colorDopplerConfirmed) {
    alerts.push(
      'DIAGNOSTIC ADVISORY: Transvaginal ultrasound with color Doppler is mandatory to verify fetal vessel pulsation across or adjacent to internal os.'
    );
  } else if (params.distanceToInternalOsMm > 20) {
    alerts.push(
      `NOTE: Fetal vessels are ${params.distanceToInternalOsMm} mm from internal os (> 20 mm threshold). Classifies as low-lying umbilical cord/placenta rather than classic vasa previa, but serial surveillance is recommended.`
    );
  }

  // Fetal exsanguination triggers:
  // 1. Vaginal bleeding with positive Apt test (fetal HbF pink)
  // 2. Ruptured membranes with bleeding or CTG Category 3
  // 3. Sinusoidal fetal heart rate pattern (severe fetal anemia)
  // 4. Prolonged severe bradycardia
  const isAptFetalBlood = params.aptTestResult === 'positive_fetal_hemoglobin_pink';
  const isSinusoidal = params.ctgPattern === 'category_3_sinusoidal_pattern';
  const isSevereBradycardia =
    params.ctgPattern === 'category_3_severe_prolonged_bradycardia' ||
    (params.fetalHeartRateBpm !== undefined && params.fetalHeartRateBpm < 100);
  const isMembraneRuptured = params.membraneStatus === 'ruptured_spontaneous';

  const isFetalExsanguinationEmergency =
    (params.vaginalBleedingPresent && isAptFetalBlood) ||
    isSinusoidal ||
    isSevereBradycardia ||
    (isMembraneRuptured && params.vaginalBleedingPresent);

  let urgencyTier: 'crash_cesarean_emergency' | 'inpatient_rupture_precautions' | 'antenatal_surveillance_scheduled' =
    'antenatal_surveillance_scheduled';
  let urgencyTierLabel = 'Antenatal Ultrasound Surveillance & Scheduled Preterm Delivery';
  let recommendedDeliveryTiming = 'Planned elective cesarean delivery at 34 0/7 to 35 6/7 weeks of gestation.';

  // Rupture precautions
  rupturePrecautionDirectives.push('STRICT CONTRAINDICATION: Digital vaginal examinations and artificial rupture of membranes (amniotomy) are ABSOLUTELY CONTRAINDICATED.');
  rupturePrecautionDirectives.push('Advise pelvic rest (abstinence from coitus, tampon use, or vaginal instrumentation).');
  rupturePrecautionDirectives.push('Instruct patient to report immediately to labor and delivery triage upon any spotting, bleeding, cramping, or fluid leakage.');

  if (params.cervicalLengthMm !== undefined && params.cervicalLengthMm < 25) {
    alerts.push(
      `SHORT CERVIX ALERT: Cervical length is ${params.cervicalLengthMm} mm (< 25 mm). Significantly heightened risk of preterm labor and membrane rupture. Recommend urgent inpatient admission.`
    );
  }

  // Antenatal corticosteroids check
  if (!params.corticosteroidsAdministered && params.gestationalAgeWeeks >= 28 && params.gestationalAgeWeeks < 37) {
    alerts.push(
      'CORTICOSTEROID DEFICIENCY: Antenatal corticosteroid course (Betamethasone 12 mg IM q24h x 2 doses) should be administered between 28-32 weeks for planned preterm delivery.'
    );
    recommendations.push('Administer maternal betamethasone course to accelerate fetal lung maturation.');
  }

  // Emergency triggers
  if (isFetalExsanguinationEmergency) {
    urgencyTier = 'crash_cesarean_emergency';
    urgencyTierLabel = 'CATEGORY 1 CRASH CESAREAN: Suspected Fetal Exsanguination';
    recommendedDeliveryTiming = 'STAT Crash Cesarean Delivery within minutes. Do not await blood tests.';

    alerts.push(
      'CRITICAL OBSTETRIC SURGICAL RED ALERT: Acute vasa previa rupture or severe fetal exsanguination suspected! Maternal vitals may remain stable while fetus exsanguinates into hemorrhagic shock.'
    );

    if (isSinusoidal) {
      alerts.push('SINUSOIDAL TRACING: CTG shows classic sinusoidal pattern indicative of profound fetal hypovolemia and impending death.');
    }
    if (isAptFetalBlood) {
      alerts.push('APT TEST POSITIVE (PINK): Vaginal blood is fetal in origin (alkali-resistant HbF). Blood loss is from fetal circulation.');
    }

    neonatalResuscitationPrepDirectives.push('Emergency Category 1 crash cesarean section without delay.');
    neonatalResuscitationPrepDirectives.push('Mobilize NICU Resuscitation Team immediately to Operating Room.');
    neonatalResuscitationPrepDirectives.push('Order emergency release uncrossmatched O-negative PRBCs (2 units) directly to OR for immediate neonatal transfusion.');
    neonatalResuscitationPrepDirectives.push('Prepare for neonatal rapid volume resuscitation: 10-20 mL/kg emergency O-negative PRBC or normal saline push.');
    neonatalResuscitationPrepDirectives.push('Immediate umbilical cord arterial and venous blood gases, hemoglobin, and hematocrit upon clamping.');
  } else if (params.gestationalAgeWeeks >= 34 || params.vaginalBleedingPresent || (params.cervicalLengthMm !== undefined && params.cervicalLengthMm < 25)) {
    urgencyTier = 'inpatient_rupture_precautions';
    urgencyTierLabel = 'Inpatient Rupture Precautions & Continuous FHR Monitoring';
    recommendedDeliveryTiming =
      params.gestationalAgeWeeks >= 34
        ? 'Schedule elective cesarean delivery prior to 36 0/7 weeks (target 34 0/7 to 35 6/7 weeks).'
        : 'Inpatient admission, bed rest, twice-daily CTG monitoring, and deliver at 34 0/7 weeks.';

    recommendations.push('Maintain inpatient admission at a tertiary center capable of immediate crash cesarean and Level III/IV neonatal ICU care.');
    recommendations.push('Continuous or serial non-stress testing (NST) / biophysical profile.');
    neonatalResuscitationPrepDirectives.push('Notify blood bank of vasa previa delivery; crossmatch maternal blood and verify uncrossmatched O-negative blood in blood bank.');
  } else {
    urgencyTier = 'antenatal_surveillance_scheduled';
    urgencyTierLabel = 'Outpatient / Stable Antenatal Surveillance';
    recommendedDeliveryTiming = 'Schedule admission at 32-34 weeks for observation; deliver via planned cesarean at 34 0/7 to 35 6/7 weeks.';
    recommendations.push('Repeat transvaginal ultrasound at 32 weeks to evaluate potential vessel migration with lower uterine segment development.');
    recommendations.push('Plan elective admission to hospital between 32 and 34 weeks of gestation.');
  }

  return {
    isVasaPreviaConfirmed,
    isFetalExsanguinationEmergency,
    urgencyTier,
    urgencyTierLabel,
    recommendedDeliveryTiming,
    neonatalResuscitationPrepDirectives,
    rupturePrecautionDirectives,
    recommendations,
    alerts,
  };
}
