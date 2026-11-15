import Link from 'next/link';
import { AccountChip } from '@/components/AccountChip';
import { Logo } from '@/components/Logo';

type Page = 'home' | 'invoices' | 'blocklist' | 'backtest';

export function AppNav({ current }: { current: Page }) {
  const link = (href: string, id: Page, label: string) => {
    const active = current === id;
    return (
      <Link
        href={href}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
          active ? 'bg-white text-black shadow-sm' : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="sticky top-3 z-50 flex flex-wrap items-center justify-between gap-3 rounded-full bg-black/90 py-2 pl-5 pr-2 text-white shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-md">
      <Link href="/">
        <Logo inverted />
      </Link>
      <div className="flex items-center gap-1">
        {link('/', 'home', 'Home')}
        {link('/invoices', 'invoices', 'Invoices')}
        {link('/blocklist', 'blocklist', 'Blocklist')}
        {link('/backtest', 'backtest', 'Backtest')}
        <span className="ml-2 hidden sm:block">
          <AccountChip kind="business" />
        </span>
      </div>
    </nav>
  );
}
