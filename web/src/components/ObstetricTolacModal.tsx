import React, { useState, useEffect } from 'react';
import {
  createObstetricTolacEpisode,
  type ObstetricTolacRecord,
} from '../api';
import {
  evaluateObstetricTolac,
  type ObstetricTolacResult,
} from '../obstetricTolacEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricTolacRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricTolacModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [assessmentDatetime, setAssessmentDatetime] = useState(
    existingEpisode?.assessment_datetime || new Date().toISOString().slice(0, 16),
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    existingEpisode?.gestational_age_weeks ?? 39.2,
  );
  const [maternalAge, setMaternalAge] = useState<number>(
    existingEpisode?.maternal_age ?? 31,
  );
  const [maternalBmi, setMaternalBmi] = useState<number>(
    existingEpisode?.maternal_bmi ?? 26.5,
  );
  const [priorCesareanCount, setPriorCesareanCount] = useState<number>(
    existingEpisode?.prior_cesarean_count ?? 1,
  );
  const [priorUterineIncisionType, setPriorUterineIncisionType] = useState<
    'low_transverse' | 'unknown_low_transverse_presumed' | 'classical_vertical' | 'inverted_t_or_j' | 'prior_transmural_myomectomy'
  >(existingEpisode?.prior_uterine_incision_type ?? 'low_transverse');
  const [priorVaginalDelivery, setPriorVaginalDelivery] = useState<
    'prior_vbac' | 'prior_vaginal_before_cesarean' | 'no_prior_vaginal_delivery'
  >(existingEpisode?.prior_vaginal_delivery ?? 'prior_vbac');
  const [indicationForPriorCesarean, setIndicationForPriorCesarean] = useState<string>(
    existingEpisode?.indication_for_prior_cesarean ?? 'Breech presentation',
  );
  const [interdeliveryIntervalMonths, setInterdeliveryIntervalMonths] = useState<number>(
    existingEpisode?.interdelivery_interval_months ?? 28,
  );
  const [bishopScore, setBishopScore] = useState<number>(
    existingEpisode?.bishop_score ?? 7,
  );
  const [efmAbnormality, setEfmAbnormality] = useState<
    'normal_category_1' | 'indeterminate_category_2' | 'variable_decelerations_recurrent' | 'prolonged_deceleration' | 'persistent_bradycardia_lt_90'
  >(existingEpisode?.efm_abnormality ?? 'normal_category_1');
  const [iupcLossOfUterineTone, setIupcLossOfUterineTone] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.iupc_loss_of_uterine_tone) : false,
  );
  const [acuteScarTenderness, setAcuteScarTenderness] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.acute_scar_tenderness) : false,
  );
  const [vaginalBleedingFresh, setVaginalBleedingFresh] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vaginal_bleeding_fresh) : false,
  );
  const [cessationOfContractions, setCessationOfContractions] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.cessation_of_contractions) : false,
  );
  const [presentingPartRetraction, setPresentingPartRetraction] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.presenting_part_retraction) : false,
  );
  const [status, setStatus] = useState<
    'eligible_tolac_counseled' | 'active_labor_efm_monitoring' | 'impending_rupture_detected' | 'crash_cesarean_transfer' | 'successful_vbac' | 'elective_repeat_cesarean'
  >(existingEpisode?.status ?? 'active_labor_efm_monitoring');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<ObstetricTolacResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateObstetricTolac({
        gestationalAgeWeeks: Number(gestationalAgeWeeks) || 39.0,
        maternalAge: Number(maternalAge) || 30,
        maternalBmi: Number(maternalBmi) || 25,
        priorCesareanCount: Number(priorCesareanCount) || 1,
        priorUterineIncisionType,
        priorVaginalDelivery,
        indicationForPriorCesarean,
        interdeliveryIntervalMonths: Number(interdeliveryIntervalMonths) || 24,
        bishopScore: Number(bishopScore) || 5,
        efmAbnormality,
        iupcLossOfUterineTone,
        acuteScarTenderness,
        vaginalBleedingFresh,
        cessationOfContractions,
        presentingPartRetraction,
      });
      setEvaluation(res);
    } catch {
      setEvaluation(null);
    }
  }, [
    gestationalAgeWeeks,
    maternalAge,
    maternalBmi,
    priorCesareanCount,
    priorUterineIncisionType,
    priorVaginalDelivery,
    indicationForPriorCesarean,
    interdeliveryIntervalMonths,
    bishopScore,
    efmAbnormality,
    iupcLossOfUterineTone,
    acuteScarTenderness,
    vaginalBleedingFresh,
    cessationOfContractions,
    presentingPartRetraction,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createObstetricTolacEpisode({
        patientId,
        assessmentDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        maternalAge: Number(maternalAge),
        maternalBmi: Number(maternalBmi),
        priorCesareanCount: Number(priorCesareanCount),
        priorUterineIncisionType,
        priorVaginalDelivery,
        indicationForPriorCesarean,
        interdeliveryIntervalMonths: Number(interdeliveryIntervalMonths),
        bishopScore: Number(bishopScore),
        efmAbnormality,
        iupcLossOfUterineTone,
        acuteScarTenderness,
        vaginalBleedingFresh,
        cessationOfContractions,
        presentingPartRetraction,
        status,
        clinicalNotes: clinicalNotes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save TOLAC episode');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🤰</span>
            <div>
              <h2 className="text-lg font-bold">
                {existingEpisode ? 'Edit TOLAC / VBAC Episode' : 'Obstetric Trial of Labor After Cesarean (TOLAC) Protocol'}
              </h2>
              <p className="text-xs text-emerald-200">
                ACOG Practice Bulletin No. 205 & Grobman VBAC Success Probability Calculator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-emerald-200 text-2xl font-bold p-1 leading-none"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Quick Engine Calculation Badge */}
          {evaluation && (
            <div className={`p-4 rounded-xl border ${
              evaluation.isCrashCesareanIndicated
                ? 'bg-red-50 border-red-300'
                : evaluation.hasContraindications
                ? 'bg-amber-50 border-amber-300'
                : 'bg-emerald-50 border-emerald-300'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    evaluation.isCrashCesareanIndicated
                      ? 'bg-red-600 text-white animate-pulse'
                      : evaluation.hasContraindications
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {evaluation.isCrashCesareanIndicated ? 'CRASH CESAREAN INDICATED' : evaluation.ruptureRiskTier.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="ml-2 text-sm font-bold text-gray-800">
                    Grobman VBAC Success Probability: {evaluation.grobmanVbacSuccessPct}%
                  </span>
                </div>
                <div className="text-xs font-semibold text-gray-700">
                  {evaluation.ruptureRiskTierLabel}
                </div>
              </div>
              {evaluation.alerts.length > 0 && (
                <div className="mt-2 text-xs text-red-700 font-semibold space-y-0.5 pt-2 border-t border-red-200">
                  {evaluation.alerts.map((alt, i) => (
                    <div key={i}>⚠️ {alt}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Demographics & Prior Obstetric History */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <span>📋</span> Prior Obstetric History & Incision Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Assessment Time *</label>
                <input
                  type="datetime-local"
                  value={assessmentDatetime}
                  onChange={(e) => setAssessmentDatetime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">GA (weeks) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="32"
                  max="43"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Maternal Age (years) *</label>
                <input
                  type="number"
                  min="14"
                  max="55"
                  value={maternalAge}
                  onChange={(e) => setMaternalAge(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Maternal BMI (kg/m²) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="15"
                  max="60"
                  value={maternalBmi}
                  onChange={(e) => setMaternalBmi(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Prior Uterine Incision *</label>
                <select
                  value={priorUterineIncisionType}
                  onChange={(e) => setPriorUterineIncisionType(e.target.value as any)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="low_transverse">Low Transverse (Standard, ~0.5-0.9% risk)</option>
                  <option value="unknown_low_transverse_presumed">Unknown (Presumed Low Transverse)</option>
                  <option value="classical_vertical">Classical Fundal / Vertical (CONTRAINDICATED, 4-10%)</option>
                  <option value="inverted_t_or_j">Inverted T or J extension (CONTRAINDICATED)</option>
                  <option value="prior_transmural_myomectomy">Prior Transmural Myomectomy (HIGH RISK)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Prior Vaginal Delivery *</label>
                <select
                  value={priorVaginalDelivery}
                  onChange={(e) => setPriorVaginalDelivery(e.target.value as any)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="prior_vbac">Prior Successful VBAC (+18% Grobman)</option>
                  <option value="prior_vaginal_before_cesarean">Prior Vaginal Delivery Before Cesarean</option>
                  <option value="no_prior_vaginal_delivery">No Prior Vaginal Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Prior Cesarean Count</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={priorCesareanCount}
                  onChange={(e) => setPriorCesareanCount(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Indication for Prior CS</label>
                <input
                  type="text"
                  value={indicationForPriorCesarean}
                  onChange={(e) => setIndicationForPriorCesarean(e.target.value)}
                  placeholder="e.g. Breech, Arrest of dilation"
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Interdelivery Interval (months)</label>
                <input
                  type="number"
                  min="6"
                  max="240"
                  value={interdeliveryIntervalMonths}
                  onChange={(e) => setInterdeliveryIntervalMonths(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Admission Bishop Score (0-13)</label>
                <input
                  type="number"
                  min="0"
                  max="13"
                  value={bishopScore}
                  onChange={(e) => setBishopScore(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Impending Rupture Triad & EFM Tracing */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/30 space-y-4">
            <h3 className="text-sm font-semibold text-red-900 uppercase tracking-wider flex items-center gap-2">
              <span>🚨</span> Impending Uterine Rupture Signs & EFM Continuous Tracing
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-700">EFM Fetal Tracing Abnormality *</label>
              <select
                value={efmAbnormality}
                onChange={(e) => setEfmAbnormality(e.target.value as any)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="normal_category_1">Category 1 (Normal FHR baseline 110-160, moderate variability)</option>
                <option value="indeterminate_category_2">Category 2 (Indeterminate, minimal/absent accelerations)</option>
                <option value="variable_decelerations_recurrent">Recurrent Variable Decelerations</option>
                <option value="prolonged_deceleration">Prolonged Deceleration (&gt; 2 minutes)</option>
                <option value="persistent_bradycardia_lt_90">Persistent Severe Bradycardia &lt; 90 bpm (Hallmark)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center space-x-2 text-xs text-red-900 font-bold">
                <input
                  type="checkbox"
                  checked={acuteScarTenderness}
                  onChange={(e) => setAcuteScarTenderness(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Acute Lower Uterine Segment Scar Tenderness</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-red-900 font-bold">
                <input
                  type="checkbox"
                  checked={iupcLossOfUterineTone}
                  onChange={(e) => setIupcLossOfUterineTone(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Loss of Uterine Tone on IUPC / "Staircase to the Grave"</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-red-900 font-bold">
                <input
                  type="checkbox"
                  checked={vaginalBleedingFresh}
                  onChange={(e) => setVaginalBleedingFresh(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Fresh Overt Vaginal Bleeding / Maternal Shock</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-red-900 font-bold">
                <input
                  type="checkbox"
                  checked={cessationOfContractions}
                  onChange={(e) => setCessationOfContractions(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Abrupt Cessation of Previously Active Contractions</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-red-900 font-bold">
                <input
                  type="checkbox"
                  checked={presentingPartRetraction}
                  onChange={(e) => setPresentingPartRetraction(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Retraction of Fetal Presenting Part (Pathognomonic)</span>
              </label>
            </div>
          </div>

          {/* Section 3: Status & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Labor / TOLAC Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="eligible_tolac_counseled">Eligible TOLAC Counseled</option>
                <option value="active_labor_efm_monitoring">Active Labor EFM Monitoring</option>
                <option value="impending_rupture_detected">Impending Rupture Detected</option>
                <option value="crash_cesarean_transfer">Transfer for Crash Category-1 CS</option>
                <option value="successful_vbac">Successful Vaginal Birth (VBAC)</option>
                <option value="elective_repeat_cesarean">Elective Repeat Cesarean (ERCD)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Clinical Directives & Anesthesia Notes</label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="e.g. Epidural analgesia running, type and crossmatch 2 units PRBC on hold"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
              {submitting ? 'Saving...' : 'Save TOLAC Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
