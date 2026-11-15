import { describe, expect, it } from 'vitest';
import type { ExtractedInvoice, VendorIntel, VendorRow } from '../types';
import { DEFAULT_RULES, scoreInvoice, withRules } from './engine';

const VENDOR: VendorRow = {
  id: 'v1', name: 'Uline', normalized_name: 'uline', real_domain: 'uline.com', verified_phone: null, public_email: null,
  bank_account: '004417729035', bank_routing: '110000000', amount_min: 1100, amount_max: 1500,
  intel: null, intel_fetched_at: null, created_at: '2026-11-14T00:00:00Z',
};
const INTEL: VendorIntel = {
  available: true, senderDomain: 'u1ine.com', realDomain: 'uline.com', officialPhone: null, publicEmail: null,
  senderDomainMatches: false, senderDomainAgeDays: 40, sources: [],
};
const INVOICE: ExtractedInvoice = {
  vendorName: 'Uline', invoiceNumber: 'X', senderEmail: 'billing@u1ine.com', senderDomain: 'u1ine.com',
  amount: 2000, currency: 'USD', bankAccount: '004417729035', bankRouting: '110000000', dueDate: null, invoiceDate: null,
  urgencyPhrases: [], secrecyPhrases: [], phoneOnInvoice: null,
};
const run = (rules = DEFAULT_RULES, invoice = INVOICE) =>
  scoreInvoice({ invoice, vendor: VENDOR, intel: INTEL, blocklistHits: [] }, rules);

describe('scoreInvoice rules', () => {
  it('uses today\'s numbers by default', () => {
    const r = scoreInvoice({ invoice: INVOICE, vendor: VENDOR, intel: INTEL, blocklistHits: [] });
    // lookalike 30 + new domain 20 + amount (2000 > 1500 x 1.5 is false) 0 = 50
    expect(r.reasons.map((x) => [x.code, x.points])).toEqual([['LOOKALIKE_DOMAIN', 30], ['NEW_DOMAIN', 20]]);
    expect(r.score).toBe(50);
    expect(r.freeze).toBe(true);
    expect(DEFAULT_RULES.freezeThreshold).toBe(50);
  });

  it('can raise the freeze threshold', () => {
    const r = run(withRules({ freezeThreshold: 60 }));
    expect(r.score).toBe(50);
    expect(r.freeze).toBe(false);
  });

  it('turns a rule off entirely when its points are 0', () => {
    const r = run(withRules({ points: { NEW_DOMAIN: 0 } }));
    expect(r.reasons.map((x) => x.code)).toEqual(['LOOKALIKE_DOMAIN']);
    expect(r.score).toBe(30);
  });

  it('changes points per rule', () => {
    expect(run(withRules({ points: { LOOKALIKE_DOMAIN: 45 } })).score).toBe(65);
  });

  it('tightens the amount anomaly multiplier', () => {
    const r = run(withRules({ amountMultiplier: 1.2 }));
    expect(r.reasons.map((x) => x.code)).toContain('AMOUNT_ANOMALY');
  });

  it('changes the new-domain age limit', () => {
    expect(run(withRules({ newDomainDays: 30 })).reasons.map((x) => x.code)).not.toContain('NEW_DOMAIN');
  });

  it('can stop a rule from forcing a freeze on its own', () => {
    const changed = { ...INVOICE, senderEmail: 'billing@uline.com', senderDomain: 'uline.com', bankAccount: '999999999999', amount: 1200 };
    const intel = { ...INTEL, senderDomain: 'uline.com', senderDomainMatches: true, senderDomainAgeDays: 11305 };
    const strict = scoreInvoice({ invoice: changed, vendor: VENDOR, intel, blocklistHits: [] });
    const relaxed = scoreInvoice({ invoice: changed, vendor: VENDOR, intel, blocklistHits: [] },
      withRules({ hardFreeze: { BANK_CHANGED: false } }));
    expect(strict.freeze).toBe(true);
    expect(relaxed.score).toBe(40);
    expect(relaxed.freeze).toBe(false);
  });

  it('withRules never mutates the defaults', () => {
    withRules({ freezeThreshold: 90, points: { NEW_DOMAIN: 0 } });
    expect(DEFAULT_RULES.freezeThreshold).toBe(50);
    expect(DEFAULT_RULES.points.NEW_DOMAIN).toBe(20);
  });
});
