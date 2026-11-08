import React, { useState, useEffect } from 'react';
import {
  createObstetricUterineInversionEpisode,
  updateObstetricUterineInversionEpisode,
  calculateObstetricUterineInversion,
  type ObstetricUterineInversionRecord,
} from '../api';
import {
  calculateObstetricShockIndex,
  type InversionDegree,
  type PlacentalStatus,
  type ReductionTechnique,
  type UterineRelaxantAgent,
} from '../obstetricUterineInversionEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricUterineInversionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricUterineInversionModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [occurrenceDatetime, setOccurrenceDatetime] = useState(
    existingEpisode?.occurrence_datetime || new Date().toISOString().slice(0, 16),
  );
  const [maternalAge, setMaternalAge] = useState<number | undefined>(
    existingEpisode?.maternal_age ?? 28,
  );
  const [parity, setParity] = useState<number>(existingEpisode?.parity ?? 2);
  const [deliveryMode, setDeliveryMode] = useState<ObstetricUterineInversionRecord['delivery_mode']>(
    existingEpisode?.delivery_mode ?? 'spontaneous_vaginal',
  );

  const [placentalStatus, setPlacentalStatus] = useState<PlacentalStatus>(
    existingEpisode?.placental_status_at_inversion ?? 'attached_undelivered',
  );
  const [cordTractionApplied, setCordTractionApplied] = useState<boolean>(
    existingEpisode ? existingEpisode.umbilical_cord_traction_applied === 1 : true,
  );
  const [fundalPressureApplied, setFundalPressureApplied] = useState<boolean>(
    existingEpisode ? existingEpisode.fundal_pressure_applied === 1 : false,
  );
  const [inversionDegree, setInversionDegree] = useState<InversionDegree>(
    existingEpisode?.inversion_degree ?? 'third_degree_prolapsed_outside_introitus',
  );

  const [neurogenicShock, setNeurogenicShock] = useState<boolean>(
    existingEpisode ? existingEpisode.neurogenic_shock_present === 1 : true,
  );
  const [systolicBp, setSystolicBp] = useState<number>(
    existingEpisode?.systolic_bp_at_presentation ?? 78,
  );
  const [diastolicBp, setDiastolicBp] = useState<number>(
    existingEpisode?.diastolic_bp_at_presentation ?? 44,
  );
  const [heartRate, setHeartRate] = useState<number>(
    existingEpisode?.heart_rate_at_presentation ?? 62,
  );
  const [estimatedBloodLoss, setEstimatedBloodLoss] = useState<number>(
    existingEpisode?.estimated_blood_loss_ml ?? 600,
  );

  const [reductionImmediate, setReductionImmediate] = useState<boolean>(
    existingEpisode ? existingEpisode.reduction_attempted_immediate === 1 : true,
  );
  const [primaryTechnique, setPrimaryTechnique] = useState<ReductionTechnique>(
    existingEpisode?.reduction_technique_primary ?? 'johnson_manual_maneuver',
  );
  const [relaxantAdministered, setRelaxantAdministered] = useState<boolean>(
    existingEpisode ? existingEpisode.uterine_relaxant_administered === 1 : true,
  );
  const [relaxantAgent, setRelaxantAgent] = useState<UterineRelaxantAgent>(
    existingEpisode?.uterine_relaxant_agent ?? 'terbutaline_sc',
  );
  const [uterotonicBefore, setUterotonicBefore] = useState<boolean>(
    existingEpisode ? existingEpisode.uterotonic_given_before_replacement === 1 : false,
  );
  const [placentaRemovedBefore, setPlacentaRemovedBefore] = useState<boolean>(
    existingEpisode ? existingEpisode.placenta_removed_before_reinversion === 1 : false,
  );

  const [reinversionSuccessful, setReinversionSuccessful] = useState<boolean>(
    existingEpisode ? existingEpisode.reinversion_successful === 1 : true,
  );
  const [timeToReinversion, setTimeToReinversion] = useState<number | undefined>(
    existingEpisode?.time_to_reinversion_minutes ?? 14,
  );
  const [postUterotonics, setPostUterotonics] = useState<boolean>(
    existingEpisode ? existingEpisode.post_replacement_uterotonics_started === 1 : true,
  );
  const [bimanualCompression, setBimanualCompression] = useState<boolean>(
    existingEpisode ? existingEpisode.bimanual_uterine_compression_maintained === 1 : true,
  );
  const [bloodProducts, setBloodProducts] = useState<number>(
    existingEpisode?.blood_products_transfused_units ?? 2,
  );

  const [status, setStatus] = useState<ObstetricUterineInversionRecord['status']>(
    existingEpisode?.status ?? 'acute_neurogenic_shock_reduction',
  );
  const [clinicalNotes, setClinicalNotes] = useState(existingEpisode?.clinical_notes || '');

  const [evalResult, setEvalResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Live Recalculation
  useEffect(() => {
    let active = true;
    const runEval = async () => {
      try {
        const res = await calculateObstetricUterineInversion({
          maternalAge,
          parity,
          deliveryMode,
          placentalStatusAtInversion: placentalStatus,
          umbilicalCordTractionApplied: cordTractionApplied,
          fundalPressureApplied,
          inversionDegree,
          neurogenicShockPresent: neurogenicShock,
          systolicBpAtPresentation: systolicBp,
          diastolicBpAtPresentation: diastolicBp,
          heartRateAtPresentation: heartRate,
          estimatedBloodLossMl: estimatedBloodLoss,
          reductionAttemptedImmediate: reductionImmediate,
          reductionTechniquePrimary: primaryTechnique,
          uterineRelaxantAdministered: relaxantAdministered,
          uterineRelaxantAgent: relaxantAgent,
          uterotonicGivenBeforeReplacement: uterotonicBefore,
          placentaRemovedBeforeReinversion: placentaRemovedBefore,
          reinversionSuccessful,
          timeToReinversionMinutes: timeToReinversion,
          postReplacementUterotonicsStarted: postUterotonics,
          bimanualUterineCompressionMaintained: bimanualCompression,
          bloodProductsTransfusedUnits: bloodProducts,
        });
        if (active) setEvalResult(res.evalResult);
      } catch (err: any) {
        // Fallback
      }
    };
    runEval();
    return () => {
      active = false;
    };
  }, [
    maternalAge,
    parity,
    deliveryMode,
    placentalStatus,
    cordTractionApplied,
    fundalPressureApplied,
    inversionDegree,
    neurogenicShock,
    systolicBp,
    diastolicBp,
    heartRate,
    estimatedBloodLoss,
    reductionImmediate,
    primaryTechnique,
    relaxantAdministered,
    relaxantAgent,
    uterotonicBefore,
    placentaRemovedBefore,
    reinversionSuccessful,
    timeToReinversion,
    postUterotonics,
    bimanualCompression,
    bloodProducts,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      patientId,
      occurrenceDatetime,
      maternalAge,
      parity,
      deliveryMode,
      placentalStatusAtInversion: placentalStatus,
      umbilicalCordTractionApplied: cordTractionApplied,
      fundalPressureApplied,
      inversionDegree,
      neurogenicShockPresent: neurogenicShock,
      systolicBpAtPresentation: systolicBp,
      diastolicBpAtPresentation: diastolicBp,
      heartRateAtPresentation: heartRate,
      estimatedBloodLossMl: estimatedBloodLoss,
      reductionAttemptedImmediate: reductionImmediate,
      reductionTechniquePrimary: primaryTechnique,
      uterineRelaxantAdministered: relaxantAdministered,
      uterineRelaxantAgent: relaxantAgent,
      uterotonicGivenBeforeReplacement: uterotonicBefore,
      placentaRemovedBeforeReinversion: placentaRemovedBefore,
      reinversionSuccessful,
      timeToReinversionMinutes: timeToReinversion,
      postReplacementUterotonicsStarted: postUterotonics,
      bimanualUterineCompressionMaintained: bimanualCompression,
      bloodProductsTransfusedUnits: bloodProducts,
      status,
      clinicalNotes,
    };

    try {
      if (existingEpisode) {
        await updateObstetricUterineInversionEpisode(existingEpisode.id, payload);
      } else {
        await createObstetricUterineInversionEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save obstetric uterine inversion record');
    } finally {
      setSaving(false);
    }
  };

  const currentSi = calculateObstetricShockIndex(heartRate, systolicBp);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-rose-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-rose-950">
              {existingEpisode ? 'Edit Uterine Inversion Record' : 'Initiate Acute Uterine Inversion Emergent Drill'}
            </h2>
            <p className="text-sm text-rose-700">
              RCOG Green-top &bull; Johnson Maneuver &bull; O&apos;Sullivan Hydrostatic &bull; Neurogenic Shock Control
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Live Calculation Banner */}
        {evalResult && (
          <div className="px-6 py-3 bg-rose-100/60 border-b border-rose-200 text-sm flex flex-wrap gap-4 items-center justify-between">
            <div>
              <span className="font-semibold text-rose-950">Shock Index (HR/SBP): </span>
              <span className="text-lg font-bold text-rose-700">{currentSi}</span>
              <span className="ml-3 px-2 py-0.5 rounded text-xs font-semibold bg-rose-200 text-rose-900">
                {evalResult.shockSeverity.toUpperCase()}
              </span>
            </div>
            <div>
              {evalResult.neurogenicShockDominant && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-900 mr-2">
                  Neurogenic / Vagal Shock
                </span>
              )}
              <span className="font-semibold text-gray-700">Urgency: </span>
              <span className="font-bold text-rose-800 uppercase">{evalResult.urgencyLevel.replace(/_/g, ' ')}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}

          {/* Section 1: Presentation & Degree */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              1. Occurrence & Inversion Degree
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Occurrence Datetime</label>
                <input
                  type="datetime-local"
                  value={occurrenceDatetime}
                  onChange={(e) => setOccurrenceDatetime(e.target.value)}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Maternal Age & Parity</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="14"
                    max="55"
                    placeholder="Age"
                    value={maternalAge ?? ''}
                    onChange={(e) => setMaternalAge(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-1/2 border rounded px-2 py-1.5"
                  />
                  <input
                    type="number"
                    min="1"
                    max="15"
                    placeholder="Parity"
                    value={parity}
                    onChange={(e) => setParity(parseInt(e.target.value))}
                    className="w-1/2 border rounded px-2 py-1.5"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Delivery Mode</label>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as any)}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="spontaneous_vaginal">Spontaneous Vaginal</option>
                  <option value="operative_vaginal_vacuum">Operative Vacuum</option>
                  <option value="operative_vaginal_forceps">Operative Forceps</option>
                  <option value="cesarean_section">Cesarean Section</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Inversion Degree</label>
                <select
                  value={inversionDegree}
                  onChange={(e) => setInversionDegree(e.target.value as InversionDegree)}
                  className="w-full border rounded px-3 py-1.5 font-semibold text-rose-800"
                >
                  <option value="first_degree_incomplete_intrauterine">1st Degree (Incomplete Intrauterine)</option>
                  <option value="second_degree_complete_through_cervix">2nd Degree (Through Cervical Os)</option>
                  <option value="third_degree_prolapsed_outside_introitus">3rd Degree (Outside Introitus)</option>
                  <option value="fourth_degree_total_inversion_with_vagina">4th Degree (Total Inversion)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Placental Status at Inversion</label>
                <select
                  value={placentalStatus}
                  onChange={(e) => setPlacentalStatus(e.target.value as PlacentalStatus)}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="attached_undelivered">Attached Undelivered (DO NOT DETACH)</option>
                  <option value="partially_separated">Partially Separated</option>
                  <option value="completely_separated">Completely Separated</option>
                </select>
              </div>

              <div className="flex flex-col justify-end space-y-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={cordTractionApplied}
                    onChange={(e) => setCordTractionApplied(e.target.checked)}
                  />
                  <span>Umbilical Cord Traction Applied</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={fundalPressureApplied}
                    onChange={(e) => setFundalPressureApplied(e.target.checked)}
                  />
                  <span>Fundal Pressure / Crede Applied</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Hemodynamics & Shock State */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              2. Hemodynamics & Shock Assessment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  min="30"
                  max="250"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  min="10"
                  max="160"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Heart Rate (bpm)</label>
                <input
                  type="number"
                  min="30"
                  max="220"
                  value={heartRate}
                  onChange={(e) => setHeartRate(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Estimated Blood Loss (mL)</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="50"
                  value={estimatedBloodLoss}
                  onChange={(e) => setEstimatedBloodLoss(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                  <input
                    type="checkbox"
                    checked={neurogenicShock}
                    onChange={(e) => setNeurogenicShock(e.target.checked)}
                  />
                  <span>Neurogenic Shock Present (Vagal bradycardia / profound hypotension out of proportion to blood loss)</span>
                </label>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Blood Units Transfused</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={bloodProducts}
                  onChange={(e) => setBloodProducts(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Reduction Protocol & Safety Rules */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              3. Emergent Reduction Interventions & Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Primary Reduction Technique</label>
                <select
                  value={primaryTechnique}
                  onChange={(e) => setPrimaryTechnique(e.target.value as ReductionTechnique)}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="johnson_manual_maneuver">Johnson Manual Maneuver (Palm Elevation)</option>
                  <option value="osullivan_hydrostatic_technique">O&apos;Sullivan Hydrostatic Technique</option>
                  <option value="laparotomy_huntington_procedure">Laparotomy Huntington (Allis Traction)</option>
                  <option value="laparotomy_haultain_procedure">Laparotomy Haultain (Incision of Ring)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Uterine Relaxant / Tocolytic</label>
                <select
                  value={relaxantAgent}
                  onChange={(e) => {
                    setRelaxantAgent(e.target.value as UterineRelaxantAgent);
                    setRelaxantAdministered(e.target.value !== 'none');
                  }}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="none">None / Not Required</option>
                  <option value="terbutaline_sc">Terbutaline 0.25 mg SC</option>
                  <option value="nitroglycerin_iv">Nitroglycerin 100-200 mcg IV</option>
                  <option value="magnesium_sulfate">Magnesium Sulfate IV</option>
                  <option value="general_halogenated_anesthesia">General Halogenated Gas (Sevoflurane)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Time to Reinversion (min)</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  placeholder="e.g. 14"
                  value={timeToReinversion ?? ''}
                  onChange={(e) => setTimeToReinversion(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full border rounded px-3 py-1.5"
                />
              </div>

              {/* Strict safety contraindication toggles */}
              <div className="md:col-span-3 bg-white p-3 rounded border border-rose-300 space-y-2">
                <span className="text-xs font-bold text-rose-900 uppercase tracking-wide block">
                  Critical Safety Checklist (Audit Compliance)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-red-700">
                    <input
                      type="checkbox"
                      checked={uterotonicBefore}
                      onChange={(e) => setUterotonicBefore(e.target.checked)}
                    />
                    <span>Uterotonic Given BEFORE Replacement (DANGEROUS CONTRAINDICATION)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-red-700">
                    <input
                      type="checkbox"
                      checked={placentaRemovedBefore}
                      onChange={(e) => setPlacentaRemovedBefore(e.target.checked)}
                    />
                    <span>Placenta Removed BEFORE Reinversion (MASSIVE HEMORRHAGE RISK)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={reinversionSuccessful}
                      onChange={(e) => setReinversionSuccessful(e.target.checked)}
                    />
                    <span>Reinversion Successfully Achieved</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={postUterotonics}
                      onChange={(e) => setPostUterotonics(e.target.checked)}
                    />
                    <span>Post-Replacement High-Dose Oxytocin Started</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={bimanualCompression}
                      onChange={(e) => setBimanualCompression(e.target.checked)}
                    />
                    <span>Internal Bimanual Uterine Compression Maintained</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Status & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-sm">Protocol Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border rounded px-3 py-1.5 text-sm font-semibold"
              >
                <option value="acute_neurogenic_shock_reduction">Acute Shock & Emergent Reduction</option>
                <option value="post_reinversion_bimanual_compression">Post-Reinversion Bimanual Compression</option>
                <option value="laparotomy_operative_repair">Laparotomy Operative Repair</option>
                <option value="stabilized_icu_surveillance">Stabilized ICU Surveillance</option>
                <option value="resolved_ward_recovery">Resolved & Ward Recovery</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-sm">Clinical Notes</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Details of Johnson maneuver, tocolytic response, anesthesia, bimanual tone..."
                rows={2}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Safety Violations Banner */}
          {evalResult && evalResult.criticalSafetyViolations.length > 0 && (
            <div className="p-3 bg-red-100 border border-red-300 rounded text-red-900 text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider block">&#9888; Critical Safety Violations:</span>
              {evalResult.criticalSafetyViolations.map((v: string, idx: number) => (
                <div key={idx} className="font-semibold">{v}</div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Record' : 'Save & Record Inversion Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
