import React, { useState, useEffect } from 'react';
import { createPediatricCroupEpisode, calculatePediatricCroup } from '../api';

interface PediatricCroupModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricCroupModal: React.FC<PediatricCroupModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [triageDatetime, setTriageDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(18);
  const [weightKg, setWeightKg] = useState(11.5);

  const [inspiratoryStridorScore, setInspiratoryStridorScore] = useState<0 | 1 | 2>(1);
  const [retractionsScore, setRetractionsScore] = useState<0 | 1 | 2 | 3>(2);
  const [airEntryScore, setAirEntryScore] = useState<0 | 1 | 2>(1);
  const [cyanosisScore, setCyanosisScore] = useState<0 | 4 | 5>(0);
  const [consciousnessScore, setConsciousnessScore] = useState<0 | 5>(0);

  const [heartRateBpm, setHeartRateBpm] = useState(136);
  const [respiratoryRate, setRespiratoryRate] = useState(38);
  const [spo2Percent, setSpo2Percent] = useState(96);
  const [barkingCoughPresent, setBarkingCoughPresent] = useState(true);
  const [hoarsenessPresent, setHoarsenessPresent] = useState(true);

  const [dexamethasoneRoute, setDexamethasoneRoute] = useState<'oral' | 'im' | 'iv'>('oral');
  const [dexamethasoneAdministered, setDexamethasoneAdministered] = useState(true);
  const [epinephrineNebulizationAdministered, setEpinephrineNebulizationAdministered] = useState(true);

  const [status, setStatus] = useState<string>('acute_triage_resuscitation');
  const [clinicalNotes, setClinicalNotes] = useState('Child presents with seal-like barking cough, inspiratory stridor, and intercostal retractions. Dexamethasone oral dose and nebulized epinephrine given.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculatePediatricCroup({
      ageMonths: Number(ageMonths),
      weightKg: Number(weightKg),
      inspiratoryStridorScore,
      retractionsScore,
      airEntryScore,
      cyanosisScore,
      consciousnessScore,
      heartRateBpm: Number(heartRateBpm),
      respiratoryRate: Number(respiratoryRate),
      spo2Percent: Number(spo2Percent),
      barkingCoughPresent,
      hoarsenessPresent,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    ageMonths,
    weightKg,
    inspiratoryStridorScore,
    retractionsScore,
    airEntryScore,
    cyanosisScore,
    consciousnessScore,
    heartRateBpm,
    respiratoryRate,
    spo2Percent,
    barkingCoughPresent,
    hoarsenessPresent,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createPediatricCroupEpisode({
        patientId,
        triageDatetime,
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        inspiratoryStridorScore,
        retractionsScore,
        airEntryScore,
        cyanosisScore,
        consciousnessScore,
        heartRateBpm: Number(heartRateBpm),
        respiratoryRate: Number(respiratoryRate),
        spo2Percent: Number(spo2Percent),
        barkingCoughPresent,
        hoarsenessPresent,
        dexamethasoneRoute,
        dexamethasoneAdministered,
        epinephrineNebulizationAdministered,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record pediatric croup triage evaluation');
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
          <h3 style={{ margin: 0, color: '#0284c7' }}>
            🌬️ Pediatric Croup & Westley Score Protocol: {patientName}
          </h3>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Triage Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Triage Date/Time</label>
              <input
                type="datetime-local"
                className="form-control"
                value={triageDatetime}
                onChange={(e) => setTriageDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Age (Months)</label>
              <input
                type="number"
                min="1"
                max="216"
                className="form-control"
                value={ageMonths}
                onChange={(e) => setAgeMonths(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="2.0"
                max="100.0"
                className="form-control"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Westley Croup Score Components */}
          <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 6, border: '1px solid #bae6fd', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#0369a1', fontSize: '0.85rem', marginBottom: 8 }}>
              📐 Westley Clinical Croup Score Assessment (0 - 17 Points)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Inspiratory Stridor</label>
                <select
                  className="form-control"
                  value={inspiratoryStridorScore}
                  onChange={(e) => setInspiratoryStridorScore(Number(e.target.value) as any)}
                >
                  <option value={0}>0 - None</option>
                  <option value={1}>1 - With agitation / crying</option>
                  <option value={2}>2 - Present at rest</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Chest Wall Retractions</label>
                <select
                  className="form-control"
                  value={retractionsScore}
                  onChange={(e) => setRetractionsScore(Number(e.target.value) as any)}
                >
                  <option value={0}>0 - None</option>
                  <option value={1}>1 - Mild (subcostal)</option>
                  <option value={2}>2 - Moderate (intercostal)</option>
                  <option value={3}>3 - Severe (sternal indrawing)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Air Entry (Auscultation)</label>
                <select
                  className="form-control"
                  value={airEntryScore}
                  onChange={(e) => setAirEntryScore(Number(e.target.value) as any)}
                >
                  <option value={0}>0 - Normal bilateral</option>
                  <option value={1}>1 - Decreased</option>
                  <option value={2}>2 - Markedly decreased / silent</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cyanosis</label>
                <select
                  className="form-control"
                  value={cyanosisScore}
                  onChange={(e) => setCyanosisScore(Number(e.target.value) as any)}
                >
                  <option value={0}>0 - None</option>
                  <option value={4}>4 - With agitation</option>
                  <option value={5}>5 - Cyanosis at rest</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Level of Consciousness</label>
                <select
                  className="form-control"
                  value={consciousnessScore}
                  onChange={(e) => setConsciousnessScore(Number(e.target.value) as any)}
                >
                  <option value={0}>0 - Normal / Alert / Interactive</option>
                  <option value={5}>5 - Disoriented / Lethargic / Restless hypoxia</option>
                </select>
              </div>
            </div>
          </div>

          {/* Vitals & Clinical Features */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Heart Rate (bpm)</label>
              <input
                type="number"
                className="form-control"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Respiratory Rate</label>
              <input
                type="number"
                className="form-control"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>SpO2 (%)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={barkingCoughPresent}
                onChange={(e) => setBarkingCoughPresent(e.target.checked)}
              />
              Barking "Seal-like" Cough Present
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={hoarsenessPresent}
                onChange={(e) => setHoarsenessPresent(e.target.checked)}
              />
              Hoarseness / Stridorous Voice
            </label>
          </div>

          {/* Live Preview Card */}
          {preview && (
            <div
              style={{
                background: preview.westley.totalScore >= 6 ? '#fef2f2' : '#f0f9ff',
                borderLeft: `4px solid ${preview.westley.totalScore >= 6 ? '#ef4444' : '#0284c7'}`,
                padding: 12,
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.westley.totalScore >= 6 ? '#b91c1c' : '#0369a1' }}>
                  {preview.summary}
                </strong>
                <span
                  className="badge"
                  style={{
                    background: preview.westley.totalScore >= 6 ? '#ef4444' : preview.westley.totalScore >= 3 ? '#f59e0b' : '#10b981',
                    color: '#fff',
                    padding: '4px 8px',
                  }}
                >
                  Westley: {preview.westley.totalScore}/17
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8, fontSize: '0.85rem' }}>
                <div>
                  <strong>Dexamethasone Dose:</strong>{' '}
                  <span style={{ color: '#0369a1', fontWeight: 700 }}>{preview.dexamethasoneDoseMg} mg</span> ({preview.dexamethasoneRoute.toUpperCase()})
                </div>
                <div>
                  <strong>Nebulized Epinephrine:</strong>{' '}
                  {preview.nebulizedEpinephrineIndicated ? (
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>
                      {preview.epinephrineNebulizationDoseMl} mL (1:1000)
                    </span>
                  ) : (
                    'Not indicated for mild croup'
                  )}
                </div>
              </div>
              {preview.criticalAirwayWarning && (
                <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: 6, fontWeight: 700 }}>
                  {preview.criticalAirwayWarning}
                </div>
              )}
            </div>
          )}

          {/* Dexamethasone Route & Administration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dexamethasone Route</label>
              <select
                className="form-control"
                value={dexamethasoneRoute}
                onChange={(e) => setDexamethasoneRoute(e.target.value as any)}
              >
                <option value="oral">Oral (Preferred)</option>
                <option value="im">Intramuscular (IM)</option>
                <option value="iv">Intravenous (IV)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dexamethasone Given?</label>
              <select
                className="form-control"
                value={dexamethasoneAdministered ? 'yes' : 'no'}
                onChange={(e) => setDexamethasoneAdministered(e.target.value === 'yes')}
              >
                <option value="yes">Yes - Administered</option>
                <option value="no">No - Pending</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Epi Nebulizer Given?</label>
              <select
                className="form-control"
                value={epinephrineNebulizationAdministered ? 'yes' : 'no'}
                onChange={(e) => setEpinephrineNebulizationAdministered(e.target.value === 'yes')}
              >
                <option value="yes">Yes - Administered</option>
                <option value="no">No - Not given</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="acute_triage_resuscitation">Acute Triage & Resuscitation</option>
              <option value="post_nebulization_observation">Post-Nebulization Observation (2-4h)</option>
              <option value="picu_admission_escalation">PICU Admission Escalation</option>
              <option value="discharged_home_stable">Discharged Home Stable</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes</label>
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
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#0284c7', borderColor: '#0369a1' }} disabled={loading}>
              {loading ? 'Recording...' : 'Save Croup Triage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
