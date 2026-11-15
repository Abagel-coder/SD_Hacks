'use client';

import { useRouter } from 'next/navigation';
import { AlertBanner } from '@/components/AlertBanner';
import { AppNav } from '@/components/AppNav';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadCard } from '@/components/UploadCard';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

/** Red at 50+, amber 20 to 49, gray below 20. */
function riskTone(score: number | null): string {
  if (score === null) return 'text-gray-500';
  if (score >= 50) return 'font-semibold text-red-700';
  if (score >= 20) return 'font-semibold text-amber-700';
  return 'text-gray-500';
}

export default function Dashboard() {
  const router = useRouter();
  const { data, error, refresh } = usePoll<{ invoices: InvoiceRow[] }>('/api/invoices');
  const invoices = data?.invoices ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6 text-gray-900">
      <AppNav current="invoices" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-gray-600">
          Every invoice is checked against vendor history and the public web before it is paid.
        </p>
      </header>

      <AlertBanner invoices={invoices} />
      <UploadCard onUploaded={refresh} />

      {error && !data && <p className="text-sm text-red-700">Could not load invoices: {error}</p>}

      {data && invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          No invoices yet. Upload one to check it.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr className="*:whitespace-nowrap *:px-2 *:py-2">
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
                  className="cursor-pointer border-b border-gray-200 *:whitespace-nowrap *:px-2 *:py-2 hover:bg-gray-50"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      router.push(`/invoices/${invoice.id}`);
                    }
                  }}
                >
                  <td className="font-medium text-gray-900 underline-offset-2 hover:underline">
                    {invoice.vendor_name}
                  </td>
                  <td className="hidden sm:table-cell">{invoice.invoice_number ?? 'n/a'}</td>
                  <td className="hidden sm:table-cell">{invoice.invoice_date ?? 'n/a'}</td>
                  <td className="text-right tabular-nums">{money(invoice.amount, invoice.currency)}</td>
                  <td className={`text-right tabular-nums ${riskTone(invoice.risk_score)}`}>{invoice.risk_score ?? 'n/a'}</td>
                  <td><StatusBadge status={invoice.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
