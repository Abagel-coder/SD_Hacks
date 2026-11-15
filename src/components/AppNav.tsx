'use client';

import Link from 'next/link';

export function AppNav({ current }: { current: 'invoices' | 'blocklist' | 'backtest' }) {
  const link = (href: string, id: 'invoices' | 'blocklist' | 'backtest', label: string) => {
    const active = current === id;
    return (
      <Link
        href={href}
        className={`ig-underline text-sm ${active ? 'is-active text-white' : 'text-white/60 hover:text-white'}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-40 -mx-6 mb-2 border-b border-white/10 bg-[#070707]/80 px-6 py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="ig-display text-xl text-white transition hover:text-[var(--ig-green)]">
            Invoice Guard
          </Link>
          <p className="mt-0.5 text-xs tracking-wide text-white/45">
            Check every invoice before it is paid
          </p>
        </div>
        <div className="flex items-center gap-5">
          {link('/', 'invoices', 'Invoices')}
          {link('/blocklist', 'blocklist', 'Blocklist')}
          {link('/backtest', 'backtest', 'Backtest')}
        </div>
      </div>
    </nav>
  );
}
