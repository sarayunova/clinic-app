import React, { useState, useEffect } from 'react';
import { createObstetricPpromEpisode, calculateObstetricPprom } from '../api';

interface ObstetricPpromModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricPpromModal: React.FC<ObstetricPpromModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [ruptureDatetime, setRuptureDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [presentationDatetime, setPresentationDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationWeeks, setGestationWeeks] = useState(30.5);

  const [ruptureConfirmationMethod, setRuptureConfirmationMethod] = useState<string>('pooling_ferning_nitrazine');
  const [amnioticFluidIndexCm, setAmnioticFluidIndexCm] = useState<number | ''>(4.5);
  const [singleDeepestPocketCm, setSingleDeepestPocketCm] = useState<number | ''>(1.8);

  // Latency & Steroids
  const [latencyAntibioticsInitiated, setLatencyAntibioticsInitiated] = useState(true);
  const [latencyAntibioticRegimen, setLatencyAntibioticRegimen] = useState<string>('ampicillin_erythromycin_standard');
  const [antenatalCorticosteroidStatus, setAntenatalCorticosteroidStatus] = useState<string>('course_initiated');
  const [mgso4NeuroprotectionActive, setMgso4NeuroprotectionActive] = useState(true);
  const [gbsScreeningStatus, setGbsScreeningStatus] = useState<string>('unknown');

  // Triple I markers
  const [maternalTemperatureCelsius, setMaternalTemperatureCelsius] = useState(37.2);
  const [maternalHeartRateBpm, setMaternalHeartRateBpm] = useState(84);
  const [fetalHeartRateBpm, setFetalHeartRateBpm] = useState(144);
  const [uterineTenderness, setUterineTenderness] = useState(false);
  const [foulCervicalDischarge, setFoulCervicalDischarge] = useState(false);
  const [maternalWbcPerUl, setMaternalWbcPerUl] = useState<number | ''>(11500);
  const [amniocentesisPositive, setAmniocentesisPositive] = useState(false);

  const [status, setStatus] = useState('inpatient_latency_surveillance');
  const [clinicalNotes, setClinicalNotes] = useState('PPROM confirmed via speculum pooling and ferning at 30+3w. Commenced 7-day latency antibiotic regimen, Betamethasone, and MgSO4 neuroprotection.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateObstetricPprom({
      gestationWeeks,
      ruptureConfirmationMethod,
      amnioticFluidIndexCm: amnioticFluidIndexCm === '' ? undefined : Number(amnioticFluidIndexCm),
      singleDeepestPocketCm: singleDeepestPocketCm === '' ? undefined : Number(singleDeepestPocketCm),
      maternalTemperatureCelsius,
      maternalHeartRateBpm,
      fetalHeartRateBpm,
      uterineTenderness,
      foulCervicalDischarge,
      maternalWbcPerUl: maternalWbcPerUl === '' ? undefined : Number(maternalWbcPerUl),
      amniocentesisPositive,
      gbsScreeningStatus,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult.recommendedLatencyRegimen) {
          setLatencyAntibioticRegimen(res.evalResult.recommendedLatencyRegimen);
        }
      })
      .catch(() => {});
  }, [
    gestationWeeks,
    ruptureConfirmationMethod,
    amnioticFluidIndexCm,
    singleDeepestPocketCm,
    maternalTemperatureCelsius,
    maternalHeartRateBpm,
    fetalHeartRateBpm,
    uterineTenderness,
    foulCervicalDischarge,
    maternalWbcPerUl,
    amniocentesisPositive,
    gbsScreeningStatus,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createObstetricPpromEpisode({
        patientId,
        ruptureDatetime,
        presentationDatetime,
        gestationWeeks: Number(gestationWeeks),
        ruptureConfirmationMethod,
        amnioticFluidIndexCm: amnioticFluidIndexCm === '' ? null : Number(amnioticFluidIndexCm),
        singleDeepestPocketCm: singleDeepestPocketCm === '' ? null : Number(singleDeepestPocketCm),
        latencyAntibioticsInitiated,
        latencyAntibioticRegimen,
        antenatalCorticosteroidStatus,
        mgso4NeuroprotectionActive,
        gbsScreeningStatus,
        maternalTemperatureCelsius: Number(maternalTemperatureCelsius),
        maternalHeartRateBpm: Number(maternalHeartRateBpm),
        fetalHeartRateBpm: Number(fetalHeartRateBpm),
        uterineTenderness,
        foulCervicalDischarge,
        maternalWbcPerUl: maternalWbcPerUl === '' ? null : Number(maternalWbcPerUl),
        amniocentesisPositive,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record obstetric PPROM episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 880, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#991b1b' }}>🩺 Obstetric PPROM & Triple I Chorioamnionitis Protocol</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              ACOG Practice Bulletin 217 Latency Regimens, Infection Staging & Delivery Timing for {patientName}
            </span>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Presentation & Rupture Confirmation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rupture Date/Time</label>
              <input type="datetime-local" className="form-control" value={ruptureDatetime} onChange={(e) => setRuptureDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Presentation Date/Time</label>
              <input type="datetime-local" className="form-control" value={presentationDatetime} onChange={(e) => setPresentationDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gestation (weeks)</label>
              <input type="number" step="0.1" className="form-control" value={gestationWeeks} onChange={(e) => setGestationWeeks(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Confirmation Method</label>
              <select className="form-control" value={ruptureConfirmationMethod} onChange={(e) => setRuptureConfirmationMethod(e.target.value)}>
                <option value="pooling_ferning_nitrazine">Pooling, Ferning & Nitrazine</option>
                <option value="biochemical_amnisure_actim_prom">Biochemical (AmniSure / Actim PROM)</option>
                <option value="direct_visualization">Direct Fluid from Os</option>
                <option value="ultrasound_oligohydramnios">Ultrasound Oligohydramnios</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Amniotic Fluid Index (AFI cm)</label>
              <input type="number" step="0.1" className="form-control" placeholder="Normal: 5-25 cm" value={amnioticFluidIndexCm} onChange={(e) => setAmnioticFluidIndexCm(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Single Deepest Pocket (cm)</label>
              <input type="number" step="0.1" className="form-control" placeholder="Oligohydramnios: < 2 cm" value={singleDeepestPocketCm} onChange={(e) => setSingleDeepestPocketCm(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>GBS Screening Status</label>
              <select className="form-control" value={gbsScreeningStatus} onChange={(e) => setGbsScreeningStatus(e.target.value)}>
                <option value="unknown">Unknown</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
              </select>
            </div>
          </div>

          {/* Section 2: Triple I / Chorioamnionitis Markers */}
          <div style={{ background: '#fef2f2', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #fecaca' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#991b1b', fontSize: '0.9rem' }}>Triple I (Intra-Amniotic Infection) Surveillance Panel</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maternal Temp (°C)</label>
                <input type="number" step="0.1" className="form-control" value={maternalTemperatureCelsius} onChange={(e) => setMaternalTemperatureCelsius(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maternal HR (bpm)</label>
                <input type="number" className="form-control" value={maternalHeartRateBpm} onChange={(e) => setMaternalHeartRateBpm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fetal HR (bpm)</label>
                <input type="number" className="form-control" value={fetalHeartRateBpm} onChange={(e) => setFetalHeartRateBpm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maternal WBC (/uL)</label>
                <input type="number" className="form-control" placeholder="Normal: < 15,000" value={maternalWbcPerUl} onChange={(e) => setMaternalWbcPerUl(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={uterineTenderness} onChange={(e) => setUterineTenderness(e.target.checked)} />
                  <strong>Uterine Fundal Tenderness</strong>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={foulCervicalDischarge} onChange={(e) => setFoulCervicalDischarge(e.target.checked)} />
                  <strong>Purulent / Foul Amniotic Discharge</strong>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={amniocentesisPositive} onChange={(e) => setAmniocentesisPositive(e.target.checked)} />
                  <strong>Amniocentesis Confirmed Triple I</strong>
                </label>
              </div>
            </div>
          </div>

          {/* Real-time Calculation Preview Card */}
          {preview && (
            <div style={{ background: preview.immediateDeliveryIndicated ? '#fef2f2' : '#f0fdf4', border: `1px solid ${preview.immediateDeliveryIndicated ? '#f87171' : '#86efac'}`, padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.immediateDeliveryIndicated ? '#b91c1c' : '#15803d' }}>
                  {preview.summary}
                </strong>
                <span className={`badge ${preview.immediateDeliveryIndicated ? 'badge-danger' : 'badge-success'}`}>
                  {preview.immediateDeliveryIndicated ? 'IMMEDIATE DELIVERY' : 'LATENCY SURVEILLANCE'}
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#334155' }}>
                <p style={{ margin: '0 0 4px 0' }}><strong>Plan:</strong> {preview.deliveryTimingGuidance}</p>
                <p style={{ margin: '0 0 4px 0' }}><strong>Latency Antibiotics:</strong> {preview.latencyRegimenProtocol}</p>
                <p style={{ margin: 0 }}><strong>Neuroprotection & Steroids:</strong> {preview.antenatalCorticosteroidGuidance} {preview.mgso4Guidance}</p>
              </div>
            </div>
          )}

          {/* Section 3: Latency & Neuroprotection Regimens */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Latency Antibiotic Regimen</label>
              <select className="form-control" value={latencyAntibioticRegimen} onChange={(e) => setLatencyAntibioticRegimen(e.target.value)}>
                <option value="ampicillin_erythromycin_standard">Standard (Ampicillin + Erythro/Azithro)</option>
                <option value="ampicillin_azithromycin_alternative">Ampicillin + Oral Azithromycin</option>
                <option value="penicillin_allergic_cefazolin_erythro">Penicillin Allergic (Cefazolin + Erythro)</option>
                <option value="vancomycin_gentamicin_severe_allergy">Severe Anaphylaxis (Vancomycin + Gentamicin)</option>
                <option value="none_not_indicated">None (Not Indicated / Delivery)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Antenatal Corticosteroids</label>
              <select className="form-control" value={antenatalCorticosteroidStatus} onChange={(e) => setAntenatalCorticosteroidStatus(e.target.value)}>
                <option value="course_initiated">Course Initiated (Dose 1 Given)</option>
                <option value="course_completed">Course Completed (Both Doses)</option>
                <option value="rescue_course_given">Rescue Course Administered</option>
                <option value="not_indicated_ge_34w">Not Indicated (&gt;= 34w)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Episode Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="inpatient_latency_surveillance">Inpatient Latency Surveillance</option>
                <option value="active_triple_i_sepsis_resuscitation">Active Triple I Sepsis Resuscitation</option>
                <option value="labor_induction_delivery">Labor Induction / Delivery</option>
                <option value="postpartum_resolved">Postpartum Resolved</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={latencyAntibioticsInitiated} onChange={(e) => setLatencyAntibioticsInitiated(e.target.checked)} />
                <strong>Latency Antibiotics Actively Infusing</strong>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={mgso4NeuroprotectionActive} onChange={(e) => setMgso4NeuroprotectionActive(e.target.checked)} />
                <strong>MgSO4 Fetal Neuroprotection Active (&lt; 32w)</strong>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes & Management Plan</label>
            <textarea className="form-control" rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Record Obstetric PPROM Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
