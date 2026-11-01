import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Invoice } from '../api';
import { useAuth } from '../auth';
import { PAYMENT_STATE_LABEL, formatMoney, startInvoice } from '../money';
import { ErrorBanner } from './ui';

/** On a consultation: the invoices already made for this visit, and a button to start one. */
export function VisitInvoice({ patientId, visitId }: { patientId: number; visitId: number }) {
  const { can } = useAuth();
  const nav = useNavigate();
  const [mine, setMine] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const allowed = can('billing:read');

  useEffect(() => {
    if (!allowed) return;
    api<Invoice[]>('GET', `/api/patients/${patientId}/invoices`).then((all) => setMine(all.filter((i) => i.visitId === visitId && i.status !== 'cancelled')), setError);
  }, [allowed, patientId, visitId]);

  if (!allowed) return null;
  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Billing</h2>
      <ErrorBanner error={error} />
      {mine?.map((i) => (
        <div key={i.id}>
          <Link to={`/invoices/${i.id}`}>{i.invoiceNumber ?? 'Draft invoice'}</Link> · {formatMoney(i.totalPaise)} · {PAYMENT_STATE_LABEL[i.paymentState]}
        </div>
      ))}
      {mine?.length === 0 && <p className="muted">No invoice for this visit yet.</p>}
      {can('invoice:write') && (
        <div>
          <button
            className="btn"
            disabled={busy || mine === null}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await startInvoice(nav, { patientId, visitId });
              } catch (e) {
                setError(e);
                setBusy(false);
              }
            }}
          >
            {mine && mine.length > 0 ? 'Start another invoice for this visit' : 'Start invoice for this visit'}
          </button>
        </div>
      )}
    </section>
  );
}
