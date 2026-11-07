// Pediatric Advanced Life Support (PALS), PEWS & Broselow Emergency Tape Engine
// Reference: AHA Pediatric Advanced Life Support (PALS) 2020 Guidelines,
// Monaghan Pediatric Early Warning Score (PEWS), and Broselow Pediatric Resuscitation System.

export type BroselowColor =
  | 'grey'
  | 'pink'
  | 'red'
  | 'purple'
  | 'yellow'
  | 'white'
  | 'blue'
  | 'orange'
  | 'green';

export interface BroselowZoneInfo {
  color: BroselowColor;
  label: string;
  weightRangeKg: [number, number];
  midWeightKg: number;
  lengthRangeCm: [number, number];
  hexColor: string;
  textColor: string;
  ettCuffedSize: number;
  ettUncuffedSize: number;
  ettDepthLipCm: number;
  laryngoscopeBlade: string;
  suctionCatheterFr: number;
  defibInitialJoules: number;
  defibSubsequentJoules: number;
  epinephrineIvDoseMl: number; // 1:10,000 concentration (0.1 mL/kg = 0.01 mg/kg)
  amiodaroneMg: number; // 5 mg/kg
  atropineMg: number; // 0.02 mg/kg (min 0.1 mg)
  adenosineFirstDoseMg: number; // 0.1 mg/kg
  fluidBolusMl: number; // 20 mL/kg
  dextrose10PercentMl: number; // 2 mL/kg
}

export const BROSELOW_ZONES: Record<BroselowColor, BroselowZoneInfo> = {
  grey: {
    color: 'grey',
    label: 'Grey (3 - 5 kg)',
    weightRangeKg: [3, 5],
    midWeightKg: 4,
    lengthRangeCm: [46, 60],
    hexColor: '#6B7280',
    textColor: '#FFFFFF',
    ettCuffedSize: 3.0,
    ettUncuffedSize: 3.5,
    ettDepthLipCm: 10.0,
    laryngoscopeBlade: 'Miller 0 or 1 straight',
    suctionCatheterFr: 6,
    defibInitialJoules: 8,
    defibSubsequentJoules: 16,
    epinephrineIvDoseMl: 0.4,
    amiodaroneMg: 20,
    atropineMg: 0.1,
    adenosineFirstDoseMg: 0.4,
    fluidBolusMl: 80,
    dextrose10PercentMl: 8,
  },
  pink: {
    color: 'pink',
    label: 'Pink (6 - 7 kg)',
    weightRangeKg: [6, 7],
    midWeightKg: 6.5,
    lengthRangeCm: [61, 67],
    hexColor: '#EC4899',
    textColor: '#FFFFFF',
    ettCuffedSize: 3.5,
    ettUncuffedSize: 4.0,
    ettDepthLipCm: 11.0,
    laryngoscopeBlade: 'Miller 1 straight',
    suctionCatheterFr: 8,
    defibInitialJoules: 14,
    defibSubsequentJoules: 26,
    epinephrineIvDoseMl: 0.65,
    amiodaroneMg: 32.5,
    atropineMg: 0.13,
    adenosineFirstDoseMg: 0.65,
    fluidBolusMl: 130,
    dextrose10PercentMl: 13,
  },
  red: {
    color: 'red',
    label: 'Red (8 - 9 kg)',
    weightRangeKg: [8, 9],
    midWeightKg: 8.5,
    lengthRangeCm: [68, 74],
    hexColor: '#EF4444',
    textColor: '#FFFFFF',
    ettCuffedSize: 3.5,
    ettUncuffedSize: 4.0,
    ettDepthLipCm: 11.5,
    laryngoscopeBlade: 'Miller 1 straight',
    suctionCatheterFr: 8,
    defibInitialJoules: 18,
    defibSubsequentJoules: 34,
    epinephrineIvDoseMl: 0.85,
    amiodaroneMg: 42.5,
    atropineMg: 0.17,
    adenosineFirstDoseMg: 0.85,
    fluidBolusMl: 170,
    dextrose10PercentMl: 17,
  },
  purple: {
    color: 'purple',
    label: 'Purple (10 - 11 kg)',
    weightRangeKg: [10, 11],
    midWeightKg: 10.5,
    lengthRangeCm: [75, 84],
    hexColor: '#8B5CF6',
    textColor: '#FFFFFF',
    ettCuffedSize: 4.0,
    ettUncuffedSize: 4.5,
    ettDepthLipCm: 12.5,
    laryngoscopeBlade: 'Miller 1.5 or Mac 2',
    suctionCatheterFr: 8,
    defibInitialJoules: 20,
    defibSubsequentJoules: 42,
    epinephrineIvDoseMl: 1.05,
    amiodaroneMg: 52.5,
    atropineMg: 0.21,
    adenosineFirstDoseMg: 1.05,
    fluidBolusMl: 210,
    dextrose10PercentMl: 21,
  },
  yellow: {
    color: 'yellow',
    label: 'Yellow (12 - 14 kg)',
    weightRangeKg: [12, 14],
    midWeightKg: 13.0,
    lengthRangeCm: [85, 96],
    hexColor: '#EAB308',
    textColor: '#000000',
    ettCuffedSize: 4.5,
    ettUncuffedSize: 5.0,
    ettDepthLipCm: 13.5,
    laryngoscopeBlade: 'Miller 2 or Mac 2',
    suctionCatheterFr: 10,
    defibInitialJoules: 26,
    defibSubsequentJoules: 52,
    epinephrineIvDoseMl: 1.3,
    amiodaroneMg: 65,
    atropineMg: 0.26,
    adenosineFirstDoseMg: 1.3,
    fluidBolusMl: 260,
    dextrose10PercentMl: 26,
  },
  white: {
    color: 'white',
    label: 'White (15 - 18 kg)',
    weightRangeKg: [15, 18],
    midWeightKg: 16.5,
    lengthRangeCm: [97, 109],
    hexColor: '#E2E8F0',
    textColor: '#0F172A',
    ettCuffedSize: 5.0,
    ettUncuffedSize: 5.5,
    ettDepthLipCm: 15.0,
    laryngoscopeBlade: 'Mac 2 curved',
    suctionCatheterFr: 10,
    defibInitialJoules: 34,
    defibSubsequentJoules: 66,
    epinephrineIvDoseMl: 1.65,
    amiodaroneMg: 82.5,
    atropineMg: 0.33,
    adenosineFirstDoseMg: 1.65,
    fluidBolusMl: 330,
    dextrose10PercentMl: 33,
  },
  blue: {
    color: 'blue',
    label: 'Blue (19 - 23 kg)',
    weightRangeKg: [19, 23],
    midWeightKg: 21.0,
    lengthRangeCm: [110, 121],
    hexColor: '#3B82F6',
    textColor: '#FFFFFF',
    ettCuffedSize: 5.5,
    ettUncuffedSize: 6.0,
    ettDepthLipCm: 16.5,
    laryngoscopeBlade: 'Mac 2 or 3',
    suctionCatheterFr: 10,
    defibInitialJoules: 42,
    defibSubsequentJoules: 84,
    epinephrineIvDoseMl: 2.1,
    amiodaroneMg: 105,
    atropineMg: 0.42,
    adenosineFirstDoseMg: 2.1,
    fluidBolusMl: 420,
    dextrose10PercentMl: 42,
  },
  orange: {
    color: 'orange',
    label: 'Orange (24 - 29 kg)',
    weightRangeKg: [24, 29],
    midWeightKg: 26.5,
    lengthRangeCm: [122, 132],
    hexColor: '#F97316',
    textColor: '#FFFFFF',
    ettCuffedSize: 6.0,
    ettUncuffedSize: 6.5,
    ettDepthLipCm: 18.0,
    laryngoscopeBlade: 'Mac 3 curved',
    suctionCatheterFr: 12,
    defibInitialJoules: 54,
    defibSubsequentJoules: 106,
    epinephrineIvDoseMl: 2.65,
    amiodaroneMg: 132.5,
    atropineMg: 0.5,
    adenosineFirstDoseMg: 2.65,
    fluidBolusMl: 530,
    dextrose10PercentMl: 53,
  },
  green: {
    color: 'green',
    label: 'Green (30 - 36 kg)',
    weightRangeKg: [30, 36],
    midWeightKg: 33.0,
    lengthRangeCm: [133, 144],
    hexColor: '#10B981',
    textColor: '#FFFFFF',
    ettCuffedSize: 6.5,
    ettUncuffedSize: 7.0,
    ettDepthLipCm: 19.5,
    laryngoscopeBlade: 'Mac 3 curved',
    suctionCatheterFr: 12,
    defibInitialJoules: 66,
    defibSubsequentJoules: 132,
    epinephrineIvDoseMl: 3.3,
    amiodaroneMg: 165,
    atropineMg: 0.5,
    adenosineFirstDoseMg: 3.3,
    fluidBolusMl: 660,
    dextrose10PercentMl: 66,
  },
};

/**
 * Determine Broselow Zone from Length in cm or Weight in kg
 */
export function lookupBroselowZone(params: {
  lengthCm?: number;
  weightKg?: number;
}): BroselowZoneInfo {
  const { lengthCm, weightKg } = params;

  if (lengthCm !== undefined && lengthCm > 0) {
    for (const zone of Object.values(BROSELOW_ZONES)) {
      if (lengthCm >= zone.lengthRangeCm[0] && lengthCm <= zone.lengthRangeCm[1]) {
        return zone;
      }
    }
    if (lengthCm < 46) return BROSELOW_ZONES.grey;
    if (lengthCm > 144) return BROSELOW_ZONES.green;
  }

  if (weightKg !== undefined && weightKg > 0) {
    for (const zone of Object.values(BROSELOW_ZONES)) {
      if (weightKg >= zone.weightRangeKg[0] && weightKg <= zone.weightRangeKg[1]) {
        return zone;
      }
    }
    if (weightKg < 3) return BROSELOW_ZONES.grey;
    if (weightKg > 36) return BROSELOW_ZONES.green;
  }

  return BROSELOW_ZONES.yellow; // Default fallback
}

export interface PewsCalculationResult {
  totalScore: number;
  riskLevel: 'low_0_2' | 'moderate_3_4' | 'critical_5_plus';
  riskLabel: string;
  badgeColor: 'green' | 'yellow' | 'red';
  escalationRequired: boolean;
  clinicalActions: string[];
}

export function calculatePews(params: {
  behaviorScore: number; // 0-3
  cardiovascularScore: number; // 0-3
  respiratoryScore: number; // 0-3
  persistentVomitingPostOp?: boolean; // +1
}): PewsCalculationResult {
  const { behaviorScore, cardiovascularScore, respiratoryScore, persistentVomitingPostOp = false } = params;

  const totalScore =
    Math.min(3, Math.max(0, behaviorScore)) +
    Math.min(3, Math.max(0, cardiovascularScore)) +
    Math.min(3, Math.max(0, respiratoryScore)) +
    (persistentVomitingPostOp ? 1 : 0);

  if (totalScore >= 5) {
    return {
      totalScore,
      riskLevel: 'critical_5_plus',
      riskLabel: 'CRITICAL RISK (PEWS ≥ 5)',
      badgeColor: 'red',
      escalationRequired: true,
      clinicalActions: [
        'ACTIVATE PEDIATRIC RAPID RESPONSE TEAM / CODE BLUE STANDBY.',
        'Continuous pulse oximetry, ECG, and non-invasive blood pressure monitoring.',
        'Immediate attending pediatrician / PICU bedside evaluation within 10 minutes.',
        'Prepare Broselow Resuscitation emergency tape and check IV/IO access patency.',
        'Prepare airway cart and oxygen delivery (NRBM / CPAP / Intubation tray).'
      ],
    };
  } else if (totalScore >= 3) {
    return {
      totalScore,
      riskLevel: 'moderate_3_4',
      riskLabel: 'MODERATE RISK (PEWS 3-4)',
      badgeColor: 'yellow',
      escalationRequired: true,
      clinicalActions: [
        'Notify charge nurse and duty pediatric resident.',
        'Bedside clinical reassessment required within 30 minutes.',
        'Increase vital signs frequency to hourly.',
        'Review current fluid orders, antibiotics, and electrolyte labs.'
      ],
    };
  }

  return {
    totalScore,
    riskLevel: 'low_0_2',
    riskLabel: 'LOW RISK (PEWS 0-2)',
    badgeColor: 'green',
    escalationRequired: false,
    clinicalActions: [
      'Maintain standard ward nursing observations (q4h vitals).',
      'Continue routine pediatric hydration and oral intake.'
    ],
  };
}
