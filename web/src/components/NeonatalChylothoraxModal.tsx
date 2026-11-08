import React, { useState, useEffect } from 'react';
import { createNeonatalChylothoraxEpisode, calculateNeonatalChylothorax } from '../api';

interface NeonatalChylothoraxModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalChylothoraxModal: React.FC<NeonatalChylothoraxModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [diagnosisDatetime, setDiagnosisDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(38.0);
  const [birthWeightGrams, setBirthWeightGrams] = useState(3100);
  const [chronologicalAgeDays, setChronologicalAgeDays] = useState(6);
  const [currentWeightKg, setCurrentWeightKg] = useState(3.0);
  const [effusionLaterality, setEffusionLaterality] = useState<string>('unilateral_right');
  const [etiology, setEtiology] = useState<string>('congenital_idiopathic');

  const [pleuralTriglyceridesMgDl, setPleuralTriglyceridesMgDl] = useState<number | ''>(168);
  const [pleuralTotalCellsPerMicroliter, setPleuralTotalCellsPerMicroliter] = useState<number | ''>(4200);
  const [pleuralLymphocytePercent, setPleuralLymphocytePercent] = useState<number | ''>(88);
  const [pleuralCholesterolMgDl, setPleuralCholesterolMgDl] = useState<number | ''>(75);
  const [chylomicronPresence, setChylomicronPresence] = useState(true);

  const [chestTubeInserted, setChestTubeInserted] = useState(true);
  const [initial24hDrainageMl, setInitial24hDrainageMl] = useState(72);
  const [dietaryRegimen, setDietaryRegimen] = useState<string>('nil_by_mouth_tpn');
  const [octreotidePrescribed, setOctreotidePrescribed] = useState(true);
  const [octreotideCurrentDoseMcgKgHr, setOctreotideCurrentDoseMcgKgHr] = useState(2.0);
  const [chemicalPleurodesisPerformed, setChemicalPleurodesisPerformed] = useState(false);
  const [surgicalLigationIndicated, setSurgicalLigationIndicated] = useState(false);

  const [status, setStatus] = useState<string>('acute_chest_tube_drainage');
  const [clinicalNotes, setClinicalNotes] = useState(
    'Post-thoracostomy milky pleural fluid confirmed with triglycerides 168 mg/dL and 88% lymphocytes. Initial drainage 24 mL/kg/day (high-output). Placed NPO on TPN with fat restriction; continuous Octreotide started at 2.0 mcg/kg/hr.',
  );

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateNeonatalChylothorax({
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      birthWeightGrams: Number(birthWeightGrams),
      chronologicalAgeDays: Number(chronologicalAgeDays),
      currentWeightKg: Number(currentWeightKg),
      effusionLaterality,
      etiology,
      pleuralTriglyceridesMgDl: pleuralTriglyceridesMgDl === '' ? undefined : Number(pleuralTriglyceridesMgDl),
      pleuralTotalCellsPerMicroliter: pleuralTotalCellsPerMicroliter === '' ? undefined : Number(pleuralTotalCellsPerMicroliter),
      pleuralLymphocytePercent: pleuralLymphocytePercent === '' ? undefined : Number(pleuralLymphocytePercent),
      pleuralCholesterolMgDl: pleuralCholesterolMgDl === '' ? undefined : Number(pleuralCholesterolMgDl),
      chylomicronPresence,
      chestTubeInserted,
      initial24hDrainageMl: Number(initial24hDrainageMl),
      dietaryRegimen,
      octreotidePrescribed,
      octreotideCurrentDoseMcgKgHr: Number(octreotideCurrentDoseMcgKgHr),
      chemicalPleurodesisPerformed,
      surgicalLigationIndicated,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    chronologicalAgeDays,
    currentWeightKg,
    effusionLaterality,
    etiology,
    pleuralTriglyceridesMgDl,
    pleuralTotalCellsPerMicroliter,
    pleuralLymphocytePercent,
    pleuralCholesterolMgDl,
    chylomicronPresence,
    chestTubeInserted,
    initial24hDrainageMl,
    dietaryRegimen,
    octreotidePrescribed,
    octreotideCurrentDoseMcgKgHr,
    chemicalPleurodesisPerformed,
    surgicalLigationIndicated,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createNeonatalChylothoraxEpisode({
        patientId,
        diagnosisDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightGrams: Number(birthWeightGrams),
        chronologicalAgeDays: Number(chronologicalAgeDays),
        currentWeightKg: Number(currentWeightKg),
        effusionLaterality,
        etiology,
        pleuralTriglyceridesMgDl: pleuralTriglyceridesMgDl === '' ? null : Number(pleuralTriglyceridesMgDl),
        pleuralTotalCellsPerMicroliter: pleuralTotalCellsPerMicroliter === '' ? null : Number(pleuralTotalCellsPerMicroliter),
        pleuralLymphocytePercent: pleuralLymphocytePercent === '' ? null : Number(pleuralLymphocytePercent),
        pleuralCholesterolMgDl: pleuralCholesterolMgDl === '' ? null : Number(pleuralCholesterolMgDl),
        chylomicronPresence,
        chestTubeInserted,
        initial24hDrainageMl: Number(initial24hDrainageMl),
        dietaryRegimen,
        octreotidePrescribed,
        octreotideCurrentDoseMcgKgHr: Number(octreotideCurrentDoseMcgKgHr),
        chemicalPleurodesisPerformed,
        surgicalLigationIndicated,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate neonatal chylothorax episode');
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
              Neonatal Chylothorax & Octreotide Titration Protocol
            </h2>
            <p className="text-sm text-gray-500">
              Patient: <span className="font-semibold text-gray-700">{patientName}</span>
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
              preview.drainageSeverityTier === 'high_output_gt_20'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : preview.drainageSeverityTier === 'moderate_output_10_to_20'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-base">{preview.drainageSeverityLabel}</span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white shadow-sm border">
                {preview.chylothoraxConfirmed ? 'CHYLOTHORAX CONFIRMED' : 'SUSPECTED EFFUSION'}
              </span>
            </div>
            <p className="text-sm mt-1">{preview.summary}</p>
            {preview.criticalActionPlan?.length > 0 && (
              <div className="mt-2 text-xs space-y-1 bg-white/70 p-2.5 rounded-lg border">
                <span className="font-semibold block text-gray-800">Action Plan:</span>
                {preview.criticalActionPlan.map((act: string, idx: number) => (
                  <p key={idx} className="font-medium text-gray-700">• {act}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Diagnosis Datetime</label>
              <input
                type="datetime-local"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
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
              <label className="block text-xs font-medium text-gray-700">Current Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Effusion Laterality</label>
              <select
                value={effusionLaterality}
                onChange={(e) => setEffusionLaterality(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="unilateral_right">Right Hemithorax</option>
                <option value="unilateral_left">Left Hemithorax</option>
                <option value="bilateral">Bilateral Hemithoraces</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Etiology</label>
              <select
                value={etiology}
                onChange={(e) => setEtiology(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="congenital_idiopathic">Congenital Idiopathic (Lymphatic Dysplasia)</option>
                <option value="post_cardiothoracic_surgery">Post-Cardiothoracic Surgery (Thoracic Duct Injury)</option>
                <option value="genetic_turner_noonan_trisomy21">Genetic (Turner / Noonan / Trisomy 21)</option>
                <option value="central_venous_thrombosis">Central Venous Thrombosis (SVC Obstruction)</option>
                <option value="congenital_lymphangiomatosis">Congenital Lymphangiomatosis</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Pleural Fluid Biochemistry & Cytology
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Triglycerides (mg/dL)</label>
                <input
                  type="number"
                  value={pleuralTriglyceridesMgDl}
                  onChange={(e) => setPleuralTriglyceridesMgDl(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="> 110 if fed"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Total Cells (/µL)</label>
                <input
                  type="number"
                  value={pleuralTotalCellsPerMicroliter}
                  onChange={(e) => setPleuralTotalCellsPerMicroliter(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="> 1000"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Lymphocytes (%)</label>
                <input
                  type="number"
                  value={pleuralLymphocytePercent}
                  onChange={(e) => setPleuralLymphocytePercent(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="> 80%"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center mt-5">
                <label className="flex items-center text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={chylomicronPresence}
                    onChange={(e) => setChylomicronPresence(e.target.checked)}
                    className="mr-2 h-4 w-4 text-indigo-600 rounded"
                  />
                  Chylomicrons Present
                </label>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Chest Tube Drainage & Octreotide Titration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Initial 24h Drainage (mL)</label>
                <input
                  type="number"
                  value={initial24hDrainageMl}
                  onChange={(e) => setInitial24hDrainageMl(Number(e.target.value))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
                <span className="text-xs text-gray-500">
                  Rate: {preview ? `${preview.drainageRateMlKgDay} mL/kg/day` : '...'}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Dietary Regimen</label>
                <select
                  value={dietaryRegimen}
                  onChange={(e) => setDietaryRegimen(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="nil_by_mouth_tpn">NPO with TPN (Fat Restricted)</option>
                  <option value="exclusive_mct_formula">Exclusive MCT Formula (Monogen)</option>
                  <option value="mct_supplemented_breast_milk">MCT-Supplemented Skimmed Milk</option>
                  <option value="unrestricted_breast_milk_formula">Unrestricted (Contraindicated)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Octreotide Rate (µg/kg/hr)</label>
                <input
                  type="number"
                  step="0.1"
                  value={octreotideCurrentDoseMcgKgHr}
                  onChange={(e) => setOctreotideCurrentDoseMcgKgHr(Number(e.target.value))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={octreotidePrescribed}
                  onChange={(e) => setOctreotidePrescribed(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Octreotide Infusion Active
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={chemicalPleurodesisPerformed}
                  onChange={(e) => setChemicalPleurodesisPerformed(e.target.checked)}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Chemical Pleurodesis (Povidone-Iodine / OK-432)
              </label>
              <label className="flex items-center text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={surgicalLigationIndicated}
                  onChange={(e) => setSurgicalLigationIndicated(e.target.checked)}
                  className="mr-2 h-4 w-4 text-rose-600 rounded"
                />
                Surgical Thoracic Duct Ligation Indicated
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Clinical Episode Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="acute_chest_tube_drainage">Acute Chest Tube Drainage</option>
                <option value="octreotide_titration">Octreotide Titration Ongoing</option>
                <option value="dietary_mct_transition">Dietary MCT Transition</option>
                <option value="resolved_tube_removed">Resolved (Chest Tube Removed)</option>
                <option value="refractory_surgical_referral">Refractory (Surgical Referral)</option>
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
              {loading ? 'Initiating...' : 'Initiate Chylothorax Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
