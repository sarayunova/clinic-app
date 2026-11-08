import React, { useState, useEffect } from 'react';
import {
  getObstetricVasaPreviaEpisodes,
  getObstetricVasaPreviaEpisode,
  updateObstetricVasaPreviaEpisode,
  type ObstetricVasaPreviaRecord,
  type ObstetricVasaPreviaFlowsheetRecord,
} from '../api';
import { ObstetricVasaPreviaModal } from './ObstetricVasaPreviaModal';
import { ObstetricVasaPreviaFlowsheetModal } from './ObstetricVasaPreviaFlowsheetModal';
import { type ObstetricVasaPreviaEvaluationResult } from '../obstetricVasaPreviaEngine';

interface Props {
  patientId: number;
}

export const ObstetricVasaPreviaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricVasaPreviaRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricVasaPreviaRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricVasaPreviaEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricVasaPreviaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricVasaPreviaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const firstId = res.episodes[0].id;
        setSelectedEpisodeId((prev) => (prev && res.episodes.some((e) => e.id === prev) ? prev : firstId));
      } else {
        setSelectedEpisodeId(null);
        setCurrentEpisode(null);
        setEvaluation(null);
        setFlowsheet([]);
      }
    } catch (err) {
      console.error('Error loading Vasa Previa episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricVasaPreviaEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading Vasa Previa details:', err);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  useEffect(() => {
    if (selectedEpisodeId) {
      loadEpisodeDetails(selectedEpisodeId);
    }
  }, [selectedEpisodeId]);

  const handleStatusChange = async (newStatus: ObstetricVasaPreviaRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateObstetricVasaPreviaEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        gestationalAgeWeeks: currentEpisode.gestational_age_weeks,
        vasaPreviaType: currentEpisode.vasa_previa_type,
        distanceToInternalOsMm: currentEpisode.distance_to_internal_os_mm,
        colorDopplerConfirmed: Boolean(currentEpisode.color_doppler_confirmed),
        cervicalLengthMm: currentEpisode.cervical_length_mm,
        vaginalBleedingPresent: Boolean(currentEpisode.vaginal_bleeding_present),
        aptTestResult: currentEpisode.apt_test_result,
        membraneStatus: currentEpisode.membrane_status,
        fetalHeartRateBpm: currentEpisode.fetal_heart_rate_bpm,
        ctgPattern: currentEpisode.ctg_pattern,
        corticosteroidsAdministered: Boolean(currentEpisode.corticosteroids_administered),
        electiveDeliveryWindowWeeks: currentEpisode.elective_delivery_window_weeks,
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      loadEpisodeDetails(currentEpisode.id);
      loadEpisodes();
    } catch (err) {
      console.error('Failed to update vasa previa status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-6 text-gray-500">Loading Vasa Previa episodes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Episode Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Obstetric Vasa Previa & Fetal Exsanguination Emergency Protocol
          </h2>
          <p className="text-xs text-gray-500">
            ACOG PB #204 • Transvaginal Color Doppler • Apt Test • Category 1 Crash Cesarean
          </p>
        </div>

        <div className="flex items-center gap-2">
          {episodes.length > 0 && (
            <select
              value={selectedEpisodeId || ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
              className="border rounded px-3 py-1.5 text-sm bg-white font-medium"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-rose-700 text-white rounded text-sm font-semibold hover:bg-rose-800"
          >
            + New Vasa Previa Episode
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500 text-sm">No vasa previa episode recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 bg-rose-700 text-white rounded text-sm font-medium hover:bg-rose-800"
          >
            Initiate Vasa Previa Evaluation
          </button>
        </div>
      ) : (
        <>
          {/* Urgency Alert & Recommendation Banner */}
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="font-bold text-base">{evaluation.urgencyTierLabel}</span>
                  <p className="text-xs mt-1 font-medium">{evaluation.recommendedDeliveryTiming}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs rounded-full font-bold uppercase bg-white border">
                    {currentEpisode.vasa_previa_type.replace(/_/g, ' ')}
                  </span>
                  <a
                    href={`/obstetric-vasa-previa/${currentEpisode.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-xs font-semibold"
                  >
                    🖨️ Printable Dossier
                  </a>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-3 py-1 bg-rose-800 text-white rounded text-xs font-semibold hover:bg-rose-900"
                  >
                    Edit Protocol
                  </button>
                </div>
              </div>

              {evaluation.alerts.length > 0 && (
                <div className="mt-3 space-y-1">
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

          {/* Status Progression Workflow */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="text-xs">
              <span className="font-semibold text-gray-500 uppercase tracking-wider">Protocol Status: </span>
              <span className="font-bold text-rose-800 ml-1 uppercase">
                {currentEpisode.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Update Phase:</span>
              <button
                onClick={() => handleStatusChange('antenatal_surveillance')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'antenatal_surveillance'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                1. Antenatal Outpatient
              </button>
              <button
                onClick={() => handleStatusChange('inpatient_rupture_precautions')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'inpatient_rupture_precautions'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                2. Inpatient Precautions
              </button>
              <button
                onClick={() => handleStatusChange('emergent_crash_cesarean_section')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'emergent_crash_cesarean_section'
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                3. Crash Cesarean
              </button>
              <button
                onClick={() => handleStatusChange('postpartum_neonatal_resuscitation')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'postpartum_neonatal_resuscitation'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                4. Neonatal Resus
              </button>
              <button
                onClick={() => handleStatusChange('resolved_maternal_neonatal_discharge')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'resolved_maternal_neonatal_discharge'
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                5. Discharge Healthy
              </button>
            </div>
          </div>

          {/* Assessment Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2">
                Anatomic & Ultrasound Criteria
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Gestational Age:</span>
                  <span className="font-semibold">{currentEpisode.gestational_age_weeks} weeks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance to Os:</span>
                  <span className="font-semibold text-rose-700">{currentEpisode.distance_to_internal_os_mm} mm (≤20mm)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Color Doppler:</span>
                  <span className="font-semibold text-green-700">
                    {currentEpisode.color_doppler_confirmed ? 'Confirmed' : 'Pending Doppler'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cervical Length:</span>
                  <span className="font-semibold">{currentEpisode.cervical_length_mm ? `${currentEpisode.cervical_length_mm} mm` : 'Not recorded'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Steroids Given:</span>
                  <span className="font-semibold">{currentEpisode.corticosteroids_administered ? 'Yes (Betamethasone)' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-2">
                Exsanguination Triad & CTG
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Vaginal Bleeding:</span>
                  <span className={`font-semibold ${currentEpisode.vaginal_bleeding_present ? 'text-red-600' : 'text-gray-700'}`}>
                    {currentEpisode.vaginal_bleeding_present ? 'ACTIVE BLEEDING' : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Apt Test Result:</span>
                  <span className="font-semibold text-rose-800">
                    {currentEpisode.apt_test_result.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Membranes:</span>
                  <span className="font-semibold">{currentEpisode.membrane_status.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fetal Heart Rate:</span>
                  <span className="font-semibold">{currentEpisode.fetal_heart_rate_bpm ? `${currentEpisode.fetal_heart_rate_bpm} bpm` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CTG Pattern:</span>
                  <span className={`font-semibold ${currentEpisode.ctg_pattern === 'category_3_sinusoidal_pattern' ? 'text-red-700 font-bold' : ''}`}>
                    {currentEpisode.ctg_pattern.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Neonatal Resuscitation Prep
              </h3>
              <div className="space-y-1 text-xs">
                {evaluation?.neonatalResuscitationPrepDirectives.map((dir, idx) => (
                  <div key={idx} className="flex items-start gap-1 text-gray-800 font-medium">
                    <span className="text-rose-600">•</span>
                    <span>{dir}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Flowsheet Log Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-gray-900">Vasa Previa Inpatient Surveillance Flowsheet</h3>
                <p className="text-xs text-gray-500">FHR baseline, CTG variability, bleeding severity, and uterine activity</p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 bg-rose-700 text-white rounded text-xs font-semibold hover:bg-rose-800"
              >
                + Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                No flowsheet entries recorded yet. Click "+ Add Checkpoint" to log CTG tracing and bleeding status.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">GA</th>
                      <th className="py-2.5 px-3">FHR (bpm)</th>
                      <th className="py-2.5 px-3">Variability</th>
                      <th className="py-2.5 px-3">Vaginal Bleeding</th>
                      <th className="py-2.5 px-3">Maternal BP / HR</th>
                      <th className="py-2.5 px-3">UC /10m</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 whitespace-nowrap">{log.log_datetime.replace('T', ' ')}</td>
                        <td className="py-2 px-3">{log.gestational_age_weeks}w</td>
                        <td className="py-2 px-3 font-bold text-rose-800">{log.fetal_heart_rate_bpm}</td>
                        <td className="py-2 px-3 capitalize">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              log.ctg_baseline_variability === 'sinusoidal'
                                ? 'bg-red-100 text-red-800 font-bold'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {log.ctg_baseline_variability.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3 capitalize font-medium text-rose-900">
                          {log.vaginal_bleeding_severity.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {log.maternal_systolic_bp}/{log.maternal_diastolic_bp} ({log.maternal_heart_rate})
                        </td>
                        <td className="py-2 px-3">{log.uterine_contractions_per_10min}</td>
                        <td className="py-2 px-3 max-w-xs truncate" title={log.notes || ''}>{log.notes || '—'}</td>
                        <td className="py-2 px-3 text-gray-500">{log.logged_by_name || `User #${log.logged_by_id}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <ObstetricVasaPreviaModal
          patientId={patientId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => loadEpisodes()}
        />
      )}

      {showEditModal && currentEpisode && (
        <ObstetricVasaPreviaModal
          patientId={patientId}
          existingEpisode={currentEpisode}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            loadEpisodes();
            loadEpisodeDetails(currentEpisode.id);
          }}
        />
      )}

      {showFlowsheetModal && currentEpisode && (
        <ObstetricVasaPreviaFlowsheetModal
          episodeId={currentEpisode.id}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(currentEpisode.id)}
        />
      )}
    </div>
  );
};
