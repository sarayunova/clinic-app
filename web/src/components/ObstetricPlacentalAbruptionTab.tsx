import React, { useState, useEffect } from 'react';
import {
  getObstetricPlacentalAbruptionEpisodes,
  getObstetricPlacentalAbruptionEpisode,
  updateObstetricPlacentalAbruptionStatus,
  deleteObstetricPlacentalAbruptionFlowsheet,
  type ObstetricPlacentalAbruptionRecord,
  type ObstetricPlacentalAbruptionFlowsheetRecord,
} from '../api';
import { ObstetricPlacentalAbruptionModal } from './ObstetricPlacentalAbruptionModal';
import { ObstetricPlacentalAbruptionFlowsheetModal } from './ObstetricPlacentalAbruptionFlowsheetModal';
import { type ObstetricPlacentalAbruptionEvaluationResult } from '../obstetricPlacentalAbruptionEngine';

interface Props {
  patientId: number;
}

export const ObstetricPlacentalAbruptionTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricPlacentalAbruptionRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricPlacentalAbruptionRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricPlacentalAbruptionEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricPlacentalAbruptionFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricPlacentalAbruptionEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const firstId = res.episodes[0].id;
        setSelectedEpisodeId((prev) => (prev && res.episodes.some((e) => e.id === prev) ? prev : firstId));
      } else {
        setSelectedEpisodeId(null);
        setCurrentEpisode(null);
        setEvaluation(null);
        setFlowsheet([]);
      }
    } catch (err) {
      console.error('Error loading Placental Abruption episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricPlacentalAbruptionEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet || res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading Placental Abruption details:', err);
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

  const handleStatusChange = async (newStatus: any) => {
    if (!selectedEpisodeId) return;
    try {
      await updateObstetricPlacentalAbruptionStatus(selectedEpisodeId, { status: newStatus });
      loadEpisodeDetails(selectedEpisodeId);
      loadEpisodes();
    } catch (err) {
      console.error('Failed to update abruption status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteObstetricPlacentalAbruptionFlowsheet(selectedEpisodeId, logId);
      loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading Placental Abruption protocols...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Obstetric Placental Abruption & Coagulopathy Protocol
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ACOG Practice Bulletin No. 183 / RCOG Green-top: Page Classification & MTP Cryoprecipitate Resuscitation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            + Initiate Abruption Protocol
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            No Placental Abruption protocols recorded for this obstetric patient.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-rose-700 text-white rounded-lg text-sm font-semibold hover:bg-rose-800 shadow"
          >
            Initiate Abruption Protocol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode Selection Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Recorded Episodes ({episodes.length})
            </h3>
            <div className="space-y-2">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => setSelectedEpisodeId(ep.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedEpisodeId === ep.id
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      ep.page_classification_grade === 'grade_3_severe_maternal_shock_demise_or_dic'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {ep.page_classification_grade.replace('grade_', 'Grade ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {ep.gestational_age_weeks} wks • Fibrinogen: {ep.serum_fibrinogen_mg_dl} mg/dL • {ep.uterine_tonus.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400 truncate">
                    Status: {ep.status.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Episode Detail View */}
          {currentEpisode && (
            <div className="lg:col-span-3 space-y-6">
              {/* Status & Urgent Actions Card */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {currentEpisode.episode_code}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      currentEpisode.mtp_activated
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                    }`}>
                      {currentEpisode.mtp_activated ? 'MTP ACTIVATED 1:1:1' : 'MTP Standby'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Consultant: Dr. {currentEpisode.consultant_name || 'Attending Obstetrician'} • Evaluated: {new Date(currentEpisode.presentation_datetime).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Status:
                    </label>
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="text-xs border rounded-lg px-2.5 py-1.5 font-semibold bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      <option value="emergent_stabilization">Emergent Stabilization</option>
                      <option value="crash_cesarean_in_progress">Crash Cesarean in Progress</option>
                      <option value="postpartum_dic_resuscitation">Postpartum DIC Resuscitation</option>
                      <option value="stabilized_ward_observation">Stabilized Ward Observation</option>
                      <option value="resolved_discharged">Resolved / Discharged</option>
                    </select>
                  </div>

                  <a
                    href={`/obstetric-placental-abruption/${currentEpisode.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>🖨</span> Print Dossier
                  </a>
                </div>
              </div>

              {/* Engine Evaluation Alert & Directives */}
              {evaluation && (
                <div className={`p-5 rounded-xl border ${
                  evaluation.pageClassificationGrade === 'grade_3_severe_maternal_shock_demise_or_dic'
                    ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800'
                    : 'bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚨</span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {evaluation.pageClassificationGradeLabel}
                      </h4>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800 shadow-sm text-slate-700 dark:text-slate-200">
                      Shock Index: {evaluation.shockIndex}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-rose-800 dark:text-rose-200 mb-2">
                    Strategy: {evaluation.deliveryModeIndicatedLabel}
                  </p>

                  {evaluation.isConsumptiveCoagulopathyPresent && (
                    <div className="text-xs font-black text-red-700 dark:text-red-300 mb-2">
                      ⚠️ SEVERE CONSUMPTIVE COAGULOPATHY: Fibrinogen {currentEpisode.serum_fibrinogen_mg_dl} mg/dL (&lt; 200 mg/dL target). Infuse {evaluation.bloodProductRequirements.cryoprecipitatePools} pools of Cryoprecipitate immediately.
                    </div>
                  )}

                  <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-rose-200 dark:border-rose-900/60 mt-2">
                    <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200 mb-1">
                      ACOG Directives & Target Blood Product Ratios
                    </h5>
                    <ul className="text-xs text-rose-800 dark:text-rose-300 space-y-1 list-disc pl-4">
                      {evaluation.resuscitationDirectives.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Clinical Presentation & Vitals Grid */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                  Obstetric Examination & Coagulation Profile
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Gestational Age</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.gestational_age_weeks} weeks
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Bleeding Pattern</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.vaginal_bleeding_severity.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Uterine Tonus</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 capitalize">
                      {currentEpisode.uterine_tonus.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Fetal Heart Rate Status</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.fetal_heart_rate_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Maternal Vitals</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      BP {currentEpisode.maternal_systolic_bp}/{currentEpisode.maternal_diastolic_bp} • HR {currentEpisode.maternal_heart_rate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Serum Fibrinogen</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {currentEpisode.serum_fibrinogen_mg_dl} mg/dL
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Platelets / Hb</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.platelet_count.toLocaleString()}/mcL • {currentEpisode.hemoglobin_g_dl} g/dL
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Retroplacental Hematoma</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.ultrasound_retroplacental_hematoma.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {currentEpisode.clinical_notes && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold block mb-0.5">Attending Obstetrician Notes:</span>
                    {currentEpisode.clinical_notes}
                  </div>
                )}
              </div>

              {/* Serial Resuscitation Flowsheet */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>📈</span> Serial Hemodynamic & Transfusion Flowsheet ({flowsheet.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Surveillance of shock index, uterine rigidity, cumulative blood loss & fibrinogen
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    + Log Checkpoint
                  </button>
                </div>

                {flowsheet.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed rounded-lg">
                    No flowsheet checkpoints logged yet. Record serial vitals, tone and blood products.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Mins</th>
                          <th className="p-2.5">BP (mmHg)</th>
                          <th className="p-2.5">HR</th>
                          <th className="p-2.5">Shock Index</th>
                          <th className="p-2.5">FHR</th>
                          <th className="p-2.5">Uterine Tone</th>
                          <th className="p-2.5">Loss (mL)</th>
                          <th className="p-2.5">Fibrinogen</th>
                          <th className="p-2.5">Transfused Products</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {flowsheet.map((log) => {
                          const si = (log.maternal_heart_rate / (log.maternal_blood_pressure_sys || 1)).toFixed(2);
                          return (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                              <td className="p-2.5 whitespace-nowrap">
                                {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-2.5">{log.minutes_from_presentation}m</td>
                              <td className="p-2.5">{log.maternal_blood_pressure_sys}/{log.maternal_blood_pressure_dia}</td>
                              <td className="p-2.5">{log.maternal_heart_rate}</td>
                              <td className={`p-2.5 font-bold ${parseFloat(si) >= 0.9 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {si}
                              </td>
                              <td className="p-2.5">{log.fetal_heart_rate ?? '—'}</td>
                              <td className="p-2.5 capitalize">{log.uterine_tone_assessment.replace(/_/g, ' ')}</td>
                              <td className="p-2.5">{log.vaginal_blood_loss_ml ?? '—'}</td>
                              <td className="p-2.5 font-bold text-rose-600 dark:text-rose-400">{log.fibrinogen_mg_dl ?? '—'}</td>
                              <td className="p-2.5 max-w-[140px] truncate" title={log.blood_products_infused || ''}>
                                {log.blood_products_infused || '—'}
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteFlowsheet(log.id)}
                                  className="text-red-500 hover:text-red-700 font-bold px-1"
                                >
                                  &times;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
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
      <ObstetricPlacentalAbruptionModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={() => {
          loadEpisodes();
          setShowCreateModal(false);
        }}
      />

      {selectedEpisodeId && (
        <ObstetricPlacentalAbruptionFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => {
            loadEpisodeDetails(selectedEpisodeId);
            setShowFlowsheetModal(false);
          }}
        />
      )}
    </div>
  );
};
