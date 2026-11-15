'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { maskLongNumbers } from '@/lib/format';
import { RiskIcon } from '@/components/icons';
import { REASON_TITLE } from '@/lib/risk-labels';
import type { InvoiceRow } from '@/lib/types';

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

/** The Gemini explanation, clamped to 3 lines with a toggle when it runs longer. */
function Explanation({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const observer = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, text]);

  return (
    <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm leading-relaxed text-gray-800">
      <p ref={ref} className={open ? '' : 'line-clamp-3'}>{text}</p>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-semibold text-accent underline underline-offset-2"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export function RiskPanel({ invoice }: { invoice: InvoiceRow }) {
  const score = invoice.risk_score ?? 0;
  const reasons = invoice.risk_reasons ?? [];
  const tone = scoreTone(score);
  const decided = invoice.status === 'approved' || invoice.status === 'blocked';
  const capped = reasons.reduce((sum, reason) => sum + reason.points, 0) > 100;

  return (
    <section className="card text-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">
            {decided ? 'Risk score at upload' : 'Risk score'}
          </h2>
          <p className={`mt-1 text-4xl font-bold tabular-nums ${tone.text}`}>
            {score}
            <span className="text-lg font-normal text-gray-500"> / 100</span>
            {capped && <span className="ml-2 text-xs font-normal text-gray-500">(capped at 100)</span>}
          </p>
          <p className={`mt-1 text-sm font-medium ${tone.text}`}>{tone.label}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-500 ${tone.bar}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>

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
            <li key={`${reason.code}-${index}`} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <RiskIcon code={reason.code} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {REASON_TITLE[reason.code] ?? reason.code.replaceAll('_', ' ')}
                  </p>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-red-700">+{reason.points}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">{maskLongNumbers(reason.detail)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-600">No risk signals on this invoice.</p>
      )}

      {invoice.explanation && <Explanation text={invoice.explanation} />}
    </section>
  );
}
