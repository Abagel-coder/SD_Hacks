'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/hooks/useAccount';
import { signOut, type AccountKind } from '@/lib/accounts';

/** Who this tab is signed in as, with a way out. Shows a Sign in link when nobody is. */
export function AccountChip({ kind }: { kind: AccountKind }) {
  const account = useAccount(kind);
  const router = useRouter();
  if (account === undefined) return null;
  if (!account) {
    return (
      <Link href="/login" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200">
        Sign in
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-1 ring-1 ring-white/15">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-bold text-black">{account.name.slice(0, 1)}</span>
      <span className="hidden text-left leading-tight md:block">
        <span className="block text-xs font-semibold text-white">{account.name}</span>
        <span className="block text-[10px] text-gray-400">{kind === 'business' ? 'Business owner' : 'Vendor'}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          signOut(kind);
          router.push('/login');
        }}
        className="rounded-full px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        Sign out
      </button>
    </span>
  );
}
