import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type CollectionReport as Report } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { ErrorBanner, Field, todayLocal } from '../components/ui';
import { METHOD_LABEL, formatMoney } from '../money';

/** Money received and refunded over a date range, for end-of-day cash checking. Printable. */
export function CollectionReportPage() {
  const { clinic } = useClinic();
  const [from, setFrom] = useState(todayLocal());
  const [to, setTo] = useState(todayLocal());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!from || !to) return;
    setReport(null);
    setError(null);
    api<Report>('GET', `/api/billing/collections?from=${from}&to=${to}`).then(setReport, setError);
  }, [from, to]);

  const range = from === to ? from : `${from} to ${to}`;
  const controls = (
    <div className="row wrap">
      <Field label="From"><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label="To"><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
    </div>
  );

  if (!clinic) return <p className="muted">Loading…</p>;
  return (
    <Sheet clinic={clinic} title={`Collection report: ${range}`} back="/billing" controls={<><ErrorBanner error={error} />{controls}</>}>
      {!report && !error && <p className="muted">Loading…</p>}
      {report && (
        <>
          <dl className="totals">
            <div><dt>Received</dt><dd>{formatMoney(report.paidPaise)}</dd></div>
            <div><dt>Refunded</dt><dd>{formatMoney(report.refundedPaise)}</dd></div>
            <div className="big"><dt>Net collected</dt><dd>{formatMoney(report.netPaise)}</dd></div>
            <div><dt>Invoices issued: {report.invoicesIssued.count}</dt><dd>{formatMoney(report.invoicesIssued.totalPaise)}</dd></div>
          </dl>

          {report.count === 0 ? (
            <p>No payments or refunds in this period.</p>
          ) : (
            <>
              <h3>By payment method</h3>
              <Breakdown rows={report.byMethod.map((r) => ({ label: METHOD_LABEL[r.method], ...r }))} />
              <h3>By staff member</h3>
              <Breakdown rows={report.byStaff.map((r) => ({ label: r.name, ...r }))} />
              {report.byDay.length > 1 && (
                <>
                  <h3>By day</h3>
                  <Breakdown rows={report.byDay.map((r) => ({ label: r.date, ...r }))} />
                </>
              )}
              <h3>Every payment and refund</h3>
              <table className="table">
                <thead><tr><th>When</th><th>Receipt</th><th>Patient</th><th>Invoice</th><th>Method</th><th>By</th><th>Amount</th></tr></thead>
                <tbody>
                  {report.transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date} {t.time}</td>
                      <td>{t.receiptNumber}</td>
                      <td>{t.patientName} <span className="small">{t.patientNumber}</span></td>
                      <td><Link to={`/invoices/${t.invoiceId}`}>{t.invoiceNumber}</Link></td>
                      <td>{METHOD_LABEL[t.method]}{t.reference ? ` (${t.reference})` : ''}</td>
                      <td>{t.receivedByName}</td>
                      <td>{t.kind === 'refund' ? `Refund -${formatMoney(t.amountPaise)}` : formatMoney(t.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.truncated && <p className="banner warn">Only the first {report.transactions.length} transactions are listed. The totals above include all of them; choose a shorter period to see every line.</p>}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

function Breakdown({ rows }: { rows: { label: string; paidPaise: number; refundedPaise: number; netPaise: number }[] }) {
  return (
    <table className="table">
      <thead><tr><th></th><th>Received</th><th>Refunded</th><th>Net</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}><td>{r.label}</td><td>{formatMoney(r.paidPaise)}</td><td>{formatMoney(r.refundedPaise)}</td><td>{formatMoney(r.netPaise)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
