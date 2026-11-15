import type { InvoiceStatus } from '@/lib/types';

const STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-white/10 text-white/80 ring-white/20' },
  frozen: { label: 'Frozen', className: 'bg-amber-400 text-amber-950 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.35)]' },
  verifying: { label: 'Verifying…', className: 'bg-sky-500 text-white ring-sky-300 animate-pulse shadow-[0_0_24px_rgba(14,165,233,0.4)]' },
  approved: { label: 'Approved', className: 'bg-[var(--ig-green)] text-[#04140b] ring-emerald-300 shadow-[0_0_24px_rgba(6,193,103,0.35)]' },
  blocked: { label: 'Blocked', className: 'bg-red-600 text-white ring-red-400 shadow-[0_0_28px_rgba(220,38,38,0.45)]' },
};

const SIZES = {
  sm: 'px-2.5 py-0.5 text-[10px]',
  lg: 'px-5 py-2.5 text-sm tracking-[0.12em]',
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
      className={`inline-flex items-center rounded-full font-bold uppercase ring-2 ring-inset transition-all duration-500 ${SIZES[size]} ${style.className}`}
    >
      {style.label}
    </span>
  );
}
