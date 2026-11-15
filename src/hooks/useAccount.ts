'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { readAccountRaw, subscribeAccounts, type Account, type AccountKind } from '@/lib/accounts';

/**
 * The signed-in demo account of one kind. `undefined` while rendering on the server (not known yet),
 * `null` when nobody is signed in.
 */
export function useAccount(kind: AccountKind): Account | null | undefined {
  const raw = useSyncExternalStore(
    subscribeAccounts,
    () => readAccountRaw(kind),
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as Account;
    } catch {
      return null;
    }
  }, [raw]);
}
