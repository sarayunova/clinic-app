import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type PphAssessment,
  type PphAssessmentsResponse,
  type PphTimelineEntry,
} from '../api';
import {
  calculateQbl,
  calculateObstetricShockIndex,
  calculateMeanArterialPressure,
  determinePphStage,
  FOUR_T_ETIOLOGY_INFO,
  checkUterotonicSafety,
  type PphStage,
} from '../pphScoring';
import { ErrorBanner } from './ui';

interface Props {
  patient: Patient;
}

export function PphQblManager({ patient }: Props) {
  const patientId = Number(patient.id);

  const [assessments, setAssessments] = useState<PphAssessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Modal State for New/Edit Assessment
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showTimelineModal, setShowTimelineModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<unknown>(null);

  // Form State
  const [deliveryMode, setDeliveryMode] = useState<'vaginal' | 'cesarean' | 'assisted_vacuum_forceps'>('vaginal');
  const [deliveryTimestamp, setDeliveryTimestamp] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [primaryEtiology, setPrimaryEtiology] = useState<'tone_atony' | 'trauma_laceration' | 'tissue_retained' | 'thrombin_coagulopathy' | 'mixed_unclear'>('tone_atony');
  const [etiologyDetails, setEtiologyDetails] = useState<string>('');
  const [uterineTone, setUterineTone] = useState<'well_contracted_firm' | 'soft_boggy' | 'relaxing_between_massage' | 'uncontracted'>('soft_boggy');

  // QBL Components
  const [calibratedDrapeMl, setCalibratedDrapeMl] = useState<number>(300);
  const [suctionCanisterMl, setSuctionCanisterMl] = useState<number>(100);
  const [spongesWetG, setSpongesWetG] = useState<number>(250);
  const [spongesDryG, setSpongesDryG] = useState<number>(50);
  const [clotsG, setClotsG] = useState<number>(100);
  const [visualEblMl, setVisualEblMl] = useState<string>('400');

  // Vitals
  const [pulse, setPulse] = useState<string>('105');
  const [sbp, setSbp] = useState<string>('95');
  const [dbp, setDbp] = useState<string>('60');
  const [spo2, setSpo2] = useState<string>('98');

  // Uterotonics & Resuscitation
  const [bimanualCompression, setBimanualCompression] = useState<boolean>(true);
  const [bladderCath, setBladderCath] = useState<boolean>(true);
  const [ivAccessWide, setIvAccessWide] = useState<boolean>(true);
  const [crystalloidsMl, setCrystalloidsMl] = useState<number>(1500);

  const [oxytocinGiven, setOxytocinGiven] = useState<boolean>(true);
  const [oxytocinDoseRoute, setOxytocinDoseRoute] = useState<string>('10 IU IM + 20 IU in 500mL NS @ 250mL/hr');

  const [txaGiven, setTxaGiven] = useState<boolean>(true);
  const [txaGivenAt, setTxaGivenAt] = useState<string>(() => new Date().toISOString().slice(0, 16));

  const [methergineGiven, setMethergineGiven] = useState<boolean>(false);
  const [methergineContraindicated, setMethergineContraindicated] = useState<boolean>(false);

  const [carboprostGiven, setCarboprostGiven] = useState<boolean>(false);
  const [carboprostDoses, setCarboprostDoses] = useState<number>(0);
  const [carboprostContraindicated, setCarboprostContraindicated] = useState<boolean>(false);

  const [misoprostolGiven, setMisoprostolGiven] = useState<boolean>(false);
  const [misoprostolDose, setMisoprostolDose] = useState<number>(800);

  const [balloonUsed, setBalloonUsed] = useState<boolean>(false);
  const [balloonFillMl, setBalloonFillMl] = useState<number>(350);

  const [mtpActivated, setMtpActivated] = useState<boolean>(false);
  const [prbcUnits, setPrbcUnits] = useState<number>(0);
  const [ffpUnits, setFfpUnits] = useState<number>(0);
  const [plateletUnits, setPlateletUnits] = useState<number>(0);
  const [cryoUnits, setCryoUnits] = useState<number>(0);

  const [surgicalIntervention, setSurgicalIntervention] = useState<'none' | 'compression_sutures_b_lynch' | 'uterine_artery_ligation' | 'internal_iliac_ligation' | 'peripartum_hysterectomy' | 'examination_under_anesthesia'>('none');
  const [outcomeStatus, setOutcomeStatus] = useState<'bleeding_controlled' | 'stable_under_observation' | 'transferred_to_ot' | 'transferred_to_icu' | 'critical_unstable'>('bleeding_controlled');

  const [attendingDoctor, setAttendingDoctor] = useState<string>('');
  const [attendingAnesthetist, setAttendingAnesthetist] = useState<string>('');
  const [nurseInCharge, setNurseInCharge] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Timeline Form State
  const [timelineDrapeInc, setTimelineDrapeInc] = useState<number>(100);
  const [timelineSpongeInc, setTimelineSpongeInc] = useState<number>(50);
  const [timelineClotsInc, setTimelineClotsInc] = useState<number>(50);
  const [timelinePulse, setTimelinePulse] = useState<string>('100');
  const [timelineSbp, setTimelineSbp] = useState<string>('100');
  const [timelineDbp, setTimelineDbp] = useState<string>('65');
  const [timelineAction, setTimelineAction] = useState<string>('Uterotonics continued; IV crystalloids infusing');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<PphAssessmentsResponse>('GET', `/api/patients/${patientId}/pph-assessments`);
      setAssessments(res.assessments || []);
      if (res.assessments && res.assessments.length > 0 && !selectedAssessmentId) {
        setSelectedAssessmentId(res.assessments[0]!.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Active selected assessment
  const activeAssessment = useMemo(() => {
    if (!assessments || assessments.length === 0) return null;
    return assessments.find((a) => a.id === selectedAssessmentId) || assessments[0] || null;
  }, [assessments, selectedAssessmentId]);

  // Real-time calculations inside modal
  const modalQblCalc = useMemo(() => {
    return calculateQbl({
      calibratedDrapeMl,
      suctionCanisterMl,
      spongesWetWeightG: spongesWetG,
      spongesDryWeightG: spongesDryG,
      clotsWeighedG: clotsG,
      eblVisualEstimateMl: visualEblMl ? parseInt(visualEblMl) : null,
    });
  }, [calibratedDrapeMl, suctionCanisterMl, spongesWetG, spongesDryG, clotsG, visualEblMl]);

  const pNum = pulse ? parseInt(pulse) : null;
  const sNum = sbp ? parseInt(sbp) : null;
  const dNum = dbp ? parseInt(dbp) : null;

  const modalShockIndexCalc = useMemo(() => {
    return calculateObstetricShockIndex(pNum, sNum);
  }, [pNum, sNum]);

  const modalStageCalc = useMemo(() => {
    return determinePphStage(modalQblCalc.totalQblMl, deliveryMode, modalShockIndexCalc.shockIndex);
  }, [modalQblCalc.totalQblMl, deliveryMode, modalShockIndexCalc.shockIndex]);

  // Check hypertension for Methergine safety
  const isHypertensive = (sNum != null && sNum >= 140) || (dNum != null && dNum >= 90);
  const uterotonicSafety = useMemo(() => {
    return checkUterotonicSafety(isHypertensive || methergineContraindicated, carboprostContraindicated);
  }, [isHypertensive, methergineContraindicated, carboprostContraindicated]);

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setModalError(null);

      const map = calculateMeanArterialPressure(sNum, dNum);

      await api('POST', `/api/patients/${patientId}/pph-assessments`, {
        deliveryMode,
        deliveryTimestamp,
        pphStage: modalStageCalc.stage,
        primaryEtiology4t: primaryEtiology,
        etiologyDetails: etiologyDetails.trim() || null,
        uterineTone,
        qblTotalMl: modalQblCalc.totalQblMl,
        qblCalibratedDrapeMl: calibratedDrapeMl,
        qblSuctionCanisterMl: suctionCanisterMl,
        qblSpongesWetWeightG: spongesWetG,
        qblSpongesDryWeightG: spongesDryG,
        qblClotsWeighedG: clotsG,
        eblVisualEstimateMl: visualEblMl ? parseInt(visualEblMl) : null,
        maternalPulse: pNum,
        maternalBpSystolic: sNum,
        maternalBpDiastolic: dNum,
        shockIndex: modalShockIndexCalc.shockIndex,
        shockIndexSeverity: modalShockIndexCalc.severity,
        meanArterialPressure: map,
        spo2Pct: spo2 ? parseInt(spo2) : null,
        bimanualCompressionDone: bimanualCompression,
        bladderCatheterized: bladderCath,
        ivAccessTwoWideBore: ivAccessWide,
        crystalloidsInfusedMl: crystalloidsMl,
        oxytocinGiven,
        oxytocinDoseRoute: oxytocinDoseRoute.trim() || null,
        tranexamicAcidGiven: txaGiven,
        txaGivenAt: txaGiven ? txaGivenAt : null,
        methylergometrineGiven: methergineGiven,
        methergineContraindicated: methergineContraindicated || isHypertensive,
        carboprostGiven,
        carboprostDosesCount: carboprostDoses,
        carboprostContraindicated,
        misoprostolGiven,
        misoprostolDoseMcg: misoprostolGiven ? misoprostolDose : 0,
        uterineTamponadeBalloonUsed: balloonUsed,
        balloonFillVolumeMl: balloonUsed ? balloonFillMl : 0,
        mtpActivated,
        bloodUnitsTransfused: prbcUnits,
        ffpUnitsTransfused: ffpUnits,
        plateletUnitsTransfused: plateletUnits,
        cryoprecipitateUnitsTransfused: cryoUnits,
        surgicalIntervention,
        outcomeStatus,
        attendingObstetrician: attendingDoctor.trim() || null,
        attendingAnesthetist: attendingAnesthetist.trim() || null,
        nurseInCharge: nurseInCharge.trim() || null,
        notes: notes.trim() || null,
      });

      setShowModal(false);
      await loadData();
    } catch (err) {
      setModalError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimelineEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssessment) return;
    try {
      setSaving(true);
      const incTotal = (timelineDrapeInc || 0) + (timelineSpongeInc || 0) + (timelineClotsInc || 0);
      const newCumulative = (activeAssessment.qblTotalMl || 0) + incTotal;
      const tp = timelinePulse ? parseInt(timelinePulse) : null;
      const ts = timelineSbp ? parseInt(timelineSbp) : null;
      const td = timelineDbp ? parseInt(timelineDbp) : null;
      const si = tp && ts && ts > 0 ? Math.round((tp / ts) * 100) / 100 : null;

      await api('POST', `/api/pph-assessments/${activeAssessment.id}/timeline`, {
        drapeIncrementMl: timelineDrapeInc,
        spongeIncrementG: timelineSpongeInc,
        clotsIncrementG: timelineClotsInc,
        cumulativeQblMl: newCumulative,
        pulse: tp,
        bpSystolic: ts,
        bpDiastolic: td,
        shockIndex: si,
        actionTaken: timelineAction.trim() || null,
      });

      setShowTimelineModal(false);
      await loadData();
    } catch (err) {
      alert('Failed to add timeline increment: ' + ((err as Error).message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssessment = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PPH resuscitation assessment record?')) return;
    try {
      await api('DELETE', `/api/pph-assessments/${id}`);
      await loadData();
    } catch (err) {
      alert('Failed to delete assessment: ' + ((err as Error).message || String(err)));
    }
  };

  return (
    <div className="pph-qbl-manager stack" style={{ marginTop: '0.75rem', gap: '1rem' }}>
      {/* Top Banner / Actions Header */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
          border: '1.5px solid #dc2626',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
          <div>
            <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.4rem' }}>🩸</span>
              <h3 style={{ margin: 0, color: '#991b1b' }}>Postpartum Hemorrhage (PPH) &amp; Quantitative Blood Loss (QBL) Suite</h3>
              {activeAssessment && (
                <span className={`badge ${activeAssessment.pphStage === 'stage_3_severe_mtp' ? 'err' : activeAssessment.pphStage === 'stage_2_moderate' ? 'warn' : 'ok'}`} style={{ fontWeight: 'bold' }}>
                  {activeAssessment.pphStage.toUpperCase().replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="muted small" style={{ marginTop: '0.3rem', color: '#7f1d1d' }}>
              Gravimetric &amp; volumetric QBL tally (1g = 1mL), Obstetric Shock Index early warning, 4T etiology triage, and stage-based uterotonics/MTP resuscitation.
            </div>
          </div>

          <div className="row wrap" style={{ gap: '0.5rem' }}>
            {activeAssessment && (
              <Link
                to={`/pph-assessments/${activeAssessment.id}/print`}
                target="_blank"
                className="btn small"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
              >
                🖨️ Printable PPH Resuscitation Audit
              </Link>
            )}
            {activeAssessment && (
              <button
                type="button"
                className="btn small"
                onClick={() => setShowTimelineModal(true)}
                style={{ background: '#0284c7', color: '#ffffff' }}
              >
                ⏱️ Log QBL Increment / Vitals
              </button>
            )}
            <button
              type="button"
              className="btn small primary"
              onClick={() => setShowModal(true)}
              style={{ fontWeight: 'bold', background: '#dc2626', borderColor: '#b91c1c' }}
            >
              ➕ New PPH Assessment &amp; QBL
            </button>
          </div>
        </div>
      </div>

      {Boolean(error) && <ErrorBanner error={error} />}

      {/* Main Content Area */}
      {loading ? (
        <p className="muted small">Loading PPH assessments...</p>
      ) : assessments.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <span style={{ fontSize: '2rem' }}>🩸</span>
          <h4 style={{ margin: '0.5rem 0', color: '#334155' }}>No Postpartum Hemorrhage Assessments Logged</h4>
          <p className="muted small" style={{ maxWidth: '500px', margin: '0 auto 1rem auto' }}>
            Quantitative Blood Loss (QBL) accurately identifies hemorrhage early compared to visual estimates. Click below to document delivery blood loss and shock index.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowModal(true)}
            style={{ background: '#dc2626', borderColor: '#b91c1c' }}
          >
            ➕ Start QBL &amp; PPH Assessment
          </button>
        </div>
      ) : (
        <div className="stack" style={{ gap: '1rem' }}>
          {/* Assessment Selector Tabs if multiple */}
          {assessments.length > 1 && (
            <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
              <span className="muted small">Assessments ({assessments.length}):</span>
              {assessments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`btn small ${selectedAssessmentId === a.id ? 'primary' : ''}`}
                  onClick={() => setSelectedAssessmentId(a.id)}
                  style={{ fontSize: '0.78rem' }}
                >
                  {a.deliveryMode.toUpperCase()} · QBL: {a.qblTotalMl} mL ({a.assessmentTimestamp.slice(0, 16)})
                </button>
              ))}
            </div>
          )}

          {activeAssessment && (
            <div className="stack" style={{ gap: '1rem' }}>
              {/* Critical Resuscitation & Shock Index Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {/* Total QBL */}
                <div
                  className="card"
                  style={{
                    padding: '0.85rem',
                    textAlign: 'center',
                    borderTop: activeAssessment.qblTotalMl >= 1500 ? '4px solid #dc2626' : activeAssessment.qblTotalMl >= 1000 ? '4px solid #ea580c' : activeAssessment.qblTotalMl >= 500 ? '4px solid #eab308' : '4px solid #16a34a',
                  }}
                >
                  <div className="muted small">Cumulative QBL</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: activeAssessment.qblTotalMl >= 1000 ? '#dc2626' : '#0f172a' }}>
                    {activeAssessment.qblTotalMl} <span style={{ fontSize: '1rem' }}>mL</span>
                  </div>
                  <div className="muted small" style={{ fontSize: '0.72rem' }}>
                    {activeAssessment.eblVisualEstimateMl ? `Visual EBL was: ${activeAssessment.eblVisualEstimateMl} mL` : 'Volumetric + Gravimetric'}
                  </div>
                </div>

                {/* Obstetric Shock Index */}
                <div
                  className="card"
                  style={{
                    padding: '0.85rem',
                    textAlign: 'center',
                    borderTop: activeAssessment.shockIndex != null && activeAssessment.shockIndex >= 1.4 ? '4px solid #dc2626' : activeAssessment.shockIndex != null && activeAssessment.shockIndex >= 1.0 ? '4px solid #ea580c' : activeAssessment.shockIndex != null && activeAssessment.shockIndex >= 0.9 ? '4px solid #eab308' : '4px solid #16a34a',
                  }}
                >
                  <div className="muted small">Obstetric Shock Index (HR/SBP)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: activeAssessment.shockIndex != null && activeAssessment.shockIndex >= 1.0 ? '#dc2626' : '#16a34a' }}>
                    {activeAssessment.shockIndex != null ? activeAssessment.shockIndex : '—'}
                  </div>
                  <div className="muted small" style={{ fontSize: '0.72rem' }}>
                    <span className={`badge ${activeAssessment.shockIndexSeverity === 'critical_collapse' ? 'err' : activeAssessment.shockIndexSeverity === 'high_risk' ? 'err' : activeAssessment.shockIndexSeverity === 'early_warning' ? 'warn' : 'ok'}`} style={{ fontSize: '0.65rem' }}>
                      {activeAssessment.shockIndexSeverity.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Vitals Summary */}
                <div className="card" style={{ padding: '0.85rem', textAlign: 'center', borderTop: '4px solid #0284c7' }}>
                  <div className="muted small">Hemodynamics</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.2rem' }}>
                    {activeAssessment.maternalPulse ? `${activeAssessment.maternalPulse} bpm` : '—'} · {activeAssessment.maternalBpSystolic && activeAssessment.maternalBpDiastolic ? `${activeAssessment.maternalBpSystolic}/${activeAssessment.maternalBpDiastolic}` : '—'}
                  </div>
                  <div className="muted small" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                    MAP: {activeAssessment.meanArterialPressure ? `${activeAssessment.meanArterialPressure} mmHg` : '—'} · SpO2: {activeAssessment.spo2Pct ? `${activeAssessment.spo2Pct}%` : '—'}
                  </div>
                </div>

                {/* 4T Primary Etiology */}
                <div className="card" style={{ padding: '0.85rem', textAlign: 'center', borderTop: '4px solid #8b5cf6' }}>
                  <div className="muted small">Primary 4T Etiology</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.2rem' }}>
                    {FOUR_T_ETIOLOGY_INFO[activeAssessment.primaryEtiology4t]?.name || activeAssessment.primaryEtiology4t}
                  </div>
                  <div className="muted small" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                    Tone: <strong>{activeAssessment.uterineTone.replace('_', ' ').toUpperCase()}</strong>
                  </div>
                </div>
              </div>

              {/* Stage-Based Action Recommendations Banner */}
              {(() => {
                const stageInfo = determinePphStage(activeAssessment.qblTotalMl, activeAssessment.deliveryMode, activeAssessment.shockIndex);
                return (
                  <div
                    style={{
                      background: stageInfo.stage === 'stage_3_severe_mtp' ? '#fef2f2' : stageInfo.stage === 'stage_2_moderate' ? '#fffbeb' : '#f0fdf4',
                      border: `1.5px solid ${stageInfo.stage === 'stage_3_severe_mtp' ? '#ef4444' : stageInfo.stage === 'stage_2_moderate' ? '#f59e0b' : '#22c55e'}`,
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <strong style={{ color: stageInfo.stage === 'stage_3_severe_mtp' ? '#991b1b' : stageInfo.stage === 'stage_2_moderate' ? '#92400e' : '#166534', fontSize: '0.95rem' }}>
                        {stageInfo.title}
                      </strong>
                      <span className="small muted">{stageInfo.summary}</span>
                    </div>
                    <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, fontSize: '0.82rem', color: '#1e293b', lineHeight: '1.4' }}>
                      {stageInfo.priorityActions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* QBL Calculation Breakdown & Uterotonics Checklist Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                {/* QBL Breakdown Card */}
                <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <span>⚖️</span> QBL Measurement Breakdown
                  </strong>

                  <div className="stack" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.3rem' }}>
                      <span className="muted">Under-Buttocks Calibrated Drape:</span>
                      <strong>{activeAssessment.qblCalibratedDrapeMl} mL</strong>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.3rem' }}>
                      <span className="muted">Suction Canister (Net blood):</span>
                      <strong>{activeAssessment.qblSuctionCanisterMl} mL</strong>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.3rem' }}>
                      <span className="muted">Surgical Sponges &amp; Pads:</span>
                      <strong>
                        {activeAssessment.qblSpongesWetWeightG}g wet − {activeAssessment.qblSpongesDryWeightG}g dry ={' '}
                        {Math.max(0, activeAssessment.qblSpongesWetWeightG - activeAssessment.qblSpongesDryWeightG)} mL
                      </strong>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.3rem' }}>
                      <span className="muted">Weighed Retroplacental Clots:</span>
                      <strong>{activeAssessment.qblClotsWeighedG} g ({activeAssessment.qblClotsWeighedG} mL)</strong>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between', paddingTop: '0.3rem', fontSize: '0.92rem' }}>
                      <span><strong>Total Cumulative QBL:</strong></span>
                      <strong style={{ color: '#dc2626' }}>{activeAssessment.qblTotalMl} mL</strong>
                    </div>

                    {activeAssessment.eblVisualEstimateMl != null && (
                      <div style={{ marginTop: '0.4rem', background: '#fffbeb', padding: '0.45rem', borderRadius: '4px', fontSize: '0.78rem', color: '#92400e' }}>
                        👁️ <strong>Visual Estimation Delta:</strong> Visual EBL was documented as {activeAssessment.eblVisualEstimateMl} mL.
                        {activeAssessment.qblTotalMl > activeAssessment.eblVisualEstimateMl && (
                          <span> Actual QBL is <strong>{activeAssessment.qblTotalMl - activeAssessment.eblVisualEstimateMl} mL higher</strong> ({Math.round((activeAssessment.qblTotalMl / activeAssessment.eblVisualEstimateMl) * 10) / 10}× underestimation).</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Resuscitation Checklist Card */}
                <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <span>💉</span> Medical Resuscitation &amp; Uterotonics Checklist
                  </strong>

                  <div className="stack" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>Bimanual Compression &amp; Massage:</span>
                      <span className={`badge ${activeAssessment.bimanualCompressionDone ? 'ok' : 'warn'}`}>
                        {activeAssessment.bimanualCompressionDone ? 'DONE' : 'PENDING'}
                      </span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>Foley Catheter Bladder Drainage:</span>
                      <span className={`badge ${activeAssessment.bladderCatheterized ? 'ok' : 'warn'}`}>
                        {activeAssessment.bladderCatheterized ? 'INSERTED' : 'PENDING'}
                      </span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>IV Access (Two 14G/16G Lines):</span>
                      <span className={`badge ${activeAssessment.ivAccessTwoWideBore ? 'ok' : 'warn'}`}>
                        {activeAssessment.ivAccessTwoWideBore ? 'SECURED' : 'PENDING'}
                      </span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>Oxytocin Infusion:</span>
                      <span className={`badge ${activeAssessment.oxytocinGiven ? 'ok' : 'warn'}`}>
                        {activeAssessment.oxytocinGiven ? (activeAssessment.oxytocinDoseRoute || 'GIVEN') : 'NOT GIVEN'}
                      </span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>Tranexamic Acid (TXA 1g IV):</span>
                      <span className={`badge ${activeAssessment.tranexamicAcidGiven ? 'ok' : 'warn'}`}>
                        {activeAssessment.tranexamicAcidGiven ? `GIVEN at ${activeAssessment.txaGivenAt || ''}` : 'NOT GIVEN'}
                      </span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>Methylergometrine (0.2mg IM):</span>
                      <span className={`badge ${activeAssessment.methylergometrineGiven ? 'ok' : activeAssessment.methergineContraindicated ? 'err' : 'warn'}`}>
                        {activeAssessment.methergineContraindicated ? 'CONTRAINDICATED (Hypertension)' : activeAssessment.methylergometrineGiven ? 'GIVEN' : 'OMITTED'}
                      </span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>Carboprost PGF2α (250mcg IM):</span>
                      <span className={`badge ${activeAssessment.carboprostGiven ? 'ok' : activeAssessment.carboprostContraindicated ? 'err' : 'warn'}`}>
                        {activeAssessment.carboprostContraindicated ? 'CONTRAINDICATED (Asthma)' : activeAssessment.carboprostGiven ? `${activeAssessment.carboprostDosesCount || 1} DOSE(S)` : 'OMITTED'}
                      </span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>Misoprostol (PGE1):</span>
                      <span className={`badge ${activeAssessment.misoprostolGiven ? 'ok' : 'warn'}`}>
                        {activeAssessment.misoprostolGiven ? `${activeAssessment.misoprostolDoseMcg || 800} mcg` : 'OMITTED'}
                      </span>
                    </div>
                    {activeAssessment.uterineTamponadeBalloonUsed && (
                      <div className="row" style={{ justifyContent: 'space-between', background: '#f0fdf4', padding: '0.3rem', borderRadius: '4px' }}>
                        <span>Bakri / Tamponade Balloon:</span>
                        <strong style={{ color: '#16a34a' }}>INSERTED ({activeAssessment.balloonFillVolumeMl} mL)</strong>
                      </div>
                    )}
                    {activeAssessment.mtpActivated && (
                      <div className="row" style={{ justifyContent: 'space-between', background: '#fef2f2', padding: '0.3rem', borderRadius: '4px' }}>
                        <span>Massive Transfusion (MTP):</span>
                        <strong style={{ color: '#dc2626' }}>ACTIVATED (PRBC: {activeAssessment.bloodUnitsTransfused}, FFP: {activeAssessment.ffpUnitsTransfused})</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chronological QBL Timeline Entries Table */}
              <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                    ⏱️ Chronological QBL &amp; Shock Index Resuscitation Timeline
                  </strong>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setShowTimelineModal(true)}
                    style={{ border: '1px solid #0284c7', color: '#0284c7' }}
                  >
                    ➕ Log Increment
                  </button>
                </div>

                {activeAssessment.timelineEntries && activeAssessment.timelineEntries.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '0.45rem' }}>Time</th>
                          <th style={{ padding: '0.45rem' }}>Increment Added</th>
                          <th style={{ padding: '0.45rem' }}>Cumulative QBL</th>
                          <th style={{ padding: '0.45rem' }}>Pulse / BP</th>
                          <th style={{ padding: '0.45rem' }}>Shock Index</th>
                          <th style={{ padding: '0.45rem' }}>Clinical Actions Taken</th>
                          <th style={{ padding: '0.45rem' }}>Logged By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeAssessment.timelineEntries.map((t) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.45rem' }}><strong>{t.loggedAt.slice(11, 16) || t.loggedAt}</strong></td>
                            <td style={{ padding: '0.45rem' }}>
                              +{(t.drapeIncrementMl || 0) + (t.spongeIncrementG || 0) + (t.clotsIncrementG || 0)} mL
                            </td>
                            <td style={{ padding: '0.45rem' }}>
                              <strong style={{ color: t.cumulativeQblMl >= 1000 ? '#dc2626' : '#0f172a' }}>
                                {t.cumulativeQblMl} mL
                              </strong>
                            </td>
                            <td style={{ padding: '0.45rem' }}>
                              {t.pulse ? `${t.pulse} bpm` : '—'} · {t.bpSystolic && t.bpDiastolic ? `${t.bpSystolic}/${t.bpDiastolic}` : '—'}
                            </td>
                            <td style={{ padding: '0.45rem' }}>
                              {t.shockIndex != null ? (
                                <span className={`badge ${t.shockIndex >= 1.0 ? 'err' : t.shockIndex >= 0.9 ? 'warn' : 'ok'}`} style={{ fontSize: '0.7rem' }}>
                                  {t.shockIndex}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '0.45rem' }}>{t.actionTaken || 'None'}</td>
                            <td style={{ padding: '0.45rem', color: '#64748b' }}>{t.loggedByName || 'Staff'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted small">No timeline increments logged yet. Click "Log Increment" to document ongoing QBL and vitals checks.</p>
                )}
              </div>

              {/* Clinical Details & Staff Sign-off Strip */}
              <div style={{ background: '#f8fafc', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span>Attending Obstetrician: <strong>{activeAssessment.attendingObstetrician || 'Not assigned'}</strong></span>
                    {activeAssessment.attendingAnesthetist && <span> · Anesthetist: <strong>{activeAssessment.attendingAnesthetist}</strong></span>}
                    {activeAssessment.nurseInCharge && <span> · Midwife/Nurse: <strong>{activeAssessment.nurseInCharge}</strong></span>}
                  </div>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => handleDeleteAssessment(activeAssessment.id)}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  >
                    ✕ Delete Assessment
                  </button>
                </div>
                {activeAssessment.notes && (
                  <div style={{ marginTop: '0.4rem', color: '#475569', fontStyle: 'italic' }}>
                    "{activeAssessment.notes}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: New PPH Assessment & QBL */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              background: '#ffffff',
              maxWidth: '750px',
              width: '100%',
              padding: '1.25rem',
              borderRadius: '8px',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#991b1b' }}>➕ Log Postpartum Hemorrhage &amp; QBL Assessment</h3>
              <button type="button" className="btn small" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            {Boolean(modalError) && <ErrorBanner error={modalError} />}

            <form onSubmit={handleSaveAssessment} className="stack" style={{ gap: '0.9rem' }}>
              {/* Delivery Context */}
              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Delivery Mode</label>
                  <select
                    className="input"
                    value={deliveryMode}
                    onChange={(e) => setDeliveryMode(e.target.value as any)}
                  >
                    <option value="vaginal">Normal Vaginal Delivery</option>
                    <option value="cesarean">Cesarean Section (LSCS)</option>
                    <option value="assisted_vacuum_forceps">Instrumental / Assisted (Vacuum/Forceps)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Delivery Timestamp</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={deliveryTimestamp}
                    onChange={(e) => setDeliveryTimestamp(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* 4T Etiology & Uterine Tone */}
              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Primary 4T Etiology</label>
                  <select
                    className="input"
                    value={primaryEtiology}
                    onChange={(e) => setPrimaryEtiology(e.target.value as any)}
                  >
                    <option value="tone_atony">Tone — Uterine Atony (~75%)</option>
                    <option value="trauma_laceration">Trauma — Cervical/Vaginal Laceration (~15%)</option>
                    <option value="tissue_retained">Tissue — Retained Placental Cotyledon/Membranes (~10%)</option>
                    <option value="thrombin_coagulopathy">Thrombin — Coagulopathy / DIC (~1%)</option>
                    <option value="mixed_unclear">Mixed / Multifactorial</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Uterine Tone Assessment</label>
                  <select
                    className="input"
                    value={uterineTone}
                    onChange={(e) => setUterineTone(e.target.value as any)}
                  >
                    <option value="soft_boggy">Soft &amp; Boggy (Atony)</option>
                    <option value="relaxing_between_massage">Relaxing Between Massage</option>
                    <option value="uncontracted">Uncontracted / Flaccid</option>
                    <option value="well_contracted_firm">Well Contracted &amp; Firm (Suspect Trauma)</option>
                  </select>
                </div>
              </div>

              {/* QBL Gravimetric & Volumetric Calculator Section */}
              <fieldset style={{ border: '1.5px solid #ef4444', borderRadius: '6px', padding: '0.8rem', background: '#fef2f2' }}>
                <legend style={{ fontWeight: 'bold', color: '#991b1b', padding: '0 0.4rem' }}>
                  ⚖️ Quantitative Blood Loss (QBL) Calculator (1g = 1mL)
                </legend>

                <div className="row wrap" style={{ gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label className="label" style={{ fontSize: '0.78rem' }}>Calibrated V-Drape (mL)</label>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      value={calibratedDrapeMl}
                      onChange={(e) => setCalibratedDrapeMl(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label className="label" style={{ fontSize: '0.78rem' }}>Suction Canister (mL)</label>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      value={suctionCanisterMl}
                      onChange={(e) => setSuctionCanisterMl(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label className="label" style={{ fontSize: '0.78rem' }}>Sponges Wet (g)</label>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      value={spongesWetG}
                      onChange={(e) => setSpongesWetG(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label className="label" style={{ fontSize: '0.78rem' }}>Dry Tare (g)</label>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      value={spongesDryG}
                      onChange={(e) => setSpongesDryG(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label className="label" style={{ fontSize: '0.78rem' }}>Clots Weighed (g)</label>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      value={clotsG}
                      onChange={(e) => setClotsG(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: '4px', border: '1px solid #fecaca' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem' }}>Visual EBL (Optional):</span>{' '}
                    <input
                      type="number"
                      className="input"
                      style={{ width: '90px', display: 'inline-block', padding: '0.2rem 0.4rem' }}
                      value={visualEblMl}
                      placeholder="e.g. 500"
                      onChange={(e) => setVisualEblMl(e.target.value)}
                    />
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="muted small">Calculated Total QBL:</span>{' '}
                    <strong style={{ fontSize: '1.25rem', color: '#b91c1c' }}>{modalQblCalc.totalQblMl} mL</strong>
                  </div>
                </div>
              </fieldset>

              {/* Hemodynamics & Shock Index */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem' }}>
                <legend style={{ fontWeight: 'bold', color: '#1e293b', padding: '0 0.4rem' }}>
                  💓 Maternal Vitals &amp; Obstetric Shock Index (OSI)
                </legend>

                <div className="row wrap" style={{ gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label className="label">Maternal Pulse (bpm)</label>
                    <input
                      type="number"
                      className="input"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label className="label">Systolic BP (mmHg)</label>
                    <input
                      type="number"
                      className="input"
                      value={sbp}
                      onChange={(e) => setSbp(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label className="label">Diastolic BP (mmHg)</label>
                    <input
                      type="number"
                      className="input"
                      value={dbp}
                      onChange={(e) => setDbp(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '80px' }}>
                    <label className="label">SpO2 (%)</label>
                    <input
                      type="number"
                      className="input"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: 1.5, background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '170px' }}>
                    <div className="muted small">Calculated Shock Index:</div>
                    <strong style={{ fontSize: '1.1rem', color: modalShockIndexCalc.shockIndex != null && modalShockIndexCalc.shockIndex >= 1.0 ? '#dc2626' : '#16a34a' }}>
                      {modalShockIndexCalc.shockIndex != null ? modalShockIndexCalc.shockIndex : '—'}
                    </strong>{' '}
                    <span className={modalShockIndexCalc.badgeClass} style={{ fontSize: '0.68rem' }}>
                      {modalShockIndexCalc.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
              </fieldset>

              {/* Uterotonics Checklist */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem' }}>
                <legend style={{ fontWeight: 'bold', color: '#1e293b', padding: '0 0.4rem' }}>
                  💉 Medical Resuscitation &amp; Uterotonics
                </legend>

                <div className="row wrap" style={{ gap: '1rem', marginBottom: '0.6rem' }}>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bimanualCompression}
                      onChange={(e) => setBimanualCompression(e.target.checked)}
                    />
                    <span className="small">Bimanual Massage</span>
                  </label>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bladderCath}
                      onChange={(e) => setBladderCath(e.target.checked)}
                    />
                    <span className="small">Foley Catheter</span>
                  </label>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={ivAccessWide}
                      onChange={(e) => setIvAccessWide(e.target.checked)}
                    />
                    <span className="small">2 Wide-Bore IVs</span>
                  </label>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={oxytocinGiven}
                      onChange={(e) => setOxytocinGiven(e.target.checked)}
                    />
                    <span className="small">Oxytocin Infusion</span>
                  </label>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={txaGiven}
                      onChange={(e) => setTxaGiven(e.target.checked)}
                    />
                    <span className="small">Tranexamic Acid (1g IV)</span>
                  </label>
                </div>

                {/* Contraindication alerts */}
                <div className="row wrap" style={{ gap: '0.75rem', marginTop: '0.4rem' }}>
                  <div style={{ flex: 1, minWidth: '220px', background: !uterotonicSafety.methergineSafe ? '#fef2f2' : '#ffffff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    <label className="row" style={{ gap: '0.3rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={methergineGiven}
                        disabled={!uterotonicSafety.methergineSafe}
                        onChange={(e) => setMethergineGiven(e.target.checked)}
                      />
                      <strong className="small">Methylergometrine (Methergine 0.2mg)</strong>
                    </label>
                    {!uterotonicSafety.methergineSafe && (
                      <div className="small" style={{ color: '#dc2626', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                        ⚠️ CONTRAINDICATED (Hypertension / Pre-eclampsia)
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: '220px', background: !uterotonicSafety.carboprostSafe ? '#fef2f2' : '#ffffff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    <label className="row" style={{ gap: '0.3rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={carboprostGiven}
                        disabled={!uterotonicSafety.carboprostSafe}
                        onChange={(e) => setCarboprostGiven(e.target.checked)}
                      />
                      <strong className="small">Carboprost PGF2α (250mcg IM)</strong>
                    </label>
                    <label className="row" style={{ gap: '0.3rem', alignItems: 'center', marginTop: '0.2rem' }}>
                      <input
                        type="checkbox"
                        checked={carboprostContraindicated}
                        onChange={(e) => setCarboprostContraindicated(e.target.checked)}
                      />
                      <span className="small" style={{ fontSize: '0.72rem', color: '#991b1b' }}>Patient has Asthma (Contraindicated)</span>
                    </label>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={misoprostolGiven}
                      onChange={(e) => setMisoprostolGiven(e.target.checked)}
                    />
                    <span className="small">Misoprostol (800mcg)</span>
                  </label>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={balloonUsed}
                      onChange={(e) => setBalloonUsed(e.target.checked)}
                    />
                    <span className="small">Bakri / Tamponade Balloon</span>
                  </label>
                  <label className="row" style={{ gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={mtpActivated}
                      onChange={(e) => setMtpActivated(e.target.checked)}
                    />
                    <span className="small" style={{ color: '#dc2626', fontWeight: 'bold' }}>Activate MTP (1:1:1 Transfusion)</span>
                  </label>
                </div>
              </fieldset>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving} style={{ background: '#dc2626', borderColor: '#b91c1c' }}>
                  {saving ? 'Saving...' : 'Save PPH Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Timeline Increment */}
      {showTimelineModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              background: '#ffffff',
              maxWidth: '500px',
              width: '100%',
              padding: '1.25rem',
              borderRadius: '8px',
            }}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>⏱️ Log QBL Increment &amp; Vitals</h3>
              <button type="button" className="btn small" onClick={() => setShowTimelineModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTimelineEntry} className="stack" style={{ gap: '0.8rem' }}>
              <div className="row wrap" style={{ gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Drape + Canister (mL)</label>
                  <input
                    type="number"
                    className="input"
                    value={timelineDrapeInc}
                    onChange={(e) => setTimelineDrapeInc(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Sponges Net (g)</label>
                  <input
                    type="number"
                    className="input"
                    value={timelineSpongeInc}
                    onChange={(e) => setTimelineSpongeInc(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Clots Weighed (g)</label>
                  <input
                    type="number"
                    className="input"
                    value={timelineClotsInc}
                    onChange={(e) => setTimelineClotsInc(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Pulse (bpm)</label>
                  <input
                    type="number"
                    className="input"
                    value={timelinePulse}
                    onChange={(e) => setTimelinePulse(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Systolic BP</label>
                  <input
                    type="number"
                    className="input"
                    value={timelineSbp}
                    onChange={(e) => setTimelineSbp(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Diastolic BP</label>
                  <input
                    type="number"
                    className="input"
                    value={timelineDbp}
                    onChange={(e) => setTimelineDbp(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Clinical Action Taken</label>
                <input
                  type="text"
                  className="input"
                  value={timelineAction}
                  placeholder="e.g. TXA 1g IV infused; Bakri balloon placed"
                  onChange={(e) => setTimelineAction(e.target.value)}
                />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowTimelineModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Adding...' : 'Add Increment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
