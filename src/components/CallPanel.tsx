'use client';

import { useEffect, useState } from 'react';
import { BrowserCall } from '@/components/BrowserCall';
import { LiveCallIndicator } from '@/components/LiveCallIndicator';
import type { CallOutcome, CallRow, InvoiceDetail } from '@/lib/types';

const OUTCOME_TEXT: Record<CallOutcome, string> = {
  confirmed: 'Vendor confirmed the change and passed the history check.',
  denied: 'Vendor said they did not request this change.',
  unclear: 'The call did not give a clear, verified confirmation.',
};

function liveStatus(call: CallRow): string {
  if (call.channel === 'browser') {
    return call.status === 'initiated' ? 'Ready: click Start browser call.' : 'On the verification call…';
  }
  if (call.status === 'in_progress') return `On the call with ${call.number_dialed ?? 'the vendor'}…`;
  return `Calling ${call.number_dialed ?? 'the vendor'}…`;
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

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Vendor verification</h2>

      {invoice.status === 'frozen' && blocklisted && (
        <p className="mt-3 text-sm font-medium text-amber-950">
          Already denied by vendor. Payment stays frozen.
        </p>
      )}

      {invoice.status === 'frozen' && !blocklisted && (
        <div className="mt-3 space-y-2">
          <p className="text-sm leading-relaxed text-gray-700">
            The agent checks with the vendor on a verification call, using the publicly listed number for context — never the one printed on the invoice.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void verifyInBrowser()} disabled={busy}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Starting…' : 'Verify in browser'}
            </button>
          </div>
          {call?.status === 'failed' && (
            <p className="text-sm text-amber-800">The last call could not be completed. You can try again.</p>
          )}
        </div>
      )}

      {invoice.status === 'blocked' && blocklisted && !call && (
        <p className="mt-3 text-sm font-medium text-red-800">
          Already denied by vendor, blocked automatically.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {call && verifying && (
        <div className="mt-3 space-y-2">
          {call.channel === 'browser' && call.status === 'initiated' ? (
            <p className="text-sm font-medium text-blue-800">{liveStatus(call)}</p>
          ) : (
            <LiveCallIndicator startedAt={call.started_at} label={liveStatus(call)} />
          )}
          {call.channel === 'browser' && <BrowserCall callId={call.id} />}
        </div>
      )}

      {call && call.channel === 'phone' && (
        <p className="mt-3 text-xs text-gray-600">
          Number found on the public web: {call.number_found ?? 'none'}.
          {call.number_dialed && call.number_dialed !== call.number_found
            ? ` Demo redirect: dialled ${call.number_dialed} instead.`
            : ''}
        </p>
      )}

      {!call?.outcome && historyQuestion && (
        <p className="mt-1 text-xs text-gray-600">{historyQuestion}</p>
      )}

      {call?.email_found && (
        <p className="mt-1 text-xs text-gray-600">
          {call.code_check === 'not_sent'
            ? `Email code: not sent to ${call.email_found}.`
            : `Email code sent to the vendor's public address ${call.email_found}` +
              (call.email_sent_to && call.email_sent_to !== call.email_found.toLowerCase() ? ` (demo redirect: ${call.email_sent_to})` : '') +
              (call.code_check === 'passed' ? '. Read back correctly.' : call.code_check === 'failed' ? '. Not read back correctly.' : '.')}
        </p>
      )}

      {call?.outcome && (
        <p
          className={`mt-3 rounded-md border p-3 text-base font-semibold ${
            call.outcome === 'confirmed'
              ? 'border-green-300 bg-green-50 text-green-800'
              : call.code_check === 'failed'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {call.code_check === 'failed'
            ? 'Said yes, but could not read back the emailed code. Escalated to the owner; the payment stays frozen.'
            : OUTCOME_TEXT[call.outcome]}
        </p>
      )}

      {call?.outcome && historyQuestion && (
        <p className="mt-2 text-xs text-gray-600">{historyQuestion}</p>
      )}

      {call?.transcript && call.transcript.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Call transcript</h3>
          <ol className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            {call.transcript.map((turn, index) => {
              const agent = turn.role === 'agent';
              return (
                <li
                  key={index}
                  className={`flex ${agent ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                      agent
                        ? 'rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-200'
                        : 'rounded-br-md bg-blue-700 text-white'
                    }`}
                  >
                    <p className={`mb-0.5 text-xs font-semibold uppercase tracking-wide ${agent ? 'text-gray-500' : 'text-blue-100'}`}>
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
