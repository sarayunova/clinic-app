import React, { useState } from 'react';
import {
  createObstetricPdphEpisode,
  type ObstetricPdphRecord,
} from '../api';
import {
  evaluateObstetricPdph,
  type ObstetricPdphEvaluationResult,
} from '../obstetricPdphEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricPdphRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricPdphModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [procedureType, setProcedureType] = useState<
    'labor_epidural_adp' | 'spinal_anesthesia' | 'combined_spinal_epidural' | 'diagnostic_lumbar_puncture'
  >(existingEpisode?.procedure_type ?? 'labor_epidural_adp');

  const [punctureDatetime, setPunctureDatetime] = useState(
    existingEpisode?.puncture_datetime || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 16),
  );

  const [needleGauge, setNeedleGauge] = useState<
    '16G_tuohy' | '17G_tuohy' | '18G_tuohy' | '22G_quincke' | '25G_whitacre' | '27G_whitacre' | 'other'
  >((existingEpisode?.needle_gauge as any) ?? '16G_tuohy');

  const [headacheOnsetDatetime, setHeadacheOnsetDatetime] = useState(
    existingEpisode?.headache_onset_datetime || new Date().toISOString().slice(0, 16),
  );

  const [initialVasScore, setInitialVasScore] = useState<number>(
    existingEpisode?.initial_vas_score ?? 8,
  );

  const [posturalComponent, setPosturalComponent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.postural_component) : true,
  );
  const [neckStiffness, setNeckStiffness] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.neck_stiffness) : false,
  );
  const [auditorySymptoms, setAuditorySymptoms] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.auditory_symptoms) : false,
  );
  const [visualSymptomsDiplopia, setVisualSymptomsDiplopia] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.visual_symptoms_diplopia) : false,
  );

  const [conservativeHydrationMl24h, setConservativeHydrationMl24h] = useState<number>(
    existingEpisode?.conservative_hydration_ml_24h ?? 2500,
  );
  const [caffeineAdministered, setCaffeineAdministered] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.caffeine_administered) : true,
  );
  const [analgesicsPrescribed, setAnalgesicsPrescribed] = useState<string>(
    existingEpisode?.analgesics_prescribed ?? 'Paracetamol 1000mg PO Q6H + Ibuprofen 400mg PO Q8H',
  );

  const [ebpIndicated, setEbpIndicated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.ebp_indicated) : true,
  );
  const [ebpPerformed, setEbpPerformed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.ebp_performed) : false,
  );
  const [ebpDatetime, setEbpDatetime] = useState<string>(
    existingEpisode?.ebp_datetime || '',
  );
  const [ebpBloodVolumeMl, setEbpBloodVolumeMl] = useState<number | undefined>(
    existingEpisode?.ebp_blood_volume_ml ?? 18,
  );
  const [ebpInterspace, setEbpInterspace] = useState<string>(
    existingEpisode?.ebp_interspace ?? 'L3-L4',
  );
  const [postEbpVasScore, setPostEbpVasScore] = useState<number | undefined>(
    existingEpisode?.post_ebp_vas_score ?? undefined,
  );

  const [redFlagsPresent, setRedFlagsPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.red_flags_present) : false,
  );
  const [redFlagNotes, setRedFlagNotes] = useState<string>(
    existingEpisode?.red_flag_notes ?? '',
  );

  const [status, setStatus] = useState<
    'conservative_management' | 'ebp_scheduled' | 'ebp_completed_resolving' | 'headache_resolved' | 'referred_neurology_imaging'
  >(existingEpisode?.status ?? 'conservative_management');

  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluation: ObstetricPdphEvaluationResult = evaluateObstetricPdph({
    procedureType,
    needleGauge,
    initialVasScore,
    posturalComponent,
    neckStiffness,
    auditorySymptoms,
    visualSymptomsDiplopia,
    conservativeHydrationMl24h,
    caffeineAdministered,
    redFlagsPresent,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createObstetricPdphEpisode({
        patientId,
        procedureType,
        punctureDatetime,
        needleGauge,
        headacheOnsetDatetime,
        initialVasScore,
        posturalComponent,
        neckStiffness,
        auditorySymptoms,
        visualSymptomsDiplopia,
        conservativeHydrationMl24h,
        caffeineAdministered,
        analgesicsPrescribed: analgesicsPrescribed || null,
        ebpIndicated: ebpIndicated || evaluation.ebpIndicated,
        ebpPerformed,
        ebpDatetime: ebpDatetime || null,
        ebpBloodVolumeMl: ebpBloodVolumeMl ?? null,
        ebpInterspace: ebpInterspace || null,
        postEbpVasScore: postEbpVasScore ?? null,
        redFlagsPresent: redFlagsPresent || evaluation.hasRedFlags,
        redFlagNotes: redFlagNotes || null,
        status,
        clinicalNotes: clinicalNotes || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save PDPH episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold text-gray-800">
            {existingEpisode ? 'Obstetric PDPH Episode' : 'Evaluate Obstetric PDPH & Epidural Blood Patch'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mt-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {/* Assessment Banner */}
          <div className="bg-rose-50 border border-rose-300 rounded p-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-rose-800">
                  Initial Headache Severity:
                </span>
                <span className="ml-2 text-2xl font-extrabold text-rose-950">
                  VAS {initialVasScore} / 10
                </span>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  evaluation.severityTier === 'severe'
                    ? 'bg-red-200 text-red-900'
                    : evaluation.severityTier === 'moderate'
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {evaluation.severityTierLabel}
              </span>
            </div>

            <div className="mt-2 text-rose-950 font-medium">
              <p><strong>EBP Indication:</strong> {evaluation.ebpUrgency.replace(/_/g, ' ').toUpperCase()}</p>
              <p className="mt-0.5"><strong>Recommended Volume:</strong> {evaluation.recommendedEbpVolumeMl}</p>
            </div>

            {evaluation.alerts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-rose-200 space-y-1">
                {evaluation.alerts.map((alt, idx) => (
                  <div key={idx} className="text-rose-800 font-semibold flex items-center gap-1">
                    <span>⚠</span> {alt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Procedure & Timing */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block font-medium text-gray-700">Procedure Type</label>
              <select
                value={procedureType}
                onChange={(e) => setProcedureType(e.target.value as any)}
                className="w-full border rounded p-1.5"
              >
                <option value="labor_epidural_adp">Labor Epidural (Accidental Dural Puncture)</option>
                <option value="spinal_anesthesia">Spinal Anesthesia (Cesarean)</option>
                <option value="combined_spinal_epidural">Combined Spinal Epidural (CSE)</option>
                <option value="diagnostic_lumbar_puncture">Diagnostic Lumbar Puncture</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700">Needle Gauge</label>
              <select
                value={needleGauge}
                onChange={(e) => setNeedleGauge(e.target.value as any)}
                className="w-full border rounded p-1.5"
              >
                <option value="16G_tuohy">16G Tuohy (High Risk)</option>
                <option value="17G_tuohy">17G Tuohy (High Risk)</option>
                <option value="18G_tuohy">18G Tuohy</option>
                <option value="22G_quincke">22G Quincke Cutting</option>
                <option value="25G_whitacre">25G Whitacre Pencil-Point</option>
                <option value="27G_whitacre">27G Whitacre Pencil-Point</option>
                <option value="other">Other / Unknown</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700">Puncture Timestamp</label>
              <input
                type="datetime-local"
                value={punctureDatetime}
                onChange={(e) => setPunctureDatetime(e.target.value)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700">Headache Onset</label>
              <input
                type="datetime-local"
                value={headacheOnsetDatetime}
                onChange={(e) => setHeadacheOnsetDatetime(e.target.value)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
          </div>

          {/* Clinical Features & Cranial Symptoms */}
          <div className="border rounded p-3">
            <h4 className="font-bold uppercase tracking-wider text-gray-800 mb-2">
              Symptom Profile & Cranial Nerve Involvements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2">
              <div>
                <label className="block font-medium text-gray-700">Initial Pain Score (VAS 0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={initialVasScore}
                  onChange={(e) => setInitialVasScore(parseInt(e.target.value, 10) || 0)}
                  className="w-full border rounded p-1.5 font-bold text-rose-900"
                  required
                />
              </div>

              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="postural"
                  checked={posturalComponent}
                  onChange={(e) => setPosturalComponent(e.target.checked)}
                />
                <label htmlFor="postural" className="font-semibold text-gray-800">
                  Postural: Worse Upright, Relieved Supine
                </label>
              </div>

              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="neck"
                  checked={neckStiffness}
                  onChange={(e) => setNeckStiffness(e.target.checked)}
                />
                <label htmlFor="neck" className="text-gray-800">
                  Neck Stiffness / Shoulder Pain
                </label>
              </div>

              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="auditory"
                  checked={auditorySymptoms}
                  onChange={(e) => setAuditorySymptoms(e.target.checked)}
                />
                <label htmlFor="auditory" className="text-gray-800">
                  Tinnitus / Hypoacusia (Auditory)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={visualSymptomsDiplopia}
                  onChange={(e) => setVisualSymptomsDiplopia(e.target.checked)}
                />
                <span className="font-semibold text-rose-900">
                  Diplopia / Cranial Nerve VI Palsy (Emergency EBP Indicator)
                </span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={redFlagsPresent}
                  onChange={(e) => setRedFlagsPresent(e.target.checked)}
                />
                <span className="font-semibold text-red-700">
                  Atypical Red Flags (Fever, Non-postural, Seizures, Focal Deficit)
                </span>
              </label>
            </div>

            {redFlagsPresent && (
              <div className="mt-2">
                <input
                  type="text"
                  value={redFlagNotes}
                  onChange={(e) => setRedFlagNotes(e.target.value)}
                  placeholder="Red flag specifics: Rule out CVST, Meningitis, SDH, Eclampsia..."
                  className="w-full border rounded p-1.5 bg-red-50 text-red-900"
                />
              </div>
            )}
          </div>

          {/* Conservative Medical Management */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block font-medium text-gray-700">Target Hydration (mL / 24h)</label>
              <input
                type="number"
                value={conservativeHydrationMl24h}
                onChange={(e) => setConservativeHydrationMl24h(parseInt(e.target.value, 10) || 2500)}
                className="w-full border rounded p-1.5"
              />
            </div>

            <div className="flex items-center space-x-2 pt-5">
              <input
                type="checkbox"
                id="caffeine"
                checked={caffeineAdministered}
                onChange={(e) => setCaffeineAdministered(e.target.checked)}
              />
              <label htmlFor="caffeine" className="font-medium text-gray-700">
                Oral / IV Caffeine Administered
              </label>
            </div>

            <div>
              <label className="block font-medium text-gray-700">Analgesic Prescription</label>
              <input
                type="text"
                value={analgesicsPrescribed}
                onChange={(e) => setAnalgesicsPrescribed(e.target.value)}
                className="w-full border rounded p-1.5"
              />
            </div>
          </div>

          {/* Epidural Blood Patch Section */}
          <div className="border border-rose-200 bg-rose-50/40 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold uppercase tracking-wider text-rose-900">
                Autologous Epidural Blood Patch (EBP) Execution
              </h4>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={ebpPerformed}
                  onChange={(e) => setEbpPerformed(e.target.checked)}
                />
                <span className="font-bold text-rose-900">EBP Performed</span>
              </label>
            </div>

            {ebpPerformed && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                <div>
                  <label className="block font-medium text-gray-700">EBP Timestamp</label>
                  <input
                    type="datetime-local"
                    value={ebpDatetime}
                    onChange={(e) => setEbpDatetime(e.target.value)}
                    className="w-full border rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Blood Injected (mL)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={ebpBloodVolumeMl ?? ''}
                    onChange={(e) => setEbpBloodVolumeMl(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="15 - 20 mL"
                    className="w-full border rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Interspace Level</label>
                  <input
                    type="text"
                    value={ebpInterspace}
                    onChange={(e) => setEbpInterspace(e.target.value)}
                    placeholder="e.g. L3-L4"
                    className="w-full border rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Post-EBP VAS (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={postEbpVasScore ?? ''}
                    onChange={(e) => setPostEbpVasScore(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    placeholder="0-10"
                    className="w-full border rounded p-1.5"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-medium text-gray-700">Clinical Management Notes</label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={2}
              className="w-full border rounded p-1.5"
              placeholder="Clinical evolution, bedrest compliance, post-patch observation..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-rose-600 text-white rounded font-bold hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save PDPH Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
