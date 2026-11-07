import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricSeizureEpisodes,
  getPediatricSeizureEpisode,
  updatePediatricSeizureEpisode,
  deletePediatricSeizureEpisode,
  deletePediatricSeizureTimeline,
  type PediatricSeizureRecord,
  type PediatricSeizureTimelineRecord,
} from '../api';
import { PediatricSeizureModal } from './PediatricSeizureModal';
import { SeizureTimelineModal } from './SeizureTimelineModal';

interface PediatricSeizureTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricSeizureTab: React.FC<PediatricSeizureTabProps> = ({ patientId, patientName }) => {
  const [episodes, setEpisodes] = useState<PediatricSeizureRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<PediatricSeizureRecord | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<PediatricSeizureTimelineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSeizureModalOpen, setIsSeizureModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricSeizureEpisodes({ patientId });
      setEpisodes(res.episodes);
      const first = res.episodes[0];
      if (first) {
        setSelectedEpisodeId(first.id);
        fetchDetails(first.id);
      } else {
        setSelectedEpisodeId(null);
        setActiveEpisode(null);
        setTimelineLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric seizure episodes');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: number) => {
    try {
      const res = await getPediatricSeizureEpisode(id);
      setActiveEpisode(res.episode);
      setTimelineLogs(res.timelineLogs);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [patientId]);

  const handleSelectEpisode = (id: number) => {
    setSelectedEpisodeId(id);
    fetchDetails(id);
  };

  const handlePhaseChange = async (newPhase: any) => {
    if (!activeEpisode) return;
    try {
      const res = await updatePediatricSeizureEpisode(activeEpisode.id, { currentAlgorithmPhase: newPhase });
      setActiveEpisode(res.episode);
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update phase');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!activeEpisode || !window.confirm(`Delete seizure episode ${activeEpisode.episode_code}?`)) return;
    try {
      await deletePediatricSeizureEpisode(activeEpisode.id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteTimelineLog = async (logId: number) => {
    if (!window.confirm('Delete this resuscitation timeline event?')) return;
    try {
      await deletePediatricSeizureTimeline(logId);
      if (selectedEpisodeId) fetchDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete timeline log');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-red-950 flex items-center gap-2">
            <span>⚡</span> Pediatric Status Epilepticus Resuscitation (AES Algorithm)
          </h2>
          <p className="text-xs text-gray-500">
            Time-Critical 4-Phase Resuscitation • Broselow Dosing, Hypoglycemia Screening & Bedside Timeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeEpisode && (
            <Link
              to={`/pediatric-seizures/print/${activeEpisode.id}`}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border flex items-center gap-1"
            >
              <span>🖨️</span> Print Dossier
            </Link>
          )}
          <button
            onClick={() => setIsSeizureModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-red-700 hover:bg-red-800 text-white rounded shadow flex items-center gap-1"
          >
            <span>+</span> Initiate Seizure Protocol
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-sm text-gray-500 py-6">Loading seizure episodes...</p>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {!loading && episodes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No status epilepticus episodes recorded for {patientName}.</p>
          <button
            onClick={() => setIsSeizureModalOpen(true)}
            className="mt-3 px-4 py-2 text-xs font-bold bg-red-700 text-white rounded hover:bg-red-800"
          >
            Initiate First Seizure Resuscitation
          </button>
        </div>
      )}

      {episodes.length > 0 && activeEpisode && (
        <div className="space-y-6">
          {/* Episode Tabs */}
          {episodes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedEpisodeId === ep.id
                      ? 'bg-red-900 text-white border-red-900 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {ep.episode_code} ({new Date(ep.seizure_start_datetime).toLocaleDateString()}) - {ep.current_algorithm_phase.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Hero Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {activeEpisode.episode_code}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  Started: {new Date(activeEpisode.seizure_start_datetime).toLocaleString()} • Semiology: <strong className="text-gray-800">{activeEpisode.seizure_type.replace(/_/g, ' ')}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeEpisode.current_algorithm_phase}
                  onChange={(e) => handlePhaseChange(e.target.value)}
                  className="text-xs font-bold px-2.5 py-1 rounded border bg-red-50 text-red-950 border-red-300"
                >
                  <option value="phase_1_stabilization_0_5m">Phase 1: Stabilization (0-5m)</option>
                  <option value="phase_2_first_line_bzd_5_20m">Phase 2: First-line BZD (5-20m)</option>
                  <option value="phase_3_second_line_asm_20_40m">Phase 3: Second-line ASM (20-40m)</option>
                  <option value="phase_4_refractory_rsi_picu_gt_40m">Phase 4: Refractory RSI/PICU (&gt;40m)</option>
                  <option value="seizure_aborted_postictal">Seizure Aborted / Postictal</option>
                </select>
                <button
                  onClick={handleDeleteEpisode}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-red-50/60 rounded-lg border border-red-100">
                <span className="text-[10px] font-bold text-red-700 uppercase">Seizure Duration</span>
                <p className="text-xl font-black text-red-950 mt-1">{activeEpisode.total_seizure_duration_minutes ?? 'Ongoing'} min</p>
                <span className="text-[10px] text-red-700">{activeEpisode.seizure_cessation_datetime ? 'Seizure Aborted' : 'Actively Resuscitating'}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Child Weight & Zone</span>
                <p className="text-lg font-bold text-gray-900 mt-1">{activeEpisode.weight_kg} kg • {activeEpisode.patient_age_months} mo</p>
                <span className="text-[10px] font-black uppercase text-indigo-800">{activeEpisode.broselow_color_zone} Zone</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <span className="text-[10px] font-bold text-amber-800 uppercase">Blood Glucose</span>
                <p className="text-xl font-black text-amber-950 mt-1">
                  {activeEpisode.blood_glucose_mg_dl ? `${activeEpisode.blood_glucose_mg_dl} mg/dL` : 'Not Checked'}
                </p>
                <span className="text-[10px] text-amber-800">
                  {activeEpisode.d10w_bolus_given_ml ? `D10W Given: ${activeEpisode.d10w_bolus_given_ml} mL` : 'Normoglycemic'}
                </span>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-700 uppercase">First-line BZD Status</span>
                <p className="text-sm font-bold text-indigo-950 mt-1">
                  {activeEpisode.phase2_dose_count}/2 Doses Given
                </p>
                <span className="text-[10px] text-indigo-700">{activeEpisode.phase2_benzodiazepine_given || 'Midazolam IN / Lorazepam IV'}</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-[10px] font-bold text-purple-700 uppercase">Second-line ASM</span>
                <p className="text-sm font-bold text-purple-950 mt-1">
                  {activeEpisode.phase3_second_line_agent ? activeEpisode.phase3_second_line_agent.split(' ')[0] : 'None Given'}
                </p>
                <span className="text-[10px] text-purple-700 uppercase">{activeEpisode.phase3_infusion_status || 'Pending'}</span>
              </div>
            </div>
          </div>

          {/* Timeline Events Flowsheet Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-red-950 flex items-center gap-2">
                  <span>⏱️</span> Bedside Resuscitation Timeline & Event Log
                </h3>
                <p className="text-xs text-gray-500">
                  Sequential timeline of airway interventions, medication pushes, vitals, and motor seizure cessation.
                </p>
              </div>
              <button
                onClick={() => setIsTimelineModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold bg-red-700 text-white rounded hover:bg-red-800 shadow"
              >
                + Log Resuscitation Event
              </button>
            </div>

            {timelineLogs.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">
                No resuscitation events logged yet. Click above to document first-line benzodiazepines, airway interventions, or seizure cessation.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Elapsed Time</th>
                      <th className="px-3 py-2 text-left">Resuscitation Action</th>
                      <th className="px-3 py-2 text-left">Medication & Dose</th>
                      <th className="px-3 py-2 text-center">Vitals (HR / BP / SpO2)</th>
                      <th className="px-3 py-2 text-center">Motor Convulsions</th>
                      <th className="px-3 py-2 text-left">Clinical Observations / Clinician</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {timelineLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-bold text-red-900 whitespace-nowrap">
                          <div>+ {log.elapsed_minutes} min</div>
                          <div className="text-[10px] text-gray-400 font-normal">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">
                          {log.action_type.replace(/_/g, ' ').toUpperCase()}
                        </td>
                        <td className="px-3 py-2.5">
                          {log.medication_name ? (
                            <div>
                              <span className="font-bold text-indigo-900">{log.medication_name}</span>
                              <div className="text-[10px] text-gray-500">{log.dose_administered} via {log.route}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700 whitespace-nowrap">
                          {log.heart_rate_bpm ? `${log.heart_rate_bpm} bpm • ` : ''}
                          {log.blood_pressure_systolic ? `${log.blood_pressure_systolic}/${log.blood_pressure_diastolic} • ` : ''}
                          {log.spo2_percent ? <strong className="text-blue-700">{log.spo2_percent}%</strong> : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.active_motor_activity === 1 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {log.active_motor_activity === 1 ? 'CONVULSING' : 'ABORTED'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-xs truncate">
                          {log.clinical_observations || '—'} {log.logged_by_name && `(${log.logged_by_name})`}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleDeleteTimelineLog(log.id)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <PediatricSeizureModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isSeizureModalOpen}
        onClose={() => setIsSeizureModalOpen(false)}
        onSuccess={() => {
          setIsSeizureModalOpen(false);
          fetchEpisodes();
        }}
      />

      {activeEpisode && (
        <SeizureTimelineModal
          episodeId={activeEpisode.id}
          isOpen={isTimelineModalOpen}
          onClose={() => setIsTimelineModalOpen(false)}
          onSuccess={() => {
            setIsTimelineModalOpen(false);
            fetchDetails(activeEpisode.id);
          }}
          defaultElapsedMinutes={
            timelineLogs.length > 0 && timelineLogs[timelineLogs.length - 1]
              ? timelineLogs[timelineLogs.length - 1]!.elapsed_minutes + 5
              : 5
          }
        />
      )}
    </div>
  );
};
