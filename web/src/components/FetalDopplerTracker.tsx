import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type Patient, type FetalDopplerAssessment } from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateFetalDoppler,
  type DopplerCalculationResult,
} from '../dopplerEngine';

interface Props {
  patient: Patient;
}

export function FetalDopplerTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [assessments, setAssessments] = useState<FetalDopplerAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Compute default GA from LMP
  const computeDefaultGa = (): { weeks: number; days: number } => {
    if (!patient.lastMenstrualPeriod || typeof patient.lastMenstrualPeriod !== 'string') return { weeks: 32, days: 0 };
    const lmp = new Date(patient.lastMenstrualPeriod);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 140 && diffDays <= 300) {
      return { weeks: Math.floor(diffDays / 7), days: diffDays % 7 };
    }
    return { weeks: 32, days: 0 };
  };

  const initialForm = (): Partial<FetalDopplerAssessment> => {
    const ga = computeDefaultGa();
    return {
      patientId: patient.id,
      assessmentDate: new Date().toISOString().substring(0, 10),
      assessmentTime: new Date().toTimeString().substring(0, 5),
      gestationalAgeWeeks: ga.weeks,
      gestationalAgeDays: ga.days,

      estimatedFetalWeightG: 1950,
      efwPercentile: 50.0,
      abdominalCircumferenceMm: 280.0,
      acPercentile: 52.0,

      uaPi: 0.95,
      uaRi: 0.62,
      uaSdRatio: 2.6,
      uaEndDiastolicFlow: 'normal_positive',

      mcaPi: 1.95,
      mcaRi: 0.74,
      mcaPsvCmS: 44.0,

      utaLeftPi: 0.72,
      utaRightPi: 0.68,
      utaMeanPi: 0.70,
      utaNotching: 'none',

      dvPiv: 0.52,
      dvAWave: 'positive',

      clinicalNotes: 'Doppler velocimetry demonstrates low-resistance forward flow in umbilical artery with normal MCA impedance and reassuring CPR.',
      performedBy: me.fullName || 'Attending Sonologist',
    };
  };

  const [form, setForm] = useState<Partial<FetalDopplerAssessment>>(initialForm());

  const loadAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ total: number; assessments: FetalDopplerAssessment[] }>(
        'GET',
        `/api/patients/${patient.id}/doppler`,
      );
      setAssessments(res.assessments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Doppler assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments();
  }, [patient.id]);

  // Live real-time calculations
  let liveCalc: DopplerCalculationResult | null = null;
  if (form.gestationalAgeWeeks && form.uaPi && form.mcaPi) {
    liveCalc = calculateFetalDoppler({
      gestationalAgeWeeks: Number(form.gestationalAgeWeeks),
      gestationalAgeDays: Number(form.gestationalAgeDays) || 0,
      estimatedFetalWeightG: form.estimatedFetalWeightG != null ? Number(form.estimatedFetalWeightG) : undefined,
      efwPercentile: form.efwPercentile != null ? Number(form.efwPercentile) : undefined,
      abdominalCircumferenceMm: form.abdominalCircumferenceMm != null ? Number(form.abdominalCircumferenceMm) : undefined,
      acPercentile: form.acPercentile != null ? Number(form.acPercentile) : undefined,
      uaPi: Number(form.uaPi),
      uaRi: form.uaRi != null ? Number(form.uaRi) : undefined,
      uaSdRatio: form.uaSdRatio != null ? Number(form.uaSdRatio) : undefined,
      uaEndDiastolicFlow: form.uaEndDiastolicFlow || 'normal_positive',
      mcaPi: Number(form.mcaPi),
      mcaRi: form.mcaRi != null ? Number(form.mcaRi) : undefined,
      mcaPsvCmS: form.mcaPsvCmS != null ? Number(form.mcaPsvCmS) : undefined,
      utaLeftPi: form.utaLeftPi != null ? Number(form.utaLeftPi) : undefined,
      utaRightPi: form.utaRightPi != null ? Number(form.utaRightPi) : undefined,
      utaMeanPi: form.utaMeanPi != null ? Number(form.utaMeanPi) : undefined,
      utaNotching: form.utaNotching || 'none',
      dvPiv: form.dvPiv != null ? Number(form.dvPiv) : undefined,
      dvAWave: form.dvAWave || 'positive',
    });
  }

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(initialForm());
    setShowModal(true);
  };

  const handleOpenEdit = (rec: FetalDopplerAssessment) => {
    setEditingId(rec.id);
    setForm({ ...rec });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this Doppler assessment? This action is audited.')) {
      return;
    }
    try {
      await api('DELETE', `/api/patients/${patient.id}/doppler/${id}`);
      await loadAssessments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete record');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        patientId: patient.id,
        gestationalAgeWeeks: Number(form.gestationalAgeWeeks),
        gestationalAgeDays: Number(form.gestationalAgeDays || 0),
        uaPi: Number(form.uaPi),
        mcaPi: Number(form.mcaPi),
      };

      if (editingId) {
        await api('PUT', `/api/patients/${patient.id}/doppler/${editingId}`, payload);
      } else {
        await api('POST', `/api/patients/${patient.id}/doppler`, payload);
      }
      setShowModal(false);
      await loadAssessments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save Doppler assessment');
    } finally {
      setSaving(false);
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'stage_4':
        return (
          <span
            style={{
              backgroundColor: '#450a0a',
              color: '#fecaca',
              border: '1px solid #dc2626',
              padding: '3px 9px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.8rem',
            }}
          >
            ⚡ STAGE IV: CRITICAL ACIDEMIA
          </span>
        );
      case 'stage_3':
        return (
          <span
            style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #f87171',
              padding: '3px 9px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            🚨 STAGE III: REDV / DV &gt; 95th
          </span>
        );
      case 'stage_2':
        return (
          <span
            style={{
              backgroundColor: '#ffedd5',
              color: '#9a3412',
              border: '1px solid #fb923c',
              padding: '3px 9px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            ⚠️ STAGE II: AEDV (ABSENT DIASTOLIC)
          </span>
        );
      case 'stage_1':
        return (
          <span
            style={{
              backgroundColor: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fcd34d',
              padding: '3px 9px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            🧠 STAGE I: BRAIN SPARING (CPR &lt; 1.0)
          </span>
        );
      default:
        return (
          <span
            style={{
              backgroundColor: '#dcfce7',
              color: '#166534',
              border: '1px solid #86efac',
              padding: '3px 9px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            ✅ STAGE 0: NORMAL HEMODYNAMICS
          </span>
        );
    }
  };

  const getCprBadge = (status: string, ratio: number) => {
    if (status === 'brain_sparing_redistribution' || ratio < 1.05) {
      return (
        <span
          style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fca5a5',
            padding: '2px 7px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          🧠 Brain-Sparing ({ratio.toFixed(2)})
        </span>
      );
    }
    return (
      <span
        style={{
          backgroundColor: '#dcfce7',
          color: '#166534',
          border: '1px solid #86efac',
          padding: '2px 7px',
          borderRadius: '6px',
          fontWeight: 700,
          fontSize: '0.8rem',
        }}
      >
        Reassuring ({ratio.toFixed(2)})
      </span>
    );
  };

  return (
    <div className="stack" style={{ gap: '1.2rem' }}>
      {/* Top Banner / Actions */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%)',
          borderColor: '#bae6fd',
        }}
      >
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌊</span> Fetal Doppler Velocimetry &amp; Cerebroplacental Ratio (CPR) Nomogram
          </h3>
          <p className="muted small" style={{ margin: '0.3rem 0 0 0' }}>
            Longitudinal hemodynamic surveillance of Umbilical Artery (UA), Middle Cerebral Artery (MCA), CPR brain-sparing, Uterine Artery (UtA), and Ductus Venosus (DV). Automated FIGO &amp; Barcelona FGR Staging.
          </p>
        </div>
        {can('patient:read_clinical') && (
          <button type="button" className="btn primary" onClick={handleOpenCreate}>
            + Record Doppler Velocimetry
          </button>
        )}
      </div>

      {error && (
        <div className="banner warn" role="alert">
          {error}
        </div>
      )}

      {/* Doppler Assessment List / History */}
      <section className="card stack">
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Longitudinal Doppler Assessments ({assessments.length})</h4>

        {loading ? (
          <p className="muted">Loading Doppler assessments…</p>
        ) : assessments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌊</div>
            <p style={{ margin: 0 }}>No Doppler velocimetry records found for {patient.fullName}.</p>
            {can('patient:read_clinical') && (
              <button
                type="button"
                className="btn small primary"
                style={{ marginTop: '0.8rem' }}
                onClick={handleOpenCreate}
              >
                Record 3rd Trimester Doppler Check
              </button>
            )}
          </div>
        ) : (
          <div className="stack" style={{ gap: '1rem' }}>
            {assessments.map((a) => (
              <div
                key={a.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.6rem',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                      Doppler Velocimetry at {a.gestationalAgeWeeks}w {a.gestationalAgeDays || 0}d
                    </strong>
                    <div className="muted small" style={{ marginTop: '2px' }}>
                      Date: <strong>{a.assessmentDate}</strong> {a.assessmentTime ? `(${a.assessmentTime})` : ''} ·
                      Performed by: <strong>{a.performedBy || 'Sonologist'}</strong>
                    </div>
                  </div>
                  <div>{getStageBadge(a.barcelonaStage)}</div>
                </div>

                {/* Key Indices Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: '0.6rem',
                    backgroundColor: '#f8fafc',
                    padding: '0.8rem',
                    borderRadius: '6px',
                    margin: '0.6rem 0',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <span className="muted">Umbilical Artery (UA) PI:</span>{' '}
                    <strong style={{ color: a.uaPiStatus === 'elevated_above_95th' ? '#dc2626' : 'inherit' }}>
                      {a.uaPi} ({a.uaPiCentile}th %ile)
                    </strong>
                    <div className="small muted">
                      Flow:{' '}
                      <strong style={{ color: a.uaEndDiastolicFlow !== 'normal_positive' ? '#dc2626' : 'inherit' }}>
                        {a.uaEndDiastolicFlow.toUpperCase().replace(/_/g, ' ')}
                      </strong>
                    </div>
                  </div>

                  <div>
                    <span className="muted">Middle Cerebral (MCA) PI:</span>{' '}
                    <strong style={{ color: a.mcaBrainSparing !== 'none' ? '#dc2626' : 'inherit' }}>
                      {a.mcaPi} ({a.mcaPiCentile}th %ile)
                    </strong>
                    {a.mcaPsvCmS && (
                      <div className="small muted">
                        PSV: {a.mcaPsvCmS} cm/s {a.mcaPsvMom ? `(${a.mcaPsvMom} MoM)` : ''}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="muted">Cerebroplacental Ratio:</span>
                    <div>{getCprBadge(a.cprStatus, a.cprRatio)}</div>
                    <div className="small muted">Centile: {a.cprCentile}th %ile</div>
                  </div>

                  {a.utaMeanPi != null && (
                    <div>
                      <span className="muted">Uterine Artery Mean PI:</span>{' '}
                      <strong>{a.utaMeanPi}</strong>
                      <div className="small muted">
                        Notching: <strong>{a.utaNotching.toUpperCase()}</strong>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="muted">Ductus Venosus (DV):</span>{' '}
                    <strong style={{ color: a.dvAWave === 'reversed' ? '#dc2626' : 'inherit' }}>
                      {a.dvPiv ? `PIV ${a.dvPiv} · ` : ''}A-wave {a.dvAWave.toUpperCase()}
                    </strong>
                  </div>

                  {a.estimatedFetalWeightG != null && (
                    <div>
                      <span className="muted">Fetal Weight:</span>{' '}
                      <strong>{a.estimatedFetalWeightG} g</strong> ({a.efwPercentile ?? '—'}th %ile)
                      <div className="small muted">
                        FIGO: <strong style={{ textTransform: 'uppercase' }}>{a.fgrClassification.replace(/_/g, ' ')}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Staging & Delivery Action Directive */}
                <div
                  style={{
                    backgroundColor:
                      a.barcelonaStage === 'stage_4' || a.barcelonaStage === 'stage_3'
                        ? '#fff1f2'
                        : a.barcelonaStage === 'stage_2'
                        ? '#fff7ed'
                        : a.barcelonaStage === 'stage_1'
                        ? '#fefce8'
                        : '#f0fdf4',
                    borderLeft: `4px solid ${
                      a.barcelonaStage === 'stage_4' || a.barcelonaStage === 'stage_3'
                        ? '#e11d48'
                        : a.barcelonaStage === 'stage_2'
                        ? '#ea580c'
                        : a.barcelonaStage === 'stage_1'
                        ? '#eab308'
                        : '#22c55e'
                    }`,
                    padding: '0.6rem 0.8rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    margin: '0.5rem 0',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                    Clinical Delivery Plan: {a.deliveryTimingRecommendation}
                  </div>
                  <div className="small" style={{ color: '#475569' }}>
                    Surveillance: {a.monitoringFrequencyRecommendation}
                    {a.steroidsIndicated ? ' · 💉 Antenatal Corticosteroids Indicated' : ''}
                    {a.mgso4NeuroprotectionIndicated ? ' · 🛡️ MgSO4 Fetal Neuroprotection Indicated' : ''}
                  </div>
                </div>

                {a.clinicalNotes && (
                  <div className="small muted" style={{ margin: '0.4rem 0' }}>
                    <strong>Clinical Note:</strong> {a.clinicalNotes}
                  </div>
                )}

                {/* Actions Footer */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.6rem',
                    paddingTop: '0.4rem',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <span className="muted small">
                    Reviewed by: {a.reviewedByName || 'Doctor'}
                  </span>
                  <div className="row wrap" style={{ gap: '0.4rem' }}>
                    <Link
                      to={`/patients/${patient.id}/doppler/${a.id}/print`}
                      className="btn small"
                      title="Print Clinical Doppler Hemodynamic Report"
                    >
                      🖨️ Print Report
                    </Link>
                    {can('patient:read_clinical') && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleOpenEdit(a)}
                        title="Edit Doppler assessment"
                      >
                        ✏️ Edit
                      </button>
                    )}
                    {can('user:manage') && (
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => handleDelete(a.id)}
                        title="Delete assessment"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Editor Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ margin: 0, color: '#0f172a' }}>
                {editingId ? 'Edit Fetal Doppler Velocimetry Record' : 'Record Fetal Doppler & CPR Assessment'}
              </h3>
              <button
                type="button"
                className="btn small"
                onClick={() => setShowModal(false)}
                style={{ fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="stack" style={{ gap: '1.2rem' }}>
              {/* Demographics & Biometry Context */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '0.8rem',
                  backgroundColor: '#f8fafc',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <label className="label small">Assessment Date</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={form.assessmentDate || ''}
                    onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label small">Time</label>
                  <input
                    type="time"
                    className="input"
                    value={form.assessmentTime || ''}
                    onChange={(e) => setForm({ ...form, assessmentTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label small">GA Weeks (18–44)</label>
                  <input
                    type="number"
                    min="18"
                    max="44"
                    required
                    className="input"
                    value={form.gestationalAgeWeeks ?? ''}
                    onChange={(e) => setForm({ ...form, gestationalAgeWeeks: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label small">GA Days (0–6)</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    className="input"
                    value={form.gestationalAgeDays ?? 0}
                    onChange={(e) => setForm({ ...form, gestationalAgeDays: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label small">EFW (grams)</label>
                  <input
                    type="number"
                    min="100"
                    max="7000"
                    className="input"
                    value={form.estimatedFetalWeightG ?? ''}
                    onChange={(e) => setForm({ ...form, estimatedFetalWeightG: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <label className="label small">EFW Centile (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="input"
                    value={form.efwPercentile ?? ''}
                    onChange={(e) => setForm({ ...form, efwPercentile: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              </div>

              {/* UMBILICAL ARTERY SECTION */}
              <div
                className="stack"
                style={{
                  gap: '0.8rem',
                  border: '1px solid #fed7aa',
                  borderRadius: '6px',
                  padding: '1rem',
                  backgroundColor: '#fffaf5',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#c2410c' }}>Umbilical Artery (UA) Velocimetry</h4>
                  {liveCalc && (
                    <span className="small">
                      Normative median: {liveCalc.uaPiMedian} · 95th %ile: {liveCalc.uaPiP95}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
                  <div>
                    <label className="label small">UA Pulsatility Index (PI)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="5.0"
                      required
                      className="input"
                      value={form.uaPi ?? ''}
                      onChange={(e) => setForm({ ...form, uaPi: Number(e.target.value) })}
                    />
                    {liveCalc && (
                      <div className="small muted" style={{ marginTop: '2px' }}>
                        Centile: <strong>{liveCalc.uaPiCentile}th %ile</strong>
                        {liveCalc.uaPiStatus === 'elevated_above_95th' && (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}> (Elevated &gt; 95th)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label small">End-Diastolic Flow Velocity</label>
                    <select
                      className="input"
                      value={form.uaEndDiastolicFlow || 'normal_positive'}
                      onChange={(e) => setForm({ ...form, uaEndDiastolicFlow: e.target.value as any })}
                    >
                      <option value="normal_positive">Positive Flow (Normal)</option>
                      <option value="reduced">Reduced End-Diastolic Flow</option>
                      <option value="aedf_absent">Absent End-Diastolic Flow (AEDV - Stage II)</option>
                      <option value="redf_reversed">Reversed End-Diastolic Flow (REDV - Stage III)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label small">Resistance Index (RI)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="1.5"
                      className="input"
                      value={form.uaRi ?? ''}
                      onChange={(e) => setForm({ ...form, uaRi: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                  <div>
                    <label className="label small">S/D Ratio</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="20"
                      className="input"
                      value={form.uaSdRatio ?? ''}
                      onChange={(e) => setForm({ ...form, uaSdRatio: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </div>
              </div>

              {/* MIDDLE CEREBRAL ARTERY SECTION */}
              <div
                className="stack"
                style={{
                  gap: '0.8rem',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  padding: '1rem',
                  backgroundColor: '#f0f9ff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#1e40af' }}>Middle Cerebral Artery (MCA) Velocimetry</h4>
                  {liveCalc && (
                    <span className="small">
                      Normative median: {liveCalc.mcaPiMedian} · 5th %ile: {liveCalc.mcaPiP5}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
                  <div>
                    <label className="label small">MCA Pulsatility Index (PI)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="5.0"
                      required
                      className="input"
                      value={form.mcaPi ?? ''}
                      onChange={(e) => setForm({ ...form, mcaPi: Number(e.target.value) })}
                    />
                    {liveCalc && (
                      <div className="small muted" style={{ marginTop: '2px' }}>
                        Centile: <strong>{liveCalc.mcaPiCentile}th %ile</strong>
                        {liveCalc.mcaBrainSparing === 'vasodilation_below_5th' && (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}> (Vasodilated &lt; 5th)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label small">Peak Systolic Velocity (PSV cm/s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="5"
                      max="200"
                      className="input"
                      value={form.mcaPsvCmS ?? ''}
                      onChange={(e) => setForm({ ...form, mcaPsvCmS: e.target.value ? Number(e.target.value) : null })}
                    />
                    {liveCalc?.mcaPsvMom != null && (
                      <div className="small muted" style={{ marginTop: '2px' }}>
                        MoM: <strong>{liveCalc.mcaPsvMom} MoM</strong>
                        {liveCalc.fetalAnemiaRisk === 'moderate_to_severe' && (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}> (≥1.5 MoM Anemia)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label small">MCA RI</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="1.5"
                      className="input"
                      value={form.mcaRi ?? ''}
                      onChange={(e) => setForm({ ...form, mcaRi: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </div>
              </div>

              {/* LIVE CPR & BRAIN-SPARING METER */}
              {liveCalc && (
                <div
                  style={{
                    backgroundColor: liveCalc.cprStatus === 'brain_sparing_redistribution' ? '#fff1f2' : '#f0fdf4',
                    border: `2px solid ${liveCalc.cprStatus === 'brain_sparing_redistribution' ? '#f87171' : '#86efac'}`,
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <h4 style={{ margin: 0, color: '#0f172a' }}>
                      Cerebroplacental Ratio (CPR = MCA PI / UA PI)
                    </h4>
                    {getCprBadge(liveCalc.cprStatus, liveCalc.cprRatio)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', fontSize: '0.9rem' }}>
                    <div>
                      <span className="muted small">Calculated CPR:</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: liveCalc.cprStatus === 'brain_sparing_redistribution' ? '#dc2626' : '#166534' }}>
                        {liveCalc.cprRatio}
                      </div>
                    </div>
                    <div>
                      <span className="muted small">CPR Centile:</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569' }}>
                        {liveCalc.cprCentile}th percentile
                      </div>
                    </div>
                    <div>
                      <span className="muted small">Normal Threshold:</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#475569' }}>
                        &ge; {liveCalc.cprP5} (Median: {liveCalc.cprMedian})
                      </div>
                    </div>
                    <div>
                      <span className="muted small">Hemodynamic Status:</span>
                      <div style={{ fontWeight: 700, color: liveCalc.cprStatus === 'brain_sparing_redistribution' ? '#dc2626' : '#166534' }}>
                        {liveCalc.cprStatus === 'brain_sparing_redistribution' ? 'BRAIN-SPARING REDISTRIBUTION' : 'NORMAL PERFUSION'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* UTERINE ARTERY & DUCTUS VENOSUS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '1rem',
                }}
              >
                {/* Uterine Artery */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.8rem', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#334155' }}>Uterine Artery (UtA)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div>
                      <label className="label small">Left PI</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="5.0"
                        className="input"
                        value={form.utaLeftPi ?? ''}
                        onChange={(e) => setForm({ ...form, utaLeftPi: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <div>
                      <label className="label small">Right PI</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="5.0"
                        className="input"
                        value={form.utaRightPi ?? ''}
                        onChange={(e) => setForm({ ...form, utaRightPi: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="label small">Early Diastolic Notching</label>
                      <select
                        className="input"
                        value={form.utaNotching || 'none'}
                        onChange={(e) => setForm({ ...form, utaNotching: e.target.value as any })}
                      >
                        <option value="none">None (Bilateral absent notching)</option>
                        <option value="unilateral">Unilateral Notching</option>
                        <option value="bilateral">Bilateral Notching (High Uteroplacental Resistance)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Ductus Venosus */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.8rem', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#334155' }}>Ductus Venosus (DV)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div>
                      <label className="label small">DV PIV</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="3.0"
                        className="input"
                        value={form.dvPiv ?? ''}
                        onChange={(e) => setForm({ ...form, dvPiv: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <div>
                      <label className="label small">A-Wave Status</label>
                      <select
                        className="input"
                        value={form.dvAWave || 'positive'}
                        onChange={(e) => setForm({ ...form, dvAWave: e.target.value as any })}
                      >
                        <option value="positive">Positive A-wave (Normal forward flow)</option>
                        <option value="absent">Absent A-wave (Impaired)</option>
                        <option value="reversed">Reversed A-wave (Critical Stage IV Acidemia)</option>
                        <option value="not_performed">Not performed</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE BARCELONA STAGE & CLINICAL ACTION CARD */}
              {liveCalc && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #0f172a',
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>Clinical Staging: {liveCalc.stageTitle}</h4>
                    {getStageBadge(liveCalc.barcelonaStage)}
                  </div>

                  <div style={{ fontSize: '0.88rem', lineHeight: 1.45, color: '#334155' }}>
                    <p style={{ margin: '0 0 0.4rem 0' }}>
                      <strong>Obstetric Delivery Plan:</strong>{' '}
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>
                        {liveCalc.deliveryTimingRecommendation}
                      </span>
                    </p>
                    <p style={{ margin: '0 0 0.4rem 0' }}>
                      <strong>Surveillance Interval:</strong> {liveCalc.monitoringFrequencyRecommendation}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Summary Verdict:</strong> {liveCalc.clinicalSummary}
                    </p>
                  </div>
                </div>
              )}

              {/* Clinical Notes & Clinician */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
                <div>
                  <label className="label small">Examiner / Sonologist Name</label>
                  <input
                    type="text"
                    className="input"
                    value={form.performedBy || ''}
                    onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label small">Clinical Remarks &amp; Recommendations</label>
                  <textarea
                    rows={2}
                    className="input"
                    value={form.clinicalNotes || ''}
                    onChange={(e) => setForm({ ...form, clinicalNotes: e.target.value })}
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Saving Assessment…' : editingId ? 'Update Record' : 'Save Doppler Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
