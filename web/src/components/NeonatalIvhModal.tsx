import React, { useState, useEffect } from 'react';
import { createNeonatalIvhEpisode, calculateNeonatalIvh } from '../api';

interface NeonatalIvhModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalIvhModal: React.FC<NeonatalIvhModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [scanDatetime, setScanDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(26.5);
  const [birthWeightGrams, setBirthWeightGrams] = useState(850);
  const [chronologicalAgeDays, setChronologicalAgeDays] = useState(7);
  const [currentPmaWeeks, setCurrentPmaWeeks] = useState(27.5);
  const [currentWeightGrams, setCurrentWeightGrams] = useState(890);

  const [cranialUltrasoundIndication, setCranialUltrasoundIndication] = useState('Routine screening cranial ultrasound for infant < 32 weeks');
  const [papileGrade, setPapileGrade] = useState<string>('grade_3_intraventricular_dilatation');
  const [hemorrhageLaterality, setHemorrhageLaterality] = useState<string>('bilateral');
  const [parenchymalInfarctionLocation, setParenchymalInfarctionLocation] = useState('');

  // Morphometry
  const [ventricularIndexLeftMm, setVentricularIndexLeftMm] = useState(14.2);
  const [ventricularIndexRightMm, setVentricularIndexRightMm] = useState(16.5);
  const [anteriorHornWidthLeftMm, setAnteriorHornWidthLeftMm] = useState(5.8);
  const [anteriorHornWidthRightMm, setAnteriorHornWidthRightMm] = useState(7.2);
  const [thalamoOccipitalDistanceMm, setThalamoOccipitalDistanceMm] = useState(24.0);
  const [resistiveIndexAca, setResistiveIndexAca] = useState<number | ''>(0.86);

  // Growth & Clinical
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState(24.8);
  const [headCircumferenceGrowthCmWeek, setHeadCircumferenceGrowthCmWeek] = useState(1.6);
  const [fontanelleTension, setFontanelleTension] = useState<'normal_soft' | 'full' | 'bulging_tense'>('full');
  const [splitSutures, setSplitSutures] = useState(false);
  const [apneasOrBradycardiasPresent, setApneasOrBradycardiasPresent] = useState(true);

  // Intervention & CSF
  const [interventionStatus, setInterventionStatus] = useState<string>('conservative_surveillance');
  const [lumbarPuncturePerformed, setLumbarPuncturePerformed] = useState(false);
  const [csfProteinGL, setCsfProteinGL] = useState<number | ''>('');
  const [csfRbcCount, setCsfRbcCount] = useState<number | ''>('');
  const [status, setStatus] = useState('ultrasound_surveillance_active');
  const [clinicalNotes, setClinicalNotes] = useState('Bilateral Grade 3 IVH with progressive right ventricular dilation crossing Davies action line. Pediatric neurosurgery consulted.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate live preview
  useEffect(() => {
    calculateNeonatalIvh({
      gestationalAgeWeeks,
      birthWeightGrams,
      chronologicalAgeDays,
      currentPmaWeeks,
      currentWeightGrams,
      papileGrade,
      hemorrhageLaterality,
      parenchymalInfarctionLocation: parenchymalInfarctionLocation || undefined,
      ventricularIndexLeftMm,
      ventricularIndexRightMm,
      anteriorHornWidthLeftMm,
      anteriorHornWidthRightMm,
      thalamoOccipitalDistanceMm,
      resistiveIndexAca: resistiveIndexAca === '' ? undefined : Number(resistiveIndexAca),
      headCircumferenceCm,
      headCircumferenceGrowthCmWeek,
      fontanelleTension,
      splitSutures,
      apneasOrBradycardiasPresent,
      csfProteinGL: csfProteinGL === '' ? undefined : Number(csfProteinGL),
      csfRbcCount: csfRbcCount === '' ? undefined : Number(csfRbcCount),
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult.recommendedIntervention) {
          setInterventionStatus(res.evalResult.recommendedIntervention);
        }
      })
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    chronologicalAgeDays,
    currentPmaWeeks,
    currentWeightGrams,
    papileGrade,
    hemorrhageLaterality,
    parenchymalInfarctionLocation,
    ventricularIndexLeftMm,
    ventricularIndexRightMm,
    anteriorHornWidthLeftMm,
    anteriorHornWidthRightMm,
    thalamoOccipitalDistanceMm,
    resistiveIndexAca,
    headCircumferenceCm,
    headCircumferenceGrowthCmWeek,
    fontanelleTension,
    splitSutures,
    apneasOrBradycardiasPresent,
    csfProteinGL,
    csfRbcCount,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createNeonatalIvhEpisode({
        patientId,
        scanDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightGrams: Number(birthWeightGrams),
        chronologicalAgeDays: Number(chronologicalAgeDays),
        currentPmaWeeks: Number(currentPmaWeeks),
        currentWeightGrams: Number(currentWeightGrams),
        cranialUltrasoundIndication,
        papileGrade,
        hemorrhageLaterality,
        parenchymalInfarctionLocation: parenchymalInfarctionLocation || null,
        ventricularIndexLeftMm: Number(ventricularIndexLeftMm),
        ventricularIndexRightMm: Number(ventricularIndexRightMm),
        anteriorHornWidthLeftMm: Number(anteriorHornWidthLeftMm),
        anteriorHornWidthRightMm: Number(anteriorHornWidthRightMm),
        thalamoOccipitalDistanceMm: Number(thalamoOccipitalDistanceMm),
        resistiveIndexAca: resistiveIndexAca === '' ? null : Number(resistiveIndexAca),
        headCircumferenceCm: Number(headCircumferenceCm),
        headCircumferenceGrowthCmWeek: Number(headCircumferenceGrowthCmWeek),
        fontanelleTension,
        splitSutures,
        apneasOrBradycardiasPresent,
        interventionStatus,
        lumbarPuncturePerformed,
        csfProteinGL: csfProteinGL === '' ? null : Number(csfProteinGL),
        csfRbcCount: csfRbcCount === '' ? null : Number(csfRbcCount),
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record neonatal IVH episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 880, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#1e3a8a' }}>🧠 Neonatal IVH & Levene PHH Staging Console</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Papile Cranial Ultrasound Staging, Levene Ventricular Curve & Hydrocephalus Intervention for {patientName}
            </span>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Demographics & Indication */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ultrasound Date/Time</label>
              <input type="datetime-local" className="form-control" value={scanDatetime} onChange={(e) => setScanDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Birth GA (weeks)</label>
              <input type="number" step="0.1" className="form-control" value={gestationalAgeWeeks} onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Birth Weight (g)</label>
              <input type="number" className="form-control" value={birthWeightGrams} onChange={(e) => setBirthWeightGrams(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Current PMA (weeks)</label>
              <input type="number" step="0.1" className="form-control" value={currentPmaWeeks} onChange={(e) => setCurrentPmaWeeks(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Chronological Age (days)</label>
              <input type="number" className="form-control" value={chronologicalAgeDays} onChange={(e) => setChronologicalAgeDays(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Current Weight (g)</label>
              <input type="number" className="form-control" value={currentWeightGrams} onChange={(e) => setCurrentWeightGrams(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Indication</label>
              <input type="text" className="form-control" value={cranialUltrasoundIndication} onChange={(e) => setCranialUltrasoundIndication(e.target.value)} required />
            </div>
          </div>

          {/* Section 2: Papile Staging */}
          <div style={{ background: '#eff6ff', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #bfdbfe' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#1e40af', fontSize: '0.9rem' }}>Papile & Volpe Cranial Ultrasound Staging</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Papile Staging Grade</label>
                <select className="form-control" value={papileGrade} onChange={(e) => setPapileGrade(e.target.value)}>
                  <option value="grade_1_subependymal">Grade I: Germinal Matrix / Subependymal</option>
                  <option value="grade_2_intraventricular_normal_size">Grade II: IVH without Ventricular Enlargement (&lt;50%)</option>
                  <option value="grade_3_intraventricular_dilatation">Grade III: IVH with Acute Ventricular Dilatation (&gt;50%)</option>
                  <option value="grade_4_periventricular_infarction">Grade IV: Periventricular Hemorrhagic Infarction (PVHI)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Laterality</label>
                <select className="form-control" value={hemorrhageLaterality} onChange={(e) => setHemorrhageLaterality(e.target.value)}>
                  <option value="bilateral">Bilateral</option>
                  <option value="unilateral_left">Unilateral Left</option>
                  <option value="unilateral_right">Unilateral Right</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Parenchymal Infarction Site (if Grade IV)</label>
                <input type="text" className="form-control" placeholder="e.g. Right frontoparietal PVHI" value={parenchymalInfarctionLocation} onChange={(e) => setParenchymalInfarctionLocation(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 3: Ventricular Morphometry (Levene Indices) */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#334155', fontSize: '0.9rem' }}>Ventricular Morphometry & Levene Measurements</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ventricular Index Left (mm)</label>
                <input type="number" step="0.1" className="form-control" value={ventricularIndexLeftMm} onChange={(e) => setVentricularIndexLeftMm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ventricular Index Right (mm)</label>
                <input type="number" step="0.1" className="form-control" value={ventricularIndexRightMm} onChange={(e) => setVentricularIndexRightMm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Anterior Horn Width Left (mm)</label>
                <input type="number" step="0.1" className="form-control" value={anteriorHornWidthLeftMm} onChange={(e) => setAnteriorHornWidthLeftMm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Anterior Horn Width Right (mm)</label>
                <input type="number" step="0.1" className="form-control" value={anteriorHornWidthRightMm} onChange={(e) => setAnteriorHornWidthRightMm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Thalamo-Occipital Dist (mm)</label>
                <input type="number" step="0.5" className="form-control" value={thalamoOccipitalDistanceMm} onChange={(e) => setThalamoOccipitalDistanceMm(Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>ACA Resistive Index (Doppler)</label>
                <input type="number" step="0.01" className="form-control" placeholder="Normal: 0.65-0.75" value={resistiveIndexAca} onChange={(e) => setResistiveIndexAca(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Head Circumference (cm)</label>
                <input type="number" step="0.1" className="form-control" value={headCircumferenceCm} onChange={(e) => setHeadCircumferenceCm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Growth Rate (cm/week)</label>
                <input type="number" step="0.1" className="form-control" value={headCircumferenceGrowthCmWeek} onChange={(e) => setHeadCircumferenceGrowthCmWeek(Number(e.target.value))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fontanelle Tension</label>
                <select className="form-control" value={fontanelleTension} onChange={(e) => setFontanelleTension(e.target.value as any)}>
                  <option value="normal_soft">Normal / Soft</option>
                  <option value="full">Full</option>
                  <option value="bulging_tense">Bulging / Tense</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={splitSutures} onChange={(e) => setSplitSutures(e.target.checked)} />
                  <strong>Split Cranial Sutures</strong>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={apneasOrBradycardiasPresent} onChange={(e) => setApneasOrBradycardiasPresent(e.target.checked)} />
                  <strong>Apneas / Bradycardias Present</strong>
                </label>
              </div>
            </div>
          </div>

          {/* Real-time Calculation Preview Card */}
          {preview && (
            <div style={{ background: preview.phhInterventionThresholdCrossed ? '#fef2f2' : '#f0fdf4', border: `1px solid ${preview.phhInterventionThresholdCrossed ? '#f87171' : '#86efac'}`, padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.phhInterventionThresholdCrossed ? '#b91c1c' : '#15803d' }}>
                  {preview.summary}
                </strong>
                <span className={`badge ${preview.phhInterventionThresholdCrossed ? 'badge-danger' : 'badge-success'}`}>
                  {preview.phhInterventionThresholdCrossed ? 'NEUROSURGICAL THRESHOLD CROSSED' : 'SURVEILLANCE'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8, fontSize: '0.8rem' }}>
                <div><strong>Max VI:</strong> {preview.maxVentricularIndexMm} mm</div>
                <div><strong>Levene 97th:</strong> {preview.levene97thPercentileMm} mm</div>
                <div><strong>Davies Action Line:</strong> {preview.leveneActionLineThresholdMm} mm</div>
                <div><strong>Max AHW:</strong> {preview.maxAnteriorHornWidthMm} mm</div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#334155' }}>
                <strong>Neurosurgery Guidance:</strong> {preview.interventionGuidance}
              </div>
            </div>
          )}

          {/* Section 4: Neurosurgical Intervention & CSF Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intervention Selected</label>
              <select className="form-control" value={interventionStatus} onChange={(e) => setInterventionStatus(e.target.value)}>
                <option value="conservative_surveillance">Conservative Surveillance</option>
                <option value="serial_lumbar_punctures">Serial Lumbar Punctures</option>
                <option value="ventricular_access_device_reservoir">Ventricular Access Device (Reservoir)</option>
                <option value="subgaleal_shunt">Subgaleal Shunt</option>
                <option value="permanent_vp_shunt">Permanent VP Shunt</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>CSF Protein (g/L)</label>
              <input type="number" step="0.1" className="form-control" placeholder="Target < 1.5 g/L" value={csfProteinGL} onChange={(e) => setCsfProteinGL(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Episode Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ultrasound_surveillance_active">Ultrasound Surveillance Active</option>
                <option value="phh_active_decompression">PHH Active Decompression</option>
                <option value="post_surgical_shunt_monitoring">Post-Surgical Shunt Monitoring</option>
                <option value="stable_arrested_hydrocephalus">Stable / Arrested Hydrocephalus</option>
                <option value="resolved_quiescent">Resolved / Quiescent</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes & Management Strategy</label>
            <textarea className="form-control" rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Record Neonatal IVH Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
