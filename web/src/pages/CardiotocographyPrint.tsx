import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { CtgEpisode, Patient } from '../api';
import type { CtgTracePoint } from '../ctgEngine';

export function CardiotocographyPrint() {
  const { patientId, episodeId } = useParams<{ patientId: string; episodeId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [episode, setEpisode] = useState<CtgEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch patient
        const ptRes = await fetch(`/api/patients/${patientId}`);
        if (!ptRes.ok) throw new Error('Failed to load patient');
        const ptData = await ptRes.json();
        setPatient(ptData.patient);

        // Fetch CTG episode
        const epRes = await fetch(`/api/patients/${patientId}/ctg/episodes/${episodeId}`);
        if (!epRes.ok) throw new Error('Failed to load CTG episode');
        const epData = await epRes.json();
        setEpisode(epData.episode);
      } catch (err: any) {
        setError(err.message || 'Error loading CTG report for printing');
      } finally {
        setLoading(false);
      }
    }
    if (patientId && episodeId) fetchData();
  }, [patientId, episodeId]);

  const tracePoints: CtgTracePoint[] = useMemo(() => {
    if (!episode) return [];
    if (episode.tracePoints && Array.isArray(episode.tracePoints)) {
      return episode.tracePoints;
    }
    if (episode.fhr_trace_data_json) {
      try {
        return JSON.parse(episode.fhr_trace_data_json);
      } catch {
        return [];
      }
    }
    return [];
  }, [episode]);

  // SVG dimensions
  const svgWidth = 760;
  const fhrHeight = 150;
  const tocoHeight = 85;
  const gap = 15;
  const totalSvgHeight = fhrHeight + gap + tocoHeight;
  const maxMin = episode?.duration_minutes || 20;

  const getX = (minute: number) => (minute / maxMin) * (svgWidth - 55) + 40;
  const getYFhr = (bpm: number) => {
    const clamped = Math.min(Math.max(bpm, 60), 200);
    return fhrHeight - ((clamped - 60) / (200 - 60)) * (fhrHeight - 20) - 10;
  };
  const getYToco = (mmHg: number) => {
    const clamped = Math.min(Math.max(mmHg, 0), 100);
    return totalSvgHeight - (clamped / 100) * (tocoHeight - 20) - 10;
  };

  const fhrPath = useMemo(() => {
    if (!tracePoints.length) return '';
    return tracePoints.reduce((acc, pt, idx) => {
      const x = getX(pt.timeMinute);
      const y = getYFhr(pt.fhrBpm);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [tracePoints, maxMin]);

  const tocoPath = useMemo(() => {
    if (!tracePoints.length) return '';
    return tracePoints.reduce((acc, pt, idx) => {
      const x = getX(pt.timeMinute);
      const y = getYToco(pt.tocoMmHg);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [tracePoints, maxMin]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Loading cardiotocograph report for printing...
      </div>
    );
  }

  if (error || !episode || !patient) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: 'sans-serif' }}>
        {error || 'Episode not found'}
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
          🖨️ Print CTG Strip Report
        </button>
      </div>

      {/* Hospital Letterhead */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '19px', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>
          MATERNAL &amp; FETAL MEDICINE UNIT
        </h1>
        <div style={{ fontSize: '13px', color: '#475569', marginTop: '3px' }}>
          Electronic Fetal Monitoring &amp; Non-Stress Test Clinical Report
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0369a1', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Cardiotocography (CTG) Analysis &amp; Strip Record
        </div>
      </div>

      {/* Patient Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', marginBottom: '14px' }}>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Patient Name</span>
          <strong style={{ fontSize: '13px' }}>{patient.fullName}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>MRN / Phone</span>
          <strong>{patient.id} / {String(patient.phone || '—')}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Obstetric Formula</span>
          <strong>G{Number(patient.gravida) || 0} P{Number(patient.para) || 0} L{Number(patient.living) || 0} A{Number(patient.abortions) || 0}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>GA / EDD</span>
          <strong>{episode.gestational_age_weeks ? `${episode.gestational_age_weeks}w` : '—'} | {String(patient.lastMenstrualPeriod || '—')}</strong>
        </div>
      </div>

      {/* Recording Particulars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 12px', fontSize: '11px', marginBottom: '14px' }}>
        <div><b>Test Type:</b> <span style={{ textTransform: 'uppercase' }}>{episode.test_type.replace(/_/g, ' ')}</span></div>
        <div><b>Performed At:</b> {episode.performed_at.replace('T', ' ')}</div>
        <div><b>Duration / Speed:</b> {episode.duration_minutes} min ({episode.paper_speed_cm_min} cm/min)</div>
        <div><b>Indication:</b> {episode.indication || 'Routine Antenatal NST'}</div>
      </div>

      {/* Morphometric Parameters Table */}
      <div style={{ marginBottom: '14px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', border: '1px solid #cbd5e1' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px 8px' }}>Baseline FHR</th>
              <th style={{ padding: '6px 8px' }}>Variability</th>
              <th style={{ padding: '6px 8px' }}>Accelerations</th>
              <th style={{ padding: '6px 8px' }}>Decelerations</th>
              <th style={{ padding: '6px 8px' }}>Contraction Frequency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '12px' }}>
                {episode.baseline_fhr_bpm} bpm
                <span style={{ display: 'block', fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                  {episode.baseline_fhr_bpm < 110 ? 'Bradycardia' : episode.baseline_fhr_bpm > 160 ? 'Tachycardia' : 'Normal (110-160)'}
                </span>
              </td>
              <td style={{ padding: '6px 8px', textTransform: 'capitalize' }}>
                <b>{episode.variability_category}</b>
                <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>
                  {episode.variability_amplitude_bpm ? `${episode.variability_amplitude_bpm} bpm amp` : ''}
                </span>
              </td>
              <td style={{ padding: '6px 8px' }}>
                <b>{episode.accelerations_count}</b> ({episode.accelerations_criteria})
                <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>
                  {episode.accelerations_count >= 2 ? 'Qualifying (Reactive)' : 'Suboptimal'}
                </span>
              </td>
              <td style={{ padding: '6px 8px', textTransform: 'capitalize' }}>
                <b>{episode.decelerations_type.replace(/_/g, ' ')}</b>
                {episode.decelerations_recurrent ? <span style={{ color: '#b91c1c' }}> (Recurrent)</span> : ''}
              </td>
              <td style={{ padding: '6px 8px' }}>
                <b>{episode.uterine_contractions_per_10min} / 10 min</b>
                {episode.tachysystole_present ? (
                  <span style={{ display: 'block', color: '#b91c1c', fontWeight: 'bold' }}>⚠️ Tachysystole</span>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* High-Resolution SVG Strip Graph */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', marginBottom: '14px', background: '#fffdfa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>
          <span>CARDIOTOCOGRAPH PAPER STRIP TRACE</span>
          <span style={{ color: '#64748b', fontWeight: 'normal' }}>Standard Scale (FHR 60-200 bpm • TOCO 0-100 mmHg)</span>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${totalSvgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* FHR Panel */}
          <rect x="35" y="5" width={svgWidth - 45} height={fhrHeight} fill="#fffdfa" stroke="#cbd5e1" strokeWidth="0.8" />
          {[60, 80, 100, 120, 140, 160, 180, 200].map((bpm) => {
            const y = getYFhr(bpm);
            const isNormalBand = bpm === 110 || bpm === 160;
            return (
              <g key={bpm}>
                <line x1="35" y1={y} x2={svgWidth - 10} y2={y} stroke={isNormalBand ? '#86efac' : '#e2e8f0'} strokeWidth={isNormalBand ? 1.2 : 0.6} />
                <text x="30" y={y + 3} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="sans-serif">{bpm}</text>
              </g>
            );
          })}
          {/* Baseline Guide */}
          <line
            x1="35"
            y1={getYFhr(episode.baseline_fhr_bpm)}
            x2={svgWidth - 10}
            y2={getYFhr(episode.baseline_fhr_bpm)}
            stroke="#60a5fa"
            strokeWidth="1"
            strokeDasharray="4 2"
          />

          {/* Time ticks */}
          {Array.from({ length: Math.floor(maxMin / 2) + 1 }).map((_, i) => {
            const m = i * 2;
            const x = getX(m);
            return (
              <g key={m}>
                <line x1={x} y1="5" x2={x} y2={fhrHeight + 5} stroke="#e2e8f0" strokeWidth="0.6" />
                <line x1={x} y1={fhrHeight + gap} x2={x} y2={totalSvgHeight - 5} stroke="#e2e8f0" strokeWidth="0.6" />
                <text x={x} y={fhrHeight + 11} textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="sans-serif">{m}'</text>
              </g>
            );
          })}

          {/* FHR Path */}
          {fhrPath && <path d={fhrPath} fill="none" stroke="#1d4ed8" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />}

          {/* TOCO Panel */}
          <rect x="35" y={fhrHeight + gap} width={svgWidth - 45} height={tocoHeight} fill="#fffdfa" stroke="#cbd5e1" strokeWidth="0.8" />
          {[0, 20, 40, 60, 80, 100].map((mmHg) => {
            const y = getYToco(mmHg);
            return (
              <g key={mmHg}>
                <line x1="35" y1={y} x2={svgWidth - 10} y2={y} stroke="#e2e8f0" strokeWidth="0.6" />
                <text x="30" y={y + 3} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="sans-serif">{mmHg}</text>
              </g>
            );
          })}
          {/* TOCO Path */}
          {tocoPath && <path d={tocoPath} fill="none" stroke="#7e22ce" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />}

          {/* Labels */}
          <text x="40" y="16" fontSize="9" fontWeight="bold" fill="#1e40af" fontFamily="sans-serif">FHR (bpm)</text>
          <text x="40" y={fhrHeight + gap + 14} fontSize="9" fontWeight="bold" fill="#6b21a8" fontFamily="sans-serif">TOCO (mmHg)</text>
        </svg>
      </div>

      {/* Clinical Classification Summary Box */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px', textAlign: 'center' }}>
        <div style={{
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid',
          background: episode.figo_classification === 'normal' ? '#f0fdf4' : episode.figo_classification === 'suspicious' ? '#fffbeb' : '#fef2f2',
          borderColor: episode.figo_classification === 'normal' ? '#bbf7d0' : episode.figo_classification === 'suspicious' ? '#fde68a' : '#fecaca',
        }}>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>FIGO 2015 Classification</span>
          <strong style={{
            fontSize: '14px',
            textTransform: 'uppercase',
            color: episode.figo_classification === 'normal' ? '#15803d' : episode.figo_classification === 'suspicious' ? '#b45309' : '#b91c1c',
          }}>
            {episode.figo_classification}
          </strong>
        </div>

        <div style={{
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid',
          background: episode.nichd_category === 'category_1_normal' ? '#f0fdf4' : episode.nichd_category === 'category_2_indeterminate' ? '#fffbeb' : '#fef2f2',
          borderColor: episode.nichd_category === 'category_1_normal' ? '#bbf7d0' : episode.nichd_category === 'category_2_indeterminate' ? '#fde68a' : '#fecaca',
        }}>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>ACOG / NICHD 3-Tier</span>
          <strong style={{
            fontSize: '13px',
            textTransform: 'capitalize',
            color: episode.nichd_category === 'category_1_normal' ? '#15803d' : episode.nichd_category === 'category_2_indeterminate' ? '#b45309' : '#b91c1c',
          }}>
            {episode.nichd_category.replace(/_/g, ' ')}
          </strong>
        </div>

        <div style={{
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid',
          background: episode.nst_classification === 'reactive' ? '#f0fdf4' : '#fef2f2',
          borderColor: episode.nst_classification === 'reactive' ? '#bbf7d0' : '#fecaca',
        }}>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>NST Reactivity</span>
          <strong style={{
            fontSize: '14px',
            textTransform: 'uppercase',
            color: episode.nst_classification === 'reactive' ? '#15803d' : '#b91c1c',
          }}>
            {episode.nst_classification.replace(/_/g, ' ')}
          </strong>
        </div>
      </div>

      {/* Plan & Resuscitation */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 12px', fontSize: '11px', marginBottom: '20px', background: '#f8fafc' }}>
        <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>Clinical Action Plan &amp; Recommendations</div>
        <div>{episode.clinical_action_plan || 'Reassuring fetal status. Routine surveillance indicated.'}</div>
        {episode.recommended_follow_up && (
          <div style={{ marginTop: '4px', color: '#475569' }}>
            <b>Follow-up:</b> {episode.recommended_follow_up}
          </div>
        )}
      </div>

      {/* Signature & Verification Block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '35px', paddingTop: '15px', borderTop: '1px solid #cbd5e1', fontSize: '11px' }}>
        <div>
          <div>Performed By (Staff Midwife / Nurse)</div>
          <div style={{ marginTop: '25px', color: '#94a3b8' }}>____________________________</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{episode.performed_by_name || 'Staff Nurse'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Reviewed By (Consultant Obstetrician)</div>
          <div style={{ marginTop: '25px', color: '#94a3b8' }}>____________________________</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{episode.reviewed_by_name || 'Dr. Demo Sharma'} (MD, DNB, FICOG)</div>
        </div>
      </div>
    </div>
  );
}
