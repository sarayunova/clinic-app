import React, { useState, useEffect } from 'react';
import {
  getObstetricTolacEpisodes,
  getObstetricTolacEpisode,
  updateObstetricTolacStatus,
  deleteObstetricTolacFlowsheet,
  type ObstetricTolacRecord,
  type ObstetricTolacFlowsheetRecord,
} from '../api';
import { ObstetricTolacModal } from './ObstetricTolacModal';
import { ObstetricTolacFlowsheetModal } from './ObstetricTolacFlowsheetModal';
import { type ObstetricTolacResult } from '../obstetricTolacEngine';

interface Props {
  patientId: number;
}

export const ObstetricTolacTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricTolacRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricTolacRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricTolacResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricTolacFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricTolacEpisodes({ patientId });
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
      console.error('Error loading TOLAC episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricTolacEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err) {
      console.error('Error loading TOLAC details:', err);
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
      await updateObstetricTolacStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update TOLAC status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deleteObstetricTolacFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete TOLAC flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mb-2"></div>
        <p>Loading Trial of Labor After Cesarean (TOLAC) records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 to-teal-100 p-4 rounded-xl border border-emerald-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-sm">
            <span className="text-xl">🤰</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Obstetric Trial of Labor After Cesarean (TOLAC) & Rupture Protocol
            </h2>
            <p className="text-xs text-gray-600">
              ACOG Practice Bulletin No. 205: Grobman VBAC Success Prediction & Impending Rupture Triad Detection
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New TOLAC Evaluation</span>
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="text-4xl mb-3">🤰</div>
          <h3 className="text-base font-bold text-gray-800">No TOLAC Records Found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-4">
            No Trial of Labor After Cesarean assessment or uterine rupture surveillance records have been initiated.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Initiate TOLAC Protocol</span>
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
                const isCrash = ep.rupture_risk_tier === 'impending_or_active_uterine_rupture';

                return (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-gray-700">{ep.episode_code}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        isCrash ? 'bg-red-200 text-red-900' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      VBAC Success: {ep.grobman_vbac_success_pct}% | GA: {ep.gestational_age_weeks}w
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{ep.assessment_datetime?.slice(0, 10)}</span>
                      {ep.contraindications_present === 1 ? (
                        <span className="bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                          CONTRAINDICATED
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">TOLAC CANDIDATE</span>
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
                        currentEpisode.rupture_risk_tier === 'impending_or_active_uterine_rupture'
                          ? 'bg-red-600 text-white animate-pulse'
                          : currentEpisode.contraindications_present === 1
                          ? 'bg-amber-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {currentEpisode.rupture_risk_tier.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Prior Incision: {currentEpisode.prior_uterine_incision_type.replace(/_/g, ' ')} | Prior Cesareans: {currentEpisode.prior_cesarean_count} | Interval: {currentEpisode.interdelivery_interval_months} mo
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white"
                    >
                      <option value="eligible_tolac_counseled">Eligible TOLAC Counseled</option>
                      <option value="active_labor_efm_monitoring">Active Labor EFM Monitoring</option>
                      <option value="impending_rupture_detected">Impending Rupture Detected</option>
                      <option value="crash_cesarean_transfer">Transfer for Crash CS</option>
                      <option value="successful_vbac">Successful VBAC</option>
                      <option value="elective_repeat_cesarean">Elective Repeat CS</option>
                    </select>

                    <a
                      href={`/obstetric-tolac/${currentEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 inline-flex items-center gap-1"
                    >
                      <span>🖨️</span>
                      <span>Dossier</span>
                    </a>
                  </div>
                </div>

                {/* Score & Risk Cards */}
                {evaluation && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase">Grobman VBAC Probability</div>
                      <div className="text-xl font-extrabold text-emerald-900 mt-0.5">
                        {evaluation.grobmanVbacSuccessPct}%
                      </div>
                      <div className="text-[11px] text-emerald-600">
                        {evaluation.grobmanVbacSuccessPct >= 70 ? 'High Success Potential' : 'Moderate Success'}
                      </div>
                    </div>

                    <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                      <div className="text-[11px] font-bold text-teal-700 uppercase">Admission Bishop Score</div>
                      <div className="text-xl font-extrabold text-teal-900 mt-0.5">
                        {currentEpisode.bishop_score} / 13
                      </div>
                      <div className="text-[11px] text-teal-600">
                        {currentEpisode.bishop_score >= 8 ? 'Favorable Cervix' : 'Unripe Cervix'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-700 uppercase">EFM Category</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-1 capitalize">
                        {currentEpisode.efm_abnormality.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Continuous tracing
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg border ${
                      evaluation.isCrashCesareanIndicated ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="text-[11px] font-bold uppercase text-gray-700">Crash CS Indication</div>
                      <div className={`text-base font-black mt-1 ${
                        evaluation.isCrashCesareanIndicated ? 'text-red-700' : 'text-blue-700'
                      }`}>
                        {evaluation.isCrashCesareanIndicated ? 'CATEGORY-1 CRASH' : 'NO ACTIVE CRASH'}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Target DDI &le; 30 minutes
                      </div>
                    </div>
                  </div>
                )}

                {/* Alerts / Checklist Callout */}
                {evaluation && (
                  <div className="space-y-2">
                    {evaluation.alerts.length > 0 && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <h4 className="text-xs font-bold text-red-900 uppercase mb-1">
                          Critical Obstetric Warnings:
                        </h4>
                        <ul className="list-disc list-inside text-xs text-red-800 space-y-0.5">
                          {evaluation.alerts.map((alt, i) => (
                            <li key={i}>{alt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.recommendations.length > 0 && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <h4 className="text-xs font-bold text-emerald-900 uppercase mb-1">
                          ACOG TOLAC Recommendations:
                        </h4>
                        <ul className="list-disc list-inside text-xs text-emerald-800 space-y-0.5">
                          {evaluation.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Serial Labor Flowsheet */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">⏱️</span>
                    <h3 className="text-sm font-bold text-gray-900">
                      Active Labor Progression & Rupture Surveillance Flowsheet
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                  >
                    <span>+</span>
                    <span>Log Labor Checkpoint</span>
                  </button>
                </div>

                {flowsheet.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center italic">
                    No labor progress checkpoints logged yet. Record cervical dilation, FHR baseline, and contractions.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold">
                          <th className="py-2 px-3">Date/Time</th>
                          <th className="py-2 px-3">Labor (hrs)</th>
                          <th className="py-2 px-3">Dilation</th>
                          <th className="py-2 px-3">FHR Baseline</th>
                          <th className="py-2 px-3">EFM Cat.</th>
                          <th className="py-2 px-3">Contr. / 10m</th>
                          <th className="py-2 px-3">Tone (mmHg)</th>
                          <th className="py-2 px-3">Scar Pain</th>
                          <th className="py-2 px-3">Logged By</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flowsheet.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono">{item.log_datetime?.slice(11, 16)}</td>
                            <td className="py-2 px-3 font-semibold">{item.hours_in_active_labor}h</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{item.cervical_dilation_cm} cm</td>
                            <td className="py-2 px-3">{item.fetal_heart_rate_baseline} bpm</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.efm_category === 'category_3_abnormal' ? 'bg-red-200 text-red-900' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {item.efm_category.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-2 px-3">{item.contractions_per_10min}</td>
                            <td className="py-2 px-3">{item.resting_uterine_tone_mmhg ? `${item.resting_uterine_tone_mmhg} mmHg` : '-'}</td>
                            <td className="py-2 px-3 font-semibold text-red-600">
                              {item.lower_segment_scar_pain ? 'YES ⚠️' : 'No'}
                            </td>
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
      <ObstetricTolacModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <ObstetricTolacFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
