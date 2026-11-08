import React, { useState, useEffect } from 'react';
import {
  getNeonatalVolvulusEpisodes,
  getNeonatalVolvulusEpisode,
  updateNeonatalVolvulusStatus,
  deleteNeonatalVolvulusFlowsheet,
  type NeonatalVolvulusRecord,
  type NeonatalVolvulusFlowsheetRecord,
} from '../api';
import { NeonatalVolvulusModal } from './NeonatalVolvulusModal';
import { NeonatalVolvulusFlowsheetModal } from './NeonatalVolvulusFlowsheetModal';
import { type NeonatalVolvulusEvaluationResult } from '../neonatalVolvulusEngine';

interface Props {
  patientId: number;
}

export const NeonatalVolvulusTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalVolvulusRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalVolvulusRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalVolvulusEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalVolvulusFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalVolvulusEpisodes({ patientId });
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
      console.error('Error loading Volvulus episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalVolvulusEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet || res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading Volvulus details:', err);
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
      await updateNeonatalVolvulusStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update Volvulus status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deleteNeonatalVolvulusFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete Volvulus flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full mb-2"></div>
        <p>Loading Neonatal Volvulus & Malrotation records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="p-2 bg-red-100 text-red-700 rounded-lg">🌀</span>
            Neonatal Bilious Emesis & Midgut Volvulus Protocol
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            AAP Surgical Guidelines &middot; Upper GI Fluoroscopy &middot; Doppler Whirlpool &middot; Emergent Ladd Detorsion
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisodeId && (
            <a
              href={`#/print/neonatal-volvulus/${selectedEpisodeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition"
            >
              <span>🖨️</span> Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow flex items-center gap-1.5 transition"
          >
            <span>+</span> New Volvulus Evaluation
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <span className="text-4xl">🌀</span>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No Volvulus Protocols Recorded</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
            Evaluate any neonate presenting with bilious (dark green or bright yellow-green) vomiting for intestinal malrotation with midgut volvulus.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
          >
            Initiate Protocol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode Selector List */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Episodes ({episodes.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {episodes.map((ep) => {
                const isSelected = ep.id === selectedEpisodeId;
                return (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-red-50 border-red-400 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono font-bold text-red-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          ep.urgency_tier === 'immediate_operating_room_crash'
                            ? 'bg-red-600 text-white'
                            : ep.urgency_tier === 'emergent_imaging_workup'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {ep.urgency_tier.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1.5">
                      Onset: {new Date(ep.onset_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div className="text-xs font-medium text-gray-800 mt-1 flex items-center justify-between">
                      <span>Lactate: {ep.serum_lactate_mmol_l} mmol/L</span>
                      <span className="text-gray-500">Day {ep.age_days}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Episode Details & Flowsheet */}
          <div className="lg:col-span-3 space-y-6">
            {currentEpisode && (
              <>
                {/* Status Bar */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900">{currentEpisode.episode_code}</span>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          currentEpisode.status === 'in_operating_room_ladd'
                            ? 'bg-purple-100 text-purple-800 animate-pulse'
                            : currentEpisode.status === 'resolved_feeding_tolerated'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {currentEpisode.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Consultant: {currentEpisode.consultant_name || 'Attending Surgeon'} &middot; Evaluated:{' '}
                      {new Date(currentEpisode.onset_datetime).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">Update Status:</label>
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs font-semibold bg-gray-50 hover:bg-gray-100"
                    >
                      <option value="emergent_surgical_consult">Emergent Surgical Consult</option>
                      <option value="in_operating_room_ladd">In OR: Ladd Procedure</option>
                      <option value="post_op_bowel_recovery">Post-Op Recovery & TPN</option>
                      <option value="resolved_feeding_tolerated">Resolved: Feeds Tolerated</option>
                      <option value="short_bowel_syndrome_care">Short Bowel Syndrome Care</option>
                    </select>
                  </div>
                </div>

                {/* Urgency & Evaluation Card */}
                {evaluation && (
                  <div
                    className={`p-4 rounded-xl border ${
                      evaluation.urgencyTier === 'immediate_operating_room_crash'
                        ? 'bg-red-50 border-red-300'
                        : evaluation.urgencyTier === 'emergent_imaging_workup'
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-green-50 border-green-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-bold text-gray-900">{evaluation.urgencyTierLabel}</div>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          evaluation.laddProcedureIndicated
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {evaluation.laddProcedureIndicated
                          ? 'EMERGENT LADD PROCEDURE'
                          : 'CLINICAL SURVEILLANCE'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 mt-2">{evaluation.imagingRecommendation}</p>

                    {evaluation.alerts.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {evaluation.alerts.map((alt, i) => (
                          <div key={i} className="text-xs font-semibold flex items-center gap-1.5 text-red-900">
                            <span>🚨</span> {alt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Clinical Findings Grid */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Presentation & Diagnostic Findings
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Emesis Color</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.emesis_color.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Serum Lactate</span>
                      <span className={`font-bold ${currentEpisode.serum_lactate_mmol_l >= 3.0 ? 'text-red-700' : 'text-gray-900'}`}>
                        {currentEpisode.serum_lactate_mmol_l} mmol/L
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Plain Film</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.plain_radiograph_finding.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Upper GI Series</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.upper_gi_finding ? currentEpisode.upper_gi_finding.replace(/_/g, ' ') : 'Not performed'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Doppler Whirlpool Sign</span>
                      <span className="font-bold text-gray-900">
                        {Boolean(currentEpisode.doppler_us_whirlpool_sign) ? '✅ Positive' : '❌ Negative'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">SMA/SMV Inversion</span>
                      <span className="font-bold text-gray-900">
                        {Boolean(currentEpisode.doppler_sma_smv_inversion) ? '✅ Present' : '❌ Absent'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Abdominal Distension</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.abdominal_distension.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Melena / Bleeding</span>
                      <span className="font-bold text-gray-900">
                        {Boolean(currentEpisode.rectal_bleeding_melena) ? '⚠️ Yes' : 'None'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pre-operative Resuscitation Directives */}
                {evaluation && evaluation.resuscitationDirectives.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                      Pre-Operative Ladd Resuscitation Protocol
                    </h4>
                    <ul className="text-xs text-blue-950 space-y-1.5 list-disc list-inside">
                      {evaluation.resuscitationDirectives.map((dir, i) => (
                        <li key={i}>{dir}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Flowsheet Log Table */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <span>⏱️</span> Serial Flowsheet & Bowel Decompression Log
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Hourly Lactate, NG Tube Output, Perfusion & Clinical Signs
                      </p>
                    </div>
                    <button
                      onClick={() => setShowFlowsheetModal(true)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow transition"
                    >
                      + Add Checkpoint
                    </button>
                  </div>

                  {flowsheet.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-xs border border-dashed rounded-lg">
                      No serial checkpoints logged yet. Click &quot;Add Checkpoint&quot; to log serial vitals, lactate, and NG drainage.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                          <tr>
                            <th className="py-2 px-3">Time / Hours</th>
                            <th className="py-2 px-3">Lactate (mmol/L)</th>
                            <th className="py-2 px-3">Heart Rate</th>
                            <th className="py-2 px-3">BP (mmHg)</th>
                            <th className="py-2 px-3">Cap Refill</th>
                            <th className="py-2 px-3">NG Output (mL)</th>
                            <th className="py-2 px-3">Aspirate / Notes</th>
                            <th className="py-2 px-3">Logged By</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-gray-800">
                          {flowsheet.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 whitespace-nowrap font-medium">
                                +{log.hours_from_onset}h ({new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </td>
                              <td className="py-2 px-3 font-semibold text-red-700">
                                {log.serum_lactate_mmol_l != null ? `${log.serum_lactate_mmol_l}` : '—'}
                              </td>
                              <td className="py-2 px-3">{log.heart_rate} bpm</td>
                              <td className="py-2 px-3">
                                {log.blood_pressure_sys ? `${log.blood_pressure_sys}/${log.blood_pressure_dia}` : '—'}
                              </td>
                              <td className="py-2 px-3">
                                {log.capillary_refill_seconds ? `${log.capillary_refill_seconds}s` : '—'}
                              </td>
                              <td className="py-2 px-3 font-medium">
                                {log.ng_tube_output_ml != null ? `${log.ng_tube_output_ml} mL` : '—'}
                              </td>
                              <td className="py-2 px-3 max-w-xs truncate" title={log.ng_aspirate_appearance || log.notes || ''}>
                                {log.ng_aspirate_appearance || log.notes || '—'}
                              </td>
                              <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                {log.logged_by_name || 'Staff'}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteFlowsheet(log.id)}
                                  className="text-red-500 hover:text-red-700 font-bold px-1"
                                  title="Delete Checkpoint"
                                >
                                  &times;
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
        </div>
      )}

      {/* Modals */}
      <NeonatalVolvulusModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <NeonatalVolvulusFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
