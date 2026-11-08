import React, { useState, useMemo } from 'react';
import {
  createObstetricHyperemesisEpisode,
  updateObstetricHyperemesisEpisode,
  type ObstetricHyperemesisRecord,
} from '../api';
import {
  evaluateObstetricHyperemesis,
  type KetonuriaDipstick,
  type AntiemeticTier,
} from '../obstetricHyperemesisEngine';

interface Props {
  patientId: number;
  initialEpisode?: ObstetricHyperemesisRecord | null;
  onClose: () => void;
  onSuccess: (newId?: number) => void;
}

export const ObstetricHyperemesisModal: React.FC<Props> = ({
  patientId,
  initialEpisode,
  onClose,
  onSuccess,
}) => {
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(
    initialEpisode?.gestational_age_weeks ?? 9.5
  );
  const [puqeNauseaHours, setPuqeNauseaHours] = useState(
    initialEpisode?.puqe_nausea_hours ?? 4
  );
  const [puqeVomitingEpisodes, setPuqeVomitingEpisodes] = useState(
    initialEpisode?.puqe_vomiting_episodes ?? 4
  );
  const [puqeRetchingEpisodes, setPuqeRetchingEpisodes] = useState(
    initialEpisode?.puqe_retching_episodes ?? 4
  );
  const [weightLossPercent, setWeightLossPercent] = useState(
    initialEpisode?.weight_loss_percent ?? 7.2
  );
  const [ketonuriaLevel, setKetonuriaLevel] = useState<KetonuriaDipstick>(
    initialEpisode?.ketonuria_level ?? 'three_plus'
  );
  const [serumPotassiumMmolL, setSerumPotassiumMmolL] = useState(
    initialEpisode?.serum_potassium_mmol_l ?? 3.1
  );
  const [serumSodiumMmolL, setSerumSodiumMmolL] = useState(
    initialEpisode?.serum_sodium_mmol_l ?? 132
  );
  const [serumChlorideMmolL, setSerumChlorideMmolL] = useState(
    initialEpisode?.serum_chloride_mmol_l ?? 92
  );
  const [bicarbonateMmolL, setBicarbonateMmolL] = useState(
    initialEpisode?.bicarbonate_mmol_l ?? 31
  );
  const [parenteralThiamineGivenBeforeDextrose, setParenteralThiamineGivenBeforeDextrose] =
    useState(Boolean(initialEpisode?.parenteral_thiamine_given_before_dextrose ?? true));
  const [wernickeTriadSymptomsPresent, setWernickeTriadSymptomsPresent] = useState(
    Boolean(initialEpisode?.wernicke_triad_symptoms_present ?? false)
  );
  const [currentAntiemeticTier, setCurrentAntiemeticTier] = useState<AntiemeticTier>(
    initialEpisode?.current_antiemetic_tier ?? 'tier_2_dimenhydrinate_or_metoclopramide'
  );
  const [thromboprophylaxisLmwhPrescribed, setThromboprophylaxisLmwhPrescribed] = useState(
    Boolean(initialEpisode?.thromboprophylaxis_lmwh_prescribed ?? true)
  );
  const [status, setStatus] = useState<ObstetricHyperemesisRecord['status']>(
    initialEpisode?.status ?? 'inpatient_iv_hydration_thiamine'
  );
  const [clinicalNotes, setClinicalNotes] = useState(
    initialEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live evaluation preview
  const evaluation = useMemo(() => {
    return evaluateObstetricHyperemesis({
      gestationalAgeWeeks,
      puqeNauseaHours,
      puqeVomitingEpisodes,
      puqeRetchingEpisodes,
      weightLossPercent,
      ketonuriaLevel,
      serumPotassiumMmolL,
      serumSodiumMmolL,
      serumChlorideMmolL,
      bicarbonateMmolL,
      parenteralThiamineGivenBeforeDextrose,
      wernickeTriadSymptomsPresent,
      currentAntiemeticTier,
      thromboprophylaxisLmwhPrescribed,
    });
  }, [
    gestationalAgeWeeks,
    puqeNauseaHours,
    puqeVomitingEpisodes,
    puqeRetchingEpisodes,
    weightLossPercent,
    ketonuriaLevel,
    serumPotassiumMmolL,
    serumSodiumMmolL,
    serumChlorideMmolL,
    bicarbonateMmolL,
    parenteralThiamineGivenBeforeDextrose,
    wernickeTriadSymptomsPresent,
    currentAntiemeticTier,
    thromboprophylaxisLmwhPrescribed,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: initialEpisode?.admission_id ?? null,
      onsetDatetime: initialEpisode?.onset_datetime ?? new Date().toISOString(),
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      puqeNauseaHours: Number(puqeNauseaHours),
      puqeVomitingEpisodes: Number(puqeVomitingEpisodes),
      puqeRetchingEpisodes: Number(puqeRetchingEpisodes),
      weightLossPercent: Number(weightLossPercent),
      ketonuriaLevel,
      serumPotassiumMmolL: Number(serumPotassiumMmolL),
      serumSodiumMmolL: Number(serumSodiumMmolL),
      serumChlorideMmolL: Number(serumChlorideMmolL),
      bicarbonateMmolL: Number(bicarbonateMmolL),
      parenteralThiamineGivenBeforeDextrose,
      wernickeTriadSymptomsPresent,
      currentAntiemeticTier,
      thromboprophylaxisLmwhPrescribed,
      status,
      clinicalNotes: clinicalNotes || undefined,
    };

    try {
      if (initialEpisode) {
        await updateObstetricHyperemesisEpisode(initialEpisode.id, payload);
        onSuccess(initialEpisode.id);
      } else {
        const res = await createObstetricHyperemesisEpisode(payload);
        onSuccess(res.episode.id);
      }
    } catch (err: any) {
      console.error('Failed to save hyperemesis episode:', err);
      setError(err?.message || 'Failed to save hyperemesis episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-6 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🤰</span>{' '}
              {initialEpisode ? 'Edit Hyperemesis Gravidarum Episode' : 'New Hyperemesis Gravidarum Episode'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ACOG Practice Bulletin No. 189 / RCOG No. 69: PUQE-24 Scoring • Mandatory Thiamine • Electrolyte Restoration
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        {/* Live Evaluation Preview Banner */}
        <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              PUQE-24 Total Score: {evaluation.puqeScoreTotal}/15
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                evaluation.puqeSeverityCategory === 'severe'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                  : evaluation.puqeSeverityCategory === 'moderate'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
              }`}
            >
              {evaluation.puqeSeverityLabel}
            </span>
          </div>

          {!parenteralThiamineGivenBeforeDextrose && (
            <div className="p-2 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <span>🚨</span> WERNICKE ENCEPHALOPATHY HAZARD: Thiamine 100 mg IV must be administered BEFORE any dextrose!
            </div>
          )}

          {evaluation.alerts.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-rose-800 dark:text-rose-300 space-y-0.5">
              {evaluation.alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gestational Age (weeks)
              </label>
              <input
                type="number"
                step="0.1"
                min="4"
                max="42"
                required
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Weight Loss (% pre-pregnancy)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                required
                value={weightLossPercent}
                onChange={(e) => setWeightLossPercent(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-500">&gt; 5% defines significant starvation</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ketonuria Dipstick
              </label>
              <select
                value={ketonuriaLevel}
                onChange={(e) => setKetonuriaLevel(e.target.value as KetonuriaDipstick)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="negative">Negative</option>
                <option value="trace">Trace</option>
                <option value="one_plus">1+ (30 mg/dL)</option>
                <option value="two_plus">2+ (80 mg/dL)</option>
                <option value="three_plus">3+ (160 mg/dL)</option>
                <option value="four_plus">4+ (&ge; 300 mg/dL)</option>
              </select>
            </div>
          </div>

          {/* PUQE-24 3 Component Inputs */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              PUQE-24 Score Components (Past 24 Hours)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Nausea Duration
                </label>
                <select
                  value={puqeNauseaHours}
                  onChange={(e) => setPuqeNauseaHours(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value={1}>1: Not at all</option>
                  <option value={2}>2: &le; 1 hour</option>
                  <option value={3}>3: 2 to 3 hours</option>
                  <option value={4}>4: 4 to 6 hours</option>
                  <option value={5}>5: &gt; 6 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Vomiting Episodes
                </label>
                <select
                  value={puqeVomitingEpisodes}
                  onChange={(e) => setPuqeVomitingEpisodes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value={1}>1: None</option>
                  <option value={2}>2: 1 to 2 times</option>
                  <option value={3}>3: 3 to 4 times</option>
                  <option value={4}>4: 5 to 6 times</option>
                  <option value={5}>5: 7 or more times</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. Retching / Dry Heaves
                </label>
                <select
                  value={puqeRetchingEpisodes}
                  onChange={(e) => setPuqeRetchingEpisodes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value={1}>1: None</option>
                  <option value={2}>2: 1 to 2 times</option>
                  <option value={3}>3: 3 to 4 times</option>
                  <option value={4}>4: 5 to 6 times</option>
                  <option value={5}>5: 7 or more times</option>
                </select>
              </div>
            </div>
          </div>

          {/* Electrolytes & Acid Base */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum K+ (mmol/L)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="8"
                required
                value={serumPotassiumMmolL}
                onChange={(e) => setSerumPotassiumMmolL(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum Na+ (mmol/L)
              </label>
              <input
                type="number"
                step="0.5"
                min="100"
                max="170"
                required
                value={serumSodiumMmolL}
                onChange={(e) => setSerumSodiumMmolL(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum Cl- (mmol/L)
              </label>
              <input
                type="number"
                step="0.5"
                min="60"
                max="140"
                required
                value={serumChlorideMmolL}
                onChange={(e) => setSerumChlorideMmolL(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                HCO3- (mmol/L)
              </label>
              <input
                type="number"
                step="0.5"
                min="10"
                max="50"
                required
                value={bicarbonateMmolL}
                onChange={(e) => setBicarbonateMmolL(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Safety Toggles: Thiamine, Wernicke, Antiemetic Tier, LMWH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parenteralThiamineGivenBeforeDextrose}
                  onChange={(e) => setParenteralThiamineGivenBeforeDextrose(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                  Thiamine 100 mg IV Given BEFORE Any Dextrose (Mandatory)
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wernickeTriadSymptomsPresent}
                  onChange={(e) => setWernickeTriadSymptomsPresent(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-rose-700 dark:text-rose-300">
                  Wernicke Triad Symptoms Present (Confusion, Ataxia, Nystagmus)
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={thromboprophylaxisLmwhPrescribed}
                  onChange={(e) => setThromboprophylaxisLmwhPrescribed(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>LMWH Thromboprophylaxis Prescribed (Enoxaparin / Dalteparin)</span>
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Antiemetic Escalation Tier
                </label>
                <select
                  value={currentAntiemeticTier}
                  onChange={(e) => setCurrentAntiemeticTier(e.target.value as AntiemeticTier)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="tier_1_doxylamine_pyridoxine">Tier 1: Doxylamine + Pyridoxine (B6)</option>
                  <option value="tier_2_dimenhydrinate_or_metoclopramide">Tier 2: Dimenhydrinate / Metoclopramide / Promethazine</option>
                  <option value="tier_3_ondansetron_5ht3_antagonist">Tier 3: Ondansetron (5-HT3 Antagonist)</option>
                  <option value="tier_4_corticosteroid_methylprednisolone_pulse">Tier 4: Methylprednisolone Pulse (&gt;10 wks)</option>
                  <option value="refractory_enteral_jejunostomy_tpn">Refractory: Enteral Tube / TPN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Protocol Care Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ObstetricHyperemesisRecord['status'])}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="inpatient_iv_hydration_thiamine">Inpatient IV Hydration &amp; Thiamine</option>
                  <option value="antiemetic_step_up_escalation">Antiemetic Step-Up Escalation</option>
                  <option value="corticosteroid_pulse_therapy">Corticosteroid Pulse Therapy</option>
                  <option value="oral_tolerance_dietary_reintroduction">Oral Tolerance &amp; Dietary Reintroduction</option>
                  <option value="outpatient_maintenance_surveillance">Outpatient Maintenance Surveillance</option>
                  <option value="resolved_discharged_home">Resolved / Discharged Home</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Notes &amp; Nutritional Plan
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Document dietary triggers, oral rehydration tolerance, electrolyte replacement schedule..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition"
            >
              {saving ? 'Saving...' : initialEpisode ? 'Update Episode' : 'Create HG Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
