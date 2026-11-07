import React, { useState, useMemo } from 'react';
import { createMaternalSepsisAssessment, type MaternalSepsisRecord } from '../api';
import { calculateMaternalSepsis, type MaternalSepsisInput } from '../maternalSepsisEngine';

interface MaternalSepsisModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assessment: MaternalSepsisRecord) => void;
  defaultGestationalAge?: number;
}

export const MaternalSepsisModal: React.FC<MaternalSepsisModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultGestationalAge = 34,
}) => {
  const [assessmentDatetime, setAssessmentDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<string>(String(defaultGestationalAge || ''));
  const [postpartumDays, setPostpartumDays] = useState<string>('');
  const [suspectedSource, setSuspectedSource] = useState<
    | 'chorioamnionitis_intrauterine'
    | 'postpartum_endometritis'
    | 'urinary_tract_pyelonephritis'
    | 'respiratory_pneumonia'
    | 'septic_pelvic_thrombophlebitis'
    | 'surgical_site_cesarean_wound'
    | 'mastitis_breast_abscess'
    | 'other_unknown_source'
  >('chorioamnionitis_intrauterine');

  const [temperatureCelsius, setTemperatureCelsius] = useState<string>('38.8');
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<string>('88');
  const [diastolicBpMmhg, setDiastolicBpMmhg] = useState<string>('54');
  const [heartRateBpm, setHeartRateBpm] = useState<string>('124');
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState<string>('26');
  const [spo2Percent, setSpo2Percent] = useState<string>('93');
  const [wbcCountPerUl, setWbcCountPerUl] = useState<string>('18500');
  const [immatureBandsPercent, setImmatureBandsPercent] = useState<string>('12');
  const [serumLactateMmolL, setSerumLactateMmolL] = useState<string>('2.8');
  const [clinicalImpression, setClinicalImpression] = useState<string>('Suspected intra-amniotic infection (chorioamnionitis) with maternal tachycardia and borderline hypotension.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const input: MaternalSepsisInput = {
        temperatureCelsius: Number(temperatureCelsius) || 37.0,
        systolicBpMmhg: Number(systolicBpMmhg) || 120,
        diastolicBpMmhg: Number(diastolicBpMmhg) || 80,
        heartRateBpm: Number(heartRateBpm) || 80,
        respiratoryRateBpm: Number(respiratoryRateBpm) || 16,
        spo2Percent: Number(spo2Percent) || 98,
        wbcCountPerUl: wbcCountPerUl ? Number(wbcCountPerUl) : undefined,
        immatureBandsPercent: immatureBandsPercent ? Number(immatureBandsPercent) : undefined,
        serumLactateMmolL: serumLactateMmolL ? Number(serumLactateMmolL) : undefined,
      };
      return calculateMaternalSepsis(input);
    } catch {
      return null;
    }
  }, [
    temperatureCelsius,
    systolicBpMmhg,
    diastolicBpMmhg,
    heartRateBpm,
    respiratoryRateBpm,
    spo2Percent,
    wbcCountPerUl,
    immatureBandsPercent,
    serumLactateMmolL,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createMaternalSepsisAssessment({
        patientId,
        assessmentDatetime,
        gestationalAgeWeeks: gestationalAgeWeeks ? Number(gestationalAgeWeeks) : undefined,
        postpartumDays: postpartumDays ? Number(postpartumDays) : undefined,
        suspectedSource,
        temperatureCelsius: Number(temperatureCelsius),
        systolicBpMmhg: Number(systolicBpMmhg),
        diastolicBpMmhg: Number(diastolicBpMmhg),
        heartRateBpm: Number(heartRateBpm),
        respiratoryRateBpm: Number(respiratoryRateBpm),
        spo2Percent: Number(spo2Percent),
        wbcCountPerUl: wbcCountPerUl ? Number(wbcCountPerUl) : undefined,
        immatureBandsPercent: immatureBandsPercent ? Number(immatureBandsPercent) : undefined,
        serumLactateMmolL: serumLactateMmolL ? Number(serumLactateMmolL) : undefined,
        clinicalImpression: clinicalImpression || undefined,
      });

      onSuccess(res.assessment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit maternal sepsis assessment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-800 via-pink-800 to-amber-900 text-white p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <h2 className="text-xl font-bold tracking-tight">Maternal Sepsis &amp; Shock Index Assessment</h2>
            </div>
            <p className="text-rose-100 text-xs mt-1">
              Patient: <span className="font-semibold text-white">{patientName}</span> · Albright Sepsis in Obstetrics Score (SOS) &amp; Nathan Shock Index
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg p-2 text-sm transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Timing and Source */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assessment Datetime *
              </label>
              <input
                type="datetime-local"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500"
                value={assessmentDatetime}
                onChange={(e) => setAssessmentDatetime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gestational Age (weeks)
              </label>
              <input
                type="number"
                step="0.1"
                min="4"
                max="44"
                placeholder="e.g. 36.4"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Postpartum Day
              </label>
              <input
                type="number"
                min="0"
                max="60"
                placeholder="Leave blank if antepartum"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={postpartumDays}
                onChange={(e) => setPostpartumDays(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Suspected Infection Source *
              </label>
              <select
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={suspectedSource}
                onChange={(e) => setSuspectedSource(e.target.value as any)}
              >
                <option value="chorioamnionitis_intrauterine">Chorioamnionitis (Intrauterine)</option>
                <option value="postpartum_endometritis">Postpartum Endometritis</option>
                <option value="urinary_tract_pyelonephritis">Pyelonephritis / Severe UTI</option>
                <option value="respiratory_pneumonia">Pneumonia / Lower Respiratory</option>
                <option value="septic_pelvic_thrombophlebitis">Septic Pelvic Thrombophlebitis</option>
                <option value="surgical_site_cesarean_wound">Cesarean Wound / Surgical Site</option>
                <option value="mastitis_breast_abscess">Mastitis / Breast Abscess</option>
                <option value="other_unknown_source">Other / Unknown Source</option>
              </select>
            </div>
          </div>

          {/* Physiological Vitals Grid */}
          <div className="bg-slate-50 border rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>🩺</span> Bedside Physiological Parameters (Albright SOS Criteria)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Temp (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-rose-700"
                  value={temperatureCelsius}
                  onChange={(e) => setTemperatureCelsius(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Systolic BP *</label>
                <input
                  type="number"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
                  value={systolicBpMmhg}
                  onChange={(e) => setSystolicBpMmhg(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Diastolic BP *</label>
                <input
                  type="number"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
                  value={diastolicBpMmhg}
                  onChange={(e) => setDiastolicBpMmhg(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Heart Rate (bpm) *</label>
                <input
                  type="number"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-rose-700"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Resp Rate (bpm) *</label>
                <input
                  type="number"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
                  value={respiratoryRateBpm}
                  onChange={(e) => setRespiratoryRateBpm(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">SpO2 (%) *</label>
                <input
                  type="number"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
                  value={spo2Percent}
                  onChange={(e) => setSpo2Percent(e.target.value)}
                />
              </div>
            </div>

            {/* Labs: WBC, Bands, Lactate */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              <div>
                <label className="block text-xs text-slate-600 mb-1">WBC Count (/μL)</label>
                <input
                  type="number"
                  placeholder="e.g. 18500"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={wbcCountPerUl}
                  onChange={(e) => setWbcCountPerUl(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Immature Bands (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 12 (Threshold >= 10%)"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={immatureBandsPercent}
                  onChange={(e) => setImmatureBandsPercent(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Serum Lactate (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 2.8 (Threshold >= 2.0)"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-amber-700"
                  value={serumLactateMmolL}
                  onChange={(e) => setSerumLactateMmolL(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Dynamic Clinical Decision Calculation Result Banner */}
          {calcResult && (
            <div
              className={`p-4 rounded-2xl border-2 transition ${
                calcResult.sosRiskLevel === 'severe_septic_shock' || calcResult.shockIndexTier === 'critical_shock_gte_1_4'
                  ? 'bg-rose-50 border-rose-400 text-rose-950'
                  : calcResult.sosRiskLevel === 'intermediate_risk' || calcResult.shockIndexTier === 'elevated_warning_0_9_to_1_4'
                  ? 'bg-amber-50 border-amber-400 text-amber-950'
                  : 'bg-emerald-50 border-emerald-400 text-emerald-950'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-black">
                    SOS {calcResult.sosScore} <span className="text-xs font-normal">/ 28</span>
                  </div>
                  <div>
                    <span
                      className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                        calcResult.sosRiskLevel === 'severe_septic_shock'
                          ? 'bg-red-600 text-white'
                          : calcResult.sosRiskLevel === 'intermediate_risk'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {calcResult.sosRiskLevel.replace(/_/g, ' ')}
                    </span>
                    <div className="text-xs font-semibold mt-0.5">
                      Obstetric Shock Index (HR/SBP):{' '}
                      <span className="font-bold underline">{calcResult.obstetricShockIndex.toFixed(2)}</span> ({calcResult.shockIndexLabel})
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold">
                    Mean Arterial Pressure (MAP): {calcResult.meanArterialPressureMmhg} mmHg
                  </div>
                  <div className="text-[11px] font-medium">
                    {calcResult.mapTargetMet ? '✅ MAP Target ≥ 65 Met' : '⚠️ MAP < 65: Vasopressor indicated'}
                  </div>
                </div>
              </div>

              {calcResult.icuTransferRecommended && (
                <div className="p-2.5 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 mb-3">
                  <span>🚨</span> URGENT: High risk of decompensation / septic shock. Obstetric Critical Care / ICU transfer recommended immediately.
                </div>
              )}

              <div className="space-y-1 text-xs">
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-700">FIGO/ACOG Hour-1 Action Checklist:</div>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                  {calcResult.hourOneBundleChecklist.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clinical Impression &amp; Resuscitation Plan
            </label>
            <textarea
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500"
              value={clinicalImpression}
              onChange={(e) => setClinicalImpression(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded-lg text-sm text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-rose-700 to-amber-800 hover:from-rose-800 hover:to-amber-900 text-white font-bold rounded-lg text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Evaluating...' : 'Save Sepsis Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
