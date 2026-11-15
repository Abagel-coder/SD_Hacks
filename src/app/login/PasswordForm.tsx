'use client';

import { useState, type FormEvent } from 'react';
import { Logo } from '@/components/Logo';

/** Step one of signing in: the business's shared password. Then the account picker, as before. */
export function PasswordForm({ next }: { next: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not sign in. Try again.');
      window.location.assign(next); // full load so every request carries the new cookie
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Try again.');
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md content-center gap-8 px-4 py-24 text-gray-900">
      <div className="animate-fade-up text-center">
        <span className="inline-flex"><Logo size="lg" /></span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Harbor Coffee Roasters</h1>
        <p className="mt-2 text-gray-500">Sign in to review invoices and payments.</p>
      </div>
      <form onSubmit={onSubmit} className="card animate-fade-up space-y-4 p-6" style={{ animationDelay: '100ms' }}>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
          />
        </label>
        {error && (
          <p id="login-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded-full bg-black px-6 py-3 text-base font-semibold text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
