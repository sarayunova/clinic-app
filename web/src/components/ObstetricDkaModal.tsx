import React, { useState, useEffect } from 'react';
import { createObstetricDkaEpisode, calculateObstetricDka } from '../api';

interface ObstetricDkaModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricDkaModal: React.FC<ObstetricDkaModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [presentationDatetime, setPresentationDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationWeeks, setGestationWeeks] = useState(32.4);
  const [maternalWeightKg, setMaternalWeightKg] = useState(68);
  const [diabetesType, setDiabetesType] = useState<'pregestational_type1' | 'pregestational_type2' | 'gestational_gdm' | 'new_onset'>('gestational_gdm');
  const [precipitatingTrigger, setPrecipitatingTrigger] = useState<'infection_sepsis' | 'antenatal_steroid_betamethasone' | 'emesis_starvation' | 'insulin_omission' | 'pump_failure' | 'beta_mimetic_tocolysis' | 'unknown'>('antenatal_steroid_betamethasone');

  // Biochemicals
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState(185);
  const [arterialOrVenousPh, setArterialOrVenousPh] = useState(7.22);
  const [serumBicarbonateMeqL, setSerumBicarbonateMeqL] = useState(12);
  const [serumKetonesBetaOhbMmolL, setSerumKetonesBetaOhbMmolL] = useState<number | ''>(4.8);
  const [urineKetones, setUrineKetones] = useState<'negative' | 'trace' | '1_plus' | '2_plus' | '3_plus' | '4_plus'>('3_plus');
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState(134);
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState(4.2);
  const [serumChlorideMeqL, setSerumChlorideMeqL] = useState(102);

  // Fetal
  const [fetalHeartRateBaselineBpm, setFetalHeartRateBaselineBpm] = useState<number | ''>(162);
  const [fetalVariability, setFetalVariability] = useState<'normal_moderate' | 'minimal' | 'absent' | 'marked'>('minimal');
  const [decelerationsPresent, setDecelerationsPresent] = useState<'none' | 'early' | 'variable' | 'late' | 'prolonged'>('late');
  const [efmCategory, setEfmCategory] = useState<'category_1_normal' | 'category_2_indeterminate' | 'category_3_abnormal'>('category_2_indeterminate');

  // Orders
  const [insulinInfusionRateUnitsHr, setInsulinInfusionRateUnitsHr] = useState(3.4);
  const [dextroseAddedToFluids, setDextroseAddedToFluids] = useState(true);
  const [status, setStatus] = useState('active_acidosis_resuscitation');
  const [clinicalNotes, setClinicalNotes] = useState('Patient presented with nausea and tachypnea following betamethasone course. Euglycemic DKA confirmed (glucose 185 mg/dL, anion gap 20, beta-OHB 4.8 mmol/L).');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview
  useEffect(() => {
    calculateObstetricDka({
      gestationWeeks,
      maternalWeightKg,
      diabetesType,
      bloodGlucoseMgDl,
      arterialOrVenousPh,
      serumBicarbonateMeqL,
      serumSodiumMeqL,
      serumPotassiumMeqL,
      serumChlorideMeqL,
      serumKetonesBetaOhbMmolL: serumKetonesBetaOhbMmolL === '' ? undefined : Number(serumKetonesBetaOhbMmolL),
      urineKetones,
      fetalHeartRateBaselineBpm: fetalHeartRateBaselineBpm === '' ? undefined : Number(fetalHeartRateBaselineBpm),
      fetalVariability,
      decelerationsPresent,
      efmCategory,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult.regularInsulinInfusionRateUnitsHr) {
          setInsulinInfusionRateUnitsHr(res.evalResult.regularInsulinInfusionRateUnitsHr);
        }
        if (res.evalResult.isEuglycemicDka) {
          setDextroseAddedToFluids(true);
        }
      })
      .catch(() => {});
  }, [
    gestationWeeks,
    maternalWeightKg,
    diabetesType,
    bloodGlucoseMgDl,
    arterialOrVenousPh,
    serumBicarbonateMeqL,
    serumSodiumMeqL,
    serumPotassiumMeqL,
    serumChlorideMeqL,
    serumKetonesBetaOhbMmolL,
    urineKetones,
    fetalHeartRateBaselineBpm,
    fetalVariability,
    decelerationsPresent,
    efmCategory,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createObstetricDkaEpisode({
        patientId,
        presentationDatetime,
        gestationWeeks: Number(gestationWeeks),
        maternalWeightKg: Number(maternalWeightKg),
        diabetesType,
        precipitatingTrigger,
        bloodGlucoseMgDl: Number(bloodGlucoseMgDl),
        arterialOrVenousPh: Number(arterialOrVenousPh),
        serumBicarbonateMeqL: Number(serumBicarbonateMeqL),
        serumKetonesBetaOhbMmolL: serumKetonesBetaOhbMmolL === '' ? null : Number(serumKetonesBetaOhbMmolL),
        urineKetones,
        serumSodiumMeqL: Number(serumSodiumMeqL),
        serumPotassiumMeqL: Number(serumPotassiumMeqL),
        serumChlorideMeqL: Number(serumChlorideMeqL),
        fetalHeartRateBaselineBpm: fetalHeartRateBaselineBpm === '' ? null : Number(fetalHeartRateBaselineBpm),
        fetalVariability: fetalVariability || null,
        decelerationsPresent: decelerationsPresent || null,
        efmCategory: efmCategory || null,
        insulinInfusionRateUnitsHr: Number(insulinInfusionRateUnitsHr),
        dextroseAddedToFluids,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record obstetric DKA episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 840, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#991b1b' }}>🩺 Obstetric DKA & Euglycemic Ketoacidosis Protocol</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              ACOG / Sibai & Viteri Intrauterine Resuscitation & Anion Gap Closure for {patientName}
            </span>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Presentation & Triggers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Presentation Datetime</label>
              <input type="datetime-local" className="form-control" value={presentationDatetime} onChange={(e) => setPresentationDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gestation (weeks)</label>
              <input type="number" step="0.1" className="form-control" value={gestationWeeks} onChange={(e) => setGestationWeeks(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maternal Weight (kg)</label>
              <input type="number" step="0.5" className="form-control" value={maternalWeightKg} onChange={(e) => setMaternalWeightKg(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Precipitating Trigger</label>
              <select className="form-control" value={precipitatingTrigger} onChange={(e) => setPrecipitatingTrigger(e.target.value as any)}>
                <option value="antenatal_steroid_betamethasone">Antenatal Betamethasone / Steroid</option>
                <option value="infection_sepsis">Infection / Chorioamnionitis / UTI</option>
                <option value="emesis_starvation">Hyperemesis / Prolonged Starvation</option>
                <option value="insulin_omission">Insulin Omission / Non-Adherence</option>
                <option value="pump_failure">Insulin Pump Failure</option>
                <option value="beta_mimetic_tocolysis">Beta-Mimetic Tocolytic (Terbutaline)</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          {/* Section 2: Biochemical & Acid-Base Panel */}
          <div style={{ background: '#fef2f2', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #fecaca' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#991b1b', fontSize: '0.9rem' }}>Blood Gas & Electrolyte Panel</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Blood Glucose (mg/dL)</label>
                <input type="number" className="form-control" value={bloodGlucoseMgDl} onChange={(e) => setBloodGlucoseMgDl(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Venous / Arterial pH</label>
                <input type="number" step="0.01" className="form-control" value={arterialOrVenousPh} onChange={(e) => setArterialOrVenousPh(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bicarbonate (mEq/L)</label>
                <input type="number" step="0.5" className="form-control" value={serumBicarbonateMeqL} onChange={(e) => setSerumBicarbonateMeqL(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Beta-OHB (mmol/L)</label>
                <input type="number" step="0.1" className="form-control" value={serumKetonesBetaOhbMmolL} onChange={(e) => setSerumKetonesBetaOhbMmolL(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 4.5" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sodium (Na mEq/L)</label>
                <input type="number" className="form-control" value={serumSodiumMeqL} onChange={(e) => setSerumSodiumMeqL(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Potassium (K mEq/L)</label>
                <input type="number" step="0.1" className="form-control" value={serumPotassiumMeqL} onChange={(e) => setSerumPotassiumMeqL(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Chloride (Cl mEq/L)</label>
                <input type="number" className="form-control" value={serumChlorideMeqL} onChange={(e) => setSerumChlorideMeqL(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Urine Ketones</label>
                <select className="form-control" value={urineKetones} onChange={(e) => setUrineKetones(e.target.value as any)}>
                  <option value="negative">Negative</option>
                  <option value="trace">Trace</option>
                  <option value="1_plus">1+ (Mild)</option>
                  <option value="2_plus">2+ (Moderate)</option>
                  <option value="3_plus">3+ (Large)</option>
                  <option value="4_plus">4+ (Severe)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Electronic Fetal Monitoring (EFM) */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#334155' }}>Fetal Heart Rate & Intrauterine Resuscitation Status</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>FHR Baseline (bpm)</label>
                <input type="number" className="form-control" value={fetalHeartRateBaselineBpm} onChange={(e) => setFetalHeartRateBaselineBpm(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 160" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Variability</label>
                <select className="form-control" value={fetalVariability} onChange={(e) => setFetalVariability(e.target.value as any)}>
                  <option value="normal_moderate">Moderate (Normal 6-25 bpm)</option>
                  <option value="minimal">Minimal (&lt; 5 bpm)</option>
                  <option value="absent">Absent (Undetectable)</option>
                  <option value="marked">Marked (&gt; 25 bpm)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Decelerations</label>
                <select className="form-control" value={decelerationsPresent} onChange={(e) => setDecelerationsPresent(e.target.value as any)}>
                  <option value="none">None</option>
                  <option value="late">Late Decelerations (Acidemia/Hypoxia)</option>
                  <option value="variable">Variable Decelerations</option>
                  <option value="prolonged">Prolonged Deceleration</option>
                  <option value="early">Early Decelerations</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>EFM Category</label>
                <select className="form-control" value={efmCategory} onChange={(e) => setEfmCategory(e.target.value as any)}>
                  <option value="category_1_normal">Category I (Normal)</option>
                  <option value="category_2_indeterminate">Category II (Indeterminate)</option>
                  <option value="category_3_abnormal">Category III (Abnormal)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Real-time Calculation Card */}
          {preview && (
            <div style={{ background: preview.isEuglycemicDka ? '#fff7ed' : '#fef2f2', border: `1px solid ${preview.isEuglycemicDka ? '#fb923c' : '#f87171'}`, padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.isEuglycemicDka ? '#c2410c' : '#991b1b', fontSize: '0.95rem' }}>
                  {preview.severityLabel}
                </strong>
                <span className={`badge ${preview.isEuglycemicDka ? 'badge-warning' : 'badge-danger'}`}>
                  Anion Gap: {preview.calculatedAnionGap} mEq/L
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8, fontSize: '0.85rem' }}>
                <div><strong>Corrected Na:</strong> {preview.correctedSodiumMeqL} mEq/L</div>
                <div><strong>Effective Osm:</strong> {preview.effectiveOsmolalityMosmKg} mOsm/kg</div>
                <div><strong>Suggested Regular Insulin:</strong> {preview.regularInsulinInfusionRateUnitsHr} U/hr</div>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#444' }}>
                <strong>Potassium:</strong> {preview.potassiumReplacementAdvice}
              </div>
              <div className="alert alert-warning" style={{ margin: '8px 0 0 0', padding: 6, fontSize: '0.82rem' }}>
                ⚠️ {preview.fetalResuscitationGuidance}
              </div>
            </div>
          )}

          {/* Section 4: Initial Orders & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Insulin Infusion Rate (U/hr)</label>
              <input type="number" step="0.1" className="form-control" value={insulinInfusionRateUnitsHr} onChange={(e) => setInsulinInfusionRateUnitsHr(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dextrose in IV Fluids</label>
              <select className="form-control" value={dextroseAddedToFluids ? 'yes' : 'no'} onChange={(e) => setDextroseAddedToFluids(e.target.value === 'yes')}>
                <option value="yes">Yes (D5W / D10W Active)</option>
                <option value="no">No (Isotonic Saline / Plasmalyte Only)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active_acidosis_resuscitation">Active Acidosis Resuscitation</option>
                <option value="euglycemic_dextrose_infusion">Euglycemic Dextrose Infusion</option>
                <option value="acidosis_resolved_transitioning">Acidosis Resolved (Transitioning)</option>
                <option value="resolved_subcutaneous_insulin">Resolved (On SubQ Insulin)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes & Management Plan</label>
            <textarea className="form-control" rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save DKA Resuscitation Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
