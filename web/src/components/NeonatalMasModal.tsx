import React, { useState, useEffect } from 'react';
import {
  createNeonatalMasEpisode,
  updateNeonatalMasEpisode,
  calculateNeonatalMas,
  type NeonatalMasRecord,
} from '../api';
import {
  calculateOxygenationIndex,
  type MeconiumConsistency,
  type DeliveryRoomVigor,
  type RespiratorySupportMode,
  type PphnSeverity,
  type AirLeakType,
  type SurfactantDeliveryMethod,
} from '../neonatalMasEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalMasRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalMasModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [diagnosisDatetime, setDiagnosisDatetime] = useState(
    existingEpisode?.diagnosis_datetime || new Date().toISOString().slice(0, 16),
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    existingEpisode?.gestational_age_weeks ?? 39.0,
  );
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(
    existingEpisode?.birth_weight_grams ?? 3200,
  );
  const [chronologicalAgeHours, setChronologicalAgeHours] = useState<number>(
    existingEpisode?.chronological_age_hours ?? 4,
  );
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(
    existingEpisode?.current_weight_kg ?? 3.1,
  );

  const [meconiumConsistency, setMeconiumConsistency] = useState<MeconiumConsistency>(
    existingEpisode?.amniotic_fluid_meconium_consistency ?? 'thick_particulate_pea_soup',
  );
  const [deliveryRoomVigor, setDeliveryRoomVigor] = useState<DeliveryRoomVigor>(
    existingEpisode?.delivery_room_vigor ?? 'non_vigorous_depressed',
  );
  const [etSuctioning, setEtSuctioning] = useState<boolean>(
    existingEpisode ? existingEpisode.endotracheal_suctioning_performed === 1 : true,
  );
  const [meconiumClearedBelowCords, setMeconiumClearedBelowCords] = useState<boolean>(
    existingEpisode ? existingEpisode.meconium_cleared_below_cords === 1 : true,
  );
  const [apgar1min, setApgar1min] = useState<number | undefined>(
    existingEpisode?.apgar_1min ?? 4,
  );
  const [apgar5min, setApgar5min] = useState<number | undefined>(
    existingEpisode?.apgar_5min ?? 7,
  );

  const [supportMode, setSupportMode] = useState<RespiratorySupportMode>(
    existingEpisode?.respiratory_support_mode ?? 'conventional_mechanical_ventilation',
  );
  const [fio2Percent, setFio2Percent] = useState<number>(
    existingEpisode?.fio2_percent ?? 60.0,
  );
  const [meanAirwayPressure, setMeanAirwayPressure] = useState<number>(
    existingEpisode?.mean_airway_pressure_cmh2o ?? 12.0,
  );
  const [pao2Mmhg, setPao2Mmhg] = useState<number | undefined>(
    existingEpisode?.pao2_mmhg ?? 55.0,
  );
  const [paco2Mmhg, setPaco2Mmhg] = useState<number | undefined>(
    existingEpisode?.paco2_mmhg ?? 48.0,
  );
  const [arterialPh, setArterialPh] = useState<number | undefined>(
    existingEpisode?.arterial_ph ?? 7.28,
  );

  const [prePostDuctalDiff, setPrePostDuctalDiff] = useState<number | undefined>(
    existingEpisode?.pre_post_ductal_spo2_diff_percent ?? 12.0,
  );
  const [echoPphnConfirmed, setEchoPphnConfirmed] = useState<boolean>(
    existingEpisode ? existingEpisode.echocardiogram_pphn_confirmed === 1 : true,
  );
  const [pphnSeverity, setPphnSeverity] = useState<PphnSeverity>(
    existingEpisode?.pphn_severity ?? 'moderate_suprasystemic_shunting',
  );
  const [pulmonaryAirLeak, setPulmonaryAirLeak] = useState<boolean>(
    existingEpisode ? existingEpisode.pulmonary_air_leak_present === 1 : false,
  );
  const [airLeakType, setAirLeakType] = useState<AirLeakType>(
    existingEpisode?.air_leak_type ?? 'none',
  );

  const [surfactantAdministered, setSurfactantAdministered] = useState<boolean>(
    existingEpisode ? existingEpisode.surfactant_administered === 1 : false,
  );
  const [surfactantMethod, setSurfactantMethod] = useState<SurfactantDeliveryMethod>(
    existingEpisode?.surfactant_delivery_method ?? 'none',
  );
  const [surfactantDose, setSurfactantDose] = useState<number>(
    existingEpisode?.surfactant_dose_mg_kg ?? 0,
  );
  const [inoPrescribed, setInoPrescribed] = useState<boolean>(
    existingEpisode ? existingEpisode.inhaled_nitric_oxide_prescribed === 1 : false,
  );
  const [inoDose, setInoDose] = useState<number>(
    existingEpisode?.ino_dose_ppm ?? 0,
  );
  const [empiricAntibiotics, setEmpiricAntibiotics] = useState<boolean>(
    existingEpisode ? existingEpisode.empiric_antibiotics_active === 1 : true,
  );

  const [status, setStatus] = useState<NeonatalMasRecord['status']>(
    existingEpisode?.status ?? 'acute_respiratory_failure',
  );
  const [clinicalNotes, setClinicalNotes] = useState(existingEpisode?.clinical_notes || '');

  const [evalResult, setEvalResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Live recalculation
  useEffect(() => {
    let active = true;
    const runEval = async () => {
      try {
        const res = await calculateNeonatalMas({
          gestationalAgeWeeks,
          birthWeightGrams,
          chronologicalAgeHours,
          currentWeightKg,
          amnioticFluidMeconiumConsistency: meconiumConsistency,
          deliveryRoomVigor,
          endotrachealSuctioningPerformed: etSuctioning,
          meconiumClearedBelowCords,
          apgar1min,
          apgar5min,
          respiratorySupportMode: supportMode,
          fio2Percent,
          meanAirwayPressureCmh2o: meanAirwayPressure,
          pao2Mmhg,
          paco2Mmhg,
          arterialPh,
          prePostDuctalSpo2DiffPercent: prePostDuctalDiff,
          echocardiogramPphnConfirmed: echoPphnConfirmed,
          pphnSeverity,
          pulmonaryAirLeakPresent: pulmonaryAirLeak,
          airLeakType,
          surfactantAdministered,
          surfactantDeliveryMethod: surfactantMethod,
          surfactantDoseMgKg: surfactantDose,
          inhaledNitricOxidePrescribed: inoPrescribed,
          inoDosePpm: inoDose,
          empiricAntibioticsActive: empiricAntibiotics,
        });
        if (active) setEvalResult(res.evalResult);
      } catch (err: any) {
        // Fallback local calc
      }
    };
    runEval();
    return () => {
      active = false;
    };
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    chronologicalAgeHours,
    currentWeightKg,
    meconiumConsistency,
    deliveryRoomVigor,
    etSuctioning,
    meconiumClearedBelowCords,
    apgar1min,
    apgar5min,
    supportMode,
    fio2Percent,
    meanAirwayPressure,
    pao2Mmhg,
    paco2Mmhg,
    arterialPh,
    prePostDuctalDiff,
    echoPphnConfirmed,
    pphnSeverity,
    pulmonaryAirLeak,
    airLeakType,
    surfactantAdministered,
    surfactantMethod,
    surfactantDose,
    inoPrescribed,
    inoDose,
    empiricAntibiotics,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      patientId,
      diagnosisDatetime,
      gestationalAgeWeeks,
      birthWeightGrams,
      chronologicalAgeHours,
      currentWeightKg,
      amnioticFluidMeconiumConsistency: meconiumConsistency,
      deliveryRoomVigor,
      endotrachealSuctioningPerformed: etSuctioning,
      meconiumClearedBelowCords,
      apgar1min,
      apgar5min,
      respiratorySupportMode: supportMode,
      fio2Percent,
      meanAirwayPressureCmh2o: meanAirwayPressure,
      pao2Mmhg,
      paco2Mmhg,
      arterialPh,
      prePostDuctalSpo2DiffPercent: prePostDuctalDiff,
      echocardiogramPphnConfirmed: echoPphnConfirmed,
      pphnSeverity,
      pulmonaryAirLeakPresent: pulmonaryAirLeak,
      airLeakType,
      surfactantAdministered,
      surfactantDeliveryMethod: surfactantMethod,
      surfactantDoseMgKg: surfactantDose,
      inhaledNitricOxidePrescribed: inoPrescribed,
      inoDosePpm: inoDose,
      empiricAntibioticsActive: empiricAntibiotics,
      status,
      clinicalNotes,
    };

    try {
      if (existingEpisode) {
        await updateNeonatalMasEpisode(existingEpisode.id, payload);
      } else {
        await createNeonatalMasEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save neonatal MAS protocol record');
    } finally {
      setSaving(false);
    }
  };

  const calculatedOi = calculateOxygenationIndex(meanAirwayPressure, fio2Percent, pao2Mmhg);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-teal-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-teal-900">
              {existingEpisode ? 'Edit Neonatal MAS Episode' : 'Initiate Neonatal MAS & PPHN Rescue Protocol'}
            </h2>
            <p className="text-sm text-teal-700">
              AAP NRP 8th Ed &bull; Cochrane Surfactant &bull; Oxygenation Index (OI) &bull; iNO Escalation
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
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm flex flex-wrap gap-4 items-center justify-between">
            <div>
              <span className="font-semibold text-amber-900">Calculated Oxygenation Index (OI): </span>
              <span className="text-lg font-bold text-amber-700">
                {calculatedOi !== null ? calculatedOi : 'Requires PaO2'}
              </span>
              <span className="ml-3 px-2 py-0.5 rounded text-xs font-semibold bg-amber-200 text-amber-900">
                {evalResult.hypoxemicFailureSeverity.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">PPHN Risk: </span>
              <span className="font-bold text-rose-700 uppercase">{evalResult.pphnRiskLevel}</span>
              {evalResult.inoIndicated && (
                <span className="ml-3 px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">
                  iNO Indicated (20 ppm)
                </span>
              )}
              {evalResult.surfactantIndicated && (
                <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                  Surfactant Indicated
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Demographics & Presentation */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              1. Delivery & Meconium Characteristics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Diagnosis Datetime</label>
                <input
                  type="datetime-local"
                  value={diagnosisDatetime}
                  onChange={(e) => setDiagnosisDatetime(e.target.value)}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">GA (Weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="24"
                  max="44"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Birth Weight (g)</label>
                <input
                  type="number"
                  min="400"
                  max="6500"
                  value={birthWeightGrams}
                  onChange={(e) => setBirthWeightGrams(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Current Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.4"
                  max="7.0"
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Meconium Consistency</label>
                <select
                  value={meconiumConsistency}
                  onChange={(e) => setMeconiumConsistency(e.target.value as MeconiumConsistency)}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="thick_particulate_pea_soup">Thick Particulate (&quot;Pea Soup&quot;)</option>
                  <option value="moderate_meconium">Moderate Meconium</option>
                  <option value="thin_light_meconium">Thin / Light Meconium</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Delivery Room Vigor</label>
                <select
                  value={deliveryRoomVigor}
                  onChange={(e) => setDeliveryRoomVigor(e.target.value as DeliveryRoomVigor)}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="non_vigorous_depressed">Non-Vigorous / Depressed</option>
                  <option value="vigorous_active">Vigorous / Active</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Apgar 1 min / 5 min</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="1m"
                    value={apgar1min ?? ''}
                    onChange={(e) => setApgar1min(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-1/2 border rounded px-2 py-1.5"
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="5m"
                    value={apgar5min ?? ''}
                    onChange={(e) => setApgar5min(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-1/2 border rounded px-2 py-1.5"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-end space-y-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={etSuctioning}
                    onChange={(e) => setEtSuctioning(e.target.checked)}
                  />
                  <span>ET Intubation / Suction Performed</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={meconiumClearedBelowCords}
                    onChange={(e) => setMeconiumClearedBelowCords(e.target.checked)}
                  />
                  <span>Meconium Below Cords Cleared</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Blood Gas & Ventilatory Mechanics */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              2. Ventilatory Support & Oxygenation Indices
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Ventilatory Mode</label>
                <select
                  value={supportMode}
                  onChange={(e) => setSupportMode(e.target.value as RespiratorySupportMode)}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="room_air_low_flow_o2">Room Air / Low Flow O2</option>
                  <option value="nasal_cpap_bubble">Nasal Bubble CPAP</option>
                  <option value="non_invasive_nipv">Non-Invasive NIPV</option>
                  <option value="conventional_mechanical_ventilation">Conventional CMV</option>
                  <option value="high_frequency_oscillatory_ventilation">HFOV (High-Frequency)</option>
                  <option value="ecmo_rescue">ECMO Rescue</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">FiO2 (%)</label>
                <input
                  type="number"
                  min="21"
                  max="100"
                  step="1"
                  value={fio2Percent}
                  onChange={(e) => setFio2Percent(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Mean Airway Pressure (MAP cmH2O)</label>
                <input
                  type="number"
                  min="4"
                  max="35"
                  step="0.5"
                  value={meanAirwayPressure}
                  onChange={(e) => setMeanAirwayPressure(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">PaO2 (mmHg)</label>
                <input
                  type="number"
                  min="15"
                  max="400"
                  step="1"
                  placeholder="e.g. 55"
                  value={pao2Mmhg ?? ''}
                  onChange={(e) => setPao2Mmhg(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">PaCO2 (mmHg)</label>
                <input
                  type="number"
                  min="15"
                  max="150"
                  step="1"
                  placeholder="e.g. 48"
                  value={paco2Mmhg ?? ''}
                  onChange={(e) => setPaco2Mmhg(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Arterial pH</label>
                <input
                  type="number"
                  min="6.7"
                  max="7.7"
                  step="0.01"
                  placeholder="e.g. 7.28"
                  value={arterialPh ?? ''}
                  onChange={(e) => setArterialPh(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Pre/Post Ductal SpO2 Diff (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="e.g. 12"
                  value={prePostDuctalDiff ?? ''}
                  onChange={(e) => setPrePostDuctalDiff(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">PPHN Severity (Echo)</label>
                <select
                  value={pphnSeverity}
                  onChange={(e) => setPphnSeverity(e.target.value as PphnSeverity)}
                  className="w-full border rounded px-3 py-1.5"
                >
                  <option value="none_or_not_assessed">None / Not Assessed</option>
                  <option value="mild_right_ventricular_strain">Mild RV Strain</option>
                  <option value="moderate_suprasystemic_shunting">Moderate Suprasystemic</option>
                  <option value="severe_refractory_right_to_left">Severe Refractory R-to-L</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Therapeutics & Complications */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              3. Therapeutics & Air Leak Syndrome
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={surfactantAdministered}
                    onChange={(e) => setSurfactantAdministered(e.target.checked)}
                  />
                  <span>Surfactant Administered</span>
                </label>
                {surfactantAdministered && (
                  <div className="space-y-2 pl-6">
                    <select
                      value={surfactantMethod}
                      onChange={(e) => setSurfactantMethod(e.target.value as SurfactantDeliveryMethod)}
                      className="w-full border rounded px-2 py-1 text-xs"
                    >
                      <option value="bolus_endotracheal">Bolus Endotracheal (150-200 mg/kg)</option>
                      <option value="dilute_surfactant_bronchoalveolar_lavage">Dilute Surfactant Lavage</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Dose mg/kg"
                      value={surfactantDose}
                      onChange={(e) => setSurfactantDose(parseFloat(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={inoPrescribed}
                    onChange={(e) => setInoPrescribed(e.target.checked)}
                  />
                  <span>Inhaled Nitric Oxide (iNO)</span>
                </label>
                {inoPrescribed && (
                  <div className="pl-6">
                    <label className="block text-xs text-gray-600 mb-1">Dose (ppm, max 40)</label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={inoDose}
                      onChange={(e) => setInoDose(parseFloat(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={pulmonaryAirLeak}
                    onChange={(e) => setPulmonaryAirLeak(e.target.checked)}
                  />
                  <span className="text-rose-700">Air Leak / Pneumothorax Present</span>
                </label>
                {pulmonaryAirLeak && (
                  <div className="pl-6">
                    <select
                      value={airLeakType}
                      onChange={(e) => setAirLeakType(e.target.value as AirLeakType)}
                      className="w-full border rounded px-2 py-1 text-xs"
                    >
                      <option value="pneumothorax_tension">Tension Pneumothorax (Critical)</option>
                      <option value="pneumothorax_simple">Simple Pneumothorax</option>
                      <option value="pneumomediastinum">Pneumomediastinum</option>
                      <option value="pulmonary_interstitial_emphysema">PIE (Interstitial Emphysema)</option>
                    </select>
                  </div>
                )}
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
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="acute_respiratory_failure">Acute Respiratory Failure</option>
                <option value="hfov_ino_escalation">HFOV & iNO Escalation</option>
                <option value="weaning_recovering">Weaning & Recovering</option>
                <option value="resolved_extubated">Resolved & Extubated</option>
                <option value="ecmo_transferred">ECMO Transferred</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-sm">Clinical Notes</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Airway suctioning details, blood gas trends, ventilator settings..."
                rows={2}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Directives from evaluation engine */}
          {evalResult && evalResult.clinicalAlerts.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider block">Critical Clinical Directives:</span>
              {evalResult.clinicalAlerts.map((alt: string, idx: number) => (
                <div key={idx} className="flex gap-1.5">
                  <span>&bull;</span>
                  <span>{alt}</span>
                </div>
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
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Episode' : 'Save & Activate MAS Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
