/**
 * WHO Partograph & Intrapartum Labor Progress Monitor Logic
 * Implements clinical Alert & Action line calculations, fetal-maternal distress alerts,
 * and standard WHO labor care guide standards.
 */

export type LiquorState = 'I' | 'C' | 'M' | 'A' | 'B';
export type MoldingDegree = '0' | '+' | '++' | '+++';
export type StationDescent = '5/5' | '4/5' | '3/5' | '2/5' | '1/5' | '0/5';
export type ContractionIntensity = 'mild' | 'moderate' | 'strong';
export type LaborOutcome =
  | 'normal_vaginal'
  | 'assisted_vacuum'
  | 'assisted_forceps'
  | 'emergency_lscs'
  | 'elective_lscs'
  | 'transferred';
export type PartographStatus = 'active' | 'completed' | 'discontinued';

export interface PartographEntry {
  id: number;
  partographId: number;
  recordedAt: string;
  hoursFromStart: number;
  fetalHeartRate?: number | null;
  liquor?: LiquorState | null;
  molding?: MoldingDegree | null;
  cervicalDilatationCm?: number | null;
  stationDescent?: StationDescent | null;
  contractionsCount?: number | null;
  contractionsIntensity?: ContractionIntensity | null;
  contractionsDurationSec?: number | null;
  oxytocinUPerL?: number | null;
  oxytocinDropsPerMin?: number | null;
  drugsGiven?: string | null;
  ivFluids?: string | null;
  maternalPulseBpm?: number | null;
  maternalSystolicMmhg?: number | null;
  maternalDiastolicMmhg?: number | null;
  maternalTemperatureC?: number | null;
  urineProtein?: string | null;
  urineKetones?: string | null;
  urineVolumeMl?: number | null;
  clinicalNotes?: string | null;
  recordedByName?: string | null;
  createdAt: string;
}

export interface Partograph {
  id: number;
  partographNumber: string;
  patientId: number;
  admissionId?: number | null;
  admissionNumber?: string | null;
  bedLabel?: string | null;
  startTime: string;
  status: PartographStatus;
  parity?: string | null;
  gestationalAgeWeeks?: number | null;
  ruptureOfMembranesTime?: string | null;
  fetalPosition?: string | null;
  alertLineStartHours: number;
  alertLineStartCm: number;
  outcome?: LaborOutcome | null;
  outcomeNotes?: string | null;
  deliveryTime?: string | null;
  babyGender?: 'male' | 'female' | 'ambiguous' | null;
  babyWeightGrams?: number | null;
  apgar1min?: number | null;
  apgar5min?: number | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  patientNumber?: string;
  patientName?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
  lastMenstrualPeriod?: string | null;
  gravida?: number | null;
  entries: PartographEntry[];
}

export interface LaborAlert {
  kind: 'alert_line_crossed' | 'action_line_reached' | 'fetal_distress' | 'maternal_warning' | 'contraction_warning';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  hours?: number;
}

export const LIQUOR_LABELS: Record<LiquorState, string> = {
  I: 'Intact Membranes (I)',
  C: 'Clear Liquor (C)',
  M: 'Meconium-Stained Liquor (M)',
  A: 'Absent / Dry (A)',
  B: 'Blood-Stained Liquor (B)',
};

export const MOLDING_LABELS: Record<MoldingDegree, string> = {
  '0': '0 · Sutures easily felt (Normal)',
  '+': '+ · Bones touching (Mild)',
  '++': '++ · Bones overlapping, reducible (Moderate)',
  '+++': '+++ · Severe non-reducible overlapping (Severe / CPD risk)',
};

export const STATION_DESCENT_LEVELS: StationDescent[] = ['5/5', '4/5', '3/5', '2/5', '1/5', '0/5'];

export const OUTCOME_LABELS: Record<LaborOutcome, string> = {
  normal_vaginal: 'Normal Spontaneous Vaginal Delivery (NVD)',
  assisted_vacuum: 'Vacuum-Assisted Vaginal Delivery (Ventouse)',
  assisted_forceps: 'Forceps-Assisted Delivery',
  emergency_lscs: 'Emergency Lower Segment Cesarean Section (LSCS)',
  elective_lscs: 'Elective Lower Segment Cesarean Section',
  transferred: 'Transferred to Higher Tertiary Care Hospital',
};

/**
 * Calculates expected cervical dilatation along the WHO Alert Line at elapsed time `hours`.
 * Active phase begins at startCm (standard 4cm). Alert line progresses at 1 cm/hr.
 */
export function calculateAlertLineDilatation(hours: number, startHours = 0.0, startCm = 4.0): number {
  if (hours < startHours) return startCm;
  const val = startCm + 1.0 * (hours - startHours);
  return Math.min(10.0, Math.max(startCm, val));
}

/**
 * Calculates cervical dilatation along the WHO Action Line at elapsed time `hours`.
 * The Action line is parallel to the Alert line, shifted 4 hours to the right.
 */
export function calculateActionLineDilatation(hours: number, startHours = 0.0, startCm = 4.0): number | null {
  const actionStartHours = startHours + 4.0;
  if (hours < actionStartHours) return null;
  const val = startCm + 1.0 * (hours - actionStartHours);
  return Math.min(10.0, Math.max(startCm, val));
}

/**
 * Checks if a dilatation measurement has crossed to the right of the Alert Line.
 */
export function isAlertLineCrossed(hours: number, dilatationCm: number, startHours = 0.0, startCm = 4.0): boolean {
  if (hours <= startHours) return false;
  const expectedAlert = calculateAlertLineDilatation(hours, startHours, startCm);
  // If actual dilatation is less than Alert Line value, it has plotted to the right of the alert line.
  return dilatationCm < expectedAlert;
}

/**
 * Checks if a dilatation measurement has reached or crossed the Action Line.
 */
export function isActionLineReached(hours: number, dilatationCm: number, startHours = 0.0, startCm = 4.0): boolean {
  const actionExpected = calculateActionLineDilatation(hours, startHours, startCm);
  if (actionExpected == null) return false;
  // If actual dilatation is less than or equal to action line value, it has reached/crossed the action line.
  return dilatationCm <= actionExpected;
}

/**
 * Converts fifths of head palpable (5/5 to 0/5) to numeric value (5 down to 0) for plotting.
 */
export function stationToNumeric(station?: StationDescent | null): number | null {
  if (!station) return null;
  switch (station) {
    case '5/5': return 5;
    case '4/5': return 4;
    case '3/5': return 3;
    case '2/5': return 2;
    case '1/5': return 1;
    case '0/5': return 0;
    default: return null;
  }
}

/**
 * Comprehensive clinical alert evaluator for intrapartum labor monitoring.
 */
export function evaluateLaborAlerts(
  entries: PartographEntry[],
  partograph?: { alertLineStartHours?: number; alertLineStartCm?: number; status?: string }
): LaborAlert[] {
  const alerts: LaborAlert[] = [];
  if (!entries || entries.length === 0) return alerts;

  const startHours = partograph?.alertLineStartHours ?? 0.0;
  const startCm = partograph?.alertLineStartCm ?? 4.0;

  let hasActionCrossed = false;
  let hasAlertCrossed = false;

  for (const entry of entries) {
    const h = entry.hoursFromStart;

    // 1. Progress: Dilatation vs Alert & Action Lines
    if (entry.cervicalDilatationCm != null) {
      const d = entry.cervicalDilatationCm;
      if (isActionLineReached(h, d, startHours, startCm)) {
        hasActionCrossed = true;
        alerts.push({
          kind: 'action_line_reached',
          severity: 'critical',
          title: '🚨 Action Line Reached / Crossed',
          message: `At T+${h}h, cervical dilatation (${d} cm) reached the 4-hour Action Line. Immediate obstetric decision required (evaluate for failed labor progress, augmented labor failure, or emergency LSCS).`,
          hours: h,
        });
      } else if (isAlertLineCrossed(h, d, startHours, startCm)) {
        hasAlertCrossed = true;
        alerts.push({
          kind: 'alert_line_crossed',
          severity: 'warning',
          title: '⚠️ Dilatation Lagging (Alert Line Crossed)',
          message: `At T+${h}h, cervical dilatation (${d} cm) plotted to the right of the Alert Line (< 1 cm/hr progress). Assess for CPD, malposition, or inefficient uterine activity.`,
          hours: h,
        });
      }
    }

    // 2. Fetal Heart Rate (FHR)
    if (entry.fetalHeartRate != null) {
      const fhr = entry.fetalHeartRate;
      if (fhr < 100) {
        alerts.push({
          kind: 'fetal_distress',
          severity: 'critical',
          title: '🚨 Severe Fetal Bradycardia',
          message: `Fetal Heart Rate is ${fhr} bpm (< 100 bpm) at T+${h}h. Critical fetal compromise risk: administer maternal O2, check cord prolapse, position left lateral, and prepare for urgent delivery.`,
          hours: h,
        });
      } else if (fhr < 110) {
        alerts.push({
          kind: 'fetal_distress',
          severity: 'warning',
          title: '⚠️ Fetal Bradycardia',
          message: `Fetal Heart Rate is ${fhr} bpm (< 110 bpm) at T+${h}h. Continuously monitor FHR and maternal vitals.`,
          hours: h,
        });
      } else if (fhr > 160) {
        alerts.push({
          kind: 'fetal_distress',
          severity: 'warning',
          title: '⚠️ Fetal Tachycardia',
          message: `Fetal Heart Rate is ${fhr} bpm (> 160 bpm) at T+${h}h. Check maternal temperature, hydration, and intra-amniotic infection.`,
          hours: h,
        });
      }
    }

    // 3. Liquor & Molding
    if (entry.liquor === 'M') {
      alerts.push({
        kind: 'fetal_distress',
        severity: entry.fetalHeartRate && (entry.fetalHeartRate < 110 || entry.fetalHeartRate > 160) ? 'critical' : 'warning',
        title: '⚠️ Meconium-Stained Liquor',
        message: `Meconium-stained amniotic fluid observed at T+${h}h. Alert pediatric team for delivery and monitor for fetal distress.`,
        hours: h,
      });
    }

    if (entry.molding === '+++') {
      alerts.push({
        kind: 'alert_line_crossed',
        severity: 'critical',
        title: '🚨 Severe Fetal Skull Molding (+++)',
        message: `Severe non-reducible overlapping of cranial bones (+++) at T+${h}h. High suspicion of cephalopelvic disproportion (CPD) or obstructed labor.`,
        hours: h,
      });
    }

    // 4. Maternal Vitals
    if (entry.maternalSystolicMmhg != null && entry.maternalDiastolicMmhg != null) {
      const sys = entry.maternalSystolicMmhg;
      const dia = entry.maternalDiastolicMmhg;
      if (sys >= 160 || dia >= 110) {
        alerts.push({
          kind: 'maternal_warning',
          severity: 'critical',
          title: '🚨 Severe Maternal Hypertensive Crisis',
          message: `Maternal BP is ${sys}/${dia} mmHg at T+${h}h. High risk of eclampsia/stroke. Initiate immediate antihypertensive protocol (Inj. Labetalol) and MgSO4.`,
          hours: h,
        });
      } else if (sys >= 140 || dia >= 90) {
        alerts.push({
          kind: 'maternal_warning',
          severity: 'warning',
          title: '⚠️ Maternal Hypertension',
          message: `Maternal BP elevated at ${sys}/${dia} mmHg at T+${h}h. Monitor for pre-eclampsia.`,
          hours: h,
        });
      }
    }

    if (entry.maternalTemperatureC != null && entry.maternalTemperatureC >= 38.0) {
      alerts.push({
        kind: 'maternal_warning',
        severity: 'warning',
        title: '⚠️ Maternal Pyrexia / Chorioamnionitis',
        message: `Maternal temperature is ${entry.maternalTemperatureC}°C (≥ 38.0°C) at T+${h}h. Evaluate for intra-amniotic infection; initiate IV broad-spectrum antibiotics.`,
        hours: h,
      });
    }

    // 5. Contractions
    if (entry.contractionsCount != null && entry.contractionsCount > 5) {
      alerts.push({
        kind: 'contraction_warning',
        severity: 'warning',
        title: '⚠️ Uterine Tachysystole',
        message: `${entry.contractionsCount} contractions in 10 minutes at T+${h}h (> 5 per 10 mins). Reduce or pause oxytocin infusion to prevent uterine rupture and fetal asphyxia.`,
        hours: h,
      });
    }
  }

  return alerts;
}
