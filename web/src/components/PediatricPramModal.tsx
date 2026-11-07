import React, { useState, useMemo } from 'react';
import { createPediatricPramAssessment, type PediatricPramRecord } from '../api';
import { calculatePramScore, type PramAssessmentInput } from '../pediatricAllergyEngine';

interface PediatricPramModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assessment: PediatricPramRecord) => void;
}

export const PediatricPramModal: React.FC<PediatricPramModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [assessmentDatetime, setAssessmentDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [oxygenSaturationPct, setOxygenSaturationPct] = useState<number>(93);
  const [suprasternalRetractionsScore, setSuprasternalRetractionsScore] = useState<0 | 2>(2);
  const [scaleneMuscleContractionScore, setScaleneMuscleContractionScore] = useState<0 | 2>(0);
  const [airEntryScore, setAirEntryScore] = useState<0 | 1 | 2 | 3>(1);
  const [wheezingScore, setWheezingScore] = useState<0 | 1 | 2 | 3>(2);
  const [responseToBurstSaba, setResponseToBurstSaba] = useState<
    'good_response' | 'partial_response' | 'poor_deteriorating'
  >('partial_response');
  const [systemicSteroidGiven, setSystemicSteroidGiven] = useState<boolean>(true);
  const [ivMagnesiumGiven, setIvMagnesiumGiven] = useState<boolean>(false);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const input: PramAssessmentInput = {
        oxygenSaturationPct: Number(oxygenSaturationPct) || 98,
        suprasternalRetractionsScore,
        scaleneMuscleContractionScore,
        airEntryScore,
        wheezingScore,
        responseToBurstSaba,
      };
      return calculatePramScore(input);
    } catch {
      return null;
    }
  }, [
    oxygenSaturationPct,
    suprasternalRetractionsScore,
    scaleneMuscleContractionScore,
    airEntryScore,
    wheezingScore,
    responseToBurstSaba,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createPediatricPramAssessment({
        patientId,
        assessmentDatetime,
        oxygenSaturationPct: Number(oxygenSaturationPct),
        suprasternalRetractionsScore,
        scaleneMuscleContractionScore,
        airEntryScore,
        wheezingScore,
        responseToBurstSaba,
        systemicSteroidGiven,
        ivMagnesiumGiven,
        clinicalNotes: clinicalNotes.trim() || undefined,
      });

      onSuccess(res.assessment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record PRAM score');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-emerald-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🫁</span> Pediatric Asthma PRAM Respiratory Score (0 - 12)
            </h2>
            <p className="text-xs text-teal-100 mt-0.5">
              Patient: <strong className="text-white">{patientName}</strong> | Pediatric Respiratory Assessment Measure
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

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Datetime</label>
            <input
              type="datetime-local"
              value={assessmentDatetime}
              onChange={e => setAssessmentDatetime(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

          {/* 5 Clinical Parameters Grid */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Validated PRAM Clinical Predictors
            </h3>

            {/* 1. SpO2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center bg-white p-2.5 rounded border border-slate-200">
              <div>
                <label className="block font-bold text-slate-800">1. Room Air SpO2 (%)</label>
                <span className="text-[10px] text-slate-500">≥95% (0 pts) | 92-94% (1 pt) | &lt;92% (2 pts)</span>
              </div>
              <div>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={oxygenSaturationPct}
                  onChange={e => setOxygenSaturationPct(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-teal-400 bg-teal-50/50 rounded font-bold text-slate-900"
                  required
                />
              </div>
            </div>

            {/* 2. Suprasternal Retractions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center bg-white p-2.5 rounded border border-slate-200">
              <div>
                <label className="block font-bold text-slate-800">2. Suprasternal Retractions</label>
                <span className="text-[10px] text-slate-500">Tracheal tug / jugular notch indrawing</span>
              </div>
              <select
                value={suprasternalRetractionsScore}
                onChange={e => setSuprasternalRetractionsScore(Number(e.target.value) as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              >
                <option value={0}>Absent (0 points)</option>
                <option value={2}>Present (2 points)</option>
              </select>
            </div>

            {/* 3. Scalene Muscle Contraction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center bg-white p-2.5 rounded border border-slate-200">
              <div>
                <label className="block font-bold text-slate-800">3. Scalene Muscle Contraction</label>
                <span className="text-[10px] text-slate-500">Palpable active neck accessory muscles</span>
              </div>
              <select
                value={scaleneMuscleContractionScore}
                onChange={e => setScaleneMuscleContractionScore(Number(e.target.value) as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              >
                <option value={0}>Absent (0 points)</option>
                <option value={2}>Present (2 points)</option>
              </select>
            </div>

            {/* 4. Air Entry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center bg-white p-2.5 rounded border border-slate-200">
              <div>
                <label className="block font-bold text-slate-800">4. Air Entry (Auscultation)</label>
                <span className="text-[10px] text-slate-500">Bilateral vesicular breath sounds</span>
              </div>
              <select
                value={airEntryScore}
                onChange={e => setAirEntryScore(Number(e.target.value) as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              >
                <option value={0}>Normal air entry (0 points)</option>
                <option value={1}>Decreased at bases only (1 point)</option>
                <option value={2}>Widespread decrease (2 points)</option>
                <option value={3}>Absent / minimal ("silent chest") (3 points)</option>
              </select>
            </div>

            {/* 5. Wheezing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center bg-white p-2.5 rounded border border-slate-200">
              <div>
                <label className="block font-bold text-slate-800">5. Wheezing</label>
                <span className="text-[10px] text-slate-500">Expiratory or biphasic musical rhonchi</span>
              </div>
              <select
                value={wheezingScore}
                onChange={e => setWheezingScore(Number(e.target.value) as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              >
                <option value={0}>Absent (0 points)</option>
                <option value={1}>Expiratory only (1 point)</option>
                <option value={2}>Inspiratory & Expiratory (2 points)</option>
                <option value={3}>Audible without stethoscope / silent chest (3 points)</option>
              </select>
            </div>
          </div>

          {/* Section: Live Score & Treatment Pathway */}
          {calcResult && (
            <div className="p-4 bg-gradient-to-r from-slate-900 to-teal-950 text-white rounded-xl shadow-inner space-y-3">
              <div className="flex items-center justify-between border-b border-teal-800/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                  {calcResult.severityLabel}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    calcResult.severityTier === 'impending_respiratory_failure_8_12'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : calcResult.severityTier === 'moderate_4_7'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  Score: {calcResult.totalPramScore} / 12
                </span>
              </div>

              <div className="text-xs text-teal-100 bg-white/10 p-2.5 rounded border border-white/10 space-y-1">
                <strong>Recommended Care Pathway:</strong>
                <p className="text-white">{calcResult.recommendedPathway}</p>
              </div>

              <div className="text-xs space-y-1">
                <strong className="text-teal-300 text-[11px] block">Emergency Medications:</strong>
                <ul className="list-disc list-inside text-white space-y-0.5">
                  {calcResult.medicationsSummary.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="text-xs text-teal-200">
                <strong>Disposition:</strong> {calcResult.dispositionRecommendation}
              </div>
            </div>
          )}

          {/* Interventions Given */}
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-slate-700 block">Acute Emergency Interventions Administered:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-600 mb-1">Burst SABA Response</label>
                <select
                  value={responseToBurstSaba}
                  onChange={e => setResponseToBurstSaba(e.target.value as any)}
                  className="w-full px-2 py-1 border border-slate-300 rounded"
                >
                  <option value="good_response">Good response</option>
                  <option value="partial_response">Partial response</option>
                  <option value="poor_deteriorating">Poor / Deteriorating</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={systemicSteroidGiven}
                    onChange={e => setSystemicSteroidGiven(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Systemic Steroid Given</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={ivMagnesiumGiven}
                    onChange={e => setIvMagnesiumGiven(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>IV Magnesium Sulfate Given</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Clinical Assessment Notes</label>
            <input
              type="text"
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
              placeholder="e.g. Inhaled burst salbutamol 6 puffs via AeroChamber started; SpO2 improved to 96%."
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500"
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
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save PRAM Score'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
