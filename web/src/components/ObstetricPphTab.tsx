import React, { useState, useEffect } from 'react';
import {
  getObstetricPphEpisodes,
  getObstetricPphEpisode,
  updateObstetricPphEpisode,
  deleteObstetricPphFlowsheet,
  type ObstetricPphRecord,
  type ObstetricPphFlowsheetRecord,
} from '../api';
import { ObstetricPphModal } from './ObstetricPphModal';
import { PphEmotiveFlowsheetModal } from './PphEmotiveFlowsheetModal';

interface Props {
  patientId: number;
}

export const ObstetricPphTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricPphRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricPphRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<ObstetricPphFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricPphEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadEpisodeDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetail = async (id: number) => {
    try {
      const res = await getObstetricPphEpisode(id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: any) => {
    if (!selectedEpisode) return;
    try {
      const res = await updateObstetricPphEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      setEpisodes(episodes.map((e) => (e.id === res.episode.id ? res.episode : e)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteObstetricPphFlowsheet(selectedEpisode.id, logId);
      loadEpisodeDetail(selectedEpisode.id);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading PPH records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Obstetric Postpartum Hemorrhage (PPH) & WHO E-MOTIVE</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
              FIGO 2022 & WHO 2023
            </span>
          </h2>
          <p className="text-xs text-gray-500">
            Gravimetric Quantitative Blood Loss (QBL), Shock Index & Stepwise Uterotonic / Bakri Tamponade
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/obstetric-pph/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 flex items-center gap-1.5"
            >
              Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 flex items-center gap-1"
          >
            + Initiate PPH Protocol
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-sm text-gray-600">No postpartum hemorrhage episodes recorded for this patient.</p>
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700"
          >
            Initiate PPH & E-MOTIVE Resuscitation
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Episode Selector if multiple */}
          {episodes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => loadEpisodeDetail(ep.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium border whitespace-nowrap ${
                    selectedEpisode?.id === ep.id
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {ep.episode_code} ({ep.status})
                </button>
              ))}
            </div>
          )}

          {selectedEpisode && (
            <>
              {/* Active Episode Summary Card */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      {selectedEpisode.episode_code}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      Recognized: {new Date(selectedEpisode.pph_recognition_datetime).toLocaleString()} ({selectedEpisode.delivery_mode.toUpperCase()})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">Status:</span>
                    <select
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="text-xs font-semibold border rounded px-2 py-1 bg-gray-50"
                    >
                      <option value="resuscitation_active">Resuscitation Active</option>
                      <option value="tamponade_active">Bakri Tamponade Active</option>
                      <option value="stabilized">Stabilized</option>
                      <option value="surgical_escalation">Surgical Escalation (OT)</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-red-50/80 border border-red-200 rounded-lg">
                    <div className="text-[11px] text-red-700 font-semibold uppercase">Cumulative QBL</div>
                    <div className="text-2xl font-black text-red-950 mt-0.5">
                      {selectedEpisode.gravimetric_qbl_ml}{' '}
                      <span className="text-xs font-normal text-red-700">mL</span>
                    </div>
                    <div className="text-[11px] text-red-800 mt-1 font-semibold">
                      Drape: {selectedEpisode.drape_blood_volume_ml} mL | Sponge: {selectedEpisode.swab_sponge_weight_net_g}g
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg">
                    <div className="text-[11px] text-amber-800 font-semibold uppercase">Shock Index (HR/SBP)</div>
                    <div className="text-2xl font-black text-amber-950 mt-0.5">
                      {selectedEpisode.shock_index}
                    </div>
                    <div className="text-[11px] text-amber-800 mt-1 font-semibold">
                      {selectedEpisode.shock_index >= 1.0 ? 'Severe Shock (MTP Alert)' : selectedEpisode.shock_index >= 0.9 ? 'Abnormal SI (>=0.9)' : 'Normal SI (<0.9)'}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg">
                    <div className="text-[11px] text-blue-800 font-semibold uppercase">4T Etiology</div>
                    <div className="text-base font-bold text-blue-950 mt-1 capitalize">
                      {selectedEpisode.etiology_4t.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-blue-700 mt-1">
                      {selectedEpisode.maternal_hypertension_history ? 'HTN (No Ergometrine)' : 'No HTN'}
                      {selectedEpisode.maternal_asthma_history ? ' | Asthma (No PGF2a)' : ''}
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-lg">
                    <div className="text-[11px] text-purple-800 font-semibold uppercase">Bakri Tamponade</div>
                    <div className="text-sm font-bold text-purple-950 mt-1">
                      {selectedEpisode.bakri_balloon_placed ? `${selectedEpisode.bakri_fill_volume_ml} mL Saline` : 'Not Placed'}
                    </div>
                    <div className="text-[11px] text-purple-800 mt-1 capitalize">
                      Test: {selectedEpisode.tamponade_test_result.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {/* E-MOTIVE Execution Tracker */}
                <div className="bg-gray-50 p-3 rounded-lg border text-xs space-y-1.5">
                  <span className="font-bold text-gray-800 uppercase text-[11px]">
                    WHO E-MOTIVE First Response Bundle Delivery:
                  </span>
                  <div className="flex flex-wrap gap-3 text-gray-700">
                    <span className={selectedEpisode.emotive_massage_done ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                      ✓ Uterine Massage
                    </span>
                    <span className={selectedEpisode.emotive_oxytocin_given ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                      ✓ Oxytocin
                    </span>
                    <span className={selectedEpisode.emotive_txa_given ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                      ✓ TXA 1g IV
                    </span>
                    <span className={selectedEpisode.emotive_iv_fluids_given ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                      ✓ Warm IV Fluids
                    </span>
                    <span className={selectedEpisode.emotive_exam_completed ? 'text-emerald-700 font-bold' : 'text-gray-400'}>
                      ✓ Genital Tract Exam
                    </span>
                    <span className={selectedEpisode.emotive_escalation_needed ? 'text-red-700 font-bold' : 'text-gray-500'}>
                      {selectedEpisode.emotive_escalation_needed ? '⚠ Escalated to Tamponade/OT' : 'Routine E-MOTIVE'}
                    </span>
                  </div>
                </div>

                {selectedEpisode.clinical_notes && (
                  <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded border border-gray-200">
                    <strong>Clinical Notes:</strong> {selectedEpisode.clinical_notes}
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Bedside PPH Resuscitation Flowsheet</h3>
                    <p className="text-xs text-gray-500">Real-time interval blood loss, shock index & medications</p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700"
                  >
                    + Record Flowsheet Entry
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500 border border-dashed rounded-lg">
                    No bedside logs yet. Click "+ Record Flowsheet Entry" to log interval blood loss & vitals.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 border-y text-gray-600 font-semibold">
                        <tr>
                          <th className="py-2 px-2.5">Time</th>
                          <th className="py-2 px-2.5">Elapsed</th>
                          <th className="py-2 px-2.5">Interval Loss</th>
                          <th className="py-2 px-2.5">Total QBL</th>
                          <th className="py-2 px-2.5">BP (mmHg)</th>
                          <th className="py-2 px-2.5">HR</th>
                          <th className="py-2 px-2.5">Shock Index</th>
                          <th className="py-2 px-2.5">Tone</th>
                          <th className="py-2 px-2.5">Medications / Notes</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-gray-800">
                        {flowsheetLogs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-gray-50/80">
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              {new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-2.5">+{lg.minutes_from_recognition}m</td>
                            <td className="py-2 px-2.5 font-bold text-red-900">+{lg.interval_blood_loss_ml} mL</td>
                            <td className="py-2 px-2.5 font-black text-red-950">{lg.cumulative_qbl_ml} mL</td>
                            <td className="py-2 px-2.5 font-mono">{lg.sbp}/{lg.dbp}</td>
                            <td className="py-2 px-2.5 font-bold text-red-700">{lg.heart_rate_bpm}</td>
                            <td className="py-2 px-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-bold ${
                                  lg.calculated_shock_index >= 1.0
                                    ? 'bg-red-100 text-red-800'
                                    : lg.calculated_shock_index >= 0.9
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {lg.calculated_shock_index}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 capitalize">{lg.uterine_tone.replace(/_/g, ' ')}</td>
                            <td className="py-2 px-2.5 max-w-[200px] truncate">
                              {lg.medication_given || lg.notes || '-'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              <button
                                onClick={() => handleDeleteLog(lg.id)}
                                className="text-red-500 hover:text-red-700 font-semibold"
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
            </>
          )}
        </div>
      )}

      {showEpisodeModal && (
        <ObstetricPphModal
          patientId={patientId}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={(ep) => {
            setShowEpisodeModal(false);
            fetchEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <PphEmotiveFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => {
            setShowFlowsheetModal(false);
            loadEpisodeDetail(selectedEpisode.id);
          }}
        />
      )}
    </div>
  );
};
