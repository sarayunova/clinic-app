import React, { useState, useEffect } from 'react';
import { createPediatricForeignBodyEpisode, calculatePediatricForeignBody } from '../api';

interface PediatricForeignBodyModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricForeignBodyModal: React.FC<PediatricForeignBodyModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [incidentDatetime, setIncidentDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(16);
  const [weightKg, setWeightKg] = useState(11.0);

  const [witnessedChokingEpisode, setWitnessedChokingEpisode] = useState(true);
  const [suspectedForeignBodyNature, setSuspectedForeignBodyNature] = useState<
    'organic_food_nut_seed' | 'small_toy_plastic_bead' | 'coin_metallic_battery' | 'balloon_latex' | 'unknown_material'
  >('organic_food_nut_seed');
  const [obstructionSeverity, setObstructionSeverity] = useState<
    'mild_incomplete_effective_cough' | 'severe_complete_ineffective_cough' | 'unconscious_cardiorespiratory_arrest'
  >('severe_complete_ineffective_cough');

  const [stridorOrAphonia, setStridorOrAphonia] = useState(true);
  const [cyanosisPresent, setCyanosisPresent] = useState(false);
  const [silentChestNoted, setSilentChestNoted] = useState(false);

  const [heartRateBpm, setHeartRateBpm] = useState(145);
  const [respiratoryRate, setRespiratoryRate] = useState(44);
  const [spo2Percent, setSpo2Percent] = useState(94.0);

  const [interventionApplied, setInterventionApplied] = useState<
    | 'encouraged_spontaneous_coughing'
    | 'back_blows_and_chest_thrusts_infant'
    | 'subdiaphragmatic_heimlich_child'
    | 'cpr_chest_compressions_ventilations'
    | 'rigid_bronchoscopy_or_surgical_airway'
  >('subdiaphragmatic_heimlich_child');
  const [blindFingerSweepAvoided, setBlindFingerSweepAvoided] = useState(true);
  const [foreignBodyExpelled, setForeignBodyExpelled] = useState(true);
  const [spontaneousRespirationRestored, setSpontaneousRespirationRestored] = useState(true);
  const [rigidBronchoscopyRequired, setRigidBronchoscopyRequired] = useState(false);
  const [bronchoscopyLocation, setBronchoscopyLocation] = useState<
    'none' | 'trachea_carina' | 'right_main_bronchus' | 'left_main_bronchus' | 'segmental_bronchi'
  >('none');

  const [status, setStatus] = useState<
    'acute_choking_management' | 'post_clearance_observation' | 'picu_escalation_bronchoscopy' | 'discharged_home_stable'
  >('post_clearance_observation');
  const [clinicalNotes, setClinicalNotes] = useState('Toddler choked on whole peanut while eating. Complete obstruction relieved with 3 Heimlich thrusts. Spontaneous crying restored; observing in ED.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculatePediatricForeignBody({
      ageMonths: Number(ageMonths),
      weightKg: Number(weightKg),
      witnessedChokingEpisode,
      suspectedForeignBodyNature,
      obstructionSeverity,
      stridorOrAphonia,
      cyanosisPresent,
      silentChestNoted,
      heartRateBpm: Number(heartRateBpm),
      respiratoryRate: Number(respiratoryRate),
      spo2Percent: Number(spo2Percent),
      interventionApplied,
      blindFingerSweepAvoided,
      foreignBodyExpelled,
      spontaneousRespirationRestored,
      rigidBronchoscopyRequired,
      bronchoscopyLocation,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    ageMonths,
    weightKg,
    witnessedChokingEpisode,
    suspectedForeignBodyNature,
    obstructionSeverity,
    stridorOrAphonia,
    cyanosisPresent,
    silentChestNoted,
    heartRateBpm,
    respiratoryRate,
    spo2Percent,
    interventionApplied,
    blindFingerSweepAvoided,
    foreignBodyExpelled,
    spontaneousRespirationRestored,
    rigidBronchoscopyRequired,
    bronchoscopyLocation,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createPediatricForeignBodyEpisode({
        patientId,
        incidentDatetime,
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        witnessedChokingEpisode,
        suspectedForeignBodyNature,
        obstructionSeverity,
        stridorOrAphonia,
        cyanosisPresent,
        silentChestNoted,
        heartRateBpm: Number(heartRateBpm),
        respiratoryRate: Number(respiratoryRate),
        spo2Percent: Number(spo2Percent),
        interventionApplied,
        blindFingerSweepAvoided,
        foreignBodyExpelled,
        spontaneousRespirationRestored,
        rigidBronchoscopyRequired,
        bronchoscopyLocation,
        status,
        clinicalNotes,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record foreign body choking episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ maxWidth: 840, width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: '#0369a1' }}>🥜 Pediatric Foreign Body Airway Obstruction & Choking</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Patient: <strong>{patientName}</strong> | Reference: AAP / AHA PALS Airway Guidelines
            </p>
          </div>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner error" style={{ margin: '12px 0' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          {/* Live Preview Synthesis Card */}
          {preview && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#0369a1', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                  {preview.airwayUrgencyLabel}
                </strong>
                <span className={`badge ${preview.blindFingerSweepViolation ? 'danger' : 'success'}`}>
                  {preview.blindFingerSweepViolation ? '⚠️ BLIND SWEEP VIOLATION' : '✅ NO BLIND SWEEPS'}
                </span>
              </div>
              <p style={{ margin: '6px 0', fontSize: '0.9rem' }}>{preview.maneuverDescription}</p>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.85rem', color: '#475569' }}>
                <div><strong>Age Group:</strong> {preview.isInfantUnder1Year ? 'Infant (<1 year)' : 'Child (≥1 year)'}</div>
                <div><strong>Expelled?</strong> {foreignBodyExpelled ? '✅ Dislodged' : '❌ Ongoing Impaction'}</div>
                <div><strong>Bronchoscopy:</strong> {preview.bronchoscopyUrgency.replace(/_/g, ' ').toUpperCase()}</div>
              </div>
            </div>
          )}

          {/* Timing, Age, and Incident Profile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Incident Datetime</label>
              <input
                type="datetime-local"
                className="form-control"
                value={incidentDatetime}
                onChange={(e) => setIncidentDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Age (Months)</label>
              <input
                type="number"
                min="1"
                max="216"
                className="form-control"
                value={ageMonths}
                onChange={(e) => setAgeMonths(Number(e.target.value))}
                required
              />
              <small className="muted">{Number(ageMonths) < 12 ? 'Infant: Back Slaps' : 'Child: Heimlich'}</small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="2"
                max="100"
                className="form-control"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Witnessed Choking?</label>
              <select
                className="form-control"
                value={witnessedChokingEpisode ? '1' : '0'}
                onChange={(e) => setWitnessedChokingEpisode(e.target.value === '1')}
              >
                <option value="1">YES - Sudden Choking / Gagging</option>
                <option value="0">NO - Unwitnessed / Suspected</option>
              </select>
            </div>
          </div>

          {/* Severity & Presentation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Obstruction Severity</label>
              <select
                className="form-control"
                value={obstructionSeverity}
                onChange={(e: any) => setObstructionSeverity(e.target.value)}
              >
                <option value="severe_complete_ineffective_cough">Severe / Complete (Ineffective Cough, Silent)</option>
                <option value="mild_incomplete_effective_cough">Mild / Incomplete (Effective Forceful Cough)</option>
                <option value="unconscious_cardiorespiratory_arrest">Unconscious / Cardiopulmonary Arrest</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Suspected Foreign Object</label>
              <select
                className="form-control"
                value={suspectedForeignBodyNature}
                onChange={(e: any) => setSuspectedForeignBodyNature(e.target.value)}
              >
                <option value="organic_food_nut_seed">Organic Food / Peanut / Seed</option>
                <option value="small_toy_plastic_bead">Small Toy / Plastic Bead</option>
                <option value="coin_metallic_battery">Coin / Button Battery / Metallic</option>
                <option value="balloon_latex">Latex Balloon (Conforming)</option>
                <option value="unknown_material">Unknown Foreign Object</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Airway Sounds</label>
              <select
                className="form-control"
                value={stridorOrAphonia ? '1' : '0'}
                onChange={(e) => setStridorOrAphonia(e.target.value === '1')}
              >
                <option value="1">Stridor / Complete Aphonia</option>
                <option value="0">Vocalizing Audible</option>
              </select>
            </div>
          </div>

          {/* Vitals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Heart Rate (bpm)</label>
              <input
                type="number"
                min="40"
                max="250"
                className="form-control"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Resp Rate (/min)</label>
              <input
                type="number"
                min="0"
                max="120"
                className="form-control"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>SpO₂ (%)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="100"
                className="form-control"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cyanosis?</label>
              <select
                className="form-control"
                value={cyanosisPresent ? '1' : '0'}
                onChange={(e) => setCyanosisPresent(e.target.value === '1')}
              >
                <option value="0">No Cyanosis</option>
                <option value="1">YES - Cyanotic</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Silent Chest?</label>
              <select
                className="form-control"
                value={silentChestNoted ? '1' : '0'}
                onChange={(e) => setSilentChestNoted(e.target.value === '1')}
              >
                <option value="0">No (Air Entry Present)</option>
                <option value="1">YES - Silent Chest</option>
              </select>
            </div>
          </div>

          {/* Maneuvers & Clearance Checkpoints */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16, background: '#f8fafc' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#0f172a' }}>Airway Resuscitation & Safety Checks</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intervention Applied</label>
                <select
                  className="form-control"
                  value={interventionApplied}
                  onChange={(e: any) => setInterventionApplied(e.target.value)}
                >
                  <option value="subdiaphragmatic_heimlich_child">Subdiaphragmatic Heimlich (Child ≥1y)</option>
                  <option value="back_blows_and_chest_thrusts_infant">5 Back Slaps + 5 Chest Thrusts (Infant &lt;1y)</option>
                  <option value="encouraged_spontaneous_coughing">Encourage Spontaneous Coughing (Mild)</option>
                  <option value="cpr_chest_compressions_ventilations">CPR / Compressions (Unconscious)</option>
                  <option value="rigid_bronchoscopy_or_surgical_airway">Rigid Bronchoscopy / Surgical Airway</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Blind Finger Sweeps Avoided?</label>
                <select
                  className="form-control"
                  style={{ fontWeight: 'bold', color: blindFingerSweepAvoided ? '#16a34a' : '#dc2626' }}
                  value={blindFingerSweepAvoided ? '1' : '0'}
                  onChange={(e) => setBlindFingerSweepAvoided(e.target.value === '1')}
                >
                  <option value="1">YES - Strictly Avoided</option>
                  <option value="0">NO - Blind Sweep Attempted (Violation)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Foreign Body Expelled?</label>
                <select
                  className="form-control"
                  style={{ fontWeight: 'bold', color: foreignBodyExpelled ? '#16a34a' : '#dc2626' }}
                  value={foreignBodyExpelled ? '1' : '0'}
                  onChange={(e) => setForeignBodyExpelled(e.target.value === '1')}
                >
                  <option value="1">YES - Expelled & Airway Clear</option>
                  <option value="0">NO - Still Impaction / Persistent</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Spontaneous Breathing?</label>
                <select
                  className="form-control"
                  value={spontaneousRespirationRestored ? '1' : '0'}
                  onChange={(e) => setSpontaneousRespirationRestored(e.target.value === '1')}
                >
                  <option value="1">YES - Regular Breathing</option>
                  <option value="0">NO - Bag-Mask / CPR Ongoing</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rigid Bronchoscopy?</label>
                <select
                  className="form-control"
                  value={rigidBronchoscopyRequired ? '1' : '0'}
                  onChange={(e) => setRigidBronchoscopyRequired(e.target.value === '1')}
                >
                  <option value="0">NO - Resolved by External Maneuvers</option>
                  <option value="1">YES - Transfer to OR for ENT Scope</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bronchoscopy Site</label>
                <select
                  className="form-control"
                  value={bronchoscopyLocation}
                  onChange={(e: any) => setBronchoscopyLocation(e.target.value)}
                  disabled={!rigidBronchoscopyRequired}
                >
                  <option value="none">None / Not Scoped</option>
                  <option value="trachea_carina">Trachea / Subglottis / Carina</option>
                  <option value="right_main_bronchus">Right Main Bronchus (Most common)</option>
                  <option value="left_main_bronchus">Left Main Bronchus</option>
                  <option value="segmental_bronchi">Segmental Bronchi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status & Plan */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
              <select
                className="form-control"
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
              >
                <option value="acute_choking_management">Acute Choking Management Active</option>
                <option value="post_clearance_observation">Post-Clearance Observation (2-4 hours)</option>
                <option value="picu_escalation_bronchoscopy">PICU / Bronchoscopy Escalation</option>
                <option value="discharged_home_stable">Discharged Home Stable</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes</label>
              <input
                type="text"
                className="form-control"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Airway examination, breath sounds, CXR findings..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Saving...' : '💾 Save Choking Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
