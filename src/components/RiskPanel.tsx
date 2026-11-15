'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { maskLongNumbers } from '@/lib/format';
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
  if (score >= 50) return { text: 'text-red-400', bar: 'bg-red-500', label: 'High risk — do not pay' };
  if (score >= 25) return { text: 'text-amber-300', bar: 'bg-amber-400', label: 'Elevated risk' };
  return { text: 'text-[var(--ig-green)]', bar: 'bg-[var(--ig-green)]', label: 'Looks consistent with history' };
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
    <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm leading-relaxed text-white/75">
      <p ref={ref} className={open ? '' : 'line-clamp-3'}>{text}</p>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-semibold text-[var(--ig-green)] underline underline-offset-2"
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
    <section className="ig-panel rounded-2xl p-4 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {decided ? 'Risk score at upload' : 'Risk score'}
          </h2>
          <p className={`mt-1 text-4xl font-bold tabular-nums ${tone.text}`}>
            {score}
            <span className="text-lg font-normal text-white/40"> / 100</span>
            {capped && <span className="ml-2 text-xs font-normal text-white/40">(capped at 100)</span>}
          </p>
          <p className={`mt-1 text-sm font-medium ${tone.text}`}>{tone.label}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${tone.bar}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>

      {invoice.similar_scam && (
        <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm font-medium text-amber-200">
          Similar to a scam blocked on {formatBlockedDate(invoice.similar_scam.blockedAt)}{' '}
          ({Math.round(invoice.similar_scam.similarity * 100)}% match).{' '}
          <Link
            href={`/invoices/${invoice.similar_scam.invoiceId}`}
            className="font-semibold text-amber-100 underline underline-offset-2"
          >
            View that invoice
          </Link>
        </p>
      )}

      {reasons.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {reasons.map((reason, index) => (
            <li key={`${reason.code}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  {REASON_TITLE[reason.code] ?? reason.code.replaceAll('_', ' ')}
                </p>
                <span className="shrink-0 text-sm font-bold tabular-nums text-red-400">+{reason.points}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-white/65">{maskLongNumbers(reason.detail)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/50">No risk signals on this invoice.</p>
      )}

      {invoice.explanation && <Explanation text={invoice.explanation} />}
    </section>
  );
}
