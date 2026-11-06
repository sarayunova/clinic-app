import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type LabOrder } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function LabOrderPrint() {
  const { id } = useParams();
  const orderId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [order, setOrder] = useState<LabOrder | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!orderId) return;
    api<LabOrder>('GET', `/api/lab-orders/${orderId}`)
      .then(setOrder)
      .catch(setError);
  }, [orderId]);

  const handlePrint = async () => {
    try {
      await api('POST', `/api/lab-orders/${orderId}/print`);
    } catch {
      // non-blocking
    }
    window.print();
  };

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to="/patients" className="btn small">
            ← Back to Patients
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !order) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading lab order requisition slip…</p>
      </div>
    );
  }

  const isUrgent = order.priority === 'urgent' || order.priority === 'stat';

  return (
    <Sheet
      clinic={clinic}
      title="Laboratory Investigation Requisition"
      back={`/patients/${order.patientId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Requisition Title & Priority Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
            ORDER NO: <code>{order.orderNumber}</code>
          </span>
          {order.panelName && (
            <span className="muted" style={{ fontSize: '0.88rem', marginLeft: '0.75rem' }}>
              ({order.panelName})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '3px',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: isUrgent ? '#fee2e2' : '#f1f5f9',
              color: isUrgent ? '#b91c1c' : '#334155',
              border: isUrgent ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
            }}
          >
            {isUrgent ? `🚨 Priority: ${order.priority}` : 'Routine Priority'}
          </span>
        </div>
      </div>

      {/* Patient Demographic Details */}
      <section className="sheet-block">
        <dl
          className="grid-meta"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.4rem 1rem',
            margin: 0,
            fontSize: '0.85rem',
          }}
        >
          <div>
            <dt className="muted small">Patient Name</dt>
            <dd><strong>{order.patientName}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Patient ID / MRN</dt>
            <dd>{order.patientNumber}</dd>
          </div>
          <div>
            <dt className="muted small">Order Date</dt>
            <dd><strong>{order.orderDate}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Date of Birth</dt>
            <dd>{order.dateOfBirth || '—'}</dd>
          </div>
          <div>
            <dt className="muted small">Contact Phone</dt>
            <dd>{order.patientPhone || '—'}</dd>
          </div>
          <div>
            <dt className="muted small">Ordering Clinician</dt>
            <dd>{order.orderedByName || clinic.doctorName}</dd>
          </div>
        </dl>
      </section>

      {/* Clinical Notes / Indication */}
      {order.clinicalNotes && (
        <div
          style={{
            marginTop: '0.6rem',
            padding: '0.4rem 0.6rem',
            background: '#f8fafc',
            borderLeft: '3px solid #64748b',
            fontSize: '0.85rem',
          }}
        >
          <strong>Clinical Diagnosis / Indication:</strong> {order.clinicalNotes}
        </div>
      )}

      {/* Requested Investigations Table */}
      <section className="sheet-block" style={{ marginTop: '0.8rem' }}>
        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
          Requested Tests ({order.items.length})
        </h3>
        <table className="sheet-table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginTop: '0.3rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>
              <th style={{ padding: '0.4rem', width: '35px' }}>#</th>
              <th style={{ padding: '0.4rem' }}>Test Name</th>
              <th style={{ padding: '0.4rem' }}>Department / Category</th>
              <th style={{ padding: '0.4rem' }}>Units</th>
              <th style={{ padding: '0.4rem' }}>Biological Reference Interval</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, idx) => (
              <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem', color: '#64748b' }}>{idx + 1}</td>
                <td style={{ padding: '0.4rem' }}>
                  <strong>{it.testName}</strong>
                </td>
                <td style={{ padding: '0.4rem', textTransform: 'capitalize' }} className="muted small">
                  {it.category}
                </td>
                <td style={{ padding: '0.4rem' }}>{it.unit || '—'}</td>
                <td style={{ padding: '0.4rem' }} className="small muted">
                  {it.referenceRange || 'Standard lab reference'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Phlebotomy / Sample Collection & Transport Advice */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '0.5rem 0.75rem',
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '4px',
          fontSize: '0.78rem',
          lineHeight: 1.4,
        }}
      >
        <strong>⚠️ Sample Collection &amp; Handling Instructions:</strong>
        <div style={{ marginTop: '0.2rem' }}>
          • Verify patient identity with full name and MRN prior to venipuncture.
          <br />
          • Fasting status required where applicable (FPG / Lipid profile: 8–10 hours overnight fast).
          <br />
          • Mix EDTA and Citrate vacuum tubes gently (5–8 gentle inversions) immediately after drawing.
        </div>
      </div>

      {/* Signature & Attestation Block */}
      <div
        style={{
          marginTop: '2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ textAlign: 'left', minWidth: '180px' }}>
          <div style={{ borderBottom: '1px solid #94a3b8', width: '180px', marginBottom: '0.35rem' }} />
          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Specimen Collected By</div>
          <div className="muted small" style={{ fontSize: '0.72rem' }}>Date &amp; Time: __________________</div>
        </div>

        <SignatureBlock
          clinic={clinic}
          signatoryName={order.orderedByName || clinic.doctorName}
          designation="Ordering Clinician / Medical Officer"
          style={{ marginTop: 0 }}
        />
      </div>
    </Sheet>
  );
}
