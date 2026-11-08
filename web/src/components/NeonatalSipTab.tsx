import React, { useState, useEffect } from 'react';
import {
  getNeonatalSipEpisodes,
  getNeonatalSipEpisode,
  updateNeonatalSipEpisode,
  deleteNeonatalSipFlowsheet,
  type NeonatalSipRecord,
  type NeonatalSipFlowsheetRecord,
} from '../api';
import { NeonatalSipModal } from './NeonatalSipModal';
import { NeonatalSipFlowsheetModal } from './NeonatalSipFlowsheetModal';
import { type NeonatalSipEvaluationResult } from '../neonatalSipEngine';

interface Props {
  patientId: number;
}

export const NeonatalSipTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalSipRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalSipRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalSipEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalSipFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalSipEpisodes({ patientId });
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
      console.error('Error loading neonatal SIP episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalSipEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading neonatal SIP episode details:', err);
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

  const handleStatusChange = async (newStatus: NeonatalSipRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateNeonatalSipEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageDays: currentEpisode.age_days,
        birthWeightGrams: currentEpisode.birth_weight_grams,
        gestationalAgeWeeks: currentEpisode.gestational_age_weeks,
        antenatalOrEarlySteroidsExposed: Boolean(currentEpisode.antenatal_or_early_steroids_exposed),
        indomethacinOrIbuprofenPdaExposed: Boolean(currentEpisode.indomethacin_or_ibuprofen_pda_exposed),
        pneumoperitoneumConfirmed: Boolean(currentEpisode.pneumoperitoneum_confirmed),
        pneumatosisIntestinalisAbsent: Boolean(currentEpisode.pneumatosis_intestinalis_absent),
        portalVenousGasAbsent: Boolean(currentEpisode.portal_venous_gas_absent),
        abdominalWallBluishDiscoloration: Boolean(currentEpisode.abdominal_wall_bluish_discoloration),
        peritonealDrainagePerformed: Boolean(currentEpisode.peritoneal_drainage_performed),
        drainType: currentEpisode.drain_type,
        peritonealFluidYeastCandidaPositive: Boolean(currentEpisode.peritoneal_fluid_yeast_candida_positive),
        surgicalApproach: currentEpisode.surgical_approach,
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      loadEpisodeDetails(currentEpisode.id);
      loadEpisodes();
    } catch (err) {
      console.error('Error updating neonatal SIP status:', err);
    }
  };

  const handleDeleteFlowsheet = async (flowsheetId: number) => {
    if (!currentEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalSipFlowsheet(currentEpisode.id, flowsheetId);
      loadEpisodeDetails(currentEpisode.id);
    } catch (err) {
      console.error('Failed to delete flowsheet entry:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🍼</span> Neonatal Spontaneous Intestinal Perforation (SIP) Protocol
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AAP / APSA / VON: ELBW Focal Ileal Rupture • Bedside RLQ Peritoneal Drainage • Postnatal Steroid/NSAID Synergy
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all flex items-center gap-1.5"
        >
          <span>+</span> New SIP Protocol
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
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {ep.episode_code} • Day {ep.age_days} ({ep.birth_weight_grams}g)
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading neonatal SIP data...</div>
      ) : !currentEpisode ? (
        <div className="p-8 text-center border-2 border-dashed rounded-xl border-slate-300 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            No active Spontaneous Intestinal Perforation (SIP) protocol on record.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Initiate a protocol when pneumoperitoneum without pneumatosis is identified in an ELBW infant.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow"
          >
            Initiate SIP Protocol
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Diagnostic & Urgency Banner */}
          {evaluation && (
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-500/10 dark:bg-amber-950/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-amber-600 text-white">
                    {evaluation.sipConfidenceLabel}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Episode: {currentEpisode.episode_code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {evaluation.urgencyTierLabel}
                  </span>
                  <select
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={currentEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value as NeonatalSipRecord['status'])}
                  >
                    <option value="acute_perforation_triage">Acute Perforation Triage</option>
                    <option value="bedside_peritoneal_drain_active">Bedside Peritoneal Drain Active</option>
                    <option value="laparotomy_resection_enterostomy">Laparotomy Resection &amp; Enterostomy</option>
                    <option value="drain_weaning_resolution">Drain Weaning &amp; Resolution</option>
                    <option value="convalescent_enteral_feeding">Convalescent Enteral Feeding</option>
                    <option value="resolved_discharged">Resolved / Discharged</option>
                  </select>
                </div>
              </div>

              {/* Alerts */}
              {evaluation.alerts.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1">
                  {evaluation.alerts.map((alert, i) => (
                    <div key={i} className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <span>⚠️</span> {alert}
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
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Birth Weight &amp; GA</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {currentEpisode.birth_weight_grams} g
              </div>
              <div className="text-[10px] text-slate-400">{currentEpisode.gestational_age_weeks} weeks GA</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Surgical Approach</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 capitalize">
                {currentEpisode.surgical_approach.replace(/_/g, ' ')}
              </div>
              <div className="text-[10px] text-slate-400">Drain: {currentEpisode.drain_type.replace(/_/g, ' ')}</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Medication Synergy</div>
              <div className="text-xs font-bold mt-1 text-slate-900 dark:text-white">
                {currentEpisode.antenatal_or_early_steroids_exposed && currentEpisode.indomethacin_or_ibuprofen_pda_exposed ? (
                  <span className="text-rose-600 dark:text-rose-400">Steroid + NSAID Synergy</span>
                ) : currentEpisode.antenatal_or_early_steroids_exposed ? (
                  <span>Steroid Exposed Only</span>
                ) : currentEpisode.indomethacin_or_ibuprofen_pda_exposed ? (
                  <span>NSAID Exposed Only</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">Unexposed</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">Focal antimesenteric risk factor</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Peritoneal Fluid Yeast</div>
              <div className="text-xs font-bold mt-1">
                {currentEpisode.peritoneal_fluid_yeast_candida_positive ? (
                  <span className="text-rose-600 dark:text-rose-400">Candida Positive 🍄</span>
                ) : (
                  <span className="text-slate-600 dark:text-slate-400">Negative / Pending</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                {currentEpisode.abdominal_wall_bluish_discoloration ? 'Bluish wall sign +' : 'No wall discoloration'}
              </div>
            </div>
          </div>

          {/* Directives Section */}
          {evaluation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span>🎯</span> Drainage Technique &amp; Bedside Directives
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {evaluation.drainageTechniqueDirectives.map((dir, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500">•</span> {dir}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <span>🚨</span> Laparotomy Conversion Criteria (Drain Failure)
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {evaluation.laparotomyConversionCriteria.map((crit, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-500">⚠️</span> {crit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Antimicrobial & Care Directives */}
          {evaluation && evaluation.antimicrobialDirectives.length > 0 && (
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                <span>💊</span> Antimicrobial, Antifungal &amp; TPN Directives
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                {evaluation.antimicrobialDirectives.map((dir, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-sky-500">•</span> {dir}
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
                  <span>📊</span> Serial Drain Output &amp; Sepsis Flowsheet
                </h4>
                <p className="text-[11px] text-slate-500">
                  Track 24h drain output, fluid aspect, abdominal girth, MAP, inotropes, and CRP/platelet recovery
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow transition-all flex items-center gap-1"
              >
                <span>+</span> Log Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 text-xs">
                No flowsheet checkpoints logged yet. Record daily drain outputs and abdominal girths.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="p-2.5">Time / Day</th>
                      <th className="p-2.5">Drain Vol (24h)</th>
                      <th className="p-2.5">Fluid Aspect</th>
                      <th className="p-2.5">Abdominal Girth</th>
                      <th className="p-2.5">MAP &amp; Inotropes</th>
                      <th className="p-2.5">Platelets &amp; CRP</th>
                      <th className="p-2.5">Notes</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                        <td className="p-2.5 font-medium whitespace-nowrap">
                          <div>+{log.hours_from_intervention}h</div>
                          <div className="text-[10px] text-slate-400">{log.log_datetime.slice(0, 16).replace('T', ' ')}</div>
                        </td>
                        <td className="p-2.5 font-bold text-amber-600 dark:text-amber-400">
                          {log.drain_output_ml_24h} mL
                        </td>
                        <td className="p-2.5 capitalize font-medium">
                          {log.drain_output_character.replace(/_/g, ' ')}
                        </td>
                        <td className="p-2.5 font-semibold">
                          {log.abdominal_girth_cm} cm
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold">{log.mean_airway_pressure_cmh2o} cmH2O MAP</div>
                          <div className="text-[10px] text-slate-400">
                            {log.inotropic_support_active ? '⚡ On inotropes' : 'Off inotropes'}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div>Plt: <span className="font-semibold">{log.platelet_count_k_ul}k</span></div>
                          <div className="text-[10px] text-slate-400">CRP: {log.crp_mg_l} mg/L</div>
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
              ✏️ Edit SIP Protocol
            </button>
            <a
              href={`/neonatal-sip/print/${currentEpisode.id}`}
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
        <NeonatalSipModal
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
        <NeonatalSipModal
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
        <NeonatalSipFlowsheetModal
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
