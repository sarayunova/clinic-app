import React, { useState, useEffect } from 'react';
import {
  createObstetricAflpEpisode,
  evaluateObstetricAflp,
  type ObstetricAflpRecord,
} from '../api';

interface ObstetricAflpModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: (ep: ObstetricAflpRecord) => void;
}

export const ObstetricAflpModal: React.FC<ObstetricAflpModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [gestationWeeks, setGestationWeeks] = useState(35.5);
  const [diagnosisDatetime, setDiagnosisDatetime] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [vomitingPresent, setVomitingPresent] = useState(true);
  const [abdominalPainPresent, setAbdominalPainPresent] = useState(true);
  const [polydipsiaPolyuriaPresent, setPolydipsiaPolyuriaPresent] = useState(true);
  const [encephalopathyPresent, setEncephalopathyPresent] = useState(false);
  const [elevatedBilirubin, setElevatedBilirubin] = useState(true);
  const [hypoglycemiaPresent, setHypoglycemiaPresent] = useState(true);
  const [elevatedUrate, setElevatedUrate] = useState(true);
  const [leukocytosisPresent, setLeukocytosisPresent] = useState(true);
  const [ascitesOrBrightLiver, setAscitesOrBrightLiver] = useState(false);
  const [elevatedTransaminases, setElevatedTransaminases] = useState(true);
  const [elevatedAmmonia, setElevatedAmmonia] = useState(false);
  const [renalImpairment, setRenalImpairment] = useState(false);
  const [coagulopathyPresent, setCoagulopathyPresent] = useState(true);
  const [microvesicularSteatosisBiopsy, setMicrovesicularSteatosisBiopsy] = useState(false);

  // Numeric lab values
  const [serumGlucoseMgDl, setSerumGlucoseMgDl] = useState<number | ''>(58);
  const [serumBilirubinTotalMgDl, setSerumBilirubinTotalMgDl] = useState<number | ''>(2.4);
  const [astUL, setAstUL] = useState<number | ''>(280);
  const [altUL, setAltUL] = useState<number | ''>(320);
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<number | ''>(1.3);
  const [ptSeconds, setPtSeconds] = useState<number | ''>(16.5);
  const [inr, setInr] = useState<number | ''>(1.45);

  const [dextroseInfusionActive, setDextroseInfusionActive] = useState(true);
  const [deliveryUrgency, setDeliveryUrgency] = useState<'immediate_emergent_delivery' | 'urgent_stabilize_then_deliver' | 'delivered_postpartum_management'>('immediate_emergent_delivery');
  const [deliveryPerformed, setDeliveryPerformed] = useState(false);
  const [deliveryDatetime, setDeliveryDatetime] = useState('');
  const [status, setStatus] = useState<'evaluating' | 'active_critical_resuscitation' | 'postpartum_icu_monitoring' | 'hepatic_recovery' | 'resolved'>('active_critical_resuscitation');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    evaluateObstetricAflp({
      vomitingPresent,
      abdominalPainPresent,
      polydipsiaPolyuriaPresent,
      encephalopathyPresent,
      elevatedBilirubin,
      hypoglycemiaPresent,
      elevatedUrate,
      leukocytosisPresent,
      ascitesOrBrightLiver,
      elevatedTransaminases,
      elevatedAmmonia,
      renalImpairment,
      coagulopathyPresent,
      microvesicularSteatosisBiopsy,
      serumGlucoseMgDl: serumGlucoseMgDl === '' ? undefined : Number(serumGlucoseMgDl),
      serumBilirubinTotalMgDl: serumBilirubinTotalMgDl === '' ? undefined : Number(serumBilirubinTotalMgDl),
      astUL: astUL === '' ? undefined : Number(astUL),
      altUL: altUL === '' ? undefined : Number(altUL),
      serumCreatinineMgDl: serumCreatinineMgDl === '' ? undefined : Number(serumCreatinineMgDl),
      ptSeconds: ptSeconds === '' ? undefined : Number(ptSeconds),
      inr: inr === '' ? undefined : Number(inr),
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    vomitingPresent,
    abdominalPainPresent,
    polydipsiaPolyuriaPresent,
    encephalopathyPresent,
    elevatedBilirubin,
    hypoglycemiaPresent,
    elevatedUrate,
    leukocytosisPresent,
    ascitesOrBrightLiver,
    elevatedTransaminases,
    elevatedAmmonia,
    renalImpairment,
    coagulopathyPresent,
    microvesicularSteatosisBiopsy,
    serumGlucoseMgDl,
    serumBilirubinTotalMgDl,
    astUL,
    altUL,
    serumCreatinineMgDl,
    ptSeconds,
    inr,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await createObstetricAflpEpisode({
        patientId,
        diagnosisDatetime,
        gestationWeeks,
        vomitingPresent,
        abdominalPainPresent,
        polydipsiaPolyuriaPresent,
        encephalopathyPresent,
        elevatedBilirubin,
        hypoglycemiaPresent,
        elevatedUrate,
        leukocytosisPresent,
        ascitesOrBrightLiver,
        elevatedTransaminases,
        elevatedAmmonia,
        renalImpairment,
        coagulopathyPresent,
        microvesicularSteatosisBiopsy,
        serumGlucoseMgDl: serumGlucoseMgDl === '' ? null : Number(serumGlucoseMgDl),
        serumBilirubinTotalMgDl: serumBilirubinTotalMgDl === '' ? null : Number(serumBilirubinTotalMgDl),
        astUL: astUL === '' ? null : Number(astUL),
        altUL: altUL === '' ? null : Number(altUL),
        serumCreatinineMgDl: serumCreatinineMgDl === '' ? null : Number(serumCreatinineMgDl),
        ptSeconds: ptSeconds === '' ? null : Number(ptSeconds),
        inr: inr === '' ? null : Number(inr),
        dextroseInfusionActive,
        deliveryUrgency,
        deliveryPerformed,
        deliveryDatetime: deliveryPerformed ? deliveryDatetime : null,
        lchadNewbornScreeningAlert: true,
        status,
        clinicalNotes,
      });
      onSuccess(res.episode);
    } catch (err: any) {
      setError(err?.message || 'Failed to record AFLP evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <h3>🩺 Acute Fatty Liver of Pregnancy (AFLP) & Swansea Staging</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <strong>Patient:</strong> {patientName} (ID: #{patientId}) | Gestational Age: {gestationWeeks} weeks
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label>Gestational Age (weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="44"
                  className="form-control"
                  value={gestationWeeks}
                  onChange={(e) => setGestationWeeks(parseFloat(e.target.value) || 36)}
                  required
                />
              </div>

              <div>
                <label>Diagnosis / Evaluation Datetime</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={diagnosisDatetime}
                  onChange={(e) => setDiagnosisDatetime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Swansea 14-Criteria Grid */}
            <h5 style={{ fontSize: '0.95rem', marginBottom: 8, color: '#2c3e50' }}>
              Swansea Criteria Checklist (Diagnostic Threshold: &ge; 6 of 14)
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, background: '#fdfdfe', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={vomitingPresent} onChange={(e) => setVomitingPresent(e.target.checked)} />
                1. Vomiting
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={abdominalPainPresent} onChange={(e) => setAbdominalPainPresent(e.target.checked)} />
                2. Abdominal pain (epigastric/RUQ)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={polydipsiaPolyuriaPresent} onChange={(e) => setPolydipsiaPolyuriaPresent(e.target.checked)} />
                3. Polydipsia / Polyuria
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={encephalopathyPresent} onChange={(e) => setEncephalopathyPresent(e.target.checked)} />
                4. Encephalopathy / Asterixis
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={elevatedBilirubin} onChange={(e) => setElevatedBilirubin(e.target.checked)} />
                5. Elevated Bilirubin (&gt; 0.8 mg/dL)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={hypoglycemiaPresent} onChange={(e) => setHypoglycemiaPresent(e.target.checked)} />
                6. Hypoglycemia (&lt; 72 mg/dL or &lt; 4.0 mmol/L)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={elevatedUrate} onChange={(e) => setElevatedUrate(e.target.checked)} />
                7. Elevated Urate (&gt; 5.7 mg/dL or &gt; 340 &mu;mol/L)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={leukocytosisPresent} onChange={(e) => setLeukocytosisPresent(e.target.checked)} />
                8. Leukocytosis (&gt; 11,000 / &mu;L)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={ascitesOrBrightLiver} onChange={(e) => setAscitesOrBrightLiver(e.target.checked)} />
                9. Ascites or Bright Liver on US
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={elevatedTransaminases} onChange={(e) => setElevatedTransaminases(e.target.checked)} />
                10. Elevated Transaminases (AST or ALT &gt; 42 U/L)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={elevatedAmmonia} onChange={(e) => setElevatedAmmonia(e.target.checked)} />
                11. Elevated Ammonia (&gt; 47 &mu;mol/L)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={renalImpairment} onChange={(e) => setRenalImpairment(e.target.checked)} />
                12. Renal Impairment (Creatinine &gt; 1.7 mg/dL)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={coagulopathyPresent} onChange={(e) => setCoagulopathyPresent(e.target.checked)} />
                13. Coagulopathy (PT &gt; 14s or INR &gt; 1.2)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={microvesicularSteatosisBiopsy} onChange={(e) => setMicrovesicularSteatosisBiopsy(e.target.checked)} />
                14. Microvesicular Steatosis on Biopsy
              </label>
            </div>

            {/* Numeric Measurements */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              <div>
                <label>Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={serumGlucoseMgDl}
                  onChange={(e) => setSerumGlucoseMgDl(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label>Total Bilirubin (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={serumBilirubinTotalMgDl}
                  onChange={(e) => setSerumBilirubinTotalMgDl(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label>AST (U/L)</label>
                <input
                  type="number"
                  className="form-control"
                  value={astUL}
                  onChange={(e) => setAstUL(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label>INR</label>
                <input
                  type="number"
                  step="0.05"
                  className="form-control"
                  value={inr}
                  onChange={(e) => setInr(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
            </div>

            {preview && (
              <div
                style={{
                  background: preview.aflpConfirmed ? '#fef2f2' : '#f0fdf4',
                  borderLeft: `4px solid ${preview.aflpConfirmed ? '#dc2626' : '#16a34a'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: '1.05rem', color: preview.aflpConfirmed ? '#b91c1c' : '#15803d' }}>
                    Swansea Criteria: {preview.totalCriteriaMet} of 14 Met — {preview.aflpConfirmed ? 'AFLP CONFIRMED' : 'AFLP UNLIKELY'}
                  </strong>
                  <span className={`badge ${preview.aflpConfirmed ? 'badge-danger' : 'badge-success'}`}>
                    {preview.clinicalSeverity.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#333', marginBottom: 6 }}>
                  {preview.deliveryRecommendation}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                  <strong>{preview.lchadScreeningAlert}</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label>D10W Infusion Active</label>
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={dextroseInfusionActive}
                      onChange={(e) => setDextroseInfusionActive(e.target.checked)}
                    />
                    Continuous Dextrose IV
                  </label>
                </div>
              </div>

              <div>
                <label>Delivery Urgency</label>
                <select
                  className="form-control"
                  value={deliveryUrgency}
                  onChange={(e) => setDeliveryUrgency(e.target.value as any)}
                >
                  <option value="immediate_emergent_delivery">Immediate Emergent Delivery</option>
                  <option value="urgent_stabilize_then_deliver">Urgent (Stabilize Then Deliver)</option>
                  <option value="delivered_postpartum_management">Delivered (Postpartum ICU)</option>
                </select>
              </div>

              <div>
                <label>Clinical Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="evaluating">Evaluating</option>
                  <option value="active_critical_resuscitation">Active Critical Resuscitation</option>
                  <option value="postpartum_icu_monitoring">Postpartum ICU Monitoring</option>
                  <option value="hepatic_recovery">Hepatic Recovery</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Clinical Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="MDT notes: obstetrician, hepatology, ICU, blood bank crossmatch..."
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
              {submitting ? 'Saving...' : 'Save AFLP Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
