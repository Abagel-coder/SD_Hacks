import Link from 'next/link';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

const MAX_LINES = 3;

/** Identical blocked alerts (same vendor and amount) collapse into one line with a count, latest first. */
function groupAlerts(blocked: InvoiceRow[]): { latest: InvoiceRow; count: number }[] {
  const latestFirst = [...blocked].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups = new Map<string, { latest: InvoiceRow; count: number }>();
  for (const invoice of latestFirst) {
    const key = `${invoice.vendor_name}|${invoice.amount}|${invoice.currency}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { latest: invoice, count: 1 });
  }
  return [...groups.values()].slice(0, MAX_LINES);
}

export function AlertBanner({ invoices }: { invoices: InvoiceRow[] }) {
  const blocked = invoices.filter((invoice) => invoice.status === 'blocked');
  if (blocked.length === 0) return null;
  return (
    <div
      role="alert"
      className="space-y-1 rounded-2xl border border-red-500/40 bg-red-950/50 p-4 text-sm text-red-100 shadow-[0_0_40px_rgba(220,38,38,0.15)]"
    >
      {groupAlerts(blocked).map(({ latest, count }) => (
        <p key={latest.id}>
          <strong className="text-red-50">Payment blocked:</strong> {money(latest.amount, latest.currency)} to{' '}
          {latest.vendor_name}
          {count > 1 ? ` (×${count})` : ''}. The vendor did not confirm the bank change.{' '}
          <Link href={`/invoices/${latest.id}`} className="font-semibold text-white underline underline-offset-2">
            Read the call transcript
          </Link>
        </p>
      ))}
    </div>
  );
}
