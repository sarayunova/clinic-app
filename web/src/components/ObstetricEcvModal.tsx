import React, { useState, useEffect } from 'react';
import {
  createObstetricEcvEpisode,
  type ObstetricEcvRecord,
} from '../api';
import {
  evaluateObstetricEcv,
  type ObstetricEcvEvaluationResult,
} from '../obstetricEcvEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricEcvRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricEcvModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [procedureDatetime, setProcedureDatetime] = useState(
    existingEpisode?.procedure_datetime || new Date().toISOString().slice(0, 16),
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    existingEpisode?.gestational_age_weeks ?? 37.2,
  );
  const [maternalParity, setMaternalParity] = useState<number>(
    existingEpisode?.maternal_parity ?? 1,
  );
  const [maternalBmi, setMaternalBmi] = useState<number>(
    existingEpisode?.maternal_bmi ?? 26.0,
  );
  const [fetalPresentationInitial, setFetalPresentationInitial] = useState<
    'frank_breech' | 'complete_breech' | 'footling_incomplete_breech' | 'transverse_lie' | 'oblique_lie'
  >(existingEpisode?.fetal_presentation_initial ?? 'frank_breech');
  const [placentalLocation, setPlacentalLocation] = useState<
    'posterior' | 'fundal' | 'lateral' | 'anterior' | 'low_lying_placenta_previa'
  >(existingEpisode?.placental_location ?? 'posterior');
  const [amnioticFluidIndexCm, setAmnioticFluidIndexCm] = useState<number>(
    existingEpisode?.amniotic_fluid_index_cm ?? 13.5,
  );
  const [estimatedFetalWeightG, setEstimatedFetalWeightG] = useState<number>(
    existingEpisode?.estimated_fetal_weight_g ?? 3150,
  );
  const [fetalSpinePosition, setFetalSpinePosition] = useState<
    'posterior' | 'lateral' | 'anterior'
  >(existingEpisode?.fetal_spine_position ?? 'lateral');
  const [fetalEngagementLevel, setFetalEngagementLevel] = useState<
    'high_unengaged_floating' | 'dipping_in_pelvis' | 'deeply_engaged'
  >(existingEpisode?.fetal_engagement_level ?? 'high_unengaged_floating');
  const [tocolyticAgentAdministered, setTocolyticAgentAdministered] = useState<
    'terbutaline_0_25mg_sc' | 'salbutamol_iv' | 'nitroglycerin_sublingual' | 'none_attempted'
  >(existingEpisode?.tocolytic_agent_administered ?? 'terbutaline_0_25mg_sc');
  const [terbutalineGiven, setTerbutalineGiven] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.terbutaline_given) : true,
  );
  const [maternalRhNegative, setMaternalRhNegative] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.maternal_rh_negative) : false,
  );
  const [rhAntiDAdministered, setRhAntiDAdministered] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.rh_anti_d_administered) : false,
  );
  const [kleihauerBetkeSent, setKleihauerBetkeSent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.kleihauer_betke_sent) : false,
  );
  const [attemptsCount, setAttemptsCount] = useState<number>(
    existingEpisode?.attempts_count ?? 1,
  );
  const [forwardRollAttempted, setForwardRollAttempted] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.forward_roll_attempted) : true,
  );
  const [backwardFlipAttempted, setBackwardFlipAttempted] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.backward_flip_attempted) : false,
  );
  const [ecvOutcome, setEcvOutcome] = useState<
    'successful_cephalic_conversion' | 'failed_breech_persistent' | 'procedure_aborted_fhr_deceleration' | 'emergency_cesarean_transfer'
  >(existingEpisode?.ecv_outcome ?? 'successful_cephalic_conversion');
  const [status, setStatus] = useState<
    'pre_procedure_assessment' | 'tocolysis_in_progress' | 'version_attempts_active' | 'successful_monitoring_discharge' | 'emergency_delivery_transfer' | 'elective_cesarean_scheduled'
  >(existingEpisode?.status ?? 'pre_procedure_assessment');
  const [clinicalNotes, setClinicalNotes] = useState(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<ObstetricEcvEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const res = evaluateObstetricEcv({
      gestationalAgeWeeks,
      maternalParity,
      maternalBmi,
      fetalPresentationInitial,
      placentalLocation,
      amnioticFluidIndexCm,
      estimatedFetalWeightG,
      fetalSpinePosition,
      fetalEngagementLevel,
      terbutalineGiven,
      maternalRhNegative,
    });
    setEvaluation(res);
  }, [
    gestationalAgeWeeks,
    maternalParity,
    maternalBmi,
    fetalPresentationInitial,
    placentalLocation,
    amnioticFluidIndexCm,
    estimatedFetalWeightG,
    fetalSpinePosition,
    fetalEngagementLevel,
    terbutalineGiven,
    maternalRhNegative,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createObstetricEcvEpisode({
        patientId,
        procedureDatetime,
        gestationalAgeWeeks,
        maternalParity,
        maternalBmi,
        fetalPresentationInitial,
        placentalLocation,
        amnioticFluidIndexCm,
        estimatedFetalWeightG,
        fetalSpinePosition,
        fetalEngagementLevel,
        tocolyticAgentAdministered,
        terbutalineGiven,
        maternalRhNegative,
        rhAntiDAdministered,
        kleihauerBetkeSent,
        attemptsCount,
        forwardRollAttempted,
        backwardFlipAttempted,
        ecvOutcome,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save obstetric ECV episode');
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
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg text-lg">🔄</span>
              Obstetric External Cephalic Version (ECV) Protocol
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              ACOG Practice Bulletin No. 13 &middot; RCOG Green-top No. 20a &middot; Breech Conversion Safety
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
          {/* Real-time Probability & Eligibility Banner */}
          {evaluation && (
            <div
              className={`p-4 rounded-xl border ${
                evaluation.hasAbsoluteContraindications
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : evaluation.successLikelihoodTier === 'high'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block opacity-75">
                    Calculated Conversion Probability (Multivariable Model)
                  </span>
                  <div className="text-2xl font-black mt-0.5">
                    {evaluation.calculatedSuccessProbabilityPct}% Success Probability
                  </div>
                  <div className="text-xs font-semibold mt-1">{evaluation.successLikelihoodTierLabel}</div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full ${
                      evaluation.isEligibleForEcv
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {evaluation.isEligibleForEcv ? 'CANDIDATE ELIGIBLE' : 'CONTRAINDICATED'}
                  </span>
                </div>
              </div>

              {evaluation.alerts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {evaluation.alerts.map((alt, idx) => (
                    <div key={idx} className="text-xs font-semibold flex items-center gap-1.5 text-red-800">
                      <span>⚠️</span> {alt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Demographics & Gestational Age */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              1. Gestational Age & Maternal Demographics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Procedure Datetime</label>
                <input
                  type="datetime-local"
                  value={procedureDatetime}
                  onChange={(e) => setProcedureDatetime(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Gestational Age (weeks) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="30.0"
                  max="43.0"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 37.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Parity</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={maternalParity}
                  onChange={(e) => setMaternalParity(parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Maternal BMI (kg/m²)</label>
                <input
                  type="number"
                  step="0.1"
                  min="16.0"
                  max="60.0"
                  value={maternalBmi}
                  onChange={(e) => setMaternalBmi(parseFloat(e.target.value) || 25.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Fetal & Placental Ultrasound Assessment */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              2. Fetal Presentation & Ultrasound Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Presentation</label>
                <select
                  value={fetalPresentationInitial}
                  onChange={(e: any) => setFetalPresentationInitial(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="frank_breech">Frank Breech (Hips flexed, knees extended)</option>
                  <option value="complete_breech">Complete Breech (Hips & knees flexed)</option>
                  <option value="footling_incomplete_breech">Footling / Incomplete Breech</option>
                  <option value="transverse_lie">Transverse Lie</option>
                  <option value="oblique_lie">Oblique Lie</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Placental Location</label>
                <select
                  value={placentalLocation}
                  onChange={(e: any) => setPlacentalLocation(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="posterior">Posterior (Favorable)</option>
                  <option value="fundal">Fundal</option>
                  <option value="lateral">Lateral</option>
                  <option value="anterior">Anterior (Impairs grip)</option>
                  <option value="low_lying_placenta_previa">Low-Lying / Placenta Previa (Absolute Contraindication)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">AFI (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="40.0"
                  value={amnioticFluidIndexCm}
                  onChange={(e) => setAmnioticFluidIndexCm(parseFloat(e.target.value) || 10.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Estimated Fetal Weight (g)</label>
                <input
                  type="number"
                  min="800"
                  max="5500"
                  value={estimatedFetalWeightG}
                  onChange={(e) => setEstimatedFetalWeightG(parseInt(e.target.value) || 3000)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Fetal Spine Position</label>
                <select
                  value={fetalSpinePosition}
                  onChange={(e: any) => setFetalSpinePosition(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="lateral">Lateral (Easiest to guide)</option>
                  <option value="posterior">Posterior</option>
                  <option value="anterior">Anterior</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Fetal Engagement Level</label>
                <select
                  value={fetalEngagementLevel}
                  onChange={(e: any) => setFetalEngagementLevel(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="high_unengaged_floating">High / Unengaged / Floating</option>
                  <option value="dipping_in_pelvis">Dipping in Pelvis</option>
                  <option value="deeply_engaged">Deeply Engaged (Difficult disimpaction)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Tocolysis & Rh-D Alloimmunization */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              3. Tocolysis & Rh Alloimmunization Protocol
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Tocolytic Agent</label>
                <select
                  value={tocolyticAgentAdministered}
                  onChange={(e: any) => {
                    setTocolyticAgentAdministered(e.target.value);
                    setTerbutalineGiven(e.target.value === 'terbutaline_0_25mg_sc');
                  }}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="terbutaline_0_25mg_sc">Terbutaline 0.25 mg SC (Standard Grade A)</option>
                  <option value="salbutamol_iv">Salbutamol IV Infusion</option>
                  <option value="nitroglycerin_sublingual">Nitroglycerin Sublingual Spray</option>
                  <option value="none_attempted">None / No Tocolysis</option>
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={terbutalineGiven}
                    onChange={(e) => setTerbutalineGiven(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-medium text-gray-800">
                    Terbutaline 0.25 mg SC Administered Pre-Procedure
                  </span>
                </label>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={maternalRhNegative}
                    onChange={(e) => setMaternalRhNegative(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Mother is Rh-Negative (D-)</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={rhAntiDAdministered}
                    onChange={(e) => setRhAntiDAdministered(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Anti-D (300 mcg) Administered</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={kleihauerBetkeSent}
                    onChange={(e) => setKleihauerBetkeSent(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Kleihauer-Betke Test Sent</span>
                </label>
              </div>
            </div>

            {evaluation && evaluation.rhManagementProtocol.antiDIndicated && (
              <div className="mt-3 p-2.5 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900 font-medium">
                {evaluation.rhManagementProtocol.instructions}
              </div>
            )}
          </div>

          {/* Section 4: Procedural Technique & Outcome */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              4. Procedural Maneuver & Outcome
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Attempt Count</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={attemptsCount}
                  onChange={(e) => setAttemptsCount(parseInt(e.target.value) || 1)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Maneuver Vectors</label>
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center space-x-2 text-xs">
                    <input
                      type="checkbox"
                      checked={forwardRollAttempted}
                      onChange={(e) => setForwardRollAttempted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Forward Somersault / Roll</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs">
                    <input
                      type="checkbox"
                      checked={backwardFlipAttempted}
                      onChange={(e) => setBackwardFlipAttempted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Backward Flip</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">ECV Outcome</label>
                <select
                  value={ecvOutcome}
                  onChange={(e: any) => setEcvOutcome(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm font-semibold"
                >
                  <option value="successful_cephalic_conversion">Successful Cephalic Conversion</option>
                  <option value="failed_breech_persistent">Failed: Persistent Breech</option>
                  <option value="procedure_aborted_fhr_deceleration">Aborted: Fetal Deceleration</option>
                  <option value="emergency_cesarean_transfer">Emergency Cesarean Transfer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status & Clinical Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Protocol Status</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="pre_procedure_assessment">Pre-Procedure Assessment & Counseling</option>
                <option value="tocolysis_in_progress">Tocolytic Administration In Progress</option>
                <option value="version_attempts_active">Version Maneuvers Active</option>
                <option value="successful_monitoring_discharge">Successful: Reactive EFM & Discharge</option>
                <option value="emergency_delivery_transfer">Emergency Delivery Transfer</option>
                <option value="elective_cesarean_scheduled">Elective Cesarean Scheduled</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">Clinical Notes</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-1.5 text-sm"
                placeholder="Maternal tolerance, FHR auscultation, operating room standby verified..."
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Record ECV Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
