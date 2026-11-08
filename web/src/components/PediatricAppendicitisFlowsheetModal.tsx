import React, { useState } from 'react';
import { addPediatricAppendicitisFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricAppendicitisFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromTriage, setHoursFromTriage] = useState<number>(4);

  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(38.2);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(112);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(24);
  const [painScore, setPainScore] = useState<number>(5);
  const [abdominalExam, setAbdominalExam] = useState<'soft_non_tender' | 'focal_rlq_tenderness_improving' | 'rebound_guarding_worsening' | 'diffuse_peritonitis'>('focal_rlq_tenderness_improving');
  const [oralIntake, setOralIntake] = useState<'npo_strict' | 'clear_liquids_tolerated' | 'age_appropriate_diet'>('npo_strict');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await addPediatricAppendicitisFlowsheet(episodeId, {
        logDatetime,
        hoursFromTriage,
        temperatureCelsius,
        heartRateBpm,
        respiratoryRate,
        painScoreFlaccWongBaker: painScore,
        abdominalExamFindings: abdominalExam,
        oralIntakeStatus: oralIntake,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record appendicitis flowsheet checkpoint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50 rounded-t-xl">
          <div>
            <h3 className="font-bold text-indigo-950 text-lg">Log Serial Abdominal Exam Checkpoint</h3>
            <p className="text-xs text-indigo-700">FLACC / Wong-Baker Pain &bull; Peritoneal Signs &bull; Vitals</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Observation Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full border rounded px-2.5 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Hours From Triage</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromTriage}
                onChange={(e) => setHoursFromTriage(parseFloat(e.target.value))}
                className="w-full border rounded px-2.5 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Temperature (&deg;C)</label>
              <input
                type="number"
                step="0.1"
                min="34"
                max="43"
                value={temperatureCelsius}
                onChange={(e) => setTemperatureCelsius(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Heart Rate (bpm)</label>
              <input
                type="number"
                min="40"
                max="220"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Resp Rate (/min)</label>
              <input
                type="number"
                min="10"
                max="80"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Pain Score (FLACC / Faces 0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={painScore}
                onChange={(e) => setPainScore(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Oral Intake Status</label>
              <select
                value={oralIntake}
                onChange={(e) => setOralIntake(e.target.value as any)}
                className="w-full border rounded px-2 py-1 text-xs"
              >
                <option value="npo_strict">NPO (Strict Fasting)</option>
                <option value="clear_liquids_tolerated">Clear Liquids Tolerated</option>
                <option value="age_appropriate_diet">Age-Appropriate Diet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-xs">Abdominal Exam Findings</label>
            <select
              value={abdominalExam}
              onChange={(e) => setAbdominalExam(e.target.value as any)}
              className="w-full border rounded px-2.5 py-1.5 text-xs font-semibold"
            >
              <option value="soft_non_tender">Soft & Non-Tender (Resolved)</option>
              <option value="focal_rlq_tenderness_improving">Focal RLQ Tenderness (Stable/Improving)</option>
              <option value="rebound_guarding_worsening">Rebound Tenderness / Guarding (Worsening)</option>
              <option value="diffuse_peritonitis">Diffuse Peritonitis (Rigidity / Involuntary Guarding)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-xs">Clinical Observation Notes</label>
            <input
              type="text"
              placeholder="e.g. Hopping test negative, child smiling and interacting, IV fluids running"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border rounded text-gray-600 hover:bg-gray-100 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
