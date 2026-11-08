import React, { useState, useEffect } from 'react';
import {
  getPediatricKawasakiEpisodes,
  getPediatricKawasakiEpisode,
  updatePediatricKawasakiStatus,
  deletePediatricKawasakiFlowsheet,
  type PediatricKawasakiRecord,
  type PediatricKawasakiFlowsheetRecord,
} from '../api';
import { PediatricKawasakiModal } from './PediatricKawasakiModal';
import { PediatricKawasakiFlowsheetModal } from './PediatricKawasakiFlowsheetModal';
import { type PediatricKawasakiResult } from '../pediatricKawasakiEngine';

interface Props {
  patientId: number;
}

export const PediatricKawasakiTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricKawasakiRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricKawasakiRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricKawasakiResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricKawasakiFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricKawasakiEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const firstId = res.episodes[0].id;
        setSelectedEpisodeId(prev => (prev && res.episodes.some(e => e.id === prev) ? prev : firstId));
      } else {
        setSelectedEpisodeId(null);
        setCurrentEpisode(null);
        setEvaluation(null);
        setFlowsheet([]);
      }
    } catch (err) {
      console.error('Error loading Kawasaki episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricKawasakiEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err) {
      console.error('Error loading Kawasaki details:', err);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  useEffect(() => {
    if (selectedEpisodeId) {
      loadEpisodeDetails(selectedEpisodeId);
    }
  }, [selectedEpisodeId]);

  const handleStatusChange = async (status: string) => {
    if (!selectedEpisodeId) return;
    try {
      await updatePediatricKawasakiStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update Kawasaki status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deletePediatricKawasakiFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete Kawasaki flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full mb-2"></div>
        <p>Loading Kawasaki Disease records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-amber-50 to-rose-100 p-4 rounded-xl border border-amber-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-600 text-white rounded-lg shadow-sm">
            <span className="text-xl">❤️</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Pediatric Kawasaki Disease (KD) & Coronary Aneurysm Prevention Protocol
            </h2>
            <p className="text-xs text-gray-600">
              AHA 2017 Guidelines: High-Dose IVIG & Aspirin, Kobayashi IVIG Resistance Score & Coronary Z-Scores
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New KD Episode</span>
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="text-4xl mb-3">🩺</div>
          <h3 className="text-base font-bold text-gray-800">No Kawasaki Disease Records Found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-4">
            No Kawasaki disease diagnostic evaluation or coronary surveillance records have been initiated.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Initiate KD Protocol</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode List Selector */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Episodes ({episodes.length})
            </h3>
            <div className="space-y-2">
              {episodes.map(ep => {
                const isSelected = ep.id === selectedEpisodeId;
                const isHighRisk = ep.ivig_resistance_risk === 'high_risk';
                const hasAneurysm = ep.coronary_aneurysm_classification !== 'normal_z_lt_2';

                return (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50/70 shadow-sm ring-1 ring-amber-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-gray-700">{ep.episode_code}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        isHighRisk ? 'bg-red-200 text-red-900' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      {ep.diagnosis_classification.replace(/_/g, ' ')} | Fever {ep.fever_duration_days}d
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{ep.presentation_datetime?.slice(0, 10)}</span>
                      {hasAneurysm && (
                        <span className="bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                          ANEURYSM
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Episode Details & Flowsheet */}
          {currentEpisode && (
            <div className="lg:col-span-3 space-y-6">
              {/* Header Status Bar */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-gray-900">
                        Episode {currentEpisode.episode_code}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        currentEpisode.ivig_resistance_risk === 'high_risk'
                          ? 'bg-red-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        KOBAYASHI {currentEpisode.kobayashi_score} ({currentEpisode.ivig_resistance_risk.toUpperCase()})
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Age: {currentEpisode.age_months}m | Weight: {currentEpisode.weight_kg} kg | Fever: {currentEpisode.fever_duration_days} days | Criteria: {currentEpisode.principal_criteria_count}/5
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white"
                    >
                      <option value="active_diagnostic_workup">Active Diagnostic Workup</option>
                      <option value="ivig_infusion_in_progress">IVIG Infusion in Progress</option>
                      <option value="afebrile_post_ivig_monitoring">Afebrile Post-IVIG Monitoring</option>
                      <option value="ivig_resistant_retreatment">IVIG-Resistant Retreatment</option>
                      <option value="resolved_discharged">Resolved / Discharged</option>
                    </select>

                    <a
                      href={`/pediatric-kawasaki/${currentEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 inline-flex items-center gap-1"
                    >
                      <span>🖨️</span>
                      <span>Dossier</span>
                    </a>
                  </div>
                </div>

                {/* Dosing & Coronary Metrics */}
                {evaluation && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="text-[11px] font-bold text-blue-700 uppercase">IVIG Single Dose (2 g/kg)</div>
                      <div className="text-xl font-extrabold text-blue-900 mt-0.5">
                        {evaluation.treatmentRegimen.ivigDoseGrams} g
                      </div>
                      <div className="text-[11px] text-blue-600">
                        Continuous IV over 10-12 hrs
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="text-[11px] font-bold text-amber-700 uppercase">Acute Aspirin (40 mg/kg)</div>
                      <div className="text-xl font-extrabold text-amber-900 mt-0.5">
                        {evaluation.treatmentRegimen.aspirinAcuteDoseMgDay} mg/d
                      </div>
                      <div className="text-[11px] text-amber-600">
                        Divided QID until afebrile 48h
                      </div>
                    </div>

                    <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                      <div className="text-[11px] font-bold text-teal-700 uppercase">Low-Dose Aspirin</div>
                      <div className="text-xl font-extrabold text-teal-900 mt-0.5">
                        {evaluation.treatmentRegimen.aspirinMaintenanceDoseMgDay} mg/d
                      </div>
                      <div className="text-[11px] text-teal-600">
                        Antiplatelet 4 mg/kg once daily
                      </div>
                    </div>

                    <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
                      <div className="text-[11px] font-bold text-rose-700 uppercase">Coronary Z-Score (Max)</div>
                      <div className="text-xl font-extrabold text-rose-900 mt-0.5">
                        {evaluation.maxCoronaryZScore.toFixed(1)}
                      </div>
                      <div className="text-[11px] text-rose-600 capitalize">
                        {evaluation.coronaryAneurysmClassification.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations Callout */}
                {evaluation && evaluation.recommendations && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">
                      AHA Treatment Recommendations:
                    </h4>
                    <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                      {evaluation.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Serial Vitals & Infusion Flowsheet */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🌡️</span>
                    <h3 className="text-sm font-bold text-gray-900">
                      Serial Temperature, IVIG Infusion & Clinical Response Flowsheet
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                  >
                    <span>+</span>
                    <span>Log Checkpoint</span>
                  </button>
                </div>

                {flowsheet.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center italic">
                    No flowsheet checkpoints logged yet. Record hourly temperatures, IVIG running status, and rash evolution.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold">
                          <th className="py-2 px-3">Date/Time</th>
                          <th className="py-2 px-3">Hours In</th>
                          <th className="py-2 px-3">Temp (°C)</th>
                          <th className="py-2 px-3">Heart Rate</th>
                          <th className="py-2 px-3">BP (mmHg)</th>
                          <th className="py-2 px-3">IVIG Running</th>
                          <th className="py-2 px-3">Aspirin Given</th>
                          <th className="py-2 px-3">Rash / Edema</th>
                          <th className="py-2 px-3">Logged By</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flowsheet.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono">{item.log_datetime?.slice(11, 16)}</td>
                            <td className="py-2 px-3 font-semibold">{item.hours_from_admission}h</td>
                            <td className={`py-2 px-3 font-bold ${item.temperature_celsius >= 38.0 ? 'text-red-600' : 'text-emerald-700'}`}>
                              {item.temperature_celsius}°C
                            </td>
                            <td className="py-2 px-3">{item.heart_rate} bpm</td>
                            <td className="py-2 px-3">{item.blood_pressure_sys ? `${item.blood_pressure_sys}/${item.blood_pressure_dia || '-'}` : '-'}</td>
                            <td className="py-2 px-3 font-semibold text-blue-600">
                              {item.ivig_infusion_running ? 'RUNNING' : 'Complete / Off'}
                            </td>
                            <td className="py-2 px-3">{item.aspirin_dose_given_mg ? `${item.aspirin_dose_given_mg} mg` : '-'}</td>
                            <td className="py-2 px-3 text-gray-700">{item.rash_appearance || item.extremity_edema || '-'}</td>
                            <td className="py-2 px-3 text-gray-500">{item.logged_by_name || 'Staff'}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => handleDeleteFlowsheet(item.id)}
                                className="text-red-500 hover:text-red-700 font-bold px-1"
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
        </div>
      )}

      {/* Modals */}
      <PediatricKawasakiModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <PediatricKawasakiFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
