import React, { useState, useEffect } from 'react';
import {
  createFetalHydropsEpisode,
  updateFetalHydropsEpisode,
  type FetalHydropsRecord,
} from '../api';
import {
  evaluateFetalHydrops,
  type FetalHydropsEvaluation,
  type SuspectedHydropsEtiology,
  type InUteroInterventionPlanned,
  type FetalHydropsStatus,
} from '../fetalHydropsEngine';

interface Props {
  patientId: number;
  initialEpisode?: FetalHydropsRecord | null;
  existingEpisode?: FetalHydropsRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const FetalHydropsModal: React.FC<Props> = ({
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
    currentEp?.gestational_age_weeks ?? 27.5
  );
  const [ascitesPresent, setAscitesPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.ascites_present) : true
  );
  const [pleuralEffusionPresent, setPleuralEffusionPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.pleural_effusion_present) : true
  );
  const [pericardialEffusionPresent, setPericardialEffusionPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.pericardial_effusion_present) : false
  );
  const [skinEdemaPresent, setSkinEdemaPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.skin_edema_present) : true
  );
  const [placentalEdemaPresent, setPlacentalEdemaPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.placental_edema_present) : false
  );
  const [polyhydramniosPresent, setPolyhydramniosPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.polyhydramnios_present) : true
  );
  const [mcaPsvMom, setMcaPsvMom] = useState<number>(currentEp?.mca_psv_mom ?? 1.65);
  const [suspectedEtiologyCategory, setSuspectedEtiologyCategory] = useState<SuspectedHydropsEtiology>(
    (currentEp?.suspected_etiology_category as SuspectedHydropsEtiology) ?? 'fetal_anemia_parvovirus_or_hemoglobinopathy'
  );
  const [fetalArrhythmiaDetected, setFetalArrhythmiaDetected] = useState<boolean>(
    currentEp ? Boolean(currentEp.fetal_arrhythmia_detected) : false
  );
  const [maternalMirrorSyndromeSuspected, setMaternalMirrorSyndromeSuspected] = useState<boolean>(
    currentEp ? Boolean(currentEp.maternal_mirror_syndrome_suspected) : false
  );
  const [maternalSystolicBpMmhg, setMaternalSystolicBpMmhg] = useState<number>(
    currentEp?.maternal_systolic_bp_mmhg ?? 124
  );
  const [maternalDiastolicBpMmhg, setMaternalDiastolicBpMmhg] = useState<number>(
    currentEp?.maternal_diastolic_bp_mmhg ?? 78
  );
  const [maternalProteinuriaGrade, setMaternalProteinuriaGrade] = useState<string>(
    currentEp?.maternal_proteinuria_grade ?? 'nil'
  );
  const [maternalGeneralizedAnasarca, setMaternalGeneralizedAnasarca] = useState<boolean>(
    currentEp ? Boolean(currentEp.maternal_generalized_anasarca) : false
  );
  const [inUteroInterventionPlanned, setInUteroInterventionPlanned] = useState<InUteroInterventionPlanned>(
    (currentEp?.in_utero_intervention_planned as InUteroInterventionPlanned) ?? 'intrauterine_blood_transfusion_iut'
  );
  const [status, setStatus] = useState<FetalHydropsStatus>(
    (currentEp?.status as FetalHydropsStatus) ?? 'diagnostic_workup'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FetalHydropsEvaluation | null>(null);

  useEffect(() => {
    try {
      const evalResult = evaluateFetalHydrops({
        gestationalAgeWeeks,
        ascitesPresent,
        pleuralEffusionPresent,
        pericardialEffusionPresent,
        skinEdemaPresent,
        placentalEdemaPresent,
        polyhydramniosPresent,
        mcaPsvMom,
        suspectedEtiologyCategory,
        fetalArrhythmiaDetected,
        maternalMirrorSyndromeSuspected,
        maternalSystolicBpMmhg,
        maternalDiastolicBpMmhg,
        maternalProteinuriaGrade,
        maternalGeneralizedAnasarca,
        inUteroInterventionPlanned,
      });
      setPreview(evalResult);
    } catch {
      setPreview(null);
    }
  }, [
    gestationalAgeWeeks,
    ascitesPresent,
    pleuralEffusionPresent,
    pericardialEffusionPresent,
    skinEdemaPresent,
    placentalEdemaPresent,
    polyhydramniosPresent,
    mcaPsvMom,
    suspectedEtiologyCategory,
    fetalArrhythmiaDetected,
    maternalMirrorSyndromeSuspected,
    maternalSystolicBpMmhg,
    maternalDiastolicBpMmhg,
    maternalProteinuriaGrade,
    maternalGeneralizedAnasarca,
    inUteroInterventionPlanned,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let compCount = 0;
    if (ascitesPresent) compCount++;
    if (pleuralEffusionPresent) compCount++;
    if (pericardialEffusionPresent) compCount++;
    if (skinEdemaPresent) compCount++;
    if (placentalEdemaPresent) compCount++;

    const payload = {
      patientId,
      diagnosisDatetime,
      gestationalAgeWeeks,
      fetalCompartmentsInvolvedCount: compCount,
      ascitesPresent,
      pleuralEffusionPresent,
      pericardialEffusionPresent,
      skinEdemaPresent,
      placentalEdemaPresent,
      polyhydramniosPresent,
      mcaPsvMom,
      suspectedEtiologyCategory,
      fetalArrhythmiaDetected,
      maternalMirrorSyndromeSuspected,
      maternalSystolicBpMmhg,
      maternalDiastolicBpMmhg,
      maternalProteinuriaGrade,
      maternalGeneralizedAnasarca,
      inUteroInterventionPlanned,
      status,
      clinicalNotes: clinicalNotes.trim() || undefined,
    };

    try {
      if (currentEp?.id) {
        await updateFetalHydropsEpisode(currentEp.id, payload);
        if (onSaved) onSaved();
      } else {
        const res = await createFetalHydropsEpisode(payload);
        if (onSuccess) onSuccess(res.episode.id);
        if (onSaved) onSaved();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save fetal hydrops episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {currentEp ? 'Edit Non-Immune Fetal Hydrops (NIHF) Protocol' : 'Initiate Non-Immune Fetal Hydrops & Mirror Syndrome Protocol'}
          </h3>
          <button className="btn small" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label>Diagnosis Date & Time *</label>
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
                min="12.0"
                max="43.0"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 26.0)}
                required
              />
            </div>

            <div>
              <label>MCA Peak Systolic Velocity (MoM) *</label>
              <input
                type="number"
                step="0.05"
                min="0.2"
                max="4.0"
                value={mcaPsvMom}
                onChange={(e) => setMcaPsvMom(parseFloat(e.target.value) || 1.0)}
                required
              />
              <span className="small muted">Threshold &ge; 1.5 MoM indicates severe fetal anemia</span>
            </div>
          </div>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Fetal Fluid Compartments (&ge; 2 required for Hydrops)</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              <label><input type="checkbox" checked={ascitesPresent} onChange={(e) => setAscitesPresent(e.target.checked)} /> Fetal Ascites</label>
              <label><input type="checkbox" checked={pleuralEffusionPresent} onChange={(e) => setPleuralEffusionPresent(e.target.checked)} /> Pleural Effusion</label>
              <label><input type="checkbox" checked={pericardialEffusionPresent} onChange={(e) => setPericardialEffusionPresent(e.target.checked)} /> Pericardial Effusion</label>
              <label><input type="checkbox" checked={skinEdemaPresent} onChange={(e) => setSkinEdemaPresent(e.target.checked)} /> Skin Edema (&ge; 5 mm)</label>
              <label><input type="checkbox" checked={placentalEdemaPresent} onChange={(e) => setPlacentalEdemaPresent(e.target.checked)} /> Placentomegaly (&ge; 4-6 cm)</label>
              <label><input type="checkbox" checked={polyhydramniosPresent} onChange={(e) => setPolyhydramniosPresent(e.target.checked)} /> Polyhydramnios (AFI &gt; 24cm)</label>
            </div>
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginTop: 16 }}>
            <div>
              <label>Suspected Etiology Category *</label>
              <select
                value={suspectedEtiologyCategory}
                onChange={(e) => setSuspectedEtiologyCategory(e.target.value as SuspectedHydropsEtiology)}
                required
              >
                <option value="cardiovascular_structural_or_arrhythmia">Cardiovascular (40% - Echo / Arrhythmia)</option>
                <option value="fetal_anemia_parvovirus_or_hemoglobinopathy">Fetal Anemia (Parvovirus / Bart's / FMH)</option>
                <option value="chromosomal_genetic_aneuploidy">Chromosomal / Genetic (Turner, T21, Noonan)</option>
                <option value="thoracic_lymphatic_cpam_chylothorax">Thoracic / Lymphatic (CPAM, Chylothorax)</option>
                <option value="twin_transfusion_ttts_or_taps">Monochorionic Twin (TTTS, TAPS)</option>
                <option value="inborn_errors_metabolism_lysosomal">Metabolic / Inborn Errors of Metabolism</option>
                <option value="idiopathic_unexplained">Idiopathic / Unexplained</option>
              </select>
            </div>

            <div>
              <label>In-Utero Intervention Plan *</label>
              <select
                value={inUteroInterventionPlanned}
                onChange={(e) => setInUteroInterventionPlanned(e.target.value as InUteroInterventionPlanned)}
                required
              >
                <option value="intrauterine_blood_transfusion_iut">Intrauterine Transfusion (IUT)</option>
                <option value="fetal_thoracocentesis_or_pigtail_shunt">Fetal Thoracocentesis / Pigtail Shunt</option>
                <option value="antiarrhythmic_transplacental_therapy">Transplacental Antiarrhythmic Therapy</option>
                <option value="amnioreduction_serial">Serial Amnioreduction</option>
                <option value="conservative_surveillance">Conservative Surveillance</option>
                <option value="emergent_delivery_indicated">Emergent Preterm Delivery</option>
              </select>
            </div>

            <div>
              <label>Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FetalHydropsStatus)}
                required
              >
                <option value="diagnostic_workup">Diagnostic Workup</option>
                <option value="in_utero_intervention_active">In-Utero Intervention Active</option>
                <option value="mirror_syndrome_monitoring">Mirror Syndrome Monitoring</option>
                <option value="fetal_hydrops_resolving">Fetal Hydrops Resolving</option>
                <option value="preterm_emergency_delivery">Preterm Emergency Delivery</option>
                <option value="intrauterine_fetal_demise">Intrauterine Fetal Demise</option>
                <option value="resolved_neonatal_transition">Resolved / Neonatal Transition</option>
              </select>
            </div>
          </div>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #e57373', borderRadius: 6, backgroundColor: '#fff5f5' }}>
            <legend style={{ fontWeight: 'bold', color: '#c62828' }}>Maternal Mirror Syndrome (Ballantyne) Screen</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              <label><input type="checkbox" checked={maternalGeneralizedAnasarca} onChange={(e) => setMaternalGeneralizedAnasarca(e.target.checked)} /> Maternal Generalized Anasarca / Rapid Weight Gain</label>
              <label><input type="checkbox" checked={maternalMirrorSyndromeSuspected} onChange={(e) => setMaternalMirrorSyndromeSuspected(e.target.checked)} /> High Suspicion of Mirror Syndrome</label>
              <label><input type="checkbox" checked={fetalArrhythmiaDetected} onChange={(e) => setFetalArrhythmiaDetected(e.target.checked)} /> Fetal Tachyarrhythmia / Heart Block</label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 8 }}>
              <div>
                <label>Maternal Systolic BP (mmHg)</label>
                <input type="number" min="60" max="250" value={maternalSystolicBpMmhg} onChange={(e) => setMaternalSystolicBpMmhg(parseInt(e.target.value) || 120)} />
              </div>
              <div>
                <label>Maternal Diastolic BP (mmHg)</label>
                <input type="number" min="40" max="160" value={maternalDiastolicBpMmhg} onChange={(e) => setMaternalDiastolicBpMmhg(parseInt(e.target.value) || 80)} />
              </div>
              <div>
                <label>Maternal Proteinuria</label>
                <select value={maternalProteinuriaGrade} onChange={(e) => setMaternalProteinuriaGrade(e.target.value)}>
                  <option value="nil">Nil</option>
                  <option value="trace">Trace</option>
                  <option value="1_plus">1+</option>
                  <option value="2_plus">2+</option>
                  <option value="3_plus">3+</option>
                  <option value="4_plus">4+</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Clinical Decision Support Preview Box */}
          {preview && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: preview.isMirrorSyndromeTriggered ? '#ffebee' : '#f0f4f8', borderRadius: 6, borderLeft: `5px solid ${preview.isMirrorSyndromeTriggered ? '#d32f2f' : '#1976d2'}` }}>
              <h4 style={{ margin: '0 0 8px 0', color: preview.isMirrorSyndromeTriggered ? '#d32f2f' : '#1976d2' }}>
                Clinical Calculation Engine Analysis: {preview.urgencyTierLabel}
              </h4>
              <p style={{ margin: '4px 0' }}>
                <strong>True Hydrops Fetalis:</strong> {preview.isTrueHydropsFetalis ? `YES (${preview.compartmentsCount} compartments)` : `NO (${preview.compartmentsCount} compartment)`} | <strong>Severe Anemia (MCA &ge; 1.5 MoM):</strong> {preview.isSevereFetalAnemia ? 'YES (EMERGENT IUT INDICATED)' : 'NO'} | <strong>Mirror Syndrome:</strong> {preview.isMirrorSyndromeTriggered ? 'TRIGGERED (CRITICAL)' : 'NOT DETECTED'}
              </p>

              {preview.alerts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {preview.alerts.map((al, idx) => (
                    <div key={idx} style={{ color: '#b71c1c', fontWeight: 'bold', fontSize: '0.85rem' }}>⚠️ {al}</div>
                  ))}
                </div>
              )}

              {preview.interventionDirectives.length > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.85rem' }}>
                  <strong>Intervention Directives:</strong>
                  <ul style={{ margin: '2px 0 0 16px', padding: 0 }}>
                    {preview.interventionDirectives.map((idr, idx) => <li key={idx}>{idr}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label>Detailed Clinical Notes & MFM Consultation Plan</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Sonographic fluid measurements, cordocentesis hematocrit, transplacental drug titration, maternal stabilization plan..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : currentEp ? 'Update Episode' : 'Create Hydrops Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
