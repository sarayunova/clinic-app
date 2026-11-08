import React, { useState, useEffect } from 'react';
import {
  createPediatricDkaCerebralEdemaEpisode,
  type PediatricDkaCerebralEdemaRecord,
} from '../api';
import {
  evaluatePediatricDkaCerebralEdema,
  type PediatricDkaCerebralEdemaEvaluationResult,
} from '../pediatricDkaCerebralEdemaEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricDkaCerebralEdemaRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricDkaCerebralEdemaModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [detectionDatetime, setDetectionDatetime] = useState(
    existingEpisode?.detection_datetime || new Date().toISOString().slice(0, 16),
  );
  const [ageYears, setAgeYears] = useState<number>(existingEpisode?.age_years ?? 8.5);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 26.0);
  const [gcsScore, setGcsScore] = useState<number>(existingEpisode?.gcs_score ?? 11);
  const [headacheSevereSudden, setHeadacheSevereSudden] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.headache_severe_sudden) : true,
  );
  const [lethargyOrConfusion, setLethargyOrConfusion] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.lethargy_or_confusion) : true,
  );
  const [recurrentEmesisPostHydration, setRecurrentEmesisPostHydration] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.recurrent_emesis_post_hydration) : true,
  );
  const [bradycardiaCushingTriad, setBradycardiaCushingTriad] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.bradycardia_cushing_triad) : true,
  );
  const [hypertensionDiastolicGe90, setHypertensionDiastolicGe90] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.hypertension_diastolic_ge_90) : true,
  );
  const [cranialNervePalsy, setCranialNervePalsy] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.cranial_nerve_palsy) : false,
  );
  const [pupillaryAbnormality, setPupillaryAbnormality] = useState<
    'normal_reactive' | 'sluggish' | 'unequal_anisocoria' | 'dilated_fixed'
  >(existingEpisode?.pupillary_abnormality ?? 'sluggish');
  const [decorticateDecerebratePosturing, setDecorticateDecerebratePosturing] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.decorticate_decerebrate_posturing) : false,
  );
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<number>(
    existingEpisode?.blood_glucose_mg_dl ?? 640,
  );
  const [serumSodiumMeasuredMeqL, setSerumSodiumMeasuredMeqL] = useState<number>(
    existingEpisode?.serum_sodium_measured_meq_l ?? 131,
  );
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<number>(
    existingEpisode?.serum_potassium_meq_l ?? 4.1,
  );
  const [bloodPh, setBloodPh] = useState<number>(existingEpisode?.blood_ph ?? 7.08);
  const [serumBicarbonateMeqL, setSerumBicarbonateMeqL] = useState<number>(
    existingEpisode?.serum_bicarbonate_meq_l ?? 6.5,
  );
  const [fluidRateReducedBy30pct, setFluidRateReducedBy30pct] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.fluid_rate_reduced_by_30pct) : true,
  );
  const [headOfBedElevated30deg, setHeadOfBedElevated30deg] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.head_of_bed_elevated_30deg) : true,
  );
  const [status, setStatus] = useState<
    'emergent_hyperosmolar_rescue' | 'hypertonic_saline_infusing' | 'picu_neuro_monitoring' | 'neurological_recovery_gcs15' | 'brainstem_herniation_critical'
  >(existingEpisode?.status ?? 'emergent_hyperosmolar_rescue');
  const [clinicalNotes, setClinicalNotes] = useState(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<PediatricDkaCerebralEdemaEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const res = evaluatePediatricDkaCerebralEdema({
      ageYears,
      weightKg,
      gcsScore,
      headacheSevereSudden,
      lethargyOrConfusion,
      recurrentEmesisPostHydration,
      bradycardiaCushingTriad,
      hypertensionDiastolicGe90,
      cranialNervePalsy,
      pupillaryAbnormality,
      decorticateDecerebratePosturing,
      bloodGlucoseMgDl,
      serumSodiumMeasuredMeqL,
      serumPotassiumMeqL,
      bloodPh,
      serumBicarbonateMeqL,
    });
    setEvaluation(res);
  }, [
    ageYears,
    weightKg,
    gcsScore,
    headacheSevereSudden,
    lethargyOrConfusion,
    recurrentEmesisPostHydration,
    bradycardiaCushingTriad,
    hypertensionDiastolicGe90,
    cranialNervePalsy,
    pupillaryAbnormality,
    decorticateDecerebratePosturing,
    bloodGlucoseMgDl,
    serumSodiumMeasuredMeqL,
    serumPotassiumMeqL,
    bloodPh,
    serumBicarbonateMeqL,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createPediatricDkaCerebralEdemaEpisode({
        patientId,
        detectionDatetime,
        ageYears,
        weightKg,
        gcsScore,
        headacheSevereSudden,
        lethargyOrConfusion,
        recurrentEmesisPostHydration,
        bradycardiaCushingTriad,
        hypertensionDiastolicGe90,
        cranialNervePalsy,
        pupillaryAbnormality,
        decorticateDecerebratePosturing,
        bloodGlucoseMgDl,
        serumSodiumMeasuredMeqL,
        serumPotassiumMeqL,
        bloodPh,
        serumBicarbonateMeqL,
        fluidRateReducedBy30pct,
        headOfBedElevated30deg,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save DKA cerebral edema episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="p-2 bg-rose-100 text-rose-700 rounded-lg text-lg">🧠</span>
              Pediatric DKA Cerebral Edema & Hyperosmolar Rescue Protocol
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              ISPAD 2022 Guidelines &middot; Muir Diagnostic Criteria &middot; 3% Hypertonic Saline / Mannitol Rescue
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Real-time Category & Dosing Banner */}
          {evaluation && (
            <div
              className={`p-4 rounded-xl border ${
                evaluation.muirCriteriaCategory === 'diagnostic_cerebral_edema'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : evaluation.muirCriteriaCategory === 'impending_warning_signs'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-base">{evaluation.muirCriteriaCategoryLabel}</div>
                  <div className="text-xs mt-1 font-medium">
                    Muir Criteria: {evaluation.muirMajorCount} Major &middot; {evaluation.muirMinorCount} Minor &middot;
                    Corrected Na: <span className="font-bold">{evaluation.serumSodiumCorrectedMeqL} mEq/L</span> &middot;
                    Effective Osm: <span className="font-bold">{evaluation.effectiveSerumOsmolalityMosmKg} mOsm/kg</span>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    evaluation.hyperosmolarRescueIndicated
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {evaluation.hyperosmolarRescueIndicated ? 'STAT HYPEROSMOLAR RESCUE' : 'MONITORING PROTOCOL'}
                </span>
              </div>

              {/* Recommended Stat Dose Box */}
              {evaluation.hyperosmolarRescueIndicated && (
                <div className="mt-3 p-3 bg-white/80 rounded-lg border border-rose-200 text-xs text-rose-950">
                  <div className="font-bold text-sm text-rose-900 mb-1">
                    ⚡ STAT Hyperosmolar Dosing (Administer Immediately):
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="p-2 bg-rose-50 rounded border border-rose-100">
                      <strong>Option A (Preferred): 3% Hypertonic Saline</strong>
                      <div className="text-sm font-black text-rose-800">
                        {evaluation.hyperosmolarSaline3PctDoseMl} mL (5 mL/kg) IV over 10-15 min
                      </div>
                    </div>
                    <div className="p-2 bg-amber-50 rounded border border-amber-100">
                      <strong>Option B: 20% Mannitol</strong>
                      <div className="text-sm font-black text-amber-900">
                        {evaluation.mannitol20PctDoseMl} mL (0.5 g/kg = 2.5 mL/kg) IV over 20 min
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evaluation.alerts.map((alt, idx) => (
                    <div key={idx} className="text-xs font-semibold flex items-center gap-1.5 text-rose-900">
                      <span>🚨</span> {alt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Demographics & Neurological Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              1. Demographics & GCS Sensorium
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Detection Datetime</label>
                <input
                  type="datetime-local"
                  value={detectionDatetime}
                  onChange={(e) => setDetectionDatetime(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Age (Years)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="21.0"
                  value={ageYears}
                  onChange={(e) => setAgeYears(parseFloat(e.target.value) || 5.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="2.0"
                  max="120.0"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 20.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  GCS Score (3–15) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={gcsScore}
                  onChange={(e) => setGcsScore(parseInt(e.target.value) || 15)}
                  className="w-full border rounded px-3 py-1.5 text-sm font-bold text-rose-700"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Muir Diagnostic Criteria Signs */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              2. Muir Diagnostic Symptoms & Neurological Signs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Pupillary Examination</label>
                <select
                  value={pupillaryAbnormality}
                  onChange={(e: any) => setPupillaryAbnormality(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm font-medium"
                >
                  <option value="normal_reactive">Briskly Reactive & Equal (Normal)</option>
                  <option value="sluggish">Sluggish Pupillary Light Reflex</option>
                  <option value="unequal_anisocoria">Unequal / Asymmetric Anisocoria (Herniation Alert)</option>
                  <option value="dilated_fixed">Dilated and Fixed (Critical)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center space-x-2 bg-white p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={headacheSevereSudden}
                    onChange={(e) => setHeadacheSevereSudden(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Severe Sudden Headache</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={lethargyOrConfusion}
                    onChange={(e) => setLethargyOrConfusion(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Lethargy / Irritability</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={recurrentEmesisPostHydration}
                    onChange={(e) => setRecurrentEmesisPostHydration(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Recurrent Vomiting</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={bradycardiaCushingTriad}
                    onChange={(e) => setBradycardiaCushingTriad(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Cushing Bradycardia</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={hypertensionDiastolicGe90}
                    onChange={(e) => setHypertensionDiastolicGe90(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Diastolic BP ≥ 90 mmHg</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={cranialNervePalsy}
                    onChange={(e) => setCranialNervePalsy(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span className="text-xs font-medium text-gray-800">CN III/IV/VI Palsy</span>
                </label>

                <label className="col-span-2 flex items-center space-x-2 bg-white p-2 rounded border">
                  <input
                    type="checkbox"
                    checked={decorticateDecerebratePosturing}
                    onChange={(e) => setDecorticateDecerebratePosturing(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span className="text-xs font-medium text-gray-800">
                    Decorticate / Decerebrate Posturing (Critical Brainstem Sign)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Laboratory & Osmolar Calculations */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              3. Glycemia, Electrolytes & Effective Osmolality
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  value={bloodGlucoseMgDl}
                  onChange={(e) => setBloodGlucoseMgDl(parseFloat(e.target.value) || 400)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Measured Na+ (mEq/L)</label>
                <input
                  type="number"
                  step="0.5"
                  min="110"
                  max="180"
                  value={serumSodiumMeasuredMeqL}
                  onChange={(e) => setSerumSodiumMeasuredMeqL(parseFloat(e.target.value) || 135)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">K+ (mEq/L)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.5"
                  max="9.0"
                  value={serumPotassiumMeqL}
                  onChange={(e) => setSerumPotassiumMeqL(parseFloat(e.target.value) || 4.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Blood pH</label>
                <input
                  type="number"
                  step="0.01"
                  min="6.5"
                  max="7.8"
                  value={bloodPh}
                  onChange={(e) => setBloodPh(parseFloat(e.target.value) || 7.1)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">HCO3- (mEq/L)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  max="40.0"
                  value={serumBicarbonateMeqL}
                  onChange={(e) => setSerumBicarbonateMeqL(parseFloat(e.target.value) || 8.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 4: Neuroprotective Checklist */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
              Emergent Neuroprotective Directives
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-950">
              <label className="flex items-center space-x-2 bg-white/70 p-2 rounded border border-blue-200">
                <input
                  type="checkbox"
                  checked={fluidRateReducedBy30pct}
                  onChange={(e) => setFluidRateReducedBy30pct(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="font-semibold">IV fluid infusion rate immediately reduced by 30%</span>
              </label>

              <label className="flex items-center space-x-2 bg-white/70 p-2 rounded border border-blue-200">
                <input
                  type="checkbox"
                  checked={headOfBedElevated30deg}
                  onChange={(e) => setHeadOfBedElevated30deg(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="font-semibold">Head of bed elevated to 30° in midline position</span>
              </label>
            </div>
          </div>

          {/* Status & Clinical Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Episode Status</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="emergent_hyperosmolar_rescue">Emergent Hyperosmolar Rescue</option>
                <option value="hypertonic_saline_infusing">Hypertonic Saline / Mannitol Infusing</option>
                <option value="picu_neuro_monitoring">PICU Neuro-Intensive Monitoring</option>
                <option value="neurological_recovery_gcs15">Neurological Recovery (GCS 15)</option>
                <option value="brainstem_herniation_critical">Brainstem Herniation (Critical)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">Clinical Notes</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-1.5 text-sm"
                placeholder="PICU attending notified, neurosurgery consultation, pupillary re-check..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Initiate Hyperosmolar Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
