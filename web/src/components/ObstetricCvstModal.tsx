import React, { useState, useEffect } from 'react';
import {
  createObstetricCvstEpisode,
  updateObstetricCvstEpisode,
  type ObstetricCvstRecord,
} from '../api';
import {
  evaluateObstetricCvst,
  type ObstetricCvstEvaluation,
  type ClinicalTiming,
  type HeadacheType,
  type AnticoagulantAgent,
  type IntracranialHypertensionManagement,
  type ObstetricCvstStatus,
} from '../obstetricCvstEngine';

interface Props {
  patientId: number;
  initialEpisode?: ObstetricCvstRecord | null;
  existingEpisode?: ObstetricCvstRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const ObstetricCvstModal: React.FC<Props> = ({
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
    currentEp?.gestational_age_weeks ?? 39.0
  );
  const [clinicalTiming, setClinicalTiming] = useState<ClinicalTiming>(
    (currentEp?.clinical_timing as ClinicalTiming) ?? 'early_postpartum_puerperium'
  );
  const [presentingHeadacheType, setPresentingHeadacheType] = useState<HeadacheType>(
    (currentEp?.presenting_headache_type as HeadacheType) ?? 'progressive_unremitting_subacute'
  );
  const [seizuresPresent, setSeizuresPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.seizures_present) : false
  );
  const [papilledemaPresent, setPapilledemaPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.papilledema_present) : true
  );
  const [focalNeurologicalDeficit, setFocalNeurologicalDeficit] = useState<boolean>(
    currentEp ? Boolean(currentEp.focal_neurological_deficit) : false
  );
  const [alteredMentalStatusComa, setAlteredMentalStatusComa] = useState<boolean>(
    currentEp ? Boolean(currentEp.altered_mental_status_coma) : false
  );
  const [thrombosedSinusLocations, setThrombosedSinusLocations] = useState<string[]>(() => {
    if (!currentEp?.thrombosed_sinus_locations_json) return ['superior_sagittal_sinus'];
    try {
      return JSON.parse(currentEp.thrombosed_sinus_locations_json);
    } catch {
      return ['superior_sagittal_sinus'];
    }
  });
  const [intracranialHemorrhagicVenousInfarct, setIntracranialHemorrhagicVenousInfarct] = useState<boolean>(
    currentEp ? Boolean(currentEp.intracranial_hemorrhagic_venous_infarct) : true
  );
  const [therapeuticAnticoagulationActive, setTherapeuticAnticoagulationActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.therapeutic_anticoagulation_active) : true
  );
  const [anticoagulantAgent, setAnticoagulantAgent] = useState<AnticoagulantAgent>(
    (currentEp?.anticoagulant_agent as AnticoagulantAgent) ?? 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h'
  );
  const [intracranialHypertensionManagement, setIntracranialHypertensionManagement] = useState<IntracranialHypertensionManagement>(
    (currentEp?.intracranial_hypertension_management as IntracranialHypertensionManagement) ?? 'elevate_head_bed_and_osmotherapy'
  );
  const [antiepilepticTherapyActive, setAntiepilepticTherapyActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.antiepileptic_therapy_active) : false
  );
  const [status, setStatus] = useState<ObstetricCvstStatus>(
    (currentEp?.status as ObstetricCvstStatus) ?? 'acute_cvst_inpatient_resuscitation'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ObstetricCvstEvaluation | null>(null);

  useEffect(() => {
    try {
      const evalResult = evaluateObstetricCvst({
        gestationalAgeWeeks,
        clinicalTiming,
        presentingHeadacheType,
        seizuresPresent,
        papilledemaPresent,
        focalNeurologicalDeficit,
        alteredMentalStatusComa,
        thrombosedSinusLocations,
        intracranialHemorrhagicVenousInfarct,
        therapeuticAnticoagulationActive,
        anticoagulantAgent,
        intracranialHypertensionManagement,
        antiepilepticTherapyActive,
      });
      setPreview(evalResult);
    } catch {
      setPreview(null);
    }
  }, [
    gestationalAgeWeeks,
    clinicalTiming,
    presentingHeadacheType,
    seizuresPresent,
    papilledemaPresent,
    focalNeurologicalDeficit,
    alteredMentalStatusComa,
    thrombosedSinusLocations,
    intracranialHemorrhagicVenousInfarct,
    therapeuticAnticoagulationActive,
    anticoagulantAgent,
    intracranialHypertensionManagement,
    antiepilepticTherapyActive,
  ]);

  const toggleLocation = (loc: string) => {
    setThrombosedSinusLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      gestationalAgeWeeks,
      clinicalTiming,
      presentingHeadacheType,
      seizuresPresent,
      papilledemaPresent,
      focalNeurologicalDeficit,
      alteredMentalStatusComa,
      thrombosedSinusLocations,
      intracranialHemorrhagicVenousInfarct,
      therapeuticAnticoagulationActive,
      anticoagulantAgent,
      intracranialHypertensionManagement,
      antiepilepticTherapyActive,
      status,
      clinicalNotes: clinicalNotes.trim() || undefined,
    };

    try {
      if (currentEp?.id) {
        await updateObstetricCvstEpisode(currentEp.id, payload);
        if (onSaved) onSaved();
      } else {
        const res = await createObstetricCvstEpisode(payload);
        if (onSuccess) onSuccess(res.episode.id);
        if (onSaved) onSaved();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save obstetric CVST episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {currentEp ? 'Edit Obstetric CVST Episode' : 'Initiate Obstetric Cerebral Venous Sinus Thrombosis (CVST) Protocol'}
          </h3>
          <button className="btn small" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label>Onset Date & Time *</label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Gestational Age / Postpartum (wks) *</label>
              <input
                type="number"
                step="0.1"
                min="0.0"
                max="43.0"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 38.0)}
                required
              />
            </div>

            <div>
              <label>Clinical Timing *</label>
              <select
                value={clinicalTiming}
                onChange={(e) => setClinicalTiming(e.target.value as ClinicalTiming)}
                required
              >
                <option value="early_postpartum_puerperium">Early Postpartum (Day 1–14)</option>
                <option value="late_postpartum">Late Postpartum (&gt; 2 weeks)</option>
                <option value="antepartum_third_trimester">Antepartum (3rd Trimester)</option>
                <option value="antepartum_second_trimester">Antepartum (2nd Trimester)</option>
                <option value="antepartum_first_trimester">Antepartum (1st Trimester)</option>
              </select>
            </div>

            <div>
              <label>Headache Presentation *</label>
              <select
                value={presentingHeadacheType}
                onChange={(e) => setPresentingHeadacheType(e.target.value as HeadacheType)}
                required
              >
                <option value="progressive_unremitting_subacute">Progressive Unremitting (90%)</option>
                <option value="thunderclap_sudden_severe">Thunderclap / Sudden Severe</option>
                <option value="postural_headache_mimicking_pdph">Postural Headache (PDPH Mimic)</option>
                <option value="mild_intermittent">Mild / Intermittent</option>
              </select>
            </div>
          </div>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Neurological Signs & MRV/CTV Neuroimaging</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              <label><input type="checkbox" checked={papilledemaPresent} onChange={(e) => setPapilledemaPresent(e.target.checked)} /> Papilledema / Visual Blurring</label>
              <label><input type="checkbox" checked={seizuresPresent} onChange={(e) => setSeizuresPresent(e.target.checked)} /> Seizure Activity (Focal or Generalized)</label>
              <label><input type="checkbox" checked={focalNeurologicalDeficit} onChange={(e) => setFocalNeurologicalDeficit(e.target.checked)} /> Focal Deficit (Hemiparesis / Aphasia)</label>
              <label><input type="checkbox" checked={alteredMentalStatusComa} onChange={(e) => setAlteredMentalStatusComa(e.target.checked)} /> Altered Sensorium / Coma</label>
              <label><input type="checkbox" checked={intracranialHemorrhagicVenousInfarct} onChange={(e) => setIntracranialHemorrhagicVenousInfarct(e.target.checked)} /> <strong>Hemorrhagic Venous Infarct (CT/MRI)</strong></label>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Thrombosed Sinus Locations (MRV / CTV):</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                {['superior_sagittal_sinus', 'left_transverse_sinus', 'right_transverse_sinus', 'straight_sinus', 'sigmoid_sinus', 'cortical_veins'].map((sinus) => (
                  <label key={sinus} style={{ fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={thrombosedSinusLocations.includes(sinus)}
                      onChange={() => toggleLocation(sinus)}
                    />{' '}
                    {sinus.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #90caf9', borderRadius: 6, backgroundColor: '#f0f7ff' }}>
            <legend style={{ fontWeight: 'bold', color: '#1565c0' }}>Anticoagulation & Intracranial Hypertension Strategy</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div>
                <label><input type="checkbox" checked={therapeuticAnticoagulationActive} onChange={(e) => setTherapeuticAnticoagulationActive(e.target.checked)} /> Therapeutic Anticoagulation Active</label>
                <select
                  value={anticoagulantAgent}
                  onChange={(e) => setAnticoagulantAgent(e.target.value as AnticoagulantAgent)}
                  style={{ marginTop: 6 }}
                >
                  <option value="therapeutic_lmwh_enoxaparin_1mg_kg_q12h">LMWH (Enoxaparin 1 mg/kg q12h)</option>
                  <option value="therapeutic_ufh_continuous_infusion">IV UFH Continuous Infusion (target aPTT 1.5-2.5x)</option>
                  <option value="withheld_severe_mass_effect_neurosurgery">Withheld (Imminent Neurosurgery)</option>
                </select>
              </div>

              <div>
                <label>ICP Management Strategy</label>
                <select
                  value={intracranialHypertensionManagement}
                  onChange={(e) => setIntracranialHypertensionManagement(e.target.value as IntracranialHypertensionManagement)}
                >
                  <option value="elevate_head_bed_and_osmotherapy">Head of Bed 30° + Neutral Neck</option>
                  <option value="mannitol_or_hypertonic_saline_infusion">Osmotherapy (Mannitol / 3% Saline)</option>
                  <option value="decompressive_hemicraniectomy_eval">Decompressive Craniectomy Evaluation</option>
                  <option value="conservative_monitoring">Conservative Monitoring</option>
                </select>
              </div>

              <div>
                <label><input type="checkbox" checked={antiepilepticTherapyActive} onChange={(e) => setAntiepilepticTherapyActive(e.target.checked)} /> Antiseizure Therapy (Levetiracetam)</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ObstetricCvstStatus)}
                  style={{ marginTop: 6 }}
                >
                  <option value="acute_cvst_inpatient_resuscitation">Acute Inpatient Resuscitation</option>
                  <option value="therapeutic_anticoagulation_active">Anticoagulation Active</option>
                  <option value="elevated_icp_critical_monitoring">Elevated ICP Critical Monitoring</option>
                  <option value="endovascular_or_surgical_intervention">Endovascular / Surgical Intervention</option>
                  <option value="subacute_neurological_rehabilitation">Subacute Neuro Rehabilitation</option>
                  <option value="convalescent_long_term_anticoagulation">Convalescent Long-Term LMWH</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Clinical Decision Support Preview Box */}
          {preview && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: preview.isHighRiskCvst ? '#ffebee' : '#f0f4f8', borderRadius: 6, borderLeft: `5px solid ${preview.isHighRiskCvst ? '#d32f2f' : '#1976d2'}` }}>
              <h4 style={{ margin: '0 0 8px 0', color: preview.isHighRiskCvst ? '#d32f2f' : '#1976d2' }}>
                CVST Protocol Engine Analysis: {preview.urgencyTierLabel}
              </h4>
              <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                <strong>High Risk Stratification:</strong> {preview.isHighRiskCvst ? 'YES (Intensive Neuro-ICU Care)' : 'Standard High Priority Inpatient'} | <strong>Anticoagulation in Hemorrhagic Infarct:</strong> {preview.isHemorrhagicInfarctAnticoagulationSafe ? 'SAFE & MANDATED (ESO Guidelines)' : 'Review'}
              </p>

              {preview.alerts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {preview.alerts.map((al, idx) => (
                    <div key={idx} style={{ color: '#b71c1c', fontWeight: 'bold', fontSize: '0.85rem' }}>⚠️ {al}</div>
                  ))}
                </div>
              )}

              {preview.anticoagulationDirectives.length > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.85rem' }}>
                  <strong>Anticoagulation Directives:</strong>
                  <ul style={{ margin: '2px 0 0 16px', padding: 0 }}>
                    {preview.anticoagulationDirectives.map((ad, idx) => <li key={idx}>{ad}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label>Neurology Consultation & Neuroimaging Impression</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. MRV shows loss of flow void in SSS with empty delta sign. Right parietal venous hemorrhagic infarction without midline shift. LMWH therapeutic dose commenced..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : currentEp ? 'Update Episode' : 'Create CVST Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
