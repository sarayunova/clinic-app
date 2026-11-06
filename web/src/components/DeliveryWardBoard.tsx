import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type MaternityAdmission } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field } from './ui';
import {
  calculateRuptureHours,
  isProlongedProm,
  isTachysystole,
} from '../maternityScoring';
import {
  LABOR_STAGE_LABELS,
  LOCATION_LABELS,
  MEMBRANE_STATUS_LABELS,
} from './MaternityAdmissionManager';

type FilterTab = 'active' | 'active_phase' | 'induction' | 'high_risk' | 'all';

export function DeliveryWardBoard() {
  const { can } = useAuth();
  const canWrite = can('patient:write_clinical') || can('care:write_nursing') || can('ipd:write');

  const [admissions, setAdmissions] = useState<MaternityAdmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('active');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Quick Action Modal Target
  const [activeItem, setActiveItem] = useState<MaternityAdmission | null>(null);
  const [modalType, setModalType] = useState<'progress' | 'sbar' | 'oxytocin' | 'lscs' | null>(null);

  // Modal forms
  const [quickDilation, setQuickDilation] = useState('5');
  const [quickStation, setQuickStation] = useState('0');
  const [quickStage, setQuickStage] = useState('active_phase');
  const [quickLocation, setQuickLocation] = useState('labor_room');

  const [sbarShift, setSbarShift] = useState<'morning' | 'evening' | 'night'>('morning');
  const [sbarOutgoing, setSbarOutgoing] = useState('');
  const [sbarIncoming, setSbarIncoming] = useState('');
  const [sbarSituation, setSbarSituation] = useState('');
  const [sbarBackground, setSbarBackground] = useState('');
  const [sbarAssessment, setSbarAssessment] = useState('');
  const [sbarRecommendation, setSbarRecommendation] = useState('');
  const [sbarUrgency, setSbarUrgency] = useState<'routine' | 'watch_closely' | 'immediate_attention'>('routine');

  const [oxyRate, setOxyRate] = useState('2');
  const [oxyDrops, setOxyDrops] = useState('6');
  const [oxyContractions, setOxyContractions] = useState('3');
  const [oxyDuration, setOxyDuration] = useState('45');
  const [oxyIntensity, setOxyIntensity] = useState<'mild' | 'moderate' | 'strong'>('moderate');
  const [oxyFhr, setOxyFhr] = useState('140');
  const [oxyAction, setOxyAction] = useState('Titrated per protocol');

  const [lscsIndication, setLscsIndication] = useState('');
  const [lscsCategory, setLscsCategory] = useState('category_1_immediate_threat');
  const [lscsTargetMins, setLscsTargetMins] = useState(30);
  const [lscsAnesthetist, setLscsAnesthetist] = useState(false);
  const [lscsPediatrician, setLscsPediatrician] = useState(false);
  const [lscsConsent, setLscsConsent] = useState(false);
  const [lscsIv, setLscsIv] = useState(false);
  const [lscsBlood, setLscsBlood] = useState(false);
  const [lscsAntacid, setLscsAntacid] = useState(false);
  const [lscsAntibiotics, setLscsAntibiotics] = useState(false);
  const [lscsFoley, setLscsFoley] = useState(false);
  const [lscsPrep, setLscsPrep] = useState(false);
  const [lscsOtReady, setLscsOtReady] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<{ count: number; admissions: MaternityAdmission[] }>(
        'GET',
        filter === 'all' ? '/api/maternity-admissions?activeOnly=false' : '/api/maternity-admissions?activeOnly=true'
      );
      setAdmissions(res.admissions);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadBoard();
    const interval = setInterval(() => void loadBoard(), 45_000); // auto-refresh board every 45s
    return () => clearInterval(interval);
  }, [loadBoard]);

  // Filtered admissions
  const filteredAdmissions = admissions.filter((a) => {
    if (filter === 'active_phase') return a.laborStage === 'active_phase' || a.laborStage === 'second_stage';
    if (filter === 'induction') return a.status === 'induction' || Boolean(a.activeOxytocinRate);
    if (filter === 'high_risk') return Boolean(a.highRiskAlerts) || a.lscsPrepActive;
    return true;
  });

  // Summary Metrics
  const activeCount = admissions.filter((a) => a.status === 'in_labor' || a.status === 'induction').length;
  const activePhaseCount = admissions.filter((a) => a.laborStage === 'active_phase' || a.laborStage === 'second_stage').length;
  const oxytocinCount = admissions.filter((a) => Boolean(a.activeOxytocinRate)).length;
  const prolongedPromCount = admissions.filter((a) => isProlongedProm(calculateRuptureHours(a.membraneRupturedAt))).length;
  const lscsActiveCount = admissions.filter((a) => a.lscsPrepActive).length;

  const openModal = (item: MaternityAdmission, type: 'progress' | 'sbar' | 'oxytocin' | 'lscs') => {
    setActiveItem(item);
    setModalType(type);

    if (type === 'progress') {
      setQuickDilation(item.latestCervicalDilationCm != null ? String(item.latestCervicalDilationCm) : '5');
      setQuickStation(item.latestFetalStation || '0');
      setQuickStage(item.laborStage);
      setQuickLocation(item.currentLocation);
    } else if (type === 'sbar') {
      setSbarSituation(`Patient in ${LOCATION_LABELS[item.currentLocation] || item.currentLocation}. Cervix at ${item.latestCervicalDilationCm ?? '—'} cm.`);
      setSbarBackground(`G${item.gravida || 1} P${item.para || 0}, ${item.gestationalAgeWeeks || 39}w. ${item.highRiskAlerts || 'No prior complications'}.`);
      setSbarAssessment(`Contractions regular, FHR ${item.fetalHeartRate || 140} bpm (${item.ctgCategory}). Membranes: ${item.membraneStatus}.`);
      setSbarRecommendation('Continue active management. Next vaginal exam in 2 hours.');
      setSbarUrgency('routine');
    } else if (type === 'oxytocin') {
      setOxyRate('2');
      setOxyDrops('6');
      setOxyContractions('3');
      setOxyDuration('45');
      setOxyIntensity('moderate');
      setOxyFhr(item.fetalHeartRate ? String(item.fetalHeartRate) : '140');
      setOxyAction('Dose titrated per protocol.');
    } else if (type === 'lscs') {
      setLscsIndication('Fetal distress / Failure to progress');
      setLscsCategory('category_1_immediate_threat');
      setLscsTargetMins(30);
      setLscsAnesthetist(false);
      setLscsPediatrician(false);
      setLscsConsent(false);
      setLscsIv(false);
      setLscsBlood(false);
      setLscsAntacid(false);
      setLscsAntibiotics(false);
      setLscsFoley(false);
      setLscsPrep(false);
      setLscsOtReady(false);
    }
  };

  const handleSaveProgress = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setBusy(true);
    setError(null);
    try {
      await api('PATCH', `/api/maternity-admissions/${activeItem.id}`, {
        latestCervicalDilationCm: Number(quickDilation),
        latestFetalStation: quickStation,
        laborStage: quickStage,
        currentLocation: quickLocation,
      });
      setSuccessBanner(`Updated labor progress for ${activeItem.patientName}`);
      setModalType(null);
      await loadBoard();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSbar = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/maternity-admissions/${activeItem.id}/handover`, {
        shiftName: sbarShift,
        outgoingStaff: sbarOutgoing.trim(),
        incomingStaff: sbarIncoming.trim(),
        situation: sbarSituation.trim(),
        background: sbarBackground.trim(),
        assessment: sbarAssessment.trim(),
        recommendation: sbarRecommendation.trim(),
        urgencyLevel: sbarUrgency,
      });
      setSuccessBanner(`SBAR handover recorded for ${activeItem.patientName}`);
      setModalType(null);
      await loadBoard();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOxytocin = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/maternity-admissions/${activeItem.id}/oxytocin`, {
        infusionRateMUPerMin: Number(oxyRate),
        dropsPerMin: oxyDrops ? Number(oxyDrops) : null,
        contractionsPer10min: Number(oxyContractions),
        contractionDurationSec: Number(oxyDuration),
        contractionIntensity: oxyIntensity,
        fetalHeartRate: Number(oxyFhr),
        actionTaken: oxyAction.trim() || null,
      });
      setSuccessBanner(`Oxytocin titration step recorded for ${activeItem.patientName}`);
      setModalType(null);
      await loadBoard();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLscs = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setBusy(true);
    setError(null);
    try {
      await api('PUT', `/api/maternity-admissions/${activeItem.id}/lscs-checklist`, {
        lscsCategory,
        decisionToDeliveryTargetMins: lscsTargetMins,
        surgicalIndication: lscsIndication.trim() || 'Fetal distress / Failure to progress',
        anesthetistNotified: lscsAnesthetist,
        pediatricianNotified: lscsPediatrician,
        consentSigned: lscsConsent,
        wideBoreIvAccess: lscsIv,
        bloodArranged: lscsBlood,
        preopAntacidGiven: lscsAntacid,
        antibioticProphylaxisGiven: lscsAntibiotics,
        foleyCatheterInserted: lscsFoley,
        abdominalPrepDone: lscsPrep,
        otReady: lscsOtReady,
      });
      setSuccessBanner(`Emergency LSCS readiness checklist updated for ${activeItem.patientName}`);
      setModalType(null);
      await loadBoard();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      {/* Top Header */}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🏥</span> Delivery Ward & Labor Handover Board
          </h2>
          <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
            Live clinical tracking of laboring mothers, cervical dilation, PROM timers, oxytocin infusions, and SBAR shift handovers.
          </p>
        </div>
        <div className="row wrap" style={{ gap: '0.5rem' }}>
          <button type="button" className="btn small" onClick={() => void loadBoard()} disabled={loading}>
            🔄 Refresh Board
          </button>
          <Link to="/wards" className="btn small">
            🛏️ Inpatient Wards
          </Link>
          <Link to="/station" className="btn small">
            🩺 Nurse Station
          </Link>
        </div>
      </div>

      <ErrorBanner error={error} />

      {successBanner && (
        <div className="banner ok" role="status">
          ✓ {successBanner}
        </div>
      )}

      {/* Ward Metrics Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>Active In Labor Ward</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8' }}>{activeCount}</div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Active Phase (≥5 cm)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d' }}>{activePhaseCount}</div>
        </div>

        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: 600, textTransform: 'uppercase' }}>Oxytocin Infusion</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7e22ce' }}>{oxytocinCount}</div>
        </div>

        <div style={{ background: prolongedPromCount > 0 ? '#fff1f2' : '#f8fafc', border: `1px solid ${prolongedPromCount > 0 ? '#fecdd3' : '#e2e8f0'}`, borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
          <div style={{ fontSize: '0.75rem', color: prolongedPromCount > 0 ? '#be123c' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Prolonged PROM (&gt;18h)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: prolongedPromCount > 0 ? '#e11d48' : '#334155' }}>{prolongedPromCount}</div>
        </div>

        <div style={{ background: lscsActiveCount > 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${lscsActiveCount > 0 ? '#fca5a5' : '#e2e8f0'}`, borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
          <div style={{ fontSize: '0.75rem', color: lscsActiveCount > 0 ? '#991b1b' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Emergency LSCS Prep</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: lscsActiveCount > 0 ? '#dc2626' : '#334155' }}>{lscsActiveCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="row wrap" style={{ gap: '0.4rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`btn small ${filter === 'active' ? 'primary' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active Laboring ({admissions.filter((a) => a.status === 'in_labor' || a.status === 'induction').length})
        </button>
        <button
          type="button"
          className={`btn small ${filter === 'active_phase' ? 'primary' : ''}`}
          onClick={() => setFilter('active_phase')}
        >
          Active Phase ≥5 cm ({activePhaseCount})
        </button>
        <button
          type="button"
          className={`btn small ${filter === 'induction' ? 'primary' : ''}`}
          onClick={() => setFilter('induction')}
        >
          Oxytocin / Induction ({oxytocinCount})
        </button>
        <button
          type="button"
          className={`btn small ${filter === 'high_risk' ? 'primary' : ''}`}
          onClick={() => setFilter('high_risk')}
        >
          High Risk & LSCS ({admissions.filter((a) => Boolean(a.highRiskAlerts) || a.lscsPrepActive).length})
        </button>
        <button
          type="button"
          className={`btn small ${filter === 'all' ? 'primary' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Admissions ({admissions.length})
        </button>
      </div>

      {/* Patient Cards Grid */}
      {loading ? (
        <p className="muted">Loading Delivery Ward Handover Board…</p>
      ) : filteredAdmissions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="muted" style={{ margin: 0 }}>No laboring mothers found matching the selected filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
          {filteredAdmissions.map((adm) => {
            const promDuration = calculateRuptureHours(adm.membraneRupturedAt);
            const isProlonged = isProlongedProm(promDuration);
            const isFullDilation = (adm.latestCervicalDilationCm ?? 0) >= 10;
            const isActivePhase = (adm.latestCervicalDilationCm ?? 0) >= 5;

            return (
              <div
                key={adm.id}
                className="card stack"
                style={{
                  borderLeft: `5px solid ${
                    adm.lscsPrepActive
                      ? '#dc2626'
                      : isFullDilation
                      ? '#ca8a04'
                      : isActivePhase
                      ? '#16a34a'
                      : '#2563eb'
                  }`,
                  background: '#fff',
                  padding: '1rem',
                  gap: '0.6rem',
                }}
              >
                {/* Bed Location & Status Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span
                      style={{
                        background: '#dbeafe',
                        color: '#1e40af',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {adm.bedRoom && adm.bedLabel ? `${adm.bedRoom} / Bed ${adm.bedLabel}` : LOCATION_LABELS[adm.currentLocation] || adm.currentLocation}
                    </span>
                    <h4 style={{ margin: '0.2rem 0 0 0', fontSize: '1.05rem' }}>
                      <Link to={`/patients/${adm.patientId}`}>{adm.patientName}</Link>{' '}
                      <span className="muted small">({adm.patientNumber})</span>
                    </h4>
                    <div className="small muted">
                      G{adm.gravida || 1} P{adm.para || 0} · GA: {adm.gestationalAgeWeeks ? `${adm.gestationalAgeWeeks}w ${adm.gestationalAgeDays || 0}d` : 'Term'} · Blood: {adm.bloodGroup || 'O+'}
                    </div>
                  </div>

                  {/* Stage Badge */}
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: isFullDilation ? '#fef08a' : isActivePhase ? '#dcfce7' : '#f1f5f9',
                        color: isFullDilation ? '#854d0e' : isActivePhase ? '#15803d' : '#334155',
                      }}
                    >
                      {LABOR_STAGE_LABELS[adm.laborStage] || adm.laborStage}
                    </span>
                    {adm.lscsPrepActive && (
                      <div
                        style={{
                          marginTop: '0.2rem',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#dc2626',
                          background: '#fee2e2',
                          padding: '1px 6px',
                          borderRadius: '3px',
                        }}
                      >
                        🚨 LSCS PREP
                      </div>
                    )}
                  </div>
                </div>

                {/* High-Risk Alert Pill if any */}
                {adm.highRiskAlerts && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#991b1b' }}>
                    <strong>⚠️ Alert:</strong> {adm.highRiskAlerts}
                  </div>
                )}

                {/* Key Progression Indicators */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                  <div>
                    <span className="muted">Dilation: </span>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                      {adm.latestCervicalDilationCm != null ? `${adm.latestCervicalDilationCm} cm` : '—'}
                    </strong>
                    <div className="small muted">Station: {adm.latestFetalStation || '0'}</div>
                  </div>

                  <div>
                    <span className="muted">FHR / CTG: </span>
                    <strong style={{ fontSize: '0.95rem' }}>{adm.fetalHeartRate ? `${adm.fetalHeartRate} bpm` : '—'}</strong>
                    <div className="small muted">{adm.ctgCategory.toUpperCase()}</div>
                  </div>

                  <div>
                    <span className="muted">Oxytocin: </span>
                    <strong style={{ fontSize: '0.85rem', color: '#2563eb' }}>{adm.activeOxytocinRate || 'None'}</strong>
                    <div className="small muted">Bishop: {adm.bishopTotalScore}/13</div>
                  </div>
                </div>

                {/* Membranes & PROM Timer */}
                <div style={{ fontSize: '0.8rem' }}>
                  <span className="muted">Membranes: </span>
                  <strong style={{ color: isProlonged ? '#be123c' : '#334155' }}>
                    {MEMBRANE_STATUS_LABELS[adm.membraneStatus] || adm.membraneStatus}
                  </strong>
                  {adm.membraneRupturedAt && (
                    <span style={{ marginLeft: '0.3rem', color: isProlonged ? '#dc2626' : '#64748b', fontWeight: isProlonged ? 700 : 400 }}>
                      ({promDuration != null ? `${promDuration} hrs` : ''} {isProlonged ? '⚠️ PROLONGED PROM' : ''})
                    </span>
                  )}
                </div>

                {/* Latest SBAR Recommendation Snippet */}
                {adm.latestHandover && (
                  <div style={{ background: '#f1f5f9', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    <strong style={{ color: '#0369a1' }}>Latest SBAR ({adm.latestHandover.shiftName.toUpperCase()}): </strong>
                    <span>{adm.latestHandover.recommendation}</span>
                  </div>
                )}

                {/* Quick Action Buttons */}
                <div className="row wrap" style={{ gap: '0.3rem', marginTop: '0.3rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        className="btn tiny"
                        onClick={() => openModal(adm, 'progress')}
                      >
                        📏 Progress
                      </button>
                      <button
                        type="button"
                        className="btn tiny"
                        onClick={() => openModal(adm, 'sbar')}
                      >
                        ✍️ SBAR
                      </button>
                      <button
                        type="button"
                        className="btn tiny"
                        onClick={() => openModal(adm, 'oxytocin')}
                      >
                        💉 Oxytocin
                      </button>
                      <button
                        type="button"
                        className={`btn tiny ${adm.lscsPrepActive ? 'danger' : ''}`}
                        onClick={() => openModal(adm, 'lscs')}
                      >
                        🚨 LSCS
                      </button>
                    </>
                  )}
                  <Link to={`/maternity-admissions/${adm.id}/print`} className="btn tiny primary" style={{ marginLeft: 'auto' }}>
                    🖨️ Chart
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK MODAL 1: Update Progress */}
      {modalType === 'progress' && activeItem && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '440px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0 }}>Update Dilation & Station — {activeItem.patientName}</h4>
              <button type="button" className="btn small" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveProgress} className="stack" style={{ gap: '0.75rem' }}>
              <div className="grid-2" style={{ gap: '0.5rem' }}>
                <Field label="Cervical Dilation (cm)">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    required
                    value={quickDilation}
                    onChange={(e) => setQuickDilation(e.target.value)}
                  />
                </Field>
                <Field label="Fetal Station">
                  <input
                    type="text"
                    value={quickStation}
                    onChange={(e) => setQuickStation(e.target.value)}
                  />
                </Field>
                <Field label="Labor Stage">
                  <select value={quickStage} onChange={(e) => setQuickStage(e.target.value)}>
                    {Object.entries(LABOR_STAGE_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>{lbl}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Location">
                  <select value={quickLocation} onChange={(e) => setQuickLocation(e.target.value)}>
                    {Object.entries(LOCATION_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>{lbl}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setModalType(null)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 2: SBAR Handover */}
      {modalType === 'sbar' && activeItem && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '600px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0 }}>SBAR Shift Handover — {activeItem.patientName}</h4>
              <button type="button" className="btn small" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveSbar} className="stack" style={{ gap: '0.6rem' }}>
              <div className="grid-3" style={{ gap: '0.5rem' }}>
                <Field label="Shift">
                  <select value={sbarShift} onChange={(e) => setSbarShift(e.target.value as any)}>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                    <option value="night">Night</option>
                  </select>
                </Field>
                <Field label="Outgoing Staff">
                  <input type="text" required value={sbarOutgoing} onChange={(e) => setSbarOutgoing(e.target.value)} />
                </Field>
                <Field label="Incoming Staff">
                  <input type="text" required value={sbarIncoming} onChange={(e) => setSbarIncoming(e.target.value)} />
                </Field>
              </div>
              <Field label="S — Situation">
                <textarea rows={2} required value={sbarSituation} onChange={(e) => setSbarSituation(e.target.value)} />
              </Field>
              <Field label="B — Background">
                <textarea rows={2} required value={sbarBackground} onChange={(e) => setSbarBackground(e.target.value)} />
              </Field>
              <Field label="A — Assessment">
                <textarea rows={2} required value={sbarAssessment} onChange={(e) => setSbarAssessment(e.target.value)} />
              </Field>
              <Field label="R — Recommendation">
                <textarea rows={2} required value={sbarRecommendation} onChange={(e) => setSbarRecommendation(e.target.value)} />
              </Field>
              <Field label="Urgency">
                <select value={sbarUrgency} onChange={(e) => setSbarUrgency(e.target.value as any)}>
                  <option value="routine">Routine</option>
                  <option value="watch_closely">Watch Closely</option>
                  <option value="immediate_attention">Immediate Attention</option>
                </select>
              </Field>
              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setModalType(null)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Record Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 3: Oxytocin Titration */}
      {modalType === 'oxytocin' && activeItem && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '500px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0 }}>Oxytocin Titration — {activeItem.patientName}</h4>
              <button type="button" className="btn small" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveOxytocin} className="stack" style={{ gap: '0.6rem' }}>
              <div className="grid-2" style={{ gap: '0.5rem' }}>
                <Field label="Rate (mU/min)">
                  <input type="number" step="0.5" required value={oxyRate} onChange={(e) => setOxyRate(e.target.value)} />
                </Field>
                <Field label="Drops / min">
                  <input type="number" value={oxyDrops} onChange={(e) => setOxyDrops(e.target.value)} />
                </Field>
                <Field label="Contractions / 10m">
                  <input type="number" required value={oxyContractions} onChange={(e) => setOxyContractions(e.target.value)} />
                </Field>
                <Field label="Duration (s)">
                  <input type="number" required value={oxyDuration} onChange={(e) => setOxyDuration(e.target.value)} />
                </Field>
                <Field label="Intensity">
                  <select value={oxyIntensity} onChange={(e) => setOxyIntensity(e.target.value as any)}>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="strong">Strong</option>
                  </select>
                </Field>
                <Field label="FHR (bpm)">
                  <input type="number" required value={oxyFhr} onChange={(e) => setOxyFhr(e.target.value)} />
                </Field>
              </div>

              {isTachysystole(Number(oxyContractions), Number(oxyDuration)) && (
                <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.4rem', color: '#991b1b', fontSize: '0.8rem' }}>
                  <strong>⚠️ TACHYSYSTOLE:</strong> &gt;5 contractions in 10m or &gt;90s duration. Review infusion rate!
                </div>
              )}

              <Field label="Action">
                <input type="text" value={oxyAction} onChange={(e) => setOxyAction(e.target.value)} />
              </Field>

              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setModalType(null)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Record Titration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 4: Emergency LSCS Prep */}
      {modalType === 'lscs' && activeItem && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '580px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0, color: '#dc2626' }}>Emergency LSCS Prep — {activeItem.patientName}</h4>
              <button type="button" className="btn small" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveLscs} className="stack" style={{ gap: '0.6rem' }}>
              <Field label="Surgical Indication">
                <input type="text" required value={lscsIndication} onChange={(e) => setLscsIndication(e.target.value)} />
              </Field>
              <div className="grid-2" style={{ gap: '0.5rem' }}>
                <Field label="Urgency Category">
                  <select value={lscsCategory} onChange={(e) => {
                    setLscsCategory(e.target.value);
                    setLscsTargetMins(e.target.value === 'category_1_immediate_threat' ? 30 : 75);
                  }}>
                    <option value="category_1_immediate_threat">Cat 1 — Immediate (≤30 min)</option>
                    <option value="category_2_maternal_fetal_compromise">Cat 2 — Compromise (≤75 min)</option>
                  </select>
                </Field>
                <Field label="Target Time (mins)">
                  <input type="number" value={lscsTargetMins} onChange={(e) => setLscsTargetMins(Number(e.target.value))} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.85rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsAnesthetist} onChange={(e) => setLscsAnesthetist(e.target.checked)} />
                  Anesthetist Notified
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsPediatrician} onChange={(e) => setLscsPediatrician(e.target.checked)} />
                  Pediatrician / NICU Notified
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsConsent} onChange={(e) => setLscsConsent(e.target.checked)} />
                  Consent Signed
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsIv} onChange={(e) => setLscsIv(e.target.checked)} />
                  16G/18G IV Access Patent
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsBlood} onChange={(e) => setLscsBlood(e.target.checked)} />
                  Blood Crossmatched / Arranged
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsAntacid} onChange={(e) => setLscsAntacid(e.target.checked)} />
                  Pre-op Antacid Given
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsAntibiotics} onChange={(e) => setLscsAntibiotics(e.target.checked)} />
                  Antibiotic Prophylaxis Given
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsFoley} onChange={(e) => setLscsFoley(e.target.checked)} />
                  Foley Catheter Inserted
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={lscsPrep} onChange={(e) => setLscsPrep(e.target.checked)} />
                  Abdominal Prep Done
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#16a34a' }}>
                  <input type="checkbox" checked={lscsOtReady} onChange={(e) => setLscsOtReady(e.target.checked)} />
                  OT READY for Transfer
                </label>
              </div>

              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setModalType(null)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn danger" disabled={busy}>
                  {busy ? 'Saving…' : 'Save LSCS Checklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
