import type { InvoiceStatus } from '@/lib/types';

/** Small badges are soft tinted pills (they sit in tables); large ones are solid so the flip reads from across a room. */
const STYLES: Record<InvoiceStatus, { label: string; soft: string; solid: string; dot: string }> = {
  pending: { label: 'Pending', soft: 'bg-gray-100 text-gray-700', solid: 'bg-gray-200 text-gray-900', dot: 'bg-gray-400' },
  frozen: { label: 'Frozen', soft: 'bg-amber-100 text-amber-900', solid: 'bg-amber-400 text-amber-950', dot: 'bg-amber-500' },
  verifying: { label: 'Verifying', soft: 'bg-blue-100 text-blue-800', solid: 'bg-blue-600 text-white', dot: 'bg-blue-500 animate-pulse' },
  approved: { label: 'Approved', soft: 'bg-green-100 text-green-800', solid: 'bg-green-600 text-white', dot: 'bg-green-500' },
  blocked: { label: 'Blocked', soft: 'bg-red-100 text-red-800', solid: 'bg-red-600 text-white shadow-lg shadow-red-600/30', dot: 'bg-red-500' },
};

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: InvoiceStatus;
  size?: 'sm' | 'lg';
}) {
  const style = STYLES[status];
  if (size === 'lg') {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors duration-500 ${style.solid} ${status === 'verifying' ? 'animate-pulse' : ''}`}
      >
        <span className="h-2 w-2 rounded-full bg-current opacity-80" />
        {style.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-500 ${style.soft}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
