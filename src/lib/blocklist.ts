import { normalizeDomain } from './risk/domains';
import type { BlocklistKind } from './types';

/** One blocklisted bank account, domain or phone, with the invoice that got it blocked. */
export interface BlocklistEntry {
  id: string;
  kind: BlocklistKind;
  value: string;
  reason: string | null;
  sourceInvoiceId: string | null;
  createdAt: string;
  vendorName: string | null;
  amount: number | null;
}

export interface BlocklistStats {
  /** Invoices with status 'blocked'. */
  blockedInvoices: number;
  /** Sum of the amounts of blocked invoices (all demo invoices are USD). */
  amountStopped: number;
  /** Rows in the blocklist table. */
  blocklistEntries: number;
}

/** GET /api/blocklist response. */
export interface BlocklistSummary {
  stats: BlocklistStats;
  entries: BlocklistEntry[];
}

export interface BlocklistStatsRow {
  blocked_count: unknown;
  blocked_total: unknown;
  entry_count: unknown;
}

export interface BlocklistEntryRow {
  id: string;
  kind: BlocklistKind;
  value: string;
  reason: string | null;
  source_invoice_id: string | null;
  created_at: string;
  vendor_name: string | null;
  amount: unknown;
}

/** Postgres counts and sums can arrive as strings through Neon; null means zero. */
function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function toBlocklistSummary(stats: BlocklistStatsRow, rows: BlocklistEntryRow[]): BlocklistSummary {
  return {
    stats: {
      blockedInvoices: num(stats.blocked_count),
      amountStopped: num(stats.blocked_total),
      blocklistEntries: num(stats.entry_count),
    },
    entries: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      value: r.value,
      reason: r.reason,
      sourceInvoiceId: r.source_invoice_id,
      createdAt: r.created_at,
      vendorName: r.vendor_name,
      amount: r.amount === null || r.amount === undefined ? null : num(r.amount),
    })),
  };
}

/** Bank accounts show only their last four digits; domains and phones show in full. */
export function displayBlockedValue(kind: BlocklistKind, value: string): string {
  return kind === 'bank_account' ? `•••• ${value.slice(-4)}` : value;
}

/**
 * What a blocked invoice put on the blocklist, in the same terms as applyDecision: the bank account
 * if the invoice had one, and the sender domain unless it is the vendor's real domain.
 * Null when nothing was added, so the page never claims an "account ending unknown".
 */
export function blockedItemsText(
  bankAccount: string | null | undefined,
  senderDomain: string | null | undefined,
  realDomain: string | null | undefined,
): string | null {
  const digits = (bankAccount ?? '').replace(/\D/g, '');
  const sender = normalizeDomain(senderDomain);
  const items = [
    digits ? `the account ending ${digits.slice(-4)}` : null,
    sender && sender !== normalizeDomain(realDomain) ? `the sender domain ${sender}` : null,
  ].filter((item): item is string => item !== null);
  if (items.length === 0) return null;
  return `${items.join(' and ')} ${items.length > 1 ? 'are' : 'is'} now on the shared blocklist`;
}
