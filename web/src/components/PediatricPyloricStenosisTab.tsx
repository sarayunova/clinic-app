import React, { useState, useEffect } from 'react';
import {
  getPediatricPyloricStenosisEpisodes,
  getPediatricPyloricStenosisEpisode,
  updatePediatricPyloricStenosisStatus,
  deletePediatricPyloricStenosisFlowsheet,
  type PediatricPyloricStenosisRecord,
  type PediatricPyloricStenosisFlowsheetRecord,
} from '../api';
import { PediatricPyloricStenosisModal } from './PediatricPyloricStenosisModal';
import { PediatricPyloricStenosisFlowsheetModal } from './PediatricPyloricStenosisFlowsheetModal';
import { type PediatricPyloricStenosisResult } from '../pediatricPyloricStenosisEngine';

interface Props {
  patientId: number;
}

export const PediatricPyloricStenosisTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricPyloricStenosisRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricPyloricStenosisRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricPyloricStenosisResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricPyloricStenosisFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricPyloricStenosisEpisodes({ patientId });
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
      console.error('Error loading pyloric stenosis episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricPyloricStenosisEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err) {
      console.error('Error loading pyloric stenosis details:', err);
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
      await updatePediatricPyloricStenosisStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update pyloric stenosis status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deletePediatricPyloricStenosisFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Loading Pediatric Pyloric Stenosis records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Episode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🍼</span> Pediatric Infantile Hypertrophic Pyloric Stenosis (IHPS) Protocol
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            APSA / BAPS Guidelines (Ultrasound Criteria & Strict Pre-Op Metabolic Clearance)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {episodes.length > 0 && (
            <select
              value={selectedEpisodeId ?? ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.status.replace(/_/g, ' ')}) - {ep.presentation_datetime.slice(0, 10)}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-700"
          >
            + New IHPS Episode
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
            No active or historical IHPS protocols recorded for this infant.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
          >
            Initiate IHPS Resuscitation Protocol
          </button>
        </div>
      ) : currentEpisode && evaluation ? (
        <div className="space-y-6">
          {/* Status & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-bold text-slate-500">Status:</span>
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800">
                {currentEpisode.status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-500">
                Episode: <code className="font-mono">{currentEpisode.episode_code}</code>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('preop_fluid_resuscitation')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'preop_fluid_resuscitation'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Resuscitation
              </button>
              <button
                onClick={() => handleStatusChange('metabolically_cleared_for_or')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'metabolically_cleared_for_or'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                OR Cleared
              </button>
              <button
                onClick={() => handleStatusChange('surgery_in_progress')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'surgery_in_progress'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Surgery
              </button>
              <button
                onClick={() => handleStatusChange('postop_feeding_advancement')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'postop_feeding_advancement'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Post-Op Feeds
              </button>
              <button
                onClick={() => handleStatusChange('resolved_discharged')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'resolved_discharged'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Resolved
              </button>
              <a
                href={`/pediatric-pyloric-stenosis/${currentEpisode.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Print Dossier 🖨
              </a>
            </div>
          </div>

          {/* Clinical Metrics & Pre-Op Clearance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-semibold text-slate-500">Pyloric Ultrasound</span>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {currentEpisode.pyloric_muscle_thickness_mm ?? '-'} mm / {currentEpisode.pyloric_channel_length_mm ?? '-'} mm
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {evaluation.ultrasoundDiagnostic ? 'Diagnostic Target Sign ✓' : 'Sub-diagnostic'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-semibold text-slate-500">Serum Chloride (Cl-)</span>
              <p className={`text-2xl font-bold mt-1 ${currentEpisode.serum_chloride_meq_l >= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                {currentEpisode.serum_chloride_meq_l} mEq/L
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Target ≥100 mEq/L (Current: {evaluation.preOpClearance.chlorideAdequate ? 'Adequate ✓' : 'Low ⚠'})
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-semibold text-slate-500">Bicarbonate & pH</span>
              <p className={`text-2xl font-bold mt-1 ${currentEpisode.serum_bicarbonate_meq_l <= 28 ? 'text-emerald-600' : 'text-red-600'}`}>
                {currentEpisode.serum_bicarbonate_meq_l} mEq/L
              </p>
              <p className="text-xs text-slate-500 mt-1">
                pH: {currentEpisode.blood_ph} (Target HCO3 ≤28 mEq/L)
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${evaluation.preOpClearance.allClearedForOr ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' : 'bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-800'}`}>
              <span className={`text-xs uppercase font-semibold ${evaluation.preOpClearance.allClearedForOr ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                Surgical Clearance Status
              </span>
              <p className={`text-base font-bold mt-1 ${evaluation.preOpClearance.allClearedForOr ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>
                {evaluation.preOpClearance.allClearedForOr ? 'CLEARED FOR OR ✓' : 'NOT CLEARED'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                UOP: {currentEpisode.urine_output_ml_kg_hr} mL/kg/h • K: {currentEpisode.serum_potassium_meq_l} mEq/L
              </p>
            </div>
          </div>

          {/* Pre-Op Resuscitation Rules & Fluid Guidance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                Pre-Op Resuscitation Checklist
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                  <span>Chloride (Cl⁻ ≥ 100 mEq/L)</span>
                  <span className={`font-bold ${evaluation.preOpClearance.chlorideAdequate ? 'text-emerald-600' : 'text-red-600'}`}>
                    {evaluation.preOpClearance.chlorideAdequate ? '✓ Pass' : '✗ Failed'} ({currentEpisode.serum_chloride_meq_l})
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                  <span>Bicarbonate (HCO₃⁻ ≤ 28 mEq/L)</span>
                  <span className={`font-bold ${evaluation.preOpClearance.bicarbonateAdequate ? 'text-emerald-600' : 'text-red-600'}`}>
                    {evaluation.preOpClearance.bicarbonateAdequate ? '✓ Pass' : '✗ Failed'} ({currentEpisode.serum_bicarbonate_meq_l})
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                  <span>Potassium (K⁺ ≥ 3.5 mEq/L)</span>
                  <span className={`font-bold ${evaluation.preOpClearance.potassiumAdequate ? 'text-emerald-600' : 'text-red-600'}`}>
                    {evaluation.preOpClearance.potassiumAdequate ? '✓ Pass' : '✗ Failed'} ({currentEpisode.serum_potassium_meq_l})
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                  <span>Urine Output (UOP ≥ 1.0 mL/kg/h)</span>
                  <span className={`font-bold ${evaluation.preOpClearance.urineOutputAdequate ? 'text-emerald-600' : 'text-red-600'}`}>
                    {evaluation.preOpClearance.urineOutputAdequate ? '✓ Pass' : '✗ Failed'} ({currentEpisode.urine_output_ml_kg_hr})
                  </span>
                </div>
              </div>
              <div className="pt-2 text-xs border-t text-slate-600 dark:text-slate-400">
                <p><strong>Fluid Regimen:</strong> {evaluation.fluidGuidance}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                Clinical Recommendations & Alerts
              </h4>
              {evaluation.alerts.length > 0 && (
                <div className="space-y-1">
                  {evaluation.alerts.map((alt, idx) => (
                    <div key={idx} className="p-2 rounded bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-xs border border-red-200 dark:border-red-800 font-semibold">
                      ⚠ {alt}
                    </div>
                  ))}
                </div>
              )}
              <ul className="text-xs space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                {evaluation.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Serial Flowsheet Table */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Serial Metabolic Resuscitation Flowsheet Log
                </h4>
                <p className="text-xs text-slate-500">
                  Serial monitoring of Na, K, Cl, HCO3, pH, urine output, and fluid infusion
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-700"
              >
                + Log Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No checkpoints logged yet. Click "+ Log Checkpoint" to begin serial tracking.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2 border">Timestamp</th>
                      <th className="p-2 border text-center">Hours Post-Adm</th>
                      <th className="p-2 border text-center">Cl- (≥100)</th>
                      <th className="p-2 border text-center">HCO3- (≤28)</th>
                      <th className="p-2 border text-center">K+ (≥3.5)</th>
                      <th className="p-2 border text-center">pH</th>
                      <th className="p-2 border text-center">UOP (mL/kg/h)</th>
                      <th className="p-2 border text-center">IV Rate (mL/h)</th>
                      <th className="p-2 border">Staff</th>
                      <th className="p-2 border text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 border whitespace-nowrap">{log.log_datetime.replace('T', ' ')}</td>
                        <td className="p-2 border text-center font-bold">{log.hours_from_admission} hrs</td>
                        <td className={`p-2 border text-center font-bold ${log.serum_chloride_meq_l && log.serum_chloride_meq_l >= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {log.serum_chloride_meq_l ?? '-'}
                        </td>
                        <td className={`p-2 border text-center font-bold ${log.serum_bicarbonate_meq_l && log.serum_bicarbonate_meq_l <= 28 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {log.serum_bicarbonate_meq_l ?? '-'}
                        </td>
                        <td className={`p-2 border text-center font-bold ${log.serum_potassium_meq_l && log.serum_potassium_meq_l >= 3.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {log.serum_potassium_meq_l ?? '-'}
                        </td>
                        <td className="p-2 border text-center">{log.blood_ph ?? '-'}</td>
                        <td className={`p-2 border text-center font-bold ${log.urine_output_ml_kg_hr >= 1.0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {log.urine_output_ml_kg_hr}
                        </td>
                        <td className="p-2 border text-center font-semibold">{log.iv_fluid_rate_ml_hr} mL/h</td>
                        <td className="p-2 border">{log.logged_by_name ?? 'Staff'}</td>
                        <td className="p-2 border text-center">
                          <button
                            onClick={() => handleDeleteFlowsheet(log.id)}
                            className="text-red-500 hover:text-red-700 font-bold"
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
        </div>
      ) : null}

      {/* Modals */}
      <PediatricPyloricStenosisModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <PediatricPyloricStenosisFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
