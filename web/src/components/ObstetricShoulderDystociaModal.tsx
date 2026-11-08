import React, { useState, useEffect } from 'react';
import { createObstetricShoulderDystociaEpisode, calculateObstetricShoulderDystocia } from '../api';

interface ObstetricShoulderDystociaModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricShoulderDystociaModal: React.FC<ObstetricShoulderDystociaModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [deliveryDatetime, setDeliveryDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [maternalAge, setMaternalAge] = useState<number | ''>(28);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(39.5);
  const [estimatedFetalWeightGrams, setEstimatedFetalWeightGrams] = useState<number | ''>(4000);
  const [actualBirthWeightGrams, setActualBirthWeightGrams] = useState(4150);
  const [gestationalDiabetes, setGestationalDiabetes] = useState(true);
  const [operativeVaginalDelivery, setOperativeVaginalDelivery] = useState<
    'spontaneous_vaginal' | 'vacuum_assisted' | 'forceps_assisted'
  >('spontaneous_vaginal');

  const [turtleSignObserved, setTurtleSignObserved] = useState(true);
  const [headDeliveryDatetime, setHeadDeliveryDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [bodyDeliveryDatetime, setBodyDeliveryDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [headToBodyIntervalSeconds, setHeadToBodyIntervalSeconds] = useState(150);

  const [helpCalled, setHelpCalled] = useState(true);
  const [episiotomyPerformed, setEpisiotomyPerformed] = useState(false);
  const [mcrobertsManeuverSuccess, setMcrobertsManeuverSuccess] = useState(false);
  const [suprapubicPressureSuccess, setSuprapubicPressureSuccess] = useState(true);
  const [internalRotationalManeuver, setInternalRotationalManeuver] = useState<
    'none' | 'rubin_ii' | 'woods_screw' | 'reverse_woods_screw'
  >('none');
  const [internalRotationalSuccess, setInternalRotationalSuccess] = useState(false);
  const [posteriorArmDeliverySuccess, setPosteriorArmDeliverySuccess] = useState(false);
  const [gaskinAllFoursSuccess, setGaskinAllFoursSuccess] = useState(false);
  const [advancedManeuversRequired, setAdvancedManeuversRequired] = useState<
    'none' | 'intentional_clavicle_fracture_cleidotomy' | 'zavanelli_cephalic_replacement' | 'symphysiotomy'
  >('none');
  const [fundalPressureAvoided, setFundalPressureAvoided] = useState(true);

  const [apgar1min, setApgar1min] = useState<number | ''>(5);
  const [apgar5min, setApgar5min] = useState<number | ''>(8);
  const [apgar10min, setApgar10min] = useState<number | ''>(9);
  const [umbilicalArterialPh, setUmbilicalArterialPh] = useState<number | ''>(7.18);
  const [neonatalInjury, setNeonatalInjury] = useState<
    'none' | 'brachial_plexus_erb_palsy' | 'brachial_plexus_klumpke' | 'clavicular_fracture' | 'humeral_fracture' | 'hypoxic_ischemic_encephalopathy'
  >('none');
  const [postpartumHemorrhageObserved, setPostpartumHemorrhageObserved] = useState(false);
  const [perinealTearDegree, setPerinealTearDegree] = useState<
    'none_or_first_degree' | 'second_degree' | 'third_degree_oasi' | 'fourth_degree_oasi'
  >('second_degree');

  const [status, setStatus] = useState<'resuscitation_active' | 'postpartum_hie_monitoring' | 'transferred_to_nicu' | 'discharged_stable'>('resuscitation_active');
  const [clinicalNotes, setClinicalNotes] = useState('Turtle sign noted immediately post head delivery. HELPERR invoked. McRoberts and Suprapubic pressure delivered infant in 150 seconds. No brachial plexus weakness.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateObstetricShoulderDystocia({
      maternalAge: maternalAge === '' ? undefined : Number(maternalAge),
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      estimatedFetalWeightGrams: estimatedFetalWeightGrams === '' ? undefined : Number(estimatedFetalWeightGrams),
      actualBirthWeightGrams: Number(actualBirthWeightGrams),
      gestationalDiabetes,
      operativeVaginalDelivery,
      turtleSignObserved,
      headToBodyIntervalSeconds: Number(headToBodyIntervalSeconds),
      helpCalled,
      episiotomyPerformed,
      mcrobertsManeuverSuccess,
      suprapubicPressureSuccess,
      internalRotationalManeuver,
      internalRotationalSuccess,
      posteriorArmDeliverySuccess,
      gaskinAllFoursSuccess,
      advancedManeuversRequired,
      fundalPressureAvoided,
      apgar1min: apgar1min === '' ? undefined : Number(apgar1min),
      apgar5min: apgar5min === '' ? undefined : Number(apgar5min),
      umbilicalArterialPh: umbilicalArterialPh === '' ? undefined : Number(umbilicalArterialPh),
      neonatalInjury,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    maternalAge,
    gestationalAgeWeeks,
    estimatedFetalWeightGrams,
    actualBirthWeightGrams,
    gestationalDiabetes,
    operativeVaginalDelivery,
    turtleSignObserved,
    headToBodyIntervalSeconds,
    helpCalled,
    episiotomyPerformed,
    mcrobertsManeuverSuccess,
    suprapubicPressureSuccess,
    internalRotationalManeuver,
    internalRotationalSuccess,
    posteriorArmDeliverySuccess,
    gaskinAllFoursSuccess,
    advancedManeuversRequired,
    fundalPressureAvoided,
    apgar1min,
    apgar5min,
    umbilicalArterialPh,
    neonatalInjury,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createObstetricShoulderDystociaEpisode({
        patientId,
        deliveryDatetime,
        maternalAge: maternalAge === '' ? null : Number(maternalAge),
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        estimatedFetalWeightGrams: estimatedFetalWeightGrams === '' ? null : Number(estimatedFetalWeightGrams),
        actualBirthWeightGrams: Number(actualBirthWeightGrams),
        gestationalDiabetes,
        operativeVaginalDelivery,
        turtleSignObserved,
        headDeliveryDatetime,
        bodyDeliveryDatetime,
        headToBodyIntervalSeconds: Number(headToBodyIntervalSeconds),
        helpCalled,
        episiotomyPerformed,
        mcrobertsManeuverSuccess,
        suprapubicPressureSuccess,
        internalRotationalManeuver,
        internalRotationalSuccess,
        posteriorArmDeliverySuccess,
        gaskinAllFoursSuccess,
        advancedManeuversRequired,
        fundalPressureAvoided,
        apgar1min: apgar1min === '' ? null : Number(apgar1min),
        apgar5min: apgar5min === '' ? null : Number(apgar5min),
        apgar10min: apgar10min === '' ? null : Number(apgar10min),
        umbilicalArterialPh: umbilicalArterialPh === '' ? null : Number(umbilicalArterialPh),
        neonatalInjury,
        postpartumHemorrhageObserved,
        perinealTearDegree,
        status,
        clinicalNotes,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record shoulder dystocia episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ maxWidth: 880, width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: '#b91c1c' }}>🚨 Obstetric Shoulder Dystocia & HELPERR Protocol</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Patient: <strong>{patientName}</strong> | Reference: RCOG Greentop No. 42 & ACOG PB 178
            </p>
          </div>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner error" style={{ margin: '12px 0' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          {/* Live Preview Synthesis Card */}
          {preview && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#b45309', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                  {preview.intervalSeverityLabel}
                </strong>
                <span className={`badge ${preview.fundalPressureViolation ? 'danger' : 'success'}`}>
                  {preview.fundalPressureViolation ? '⚠️ FUNDAL PRESSURE VIOLATION' : '✅ SAFE AXIAL TRACTION ONLY'}
                </span>
              </div>
              <p style={{ margin: '6px 0', fontSize: '0.9rem' }}>{preview.clinicalGuidance}</p>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.85rem', color: '#475569' }}>
                <div><strong>Resolved Via:</strong> {preview.successfulManeuver}</div>
                <div><strong>Hypoxia Risk:</strong> {preview.hypoxiaRiskLevel.toUpperCase()}</div>
                <div><strong>Fetal Size:</strong> {preview.macrosomiaPresent ? 'Macrosomic (≥4000g)' : 'Appropriate'}</div>
              </div>
            </div>
          )}

          {/* Delivery & Time Interval */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Delivery Datetime</label>
              <input
                type="datetime-local"
                className="form-control"
                value={deliveryDatetime}
                onChange={(e) => setDeliveryDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gestation (weeks)</label>
              <input
                type="number"
                step="0.1"
                min="24"
                max="45"
                className="form-control"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Actual Birth Weight (g)</label>
              <input
                type="number"
                min="1000"
                max="7000"
                className="form-control"
                value={actualBirthWeightGrams}
                onChange={(e) => setActualBirthWeightGrams(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Head-to-Body (Seconds)</label>
              <input
                type="number"
                min="10"
                max="1800"
                className="form-control"
                value={headToBodyIntervalSeconds}
                onChange={(e) => setHeadToBodyIntervalSeconds(Number(e.target.value))}
                required
              />
              <small className="muted">Threshold: &gt; 60 sec</small>
            </div>
          </div>

          {/* Risk Factors */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Turtle Sign Observed?</label>
              <select
                className="form-control"
                value={turtleSignObserved ? '1' : '0'}
                onChange={(e) => setTurtleSignObserved(e.target.value === '1')}
              >
                <option value="1">YES - Head retracted on perineum</option>
                <option value="0">NO</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gestational Diabetes?</label>
              <select
                className="form-control"
                value={gestationalDiabetes ? '1' : '0'}
                onChange={(e) => setGestationalDiabetes(e.target.value === '1')}
              >
                <option value="1">YES (Macrosomic disproportion risk)</option>
                <option value="0">NO</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Delivery Mode</label>
              <select
                className="form-control"
                value={operativeVaginalDelivery}
                onChange={(e: any) => setOperativeVaginalDelivery(e.target.value)}
              >
                <option value="spontaneous_vaginal">Spontaneous Vaginal</option>
                <option value="vacuum_assisted">Vacuum Assisted</option>
                <option value="forceps_assisted">Forceps Assisted</option>
              </select>
            </div>
          </div>

          {/* HELPERR Maneuvers Execution Grid */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16, background: '#f8fafc' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#0f172a' }}>HELPERR Emergency Sequence Checkpoints</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>H: Help Called?</label>
                <select
                  className="form-control"
                  value={helpCalled ? '1' : '0'}
                  onChange={(e) => setHelpCalled(e.target.value === '1')}
                >
                  <option value="1">YES - Stat Team Present</option>
                  <option value="0">NO</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>E: Episiotomy?</label>
                <select
                  className="form-control"
                  value={episiotomyPerformed ? '1' : '0'}
                  onChange={(e) => setEpisiotomyPerformed(e.target.value === '1')}
                >
                  <option value="1">YES (Space for internal hand)</option>
                  <option value="0">NO</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>L: McRoberts Success?</label>
                <select
                  className="form-control"
                  value={mcrobertsManeuverSuccess ? '1' : '0'}
                  onChange={(e) => setMcrobertsManeuverSuccess(e.target.value === '1')}
                >
                  <option value="1">YES - Delivered</option>
                  <option value="0">NO - Proceed to P</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>P: Suprapubic (Rubin I)?</label>
                <select
                  className="form-control"
                  value={suprapubicPressureSuccess ? '1' : '0'}
                  onChange={(e) => setSuprapubicPressureSuccess(e.target.value === '1')}
                >
                  <option value="1">YES - Delivered</option>
                  <option value="0">NO - Proceed to E</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>E: Internal Rotation</label>
                <select
                  className="form-control"
                  value={internalRotationalManeuver}
                  onChange={(e: any) => setInternalRotationalManeuver(e.target.value)}
                >
                  <option value="none">None Attempted</option>
                  <option value="rubin_ii">Rubin II (Push Anterior)</option>
                  <option value="woods_screw">Woods Screw (180° Rotate)</option>
                  <option value="reverse_woods_screw">Reverse Woods Screw</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>R: Posterior Arm?</label>
                <select
                  className="form-control"
                  value={posteriorArmDeliverySuccess ? '1' : '0'}
                  onChange={(e) => setPosteriorArmDeliverySuccess(e.target.value === '1')}
                >
                  <option value="1">YES - Delivered</option>
                  <option value="0">NO</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>R: Gaskin (All-Fours)?</label>
                <select
                  className="form-control"
                  value={gaskinAllFoursSuccess ? '1' : '0'}
                  onChange={(e) => setGaskinAllFoursSuccess(e.target.value === '1')}
                >
                  <option value="1">YES - Delivered</option>
                  <option value="0">NO</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fundal Pressure Avoided?</label>
                <select
                  className="form-control"
                  style={{ fontWeight: 'bold', color: fundalPressureAvoided ? '#16a34a' : '#dc2626' }}
                  value={fundalPressureAvoided ? '1' : '0'}
                  onChange={(e) => setFundalPressureAvoided(e.target.value === '1')}
                >
                  <option value="1">YES - Strictly Avoided</option>
                  <option value="0">NO - Applied (Violation)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Neonatal & Maternal Outcomes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Apgar (1m / 5m)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="form-control"
                  value={apgar1min}
                  onChange={(e) => setApgar1min(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="1m"
                />
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="form-control"
                  value={apgar5min}
                  onChange={(e) => setApgar5min(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="5m"
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cord Blood Arterial pH</label>
              <input
                type="number"
                step="0.01"
                min="6.5"
                max="7.6"
                className="form-control"
                value={umbilicalArterialPh}
                onChange={(e) => setUmbilicalArterialPh(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 7.18"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Neonatal Injury</label>
              <select
                className="form-control"
                value={neonatalInjury}
                onChange={(e: any) => setNeonatalInjury(e.target.value)}
              >
                <option value="none">None - Normal Moro</option>
                <option value="brachial_plexus_erb_palsy">Erb's Palsy (C5-C6)</option>
                <option value="brachial_plexus_klumpke">Klumpke's Palsy (C8-T1)</option>
                <option value="clavicular_fracture">Clavicular Fracture</option>
                <option value="humeral_fracture">Humeral Fracture</option>
                <option value="hypoxic_ischemic_encephalopathy">Hypoxic Ischemic Encephalopathy (HIE)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Perineal Tear</label>
              <select
                className="form-control"
                value={perinealTearDegree}
                onChange={(e: any) => setPerinealTearDegree(e.target.value)}
              >
                <option value="none_or_first_degree">1st Degree / None</option>
                <option value="second_degree">2nd Degree</option>
                <option value="third_degree_oasi">3rd Degree (OASI)</option>
                <option value="fourth_degree_oasi">4th Degree (Rectal Mucosa)</option>
              </select>
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
                <option value="resuscitation_active">Resuscitation & Active Assessment</option>
                <option value="postpartum_hie_monitoring">Postpartum HIE & Nursery Monitoring</option>
                <option value="transferred_to_nicu">Transferred to NICU (Therapeutic Hypothermia)</option>
                <option value="discharged_stable">Discharged Home Stable</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Debrief & Notes</label>
              <input
                type="text"
                className="form-control"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Team debrief, newborn physical findings..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Saving...' : '💾 Save Shoulder Dystocia Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
