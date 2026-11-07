import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Patient, PediatricGrowthRecord, PediatricMilestoneItem } from '../api';
import {
  WHO_WEIGHT_BOYS,
  WHO_WEIGHT_GIRLS,
  WHO_HEIGHT_BOYS,
  WHO_HEIGHT_GIRLS,
  interpolateWhoRef,
} from '../pediatricGrowthEngine';

export function PediatricGrowthPrint() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<PediatricGrowthRecord[]>([]);
  const [milestones, setMilestones] = useState<PediatricMilestoneItem[]>([]);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch patient
        const ptRes = await fetch(`/api/patients/${id}`);
        if (!ptRes.ok) throw new Error('Failed to load patient');
        const ptData = await ptRes.json();
        setPatient(ptData.patient);

        // Fetch growth
        const gRes = await fetch(`/api/patients/${id}/pediatric/growth`);
        if (gRes.ok) {
          const gData = await gRes.json();
          setRecords(gData.records || []);
        }

        // Fetch milestones
        const mRes = await fetch(`/api/patients/${id}/pediatric/milestones`);
        if (mRes.ok) {
          const mData = await mRes.json();
          setMilestones(mData.milestones || []);
          setRedFlags(mData.redFlags || []);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading growth report for printing');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  const childSex = records.length > 0 ? records[0]!.sex : 'male';
  const wTable = childSex === 'male' ? WHO_WEIGHT_BOYS : WHO_WEIGHT_GIRLS;
  const hTable = childSex === 'male' ? WHO_HEIGHT_BOYS : WHO_HEIGHT_GIRLS;

  // SVG Scalers (0 to 36 months)
  const maxMonths = 36;
  const svgWidth = 350;
  const svgHeight = 180;

  const getX = (m: number) => (m / maxMonths) * (svgWidth - 45) + 35;
  const getYWeight = (w: number) => {
    const clamped = Math.min(Math.max(w, 0), 20);
    return svgHeight - (clamped / 20) * (svgHeight - 30) - 15;
  };
  const getYHeight = (h: number) => {
    const clamped = Math.min(Math.max(h, 40), 110);
    return svgHeight - ((clamped - 40) / 70) * (svgHeight - 30) - 15;
  };

  const refMonths = [0, 3, 6, 9, 12, 18, 24, 36];
  const buildCurve = (which: 'sd3neg' | 'sd2neg' | 'median' | 'sd2pos' | 'sd3pos', isHeight = false) => {
    const table = isHeight ? hTable : wTable;
    return refMonths.reduce((acc, m, idx) => {
      const ref = interpolateWhoRef(table, m);
      const val = ref[which];
      const x = getX(m);
      const y = isHeight ? getYHeight(val) : getYWeight(val);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Loading pediatric growth passport for printing...
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: 'sans-serif' }}>
        {error || 'Patient not found'}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      {/* Top Action Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => window.history.back()}
          style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          🖨️ Print Growth Passport
        </button>
      </div>

      {/* Hospital Letterhead */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '19px', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>
          DEPARTMENT OF PEDIATRICS &amp; CHILD HEALTH
        </h1>
        <div style={{ fontSize: '13px', color: '#475569', marginTop: '3px' }}>
          Child Growth Standards, Nutrition Surveillance &amp; Developmental Passport
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0369a1', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          WHO Growth Z-Scores &amp; Developmental Milestone Record
        </div>
      </div>

      {/* Child Particulars Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', marginBottom: '16px' }}>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Child Name</span>
          <strong style={{ fontSize: '13px' }}>{patient.fullName}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>MRN / Phone</span>
          <strong>{patient.id} / {String(patient.phone || '—')}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Date of Birth / Sex</span>
          <strong>{String(patient.dateOfBirth || '—')} / <span style={{ textTransform: 'capitalize' }}>{childSex}</span></strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Total Growth Points</span>
          <strong>{records.length} Recorded Visits</strong>
        </div>
      </div>

      {/* Dual Vector WHO Curves */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        {/* Weight Curve */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', background: '#fffdfa' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a', marginBottom: '4px' }}>
            WHO Weight-for-Age (0–36m)
          </div>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <rect x="30" y="5" width={svgWidth - 40} height={svgHeight - 25} fill="#fffdfa" stroke="#cbd5e1" strokeWidth="0.8" />
            {[0, 6, 12, 18, 24, 36].map((m) => (
              <g key={m}>
                <line x1={getX(m)} y1="5" x2={getX(m)} y2={svgHeight - 20} stroke="#e2e8f0" strokeWidth="0.6" />
                <text x={getX(m)} y={svgHeight - 8} textAnchor="middle" fontSize="7" fill="#64748b">{m}m</text>
              </g>
            ))}
            {[5, 10, 15, 20].map((w) => (
              <g key={w}>
                <line x1="30" y1={getYWeight(w)} x2={svgWidth - 10} y2={getYWeight(w)} stroke="#e2e8f0" strokeWidth="0.6" />
                <text x="26" y={getYWeight(w) + 2} textAnchor="end" fontSize="7" fill="#64748b">{w}k</text>
              </g>
            ))}
            <path d={buildCurve('median', false)} fill="none" stroke="#16a34a" strokeWidth="1.6" />
            <path d={buildCurve('sd2pos', false)} fill="none" stroke="#eab308" strokeWidth="1" />
            <path d={buildCurve('sd2neg', false)} fill="none" stroke="#eab308" strokeWidth="1" />
            <path d={buildCurve('sd3neg', false)} fill="none" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3 2" />

            {/* Patient Path */}
            {records.length > 0 && (
              <path
                d={records.reduce((acc, r) => {
                  if (!r.weight_kg) return acc;
                  const x = getX(r.age_months);
                  const y = getYWeight(r.weight_kg);
                  return acc === '' ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
              />
            )}
          </svg>
        </div>

        {/* Height Curve */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', background: '#fffdfa' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a', marginBottom: '4px' }}>
            WHO Length/Height-for-Age (0–36m)
          </div>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <rect x="30" y="5" width={svgWidth - 40} height={svgHeight - 25} fill="#fffdfa" stroke="#cbd5e1" strokeWidth="0.8" />
            {[0, 6, 12, 18, 24, 36].map((m) => (
              <g key={m}>
                <line x1={getX(m)} y1="5" x2={getX(m)} y2={svgHeight - 20} stroke="#e2e8f0" strokeWidth="0.6" />
                <text x={getX(m)} y={svgHeight - 8} textAnchor="middle" fontSize="7" fill="#64748b">{m}m</text>
              </g>
            ))}
            {[50, 70, 90, 110].map((h) => (
              <g key={h}>
                <line x1="30" y1={getYHeight(h)} x2={svgWidth - 10} y2={getYHeight(h)} stroke="#e2e8f0" strokeWidth="0.6" />
                <text x="26" y={getYHeight(h) + 2} textAnchor="end" fontSize="7" fill="#64748b">{h}</text>
              </g>
            ))}
            <path d={buildCurve('median', true)} fill="none" stroke="#16a34a" strokeWidth="1.6" />
            <path d={buildCurve('sd2pos', true)} fill="none" stroke="#eab308" strokeWidth="1" />
            <path d={buildCurve('sd2neg', true)} fill="none" stroke="#eab308" strokeWidth="1" />
            <path d={buildCurve('sd3neg', true)} fill="none" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3 2" />

            {/* Patient Path */}
            {records.length > 0 && (
              <path
                d={records.reduce((acc, r) => {
                  if (!r.height_length_cm) return acc;
                  const x = getX(r.age_months);
                  const y = getYHeight(r.height_length_cm);
                  return acc === '' ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Serial Growth Table */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
          Serial Anthropometric Measurements &amp; Nutritional Z-Scores
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', border: '1px solid #cbd5e1' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '5px 8px' }}>Date</th>
              <th style={{ padding: '5px 8px' }}>Age</th>
              <th style={{ padding: '5px 8px' }}>Weight</th>
              <th style={{ padding: '5px 8px' }}>WFA Z-Score</th>
              <th style={{ padding: '5px 8px' }}>Height</th>
              <th style={{ padding: '5px 8px' }}>HFA Z-Score</th>
              <th style={{ padding: '5px 8px' }}>Head Circ.</th>
              <th style={{ padding: '5px 8px' }}>BMI / SAM Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
                  No growth measurements recorded yet.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{r.recorded_date}</td>
                  <td style={{ padding: '5px 8px' }}>{r.age_months}m</td>
                  <td style={{ padding: '5px 8px', fontWeight: 'bold' }}>{r.weight_kg ? `${r.weight_kg} kg` : '—'}</td>
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{
                      padding: '2px 5px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: r.weight_for_age_status === 'normal' ? '#dcfce7' : '#fef3c7',
                      color: r.weight_for_age_status === 'normal' ? '#15803d' : '#b45309',
                    }}>
                      {r.weight_for_age_z != null ? `${r.weight_for_age_z > 0 ? '+' : ''}${r.weight_for_age_z} SD (${r.weight_for_age_status})` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px' }}>{r.height_length_cm ? `${r.height_length_cm} cm` : '—'}</td>
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{
                      padding: '2px 5px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: r.height_for_age_status === 'normal' ? '#dcfce7' : '#fef3c7',
                      color: r.height_for_age_status === 'normal' ? '#15803d' : '#b45309',
                    }}>
                      {r.height_for_age_z != null ? `${r.height_for_age_z > 0 ? '+' : ''}${r.height_for_age_z} SD` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px' }}>{r.head_circumference_cm ? `${r.head_circumference_cm} cm` : '—'}</td>
                  <td style={{ padding: '5px 8px', textTransform: 'capitalize' }}>
                    {r.bmi ? `${r.bmi} (${r.weight_for_height_status?.replace(/_/g, ' ') || 'normal'})` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Developmental Milestones Summary */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 12px', fontSize: '11px', marginBottom: '20px', background: '#f8fafc' }}>
        <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px', textTransform: 'uppercase' }}>
          Developmental Milestones Status (IAP / Denver-II Framework)
        </div>
        {redFlags.length > 0 ? (
          <div style={{ color: '#b91c1c', fontWeight: 'bold', marginBottom: '6px' }}>
            ⚠️ {redFlags.join('; ')}
          </div>
        ) : (
          <div style={{ color: '#15803d', fontWeight: 600, marginBottom: '6px' }}>
            ✅ All age-appropriate gross motor, fine motor, speech, and social milestones achieved on schedule.
          </div>
        )}
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          * Evaluated according to Indian Academy of Pediatrics (IAP) developmental surveillance protocols.
        </div>
      </div>

      {/* Signature & Verification Block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '35px', paddingTop: '15px', borderTop: '1px solid #cbd5e1', fontSize: '11px' }}>
        <div>
          <div>Parent / Primary Caregiver</div>
          <div style={{ marginTop: '25px', color: '#94a3b8' }}>____________________________</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Consultant Pediatrician / Neonatologist</div>
          <div style={{ marginTop: '25px', color: '#94a3b8' }}>____________________________</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>Dr. Demo Sharma (MD Pediatrics, FIAP)</div>
        </div>
      </div>
    </div>
  );
}
