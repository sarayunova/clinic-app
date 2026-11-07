import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPalsDashboard,
  getPewsObservations,
  getBroselowEvents,
  type PewsObservationRecord,
  type BroselowEventRecord,
} from '../api';
import { PalsBroselowDrawer } from '../components/PalsBroselowDrawer';
import { PewsLoggerModal } from '../components/PewsLoggerModal';

export const PalsEmergencyPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<{
    highRiskObservations: PewsObservationRecord[];
    recentEvents: BroselowEventRecord[];
  } | null>(null);

  const [allObservations, setAllObservations] = useState<PewsObservationRecord[]>([]);
  const [allEvents, setAllEvents] = useState<BroselowEventRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isTapeDrawerOpen, setIsTapeDrawerOpen] = useState(false);
  const [isPewsModalOpen, setIsPewsModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, obsRes, evtRes] = await Promise.all([
        getPalsDashboard(),
        getPewsObservations({ limit: 50 }),
        getBroselowEvents(),
      ]);
      setDashboard(dashRes);
      setAllObservations(obsRes.observations);
      setAllEvents(evtRes.events);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Pediatric Emergency Console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const criticalPewsCount = allObservations.filter((o) => o.total_pews_score >= 5).length;
  const moderatePewsCount = allObservations.filter((o) => o.total_pews_score >= 3 && o.total_pews_score < 5).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚨</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Pediatric Emergency & Broselow Resuscitation Command Console
            </h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Ward-Wide Pediatric Early Warning Score (PEWS) Surveillance, Code Blue Readiness, and Broselow Tape Resuscitation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsTapeDrawerOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 text-white rounded-lg text-sm font-black shadow transition-all flex items-center gap-2"
          >
            <span>⚡</span> Open Broselow Tape Drawer
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium border border-gray-300 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-xl border shadow-sm ${
          criticalPewsCount > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-gray-200'
        }`}>
          <div className="text-xs font-semibold text-rose-900 uppercase tracking-wider">Critical Deterioration (PEWS ≥ 5)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-3xl font-extrabold ${criticalPewsCount > 0 ? 'text-rose-600 animate-pulse' : 'text-gray-900'}`}>
              {criticalPewsCount}
            </span>
            <span className="text-xs text-rose-700 font-bold">STAT MET Call</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Moderate Risk (PEWS 3-4)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600">{moderatePewsCount}</span>
            <span className="text-xs text-amber-700 font-medium">Hourly Vitals Due</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Code Blue Resuscitations</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-red-700">{allEvents.length}</span>
            <span className="text-xs text-red-600 font-medium">Broselow Events</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Bedside Assessments</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-blue-700">{allObservations.length}</span>
            <span className="text-xs text-blue-600 font-medium">Cumulative Observations</span>
          </div>
        </div>
      </div>

      {/* Critical Deterioration Alerts Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bedside Pediatric Escalation & Deterioration Queue</h2>
            <p className="text-xs text-gray-500">
              Patients requiring immediate attending reassessment or Pediatric Medical Emergency Team (MET) activation
            </p>
          </div>
        </div>

        {dashboard?.highRiskObservations.length === 0 ? (
          <div className="text-center py-10 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-semibold text-emerald-800 mt-2">
              No pediatric inpatients currently trigger Critical Escalation criteria (PEWS &ge; 5).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-gray-200">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">PEWS Score</th>
                  <th className="py-2.5 px-3">Domain Scores</th>
                  <th className="py-2.5 px-3">Vital Signs</th>
                  <th className="py-2.5 px-3">Assessed At</th>
                  <th className="py-2.5 px-3 text-right">Emergency Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dashboard?.highRiskObservations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-rose-50/50 bg-rose-50/20">
                    <td className="py-3 px-3">
                      <Link
                        to={`/patients/${obs.patient_id}?tab=pews_pals`}
                        className="font-black text-rose-700 hover:underline text-sm"
                      >
                        {obs.patient_name}
                      </Link>
                      <div className="text-[11px] text-gray-500">UHID: {obs.patient_uhid}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs animate-pulse">
                        PEWS {obs.total_pews_score} - CRITICAL
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-700">
                      Behavior: <strong>{obs.behavior_score}</strong> &bull; CV: <strong>{obs.cardiovascular_score}</strong> &bull; Resp: <strong>{obs.respiratory_score}</strong>
                    </td>
                    <td className="py-3 px-3 font-semibold text-gray-900">
                      HR: {obs.heart_rate_bpm} &bull; RR: {obs.respiratory_rate_bpm} &bull; SpO₂: {obs.spo2_percent}% &bull; CRT: {obs.crt_seconds}s
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {new Date(obs.observation_datetime).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/patients/${obs.patient_id}?tab=pews_pals`}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow"
                      >
                        Open Emergency File &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Code Blue Resuscitation Events Log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Hospital Pediatric Code Blue & Resuscitation Dossier</h2>
            <p className="text-xs text-gray-500">Documented PALS events, Broselow equipment, defib joules, and clinical outcomes</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left divide-y divide-gray-200">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-3">Event Code</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Broselow Zone</th>
                <th className="py-2.5 px-3">Airway / ETT</th>
                <th className="py-2.5 px-3">Defib Joules</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3 text-right">Print Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No resuscitation events logged.
                  </td>
                </tr>
              ) : (
                allEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-mono font-bold text-gray-800">
                      {evt.event_code}
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        to={`/patients/${evt.patient_id}?tab=pews_pals`}
                        className="font-bold text-blue-600 hover:underline"
                      >
                        {evt.patient_name}
                      </Link>
                      <div className="text-[11px] text-gray-500">UHID: {evt.patient_uhid}</div>
                    </td>
                    <td className="py-3 px-3 capitalize font-semibold text-gray-800">
                      {evt.event_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-gray-100 text-gray-800">
                        {evt.broselow_color_zone} ({evt.estimated_weight_kg} kg)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-700">
                      ETT {evt.ett_cuffed_size} mm at {evt.ett_depth_cm} cm
                    </td>
                    <td className="py-3 px-3 font-semibold text-rose-700">
                      {evt.defib_joules_initial} Joules
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        evt.outcome === 'rosc_achieved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : evt.outcome === 'expired'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {evt.outcome.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/pals/${evt.id}/print`}
                        target="_blank"
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold border border-gray-300"
                      >
                        🖨️ Print
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <PalsBroselowDrawer
        isOpen={isTapeDrawerOpen}
        onClose={() => setIsTapeDrawerOpen(false)}
        onEventLogged={fetchData}
      />

      {isPewsModalOpen && (
        <PewsLoggerModal
          patientId={allObservations[0]?.patient_id || 1}
          patientName="Pediatric Inpatient"
          onClose={() => setIsPewsModalOpen(false)}
          onSuccess={() => {
            setIsPewsModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
