import React, { useState } from 'react';
import { addNeonatalHyperammonemiaFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const NeonatalHyperammonemiaFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen = true,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromCrisisOnset, setHoursFromCrisisOnset] = useState<number>(4.0);
  const [plasmaAmmoniaUmolL, setPlasmaAmmoniaUmolL] = useState<number>(240.0);
  const [phValue, setPhValue] = useState<number>(7.44);
  const [pco2Mmhg, setPco2Mmhg] = useState<number>(32.0);
  const [bicarbonateMeqL, setBicarbonateMeqL] = useState<number>(22.0);
  const [glucoseMgDl, setGlucoseMgDl] = useState<number>(145.0);
  const [girMgKgMin, setGirMgKgMin] = useState<number>(11.5);
  const [dialysisBloodFlowMlMin, setDialysisBloodFlowMlMin] = useState<number>(0.0);
  const [encephalopathyGrade, setEncephalopathyGrade] = useState<
    'grade_1_mild_lethargy_poor_feeding' |
    'grade_2_moderate_somnolence_hyperreflexia' |
    'grade_3_severe_stupor_decerebrate_posturing' |
    'grade_4_deep_coma_fixed_dilated_pupils'
  >('grade_2_moderate_somnolence_hyperreflexia');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addNeonatalHyperammonemiaFlowsheet(episodeId, {
        logDatetime,
        hoursFromCrisisOnset,
        plasmaAmmoniaUmolL,
        phValue,
        pco2Mmhg,
        bicarbonateMeqL,
        glucoseMgDl,
        girMgKgMin,
        dialysisBloodFlowMlMin,
        encephalopathyGrade,
        notes: notes || null,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record hyperammonemia flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-purple-700 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">Add Ammonia & Metabolic Flowsheet Entry</h2>
          <button onClick={onClose} className="text-white hover:text-purple-200 text-2xl font-bold">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Log Datetime *</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hours Post-Onset *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="720"
                value={hoursFromCrisisOnset}
                onChange={(e) => setHoursFromCrisisOnset(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ammonia (umol/L)</label>
              <input
                type="number"
                step="1"
                min="10"
                max="3000"
                value={plasmaAmmoniaUmolL}
                onChange={(e) => setPlasmaAmmoniaUmolL(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs font-bold text-purple-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">pH Value</label>
              <input
                type="number"
                step="0.01"
                min="6.8"
                max="7.8"
                value={phValue}
                onChange={(e) => setPhValue(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">pCO2 (mmHg)</label>
              <input
                type="number"
                step="0.5"
                min="10"
                max="120"
                value={pco2Mmhg}
                onChange={(e) => setPco2Mmhg(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">HCO3 (mEq/L)</label>
              <input
                type="number"
                step="0.5"
                min="2"
                max="50"
                value={bicarbonateMeqL}
                onChange={(e) => setBicarbonateMeqL(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Glucose (mg/dL)</label>
              <input
                type="number"
                step="1"
                min="20"
                max="600"
                value={glucoseMgDl}
                onChange={(e) => setGlucoseMgDl(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">GIR (mg/kg/min)</label>
              <input
                type="number"
                step="0.5"
                min="4"
                max="25"
                value={girMgKgMin}
                onChange={(e) => setGirMgKgMin(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs font-bold text-teal-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">CRRT Flow (mL/min)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={dialysisBloodFlowMlMin}
                onChange={(e) => setDialysisBloodFlowMlMin(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Encephalopathy Grade</label>
              <select
                value={encephalopathyGrade}
                onChange={(e) => setEncephalopathyGrade(e.target.value as any)}
                className="w-full border rounded px-3 py-1.5 text-xs"
              >
                <option value="grade_1_mild_lethargy_poor_feeding">Grade 1: Mild Lethargy / Poor Feeds</option>
                <option value="grade_2_moderate_somnolence_hyperreflexia">Grade 2: Somnolence / Hyperreflexia</option>
                <option value="grade_3_severe_stupor_decerebrate_posturing">Grade 3: Stupor / Posturing</option>
                <option value="grade_4_deep_coma_fixed_dilated_pupils">Grade 4: Deep Coma / Fixed Pupils</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Observations & Neurologic Status</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pupillary reflexes intact, seizure activity quiescent on continuous aEEG..."
              className="w-full border rounded px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 border rounded text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-purple-700 text-white rounded text-xs font-medium hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
