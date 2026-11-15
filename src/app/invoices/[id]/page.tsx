'use client';

import { useParams } from 'next/navigation';
import { AppNav } from '@/components/AppNav';
import { AuditLog } from '@/components/AuditLog';
import { CallPanel } from '@/components/CallPanel';
import { Reveal } from '@/components/Reveal';
import { RiskPanel } from '@/components/RiskPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { VendorCheck } from '@/components/VendorCheck';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceDetail, InvoiceStatus } from '@/lib/types';

const STATUS_SHELL: Partial<Record<InvoiceStatus, string>> = {
  frozen: 'border-amber-400/70 bg-amber-400/10 shadow-[0_0_60px_rgba(251,191,36,0.12)]',
  verifying: 'border-sky-400/70 bg-sky-500/10 shadow-[0_0_60px_rgba(14,165,233,0.15)]',
  blocked: 'border-red-500/80 bg-red-600/15 shadow-[0_0_70px_rgba(220,38,38,0.2)]',
  approved: 'border-[var(--ig-green)]/70 bg-[var(--ig-green)]/10 shadow-[0_0_60px_rgba(6,193,103,0.15)]',
};

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, refresh } = usePoll<InvoiceDetail>(`/api/invoices/${id}`);

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 px-6 pb-16 text-white">
        <AppNav current="invoices" />
        <p className="text-sm text-white/55">{error ? 'Invoice not found.' : 'Loading…'}</p>
      </main>
    );
  }
  const { invoice, vendor, call } = data;
  const shell = STATUS_SHELL[invoice.status] ?? 'border-white/15 bg-white/5';
  const blocklisted = (invoice.risk_reasons ?? []).some((reason) => reason.code === 'BLOCKLIST_HIT');
  const hasReasons = (invoice.risk_reasons ?? []).length > 0;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 pb-16 text-white">
      <AppNav current="invoices" />

      <Reveal className={`rounded-3xl border p-6 transition-all duration-500 sm:p-8 ${shell}`}>
        <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Invoice</p>
            <h1 className="ig-display mt-2 text-[clamp(2rem,6vw,3.5rem)]">{invoice.vendor_name}</h1>
            <p className="mt-2 text-sm text-white/60">
              {invoice.invoice_number ?? 'n/a'} · from {invoice.sender_email ?? 'unknown sender'} · due{' '}
              {invoice.due_date ?? 'n/a'}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="ig-display text-3xl tabular-nums">{money(invoice.amount, invoice.currency)}</p>
            <StatusBadge status={invoice.status} size="lg" />
          </div>
        </div>

        {invoice.status === 'blocked' && (
          <p role="alert" className="mt-5 text-sm font-semibold text-red-200">
            Payment blocked. The vendor did not confirm this bank change, and the account ending{' '}
            {invoice.bank_account?.slice(-4) ?? 'unknown'} is now on the shared blocklist.
          </p>
        )}
        {invoice.status === 'frozen' && (
          <p className="mt-5 text-sm font-semibold text-amber-100">
            {blocklisted
              ? 'Matches a known scam on the blocklist. Payment stays frozen.'
              : 'Payment frozen. Nothing will be paid until the vendor confirms on a verification call.'}
          </p>
        )}
        {invoice.status === 'verifying' && (
          <p className="mt-5 text-sm font-semibold text-sky-100">
            Verification in progress — watch the badge flip when the call finishes.
          </p>
        )}
        {invoice.status === 'approved' && (
          <p className="mt-5 text-sm font-semibold text-emerald-100">
            {call?.outcome === 'confirmed'
              ? 'Payment approved. The vendor confirmed the bank details on a verification call.'
              : hasReasons
                ? 'Payment approved. The risk score was below the freeze threshold.'
                : 'Payment approved. No risk signals.'}
          </p>
        )}
        </header>
      </Reveal>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Reveal className="space-y-4">
          <RiskPanel invoice={invoice} />
        </Reveal>
        <Reveal className="space-y-4">
          <CallPanel detail={data} onChange={refresh} />
          <VendorCheck invoice={invoice} />
          <section className="ig-panel rounded-2xl p-4 text-sm text-white">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Bank details</h2>
            <p className="mt-2 text-white/80">On this invoice: account ending {invoice.bank_account?.slice(-4) ?? 'n/a'}</p>
            <p className="text-white/80">
              On file now for {vendor?.name ?? 'this vendor'}:{' '}
              {vendor?.bank_account ? `account ending ${vendor.bank_account.slice(-4)}` : 'nothing on file'}
            </p>
          </section>
        </Reveal>
      </div>

      <Reveal>
        <AuditLog rows={data.audit} />
      </Reveal>
    </main>
  );
}
