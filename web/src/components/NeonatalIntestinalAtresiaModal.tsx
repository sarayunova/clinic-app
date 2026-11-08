import React, { useState, useEffect } from 'react';
import {
  createNeonatalIntestinalAtresiaEpisode,
  updateNeonatalIntestinalAtresiaEpisode,
  type NeonatalIntestinalAtresiaRecord,
} from '../api';
import {
  evaluateNeonatalIntestinalAtresia,
  type NeonatalIntestinalAtresiaEvaluationResult,
  type AtresiaLevel,
  type AbdominalDistensionPattern,
  type RadiographicGasPattern,
  type SurgicalProcedurePlanned,
} from '../neonatalIntestinalAtresiaEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalIntestinalAtresiaRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalIntestinalAtresiaModal: React.FC<Props> = ({
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
  const [ageHours, setAgeHours] = useState<number>(existingEpisode?.age_hours ?? 12);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 3.0);
  const [atresiaLevel, setAtresiaLevel] = useState<AtresiaLevel>(
    existingEpisode?.atresia_level ?? 'duodenal_atresia_complete'
  );
  const [polyhydramniosAntenatal, setPolyhydramniosAntenatal] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.polyhydramnios_antenatal) : true
  );
  const [biliousEmesisPresent, setBiliousEmesisPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.bilious_emesis_present) : true
  );
  const [abdominalDistensionPattern, setAbdominalDistensionPattern] = useState<AbdominalDistensionPattern>(
    existingEpisode?.abdominal_distension_pattern ?? 'scaphoid_epigastric_fullness_only'
  );
  const [radiographicGasPattern, setRadiographicGasPattern] = useState<RadiographicGasPattern>(
    existingEpisode?.radiographic_gas_pattern ?? 'double_bubble_sign_gasless_distal'
  );
  const [downSyndromeFeaturesPresent, setDownSyndromeFeaturesPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.down_syndrome_features_present) : false
  );
  const [karyotypeTrisomy21Confirmed, setKaryotypeTrisomy21Confirmed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.karyotype_trisomy_21_confirmed) : false
  );
  const [echocardiogramCardiacDefect, setEchocardiogramCardiacDefect] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.echocardiogram_cardiac_defect) : false
  );
  const [replogleDecompressionActive, setReplogleDecompressionActive] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.replogle_decompression_active) : true
  );
  const [surgicalProcedurePlanned, setSurgicalProcedurePlanned] = useState<SurgicalProcedurePlanned>(
    existingEpisode?.surgical_procedure_planned ?? 'duodenoduodenostomy_diamond_anastomosis'
  );
  const [transanastomoticTubePlaced, setTransanastomoticTubePlaced] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.transanastomotic_tube_placed) : false
  );
  const [tpnCentralLineInSitu, setTpnCentralLineInSitu] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.tpn_central_line_in_situ) : false
  );
  const [status, setStatus] = useState<
    | 'preop_nasogastric_decompression'
    | 'contrast_imaging_enema_workup'
    | 'in_operating_room_reconstruction'
    | 'postop_transanastomotic_tube_tpn'
    | 'resolved_full_enteral_nutrition'
  >(existingEpisode?.status ?? 'preop_nasogastric_decompression');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NeonatalIntestinalAtresiaEvaluationResult | null>(null);

  // Recalculate preview
  useEffect(() => {
    try {
      const res = evaluateNeonatalIntestinalAtresia({
        ageHours: Number(ageHours),
        weightKg: Number(weightKg),
        atresiaLevel,
        polyhydramniosAntenatal,
        biliousEmesisPresent,
        abdominalDistensionPattern,
        radiographicGasPattern,
        downSyndromeFeaturesPresent,
        karyotypeTrisomy21Confirmed,
        echocardiogramCardiacDefect,
        replogleDecompressionActive,
        surgicalProcedurePlanned,
        transanastomoticTubePlaced,
        tpnCentralLineInSitu,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [
    ageHours,
    weightKg,
    atresiaLevel,
    polyhydramniosAntenatal,
    biliousEmesisPresent,
    abdominalDistensionPattern,
    radiographicGasPattern,
    downSyndromeFeaturesPresent,
    karyotypeTrisomy21Confirmed,
    echocardiogramCardiacDefect,
    replogleDecompressionActive,
    surgicalProcedurePlanned,
    transanastomoticTubePlaced,
    tpnCentralLineInSitu,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      ageHours: Number(ageHours),
      weightKg: Number(weightKg),
      atresiaLevel,
      polyhydramniosAntenatal,
      biliousEmesisPresent,
      abdominalDistensionPattern,
      radiographicGasPattern,
      downSyndromeFeaturesPresent,
      karyotypeTrisomy21Confirmed,
      echocardiogramCardiacDefect,
      replogleDecompressionActive,
      surgicalProcedurePlanned,
      transanastomoticTubePlaced,
      tpnCentralLineInSitu,
      status,
      clinicalNotes: clinicalNotes.trim() || null,
    };

    try {
      if (existingEpisode) {
        await updateNeonatalIntestinalAtresiaEpisode(existingEpisode.id, payload);
      } else {
        await createNeonatalIntestinalAtresiaEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save neonatal intestinal atresia record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '880px' }}>
        <div className="modal-header">
          <h2>
            {existingEpisode ? '✏️ Edit Intestinal Atresia Record' : '👶 New Neonatal Intestinal Atresia Protocol'}
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
                    preview.urgencyTier === 'emergency_obstruction_or_volvulus'
                      ? '#fff5f5'
                      : preview.urgencyTier === 'urgent_surgical_stabilization'
                      ? '#fffbeb'
                      : '#f0fdf4',
                  border:
                    preview.urgencyTier === 'emergency_obstruction_or_volvulus'
                      ? '1px solid #feb2b2'
                      : preview.urgencyTier === 'urgent_surgical_stabilization'
                      ? '1px solid #fef08a'
                      : '1px solid #bbf7d0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{preview.atresiaClassificationLabel}</strong>
                  <span
                    className={`badge ${
                      preview.urgencyTier === 'emergency_obstruction_or_volvulus'
                        ? 'badge-danger'
                        : preview.urgencyTier === 'urgent_surgical_stabilization'
                        ? 'badge-warning'
                        : 'badge-success'
                    }`}
                  >
                    {preview.urgencyTierLabel}
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.88rem' }}>
                  <span>
                    <strong>Trisomy 21 / Down Syndrome:</strong> {preview.syndromicTrisomy21Label}
                  </span>{' '}
                  |{' '}
                  <span>
                    <strong>Short Bowel Risk:</strong> {preview.shortBowelSyndromeRiskLabel}
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
                <label className="form-label">Age (hours)</label>
                <input
                  type="number"
                  min="0"
                  max="720"
                  className="form-control"
                  value={ageHours}
                  onChange={(e) => setAgeHours(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="10"
                  className="form-control"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Atresia Level / Grosfeld Classification</label>
                <select
                  className="form-select"
                  value={atresiaLevel}
                  onChange={(e) => {
                    const al = e.target.value as AtresiaLevel;
                    setAtresiaLevel(al);
                    if (al.startsWith('duodenal')) {
                      setRadiographicGasPattern('double_bubble_sign_gasless_distal');
                      setAbdominalDistensionPattern('scaphoid_epigastric_fullness_only');
                      setSurgicalProcedurePlanned('duodenoduodenostomy_diamond_anastomosis');
                    } else if (al === 'jejunoileal_atresia_type_3b_apple_peel') {
                      setRadiographicGasPattern('multiple_dilated_loops_air_fluid_levels');
                      setAbdominalDistensionPattern('generalized_distension_visible_loops');
                      setSurgicalProcedurePlanned('tapering_enteroplasty_anastomosis');
                    } else {
                      setRadiographicGasPattern('multiple_dilated_loops_air_fluid_levels');
                      setAbdominalDistensionPattern('generalized_distension_visible_loops');
                      setSurgicalProcedurePlanned('primary_end_to_oblique_anastomosis');
                    }
                  }}
                >
                  <option value="duodenal_atresia_complete">Duodenal Atresia (Complete / Double-Bubble)</option>
                  <option value="duodenal_web_stenosis">Duodenal Web / Stenosis (Windsock)</option>
                  <option value="jejunoileal_atresia_type_1_membrane">Jejunoileal Type I (Mucosal Web)</option>
                  <option value="jejunoileal_atresia_type_2_cord">Jejunoileal Type II (Fibrous Cord)</option>
                  <option value="jejunoileal_atresia_type_3a_gap">Jejunoileal Type IIIa (V-Mesenteric Gap)</option>
                  <option value="jejunoileal_atresia_type_3b_apple_peel">Jejunoileal Type IIIb (Apple-Peel / Christmas Tree)</option>
                  <option value="jejunoileal_atresia_type_4_multiple">Jejunoileal Type IV (Multiple Segmental Atresias)</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Radiographic Gas Pattern</label>
                <select
                  className="form-select"
                  value={radiographicGasPattern}
                  onChange={(e) => setRadiographicGasPattern(e.target.value as RadiographicGasPattern)}
                >
                  <option value="double_bubble_sign_gasless_distal">Classic Double-Bubble Sign (Gasless Distal)</option>
                  <option value="triple_bubble_sign">Triple-Bubble Sign (Jejunal Atresia)</option>
                  <option value="multiple_dilated_loops_air_fluid_levels">Multiple Dilated Loops &amp; Air-Fluid Levels</option>
                  <option value="microcolon_on_contrast_enema">Microcolon on Contrast Enema (Unused Disuse Colon)</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Abdominal Distension Pattern</label>
                <select
                  className="form-select"
                  value={abdominalDistensionPattern}
                  onChange={(e) => setAbdominalDistensionPattern(e.target.value as AbdominalDistensionPattern)}
                >
                  <option value="scaphoid_epigastric_fullness_only">Scaphoid Abdomen / Epigastric Fullness Only</option>
                  <option value="generalized_distension_visible_loops">Generalized Distension &amp; Visible Peristalsis</option>
                  <option value="soft_non_distended">Soft &amp; Non-Distended</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Planned Surgical Reconstruction</label>
                <select
                  className="form-select"
                  value={surgicalProcedurePlanned}
                  onChange={(e) => setSurgicalProcedurePlanned(e.target.value as SurgicalProcedurePlanned)}
                >
                  <option value="duodenoduodenostomy_diamond_anastomosis">Duodenoduodenostomy (Diamond Anastomosis)</option>
                  <option value="duodenojejunostomy">Duodenojejunostomy</option>
                  <option value="primary_end_to_oblique_anastomosis">Primary End-to-Oblique Anastomosis</option>
                  <option value="tapering_enteroplasty_anastomosis">Tapering Enteroplasty Anastomosis</option>
                  <option value="temporary_enterostomy_stoma">Temporary Diverting Enterostomy</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Protocol Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="preop_nasogastric_decompression">1. Preop NG Sump Decompression</option>
                  <option value="contrast_imaging_enema_workup">2. Contrast Enema / Microcolon Workup</option>
                  <option value="in_operating_room_reconstruction">3. In Operating Room Reconstruction</option>
                  <option value="postop_transanastomotic_tube_tpn">4. Postop TAT Feeds / TPN</option>
                  <option value="resolved_full_enteral_nutrition">5. Resolved (Full Enteral Nutrition)</option>
                </select>
              </div>

              <div className="col-md-12">
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={polyhydramniosAntenatal}
                      onChange={(e) => setPolyhydramniosAntenatal(e.target.checked)}
                    />
                    Antenatal Polyhydramnios Documented
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={biliousEmesisPresent}
                      onChange={(e) => setBiliousEmesisPresent(e.target.checked)}
                    />
                    Bilious Emesis Present
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={downSyndromeFeaturesPresent}
                      onChange={(e) => setDownSyndromeFeaturesPresent(e.target.checked)}
                    />
                    Down Syndrome (Trisomy 21) Physical Stigmata
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={karyotypeTrisomy21Confirmed}
                      onChange={(e) => setKaryotypeTrisomy21Confirmed(e.target.checked)}
                    />
                    Karyotype / FISH Trisomy 21 Confirmed
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={echocardiogramCardiacDefect}
                      onChange={(e) => setEchocardiogramCardiacDefect(e.target.checked)}
                    />
                    Cardiac Defect on Echocardiogram (AVSD / VSD)
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={transanastomoticTubePlaced}
                      onChange={(e) => setTransanastomoticTubePlaced(e.target.checked)}
                    />
                    Transanastomotic Feeding Tube (TAT) In Situ
                  </label>

                  <label className="form-check-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={tpnCentralLineInSitu}
                      onChange={(e) => setTpnCentralLineInSitu(e.target.checked)}
                    />
                    PICC / Central Line TPN Active
                  </label>
                </div>
              </div>

              <div className="col-md-12">
                <label className="form-label">Clinical Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Document surgical findings, anastomotic caliber, residual bowel length, and neonatal intensive care directives..."
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
