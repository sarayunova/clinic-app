import React, { useState, useEffect } from 'react';
import {
  createNeonatalSipEpisode,
  updateNeonatalSipEpisode,
  type NeonatalSipRecord,
} from '../api';
import {
  evaluateNeonatalSip,
  type NeonatalSipEvaluationResult,
  type SipDrainType,
  type SipSurgicalApproach,
} from '../neonatalSipEngine';

interface Props {
  patientId: number;
  initialEpisode?: NeonatalSipRecord | null;
  existingEpisode?: NeonatalSipRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const NeonatalSipModal: React.FC<Props> = ({
  patientId,
  initialEpisode,
  existingEpisode,
  isOpen = true,
  onClose,
  onSuccess,
  onSaved,
}) => {
  if (!isOpen) return null;
  const currentEp = initialEpisode || existingEpisode;

  const [onsetDatetime, setOnsetDatetime] = useState(
    currentEp?.onset_datetime || new Date().toISOString().slice(0, 16)
  );
  const [ageDays, setAgeDays] = useState<number>(currentEp?.age_days ?? 7);
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(
    currentEp?.birth_weight_grams ?? 780
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    currentEp?.gestational_age_weeks ?? 26.2
  );
  const [antenatalOrEarlySteroidsExposed, setAntenatalOrEarlySteroidsExposed] = useState<boolean>(
    currentEp ? Boolean(currentEp.antenatal_or_early_steroids_exposed) : true
  );
  const [indomethacinOrIbuprofenPdaExposed, setIndomethacinOrIbuprofenPdaExposed] = useState<boolean>(
    currentEp ? Boolean(currentEp.indomethacin_or_ibuprofen_pda_exposed) : true
  );
  const [pneumoperitoneumConfirmed, setPneumoperitoneumConfirmed] = useState<boolean>(
    currentEp ? Boolean(currentEp.pneumoperitoneum_confirmed) : true
  );
  const [pneumatosisIntestinalisAbsent, setPneumatosisIntestinalisAbsent] = useState<boolean>(
    currentEp ? Boolean(currentEp.pneumatosis_intestinalis_absent) : true
  );
  const [portalVenousGasAbsent, setPortalVenousGasAbsent] = useState<boolean>(
    currentEp ? Boolean(currentEp.portal_venous_gas_absent) : true
  );
  const [abdominalWallBluishDiscoloration, setAbdominalWallBluishDiscoloration] = useState<boolean>(
    currentEp ? Boolean(currentEp.abdominal_wall_bluish_discoloration) : true
  );
  const [peritonealDrainagePerformed, setPeritonealDrainagePerformed] = useState<boolean>(
    currentEp ? Boolean(currentEp.peritoneal_drainage_performed) : true
  );
  const [drainType, setDrainType] = useState<SipDrainType>(
    currentEp?.drain_type ?? 'penrose_drain'
  );
  const [peritonealFluidYeastCandidaPositive, setPeritonealFluidYeastCandidaPositive] = useState<boolean>(
    currentEp ? Boolean(currentEp.peritoneal_fluid_yeast_candida_positive) : false
  );
  const [surgicalApproach, setSurgicalApproach] = useState<SipSurgicalApproach>(
    currentEp?.surgical_approach ?? 'bedside_primary_peritoneal_drainage'
  );
  const [status, setStatus] = useState<NeonatalSipRecord['status']>(
    currentEp?.status ?? 'acute_perforation_triage'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NeonatalSipEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateNeonatalSip({
        ageDays: Number(ageDays),
        birthWeightGrams: Number(birthWeightGrams),
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        antenatalOrEarlySteroidsExposed,
        indomethacinOrIbuprofenPdaExposed,
        pneumoperitoneumConfirmed,
        pneumatosisIntestinalisAbsent,
        portalVenousGasAbsent,
        abdominalWallBluishDiscoloration,
        peritonealDrainagePerformed,
        drainType,
        peritonealFluidYeastCandidaPositive,
        surgicalApproach,
        status,
      });
      setPreview(res);
    } catch {
      // preview calculation fallback
    }
  }, [
    ageDays,
    birthWeightGrams,
    gestationalAgeWeeks,
    antenatalOrEarlySteroidsExposed,
    indomethacinOrIbuprofenPdaExposed,
    pneumoperitoneumConfirmed,
    pneumatosisIntestinalisAbsent,
    portalVenousGasAbsent,
    abdominalWallBluishDiscoloration,
    peritonealDrainagePerformed,
    drainType,
    peritonealFluidYeastCandidaPositive,
    surgicalApproach,
    status,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: currentEp?.admission_id || null,
      onsetDatetime,
      ageDays: Number(ageDays),
      birthWeightGrams: Number(birthWeightGrams),
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      antenatalOrEarlySteroidsExposed,
      indomethacinOrIbuprofenPdaExposed,
      pneumoperitoneumConfirmed,
      pneumatosisIntestinalisAbsent,
      portalVenousGasAbsent,
      abdominalWallBluishDiscoloration,
      peritonealDrainagePerformed,
      drainType,
      peritonealFluidYeastCandidaPositive,
      surgicalApproach,
      status,
      clinicalNotes: clinicalNotes.trim() || null,
    };

    try {
      if (currentEp) {
        await updateNeonatalSipEpisode(currentEp.id, payload);
        if (onSuccess) onSuccess(currentEp.id);
      } else {
        const res = await createNeonatalSipEpisode(payload);
        if (onSuccess) onSuccess(res.episode.id);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save neonatal SIP episode:', err);
      setError(err?.message || 'Failed to save neonatal SIP episode record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-500/10 dark:bg-amber-500/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍼</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEp ? 'Update Neonatal SIP Episode' : 'New Spontaneous Intestinal Perforation (SIP) Protocol'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AAP / APSA Guidelines: ELBW &lt;1000g • Postnatal Steroid+NSAID Synergy • Bedside RLQ Peritoneal Drainage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Live Calculation Preview Banner */}
        {preview && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Diagnostic Stratification: {preview.sipConfidenceLabel}
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                {preview.urgencyTierLabel}
              </span>
            </div>
            {preview.alerts.length > 0 && (
              <div className="space-y-1 mt-2">
                {preview.alerts.map((alert, i) => (
                  <div key={i} className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <span>⚠️</span> {alert}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
              {error}
            </div>
          )}

          {/* Section 1: Demographics & Gestational Vulnerability */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              1. Demographics &amp; Perinatal Risk
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Perforation Onset Time
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={onsetDatetime}
                  onChange={(e) => setOnsetDatetime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Postnatal Age (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={ageDays}
                  onChange={(e) => setAgeDays(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Birth Weight (Grams)
                </label>
                <input
                  type="number"
                  min="300"
                  max="5000"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={birthWeightGrams}
                  onChange={(e) => setBirthWeightGrams(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">ELBW threshold &lt; 1,000 g</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Gestational Age (Weeks)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="22.0"
                  max="42.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Medication Exposure & Radiographic Triad */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              2. Medication Synergy &amp; Radiographic Profile
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={antenatalOrEarlySteroidsExposed}
                  onChange={(e) => setAntenatalOrEarlySteroidsExposed(e.target.checked)}
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Postnatal / Antenatal Steroid Exposure
                  </div>
                  <div className="text-[11px] text-slate-500">Dexamethasone/Hydrocortisone within past 7 days</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={indomethacinOrIbuprofenPdaExposed}
                  onChange={(e) => setIndomethacinOrIbuprofenPdaExposed(e.target.checked)}
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Indomethacin / Ibuprofen PDA Exposure
                  </div>
                  <div className="text-[11px] text-slate-500">Concomitant NSAID synergy confers 4× perforation risk</div>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={pneumoperitoneumConfirmed}
                  onChange={(e) => setPneumoperitoneumConfirmed(e.target.checked)}
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  Massive Pneumoperitoneum (&quot;Football Sign&quot;)
                </span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={pneumatosisIntestinalisAbsent}
                  onChange={(e) => setPneumatosisIntestinalisAbsent(e.target.checked)}
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  Pneumatosis Intestinalis ABSENT (Favors SIP)
                </span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={portalVenousGasAbsent}
                  onChange={(e) => setPortalVenousGasAbsent(e.target.checked)}
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  Portal Venous Gas ABSENT (Favors SIP)
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: Drainage & Surgical Approach */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              3. Peritoneal Drainage &amp; Surgical Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Primary Surgical Approach
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={surgicalApproach}
                  onChange={(e) => setSurgicalApproach(e.target.value as SipSurgicalApproach)}
                >
                  <option value="bedside_primary_peritoneal_drainage">Bedside Primary Peritoneal Drainage (PPD)</option>
                  <option value="urgent_exploratory_laparotomy">Urgent Exploratory Laparotomy</option>
                  <option value="delayed_laparotomy_post_drain_failure">Delayed Laparotomy (Post-Drain Failure)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Drain Device Selected
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={drainType}
                  onChange={(e) => setDrainType(e.target.value as SipDrainType)}
                >
                  <option value="penrose_drain">Penrose Drain (RLQ Bedside)</option>
                  <option value="chest_tube_10fr">10–12 Fr Chest Tube</option>
                  <option value="pigtail_catheter">Pigtail Multi-Perforated Catheter</option>
                  <option value="none_laparotomy_primary">None / Open Laparotomy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Protocol Status
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as NeonatalSipRecord['status'])}
                >
                  <option value="acute_perforation_triage">Acute Perforation Triage</option>
                  <option value="bedside_peritoneal_drain_active">Bedside Peritoneal Drain Active</option>
                  <option value="laparotomy_resection_enterostomy">Laparotomy Resection &amp; Enterostomy</option>
                  <option value="drain_weaning_resolution">Drain Weaning &amp; Resolution</option>
                  <option value="convalescent_enteral_feeding">Convalescent Enteral Feeding</option>
                  <option value="resolved_discharged">Resolved / Discharged</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={abdominalWallBluishDiscoloration}
                  onChange={(e) => setAbdominalWallBluishDiscoloration(e.target.checked)}
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  Bluish Abdominal Wall / Scrotal Sign
                </span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={peritonealDrainagePerformed}
                  onChange={(e) => setPeritonealDrainagePerformed(e.target.checked)}
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  Peritoneal Drainage Performed
                </span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-rose-600 focus:ring-rose-500"
                  checked={peritonealFluidYeastCandidaPositive}
                  onChange={(e) => setPeritonealFluidYeastCandidaPositive(e.target.checked)}
                />
                <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold">
                  Peritoneal Yeast / Candida POSITIVE
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              NICU &amp; Pediatric Surgical Log Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Document focal perforation site, Penrose drain insertion details, peritoneal fluid characteristics, systemic inotropic response..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : currentEp ? 'Update SIP Episode' : 'Create SIP Protocol'}
          </button>
        </div>
      </div>
    </div>
  );
};
