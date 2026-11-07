import React, { useState, useEffect } from 'react';
import { calculatePediatricTbi, createPediatricTbiEpisode } from '../api';

interface Props {
  patientId: number;
  ageMonths?: number;
  weightKg?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricTbiPecarnModal: React.FC<Props> = ({
  patientId,
  ageMonths = 30,
  weightKg = 13.5,
  onClose,
  onSaved,
}) => {
  const [age, setAge] = useState(ageMonths);
  const [weight, setWeight] = useState(weightKg);
  const [injuryDatetime, setInjuryDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [mechanism, setMechanism] = useState('fall_greater_than_threshold');
  const [gcs, setGcs] = useState(14);
  const [alteredMentalStatus, setAlteredMentalStatus] = useState(false);
  const [severeMechanism, setSevereMechanism] = useState(true);

  // < 2yo specifics
  const [palpableFracture, setPalpableFracture] = useState(false);
  const [nonFrontalHematoma, setNonFrontalHematoma] = useState(true);
  const [locSeconds, setLocSeconds] = useState(10);
  const [actingAbnormalParent, setActingAbnormalParent] = useState(false);

  // >= 2yo specifics
  const [basilarFracture, setBasilarFracture] = useState(false);
  const [vomitingCount, setVomitingCount] = useState(2);
  const [severeHeadache, setSevereHeadache] = useState(false);

  // CT & ICP
  const [ctPerformed, setCtPerformed] = useState(false);
  const [ctFindings, setCtFindings] = useState('not_performed');
  const [raisedIcpSuspected, setRaisedIcpSuspected] = useState(false);
  const [icpTier, setIcpTier] = useState('tier_0_observation');
  const [hyperosmolarAgent, setHyperosmolarAgent] = useState('none');
  const [intubationStatus, setIntubationStatus] = useState('natural_airway');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const isUnder2 = age < 24;

  useEffect(() => {
    void calculatePediatricTbi({
      ageMonths: age,
      weightKg: weight,
      gcsScore: gcs,
      alteredMentalStatus,
      palpableSkullFracture: isUnder2 ? palpableFracture : false,
      nonFrontalScalpHematoma: isUnder2 ? nonFrontalHematoma : false,
      lossOfConsciousnessSeconds: locSeconds,
      actingAbnormalParent: isUnder2 ? actingAbnormalParent : false,
      signsOfBasilarFracture: !isUnder2 ? basilarFracture : false,
      vomitingEpisodesCount: !isUnder2 ? vomitingCount : 0,
      severeHeadache: !isUnder2 ? severeHeadache : false,
      severeMechanism,
      intubationStatus,
    }).then((res) => {
      setPreview(res.evalResult);
      if (res.evalResult?.icpTierRecommended && res.evalResult.icpTierRecommended !== 'tier_0_observation') {
        setIcpTier(res.evalResult.icpTierRecommended);
      }
    });
  }, [
    age,
    weight,
    gcs,
    alteredMentalStatus,
    palpableFracture,
    nonFrontalHematoma,
    locSeconds,
    actingAbnormalParent,
    basilarFracture,
    vomitingCount,
    severeHeadache,
    severeMechanism,
    intubationStatus,
    isUnder2,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createPediatricTbiEpisode({
        patientId,
        injuryDatetime,
        ageMonths: age,
        weightKg: weight,
        injuryMechanism: mechanism,
        gcsScore: gcs,
        alteredMentalStatus,
        palpableSkullFracture: isUnder2 ? palpableFracture : false,
        nonFrontalScalpHematoma: isUnder2 ? nonFrontalHematoma : false,
        lossOfConsciousnessSeconds: locSeconds,
        actingAbnormalParent: isUnder2 ? actingAbnormalParent : false,
        signsOfBasilarFracture: !isUnder2 ? basilarFracture : false,
        vomitingEpisodesCount: !isUnder2 ? vomitingCount : 0,
        severeHeadache: !isUnder2 ? severeHeadache : false,
        severeMechanism,
        ctPerformed,
        ctFindings,
        raisedIcpSuspected,
        icpManagementTier: icpTier,
        hyperosmolarAgent,
        intubationStatus,
        clinicalNotes: notes,
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Error saving TBI episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal large" style={{ maxWidth: '850px' }}>
        <h2>🧠 Pediatric TBI & PECARN Neuro-Imaging Rule</h2>
        <p className="muted">Age-Stratified PECARN Decision Algorithm & Tiered Raised ICP Resuscitation</p>

        <form onSubmit={handleSubmit}>
          <div className="grid col-3 gap-1">
            <div>
              <label>Age (months) — {isUnder2 ? '👶 < 2 Years' : '🧒 ≥ 2 Years'}</label>
              <input type="number" min="0" max="216" value={age} onChange={(e) => setAge(parseInt(e.target.value, 10) || 0)} required />
            </div>
            <div>
              <label>Weight (kg)</label>
              <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} required />
            </div>
            <div>
              <label>Injury Datetime</label>
              <input type="datetime-local" value={injuryDatetime} onChange={(e) => setInjuryDatetime(e.target.value)} required />
            </div>
          </div>

          <div className="grid col-2 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>Mechanism of Injury</label>
              <select value={mechanism} onChange={(e) => setMechanism(e.target.value)}>
                <option value="fall_greater_than_threshold">Fall &gt; 3ft (&lt;2y) or &gt; 5ft (≥2y)</option>
                <option value="severe_motor_vehicle_collision">Severe Motor Vehicle Collision</option>
                <option value="pedestrian_or_cyclist_vs_vehicle">Pedestrian / Cyclist vs. Motor Vehicle</option>
                <option value="struck_by_high_velocity_object">Struck by High-Velocity Object</option>
                <option value="ground_level_fall">Ground-Level Fall (Low risk)</option>
                <option value="assault_non_accidental_trauma">Assault / Suspected NAT</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label>Glasgow Coma Scale (pGCS: 3–15)</label>
              <input type="number" min="3" max="15" value={gcs} onChange={(e) => setGcs(parseInt(e.target.value, 10) || 15)} required />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label className="checkbox"><input type="checkbox" checked={alteredMentalStatus} onChange={(e) => setAlteredMentalStatus(e.target.checked)} /> <strong>Altered Mental Status</strong> (Agitation, somnolence, repetitive questioning, delayed response)</label>
            <label className="checkbox"><input type="checkbox" checked={severeMechanism} onChange={(e) => setSevereMechanism(e.target.checked)} /> High-energy / Severe injury mechanism</label>
          </div>

          {isUnder2 ? (
            <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #337ab7' }}>
              <legend><strong>👶 PECARN Criteria for Children &lt; 2 Years</strong></legend>
              <div className="grid col-2 gap-1">
                <label className="checkbox" style={{ color: '#d9534f' }}><input type="checkbox" checked={palpableFracture} onChange={(e) => setPalpableFracture(e.target.checked)} /> <strong>Palpable Skull Fracture</strong> (High risk)</label>
                <label className="checkbox"><input type="checkbox" checked={nonFrontalHematoma} onChange={(e) => setNonFrontalHematoma(e.target.checked)} /> Non-frontal scalp hematoma (Parietal, temporal, occipital)</label>
                <label className="checkbox"><input type="checkbox" checked={actingAbnormalParent} onChange={(e) => setActingAbnormalParent(e.target.checked)} /> Not acting normally per parent report</label>
                <div>
                  <label>Loss of Consciousness (seconds)</label>
                  <input type="number" min="0" value={locSeconds} onChange={(e) => setLocSeconds(parseInt(e.target.value, 10) || 0)} placeholder="0 if none" />
                </div>
              </div>
            </fieldset>
          ) : (
            <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #337ab7' }}>
              <legend><strong>🧒 PECARN Criteria for Children ≥ 2 Years</strong></legend>
              <div className="grid col-2 gap-1">
                <label className="checkbox" style={{ color: '#d9534f' }}><input type="checkbox" checked={basilarFracture} onChange={(e) => setBasilarFracture(e.target.checked)} /> <strong>Signs of Basilar Skull Fracture</strong> (Raccoon eyes, Battle sign, CSF leak)</label>
                <label className="checkbox"><input type="checkbox" checked={severeHeadache} onChange={(e) => setSevereHeadache(e.target.checked)} /> Severe headache</label>
                <div>
                  <label>Vomiting Episodes Count</label>
                  <input type="number" min="0" value={vomitingCount} onChange={(e) => setVomitingCount(parseInt(e.target.value, 10) || 0)} />
                </div>
                <div>
                  <label>Loss of Consciousness (seconds)</label>
                  <input type="number" min="0" value={locSeconds} onChange={(e) => setLocSeconds(parseInt(e.target.value, 10) || 0)} />
                </div>
              </div>
            </fieldset>
          )}

          <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
            <legend><strong>CT Findings & Tiered Raised ICP Management</strong></legend>
            <div className="grid col-2 gap-1">
              <div>
                <label className="checkbox"><input type="checkbox" checked={ctPerformed} onChange={(e) => setCtPerformed(e.target.checked)} /> Head CT Performed</label>
                {ctPerformed && (
                  <select value={ctFindings} onChange={(e) => setCtFindings(e.target.value)} style={{ marginTop: '0.25rem' }}>
                    <option value="normal">Normal Brain CT</option>
                    <option value="isolated_linear_fracture">Isolated Linear Skull Fracture</option>
                    <option value="depressed_skull_fracture">Depressed Skull Fracture</option>
                    <option value="epidural_hematoma">Epidural Hematoma (EDH)</option>
                    <option value="subdural_hematoma">Subdural Hematoma (SDH)</option>
                    <option value="subarachnoid_hemorrhage">Traumatic Subarachnoid Hemorrhage</option>
                    <option value="cerebral_contusion">Cerebral Contusion</option>
                    <option value="diffuse_cerebral_edema_midline_shift">Cerebral Edema / Midline Shift</option>
                  </select>
                )}
              </div>
              <div>
                <label>Raised ICP Management Tier</label>
                <select value={icpTier} onChange={(e) => setIcpTier(e.target.value)}>
                  <option value="tier_0_observation">Tier 0: Neurological Observation</option>
                  <option value="tier_1_neuroprotective">Tier 1: Neuroprotective (HOB 30°, Normothermia, Sedation)</option>
                  <option value="tier_2_hyperosmolar_therapy">Tier 2: Hyperosmolar Therapy (3% Saline / Mannitol)</option>
                  <option value="tier_3_refractory_decompression">Tier 3: Refractory (Hyperventilation, cEEG, Decompressive Craniectomy)</option>
                </select>
              </div>
            </div>

            <div className="grid col-2 gap-1" style={{ marginTop: '0.5rem' }}>
              <div>
                <label>Hyperosmolar Agent</label>
                <select value={hyperosmolarAgent} onChange={(e) => setHyperosmolarAgent(e.target.value)}>
                  <option value="none">None</option>
                  <option value="hypertonic_saline_3pct">3% Hypertonic Saline (3 mL/kg bolus)</option>
                  <option value="mannitol_20pct">20% Mannitol (0.5 g/kg infusion)</option>
                </select>
              </div>
              <div>
                <label>Airway Status</label>
                <select value={intubationStatus} onChange={(e) => setIntubationStatus(e.target.value)}>
                  <option value="natural_airway">Natural Spontaneous Breathing</option>
                  <option value="intubated_mechanical_ventilation">Intubated & Mechanical Ventilation</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Emergency & Neurosurgical Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Neurosurgical consult time, pupillary asymmetry, seizure prophylaxis started..." />
          </div>

          {preview && (
            <div className={`banner ${preview.pecarnRiskTier === 'high_risk_ct_indicated' ? 'danger' : preview.pecarnRiskTier === 'intermediate_risk_observation_vs_ct' ? 'warn' : 'info'}`} style={{ marginTop: '1rem' }}>
              <h4>{preview.pecarnRiskTitle}</h4>
              <p><strong>ciTBI Risk:</strong> {preview.ciTbiRiskPercent}</p>
              <p><strong>CT Decision:</strong> {preview.ctRecommendation}</p>
              {preview.recommendedHypertonicSaline3Pct && (
                <p><strong>3% Saline Dose (3 mL/kg):</strong> {preview.recommendedHypertonicSaline3Pct.doseVolumeMl} mL IV push over 10 min.</p>
              )}
              {preview.clinicalActionPlan.map((action: string, i: number) => (
                <div key={i} style={{ marginTop: '0.25rem' }}>• {action}</div>
              ))}
            </div>
          )}

          <div className="actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : 'Save TBI Episode'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
