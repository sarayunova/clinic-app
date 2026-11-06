import { calculateEdd, calculateGestationalAge, formatGpal } from './pregnancyCalc.js';
export * from './pregnancyCalc.js';

export function PregnancyChip({
  lmp,
  asOfDate,
  showLmp = false,
}: {
  lmp?: string | null;
  asOfDate?: string | null;
  showLmp?: boolean;
}) {
  if (!lmp) return null;
  const ga = calculateGestationalAge(lmp, asOfDate);
  const edd = calculateEdd(lmp);
  if (!ga || !edd || !ga.isPlausiblePregnancy) return null;

  return (
    <span
      className="badge info"
      title={`Calculated via Naegele's rule from LMP ${lmp}. EDD: ${edd}`}
      style={{ verticalAlign: 'middle' }}
    >
      🤰 {ga.formatted} · EDD {edd}
      {showLmp && ` (LMP ${lmp})`}
    </span>
  );
}

export function ObstetricChip({
  gravida,
  para,
  abortions,
  living,
}: {
  gravida?: unknown;
  para?: unknown;
  abortions?: unknown;
  living?: unknown;
}) {
  const text = formatGpal({ gravida, para, abortions, living });
  if (!text) return null;
  return (
    <span
      className="badge"
      title="Obstetric history: Gravida, Para, Abortions, Living"
      style={{ verticalAlign: 'middle', fontWeight: 600 }}
    >
      {text}
    </span>
  );
}
