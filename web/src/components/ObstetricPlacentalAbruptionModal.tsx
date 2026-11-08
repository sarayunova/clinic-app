import React, { useState, useEffect } from 'react';
import {
  createObstetricPlacentalAbruptionEpisode,
  type ObstetricPlacentalAbruptionRecord,
} from '../api';
import {
  evaluateObstetricPlacentalAbruption,
  type ObstetricPlacentalAbruptionEvaluationResult,
} from '../obstetricPlacentalAbruptionEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricPlacentalAbruptionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricPlacentalAbruptionModal: React.FC<Props> = ({
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
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    existingEpisode?.gestational_age_weeks ?? 35.0,
  );
  const [maternalParity, setMaternalParity] = useState<number>(existingEpisode?.maternal_parity ?? 1);
  const [vaginalBleedingSeverity, setVaginalBleedingSeverity] = useState<
    'concealed_no_external_bleeding' | 'mild_spotting' | 'moderate_bleeding' | 'severe_massive_hemorrhage'
  >(existingEpisode?.vaginal_bleeding_severity ?? 'moderate_bleeding');
  const [abdominalPainCharacter, setAbdominalPainCharacter] = useState<
    'none' | 'mild_cramping' | 'severe_constant_knife_like'
  >(existingEpisode?.abdominal_pain_character ?? 'severe_constant_knife_like');
  const [uterineTonus, setUrineTonus] = useState<
    'normal_soft' | 'increased_hypertonic' | 'tetanic_woody_hard'
  >(existingEpisode?.uterine_tonus ?? 'tetanic_woody_hard');
  const [fetalHeartRateStatus, setFetalHeartRateStatus] = useState<
    'reassuring_category_1' | 'indeterminate_category_2' | 'severe_bradycardia_category_3' | 'intrauterine_fetal_demise_confirmed'
  >(existingEpisode?.fetal_heart_rate_status ?? 'severe_bradycardia_category_3');
  const [maternalSystolicBp, setMaternalSystolicBp] = useState<number>(
    existingEpisode?.maternal_systolic_bp ?? 95,
  );
  const [maternalDiastolicBp, setMaternalDiastolicBp] = useState<number>(
    existingEpisode?.maternal_diastolic_bp ?? 55,
  );
  const [maternalHeartRate, setMaternalHeartRate] = useState<number>(
    existingEpisode?.maternal_heart_rate ?? 128,
  );
  const [serumFibrinogenMgDl, setSerumFibrinogenMgDl] = useState<number>(
    existingEpisode?.serum_fibrinogen_mg_dl ?? 140,
  );
  const [plateletCount, setPlateletCount] = useState<number>(
    existingEpisode?.platelet_count ?? 95000,
  );
  const [hemoglobinGDl, setHemoglobinGDl] = useState<number>(
    existingEpisode?.hemoglobin_g_dl ?? 8.5,
  );
  const [ptInr, setPtInr] = useState<string>(
    existingEpisode?.pt_inr?.toString() ?? '1.3',
  );
  const [kleihauerBetkeSent, setKleihauerBetkeSent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.kleihauer_betke_sent) : true,
  );
  const [ultrasoundRetroplacentalHematoma, setUltrasoundRetroplacentalHematoma] = useState<
    'none_visualized_abruption_not_excluded' | 'marginal_collection' | 'retroplacental_hematoma_present' | 'couvelaire_uterus_suspected'
  >(existingEpisode?.ultrasound_retroplacental_hematoma ?? 'retroplacental_hematoma_present');
  const [pageClassificationGrade, setPageClassificationGrade] = useState<
    'grade_0_retrospective_asymptomatic' | 'grade_1_mild_no_fetal_compromise' | 'grade_2_moderate_fetal_distress_live' | 'grade_3_severe_maternal_shock_demise_or_dic'
  >(existingEpisode?.page_classification_grade ?? 'grade_2_moderate_fetal_distress_live');
  const [mtpActivated, setMtpActivated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.mtp_activated) : true,
  );
  const [prbcUnitsTransfused, setPrbcUnitsTransfused] = useState<number>(
    existingEpisode?.prbc_units_transfused ?? 2,
  );
  const [ffpUnitsTransfused, setFfpUnitsTransfused] = useState<number>(
    existingEpisode?.ffp_units_transfused ?? 2,
  );
  const [cryoprecipitatePoolsTransfused, setCryoprecipitatePoolsTransfused] = useState<number>(
    existingEpisode?.cryoprecipitate_pools_transfused ?? 2,
  );
  const [deliveryModeIndicated, setDeliveryModeIndicated] = useState<
    'emergent_crash_cesarean' | 'urgent_cesarean_transfer' | 'augmented_vaginal_delivery_under_monitoring' | 'conservative_surveillance_preterm'
  >(existingEpisode?.delivery_mode_indicated ?? 'emergent_crash_cesarean');
  const [status, setStatus] = useState<
    'emergent_stabilization' | 'crash_cesarean_in_progress' | 'postpartum_dic_resuscitation' | 'stabilized_ward_observation' | 'resolved_discharged'
  >(existingEpisode?.status ?? 'emergent_stabilization');
  const [clinicalNotes, setClinicalNotes] = useState<string>(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<ObstetricPlacentalAbruptionEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate evaluation when inputs change
  useEffect(() => {
    const res = evaluateObstetricPlacentalAbruption({
      gestationalAgeWeeks,
      maternalParity,
      vaginalBleedingSeverity,
      abdominalPainCharacter,
      uterineTonus,
      fetalHeartRateStatus,
      maternalSystolicBp,
      maternalDiastolicBp,
      maternalHeartRate,
      serumFibrinogenMgDl,
      plateletCount,
      hemoglobinGDl,
      ptInr: ptInr ? parseFloat(ptInr) : undefined,
      ultrasoundRetroplacentalHematoma,
    });
    setEvaluation(res);
    setPageClassificationGrade(res.pageClassificationGrade);
    setMtpActivated(res.mtpActivated);
    setDeliveryModeIndicated(res.deliveryModeIndicated);
  }, [
    gestationalAgeWeeks,
    maternalParity,
    vaginalBleedingSeverity,
    abdominalPainCharacter,
    uterineTonus,
    fetalHeartRateStatus,
    maternalSystolicBp,
    maternalDiastolicBp,
    maternalHeartRate,
    serumFibrinogenMgDl,
    plateletCount,
    hemoglobinGDl,
    ptInr,
    ultrasoundRetroplacentalHematoma,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createObstetricPlacentalAbruptionEpisode({
        patientId,
        presentationDatetime,
        gestationalAgeWeeks,
        maternalParity,
        vaginalBleedingSeverity,
        abdominalPainCharacter,
        uterineTonus,
        fetalHeartRateStatus,
        maternalSystolicBp,
        maternalDiastolicBp,
        maternalHeartRate,
        serumFibrinogenMgDl,
        plateletCount,
        hemoglobinGDl,
        ptInr: ptInr ? parseFloat(ptInr) : null,
        kleihauerBetkeSent,
        ultrasoundRetroplacentalHematoma,
        pageClassificationGrade,
        mtpActivated,
        prbcUnitsTransfused,
        ffpUnitsTransfused,
        cryoprecipitatePoolsTransfused,
        deliveryModeIndicated,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record Obstetric Placental Abruption episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-rose-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🩸</span>
            <div>
              <h2 className="text-xl font-bold">
                {existingEpisode ? 'Edit Placental Abruption Protocol' : 'Obstetric Placental Abruption & Coagulopathy Protocol'}
              </h2>
              <p className="text-xs text-rose-100">
                ACOG Practice Bulletin No. 183 / RCOG Green-top: Page Classification & MTP Cryoprecipitate Resuscitation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-bold leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Clinical Directives / Urgency Banner */}
          {evaluation && (
            <div className={`p-4 rounded-xl border ${
              evaluation.pageClassificationGrade === 'grade_3_severe_maternal_shock_demise_or_dic'
                ? 'bg-red-50 border-red-400 dark:bg-red-950/40 dark:border-red-800 text-red-900 dark:text-red-100'
                : evaluation.pageClassificationGrade === 'grade_2_moderate_fetal_distress_live'
                ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                    evaluation.mtpActivated ? 'bg-red-600 animate-ping' : 'bg-amber-500'
                  }`}></span>
                  Page Classification: {evaluation.pageClassificationGradeLabel}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/70 dark:bg-slate-800/80 shadow-sm">
                  Shock Index: {evaluation.shockIndex} ({evaluation.shockIndex >= 0.9 ? 'HEMODYNAMIC COLLAPSE' : 'Normal'})
                </span>
              </div>
              <p className="text-sm font-semibold">{evaluation.deliveryModeIndicatedLabel}</p>

              {evaluation.isConsumptiveCoagulopathyPresent && (
                <div className="mt-2 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <span>🩸</span> CRITICAL: Consumptive Hypofibrinogenemia (&lt; 200 mg/dL). Rapid cryoprecipitate infusion required!
                </div>
              )}

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evaluation.alerts.map((alt, i) => (
                    <div key={i} className="text-xs text-red-700 dark:text-red-300 font-semibold flex items-center gap-1.5">
                      <span>⚠️</span> {alt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Grid: Core Demographics & Vitals */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Presentation Date & Time *
              </label>
              <input
                type="datetime-local"
                value={presentationDatetime}
                onChange={(e) => setPresentationDatetime(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gestational Age (Weeks) *
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="44"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Maternal Parity *
              </label>
              <input
                type="number"
                min="0"
                max="15"
                value={maternalParity}
                onChange={(e) => setMaternalParity(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Maternal Heart Rate (bpm) *
              </label>
              <input
                type="number"
                min="40"
                max="220"
                value={maternalHeartRate}
                onChange={(e) => setMaternalHeartRate(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Systolic BP (mmHg) *
              </label>
              <input
                type="number"
                min="40"
                max="260"
                value={maternalSystolicBp}
                onChange={(e) => setMaternalSystolicBp(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Diastolic BP (mmHg) *
              </label>
              <input
                type="number"
                min="20"
                max="160"
                value={maternalDiastolicBp}
                onChange={(e) => setMaternalDiastolicBp(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum Fibrinogen (mg/dL) *
              </label>
              <input
                type="number"
                step="1"
                min="20"
                max="800"
                value={serumFibrinogenMgDl}
                onChange={(e) => setSerumFibrinogenMgDl(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Platelets (/mcL) *
              </label>
              <input
                type="number"
                min="5000"
                max="900000"
                value={plateletCount}
                onChange={(e) => setPlateletCount(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Section: Clinical Presentation & Coagulation */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              1. Hemorrhage Pattern, Tone & Fetal Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vaginal Bleeding Severity
                </label>
                <select
                  value={vaginalBleedingSeverity}
                  onChange={(e) => setVaginalBleedingSeverity(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="concealed_no_external_bleeding">Concealed (No External Bleeding - Severe Risk)</option>
                  <option value="mild_spotting">Mild Spotting</option>
                  <option value="moderate_bleeding">Moderate Bleeding</option>
                  <option value="severe_massive_hemorrhage">Severe Massive Hemorrhage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Abdominal Pain Character
                </label>
                <select
                  value={abdominalPainCharacter}
                  onChange={(e) => setAbdominalPainCharacter(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="severe_constant_knife_like">Severe Constant Knife-like Pain</option>
                  <option value="mild_cramping">Mild Cramping / Contractions</option>
                  <option value="none">None / Painless</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Uterine Tonus
                </label>
                <select
                  value={uterineTonus}
                  onChange={(e) => setUrineTonus(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
                >
                  <option value="tetanic_woody_hard">Tetanic / Woody Hard (Hypertonic)</option>
                  <option value="increased_hypertonic">Increased Tone / Incomplete Relaxation</option>
                  <option value="normal_soft">Normal Soft between contractions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fetal Heart Rate Status
                </label>
                <select
                  value={fetalHeartRateStatus}
                  onChange={(e) => setFetalHeartRateStatus(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                >
                  <option value="severe_bradycardia_category_3">Category 3: Severe Bradycardia / Terminal</option>
                  <option value="indeterminate_category_2">Category 2: Indeterminate / Loss of Variability</option>
                  <option value="reassuring_category_1">Category 1: Reassuring (110-160 bpm)</option>
                  <option value="intrauterine_fetal_demise_confirmed">Intrauterine Fetal Demise (IUFD Confirmed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hemoglobin (g/dL) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="3.0"
                  max="18.0"
                  value={hemoglobinGDl}
                  onChange={(e) => setHemoglobinGDl(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  PT / INR
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.8"
                  max="8.0"
                  value={ptInr}
                  onChange={(e) => setPtInr(e.target.value)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ultrasound Retroplacental Hematoma
                </label>
                <select
                  value={ultrasoundRetroplacentalHematoma}
                  onChange={(e) => setUltrasoundRetroplacentalHematoma(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="retroplacental_hematoma_present">Retroplacental Hematoma Present</option>
                  <option value="couvelaire_uterus_suspected">Couvelaire Uterus Suspected (Uteroplacental Apoplexy)</option>
                  <option value="marginal_collection">Marginal Blood Collection</option>
                  <option value="none_visualized_abruption_not_excluded">None Visualized (Abruption NOT Excluded)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kleihauer-Betke Test Sent
                </label>
                <select
                  value={kleihauerBetkeSent ? 'yes' : 'no'}
                  onChange={(e) => setKleihauerBetkeSent(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="yes">Yes (Fetomaternal Hemorrhage Screen)</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Massive Transfusion Protocol (MTP)
                </label>
                <select
                  value={mtpActivated ? 'yes' : 'no'}
                  onChange={(e) => setMtpActivated(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                >
                  <option value="yes">Active (PRBC:FFP:Cryo 1:1:1 Protocol)</option>
                  <option value="no">Not Activated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Resuscitation & Transfusion */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              2. Blood Products Transfused & Delivery Strategy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  PRBC Units Transfused
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={prbcUnitsTransfused}
                  onChange={(e) => setPrbcUnitsTransfused(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  FFP Units Transfused
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={ffpUnitsTransfused}
                  onChange={(e) => setFfpUnitsTransfused(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cryoprecipitate Pools (5-10U/pool)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={cryoprecipitatePoolsTransfused}
                  onChange={(e) => setCryoprecipitatePoolsTransfused(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Mode Indicated
                </label>
                <select
                  value={deliveryModeIndicated}
                  onChange={(e) => setDeliveryModeIndicated(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                >
                  <option value="emergent_crash_cesarean">Emergent Crash Cesarean (Cat 1)</option>
                  <option value="urgent_cesarean_transfer">Urgent Cesarean Transfer</option>
                  <option value="augmented_vaginal_delivery_under_monitoring">Augmented Vaginal Delivery (IUFD / Stable)</option>
                  <option value="conservative_surveillance_preterm">Conservative Surveillance (Preterm Stable)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Page Classification Grade *
                </label>
                <select
                  value={pageClassificationGrade}
                  onChange={(e) => setPageClassificationGrade(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
                >
                  <option value="grade_3_severe_maternal_shock_demise_or_dic">Grade 3: Severe (Maternal Shock, DIC, or Fetal Demise)</option>
                  <option value="grade_2_moderate_fetal_distress_live">Grade 2: Moderate (Tense Uterus & Fetal Distress, Live)</option>
                  <option value="grade_1_mild_no_fetal_compromise">Grade 1: Mild (Vaginal Bleeding, No Fetal Distress)</option>
                  <option value="grade_0_retrospective_asymptomatic">Grade 0: Retrospective / Asymptomatic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Clinical Protocol Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
                >
                  <option value="emergent_stabilization">Emergent Stabilization</option>
                  <option value="crash_cesarean_in_progress">Crash Cesarean in Progress</option>
                  <option value="postpartum_dic_resuscitation">Postpartum DIC Resuscitation</option>
                  <option value="stabilized_ward_observation">Stabilized Ward Observation</option>
                  <option value="resolved_discharged">Resolved / Discharged</option>
                </select>
              </div>
            </div>
          </div>

          {/* Resuscitation Directives Preview */}
          {evaluation && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 mb-1">
                ACOG Resuscitation & Coagulopathy Directives
              </h4>
              <ul className="text-xs text-rose-800 dark:text-rose-300 space-y-1 list-disc pl-4">
                {evaluation.resuscitationDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Notes & Operative / Hemostatic Documentation
            </label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Document estimated blood loss, uterine incision details, Couvelaire uterus presence, uterotonic agents, cryoprecipitate response..."
              className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          {/* Footer Controls */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 shadow-md"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Episode' : 'Commit Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
