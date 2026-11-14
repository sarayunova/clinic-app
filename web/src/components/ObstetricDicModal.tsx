import React, { useState, useEffect } from 'react';
import {
  createObstetricDicEpisode,
  updateObstetricDicEpisode,
  type ObstetricDicRecord,
} from '../api';
import {
  evaluateObstetricDic,
  type ObstetricDicEvaluationResult,
  type ObstetricDicTrigger,
  type OvertBleedingSites,
} from '../obstetricDicEngine';

interface Props {
  patientId: number;
  initialEpisode?: ObstetricDicRecord | null;
  existingEpisode?: ObstetricDicRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const ObstetricDicModal: React.FC<Props> = ({
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
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<string>(
    currentEp?.gestational_age_weeks !== null && currentEp?.gestational_age_weeks !== undefined
      ? String(currentEp.gestational_age_weeks)
      : '36.5'
  );
  const [clinicalTrigger, setClinicalTrigger] = useState<ObstetricDicTrigger>(
    currentEp?.clinical_trigger ?? 'severe_pph'
  );
  const [plateletCountKUl, setPlateletCountKUl] = useState<number>(
    currentEp?.platelet_count_k_ul ?? 85
  );
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<number>(
    currentEp?.fibrinogen_mg_dl ?? 140
  );
  const [prothrombinTimeSec, setProthrombinTimeSec] = useState<string>(
    currentEp?.prothrombin_time_sec ? String(currentEp.prothrombin_time_sec) : '18.5'
  );
  const [controlPtSec, setControlPtSec] = useState<string>(
    currentEp?.control_pt_sec ? String(currentEp.control_pt_sec) : '12.0'
  );
  const [inr, setInr] = useState<number>(
    currentEp?.inr ?? 1.55
  );
  const [apttSec, setApttSec] = useState<string>(
    currentEp?.aptt_sec ? String(currentEp.aptt_sec) : '48'
  );
  const [dDimerUgMl, setDDimerUgMl] = useState<string>(
    currentEp?.d_dimer_ug_ml ? String(currentEp.d_dimer_ug_ml) : '6.5'
  );
  const [estimatedBloodLossMl, setEstimatedBloodLossMl] = useState<number>(
    currentEp?.estimated_blood_loss_ml ?? 1500
  );
  const [overtBleedingSites, setOvertBleedingSites] = useState<OvertBleedingSites>(
    currentEp?.overt_bleeding_sites ?? 'surgical_site_oozing'
  );
  const [isMtpActivated, setIsMtpActivated] = useState<boolean>(
    currentEp ? Boolean(currentEp.is_mtp_activated) : true
  );
  const [prbcUnitsGiven, setPrbcUnitsGiven] = useState<number>(
    currentEp?.prbc_units_given ?? 4
  );
  const [ffpUnitsGiven, setFfpUnitsGiven] = useState<number>(
    currentEp?.ffp_units_given ?? 4
  );
  const [plateletPoolsGiven, setPlateletPoolsGiven] = useState<number>(
    currentEp?.platelet_pools_given ?? 1
  );
  const [cryoprecipitateUnitsGiven, setCryoprecipitateUnitsGiven] = useState<number>(
    currentEp?.cryoprecipitate_units_given ?? 10
  );
  const [fibrinogenConcentrateGGiven, setFibrinogenConcentrateGGiven] = useState<number>(
    currentEp?.fibrinogen_concentrate_g_given ?? 0
  );
  const [tranexamicAcidGiven, setTranexamicAcidGiven] = useState<boolean>(
    currentEp ? Boolean(currentEp.tranexamic_acid_given) : true
  );
  const [ionizedCalciumMmolL, setIonizedCalciumMmolL] = useState<string>(
    currentEp?.ionized_calcium_mmol_l ? String(currentEp.ionized_calcium_mmol_l) : '1.05'
  );
  const [coreTemperatureC, setCoreTemperatureC] = useState<string>(
    currentEp?.core_temperature_c ? String(currentEp.core_temperature_c) : '35.8'
  );
  const [status, setStatus] = useState<'active' | 'stabilized' | 'resolved' | 'transferred'>(
    currentEp?.status ?? 'active'
  );
  const [clinicalSummary, setClinicalSummary] = useState<string>(
    currentEp?.clinical_summary ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ObstetricDicEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateObstetricDic({
        gestationalAgeWeeks: gestationalAgeWeeks ? parseFloat(gestationalAgeWeeks) : null,
        clinicalTrigger,
        plateletCountKUl,
        fibrinogenMgDl,
        inr,
        prothrombinTimeSec: prothrombinTimeSec ? parseFloat(prothrombinTimeSec) : null,
        controlPtSec: controlPtSec ? parseFloat(controlPtSec) : null,
        apttSec: apttSec ? parseFloat(apttSec) : null,
        dDimerUgMl: dDimerUgMl ? parseFloat(dDimerUgMl) : null,
        estimatedBloodLossMl,
        overtBleedingSites,
        isMtpActivated,
        ionizedCalciumMmolL: ionizedCalciumMmolL ? parseFloat(ionizedCalciumMmolL) : null,
        coreTemperatureC: coreTemperatureC ? parseFloat(coreTemperatureC) : null,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [
    gestationalAgeWeeks,
    clinicalTrigger,
    plateletCountKUl,
    fibrinogenMgDl,
    inr,
    prothrombinTimeSec,
    controlPtSec,
    apttSec,
    dDimerUgMl,
    estimatedBloodLossMl,
    overtBleedingSites,
    isMtpActivated,
    ionizedCalciumMmolL,
    coreTemperatureC,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      diagnosisDatetime,
      gestationalAgeWeeks: gestationalAgeWeeks ? parseFloat(gestationalAgeWeeks) : null,
      clinicalTrigger,
      plateletCountKUl,
      fibrinogenMgDl,
      prothrombinTimeSec: prothrombinTimeSec ? parseFloat(prothrombinTimeSec) : null,
      controlPtSec: controlPtSec ? parseFloat(controlPtSec) : null,
      inr,
      apttSec: apttSec ? parseFloat(apttSec) : null,
      dDimerUgMl: dDimerUgMl ? parseFloat(dDimerUgMl) : null,
      estimatedBloodLossMl,
      overtBleedingSites,
      isMtpActivated,
      prbcUnitsGiven,
      ffpUnitsGiven,
      plateletPoolsGiven,
      cryoprecipitateUnitsGiven,
      fibrinogenConcentrateGGiven,
      tranexamicAcidGiven,
      ionizedCalciumMmolL: ionizedCalciumMmolL ? parseFloat(ionizedCalciumMmolL) : null,
      coreTemperatureC: coreTemperatureC ? parseFloat(coreTemperatureC) : null,
      status,
      clinicalSummary: clinicalSummary || null,
    };

    try {
      if (currentEp) {
        await updateObstetricDicEpisode(currentEp.id, payload);
        onSaved?.();
        onSuccess?.(currentEp.id);
      } else {
        const res = await createObstetricDicEpisode(payload);
        onSaved?.();
        onSuccess?.(res.id);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save obstetric DIC episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 860, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {currentEp ? 'Edit Obstetric DIC Record' : 'Initiate Obstetric DIC & Fibrinogen-Guided Resuscitation'}
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
              <label>Gestational Age (weeks)</label>
              <input
                type="number"
                step="0.1"
                min="12"
                max="44"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                placeholder="e.g. 38.0"
              />
            </div>
            <div>
              <label>Primary Clinical Trigger *</label>
              <select
                value={clinicalTrigger}
                onChange={(e) => setClinicalTrigger(e.target.value as ObstetricDicTrigger)}
              >
                <option value="severe_pph">Severe Postpartum Hemorrhage (PPH)</option>
                <option value="placental_abruption">Abruptio Placentae (Concealed / Revealed)</option>
                <option value="amniotic_fluid_embolism">Amniotic Fluid Embolism (AFE)</option>
                <option value="severe_preeclampsia_hellp">Severe Preeclampsia / HELLP Syndrome</option>
                <option value="septic_abortion_chorioamnionitis">Sepsis / Chorioamnionitis / Septic Abortion</option>
                <option value="retained_dead_fetus">Prolonged Retained Dead Fetus (&gt; 4 weeks)</option>
                <option value="acute_fatty_liver">Acute Fatty Liver of Pregnancy (AFLP)</option>
              </select>
            </div>
            <div>
              <label>Estimated Blood Loss (mL) *</label>
              <input
                type="number"
                step="50"
                min="0"
                value={estimatedBloodLossMl}
                onChange={(e) => setEstimatedBloodLossMl(parseInt(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Coagulation Profile & Consumptive Markers</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label>Fibrinogen (mg/dL) *</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="1200"
                  value={fibrinogenMgDl}
                  onChange={(e) => setFibrinogenMgDl(parseFloat(e.target.value) || 0)}
                  required
                />
                <span style={{ fontSize: '0.8em', color: fibrinogenMgDl < 200 ? '#d9534f' : '#666' }}>
                  Target &ge; 200 mg/dL in Pregnancy
                </span>
              </div>
              <div>
                <label>Platelet Count (x10^3/µL) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={plateletCountKUl}
                  onChange={(e) => setPlateletCountKUl(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <label>INR *</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  value={inr}
                  onChange={(e) => setInr(parseFloat(e.target.value) || 1.0)}
                  required
                />
              </div>
              <div>
                <label>aPTT (seconds)</label>
                <input
                  type="number"
                  step="0.5"
                  value={apttSec}
                  onChange={(e) => setApttSec(e.target.value)}
                  placeholder="e.g. 48"
                />
              </div>
              <div>
                <label>D-Dimer (µg/mL FEU)</label>
                <input
                  type="number"
                  step="0.1"
                  value={dDimerUgMl}
                  onChange={(e) => setDDimerUgMl(e.target.value)}
                  placeholder="e.g. 6.5"
                />
              </div>
              <div>
                <label>Overt Bleeding Sites *</label>
                <select
                  value={overtBleedingSites}
                  onChange={(e) => setOvertBleedingSites(e.target.value as OvertBleedingSites)}
                >
                  <option value="none">No Overt Bleeding Outside Uterus</option>
                  <option value="surgical_site_oozing">Surgical Site / Wound Oozing</option>
                  <option value="iv_cannula_sites">IV Cannula / Puncture Sites Bleeding</option>
                  <option value="hematuria_gi">Hematuria / GI Tract Bleeding</option>
                  <option value="catastrophic_generalized">Catastrophic Generalized Microvascular Hemorrhage</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Transfusion Resuscitation & The Lethal Triad</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={isMtpActivated}
                    onChange={(e) => setIsMtpActivated(e.target.checked)}
                  />
                  Massive Transfusion Protocol (MTP) Active
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={tranexamicAcidGiven}
                    onChange={(e) => setTranexamicAcidGiven(e.target.checked)}
                  />
                  IV Tranexamic Acid (TXA 1g) Given
                </label>
              </div>
              <div>
                <label>PRBC Units Infused</label>
                <input
                  type="number"
                  min="0"
                  value={prbcUnitsGiven}
                  onChange={(e) => setPrbcUnitsGiven(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label>FFP Units Infused</label>
                <input
                  type="number"
                  min="0"
                  value={ffpUnitsGiven}
                  onChange={(e) => setFfpUnitsGiven(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label>Platelet Pools Infused</label>
                <input
                  type="number"
                  min="0"
                  value={plateletPoolsGiven}
                  onChange={(e) => setPlateletPoolsGiven(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label>Cryoprecipitate (Units)</label>
                <input
                  type="number"
                  min="0"
                  value={cryoprecipitateUnitsGiven}
                  onChange={(e) => setCryoprecipitateUnitsGiven(parseInt(e.target.value) || 0)}
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
                <span style={{ fontSize: '0.8em', color: '#666' }}>Target &gt; 1.15 mmol/L</span>
              </div>
              <div>
                <label>Core Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={coreTemperatureC}
                  onChange={(e) => setCoreTemperatureC(e.target.value)}
                  placeholder="e.g. 36.5"
                />
                <span style={{ fontSize: '0.8em', color: '#666' }}>Target &gt; 36.0 °C</span>
              </div>
            </div>
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
            <div>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="active">Active Resuscitation</option>
                <option value="stabilized">Stabilized / Coagulopathy Corrected</option>
                <option value="resolved">Resolved / Hemostasis Achieved</option>
                <option value="transferred">Transferred to Tertiary Center</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Clinical Notes / Surgical Interventions</label>
            <textarea
              rows={2}
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              placeholder="e.g. B-Lynch uterine compression suture placed; intrauterine balloon tamponade inflated; uterine artery ligation performed..."
            />
          </div>

          {preview && (
            <div
              className={`card ${
                preview.severityCategory === 'overt_consumptive_dic'
                  ? 'border-danger'
                  : preview.severityCategory === 'evolving_non_overt_dic'
                  ? 'border-warning'
                  : 'border-info'
              }`}
              style={{ marginTop: 16, padding: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge" style={{ fontWeight: 'bold' }}>
                  {preview.severityLabel} (ISTH Score: {preview.modifiedIsthDicScore}/8)
                </span>
                <span style={{ color: preview.fibrinogenPlan.isCriticalHypofibrinogenemia ? '#d9534f' : 'inherit' }}>
                  <strong>Cryoprecipitate Needed: </strong>
                  {preview.fibrinogenPlan.recommendedCryoprecipitateUnits} Units (or {preview.fibrinogenPlan.recommendedFibrinogenConcentrateGrams}g Concentrate)
                </span>
              </div>

              <div style={{ marginTop: 8 }}>
                <strong>Fibrinogen Target: </strong> {preview.fibrinogenPlan.rationale}
              </div>

              {preview.clinicalAlerts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Critical Warnings:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {preview.clinicalAlerts.map((alert, idx) => (
                      <li key={idx} style={{ color: '#d9534f' }}>{alert}</li>
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
              {saving ? 'Saving...' : currentEp ? 'Update Record' : 'Initiate Resuscitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
