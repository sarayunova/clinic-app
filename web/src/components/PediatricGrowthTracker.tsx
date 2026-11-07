import React, { useState, useEffect, useMemo } from 'react';
import type { PediatricGrowthRecord, PediatricMilestoneItem, PediatricGrowthResponse, PediatricMilestonesResponse } from '../api';
import {
  evaluatePediatricGrowth,
  WHO_WEIGHT_BOYS,
  WHO_WEIGHT_GIRLS,
  WHO_HEIGHT_BOYS,
  WHO_HEIGHT_GIRLS,
  interpolateWhoRef,
  type ChildSex,
} from '../pediatricGrowthEngine';

interface Props {
  patientId: number;
  patientDob?: string | null;
}

export function PediatricGrowthTracker({ patientId, patientDob }: Props) {
  const [records, setRecords] = useState<PediatricGrowthRecord[]>([]);
  const [milestones, setMilestones] = useState<PediatricMilestoneItem[]>([]);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'charts' | 'measurements' | 'milestones'>('charts');
  const [chartType, setChartType] = useState<'weight' | 'height'>('weight');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Growth Modal
  const [showGrowthModal, setShowGrowthModal] = useState(false);

  // Form State
  const defaultAge = useMemo(() => {
    if (!patientDob) return '12';
    const dob = new Date(patientDob);
    const diffDays = Math.max(0, (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24));
    return (diffDays / 30.4375).toFixed(1);
  }, [patientDob]);

  const [growthForm, setGrowthForm] = useState({
    recordedDate: new Date().toISOString().slice(0, 10),
    ageMonths: defaultAge,
    sex: 'male' as ChildSex,
    weightKg: '9.5',
    heightLengthCm: '75.0',
    headCircumferenceCm: '46.0',
    clinicalNotes: 'Routine well-child checkup. Feeding well.',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load growth records
      const gRes = await fetch(`/api/patients/${patientId}/pediatric/growth`);
      if (!gRes.ok) throw new Error('Failed to load growth records');
      const gData: PediatricGrowthResponse = await gRes.json();
      setRecords(gData.records || []);

      // If records have sex, adopt it
      if (gData.records && gData.records.length > 0) {
        const lastSex = gData.records[gData.records.length - 1]!.sex;
        setGrowthForm((prev) => ({ ...prev, sex: lastSex }));
      }

      // Load milestones
      const mRes = await fetch(`/api/patients/${patientId}/pediatric/milestones`);
      if (mRes.ok) {
        const mData: PediatricMilestonesResponse = await mRes.json();
        setMilestones(mData.milestones || []);
        setRedFlags(mData.redFlags || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading pediatric data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Live evaluation during modal form entry
  const liveGrowthEval = useMemo(() => {
    const age = Number(growthForm.ageMonths) || 12;
    const w = growthForm.weightKg ? Number(growthForm.weightKg) : null;
    const h = growthForm.heightLengthCm ? Number(growthForm.heightLengthCm) : null;
    const hc = growthForm.headCircumferenceCm ? Number(growthForm.headCircumferenceCm) : null;
    return evaluatePediatricGrowth(age, growthForm.sex, w, h, hc);
  }, [growthForm]);

  // Handle Save Growth Record
  const handleSaveGrowth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const age = Number(growthForm.ageMonths);
      if (isNaN(age) || age < 0) throw new Error('Valid age in months required');

      const payload = {
        recordedDate: growthForm.recordedDate,
        ageMonths: age,
        sex: growthForm.sex,
        weightKg: growthForm.weightKg ? Number(growthForm.weightKg) : null,
        heightLengthCm: growthForm.heightLengthCm ? Number(growthForm.heightLengthCm) : null,
        headCircumferenceCm: growthForm.headCircumferenceCm ? Number(growthForm.headCircumferenceCm) : null,
        clinicalNotes: growthForm.clinicalNotes || null,
      };

      const res = await fetch(`/api/patients/${patientId}/pediatric/growth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to save growth record');
      }

      setShowGrowthModal(false);
      setSuccessMsg('Growth measurement logged successfully!');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error saving measurement');
    }
  };

  // Handle Delete Growth Record
  const handleDeleteGrowth = async (growthId: number) => {
    if (!window.confirm('Delete this growth measurement?')) return;
    try {
      setError(null);
      const res = await fetch(`/api/patients/${patientId}/pediatric/growth/${growthId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete measurement');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error deleting measurement');
    }
  };

  // Handle Milestone Status Change
  const handleMilestoneUpdate = async (milestoneKey: string, newStatus: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/patients/${patientId}/pediatric/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneKey,
          status: newStatus,
          achievedDate: newStatus === 'achieved' ? new Date().toISOString().slice(0, 10) : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update milestone');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error updating milestone');
    }
  };

  // SVG Chart Calculations (0 to 36 or 60 months)
  const maxMonths = 36;
  const svgWidth = 720;
  const svgHeight = 280;
  const childSex = records.length > 0 ? records[0]!.sex : growthForm.sex;

  const getX = (m: number) => (m / maxMonths) * (svgWidth - 65) + 45;

  // Weight scale: 0 to 20 kg
  const getYWeight = (w: number) => {
    const clamped = Math.min(Math.max(w, 0), 20);
    return svgHeight - (clamped / 20) * (svgHeight - 40) - 20;
  };

  // Height scale: 40 to 110 cm
  const getYHeight = (h: number) => {
    const clamped = Math.min(Math.max(h, 40), 110);
    return svgHeight - ((clamped - 40) / 70) * (svgHeight - 40) - 20;
  };

  // Reference lines for SVG
  const refMonths = [0, 3, 6, 9, 12, 18, 24, 36];
  const wTable = childSex === 'male' ? WHO_WEIGHT_BOYS : WHO_WEIGHT_GIRLS;
  const hTable = childSex === 'male' ? WHO_HEIGHT_BOYS : WHO_HEIGHT_GIRLS;

  const buildCurvePath = (which: 'sd3neg' | 'sd2neg' | 'median' | 'sd2pos' | 'sd3pos', isHeight = false) => {
    const table = isHeight ? hTable : wTable;
    return refMonths.reduce((acc, m, idx) => {
      const ref = interpolateWhoRef(table, m);
      const val = ref[which];
      const x = getX(m);
      const y = isHeight ? getYHeight(val) : getYWeight(val);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  const latestRecord = records.length > 0 ? records[records.length - 1] : null;

  return (
    <div className="pediatric-growth-tracker space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🧒 Pediatric WHO Growth Standards &amp; Milestones</span>
            {latestRecord && (
              <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                latestRecord.weight_for_age_status === 'normal'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {latestRecord.weight_for_age_status?.replace(/_/g, ' ') || 'GROWTH TRACKED'}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500">
            WHO Z-Scores (-3 SD to +3 SD for Weight, Length, HC, BMI) &amp; IAP 4-Domain Developmental Milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <a
              href={`/patients/${patientId}/pediatric/growth/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn small secondary flex items-center gap-1"
            >
              <span>🖨️</span> Print Growth Passport
            </a>
          )}
          <button
            type="button"
            className="btn small primary"
            onClick={() => setShowGrowthModal(true)}
          >
            ➕ Record Growth Measurement
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm flex justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Red Flags Alert Banner */}
      {redFlags.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-600 p-3 rounded space-y-1">
          <div className="font-bold text-red-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
            <span>⚠️ Developmental Delay Red Flag Detected ({redFlags.length})</span>
          </div>
          {redFlags.map((flag, idx) => (
            <div key={idx} className="text-xs text-red-800">
              {flag}
            </div>
          ))}
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 ${
            activeTab === 'charts' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('charts')}
        >
          📈 WHO Growth Curves ({records.length} Points)
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 ${
            activeTab === 'measurements' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('measurements')}
        >
          📋 Serial Anthropometry Table
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 ${
            activeTab === 'milestones' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('milestones')}
        >
          🧩 Developmental Milestones (IAP / Denver-II)
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading pediatric growth data...</div>
      ) : activeTab === 'charts' ? (
        /* Tab 1: Interactive WHO Growth Charts */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn small ${chartType === 'weight' ? 'primary' : 'secondary'}`}
                onClick={() => setChartType('weight')}
              >
                Weight-for-Age (0–36m)
              </button>
              <button
                type="button"
                className={`btn small ${chartType === 'height' ? 'primary' : 'secondary'}`}
                onClick={() => setChartType('height')}
              >
                Length/Height-for-Age (0–36m)
              </button>
            </div>
            <span className="text-xs text-gray-500">
              Child Sex: <b className="capitalize">{childSex}</b> (WHO Standard Curves)
            </span>
          </div>

          <div className="bg-white border rounded shadow-sm p-4 space-y-2">
            <div className="overflow-x-auto bg-[#faf8f5] p-2 rounded border border-[#f0eae0]">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[650px] select-none">
                {/* Background Grid */}
                <rect x="40" y="10" width={svgWidth - 55} height={svgHeight - 35} fill="#fffdfa" stroke="#e8dfd8" strokeWidth="1" />

                {/* X Axis Time Marks (0, 3, 6, 9, 12, 18, 24, 30, 36 months) */}
                {[0, 3, 6, 9, 12, 18, 24, 30, 36].map((m) => {
                  const x = getX(m);
                  return (
                    <g key={m}>
                      <line x1={x} y1="10" x2={x} y2={svgHeight - 25} stroke="#f2e8dc" strokeWidth="0.8" />
                      <text x={x} y={svgHeight - 12} textAnchor="middle" fontSize="9" fill="#9c8c7c" fontFamily="sans-serif">
                        {m}m
                      </text>
                    </g>
                  );
                })}

                {/* Y Axis Grid & Labels */}
                {chartType === 'weight'
                  ? [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((w) => {
                      const y = getYWeight(w);
                      return (
                        <g key={w}>
                          <line x1="40" y1={y} x2={svgWidth - 15} y2={y} stroke="#f2e8dc" strokeWidth="0.8" />
                          <text x="35" y={y + 3} textAnchor="end" fontSize="9" fill="#9c8c7c" fontFamily="sans-serif">{w}kg</text>
                        </g>
                      );
                    })
                  : [45, 55, 65, 75, 85, 95, 105].map((h) => {
                      const y = getYHeight(h);
                      return (
                        <g key={h}>
                          <line x1="40" y1={y} x2={svgWidth - 15} y2={y} stroke="#f2e8dc" strokeWidth="0.8" />
                          <text x="35" y={y + 3} textAnchor="end" fontSize="9" fill="#9c8c7c" fontFamily="sans-serif">{h}cm</text>
                        </g>
                      );
                    })}

                {/* WHO Standard Curves (+3 SD, +2 SD, Median, -2 SD, -3 SD) */}
                <path d={buildCurvePath('sd3pos', chartType === 'height')} fill="none" stroke="#fca5a5" strokeWidth="1" strokeDasharray="3 2" />
                <path d={buildCurvePath('sd2pos', chartType === 'height')} fill="none" stroke="#fde047" strokeWidth="1.2" />
                <path d={buildCurvePath('median', chartType === 'height')} fill="none" stroke="#16a34a" strokeWidth="1.8" />
                <path d={buildCurvePath('sd2neg', chartType === 'height')} fill="none" stroke="#fde047" strokeWidth="1.2" />
                <path d={buildCurvePath('sd3neg', chartType === 'height')} fill="none" stroke="#fca5a5" strokeWidth="1" strokeDasharray="3 2" />

                {/* Patient Plotted Measurements Line */}
                {records.length > 0 && (
                  <>
                    <path
                      d={records.reduce((acc, r, idx) => {
                        const val = chartType === 'weight' ? r.weight_kg : r.height_length_cm;
                        if (!val) return acc;
                        const x = getX(r.age_months);
                        const y = chartType === 'weight' ? getYWeight(val) : getYHeight(val);
                        return acc === '' ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                      }, '')}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.2"
                    />

                    {/* Plot Points */}
                    {records.map((r) => {
                      const val = chartType === 'weight' ? r.weight_kg : r.height_length_cm;
                      if (!val) return null;
                      const x = getX(r.age_months);
                      const y = chartType === 'weight' ? getYWeight(val) : getYHeight(val);
                      return (
                        <circle
                          key={r.id}
                          cx={x}
                          cy={y}
                          r="4.5"
                          fill="#1d4ed8"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        >
                          <title>{`${r.recorded_date}: ${val} ${chartType === 'weight' ? 'kg' : 'cm'} (${r.age_months}m)`}</title>
                        </circle>
                      );
                    })}
                  </>
                )}

                {/* Curve Labels */}
                <text x={svgWidth - 12} y={getYWeight(chartType === 'weight' ? interpolateWhoRef(wTable, 36).sd3pos : interpolateWhoRef(hTable, 36).sd3pos) + 3} fontSize="8" fill="#ef4444">+3 SD</text>
                <text x={svgWidth - 12} y={getYWeight(chartType === 'weight' ? interpolateWhoRef(wTable, 36).sd2pos : interpolateWhoRef(hTable, 36).sd2pos) + 3} fontSize="8" fill="#ca8a04">+2 SD</text>
                <text x={svgWidth - 12} y={getYWeight(chartType === 'weight' ? interpolateWhoRef(wTable, 36).median : interpolateWhoRef(hTable, 36).median) + 3} fontSize="8" fill="#15803d" fontWeight="bold">Median</text>
                <text x={svgWidth - 12} y={getYWeight(chartType === 'weight' ? interpolateWhoRef(wTable, 36).sd2neg : interpolateWhoRef(hTable, 36).sd2neg) + 3} fontSize="8" fill="#ca8a04">-2 SD</text>
                <text x={svgWidth - 12} y={getYWeight(chartType === 'weight' ? interpolateWhoRef(wTable, 36).sd3neg : interpolateWhoRef(hTable, 36).sd3neg) + 3} fontSize="8" fill="#ef4444">-3 SD</text>
              </svg>
            </div>
            <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
              <span>● Green: WHO 50th Percentile (Median)</span>
              <span>● Yellow: &plusmn;2 SD (Normal limits)</span>
              <span>● Red dashed: &plusmn;3 SD (Severe malnutrition / extreme)</span>
              <span className="font-semibold text-blue-600">● Blue: Patient Trajectory</span>
            </div>
          </div>
        </div>
      ) : activeTab === 'measurements' ? (
        /* Tab 2: Measurement Table */
        <div className="bg-white border rounded shadow-sm overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
              📋 Serial Growth Measurements &amp; Z-Scores ({records.length})
            </h3>
            <button
              type="button"
              className="btn small primary"
              onClick={() => setShowGrowthModal(true)}
            >
              ➕ Add Measurement
            </button>
          </div>

          {records.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No growth measurements logged yet. Click "Add Measurement" to record weight and length.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Age</th>
                    <th className="p-2.5">Weight (kg)</th>
                    <th className="p-2.5">Weight Z-Score</th>
                    <th className="p-2.5">Height (cm)</th>
                    <th className="p-2.5">Height Z-Score</th>
                    <th className="p-2.5">HC (cm)</th>
                    <th className="p-2.5">BMI / Wasting</th>
                    <th className="p-2.5">Notes</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-800">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-2.5 font-medium whitespace-nowrap">{r.recorded_date}</td>
                      <td className="p-2.5 font-bold">{r.age_months}m</td>
                      <td className="p-2.5">{r.weight_kg ? `${r.weight_kg} kg` : '—'}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.weight_for_age_status === 'normal'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.weight_for_age_z != null ? `${r.weight_for_age_z > 0 ? '+' : ''}${r.weight_for_age_z} SD` : '—'}
                        </span>
                      </td>
                      <td className="p-2.5">{r.height_length_cm ? `${r.height_length_cm} cm` : '—'}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.height_for_age_status === 'normal'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.height_for_age_z != null ? `${r.height_for_age_z > 0 ? '+' : ''}${r.height_for_age_z} SD` : '—'}
                        </span>
                      </td>
                      <td className="p-2.5">{r.head_circumference_cm ? `${r.head_circumference_cm} cm` : '—'}</td>
                      <td className="p-2.5">{r.bmi ? `${r.bmi} (${r.weight_for_height_status?.replace(/_/g, ' ') || 'normal'})` : '—'}</td>
                      <td className="p-2.5 text-gray-500 max-w-xs truncate">{r.clinical_notes || '—'}</td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteGrowth(r.id)}
                          className="text-red-500 hover:text-red-700 font-bold"
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
      ) : (
        /* Tab 3: Developmental Milestones */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['gross_motor', 'fine_motor_adaptive', 'language_hearing', 'personal_social'].map((domain) => {
              const domainItems = milestones.filter((m) => m.domain === domain);
              const domainTitle =
                domain === 'gross_motor'
                  ? '🏃 Gross Motor Milestones'
                  : domain === 'fine_motor_adaptive'
                  ? '✋ Fine Motor & Adaptive'
                  : domain === 'language_hearing'
                  ? '🗣️ Language & Hearing'
                  : '🧸 Personal & Social';

              return (
                <div key={domain} className="bg-white border rounded shadow-sm p-4 space-y-3">
                  <h3 className="font-bold text-sm text-gray-800 border-b pb-1.5 uppercase tracking-wide">
                    {domainTitle}
                  </h3>

                  <div className="space-y-2">
                    {domainItems.map((item) => (
                      <div
                        key={item.key}
                        className={`p-2.5 border rounded text-xs transition ${
                          item.isRedFlag
                            ? 'bg-red-50 border-red-300'
                            : item.status === 'achieved'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-gray-800 flex items-center gap-1.5">
                              <span>{item.title}</span>
                              {item.isRedFlag && (
                                <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                                  RED FLAG
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Expected: {item.expectedAgeMonths}m (Limit: {item.upperLimitAgeMonths}m) • {item.description}
                            </div>
                          </div>

                          {/* Quick Status Buttons */}
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMilestoneUpdate(item.key, 'achieved')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'achieved'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                              }`}
                            >
                              ✓ Achieved
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMilestoneUpdate(item.key, 'delayed')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'delayed'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                              }`}
                            >
                              Delayed
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Growth Modal */}
      {showGrowthModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold">➕ Record Pediatric Growth Measurement</h3>
              <button onClick={() => setShowGrowthModal(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveGrowth} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={growthForm.recordedDate}
                    onChange={(e) => setGrowthForm({ ...growthForm, recordedDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Age in Months</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border p-2 rounded font-bold"
                    value={growthForm.ageMonths}
                    onChange={(e) => setGrowthForm({ ...growthForm, ageMonths: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.05"
                    className="w-full border p-2 rounded font-bold"
                    value={growthForm.weightKg}
                    onChange={(e) => setGrowthForm({ ...growthForm, weightKg: e.target.value })}
                    placeholder="e.g. 9.5"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Length/Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border p-2 rounded font-bold"
                    value={growthForm.heightLengthCm}
                    onChange={(e) => setGrowthForm({ ...growthForm, heightLengthCm: e.target.value })}
                    placeholder="e.g. 75.0"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Head Circ. (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border p-2 rounded"
                    value={growthForm.headCircumferenceCm}
                    onChange={(e) => setGrowthForm({ ...growthForm, headCircumferenceCm: e.target.value })}
                    placeholder="e.g. 46.0"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Child Sex</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="childSex"
                      value="male"
                      checked={growthForm.sex === 'male'}
                      onChange={() => setGrowthForm({ ...growthForm, sex: 'male' })}
                    />
                    Male (Boy)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="childSex"
                      value="female"
                      checked={growthForm.sex === 'female'}
                      onChange={() => setGrowthForm({ ...growthForm, sex: 'female' })}
                    />
                    Female (Girl)
                  </label>
                </div>
              </div>

              {/* Real-time Z-score evaluation preview */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-1">
                <span className="font-bold text-blue-900 block text-[11px] uppercase">
                  WHO Z-Score Evaluation Preview:
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {liveGrowthEval.weightZ != null && (
                    <span className="bg-white px-2 py-0.5 rounded border">
                      Weight: <b>{liveGrowthEval.weightZ} SD</b> ({liveGrowthEval.weightStatus})
                    </span>
                  )}
                  {liveGrowthEval.heightZ != null && (
                    <span className="bg-white px-2 py-0.5 rounded border">
                      Height: <b>{liveGrowthEval.heightZ} SD</b> ({liveGrowthEval.heightStatus})
                    </span>
                  )}
                  {liveGrowthEval.bmi != null && (
                    <span className="bg-white px-2 py-0.5 rounded border">
                      BMI: <b>{liveGrowthEval.bmi}</b> ({liveGrowthEval.bmiStatus})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Clinical Notes</label>
                <textarea
                  rows={2}
                  className="w-full border p-2 rounded"
                  value={growthForm.clinicalNotes}
                  onChange={(e) => setGrowthForm({ ...growthForm, clinicalNotes: e.target.value })}
                  placeholder="Dietary intake, feeding tolerance, physical examination."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowGrowthModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save Measurement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
