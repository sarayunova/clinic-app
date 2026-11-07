import React, { useState } from 'react';
import { logPdEffluentLab, type PdEffluentLabRecord } from '../api';

interface PdEffluentModalProps {
  sessionId: number;
  sessionNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (record: PdEffluentLabRecord) => void;
}

export const PdEffluentModal: React.FC<PdEffluentModalProps> = ({
  sessionId,
  sessionNumber,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sampleDatetime, setSampleDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [wbcCountPerMcl, setWbcCountPerMcl] = useState<number>(20);
  const [neutrophilsPercent, setNeutrophilsPercent] = useState<number>(30);
  const [gramStain, setGramStain] = useState<string>('No organisms seen');
  const [cultureGrowth, setCultureGrowth] = useState<string>('Pending 48h incubation');
  const [empiricAntibioticInitiated, setEmpiricAntibioticInitiated] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPeritonitis = wbcCountPerMcl > 100 && neutrophilsPercent > 50;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await logPdEffluentLab(sessionId, {
        sampleDatetime,
        wbcCountPerMcl,
        neutrophilsPercent,
        gramStain: gramStain || null,
        cultureGrowth: cultureGrowth || null,
        empiricAntibioticInitiated: empiricAntibioticInitiated || null,
      });
      onSuccess(res.effluentLab);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record effluent lab');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Dialysate Effluent Cytology & Microbiology
            </h2>
            <p className="text-xs text-gray-600">Session: {sessionNumber}</p>
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

        {isPeritonitis ? (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-lg text-red-900 text-xs">
            <span className="font-bold text-sm block mb-1">🚨 CRITICAL: PERITONITIS CONFIRMED</span>
            WBC count &gt; 100/µL ({wbcCountPerMcl}) and Neutrophils &gt; 50% ({neutrophilsPercent}%).
            Immediate intraperitoneal antibiotic therapy (e.g. Cefazolin/Vancomycin + Ceftazidime) required!
          </div>
        ) : (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs">
            WBC count and neutrophil differential are within normal peritoneal ranges (&le; 100/µL or &le; 50% PMN).
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Sample Collection Datetime
            </label>
            <input
              type="datetime-local"
              value={sampleDatetime}
              onChange={(e) => setSampleDatetime(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                WBC Count (/µL)
              </label>
              <input
                type="number"
                min="0"
                value={wbcCountPerMcl}
                onChange={(e) => setWbcCountPerMcl(parseInt(e.target.value, 10) || 0)}
                className={`w-full border rounded-lg px-3 py-1.5 text-sm font-bold ${
                  wbcCountPerMcl > 100 ? 'text-red-700 bg-red-50' : 'text-gray-800'
                }`}
                required
              />
              <span className="text-[10px] text-gray-500">&gt; 100 suggests peritonitis</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Neutrophils / PMN (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={neutrophilsPercent}
                onChange={(e) => setNeutrophilsPercent(parseFloat(e.target.value) || 0)}
                className={`w-full border rounded-lg px-3 py-1.5 text-sm font-bold ${
                  neutrophilsPercent > 50 ? 'text-red-700 bg-red-50' : 'text-gray-800'
                }`}
                required
              />
              <span className="text-[10px] text-gray-500">&gt; 50% is diagnostic</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Gram Stain Smear
            </label>
            <input
              type="text"
              placeholder="e.g. Gram-positive cocci in clusters / No organisms"
              value={gramStain}
              onChange={(e) => setGramStain(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Microbiological Culture & Sensitivity
            </label>
            <input
              type="text"
              placeholder="e.g. Staphylococcus epidermidis sensitive to Vancomycin"
              value={cultureGrowth}
              onChange={(e) => setCultureGrowth(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Empiric / Targeted Antibiotic Initiated
            </label>
            <input
              type="text"
              placeholder="e.g. IP Cefazolin 500 mg/L + IP Ceftazidime 500 mg/L"
              value={empiricAntibioticInitiated}
              onChange={(e) => setEmpiricAntibioticInitiated(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
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
              {loading ? 'Saving...' : 'Save Effluent Lab'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
