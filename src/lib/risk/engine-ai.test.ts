import { describe, expect, it } from 'vitest';
import type { ExtractedInvoice, VendorIntel } from '../types';
import { scoreInvoice } from './engine';

const INVOICE: ExtractedInvoice = {
  vendorName: 'Blue Bottle Supply', invoiceNumber: 'BB-1', senderEmail: 'ap@bbsupply.com', senderDomain: 'bbsupply.com',
  amount: 500, currency: 'USD', bankAccount: '111', bankRouting: '222', dueDate: null, invoiceDate: null,
  urgencyPhrases: [], secrecyPhrases: [], phoneOnInvoice: null,
};
const INTEL: VendorIntel = {
  available: false, senderDomain: 'bbsupply.com', realDomain: null, officialPhone: null, publicEmail: null,
  senderDomainMatches: null, senderDomainAgeDays: null, sources: [],
};
const score = (invoice: ExtractedInvoice) => scoreInvoice({ invoice, vendor: null, intel: INTEL, blocklistHits: [] });

describe('AI_FLAGGED (Gemini fraud indicators)', () => {
  it('adds nothing when Gemini reports no indicators, or the field is absent', () => {
    expect(score({ ...INVOICE, aiIndicators: [] }).reasons.map((r) => r.code)).not.toContain('AI_FLAGGED');
    expect(score(INVOICE).reasons.map((r) => r.code)).not.toContain('AI_FLAGGED');
  });

  it('adds a flat 15 points however many indicators there are, quoting the first one', () => {
    const one = score({ ...INVOICE, aiIndicators: [{ signal: 'Remit-to address differs from letterhead', evidence: 'PO Box 99, Lagos' }] });
    const three = score({
      ...INVOICE,
      aiIndicators: [
        { signal: 'Remit-to address differs from letterhead', evidence: 'PO Box 99, Lagos' },
        { signal: 'Line items do not add up to the total', evidence: 'Total $500.00' },
        { signal: 'Unusual payment method', evidence: 'wire only' },
      ],
    });
    const base = score(INVOICE).score;
    expect(one.score - base).toBe(15);
    expect(three.score - base).toBe(15);
    const reason = three.reasons.find((r) => r.code === 'AI_FLAGGED');
    expect(reason?.points).toBe(15);
    expect(reason?.detail).toContain('Remit-to address differs from letterhead');
    expect(reason?.detail).toContain('PO Box 99, Lagos');
    expect(reason?.detail).toContain('2 more');
  });

  it('does not double the full stop when the quoted evidence ends with one', () => {
    const r = score({ ...INVOICE, aiIndicators: [{ signal: 'Unusual payment method', evidence: 'Gift cards only.' }] });
    expect(r.reasons.find((x) => x.code === 'AI_FLAGGED')?.detail)
      .toBe('Gemini flagged: Unusual payment method: "Gift cards only".');
  });

  it('can never lower a score, and does not freeze an invoice on its own', () => {
    const flagged = score({ ...INVOICE, aiIndicators: [{ signal: 'x', evidence: 'y' }] });
    expect(flagged.score).toBeGreaterThanOrEqual(score(INVOICE).score);
    expect(flagged.score).toBeLessThan(50);
    expect(flagged.freeze).toBe(false);
  });

  it('respects the 100 cap', () => {
    const maxed = scoreInvoice({
      invoice: { ...INVOICE, aiIndicators: [{ signal: 'x', evidence: 'y' }] },
      vendor: null, intel: INTEL,
      blocklistHits: [{ kind: 'bank_account', value: '111', reason: 'scam' }],
    });
    expect(maxed.score).toBe(100);
  });
});
