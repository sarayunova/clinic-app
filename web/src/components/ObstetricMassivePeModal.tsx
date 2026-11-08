import React, { useState, useEffect } from 'react';
import {
  createObstetricMassivePeEpisode,
  updateObstetricMassivePeEpisode,
  type ObstetricMassivePeRecord,
} from '../api';
import {
  evaluateObstetricMassivePe,
  type ObstetricMassivePeEvaluation,
  type ClinicalSetting,
  type PeRiskStratification,
  type ThrombolyticAgentDose,
  type ObstetricMassivePeStatus,
} from '../obstetricMassivePeEngine';

interface Props {
  patientId: number;
  initialEpisode?: ObstetricMassivePeRecord | null;
  existingEpisode?: ObstetricMassivePeRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const ObstetricMassivePeModal: React.FC<Props> = ({
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
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    currentEp?.gestational_age_weeks ?? 34.0
  );
  const [clinicalSetting, setClinicalSetting] = useState<ClinicalSetting>(
    currentEp?.clinical_setting ?? 'immediate_postpartum_puerperium'
  );
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<number>(
    currentEp?.systolic_bp_mmhg ?? 82
  );
  const [heartRateBpm, setHeartRateBpm] = useState<number>(
    currentEp?.heart_rate_bpm ?? 136
  );
  const [respiratoryRate, setRespiratoryRate] = useState<number>(
    currentEp?.respiratory_rate ?? 36
  );
  const [spo2Percent, setSpo2Percent] = useState<number>(
    currentEp?.spo2_percent ?? 88.0
  );
  const [hemodynamicInstabilityShock, setHemodynamicInstabilityShock] = useState<boolean>(
    currentEp ? Boolean(currentEp.hemodynamic_instability_shock) : true
  );
  const [rvDysfunctionEchoConfirmed, setRvDysfunctionEchoConfirmed] = useState<boolean>(
    currentEp ? Boolean(currentEp.rv_dysfunction_echo_confirmed) : true
  );
  const [cardiacBiomarkersElevated, setCardiacBiomarkersElevated] = useState<boolean>(
    currentEp ? Boolean(currentEp.cardiac_biomarkers_elevated) : true
  );
  const [peRiskStratification, setPeRiskStratification] = useState<PeRiskStratification>(
    currentEp?.pe_risk_stratification ?? 'high_risk_massive_pe'
  );
  const [thrombolyticTherapyAdministered, setThrombolyticTherapyAdministered] = useState<boolean>(
    currentEp ? Boolean(currentEp.thrombolytic_therapy_administered) : true
  );
  const [thrombolyticAgentDose, setThrombolyticAgentDose] = useState<ThrombolyticAgentDose>(
    (currentEp?.thrombolytic_agent_dose as ThrombolyticAgentDose) ?? 'alteplase_100mg_over_2hr'
  );
  const [systemicUfhInfusionActive, setSystemicUfhInfusionActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.systemic_ufh_infusion_active) : true
  );
  const [targetApttSeconds, setTargetApttSeconds] = useState<number>(
    currentEp?.target_aptt_seconds ?? 70.0
  );
  const [catheterDirectedOrSurgicalEmbolectomy, setCatheterDirectedOrSurgicalEmbolectomy] = useState<boolean>(
    currentEp ? Boolean(currentEp.catheter_directed_or_surgical_embolectomy) : false
  );
  const [inferiorVenaCavaFilterPlaced, setInferiorVenaCavaFilterPlaced] = useState<boolean>(
    currentEp ? Boolean(currentEp.inferior_vena_cava_filter_placed) : false
  );
  const [status, setStatus] = useState<ObstetricMassivePeStatus>(
    (currentEp?.status as ObstetricMassivePeStatus) ?? 'acute_massive_pe_resuscitation'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ObstetricMassivePeEvaluation | null>(null);

  useEffect(() => {
    try {
      const evalResult = evaluateObstetricMassivePe({
        gestationalAgeWeeks,
        clinicalSetting,
        systolicBpMmhg,
        heartRateBpm,
        respiratoryRate,
        spo2Percent,
        hemodynamicInstabilityShock,
        rvDysfunctionEchoConfirmed,
        cardiacBiomarkersElevated,
        peRiskStratification,
        thrombolyticTherapyAdministered,
        thrombolyticAgentDose,
        systemicUfhInfusionActive,
        targetApttSeconds,
        catheterDirectedOrSurgicalEmbolectomy,
        inferiorVenaCavaFilterPlaced,
        status,
      });
      setPreview(evalResult);
    } catch {
      // preview calculation error suppressed
    }
  }, [
    gestationalAgeWeeks,
    clinicalSetting,
    systolicBpMmhg,
    heartRateBpm,
    respiratoryRate,
    spo2Percent,
    hemodynamicInstabilityShock,
    rvDysfunctionEchoConfirmed,
    cardiacBiomarkersElevated,
    peRiskStratification,
    thrombolyticTherapyAdministered,
    thrombolyticAgentDose,
    systemicUfhInfusionActive,
    targetApttSeconds,
    catheterDirectedOrSurgicalEmbolectomy,
    inferiorVenaCavaFilterPlaced,
    status,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      gestationalAgeWeeks,
      clinicalSetting,
      systolicBpMmhg,
      heartRateBpm,
      respiratoryRate,
      spo2Percent,
      hemodynamicInstabilityShock,
      rvDysfunctionEchoConfirmed,
      cardiacBiomarkersElevated,
      peRiskStratification,
      thrombolyticTherapyAdministered,
      thrombolyticAgentDose,
      systemicUfhInfusionActive,
      targetApttSeconds,
      catheterDirectedOrSurgicalEmbolectomy,
      inferiorVenaCavaFilterPlaced,
      status,
      clinicalNotes: clinicalNotes || null,
    };

    try {
      if (currentEp) {
        await updateObstetricMassivePeEpisode(currentEp.id, payload);
        onSuccess?.(currentEp.id);
      } else {
        const res = await createObstetricMassivePeEpisode(payload);
        onSuccess?.(res.episode.id);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save obstetric massive PE episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {currentEp ? 'Edit Massive PE Episode' : 'New Obstetric Massive PE & Right Heart Failure Protocol'}
            </h2>
            <p className="text-xs text-rose-100">
              RCOG Green-top 37b / ESC Guidelines: Shock, RV Strain, Thrombolysis & UFH Titration
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-rose-200 text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {/* Clinical Real-Time Decision Preview */}
          {preview && (
            <div className={`p-4 rounded-lg border ${
              preview.urgencyTier === 'emergency_massive_pe_thrombolysis'
                ? 'bg-red-50 border-red-300'
                : preview.urgencyTier === 'urgent_submassive_icu_ufh'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-emerald-50 border-emerald-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm tracking-wide uppercase">
                  {preview.urgencyTierLabel}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/80 shadow-sm">
                  {preview.thrombolysisIndicated ? 'Thrombolysis Indicated' : 'Anticoagulation Alone'}
                </span>
              </div>

              {preview.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {preview.alerts.map((al, idx) => (
                    <div key={idx} className="text-xs font-semibold text-red-700 flex items-start gap-1.5">
                      <span>⚠️</span>
                      <span>{al}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-600 block">UFH Bolus Dose:</span>
                  <span className="font-bold">{preview.initialUfhBolusUnits} units IV</span>
                </div>
                <div>
                  <span className="text-gray-600 block">UFH Maintenance Rate:</span>
                  <span className="font-bold">{preview.initialUfhInfusionUnitsHr} units/hr</span>
                </div>
                <div>
                  <span className="text-gray-600 block">Target aPTT:</span>
                  <span className="font-bold">{targetApttSeconds} s (1.5–2.5x control)</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Demographics & Onset */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Onset Datetime *</label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Gestational Age (Weeks) *</label>
              <input
                type="number"
                step="0.1"
                min="12"
                max="43"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Setting *</label>
              <select
                value={clinicalSetting}
                onChange={(e) => setClinicalSetting(e.target.value as ClinicalSetting)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="antenatal_antepartum">Antenatal / Antepartum</option>
                <option value="intrapartum_labor">Intrapartum / Active Labor</option>
                <option value="immediate_postpartum_puerperium">Immediate Postpartum (Vaginal Delivery)</option>
                <option value="post_cesarean_section">Post-Cesarean Section</option>
              </select>
            </div>
          </div>

          {/* Section 2: Hemodynamics & Shock Assessment */}
          <div className="border border-rose-200 bg-rose-50/30 p-4 rounded-lg space-y-4">
            <h3 className="text-sm font-bold text-rose-900 border-b border-rose-200 pb-1">
              Hemodynamics, Hypoxemia & Right Ventricular Strain
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Systolic BP (mmHg) *</label>
                <input
                  type="number"
                  min="30"
                  max="250"
                  value={systolicBpMmhg}
                  onChange={(e) => setSystolicBpMmhg(parseInt(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm font-bold text-rose-800"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">SBP &lt; 90 mmHg = Massive Shock</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heart Rate (bpm) *</label>
                <input
                  type="number"
                  min="30"
                  max="250"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(parseInt(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Resp Rate (bpm) *</label>
                <input
                  type="number"
                  min="5"
                  max="80"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(parseInt(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SpO2 (%) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="40"
                  max="100"
                  value={spo2Percent}
                  onChange={(e) => setSpo2Percent(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800 bg-white p-2.5 rounded border">
                <input
                  type="checkbox"
                  checked={hemodynamicInstabilityShock}
                  onChange={(e) => setHemodynamicInstabilityShock(e.target.checked)}
                />
                <span>Hemodynamic Collapse / SBP &lt; 90 mmHg &ge; 15 min</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800 bg-white p-2.5 rounded border">
                <input
                  type="checkbox"
                  checked={rvDysfunctionEchoConfirmed}
                  onChange={(e) => setRvDysfunctionEchoConfirmed(e.target.checked)}
                />
                <span>Echo RV Dysfunction (TAPSE &lt;16mm, McConnell sign)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800 bg-white p-2.5 rounded border">
                <input
                  type="checkbox"
                  checked={cardiacBiomarkersElevated}
                  onChange={(e) => setCardiacBiomarkersElevated(e.target.checked)}
                />
                <span>Troponin / NT-proBNP Elevated</span>
              </label>
            </div>
          </div>

          {/* Section 3: Risk Stratification & Thrombolysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">PE Risk Stratification *</label>
              <select
                value={peRiskStratification}
                onChange={(e) => setPeRiskStratification(e.target.value as PeRiskStratification)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="high_risk_massive_pe">High-Risk Massive PE (Shock / SBP &lt; 90)</option>
                <option value="intermediate_high_risk_submassive">Intermediate-High Risk Submassive (RV Strain + Biomarkers)</option>
                <option value="intermediate_low_risk">Intermediate-Low Risk (RV Strain or Biomarkers alone)</option>
                <option value="low_risk_nonmassive">Low-Risk Non-Massive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Thrombolytic Regimen *</label>
              <select
                value={thrombolyticAgentDose}
                onChange={(e) => setThrombolyticAgentDose(e.target.value as ThrombolyticAgentDose)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="alteplase_100mg_over_2hr">Alteplase 100 mg IV over 2 hours</option>
                <option value="alteplase_50mg_rapid_cardiac_arrest">Alteplase 50 mg IV Rapid Push (Cardiac Arrest)</option>
                <option value="alteplase_0_6mg_kg_bolus_15min">Alteplase 0.6 mg/kg Bolus over 15 min</option>
                <option value="none_contraindicated_or_surgical">None / Surgical Embolectomy Plan</option>
              </select>
            </div>
          </div>

          {/* Section 4: Anticoagulation & Advanced Interventions */}
          <div className="border border-gray-200 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-1">
              Therapeutic Heparin & Advanced Cardiopulmonary Interventions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={systemicUfhInfusionActive}
                  onChange={(e) => setSystemicUfhInfusionActive(e.target.checked)}
                />
                <span>IV Unfractionated Heparin (UFH) Active</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={thrombolyticTherapyAdministered}
                  onChange={(e) => setThrombolyticTherapyAdministered(e.target.checked)}
                />
                <span>Systemic Thrombolysis Administered</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={catheterDirectedOrSurgicalEmbolectomy}
                  onChange={(e) => setCatheterDirectedOrSurgicalEmbolectomy(e.target.checked)}
                />
                <span>Catheter / Surgical Embolectomy</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={inferiorVenaCavaFilterPlaced}
                  onChange={(e) => setInferiorVenaCavaFilterPlaced(e.target.checked)}
                />
                <span>IVC Filter Placed</span>
              </label>

              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Target aPTT (seconds)</label>
                <input
                  type="number"
                  step="1"
                  min="40"
                  max="120"
                  value={targetApttSeconds}
                  onChange={(e) => setTargetApttSeconds(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Clinical Protocol Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ObstetricMassivePeStatus)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="acute_massive_pe_resuscitation">Acute Massive PE Resuscitation</option>
                  <option value="thrombolytic_infusion_icu">Thrombolytic Infusion ICU</option>
                  <option value="therapeutic_heparin_titration">Therapeutic Heparin Titration</option>
                  <option value="catheter_embolectomy_surgical">Catheter / Surgical Embolectomy</option>
                  <option value="subacute_transition_lmwh">Subacute Transition to LMWH</option>
                  <option value="convalescent_anticoagulation_plan">Convalescent Anticoagulation Plan</option>
                  <option value="maternal_demise">Maternal Demise</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Notes & Team Coordination</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record bedside echocardiography findings, aPTT response, obstetric bleeding surveillance, and ICU handover..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-700 text-white rounded-lg text-sm font-medium hover:bg-rose-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : currentEp ? 'Update Episode' : 'Create Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
