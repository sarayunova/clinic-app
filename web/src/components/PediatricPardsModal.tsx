import React, { useState, useEffect } from 'react';
import {
  createPediatricPardsEpisode,
  calculatePediatricPards,
  type PediatricPardsRecord,
} from '../api';

interface Props {
  patientId: number;
  admissionId?: number | null;
  onClose: () => void;
  onSuccess: (ep: PediatricPardsRecord) => void;
}

export const PediatricPardsModal: React.FC<Props> = ({
  patientId,
  admissionId,
  onClose,
  onSuccess,
}) => {
  const [diagnosisDatetime, setDiagnosisDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(36);
  const [weightKg, setWeightKg] = useState(14.0);
  const [predictedBodyWeightKg, setPredictedBodyWeightKg] = useState<number | undefined>(14.0);
  const [triggerCause, setTriggerCause] = useState<'pneumonia' | 'aspiration' | 'sepsis_shock' | 'trauma' | 'drowning' | 'other'>('pneumonia');
  const [ventilationMode, setVentilationMode] = useState<'invasive_mechanical' | 'non_invasive_cpap_bipap' | 'high_frequency_oscillation'>('invasive_mechanical');
  const [currentPeepCmh2o, setCurrentPeepCmh2o] = useState(8.0);
  const [currentMapCmh2o, setCurrentMapCmh2o] = useState(14.0);
  const [currentFio2Percent, setCurrentFio2Percent] = useState(60.0);
  const [pao2Mmhg, setPao2Mmhg] = useState<number | undefined>(75.0);
  const [spo2Percent, setSpo2Percent] = useState(91.0);
  const [plateauPressureCmh2o, setPlateauPressureCmh2o] = useState<number | undefined>(22.0);
  const [plateauPressureLimitCmh2o, setPlateauPressureLimitCmh2o] = useState(28.0);
  const [drivingPressureLimitCmh2o, setDrivingPressureLimitCmh2o] = useState(15.0);
  const [pronePositioningActive, setPronePositioningActive] = useState(false);
  const [neuromuscularBlockadeActive, setNeuromuscularBlockadeActive] = useState(false);
  const [status, setStatus] = useState<'acute_management' | 'stabilized_weaning' | 'extubated' | 'picu_stepdown' | 'resolved'>('acute_management');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    calculatePediatricPards({
      ageMonths,
      weightKg,
      predictedBodyWeightKg,
      ventilationMode,
      mapCmh2o: currentMapCmh2o,
      peepCmh2o: currentPeepCmh2o,
      plateauPressureCmh2o,
      fio2Percent: currentFio2Percent,
      pao2Mmhg,
      spo2Percent,
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
  }, [ageMonths, weightKg, predictedBodyWeightKg, ventilationMode, currentMapCmh2o, currentPeepCmh2o, plateauPressureCmh2o, currentFio2Percent, pao2Mmhg, spo2Percent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await createPediatricPardsEpisode({
        patientId,
        admissionId,
        diagnosisDatetime,
        ageMonths,
        weightKg,
        predictedBodyWeightKg,
        triggerCause,
        ventilationMode,
        currentPeepCmh2o,
        currentMapCmh2o,
        currentFio2Percent,
        pao2Mmhg: pao2Mmhg ?? null,
        spo2Percent,
        plateauPressureLimitCmh2o,
        drivingPressureLimitCmh2o,
        pronePositioningActive,
        neuromuscularBlockadeActive,
        status,
        clinicalNotes,
      });
      onSuccess(res.episode);
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate PARDS episode');
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
              Pediatric ARDS (PARDS) & PALICC-2 Ventilation Protocol
            </h2>
            <p className="text-xs text-gray-500">
              PALICC-2 Guidelines: Oxygenation Index (OI/OSI), lung-protective mechanics & permissive hypercapnia
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Diagnosis Datetime
              </label>
              <input
                type="datetime-local"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Age (Months)
              </label>
              <input
                type="number"
                value={ageMonths}
                onChange={(e) => setAgeMonths(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Actual Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Predicted Body Wt (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={predictedBodyWeightKg || ''}
                onChange={(e) => setPredictedBodyWeightKg(parseFloat(e.target.value) || undefined)}
                placeholder="For Vt calculation"
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                PARDS Trigger Etiology
              </label>
              <select
                value={triggerCause}
                onChange={(e) => setTriggerCause(e.target.value as any)}
                className="w-full text-sm border rounded px-2 py-1.5 font-medium"
              >
                <option value="pneumonia">Pneumonia / Lower Respiratory Tract Infection</option>
                <option value="aspiration">Gastric Aspiration / Foreign Body</option>
                <option value="sepsis_shock">Septic Shock / Systemic Sepsis</option>
                <option value="trauma">Non-Thoracic / Thoracic Trauma</option>
                <option value="drowning">Near Drowning / Submersion</option>
                <option value="other">Other Inflammatory Trigger</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Ventilation Mode
              </label>
              <select
                value={ventilationMode}
                onChange={(e) => setVentilationMode(e.target.value as any)}
                className="w-full text-sm border rounded px-2 py-1.5 font-semibold"
              >
                <option value="invasive_mechanical">Invasive Mechanical Ventilation (Endotracheal Tube)</option>
                <option value="non_invasive_cpap_bipap">Non-Invasive CPAP / BiPAP (Mask / Helmet)</option>
                <option value="high_frequency_oscillation">High-Frequency Oscillatory Ventilation (HFOV)</option>
              </select>
            </div>
          </div>

          {/* Blood Gas & Airway Pressures */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 bg-blue-50/60 p-3 rounded-lg border border-blue-200">
            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1">
                MAP (cmH2O)
              </label>
              <input
                type="number"
                step="0.5"
                value={currentMapCmh2o}
                onChange={(e) => setCurrentMapCmh2o(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-blue-300 rounded px-2 py-1 font-bold text-blue-950"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1">
                PEEP (cmH2O)
              </label>
              <input
                type="number"
                step="0.5"
                value={currentPeepCmh2o}
                onChange={(e) => setCurrentPeepCmh2o(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-blue-300 rounded px-2 py-1 font-bold text-blue-950"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1">
                FiO2 (%)
              </label>
              <input
                type="number"
                step="1"
                value={currentFio2Percent}
                onChange={(e) => setCurrentFio2Percent(parseFloat(e.target.value) || 21)}
                className="w-full text-sm border border-blue-300 rounded px-2 py-1 font-bold text-blue-950"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                PaO2 (mmHg)
              </label>
              <input
                type="number"
                step="1"
                value={pao2Mmhg || ''}
                onChange={(e) => setPao2Mmhg(parseFloat(e.target.value) || undefined)}
                placeholder="Arterial ABG"
                className="w-full text-sm border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                SpO2 (%)
              </label>
              <input
                type="number"
                step="1"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(parseFloat(e.target.value) || 95)}
                className="w-full text-sm border rounded px-2 py-1 font-bold"
                required
              />
            </div>
          </div>

          {/* Plateau & Driving Pressure */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Measured Pplat (cmH2O)
              </label>
              <input
                type="number"
                step="0.5"
                value={plateauPressureCmh2o || ''}
                onChange={(e) => setPlateauPressureCmh2o(parseFloat(e.target.value) || undefined)}
                placeholder="Plateau Pressure"
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Plateau Limit (&le; 28 cmH2O)
              </label>
              <input
                type="number"
                step="0.5"
                value={plateauPressureLimitCmh2o}
                onChange={(e) => setPlateauPressureLimitCmh2o(parseFloat(e.target.value) || 28)}
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Driving Pressure Limit (&lt; 15 cmH2O)
              </label>
              <input
                type="number"
                step="0.5"
                value={drivingPressureLimitCmh2o}
                onChange={(e) => setDrivingPressureLimitCmh2o(parseFloat(e.target.value) || 15)}
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
          </div>

          {/* Live Preview Box */}
          {preview && (
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                preview.pardsSeverity === 'severe'
                  ? 'bg-red-50 border-red-300 text-red-950'
                  : preview.pardsSeverity === 'moderate'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : preview.pardsSeverity === 'mild'
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex justify-between items-center font-bold text-sm">
                <span>
                  PARDS Severity: {preview.pardsSeverity.toUpperCase()}
                  {preview.oxygenationIndex !== null && ` (OI: ${preview.oxygenationIndex})`}
                  {preview.oxygenSaturationIndex !== null && ` (OSI: ${preview.oxygenSaturationIndex})`}
                </span>
                <span>
                  Target Tidal Volume: {preview.targetTidalVolumeMinMl} - {preview.targetTidalVolumeMaxMl} mL
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  Driving Pressure: {preview.drivingPressureCmh2o !== null ? `${preview.drivingPressureCmh2o} cmH2O` : 'Pplat not entered'}{' '}
                  <span className={preview.isDrivingPressureSafe ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                    ({preview.isDrivingPressureSafe ? 'Safe <15' : 'HIGH DRIVING PRESSURE'})
                  </span>
                </div>
                <div>
                  Plateau Pressure:{' '}
                  <span className={preview.isPlateauPressureSafe ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                    {preview.isPlateauPressureSafe ? 'Safe <=28' : 'EXCEEDS 28 cmH2O'}
                  </span>
                </div>
              </div>

              <p className="text-gray-700">{preview.permissiveHypercapniaAdvice}</p>
            </div>
          )}

          {/* Adjuvant Therapies: Prone Positioning & Neuromuscular Blockade */}
          <div className="border border-purple-200 bg-purple-50/40 p-3.5 rounded-lg space-y-2">
            <span className="text-xs font-bold text-purple-950 uppercase tracking-wide block">
              PALICC-2 Adjuvant Therapies
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-purple-950">
                <input
                  type="checkbox"
                  checked={pronePositioningActive}
                  onChange={(e) => setPronePositioningActive(e.target.checked)}
                  className="rounded text-purple-600"
                />
                <span>Prone Positioning Active (&ge; 16 hours/day for moderate/severe PARDS)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-purple-950">
                <input
                  type="checkbox"
                  checked={neuromuscularBlockadeActive}
                  onChange={(e) => setNeuromuscularBlockadeActive(e.target.checked)}
                  className="rounded text-purple-600"
                />
                <span>Neuromuscular Blockade (NMB) Infusion (Cisatracurium / Vecuronium)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Clinical Notes & Orders
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Severe viral pneumonia with OI 18.2. Lung-protective ventilation instituted with Vt 5 mL/kg, PEEP 10 cmH2O, prone positioning initiated."
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
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Initiating...' : 'Initiate PARDS Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
