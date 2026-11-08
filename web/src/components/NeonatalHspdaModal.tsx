import React, { useState, useEffect } from 'react';
import { createNeonatalHspdaEpisode, calculateNeonatalHspda } from '../api';

interface NeonatalHspdaModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalHspdaModal: React.FC<NeonatalHspdaModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [echoDatetime, setEchoDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(27.5);
  const [birthWeightGrams, setBirthWeightGrams] = useState(920);
  const [chronologicalAgeDays, setChronologicalAgeDays] = useState(5);
  const [currentWeightGrams, setCurrentWeightGrams] = useState(950);

  // Echo parameters
  const [ductalDiameterMm, setDuctalDiameterMm] = useState(2.2);
  const [ductalVelocityVmaxMs, setDuctalVelocityVmaxMs] = useState(1.4);
  const [shuntDirection, setShuntDirection] = useState<'left_to_right' | 'bidirectional' | 'right_to_left'>('left_to_right');
  const [laAoRatio, setLaAoRatio] = useState(1.6);
  const [lpaDiastolicVelocityMs, setLpaDiastolicVelocityMs] = useState(0.24);
  const [descendingAortaDiastolicFlow, setDescendingAortaDiastolicFlow] = useState<'antegrade_normal' | 'absent_diastolic' | 'retrograde_steal'>('retrograde_steal');

  // Clinical signs
  const [cardiomegalyPresent, setCardiomegalyPresent] = useState(true);
  const [pulmonaryEdemaPresent, setPulmonaryEdemaPresent] = useState(true);
  const [boundingPulses, setBoundingPulses] = useState(true);
  const [hypotensionWidePulsePressure, setHypotensionWidePulsePressure] = useState(true);
  const [metabolicAcidosis, setMetabolicAcidosis] = useState(false);
  const [oliguriaPresent, setOliguriaPresent] = useState(false);
  const [respiratorySupportEscalation, setRespiratorySupportEscalation] = useState(true);

  // Safety & Therapy
  const [plateletCount, setPlateletCount] = useState<number | ''>(42000);
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<number | ''>(1.1);
  const [pharmacotherapySelected, setPharmacotherapySelected] = useState<string>('iv_paracetamol');
  const [paracetamolRationale, setParacetamolRationale] = useState('Thrombocytopenia (platelets < 50,000/uL) contraindicates NSAIDs.');
  const [interventionalReferral, setInterventionalReferral] = useState<'none' | 'catheter_closure' | 'surgical_ligation'>('none');
  const [status, setStatus] = useState('medical_therapy_active');
  const [clinicalNotes, setClinicalNotes] = useState('Infant with ventilator escalation and pulmonary edema. Echo confirms large hsPDA with retrograde ductal steal.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute live staging preview
  useEffect(() => {
    calculateNeonatalHspda({
      gestationalAgeWeeks,
      birthWeightGrams,
      chronologicalAgeDays,
      currentWeightGrams,
      ductalDiameterMm,
      ductalVelocityVmaxMs,
      shuntDirection,
      laAoRatio,
      lpaDiastolicVelocityMs,
      descendingAortaDiastolicFlow,
      cardiomegalyPresent,
      pulmonaryEdemaPresent,
      boundingPulses,
      hypotensionWidePulsePressure,
      metabolicAcidosis,
      oliguriaPresent,
      respiratorySupportEscalation,
      plateletCount: plateletCount === '' ? undefined : Number(plateletCount),
      serumCreatinineMgDl: serumCreatinineMgDl === '' ? undefined : Number(serumCreatinineMgDl),
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult.recommendedTherapy) {
          setPharmacotherapySelected(res.evalResult.recommendedTherapy);
        }
      })
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    chronologicalAgeDays,
    currentWeightGrams,
    ductalDiameterMm,
    ductalVelocityVmaxMs,
    shuntDirection,
    laAoRatio,
    lpaDiastolicVelocityMs,
    descendingAortaDiastolicFlow,
    cardiomegalyPresent,
    pulmonaryEdemaPresent,
    boundingPulses,
    hypotensionWidePulsePressure,
    metabolicAcidosis,
    oliguriaPresent,
    respiratorySupportEscalation,
    plateletCount,
    serumCreatinineMgDl,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createNeonatalHspdaEpisode({
        patientId,
        echoDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightGrams: Number(birthWeightGrams),
        chronologicalAgeDays: Number(chronologicalAgeDays),
        currentWeightGrams: Number(currentWeightGrams),
        ductalDiameterMm: Number(ductalDiameterMm),
        ductalVelocityVmaxMs: Number(ductalVelocityVmaxMs),
        shuntDirection,
        laAoRatio: Number(laAoRatio),
        lpaDiastolicVelocityMs: Number(lpaDiastolicVelocityMs),
        descendingAortaDiastolicFlow,
        cardiomegalyPresent,
        pulmonaryEdemaPresent,
        boundingPulses,
        hypotensionWidePulsePressure,
        metabolicAcidosis,
        oliguriaPresent,
        respiratorySupportEscalation,
        pharmacotherapySelected,
        paracetamolRationale: paracetamolRationale || null,
        contraindicationsPresent: preview?.nsaidContraindicated ?? false,
        interventionalReferral,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record hsPDA evaluation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 840, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#1e3a8a' }}>🫀 Neonatal hsPDA Echocardiographic Staging & Pharmacotherapy</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              McNamara & Sehgal (2007) / El-Khuffash hsPDA Protocol for {patientName}
            </span>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Demographics & Echo Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Echo Datetime</label>
              <input type="datetime-local" className="form-control" value={echoDatetime} onChange={(e) => setEchoDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Birth GA (weeks)</label>
              <input type="number" step="0.1" className="form-control" value={gestationalAgeWeeks} onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Birth Weight (g)</label>
              <input type="number" className="form-control" value={birthWeightGrams} onChange={(e) => setBirthWeightGrams(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Current Weight (g)</label>
              <input type="number" className="form-control" value={currentWeightGrams} onChange={(e) => setCurrentWeightGrams(Number(e.target.value))} required />
            </div>
          </div>

          {/* Section 2: Echocardiographic Markers */}
          <div style={{ background: '#eff6ff', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #bfdbfe' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#1e40af', fontSize: '0.9rem' }}>Echocardiographic Shunt Parameters</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Transductal Diameter (mm)</label>
                <input type="number" step="0.1" className="form-control" value={ductalDiameterMm} onChange={(e) => setDuctalDiameterMm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>LA : Ao Ratio</label>
                <input type="number" step="0.05" className="form-control" value={laAoRatio} onChange={(e) => setLaAoRatio(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Shunt Direction</label>
                <select className="form-control" value={shuntDirection} onChange={(e) => setShuntDirection(e.target.value as any)}>
                  <option value="left_to_right">Left-to-Right (Systemic to Pulmonary)</option>
                  <option value="bidirectional">Bidirectional (High PVR)</option>
                  <option value="right_to_left">Right-to-Left (Severe PPHN)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Desc. Aorta Diastolic Flow</label>
                <select className="form-control" value={descendingAortaDiastolicFlow} onChange={(e) => setDescendingAortaDiastolicFlow(e.target.value as any)}>
                  <option value="antegrade_normal">Normal Antegrade Diastolic Flow</option>
                  <option value="absent_diastolic">Absent End-Diastolic Flow</option>
                  <option value="retrograde_steal">Retrograde Diastolic Steal (High Volume)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>LPA Diastolic Vel (m/s)</label>
                <input type="number" step="0.01" className="form-control" value={lpaDiastolicVelocityMs} onChange={(e) => setLpaDiastolicVelocityMs(Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Peak Ductal Velocity (m/s)</label>
                <input type="number" step="0.1" className="form-control" value={ductalVelocityVmaxMs} onChange={(e) => setDuctalVelocityVmaxMs(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Section 3: Clinical & Hemodynamic Markers */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#334155' }}>Clinical & Hemodynamic Signs</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.85rem' }}>
              <label><input type="checkbox" checked={boundingPulses} onChange={(e) => setBoundingPulses(e.target.checked)} /> Bounding Peripheral Pulses</label>
              <label><input type="checkbox" checked={hypotensionWidePulsePressure} onChange={(e) => setHypotensionWidePulsePressure(e.target.checked)} /> Wide Pulse Pressure / Hypotension</label>
              <label><input type="checkbox" checked={pulmonaryEdemaPresent} onChange={(e) => setPulmonaryEdemaPresent(e.target.checked)} /> Pulmonary Edema / Hyperemia</label>
              <label><input type="checkbox" checked={cardiomegalyPresent} onChange={(e) => setCardiomegalyPresent(e.target.checked)} /> Cardiomegaly (CTR &gt; 60%)</label>
              <label><input type="checkbox" checked={respiratorySupportEscalation} onChange={(e) => setRespiratorySupportEscalation(e.target.checked)} /> Escalating Ventilator Support</label>
              <label><input type="checkbox" checked={oliguriaPresent} onChange={(e) => setOliguriaPresent(e.target.checked)} /> Oliguria (&lt; 1.0 mL/kg/hr)</label>
              <label><input type="checkbox" checked={metabolicAcidosis} onChange={(e) => setMetabolicAcidosis(e.target.checked)} /> Metabolic Acidosis / High Lactate</label>
            </div>
          </div>

          {/* Section 4: Safety & Labs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Platelets (/uL)</label>
              <input type="number" className="form-control" value={plateletCount} onChange={(e) => setPlateletCount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 150000" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Creatinine (mg/dL)</label>
              <input type="number" step="0.1" className="form-control" value={serumCreatinineMgDl} onChange={(e) => setSerumCreatinineMgDl(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 0.9" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pharmacotherapy</label>
              <select className="form-control" value={pharmacotherapySelected} onChange={(e) => setPharmacotherapySelected(e.target.value)}>
                <option value="none_conservative">None (Conservative Care)</option>
                <option value="iv_ibuprofen">IV Ibuprofen (Standard Course)</option>
                <option value="iv_indomethacin">IV Indomethacin</option>
                <option value="iv_paracetamol">IV Paracetamol (NSAID Alternative)</option>
                <option value="contraindicated">Contraindicated</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Interventional Referral</label>
              <select className="form-control" value={interventionalReferral} onChange={(e) => setInterventionalReferral(e.target.value as any)}>
                <option value="none">None</option>
                <option value="catheter_closure">Catheter Device Occlusion</option>
                <option value="surgical_ligation">Surgical Ligation</option>
              </select>
            </div>
          </div>

          {preview && (
            <div style={{ background: preview.hspdaConfirmed ? '#fef2f2' : '#f0fdf4', border: `1px solid ${preview.hspdaConfirmed ? '#ef4444' : '#86efac'}`, padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.hspdaConfirmed ? '#991b1b' : '#166534', fontSize: '0.95rem' }}>
                  {preview.summary}
                </strong>
                <span className={`badge ${preview.hspdaConfirmed ? 'badge-danger' : 'badge-success'}`}>
                  {preview.hspdaConfirmed ? 'hsPDA CONFIRMED' : 'NON-SIGNIFICANT'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8, fontSize: '0.85rem' }}>
                <div><strong>Echocardiographic:</strong> {preview.echoStageLabel}</div>
                <div><strong>Clinical Hemodynamic:</strong> {preview.clinicalStageLabel}</div>
              </div>
              {preview.nsaidContraindicated && (
                <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#dc2626' }}>
                  ⚠️ NSAID Contraindications: {preview.contraindicationReasons.join('; ')}
                </div>
              )}
              {preview.paracetamolRecommendedAsAlternative && (
                <div style={{ marginTop: 4, fontSize: '0.82rem', color: '#1d4ed8' }}>
                  💡 {preview.paracetamolRegimen}
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes & Management Plan</label>
            <textarea className="form-control" rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save hsPDA Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
