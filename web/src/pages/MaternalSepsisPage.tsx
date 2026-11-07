import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMaternalSepsisAssessments,
  type MaternalSepsisRecord,
} from '../api';

export const MaternalSepsisPage: React.FC = () => {
  const [assessments, setAssessments] = useState<MaternalSepsisRecord[]>([]);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMaternalSepsisAssessments();
      setAssessments(res.assessments);
    } catch (err: any) {
      setError(err?.message || 'Failed to load maternal sepsis console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const filtered = assessments.filter((a) => {
    if (riskFilter === 'all') return true;
    if (riskFilter === 'severe') return a.sos_risk_level === 'severe_septic_shock';
    if (riskFilter === 'intermediate') return a.sos_risk_level === 'intermediate_risk';
    if (riskFilter === 'low') return a.sos_risk_level === 'low_risk';
    if (riskFilter === 'shock') return a.shock_index_tier === 'critical_shock_gte_1_4';
    return true;
  });

  const totalCount = assessments.length;
  const severeCount = assessments.filter(a => a.sos_risk_level === 'severe_septic_shock').length;
  const criticalShockCount = assessments.filter(a => a.shock_index_tier === 'critical_shock_gte_1_4').length;
  const icuTransferCount = assessments.filter(a => a.icu_transfer_recommended === 1).length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>🚨</span> Maternal Critical Care Sepsis Console
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Albright Sepsis in Obstetrics Score (SOS) · Obstetric Shock Index (SI) Surveillance · FIGO / ACOG Hour-1 Resuscitation Registry
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/patients"
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow transition"
          >
            + New Assessment via Chart
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Obstetric cohorts</div>
        </div>
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Severe Sepsis (SOS ≥ 8)</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{severeCount}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">High ICU admission risk</div>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Critical Shock Index (SI &ge; 1.4)</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{criticalShockCount}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Profound hypoperfusion</div>
        </div>
        <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 shadow-sm">
          <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">ICU Transfers Needed</div>
          <div className="text-2xl font-black text-purple-700 mt-1">{icuTransferCount}</div>
          <div className="text-[11px] text-purple-700 mt-0.5">Obstetric HDU / ICU</div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Filter Severity:</label>
            <select
              className="border rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-50"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <option value="all">All Tiers</option>
              <option value="severe">Severe Sepsis / Shock (SOS ≥ 8)</option>
              <option value="shock">Critical Shock Index (SI ≥ 1.4)</option>
              <option value="intermediate">Intermediate Risk (SOS 6–7)</option>
              <option value="low">Low Risk (SOS &lt; 6)</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Showing {filtered.length} assessment records
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading sepsis registry...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No maternal sepsis assessments found matching this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b font-bold">
                  <th className="p-3">Protocol #</th>
                  <th className="p-3">Patient / UHID</th>
                  <th className="p-3">Suspected Source</th>
                  <th className="p-3">SOS Score</th>
                  <th className="p-3">Shock Index (HR/SBP)</th>
                  <th className="p-3">MAP</th>
                  <th className="p-3">Lactate</th>
                  <th className="p-3">ICU Rec.</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-rose-800">
                      {a.assessment_code || `#${a.id}`}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/patients/${a.patient_id}`}
                        className="font-bold text-slate-900 hover:text-rose-700 hover:underline"
                      >
                        {a.patient_name || `Patient #${a.patient_id}`}
                      </Link>
                      <div className="text-[10px] text-slate-500">
                        UHID: {a.patient_uhid || '—'}
                      </div>
                    </td>
                    <td className="p-3 capitalize font-medium text-slate-700">
                      {a.suspected_source?.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-black text-xs ${
                          a.sos_risk_level === 'severe_septic_shock'
                            ? 'bg-red-100 text-red-900'
                            : a.sos_risk_level === 'intermediate_risk'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        SOS {a.sos_score}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">
                      {Number(a.obstetric_shock_index).toFixed(2)}{' '}
                      <span className="text-[10px] font-normal text-slate-500">
                        ({a.heart_rate_bpm}/{a.systolic_bp_mmhg})
                      </span>
                    </td>
                    <td className="p-3 font-semibold">
                      {a.mean_arterial_pressure_mmhg} mmHg
                    </td>
                    <td className="p-3">
                      {a.serum_lactate_mmol_l ? `${a.serum_lactate_mmol_l} mmol/L` : '—'}
                    </td>
                    <td className="p-3">
                      {a.icu_transfer_recommended ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                          🚨 YES
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Ward</span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/patients/${a.patient_id}`}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded text-xs transition"
                      >
                        Chart Tab
                      </Link>
                      <Link
                        to={`/maternal-sepsis/${a.id}/print`}
                        target="_blank"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition"
                      >
                        🖨️ Dossier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
