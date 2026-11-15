import Link from 'next/link';
import type { InvoiceRow, RiskCode } from '@/lib/types';

const REASON_TITLE: Partial<Record<RiskCode, string>> = {
  BLOCKLIST_HIT: 'Already on the scam blocklist',
  BANK_CHANGED: 'Bank details do not match history',
  LOOKALIKE_DOMAIN: 'Sender domain looks like the real vendor',
  DOMAIN_MISMATCH: 'Sender domain is not the vendor’s site',
  NEW_DOMAIN: 'Sender domain is brand new',
  AMOUNT_ANOMALY: 'Amount is far above normal',
  URGENCY_OR_SECRECY: 'Pressure or secrecy language',
  UNKNOWN_VENDOR: 'No payment history with this vendor',
  AI_FLAGGED: 'Gemini flagged a warning sign',
  NO_WEB_PRESENCE: 'Sender domain has no public web presence',
};

function formatBlockedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function scoreTone(score: number): { text: string; bar: string; label: string } {
  if (score >= 50) return { text: 'text-red-700', bar: 'bg-red-600', label: 'High risk — do not pay' };
  if (score >= 25) return { text: 'text-amber-700', bar: 'bg-amber-500', label: 'Elevated risk' };
  return { text: 'text-green-700', bar: 'bg-green-600', label: 'Looks consistent with history' };
}

export function RiskPanel({ invoice }: { invoice: InvoiceRow }) {
  const score = invoice.risk_score ?? 0;
  const reasons = invoice.risk_reasons ?? [];
  const tone = scoreTone(score);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Risk score</h2>
          <p className={`mt-1 text-4xl font-bold tabular-nums ${tone.text}`}>
            {score}
            <span className="text-lg font-normal text-gray-500"> / 100</span>
          </p>
          <p className={`mt-1 text-sm font-medium ${tone.text}`}>{tone.label}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-500 ${tone.bar}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>

      {invoice.explanation && (
        <p className="mt-3 rounded-md bg-gray-50 p-3 text-sm leading-relaxed text-gray-800">
          {invoice.explanation}
        </p>
      )}

      {invoice.similar_scam && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
          ⚠ Similar to a scam blocked on {formatBlockedDate(invoice.similar_scam.blockedAt)}{' '}
          ({Math.round(invoice.similar_scam.similarity * 100)}% match).{' '}
          <Link
            href={`/invoices/${invoice.similar_scam.invoiceId}`}
            className="font-semibold underline underline-offset-2"
          >
            View that invoice
          </Link>
        </p>
      )}

      {reasons.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {reasons.map((reason, index) => (
            <li key={`${reason.code}-${index}`} className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  {REASON_TITLE[reason.code] ?? reason.code.replaceAll('_', ' ')}
                </p>
                <span className="shrink-0 text-sm font-bold tabular-nums text-red-700">+{reason.points}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-gray-700">{reason.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-600">No risk signals on this invoice.</p>
      )}
    </section>
  );
}
