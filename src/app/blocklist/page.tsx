'use client';

import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { usePoll } from '@/hooks/usePoll';
import { displayBlockedValue, type BlocklistSummary } from '@/lib/blocklist';
import { money } from '@/lib/format';
import type { BlocklistKind } from '@/lib/types';

/** '2026-11-14T16:26:00Z' -> 'Nov 14, 4:26 PM' in the viewer's timezone. */
function addedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const KIND_LABEL: Record<BlocklistKind, string> = {
  bank_account: 'Bank account',
  domain: 'Sender domain',
  phone: 'Phone',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

export default function BlocklistPage() {
  const { data, error } = usePoll<BlocklistSummary>('/api/blocklist', 3000);
  const stats = data?.stats;
  const entries = data?.entries ?? [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-gray-900">
      <AppNav current="blocklist" />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Blocklist</h1>
        <p className="text-sm text-gray-600">
          Bank accounts and domains from invoices the vendor denied. Any new invoice that uses one of
          them is frozen automatically.
        </p>
      </header>

      {error && !data && <p className="text-sm text-red-700">Could not load the blocklist: {error}</p>}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Totals">
        <Stat label="Scam attempts blocked" value={stats ? String(stats.blockedInvoices) : '…'} />
        <Stat label="$ stopped" value={stats ? money(stats.amountStopped) : '…'} />
        <Stat label="Blocklist entries" value={stats ? String(stats.blocklistEntries) : '…'} />
      </section>

      {data && entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          Nothing blocked yet. When a vendor denies a bank change on a verification call, the account and sender
          domain land here.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2">Type</th>
              <th>Value</th>
              <th>From invoice</th>
              <th className="text-right">Amount</th>
              <th className="pl-4">Reason</th>
              <th className="text-right">Added</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b align-middle *:py-2">
                <td className="text-gray-700">{KIND_LABEL[entry.kind]}</td>
                <td className="font-mono">{displayBlockedValue(entry.kind, entry.value)}</td>
                <td>
                  {entry.sourceInvoiceId ? (
                    <Link href={`/invoices/${entry.sourceInvoiceId}`} className="underline-offset-2 hover:underline">
                      {entry.vendorName ?? 'View invoice'}
                    </Link>
                  ) : (
                    'n/a'
                  )}
                </td>
                <td className="text-right tabular-nums">{entry.amount === null ? 'n/a' : money(entry.amount)}</td>
                <td className="pl-4 text-gray-700">{entry.reason ?? 'n/a'}</td>
                <td className="whitespace-nowrap text-right text-gray-600">{addedAt(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
