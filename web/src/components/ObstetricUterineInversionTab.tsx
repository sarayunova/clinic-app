import React, { useState, useEffect } from 'react';
import {
  getObstetricUterineInversionEpisodes,
  getObstetricUterineInversionEpisode,
  deleteObstetricUterineInversionEpisode,
  deleteObstetricUterineInversionFlowsheet,
  type ObstetricUterineInversionRecord,
  type ObstetricUterineInversionFlowsheetRecord,
} from '../api';
import { ObstetricUterineInversionModal } from './ObstetricUterineInversionModal';
import { ObstetricUterineInversionFlowsheetModal } from './ObstetricUterineInversionFlowsheetModal';

interface Props {
  patientId: number;
  userRole?: string;
}

export const ObstetricUterineInversionTab: React.FC<Props> = ({ patientId, userRole }) => {
  const [episodes, setEpisodes] = useState<ObstetricUterineInversionRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricUterineInversionRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricUterineInversionFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<ObstetricUterineInversionRecord | null>(null);

  const isDoctor = userRole === 'doctor';
  const isNurse = userRole === 'nurse';
  const canManage = isDoctor || isNurse;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getObstetricUterineInversionEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        await selectEpisode(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load uterine inversion records');
    } finally {
      setLoading(false);
    }
  };

  const selectEpisode = async (id: number) => {
    try {
      const res = await getObstetricUterineInversionEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load episode details');
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Delete this obstetric uterine inversion protocol episode?')) return;
    try {
      await deleteObstetricUterineInversionEpisode(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteObstetricUterineInversionFlowsheet(selectedEpisode.id, logId);
      await selectEpisode(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete log');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Obstetric Acute Uterine Inversion Protocol</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
              RCOG Green-top &bull; Code Red
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Johnson Manual Maneuver &bull; Neurogenic Shock Control &bull; O&apos;Sullivan Hydrostatic Technique &bull; Operative Huntington/Haultain
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <button
              onClick={() => window.open(`/obstetric-uterine-inversion/print?id=${selectedEpisode.id}`, '_blank')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              Print Dossier
            </button>
          )}

          {canManage && (
            <button
              onClick={() => {
                setEditingEpisode(null);
                setShowModal(true);
              }}
              className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              + Record Inversion Event
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading uterine inversion records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No uterine inversion episodes recorded for this patient.</p>
          {canManage && (
            <button
              onClick={() => {
                setEditingEpisode(null);
                setShowModal(true);
              }}
              className="mt-3 px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold"
            >
              Record Inversion Event
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Episode List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Inversion Episodes</h3>
            {episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => selectEpisode(ep.id)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  selectedEpisode?.id === ep.id
                    ? 'bg-rose-50 border-rose-500 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-gray-900 text-sm">{ep.episode_code}</span>
                    <p className="text-xs text-gray-500">{new Date(ep.occurrence_datetime).toLocaleString()}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      ep.status === 'acute_neurogenic_shock_reduction'
                        ? 'bg-rose-100 text-rose-800'
                        : ep.status === 'post_reinversion_bimanual_compression'
                        ? 'bg-amber-100 text-amber-800'
                        : ep.status === 'laparotomy_operative_repair'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {ep.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-1 border-t pt-2">
                  <div>
                    Degree: <strong className="text-gray-900 capitalize">{ep.inversion_degree.split('_')[0]}</strong>
                  </div>
                  <div>
                    BP: <strong className="text-gray-900">{ep.systolic_bp_at_presentation}/{ep.diastolic_bp_at_presentation}</strong>
                  </div>
                  <div>
                    Technique: <span className="capitalize">{ep.reduction_technique_primary.split('_')[0]}</span>
                  </div>
                  <div>
                    Success: <strong>{ep.reinversion_successful === 1 ? 'Yes' : 'No'}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Details Panel */}
          {selectedEpisode && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-center pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{selectedEpisode.episode_code}</h3>
                    <p className="text-xs text-gray-500">
                      Occurred {new Date(selectedEpisode.occurrence_datetime).toLocaleString()} &bull;{' '}
                      <span className="capitalize">{selectedEpisode.inversion_degree.replace(/_/g, ' ')}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        onClick={() => {
                          setEditingEpisode(selectedEpisode);
                          setShowModal(true);
                        }}
                        className="px-2.5 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    )}
                    {isDoctor && (
                      <button
                        onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                        className="px-2.5 py-1 border border-red-300 rounded text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Decision Support */}
                {evalResult && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-2">
                    <div className="flex flex-wrap justify-between items-center">
                      <span className="font-bold text-rose-950 uppercase tracking-wide">
                        Hemodynamic Shock & Urgency Classification
                      </span>
                      <span className="px-2 py-0.5 rounded font-bold bg-rose-200 text-rose-900">
                        {evalResult.shockSeverity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-rose-900 font-medium">{evalResult.shockSeverityLabel}</p>

                    {evalResult.criticalSafetyViolations.length > 0 && (
                      <div className="pt-2 border-t border-rose-200 space-y-1">
                        {evalResult.criticalSafetyViolations.map((v: string, idx: number) => (
                          <div key={idx} className="text-red-700 font-bold flex gap-1.5">
                            <span>&#9888;</span>
                            <span>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Key Clinical Values */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Shock Index</span>
                    <strong className="text-sm text-rose-700">
                      {evalResult ? evalResult.shockIndex : '-'}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Primary Technique</span>
                    <strong className="text-sm text-gray-900 capitalize">
                      {selectedEpisode.reduction_technique_primary.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Tocolytic Agent</span>
                    <strong className="text-sm text-purple-700 capitalize">
                      {selectedEpisode.uterine_relaxant_agent.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Est Blood Loss</span>
                    <strong className="text-sm text-gray-900">{selectedEpisode.estimated_blood_loss_ml} mL</strong>
                  </div>
                </div>

                {selectedEpisode.clinical_notes && (
                  <div className="bg-gray-50 p-3 rounded-lg border text-xs">
                    <strong className="text-gray-700 block mb-1">Operative & Resuscitation Notes:</strong>
                    <p className="text-gray-800 whitespace-pre-wrap">{selectedEpisode.clinical_notes}</p>
                  </div>
                )}
              </div>

              {/* Flowsheet Log */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-900 text-sm">Post-Reinversion Hemodynamics & Uterine Tone Log</h4>
                  {canManage && (
                    <button
                      onClick={() => setShowFlowsheetModal(true)}
                      className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-medium"
                    >
                      + Add Checkpoint
                    </button>
                  )}
                </div>

                {logs.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4 bg-gray-50 rounded">
                    No flowsheet checkpoints logged yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 border-b">
                        <tr>
                          <th className="py-2 px-2">Time / Min</th>
                          <th className="py-2 px-2">BP (mmHg)</th>
                          <th className="py-2 px-2">HR (bpm)</th>
                          <th className="py-2 px-2">Uterine Tone</th>
                          <th className="py-2 px-2">Bimanual / Oxytocin</th>
                          <th className="py-2 px-2">Ongoing Loss</th>
                          <th className="py-2 px-2">Notes</th>
                          {canManage && <th className="py-2 px-2">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {logs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-gray-50">
                            <td className="py-2 px-2 whitespace-nowrap">
                              {new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <span className="text-gray-400 block text-[10px]">+{lg.minutes_from_inversion}m</span>
                            </td>
                            <td className="py-2 px-2">
                              {lg.systolic_bp}/{lg.diastolic_bp}
                            </td>
                            <td className="py-2 px-2">{lg.heart_rate_bpm}</td>
                            <td className="py-2 px-2 capitalize font-semibold text-gray-900">
                              {lg.uterine_tone.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2 px-2">
                              {lg.bimanual_compression_active === 1 ? 'Bimanual (+)' : 'No'} /{' '}
                              {lg.oxytocin_infusion_running === 1 ? 'Oxytocin (+)' : 'No'}
                            </td>
                            <td className="py-2 px-2">{lg.estimated_ongoing_blood_loss_ml} mL</td>
                            <td className="py-2 px-2 text-gray-600 max-w-xs truncate">{lg.notes || '-'}</td>
                            {canManage && (
                              <td className="py-2 px-2">
                                <button
                                  onClick={() => handleDeleteLog(lg.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  &times;
                                </button>
                              </td>
                            )}
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
      <ObstetricUterineInversionModal
        patientId={patientId}
        existingEpisode={editingEpisode}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEpisode(null);
        }}
        onSaved={loadData}
      />

      {selectedEpisode && (
        <ObstetricUterineInversionFlowsheetModal
          episodeId={selectedEpisode.id}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => selectEpisode(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
