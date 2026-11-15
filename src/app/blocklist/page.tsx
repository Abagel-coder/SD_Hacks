'use client';

import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { Reveal } from '@/components/Reveal';
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
    <div className="ig-panel rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="ig-display mt-2 text-3xl tabular-nums text-white">{value}</p>
    </div>
  );
}

export default function BlocklistPage() {
  const { data, error } = usePoll<BlocklistSummary>('/api/blocklist', 3000);
  const stats = data?.stats;
  const entries = data?.entries ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 pb-16 text-white">
      <AppNav current="blocklist" />

      <Reveal>
        <header className="space-y-2">
          <h1 className="ig-display text-[clamp(2rem,6vw,3.25rem)]">Blocklist</h1>
          <p className="max-w-xl text-sm text-white/55">
            Bank accounts and domains from invoices the vendor denied. Any new invoice that uses one of
            them is frozen automatically.
          </p>
        </header>
      </Reveal>

      {error && !data && <p className="text-sm text-red-400">Could not load the blocklist: {error}</p>}

      <Reveal>
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Totals">
          <Stat label="Scam attempts blocked" value={stats ? String(stats.blockedInvoices) : '…'} />
          <Stat label="$ stopped" value={stats ? money(stats.amountStopped) : '…'} />
          <Stat label="Blocklist entries" value={stats ? String(stats.blocklistEntries) : '…'} />
        </section>
      </Reveal>

      <Reveal>
        {data && entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
            Nothing blocked yet. When a vendor denies a bank change on a verification call, the account and sender
            domain land here.
          </p>
        ) : (
          <div className="ig-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                  <tr className="*:whitespace-nowrap *:px-4 *:py-3">
                    <th>Type</th>
                    <th>Value</th>
                    <th>From invoice</th>
                    <th className="text-right">Amount</th>
                    <th className="hidden sm:table-cell">Reason</th>
                    <th className="text-right">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="ig-row border-b border-white/10 align-middle *:px-4 *:py-3.5">
                      <td className="whitespace-nowrap text-white/70">{KIND_LABEL[entry.kind]}</td>
                      <td className="whitespace-nowrap font-mono text-white/90">{displayBlockedValue(entry.kind, entry.value)}</td>
                      <td className="whitespace-nowrap">
                        {entry.sourceInvoiceId ? (
                          <Link href={`/invoices/${entry.sourceInvoiceId}`} className="ig-underline text-[var(--ig-green)]">
                            {entry.vendorName ?? 'View invoice'}
                          </Link>
                        ) : (
                          <span className="text-white/40">n/a</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums text-white/80">{entry.amount === null ? 'n/a' : money(entry.amount)}</td>
                      <td className="hidden text-white/55 sm:table-cell">{entry.reason ?? 'n/a'}</td>
                      <td className="whitespace-nowrap text-right text-white/45">{addedAt(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Reveal>
    </main>
  );
}
