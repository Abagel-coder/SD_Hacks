'use client';

import { useEffect, useState } from 'react';
import { BrowserCall } from '@/components/BrowserCall';
import type { CallOutcome, CallRow, InvoiceDetail } from '@/lib/types';

const OUTCOME_TEXT: Record<CallOutcome, string> = {
  confirmed: 'Vendor confirmed the change and passed the history check.',
  denied: 'Vendor said they did not request this change.',
  unclear: 'The call did not give a clear, verified confirmation.',
};

function liveStatus(call: CallRow): string {
  if (call.channel === 'browser') return 'Waiting for the browser call.';
  if (call.status === 'in_progress') return `On the call with ${call.number_dialed ?? 'the vendor'}…`;
  return `Calling ${call.number_dialed ?? 'the vendor'}…`;
}

export function CallPanel({ detail, onChange }: { detail: InvoiceDetail; onChange: () => void }) {
  const { invoice, call } = detail;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifying = invoice.status === 'verifying';
  const callId = call?.id ?? null;

  // While verifying, ask the server to sync the call. This drives live status and
  // completes the call even if the webhook is late.
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
      <h2 className="font-semibold">Vendor verification</h2>

      {invoice.status === 'frozen' && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-gray-700">
            The agent verifies with the vendor over a browser call, using the publicly listed number for context — never the one printed on the invoice.
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

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {call && verifying && (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-blue-800">
            <span className="h-2 w-2 animate-ping rounded-full bg-blue-600" />
            {liveStatus(call)}
          </p>
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

      {call?.challenge_question && (
        <p className="mt-1 text-xs text-gray-600">History question: {call.challenge_question}</p>
      )}

      {call?.outcome && (
        <p className={`mt-3 text-sm font-semibold ${call.outcome === 'confirmed' ? 'text-green-700' : 'text-red-700'}`}>
          {OUTCOME_TEXT[call.outcome]}
        </p>
      )}

      {call?.transcript && call.transcript.length > 0 && (
        <ol className="mt-3 space-y-2 text-sm">
          {call.transcript.map((turn, index) => (
            <li key={index} className={turn.role === 'agent' ? 'text-gray-700' : 'font-medium text-gray-900'}>
              <span className="mr-2 text-xs uppercase text-gray-500">{turn.role === 'agent' ? 'Agent' : 'Vendor'}</span>
              {turn.message}
            </li>
          ))}
        </ol>
      )}

      {!call && invoice.status !== 'frozen' && (
        <p className="mt-2 text-sm text-gray-600">No call was needed for this invoice.</p>
      )}
    </section>
  );
}
