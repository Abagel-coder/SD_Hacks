import Link from 'next/link';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

export function AlertBanner({ invoices }: { invoices: InvoiceRow[] }) {
  const blocked = invoices.filter((invoice) => invoice.status === 'blocked');
  if (blocked.length === 0) return null;
  return (
    <div role="alert" className="space-y-1 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      {blocked.map((invoice) => (
        <p key={invoice.id}>
          <strong>Payment blocked:</strong> {money(invoice.amount, invoice.currency)} to {invoice.vendor_name}.
          The vendor did not confirm the bank change.{' '}
          <Link href={`/invoices/${invoice.id}`} className="font-semibold underline">Read the call transcript</Link>
        </p>
      ))}
    </div>
  );
}
