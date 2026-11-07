import React, { useState, useMemo } from 'react';
import { createMaternalCardiacAssessment, type MaternalCardiacRecord } from '../api';
import { calculateMaternalCardiacRisk, type MaternalCardiacInput } from '../maternalComorbidityEngine';

interface MaternalCardiacModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assessment: MaternalCardiacRecord) => void;
}

export const MaternalCardiacModal: React.FC<MaternalCardiacModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [assessmentDatetime, setAssessmentDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(24);
  const [cardiacDiagnosis, setCardiacDiagnosis] = useState<string>('Repaired Tetralogy of Fallot with mild pulmonary regurgitation');
  const [mwhoClass, setMwhoClass] = useState<
    'mwho_I' | 'mwho_II' | 'mwho_II_III' | 'mwho_III' | 'mwho_IV'
  >('mwho_II');
  const [nyhaClassBaseline, setNyhaClassBaseline] = useState<'I' | 'II' | 'III' | 'IV'>('I');

  // CARPREG-II criteria
  const [priorCardiacEvent, setPriorCardiacEvent] = useState<boolean>(false);
  const [priorArrhythmia, setPriorArrhythmia] = useState<boolean>(false);
  const [leftHeartObstruction, setLeftHeartObstruction] = useState<boolean>(false);
  const [reducedSystemicVentricularFunctionEfLt50, setReducedSystemicVentricularFunctionEfLt50] = useState<boolean>(false);
  const [highRiskValveOrAorta, setHighRiskValveOrAorta] = useState<boolean>(false);
  const [latePregnancyPresentation, setLatePregnancyPresentation] = useState<boolean>(false);

  const [deliveryModeRecommendation, setDeliveryModeRecommendation] = useState<string>(
    'vaginal_with_assisted_second_stage'
  );
  const [monitoringPlanAntepartum, setMonitoringPlanAntepartum] = useState<string>('');
  const [anesthesiaRecommendation, setAnesthesiaRecommendation] = useState<string>('');
  const [icuPostpartumBedReserved, setIcuPostpartumBedReserved] = useState<boolean>(false);
  const [attendingCardiologistName, setAttendingCardiologistName] = useState<string>('Dr. Rajesh Mehta (Cardiology)');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const input: MaternalCardiacInput = {
        mwhoClass,
        nyhaClassBaseline,
        priorCardiacEvent,
        priorArrhythmia,
        leftHeartObstruction,
        reducedSystemicVentricularFunction: reducedSystemicVentricularFunctionEfLt50,
        highRiskValveOrAorta,
        latePregnancyPresentation,
      };
      return calculateMaternalCardiacRisk(input);
    } catch {
      return null;
    }
  }, [
    mwhoClass,
    nyhaClassBaseline,
    priorCardiacEvent,
    priorArrhythmia,
    leftHeartObstruction,
    reducedSystemicVentricularFunctionEfLt50,
    highRiskValveOrAorta,
    latePregnancyPresentation,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createMaternalCardiacAssessment({
        patientId,
        assessmentDatetime,
        gestationalAgeWeeks: gestationalAgeWeeks ? Number(gestationalAgeWeeks) : undefined,
        cardiacDiagnosis,
        mwhoClass,
        nyhaClassBaseline,
        priorCardiacEvent,
        priorArrhythmia,
        leftHeartObstruction,
        reducedSystemicVentricularFunctionEfLt50,
        highRiskValveOrAorta,
        latePregnancyPresentation,
        monitoringPlanAntepartum: monitoringPlanAntepartum.trim() || undefined,
        deliveryModeRecommendation,
        anesthesiaRecommendation: anesthesiaRecommendation.trim() || undefined,
        icuPostpartumBedReserved,
        attendingCardiologistName: attendingCardiologistName.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess(res.assessment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record maternal cardiac assessment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-gradient-to-r from-rose-800 to-red-950 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>❤️</span> Maternal Cardiac Risk Assessment (mWHO & CARPREG-II)
            </h2>
            <p className="text-xs text-rose-200 mt-0.5">
              Patient: <strong className="text-white">{patientName}</strong> | ESC Guidelines on Cardiovascular Disease in Pregnancy
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

          {/* Section 1: Clinical Presentation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Date & Time</label>
              <input
                type="datetime-local"
                value={assessmentDatetime}
                onChange={e => setAssessmentDatetime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-rose-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gestation (Weeks)</label>
              <input
                type="number"
                step="0.1"
                min="4"
                max="44"
                value={gestationalAgeWeeks}
                onChange={e => setGestationalAgeWeeks(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Baseline NYHA Class</label>
              <select
                value={nyhaClassBaseline}
                onChange={e => setNyhaClassBaseline(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-rose-500"
              >
                <option value="I">NYHA I: No limitation of physical activity</option>
                <option value="II">NYHA II: Slight limitation; comfortable at rest</option>
                <option value="III">NYHA III: Marked limitation; symptoms on less than ordinary activity</option>
                <option value="IV">NYHA IV: Severe symptoms at rest</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Specific Cardiac Diagnosis *</label>
            <input
              type="text"
              value={cardiacDiagnosis}
              onChange={e => setCardiacDiagnosis(e.target.value)}
              placeholder="e.g. Mitral stenosis, Peripartum cardiomyopathy, Aortic coarctation repair"
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-rose-500"
              required
            />
          </div>

          {/* Section 2: mWHO Classification */}
          <div className="p-3.5 bg-rose-50/60 rounded-lg border border-rose-200">
            <label className="block text-xs font-bold text-rose-950 mb-1.5">
              Modified WHO (mWHO) Cardiovascular Risk Classification *
            </label>
            <select
              value={mwhoClass}
              onChange={e => setMwhoClass(e.target.value as any)}
              className="w-full px-3 py-2 border border-rose-300 rounded text-sm font-semibold text-rose-950 focus:ring-2 focus:ring-rose-500"
            >
              <option value="mwho_I">mWHO I: Low Risk (Event rate 2.5-5%) - Mild pulmonary stenosis, repaired ASD/VSD</option>
              <option value="mwho_II">mWHO II: Low-Moderate Risk (Event rate 5.7-10.5%) - Repaired Fallot, simple arrhythmias</option>
              <option value="mwho_II_III">mWHO II-III: Moderate-High (Event rate 10-19%) - Mild LV dysfunction, non-dilated Marfan</option>
              <option value="mwho_III">mWHO III: High Risk (Event rate 19-27%) - Mechanical valve, Fontan, cyanotic heart disease</option>
              <option value="mwho_IV">mWHO IV: EXTREMELY HIGH / CONTRAINDICATED (Event rate 40-100%) - PAH, severe LV impairment EF&lt;30%</option>
            </select>
            {mwhoClass === 'mwho_IV' && (
              <span className="block mt-2 text-xs font-bold text-rose-700 bg-rose-100 p-2 rounded border border-rose-300">
                🚨 PREGNANCY CONTRAINDICATED: Extremely high risk of maternal death or irreversible cardiac failure. Multidisciplinary cardiac-obstetric emergency conference required.
              </span>
            )}
          </div>

          {/* Section 3: CARPREG-II Risk Criteria */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
              CARPREG-II Predictors of Maternal Cardiac Complications
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={priorCardiacEvent}
                  onChange={e => setPriorCardiacEvent(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Prior Cardiac Event (HF, stroke, TIA) (+3 pts)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leftHeartObstruction}
                  onChange={e => setLeftHeartObstruction(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Left Heart Obstruction (Mitral &lt;2cm², Aorta &lt;1.5cm²) (+2 pts)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reducedSystemicVentricularFunctionEfLt50}
                  onChange={e => setReducedSystemicVentricularFunctionEfLt50(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Reduced Ventricular Function (LVEF &lt;50%) (+2 pts)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highRiskValveOrAorta}
                  onChange={e => setHighRiskValveOrAorta(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Mechanical Valve or Aorta Pathology (+2 pts)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={priorArrhythmia}
                  onChange={e => setPriorArrhythmia(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Prior Sustained Arrhythmia (+1 pt)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={latePregnancyPresentation}
                  onChange={e => setLatePregnancyPresentation(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Late Pregnancy Presentation (&gt;20 wks) (+1 pt)</span>
              </label>
            </div>
          </div>

          {/* Section 4: Live Decision Support & Risk Projection */}
          {calcResult && (
            <div className="p-4 bg-gradient-to-r from-slate-900 to-rose-950 text-white rounded-xl shadow-inner space-y-3">
              <div className="flex items-center justify-between border-b border-rose-900/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Predicted Maternal Cardiac Risk
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    calcResult.riskTier === 'high'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : calcResult.riskTier === 'intermediate'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {calcResult.riskTier.toUpperCase()} RISK ({calcResult.predictedEventRiskPct}% event rate)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">CARPREG-II Score:</span>
                  <strong className="text-base text-rose-300">{calcResult.carpregIiScore} Points</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Predicted Events:</span>
                  <strong className="text-base text-white">{calcResult.predictedEventRiskPct}%</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">mWHO Stratum:</span>
                  <strong className="text-white text-xs">{mwhoClass.replace('_', ' ').toUpperCase()}</strong>
                </div>
              </div>

              <div className="text-xs text-rose-100 bg-white/10 p-2.5 rounded border border-white/10">
                <strong>Recommended Delivery Mode:</strong> {calcResult.recommendedDeliveryMode}
              </div>
            </div>
          )}

          {/* Section 5: Delivery & Anesthesia Recommendations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Attending Cardiologist</label>
              <input
                type="text"
                value={attendingCardiologistName}
                onChange={e => setAttendingCardiologistName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Postpartum Bed Allocation</label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={icuPostpartumBedReserved}
                  onChange={e => setIcuPostpartumBedReserved(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Mandatory ICU/HDU Postpartum Bed Reserved</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Clinical Notes & Multidisciplinary Plan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Radial arterial line insertion on admission to labor ward; continuous pulse oximetry; left lateral tilt; strict fluid restriction ≤ 1 mL/kg/h."
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-rose-500"
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
              className="px-6 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Saving Assessment...' : 'Save Cardiac Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
