import React, { useState, useEffect } from 'react';
import {
  createPediatricOsteomyelitisEpisode,
  updatePediatricOsteomyelitisEpisode,
  type PediatricOsteomyelitisRecord,
} from '../api';
import {
  evaluatePediatricOsteomyelitis,
  type PediatricOsteomyelitisEvaluationResult,
  type BoneInvolved,
  type Laterality,
  type ImagingModalityConfirmatory,
  type SurgicalProcedure,
  type IsolatedPathogen,
  type CurrentAntibioticRegimen,
} from '../pediatricOsteomyelitisEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricOsteomyelitisRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricOsteomyelitisModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [onsetDatetime, setOnsetDatetime] = useState(
    existingEpisode?.onset_datetime || new Date().toISOString().slice(0, 16)
  );
  const [ageYears, setAgeYears] = useState<number>(existingEpisode?.age_years ?? 6.0);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 22.0);
  const [boneInvolved, setBoneInvolved] = useState<BoneInvolved>(
    existingEpisode?.bone_involved ?? 'distal_femur'
  );
  const [laterality, setLaterality] = useState<Laterality>(
    existingEpisode?.laterality ?? 'right'
  );
  const [kocherFeverGt385, setKocherFeverGt385] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.kocher_fever_gt_38_5) : true
  );
  const [kocherNonWeightBearing, setKocherNonWeightBearing] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.kocher_non_weight_bearing) : true
  );
  const [kocherEsrGt40, setKocherEsrGt40] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.kocher_esr_gt_40) : true
  );
  const [kocherWbcGt12k, setKocherWbcGt12k] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.kocher_wbc_gt_12k) : true
  );
  const [crpAdmissionMgL, setCrpAdmissionMgL] = useState<number>(
    existingEpisode?.crp_admission_mg_l ?? 68.0
  );
  const [crpPeakMgL, setCrpPeakMgL] = useState<number>(
    existingEpisode?.crp_peak_mg_l ?? 92.0
  );
  const [subperiostealAbscessPresent, setSubperiostealAbscessPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.subperiosteal_abscess_present) : false
  );
  const [abscessSizeDepthMm, setAbscessSizeDepthMm] = useState<number>(
    existingEpisode?.abscess_size_depth_mm ?? 0.0
  );
  const [imagingModalityConfirmatory, setImagingModalityConfirmatory] = useState<ImagingModalityConfirmatory>(
    existingEpisode?.imaging_modality_confirmatory ?? 'mri_with_contrast'
  );
  const [surgicalDecompressionPerformed, setSurgicalDecompressionPerformed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.surgical_decompression_performed) : false
  );
  const [surgicalProcedure, setSurgicalProcedure] = useState<SurgicalProcedure>(
    existingEpisode?.surgical_procedure ?? 'none_medical_management'
  );
  const [isolatedPathogen, setIsolatedPathogen] = useState<IsolatedPathogen>(
    existingEpisode?.isolated_pathogen ?? 'staphylococcus_aureus_mssa'
  );
  const [currentAntibioticRegimen, setCurrentAntibioticRegimen] = useState<CurrentAntibioticRegimen>(
    existingEpisode?.current_antibiotic_regimen ?? 'iv_cefazolin'
  );
  const [oralSwitchCriteriaMet, setOralSwitchCriteriaMet] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.oral_switch_criteria_met) : false
  );
  const [status, setStatus] = useState<
    | 'initial_iv_empiric_therapy'
    | 'surgical_drainage_and_culture'
    | 'pathogen_directed_iv_therapy'
    | 'oral_step_down_therapy'
    | 'resolved_treatment_completed'
  >(existingEpisode?.status ?? 'initial_iv_empiric_therapy');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PediatricOsteomyelitisEvaluationResult | null>(null);

  // Recalculate preview
  useEffect(() => {
    try {
      const res = evaluatePediatricOsteomyelitis({
        ageYears: Number(ageYears),
        weightKg: Number(weightKg),
        boneInvolved,
        laterality,
        kocherFeverGt385,
        kocherNonWeightBearing,
        kocherEsrGt40,
        kocherWbcGt12k,
        crpAdmissionMgL: Number(crpAdmissionMgL),
        crpPeakMgL: Number(crpPeakMgL),
        subperiostealAbscessPresent,
        abscessSizeDepthMm: Number(abscessSizeDepthMm),
        imagingModalityConfirmatory,
        surgicalDecompressionPerformed,
        surgicalProcedure,
        isolatedPathogen,
        currentAntibioticRegimen,
        oralSwitchCriteriaMet,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [
    ageYears,
    weightKg,
    boneInvolved,
    laterality,
    kocherFeverGt385,
    kocherNonWeightBearing,
    kocherEsrGt40,
    kocherWbcGt12k,
    crpAdmissionMgL,
    crpPeakMgL,
    subperiostealAbscessPresent,
    abscessSizeDepthMm,
    imagingModalityConfirmatory,
    surgicalDecompressionPerformed,
    surgicalProcedure,
    isolatedPathogen,
    currentAntibioticRegimen,
    oralSwitchCriteriaMet,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      ageYears: Number(ageYears),
      weightKg: Number(weightKg),
      boneInvolved,
      laterality,
      kocherFeverGt385,
      kocherNonWeightBearing,
      kocherEsrGt40,
      kocherWbcGt12k,
      crpAdmissionMgL: Number(crpAdmissionMgL),
      crpPeakMgL: Number(crpPeakMgL),
      subperiostealAbscessPresent,
      abscessSizeDepthMm: Number(abscessSizeDepthMm),
      imagingModalityConfirmatory,
      surgicalDecompressionPerformed,
      surgicalProcedure,
      isolatedPathogen,
      currentAntibioticRegimen,
      oralSwitchCriteriaMet,
      status,
      clinicalNotes: clinicalNotes.trim() || null,
    };

    try {
      if (existingEpisode) {
        await updatePediatricOsteomyelitisEpisode(existingEpisode.id, payload);
      } else {
        await createPediatricOsteomyelitisEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save pediatric osteomyelitis record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '880px' }}>
        <div className="modal-header">
          <h2>
            {existingEpisode ? '✏️ Edit Acute Osteomyelitis Record' : '🦴 New Pediatric Acute Osteomyelitis (AHO) Protocol'}
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
                    preview.urgencyTier === 'emergency_surgical_decompression'
                      ? '#fff5f5'
                      : preview.urgencyTier === 'urgent_inpatient_parenteral_therapy'
                      ? '#fffbeb'
                      : '#f0fdf4',
                  border:
                    preview.urgencyTier === 'emergency_surgical_decompression'
                      ? '1px solid #feb2b2'
                      : preview.urgencyTier === 'urgent_inpatient_parenteral_therapy'
                      ? '1px solid #fef08a'
                      : '1px solid #bbf7d0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>
                    Kocher Score: {preview.kocherScore}/4 ({preview.kocherRiskCategory})
                  </strong>
                  <span
                    className={`badge ${
                      preview.urgencyTier === 'emergency_surgical_decompression'
                        ? 'badge-danger'
                        : preview.urgencyTier === 'urgent_inpatient_parenteral_therapy'
                        ? 'badge-warning'
                        : 'badge-success'
                    }`}
                  >
                    {preview.urgencyTierLabel}
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.88rem' }}>
                  <span>
                    <strong>Septic Arthritis Coexistence:</strong> {preview.septicArthritisCoexistenceProbability}
                  </span>{' '}
                  |{' '}
                  <span>
                    <strong>Subperiosteal Abscess:</strong> {preview.subperiostealAbscessSeverityLabel}
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
                <label className="form-label">Onset Date &amp; Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={onsetDatetime}
                  onChange={(e) => setOnsetDatetime(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Age (years)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="18"
                  className="form-control"
                  value={ageYears}
                  onChange={(e) => setAgeYears(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="120"
                  className="form-control"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Bone Involved</label>
                <select
                  className="form-select"
                  value={boneInvolved}
                  onChange={(e) => setBoneInvolved(e.target.value as BoneInvolved)}
                >
                  <option value="distal_femur">Distal Femur (Most Common)</option>
                  <option value="proximal_tibia">Proximal Tibia</option>
                  <option value="distal_tibia">Distal Tibia</option>
                  <option value="proximal_humerus">Proximal Humerus</option>
                  <option value="fibula">Fibula</option>
                  <option value="radius_ulna">Radius / Ulna</option>
                  <option value="pelvis">Pelvis (Ilium/Ischium)</option>
                  <option value="other_bone">Other Bone</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Laterality</label>
                <select
                  className="form-select"
                  value={laterality}
                  onChange={(e) => setLaterality(e.target.value as Laterality)}
                >
                  <option value="right">Right Side</option>
                  <option value="left">Left Side</option>
                  <option value="bilateral">Bilateral / Multifocal</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Confirmatory Imaging</label>
                <select
                  className="form-select"
                  value={imagingModalityConfirmatory}
                  onChange={(e) => setImagingModalityConfirmatory(e.target.value as ImagingModalityConfirmatory)}
                >
                  <option value="mri_with_contrast">MRI with Contrast (Gold Standard)</option>
                  <option value="ultrasound_subperiosteal_fluid">Metaphyseal Ultrasound</option>
                  <option value="plain_radiograph_lytic_changes">Plain Radiograph (Late Changes)</option>
                  <option value="ct_scan">CT Scan</option>
                </select>
              </div>

              <div className="col-md-12">
                <div className="p-2 border rounded bg-light">
                  <span className="fw-bold d-block mb-1">Kocher Criteria Checklist (Co-existing Septic Arthritis Triage):</span>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={kocherFeverGt385}
                        onChange={(e) => setKocherFeverGt385(e.target.checked)}
                      />
                      1. Fever &gt; 38.5°C
                    </label>

                    <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={kocherNonWeightBearing}
                        onChange={(e) => setKocherNonWeightBearing(e.target.checked)}
                      />
                      2. Refusal to Bear Weight
                    </label>

                    <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={kocherEsrGt40}
                        onChange={(e) => setKocherEsrGt40(e.target.checked)}
                      />
                      3. ESR &gt; 40 mm/hr
                    </label>

                    <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={kocherWbcGt12k}
                        onChange={(e) => setKocherWbcGt12k(e.target.checked)}
                      />
                      4. WBC &gt; 12,000 /µL
                    </label>
                  </div>
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label">Admission CRP (mg/L)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="400"
                  className="form-control"
                  value={crpAdmissionMgL}
                  onChange={(e) => setCrpAdmissionMgL(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Peak CRP (mg/L)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="400"
                  className="form-control"
                  value={crpPeakMgL}
                  onChange={(e) => setCrpPeakMgL(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Subperiosteal Fluid Depth (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  className="form-control"
                  value={abscessSizeDepthMm}
                  onChange={(e) => {
                    const depth = Number(e.target.value);
                    setAbscessSizeDepthMm(depth);
                    setSubperiostealAbscessPresent(depth > 0);
                  }}
                />
                <small className="text-muted">&gt;= 3 mm indicates drainage</small>
              </div>

              <div className="col-md-3">
                <label className="form-label">Surgical Decompression</label>
                <select
                  className="form-select"
                  value={surgicalProcedure}
                  onChange={(e) => {
                    const sp = e.target.value as SurgicalProcedure;
                    setSurgicalProcedure(sp);
                    setSurgicalDecompressionPerformed(sp !== 'none_medical_management');
                  }}
                >
                  <option value="none_medical_management">None (Medical Management)</option>
                  <option value="cortical_fenestration_and_drainage">Cortical Window &amp; Drainage</option>
                  <option value="percutaneous_needle_aspiration">Percutaneous Aspiration</option>
                  <option value="extensive_debridement_sequestrectomy">Extensive Debridement</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Isolated Pathogen</label>
                <select
                  className="form-select"
                  value={isolatedPathogen}
                  onChange={(e) => setIsolatedPathogen(e.target.value as IsolatedPathogen)}
                >
                  <option value="staphylococcus_aureus_mssa">S. aureus (MSSA)</option>
                  <option value="staphylococcus_aureus_mrsa">CA-MRSA</option>
                  <option value="streptococcus_pyogenes_group_a">GAS (Streptococcus pyogenes)</option>
                  <option value="kingella_kingae">Kingella kingae (&lt; 4yo)</option>
                  <option value="pseudomonas_aeruginosa">Pseudomonas aeruginosa (Puncture)</option>
                  <option value="culture_negative_clinical_aho">Culture Negative AHO</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Current Antibiotic Regimen</label>
                <select
                  className="form-select"
                  value={currentAntibioticRegimen}
                  onChange={(e) => setCurrentAntibioticRegimen(e.target.value as CurrentAntibioticRegimen)}
                >
                  <option value="iv_cefazolin">IV Cefazolin (100-150 mg/kg/d)</option>
                  <option value="iv_vancomycin">IV Vancomycin (MRSA coverage)</option>
                  <option value="iv_clindamycin">IV Clindamycin</option>
                  <option value="iv_ceftriaxone">IV Ceftriaxone</option>
                  <option value="oral_cephalexin">Oral Cephalexin (Step-Down)</option>
                  <option value="oral_clindamycin">Oral Clindamycin (Step-Down)</option>
                  <option value="oral_amoxicillin_clavulanate">Oral Amox-Clav (Step-Down)</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Protocol Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="initial_iv_empiric_therapy">1. Initial IV Empiric Phase</option>
                  <option value="surgical_drainage_and_culture">2. Surgical Drainage &amp; Culture</option>
                  <option value="pathogen_directed_iv_therapy">3. Pathogen-Directed IV</option>
                  <option value="oral_step_down_therapy">4. Oral Step-Down Recovery</option>
                  <option value="resolved_treatment_completed">5. Resolved (Treatment Completed)</option>
                </select>
              </div>

              <div className="col-md-12">
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={oralSwitchCriteriaMet}
                      onChange={(e) => setOralSwitchCriteriaMet(e.target.checked)}
                    />
                    Clinician Confirms Oral Step-Down Switch Criteria Met (Afebrile &gt;24-48h, CRP &gt;30% Drop, Tolerating Feeds)
                  </label>
                </div>
              </div>

              <div className="col-md-12">
                <label className="form-label">Clinical Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Document orthopedic findings, range of motion, surgical plan, and infectious diseases recommendations..."
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
