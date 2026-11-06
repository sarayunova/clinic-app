import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ErasPostOpPathway } from '../api';
import { evaluateErasMilestoneAdherence } from '../erasReedaEngine';

export function ErasReedaPrint() {
  const { id } = useParams<{ id: string }>();
  const [pathway, setPathway] = useState<ErasPostOpPathway | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/eras-pathways/${id}`);
        if (!res.ok) throw new Error('Failed to load ERAS pathway');
        const data: ErasPostOpPathway = await res.json();
        setPathway(data);
      } catch (err: any) {
        setError(err.message || 'Error loading report');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading ERAS & REEDA recovery sheet...</div>;
  }

  if (error || !pathway) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: 'sans-serif' }}>{error || 'Pathway not found'}</div>;
  }

  const adherence = evaluateErasMilestoneAdherence({
    oralFluidsAchievedHours: pathway.oralFluidsAchievedHours,
    regularDietAchievedHours: pathway.regularDietAchievedHours,
    catheterRemovedHours: pathway.catheterRemovedHours,
    firstMobilizationHours: pathway.firstMobilizationHours,
    multimodalAnalgesiaAdherent: pathway.multimodalAnalgesiaAdherent,
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      {/* Print Action Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => window.history.back()}
          style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          🖨️ Print ERAS Recovery Sheet
        </button>
      </div>

      {/* Hospital Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Department of Obstetrics & Gynecology
        </h1>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 600, color: '#3730a3' }}>
          Post-Operative Enhanced Recovery (ERAS) & REEDA Wound Healing Sheet
        </h2>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Pathway Ref: ERAS-PATHWAY-{pathway.id} | Printed on: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </div>

      {/* Surgical Demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.875rem' }}>
        <div>
          <div><strong>Patient Name:</strong> {pathway.patientName || `Patient #${pathway.patientId}`}</div>
          <div><strong>Patient MRN / ID:</strong> {pathway.patientNumber || pathway.patientId}</div>
          <div><strong>Surgical Procedure:</strong> {pathway.surgeryType.replace(/_/g, ' ').toUpperCase()}</div>
        </div>
        <div>
          <div><strong>Surgery Date & Time:</strong> {new Date(pathway.surgeryDatetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          <div><strong>Incision / Closure:</strong> {pathway.incisionType.toUpperCase()} / {pathway.skinClosureType.replace(/_/g, ' ')}</div>
          <div><strong>DVT Prophylaxis:</strong> {pathway.dvtProphylaxisApplied.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {/* ERAS Milestone Adherence Table */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
          <strong style={{ color: '#0f172a' }}>ERAS Recovery Milestones & Benchmarks</strong>
          <span style={{ fontWeight: 700, color: adherence.adherencePercentage >= 80 ? '#15803d' : '#b45309' }}>
            Adherence: {adherence.adherencePercentage}%
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.8rem' }}>
          {adherence.benchmarks.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', background: '#f8fafc', borderRadius: '4px' }}>
              <span>{b.milestone}:</span>
              <strong style={{ color: b.met ? '#15803d' : '#b45309' }}>{b.statusLabel}</strong>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', background: '#f8fafc', borderRadius: '4px' }}>
            <span>Multimodal Analgesia:</span>
            <strong style={{ color: pathway.multimodalAnalgesiaAdherent ? '#15803d' : '#b91c1c' }}>
              {pathway.multimodalAnalgesiaAdherent ? 'Adherent' : 'Non-Adherent'}
            </strong>
          </div>
        </div>
      </div>

      {/* Serial REEDA Wound Assessments Table */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
          Serial REEDA Surgical Incision Assessments
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Day</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Date / Time</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>R · E · E · D · A</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Total (0-15)</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Healing Category</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Pain</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Dressing</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Action Plan / Remarks</th>
            </tr>
          </thead>
          <tbody>
            {pathway.assessments.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
                  No REEDA wound evaluations logged yet.
                </td>
              </tr>
            ) : (
              pathway.assessments.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, border: '1px solid #cbd5e1' }}>POD {a.postOpDay}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{new Date(a.assessmentDatetime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, border: '1px solid #cbd5e1' }}>
                    {a.rednessScore} · {a.edemaScore} · {a.ecchymosisScore} · {a.dischargeScore} · {a.approximationScore}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, border: '1px solid #cbd5e1' }}>
                    {a.totalReedaScore} / 15
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textTransform: 'capitalize' }}>
                    {a.healingCategory.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                    {a.painScore10 != null ? `${a.painScore10}/10` : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textTransform: 'capitalize' }}>
                    {a.dressingCondition.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                    {a.actionPlan || 'Routine wound hygiene.'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Notes & Discharge Readiness */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 16px', marginBottom: '30px', fontSize: '0.875rem' }}>
        <div><strong>Status / Readiness:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{pathway.status.replace(/_/g, ' ')}</span></div>
        {pathway.clinicalNotes && <div style={{ marginTop: '4px' }}><strong>Notes:</strong> {pathway.clinicalNotes}</div>}
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Pathway created by: {pathway.createdByName || 'Obstetric Surgical Team'}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Last updated: {new Date(pathway.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '220px' }}>
          <div style={{ borderBottom: '1px solid #0f172a', marginBottom: '6px', height: '40px' }} />
          <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Consultant Obstetrician / Surgeon</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Reg. No. / Signature & Seal</div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
        }
      `}</style>
    </div>
  );
}
