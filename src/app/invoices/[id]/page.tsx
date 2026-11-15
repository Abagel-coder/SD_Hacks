'use client';

import { useParams } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { AuditLog } from '@/components/AuditLog';
import { CallPanel } from '@/components/CallPanel';
import { RiskPanel } from '@/components/RiskPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { VendorCheck } from '@/components/VendorCheck';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceDetail, InvoiceStatus } from '@/lib/types';

const STATUS_SHELL: Partial<Record<InvoiceStatus, string>> = {
  frozen: 'border-amber-400 bg-amber-50',
  verifying: 'border-blue-500 bg-blue-50',
  blocked: 'border-red-600 bg-red-50',
  approved: 'border-green-300 bg-green-50',
};

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, refresh } = usePoll<InvoiceDetail>(`/api/invoices/${id}`);

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-6 text-gray-900">
        <AppNav current="invoices" />
        <p className="text-sm text-gray-600">{error ? 'Invoice not found.' : 'Loading…'}</p>
      </main>
    );
  }
  const { invoice, vendor } = data;
  const shell = STATUS_SHELL[invoice.status] ?? 'border-gray-200 bg-white';

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-gray-900">
      <AppNav current="invoices" />

      <header className={`rounded-xl border-2 p-5 transition-colors duration-500 ${shell}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Invoice</p>
            <h1 className="text-2xl font-bold tracking-tight">{invoice.vendor_name}</h1>
            <p className="mt-1 text-sm text-gray-700">
              {invoice.invoice_number ?? 'n/a'} · from {invoice.sender_email ?? 'unknown sender'} · due{' '}
              {invoice.due_date ?? 'n/a'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <p className="text-2xl font-bold tabular-nums">{money(invoice.amount, invoice.currency)}</p>
            <StatusBadge status={invoice.status} size="lg" />
          </div>
        </div>

        {invoice.status === 'blocked' && (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-900">
            Payment blocked. The vendor did not confirm this bank change, and the account ending{' '}
            {invoice.bank_account?.slice(-4) ?? 'unknown'} is now on the shared blocklist.
          </p>
        )}
        {invoice.status === 'frozen' && (
          <p className="mt-4 text-sm font-semibold text-amber-950">
            Payment frozen. Nothing will be paid until the vendor is verified in the browser.
          </p>
        )}
        {invoice.status === 'verifying' && (
          <p className="mt-4 text-sm font-semibold text-blue-900">
            Verification in progress — watch the badge flip when the call finishes.
          </p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <RiskPanel invoice={invoice} />
          <VendorCheck invoice={invoice} />
          <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Bank details</h2>
            <p className="mt-2">On this invoice: account ending {invoice.bank_account?.slice(-4) ?? 'n/a'}</p>
            <p>
              On file for {vendor?.name ?? 'this vendor'}:{' '}
              {vendor?.bank_account ? `account ending ${vendor.bank_account.slice(-4)}` : 'nothing on file'}
            </p>
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
