import React, { useState, useEffect } from 'react';
import {
  getNeonatalChylothoraxEpisodes,
  getNeonatalChylothoraxEpisode,
  deleteNeonatalChylothoraxEpisode,
  deleteNeonatalChylothoraxFlowsheet,
  type NeonatalChylothoraxRecord,
  type NeonatalChylothoraxFlowsheetRecord,
} from '../api';
import { NeonatalChylothoraxModal } from './NeonatalChylothoraxModal';
import { NeonatalChylothoraxFlowsheetModal } from './NeonatalChylothoraxFlowsheetModal';

interface NeonatalChylothoraxTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalChylothoraxTab: React.FC<NeonatalChylothoraxTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalChylothoraxRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalChylothoraxRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalChylothoraxFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalChylothoraxEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load neonatal chylothorax records');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getNeonatalChylothoraxEpisode(id);
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
    if (!window.confirm('Delete this neonatal chylothorax episode and all flowsheet records?')) return;
    try {
      await deleteNeonatalChylothoraxEpisode(id);
      loadEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteNeonatalChylothoraxFlowsheet(selectedEpisode.id, logId);
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
            Neonatal Chylothorax & Octreotide Titration Protocol
          </h2>
          <p className="text-xs text-gray-500">
            BTS Pleural Guidelines • Triglycerides &gt; 110 mg/dL • Lymphocytes &gt; 80% • MCT Exclusive Diet
          </p>
        </div>
        <div className="flex space-x-2">
          {selectedEpisode && (
            <button
              onClick={() => window.open(`/neonatal-chylothorax/${selectedEpisode.id}/print`, '_blank')}
              className="px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center shadow-sm"
            >
              Print Dossier
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow flex items-center"
          >
            + New Chylothorax Episode
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
          <p className="text-gray-500 text-sm">No neonatal chylothorax episodes recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-lg text-xs hover:bg-indigo-100"
          >
            Initiate Chylothorax Protocol
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
                        ep.status === 'resolved_tube_removed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ep.status === 'refractory_surgical_referral'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Rate: <span className="font-semibold text-gray-700">{ep.drainage_ml_kg_day} mL/kg/day</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Diag: {new Date(ep.diagnosis_datetime).toLocaleDateString()}
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
                      evalResult.drainageSeverityTier === 'high_output_gt_20'
                        ? 'bg-rose-50 border-rose-200 text-rose-950'
                        : evalResult.drainageSeverityTier === 'moderate_output_10_to_20'
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">{evalResult.drainageSeverityLabel}</span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white shadow-sm border">
                        {evalResult.chylothoraxConfirmed ? 'CHYLOTHORAX CONFIRMED' : 'SUSPECTED EFFUSION'}
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
                        Laterality: {selectedEpisode.effusion_laterality.replace(/_/g, ' ')} • Etiology: {selectedEpisode.etiology.replace(/_/g, ' ')}
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
                      <span className="text-gray-500 block">24h Drainage</span>
                      <span className="font-bold text-gray-800">{selectedEpisode.initial_24h_drainage_ml} mL ({selectedEpisode.drainage_ml_kg_day} mL/kg/d)</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Dietary Regimen</span>
                      <span className="font-bold text-gray-800">{selectedEpisode.dietary_regimen.replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Octreotide Dose</span>
                      <span className="font-bold text-gray-800">
                        {selectedEpisode.octreotide_prescribed ? `${selectedEpisode.octreotide_current_dose_mcg_kg_hr} µg/kg/hr` : 'Not Prescribed'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Pleural Triglycerides</span>
                      <span className="font-bold text-gray-800">
                        {selectedEpisode.pleural_triglycerides_mg_dl ? `${selectedEpisode.pleural_triglycerides_mg_dl} mg/dL` : 'Not tested'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">
                      Serial Flowsheet Logs ({logs.length})
                    </h5>
                    {logs.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No flowsheet checkpoints logged yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-gray-200 rounded-lg">
                          <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                              <th className="p-2">Time / Day</th>
                              <th className="p-2">24h Drain</th>
                              <th className="p-2">Rate (mL/kg/d)</th>
                              <th className="p-2">Octreotide</th>
                              <th className="p-2">Glucose</th>
                              <th className="p-2">Appearance</th>
                              <th className="p-2">Notes</th>
                              <th className="p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {logs.map((lg) => (
                              <tr key={lg.id} className="hover:bg-gray-50">
                                <td className="p-2 font-medium">Day {lg.days_from_diagnosis}</td>
                                <td className="p-2">{lg.drainage_24h_ml} mL</td>
                                <td className="p-2 font-bold">{lg.drainage_ml_kg_day}</td>
                                <td className="p-2">{lg.octreotide_dose_mcg_kg_hr} µg/kg/h</td>
                                <td className="p-2">{lg.blood_glucose_mg_dl ? `${lg.blood_glucose_mg_dl} mg/dL` : '—'}</td>
                                <td className="p-2">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 font-medium">
                                    {lg.fluid_appearance.replace(/_/g, ' ')}
                                  </span>
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
        <NeonatalChylothoraxModal
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
        <NeonatalChylothoraxFlowsheetModal
          episodeId={selectedEpisode.id}
          patientId={patientId}
          currentWeightKg={selectedEpisode.current_weight_kg}
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
