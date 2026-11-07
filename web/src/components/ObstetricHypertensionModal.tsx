import React, { useState, useMemo } from 'react';
import { createObstetricHypertensiveCrisis, type ObstetricHypertensiveCrisisRecord } from '../api';
import {
  evaluateSevereHypertension,
  evaluatePpcmBoardCriteria,
  type SevereHypertensionScreenInput,
} from '../obstetricHypertensionEngine';

interface ObstetricHypertensionModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (crisis: ObstetricHypertensiveCrisisRecord) => void;
  defaultGestationWeeks?: number;
}

export const ObstetricHypertensionModal: React.FC<ObstetricHypertensionModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultGestationWeeks = 34.0,
}) => {
  const [crisisDatetime, setCrisisDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [gestationWeeks, setGestationWeeks] = useState<string>(String(defaultGestationWeeks));
  const [onsetPhase, setOnsetPhase] = useState<'antepartum' | 'intrapartum' | 'postpartum'>('antepartum');
  const [initialSbp, setInitialSbp] = useState<string>('165');
  const [initialDbp, setInitialDbp] = useState<string>('112');
  const [firstLineAgent, setFirstLineAgent] = useState<'labetalol' | 'hydralazine' | 'nifedipine'>('labetalol');
  const [asthmaHistory, setAsthmaHistory] = useState<boolean>(false);
  const [bradycardiaHistory, setBradycardiaHistory] = useState<boolean>(false);
  const [mgso4CoAdministered, setMgso4CoAdministered] = useState<boolean>(true);
  const [fetalHeartRateStatus, setFetalHeartRateStatus] = useState<'normal' | 'category_1' | 'category_2' | 'category_3' | 'postpartum_na'>('category_1');

  // PPCM & Biomarker screen
  const [ppcmScreenActive, setPpcmScreenActive] = useState<boolean>(false);
  const [lvefPercent, setLvefPercent] = useState<string>('');
  const [ntProBnpPgMl, setNtProBnpPgMl] = useState<string>('');
  const [troponinINgMl, setTroponinINgMl] = useState<string>('');
  const [dyspneaOrOrthopnea, setDyspneaOrOrthopnea] = useState<boolean>(false);
  const [pulmonaryCrackles, setPulmonaryCrackles] = useState<boolean>(false);
  const [peripheralEdema, setPeripheralEdema] = useState<boolean>(false);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live Calculations
  const calculations = useMemo(() => {
    const sbp = parseInt(initialSbp, 10) || 120;
    const dbp = parseInt(initialDbp, 10) || 80;

    const screenInput: SevereHypertensionScreenInput = {
      sbp,
      dbp,
      onsetPhase,
      asthmaHistory,
      bradycardiaHistory,
    };

    const screen = evaluateSevereHypertension(screenInput);

    let ppcm = null;
    if (ppcmScreenActive) {
      ppcm = evaluatePpcmBoardCriteria({
        lvefPercent: lvefPercent ? parseFloat(lvefPercent) : undefined,
        ntProBnpPgMl: ntProBnpPgMl ? parseFloat(ntProBnpPgMl) : undefined,
        troponinINgMl: troponinINgMl ? parseFloat(troponinINgMl) : undefined,
        dyspneaOrOrthopnea,
        pulmonaryCrackles,
        peripheralEdema,
        onsetWeeksPostpartumOrGestation: parseFloat(gestationWeeks) || 36,
        isPostpartum: onsetPhase === 'postpartum',
      });
    }

    return { screen, ppcm };
  }, [
    initialSbp,
    initialDbp,
    onsetPhase,
    asthmaHistory,
    bradycardiaHistory,
    ppcmScreenActive,
    lvefPercent,
    ntProBnpPgMl,
    troponinINgMl,
    dyspneaOrOrthopnea,
    pulmonaryCrackles,
    peripheralEdema,
    gestationWeeks,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await createObstetricHypertensiveCrisis({
        patientId,
        crisisDatetime,
        gestationWeeks: gestationWeeks ? parseFloat(gestationWeeks) : undefined,
        onsetPhase,
        initialSbp: parseInt(initialSbp, 10),
        initialDbp: parseInt(initialDbp, 10),
        firstLineAgent: calculations.screen.contraindicatedAgents.length > 0 ? 'hydralazine' : firstLineAgent,
        asthmaHistory,
        bradycardiaHistory,
        mgso4CoAdministered,
        fetalHeartRateStatus,
        ppcmScreenPositive: calculations.ppcm ? calculations.ppcm.isPpcmSuspected : false,
        lvefPercent: lvefPercent ? parseFloat(lvefPercent) : undefined,
        ntProBnpPgMl: ntProBnpPgMl ? parseFloat(ntProBnpPgMl) : undefined,
        troponinINgMl: troponinINgMl ? parseFloat(troponinINgMl) : undefined,
        boardBromocriptineStarted: calculations.ppcm ? calculations.ppcm.boardBromocriptineIndicated : false,
        boardOralHfRx: calculations.ppcm ? calculations.ppcm.boardOralHfTherapy : undefined,
        boardAnticoagulationStarted: calculations.ppcm ? calculations.ppcm.boardAnticoagulationIndicated : false,
        boardDiureticsStarted: calculations.ppcm ? calculations.ppcm.boardDiureticsIndicated : false,
        status: 'active_crisis',
        clinicalNotes: clinicalNotes || undefined,
      });

      onSuccess(res.crisis);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate hypertensive crisis protocol');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-700 to-purple-800 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>⚡</span> Acute Obstetric Hypertensive Crisis & PPCM Resuscitation
            </h2>
            <p className="text-rose-100 text-xs mt-0.5">
              ACOG Practice Bulletin No. 222 & ESC PPCM BOARD Protocol | Patient: {patientName} (ID: {patientId})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Blood Pressure & Clinical Timeline */}
          <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-rose-900 text-xs uppercase tracking-wider">
              1. Severe Hypertensive Crisis Identification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Onset Datetime</label>
                <input
                  type="datetime-local"
                  value={crisisDatetime}
                  onChange={(e) => setCrisisDatetime(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-2 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Onset Phase</label>
                <select
                  value={onsetPhase}
                  onChange={(e) => setOnsetPhase(e.target.value as any)}
                  className="w-full text-xs border rounded-lg px-2.5 py-2 bg-white"
                >
                  <option value="antepartum">Antepartum</option>
                  <option value="intrapartum">Intrapartum</option>
                  <option value="postpartum">Postpartum</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Gestation (Weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="44"
                  value={gestationWeeks}
                  onChange={(e) => setGestationWeeks(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-2 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fetal Heart Rate Status</label>
                <select
                  value={fetalHeartRateStatus}
                  onChange={(e) => setFetalHeartRateStatus(e.target.value as any)}
                  className="w-full text-xs border rounded-lg px-2.5 py-2 bg-white"
                >
                  <option value="normal">Normal / Reactive</option>
                  <option value="category_1">NICHD Category I</option>
                  <option value="category_2">NICHD Category II</option>
                  <option value="category_3">NICHD Category III (Urgent)</option>
                  <option value="postpartum_na">Postpartum (N/A)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-rose-200/60">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Confirmed Systolic BP (SBP mmHg)
                </label>
                <input
                  type="number"
                  min="80"
                  max="280"
                  value={initialSbp}
                  onChange={(e) => setInitialSbp(e.target.value)}
                  className="w-full text-sm font-bold border rounded-lg px-3 py-2 bg-white text-rose-900"
                  required
                />
                <span className="text-[11px] text-gray-500">Severe threshold: &ge; 160 mmHg</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Confirmed Diastolic BP (DBP mmHg)
                </label>
                <input
                  type="number"
                  min="40"
                  max="180"
                  value={initialDbp}
                  onChange={(e) => setInitialDbp(e.target.value)}
                  className="w-full text-sm font-bold border rounded-lg px-3 py-2 bg-white text-rose-900"
                  required
                />
                <span className="text-[11px] text-gray-500">Severe threshold: &ge; 110 mmHg</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Initial MAP (Calculated)</label>
                <div className="text-xl font-black text-rose-900 px-3 py-1.5 bg-white border rounded-lg">
                  {calculations.screen.mapMmhg} mmHg
                </div>
                <span className="text-[11px] text-gray-500">Target reduction: &le; 25% drop</span>
              </div>
            </div>
          </div>

          {/* Section 2: Contraindication Screening & First-Line Choice */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              2. Agent Safety Screening & Antihypertensive Selection
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-2.5 bg-white border rounded-lg text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={asthmaHistory}
                  onChange={(e) => setAsthmaHistory(e.target.checked)}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-gray-900 block">Asthma / Reactive Airway</span>
                  <span className="text-[10px] text-gray-500">Contraindicates IV Labetalol</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-white border rounded-lg text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={bradycardiaHistory}
                  onChange={(e) => setBradycardiaHistory(e.target.checked)}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-gray-900 block">Maternal Bradycardia (&lt;60 bpm)</span>
                  <span className="text-[10px] text-gray-500">Contraindicates IV Labetalol</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-white border rounded-lg text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={mgso4CoAdministered}
                  onChange={(e) => setMgso4CoAdministered(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="font-bold text-gray-900 block">MgSO₄ Zuspan Co-Admin</span>
                  <span className="text-[10px] text-gray-500">Eclampsia seizure prophylaxis</span>
                </div>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between p-3 bg-white border rounded-lg">
              <div>
                <span className="text-xs font-bold text-gray-800">Recommended First-Line Pharmacotherapy:</span>
                <div className="text-sm font-black text-rose-800 capitalize mt-0.5">
                  {calculations.screen.contraindicatedAgents.length > 0
                    ? 'IV Hydralazine (Labetalol Contraindicated)'
                    : `${firstLineAgent} (ACOG PB 222 First-Line)`}
                </div>
              </div>

              {calculations.screen.contraindicatedAgents.length === 0 && (
                <div className="flex gap-2">
                  {(['labetalol', 'hydralazine', 'nifedipine'] as const).map((agent) => (
                    <button
                      key={agent}
                      type="button"
                      onClick={() => setFirstLineAgent(agent)}
                      className={`px-3 py-1 text-xs rounded-lg font-bold capitalize transition-colors ${
                        firstLineAgent === agent
                          ? 'bg-rose-700 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {agent}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Peripartum Cardiomyopathy (PPCM) & BOARD Evaluation */}
          <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-purple-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span>🫀</span> 3. Peripartum Cardiomyopathy (PPCM) & Pulmonary Edema Screen
              </h3>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-900">
                <input
                  type="checkbox"
                  checked={ppcmScreenActive}
                  onChange={(e) => setPpcmScreenActive(e.target.checked)}
                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Enable PPCM / BOARD Evaluation</span>
              </label>
            </div>

            {ppcmScreenActive && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Echocardiography LVEF (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="10"
                      max="80"
                      value={lvefPercent}
                      onChange={(e) => setLvefPercent(e.target.value)}
                      placeholder="e.g. 38"
                      className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                    />
                    <span className="text-[10px] text-gray-500">&lt;45% meets criteria</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">NT-proBNP (pg/mL)</label>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      value={ntProBnpPgMl}
                      onChange={(e) => setNtProBnpPgMl(e.target.value)}
                      placeholder="e.g. 1450"
                      className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                    />
                    <span className="text-[10px] text-gray-500">&gt;1,000 flags HF</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Troponin-I (ng/mL)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={troponinINgMl}
                      onChange={(e) => setTroponinINgMl(e.target.value)}
                      placeholder="e.g. 0.08"
                      className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dyspneaOrOrthopnea}
                        onChange={(e) => setDyspneaOrOrthopnea(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>Dyspnea / Orthopnea</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pulmonaryCrackles}
                        onChange={(e) => setPulmonaryCrackles(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>Pulmonary Crackles</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={peripheralEdema}
                        onChange={(e) => setPeripheralEdema(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>Marked Leg Edema</span>
                    </label>
                  </div>
                </div>

                {calculations.ppcm && (
                  <div className="p-3 bg-purple-100/70 border border-purple-300 rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-purple-950 uppercase">
                        BOARD Protocol Roadmap ({calculations.ppcm.ppcmRiskTier.replace(/_/g, ' ')})
                      </span>
                      {calculations.ppcm.boardBromocriptineIndicated && (
                        <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 font-bold">
                          Bromocriptine Indicated
                        </span>
                      )}
                    </div>
                    <p className="text-purple-900">
                      <strong>Oral HF Rx:</strong> {calculations.ppcm.boardOralHfTherapy}
                    </p>
                    <div className="text-[11px] text-purple-800">
                      Anticoagulation:{' '}
                      {calculations.ppcm.boardAnticoagulationIndicated
                        ? 'Mandatory prophylactic/therapeutic LMWH'
                        : 'Routine'} | Diuretics: {calculations.ppcm.boardDiureticsIndicated ? 'IV Furosemide 20-40mg advised' : 'Not urgent'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Obstetrician Clinical Assessment</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Severe headache and blurred vision noted. IV access secured; first-line dose prepared."
              className="w-full text-xs border rounded-lg px-3 py-2"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-lg text-xs font-semibold shadow-md disabled:opacity-50"
            >
              {submitting ? 'Initiating...' : 'Activate Hypertensive Crisis Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
