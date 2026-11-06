import { useEffect, useState } from 'react';
import {
  api,
  type UltrasoundBiometryResponse,
  type UltrasoundBiometryScan,
} from '../api';
import { HADLOCK_EFW_PERCENTILE_TABLE } from '../ultrasoundBiometry';
import { ErrorBanner } from './ui';

interface Props {
  patientId: number;
  refreshTrigger?: number;
}

export function UltrasoundGrowthChart({ patientId, refreshTrigger }: Props) {
  const [data, setData] = useState<UltrasoundBiometryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<UltrasoundBiometryResponse>('GET', `/api/patients/${patientId}/ultrasound-biometry`)
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [patientId, refreshTrigger]);

  if (loading && !data) return null;
  if (error) return <ErrorBanner error={error} />;
  if (!data || data.scans.length === 0) return null;

  const scans = data.scans;
  const summary = data.summary;
  const hasMultipleScans = scans.length >= 2;

  return (
    <div
      className="card stack"
      style={{
        background: '#ffffff',
        border: '1.5px solid #0284c7',
        borderRadius: '8px',
        padding: '0.9rem 1.1rem',
        gap: '0.8rem',
        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.08)',
        marginBottom: '1rem',
      }}
    >
      {/* Header */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>📈</span>
          <div>
            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
              Fetal Growth Trajectory &amp; Gestational Dating Comparison
            </strong>
            <div className="muted small" style={{ fontSize: '0.78rem' }}>
              Longitudinal biometry tracking across {summary.totalScans} ultrasound {summary.totalScans === 1 ? 'scan' : 'scans'} · Hadlock 4-parameter regression standard
            </div>
          </div>
        </div>

        {summary.latestEfwGrams != null && (
          <div className="row" style={{ gap: '0.4rem', alignItems: 'center' }}>
            <span className="badge ok">
              Latest EFW: <strong>{summary.latestEfwGrams}g</strong>
            </span>
            {summary.latestAfiCm != null && (
              <span className="badge info">
                AFI: <strong>{summary.latestAfiCm} cm</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Clinical Warning Banners */}
      {summary.hasGrowthRestrictionAlert && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '6px',
            padding: '0.6rem 0.8rem',
            color: '#991b1b',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <strong>Fetal Growth Restriction (FGR / SGA) or Oligohydramnios Alert:</strong>
            <div>
              Serial ultrasound evaluation identified estimated fetal weight below the 10th percentile, severe gestational dating lag (&gt;14 days), or reduced liquor. Recommended: Umbilical artery and Middle Cerebral Artery (MCA) Doppler velocimetry and close biophysical surveillance.
            </div>
          </div>
        </div>
      )}

      {summary.hasMacrosomiaAlert && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            padding: '0.6rem 0.8rem',
            color: '#92400e',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <strong>Large for Gestational Age (LGA / Macrosomia) Alert:</strong>
            <div>
              Estimated fetal weight exceeds the 90th percentile for gestational age. Review maternal glucose tolerance (OGTT) and monitor for cephalopelvic disproportion (CPD) or shoulder dystocia risk.
            </div>
          </div>
        </div>
      )}

      {/* Growth Trajectory Timeline Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '0.5rem 0.6rem' }}>Scan Date</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>Scan Type</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>GA by LMP</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>GA by Scan</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>Discrepancy (Δ)</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>Biometry (mm)</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>EFW (g)</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>Fluid / AFI</th>
              <th style={{ padding: '0.5rem 0.6rem' }}>Status / Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s, idx) => {
              const delta = s.deltaDays;
              const isLag = delta != null && delta <= -7;
              const isLead = delta != null && delta >= 7;

              return (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    background: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                  }}
                >
                  <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>{s.scanDate}</td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    <span style={{ textTransform: 'capitalize' }}>
                      {s.scanType.replace(/_/g, ' ')}
                    </span>
                    {s.imagesCount > 0 && (
                      <span className="muted" style={{ marginLeft: '4px', fontSize: '0.75rem' }}>
                        ({s.imagesCount} 📷)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    {s.lmpGaFormatted || '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: '#0369a1' }}>
                    {s.scanGaFormatted || '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    {delta == null ? (
                      <span className="muted">—</span>
                    ) : Math.abs(delta) < 7 ? (
                      <span
                        style={{
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        Concordant ({delta > 0 ? `+${delta}d` : `${delta}d`})
                      </span>
                    ) : isLag ? (
                      <span
                        style={{
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        ⚠️ Delayed by {Math.abs(delta)}d
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        Ahead by +{delta}d
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>
                    {s.crlMm != null && <span>CRL: <strong>{s.crlMm}</strong> </span>}
                    {s.bpdMm != null && <span>BPD: <strong>{s.bpdMm}</strong> </span>}
                    {s.hcMm != null && <span>HC: <strong>{s.hcMm}</strong> </span>}
                    {s.acMm != null && <span>AC: <strong>{s.acMm}</strong> </span>}
                    {s.flMm != null && <span>FL: <strong>{s.flMm}</strong></span>}
                    {s.crlMm == null && s.bpdMm == null && <span className="muted">—</span>}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    {s.efwGrams != null ? (
                      <div>
                        <strong>{s.efwGrams} g</strong>
                        {s.efwPercentile && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {s.efwPercentile.split(' ')[0]}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    {s.amnioticFluidCm != null ? (
                      <div>
                        <strong>{s.amnioticFluidCm} cm</strong>
                        {s.amnioticFluidAssessment && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: s.amnioticFluidAssessment === 'normal' ? '#16a34a' : '#dc2626',
                              fontWeight: 500,
                            }}
                          >
                            {s.amnioticFluidAssessment}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: s.growthStatus.includes('FGR') || s.growthStatus.includes('Small') || s.growthStatus.includes('Lag') || s.growthStatus.includes('Oligohydramnios')
                          ? '#fef2f2'
                          : s.growthStatus.includes('Macrosomia') || s.growthStatus.includes('Large')
                          ? '#fffbeb'
                          : '#f0fdf4',
                        color: s.growthStatus.includes('FGR') || s.growthStatus.includes('Small') || s.growthStatus.includes('Lag') || s.growthStatus.includes('Oligohydramnios')
                          ? '#991b1b'
                          : s.growthStatus.includes('Macrosomia') || s.growthStatus.includes('Large')
                          ? '#92400e'
                          : '#166534',
                      }}
                    >
                      {s.growthStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hadlock Fetal Weight Growth Curve / Corridor Chart */}
      {hasMultipleScans && scans.some((s) => s.efwGrams != null && s.gestationalAgeWeeks != null) && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '0.8rem',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '0.5rem' }}>
            📊 Hadlock EFW Growth Curve vs Expected 50th Percentile Median
          </div>

          <div className="stack" style={{ gap: '0.5rem' }}>
            {scans
              .filter((s): s is UltrasoundBiometryScan & { efwGrams: number; gestationalAgeWeeks: number } => s.efwGrams != null && s.gestationalAgeWeeks != null)
              .map((s) => {
                const ref = HADLOCK_EFW_PERCENTILE_TABLE[s.gestationalAgeWeeks];
                const median = ref?.p50;
                const p10 = ref?.p10;
                const p90 = ref?.p90;
                const maxScale = 4500;
                const pctActual = Math.min(100, Math.round((s.efwGrams / maxScale) * 100));
                const pctMedian = median ? Math.min(100, Math.round((median / maxScale) * 100)) : null;

                const isSga = p10 != null && s.efwGrams < p10;
                const isLga = p90 != null && s.efwGrams > p90;

                return (
                  <div key={s.id} style={{ fontSize: '0.8rem' }}>
                    <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>
                        <strong>{s.scanDate}</strong> ({s.gestationalAgeWeeks}w {s.gestationalAgeDays ?? 0}d):{' '}
                        <span style={{ fontWeight: 700, color: isSga ? '#dc2626' : isLga ? '#d97706' : '#0284c7' }}>
                          {s.efwGrams} g
                        </span>
                      </span>
                      {median && (
                        <span className="muted small">
                          Expected Median: {median}g (p10: {p10}g – p90: {p90}g)
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        position: 'relative',
                        height: '14px',
                        background: '#e2e8f0',
                        borderRadius: '7px',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Measured weight bar */}
                      <div
                        style={{
                          height: '100%',
                          width: `${pctActual}%`,
                          backgroundColor: isSga ? '#ef4444' : isLga ? '#f59e0b' : '#0284c7',
                          borderRadius: '7px',
                          transition: 'width 0.3s ease',
                        }}
                      />

                      {/* Median target tick marker */}
                      {pctMedian != null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${pctMedian}%`,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: '#0f172a',
                            zIndex: 2,
                          }}
                          title={`Expected median: ${median}g`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="row wrap" style={{ gap: '1rem', marginTop: '0.6rem', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#0284c7', borderRadius: '2px' }} />
              Appropriate for GA (AGA, 10th–90th percentile)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }} />
              Small for GA (&lt; 10th percentile / SGA)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }} />
              Large for GA (&gt; 90th percentile / LGA)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '2px', height: '10px', background: '#0f172a' }} />
              Hadlock 50th Percentile Median
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
