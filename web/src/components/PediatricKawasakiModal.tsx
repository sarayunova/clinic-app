import React, { useState, useEffect } from 'react';
import {
  createPediatricKawasakiEpisode,
  type PediatricKawasakiRecord,
} from '../api';
import {
  evaluatePediatricKawasaki,
  type PediatricKawasakiResult,
} from '../pediatricKawasakiEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricKawasakiRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricKawasakiModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [presentationDatetime, setPresentationDatetime] = useState(
    existingEpisode?.presentation_datetime || new Date().toISOString().slice(0, 16),
  );
  const [ageMonths, setAgeMonths] = useState<number>(
    existingEpisode?.age_months ?? 24,
  );
  const [weightKg, setWeightKg] = useState<number>(
    existingEpisode?.weight_kg ?? 12.5,
  );
  const [feverDurationDays, setFeverDurationDays] = useState<number>(
    existingEpisode?.fever_duration_days ?? 5,
  );

  // 5 Principal Criteria
  const [conjunctivitisBilateralBulbar, setConjunctivitisBilateralBulbar] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.conjunctivitis_bilateral_bulbar) : true,
  );
  const [oralMucosalChanges, setOralMucosalChanges] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.oral_mucosal_changes) : true,
  );
  const [polymorphousExanthemRash, setPolymorphousExanthemRash] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.polymorphous_exanthem_rash) : true,
  );
  const [peripheralExtremityChanges, setPeripheralExtremityChanges] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.peripheral_extremity_changes) : true,
  );
  const [cervicalLymphadenopathyGe15cm, setCervicalLymphadenopathyGe15cm] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.cervical_lymphadenopathy_ge_1_5cm) : false,
  );

  // Supplemental features
  const [bcgScarErythema, setBcgScarErythema] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.bcg_scar_erythema) : true,
  );
  const [perinealErythemaDesquamation, setPerinealErythemaDesquamation] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.perineal_erythema_desquamation) : true,
  );

  // Labs
  const [crpMgL, setCrpMgL] = useState<number>(
    existingEpisode?.crp_mg_l ?? 85.0,
  );
  const [esrMmHr, setEsrMmHr] = useState<number>(
    existingEpisode?.esr_mm_hr ?? 65.0,
  );
  const [serumAlbuminGDl, setSerumAlbuminGDl] = useState<string>(
    existingEpisode?.serum_albumin_g_dl?.toString() ?? '2.9',
  );
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<string>(
    existingEpisode?.serum_sodium_meq_l?.toString() ?? '131',
  );
  const [plateletCount, setPlateletCount] = useState<string>(
    existingEpisode?.platelet_count?.toString() ?? '280000',
  );
  const [wbcCount, setWbcCount] = useState<string>(
    existingEpisode?.wbc_count?.toString() ?? '16500',
  );
  const [altUL, setAltUL] = useState<string>(
    existingEpisode?.alt_u_l?.toString() ?? '110',
  );
  const [neutrophilPct, setNeutrophilPct] = useState<string>(
    existingEpisode?.neutrophil_pct?.toString() ?? '82',
  );
  const [sterilePyuriaPresent, setSterilePyuriaPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.sterile_pyuria_present) : true,
  );

  // Echocardiogram
  const [echoPerformed, setEchoPerformed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.echo_performed) : true,
  );
  const [ladZScore, setLadZScore] = useState<string>(
    existingEpisode?.lad_z_score?.toString() ?? '2.8',
  );
  const [rcaZScore, setRcaZScore] = useState<string>(
    existingEpisode?.rca_z_score?.toString() ?? '2.2',
  );

  const [status, setStatus] = useState<
    'active_diagnostic_workup' | 'ivig_infusion_in_progress' | 'afebrile_post_ivig_monitoring' | 'ivig_resistant_retreatment' | 'resolved_discharged'
  >(existingEpisode?.status ?? 'ivig_infusion_in_progress');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<PediatricKawasakiResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluatePediatricKawasaki({
        ageMonths: Number(ageMonths) || 12,
        weightKg: Number(weightKg) || 10,
        feverDurationDays: Number(feverDurationDays) || 5,
        conjunctivitisBilateralBulbar,
        oralMucosalChanges,
        polymorphousExanthemRash,
        peripheralExtremityChanges,
        cervicalLymphadenopathyGe15cm,
        bcgScarErythema,
        perinealErythemaDesquamation,
        crpMgL: Number(crpMgL) || 0,
        esrMmHr: Number(esrMmHr) || 0,
        serumAlbuminGDl: serumAlbuminGDl ? Number(serumAlbuminGDl) : undefined,
        serumSodiumMeqL: serumSodiumMeqL ? Number(serumSodiumMeqL) : undefined,
        plateletCount: plateletCount ? Number(plateletCount) : undefined,
        wbcCount: wbcCount ? Number(wbcCount) : undefined,
        altUL: altUL ? Number(altUL) : undefined,
        neutrophilPct: neutrophilPct ? Number(neutrophilPct) : undefined,
        sterilePyuriaPresent,
        echoPerformed,
        ladZScore: ladZScore ? Number(ladZScore) : undefined,
        rcaZScore: rcaZScore ? Number(rcaZScore) : undefined,
      });
      setEvaluation(res);
    } catch {
      setEvaluation(null);
    }
  }, [
    ageMonths,
    weightKg,
    feverDurationDays,
    conjunctivitisBilateralBulbar,
    oralMucosalChanges,
    polymorphousExanthemRash,
    peripheralExtremityChanges,
    cervicalLymphadenopathyGe15cm,
    bcgScarErythema,
    perinealErythemaDesquamation,
    crpMgL,
    esrMmHr,
    serumAlbuminGDl,
    serumSodiumMeqL,
    plateletCount,
    wbcCount,
    altUL,
    neutrophilPct,
    sterilePyuriaPresent,
    echoPerformed,
    ladZScore,
    rcaZScore,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createPediatricKawasakiEpisode({
        patientId,
        presentationDatetime,
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        feverDurationDays: Number(feverDurationDays),
        conjunctivitisBilateralBulbar,
        oralMucosalChanges,
        polymorphousExanthemRash,
        peripheralExtremityChanges,
        cervicalLymphadenopathyGe15cm,
        bcgScarErythema,
        perinealErythemaDesquamation,
        crpMgL: Number(crpMgL),
        esrMmHr: Number(esrMmHr),
        serumAlbuminGDl: serumAlbuminGDl ? Number(serumAlbuminGDl) : null,
        serumSodiumMeqL: serumSodiumMeqL ? Number(serumSodiumMeqL) : null,
        plateletCount: plateletCount ? Number(plateletCount) : null,
        wbcCount: wbcCount ? Number(wbcCount) : null,
        altUL: altUL ? Number(altUL) : null,
        neutrophilPct: neutrophilPct ? Number(neutrophilPct) : null,
        sterilePyuriaPresent,
        ivigAdministered: true,
        ivigDoseGKg: 2.0,
        aspirinDoseMgKgDay: 40.0,
        echoPerformed,
        ladZScore: ladZScore ? Number(ladZScore) : null,
        rcaZScore: rcaZScore ? Number(rcaZScore) : null,
        status,
        clinicalNotes: clinicalNotes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save Kawasaki Disease episode');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-rose-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">❤️</span>
            <div>
              <h2 className="text-lg font-bold">
                {existingEpisode ? 'Edit Kawasaki Disease Episode' : 'Pediatric Kawasaki Disease (KD) & Coronary Aneurysm Prevention Protocol'}
              </h2>
              <p className="text-xs text-amber-100">
                AHA 2017 Guidelines & Kobayashi Score for IVIG Resistance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-amber-200 text-2xl font-bold p-1 leading-none"
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
              evaluation.coronaryAneurysmClassification === 'giant_aneurysm_ge_10_or_ge_8mm' || evaluation.ivigResistanceRisk === 'high_risk'
                ? 'bg-red-50 border-red-300'
                : 'bg-amber-50 border-amber-300'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    evaluation.ivigResistanceRisk === 'high_risk'
                      ? 'bg-red-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {evaluation.ivigResistanceRisk === 'high_risk' ? `HIGH RISK IVIG RESISTANCE (Kobayashi ${evaluation.kobayashiScore})` : `LOW RISK (Kobayashi ${evaluation.kobayashiScore})`}
                  </span>
                  <span className="ml-2 text-sm font-bold text-gray-800">
                    {evaluation.diagnosisClassificationLabel}
                  </span>
                </div>
                <div className="text-xs font-semibold text-gray-700">
                  Coronary Max Z-Score: {evaluation.maxCoronaryZScore.toFixed(1)} ({evaluation.coronaryAneurysmClassificationLabel})
                </div>
              </div>

              <div className="mt-2 text-xs grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                <div>
                  <span className="font-semibold text-gray-700">IVIG 2 g/kg Dose: </span>
                  <span className="font-bold text-blue-700">{evaluation.treatmentRegimen.ivigDoseGrams} grams</span> (over 10-12 hrs)
                </div>
                <div>
                  <span className="font-semibold text-gray-700">High-Dose Aspirin (40 mg/kg/d): </span>
                  <span className="font-bold text-amber-700">{evaluation.treatmentRegimen.aspirinAcuteDoseMgDay} mg/day</span> (divided QID)
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Demographics & Fever */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <span>👶</span> Patient Demographics & Fever Timeline
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Presentation Time *</label>
                <input
                  type="datetime-local"
                  value={presentationDatetime}
                  onChange={(e) => setPresentationDatetime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Age (Months) *</label>
                <input
                  type="number"
                  min="1"
                  max="216"
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Weight (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="2"
                  max="100"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Fever Duration (Days) *</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={feverDurationDays}
                  onChange={(e) => setFeverDurationDays(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: AHA Principal Clinical Criteria */}
          <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30 space-y-4">
            <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-2">
              <span>🔍</span> AHA Principal Criteria (Classic KD requires &ge; 4 of 5)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold">
                <input
                  type="checkbox"
                  checked={conjunctivitisBilateralBulbar}
                  onChange={(e) => setConjunctivitisBilateralBulbar(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>1. Bilateral Bulbar Conjunctival Injection (Non-exudative)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold">
                <input
                  type="checkbox"
                  checked={oralMucosalChanges}
                  onChange={(e) => setOralMucosalChanges(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>2. Oral Mucosal Changes (Strawberry tongue, fissured erythema lips)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold">
                <input
                  type="checkbox"
                  checked={polymorphousExanthemRash}
                  onChange={(e) => setPolymorphousExanthemRash(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>3. Polymorphous Exanthem (Maculopapular / Scarlatiniform rash)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold">
                <input
                  type="checkbox"
                  checked={peripheralExtremityChanges}
                  onChange={(e) => setPeripheralExtremityChanges(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>4. Peripheral Extremity Changes (Palmar/plantar erythema & edema)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-800 font-semibold">
                <input
                  type="checkbox"
                  checked={cervicalLymphadenopathyGe15cm}
                  onChange={(e) => setCervicalLymphadenopathyGe15cm(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>5. Cervical Lymphadenopathy (&ge; 1.5 cm, usually unilateral)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-teal-800 font-medium">
                <input
                  type="checkbox"
                  checked={bcgScarErythema}
                  onChange={(e) => setBcgScarErythema(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span>Supplemental: BCG Scar Reactivation / Erythema</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-teal-800 font-medium">
                <input
                  type="checkbox"
                  checked={perinealErythemaDesquamation}
                  onChange={(e) => setPerinealErythemaDesquamation(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span>Supplemental: Perineal Erythema & Early Desquamation</span>
              </label>
            </div>
          </div>

          {/* Section 3: Laboratory Markers & Kobayashi Score Items */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <span>🧪</span> Inflammatory Labs & Kobayashi IVIG Resistance Predictors
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">CRP (mg/L) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={crpMgL}
                  onChange={(e) => setCrpMgL(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">ESR (mm/hr) *</label>
                <input
                  type="number"
                  value={esrMmHr}
                  onChange={(e) => setEsrMmHr(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Serum Na (mEq/L)</label>
                <input
                  type="number"
                  value={serumSodiumMeqL}
                  onChange={(e) => setSerumSodiumMeqL(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="&le; 133 is +2 pts"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Serum Albumin (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={serumAlbuminGDl}
                  onChange={(e) => setSerumAlbuminGDl(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="&le; 3.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Platelets (/mcL)</label>
                <input
                  type="number"
                  value={plateletCount}
                  onChange={(e) => setPlateletCount(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="&le; 300k is +1 pt"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">WBC (/mcL)</label>
                <input
                  type="number"
                  value={wbcCount}
                  onChange={(e) => setWbcCount(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="&ge; 15,000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">ALT / SGPT (U/L)</label>
                <input
                  type="number"
                  value={altUL}
                  onChange={(e) => setAltUL(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="&ge; 100 is +2 pts"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Neutrophils (%)</label>
                <input
                  type="number"
                  value={neutrophilPct}
                  onChange={(e) => setNeutrophilPct(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="&ge; 80% is +2 pts"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={sterilePyuriaPresent}
                  onChange={(e) => setSterilePyuriaPresent(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Sterile Pyuria Present (&ge; 10 WBC/hpf in clean catch urine with negative culture)</span>
              </label>
            </div>
          </div>

          {/* Section 4: Echocardiogram & Coronary Z-Scores */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/20 space-y-4">
            <h3 className="text-sm font-semibold text-red-900 uppercase tracking-wider flex items-center gap-2">
              <span>🫀</span> Echocardiogram & Coronary Artery Z-Scores
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 text-xs font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={echoPerformed}
                    onChange={(e) => setEchoPerformed(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Baseline Echocardiogram Performed</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">LAD Z-Score</label>
                <input
                  type="number"
                  step="0.1"
                  value={ladZScore}
                  onChange={(e) => setLadZScore(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">RCA Z-Score</label>
                <input
                  type="number"
                  step="0.1"
                  value={rcaZScore}
                  onChange={(e) => setRcaZScore(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 2.1"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Status & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Clinical Management Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="active_diagnostic_workup">Active Diagnostic Workup</option>
                <option value="ivig_infusion_in_progress">IVIG Infusion in Progress</option>
                <option value="afebrile_post_ivig_monitoring">Afebrile Post-IVIG Monitoring (48h)</option>
                <option value="ivig_resistant_retreatment">IVIG-Resistant (Repeat IVIG / Steroids)</option>
                <option value="resolved_discharged">Resolved / Discharged (Outpatient Echo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Pediatric Cardiology Directives</label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="e.g. Pre-medicated with paracetamol, IVIG infusion line 2, repeat echo at 2 weeks"
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
              className="px-5 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Kawasaki Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
