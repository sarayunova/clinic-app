import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Invoice } from '../api';
import { useAuth } from '../auth';
import { PatientPicker } from '../components/PatientPicker';
import { ErrorBanner, Field } from '../components/ui';
import { PAYMENT_STATE_LABEL, formatMoney, startInvoice } from '../money';

type Filter = 'unpaid' | 'draft' | 'all';

export function BillingPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('unpaid');
  const [list, setList] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setList(null);
    api<Invoice[]>('GET', `/api/invoices?status=${filter}`).then(setList, setError);
  }, [filter]);

  const owed = (list ?? []).filter((i) => i.status === 'issued' && i.balancePaise > 0).reduce((s, i) => s + i.balancePaise, 0);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Billing</h1>
        {can('invoice:write') && <button className="btn primary" onClick={() => setCreating((c) => !c)}>+ New invoice</button>}
      </header>
      <ErrorBanner error={error} />
      {creating && (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Who is the invoice for?</h2>
          <PatientPicker autoFocus onPick={(p) => startInvoice(nav, { patientId: p.id }).catch(setError)} />
        </section>
      )}
      <div className="row wrap">
        <Field label="Show">
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="unpaid">Money still due</option>
            <option value="draft">Drafts (not issued)</option>
            <option value="all">All invoices</option>
          </select>
        </Field>
        {filter === 'unpaid' && list && list.length > 0 && <div className="stat"><b>{formatMoney(owed)}</b><span>Total due</span></div>}
      </div>
      {list === null && !error && <p className="muted">Loading…</p>}
      {list?.length === 0 && <div className="empty"><p>{filter === 'unpaid' ? 'Nothing is owed right now.' : 'No invoices here.'}</p></div>}
      <ul className="list">
        {list?.map((i) => (
          <li key={i.id}>
            <Link className="list-item" to={`/invoices/${i.id}`}>
              <strong>{i.patientName} <span className="muted">{i.patientNumber}</span></strong>
              <span>
                {i.invoiceNumber ?? 'Draft'} · {i.issuedDate ?? 'not issued'} · {formatMoney(i.totalPaise)}
                {i.status === 'issued' && i.balancePaise !== 0 && ` · due ${formatMoney(i.balancePaise)}`}
              </span>
              <span className={`badge ${i.paymentState === 'paid' ? 'ok' : i.paymentState === 'cancelled' || i.paymentState === 'draft' ? '' : 'warn'}`}>
                {PAYMENT_STATE_LABEL[i.paymentState]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
