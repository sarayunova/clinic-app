export interface BishopScoreComponents {
  dilation: number;     // 0: closed, 1: 1-2cm, 2: 3-4cm, 3: >=5cm
  effacement: number;   // 0: 0-30%, 1: 40-50%, 2: 60-70%, 3: >=80%
  station: number;      // 0: -3, 1: -2, 2: -1/0, 3: +1/+2
  consistency: number;  // 0: firm, 1: medium, 2: soft
  position: number;     // 0: posterior, 1: mid-position, 2: anterior
}

export type BishopInterpretation = 'unfavorable' | 'intermediate' | 'favorable';

export interface BishopScoreResult {
  totalScore: number;
  interpretation: BishopInterpretation;
  label: string;
  inductionAdvice: string;
}

export const BISHOP_DILATION_OPTIONS = [
  { value: 0, label: 'Closed (0 cm) — 0 pts' },
  { value: 1, label: '1 - 2 cm — 1 pt' },
  { value: 2, label: '3 - 4 cm — 2 pts' },
  { value: 3, label: '≥ 5 cm — 3 pts' },
];

export const BISHOP_EFFACEMENT_OPTIONS = [
  { value: 0, label: '0 - 30% — 0 pts' },
  { value: 1, label: '40 - 50% — 1 pt' },
  { value: 2, label: '60 - 70% — 2 pts' },
  { value: 3, label: '≥ 80% — 3 pts' },
];

export const BISHOP_STATION_OPTIONS = [
  { value: 0, label: '-3 Station — 0 pts' },
  { value: 1, label: '-2 Station — 1 pt' },
  { value: 2, label: '-1 / 0 Station (Engaged) — 2 pts' },
  { value: 3, label: '+1 / +2 Station — 3 pts' },
];

export const BISHOP_CONSISTENCY_OPTIONS = [
  { value: 0, label: 'Firm — 0 pts' },
  { value: 1, label: 'Medium — 1 pt' },
  { value: 2, label: 'Soft — 2 pts' },
];

export const BISHOP_POSITION_OPTIONS = [
  { value: 0, label: 'Posterior — 0 pts' },
  { value: 1, label: 'Mid-position — 1 pt' },
  { value: 2, label: 'Anterior — 2 pts' },
];

export function calculateBishopScore(c: BishopScoreComponents): BishopScoreResult {
  const d = Math.max(0, Math.min(3, c.dilation || 0));
  const e = Math.max(0, Math.min(3, c.effacement || 0));
  const s = Math.max(0, Math.min(3, c.station || 0));
  const con = Math.max(0, Math.min(2, c.consistency || 0));
  const pos = Math.max(0, Math.min(2, c.position || 0));

  const totalScore = d + e + s + con + pos;

  if (totalScore <= 5) {
    return {
      totalScore,
      interpretation: 'unfavorable',
      label: 'Unfavorable Cervix (Score ≤ 5)',
      inductionAdvice: 'Cervical ripening required prior to oxytocin induction (e.g. PGE2 Dinoprostone gel/insert or Foley bulb induction).',
    };
  }

  if (totalScore <= 8) {
    return {
      totalScore,
      interpretation: 'intermediate',
      label: 'Intermediate Cervix (Score 6 - 8)',
      inductionAdvice: 'Borderline favorable. May proceed with amniotomy (ARM) ± low-dose Oxytocin titration with close fetal monitoring.',
    };
  }

  return {
    totalScore,
    interpretation: 'favorable',
    label: 'Favorable Cervix (Score ≥ 9)',
    inductionAdvice: 'Ripe cervix. High likelihood of successful spontaneous or induced vaginal birth with routine labor management.',
  };
}

/** Computes duration of rupture in hours from ISO timestamp */
export function calculateRuptureHours(rupturedAt?: string | null, nowStr?: string): number | null {
  if (!rupturedAt) return null;
  const tRupture = Date.parse(rupturedAt);
  if (isNaN(tRupture)) return null;
  const tNow = nowStr ? Date.parse(nowStr) : Date.now();
  const diffHours = (tNow - tRupture) / 3_600_000;
  return Math.max(0, Math.round(diffHours * 10) / 10);
}

/** Evaluates whether PROM duration exceeds standard 18-hour threshold requiring antibiotic prophylaxis */
export function isProlongedProm(ruptureHours?: number | null): boolean {
  return ruptureHours != null && ruptureHours >= 18;
}

/** Evaluates uterine tachysystole (> 5 contractions in 10 minutes or duration > 90 seconds) */
export function isTachysystole(contractionsPer10min: number, durationSec: number): boolean {
  return contractionsPer10min > 5 || durationSec > 90;
}
