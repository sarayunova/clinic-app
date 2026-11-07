import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMaternalVteAssessments,
  type MaternalVteAssessmentRecord,
} from '../api';

export const MaternalVtePage: React.FC = () => {
  const [assessments, setAssessments] = useState<MaternalVteAssessmentRecord[]>([]);
  const [riskTierFilter, setRiskTierFilter] = useState<string>('all');
  const [assessmentTypeFilter, setAssessmentTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMaternalVteAssessments({
        riskTier: riskTierFilter === 'all' ? undefined : riskTierFilter,
        assessmentType: assessmentTypeFilter === 'all' ? undefined : assessmentTypeFilter,
      });
      setAssessments(res.assessments);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Maternal VTE roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [riskTierFilter, assessmentTypeFilter]);

  const totalCount = assessments.length;
  const highRiskCount = assessments.filter(a => a.risk_tier === 'high_immediate_prophylaxis_indicated').length;
  const intermediateCount = assessments.filter(a => a.risk_tier === 'intermediate_prophylaxis_indicated').length;
  const lmwhPrescribedCount = assessments.filter(a => a.lmwh_prescribed === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-gradient-to-r from-rose-900 to-pink-900 text-white p-6 rounded-2xl shadow-md">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <span>🩸</span> Maternal VTE Thromboprophylaxis Console
          </h1>
          <p className="text-sm text-rose-200 mt-1">
            RCOG Green-top 37a & ACOG Bulletin 196 • Weight-Tiered LMWH Dosing, Stockings & 12h Neuraxial Safety Clearance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/patients"
            className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold shadow"
          >
            ← Patient Directory
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase">Total Assessments</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalCount}</p>
          <span className="text-xs text-gray-400">Antenatal & Postnatal</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
          <span className="text-xs font-bold text-rose-700 uppercase">High Risk (Score ≥ 4)</span>
          <p className="text-2xl font-black text-rose-900 mt-1">{highRiskCount}</p>
          <span className="text-xs text-rose-700">Immediate LMWH indicated</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs font-bold text-amber-700 uppercase">Intermediate Risk (Score 2-3)</span>
          <p className="text-2xl font-black text-amber-800 mt-1">{intermediateCount}</p>
          <span className="text-xs text-amber-700">Prophylaxis indicated</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-sky-200 shadow-sm">
          <span className="text-xs font-bold text-sky-700 uppercase">LMWH Prescribed</span>
          <p className="text-2xl font-black text-sky-900 mt-1">{lmwhPrescribedCount}</p>
          <span className="text-xs text-sky-700">Enoxaparin / Dalteparin active</span>
        </div>
      </div>

      {/* Roster & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Stage:</span>
              <select
                value={assessmentTypeFilter}
                onChange={(e) => setAssessmentTypeFilter(e.target.value)}
                className="text-xs border rounded-lg px-2.5 py-1.5 font-medium bg-gray-50 text-gray-800"
              >
                <option value="all">All Stages</option>
                <option value="antenatal_early">Antenatal Early (Booking)</option>
                <option value="antenatal_intrapartum">Antenatal / Admission</option>
                <option value="postnatal">Postnatal (Postpartum)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Risk Tier:</span>
              <select
                value={riskTierFilter}
                onChange={(e) => setRiskTierFilter(e.target.value)}
                className="text-xs border rounded-lg px-2.5 py-1.5 font-medium bg-gray-50 text-gray-800"
              >
                <option value="all">All Risk Tiers</option>
                <option value="high_immediate_prophylaxis_indicated">High Risk</option>
                <option value="intermediate_prophylaxis_indicated">Intermediate Risk</option>
                <option value="low_mobilization_hydration">Low Risk</option>
              </select>
            </div>
          </div>
          <button
            onClick={fetchAssessments}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border rounded-lg bg-gray-50"
          >
            ↻ Refresh Roster
          </button>
        </div>

        {loading && <p className="text-center text-sm text-gray-500 py-8">Loading VTE roster...</p>}
        {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {!loading && assessments.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No maternal VTE assessments found matching the selected filters.
          </div>
        )}

        {!loading && assessments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2 text-left">Date / Stage</th>
                  <th className="px-3 py-2 text-left">Maternal Patient / UHID</th>
                  <th className="px-3 py-2 text-center">GA / Weight / BMI</th>
                  <th className="px-3 py-2 text-center">RCOG Score</th>
                  <th className="px-3 py-2 text-center">Risk Tier</th>
                  <th className="px-3 py-2 text-center">LMWH Regimen</th>
                  <th className="px-3 py-2 text-center">Assessed By</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assessments.map((a) => {
                  const badgeColor =
                    a.risk_tier === 'high_immediate_prophylaxis_indicated'
                      ? 'bg-rose-100 text-rose-900 font-black'
                      : a.risk_tier === 'intermediate_prophylaxis_indicated'
                      ? 'bg-amber-100 text-amber-900 font-bold'
                      : 'bg-emerald-100 text-emerald-900 font-semibold';

                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-900">
                        <div>{new Date(a.assessment_datetime).toLocaleDateString()}</div>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">{a.assessment_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/patients/${a.patient_id}?tab=maternal_vte`}
                          className="font-bold text-rose-700 hover:underline"
                        >
                          {a.patient_name}
                        </Link>
                        <div className="text-[10px] text-gray-400">{a.patient_uhid}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="font-semibold">{a.gestational_age_weeks ? `${a.gestational_age_weeks}w` : 'Postnatal'}</div>
                        <div className="text-[10px] text-gray-500">{a.current_weight_kg} kg • BMI {a.bmi}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-base font-black text-rose-950">{a.total_vte_score}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${badgeColor}`}>
                          {a.risk_tier.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {a.lmwh_prescribed === 1 ? (
                          <div>
                            <span className="font-bold text-sky-900 text-[10px] uppercase">{a.lmwh_agent || 'LMWH'}</span>
                            <div className="text-[10px] text-gray-600">{a.lmwh_daily_dose_mg_or_units}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Mobilize & Hydrate</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 text-[10px]">
                        {a.assessed_by_name || 'Staff'}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            to={`/patients/${a.patient_id}?tab=maternal_vte`}
                            className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-semibold text-[10px]"
                          >
                            Chart Tab
                          </Link>
                          <Link
                            to={`/maternal-vte/print/${a.id}`}
                            className="px-2 py-1 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded font-semibold text-[10px]"
                          >
                            🖨️ Dossier
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
