import React, { useState, useEffect } from 'react';
import {
  createNeonatalSghEpisode,
  type NeonatalSghRecord,
} from '../api';
import {
  evaluateNeonatalSgh,
  type NeonatalSghEvaluationResult,
} from '../neonatalSghEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalSghRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalSghModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [birthDatetime, setBirthDatetime] = useState(
    existingEpisode?.birth_datetime || new Date(Date.now() - 3600000 * 4).toISOString().slice(0, 16),
  );
  const [diagnosisDatetime, setDiagnosisDatetime] = useState(
    existingEpisode?.diagnosis_datetime || new Date().toISOString().slice(0, 16),
  );
  const [deliveryMode, setDeliveryMode] = useState<
    'vacuum_assisted' | 'forceps_assisted' | 'vacuum_failed_cesarean' | 'normal_vaginal' | 'emergency_cesarean_unassisted'
  >(existingEpisode?.delivery_mode ?? 'vacuum_assisted');
  const [vacuumCupPopoffs, setVacuumCupPopoffs] = useState<number>(
    existingEpisode?.vacuum_cup_popoffs ?? 2,
  );
  const [birthWeightKg, setBirthWeightKg] = useState<number>(
    existingEpisode?.birth_weight_kg ?? 3.4,
  );
  const [initialHeadCircumferenceCm, setInitialHeadCircumferenceCm] = useState<number>(
    existingEpisode?.initial_head_circumference_cm ?? 34.0,
  );
  const [currentHeadCircumferenceCm, setCurrentHeadCircumferenceCm] = useState<number>(
    existingEpisode?.current_head_circumference_cm ?? 35.5,
  );
  const [swellingCrossesSutures, setSwellingCrossesSutures] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.swelling_crosses_sutures) : true,
  );
  const [swellingFluctuantPitting, setSwellingFluctuantPitting] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.swelling_fluctuant_pitting) : true,
  );
  const [periorbitalEcchymosis, setPeriorbitalEcchymosis] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.periorbital_ecchymosis) : true,
  );
  const [earDisplacement, setEarDisplacement] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.ear_displacement) : true,
  );
  const [pallorSevere, setPallorSevere] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.pallor_severe) : true,
  );
  const [heartRateBpm, setHeartRateBpm] = useState<number>(
    existingEpisode?.heart_rate_bpm ?? 175,
  );
  const [bloodPressureSys, setBloodPressureSys] = useState<string>(
    existingEpisode?.blood_pressure_sys?.toString() ?? '52',
  );
  const [bloodPressureDia, setBloodPressureDia] = useState<string>(
    existingEpisode?.blood_pressure_dia?.toString() ?? '28',
  );
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState<string>(
    existingEpisode?.capillary_refill_seconds?.toString() ?? '4.0',
  );
  const [hematocritInitialPct, setHematocritInitialPct] = useState<string>(
    existingEpisode?.hematocrit_initial_pct?.toString() ?? '48',
  );
  const [hematocritLowestPct, setHematocritLowestPct] = useState<string>(
    existingEpisode?.hematocrit_lowest_pct?.toString() ?? '28',
  );
  const [plateletCount, setPlateletCount] = useState<string>(
    existingEpisode?.platelet_count?.toString() ?? '75000',
  );
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<string>(
    existingEpisode?.fibrinogen_mg_dl?.toString() ?? '95',
  );
  const [mtpActivated, setMtpActivated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.mtp_activated) : true,
  );
  const [prbcVolumeTransfusedMl, setPrbcVolumeTransfusedMl] = useState<number>(
    existingEpisode?.prbc_volume_transfused_ml ?? 0.0,
  );
  const [ffpVolumeTransfusedMl, setFfpVolumeTransfusedMl] = useState<number>(
    existingEpisode?.ffp_volume_transfused_ml ?? 0.0,
  );
  const [cryoprecipitateVolumeMl, setCryoprecipitateVolumeMl] = useState<number>(
    existingEpisode?.cryoprecipitate_volume_ml ?? 0.0,
  );
  const [status, setStatus] = useState<
    'active_resuscitation' | 'mtp_massive_transfusion' | 'stabilized_monitoring' | 'resolved_discharged'
  >(existingEpisode?.status ?? 'active_resuscitation');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<NeonatalSghEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateNeonatalSgh({
        birthWeightKg: Number(birthWeightKg) || 3.0,
        initialHeadCircumferenceCm: Number(initialHeadCircumferenceCm) || 34.0,
        currentHeadCircumferenceCm: Number(currentHeadCircumferenceCm) || 34.0,
        heartRateBpm: Number(heartRateBpm) || 140,
        bloodPressureSys: bloodPressureSys ? Number(bloodPressureSys) : undefined,
        capillaryRefillSeconds: capillaryRefillSeconds ? Number(capillaryRefillSeconds) : undefined,
        swellingCrossesSutures,
        swellingFluctuantPitting,
        periorbitalEcchymosis,
        earDisplacement,
        pallorSevere,
        vacuumCupPopoffs,
        hematocritInitialPct: hematocritInitialPct ? Number(hematocritInitialPct) : undefined,
        hematocritLowestPct: hematocritLowestPct ? Number(hematocritLowestPct) : undefined,
        fibrinogenMgDl: fibrinogenMgDl ? Number(fibrinogenMgDl) : undefined,
        plateletCount: plateletCount ? Number(plateletCount) : undefined,
      });
      setEvaluation(res);
    } catch {
      setEvaluation(null);
    }
  }, [
    birthWeightKg,
    initialHeadCircumferenceCm,
    currentHeadCircumferenceCm,
    heartRateBpm,
    bloodPressureSys,
    capillaryRefillSeconds,
    swellingCrossesSutures,
    swellingFluctuantPitting,
    periorbitalEcchymosis,
    earDisplacement,
    pallorSevere,
    vacuumCupPopoffs,
    hematocritInitialPct,
    hematocritLowestPct,
    fibrinogenMgDl,
    plateletCount,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createNeonatalSghEpisode({
        patientId,
        birthDatetime,
        diagnosisDatetime,
        deliveryMode,
        vacuumCupPopoffs: Number(vacuumCupPopoffs),
        birthWeightKg: Number(birthWeightKg),
        initialHeadCircumferenceCm: Number(initialHeadCircumferenceCm),
        currentHeadCircumferenceCm: Number(currentHeadCircumferenceCm),
        swellingCrossesSutures,
        swellingFluctuantPitting,
        periorbitalEcchymosis,
        earDisplacement,
        pallorSevere,
        heartRateBpm: Number(heartRateBpm),
        bloodPressureSys: bloodPressureSys ? Number(bloodPressureSys) : null,
        bloodPressureDia: bloodPressureDia ? Number(bloodPressureDia) : null,
        capillaryRefillSeconds: capillaryRefillSeconds ? Number(capillaryRefillSeconds) : null,
        hematocritInitialPct: hematocritInitialPct ? Number(hematocritInitialPct) : null,
        hematocritLowestPct: hematocritLowestPct ? Number(hematocritLowestPct) : null,
        plateletCount: plateletCount ? Number(plateletCount) : null,
        fibrinogenMgDl: fibrinogenMgDl ? Number(fibrinogenMgDl) : null,
        mtpActivated,
        prbcVolumeTransfusedMl: Number(prbcVolumeTransfusedMl),
        ffpVolumeTransfusedMl: Number(ffpVolumeTransfusedMl),
        cryoprecipitateVolumeMl: Number(cryoprecipitateVolumeMl),
        status,
        clinicalNotes: clinicalNotes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save SGH episode');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🩸</span>
            <div>
              <h2 className="text-lg font-bold">
                {existingEpisode ? 'Edit Subgaleal Hemorrhage Episode' : 'New Neonatal Subgaleal Hemorrhage (SGH) Resuscitation Protocol'}
              </h2>
              <p className="text-xs text-rose-200">
                AAP & BAPM Occult Blood Loss & Massive Transfusion Protocol (MTP) Resuscitation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-rose-200 text-2xl font-bold p-1 leading-none"
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
              evaluation.shockState === 'life_threatening_circulatory_collapse'
                ? 'bg-red-50 border-red-300'
                : evaluation.shockState === 'uncompensated_hypotensive_shock'
                ? 'bg-orange-50 border-orange-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    evaluation.shockState === 'life_threatening_circulatory_collapse'
                      ? 'bg-red-600 text-white'
                      : evaluation.shockState === 'uncompensated_hypotensive_shock'
                      ? 'bg-orange-600 text-white'
                      : 'bg-yellow-600 text-white'
                  }`}>
                    {evaluation.shockState === 'life_threatening_circulatory_collapse' ? 'CRITICAL COLLAPSE' : evaluation.shockState.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="ml-2 text-sm font-bold text-gray-800">
                    Δ HC: +{evaluation.hcIncreaseCm} cm | Occult Blood Loss: ~{evaluation.estimatedOccultBloodLossMl} mL ({evaluation.circulatingVolumeLossPct}% TBV)
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Total Est. Blood Vol: {evaluation.estimatedTotalBloodVolumeMl} mL
                </div>
              </div>
              <div className="mt-2 text-xs grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-gray-200/60">
                <div>
                  <span className="font-semibold text-gray-700">PRBC (20 mL/kg): </span>
                  <span className="font-bold text-red-700">{evaluation.mtpGuidance.prbcVolumeMl} mL</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">FFP (15 mL/kg): </span>
                  <span className="font-bold text-blue-700">{evaluation.mtpGuidance.ffpVolumeMl} mL</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Cryoprecipitate (10 mL/kg): </span>
                  <span className="font-bold text-purple-700">{evaluation.mtpGuidance.cryoprecipitateVolumeMl} mL</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Demographics & Birth Event */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <span>⏱️</span> Birth Event & Delivery Mode
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Birth Date/Time *</label>
                <input
                  type="datetime-local"
                  value={birthDatetime}
                  onChange={(e) => setBirthDatetime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Diagnosis Date/Time *</label>
                <input
                  type="datetime-local"
                  value={diagnosisDatetime}
                  onChange={(e) => setDiagnosisDatetime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Delivery Mode *</label>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as any)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="vacuum_assisted">Vacuum Assisted Delivery</option>
                  <option value="forceps_assisted">Forceps Assisted Delivery</option>
                  <option value="vacuum_failed_cesarean">Failed Vacuum to Emergency CS</option>
                  <option value="normal_vaginal">Normal Vaginal Delivery</option>
                  <option value="emergency_cesarean_unassisted">Emergency CS Unassisted</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Vacuum Cup Pop-offs</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={vacuumCupPopoffs}
                  onChange={(e) => setVacuumCupPopoffs(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Birth Weight (kg) *</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="8.0"
                  value={birthWeightKg}
                  onChange={(e) => setBirthWeightKg(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Initial Baseline HC (cm) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="45"
                  value={initialHeadCircumferenceCm}
                  onChange={(e) => setInitialHeadCircumferenceCm(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Current Measured HC (cm) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="50"
                  value={currentHeadCircumferenceCm}
                  onChange={(e) => setCurrentHeadCircumferenceCm(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Signs & Physical Examination */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <span>🩺</span> Diagnostic Signs (SGH vs Caput / Cephalohematoma)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={swellingCrossesSutures}
                  onChange={(e) => setSwellingCrossesSutures(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Swelling Crosses Suture Lines (Diagnostic)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={swellingFluctuantPitting}
                  onChange={(e) => setSwellingFluctuantPitting(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Fluctuant, Fluid Wave / Pitting Mass</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={earDisplacement}
                  onChange={(e) => setEarDisplacement(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Ear Displacement (Anterior / Lateral)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={periorbitalEcchymosis}
                  onChange={(e) => setPeriorbitalEcchymosis(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Periorbital Ecchymosis ("Panda Eyes")</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={pallorSevere}
                  onChange={(e) => setPallorSevere(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Severe Pallor / Cutaneous Vasoconstriction</span>
              </label>
            </div>
          </div>

          {/* Section 3: Hemodynamics & Shock Index */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <span>💓</span> Hemodynamics & Laboratory Markers
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Heart Rate (bpm) *</label>
                <input
                  type="number"
                  min="30"
                  max="250"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">BP Systolic (mmHg)</label>
                <input
                  type="number"
                  min="20"
                  max="150"
                  value={bloodPressureSys}
                  onChange={(e) => setBloodPressureSys(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">BP Diastolic (mmHg)</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={bloodPressureDia}
                  onChange={(e) => setBloodPressureDia(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 26"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Capillary Refill (sec)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="15"
                  value={capillaryRefillSeconds}
                  onChange={(e) => setCapillaryRefillSeconds(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Initial Hct (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hematocritInitialPct}
                  onChange={(e) => setHematocritInitialPct(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 48"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Lowest Hct (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hematocritLowestPct}
                  onChange={(e) => setHematocritLowestPct(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 28"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Platelets (/mcL)</label>
                <input
                  type="number"
                  value={plateletCount}
                  onChange={(e) => setPlateletCount(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 80000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Fibrinogen (mg/dL)</label>
                <input
                  type="number"
                  value={fibrinogenMgDl}
                  onChange={(e) => setFibrinogenMgDl(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. 90"
                />
              </div>
            </div>
          </div>

          {/* Section 4: MTP Activation & Transfusions */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/30 space-y-4">
            <h3 className="text-sm font-semibold text-red-900 uppercase tracking-wider flex items-center gap-2">
              <span>🚨</span> Massive Transfusion Protocol (MTP) & Volume Given
            </h3>
            <div className="flex items-center space-x-3 mb-2">
              <input
                type="checkbox"
                id="mtpActivated"
                checked={mtpActivated}
                onChange={(e) => setMtpActivated(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
              />
              <label htmlFor="mtpActivated" className="text-xs font-bold text-red-800">
                ACTIVATE MASSIVE TRANSFUSION PROTOCOL (MTP) NOW
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">PRBC Transfused (mL)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={prbcVolumeTransfusedMl}
                  onChange={(e) => setPrbcVolumeTransfusedMl(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">FFP Transfused (mL)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={ffpVolumeTransfusedMl}
                  onChange={(e) => setFfpVolumeTransfusedMl(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Cryoprecipitate (mL)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={cryoprecipitateVolumeMl}
                  onChange={(e) => setCryoprecipitateVolumeMl(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Status & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Resuscitation Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="active_resuscitation">Active Resuscitation (Volume & Access)</option>
                <option value="mtp_massive_transfusion">MTP Massive Transfusion In Progress</option>
                <option value="stabilized_monitoring">Stabilized (Hourly Head Circumference)</option>
                <option value="resolved_discharged">Resolved / Transferred to Postnatal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Clinical Notes / Access Sites</label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="e.g. Double umbilical venous catheter placed, PRBC O-neg uncrossed infused"
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
              className="px-5 py-2 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save SGH Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
