import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Invoice, type InvoiceCategory, type PayMethod } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from '../components/ui';
import { CATEGORY_LABEL, METHOD_LABEL, PAYMENT_STATE_LABEL, formatMoney, parseRupees, rupeesText } from '../money';

export function InvoicePage() {
  const { id } = useParams();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInv(await api<Invoice>('GET', `/api/invoices/${id}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
    }
  }, [id]);
  useEffect(() => {
    setInv(null);
    setNotice(null);
    void load();
  }, [load]);

  if (loadError) return <div className="page narrow"><ErrorBanner error={loadError} /><Link to="/billing">Back to billing</Link></div>;
  if (!inv) return <p className="muted">Loading…</p>;
  const done = async (msg: string) => {
    await load();
    setNotice(msg);
  };

  return (
    <div className="page narrow">
      <p><Link to="/billing">← Billing</Link> · <Link to={`/patients/${inv.patientId}`}>Patient record</Link></p>
      <header className="patient-head">
        <div>
          <h1>{inv.invoiceNumber ?? 'Draft invoice'}</h1>
          <div className="muted">{inv.patientName} · {inv.patientNumber}</div>
          <div className="muted">
            {inv.issuedDate ? `Issued ${inv.issuedDate} ${inv.issuedTime}` : 'Not issued yet'}
            {inv.admissionNumber ? ` · Admission ${inv.admissionNumber}` : ''}
            {inv.visitDate ? ` · Visit ${inv.visitDate}` : ''}
          </div>
        </div>
        <span className={`badge ${inv.paymentState === 'paid' ? 'ok' : inv.paymentState === 'unpaid' || inv.paymentState === 'part_paid' || inv.paymentState === 'credit' ? 'warn' : ''}`}>
          {PAYMENT_STATE_LABEL[inv.paymentState]}
        </span>
      </header>
      {notice && <div className="banner ok" role="status">{notice}</div>}
      {inv.status === 'draft' ? <DraftEditor inv={inv} onDone={done} /> : <IssuedView inv={inv} onDone={done} />}
    </div>
  );
}

interface Row {
  category: InvoiceCategory;
  description: string;
  quantity: string;
  price: string;
}

function DraftEditor({ inv, onDone }: { inv: Invoice; onDone: (m: string) => Promise<void> }) {
  const nav = useNavigate();
  const blank: Row = { category: 'consultation', description: '', quantity: '1', price: '' };
  const [rows, setRows] = useState<Row[]>(
    (inv.lines ?? []).length
      ? inv.lines!.map((l) => ({ category: l.category, description: l.description, quantity: String(l.quantity), price: rupeesText(l.unitPricePaise) }))
      : [blank],
  );
  const [notes, setNotes] = useState(inv.notes ?? '');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const parsed = rows.map((r) => ({ q: /^\d+$/.test(r.quantity) ? Number(r.quantity) : null, p: parseRupees(r.price) }));
  const valid = rows.every((r, i) => r.description.trim() && parsed[i]!.q && parsed[i]!.q! >= 1 && parsed[i]!.p !== null);
  const total = rows.reduce((s, _, i) => s + (parsed[i]!.q ?? 0) * (parsed[i]!.p ?? 0), 0);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    await api('PUT', `/api/invoices/${inv.id}/lines`, {
      lines: rows.map((r, i) => ({ category: r.category, description: r.description.trim(), quantity: parsed[i]!.q, unitPricePaise: parsed[i]!.p })),
      notes: notes.trim(),
    });
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { await save(); await onDone('Saved.'); }); }} className="stack">
      <ErrorBanner error={error} />
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Charges</h2>
        {rows.map((r, i) => (
          <div key={i} className="card stack" style={{ background: 'var(--bg)' }}>
            <div className="grid2">
              <Field label="Category">
                <select value={r.category} onChange={(e) => set(i, { category: e.target.value as InvoiceCategory })}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Description">
                <input value={r.description} onChange={(e) => set(i, { description: e.target.value })} maxLength={300} required />
              </Field>
              <Field label="Quantity" error={parsed[i]!.q === null || parsed[i]!.q! < 1 ? 'Whole number, 1 or more' : undefined}>
                <input inputMode="numeric" value={r.quantity} onChange={(e) => set(i, { quantity: e.target.value })} required />
              </Field>
              <Field label="Price each (₹)" error={r.price !== '' && parsed[i]!.p === null ? 'Like 500 or 500.50' : undefined}>
                <input inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} required />
              </Field>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{formatMoney((parsed[i]!.q ?? 0) * (parsed[i]!.p ?? 0))}</strong>
              {rows.length > 1 && <button type="button" className="link" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>}
            </div>
          </div>
        ))}
        <div><button type="button" className="btn" onClick={() => setRows([...rows, blank])}>+ Add a charge</button></div>
        <Field label="Notes (printed on the invoice)">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
        <div className="row" style={{ justifyContent: 'space-between' }}><strong>Total</strong><strong>{formatMoney(total)}</strong></div>
      </section>
      <div className="row wrap">
        <button className="btn" disabled={busy || !valid}>{busy ? 'Saving…' : 'Save draft'}</button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || !valid || total <= 0}
          onClick={() => void run(async () => {
            if (!window.confirm('Issue this invoice? Charges cannot be edited afterwards; changes need a doctor-authorised adjustment.')) return;
            await save();
            await api('POST', `/api/invoices/${inv.id}/issue`, {});
            await onDone('Invoice issued.');
          })}
        >
          Issue invoice
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void run(async () => {
            if (!window.confirm('Discard this draft?')) return;
            await api('DELETE', `/api/invoices/${inv.id}`);
            nav('/billing');
          })}
        >
          Discard draft
        </button>
      </div>
    </form>
  );
}

function IssuedView({ inv, onDone }: { inv: Invoice; onDone: (m: string) => Promise<void> }) {
  const { can } = useAuth();
  const [panel, setPanel] = useState<'none' | 'pay' | 'adjust' | 'refund' | 'cancel'>('none');
  const live = inv.status === 'issued';
  const close = async (m: string) => {
    setPanel('none');
    await onDone(m);
  };
  return (
    <>
      {inv.status === 'cancelled' && <div className="banner warn">This invoice was cancelled. Reason: {inv.cancelReason}</div>}
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Charges</h2>
        <table className="table">
          <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>
            {(inv.lines ?? []).map((l) => (
              <tr key={l.id}>
                <td>{l.description} <span className="muted small">{CATEGORY_LABEL[l.category]}</span></td>
                <td>{l.quantity}</td>
                <td>{formatMoney(l.unitPricePaise)}</td>
                <td>{formatMoney(l.amountPaise ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {inv.notes && <div className="pre muted">{inv.notes}</div>}
        {(inv.adjustments ?? []).map((a) => (
          <div key={a.id} className="correction">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{a.kind === 'discount' ? 'Discount' : a.kind === 'write_off' ? 'Write-off' : 'Correction'}</strong>
              <strong>{formatMoney(a.amountPaise)}</strong>
            </div>
            <div className="muted small">{a.reason} · authorised by {a.authorisedByName} · {a.createdDate} {a.createdTime}</div>
          </div>
        ))}
        <dl className="totals">
          <div><dt>Invoice total</dt><dd>{formatMoney(inv.totalPaise)}</dd></div>
          <div><dt>Paid (net of refunds)</dt><dd>{formatMoney(inv.netPaidPaise)}</dd></div>
          <div className="big"><dt>{inv.balancePaise < 0 ? 'Credit due back' : 'Balance due'}</dt><dd>{formatMoney(Math.abs(inv.balancePaise))}</dd></div>
        </dl>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Payments</h2>
        {(inv.payments ?? []).length === 0 && <p className="muted">No payments yet.</p>}
        <ul className="plain">
          {(inv.payments ?? []).map((p) => (
            <li key={p.id}>
              <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                <span>
                  <span className={`badge ${p.kind === 'refund' ? 'warn' : 'ok'}`}>{p.kind === 'refund' ? 'Refund' : 'Payment'}</span>{' '}
                  <strong>{p.kind === 'refund' ? '-' : ''}{formatMoney(p.amountPaise)}</strong> · {METHOD_LABEL[p.method]}
                  {p.reference ? ` (${p.reference})` : ''}
                </span>
                <Link to={`/invoices/${inv.id}/receipts/${p.id}`}>Print {p.kind === 'refund' ? 'refund note' : 'receipt'} {p.receiptNumber}</Link>
              </div>
              <div className="muted small">{p.paidDate} {p.paidTime} · {p.receivedByName}{p.reason ? ` · ${p.reason}` : ''}</div>
            </li>
          ))}
        </ul>
        {live && panel === 'none' && (
          <div className="row wrap">
            {can('payment:take') && inv.balancePaise > 0 && <button className="btn primary" onClick={() => setPanel('pay')}>Take payment</button>}
            {can('billing:authorise') && <button className="btn" onClick={() => setPanel('adjust')}>Discount / adjust</button>}
            {can('billing:authorise') && inv.netPaidPaise > 0 && <button className="btn" onClick={() => setPanel('refund')}>Refund</button>}
            {can('billing:authorise') && inv.netPaidPaise === 0 && <button className="btn" onClick={() => setPanel('cancel')}>Cancel invoice</button>}
          </div>
        )}
        {live && panel === 'pay' && <PayForm inv={inv} onDone={() => close('Payment recorded.')} onCancel={() => setPanel('none')} />}
        {live && panel === 'adjust' && <AdjustForm inv={inv} onDone={() => close('Adjustment recorded.')} onCancel={() => setPanel('none')} />}
        {live && panel === 'refund' && <RefundForm inv={inv} onDone={() => close('Refund recorded.')} onCancel={() => setPanel('none')} />}
        {live && panel === 'cancel' && <CancelForm inv={inv} onDone={() => close('Invoice cancelled.')} onCancel={() => setPanel('none')} />}
        {live && !can('billing:authorise') && <p className="muted small">Discounts, refunds and cancellations need the doctor.</p>}
      </section>
      <div className="row"><Link className="btn" to={`/invoices/${inv.id}/print`}>Print invoice</Link></div>
    </>
  );
}

function useSubmit(onDone: () => Promise<void>) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent, fn: () => Promise<unknown>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, submit };
}

function PayForm({ inv, onDone, onCancel }: { inv: Invoice; onDone: () => Promise<void>; onCancel: () => void }) {
  const [amount, setAmount] = useState(rupeesText(inv.balancePaise));
  const [method, setMethod] = useState<PayMethod>('cash');
  const [reference, setReference] = useState('');
  const [earlier, setEarlier] = useState(false);
  const [when, setWhen] = useState({ date: '', time: '' });
  const { error, busy, submit } = useSubmit(onDone);
  const fe = fieldErrorsOf(error);
  const paise = parseRupees(amount);
  return (
    <form className="stack correction-form" onSubmit={(e) => submit(e, () => api('POST', `/api/invoices/${inv.id}/payments`, {
      amountPaise: paise, method, ...(reference.trim() ? { reference: reference.trim() } : {}), ...(earlier ? { paidDate: when.date, paidTime: when.time } : {}),
    }))}>
      <ErrorBanner error={error} />
      <div className="grid2">
        <Field label="Amount received (₹)" error={fe.amountPaise ?? (paise === null || paise < 1 ? 'Like 500 or 500.50' : paise > inv.balancePaise ? 'More than the balance' : undefined)}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Reference (UPI id, cheque number, optional)">
        <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} />
      </Field>
      <label className="row">
        <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={earlier} onChange={(e) => setEarlier(e.target.checked)} />
        <span>Received earlier (set the actual time)</span>
      </label>
      {earlier && (
        <div className="grid2">
          <Field label="Date" error={fe.paidDate}><input type="date" max={todayLocal()} value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} required /></Field>
          <Field label="Time"><input type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} required /></Field>
        </div>
      )}
      <div className="row">
        <button className="btn primary" disabled={busy || paise === null || paise < 1 || paise > inv.balancePaise}>{busy ? 'Saving…' : 'Record payment'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AdjustForm({ inv, onDone, onCancel }: { inv: Invoice; onDone: () => Promise<void>; onCancel: () => void }) {
  const [kind, setKind] = useState<'discount' | 'write_off' | 'correction'>('discount');
  const [amount, setAmount] = useState('');
  const [increase, setIncrease] = useState(false);
  const [reason, setReason] = useState('');
  const { error, busy, submit } = useSubmit(onDone);
  const fe = fieldErrorsOf(error);
  const abs = parseRupees(amount);
  const signed = abs === null ? null : kind === 'correction' && increase ? abs : -abs;
  return (
    <form className="stack correction-form" onSubmit={(e) => submit(e, () => api('POST', `/api/invoices/${inv.id}/adjustments`, { amountPaise: signed, kind, reason: reason.trim() }))}>
      <ErrorBanner error={error} />
      <p className="muted small">The charges stay as they are; this adds a signed line with your name and reason.</p>
      <div className="grid2">
        <Field label="Type">
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="discount">Discount</option>
            <option value="write_off">Write-off (will not be collected)</option>
            <option value="correction">Correction</option>
          </select>
        </Field>
        <Field label="Amount (₹)" error={fe.amountPaise ?? (abs !== null && abs < 1 ? 'Above zero' : undefined)}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
      </div>
      {kind === 'correction' && (
        <label className="row">
          <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={increase} onChange={(e) => setIncrease(e.target.checked)} />
          <span>This increases the bill (a charge was missed)</span>
        </label>
      )}
      <Field label="Reason" error={fe.reason}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy || abs === null || abs < 1 || reason.trim().length < 5}>{busy ? 'Saving…' : 'Record adjustment'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function RefundForm({ inv, onDone, onCancel }: { inv: Invoice; onDone: () => Promise<void>; onCancel: () => void }) {
  const [amount, setAmount] = useState(rupeesText(Math.min(inv.netPaidPaise, Math.max(0, -inv.balancePaise)) || inv.netPaidPaise));
  const [method, setMethod] = useState<PayMethod>('cash');
  const [reason, setReason] = useState('');
  const { error, busy, submit } = useSubmit(onDone);
  const fe = fieldErrorsOf(error);
  const paise = parseRupees(amount);
  return (
    <form className="stack correction-form" onSubmit={(e) => submit(e, () => api('POST', `/api/invoices/${inv.id}/refunds`, { amountPaise: paise, method, reason: reason.trim() }))}>
      <ErrorBanner error={error} />
      <p className="muted small">A refund is a separate record; the original payment stays. It also reverses a payment entered by mistake.</p>
      <div className="grid2">
        <Field label="Amount returned (₹)" error={fe.amountPaise ?? (paise !== null && paise > inv.netPaidPaise ? 'More than was paid' : undefined)}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Reason" error={fe.reason}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy || paise === null || paise < 1 || paise > inv.netPaidPaise || reason.trim().length < 5}>{busy ? 'Saving…' : 'Record refund'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function CancelForm({ inv, onDone, onCancel }: { inv: Invoice; onDone: () => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const { error, busy, submit } = useSubmit(onDone);
  return (
    <form className="stack correction-form" onSubmit={(e) => submit(e, () => api('POST', `/api/invoices/${inv.id}/cancel`, { reason: reason.trim() }))}>
      <ErrorBanner error={error} />
      <p className="muted small">The invoice stays on record as cancelled. Use this for an invoice raised in error.</p>
      <Field label="Reason" error={fieldErrorsOf(error).reason}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy || reason.trim().length < 5}>{busy ? 'Saving…' : 'Cancel invoice'}</button>
        <button type="button" className="btn" onClick={onCancel}>Keep invoice</button>
      </div>
    </form>
  );
}
