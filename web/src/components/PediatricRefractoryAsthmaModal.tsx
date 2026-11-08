import React, { useState, useEffect } from 'react';
import {
  createPediatricRefractoryAsthmaEpisode,
  updatePediatricRefractoryAsthmaEpisode,
  type PediatricRefractoryAsthmaRecord,
} from '../api';
import {
  evaluatePediatricRefractoryAsthma,
  type PediatricRefractoryAsthmaEvaluation,
  type VentilatorySupportMode,
  type HelioxMixtureRatio,
  type PediatricRefractoryAsthmaStatus,
} from '../pediatricRefractoryAsthmaEngine';

interface Props {
  patientId: number;
  initialEpisode?: PediatricRefractoryAsthmaRecord | null;
  existingEpisode?: PediatricRefractoryAsthmaRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const PediatricRefractoryAsthmaModal: React.FC<Props> = ({
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

  const [onsetDatetime, setOnsetDatetime] = useState(
    currentEp?.onset_datetime || new Date().toISOString().slice(0, 16)
  );
  const [ageYears, setAgeYears] = useState<number>(currentEp?.age_years ?? 6.5);
  const [weightKg, setWeightKg] = useState<number>(currentEp?.weight_kg ?? 22.0);
  const [initialPediatricAsthmaScore, setInitialPediatricAsthmaScore] = useState<number>(
    currentEp?.initial_pediatric_asthma_score ?? 10
  );
  const [respiratoryRate, setRespiratoryRate] = useState<number>(currentEp?.respiratory_rate ?? 52);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(currentEp?.heart_rate_bpm ?? 154);
  const [spo2Percent, setSpo2Percent] = useState<number>(currentEp?.spo2_percent ?? 88.0);
  const [pco2Mmhg, setPco2Mmhg] = useState<number>(currentEp?.pco2_mmhg ?? 45.0);
  const [phValue, setPhValue] = useState<number>(currentEp?.ph_value ?? 7.25);
  const [silentChestOrExhaustion, setSilentChestOrExhaustion] = useState<boolean>(
    currentEp ? Boolean(currentEp.silent_chest_or_exhaustion) : true
  );
  const [refractoryToFirstLine, setRefractoryToFirstLine] = useState<boolean>(
    currentEp ? Boolean(currentEp.refractory_to_first_line) : true
  );
  const [continuousIvTerbutalineActive, setContinuousIvTerbutalineActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.continuous_iv_terbutaline_active) : true
  );
  const [terbutalineDoseMcgKgMin, setTerbutalineDoseMcgKgMin] = useState<number>(
    currentEp?.terbutaline_dose_mcg_kg_min ?? 1.5
  );
  const [ivKetamineInfusionActive, setIvKetamineInfusionActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.iv_ketamine_infusion_active) : true
  );
  const [ketamineDoseMgKgHr, setKetamineDoseMgKgHr] = useState<number>(
    currentEp?.ketamine_dose_mg_kg_hr ?? 1.0
  );
  const [helioxInhalationActive, setHelioxInhalationActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.heliox_inhalation_active) : false
  );
  const [helioxMixtureRatio, setHelioxMixtureRatio] = useState<HelioxMixtureRatio>(
    (currentEp?.heliox_mixture_ratio as HelioxMixtureRatio) ?? 'none'
  );
  const [ivTheophyllineAminophyllineActive, setIvTheophyllineAminophyllineActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.iv_theophylline_aminophylline_active) : false
  );
  const [ventilatorySupportMode, setVentilatorySupportMode] = useState<VentilatorySupportMode>(
    (currentEp?.ventilatory_support_mode as VentilatorySupportMode) ?? 'bipap_noninvasive_positive_pressure'
  );
  const [status, setStatus] = useState<PediatricRefractoryAsthmaStatus>(
    (currentEp?.status as PediatricRefractoryAsthmaStatus) ?? 'impending_respiratory_failure'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PediatricRefractoryAsthmaEvaluation | null>(null);

  useEffect(() => {
    try {
      const evalResult = evaluatePediatricRefractoryAsthma({
        ageYears,
        weightKg,
        initialPediatricAsthmaScore,
        respiratoryRate,
        heartRateBpm,
        spo2Percent,
        pco2Mmhg,
        phValue,
        silentChestOrExhaustion,
        refractoryToFirstLine,
        continuousIvTerbutalineActive,
        terbutalineDoseMcgKgMin,
        ivKetamineInfusionActive,
        ketamineDoseMgKgHr,
        helioxInhalationActive,
        helioxMixtureRatio,
        ivTheophyllineAminophyllineActive,
        ventilatorySupportMode,
      });
      setPreview(evalResult);
    } catch {
      setPreview(null);
    }
  }, [
    ageYears,
    weightKg,
    initialPediatricAsthmaScore,
    respiratoryRate,
    heartRateBpm,
    spo2Percent,
    pco2Mmhg,
    phValue,
    silentChestOrExhaustion,
    refractoryToFirstLine,
    continuousIvTerbutalineActive,
    terbutalineDoseMcgKgMin,
    ivKetamineInfusionActive,
    ketamineDoseMgKgHr,
    helioxInhalationActive,
    helioxMixtureRatio,
    ivTheophyllineAminophyllineActive,
    ventilatorySupportMode,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      ageYears,
      weightKg,
      initialPediatricAsthmaScore,
      respiratoryRate,
      heartRateBpm,
      spo2Percent,
      pco2Mmhg,
      phValue,
      silentChestOrExhaustion,
      refractoryToFirstLine,
      continuousIvTerbutalineActive,
      terbutalineDoseMcgKgMin,
      ivKetamineInfusionActive,
      ketamineDoseMgKgHr,
      helioxInhalationActive,
      helioxMixtureRatio,
      ivTheophyllineAminophyllineActive,
      ventilatorySupportMode,
      status,
      clinicalNotes: clinicalNotes.trim() || undefined,
    };

    try {
      if (currentEp?.id) {
        await updatePediatricRefractoryAsthmaEpisode(currentEp.id, payload);
        if (onSaved) onSaved();
      } else {
        const res = await createPediatricRefractoryAsthmaEpisode(payload);
        if (onSuccess) onSuccess(res.episode.id);
        if (onSaved) onSaved();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save pediatric refractory asthma episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {currentEp ? 'Edit Refractory Asthma Episode' : 'Initiate Pediatric Refractory Status Asthmaticus (PICU Rescue) Protocol'}
          </h3>
          <button className="btn small" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label>Onset / PICU Admission Time *</label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Age (years) *</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="18.0"
                value={ageYears}
                onChange={(e) => setAgeYears(parseFloat(e.target.value) || 5.0)}
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
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 20.0)}
                required
              />
            </div>

            <div>
              <label>Asthma Severity Score (0–12) *</label>
              <input
                type="number"
                min="0"
                max="12"
                value={initialPediatricAsthmaScore}
                onChange={(e) => setInitialPediatricAsthmaScore(parseInt(e.target.value) || 9)}
                required
              />
            </div>
          </div>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Blood Gas, Oxygenation & Diaphragmatic Exhaustion</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label>Respiratory Rate (bpm) *</label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(parseInt(e.target.value) || 40)}
                  required
                />
              </div>

              <div>
                <label>Heart Rate (bpm) *</label>
                <input
                  type="number"
                  min="40"
                  max="250"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(parseInt(e.target.value) || 130)}
                  required
                />
              </div>

              <div>
                <label>SpO2 (%) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="50"
                  max="100"
                  value={spo2Percent}
                  onChange={(e) => setSpo2Percent(parseFloat(e.target.value) || 92)}
                  required
                />
              </div>

              <div>
                <label>pCO2 (mmHg) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="15"
                  max="120"
                  value={pco2Mmhg}
                  onChange={(e) => setPco2Mmhg(parseFloat(e.target.value) || 40)}
                  required
                />
                <span className="small muted">&ge; 42 mmHg indicates diaphragmatic fatigue!</span>
              </div>

              <div>
                <label>Blood Gas pH *</label>
                <input
                  type="number"
                  step="0.01"
                  min="6.8"
                  max="7.8"
                  value={phValue}
                  onChange={(e) => setPhValue(parseFloat(e.target.value) || 7.35)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <label><input type="checkbox" checked={silentChestOrExhaustion} onChange={(e) => setSilentChestOrExhaustion(e.target.checked)} /> <strong>Silent Chest / Extreme Exhaustion</strong></label>
              <label><input type="checkbox" checked={refractoryToFirstLine} onChange={(e) => setRefractoryToFirstLine(e.target.checked)} /> Refractory to Continuous Albuterol + Steroids + MgSO4</label>
            </div>
          </fieldset>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ffb74d', borderRadius: 6, backgroundColor: '#fff8e1' }}>
            <legend style={{ fontWeight: 'bold', color: '#e65100' }}>PICU Second-Line Pharmacotherapy & Ventilator Modes</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div>
                <label><input type="checkbox" checked={continuousIvTerbutalineActive} onChange={(e) => setContinuousIvTerbutalineActive(e.target.checked)} /> IV Terbutaline Infusion</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={terbutalineDoseMcgKgMin}
                    onChange={(e) => setTerbutalineDoseMcgKgMin(parseFloat(e.target.value) || 0)}
                  />
                  <span className="small muted">mcg/kg/min</span>
                </div>
              </div>

              <div>
                <label><input type="checkbox" checked={ivKetamineInfusionActive} onChange={(e) => setIvKetamineInfusionActive(e.target.checked)} /> IV Ketamine Bronchodilation</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={ketamineDoseMgKgHr}
                    onChange={(e) => setKetamineDoseMgKgHr(parseFloat(e.target.value) || 0)}
                  />
                  <span className="small muted">mg/kg/hr</span>
                </div>
              </div>

              <div>
                <label><input type="checkbox" checked={helioxInhalationActive} onChange={(e) => setHelioxInhalationActive(e.target.checked)} /> Heliox Inhalation</label>
                <select
                  value={helioxMixtureRatio}
                  onChange={(e) => setHelioxMixtureRatio(e.target.value as HelioxMixtureRatio)}
                  style={{ marginTop: 4 }}
                >
                  <option value="none">None</option>
                  <option value="heliox_80_20">Heliox 80:20 (80% He / 20% O2)</option>
                  <option value="heliox_70_30">Heliox 70:30 (70% He / 30% O2)</option>
                </select>
              </div>

              <div>
                <label>Ventilatory Support Mode *</label>
                <select
                  value={ventilatorySupportMode}
                  onChange={(e) => setVentilatorySupportMode(e.target.value as VentilatorySupportMode)}
                  required
                >
                  <option value="high_flow_nasal_cannula">High-Flow Nasal Cannula (HFNC)</option>
                  <option value="bipap_noninvasive_positive_pressure">BiPAP Non-Invasive Ventilation</option>
                  <option value="invasive_mechanical_ventilation_permissive_hypercapnia">Invasive Mechanical Ventilation (Permissive Hypercapnia)</option>
                  <option value="standard_low_flow_oxygen">Standard Low-Flow Oxygen</option>
                </select>
              </div>

              <div>
                <label><input type="checkbox" checked={ivTheophyllineAminophyllineActive} onChange={(e) => setIvTheophyllineAminophyllineActive(e.target.checked)} /> IV Aminophylline Infusion</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PediatricRefractoryAsthmaStatus)}
                  style={{ marginTop: 4 }}
                >
                  <option value="impending_respiratory_failure">Impending Respiratory Failure</option>
                  <option value="second_line_iv_bronchodilator_infusion">Second-Line IV Bronchodilators</option>
                  <option value="bipap_noninvasive_support">BiPAP Non-Invasive Support</option>
                  <option value="invasive_mechanical_ventilation_picu">Invasive Mechanical Ventilation</option>
                  <option value="bronchospasm_relieving_weaning">Bronchospasm Relieving / Weaning</option>
                  <option value="extubated_convalescent_stepdown">Extubated / Stepdown</option>
                  <option value="resolved_transferred_to_ward">Resolved / Transferred to Ward</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Clinical Decision Support Preview Box */}
          {preview && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: preview.isImpendingRespiratoryArrest ? '#ffebee' : '#f0f4f8', borderRadius: 6, borderLeft: `5px solid ${preview.isImpendingRespiratoryArrest ? '#d32f2f' : '#1976d2'}` }}>
              <h4 style={{ margin: '0 0 8px 0', color: preview.isImpendingRespiratoryArrest ? '#d32f2f' : '#1976d2' }}>
                Refractory Asthma Rescue Analysis: {preview.urgencyTierLabel}
              </h4>
              <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                <strong>Impending Respiratory Arrest:</strong> {preview.isImpendingRespiratoryArrest ? 'YES (CRITICAL)' : 'NO'} | <strong>Terbutaline Load:</strong> {preview.terbutalineLoadingDoseMcg} mcg (then {preview.terbutalineInfusionRange}) | <strong>Ketamine Load:</strong> {preview.ketamineLoadingDoseMg} mg (then {preview.ketamineInfusionDoseMgHr} mg/hr)
              </p>

              {preview.alerts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {preview.alerts.map((al, idx) => (
                    <div key={idx} style={{ color: '#b71c1c', fontWeight: 'bold', fontSize: '0.85rem' }}>⚠️ {al}</div>
                  ))}
                </div>
              )}

              {preview.ventilatoryManagementDirectives.length > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.85rem' }}>
                  <strong>Ventilator Directives:</strong>
                  <ul style={{ margin: '2px 0 0 16px', padding: 0 }}>
                    {preview.ventilatoryManagementDirectives.map((vd, idx) => <li key={idx}>{vd}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label>PICU Clinical Notes & Intensivist Impression</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Diaphragmatic exhaustion, worsening hypercapnia despite continuous albuterol, initiated IV Ketamine and BiPAP IPAP 14 / EPAP 5..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : currentEp ? 'Update Episode' : 'Create Refractory Asthma Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
