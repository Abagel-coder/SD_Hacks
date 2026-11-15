import { describe, expect, it, vi } from 'vitest';
import { loadHistoryCases, parseRulesOverride } from './run';

describe('parseRulesOverride', () => {
  it('keeps valid values and clamps out-of-range numbers', () => {
    const r = parseRulesOverride({
      freezeThreshold: 250, amountMultiplier: 0.2, newDomainDays: 30,
      points: { NEW_DOMAIN: 0, LOOKALIKE_DOMAIN: 45, BANK_CHANGED: -5 },
      hardFreeze: { BANK_CHANGED: false },
    });
    expect(r).toEqual({
      freezeThreshold: 100, amountMultiplier: 1, newDomainDays: 30,
      points: { NEW_DOMAIN: 0, LOOKALIKE_DOMAIN: 45, BANK_CHANGED: 0 },
      hardFreeze: { BANK_CHANGED: false },
    });
  });

  it('ignores unknown rule codes and non-numeric junk', () => {
    const r = parseRulesOverride({ points: { DROP_TABLE: 5, NEW_DOMAIN: 'lots' }, hardFreeze: { NEW_DOMAIN: 'yes' }, freezeThreshold: 'x' });
    expect(r).toEqual({ points: {}, hardFreeze: {} });
  });

  it('treats a missing body as no changes', () => {
    expect(parseRulesOverride(undefined)).toEqual({ points: {}, hardFreeze: {} });
  });
});

describe('loadHistoryCases', () => {
  const vendor = {
    id: 'v1', name: 'Uline', normalized_name: 'uline', real_domain: 'uline.com', verified_phone: null, public_email: null,
    bank_account: '004417729035', bank_routing: '110000000', amount_min: 1100, amount_max: 1500, intel: null,
    intel_fetched_at: null, created_at: new Date('2026-11-14T00:00:00Z'),
  };
  const invoice = (id: string, status: string, created: string) => ({
    id, vendor_id: 'v1', file_name: null, extracted: null, intel: null, vendor_name: 'Uline', invoice_number: id,
    sender_email: 'billing@uline.com', sender_domain: 'uline.com', amount: 1300, currency: 'USD',
    bank_account: '004417729035', bank_routing: '110000000', due_date: null, invoice_date: null,
    risk_score: 0, risk_reasons: [], explanation: null, status, created_at: new Date(created), updated_at: new Date(created),
  });

  it('reads the branch, joins each invoice to its vendor as of the branch, and keeps only decided invoices', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('from invoices')) return [invoice('a', 'approved', '2026-11-14T10:00:00Z'), invoice('b', 'frozen', '2026-11-14T11:00:00Z')];
      if (text.includes('from vendors')) return [vendor];
      if (text.includes('from blocklist')) return [];
      return [];
    });
    const cases = await loadHistoryCases(query);
    expect(cases.map((c) => [c.id, c.label, c.source])).toEqual([['a', 'legit', 'history']]);
    expect(cases[0].input.vendor?.name).toBe('Uline');
  });

  it('retries while the new branch compute is still starting', async () => {
    let attempts = 0;
    const query = vi.fn(async (text: string) => {
      if (text.includes('from invoices') && attempts++ < 2) throw new Error('endpoint is starting');
      return text.includes('from vendors') ? [vendor] : [];
    });
    await expect(loadHistoryCases(query, { retryDelayMs: 0 })).resolves.toEqual([]);
    expect(attempts).toBe(3);
  });
});
