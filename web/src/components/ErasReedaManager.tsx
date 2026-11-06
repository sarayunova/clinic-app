import React, { useState, useEffect, useMemo } from 'react';
import type { ErasPostOpPathway, ReedaWoundAssessment, ErasPathwaysResponse } from '../api';
import {
  calculateReedaScore,
  calculatePostOpHours,
  evaluateErasMilestoneAdherence,
} from '../erasReedaEngine';

interface Props {
  patientId: number;
}

export function ErasReedaManager({ patientId }: Props) {
  const [pathways, setPathways] = useState<ErasPostOpPathway[]>([]);
  const [selectedPathwayId, setSelectedPathwayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showPathwayModal, setShowPathwayModal] = useState(false);
  const [showReedaModal, setShowReedaModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  // Pathway creation form
  const [pathwayForm, setPathwayForm] = useState({
    surgeryDatetime: new Date().toISOString().slice(0, 16),
    surgeryType: 'elective_lscs' as ErasPostOpPathway['surgeryType'],
    incisionType: 'pfannenstiel' as ErasPostOpPathway['incisionType'],
    skinClosureType: 'subcuticular_monocryl' as ErasPostOpPathway['skinClosureType'],
    dvtProphylaxisApplied: 'early_mobilization_ted' as ErasPostOpPathway['dvtProphylaxisApplied'],
    clinicalNotes: 'Uncomplicated LSCS under spinal anesthesia.',
  });

  // REEDA Assessment form
  const [reedaForm, setReedaForm] = useState({
    assessmentDatetime: new Date().toISOString().slice(0, 16),
    postOpDay: 1,
    rednessScore: 0,
    edemaScore: 0,
    ecchymosisScore: 0,
    dischargeScore: 0,
    approximationScore: 0,
    painScore10: 2,
    dressingCondition: 'dry_intact' as ReedaWoundAssessment['dressingCondition'],
    actionPlan: '',
    assessorNotes: '',
  });

  // Milestone edit form
  const [milestoneForm, setMilestoneForm] = useState({
    oralFluidsAchievedHours: '',
    regularDietAchievedHours: '',
    catheterRemovedHours: '',
    firstMobilizationHours: '',
    multimodalAnalgesiaAdherent: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/patients/${patientId}/eras-pathways`);
      if (!res.ok) throw new Error('Failed to load ERAS pathways');
      const data: ErasPathwaysResponse = await res.json();
      setPathways(data.pathways || []);
      if (data.pathways && data.pathways.length > 0) {
        const active = data.pathways.find((p) => p.status === 'active') || data.pathways[0]!;
        setSelectedPathwayId(active.id);
      } else {
        setSelectedPathwayId(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading ERAS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const activePathway = useMemo(() => {
    return pathways.find((p) => p.id === selectedPathwayId) || null;
  }, [pathways, selectedPathwayId]);

  // Elapsed post-op hours
  const elapsedHours = useMemo(() => {
    if (!activePathway) return 0;
    return calculatePostOpHours(activePathway.surgeryDatetime, new Date().toISOString());
  }, [activePathway]);

  // Milestone adherence evaluation
  const adherence = useMemo(() => {
    if (!activePathway) return null;
    return evaluateErasMilestoneAdherence({
      oralFluidsAchievedHours: activePathway.oralFluidsAchievedHours,
      regularDietAchievedHours: activePathway.regularDietAchievedHours,
      catheterRemovedHours: activePathway.catheterRemovedHours,
      firstMobilizationHours: activePathway.firstMobilizationHours,
      multimodalAnalgesiaAdherent: activePathway.multimodalAnalgesiaAdherent,
    });
  }, [activePathway]);

  // Live evaluated REEDA score for modal
  const liveReedaEval = useMemo(() => {
    return calculateReedaScore({
      redness: reedaForm.rednessScore,
      edema: reedaForm.edemaScore,
      ecchymosis: reedaForm.ecchymosisScore,
      discharge: reedaForm.dischargeScore,
      approximation: reedaForm.approximationScore,
    });
  }, [reedaForm]);

  // Handlers
  const handleCreatePathway = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        surgeryDatetime: pathwayForm.surgeryDatetime,
        surgeryType: pathwayForm.surgeryType,
        incisionType: pathwayForm.incisionType,
        skinClosureType: pathwayForm.skinClosureType,
        dvtProphylaxisApplied: pathwayForm.dvtProphylaxisApplied,
        clinicalNotes: pathwayForm.clinicalNotes || null,
        status: 'active',
        multimodalAnalgesiaAdherent: true,
      };

      const res = await fetch(`/api/patients/${patientId}/eras-pathways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create ERAS pathway');
      }

      const created: ErasPostOpPathway = await res.json();
      setShowPathwayModal(false);
      await loadData();
      setSelectedPathwayId(created.id);
    } catch (err: any) {
      alert(err.message || 'Error creating pathway');
    }
  };

  const handleSaveReeda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePathway) return;

    try {
      const payload = {
        assessmentDatetime: reedaForm.assessmentDatetime,
        postOpDay: reedaForm.postOpDay,
        rednessScore: reedaForm.rednessScore,
        edemaScore: reedaForm.edemaScore,
        ecchymosisScore: reedaForm.ecchymosisScore,
        dischargeScore: reedaForm.dischargeScore,
        approximationScore: reedaForm.approximationScore,
        painScore10: reedaForm.painScore10,
        dressingCondition: reedaForm.dressingCondition,
        actionPlan: reedaForm.actionPlan || liveReedaEval.recommendations.join('; '),
        assessorNotes: reedaForm.assessorNotes || null,
      };

      const res = await fetch(`/api/eras-pathways/${activePathway.id}/reeda-assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to record REEDA assessment');
      }

      setShowReedaModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error recording assessment');
    }
  };

  const handleUpdateMilestones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePathway) return;

    try {
      const payload = {
        oralFluidsAchievedHours: milestoneForm.oralFluidsAchievedHours ? parseFloat(milestoneForm.oralFluidsAchievedHours) : null,
        regularDietAchievedHours: milestoneForm.regularDietAchievedHours ? parseFloat(milestoneForm.regularDietAchievedHours) : null,
        catheterRemovedHours: milestoneForm.catheterRemovedHours ? parseFloat(milestoneForm.catheterRemovedHours) : null,
        firstMobilizationHours: milestoneForm.firstMobilizationHours ? parseFloat(milestoneForm.firstMobilizationHours) : null,
        multimodalAnalgesiaAdherent: milestoneForm.multimodalAnalgesiaAdherent,
      };

      const res = await fetch(`/api/eras-pathways/${activePathway.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update milestones');
      }

      setShowMilestoneModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating milestones');
    }
  };

  const handleQuickMilestone = async (field: string, targetHours: number) => {
    if (!activePathway) return;
    try {
      const hours = Math.min(targetHours, Number(elapsedHours.toFixed(1)));
      const res = await fetch(`/api/eras-pathways/${activePathway.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: hours }),
      });
      if (!res.ok) throw new Error('Failed to update milestone');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error logging milestone');
    }
  };

  const handleDeleteAssessment = async (assessmentId: number) => {
    if (!confirm('Are you sure you want to delete this REEDA wound assessment?')) return;
    try {
      const res = await fetch(`/api/reeda-assessments/${assessmentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete assessment');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting assessment');
    }
  };

  if (loading && pathways.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading ERAS & REEDA wound monitor...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Enhanced Recovery After Cesarean (ERAS) & REEDA Wound Healing</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '999px' }}>
                ACOG / ERAS Society Guided
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
              Multimodal analgesia, early mobilization benchmarks, and objective REEDA surgical incision surveillance.
            </p>
          </div>
          <button
            onClick={() => setShowPathwayModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Initiate Post-Op Pathway
          </button>
        </div>
      </div>

      {pathways.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🩹</div>
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>No Post-Operative ERAS Pathways Recorded</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 16px' }}>
            Initiate a post-cesarean recovery pathway to track early oral hydration, urinary catheter removal, out-of-bed ambulation, and daily REEDA surgical site healing scores.
          </p>
          <button
            onClick={() => setShowPathwayModal(true)}
            style={{ padding: '9px 18px', borderRadius: '6px', background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Initiate ERAS Pathway
          </button>
        </div>
      ) : (
        <>
          {/* Pathway Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {pathways.map((p) => {
              const isSelected = p.id === selectedPathwayId;
              let badgeBg = '#dbeafe';
              let badgeColor = '#1d4ed8';
              if (p.status === 'discharge_ready') { badgeBg = '#dcfce7'; badgeColor = '#15803d'; }
              if (p.status === 'escalated_complication') { badgeBg = '#fee2e2'; badgeColor = '#b91c1c'; }
              if (p.status === 'discharged') { badgeBg = '#f1f5f9'; badgeColor = '#475569'; }

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPathwayId(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                    background: isSelected ? '#fff' : '#f8fafc',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#4f46e5' : '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{p.surgeryType.replace(/_/g, ' ').toUpperCase()} ({p.surgeryDatetime.slice(0, 10)})</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: badgeBg, color: badgeColor, textTransform: 'uppercase' }}>
                    {p.status.replace(/_/g, ' ')}
                  </span>
                </button>
              );
            })}
          </div>

          {activePathway && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Active Pathway Details Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                        {activePathway.surgeryType.replace(/_/g, ' ').toUpperCase()} — Incision: {activePathway.incisionType.toUpperCase()}
                      </h3>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: activePathway.status === 'escalated_complication' ? '#fee2e2' : activePathway.status === 'discharge_ready' ? '#dcfce7' : '#dbeafe',
                        color: activePathway.status === 'escalated_complication' ? '#b91c1c' : activePathway.status === 'discharge_ready' ? '#15803d' : '#1d4ed8',
                        textTransform: 'uppercase',
                      }}>
                        {activePathway.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#475569' }}>
                      <span><strong>Surgery Time:</strong> {new Date(activePathway.surgeryDatetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span style={{ margin: '0 8px' }}>•</span>
                      <span><strong>Elapsed Post-Op:</strong> {elapsedHours} hours (POD {Math.floor(elapsedHours / 24)})</span>
                      <span style={{ margin: '0 8px' }}>•</span>
                      <span><strong>Closure:</strong> {activePathway.skinClosureType.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        const pod = Math.max(0, Math.floor(elapsedHours / 24));
                        setReedaForm({
                          assessmentDatetime: new Date().toISOString().slice(0, 16),
                          postOpDay: pod,
                          rednessScore: 0,
                          edemaScore: 0,
                          ecchymosisScore: 0,
                          dischargeScore: 0,
                          approximationScore: 0,
                          painScore10: 2,
                          dressingCondition: 'dry_intact',
                          actionPlan: '',
                          assessorNotes: '',
                        });
                        setShowReedaModal(true);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#0284c7',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      + Record REEDA Wound Score
                    </button>
                    <button
                      onClick={() => {
                        setMilestoneForm({
                          oralFluidsAchievedHours: activePathway.oralFluidsAchievedHours != null ? String(activePathway.oralFluidsAchievedHours) : '',
                          regularDietAchievedHours: activePathway.regularDietAchievedHours != null ? String(activePathway.regularDietAchievedHours) : '',
                          catheterRemovedHours: activePathway.catheterRemovedHours != null ? String(activePathway.catheterRemovedHours) : '',
                          firstMobilizationHours: activePathway.firstMobilizationHours != null ? String(activePathway.firstMobilizationHours) : '',
                          multimodalAnalgesiaAdherent: activePathway.multimodalAnalgesiaAdherent,
                        });
                        setShowMilestoneModal(true);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      Update Milestones
                    </button>
                    <a
                      href={`/eras-reeda/${activePathway.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      🖨️ Print Post-Op Sheet
                    </a>
                  </div>
                </div>
              </div>

              {/* ERAS Milestones Interactive Timeline */}
              {adherence && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>ERAS Recovery Milestones & Benchmarks</h4>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Postoperative functional progression adherence</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: adherence.adherencePercentage >= 80 ? '#15803d' : '#b45309' }}>
                        Adherence Score: {adherence.adherencePercentage}%
                      </span>
                      <div style={{ width: '120px', height: '10px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${adherence.adherencePercentage}%`, height: '100%', background: adherence.adherencePercentage >= 80 ? '#10b981' : '#f59e0b', borderRadius: '999px' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {/* Milestone 1: Oral Hydration */}
                    <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: activePathway.oralFluidsAchievedHours != null ? '#f0fdf4' : '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>1. Early Oral Fluids</span>
                        <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: activePathway.oralFluidsAchievedHours != null ? '#dcfce7' : '#e2e8f0', color: activePathway.oralFluidsAchievedHours != null ? '#15803d' : '#64748b' }}>
                          Target &le; 2h
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>
                        {activePathway.oralFluidsAchievedHours != null ? `Achieved at ${activePathway.oralFluidsAchievedHours}h` : 'Not achieved yet'}
                      </div>
                      {activePathway.oralFluidsAchievedHours == null && (
                        <button
                          onClick={() => handleQuickMilestone('oralFluidsAchievedHours', 2)}
                          style={{ marginTop: '8px', padding: '4px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Mark Achieved Now
                        </button>
                      )}
                    </div>

                    {/* Milestone 2: Regular Solid Diet */}
                    <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: activePathway.regularDietAchievedHours != null ? '#f0fdf4' : '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>2. Regular Solid Diet</span>
                        <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: activePathway.regularDietAchievedHours != null ? '#dcfce7' : '#e2e8f0', color: activePathway.regularDietAchievedHours != null ? '#15803d' : '#64748b' }}>
                          Target &le; 6h
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>
                        {activePathway.regularDietAchievedHours != null ? `Achieved at ${activePathway.regularDietAchievedHours}h` : 'Not achieved yet'}
                      </div>
                      {activePathway.regularDietAchievedHours == null && (
                        <button
                          onClick={() => handleQuickMilestone('regularDietAchievedHours', 6)}
                          style={{ marginTop: '8px', padding: '4px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Mark Achieved Now
                        </button>
                      )}
                    </div>

                    {/* Milestone 3: Catheter Removal */}
                    <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: activePathway.catheterRemovedHours != null ? '#f0fdf4' : '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>3. Foley Catheter</span>
                        <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: activePathway.catheterRemovedHours != null ? '#dcfce7' : '#e2e8f0', color: activePathway.catheterRemovedHours != null ? '#15803d' : '#64748b' }}>
                          Target &le; 12h
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>
                        {activePathway.catheterRemovedHours != null ? `Removed at ${activePathway.catheterRemovedHours}h` : 'Catheter In Situ'}
                      </div>
                      {activePathway.catheterRemovedHours == null && (
                        <button
                          onClick={() => handleQuickMilestone('catheterRemovedHours', 8)}
                          style={{ marginTop: '8px', padding: '4px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Mark Removed Now
                        </button>
                      )}
                    </div>

                    {/* Milestone 4: Active Mobilization */}
                    <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: activePathway.firstMobilizationHours != null ? '#f0fdf4' : '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>4. Active Ambulation</span>
                        <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: activePathway.firstMobilizationHours != null ? '#dcfce7' : '#e2e8f0', color: activePathway.firstMobilizationHours != null ? '#15803d' : '#64748b' }}>
                          Target &le; 12h
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>
                        {activePathway.firstMobilizationHours != null ? `Mobilized at ${activePathway.firstMobilizationHours}h` : 'Pending ambulation'}
                      </div>
                      {activePathway.firstMobilizationHours == null && (
                        <button
                          onClick={() => handleQuickMilestone('firstMobilizationHours', 10)}
                          style={{ marginTop: '8px', padding: '4px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Mark Mobilized Now
                        </button>
                      )}
                    </div>

                    {/* Milestone 5: Multimodal Analgesia */}
                    <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: activePathway.multimodalAnalgesiaAdherent ? '#f0fdf4' : '#fef2f2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>5. Multimodal Analgesia</span>
                        <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: activePathway.multimodalAnalgesiaAdherent ? '#dcfce7' : '#fee2e2', color: activePathway.multimodalAnalgesiaAdherent ? '#15803d' : '#b91c1c' }}>
                          Opioid-Sparing
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>
                        {activePathway.multimodalAnalgesiaAdherent ? 'Adherent (Paracetamol + NSAID)' : 'Non-adherent'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* REEDA Wound Flowsheet Table */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
                      REEDA Wound Assessments ({activePathway.assessments.length})
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Redness (0-3) · Edema (0-3) · Ecchymosis (0-3) · Discharge (0-3) · Approximation (0-3)
                    </span>
                  </div>
                  <button
                    onClick={() => setShowReedaModal(true)}
                    style={{ padding: '6px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Add REEDA Score
                  </button>
                </div>

                {activePathway.assessments.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No surgical wound assessments logged yet. Perform first check at dressing inspection (POD 1).
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '10px 14px' }}>Post-Op Day</th>
                          <th style={{ padding: '10px 14px' }}>Date / Time</th>
                          <th style={{ padding: '10px 14px' }}>R · E · E · D · A</th>
                          <th style={{ padding: '10px 14px' }}>Total REEDA (0-15)</th>
                          <th style={{ padding: '10px 14px' }}>Healing Category</th>
                          <th style={{ padding: '10px 14px' }}>Pain (0-10)</th>
                          <th style={{ padding: '10px 14px' }}>Dressing</th>
                          <th style={{ padding: '10px 14px' }}>Action Plan</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePathway.assessments.map((a) => {
                          let badgeBg = '#dcfce7';
                          let badgeColor = '#15803d';
                          if (a.healingCategory === 'mild_inflammation') { badgeBg = '#f1f5f9'; badgeColor = '#475569'; }
                          if (a.healingCategory === 'moderate_impairment_suspected_ssi') { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }
                          if (a.healingCategory === 'severe_complication_dehiscence') { badgeBg = '#fee2e2'; badgeColor = '#b91c1c'; }

                          return (
                            <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e293b' }}>
                                POD {a.postOpDay}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#64748b' }}>
                                {new Date(a.assessmentDatetime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600 }}>
                                {a.rednessScore} · {a.edemaScore} · {a.ecchymosisScore} · {a.dischargeScore} · {a.approximationScore}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: a.totalReedaScore >= 8 ? '#dc2626' : a.totalReedaScore >= 4 ? '#d97706' : '#16a34a' }}>
                                  {a.totalReedaScore} / 15
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: badgeBg, color: badgeColor }}>
                                  {a.healingCategory.replace(/_/g, ' ').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {a.painScore10 != null ? `${a.painScore10}/10` : '—'}
                              </td>
                              <td style={{ padding: '12px 14px', textTransform: 'capitalize' }}>
                                {a.dressingCondition.replace(/_/g, ' ')}
                              </td>
                              <td style={{ padding: '12px 14px', maxWidth: '240px', fontSize: '0.8rem', color: '#334155' }}>
                                {a.actionPlan || 'Routine wound hygiene.'}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <button
                                  onClick={() => handleDeleteAssessment(a.id)}
                                  style={{ padding: '4px 8px', borderRadius: '4px', background: '#fff', border: '1px solid #fee2e2', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Initiate ERAS Pathway */}
      {showPathwayModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Initiate Post-Cesarean ERAS Pathway</h3>
              <button onClick={() => setShowPathwayModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleCreatePathway} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Surgery Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={pathwayForm.surgeryDatetime}
                  onChange={(e) => setPathwayForm({ ...pathwayForm, surgeryDatetime: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Surgery Procedure</label>
                  <select
                    value={pathwayForm.surgeryType}
                    onChange={(e) => setPathwayForm({ ...pathwayForm, surgeryType: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="elective_lscs">Elective Cesarean (LSCS)</option>
                    <option value="emergency_lscs">Emergency Cesarean (LSCS)</option>
                    <option value="laparotomy">Exploratory Laparotomy</option>
                    <option value="myomectomy">Myomectomy</option>
                    <option value="other_gynecologic_surgery">Other Gyn Surgery</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Incision Type</label>
                  <select
                    value={pathwayForm.incisionType}
                    onChange={(e) => setPathwayForm({ ...pathwayForm, incisionType: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="pfannenstiel">Pfannenstiel (Transverse)</option>
                    <option value="joel_cohen">Joel-Cohen</option>
                    <option value="midline_vertical">Midline Vertical</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Skin Closure</label>
                  <select
                    value={pathwayForm.skinClosureType}
                    onChange={(e) => setPathwayForm({ ...pathwayForm, skinClosureType: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="subcuticular_monocryl">Subcuticular Monocryl</option>
                    <option value="staples">Surgical Staples</option>
                    <option value="dermabond_glue">Dermabond Tissue Adhesive</option>
                    <option value="interrupted_mattress">Interrupted Mattress</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>DVT Prophylaxis</label>
                  <select
                    value={pathwayForm.dvtProphylaxisApplied}
                    onChange={(e) => setPathwayForm({ ...pathwayForm, dvtProphylaxisApplied: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="early_mobilization_ted">Early Mobilization + TED Stockings</option>
                    <option value="scd_mechanical">Pneumatic Compression (SCD)</option>
                    <option value="lmwh_pharmacological">LMWH Heparin (High Risk)</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Clinical / Operative Notes</label>
                <textarea
                  rows={2}
                  value={pathwayForm.clinicalNotes}
                  onChange={(e) => setPathwayForm({ ...pathwayForm, clinicalNotes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowPathwayModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Initiate ERAS Pathway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log REEDA Assessment */}
      {showReedaModal && activePathway && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>REEDA Surgical Wound Assessment</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Postoperative Day {reedaForm.postOpDay} · Surgery: {activePathway.surgeryType.replace(/_/g, ' ')}</span>
              </div>
              <button onClick={() => setShowReedaModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleSaveReeda} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assessment Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={reedaForm.assessmentDatetime}
                    onChange={(e) => setReedaForm({ ...reedaForm, assessmentDatetime: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Post-Op Day (POD)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={reedaForm.postOpDay}
                    onChange={(e) => setReedaForm({ ...reedaForm, postOpDay: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* 5 Cardinal REEDA Parameters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {/* 1. Redness */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>
                    <span>🔴 Redness (Erythema)</span>
                    <span style={{ color: '#4f46e5' }}>Score: {reedaForm.rednessScore}</span>
                  </div>
                  <select
                    value={reedaForm.rednessScore}
                    onChange={(e) => setReedaForm({ ...reedaForm, rednessScore: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value={0}>0 - None</option>
                    <option value={1}>1 - &lt; 0.25 cm on one or both sides of incision</option>
                    <option value={2}>2 - 0.25 to 0.5 cm on both sides of incision</option>
                    <option value={3}>3 - &gt; 0.5 cm on both sides of incision</option>
                  </select>
                </div>

                {/* 2. Edema */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>
                    <span>💧 Edema (Swelling)</span>
                    <span style={{ color: '#4f46e5' }}>Score: {reedaForm.edemaScore}</span>
                  </div>
                  <select
                    value={reedaForm.edemaScore}
                    onChange={(e) => setReedaForm({ ...reedaForm, edemaScore: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value={0}>0 - None</option>
                    <option value={1}>1 - Perineal/incision &lt; 1 cm from incision</option>
                    <option value={2}>2 - Perineal/incision 1 to 2 cm from incision</option>
                    <option value={3}>3 - Perineal/incision &gt; 2 cm from incision</option>
                  </select>
                </div>

                {/* 3. Ecchymosis */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>
                    <span>🟣 Ecchymosis (Bruising)</span>
                    <span style={{ color: '#4f46e5' }}>Score: {reedaForm.ecchymosisScore}</span>
                  </div>
                  <select
                    value={reedaForm.ecchymosisScore}
                    onChange={(e) => setReedaForm({ ...reedaForm, ecchymosisScore: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value={0}>0 - None</option>
                    <option value={1}>1 - Within 0.25 cm bilaterally or 0.5 cm unilaterally</option>
                    <option value={2}>2 - 0.25 to 1.0 cm bilaterally or 0.5 to 2.0 cm unilaterally</option>
                    <option value={3}>3 - &gt; 1.0 cm bilaterally or &gt; 2.0 cm unilaterally</option>
                  </select>
                </div>

                {/* 4. Discharge */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>
                    <span>🟡 Discharge (Exudate)</span>
                    <span style={{ color: '#4f46e5' }}>Score: {reedaForm.dischargeScore}</span>
                  </div>
                  <select
                    value={reedaForm.dischargeScore}
                    onChange={(e) => setReedaForm({ ...reedaForm, dischargeScore: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value={0}>0 - None</option>
                    <option value={1}>1 - Serous exudate</option>
                    <option value={2}>2 - Serosanguinous discharge</option>
                    <option value={3}>3 - Bloody or Purulent discharge</option>
                  </select>
                </div>

                {/* 5. Approximation */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>
                    <span>🪡 Approximation (Edges)</span>
                    <span style={{ color: '#4f46e5' }}>Score: {reedaForm.approximationScore}</span>
                  </div>
                  <select
                    value={reedaForm.approximationScore}
                    onChange={(e) => setReedaForm({ ...reedaForm, approximationScore: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value={0}>0 - Skin edges closed well, fully approximated</option>
                    <option value={1}>1 - Skin gap &le; 3 mm</option>
                    <option value={2}>2 - Skin and subcutaneous fat separation &gt; 3 mm</option>
                    <option value={3}>3 - Complete dehiscence / fascial separation</option>
                  </select>
                </div>
              </div>

              {/* Total REEDA Score & Category Live Badge */}
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: liveReedaEval.riskLevel === 'high' ? '#fef2f2' : liveReedaEval.riskLevel === 'moderate' ? '#fffbeb' : '#f0fdf4', border: `1px solid ${liveReedaEval.riskLevel === 'high' ? '#fca5a5' : liveReedaEval.riskLevel === 'moderate' ? '#fde68a' : '#86efac'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: liveReedaEval.riskLevel === 'high' ? '#b91c1c' : liveReedaEval.riskLevel === 'moderate' ? '#92400e' : '#15803d' }}>
                    Total REEDA Score: {liveReedaEval.totalScore} / 15
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#fff' }}>
                    {liveReedaEval.categoryLabel}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '6px', color: '#334155' }}>
                  {liveReedaEval.recommendations.map((r, i) => (
                    <div key={i}>• {r}</div>
                  ))}
                </div>
              </div>

              {/* Pain & Dressing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Incisional Pain (0 to 10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={reedaForm.painScore10}
                    onChange={(e) => setReedaForm({ ...reedaForm, painScore10: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Dressing Condition</label>
                  <select
                    value={reedaForm.dressingCondition}
                    onChange={(e) => setReedaForm({ ...reedaForm, dressingCondition: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="dry_intact">Dry & Intact</option>
                    <option value="soaked">Soaked / Stained</option>
                    <option value="removed_clean">Removed / Open to Air</option>
                    <option value="reinforcement_needed">Reinforcement Needed</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Clinical Action Plan</label>
                <input
                  type="text"
                  placeholder={liveReedaEval.recommendations[0] || 'Routine wound hygiene'}
                  value={reedaForm.actionPlan}
                  onChange={(e) => setReedaForm({ ...reedaForm, actionPlan: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowReedaModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save REEDA Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Milestones */}
      {showMilestoneModal && activePathway && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Update ERAS Recovery Milestones</h3>
              <button onClick={() => setShowMilestoneModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleUpdateMilestones} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Oral Fluids (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 1.5"
                    value={milestoneForm.oralFluidsAchievedHours}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, oralFluidsAchievedHours: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Target: &le; 2 hours</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Regular Diet (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 5.0"
                    value={milestoneForm.regularDietAchievedHours}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, regularDietAchievedHours: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Target: &le; 6 hours</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Catheter Out (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 8.0"
                    value={milestoneForm.catheterRemovedHours}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, catheterRemovedHours: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Target: &le; 12 hours</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Mobilization (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 10.0"
                    value={milestoneForm.firstMobilizationHours}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, firstMobilizationHours: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Target: &le; 12 hours</span>
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={milestoneForm.multimodalAnalgesiaAdherent}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, multimodalAnalgesiaAdherent: e.target.checked })}
                  />
                  <span><strong>Multimodal Opioid-Sparing Analgesia</strong> (Scheduled Paracetamol + NSAIDs)</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowMilestoneModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Milestones
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
