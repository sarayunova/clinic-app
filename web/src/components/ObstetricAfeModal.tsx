import React, { useState, useEffect } from 'react';
import { calculateObstetricAfe, createObstetricAfeEpisode } from '../api';

interface Props {
  patientId: number;
  gestationWeeks?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricAfeModal: React.FC<Props> = ({
  patientId,
  gestationWeeks = 39.0,
  onClose,
  onSaved,
}) => {
  const [gestWeeks, setGestWeeks] = useState(gestationWeeks);
  const [arrestDatetime, setArrestDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [timingRelation, setTimingRelation] = useState<'during_labor' | 'cesarean_delivery' | 'postpartum_under_30min' | 'post_dilatation_evacuation' | 'other'>('during_labor');

  // Clark 4 Criteria
  const [collapse, setCollapse] = useState(true);
  const [overtDic, setOvertDic] = useState(true);
  const [absenceOfFever, setAbsenceOfFever] = useState(true);

  // A-OK Resuscitation Drugs
  const [atropine, setAtropine] = useState(true);
  const [ondansetron, setOndansetron] = useState(true);
  const [ketorolac, setKetorolac] = useState(true);

  // Coagulopathy & MTP
  const [fibrinogen, setFibrinogen] = useState<number | ''>(120);
  const [platelets, setPlatelets] = useState<number | ''>(68000);
  const [ptInr, setPtInr] = useState<number | ''>(2.4);
  const [mtpActivated, setMtpActivated] = useState(true);
  const [prbcUnits, setPrbcUnits] = useState(6);
  const [ffpUnits, setFfpUnits] = useState(6);
  const [plateletUnits, setPlateletUnits] = useState(2);
  const [cryoUnits, setCryoUnits] = useState(10);

  // PMCD & ECMO
  const [pmcdPerformed, setPmcdPerformed] = useState(false);
  const [pmcdMinutes, setPmcdMinutes] = useState<number | ''>(4);
  const [ecmoInitiated, setEcmoInitiated] = useState(false);

  const [status, setStatus] = useState('acute_resuscitation');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    void calculateObstetricAfe({
      gestationWeeks: gestWeeks,
      timingRelation,
      cardiorespiratoryCollapse: collapse,
      overtDicPresent: overtDic,
      absenceOfFever,
      fibrinogenMgDl: fibrinogen === '' ? undefined : Number(fibrinogen),
      plateletCount: platelets === '' ? undefined : Number(platelets),
      ptInr: ptInr === '' ? undefined : Number(ptInr),
      atropineGiven: atropine,
      ondansetronGiven: ondansetron,
      ketorolacGiven: ketorolac,
    }).then((res) => setPreview(res.evalResult));
  }, [
    gestWeeks,
    timingRelation,
    collapse,
    overtDic,
    absenceOfFever,
    fibrinogen,
    platelets,
    ptInr,
    atropine,
    ondansetron,
    ketorolac,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createObstetricAfeEpisode({
        patientId,
        arrestOnsetDatetime: arrestDatetime,
        gestationWeeks: Number(gestWeeks),
        timingRelation,
        cardiorespiratoryCollapse: collapse,
        overtDicPresent: overtDic,
        absenceOfFever,
        atropineGiven: atropine,
        ondansetronGiven: ondansetron,
        ketorolacGiven: ketorolac,
        fibrinogenMgDl: fibrinogen === '' ? undefined : Number(fibrinogen),
        plateletCount: platelets === '' ? undefined : Number(platelets),
        ptInr: ptInr === '' ? undefined : Number(ptInr),
        mtpActivated,
        prbcTransfusedUnits: Number(prbcUnits),
        ffpTransfusedUnits: Number(ffpUnits),
        plateletsTransfusedUnits: Number(plateletUnits),
        cryoprecipitateUnits: Number(cryoUnits),
        pmcdPerformed,
        pmcdDecisionToDeliveryMinutes: pmcdMinutes === '' ? undefined : Number(pmcdMinutes),
        ecmoInitiated,
        status,
        clinicalNotes: notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record AFE resuscitation episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>🚨 Obstetric Amniotic Fluid Embolism (AFE) & A-OK Protocol</h2>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          {preview && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor: preview.clarkCriteriaMet ? '#fee2e2' : '#fef3c7',
                borderLeft: `5px solid ${preview.clarkCriteriaMet ? '#dc2626' : '#d97706'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 16 }}>
                  {preview.clarkCriteriaMet ? '🚨 Clark 4-Criteria Confirmed AFE' : `⚠️ Criteria Met: ${preview.criteriaMetCount} of 4`}
                </strong>
                <span className="badge" style={{ fontSize: 13, fontWeight: 'bold' }}>
                  A-OK Regimen: {preview.aokRegimenComplete ? '✓ Complete' : 'Incomplete'}
                </span>
              </div>
              {preview.missingCriteria.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <strong>Missing diagnostic criteria:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {preview.missingCriteria.map((m: string, i: number) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.cryoprecipitateIndicated && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
                  ⚠️ Severe Hypofibrinogenemia: Transfuse 10 units Cryoprecipitate stat (Target Fibrinogen $\ge 200$ mg/dL).
                </p>
              )}
            </div>
          )}

          <fieldset className="card">
            <legend>Clark Diagnostic Criteria (SMFM / SOAP Case Definition)</legend>
            <div className="grid2">
              <div>
                <label>Gestation Weeks</label>
                <input
                  type="number"
                  step="0.1"
                  min="16"
                  max="43"
                  value={gestWeeks}
                  onChange={(e) => setGestWeeks(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Arrest / Collapse Datetime</label>
                <input
                  type="datetime-local"
                  value={arrestDatetime}
                  onChange={(e) => setArrestDatetime(e.target.value)}
                  required
                />
              </div>
              <div className="span2">
                <label>Timing Relation to Labor & Delivery</label>
                <select value={timingRelation} onChange={(e) => setTimingRelation(e.target.value as any)}>
                  <option value="during_labor">During Active Labor (Fetus In Utero)</option>
                  <option value="cesarean_delivery">During Cesarean Delivery</option>
                  <option value="postpartum_under_30min">Immediate Postpartum (within 30 minutes of delivery)</option>
                  <option value="post_dilatation_evacuation">Post Dilatation & Evacuation / Curettage</option>
                  <option value="other">Other / Atypical Timing</option>
                </select>
              </div>
              <div className="span2" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={collapse}
                    onChange={(e) => setCollapse(e.target.checked)}
                  />
                  <span>1. Sudden cardiorespiratory arrest or profound hypotension (SBP &lt; 90) + hypoxia</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={overtDic}
                    onChange={(e) => setOvertDic(e.target.checked)}
                  />
                  <span>2. Overt consumptive DIC or severe coagulopathic hemorrhage</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={absenceOfFever}
                    onChange={(e) => setAbsenceOfFever(e.target.checked)}
                  />
                  <span>3. Absence of clinical fever (temp &ge; 38°C prior to arrest) — rules out septic shock</span>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="card" style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
            <legend style={{ color: '#b45309', fontWeight: 'bold' }}>💊 "A-OK" Pharmacologic Resuscitation Protocol</legend>
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Administer immediately upon suspicion of acute AFE to halt vagal collapse, serotonin vasoconstriction, and pulmonary microthrombi.
            </p>
            <div className="grid2">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={atropine}
                  onChange={(e) => setAtropine(e.target.checked)}
                />
                <div>
                  <strong>Atropine 1.0 mg IV push</strong>
                  <div className="muted small">Vagolytic: treats pulmonary vasospasm & severe bradycardia</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={ondansetron}
                  onChange={(e) => setOndansetron(e.target.checked)}
                />
                <div>
                  <strong>Ondansetron 8.0 mg IV push</strong>
                  <div className="muted small">5-HT3 blocker: stops serotonin-mediated pulmonary hypertension</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={ketorolac}
                  onChange={(e) => setKetorolac(e.target.checked)}
                />
                <div>
                  <strong>Ketorolac 30.0 mg IV push</strong>
                  <div className="muted small">Thromboxane inhibitor: blocks microvascular clot propagation</div>
                </div>
              </label>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Coagulopathy & Massive Transfusion Protocol (MTP)</legend>
            <div className="grid2">
              <div>
                <label>Fibrinogen (mg/dL)</label>
                <input
                  type="number"
                  placeholder="Target >= 200 mg/dL"
                  value={fibrinogen}
                  onChange={(e) => setFibrinogen(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Platelet Count (/uL)</label>
                <input
                  type="number"
                  placeholder="Target >= 50,000"
                  value={platelets}
                  onChange={(e) => setPlatelets(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>PT / INR</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 2.4"
                  value={ptInr}
                  onChange={(e) => setPtInr(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                  <input
                    type="checkbox"
                    checked={mtpActivated}
                    onChange={(e) => setMtpActivated(e.target.checked)}
                  />
                  <strong>MTP 1:1:1 Protocol Activated</strong>
                </label>
              </div>
              <div>
                <label>PRBC Transfused (units)</label>
                <input
                  type="number"
                  min="0"
                  value={prbcUnits}
                  onChange={(e) => setPrbcUnits(Number(e.target.value))}
                />
              </div>
              <div>
                <label>FFP Transfused (units)</label>
                <input
                  type="number"
                  min="0"
                  value={ffpUnits}
                  onChange={(e) => setFfpUnits(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Platelets Transfused (units)</label>
                <input
                  type="number"
                  min="0"
                  value={plateletUnits}
                  onChange={(e) => setPlateletUnits(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Cryoprecipitate Transfused (units)</label>
                <input
                  type="number"
                  min="0"
                  value={cryoUnits}
                  onChange={(e) => setCryoUnits(Number(e.target.value))}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Surgical & Advanced Critical Care (PMCD & ECMO)</legend>
            <div className="grid2">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={pmcdPerformed}
                  onChange={(e) => setPmcdPerformed(e.target.checked)}
                />
                <strong>Perimortem Cesarean Delivery (PMCD) Done</strong>
              </label>
              <div>
                <label>PMCD Decision-to-Delivery Time (min)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Target < 4-5 min"
                  value={pmcdMinutes}
                  onChange={(e) => setPmcdMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={ecmoInitiated}
                  onChange={(e) => setEcmoInitiated(e.target.checked)}
                />
                <strong>VA-ECMO Cannulation Initiated</strong>
              </label>
              <div>
                <label>Resuscitation Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="acute_resuscitation">Acute Active Resuscitation</option>
                  <option value="post_cardiac_arrest_icu">Post-Arrest ICU Stabilization</option>
                  <option value="coagulopathy_stabilizing">Coagulopathy Stabilizing</option>
                  <option value="convalescent">Convalescent Recovery</option>
                  <option value="maternal_death">Maternal Death</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Clinical Notes</legend>
            <textarea
              rows={3}
              placeholder="Record vasopressor requirements, ROSC timeline, blood gas findings..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </fieldset>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Initiate AFE Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
