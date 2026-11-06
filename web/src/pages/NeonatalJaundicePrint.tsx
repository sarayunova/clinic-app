import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type NeonatalJaundiceEpisode } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function NeonatalJaundicePrint() {
  const { id } = useParams();
  const episodeId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [episode, setEpisode] = useState<NeonatalJaundiceEpisode | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!episodeId) return;
    setLoading(true);
    api<NeonatalJaundiceEpisode>('GET', `/api/neonatal-jaundice/${episodeId}`)
      .then((res) => {
        setEpisode(res);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [episodeId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${episode?.patientId || ''}`} className="btn small">
            ← Back to Patient Record
          </Link>
        </p>
      </div>
    );
  }

  if (loading || !clinic || !episode) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading neonatal phototherapy &amp; jaundice sheet…</p>
      </div>
    );
  }

  const latestReading = episode.latestReading;

  return (
    <Sheet
      clinic={clinic}
      title="Neonatal Hyperbilirubinemia &amp; Phototherapy Flowsheet"
      back={`/patients/${episode.patientId}`}
    >
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
          Hour-Specific Bhutani Nomogram &amp; AAP 2022 Phototherapy Assessment
        </div>
      </div>

      {/* Patient & Infant Metadata Grid */}
      <section className="sheet-block">
        <dl
          className="grid-meta"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.4rem 1rem',
            margin: 0,
            fontSize: '0.85rem',
            lineHeight: 1.35,
          }}
        >
          <div>
            <dt className="muted small">Infant Name</dt>
            <dd><strong>{episode.patientName || 'Newborn Infant'}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Patient MRN / ID</dt>
            <dd>{episode.patientNumber || '—'}</dd>
          </div>
          <div>
            <dt className="muted small">Birth Date &amp; Time</dt>
            <dd><strong>{episode.birthDatetime.replace('T', ' ')}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Gestational Age / Weight</dt>
            <dd>
              <strong>{episode.gestationalAgeWeeks} weeks</strong>
              {episode.birthWeightGrams ? ` · ${episode.birthWeightGrams} g` : ''}
            </dd>
          </div>
          <div>
            <dt className="muted small">Infant Blood Group &amp; Rh</dt>
            <dd><strong>{episode.bloodGroup || '—'}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Maternal Blood Group &amp; Rh</dt>
            <dd><strong>{episode.maternalBloodGroup || '—'}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Direct Coombs Test (DCT)</dt>
            <dd style={{ textTransform: 'capitalize', fontWeight: episode.directCoombsTest === 'positive' ? 'bold' : 'normal', color: episode.directCoombsTest === 'positive' ? '#dc2626' : undefined }}>
              {episode.directCoombsTest}
            </dd>
          </div>
          <div>
            <dt className="muted small">G6PD Deficiency Screen</dt>
            <dd style={{ textTransform: 'capitalize', fontWeight: episode.g6pdDeficiency === 'deficient' ? 'bold' : 'normal', color: episode.g6pdDeficiency === 'deficient' ? '#dc2626' : undefined }}>
              {episode.g6pdDeficiency}
            </dd>
          </div>
          <div>
            <dt className="muted small">Feeding Modality</dt>
            <dd style={{ textTransform: 'capitalize' }}>{episode.feedingType.replace('_', ' ')}</dd>
          </div>
          <div>
            <dt className="muted small">Neurotoxicity Risk Factors</dt>
            <dd>
              {episode.neurotoxicityRisk ? (
                <strong style={{ color: '#dc2626' }}>⚠️ Present (Higher Risk Tier)</strong>
              ) : (
                <span style={{ color: '#15803d' }}>✓ None Reported (Standard Risk)</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Latest Status & Clinical Recommendation Banner */}
      {latestReading && (
        <section
          className="sheet-block"
          style={{
            marginTop: '0.8rem',
            padding: '0.65rem 0.85rem',
            background: latestReading.phototherapyIndicated ? '#fff1f2' : '#f0fdf4',
            border: `1.5px solid ${latestReading.phototherapyIndicated ? '#f43f5e' : '#86efac'}`,
            borderRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>LATEST MEASUREMENT STATUS (at {latestReading.ageHours} hours of life):</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a' }}>
                Bilirubin: {latestReading.bilirubinMgDl} mg/dL ({latestReading.readingType === 'tsb_serum' ? 'Serum TSB' : 'Transcutaneous TcB'})
                {' · '}
                <span style={{ textTransform: 'uppercase', color: latestReading.bhutaniRiskZone === 'high' ? '#be123c' : latestReading.bhutaniRiskZone === 'high_intermediate' ? '#b45309' : '#15803d' }}>
                  {latestReading.bhutaniRiskZone?.replace('_', ' ')} ZONE
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
              <div><strong>Phototherapy Threshold:</strong> {latestReading.phototherapyThresholdMgDl ?? '—'} mg/dL</div>
              <div><strong>Exchange Threshold:</strong> {latestReading.exchangeThresholdMgDl ?? '—'} mg/dL</div>
            </div>
          </div>
          {latestReading.clinicalAction && (
            <div style={{ marginTop: '0.4rem', paddingTop: '0.3rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
              Action Plan: {latestReading.clinicalAction}
            </div>
          )}
        </section>
      )}

      {/* Serial Bilirubin Flowsheet Table */}
      <section className="sheet-block" style={{ marginTop: '0.8rem' }}>
        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
          Serial Bilirubin &amp; Phototherapy Flowsheet
        </h3>
        <table className="sheet-table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginTop: '0.25rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
              <th style={{ padding: '0.35rem' }}>Age (h)</th>
              <th style={{ padding: '0.35rem' }}>Sample Date &amp; Time</th>
              <th style={{ padding: '0.35rem' }}>Modality</th>
              <th style={{ padding: '0.35rem' }}>Bilirubin (mg/dL)</th>
              <th style={{ padding: '0.35rem' }}>Bilirubin (µmol/L)</th>
              <th style={{ padding: '0.35rem' }}>Rate of Rise</th>
              <th style={{ padding: '0.35rem' }}>Bhutani Zone</th>
              <th style={{ padding: '0.35rem' }}>Treatment Status</th>
            </tr>
          </thead>
          <tbody>
            {episode.readings.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '0.8rem', textAlign: 'center', color: '#64748b' }}>
                  No bilirubin readings logged for this episode.
                </td>
              </tr>
            ) : (
              episode.readings.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}><strong>{r.ageHours}h</strong></td>
                  <td style={{ padding: '0.35rem' }}>{r.sampleDatetime.replace('T', ' ')}</td>
                  <td style={{ padding: '0.35rem' }}>{r.readingType === 'tsb_serum' ? 'Serum TSB' : 'TcB'}</td>
                  <td style={{ padding: '0.35rem' }}>
                    <strong style={{ color: r.phototherapyIndicated ? '#dc2626' : '#0f172a' }}>
                      {r.bilirubinMgDl}
                    </strong>
                  </td>
                  <td style={{ padding: '0.35rem' }}>
                    {r.bilirubinUmolL || Math.round(r.bilirubinMgDl * 17.1)}
                  </td>
                  <td style={{ padding: '0.35rem' }}>
                    {r.rateOfRiseMgDlHr != null ? (
                      <span style={{ fontWeight: r.rateOfRiseMgDlHr >= 0.5 ? 'bold' : 'normal', color: r.rateOfRiseMgDlHr >= 0.5 ? '#dc2626' : undefined }}>
                        {r.rateOfRiseMgDlHr > 0 ? `+${r.rateOfRiseMgDlHr}` : r.rateOfRiseMgDlHr} mg/dL/h
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '0.35rem' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: r.bhutaniRiskZone === 'high' ? 'bold' : 'normal', color: r.bhutaniRiskZone === 'high' ? '#be123c' : r.bhutaniRiskZone === 'high_intermediate' ? '#b45309' : '#15803d' }}>
                      {r.bhutaniRiskZone?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '0.35rem' }}>
                    {r.activePhototherapy ? (
                      <span style={{ fontWeight: 'bold', color: '#0284c7' }}>Phototherapy Active</span>
                    ) : r.phototherapyIndicated ? (
                      <span style={{ fontWeight: 'bold', color: '#dc2626' }}>Indicated</span>
                    ) : (
                      <span style={{ color: '#15803d' }}>Observing</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Clinical Notes */}
      {episode.clinicalSummary && (
        <section className="sheet-block" style={{ marginTop: '0.8rem', padding: '0.6rem 0.8rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#334155' }}>Clinical Notes &amp; Discharge Plan:</strong>
          <div style={{ fontSize: '0.88rem', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>{episode.clinicalSummary}</div>
        </section>
      )}

      {/* Sign-off */}
      <div style={{ marginTop: '1.5rem', pageBreakInside: 'avoid' }}>
        <SignatureBlock
          clinic={clinic}
          signatoryName={episode.createdByName || clinic.doctorName}
          designation="Pediatrician / Neonatologist"
          subtext={`Phototherapy flow recorded under Medical Council guidelines.`}
          alignment="right"
        />
      </div>
    </Sheet>
  );
}
