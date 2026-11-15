import type { InvoiceStatus } from '@/lib/types';

const STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-800 ring-gray-200' },
  frozen: { label: 'Frozen', className: 'bg-amber-400 text-amber-950 ring-amber-500' },
  verifying: { label: 'Verifying…', className: 'bg-blue-600 text-white ring-blue-700 animate-pulse' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-900 ring-green-200' },
  blocked: { label: 'Blocked', className: 'bg-red-600 text-white ring-red-700 shadow-lg shadow-red-200' },
};

const SIZES = {
  sm: 'px-2.5 py-0.5 text-xs',
  lg: 'px-5 py-2.5 text-base tracking-wide',
} as const;

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: InvoiceStatus;
  size?: keyof typeof SIZES;
}) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase ring-2 ring-inset transition-colors duration-500 ${SIZES[size]} ${style.className}`}
    >
      {style.label}
    </span>
  );
}
