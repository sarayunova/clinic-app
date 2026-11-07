import React, { useState, useMemo } from 'react';
import { createPediatricAnaphylaxisPlan, type PediatricAnaphylaxisPlanRecord } from '../api';
import { calculatePediatricAnaphylaxisPlan, type PediatricAnaphylaxisInput } from '../pediatricAllergyEngine';

interface AnaphylaxisPlanModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (plan: PediatricAnaphylaxisPlanRecord) => void;
  defaultWeightKg?: number;
}

const COMMON_ALLERGENS = [
  'Peanuts',
  'Tree Nuts (Cashew, Walnut, Almond)',
  "Cow's Milk / Dairy",
  'Egg White / Yolk',
  'Fish & Shellfish',
  'Soy',
  'Wheat',
  'Penicillin / Amoxicillin',
  'Bee / Wasp Venom Stings',
  'Latex',
];

export const AnaphylaxisPlanModal: React.FC<AnaphylaxisPlanModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultWeightKg = 18,
}) => {
  const [diagnosisDate, setDiagnosisDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [childWeightKg, setChildWeightKg] = useState<number>(defaultWeightKg);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>(['Peanuts']);
  const [customAllergen, setCustomAllergen] = useState<string>('');
  const [injectionSite, setInjectionSite] = useState<string>('anterolateral_right_thigh');
  const [antihistaminePrescribed, setAntihistaminePrescribed] = useState<string>('Cetirizine 5 mg / 5 mL syrup');
  const [steroidPrescribed, setSteroidPrescribed] = useState<string>('Prednisolone 20 mg daily x 3 days');
  const [schoolHealthActionPlanShared, setSchoolHealthActionPlanShared] = useState<boolean>(true);
  const [emergencyContactName, setEmergencyContactName] = useState<string>('Mother / Father');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('+91 98765 43210');
  const [clinicalInstructions, setClinicalInstructions] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const input: PediatricAnaphylaxisInput = {
        childWeightKg: Number(childWeightKg) || 15,
        knownAllergens: selectedAllergens,
      };
      return calculatePediatricAnaphylaxisPlan(input);
    } catch {
      return null;
    }
  }, [childWeightKg, selectedAllergens]);

  if (!isOpen) return null;

  const toggleAllergen = (item: string) => {
    setSelectedAllergens(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  };

  const addCustomAllergen = () => {
    if (customAllergen.trim() && !selectedAllergens.includes(customAllergen.trim())) {
      setSelectedAllergens(prev => [...prev, customAllergen.trim()]);
      setCustomAllergen('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAllergens.length === 0) {
      setError('Please select or specify at least one allergen');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await createPediatricAnaphylaxisPlan({
        patientId,
        diagnosisDate,
        knownAllergens: selectedAllergens,
        childWeightKg: Number(childWeightKg),
        injectionSite,
        antihistaminePrescribed: antihistaminePrescribed.trim() || undefined,
        steroidPrescribed: steroidPrescribed.trim() || undefined,
        schoolHealthActionPlanShared,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        clinicalInstructions: clinicalInstructions.trim() || undefined,
      });

      onSuccess(res.plan);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create anaphylaxis plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-800 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>💉</span> Pediatric Emergency Anaphylaxis Action Plan
            </h2>
            <p className="text-xs text-red-100 mt-0.5">
              Patient: <strong className="text-white">{patientName}</strong> | WAO Precision Weight-Based Epinephrine
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-bold leading-none p-1">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Section 1: Demographics & Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Diagnosis Date</label>
              <input
                type="date"
                value={diagnosisDate}
                onChange={e => setDiagnosisDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-red-950 mb-1">
                Child Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                min="3"
                max="120"
                value={childWeightKg}
                onChange={e => setChildWeightKg(Number(e.target.value))}
                className="w-full px-3 py-1.5 border-2 border-red-400 bg-red-50/50 rounded font-bold text-base text-red-950 focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
          </div>

          {/* Section 2: Known Allergens Multi-select */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Confirmed Anaphylactic Triggers & Allergens *
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ALLERGENS.map(item => {
                const isSelected = selectedAllergens.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAllergen(item)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                      isSelected
                        ? 'bg-red-600 text-white font-semibold'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {item}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customAllergen}
                onChange={e => setCustomAllergen(e.target.value)}
                placeholder="Or type custom allergen..."
                className="flex-1 px-2.5 py-1 border border-slate-300 rounded text-xs"
              />
              <button
                type="button"
                onClick={addCustomAllergen}
                className="px-3 py-1 bg-slate-700 text-white text-xs rounded font-medium hover:bg-slate-800"
              >
                Add
              </button>
            </div>
          </div>

          {/* Section 3: Live Autoinjector & Epinephrine Dosing Box */}
          {calcResult && (
            <div className="p-4 bg-gradient-to-r from-red-950 via-slate-900 to-rose-950 text-white rounded-xl shadow-inner space-y-3">
              <div className="flex items-center justify-between border-b border-red-800/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-300 flex items-center gap-1.5">
                  <span>⚡</span> Emergency 1st-Line Medication: IM Epinephrine 1:1,000
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-red-600 text-white">
                  {calcResult.recommendedAutoinjectorType.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/10 p-2.5 rounded border border-white/10">
                  <span className="text-slate-400 block text-[10px]">Epinephrine IM Dose</span>
                  <span className="text-base font-black text-amber-300">
                    {calcResult.epinephrineImDoseMg} mg
                  </span>
                  <span className="text-[10px] text-slate-300 block">0.01 mg/kg stat</span>
                </div>

                <div className="bg-white/10 p-2.5 rounded border border-white/10">
                  <span className="text-slate-400 block text-[10px]">1:1,000 Volume (1 mg/mL)</span>
                  <span className="text-base font-black text-cyan-300">
                    {calcResult.epinephrineImVolumeMl} mL
                  </span>
                  <span className="text-[10px] text-slate-300 block">Intramuscular injection</span>
                </div>

                <div className="bg-white/10 p-2.5 rounded border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[10px]">Repeat Window</span>
                  <span className="text-xs font-bold text-white block mt-0.5">
                    {calcResult.repeatWindowMinutes}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-white/10 rounded border border-white/10 text-xs text-red-100">
                <strong>Device Selection:</strong> {calcResult.autoinjectorLabel}
              </div>

              <div className="text-[11px] text-slate-300">
                <strong>Anatomical Site:</strong> {calcResult.injectionSite}
              </div>
            </div>
          )}

          {/* Section 4: Secondary Prescriptions & Contacts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1">Second-line Antihistamine</label>
              <input
                type="text"
                value={antihistaminePrescribed}
                onChange={e => setAntihistaminePrescribed(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Second-line Oral Steroid</label>
              <input
                type="text"
                value={steroidPrescribed}
                onChange={e => setSteroidPrescribed(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Primary Emergency Contact Name *</label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={e => setEmergencyContactName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Emergency Contact Phone *</label>
              <input
                type="text"
                value={emergencyContactPhone}
                onChange={e => setEmergencyContactPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-red-500"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={schoolHealthActionPlanShared}
                onChange={e => setSchoolHealthActionPlanShared(e.target.checked)}
                className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
              />
              <span>School / Daycare Emergency Action Plan Dossier generated and shared with parents</span>
            </label>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Special Clinical Instructions for Caregivers & Teachers</label>
            <textarea
              rows={2}
              value={clinicalInstructions}
              onChange={e => setClinicalInstructions(e.target.value)}
              placeholder="e.g. Always carry two epinephrine auto-injectors; lay child flat immediately upon symptoms; do NOT allow child to stand or walk."
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Save & Issue Action Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
