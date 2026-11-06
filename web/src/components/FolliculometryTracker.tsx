import React, { useState, useEffect, useMemo } from 'react';
import type {
  InfertilityWorkup,
  FolliculometryCycle,
  FolliculometryScan,
  InfertilityWorkupResponse,
  FolliculometryCyclesResponse,
} from '../api';
import {
  calculateCycleDay,
  determineLeadingFollicle,
  calculateFollicleGrowthRate,
  evaluateEndometrialReceptivity,
  evaluateFollicularReadiness,
  interpretSemenAnalysis,
} from '../folliculometryEngine';

interface Props {
  patientId: number;
}

export function FolliculometryTracker({ patientId }: Props) {
  const [workup, setWorkup] = useState<InfertilityWorkup | null>(null);
  const [cycles, setCycles] = useState<FolliculometryCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showWorkupModal, setShowWorkupModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);

  // Workup form state
  const [workupForm, setWorkupForm] = useState({
    partnerName: '',
    partnerAge: '',
    infertilityType: 'primary' as 'primary' | 'secondary',
    durationYears: '',
    femaleFactors: [] as string[],
    baselineAmhNgMl: '',
    baselineFshMiuMl: '',
    baselineAfcTotal: '',
    hsgFindings: '',
    semenVolumeMl: '',
    semenConcentrationMilMl: '',
    semenTotalMotilityPct: '',
    semenProgressiveMotilityPct: '',
    semenNormalMorphologyPct: '',
    clinicalNotes: '',
  });

  // Cycle form state
  const [cycleForm, setCycleForm] = useState({
    cycleNumber: 1,
    lmpDate: new Date().toISOString().slice(0, 10),
    protocolType: 'letrozole' as FolliculometryCycle['protocolType'],
    protocolDetails: 'Letrozole 5mg OD CD 3 to 7',
    plannedProcedure: 'timed_intercourse' as FolliculometryCycle['plannedProcedure'],
    lutealSupport: 'Micronized Progesterone 200mg BD x 14 days post-ovulation',
  });

  // Scan form state
  const [scanForm, setScanForm] = useState({
    scanDatetime: new Date().toISOString().slice(0, 16),
    rightOvaryInput: '',
    leftOvaryInput: '',
    endometrialThicknessMm: '',
    endometrialPattern: 'trilaminar_a' as 'trilaminar_a' | 'isogenous_b' | 'hyperechoic_c' | 'irregular',
    freeFluidPod: false,
    ovulationRuptureObserved: false,
    clinicalAdvice: '',
    sonographerNotes: '',
  });

  // Trigger form state
  const [triggerForm, setTriggerForm] = useState({
    triggerDrug: 'rhCG 250 mcg (Ovitrelle) SC stat',
    triggerDatetime: new Date().toISOString().slice(0, 16),
    advisedTicIuiDatetime: '',
  });

  // Outcome form state
  const [outcomeForm, setOutcomeForm] = useState({
    cycleOutcome: 'clinical_pregnancy' as FolliculometryCycle['cycleOutcome'],
    outcomeNotes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [wRes, cRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/infertility-workup`),
        fetch(`/api/patients/${patientId}/folliculometry-cycles`),
      ]);

      if (wRes.ok) {
        const wData: InfertilityWorkupResponse = await wRes.json();
        setWorkup(wData.workup);
        if (wData.workup) {
          setWorkupForm({
            partnerName: wData.workup.partnerName || '',
            partnerAge: wData.workup.partnerAge != null ? String(wData.workup.partnerAge) : '',
            infertilityType: wData.workup.infertilityType,
            durationYears: wData.workup.durationYears != null ? String(wData.workup.durationYears) : '',
            femaleFactors: wData.workup.femaleFactors || [],
            baselineAmhNgMl: wData.workup.baselineAmhNgMl != null ? String(wData.workup.baselineAmhNgMl) : '',
            baselineFshMiuMl: wData.workup.baselineFshMiuMl != null ? String(wData.workup.baselineFshMiuMl) : '',
            baselineAfcTotal: wData.workup.baselineAfcTotal != null ? String(wData.workup.baselineAfcTotal) : '',
            hsgFindings: wData.workup.hsgFindings || '',
            semenVolumeMl: wData.workup.semenVolumeMl != null ? String(wData.workup.semenVolumeMl) : '',
            semenConcentrationMilMl: wData.workup.semenConcentrationMilMl != null ? String(wData.workup.semenConcentrationMilMl) : '',
            semenTotalMotilityPct: wData.workup.semenTotalMotilityPct != null ? String(wData.workup.semenTotalMotilityPct) : '',
            semenProgressiveMotilityPct: wData.workup.semenProgressiveMotilityPct != null ? String(wData.workup.semenProgressiveMotilityPct) : '',
            semenNormalMorphologyPct: wData.workup.semenNormalMorphologyPct != null ? String(wData.workup.semenNormalMorphologyPct) : '',
            clinicalNotes: wData.workup.clinicalNotes || '',
          });
        }
      }

      if (cRes.ok) {
        const cData: FolliculometryCyclesResponse = await cRes.json();
        setCycles(cData.cycles || []);
        if (cData.cycles && cData.cycles.length > 0) {
          // Select active or latest cycle
          const active = cData.cycles.find((c) => c.status === 'active' || c.status === 'triggered');
          setSelectedCycleId(active ? active.id : cData.cycles[0]!.id);
        } else {
          setSelectedCycleId(null);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load infertility and folliculometry data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const activeCycle = useMemo(() => {
    return cycles.find((c) => c.id === selectedCycleId) || null;
  }, [cycles, selectedCycleId]);

  // Live evaluated values for Scan modal form
  const parsedRight = useMemo(() => {
    return scanForm.rightOvaryInput
      .split(/[, ]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }, [scanForm.rightOvaryInput]);

  const parsedLeft = useMemo(() => {
    return scanForm.leftOvaryInput
      .split(/[, ]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }, [scanForm.leftOvaryInput]);

  const leadingFollicleEval = useMemo(() => {
    return determineLeadingFollicle(parsedRight, parsedLeft);
  }, [parsedRight, parsedLeft]);

  const scanCycleDay = useMemo(() => {
    if (!activeCycle) return 1;
    return calculateCycleDay(activeCycle.lmpDate, scanForm.scanDatetime);
  }, [activeCycle, scanForm.scanDatetime]);

  const liveGrowthRate = useMemo(() => {
    if (!activeCycle || !activeCycle.latestScan || leadingFollicleEval.leadingSizeMm <= 0) return null;
    const prev = activeCycle.latestScan;
    if (prev.leadingFollicleSizeMm == null) return null;
    return calculateFollicleGrowthRate(
      { cycleDay: prev.cycleDay, sizeMm: prev.leadingFollicleSizeMm },
      { cycleDay: scanCycleDay, sizeMm: leadingFollicleEval.leadingSizeMm }
    );
  }, [activeCycle, scanCycleDay, leadingFollicleEval.leadingSizeMm]);

  const liveEndoEval = useMemo(() => {
    const et = parseFloat(scanForm.endometrialThicknessMm);
    return evaluateEndometrialReceptivity(isNaN(et) ? null : et, scanForm.endometrialPattern);
  }, [scanForm.endometrialThicknessMm, scanForm.endometrialPattern]);

  const liveReadiness = useMemo(() => {
    const et = parseFloat(scanForm.endometrialThicknessMm);
    return evaluateFollicularReadiness({
      leadingSizeMm: leadingFollicleEval.leadingSizeMm,
      etMm: isNaN(et) ? null : et,
      pattern: scanForm.endometrialPattern,
      dominantCountGe16mm: leadingFollicleEval.dominantCountGe16mm,
      ruptureObserved: scanForm.ovulationRuptureObserved,
      protocolType: activeCycle?.protocolType,
    });
  }, [leadingFollicleEval, scanForm.endometrialThicknessMm, scanForm.endometrialPattern, scanForm.ovulationRuptureObserved, activeCycle]);

  // Live Semen analysis preview in Workup modal
  const liveSemenInterp = useMemo(() => {
    return interpretSemenAnalysis({
      volumeMl: workupForm.semenVolumeMl ? parseFloat(workupForm.semenVolumeMl) : null,
      concentrationMilMl: workupForm.semenConcentrationMilMl ? parseFloat(workupForm.semenConcentrationMilMl) : null,
      progressiveMotilityPct: workupForm.semenProgressiveMotilityPct ? parseFloat(workupForm.semenProgressiveMotilityPct) : null,
      totalMotilityPct: workupForm.semenTotalMotilityPct ? parseFloat(workupForm.semenTotalMotilityPct) : null,
      normalMorphologyPct: workupForm.semenNormalMorphologyPct ? parseFloat(workupForm.semenNormalMorphologyPct) : null,
    });
  }, [workupForm]);

  // Handlers
  const handleSaveWorkup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        partnerName: workupForm.partnerName || null,
        partnerAge: workupForm.partnerAge ? parseInt(workupForm.partnerAge, 10) : null,
        infertilityType: workupForm.infertilityType,
        durationYears: workupForm.durationYears ? parseFloat(workupForm.durationYears) : null,
        femaleFactors: workupForm.femaleFactors,
        baselineAmhNgMl: workupForm.baselineAmhNgMl ? parseFloat(workupForm.baselineAmhNgMl) : null,
        baselineFshMiuMl: workupForm.baselineFshMiuMl ? parseFloat(workupForm.baselineFshMiuMl) : null,
        baselineAfcTotal: workupForm.baselineAfcTotal ? parseInt(workupForm.baselineAfcTotal, 10) : null,
        hsgFindings: workupForm.hsgFindings || null,
        semenVolumeMl: workupForm.semenVolumeMl ? parseFloat(workupForm.semenVolumeMl) : null,
        semenConcentrationMilMl: workupForm.semenConcentrationMilMl ? parseFloat(workupForm.semenConcentrationMilMl) : null,
        semenTotalMotilityPct: workupForm.semenTotalMotilityPct ? parseFloat(workupForm.semenTotalMotilityPct) : null,
        semenProgressiveMotilityPct: workupForm.semenProgressiveMotilityPct ? parseFloat(workupForm.semenProgressiveMotilityPct) : null,
        semenNormalMorphologyPct: workupForm.semenNormalMorphologyPct ? parseFloat(workupForm.semenNormalMorphologyPct) : null,
        clinicalNotes: workupForm.clinicalNotes || null,
      };

      const res = await fetch(`/api/patients/${patientId}/infertility-workup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save infertility workup');
      }

      setShowWorkupModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save workup');
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        workupId: workup?.id || null,
        cycleNumber: cycleForm.cycleNumber,
        lmpDate: cycleForm.lmpDate,
        protocolType: cycleForm.protocolType,
        protocolDetails: cycleForm.protocolDetails || null,
        plannedProcedure: cycleForm.plannedProcedure,
        status: 'active',
        lutealSupport: cycleForm.lutealSupport || null,
      };

      const res = await fetch(`/api/patients/${patientId}/folliculometry-cycles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create cycle');
      }

      const created: FolliculometryCycle = await res.json();
      setShowCycleModal(false);
      await loadData();
      setSelectedCycleId(created.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create cycle');
    }
  };

  const handleSaveScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle) return;

    try {
      const et = parseFloat(scanForm.endometrialThicknessMm);
      const payload = {
        scanDatetime: scanForm.scanDatetime,
        cycleDay: scanCycleDay,
        rightOvaryFollicles: parsedRight,
        leftOvaryFollicles: parsedLeft,
        endometrialThicknessMm: isNaN(et) ? null : et,
        endometrialPattern: scanForm.endometrialPattern,
        freeFluidPod: scanForm.freeFluidPod,
        ovulationRuptureObserved: scanForm.ovulationRuptureObserved,
        clinicalAdvice: scanForm.clinicalAdvice || liveReadiness.summary,
        sonographerNotes: scanForm.sonographerNotes || null,
      };

      const res = await fetch(`/api/folliculometry-cycles/${activeCycle.id}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save folliculometry scan');
      }

      setShowScanModal(false);
      setScanForm({
        scanDatetime: new Date().toISOString().slice(0, 16),
        rightOvaryInput: '',
        leftOvaryInput: '',
        endometrialThicknessMm: '',
        endometrialPattern: 'trilaminar_a',
        freeFluidPod: false,
        ovulationRuptureObserved: false,
        clinicalAdvice: '',
        sonographerNotes: '',
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save scan');
    }
  };

  const handleSaveTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle) return;

    try {
      const res = await fetch(`/api/folliculometry-cycles/${activeCycle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'triggered',
          triggerDrug: triggerForm.triggerDrug,
          triggerDatetime: triggerForm.triggerDatetime,
          advisedTicIuiDatetime: triggerForm.advisedTicIuiDatetime || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to record trigger');
      }

      setShowTriggerModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record trigger');
    }
  };

  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle) return;

    try {
      const res = await fetch(`/api/folliculometry-cycles/${activeCycle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          cycleOutcome: outcomeForm.cycleOutcome,
          outcomeNotes: outcomeForm.outcomeNotes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save cycle outcome');
      }

      setShowOutcomeModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save outcome');
    }
  };

  const handleDeleteScan = async (scanId: number) => {
    if (!confirm('Are you sure you want to delete this scan entry?')) return;
    try {
      const res = await fetch(`/api/folliculometry-scans/${scanId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete scan');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete scan');
    }
  };

  if (loading && !workup && cycles.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading infertility & folliculometry monitor...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header and Infertility Workup Banner */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Gynecological Infertility & Folliculometry Cycle Monitor</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#ede9fe', color: '#6d28d9', padding: '3px 8px', borderRadius: '999px' }}>
                WHO 6th / ASRM Guided
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
              Serial TVS follicle tracking, endometrial receptivity trilaminar grading, ovulation induction & timed intercourse/IUI schedule.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowWorkupModal(true)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {workup ? 'Edit Infertility Workup' : '+ Baseline Infertility Workup'}
            </button>
            <button
              onClick={() => {
                setCycleForm({
                  cycleNumber: (cycles.length || 0) + 1,
                  lmpDate: new Date().toISOString().slice(0, 10),
                  protocolType: 'letrozole',
                  protocolDetails: 'Letrozole 5mg OD CD 3 to 7',
                  plannedProcedure: 'timed_intercourse',
                  lutealSupport: 'Micronized Progesterone 200mg BD x 14 days post-ovulation',
                });
                setShowCycleModal(true);
              }}
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
              + New Ovulation Cycle
            </button>
          </div>
        </div>

        {/* Workup Snapshot */}
        {workup && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{workup.infertilityType} Infertility</span> ({workup.durationYears ? `${workup.durationYears} yrs` : 'Unspecified duration'})
            </div>
            {workup.partnerName && (
              <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>Partner:</strong> {workup.partnerName} {workup.partnerAge ? `(${workup.partnerAge}y)` : ''}
              </div>
            )}
            <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong>Ovarian Reserve:</strong> AMH: {workup.baselineAmhNgMl != null ? `${workup.baselineAmhNgMl} ng/mL` : 'N/A'} | AFC: {workup.baselineAfcTotal ?? 'N/A'}
            </div>
            <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong>Semen (WHO-6):</strong> {workup.semenAnalysisInterpretation || 'Not recorded'}
              {workup.semenConcentrationMilMl != null && ` (${workup.semenConcentrationMilMl} M/mL, ${workup.semenProgressiveMotilityPct ?? 0}% PR)`}
            </div>
            {workup.hsgFindings && (
              <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>HSG / Tubal:</strong> {workup.hsgFindings}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cycle Selector & Active Cycle Overview */}
      {cycles.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔬</div>
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>No Folliculometry Cycles Recorded</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 16px' }}>
            Initiate a stimulated or natural cycle (Letrozole, Clomiphene, Gonadotropins) to track follicle growth curves, endometrial thickness, and trigger timing.
          </p>
          <button
            onClick={() => setShowCycleModal(true)}
            style={{ padding: '9px 18px', borderRadius: '6px', background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Start First Ovulation Cycle
          </button>
        </div>
      ) : (
        <>
          {/* Cycle Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {cycles.map((c) => {
              const isSelected = c.id === selectedCycleId;
              let badgeBg = '#e2e8f0';
              let badgeColor = '#475569';
              if (c.status === 'active') { badgeBg = '#dbeafe'; badgeColor = '#1d4ed8'; }
              if (c.status === 'triggered') { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }
              if (c.status === 'ovulated_ruptured') { badgeBg = '#dcfce7'; badgeColor = '#15803d'; }
              if (c.status === 'completed') { badgeBg = '#f1f5f9'; badgeColor = '#334155'; }
              if (c.status === 'cancelled') { badgeBg = '#fee2e2'; badgeColor = '#b91c1c'; }

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCycleId(c.id)}
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
                  <span>Cycle #{c.cycleNumber} (LMP: {c.lmpDate})</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: badgeBg, color: badgeColor, textTransform: 'uppercase' }}>
                    {c.status.replace('_', ' ')}
                  </span>
                </button>
              );
            })}
          </div>

          {activeCycle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Active Cycle Details Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                        Cycle #{activeCycle.cycleNumber} — {activeCycle.protocolType.replace(/_/g, ' ').toUpperCase()}
                      </h3>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: activeCycle.status === 'triggered' ? '#fef3c7' : activeCycle.status === 'ovulated_ruptured' ? '#dcfce7' : '#dbeafe',
                        color: activeCycle.status === 'triggered' ? '#b45309' : activeCycle.status === 'ovulated_ruptured' ? '#15803d' : '#1d4ed8',
                        textTransform: 'uppercase',
                      }}>
                        {activeCycle.status.replace('_', ' ')}
                      </span>
                      {activeCycle.cycleOutcome !== 'pending' && (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: activeCycle.cycleOutcome.includes('pregnancy') ? '#dcfce7' : '#fee2e2',
                          color: activeCycle.cycleOutcome.includes('pregnancy') ? '#15803d' : '#b91c1c',
                        }}>
                          {activeCycle.cycleOutcome.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#475569' }}>
                      <span><strong>LMP:</strong> {activeCycle.lmpDate}</span>
                      <span style={{ margin: '0 8px' }}>•</span>
                      <span><strong>Planned:</strong> {activeCycle.plannedProcedure.replace('_', ' ').toUpperCase()}</span>
                      {activeCycle.protocolDetails && (
                        <>
                          <span style={{ margin: '0 8px' }}>•</span>
                          <span><strong>Protocol:</strong> {activeCycle.protocolDetails}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowScanModal(true)}
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
                      + Record TVS Scan
                    </button>
                    {activeCycle.status === 'active' && (
                      <button
                        onClick={() => {
                          const now = new Date();
                          const in36h = new Date(now.getTime() + 36 * 3600 * 1000).toISOString().slice(0, 16);
                          setTriggerForm({
                            triggerDrug: 'rhCG 250 mcg (Ovitrelle) SC stat',
                            triggerDatetime: now.toISOString().slice(0, 16),
                            advisedTicIuiDatetime: in36h,
                          });
                          setShowTriggerModal(true);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#d97706',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Record Trigger (hCG)
                      </button>
                    )}
                    <button
                      onClick={() => setShowOutcomeModal(true)}
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
                      Record Outcome
                    </button>
                    <a
                      href={`/folliculometry/${activeCycle.id}/print`}
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
                      🖨️ Print Cycle Sheet
                    </a>
                  </div>
                </div>

                {/* Trigger & Insemination Alert Banner */}
                {activeCycle.triggerDatetime && (
                  <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ color: '#92400e' }}>⚡ Ovulation Trigger Given:</strong> {activeCycle.triggerDrug} on{' '}
                      <strong>{new Date(activeCycle.triggerDatetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                    </div>
                    {activeCycle.advisedTicIuiDatetime && (
                      <div style={{ color: '#78350f', fontSize: '0.85rem' }}>
                        🎯 <strong>Advised {activeCycle.plannedProcedure === 'iui' ? 'IUI' : 'Timed Intercourse'}:</strong>{' '}
                        {new Date(activeCycle.advisedTicIuiDatetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Follicular & Endometrial Growth Chart */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>Serial Follicular Growth & Endometrial Thickness Curve</h4>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#64748b' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4f46e5' }} /> Leading Follicle (mm)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#059669' }} /> Endometrial Thickness (mm)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '10px', height: '2px', background: '#dc2626' }} /> Mature Target (18mm)
                    </span>
                  </div>
                </div>

                {activeCycle.scans.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                    No scans logged yet for this cycle. Click "+ Record TVS Scan" to plot Day 2/3 baseline or serial follicle measurements.
                  </div>
                ) : (
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <svg viewBox="0 0 700 240" style={{ width: '100%', minWidth: '550px', height: '240px', background: '#fafbfc', borderRadius: '6px' }}>
                      {/* Grid Lines */}
                      {[0, 5, 10, 15, 20, 25].map((val) => {
                        const y = 200 - (val / 25) * 160;
                        return (
                          <g key={val}>
                            <line x1="50" y1={y} x2="670" y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                            <text x="42" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{val}mm</text>
                          </g>
                        );
                      })}

                      {/* Threshold lines: 18mm Mature Follicle & 7mm Endometrium */}
                      <line x1="50" y1={200 - (18 / 25) * 160} x2="670" y2={200 - (18 / 25) * 160} stroke="#fca5a5" strokeWidth="1.5" strokeDasharray="4 2" />
                      <line x1="50" y1={200 - (7 / 25) * 160} x2="670" y2={200 - (7 / 25) * 160} stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="4 2" />

                      {/* X Axis: Cycle Days (CD 2 to 20) */}
                      {[2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((cd) => {
                        const x = 50 + ((cd - 2) / 18) * 620;
                        return (
                          <g key={cd}>
                            <line x1={x} y1="40" x2={x} y2="200" stroke="#f1f5f9" />
                            <line x1={x} y1="200" x2={x} y2="205" stroke="#cbd5e1" />
                            <text x={x} y="218" textAnchor="middle" fontSize="10" fill="#64748b">CD {cd}</text>
                          </g>
                        );
                      })}

                      {/* Follicle trajectory path */}
                      {(() => {
                        const folliclePoints = activeCycle.scans
                          .filter((s) => s.leadingFollicleSizeMm != null && s.leadingFollicleSizeMm > 0)
                          .map((s) => {
                            const x = 50 + Math.max(0, Math.min(18, s.cycleDay - 2)) * (620 / 18);
                            const y = 200 - Math.min(25, s.leadingFollicleSizeMm!) * (160 / 25);
                            return { x, y, size: s.leadingFollicleSizeMm!, cd: s.cycleDay };
                          });

                        if (folliclePoints.length === 0) return null;
                        const d = folliclePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        return (
                          <g>
                            <path d={d} fill="none" stroke="#4f46e5" strokeWidth="2.5" />
                            {folliclePoints.map((p, idx) => (
                              <g key={idx}>
                                <circle cx={p.x} cy={p.y} r="5" fill="#4f46e5" stroke="#fff" strokeWidth="2" />
                                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#312e81">
                                  {p.size}mm
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })()}

                      {/* Endometrial Thickness path */}
                      {(() => {
                        const etPoints = activeCycle.scans
                          .filter((s) => s.endometrialThicknessMm != null && s.endometrialThicknessMm > 0)
                          .map((s) => {
                            const x = 50 + Math.max(0, Math.min(18, s.cycleDay - 2)) * (620 / 18);
                            const y = 200 - Math.min(25, s.endometrialThicknessMm!) * (160 / 25);
                            return { x, y, et: s.endometrialThicknessMm!, cd: s.cycleDay };
                          });

                        if (etPoints.length === 0) return null;
                        const d = etPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        return (
                          <g>
                            <path d={d} fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="3 3" />
                            {etPoints.map((p, idx) => (
                              <g key={idx}>
                                <circle cx={p.x} cy={p.y} r="4" fill="#059669" stroke="#fff" strokeWidth="1.5" />
                                <text x={p.x} y={p.y + 14} textAnchor="middle" fontSize="9" fill="#065f46">
                                  {p.et}mm
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>

              {/* Serial Scans Flowsheet Table */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>Serial Folliculometry Scans ({activeCycle.scans.length})</h4>
                  <button
                    onClick={() => setShowScanModal(true)}
                    style={{ padding: '6px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Add Scan Entry
                  </button>
                </div>

                {activeCycle.scans.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No ultrasound scans entered for this cycle yet.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '10px 14px' }}>Cycle Day</th>
                          <th style={{ padding: '10px 14px' }}>Date / Time</th>
                          <th style={{ padding: '10px 14px' }}>Right Ovary (mm)</th>
                          <th style={{ padding: '10px 14px' }}>Left Ovary (mm)</th>
                          <th style={{ padding: '10px 14px' }}>Leading Follicle</th>
                          <th style={{ padding: '10px 14px' }}>Growth Velocity</th>
                          <th style={{ padding: '10px 14px' }}>Endometrium</th>
                          <th style={{ padding: '10px 14px' }}>Staging / Advice</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCycle.scans.map((s) => {
                          const endoEval = evaluateEndometrialReceptivity(s.endometrialThicknessMm, s.endometrialPattern);
                          let stageBg = '#f1f5f9';
                          let stageColor = '#475569';
                          if (s.readinessStage === 'mature_ready_to_trigger') { stageBg = '#fef3c7'; stageColor = '#b45309'; }
                          if (s.readinessStage === 'ovulated_corpus_luteum') { stageBg = '#dcfce7'; stageColor = '#15803d'; }
                          if (s.readinessStage === 'hyperstimulation_risk') { stageBg = '#fee2e2'; stageColor = '#b91c1c'; }

                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e293b' }}>
                                CD {s.cycleDay}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#64748b' }}>
                                {new Date(s.scanDatetime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {s.rightOvaryFollicles.length > 0 ? (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {s.rightOvaryFollicles.map((f, i) => (
                                      <span key={i} style={{ padding: '1px 5px', borderRadius: '4px', background: f >= 18 ? '#ede9fe' : '#f1f5f9', fontWeight: f >= 18 ? 700 : 500, color: f >= 18 ? '#6d28d9' : '#334155' }}>
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>&lt; 10 mm</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {s.leftOvaryFollicles.length > 0 ? (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {s.leftOvaryFollicles.map((f, i) => (
                                      <span key={i} style={{ padding: '1px 5px', borderRadius: '4px', background: f >= 18 ? '#ede9fe' : '#f1f5f9', fontWeight: f >= 18 ? 700 : 500, color: f >= 18 ? '#6d28d9' : '#334155' }}>
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>&lt; 10 mm</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {s.leadingFollicleSizeMm ? (
                                  <span style={{ fontWeight: 700, color: s.leadingFollicleSizeMm >= 18 ? '#15803d' : '#0f172a' }}>
                                    {s.leadingFollicleSizeMm} mm ({s.leadingFollicleOvary})
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>None dominant</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {s.growthRateMmDay != null ? (
                                  <span style={{ fontWeight: 600, color: s.growthRateMmDay >= 1.5 ? '#059669' : '#475569' }}>
                                    +{s.growthRateMmDay} mm/d
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>Baseline</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {s.endometrialThicknessMm != null ? (
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{s.endometrialThicknessMm} mm</div>
                                    <div style={{ fontSize: '0.75rem', color: endoEval.status === 'optimal' ? '#059669' : '#64748b' }}>
                                      {endoEval.label}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: stageBg, color: stageColor }}>
                                  {(s.readinessStage || 'monitoring').replace(/_/g, ' ')}
                                </span>
                                {s.clinicalAdvice && (
                                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px', maxWidth: '200px' }}>
                                    {s.clinicalAdvice}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <button
                                  onClick={() => handleDeleteScan(s.id)}
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

      {/* Modal: Baseline Infertility Workup */}
      {showWorkupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Baseline Infertility Workup</h3>
              <button onClick={() => setShowWorkupModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleSaveWorkup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Infertility Type</label>
                  <select
                    value={workupForm.infertilityType}
                    onChange={(e) => setWorkupForm({ ...workupForm, infertilityType: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="primary">Primary Infertility</option>
                    <option value="secondary">Secondary Infertility</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Duration (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 2.5"
                    value={workupForm.durationYears}
                    onChange={(e) => setWorkupForm({ ...workupForm, durationYears: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Partner Name</label>
                  <input
                    type="text"
                    placeholder="Partner full name"
                    value={workupForm.partnerName}
                    onChange={(e) => setWorkupForm({ ...workupForm, partnerName: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Partner Age</label>
                  <input
                    type="number"
                    min="18"
                    max="80"
                    placeholder="Age"
                    value={workupForm.partnerAge}
                    onChange={(e) => setWorkupForm({ ...workupForm, partnerAge: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Ovarian Reserve & Tubal Factors */}
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.875rem', color: '#1e293b' }}>Female Factor & Ovarian Reserve</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>AMH (ng/mL)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 2.8"
                      value={workupForm.baselineAmhNgMl}
                      onChange={(e) => setWorkupForm({ ...workupForm, baselineAmhNgMl: e.target.value })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Day 2/3 FSH (mIU/mL)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 6.5"
                      value={workupForm.baselineFshMiuMl}
                      onChange={(e) => setWorkupForm({ ...workupForm, baselineFshMiuMl: e.target.value })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Total Antral Follicles (AFC)</label>
                    <input
                      type="number"
                      placeholder="e.g. 14"
                      value={workupForm.baselineAfcTotal}
                      onChange={(e) => setWorkupForm({ ...workupForm, baselineAfcTotal: e.target.value })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>HSG / HyCoSy Tubal Findings</label>
                  <input
                    type="text"
                    placeholder="e.g. Bilateral tubes patent with free peritoneal spillage"
                    value={workupForm.hsgFindings}
                    onChange={(e) => setWorkupForm({ ...workupForm, hsgFindings: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Semen Analysis WHO 6th edition */}
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', color: '#1e293b' }}>Semen Analysis (WHO 6th Edition, 2021)</h4>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: liveSemenInterp.isNormal ? '#059669' : '#d97706' }}>
                    {liveSemenInterp.classification}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Vol (mL) &gt;=1.4</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="2.5"
                      value={workupForm.semenVolumeMl}
                      onChange={(e) => setWorkupForm({ ...workupForm, semenVolumeMl: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Conc (M/mL) &gt;=16</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="45"
                      value={workupForm.semenConcentrationMilMl}
                      onChange={(e) => setWorkupForm({ ...workupForm, semenConcentrationMilMl: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Total Mot % &gt;=42</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="55"
                      value={workupForm.semenTotalMotilityPct}
                      onChange={(e) => setWorkupForm({ ...workupForm, semenTotalMotilityPct: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Prog Mot % &gt;=30</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="40"
                      value={workupForm.semenProgressiveMotilityPct}
                      onChange={(e) => setWorkupForm({ ...workupForm, semenProgressiveMotilityPct: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Morph % &gt;=4</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="5"
                      value={workupForm.semenNormalMorphologyPct}
                      onChange={(e) => setWorkupForm({ ...workupForm, semenNormalMorphologyPct: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Clinical Workup Notes</label>
                <textarea
                  rows={2}
                  placeholder="Primary infertility evaluation, ovulation induction plan..."
                  value={workupForm.clinicalNotes}
                  onChange={(e) => setWorkupForm({ ...workupForm, clinicalNotes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowWorkupModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Infertility Workup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Ovulation Cycle */}
      {showCycleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Initiate Ovulation Induction Cycle</h3>
              <button onClick={() => setShowCycleModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleCreateCycle} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Cycle #</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={cycleForm.cycleNumber}
                    onChange={(e) => setCycleForm({ ...cycleForm, cycleNumber: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>LMP Date (Cycle Day 1)</label>
                  <input
                    type="date"
                    required
                    value={cycleForm.lmpDate}
                    onChange={(e) => setCycleForm({ ...cycleForm, lmpDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Induction Protocol</label>
                  <select
                    value={cycleForm.protocolType}
                    onChange={(e) => setCycleForm({ ...cycleForm, protocolType: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="letrozole">Letrozole</option>
                    <option value="clomiphene">Clomiphene Citrate</option>
                    <option value="gonadotropins">Gonadotropins (rFSH/HMG)</option>
                    <option value="letrozole_plus_gonadotropins">Letrozole + Gonadotropins</option>
                    <option value="clomiphene_plus_gonadotropins">Clomiphene + Gonadotropins</option>
                    <option value="natural">Natural Cycle</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Planned Procedure</label>
                  <select
                    value={cycleForm.plannedProcedure}
                    onChange={(e) => setCycleForm({ ...cycleForm, plannedProcedure: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="timed_intercourse">Timed Intercourse (TIC)</option>
                    <option value="iui">Intrauterine Insemination (IUI)</option>
                    <option value="ivf_referral">IVF Conversion / Referral</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Protocol Dosage / Schedule</label>
                <input
                  type="text"
                  placeholder="e.g. Letrozole 5mg OD CD 3 to 7"
                  value={cycleForm.protocolDetails}
                  onChange={(e) => setCycleForm({ ...cycleForm, protocolDetails: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Luteal Phase Support</label>
                <input
                  type="text"
                  placeholder="e.g. Micronized Progesterone 200mg BD x 14 days"
                  value={cycleForm.lutealSupport}
                  onChange={(e) => setCycleForm({ ...cycleForm, lutealSupport: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCycleModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Folliculometry TVS Scan */}
      {showScanModal && activeCycle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Record TVS Folliculometry Scan</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Cycle #{activeCycle.cycleNumber} | LMP: {activeCycle.lmpDate}</span>
              </div>
              <button onClick={() => setShowScanModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleSaveScan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Scan Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scanForm.scanDatetime}
                    onChange={(e) => setScanForm({ ...scanForm, scanDatetime: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Cycle Day</label>
                  <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', fontWeight: 700, color: '#1e293b' }}>
                    Cycle Day {scanCycleDay}
                  </div>
                </div>
              </div>

              {/* Follicle Input Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Right Ovary Follicles (mm)</label>
                  <input
                    type="text"
                    placeholder="e.g. 18.5, 14, 11"
                    value={scanForm.rightOvaryInput}
                    onChange={(e) => setScanForm({ ...scanForm, rightOvaryInput: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Comma or space separated follicle diameters</span>
                </div>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Left Ovary Follicles (mm)</label>
                  <input
                    type="text"
                    placeholder="e.g. 13, 10"
                    value={scanForm.leftOvaryInput}
                    onChange={(e) => setScanForm({ ...scanForm, leftOvaryInput: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Comma or space separated follicle diameters</span>
                </div>
              </div>

              {/* Endometrium */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Endometrial Thickness (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 8.5"
                    value={scanForm.endometrialThicknessMm}
                    onChange={(e) => setScanForm({ ...scanForm, endometrialThicknessMm: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Endometrial Pattern</label>
                  <select
                    value={scanForm.endometrialPattern}
                    onChange={(e) => setScanForm({ ...scanForm, endometrialPattern: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="trilaminar_a">Trilaminar (Pattern A - Receptive)</option>
                    <option value="isogenous_b">Isogenous (Pattern B)</option>
                    <option value="hyperechoic_c">Hyperechoic / Luteinized (Pattern C)</option>
                    <option value="irregular">Irregular</option>
                  </select>
                </div>
              </div>

              {/* Ovulation / Rupture Checkboxes */}
              <div style={{ display: 'flex', gap: '20px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={scanForm.ovulationRuptureObserved}
                    onChange={(e) => setScanForm({ ...scanForm, ovulationRuptureObserved: e.target.checked })}
                  />
                  <span><strong>Ovulation / Rupture Observed</strong> (Dominant follicle collapsed, corpus luteum)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={scanForm.freeFluidPod}
                    onChange={(e) => setScanForm({ ...scanForm, freeFluidPod: e.target.checked })}
                  />
                  <span>Free fluid in POD (Pouch of Douglas)</span>
                </label>
              </div>

              {/* Dynamic Clinical Readiness Card */}
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: liveReadiness.ohssRisk ? '#fef2f2' : liveReadiness.triggerEligible ? '#ecfdf5' : '#f8fafc', border: `1px solid ${liveReadiness.ohssRisk ? '#fca5a5' : liveReadiness.triggerEligible ? '#6ee7b7' : '#e2e8f0'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: liveReadiness.ohssRisk ? '#b91c1c' : liveReadiness.triggerEligible ? '#065f46' : '#1e293b' }}>
                    {liveReadiness.summary}
                  </span>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Leading: <strong>{leadingFollicleEval.leadingSizeMm} mm</strong> ({leadingFollicleEval.leadingOvary})
                    {liveGrowthRate != null && ` | Growth: +${liveGrowthRate} mm/d`}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: liveReadiness.ohssRisk ? '#991b1b' : '#334155' }}>
                  {liveReadiness.recommendations.map((rec, i) => (
                    <div key={i}>• {rec}</div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Clinical Advice / Action</label>
                <input
                  type="text"
                  placeholder={liveReadiness.summary}
                  value={scanForm.clinicalAdvice}
                  onChange={(e) => setScanForm({ ...scanForm, clinicalAdvice: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowScanModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Scan Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Trigger (hCG) */}
      {showTriggerModal && activeCycle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Record Ovulation Trigger (hCG)</h3>
              <button onClick={() => setShowTriggerModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleSaveTrigger} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Trigger Medication</label>
                <input
                  type="text"
                  required
                  value={triggerForm.triggerDrug}
                  onChange={(e) => setTriggerForm({ ...triggerForm, triggerDrug: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Trigger Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={triggerForm.triggerDatetime}
                  onChange={(e) => {
                    const dt = e.target.value;
                    let advised = '';
                    if (dt) {
                      const triggerTime = new Date(dt);
                      const post36 = new Date(triggerTime.getTime() + 36 * 3600 * 1000);
                      advised = post36.toISOString().slice(0, 16);
                    }
                    setTriggerForm({ ...triggerForm, triggerDatetime: dt, advisedTicIuiDatetime: advised });
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Advised {activeCycle.plannedProcedure === 'iui' ? 'IUI Procedure' : 'Timed Intercourse'} Window
                </label>
                <input
                  type="datetime-local"
                  value={triggerForm.advisedTicIuiDatetime}
                  onChange={(e) => setTriggerForm({ ...triggerForm, advisedTicIuiDatetime: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Typically 36 hours post-trigger for IUI, or 24 & 36 hours for timed intercourse.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowTriggerModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#d97706', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Confirm Trigger Administration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Cycle Outcome */}
      {showOutcomeModal && activeCycle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Cycle Outcome</h3>
              <button onClick={() => setShowOutcomeModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleSaveOutcome} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Cycle Result</label>
                <select
                  value={outcomeForm.cycleOutcome}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, cycleOutcome: e.target.value as any })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="clinical_pregnancy">Clinical Intrauterine Pregnancy (TVS +ve cardiac activity)</option>
                  <option value="biochemical_pregnancy">Biochemical Pregnancy (Beta-hCG +ve)</option>
                  <option value="not_pregnant">Not Pregnant (Negative Beta-hCG)</option>
                  <option value="ectopic">Ectopic Gestation</option>
                  <option value="cancelled">Cycle Cancelled</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Outcome Notes</label>
                <textarea
                  rows={3}
                  placeholder="Beta hCG value, TVS gestational sac confirmation, next step plan..."
                  value={outcomeForm.outcomeNotes}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, outcomeNotes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowOutcomeModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
