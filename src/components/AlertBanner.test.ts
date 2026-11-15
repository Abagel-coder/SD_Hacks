import { describe, expect, it } from 'vitest';
import type { InvoiceRow } from '@/lib/types';
import { recentlyBlocked } from './AlertBanner';

const NOW = Date.parse('2026-11-15T19:00:00Z');
const inv = (id: string, status: string, updatedAt: string) => ({ id, status, updated_at: updatedAt }) as unknown as InvoiceRow;

describe('recentlyBlocked', () => {
  it('alerts only on blocks from the last 24 hours, so sample history stays quiet', () => {
    const list = [
      inv('new', 'blocked', '2026-11-15T18:59:00Z'),
      inv('old', 'blocked', '2026-11-13T17:16:00Z'),
      inv('frozen', 'frozen', '2026-11-15T18:59:00Z'),
    ];
    expect(recentlyBlocked(list, NOW).map((i) => i.id)).toEqual(['new']);
  });
});
