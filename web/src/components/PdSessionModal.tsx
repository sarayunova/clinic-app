import React, { useState } from 'react';
import { createPdSession, type PdSessionRecord } from '../api';

interface PdSessionModalProps {
  patientId: number;
  patientName: string;
  defaultWeightKg?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: PdSessionRecord) => void;
}

export const PdSessionModal: React.FC<PdSessionModalProps> = ({
  patientId,
  patientName,
  defaultWeightKg = 3.5,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [startDatetime, setStartDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [indication, setIndication] = useState<
    | 'kdigo_stage_3_aki'
    | 'severe_fluid_overload_gt20'
    | 'refractory_hyperkalemia'
    | 'severe_metabolic_acidosis'
    | 'inborn_error_metabolism'
    | 'uremic_encephalopathy'
    | 'other'
  >('kdigo_stage_3_aki');
  const [catheterType, setCatheterType] = useState<
    | 'acute_rigid_percutaneous'
    | 'flexible_curved_cook'
    | 'tenckhoff_single_cuff'
    | 'tenckhoff_double_cuff'
    | 'other'
  >('flexible_curved_cook');
  const [catheterInsertionDate, setCatheterInsertionDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [patientWeightKg, setPatientWeightKg] = useState<number>(defaultWeightKg);
  const [solutionType, setSolutionType] = useState<
    'dextrose_1_5' | 'dextrose_2_5' | 'dextrose_4_25' | 'custom_compound'
  >('dextrose_1_5');
  const [fillVolumeMlPerKg, setFillVolumeMlPerKg] = useState<number>(15);
  const [inflowTimeMinutes, setInflowTimeMinutes] = useState<number>(15);
  const [dwellTimeMinutes, setDwellTimeMinutes] = useState<number>(45);
  const [drainTimeMinutes, setDrainTimeMinutes] = useState<number>(20);
  const [targetCyclesCount, setTargetCyclesCount] = useState<number>(12);
  const [heparinUnitsPerLiter, setHeparinUnitsPerLiter] = useState<number>(500);
  const [potassiumMeqPerLiter, setPotassiumMeqPerLiter] = useState<number>(0);
  const [antibioticAdditive, setAntibioticAdditive] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const calculatedFillVolume = Math.round(fillVolumeMlPerKg * patientWeightKg);
  const totalCycleDurationMin = inflowTimeMinutes + dwellTimeMinutes + drainTimeMinutes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (patientWeightKg <= 0) {
      setError('Patient weight must be greater than 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createPdSession({
        patientId,
        startDatetime,
        indication,
        catheterType,
        catheterInsertionDate: catheterInsertionDate || null,
        patientWeightKg,
        solutionType,
        fillVolumeMlPerKg,
        inflowTimeMinutes,
        dwellTimeMinutes,
        drainTimeMinutes,
        targetCyclesCount,
        heparinUnitsPerLiter,
        potassiumMeqPerLiter,
        antibioticAdditive: antibioticAdditive || null,
      });
      onSuccess(res.session);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate PD session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Initiate Acute Peritoneal Dialysis
            </h2>
            <p className="text-sm text-gray-600">
              Patient: <span className="font-semibold">{patientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-2xl"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Start Datetime
              </label>
              <input
                type="datetime-local"
                value={startDatetime}
                onChange={(e) => setStartDatetime(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Indication for Acute PD
              </label>
              <select
                value={indication}
                onChange={(e) =>
                  setIndication(e.target.value as typeof indication)
                }
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="kdigo_stage_3_aki">KDIGO Stage 3 AKI (Severe/Anuric)</option>
                <option value="severe_fluid_overload_gt20">Severe Fluid Overload (≥ 20%)</option>
                <option value="refractory_hyperkalemia">Refractory Hyperkalemia (K &gt; 6.5 mEq/L)</option>
                <option value="severe_metabolic_acidosis">Refractory Metabolic Acidosis (pH &lt; 7.15)</option>
                <option value="inborn_error_metabolism">Inborn Error of Metabolism (Hyperammonemia)</option>
                <option value="uremic_encephalopathy">Uremic Encephalopathy / Pericarditis</option>
                <option value="other">Other Clinical Indication</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Catheter Type
              </label>
              <select
                value={catheterType}
                onChange={(e) =>
                  setCatheterType(e.target.value as typeof catheterType)
                }
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="flexible_curved_cook">Flexible Curved Pediatric (Cook) Catheter</option>
                <option value="acute_rigid_percutaneous">Acute Rigid Percutaneous Trocar</option>
                <option value="tenckhoff_single_cuff">Tenckhoff Single-Cuff Catheter</option>
                <option value="tenckhoff_double_cuff">Tenckhoff Double-Cuff Catheter</option>
                <option value="other">Other Pediatric Dialysis Access</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Catheter Insertion Date
              </label>
              <input
                type="date"
                value={catheterInsertionDate}
                onChange={(e) => setCatheterInsertionDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-2">
              Weight & Fill Volume Prescription (Pediatric ISPD Guidelines)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.3"
                  value={patientWeightKg}
                  onChange={(e) => setPatientWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Dose (mL/kg)
                </label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="50"
                  value={fillVolumeMlPerKg}
                  onChange={(e) => setFillVolumeMlPerKg(parseInt(e.target.value, 10) || 10)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  required
                />
                <span className="text-[10px] text-gray-500">10-20 start, up to 35</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Calculated Fill Volume
                </label>
                <div className="text-lg font-black text-blue-700 bg-white border border-blue-300 rounded px-3 py-1 text-center">
                  {calculatedFillVolume} mL
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Dialysate Solution Type
              </label>
              <select
                value={solutionType}
                onChange={(e) =>
                  setSolutionType(e.target.value as typeof solutionType)
                }
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="dextrose_1_5">1.5% Dextrose (Low Osmolarity / Standard)</option>
                <option value="dextrose_2_5">2.5% Dextrose (Moderate Ultrafiltration)</option>
                <option value="dextrose_4_25">4.25% Dextrose (Maximum Hypertonic UF)</option>
                <option value="custom_compound">Custom Compound / Bicarbonate-Based</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Target Planned Cycles
              </label>
              <input
                type="number"
                min="1"
                max="48"
                value={targetCyclesCount}
                onChange={(e) => setTargetCyclesCount(parseInt(e.target.value, 10) || 12)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-gray-50 border rounded-lg p-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">
              Cycle Timing Parameters (Total: {totalCycleDurationMin} mins / cycle)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Inflow Time (min)</label>
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={inflowTimeMinutes}
                  onChange={(e) => setInflowTimeMinutes(parseInt(e.target.value, 10) || 15)}
                  className="w-full border rounded px-2 py-1 text-sm text-center"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dwell Time (min)</label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={dwellTimeMinutes}
                  onChange={(e) => setDwellTimeMinutes(parseInt(e.target.value, 10) || 45)}
                  className="w-full border rounded px-2 py-1 text-sm text-center font-bold text-indigo-700"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Drain Time (min)</label>
                <input
                  type="number"
                  min="5"
                  max="45"
                  value={drainTimeMinutes}
                  onChange={(e) => setDrainTimeMinutes(parseInt(e.target.value, 10) || 20)}
                  className="w-full border rounded px-2 py-1 text-sm text-center"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Heparin Additive (U/L)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={heparinUnitsPerLiter}
                onChange={(e) => setHeparinUnitsPerLiter(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
              <span className="text-[10px] text-gray-500">500 U/L to prevent fibrin clot</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                KCl Additive (mEq/L)
              </label>
              <input
                type="number"
                min="0"
                max="8"
                step="0.5"
                value={potassiumMeqPerLiter}
                onChange={(e) => setPotassiumMeqPerLiter(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
              <span className="text-[10px] text-gray-500">0 if hyperkalemic, 2-4 if K &lt; 3.5</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Antibiotic Additive
              </label>
              <input
                type="text"
                placeholder="e.g. Cefazolin 500 mg/L"
                value={antibioticAdditive}
                onChange={(e) => setAntibioticAdditive(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Initiating...' : 'Start Peritoneal Dialysis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
