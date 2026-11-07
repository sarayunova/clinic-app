import React, { useEffect, useState, useTransition } from 'react';
import { Link } from 'react-router-dom';
import {
  getLiveWardBoard,
  createWardHandover,
  acknowledgeCriticalAlert,
  type LiveWardBoardResponse,
  type OccupiedWardAdmission,
  type WardHandoverNote,
} from '../api';
import { wardAudio, getDeteriorationBadge } from '../wardBoardEngine';

export function WardBoardPage() {
  const [data, setData] = useState<LiveWardBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [selectedWard, setSelectedWard] = useState<string>('All');
  const [isMuted, setIsMuted] = useState<boolean>(wardAudio.getMuted());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Handover Modal State
  const [handoverModalAdmission, setHandoverModalAdmission] = useState<OccupiedWardAdmission | null>(null);
  const [shiftType, setShiftType] = useState<'morning' | 'evening' | 'night'>('morning');
  const [shiftDate, setShiftDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [situation, setSituation] = useState('');
  const [background, setBackground] = useState('');
  const [assessment, setAssessment] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');
  const [ivFluidsStatus, setIvFluidsStatus] = useState('');
  const [dietaryOrder, setDietaryOrder] = useState('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

  // Load Ward Data
  const refreshBoard = async () => {
    try {
      const res = await getLiveWardBoard();
      setData(res);
      setLastUpdated(new Date());
      setError(null);

      // Trigger alarm if there are active critical red patients and audio is unmuted
      if (res.stats.criticalRedCount > 0 && !wardAudio.getMuted()) {
        wardAudio.playCriticalAlarm();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load live ward board');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBoard();
    // Auto-refresh every 20 seconds
    const interval = setInterval(refreshBoard, 20000);
    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    wardAudio.setMuted(next);
  };

  const handleOpenHandover = (adm: OccupiedWardAdmission) => {
    setHandoverModalAdmission(adm);
    setShiftType('morning');
    setShiftDate(new Date().toISOString().slice(0, 10));
    setSituation(
      `Bed ${adm.bedNumber} (${adm.ward}): ${adm.patientName ?? 'Patient'} (UHID: ${adm.uhid ?? '-'}). Primary diagnosis: ${adm.primaryDiagnosis ?? 'Inpatient care'}.`
    );
    setBackground(
      adm.gravida !== undefined && adm.gravida !== null
        ? `G${adm.gravida}P${adm.para ?? 0}, LMP: ${adm.lastMenstrualPeriod ?? 'N/A'}. Admitted: ${adm.admittedAt ? new Date(adm.admittedAt).toLocaleDateString('en-IN') : 'N/A'}.`
        : `Admitted on ${adm.admittedAt ? new Date(adm.admittedAt).toLocaleDateString('en-IN') : 'N/A'}.`
    );
    setAssessment(
      adm.triggerReasons && adm.triggerReasons.length > 0
        ? `Status: ${adm.deteriorationStatus}. Alerts: ${adm.triggerReasons.join(', ')}.`
        : `Vitals stable. Alert status: ${adm.deteriorationStatus}.`
    );
    setRecommendation('Continue charted medications and 4-hourly bedside vital observations.');
    setPendingTasks('');
    setIvFluidsStatus('RL 500 mL IV @ 80 mL/h');
    setDietaryOrder('Normal post-op / antenatal soft diet');
  };

  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverModalAdmission?.admissionId) return;
    setHandoverSubmitting(true);
    try {
      const tasksArray = pendingTasks
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);

      await createWardHandover({
        admissionId: handoverModalAdmission.admissionId,
        shiftType,
        shiftDate,
        situation,
        background,
        assessment,
        recommendation,
        pendingTasks: tasksArray,
        ivFluidsStatus: ivFluidsStatus || null,
        dietaryOrder: dietaryOrder || null,
      });

      setHandoverModalAdmission(null);
      await refreshBoard();
    } catch (err: any) {
      alert(err?.message || 'Error recording handover note');
    } finally {
      setHandoverSubmitting(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await acknowledgeCriticalAlert(alertId, 'Bedside nurse acknowledged alert');
      await refreshBoard();
    } catch (err: any) {
      alert(err?.message || 'Error acknowledging alert');
    }
  };

  // Distinct wards for filter
  const wardOptions = ['All', ...Array.from(new Set(data?.allBeds.map((b) => b.ward).filter(Boolean) ?? []))];

  const filteredBeds = (data?.allBeds ?? []).filter((b) => {
    if (selectedWard === 'All') return true;
    return b.ward === selectedWard;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Live Inpatient Ward Board</h1>
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-slate-500">
              Live Sync ({lastUpdated.toLocaleTimeString('en-IN')})
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time bedside monitoring, critical deterioration triggers, and SBAR shift handovers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Audio Alarm Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-2 transition ${
              isMuted
                ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
            title={isMuted ? 'Audio alerts are currently MUTED' : 'Audio alerts are ACTIVE'}
          >
            {isMuted ? (
              <>
                <span className="text-slate-400">🔇</span> Sound Muted
              </>
            ) : (
              <>
                <span className="text-amber-600 animate-bounce">🔔</span> Sound Active
              </>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                refreshBoard();
              });
            }}
            disabled={loading || isPending}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition"
          >
            ↻ Refresh
          </button>

          {/* Printable Handover Sheet Link */}
          <Link
            to="/ward-board/handover-print"
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition flex items-center gap-1.5"
          >
            🖨️ Print Shift Handover
          </Link>
        </div>
      </div>

      {/* KPI Statistic Badges */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Beds</div>
            <div className="text-2xl font-black text-slate-800 mt-1">{data.stats.totalBeds}</div>
            <div className="text-xs text-slate-400 mt-0.5">Configured clinical capacity</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Occupied Beds</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{data.stats.occupiedCount}</div>
            <div className="text-xs text-blue-500 mt-0.5">
              {data.stats.totalBeds > 0
                ? `${Math.round((data.stats.occupiedCount / data.stats.totalBeds) * 100)}% occupancy`
                : '0% occupancy'}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Vacant Beds</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{data.stats.vacantCount}</div>
            <div className="text-xs text-emerald-500 mt-0.5">Ready for admission</div>
          </div>

          <div
            className={`p-3.5 rounded-xl border shadow-sm transition ${
              data.stats.criticalRedCount > 0
                ? 'bg-red-50 border-red-300 animate-pulse'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
              {data.stats.criticalRedCount > 0 && <span>⚠️</span>} Critical Red Alerts
            </div>
            <div className="text-2xl font-black text-red-700 mt-1">{data.stats.criticalRedCount}</div>
            <div className="text-xs text-red-600 mt-0.5">Requires immediate doctor review</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Yellow Warnings</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{data.stats.warningYellowCount}</div>
            <div className="text-xs text-amber-600 mt-0.5">Close observation watchlist</div>
          </div>
        </div>
      )}

      {/* Ward Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {wardOptions.map((ward) => (
          <button
            key={ward}
            type="button"
            onClick={() => setSelectedWard(ward)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedWard === ward
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {ward} {ward === 'All' ? `(${data?.allBeds.length ?? 0})` : ''}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Beds Grid */}
      {loading && !data ? (
        <div className="py-12 text-center text-slate-400">Loading live ward status...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredBeds.map((bed) => {
            const occupied = data?.occupiedAdmissions.find((occ) => occ.bedId === bed.bedId);

            if (!occupied) {
              // Vacant Bed Card
              return (
                <div
                  key={bed.bedId}
                  className="bg-slate-50/70 border border-dashed border-slate-300 rounded-xl p-4 flex flex-col justify-between min-h-[220px]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{bed.ward}</span>
                      <h3 className="text-lg font-bold text-slate-700">Bed {bed.bedNumber}</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700">
                      AVAILABLE
                    </span>
                  </div>
                  <div className="my-auto text-center py-4 text-slate-400 text-sm">
                    Bed is sanitised & ready for admission
                  </div>
                  <div className="text-xs text-slate-400 flex justify-between border-t border-slate-200 pt-2">
                    <span>Active: Yes</span>
                    <span>No active admission</span>
                  </div>
                </div>
              );
            }

            // Occupied Bed Card with Clinical Deterioration Status
            const badge = getDeteriorationBadge(occupied.deteriorationStatus);

            return (
              <div
                key={bed.bedId}
                className={`rounded-xl border shadow-sm flex flex-col justify-between transition ${badge.borderClass} p-4`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{bed.ward}</span>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      Bed {bed.bedNumber}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.badgeClass}`}>
                        {badge.badgeLabel}
                      </span>
                    </h3>
                  </div>

                  {occupied.patientId && (
                    <Link
                      to={`/patients/${occupied.patientId}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                    >
                      UHID: {occupied.uhid}
                    </Link>
                  )}
                </div>

                {/* Patient Information & Clinical Details */}
                <div className="py-3 space-y-2 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-slate-800 text-base">{occupied.patientName}</span>
                    <span className="text-xs text-slate-500">
                      {occupied.ageYears ? `${occupied.ageYears} yrs` : ''}
                      {occupied.gravida !== null && occupied.gravida !== undefined
                        ? ` · G${occupied.gravida}P${occupied.para ?? 0}`
                        : ''}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Diagnosis: </span>
                    {occupied.primaryDiagnosis || 'Inpatient admission'}
                  </div>

                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>
                      Doctor: <strong className="text-slate-700">{occupied.attendingDoctorName || 'Duty Consultant'}</strong>
                    </span>
                    <span>
                      Adm:{' '}
                      {occupied.admittedAt
                        ? new Date(occupied.admittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '-'}
                    </span>
                  </div>

                  {/* Trigger Reasons / Alert Warnings */}
                  {occupied.triggerReasons && occupied.triggerReasons.length > 0 && (
                    <div className="p-2 rounded-lg bg-red-100/70 border border-red-200 text-xs text-red-800 space-y-0.5">
                      <div className="font-bold flex items-center gap-1">
                        <span>⚠️ Alerts Detected:</span>
                      </div>
                      {occupied.triggerReasons.map((trig, idx) => (
                        <div key={idx} className="pl-3 relative before:content-['•'] before:absolute before:left-0.5">
                          {trig}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active Alerts with Acknowledgement */}
                  {occupied.activeAlerts && occupied.activeAlerts.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {occupied.activeAlerts.map((alt: any) => (
                        <div
                          key={alt.id}
                          className="flex items-center justify-between text-xs bg-red-600 text-white p-1.5 rounded-md"
                        >
                          <span>{alt.trigger_reason}</span>
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeAlert(alt.id)}
                            className="bg-white text-red-700 font-bold px-1.5 py-0.5 rounded text-[10px] hover:bg-red-50"
                          >
                            ACK
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Latest MEOWS / Vitals Snapshot */}
                  {occupied.latestMeows && (
                    <div className="bg-slate-50 p-2 rounded-lg text-xs text-slate-700 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        BP:{' '}
                        <strong>
                          {occupied.latestMeows.bp_systolic}/{occupied.latestMeows.bp_diastolic}
                        </strong>
                      </span>
                      <span>
                        HR: <strong>{occupied.latestMeows.heart_rate}</strong> bpm
                      </span>
                      <span>
                        RR: <strong>{occupied.latestMeows.respiratory_rate}</strong>
                      </span>
                      <span>
                        SpO2: <strong>{occupied.latestMeows.spo2_percent}%</strong>
                      </span>
                      <span>
                        Temp: <strong>{occupied.latestMeows.temperature_c}°C</strong>
                      </span>
                    </div>
                  )}

                  {/* Latest SNCU Vitals if neonate */}
                  {occupied.sncuRecord && (
                    <div className="bg-blue-50 p-2 rounded-lg text-xs text-blue-900 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        Silverman: <strong>{occupied.sncuRecord.silverman_anderson_score ?? '-'}</strong>
                      </span>
                      <span>
                        Downes: <strong>{occupied.sncuRecord.downes_score ?? '-'}</strong>
                      </span>
                      <span>
                        Support: <strong>{occupied.sncuRecord.respiratory_support}</strong>
                      </span>
                      <span>
                        Wt: <strong>{occupied.sncuRecord.current_weight_g ?? occupied.sncuRecord.birth_weight_g}g</strong>
                      </span>
                    </div>
                  )}

                  {/* Latest Shift Handover Note */}
                  {occupied.latestHandover && (
                    <div className="border-t border-slate-200 pt-2 text-xs text-slate-600">
                      <div className="flex justify-between items-center text-slate-500 mb-0.5">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">
                          Last SBAR ({occupied.latestHandover.shift_type} shift)
                        </span>
                        <span>{occupied.latestHandover.nurse_name}</span>
                      </div>
                      <p className="line-clamp-2 italic text-slate-700">
                        &quot;{occupied.latestHandover.assessment}&quot;
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenHandover(occupied)}
                    className="w-full text-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 transition"
                  >
                    + Shift Handover (SBAR)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SBAR Shift Handover Drawer / Modal */}
      {handoverModalAdmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Bedside Shift Handover
                </span>
                <h2 className="text-xl font-bold text-slate-800">
                  SBAR Record: Bed {handoverModalAdmission.bedNumber} ({handoverModalAdmission.ward})
                </h2>
                <p className="text-xs text-slate-500">
                  Patient: {handoverModalAdmission.patientName} (UHID: {handoverModalAdmission.uhid})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHandoverModalAdmission(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitHandover} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Type</label>
                  <select
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value as any)}
                    className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  >
                    <option value="morning">Morning Shift (07:00 - 15:00)</option>
                    <option value="evening">Evening Shift (15:00 - 22:00)</option>
                    <option value="night">Night Shift (22:00 - 07:00)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Date</label>
                  <input
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                    required
                  />
                </div>
              </div>

              {/* S - Situation */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  <span className="text-emerald-700">S</span> - Situation (Current patient status & chief issue)
                </label>
                <textarea
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  required
                />
              </div>

              {/* B - Background */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  <span className="text-emerald-700">B</span> - Background (Obstetric/Clinical history, admission date)
                </label>
                <textarea
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  required
                />
              </div>

              {/* A - Assessment */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  <span className="text-emerald-700">A</span> - Assessment (Vital stability, MEOWS/Downes status, clinical progress)
                </label>
                <textarea
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  required
                />
              </div>

              {/* R - Recommendation */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  <span className="text-emerald-700">R</span> - Recommendation (Plan for oncoming shift, doctor escalation)
                </label>
                <textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">IV Fluids & Rate</label>
                  <input
                    type="text"
                    value={ivFluidsStatus}
                    onChange={(e) => setIvFluidsStatus(e.target.value)}
                    placeholder="e.g. RL 500 mL @ 100 mL/h"
                    className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dietary Order</label>
                  <input
                    type="text"
                    value={dietaryOrder}
                    onChange={(e) => setDietaryOrder(e.target.value)}
                    placeholder="e.g. NPO / Clear fluids / Normal diet"
                    className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pending Tasks & Handover To-Dos (One per line)
                </label>
                <textarea
                  value={pendingTasks}
                  onChange={(e) => setPendingTasks(e.target.value)}
                  placeholder="Repeat Hb check at 18:00&#10;Confirm blood cross-match report&#10;Pediatrician neonatal review pending"
                  rows={3}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setHandoverModalAdmission(null)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={handoverSubmitting}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {handoverSubmitting ? 'Saving...' : 'Save Shift Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
