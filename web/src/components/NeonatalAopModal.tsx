import React, { useState, useEffect } from 'react';
import {
  createNeonatalAopEpisode,
  type NeonatalAopRecord,
} from '../api';
import {
  evaluateNeonatalAop,
  type NeonatalAopEvaluationResult,
} from '../neonatalAopEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalAopRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalAopModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [onsetDatetime, setOnsetDatetime] = useState(
    existingEpisode?.onset_datetime || new Date().toISOString().slice(0, 16),
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    existingEpisode?.gestational_age_weeks ?? 30.0,
  );
  const [chronologicalAgeDays, setChronologicalAgeDays] = useState<number>(
    existingEpisode?.chronological_age_days ?? 8,
  );
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(
    existingEpisode?.current_weight_kg ?? 1.25,
  );
  const [apneaSubtype, setApneaSubtype] = useState<'mixed' | 'central' | 'obstructive'>(
    existingEpisode?.apnea_subtype ?? 'mixed',
  );
  const [apneaFrequencyPer24h, setApneaFrequencyPer24h] = useState<number>(
    existingEpisode?.apnea_frequency_per_24h ?? 4,
  );
  const [bradycardiaPresent, setBradycardiaPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.bradycardia_present) : true,
  );
  const [lowestHeartRateBpm, setLowestHeartRateBpm] = useState<string>(
    existingEpisode?.lowest_heart_rate_bpm?.toString() ?? '75',
  );
  const [desaturationPresent, setDesaturationPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.desaturation_present) : true,
  );
  const [lowestSpo2Percent, setLowestSpo2Percent] = useState<string>(
    existingEpisode?.lowest_spo2_percent?.toString() ?? '82',
  );
  const [stimulationRequired, setStimulationRequired] = useState<
    'self_resolved' | 'tactile_gentle' | 'vigorous_stimulation' | 'bag_mask_positive_pressure'
  >(existingEpisode?.stimulation_required ?? 'tactile_gentle');
  const [caffeineCitrateActive, setCaffeineCitrateActive] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.caffeine_citrate_active) : true,
  );
  const [caffeineLoadingDoseMgKg, setCaffeineLoadingDoseMgKg] = useState<number>(
    existingEpisode?.caffeine_loading_dose_mg_kg ?? 20.0,
  );
  const [caffeineMaintenanceDoseMgKgDay, setCaffeineMaintenanceDoseMgKgDay] = useState<number>(
    existingEpisode?.caffeine_maintenance_dose_mg_kg_day ?? 7.5,
  );
  const [serumCaffeineLevelMcgMl, setSerumCaffeineLevelMcgMl] = useState<string>(
    existingEpisode?.serum_caffeine_level_mcg_ml?.toString() ?? '',
  );
  const [secondaryCausesExcluded, setSecondaryCausesExcluded] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.secondary_causes_excluded) : true,
  );
  const [respiratorySupportMode, setRespiratorySupportMode] = useState<
    'room_air' | 'low_flow_nasal_cannula' | 'high_flow_hfnc' | 'bubble_cpap' | 'niv_nava' | 'invasive_mechanical_ventilation'
  >(existingEpisode?.respiratory_support_mode ?? 'bubble_cpap');
  const [cpapPeepCmh2o, setCpapPeepCmh2o] = useState<string>(
    existingEpisode?.cpap_peep_cmh2o?.toString() ?? '5.0',
  );
  const [apneaFreeDaysCount, setApneaFreeDaysCount] = useState<number>(
    existingEpisode?.apnea_free_days_count ?? 0,
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Real-time evaluation preview
  const [evaluation, setEvaluation] = useState<NeonatalAopEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateNeonatalAop({
        gestationalAgeWeeks,
        chronologicalAgeDays,
        currentWeightKg,
        apneaSubtype,
        apneaFrequencyPer24h,
        lowestHeartRateBpm: lowestHeartRateBpm ? Number(lowestHeartRateBpm) : undefined,
        lowestSpo2Percent: lowestSpo2Percent ? Number(lowestSpo2Percent) : undefined,
        stimulationRequired,
        caffeineCitrateActive,
        caffeineLoadingDoseMgKg,
        caffeineMaintenanceDoseMgKgDay,
        serumCaffeineLevelMcgMl: serumCaffeineLevelMcgMl ? Number(serumCaffeineLevelMcgMl) : undefined,
        secondaryCausesExcluded,
        respiratorySupportMode,
        cpapPeepCmh2o: cpapPeepCmh2o ? Number(cpapPeepCmh2o) : undefined,
        apneaFreeDaysCount,
      });
      setEvaluation(res);
    } catch (e: any) {
      // ignore
    }
  }, [
    gestationalAgeWeeks,
    chronologicalAgeDays,
    currentWeightKg,
    apneaSubtype,
    apneaFrequencyPer24h,
    lowestHeartRateBpm,
    lowestSpo2Percent,
    stimulationRequired,
    caffeineCitrateActive,
    caffeineLoadingDoseMgKg,
    caffeineMaintenanceDoseMgKgDay,
    serumCaffeineLevelMcgMl,
    secondaryCausesExcluded,
    respiratorySupportMode,
    cpapPeepCmh2o,
    apneaFreeDaysCount,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createNeonatalAopEpisode({
        patientId,
        onsetDatetime,
        gestationalAgeWeeks,
        chronologicalAgeDays,
        currentWeightKg,
        apneaSubtype,
        apneaFrequencyPer24h,
        bradycardiaPresent,
        lowestHeartRateBpm: lowestHeartRateBpm ? Number(lowestHeartRateBpm) : null,
        desaturationPresent,
        lowestSpo2Percent: lowestSpo2Percent ? Number(lowestSpo2Percent) : null,
        stimulationRequired,
        caffeineCitrateActive,
        caffeineLoadingDoseMgKg,
        caffeineMaintenanceDoseMgKgDay,
        serumCaffeineLevelMcgMl: serumCaffeineLevelMcgMl ? Number(serumCaffeineLevelMcgMl) : null,
        secondaryCausesExcluded,
        respiratorySupportMode,
        cpapPeepCmh2o: cpapPeepCmh2o ? Number(cpapPeepCmh2o) : null,
        apneaFreeDaysCount,
        status: 'active_treatment',
        clinicalNotes: clinicalNotes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Neonatal AOP protocol');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Neonatal Apnea of Prematurity (AOP) & Caffeine Citrate Protocol
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AAP & Cochrane Neonatal AOP / CAP Trial Clinical Decision Engine
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Real-time Calculation Summary Card */}
          {evaluation && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
              <div className="text-center md:text-left">
                <span className="text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-semibold">Post-Conceptional Age</span>
                <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                  {evaluation.postConceptionalAgeWeeks} wks
                </p>
                <span className="text-xs text-slate-500">Gest: {gestationalAgeWeeks}w + {chronologicalAgeDays}d</span>
              </div>
              <div className="text-center md:text-left">
                <span className="text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-semibold">AOP Severity Tier</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                  {evaluation.apneaSeverityTier.replace(/_/g, ' ')}
                </p>
                <span className="text-xs text-slate-500">{evaluation.apneaSeverityLabel}</span>
              </div>
              <div className="text-center md:text-left">
                <span className="text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-semibold">Caffeine Citrate Loading</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {evaluation.caffeineDosing.recommendedLoadingDoseMg} mg
                </p>
                <span className="text-xs text-slate-500">({evaluation.caffeineDosing.loadingDoseMgKg} mg/kg for {currentWeightKg} kg)</span>
              </div>
              <div className="text-center md:text-left">
                <span className="text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-semibold">Daily Maintenance</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {evaluation.caffeineDosing.recommendedDailyMaintenanceMg} mg/day
                </p>
                <span className="text-xs text-slate-500">({evaluation.caffeineDosing.maintenanceDoseMgKgDay} mg/kg/day q24h)</span>
              </div>
            </div>
          )}

          {/* Section 1: Infant Baseline & Timing */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              1. Infant Gestational & Chronological Age
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Protocol Onset Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={onsetDatetime}
                  onChange={(e) => setOnsetDatetime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Gestational Age (weeks)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="23"
                  max="37"
                  required
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 30.0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chronological Age (days)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="180"
                  required
                  value={chronologicalAgeDays}
                  onChange={(e) => setChronologicalAgeDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.4"
                  max="5.0"
                  required
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(parseFloat(e.target.value) || 1.0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Apnea Presentation & Severity */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              2. Apnea Presentation & Physiological Compromise
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Apnea Subtype
                </label>
                <select
                  value={apneaSubtype}
                  onChange={(e) => setApneaSubtype(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="mixed">Mixed (Central + Obstructive ~50%)</option>
                  <option value="central">Central (~40%)</option>
                  <option value="obstructive">Obstructive (~10%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Apnea Frequency / 24h
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  required
                  value={apneaFrequencyPer24h}
                  onChange={(e) => setApneaFrequencyPer24h(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lowest Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 75"
                  value={lowestHeartRateBpm}
                  onChange={(e) => setLowestHeartRateBpm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lowest SpO2 (%)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 82"
                  value={lowestSpo2Percent}
                  onChange={(e) => setLowestSpo2Percent(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Highest Stimulation Level Required
                </label>
                <select
                  value={stimulationRequired}
                  onChange={(e) => setStimulationRequired(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="self_resolved">Self-resolved without intervention</option>
                  <option value="tactile_gentle">Gentle tactile stimulation (rubbing soles)</option>
                  <option value="vigorous_stimulation">Vigorous stimulation & repositioning</option>
                  <option value="bag_mask_positive_pressure">Bag-mask positive pressure ventilation (PPV)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Respiratory Support Mode
                </label>
                <select
                  value={respiratorySupportMode}
                  onChange={(e) => setRespiratorySupportMode(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="room_air">Room Air</option>
                  <option value="low_flow_nasal_cannula">Low-Flow Nasal Cannula</option>
                  <option value="high_flow_hfnc">High Flow Nasal Cannula (HFNC)</option>
                  <option value="bubble_cpap">Bubble CPAP</option>
                  <option value="niv_nava">NIV / NAVA</option>
                  <option value="invasive_mechanical_ventilation">Invasive Mechanical Ventilation</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Caffeine Citrate Dosing & Monitoring */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              3. Caffeine Citrate Therapy & Serum Levels
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Loading Dose (mg/kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="10"
                  max="40"
                  value={caffeineLoadingDoseMgKg}
                  onChange={(e) => setCaffeineLoadingDoseMgKg(parseFloat(e.target.value) || 20.0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Dose (mg/kg/day)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="2.5"
                  max="25"
                  value={caffeineMaintenanceDoseMgKgDay}
                  onChange={(e) => setCaffeineMaintenanceDoseMgKgDay(parseFloat(e.target.value) || 7.5)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Serum Caffeine Level (mcg/mL) [Optional]
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Target: 8 - 20 mcg/mL"
                  value={serumCaffeineLevelMcgMl}
                  onChange={(e) => setSerumCaffeineLevelMcgMl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={caffeineCitrateActive}
                  onChange={(e) => setCaffeineCitrateActive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Caffeine Citrate Currently Active</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={secondaryCausesExcluded}
                  onChange={(e) => setSecondaryCausesExcluded(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Secondary Causes Excluded (Sepsis, Hypoglycemia, Seizures, Intracranial Hemorrhage)</span>
              </label>
            </div>
          </div>

          {/* Section 4: Weaning & Clinical Notes */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              4. Weaning Criteria & Clinical Notes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Apnea-Free Days Count
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={apneaFreeDaysCount}
                  onChange={(e) => setApneaFreeDaysCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Clinical & Nursing Notes
                </label>
                <input
                  type="text"
                  placeholder="Infant tolerance, feeding coordination, apnea event triggers..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Weaning Eligibility Status Banner */}
            {evaluation && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  evaluation.weaningEligibility.eligible
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                    : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                }`}
              >
                <span className="font-bold">
                  {evaluation.weaningEligibility.eligible ? '✓ WEANING ELIGIBLE:' : 'ℹ WEANING NOT ELIGIBLE:'}
                </span>
                <span>{evaluation.weaningEligibility.reason}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Initiating Protocol...' : 'Initiate AOP Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
