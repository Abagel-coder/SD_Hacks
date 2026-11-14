import type { InvoiceStatus } from '@/lib/types';

const STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
  frozen: { label: 'Frozen', className: 'bg-amber-100 text-amber-800' },
  verifying: { label: 'Verifying by phone', className: 'bg-blue-100 text-blue-800 animate-pulse' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  blocked: { label: 'Blocked', className: 'bg-red-600 text-white' },
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const style = STYLES[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}
