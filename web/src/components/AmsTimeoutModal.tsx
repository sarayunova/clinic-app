import React, { useState } from 'react';
import { logAmsTimeoutReview, type AmsTimeoutReviewRecord } from '../api';

interface AmsTimeoutModalProps {
  prescriptionId: number;
  drugName: string;
  patientName: string;
  hoursElapsed: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (review: AmsTimeoutReviewRecord) => void;
}

export const AmsTimeoutModal: React.FC<AmsTimeoutModalProps> = ({
  prescriptionId,
  drugName,
  patientName,
  hoursElapsed,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reviewDatetime, setReviewDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [timeoutAction, setTimeoutAction] = useState<
    'de_escalate' | 'targeted_switch' | 'discontinue' | 'continue_unchanged' | 'iv_to_oral_switch'
  >('de_escalate');
  const [cultureResultSummary, setCultureResultSummary] = useState<
    'pathogen_isolated_sensitivities_available' | 'no_growth_sterile' | 'contaminant_suspected' | 'culture_pending'
  >('pathogen_isolated_sensitivities_available');
  const [clinicalResponse, setClinicalResponse] = useState<
    'improving_afebrile' | 'stable_persistent_markers' | 'deteriorating_septic_shock'
  >('improving_afebrile');
  const [justificationNotes, setJustificationNotes] = useState<string>('');
  const [newAntimicrobialRegimen, setNewAntimicrobialRegimen] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificationNotes.trim()) {
      setError('Please provide clinical justification for the antibiotic timeout decision.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await logAmsTimeoutReview(prescriptionId, {
        reviewDatetime,
        timeoutAction,
        cultureResultSummary,
        clinicalResponse,
        justificationNotes,
        newAntimicrobialRegimen: newAntimicrobialRegimen || null,
      });
      onSuccess(res.timeoutReview);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record antibiotic timeout');
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
              48–72h Antibiotic Stewardship Timeout
            </h2>
            <p className="text-xs text-gray-600">
              Patient: <span className="font-semibold">{patientName}</span> | Drug: <strong className="text-indigo-700">{drugName}</strong> ({hoursElapsed}h elapsed)
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

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
          <strong>CDC & WHO Guidance:</strong> Review microbiological cultures and clinical trajectory. De-escalate to narrower-spectrum Access-tier agents or switch IV to Oral when afebrile for ≥ 24h.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Timeout Action Decision
              </label>
              <select
                value={timeoutAction}
                onChange={(e) => setTimeoutAction(e.target.value as typeof timeoutAction)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
              >
                <option value="de_escalate">De-escalate to Narrower Spectrum</option>
                <option value="targeted_switch">Targeted Switch (Per Sensitivities)</option>
                <option value="iv_to_oral_switch">Step-Down (IV to Oral Switch)</option>
                <option value="discontinue">Discontinue (Sterile / Resolved)</option>
                <option value="continue_unchanged">Continue Broad-Spectrum</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Culture & Sensitivity Status
              </label>
              <select
                value={cultureResultSummary}
                onChange={(e) => setCultureResultSummary(e.target.value as typeof cultureResultSummary)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
              >
                <option value="pathogen_isolated_sensitivities_available">Pathogen Isolated (Sensitivities Ready)</option>
                <option value="no_growth_sterile">No Growth / Sterile Cultures (48h)</option>
                <option value="contaminant_suspected">Contaminant Suspected (e.g. CoNS single bottle)</option>
                <option value="culture_pending">Culture Still Incubating</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Patient Clinical Trajectory
            </label>
            <select
              value={clinicalResponse}
              onChange={(e) => setClinicalResponse(e.target.value as typeof clinicalResponse)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="improving_afebrile">Clinically Improving, Afebrile, Biomarkers Declining</option>
              <option value="stable_persistent_markers">Hemodynamically Stable, Persistent Inflammatory Markers</option>
              <option value="deteriorating_septic_shock">Clinical Deterioration / Refractory Septic Shock</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              New Antimicrobial Regimen (if switching / de-escalating)
            </label>
            <input
              type="text"
              placeholder="e.g. Switch to Oral Amoxicillin-Clavulanate 45mg/kg/day or IV Cefazolin"
              value={newAntimicrobialRegimen}
              onChange={(e) => setNewAntimicrobialRegimen(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Stewardship Justification Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Blood culture sterile at 48 hours, infant active, vigorous, CRP normalized to 3.2 mg/L. Empiric Meropenem discontinued safely."
              value={justificationNotes}
              onChange={(e) => setJustificationNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-xs"
              required
            />
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
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Sign Off Timeout Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
