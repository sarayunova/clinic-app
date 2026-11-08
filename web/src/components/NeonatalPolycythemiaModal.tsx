import React, { useState, useEffect } from 'react';
import { createNeonatalPolycythemiaEpisode, calculateNeonatalPolycythemia } from '../api';

interface NeonatalPolycythemiaModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalPolycythemiaModal: React.FC<NeonatalPolycythemiaModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [diagnosisDatetime, setDiagnosisDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(39.0);
  const [birthWeightGrams, setBirthWeightGrams] = useState(3400);
  const [chronologicalAgeHours, setChronologicalAgeHours] = useState(8);
  const [currentWeightKg, setCurrentWeightKg] = useState(3.4);

  const [samplingSite, setSamplingSite] = useState<string>('peripheral_venous');
  const [venousHematocritPct, setVenousHematocritPct] = useState(68.0);
  const [hemoglobinGDl, setHemoglobinGDl] = useState<number | ''>(22.5);
  const [bloodVolumeMlKg, setBloodVolumeMlKg] = useState(80.0);
  const [targetHematocritPct, setTargetHematocritPct] = useState(55.0);

  const [symptomsPresent, setSymptomsPresent] = useState(true);
  const [symptomDetails, setSymptomDetails] = useState<string>('plethora_ruddy_appearance');
  const [serumGlucoseMgDl, setSerumGlucoseMgDl] = useState<number | ''>(38.0);
  const [plateletCount, setPlateletCount] = useState<number | ''>(145000);
  const [serumBilirubinMgDl, setSerumBilirubinMgDl] = useState<number | ''>(7.2);

  const [replacementFluid, setReplacementFluid] = useState<string>('normal_saline_0_9');
  const [status, setStatus] = useState<string>('hydration_surveillance');
  const [clinicalNotes, setClinicalNotes] = useState('Marked ruddy plethora with sluggish capillary refill. Venous Hct 68%. Partial exchange transfusion with 0.9% Normal Saline planned.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateNeonatalPolycythemia({
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      birthWeightGrams: Number(birthWeightGrams),
      chronologicalAgeHours: Number(chronologicalAgeHours),
      currentWeightKg: Number(currentWeightKg),
      samplingSite,
      venousHematocritPct: Number(venousHematocritPct),
      hemoglobinGDl: hemoglobinGDl === '' ? undefined : Number(hemoglobinGDl),
      bloodVolumeMlKg: Number(bloodVolumeMlKg),
      targetHematocritPct: Number(targetHematocritPct),
      symptomsPresent,
      symptomDetails,
      serumGlucoseMgDl: serumGlucoseMgDl === '' ? undefined : Number(serumGlucoseMgDl),
      plateletCount: plateletCount === '' ? undefined : Number(plateletCount),
      serumBilirubinMgDl: serumBilirubinMgDl === '' ? undefined : Number(serumBilirubinMgDl),
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    chronologicalAgeHours,
    currentWeightKg,
    samplingSite,
    venousHematocritPct,
    hemoglobinGDl,
    bloodVolumeMlKg,
    targetHematocritPct,
    symptomsPresent,
    symptomDetails,
    serumGlucoseMgDl,
    plateletCount,
    serumBilirubinMgDl,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createNeonatalPolycythemiaEpisode({
        patientId,
        diagnosisDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightGrams: Number(birthWeightGrams),
        chronologicalAgeHours: Number(chronologicalAgeHours),
        currentWeightKg: Number(currentWeightKg),
        samplingSite,
        venousHematocritPct: Number(venousHematocritPct),
        hemoglobinGDl: hemoglobinGDl === '' ? null : Number(hemoglobinGDl),
        bloodVolumeMlKg: Number(bloodVolumeMlKg),
        targetHematocritPct: Number(targetHematocritPct),
        symptomsPresent,
        symptomDetails,
        serumGlucoseMgDl: serumGlucoseMgDl === '' ? null : Number(serumGlucoseMgDl),
        plateletCount: plateletCount === '' ? null : Number(plateletCount),
        serumBilirubinMgDl: serumBilirubinMgDl === '' ? null : Number(serumBilirubinMgDl),
        replacementFluid,
        status,
        clinicalNotes,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create neonatal polycythemia episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ maxWidth: 840, width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: '#991b1b' }}>🩺 Neonatal Polycythemia & Partial Exchange Transfusion (PET)</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Patient: <strong>{patientName}</strong> | Reference: AAP / Gomella's Neonatology Criteria
            </p>
          </div>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner error" style={{ margin: '12px 0' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          {/* Live Preview Synthesis Card */}
          {preview && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#991b1b', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                  Protocol Synthesis: {preview.hyperviscosityRiskTier.replace(/_/g, ' ').toUpperCase()}
                </strong>
                <span className={`badge ${preview.partialExchangeIndicated ? 'danger' : 'success'}`}>
                  {preview.partialExchangeIndicated ? '⚠️ PARTIAL EXCHANGE (PET) INDICATED' : 'CONSERVATIVE HYDRATION'}
                </span>
              </div>
              <p style={{ margin: '6px 0', fontSize: '0.9rem' }}>{preview.riskDescription}</p>

              {preview.partialExchangeIndicated && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10, background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #fca5a5' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Exchange Volume (mL)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{preview.exchangeVolumeMl} mL</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Target Hct {preview.targetHematocritPct}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Aliquot Size (~5 mL/kg)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>~{preview.recommendedAliquotSizeMl} mL</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{preview.numberOfAliquots} Cycles Required</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Replacement Fluid</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0369a1' }}>0.9% Normal Saline</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Avoid Albumin/FFP</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Demographic & Diagnostic Timing */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Diagnosis Datetime</label>
              <input
                type="datetime-local"
                className="form-control"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gestation (weeks)</label>
              <input
                type="number"
                step="0.1"
                min="24"
                max="44"
                className="form-control"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Birth Weight (g)</label>
              <input
                type="number"
                min="300"
                max="6500"
                className="form-control"
                value={birthWeightGrams}
                onChange={(e) => setBirthWeightGrams(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Current Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0.3"
                max="10"
                className="form-control"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Hematocrit & Laboratory Biomarkers */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16, background: '#f8fafc' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#0f172a' }}>Hematocrit & Hyperviscosity Labs</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sampling Site</label>
                <select
                  className="form-control"
                  value={samplingSite}
                  onChange={(e) => setSamplingSite(e.target.value)}
                >
                  <option value="peripheral_venous">Peripheral Venous (Gold Standard)</option>
                  <option value="umbilical_venous">Umbilical Venous (Central)</option>
                  <option value="capillary_unconfirmed">Capillary (Heelstick - Overestimates)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Venous Hematocrit (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="40"
                  max="90"
                  className="form-control"
                  value={venousHematocritPct}
                  onChange={(e) => setVenousHematocritPct(Number(e.target.value))}
                  required
                />
                <small className="muted">Threshold: ≥ 65%</small>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Blood Vol (mL/kg)</label>
                <input
                  type="number"
                  step="1"
                  min="60"
                  max="120"
                  className="form-control"
                  value={bloodVolumeMlKg}
                  onChange={(e) => setBloodVolumeMlKg(Number(e.target.value))}
                  required
                />
                <small className="muted">Term: 80, Preterm: 90</small>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Target Hct (%)</label>
                <input
                  type="number"
                  step="1"
                  min="45"
                  max="60"
                  className="form-control"
                  value={targetHematocritPct}
                  onChange={(e) => setTargetHematocritPct(Number(e.target.value))}
                  required
                />
                <small className="muted">Standard: 55%</small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hemoglobin (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={hemoglobinGDl}
                  onChange={(e) => setHemoglobinGDl(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 22.5"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  step="1"
                  className="form-control"
                  value={serumGlucoseMgDl}
                  onChange={(e) => setSerumGlucoseMgDl(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Rule out hypoglycemia"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Platelets (/µL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={plateletCount}
                  onChange={(e) => setPlateletCount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 150000"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Bilirubin (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={serumBilirubinMgDl}
                  onChange={(e) => setSerumBilirubinMgDl(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Hemolysis monitor"
                />
              </div>
            </div>
          </div>

          {/* Clinical Presentation & Hyperviscosity Symptoms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Symptoms Present?</label>
              <select
                className="form-control"
                value={symptomsPresent ? '1' : '0'}
                onChange={(e) => setSymptomsPresent(e.target.value === '1')}
              >
                <option value="1">YES - Symptomatic Hyperviscosity</option>
                <option value="0">NO - Asymptomatic</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Predominant Symptom</label>
              <select
                className="form-control"
                value={symptomDetails}
                onChange={(e) => setSymptomDetails(e.target.value)}
                disabled={!symptomsPresent}
              >
                <option value="plethora_ruddy_appearance">Ruddy Plethora / Delayed Cap Refill</option>
                <option value="poor_feeding_lethargy">Poor Feeding / Lethargy</option>
                <option value="jitteriness_tremors">Jitteriness / Hyperirritability</option>
                <option value="tachypnea_respiratory_distress">Tachypnea / Respiratory Distress</option>
                <option value="hypoglycemia">Refractory Hypoglycemia</option>
                <option value="cyanosis_peripheral">Peripheral Cyanosis</option>
                <option value="priapism_or_oliguria">Priapism / Oliguria (Renal Microthrombi)</option>
                <option value="asymptomatic">Asymptomatic</option>
              </select>
            </div>
          </div>

          {/* Status & Plan */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
              <select
                className="form-control"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="hydration_surveillance">Hydration & Close Surveillance</option>
                <option value="pet_procedure_in_progress">PET Procedure Active</option>
                <option value="post_pet_observation">Post-PET Recovery Observation</option>
                <option value="eupolycythemic_resolved">Eupolycythemic / Resolved</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes & Catheter Plan</label>
              <input
                type="text"
                className="form-control"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Access line, aliquot timeline, glucose checks..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Saving...' : '💾 Save Polycythemia Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
