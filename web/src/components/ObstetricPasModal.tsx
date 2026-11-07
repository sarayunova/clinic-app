import React, { useState, useEffect } from 'react';
import { calculateObstetricPas, createObstetricPasEpisode } from '../api';

interface Props {
  patientId: number;
  gestationWeeks?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricPasModal: React.FC<Props> = ({
  patientId,
  gestationWeeks = 32,
  onClose,
  onSaved,
}) => {
  const [gestWeeks, setGestWeeks] = useState(gestationWeeks);
  const [evalDatetime, setEvalDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [priorCesareans, setPriorCesareans] = useState(2);
  const [placentaPrevia, setPlacentaPrevia] = useState(true);

  // Ultrasound markers
  const [lossOfClearZone, setLossOfClearZone] = useState(true);
  const [myometrialThinning, setMyometrialThinning] = useState(true);
  const [lacunaeGrade, setLacunaeGrade] = useState(2);
  const [subplacentalHypervasc, setSubplacentalHypervasc] = useState(true);
  const [bridgingVessels, setBridgingVessels] = useState(false);

  // MRI
  const [mriPerformed, setMriPerformed] = useState(false);
  const [mriFindings, setMriFindings] = useState('');

  // Surgical / MDT preparation
  const [plannedDeliveryWeeks, setPlannedDeliveryWeeks] = useState(34.5);
  const [surgicalApproach, setSurgicalApproach] = useState('planned_cesarean_hysterectomy');
  const [irEmbolization, setIrEmbolization] = useState(true);
  const [ureteralStents, setUreteralStents] = useState(false);
  const [cellSaver, setCellSaver] = useState(true);
  const [prbcUnits, setPrbcUnits] = useState(6);
  const [ffpUnits, setFfpUnits] = useState(6);
  const [plateletUnits, setPlateletUnits] = useState(2);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    void calculateObstetricPas({
      gestationWeeks: gestWeeks,
      previousCesareansCount: priorCesareans,
      placentaPreviaPresent: placentaPrevia,
      lossOfClearZone,
      myometrialThicknessLess1mm: myometrialThinning,
      lacunaeGrade,
      subplacentalHypervascularity: subplacentalHypervasc,
      bridgingVesselsToBladder: bridgingVessels,
      mriFindings: mriPerformed ? mriFindings : undefined,
    }).then((res) => {
      setPreview(res.evalResult);
      if (res.evalResult) {
        setPrbcUnits(res.evalResult.recommendedPrbcUnits);
        setFfpUnits(res.evalResult.recommendedFfpUnits);
        setPlateletUnits(res.evalResult.recommendedPlateletUnits);
        setIrEmbolization(res.evalResult.interventionalRadiologyIndicated);
        setUreteralStents(res.evalResult.ureteralStentingIndicated);
      }
    });
  }, [
    gestWeeks,
    priorCesareans,
    placentaPrevia,
    lossOfClearZone,
    myometrialThinning,
    lacunaeGrade,
    subplacentalHypervasc,
    bridgingVessels,
    mriPerformed,
    mriFindings,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createObstetricPasEpisode({
        patientId,
        evaluationDatetime: evalDatetime,
        gestationWeeks: gestWeeks,
        previousCesareansCount: priorCesareans,
        placentaPreviaPresent: placentaPrevia,
        priorUterineSurgeriesJson: JSON.stringify(['cesarean_x_' + priorCesareans]),
        lossOfClearZone,
        myometrialThicknessLess1mm: myometrialThinning,
        lacunaeGrade,
        subplacentalHypervascularity: subplacentalHypervasc,
        bridgingVesselsToBladder: bridgingVessels,
        mriPerformed,
        mriFindings: mriPerformed ? mriFindings : null,
        mdtMembersJson: JSON.stringify(preview?.mdtChecklist ?? []),
        irEmbolizationPlanned: irEmbolization,
        ureteralStentsPlanned: ureteralStents,
        cellSaverRequested: cellSaver,
        prbcUnitsReserved: prbcUnits,
        ffpUnitsReserved: ffpUnits,
        plateletUnitsReserved: plateletUnits,
        plannedDeliveryWeeks,
        surgicalApproach,
        clinicalNotes: notes,
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Error saving PAS episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal large" style={{ maxWidth: '850px' }}>
        <h2>🩸 Placenta Accreta Spectrum (PAS) MDT Protocol</h2>
        <p className="muted">FIGO / SMFM Staging, Surgical Hemorrhage Preparedness & Planned Delivery Protocol</p>

        <form onSubmit={handleSubmit}>
          <div className="grid col-3 gap-1">
            <div>
              <label>Gestation (weeks)</label>
              <input type="number" step="0.1" value={gestWeeks} onChange={(e) => setGestWeeks(parseFloat(e.target.value) || 0)} required />
            </div>
            <div>
              <label>Prior Cesarean Sections</label>
              <input type="number" min="0" value={priorCesareans} onChange={(e) => setPriorCesareans(parseInt(e.target.value, 10) || 0)} required />
            </div>
            <div>
              <label>Evaluation Datetime</label>
              <input type="datetime-local" value={evalDatetime} onChange={(e) => setEvalDatetime(e.target.value)} required />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label className="checkbox">
              <input type="checkbox" checked={placentaPrevia} onChange={(e) => setPlacentaPrevia(e.target.checked)} />
              <strong>Placenta Previa Present</strong> (Increases accreta risk exponentially with prior cesareans)
            </label>
          </div>

          <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #d9534f' }}>
            <legend><strong>Ultrasound Color Doppler Staging Markers</strong></legend>
            <div className="grid col-2 gap-1">
              <label className="checkbox"><input type="checkbox" checked={lossOfClearZone} onChange={(e) => setLossOfClearZone(e.target.checked)} /> Loss of retroplacental clear zone</label>
              <label className="checkbox"><input type="checkbox" checked={myometrialThinning} onChange={(e) => setMyometrialThinning(e.target.checked)} /> Myometrial thickness &lt; 1 mm</label>
              <label className="checkbox"><input type="checkbox" checked={subplacentalHypervasc} onChange={(e) => setSubplacentalHypervasc(e.target.checked)} /> Subplacental hypervascularity / chaotic flow</label>
              <label className="checkbox" style={{ color: '#d9534f' }}><input type="checkbox" checked={bridgingVessels} onChange={(e) => setBridgingVessels(e.target.checked)} /> 🚨 <strong>Bridging vessels breaching serosa into bladder</strong> (Percreta)</label>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <label>Intraplacental Lacunae Grade</label>
              <select value={lacunaeGrade} onChange={(e) => setLacunaeGrade(parseInt(e.target.value, 10))}>
                <option value={0}>Grade 0: None</option>
                <option value={1}>Grade 1: 1–3 small lacunae</option>
                <option value={2}>Grade 2: 4–6 larger irregular lacunae with turbulent high-velocity flow</option>
                <option value={3}>Grade 3: Numerous large, bizarre confluent lacunae ("Swiss cheese")</option>
              </select>
            </div>
          </fieldset>

          <div className="grid col-2 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label className="checkbox"><input type="checkbox" checked={mriPerformed} onChange={(e) => setMriPerformed(e.target.checked)} /> MRI Pelvis Performed</label>
              {mriPerformed && (
                <input type="text" value={mriFindings} onChange={(e) => setMriFindings(e.target.value)} placeholder="T2 dark intraplacental bands, tenting of bladder..." />
              )}
            </div>
            <div>
              <label>Surgical Approach</label>
              <select value={surgicalApproach} onChange={(e) => setSurgicalApproach(e.target.value)}>
                <option value="planned_cesarean_hysterectomy">Planned Cesarean Hysterectomy (Placenta left in situ)</option>
                <option value="delayed_hysterectomy">Delayed Hysterectomy</option>
                <option value="conservative_uterine_preservation">Conservative / Uterine Preservation</option>
              </select>
            </div>
          </div>

          <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
            <legend><strong>Multidisciplinary Team (MDT) Surgical Preparedness</strong></legend>
            <div className="grid col-3 gap-1">
              <label className="checkbox"><input type="checkbox" checked={irEmbolization} onChange={(e) => setIrEmbolization(e.target.checked)} /> Interventional Radiology (IR) Balloon Occlusion</label>
              <label className="checkbox"><input type="checkbox" checked={ureteralStents} onChange={(e) => setUreteralStents(e.target.checked)} /> Prophylactic Ureteral Stents (Urology)</label>
              <label className="checkbox"><input type="checkbox" checked={cellSaver} onChange={(e) => setCellSaver(e.target.checked)} /> Cell Saver Autologous Blood Salvage</label>
            </div>
            <div className="grid col-4 gap-1" style={{ marginTop: '0.5rem' }}>
              <div>
                <label>PRBC Units</label>
                <input type="number" min="0" value={prbcUnits} onChange={(e) => setPrbcUnits(parseInt(e.target.value, 10) || 0)} />
              </div>
              <div>
                <label>FFP Units</label>
                <input type="number" min="0" value={ffpUnits} onChange={(e) => setFfpUnits(parseInt(e.target.value, 10) || 0)} />
              </div>
              <div>
                <label>Platelets Units</label>
                <input type="number" min="0" value={plateletUnits} onChange={(e) => setPlateletUnits(parseInt(e.target.value, 10) || 0)} />
              </div>
              <div>
                <label>Planned Delivery (w)</label>
                <input type="number" step="0.1" value={plannedDeliveryWeeks} onChange={(e) => setPlannedDeliveryWeeks(parseFloat(e.target.value) || 34.0)} />
              </div>
            </div>
          </fieldset>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Clinical & MDT Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lead surgeon, Gyn-Oncology co-surgeon, crossmatch confirmed..." />
          </div>

          {preview && (
            <div className={`banner ${preview.pasRiskLevel === 'critical_percreta' ? 'danger' : 'warn'}`} style={{ marginTop: '1rem' }}>
              <h4>{preview.pasGradeTitle}</h4>
              <p><strong>Estimated Hemorrhage Risk:</strong> {preview.estimatedHemorrhageRisk}</p>
              <p><strong>SMFM Delivery Window:</strong> {preview.recommendedDeliveryTimingWeeksMin}–{preview.recommendedDeliveryTimingWeeksMax} weeks (with Betamethasone course).</p>
              <p><strong>Blood Bank Pre-Arrangement:</strong> {preview.recommendedPrbcUnits} PRBC + {preview.recommendedFfpUnits} FFP + {preview.recommendedPlateletUnits} Platelets reserved in OR.</p>
              <div style={{ marginTop: '0.25rem' }}>
                <strong>Key Surgical Directive:</strong> High fundal hysterotomy avoiding placenta. <em>DO NOT manually detach placenta.</em>
              </div>
            </div>
          )}

          <div className="actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : 'Save PAS Protocol'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
