import React, { useState, useEffect } from 'react';
import {
  createNeonatalSeizuresEpisode,
  updateNeonatalSeizuresEpisode,
  type NeonatalSeizuresRecord,
} from '../api';
import {
  evaluateNeonatalSeizures,
  type NeonatalSeizuresEvaluationResult,
  type NeonatalSeizureSemiology,
  type NeonatalSeizureDuration,
  type NeonatalSeizureEtiology,
} from '../neonatalSeizuresEngine';

interface Props {
  patientId: number;
  initialEpisode?: NeonatalSeizuresRecord | null;
  existingEpisode?: NeonatalSeizuresRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const NeonatalSeizuresModal: React.FC<Props> = ({
  patientId,
  initialEpisode,
  existingEpisode,
  isOpen = true,
  onClose,
  onSuccess,
  onSaved,
}) => {
  if (!isOpen) return null;
  const currentEp = initialEpisode || existingEpisode;

  const [diagnosisDatetime, setDiagnosisDatetime] = useState(
    currentEp?.diagnosis_datetime || new Date().toISOString().slice(0, 16)
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    currentEp?.gestational_age_weeks ?? 38.0
  );
  const [postnatalAgeDays, setPostnatalAgeDays] = useState<number>(
    currentEp?.postnatal_age_days ?? 2
  );
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(
    currentEp?.current_weight_kg ?? 3.0
  );
  const [seizureSemiology, setSeizureSemiology] = useState<NeonatalSeizureSemiology>(
    currentEp?.seizure_semiology ?? 'clonic'
  );
  const [seizureDurationCategory, setSeizureDurationCategory] = useState<NeonatalSeizureDuration>(
    currentEp?.seizure_duration_category ?? 'recurrent_cluster'
  );
  const [suspectedEtiology, setSuspectedEtiology] = useState<NeonatalSeizureEtiology>(
    currentEp?.suspected_etiology ?? 'hie'
  );
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<string>(
    currentEp?.blood_glucose_mg_dl !== null && currentEp?.blood_glucose_mg_dl !== undefined
      ? String(currentEp.blood_glucose_mg_dl)
      : '65'
  );
  const [ionizedCalciumMmolL, setIonizedCalciumMmolL] = useState<string>(
    currentEp?.ionized_calcium_mmol_l !== null && currentEp?.ionized_calcium_mmol_l !== undefined
      ? String(currentEp.ionized_calcium_mmol_l)
      : '1.15'
  );
  const [serumMagnesiumMgDl, setSerumMagnesiumMgDl] = useState<string>(
    currentEp?.serum_magnesium_mg_dl !== null && currentEp?.serum_magnesium_mg_dl !== undefined
      ? String(currentEp.serum_magnesium_mg_dl)
      : '1.9'
  );
  const [sodiumMeqL, setSodiumMeqL] = useState<string>(
    currentEp?.sodium_meq_l !== null && currentEp?.sodium_meq_l !== undefined
      ? String(currentEp.sodium_meq_l)
      : '138'
  );
  const [firstLinePhenobarbitalGiven, setFirstLinePhenobarbitalGiven] = useState<boolean>(
    currentEp ? Boolean(currentEp.first_line_phenobarbital_given) : false
  );
  const [cumulativePhenobarbitalMgKg, setCumulativePhenobarbitalMgKg] = useState<number>(
    currentEp?.cumulative_phenobarbital_mg_kg ?? 0
  );
  const [secondLineAnticonvulsant, setSecondLineAnticonvulsant] = useState<string>(
    currentEp?.second_line_anticonvulsant ?? 'levetiracetam'
  );
  const [secondLineGiven, setSecondLineGiven] = useState<boolean>(
    currentEp ? Boolean(currentEp.second_line_given) : false
  );
  const [pyridoxineTrialDone, setPyridoxineTrialDone] = useState<boolean>(
    currentEp ? Boolean(currentEp.pyridoxine_trial_done) : false
  );
  const [pyridoxineResponsive, setPyridoxineResponsive] = useState<boolean>(
    currentEp ? Boolean(currentEp.pyridoxine_responsive) : false
  );
  const [respiratorySupportStatus, setRespiratorySupportStatus] = useState<
    'room_air' | 'nasal_prongs' | 'cpap' | 'mechanical_ventilation'
  >(currentEp?.respiratory_support_status ?? 'room_air');
  const [status, setStatus] = useState<'active' | 'stabilized' | 'resolved' | 'transferred'>(
    currentEp?.status ?? 'active'
  );
  const [clinicalSummary, setClinicalSummary] = useState<string>(
    currentEp?.clinical_summary ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NeonatalSeizuresEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateNeonatalSeizures({
        gestationalAgeWeeks,
        postnatalAgeDays,
        currentWeightKg,
        seizureSemiology,
        seizureDurationCategory,
        suspectedEtiology,
        bloodGlucoseMgDl: bloodGlucoseMgDl ? parseFloat(bloodGlucoseMgDl) : null,
        ionizedCalciumMmolL: ionizedCalciumMmolL ? parseFloat(ionizedCalciumMmolL) : null,
        serumMagnesiumMgDl: serumMagnesiumMgDl ? parseFloat(serumMagnesiumMgDl) : null,
        sodiumMeqL: sodiumMeqL ? parseFloat(sodiumMeqL) : null,
        cumulativePhenobarbitalMgKg,
        secondLineGiven,
        pyridoxineTrialDone,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [
    gestationalAgeWeeks,
    postnatalAgeDays,
    currentWeightKg,
    seizureSemiology,
    seizureDurationCategory,
    suspectedEtiology,
    bloodGlucoseMgDl,
    ionizedCalciumMmolL,
    serumMagnesiumMgDl,
    sodiumMeqL,
    cumulativePhenobarbitalMgKg,
    secondLineGiven,
    pyridoxineTrialDone,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      diagnosisDatetime,
      gestationalAgeWeeks,
      postnatalAgeDays,
      currentWeightKg,
      seizureSemiology,
      seizureDurationCategory,
      suspectedEtiology,
      bloodGlucoseMgDl: bloodGlucoseMgDl ? parseFloat(bloodGlucoseMgDl) : null,
      ionizedCalciumMmolL: ionizedCalciumMmolL ? parseFloat(ionizedCalciumMmolL) : null,
      serumMagnesiumMgDl: serumMagnesiumMgDl ? parseFloat(serumMagnesiumMgDl) : null,
      sodiumMeqL: sodiumMeqL ? parseFloat(sodiumMeqL) : null,
      firstLinePhenobarbitalGiven,
      cumulativePhenobarbitalMgKg,
      secondLineAnticonvulsant: secondLineGiven ? secondLineAnticonvulsant : null,
      secondLineGiven,
      pyridoxineTrialDone,
      pyridoxineResponsive,
      respiratorySupportStatus,
      status,
      clinicalSummary: clinicalSummary || null,
    };

    try {
      if (currentEp) {
        await updateNeonatalSeizuresEpisode(currentEp.id, payload);
        onSaved?.();
        onSuccess?.(currentEp.id);
      } else {
        const res = await createNeonatalSeizuresEpisode(payload);
        onSaved?.();
        onSuccess?.(res.id);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save neonatal seizures episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {currentEp ? 'Edit Neonatal Seizure Protocol' : 'Initiate Neonatal Seizures & Status Epilepticus Pathway'}
          </h3>
          <button className="btn small" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label>Onset / Diagnosis Time *</label>
              <input
                type="datetime-local"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Gestational Age (weeks) *</label>
              <input
                type="number"
                step="0.1"
                min="22"
                max="44"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 38)}
                required
              />
            </div>
            <div>
              <label>Postnatal Age (days) *</label>
              <input
                type="number"
                min="0"
                max="90"
                value={postnatalAgeDays}
                onChange={(e) => setPostnatalAgeDays(parseInt(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label>Current Weight (kg) *</label>
              <input
                type="number"
                step="0.01"
                min="0.3"
                max="10"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(parseFloat(e.target.value) || 3.0)}
                required
              />
            </div>
          </div>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Seizure Semiology & Etiology</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label>Semiology (ILAE) *</label>
                <select
                  value={seizureSemiology}
                  onChange={(e) => setSeizureSemiology(e.target.value as NeonatalSeizureSemiology)}
                >
                  <option value="clonic">Focal / Multifocal Clonic</option>
                  <option value="tonic">Focal / Generalized Tonic</option>
                  <option value="myoclonic">Myoclonic Jerks</option>
                  <option value="autonomic">Autonomic (Apnea / Tachycardia / Desat)</option>
                  <option value="subtle">Subtle (Bicycling / Ocular Deviation)</option>
                  <option value="electrographic_only">Electrographic Only (Subclinical aEEG)</option>
                </select>
              </div>
              <div>
                <label>Duration & Clustering *</label>
                <select
                  value={seizureDurationCategory}
                  onChange={(e) => setSeizureDurationCategory(e.target.value as NeonatalSeizureDuration)}
                >
                  <option value="isolated_brief">Isolated Brief (&lt; 3 min)</option>
                  <option value="recurrent_cluster">Recurrent Clusters (&ge; 2 within 24h)</option>
                  <option value="status_epilepticus">Status Epilepticus (&ge; 30 min / 50% runtime)</option>
                </select>
              </div>
              <div>
                <label>Suspected Etiology *</label>
                <select
                  value={suspectedEtiology}
                  onChange={(e) => setSuspectedEtiology(e.target.value as NeonatalSeizureEtiology)}
                >
                  <option value="hie">Hypoxic-Ischemic Encephalopathy (HIE)</option>
                  <option value="cns_infection">CNS Infection (Meningitis / Encephalitis)</option>
                  <option value="stroke_thrombosis">Perinatal Arterial Ischemic Stroke (PAIS)</option>
                  <option value="ich">Intracranial Hemorrhage (IVH / Subdural)</option>
                  <option value="hypoglycemia">Acute Symptomatic Hypoglycemia</option>
                  <option value="hypocalcemia">Hypocalcemia / Hypomagnesemia</option>
                  <option value="inborn_metabolism">Inborn Error of Metabolism (IEM)</option>
                  <option value="benign_familial">Benign Familial Neonatal Epilepsy (KCNQ2/3)</option>
                  <option value="unknown">Cryptogenic / Unknown Etiology</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Emergency Metabolic Laboratory Directives</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label>Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  step="1"
                  value={bloodGlucoseMgDl}
                  onChange={(e) => setBloodGlucoseMgDl(e.target.value)}
                  placeholder="e.g. 65"
                />
              </div>
              <div>
                <label>Ionized Calcium (mmol/L)</label>
                <input
                  type="number"
                  step="0.01"
                  value={ionizedCalciumMmolL}
                  onChange={(e) => setIonizedCalciumMmolL(e.target.value)}
                  placeholder="e.g. 1.15"
                />
              </div>
              <div>
                <label>Serum Magnesium (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={serumMagnesiumMgDl}
                  onChange={(e) => setSerumMagnesiumMgDl(e.target.value)}
                  placeholder="e.g. 1.9"
                />
              </div>
              <div>
                <label>Serum Sodium (mEq/L)</label>
                <input
                  type="number"
                  step="1"
                  value={sodiumMeqL}
                  onChange={(e) => setSodiumMeqL(e.target.value)}
                  placeholder="e.g. 138"
                />
              </div>
            </div>
          </fieldset>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Antiseizure Medication (ASM) Loading & Escalation</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={firstLinePhenobarbitalGiven}
                    onChange={(e) => setFirstLinePhenobarbitalGiven(e.target.checked)}
                  />
                  Phenobarbital 1st Line Given
                </label>
              </div>
              <div>
                <label>Cumulative Phenobarbital (mg/kg)</label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="40"
                  value={cumulativePhenobarbitalMgKg}
                  onChange={(e) => setCumulativePhenobarbitalMgKg(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={secondLineGiven}
                    onChange={(e) => setSecondLineGiven(e.target.checked)}
                  />
                  Second-Line ASM Administered
                </label>
              </div>
              {secondLineGiven && (
                <div>
                  <label>Second-Line Agent</label>
                  <select
                    value={secondLineAnticonvulsant}
                    onChange={(e) => setSecondLineAnticonvulsant(e.target.value)}
                  >
                    <option value="levetiracetam">IV Levetiracetam (Keppra 60 mg/kg)</option>
                    <option value="midazolam_infusion">IV Midazolam Infusion (0.15 mg/kg bolus + infusion)</option>
                    <option value="lidocaine">IV Lidocaine (Cardiac-monitored, non-congenital)</option>
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={pyridoxineTrialDone}
                    onChange={(e) => setPyridoxineTrialDone(e.target.checked)}
                  />
                  Pyridoxine (B6) Trial Executed
                </label>
              </div>
              {pyridoxineTrialDone && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={pyridoxineResponsive}
                      onChange={(e) => setPyridoxineResponsive(e.target.checked)}
                    />
                    Pyridoxine Responsive (Seizures Ceased)
                  </label>
                </div>
              )}
            </div>
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
            <div>
              <label>Respiratory Support Mode</label>
              <select
                value={respiratorySupportStatus}
                onChange={(e) => setRespiratorySupportStatus(e.target.value as any)}
              >
                <option value="room_air">Room Air</option>
                <option value="nasal_prongs">Low Flow Nasal Prongs</option>
                <option value="cpap">Bubble CPAP / NIV</option>
                <option value="mechanical_ventilation">Endotracheal Mechanical Ventilation</option>
              </select>
            </div>
            <div>
              <label>Protocol Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="active">Active Resuscitation</option>
                <option value="stabilized">Stabilized / Seizure-Controlled</option>
                <option value="resolved">Resolved / Discharged to Ward</option>
                <option value="transferred">Transferred to Higher Level NICU</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Clinical Summary / aEEG Notes</label>
            <textarea
              rows={2}
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              placeholder="e.g. Discontinuous voltage background on bilateral CFM; electrographic cessation following 20 mg/kg Phenobarbital loading..."
            />
          </div>

          {preview && (
            <div
              className={`card ${
                preview.urgencyCategory === 'emergency_resuscitation'
                  ? 'border-danger'
                  : preview.urgencyCategory === 'high_priority_active'
                  ? 'border-warning'
                  : 'border-info'
              }`}
              style={{ marginTop: 16, padding: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge" style={{ fontWeight: 'bold' }}>
                  {preview.urgencyLabel}
                </span>
                <span>
                  <strong>Phenobarbital Loading: </strong>
                  {preview.phenobarbitalLoading.bolusDoseMg} mg IV ({preview.phenobarbitalLoading.bolusVolumeMl} mL)
                </span>
              </div>

              {preview.metabolicDirectives.some((m) => m.isTriggered) && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ color: '#d9534f' }}>Urgent Metabolic Interventions:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {preview.metabolicDirectives
                      .filter((m) => m.isTriggered)
                      .map((m, idx) => (
                        <li key={idx} style={{ color: '#d9534f' }}>
                          <strong>{m.condition}:</strong> {m.intervention} ({m.volumeMl} mL via {m.route})
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {preview.clinicalAlerts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Safety Warnings:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {preview.clinicalAlerts.map((alert, idx) => (
                      <li key={idx} style={{ color: '#8a6d3b' }}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : currentEp ? 'Update Episode' : 'Initiate Pathway'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
