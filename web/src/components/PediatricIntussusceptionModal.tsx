import React, { useState, useEffect } from 'react';
import { createPediatricIntussusceptionEpisode, calculatePediatricIntussusception } from '../api';

interface PediatricIntussusceptionModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricIntussusceptionModal: React.FC<PediatricIntussusceptionModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [presentationDatetime, setPresentationDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(8);
  const [weightKg, setWeightKg] = useState(8.6);
  const [symptomDurationHours, setSymptomDurationHours] = useState(14.0);

  const [intermittentColickyPain, setIntermittentColickyPain] = useState(true);
  const [vomitingBilious, setVomitingBilious] = useState(true);
  const [redCurrantJellyStool, setRedCurrantJellyStool] = useState(true);
  const [palpableAbdominalMass, setPalpableAbdominalMass] = useState(true);
  const [lethargyAlteredSensorium, setLethargyAlteredSensorium] = useState(false);

  const [ultrasoundTargetSignDetected, setUltrasoundTargetSignDetected] = useState(true);
  const [ultrasoundOuterDiameterMm, setUltrasoundOuterDiameterMm] = useState<number | ''>(28.5);
  const [pseudokidneySignPresent, setPseudokidneySignPresent] = useState(true);
  const [pathologicLeadPointSuspected, setPathologicLeadPointSuspected] = useState(false);
  const [leadPointType, setLeadPointType] = useState<string>('none_idiopathic');
  const [peritonitisSignsPresent, setPeritonitisSignsPresent] = useState(false);
  const [pneumoperitoneumOnXray, setPneumoperitoneumOnXray] = useState(false);

  const [reductionAttempted, setReductionAttempted] = useState(true);
  const [reductionMethod, setReductionMethod] = useState<string>('pneumatic_air_enema');
  const [maximumPressureMmhg, setMaximumPressureMmhg] = useState(100.0);
  const [reductionAttemptsCount, setReductionAttemptsCount] = useState(2);
  const [reductionSuccessful, setReductionSuccessful] = useState(true);
  const [cecalIlealRefluxVisualized, setCecalIlealRefluxVisualized] = useState(true);
  const [surgicalExplorationRequired, setSurgicalExplorationRequired] = useState(false);
  const [surgicalFindings, setSurgicalFindings] = useState('');

  const [status, setStatus] = useState<string>('reduction_successful_observation');
  const [clinicalNotes, setClinicalNotes] = useState(
    '8-month-old infant presenting with classic triad: intermittent inconsolable colic, sausage-shaped right upper quadrant mass, and red currant jelly stool. Abdominal US demonstrated 28.5 mm target sign. Plain film negative for perforation. Air enema reduction performed under fluoroscopy: successful reduction achieved on second attempt at 100 mmHg with massive reflux into terminal ileum. Admitted for 24h observation.',
  );

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculatePediatricIntussusception({
      ageMonths: Number(ageMonths),
      weightKg: Number(weightKg),
      symptomDurationHours: Number(symptomDurationHours),
      intermittentColickyPain,
      vomitingBilious,
      redCurrantJellyStool,
      palpableAbdominalMass,
      lethargyAlteredSensorium,
      ultrasoundTargetSignDetected,
      ultrasoundOuterDiameterMm: ultrasoundOuterDiameterMm === '' ? undefined : Number(ultrasoundOuterDiameterMm),
      pseudokidneySignPresent,
      pathologicLeadPointSuspected,
      leadPointType,
      peritonitisSignsPresent,
      pneumoperitoneumOnXray,
      reductionAttempted,
      reductionMethod,
      maximumPressureMmhg: Number(maximumPressureMmhg),
      reductionAttemptsCount: Number(reductionAttemptsCount),
      reductionSuccessful,
      cecalIlealRefluxVisualized,
      surgicalExplorationRequired,
      surgicalFindings: surgicalFindings || undefined,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    ageMonths,
    weightKg,
    symptomDurationHours,
    intermittentColickyPain,
    vomitingBilious,
    redCurrantJellyStool,
    palpableAbdominalMass,
    lethargyAlteredSensorium,
    ultrasoundTargetSignDetected,
    ultrasoundOuterDiameterMm,
    pseudokidneySignPresent,
    pathologicLeadPointSuspected,
    leadPointType,
    peritonitisSignsPresent,
    pneumoperitoneumOnXray,
    reductionAttempted,
    reductionMethod,
    maximumPressureMmhg,
    reductionAttemptsCount,
    reductionSuccessful,
    cecalIlealRefluxVisualized,
    surgicalExplorationRequired,
    surgicalFindings,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createPediatricIntussusceptionEpisode({
        patientId,
        presentationDatetime,
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        symptomDurationHours: Number(symptomDurationHours),
        intermittentColickyPain,
        vomitingBilious,
        redCurrantJellyStool,
        palpableAbdominalMass,
        lethargyAlteredSensorium,
        ultrasoundTargetSignDetected,
        ultrasoundOuterDiameterMm: ultrasoundOuterDiameterMm === '' ? null : Number(ultrasoundOuterDiameterMm),
        pseudokidneySignPresent,
        pathologicLeadPointSuspected,
        leadPointType,
        peritonitisSignsPresent,
        pneumoperitoneumOnXray,
        reductionAttempted,
        reductionMethod,
        maximumPressureMmhg: Number(maximumPressureMmhg),
        reductionAttemptsCount: Number(reductionAttemptsCount),
        reductionSuccessful,
        cecalIlealRefluxVisualized,
        surgicalExplorationRequired,
        surgicalFindings: surgicalFindings || null,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record intussusception episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Pediatric Intussusception & Reduction Protocol
            </h2>
            <p className="text-sm text-gray-500">
              Patient: <span className="font-semibold text-gray-700">{patientName}</span> • Pneumatic & Hydrostatic Enema Safety
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {preview && (
          <div
            className={`p-4 rounded-xl border ${
              preview.contraindicationToEnemaReduction
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : preview.reductionSuccessful
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-base">
                {preview.intussusceptionDiagnosed ? 'ULTRASOUND CONFIRMED INTUSSUSCEPTION' : 'SUSPECTED INTUSSUSCEPTION'}
              </span>
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-white shadow-sm border">
                {preview.contraindicationToEnemaReduction
                  ? 'SURGICAL CONTRAINDICATION'
                  : `MAX LIMIT: ${preview.maximumPermissiblePressureMmhg} mmHg`}
              </span>
            </div>
            <p className="text-sm mt-1">{preview.summary}</p>
            {preview.criticalActionPlan?.length > 0 && (
              <div className="mt-2 text-xs space-y-1 bg-white/80 p-2.5 rounded-lg border">
                <span className="font-semibold block text-gray-800">Directives & Action Plan:</span>
                {preview.criticalActionPlan.map((act: string, idx: number) => (
                  <p key={idx} className="font-medium text-gray-700">• {act}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Presentation Time</label>
              <input
                type="datetime-local"
                value={presentationDatetime}
                onChange={(e) => setPresentationDatetime(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Age (Months)</label>
              <input
                type="number"
                value={ageMonths}
                onChange={(e) => setAgeMonths(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Symptom Duration (h)</label>
              <input
                type="number"
                step="0.5"
                value={symptomDurationHours}
                onChange={(e) => setSymptomDurationHours(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Clinical Signs & Symptoms (Classic Triad)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={intermittentColickyPain}
                  onChange={(e) => setIntermittentColickyPain(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Intermittent Colic
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={palpableAbdominalMass}
                  onChange={(e) => setPalpableAbdominalMass(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Palpable Sausage Mass
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={redCurrantJellyStool}
                  onChange={(e) => setRedCurrantJellyStool(e.target.checked)}
                  className="mr-2 h-4 w-4 text-rose-600 rounded"
                />
                Currant Jelly Stool
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={vomitingBilious}
                  onChange={(e) => setVomitingBilious(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Bilious Vomiting
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={lethargyAlteredSensorium}
                  onChange={(e) => setLethargyAlteredSensorium(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Severe Lethargy
              </label>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Ultrasound Findings & Peritonitis Auditing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center text-xs font-medium text-gray-700 mt-2">
                <input
                  type="checkbox"
                  checked={ultrasoundTargetSignDetected}
                  onChange={(e) => setUltrasoundTargetSignDetected(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Target / Donut Sign on US
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-700">Outer Diameter (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={ultrasoundOuterDiameterMm}
                  onChange={(e) => setUltrasoundOuterDiameterMm(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 28.5 mm"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Lead Point Suspected</label>
                <select
                  value={leadPointType}
                  onChange={(e) => setLeadPointType(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="none_idiopathic">None / Idiopathic</option>
                  <option value="meckels_diverticulum">Meckel's Diverticulum</option>
                  <option value="intestinal_duplication_cyst">Duplication Cyst</option>
                  <option value="polyp">Intestinal Polyp</option>
                  <option value="lymphoma_malignancy">Lymphoma / Malignancy</option>
                </select>
              </div>
            </div>

            <div className="flex gap-6 pt-2 border-t border-gray-200">
              <label className="flex items-center text-xs font-bold text-rose-700">
                <input
                  type="checkbox"
                  checked={peritonitisSignsPresent}
                  onChange={(e) => setPeritonitisSignsPresent(e.target.checked)}
                  className="mr-2 h-4 w-4 text-rose-600 rounded"
                />
                Peritonitis Signs (Rigidity / Rebound)
              </label>
              <label className="flex items-center text-xs font-bold text-rose-700">
                <input
                  type="checkbox"
                  checked={pneumoperitoneumOnXray}
                  onChange={(e) => setPneumoperitoneumOnXray(e.target.checked)}
                  className="mr-2 h-4 w-4 text-rose-600 rounded"
                />
                Pneumoperitoneum on X-Ray (Free Air)
              </label>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Enema Reduction Procedure
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Reduction Method</label>
                <select
                  value={reductionMethod}
                  onChange={(e) => setReductionMethod(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="pneumatic_air_enema">Pneumatic (Air) Enema</option>
                  <option value="hydrostatic_saline_enema">Hydrostatic (Saline) Enema</option>
                  <option value="none_primary_surgery">Primary Surgery (No Enema)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Max Pressure (mmHg)</label>
                <input
                  type="number"
                  value={maximumPressureMmhg}
                  onChange={(e) => setMaximumPressureMmhg(Number(e.target.value))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Attempts Count</label>
                <input
                  type="number"
                  value={reductionAttemptsCount}
                  onChange={(e) => setReductionAttemptsCount(Number(e.target.value))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={reductionSuccessful}
                  onChange={(e) => setReductionSuccessful(e.target.checked)}
                  className="mr-2 h-4 w-4 text-emerald-600 rounded"
                />
                Reduction Successful
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={cecalIlealRefluxVisualized}
                  onChange={(e) => setCecalIlealRefluxVisualized(e.target.checked)}
                  className="mr-2 h-4 w-4 text-emerald-600 rounded"
                />
                Terminal Ileal Reflux Visualized
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={surgicalExplorationRequired}
                  onChange={(e) => setSurgicalExplorationRequired(e.target.checked)}
                  className="mr-2 h-4 w-4 text-rose-600 rounded"
                />
                Surgical Exploration Required
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="evaluation_ultrasound">Evaluation / Ultrasound</option>
                <option value="reduction_in_progress">Reduction In Progress</option>
                <option value="reduction_successful_observation">Reduction Successful (Observation)</option>
                <option value="operating_room_exploration">Operating Room Exploration</option>
                <option value="resolved_discharged">Resolved & Discharged</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Clinical Notes</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Record Intussusception Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
