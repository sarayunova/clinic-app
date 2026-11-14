import React, { useState, useEffect } from 'react';
import {
  createPediatricAcuteLiverFailureEpisode,
  updatePediatricAcuteLiverFailureEpisode,
  type PediatricAcuteLiverFailureRecord,
} from '../api';
import {
  evaluatePediatricAcuteLiverFailure,
  type PediatricAcuteLiverFailureResult,
  type PalfEtiology,
  type HepaticEncephalopathyGrade,
} from '../pediatricAcuteLiverFailureEngine';

interface Props {
  patientId: number;
  initialEpisode?: PediatricAcuteLiverFailureRecord | null;
  existingEpisode?: PediatricAcuteLiverFailureRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const PediatricAcuteLiverFailureModal: React.FC<Props> = ({
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
  const [ageMonths, setAgeMonths] = useState<number>(currentEp?.age_months ?? 48);
  const [weightKg, setWeightKg] = useState<number>(currentEp?.weight_kg ?? 16.0);
  const [suspectedEtiology, setSuspectedEtiology] = useState<PalfEtiology>(
    currentEp?.suspected_etiology ?? 'viral_hepatitis'
  );
  const [encephalopathyStage, setEncephalopathyStage] = useState<HepaticEncephalopathyGrade>(
    (currentEp?.encephalopathy_stage as HepaticEncephalopathyGrade) ?? 1
  );
  const [inr, setInr] = useState<number>(currentEp?.inr ?? 2.4);
  const [totalBilirubinMgDl, setTotalBilirubinMgDl] = useState<number>(
    currentEp?.total_bilirubin_mg_dl ?? 12.5
  );
  const [directBilirubinMgDl, setDirectBilirubinMgDl] = useState<string>(
    currentEp?.direct_bilirubin_mg_dl ? String(currentEp.direct_bilirubin_mg_dl) : '8.2'
  );
  const [altUL, setAltUL] = useState<number>(currentEp?.alt_u_l ?? 1450);
  const [astUL, setAstUL] = useState<number>(currentEp?.ast_u_l ?? 1620);
  const [serumAmmoniaUmolL, setSerumAmmoniaUmolL] = useState<string>(
    currentEp?.serum_ammonia_umol_l ? String(currentEp.serum_ammonia_umol_l) : '110'
  );
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<number>(
    currentEp?.blood_glucose_mg_dl ?? 88
  );
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<string>(
    currentEp?.serum_sodium_meq_l ? String(currentEp.serum_sodium_meq_l) : '142'
  );
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<string>(
    currentEp?.serum_creatinine_mg_dl ? String(currentEp.serum_creatinine_mg_dl) : '0.6'
  );
  const [hasCerebralEdema, setHasCerebralEdema] = useState<boolean>(
    currentEp ? Boolean(currentEp.has_cerebral_edema) : false
  );
  const [hypertonicSaline3pctActive, setHypertonicSaline3pctActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.hypertonic_saline_3pct_active) : true
  );
  const [mannitolAdministered, setMannitolAdministered] = useState<boolean>(
    currentEp ? Boolean(currentEp.mannitol_administered) : false
  );
  const [nacInfusionActive, setNacInfusionActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.nac_infusion_active) : true
  );
  const [lactuloseActive, setLactuloseActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.lactulose_active) : true
  );
  const [transplantCenterContacted, setTransplantCenterContacted] = useState<boolean>(
    currentEp ? Boolean(currentEp.transplant_center_contacted) : false
  );
  const [status, setStatus] = useState<'active' | 'stabilized' | 'resolved' | 'transferred'>(
    currentEp?.status ?? 'active'
  );
  const [clinicalSummary, setClinicalSummary] = useState<string>(
    currentEp?.clinical_summary ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PediatricAcuteLiverFailureResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluatePediatricAcuteLiverFailure({
        ageMonths,
        weightKg,
        suspectedEtiology,
        encephalopathyStage,
        inr,
        totalBilirubinMgDl,
        directBilirubinMgDl: directBilirubinMgDl ? parseFloat(directBilirubinMgDl) : null,
        altUL,
        astUL,
        serumAmmoniaUmolL: serumAmmoniaUmolL ? parseFloat(serumAmmoniaUmolL) : null,
        bloodGlucoseMgDl,
        serumSodiumMeqL: serumSodiumMeqL ? parseFloat(serumSodiumMeqL) : null,
        serumCreatinineMgDl: serumCreatinineMgDl ? parseFloat(serumCreatinineMgDl) : null,
        hasCerebralEdema,
      });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [
    ageMonths,
    weightKg,
    suspectedEtiology,
    encephalopathyStage,
    inr,
    totalBilirubinMgDl,
    directBilirubinMgDl,
    altUL,
    astUL,
    serumAmmoniaUmolL,
    bloodGlucoseMgDl,
    serumSodiumMeqL,
    serumCreatinineMgDl,
    hasCerebralEdema,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      diagnosisDatetime,
      ageMonths,
      weightKg,
      suspectedEtiology,
      encephalopathyStage,
      inr,
      totalBilirubinMgDl,
      directBilirubinMgDl: directBilirubinMgDl ? parseFloat(directBilirubinMgDl) : null,
      altUL,
      astUL,
      serumAmmoniaUmolL: serumAmmoniaUmolL ? parseFloat(serumAmmoniaUmolL) : null,
      bloodGlucoseMgDl,
      serumSodiumMeqL: serumSodiumMeqL ? parseFloat(serumSodiumMeqL) : null,
      serumCreatinineMgDl: serumCreatinineMgDl ? parseFloat(serumCreatinineMgDl) : null,
      hasCerebralEdema,
      hypertonicSaline3pctActive,
      mannitolAdministered,
      nacInfusionActive,
      lactuloseActive,
      transplantCenterContacted,
      status,
      clinicalSummary: clinicalSummary || null,
    };

    try {
      if (currentEp) {
        await updatePediatricAcuteLiverFailureEpisode(currentEp.id, payload);
        onSaved?.();
        onSuccess?.(currentEp.id);
      } else {
        const res = await createPediatricAcuteLiverFailureEpisode(payload);
        onSaved?.();
        onSuccess?.(res.id);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save PALF episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 860, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            {currentEp ? 'Edit PALF Episode' : 'Initiate Pediatric Acute Liver Failure (PALF) & Neuroprotection Protocol'}
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
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Age (months) *</label>
              <input
                type="number"
                min="0"
                max="240"
                value={ageMonths}
                onChange={(e) => setAgeMonths(parseInt(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.8em', color: '#666' }}>
                ({(ageMonths / 12).toFixed(1)} years)
              </span>
            </div>
            <div>
              <label>Weight (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="120"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 10)}
                required
              />
            </div>
            <div>
              <label>Suspected Etiology *</label>
              <select
                value={suspectedEtiology}
                onChange={(e) => setSuspectedEtiology(e.target.value as PalfEtiology)}
              >
                <option value="viral_hepatitis">Viral Hepatitis (HAV, HBV, HEV, HSV, EBV)</option>
                <option value="acetaminophen_toxicity">Acetaminophen (APAP) Toxicity / Overdose</option>
                <option value="autoimmune_hepatitis">Autoimmune Hepatitis (AIH Type 1/2)</option>
                <option value="metabolic_wilson_galactosemia">Metabolic (Wilson Disease, Galactosemia, MSUD)</option>
                <option value="ischemic_shock">Ischemic / Post-Cardiac Arrest Shock Liver</option>
                <option value="drug_induced_dili">Idiosyncratic DILI (Antiepileptics / Antibiotics)</option>
                <option value="gestational_neonatal_hemochromatosis">Gestational Alloimmune Liver Disease (GALD)</option>
                <option value="indeterminate">Indeterminate / Cryptogenic PALF</option>
              </select>
            </div>
          </div>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Coagulation & Hepatic Encephalopathy (PALF Criteria)</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label>INR *</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.8"
                  value={inr}
                  onChange={(e) => setInr(parseFloat(e.target.value) || 1.0)}
                  required
                />
                <span style={{ fontSize: '0.8em', color: inr >= 1.5 ? '#d9534f' : '#666' }}>
                  PALF: INR &ge; 1.5 with HE, or &ge; 2.0 without
                </span>
              </div>
              <div>
                <label>Hepatic Encephalopathy Grade *</label>
                <select
                  value={encephalopathyStage}
                  onChange={(e) => setEncephalopathyStage(parseInt(e.target.value) as HepaticEncephalopathyGrade)}
                >
                  <option value={0}>Grade 0: Normal cognition / no asterixis</option>
                  <option value={1}>Grade 1: Sleep reversal, irritability, mild confusion</option>
                  <option value={2}>Grade 2: Lethargy, disorientation, asterixis present</option>
                  <option value={3}>Grade 3: Somnolence / stupor, responds to commands</option>
                  <option value={4}>Grade 4: Coma, decerebrate/decorticate posturing</option>
                </select>
              </div>
              <div>
                <label>Serum Ammonia (µmol/L)</label>
                <input
                  type="number"
                  step="1"
                  value={serumAmmoniaUmolL}
                  onChange={(e) => setSerumAmmoniaUmolL(e.target.value)}
                  placeholder="Target < 100 µmol/L"
                />
              </div>
              <div>
                <label>Total Bilirubin (mg/dL) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={totalBilirubinMgDl}
                  onChange={(e) => setTotalBilirubinMgDl(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <label>ALT (U/L) *</label>
                <input
                  type="number"
                  step="1"
                  value={altUL}
                  onChange={(e) => setAltUL(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <label>AST (U/L) *</label>
                <input
                  type="number"
                  step="1"
                  value={astUL}
                  onChange={(e) => setAstUL(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
          </fieldset>

          <fieldset style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
            <legend style={{ fontWeight: 'bold' }}>Neuroprotection & PICU Resuscitation Bundle</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={hasCerebralEdema}
                    onChange={(e) => setHasCerebralEdema(e.target.checked)}
                  />
                  Cerebral Edema / Elevated ICP Suspected
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={hypertonicSaline3pctActive}
                    onChange={(e) => setHypertonicSaline3pctActive(e.target.checked)}
                  />
                  3% Hypertonic Saline Continuous Infusion
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={nacInfusionActive}
                    onChange={(e) => setNacInfusionActive(e.target.checked)}
                  />
                  IV N-Acetylcysteine (NAC) Active (ALF Protocol)
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={lactuloseActive}
                    onChange={(e) => setLactuloseActive(e.target.checked)}
                  />
                  Oral / Rectal Lactulose Active
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={transplantCenterContacted}
                    onChange={(e) => setTransplantCenterContacted(e.target.checked)}
                  />
                  Pediatric Liver Transplant Center Contacted
                </label>
              </div>
              <div>
                <label>Serum Sodium (mEq/L)</label>
                <input
                  type="number"
                  step="1"
                  value={serumSodiumMeqL}
                  onChange={(e) => setSerumSodiumMeqL(e.target.value)}
                  placeholder="Target 145 - 150"
                />
              </div>
              <div>
                <label>Blood Glucose (mg/dL) *</label>
                <input
                  type="number"
                  step="1"
                  value={bloodGlucoseMgDl}
                  onChange={(e) => setBloodGlucoseMgDl(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <label>Serum Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.05"
                  value={serumCreatinineMgDl}
                  onChange={(e) => setSerumCreatinineMgDl(e.target.value)}
                  placeholder="e.g. 0.6"
                />
              </div>
            </div>
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
            <div>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="active">Active Multi-Organ Resuscitation</option>
                <option value="stabilized">Stabilized / Spontaneous Recovery</option>
                <option value="resolved">Resolved / Discharged</option>
                <option value="transferred">Transferred for Liver Transplantation</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Clinical Notes / Transplant Coordination</label>
            <textarea
              rows={2}
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              placeholder="e.g. King's College criteria fulfilled; UNOS Status 1A requested; recipient donor crossmatch in progress; 30-degree head elevation maintained..."
            />
          </div>

          {preview && (
            <div
              className={`card ${
                preview.palfSeverityCategory === 'fulminant_hepatic_failure'
                  ? 'border-danger'
                  : preview.palfSeverityCategory === 'acute_liver_injury_coagulopathy'
                  ? 'border-warning'
                  : 'border-info'
              }`}
              style={{ marginTop: 16, padding: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge" style={{ fontWeight: 'bold' }}>
                  {preview.severityLabel}
                </span>
                <span style={{ color: preview.kingsCollege.isCriteriaMet ? '#d9534f' : 'inherit', fontWeight: 'bold' }}>
                  King&apos;s College Criteria: {preview.kingsCollege.isCriteriaMet ? 'POSITIVE (Emergent Transplant)' : 'Negative (Surveillance)'}
                </span>
              </div>

              <div style={{ marginTop: 8 }}>
                <strong>Neuroprotection & Sodium Target: </strong>
                {preview.neuroprotectionPlan.targetSodiumMeqL}
              </div>

              <div style={{ marginTop: 4, fontSize: '0.9em', color: '#555' }}>
                {preview.neuroprotectionPlan.hypertonicSalineDirectives}
              </div>

              {preview.clinicalAlerts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ color: '#d9534f' }}>Critical Clinical Alerts:</strong>
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
              {saving ? 'Saving...' : currentEp ? 'Update Record' : 'Initiate PALF Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
