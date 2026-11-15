'use client';

import { useRouter } from 'next/navigation';
import { AlertBanner } from '@/components/AlertBanner';
import { AppNav } from '@/components/AppNav';
import { CountUp } from '@/components/CountUp';
import { Spotlight } from '@/components/Spotlight';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadCard } from '@/components/UploadCard';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

/** Red at 50+, amber 20 to 49, gray below 20. */
function riskTone(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500';
  if (score >= 50) return 'bg-red-100 text-red-800';
  if (score >= 20) return 'bg-amber-100 text-amber-900';
  return 'bg-gray-100 text-gray-700';
}

function Stat({ label, value, tone, index }: { label: string; value: number; tone: string; index: number }) {
  return (
    <Spotlight className="card card-hover animate-fade-up p-5" style={{ animationDelay: `${150 + index * 70}ms` }}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${tone}`}><CountUp value={value} /></p>
    </Spotlight>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { data, error, refresh } = usePoll<{ invoices: InvoiceRow[] }>('/api/invoices');
  const invoices = data?.invoices ?? [];
  const count = (status: InvoiceRow['status']) => invoices.filter((invoice) => invoice.status === status).length;

  return (
    <main className="mx-auto w-full max-w-[110rem] space-y-8 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
      <AppNav current="invoices" />

      <header className="pt-4">
        <p className="eyebrow animate-fade-up">Harbor Coffee Roasters · Accounts payable</p>
        <h1 className="animate-fade-up mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl" style={{ animationDelay: '60ms' }}>
          Invoices
        </h1>
        <p className="animate-fade-up mt-3 max-w-xl text-base text-gray-500" style={{ animationDelay: '120ms' }}>
          Every invoice is checked against vendor history and the public web. Anything suspicious is frozen until the
          vendor confirms on a call.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat index={0} label="Invoices" value={invoices.length} tone="text-gray-900" />
        <Stat index={1} label="Approved" value={count('approved')} tone="text-green-700" />
        <Stat index={2} label="Frozen" value={count('frozen') + count('verifying')} tone="text-amber-600" />
        <Stat index={3} label="Blocked" value={count('blocked')} tone="text-red-600" />
      </div>

      <AlertBanner invoices={invoices} />
      <div className="animate-fade-up" style={{ animationDelay: '420ms' }}>
        <UploadCard onUploaded={refresh} />
      </div>

      {error && !data && <p className="text-sm text-red-700">Could not load invoices: {error}</p>}

      <section className="card animate-fade-up overflow-hidden" style={{ animationDelay: '500ms' }}>
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h2 className="text-lg font-semibold tracking-tight">Recent invoices</h2>
          <span className="text-sm text-gray-500">{invoices.length} total</span>
        </div>
        {data && invoices.length === 0 ? (
          <p className="border-t border-gray-100 p-10 text-center text-sm text-gray-500">
            No invoices yet. Upload one to check it.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-gray-100 bg-gray-50 text-gray-500">
                <tr className="*:whitespace-nowrap *:px-6 *:py-2.5 *:text-xs *:font-medium">
                  <th>Vendor</th>
                  <th className="hidden sm:table-cell">Invoice</th>
                  <th className="hidden sm:table-cell">Date</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    role="link"
                    tabIndex={0}
                    className="group cursor-pointer transition-colors duration-200 *:whitespace-nowrap *:px-6 *:py-3.5 hover:bg-gray-50"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/invoices/${invoice.id}`);
                      }
                    }}
                  >
                    <td>
                      <span className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 transition-all duration-300 group-hover:scale-110 group-hover:bg-black group-hover:text-white" aria-hidden>
                          {invoice.vendor_name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900 transition-transform duration-300 group-hover:translate-x-0.5">{invoice.vendor_name}</span>
                      </span>
                    </td>
                    <td className="hidden text-gray-500 sm:table-cell">{invoice.invoice_number ?? 'n/a'}</td>
                    <td className="hidden text-gray-500 sm:table-cell">{invoice.invoice_date ?? 'n/a'}</td>
                    <td className="text-right font-medium tabular-nums">{money(invoice.amount, invoice.currency)}</td>
                    <td className="text-right">
                      <span className={`inline-block min-w-9 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${riskTone(invoice.risk_score)}`}>
                        {invoice.risk_score ?? 'n/a'}
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center justify-between gap-3">
                        <StatusBadge status={invoice.status} />
                        <span className="text-gray-300 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-gray-900 group-hover:opacity-100" aria-hidden>→</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
