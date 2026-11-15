import { describe, expect, it } from 'vitest';
import { displayBlockedValue, toBlocklistSummary } from './blocklist';

describe('toBlocklistSummary', () => {
  it('coerces Postgres numeric strings into numbers', () => {
    const s = toBlocklistSummary(
      { blocked_count: '2', blocked_total: '9740.5', entry_count: '3' },
      [],
    );
    expect(s.stats).toEqual({ blockedInvoices: 2, amountStopped: 9740.5, blocklistEntries: 3 });
  });

  it('treats missing or null stats as zero', () => {
    const s = toBlocklistSummary({ blocked_count: null, blocked_total: null, entry_count: undefined }, []);
    expect(s.stats).toEqual({ blockedInvoices: 0, amountStopped: 0, blocklistEntries: 0 });
  });

  it('maps entry rows and coerces the source invoice amount', () => {
    const s = toBlocklistSummary({ blocked_count: 1, blocked_total: 4870, entry_count: 1 }, [{
      id: 'b1', kind: 'domain', value: 'u1ine.com', reason: 'Vendor denied this bank change by phone',
      source_invoice_id: 'i1', created_at: '2026-11-14T16:26:00Z', vendor_name: 'Uline', amount: '4870',
    }]);
    expect(s.entries).toEqual([{
      id: 'b1', kind: 'domain', value: 'u1ine.com', reason: 'Vendor denied this bank change by phone',
      sourceInvoiceId: 'i1', createdAt: '2026-11-14T16:26:00Z', vendorName: 'Uline', amount: 4870,
    }]);
  });

  it('keeps a missing source invoice as nulls', () => {
    const s = toBlocklistSummary({ blocked_count: 0, blocked_total: 0, entry_count: 1 }, [{
      id: 'b2', kind: 'phone', value: '+15555550199', reason: null,
      source_invoice_id: null, created_at: '2026-11-14T16:30:00Z', vendor_name: null, amount: null,
    }]);
    expect(s.entries[0]).toMatchObject({ sourceInvoiceId: null, vendorName: null, amount: null, reason: null });
  });
});

describe('displayBlockedValue', () => {
  it('masks bank accounts to the last four digits', () => {
    expect(displayBlockedValue('bank_account', '000123456789')).toBe('•••• 6789');
  });

  it('shows short bank accounts masked without exposing them', () => {
    expect(displayBlockedValue('bank_account', '123')).toBe('•••• 123');
  });

  it('shows domains and phones as-is', () => {
    expect(displayBlockedValue('domain', 'u1ine.com')).toBe('u1ine.com');
    expect(displayBlockedValue('phone', '+15555550199')).toBe('+15555550199');
  });
});
