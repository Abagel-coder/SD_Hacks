import { describe, expect, it } from 'vitest';
import type { ExtractedInvoice, VendorIntel, VendorRow } from '../types';
import { scoreInvoice } from './engine';

const uline: VendorRow = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Uline', normalized_name: 'uline', real_domain: 'uline.com',
  verified_phone: '+15555550100', public_email: null,
  bank_account: '004417729035', bank_routing: '110000000',
  amount_min: 1100, amount_max: 1500,
  intel: null, intel_fetched_at: null, created_at: '2026-01-01T00:00:00Z',
};

const legit: ExtractedInvoice = {
  vendorName: 'Uline', invoiceNumber: 'ULI-2026-11',
  senderEmail: 'billing@uline.com', senderDomain: 'uline.com',
  amount: 1318.4, currency: 'USD',
  bankAccount: '0044-1772-9035', bankRouting: '110000000',
  dueDate: '2026-12-14', invoiceDate: '2026-11-14',
  urgencyPhrases: [], secrecyPhrases: [], phoneOnInvoice: null,
};

const cleanIntel: VendorIntel = {
  available: true, senderDomain: 'uline.com', realDomain: 'uline.com',
  officialPhone: '+15555550100', publicEmail: null,
  senderDomainMatches: true, senderDomainAgeDays: 9000, sources: [],
};

const score = (over: Partial<Parameters<typeof scoreInvoice>[0]> = {}) =>
  scoreInvoice({ invoice: legit, vendor: uline, intel: cleanIntel, blocklistHits: [], ...over });
const codes = (r: ReturnType<typeof scoreInvoice>) => r.reasons.map((x) => x.code);

describe('scoreInvoice', () => {
  it('scores a normal invoice from a known vendor as zero', () => {
    expect(score()).toEqual({ score: 0, reasons: [], freeze: false });
  });

  it('ignores formatting differences in the bank account', () => {
    expect(codes(score({ invoice: { ...legit, bankAccount: '004417729035' } }))).toEqual([]);
  });

  it('freezes on a bank change even when nothing else is wrong', () => {
    const r = score({ invoice: { ...legit, bankAccount: '000123456789' } });
    expect(codes(r)).toEqual(['BANK_CHANGED']);
    expect(r.score).toBe(40);
    expect(r.freeze).toBe(true);
  });

  it('flags a lookalike sender domain, not a plain mismatch', () => {
    const r = score({ invoice: { ...legit, senderEmail: 'billing@u1ine.com', senderDomain: 'u1ine.com' } });
    expect(codes(r)).toEqual(['LOOKALIKE_DOMAIN']);
    expect(r.score).toBe(30);
    expect(r.freeze).toBe(false);
  });

  it('flags an unrelated sender domain as a mismatch', () => {
    const r = score({ invoice: { ...legit, senderEmail: 'uline.billing@gmail.com', senderDomain: 'gmail.com' } });
    expect(codes(r)).toEqual(['DOMAIN_MISMATCH']);
    expect(r.score).toBe(20);
  });

  it('flags a sender domain registered under 90 days ago', () => {
    expect(codes(score({ intel: { ...cleanIntel, senderDomainAgeDays: 12 } }))).toEqual(['NEW_DOMAIN']);
    expect(codes(score({ intel: { ...cleanIntel, senderDomainAgeDays: 90 } }))).toEqual([]);
    expect(codes(score({ intel: { ...cleanIntel, senderDomainAgeDays: null } }))).toEqual([]);
  });

  it('flags an amount over 1.5 times the normal maximum', () => {
    expect(codes(score({ invoice: { ...legit, amount: 2250 } }))).toEqual([]);
    expect(codes(score({ invoice: { ...legit, amount: 2250.01 } }))).toEqual(['AMOUNT_ANOMALY']);
  });

  it('flags urgency or secrecy language once', () => {
    const r = score({ invoice: { ...legit, urgencyPhrases: ['pay today'], secrecyPhrases: ['do not call'] } });
    expect(codes(r)).toEqual(['URGENCY_OR_SECRECY']);
    expect(r.score).toBe(15);
  });

  it('adds points for an unknown vendor and uses the Bright Data domain', () => {
    const r = score({
      vendor: null,
      invoice: { ...legit, senderDomain: 'uline-billing.com', senderEmail: 'ap@uline-billing.com' },
    });
    expect(codes(r)).toEqual(['UNKNOWN_VENDOR', 'LOOKALIKE_DOMAIN']);
    expect(r.score).toBe(40);
    expect(r.freeze).toBe(false);
  });

  it('adds no domain points when Bright Data was unavailable for an unknown vendor', () => {
    const r = score({
      vendor: null,
      intel: { ...cleanIntel, available: false, realDomain: null, senderDomainAgeDays: null },
    });
    expect(codes(r)).toEqual(['UNKNOWN_VENDOR']);
  });

  it('caps the score at 100 and freezes at 50 or more', () => {
    const r = score({
      invoice: {
        ...legit, senderDomain: 'u1ine.com', senderEmail: 'billing@u1ine.com',
        bankAccount: '000123456789', amount: 4870, urgencyPhrases: ['pay today'],
      },
      intel: { ...cleanIntel, senderDomainAgeDays: 12 },
    });
    expect(codes(r)).toEqual(['BANK_CHANGED', 'LOOKALIKE_DOMAIN', 'NEW_DOMAIN', 'AMOUNT_ANOMALY', 'URGENCY_OR_SECRECY']);
    expect(r.score).toBe(100);
    expect(r.freeze).toBe(true);
  });

  it('sets the score to 100 on a blocklist hit', () => {
    const r = score({ blocklistHits: [{ kind: 'bank_account', value: '004417729035', reason: 'denied by phone' }] });
    expect(codes(r)).toEqual(['BLOCKLIST_HIT']);
    expect(r.score).toBe(100);
    expect(r.freeze).toBe(true);
  });
});
