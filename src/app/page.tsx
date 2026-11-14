'use client';

import Link from 'next/link';
import { AlertBanner } from '@/components/AlertBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadCard } from '@/components/UploadCard';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

export default function Dashboard() {
  const { data, error, refresh } = usePoll<{ invoices: InvoiceRow[] }>('/api/invoices');
  const invoices = data?.invoices ?? [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Invoice Guard</h1>
        <p className="text-sm text-gray-600">
          Every invoice is checked against vendor history and the public web before it is paid.
        </p>
      </header>

      <AlertBanner invoices={invoices} />
      <UploadCard onUploaded={refresh} />

      {error && !data && <p className="text-sm text-red-700">Could not load invoices: {error}</p>}

      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-gray-500">
          <tr>
            <th className="py-2">Vendor</th>
            <th>Invoice</th>
            <th>Date</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Risk</th>
            <th className="pl-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b hover:bg-gray-50">
              <td className="py-2 font-medium">
                <Link href={`/invoices/${invoice.id}`} className="underline-offset-2 hover:underline">
                  {invoice.vendor_name}
                </Link>
              </td>
              <td>{invoice.invoice_number ?? 'n/a'}</td>
              <td>{invoice.invoice_date ?? 'n/a'}</td>
              <td className="text-right tabular-nums">{money(invoice.amount, invoice.currency)}</td>
              <td className="text-right tabular-nums">{invoice.risk_score ?? 'n/a'}</td>
              <td className="pl-4"><StatusBadge status={invoice.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
