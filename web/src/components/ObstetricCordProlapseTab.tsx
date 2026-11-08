import React, { useState, useEffect } from 'react';
import {
  getObstetricCordProlapseEpisodes,
  getObstetricCordProlapseEpisode,
  deleteObstetricCordProlapseEpisode,
  deleteObstetricCordProlapseFlowsheet,
  type ObstetricCordProlapseRecord,
  type ObstetricCordProlapseFlowsheetRecord,
} from '../api';
import { ObstetricCordProlapseModal } from './ObstetricCordProlapseModal';
import { ObstetricCordProlapseFlowsheetModal } from './ObstetricCordProlapseFlowsheetModal';

interface ObstetricCordProlapseTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricCordProlapseTab: React.FC<ObstetricCordProlapseTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricCordProlapseRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricCordProlapseRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricCordProlapseFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricCordProlapseEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load cord prolapse records');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getObstetricCordProlapseEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err.message || 'Failed to load episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Delete this cord prolapse emergency record and flowsheet?')) return;
    try {
      await deleteObstetricCordProlapseEpisode(id);
      loadEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteObstetricCordProlapseFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-red-950 flex items-center">
            <span className="mr-2">🚨</span> Obstetric Umbilical Cord Prolapse Protocol
          </h2>
          <p className="text-xs text-gray-500">
            RCOG Green-top 50 • Manual Vaginal Elevation • Knee-Chest / Bladder Filling • Category-1 Delivery (&le; 30 min)
          </p>
        </div>
        <div className="flex space-x-2">
          {selectedEpisode && (
            <button
              onClick={() => window.open(`/obstetric-cord-prolapse/${selectedEpisode.id}/print`, '_blank')}
              className="px-3 py-1.5 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center shadow-sm"
            >
              Print Dossier
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow flex items-center"
          >
            + Record Cord Prolapse Event
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {episodes.length === 0 && !loading && (
        <div className="bg-white p-8 rounded-xl text-center border border-dashed border-gray-200">
          <p className="text-gray-500 text-sm">No cord prolapse events recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-lg text-xs hover:bg-red-100"
          >
            Record Emergency Decompression
          </button>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Events ({episodes.length})
            </h3>
            <div className="space-y-2">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    selectedEpisode?.id === ep.id
                      ? 'bg-red-50 border-red-300 shadow-sm'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-red-950">{ep.episode_code}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        ep.status === 'delivered_neonatal_resuscitation' || ep.status === 'postpartum_surveillance_stable'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800 animate-pulse'
                      }`}
                    >
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    FHR: <span className="font-bold text-red-600">{ep.baseline_fhr_bpm} bpm</span> • {ep.prolapse_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(ep.detection_datetime).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {selectedEpisode && (
              <>
                {evalResult && (
                  <div
                    className={`p-4 rounded-xl border ${
                      evalResult.fetalHypoxiaRiskTier === 'critical_terminal_bradycardia'
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">{evalResult.fetalHypoxiaRiskLabel}</span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-sm">
                        DECOMPRESSION QUALITY: {evalResult.decompressionQualityScore}/5
                      </span>
                    </div>
                    <p className="text-xs mt-1.5">{evalResult.summary}</p>
                    {evalResult.criticalActionPlan && evalResult.criticalActionPlan.length > 0 && (
                      <div className="mt-2.5 bg-white/80 p-2.5 rounded-lg border text-xs space-y-1">
                        <span className="font-semibold block text-gray-800">Directives & Action Plan:</span>
                        {evalResult.criticalActionPlan.map((act: string, i: number) => (
                          <p key={i} className="text-gray-700 font-medium">• {act}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-gray-800">
                        Episode #{selectedEpisode.id} ({selectedEpisode.episode_code})
                      </h4>
                      <p className="text-xs text-gray-500">
                        Presentation: {selectedEpisode.fetal_presentation.replace(/_/g, ' ')} • Cervix: {selectedEpisode.cervical_dilation_cm} cm • Mode: {selectedEpisode.delivery_mode.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowLogModal(true)}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 shadow"
                      >
                        + Log Checkpoint
                      </button>
                      <button
                        onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-gray-50 p-3 rounded-lg border">
                    <div>
                      <span className="text-gray-500 block">Baseline FHR</span>
                      <span className="font-bold text-red-600">{selectedEpisode.baseline_fhr_bpm} bpm</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Manual Elevation</span>
                      <span className={`font-bold ${selectedEpisode.manual_elevation_performed ? 'text-emerald-700' : 'text-red-700'}`}>
                        {selectedEpisode.manual_elevation_performed ? 'Maintained Active' : 'Not Maintained'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Positioning</span>
                      <span className="font-bold text-gray-800">{selectedEpisode.maternal_positioning.replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">DDI (Minutes)</span>
                      <span className={`font-bold ${selectedEpisode.decision_to_delivery_minutes && selectedEpisode.decision_to_delivery_minutes <= 30 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {selectedEpisode.decision_to_delivery_minutes ? `${selectedEpisode.decision_to_delivery_minutes} min` : 'Underway'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">
                      Decompression Timeline & Checkpoints ({logs.length})
                    </h5>
                    {logs.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No progress logs recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-gray-200 rounded-lg">
                          <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                              <th className="p-2">Minutes</th>
                              <th className="p-2">FHR (bpm)</th>
                              <th className="p-2">Cord Pulsation</th>
                              <th className="p-2">Manual Elevation</th>
                              <th className="p-2">Maternal BP</th>
                              <th className="p-2">Notes</th>
                              <th className="p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {logs.map((lg) => (
                              <tr key={lg.id} className="hover:bg-gray-50">
                                <td className="p-2 font-bold text-gray-900">{lg.minutes_from_detection} min</td>
                                <td className="p-2 font-bold text-red-600">{lg.fetal_heart_rate_bpm} bpm</td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lg.cord_pulsation_palpable ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                    {lg.cord_pulsation_palpable ? 'Palpable' : 'Absent'}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lg.manual_elevation_maintained ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {lg.manual_elevation_maintained ? 'Active' : 'Released'}
                                  </span>
                                </td>
                                <td className="p-2">{lg.maternal_blood_pressure_sys}/{lg.maternal_blood_pressure_dia}</td>
                                <td className="p-2 text-gray-600 max-w-xs truncate">{lg.notes || '—'}</td>
                                <td className="p-2">
                                  <button
                                    onClick={() => handleDeleteLog(lg.id)}
                                    className="text-rose-600 hover:text-rose-800 text-[11px]"
                                  >
                                    Delete
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
              </>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <ObstetricCordProlapseModal
          patientId={patientId}
          patientName={patientName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadEpisodes();
          }}
        />
      )}

      {showLogModal && selectedEpisode && (
        <ObstetricCordProlapseFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowLogModal(false)}
          onSuccess={() => {
            setShowLogModal(false);
            loadDetail(selectedEpisode.id);
          }}
        />
      )}
    </div>
  );
};
