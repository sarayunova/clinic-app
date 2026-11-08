import React, { useState } from 'react';
import { addObstetricTolacFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricTolacFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursInActiveLabor, setHoursInActiveLabor] = useState<number>(3.5);
  const [cervicalDilationCm, setCervicalDilationCm] = useState<number>(5.0);
  const [fetalHeartRateBaseline, setFetalHeartRateBaseline] = useState<number>(135);
  const [efmCategory, setEfmCategory] = useState<
    'category_1_normal' | 'category_2_indeterminate' | 'category_3_abnormal'
  >('category_1_normal');
  const [contractionsPer10min, setContractionsPer10min] = useState<number>(4);
  const [restingUterineToneMmhg, setRestingUterineToneMmhg] = useState<string>('12');
  const [lowerSegmentScarPain, setLowerSegmentScarPain] = useState<boolean>(false);
  const [interventionApplied, setInterventionApplied] = useState<string>('Maternal repositioning, IV hydration');
  const [notes, setNotes] = useState<string>('Tracing reactive, cervix progressing smoothly');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await addObstetricTolacFlowsheet(episodeId, {
        logDatetime,
        hoursInActiveLabor: Number(hoursInActiveLabor),
        cervicalDilationCm: Number(cervicalDilationCm),
        fetalHeartRateBaseline: Number(fetalHeartRateBaseline),
        efmCategory,
        contractionsPer10min: Number(contractionsPer10min),
        restingUterineToneMmhg: restingUterineToneMmhg ? Number(restingUterineToneMmhg) : null,
        lowerSegmentScarPain,
        interventionApplied: interventionApplied.trim() || null,
        notes: notes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add flowsheet checkpoint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-700 to-teal-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⏱️</span>
            <h2 className="text-md font-bold">Log TOLAC Labor Progress Checkpoint</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-emerald-200 text-2xl font-bold p-1 leading-none"
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Check Date/Time *</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Hours in Active Labor *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursInActiveLabor}
                onChange={(e) => setHoursInActiveLabor(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Cervical Dilation (cm) *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={cervicalDilationCm}
                onChange={(e) => setCervicalDilationCm(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">FHR Baseline (bpm) *</label>
              <input
                type="number"
                min="50"
                max="220"
                value={fetalHeartRateBaseline}
                onChange={(e) => setFetalHeartRateBaseline(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">EFM Tracing Category *</label>
              <select
                value={efmCategory}
                onChange={(e) => setEfmCategory(e.target.value as any)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="category_1_normal">Category 1 (Normal)</option>
                <option value="category_2_indeterminate">Category 2 (Indeterminate)</option>
                <option value="category_3_abnormal">Category 3 (Abnormal - Action!)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Contractions / 10 min *</label>
              <input
                type="number"
                min="0"
                max="10"
                value={contractionsPer10min}
                onChange={(e) => setContractionsPer10min(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Resting Tone (mmHg)</label>
              <input
                type="number"
                value={restingUterineToneMmhg}
                onChange={(e) => setRestingUterineToneMmhg(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="10-15"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 text-xs font-bold text-red-700">
                <input
                  type="checkbox"
                  checked={lowerSegmentScarPain}
                  onChange={(e) => setLowerSegmentScarPain(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span>Lower Segment Scar Pain</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Intervention Applied</label>
            <input
              type="text"
              value={interventionApplied}
              onChange={(e) => setInterventionApplied(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="e.g. Stop oxytocin, Left lateral tilt, O2 face mask"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Midwife / Obstetrician Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="e.g. Good progress, membrane ruptured clear"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Log Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
