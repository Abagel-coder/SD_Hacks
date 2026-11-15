'use client';

import { useRouter } from 'next/navigation';
import { Spotlight } from '@/components/Spotlight';
import { BUSINESS_ACCOUNTS, VENDOR_ACCOUNTS, signIn, type Account } from '@/lib/accounts';

function AccountButton({ account, onPick, dark }: { account: Account; onPick: (a: Account) => void; dark?: boolean }) {
  return (
    <button type="button" onClick={() => onPick(account)} className="group block w-full text-left">
      <Spotlight className={`card card-hover flex items-center gap-4 p-4 ${dark ? 'spotlight-dark !bg-black text-white' : ''}`}>
        <span
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-semibold ${
            dark ? 'bg-white text-black' : 'bg-gray-100 text-gray-900'
          }`}
        >
          {account.name.slice(0, 1)}
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-base font-semibold">{account.name}</span>
          <span className={`block text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{account.role}</span>
        </span>
        <span className="relative text-lg transition-transform duration-300 group-hover:translate-x-1" aria-hidden>→</span>
      </Spotlight>
    </button>
  );
}

/** Business and vendor demo accounts side by side. `next` is where to go after signing in, when it fits the account. */
export function AccountPicker({ next }: { next?: string | null }) {
  const router = useRouter();

  function pick(account: Account) {
    signIn(account);
    const fallback = account.kind === 'business' ? '/invoices' : '/vendor';
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    const nextFits = safeNext && (account.kind === 'vendor' ? safeNext.startsWith('/vendor') : !safeNext.startsWith('/vendor'));
    router.push(nextFits ? safeNext : fallback);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="space-y-3">
        <div>
          <p className="eyebrow">Business</p>
          <p className="mt-1 text-sm text-gray-500">Uploads invoices, sees the risk checks, has Vouch call the vendor.</p>
        </div>
        {BUSINESS_ACCOUNTS.map((account) => (
          <AccountButton key={account.name} account={account} onPick={pick} dark />
        ))}
      </section>
      <section className="space-y-3">
        <div>
          <p className="eyebrow">Vendor</p>
          <p className="mt-1 text-sm text-gray-500">Gets the verification call on their phone and answers the agent.</p>
        </div>
        {VENDOR_ACCOUNTS.map((account) => (
          <AccountButton key={account.name} account={account} onPick={pick} />
        ))}
      </section>
    </div>
  );
}
