import type { NavigateFunction } from 'react-router-dom';
import { api, type Invoice } from './api';

/** Integer paise to a display string such as "₹1,250.50". */
export function formatMoney(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = String(abs % 100).padStart(2, '0');
  return `${sign}₹${rupees.toLocaleString('en-IN')}.${p}`;
}

/** Rupees typed by a person ("1250", "1250.5") to integer paise; null if not a valid amount. No floating point. */
export function parseRupees(input: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

export const rupeesText = (paise: number) => `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;

export const CATEGORY_LABEL = { consultation: 'Consultation', investigation: 'Investigation', procedure: 'Procedure', room_bed: 'Room / bed', other: 'Other' } as const;
export const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', cheque: 'Cheque', other: 'Other' } as const;
export const PAYMENT_STATE_LABEL = { draft: 'Draft', cancelled: 'Cancelled', unpaid: 'Unpaid', part_paid: 'Part paid', paid: 'Paid', credit: 'Credit due back' } as const;

/** Creates a draft invoice and opens it. */
export async function startInvoice(nav: NavigateFunction, body: { patientId: number; admissionId?: number; visitId?: number }): Promise<void> {
  const inv = await api<Invoice>('POST', '/api/invoices', body);
  nav(`/invoices/${inv.id}`);
}
