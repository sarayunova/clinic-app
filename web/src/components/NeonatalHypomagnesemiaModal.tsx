import React, { useState, useEffect } from 'react';
import { createNeonatalHypomagnesemiaEpisode, calculateNeonatalHypomagnesemia } from '../api';

interface NeonatalHypomagnesemiaModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalHypomagnesemiaModal: React.FC<NeonatalHypomagnesemiaModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [onsetDatetime, setOnsetDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(39.0);
  const [birthWeightGrams, setBirthWeightGrams] = useState(3300);
  const [chronologicalAgeHours, setChronologicalAgeHours] = useState(24);
  const [currentWeightKg, setCurrentWeightKg] = useState(3.2);

  const [serumMagnesiumMgDl, setSerumMagnesiumMgDl] = useState(1.1);
  const [serumCalciumMgDl, setSerumCalciumMgDl] = useState<number | ''>(6.9);
  const [ionizedCalciumMmolL, setIonizedCalciumMmolL] = useState<number | ''>(0.84);
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<number | ''>(4.2);

  const [neuromuscularSymptoms, setNeuromuscularSymptoms] = useState<string>('clonic_seizures_refractory');
  const [seizuresObserved, setSeizuresObserved] = useState(true);
  const [calciumRefractoryTetany, setCalciumRefractoryTetany] = useState(true);
  const [ecgAbnormalities, setEcgAbnormalities] = useState<string>('prolonged_pr_interval');
  const [renalImpairmentPresent, setRenalImpairmentPresent] = useState(false);

  const [magnesiumSulfateBolusMl, setMagnesiumSulfateBolusMl] = useState(0.64);
  const [administrationRoute, setAdministrationRoute] = useState<string>('slow_iv_infusion');
  const [continuousEcgMonitored, setContinuousEcgMonitored] = useState(true);
  const [status, setStatus] = useState<string>('acute_resuscitation');
  const [clinicalNotes, setClinicalNotes] = useState(
    'Focal clonic seizures unresponsive to initial Phenobarbital and IV Calcium Gluconate. Lab reveals severe hypomagnesemia (1.1 mg/dL) with concurrent hypocalcemia. 50% MgSO4 bolus ordered.',
  );

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateNeonatalHypomagnesemia({
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      birthWeightGrams: Number(birthWeightGrams),
      chronologicalAgeHours: Number(chronologicalAgeHours),
      currentWeightKg: Number(currentWeightKg),
      serumMagnesiumMgDl: Number(serumMagnesiumMgDl),
      serumCalciumMgDl: serumCalciumMgDl === '' ? undefined : Number(serumCalciumMgDl),
      ionizedCalciumMmolL: ionizedCalciumMmolL === '' ? undefined : Number(ionizedCalciumMmolL),
      serumPotassiumMeqL: serumPotassiumMeqL === '' ? undefined : Number(serumPotassiumMeqL),
      neuromuscularSymptoms,
      seizuresObserved,
      calciumRefractoryTetany,
      ecgAbnormalities,
      renalImpairmentPresent,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult?.doseCalculation?.bolusVolume50PctMl) {
          setMagnesiumSulfateBolusMl(res.evalResult.doseCalculation.bolusVolume50PctMl);
        }
      })
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    chronologicalAgeHours,
    currentWeightKg,
    serumMagnesiumMgDl,
    serumCalciumMgDl,
    ionizedCalciumMmolL,
    serumPotassiumMeqL,
    neuromuscularSymptoms,
    seizuresObserved,
    calciumRefractoryTetany,
    ecgAbnormalities,
    renalImpairmentPresent,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createNeonatalHypomagnesemiaEpisode({
        patientId,
        onsetDatetime: new Date(onsetDatetime).toISOString(),
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightGrams: Number(birthWeightGrams),
        chronologicalAgeHours: Number(chronologicalAgeHours),
        currentWeightKg: Number(currentWeightKg),
        serumMagnesiumMgDl: Number(serumMagnesiumMgDl),
        serumCalciumMgDl: serumCalciumMgDl === '' ? undefined : Number(serumCalciumMgDl),
        ionizedCalciumMmolL: ionizedCalciumMmolL === '' ? undefined : Number(ionizedCalciumMmolL),
        serumPotassiumMeqL: serumPotassiumMeqL === '' ? undefined : Number(serumPotassiumMeqL),
        neuromuscularSymptoms,
        seizuresObserved,
        calciumRefractoryTetany,
        ecgAbnormalities,
        renalImpairmentPresent,
        magnesiumSulfateBolusMl: Number(magnesiumSulfateBolusMl),
        administrationRoute,
        continuousEcgMonitored,
        status,
        clinicalNotes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate neonatal hypomagnesemia episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0284c7' }}>
            ⚡ Neonatal Hypomagnesemia & Refractory Seizures Protocol
          </h2>
          <button className="button small" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Patient: <strong>{patientName}</strong> | Reference: AAP Neonatal Guidelines & Nelson Pediatrics
        </p>

        {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label>Onset Datetime *</label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Gestation (weeks) *</label>
              <input
                type="number"
                step="0.1"
                min="22"
                max="44"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Birth Weight (grams) *</label>
              <input
                type="number"
                min="300"
                max="6500"
                value={birthWeightGrams}
                onChange={(e) => setBirthWeightGrams(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Chronological Age (hours) *</label>
              <input
                type="number"
                min="0"
                max="720"
                value={chronologicalAgeHours}
                onChange={(e) => setChronologicalAgeHours(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Current Weight (kg) *</label>
              <input
                type="number"
                step="0.01"
                min="0.3"
                max="10.0"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Serum Mg (mg/dL) *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="5.0"
                value={serumMagnesiumMgDl}
                onChange={(e) => setSerumMagnesiumMgDl(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Electrolytes & Calcium Refractoriness */}
          <div className="card" style={{ background: '#f8fafc', padding: 12, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#334155' }}>
              Concurrent Electrolytes & Calcium Resistance Assessment
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label>Serum Total Calcium (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 7.0"
                  value={serumCalciumMgDl}
                  onChange={(e) => setSerumCalciumMgDl(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Ionized Calcium (mmol/L)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0.85"
                  value={ionizedCalciumMmolL}
                  onChange={(e) => setIonizedCalciumMmolL(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Serum Potassium (mEq/L)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 4.0"
                  value={serumPotassiumMeqL}
                  onChange={(e) => setSerumPotassiumMeqL(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Neuromuscular Symptoms & ECG */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label>Neuromuscular Symptoms</label>
              <select value={neuromuscularSymptoms} onChange={(e) => setNeuromuscularSymptoms(e.target.value)}>
                <option value="none_asymptomatic">None (Asymptomatic)</option>
                <option value="jitteriness_tremors">Jitteriness & Fine Tremors</option>
                <option value="hyperreflexia_clonus">Hyperreflexia & Ankle Clonus</option>
                <option value="tetany_carpopedal">Carpopedal Spasm / Laryngospasm</option>
                <option value="clonic_seizures_refractory">Focal / Generalized Clonic Seizures</option>
                <option value="apnea_bradycardia">Apnea & Bradycardia Spells</option>
              </select>
            </div>
            <div>
              <label>ECG Abnormalities</label>
              <select value={ecgAbnormalities} onChange={(e) => setEcgAbnormalities(e.target.value)}>
                <option value="none">Normal Sinus Rhythm</option>
                <option value="prolonged_pr_interval">Prolonged PR Interval</option>
                <option value="widened_qrs">Widened QRS Complex</option>
                <option value="ventricular_arrhythmias_torsades">Ventricular Arrhythmias / Torsades</option>
                <option value="sinus_bradycardia">Sinus Bradycardia</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={seizuresObserved}
                onChange={(e) => setSeizuresObserved(e.target.checked)}
              />
              <span>Seizures Observed</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={calciumRefractoryTetany}
                onChange={(e) => setCalciumRefractoryTetany(e.target.checked)}
              />
              <span>Calcium-Refractory Tetany/Seizures</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={renalImpairmentPresent}
                onChange={(e) => setRenalImpairmentPresent(e.target.checked)}
              />
              <span>Renal Impairment (Dose -50%)</span>
            </label>
          </div>

          {/* Dosing & Administration */}
          <div className="card" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: 12, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#0369a1' }}>
              50% Magnesium Sulfate (MgSO4) Intervention Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label>50% MgSO4 Bolus (mL) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10.0"
                  value={magnesiumSulfateBolusMl}
                  onChange={(e) => setMagnesiumSulfateBolusMl(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Administration Route</label>
                <select value={administrationRoute} onChange={(e) => setAdministrationRoute(e.target.value)}>
                  <option value="slow_iv_infusion">Slow IV Infusion (over 30-60 min)</option>
                  <option value="deep_intramuscular">Deep IM (Anterolateral Thigh)</option>
                  <option value="oral_maintenance">Oral Maintenance</option>
                </select>
              </div>
              <div>
                <label>Episode Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="acute_resuscitation">Acute Resuscitation</option>
                  <option value="maintenance_infusion">Maintenance Infusion</option>
                  <option value="monitoring_stabilized">Monitoring & Stabilized</option>
                  <option value="resolved_eumagnesemic">Resolved Eumagnesemic</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={continuousEcgMonitored}
                  onChange={(e) => setContinuousEcgMonitored(e.target.checked)}
                />
                <span>Continuous Cardiopulmonary / ECG Monitoring Active</span>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Clinical Notes & Response</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record seizure characteristics, anticonvulsant response, IV access, and post-infusion exam..."
            />
          </div>

          {/* Live Engine Preview */}
          {preview && (
            <div
              className="card"
              style={{
                background: preview.severityTier === 'severe_critical_hypomagnesemia' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${preview.severityTier === 'severe_critical_hypomagnesemia' ? '#fca5a5' : '#86efac'}`,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.severityTier === 'severe_critical_hypomagnesemia' ? '#dc2626' : '#16a34a' }}>
                  {preview.severityLabel}
                </strong>
                <span className="badge" style={{ background: '#0284c7', color: '#fff' }}>
                  Bolus: {preview.doseCalculation.bolusVolume50PctMl} mL ({preview.doseCalculation.elementalMgMg} mg)
                </span>
              </div>
              <p className="small" style={{ margin: '6px 0' }}>
                {preview.doseCalculation.infusionInstructions}
              </p>
              {preview.calciumRefractoryMechanismActive && (
                <div style={{ color: '#b91c1c', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                  ⚠️ Calcium-Refractory Mechanism Active: Hypocalcemia will NOT resolve until Mg is corrected.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="button secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Saving...' : 'Initiate Hypomagnesemia Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
