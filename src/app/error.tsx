'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Logo } from '@/components/Logo';

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md content-center gap-6 px-4 py-24 text-center text-gray-900">
      <Link href="/" className="mx-auto inline-flex"><Logo size="lg" /></Link>
      <div className="card space-y-3 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          This page hit an error. No payment was approved or changed. Try again, or go back to your invoices.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Try again
          </button>
          <Link href="/invoices" className="rounded-full px-5 py-2.5 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-colors hover:bg-gray-100">
            Invoices
          </Link>
        </div>
      </div>
    </main>
  );
}
