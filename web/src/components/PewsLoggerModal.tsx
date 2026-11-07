import React, { useState, useMemo } from 'react';
import { recordPewsObservation } from '../api';
import { calculatePews } from '../palsEngine';

interface PewsLoggerModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PewsLoggerModal: React.FC<PewsLoggerModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [observationDatetime, setObservationDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );

  const [behaviorScore, setBehaviorScore] = useState<number>(0);
  const [cardiovascularScore, setCardiovascularScore] = useState<number>(0);
  const [respiratoryScore, setRespiratoryScore] = useState<number>(0);
  const [persistentVomitingPostop, setPersistentVomitingPostop] = useState<boolean>(false);

  const [heartRateBpm, setHeartRateBpm] = useState<number>(110);
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState<number>(26);
  const [crtSeconds, setCrtSeconds] = useState<number>(2);
  const [spo2Percent, setSpo2Percent] = useState<number>(98);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number | ''>(37.0);
  const [fio2Percent, setFio2Percent] = useState<number>(21);
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pewsResult = useMemo(() => {
    return calculatePews({
      behaviorScore,
      cardiovascularScore,
      respiratoryScore,
      persistentVomitingPostOp: persistentVomitingPostop,
    });
  }, [behaviorScore, cardiovascularScore, respiratoryScore, persistentVomitingPostop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await recordPewsObservation({
        patientId,
        observationDatetime: new Date(observationDatetime).toISOString(),
        behaviorScore,
        cardiovascularScore,
        respiratoryScore,
        persistentVomitingPostop,
        heartRateBpm: Number(heartRateBpm),
        respiratoryRateBpm: Number(respiratoryRateBpm),
        crtSeconds: Number(crtSeconds),
        spo2Percent: Number(spo2Percent),
        temperatureCelsius: temperatureCelsius === '' ? null : Number(temperatureCelsius),
        fio2Percent: Number(fio2Percent),
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record PEWS assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-5 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧸</span>
              <h2 className="text-lg font-black tracking-wide uppercase">
                Pediatric Early Warning Score (PEWS) Assessment
              </h2>
            </div>
            <p className="text-xs text-blue-100 mt-1">
              Bedside Deterioration Scoring for <span className="font-bold underline">{patientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 text-2xl font-bold p-1 rounded transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Dynamic PEWS Result Banner */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-4 ${
          pewsResult.badgeColor === 'red'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : pewsResult.badgeColor === 'yellow'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-md ${
              pewsResult.badgeColor === 'red'
                ? 'bg-rose-600 animate-pulse'
                : pewsResult.badgeColor === 'yellow'
                ? 'bg-amber-500'
                : 'bg-emerald-600'
            }`}>
              {pewsResult.totalScore}
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider block">
                {pewsResult.riskLabel}
              </span>
              <span className="text-xs">
                {pewsResult.escalationRequired
                  ? 'Urgent Medical Escalation / MET Call Indicated'
                  : 'Standard Pediatric Ward Routine Monitoring'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-semibold text-gray-600 block">
              Behavior: {behaviorScore} &bull; CV: {cardiovascularScore} &bull; Resp: {respiratoryScore}
              {persistentVomitingPostop && ' &bull; Vomiting: +1'}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-800 text-xs font-semibold flex items-center gap-2">
              <span className="text-base">🚨</span> {error}
            </div>
          )}

          {/* Observation Date */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Observation Datetime *
            </label>
            <input
              type="datetime-local"
              value={observationDatetime}
              onChange={(e) => setObservationDatetime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* PEWS Domain 1: Behavior */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
            <label className="block text-xs font-black text-gray-800 uppercase tracking-wide">
              1. Behavior Domain (0 - 3 points) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { score: 0, label: '0: Playing / Appropriate' },
                { score: 1, label: '1: Sleeping / Easily aroused' },
                { score: 2, label: '2: Irritable / Difficult to console' },
                { score: 3, label: '3: Lethargic / Confused / Pain only' },
              ].map((opt) => (
                <button
                  key={opt.score}
                  type="button"
                  onClick={() => setBehaviorScore(opt.score)}
                  className={`p-2.5 rounded-lg text-xs font-bold border text-left transition-all ${
                    behaviorScore === opt.score
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* PEWS Domain 2: Cardiovascular */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
            <label className="block text-xs font-black text-gray-800 uppercase tracking-wide">
              2. Cardiovascular Domain (0 - 3 points) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { score: 0, label: '0: Pink, CRT 1-2 sec' },
                { score: 1, label: '1: Pale, CRT 3 sec' },
                { score: 2, label: '2: Grey / Cyanotic, CRT 4s or HR +20' },
                { score: 3, label: '3: Mottled, CRT ≥5s, Bradycardia/HR +30' },
              ].map((opt) => (
                <button
                  key={opt.score}
                  type="button"
                  onClick={() => setCardiovascularScore(opt.score)}
                  className={`p-2.5 rounded-lg text-xs font-bold border text-left transition-all ${
                    cardiovascularScore === opt.score
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* PEWS Domain 3: Respiratory */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
            <label className="block text-xs font-black text-gray-800 uppercase tracking-wide">
              3. Respiratory Domain (0 - 3 points) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { score: 0, label: '0: Normal RR, no retractions' },
                { score: 1, label: '1: RR >10 above norm / using accessory' },
                { score: 2, label: '2: RR >20 above norm / sternal retract' },
                { score: 3, label: '3: RR >50 above norm / grunting / cyanosis' },
              ].map((opt) => (
                <button
                  key={opt.score}
                  type="button"
                  onClick={() => setRespiratoryScore(opt.score)}
                  className={`p-2.5 rounded-lg text-xs font-bold border text-left transition-all ${
                    respiratoryScore === opt.score
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Post-op Persistent Vomiting Bonus Point */}
          <label className="flex items-center gap-2.5 p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={persistentVomitingPostop}
              onChange={(e) => setPersistentVomitingPostop(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <div>
              <span className="text-xs font-bold text-gray-800 block">
                Persistent Post-operative Vomiting (+1 PEWS Point)
              </span>
              <span className="text-[11px] text-gray-500">
                Patient has persistent vomiting following surgery within past 24 hours
              </span>
            </div>
          </label>

          {/* Physiological Vitals Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Heart Rate (bpm) *
              </label>
              <input
                type="number"
                min="30"
                max="250"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Resp Rate (bpm) *
              </label>
              <input
                type="number"
                min="8"
                max="100"
                value={respiratoryRateBpm}
                onChange={(e) => setRespiratoryRateBpm(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                CRT (sec) *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={crtSeconds}
                onChange={(e) => setCrtSeconds(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white font-bold"
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
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Temp (°C)
              </label>
              <input
                type="number"
                step="0.1"
                min="32"
                max="43"
                value={temperatureCelsius}
                onChange={(e) => setTemperatureCelsius(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                FiO₂ (%) *
              </label>
              <input
                type="number"
                min="21"
                max="100"
                value={fio2Percent}
                onChange={(e) => setFio2Percent(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white"
              />
            </div>
          </div>

          {/* Clinical Escalation Actions Recommendation */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs space-y-1">
            <span className="font-bold text-blue-900 uppercase block">
              PALS Clinical Escalation Guidance:
            </span>
            {pewsResult.clinicalActions.map((act, i) => (
              <div key={i} className="text-blue-800 flex items-center gap-1.5">
                <span>&bull;</span> {act}
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Bedside Nursing Notes / Interventions Given
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Suctioned ETA, high-flow nasal cannula placed at 4 L/min, attending physician notified."
              className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? 'Recording PEWS...' : 'Save PEWS Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
