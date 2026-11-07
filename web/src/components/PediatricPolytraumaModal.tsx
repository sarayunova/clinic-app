import React, { useState, useEffect } from 'react';
import {
  createPediatricPolytraumaEpisode,
  calculatePediatricPolytraumaPts,
  type PediatricPolytraumaRecord,
} from '../api';

interface PediatricPolytraumaModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: (ep: PediatricPolytraumaRecord) => void;
}

export const PediatricPolytraumaModal: React.FC<PediatricPolytraumaModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [traumaDatetime, setTraumaDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(48);
  const [weightKg, setWeightKg] = useState(16.5);
  const [traumaMechanism, setTraumaMechanism] = useState<'motor_vehicle_collision' | 'pedestrian_vs_auto' | 'fall_greater_than_2_meters' | 'bicycle_collision' | 'penetrating_trauma' | 'crush_injury' | 'non_accidental_trauma' | 'other'>('pedestrian_vs_auto');

  // PTS Parameters
  const [airwayStatus, setAirwayStatus] = useState<'normal' | 'maintainable' | 'unmaintainable_or_intubated'>('maintainable');
  const [systolicBp, setSystolicBp] = useState(82);
  const [cnsStatus, setCnsStatus] = useState<'awake' | 'obtunded_loc' | 'coma_decerebrate'>('obtunded_loc');
  const [skeletalInjury, setSkeletalInjury] = useState<'none' | 'closed_fracture' | 'open_or_multiple_fractures'>('closed_fracture');
  const [cutaneousInjury, setCutaneousInjury] = useState<'none' | 'contusion_abrasion' | 'tissue_loss_or_penetrating'>('contusion_abrasion');

  const [initialGcs, setInitialGcs] = useState(11);
  const [initialSbp, setInitialSbp] = useState(82);
  const [initialHeartRate, setInitialHeartRate] = useState(154);
  const [fastExamPositive, setFastExamPositive] = useState(false);
  const [pelvicBinderPlaced, setPelvicBinderPlaced] = useState(false);
  const [txaAdministered, setTxaAdministered] = useState(true);
  const [txaDoseMg, setTxaDoseMg] = useState<number | ''>(330);
  const [pediatricMtpActivated, setPediatricMtpActivated] = useState(false);
  const [prbcVolumeMl, setPrbcVolumeMl] = useState(0);
  const [ffpVolumeMl, setFfpVolumeMl] = useState(0);
  const [plateletsVolumeMl, setPlateletsVolumeMl] = useState(0);

  const [status, setStatus] = useState<'acute_trauma_bay' | 'emergent_or_surgery' | 'picu_damage_control' | 'stepdown_ward' | 'convalescent'>('acute_trauma_bay');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculatePediatricPolytraumaPts({
      weightKg,
      airwayStatus,
      systolicBp,
      cnsStatus,
      skeletalInjury,
      cutaneousInjury,
      initialGcs,
      fastExamPositive,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (txaAdministered && res.evalResult?.txaLoadingDoseMg) {
          setTxaDoseMg(res.evalResult.txaLoadingDoseMg);
        }
      })
      .catch(() => {});
  }, [
    weightKg,
    airwayStatus,
    systolicBp,
    cnsStatus,
    skeletalInjury,
    cutaneousInjury,
    initialGcs,
    fastExamPositive,
    txaAdministered,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await createPediatricPolytraumaEpisode({
        patientId,
        traumaDatetime,
        ageMonths,
        weightKg,
        traumaMechanism,
        airwayStatus,
        systolicBp,
        cnsStatus,
        skeletalInjury,
        cutaneousInjury,
        initialGcs,
        initialSbp,
        initialHeartRate,
        fastExamPositive,
        pelvicBinderPlaced,
        txaAdministered,
        txaDoseMg: txaAdministered ? (txaDoseMg === '' ? null : Number(txaDoseMg)) : null,
        pediatricMtpActivated,
        prbcVolumeMl,
        ffpVolumeMl,
        plateletsVolumeMl,
        status,
        clinicalNotes,
      });
      onSuccess(res.episode);
    } catch (err: any) {
      setError(err?.message || 'Failed to record pediatric polytrauma episode');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <h3>🚨 Pediatric Polytrauma Resuscitation & PTS Calculator</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <strong>Patient:</strong> {patientName} (ID: #{patientId})
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
              <div>
                <label>Trauma Datetime</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={traumaDatetime}
                  onChange={(e) => setTraumaDatetime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Age (months)</label>
                <input
                  type="number"
                  min="1"
                  max="216"
                  className="form-control"
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(parseInt(e.target.value) || 24)}
                  required
                />
              </div>

              <div>
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="2.5"
                  max="120"
                  className="form-control"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 10)}
                  required
                />
              </div>

              <div>
                <label>Trauma Mechanism</label>
                <select
                  className="form-control"
                  value={traumaMechanism}
                  onChange={(e) => setTraumaMechanism(e.target.value as any)}
                  required
                >
                  <option value="pedestrian_vs_auto">Pedestrian vs Auto</option>
                  <option value="motor_vehicle_collision">Motor Vehicle Collision</option>
                  <option value="fall_greater_than_2_meters">Fall &gt; 2 meters</option>
                  <option value="bicycle_collision">Bicycle Collision</option>
                  <option value="penetrating_trauma">Penetrating Trauma</option>
                  <option value="crush_injury">Crush Injury</option>
                  <option value="non_accidental_trauma">Non-Accidental Trauma</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* PTS 6-Component Grid */}
            <h5 style={{ fontSize: '0.95rem', marginBottom: 8, color: '#2c3e50' }}>
              Pediatric Trauma Score (PTS) Components
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#fdfdfe', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 14 }}>
              <div>
                <label>Airway Assessment</label>
                <select
                  className="form-control"
                  value={airwayStatus}
                  onChange={(e) => setAirwayStatus(e.target.value as any)}
                >
                  <option value="normal">Normal / Patent (+2)</option>
                  <option value="maintainable">Maintainable / Oral Airway (+1)</option>
                  <option value="unmaintainable_or_intubated">Unmaintainable / Intubated (-1)</option>
                </select>
              </div>

              <div>
                <label>Systolic BP (mmHg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={systolicBp}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 80;
                    setSystolicBp(val);
                    setInitialSbp(val);
                  }}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: '#666' }}>
                  &gt;90 (+2) | 50-90 (+1) | &lt;50 (-1)
                </span>
              </div>

              <div>
                <label>CNS / Mental Status</label>
                <select
                  className="form-control"
                  value={cnsStatus}
                  onChange={(e) => setCnsStatus(e.target.value as any)}
                >
                  <option value="awake">Awake / Alert (+2)</option>
                  <option value="obtunded_loc">Obtunded / Brief LOC (+1)</option>
                  <option value="coma_decerebrate">Coma / Decerebrate (-1)</option>
                </select>
              </div>

              <div>
                <label>Skeletal Trauma</label>
                <select
                  className="form-control"
                  value={skeletalInjury}
                  onChange={(e) => setSkeletalInjury(e.target.value as any)}
                >
                  <option value="none">None (+2)</option>
                  <option value="closed_fracture">Closed Fracture (+1)</option>
                  <option value="open_or_multiple_fractures">Open / Multiple Fractures (-1)</option>
                </select>
              </div>

              <div>
                <label>Cutaneous / Soft Tissue</label>
                <select
                  className="form-control"
                  value={cutaneousInjury}
                  onChange={(e) => setCutaneousInjury(e.target.value as any)}
                >
                  <option value="none">None (+2)</option>
                  <option value="contusion_abrasion">Contusion / Abrasion (+1)</option>
                  <option value="tissue_loss_or_penetrating">Tissue Loss / Penetrating (-1)</option>
                </select>
              </div>

              <div>
                <label>Initial GCS Total (3-15)</label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  className="form-control"
                  value={initialGcs}
                  onChange={(e) => setInitialGcs(parseInt(e.target.value) || 15)}
                  required
                />
              </div>
            </div>

            {/* PTS Score Preview Box */}
            {preview && (
              <div
                style={{
                  background: preview.totalPtsScore <= 8 ? '#fef2f2' : preview.totalPtsScore <= 10 ? '#fffbeb' : '#f0fdf4',
                  borderLeft: `4px solid ${preview.totalPtsScore <= 8 ? '#dc2626' : preview.totalPtsScore <= 10 ? '#f59e0b' : '#16a34a'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: '1.05rem', color: preview.totalPtsScore <= 8 ? '#b91c1c' : '#1e293b' }}>
                    Pediatric Trauma Score: {preview.totalPtsScore} (Range: -6 to +12) — {preview.tierLabel}
                  </strong>
                  {preview.traumaCenterLevel1Mandatory && (
                    <span className="badge badge-danger">LEVEL 1 TRAUMA MANDATORY</span>
                  )}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#333', marginBottom: 6 }}>
                  {preview.mortalityEstimate}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1d4ed8' }}>
                  <strong>Initial Resuscitation:</strong> Crystalloid Challenge {preview.initialCrystalloidBolusMl} mL (20 mL/kg) | TXA Load {preview.txaLoadingDoseMg} mg IV over 10 min.
                </div>
              </div>
            )}

            {/* Critical Resuscitation Flags */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={fastExamPositive} onChange={(e) => setFastExamPositive(e.target.checked)} />
                Positive eFAST (Free Fluid)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={pelvicBinderPlaced} onChange={(e) => setPelvicBinderPlaced(e.target.checked)} />
                Pelvic Binder Placed
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={txaAdministered} onChange={(e) => setTxaAdministered(e.target.checked)} />
                TXA Administered
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={pediatricMtpActivated} onChange={(e) => setPediatricMtpActivated(e.target.checked)} />
                Pediatric MTP Activated (1:1:1)
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <div>
                <label>Heart Rate (bpm)</label>
                <input
                  type="number"
                  className="form-control"
                  value={initialHeartRate}
                  onChange={(e) => setInitialHeartRate(parseInt(e.target.value) || 120)}
                  required
                />
              </div>

              <div>
                <label>Status / Disposition</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="acute_trauma_bay">Acute Trauma Bay</option>
                  <option value="emergent_or_surgery">Emergent OR Surgery</option>
                  <option value="picu_damage_control">PICU Damage Control</option>
                  <option value="stepdown_ward">Stepdown Ward</option>
                  <option value="convalescent">Convalescent</option>
                </select>
              </div>

              <div>
                <label>TXA Dose (mg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={txaDoseMg}
                  onChange={(e) => setTxaDoseMg(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  disabled={!txaAdministered}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Trauma Bay Team Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Airway intubation details, log-roll spinal clearance, massive transfusion activations..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Record Trauma Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
