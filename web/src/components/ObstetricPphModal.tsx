import React, { useState, useEffect } from 'react';
import {
  createObstetricPphEpisode,
  calculateObstetricPph,
  type ObstetricPphRecord,
} from '../api';

interface Props {
  patientId: number;
  admissionId?: number | null;
  onClose: () => void;
  onSuccess: (ep: ObstetricPphRecord) => void;
}

export const ObstetricPphModal: React.FC<Props> = ({
  patientId,
  admissionId,
  onClose,
  onSuccess,
}) => {
  const [deliveryMode, setDeliveryMode] = useState<'vaginal' | 'cesarean'>('vaginal');
  const [pphRecognitionDatetime, setPphRecognitionDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationWeeks, setGestationWeeks] = useState<number | undefined>(39.0);
  const [drapeBloodVolumeMl, setDrapeBloodVolumeMl] = useState(650);
  const [swabSpongeWeightNetG, setSwabSpongeWeightNetG] = useState(150);
  const [initialSbp, setInitialSbp] = useState(90);
  const [initialDbp, setInitialDbp] = useState(55);
  const [initialHeartRate, setInitialHeartRate] = useState(115);
  const [etiology4t, setEtiology4t] = useState<'tone_atony' | 'trauma_laceration' | 'tissue_retained' | 'thrombin_coagulopathy'>('tone_atony');
  const [maternalHypertensionHistory, setMaternalHypertensionHistory] = useState(false);
  const [maternalAsthmaHistory, setMaternalAsthmaHistory] = useState(false);

  // E-MOTIVE initial checklist
  const [emotiveMassageDone, setEmotiveMassageDone] = useState(true);
  const [emotiveOxytocinGiven, setEmotiveOxytocinGiven] = useState(true);
  const [emotiveTxaGiven, setEmotiveTxaGiven] = useState(true);
  const [emotiveIvFluidsGiven, setEmotiveIvFluidsGiven] = useState(true);
  const [emotiveExamCompleted, setEmotiveExamCompleted] = useState(false);
  const [emotiveEscalationNeeded, setEmotiveEscalationNeeded] = useState(false);

  // Tamponade
  const [bakriBalloonPlaced, setBakriBalloonPlaced] = useState(false);
  const [bakriFillVolumeMl, setBakriFillVolumeMl] = useState(0);
  const [tamponadeTestResult, setTamponadeTestResult] = useState<'not_performed' | 'success_bleeding_stopped' | 'failure_ongoing_bleeding'>('not_performed');
  const [status, setStatus] = useState<'resuscitation_active' | 'tamponade_active' | 'stabilized' | 'surgical_escalation' | 'resolved'>('resuscitation_active');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    calculateObstetricPph({
      deliveryMode,
      drapeBloodVolumeMl,
      swabSpongeWeightNetG,
      sbp: initialSbp,
      dbp: initialDbp,
      heartRate: initialHeartRate,
      maternalHypertensionHistory,
      maternalAsthmaHistory,
    })
      .then((res) => {
        if (active) {
          setPreview(res.evalResult);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deliveryMode, drapeBloodVolumeMl, swabSpongeWeightNetG, initialSbp, initialDbp, initialHeartRate, maternalHypertensionHistory, maternalAsthmaHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await createObstetricPphEpisode({
        patientId,
        admissionId,
        deliveryMode,
        pphRecognitionDatetime,
        gestationWeeks,
        drapeBloodVolumeMl,
        swabSpongeWeightNetG,
        initialSbp,
        initialDbp,
        initialHeartRate,
        etiology4t,
        maternalHypertensionHistory,
        maternalAsthmaHistory,
        emotiveMassageDone,
        emotiveOxytocinGiven,
        emotiveTxaGiven,
        emotiveIvFluidsGiven,
        emotiveExamCompleted,
        emotiveEscalationNeeded,
        bakriBalloonPlaced,
        bakriFillVolumeMl: bakriBalloonPlaced ? bakriFillVolumeMl : 0,
        tamponadeTestResult: bakriBalloonPlaced ? tamponadeTestResult : 'not_performed',
        status,
        clinicalNotes,
      });
      onSuccess(res.episode);
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate PPH episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Obstetric Postpartum Hemorrhage & WHO E-MOTIVE Protocol
            </h2>
            <p className="text-xs text-gray-500">
              FIGO 2022 & WHO 2023 Guidelines: Early detection, gravimetric QBL & stepwise resuscitation
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Recognition Datetime
              </label>
              <input
                type="datetime-local"
                value={pphRecognitionDatetime}
                onChange={(e) => setPphRecognitionDatetime(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Delivery Mode
              </label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as any)}
                className="w-full text-sm border rounded px-2 py-1.5 font-medium"
              >
                <option value="vaginal">Vaginal Delivery (Threshold: 500 mL)</option>
                <option value="cesarean">Cesarean Section (Threshold: 1000 mL)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Gestation (Weeks)
              </label>
              <input
                type="number"
                step="0.1"
                value={gestationWeeks || ''}
                onChange={(e) => setGestationWeeks(parseFloat(e.target.value) || undefined)}
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
          </div>

          {/* Gravimetric QBL Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-red-50/70 p-3.5 rounded-lg border border-red-200">
            <div>
              <label className="block text-xs font-semibold text-red-950 mb-1">
                Calibrated Drape Volume (mL)
              </label>
              <input
                type="number"
                step="10"
                value={drapeBloodVolumeMl}
                onChange={(e) => setDrapeBloodVolumeMl(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-red-300 rounded px-2 py-1.5 font-bold text-red-950"
                required
              />
              <span className="text-[11px] text-red-800 mt-0.5 block">
                Visual drape reading at bedside
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-red-950 mb-1">
                Swab & Sponge Net Weight (grams = mL)
              </label>
              <input
                type="number"
                step="10"
                value={swabSpongeWeightNetG}
                onChange={(e) => setSwabSpongeWeightNetG(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-red-300 rounded px-2 py-1.5 font-bold text-red-950"
                required
              />
              <span className="text-[11px] text-red-800 mt-0.5 block">
                Total wet sponge weight minus dry sponge weight
              </span>
            </div>
          </div>

          {/* Hemodynamics & Shock Index */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Systolic BP (mmHg)
              </label>
              <input
                type="number"
                value={initialSbp}
                onChange={(e) => setInitialSbp(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Diastolic BP (mmHg)
              </label>
              <input
                type="number"
                value={initialDbp}
                onChange={(e) => setInitialDbp(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Heart Rate (bpm)
              </label>
              <input
                type="number"
                value={initialHeartRate}
                onChange={(e) => setInitialHeartRate(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5 font-bold text-red-700"
                required
              />
            </div>
          </div>

          {/* Live Preview of QBL & Shock Index */}
          {preview && (
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                preview.isPphConfirmed
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex justify-between items-center font-bold text-sm">
                <span>
                  Total QBL: {preview.cumulativeQblMl} mL ({preview.severityTier.toUpperCase()})
                </span>
                <span>
                  Shock Index: {preview.shockIndex}{' '}
                  <span className="text-xs font-normal">({preview.shockIndexInterpretation})</span>
                </span>
              </div>

              {preview.mtpActivationAdvised && (
                <div className="bg-red-600 text-white p-2 rounded font-black text-center tracking-wide uppercase">
                  CRITICAL: Massive Transfusion Protocol (MTP) & Senior OBGYN Activation Advised!
                </div>
              )}

              {/* Contraindicated Drug Warnings */}
              {preview.contraindicatedDrugs.length > 0 && (
                <div className="bg-red-100/80 border border-red-300 p-2.5 rounded text-red-900 font-semibold space-y-1">
                  <span className="uppercase text-[10px] tracking-wider block font-bold text-red-800">
                    Contraindicated Medications Warning:
                  </span>
                  {preview.contraindicatedDrugs.map((cd: string, i: number) => (
                    <div key={i}>• {cd}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Maternal Risk Factors & 4T Etiology */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border p-3 rounded-lg bg-gray-50">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Primary 4T Etiology
              </label>
              <select
                value={etiology4t}
                onChange={(e) => setEtiology4t(e.target.value as any)}
                className="w-full text-sm border rounded px-2 py-1.5 font-semibold"
              >
                <option value="tone_atony">Tone: Uterine Atony (70-80%)</option>
                <option value="trauma_laceration">Trauma: Cervical / Vaginal Laceration</option>
                <option value="tissue_retained">Tissue: Retained Placenta / Cotyledon</option>
                <option value="thrombin_coagulopathy">Thrombin: Coagulopathy / DIC</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maternalHypertensionHistory}
                  onChange={(e) => setMaternalHypertensionHistory(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Maternal Hypertension / Pre-eclampsia (Ergometrine Contraindicated)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maternalAsthmaHistory}
                  onChange={(e) => setMaternalAsthmaHistory(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Maternal Asthma / Bronchospasm (Carboprost Contraindicated)</span>
              </label>
            </div>
          </div>

          {/* WHO E-MOTIVE Bundle Checklist */}
          <div className="border border-blue-200 bg-blue-50/40 p-3.5 rounded-lg space-y-2">
            <span className="text-xs font-bold text-blue-950 uppercase tracking-wide block">
              WHO E-MOTIVE First-Response Bundle
            </span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={emotiveMassageDone}
                  onChange={(e) => setEmotiveMassageDone(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Uterine Massage</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={emotiveOxytocinGiven}
                  onChange={(e) => setEmotiveOxytocinGiven(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Oxytocin Infusion</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={emotiveTxaGiven}
                  onChange={(e) => setEmotiveTxaGiven(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>TXA 1g IV (&lt;3h)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={emotiveIvFluidsGiven}
                  onChange={(e) => setEmotiveIvFluidsGiven(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Rapid Warm IV Fluids</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={emotiveExamCompleted}
                  onChange={(e) => setEmotiveExamCompleted(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Genital Exam (Trauma/Tissue)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={emotiveEscalationNeeded}
                  onChange={(e) => setEmotiveEscalationNeeded(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Escalation Triggered</span>
              </label>
            </div>
          </div>

          {/* Bakri Balloon Tamponade Section */}
          <div className="border border-amber-200 bg-amber-50/40 p-3 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Bakri Intrauterine Balloon Tamponade
              </span>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bakriBalloonPlaced}
                  onChange={(e) => setBakriBalloonPlaced(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Bakri Balloon Placed</span>
              </label>
            </div>

            {bakriBalloonPlaced && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fill Volume (mL sterile saline)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={bakriFillVolumeMl}
                    onChange={(e) => setBakriFillVolumeMl(parseFloat(e.target.value) || 0)}
                    placeholder="300-500 mL"
                    className="w-full text-sm border rounded px-2 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tamponade Test
                  </label>
                  <select
                    value={tamponadeTestResult}
                    onChange={(e) => setTamponadeTestResult(e.target.value as any)}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    <option value="not_performed">Not performed / Waiting</option>
                    <option value="success_bleeding_stopped">Positive (Bleeding stopped / controlled)</option>
                    <option value="failure_ongoing_bleeding">Negative (Bleeding continues through/around)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Clinical Notes & Orders
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Atony unresponsive to oxytocin. Ergometrine contraindicated due to pre-eclampsia. TXA 1g given, Misoprostol 800mcg rectal placed."
              className="w-full text-sm border rounded px-2 py-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Initiating...' : 'Initiate PPH Resuscitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
