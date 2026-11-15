'use client';

import Link from 'next/link';
import { CountUp } from '@/components/CountUp';
import { Spotlight } from '@/components/Spotlight';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

export function LiveStats() {
  const { data, error } = usePoll<{ invoices: InvoiceRow[] }>('/api/invoices', 5000);
  // Logged out, the invoices API answers 401: invite a login rather than showing zeros.
  if (!data && error?.includes('401')) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <p className="text-sm text-gray-500">Log in to see live numbers from Harbor Coffee Roasters&apos; invoices.</p>
        <Link href="/login" className="btn">Log in</Link>
      </div>
    );
  }
  const invoices = data?.invoices ?? [];
  const blocked = invoices.filter((invoice) => invoice.status === 'blocked');
  const saved = blocked.reduce((sum, invoice) => sum + (invoice.amount ?? 0), 0);

  const stats = [
    { label: 'Invoices checked', value: invoices.length, format: String, tone: 'text-gray-900' },
    { label: 'Payments frozen', value: invoices.filter((i) => i.status === 'frozen' || i.status === 'verifying').length, format: String, tone: 'text-amber-600' },
    { label: 'Scams blocked', value: blocked.length, format: String, tone: 'text-red-600' },
    { label: 'Money protected', value: saved, format: (n: number) => money(n, 'USD'), tone: 'text-green-700' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat, index) => (
        <Spotlight key={stat.label} className="card card-hover animate-fade-up p-5" style={{ animationDelay: `${index * 80}ms` }}>
          <p className="eyebrow">{stat.label}</p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${stat.tone}`}>
            <CountUp value={stat.value} format={stat.format} />
          </p>
        </Spotlight>
      ))}
    </div>
  );
}
