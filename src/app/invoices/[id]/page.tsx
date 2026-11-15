'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuditLog } from '@/components/AuditLog';
import { CallPanel } from '@/components/CallPanel';
import { RiskPanel } from '@/components/RiskPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { VendorCheck } from '@/components/VendorCheck';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceDetail } from '@/lib/types';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, refresh } = usePoll<InvoiceDetail>(`/api/invoices/${id}`);

  if (!data) {
    return <main className="p-6 text-sm text-gray-600">{error ? 'Invoice not found.' : 'Loading…'}</main>;
  }
  const { invoice, vendor } = data;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6 text-gray-900">
      <Link href="/" className="text-sm text-gray-600 underline">All invoices</Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{invoice.vendor_name}</h1>
          <p className="text-sm text-gray-600">
            Invoice {invoice.invoice_number ?? 'n/a'}, from {invoice.sender_email ?? 'unknown sender'}, due {invoice.due_date ?? 'n/a'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-2xl font-bold tabular-nums">{money(invoice.amount, invoice.currency)}</p>
          <StatusBadge status={invoice.status} />
        </div>
      </header>

      {invoice.status === 'blocked' && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-900">
          Payment blocked. The vendor did not confirm this bank change, and the account ending{' '}
          {invoice.bank_account?.slice(-4) ?? 'unknown'} is now on the shared blocklist.
        </div>
      )}
      {invoice.status === 'frozen' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Payment frozen. Nothing will be paid until the vendor is verified by phone.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <RiskPanel invoice={invoice} />
          <VendorCheck invoice={invoice} />
          <section className="rounded-lg border bg-white p-4 text-sm">
            <h2 className="font-semibold">Bank details</h2>
            <p className="mt-2">On this invoice: account ending {invoice.bank_account?.slice(-4) ?? 'n/a'}</p>
            <p>On file for {vendor?.name ?? 'this vendor'}: {vendor?.bank_account ? `account ending ${vendor.bank_account.slice(-4)}` : 'nothing on file'}</p>
          </section>
        </div>
        <div className="space-y-4">
          <CallPanel detail={data} onChange={refresh} />
          <AuditLog rows={data.audit} />
        </div>
      </div>
    </main>
  );
}
