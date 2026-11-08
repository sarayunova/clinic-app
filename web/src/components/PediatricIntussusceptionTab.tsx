import React, { useState, useEffect } from 'react';
import {
  getPediatricIntussusceptionEpisodes,
  getPediatricIntussusceptionEpisode,
  deletePediatricIntussusceptionEpisode,
  deletePediatricIntussusceptionFlowsheet,
  type PediatricIntussusceptionRecord,
  type PediatricIntussusceptionFlowsheetRecord,
} from '../api';
import { PediatricIntussusceptionModal } from './PediatricIntussusceptionModal';
import { PediatricIntussusceptionFlowsheetModal } from './PediatricIntussusceptionFlowsheetModal';

interface PediatricIntussusceptionTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricIntussusceptionTab: React.FC<PediatricIntussusceptionTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricIntussusceptionRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricIntussusceptionRecord | null>(null);
  const [logs, setLogs] = useState<PediatricIntussusceptionFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricIntussusceptionEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load intussusception records');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getPediatricIntussusceptionEpisode(id);
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
    if (!window.confirm('Delete this intussusception episode and flowsheet records?')) return;
    try {
      await deletePediatricIntussusceptionEpisode(id);
      loadEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deletePediatricIntussusceptionFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            Pediatric Intussusception & Enema Reduction Protocol
          </h2>
          <p className="text-xs text-gray-500">
            ACR Guidelines • Target Sign US • Air/Saline Enema Pressure Control (&le; 120 mmHg) • Peritonitis Auditing
          </p>
        </div>
        <div className="flex space-x-2">
          {selectedEpisode && (
            <button
              onClick={() => window.open(`/pediatric-intussusception/${selectedEpisode.id}/print`, '_blank')}
              className="px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center shadow-sm"
            >
              Print Dossier
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow flex items-center"
          >
            + New Intussusception Episode
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
          <p className="text-gray-500 text-sm">No intussusception episodes recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-lg text-xs hover:bg-indigo-100"
          >
            Record Intussusception Episode
          </button>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Episodes ({episodes.length})
            </h3>
            <div className="space-y-2">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    selectedEpisode?.id === ep.id
                      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-indigo-950">{ep.episode_code}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        ep.reduction_successful
                          ? 'bg-emerald-100 text-emerald-800'
                          : ep.status === 'operating_room_exploration'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Method: {ep.reduction_method.replace(/_/g, ' ')} ({ep.maximum_pressure_mmhg} mmHg)
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(ep.presentation_datetime).toLocaleDateString()}
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
                      evalResult.contraindicationToEnemaReduction
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : evalResult.reductionSuccessful
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">
                        {evalResult.intussusceptionDiagnosed ? 'ULTRASOUND CONFIRMED INTUSSUSCEPTION' : 'SUSPECTED INTUSSUSCEPTION'}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white shadow-sm border">
                        {selectedEpisode.reduction_successful ? 'REDUCTION SUCCESSFUL' : 'REDUCTION PENDING / SURGERY'}
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
                        Age: {selectedEpisode.age_months} months • Weight: {selectedEpisode.weight_kg} kg • Duration: {selectedEpisode.symptom_duration_hours} hours
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowLogModal(true)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow"
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
                      <span className="text-gray-500 block">Reduction Method</span>
                      <span className="font-bold text-gray-800">{selectedEpisode.reduction_method.replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Max Pressure</span>
                      <span className="font-bold text-indigo-700">{selectedEpisode.maximum_pressure_mmhg} mmHg</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Attempts / Success</span>
                      <span className={`font-bold ${selectedEpisode.reduction_successful ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {selectedEpisode.reduction_attempts_count} attempt(s) • {selectedEpisode.reduction_successful ? 'Successful' : 'Incomplete'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Lead Point Type</span>
                      <span className="font-bold text-gray-800">{selectedEpisode.lead_point_type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">
                      Post-Reduction Surveillance Timeline ({logs.length})
                    </h5>
                    {logs.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No post-procedure logs recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-gray-200 rounded-lg">
                          <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                              <th className="p-2">Elapsed</th>
                              <th className="p-2">HR (bpm)</th>
                              <th className="p-2">BP (mmHg)</th>
                              <th className="p-2">Abdomen</th>
                              <th className="p-2">Colic Recurrence</th>
                              <th className="p-2">Oral Intake</th>
                              <th className="p-2">Notes</th>
                              <th className="p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {logs.map((lg) => (
                              <tr key={lg.id} className="hover:bg-gray-50">
                                <td className="p-2 font-bold text-gray-900">{lg.minutes_from_procedure} min</td>
                                <td className="p-2 font-medium">{lg.heart_rate_bpm}</td>
                                <td className="p-2">{lg.blood_pressure_sys}/{lg.blood_pressure_dia}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lg.abdominal_soft_non_tender ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                    {lg.abdominal_soft_non_tender ? 'Soft' : 'Guarding / Tender'}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lg.colicky_pain_recurrence ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                    {lg.colicky_pain_recurrence ? 'Recurred' : 'None'}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <span className="text-gray-700">{lg.oral_intake_tolerated ? 'Tolerated' : 'NPO'}</span>
                                </td>
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
        <PediatricIntussusceptionModal
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
        <PediatricIntussusceptionFlowsheetModal
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
