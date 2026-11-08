import React, { useState, useEffect } from 'react';
import {
  createNeonatalAbdominalDefectsEpisode,
  updateNeonatalAbdominalDefectsEpisode,
  type NeonatalAbdominalDefectRecord,
} from '../api';
import {
  evaluateNeonatalAbdominalDefects,
  type NeonatalAbdominalDefectsEvaluationResult,
  type AbdominalDefectType,
  type CordInsertionSite,
  type EvisceratedOrgans,
  type BowelCondition,
  type ClosureApproach,
  type SiloType,
} from '../neonatalAbdominalDefectsEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalAbdominalDefectRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalAbdominalDefectsModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [defectType, setDefectType] = useState<AbdominalDefectType>(
    existingEpisode?.defect_type ?? 'gastroschisis'
  );
  const [defectDiameterCm, setDefectDiameterCm] = useState<number>(
    existingEpisode?.defect_diameter_cm ?? 3.5
  );
  const [cordInsertionSite, setCordInsertionSite] = useState<CordInsertionSite>(
    existingEpisode?.cord_insertion_site ?? (existingEpisode?.defect_type === 'gastroschisis' ? 'normal_left_of_defect' : 'sac_apex')
  );
  const [membraneSacPresent, setMembraneSacPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.membrane_sac_present) : false
  );
  const [evisceratedOrgans, setEvisceratedOrgans] = useState<EvisceratedOrgans>(
    existingEpisode?.eviscerated_organs ?? 'small_and_large_bowel'
  );
  const [bowelCondition, setBowelCondition] = useState<BowelCondition>(
    existingEpisode?.bowel_condition ?? 'edematous_fibrin_peel'
  );
  const [closureApproach, setClosureApproach] = useState<ClosureApproach>(
    existingEpisode?.closure_approach ?? 'staged_silo_reduction'
  );
  const [siloType, setSiloType] = useState<SiloType>(
    existingEpisode?.silo_type ?? 'preformed_spring_loaded_bedside'
  );
  const [siloHeightCm, setSiloHeightCm] = useState<number>(
    existingEpisode?.silo_height_cm ?? 8.0
  );
  const [currentBladderPressureMmHg, setCurrentBladderPressureMmHg] = useState<number>(
    existingEpisode?.current_bladder_pressure_mmhg ?? 8.0
  );
  const [peakInspiratoryPressureCmH2O, setPeakInspiratoryPressureCmH2O] = useState<number>(
    existingEpisode?.peak_inspiratory_pressure_cmh2o ?? 16.0
  );
  const [beckwithWiedemannSuspected, setBeckwithWiedemannSuspected] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.beckwith_wiedemann_suspected) : false
  );
  const [cardiacEchoCompleted, setCardiacEchoCompleted] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.cardiac_echo_completed) : false
  );
  const [associatedAnomaliesNote, setAssociatedAnomaliesNote] = useState<string>(
    existingEpisode?.associated_anomalies_note ?? ''
  );
  const [status, setStatus] = useState<
    | 'initial_stabilization_silo_placement'
    | 'active_daily_serial_reduction'
    | 'ready_for_fascial_closure'
    | 'post_closure_compartment_monitoring'
    | 'resolved_enteral_feeds_established'
  >(existingEpisode?.status ?? 'initial_stabilization_silo_placement');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NeonatalAbdominalDefectsEvaluationResult | null>(null);

  // Recalculate preview on form updates
  useEffect(() => {
    try {
      const res = evaluateNeonatalAbdominalDefects({
        defectType,
        defectDiameterCm: Number(defectDiameterCm),
        cordInsertionSite,
        membraneSacPresent,
        evisceratedOrgans,
        bowelCondition,
        closureApproach,
        siloType,
        siloHeightCm: Number(siloHeightCm),
        currentBladderPressureMmHg: Number(currentBladderPressureMmHg),
        peakInspiratoryPressureCmH2O: Number(peakInspiratoryPressureCmH2O),
        beckwithWiedemannSuspected,
        cardiacEchoCompleted,
        associatedAnomaliesNote,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [
    defectType,
    defectDiameterCm,
    cordInsertionSite,
    membraneSacPresent,
    evisceratedOrgans,
    bowelCondition,
    closureApproach,
    siloType,
    siloHeightCm,
    currentBladderPressureMmHg,
    peakInspiratoryPressureCmH2O,
    beckwithWiedemannSuspected,
    cardiacEchoCompleted,
    associatedAnomaliesNote,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      defectType,
      defectDiameterCm: Number(defectDiameterCm),
      cordInsertionSite,
      membraneSacPresent,
      evisceratedOrgans,
      bowelCondition,
      closureApproach,
      siloType,
      siloHeightCm: Number(siloHeightCm) || null,
      currentBladderPressureMmHg: Number(currentBladderPressureMmHg),
      peakInspiratoryPressureCmH2O: Number(peakInspiratoryPressureCmH2O),
      beckwithWiedemannSuspected,
      cardiacEchoCompleted,
      associatedAnomaliesNote: associatedAnomaliesNote.trim() || null,
      status,
      clinicalNotes: clinicalNotes.trim() || null,
    };

    try {
      if (existingEpisode) {
        await updateNeonatalAbdominalDefectsEpisode(existingEpisode.id, payload);
      } else {
        await createNeonatalAbdominalDefectsEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save abdominal wall defect record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <h2>
            {existingEpisode ? '✏️ Edit Abdominal Wall Defect Record' : '👶 New Neonatal Abdominal Wall Defect Protocol'}
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
                    preview.urgencyTier === 'emergency_acs_or_compromise'
                      ? '#fff5f5'
                      : preview.urgencyTier === 'urgent_staged_reduction'
                      ? '#fffbeb'
                      : '#f0fdf4',
                  border:
                    preview.urgencyTier === 'emergency_acs_or_compromise'
                      ? '1px solid #feb2b2'
                      : preview.urgencyTier === 'urgent_staged_reduction'
                      ? '1px solid #fef08a'
                      : '1px solid #bbf7d0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{preview.defectClassificationLabel}</strong>
                  <span
                    className={`badge ${
                      preview.urgencyTier === 'emergency_acs_or_compromise'
                        ? 'badge-danger'
                        : preview.urgencyTier === 'urgent_staged_reduction'
                        ? 'badge-warning'
                        : 'badge-success'
                    }`}
                  >
                    {preview.urgencyTierLabel}
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.88rem' }}>
                  <span>
                    <strong>Bladder Pressure:</strong> {currentBladderPressureMmHg} mmHg ({preview.iahGradeLabel})
                  </span>{' '}
                  |{' '}
                  <span>
                    <strong>Giant Defect:</strong> {preview.isGiantDefect ? 'Yes (>= 5 cm)' : 'No (< 5 cm)'}
                  </span>{' '}
                  |{' '}
                  <span>
                    <strong>Liver Involved:</strong> {preview.hasLiverEvisceration ? 'Yes (Extracorporeal)' : 'No'}
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
                <label className="form-label">Defect Type</label>
                <select
                  className="form-select"
                  value={defectType}
                  onChange={(e) => {
                    const dt = e.target.value as AbdominalDefectType;
                    setDefectType(dt);
                    if (dt === 'gastroschisis') {
                      setMembraneSacPresent(false);
                      setCordInsertionSite('normal_left_of_defect');
                    } else if (dt === 'omphalocele_intact') {
                      setMembraneSacPresent(true);
                      setCordInsertionSite('sac_apex');
                    } else {
                      setMembraneSacPresent(false);
                      setCordInsertionSite('disrupted');
                    }
                  }}
                >
                  <option value="gastroschisis">Gastroschisis (Paraumbilical, No Sac)</option>
                  <option value="omphalocele_intact">Omphalocele (Midline, Intact Sac)</option>
                  <option value="omphalocele_ruptured">Omphalocele (Midline, Ruptured Sac)</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Defect Diameter (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="20"
                  className="form-control"
                  value={defectDiameterCm}
                  onChange={(e) => setDefectDiameterCm(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Umbilical Cord Insertion</label>
                <select
                  className="form-select"
                  value={cordInsertionSite}
                  onChange={(e) => setCordInsertionSite(e.target.value as CordInsertionSite)}
                >
                  <option value="normal_left_of_defect">Intact Cord Normal (Left of Defect)</option>
                  <option value="sac_apex">Inserts into Apex of Sac</option>
                  <option value="disrupted">Disrupted / Avulsed</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Eviscerated Organs</label>
                <select
                  className="form-select"
                  value={evisceratedOrgans}
                  onChange={(e) => setEvisceratedOrgans(e.target.value as EvisceratedOrgans)}
                >
                  <option value="small_and_large_bowel">Small & Large Bowel Only</option>
                  <option value="bowel_and_liver">Bowel & Liver (Extracorporeal)</option>
                  <option value="bowel_liver_spleen_gonads">Bowel, Liver, Spleen & Gonads</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Bowel / Visceral Condition</label>
                <select
                  className="form-select"
                  value={bowelCondition}
                  onChange={(e) => setBowelCondition(e.target.value as BowelCondition)}
                >
                  <option value="healthy_normal_peristalsis">Healthy / Normal Peristalsis</option>
                  <option value="edematous_fibrin_peel">Edematous / Thick Fibrin Peel</option>
                  <option value="ischemic_gangrenous">Ischemic / Gangrenous Compromise</option>
                  <option value="perforated_atresia">Perforation / Co-existing Atresia</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Closure Approach</label>
                <select
                  className="form-select"
                  value={closureApproach}
                  onChange={(e) => setClosureApproach(e.target.value as ClosureApproach)}
                >
                  <option value="staged_silo_reduction">Staged Silo Serial Reduction</option>
                  <option value="primary_bedside_sutureless">Primary Bedside Sutureless Flap</option>
                  <option value="primary_operative_closure">Primary Operative Fascial Closure</option>
                  <option value="delayed_escharotic_paint_and_wait">Delayed "Paint & Wait" Escharotic</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Silo Apparatus</label>
                <select
                  className="form-select"
                  value={siloType}
                  onChange={(e) => setSiloType(e.target.value as SiloType)}
                >
                  <option value="preformed_spring_loaded_bedside">Preformed Spring-Loaded Silo (Bedside)</option>
                  <option value="surgically_fashioned_dacron_silo">Surgically Fashioned Silo</option>
                  <option value="none">None (Primary / Direct Closure)</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Initial Silo Height (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="25"
                  className="form-control"
                  value={siloHeightCm}
                  onChange={(e) => setSiloHeightCm(Number(e.target.value))}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Bladder Pressure (mmHg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="40"
                  className="form-control"
                  value={currentBladderPressureMmHg}
                  onChange={(e) => setCurrentBladderPressureMmHg(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Peak Inspiratory Pressure (PIP cmH2O)</label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="50"
                  className="form-control"
                  value={peakInspiratoryPressureCmH2O}
                  onChange={(e) => setPeakInspiratoryPressureCmH2O(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Protocol Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="initial_stabilization_silo_placement">1. Initial Stabilization & Silo Placement</option>
                  <option value="active_daily_serial_reduction">2. Active Daily Serial Reduction</option>
                  <option value="ready_for_fascial_closure">3. Ready for Fascial Closure</option>
                  <option value="post_closure_compartment_monitoring">4. Post-Closure Compartment Monitoring</option>
                  <option value="resolved_enteral_feeds_established">5. Resolved (Full Enteral Feeds)</option>
                </select>
              </div>

              <div className="col-md-12">
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={membraneSacPresent}
                      onChange={(e) => setMembraneSacPresent(e.target.checked)}
                    />
                    Amniotic Sac Present
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={beckwithWiedemannSuspected}
                      onChange={(e) => setBeckwithWiedemannSuspected(e.target.checked)}
                    />
                    Beckwith-Wiedemann Suspected (Hypoglycemia / Macroglossia)
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={cardiacEchoCompleted}
                      onChange={(e) => setCardiacEchoCompleted(e.target.checked)}
                    />
                    Cardiac Echocardiogram Completed
                  </label>
                </div>
              </div>

              <div className="col-md-12">
                <label className="form-label">Associated Anomalies (VACTERL / Karyotype / Echo)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Normal 46XY, small ASD, renal ultrasound unremarkable"
                  value={associatedAnomaliesNote}
                  onChange={(e) => setAssociatedAnomaliesNote(e.target.value)}
                />
              </div>

              <div className="col-md-12">
                <label className="form-label">Clinical Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Additional surgical and intensive care directives..."
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
