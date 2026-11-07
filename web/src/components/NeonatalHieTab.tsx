import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getNeonatalHieAssessments,
  getNeonatalHieAssessment,
  updateNeonatalHieStatus,
  deleteNeonatalHieAssessment,
  deleteTtmFlowsheet,
  type NeonatalHieRecord,
  type TtmFlowsheetRecord,
} from '../api';
import { HieAssessmentModal } from './HieAssessmentModal';
import { TtmFlowsheetModal } from './TtmFlowsheetModal';

interface NeonatalHieTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalHieTab: React.FC<NeonatalHieTabProps> = ({ patientId, patientName }) => {
  const [assessments, setAssessments] = useState<NeonatalHieRecord[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [activeAssessment, setActiveAssessment] = useState<NeonatalHieRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<TtmFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isFlowsheetModalOpen, setIsFlowsheetModalOpen] = useState(false);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalHieAssessments({ patientId });
      setAssessments(res.assessments);
      const first = res.assessments[0];
      if (first) {
        setSelectedAssessmentId(first.id);
        fetchDetails(first.id);
      } else {
        setSelectedAssessmentId(null);
        setActiveAssessment(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load Neonatal HIE assessments');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: number) => {
    try {
      const res = await getNeonatalHieAssessment(id);
      setActiveAssessment(res.assessment);
      setFlowsheetLogs(res.flowsheetLogs);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [patientId]);

  const handleSelect = (id: number) => {
    setSelectedAssessmentId(id);
    fetchDetails(id);
  };

  const handleStatusChange = async (
    id: number,
    status: 'eligible_pending' | 'cooling_active' | 'rewarming_phase' | 'completed_normothermia' | 'discontinued'
  ) => {
    try {
      await updateNeonatalHieStatus(id, status);
      fetchAssessments();
    } catch (err: any) {
      alert(err?.message || 'Failed to update cooling status');
    }
  };

  const handleDeleteAssessment = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this HIE assessment and all its flowsheet logs?')) return;
    try {
      await deleteNeonatalHieAssessment(id);
      fetchAssessments();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete assessment');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Delete this hourly flowsheet log?')) return;
    try {
      await deleteTtmFlowsheet(logId);
      if (selectedAssessmentId) fetchDetails(selectedAssessmentId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete log entry');
    }
  };

  const nextHourNumber = flowsheetLogs.length > 0
    ? Math.max(...flowsheetLogs.map(l => l.hours_into_protocol)) + 1
    : 1;

  const currentPhase = activeAssessment
    ? activeAssessment.protocol_status === 'rewarming_phase'
      ? 'controlled_rewarming'
      : activeAssessment.protocol_status === 'completed_normothermia'
      ? 'post_cooling_normothermia'
      : 'maintenance_cooling'
    : 'maintenance_cooling';

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Bar */}
      <div className="bg-gradient-to-r from-cyan-900 via-sky-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-cyan-700/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-white/10 rounded-xl">🧊</span>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                Neonatal HIE &amp; Targeted Temperature Management (TTM)
              </h2>
              <p className="text-xs text-cyan-200 mt-0.5">
                Sarnat Encephalopathy Staging I–III · TOBY / CoolCap 6-Hour Initiation Window · 72h Maintenance at 33.5°C · Controlled Rewarming (+0.5°C/hr)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAssessmentModalOpen(true)}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-1.5"
          >
            <span>+</span> Sarnat Assessment
          </button>
          {selectedAssessmentId && (
            <Link
              to={`/neonatal-hie/${selectedAssessmentId}/print`}
              target="_blank"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <span>🖨️</span> Dossier
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
          Loading HIE assessments and TTM flowsheets...
        </div>
      ) : assessments.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <span className="text-4xl block mb-2">👶</span>
          <h3 className="text-base font-bold text-slate-800">No Hypoxic-Ischemic Encephalopathy Assessments</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Evaluate intrapartum asphyxia, blood gas acidosis (pH &lt; 7.00, BE &ge; 16), Apgar &le; 5 at 10m, and Sarnat staging for TOBY cooling eligibility.
          </p>
          <button
            type="button"
            onClick={() => setIsAssessmentModalOpen(true)}
            className="mt-4 px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-semibold text-xs rounded-xl shadow transition"
          >
            Start Sarnat Staging Assessment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Assessments List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Evaluations ({assessments.length})
            </h3>
            <div className="space-y-2">
              {assessments.map((a) => {
                const isSel = a.id === selectedAssessmentId;
                const stageColor =
                  a.sarnat_stage === 'stage_III_severe'
                    ? 'border-purple-500 bg-purple-50/50'
                    : a.sarnat_stage === 'stage_II_moderate'
                    ? 'border-amber-500 bg-amber-50/50'
                    : 'border-slate-300 bg-white';

                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelect(a.id)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition ${
                      isSel ? 'border-cyan-600 bg-cyan-50/60 shadow-sm' : stageColor
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800">
                        {a.assessment_code || `HIE-#${a.id}`}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(a.assessment_datetime).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-xs font-semibold capitalize text-slate-700">
                      {a.sarnat_stage?.replace(/_/g, ' ') || 'Stage Pending'}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.cooling_criteria_met
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {a.cooling_criteria_met ? 'Cooling Eligible' : 'Observation'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 capitalize">
                        {a.protocol_status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Assessment Details and Flowsheet */}
          {activeAssessment && (
            <div className="lg:col-span-3 space-y-6">
              {/* Status and Score Summary Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {activeAssessment.assessment_code}
                      </span>
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                          activeAssessment.sarnat_stage === 'stage_III_severe'
                            ? 'bg-purple-100 text-purple-900 border border-purple-300'
                            : activeAssessment.sarnat_stage === 'stage_II_moderate'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {activeAssessment.sarnat_stage?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        Assessed at {new Date(activeAssessment.assessment_datetime).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">
                      Gestational Age: {activeAssessment.gestational_age_weeks}w · Birth Weight: {activeAssessment.birth_weight_kg} kg · Device: {activeAssessment.cooling_device_type?.replace(/_/g, ' ')}
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500">Protocol Status:</label>
                    <select
                      className="border rounded-lg px-2.5 py-1 text-xs font-bold bg-slate-50 text-slate-800"
                      value={activeAssessment.protocol_status}
                      onChange={(e) => handleStatusChange(activeAssessment.id, e.target.value as any)}
                    >
                      <option value="eligible_pending">Eligible (Pending Setup)</option>
                      <option value="cooling_active">Active Cooling (33.5°C)</option>
                      <option value="rewarming_phase">Rewarming Phase (+0.5°C/hr)</option>
                      <option value="completed_normothermia">Completed Normothermia</option>
                      <option value="discontinued">Discontinued / Contraindicated</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteAssessment(activeAssessment.id)}
                      className="text-xs text-red-500 hover:text-red-700 p-1"
                      title="Delete assessment"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Clinical Criteria Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Cord / Arterial pH</div>
                    <div className="text-base font-black text-slate-800">
                      {activeAssessment.cord_or_arterial_ph ?? 'N/A'}
                    </div>
                    <div className="text-[10px] text-slate-500">Criterion: &lt; 7.00</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Base Deficit</div>
                    <div className="text-base font-black text-slate-800">
                      {activeAssessment.base_deficit_mmol_l ? `${activeAssessment.base_deficit_mmol_l} mmol/L` : 'N/A'}
                    </div>
                    <div className="text-[10px] text-slate-500">Criterion: &ge; 16 mmol/L</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Apgar @ 10m / Resus</div>
                    <div className="text-base font-black text-slate-800">
                      {activeAssessment.apgar_10m ?? '—'} / {activeAssessment.resuscitation_duration_minutes ?? '—'}m
                    </div>
                    <div className="text-[10px] text-slate-500">Criterion: &le; 5 or &ge; 10m PPV</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Target Core Temp</div>
                    <div className="text-base font-black text-cyan-700">
                      {activeAssessment.target_core_temp_celsius}°C
                    </div>
                    <div className="text-[10px] text-slate-500">72-Hour Duration</div>
                  </div>
                </div>

                {/* Sarnat Exam Breakdown & Instructions */}
                <div className="bg-cyan-50/50 border border-cyan-100 rounded-xl p-4 text-xs space-y-2">
                  <div className="font-bold text-cyan-900 flex items-center justify-between">
                    <span>📋 Sarnat Neurological Findings</span>
                    <span className="font-mono text-cyan-800">
                      {activeAssessment.cooling_criteria_met ? '✅ TOBY Criteria Fulfilled' : '⚠️ Criteria Incomplete'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                    <div><span className="font-medium text-slate-500">LOC:</span> {activeAssessment.level_of_consciousness?.replace(/_/g, ' ')}</div>
                    <div><span className="font-medium text-slate-500">Tone:</span> {activeAssessment.muscle_tone?.replace(/_/g, ' ')}</div>
                    <div><span className="font-medium text-slate-500">Reflexes:</span> {activeAssessment.primitive_reflexes_suck_moro?.replace(/_/g, ' ')}</div>
                    <div><span className="font-medium text-slate-500">Seizures:</span> {activeAssessment.clinical_seizures_present ? '⚡ Yes' : 'No'}</div>
                  </div>
                  {activeAssessment.clinical_notes && (
                    <div className="mt-2 text-slate-800 border-t border-cyan-200/60 pt-2 font-medium">
                      <strong>Clinical Notes:</strong> {activeAssessment.clinical_notes}
                    </div>
                  )}
                </div>
              </div>

              {/* 72-Hour Flowsheet Section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>⏱️</span> 72-Hour TTM Hourly Flowsheet Logs ({flowsheetLogs.length} Entries)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Continuous core temperature (esophageal/rectal), aEEG background, inotropes, and rewarming schedule.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFlowsheetModalOpen(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-700 hover:to-sky-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <span>+</span> Log Hour #{nextHourNumber}
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50 text-slate-500 text-xs">
                    No hourly flowsheet logs recorded yet. Begin by logging Hour #1.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b font-bold">
                          <th className="p-2.5">Hr #</th>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Phase</th>
                          <th className="p-2.5">Core Temp</th>
                          <th className="p-2.5">Skin Temp</th>
                          <th className="p-2.5">HR / MAP</th>
                          <th className="p-2.5">aEEG Voltage</th>
                          <th className="p-2.5">Seizures</th>
                          <th className="p-2.5">Inotropes &amp; Meds</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-800">
                        {flowsheetLogs.map((log) => {
                          const temp = Number(log.core_temperature_celsius);
                          const isHigh = temp > 34.0;
                          const isLow = temp < 33.0;

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-2.5 font-bold text-cyan-800">#{log.hours_into_protocol}</td>
                              <td className="p-2.5 text-slate-500 whitespace-nowrap">
                                {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-2.5 capitalize text-[11px] font-medium text-slate-600">
                                {log.phase.replace(/_/g, ' ')}
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded font-black ${
                                    isHigh
                                      ? 'bg-amber-100 text-amber-900'
                                      : isLow
                                      ? 'bg-blue-100 text-blue-900'
                                      : 'bg-emerald-100 text-emerald-900'
                                  }`}
                                >
                                  {temp.toFixed(1)}°C
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600">
                                {log.skin_temperature_celsius ? `${Number(log.skin_temperature_celsius).toFixed(1)}°C` : '—'}
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                {log.heart_rate_bpm} bpm / {log.mean_arterial_pressure_mmhg ?? '—'} mmHg
                              </td>
                              <td className="p-2.5 text-[11px] font-medium">
                                {log.aeeg_background_pattern?.replace(/_/g, ' ') || 'Not monitored'}
                              </td>
                              <td className="p-2.5">
                                {log.electrographic_seizures_detected ? (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-bold text-[10px]">
                                    ⚡ YES
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">No</span>
                                )}
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-600 max-w-xs truncate">
                                {log.inotropic_support ? `${log.inotropic_support} · ` : ''}
                                {log.anticonvulsant_administered ? `${log.anticonvulsant_administered} · ` : ''}
                                {log.notes || 'Target maintained'}
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="text-red-400 hover:text-red-700 font-bold text-xs"
                                >
                                  ✕
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
        </div>
      )}

      {/* Assessment Modal */}
      <HieAssessmentModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isAssessmentModalOpen}
        onClose={() => setIsAssessmentModalOpen(false)}
        onSuccess={() => {
          fetchAssessments();
        }}
      />

      {/* Flowsheet Log Modal */}
      {selectedAssessmentId && (
        <TtmFlowsheetModal
          assessmentId={selectedAssessmentId}
          patientName={patientName}
          nextHourNumber={nextHourNumber}
          currentCoolingPhase={currentPhase}
          isOpen={isFlowsheetModalOpen}
          onClose={() => setIsFlowsheetModalOpen(false)}
          onSuccess={() => {
            fetchDetails(selectedAssessmentId);
          }}
        />
      )}
    </div>
  );
};
