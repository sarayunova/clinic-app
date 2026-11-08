import React, { useState, useEffect } from 'react';
import {
  getObstetricMassivePeEpisodes,
  patchObstetricMassivePeStatus,
  deleteObstetricMassivePeEpisode,
  deleteObstetricMassivePeFlowsheet,
  getObstetricMassivePeEpisode,
  type ObstetricMassivePeRecord,
  type ObstetricMassivePeFlowsheetRecord,
} from '../api';
import { ObstetricMassivePeModal } from './ObstetricMassivePeModal';
import { ObstetricMassivePeFlowsheetModal } from './ObstetricMassivePeFlowsheetModal';
import { evaluateObstetricMassivePe } from '../obstetricMassivePeEngine';

interface Props {
  patientId: number;
}

export const ObstetricMassivePeTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricMassivePeRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricMassivePeRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<ObstetricMassivePeFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<ObstetricMassivePeRecord | null>(null);
  const [flowsheetModalOpen, setFlowsheetModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricMassivePeEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getObstetricMassivePeEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load obstetric massive PE records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const selectEpisode = async (ep: ObstetricMassivePeRecord) => {
    setSelectedEpisode(ep);
    try {
      const res = await getObstetricMassivePeEpisode(ep.id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch episode details');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      await patchObstetricMassivePeStatus(selectedEpisode.id, newStatus);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Delete this massive PE episode permanently?')) return;
    try {
      await deleteObstetricMassivePeEpisode(id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteObstetricMassivePeFlowsheet(selectedEpisode.id, logId);
      const res = await getObstetricMassivePeEpisode(selectedEpisode.id);
      setFlowsheetLogs(res.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet entry');
    }
  };

  const evaluation = selectedEpisode
    ? evaluateObstetricMassivePe({
        gestationalAgeWeeks: selectedEpisode.gestational_age_weeks,
        clinicalSetting: selectedEpisode.clinical_setting,
        systolicBpMmhg: selectedEpisode.systolic_bp_mmhg,
        heartRateBpm: selectedEpisode.heart_rate_bpm,
        respiratoryRate: selectedEpisode.respiratory_rate,
        spo2Percent: selectedEpisode.spo2_percent,
        hemodynamicInstabilityShock: Boolean(selectedEpisode.hemodynamic_instability_shock),
        rvDysfunctionEchoConfirmed: Boolean(selectedEpisode.rv_dysfunction_echo_confirmed),
        cardiacBiomarkersElevated: Boolean(selectedEpisode.cardiac_biomarkers_elevated),
        peRiskStratification: selectedEpisode.pe_risk_stratification,
        thrombolyticTherapyAdministered: Boolean(selectedEpisode.thrombolytic_therapy_administered),
        thrombolyticAgentDose: selectedEpisode.thrombolytic_agent_dose as any,
        systemicUfhInfusionActive: Boolean(selectedEpisode.systemic_ufh_infusion_active),
        targetApttSeconds: selectedEpisode.target_aptt_seconds,
        catheterDirectedOrSurgicalEmbolectomy: Boolean(selectedEpisode.catheter_directed_or_surgical_embolectomy),
        inferiorVenaCavaFilterPlaced: Boolean(selectedEpisode.inferior_vena_cava_filter_placed),
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-rose-50 border border-rose-200 p-4 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-rose-950 flex items-center gap-2">
            <span>Obstetric Massive Pulmonary Embolism & Acute RV Failure Protocol</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-200 text-rose-900">
              RCOG 37b / ESC / AHA
            </span>
          </h2>
          <p className="text-xs text-rose-800 mt-1">
            Emergency hemodynamic shock resuscitation, Alteplase thrombolysis, therapeutic UFH aPTT titration & neuraxial safety.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/obstetric-massive-pe/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-rose-300 text-rose-800 bg-white rounded-lg text-xs font-semibold hover:bg-rose-100 flex items-center gap-1"
            >
              <span>🖨️</span> Dossier
            </a>
          )}
          <button
            onClick={() => {
              setEditingEpisode(null);
              setModalOpen(true);
            }}
            className="px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-semibold hover:bg-rose-800 shadow-sm"
          >
            + New Massive PE Protocol
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading obstetric PE records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-xl bg-gray-50 text-gray-500 text-sm">
          No obstetric massive PE protocols recorded for this patient. Click "+ New Massive PE Protocol" to begin.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Episode List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Recorded Episodes ({episodes.length})
            </h3>
            {episodes.map((ep) => {
              const isSelected = selectedEpisode?.id === ep.id;
              return (
                <div
                  key={ep.id}
                  onClick={() => selectEpisode(ep)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-rose-50 border-rose-400 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-sm text-gray-900 block">{ep.episode_code}</span>
                      <span className="text-xs text-gray-500">{ep.onset_datetime.replace('T', ' ')}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-rose-100 text-rose-800">
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs flex gap-3 text-gray-600">
                    <span>SBP: <strong className={ep.systolic_bp_mmhg < 90 ? 'text-red-600' : ''}>{ep.systolic_bp_mmhg} mmHg</strong></span>
                    <span>HR: <strong>{ep.heart_rate_bpm} bpm</strong></span>
                    <span>SpO2: <strong>{ep.spo2_percent}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Episode Detail View */}
          {selectedEpisode && (
            <div className="lg:col-span-2 space-y-5">
              {/* Clinical Stratification Banner */}
              {evaluation && (
                <div className={`p-4 rounded-xl border ${
                  evaluation.urgencyTier === 'emergency_massive_pe_thrombolysis'
                    ? 'bg-red-50 border-red-300'
                    : evaluation.urgencyTier === 'urgent_submassive_icu_ufh'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-emerald-50 border-emerald-300'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm uppercase tracking-wide">
                      {evaluation.urgencyTierLabel}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/90 shadow-xs">
                      {evaluation.thrombolysisIndicated ? 'Thrombolysis Active' : 'Anticoagulation Only'}
                    </span>
                  </div>

                  {evaluation.alerts.length > 0 && (
                    <div className="mt-2.5 space-y-1">
                      {evaluation.alerts.map((al, idx) => (
                        <div key={idx} className="text-xs font-semibold text-red-800 flex items-start gap-1.5">
                          <span>⚠️</span>
                          <span>{al}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600 block">Initial UFH Bolus:</span>
                      <span className="font-bold">{evaluation.initialUfhBolusUnits} units IV</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">UFH Infusion Rate:</span>
                      <span className="font-bold">{evaluation.initialUfhInfusionUnitsHr} units/hr</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">Target aPTT:</span>
                      <span className="font-bold">{selectedEpisode.target_aptt_seconds} seconds</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Episode Header & Status Bar */}
              <div className="bg-white border rounded-xl p-4 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Episode #{selectedEpisode.episode_code}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Gestation: {selectedEpisode.gestational_age_weeks} wks • Setting: {selectedEpisode.clinical_setting.replace(/_/g, ' ')} • Risk: {selectedEpisode.pe_risk_stratification.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingEpisode(selectedEpisode);
                        setModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs border rounded hover:bg-gray-50 font-medium"
                    >
                      Edit Episode
                    </button>
                    <button
                      onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                      className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-600">Update Status:</span>
                  <select
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="border rounded px-2.5 py-1 text-xs bg-gray-50 font-medium"
                  >
                    <option value="acute_massive_pe_resuscitation">Acute Massive PE Resuscitation</option>
                    <option value="thrombolytic_infusion_icu">Thrombolytic Infusion ICU</option>
                    <option value="therapeutic_heparin_titration">Therapeutic Heparin Titration</option>
                    <option value="catheter_embolectomy_surgical">Catheter / Surgical Embolectomy</option>
                    <option value="subacute_transition_lmwh">Subacute Transition to LMWH</option>
                    <option value="convalescent_anticoagulation_plan">Convalescent Anticoagulation Plan</option>
                    <option value="maternal_demise">Maternal Demise</option>
                  </select>
                </div>

                {/* Directives Lists */}
                {evaluation && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-rose-900 mb-2">Thrombolysis & Hemodynamics</h4>
                      <ul className="text-xs text-rose-950 space-y-1.5 list-disc list-inside">
                        {evaluation.thrombolysisDirectives.concat(evaluation.hemodynamicSupportDirectives).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-amber-900 mb-2">Anticoagulation & Neuraxial Safety</h4>
                      <ul className="text-xs text-amber-950 space-y-1.5 list-disc list-inside">
                        {evaluation.anticoagulationDirectives.concat(evaluation.neuraxialContraindicationDirectives).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Serial Flowsheet Logs */}
              <div className="bg-white border rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Serial Hemodynamics & aPTT Flowsheet ({flowsheetLogs.length} logs)
                  </h4>
                  <button
                    onClick={() => setFlowsheetModalOpen(true)}
                    className="px-2.5 py-1 bg-rose-700 text-white rounded text-xs font-medium hover:bg-rose-800"
                  >
                    + Add Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">
                    No serial flowsheet entries logged yet. Record hourly vitals & aPTT titration checkpoints.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="py-2 px-2">Time</th>
                          <th className="py-2 px-2">Hrs</th>
                          <th className="py-2 px-2">BP (mmHg)</th>
                          <th className="py-2 px-2">HR / SpO2</th>
                          <th className="py-2 px-2">aPTT (s)</th>
                          <th className="py-2 px-2">Heparin (U/h)</th>
                          <th className="py-2 px-2">Norepi (mcg/min)</th>
                          <th className="py-2 px-2">Bleeding</th>
                          <th className="py-2 px-2">Notes</th>
                          <th className="py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flowsheetLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50/80">
                            <td className="py-2 px-2 whitespace-nowrap text-gray-600">
                              {log.log_datetime.replace('T', ' ')}
                            </td>
                            <td className="py-2 px-2 font-medium">{log.hours_from_presentation}h</td>
                            <td className="py-2 px-2 font-bold text-rose-800">{log.systolic_bp_mmhg}/{log.diastolic_bp_mmhg}</td>
                            <td className="py-2 px-2">{log.heart_rate_bpm} / {log.spo2_percent}%</td>
                            <td className="py-2 px-2 font-bold text-teal-800">{log.aptt_seconds}s</td>
                            <td className="py-2 px-2">{log.heparin_infusion_rate_units_hr} U/h</td>
                            <td className="py-2 px-2">{log.vasopressor_norepinephrine_mcg_min}</td>
                            <td className="py-2 px-2">
                              {log.bleeding_complication_observed ? (
                                <span className="text-red-600 font-bold">YES</span>
                              ) : (
                                <span className="text-gray-400">None</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-gray-500 max-w-xs truncate">{log.notes || '-'}</td>
                            <td className="py-2 px-2 text-right">
                              <button
                                onClick={() => handleDeleteFlowsheet(log.id)}
                                className="text-gray-400 hover:text-red-600 font-bold"
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
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <ObstetricMassivePeModal
          patientId={patientId}
          initialEpisode={editingEpisode}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => loadData()}
        />
      )}

      {flowsheetModalOpen && selectedEpisode && (
        <ObstetricMassivePeFlowsheetModal
          episodeId={selectedEpisode.id}
          isOpen={flowsheetModalOpen}
          onClose={() => setFlowsheetModalOpen(false)}
          onSuccess={async () => {
            const res = await getObstetricMassivePeEpisode(selectedEpisode.id);
            setFlowsheetLogs(res.flowsheet || []);
          }}
        />
      )}
    </div>
  );
};
