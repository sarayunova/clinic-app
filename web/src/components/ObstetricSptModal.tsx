import React, { useState, useEffect } from 'react';
import {
  createObstetricSptEpisode,
  updateObstetricSptEpisode,
  type ObstetricSptRecord,
} from '../api';
import {
  evaluateObstetricSpt,
  type ObstetricSptEvaluationResult,
  type SptPhenotype,
  type DeliveryMode,
  type AffectedVein,
  type PelvicImagingFindings,
  type AnticoagulantRegimen,
  type HeparinChallengeResponse,
} from '../obstetricSptEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricSptRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricSptModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [deliveryDatetime, setDeliveryDatetime] = useState(
    existingEpisode?.delivery_datetime || new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 16)
  );
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(
    existingEpisode?.delivery_mode ?? 'cesarean_section'
  );
  const [postpartumDay, setPostpartumDay] = useState<number>(
    existingEpisode?.postpartum_day ?? 4
  );
  const [sptPhenotype, setSptPhenotype] = useState<SptPhenotype>(
    existingEpisode?.spt_phenotype ?? 'ovarian_vein_thrombosis'
  );
  const [affectedVein, setAffectedVein] = useState<AffectedVein>(
    existingEpisode?.affected_vein ?? 'right_ovarian_vein'
  );
  const [peakTemperatureCelsius, setPeakTemperatureCelsius] = useState<number>(
    existingEpisode?.peak_temperature_celsius ?? 38.9
  );
  const [hoursRefractoryTripleAntibiotics, setHoursRefractoryTripleAntibiotics] = useState<number>(
    existingEpisode?.hours_refractory_triple_antibiotics ?? 48
  );
  const [pelvicCtMriFindings, setPelvicCtMriFindings] = useState<PelvicImagingFindings>(
    existingEpisode?.pelvic_ct_mri_findings ?? 'thrombus_with_rim_enhancement'
  );
  const [pelvicAbscessRuledOut, setPelvicAbscessRuledOut] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.pelvic_abscess_ruled_out) : true
  );
  const [heparinChallengeInitiated, setHeparinChallengeInitiated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.heparin_challenge_initiated) : true
  );
  const [heparinChallengeStartDatetime, setHeparinChallengeStartDatetime] = useState(
    existingEpisode?.heparin_challenge_start_datetime || new Date().toISOString().slice(0, 16)
  );
  const [anticoagulantRegimen, setAnticoagulantRegimen] = useState<AnticoagulantRegimen>(
    existingEpisode?.anticoagulant_regimen ?? 'iv_unfractionated_heparin_infusion'
  );
  const [targetApttSeconds, setTargetApttSeconds] = useState<string>(
    existingEpisode?.target_aptt_seconds ?? '60-85s (1.5-2.5x control)'
  );
  const [defervescenceHours, setDefervescenceHours] = useState<number | ''>(
    existingEpisode?.defervescence_hours ?? ''
  );
  const [heparinChallengeResponse, setHeparinChallengeResponse] = useState<HeparinChallengeResponse>(
    existingEpisode?.heparin_challenge_response ?? 'pending_under_48h'
  );
  const [status, setStatus] = useState<
    | 'heparin_challenge_eval'
    | 'active_therapeutic_anticoagulation'
    | 'afebrile_antibiotic_completion'
    | 'outpatient_anticoagulation_bridge'
    | 'resolved_thrombus_recanalized'
  >(existingEpisode?.status ?? 'heparin_challenge_eval');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ObstetricSptEvaluationResult | null>(null);

  // Recalculate preview
  useEffect(() => {
    try {
      const res = evaluateObstetricSpt({
        deliveryMode,
        postpartumDay: Number(postpartumDay),
        sptPhenotype,
        affectedVein,
        peakTemperatureCelsius: Number(peakTemperatureCelsius),
        hoursRefractoryTripleAntibiotics: Number(hoursRefractoryTripleAntibiotics),
        pelvicCtMriFindings,
        pelvicAbscessRuledOut,
        heparinChallengeInitiated,
        anticoagulantRegimen,
        targetApttSeconds,
        defervescenceHours: defervescenceHours !== '' ? Number(defervescenceHours) : null,
        heparinChallengeResponse,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [
    deliveryMode,
    postpartumDay,
    sptPhenotype,
    affectedVein,
    peakTemperatureCelsius,
    hoursRefractoryTripleAntibiotics,
    pelvicCtMriFindings,
    pelvicAbscessRuledOut,
    heparinChallengeInitiated,
    anticoagulantRegimen,
    targetApttSeconds,
    defervescenceHours,
    heparinChallengeResponse,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      deliveryDatetime,
      deliveryMode,
      postpartumDay: Number(postpartumDay),
      sptPhenotype,
      affectedVein,
      peakTemperatureCelsius: Number(peakTemperatureCelsius),
      hoursRefractoryTripleAntibiotics: Number(hoursRefractoryTripleAntibiotics),
      pelvicCtMriFindings,
      pelvicAbscessRuledOut,
      heparinChallengeInitiated,
      heparinChallengeStartDatetime: heparinChallengeStartDatetime || null,
      anticoagulantRegimen,
      targetApttSeconds,
      defervescenceHours: defervescenceHours !== '' ? Number(defervescenceHours) : null,
      heparinChallengeResponse,
      status,
      clinicalNotes: clinicalNotes.trim() || null,
    };

    try {
      if (existingEpisode) {
        await updateObstetricSptEpisode(existingEpisode.id, payload);
      } else {
        await createObstetricSptEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save obstetric SPT record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '880px' }}>
        <div className="modal-header">
          <h2>
            {existingEpisode ? '✏️ Edit Obstetric SPT Record' : '🌡️ New Septic Pelvic Thrombophlebitis (SPT) Protocol'}
          </h2>
          <button type="button" className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger">{error}</div>}

            {preview && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  background:
                    preview.urgencyTier === 'urgent_heparin_challenge'
                      ? '#fffbeb'
                      : preview.urgencyTier === 'active_therapeutic_management'
                      ? '#eff6ff'
                      : '#f0fdf4',
                  border:
                    preview.urgencyTier === 'urgent_heparin_challenge'
                      ? '1px solid #fef08a'
                      : preview.urgencyTier === 'active_therapeutic_management'
                      ? '1px solid #bfdbfe'
                      : '1px solid #bbf7d0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{preview.diagnosticLikelihoodLabel}</strong>
                  <span
                    className={`badge ${
                      preview.urgencyTier === 'urgent_heparin_challenge'
                        ? 'badge-warning'
                        : preview.urgencyTier === 'active_therapeutic_management'
                        ? 'badge-primary'
                        : 'badge-success'
                    }`}
                  >
                    {preview.urgencyTierLabel}
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.88rem' }}>
                  <span>
                    <strong>Triple Abx Refractory:</strong> {hoursRefractoryTripleAntibiotics}h ({preview.isFeverRefractoryCriteriaMet ? '>=48h Met' : '<48h Incomplete'})
                  </span>{' '}
                  |{' '}
                  <span>
                    <strong>Recommended Anticoagulation:</strong> {preview.recommendedAnticoagulationDuration}
                  </span>
                </div>
                {preview.alerts.length > 0 && (
                  <div style={{ marginTop: '8px', color: '#c53030', fontSize: '0.85rem' }}>
                    {preview.alerts.map((al, idx) => (
                      <div key={idx}>⚠️ {al}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Delivery Date &amp; Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={deliveryDatetime}
                  onChange={(e) => setDeliveryDatetime(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Delivery Mode</label>
                <select
                  className="form-select"
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
                >
                  <option value="cesarean_section">Cesarean Section (High Risk)</option>
                  <option value="operative_vaginal">Operative Vaginal (Vacuum/Forceps)</option>
                  <option value="spontaneous_vaginal">Spontaneous Vaginal Delivery</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Postpartum Day</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="form-control"
                  value={postpartumDay}
                  onChange={(e) => setPostpartumDay(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">SPT Clinical Phenotype</label>
                <select
                  className="form-select"
                  value={sptPhenotype}
                  onChange={(e) => {
                    const pt = e.target.value as SptPhenotype;
                    setSptPhenotype(pt);
                    if (pt === 'ovarian_vein_thrombosis') {
                      setAffectedVein('right_ovarian_vein');
                    } else if (pt === 'deep_septic_pelvic_thrombophlebitis') {
                      setAffectedVein('internal_iliac_plexus');
                    }
                  }}
                >
                  <option value="ovarian_vein_thrombosis">Ovarian Vein Thrombosis (Focal Pain / Mass)</option>
                  <option value="deep_septic_pelvic_thrombophlebitis">Deep Septic Pelvic Thrombophlebitis (Spiking Picket-Fence Fever)</option>
                  <option value="undifferentiated_refractory_fever">Undifferentiated Refractory Postpartum Fever</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Affected Venous Territory</label>
                <select
                  className="form-select"
                  value={affectedVein}
                  onChange={(e) => setAffectedVein(e.target.value as AffectedVein)}
                >
                  <option value="right_ovarian_vein">Right Ovarian Vein (Classic ~80-90%)</option>
                  <option value="left_ovarian_vein">Left Ovarian Vein</option>
                  <option value="bilateral_ovarian_veins">Bilateral Ovarian Veins</option>
                  <option value="internal_iliac_plexus">Internal Iliac / Pelvic Plexus (DSPT)</option>
                  <option value="not_visualized_clinical_diagnosis">Not Visualized (Clinical Diagnosis)</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Peak Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min="36"
                  max="43"
                  className="form-control"
                  value={peakTemperatureCelsius}
                  onChange={(e) => setPeakTemperatureCelsius(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Hours on Triple IV Antibiotics</label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  className="form-control"
                  value={hoursRefractoryTripleAntibiotics}
                  onChange={(e) => setHoursRefractoryTripleAntibiotics(Number(e.target.value))}
                  required
                />
                <small className="text-muted">&gt;= 48h indicates refractory fever</small>
              </div>

              <div className="col-md-4">
                <label className="form-label">Pelvic CT / MRI Findings</label>
                <select
                  className="form-select"
                  value={pelvicCtMriFindings}
                  onChange={(e) => setPelvicCtMriFindings(e.target.value as PelvicImagingFindings)}
                >
                  <option value="thrombus_with_rim_enhancement">Thrombus with Rim Enhancement</option>
                  <option value="pelvic_phlebitis_perivascular_stranding">Perivascular Phlebitis / Stranding</option>
                  <option value="negative_no_thrombus_seen">Negative (No Thrombus Seen - DSPT?)</option>
                  <option value="imaging_pending">Imaging Pending / Not Done</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Anticoagulant Regimen</label>
                <select
                  className="form-select"
                  value={anticoagulantRegimen}
                  onChange={(e) => setAnticoagulantRegimen(e.target.value as AnticoagulantRegimen)}
                >
                  <option value="iv_unfractionated_heparin_infusion">IV Unfractionated Heparin Infusion</option>
                  <option value="therapeutic_lmwh_weight_based">Therapeutic LMWH (Enoxaparin 1mg/kg q12h)</option>
                  <option value="transition_to_oral_anticoagulation">Oral Anticoagulation Transition</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Target aPTT Parameter</label>
                <input
                  type="text"
                  className="form-control"
                  value={targetApttSeconds}
                  onChange={(e) => setTargetApttSeconds(e.target.value)}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Heparin Challenge Response</label>
                <select
                  className="form-select"
                  value={heparinChallengeResponse}
                  onChange={(e) => setHeparinChallengeResponse(e.target.value as HeparinChallengeResponse)}
                >
                  <option value="pending_under_48h">Challenge Active (&lt; 48 hours)</option>
                  <option value="positive_defervescence_within_48_72h">Positive (Defervescence in 48-72h)</option>
                  <option value="refractory_persistent_fever">Refractory Fever (&gt; 72h on Heparin)</option>
                  <option value="alternative_pathology_identified">Alternative Pathology Identified</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Defervescence Time (Hours from Heparin)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="120"
                  className="form-control"
                  placeholder="e.g. 36 hours"
                  value={defervescenceHours}
                  onChange={(e) => setDefervescenceHours(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Protocol Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="heparin_challenge_eval">1. Heparin Challenge Evaluation</option>
                  <option value="active_therapeutic_anticoagulation">2. Active Therapeutic Anticoagulation</option>
                  <option value="afebrile_antibiotic_completion">3. Afebrile Antibiotic Completion</option>
                  <option value="outpatient_anticoagulation_bridge">4. Outpatient Anticoagulation Bridge</option>
                  <option value="resolved_thrombus_recanalized">5. Resolved (Thrombus Recanalized)</option>
                </select>
              </div>

              <div className="col-md-12">
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={pelvicAbscessRuledOut}
                      onChange={(e) => setPelvicAbscessRuledOut(e.target.checked)}
                    />
                    Pelvic Abscess / Hematoma Ruled Out by Imaging
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={heparinChallengeInitiated}
                      onChange={(e) => setHeparinChallengeInitiated(e.target.checked)}
                    />
                    Heparin Challenge Test Initiated
                  </label>
                </div>
              </div>

              <div className="col-md-12">
                <label className="form-label">Clinical Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Document maternal exam, tenderness, antibiotic regimen, and hematology consultation..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : existingEpisode ? 'Update Record' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
