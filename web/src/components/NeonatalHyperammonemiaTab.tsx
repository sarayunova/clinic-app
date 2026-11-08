import React, { useState, useEffect } from 'react';
import {
  getNeonatalHyperammonemiaEpisodes,
  patchNeonatalHyperammonemiaStatus,
  deleteNeonatalHyperammonemiaEpisode,
  deleteNeonatalHyperammonemiaFlowsheet,
  getNeonatalHyperammonemiaEpisode,
  type NeonatalHyperammonemiaRecord,
  type NeonatalHyperammonemiaFlowsheetRecord,
} from '../api';
import { NeonatalHyperammonemiaModal } from './NeonatalHyperammonemiaModal';
import { NeonatalHyperammonemiaFlowsheetModal } from './NeonatalHyperammonemiaFlowsheetModal';
import { evaluateNeonatalHyperammonemia } from '../neonatalHyperammonemiaEngine';

interface Props {
  patientId: number;
}

export const NeonatalHyperammonemiaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalHyperammonemiaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalHyperammonemiaRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<NeonatalHyperammonemiaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<NeonatalHyperammonemiaRecord | null>(null);
  const [flowsheetModalOpen, setFlowsheetModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalHyperammonemiaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getNeonatalHyperammonemiaEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load neonatal hyperammonemia records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const selectEpisode = async (ep: NeonatalHyperammonemiaRecord) => {
    setSelectedEpisode(ep);
    try {
      const res = await getNeonatalHyperammonemiaEpisode(ep.id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch episode details');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      await patchNeonatalHyperammonemiaStatus(selectedEpisode.id, newStatus);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Delete this hyperammonemia crisis episode permanently?')) return;
    try {
      await deleteNeonatalHyperammonemiaEpisode(id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalHyperammonemiaFlowsheet(selectedEpisode.id, logId);
      const res = await getNeonatalHyperammonemiaEpisode(selectedEpisode.id);
      setFlowsheetLogs(res.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet entry');
    }
  };

  const evaluation = selectedEpisode
    ? evaluateNeonatalHyperammonemia({
        ageHours: selectedEpisode.age_hours,
        birthWeightGrams: selectedEpisode.birth_weight_grams,
        gestationalAgeWeeks: selectedEpisode.gestational_age_weeks,
        plasmaAmmoniaUmolL: selectedEpisode.plasma_ammonia_umol_l,
        bloodGasAcidBasePattern: selectedEpisode.blood_gas_acid_base_pattern,
        plasmaLactateMmolL: selectedEpisode.plasma_lactate_mmol_l,
        anionGapMeqL: selectedEpisode.anion_gap_meq_l,
        urineKetonesPresent: Boolean(selectedEpisode.urine_ketones_present),
        suspectedDisorderCategory: selectedEpisode.suspected_disorder_category,
        proteinIntakeHalted: Boolean(selectedEpisode.protein_intake_halted),
        highCalorieDextroseActive: Boolean(selectedEpisode.high_calorie_dextrose_active),
        girMgKgMin: selectedEpisode.gir_mg_kg_min,
        nitrogenScavengerAmmonulActive: Boolean(selectedEpisode.nitrogen_scavenger_ammonul_active),
        ivLArginineActive: Boolean(selectedEpisode.iv_l_arginine_active),
        ivLCarnitineActive: Boolean(selectedEpisode.iv_l_carnitine_active),
        crrtDialysisIndicated: Boolean(selectedEpisode.crrt_dialysis_indicated),
        crrtDialysisActive: Boolean(selectedEpisode.crrt_dialysis_active),
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-purple-50 border border-purple-200 p-4 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-purple-950 flex items-center gap-2">
            <span>Neonatal Inborn Errors of Metabolism (IEM) Hyperammonemia Protocol</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-200 text-purple-900">
              ACMG / SIMD
            </span>
          </h2>
          <p className="text-xs text-purple-800 mt-1">
            Ammonia toxicity surveillance, protein cessation, Ammonul scavengers, caloric hyperinfusion & emergency CRRT.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/neonatal-hyperammonemia/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-purple-300 text-purple-800 bg-white rounded-lg text-xs font-semibold hover:bg-purple-100 flex items-center gap-1"
            >
              <span>🖨️</span> Dossier
            </a>
          )}
          <button
            onClick={() => {
              setEditingEpisode(null);
              setModalOpen(true);
            }}
            className="px-3 py-1.5 bg-purple-700 text-white rounded-lg text-xs font-semibold hover:bg-purple-800 shadow-sm"
          >
            + New Hyperammonemia Protocol
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading hyperammonemia records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-xl bg-gray-50 text-gray-500 text-sm">
          No hyperammonemia episodes recorded for this newborn. Click "+ New Hyperammonemia Protocol" to begin.
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
                      ? 'bg-purple-50 border-purple-400 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-sm text-gray-900 block">{ep.episode_code}</span>
                      <span className="text-xs text-gray-500">{ep.onset_datetime.replace('T', ' ')}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-purple-100 text-purple-800">
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs flex gap-3 text-gray-600">
                    <span>NH3: <strong className={ep.plasma_ammonia_umol_l >= 250 ? 'text-red-600' : ''}>{ep.plasma_ammonia_umol_l} umol/L</strong></span>
                    <span>Age: <strong>{ep.age_hours}h</strong></span>
                    <span>GIR: <strong>{ep.gir_mg_kg_min}</strong></span>
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
                  evaluation.urgencyTier === 'emergency_crrt_dialysis_and_scavengers'
                    ? 'bg-red-50 border-red-300'
                    : evaluation.urgencyTier === 'urgent_medical_scavengers_caloric_suppression'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-emerald-50 border-emerald-300'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm uppercase tracking-wide">
                      {evaluation.urgencyTierLabel}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/90 shadow-xs">
                      {evaluation.ammoniaCrisisLabel}
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
                      <span className="text-gray-600 block">Ammonul Load:</span>
                      <span className="font-bold">{evaluation.ammonulLoadingDoseMg} mg</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">IV L-Arginine:</span>
                      <span className="font-bold">{evaluation.arginineLoadingDoseMg} mg</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">CRRT Dialysis:</span>
                      <span className="font-bold text-purple-900">{evaluation.isCrrtHemodialysisMandated ? 'MANDATED (CVVHD)' : 'Medical Therapy Active'}</span>
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
                      Age {selectedEpisode.age_hours}h • Birth Wt {selectedEpisode.birth_weight_grams}g • Suspected: {selectedEpisode.suspected_disorder_category.replace(/_/g, ' ')}
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
                    <option value="acute_hyperammonemic_crisis">Acute Hyperammonemic Crisis</option>
                    <option value="medical_scavenger_infusion">Medical Scavenger Infusion</option>
                    <option value="emergency_crrt_hemodialysis">Emergency CRRT Hemodialysis</option>
                    <option value="catabolism_reversal_stabilization">Catabolism Reversal Stabilization</option>
                    <option value="controlled_protein_reintroduction">Controlled Protein Reintroduction</option>
                    <option value="convalescent_metabolic_maintenance">Convalescent Metabolic Maintenance</option>
                    <option value="neonatal_demise">Neonatal Demise</option>
                  </select>
                </div>

                {/* Directives Lists */}
                {evaluation && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-purple-900 mb-2">Scavenger & Caloric Directives</h4>
                      <ul className="text-xs text-purple-950 space-y-1.5 list-disc list-inside">
                        {evaluation.caloricSuppressionDirectives.concat(evaluation.nitrogenScavengerDirectives).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-fuchsia-50/50 border border-fuchsia-100 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-fuchsia-900 mb-2">Dialysis & Diagnostic Notes</h4>
                      <ul className="text-xs text-fuchsia-950 space-y-1.5 list-disc list-inside">
                        {evaluation.dialysisDirectives.concat(evaluation.diagnosticDifferentiationNotes).map((d, i) => (
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
                    Serial Ammonia & Metabolic Flowsheet ({flowsheetLogs.length} logs)
                  </h4>
                  <button
                    onClick={() => setFlowsheetModalOpen(true)}
                    className="px-2.5 py-1 bg-purple-700 text-white rounded text-xs font-medium hover:bg-purple-800"
                  >
                    + Add Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">
                    No serial flowsheet entries logged yet. Record serial ammonia, blood gas & encephalopathy checkpoints.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="py-2 px-2">Time</th>
                          <th className="py-2 px-2">Hrs</th>
                          <th className="py-2 px-2">Ammonia</th>
                          <th className="py-2 px-2">pH / pCO2</th>
                          <th className="py-2 px-2">HCO3</th>
                          <th className="py-2 px-2">Glucose (GIR)</th>
                          <th className="py-2 px-2">Encephalopathy</th>
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
                            <td className="py-2 px-2 font-medium">{log.hours_from_crisis_onset}h</td>
                            <td className="py-2 px-2 font-bold text-purple-900">{log.plasma_ammonia_umol_l} umol/L</td>
                            <td className="py-2 px-2">{log.ph_value} / {log.pco2_mmhg}</td>
                            <td className="py-2 px-2">{log.bicarbonate_meq_l} mEq/L</td>
                            <td className="py-2 px-2 font-semibold">{log.glucose_mg_dl} mg/dL ({log.gir_mg_kg_min} GIR)</td>
                            <td className="py-2 px-2 text-xs font-medium text-gray-700">{log.encephalopathy_grade.replace(/_/g, ' ')}</td>
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
        <NeonatalHyperammonemiaModal
          patientId={patientId}
          initialEpisode={editingEpisode}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => loadData()}
        />
      )}

      {flowsheetModalOpen && selectedEpisode && (
        <NeonatalHyperammonemiaFlowsheetModal
          episodeId={selectedEpisode.id}
          isOpen={flowsheetModalOpen}
          onClose={() => setFlowsheetModalOpen(false)}
          onSuccess={async () => {
            const res = await getNeonatalHyperammonemiaEpisode(selectedEpisode.id);
            setFlowsheetLogs(res.flowsheet || []);
          }}
        />
      )}
    </div>
  );
};
