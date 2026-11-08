import React, { useState, useEffect } from 'react';
import {
  getNeonatalSghEpisodes,
  getNeonatalSghEpisode,
  updateNeonatalSghStatus,
  deleteNeonatalSghFlowsheet,
  type NeonatalSghRecord,
  type NeonatalSghFlowsheetRecord,
} from '../api';
import { NeonatalSghModal } from './NeonatalSghModal';
import { NeonatalSghFlowsheetModal } from './NeonatalSghFlowsheetModal';
import { type NeonatalSghEvaluationResult } from '../neonatalSghEngine';

interface Props {
  patientId: number;
}

export const NeonatalSghTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalSghRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalSghRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalSghEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalSghFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalSghEpisodes({ patientId });
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
      console.error('Error loading SGH episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalSghEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err) {
      console.error('Error loading SGH details:', err);
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
      await updateNeonatalSghStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update SGH status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deleteNeonatalSghFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete SGH flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full mb-2"></div>
        <p>Loading Neonatal Subgaleal Hemorrhage records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-red-50 to-rose-100 p-4 rounded-xl border border-rose-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-red-600 text-white rounded-lg shadow-sm">
            <span className="text-xl">🩸</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Neonatal Subgaleal Hemorrhage (SGH) Resuscitation Protocol
            </h2>
            <p className="text-xs text-gray-600">
              AAP / BAPM Guidelines: Occult Blood Loss Quantification & Massive Transfusion Protocol
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New SGH Episode</span>
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="text-4xl mb-3">🩺</div>
          <h3 className="text-base font-bold text-gray-800">No Subgaleal Hemorrhage Records Found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-4">
            No SGH surveillance or MTP resuscitation episodes have been initiated for this infant.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Initiate SGH Protocol</span>
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
                const isCollapse = ep.shock_state === 'life_threatening_circulatory_collapse';
                const isMtp = ep.mtp_activated === 1;

                return (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-red-600 bg-red-50/70 shadow-sm ring-1 ring-red-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-gray-700">{ep.episode_code}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        isCollapse ? 'bg-red-200 text-red-900' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      Δ HC: +{ep.hc_increase_cm} cm (~{ep.estimated_occult_blood_loss_ml} mL)
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{ep.diagnosis_datetime?.slice(0, 10)}</span>
                      {isMtp && (
                        <span className="bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                          MTP ON
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
                        currentEpisode.shock_state === 'life_threatening_circulatory_collapse'
                          ? 'bg-red-600 text-white'
                          : 'bg-orange-500 text-white'
                      }`}>
                        {currentEpisode.shock_state.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {currentEpisode.mtp_activated === 1 && (
                        <span className="bg-red-700 text-white px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                          🚨 MTP ACTIVATED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Delivery: {currentEpisode.delivery_mode.replace(/_/g, ' ')} | Birth Weight: {currentEpisode.birth_weight_kg} kg | Diagnosed: {currentEpisode.diagnosis_datetime}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white"
                    >
                      <option value="active_resuscitation">Active Resuscitation</option>
                      <option value="mtp_massive_transfusion">MTP Massive Transfusion</option>
                      <option value="stabilized_monitoring">Stabilized Monitoring</option>
                      <option value="resolved_discharged">Resolved / Discharged</option>
                    </select>

                    <a
                      href={`/neonatal-sgh/${currentEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 inline-flex items-center gap-1"
                    >
                      <span>🖨️</span>
                      <span>Dossier</span>
                    </a>
                  </div>
                </div>

                {/* Resuscitation & Volume Calculation Cards */}
                {evaluation && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <div className="text-[11px] font-bold text-red-700 uppercase">Head Circumference Inc.</div>
                      <div className="text-xl font-extrabold text-red-900 mt-0.5">
                        +{evaluation.hcIncreaseCm} cm
                      </div>
                      <div className="text-[11px] text-red-600">
                        {currentEpisode.initial_head_circumference_cm} cm → {currentEpisode.current_head_circumference_cm} cm
                      </div>
                    </div>

                    <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
                      <div className="text-[11px] font-bold text-rose-700 uppercase">Occult Blood Loss</div>
                      <div className="text-xl font-extrabold text-rose-900 mt-0.5">
                        ~{evaluation.estimatedOccultBloodLossMl} mL
                      </div>
                      <div className="text-[11px] text-rose-600">
                        {evaluation.circulatingVolumeLossPct}% of circulating volume
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="text-[11px] font-bold text-blue-700 uppercase">Total Blood Volume</div>
                      <div className="text-xl font-extrabold text-blue-900 mt-0.5">
                        {evaluation.estimatedTotalBloodVolumeMl} mL
                      </div>
                      <div className="text-[11px] text-blue-600">
                        Based on 80 mL/kg
                      </div>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="text-[11px] font-bold text-purple-700 uppercase">MTP PRBC Guidance</div>
                      <div className="text-xl font-extrabold text-purple-900 mt-0.5">
                        {evaluation.mtpGuidance.prbcVolumeMl} mL
                      </div>
                      <div className="text-[11px] text-purple-600">
                        FFP: {evaluation.mtpGuidance.ffpVolumeMl} mL | Cryo: {evaluation.mtpGuidance.cryoprecipitateVolumeMl} mL
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations Callout */}
                {evaluation && evaluation.recommendations && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">
                      AAP / BAPM Clinical Directives:
                    </h4>
                    <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                      {evaluation.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Serial Flowsheet Checkpoints */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📏</span>
                    <h3 className="text-sm font-bold text-gray-900">
                      Serial Head Circumference & Hemodynamic Flowsheet
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                  >
                    <span>+</span>
                    <span>Log Checkpoint</span>
                  </button>
                </div>

                {flowsheet.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center italic">
                    No flowsheet checkpoints logged yet. Record hourly head circumference and shock parameters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold">
                          <th className="py-2 px-3">Date/Time</th>
                          <th className="py-2 px-3">Age (hrs)</th>
                          <th className="py-2 px-3">HC (cm)</th>
                          <th className="py-2 px-3">Heart Rate</th>
                          <th className="py-2 px-3">BP / Shock Idx</th>
                          <th className="py-2 px-3">Cap Refill</th>
                          <th className="py-2 px-3">Hct (%)</th>
                          <th className="py-2 px-3">Transfusions</th>
                          <th className="py-2 px-3">Logged By</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flowsheet.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono">{item.log_datetime?.slice(11, 16)}</td>
                            <td className="py-2 px-3 font-semibold">{item.hours_from_birth}h</td>
                            <td className="py-2 px-3 font-bold text-red-700">{item.head_circumference_cm}</td>
                            <td className="py-2 px-3">{item.heart_rate} bpm</td>
                            <td className="py-2 px-3">
                              {item.blood_pressure_sys ? `${item.blood_pressure_sys}/${item.blood_pressure_dia || '-'}` : '-'}
                              {item.shock_index && <span className="ml-1 text-[11px] text-gray-500">({item.shock_index.toFixed(2)})</span>}
                            </td>
                            <td className="py-2 px-3">{item.capillary_refill_seconds ? `${item.capillary_refill_seconds}s` : '-'}</td>
                            <td className="py-2 px-3 font-medium">{item.hematocrit_pct ? `${item.hematocrit_pct}%` : '-'}</td>
                            <td className="py-2 px-3 text-gray-700">{item.blood_products_transfused || '-'}</td>
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
      <NeonatalSghModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <NeonatalSghFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
