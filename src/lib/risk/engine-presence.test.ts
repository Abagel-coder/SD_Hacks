import { describe, expect, it } from 'vitest';
import type { ExtractedInvoice, VendorIntel } from '../types';
import { scoreInvoice } from './engine';

const INVOICE: ExtractedInvoice = {
  vendorName: 'Uline', invoiceNumber: 'U-1', senderEmail: 'billing@u1ine.com', senderDomain: 'u1ine.com',
  amount: 500, currency: 'USD', bankAccount: null, bankRouting: null, dueDate: null, invoiceDate: null,
  urgencyPhrases: [], secrecyPhrases: [], phoneOnInvoice: null,
};
const intel = (over: Partial<VendorIntel>): VendorIntel => ({
  available: true, senderDomain: 'u1ine.com', realDomain: 'uline.com', officialPhone: null, publicEmail: null,
  senderDomainMatches: false, senderDomainAgeDays: null, sources: [], ...over,
});
const codes = (invoice: ExtractedInvoice, i: VendorIntel) =>
  scoreInvoice({ invoice, vendor: null, intel: i, blocklistHits: [] });

describe('NO_WEB_PRESENCE', () => {
  it('adds 15 when a non-vendor sender domain is mentioned in none of the search results', () => {
    const withSignal = codes(INVOICE, intel({ senderWebPresence: { results: 9, mentions: 0 } }));
    const without = codes(INVOICE, intel({}));
    const reason = withSignal.reasons.find((r) => r.code === 'NO_WEB_PRESENCE');
    expect(reason?.points).toBe(15);
    expect(reason?.detail).toBe('Sender domain u1ine.com has no public web presence: 0 of 9 search results mention it.');
    expect(withSignal.score - without.score).toBe(15);
  });

  it('stays silent when the domain is mentioned anywhere', () => {
    const r = codes(INVOICE, intel({ senderWebPresence: { results: 9, mentions: 1 } }));
    expect(r.reasons.map((x) => x.code)).not.toContain('NO_WEB_PRESENCE');
  });

  it('never fires for the vendor\'s own domain', () => {
    const legit = { ...INVOICE, senderEmail: 'billing@uline.com', senderDomain: 'uline.com' };
    const r = codes(legit, intel({ senderDomain: 'uline.com', senderDomainMatches: true, senderWebPresence: { results: 5, mentions: 0 } }));
    expect(r.reasons.map((x) => x.code)).not.toContain('NO_WEB_PRESENCE');
  });

  it('treats an unknown result (failed search) as no signal', () => {
    const r = codes(INVOICE, intel({ senderWebPresence: null }));
    expect(r.reasons.map((x) => x.code)).not.toContain('NO_WEB_PRESENCE');
  });

  it('does not freeze on its own', () => {
    const r = scoreInvoice({
      invoice: { ...INVOICE, vendorName: 'Blue Bottle Supply', senderEmail: 'ap@bbsupply-pay.com', senderDomain: 'bbsupply-pay.com' },
      vendor: null,
      intel: intel({ realDomain: null, senderDomain: 'bbsupply-pay.com', senderDomainMatches: null, senderWebPresence: { results: 7, mentions: 0 } }),
      blocklistHits: [],
    });
    expect(r.reasons.map((x) => x.code)).toContain('NO_WEB_PRESENCE');
    expect(r.freeze).toBe(false);
  });
});
