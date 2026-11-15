'use client';

import { CountUp } from '@/components/CountUp';
import { Spotlight } from '@/components/Spotlight';
import { usePoll } from '@/hooks/usePoll';
import { money } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

export function LiveStats() {
  const { data } = usePoll<{ invoices: InvoiceRow[] }>('/api/invoices', 5000);
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
