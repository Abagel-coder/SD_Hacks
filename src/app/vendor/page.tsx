'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AccountChip } from '@/components/AccountChip';
import { BrowserCall } from '@/components/BrowserCall';
import { useAccount } from '@/hooks/useAccount';
import { usePoll } from '@/hooks/usePoll';
import { BUSINESS_ACCOUNTS } from '@/lib/accounts';
import type { InvoiceDetail, InvoiceRow } from '@/lib/types';

const CALLER = BUSINESS_ACCOUNTS[0].name;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** The ringing (and then live) call for one invoice the agent is verifying with this vendor. */
function IncomingCall({ invoiceId, vendorName }: { invoiceId: string; vendorName: string }) {
  const { data } = usePoll<InvoiceDetail>(`/api/invoices/${invoiceId}`, 2000);
  const call = data?.call;

  if (!data || !call) {
    return <p className="mt-24 text-center text-sm text-gray-400">Connecting…</p>;
  }
  if (call.channel !== 'browser') {
    return <p className="mt-24 text-center text-sm text-gray-400">This call is going to the vendor&apos;s real phone line.</p>;
  }

  return (
    <div className="animate-fade-up flex flex-1 flex-col items-center">
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-gray-400">Incoming call</p>
      <span className="relative mt-6 grid h-24 w-24 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
        <span className="animate-ripple absolute inset-0 rounded-full bg-white/10" />
        <span className="relative text-3xl font-semibold">{CALLER.slice(0, 1)}</span>
      </span>
      <p className="mt-5 text-center text-2xl font-semibold tracking-tight">{CALLER}</p>
      <p className="mt-1 text-center text-sm text-gray-400">Verification agent · invoice {data.invoice.invoice_number ?? ''}</p>
      <p className="mt-1 text-center text-xs text-gray-500">AI voice by ElevenLabs</p>
      <div className="mt-auto pt-10">
        <BrowserCall callId={call.id} vendorName={vendorName} />
      </div>
    </div>
  );
}

export default function VendorPhone() {
  const account = useAccount('vendor');
  const now = useClock();
  const { data } = usePoll<{ invoices: InvoiceRow[] }>('/api/invoices', 2000);
  const vendorName = account?.name ?? '';

  // The newest invoice this vendor is being called about right now.
  const ringing = (data?.invoices ?? [])
    .filter((invoice) => invoice.status === 'verifying' && invoice.vendor_name.toLowerCase() === vendorName.toLowerCase())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <main className="mx-auto w-full max-w-[110rem] space-y-8 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
      <nav className="sticky top-3 z-50 flex items-center justify-between gap-3 rounded-full bg-black/90 py-2 pl-5 pr-2 text-white shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-green-500 text-white" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight">Vouch <span className="font-normal text-gray-400">· Vendor phone</span></span>
        </Link>
        <AccountChip kind="vendor" />
      </nav>

      <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
        <aside className="animate-fade-up order-2 space-y-3 lg:order-1">
          <p className="eyebrow">You are the vendor</p>
          <h1 className="text-3xl font-semibold tracking-tight">{vendorName}&apos;s office phone</h1>
          <p className="text-sm leading-relaxed text-gray-500">
            When a business&apos;s verification agent calls {vendorName} about a bank change, it rings here. Answer and talk
            to the agent as {vendorName}&apos;s accounts team.
          </p>
        </aside>

        {/* The phone */}
        <div className="animate-fade-up order-1 mx-auto lg:order-2" style={{ animationDelay: '80ms' }}>
          <div className="relative flex h-[640px] w-[320px] flex-col overflow-hidden rounded-[3rem] bg-gradient-to-b from-gray-900 via-gray-950 to-black px-6 pb-8 pt-4 text-white shadow-2xl shadow-black/40 ring-8 ring-black">
            <div className={`animate-drift pointer-events-none absolute -top-24 left-0 h-72 w-72 rounded-full blur-3xl ${ringing ? 'bg-green-500/25' : 'bg-blue-600/20'}`} />
            <div className="relative flex items-center justify-between text-xs font-semibold">
              <span className="tabular-nums">{time}</span>
              <span className="h-6 w-24 rounded-full bg-black" aria-hidden />
              <span className="flex items-center gap-1" aria-hidden>
                <span className="h-2 w-3 rounded-sm bg-white" />
              </span>
            </div>

            {ringing ? (
              <IncomingCall key={ringing.id} invoiceId={ringing.id} vendorName={vendorName} />
            ) : (
              <div className="relative flex flex-1 flex-col items-center">
                <p className="mt-14 text-sm text-gray-400">{date}</p>
                <p className="text-7xl font-semibold tracking-tight tabular-nums">{time}</p>
                <div className="mt-auto w-full rounded-3xl bg-white/10 p-4 text-center ring-1 ring-white/10">
                  <p className="text-sm font-semibold">{vendorName} · Accounts receivable</p>
                  <p className="mt-1 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    Waiting for calls
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="animate-fade-up order-3 space-y-3 text-sm text-gray-500" style={{ animationDelay: '160ms' }}>
          <p className="eyebrow">How to test</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>In another tab, sign in as the business and upload an invoice.</li>
            <li>When it is frozen, click <span className="font-medium text-gray-900">Start verification call</span> there.</li>
            <li>This phone rings. Press the green button and answer as {vendorName}.</li>
          </ol>
        </aside>
      </div>
    </main>
  );
}
