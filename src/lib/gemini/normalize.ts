import { normalizeDomain } from '../risk/domains';
import type { ExtractedInvoice } from '../types';

export interface RawExtraction {
  vendorName: string;
  invoiceNumber: string;
  senderEmail: string;
  amount: number;
  currency: string;
  bankAccount: string;
  bankRouting: string;
  dueDate: string;
  invoiceDate: string;
  urgencyPhrases: string[];
  secrecyPhrases: string[];
  phoneOnInvoice: string;
  aiIndicators?: { signal: string; evidence: string }[];
}

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
};
const isoDate = (v: unknown): string | null => {
  const s = text(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const phrases = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean) : [];

const indicators = (v: unknown): { signal: string; evidence: string }[] =>
  (Array.isArray(v) ? v : [])
    .map((i) => ({ signal: text(i?.signal), evidence: text(i?.evidence) }))
    .filter((i): i is { signal: string; evidence: string } => i.signal !== null && i.evidence !== null)
    .slice(0, 3);

export function toExtractedInvoice(raw: RawExtraction, senderEmailHint?: string): ExtractedInvoice {
  const vendorName = text(raw.vendorName);
  if (!vendorName) throw new Error('Extraction is missing the vendor name');
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Extraction is missing the amount');

  const senderEmail = (text(senderEmailHint) ?? text(raw.senderEmail))?.toLowerCase() ?? null;
  return {
    vendorName,
    invoiceNumber: text(raw.invoiceNumber),
    senderEmail,
    senderDomain: normalizeDomain(senderEmail),
    amount,
    currency: (text(raw.currency) ?? 'USD').toUpperCase(),
    bankAccount: text(raw.bankAccount),
    bankRouting: text(raw.bankRouting),
    dueDate: isoDate(raw.dueDate),
    invoiceDate: isoDate(raw.invoiceDate),
    urgencyPhrases: phrases(raw.urgencyPhrases),
    secrecyPhrases: phrases(raw.secrecyPhrases),
    phoneOnInvoice: text(raw.phoneOnInvoice),
    ...(raw.aiIndicators === undefined ? {} : { aiIndicators: indicators(raw.aiIndicators) }),
  };
}
