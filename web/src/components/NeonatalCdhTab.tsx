import React, { useState, useEffect } from 'react';
import {
  getNeonatalCdhEpisodes,
  getNeonatalCdhEpisode,
  updateNeonatalCdhEpisode,
  type NeonatalCdhRecord,
  type NeonatalCdhFlowsheetRecord,
} from '../api';
import { NeonatalCdhModal } from './NeonatalCdhModal';
import { NeonatalCdhFlowsheetModal } from './NeonatalCdhFlowsheetModal';
import { type NeonatalCdhEvaluationResult } from '../neonatalCdhEngine';

interface Props {
  patientId: number;
}

export const NeonatalCdhTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalCdhRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalCdhRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalCdhEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalCdhFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalCdhEpisodes({ patientId });
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
      console.error('Error loading neonatal CDH episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalCdhEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading neonatal CDH episode details:', err);
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

  const handleStatusChange = async (newStatus: NeonatalCdhRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateNeonatalCdhEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageHours: currentEpisode.age_hours,
        weightKg: currentEpisode.weight_kg,
        defectSide: currentEpisode.defect_side,
        liverHerniationUp: Boolean(currentEpisode.liver_herniation_up),
        observedExpectedLhrPercent: currentEpisode.observed_expected_lhr_percent,
        bagMaskAvoidedInDeliveryRoom: Boolean(currentEpisode.bag_mask_avoided_in_delivery_room),
        replogleSumpDecompressionActive: Boolean(currentEpisode.replogle_sump_decompression_active),
        preductalSpo2Percent: currentEpisode.preductal_spo2_percent,
        postductalSpo2Percent: currentEpisode.postductal_spo2_percent,
        peakInspiratoryPressureCmh2o: currentEpisode.peak_inspiratory_pressure_cmh2o,
        peepCmh2o: currentEpisode.peep_cmh2o,
        paco2Mmhg: currentEpisode.paco2_mmhg,
        inhaledNitricOxideActive: Boolean(currentEpisode.inhaled_nitric_oxide_active),
        sildenafilInfusionActive: Boolean(currentEpisode.sildenafil_infusion_active),
        surgicalRepairStatus: currentEpisode.surgical_repair_status,
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      await loadEpisodeDetails(currentEpisode.id);
      await loadEpisodes();
    } catch (err) {
      console.error('Error updating neonatal CDH status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Loading Neonatal CDH Protocol records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Neonatal Congenital Diaphragmatic Hernia (CDH) &amp; Gentle Ventilation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AAP / EURO-CDH Protocol • Strict Avoidance of Bag-Mask • Lung-Protective Permissive Hypercapnia • Pre/Post-Ductal Gradient
          </p>
        </div>
        <div className="flex items-center gap-2">
          {episodes.length > 0 && (
            <select
              value={selectedEpisodeId || ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
              aria-label="Select CDH Episode"
              className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.defect_side.replace('_', ' ')}) - {ep.status}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            + New CDH Episode
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 text-sm">No CDH episodes recorded for this neonate.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 transition"
          >
            Initiate CDH Protocol
          </button>
        </div>
      ) : currentEpisode && evaluation ? (
        <div className="space-y-6">
          {/* Status & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Episode:
              </span>
              <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                {currentEpisode.episode_code}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                {evaluation.hypoplasiaSeverityLabel}
              </span>
              {evaluation.isLiverUp && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 animate-pulse">
                  Liver-Up ⚠️
                </span>
              )}
              {evaluation.hasSignificantPphnShunt && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                  Ductal Shunt: {evaluation.ductalGradientPercent}% Δ
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={currentEpisode.status}
                onChange={(e) => handleStatusChange(e.target.value as NeonatalCdhRecord['status'])}
                aria-label="Change CDH Protocol Status"
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              >
                <option value="preop_gentle_ventilation">Pre-op Gentle Ventilation</option>
                <option value="pulmonary_hypertension_crisis">PPHN Crisis &amp; iNO</option>
                <option value="in_operating_room_repair">In Operating Room Repair</option>
                <option value="postop_ventilatory_weaning">Post-op Ventilatory Weaning</option>
                <option value="recovering_extubated">Recovering / Extubated</option>
                <option value="resolved_discharged_home">Resolved / Discharged Home</option>
              </select>

              <button
                onClick={() => setShowEditModal(true)}
                className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                Edit Details
              </button>
              <a
                href={`/neonatal-cdh/${currentEpisode.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition"
              >
                Print Dossier 🖨
              </a>
            </div>
          </div>

          {/* Critical Alerts Banner */}
          {evaluation.alerts.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 p-4 rounded-r-xl space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <span>⚠️</span> Immediate CDH Protocol Directives
              </div>
              <ul className="list-disc pl-5 text-xs text-rose-900 dark:text-rose-200 space-y-0.5">
                {evaluation.alerts.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">o/e LHR %</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.observed_expected_lhr_percent}%
              </div>
              <div className="text-[10px] text-slate-400">{evaluation.hypoplasiaSeverityLabel}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Pre / Post-Ductal SpO2</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.preductal_spo2_percent}% / {currentEpisode.postductal_spo2_percent}%
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                Gradient: {evaluation.ductalGradientPercent}% Δ
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Ventilation (PIP / PEEP)</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.peak_inspiratory_pressure_cmh2o} / {currentEpisode.peep_cmh2o}{' '}
                <span className="text-xs font-normal">cmH2O</span>
              </div>
              <div
                className={`text-[10px] font-semibold ${
                  evaluation.isGentleVentilationCompliant
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {evaluation.isGentleVentilationCompliant ? 'Gentle Target Met (PIP < 25)' : 'High PIP Risk'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">PaCO2 &amp; Hypercapnia</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.paco2_mmhg} <span className="text-xs font-normal">mmHg</span>
              </div>
              <div
                className={`text-[10px] font-semibold ${
                  evaluation.isPermissiveHypercapniaAchieved
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                {evaluation.isPermissiveHypercapniaAchieved ? 'Permissive Range (50–70)' : 'Out of range'}
              </div>
            </div>
          </div>

          {/* Readiness Criteria Card */}
          <div
            className={`p-4 rounded-xl border ${
              evaluation.isPhysiologicallyReadyForSurgery
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider">
                Delayed Surgical Repair Readiness Check
              </div>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  evaluation.isPhysiologicallyReadyForSurgery
                    ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                    : 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                }`}
              >
                {evaluation.readinessCriteriaStatus}
              </span>
            </div>
            <div className="mt-2 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                Postductal SpO2 &gt;= 85%:{' '}
                <span className="font-bold">
                  {currentEpisode.postductal_spo2_percent >= 85 ? '✅ Met' : '❌ Unmet'}
                </span>
              </div>
              <div>
                PIP &lt; 25 cmH2O:{' '}
                <span className="font-bold">
                  {currentEpisode.peak_inspiratory_pressure_cmh2o < 25 ? '✅ Met' : '❌ High'}
                </span>
              </div>
              <div>
                Pre/Post Gradient &lt; 10%:{' '}
                <span className="font-bold">
                  {evaluation.ductalGradientPercent < 10 ? '✅ Met' : '❌ Shunt'}
                </span>
              </div>
              <div>
                Liver-Up Status:{' '}
                <span className="font-bold">{evaluation.isLiverUp ? 'Patch likely' : 'Primary suture'}</span>
              </div>
            </div>
          </div>

          {/* Clinical Directives Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🚪</span> Delivery Room Directives
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.deliveryRoomDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🌬️</span> Gentle Ventilation Rules
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.gentleVentilationDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🫀</span> PPHN &amp; Repair Directives
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.pulmonaryHypertensionDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {evaluation.surgicalRepairDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Flowsheet Log Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📊</span> CDH Serial Ventilatory &amp; Hemodynamic Flowsheet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track Pre/Post SpO2, PIP/PEEP, MAP, PaCO2, iNO ppm, and Sildenafil titration.
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                + Record Flowsheet Entry
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No serial flowsheet entries recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2">Hours / Time</th>
                      <th className="px-3 py-2">Pre / Post SpO2</th>
                      <th className="px-3 py-2">Gradient Δ</th>
                      <th className="px-3 py-2">PIP / PEEP</th>
                      <th className="px-3 py-2">FiO2 %</th>
                      <th className="px-3 py-2">MAP mmHg</th>
                      <th className="px-3 py-2">PaCO2 / pH</th>
                      <th className="px-3 py-2">iNO ppm</th>
                      <th className="px-3 py-2">Lactate</th>
                      <th className="px-3 py-2">Actions / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono text-[11px]">
                    {flowsheet.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-3 py-2 font-sans">
                          +{f.hours_from_admission}h ({new Date(f.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </td>
                        <td className="px-3 py-2">{f.preductal_spo2}% / {f.postductal_spo2}%</td>
                        <td className="px-3 py-2 font-bold text-indigo-600 dark:text-indigo-400">
                          {Math.max(0, f.preductal_spo2 - f.postductal_spo2)}%
                        </td>
                        <td className="px-3 py-2">{f.pip_cmh2o} / {f.peep_cmh2o}</td>
                        <td className="px-3 py-2">{f.fio2_percent}%</td>
                        <td className="px-3 py-2">{f.mean_arterial_pressure_mmhg ?? '—'}</td>
                        <td className="px-3 py-2">{f.paco2_mmhg} / {f.arterial_ph ?? '—'}</td>
                        <td className="px-3 py-2">{f.ino_ppm ? `${f.ino_ppm} ppm` : '0'}</td>
                        <td className="px-3 py-2">{f.lactate_mmol_l ? `${f.lactate_mmol_l}` : '—'}</td>
                        <td className="px-3 py-2 font-sans truncate max-w-xs">{f.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Modals */}
      {showCreateModal && (
        <NeonatalCdhModal
          patientId={patientId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newId) => {
            setShowCreateModal(false);
            if (newId) setSelectedEpisodeId(newId);
            loadEpisodes();
          }}
        />
      )}

      {showEditModal && currentEpisode && (
        <NeonatalCdhModal
          patientId={patientId}
          initialEpisode={currentEpisode}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadEpisodeDetails(currentEpisode.id);
            loadEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && currentEpisode && (
        <NeonatalCdhFlowsheetModal
          episodeId={currentEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => {
            setShowFlowsheetModal(false);
            loadEpisodeDetails(currentEpisode.id);
          }}
        />
      )}
    </div>
  );
};
