import React, { useState, useEffect } from 'react';
import { createNeonatalHypocalcemiaEpisode, calculateNeonatalHypocalcemia } from '../api';

interface NeonatalHypocalcemiaModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalHypocalcemiaModal: React.FC<NeonatalHypocalcemiaModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [diagnosisDatetime, setDiagnosisDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(30.0);
  const [birthWeightGrams, setBirthWeightGrams] = useState(1250);
  const [chronologicalAgeHours, setChronologicalAgeHours] = useState(24);
  const [currentWeightKg, setCurrentWeightKg] = useState(1.25);
  const [etiologyCategory, setEtiologyCategory] = useState<string>('prematurity_respiratory_distress');

  const [ionizedCalciumMmolL,钻IonizedCalciumMmolL] = useState(0.82);
  const [totalCalciumMgDl, setTotalCalciumMgDl] = useState(6.4);
  const [serumMagnesiumMgDl, setSerumMagnesiumMgDl] = useState(1.3);
  const [serumPhosphorusMgDl, setSerumPhosphorusMgDl] = useState<number | ''>(5.5);
  const [serumAlbuminGDl, setSerumAlbuminGDl] = useState<number | ''>(2.8);

  const [symptomsPresent, setSymptomsPresent] = useState(true);
  const [symptomDetails, setSymptomDetails] = useState<string>('jitteriness_hyperreflexia');
  const [ecgQtcSeconds, setEcgQtcSeconds] = useState<number | ''>(0.46);

  const [status, setStatus] = useState<string>('acute_iv_correction');
  const [clinicalNotes, setClinicalNotes] = useState('Marked jitteriness on stimulation. iCa 0.82 mmol/L with QTc 0.46s. IV Calcium Gluconate bolus ordered.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateNeonatalHypocalcemia({
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      birthWeightGrams: Number(birthWeightGrams),
      chronologicalAgeHours: Number(chronologicalAgeHours),
      currentWeightKg: Number(currentWeightKg),
      etiologyCategory,
      ionizedCalciumMmolL: Number(ionizedCalciumMmolL),
      totalCalciumMgDl: Number(totalCalciumMgDl),
      serumMagnesiumMgDl: Number(serumMagnesiumMgDl),
      serumPhosphorusMgDl: serumPhosphorusMgDl === '' ? undefined : Number(serumPhosphorusMgDl),
      serumAlbuminGDl: serumAlbuminGDl === '' ? undefined : Number(serumAlbuminGDl),
      symptomsPresent,
      symptomDetails,
      ecgQtcSeconds: ecgQtcSeconds === '' ? undefined : Number(ecgQtcSeconds),
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    chronologicalAgeHours,
    currentWeightKg,
    etiologyCategory,
    ionizedCalciumMmolL,
    totalCalciumMgDl,
    serumMagnesiumMgDl,
    serumPhosphorusMgDl,
    serumAlbuminGDl,
    symptomsPresent,
    symptomDetails,
    ecgQtcSeconds,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createNeonatalHypocalcemiaEpisode({
        patientId,
        diagnosisDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightGrams: Number(birthWeightGrams),
        chronologicalAgeHours: Number(chronologicalAgeHours),
        currentWeightKg: Number(currentWeightKg),
        etiologyCategory,
        ionizedCalciumMmolL: Number(ionizedCalciumMmolL),
        totalCalciumMgDl: Number(totalCalciumMgDl),
        serumMagnesiumMgDl: Number(serumMagnesiumMgDl),
        serumPhosphorusMgDl: serumPhosphorusMgDl === '' ? null : Number(serumPhosphorusMgDl),
        serumAlbuminGDl: serumAlbuminGDl === '' ? null : Number(serumAlbuminGDl),
        symptomsPresent,
        symptomDetails,
        ecgQtcSeconds: ecgQtcSeconds === '' ? null : Number(ecgQtcSeconds),
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate neonatal hypocalcemia protocol');
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
          <h3 style={{ margin: 0, color: '#b45309' }}>
            🧪 Neonatal Hypocalcemia & Electrolyte Protocol: {patientName}
          </h3>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Patient Baseline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Diagnosis Date/Time</label>
              <input
                type="datetime-local"
                className="form-control"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gestation (w)</label>
              <input
                type="number"
                step="0.1"
                min="22"
                max="44"
                className="form-control"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Age (Hours)</label>
              <input
                type="number"
                min="0"
                max="720"
                className="form-control"
                value={chronologicalAgeHours}
                onChange={(e) => setChronologicalAgeHours(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0.3"
                max="10.0"
                className="form-control"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Etiology & Risk Category</label>
            <select
              className="form-control"
              value={etiologyCategory}
              onChange={(e) => setEtiologyCategory(e.target.value)}
            >
              <option value="prematurity_respiratory_distress">Prematurity / Early Onset / RDS</option>
              <option value="infant_of_diabetic_mother_idm">Infant of Diabetic Mother (IDM)</option>
              <option value="birth_asphyxia_hie">Perinatal Asphyxia / HIE / Hypoxia</option>
              <option value="maternal_hyperparathyroidism">Maternal Hyperparathyroidism</option>
              <option value="hypoparathyroidism_digeorge">Hypoparathyroidism / DiGeorge (22q11)</option>
              <option value="high_phosphate_formula">High Phosphate Cow's Milk Formula</option>
              <option value="hypomagnesemia_induced">Primary Hypomagnesemia Induced</option>
              <option value="idiopathic_other">Idiopathic / Other</option>
            </select>
          </div>

          {/* Electrolyte Biomarkers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ionized Calcium (mmol/L)</label>
              <input
                type="number"
                step="0.01"
                min="0.2"
                max="2.5"
                className="form-control"
                value={ionizedCalciumMmolL}
                onChange={(e) =>钻IonizedCalciumMmolL(Number(e.target.value))}
                required
              />
              <small className="muted">Cutoff: &lt; 1.0 mmol/L</small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Calcium (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                min="2.0"
                max="18.0"
                className="form-control"
                value={totalCalciumMgDl}
                onChange={(e) => setTotalCalciumMgDl(Number(e.target.value))}
                required
              />
              <small className="muted">Term &lt;8.0, Preterm &lt;7.0</small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Serum Magnesium (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="5.0"
                className="form-control"
                value={serumMagnesiumMgDl}
                onChange={(e) => setSerumMagnesiumMgDl(Number(e.target.value))}
                required
              />
              <small className="muted">HypoMg: &lt; 1.5 mg/dL</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phosphorus (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={serumPhosphorusMgDl}
                onChange={(e) => setSerumPhosphorusMgDl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Albumin (g/dL)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={serumAlbuminGDl}
                onChange={(e) => setSerumAlbuminGDl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>ECG QTc Interval (s)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={ecgQtcSeconds}
                onChange={(e) => setEcgQtcSeconds(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <small className="muted">Prolonged: &gt; 0.44s</small>
            </div>
          </div>

          {/* Symptoms */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={symptomsPresent}
                  onChange={(e) => setSymptomsPresent(e.target.checked)}
                />
                Symptoms Present
              </label>
            </div>
            <div>
              <select
                className="form-control"
                value={symptomDetails}
                onChange={(e) => setSymptomDetails(e.target.value)}
              >
                <option value="asymptomatic">Asymptomatic</option>
                <option value="jitteriness_hyperreflexia">Jitteriness / Hyperreflexia / Clonus</option>
                <option value="tetany_carpopedal_spasm">Tetany / Carpopedal Spasm / Laryngospasm</option>
                <option value="hypocalcemic_seizures">Focal or Generalized Seizures</option>
                <option value="apnea_cyanosis">Apnea / Cyanotic Spells</option>
                <option value="lethargy_poor_feeding">Lethargy / Poor Feeding / Hypotonia</option>
              </select>
            </div>
          </div>

          {/* Live Preview Card */}
          {preview && (
            <div
              style={{
                background: preview.emergencyBolusIndicated ? '#fef2f2' : '#eff6ff',
                borderLeft: `4px solid ${preview.emergencyBolusIndicated ? '#ef4444' : '#3b82f6'}`,
                padding: 12,
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <strong style={{ color: preview.emergencyBolusIndicated ? '#b91c1c' : '#1e40af' }}>
                {preview.summary}
              </strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8, fontSize: '0.85rem' }}>
                <div>
                  <strong>10% Calcium Gluconate Bolus:</strong>{' '}
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>{preview.calciumGluconate10pctBolusMl} mL</span> (diluted 1:1 D5W)
                </div>
                <div>
                  <strong>IV Maintenance:</strong> {preview.calciumGluconateMaintenanceMlPerDay} mL/day (400 mg/kg/d)
                </div>
                {preview.concurrentHypomagnesemia && (
                  <div style={{ gridColumn: 'span 2', color: '#b45309', fontWeight: 600 }}>
                    ⚠️ Hypomagnesemia Detected: 50% MgSO4 {preview.magnesiumSulfate50pctDoseMl} mL slow IV / deep IM required.
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 6 }}>
                {preview.bradycardiaWarning}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="acute_iv_correction">Acute IV Correction (Bolus / Infusion)</option>
              <option value="maintenance_infusion_weaning">Maintenance Infusion & Weaning</option>
              <option value="transitioned_to_oral_supplements">Transitioned to Oral Supplements</option>
              <option value="eucalcemic_resolved">Eucalcemic Resolved</option>
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
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#b45309', borderColor: '#92400e' }} disabled={loading}>
              {loading ? 'Recording...' : 'Save Hypocalcemia Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
