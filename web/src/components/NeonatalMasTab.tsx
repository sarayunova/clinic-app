import React, { useState, useEffect } from 'react';
import {
  getNeonatalMasEpisodes,
  getNeonatalMasEpisode,
  deleteNeonatalMasEpisode,
  deleteNeonatalMasFlowsheet,
  type NeonatalMasRecord,
  type NeonatalMasFlowsheetRecord,
} from '../api';
import { NeonatalMasModal } from './NeonatalMasModal';
import { NeonatalMasFlowsheetModal } from './NeonatalMasFlowsheetModal';

interface Props {
  patientId: number;
  userRole?: string;
}

export const NeonatalMasTab: React.FC<Props> = ({ patientId, userRole }) => {
  const [episodes, setEpisodes] = useState<NeonatalMasRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalMasRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalMasFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<NeonatalMasRecord | null>(null);

  const isDoctor = userRole === 'doctor';
  const isNurse = userRole === 'nurse';
  const canManage = isDoctor || isNurse;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getNeonatalMasEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        await selectEpisode(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load neonatal MAS records');
    } finally {
      setLoading(false);
    }
  };

  const selectEpisode = async (id: number) => {
    try {
      const res = await getNeonatalMasEpisode(id);
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
    if (!window.confirm('Are you sure you want to delete this neonatal MAS protocol record?')) return;
    try {
      await deleteNeonatalMasEpisode(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalMasFlowsheet(selectedEpisode.id, logId);
      await selectEpisode(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Neonatal Meconium Aspiration Syndrome (MAS) Protocol</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
              AAP NRP &bull; PPHN Rescue
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Oxygenation Index (OI) &bull; Surfactant Replacement &bull; Inhaled Nitric Oxide (iNO) &bull; HFOV Strategy
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <button
              onClick={() => window.open(`/neonatal-mas/print?id=${selectedEpisode.id}`, '_blank')}
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
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              + Initiate MAS Protocol
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading MAS records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No neonatal MAS episodes recorded for this infant.</p>
          {canManage && (
            <button
              onClick={() => {
                setEditingEpisode(null);
                setShowModal(true);
              }}
              className="mt-3 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold"
            >
              Initiate MAS Protocol Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Episode List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Protocol Episodes</h3>
            {episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => selectEpisode(ep.id)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  selectedEpisode?.id === ep.id
                    ? 'bg-teal-50 border-teal-500 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-gray-900 text-sm">{ep.episode_code}</span>
                    <p className="text-xs text-gray-500">{new Date(ep.diagnosis_datetime).toLocaleString()}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      ep.status === 'acute_respiratory_failure'
                        ? 'bg-rose-100 text-rose-800'
                        : ep.status === 'hfov_ino_escalation'
                        ? 'bg-purple-100 text-purple-800'
                        : ep.status === 'weaning_recovering'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {ep.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-1 border-t pt-2">
                  <div>
                    OI:{' '}
                    <strong className="text-gray-900">
                      {ep.oxygenation_index !== null ? ep.oxygenation_index : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    FiO2: <strong className="text-gray-900">{ep.fio2_percent}%</strong>
                  </div>
                  <div>
                    Mode: <span className="capitalize">{ep.respiratory_support_mode.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    PPHN: <span className="capitalize">{ep.pphn_severity.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Details & Decision Support */}
          {selectedEpisode && (
            <div className="lg:col-span-2 space-y-4">
              {/* Primary Panel */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-center pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{selectedEpisode.episode_code}</h3>
                    <p className="text-xs text-gray-500">
                      Diagnosed {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()} &bull; GA{' '}
                      {selectedEpisode.gestational_age_weeks}w &bull; Weight {selectedEpisode.current_weight_kg} kg
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

                {/* Live Clinical Stratification */}
                {evalResult && (
                  <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-lg text-xs space-y-2">
                    <div className="flex flex-wrap justify-between items-center">
                      <span className="font-bold text-teal-950 uppercase tracking-wide">
                        Clinical Severity Stratification
                      </span>
                      <span className="px-2 py-0.5 rounded font-bold bg-teal-200 text-teal-900">
                        {evalResult.hypoxemicFailureSeverity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-teal-900 font-medium">{evalResult.hypoxemicFailureLabel}</p>

                    {evalResult.clinicalAlerts.length > 0 && (
                      <div className="pt-2 border-t border-teal-200 space-y-1">
                        {evalResult.clinicalAlerts.map((alt: string, idx: number) => (
                          <div key={idx} className="text-rose-800 font-medium flex gap-1.5">
                            <span>&#9888;</span>
                            <span>{alt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Oxygenation Index (OI)</span>
                    <strong className="text-sm text-gray-900">
                      {selectedEpisode.oxygenation_index !== null ? selectedEpisode.oxygenation_index : 'N/A'}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">FiO2 & MAP</span>
                    <strong className="text-sm text-gray-900">
                      {selectedEpisode.fio2_percent}% / {selectedEpisode.mean_airway_pressure_cmh2o} cmH2O
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">iNO Infusion</span>
                    <strong className="text-sm text-purple-700">
                      {selectedEpisode.inhaled_nitric_oxide_prescribed === 1
                        ? `${selectedEpisode.ino_dose_ppm} ppm`
                        : 'None'}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Surfactant</span>
                    <strong className="text-sm text-blue-700">
                      {selectedEpisode.surfactant_administered === 1
                        ? `${selectedEpisode.surfactant_dose_mg_kg} mg/kg`
                        : 'Withheld'}
                    </strong>
                  </div>
                </div>

                {/* Clinical Notes */}
                {selectedEpisode.clinical_notes && (
                  <div className="bg-gray-50 p-3 rounded-lg border text-xs">
                    <strong className="text-gray-700 block mb-1">Clinical Assessment Notes:</strong>
                    <p className="text-gray-800 whitespace-pre-wrap">{selectedEpisode.clinical_notes}</p>
                  </div>
                )}
              </div>

              {/* Flowsheet Log Table */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-900 text-sm">Serial Respiratory & Blood Gas Flowsheet</h4>
                  {canManage && (
                    <button
                      onClick={() => setShowFlowsheetModal(true)}
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-medium"
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
                          <th className="py-2 px-2">Time / Hr</th>
                          <th className="py-2 px-2">HR / RR</th>
                          <th className="py-2 px-2">Pre / Post SpO2</th>
                          <th className="py-2 px-2">FiO2 / MAP</th>
                          <th className="py-2 px-2">PaO2 / OI</th>
                          <th className="py-2 px-2">iNO (ppm)</th>
                          <th className="py-2 px-2">Notes</th>
                          {canManage && <th className="py-2 px-2">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {logs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-gray-50">
                            <td className="py-2 px-2 whitespace-nowrap">
                              {new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <span className="text-gray-400 block text-[10px]">+{lg.hours_from_admission}h</span>
                            </td>
                            <td className="py-2 px-2">
                              {lg.heart_rate_bpm} / {lg.respiratory_rate}
                            </td>
                            <td className="py-2 px-2">
                              <span className="font-semibold text-gray-800">{lg.pre_ductal_spo2_percent}%</span> /{' '}
                              <span className="text-gray-600">{lg.post_ductal_spo2_percent}%</span>
                              <span className="text-rose-700 block text-[10px]">
                                &Delta; {Math.max(0, lg.pre_ductal_spo2_percent - lg.post_ductal_spo2_percent)}%
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              {lg.fio2_percent}% / {lg.mean_airway_pressure_cmh2o}
                            </td>
                            <td className="py-2 px-2">
                              {lg.pao2_mmhg ? `${lg.pao2_mmhg} mmHg` : '-'}
                              {lg.oxygenation_index !== null && (
                                <strong className="text-amber-800 block text-[10px]">
                                  OI {lg.oxygenation_index}
                                </strong>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {lg.ino_dose_ppm > 0 ? (
                                <span className="font-bold text-purple-700">{lg.ino_dose_ppm}</span>
                              ) : (
                                '-'
                              )}
                            </td>
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
      <NeonatalMasModal
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
        <NeonatalMasFlowsheetModal
          episodeId={selectedEpisode.id}
          currentMap={selectedEpisode.mean_airway_pressure_cmh2o}
          currentFio2={selectedEpisode.fio2_percent}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => selectEpisode(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
