import React, { useState, useEffect } from 'react';
import {
  createNeonatalHypoglycemiaEpisode,
  calculateNeonatalHypoglycemia,
  type NeonatalHypoglycemiaRecord,
} from '../api';

interface Props {
  patientId: number;
  admissionId?: number | null;
  onClose: () => void;
  onSuccess: (ep: NeonatalHypoglycemiaRecord) => void;
}

export const NeonatalHypoglycemiaModal: React.FC<Props> = ({
  patientId,
  admissionId,
  onClose,
  onSuccess,
}) => {
  const [evaluationDatetime, setEvaluationDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageHours, setAgeHours] = useState(6);
  const [birthWeightKg, setBirthWeightKg] = useState(2.8);
  const [currentWeightKg, setCurrentWeightKg] = useState(2.8);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState(34);
  const [symptomsPresent, setSymptomsPresent] = useState(false);
  const [riskFactors, setRiskFactors] = useState<string[]>(['infant_of_diabetic_mother']);
  const [fluidDextrosePercent, setFluidDextrosePercent] = useState(10.0);
  const [fluidRateMlHr, setFluidRateMlHr] = useState(10.0);
  const [d10wBolusGivenMl, setD10wBolusGivenMl] = useState(0);
  const [seizureActivityObserved, setSeizureActivityObserved] = useState(false);
  const [seizureType, setSeizureType] = useState<'none' | 'subclinical_only' | 'electroclinical_clonic' | 'electroclinical_tonic' | 'electroclinical_myoclonic' | 'electroclinical_subtle'>('none');
  const [aeegBackgroundPattern, setAeegBackgroundPattern] = useState<'continuous_normal_voltage' | 'discontinuous_normal_voltage' | 'continuous_low_voltage' | 'burst_suppression' | 'flat_trace'>('continuous_normal_voltage');
  const [firstLineAsmGiven, setFirstLineAsmGiven] = useState(false);
  const [phenobarbitalDoseMg, setPhenobarbitalDoseMg] = useState<number | undefined>();
  const [levetiracetamDoseMg, setLevetiracetamDoseMg] = useState<number | undefined>();
  const [status, setStatus] = useState<'evaluating' | 'active_infusion' | 'stabilized_weaning' | 'resolved'>('evaluating');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    calculateNeonatalHypoglycemia({
      ageHours,
      bloodGlucoseMgDl,
      birthWeightKg,
      currentWeightKg,
      symptomsPresent,
      riskFactors,
      fluidDextrosePercent,
      fluidRateMlHr,
      aeegPattern: aeegBackgroundPattern,
    })
      .then((res) => {
        if (active) {
          setPreview(res);
          if (res.seizureDosing) {
            if (phenobarbitalDoseMg === undefined) setPhenobarbitalDoseMg(res.seizureDosing.phenobarbitalInitialDoseMg);
            if (levetiracetamDoseMg === undefined) setLevetiracetamDoseMg(res.seizureDosing.levetiracetamInitialDoseMg);
          }
          if (res.evalResult?.miniBolusIndicated && d10wBolusGivenMl === 0) {
            setD10wBolusGivenMl(res.evalResult.recommendedD10wBolusMl);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ageHours, bloodGlucoseMgDl, birthWeightKg, currentWeightKg, symptomsPresent, riskFactors, fluidDextrosePercent, fluidRateMlHr, aeegBackgroundPattern]);

  const handleToggleRisk = (r: string) => {
    if (riskFactors.includes(r)) {
      setRiskFactors(riskFactors.filter((x) => x !== r));
    } else {
      setRiskFactors([...riskFactors, r]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await createNeonatalHypoglycemiaEpisode({
        patientId,
        admissionId,
        evaluationDatetime,
        ageHours,
        birthWeightKg,
        currentWeightKg,
        riskFactors,
        symptomsPresent,
        initialBloodGlucoseMgDl: bloodGlucoseMgDl,
        d10wBolusGivenMl,
        currentGirMgKgMin: preview?.currentGir ?? 0,
        fluidDextrosePercent,
        fluidRateMlHr,
        seizureActivityObserved,
        seizureType,
        aeegBackgroundPattern,
        firstLineAsmGiven,
        phenobarbitalDoseMg: firstLineAsmGiven ? phenobarbitalDoseMg : null,
        levetiracetamDoseMg: firstLineAsmGiven ? levetiracetamDoseMg : null,
        status,
        clinicalNotes,
      });
      onSuccess(res.episode);
    } catch (err: any) {
      setError(err?.message || 'Failed to create hypoglycemia episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Neonatal Hypoglycemia, GIR & aEEG Seizure Protocol
            </h2>
            <p className="text-xs text-gray-500">
              AAP 2011 Postnatal Glucose Homeostasis & WHO/ILAE 2021 Neonatal Seizure Stewardship
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Evaluation Datetime
              </label>
              <input
                type="datetime-local"
                value={evaluationDatetime}
                onChange={(e) => setEvaluationDatetime(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Postnatal Age (hours)
              </label>
              <input
                type="number"
                step="0.5"
                value={ageHours}
                onChange={(e) => setAgeHours(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Current Weight (kg)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1">
                Blood Glucose (mg/dL)
              </label>
              <input
                type="number"
                step="1"
                value={bloodGlucoseMgDl}
                onChange={(e) => setBloodGlucoseMgDl(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-blue-300 rounded px-2 py-1.5 font-bold text-blue-900"
                required
              />
              <span className="text-xs text-blue-700 mt-1 block">
                AAP Target ({ageHours < 4 ? '< 4h: 40 mg/dL' : ageHours < 24 ? '4-24h: 45 mg/dL' : '> 24h: 50 mg/dL'}):{' '}
                <strong>{preview?.evalResult?.targetGlucoseMgDl} mg/dL</strong>
              </span>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={symptomsPresent}
                  onChange={(e) => setSymptomsPresent(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Neuroglycopenic / Autonomic Symptoms Present</span>
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                (Lethargy, jitteriness, cyanosis, hypotonia, apnea, or poor feeding)
              </p>
            </div>
          </div>

          {/* Risk Factors */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Neonatal Risk Factors
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { id: 'infant_of_diabetic_mother', label: 'Infant of Diabetic Mother (IDM)' },
                { id: 'small_for_gestational_age', label: 'Small for Gestational Age (SGA)' },
                { id: 'large_for_gestational_age', label: 'Large for Gestational Age (LGA)' },
                { id: 'late_preterm', label: 'Late Preterm (34-36.6w)' },
                { id: 'perinatal_hypoxia_stress', label: 'Perinatal Stress / Asphyxia' },
              ].map((rf) => (
                <button
                  type="button"
                  key={rf.id}
                  onClick={() => handleToggleRisk(rf.id)}
                  className={`px-2.5 py-1 rounded-full border ${
                    riskFactors.includes(rf.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          {preview?.evalResult && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                preview.evalResult.isHypoglycemic
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex justify-between font-bold">
                <span>
                  Status:{' '}
                  {preview.evalResult.isHypoglycemic
                    ? `HYPOGLYCEMIA (${preview.evalResult.severityTier.toUpperCase()})`
                    : 'NORMOGLYCEMIC'}
                </span>
                <span>Calculated GIR: {preview.currentGir} mg/kg/min</span>
              </div>
              <p className="text-gray-700">{preview.evalResult.actionRecommendation}</p>
              {preview.evalResult.miniBolusIndicated && (
                <div className="font-semibold text-red-700">
                  STAT IV D10W Mini-Bolus: {preview.evalResult.recommendedD10wBolusMl} mL (2 mL/kg)
                </div>
              )}
            </div>
          )}

          {/* GIR Fluid Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fluid Dextrose Concentration (%)
              </label>
              <select
                value={fluidDextrosePercent}
                onChange={(e) => setFluidDextrosePercent(parseFloat(e.target.value) || 10)}
                className="w-full text-sm border rounded px-2 py-1.5"
              >
                <option value={5}>D5W (5%)</option>
                <option value={10}>D10W (10%)</option>
                <option value={12.5}>D12.5W (12.5% max peripheral)</option>
                <option value={15}>D15W (15% Central Line only)</option>
                <option value={20}>D20W (20% Central Line only)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                IV Infusion Rate (mL/hr)
              </label>
              <input
                type="number"
                step="0.1"
                value={fluidRateMlHr}
                onChange={(e) => setFluidRateMlHr(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                D10W Bolus Given (mL)
              </label>
              <input
                type="number"
                step="0.1"
                value={d10wBolusGivenMl}
                onChange={(e) => setD10wBolusGivenMl(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
          </div>

          {/* Seizures & aEEG Section */}
          <div className="border border-purple-200 bg-purple-50/40 p-3 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                aEEG Neuro-Monitoring & Neonatal Seizures
              </span>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seizureActivityObserved}
                  onChange={(e) => setSeizureActivityObserved(e.target.checked)}
                  className="rounded text-purple-600"
                />
                <span>Seizures Observed</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  aEEG Background Pattern
                </label>
                <select
                  value={aeegBackgroundPattern}
                  onChange={(e) => setAeegBackgroundPattern(e.target.value as any)}
                  className="w-full text-sm border rounded px-2 py-1.5"
                >
                  <option value="continuous_normal_voltage">Continuous Normal Voltage (CNV)</option>
                  <option value="discontinuous_normal_voltage">Discontinuous Normal Voltage (DNV)</option>
                  <option value="continuous_low_voltage">Continuous Low Voltage (CLV)</option>
                  <option value="burst_suppression">Burst Suppression (BS)</option>
                  <option value="flat_trace">Flat Trace / Isoelectric (FT)</option>
                </select>
                {preview?.aeegInterpretation && (
                  <p className="text-[11px] text-purple-700 mt-1">
                    {preview.aeegInterpretation.clinicalMeaning}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ILAE Seizure Classification
                </label>
                <select
                  value={seizureType}
                  onChange={(e) => setSeizureType(e.target.value as any)}
                  disabled={!seizureActivityObserved}
                  className="w-full text-sm border rounded px-2 py-1.5 disabled:opacity-50"
                >
                  <option value="none">None</option>
                  <option value="electroclinical_clonic">Electroclinical Clonic</option>
                  <option value="electroclinical_tonic">Electroclinical Tonic</option>
                  <option value="electroclinical_myoclonic">Electroclinical Myoclonic</option>
                  <option value="electroclinical_subtle">Electroclinical Subtle (Orofacial/Bicycling)</option>
                  <option value="subclinical_only">Subclinical (Electrographic Only)</option>
                </select>
              </div>
            </div>

            {seizureActivityObserved && (
              <div className="bg-white p-2.5 rounded border border-purple-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-purple-900">
                    WHO Anti-Seizure Medication Dosing ({currentWeightKg} kg):
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={firstLineAsmGiven}
                      onChange={(e) => setFirstLineAsmGiven(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>ASM Administered</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 text-gray-800">
                  <div>
                    1st Line Phenobarbital IV (20 mg/kg):{' '}
                    <strong>{preview?.seizureDosing?.phenobarbitalInitialDoseMg} mg</strong>
                  </div>
                  <div>
                    2nd Line Levetiracetam IV (40 mg/kg):{' '}
                    <strong>{preview?.seizureDosing?.levetiracetamInitialDoseMg} mg</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Clinical Notes & Orders
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. IDM with jitteriness, started on D10W GIR 6.0 mg/kg/min. aEEG continuous monitoring active."
              className="w-full text-sm border rounded px-2 py-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Initiating...' : 'Initiate Hypoglycemia Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
