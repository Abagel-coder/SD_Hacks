'use client';

/**
 * Demo accounts. There are no passwords: signing in just picks which side of the story this browser tab plays.
 * The business and vendor sessions are stored separately, so one browser can have the owner in one tab
 * and the vendor's phone in another.
 */
export type AccountKind = 'business' | 'vendor';

export interface Account {
  kind: AccountKind;
  name: string;
  role: string;
}

export const BUSINESS_ACCOUNTS: Account[] = [
  { kind: 'business', name: 'Harbor Coffee Roasters', role: 'Business owner · accounts payable' },
];

/** Vendors match the seeded vendor names, so the vendor's phone rings for that vendor's invoices. */
export const VENDOR_ACCOUNTS: Account[] = [
  { kind: 'vendor', name: 'Uline', role: 'Vendor · accounts receivable' },
  { kind: 'vendor', name: 'Grainger', role: 'Vendor · accounts receivable' },
  { kind: 'vendor', name: 'Sysco', role: 'Vendor · accounts receivable' },
];

const KEY: Record<AccountKind, string> = { business: 'ig-business-account', vendor: 'ig-vendor-account' };
const CHANGED = 'ig-account-changed';

export function readAccount(kind: AccountKind): Account | null {
  try {
    const raw = window.localStorage.getItem(KEY[kind]);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

/** The raw stored string, which is stable between reads (useSyncExternalStore needs that). */
export function readAccountRaw(kind: AccountKind): string | null {
  try {
    return window.localStorage.getItem(KEY[kind]);
  } catch {
    return null;
  }
}

export function signIn(account: Account) {
  try {
    window.localStorage.setItem(KEY[account.kind], JSON.stringify(account));
  } catch {
    // Storage blocked (private window): the session lasts until reload, which is fine for a demo.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function signOut(kind: AccountKind) {
  try {
    window.localStorage.removeItem(KEY[kind]);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function subscribeAccounts(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}
