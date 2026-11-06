/**
 * Neonatal Hyperbilirubinemia (Jaundice) Phototherapy Nomogram Engine
 * Mathematical implementation following Bhutani hour-specific nomogram and AAP 2022 guidelines.
 */

export type BhutaniRiskZone = 'low' | 'low_intermediate' | 'high_intermediate' | 'high';
export type JaundiceRiskTier = 'lower_risk' | 'medium_risk' | 'higher_risk';

export interface BhutaniCurveCoordinates {
  ageHours: number;
  p40: number;
  p75: number;
  p95: number;
}

export const BHUTANI_NOMOGRAM_POINTS: BhutaniCurveCoordinates[] = [
  { ageHours: 12, p40: 3.5, p75: 4.5, p95: 5.6 },
  { ageHours: 18, p40: 4.4, p75: 5.5, p95: 7.0 },
  { ageHours: 24, p40: 5.0, p75: 6.2, p95: 8.0 },
  { ageHours: 36, p40: 6.8, p75: 8.8, p95: 10.8 },
  { ageHours: 48, p40: 8.5, p75: 11.0, p95: 13.2 },
  { ageHours: 60, p40: 9.8, p75: 12.6, p95: 15.0 },
  { ageHours: 72, p40: 11.0, p75: 14.0, p95: 16.5 },
  { ageHours: 84, p40: 11.8, p75: 14.8, p95: 17.3 },
  { ageHours: 96, p40: 12.5, p75: 15.4, p95: 18.0 },
  { ageHours: 108, p40: 12.8, p75: 15.7, p95: 18.3 },
  { ageHours: 120, p40: 13.0, p75: 16.0, p95: 18.5 },
  { ageHours: 144, p40: 13.2, p75: 16.2, p95: 18.8 },
  { ageHours: 168, p40: 13.3, p75: 16.3, p95: 19.0 },
];

/**
 * Linearly interpolates value between two known data points.
 */
function interpolate(x: number, x0: number, y0: number, x1: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/**
 * Returns Bhutani percentiles (p40, p75, p95) for any postnatal age in hours (0 to 168h).
 */
export function getBhutaniPercentiles(ageHours: number): { p40: number; p75: number; p95: number } {
  const h = Math.max(12, Math.min(168, ageHours));

  if (h <= BHUTANI_NOMOGRAM_POINTS[0]!.ageHours) {
    const pt = BHUTANI_NOMOGRAM_POINTS[0]!;
    return { p40: pt.p40, p75: pt.p75, p95: pt.p95 };
  }

  const lastPt = BHUTANI_NOMOGRAM_POINTS[BHUTANI_NOMOGRAM_POINTS.length - 1]!;
  if (h >= lastPt.ageHours) {
    return { p40: lastPt.p40, p75: lastPt.p75, p95: lastPt.p95 };
  }

  for (let i = 0; i < BHUTANI_NOMOGRAM_POINTS.length - 1; i++) {
    const p0 = BHUTANI_NOMOGRAM_POINTS[i]!;
    const p1 = BHUTANI_NOMOGRAM_POINTS[i + 1]!;
    if (h >= p0.ageHours && h <= p1.ageHours) {
      return {
        p40: Math.round(interpolate(h, p0.ageHours, p0.p40, p1.ageHours, p1.p40) * 10) / 10,
        p75: Math.round(interpolate(h, p0.ageHours, p0.p75, p1.ageHours, p1.p75) * 10) / 10,
        p95: Math.round(interpolate(h, p0.ageHours, p0.p95, p1.ageHours, p1.p95) * 10) / 10,
      };
    }
  }

  return { p40: 13.0, p75: 16.0, p95: 18.5 };
}

/**
 * Classifies Bilirubin reading into Bhutani hour-specific risk zone.
 */
export function classifyBhutaniRiskZone(bilirubinMgDl: number, ageHours: number): {
  zone: BhutaniRiskZone;
  label: string;
  badgeClass: string;
  percentiles: { p40: number; p75: number; p95: number };
} {
  const pct = getBhutaniPercentiles(ageHours);

  if (bilirubinMgDl > pct.p95) {
    return {
      zone: 'high',
      label: 'High Risk Zone (> 95th %ile)',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      percentiles: pct,
    };
  } else if (bilirubinMgDl >= pct.p75) {
    return {
      zone: 'high_intermediate',
      label: 'High Intermediate Risk (75th–95th %ile)',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
      percentiles: pct,
    };
  } else if (bilirubinMgDl >= pct.p40) {
    return {
      zone: 'low_intermediate',
      label: 'Low Intermediate Risk (40th–75th %ile)',
      badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200',
      percentiles: pct,
    };
  } else {
    return {
      zone: 'low',
      label: 'Low Risk Zone (< 40th %ile)',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      percentiles: pct,
    };
  }
}

/**
 * Determines AAP 2022 Risk Tier.
 */
export function determineAapRiskTier(gaWeeks: number, hasNeuroRisk: boolean): JaundiceRiskTier {
  if (gaWeeks >= 38 && !hasNeuroRisk) {
    return 'lower_risk';
  } else if (gaWeeks >= 38 && hasNeuroRisk) {
    return 'medium_risk';
  } else if (gaWeeks < 38 && !hasNeuroRisk) {
    return 'medium_risk';
  } else {
    // < 38 weeks with risk factors
    return 'higher_risk';
  }
}

/**
 * AAP 2022 Phototherapy Cutoff Curves (mg/dL) by Tier
 */
const AAP_PHOTO_CURVES: Record<JaundiceRiskTier, Array<{ age: number; cutoff: number }>> = {
  lower_risk: [
    { age: 12, cutoff: 8.0 },
    { age: 24, cutoff: 12.0 },
    { age: 36, cutoff: 13.8 },
    { age: 48, cutoff: 15.0 },
    { age: 60, cutoff: 16.5 },
    { age: 72, cutoff: 18.0 },
    { age: 96, cutoff: 20.0 },
    { age: 168, cutoff: 21.0 },
  ],
  medium_risk: [
    { age: 12, cutoff: 6.5 },
    { age: 24, cutoff: 10.0 },
    { age: 36, cutoff: 11.8 },
    { age: 48, cutoff: 13.0 },
    { age: 60, cutoff: 14.5 },
    { age: 72, cutoff: 15.5 },
    { age: 96, cutoff: 17.0 },
    { age: 168, cutoff: 18.0 },
  ],
  higher_risk: [
    { age: 12, cutoff: 5.0 },
    { age: 24, cutoff: 8.0 },
    { age: 36, cutoff: 9.8 },
    { age: 48, cutoff: 11.0 },
    { age: 60, cutoff: 12.5 },
    { age: 72, cutoff: 13.5 },
    { age: 96, cutoff: 15.0 },
    { age: 168, cutoff: 15.5 },
  ],
};

/**
 * AAP 2022 Exchange Transfusion Cutoff Curves (mg/dL) by Tier
 */
const AAP_EXCHANGE_CURVES: Record<JaundiceRiskTier, Array<{ age: number; cutoff: number }>> = {
  lower_risk: [
    { age: 12, cutoff: 15.0 },
    { age: 24, cutoff: 19.0 },
    { age: 36, cutoff: 20.5 },
    { age: 48, cutoff: 22.0 },
    { age: 60, cutoff: 23.0 },
    { age: 72, cutoff: 24.0 },
    { age: 96, cutoff: 25.0 },
    { age: 168, cutoff: 25.0 },
  ],
  medium_risk: [
    { age: 12, cutoff: 13.0 },
    { age: 24, cutoff: 16.5 },
    { age: 36, cutoff: 18.0 },
    { age: 48, cutoff: 19.5 },
    { age: 60, cutoff: 20.5 },
    { age: 72, cutoff: 21.5 },
    { age: 96, cutoff: 22.5 },
    { age: 168, cutoff: 22.5 },
  ],
  higher_risk: [
    { age: 12, cutoff: 11.0 },
    { age: 24, cutoff: 14.0 },
    { age: 36, cutoff: 15.5 },
    { age: 48, cutoff: 17.0 },
    { age: 60, cutoff: 17.8 },
    { age: 72, cutoff: 18.5 },
    { age: 96, cutoff: 19.0 },
    { age: 168, cutoff: 19.0 },
  ],
};

function getThresholdFromCurve(curve: Array<{ age: number; cutoff: number }>, ageHours: number): number {
  const h = Math.max(12, Math.min(168, ageHours));
  if (h <= curve[0]!.age) return curve[0]!.cutoff;
  const last = curve[curve.length - 1]!;
  if (h >= last.age) return last.cutoff;

  for (let i = 0; i < curve.length - 1; i++) {
    const c0 = curve[i]!;
    const c1 = curve[i + 1]!;
    if (h >= c0.age && h <= c1.age) {
      return Math.round(interpolate(h, c0.age, c0.cutoff, c1.age, c1.cutoff) * 10) / 10;
    }
  }
  return last.cutoff;
}

export interface JaundiceEvaluation {
  ageHours: number;
  bilirubinMgDl: number;
  bilirubinUmolL: number;
  bhutaniZone: BhutaniRiskZone;
  bhutaniLabel: string;
  riskTier: JaundiceRiskTier;
  riskTierLabel: string;
  phototherapyThreshold: number;
  exchangeThreshold: number;
  phototherapyIndicated: boolean;
  escalationIndicated: boolean;
  exchangeIndicated: boolean;
  clinicalAction: string;
  actionBadgeClass: string;
}

export function evaluateNeonatalBilirubin(params: {
  bilirubinMgDl: number;
  ageHours: number;
  gaWeeks: number;
  hasNeurotoxicityRisk: boolean;
}): JaundiceEvaluation {
  const { bilirubinMgDl, ageHours, gaWeeks, hasNeurotoxicityRisk } = params;
  const bilirubinUmolL = Math.round(bilirubinMgDl * 17.1 * 10) / 10;

  const bZone = classifyBhutaniRiskZone(bilirubinMgDl, ageHours);
  const tier = determineAapRiskTier(gaWeeks, hasNeurotoxicityRisk);

  const photoCutoff = getThresholdFromCurve(AAP_PHOTO_CURVES[tier], ageHours);
  const exchangeCutoff = getThresholdFromCurve(AAP_EXCHANGE_CURVES[tier], ageHours);

  const phototherapyIndicated = bilirubinMgDl >= photoCutoff;
  const escalationIndicated = bilirubinMgDl >= (exchangeCutoff - 2.0);
  const exchangeIndicated = bilirubinMgDl >= exchangeCutoff;

  let tierLabel = 'Lower Risk (≥38w, No Risk Factors)';
  if (tier === 'medium_risk') {
    tierLabel = gaWeeks >= 38 ? 'Medium Risk (≥38w with Risk Factors)' : 'Medium Risk (35–37w, No Risk Factors)';
  } else if (tier === 'higher_risk') {
    tierLabel = 'Higher Risk (35–37w with Risk Factors)';
  }

  let clinicalAction = 'Routine neonatal care. Repeat TSB/TcB predischarge or as indicated.';
  let actionBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

  if (exchangeIndicated) {
    clinicalAction = 'CRITICAL EMERGENCY: Bilirubin at/above Exchange Transfusion threshold. Immediate NICU admission, intensive phototherapy, emergent laboratory crossmatch, and prepare for exchange transfusion.';
    actionBadgeClass = 'bg-rose-100 text-rose-800 border-rose-400 font-bold animate-pulse';
  } else if (escalationIndicated) {
    clinicalAction = 'ESCALATION OF CARE: Bilirubin within 2 mg/dL of exchange threshold. Provide intensive phototherapy (double/triple LED), IV hydration, and repeat TSB in 2 hours.';
    actionBadgeClass = 'bg-rose-50 text-rose-700 border-rose-300 font-bold';
  } else if (phototherapyIndicated) {
    clinicalAction = 'Phototherapy Indicated: Start continuous phototherapy. Ensure eye protection and hydration. Check repeat TSB within 12–24 hours.';
    actionBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
  } else if (bZone.zone === 'high' || bZone.zone === 'high_intermediate') {
    clinicalAction = 'Elevated Risk: Bilirubin in upper Bhutani zones. Close surveillance; repeat TSB/TcB in 8–12 hours.';
    actionBadgeClass = 'bg-yellow-50 text-yellow-800 border-yellow-200 font-medium';
  }

  return {
    ageHours,
    bilirubinMgDl,
    bilirubinUmolL,
    bhutaniZone: bZone.zone,
    bhutaniLabel: bZone.label,
    riskTier: tier,
    riskTierLabel: tierLabel,
    phototherapyThreshold: photoCutoff,
    exchangeThreshold: exchangeCutoff,
    phototherapyIndicated,
    escalationIndicated,
    exchangeIndicated,
    clinicalAction,
    actionBadgeClass,
  };
}

/**
 * Calculates rate of rise between two bilirubin measurements.
 */
export function calculateBilirubinRateOfRise(
  reading1: { ageHours: number; bilirubinMgDl: number },
  reading2: { ageHours: number; bilirubinMgDl: number }
): {
  ratePerHour: number;
  isRapidRise: boolean;
  interpretation: string;
} | null {
  const deltaHours = reading2.ageHours - reading1.ageHours;
  if (deltaHours <= 0) return null;

  const deltaBili = reading2.bilirubinMgDl - reading1.bilirubinMgDl;
  const ratePerHour = Math.round((deltaBili / deltaHours) * 100) / 100;
  const isRapidRise = ratePerHour >= 0.5;

  let interpretation = 'Normal gradual physiological rise.';
  if (ratePerHour < 0) {
    interpretation = 'Declining bilirubin trajectory (improving/treatment response).';
  } else if (isRapidRise) {
    interpretation = `CRITICAL RAPID RISE (${ratePerHour} mg/dL/hr ≥ 0.5 mg/dL/hr): High suspicion of active hemolysis (e.g. Rh/ABO incompatibility, G6PD)!`;
  } else if (ratePerHour >= 0.2) {
    interpretation = `Accelerated rise (${ratePerHour} mg/dL/hr): Monitor closely with repeat testing in 4–6 hours.`;
  }

  return {
    ratePerHour,
    isRapidRise,
    interpretation,
  };
}

/**
 * Helper to calculate infant's age in hours from birth datetime to sample datetime.
 */
export function calculateAgeInHours(birthIso: string, sampleIso: string): number {
  const b = new Date(birthIso).getTime();
  const s = new Date(sampleIso).getTime();
  const diffMs = s - b;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}
