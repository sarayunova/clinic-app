import React, { useState, useEffect, useCallback } from 'react';
import {
  getObstetricHypertensiveCrises,
  getObstetricHypertensiveCrisis,
  deleteObstetricHypertensiveCrisis,
  deleteObstetricHypertensiveDose,
  type ObstetricHypertensiveCrisisRecord,
  type ObstetricHypertensiveDoseRecord,
} from '../api';
import { ObstetricHypertensionModal } from './ObstetricHypertensionModal';
import { HypertensiveDoseModal } from './HypertensiveDoseModal';

interface ObstetricHypertensionTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricHypertensionTab: React.FC<ObstetricHypertensionTabProps> = ({
  patientId,
  patientName,
}) => {
  const [crises, setCrises] = useState<ObstetricHypertensiveCrisisRecord[]>([]);
  const [selectedCrisisId, setSelectedCrisisId] = useState<number | null>(null);
  const [currentCrisis, setCurrentCrisis] = useState<ObstetricHypertensiveCrisisRecord | null>(null);
  const [doseLogs, setDoseLogs] = useState<ObstetricHypertensiveDoseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCrisisModalOpen, setIsCrisisModalOpen] = useState<boolean>(false);
  const [isDoseModalOpen, setIsDoseModalOpen] = useState<boolean>(false);

  const fetchCrises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricHypertensiveCrises({ patientId });
      setCrises(res.crises);
      if (res.crises.length > 0) {
        const targetId = selectedCrisisId && res.crises.some((c) => c.id === selectedCrisisId)
          ? selectedCrisisId
          : res.crises[0]!.id;
        setSelectedCrisisId(targetId);
      } else {
        setSelectedCrisisId(null);
        setCurrentCrisis(null);
        setDoseLogs([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load obstetric hypertensive crisis records');
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedCrisisId]);

  const fetchCrisisDetails = useCallback(async (id: number) => {
    try {
      const res = await getObstetricHypertensiveCrisis(id);
      setCurrentCrisis(res.crisis);
      setDoseLogs(res.doseLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to load crisis details');
    }
  }, []);

  useEffect(() => {
    fetchCrises();
  }, [fetchCrises]);

  useEffect(() => {
    if (selectedCrisisId) {
      fetchCrisisDetails(selectedCrisisId);
    }
  }, [selectedCrisisId, fetchCrisisDetails]);

  const handleDeleteCrisis = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this hypertensive crisis record?')) return;
    try {
      await deleteObstetricHypertensiveCrisis(id);
      fetchCrises();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleDeleteDose = async (logId: number) => {
    if (!window.confirm('Delete this dose log?')) return;
    try {
      await deleteObstetricHypertensiveDose(logId);
      if (selectedCrisisId) fetchCrisisDetails(selectedCrisisId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete dose');
    }
  };

  const nextStepNumber =
    doseLogs.length > 0 && doseLogs[doseLogs.length - 1]
      ? doseLogs[doseLogs.length - 1]!.step_number + 1
      : 1;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-gradient-to-r from-red-600 via-rose-700 to-purple-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h2 className="text-2xl font-bold tracking-tight">
              Obstetric Hypertensive Crisis & PPCM Resuscitation
            </h2>
          </div>
          <p className="text-rose-100 text-sm mt-1 max-w-2xl">
            ACOG Practice Bulletin No. 222 emergent antihypertensive escalation algorithm, rapid-acting IV Labetalol / Hydralazine / Nifedipine protocols, and Peripartum Cardiomyopathy (PPCM) BOARD roadmap.
          </p>
        </div>

        <button
          onClick={() => setIsCrisisModalOpen(true)}
          className="px-5 py-2.5 bg-white text-rose-800 hover:bg-rose-50 font-bold rounded-xl shadow-md transition-all text-sm flex items-center gap-2"
        >
          <span>➕</span> New Hypertensive Crisis
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading && crises.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Loading hypertensive crisis records...</div>
      ) : crises.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500">
          <p className="text-base font-semibold">No severe hypertensive crisis recorded for this patient.</p>
          <p className="text-xs text-gray-400 mt-1">
            Initiate a crisis protocol if systolic BP &ge; 160 mmHg or diastolic BP &ge; 110 mmHg.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode List (Sidebar) */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Crisis Episodes</h3>
            <div className="space-y-2">
              {crises.map((c) => {
                const isSelected = c.id === selectedCrisisId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCrisisId(c.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-50 border-rose-400 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-gray-900">{c.crisis_code}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          c.status === 'active_crisis'
                            ? 'bg-red-100 text-red-800'
                            : c.status === 'controlled_surveillance'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600">
                      Initial: <span className="font-semibold text-rose-800">{c.initial_sbp}/{c.initial_dbp}</span>{' '}
                      ({c.initial_map} mmHg)
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {new Date(c.crisis_datetime).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crisis Detail View */}
          {currentCrisis && (
            <div className="lg:col-span-3 space-y-6">
              {/* Overview Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-100 gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-gray-900">{currentCrisis.crisis_code}</h3>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          currentCrisis.blood_pressure_controlled
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                      >
                        {currentCrisis.blood_pressure_controlled ? 'BP Controlled' : 'Active Severe Crisis'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Initiated: {new Date(currentCrisis.crisis_datetime).toLocaleString()} | Onset:{' '}
                      <span className="font-semibold capitalize">{currentCrisis.onset_phase}</span> | Gestation:{' '}
                      <span className="font-semibold">{currentCrisis.gestation_weeks ? `${currentCrisis.gestation_weeks}w` : 'Postpartum'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/patients/${patientId}/obstetric-hypertension/${currentCrisis.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span>🖨️</span> Dossier
                    </a>
                    <button
                      onClick={() => handleDeleteCrisis(currentCrisis.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Hemodynamic Profile Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100 text-xs">
                  <div>
                    <span className="text-gray-500 block">Initial Severe BP:</span>
                    <span className="font-bold text-rose-800 text-sm">
                      {currentCrisis.initial_sbp}/{currentCrisis.initial_dbp} ({currentCrisis.initial_map} MAP)
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Latest Post-Dose BP:</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {currentCrisis.final_sbp && currentCrisis.final_dbp
                        ? `${currentCrisis.final_sbp}/${currentCrisis.final_dbp} (${currentCrisis.final_map} MAP)`
                        : 'Awaiting 1st dose'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">First-Line Protocol:</span>
                    <span className="font-bold text-gray-800 text-sm uppercase">
                      {currentCrisis.first_line_agent}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">MgSO₄ Prophylaxis:</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {currentCrisis.mgso4_co_administered ? '✅ Active Zuspan' : 'Not co-administered'}
                    </span>
                  </div>
                </div>

                {/* Cumulative Doses & Safety Ceilings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-3.5 text-xs space-y-1">
                    <span className="font-bold text-rose-900 block uppercase tracking-wider text-[11px]">
                      Cumulative IV Labetalol
                    </span>
                    <div className="text-lg font-black text-rose-900">
                      {currentCrisis.cumulative_labetalol_mg} mg
                    </div>
                    <div className="text-[10px] text-gray-500">Max single escalation ceiling: 300 mg</div>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 text-xs space-y-1">
                    <span className="font-bold text-amber-900 block uppercase tracking-wider text-[11px]">
                      Cumulative IV Hydralazine
                    </span>
                    <div className="text-lg font-black text-amber-900">
                      {currentCrisis.cumulative_hydralazine_mg} mg
                    </div>
                    <div className="text-[10px] text-gray-500">Max cumulative ceiling: 20 mg</div>
                  </div>

                  <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3.5 text-xs space-y-1">
                    <span className="font-bold text-purple-900 block uppercase tracking-wider text-[11px]">
                      Cumulative Oral Nifedipine
                    </span>
                    <div className="text-lg font-black text-purple-900">
                      {currentCrisis.cumulative_nifedipine_mg} mg
                    </div>
                    <div className="text-[10px] text-gray-500">Max initial escalation: 50-60 mg</div>
                  </div>
                </div>

                {/* PPCM / BOARD Status if recorded */}
                {currentCrisis.ppcm_screen_positive ? (
                  <div className="bg-purple-100/70 border border-purple-300 rounded-xl p-4 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-purple-950 uppercase flex items-center gap-1.5">
                        <span>🫀</span> Peripartum Cardiomyopathy (PPCM) BOARD Protocol Active
                      </span>
                      <span className="font-bold text-purple-900">
                        LVEF: {currentCrisis.lvef_percent ? `${currentCrisis.lvef_percent}%` : 'Pending'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-purple-900 pt-1 border-t border-purple-200">
                      <div>Bromocriptine: {currentCrisis.board_bromocriptine_started ? '✅ Prescribed' : 'No'}</div>
                      <div>Anticoagulation: {currentCrisis.board_anticoagulation_started ? '✅ Active LMWH' : 'No'}</div>
                      <div>Diuretics: {currentCrisis.board_diuretics_started ? '✅ Furosemide' : 'No'}</div>
                      <div>NT-proBNP: {currentCrisis.nt_pro_bnp_pg_ml ? `${currentCrisis.nt_pro_bnp_pg_ml} pg/mL` : 'N/A'}</div>
                    </div>
                  </div>
                ) : null}

                {/* Dose Logs Chronology */}
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                        <span>💊</span> Sequential Dose Administration Flowsheet
                      </h4>
                      <p className="text-xs text-gray-500">
                        ACOG PB 222 time-critical escalation log with blood pressure response checks.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsDoseModalOpen(true)}
                      className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <span>➕</span> Log Antihypertensive Dose
                    </button>
                  </div>

                  {doseLogs.length === 0 ? (
                    <div className="py-6 text-center bg-gray-50 border border-gray-200 rounded-xl text-gray-400 text-xs">
                      No dose checkpoints logged yet. Click above to record the initial rapid-acting dose.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full text-xs text-left divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-gray-600 font-semibold">
                          <tr>
                            <th className="px-3 py-2">Step</th>
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Medication Administered</th>
                            <th className="px-3 py-2">Dose / Route</th>
                            <th className="px-3 py-2">BP (MAP)</th>
                            <th className="px-3 py-2">FHR (bpm)</th>
                            <th className="px-3 py-2">Symptoms</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {doseLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-bold text-gray-900">Step {log.step_number}</td>
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-2 font-semibold text-gray-900">{log.medication_administered}</td>
                              <td className="px-3 py-2 text-gray-700">
                                {log.dose_value} {log.dose_unit} ({log.route})
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-bold text-rose-800">{log.sbp}/{log.dbp}</span>{' '}
                                <span className="text-gray-500 text-[11px]">({log.map_mmhg} MAP)</span>
                              </td>
                              <td className="px-3 py-2 text-gray-700">{log.fetal_heart_rate ?? '-'}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{log.maternal_symptoms || '-'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteDose(log.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
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
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ObstetricHypertensionModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isCrisisModalOpen}
        onClose={() => setIsCrisisModalOpen(false)}
        onSuccess={(newCrisis) => {
          setSelectedCrisisId(newCrisis.id);
          fetchCrises();
        }}
      />

      {currentCrisis && (
        <HypertensiveDoseModal
          crisisId={currentCrisis.id}
          patientId={patientId}
          initialMap={currentCrisis.initial_map}
          agent={currentCrisis.first_line_agent}
          defaultStepNumber={nextStepNumber}
          cumulativeLabetalolMg={currentCrisis.cumulative_labetalol_mg}
          cumulativeHydralazineMg={currentCrisis.cumulative_hydralazine_mg}
          cumulativeNifedipineMg={currentCrisis.cumulative_nifedipine_mg}
          isOpen={isDoseModalOpen}
          onClose={() => setIsDoseModalOpen(false)}
          onSuccess={() => {
            fetchCrisisDetails(currentCrisis.id);
          }}
        />
      )}
    </div>
  );
};
