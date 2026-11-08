import React, { useState, useEffect } from 'react';
import {
  createObstetricVasaPreviaEpisode,
  updateObstetricVasaPreviaEpisode,
  type ObstetricVasaPreviaRecord,
} from '../api';
import {
  evaluateObstetricVasaPrevia,
  type ObstetricVasaPreviaEvaluationResult,
  type VasaPreviaType,
  type AptTestResult,
  type MembraneStatus,
  type CtgPattern,
  type ElectiveDeliveryWindow,
} from '../obstetricVasaPreviaEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricVasaPreviaRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricVasaPreviaModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    existingEpisode?.gestational_age_weeks ?? 32.0
  );
  const [vasaPreviaType, setVasaPreviaType] = useState<VasaPreviaType>(
    existingEpisode?.vasa_previa_type ?? 'type_1_velamentous_cord'
  );
  const [distanceToInternalOsMm, setDistanceToInternalOsMm] = useState<number>(
    existingEpisode?.distance_to_internal_os_mm ?? 10.0
  );
  const [colorDopplerConfirmed, setColorDopplerConfirmed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.color_doppler_confirmed) : true
  );
  const [cervicalLengthMm, setCervicalLengthMm] = useState<string>(
    existingEpisode?.cervical_length_mm !== null && existingEpisode?.cervical_length_mm !== undefined
      ? String(existingEpisode.cervical_length_mm)
      : '32.0'
  );
  const [vaginalBleedingPresent, setVaginalBleedingPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vaginal_bleeding_present) : false
  );
  const [aptTestResult, setAptTestResult] = useState<AptTestResult>(
    existingEpisode?.apt_test_result ?? 'not_performed'
  );
  const [membraneStatus, setMembraneStatus] = useState<MembraneStatus>(
    existingEpisode?.membrane_status ?? 'intact'
  );
  const [fetalHeartRateBpm, setFetalHeartRateBpm] = useState<string>(
    existingEpisode?.fetal_heart_rate_bpm ? String(existingEpisode.fetal_heart_rate_bpm) : '140'
  );
  const [ctgPattern, setCtgPattern] = useState<CtgPattern>(
    existingEpisode?.ctg_pattern ?? 'category_1_normal'
  );
  const [corticosteroidsAdministered, setCorticosteroidsAdministered] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.corticosteroids_administered) : false
  );
  const [electiveDeliveryWindowWeeks, setElectiveDeliveryWindowWeeks] = useState<ElectiveDeliveryWindow>(
    existingEpisode?.elective_delivery_window_weeks ?? '34_0_to_35_6_weeks'
  );
  const [status, setStatus] = useState<ObstetricVasaPreviaRecord['status']>(
    existingEpisode?.status ?? 'antenatal_surveillance'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<ObstetricVasaPreviaEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const res = evaluateObstetricVasaPrevia({
      gestationalAgeWeeks,
      vasaPreviaType,
      distanceToInternalOsMm,
      colorDopplerConfirmed,
      cervicalLengthMm: cervicalLengthMm ? parseFloat(cervicalLengthMm) : undefined,
      vaginalBleedingPresent,
      aptTestResult,
      membraneStatus,
      fetalHeartRateBpm: fetalHeartRateBpm ? parseInt(fetalHeartRateBpm, 10) : undefined,
      ctgPattern,
      corticosteroidsAdministered,
      electiveDeliveryWindowWeeks,
    });
    setEvaluation(res);
  }, [
    gestationalAgeWeeks,
    vasaPreviaType,
    distanceToInternalOsMm,
    colorDopplerConfirmed,
    cervicalLengthMm,
    vaginalBleedingPresent,
    aptTestResult,
    membraneStatus,
    fetalHeartRateBpm,
    ctgPattern,
    corticosteroidsAdministered,
    electiveDeliveryWindowWeeks,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      vasaPreviaType,
      distanceToInternalOsMm: Number(distanceToInternalOsMm),
      colorDopplerConfirmed,
      cervicalLengthMm: cervicalLengthMm ? parseFloat(cervicalLengthMm) : undefined,
      vaginalBleedingPresent,
      aptTestResult,
      membraneStatus,
      fetalHeartRateBpm: fetalHeartRateBpm ? parseInt(fetalHeartRateBpm, 10) : undefined,
      ctgPattern,
      corticosteroidsAdministered,
      electiveDeliveryWindowWeeks,
      status,
      clinicalNotes: clinicalNotes || undefined,
    };

    try {
      if (existingEpisode) {
        await updateObstetricVasaPreviaEpisode(existingEpisode.id, payload);
      } else {
        await createObstetricVasaPreviaEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save vasa previa episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-rose-700 text-white rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold">
              {existingEpisode ? 'Edit' : 'New'} Obstetric Vasa Previa Protocol
            </h2>
            <p className="text-xs text-rose-100">
              ACOG PB #204 / SMFM Consult #67 • Color Doppler & Apt Test • Crash Delivery Protocol
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl font-bold leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {evaluation && (
            <div
              className={`p-4 rounded-lg border ${
                evaluation.urgencyTier === 'crash_cesarean_emergency'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : evaluation.urgencyTier === 'inpatient_rupture_precautions'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-base">{evaluation.urgencyTierLabel}</span>
                <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase bg-white border">
                  {evaluation.isVasaPreviaConfirmed ? 'Vasa Previa Confirmed (≤20mm)' : 'Surveillance'}
                </span>
              </div>
              <p className="text-sm mt-1">{evaluation.recommendedDeliveryTiming}</p>

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evaluation.alerts.map((al, idx) => (
                    <div key={idx} className="text-xs font-semibold text-red-700 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>{al}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Gestational Age (Weeks)</label>
              <input
                type="number"
                step="0.1"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="12.0"
                max="43.0"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Vasa Previa Type</label>
              <select
                value={vasaPreviaType}
                onChange={(e) => setVasaPreviaType(e.target.value as VasaPreviaType)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="type_1_velamentous_cord">Type I: Velamentous Cord Insertion</option>
                <option value="type_2_succenturiate_or_bilobed_lobe">Type II: Succenturiate / Bilobed Lobe</option>
                <option value="undetermined_aberrant_vessel">Aberrant Vessel (Undetermined)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Distance to Internal Os (mm)</label>
              <input
                type="number"
                step="0.5"
                value={distanceToInternalOsMm}
                onChange={(e) => setDistanceToInternalOsMm(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="0"
                max="100"
                required
              />
              <span className="text-[11px] text-gray-500">Diagnostic if ≤ 20 mm (2.0 cm)</span>
            </div>
          </div>

          {/* Ultrasound & Cervical length */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={colorDopplerConfirmed}
                  onChange={(e) => setColorDopplerConfirmed(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Color Doppler Transvaginal US Confirmed
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cervical Length (mm)</label>
              <input
                type="number"
                step="0.5"
                value={cervicalLengthMm}
                onChange={(e) => setCervicalLengthMm(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                placeholder="e.g. 32.0"
              />
              <span className="text-[11px] text-gray-500">&lt; 25 mm indicates preterm delivery risk</span>
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={corticosteroidsAdministered}
                  onChange={(e) => setCorticosteroidsAdministered(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Antenatal Betamethasone Course Completed
              </label>
            </div>
          </div>

          {/* Bleeding & Apt test */}
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
              Emergency Exsanguination Triad: Bleeding, Apt Test & Membranes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 text-xs font-semibold text-red-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vaginalBleedingPresent}
                    onChange={(e) => setVaginalBleedingPresent(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  Vaginal Bleeding Present (Stat Red Flag)
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Apt Alkali Denaturation Test</label>
                <select
                  value={aptTestResult}
                  onChange={(e) => setAptTestResult(e.target.value as AptTestResult)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
                >
                  <option value="not_performed">Not Performed / No Bleeding</option>
                  <option value="positive_fetal_hemoglobin_pink">Positive (HbF Resistant - Stays Pink: Fetal Blood!)</option>
                  <option value="negative_maternal_hemoglobin_yellow_brown">Negative (HbA Denatured - Yellow/Brown: Maternal)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Membrane Status</label>
                <select
                  value={membraneStatus}
                  onChange={(e) => setMembraneStatus(e.target.value as MembraneStatus)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                >
                  <option value="intact">Intact Membranes</option>
                  <option value="ruptured_spontaneous">Ruptured Membranes (High Risk Exsanguination)</option>
                  <option value="artificial_rupture_contraindicated">Amniotomy STRICTLY Contraindicated</option>
                </select>
              </div>
            </div>
          </div>

          {/* CTG & FHR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">CTG Fetal Tracing Pattern</label>
              <select
                value={ctgPattern}
                onChange={(e) => setCtgPattern(e.target.value as CtgPattern)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
              >
                <option value="category_1_normal">Category 1: Normal Reactive Baseline</option>
                <option value="category_2_variable_decelerations">Category 2: Variable Decelerations (Vessel Compression)</option>
                <option value="category_3_sinusoidal_pattern">Category 3: SINUSOIDAL (Profound Fetal Anemia / Crash CS)</option>
                <option value="category_3_severe_prolonged_bradycardia">Category 3: Severe Prolonged Bradycardia (&lt;100 bpm)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fetal Heart Rate (bpm)</label>
              <input
                type="number"
                value={fetalHeartRateBpm}
                onChange={(e) => setFetalHeartRateBpm(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="40"
                max="220"
                placeholder="e.g. 140"
              />
            </div>
          </div>

          {/* Planned Delivery Window & Protocol Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Elective Delivery Window</label>
              <select
                value={electiveDeliveryWindowWeeks}
                onChange={(e) => setElectiveDeliveryWindowWeeks(e.target.value as ElectiveDeliveryWindow)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="34_0_to_35_6_weeks">Target 34 0/7 to 35 6/7 Weeks (ACOG Consensus)</option>
                <option value="emergent_crash_cesarean">Emergent Crash Cesarean (Immediate Delivery)</option>
                <option value="outpatient_surveillance_pre_34w">Outpatient Surveillance (&lt;32-34 Weeks)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Protocol Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ObstetricVasaPreviaRecord['status'])}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
              >
                <option value="antenatal_surveillance">Antenatal Surveillance (Outpatient)</option>
                <option value="inpatient_rupture_precautions">Inpatient Rupture Precautions (32-34w)</option>
                <option value="emergent_crash_cesarean_section">Category 1 Crash Cesarean Section</option>
                <option value="postpartum_neonatal_resuscitation">Postpartum Neonatal Resuscitation</option>
                <option value="resolved_maternal_neonatal_discharge">Resolved / Discharged Healthy</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Notes</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm"
              placeholder="Ultrasound details, neonatal blood bank prep, operating room notifications..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-700 text-white rounded text-sm font-semibold hover:bg-rose-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Protocol' : 'Save Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
