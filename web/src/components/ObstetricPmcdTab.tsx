import React, { useState, useEffect } from 'react';
import {
  getObstetricPmcdEpisodes,
  getObstetricPmcdEpisode,
  updateObstetricPmcdEpisode,
  deleteObstetricPmcdFlowsheet,
  type ObstetricPmcdRecord,
  type ObstetricPmcdFlowsheetRecord,
} from '../api';
import { ObstetricPmcdModal } from './ObstetricPmcdModal';
import { ObstetricPmcdFlowsheetModal } from './ObstetricPmcdFlowsheetModal';
import { type ObstetricPmcdEvaluationResult } from '../obstetricPmcdEngine';

interface Props {
  patientId: number;
}

export const ObstetricPmcdTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricPmcdRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricPmcdRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricPmcdEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricPmcdFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricPmcdEpisodes({ patientId });
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
      console.error('Error loading obstetric PMCD episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricPmcdEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading obstetric PMCD episode details:', err);
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

  const handleStatusChange = async (newStatus: ObstetricPmcdRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateObstetricPmcdEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        arrestDatetime: currentEpisode.arrest_datetime,
        gestationalAgeWeeks: currentEpisode.gestational_age_weeks,
        initialArrestRhythm: currentEpisode.initial_arrest_rhythm,
        cprInitiatedDatetime: currentEpisode.cpr_initiated_datetime,
        continuousLeftUterineDisplacement: Boolean(currentEpisode.continuous_left_uterine_displacement),
        pmcdDecisionMinute: currentEpisode.pmcd_decision_minute,
        incisionDatetime: currentEpisode.incision_datetime,
        infantDeliveryDatetime: currentEpisode.infant_delivery_datetime,
        elapsedArrestToDeliveryMinutes: currentEpisode.elapsed_arrest_to_delivery_minutes,
        roscAchievedPostDelivery: Boolean(currentEpisode.rosc_achieved_post_delivery),
        roscDatetime: currentEpisode.rosc_datetime,
        primaryEtiologyBeauChops: currentEpisode.primary_etiology_beau_chops,
        uterineClosureMethod: currentEpisode.uterine_closure_method,
        maternalSurvivalStatus: currentEpisode.maternal_survival_status,
        neonatalSurvivalStatus: currentEpisode.neonatal_survival_status,
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      loadEpisodeDetails(currentEpisode.id);
      loadEpisodes();
    } catch (err) {
      console.error('Error updating obstetric PMCD status:', err);
    }
  };

  const handleDeleteFlowsheet = async (flowsheetId: number) => {
    if (!currentEpisode || !window.confirm('Delete this resuscitation checkpoint?')) return;
    try {
      await deleteObstetricPmcdFlowsheet(currentEpisode.id, flowsheetId);
      loadEpisodeDetails(currentEpisode.id);
    } catch (err) {
      console.error('Failed to delete PMCD flowsheet log:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/10 dark:bg-rose-500/5 border border-rose-500/20">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>⚡</span> Obstetric Perimortem Cesarean Delivery (PMCD) / Resuscitative Hysterotomy
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AHA CPR in Pregnancy / SOAP: 4-to-5 Minute Rule • Aortocaval Decompression • BEAU-CHOPS Etiology Checklist
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all flex items-center gap-1.5"
        >
          <span>+</span> New PMCD Protocol
        </button>
      </div>

      {/* Episode Navigation Tabs */}
      {episodes.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-700">
          {episodes.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setSelectedEpisodeId(ep.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                selectedEpisodeId === ep.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {ep.episode_code} • GA {ep.gestational_age_weeks}w ({ep.initial_arrest_rhythm.toUpperCase()})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading obstetric PMCD data...</div>
      ) : !currentEpisode ? (
        <div className="p-8 text-center border-2 border-dashed rounded-xl border-slate-300 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            No active Perimortem Cesarean Delivery (PMCD) resuscitation protocol on record.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Initiate immediately upon maternal cardiac arrest in a patient with a gravid uterus ≥20 weeks.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow"
          >
            Initiate PMCD Protocol
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Diagnostic & Urgency Banner */}
          {evaluation && (
            <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-500/10 dark:bg-rose-950/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-rose-600 text-white">
                    {evaluation.timeComplianceLabel}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Code: {currentEpisode.episode_code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {evaluation.urgencyTierLabel}
                  </span>
                  <select
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={currentEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value as ObstetricPmcdRecord['status'])}
                  >
                    <option value="cardiac_arrest_resuscitation">Cardiac Arrest Resuscitation</option>
                    <option value="hysterotomy_evacuation_active">Hysterotomy Evacuation Active</option>
                    <option value="post_rosc_intensive_care">Post-ROSC Intensive Care</option>
                    <option value="surgical_hemostasis_icu">Surgical Hemostasis / ICU Transfer</option>
                    <option value="convalescent_rehabilitation">Convalescent Rehabilitation</option>
                    <option value="case_closed">Case Closed</option>
                  </select>
                </div>
              </div>

              {/* Alerts */}
              {evaluation.alerts.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1">
                  {evaluation.alerts.map((alert, i) => (
                    <div key={i} className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <span>🚨</span> {alert}
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {evaluation.recommendations.length > 0 && (
                <div className="space-y-1">
                  {evaluation.recommendations.map((rec, i) => (
                    <div key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span>💡</span> {rec}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Gestational Age</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {currentEpisode.gestational_age_weeks} weeks
              </div>
              <div className="text-[10px] text-slate-400">
                {currentEpisode.gestational_age_weeks >= 20 ? 'Aortocaval compression active' : 'Pre-viable compression'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Decision / Incision</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                Minute {currentEpisode.pmcd_decision_minute} post-arrest
              </div>
              <div className="text-[10px] text-slate-400">
                {currentEpisode.pmcd_decision_minute <= 4.0 ? 'Compliant with ≤4 min' : 'Exceeded 4 min goal'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Maternal ROSC</div>
              <div className="text-xs font-bold mt-1">
                {currentEpisode.rosc_achieved_post_delivery ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">ROSC Achieved 💓</span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">Ongoing Arrest / Demise</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                LUD: {currentEpisode.continuous_left_uterine_displacement ? 'Maintained (≥30°)' : 'Absent'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">BEAU-CHOPS Etiology</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 capitalize truncate">
                {currentEpisode.primary_etiology_beau_chops.replace(/_/g, ' ')}
              </div>
              <div className="text-[10px] text-slate-400">
                Closure: {currentEpisode.uterine_closure_method.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          {/* Operative & Post-ROSC Directives */}
          {evaluation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <span>⚡</span> Operative Bedside Resuscitative Hysterotomy Directives
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {evaluation.operativeHysterotomyDirectives.map((dir, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-500">•</span> {dir}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                  <span>🧠</span> Post-ROSC Intensive Care &amp; Targeted Temperature
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {evaluation.postRoscCareDirectives.map((care, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-sky-500">•</span> {care}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* BEAU-CHOPS Etiology Directives */}
          {evaluation && evaluation.etiologySpecificDirectives.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <span>🎯</span> Reversible Etiology Interventions (BEAU-CHOPS: {currentEpisode.primary_etiology_beau_chops.replace(/_/g, ' ').toUpperCase()})
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                {evaluation.etiologySpecificDirectives.map((dir, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500">•</span> {dir}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Flowsheet Log Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>📊</span> Resuscitation &amp; Post-ROSC Checkpoints Flowsheet
                </h4>
                <p className="text-[11px] text-slate-500">
                  Track CPR EtCO2, vital signs, pupillary reactivity, TTM target, and blood transfusions
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow transition-all flex items-center gap-1"
              >
                <span>+</span> Log Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 text-xs">
                No resuscitation checkpoints recorded yet. Log vitals, EtCO2, and blood transfusions.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="p-2.5">Time / Min Post-Arrest</th>
                      <th className="p-2.5">HR &amp; BP</th>
                      <th className="p-2.5">EtCO2 (mmHg)</th>
                      <th className="p-2.5">Pupillary Response</th>
                      <th className="p-2.5">Quality / ROSC</th>
                      <th className="p-2.5">TTM &amp; Transfusions</th>
                      <th className="p-2.5">Notes</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                        <td className="p-2.5 font-medium whitespace-nowrap">
                          <div>+{log.minutes_post_arrest} min</div>
                          <div className="text-[10px] text-slate-400">{log.log_datetime.slice(0, 16).replace('T', ' ')}</div>
                        </td>
                        <td className="p-2.5 font-bold">
                          {log.heart_rate_bpm} bpm • {log.systolic_bp}/{log.diastolic_bp}
                        </td>
                        <td className="p-2.5 font-bold text-rose-600 dark:text-rose-400">
                          {log.end_tidal_co2_mmhg} mmHg
                        </td>
                        <td className="p-2.5 capitalize font-medium">
                          {log.pupillary_response.replace(/_/g, ' ')}
                        </td>
                        <td className="p-2.5 capitalize text-[11px]">
                          {log.chest_compressions_quality.replace(/_/g, ' ')}
                        </td>
                        <td className="p-2.5">
                          <div>Epi: <span className="font-semibold">{log.epinephrine_cumulative_doses} doses</span> • Defib: {log.defibrillation_shocks_count}</div>
                          <div className="text-[10px] text-slate-400">Transfusions: {log.blood_products_transfused_units} units</div>
                        </td>
                        <td className="p-2.5 text-slate-500 max-w-[200px] truncate">
                          {log.notes || '—'}
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteFlowsheet(log.id)}
                            className="text-rose-500 hover:text-rose-700 font-bold p-1 text-xs"
                            title="Delete log"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300"
            >
              ✏️ Edit PMCD Protocol
            </button>
            <a
              href={`/obstetric-pmcd/print/${currentEpisode.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 shadow flex items-center gap-1.5"
            >
              <span>🖨</span> Print Clinical Dossier
            </a>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <ObstetricPmcdModal
          patientId={patientId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newId) => {
            if (newId) setSelectedEpisodeId(newId);
            loadEpisodes();
          }}
        />
      )}

      {showEditModal && currentEpisode && (
        <ObstetricPmcdModal
          patientId={patientId}
          initialEpisode={currentEpisode}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            loadEpisodeDetails(currentEpisode.id);
            loadEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && currentEpisode && (
        <ObstetricPmcdFlowsheetModal
          episodeId={currentEpisode.id}
          episode={currentEpisode}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => loadEpisodeDetails(currentEpisode.id)}
        />
      )}
    </div>
  );
};
