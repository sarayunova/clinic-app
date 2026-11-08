import React, { useState, useEffect } from 'react';
import {
  createNeonatalTtnEpisode,
  type NeonatalTtnRecord,
} from '../api';
import {
  evaluateNeonatalTtn,
  calculateSilvermanAndersonScore,
  type SilvermanAndersonInputs,
  type NeonatalTtnEvaluationResult,
} from '../neonatalTtnEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalTtnRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalTtnModal: React.FC<Props> = ({
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
    existingEpisode?.gestational_age_weeks ?? 38.0,
  );
  const [birthWeightKg, setBirthWeightKg] = useState<number>(
    existingEpisode?.birth_weight_kg ?? 3.2,
  );
  const [deliveryMode, setDeliveryMode] = useState<
    'elective_cesarean_no_labor' | 'emergency_cesarean_in_labor' | 'vaginal_spontaneous' | 'vaginal_instrumental'
  >(existingEpisode?.delivery_mode ?? 'elective_cesarean_no_labor');

  const [maternalDiabetes, setMaternalDiabetes] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.maternal_diabetes) : false,
  );
  const [maternalAsthma, setMaternalAsthma] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.maternal_asthma) : false,
  );
  const [maternalFluidOverload, setMaternalFluidOverload] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.maternal_fluid_overload) : false,
  );

  const [initialRespiratoryRate, setInitialRespiratoryRate] = useState<number>(
    existingEpisode?.initial_respiratory_rate ?? 78,
  );

  // Silverman-Anderson components
  const [chestRetractionUpper, setChestRetractionUpper] = useState<number>(
    existingEpisode?.chest_retraction_upper ?? 1,
  );
  const [chestRetractionLower, setChestRetractionLower] = useState<number>(
    existingEpisode?.chest_retraction_lower ?? 1,
  );
  const [xiphoidRetraction, setXiphoidRetraction] = useState<number>(
    existingEpisode?.xiphoid_retraction ?? 1,
  );
  const [nasalFlaring, setNasalFlaring] = useState<number>(
    existingEpisode?.nasal_flaring ?? 1,
  );
  const [expiratoryGrunt, setExpiratoryGrunt] = useState<number>(
    existingEpisode?.expiratory_grunt ?? 0,
  );

  const [cxrFindings, setCxrFindings] = useState<
    'perihilar_streaking_sunburst' | 'fissural_fluid_line' | 'prominent_vascularity' | 'hyperaeration' | 'normal_or_equivocal' | 'ground_glass_rds_overlap'
  >(existingEpisode?.cxr_findings ?? 'perihilar_streaking_sunburst');

  const [initialFio2Percent, setInitialFio2Percent] = useState<number>(
    existingEpisode?.initial_fio2_percent ?? 25.0,
  );
  const [respiratorySupportInitial, setRespiratorySupportInitial] = useState<
    'room_air' | 'nasal_cannula_low_flow' | 'hfnc' | 'bubble_cpap' | 'mechanical_ventilation'
  >(existingEpisode?.respiratory_support_initial ?? 'bubble_cpap');
  const [cpapPeepCmh2o, setCpapPeepCmh2o] = useState<number | undefined>(
    existingEpisode?.cpap_peep_cmh2o ?? 5.0,
  );

  const [feedingStatus, setFeedingStatus] = useState<
    'npo_iv_fluids' | 'orogastric_gavage' | 'oral_breast_bottle'
  >(existingEpisode?.feeding_status ?? 'orogastric_gavage');

  const [bloodGasPh, setBloodGasPh] = useState<number | undefined>(
    existingEpisode?.blood_gas_ph ?? 7.34,
  );
  const [bloodGasPco2, setBloodGasPco2] = useState<number | undefined>(
    existingEpisode?.blood_gas_pco2 ?? 46,
  );
  const [bloodGasPao2, setBloodGasPao2] = useState<number | undefined>(
    existingEpisode?.blood_gas_pao2 ?? 68,
  );

  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const silvermanInputs: SilvermanAndersonInputs = {
    chestRetractionUpper,
    chestRetractionLower,
    xiphoidRetraction,
    nasalFlaring,
    expiratoryGrunt,
  };

  const silvermanScore = calculateSilvermanAndersonScore(silvermanInputs);

  const evaluation: NeonatalTtnEvaluationResult = evaluateNeonatalTtn({
    gestationalAgeWeeks,
    birthWeightKg,
    deliveryMode,
    maternalDiabetes,
    maternalAsthma,
    maternalFluidOverload,
    initialRespiratoryRate,
    silvermanAndersonInputs: silvermanInputs,
    cxrFindings,
    initialFio2Percent,
    respiratorySupportInitial,
    cpapPeepCmh2o,
    feedingStatus,
    bloodGasPh,
    bloodGasPco2,
    bloodGasPao2,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createNeonatalTtnEpisode({
        patientId,
        diagnosisDatetime,
        gestationalAgeWeeks,
        birthWeightKg,
        deliveryMode,
        maternalDiabetes,
        maternalAsthma,
        maternalFluidOverload,
        initialRespiratoryRate,
        silvermanAndersonInputs: silvermanInputs,
        cxrFindings,
        initialFio2Percent,
        respiratorySupportInitial,
        cpapPeepCmh2o: cpapPeepCmh2o ?? null,
        feedingStatus,
        bloodGasPh: bloodGasPh ?? null,
        bloodGasPco2: bloodGasPco2 ?? null,
        bloodGasPao2: bloodGasPao2 ?? null,
        status: 'active_monitoring',
        clinicalNotes: clinicalNotes || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save neonatal TTN episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold text-gray-800">
            {existingEpisode ? 'Neonatal TTN Protocol Episode' : 'Initiate Neonatal TTN Protocol'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mt-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Real-time Assessment Banner */}
          <div className="bg-sky-50 border border-sky-300 rounded p-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-sky-800">
                  Silverman-Anderson Retraction Score:
                </span>
                <span className="ml-2 text-2xl font-extrabold text-sky-900">
                  {silvermanScore} / 10
                </span>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  evaluation.distressSeverity === 'severe_respiratory_failure'
                    ? 'bg-red-200 text-red-900'
                    : evaluation.distressSeverity === 'moderate_distress'
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {evaluation.distressSeverityLabel}
              </span>
            </div>

            <div className="mt-2 text-xs text-sky-950 font-medium">
              <p><strong>Feeding Plan:</strong> {evaluation.feedingRecommendation}</p>
              <p className="mt-1"><strong>Respiratory Support:</strong> {evaluation.respiratorySupportGuidance}</p>
            </div>

            {evaluation.alerts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-sky-200 space-y-1">
                {evaluation.alerts.map((alt, idx) => (
                  <div key={idx} className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                    <span>⚠</span> {alt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Demographic & Birth Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-xs font-medium text-gray-700">Diagnosis Timestamp</label>
              <input
                type="datetime-local"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
                className="w-full text-xs border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Gestational Age (weeks)</label>
              <input
                type="number"
                step="0.1"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 38)}
                className="w-full text-xs border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Birth Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={birthWeightKg}
                onChange={(e) => setBirthWeightKg(parseFloat(e.target.value) || 3.0)}
                className="w-full text-xs border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Delivery Mode</label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5"
              >
                <option value="elective_cesarean_no_labor">Elective C-Section (No Labor)</option>
                <option value="emergency_cesarean_in_labor">Emergency C-Section (In Labor)</option>
                <option value="vaginal_spontaneous">Vaginal Spontaneous</option>
                <option value="vaginal_instrumental">Vaginal Instrumental</option>
              </select>
            </div>
          </div>

          {/* Maternal Risk Factors */}
          <div className="border rounded p-3 bg-amber-50/50">
            <label className="block text-xs font-bold text-gray-800 mb-1">Maternal Predisposing Factors</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={maternalDiabetes}
                  onChange={(e) => setMaternalDiabetes(e.target.checked)}
                />
                <span>Maternal Diabetes (GDM / Pre-existing)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={maternalAsthma}
                  onChange={(e) => setMaternalAsthma(e.target.checked)}
                />
                <span>Maternal Asthma</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={maternalFluidOverload}
                  onChange={(e) => setMaternalFluidOverload(e.target.checked)}
                />
                <span>Maternal Peripartum Fluid Overload</span>
              </label>
            </div>
          </div>

          {/* Silverman-Anderson Retraction Scoring Grid */}
          <div className="border rounded p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2">
              Silverman-Anderson Retraction Criteria
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
              <div>
                <label className="font-medium text-gray-700 block mb-1">Upper Chest Movement</label>
                <select
                  value={chestRetractionUpper}
                  onChange={(e) => setChestRetractionUpper(parseInt(e.target.value, 10))}
                  className="w-full border rounded p-1 text-xs"
                >
                  <option value={0}>0 - Synchronized</option>
                  <option value={1}>1 - Lag on inspiration</option>
                  <option value={2}>2 - See-saw respiration</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700 block mb-1">Lower Chest Retraction</label>
                <select
                  value={chestRetractionLower}
                  onChange={(e) => setChestRetractionLower(parseInt(e.target.value, 10))}
                  className="w-full border rounded p-1 text-xs"
                >
                  <option value={0}>0 - None</option>
                  <option value={1}>1 - Just visible</option>
                  <option value={2}>2 - Marked</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700 block mb-1">Xiphoid Retraction</label>
                <select
                  value={xiphoidRetraction}
                  onChange={(e) => setXiphoidRetraction(parseInt(e.target.value, 10))}
                  className="w-full border rounded p-1 text-xs"
                >
                  <option value={0}>0 - None</option>
                  <option value={1}>1 - Just visible</option>
                  <option value={2}>2 - Marked</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700 block mb-1">Nasal Flaring</label>
                <select
                  value={nasalFlaring}
                  onChange={(e) => setNasalFlaring(parseInt(e.target.value, 10))}
                  className="w-full border rounded p-1 text-xs"
                >
                  <option value={0}>0 - None</option>
                  <option value={1}>1 - Minimal</option>
                  <option value={2}>2 - Marked</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700 block mb-1">Expiratory Grunt</label>
                <select
                  value={expiratoryGrunt}
                  onChange={(e) => setExpiratoryGrunt(parseInt(e.target.value, 10))}
                  className="w-full border rounded p-1 text-xs"
                >
                  <option value={0}>0 - None</option>
                  <option value={1}>1 - Stethoscope only</option>
                  <option value={2}>2 - Naked ear (audible)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clinical Findings & Support Modality */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Initial Respiratory Rate (bpm)</label>
              <input
                type="number"
                value={initialRespiratoryRate}
                onChange={(e) => setInitialRespiratoryRate(parseInt(e.target.value, 10) || 60)}
                className="w-full text-xs border rounded p-1.5"
                required
              />
              <span className="text-[10px] text-gray-500">Normal 40-60; TTN typically 60-100</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Chest X-Ray Findings</label>
              <select
                value={cxrFindings}
                onChange={(e) => setCxrFindings(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5"
              >
                <option value="perihilar_streaking_sunburst">Perihilar Streaking ("Sunburst Pattern")</option>
                <option value="fissural_fluid_line">Interlobar Fissural Fluid Line</option>
                <option value="prominent_vascularity">Prominent Pulmonary Vascularity</option>
                <option value="hyperaeration">Hyperaeration (Flat Diaphragms)</option>
                <option value="normal_or_equivocal">Normal or Equivocal</option>
                <option value="ground_glass_rds_overlap">Ground-Glass / Air Bronchograms (RDS Overlap)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Feeding Status</label>
              <select
                value={feedingStatus}
                onChange={(e) => setFeedingStatus(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5"
              >
                <option value="npo_iv_fluids">Strict NPO (IV Dextrose/Fluids)</option>
                <option value="orogastric_gavage">Orogastric / Nasogastric Gavage</option>
                <option value="oral_breast_bottle">Oral Feeding Trial (Breast/Bottle)</option>
              </select>
            </div>
          </div>

          {/* Respiratory Support & Blood Gas */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-xs font-medium text-gray-700">Initial Support Mode</label>
              <select
                value={respiratorySupportInitial}
                onChange={(e) => setRespiratorySupportInitial(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5"
              >
                <option value="room_air">Room Air</option>
                <option value="nasal_cannula_low_flow">Low-Flow Nasal Cannula</option>
                <option value="hfnc">High Flow (HFNC)</option>
                <option value="bubble_cpap">Bubble CPAP</option>
                <option value="mechanical_ventilation">Mechanical Ventilation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Initial FiO2 (%)</label>
              <input
                type="number"
                step="1"
                value={initialFio2Percent}
                onChange={(e) => setInitialFio2Percent(parseFloat(e.target.value) || 21)}
                className="w-full text-xs border rounded p-1.5"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">CPAP PEEP (cmH2O)</label>
              <input
                type="number"
                step="0.5"
                value={cpapPeepCmh2o ?? ''}
                onChange={(e) => setCpapPeepCmh2o(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g. 5.0"
                className="w-full text-xs border rounded p-1.5"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Blood Gas pH</label>
              <input
                type="number"
                step="0.01"
                value={bloodGasPh ?? ''}
                onChange={(e) => setBloodGasPh(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="7.35"
                className="w-full text-xs border rounded p-1.5"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">pCO2 (mmHg)</label>
              <input
                type="number"
                step="1"
                value={bloodGasPco2 ?? ''}
                onChange={(e) => setBloodGasPco2(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="45"
                className="w-full text-xs border rounded p-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Clinical Notes</label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={2}
              className="w-full text-xs border rounded p-1.5"
              placeholder="Transient tachypnea observation notes, fluid management, weaning trajectory..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-sky-600 text-white rounded text-xs font-bold hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Initiate TTN Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
