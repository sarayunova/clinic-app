import React, { useState, useEffect } from 'react';
import { createObstetricPosttermEpisode, calculateObstetricPostterm } from '../api';

interface ObstetricPosttermModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricPosttermModal: React.FC<ObstetricPosttermModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [assessmentDatetime, setAssessmentDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(41.4);
  const [datingMethod, setDatingMethod] = useState<string>('first_trimester_ultrasound_crl');

  const [amnioticFluidIndexCm, setAmnioticFluidIndexCm] = useState(4.5);
  const [singleDeepestPocketCm, setSingleDeepestPocketCm] = useState(1.8);
  const [nonStressTestResult, setNonStressTestResult] = useState<'reactive' | 'non_reactive'>('reactive');
  const [biophysicalProfileScore, setBiophysicalProfileScore] = useState<number | ''>(8);
  const [estimatedFetalWeightGrams, setEstimatedFetalWeightGrams] = useState<number | ''>(3650);

  const [cervicalDilationCm, setCervicalDilationCm] = useState(1.5);
  const [cervicalEffacementPct, setCervicalEffacementPct] = useState(40);
  const [fetalStation, setFetalStation] = useState(-2);
  const [cervicalConsistency, setCervicalConsistency] = useState<'firm' | 'medium' | 'soft'>('firm');
  const [cervicalPosition, setCervicalPosition] = useState<'posterior' | 'midposition' | 'anterior'>('posterior');

  const [priorCesareanSection, setPriorCesareanSection] = useState(false);
  const [status, setStatus] = useState<string>('inpatient_cervical_ripening');
  const [clinicalNotes, setClinicalNotes] = useState('Late-term pregnancy (41+4w) with oligohydramnios (AFI 4.5 cm). Modified Bishop score unfavorable. Ripening indicated.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateObstetricPostterm({
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      datingMethod,
      amnioticFluidIndexCm: Number(amnioticFluidIndexCm),
      singleDeepestPocketCm: Number(singleDeepestPocketCm),
      nonStressTestResult,
      biophysicalProfileScore: biophysicalProfileScore === '' ? undefined : Number(biophysicalProfileScore),
      estimatedFetalWeightGrams: estimatedFetalWeightGrams === '' ? undefined : Number(estimatedFetalWeightGrams),
      cervicalDilationCm: Number(cervicalDilationCm),
      cervicalEffacementPct: Number(cervicalEffacementPct),
      fetalStation: Number(fetalStation),
      cervicalConsistency,
      cervicalPosition,
      priorCesareanSection,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    datingMethod,
    amnioticFluidIndexCm,
    singleDeepestPocketCm,
    nonStressTestResult,
    biophysicalProfileScore,
    estimatedFetalWeightGrams,
    cervicalDilationCm,
    cervicalEffacementPct,
    fetalStation,
    cervicalConsistency,
    cervicalPosition,
    priorCesareanSection,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createObstetricPosttermEpisode({
        patientId,
        assessmentDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        datingMethod,
        amnioticFluidIndexCm: Number(amnioticFluidIndexCm),
        singleDeepestPocketCm: Number(singleDeepestPocketCm),
        nonStressTestResult,
        biophysicalProfileScore: biophysicalProfileScore === '' ? null : Number(biophysicalProfileScore),
        estimatedFetalWeightGrams: estimatedFetalWeightGrams === '' ? null : Number(estimatedFetalWeightGrams),
        cervicalDilationCm: Number(cervicalDilationCm),
        cervicalEffacementPct: Number(cervicalEffacementPct),
        fetalStation: Number(fetalStation),
        cervicalConsistency,
        cervicalPosition,
        priorCesareanSection,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record post-term pregnancy evaluation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-card"
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, color: '#047857' }}>
            🩺 Post-Term & Bishop Cervical Ripening: {patientName}
          </h3>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Gestational Dating Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assessment Date/Time</label>
              <input
                type="datetime-local"
                className="form-control"
                value={assessmentDatetime}
                onChange={(e) => setAssessmentDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gestational Age (w.d)</label>
              <input
                type="number"
                step="0.1"
                min="41.0"
                max="45.0"
                className="form-control"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                required
              />
              <small className="muted">Late: 41.0-41.6, Post: ≥42.0</small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dating Confirmation Method</label>
              <select className="form-control" value={datingMethod} onChange={(e) => setDatingMethod(e.target.value)}>
                <option value="first_trimester_ultrasound_crl">1st Trimester CRL Ultrasound (Gold Std)</option>
                <option value="early_second_trimester_bpd_fl">Early 2nd Trimester BPD/FL Ultrasound</option>
                <option value="reliable_lmp_concordant">Reliable LMP Concordant with Scan</option>
                <option value="uncertain_dating">Uncertain Dating / Late Scan</option>
              </select>
            </div>
          </div>

          {/* Amniotic Fluid & Fetal Wellbeing */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>AFI (cm)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="35"
                className="form-control"
                value={amnioticFluidIndexCm}
                onChange={(e) => setAmnioticFluidIndexCm(Number(e.target.value))}
                required
              />
              <small className="muted">Oligo: ≤ 5.0 cm</small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>SDP (cm)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="15"
                className="form-control"
                value={singleDeepestPocketCm}
                onChange={(e) => setSingleDeepestPocketCm(Number(e.target.value))}
                required
              />
              <small className="muted">Oligo: &lt; 2.0 cm</small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Non-Stress Test (NST)</label>
              <select className="form-control" value={nonStressTestResult} onChange={(e) => setNonStressTestResult(e.target.value as any)}>
                <option value="reactive">Reactive (Reassuring)</option>
                <option value="non_reactive">Non-Reactive (Atypical)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>BPP Score (/10)</label>
              <input
                type="number"
                min="0"
                max="10"
                className="form-control"
                value={biophysicalProfileScore}
                onChange={(e) => setBiophysicalProfileScore(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          {/* Modified Bishop Score Examination */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#047857', fontSize: '0.85rem', marginBottom: 8 }}>
              📐 Modified Bishop Score Pelvic Examination (0 - 13 Points)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Dilation (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  className="form-control"
                  value={cervicalDilationCm}
                  onChange={(e) => setCervicalDilationCm(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Effacement (%)</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  max="100"
                  className="form-control"
                  value={cervicalEffacementPct}
                  onChange={(e) => setCervicalEffacementPct(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Station (-3 to +3)</label>
                <select className="form-control" value={fetalStation} onChange={(e) => setFetalStation(Number(e.target.value))}>
                  <option value="-3">-3 (High floating)</option>
                  <option value="-2">-2</option>
                  <option value="-1">-1</option>
                  <option value="0">0 (Ischial spines)</option>
                  <option value="1">+1</option>
                  <option value="2">+2</option>
                  <option value="3">+3 (Perineum)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Consistency</label>
                <select className="form-control" value={cervicalConsistency} onChange={(e) => setCervicalConsistency(e.target.value as any)}>
                  <option value="firm">Firm (0 pt)</option>
                  <option value="medium">Medium (1 pt)</option>
                  <option value="soft">Soft (2 pt)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Position</label>
                <select className="form-control" value={cervicalPosition} onChange={(e) => setCervicalPosition(e.target.value as any)}>
                  <option value="posterior">Posterior (0 pt)</option>
                  <option value="midposition">Midposition (1 pt)</option>
                  <option value="anterior">Anterior (2 pt)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Safety Check: Prior Cesarean Section */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.85rem', color: priorCesareanSection ? '#dc2626' : 'inherit' }}>
              <input
                type="checkbox"
                checked={priorCesareanSection}
                onChange={(e) => setPriorCesareanSection(e.target.checked)}
              />
              Prior Cesarean Section (Uterine Scar Present) — STRICTLY CONTRAINDICATES PROSTAGLANDINS
            </label>
          </div>

          {/* Live Preview Card */}
          {preview && (
            <div
              style={{
                background: preview.oligohydramniosPresent ? '#fef2f2' : '#f0fdf4',
                borderLeft: `4px solid ${preview.oligohydramniosPresent ? '#ef4444' : '#10b981'}`,
                padding: 12,
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.oligohydramniosPresent ? '#b91c1c' : '#047857' }}>
                  {preview.summary}
                </strong>
                <span
                  className="badge"
                  style={{
                    background: preview.bishop.isFavorable ? '#10b981' : '#f59e0b',
                    color: '#fff',
                    padding: '4px 8px',
                  }}
                >
                  Bishop: {preview.bishop.totalScore}/13 ({preview.bishop.isFavorable ? 'Favorable >6' : 'Unfavorable ≤6'})
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: 8 }}>
                <strong>Recommended Method:</strong> {preview.recommendedRipeningMethod.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4 }}>
                {preview.ripeningGuidance}
              </div>
              {preview.contraindicationsNote && (
                <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: 6, fontWeight: 600 }}>
                  {preview.contraindicationsNote}
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Management Status</label>
            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="outpatient_surveillance">Outpatient Antenatal Surveillance</option>
              <option value="inpatient_cervical_ripening">Inpatient Cervical Ripening Active</option>
              <option value="oxytocin_labor_induction">Oxytocin Labor Induction</option>
              <option value="cesarean_delivery">Cesarean Delivery</option>
              <option value="postpartum_completed">Postpartum Completed</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes & Induction Plan</label>
            <textarea
              className="form-control"
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#047857', borderColor: '#065f46' }} disabled={loading}>
              {loading ? 'Recording...' : 'Save Post-Term Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
