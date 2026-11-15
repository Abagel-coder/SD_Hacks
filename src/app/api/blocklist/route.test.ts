import { describe, expect, it, vi } from 'vitest';
import type { BlocklistSummary } from '@/lib/blocklist';

const summary: BlocklistSummary = {
  stats: { blockedInvoices: 1, amountStopped: 4870, blocklistEntries: 2 },
  entries: [{
    id: 'b1', kind: 'domain', value: 'u1ine.com', reason: 'Vendor denied this bank change by phone',
    sourceInvoiceId: 'i1', createdAt: '2026-11-14T16:26:00Z', vendorName: 'Uline', amount: 4870,
  }],
};

vi.mock('@/lib/repo', () => ({ getBlocklistSummary: vi.fn(async () => summary) }));

describe('GET /api/blocklist', () => {
  it('returns the blocklist summary as JSON', async () => {
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
  });
});
