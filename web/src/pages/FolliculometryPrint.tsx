import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { FolliculometryCycle, InfertilityWorkup, InfertilityWorkupResponse } from '../api';
import { evaluateEndometrialReceptivity } from '../folliculometryEngine';

export function FolliculometryPrint() {
  const { id } = useParams<{ id: string }>();
  const [cycle, setCycle] = useState<FolliculometryCycle | null>(null);
  const [workup, setWorkup] = useState<InfertilityWorkup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/folliculometry-cycles/${id}`);
        if (!res.ok) throw new Error('Failed to load cycle data');
        const data: FolliculometryCycle = await res.json();
        setCycle(data);

        // Fetch patient workup if exists
        const wRes = await fetch(`/api/patients/${data.patientId}/infertility-workup`);
        if (wRes.ok) {
          const wData: InfertilityWorkupResponse = await wRes.json();
          setWorkup(wData.workup);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading printable report');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading cycle report for printing...</div>;
  }

  if (error || !cycle) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: 'sans-serif' }}>{error || 'Cycle not found'}</div>;
  }

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
          🖨️ Print Clinical Report
        </button>
      </div>

      {/* Hospital / Clinic Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Department of Reproductive Medicine & Gynecology
        </h1>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 600, color: '#4338ca' }}>
          Serial Folliculometry & Ovulation Induction Flowsheet
        </h2>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Document Ref: FOLLICULOMETRY-CYC-{cycle.id} | Printed on: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </div>

      {/* Patient & Partner Demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.875rem' }}>
        <div>
          <div><strong>Patient Name:</strong> {cycle.patientName || `Patient #${cycle.patientId}`}</div>
          <div><strong>Patient MRN / ID:</strong> {cycle.patientNumber || cycle.patientId}</div>
          {workup && <div><strong>Infertility Workup:</strong> {workup.infertilityType.toUpperCase()} ({workup.durationYears ? `${workup.durationYears} yrs` : 'Unspecified duration'})</div>}
        </div>
        <div>
          {workup?.partnerName && <div><strong>Partner:</strong> {workup.partnerName} {workup.partnerAge ? `(${workup.partnerAge}y)` : ''}</div>}
          {workup?.baselineAmhNgMl != null && <div><strong>Ovarian Reserve (AMH):</strong> {workup.baselineAmhNgMl} ng/mL | AFC: {workup.baselineAfcTotal ?? '—'}</div>}
          {workup?.semenAnalysisInterpretation && <div><strong>Semen Analysis:</strong> {workup.semenAnalysisInterpretation}</div>}
        </div>
      </div>

      {/* Cycle Specifications */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.875rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div><strong>Cycle Number:</strong> #{cycle.cycleNumber}</div>
          <div><strong>LMP (Cycle Day 1):</strong> {cycle.lmpDate}</div>
          <div><strong>Procedure:</strong> {cycle.plannedProcedure.replace('_', ' ').toUpperCase()}</div>
        </div>
        <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          <div><strong>Induction Protocol:</strong> {cycle.protocolType.replace(/_/g, ' ').toUpperCase()} {cycle.protocolDetails ? `— ${cycle.protocolDetails}` : ''}</div>
          {cycle.lutealSupport && <div><strong>Luteal Phase Support:</strong> {cycle.lutealSupport}</div>}
        </div>
      </div>

      {/* Trigger & Insemination Information */}
      {cycle.triggerDatetime && (
        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.875rem' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>⚡ Ovulation Trigger & Insemination Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            <div><strong>Trigger Medication:</strong> {cycle.triggerDrug || 'rhCG 250 mcg'}</div>
            <div><strong>Trigger Administration Time:</strong> {new Date(cycle.triggerDatetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            {cycle.advisedTicIuiDatetime && (
              <div style={{ gridColumn: 'span 2' }}>
                <strong>Scheduled {cycle.plannedProcedure === 'iui' ? 'IUI Procedure' : 'Timed Intercourse'}:</strong>{' '}
                {new Date(cycle.advisedTicIuiDatetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Serial Folliculometry Scans Table */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
          Serial Transvaginal Ultrasound (TVS) Scans
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Cycle Day</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Scan Date & Time</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Right Ovary (mm)</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Left Ovary (mm)</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Dominant Follicle</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Velocity</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Endometrium (ET)</th>
              <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Remarks / Advice</th>
            </tr>
          </thead>
          <tbody>
            {cycle.scans.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
                  No ultrasound scans logged for this cycle.
                </td>
              </tr>
            ) : (
              cycle.scans.map((s) => {
                const endoEval = evaluateEndometrialReceptivity(s.endometrialThicknessMm, s.endometrialPattern);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, border: '1px solid #cbd5e1' }}>CD {s.cycleDay}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{new Date(s.scanDatetime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{s.rightOvaryFollicles.length > 0 ? s.rightOvaryFollicles.join(', ') : '<10 mm'}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{s.leftOvaryFollicles.length > 0 ? s.leftOvaryFollicles.join(', ') : '<10 mm'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, border: '1px solid #cbd5e1' }}>
                      {s.leadingFollicleSizeMm ? `${s.leadingFollicleSizeMm} mm (${s.leadingFollicleOvary})` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{s.growthRateMmDay != null ? `+${s.growthRateMmDay} mm/d` : '—'}</td>
                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                      {s.endometrialThicknessMm != null ? `${s.endometrialThicknessMm} mm (${endoEval.label})` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                      {s.ovulationRuptureObserved && <span style={{ fontWeight: 700, color: '#15803d' }}>[RUPTURED] </span>}
                      {s.clinicalAdvice || s.readinessStage?.replace(/_/g, ' ')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Outcome / Follow-up */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 16px', marginBottom: '30px', fontSize: '0.875rem' }}>
        <div><strong>Cycle Status / Outcome:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{cycle.cycleOutcome !== 'pending' ? cycle.cycleOutcome.replace(/_/g, ' ') : cycle.status.replace(/_/g, ' ')}</span></div>
        {cycle.outcomeNotes && <div style={{ marginTop: '4px' }}><strong>Outcome Notes:</strong> {cycle.outcomeNotes}</div>}
      </div>

      {/* Signature & Verification Block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Logged by: {cycle.createdByName || 'Medical Staff'}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Last updated: {new Date(cycle.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '220px' }}>
          <div style={{ borderBottom: '1px solid #0f172a', marginBottom: '6px', height: '40px' }} />
          <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Consultant Gynecologist / Sonologist</div>
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
