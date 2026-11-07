import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type ContraceptiveCounselingRecord,
  type IucdInsertionRecord,
} from '../api';
import {
  evaluateWhoMec,
  calculateIucdLifespanAndExpiry,
  evaluateFollowupFindings,
  MEDICAL_CONDITIONS_LIST,
  IUCD_DEVICE_PROPERTIES,
  type ContraceptiveMethod,
} from '../contraceptionEngine';

interface Props {
  patientId: number;
}

export function ContraceptionTracker({ patientId }: Props) {
  const [counselings, setCounselings] = useState<ContraceptiveCounselingRecord[]>([]);
  const [insertions, setInsertions] = useState<IucdInsertionRecord[]>([]);
  const [selectedInsertionId, setSelectedInsertionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'iucd_registry' | 'who_mec_counseling'>('iucd_registry');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showCounselingModal, setShowCounselingModal] = useState(false);
  const [showInsertionModal, setShowInsertionModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showRemovalModal, setShowRemovalModal] = useState(false);

  // Counseling Form State
  const [counselingForm, setCounselingForm] = useState({
    counselingDate: new Date().toISOString().slice(0, 10),
    reproductivePlan: 'spacing_pregnancies',
    desiredSpacingYears: '3.0',
    breastfeedingStatus: 'exclusive_breastfeeding_lt_6w',
    selectedConditions: [] as string[],
    chosenMethod: 'cu_t_380a',
    methodRationale: '',
    prescribedUnits: '',
    nextFollowupDate: '',
  });

  // Insertion Form State
  const [insertionForm, setInsertionForm] = useState({
    deviceType: 'cu_t_380a',
    deviceBrandName: 'Pregna TCu380A',
    lotBatchNumber: '',
    deviceExpiryDate: '',
    insertionTiming: 'interval_extended_gt_6w',
    insertionDate: new Date().toISOString().slice(0, 10),
    insertionTime: '11:00',
    insertedBy: '',
    uterineDepthCm: '7.5',
    analgesiaUsed: 'none',
    threadLengthCutCm: '3.0',
    insertionEase: 'smooth',
    complications: 'none',
    postInsertionUltrasound: 'fundal_position_confirmed',
    clinicalNotes: '',
  });

  // Follow-up Form State
  const [followupForm, setFollowupForm] = useState({
    followupDate: new Date().toISOString().slice(0, 10),
    visitInterval: '6_weeks_post_insertion',
    threadStatus: 'threads_visible_normal',
    pelvicUltrasoundDone: false,
    ultrasoundFinding: 'normal_fundal',
    bleedingPattern: 'normal_regular',
    pelvicPainScore: 0,
    signsOfInfection: false,
    actionTaken: 'continue_in_situ_reassured',
    clinicalNotes: '',
  });

  // Removal Form State
  const [removalForm, setRemovalForm] = useState({
    status: 'removed_patient_request',
    removalDate: new Date().toISOString().slice(0, 10),
    removalReason: 'Patient desires pregnancy / fertility restoration',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cRes, iRes] = await Promise.all([
        api<{ records: ContraceptiveCounselingRecord[] }>('GET', `/api/patients/${patientId}/contraception/counselings`),
        api<{ insertions: IucdInsertionRecord[] }>('GET', `/api/patients/${patientId}/contraception/iucd-insertions`),
      ]);

      setCounselings(cRes.records || []);
      setInsertions(iRes.insertions || []);

      if (iRes.insertions && iRes.insertions.length > 0) {
        if (!selectedInsertionId || !iRes.insertions.some((i) => i.id === selectedInsertionId)) {
          setSelectedInsertionId(iRes.insertions[0]!.id);
        }
      } else {
        setSelectedInsertionId(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contraception records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const activeInsertion = useMemo(
    () => insertions.find((i) => i.id === selectedInsertionId) || insertions[0] || null,
    [insertions, selectedInsertionId],
  );

  // Live WHO MEC calculation in counseling modal
  const liveMec = useMemo(() => {
    const conds = [...counselingForm.selectedConditions];
    if (counselingForm.breastfeedingStatus === 'exclusive_breastfeeding_lt_6w') conds.push('breastfeeding_lt_6w');
    if (counselingForm.breastfeedingStatus === 'exclusive_breastfeeding_6w_6m') conds.push('breastfeeding_6w_6m');
    return evaluateWhoMec(conds);
  }, [counselingForm.selectedConditions, counselingForm.breastfeedingStatus]);

  const toggleCondition = (key: string) => {
    setCounselingForm((prev) => {
      const exists = prev.selectedConditions.includes(key);
      return {
        ...prev,
        selectedConditions: exists
          ? prev.selectedConditions.filter((k) => k !== key)
          : [...prev.selectedConditions, key],
      };
    });
  };

  const handleSaveCounseling = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await api('POST', `/api/patients/${patientId}/contraception/counselings`, {
        counselingDate: counselingForm.counselingDate,
        reproductivePlan: counselingForm.reproductivePlan,
        desiredSpacingYears: counselingForm.desiredSpacingYears ? Number(counselingForm.desiredSpacingYears) : null,
        breastfeedingStatus: counselingForm.breastfeedingStatus,
        medicalConditions: counselingForm.selectedConditions,
        chosenMethod: counselingForm.chosenMethod,
        methodRationale: counselingForm.methodRationale,
        prescribedUnits: counselingForm.prescribedUnits,
        nextFollowupDate: counselingForm.nextFollowupDate || null,
      });

      setSuccessMsg('Contraceptive counseling session recorded with WHO MEC evaluation.');
      setShowCounselingModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save counseling record');
    }
  };

  const handleSaveInsertion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const res = await api<{ id: number }>('POST', `/api/patients/${patientId}/contraception/iucd-insertions`, {
        deviceType: insertionForm.deviceType,
        deviceBrandName: insertionForm.deviceBrandName || null,
        lotBatchNumber: insertionForm.lotBatchNumber || null,
        deviceExpiryDate: insertionForm.deviceExpiryDate || null,
        insertionTiming: insertionForm.insertionTiming,
        insertionDate: insertionForm.insertionDate,
        insertionTime: insertionForm.insertionTime || null,
        insertedBy: insertionForm.insertedBy,
        uterineDepthCm: insertionForm.uterineDepthCm ? Number(insertionForm.uterineDepthCm) : null,
        analgesiaUsed: insertionForm.analgesiaUsed,
        threadLengthCutCm: insertionForm.threadLengthCutCm ? Number(insertionForm.threadLengthCutCm) : null,
        insertionEase: insertionForm.insertionEase,
        complications: insertionForm.complications,
        postInsertionUltrasound: insertionForm.postInsertionUltrasound,
        clinicalNotes: insertionForm.clinicalNotes || null,
      });

      setSuccessMsg('IUCD insertion record logged successfully.');
      setShowInsertionModal(false);
      await loadData();
      setSelectedInsertionId(res.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save IUCD insertion');
    }
  };

  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInsertion) return;
    try {
      setError(null);
      await api(
        'POST',
        `/api/patients/${patientId}/contraception/iucd-insertions/${activeInsertion.id}/followups`,
        {
          followupDate: followupForm.followupDate,
          visitInterval: followupForm.visitInterval,
          threadStatus: followupForm.threadStatus,
          pelvicUltrasoundDone: followupForm.pelvicUltrasoundDone,
          ultrasoundFinding: followupForm.pelvicUltrasoundDone ? followupForm.ultrasoundFinding : null,
          bleedingPattern: followupForm.bleedingPattern,
          pelvicPainScore: Number(followupForm.pelvicPainScore),
          signsOfInfection: followupForm.signsOfInfection,
          actionTaken: followupForm.actionTaken,
          clinicalNotes: followupForm.clinicalNotes || null,
        },
      );

      setSuccessMsg('IUCD thread check & follow-up visit logged.');
      setShowFollowupModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log follow-up check');
    }
  };

  const handleUpdateRemoval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInsertion) return;
    try {
      setError(null);
      await api(
        'PUT',
        `/api/patients/${patientId}/contraception/iucd-insertions/${activeInsertion.id}`,
        {
          deviceType: activeInsertion.device_type,
          insertionTiming: activeInsertion.insertion_timing,
          insertionDate: activeInsertion.insertion_date,
          insertedBy: activeInsertion.inserted_by,
          status: removalForm.status,
          removalDate: removalForm.removalDate,
          removalReason: removalForm.removalReason,
          clinicalNotes: activeInsertion.clinical_notes,
        },
      );

      setSuccessMsg('IUCD status updated.');
      setShowRemovalModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update removal status');
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="muted">Loading contraception and IUCD records…</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      {/* Alert Notices */}
      {error && (
        <div className="banner error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
      {successMsg && (
        <div className="banner info" role="status">
          {successMsg}
        </div>
      )}

      {/* Main Header Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)',
          border: '1px solid #99f6e4',
          padding: '1.25rem',
        }}
      >
        <div className="row wrap between middle" style={{ gap: '0.8rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.3rem 0', color: '#0d9488', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🪢</span> Contraception Counseling &amp; Postpartum / Interval IUCD Registry
            </h2>
            <p className="muted small" style={{ margin: 0 }}>
              WHO Medical Eligibility Criteria (MEC Categories 1–4), Postpartum PPIUCD (Post-Placental / Post-Cesarean), Copper-T 380A &amp; LNG-IUS (Mirena) Surveillance
            </p>
          </div>
          <div className="row wrap" style={{ gap: '0.5rem' }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setInsertionForm({
                  deviceType: 'cu_t_380a',
                  deviceBrandName: 'Pregna TCu380A',
                  lotBatchNumber: '',
                  deviceExpiryDate: '',
                  insertionTiming: 'post_cesarean_intracesarean',
                  insertionDate: new Date().toISOString().slice(0, 10),
                  insertionTime: '10:00',
                  insertedBy: '',
                  uterineDepthCm: '8.0',
                  analgesiaUsed: 'none',
                  threadLengthCutCm: '3.5',
                  insertionEase: 'smooth',
                  complications: 'none',
                  postInsertionUltrasound: 'fundal_position_confirmed',
                  clinicalNotes: '',
                });
                setShowInsertionModal(true);
              }}
            >
              + Log IUCD Insertion
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCounselingForm({
                  counselingDate: new Date().toISOString().slice(0, 10),
                  reproductivePlan: 'spacing_pregnancies',
                  desiredSpacingYears: '3.0',
                  breastfeedingStatus: 'exclusive_breastfeeding_lt_6w',
                  selectedConditions: [],
                  chosenMethod: 'cu_t_380a',
                  methodRationale: '',
                  prescribedUnits: '',
                  nextFollowupDate: '',
                });
                setShowCounselingModal(true);
              }}
            >
              📋 Contraceptive Counseling Session
            </button>
            <button type="button" className="btn small" onClick={() => void loadData()}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* View Toggle Bar */}
        <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid #ccfbf1', display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn small ${activeTab === 'iucd_registry' ? 'primary' : ''}`}
            onClick={() => setActiveTab('iucd_registry')}
          >
            🪢 IUCD Insertion &amp; Follow-up Registry ({insertions.length})
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'who_mec_counseling' ? 'primary' : ''}`}
            onClick={() => setActiveTab('who_mec_counseling')}
          >
            🧭 WHO MEC Counseling Sessions ({counselings.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: IUCD Insertion & Follow-Up Registry */}
      {activeTab === 'iucd_registry' && (
        <div className="stack" style={{ gap: '1rem' }}>
          {insertions.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center', background: '#fafafa' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🪢</div>
              <h3>No IUCD Insertions Logged Yet</h3>
              <p className="muted small" style={{ maxWidth: '500px', margin: '0 auto 1.2rem auto' }}>
                Record Postpartum IUCD (PPIUCD post-placental or post-cesarean) or interval Cu-T 380A / LNG-IUS insertions, track serial thread checks, and monitor retention.
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={() => setShowInsertionModal(true)}
              >
                Log First IUCD Insertion
              </button>
            </div>
          ) : (
            <div className="stack" style={{ gap: '1rem' }}>
              {/* Insertion Selection Selector */}
              {insertions.length > 1 && (
                <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
                  <span className="muted small">Device History:</span>
                  {insertions.map((ins) => (
                    <button
                      key={ins.id}
                      type="button"
                      className={`btn small ${activeInsertion?.id === ins.id ? 'primary' : ''}`}
                      onClick={() => setSelectedInsertionId(ins.id)}
                    >
                      {ins.device_brand_name || ins.device_type.toUpperCase()} ({ins.insertion_date}) • {ins.status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}

              {activeInsertion && (
                <>
                  {/* Active Device Dashboard Card */}
                  <div
                    className="card"
                    style={{
                      borderLeft: `6px solid ${
                        activeInsertion.status === 'in_situ'
                          ? '#0d9488'
                          : activeInsertion.status.includes('expelled')
                          ? '#ef4444'
                          : '#64748b'
                      }`,
                    }}
                  >
                    <div className="row wrap between middle" style={{ marginBottom: '0.8rem' }}>
                      <div className="row middle" style={{ gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🪢</span>
                        <div>
                          <h3 style={{ margin: 0 }}>
                            {activeInsertion.device_brand_name || activeInsertion.device_type.toUpperCase()}
                          </h3>
                          <div className="muted small">
                            Inserted on {activeInsertion.insertion_date} by {activeInsertion.inserted_by}
                          </div>
                        </div>
                      </div>

                      <div className="row middle" style={{ gap: '0.5rem' }}>
                        <span
                          className={`tag bold ${
                            activeInsertion.status === 'in_situ'
                              ? 'success'
                              : activeInsertion.status.includes('expelled')
                              ? 'error'
                              : 'muted'
                          }`}
                          style={{ textTransform: 'uppercase', fontSize: '0.82rem' }}
                        >
                          {activeInsertion.status.replace(/_/g, ' ')}
                        </span>
                        <NavLink
                          to={`/patients/${patientId}/contraception/iucd/${activeInsertion.id}/print`}
                          className="btn small"
                        >
                          🖨️ Print IUD Card
                        </NavLink>
                        {activeInsertion.status === 'in_situ' && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => {
                              setRemovalForm({
                                status: 'removed_patient_request',
                                removalDate: new Date().toISOString().slice(0, 10),
                                removalReason: 'Patient desires pregnancy',
                              });
                              setShowRemovalModal(true);
                            }}
                          >
                            Update Status / Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Device Specs Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.8rem',
                        background: '#f8fafc',
                        padding: '0.8rem 1rem',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <span className="muted">Insertion Timing:</span>
                        <div className="bold" style={{ textTransform: 'capitalize' }}>
                          {activeInsertion.insertion_timing.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div>
                        <span className="muted">Lifespan &amp; Expiry:</span>
                        <div className="bold" style={{ color: '#0d9488' }}>
                          {activeInsertion.lifespan_years} Years (Due: {activeInsertion.expected_removal_date})
                        </div>
                      </div>
                      <div>
                        <span className="muted">Uterine Sound Depth:</span>
                        <div className="bold">{activeInsertion.uterine_depth_cm ? `${activeInsertion.uterine_depth_cm} cm` : '—'}</div>
                      </div>
                      <div>
                        <span className="muted">String Length Cut:</span>
                        <div className="bold">{activeInsertion.thread_length_cut_cm ? `${activeInsertion.thread_length_cut_cm} cm` : '—'}</div>
                      </div>
                      <div>
                        <span className="muted">Insertion Ease:</span>
                        <div className="bold" style={{ textTransform: 'capitalize' }}>{activeInsertion.insertion_ease.replace(/_/g, ' ')}</div>
                      </div>
                      <div>
                        <span className="muted">Post-Insertion USG:</span>
                        <div className="bold" style={{ textTransform: 'capitalize' }}>{activeInsertion.post_insertion_ultrasound.replace(/_/g, ' ')}</div>
                      </div>
                    </div>

                    {activeInsertion.clinical_notes && (
                      <p className="muted small" style={{ margin: '0.8rem 0 0 0' }}>
                        <strong>Operator Notes:</strong> {activeInsertion.clinical_notes}
                      </p>
                    )}

                    {activeInsertion.removal_date && (
                      <div className="banner warn small" style={{ marginTop: '0.8rem', marginBlockEnd: 0 }}>
                        <strong>Removal Recorded:</strong> {activeInsertion.removal_date} — {activeInsertion.removal_reason || 'No reason specified'}
                      </div>
                    )}
                  </div>

                  {/* Follow-Up Surveillance & Thread Checks */}
                  <div className="card stack" style={{ gap: '0.8rem' }}>
                    <div className="row wrap between middle" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>
                          Thread Checks &amp; Clinical Follow-Ups ({activeInsertion.followups?.length || 0})
                        </h4>
                        <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
                          Scheduled 6-week, 6-month, and annual surveillance for thread visibility, bleeding patterns, and expulsion checks
                        </p>
                      </div>
                      {activeInsertion.status === 'in_situ' && (
                        <button
                          type="button"
                          className="btn small primary"
                          onClick={() => {
                            setFollowupForm({
                              followupDate: new Date().toISOString().slice(0, 10),
                              visitInterval: '6_weeks_post_insertion',
                              threadStatus: 'threads_visible_normal',
                              pelvicUltrasoundDone: false,
                              ultrasoundFinding: 'normal_fundal',
                              bleedingPattern: 'normal_regular',
                              pelvicPainScore: 0,
                              signsOfInfection: false,
                              actionTaken: 'continue_in_situ_reassured',
                              clinicalNotes: '',
                            });
                            setShowFollowupModal(true);
                          }}
                        >
                          + Record Thread Check / Visit
                        </button>
                      )}
                    </div>

                    {(!activeInsertion.followups || activeInsertion.followups.length === 0) ? (
                      <p className="muted small" style={{ margin: '0.5rem 0' }}>
                        No follow-up visits recorded yet. Routine follow-up is recommended at 6 weeks post-insertion or at first menses.
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Interval</th>
                              <th>Thread Status</th>
                              <th>Bleeding Pattern</th>
                              <th>Pain (0–10)</th>
                              <th>USG Verification</th>
                              <th>Action Taken</th>
                              <th>Examiner</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeInsertion.followups.map((f) => (
                              <tr key={f.id}>
                                <td><strong>{f.followup_date}</strong></td>
                                <td style={{ textTransform: 'capitalize' }}>{f.visit_interval.replace(/_/g, ' ')}</td>
                                <td>
                                  <span
                                    className={`tag small bold ${
                                      f.thread_status === 'threads_visible_normal'
                                        ? 'success'
                                        : 'error'
                                    }`}
                                  >
                                    {f.thread_status.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td style={{ textTransform: 'capitalize' }}>{f.bleeding_pattern.replace(/_/g, ' ')}</td>
                                <td>{f.pelvic_pain_score} / 10</td>
                                <td>
                                  {f.pelvic_ultrasound_done ? (
                                    <span className="tag small">{f.ultrasound_finding?.replace(/_/g, ' ')}</span>
                                  ) : (
                                    <span className="muted">Not done</span>
                                  )}
                                </td>
                                <td>{f.action_taken.replace(/_/g, ' ')}</td>
                                <td className="small muted">{f.examined_by_name || 'Staff'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: WHO MEC Counseling Sessions */}
      {activeTab === 'who_mec_counseling' && (
        <div className="stack" style={{ gap: '1rem' }}>
          {counselings.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center', background: '#fafafa' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🧭</div>
              <h3>No Counseling Sessions Recorded</h3>
              <p className="muted small" style={{ maxWidth: '500px', margin: '0 auto 1.2rem auto' }}>
                Use the WHO Medical Eligibility Criteria decision engine to evaluate safety across hormonal, intrauterine, barrier, and permanent contraceptive methods.
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={() => setShowCounselingModal(true)}
              >
                Log Contraceptive Counseling Session
              </button>
            </div>
          ) : (
            <div className="stack" style={{ gap: '1rem' }}>
              {counselings.map((c) => (
                <div key={c.id} className="card stack" style={{ gap: '0.8rem' }}>
                  <div className="row wrap between middle" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <div>
                      <span className="bold" style={{ fontSize: '1rem', marginRight: '0.6rem' }}>
                        Counseling Date: {c.counseling_date}
                      </span>
                      <span className="tag small primary">
                        Chosen: {c.chosen_method.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="tag small muted" style={{ marginLeft: '0.4rem', textTransform: 'capitalize' }}>
                        Plan: {c.reproductive_plan.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="small muted">Counseled by: {c.counseled_by_name || 'Doctor'}</span>
                  </div>

                  {c.method_rationale && (
                    <div style={{ fontSize: '0.9rem', color: '#334155' }}>
                      <strong>Clinical Rationale:</strong> {c.method_rationale}
                    </div>
                  )}

                  {/* Conditions Tag List */}
                  {c.medical_conditions && c.medical_conditions.length > 0 && (
                    <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
                      <span className="muted small">Assessed Factors:</span>
                      {c.medical_conditions.map((k) => (
                        <span key={k} className="tag small" style={{ background: '#fef3c7', color: '#92400e' }}>
                          {MEDICAL_CONDITIONS_LIST.find((m) => m.key === k)?.label || k.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Eligibility Matrix Summary */}
                  {c.eligibility_results && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.6rem',
                        marginTop: '0.4rem',
                      }}
                    >
                      {Object.values(c.eligibility_results).map((item) => (
                        <div
                          key={item.method}
                          style={{
                            padding: '0.6rem',
                            borderRadius: '4px',
                            border: `1px solid ${
                              item.category === 1
                                ? '#a7f3d0'
                                : item.category === 2
                                ? '#bae6fd'
                                : item.category === 3
                                ? '#fde68a'
                                : '#fecaca'
                            }`,
                            background:
                              item.category === 1
                                ? '#ecfdf5'
                                : item.category === 2
                                ? '#f0f9ff'
                                : item.category === 3
                                ? '#fffbeb'
                                : '#fef2f2',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div className="row between middle" style={{ marginBottom: '0.2rem' }}>
                            <span className="bold">{item.name.split(' (')[0]}</span>
                            <span
                              className="tag small bold"
                              style={{
                                background:
                                  item.category === 1
                                    ? '#10b981'
                                    : item.category === 2
                                    ? '#0284c7'
                                    : item.category === 3
                                    ? '#f59e0b'
                                    : '#ef4444',
                                color: '#fff',
                              }}
                            >
                              MEC {item.category}
                            </span>
                          </div>
                          <div className="muted small" style={{ fontSize: '0.74rem' }}>
                            {item.reasons[0] || item.clinicalNotes}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: WHO MEC Contraceptive Counseling Session */}
      {showCounselingModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="row between middle" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Contraceptive Counseling &amp; WHO MEC Assessment</h3>
              <button type="button" className="btn small" onClick={() => setShowCounselingModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveCounseling} className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
              <div className="row wrap" style={{ gap: '1rem' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label htmlFor="counselingDate">Counseling Date *</label>
                  <input
                    id="counselingDate"
                    type="date"
                    required
                    value={counselingForm.counselingDate}
                    onChange={(e) => setCounselingForm({ ...counselingForm, counselingDate: e.target.value })}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="reproductivePlan">Reproductive Goal</label>
                  <select
                    id="reproductivePlan"
                    value={counselingForm.reproductivePlan}
                    onChange={(e) => setCounselingForm({ ...counselingForm, reproductivePlan: e.target.value })}
                  >
                    <option value="spacing_pregnancies">Spacing Pregnancies (Temporary)</option>
                    <option value="limiting_completed_family">Limiting (Completed Desired Family Size)</option>
                    <option value="delaying_first_pregnancy">Delaying First Pregnancy</option>
                    <option value="undecided">Undecided</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="desiredSpacingYears">Desired Spacing (Yrs)</label>
                  <input
                    id="desiredSpacingYears"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="15"
                    value={counselingForm.desiredSpacingYears}
                    onChange={(e) => setCounselingForm({ ...counselingForm, desiredSpacingYears: e.target.value })}
                  />
                </div>
                <div style={{ flex: '1 1 220px' }}>
                  <label htmlFor="breastfeedingStatus">Lactation Status</label>
                  <select
                    id="breastfeedingStatus"
                    value={counselingForm.breastfeedingStatus}
                    onChange={(e) => setCounselingForm({ ...counselingForm, breastfeedingStatus: e.target.value })}
                  >
                    <option value="exclusive_breastfeeding_lt_6w">Exclusive Breastfeeding (&lt; 6 weeks postpartum)</option>
                    <option value="exclusive_breastfeeding_6w_6m">Breastfeeding (6 weeks to 6 months)</option>
                    <option value="partial_breastfeeding">Partial Breastfeeding</option>
                    <option value="not_breastfeeding">Not Breastfeeding</option>
                  </select>
                </div>
              </div>

              {/* Medical Conditions Assessment Checklist */}
              <div className="card stack" style={{ background: '#f8fafc', gap: '0.6rem' }}>
                <span className="bold">Select Medical Conditions &amp; Risk Factors:</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  {MEDICAL_CONDITIONS_LIST.map((m) => {
                    const active = counselingForm.selectedConditions.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.4rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          margin: 0,
                          padding: '0.3rem 0.5rem',
                          borderRadius: '4px',
                          background: active ? '#fef3c7' : '#fff',
                          border: `1px solid ${active ? '#f59e0b' : '#e2e8f0'}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCondition(m.key)}
                          style={{ marginTop: '2px' }}
                        />
                        <span>{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Real-time WHO MEC Eligibility Output */}
              <div className="card stack" style={{ gap: '0.6rem' }}>
                <span className="bold">Real-time WHO MEC 5th Edition Method Recommendations:</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '0.6rem',
                  }}
                >
                  {Object.values(liveMec).map((res) => (
                    <div
                      key={res.method}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '4px',
                        border: `1.5px solid ${
                          res.category === 1
                            ? '#10b981'
                            : res.category === 2
                            ? '#0284c7'
                            : res.category === 3
                            ? '#f59e0b'
                            : '#ef4444'
                        }`,
                        background:
                          res.category === 1
                            ? '#f0fdf4'
                            : res.category === 2
                            ? '#f0f9ff'
                            : res.category === 3
                            ? '#fffbeb'
                            : '#fef2f2',
                      }}
                    >
                      <div className="row between middle" style={{ marginBottom: '0.2rem' }}>
                        <span className="bold small">{res.name}</span>
                        <span
                          className="tag small bold"
                          style={{
                            background:
                              res.category === 1
                                ? '#10b981'
                                : res.category === 2
                                ? '#0284c7'
                                : res.category === 3
                                ? '#f59e0b'
                                : '#ef4444',
                            color: '#fff',
                          }}
                        >
                          MEC {res.category}
                        </span>
                      </div>
                      <div className="small muted" style={{ fontSize: '0.75rem' }}>
                        {res.reasons[0] || res.clinicalNotes}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chosen Method and Rationale */}
              <div className="row wrap" style={{ gap: '1rem' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label htmlFor="chosenMethod">Agreed Contraceptive Method *</label>
                  <select
                    id="chosenMethod"
                    value={counselingForm.chosenMethod}
                    onChange={(e) => setCounselingForm({ ...counselingForm, chosenMethod: e.target.value })}
                  >
                    <option value="cu_t_380a">Copper-T 380A (PPIUCD / Interval)</option>
                    <option value="lng_ius">LNG-IUS 52mg (Mirena)</option>
                    <option value="pop_mini_pill">Progestin-Only Pill (POP)</option>
                    <option value="coc_pills">Combined Oral Contraceptive (COC)</option>
                    <option value="dmpa_injectable">DMPA Injectable (Depo / Antara)</option>
                    <option value="subdermal_implant">Subdermal Implant</option>
                    <option value="barrier_condoms">Male / Female Condoms</option>
                    <option value="tubal_ligation">Permanent Sterilization (Tubectomy)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="prescribedUnits">Units / Quantity Dispensed</label>
                  <input
                    id="prescribedUnits"
                    type="text"
                    value={counselingForm.prescribedUnits}
                    onChange={(e) => setCounselingForm({ ...counselingForm, prescribedUnits: e.target.value })}
                    placeholder="e.g. 1 device inserted, 3 cycles of pills, 1 vial 150mg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="methodRationale">Clinical Rationale &amp; Client Counseling Notes</label>
                <textarea
                  id="methodRationale"
                  rows={2}
                  value={counselingForm.methodRationale}
                  onChange={(e) => setCounselingForm({ ...counselingForm, methodRationale: e.target.value })}
                  placeholder="Document client preferences, informed consent, explanation of side effects, and warning signs..."
                />
              </div>

              <div className="row end" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowCounselingModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Counseling Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Log IUCD Insertion Procedure */}
      {showInsertionModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="row between middle" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Log Intrauterine Device (IUCD / LNG-IUS) Insertion</h3>
              <button type="button" className="btn small" onClick={() => setShowInsertionModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveInsertion} className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
              <div className="row wrap" style={{ gap: '0.8rem' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label htmlFor="deviceType">Device Type *</label>
                  <select
                    id="deviceType"
                    value={insertionForm.deviceType}
                    onChange={(e) => setInsertionForm({ ...insertionForm, deviceType: e.target.value })}
                  >
                    <option value="cu_t_380a">Copper-T 380A (10-year lifespan)</option>
                    <option value="cu_t_375">Multiload Cu-375 (5-year lifespan)</option>
                    <option value="lng_ius_52mg_mirena">LNG-IUS 52mg Mirena (8-year lifespan)</option>
                    <option value="lng_ius_19_5mg_kyleena">LNG-IUS 19.5mg Kyleena (5-year lifespan)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="deviceBrandName">Brand / Trade Name</label>
                  <input
                    id="deviceBrandName"
                    type="text"
                    value={insertionForm.deviceBrandName}
                    onChange={(e) => setInsertionForm({ ...insertionForm, deviceBrandName: e.target.value })}
                    placeholder="e.g. Pregna TCu380A, Mirena"
                  />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="lotBatchNumber">Lot / Batch Number</label>
                  <input
                    id="lotBatchNumber"
                    type="text"
                    value={insertionForm.lotBatchNumber}
                    onChange={(e) => setInsertionForm({ ...insertionForm, lotBatchNumber: e.target.value })}
                    placeholder="e.g. LOT-2026-X"
                  />
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.8rem' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label htmlFor="insertionTiming">Timing of Insertion *</label>
                  <select
                    id="insertionTiming"
                    value={insertionForm.insertionTiming}
                    onChange={(e) => setInsertionForm({ ...insertionForm, insertionTiming: e.target.value })}
                  >
                    <option value="post_placental_vaginal">Post-Placental (within 10m of vaginal delivery)</option>
                    <option value="post_cesarean_intracesarean">Post-Cesarean (intracesarean before uterine closure)</option>
                    <option value="early_postpartum_lt_48h">Early Postpartum (&lt; 48 hours)</option>
                    <option value="interval_extended_gt_6w">Extended Postpartum / Interval (&ge; 6 weeks)</option>
                    <option value="post_abortion_immediate">Post-Abortion (immediate post-MVA)</option>
                    <option value="emergency_contraception">Emergency Contraception (within 5 days)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="insertionDate">Insertion Date *</label>
                  <input
                    id="insertionDate"
                    type="date"
                    required
                    value={insertionForm.insertionDate}
                    onChange={(e) => setInsertionForm({ ...insertionForm, insertionDate: e.target.value })}
                  />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label htmlFor="insertedBy">Inserted By (Operator) *</label>
                  <input
                    id="insertedBy"
                    type="text"
                    required
                    value={insertionForm.insertedBy}
                    onChange={(e) => setInsertionForm({ ...insertionForm, insertedBy: e.target.value })}
                    placeholder="Dr / Sister name"
                  />
                </div>
              </div>

              {/* Procedure Details */}
              <div className="card stack" style={{ background: '#f8fafc', gap: '0.8rem' }}>
                <span className="bold">Procedure &amp; Anatomic Details:</span>
                <div className="row wrap" style={{ gap: '0.8rem' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor="uterineDepthCm">Sound Depth (cm)</label>
                    <input
                      id="uterineDepthCm"
                      type="number"
                      step="0.5"
                      min="4"
                      max="15"
                      value={insertionForm.uterineDepthCm}
                      onChange={(e) => setInsertionForm({ ...insertionForm, uterineDepthCm: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor="threadLengthCutCm">Thread Length (cm)</label>
                    <input
                      id="threadLengthCutCm"
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={insertionForm.threadLengthCutCm}
                      onChange={(e) => setInsertionForm({ ...insertionForm, threadLengthCutCm: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <label htmlFor="analgesiaUsed">Analgesia</label>
                    <select
                      id="analgesiaUsed"
                      value={insertionForm.analgesiaUsed}
                      onChange={(e) => setInsertionForm({ ...insertionForm, analgesiaUsed: e.target.value })}
                    >
                      <option value="none">None (Tolerated well)</option>
                      <option value="nsaid_premed">Oral NSAID Premedication</option>
                      <option value="paracervical_block">Paracervical Block</option>
                      <option value="general_epidural_anesthesia">Intra-op Anesthesia (Cesarean)</option>
                    </select>
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <label htmlFor="insertionEase">Insertion Ease</label>
                    <select
                      id="insertionEase"
                      value={insertionForm.insertionEase}
                      onChange={(e) => setInsertionForm({ ...insertionForm, insertionEase: e.target.value })}
                    >
                      <option value="smooth">Smooth / Uncomplicated</option>
                      <option value="moderate_resistance">Moderate Resistance</option>
                      <option value="difficult_cervical_stenosis">Difficult / Cervical Stenosis</option>
                      <option value="ultrasound_guided">Ultrasound-Guided</option>
                    </select>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: '0.8rem' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor="complications">Complications</label>
                    <select
                      id="complications"
                      value={insertionForm.complications}
                      onChange={(e) => setInsertionForm({ ...insertionForm, complications: e.target.value })}
                    >
                      <option value="none">None</option>
                      <option value="mild_cramping">Mild Pelvic Cramping</option>
                      <option value="vasovagal_syncope">Vasovagal Syncope</option>
                      <option value="bleeding_gt_50ml">Bleeding &gt; 50 mL</option>
                      <option value="suspected_perforation">Suspected Uterine Perforation</option>
                    </select>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor="postInsertionUltrasound">Post-Insertion Ultrasound</label>
                    <select
                      id="postInsertionUltrasound"
                      value={insertionForm.postInsertionUltrasound}
                      onChange={(e) => setInsertionForm({ ...insertionForm, postInsertionUltrasound: e.target.value })}
                    >
                      <option value="fundal_position_confirmed">Fundal Position Confirmed (&le; 1cm from fundus)</option>
                      <option value="not_done">Not Done (Routine clinical check)</option>
                      <option value="low_lying_segment">Low-Lying Segment</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="clinicalNotes">Technique &amp; Clinical Notes</label>
                <textarea
                  id="clinicalNotes"
                  rows={2}
                  value={insertionForm.clinicalNotes}
                  onChange={(e) => setInsertionForm({ ...insertionForm, clinicalNotes: e.target.value })}
                  placeholder="Document high fundal release, thread orientation, absence of bleeding, and patient advice..."
                />
              </div>

              <div className="row end" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowInsertionModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Insertion Procedure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Record Thread Check / Follow-up Visit */}
      {showFollowupModal && activeInsertion && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="row between middle" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Record IUCD Follow-Up &amp; Thread Check</h3>
              <button type="button" className="btn small" onClick={() => setShowFollowupModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveFollowup} className="stack" style={{ gap: '0.8rem', marginTop: '1rem' }}>
              <div className="row wrap" style={{ gap: '0.8rem' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label htmlFor="followupDate">Visit Date *</label>
                  <input
                    id="followupDate"
                    type="date"
                    required
                    value={followupForm.followupDate}
                    onChange={(e) => setFollowupForm({ ...followupForm, followupDate: e.target.value })}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="visitInterval">Interval</label>
                  <select
                    id="visitInterval"
                    value={followupForm.visitInterval}
                    onChange={(e) => setFollowupForm({ ...followupForm, visitInterval: e.target.value })}
                  >
                    <option value="6_weeks_post_insertion">6 Weeks Post-Insertion</option>
                    <option value="3_months">3 Months</option>
                    <option value="6_months">6 Months</option>
                    <option value="1_year">1 Year</option>
                    <option value="annual_surveillance">Annual Surveillance</option>
                    <option value="unscheduled_complaint">Unscheduled (Acute Complaint)</option>
                  </select>
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.8rem' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label htmlFor="threadStatus">Cervical Thread Status *</label>
                  <select
                    id="threadStatus"
                    value={followupForm.threadStatus}
                    onChange={(e) => setFollowupForm({ ...followupForm, threadStatus: e.target.value })}
                  >
                    <option value="threads_visible_normal">Threads Visible (Normal length ~3cm)</option>
                    <option value="threads_long">Threads Lengthened (Partial expulsion?)</option>
                    <option value="threads_short">Threads Shortened</option>
                    <option value="threads_not_visible">Threads NOT Visible (Lost Strings ⚠️)</option>
                    <option value="curled_in_canal">Threads Curled Inside Endocervix</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="bleedingPattern">Bleeding Pattern</label>
                  <select
                    id="bleedingPattern"
                    value={followupForm.bleedingPattern}
                    onChange={(e) => setFollowupForm({ ...followupForm, bleedingPattern: e.target.value })}
                  >
                    <option value="normal_regular">Normal / Regular Cycles</option>
                    <option value="amenorrhea">Amenorrhea (Expected with LNG-IUS)</option>
                    <option value="spotting_intermenstrual">Intermenstrual Spotting</option>
                    <option value="heavy_prolonged_bleeding">Heavy Prolonged Bleeding (Menorrhagia)</option>
                  </select>
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.8rem' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="pelvicPainScore">Pain Score (VAS 0–10)</label>
                  <input
                    id="pelvicPainScore"
                    type="number"
                    min="0"
                    max="10"
                    value={followupForm.pelvicPainScore}
                    onChange={(e) => setFollowupForm({ ...followupForm, pelvicPainScore: Number(e.target.value) })}
                  />
                </div>
                <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', marginTop: '1.2rem' }}>
                  <label className="row middle" style={{ gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={followupForm.signsOfInfection}
                      onChange={(e) => setFollowupForm({ ...followupForm, signsOfInfection: e.target.checked })}
                    />
                    <span style={{ color: followupForm.signsOfInfection ? '#dc2626' : 'inherit', fontWeight: followupForm.signsOfInfection ? 'bold' : 'normal' }}>
                      Signs of Pelvic Infection (PID / Odor) ⚠️
                    </span>
                  </label>
                </div>
              </div>

              {/* Ultrasound option */}
              <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '4px' }}>
                <label className="row middle" style={{ gap: '0.4rem', cursor: 'pointer', margin: '0 0 0.4rem 0' }}>
                  <input
                    type="checkbox"
                    checked={followupForm.pelvicUltrasoundDone}
                    onChange={(e) => setFollowupForm({ ...followupForm, pelvicUltrasoundDone: e.target.checked })}
                  />
                  <span>Pelvic Ultrasound Performed at this Visit</span>
                </label>
                {followupForm.pelvicUltrasoundDone && (
                  <div>
                    <label htmlFor="ultrasoundFinding" className="small">Ultrasound Finding</label>
                    <select
                      id="ultrasoundFinding"
                      value={followupForm.ultrasoundFinding}
                      onChange={(e) => setFollowupForm({ ...followupForm, ultrasoundFinding: e.target.value })}
                    >
                      <option value="normal_fundal">Normal Fundal In-Situ Position</option>
                      <option value="low_lying_cervical">Low-Lying / Displaced to Cervical Canal</option>
                      <option value="myometrial_embedment">Myometrial Embedment / Partial Perforation</option>
                      <option value="perforation_extrauterine">Complete Perforation (Extrauterine / Pelvic)</option>
                      <option value="absent_lost">Absent from Pelvis (Complete Expulsion)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="actionTaken">Action Taken</label>
                <select
                  id="actionTaken"
                  value={followupForm.actionTaken}
                  onChange={(e) => setFollowupForm({ ...followupForm, actionTaken: e.target.value })}
                >
                  <option value="continue_in_situ_reassured">Reassured; Continue Device In-Situ</option>
                  <option value="antibiotics_prescribed">Antibiotics Prescribed for Vaginitis/PID</option>
                  <option value="threads_trimmed">Threads Trimmed (Partner Dyspareunia)</option>
                  <option value="ultrasound_ordered">Pelvic Ultrasound Ordered for Lost Strings</option>
                  <option value="device_removed">Device Removed</option>
                </select>
              </div>

              <div>
                <label htmlFor="followupNotes">Clinical Notes</label>
                <textarea
                  id="followupNotes"
                  rows={2}
                  value={followupForm.clinicalNotes}
                  onChange={(e) => setFollowupForm({ ...followupForm, clinicalNotes: e.target.value })}
                  placeholder="Document speculum findings, cervical appearance, patient reassurance..."
                />
              </div>

              <div className="row end" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowFollowupModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Follow-up Check</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Update Removal Status */}
      {showRemovalModal && activeInsertion && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="row between middle" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Update IUCD Status / Record Removal</h3>
              <button type="button" className="btn small" onClick={() => setShowRemovalModal(false)}>✕</button>
            </div>

            <form onSubmit={handleUpdateRemoval} className="stack" style={{ gap: '0.8rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="removalStatus">New Status *</label>
                <select
                  id="removalStatus"
                  value={removalForm.status}
                  onChange={(e) => setRemovalForm({ ...removalForm, status: e.target.value })}
                >
                  <option value="removed_patient_request">Removed on Patient Request (Fertility Desired)</option>
                  <option value="removed_medical_reason">Removed for Medical Reasons (Bleeding / Pain / Infection)</option>
                  <option value="removed_expired">Removed - Expiry Reached (Due for Replacement)</option>
                  <option value="partially_expelled">Partially Expelled</option>
                  <option value="fully_expelled">Fully Expelled (Spontaneous)</option>
                  <option value="pregnancy_in_situ">Pregnancy with IUD In-Situ</option>
                </select>
              </div>
              <div>
                <label htmlFor="removalDate">Event Date *</label>
                <input
                  id="removalDate"
                  type="date"
                  required
                  value={removalForm.removalDate}
                  onChange={(e) => setRemovalForm({ ...removalForm, removalDate: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="removalReason">Reason / Detailed Note</label>
                <textarea
                  id="removalReason"
                  rows={2}
                  value={removalForm.removalReason}
                  onChange={(e) => setRemovalForm({ ...removalForm, removalReason: e.target.value })}
                  placeholder="e.g. Strings grasped with sponge forceps; gentle traction; intact device retrieved. Immediate replacement or switch to oral contraception."
                />
              </div>
              <div className="row end" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowRemovalModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Update Status</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
