import React, { useState, useEffect } from 'react';
import { calculatePediatricAsthma, createPediatricAsthmaEpisode } from '../api';

interface Props {
  patientId: number;
  ageMonths?: number;
  weightKg?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricAsthmaStatusModal: React.FC<Props> = ({
  patientId,
  ageMonths = 48,
  weightKg = 16.0,
  onClose,
  onSaved,
}) => {
  const [ageM, setAgeM] = useState(ageMonths);
  const [weight, setWeight] = useState(weightKg);
  const [onsetDatetime, setOnsetDatetime] = useState(new Date().toISOString().slice(0, 16));

  // M-WCAS Parameters
  const [spo2RoomAir, setSpo2RoomAir] = useState(91);
  const [wheezingScore, setWheezingScore] = useState(1);
  const [retractionsScore, setRetractionsScore] = useState(2);
  const [airEntryScore, setAirEntryScore] = useState(1);
  const [mentalStateScore, setMentalStateScore] = useState(1);

  // Pharmacologic Interventions
  const [continuousAlbuterol, setContinuousAlbuterol] = useState(true);
  const [ipratropium, setIpratropium] = useState(true);
  const [systemicSteroids, setSystemicSteroids] = useState(true);
  const [ivMagnesium, setIvMagnesium] = useState(true);
  const [ivTerbutaline, setIvTerbutaline] = useState(false);
  const [respiratorySupport, setRespiratorySupport] = useState<'none' | 'hfnc' | 'bipap_nippv' | 'heliox' | 'invasive_mechanical_ventilation'>('none');

  // VBG
  const [vbgPh, setVbgPh] = useState<number | ''>(7.32);
  const [vbgPco2, setVbgPco2] = useState<number | ''>(38);

  const [status, setStatus] = useState('acute_ed_treatment');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    void calculatePediatricAsthma({
      ageMonths: ageM,
      weightKg: weight,
      spo2RoomAirPercent: spo2RoomAir,
      wheezingScore,
      retractionsScore,
      airEntryScore,
      mentalStateScore,
      vbgPh: vbgPh === '' ? undefined : Number(vbgPh),
      vbgPco2Mmhg: vbgPco2 === '' ? undefined : Number(vbgPco2),
    }).then((res) => setPreview(res.evalResult));
  }, [
    ageM,
    weight,
    spo2RoomAir,
    wheezingScore,
    retractionsScore,
    airEntryScore,
    mentalStateScore,
    vbgPh,
    vbgPco2,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createPediatricAsthmaEpisode({
        patientId,
        onsetDatetime,
        ageMonths: Number(ageM),
        weightKg: Number(weight),
        spo2RoomAirPercent: Number(spo2RoomAir),
        wheezingScore: Number(wheezingScore),
        retractionsScore: Number(retractionsScore),
        airEntryScore: Number(airEntryScore),
        mentalStateScore: Number(mentalStateScore),
        tier1ContinuousAlbuterol: continuousAlbuterol,
        tier1Ipratropium: ipratropium,
        tier1SystemicSteroids: systemicSteroids,
        tier2IvMagnesium: ivMagnesium,
        tier3IvTerbutaline: ivTerbutaline,
        tier4RespiratorySupport: respiratorySupport,
        vbgPh: vbgPh === '' ? undefined : Number(vbgPh),
        vbgPco2Mmhg: vbgPco2 === '' ? undefined : Number(vbgPco2),
        status,
        clinicalNotes: notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save status asthmaticus episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>🫁 Pediatric Status Asthmaticus & M-WCAS Resuscitation</h2>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          {preview && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor:
                  preview.severityTier === 'severe_impending_failure_7_10'
                    ? '#fee2e2'
                    : preview.severityTier === 'moderate_4_6'
                    ? '#ffedd5'
                    : '#ecfdf5',
                borderLeft: `5px solid ${
                  preview.severityTier === 'severe_impending_failure_7_10'
                    ? '#dc2626'
                    : preview.severityTier === 'moderate_4_6'
                    ? '#f97316'
                    : '#10b981'
                }`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 16 }}>{preview.severityTitle}</strong>
                <span className="badge" style={{ fontSize: 14, fontWeight: 'bold' }}>
                  Score: {preview.totalMwcasScore} / 10
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>{preview.vbgInterpretation}</p>
              <div style={{ marginTop: 6, fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>Continuous Albuterol: <strong>{preview.albuterolContinuous.recommendedDose}</strong></span>
                <span>IV Magnesium: <strong>{preview.ivMagnesiumSulfate.recommendedDose}</strong></span>
                <span>IV Solu-Medrol: <strong>{preview.systemicSteroids.recommendedDose}</strong></span>
              </div>
            </div>
          )}

          <fieldset className="card">
            <legend>Patient Info & Onset</legend>
            <div className="grid2">
              <div>
                <label>Age (months)</label>
                <input
                  type="number"
                  min="1"
                  max="216"
                  value={ageM}
                  onChange={(e) => setAgeM(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="2.5"
                  max="120"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Onset / Triage Datetime</label>
                <input
                  type="datetime-local"
                  value={onsetDatetime}
                  onChange={(e) => setOnsetDatetime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>SpO2 on Room Air (%)</label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={spo2RoomAir}
                  onChange={(e) => setSpo2RoomAir(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Modified Wood's Clinical Asthma Score (M-WCAS: 0 - 10)</legend>
            <div className="grid2">
              <div>
                <label>Inspiratory / Expiratory Wheezing</label>
                <select value={wheezingScore} onChange={(e) => setWheezingScore(Number(e.target.value))}>
                  <option value={0}>0 - None or end-expiratory only</option>
                  <option value={1}>1 - Moderate expiratory & inspiratory</option>
                  <option value={2}>2 - Severe / Absent breath sounds (Silent Chest)</option>
                </select>
              </div>
              <div>
                <label>Accessory Muscle Use / Retractions</label>
                <select value={retractionsScore} onChange={(e) => setRetractionsScore(Number(e.target.value))}>
                  <option value={0}>0 - None or minimal intercostal</option>
                  <option value={1}>1 - Moderate subcostal & intercostal</option>
                  <option value={2}>2 - Severe with tracheal tug / sternal indrawing / head bobbing</option>
                </select>
              </div>
              <div>
                <label>Air Entry / Breath Sounds</label>
                <select value={airEntryScore} onChange={(e) => setAirEntryScore(Number(e.target.value))}>
                  <option value={0}>0 - Normal bilateral air entry</option>
                  <option value={1}>1 - Moderately decreased air entry</option>
                  <option value={2}>2 - Markedly decreased / barely audible</option>
                </select>
              </div>
              <div>
                <label>Cerebral / Mental State</label>
                <select value={mentalStateScore} onChange={(e) => setMentalStateScore(Number(e.target.value))}>
                  <option value={0}>0 - Alert, smiling, speaks in full sentences</option>
                  <option value={1}>1 - Restless, agitated, anxious, fragmented speech</option>
                  <option value={2}>2 - Lethargic, somnolent, exhausted, confused</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Pharmacologic Escalation & Blood Gas</legend>
            <div className="grid2">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={continuousAlbuterol}
                  onChange={(e) => setContinuousAlbuterol(e.target.checked)}
                />
                <span>Tier 1: Continuous Nebulized Albuterol (0.5 mg/kg/hr)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={ipratropium}
                  onChange={(e) => setIpratropium(e.target.checked)}
                />
                <span>Tier 1: Inhaled Ipratropium Bromide q20min x 3</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={systemicSteroids}
                  onChange={(e) => setSystemicSteroids(e.target.checked)}
                />
                <span>Tier 1: IV Methylprednisolone 2 mg/kg loading</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={ivMagnesium}
                  onChange={(e) => setIvMagnesium(e.target.checked)}
                />
                <span>Tier 2: IV Magnesium Sulfate 50 mg/kg over 20 min</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={ivTerbutaline}
                  onChange={(e) => setIvTerbutaline(e.target.checked)}
                />
                <span>Tier 3: IV Terbutaline Infusion (0.4 - 2.0 mcg/kg/min)</span>
              </label>
              <div>
                <label>Tier 4: Advanced Respiratory Support</label>
                <select value={respiratorySupport} onChange={(e) => setRespiratorySupport(e.target.value as any)}>
                  <option value="none">None (Standard Supplemental O2)</option>
                  <option value="hfnc">High-Flow Nasal Cannula (HFNC 1.5-2 L/kg/min)</option>
                  <option value="bipap_nippv">Non-Invasive BiPAP (IPAP 12-16, EPAP 6-8)</option>
                  <option value="heliox">Heliox (80:20 or 70:30)</option>
                  <option value="invasive_mechanical_ventilation">Invasive Mechanical Ventilation (Ketamine/Roc)</option>
                </select>
              </div>
              <div>
                <label>Venous Blood Gas pH</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 7.32"
                  value={vbgPh}
                  onChange={(e) => setVbgPh(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Venous Blood Gas pCO2 (mmHg)</label>
                <input
                  type="number"
                  placeholder="Warning if >= 42 mmHg"
                  value={vbgPco2}
                  onChange={(e) => setVbgPco2(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Episode Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="acute_ed_treatment">Acute Emergency Resuscitation</option>
                  <option value="picu_monitoring">PICU High-Dependency Monitoring</option>
                  <option value="stepdown_ward">Step-down Inpatient Ward</option>
                  <option value="discharged_resolved">Discharged / Episode Resolved</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Clinical Notes</legend>
            <textarea
              rows={3}
              placeholder="Record peak flow (if able), response to nebulizers, PICU handover..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </fieldset>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Initiate Asthma Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
