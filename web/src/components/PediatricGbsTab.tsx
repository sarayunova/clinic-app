import React, { useState, useEffect } from 'react';
import {
  getPediatricGbsEpisodes,
  getPediatricGbsEpisode,
  updatePediatricGbsEpisode,
  deletePediatricGbsFlowsheet,
  type PediatricGbsRecord,
  type PediatricGbsFlowsheetRecord,
} from '../api';
import { PediatricGbsModal } from './PediatricGbsModal';
import { PediatricGbsFlowsheetModal } from './PediatricGbsFlowsheetModal';
import { type PediatricGbsEvaluationResult } from '../pediatricGbsEngine';

interface Props {
  patientId: number;
}

export const PediatricGbsTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricGbsRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricGbsRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricGbsEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricGbsFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricGbsEpisodes({ patientId });
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
      console.error('Error loading pediatric GBS episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricGbsEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading pediatric GBS episode details:', err);
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

  const handleStatusChange = async (newStatus: PediatricGbsRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updatePediatricGbsEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageYears: currentEpisode.age_years,
        weightKg: currentEpisode.weight_kg,
        antecedentInfectionType: currentEpisode.antecedent_infection_type,
        brightonCriteriaLevel: currentEpisode.brighton_criteria_level,
        hughesDisabilityScore: currentEpisode.hughes_disability_score,
        ascendingSymmetricWeakness: Boolean(currentEpisode.ascending_symmetric_weakness),
        areflexiaOrHyporeflexia: Boolean(currentEpisode.areflexia_or_hyporeflexia),
        csfProteinMgDl: currentEpisode.csf_protein_mg_dl,
        csfWbcCountPerUl: currentEpisode.csf_wbc_count_per_ul,
        vitalCapacityMlKg: currentEpisode.vital_capacity_ml_kg,
        negativeInspiratoryForceCmh2o: currentEpisode.negative_inspiratory_force_cmh2o,
        peakExpiratoryPressureCmh2o: currentEpisode.peak_expiratory_pressure_cmh2o,
        dysautonomiaSignsPresent: Boolean(currentEpisode.dysautonomia_signs_present),
        immunotherapyRegimen: currentEpisode.immunotherapy_regimen,
        corticosteroidsAvoided: Boolean(currentEpisode.corticosteroids_avoided),
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      loadEpisodeDetails(currentEpisode.id);
      loadEpisodes();
    } catch (err) {
      console.error('Error updating pediatric GBS status:', err);
    }
  };

  const handleDeleteFlowsheet = async (flowsheetId: number) => {
    if (!currentEpisode || !window.confirm('Delete this neuromuscular flowsheet checkpoint?')) return;
    try {
      await deletePediatricGbsFlowsheet(currentEpisode.id, flowsheetId);
      loadEpisodeDetails(currentEpisode.id);
    } catch (err) {
      console.error('Failed to delete GBS flowsheet log:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/5 border border-indigo-500/20">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧠</span> Pediatric Guillain-Barré Syndrome (GBS) &amp; Brighton Criteria
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Brighton Levels 1–4 • 20/30/40 Rule (Impending Respiratory Arrest) • Hughes Functional Disability • IVIG 2 g/kg
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-1.5"
        >
          <span>+</span> New GBS Protocol
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {ep.episode_code} • Hughes {ep.hughes_disability_score} ({ep.weight_kg}kg)
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading pediatric GBS data...</div>
      ) : !currentEpisode ? (
        <div className="p-8 text-center border-2 border-dashed rounded-xl border-slate-300 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            No active Pediatric Guillain-Barré Syndrome (GBS) protocol on record.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Initiate a protocol upon acute flaccid symmetrical weakness, areflexia, or suspected neuromuscular respiratory decline.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow"
          >
            Initiate GBS Protocol
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Diagnostic & Urgency Banner */}
          {evaluation && (
            <div className="p-4 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-500/10 dark:bg-indigo-950/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-indigo-600 text-white">
                    {evaluation.hughesDisabilityLabel}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Code: {currentEpisode.episode_code} • IVIG Total: {evaluation.ivigDoseGramsTotal} g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {evaluation.urgencyTierLabel}
                  </span>
                  <select
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={currentEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value as PediatricGbsRecord['status'])}
                  >
                    <option value="acute_diagnostic_evaluation">Acute Diagnostic Evaluation</option>
                    <option value="picu_ventilatory_support">PICU Ventilatory Support</option>
                    <option value="immunotherapy_infusion_active">Immunotherapy Infusion Active</option>
                    <option value="dysautonomia_telemetry_monitoring">Dysautonomia Telemetry Monitoring</option>
                    <option value="subacute_rehabilitation_weaning">Subacute Rehabilitation &amp; Weaning</option>
                    <option value="resolved_full_motor_recovery">Resolved Full Motor Recovery</option>
                  </select>
                </div>
              </div>

              {/* 20/30/40 Rule Alert */}
              <div className="p-3 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  20/30/40 Respiratory Mechanics Status:
                </div>
                <div className={`text-xs font-bold ${evaluation.isImpendingRespiratoryFailure ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {evaluation.respiratoryFailureRuleLabel}
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
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Age &amp; Weight</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {currentEpisode.age_years} yrs • {currentEpisode.weight_kg} kg
              </div>
              <div className="text-[10px] text-slate-400">Total IVIG dose: {evaluation?.ivigDoseGramsTotal} g</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">CSF Dissociation</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                Protein {currentEpisode.csf_protein_mg_dl} mg/dL
              </div>
              <div className="text-[10px] text-slate-400">WBCs: {currentEpisode.csf_wbc_count_per_ul} /µL (target &lt;10)</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Vital Capacity &amp; NIF</div>
              <div className="text-xs font-bold mt-1 text-slate-900 dark:text-white">
                VC {currentEpisode.vital_capacity_ml_kg} mL/kg • NIF {currentEpisode.negative_inspiratory_force_cmh2o}
              </div>
              <div className="text-[10px] text-slate-400">PEP: {currentEpisode.peak_expiratory_pressure_cmh2o} cmH2O</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Brighton &amp; Steroids</div>
              <div className="text-xs font-bold mt-1 text-slate-900 dark:text-white capitalize truncate">
                {currentEpisode.brighton_criteria_level.replace(/_/g, ' ')}
              </div>
              <div className="text-[10px] text-slate-400">
                {currentEpisode.corticosteroids_avoided ? 'Steroids Avoided ✓' : 'Steroid Warning!'}
              </div>
            </div>
          </div>

          {/* Directives Section */}
          {evaluation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <span>💊</span> Immunotherapy &amp; Dosing Directives
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {evaluation.immunotherapyDirectives.map((dir, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-indigo-500">•</span> {dir}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <span>🫁</span> Respiratory PFT Monitoring &amp; Intubation
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {evaluation.respiratoryMonitoringDirectives.map((crit, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-500">•</span> {crit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Autonomic Dysreflexia Directives */}
          {evaluation && evaluation.autonomicDysreflexiaDirectives.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <span>⚡</span> Autonomic Dysreflexia &amp; Hemodynamic Telemetry Directives
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                {evaluation.autonomicDysreflexiaDirectives.map((dir, idx) => (
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
                  <span>📊</span> Serial 20/30/40 PFT &amp; Hughes Score Flowsheet
                </h4>
                <p className="text-[11px] text-slate-500">
                  Track VC, NIF, PEP, Hughes disability progression, dysautonomia events, and ventilation
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all flex items-center gap-1"
              >
                <span>+</span> Log Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 text-xs">
                No flowsheet checkpoints logged yet. Record serial spirometry, NIF, and Hughes score.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="p-2.5">Time / Day of Illness</th>
                      <th className="p-2.5">VC &amp; Breath Count</th>
                      <th className="p-2.5">Neck Power</th>
                      <th className="p-2.5">Hughes Score</th>
                      <th className="p-2.5">HR &amp; BP</th>
                      <th className="p-2.5">Cranial Palsy &amp; Retention</th>
                      <th className="p-2.5">Notes</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                        <td className="p-2.5 font-medium whitespace-nowrap">
                          <div>Day {log.day_of_illness}</div>
                          <div className="text-[10px] text-slate-400">{log.log_datetime.slice(0, 16).replace('T', ' ')}</div>
                        </td>
                        <td className={`p-2.5 font-bold ${log.vital_capacity_ml_kg < 20 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          <div>{log.vital_capacity_ml_kg} mL/kg</div>
                          <div className="text-[10px] text-slate-400">SBC: {log.single_breath_count}</div>
                        </td>
                        <td className="p-2.5 font-semibold">
                          MRC {log.neck_flexion_power_mrc}/5
                        </td>
                        <td className="p-2.5 font-bold">
                          Hughes {log.hughes_score_current}
                        </td>
                        <td className="p-2.5 text-[11px]">
                          <div>{log.heart_rate_bpm} bpm</div>
                          <div className="text-[10px] text-slate-400">{log.systolic_bp}/{log.diastolic_bp}</div>
                        </td>
                        <td className="p-2.5 text-[11px]">
                          <div>{log.cranial_nerve_palsy_facial_bulbar ? '⚠️ Cranial Palsy' : 'CN intact'}</div>
                          <div className="text-[10px] text-slate-400">{log.urinary_retention_catheterized ? 'Catheterized' : 'Normal bladder'}</div>
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
              ✏️ Edit GBS Protocol
            </button>
            <a
              href={`/pediatric-gbs/print/${currentEpisode.id}`}
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
        <PediatricGbsModal
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
        <PediatricGbsModal
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
        <PediatricGbsFlowsheetModal
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
