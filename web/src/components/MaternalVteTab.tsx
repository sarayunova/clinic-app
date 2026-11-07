import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getMaternalVteAssessments,
  getMaternalVteAssessment,
  deleteMaternalVteAssessment,
  deleteMaternalVteDose,
  type MaternalVteAssessmentRecord,
  type MaternalVteDoseLogRecord,
} from '../api';
import { MaternalVteModal } from './MaternalVteModal';
import { VteDoseModal } from './VteDoseModal';

interface MaternalVteTabProps {
  patientId: number;
  patientName: string;
}

export const MaternalVteTab: React.FC<MaternalVteTabProps> = ({ patientId, patientName }) => {
  const [assessments, setAssessments] = useState<MaternalVteAssessmentRecord[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [activeAssessment, setActiveAssessment] = useState<MaternalVteAssessmentRecord | null>(null);
  const [doseLogs, setDoseLogs] = useState<MaternalVteDoseLogRecord[]>([]);
  const [neuraxialStatus, setNeuraxialStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isDoseModalOpen, setIsDoseModalOpen] = useState(false);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMaternalVteAssessments({ patientId });
      setAssessments(res.assessments);
      const first = res.assessments[0];
      if (first) {
        setSelectedAssessmentId(first.id);
        fetchDetails(first.id);
      } else {
        setSelectedAssessmentId(null);
        setActiveAssessment(null);
        setDoseLogs([]);
        setNeuraxialStatus(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load Maternal VTE assessments');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: number) => {
    try {
      const res = await getMaternalVteAssessment(id);
      setActiveAssessment(res.assessment);
      setDoseLogs(res.doseLogs);
      setNeuraxialStatus(res.neuraxialStatus);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [patientId]);

  const handleSelectAssessment = (id: number) => {
    setSelectedAssessmentId(id);
    fetchDetails(id);
  };

  const handleDeleteAssessment = async () => {
    if (!activeAssessment || !window.confirm(`Delete Maternal VTE assessment for ID ${activeAssessment.id}?`)) return;
    try {
      await deleteMaternalVteAssessment(activeAssessment.id);
      fetchAssessments();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete assessment');
    }
  };

  const handleDeleteDose = async (doseId: number) => {
    if (!window.confirm('Delete this LMWH dose record?')) return;
    try {
      await deleteMaternalVteDose(doseId);
      if (selectedAssessmentId) fetchDetails(selectedAssessmentId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete dose');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-rose-950 flex items-center gap-2">
            <span>🩸</span> Maternal VTE Risk & Thromboprophylaxis
          </h2>
          <p className="text-xs text-gray-500">
            RCOG Green-top 37a & ACOG Bulletin 196 • Weight-Tiered LMWH Dosing & 12h Neuraxial Safety Clearance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeAssessment && (
            <Link
              to={`/maternal-vte/print/${activeAssessment.id}`}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border flex items-center gap-1"
            >
              <span>🖨️</span> Print Dossier
            </Link>
          )}
          <button
            onClick={() => setIsAssessmentModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white rounded shadow flex items-center gap-1"
          >
            <span>+</span> New VTE Risk Assessment
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-sm text-gray-500 py-6">Loading VTE records...</p>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {!loading && assessments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No Maternal VTE risk assessments recorded for {patientName}.</p>
          <button
            onClick={() => setIsAssessmentModalOpen(true)}
            className="mt-3 px-4 py-2 text-xs font-bold bg-rose-700 text-white rounded hover:bg-rose-800"
          >
            Perform RCOG VTE Assessment
          </button>
        </div>
      )}

      {assessments.length > 0 && activeAssessment && (
        <div className="space-y-6">
          {/* Assessment Tabs */}
          {assessments.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {assessments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectAssessment(a.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedAssessmentId === a.id
                      ? 'bg-rose-900 text-white border-rose-900 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {a.assessment_type.replace(/_/g, ' ').toUpperCase()} ({new Date(a.assessment_datetime).toLocaleDateString()}) - Score {a.total_vte_score}
                </button>
              ))}
            </div>
          )}

          {/* Hero Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <span className="text-xs font-bold uppercase text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {activeAssessment.assessment_type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  Assessed: {new Date(activeAssessment.assessment_datetime).toLocaleString()} by {activeAssessment.assessed_by_name}
                </span>
              </div>
              <button
                onClick={handleDeleteAssessment}
                className="text-xs text-red-600 hover:text-red-800 font-semibold"
              >
                Delete Assessment
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-100">
                <span className="text-[10px] font-bold text-rose-800 uppercase">RCOG VTE Risk Score</span>
                <p className="text-2xl font-black text-rose-950 mt-1">{activeAssessment.total_vte_score} Points</p>
                <span className="text-[10px] text-rose-700 font-bold uppercase">
                  {activeAssessment.risk_tier.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Weight & BMI</span>
                <p className="text-lg font-bold text-gray-900 mt-1">{activeAssessment.current_weight_kg} kg • {activeAssessment.bmi} kg/m²</p>
                <span className="text-[10px] text-gray-500">{activeAssessment.weight_tier_bracket || 'Standard'}</span>
              </div>
              <div className="p-3 bg-sky-50 rounded-lg border border-sky-100">
                <span className="text-[10px] font-bold text-sky-800 uppercase">LMWH Prescription</span>
                <p className="text-sm font-bold text-sky-950 mt-1">
                  {activeAssessment.lmwh_prescribed === 1
                    ? `${activeAssessment.lmwh_agent?.toUpperCase() || 'LMWH'}`
                    : 'Not Prescribed'}
                </p>
                <span className="text-[10px] text-sky-700 font-semibold">
                  {activeAssessment.lmwh_daily_dose_mg_or_units || 'Mobilization & hydration'}
                </span>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-[10px] font-bold text-purple-800 uppercase">Anti-Embolic Stockings</span>
                <p className="text-sm font-bold text-purple-950 mt-1">
                  {activeAssessment.anti_embolic_stockings_ordered === 1 ? 'Ordered & Fitted (GECS)' : 'Not Ordered'}
                </p>
                <span className="text-[10px] text-purple-700">Knee/thigh-length compression</span>
              </div>
            </div>

            {/* Critical Neuraxial Anesthesia Safety Clearance Widget */}
            {neuraxialStatus && (
              <div className={`p-4 rounded-xl border-2 flex flex-wrap items-center justify-between gap-3 ${
                neuraxialStatus.isEligibleNow
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-rose-50 border-rose-500 text-rose-950'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{neuraxialStatus.isEligibleNow ? '✅' : '🛑'}</span>
                    <span className="text-sm font-black uppercase tracking-wide">
                      {neuraxialStatus.isEligibleNow
                        ? 'Safe for Neuraxial Regional Anesthesia (Spinal / Epidural)'
                        : 'NEURAXIAL ANESTHESIA CONTRAINDICATED (HIGH HEMATOMA RISK)'}
                    </span>
                  </div>
                  <p className="text-xs font-medium">
                    {neuraxialStatus.warningAlert || neuraxialStatus.statusLabel}
                  </p>
                </div>
                {neuraxialStatus.nextSafeNeuraxialTime && !neuraxialStatus.isEligibleNow && (
                  <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-rose-300">
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Safe Window Begins At:</span>
                    <span className="font-mono text-xs font-bold text-rose-900">
                      {new Date(neuraxialStatus.nextSafeNeuraxialTime).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dose Administration Flowsheet */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                  <span>💉</span> LMWH Dose Logs & Anti-Xa / Platelet Surveillance
                </h3>
                <p className="text-xs text-gray-500">
                  Every dose triggers the 12-hour safe spinal/epidural clearance blackout window.
                </p>
              </div>
              <button
                onClick={() => setIsDoseModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold bg-rose-700 text-white rounded hover:bg-rose-800 shadow"
              >
                + Record LMWH Dose
              </button>
            </div>

            {doseLogs.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">
                No LMWH doses logged yet for this assessment episode. Click above to record an administration.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Administered At</th>
                      <th className="px-3 py-2 text-left">Agent & Dose</th>
                      <th className="px-3 py-2 text-center">Injection Site</th>
                      <th className="px-3 py-2 text-center">Platelet Count</th>
                      <th className="px-3 py-2 text-center">Bleeding Signs</th>
                      <th className="px-3 py-2 text-left">Nurse / Notes</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {doseLogs.map((dose) => (
                      <tr key={dose.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                          {new Date(dose.administered_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-rose-900">
                          {dose.agent} • {dose.dose}
                        </td>
                        <td className="px-3 py-2.5 text-center uppercase font-semibold text-gray-700">
                          {dose.site?.replace(/_/g, ' ') || 'Subcutaneous'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700">
                          {dose.platelet_count ? `${dose.platelet_count.toLocaleString()}/µL` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${dose.bleeding_signs_observed === 1 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {dose.bleeding_signs_observed === 1 ? 'BLEEDING NOTED' : 'None'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-xs truncate">
                          {dose.notes || '—'} {dose.administered_by_name && `(${dose.administered_by_name})`}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleDeleteDose(dose.id)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ×
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

      {/* Modals */}
      <MaternalVteModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isAssessmentModalOpen}
        onClose={() => setIsAssessmentModalOpen(false)}
        onSuccess={() => {
          setIsAssessmentModalOpen(false);
          fetchAssessments();
        }}
      />

      {activeAssessment && (
        <VteDoseModal
          assessmentId={activeAssessment.id}
          isOpen={isDoseModalOpen}
          onClose={() => setIsDoseModalOpen(false)}
          onSuccess={() => {
            setIsDoseModalOpen(false);
            fetchDetails(activeAssessment.id);
          }}
          defaultAgent={activeAssessment.lmwh_agent ? `${activeAssessment.lmwh_agent.toUpperCase()}` : 'Enoxaparin'}
          defaultDose={activeAssessment.lmwh_daily_dose_mg_or_units || '40 mg SC'}
        />
      )}
    </div>
  );
};
