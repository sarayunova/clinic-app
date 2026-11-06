import {
  evaluateVitalsAlerts,
  getHighestSeverity,
  calculateBmi,
  type VitalAlert,
  type VitalsInput,
} from '../vitalsAlerts';

export function VitalsAlertBadges({ alerts }: { alerts: VitalAlert[] }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <span className="vitals-alerts" style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {alerts.map((a, i) => (
        <span
          key={i}
          className={`badge ${a.severity}`}
          title={a.message}
          style={{ cursor: 'help' }}
        >
          {a.severity === 'danger' ? '🚨' : '⚠️'} {a.label}: {a.valueText}
        </span>
      ))}
    </span>
  );
}

export function VitalsSummaryBadge({ vitals }: { vitals: VitalsInput | null | undefined }) {
  const alerts = evaluateVitalsAlerts(vitals);
  if (alerts.length === 0) return null;
  const sev = getHighestSeverity(alerts);
  const title = alerts.map((a) => `${a.label} (${a.valueText}): ${a.message}`).join('\n');

  const first = alerts[0];
  const text = alerts.length === 1 && first ? `${first.label} (${first.valueText})` : `${alerts.length} vitals alerts`;

  return (
    <span
      className={`badge ${sev ?? 'warn'}`}
      title={title}
      style={{ cursor: 'help' }}
    >
      {sev === 'danger' ? '🚨' : '⚠️'} {text}
    </span>
  );
}

export function LiveVitalsAlertBanner({ vitals }: { vitals: VitalsInput | null | undefined }) {
  const alerts = evaluateVitalsAlerts(vitals);
  if (alerts.length === 0) return null;
  const sev = getHighestSeverity(alerts);

  return (
    <div className={`banner ${sev === 'danger' ? 'error' : 'warn'}`} style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
      <strong>
        {sev === 'danger' ? '🚨 Critical early warning threshold exceeded' : '⚠️ Warning threshold exceeded'}
      </strong>
      <ul style={{ margin: '0.35rem 0 0 1.2rem', padding: 0 }}>
        {alerts.map((a, i) => (
          <li key={i}>
            <strong>{a.label} ({a.valueText}):</strong> {a.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BmiBadge({
  weightKg,
  heightCm,
}: {
  weightKg?: number | string | null;
  heightCm?: number | string | null;
}) {
  const res = calculateBmi(weightKg, heightCm);
  if (!res) return null;
  const cls = res.category === 'Normal' ? 'ok' : res.category === 'Underweight' ? 'warn' : 'info';
  return (
    <span className={`badge ${cls}`} title={`Body Mass Index: ${res.category}`}>
      BMI {res.bmi} ({res.category})
    </span>
  );
}
