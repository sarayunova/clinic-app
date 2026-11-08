import React, { useState, useMemo } from 'react';
import {
  createPediatricAcuteScrotumEpisode,
  updatePediatricAcuteScrotumEpisode,
  type PediatricAcuteScrotumRecord,
} from '../api';
import {
  evaluatePediatricAcuteScrotum,
  type ScrotumAffectedSide,
  type DopplerScrotalFindings,
  type IntraoperativeFindings,
} from '../pediatricAcuteScrotumEngine';

interface Props {
  patientId: number;
  initialEpisode?: PediatricAcuteScrotumRecord | null;
  onClose: () => void;
  onSuccess: (newId?: number) => void;
}

export const PediatricAcuteScrotumModal: React.FC<Props> = ({
  patientId,
  initialEpisode,
  onClose,
  onSuccess,
}) => {
  const [ageYears, setAgeYears] = useState(initialEpisode?.age_years ?? 12);
  const [affectedSide, setAffectedSide] = useState<ScrotumAffectedSide>(
    initialEpisode?.affected_side ?? 'left'
  );
  const [symptomDurationHours, setSymptomDurationHours] = useState(
    initialEpisode?.symptom_duration_hours ?? 3.5
  );

  // TWIST Score Components
  const [twistTestisSwelling, setTwistTestisSwelling] = useState(
    initialEpisode?.twist_testis_swelling ?? 2
  );
  const [twistHardTestis, setTwistHardTestis] = useState(
    initialEpisode?.twist_hard_testis ?? 2
  );
  const [twistAbsentCremastericReflex, setTwistAbsentCremastericReflex] = useState(
    initialEpisode?.twist_absent_cremasteric_reflex ?? 1
  );
  const [twistNauseaVomiting, setTwistNauseaVomiting] = useState(
    initialEpisode?.twist_nausea_vomiting ?? 1
  );
  const [twistHighRidingTestis, setTwistHighRidingTestis] = useState(
    initialEpisode?.twist_high_riding_testis ?? 1
  );

  const [dopplerUltrasoundPerformed, setDopplerUltrasoundPerformed] = useState(
    Boolean(initialEpisode?.doppler_ultrasound_performed ?? false)
  );
  const [dopplerFindings, setDopplerFindings] = useState<DopplerScrotalFindings>(
    initialEpisode?.doppler_findings ?? 'not_performed'
  );
  const [manualDetorsionAttempted, setManualDetorsionAttempted] = useState(
    Boolean(initialEpisode?.manual_detorsion_attempted ?? false)
  );
  const [surgicalExplorationPerformed, setSurgicalExplorationPerformed] = useState(
    Boolean(initialEpisode?.surgical_exploration_performed ?? false)
  );
  const [intraoperativeFindings, setIntraoperativeFindings] = useState<IntraoperativeFindings>(
    initialEpisode?.intraoperative_findings ?? 'preop_evaluation'
  );
  const [bilateralOrchiopexyPerformed, setBilateralOrchiopexyPerformed] = useState(
    Boolean(initialEpisode?.bilateral_orchiopexy_performed ?? false)
  );
  const [status, setStatus] = useState<PediatricAcuteScrotumRecord['status']>(
    initialEpisode?.status ?? 'emergency_triage_under_6h'
  );
  const [clinicalNotes, setClinicalNotes] = useState(
    initialEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live calculation of TWIST Score and directives
  const evaluation = useMemo(() => {
    return evaluatePediatricAcuteScrotum({
      ageYears,
      affectedSide,
      symptomDurationHours,
      twistTestisSwelling,
      twistHardTestis,
      twistAbsentCremastericReflex,
      twistNauseaVomiting,
      twistHighRidingTestis,
      dopplerUltrasoundPerformed,
      dopplerFindings,
      manualDetorsionAttempted,
      surgicalExplorationPerformed,
      intraoperativeFindings,
      bilateralOrchiopexyPerformed,
    });
  }, [
    ageYears,
    affectedSide,
    symptomDurationHours,
    twistTestisSwelling,
    twistHardTestis,
    twistAbsentCremastericReflex,
    twistNauseaVomiting,
    twistHighRidingTestis,
    dopplerUltrasoundPerformed,
    dopplerFindings,
    manualDetorsionAttempted,
    surgicalExplorationPerformed,
    intraoperativeFindings,
    bilateralOrchiopexyPerformed,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: initialEpisode?.admission_id ?? null,
      onsetDatetime: initialEpisode?.onset_datetime ?? new Date().toISOString(),
      ageYears: Number(ageYears),
      affectedSide,
      symptomDurationHours: Number(symptomDurationHours),
      twistTestisSwelling: Number(twistTestisSwelling),
      twistHardTestis: Number(twistHardTestis),
      twistAbsentCremastericReflex: Number(twistAbsentCremastericReflex),
      twistNauseaVomiting: Number(twistNauseaVomiting),
      twistHighRidingTestis: Number(twistHighRidingTestis),
      dopplerUltrasoundPerformed,
      dopplerFindings,
      manualDetorsionAttempted,
      surgicalExplorationPerformed,
      intraoperativeFindings,
      bilateralOrchiopexyPerformed,
      status,
      clinicalNotes: clinicalNotes || undefined,
    };

    try {
      if (initialEpisode) {
        await updatePediatricAcuteScrotumEpisode(initialEpisode.id, payload);
        onSuccess(initialEpisode.id);
      } else {
        const res = await createPediatricAcuteScrotumEpisode(payload);
        onSuccess(res.episode.id);
      }
    } catch (err: any) {
      console.error('Failed to save acute scrotum episode:', err);
      setError(err?.message || 'Failed to save acute scrotum episode');
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
              <span>🩻</span>{' '}
              {initialEpisode ? 'Edit Pediatric Acute Scrotum Episode' : 'New Pediatric Acute Scrotum Episode'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AUA / ESPU / AAP Guidelines: TWIST Score (0–7) • 6-Hour Golden Salvage Window • Bilateral Dartos Orchiopexy
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

        {/* Live TWIST Score Banner */}
        <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              TWIST Score: {evaluation.twistScoreTotal}/7
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  evaluation.twistRiskCategory === 'high_risk'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 animate-pulse'
                    : evaluation.twistRiskCategory === 'intermediate_risk'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                }`}
              >
                {evaluation.twistRiskCategoryLabel}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Window: {evaluation.salvageProbabilityEstimate}
              </span>
            </div>
          </div>

          {evaluation.isImmediateSurgeryMandated && (
            <div className="p-2 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <span>🚨</span> IMMEDIATE OPERATING ROOM EXPLORATION MANDATED: High-risk TWIST score (5–7). Do NOT wait for ultrasound!
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
                Patient Age (years)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="21"
                required
                value={ageYears}
                onChange={(e) => setAgeYears(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Affected Side
              </label>
              <select
                value={affectedSide}
                onChange={(e) => setAffectedSide(e.target.value as ScrotumAffectedSide)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="left">Left Scrotum</option>
                <option value="right">Right Scrotum</option>
                <option value="bilateral">Bilateral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Symptom Duration (hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="168"
                required
                value={symptomDurationHours}
                onChange={(e) => setSymptomDurationHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
              <span className="text-[10px] text-slate-500">&le; 6h = Golden Window (&gt;90% salvage)</span>
            </div>
          </div>

          {/* TWIST Score 5 Predictors */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              TWIST Score Criteria (Validated Clinical Predictors)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Testis Swelling
                </label>
                <select
                  value={twistTestisSwelling}
                  onChange={(e) => setTwistTestisSwelling(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value={2}>Present (+2 pts)</option>
                  <option value={0}>Absent (0 pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Hard Testis
                </label>
                <select
                  value={twistHardTestis}
                  onChange={(e) => setTwistHardTestis(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value={2}>Present (+2 pts)</option>
                  <option value={0}>Absent (0 pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. Absent Cremasteric
                </label>
                <select
                  value={twistAbsentCremastericReflex}
                  onChange={(e) => setTwistAbsentCremastericReflex(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value={1}>Absent (+1 pt)</option>
                  <option value={0}>Present (0 pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  4. Nausea / Vomiting
                </label>
                <select
                  value={twistNauseaVomiting}
                  onChange={(e) => setTwistNauseaVomiting(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value={1}>Present (+1 pt)</option>
                  <option value={0}>Absent (0 pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  5. High-Riding Testis
                </label>
                <select
                  value={twistHighRidingTestis}
                  onChange={(e) => setTwistHighRidingTestis(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value={1}>Present (+1 pt)</option>
                  <option value={0}>Absent (0 pts)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Diagnostic & Surgical Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dopplerUltrasoundPerformed}
                    onChange={(e) => setDopplerUltrasoundPerformed(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Color Doppler Duplex Ultrasound Performed</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Doppler Ultrasound Findings
                </label>
                <select
                  value={dopplerFindings}
                  onChange={(e) => setDopplerFindings(e.target.value as DopplerScrotalFindings)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="not_performed">Not Performed / Bypassed to OR</option>
                  <option value="absent_arterial_flow_torsion_confirmed">Absent Intratesticular Flow (Torsion Confirmed)</option>
                  <option value="decreased_flow_partial_torsion">Decreased / High Resistance Flow (Partial Torsion)</option>
                  <option value="normal_flow_appendix_torsion_blue_dot">Normal Flow (Appendix Testis Torsion / Blue Dot)</option>
                  <option value="increased_hyperemic_flow_epididymo_orchitis">Hyperemic Flow (Epididymo-Orchitis)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualDetorsionAttempted}
                    onChange={(e) => setManualDetorsionAttempted(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Open-Book Manual Detorsion Attempted (Medial-to-Lateral)</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surgicalExplorationPerformed}
                    onChange={(e) => setSurgicalExplorationPerformed(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Surgical Scrotal Exploration Performed</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intraoperative Findings
                </label>
                <select
                  value={intraoperativeFindings}
                  onChange={(e) => setIntraoperativeFindings(e.target.value as IntraoperativeFindings)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="preop_evaluation">Pre-op Evaluation Pending</option>
                  <option value="viable_testis_after_detorsion">Viable Testis After Warm Saline Detorsion</option>
                  <option value="necrotic_nonviable_orchiectomy_performed">Necrotic Non-Viable (Orchiectomy Performed)</option>
                  <option value="torsion_appendix_testis_excised">Torsion of Appendix Testis Excised</option>
                  <option value="normal_testis_epididymitis_managed">Normal Testis (Epididymitis Managed)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bilateralOrchiopexyPerformed}
                    onChange={(e) => setBilateralOrchiopexyPerformed(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                    Bilateral 3-Point Dartos Orchiopexy Performed (Mandatory)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Triage / Clinical Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PediatricAcuteScrotumRecord['status'])}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="emergency_triage_under_6h">Emergency Triage (&le; 6h Salvage Window)</option>
                <option value="urgent_ultrasound_intermediate_risk">Urgent Ultrasound (Intermediate Risk)</option>
                <option value="in_operating_room_exploration">In Operating Room Exploration</option>
                <option value="postop_scrotal_support_recovery">Post-op Scrotal Support &amp; Recovery</option>
                <option value="resolved_discharged_home">Resolved / Discharged Home</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Surgical &amp; Clinical Notes
              </label>
              <textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Document cord rotations (e.g. 720 degrees clockwise), parenchymal bleeding test, suture type used..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
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
              {saving ? 'Saving...' : initialEpisode ? 'Update Episode' : 'Create Acute Scrotum Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
