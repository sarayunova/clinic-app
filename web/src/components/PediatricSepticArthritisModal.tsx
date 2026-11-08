import React, { useState, useEffect } from 'react';
import { createPediatricSepticArthritisEpisode, calculatePediatricSepticArthritis } from '../api';

interface PediatricSepticArthritisModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricSepticArthritisModal: React.FC<PediatricSepticArthritisModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [evaluationDatetime, setEvaluationDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(36);
  const [weightKg, setWeightKg] = useState(14.5);
  const [affectedJoint, setAffectedJoint] = useState<string>('right_hip');

  // Kocher Criteria
  const [nonWeightBearing, setNonWeightBearing] = useState(true);
  const [temperatureCelsius, setTemperatureCelsius] = useState(38.8);
  const [esrMmHr, setEsrMmHr] = useState(46);
  const [wbcCountPerMicroliter, setWbcCountPerMicroliter] = useState(14200);
  const [crpMgL, setCrpMgL] = useState<number | ''>(45.0);

  // Ultrasound & Arthrocentesis
  const [ultrasoundEffusionDetected, setUltrasoundEffusionDetected] = useState(true);
  const [arthrocentesisPerformed, setArthrocentesisPerformed] = useState(true);
  const [synovialWbcCount, setSynovialWbcCount] = useState<number | ''>(72000);
  const [synovialPmnPct, setSynovialPmnPct] = useState<number | ''>(86.0);
  const [synovialGramStain, setSynovialGramStain] = useState<string>('gram_positive_cocci');

  // Surgical Management & Antibiotics
  const [surgicalDrainageRequired, setSurgicalDrainageRequired] = useState(true);
  const [surgicalApproach, setSurgicalApproach] = useState<string>('arthrotomy_open_capsulotomy');
  const [empiricAntibioticRegimen, setEmpiricAntibioticRegimen] = useState<string>('cefazolin_iv');
  const [status, setStatus] = useState<string>('operating_room_arthrotomy');
  const [clinicalNotes, setClinicalNotes] = useState(
    'Acute right hip pseudoparalysis, high fever (38.8 C), ESR 46, WBC 14.2k (Kocher 4/4 = 99.6% septic arthritis risk). POCUS hip demonstrates 6 mm anterior capsular distension. Ultrasound-guided tap purulent (72k WBC, 86% PMN). Scheduled for emergent open arthrotomy & capsulotomy.',
  );

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculatePediatricSepticArthritis({
      ageMonths: Number(ageMonths),
      weightKg: Number(weightKg),
      affectedJoint,
      nonWeightBearing,
      temperatureCelsius: Number(temperatureCelsius),
      esrMmHr: Number(esrMmHr),
      wbcCountPerMicroliter: Number(wbcCountPerMicroliter),
      crpMgL: crpMgL === '' ? undefined : Number(crpMgL),
      ultrasoundEffusionDetected,
      arthrocentesisPerformed,
      synovialWbcCount: synovialWbcCount === '' ? undefined : Number(synovialWbcCount),
      synovialPmnPct: synovialPmnPct === '' ? undefined : Number(synovialPmnPct),
      synovialGramStain,
      surgicalDrainageRequired,
      surgicalApproach,
      empiricAntibioticRegimen,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    ageMonths,
    weightKg,
    affectedJoint,
    nonWeightBearing,
    temperatureCelsius,
    esrMmHr,
    wbcCountPerMicroliter,
    crpMgL,
    ultrasoundEffusionDetected,
    arthrocentesisPerformed,
    synovialWbcCount,
    synovialPmnPct,
    synovialGramStain,
    surgicalDrainageRequired,
    surgicalApproach,
    empiricAntibioticRegimen,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createPediatricSepticArthritisEpisode({
        patientId,
        evaluationDatetime: new Date(evaluationDatetime).toISOString(),
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        affectedJoint,
        nonWeightBearing,
        temperatureCelsius: Number(temperatureCelsius),
        esrMmHr: Number(esrMmHr),
        wbcCountPerMicroliter: Number(wbcCountPerMicroliter),
        crpMgL: crpMgL === '' ? undefined : Number(crpMgL),
        ultrasoundEffusionDetected,
        arthrocentesisPerformed,
        synovialWbcCount: synovialWbcCount === '' ? undefined : Number(synovialWbcCount),
        synovialPmnPct: synovialPmnPct === '' ? undefined : Number(synovialPmnPct),
        synovialGramStain,
        surgicalDrainageRequired,
        surgicalApproach,
        empiricAntibioticRegimen,
        status,
        clinicalNotes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate pediatric septic arthritis episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#b91c1c' }}>
            🦴 Pediatric Septic Arthritis &amp; Kocher Criteria Protocol
          </h2>
          <button className="button small" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Patient: <strong>{patientName}</strong> | Reference: Kocher MS et al. (JBJS) &amp; AAP Pediatric Orthopedics
        </p>

        {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Patient Details & Joint Location */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label>Evaluation Datetime *</label>
              <input
                type="datetime-local"
                value={evaluationDatetime}
                onChange={(e) => setEvaluationDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Age (months) *</label>
              <input
                type="number"
                min="1"
                max="216"
                value={ageMonths}
                onChange={(e) => setAgeMonths(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Weight (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="2.0"
                max="120.0"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Affected Joint *</label>
              <select value={affectedJoint} onChange={(e) => setAffectedJoint(e.target.value)}>
                <option value="right_hip">Right Hip (High Tamponade Risk)</option>
                <option value="left_hip">Left Hip (High Tamponade Risk)</option>
                <option value="right_knee">Right Knee</option>
                <option value="left_knee">Left Knee</option>
                <option value="right_ankle">Right Ankle</option>
                <option value="left_ankle">Left Ankle</option>
                <option value="other_joint">Other Joint</option>
              </select>
            </div>
          </div>

          {/* 4 Kocher Criteria Box */}
          <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#991b1b' }}>
              The 4 Kocher Clinical &amp; Laboratory Predictors
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label>Oral/Core Temp (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="34.0"
                  max="43.0"
                  value={temperatureCelsius}
                  onChange={(e) => setTemperatureCelsius(Number(e.target.value))}
                  required
                />
                <span className="small muted">Criterion: &gt; 38.5°C</span>
              </div>
              <div>
                <label>ESR (mm/hr) *</label>
                <input
                  type="number"
                  min="0"
                  max="150"
                  value={esrMmHr}
                  onChange={(e) => setEsrMmHr(Number(e.target.value))}
                  required
                />
                <span className="small muted">Criterion: ≥ 40 mm/hr</span>
              </div>
              <div>
                <label>Serum WBC (/μL) *</label>
                <input
                  type="number"
                  min="500"
                  max="80000"
                  value={wbcCountPerMicroliter}
                  onChange={(e) => setWbcCountPerMicroliter(Number(e.target.value))}
                  required
                />
                <span className="small muted">Criterion: &gt; 12,000 /μL</span>
              </div>
              <div>
                <label>CRP (mg/L)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 45"
                  value={crpMgL}
                  onChange={(e) => setCrpMgL(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="small muted">Modern: &gt; 20 mg/L</span>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={nonWeightBearing}
                  onChange={(e) => setNonWeightBearing(e.target.checked)}
                />
                <span>Criterion 1: Complete Inability to Bear Weight / Refusal to Walk / Pseudoparalysis</span>
              </label>
            </div>
          </div>

          {/* Ultrasound & Arthrocentesis */}
          <div className="card" style={{ background: '#f8fafc', padding: 12, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#334155' }}>
              Joint Ultrasound &amp; Synovial Fluid Diagnostics
            </h4>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ultrasoundEffusionDetected}
                  onChange={(e) => setUltrasoundEffusionDetected(e.target.checked)}
                />
                <span>Ultrasound Capsule Effusion Confirmed (&gt; 2 mm Asymmetry)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={arthrocentesisPerformed}
                  onChange={(e) => setArthrocentesisPerformed(e.target.checked)}
                />
                <span>Arthrocentesis (Joint Aspiration) Performed</span>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label>Synovial WBC (/μL)</label>
                <input
                  type="number"
                  placeholder="e.g. 65000"
                  value={synovialWbcCount}
                  onChange={(e) => setSynovialWbcCount(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="small muted">Cutoff: &gt; 50,000 /μL</span>
              </div>
              <div>
                <label>Synovial PMN (%)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 85"
                  value={synovialPmnPct}
                  onChange={(e) => setSynovialPmnPct(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="small muted">Cutoff: &gt; 75% PMNs</span>
              </div>
              <div>
                <label>Synovial Gram Stain</label>
                <select value={synovialGramStain} onChange={(e) => setSynovialGramStain(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="gram_positive_cocci">Gram-Positive Cocci (S. aureus / Strep)</option>
                  <option value="gram_negative_bacilli">Gram-Negative Bacilli (Kingella / Enteric)</option>
                  <option value="no_organisms_seen">No Organisms Seen</option>
                </select>
              </div>
            </div>
          </div>

          {/* Surgical & Antibiotics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label>Surgical Approach</label>
              <select value={surgicalApproach} onChange={(e) => setSurgicalApproach(e.target.value)}>
                <option value="none">None / Observation Only</option>
                <option value="arthrotomy_open_capsulotomy">Open Arthrotomy &amp; Capsulotomy</option>
                <option value="arthroscopic_lavage">Arthroscopic Decompression &amp; Lavage</option>
                <option value="needle_aspiration_serial">Serial Needle Aspiration</option>
              </select>
            </div>
            <div>
              <label>Empiric Antibiotic Regimen</label>
              <select value={empiricAntibioticRegimen} onChange={(e) => setEmpiricAntibioticRegimen(e.target.value)}>
                <option value="none">None</option>
                <option value="cefazolin_iv">IV Cefazolin (First-line MSSA)</option>
                <option value="vancomycin_iv">IV Vancomycin (MRSA Prevalent)</option>
                <option value="ceftriaxone_plus_vancomycin">IV Ceftriaxone + Vancomycin (&lt; 3mo)</option>
                <option value="clindamycin_iv">IV Clindamycin</option>
              </select>
            </div>
            <div>
              <label>Episode Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="evaluation_pending">Evaluation Pending</option>
                <option value="operating_room_arthrotomy">Operating Room / Arthrotomy</option>
                <option value="postoperative_iv_antibiotics">Postoperative IV Antibiotics</option>
                <option value="transient_synovitis_observed">Transient Synovitis Observed</option>
                <option value="infection_resolved_discharged">Infection Resolved &amp; Discharged</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={surgicalDrainageRequired}
                onChange={(e) => setSurgicalDrainageRequired(e.target.checked)}
              />
              <strong>Urgent Surgical Drainage Required (Surgical Emergency)</strong>
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Clinical Notes &amp; Operative Plan</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record joint range of motion restriction, POCUS findings, orthopedic consult, and surgical timeline..."
            />
          </div>

          {/* Live Kocher Score Preview */}
          {preview && (
            <div
              className="card"
              style={{
                background: preview.kocherResult.criteriaMetCount >= 3 ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${preview.kocherResult.criteriaMetCount >= 3 ? '#fca5a5' : '#86efac'}`,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.kocherResult.criteriaMetCount >= 3 ? '#dc2626' : '#16a34a' }}>
                  {preview.kocherResult.probabilityLabel}
                </strong>
                <span className="badge" style={{ background: '#b91c1c', color: '#fff' }}>
                  Kocher: {preview.kocherResult.criteriaMetCount} / 4
                </span>
              </div>
              <div style={{ fontSize: 13, marginTop: 6, color: '#334155' }}>
                Orthopedic Urgency: <strong>{preview.orthopedicConsultUrgency.replace(/_/g, ' ').toUpperCase()}</strong>
              </div>
              {preview.surgicalEmergencyIndicated && (
                <div style={{ color: '#b91c1c', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                  🚨 SURGICAL EMERGENCY: Decompress joint capsular pressure within 24 hours to prevent femoral head avascular necrosis!
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="button secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Saving...' : 'Initiate Septic Arthritis Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
