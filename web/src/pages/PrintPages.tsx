import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type ClinicSettings, type Invoice } from '../api';
import { ErrorBanner } from '../components/ui';
import { CATEGORY_LABEL, METHOD_LABEL, formatMoney } from '../money';

function useInvoiceAndClinic() {
  const { id } = useParams();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<Invoice>('GET', `/api/invoices/${id}`).then(setInv, setError);
    api<ClinicSettings>('GET', '/api/settings').then(setClinic, setError);
  }, [id]);
  return { inv, clinic, error };
}

function Sheet({ clinic, title, back, children }: { clinic: ClinicSettings; title: string; back: string; children: ReactNode }) {
  return (
    <div className="page narrow">
      <div className="row no-print" style={{ justifyContent: 'space-between' }}>
        <Link to={back}>← Back</Link>
        <button className="btn primary" onClick={() => window.print()}>Print</button>
      </div>
      <article className="sheet">
        <header className="sheet-head">
          <h1>{clinic.clinicName || 'Clinic name not set'}</h1>
          {clinic.address && <div className="pre">{clinic.address}</div>}
          <div>{[clinic.phone && `Phone: ${clinic.phone}`, clinic.doctorName, clinic.registrationNo && `Reg. no. ${clinic.registrationNo}`].filter(Boolean).join(' · ')}</div>
          {!clinic.clinicName && <div className="banner warn no-print">The doctor can add the clinic name and address under “Clinic” in the menu so they print here.</div>}
        </header>
        <h2 className="sheet-title">{title}</h2>
        {children}
      </article>
    </div>
  );
}

export function InvoicePrint() {
  const { inv, clinic, error } = useInvoiceAndClinic();
  if (error) return <ErrorBanner error={error} />;
  if (!inv || !clinic) return <p className="muted">Loading…</p>;
  return (
    <Sheet clinic={clinic} title={inv.status === 'cancelled' ? 'INVOICE (CANCELLED)' : inv.status === 'draft' ? 'INVOICE (DRAFT)' : 'INVOICE'} back={`/invoices/${inv.id}`}>
      <dl className="sheet-meta">
        <div><dt>Invoice no.</dt><dd>{inv.invoiceNumber ?? 'Draft'}</dd></div>
        <div><dt>Date</dt><dd>{inv.issuedDate ?? '-'}</dd></div>
        <div><dt>Patient</dt><dd>{inv.patientName} ({inv.patientNumber})</dd></div>
        {inv.admissionNumber && <div><dt>Admission</dt><dd>{inv.admissionNumber}</dd></div>}
      </dl>
      <table className="table">
        <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
        <tbody>
          {(inv.lines ?? []).map((l) => (
            <tr key={l.id}><td>{l.description} <span className="small">({CATEGORY_LABEL[l.category]})</span></td><td>{l.quantity}</td><td>{formatMoney(l.unitPricePaise)}</td><td>{formatMoney(l.amountPaise ?? 0)}</td></tr>
          ))}
        </tbody>
      </table>
      <dl className="totals">
        <div><dt>Charges</dt><dd>{formatMoney(inv.linesPaise)}</dd></div>
        {(inv.adjustments ?? []).map((a) => (
          <div key={a.id}><dt>{a.kind === 'discount' ? 'Discount' : a.kind === 'write_off' ? 'Write-off' : 'Correction'}: {a.reason}</dt><dd>{formatMoney(a.amountPaise)}</dd></div>
        ))}
        <div><dt>Total</dt><dd>{formatMoney(inv.totalPaise)}</dd></div>
        {(inv.payments ?? []).map((p) => (
          <div key={p.id}><dt>{p.kind === 'refund' ? 'Refunded' : 'Paid'} {p.paidDate} ({METHOD_LABEL[p.method]}) {p.receiptNumber}</dt><dd>{p.kind === 'refund' ? '' : '-'}{formatMoney(p.amountPaise)}{p.kind === 'refund' ? '' : ''}</dd></div>
        ))}
        <div className="big"><dt>{inv.balancePaise < 0 ? 'Credit due back' : 'Balance due'}</dt><dd>{formatMoney(Math.abs(inv.balancePaise))}</dd></div>
      </dl>
      {inv.notes && <p className="pre">{inv.notes}</p>}
    </Sheet>
  );
}

export function ReceiptPrint() {
  const { pid } = useParams();
  const { inv, clinic, error } = useInvoiceAndClinic();
  if (error) return <ErrorBanner error={error} />;
  if (!inv || !clinic) return <p className="muted">Loading…</p>;
  const p = (inv.payments ?? []).find((x) => String(x.id) === pid);
  if (!p) return <div className="page narrow"><div className="banner error">Receipt not found.</div></div>;
  const refund = p.kind === 'refund';
  return (
    <Sheet clinic={clinic} title={refund ? 'REFUND NOTE' : 'PAYMENT RECEIPT'} back={`/invoices/${inv.id}`}>
      <dl className="sheet-meta">
        <div><dt>{refund ? 'Refund no.' : 'Receipt no.'}</dt><dd>{p.receiptNumber}</dd></div>
        <div><dt>Date</dt><dd>{p.paidDate} {p.paidTime}</dd></div>
        <div><dt>Patient</dt><dd>{inv.patientName} ({inv.patientNumber})</dd></div>
        <div><dt>Against invoice</dt><dd>{inv.invoiceNumber}</dd></div>
        <div><dt>Method</dt><dd>{METHOD_LABEL[p.method]}{p.reference ? ` (${p.reference})` : ''}</dd></div>
        {refund && p.reason && <div><dt>Reason</dt><dd>{p.reason}</dd></div>}
      </dl>
      <dl className="totals">
        <div className="big"><dt>{refund ? 'Amount returned' : 'Amount received'}</dt><dd>{formatMoney(p.amountPaise)}</dd></div>
        <div><dt>Invoice total</dt><dd>{formatMoney(inv.totalPaise)}</dd></div>
        <div><dt>Balance due now</dt><dd>{formatMoney(Math.max(0, inv.balancePaise))}</dd></div>
      </dl>
      <p className="small">Received by {p.receivedByName}</p>
    </Sheet>
  );
}
