import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type InvoiceCategory, type PriceItem } from '../api';
import { ErrorBanner, Field, fieldErrorsOf } from '../components/ui';
import { CATEGORY_LABEL, formatMoney, parseRupees, rupeesText } from '../money';

/** Doctor-only: the standard charges that billing staff can add to an invoice in one tap. */
export function PriceListPage() {
  const [items, setItems] = useState<PriceItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = () => api<PriceItem[]>('GET', '/api/price-items?all=1').then(setItems, setError);
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="page narrow">
      <p><Link to="/billing">← Billing</Link></p>
      <h1>Price list</h1>
      <p className="muted">
        Standard charges for quick billing. Changing a price here never changes an invoice that already exists. Items cannot be deleted; switch them off instead.
      </p>
      <ErrorBanner error={error} />
      <AddForm onAdded={load} />
      {items === null && !error && <p className="muted">Loading…</p>}
      {items?.length === 0 && <div className="empty"><p>No items yet. Add the first one above.</p></div>}
      <ul className="list">
        {items?.map((i) => (
          <ItemRow key={i.id} item={i} onChanged={load} />
        ))}
      </ul>
    </div>
  );
}

function AddForm({ onAdded }: { onAdded: () => Promise<unknown> }) {
  const [category, setCategory] = useState<InvoiceCategory>('consultation');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);
  const paise = parseRupees(price);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/price-items', { category, name: name.trim(), pricePaise: paise });
      setName('');
      setPrice('');
      await onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2 style={{ margin: 0 }}>Add an item</h2>
      <ErrorBanner error={error} />
      <div className="grid2">
        <Field label="Category" error={fe.category}>
          <select value={category} onChange={(e) => setCategory(e.target.value as InvoiceCategory)}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Name" error={fe.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={300} required />
        </Field>
        <Field label="Price (₹)" error={fe.pricePaise ?? (price !== '' && paise === null ? 'Like 500 or 500.50' : undefined)}>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
      </div>
      <div><button className="btn primary" disabled={busy || !name.trim() || paise === null}>{busy ? 'Adding…' : 'Add to price list'}</button></div>
    </form>
  );
}

function ItemRow({ item, onChanged }: { item: PriceItem; onChanged: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(rupeesText(item.pricePaise));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const paise = parseRupees(price);
  const on = item.active === 1;

  async function patch(body: object) {
    setBusy(true);
    setError(null);
    try {
      await api('PATCH', `/api/price-items/${item.id}`, body);
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card stack" style={on ? undefined : { opacity: 0.65 }}>
      <ErrorBanner error={error} />
      {editing ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void patch({ name: name.trim(), pricePaise: paise });
          }}
        >
          <div className="grid2">
            <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={300} required /></Field>
            <Field label="Price (₹)" error={price !== '' && paise === null ? 'Like 500 or 500.50' : undefined}>
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </Field>
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy || !name.trim() || paise === null}>Save</button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>{item.name}</strong> <span className="muted small">{CATEGORY_LABEL[item.category]}{on ? '' : ' · switched off'}</span>
            <div>{formatMoney(item.pricePaise)}</div>
          </div>
          <div className="row">
            <button className="btn small" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn small" disabled={busy} onClick={() => void patch({ active: !on })}>{on ? 'Switch off' : 'Switch on'}</button>
          </div>
        </div>
      )}
    </li>
  );
}
