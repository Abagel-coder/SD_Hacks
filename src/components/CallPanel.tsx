'use client';

import { useEffect, useState } from 'react';
import type { CallOutcome, InvoiceDetail } from '@/lib/types';

const OUTCOME_TEXT: Record<CallOutcome, string> = {
  confirmed: 'Vendor confirmed the change and passed the history check.',
  denied: 'Vendor said they did not request this change.',
  unclear: 'The call did not give a clear, verified confirmation.',
};

function PhoneIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

/** A phone icon with expanding rings, for "a call is waiting" and "a call is live". */
function RingingPhone({ tone }: { tone: 'light' | 'blue' }) {
  const ring = tone === 'light' ? 'bg-white/30' : 'bg-blue-500/30';
  const core = tone === 'light' ? 'bg-white text-black' : 'bg-blue-600 text-white';
  return (
    <span className="relative grid h-16 w-16 shrink-0 place-items-center">
      <span className={`animate-ripple absolute inset-0 rounded-full ${ring}`} />
      <span className={`animate-ripple absolute inset-0 rounded-full ${ring}`} style={{ animationDelay: '0.7s' }} />
      <span className={`relative grid h-16 w-16 place-items-center rounded-full ${core}`}>
        <PhoneIcon />
      </span>
    </span>
  );
}

export function CallPanel({ detail, onChange }: { detail: InvoiceDetail; onChange: () => void }) {
  const { invoice, call } = detail;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifying = invoice.status === 'verifying';
  const callId = call?.id ?? null;
  const blocklisted = (invoice.risk_reasons ?? []).some((reason) => reason.code === 'BLOCKLIST_HIT');
  // Display only: the history question is shown during the call, and afterwards only when the vendor confirmed.
  const callFinished = call ? call.outcome !== null || call.status === 'completed' || call.status === 'failed' : false;
  const historyQuestion = call?.challenge_question && (!callFinished || call.outcome === 'confirmed')
    ? `History question: ${call.challenge_question}`
    : null;

  useEffect(() => {
    if (!verifying || !callId) return;
    const timer = setInterval(() => {
      fetch(`/api/calls/${callId}/sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }).then(onChange).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [verifying, callId, onChange]);

  async function verifyInBrowser() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'browser' }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Could not start the call.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the call.');
    } finally {
      setBusy(false);
      onChange();
    }
  }

  const errorLine = error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>;

  // 1. A call is needed: the owner asks the agent to call the vendor.
  if (invoice.status === 'frozen' && !blocklisted) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] bg-black p-6 text-white shadow-xl shadow-black/20 sm:p-8">
        <div className="animate-drift pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-600/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <RingingPhone tone="light" />
            <div>
              <p className="eyebrow !text-gray-400">Next step</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Have Vouch call {invoice.vendor_name}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-300">
                Our AI agent calls {invoice.vendor_name} at the number on their real website, never the one printed on the invoice,
                and asks whether they really changed their bank details. You don&apos;t need to be on the call.
              </p>
              <ol className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-gray-200">
                {[`Agent calls ${invoice.vendor_name}`, `${invoice.vendor_name} answers on their phone`, 'You see the result here'].map((step, index) => (
                  <li key={step} className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 ring-1 ring-white/15">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-bold text-black">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <button
            onClick={() => void verifyInBrowser()}
            disabled={busy}
            className="btn shrink-0 !bg-white !px-7 !py-4 !text-base !text-black hover:!bg-gray-100"
          >
            <PhoneIcon className="h-5 w-5" />
            {busy ? 'Starting…' : `Call ${invoice.vendor_name}`}
          </button>
        </div>
        {call?.status === 'failed' && (
          <p className="relative mt-5 text-sm text-amber-300">The last call could not be completed. You can try again.</p>
        )}
        {errorLine}
      </section>
    );
  }

  // 2. A call is live on the vendor's side. The business only watches its progress; the vendor answers on
  // their own phone (/vendor), signed in as the vendor in another tab or on another device.
  if (call && verifying) {
    const answered = call.status === 'in_progress';
    const stages = [
      { label: `Calling ${invoice.vendor_name}`, state: answered ? 'done' : 'active' },
      { label: `${invoice.vendor_name} answered`, state: answered ? 'active' : 'waiting' },
      { label: 'Result', state: 'waiting' },
    ] as const;
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] bg-white p-6 shadow-xl shadow-blue-600/10 ring-2 ring-blue-500/60 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <RingingPhone tone="blue" />
          <div className="flex-1">
            <p className="eyebrow !text-blue-600">Call in progress on {invoice.vendor_name}&apos;s side</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {answered
                ? `${invoice.vendor_name} is talking to the agent…`
                : `Ringing ${invoice.vendor_name}… waiting for them to answer`}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Payment stays frozen until the call ends. This page updates by itself with the result.
            </p>
            <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
              {stages.map((stage, index) => (
                <li key={stage.label} className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                      stage.state === 'done'
                        ? 'bg-black text-white'
                        : stage.state === 'active'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {stage.state === 'active' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                    {stage.state === 'done' && '✓'} {stage.label}
                  </span>
                  {index < stages.length - 1 && <span className="text-gray-300" aria-hidden>→</span>}
                </li>
              ))}
            </ol>
          </div>
          {call.channel === 'browser' && (
            <a href="/vendor" target="_blank" rel="noreferrer" className="shrink-0 text-sm font-medium text-gray-500 underline-offset-4 hover:text-black hover:underline">
              Demo: open {invoice.vendor_name}&apos;s phone ↗
            </a>
          )}
        </div>
        {errorLine}
      </section>
    );
  }

  // 3. Everything else: the result of the call (or why none was needed) and the transcript.
  return (
    <section className="card p-6 text-gray-900 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-700">
          <PhoneIcon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">Vendor verification call</h2>
      </div>

      {invoice.status === 'frozen' && blocklisted && (
        <p className="mt-4 text-sm font-medium text-amber-950">Already denied by vendor. Payment stays frozen.</p>
      )}
      {invoice.status === 'blocked' && blocklisted && !call && (
        <p className="mt-4 text-sm font-medium text-red-800">Already denied by vendor, blocked automatically.</p>
      )}
      {errorLine}

      {call && call.channel === 'phone' && (
        <p className="mt-3 text-xs text-gray-600">
          Number found on the public web: {call.number_found ?? 'none'}.
          {call.number_dialed && call.number_dialed !== call.number_found
            ? ` Demo redirect: dialled ${call.number_dialed} instead.`
            : ''}
        </p>
      )}

      {call?.email_found && (
        <p className="mt-3 text-xs text-gray-600">
          {call.code_check === 'not_sent'
            ? `Email code: not sent to ${call.email_found}.`
            : `Email code sent to the vendor's public address ${call.email_found}` +
              (call.email_sent_to && call.email_sent_to !== call.email_found.toLowerCase() ? ` (demo redirect: ${call.email_sent_to})` : '') +
              (call.code_check === 'passed' ? '. Read back correctly.' : call.code_check === 'failed' ? '. Not read back correctly.' : '.')}
        </p>
      )}

      {call?.outcome && (
        <div
          className={`animate-fade-up mt-4 flex items-start gap-4 rounded-2xl border p-5 ${
            call.outcome === 'confirmed'
              ? 'border-green-300 bg-green-50 text-green-800'
              : call.code_check === 'failed'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold text-white ${
              call.outcome === 'confirmed' ? 'bg-green-600' : call.code_check === 'failed' || call.outcome === 'unclear' ? 'bg-amber-500' : 'bg-red-600'
            }`}
            aria-hidden
          >
            {call.outcome === 'confirmed' ? '✓' : call.outcome === 'denied' ? '✕' : '!'}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Verification complete</p>
            <p className="mt-0.5 text-base font-semibold">
              {call.code_check === 'failed'
                ? 'Said yes, but could not read back the emailed code. Escalated to the owner; the payment stays frozen.'
                : OUTCOME_TEXT[call.outcome]}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {invoice.status === 'approved'
                ? 'Payment approved. You can pay this invoice.'
                : invoice.status === 'blocked'
                  ? 'Payment blocked, and the account is on the shared blocklist.'
                  : 'Payment stays frozen for you to review.'}
            </p>
          </div>
        </div>
      )}

      {historyQuestion && <p className="mt-2 text-xs text-gray-600">{historyQuestion}</p>}

      {call?.transcript && call.transcript.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="eyebrow">Call transcript</h3>
          <ol className="space-y-2 rounded-2xl bg-gray-50 p-4">
            {call.transcript.map((turn, index) => {
              const agent = turn.role === 'agent';
              return (
                <li
                  key={index}
                  className={`animate-fade-up flex ${agent ? 'justify-start' : 'justify-end'}`}
                  style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                      agent
                        ? 'rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-200'
                        : 'rounded-br-md bg-black text-white'
                    }`}
                  >
                    <p className={`mb-0.5 text-xs font-semibold uppercase tracking-wide ${agent ? 'text-gray-500' : 'text-gray-400'}`}>
                      {agent ? 'Agent' : 'Vendor'}
                    </p>
                    <p>{turn.message}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!call && invoice.status !== 'frozen' && !blocklisted && (
        <p className="mt-3 text-sm text-gray-600">No call was needed for this invoice.</p>
      )}
    </section>
  );
}
