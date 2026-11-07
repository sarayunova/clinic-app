import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getMaternalSepsisAssessments,
  getMaternalSepsisAssessment,
  deleteMaternalSepsisAssessment,
  deleteMaternalSepsisBundle,
  type MaternalSepsisRecord,
  type MaternalBundleRecord,
} from '../api';
import { MaternalSepsisModal } from './MaternalSepsisModal';
import { MaternalBundleModal } from './MaternalBundleModal';

interface MaternalSepsisTabProps {
  patientId: number;
  patientName: string;
}

export const MaternalSepsisTab: React.FC<MaternalSepsisTabProps> = ({ patientId, patientName }) => {
  const [assessments, setAssessments] = useState<MaternalSepsisRecord[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [activeAssessment, setActiveAssessment] = useState<MaternalSepsisRecord | null>(null);
  const [bundleLogs, setBundleLogs] = useState<MaternalBundleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMaternalSepsisAssessments({ patientId });
      setAssessments(res.assessments);
      const first = res.assessments[0];
      if (first) {
        setSelectedAssessmentId(first.id);
        fetchDetails(first.id);
      } else {
        setSelectedAssessmentId(null);
        setActiveAssessment(null);
        setBundleLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load maternal sepsis assessments');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: number) => {
    try {
      const res = await getMaternalSepsisAssessment(id);
      setActiveAssessment(res.assessment);
      setBundleLogs(res.bundleLogs);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [patientId]);

  const handleSelect = (id: number) => {
    setSelectedAssessmentId(id);
    fetchDetails(id);
  };

  const handleDeleteAssessment = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this sepsis assessment and its bundle logs?')) return;
    try {
      await deleteMaternalSepsisAssessment(id);
      fetchAssessments();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete assessment');
    }
  };

  const handleDeleteBundle = async (logId: number) => {
    if (!window.confirm('Delete this bundle intervention record?')) return;
    try {
      await deleteMaternalSepsisBundle(logId);
      if (selectedAssessmentId) fetchDetails(selectedAssessmentId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete bundle log');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Bar */}
      <div className="bg-gradient-to-r from-rose-900 via-pink-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-rose-700/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-white/10 rounded-xl">🚨</span>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                Maternal Critical Care Sepsis &amp; Obstetric Shock Index
              </h2>
              <p className="text-xs text-rose-200 mt-0.5">
                Albright Sepsis in Obstetrics Score (SOS) · Obstetric Shock Index (SI = HR / SBP) · FIGO / ACOG Hour-1 Sepsis Bundle Execution
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAssessmentModalOpen(true)}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-1.5"
          >
            <span>+</span> Sepsis Evaluation
          </button>
          {selectedAssessmentId && (
            <Link
              to={`/maternal-sepsis/${selectedAssessmentId}/print`}
              target="_blank"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <span>🖨️</span> Dossier
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
          Loading maternal sepsis evaluations and bundle records...
        </div>
      ) : assessments.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <span className="text-4xl block mb-2">🤰</span>
          <h3 className="text-base font-bold text-slate-800">No Maternal Sepsis Assessments Recorded</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Evaluate intrapartum or postpartum fever, tachycardia, hypotension, leukocytosis, and elevated shock index for early critical care intervention.
          </p>
          <button
            type="button"
            onClick={() => setIsAssessmentModalOpen(true)}
            className="mt-4 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs rounded-xl shadow transition"
          >
            Start Sepsis in Obstetrics (SOS) Score
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Assessments List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Sepsis Screens ({assessments.length})
            </h3>
            <div className="space-y-2">
              {assessments.map((a) => {
                const isSel = a.id === selectedAssessmentId;
                const riskColor =
                  a.sos_risk_level === 'severe_septic_shock' || a.shock_index_tier === 'critical_shock_gte_1_4'
                    ? 'border-red-500 bg-red-50/50'
                    : a.sos_risk_level === 'intermediate_risk' || a.shock_index_tier === 'elevated_warning_0_9_to_1_4'
                    ? 'border-amber-500 bg-amber-50/50'
                    : 'border-slate-300 bg-white';

                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelect(a.id)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition ${
                      isSel ? 'border-rose-600 bg-rose-50/60 shadow-sm' : riskColor
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800">
                        {a.assessment_code || `SOS-#${a.id}`}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(a.assessment_datetime).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-black text-rose-700">
                        SOS: {a.sos_score}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        SI: {Number(a.obstetric_shock_index).toFixed(2)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.sos_risk_level === 'severe_septic_shock'
                            ? 'bg-red-100 text-red-900'
                            : a.sos_risk_level === 'intermediate_risk'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {a.sos_risk_level.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 capitalize truncate max-w-[90px]">
                        {a.suspected_source?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Assessment Details and Bundle Logs */}
          {activeAssessment && (
            <div className="lg:col-span-3 space-y-6">
              {/* Scoring & Shock Index Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {activeAssessment.assessment_code}
                      </span>
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                          activeAssessment.sos_risk_level === 'severe_septic_shock'
                            ? 'bg-red-600 text-white'
                            : activeAssessment.sos_risk_level === 'intermediate_risk'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {activeAssessment.sos_risk_level.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        Assessed {new Date(activeAssessment.assessment_datetime).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1 capitalize">
                      Source: <span className="font-bold text-rose-700">{activeAssessment.suspected_source?.replace(/_/g, ' ')}</span>
                      {activeAssessment.gestational_age_weeks && ` · Gestational Age: ${activeAssessment.gestational_age_weeks}w`}
                      {activeAssessment.postpartum_days != null && ` · Postpartum Day: ${activeAssessment.postpartum_days}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteAssessment(activeAssessment.id)}
                      className="text-xs text-red-500 hover:text-red-700 p-1"
                      title="Delete assessment"
                    >
                      🗑️ Delete Assessment
                    </button>
                  </div>
                </div>

                {/* Score & Shock Index Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
                    <div className="text-[10px] uppercase font-bold text-rose-800">Albright SOS Score</div>
                    <div className="text-2xl font-black text-rose-900 mt-0.5">
                      {activeAssessment.sos_score} <span className="text-xs font-normal text-rose-700">/ 28</span>
                    </div>
                    <div className="text-[10px] text-rose-700">Score &ge; 6: Intermediate; &ge; 8: High Risk</div>
                  </div>

                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                    <div className="text-[10px] uppercase font-bold text-amber-800">Obstetric Shock Index</div>
                    <div className="text-2xl font-black text-amber-900 mt-0.5">
                      {Number(activeAssessment.obstetric_shock_index).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-amber-700 capitalize">
                      {activeAssessment.shock_index_tier?.replace(/_/g, ' ')}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Mean Arterial Pressure (MAP)</div>
                    <div className="text-2xl font-black text-slate-800 mt-0.5">
                      {activeAssessment.mean_arterial_pressure_mmhg} <span className="text-xs font-normal">mmHg</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {activeAssessment.mean_arterial_pressure_mmhg >= 65 ? '✅ Target Met (≥65)' : '⚠️ Hypotensive (<65)'}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border">
                    <div className="text-[10px] uppercase font-bold text-slate-500">ICU Transfer Status</div>
                    <div className="text-xl font-black text-slate-800 mt-1">
                      {activeAssessment.icu_transfer_recommended ? '🚨 Recommended' : 'Ward Observation'}
                    </div>
                    <div className="text-[10px] text-slate-500">HDU / Critical Care</div>
                  </div>
                </div>

                {/* Vitals Summary Breakdown */}
                <div className="bg-slate-50 rounded-xl p-3 border text-xs grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <div><span className="text-slate-500">Temp:</span> <span className="font-bold">{activeAssessment.temperature_celsius}°C</span></div>
                  <div><span className="text-slate-500">BP:</span> <span className="font-bold">{activeAssessment.systolic_bp_mmhg}/{activeAssessment.diastolic_bp_mmhg}</span></div>
                  <div><span className="text-slate-500">HR:</span> <span className="font-bold text-rose-700">{activeAssessment.heart_rate_bpm} bpm</span></div>
                  <div><span className="text-slate-500">RR:</span> <span className="font-bold">{activeAssessment.respiratory_rate_bpm} bpm</span></div>
                  <div><span className="text-slate-500">SpO2:</span> <span className="font-bold">{activeAssessment.spo2_percent}%</span></div>
                  <div><span className="text-slate-500">Lactate:</span> <span className="font-bold">{activeAssessment.serum_lactate_mmol_l ? `${activeAssessment.serum_lactate_mmol_l} mmol/L` : '—'}</span></div>
                </div>

                {activeAssessment.clinical_impression && (
                  <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-xs text-rose-950">
                    <strong>Impression:</strong> {activeAssessment.clinical_impression}
                  </div>
                )}
              </div>

              {/* Hour-1 Bundle Execution Section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>⚡</span> FIGO/ACOG Hour-1 Sepsis Bundle Execution ({bundleLogs.length} Entries)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Blood cultures prior to antimicrobials, broad-spectrum IV antibiotics within 60m, 30 mL/kg fluid bolus, vasopressors, serial lactate.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBundleModalOpen(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-700 hover:to-pink-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <span>+</span> Log Bundle Step
                  </button>
                </div>

                {bundleLogs.length === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50 text-slate-500 text-xs">
                    No bundle execution logs recorded yet. Begin by logging Hour-1 interventions.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b font-bold">
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Cultures</th>
                          <th className="p-2.5">IV Antibiotics</th>
                          <th className="p-2.5">&lt; 60m</th>
                          <th className="p-2.5">Fluids (30 mL/kg)</th>
                          <th className="p-2.5">Vasopressor</th>
                          <th className="p-2.5">MAP ≥ 65</th>
                          <th className="p-2.5">Repeat Lactate</th>
                          <th className="p-2.5">Urine Output</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-800">
                        {bundleLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 font-bold text-slate-800 whitespace-nowrap">
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2.5">
                              {log.blood_cultures_drawn ? (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                  ✅ Drawn
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Pending</span>
                              )}
                            </td>
                            <td className="p-2.5 text-[11px] font-semibold text-slate-800 max-w-xs truncate">
                              {log.iv_antibiotics_given ? log.antibiotic_name_regimen || 'Started' : '—'}
                            </td>
                            <td className="p-2.5">
                              {log.antibiotic_within_60m ? (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                  ⚡ &lt; 60m
                                </span>
                              ) : (
                                <span className="text-amber-700 text-[10px]">Delayed</span>
                              )}
                            </td>
                            <td className="p-2.5 text-[11px]">
                              {log.fluid_bolus_30ml_per_kg_given ? (
                                <span className="font-semibold">{log.fluid_bolus_volume_ml ? `${log.fluid_bolus_volume_ml} mL` : 'Bolus Given'}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-2.5 text-[11px]">
                              {log.norepinephrine_vasopressor_active ? (
                                <span className="text-rose-700 font-bold">
                                  Active {log.vasopressor_dose_mcg_min ? `(${log.vasopressor_dose_mcg_min} mcg/m)` : ''}
                                </span>
                              ) : (
                                'None'
                              )}
                            </td>
                            <td className="p-2.5">
                              {log.target_map_achieved_gte_65 ? (
                                <span className="text-emerald-700 font-bold text-[11px]">✅ Yes</span>
                              ) : (
                                <span className="text-red-600 font-bold text-[11px]">❌ &lt; 65</span>
                              )}
                            </td>
                            <td className="p-2.5 font-bold">
                              {log.repeat_lactate_mmol_l ? `${log.repeat_lactate_mmol_l} mmol/L` : '—'}
                            </td>
                            <td className="p-2.5 text-[11px]">
                              {log.urine_output_ml_hr ? `${log.urine_output_ml_hr} mL/hr` : '—'}
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteBundle(log.id)}
                                className="text-red-400 hover:text-red-700 font-bold text-xs"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sepsis Assessment Modal */}
      <MaternalSepsisModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isAssessmentModalOpen}
        onClose={() => setIsAssessmentModalOpen(false)}
        onSuccess={() => {
          fetchAssessments();
        }}
      />

      {/* Bundle Execution Modal */}
      {selectedAssessmentId && (
        <MaternalBundleModal
          sepsisAssessmentId={selectedAssessmentId}
          patientName={patientName}
          isOpen={isBundleModalOpen}
          onClose={() => setIsBundleModalOpen(false)}
          onSuccess={() => {
            fetchDetails(selectedAssessmentId);
          }}
        />
      )}
    </div>
  );
};
