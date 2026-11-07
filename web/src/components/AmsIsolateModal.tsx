import React, { useState } from 'react';
import { recordAmsIsolate, type AmsIsolateRecord } from '../api';

interface AmsIsolateModalProps {
  patientId: number;
  patientName: string;
  prescriptionId?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (isolate: AmsIsolateRecord) => void;
}

const COMMON_DRUGS_TESTED = [
  'Ampicillin',
  'Amikacin',
  'Gentamicin',
  'Cefotaxime',
  'Ceftriaxone',
  'Piperacillin-Tazobactam',
  'Meropenem',
  'Vancomycin',
  'Colistin',
  'Linezolid',
  'Ciprofloxacin',
];

export const AmsIsolateModal: React.FC<AmsIsolateModalProps> = ({
  patientId,
  patientName,
  prescriptionId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [collectionDatetime, setCollectionDatetime] = useState<string>(
    new Date(Date.now() - 48 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [reportedAt, setReportedAt] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [specimenType, setSpecimenType] = useState<
    'blood' | 'csf' | 'urine' | 'eta_respiratory' | 'peritoneal_fluid' | 'wound_pus' | 'other'
  >('blood');
  const [pathogenIsolated, setPathogenIsolated] = useState<string>('Klebsiella pneumoniae');
  const [colonyCountCfuMl, setColonyCountCfuMl] = useState<string>('> 100,000 CFU/mL');
  const [sensitivities, setSensitivities] = useState<Record<string, string>>({
    Ampicillin: 'R',
    Cefotaxime: 'R',
    Ceftriaxone: 'R',
    Amikacin: 'S',
    'Piperacillin-Tazobactam': 'S',
    Meropenem: 'S',
    Colistin: 'S',
  });
  const [multidrugResistant, setMultidrugResistant] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSensitivityToggle = (drug: string, value: string) => {
    setSensitivities(prev => ({
      ...prev,
      [drug]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await recordAmsIsolate({
        patientId,
        amsPrescriptionId: prescriptionId || null,
        collectionDatetime,
        specimenType,
        pathogenIsolated,
        colonyCountCfuMl: colonyCountCfuMl || null,
        sensitivities,
        multidrugResistant,
        reportedAt,
      });
      onSuccess(res.isolate);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record isolate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Record Microbiology Culture & Sensitivity
            </h2>
            <p className="text-xs text-gray-600">
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
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Specimen</label>
              <select
                value={specimenType}
                onChange={(e) => setSpecimenType(e.target.value as typeof specimenType)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
              >
                <option value="blood">Blood Culture</option>
                <option value="csf">Cerebrospinal Fluid (CSF)</option>
                <option value="urine">Clean-Catch / Catheter Urine</option>
                <option value="eta_respiratory">Endotracheal Aspirate (ETA)</option>
                <option value="peritoneal_fluid">Peritoneal Dialysate / Ascitic Fluid</option>
                <option value="wound_pus">Wound Pus / Abscess Swab</option>
                <option value="other">Other Specimen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Pathogen Isolated</label>
              <input
                type="text"
                value={pathogenIsolated}
                onChange={(e) => setPathogenIsolated(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Collection Time</label>
              <input
                type="datetime-local"
                value={collectionDatetime}
                onChange={(e) => setCollectionDatetime(e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Report Time</label>
              <input
                type="datetime-local"
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Antimicrobial Susceptibility Panel (S = Susceptible, I = Intermediate, R = Resistant)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-gray-50">
              {COMMON_DRUGS_TESTED.map(drug => (
                <div key={drug} className="flex items-center justify-between bg-white px-2 py-1 rounded border text-xs">
                  <span className="font-medium text-gray-800 text-[11px] truncate">{drug}</span>
                  <div className="flex gap-1">
                    {['S', 'I', 'R'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSensitivityToggle(drug, val)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          sensitivities[drug] === val
                            ? val === 'S'
                              ? 'bg-emerald-600 text-white'
                              : val === 'I'
                              ? 'bg-amber-500 text-white'
                              : 'bg-rose-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="multidrugResistant"
              checked={multidrugResistant}
              onChange={(e) => setMultidrugResistant(e.target.checked)}
              className="rounded text-rose-600"
            />
            <label htmlFor="multidrugResistant" className="text-xs text-rose-800 font-semibold">
              Flag as Multidrug-Resistant Organism (MDRO / ESBL / CRE / MRSA)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border rounded-lg text-xs text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Isolate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
