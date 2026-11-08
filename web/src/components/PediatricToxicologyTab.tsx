import React, { useState, useEffect } from 'react';
import {
  getPediatricToxicologyEpisodes,
  patchPediatricToxicologyStatus,
  deletePediatricToxicologyEpisode,
  deletePediatricToxicologyFlowsheet,
  getPediatricToxicologyEpisode,
  type PediatricToxicologyRecord,
  type PediatricToxicologyFlowsheetRecord,
} from '../api';
import { PediatricToxicologyModal } from './PediatricToxicologyModal';
import { PediatricToxicologyFlowsheetModal } from './PediatricToxicologyFlowsheetModal';
import { evaluatePediatricToxicology } from '../pediatricToxicologyEngine';

interface Props {
  patientId: number;
}

export const PediatricToxicologyTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricToxicologyRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricToxicologyRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricToxicologyFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<PediatricToxicologyRecord | null>(null);
  const [flowsheetModalOpen, setFlowsheetModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricToxicologyEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getPediatricToxicologyEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric toxicology records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const selectEpisode = async (ep: PediatricToxicologyRecord) => {
    setSelectedEpisode(ep);
    try {
      const res = await getPediatricToxicologyEpisode(ep.id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch episode details');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      await patchPediatricToxicologyStatus(selectedEpisode.id, newStatus);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Delete this toxic ingestion episode permanently?')) return;
    try {
      await deletePediatricToxicologyEpisode(id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deletePediatricToxicologyFlowsheet(selectedEpisode.id, logId);
      const res = await getPediatricToxicologyEpisode(selectedEpisode.id);
      setFlowsheetLogs(res.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet entry');
    }
  };

  const evaluation = selectedEpisode
    ? evaluatePediatricToxicology({
        ageYears: selectedEpisode.age_years,
        weightKg: selectedEpisode.weight_kg,
        substanceCategory: selectedEpisode.substance_category,
        ingestedDoseMgKg: selectedEpisode.ingested_dose_mg_kg,
        hoursPostIngestion: selectedEpisode.hours_post_ingestion,
        serumLevelValue: selectedEpisode.serum_level_value,
        rumackMatthewLineBreached: Boolean(selectedEpisode.rumack_matthew_line_breached),
        altUL: selectedEpisode.alt_u_l,
        astUL: selectedEpisode.ast_u_l,
        totalBilirubinMgDl: selectedEpisode.total_bilirubin_mg_dl,
        prothrombinTimeInr: selectedEpisode.prothrombin_time_inr,
        antidoteIndicated: Boolean(selectedEpisode.antidote_indicated),
        antidoteAdministered: selectedEpisode.antidote_administered,
        gastricDecontaminationContraindicated: Boolean(selectedEpisode.gastric_decontamination_contraindicated),
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50 border border-amber-200 p-4 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-amber-950 flex items-center gap-2">
            <span>Pediatric Acute Toxic Ingestion & Antidote Protocol</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-200 text-amber-900">
              AAP / ACMT / Rumack-Matthew
            </span>
          </h2>
          <p className="text-xs text-amber-800 mt-1">
            Acetaminophen nomogram, IV N-Acetylcysteine 3-bag protocol, Deferoxamine iron chelation, and toxidromes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/pediatric-toxicology/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-amber-300 text-amber-800 bg-white rounded-lg text-xs font-semibold hover:bg-amber-100 flex items-center gap-1"
            >
              <span>🖨️</span> Dossier
            </a>
          )}
          <button
            onClick={() => {
              setEditingEpisode(null);
              setModalOpen(true);
            }}
            className="px-3 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 shadow-sm"
          >
            + New Toxic Ingestion Protocol
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading toxicology records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-xl bg-gray-50 text-gray-500 text-sm">
          No toxic exposure episodes recorded for this patient. Click "+ New Toxic Ingestion Protocol" to begin.
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
                      ? 'bg-amber-50 border-amber-400 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-sm text-gray-900 block">{ep.episode_code}</span>
                      <span className="text-xs text-gray-500">{ep.ingestion_datetime.replace('T', ' ')}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-800">
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs flex gap-3 text-gray-600">
                    <span>Substance: <strong>{ep.substance_category.replace(/_/g, ' ')}</strong></span>
                    <span>Level: <strong>{ep.serum_level_value}</strong></span>
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
                  evaluation.urgencyTier === 'emergency_antidote_and_picu'
                    ? 'bg-red-50 border-red-300'
                    : evaluation.urgencyTier === 'urgent_inpatient_toxicology_monitoring'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-emerald-50 border-emerald-300'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm uppercase tracking-wide">
                      {evaluation.urgencyTierLabel}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/90 shadow-xs">
                      {evaluation.toxicityRiskLabel}
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
                      <span className="text-gray-600 block">Antidote Indication:</span>
                      <span className="font-bold">{evaluation.isAntidoteIndicated ? `YES (${evaluation.antidoteName})` : 'Supportive'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">Decontamination Safety:</span>
                      <span className="font-bold text-red-800">{evaluation.isDecontaminationStrictlyContraindicated ? 'CONTRAINDICATED' : 'Charcoal Safe if < 2h'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">Rumack-Matthew:</span>
                      <span className="font-bold">{evaluation.rumackMatthewNomogramBreached ? 'BREACHED (High Risk)' : 'Subtoxic Line'}</span>
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
                      Substance: {selectedEpisode.substance_category.replace(/_/g, ' ')} • Dose: {selectedEpisode.ingested_dose_mg_kg} mg/kg • {selectedEpisode.hours_post_ingestion}h post-ingestion
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
                    <option value="acute_poisoning_triage">Acute Poisoning Triage</option>
                    <option value="antidote_infusion_active">Antidote Infusion Active</option>
                    <option value="picu_organ_support_monitoring">PICU Organ Support Monitoring</option>
                    <option value="toxic_levels_clearing">Toxic Levels Clearing</option>
                    <option value="convalescent_hepatic_recovery">Convalescent Hepatic Recovery</option>
                    <option value="resolved_discharged_home">Resolved / Discharged Home</option>
                  </select>
                </div>

                {/* Directives Lists */}
                {evaluation && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-amber-900 mb-2">Antidote Dosing & Infusion Protocols</h4>
                      <ul className="text-xs text-amber-950 space-y-1.5 list-disc list-inside">
                        {evaluation.antidoteDosingDirectives.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-orange-900 mb-2">Decontamination & Organ Monitoring</h4>
                      <ul className="text-xs text-orange-950 space-y-1.5 list-disc list-inside">
                        {evaluation.decontaminationDirectives.concat(evaluation.organMonitoringDirectives).map((d, i) => (
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
                    Serial Toxicology & LFT Flowsheet ({flowsheetLogs.length} logs)
                  </h4>
                  <button
                    onClick={() => setFlowsheetModalOpen(true)}
                    className="px-2.5 py-1 bg-amber-700 text-white rounded text-xs font-medium hover:bg-amber-800"
                  >
                    + Add Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">
                    No serial flowsheet entries logged yet. Record serial vital signs, serum levels & liver enzymes.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="py-2 px-2">Time</th>
                          <th className="py-2 px-2">Hrs</th>
                          <th className="py-2 px-2">HR / BP</th>
                          <th className="py-2 px-2">ALT / AST</th>
                          <th className="py-2 px-2">Serum Level</th>
                          <th className="py-2 px-2">Vin-Rosé</th>
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
                            <td className="py-2 px-2 font-medium">{log.hours_from_ingestion}h</td>
                            <td className="py-2 px-2">{log.heart_rate_bpm} / {log.systolic_bp_mmhg}</td>
                            <td className="py-2 px-2 font-bold text-amber-900">{log.alt_u_l} / {log.ast_u_l} U/L</td>
                            <td className="py-2 px-2 font-bold">{log.toxin_serum_level}</td>
                            <td className="py-2 px-2">
                              {log.vin_rose_urine_observed ? (
                                <span className="text-amber-700 font-bold">YES</span>
                              ) : (
                                <span className="text-gray-400">-</span>
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
        <PediatricToxicologyModal
          patientId={patientId}
          initialEpisode={editingEpisode}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => loadData()}
        />
      )}

      {flowsheetModalOpen && selectedEpisode && (
        <PediatricToxicologyFlowsheetModal
          episodeId={selectedEpisode.id}
          isOpen={flowsheetModalOpen}
          onClose={() => setFlowsheetModalOpen(false)}
          onSuccess={async () => {
            const res = await getPediatricToxicologyEpisode(selectedEpisode.id);
            setFlowsheetLogs(res.flowsheet || []);
          }}
        />
      )}
    </div>
  );
};
