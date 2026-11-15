import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

interface Totals {
  protectedAmount: number;
  frozen: number;
  blocked: number;
  approved: number;
}

/** "$ protected" is money held back from suspicious invoices: frozen plus blocked amounts. */
function totals(invoices: InvoiceRow[]): Totals {
  const t: Totals = { protectedAmount: 0, frozen: 0, blocked: 0, approved: 0 };
  for (const invoice of invoices) {
    if (invoice.status === 'frozen' || invoice.status === 'verifying') t.frozen += 1;
    if (invoice.status === 'blocked') t.blocked += 1;
    if (invoice.status === 'approved') t.approved += 1;
    if (invoice.status === 'frozen' || invoice.status === 'verifying' || invoice.status === 'blocked') {
      t.protectedAmount += Number(invoice.amount) || 0;
    }
  }
  return t;
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}

export function StatsStrip({ invoices, loading }: { invoices: InvoiceRow[]; loading: boolean }) {
  const t = totals(invoices);
  const show = (value: string) => (loading ? '…' : value);
  return (
    <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="$ protected" value={show(money(t.protectedAmount))} hint="held or stopped" accent="bg-blue-600" />
      <Stat label="Frozen" value={show(String(t.frozen))} hint="waiting on the vendor" accent="bg-amber-400" />
      <Stat label="Blocked" value={show(String(t.blocked))} hint="vendor denied" accent="bg-red-600" />
      <Stat label="Approved" value={show(String(t.approved))} hint="paid as normal" accent="bg-green-600" />
    </section>
  );
}
