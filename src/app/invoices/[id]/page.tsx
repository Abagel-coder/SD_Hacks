'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AppNav } from '@/components/AppNav';
import { AuditLog } from '@/components/AuditLog';
import { CallPanel } from '@/components/CallPanel';
import { RiskPanel } from '@/components/RiskPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { VendorCheck } from '@/components/VendorCheck';
import { usePoll } from '@/hooks/usePoll';
import { blockedItemsText } from '@/lib/blocklist';
import { money } from '@/lib/format';
import type { InvoiceDetail, InvoiceStatus } from '@/lib/types';

const STATUS_SHELL: Partial<Record<InvoiceStatus, string>> = {
  frozen: 'bg-amber-50 ring-amber-300',
  verifying: 'bg-blue-50 ring-blue-300',
  blocked: 'bg-red-50 ring-red-300',
  approved: 'bg-green-50 ring-green-300',
};

type StepState = 'done' | 'current' | 'upcoming' | 'skipped' | 'good' | 'bad';

/** Where the invoice is in its journey: uploaded, checked, frozen, called, decided. */
function journey(detail: InvoiceDetail): { label: string; state: StepState }[] {
  const { invoice, call } = detail;
  const status = invoice.status;
  const wasFrozen = status !== 'approved' || call !== null;
  const decided = status === 'approved' || status === 'blocked';
  const calledOrCalling = call !== null;
  return [
    { label: 'Uploaded', state: 'done' },
    { label: 'Risk checked', state: status === 'pending' ? 'current' : 'done' },
    { label: 'Payment frozen', state: status === 'pending' ? 'upcoming' : wasFrozen ? 'done' : 'skipped' },
    {
      label: 'Vendor call',
      state: status === 'frozen' ? 'current' : status === 'verifying' ? 'current' : calledOrCalling ? 'done' : decided ? 'skipped' : 'upcoming',
    },
    { label: status === 'blocked' ? 'Blocked' : status === 'approved' ? 'Approved' : 'Decision', state: status === 'blocked' ? 'bad' : status === 'approved' ? 'good' : 'upcoming' },
  ];
}

const DOT: Record<StepState, string> = {
  done: 'bg-black text-white',
  current: 'bg-blue-600 text-white ring-4 ring-blue-200 animate-pulse',
  upcoming: 'bg-white text-gray-400 ring-1 ring-gray-300',
  skipped: 'bg-gray-100 text-gray-400',
  good: 'bg-green-600 text-white ring-4 ring-green-200',
  bad: 'bg-red-600 text-white ring-4 ring-red-200',
};

function Journey({ detail }: { detail: InvoiceDetail }) {
  const steps = journey(detail);
  return (
    <ol className="card flex items-start gap-1 overflow-x-auto px-4 py-5 sm:px-8">
      {steps.map((step, index) => (
        <li key={step.label} className="flex min-w-24 flex-1 items-start">
          <div className="flex flex-1 flex-col items-center gap-2 text-center">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all duration-500 ${DOT[step.state]}`}>
              {step.state === 'done' ? '✓' : step.state === 'bad' ? '✕' : step.state === 'good' ? '✓' : index + 1}
            </span>
            <span className={`text-xs font-medium ${step.state === 'upcoming' || step.state === 'skipped' ? 'text-gray-400' : 'text-gray-900'}`}>
              {step.label}
              {step.state === 'skipped' && <span className="block text-[10px] font-normal">not needed</span>}
            </span>
          </div>
          {index < steps.length - 1 && (
            <span
              className={`mt-4 h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                steps[index + 1].state === 'upcoming' ? 'bg-gray-200' : 'bg-black'
              }`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

const TABS = ['risk', 'vendor', 'audit'] as const;
type Tab = (typeof TABS)[number];

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, refresh } = usePoll<InvoiceDetail>(`/api/invoices/${id}`);
  const [tab, setTab] = useState<Tab>('risk');

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-[110rem] space-y-6 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
        <AppNav current="invoices" />
        {error ? (
          <p className="text-sm text-gray-600">Invoice not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-[1.75rem] bg-gray-200/70" />
            <div className="h-20 animate-pulse rounded-[1.25rem] bg-gray-200/60" />
            <div className="h-64 animate-pulse rounded-[1.25rem] bg-gray-200/50" />
          </div>
        )}
      </main>
    );
  }
  const { invoice, vendor } = data;
  const call = data.call;
  const shell = STATUS_SHELL[invoice.status] ?? 'bg-white ring-black/5';
  const blocklisted = (invoice.risk_reasons ?? []).some((reason) => reason.code === 'BLOCKLIST_HIT');
  const blockedItems = blockedItemsText(
    invoice.bank_account, invoice.sender_domain, vendor?.real_domain ?? invoice.intel?.realDomain,
  );
  const hasReasons = (invoice.risk_reasons ?? []).length > 0;
  const tabLabel: Record<Tab, string> = {
    risk: `Why it's risky${hasReasons ? ` · ${(invoice.risk_reasons ?? []).length}` : ''}`,
    vendor: 'Vendor check',
    audit: `Audit log · ${data.audit.length}`,
  };

  return (
    <main className="mx-auto w-full max-w-[110rem] space-y-5 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
      <AppNav current="invoices" />

      <header className={`animate-fade-up rounded-[1.75rem] p-6 ring-1 ring-inset transition-colors duration-500 sm:p-8 ${shell}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 text-xs font-medium text-gray-700 ring-1 ring-black/10">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-black text-white" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /></svg>
              </span>
              Viewing as: business owner · Harbor Coffee Roasters
            </p>
            <p className="eyebrow">Invoice</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{invoice.vendor_name}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {invoice.invoice_number ?? 'n/a'} · from {invoice.sender_email ?? 'unknown sender'} · due{' '}
              {invoice.due_date ?? 'n/a'}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{money(invoice.amount, invoice.currency)}</p>
            <StatusBadge status={invoice.status} size="lg" />
          </div>
        </div>

        {invoice.status === 'blocked' && (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-900">
            Payment blocked. The vendor did not confirm this bank change{blockedItems ? `, and ${blockedItems}.` : '.'}
          </p>
        )}
        {invoice.status === 'frozen' && (
          <p className="mt-4 text-sm font-semibold text-amber-950">
            {blocklisted
              ? 'Matches a known scam on the blocklist. Payment stays frozen.'
              : 'Payment frozen. Nothing will be paid until the vendor confirms on a verification call.'}
          </p>
        )}
        {invoice.status === 'verifying' && (
          <p className="mt-4 text-sm font-semibold text-blue-900">
            Verification in progress — watch the badge flip when the call finishes.
          </p>
        )}
        {invoice.status === 'approved' && (
          <p className="mt-4 text-sm font-semibold text-green-900">
            {call?.outcome === 'confirmed'
              ? 'Payment approved. The vendor confirmed the bank details on a verification call.'
              : hasReasons
                ? 'Payment approved. The risk score was below the freeze threshold.'
                : 'Payment approved. No risk signals.'}
          </p>
        )}
      </header>

      <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
        <Journey detail={data} />
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
        <CallPanel detail={data} onChange={refresh} />
      </div>

      <section className="animate-fade-up space-y-4" style={{ animationDelay: '240ms' }}>
        <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-full bg-gray-200/70 p-1">
          {TABS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                tab === id ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
              }`}
            >
              {tabLabel[id]}
            </button>
          ))}
        </div>

        <div key={tab} className="animate-fade-up">
          {tab === 'risk' && <RiskPanel invoice={invoice} />}
          {tab === 'vendor' && (
            <div className="grid items-start gap-4 md:grid-cols-[1.6fr_1fr]">
              <VendorCheck invoice={invoice} />
              <section className="card p-6 text-sm text-gray-900">
                <h2 className="eyebrow">Bank details</h2>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">On this invoice</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">•••• {invoice.bank_account?.slice(-4) ?? 'n/a'}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">On file now for {vendor?.name ?? 'this vendor'}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {vendor?.bank_account ? `•••• ${vendor.bank_account.slice(-4)}` : 'nothing on file'}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
          {tab === 'audit' && <AuditLog rows={data.audit} />}
        </div>
      </section>
    </main>
  );
}
