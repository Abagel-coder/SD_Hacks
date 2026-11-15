'use client';

import { useRouter } from 'next/navigation';
import { AlertBanner } from '@/components/AlertBanner';
import { AppNav } from '@/components/AppNav';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadCard } from '@/components/UploadCard';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

function riskTone(score: number | null): string {
  if (score === null) return 'text-white/40';
  if (score >= 50) return 'font-semibold text-red-400';
  if (score >= 20) return 'font-semibold text-amber-300';
  return 'text-white/45';
}

export default function Dashboard() {
  const router = useRouter();
  const { data, error, refresh } = usePoll<{ invoices: InvoiceRow[] }>('/api/invoices');
  const invoices = data?.invoices ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 px-6 pb-16 text-white">
      <AppNav current="invoices" />

      <Reveal className="space-y-5 pt-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ig-green)]">
            Finance agent for small businesses
          </p>
          <h1 className="ig-display mt-3 max-w-3xl text-[clamp(2.75rem,9vw,5.5rem)] text-white">
            Stop the invoice
            <span className="ig-green"> before</span> it pays the scammer.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            Every invoice is checked against vendor history and the public web — then verified live when risk spikes.
          </p>
        </header>
      </Reveal>

      <div className="ig-marquee -mx-6 py-2" aria-hidden>
        <div className="ig-marquee-track">
          <span>Gemini reads · Bright Data fact-checks · Neon remembers · ElevenLabs verifies ·</span>
          <span>Gemini reads · Bright Data fact-checks · Neon remembers · ElevenLabs verifies ·</span>
        </div>
      </div>

      <Reveal>
        <AlertBanner invoices={invoices} />
      </Reveal>

      <Reveal>
        <UploadCard onUploaded={refresh} />
      </Reveal>

      {error && !data && <p className="text-sm text-red-400">Could not load invoices: {error}</p>}

      <Reveal className="space-y-4">
        <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="ig-display text-2xl sm:text-3xl">Invoices</h2>
          <p className="text-xs uppercase tracking-widest text-white/40">{invoices.length} on file</p>
        </div>

        {data && invoices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
            No invoices yet. Upload one to check it.
          </p>
        ) : (
          <div className="ig-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                  <tr className="*:whitespace-nowrap *:px-4 *:py-3">
                    <th>Vendor</th>
                    <th className="hidden sm:table-cell">Invoice</th>
                    <th className="hidden sm:table-cell">Date</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Risk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      role="link"
                      tabIndex={0}
                      className="ig-row cursor-pointer border-b border-white/10 *:whitespace-nowrap *:px-4 *:py-3.5"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/invoices/${invoice.id}`);
                        }
                      }}
                    >
                      <td className="font-medium text-white">
                        <span className="ig-underline">{invoice.vendor_name}</span>
                      </td>
                      <td className="hidden text-white/55 sm:table-cell">{invoice.invoice_number ?? 'n/a'}</td>
                      <td className="hidden text-white/55 sm:table-cell">{invoice.invoice_date ?? 'n/a'}</td>
                      <td className="text-right tabular-nums text-white/80">
                        {money(invoice.amount, invoice.currency)}
                      </td>
                      <td className={`text-right tabular-nums ${riskTone(invoice.risk_score)}`}>
                        {invoice.risk_score ?? 'n/a'}
                      </td>
                      <td><StatusBadge status={invoice.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </section>
      </Reveal>
    </main>
  );
}
