import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, withRules } from '../risk/engine';
import type { InvoiceRow, VendorRow } from '../types';
import { compareRules, evaluate, toReplayCase, type BlocklistEntry, type ReplayCase } from './replay';
import { SCENARIOS } from './scenarios';

const VENDOR: VendorRow = {
  id: 'v-uline', name: 'Uline', normalized_name: 'uline', real_domain: 'uline.com', verified_phone: null, public_email: null,
  bank_account: '004417729035', bank_routing: '110000000', amount_min: 1100, amount_max: 1500,
  intel: null, intel_fetched_at: null, created_at: '2026-11-14T00:00:00Z',
};

const row = (over: Partial<InvoiceRow>): InvoiceRow => ({
  id: 'inv-1', vendor_id: 'v-uline', file_name: null, extracted: null, intel: null, vendor_name: 'Uline',
  invoice_number: 'ULI-1', sender_email: 'billing@uline.com', sender_domain: 'uline.com', amount: 1300, currency: 'USD',
  bank_account: '004417729035', bank_routing: '110000000', due_date: null, invoice_date: null,
  risk_score: 0, risk_reasons: [], explanation: null, status: 'approved',
  created_at: '2026-11-14T20:00:00Z', updated_at: '2026-11-14T20:00:00Z', ...over,
});

describe('toReplayCase', () => {
  it('labels blocked invoices as fraud and approved ones as legit, and skips undecided ones', () => {
    expect(toReplayCase(row({ status: 'blocked' }), VENDOR, [])?.label).toBe('fraud');
    expect(toReplayCase(row({ status: 'approved' }), VENDOR, [])?.label).toBe('legit');
    expect(toReplayCase(row({ status: 'frozen' }), VENDOR, [])).toBeNull();
    expect(toReplayCase(row({ status: 'verifying' }), VENDOR, [])).toBeNull();
  });

  it('rebuilds the invoice from its columns when there is no stored extraction (seeded history)', () => {
    const c = toReplayCase(row({}), VENDOR, [])!;
    expect(c.input.invoice).toMatchObject({
      vendorName: 'Uline', senderDomain: 'uline.com', amount: 1300, bankAccount: '004417729035', urgencyPhrases: [],
    });
    expect(c.input.intel.available).toBe(false);
  });

  it('only sees blocklist entries that existed before the invoice and came from another invoice (no hindsight)', () => {
    const blocklist: BlocklistEntry[] = [
      { kind: 'bank_account', value: '000123456789', reason: 'from itself', source_invoice_id: 'inv-scam', created_at: '2026-11-14T21:00:00Z' },
      { kind: 'domain', value: 'u1ine.com', reason: 'added later', source_invoice_id: 'inv-other', created_at: '2026-11-14T23:00:00Z' },
      { kind: 'domain', value: 'u1ine.com', reason: 'earlier scam', source_invoice_id: 'inv-old', created_at: '2026-11-14T19:00:00Z' },
    ];
    const scam = row({
      id: 'inv-scam', status: 'blocked', sender_domain: 'u1ine.com', bank_account: '000123456789', created_at: '2026-11-14T20:00:00Z',
    });
    const c = toReplayCase(scam, VENDOR, blocklist)!;
    expect(c.input.blocklistHits).toEqual([{ kind: 'domain', value: 'u1ine.com', reason: 'earlier scam' }]);
  });
});

describe('evaluate and compareRules', () => {
  const cases: ReplayCase[] = [
    toReplayCase(row({ id: 'legit-1' }), VENDOR, [])!,
    toReplayCase(row({ id: 'fraud-1', status: 'blocked', sender_domain: 'u1ine.com', sender_email: 'billing@u1ine.com',
      bank_account: '000123456789', amount: 4870 }), VENDOR, [])!,
  ];

  it('counts caught frauds, missed frauds, false freezes and clean approvals', () => {
    const s = evaluate(cases, DEFAULT_RULES);
    expect(s).toMatchObject({ fraudTotal: 1, caught: 1, missed: 0, legitTotal: 1, falseFreezes: 0, cleanApprovals: 1 });
    expect(s.cases.map((c) => [c.id, c.frozen])).toEqual([['legit-1', false], ['fraud-1', true]]);
  });

  it('shows the effect of a rule change side by side', () => {
    const lax = withRules({ freezeThreshold: 101, hardFreeze: { BANK_CHANGED: false } });
    const cmp = compareRules(cases, DEFAULT_RULES, lax);
    expect(cmp.current.caught).toBe(1);
    expect(cmp.proposed.caught).toBe(0);
    expect(cmp.changed.map((c) => c.id)).toEqual(['fraud-1']);
  });
});

describe('built-in attack scenarios', () => {
  it('has both fraud and legit cases, with unique ids', () => {
    expect(SCENARIOS.some((s) => s.label === 'fraud')).toBe(true);
    expect(SCENARIOS.some((s) => s.label === 'legit')).toBe(true);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it('production rules catch every fraud scenario', () => {
    const s = evaluate(SCENARIOS, DEFAULT_RULES);
    expect(s.missed).toBe(0);
    expect(s.caught).toBe(s.fraudTotal);
  });

  it('production rules approve the routine legit scenarios', () => {
    const routine = SCENARIOS.filter((c) => c.id.startsWith('legit-routine'));
    expect(routine.length).toBeGreaterThan(0);
    expect(evaluate(routine, DEFAULT_RULES).falseFreezes).toBe(0);
  });
});
