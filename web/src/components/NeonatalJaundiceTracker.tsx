import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type NeonatalJaundiceEpisode,
  type NeonatalJaundiceListResponse,
  type NeonatalBilirubinReading,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, todayLocal } from './ui';
import {
  BHUTANI_NOMOGRAM_POINTS,
  evaluateNeonatalBilirubin,
  calculateAgeInHours,
} from '../neonatalJaundiceEngine';

interface Props {
  patientId: number;
  patientDob?: string | null;
  onChanged?: () => void;
}

export function NeonatalJaundiceTracker({ patientId, patientDob, onChanged }: Props) {
  const { can } = useAuth();
  const canEdit = can('patient:write_clinical') || can('care:write_nursing') || can('admission:write');

  const [episodes, setEpisodes] = useState<NeonatalJaundiceEpisode[] | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // New episode form
  const [showNewEpisodeForm, setShowNewEpisodeForm] = useState(false);
  const [birthDatetime, setBirthDatetime] = useState(
    patientDob ? `${patientDob}T08:00` : `${todayLocal()}T08:00`
  );
  const [gaWeeks, setGaWeeks] = useState<number>(38);
  const [birthWeight, setBirthWeight] = useState<string>('3100');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [maternalBloodGroup, setMaternalBloodGroup] = useState<string>('O+');
  const [directCoombs, setDirectCoombs] = useState<'positive' | 'negative' | 'not_tested'>('not_tested');
  const [g6pdStatus, setG6pdStatus] = useState<'normal' | 'deficient' | 'not_tested'>('not_tested');
  const [hasNeuroRisk, setHasNeuroRisk] = useState<boolean>(false);
  const [feedingType, setFeedingType] = useState<'exclusive_breastfeeding' | 'formula' | 'mixed'>('exclusive_breastfeeding');
  const [clinicalSummary, setClinicalSummary] = useState<string>('');
  const [creatingEpisode, setCreatingEpisode] = useState(false);

  // New reading form
  const [showReadingForm, setShowReadingForm] = useState(false);
  const [sampleDatetime, setSampleDatetime] = useState('');
  const [customAgeHours, setCustomAgeHours] = useState<string>('');
  const [readingType, setReadingType] = useState<'tsb_serum' | 'tcb_transcutaneous'>('tsb_serum');
  const [biliValue, setBiliValue] = useState<string>('9.5');
  const [activePhototherapy, setActivePhototherapy] = useState<boolean>(false);
  const [phototherapyDevice, setPhototherapyDevice] = useState<string>('Single LED Phototherapy Unit');
  const [readingNotes, setReadingNotes] = useState<string>('');
  const [savingReading, setSavingReading] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<NeonatalJaundiceListResponse>('GET', `/api/patients/${patientId}/neonatal-jaundice`);
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && !selectedEpisodeId) {
        setSelectedEpisodeId(res.episodes[0]!.id);
      }
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedEpisodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeEpisode = episodes?.find((e) => e.id === selectedEpisodeId) ?? episodes?.[0] ?? null;

  // Set default sample datetime when opening reading form
  const handleOpenReadingForm = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setSampleDatetime(localNow);
    if (activeEpisode) {
      const calcHours = calculateAgeInHours(activeEpisode.birthDatetime, localNow);
      setCustomAgeHours(String(calcHours));
    }
    setShowReadingForm(true);
  };

  const handleCreateEpisode = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setCreatingEpisode(true);
      setFormError(null);
      const payload = {
        birthDatetime,
        gestationalAgeWeeks: gaWeeks,
        birthWeightGrams: birthWeight ? parseInt(birthWeight, 10) : null,
        bloodGroup: bloodGroup.trim() || null,
        maternalBloodGroup: maternalBloodGroup.trim() || null,
        directCoombsTest: directCoombs,
        g6pdDeficiency: g6pdStatus,
        neurotoxicityRisk: hasNeuroRisk,
        feedingType,
        clinicalSummary: clinicalSummary.trim() || null,
        status: 'monitoring',
      };
      const created = await api<NeonatalJaundiceEpisode>('POST', `/api/patients/${patientId}/neonatal-jaundice`, payload);
      setShowNewEpisodeForm(false);
      await load();
      setSelectedEpisodeId(created.id);
      onChanged?.();
    } catch (err) {
      setFormError(err);
    } finally {
      setCreatingEpisode(false);
    }
  };

  const handleSaveReading = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeEpisode) return;
    try {
      setSavingReading(true);
      setFormError(null);

      const val = parseFloat(biliValue);
      if (isNaN(val) || val <= 0) throw new Error('Enter a valid bilirubin value');

      const ageH = customAgeHours ? parseInt(customAgeHours, 10) : calculateAgeInHours(activeEpisode.birthDatetime, sampleDatetime);

      const payload = {
        sampleDatetime,
        ageHours: ageH,
        readingType,
        bilirubinMgDl: val,
        activePhototherapy,
        phototherapyDevice: activePhototherapy ? phototherapyDevice : null,
        notes: readingNotes.trim() || null,
      };

      await api('POST', `/api/neonatal-jaundice/${activeEpisode.id}/readings`, payload);
      setShowReadingForm(false);
      setReadingNotes('');
      await load();
      onChanged?.();
    } catch (err) {
      setFormError(err);
    } finally {
      setSavingReading(false);
    }
  };

  const handleDeleteReading = async (readingId: number) => {
    if (!confirm('Are you sure you want to delete this bilirubin measurement?')) return;
    try {
      await api('DELETE', `/api/neonatal-jaundice/readings/${readingId}`);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  };

  const handleUpdateStatus = async (newStatus: 'monitoring' | 'under_phototherapy' | 'resolved' | 'discharged') => {
    if (!activeEpisode) return;
    try {
      await api('PATCH', `/api/neonatal-jaundice/${activeEpisode.id}`, { status: newStatus });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  };

  // Live evaluation preview for form
  const previewEval = (() => {
    if (!activeEpisode || !biliValue) return null;
    const val = parseFloat(biliValue);
    const h = customAgeHours ? parseInt(customAgeHours, 10) : 48;
    if (isNaN(val) || val <= 0 || isNaN(h)) return null;
    return evaluateNeonatalBilirubin({
      bilirubinMgDl: val,
      ageHours: h,
      gaWeeks: activeEpisode.gestationalAgeWeeks,
      hasNeurotoxicityRisk: activeEpisode.neurotoxicityRisk,
    });
  })();

  // Render SVG Bhutani Nomogram Chart
  const renderNomogramSvg = () => {
    if (!activeEpisode) return null;

    const width = 640;
    const height = 320;
    const padding = { top: 25, right: 30, bottom: 40, left: 45 };

    const minX = 12;
    const maxX = 144;
    const minY = 0;
    const maxY = 25;

    const mapX = (h: number) =>
      padding.left + ((Math.min(maxX, Math.max(minX, h)) - minX) / (maxX - minX)) * (width - padding.left - padding.right);
    const mapY = (b: number) =>
      height - padding.bottom - ((Math.min(maxY, Math.max(minY, b)) - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);

    // Build shaded zone polygons
    const pts = BHUTANI_NOMOGRAM_POINTS.filter((p) => p.ageHours <= maxX);

    // Path for p95
    const p95Points = pts.map((p) => `${mapX(p.ageHours)},${mapY(p.p95)}`).join(' ');
    // Path for p75
    const p75Points = pts.map((p) => `${mapX(p.ageHours)},${mapY(p.p75)}`).join(' ');
    // Path for p40
    const p40Points = pts.map((p) => `${mapX(p.ageHours)},${mapY(p.p40)}`).join(' ');

    // Actual baby points
    const babyPoints = (activeEpisode.readings || [])
      .map((rd) => ({
        x: mapX(rd.ageHours),
        y: mapY(rd.bilirubinMgDl),
        ageHours: rd.ageHours,
        bili: rd.bilirubinMgDl,
        zone: rd.bhutaniRiskZone,
        photo: rd.activePhototherapy,
      }));

    const babyLine = babyPoints.map((p) => `${p.x},${p.y}`).join(' ');

    return (
      <div style={{ overflowX: 'auto', background: '#fff', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>📊 Hour-Specific Bhutani Risk Nomogram &amp; Phototherapy Guidance</strong>
          <div style={{ fontSize: '0.78rem', display: 'flex', gap: '0.8rem' }}>
            <span style={{ color: '#be123c', fontWeight: 600 }}>■ High Risk (&gt;95%)</span>
            <span style={{ color: '#b45309', fontWeight: 600 }}>■ High-Interm (75–95%)</span>
            <span style={{ color: '#854d0e' }}>■ Low-Interm (40–75%)</span>
            <span style={{ color: '#15803d', fontWeight: 600 }}>■ Low Risk (&lt;40%)</span>
          </div>
        </div>

        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: '700px', margin: '0 auto' }}>
          {/* Background grid */}
          {[0, 5, 10, 15, 20, 25].map((yVal) => (
            <g key={yVal}>
              <line
                x1={padding.left}
                y1={mapY(yVal)}
                x2={width - padding.right}
                y2={mapY(yVal)}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={mapY(yVal) + 4}
                textAnchor="end"
                fontSize={10}
                fill="#64748b"
              >
                {yVal}
              </text>
            </g>
          ))}

          {[24, 48, 72, 96, 120, 144].map((xVal) => (
            <g key={xVal}>
              <line
                x1={mapX(xVal)}
                y1={padding.top}
                x2={mapX(xVal)}
                y2={height - padding.bottom}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={mapX(xVal)}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="#64748b"
              >
                {xVal}h
              </text>
            </g>
          ))}

          {/* Bhutani Percentile Curves */}
          <polyline
            fill="none"
            stroke="#f43f5e"
            strokeWidth={2}
            strokeDasharray="4 2"
            points={p95Points}
          />
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.5}
            points={p75Points}
          />
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth={1.5}
            points={p40Points}
          />

          {/* Curve text labels at 120h */}
          <text x={mapX(120) + 4} y={mapY(18.5) - 3} fill="#be123c" fontSize={9} fontWeight="bold">95th %ile</text>
          <text x={mapX(120) + 4} y={mapY(16.0) - 3} fill="#b45309" fontSize={9} fontWeight="bold">75th %ile</text>
          <text x={mapX(120) + 4} y={mapY(13.0) - 3} fill="#15803d" fontSize={9} fontWeight="bold">40th %ile</text>

          {/* Baby trajectory line */}
          {babyLine && (
            <polyline
              fill="none"
              stroke="#0f172a"
              strokeWidth={2.5}
              points={babyLine}
            />
          )}

          {/* Baby data points */}
          {babyPoints.map((pt, idx) => (
            <g key={idx}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={5.5}
                fill={pt.photo ? '#0284c7' : pt.zone === 'high' ? '#e11d48' : pt.zone === 'high_intermediate' ? '#f59e0b' : '#10b981'}
                stroke="#0f172a"
                strokeWidth={1.5}
              />
              <text
                x={pt.x}
                y={pt.y - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="#0f172a"
              >
                {pt.bili}
              </text>
            </g>
          ))}

          {/* Axis Labels */}
          <text
            x={padding.left + 5}
            y={padding.top - 8}
            fontSize={10}
            fontWeight="bold"
            fill="#334155"
          >
            TSB / TcB (mg/dL)
          </text>
          <text
            x={width - padding.right}
            y={height - padding.bottom + 30}
            textAnchor="end"
            fontSize={10}
            fontWeight="bold"
            fill="#334155"
          >
            Postnatal Age (Hours)
          </text>
        </svg>
      </div>
    );
  };

  return (
    <section className="card stack" style={{ marginTop: '1.25rem' }}>
      {/* Header bar */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💡</span> Neonatal Hyperbilirubinemia &amp; Phototherapy Nomogram
          </h2>
          <div className="muted small">
            Bhutani hour-specific risk percentile curves &amp; AAP 2022 clinical phototherapy thresholds
          </div>
        </div>

        <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
          {activeEpisode && (
            <Link
              to={`/neonatal-jaundice/${activeEpisode.id}/print`}
              className="btn small"
              title="Print formal phototherapy chart"
            >
              🖨️ Print Nomogram Chart
            </Link>
          )}

          {canEdit && (
            <button
              type="button"
              className="btn primary small"
              onClick={() => {
                if (showNewEpisodeForm) {
                  setShowNewEpisodeForm(false);
                } else {
                  setShowNewEpisodeForm(true);
                  setShowReadingForm(false);
                }
              }}
            >
              {showNewEpisodeForm ? 'Cancel' : '+ New Jaundice Episode'}
            </button>
          )}
        </div>
      </div>

      <ErrorBanner error={error} />

      {/* New Episode Form */}
      {showNewEpisodeForm && (
        <form onSubmit={(e) => void handleCreateEpisode(e)} className="card stack" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>Initiate Neonatal Jaundice Monitoring Episode</h3>
          <ErrorBanner error={formError} />

          <div className="grid-2" style={{ gap: '0.8rem' }}>
            <Field label="Birth Date &amp; Time: *">
              <input
                type="datetime-local"
                required
                value={birthDatetime}
                onChange={(e) => setBirthDatetime(e.target.value)}
              />
            </Field>

            <Field label="Gestational Age (Completed Weeks): *">
              <input
                type="number"
                min={24}
                max={45}
                required
                value={gaWeeks}
                onChange={(e) => setGaWeeks(parseInt(e.target.value, 10))}
              />
            </Field>

            <Field label="Birth Weight (grams)">
              <input
                type="number"
                placeholder="e.g. 3100"
                value={birthWeight}
                onChange={(e) => setBirthWeight(e.target.value)}
              />
            </Field>

            <Field label="Infant Blood Group &amp; Rh">
              <input
                placeholder="e.g. B Positive"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
              />
            </Field>

            <Field label="Maternal Blood Group &amp; Rh">
              <input
                placeholder="e.g. O Positive"
                value={maternalBloodGroup}
                onChange={(e) => setMaternalBloodGroup(e.target.value)}
              />
            </Field>

            <Field label="Direct Coombs Test (DCT / DAT)">
              <select
                value={directCoombs}
                onChange={(e) => setDirectCoombs(e.target.value as any)}
              >
                <option value="not_tested">Not Tested</option>
                <option value="negative">Negative</option>
                <option value="positive">⚠️ Positive (Isoimmunization)</option>
              </select>
            </Field>

            <Field label="G6PD Deficiency Screen">
              <select
                value={g6pdStatus}
                onChange={(e) => setG6pdStatus(e.target.value as any)}
              >
                <option value="not_tested">Not Tested</option>
                <option value="normal">Normal</option>
                <option value="deficient">⚠️ Deficient</option>
              </select>
            </Field>

            <Field label="Feeding Method">
              <select
                value={feedingType}
                onChange={(e) => setFeedingType(e.target.value as any)}
              >
                <option value="exclusive_breastfeeding">Exclusive Breastfeeding</option>
                <option value="formula">Formula Feeding</option>
                <option value="mixed">Mixed (Breast + Formula)</option>
              </select>
            </Field>
          </div>

          <div style={{ marginTop: '0.4rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={hasNeuroRisk}
                onChange={(e) => setHasNeuroRisk(e.target.checked)}
              />
              <span>High Risk for Hyperbilirubinemia Neurotoxicity (Asphyxia, Sepsis, Acidosis, Albumin &lt; 3.0 g/dL, Hemolysis)</span>
            </label>
          </div>

          <Field label="Clinical Notes / Pre-discharge Plan">
            <textarea
              rows={2}
              placeholder="e.g. Infant noted icteric at 36 hours. Sclera and trunk jaundice. Feeding well, passing meconium."
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
            />
          </Field>

          <div className="row wrap" style={{ gap: '0.6rem' }}>
            <button className="btn primary" disabled={creatingEpisode}>
              {creatingEpisode ? 'Saving…' : 'Start Jaundice Episode'}
            </button>
            <button type="button" className="btn" onClick={() => setShowNewEpisodeForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Episode Header & Infant Details */}
      {activeEpisode && (
        <div className="card stack" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="row wrap" style={{ gap: '0.6rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>
                Episode #{activeEpisode.id}
              </span>
              <span className={`badge ${activeEpisode.status === 'under_phototherapy' ? 'warn font-bold' : activeEpisode.status === 'resolved' ? 'ok' : 'info'}`}>
                {activeEpisode.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="badge small">GA: {activeEpisode.gestationalAgeWeeks}w</span>
              {activeEpisode.birthWeightGrams && (
                <span className="badge small">Weight: {activeEpisode.birthWeightGrams}g</span>
              )}
              {activeEpisode.neurotoxicityRisk && (
                <span className="badge danger small font-bold">⚠️ Neurotoxicity Risk</span>
              )}
            </div>

            <div className="row wrap" style={{ gap: '0.4rem' }}>
              {canEdit && activeEpisode.status !== 'resolved' && (
                <button
                  type="button"
                  className="btn small ok"
                  onClick={() => void handleUpdateStatus('resolved')}
                >
                  ✓ Mark Jaundice Resolved
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="btn small primary"
                  onClick={handleOpenReadingForm}
                >
                  + Log Bilirubin (TSB/TcB)
                </button>
              )}
            </div>
          </div>

          <div className="row wrap" style={{ gap: '1rem', fontSize: '0.85rem' }}>
            <span><strong>Born:</strong> {activeEpisode.birthDatetime.replace('T', ' ')}</span>
            <span><strong>Baby Blood:</strong> {activeEpisode.bloodGroup || '—'}</span>
            <span><strong>Maternal Blood:</strong> {activeEpisode.maternalBloodGroup || '—'}</span>
            <span><strong>DCT:</strong> {activeEpisode.directCoombsTest}</span>
            <span><strong>G6PD:</strong> {activeEpisode.g6pdDeficiency}</span>
            <span><strong>Feeding:</strong> {activeEpisode.feedingType.replace('_', ' ')}</span>
          </div>
        </div>
      )}

      {/* New Reading Form */}
      {showReadingForm && (
        <form onSubmit={(e) => void handleSaveReading(e)} className="card stack" style={{ background: 'var(--bg)', border: '2px solid #0284c7' }}>
          <h3 style={{ margin: 0 }}>Log Bilirubin Measurement (TSB / TcB)</h3>
          <ErrorBanner error={formError} />

          <div className="grid-2" style={{ gap: '0.8rem' }}>
            <Field label="Sample Date &amp; Time: *">
              <input
                type="datetime-local"
                required
                value={sampleDatetime}
                onChange={(e) => {
                  setSampleDatetime(e.target.value);
                  if (activeEpisode) {
                    const h = calculateAgeInHours(activeEpisode.birthDatetime, e.target.value);
                    setCustomAgeHours(String(h));
                  }
                }}
              />
            </Field>

            <Field label="Postnatal Age (Hours): *">
              <input
                type="number"
                min={0}
                max={720}
                required
                value={customAgeHours}
                onChange={(e) => setCustomAgeHours(e.target.value)}
              />
            </Field>

            <Field label="Measurement Modality">
              <select
                value={readingType}
                onChange={(e) => setReadingType(e.target.value as any)}
              >
                <option value="tsb_serum">Total Serum Bilirubin (TSB - Blood Draw)</option>
                <option value="tcb_transcutaneous">Transcutaneous Bilirubin (TcB - Bilimeter)</option>
              </select>
            </Field>

            <Field label="Bilirubin Value (mg/dL): *">
              <input
                type="number"
                step="0.1"
                min={0.1}
                max={50}
                required
                value={biliValue}
                onChange={(e) => setBiliValue(e.target.value)}
              />
            </Field>
          </div>

          {/* Live Preview Card */}
          {previewEval && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                padding: '0.6rem 0.9rem',
                borderRadius: '4px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'center',
                fontSize: '0.88rem',
              }}
            >
              <div>
                <strong>Bhutani Zone:</strong>{' '}
                <span className={`badge ${previewEval.bhutaniZone === 'high' ? 'danger' : previewEval.bhutaniZone === 'high_intermediate' ? 'warn' : 'ok'}`}>
                  {previewEval.bhutaniLabel}
                </span>
              </div>
              <div>
                <strong>AAP Phototherapy Threshold:</strong> {previewEval.phototherapyThreshold} mg/dL{' '}
                {previewEval.phototherapyIndicated ? (
                  <span className="badge danger small font-bold">⚠️ Phototherapy Indicated</span>
                ) : (
                  <span className="badge ok small">✓ Below Threshold</span>
                )}
              </div>
              <div>
                <strong>Exchange Threshold:</strong> {previewEval.exchangeThreshold} mg/dL
              </div>
            </div>
          )}

          <div style={{ marginTop: '0.4rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={activePhototherapy}
                onChange={(e) => setActivePhototherapy(e.target.checked)}
              />
              <span>Infant is currently receiving active phototherapy</span>
            </label>
          </div>

          {activePhototherapy && (
            <Field label="Phototherapy Device / Modality">
              <input
                value={phototherapyDevice}
                placeholder="e.g. Double Surface LED Phototherapy Unit, Biliblanket"
                onChange={(e) => setPhototherapyDevice(e.target.value)}
              />
            </Field>
          )}

          <Field label="Clinical Notes / Action Taken">
            <input
              placeholder="e.g. Scleral icterus noted. Hydration pushed. Eye pads applied."
              value={readingNotes}
              onChange={(e) => setReadingNotes(e.target.value)}
            />
          </Field>

          <div className="row wrap" style={{ gap: '0.6rem' }}>
            <button className="btn primary" disabled={savingReading}>
              {savingReading ? 'Saving…' : 'Record Bilirubin Reading'}
            </button>
            <button type="button" className="btn" onClick={() => setShowReadingForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Visual Bhutani Nomogram Chart */}
      {activeEpisode && renderNomogramSvg()}

      {/* Serial Readings Log Table */}
      {activeEpisode && (
        <div className="stack" style={{ marginTop: '0.8rem', gap: '0.4rem' }}>
          <h4 style={{ margin: 0 }}>Serial Bilirubin Flowsheet &amp; Rate of Rise</h4>
          {activeEpisode.readings.length === 0 ? (
            <p className="muted small">No readings logged yet for this episode. Click &ldquo;+ Log Bilirubin&rdquo; above.</p>
          ) : (
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Age (h)</th>
                  <th>Sample Time</th>
                  <th>Type</th>
                  <th>Bilirubin</th>
                  <th>Rate of Rise</th>
                  <th>Bhutani Zone</th>
                  <th>Photo Cutoff</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeEpisode.readings.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.ageHours}h</strong></td>
                    <td>{r.sampleDatetime.replace('T', ' ')}</td>
                    <td><span className="badge small">{r.readingType === 'tsb_serum' ? 'TSB' : 'TcB'}</span></td>
                    <td>
                      <strong style={{ fontSize: '0.95rem', color: r.phototherapyIndicated ? '#dc2626' : undefined }}>
                        {r.bilirubinMgDl} mg/dL
                      </strong>
                      <span className="muted small" style={{ marginLeft: '0.3rem' }}>
                        ({r.bilirubinUmolL || Math.round(r.bilirubinMgDl * 17.1)} µmol/L)
                      </span>
                    </td>
                    <td>
                      {r.rateOfRiseMgDlHr != null ? (
                        <span style={{ fontWeight: r.rateOfRiseMgDlHr >= 0.5 ? 'bold' : 'normal', color: r.rateOfRiseMgDlHr >= 0.5 ? '#dc2626' : undefined }}>
                          {r.rateOfRiseMgDlHr > 0 ? `+${r.rateOfRiseMgDlHr}` : r.rateOfRiseMgDlHr} mg/dL/h
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge small ${r.bhutaniRiskZone === 'high' ? 'danger' : r.bhutaniRiskZone === 'high_intermediate' ? 'warn' : 'ok'}`}>
                        {r.bhutaniRiskZone?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>{r.phototherapyThresholdMgDl ?? '—'}</td>
                    <td>
                      {r.activePhototherapy ? (
                        <span className="badge info small font-bold">Under Phototherapy</span>
                      ) : r.phototherapyIndicated ? (
                        <span className="badge danger small font-bold">Phototherapy Indicated</span>
                      ) : (
                        <span className="badge ok small">Safe</span>
                      )}
                    </td>
                    <td>
                      {canEdit && (
                        <button
                          type="button"
                          className="btn small muted"
                          onClick={() => void handleDeleteReading(r.id)}
                          title="Delete measurement"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {loading && !episodes && <p className="muted">Loading neonatal jaundice records…</p>}
      {!loading && (!episodes || episodes.length === 0) && !showNewEpisodeForm && (
        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg)', borderRadius: '4px' }}>
          <p className="muted">No neonatal jaundice monitoring episodes recorded for this patient.</p>
          {canEdit && (
            <button
              type="button"
              className="btn small primary"
              onClick={() => setShowNewEpisodeForm(true)}
            >
              + Initiate Jaundice Episode
            </button>
          )}
        </div>
      )}
    </section>
  );
}
