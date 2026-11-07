import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNeonatalHieAssessments,
  updateNeonatalHieStatus,
  type NeonatalHieRecord,
} from '../api';

export const NeonatalHiePage: React.FC = () => {
  const [assessments, setAssessments] = useState<NeonatalHieRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalHieAssessments({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setAssessments(res.assessments);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Neonatal HIE roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [statusFilter]);

  const handleStatusUpdate = async (
    id: number,
    status: 'eligible_pending' | 'cooling_active' | 'rewarming_phase' | 'completed_normothermia' | 'discontinued'
  ) => {
    try {
      await updateNeonatalHieStatus(id, status);
      fetchAssessments();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const totalCount = assessments.length;
  const activeCoolingCount = assessments.filter(a => a.protocol_status === 'cooling_active').length;
  const rewarmingCount = assessments.filter(a => a.protocol_status === 'rewarming_phase').length;
  const severeCount = assessments.filter(a => a.sarnat_stage === 'stage_III_severe').length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>🧊</span> NICU Targeted Temperature Management (TTM) Console
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Neonatal Hypoxic-Ischemic Encephalopathy (HIE) · Sarnat Staging · 72h Hypothermia (33.5°C) &amp; Controlled Rewarming Registry
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/patients"
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl shadow transition"
          >
            + Initiate via Patient Chart
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Sarnat I–III cohorts</div>
        </div>
        <div className="bg-cyan-50/70 p-4 rounded-2xl border border-cyan-200 shadow-sm">
          <div className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider">Active Cooling</div>
          <div className="text-2xl font-black text-cyan-700 mt-1">{activeCoolingCount}</div>
          <div className="text-[11px] text-cyan-700 mt-0.5">Target 33.5°C maintained</div>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Rewarming Phase</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{rewarmingCount}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">+0.5°C/hr gradual ramp</div>
        </div>
        <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 shadow-sm">
          <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Stage III Severe</div>
          <div className="text-2xl font-black text-purple-700 mt-1">{severeCount}</div>
          <div className="text-[11px] text-purple-700 mt-0.5">High neurological risk</div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Filter Status:</label>
            <select
              className="border rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-50"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="cooling_active">Active Cooling</option>
              <option value="rewarming_phase">Rewarming Phase</option>
              <option value="eligible_pending">Eligible (Pending)</option>
              <option value="completed_normothermia">Completed</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Showing {assessments.length} assessment records
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading cooling roster...</div>
        ) : assessments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No HIE cooling assessments found for selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b font-bold">
                  <th className="p-3">Protocol #</th>
                  <th className="p-3">Patient / UHID</th>
                  <th className="p-3">Sarnat Stage</th>
                  <th className="p-3">Hours from Birth</th>
                  <th className="p-3">Cord pH / BE</th>
                  <th className="p-3">Eligibility</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {assessments.map((a) => {
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-cyan-800">
                        {a.assessment_code || `#${a.id}`}
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/patients/${a.patient_id}`}
                          className="font-bold text-slate-900 hover:text-cyan-700 hover:underline"
                        >
                          {a.patient_name || `Patient #${a.patient_id}`}
                        </Link>
                        <div className="text-[10px] text-slate-500">
                          UHID: {a.patient_uhid || '—'} · GA: {a.gestational_age_weeks}w
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-black uppercase text-[10px] ${
                            a.sarnat_stage === 'stage_III_severe'
                              ? 'bg-purple-100 text-purple-900'
                              : a.sarnat_stage === 'stage_II_moderate'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {a.sarnat_stage?.replace(/_/g, ' ') || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 font-medium">
                        {a.hours_from_birth_to_cooling != null ? `${a.hours_from_birth_to_cooling} hrs` : '—'}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold">{a.cord_or_arterial_ph ?? '—'}</span> /{' '}
                        <span className="text-slate-500">{a.base_deficit_mmol_l ? `${a.base_deficit_mmol_l}` : '—'}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.cooling_criteria_met
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {a.cooling_criteria_met ? 'TOBY Eligible' : 'Ineligible'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 capitalize text-[11px]">
                        {a.cooling_device_type?.replace(/_/g, ' ') || 'Blanket'}
                      </td>
                      <td className="p-3">
                        <select
                          className="border rounded px-2 py-1 text-xs font-semibold bg-white"
                          value={a.protocol_status}
                          onChange={(e) => handleStatusUpdate(a.id, e.target.value as any)}
                        >
                          <option value="eligible_pending">Eligible (Pending)</option>
                          <option value="cooling_active">Active Cooling</option>
                          <option value="rewarming_phase">Rewarming Phase</option>
                          <option value="completed_normothermia">Completed</option>
                          <option value="discontinued">Discontinued</option>
                        </select>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap space-x-2">
                        <Link
                          to={`/patients/${a.patient_id}`}
                          className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold rounded text-xs transition"
                        >
                          Chart Tab
                        </Link>
                        <Link
                          to={`/neonatal-hie/${a.id}/print`}
                          target="_blank"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition"
                        >
                          🖨️ Dossier
                        </Link>
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
