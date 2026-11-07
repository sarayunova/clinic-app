import React, { useState, useMemo } from 'react';
import { logMgso4Flowsheet } from '../api';
import {
  evaluateMgso4Safety,
  getHypertensiveCrisisLadder,
  type PatellarReflexGrade,
} from '../mgso4Engine';

interface Mgso4HourlyFlowsheetModalProps {
  protocolId: number;
  patientName: string;
  nextHourNumber: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const Mgso4HourlyFlowsheetModal: React.FC<Mgso4HourlyFlowsheetModalProps> = ({
  protocolId,
  patientName,
  nextHourNumber,
  onClose,
  onSuccess,
}) => {
  const [hourNumber, setHourNumber] = useState<number>(nextHourNumber || 1);
  const [observationDatetime, setObservationDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [patellarReflex, setPatellarReflex] = useState<PatellarReflexGrade>('normal_2_plus');
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState<number>(18);
  const [urineOutputLastHourMl, setUrineOutputLastHourMl] = useState<number>(40);
  const [bloodPressureSys, setBloodPressureSys] = useState<number>(140);
  const [bloodPressureDia, setBloodPressureDia] = useState<number>(90);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(84);
  const [spo2Percent, setSpo2Percent] = useState<number>(98);
  const [serumMagnesiumMgDl, setSerumMagnesiumMgDl] = useState<number | ''>('');
  const [fetalHeartRateBpm, setFetalHeartRateBpm] = useState<number | ''>('');
  const [actionTaken, setActionTaken] = useState<string>('continue_maintenance');
  const [antihypertensiveGiven, setAntihypertensiveGiven] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Safety Evaluation
  const safetyEval = useMemo(() => {
    return evaluateMgso4Safety({
      patellarReflex,
      respiratoryRateBpm: Number(respiratoryRateBpm),
      urineOutputLastHourMl: Number(urineOutputLastHourMl),
      serumMagnesiumMgDl: serumMagnesiumMgDl === '' ? undefined : Number(serumMagnesiumMgDl),
    });
  }, [patellarReflex, respiratoryRateBpm, urineOutputLastHourMl, serumMagnesiumMgDl]);

  const isSevereHypertension = bloodPressureSys >= 160 || bloodPressureDia >= 110;
  const crisisSteps = useMemo(() => getHypertensiveCrisisLadder(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await logMgso4Flowsheet(protocolId, {
        observationDatetime: new Date(observationDatetime).toISOString(),
        hourNumber: Number(hourNumber),
        patellarReflex,
        respiratoryRateBpm: Number(respiratoryRateBpm),
        urineOutputLastHourMl: Number(urineOutputLastHourMl),
        bloodPressureSys: Number(bloodPressureSys),
        bloodPressureDia: Number(bloodPressureDia),
        heartRateBpm: Number(heartRateBpm),
        spo2Percent: Number(spo2Percent),
        serumMagnesiumMgDl: serumMagnesiumMgDl === '' ? null : Number(serumMagnesiumMgDl),
        fetalHeartRateBpm: fetalHeartRateBpm === '' ? null : Number(fetalHeartRateBpm),
        actionTaken,
        antihypertensiveGiven: antihypertensiveGiven || null,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record flowsheet entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 p-5 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏱️</span>
              <h2 className="text-lg font-black tracking-wide uppercase">
                MgSO₄ Bedside Hourly Flowsheet Check (Hour {hourNumber})
              </h2>
            </div>
            <p className="text-xs text-rose-100 mt-1">
              Patient: <span className="font-bold underline">{patientName}</span> &bull; Toxicity & Hemodynamic Monitoring
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-rose-200 text-2xl font-bold p-1 rounded transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-800 text-xs font-semibold flex items-center gap-2">
              <span className="text-base">🚨</span> {error}
            </div>
          )}

          {/* Dynamic Toxicity Warning Banner */}
          {safetyEval.toxicitySeverity === 'critical_antidote_indicated' && (
            <div className="p-4 bg-red-600 text-white rounded-xl shadow-lg animate-pulse space-y-2 border-2 border-red-800">
              <div className="flex items-center gap-2 font-black uppercase text-sm">
                <span>🚨</span> CRITICAL TOXICITY WARNING: IMMEDIATE INTERVENTION REQUIRED!
              </div>
              <p className="text-xs text-red-100">
                {safetyEval.reflexInterpretation} | {safetyEval.respiratoryInterpretation} | {safetyEval.renalOutputInterpretation}
              </p>
              <div className="bg-red-800/80 p-3 rounded-lg text-xs space-y-1">
                <span className="font-bold block uppercase">Protocol Mandate:</span>
                {safetyEval.recommendedActions.map((act, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span>&bull;</span> {act}
                  </div>
                ))}
              </div>
            </div>
          )}

          {safetyEval.toxicitySeverity === 'warning_hold_recheck' && (
            <div className="p-4 bg-amber-500 text-white rounded-xl shadow space-y-2 border border-amber-600">
              <div className="flex items-center gap-2 font-bold uppercase text-xs">
                <span>⚠️</span> Toxicity Warning Threshold Reached
              </div>
              <p className="text-xs text-amber-100">
                {safetyEval.reflexInterpretation} | {safetyEval.respiratoryInterpretation} | {safetyEval.renalOutputInterpretation}
              </p>
              <div className="bg-amber-600/80 p-2.5 rounded-lg text-xs space-y-1">
                {safetyEval.recommendedActions.map((act, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span>&bull;</span> {act}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time & Sequence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Observation Hour Number *
              </label>
              <input
                type="number"
                min="1"
                max="48"
                value={hourNumber}
                onChange={(e) => setHourNumber(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Observation Datetime *
              </label>
              <input
                type="datetime-local"
                value={observationDatetime}
                onChange={(e) => setObservationDatetime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* The Triad: Patellar Reflex, Respiratory Rate, Urine Output */}
          <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                <span>⚡</span> Mandatory Triad Safety Checks (NABH & ACOG Bundle)
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                safetyEval.isSafeToContinue
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {safetyEval.isSafeToContinue ? 'Safe to Continue Infusion' : 'UNSAFE: Hold/Antidote'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Patellar Reflex */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  1. Patellar Deep Tendon Reflex *
                </label>
                <select
                  value={patellarReflex}
                  onChange={(e) => setPatellarReflex(e.target.value as PatellarReflexGrade)}
                  className={`w-full border rounded-lg p-2 text-xs font-bold focus:outline-none ${
                    patellarReflex === 'absent_0'
                      ? 'border-red-500 bg-red-100 text-red-900 ring-2 ring-red-500'
                      : patellarReflex === 'sluggish_1_plus'
                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                      : 'border-gray-300 bg-white text-gray-800'
                  }`}
                >
                  <option value="normal_2_plus">Normal Knee Jerk (+2) [PASS]</option>
                  <option value="brisk_3_plus">Brisk (+3) [Hyperreflexia]</option>
                  <option value="hyperactive_clonus_4_plus">Hyperactive Clonus (+4)</option>
                  <option value="sluggish_1_plus">Sluggish / Depressed (+1) [CAUTION]</option>
                  <option value="absent_0">ABSENT KNEE JERK (0) [CRITICAL TOXICITY]</option>
                </select>
                <div className="text-[10px] text-gray-500 mt-1">Loss of reflex occurs at ~8-10 mg/dL</div>
              </div>

              {/* Respiratory Rate */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  2. Respiratory Rate (bpm) *
                </label>
                <input
                  type="number"
                  min="4"
                  max="60"
                  value={respiratoryRateBpm}
                  onChange={(e) => setRespiratoryRateBpm(Number(e.target.value))}
                  className={`w-full border rounded-lg p-2 text-xs font-bold focus:outline-none ${
                    respiratoryRateBpm < 12
                      ? 'border-red-500 bg-red-100 text-red-900 ring-2 ring-red-500'
                      : respiratoryRateBpm < 16
                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                      : 'border-gray-300 bg-white text-gray-800'
                  }`}
                />
                <div className="text-[10px] text-gray-500 mt-1">Safe threshold: &ge; 16 breaths/min</div>
              </div>

              {/* Urine Output */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  3. Urine Output Past Hour (mL) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={urineOutputLastHourMl}
                  onChange={(e) => setUrineOutputLastHourMl(Number(e.target.value))}
                  className={`w-full border rounded-lg p-2 text-xs font-bold focus:outline-none ${
                    urineOutputLastHourMl < 30
                      ? 'border-red-500 bg-red-100 text-red-900 ring-2 ring-red-500'
                      : 'border-gray-300 bg-white text-gray-800'
                  }`}
                />
                <div className="text-[10px] text-gray-500 mt-1">Safe threshold: &ge; 30 mL/hr</div>
              </div>
            </div>
          </div>

          {/* Vitals & Serum Mg */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                BP Systolic (mmHg) *
              </label>
              <input
                type="number"
                min="60"
                max="260"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(Number(e.target.value))}
                className={`w-full border rounded-md p-1.5 text-xs font-bold ${
                  bloodPressureSys >= 160 ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-300 bg-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                BP Diastolic (mmHg) *
              </label>
              <input
                type="number"
                min="30"
                max="160"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(Number(e.target.value))}
                className={`w-full border rounded-md p-1.5 text-xs font-bold ${
                  bloodPressureDia >= 110 ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-300 bg-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Heart Rate (bpm) *
              </label>
              <input
                type="number"
                min="30"
                max="220"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                SpO₂ (%) *
              </label>
              <input
                type="number"
                min="50"
                max="100"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Serum Mg (mg/dL)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="25"
                placeholder="4.8 - 8.4"
                value={serumMagnesiumMgDl}
                onChange={(e) => setSerumMagnesiumMgDl(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white"
              />
            </div>
          </div>

          {/* Fetal Heart Rate (if antepartum) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Fetal Heart Rate (bpm) (If antepartum)
              </label>
              <input
                type="number"
                min="60"
                max="220"
                placeholder="e.g. 144"
                value={fetalHeartRateBpm}
                onChange={(e) => setFetalHeartRateBpm(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Bedside Action Taken *
              </label>
              <select
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-rose-500"
              >
                <option value="continue_maintenance">Continue Maintenance Infusion (1 g/h)</option>
                <option value="withhold_dose">Withhold Infusion / IM Dose (Toxicity Warning)</option>
                <option value="trigger_antidote_calcium_gluconate">Administer 10% Calcium Gluconate 10 mL IV</option>
                <option value="administer_antihypertensive">Administer Acute Antihypertensive</option>
                <option value="protocol_completed">Protocol 24-Hour Course Completed</option>
              </select>
            </div>
          </div>

          {/* Hypertensive Crisis Ladder Alert if BP >= 160/110 */}
          {isSevereHypertension && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-red-900">
                <span className="flex items-center gap-1.5">
                  <span>🩸</span> SEVERE RANGE HYPERTENSION DETECTED ({bloodPressureSys}/{bloodPressureDia} mmHg)
                </span>
                <span className="text-[10px] bg-red-200 text-red-900 px-2 py-0.5 rounded">
                  Target BP: 140-150 / 90-100
                </span>
              </div>
              <p className="text-[11px] text-red-800">
                Treatment must be initiated within 30-60 minutes to prevent maternal intracranial hemorrhage:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-xs">
                {crisisSteps.map((step, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-red-200 shadow-xs">
                    <span className="font-bold text-red-700 block">{step.agent}</span>
                    <span className="text-[11px] text-gray-800 block">{step.doseRoute}</span>
                    <span className="text-[10px] text-gray-500 block mt-0.5">{step.administrationNotes}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Antihypertensive Co-administration */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Antihypertensive Bolus Given This Hour (Optional)
            </label>
            <input
              type="text"
              value={antihypertensiveGiven}
              onChange={(e) => setAntihypertensiveGiven(e.target.value)}
              placeholder="e.g. Labetalol 20 mg IV slow push at 14:15"
              className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Bedside Nursing Notes & Observations
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Patient conscious, alert, denies headache or visual spots. Clear lung bases bilaterally. IV cannula site clean."
              className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? 'Logging Entry...' : 'Save Hourly Flowsheet Check'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
