import React, { useState } from 'react';
import { addObstetricShoulderDystociaFlowsheet } from '../api';

interface ObstetricShoulderDystociaFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricShoulderDystociaFlowsheetModal: React.FC<ObstetricShoulderDystociaFlowsheetModalProps> = ({
  episodeId,
  patientId: _patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [secondsFromHeadDelivery, setSecondsFromHeadDelivery] = useState(90);
  const [maneuverAttempted, setManeuverAttempted] = useState<
    | 'call_help_timer_started'
    | 'mcroberts_hyperflexion'
    | 'suprapubic_rubin_i_pressure'
    | 'episiotomy_incision'
    | 'rubin_ii_internal_rotation'
    | 'woods_screw_rotation'
    | 'reverse_woods_rotation'
    | 'delivery_posterior_arm'
    | 'gaskin_all_fours_roll'
    | 'cleidotomy_fracture'
    | 'zavanelli_or_emergency_csection'
  >('suprapubic_rubin_i_pressure');
  const [maneuverOutcome, setManeuverOutcome] = useState<
    'successful_restitution_and_delivery' | 'failed_advance_to_next_step' | 'partial_rotation_incomplete'
  >('successful_restitution_and_delivery');
  const [tractionApplied, setTractionApplied] = useState<
    'none' | 'gentle_axial_traction_only' | 'excessive_lateral_traction_prevented'
  >('gentle_axial_traction_only');
  const [notes, setNotes] = useState('Assistant applied CPR-style suprapubic pressure with continuous gentle axial traction. Anterior shoulder disimpacted.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addObstetricShoulderDystociaFlowsheet(episodeId, {
        logDatetime,
        secondsFromHeadDelivery: Number(secondsFromHeadDelivery),
        maneuverAttempted,
        maneuverOutcome,
        tractionApplied,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record maneuver flowsheet log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ maxWidth: 640, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 10 }}>
          <h3 style={{ margin: 0, color: '#b91c1c' }}>⏱️ HELPERR Maneuver Timestamp Log</h3>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner error" style={{ margin: '12px 0' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Log Datetime</label>
              <input
                type="datetime-local"
                className="form-control"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Seconds from Head Delivery</label>
              <input
                type="number"
                min="0"
                max="1800"
                className="form-control"
                value={secondsFromHeadDelivery}
                onChange={(e) => setSecondsFromHeadDelivery(Number(e.target.value))}
                required
              />
              <small className="muted">Elapsed time since head emerged</small>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>HELPERR Maneuver Attempted</label>
            <select
              className="form-control"
              value={maneuverAttempted}
              onChange={(e: any) => setManeuverAttempted(e.target.value)}
            >
              <option value="call_help_timer_started">H: Call for Help / Timer Started</option>
              <option value="mcroberts_hyperflexion">L: McRoberts Maneuver (Hyperflex Hips)</option>
              <option value="suprapubic_rubin_i_pressure">P: Suprapubic Pressure (Rubin I)</option>
              <option value="episiotomy_incision">E: Episiotomy Incision (Space Access)</option>
              <option value="rubin_ii_internal_rotation">E: Rubin II Internal Rotation</option>
              <option value="woods_screw_rotation">E: Woods Screw Rotation (180°)</option>
              <option value="reverse_woods_rotation">E: Reverse Woods Rotation</option>
              <option value="delivery_posterior_arm">R: Delivery of Posterior Arm</option>
              <option value="gaskin_all_fours_roll">R: Roll onto All-Fours (Gaskin Maneuver)</option>
              <option value="cleidotomy_fracture">🚨 Cleidotomy (Clavicle Fracture)</option>
              <option value="zavanelli_or_emergency_csection">🚨 Zavanelli Maneuver & Stat C-Section</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maneuver Outcome</label>
              <select
                className="form-control"
                value={maneuverOutcome}
                onChange={(e: any) => setManeuverOutcome(e.target.value)}
              >
                <option value="successful_restitution_and_delivery">✅ Succeeded - Delivered</option>
                <option value="failed_advance_to_next_step">Failed - Proceed to Next Step</option>
                <option value="partial_rotation_incomplete">Partial Rotation Only</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Traction Applied</label>
              <select
                className="form-control"
                value={tractionApplied}
                onChange={(e: any) => setTractionApplied(e.target.value)}
              >
                <option value="gentle_axial_traction_only">Gentle Axial Traction Only (Safe)</option>
                <option value="none">No Traction Applied</option>
                <option value="excessive_lateral_traction_prevented">Excessive Lateral Traction Prevented</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Operator & Maneuver Notes</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operator name, maternal positioning, baby response..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Recording...' : 'Log Maneuver Step'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
