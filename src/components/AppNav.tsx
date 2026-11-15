import Link from 'next/link';

export function AppNav({ current }: { current: 'invoices' | 'blocklist' }) {
  const link = (href: string, id: 'invoices' | 'blocklist', label: string) => {
    const active = current === id;
    return (
      <Link
        href={href}
        className={
          active
            ? 'text-sm font-semibold text-gray-900 underline decoration-2 underline-offset-4'
            : 'text-sm text-gray-600 hover:text-gray-900 hover:underline underline-offset-4'
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
      <div>
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          Invoice Guard
        </Link>
        <p className="text-xs text-gray-600">Check every invoice before it is paid</p>
      </div>
      <div className="flex items-center gap-4">
        {link('/', 'invoices', 'Invoices')}
        {link('/blocklist', 'blocklist', 'Blocklist')}
      </div>
    </nav>
  );
}
