import React, { useState } from 'react';
import { createAmsPrescription, type AmsPrescriptionRecord } from '../api';
import { AWARE_FORMULARY, lookupAwareTier, isRestrictedApprovalRequired } from '../amsEngine';

interface AmsPrescriptionModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (prescription: AmsPrescriptionRecord) => void;
}

export const AmsPrescriptionModal: React.FC<AmsPrescriptionModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [prescribedDatetime, setPrescribedDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [drugName, setDrugName] = useState<string>('Ampicillin');
  const [route, setRoute] = useState<'iv' | 'oral' | 'im' | 'ip'>('iv');
  const [dosage, setDosage] = useState<string>('100 mg/kg/dose');
  const [frequency, setFrequency] = useState<string>('q8h');
  const [indication, setIndication] = useState<string>('empiric_early_onset_sepsis');
  const [suspectedFocus, setSuspectedFocus] = useState<string>('Bloodstream / Sepsis screen');
  const [baselineWbc, setBaselineWbc] = useState<string>('');
  const [baselineCrpMgL, setBaselineCrpMgL] = useState<string>('');
  const [baselineProcalcitoninNgMl, setBaselineProcalcitoninNgMl] = useState<string>('');
  const [culturesSent, setCulturesSent] = useState<boolean>(true);
  const [cultureSpecimens, setCultureSpecimens] = useState<string[]>(['Blood']);
  const [plannedDurationDays, setPlannedDurationDays] = useState<number>(7);
  const [restrictedApprovalNotes, setRestrictedApprovalNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTier = lookupAwareTier(drugName);
  const requiresApproval = isRestrictedApprovalRequired(drugName);
  const formularyInfo = AWARE_FORMULARY[drugName];

  const handleDrugChange = (selected: string) => {
    setDrugName(selected);
    const info = AWARE_FORMULARY[selected];
    if (info) {
      setRoute(info.routeDefault);
    }
  };

  const handleToggleSpecimen = (specimen: string) => {
    setCultureSpecimens(prev =>
      prev.includes(specimen) ? prev.filter(s => s !== specimen) : [...prev, specimen]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await createAmsPrescription({
        patientId,
        prescribedDatetime,
        drugName,
        route,
        dosage,
        frequency,
        indication,
        suspectedFocus: suspectedFocus || null,
        baselineWbc: baselineWbc ? parseFloat(baselineWbc) : null,
        baselineCrpMgL: baselineCrpMgL ? parseFloat(baselineCrpMgL) : null,
        baselineProcalcitoninNgMl: baselineProcalcitoninNgMl ? parseFloat(baselineProcalcitoninNgMl) : null,
        culturesSent,
        cultureSpecimenTypes: cultureSpecimens,
        plannedDurationDays,
        restrictedApprovalNotes: restrictedApprovalNotes || null,
      });
      onSuccess(res.prescription);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record prescription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Antimicrobial Prescription Order
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
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Prescription Datetime
              </label>
              <input
                type="datetime-local"
                value={prescribedDatetime}
                onChange={(e) => setPrescribedDatetime(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Antimicrobial Agent
              </label>
              <select
                value={drugName}
                onChange={(e) => handleDrugChange(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white font-semibold"
              >
                <optgroup label="Access Tier (First-line, narrow spectrum)">
                  <option value="Ampicillin">Ampicillin</option>
                  <option value="Amoxicillin">Amoxicillin</option>
                  <option value="Amoxicillin-Clavulanate">Amoxicillin-Clavulanate</option>
                  <option value="Cefazolin">Cefazolin</option>
                  <option value="Cloxacillin">Cloxacillin</option>
                  <option value="Gentamicin">Gentamicin</option>
                  <option value="Metronidazole">Metronidazole</option>
                </optgroup>
                <optgroup label="Watch Tier (Surveillance priority)">
                  <option value="Cefotaxime">Cefotaxime</option>
                  <option value="Ceftriaxone">Ceftriaxone</option>
                  <option value="Amikacin">Amikacin</option>
                  <option value="Piperacillin-Tazobactam">Piperacillin-Tazobactam</option>
                  <option value="Meropenem">Meropenem</option>
                  <option value="Vancomycin">Vancomycin</option>
                  <option value="Ciprofloxacin">Ciprofloxacin</option>
                </optgroup>
                <optgroup label="Reserve Tier (Last-resort, restricted approval)">
                  <option value="Colistin">Colistin</option>
                  <option value="Linezolid">Linezolid</option>
                  <option value="Polymyxin B">Polymyxin B</option>
                  <option value="Ceftazidime-Avibactam">Ceftazidime-Avibactam</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* AWaRe Tier Badge & Formulary Guidance */}
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              currentTier === 'access'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : currentTier === 'watch'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div>
              <span className="font-bold uppercase tracking-wider block">
                WHO AWaRe Tier: {currentTier.toUpperCase()}
              </span>
              <span className="text-[11px] block text-gray-700">
                {formularyInfo?.pediatricDosingHint || 'Follow standard pediatric formulary'}
              </span>
            </div>
            {requiresApproval && (
              <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold">
                RESTRICTED APPROVAL
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value as typeof route)}
                className="w-full border rounded px-2 py-1.5 text-xs bg-white"
              >
                <option value="iv">IV Infusion / Push</option>
                <option value="oral">Oral (PO)</option>
                <option value="im">Intramuscular (IM)</option>
                <option value="ip">Intraperitoneal (IP)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Dose</label>
              <input
                type="text"
                placeholder="e.g. 50 mg/kg"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Frequency</label>
              <input
                type="text"
                placeholder="e.g. q8h or q12h"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Indication</label>
              <select
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-xs bg-white"
              >
                <option value="empiric_early_onset_sepsis">Empiric Early-Onset Sepsis (&lt;72h)</option>
                <option value="empiric_late_onset_sepsis">Empiric Late-Onset Sepsis (&ge;72h)</option>
                <option value="ventilator_associated_pneumonia">Ventilator-Associated Pneumonia (VAP)</option>
                <option value="urinary_tract_infection">Complicated Urinary Tract Infection</option>
                <option value="surgical_prophylaxis">Surgical Antimicrobial Prophylaxis</option>
                <option value="meningitis">Acute Bacterial Meningitis</option>
                <option value="necrotizing_enterocolitis">Necrotizing Enterocolitis (NEC)</option>
                <option value="culture_proven_pathogen">Targeted Culture-Proven Pathogen</option>
                <option value="other">Other Clinical Infection</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Suspected Focus</label>
              <input
                type="text"
                placeholder="e.g. Lung consolidation / central line"
                value={suspectedFocus}
                onChange={(e) => setSuspectedFocus(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Pre-treatment Cultures */}
          <div className="bg-gray-50 p-3 rounded-lg border text-xs space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="culturesSent"
                checked={culturesSent}
                onChange={(e) => setCulturesSent(e.target.checked)}
                className="rounded text-blue-600"
              />
              <label htmlFor="culturesSent" className="font-semibold text-gray-800">
                Diagnostic cultures collected prior to starting antimicrobial (NABH Stewardship Rule)
              </label>
            </div>
            {culturesSent && (
              <div className="flex flex-wrap gap-2 pt-1">
                {['Blood', 'Urine', 'CSF', 'ETA/Tracheal', 'Peritoneal Fluid', 'Wound Pus'].map(specimen => (
                  <button
                    key={specimen}
                    type="button"
                    onClick={() => handleToggleSpecimen(specimen)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                      cultureSpecimens.includes(specimen)
                        ? 'bg-blue-100 border-blue-400 text-blue-800 font-bold'
                        : 'bg-white border-gray-300 text-gray-600'
                    }`}
                  >
                    {cultureSpecimens.includes(specimen) ? '✓ ' : '+ '}
                    {specimen}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Baseline Markers */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">WBC Count (/µL)</label>
              <input
                type="number"
                placeholder="e.g. 18500"
                value={baselineWbc}
                onChange={(e) => setBaselineWbc(e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">CRP (mg/L)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 24.5"
                value={baselineCrpMgL}
                onChange={(e) => setBaselineCrpMgL(e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Procalcitonin (ng/mL)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2.4"
                value={baselineProcalcitoninNgMl}
                onChange={(e) => setBaselineProcalcitoninNgMl(e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
          </div>

          {requiresApproval && (
            <div>
              <label className="block text-xs font-semibold text-rose-800 mb-1">
                Restricted Antimicrobial Justification Notes
              </label>
              <textarea
                rows={2}
                placeholder="Document infectious disease / consultant approval, documented MDR isolate, or severe clinical failure on 1st line therapy"
                value={restrictedApprovalNotes}
                onChange={(e) => setRestrictedApprovalNotes(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs border-rose-300"
              />
            </div>
          )}

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
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Ordering...' : 'Confirm Prescription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
