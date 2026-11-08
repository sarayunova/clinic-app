import React, { useState, useEffect } from 'react';
import { createObstetricCordProlapseEpisode, calculateObstetricCordProlapse } from '../api';

interface ObstetricCordProlapseModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricCordProlapseModal: React.FC<ObstetricCordProlapseModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [detectionDatetime, setDetectionDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [maternalAge, setMaternalAge] = useState<number | ''>(28);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(39.2);
  const [cervicalDilationCm, setCervicalDilationCm] = useState(4.0);
  const [membraneStatus, setMembraneStatus] = useState<string>('ruptured_spontaneous');
  const [fetalPresentation, setFetalPresentation] = useState<string>('cephalic_vertex');
  const [prolapseType, setProlapseType] = useState<string>('overt_cord_visible_or_in_vagina');
  const [cordPulsationPresent, setCordPulsationPresent] = useState(true);
  const [baselineFhrBpm, setBaselineFhrBpm] = useState(75);
  const [fhrDecelerationType, setFhrDecelerationType] = useState<string>('prolonged_bradycardia');

  const [manualElevationPerformed, setManualElevationPerformed] = useState(true);
  const [maternalPositioning, setMaternalPositioning] = useState<string>('knee_chest_genupectoral');
  const [bladderFillingPerformed, setBladderFillingPerformed] = useState(true);
  const [bladderSalineVolumeMl, setBladderSalineVolumeMl] = useState(500);
  const [tocolysisAdministered, setTocolysisAdministered] = useState(true);
  const [tocolysisAgent, setTocolysisAgent] = useState<string>('terbutaline_sc');
  const [cordManipulationAvoided, setCordManipulationAvoided] = useState(true);
  const [cordWrappedWarmSaline, setCordWrappedWarmSaline] = useState(true);

  const [deliveryMode, setDeliveryMode] = useState<string>('category_1_emergency_cesarean');
  const [decisionToDeliveryMinutes, setDecisionToDeliveryMinutes] = useState<number | ''>(18);
  const [apgar1min, setApgar1min] = useState<number | ''>(6);
  const [apgar5min, setApgar5min] = useState<number | ''>(9);
  const [umbilicalArterialPh, setUmbilicalArterialPh] = useState<number | ''>(7.24);

  const [status, setStatus] = useState<string>('emergent_decompression_active');
  const [clinicalNotes, setClinicalNotes] = useState(
    'Overt umbilical cord loop palpated in vagina following spontaneous rupture of membranes. Severe fetal bradycardia to 75 bpm. Manual digital elevation maintained immediately; patient placed in knee-chest position. 500 mL warm saline instilled into bladder and Terbutaline 0.25 mg SC given. Transferred to OR for Category-1 Cesarean.',
  );

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateObstetricCordProlapse({
      maternalAge: maternalAge === '' ? undefined : Number(maternalAge),
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      cervicalDilationCm: Number(cervicalDilationCm),
      membraneStatus,
      fetalPresentation,
      prolapseType,
      cordPulsationPresent,
      baselineFhrBpm: Number(baselineFhrBpm),
      fhrDecelerationType,
      manualElevationPerformed,
      maternalPositioning,
      bladderFillingPerformed,
      bladderSalineVolumeMl: Number(bladderSalineVolumeMl),
      tocolysisAdministered,
      tocolysisAgent,
      cordManipulationAvoided,
      cordWrappedWarmSaline,
      deliveryMode,
      decisionToDeliveryMinutes: decisionToDeliveryMinutes === '' ? undefined : Number(decisionToDeliveryMinutes),
      apgar1min: apgar1min === '' ? undefined : Number(apgar1min),
      apgar5min: apgar5min === '' ? undefined : Number(apgar5min),
      umbilicalArterialPh: umbilicalArterialPh === '' ? undefined : Number(umbilicalArterialPh),
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    maternalAge,
    gestationalAgeWeeks,
    cervicalDilationCm,
    membraneStatus,
    fetalPresentation,
    prolapseType,
    cordPulsationPresent,
    baselineFhrBpm,
    fhrDecelerationType,
    manualElevationPerformed,
    maternalPositioning,
    bladderFillingPerformed,
    bladderSalineVolumeMl,
    tocolysisAdministered,
    tocolysisAgent,
    cordManipulationAvoided,
    cordWrappedWarmSaline,
    deliveryMode,
    decisionToDeliveryMinutes,
    apgar1min,
    apgar5min,
    umbilicalArterialPh,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createObstetricCordProlapseEpisode({
        patientId,
        detectionDatetime,
        maternalAge: maternalAge === '' ? null : Number(maternalAge),
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        cervicalDilationCm: Number(cervicalDilationCm),
        membraneStatus,
        fetalPresentation,
        prolapseType,
        cordPulsationPresent,
        baselineFhrBpm: Number(baselineFhrBpm),
        fhrDecelerationType,
        manualElevationPerformed,
        maternalPositioning,
        bladderFillingPerformed,
        bladderSalineVolumeMl: Number(bladderSalineVolumeMl),
        tocolysisAdministered,
        tocolysisAgent,
        cordManipulationAvoided,
        cordWrappedWarmSaline,
        deliveryMode,
        decisionToDeliveryMinutes: decisionToDeliveryMinutes === '' ? null : Number(decisionToDeliveryMinutes),
        apgar1min: apgar1min === '' ? null : Number(apgar1min),
        apgar5min: apgar5min === '' ? null : Number(apgar5min),
        umbilicalArterialPh: umbilicalArterialPh === '' ? null : Number(umbilicalArterialPh),
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record cord prolapse emergency');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-red-900 flex items-center">
              <span className="mr-2">🚨</span> Obstetric Umbilical Cord Prolapse Decompression
            </h2>
            <p className="text-sm text-gray-500">
              Patient: <span className="font-semibold text-gray-700">{patientName}</span> • Category-1 Delivery Mandated
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
              preview.fetalHypoxiaRiskTier === 'critical_terminal_bradycardia'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-base">{preview.fetalHypoxiaRiskLabel}</span>
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-600 text-white shadow-sm">
                SCORE: {preview.decompressionQualityScore}/5 DECOMPRESSION
              </span>
            </div>
            <p className="text-sm mt-1">{preview.summary}</p>
            {preview.criticalActionPlan?.length > 0 && (
              <div className="mt-2 text-xs space-y-1 bg-white/80 p-2.5 rounded-lg border">
                <span className="font-semibold block text-gray-800">Time-Critical Directives:</span>
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
              <label className="block text-xs font-medium text-gray-700">Detection Datetime</label>
              <input
                type="datetime-local"
                value={detectionDatetime}
                onChange={(e) => setDetectionDatetime(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">GA (weeks)</label>
              <input
                type="number"
                step="0.1"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Cervical Dilation (cm)</label>
              <input
                type="number"
                step="0.5"
                value={cervicalDilationCm}
                onChange={(e) => setCervicalDilationCm(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Baseline FHR (bpm)</label>
              <input
                type="number"
                value={baselineFhrBpm}
                onChange={(e) => setBaselineFhrBpm(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-bold text-red-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Prolapse Type</label>
              <select
                value={prolapseType}
                onChange={(e) => setProlapseType(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="overt_cord_visible_or_in_vagina">Overt (Cord in Vagina / Introitus)</option>
                <option value="occult_cord_adjacent_to_head">Occult (Adjacent to Fetal Head)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Fetal Presentation</label>
              <select
                value={fetalPresentation}
                onChange={(e) => setFetalPresentation(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="cephalic_vertex">Cephalic / Vertex</option>
                <option value="breech_frank">Frank Breech</option>
                <option value="breech_complete_footling">Complete / Footling Breech</option>
                <option value="transverse_shoulder">Transverse Lie / Shoulder</option>
                <option value="compound">Compound Presentation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">FHR Deceleration Pattern</label>
              <select
                value={fhrDecelerationType}
                onChange={(e) => setFhrDecelerationType(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="prolonged_bradycardia">Prolonged Terminal Bradycardia</option>
                <option value="severe_variable_decelerations">Severe Variable Decelerations</option>
                <option value="normal_fhr_reassuring">Normal Reassuring FHR</option>
              </select>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-3">
            <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider">
              Emergency Decompression Maneuvers Checklist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Maternal Positioning</label>
                <select
                  value={maternalPositioning}
                  onChange={(e) => setMaternalPositioning(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="knee_chest_genupectoral">Knee-Chest (Genupectoral) Position [Optimal]</option>
                  <option value="exaggerated_trendelenburg">Exaggerated Trendelenburg Position</option>
                  <option value="left_lateral_with_pillow">Left Lateral Tilt with Elevated Hips</option>
                  <option value="supine_unfavorable">Supine (Unfavorable)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Tocolysis Agent</label>
                <select
                  value={tocolysisAgent}
                  onChange={(e) => setTocolysisAgent(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="terbutaline_sc">Terbutaline 0.25 mg SC</option>
                  <option value="salbutamol_iv">Salbutamol IV Infusion</option>
                  <option value="nitroglycerin_sublingual">Nitroglycerin Sublingual Spray</option>
                  <option value="none">None Given</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <label className="flex items-center text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={manualElevationPerformed}
                  onChange={(e) => setManualElevationPerformed(e.target.checked)}
                  className="mr-2 h-4 w-4 text-red-600 rounded"
                />
                Manual Vaginal Elevation Maintained
              </label>
              <label className="flex items-center text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={bladderFillingPerformed}
                  onChange={(e) => setBladderFillingPerformed(e.target.checked)}
                  className="mr-2 h-4 w-4 text-red-600 rounded"
                />
                Bladder Filling (500 mL) Active
              </label>
              <label className="flex items-center text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={cordManipulationAvoided}
                  onChange={(e) => setCordManipulationAvoided(e.target.checked)}
                  className="mr-2 h-4 w-4 text-emerald-600 rounded"
                />
                Avoided Cord Manipulation
              </label>
              <label className="flex items-center text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={cordWrappedWarmSaline}
                  onChange={(e) => setCordWrappedWarmSaline(e.target.checked)}
                  className="mr-2 h-4 w-4 text-emerald-600 rounded"
                />
                Wrapped in Warm Saline Gauze
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Delivery Mode</label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="category_1_emergency_cesarean">Category-1 Emergency Cesarean (Target &le; 30 min)</option>
                <option value="assisted_operative_vaginal_vacuum">Assisted Operative Vaginal (Vacuum)</option>
                <option value="assisted_operative_vaginal_forceps">Assisted Operative Vaginal (Forceps)</option>
                <option value="spontaneous_vaginal_imminent">Spontaneous Vaginal (Imminent at 10cm)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Decision-to-Delivery (min)</label>
              <input
                type="number"
                value={decisionToDeliveryMinutes}
                onChange={(e) => setDecisionToDeliveryMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Target <= 30 min"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Cord Blood pH</label>
              <input
                type="number"
                step="0.01"
                value={umbilicalArterialPh}
                onChange={(e) => setUmbilicalArterialPh(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 7.24"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
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
              className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow-md disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Record Cord Prolapse Resuscitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
