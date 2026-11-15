import { describe, expect, it } from 'vitest';
import { toExtractedInvoice, type RawExtraction } from './normalize';

const raw: RawExtraction = {
  vendorName: ' Uline ', invoiceNumber: 'ULI-2026-11', senderEmail: 'Billing@U1ine.com',
  amount: 4870, currency: 'usd', bankAccount: '000123456789', bankRouting: '',
  dueDate: '2026-11-16', invoiceDate: '', urgencyPhrases: ['pay today', ' '],
  secrecyPhrases: [], phoneOnInvoice: '',
};

describe('toExtractedInvoice', () => {
  it('trims, lowercases the email, derives the domain and nulls empty strings', () => {
    expect(toExtractedInvoice(raw)).toEqual({
      vendorName: 'Uline', invoiceNumber: 'ULI-2026-11',
      senderEmail: 'billing@u1ine.com', senderDomain: 'u1ine.com',
      amount: 4870, currency: 'USD', bankAccount: '000123456789', bankRouting: null,
      dueDate: '2026-11-16', invoiceDate: null,
      urgencyPhrases: ['pay today'], secrecyPhrases: [], phoneOnInvoice: null,
    });
  });

  it('prefers the sender email typed by the user', () => {
    const out = toExtractedInvoice(raw, 'ap@uline.com');
    expect(out.senderEmail).toBe('ap@uline.com');
    expect(out.senderDomain).toBe('uline.com');
  });

  it('rejects an extraction with no vendor or no amount', () => {
    expect(() => toExtractedInvoice({ ...raw, vendorName: '' })).toThrow('vendor name');
    expect(() => toExtractedInvoice({ ...raw, amount: 0 })).toThrow('amount');
  });

  it('drops dates that are not YYYY-MM-DD', () => {
    expect(toExtractedInvoice({ ...raw, dueDate: 'Nov 16' }).dueDate).toBeNull();
  });

  it('trims AI indicators, drops empty ones and keeps at most three', () => {
    const out = toExtractedInvoice({
      ...raw,
      aiIndicators: [
        { signal: ' Remit-to address differs ', evidence: ' PO Box 99 ' },
        { signal: '', evidence: 'no signal' },
        { signal: 'no evidence', evidence: ' ' },
        { signal: 'b', evidence: '2' }, { signal: 'c', evidence: '3' }, { signal: 'd', evidence: '4' },
      ],
    });
    expect(out.aiIndicators).toEqual([
      { signal: 'Remit-to address differs', evidence: 'PO Box 99' },
      { signal: 'b', evidence: '2' }, { signal: 'c', evidence: '3' },
    ]);
  });

  it('returns no AI indicators when Gemini sends none', () => {
    expect(toExtractedInvoice({ ...raw, aiIndicators: [] }).aiIndicators).toEqual([]);
  });
});
