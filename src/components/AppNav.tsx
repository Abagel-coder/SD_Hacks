import Link from 'next/link';
import { LogoMark } from '@/components/icons';

export function AppNav({ current }: { current: 'invoices' | 'blocklist' | 'backtest' }) {
  const link = (href: string, id: 'invoices' | 'blocklist' | 'backtest', label: string) => {
    const active = current === id;
    return (
      <Link
        href={href}
        className={
          active
            ? 'text-sm font-semibold text-accent underline decoration-accent decoration-2 underline-offset-[6px]'
            : 'text-sm text-gray-600 hover:text-gray-900 hover:underline underline-offset-4'
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
      <Link href="/" className="flex items-center gap-3">
        <LogoMark className="h-9 w-9" />
        <span>
          <span className="block text-lg font-bold leading-tight tracking-tight text-gray-900">Invoice Guard</span>
          <span className="block text-xs text-gray-600">Check every invoice before it is paid</span>
        </span>
      </Link>
      <div className="flex items-center gap-4">
        {link('/', 'invoices', 'Invoices')}
        {link('/blocklist', 'blocklist', 'Blocklist')}
        {link('/backtest', 'backtest', 'Backtest')}
      </div>
    </nav>
  );
}
