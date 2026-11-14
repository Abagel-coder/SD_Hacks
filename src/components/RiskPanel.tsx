import type { InvoiceRow } from '@/lib/types';

function scoreColor(score: number): string {
  if (score >= 50) return 'text-red-700';
  if (score >= 25) return 'text-amber-700';
  return 'text-green-700';
}

export function RiskPanel({ invoice }: { invoice: InvoiceRow }) {
  const score = invoice.risk_score ?? 0;
  const reasons = invoice.risk_reasons ?? [];
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Risk</h2>
        <p className={`text-3xl font-bold tabular-nums ${scoreColor(score)}`}>
          {score}<span className="text-base font-normal text-gray-500"> / 100</span>
        </p>
      </div>
      {invoice.explanation && <p className="mt-2 text-sm text-gray-800">{invoice.explanation}</p>}
      {reasons.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm">
          {reasons.map((reason, index) => (
            <li key={`${reason.code}-${index}`} className="flex gap-3">
              <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-red-700">+{reason.points}</span>
              <span>{reason.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
